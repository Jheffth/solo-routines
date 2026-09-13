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

    /* A TRAVESSIA JÁ ACONTECEU LÁ FORA.
       Quando a entrada veio de um portão da grade, a fenda dele já
       cresceu e engoliu a tela — na cor dele e a partir do lugar dele.
       Disparar os anéis aqui empilharia duas aberturas e o hunter veria
       dois pretos seguidos. `_portalFX` fica para quem entrar por outro
       caminho, sem um portão na tela para clonar. */
    if (!opts.viaPortao) {
      this._aplicarTema(dungeonResumo, document.getElementById('dg-portal-fx'));
      this._portalFX();
    }

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

    /* A ESPERA É A DOS ANÉIS, NÃO DO SERVIDOR. Vindo da travessia, ela
       já consumiu o tempo da cerimônia lá fora — somar os 850ms daqui
       deixaria o hunter olhando para o preto mais de dois segundos. */
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
    }, opts.viaPortao ? 120 : 850);
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

  /* ══════════════════ TECLADO ══════════════════
     A dungeon é para trabalhar, não para navegar. Quem está dentro tem
     as mãos no teclado e não devia precisar mirar o mouse num botão a
     cada missão.

       Esc     minimiza (a sessão continua ativa lá dentro)
       1 … 9   age na missão N: inicia se parada, cumpre se em curso
       Espaço  inicia/pausa a missão em curso
       F       modo foco

     A GUARDA DO CAMPO DE TEXTO é o que impede isso de virar defeito:
     sem ela, digitar "1" numa caixa de busca cumpriria uma missão. */
  _bindTeclas() {
    this._escHandler = (ev) => {
      if (!this._aberto) return;
      if (document.getElementById('dg-clear-report')?.classList.contains('on')) return;

      const alvo = ev.target;
      const digitando = alvo && (
        /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName) || alvo.isContentEditable);
      if (digitando) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

      if (ev.key === 'Escape') {
        // ESC apenas minimiza — o check-out de verdade é o botão
        // "Encerrar" (ou o horário de saída).
        this.fechar();
        return;
      }

      if (ev.key === 'f' || ev.key === 'F') { ev.preventDefault(); this._toggleFoco(); return; }

      /* AS AÇÕES SÓ VALEM COM A SESSÃO ATIVA. Numa sessão já resolvida
         os cards ainda estão na tela, e um "1" distraído tentaria agir
         sobre algo que o servidor vai recusar. */
      if (this._sessao?.status !== 'ATIVA') return;

      const acionaveis = this._execs.filter(e =>
        !this._BONUS.includes(e.missao.natureza) &&
        ['PENDENTE', 'EM_PROGRESSO', 'PAUSADA'].includes(e.status));

      if (ev.key === ' ') {
        const emCurso = acionaveis.find(e => e.status === 'EM_PROGRESSO');
        if (emCurso) { ev.preventDefault(); this._acaoExec('pausar', emCurso.id); return; }
        const parada = acionaveis.find(e => e.status !== 'EM_PROGRESSO');
        if (parada) {
          ev.preventDefault();
          this._acaoExec(parada.status === 'PAUSADA' ? 'retomar' : 'iniciar', parada.id);
        }
        return;
      }

      if (/^[1-9]$/.test(ev.key)) {
        const alvoExec = acionaveis[parseInt(ev.key, 10) - 1];
        if (!alvoExec) return;
        ev.preventDefault();
        if (alvoExec.status === 'EM_PROGRESSO') this._cumprir(alvoExec.id);
        else this._acaoExec(alvoExec.status === 'PAUSADA' ? 'retomar' : 'iniciar', alvoExec.id);
      }
    };
    document.addEventListener('keydown', this._escHandler);
  },

  /* ══════════════════ MODO FOCO ══════════════════
     Esconde tudo menos a missão em curso e os relógios. Quem entra numa
     dungeon entra justamente para não se distrair — e o quadro cheio,
     com feed e passivas, é distração legítima na hora errada. */
  _toggleFoco() {
    const el = document.getElementById('dungeon-interior');
    if (!el) return;
    const on = el.classList.toggle('dg-foco');
    const btn = document.getElementById('dg-btn-foco');
    if (btn) btn.classList.toggle('on', on);
    this._log(on ? 'Modo foco: só o que está em curso.'
                 : 'Modo foco desligado.', 'sussurro');
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
      if (resp.agora_server) {
        this._timeOffset = Date.now() - new Date(resp.agora_server).getTime();
      }

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

    /* O RELÓGIO SÓ APARECE SE HOUVER PRAZO — e prazo tem duas fontes.
       A condição era `d.hora_saida`, então um portão que não fecha com
       `duracao_max_min` (o único caso em que o limite de travessia é a
       ÚNICA regra de tempo que existe) não mostrava contagem nenhuma. */
    const temPrazo = !!(d.hora_saida_hoje || d.hora_saida || d.duracao_max_min);
    /* Num portão que não fecha, SAIR não é ENCERRAR: o servidor suspende
       a sessão, o prazo continua correndo e o progresso fica de pé. As
       duas ações precisam de dois botões — com um só, o hunter que saiu
       para outra dungeon via o Relatório de Clear e achava que o dia
       tinha acabado. */
    const aberto = !!d.sempre_aberta;
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
        ${temPrazo ? `<div class="dg-clock"><div class="lbl">Fecha em</div><div class="val" id="dg-countdown">--:--</div></div>` : ''}
        <div class="dg-projecao" id="dg-projecao"></div>
        <div class="dg-counter"><div class="num xp" id="dg-hud-xp">+${this._sessao?.xp_ganho || 0}</div><div class="lbl">XP Sessão</div></div>
        <div class="dg-counter"><div class="num mc" id="dg-hud-mc">+${this._sessao?.moedas_ganhas || 0}</div><div class="lbl">Moedas</div></div>
      </div>` : '<div class="dg-hud-mid"></div>'}
      <div class="dg-hud-actions">
        <button class="dg-btn-ico" id="dg-btn-score" title="Crônica do Portão — score permanente">📜</button>
        ${ativa ? '<button class="dg-btn-ico" id="dg-btn-foco" title="Modo foco (F) — só a missão em curso">◎</button>' : ''}
        <button class="dg-btn-ico" id="dg-btn-som" title="Som ambiente">${this._audioOn ? '🔊' : '🔇'}</button>
        <button class="dg-btn-ico" id="dg-btn-fs" title="Tela cheia">⛶</button>
        ${!ativa ? '<button class="dg-btn-sair" id="dg-btn-fechar">✕ Voltar</button>'
          : aberto
            ? '<button class="dg-btn-suspender" id="dg-btn-suspender" '
              + 'title="Sai da dungeon sem encerrar o dia. O progresso fica e o prazo continua correndo.">'
              + '⟲ Sair</button>'
              + '<button class="dg-btn-sair" id="dg-btn-encerrar" '
              + 'title="Fecha o dia desta dungeon e recebe o clear.">⟁ Encerrar</button>'
            : '<button class="dg-btn-sair" id="dg-btn-encerrar">⟁ Sair da Dungeon</button>'}
      </div>`;

    document.getElementById('dg-btn-fs')?.addEventListener('click', () => this._toggleFullscreen());
    document.getElementById('dg-btn-score')?.addEventListener('click', () => {
      if (typeof DungeonScore !== 'undefined') DungeonScore.abrir(this._dungeon);
    });
    document.getElementById('dg-btn-foco')?.addEventListener('click', () => this._toggleFoco());
    document.getElementById('dg-btn-som')?.addEventListener('click', () => this._toggleAudio());
    document.getElementById('dg-btn-suspender')?.addEventListener('click', () => this._sair(false));
    document.getElementById('dg-btn-encerrar')?.addEventListener('click', () => this._sair(true));
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

  /* AS NATUREZAS QUE O QUADRO CONHECE.
     Estas duas listas são a correção de um defeito grave: o filtro era
     uma LISTA BRANCA de `['PADRAO','AGENDADA']`, e CIRCUITO, META e
     REPETIÇÃO — que o servidor arma e que CONTAM para o rank de clear —
     simplesmente não apareciam. O hunter forjava um circuito, entrava,
     não via nada, saía com rank D por missões que a tela nunca mostrou.

     Por isso agora a regra é por EXCLUSÃO, não por inclusão: o que não
     for passiva nem bônus vai para o quadro ativo, inclusive natureza
     que ainda não existe. Lista branca esquece; lista negra não. */
  _PASSIVAS: ['RESISTENCIA'],
  _BONUS:    ['EVENTO_ALEATORIO', 'BEM_ESTAR', 'FLAVOR'],

  _renderMissoes() {
    const ativas   = document.getElementById('dg-col-ativas');
    const passivas = document.getElementById('dg-col-passivas');
    if (!ativas) return;

    const padrao = this._execs.filter(e =>
      !this._PASSIVAS.includes(e.missao.natureza) &&
      !this._BONUS.includes(e.missao.natureza));
    const resist = this._execs.filter(e => this._PASSIVAS.includes(e.missao.natureza));

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
    const risco = m.penalidade_xp ?? Math.floor((m.xp_recompensa || 0) / 2);

    /* O GLIFO DA NATUREZA no lugar do emoji de fallback. O `icone` que o
       hunter escolheu continua valendo — ele é a identidade da missão;
       o glifo entra quando ele não escolheu, e a natureza vira um selo
       à parte, que é onde essa informação pertence. */
    const g = this._glifo(m.natureza);
    const cabeca = m.icone
      ? `<span class="emoji">${m.icone}</span>`
      : g;

    return `
      <article class="dg-mcard${e.status === 'CONCLUIDA' ? ' done' : apagada}${emCurso}"
               style="animation-delay:${i * .07}s" data-dg-card="${e.id}">
        <span class="dg-mc-borda"></span>
        <div class="ico">${cabeca}</div>
        <div class="info">
          <div class="titulo">${m.titulo}${e.status === 'PAUSADA' ? ' <span class="dg-mc-pausada">pausada</span>' : ''}</div>
          ${m.descricao ? `<div class="desc">${m.descricao}</div>` : ''}
          ${janela}
          ${this._corpoNatureza(m)}
          <div class="dg-mc-placas">
            <span class="pl nat">${g}${this._rotuloNatureza(m.natureza)}</span>
            <span class="pl xp">+${m.xp_recompensa} XP</span>
            ${m.moedas_recompensa ? `<span class="pl mo">+${m.moedas_recompensa}</span>` : ''}
            ${risco > 0 ? `<span class="pl risco">−${risco} se falhar</span>` : ''}
          </div>
        </div>
        <div class="dg-mc-lado">
          ${emCurso ? `<div class="dg-mc-crono" data-crono="${e.id}">--:--</div>` : ''}
          <div class="dg-mc-acoes">${acoes}</div>
        </div>
      </article>`;
  },

  /* O alfabeto do Sistema, com queda para o losango genérico se
     `glifos.js` não tiver carregado — placa vazia é pior que emoji. */
  _GLIFO_NAT: {
    PADRAO: 'padrao', AGENDADA: 'agendada', CIRCUITO: 'circuito',
    META: 'meta', REPETICAO: 'repeticao', RESISTENCIA: 'ampulheta',
    EVENTO_ALEATORIO: 'evento', BEM_ESTAR: 'bem_estar', FLAVOR: 'olho',
  },
  _ROTULO_NAT: {
    PADRAO: 'Padrão', AGENDADA: 'Agendada', CIRCUITO: 'Circuito',
    META: 'Meta', REPETICAO: 'Repetição', RESISTENCIA: 'Resistência',
    EVENTO_ALEATORIO: 'Evento', BEM_ESTAR: 'Bem-estar', FLAVOR: 'Sussurro',
  },
  _glifo(natureza, tam) {
    const nome = this._GLIFO_NAT[natureza] || 'padrao';
    if (window.Glifos && Glifos.existe(nome)) return Glifos.linha(nome, tam || 15);
    return `<svg viewBox="0 0 24 24" width="${tam || 15}" height="${tam || 15}" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"
      ><path d="M12 2l8 10-8 10-8-10z"/></svg>`;
  },
  _rotuloNatureza(n) { return this._ROTULO_NAT[n] || n; },

  /* ══════════════════ O CRONÔMETRO DO CARD ══════════════════
     O servidor não devolve QUANDO a execução foi iniciada — `iniciar`
     só muda o status. Em vez de esperar uma coluna nova, o início fica
     no `localStorage`, exatamente como `missao-card.js` já faz com os
     blocos do circuito: a marca é do navegador, some no fim e não
     precisa de migração.

     É por isso que ele não sobrevive a trocar de máquina — e não
     precisa: o tempo que vale, o da sessão, quem guarda é o servidor. */
  _chaveCrono: (id) => 'dgcrono:' + id,

  _cronoLigar(id) {
    try { localStorage.setItem(this._chaveCrono(id), String(Date.now())); } catch (_) {}
  },
  _cronoDesligar(id) {
    try { localStorage.removeItem(this._chaveCrono(id)); } catch (_) {}
  },
  _cronoValor(id) {
    try {
      const t = parseInt(localStorage.getItem(this._chaveCrono(id)), 10);
      return isNaN(t) ? null : t;
    } catch (_) { return null; }
  },

  /* O QUE CADA NATUREZA PRECISA DIZER DE SI.
     Aparecer no quadro não basta: um circuito de quatro blocos exibido
     como uma linha de texto continua sendo uma missão que o hunter não
     entende. Aqui cada natureza mostra o SEU conteúdo.

     ESTA É A LEITURA, NÃO O REGISTRO. Marcar bloco a bloco do circuito e
     somar na meta exigem endpoints que a dungeon ainda não tem (lá fora
     isso vive em `execucoes`, que é outro caminho). Enquanto eles não
     existem, a missão é cumprida inteira — mas pelo menos o hunter vê o
     que combinou consigo mesmo antes de dar por feita. */
  _corpoNatureza(m) {
    const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    if (m.natureza === 'CIRCUITO') {
      const etapas = (m.circuito && m.circuito.blocos) || [];
      if (!etapas.length) return '';
      return `<div class="dg-nat-blocos">${etapas.map(b => {
        const faixa = b.min != null && b.max != null && b.max !== b.min
          ? `${b.min}–${b.max}` : (b.min != null ? String(b.min) : '');
        const un  = b.unidade ? ' ' + b.unidade : '';
        const ser = b.series ? `${b.series} × ` : '';
        return `<span class="dg-bloco${b.feito ? ' feito' : ''}">`
             + `${esc(b.titulo)}<b>${esc(ser + faixa + un)}</b></span>`;
      }).join('')}</div>`;
    }

    if (m.natureza === 'META' && m.meta_alvo != null) {
      const pct = Math.max(0, Math.min(100,
        ((m.meta_atual || 0) / (m.meta_alvo || 1)) * 100));
      const un = m.meta_unidade ? ' ' + m.meta_unidade : '';
      return `<div class="dg-nat-meta">
          <div class="barra"><span style="width:${pct.toFixed(0)}%"></span></div>
          <div class="num">${m.meta_atual || 0} / ${m.meta_alvo}${esc(un)}</div>
        </div>`;
    }

    if (m.natureza === 'REPETICAO' && m.alvo_repeticoes) {
      const feitas = m.repeticoes || 0;
      /* Os pips param em 12 porque depois disso ninguém conta bolinha:
         vira mancha. Acima disso, o número faz o trabalho sozinho. */
      if (m.alvo_repeticoes <= 12) {
        let pips = '';
        for (let k = 0; k < m.alvo_repeticoes; k++) {
          pips += `<i class="${k < feitas ? 'on' : ''}"></i>`;
        }
        return `<div class="dg-nat-pips">${pips}<b>${feitas}/${m.alvo_repeticoes}</b></div>`;
      }
      return `<div class="dg-nat-pips"><b>${feitas} de ${m.alvo_repeticoes} vezes</b></div>`;
    }

    return '';
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

      /* O relógio do card começa no `iniciar` e no `retomar`, e morre em
         qualquer saída. Pausar apaga junto: um cronômetro que continua
         correndo com a missão parada conta uma coisa que não aconteceu. */
      if (acao === 'iniciar' || acao === 'retomar') this._cronoLigar(execId);
      else this._cronoDesligar(execId);

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
      this._cronoDesligar(execId);
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

    // Sincroniza o relógio do navegador com a hora que o servidor acha que é
    const agoraSync = Date.now() - (this._timeOffset || 0);

    // Cronômetro
    const el = document.getElementById('dg-cron');
    if (el) {
      const seg = Math.max(0, Math.floor((agoraSync - new Date(s.entrada_em).getTime()) / 1000));
      const h = String(Math.floor(seg / 3600)).padStart(2, '0');
      const m = String(Math.floor((seg % 3600) / 60)).padStart(2, '0');
      const ss = String(seg % 60).padStart(2, '0');
      el.textContent = `${h}:${m}:${ss}`;
    }

    /* ── A CONTAGEM REGRESSIVA ──────────────────────────────────────
       ERA A TERCEIRA CÓPIA DIVERGENTE DA REGRA DE PRAZO. Lia
       `d.hora_saida` cru: ignorava `hora_saida_hoje` (a agenda semanal
       do dia) e ignorava `duracao_max_min` — o limite de travessia que
       o Arquiteto pediu, e que num portão que não fecha é o ÚNICO
       prazo que existe. E quando o prazo vencia, escrevia "ABERTO",
       que é exatamente o contrário do que tinha acontecido.

       Agora chama `PortaoEstado.prazoDa`, o mesmo espelho de
       `_prazo_da_sessao` que a grade usa. Uma regra, um lugar. */
    const cd = document.getElementById('dg-countdown');
    if (cd && typeof PortaoEstado !== 'undefined') {
      const agora = new Date(agoraSync);
      const prazo = PortaoEstado.prazoDa(d, s, agora);
      if (!prazo) {
        cd.textContent = '∞';
        cd.classList.remove('warn');
      } else {
        const diff = Math.floor((prazo.getTime() - agoraSync) / 1000);
        if (diff <= 0) {
          cd.textContent = 'VENCIDO';
          cd.classList.add('warn');
        } else {
          const h = String(Math.floor(diff / 3600)).padStart(2, '0');
          const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
          cd.textContent = `${h}:${m}`;
          cd.classList.toggle('warn', diff < 900);
        }
      }
    }

    /* Os cronômetros dos cards em curso. Contam do `iniciar`, não da
       entrada na dungeon — é o tempo daquela missão, não do dia. */
    document.querySelectorAll('[data-crono]').forEach(el => {
      const t0 = this._cronoValor(el.dataset.crono);
      if (!t0) { el.textContent = '--:--'; return; }
      const seg = Math.max(0, Math.floor((Date.now() - t0) / 1000));
      const h = Math.floor(seg / 3600);
      const m = String(Math.floor((seg % 3600) / 60)).padStart(2, '0');
      const s2 = String(seg % 60).padStart(2, '0');
      el.textContent = h > 0 ? `${h}:${m}:${s2}` : `${m}:${s2}`;
    });

    // O rank que ele levaria se saísse agora
    this._atualizarProjecao();

    // Timers dos eventos pop-in
    document.querySelectorAll('.dg-evento [data-expira]').forEach(t => {
      const resta = Math.floor((parseInt(t.dataset.expira) - agoraSync) / 1000);
      if (resta <= 0) t.closest('.dg-evento')?.remove();
      else t.textContent = `dissipa em ${Math.floor(resta / 60)}:${String(resta % 60).padStart(2, '0')}`;
    });
  },

  async _heartbeat() {
    if (!this._aberto || this._sessao?.status !== 'ATIVA') return;
    try {
      const resp = await API.dungeons.heartbeat(this._dungeon.id, this._modoTeste);

      if (resp.agora_server) {
        this._timeOffset = Date.now() - new Date(resp.agora_server).getTime();
      }

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
    this._atualizarProjecao();
  },

  /* ══════════════════ O RANK PROJETADO ══════════════════
     "Se você sair agora: rank B."

     Hoje o hunter só descobre o rank DEPOIS de sair, quando já não dá
     para mudar nada. Mas a conta inteira já está no cliente — as
     execuções contáveis e o mesmo `_MULT_CLEAR` do servidor — então
     esconder isso até o fim não protegia nada, só tirava dele a única
     informação capaz de mudar a decisão de ficar mais dez minutos.

     E ela vem com o que FALTA para o próximo degrau, que é a parte
     acionável: "rank B · faltam 2 para A" diz o que fazer; "rank B"
     sozinho só informa.

     A tabela é a de `routers/dungeons.py`. Se ela mudar lá e não aqui,
     o interior passa a prometer um rank que não vem — é o preço de
     antecipar a conta, e é o mesmo preço que a prévia da Forja paga. */
  _FAIXAS: [[90, 'S'], [70, 'A'], [50, 'B'], [30, 'C'], [0, 'D']],
  _CONTAVEIS: ['PADRAO', 'AGENDADA', 'CIRCUITO', 'META', 'REPETICAO', 'RESISTENCIA'],

  _projecao() {
    const cont = this._execs.filter(e => this._CONTAVEIS.includes(e.missao.natureza));
    if (!cont.length) return null;

    const feitas = cont.filter(e => e.status === 'CONCLUIDA').length;
    const pct = (feitas / cont.length) * 100;
    let rank = 'D';
    for (const [piso, r] of this._FAIXAS) { if (pct >= piso) { rank = r; break; } }

    /* O ATRASO REBAIXA O S PARA A — a mesma regra do servidor. Sem ela a
       projeção prometeria um S que o clear não entrega, e descobrir isso
       no relatório seria pior do que nunca ter visto a projeção. */
    if ((this._sessao?.atraso_minutos || 0) > 0 && rank === 'S') rank = 'A';

    let faltam = 0, proximo = null;
    for (let k = this._FAIXAS.length - 1; k >= 0; k--) {
      const [piso, r] = this._FAIXAS[k];
      if (piso > pct) {
        proximo = r;
        faltam = Math.max(1, Math.ceil((piso / 100) * cont.length) - feitas);
        break;
      }
    }
    return { rank, pct, feitas, total: cont.length, faltam, proximo };
  },

  _atualizarProjecao() {
    const el = document.getElementById('dg-projecao');
    if (!el) return;
    const p = this._projecao();
    if (!p) { el.innerHTML = ''; return; }

    const falta = p.proximo
      ? `<span class="falta">falta${p.faltam === 1 ? '' : 'm'} ${p.faltam} para ${p.proximo}</span>`
      : '<span class="falta topo">o topo</span>';
    el.innerHTML = `<span class="lbl">Se sair agora</span>`
      + `<span class="rk r-${p.rank}">${p.rank}</span>${falta}`;
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
      if (ev.level_ups?.length && typeof LevelUp !== 'undefined') {
        const lu = ev.level_ups[0];
        LevelUp.show(lu.nivel, lu.rank, lu.titulo, lu.moedas_bonus);
      }
      // Conquistas: interceptador global do api.js cuida (canal único)
      if (ev.xp_ganho > 0 && typeof XPFloat !== 'undefined') XPFloat.show(ev.xp_ganho, ev.moedas_ganhas);
    } catch (_) {}
  },

  /* ══════════════════ SAÍDA / RELATÓRIO DE CLEAR ══════════ */
  /* Saída direta, sem modal de confirmação (o Modal travava a tela sob o
     interior em tela cheia). O Relatório de Clear já é a "cerimônia". */
  _confirmarSaida() { this._sair(true); },

  /* SAIR E ENCERRAR SÃO COISAS DIFERENTES.
     Num portão que não fecha, `sair` sem `encerrar` SUSPENDE: o servidor
     não pune as pendentes, não fecha o rank e não paga o clear — o
     hunter foi cuidar de outra dungeon e pode voltar. Mostrar o
     Relatório de Clear nesse caso seria mentir: é a tela de fim de dia.
     Aqui a suspensão sai em silêncio, com um aviso do que continua
     correndo lá dentro. */
  async _sair(encerrar) {
    try {
      const resp = encerrar
        ? await API.dungeons.encerrar(this._dungeon.id, this._modoTeste)
        : await API.dungeons.sair(this._dungeon.id, this._modoTeste);

      this._pararLoops();
      this._sessao = resp.sessao;

      const r = resp.relatorio || {};
      if (r.suspensa) {
        const resta = r.minutos_restantes != null
          ? ` O prazo continua: restam ${r.minutos_restantes} min.`
          : '';
        SoloDialog.toast('⟲ Você saiu. O progresso ficou intacto.' + resta, 'info');
        this.fechar();
        return;
      }

      this._mostrarClear(r);
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
