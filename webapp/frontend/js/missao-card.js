/* ============================================================
   missao-card.js — Cartão de Missão (componente de produção)

   Uso na lista:
     container.innerHTML = missoes.map(m => MissaoCard.html(m)).join('');
     MissaoCard.montar(container, { onMudou: () => Dashboard.carregar() });

   - Estados vêm do backend (status_hoje); nada é inventado no cliente
   - Ações chamam a API real (iniciar/pausar/retomar/cancelar/concluir)
   - Delegação de eventos: um listener por container, não por cartão
   - Timer único para todos os cartões (um rAF/1s global)
   Requer: css/missao-card.css
   ============================================================ */

const MissaoCard = {

  /* ── Tabelas ───────────────────────────────────────────────
     REGRA DE COR: quem comanda o cartão é a PRIORIDADE (urgência),
     mantendo a convenção que o app já usa nas listas.
     A DIFICULDADE vira o selo de rank (ela multiplica o XP).      */
  PRIORIDADES: {
    CRITICA: { cor: '#ef4444', rotulo: 'Crítica' },
    ALTA:    { cor: '#f97316', rotulo: 'Alta'    },
    MEDIA:   { cor: '#f59e0b', rotulo: 'Média'   },
    BAIXA:   { cor: '#10b981', rotulo: 'Baixa'   },
  },
  RANKS: {   // dificuldade -> selo de rank (multiplicador de XP)
    FACIL:    { letra: 'C', mult: '×0.5' },
    NORMAL:   { letra: 'B', mult: '×1'   },
    DIFICIL:  { letra: 'A', mult: '×1.5' },
    LENDARIO: { letra: 'S', mult: '×2.5' },
  },
  STATUS: {
    PENDENTE:   { rotulo: '⏳ Pendente',   classe: 'st-pendente'   },
    ATIVA:      { rotulo: '▶ Em curso',    classe: 'st-ativa'      },
    PAUSADA:    { rotulo: '⏸ Pausada',     classe: 'st-pausada'    },
    CONCLUIDA:  { rotulo: '✓ Concluída',   classe: 'st-concluida'  },
    FRACASSADA: { rotulo: '☠ Fracassada',  classe: 'st-fracassada' },
    CANCELADA:  { rotulo: '✕ Cancelada',   classe: 'st-cancelada'  },
  },
  CAT_ICO: {
    'Saúde': '❤️', 'Saude': '❤️', 'Trabalho': '💼', 'Estudo': '📚',
    'Casa': '🏠', 'Pessoal': '⚡', 'Combate': '⚔️',
  },

  /* ── Sigilo (ícone cinético em SVG) ────────────────────── */
  _sigilo(cor, icone) {
    return `
      <div class="mc-sigilo">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <g class="mc-sigilo-anel">
            <circle cx="50" cy="50" r="34" fill="none" stroke="${cor}" stroke-opacity=".45"
                    stroke-width="2" stroke-dasharray="9 7"/>
          </g>
          <polygon points="50,26 62,50 50,74 38,50" fill="${cor}" fill-opacity=".18"
                   stroke="${cor}" stroke-opacity=".7" stroke-width="1.5"/>
          <g class="mc-sigilo-arco">
            <circle cx="50" cy="50" r="42" fill="none" stroke="${cor}" stroke-opacity=".85"
                    stroke-width="2" stroke-dasharray="22 242" stroke-linecap="round"/>
          </g>
        </svg>
        <span class="mc-sigilo-ico">${icone}</span>
      </div>`;
  },

  /* ── Prazo: devolve {texto, classe, pct} ───────────────── */
  _prazo(m) {
    const fim = m.hora_fim || m.hora_limite;
    if (!fim) return null;
    const [h, mi] = fim.split(':').map(Number);
    const alvo = new Date(); alvo.setHours(h, mi, 0, 0);
    const ini = (() => {
      if (!m.hora_inicio) return null;
      const [hi, mii] = m.hora_inicio.split(':').map(Number);
      const d = new Date(); d.setHours(hi, mii, 0, 0); return d;
    })();

    let seg = Math.floor((alvo - Date.now()) / 1000);
    if (seg <= 0) return { texto: 'Prazo vencido', classe: 'vencido', pct: 100 };

    const hh = Math.floor(seg / 3600), mm = Math.floor((seg % 3600) / 60), ss = seg % 60;
    const texto = hh > 0 ? `${hh}h ${String(mm).padStart(2,'0')}m ${String(ss).padStart(2,'0')}s`
                         : `${mm}m ${String(ss).padStart(2,'0')}s`;
    // % da janela já decorrida (se houver hora de início)
    let pct = 0;
    if (ini && alvo > ini) pct = Math.min(100, Math.max(0, (Date.now() - ini) / (alvo - ini) * 100));
    return { texto, classe: seg < 1800 ? 'urgente' : '', pct };
  },

  /* O Arquiteto vê poderes que os demais hunters não têm */
  _ehArquiteto() {
    try { return window.Auth?.getUsuario?.()?.nivel_acesso === 'Arquiteto'; }
    catch (_) { return false; }
  },

  /* ── Ações conforme o estado (máquina de estados) ──────── */
  _acoes(status, id) {
    const b = (acao, cls, rot, extra = '') =>
      `<button class="mc-btn ${cls}" data-mc-acao="${acao}" data-mc-id="${id}" ${extra}>${rot}</button>`;

    // Extinguir: exclusivo do Arquiteto — apaga a missão e estorna
    // todo o XP/moedas que ela já concedeu. Sempre disponível.
    const extinguir = this._ehArquiteto()
      ? b('extinguir', 'mc-btn-extinguir', '⟁',
          'title="Extinguir (Arquiteto) — apaga a missão e estorna todo o XP que ela já deu"')
      : '';

    let acoes;
    switch (status) {
      case 'PENDENTE':
        acoes = b('iniciar', 'mc-btn-iniciar', '▶ Iniciar Missão') +
                b('cancelar', 'mc-btn-neutro', '✕', 'title="Cancelar hoje"');
        break;
      case 'ATIVA':
        acoes = b('pausar', 'mc-btn-neutro', '⏸ Pausar') +
                b('cancelar', 'mc-btn-perigo', '✕ Cancelar hoje') +
                b('concluir', 'mc-btn-concluir', '✓ Concluir');
        break;
      case 'PAUSADA':
        acoes = b('retomar', 'mc-btn-iniciar', '▶ Retomar') +
                b('cancelar', 'mc-btn-perigo', '✕ Cancelar hoje') +
                b('concluir', 'mc-btn-concluir', '✓ Concluir');
        break;
      case 'CONCLUIDA':
        acoes = `<span class="mc-selo mc-selo-ok">✓ Missão cumprida</span>`;
        break;
      case 'FRACASSADA':
        acoes = `<span class="mc-selo mc-selo-falha">☠ Prazo perdido</span>`;
        break;
      case 'CANCELADA':
        acoes = `<span class="mc-selo mc-selo-neutro">✕ Cancelada hoje</span>` +
                b('retomar', 'mc-btn-neutro', '↺ Retomar');
        break;
      default:
        acoes = '';
    }
    return acoes + extinguir;
  },

  /* ── HTML de um cartão ─────────────────────────────────── */
  html(m) {
    const status = m.status_hoje || m.status || 'PENDENTE';
    const st     = this.STATUS[status] || this.STATUS.PENDENTE;
    const prior  = this.PRIORIDADES[(m.prioridade || 'MEDIA').toUpperCase()] || this.PRIORIDADES.MEDIA;
    const rank   = this.RANKS[(m.dificuldade || 'NORMAL').toUpperCase()] || this.RANKS.NORMAL;
    const icone  = m.icone || this.CAT_ICO[m.categoria] || '⚔️';
    const prazo  = this._prazo(m);
    const id     = m.id;
    const cor    = prior.cor;                      // ← a prioridade comanda

    const alpha = (hex, a) => {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
    };

    return `
    <div class="mc ${st.classe}" data-mc-card="${id}"
         style="--mc-cor:${cor};--mc-cor-suave:${alpha(cor, .14)}">
      <div class="mc-fio"></div>
      ${this._sigilo(cor, icone)}
      <div class="mc-corpo">
        <div class="mc-topo">
          <div class="mc-titulo" title="${(m.titulo || '').replace(/"/g,'&quot;')}">${m.titulo || 'Missão'}</div>
          ${prazo ? `<div class="mc-prazo ${prazo.classe}" data-mc-prazo="${id}">
            <span class="lbl">⏳ Prazo</span> <span data-mc-timer>${prazo.texto}</span>
          </div>` : ''}
        </div>

        <div class="mc-chips">
          <span class="mc-chip mc-chip-prior">◆ ${prior.rotulo}</span>
          <span class="mc-chip mc-chip-rank" title="Dificuldade ${(m.dificuldade || 'NORMAL').toLowerCase()} — XP ${rank.mult}">✦ ${rank.letra}-Rank</span>
          <span class="mc-chip mc-chip-status">${st.rotulo}</span>
          ${m.categoria ? `<span class="mc-chip mc-chip-cat">${this.CAT_ICO[m.categoria] || ''} ${m.categoria}</span>` : ''}
          <span class="mc-div"></span>
          <span class="mc-premio">⚡ ${m.xp_recompensa || 0} XP
            ${m.moedas_recompensa ? `<span class="moeda">· 🪙 ${m.moedas_recompensa}</span>` : ''}</span>
        </div>

        ${prazo ? `<div class="mc-barra"><div class="mc-barra-fill" data-mc-barra="${id}"
                     style="width:${prazo.pct}%"></div></div>` : ''}

        <div class="mc-acoes">${this._acoes(status, id)}</div>
      </div>
    </div>`;
  },

  /* ── Montagem: delegação de eventos + timer único ──────── */
  montar(container, opts = {}) {
    if (!container) return;
    this._onMudou = opts.onMudou || null;
    this._demo    = !!opts.demo;

    if (!container.dataset.mcBound) {
      container.dataset.mcBound = '1';
      container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-mc-acao]');
        if (!btn) return;
        e.preventDefault();
        this._executar(btn.dataset.mcAcao, parseInt(btn.dataset.mcId), btn);
      });
    }
    this._iniciarTimer();
  },

  /* Um único intervalo atualiza TODOS os prazos da tela */
  _iniciarTimer() {
    if (this._timer) return;
    this._timer = setInterval(() => {
      const alvos = document.querySelectorAll('[data-mc-prazo]');
      if (!alvos.length) { clearInterval(this._timer); this._timer = null; return; }
      alvos.forEach(el => {
        const m = this._cache?.[el.dataset.mcPrazo];
        if (!m) return;
        const p = this._prazo(m);
        if (!p) return;
        el.querySelector('[data-mc-timer]').textContent = p.texto;
        el.classList.toggle('urgente', p.classe === 'urgente');
        el.classList.toggle('vencido', p.classe === 'vencido');
        const barra = document.querySelector(`[data-mc-barra="${el.dataset.mcPrazo}"]`);
        if (barra) barra.style.width = p.pct + '%';
      });
    }, 1000);
  },

  /* Guarda os dados para o timer (chame ao renderizar a lista) */
  cachear(missoes) {
    this._cache = {};
    (missoes || []).forEach(m => { this._cache[m.id] = m; });
  },

  /* ── Execução das ações contra a API real ──────────────── */
  async _executar(acao, id, btn) {
    // Extinguir é irreversível: confirma ANTES de qualquer coisa
    if (acao === 'extinguir') return this._extinguir(id);
    if (this._demo) return this._demoTransicao(acao, id);
    const card = document.querySelector(`[data-mc-card="${id}"]`);
    btn.disabled = true;
    try {
      let resp;
      switch (acao) {
        case 'iniciar':  resp = await API.post(`/rotinas/${id}/iniciar`, {});  break;
        case 'pausar':   resp = await API.post(`/rotinas/${id}/pausar`, {});   break;
        case 'retomar':  resp = await API.post(`/rotinas/${id}/retomar`, {});  break;
        case 'cancelar': resp = await API.post(`/rotinas/${id}/cancelar`, {}); break;
        case 'concluir':
          resp = await API.execucoes.concluirRotina(id);
          if (typeof missionComplete === 'function' && card) {
            missionComplete(card, resp?.xp_ganho || 0, resp?.moedas_ganhas || 0);
          }
          break;
      }
      if (this._onMudou) await this._onMudou(resp, acao, id);
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
      btn.disabled = false;
    }
  },

  /* ── Extinguir (Arquiteto): apaga a missão e estorna o XP ── */
  async _extinguir(id) {
    const m = this._cache?.[id] || {};
    const ok = await SoloDialog.confirm(
      `Extinguir <b>"${m.titulo || 'esta missão'}"</b> da existência?<br><br>` +
      `<span style="color:#f87171">Isto apaga a missão, todo o seu histórico e ` +
      `<b>estorna o XP e as moedas</b> que ela já concedeu.</span><br>` +
      `<span style="color:#94a3b8;font-size:.8rem">Poder exclusivo do Arquiteto · irreversível</span>`,
      { titulo: 'Extinguir Missão', tipo: 'error', icon: '⟁',
        btnOk: 'Extinguir', btnCancel: 'Manter' }
    );
    if (!ok) return;

    const card = document.querySelector(`[data-mc-card="${id}"]`);
    try {
      if (!this._demo) await API.delete(`/rotinas/${id}?extinguir=true`);
      // Dissolução: o cartão se desfaz antes de sumir
      if (card) {
        card.classList.add('mc-extinguindo');
        if (typeof SFX !== 'undefined') SFX.play('carimbo');
        setTimeout(() => card.remove(), 700);
      }
      delete this._cache?.[id];
      SoloDialog?.toast?.('⟁ Missão extinta — XP estornado', 'info');
      if (!this._demo && this._onMudou) setTimeout(() => this._onMudou(null, 'extinguir', id), 750);
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
    }
  },

  /* Modo demonstração (Forja): transita o estado sem tocar a API */
  _demoTransicao(acao, id) {
    const proximo = {
      iniciar: 'ATIVA', retomar: 'ATIVA', pausar: 'PAUSADA',
      cancelar: 'CANCELADA', concluir: 'CONCLUIDA',
    }[acao];
    const m = this._cache?.[id];
    if (!m || !proximo) return;
    m.status_hoje = proximo;
    const card = document.querySelector(`[data-mc-card="${id}"]`);
    if (card) {
      card.outerHTML = this.html(m);
      if (acao === 'concluir' && typeof createSparks === 'function') {
        const novo = document.querySelector(`[data-mc-card="${id}"]`);
        const r = novo?.getBoundingClientRect();
        if (r) createSparks(r.right - 80, r.top + r.height / 2, 12);
        if (typeof SFX !== 'undefined') SFX.play('carimbo');
      }
    }
  },
};

window.MissaoCard = MissaoCard;
