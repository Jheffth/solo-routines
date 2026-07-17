/* ============================================================
   dungeon-interior.js — O Interior da Dungeon
   Modo dedicado de tela cheia: portal, HUD, quadro de missões,
   heartbeat, eventos aleatórios, sussurros e Relatório de Clear.
   ============================================================ */

const DungeonInterior = {
  _dungeon: null,
  _sessao: null,
  _execs: [],
  _hbTimer: null,      // heartbeat (30s)
  _uiTimer: null,      // cronômetro (1s)
  _canvasAnim: null,
  _particles: [],
  _mouse: { x: .5, y: .5 },
  _audio: null,
  _audioOn: false,
  _aberto: false,

  _modoTeste: false,

  /* ══════════════════ ABERTURA (portal) ══════════════════ */
  async abrir(dungeonResumo, opts = {}) {
    if (this._aberto) return;
    this._garantirDOM();
    this._modoTeste = !!opts.arquiteto;

    // Tema provisório para o efeito de portal
    this._aplicarTema(dungeonResumo, document.getElementById('dg-portal-fx'));
    this._portalFX();

    try {
      if (this._modoTeste) {
        // ⟁ Entrada do Arquiteto: atravessa o selo direto, sessão de teste limpa
        const resp = await API.dungeons.entrarArquiteto(dungeonResumo.id);
        this._dungeon = resp.dungeon;
        this._sessao  = resp.sessao;
        this._execs   = resp.execucoes || [];
      } else {
        const estado = await API.dungeons.sessao(dungeonResumo.id);
        this._dungeon = estado.dungeon;
        this._sessao  = estado.sessao;
        this._execs   = estado.execucoes || [];
      }
    } catch (err) {
      SoloDialog.toast('O portão resistiu: ' + (err.message || err), 'error');
      return;
    }

    setTimeout(() => {
      const el = document.getElementById('dungeon-interior');
      this._aplicarTema(this._dungeon, el);
      el.classList.add('on');
      document.body.style.overflow = 'hidden';
      this._aberto = true;

      this._initCanvas();
      this._bindTeclas();

      if (this._modoTeste) {
        this._renderBoard();
        this._iniciarLoops();
        this._log('⟁ O selo reconhece o Arquiteto. Modo teste — nada será creditado.', 'sussurro');
        SoloDialog.toast('⟁ Entrada do Arquiteto — modo teste ativo.', 'info');
      } else if (this._sessao.status === 'ATIVA') {
        this._renderBoard();
        this._iniciarLoops();
        this._log('Você retornou à Dungeon. A sessão continua.', 'sussurro');
      } else if (this._sessao.status === 'PENDENTE') {
        // Travessia direta — sem cerimônia de check-in, como no anime:
        // atravessou o portal, está dentro. Penalidades calculadas em silêncio.
        this._checkin();
      } else {
        // Sessão já resolvida hoje — mostra só o estado
        this._renderCheckin(true);
      }
    }, 850);
  },

  _portalFX() {
    const fx = document.getElementById('dg-portal-fx');
    fx.innerHTML = `
      <div class="dg-portal-blackout"></div>
      <div class="dg-portal-ring"></div>
      <div class="dg-portal-ring r2"></div>
      <div class="dg-portal-ring r3"></div>`;
    fx.classList.add('on');
    setTimeout(() => { fx.classList.remove('on'); fx.innerHTML = ''; }, 1400);
  },

  _aplicarTema(d, el) {
    if (!el || !d) return;
    el.className = el.className.replace(/dg-theme-\S+|dg-rank-\S+/g, '').trim();
    const cat = (d.categoria || 'Pessoal').normalize('NFD').replace(/[̀-ͯ]/g, '');
    el.classList.add('dg-theme-' + cat, 'dg-rank-' + (d.rank || 'E'));
  },

  /* ══════════════════ FECHAMENTO ══════════════════ */
  fechar() {
    this._pararLoops();
    this._pararCanvas();
    this._pararAudio();
    document.getElementById('dungeon-interior')?.classList.remove('on');
    document.getElementById('dg-clear-report')?.classList.remove('on');
    document.body.style.overflow = '';
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    document.removeEventListener('keydown', this._escHandler);
    this._aberto = false;
    this._dungeon = null;
    // Atualiza a aba de dungeons e o perfil na volta
    if (typeof Dungeons !== 'undefined' && App.currentPage === 'dungeons') Dungeons.carregar();
    if (typeof Dashboard !== 'undefined' && App.currentPage === 'dashboard') Dashboard.carregar();
  },

  _bindTeclas() {
    this._escHandler = (e) => {
      if (e.key !== 'Escape' || !this._aberto) return;
      if (document.getElementById('dg-clear-report')?.classList.contains('on')) return;
      // ESC apenas minimiza o interior — a sessão continua ativa.
      // O check-out de verdade é o botão "Sair da Dungeon" (ou o horário de saída).
      this.fechar();
    };
    document.addEventListener('keydown', this._escHandler);
  },

  /* ══════════════════ TELA DE CHECK-IN ══════════════════ */
  _renderCheckin(somenteLeitura = false) {
    const d = this._dungeon, s = this._sessao;
    const body = document.getElementById('dg-conteudo');
    const janela = (d.hora_entrada || d.hora_saida)
      ? `Janela: ${d.hora_entrada || '--:--'} → ${d.hora_saida || '--:--'} · tolerância ${d.tolerancia_min || 0} min` : '';

    const msgs = {
      CONCLUIDA:  `✅ Clear de hoje realizado — Rank ${s.rank_obtido || '-'}. Volte amanhã, Hunter.`,
      FRACASSADA: `☠️ O portão de hoje se fechou sem você. ${s.xp_perdido > 0 ? 'Penalidade: -' + s.xp_perdido + ' XP.' : ''}`,
      CANCELADA:  '✕ Você cancelou a sessão de hoje.',
      PENDENTE:   '🔒 O portão ainda está selado. Volte na hora de entrada.',
    };
    const acao = `<div style="color:var(--text-secondary);font-family:var(--font-section);margin-top:1rem">${msgs[s.status] || ''}</div>
            <button class="dg-btn-retornar" style="margin-top:1.4rem" onclick="DungeonInterior.fechar()">Retornar</button>`;

    body.innerHTML = `
      <div class="dg-checkin">
        <div class="ico">${d.icone || '🌀'}</div>
        <h2>${d.titulo}</h2>
        <span class="dg-rank-badge dg-badge-${d.rank}" style="margin:.3rem auto">${d.rank}</span>
        ${d.descricao ? `<div class="lore">"${d.descricao}"</div>` : ''}
        <div class="janela">${janela}</div>
        <div style="font-size:.75rem;color:var(--text-muted);font-family:var(--font-section)">
          ${d.missoes?.length || 0} missões aguardam lá dentro
          ${d.streak_atual > 0 ? ` · 🔥 streak de ${d.streak_atual} dias em jogo` : ''}
        </div>
        ${acao}
      </div>`;

    this._renderHUD(false);
  },

  async _checkin() {
    try {
      const resp = await API.dungeons.entrar(this._dungeon.id);
      this._sessao = resp.sessao;
      this._execs  = resp.execucoes || [];
      this._dungeon = resp.dungeon || this._dungeon;

      if (resp.pontual) {
        this._log(`Travessia pontual. +${resp.eventos_xp?.xp_ganho || 0} XP. O Sistema aprova.`, 'ganho');
        SoloDialog.toast('⟁ Você atravessou o portão a tempo.', 'success');
      } else {
        this._log(`Travessia com ${resp.atraso_minutos} min de atraso. O portão deixou você passar... desta vez.`, 'perda');
        SoloDialog.toast(`⏰ Entrada com ${resp.atraso_minutos} min de atraso.`, 'info');
      }
      this._fxEventosXP(resp.eventos_xp);
      this._renderBoard();
      this._iniciarLoops();
    } catch (err) {
      SoloDialog.toast(err.message || String(err), 'error');
      // Portão selado/fracassado/já resolvido — mostra o estado e a saída
      try {
        const estado = await API.dungeons.sessao(this._dungeon.id);
        this._sessao = estado.sessao;
      } catch (_) {}
      this._renderCheckin(true);
    }
  },

  /* ══════════════════ HUD ══════════════════ */
  _renderHUD(ativa) {
    const d = this._dungeon;
    const hud = document.getElementById('dg-hud');
    hud.innerHTML = `
      <div class="dg-hud-id">
        <div class="dg-hud-icon">${d.icone || '🌀'}</div>
        <div style="min-width:0">
          <div class="dg-hud-titulo">${d.titulo} <span class="dg-rank-badge dg-badge-${d.rank}" style="width:1.5rem;height:1.5rem;font-size:.75rem;vertical-align:middle">${d.rank}</span>
            ${this._modoTeste ? '<span class="dg-badge-arquiteto">⟁ MODO ARQUITETO — TESTE</span>' : ''}</div>
          <div class="dg-hud-lore">${d.categoria}${d.streak_atual > 0 ? ' · 🔥 ' + d.streak_atual + ' dias' : ''}</div>
        </div>
      </div>
      ${ativa ? `
      <div class="dg-hud-mid">
        <div class="dg-clock"><div class="lbl">Tempo na Dungeon</div><div class="val" id="dg-cron">00:00:00</div></div>
        ${d.hora_saida ? `<div class="dg-clock"><div class="lbl">Fecha em</div><div class="val" id="dg-countdown">--:--</div></div>` : ''}
        <div class="dg-counter"><div class="num xp" id="dg-hud-xp">+${this._sessao?.xp_ganho || 0}</div><div class="lbl">XP Sessão</div></div>
        <div class="dg-counter"><div class="num mc" id="dg-hud-mc">+${this._sessao?.moedas_ganhas || 0}</div><div class="lbl">Moedas</div></div>
      </div>` : '<div class="dg-hud-mid"></div>'}
      <div class="dg-hud-actions">
        <button class="dg-btn-ico" id="dg-btn-score" title="Crônica do Portão — score permanente">📜</button>
        <button class="dg-btn-ico" id="dg-btn-som" title="Som ambiente">${this._audioOn ? '🔊' : '🔇'}</button>
        <button class="dg-btn-ico" id="dg-btn-fs" title="Tela cheia">⛶</button>
        ${ativa
          ? '<button class="dg-btn-sair" id="dg-btn-sair">⟁ Sair da Dungeon</button>'
          : '<button class="dg-btn-sair" id="dg-btn-fechar">✕ Voltar</button>'}
      </div>`;

    document.getElementById('dg-btn-fs')?.addEventListener('click', () => this._toggleFullscreen());
    document.getElementById('dg-btn-score')?.addEventListener('click', () => {
      if (typeof DungeonScore !== 'undefined') DungeonScore.abrir(this._dungeon);
    });
    document.getElementById('dg-btn-som')?.addEventListener('click', () => this._toggleAudio());
    document.getElementById('dg-btn-sair')?.addEventListener('click', () => this._confirmarSaida());
    document.getElementById('dg-btn-fechar')?.addEventListener('click', () => this.fechar());
  },

  _toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.getElementById('dungeon-interior')?.requestFullscreen().catch(() => {});
  },

  /* ══════════════════ QUADRO DE MISSÕES ══════════════════ */
  _renderBoard() {
    this._renderHUD(true);
    const body = document.getElementById('dg-conteudo');
    body.innerHTML = `
      <div class="dg-body">
        <div class="dg-col"><h3>⚔️ Missões Ativas</h3><div id="dg-col-ativas"></div></div>
        <div class="dg-col"><h3>⏳ Passivas</h3><div id="dg-col-passivas"></div></div>
        <div class="dg-col dg-col-feed"><h3>👁 Ecos da Masmorra</h3><div class="dg-feed" id="dg-feed"></div></div>
      </div>
      <div id="dg-evento-stack"></div>
      <div id="dg-sussurro"></div>`;
    this._renderMissoes();
  },

  _renderMissoes() {
    const ativas   = document.getElementById('dg-col-ativas');
    const passivas = document.getElementById('dg-col-passivas');
    if (!ativas) return;

    const padrao = this._execs.filter(e => ['PADRAO', 'AGENDADA'].includes(e.missao.natureza));
    const resist = this._execs.filter(e => e.missao.natureza === 'RESISTENCIA');

    ativas.innerHTML = padrao.length ? padrao.map((e, i) => this._mcardHTML(e, i)).join('')
      : '<div style="font-size:.78rem;color:var(--text-muted);padding:.5rem 0">Nenhuma missão ativa neste quadro.</div>';

    passivas.innerHTML = resist.length ? resist.map((e, i) => {
      const pct = Math.min(100, e.progresso_pct || 0);
      const C = 2 * Math.PI * 28;
      return `
      <div class="dg-ring-card" style="animation-delay:${i * .07}s">
        <div class="dg-ring">
          <svg width="68" height="68" viewBox="0 0 68 68">
            <circle class="track" cx="34" cy="34" r="28" fill="none" stroke-width="5"/>
            <circle class="fill" cx="34" cy="34" r="28" fill="none" stroke-width="5"
              stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct / 100)}"/>
          </svg>
          <div class="pct">${Math.floor(pct)}%</div>
        </div>
        <div class="info" style="flex:1;min-width:0">
          <div class="titulo" style="font-family:var(--font-section);font-weight:600;font-size:.92rem;color:${e.status === 'CONCLUIDA' ? 'var(--green-done)' : 'var(--text-primary)'}">
            ${e.missao.icone || '⏳'} ${e.missao.titulo} ${e.status === 'CONCLUIDA' ? '✔' : ''}</div>
          <div class="desc" style="font-size:.7rem;color:var(--text-muted)">
            ${e.missao.meta_minutos} min de presença · bônus +${e.missao.xp_recompensa} XP</div>
        </div>
      </div>`;
    }).join('')
      : '<div style="font-size:.78rem;color:var(--text-muted);padding:.5rem 0">Nada progride sozinho aqui... ainda.</div>';

    document.querySelectorAll('[data-dg-cumprir]').forEach(b =>
      b.addEventListener('click', () => this._cumprir(parseInt(b.dataset.dgCumprir), b)));
    document.querySelectorAll('[data-dg-acao]').forEach(b =>
      b.addEventListener('click', () => this._acaoExec(b.dataset.dgAcao, parseInt(b.dataset.dgExec))));
  },

  /* Card de missão de livre execução (PADRAO/AGENDADA) com ciclo de vida */
  _mcardHTML(e, i) {
    const m = e.missao;
    const agendada = m.natureza === 'AGENDADA';

    // Janela da agendada
    let janela = '', aindaNaoAbriu = false, jaExpirou = false;
    if (agendada) {
      janela = `<div class="desc" style="color:var(--dg-a)">🕒 ${m.hora_inicio || '--:--'} → prazo ${m.hora_limite || '--:--'}</div>`;
      const agora = new Date();
      const hm = t => { const [h, mm] = t.split(':').map(Number); const x = new Date(); x.setHours(h, mm, 0, 0); return x; };
      if (m.hora_inicio && agora < hm(m.hora_inicio)) aindaNaoAbriu = true;
      if (m.hora_limite && agora > hm(m.hora_limite) && !['CONCLUIDA'].includes(e.status)) jaExpirou = true;
    }

    const btn = (acao, txt, ghost) =>
      `<button class="dg-btn-cumprir ${ghost ? 'dg-btn-ghost-mini' : ''}" data-dg-acao="${acao}" data-dg-exec="${e.id}">${txt}</button>`;

    let acoes = '';
    if (e.status === 'CONCLUIDA')       acoes = '<div class="dg-check-done">✔</div>';
    else if (e.status === 'EXPIRADA' || jaExpirou)
                                        acoes = '<span class="dg-exec-tag exp">⌛ Expirada</span>';
    else if (e.status === 'CANCELADA')  acoes = '<span class="dg-exec-tag can">✕ Cancelada</span>';
    else if (aindaNaoAbriu)             acoes = `<span class="dg-exec-tag wait">🔒 abre às ${m.hora_inicio}</span>`;
    else if (e.status === 'PENDENTE')   acoes = btn('iniciar', '▶ Iniciar') + btn('cancelar', '✕', true);
    else if (e.status === 'EM_PROGRESSO')
      acoes = `<button class="dg-btn-cumprir" data-dg-cumprir="${e.id}">✓ Cumprir</button>` +
              btn('pausar', '⏸', true) + btn('cancelar', '✕', true);
    else if (e.status === 'PAUSADA')    acoes = btn('retomar', '▶ Retomar') + btn('cancelar', '✕', true);

    const emCurso = e.status === 'EM_PROGRESSO' ? ' emcurso' : '';
    const apagada = ['CANCELADA', 'EXPIRADA'].includes(e.status) || jaExpirou ? ' done' : '';
    return `
      <div class="dg-mcard${e.status === 'CONCLUIDA' ? ' done' : apagada}${emCurso}" style="animation-delay:${i * .07}s">
        <div class="ico">${m.icone || (agendada ? '🕒' : '⚔️')}</div>
        <div class="info">
          <div class="titulo">${m.titulo}${e.status === 'PAUSADA' ? ' <span style="color:var(--gold-bright);font-size:.7rem">(pausada)</span>' : ''}</div>
          ${m.descricao ? `<div class="desc">${m.descricao}</div>` : ''}
          ${janela}
          <div class="rec">+${m.xp_recompensa} XP · +${m.moedas_recompensa} 💰
            <span style="color:var(--red-crit);opacity:.85">· ⚠ −${m.penalidade_xp ?? Math.floor((m.xp_recompensa || 0) / 2)} XP se falhar</span></div>
        </div>
        <div style="display:flex;gap:.35rem;align-items:center;flex-shrink:0">${acoes}</div>
      </div>`;
  },

  async _acaoExec(acao, execId) {
    const fns = {
      iniciar: API.dungeons.iniciarExec,
      pausar: API.dungeons.pausarExec,
      retomar: API.dungeons.retomarExec,
      cancelar: API.dungeons.cancelarExec,
    };
    const rotulos = { iniciar: '▶ Missão iniciada', pausar: '⏸ Missão pausada', retomar: '▶ Missão retomada', cancelar: '✕ Missão cancelada' };
    try {
      const resp = await fns[acao](execId);
      const idx = this._execs.findIndex(e => e.id === execId);
      if (idx >= 0) this._execs[idx] = resp.execucao;
      if (resp.sessao) { this._sessao = resp.sessao; }
      this._renderMissoes();
      if (acao === 'cancelar' && resp.penalidade > 0) {
        this._log(`${rotulos[acao]}: ${resp.execucao.missao.titulo} — o Sistema cobra o preço: −${resp.penalidade} XP`, 'perda');
        SoloDialog.toast(`⚠️ Missão cancelada: −${resp.penalidade} XP`, 'warn');
      } else {
        this._log(`${rotulos[acao]}: ${resp.execucao.missao.titulo}`, acao === 'cancelar' ? 'perda' : '');
      }
    } catch (err) {
      SoloDialog.toast(err.message || String(err), 'error');
    }
  },

  async _cumprir(execId, btnEl) {
    try {
      const resp = await API.dungeons.cumprir(execId);
      const idx = this._execs.findIndex(e => e.id === execId);
      if (idx >= 0) this._execs[idx] = resp.execucao;
      this._sessao = resp.sessao;
      this._atualizarContadores();
      this._renderMissoes();
      const m = resp.execucao.missao;
      this._log(`Missão cumprida: ${m.titulo} (+${resp.execucao.xp_ganho} XP)`, 'ganho');
      if (btnEl && typeof createSparks === 'function') {
        const r = btnEl.getBoundingClientRect();
        createSparks(r.left + r.width / 2, r.top + r.height / 2, 10);
      }
      this._fxEventosXP(resp.eventos_xp);
    } catch (err) {
      SoloDialog.toast(err.message || String(err), 'error');
    }
  },

  /* ══════════════════ LOOPS (cronômetro + heartbeat) ══════ */
  _iniciarLoops() {
    this._pararLoops();
    this._tickUI();
    this._uiTimer = setInterval(() => this._tickUI(), 1000);
    this._hbTimer = setInterval(() => this._heartbeat(), 30000);
  },

  _pararLoops() {
    clearInterval(this._uiTimer); this._uiTimer = null;
    clearInterval(this._hbTimer); this._hbTimer = null;
  },

  _tickUI() {
    const s = this._sessao, d = this._dungeon;
    if (!s || !s.entrada_em) return;

    // Cronômetro
    const el = document.getElementById('dg-cron');
    if (el) {
      const seg = Math.max(0, Math.floor((Date.now() - new Date(s.entrada_em).getTime()) / 1000));
      const h = String(Math.floor(seg / 3600)).padStart(2, '0');
      const m = String(Math.floor((seg % 3600) / 60)).padStart(2, '0');
      const ss = String(seg % 60).padStart(2, '0');
      el.textContent = `${h}:${m}:${ss}`;
    }

    // Contagem regressiva até hora_saida
    const cd = document.getElementById('dg-countdown');
    if (cd && d.hora_saida) {
      const [hh, mm] = d.hora_saida.split(':').map(Number);
      const alvo = new Date(); alvo.setHours(hh, mm, 0, 0);
      let diff = Math.floor((alvo.getTime() - Date.now()) / 1000);
      if (diff <= 0) {
        cd.textContent = 'ABERTO';
        cd.classList.add('warn');
      } else {
        const h = String(Math.floor(diff / 3600)).padStart(2, '0');
        const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
        cd.textContent = `${h}:${m}`;
        cd.classList.toggle('warn', diff < 900);
      }
    }

    // Timers dos eventos pop-in
    document.querySelectorAll('.dg-evento [data-expira]').forEach(t => {
      const resta = Math.floor((parseInt(t.dataset.expira) - Date.now()) / 1000);
      if (resta <= 0) t.closest('.dg-evento')?.remove();
      else t.textContent = `dissipa em ${Math.floor(resta / 60)}:${String(resta % 60).padStart(2, '0')}`;
    });
  },

  async _heartbeat() {
    if (!this._aberto || this._sessao?.status !== 'ATIVA') return;
    try {
      const resp = await API.dungeons.heartbeat(this._dungeon.id, this._modoTeste);

      // Check-out automático: o horário de saída passou e o Sistema encerrou
      if (resp.relatorio_auto) {
        this._pararLoops();
        this._sessao = resp.sessao;
        this._mostrarClear(resp.relatorio_auto);
        return;
      }

      this._sessao = resp.sessao;
      this._execs  = resp.execucoes || this._execs;
      this._atualizarContadores();
      this._renderMissoes();

      (resp.concluidas || []).forEach(e => {
        this._log(`⏳ Resistência completa: ${e.missao.titulo} (+${e.xp_ganho} XP)`, 'ganho');
        SoloDialog.toast(`⏳ ${e.missao.titulo} — barra completa!`, 'success');
      });
      (resp.expirados || []).forEach(e => {
        this._log(`${e.missao.icone || '⚡'} ${e.missao.titulo} se dissipou no ar...`, 'sussurro');
      });
      (resp.novos_eventos || []).forEach(e => this._popEvento(e));
      if (resp.sussurro) this._sussurrar(resp.sussurro);
      this._fxEventosXP(resp.eventos_xp);
    } catch (_) { /* rede oscilou — tenta no próximo pulso */ }
  },

  _atualizarContadores() {
    const xp = document.getElementById('dg-hud-xp');
    const mc = document.getElementById('dg-hud-mc');
    if (xp) xp.textContent = '+' + (this._sessao?.xp_ganho || 0);
    if (mc) mc.textContent = '+' + (this._sessao?.moedas_ganhas || 0);
  },

  /* ══════════════════ EVENTOS / SUSSURROS ══════════════════ */
  _popEvento(execEvento) {
    const stack = document.getElementById('dg-evento-stack');
    if (!stack) return;
    const m = execEvento.missao;
    const expiraTs = Date.now() + (m.expira_em_min || 5) * 60000;
    const el = document.createElement('div');
    el.className = 'dg-evento';
    el.innerHTML = `
      <div class="ico">${m.icone || (m.natureza === 'BEM_ESTAR' ? '💧' : '⚡')}</div>
      <div style="flex:1;min-width:0">
        <div class="titulo">${m.titulo}</div>
        ${m.descricao ? `<div class="desc">${m.descricao}</div>` : ''}
        <div class="timer" data-expira="${expiraTs}">dissipa em ${m.expira_em_min || 5}:00</div>
      </div>
      <button class="dg-btn-cumprir">${m.natureza === 'BEM_ESTAR' ? 'Feito ✓' : 'Capturar'}</button>`;
    el.querySelector('button').addEventListener('click', async () => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 350);
      await this._cumprir(execEvento.id);
    });
    stack.appendChild(el);
    this._log(`${m.icone || '⚡'} ${m.titulo}`, '');
  },

  _sussurrar(texto) {
    const el = document.getElementById('dg-sussurro');
    if (!el) return;
    el.textContent = texto;
    el.classList.add('on');
    this._log(texto, 'sussurro');
    setTimeout(() => el.classList.remove('on'), 6000);
  },

  _log(msg, tipo) {
    const feed = document.getElementById('dg-feed');
    if (!feed) return;
    const hh = new Date().toTimeString().slice(0, 5);
    const el = document.createElement('div');
    el.className = 'dg-feed-item ' + (tipo || '');
    el.innerHTML = `<span class="t">${hh}</span>${msg}`;
    feed.prepend(el);
    while (feed.children.length > 40) feed.lastChild.remove();
  },

  _fxEventosXP(ev) {
    if (!ev) return;
    try {
      if (ev.level_ups?.length && typeof LevelUp !== 'undefined') LevelUp.show(ev.level_ups[0].nivel);
      if (ev.conquistas?.length && typeof ConquistaFX !== 'undefined')
        ev.conquistas.forEach((c, i) => setTimeout(() => ConquistaFX.show(c), i * 1600));
      if (ev.xp_ganho > 0 && typeof XPFloat !== 'undefined') XPFloat.show(ev.xp_ganho, ev.moedas_ganhas);
    } catch (_) {}
  },

  /* ══════════════════ SAÍDA / RELATÓRIO DE CLEAR ══════════ */
  _confirmarSaida() {
    // Saída direta, sem modal de confirmação (o Modal travava a tela sob o
    // interior em tela cheia). O Relatório de Clear já é a "cerimônia" de saída.
    this._sair();
  },

  async _sair() {
    try {
      const resp = await API.dungeons.sair(this._dungeon.id, this._modoTeste);
      this._pararLoops();
      this._sessao = resp.sessao;
      this._mostrarClear(resp.relatorio);
      this._fxEventosXP(resp.eventos_xp);
    } catch (err) {
      SoloDialog.toast(err.message || String(err), 'error');
    }
  },

  _mostrarClear(r) {
    const rep = document.getElementById('dg-clear-report');
    const fmt = min => {
      const h = Math.floor(min / 60), m = min % 60;
      return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
    };
    rep.innerHTML = `
      <div class="dg-clear-box">
        ${r.modo_teste ? '<div class="dg-badge-arquiteto" style="margin-bottom:.6rem">⟁ MODO TESTE — NADA FOI CREDITADO AO PERFIL</div>' : ''}
        ${r.auto_saida ? '<div class="dg-badge-arquiteto" style="margin-bottom:.6rem;color:var(--cyan-glow);border-color:rgba(34,211,238,.5);background:rgba(34,211,238,.08);text-shadow:0 0 8px rgba(34,211,238,.5)">⏰ O horário de saída chegou — o Sistema encerrou a sessão por você</div>' : ''}
        <div class="dg-clear-lbl">Dungeon Clear — ${this._dungeon.titulo}</div>
        <div class="dg-clear-rank r-${r.rank_obtido}">${r.rank_obtido}</div>
        <div class="dg-clear-lbl" style="letter-spacing:.15em">${r.pct_missoes}% das missões cumpridas${r.modo_teste ? ' (simulado)' : ''}</div>
        <div class="dg-clear-stats">
          <div class="dg-clear-stat"><div class="k">Missões</div><div class="v">${r.missoes_concluidas}/${r.missoes_totais}</div></div>
          <div class="dg-clear-stat"><div class="k">Tempo dentro</div><div class="v">${fmt(r.tempo_total_min)}</div></div>
          <div class="dg-clear-stat"><div class="k">XP da sessão</div><div class="v gold">+${r.xp_sessao}</div></div>
          <div class="dg-clear-stat"><div class="k">Moedas</div><div class="v cyan">+${r.moedas_sessao}</div></div>
          ${r.bonus_capturados > 0 ? `<div class="dg-clear-stat"><div class="k">Eventos capturados</div><div class="v">⚡ ${r.bonus_capturados}</div></div>` : ''}
          ${r.xp_perdido > 0 ? `<div class="dg-clear-stat"><div class="k">Penalidades</div><div class="v" style="color:var(--red-crit)">−${r.xp_perdido} XP</div></div>` : ''}
          ${r.atraso_minutos > 0 ? `<div class="dg-clear-stat"><div class="k">Atraso</div><div class="v" style="color:var(--red-crit)">${r.atraso_minutos} min</div></div>` : ''}
          <div class="dg-clear-stat"><div class="k">Streak da Dungeon</div><div class="v" style="color:var(--orange-high)">🔥 ${r.streak_dungeon}</div></div>
        </div>
        <button class="dg-btn-retornar" onclick="DungeonInterior.fechar()">Retornar ao Mundo</button>
      </div>`;
    rep.classList.add('on');
  },

  /* ══════════════════ CANVAS DE PARTÍCULAS ══════════════════ */
  _initCanvas() {
    const canvas = document.getElementById('dg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const interior = document.getElementById('dungeon-interior');

    const cs = getComputedStyle(interior);
    const cor = (cs.getPropertyValue('--dg-a') || '#7c3aed').trim();
    const intensidade = parseFloat(cs.getPropertyValue('--dg-int')) || 0.6;

    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    this._resizeHandler = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    window.addEventListener('resize', this._resizeHandler);

    this._mouseHandler = e => {
      this._mouse.x = e.clientX / W;
      this._mouse.y = e.clientY / H;
    };
    interior.addEventListener('mousemove', this._mouseHandler);

    const NUM = Math.floor(40 + 60 * intensidade);
    this._particles = Array.from({ length: NUM }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 2 + .4,
      vx: (Math.random() - .5) * .25,
      vy: -Math.random() * .35 - .05,          // sobem como brasas/mana
      alpha: Math.random() * .5 + .1,
      depth: Math.random() * .8 + .2,          // parallax
    }));

    const loop = () => {
      if (!this._aberto) return;
      ctx.clearRect(0, 0, W, H);
      const px = (this._mouse.x - .5) * 30;
      const py = (this._mouse.y - .5) * 20;

      this._particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
        if (p.x < -10) p.x = W + 10;
        if (p.x > W + 10) p.x = -10;
        p.alpha += (Math.random() - .5) * .015;
        p.alpha = Math.max(.05, Math.min(.6 * intensidade + .15, p.alpha));

        ctx.beginPath();
        ctx.arc(p.x - px * p.depth, p.y - py * p.depth, p.r, 0, Math.PI * 2);
        ctx.fillStyle = cor;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      this._canvasAnim = requestAnimationFrame(loop);
    };
    loop();
  },

  _pararCanvas() {
    cancelAnimationFrame(this._canvasAnim);
    window.removeEventListener('resize', this._resizeHandler);
    this._particles = [];
  },

  /* ══════════════════ SOM AMBIENTE (Web Audio, mudo por padrão) ══ */
  _toggleAudio() {
    this._audioOn ? this._pararAudio() : this._iniciarAudio();
    const btn = document.getElementById('dg-btn-som');
    if (btn) btn.textContent = this._audioOn ? '🔊' : '🔇';
  },

  _iniciarAudio() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const gain = ctx.createGain();
      gain.gain.value = 0.0;
      gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 3);

      const filtro = ctx.createBiquadFilter();
      filtro.type = 'lowpass';
      filtro.frequency.value = 220;

      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.type = 'sine'; o2.type = 'sine';
      o1.frequency.value = 55;          // dró grave
      o2.frequency.value = 55 * 1.5 + 1; // quinta levemente desafinada — tensão
      o1.connect(filtro); o2.connect(filtro);
      filtro.connect(gain); gain.connect(ctx.destination);
      o1.start(); o2.start();

      // LFO respirando no volume
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.08;
      lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain); lfoGain.connect(gain.gain);
      lfo.start();

      this._audio = { ctx, gain };
      this._audioOn = true;
    } catch (_) { this._audioOn = false; }
  },

  _pararAudio() {
    if (this._audio) {
      try {
        this._audio.gain.gain.linearRampToValueAtTime(0, this._audio.ctx.currentTime + .8);
        setTimeout(() => this._audio?.ctx.close().catch(() => {}), 1000);
      } catch (_) {}
      this._audio = null;
    }
    this._audioOn = false;
  },

  /* ══════════════════ DOM base (uma vez) ══════════════════ */
  _garantirDOM() {
    if (document.getElementById('dungeon-interior')) return;
    const fx = document.createElement('div');
    fx.id = 'dg-portal-fx';
    document.body.appendChild(fx);

    const el = document.createElement('div');
    el.id = 'dungeon-interior';
    el.innerHTML = `
      <canvas id="dg-canvas"></canvas>
      <div class="dg-hud" id="dg-hud"></div>
      <div id="dg-conteudo" style="position:relative;z-index:4;flex:1;display:flex;flex-direction:column;min-height:0"></div>
      <div id="dg-clear-report"></div>`;
    document.body.appendChild(el);
  },
};

window.DungeonInterior = DungeonInterior;
