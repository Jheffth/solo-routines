/* ============================================================
   dungeons.js — Aba Dungeons (Portões)
   Grid de portões + Forja (modal de criação/edição + missões)
   O interior imersivo vive em dungeon-interior.js
   ============================================================ */

const Dungeons = {
  _lista: [],
  _editando: null,      // dungeon em edição (null = criando)
  // CATEGORIAS e RANKS ficam aqui porque a GRADE também os usa (tema
  // visual do card, cor do rank). A ForjaPortao lê os dois daqui.
  CATEGORIAS: ['Trabalho', 'Saúde', 'Estudo', 'Casa', 'Pessoal', 'Combate'],
  RANKS: ['E', 'D', 'C', 'B', 'A', 'S'],
  // As naturezas mudaram de casa: quem as descreve agora é a forja, com
  // placa e frase, em vez de um `<select>` onde a explicação some ao
  // escolher. Ficam aqui só para quem ainda lê `Dungeons.NATUREZAS`.
  NATUREZAS: [
    { v: 'PADRAO',           t: '⚔️ Padrão (iniciar/pausar/cumprir)' },
    { v: 'AGENDADA',         t: '🕒 Agendada (horário e prazo marcados)' },
    { v: 'RESISTENCIA',      t: '⏳ Resistência (enche com o tempo)' },
    { v: 'EVENTO_ALEATORIO', t: '⚡ Evento Aleatório (surpresa)' },
    { v: 'BEM_ESTAR',        t: '💧 Bem-Estar (lembrete periódico)' },
    { v: 'FLAVOR',           t: '👁 Sussurro (imersão, sem XP)' },
  ],
  DIAS_LBL: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],

  _catClass(cat) {
    return 'dg-theme-' + (cat || 'Pessoal').normalize('NFD').replace(/[̀-ͯ]/g, '');
  },

  /* ── Biblioteca de ícones do Sistema ──────────────────── */
  ICONES: [
    { cat: '⚔️ Combate & Caça', lista: [
      '⚔️','🗡','🛡','🏹','🪓','🔱','⚡','💥','🔥','❄️','☠️','💀','👹','👺','🐉','🐺',
      '🦂','🕷','🐍','👾','🧟','🦴','🩸','⛓','🗿','🏴','🚩','🎯' ] },
    { cat: '✨ Magia & Sistema', lista: [
      '✨','🔮','🌀','💠','🔷','🔶','🟣','💎','🌟','⭐','🌙','☀️','🌌','🌠','🧿','📿',
      '🕯','🪄','🧪','⚗️','📜','🗝','🔑','🚪','🌫','👁','🫧','♾️' ] },
    { cat: '💼 Trabalho & Estudo', lista: [
      '💼','💻','🖥','⌨️','🖱','📱','☎️','📊','📈','📉','📋','📝','✏️','🖊','📚','📖',
      '📓','🗂','📁','📎','🧾','💰','💳','🪙','🏦','📦','🏗','⚙️' ] },
    { cat: '❤️ Corpo & Bem-estar', lista: [
      '❤️','💪','🧠','🫀','🦾','🏃','🏋️','🧘','🤸','🚴','🥊','🥋','💧','🚿','🛁','😴',
      '🛌','🍎','🥗','🍳','☕','🍵','💊','🩺','🦷','👁‍🗨','🧴','🌡' ] },
    { cat: '🏠 Casa & Cotidiano', lista: [
      '🏠','🧹','🧺','🧽','🗑','🛠','🔧','🔨','🪛','🧰','🚗','⛽','🛒','🍽','🍲','🥘',
      '🧊','🔌','💡','🪟','🚪','🌱','🪴','🐕','🐈','👕','🧦','📬' ] },
    { cat: '🍽 Restaurante & Pedidos', lista: [
      '🍞','🥖','🥐','🍅','🥬','🥕','🧅','🥔','🍖','🥩','🍗','🐟','🦐','🧀','🥚','🥛',
      '🍚','🫘','🌶','🧂','🫒','🍋','📞','🚚','📥','📤','🧑‍🍳','🔪' ] },
    { cat: '⏳ Tempo & Ritmo', lista: [
      '⏰','⏱','⏳','⌛','🕐','📅','🗓','🔔','🔕','🌅','🌄','🌆','🌃','🌞','🌝','🔁',
      '▶️','⏸','⏹','⏩','🐇','🐢','🚀','🛸','🎢','🌊','🪫','🔋' ] },
  ],

  _bindIconPicker(inputId) {
    const input = document.getElementById(inputId);
    if (!input || input.dataset.picker) return;
    input.dataset.picker = '1';
    input.readOnly = true;
    input.style.cursor = 'pointer';
    input.title = 'Clique para escolher um ícone';

    const wrap = input.parentElement;
    wrap.style.position = 'relative';

    const pop = document.createElement('div');
    pop.className = 'dg-iconpicker';
    pop.innerHTML = this.ICONES.map(g => `
      <div class="dg-ip-cat">${g.cat}</div>
      <div class="dg-ip-grid">
        ${g.lista.map(i => `<span class="dg-ip-item" data-ico="${i}">${i}</span>`).join('')}
      </div>`).join('');
    wrap.appendChild(pop);

    const abrir = (on) => pop.classList.toggle('on', on);
    input.addEventListener('click', e => { e.stopPropagation(); abrir(!pop.classList.contains('on')); });
    pop.addEventListener('click', e => {
      const item = e.target.closest('.dg-ip-item');
      if (item) {
        input.value = item.dataset.ico;
        abrir(false);
        input.style.animation = 'none';
        void input.offsetWidth;
        input.style.animation = 'dg-icon-breathe 1s ease 1';
      }
      e.stopPropagation();
    });
    document.addEventListener('click', () => abrir(false));
  },

  /* ── Carregar e renderizar a aba ─────────────────────────── */
  async carregar() {
    const cont = document.getElementById('lista-dungeons');
    if (!cont) return;
    cont.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';
    try {
      this._lista = await API.dungeons.listar();
      this._render();
    } catch (err) {
      cont.innerHTML = `<div class="dg-empty"><div class="dg-empty-icon">⚠️</div>Erro ao invocar os portões: ${err.message || err}</div>`;
    }
    const btnNova = document.getElementById('btn-nova-dungeon');
    if (btnNova && !btnNova.dataset.bound) {
      btnNova.dataset.bound = '1';
      btnNova.addEventListener('click', () => this.abrirForja(null));
    }
  },

  _render() {
    const cont = document.getElementById('lista-dungeons');
    if (!cont) return;

    if (!this._lista.length) {
      cont.innerHTML = `
        <div class="dg-empty">
          <div class="dg-empty-icon">🌀</div>
          <div style="font-size:1.05rem;font-weight:700;color:var(--text-secondary)">Nenhum portão detectado</div>
          <div style="font-size:.8rem;margin-top:.4rem">Forje sua primeira Dungeon e crie um ambiente só seu.</div>
          <button id="dg-btn-primeiro" class="dg-btn-retornar" style="margin-top:1.5rem">⚒️ Forjar Primeiro Portão</button>
        </div>`;
      document.getElementById('dg-btn-primeiro')?.addEventListener('click', () => this.abrirForja(null));
      return;
    }

    cont.innerHTML = this._lista.map((d, i) => this._gateHTML(d, i)).join('');

    // Bind
    cont.querySelectorAll('[data-dg-entrar]').forEach(b =>
      b.addEventListener('click', () => this._entrar(parseInt(b.dataset.dgEntrar))));
    cont.querySelectorAll('[data-dg-arquiteto]').forEach(b =>
      b.addEventListener('click', () => this._entrarArquiteto(parseInt(b.dataset.dgArquiteto))));
    cont.querySelectorAll('[data-dg-resetar]').forEach(b =>
      b.addEventListener('click', () => this._resetar(parseInt(b.dataset.dgResetar))));
    cont.querySelectorAll('[data-dg-score]').forEach(b =>
      b.addEventListener('click', () => {
        const d = this._lista.find(x => x.id === parseInt(b.dataset.dgScore));
        if (d && typeof DungeonScore !== 'undefined') DungeonScore.abrir(d);
      }));
    cont.querySelectorAll('[data-dg-editar]').forEach(b =>
      b.addEventListener('click', () => this._editar(parseInt(b.dataset.dgEditar))));
    cont.querySelectorAll('[data-dg-excluir]').forEach(b =>
      b.addEventListener('click', () => this._excluir(parseInt(b.dataset.dgExcluir))));
  },

  _statusInfo(d) {
    const s = d.sessao_hoje;
    const hEntrada = d.hora_entrada_hoje || d.hora_entrada;   // respeita a agenda do dia
    const hSaida   = d.hora_saida_hoje   || d.hora_saida;
    if (d.folga_hoje)   return { cls: 'FECHADA', txt: '🏖 Trancado — folga programada hoje', btn: false };
    if (!d.devida_hoje) return { cls: 'FECHADA', txt: '🌑 Portão fechado hoje', btn: false };

    // Helper: converte "HH:MM" em objeto Date de hoje
    const toHoje = hhmm => {
      if (!hhmm) return null;
      const [h, m] = hhmm.split(':').map(Number);
      const d = new Date(); d.setHours(h, m, 0, 0); return d;
    };

    const now = new Date();

    // Se o horário de SAÍDA já passou e a sessão ainda não foi resolvida → portão perdido
    const saida = toHoje(hSaida);
    if (saida && now > saida && (!s || s.status === 'PENDENTE')) {
      return { cls: 'FRACASSADA', txt: `☠️ Portão perdido — sem check-in até ${hSaida}`, btn: false };
    }

    // Estados da janela: selado (antes da entrada) → aberto (até entrada+tolerância)
    // → aberto com atraso (punição na entrada, até a saída) → no-show (fecha na saída)
    let selado = false, atrasado = false;
    if (hEntrada && (!s || s.status === 'PENDENTE')) {
      const entrada = toHoje(hEntrada);
      if (now < entrada) selado = true;
      else {
        const prazo = new Date(entrada.getTime() + (d.tolerancia_min || 0) * 60000);
        if (now > prazo) atrasado = true;
      }
    }
    const txtAberto = atrasado
      ? `⚠ Portão aberto — ATRASO em curso (punição na entrada)${hSaida ? ' · fecha às ' + hSaida : ''}`
      : `🌀 Portão aberto${hEntrada ? ' — atravesse até ' + this._prazoTxt(d) : ' — atravesse'}`;
    const clsAberto = atrasado ? 'ATRASADO' : 'ABERTO';

    if (!s) {
      return {
        cls: selado ? 'PENDENTE' : clsAberto,
        txt: selado ? `🔒 Portão selado — abre às ${hEntrada}` : txtAberto,
        btn: !selado
      };
    }

    switch (s.status) {
      case 'PENDENTE':
        return {
          cls: selado ? 'PENDENTE' : clsAberto,
          txt: selado ? `🔒 Portão selado — abre às ${hEntrada}` : txtAberto,
          btn: !selado
        };
      case 'ATIVA':      return { cls: 'ATIVA',      txt: '⚔️ VOCÊ ESTÁ DENTRO — sessão ativa', btn: true, btnTxt: 'Retornar à Dungeon', escape: true };
      case 'CONCLUIDA':  return { cls: 'CONCLUIDA',  txt: `✅ Clear de hoje — Rank ${s.rank_obtido || '-'} · +${s.xp_ganho} XP`, btn: false };
      case 'FRACASSADA': return { cls: 'FRACASSADA', txt: `☠️ Portão perdido — ${s.xp_perdido > 0 ? '-' + s.xp_perdido + ' XP' : 'sem check-in'}`, btn: false };
      case 'CANCELADA':  return { cls: 'CANCELADA',  txt: '✕ Sessão cancelada hoje', btn: false };
    }
    return { cls: 'FECHADA', txt: '—', btn: false };
  },

  _gateHTML(d, i) {
    const st = this._statusInfo(d);
    const recor = d.tipo_permanencia === 'TEMPORARIA'
      ? `⌛ ${d.data_inicio || '?'} → ${d.data_fim || '?'}`
      : { DIARIA: '🔁 Diária', SEMANAL: '📆 Semanal', MENSAL: '🗓 Mensal', ANUAL: '🎯 Anual' }[d.tipo_recorrencia] || '🔁';
    const hE = d.hora_entrada_hoje || d.hora_entrada;
    const hS = d.hora_saida_hoje || d.hora_saida;
    const janela = (hE || hS)
      ? `<span class="dg-chip dg-chip-tempo">🕐 ${hE || '--:--'} → ${hS || '--:--'}</span>` : '';

    return `
    <div class="dg-gate ${this._catClass(d.categoria)} dg-rank-${d.rank}" style="animation:dg-card-in .4s ease ${i * 0.06}s backwards">
      <div class="dg-gate-aura"></div>
      <div class="dg-gate-top">
        <div class="dg-gate-icon">${d.icone || '🌀'}</div>
        <div style="flex:1;min-width:0">
          <div class="dg-gate-titulo">${d.titulo}</div>
          <div class="dg-gate-sub">${d.categoria} · ${d.dificuldade}</div>
        </div>
        <span class="dg-rank-badge dg-badge-${d.rank}">${d.rank}</span>
      </div>
      <div class="dg-gate-meta">
        <span class="dg-chip">${recor}</span>
        ${janela}
        <span class="dg-chip">🗡 ${d.total_missoes} missõe${d.total_missoes === 1 ? '' : 's'}</span>
        ${d.streak_atual > 0 ? `<span class="dg-chip dg-streak">🔥 ${d.streak_atual} dias</span>` : ''}
      </div>
      <div class="dg-gate-status dg-st-${st.cls}">${st.txt}</div>
      <div class="dg-gate-footer">
        <button class="dg-btn-entrar" data-dg-entrar="${d.id}" ${st.btn ? '' : 'disabled'}>
          ${st.btnTxt || 'Entrar na Dungeon'}
        </button>
        ${this._ehArquiteto() ? `
        <button class="dg-btn-ico dg-btn-arquiteto" data-dg-arquiteto="${d.id}"
          title="Entrada do Arquiteto — modo teste (nada é creditado)">⟁</button>
        <button class="dg-btn-ico dg-btn-arquiteto" data-dg-resetar="${d.id}"
          title="Reset do Arquiteto — apaga a sessão de hoje como se nunca tivesse acontecido">↺</button>` : ''}
        <button class="dg-btn-ico" data-dg-score="${d.id}" title="Crônica do Portão — score permanente">📜</button>
        <button class="dg-btn-ico" data-dg-editar="${d.id}" title="Editar / Missões">✎</button>
        <button class="dg-btn-ico danger" data-dg-excluir="${d.id}" title="Destruir portão">🗑</button>
      </div>
    </div>`;
  },

  _prazoTxt(d) {
    // Prazo de travessia = hora de entrada + tolerância
    const hEntrada = d.hora_entrada_hoje || d.hora_entrada;
    if (!hEntrada) return '';
    const [h, m] = hEntrada.split(':').map(Number);
    const t = new Date(); t.setHours(h, m + (d.tolerancia_min || 0), 0, 0);
    return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
  },

  _ehArquiteto() {
    try { return Auth.getUsuario()?.nivel_acesso === 'Arquiteto'; }
    catch (_) { return false; }
  },

  _entrarArquiteto(id) {
    const d = this._lista.find(x => x.id === id);
    if (!d || !this._ehArquiteto()) return;
    if (typeof DungeonInterior !== 'undefined') DungeonInterior.abrir(d, { arquiteto: true });
  },

  async _resetar(id) {
    const d = this._lista.find(x => x.id === id);
    if (!d || !this._ehArquiteto()) return;
    const ok = await SoloDialog.confirm(
      `Reverter o tempo do portão "${d.titulo}"? A sessão de hoje será apagada como se nunca tivesse acontecido — XP, moedas e penalidades que ela gerou são desfeitos. O estado final segue o relógio (selado, aberto ou fechado por no-show).`,
      { titulo: 'Reset do Arquiteto', tipo: 'warn', icon: '↺', btnOk: 'Reverter', btnCancel: 'Cancelar' }
    );
    if (!ok) return;
    try {
      await API.dungeons.resetar(id);
      SoloDialog.toast('↺ O tempo do portão foi revertido.', 'success');
      await this.carregar();
    } catch (err) {
      SoloDialog.toast('Erro no reset: ' + (err.message || err), 'error');
    }
  },

  _entrar(id) {
    const d = this._lista.find(x => x.id === id);
    if (!d) return;
    if (typeof DungeonInterior !== 'undefined') DungeonInterior.abrir(d);
  },


  async _editar(id) {
    try {
      const d = await API.dungeons.obter(id);
      this.abrirForja(d);
    } catch (err) {
      SoloDialog.toast('Erro: ' + (err.message || err), 'error');
    }
  },

  async _excluir(id) {
    const d = this._lista.find(x => x.id === id);
    const ok = await SoloDialog.confirm(
      `Destruir o portão "${d?.titulo}"? Todas as sessões e missões desta Dungeon serão apagadas. Esta ação é irreversível.`,
      { titulo: 'Destruir Portão', tipo: 'error', icon: '🌀', btnOk: 'Destruir', btnCancel: 'Cancelar' }
    );
    if (!ok) return;
    try {
      await API.dungeons.deletar(id);
      SoloDialog.toast('🌑 Portão destruído.', 'info');
      await this.carregar();
    } catch (err) {
      SoloDialog.toast('Erro: ' + (err.message || err), 'error');
    }
  },

  /* ══════════════════════════════════════════════════════════
     A FORJA — agora vive em js/forja-portao.js

     O formulário antigo era um só: vinte e cinco campos numa grade,
     "auto" escrito em cinco deles e nenhum jeito de ver o portão antes
     de gravá-lo. A ForjaPortao ficou com TODA a lógica dele — cada
     campo, cada regra de permanência x recorrência, a agenda por dia,
     as folgas — e acrescentou o que faltava: as quatro câmaras, a
     prévia ao vivo com a conta do multiplicador, o interruptor do
     portão que não fecha e o acervo de missões reaproveitáveis.

     O que ficou aqui é o que é da GRADE, não da forja: a confirmação
     visual da criação e o seletor de ícones, que a forja reusa.
     ══════════════════════════════════════════════════════════ */
  abrirForja(dungeon) {
    if (!window.ForjaPortao) {
      SoloDialog.toast('A Forja não carregou. Recarregue a página.', 'error');
      return;
    }
    ForjaPortao.abrir(dungeon, {
      aoSalvar: async (resultado, payload) => {
        await this.carregar();
        if (resultado) this._mostrarConfirmacaoCriacao(payload, resultado);
        else SoloDialog.toast('\u2692\ufe0f Portão reforjado.', 'success');
      },
    });
  },

  /* ── Confirmação Visual de Criação de Dungeon ─────────── */
  _mostrarConfirmacaoCriacao(payload, result) {
    // Remove instância anterior se houver
    document.getElementById('dg-criacao-confirm')?.remove();

    const RANK_CORES = {
      E: { cor: '#94a3b8', rgb: '148,163,184', label: 'RANK E', glow: '#94a3b8' },
      D: { cor: '#4ade80', rgb: '74,222,128',  label: 'RANK D', glow: '#4ade80' },
      C: { cor: '#60a5fa', rgb: '96,165,250',  label: 'RANK C', glow: '#60a5fa' },
      B: { cor: '#c084fc', rgb: '192,132,252', label: 'RANK B', glow: '#c084fc' },
      A: { cor: '#f97316', rgb: '249,115,22',  label: 'RANK A', glow: '#f97316' },
      S: { cor: '#fbbf24', rgb: '251,191,36',  label: 'RANK S', glow: '#fbbf24' },
    };
    const DIFI_LABEL = { FACIL: '☁️ Fácil', NORMAL: '⚡ Normal', DIFICIL: '🔥 Difícil', LENDARIO: '💀 Lendário' };
    const PERM_LABEL = { PERMANENTE: '♾️ Permanente', TEMPORARIA: '⏳ Temporária', INVIOLAVEL: '🔒 Inviolável' };

    const rank  = payload.rank  || 'E';
    const tema  = RANK_CORES[rank] || RANK_CORES.E;
    const nMiss = (payload.missoes || []).length;
    const xpTxt = payload.xp_clear ? `+${payload.xp_clear} XP` : 'Auto';
    const mcTxt = payload.moedas_clear ? `+${payload.moedas_clear} 🪙` : 'Auto';
    const horaStr = (payload.hora_entrada && payload.hora_saida)
      ? `${payload.hora_entrada} → ${payload.hora_saida}`
      : payload.hora_entrada ? `a partir das ${payload.hora_entrada}` : null;

    const ov = document.createElement('div');
    ov.id = 'dg-criacao-confirm';
    ov.style.cssText = [
      'position:fixed;inset:0;z-index:99999',
      'display:flex;align-items:center;justify-content:center',
      'background:rgba(2,6,23,0.92);backdrop-filter:blur(8px)',
      'opacity:0;transition:opacity .35s',
    ].join(';');

    ov.innerHTML = `
      <style>
        @keyframes dgc-porta-abrir {
          0%   { transform: scaleY(0) translateY(-30px); opacity: 0; }
          60%  { transform: scaleY(1.06) translateY(2px); opacity: 1; }
          100% { transform: scaleY(1) translateY(0);   opacity: 1; }
        }
        @keyframes dgc-icone-pop {
          0%   { transform: scale(0) rotate(-20deg); opacity: 0; }
          70%  { transform: scale(1.25) rotate(4deg); opacity: 1; }
          100% { transform: scale(1) rotate(0);   opacity: 1; }
        }
        @keyframes dgc-scan {
          0%   { top: 0; opacity: 0.7; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes dgc-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes dgc-pulse-borda {
          0%, 100% { box-shadow: 0 0 20px rgba(${tema.rgb},.35), 0 0 60px rgba(${tema.rgb},.12), inset 0 0 20px rgba(${tema.rgb},.05); }
          50%       { box-shadow: 0 0 35px rgba(${tema.rgb},.6),  0 0 80px rgba(${tema.rgb},.25), inset 0 0 30px rgba(${tema.rgb},.1); }
        }
        #dg-criacao-card {
          width: min(520px, 96vw);
          background: linear-gradient(160deg, #0d1120 0%, #060916 60%, #0a0820 100%);
          border: 1.5px solid rgba(${tema.rgb},.55);
          border-radius: 20px;
          overflow: hidden;
          position: relative;
          animation: dgc-porta-abrir .55s cubic-bezier(.34,1.56,.64,1) both, dgc-pulse-borda 3s ease-in-out 1s infinite;
        }
        #dg-criacao-card .dgc-scan-line {
          position: absolute; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, rgba(${tema.rgb},.7), transparent);
          animation: dgc-scan 2s linear 0.6s 2;
          pointer-events: none; top: 0;
        }
        .dgc-rank-badge {
          display: inline-flex; align-items: center; gap: .3rem;
          padding: .25rem .65rem; border-radius: 20px;
          font-family: var(--font-section); font-size: .62rem; font-weight: 800;
          letter-spacing: .12em;
          color: ${tema.cor};
          background: rgba(${tema.rgb},.12);
          border: 1px solid rgba(${tema.rgb},.4);
        }
        .dgc-stat {
          display: flex; align-items: center; gap: .5rem;
          padding: .45rem .6rem; border-radius: 10px;
          background: rgba(255,255,255,.03);
          border: 1px solid rgba(255,255,255,.06);
          font-size: .78rem;
        }
        .dgc-stat-label { color: var(--text-muted); font-size: .65rem; font-family: var(--font-section); letter-spacing: .08em; }
        .dgc-stat-val   { color: var(--text-primary); font-weight: 700; margin-left: auto; }
        .dgc-shimmer-title {
          background: linear-gradient(90deg, ${tema.cor} 0%, #fff 40%, ${tema.cor} 60%, ${tema.cor} 100%);
          background-size: 200% auto;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          animation: dgc-shimmer 3s linear 1s infinite;
        }
        .dgc-btn-fechar {
          font-family: var(--font-section); font-size: .75rem; font-weight: 700;
          letter-spacing: .08em; padding: .65rem 2rem; border-radius: 12px;
          cursor: pointer; border: 1.5px solid rgba(${tema.rgb},.5);
          color: ${tema.cor}; background: rgba(${tema.rgb},.1);
          transition: all .2s;
        }
        .dgc-btn-fechar:hover {
          background: rgba(${tema.rgb},.22);
          box-shadow: 0 0 16px rgba(${tema.rgb},.4);
        }
      </style>

      <div id="dg-criacao-card">
        <div class="dgc-scan-line"></div>

        <!-- Cabeçalho com cor do rank -->
        <div style="background:linear-gradient(135deg, rgba(${tema.rgb},.18) 0%, transparent 60%); padding: 1.5rem 1.5rem 1rem; border-bottom: 1px solid rgba(${tema.rgb},.2)">
          <div style="display:flex; align-items:center; gap:.75rem; margin-bottom:.75rem">
            <!-- Ícone animado -->
            <div style="width:64px;height:64px;flex-shrink:0;display:flex;align-items:center;justify-content:center;
              background:rgba(${tema.rgb},.1);border:1.5px solid rgba(${tema.rgb},.4);border-radius:16px;
              font-size:2rem; animation: dgc-icone-pop .5s cubic-bezier(.34,1.56,.64,1) .3s both">
              ${payload.icone || '🌀'}
            </div>
            <div style="flex:1; min-width:0">
              <div style="font-family:var(--font-section);font-size:.58rem;letter-spacing:.18em;color:rgba(${tema.rgb},1);margin-bottom:.25rem">PORTÃO FORJADO</div>
              <div class="dgc-shimmer-title" style="font-family:var(--font-title);font-size:1.15rem;font-weight:900;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                ${payload.titulo}
              </div>
              <div style="margin-top:.4rem;display:flex;gap:.4rem;flex-wrap:wrap">
                <span class="dgc-rank-badge">★ ${tema.label}</span>
                <span style="color:var(--text-muted);font-size:.72rem">${DIFI_LABEL[payload.dificuldade] || payload.dificuldade}</span>
              </div>
            </div>
          </div>
          ${payload.descricao ? `<div style="font-size:.78rem;color:var(--text-secondary);font-style:italic;line-height:1.5;padding:.6rem .8rem;background:rgba(0,0,0,.25);border-radius:8px;border-left:2px solid rgba(${tema.rgb},.4)">${payload.descricao}</div>` : ''}
        </div>

        <!-- Stats grid -->
        <div style="padding:1rem 1.5rem; display:grid; grid-template-columns:1fr 1fr; gap:.5rem">
          <div class="dgc-stat">
            <span>✨</span>
            <span class="dgc-stat-label">XP ao completar</span>
            <span class="dgc-stat-val" style="color:${tema.cor}">${xpTxt}</span>
          </div>
          <div class="dgc-stat">
            <span>🪙</span>
            <span class="dgc-stat-label">Moedas ao completar</span>
            <span class="dgc-stat-val" style="color:#fbbf24">${mcTxt}</span>
          </div>
          <div class="dgc-stat">
            <span>🏷</span>
            <span class="dgc-stat-label">Categoria</span>
            <span class="dgc-stat-val">${payload.categoria || '—'}</span>
          </div>
          <div class="dgc-stat">
            <span>♾️</span>
            <span class="dgc-stat-label">Permanência</span>
            <span class="dgc-stat-val">${PERM_LABEL[payload.tipo_permanencia] || payload.tipo_permanencia || '—'}</span>
          </div>
          ${horaStr ? `
          <div class="dgc-stat" style="grid-column:span 2">
            <span>⏰</span>
            <span class="dgc-stat-label">Janela de horário</span>
            <span class="dgc-stat-val">${horaStr}</span>
          </div>` : ''}
          ${nMiss > 0 ? `
          <div class="dgc-stat" style="grid-column:span 2; border-color:rgba(${tema.rgb},.2)">
            <span>📜</span>
            <span class="dgc-stat-label">Missões internas</span>
            <span class="dgc-stat-val" style="color:${tema.cor}">${nMiss} miss${nMiss !== 1 ? 'ões' : 'ão'} carregada${nMiss !== 1 ? 's' : ''}</span>
          </div>` : ''}
        </div>

        <!-- Rodapé -->
        <div style="padding:.85rem 1.5rem 1.25rem; text-align:center; border-top:1px solid rgba(${tema.rgb},.12)">
          <div style="font-family:var(--font-section);font-size:.6rem;letter-spacing:.12em;color:var(--text-dim);margin-bottom:.75rem">
            O PORTÃO AGORA EXISTE NO SISTEMA
          </div>
          <button class="dgc-btn-fechar" onclick="document.getElementById('dg-criacao-confirm').remove()">
            ⚔ ENTRAR NO PORTÃO
          </button>
        </div>
      </div>`;

    document.body.appendChild(ov);
    // Fade-in
    requestAnimationFrame(() => { ov.style.opacity = '1'; });
    // Som de abertura de portão
    if (typeof SFX !== 'undefined') SFX.play('carimbo');
    // Fechar ao clicar fora do card
    ov.addEventListener('click', e => {
      if (e.target === ov) ov.remove();
    });
    // Auto-fechar em 18s
    setTimeout(() => ov?.remove(), 18000);
  },

};

window.Dungeons = Dungeons;
