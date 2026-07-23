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
  /* Glifos de categoria — SVG de linha (estilo profissional, sem emoji).
     Cada um é o miolo de um viewBox 0 0 24 24, traço = currentColor. */
  GLIFOS: {
    'saude':    '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    'trabalho': '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    'estudo':   '<path d="M12 7v13"/><path d="M3 18V5a1 1 0 0 1 1-1h4a4 4 0 0 1 4 4 4 4 0 0 1 4-4h4a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3H4a1 1 0 0 1-1-1z"/>',
    'casa':     '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 21V12h6v9"/>',
    'pessoal':  '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    'combate':  '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    'default':  '<path d="M12 2l8 10-8 10-8-10z"/>',
  },

  _catKey(categoria) {
    return (categoria || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');   // "Saúde" → "saude"
  },

  _glifoCat(categoria) {
    const paths = this.GLIFOS[this._catKey(categoria)] || this.GLIFOS.default;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  },

  /* Raio (XP) e disco de mana (moedas) — SVG, no lugar dos emojis. */
  _glifoXp() {
    return `<svg class="mc-glifo-xp" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13 2 L4 14 h6 l-1 8 L20 9 h-6 z"/></svg>`;
  },
  _glifoMoeda() {
    return `<svg class="mc-glifo-moeda" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" aria-hidden="true">
      <circle cx="12" cy="12" r="8"/><path d="M12 8 L15 12 L12 16 L9 12 Z" fill="currentColor" stroke="none"/></svg>`;
  },

  /* ── Sigilo (ícone cinético em SVG) ────────────────────── */
  _sigilo(cor, categoria) {
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
        <span class="mc-sigilo-ico">${this._glifoCat(categoria)}</span>
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

    // Editar / Excluir: ações discretas delegadas à página (onAcao),
    // presentes em QUALQUER estado. Não competem com Iniciar/Concluir.
    // 'excluir' é a exclusão NORMAL — diferente do 'extinguir' do Arquiteto.
    const gerir =
      b('editar',  'mc-btn-editar',  '✏️', 'title="Editar missão"') +
      b('excluir', 'mc-btn-excluir', '🗑', 'title="Excluir missão"');

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
    return acoes + gerir + extinguir;
  },

  /* ── HTML de um cartão ───────────────────────────────────
     opts.compacto → variante FINA (usada no Extrato do Dashboard):
     mesmo componente, layout condensado numa faixa baixa. */
  html(m, opts = {}) {
    const compacto = opts.compacto ? ' mc-compacto' : '';
    const status = m.status_hoje || m.status || 'PENDENTE';
    const st     = this.STATUS[status] || this.STATUS.PENDENTE;
    const prior  = this.PRIORIDADES[(m.prioridade || 'MEDIA').toUpperCase()] || this.PRIORIDADES.MEDIA;
    const rank   = this.RANKS[(m.dificuldade || 'NORMAL').toUpperCase()] || this.RANKS.NORMAL;
    const prazo  = this._prazo(m);
    const id     = m.id;
    const cor    = prior.cor;                      // ← a prioridade comanda

    const alpha = (hex, a) => {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
    };

    // Selo de recompensa — mesma marca nos dois modos. No cheio ele flutua
    // no topo direito; no compacto ele entra no FLUXO dos chips (à esquerda),
    // onde se alinha naturalmente em vez de flutuar num x variável.
    const recompensa = `<div class="mc-recompensa" title="Recompensa da missão">
      ${this._glifoXp()}<b>${m.xp_recompensa || 0}</b><span class="mc-rec-un">XP</span>
      ${m.moedas_recompensa ? `<span class="mc-rec-sep"></span>${this._glifoMoeda()}<b class="mc-rec-moeda">${m.moedas_recompensa}</b>` : ''}
    </div>`;

    return `
    <div class="mc ${st.classe}${compacto}" data-mc-card="${id}"
         style="--mc-cor:${cor};--mc-cor-suave:${alpha(cor, .14)}">
      <div class="mc-fio"></div>
      ${this._sigilo(cor, m.categoria)}
      <div class="mc-corpo">
        <div class="mc-topo">
          <div class="mc-titulo" title="${(m.titulo || '').replace(/"/g,'&quot;')}">${m.titulo || 'Missão'}</div>
          ${compacto ? '' : recompensa}
        </div>

        <div class="mc-chips">
          <span class="mc-chip mc-chip-prior">◆ ${prior.rotulo}</span>
          <span class="mc-chip mc-chip-rank" title="Dificuldade ${(m.dificuldade || 'NORMAL').toLowerCase()} — XP ${rank.mult}">✦ ${rank.letra}-Rank</span>
          <span class="mc-chip mc-chip-status">${st.rotulo}</span>
          ${m.categoria ? `<span class="mc-chip mc-chip-cat">${m.categoria}</span>` : ''}
          ${prazo ? `<span class="mc-div"></span>
          <span class="mc-prazo ${prazo.classe}" data-mc-prazo="${id}">
            <span class="lbl">⏳ Prazo</span> <span data-mc-timer>${prazo.texto}</span>
          </span>` : ''}
          ${compacto ? recompensa : ''}
        </div>

        ${prazo ? `<div class="mc-barra"><div class="mc-barra-fill" data-mc-barra="${id}"
                     style="width:${prazo.pct}%"></div></div>` : ''}

        ${compacto ? '' : `<div class="mc-acoes">${this._acoes(status, id)}</div>`}
      </div>
      ${compacto ? `<div class="mc-acoes">${this._acoes(status, id)}</div>` : ''}
    </div>`;
  },

  /* ── Montagem: delegação de eventos + timer único ──────── */
  montar(container, opts = {}) {
    if (!container) return;
    this._onMudou = opts.onMudou || null;
    this._onAcao  = opts.onAcao || null;
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

  /* Encerra o timer de prazo na hora (a página chama ao sair da tela). */
  pararTimer() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  },

  /* Guarda os dados para o timer (chame ao renderizar a lista) */
  cachear(missoes) {
    this._cache = {};
    (missoes || []).forEach(m => { this._cache[m.id] = m; });
  },

  /* ── Execução das ações contra a API real ──────────────── */
  async _executar(acao, id, btn) {
    // Editar / Excluir (normal): o card não resolve — delega à página.
    // NÃO toca a API. (Não confundir com 'extinguir', do Arquiteto.)
    if (acao === 'editar' || acao === 'excluir') {
      this._onAcao && this._onAcao(acao, id, this._cache?.[id]);
      return;
    }
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
