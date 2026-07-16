/* ============================================================
   rotinas.js — Solo Routines
   Ciclo de vida completo: PENDENTE → ATIVA → CONCLUIDA | FRACASSADA | CANCELADA
   Status por dia vem do backend (ExecucaoDia). SessionStorage é só otimismo.
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
    await this.carregarPorTipo(this._tipoAtivo);
    this._bindTabs();
    this._bindBotaoNova();
    this._bindOrdenacao();
    this._iniciarAutoCheck(); // timer de auto-start e auto-fracassar
  },

  // ── Cache de ordem ─────────────────────────────────────────
  _carregarOrdem() {
    this._ordem = localStorage.getItem('sr_rotinas_ordem') || 'PRIORIDADE';
  },
  _salvarOrdem(o) {
    this._ordem = o;
    try { localStorage.setItem('sr_rotinas_ordem', o); } catch (_) {}
  },

  // ── Para contadores ao sair ────────────────────────────────
  destruir() {
    if (this._timerInterval)    { clearInterval(this._timerInterval);    this._timerInterval    = null; }
    if (this._autoCheckInterval){ clearInterval(this._autoCheckInterval); this._autoCheckInterval = null; }
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
    } catch (err) {
      console.error('[Rotinas]', err);
      cont.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><div>Erro ao carregar rotinas — ' + (err.message || '') + '</div></div>';
    }
  },

  // ── Render da lista ────────────────────────────────────────
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

    cont.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:.9rem">
        ${lista.map(r => this._buildCard(r)).join('')}
      </div>`;

    this._bindCardActions(cont);
    this._iniciarContadores();
  },

  // ── Build do card ──────────────────────────────────────────
  _buildCard(r) {
    const id     = r.id;
    const status = this._statusCache[id] || r.status_hoje || 'PENDENTE';
    const titulo = r.titulo || 'Sem título';
    const icone  = this._CAT_ICONS[r.categoria] || '⚔️';
    const prior  = this._PRIOR_CORES[r.prioridade] || this._PRIOR_CORES.MEDIA;
    const scfg   = this._STATUS_CFG[status] || this._STATUS_CFG.PENDENTE;
    const xp     = r.xp_recompensa     || 0;
    const moedas = r.moedas_recompensa || 0;
    const penal  = r.penalidade_xp     || 0;

    const isPendente   = status === 'PENDENTE';
    const isAtiva      = status === 'ATIVA';
    const isPausada    = status === 'PAUSADA';
    const isConcluida  = status === 'CONCLUIDA';
    const isCancelada  = status === 'CANCELADA';
    const isFracassada = status === 'FRACASSADA';
    const isFinal      = isConcluida || isFracassada || isCancelada;

    // Cor da borda usa prioridade em primeiro, depois status
    const bordaCor = isFinal || isPausada ? scfg.cor : prior.cor;
    const bgEfect  = isFinal || isPausada ? scfg.bg  : prior.bg;

    // Badge de status
    const statusBadge = `<span style="
      font-family:var(--font-section);font-size:.65rem;font-weight:700;letter-spacing:.1em;
      padding:.2rem .7rem;border-radius:100px;
      background:${scfg.bg};border:1px solid ${scfg.cor}88;color:${scfg.cor}">
      ${scfg.label}
    </span>`;

    // Janela de horário (badge info)
    const janelaHtml = r.hora_inicio || r.hora_fim ? `
      <span style="
        font-family:var(--font-section);font-size:.62rem;letter-spacing:.05em;
        padding:.15rem .55rem;border-radius:100px;
        background:rgba(6,182,212,.1);border:1px solid rgba(6,182,212,.3);color:var(--cyan-skill)">
        ⏰ ${r.hora_inicio || '?'}→${r.hora_fim || '?'}
      </span>` : '';

    // Countdown (para PENDENTE, ATIVA, PAUSADA)
    let countdownHtml = '';
    if (!isFinal) {
      const segs  = this._calcSegundosRestantes(r);
      const cdTxt = this._formatarCountdown(segs);
      const cdNeg = segs < 0;

      // Para PENDENTE com hora_inicio: mostra "Inicia às HH:MM"
      if (isPendente && r.hora_inicio && !cdNeg) {
        const agora = new Date();
        const [hI, mI] = r.hora_inicio.split(':').map(Number);
        const inicio = new Date(agora); inicio.setHours(hI, mI, 0, 0);
        const segsInicio = Math.floor((inicio - agora) / 1000);
        if (segsInicio > 0) {
          countdownHtml = `
            <div style="display:flex;align-items:center;gap:.4rem;font-family:var(--font-section)">
              <span style="font-size:.72rem;color:var(--cyan-skill)">🕐 Auto-inicia às ${r.hora_inicio}</span>
              <span class="rotina-countdown-inicio" data-rid="${id}" data-hora="${r.hora_inicio}"
                style="font-size:.75rem;font-weight:700;color:var(--cyan-skill)">
                ${this._fmtSegs(segsInicio)}
              </span>
            </div>`;
        }
      }

      if (!countdownHtml) {
        countdownHtml = `
          <div style="display:flex;align-items:center;gap:.4rem;font-family:var(--font-section)">
            <span style="font-size:.72rem;color:${cdNeg ? '#f87171' : 'var(--text-muted)'}">
              ${cdNeg ? '⚠️ VENCIDO' : (isPendente ? '⌛ Prazo' : '⏱')}
            </span>
            <span class="rotina-countdown-val" data-rid="${id}" style="
              font-size:.78rem;font-weight:700;
              color:${cdNeg ? '#f87171' : '#e2e8f0'};
              ${cdNeg ? 'animation:glowPulse 1s infinite' : ''}
            ">${cdTxt}</span>
          </div>`;
      }
    }

    // Botões de ação por status
    const btnStyle = (cor, bg, borda) => `
      font-family:var(--font-section);font-size:.72rem;font-weight:700;letter-spacing:.06em;
      padding:.35rem .9rem;border-radius:.5rem;cursor:pointer;
      border:1px solid ${borda || cor + '88'};
      background:${bg};color:${cor};transition:all .2s`;

    let acoesHtml = '';
    if (isPendente) {
      acoesHtml = `
        <button data-action="iniciar" data-id="${id}" style="${btnStyle('#a855f7','rgba(168,85,247,.18)','#a855f7')}">
          ▶ Iniciar Missão
        </button>`;
    } else if (isAtiva) {
      acoesHtml = `
        <button data-action="concluir" data-id="${id}" style="${btnStyle('#10b981','rgba(16,185,129,.15)')}">
          ✓ Concluir
        </button>
        <button data-action="pausar" data-id="${id}" style="${btnStyle('#64748b','rgba(100,116,139,.1)')}">
          ⏸ Pausar
        </button>
        <button data-action="cancelar" data-id="${id}" style="${btnStyle('#f87171','rgba(239,68,68,.06)','rgba(239,68,68,.4)')}">
          ✕ Cancelar
        </button>`;
    } else if (isPausada) {
      acoesHtml = `
        <button data-action="retomar" data-id="${id}" style="${btnStyle('var(--purple-glow)','rgba(124,58,237,.15)','var(--purple-main)')}">
          ▶ Retomar
        </button>
        <button data-action="cancelar" data-id="${id}" style="${btnStyle('#f87171','rgba(239,68,68,.06)','rgba(239,68,68,.4)')}">
          ✕ Cancelar
        </button>`;
    } else if (isCancelada) {
      acoesHtml = `
        <button data-action="retomar" data-id="${id}" style="${btnStyle('var(--purple-glow)','rgba(124,58,237,.12)','var(--purple-main)')}">
          ▶ Retomar
        </button>`;
    }

    // Arquiteto: extinguir sempre disponível (exceto já extinto)
    const extBtn = this._isArquiteto ? `
      <button data-action="extinguir" data-id="${id}" title="Extinguir (reverte saldos)" style="
        font-family:var(--font-section);font-size:.65rem;padding:.22rem .55rem;border-radius:.4rem;
        cursor:pointer;border:1px solid rgba(239,68,68,.4);background:rgba(239,68,68,.06);
        color:#f87171;transition:all .2s">
        ⚡ Extinguir
      </button>` : '';

    // Bloco de recompensas/punição
    const recompHtml = `
      <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
        <span style="font-family:var(--font-section);font-size:.7rem;color:var(--gold-xp);font-weight:700">
          ⚡ ${isConcluida ? (r.xp_ganho_hoje || xp) : xp} XP
        </span>
        <span style="color:var(--text-muted);font-size:.65rem">•</span>
        <span style="font-family:var(--font-section);font-size:.7rem;color:#fbbf24;font-weight:700">
          🪙 ${isConcluida ? (r.moedas_hoje || moedas) : moedas}
        </span>
        ${penal > 0 && !isConcluida ? `
        <span style="color:var(--text-muted);font-size:.65rem">•</span>
        <span style="font-family:var(--font-section);font-size:.7rem;color:#f87171;font-weight:700">
          💀 -${isFracassada ? (r.xp_perdido_hoje || penal) : penal} XP
        </span>` : ''}
        ${isFracassada && r.xp_perdido_hoje ? `
        <span style="
          font-family:var(--font-section);font-size:.65rem;padding:.15rem .5rem;border-radius:.3rem;
          background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);color:#f87171">
          Penalidade aplicada
        </span>` : ''}
      </div>`;

    // Dias da semana (SEMANAL)
    let diasHtml = '';
    if (r.tipo === 'SEMANAL' && r.dias_semana?.length) {
      const nomes = ['D','S','T','Q','Q','S','S'];
      diasHtml = `<div style="display:flex;gap:.3rem;margin-top:.4rem">
        ${nomes.map((d, i) => `<div style="
          width:22px;height:22px;border-radius:50%;display:flex;align-items:center;
          justify-content:center;font-size:.6rem;font-weight:700;font-family:var(--font-section);
          ${r.dias_semana.includes(i)
            ? 'background:var(--purple-main);color:#fff;border:1px solid var(--purple-glow)'
            : 'background:rgba(100,116,139,.15);color:var(--text-muted);border:1px solid rgba(100,116,139,.2)'}
        ">${d}</div>`).join('')}
      </div>`;
    }

    // Card clicável para detalhes se concluída ou fracassada
    const clickable = (isConcluida || isFracassada) ? 'cursor:pointer' : '';

    return `
      <div class="rotina-card-rich" data-id="${id}" data-status="${status}" style="
        background:var(--bg-card);
        border:1px solid ${bordaCor}55;border-left:3px solid ${bordaCor};
        border-radius:.9rem;padding:1rem 1.2rem;position:relative;overflow:hidden;
        transition:all .25s;${clickable}
        background:linear-gradient(135deg,${bgEfect},var(--bg-card));
        ${isConcluida  ? 'box-shadow:0 0 16px rgba(16,185,129,.15)' : ''}
        ${isFracassada ? 'box-shadow:0 0 16px rgba(239,68,68,.12)' : ''}
        ${isCancelada  ? 'opacity:.6' : ''}
      ">
        <!-- Barra lateral de prioridade -->
        <div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:${bordaCor};border-radius:2px 0 0 2px"></div>

        <!-- Topo: ícone + título + badges -->
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.8rem">
          <div style="display:flex;align-items:center;gap:.75rem;flex:1;min-width:0">
            <div style="
              width:40px;height:40px;border-radius:.6rem;flex-shrink:0;
              display:flex;align-items:center;justify-content:center;font-size:1.3rem;
              background:${prior.bg};border:1px solid ${prior.cor}44
              ${isFracassada ? ';filter:grayscale(.6)' : ''}
            ">${icone}</div>
            <div style="min-width:0">
              <div style="
                font-family:var(--font-section);font-size:.95rem;font-weight:700;
                color:${isFracassada ? '#f87171' : 'var(--text-primary)'};
                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:.2rem
                ${isFracassada ? ';text-decoration:line-through;text-decoration-color:#f8717155' : ''}
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
          <!-- Countdown + botão editar -->
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

        ${diasHtml}

        <!-- Descrição -->
        ${r.descricao ? `
          <div style="font-size:.78rem;color:var(--text-muted);margin-top:.55rem;line-height:1.5;
            border-left:2px solid rgba(124,58,237,.25);padding-left:.6rem">
            ${r.descricao}
          </div>` : ''}

        <!-- Fracassada: mensagem de falha -->
        ${isFracassada ? `
          <div style="
            margin-top:.65rem;padding:.5rem .75rem;border-radius:.5rem;
            background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);
            font-family:var(--font-section);font-size:.72rem;color:#f87171;letter-spacing:.04em">
            ☠️ Prazo encerrado — missão fracassada.
            ${r.fracassada_em ? `<span style="color:#94a3b8;font-size:.65rem">
              (${new Date(r.fracassada_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})})
            </span>` : ''}
            ${r.tipo !== 'AVULSA' ? `<span style="color:#a855f7"> · Retorna ${r.tipo === 'DIARIA' ? 'amanhã' : 'na próxima ocorrência'}</span>` : ''}
          </div>` : ''}

        <!-- Rodapé: recompensas + botões -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:.75rem;flex-wrap:wrap;gap:.5rem">
          ${recompHtml}
          <div style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap">
            ${acoesHtml}
            ${extBtn}
            <button data-action="excluir" data-id="${id}" title="Excluir" style="
              background:none;border:none;color:rgba(100,116,139,.5);font-size:.8rem;cursor:pointer;
              padding:.2rem;border-radius:.3rem;transition:.2s"
              onmouseover="this.style.color='#f87171'"
              onmouseout="this.style.color='rgba(100,116,139,.5)'">🗑</button>
          </div>
        </div>
      </div>`;
  },

  // ── Bind ações dos cards (event delegation com dedup) ────────────────
  _bindCardActions(cont) {
    // Remove listener anterior para evitar duplicatas em troca de aba
    if (this._contClickHandler) {
      cont.removeEventListener('click', this._contClickHandler);
    }
    this._contClickHandler = async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) {
        // Clique no card (concluída/fracassada) → abre modal
        const card = e.target.closest('.rotina-card-rich');
        if (card) {
          const status = card.dataset.status;
          if (status === 'CONCLUIDA' || status === 'FRACASSADA') {
            const r = this._lista.find(x => x.id == card.dataset.id);
            if (r) this._abrirModalDetalhes(r, status);
          }
        }
        return;
      }

      const action = btn.dataset.action;
      const id     = parseInt(btn.dataset.id);
      const r      = this._lista.find(x => x.id === id);
      if (!r) return;

      switch (action) {
        case 'iniciar':   await this.iniciar(r, btn);    break;
        case 'concluir':  await this.concluir(r, btn);   break;
        case 'pausar':    await this.pausar(r);           break;
        case 'retomar':   await this.retomar(r);          break;
        case 'cancelar':  await this.cancelar(r);         break;
        case 'extinguir': await this.extinguir(r);        break;
        case 'excluir':   await this.confirmarExcluir(r); break;
        case 'editar':    this.abrirFormulario(r);        break;
      }
    };
    cont.addEventListener('click', this._contClickHandler);
  },

  // ── Contadores em tempo real ───────────────────────────────
  _iniciarContadores() {
    if (this._timerInterval) clearInterval(this._timerInterval);
    this._timerInterval = setInterval(() => {
      document.querySelectorAll('.rotina-countdown-val').forEach(el => {
        const rid  = parseInt(el.dataset.rid);
        const r    = this._lista.find(x => x.id === rid);
        if (!r) return;
        const status = this._statusCache[rid] || 'PENDENTE';
        if (status === 'CONCLUIDA' || status === 'FRACASSADA' || status === 'CANCELADA') return;
        const segs  = this._calcSegundosRestantes(r);
        el.textContent = this._formatarCountdown(segs);
        el.style.color = segs < 0 ? '#f87171' : '#e2e8f0';
      });
      // Countdown até auto-start (hora_inicio)
      document.querySelectorAll('.rotina-countdown-inicio').forEach(el => {
        const rid  = parseInt(el.dataset.rid);
        const hora = el.dataset.hora;
        const [hh, mm] = hora.split(':').map(Number);
        const agora = new Date();
        const target = new Date(agora); target.setHours(hh, mm, 0, 0);
        const segs = Math.floor((target - agora) / 1000);
        if (segs <= 0) {
          el.closest('.rotina-card-rich')?.remove();
        } else {
          el.textContent = this._fmtSegs(segs);
        }
      });
    }, 1000);
  },

  // ── Auto-check: auto-start e auto-fracassar ────────────────
  _iniciarAutoCheck() {
    if (this._autoCheckInterval) clearInterval(this._autoCheckInterval);
    this._autoCheckInterval = setInterval(() => this._verificarAutoAcoes(), 30000);
    // Roda imediatamente ao carregar também
    setTimeout(() => this._verificarAutoAcoes(), 1000);
  },

  async _verificarAutoAcoes() {
    const agora = new Date();
    for (const r of this._lista) {
      const status = this._statusCache[r.id] || r.status_hoje || 'PENDENTE';
      if (status === 'CONCLUIDA' || status === 'FRACASSADA' || status === 'CANCELADA') continue;

      // Auto-START: hora_inicio chegou e missão ainda PENDENTE
      if (status === 'PENDENTE' && r.hora_inicio) {
        const [hI, mI] = r.hora_inicio.split(':').map(Number);
        const inicio = new Date(agora); inicio.setHours(hI, mI, 0, 0);
        if (agora >= inicio) {
          console.log(`[AutoStart] Iniciando rotina ${r.id}: ${r.titulo}`);
          await this._executarIniciar(r.id);
        }
      }

      // Auto-FRACASSAR: prazo venceu e missão ainda ATIVA ou PENDENTE
      if (status === 'ATIVA' || status === 'PENDENTE') {
        const segs = this._calcSegundosRestantes(r);
        if (segs <= 0) {
          console.log(`[AutoFail] Fracassando rotina ${r.id}: ${r.titulo}`);
          await this._executarFracassar(r.id);
        }
      }
    }
  },

  // ── Helpers de cálculo de prazo ───────────────────────────
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

  _formatarCountdown(segs) {
    const abs = Math.abs(segs);
    const d   = Math.floor(abs / 86400);
    const h   = Math.floor((abs % 86400) / 3600);
    const m   = Math.floor((abs % 3600) / 60);
    const s   = abs % 60;
    const neg = segs < 0 ? '-' : '';
    if (d > 0) return `${neg}${d}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m`;
    return `${neg}${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
  },

  _fmtSegs(segs) {
    const h = Math.floor(segs / 3600);
    const m = Math.floor((segs % 3600) / 60);
    const s = segs % 60;
    if (h > 0) return `${h}h${String(m).padStart(2,'0')}m`;
    if (m > 0) return `${m}m${String(s).padStart(2,'0')}s`;
    return `${s}s`;
  },

  // ── Atualiza visual de um card sem re-render completo ──────
  _atualizarCardVisual(id, novoStatus) {
    this._statusCache[id] = novoStatus;
    const r = this._lista.find(x => x.id === id);
    if (!r) return;
    r.status_hoje = novoStatus;
    const card = document.querySelector(`.rotina-card-rich[data-id="${id}"]`);
    if (!card) return;
    card.outerHTML = this._buildCard(r);
    // Re-bind actions apenas para este card
    const cont = document.getElementById('lista-rotinas');
    if (cont) {
      // Não re-faz bind geral — o bind usa delegação, já está ativo
    }
  },

  // ── Recarrega um único card da API ─────────────────────────
  async _recarregarCard(id) {
    try {
      const resp = await API.get(`/rotinas/${id}`);
      const idx = this._lista.findIndex(x => x.id === id);
      if (idx !== -1) this._lista[idx] = resp;
      this._statusCache[id] = resp.status_hoje || 'PENDENTE';
      const card = document.querySelector(`.rotina-card-rich[data-id="${id}"]`);
      if (card) {
        const tmp = document.createElement('div');
        tmp.innerHTML = this._buildCard(resp);
        card.replaceWith(tmp.firstElementChild);
      }
    } catch (err) {
      console.warn('[Rotinas] _recarregarCard', err);
    }
  },

  // ── Executar chamadas de API para auto-ações ───────────────
  async _executarIniciar(id) {
    try {
      await API.post(`/rotinas/${id}/iniciar`, {});
      this._statusCache[id] = 'ATIVA';
      await this._recarregarCard(id);
    } catch (err) {
      if (!err.message?.includes('400')) console.warn('[AutoStart]', err);
    }
  },

  async _executarFracassar(id) {
    try {
      const resp = await API.post(`/rotinas/${id}/fracassar`, {});
      this._statusCache[id] = 'FRACASSADA';
      const idx = this._lista.findIndex(x => x.id === id);
      if (idx !== -1) Object.assign(this._lista[idx], resp);
      const card = document.querySelector(`.rotina-card-rich[data-id="${id}"]`);
      if (card && this._lista[idx]) {
        const tmp = document.createElement('div');
        tmp.innerHTML = this._buildCard(this._lista[idx]);
        card.replaceWith(tmp.firstElementChild);
        if (typeof SoloDialog !== 'undefined') {
          SoloDialog.toast(`☠️ Missão fracassada: ${this._lista[idx].titulo}`, 'error', 5000);
        }
      }
    } catch (err) {
      if (!err.message?.includes('400')) console.warn('[AutoFail]', err);
    }
  },

  // ── Ações do usuário ───────────────────────────────────────
  async iniciar(r, btn) {
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Iniciando...'; }
    try {
      const resp = await API.post(`/rotinas/${r.id}/iniciar`, {});
      this._statusCache[r.id] = 'ATIVA';
      const idx = this._lista.findIndex(x => x.id === r.id);
      if (idx !== -1) Object.assign(this._lista[idx], resp);
      await this._recarregarCard(r.id);
      if (typeof SoloDialog !== 'undefined')
        SoloDialog.toast(`▶ Missão iniciada: ${r.titulo}`, 'info');
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = '▶ Iniciar Missão'; }
      SoloDialog.toast('Erro ao iniciar: ' + (err.message || err), 'error');
    }
  },

  async concluir(r, btn) {
    const id = r.id;
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Salvando...'; }
    const hoje = new Date().toISOString().split('T')[0];
    try {
      const resultado = await API.post('/execucoes/rotina', { rotina_id: id, data_execucao: hoje });

      // Sincroniza Dashboard se disponível
      if (typeof Dashboard !== 'undefined' && Dashboard._statusCache) {
        Dashboard._statusCache[id] = 'CONCLUIDA';
      }

      this._statusCache[id] = 'CONCLUIDA';
      const exec = resultado?.resultado;
      if (exec) this._execCache[id] = exec;

      // Atualiza o item na lista
      const idx = this._lista.findIndex(x => x.id === id);
      if (idx !== -1) {
        this._lista[idx].status_hoje   = 'CONCLUIDA';
        this._lista[idx].concluida_hoje = true;
        this._lista[idx].xp_ganho_hoje = exec?.xp_ganho || r.xp_recompensa || 0;
        this._lista[idx].moedas_hoje   = exec?.moedas_ganhas || r.moedas_recompensa || 0;
      }

      const card = document.querySelector(`.rotina-card-rich[data-id="${id}"]`);
      if (card && idx !== -1) {
        const tmp = document.createElement('div');
        tmp.innerHTML = this._buildCard(this._lista[idx]);
        card.replaceWith(tmp.firstElementChild);
      }

      // Efeito XP
      const xpGanho = exec?.xp_ganho || r.xp_recompensa || 0;
      if (typeof mostrarXPFloat !== 'undefined') mostrarXPFloat(`+${xpGanho} XP`);
      if (typeof SoloDialog !== 'undefined')
        SoloDialog.toast(`✅ ${r.titulo} concluída! +${xpGanho} XP`, 'success');

    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = '✓ Concluir'; }
      if (err.message?.includes('já foi concluída')) {
        this._statusCache[id] = 'CONCLUIDA';
        await this._recarregarCard(id);
      } else {
        SoloDialog.toast('Erro ao concluir: ' + (err.message || err), 'error');
      }
    }
  },

  async pausar(r) {
    try { await API.post(`/rotinas/${r.id}/pausar`, {}); } catch (_) {}
    this._statusCache[r.id] = 'PAUSADA';
    const idx = this._lista.findIndex(x => x.id === r.id);
    if (idx !== -1) this._lista[idx].status_hoje = 'PAUSADA';
    await this._recarregarCard(r.id);
  },

  async cancelar(r) {
    const ok = await SoloDialog.confirm(`Cancelar a missão "<strong>${r.titulo}</strong>" hoje?`, {
      titulo: 'Cancelar Missão', icon: '⏸️', tipo: 'warn',
      btnOk: 'Sim, Cancelar', btnCancel: 'Voltar',
    });
    if (!ok) return;
    try {
      await API.post(`/rotinas/${r.id}/cancelar`, {});
      this._statusCache[r.id] = 'CANCELADA';
      const idx = this._lista.findIndex(x => x.id === r.id);
      if (idx !== -1) this._lista[idx].status_hoje = 'CANCELADA';
      await this._recarregarCard(r.id);
    } catch (err) {
      SoloDialog.toast('Erro ao cancelar: ' + (err.message || err), 'error');
    }
  },

  async retomar(r) {
    try {
      await API.post(`/rotinas/${r.id}/retomar`, {});
      this._statusCache[r.id] = 'ATIVA';
      const idx = this._lista.findIndex(x => x.id === r.id);
      if (idx !== -1) this._lista[idx].status_hoje = 'ATIVA';
      await this._recarregarCard(r.id);
    } catch (err) {
      SoloDialog.toast('Erro ao retomar: ' + (err.message || err), 'error');
    }
  },

  async extinguir(r) {
    const ok = await SoloDialog.confirm(
      `Esta ação remove a rotina <strong style="color:#f87171">${r.titulo}</strong> <strong>COMPLETAMENTE</strong> e reverte todos os saldos de XP e moedas ganhos com ela.<br><br><strong style="color:#f87171">⚠️ Esta ação é irreversível!</strong>`,
      { titulo: '⚡ EXTINGUIR ROTINA', icon: '⚡', tipo: 'danger', btnOk: 'Extinguir', btnCancel: 'Cancelar' }
    );
    if (!ok) return;
    try {
      await API.delete(`/rotinas/${r.id}?extinguir=true`);
      delete this._statusCache[r.id];
      delete this._execCache[r.id];
      this._lista = this._lista.filter(x => x.id !== r.id);
      this.renderLista(this._ordenarLista(this._lista));
      SoloDialog.toast('Rotina extinta e saldos revertidos.', 'success');
    } catch (err) {
      SoloDialog.toast('Erro ao extinguir: ' + (err.message || err), 'error');
    }
  },

  async confirmarExcluir(item) {
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

  // ── Modal de detalhes (card clicável) ─────────────────────
  _abrirModalDetalhes(r, status) {
    const scfg = this._STATUS_CFG[status] || this._STATUS_CFG.CONCLUIDA;
    const prior = this._PRIOR_CORES[r.prioridade] || this._PRIOR_CORES.MEDIA;
    const icone = this._CAT_ICONS[r.categoria] || '⚔️';

    let modal = document.getElementById('rotina-detalhe-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'rotina-detalhe-modal';
      modal.style.cssText = [
        'position:fixed','top:10%','left:50%','transform:translateX(-50%)',
        'width:min(520px,92vw)','z-index:9500',
        'background:rgba(10,10,20,.93)',
        'backdrop-filter:blur(28px)','-webkit-backdrop-filter:blur(28px)',
        `border:1px solid ${scfg.cor}44`,
        'border-radius:1.1rem',
        'box-shadow:0 20px 60px rgba(0,0,0,.7)',
        'display:none','overflow:hidden'
      ].join(';');
      document.body.appendChild(modal);
      if (typeof DragWindow !== 'undefined') new DragWindow(modal);
    }

    modal.style.borderColor = scfg.cor + '44';
    modal.innerHTML = `
      <div style="height:3px;background:linear-gradient(90deg,${scfg.cor},transparent)"></div>
      <div id="rotina-modal-header" style="
        display:flex;align-items:center;gap:.75rem;padding:.9rem 1.1rem;cursor:move;
        background:${scfg.bg};border-bottom:1px solid ${scfg.cor}33">
        <span style="font-size:1.4rem">${icone}</span>
        <div style="flex:1">
          <div style="font-family:var(--font-section);font-size:.95rem;font-weight:700;color:${scfg.cor}">
            ${scfg.label}
          </div>
          <div style="font-family:var(--font-section);font-size:.8rem;color:var(--text-primary);font-weight:600">
            ${r.titulo}
          </div>
        </div>
        <button onclick="document.getElementById('rotina-detalhe-modal').style.display='none'"
          style="background:none;border:none;color:var(--text-muted);font-size:1.3rem;cursor:pointer">×</button>
      </div>
      <div style="padding:1.1rem;display:flex;flex-direction:column;gap:.75rem">
        ${r.descricao ? `<div style="font-size:.83rem;color:var(--text-muted);line-height:1.6;
          border-left:2px solid ${scfg.cor}55;padding-left:.7rem">${r.descricao}</div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.65rem">
          <div style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.2);border-radius:.6rem;padding:.6rem;text-align:center">
            <div style="font-size:.62rem;color:var(--text-muted);font-family:var(--font-section);letter-spacing:.1em">XP ${status === 'FRACASSADA' ? 'PERDIDO' : 'GANHO'}</div>
            <div style="font-family:var(--font-section);font-weight:900;font-size:1.2rem;color:${status === 'FRACASSADA' ? '#f87171' : 'var(--gold-xp)'}">
              ${status === 'FRACASSADA' ? '-' + (r.xp_perdido_hoje || r.penalidade_xp || 0) : '+' + (r.xp_ganho_hoje || r.xp_recompensa || 0)}
            </div>
          </div>
          <div style="background:rgba(251,191,36,.06);border:1px solid rgba(251,191,36,.2);border-radius:.6rem;padding:.6rem;text-align:center">
            <div style="font-size:.62rem;color:var(--text-muted);font-family:var(--font-section);letter-spacing:.1em">MANA COINS</div>
            <div style="font-family:var(--font-section);font-weight:900;font-size:1.2rem;color:#fbbf24">
              ${status === 'FRACASSADA' ? '—' : '+' + (r.moedas_hoje || r.moedas_recompensa || 0)}
            </div>
          </div>
        </div>
        ${status === 'CONCLUIDA' && r.concluida_em ? `
          <div style="text-align:center;font-family:var(--font-section);font-size:.75rem;color:var(--text-muted)">
            Concluída às ${new Date(r.concluida_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
          </div>` : ''}
        ${status === 'FRACASSADA' && r.fracassada_em ? `
          <div style="text-align:center;font-family:var(--font-section);font-size:.75rem;color:#f87171">
            Fracassou às ${new Date(r.fracassada_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
          </div>` : ''}
        <div style="text-align:center;padding-top:.3rem">
          <button onclick="document.getElementById('rotina-detalhe-modal').style.display='none'"
            style="font-family:var(--font-section);font-size:.75rem;padding:.4rem 1.2rem;border-radius:.5rem;
              border:1px solid ${scfg.cor}55;background:${scfg.bg};color:${scfg.cor};cursor:pointer">
            Fechar
          </button>
        </div>
      </div>`;

    modal.style.display = 'block';
    if (typeof DragWindow !== 'undefined') {
      const dw = new DragWindow(modal);
      dw._bindHeader(modal.querySelector('#rotina-modal-header'));
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
    document.querySelectorAll('.rotina-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.rotina-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.carregarPorTipo(tab.dataset.tipo);
      });
    });
  },

  _bindBotaoNova() {
    document.getElementById('btn-nova-rotina')?.addEventListener('click', () => this.abrirFormulario());
  },

  _bindOrdenacao() {
    const sel = document.getElementById('rotinas-ordem');
    if (!sel) return;
    sel.value = this._ordem;
    sel.addEventListener('change', () => {
      this._salvarOrdem(sel.value);
      this.renderLista(this._ordenarLista(this._lista));
    });
  },

  abrirFormulario(item = null) {
    if (typeof Lancador !== 'undefined') Lancador.abrir('ROTINA', item || null);
  },

  async executar(item) { return this.concluir(item); },
};