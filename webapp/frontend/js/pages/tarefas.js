/* ============================================================
   tarefas.js — Solo Routines
   Ciclo de vida: PENDENTE → ATIVA → CONCLUIDA | CANCELADA
   Espelha rotinas.js: Iniciar, Pausar, Retomar, Cancelar,
   Concluir, Extinguir (Arquiteto), timer ao vivo.
   ============================================================ */

const Tarefas = {
  _dataAtual:     null,
  _lista:         [],
  _statusCache:   {},    // { tarefa_id: status }
  _ordem:         'PRIORIDADE',
  _timerInterval: null,
  _isArquiteto:   false,

  // ── Mapeamentos (idênticos ao rotinas.js) ─────────────────
  _PRIOR_CORES: {
    CRITICA: { cor: '#ef4444', bg: 'rgba(239,68,68,.12)',  label: '🔴 CRÍTICA' },
    ALTA:    { cor: '#f97316', bg: 'rgba(249,115,22,.12)', label: '🟠 ALTA'    },
    MEDIA:   { cor: '#f59e0b', bg: 'rgba(245,158,11,.12)', label: '🟡 MÉDIA'   },
    BAIXA:   { cor: '#10b981', bg: 'rgba(16,185,129,.12)', label: '🟢 BAIXA'   },
  },
  _CAT_ICONS: {
    Saude:'❤️', 'Saúde':'❤️', Trabalho:'💼', Estudo:'📚',
    Casa:'🏠', Pessoal:'⚡', Combate:'⚔️'
  },
  _STATUS_CFG: {
    PENDENTE:   { cor: '#a855f7', bg: 'rgba(168,85,247,.08)', label: '⏳ PENDENTE'   },
    ATIVA:      { cor: '#3b82f6', bg: 'rgba(59,130,246,.10)', label: '▶ EM CURSO'    },
    PAUSADA:    { cor: '#64748b', bg: 'rgba(100,116,139,.08)',label: '⏸ PAUSADA'     },
    CONCLUIDA:  { cor: '#10b981', bg: 'rgba(16,185,129,.10)', label: '✓ CONCLUÍDA'   },
    CANCELADA:  { cor: '#64748b', bg: 'rgba(100,116,139,.08)',label: '✕ CANCELADA'   },
    FRACASSADA: { cor: '#ef4444', bg: 'rgba(239,68,68,.10)',  label: '☠ FRACASSADA'  },
  },
  _DIFIC_MULT: { FACIL: 0.5, NORMAL: 1.0, DIFICIL: 1.5, LENDARIO: 2.5 },
  _PRIOR_ORDER: { CRITICA: 0, ALTA: 1, MEDIA: 2, BAIXA: 3 },

  // ── Inicialização ─────────────────────────────────────────
  async carregar() {
    const u = typeof Auth !== 'undefined' ? Auth.getUsuario() : null;
    this._isArquiteto = u?.nivel_acesso === 'Arquiteto';
    this._ordem = localStorage.getItem('sr_tarefas_ordem') || 'PRIORIDADE';

    const hoje = new Date();
    this._dataAtual = this._fmtDate(hoje);

    const inputData = document.getElementById('filter-data-tarefa');
    if (inputData) {
      inputData.value = this._dataAtual;
      inputData.addEventListener('change', (e) => {
        this._dataAtual = e.target.value;
        this.carregarPorData(this._dataAtual);
      });
    }

    await this.carregarPorData(this._dataAtual);
    this._bindBotaoNova();
    this._bindOrdenacao();
  },

  destruir() {
    if (this._timerInterval) { clearInterval(this._timerInterval); this._timerInterval = null; }
  },

  // ── Carrega lista ─────────────────────────────────────────
  async carregarPorData(data) {
    this.destruir();
    const cont = document.getElementById('lista-tarefas');
    if (!cont) return;
    cont.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';

    try {
      const lista = await API.get(`/tarefas/?data=${data}`);
      this._lista = lista || [];
      this._lista.forEach(t => {
        this._statusCache[t.id] = t.status || 'PENDENTE';
      });
      this.renderLista(this._ordenarLista(this._lista));
    } catch (err) {
      cont.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><div>Erro ao carregar tarefas</div></div>';
    }
  },

  // ── Ordenação ─────────────────────────────────────────────
  _ordenarLista(lista) {
    return [...lista].sort((a, b) => {
      const aC = ['CONCLUIDA','CANCELADA','FRACASSADA'].includes(a.status) ? 1 : 0;
      const bC = ['CONCLUIDA','CANCELADA','FRACASSADA'].includes(b.status) ? 1 : 0;
      if (aC !== bC) return aC - bC;
      if (this._ordem === 'PRIORIDADE')
        return (this._PRIOR_ORDER[a.prioridade] ?? 2) - (this._PRIOR_ORDER[b.prioridade] ?? 2);
      if (this._ordem === 'STATUS')
        return (a.status || '').localeCompare(b.status || '');
      if (this._ordem === 'DATA') {
        const da = a.data_prevista || a.data_vencimento || '';
        const db = b.data_prevista || b.data_vencimento || '';
        return da.localeCompare(db);
      }
      return 0;
    });
  },

  // ── Render ────────────────────────────────────────────────
  renderLista(lista) {
    const cont = document.getElementById('lista-tarefas');
    if (!cont) return;

    if (!lista.length) {
      cont.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <div>Nenhuma tarefa para esta data</div>
          <button class="btn btn-primary btn-sm" id="btn-nova-tarefa-empty">+ Adicionar Tarefa</button>
        </div>`;
      document.getElementById('btn-nova-tarefa-empty')
        ?.addEventListener('click', () => this.abrirFormulario());
      return;
    }

    const ativas   = lista.filter(t => !['CONCLUIDA','CANCELADA','FRACASSADA'].includes(t.status));
    const finais   = lista.filter(t =>  ['CONCLUIDA','CANCELADA','FRACASSADA'].includes(t.status));

    let html = `<div style="display:flex;flex-direction:column;gap:.9rem">`;
    ativas.forEach(t  => { html += this._buildCard(t); });
    if (finais.length) {
      html += `
        <div style="font-family:var(--font-section);font-size:.72rem;color:var(--text-muted);
          letter-spacing:1.5px;text-transform:uppercase;margin-top:.5rem;padding-top:.5rem;
          border-top:1px solid rgba(255,255,255,.06)">
          ✅ Concluídas / Encerradas (${finais.length})
        </div>`;
      finais.forEach(t => { html += this._buildCard(t); });
    }
    html += `</div>`;

    cont.innerHTML = html;
    this._bindCardActions(cont);
    this._iniciarContadores();
  },

  // ── Build do card (espelho exato do rotinas.js) ───────────
  _buildCard(t) {
    const id      = t.id;
    const status  = this._statusCache[id] || t.status || 'PENDENTE';
    const titulo  = t.titulo || 'Tarefa';
    const cat     = t.categoria || 'Pessoal';
    const icone   = this._CAT_ICONS[cat] || '📋';
    const prior   = this._PRIOR_CORES[t.prioridade] || this._PRIOR_CORES.MEDIA;
    const scfg    = this._STATUS_CFG[status]         || this._STATUS_CFG.PENDENTE;
    const xp      = t.xp_recompensa     || t.xp     || 0;
    const moedas  = t.moedas_recompensa || 0;
    const penal   = t.penalidade_xp     || 0;
    const dific   = t.dificuldade       || 'NORMAL';
    const dificMult = this._DIFIC_MULT[dific] || 1;

    const isPendente   = status === 'PENDENTE';
    const isAtiva      = status === 'ATIVA';
    const isPausada    = status === 'PAUSADA';
    const isConcluida  = status === 'CONCLUIDA';
    const isCancelada  = status === 'CANCELADA';
    const isFracassada = status === 'FRACASSADA';
    const isFinal      = isConcluida || isCancelada || isFracassada;

    const bordaCor = isFinal || isPausada ? scfg.cor : prior.cor;
    const bgEfect  = isFinal || isPausada ? scfg.bg  : prior.bg;

    // Badge de status
    const statusBadge = `<span style="
      font-family:var(--font-section);font-size:.65rem;font-weight:700;letter-spacing:.1em;
      padding:.2rem .7rem;border-radius:100px;
      background:${scfg.bg};border:1px solid ${scfg.cor}88;color:${scfg.cor}">
      ${scfg.label}
    </span>`;

    // Janela de prazo
    const prazoData = t.data_prevista || t.data_vencimento;
    const janelaHtml = t.hora_limite ? `
      <span style="
        font-family:var(--font-section);font-size:.62rem;letter-spacing:.05em;
        padding:.15rem .55rem;border-radius:100px;
        background:rgba(6,182,212,.1);border:1px solid rgba(6,182,212,.3);color:var(--cyan-skill)">
        ⏰ até ${t.hora_limite}
      </span>` : (prazoData ? `
      <span style="
        font-family:var(--font-section);font-size:.62rem;letter-spacing:.05em;
        padding:.15rem .55rem;border-radius:100px;
        background:rgba(100,116,139,.08);border:1px solid rgba(100,116,139,.25);color:var(--text-muted)">
        📅 ${this._fmtDateDisplay(prazoData)}
      </span>` : '');

    // Countdown
    let countdownHtml = '';
    if (!isFinal) {
      const segs  = this._calcSegundosRestantes(t);
      const cdTxt = this._formatarCountdown(segs);
      const cdNeg = segs < 0;
      countdownHtml = `
        <div style="display:flex;align-items:center;gap:.4rem;font-family:var(--font-section)">
          <span style="font-size:.72rem;color:${cdNeg ? '#f87171' : 'var(--text-muted)'}">
            ${cdNeg ? '⚠️ VENCIDA' : (isPendente ? '⌛ Prazo' : '⏱')}
          </span>
          <span class="tarefa-countdown-val" data-tid="${id}"
            style="font-size:.78rem;font-weight:700;color:${cdNeg ? '#f87171' : '#e2e8f0'};
            ${cdNeg ? 'animation:glowPulse 1s infinite' : ''}">
            ${cdTxt}
          </span>
        </div>`;
    }

    // Botão helper
    const btnStyle = (cor, bg, borda) => `
      font-family:var(--font-section);font-size:.72rem;font-weight:700;letter-spacing:.06em;
      padding:.35rem .9rem;border-radius:.5rem;cursor:pointer;
      border:1px solid ${borda || cor + '88'};
      background:${bg};color:${cor};transition:all .2s`;

    // Botões de ação por status (idêntico ao rotinas.js)
    let acoesHtml = '';
    if (isPendente) {
      acoesHtml = `
        <button data-action="iniciar" data-id="${id}"
          style="${btnStyle('#a855f7','rgba(168,85,247,.18)','#a855f7')}">
          ▶ Iniciar Missão
        </button>`;
    } else if (isAtiva) {
      acoesHtml = `
        <button data-action="concluir" data-id="${id}"
          style="${btnStyle('#10b981','rgba(16,185,129,.15)')}">
          ✓ Concluir
        </button>
        <button data-action="pausar" data-id="${id}"
          style="${btnStyle('#64748b','rgba(100,116,139,.1)')}">
          ⏸ Pausar
        </button>
        <button data-action="cancelar" data-id="${id}"
          style="${btnStyle('#f87171','rgba(239,68,68,.06)','rgba(239,68,68,.4)')}">
          ✕ Cancelar
        </button>`;
    } else if (isPausada) {
      acoesHtml = `
        <button data-action="retomar" data-id="${id}"
          style="${btnStyle('var(--purple-glow)','rgba(124,58,237,.15)','var(--purple-main)')}">
          ▶ Retomar
        </button>
        <button data-action="cancelar" data-id="${id}"
          style="${btnStyle('#f87171','rgba(239,68,68,.06)','rgba(239,68,68,.4)')}">
          ✕ Cancelar
        </button>`;
    } else if (isCancelada) {
      acoesHtml = `
        <button data-action="retomar" data-id="${id}"
          style="${btnStyle('var(--purple-glow)','rgba(124,58,237,.12)','var(--purple-main)')}">
          ▶ Retomar
        </button>`;
    }

    // Botão Extinguir (Arquiteto)
    const extBtn = this._isArquiteto ? `
      <button data-action="extinguir" data-id="${id}" title="Extinguir (reverte saldos)" style="
        font-family:var(--font-section);font-size:.65rem;padding:.22rem .55rem;border-radius:.4rem;
        cursor:pointer;border:1px solid rgba(239,68,68,.4);background:rgba(239,68,68,.06);
        color:#f87171;transition:all .2s">
        ⚡ Extinguir
      </button>` : '';

    // Recompensas + punição
    const recompHtml = `
      <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
        <span style="font-family:var(--font-section);font-size:.7rem;color:var(--gold-xp);font-weight:700">
          ⚡ ${isConcluida ? (t.xp_ganho || xp) : xp} XP
        </span>
        <span style="color:var(--text-muted);font-size:.65rem">•</span>
        <span style="font-family:var(--font-section);font-size:.7rem;color:#fbbf24;font-weight:700">
          🪙 ${isConcluida ? (t.moedas_ganhas || moedas) : moedas}
        </span>
        ${penal > 0 && !isConcluida ? `
        <span style="color:var(--text-muted);font-size:.65rem">•</span>
        <span style="font-family:var(--font-section);font-size:.7rem;color:#f87171;font-weight:700">
          💀 -${isFracassada ? (t.xp_perdido || penal) : penal} XP
        </span>` : ''}
        <span style="color:var(--text-muted);font-size:.65rem">•</span>
        <span style="font-family:var(--font-section);font-size:.65rem;color:var(--purple-glow)">
          ×${dificMult} ${dific}
        </span>
      </div>`;

    return `
      <div class="rotina-card-rich" data-id="${id}" data-status="${status}" style="
        border:1px solid ${bordaCor}55;border-left:3px solid ${bordaCor};
        border-radius:.9rem;padding:1rem 1.2rem;position:relative;overflow:hidden;
        transition:all .25s;
        background:linear-gradient(135deg,${bgEfect},var(--bg-card));
        ${isConcluida  ? 'box-shadow:0 0 16px rgba(16,185,129,.15)' : ''}
        ${isFracassada ? 'box-shadow:0 0 16px rgba(239,68,68,.12)'  : ''}
        ${isCancelada  ? 'opacity:.6' : ''}
      ">
        <!-- Barra lateral -->
        <div style="position:absolute;left:0;top:0;bottom:0;width:3px;
          background:${bordaCor};border-radius:2px 0 0 2px"></div>

        <!-- Topo -->
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.8rem">
          <div style="display:flex;align-items:center;gap:.75rem;flex:1;min-width:0">
            <div style="
              width:40px;height:40px;border-radius:.6rem;flex-shrink:0;
              display:flex;align-items:center;justify-content:center;font-size:1.3rem;
              background:${prior.bg};border:1px solid ${prior.cor}44">
              ${isConcluida ? '✓' : icone}
            </div>
            <div style="min-width:0">
              <div style="
                font-family:var(--font-section);font-size:.95rem;font-weight:700;
                color:${isFracassada ? '#f87171' : isConcluida ? '#10b981' : 'var(--text-primary)'};
                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:.2rem;
                ${isConcluida  ? 'text-decoration:line-through;text-decoration-color:#10b98155' : ''}
                ${isFracassada ? 'text-decoration:line-through;text-decoration-color:#f8717155' : ''}
              ">${titulo}</div>
              <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
                <span style="
                  font-family:var(--font-section);font-size:.6rem;font-weight:700;letter-spacing:.08em;
                  padding:.1rem .45rem;border-radius:100px;
                  background:${prior.bg};border:1px solid ${prior.cor}55;color:${prior.cor}">
                  ${prior.label}
                </span>
                ${statusBadge}
                ${janelaHtml}
              </div>
            </div>
          </div>
          <!-- Countdown + editar -->
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.4rem;flex-shrink:0">
            ${countdownHtml}
            ${!isFinal ? `
            <button data-action="editar" data-id="${id}" title="Editar" style="
              background:none;border:none;color:var(--text-muted);font-size:.85rem;cursor:pointer;
              padding:.15rem .3rem;border-radius:.3rem;transition:.2s"
              onmouseover="this.style.color='var(--purple-glow)'"
              onmouseout="this.style.color='var(--text-muted)'">✏️</button>` : ''}
          </div>
        </div>

        ${t.descricao ? `
          <div style="font-size:.78rem;color:var(--text-muted);margin-top:.55rem;line-height:1.5;
            border-left:2px solid rgba(124,58,237,.25);padding-left:.6rem">
            ${t.descricao}
          </div>` : ''}

        <!-- Rodapé: recompensas + ações -->
        <div style="display:flex;align-items:center;justify-content:space-between;
          margin-top:.75rem;flex-wrap:wrap;gap:.5rem">
          ${recompHtml}
          <div style="display:flex;align-items:center;gap:.5rem;flex-shrink:0">
            ${acoesHtml}
            ${extBtn}
            ${isFinal ? '' : `
            <button data-action="excluir" data-id="${id}" title="Excluir" style="
              font-family:var(--font-section);font-size:.65rem;padding:.22rem .55rem;border-radius:.4rem;
              cursor:pointer;border:1px solid rgba(239,68,68,.4);background:rgba(239,68,68,.06);
              color:#f87171;transition:all .2s">🗑</button>`}
          </div>
        </div>
      </div>`;
  },

  // ── Bind ações (event delegation — funciona mesmo após _atualizarCard) ───
  _bindCardActions(cont) {
    // Remove listener anterior para evitar acumular duplicatas
    if (this._contClickHandler) {
      cont.removeEventListener('click', this._contClickHandler);
    }
    this._contClickHandler = async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      e.stopPropagation();
      const action = btn.dataset.action;
      const id     = parseInt(btn.dataset.id);
      const item   = this._lista.find(t => t.id === id);
      if (!item) return;
      switch (action) {
        case 'iniciar':   await this.iniciar(item, btn);   break;
        case 'concluir':  await this.concluir(item, btn);  break;
        case 'pausar':    await this.pausar(item, btn);    break;
        case 'retomar':   await this.retomar(item, btn);   break;
        case 'cancelar':  await this.cancelar(item);       break;
        case 'extinguir': await this.extinguir(item);      break;
        case 'editar':    this.abrirFormulario(item);      break;
        case 'excluir':   this.confirmarExcluir(item);     break;
      }
    };
    cont.addEventListener('click', this._contClickHandler);
  },

  // ── Aplica dados frescos ao card sem request extra ───────────────────
  // dadosFrescos: objeto retornado diretamente pelo POST (sem GET extra = sem delay)
  _aplicarCard(id, dadosFrescos) {
    const idx = this._lista.findIndex(t => t.id === id);
    if (idx !== -1) this._lista[idx] = dadosFrescos;
    this._statusCache[id] = dadosFrescos.status || 'PENDENTE';
    // Escopo ao container correto para não confundir com cards de rotinas
    const cont = document.getElementById('lista-tarefas');
    const card = cont?.querySelector(`.rotina-card-rich[data-id="${id}"]`);
    if (card && idx !== -1) {
      const tmp = document.createElement('div');
      tmp.innerHTML = this._buildCard(this._lista[idx]);
      const novo = tmp.firstElementChild;
      if (novo) { card.replaceWith(novo); return; }
    }
    // Fallback: recarrega lista inteira
    this.carregarPorData(this._dataAtual);
  },

  // ── Atualiza cache local e recarrega card ──────────────────────────
  _atualizarCard(id, novoStatus, dados = {}) {
    this._statusCache[id] = novoStatus;
    const idx = this._lista.findIndex(t => t.id === id);
    if (idx !== -1) {
      this._lista[idx].status = novoStatus;
      Object.assign(this._lista[idx], dados);
    }
    // Dispara recarregamento real do servidor
    this._recarregarCard(id);
  },

  // ── Ações (espelho exato de rotinas.js) ───────────────────
  async iniciar(t, btn) {
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Iniciando...'; }
    try {
      const resp = await API.post(`/tarefas/${t.id}/iniciar`, {});
      this._aplicarCard(t.id, resp);
      if (typeof SoloDialog !== 'undefined')
        SoloDialog.toast(`▶ Tarefa iniciada: ${t.titulo}`, 'info');
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = '▶ Iniciar Missão'; }
      const msg = err.message || String(err);
      if (typeof SoloDialog !== 'undefined') SoloDialog.toast('Erro ao iniciar: ' + msg, 'error');
    }
  },

  async concluir(t, btn) {
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Salvando...'; }
    try {
      const resp    = await API.post(`/tarefas/${t.id}/concluir`, {});
      const res     = resp?.resultado || resp;
      const xpGanho = res?.xp_ganho || res?.xp_base || t.xp_recompensa || 0;
      const moedasG = res?.moedas_ganhas || res?.moedas || t.moedas_recompensa || 0;
      const tarefa  = resp?.tarefa || resp;
      this._aplicarCard(t.id, { ...tarefa, status: 'CONCLUIDA', xp_ganho: xpGanho, moedas_ganhas: moedasG });
      // Float XP
      const xpFloat = document.getElementById('xp-float');
      if (xpFloat && xpGanho > 0) {
        xpFloat.textContent = `+${xpGanho} XP`;
        xpFloat.style.opacity = '1'; xpFloat.style.transform = 'translateY(-30px)';
        setTimeout(() => { xpFloat.style.opacity='0'; xpFloat.style.transform='translateY(0)'; }, 1600);
      }
      if (typeof mostrarXPFloat !== 'undefined') mostrarXPFloat(`+${xpGanho} XP`);
      if (typeof SoloDialog !== 'undefined')
        SoloDialog.toast(`✅ ${t.titulo} concluída! +${xpGanho} XP`, 'success');
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = '✓ Concluir'; }
      if (typeof SoloDialog !== 'undefined')
        SoloDialog.toast('Erro ao concluir: ' + (err.message || err), 'error');
    }
  },

  async pausar(t, btn) {
    if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
    try {
      const resp = await API.post(`/tarefas/${t.id}/pausar`, {});
      this._aplicarCard(t.id, resp);
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = '⏸ Pausar'; }
      if (typeof SoloDialog !== 'undefined')
        SoloDialog.toast('Erro ao pausar: ' + (err.message || err), 'error');
    }
  },

  async retomar(t, btn) {
    if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
    try {
      const resp = await API.post(`/tarefas/${t.id}/retomar`, {});
      this._aplicarCard(t.id, resp);
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = '▶ Retomar'; }
      if (typeof SoloDialog !== 'undefined')
        SoloDialog.toast('Erro ao retomar: ' + (err.message || err), 'error');
    }
  },

  async cancelar(t) {
    const confirma = typeof SoloDialog !== 'undefined'
      ? await SoloDialog.confirm(`Cancelar a tarefa "<strong>${t.titulo}</strong>"?`, {
          titulo: 'Cancelar Tarefa', icon: '⏸️', tipo: 'warn',
          btnOk: 'Sim, Cancelar', btnCancel: 'Voltar',
        })
      : confirm(`Cancelar "${t.titulo}"?`);
    if (!confirma) return;
    try {
      const resp = await API.post(`/tarefas/${t.id}/cancelar`, {});
      this._aplicarCard(t.id, resp);
    } catch (err) {
      if (typeof SoloDialog !== 'undefined')
        SoloDialog.toast('Erro ao cancelar: ' + (err.message || err), 'error');
    }
  },

  async extinguir(t) {
    const confirma = typeof SoloDialog !== 'undefined'
      ? await SoloDialog.confirm(
          `Esta ação remove a tarefa <strong style="color:#f87171">${t.titulo}</strong>
           <strong>COMPLETAMENTE</strong> e reverte todos os saldos.<br><br>
           <strong style="color:#f87171">⚠️ Esta ação é irreversível!</strong>`,
          { titulo: '⚡ EXTINGUIR TAREFA', icon: '⚡', tipo: 'danger',
            btnOk: 'Extinguir', btnCancel: 'Cancelar' }
        )
      : confirm(`EXTINGUIR "${t.titulo}"? Irreversível!`);
    if (!confirma) return;
    try {
      await API.delete(`/tarefas/${t.id}?extinguir=true`);
      delete this._statusCache[t.id];
      this._lista = this._lista.filter(x => x.id !== t.id);
      this.renderLista(this._ordenarLista(this._lista));
      if (typeof SoloDialog !== 'undefined')
        SoloDialog.toast('Tarefa extinta e saldos revertidos.', 'success');
    } catch (err) {
      if (typeof SoloDialog !== 'undefined')
        SoloDialog.toast('Erro ao extinguir: ' + (err.message || err), 'error');
    }
  },

  abrirFormulario(tarefa) {
    if (typeof Lancador !== 'undefined')
      Lancador.open('tarefa', tarefa, { data: this._dataAtual });
  },

  confirmarExcluir(t) {
    const doit = async () => {
      try {
        await API.delete(`/tarefas/${t.id}`);
        delete this._statusCache[t.id];
        this._lista = this._lista.filter(x => x.id !== t.id);
        this.renderLista(this._ordenarLista(this._lista));
        if (typeof SoloDialog !== 'undefined') SoloDialog.toast('Tarefa excluída.', 'success');
      } catch (err) { console.error('[Tarefas] Erro ao excluir:', err); }
    };
    if (typeof SoloDialog !== 'undefined') {
      SoloDialog.confirm(
        `Excluir a tarefa "<strong>${t.titulo}</strong>"?<br><span style="color:#94a3b8">Esta ação é irreversível.</span>`,
        { titulo: 'Excluir Tarefa', icon: '🗑️', tipo: 'error', btnOk: 'Excluir', btnCancel: 'Cancelar' }
      ).then(ok => { if (ok) doit(); });
    } else if (confirm(`Excluir "${t.titulo}"?`)) { doit(); }
  },

  _bindBotaoNova() {
    ['btn-nova-tarefa','btn-add-tarefa'].forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      const novo = btn.cloneNode(true);
      btn.replaceWith(novo);
      novo.addEventListener('click', () => this.abrirFormulario());
    });
  },

  // ── Timer ao vivo ─────────────────────────────────────────
  _iniciarContadores() {
    if (this._timerInterval) clearInterval(this._timerInterval);
    this._timerInterval = setInterval(() => {
      document.querySelectorAll('.tarefa-countdown-val').forEach(el => {
        const tid  = parseInt(el.dataset.tid);
        const t    = this._lista.find(x => x.id === tid);
        if (!t) return;
        const status = this._statusCache[tid] || t.status || 'PENDENTE';
        if (['CONCLUIDA','CANCELADA','FRACASSADA'].includes(status)) return;
        const segs = this._calcSegundosRestantes(t);
        el.textContent = this._formatarCountdown(segs);
        el.style.color = segs < 0 ? '#f87171' : '#e2e8f0';
        const label = el.previousElementSibling;
        if (label) label.style.color = segs < 0 ? '#f87171' : 'var(--text-muted)';
      });
    }, 1000);
  },

  // ── Ordenação UI ──────────────────────────────────────────
  _bindOrdenacao() {
    const btns = document.querySelectorAll('[data-ordem-tarefa]');
    btns.forEach(btn => {
      btn.style.background = this._ordem === btn.dataset.ordemTarefa
        ? 'rgba(124,58,237,.25)' : 'rgba(124,58,237,.08)';
      btn.addEventListener('click', () => {
        this._ordem = btn.dataset.ordemTarefa;
        localStorage.setItem('sr_tarefas_ordem', this._ordem);
        btns.forEach(b => b.style.background = 'rgba(124,58,237,.08)');
        btn.style.background = 'rgba(124,58,237,.25)';
        this.renderLista(this._ordenarLista(this._lista));
      });
    });
  },

  // ── Cálculo de prazo ─────────────────────────────────────
  _calcSegundosRestantes(t) {
    const agora = new Date();
    if (t.hora_limite) {
      const [hh, mm] = t.hora_limite.split(':').map(Number);
      const prazo = new Date(agora); prazo.setHours(hh, mm, 0, 0);
      return Math.floor((prazo - agora) / 1000);
    }
    const d = t.data_prevista || t.data_vencimento;
    if (d) {
      const prazo = new Date(d.split('T')[0] + 'T23:59:59');
      return Math.floor((prazo - agora) / 1000);
    }
    const fim = new Date(agora); fim.setHours(23, 59, 59);
    return Math.floor((fim - agora) / 1000);
  },

  _formatarCountdown(segs) {
    const abs = Math.abs(segs);
    const d = Math.floor(abs / 86400);
    const h = Math.floor((abs % 86400) / 3600);
    const m = Math.floor((abs % 3600) / 60);
    const s = abs % 60;
    const neg = segs < 0 ? '-' : '';
    if (d > 0) return `${neg}${d}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m`;
    return `${neg}${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
  },

  // ── Helpers de data ───────────────────────────────────────
  _fmtDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },
  _fmtDateDisplay(str) {
    if (!str) return '';
    const p = str.split('T')[0].split('-');
    return `${p[2]}/${p[1]}/${p[0]}`;
  },
};