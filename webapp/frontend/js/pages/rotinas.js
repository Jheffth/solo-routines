/* ============================================================
   rotinas.js — Solo Routines
   Ciclo de vida completo: PENDENTE → ATIVA → CONCLUIDA | FRACASSADA | CANCELADA
   Status por dia vem do backend (ExecucaoDia). SessionStorage é só otimismo.

   A renderização e o ciclo de vida dos cartões (iniciar/pausar/retomar/
   cancelar/concluir/extinguir) são delegados ao componente MissaoCard.
   A página trata só editar/excluir (via onAcao) e recarrega tudo em onMudou.
   ============================================================ */

const Rotinas = {
  _tipoAtivo:      'DIARIA',
  _lista:          [],
  _timerInterval:  null,
  _autoCheckInterval: null,  // para auto-start e auto-fracassar
  _statusCache:    {},   // { rotina_id: status } — otimismo, fonte de verdade = API
  _execCache:      {},   // { rotina_id: exec_hoje obj }
  _ordem:          'PRIORIDADE',
  _isArquiteto:    false,

  // ── Mapeamentos ────────────────────────────────────────────
  _PRIOR_ORDER: { CRITICA: 0, ALTA: 1, MEDIA: 2, BAIXA: 3 },
  _PRIOR_CORES: {
    CRITICA: { cor: '#ef4444', bg: 'rgba(239,68,68,.12)', label: '🔴 CRÍTICA' },
    ALTA:    { cor: '#f97316', bg: 'rgba(249,115,22,.12)', label: '🟠 ALTA'    },
    MEDIA:   { cor: '#f59e0b', bg: 'rgba(245,158,11,.12)', label: '🟡 MÉDIA'   },
    BAIXA:   { cor: '#10b981', bg: 'rgba(16,185,129,.12)', label: '🟢 BAIXA'   },
  },
  _CAT_ICONS: {
    Saude:'❤️', Saúde:'❤️', Trabalho:'💼', Estudo:'📚',
    Casa:'🏠', Pessoal:'⚡', Combate:'⚔️'
  },

  // Status configs para visual
  _STATUS_CFG: {
    PENDENTE:   { cor: '#a855f7',  bg: 'rgba(168,85,247,.08)',  label: '⏳ PENDENTE',   opacity: 1   },
    ATIVA:      { cor: '#3b82f6',  bg: 'rgba(59,130,246,.10)',  label: '▶ EM CURSO',    opacity: 1   },
    CONCLUIDA:  { cor: '#10b981',  bg: 'rgba(16,185,129,.10)',  label: '✓ CONCLUÍDA',   opacity: 1   },
    FRACASSADA: { cor: '#ef4444',  bg: 'rgba(239,68,68,.10)',   label: '☠ FRACASSADA',  opacity: 0.8 },
    CANCELADA:  { cor: '#64748b',  bg: 'rgba(100,116,139,.08)', label: '✕ CANCELADA',   opacity: 0.6 },
    PAUSADA:    { cor: '#64748b',  bg: 'rgba(100,116,139,.08)', label: '⏸ PAUSADA',     opacity: 0.8 },
  },

  // ── Inicialização ──────────────────────────────────────────
  async carregar() {
    const u = typeof Auth !== 'undefined' ? Auth.getUsuario() : null;
    this._isArquiteto = u?.nivel_acesso === 'Arquiteto';
    this._carregarOrdem();
    await this.carregarPorTipo(this._tipoAtivo); // (re)inicia o auto-check
    this._bindTabs();
    this._bindBotaoNova();
    this._bindOrdenacao();
  },

  // ── Cache de ordem ─────────────────────────────────────────
  _carregarOrdem() {
    this._ordem = localStorage.getItem('sr_rotinas_ordem') || 'PRIORIDADE';
  },
  _salvarOrdem(o) {
    this._ordem = o;
    try { localStorage.setItem('sr_rotinas_ordem', o); } catch (_) {}
  },

  // ── Para timers ao sair ────────────────────────────────────
  destruir() {
    if (this._timerInterval)    { clearInterval(this._timerInterval);    this._timerInterval    = null; }
    if (this._autoCheckInterval){ clearInterval(this._autoCheckInterval); this._autoCheckInterval = null; }
    // Encerra também o timer de prazo do MissaoCard ao sair da tela — ele
    // se auto-encerra em ≤1s, mas parar na hora é mais limpo.
    if (typeof MissaoCard !== 'undefined' && MissaoCard.pararTimer) MissaoCard.pararTimer();
  },

  // ── Carrega por tipo ───────────────────────────────────────
  async carregarPorTipo(tipo) {
    this._tipoAtivo = tipo;
    this.destruir();
    const cont = document.getElementById('lista-rotinas');
    if (!cont) return;
    cont.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';

    try {
      const lista = await API.get(`/rotinas/?tipo=${tipo}`);
      this._lista = lista || [];

      // Usa status_hoje da API como fonte da verdade
      this._lista.forEach(r => {
        this._statusCache[r.id] = r.status_hoje || 'PENDENTE';
        if (r.exec_hoje) this._execCache[r.id] = r.exec_hoje;
      });

      this.renderLista(this._ordenarLista(this._lista));
      this._iniciarAutoCheck(); // (re)inicia auto-start/auto-fracasso — 1 só interval
    } catch (err) {
      console.error('[Rotinas]', err);
      cont.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><div>Erro ao carregar rotinas — ' + (err.message || '') + '</div></div>';
    }
  },

  // ── Render da lista (via MissaoCard) ───────────────────────
  renderLista(lista) {
    const cont = document.getElementById('lista-rotinas');
    if (!cont) return;

    if (!lista.length) {
      cont.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">&#128260;</div>
          <div>Nenhuma rotina ${this._tipoAtivo.toLowerCase()} encontrada</div>
          <button class="btn btn-primary btn-sm" id="btn-nova-rotina-empty">+ Criar primeira rotina</button>
        </div>`;
      document.getElementById('btn-nova-rotina-empty')?.addEventListener('click', () => this.abrirFormulario());
      return;
    }

    // MissaoCard: monta o HTML, alimenta o timer de prazo e liga a delegação.
    // O _executar do card já chama os endpoints reais e dispara onMudou.
    // editar/excluir chegam via onAcao (o card não resolve essas).
    MissaoCard.cachear(lista);
    cont.innerHTML = '<div style="display:flex;flex-direction:column;gap:.9rem">'
      + lista.map(r => MissaoCard.html(r)).join('') + '</div>';
    MissaoCard.montar(cont, {
      onMudou: () => this.carregarPorTipo(this._tipoAtivo),
      onAcao:  (acao, id, m) => {
        if (acao === 'editar')  this.abrirFormulario(this._lista.find(x => x.id === id) || m);
        if (acao === 'excluir') this.confirmarExcluir(this._lista.find(x => x.id === id) || m);
      },
    });
  },

  // ── Auto-check: auto-start e auto-fracassar ────────────────
  // Tick leve: só detecta transições de prazo/horário, chama o endpoint e,
  // se algo mudou, recarrega a lista inteira (não redesenha card a card).
  _iniciarAutoCheck() {
    if (this._autoCheckInterval) clearInterval(this._autoCheckInterval);
    this._autoCheckInterval = setInterval(() => this._verificarAutoAcoes(), 30000);
    // Roda logo após carregar também
    setTimeout(() => this._verificarAutoAcoes(), 1000);
  },

  async _verificarAutoAcoes() {
    if (!this._lista || !this._lista.length) return;
    const agora = new Date();
    let mudou = false;

    for (const r of this._lista) {
      const status = this._statusCache[r.id] || r.status_hoje || 'PENDENTE';
      if (status === 'CONCLUIDA' || status === 'FRACASSADA' || status === 'CANCELADA') continue;

      // Auto-START: hora_inicio chegou e missão ainda PENDENTE
      if (status === 'PENDENTE' && r.hora_inicio) {
        const [hI, mI] = r.hora_inicio.split(':').map(Number);
        const inicio = new Date(agora); inicio.setHours(hI, mI, 0, 0);
        if (agora >= inicio) {
          try {
            console.log(`[AutoStart] Iniciando rotina ${r.id}: ${r.titulo}`);
            await API.post(`/rotinas/${r.id}/iniciar`, {});
            this._statusCache[r.id] = 'ATIVA';
            mudou = true;
            continue; // já iniciou; não avaliar fracasso na mesma passada
          } catch (err) {
            if (!err.message?.includes('400')) console.warn('[AutoStart]', err);
          }
        }
      }

      // Auto-FRACASSAR: prazo venceu e missão ainda ATIVA ou PENDENTE
      if (status === 'ATIVA' || status === 'PENDENTE') {
        const segs = this._calcSegundosRestantes(r);
        if (segs <= 0) {
          try {
            console.log(`[AutoFail] Fracassando rotina ${r.id}: ${r.titulo}`);
            await API.post(`/rotinas/${r.id}/fracassar`, {});
            this._statusCache[r.id] = 'FRACASSADA';
            mudou = true;
          } catch (err) {
            if (!err.message?.includes('400')) console.warn('[AutoFail]', err);
          }
        }
      }
    }

    // Recarrega uma única vez se houve transição automática
    if (mudou) this.carregarPorTipo(this._tipoAtivo);
  },

  // ── Helper de cálculo de prazo (usado pelo auto-check) ─────
  _calcSegundosRestantes(r) {
    const agora = new Date();
    if (r.hora_fim) {
      const [hFh, hFm] = r.hora_fim.split(':').map(Number);
      const prazo = new Date(agora); prazo.setHours(hFh, hFm, 0, 0);
      return Math.floor((prazo - agora) / 1000);
    }
    if (r.tipo === 'DIARIA') {
      const fim = new Date(agora); fim.setHours(23, 59, 59, 0);
      return Math.floor((fim - agora) / 1000);
    }
    const dur = { SEMANAL: 7, MENSAL: 30, ANUAL: 365 };
    const dias = dur[r.tipo] || 1;
    const criado = new Date(r.criado_em || agora);
    const prazo  = new Date(criado.getTime() + dias * 86400000);
    return Math.floor((prazo - agora) / 1000);
  },

  // ── Exclusão normal (dona do próprio template) ─────────────
  async confirmarExcluir(item) {
    if (!item) return;
    const ok = await SoloDialog.confirm(
      `Excluir a rotina "<strong>${item.titulo}</strong>"?<br><br><span style="color:#94a3b8">Esta ação é irreversível.</span>`,
      { titulo: 'Excluir Rotina', icon: '🗑️', tipo: 'error', btnOk: 'Excluir', btnCancel: 'Cancelar' }
    );
    if (!ok) return;
    try {
      await API.delete(`/rotinas/${item.id}`);
      delete this._statusCache[item.id];
      delete this._execCache[item.id];
      this._lista = this._lista.filter(r => r.id !== item.id);
      this.renderLista(this._ordenarLista(this._lista));
      SoloDialog.toast('Rotina excluída.', 'success');
    } catch (err) {
      SoloDialog.toast('Erro ao excluir: ' + (err.message || err), 'error');
    }
  },

  // ── Ordenação ──────────────────────────────────────────────
  _ordenarLista(lista) {
    const s = [...lista];
    const statusOrd = { ATIVA: 0, PENDENTE: 1, PAUSADA: 2, CANCELADA: 3, FRACASSADA: 4, CONCLUIDA: 5 };
    if (this._ordem === 'PRIORIDADE') {
      return s.sort((a, b) => {
        const sa = statusOrd[this._statusCache[a.id] || a.status_hoje || 'PENDENTE'] ?? 9;
        const sb = statusOrd[this._statusCache[b.id] || b.status_hoje || 'PENDENTE'] ?? 9;
        if (sa !== sb) return sa - sb;
        return (this._PRIOR_ORDER[a.prioridade] ?? 9) - (this._PRIOR_ORDER[b.prioridade] ?? 9);
      });
    }
    if (this._ordem === 'TITULO') return s.sort((a, b) => (a.titulo||'').localeCompare(b.titulo||''));
    if (this._ordem === 'RECENTE') return s.sort((a, b) => new Date(b.criado_em||0) - new Date(a.criado_em||0));
    return s;
  },

  // ── Bind Tabs ──────────────────────────────────────────────
  _bindTabs() {
    // Suporta tanto .rotina-tab quanto [data-tipo-rotina] (padrão do index.html)
    const tabs = document.querySelectorAll('[data-tipo-rotina], .rotina-tab');
    tabs.forEach(tab => {
      if (tab._rotinaTabBound) return;
      tab._rotinaTabBound = true;
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const tipo = tab.dataset.tipoRotina || tab.dataset.tipo;
        if (tipo) this.carregarPorTipo(tipo);
      });
    });
  },

  _bindBotaoNova() {
    const btn = document.getElementById('btn-nova-rotina');
    if (btn && !btn._rotinaBound) {
      btn._rotinaBound = true;
      btn.addEventListener('click', () => this.abrirFormulario());
    }
  },

  _bindOrdenacao() {
    // Suporta botões [data-ordem] (padrão do index.html)
    document.querySelectorAll('[data-ordem]').forEach(btn => {
      if (btn._ordemBound) return;
      btn._ordemBound = true;
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-ordem]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._salvarOrdem(btn.dataset.ordem);
        this.renderLista(this._ordenarLista(this._lista));
      });
    });
    // Também suporta o <select id="rotinas-ordem"> legado
    const sel = document.getElementById('rotinas-ordem');
    if (sel) {
      sel.value = this._ordem;
      sel.addEventListener('change', () => {
        this._salvarOrdem(sel.value);
        this.renderLista(this._ordenarLista(this._lista));
      });
    }
  },

  abrirFormulario(item = null) {
    if (typeof Lancador !== 'undefined') Lancador.abrir('ROTINA', item || null);
  },
};
