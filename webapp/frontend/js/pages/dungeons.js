/* ============================================================
   dungeons.js — Aba Dungeons (Portões)
   Grid de portões + Forja (modal de criação/edição + missões)
   O interior imersivo vive em dungeon-interior.js
   ============================================================ */

const Dungeons = {
  _lista: [],
  _editando: null,      // dungeon em edição (null = criando)
  _missoesTmp: [],      // missões acumuladas durante a criação

  CATEGORIAS: ['Trabalho', 'Saúde', 'Estudo', 'Casa', 'Pessoal', 'Combate'],
  RANKS: ['E', 'D', 'C', 'B', 'A', 'S'],
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
     FORJA DE PORTÕES — modal de criação/edição
     ══════════════════════════════════════════════════════════ */
  abrirForja(dungeon) {
    this._editando  = dungeon;
    this._missoesTmp = dungeon ? (dungeon.missoes || []).slice() : [];
    this._garantirModal();

    const bd = document.getElementById('dg-modal-backdrop');
    document.getElementById('dg-forja-titulo').textContent =
      dungeon ? `Reforjar: ${dungeon.titulo}` : 'Forjar Novo Portão';

    // Preenche campos
    const v = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    v('dgf-titulo',      dungeon?.titulo);
    v('dgf-descricao',   dungeon?.descricao);
    v('dgf-icone',       dungeon?.icone || '🌀');
    v('dgf-categoria',   dungeon?.categoria || 'Trabalho');
    v('dgf-rank',        dungeon?.rank || 'E');
    v('dgf-dificuldade', dungeon?.dificuldade || 'NORMAL');
    v('dgf-permanencia', dungeon?.tipo_permanencia || 'PERMANENTE');
    v('dgf-recorrencia', dungeon?.tipo_recorrencia || 'DIARIA');
    v('dgf-dia-mes',     dungeon?.dia_mes);
    v('dgf-mes-dia',     dungeon?.mes_dia);
    v('dgf-data-inicio', dungeon?.data_inicio);
    v('dgf-data-fim',    dungeon?.data_fim);
    v('dgf-hora-entrada',dungeon?.hora_entrada);
    v('dgf-hora-saida',  dungeon?.hora_saida);
    v('dgf-tolerancia',  dungeon?.tolerancia_min ?? 10);
    v('dgf-xp-entrada',  dungeon?.xp_entrada ?? '');
    v('dgf-xp-clear',    dungeon?.xp_clear ?? '');
    v('dgf-moedas-clear',dungeon?.moedas_clear ?? '');
    v('dgf-pen-entrada', dungeon?.penalidade_entrada_xp ?? '');
    v('dgf-pen-atraso',  dungeon?.penalidade_atraso_xp ?? '');

    // Dias da semana
    const dias = dungeon?.dias_semana || [0, 1, 2, 3, 4];
    document.querySelectorAll('#dgf-dias .dg-dia').forEach(b => {
      b.classList.toggle('on', dias.includes(parseInt(b.dataset.dia)));
    });

    // Agenda semanal + folgas
    this._preencherAgenda(dungeon?.agenda_semanal || null);
    this._folgasTmp = (dungeon?.folgas || []).slice();
    this._renderFolgas();

    this._toggleCamposRecorrencia();
    this._atualizarCamposNatureza();
    this._renderMissoesForja();
    bd.classList.add('visible');
  },

  _fecharForja() {
    document.getElementById('dg-modal-backdrop')?.classList.remove('visible');
    this._editando = null;
    this._missoesTmp = [];
  },

  _toggleCamposRecorrencia() {
    const perm  = document.getElementById('dgf-permanencia')?.value;
    const recor = document.getElementById('dgf-recorrencia')?.value;
    const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
    const isPerm = perm === 'PERMANENTE';
    show('dgf-wrap-recorrencia', isPerm);
    show('dgf-wrap-dias',        isPerm && recor === 'SEMANAL');
    show('dgf-wrap-dia-mes',     isPerm && recor === 'MENSAL');
    show('dgf-wrap-mes-dia',     isPerm && recor === 'ANUAL');
    show('dgf-wrap-data-inicio', !isPerm);
    show('dgf-wrap-data-fim',    !isPerm);
  },

  /* ── Missões dentro da forja ──────────────────────────── */
  _renderMissoesForja() {
    const cont = document.getElementById('dgf-missoes');
    if (!cont) return;
    if (!this._missoesTmp.length) {
      cont.innerHTML = '<div style="font-size:.75rem;color:var(--text-muted);padding:.4rem 0">Nenhuma missão ainda — o quadro desta Dungeon está vazio.</div>';
      return;
    }
    const natIco = { PADRAO: '⚔️', AGENDADA: '🕒', RESISTENCIA: '⏳', EVENTO_ALEATORIO: '⚡', BEM_ESTAR: '💧', FLAVOR: '👁' };
    cont.innerHTML = this._missoesTmp.map((m, i) => {
      const extras = [];
      if (m.natureza === 'AGENDADA' && (m.hora_inicio || m.hora_limite))
        extras.push(`🕒 ${m.hora_inicio || '--:--'}→${m.hora_limite || '--:--'}`);
      if (m.dias_semana && m.dias_semana.length && m.dias_semana.length < 7)
        extras.push(m.dias_semana.map(x => this.DIAS_LBL[x]).join(','));
      return `
      <div class="dg-missao-row">
        <span>${m.icone || natIco[m.natureza] || '⚔️'}</span>
        <span class="titulo">${m.titulo}${extras.length ? ` <span style="font-size:.65rem;color:var(--text-muted)">(${extras.join(' · ')})</span>` : ''}</span>
        <span class="nat">${natIco[m.natureza] || ''} ${m.natureza}</span>
        <span class="xp">${m.natureza === 'FLAVOR' ? '—' : '+' + m.xp_recompensa + ' XP'}</span>
        <button class="dg-btn-ico danger" data-dgm-rm="${i}" style="width:28px;height:28px;font-size:.75rem">✕</button>
      </div>`;
    }).join('');
    cont.querySelectorAll('[data-dgm-rm]').forEach(b =>
      b.addEventListener('click', () => this._removerMissao(parseInt(b.dataset.dgmRm))));
  },

  async _removerMissao(idx) {
    const m = this._missoesTmp[idx];
    if (this._editando && m.id) {
      try { await API.dungeons.deletarMissao(m.id); }
      catch (err) { SoloDialog.toast('Erro: ' + (err.message || err), 'error'); return; }
    }
    this._missoesTmp.splice(idx, 1);
    this._renderMissoesForja();
  },

  async _adicionarMissao() {
    const g = id => document.getElementById(id);
    const titulo = g('dgfm-titulo').value.trim();
    if (!titulo) { SoloDialog.toast('Dê um nome à missão.', 'error'); return; }
    const nat = g('dgfm-natureza').value;
    const diasMissao = [...document.querySelectorAll('#dgfm-dias .dg-dia.on')].map(b => parseInt(b.dataset.dia));
    const missao = {
      titulo,
      icone:              g('dgfm-icone').value || '⚔️',
      natureza:           nat,
      tipo:               (nat === 'PADRAO' || nat === 'AGENDADA') ? 'ATIVA' : 'PASSIVA',
      xp_recompensa:      parseInt(g('dgfm-xp').value) || 30,
      moedas_recompensa:  parseInt(g('dgfm-moedas').value) || 3,
      penalidade_xp:      g('dgfm-pen').value === '' ? null : (parseInt(g('dgfm-pen').value) || 0),
      meta_minutos:       nat === 'RESISTENCIA'      ? (parseInt(g('dgfm-param1').value) || 60) : null,
      intervalo_min:      nat === 'BEM_ESTAR'        ? (parseInt(g('dgfm-param1').value) || 45) : null,
      janela_disparo_min: nat === 'EVENTO_ALEATORIO' ? (parseInt(g('dgfm-param1').value) || 20) : null,
      janela_disparo_max: nat === 'EVENTO_ALEATORIO' ? (parseInt(g('dgfm-param2').value) || 60) : null,
      expira_em_min:      parseInt(g('dgfm-expira').value) || 5,
      dias_semana:        diasMissao.length ? diasMissao : null,
      hora_inicio:        nat === 'AGENDADA' ? (g('dgfm-hora-inicio').value || null) : null,
      hora_limite:        nat === 'AGENDADA' ? (g('dgfm-hora-limite').value || null) : null,
    };
    if (this._editando) {
      try {
        const criada = await API.dungeons.criarMissao(this._editando.id, missao);
        this._missoesTmp.push(criada);
      } catch (err) { SoloDialog.toast('Erro: ' + (err.message || err), 'error'); return; }
    } else {
      this._missoesTmp.push(missao);
    }
    g('dgfm-titulo').value = '';
    document.querySelectorAll('#dgfm-dias .dg-dia.on').forEach(b => b.classList.remove('on'));
    this._renderMissoesForja();
  },

  _atualizarCamposNatureza() {
    const nat = document.getElementById('dgfm-natureza')?.value;
    const p1 = document.getElementById('dgfm-wrap-param1');
    const p2 = document.getElementById('dgfm-wrap-param2');
    const l1 = document.getElementById('dgfm-lbl-param1');
    const xp = document.getElementById('dgfm-wrap-xp');
    const hi = document.getElementById('dgfm-wrap-hinicio');
    const hl = document.getElementById('dgfm-wrap-hlimite');
    const ex = document.getElementById('dgfm-wrap-expira');
    if (!p1) return;
    p1.style.display = 'none'; p2.style.display = 'none';
    if (hi) hi.style.display = 'none';
    if (hl) hl.style.display = 'none';
    if (ex) ex.style.display = (nat === 'EVENTO_ALEATORIO' || nat === 'BEM_ESTAR') ? '' : 'none';
    xp.style.display = nat === 'FLAVOR' ? 'none' : '';
    if (nat === 'RESISTENCIA')      { p1.style.display = ''; l1.textContent = 'Meta (minutos)'; }
    if (nat === 'BEM_ESTAR')        { p1.style.display = ''; l1.textContent = 'A cada (min)'; }
    if (nat === 'EVENTO_ALEATORIO') { p1.style.display = ''; p2.style.display = ''; l1.textContent = 'Janela mín (min)'; }
    if (nat === 'AGENDADA')         { if (hi) hi.style.display = ''; if (hl) hl.style.display = ''; }
  },

  /* ── Salvar ───────────────────────────────────────────── */
  async _salvar() {
    const g = id => document.getElementById(id);
    const titulo = g('dgf-titulo').value.trim();
    if (!titulo) { SoloDialog.toast('O portão precisa de um nome.', 'error'); return; }

    const perm = g('dgf-permanencia').value;
    const dias = [...document.querySelectorAll('#dgf-dias .dg-dia.on')].map(b => parseInt(b.dataset.dia));
    const num  = id => { const x = g(id).value; return x === '' ? null : parseInt(x); };

    const payload = {
      titulo,
      descricao:        g('dgf-descricao').value.trim() || null,
      icone:            g('dgf-icone').value || '🌀',
      categoria:        g('dgf-categoria').value,
      rank:             g('dgf-rank').value,
      dificuldade:      g('dgf-dificuldade').value,
      tipo_permanencia: perm,
      tipo_recorrencia: g('dgf-recorrencia').value,
      dias_semana:      dias,
      dia_mes:          num('dgf-dia-mes'),
      mes_dia:          g('dgf-mes-dia').value || null,
      data_inicio:      perm === 'TEMPORARIA' ? (g('dgf-data-inicio').value || null) : null,
      data_fim:         perm === 'TEMPORARIA' ? (g('dgf-data-fim').value || null) : null,
      hora_entrada:     g('dgf-hora-entrada').value || null,
      hora_saida:       g('dgf-hora-saida').value || null,
      tolerancia_min:   parseInt(g('dgf-tolerancia').value) || 0,
      xp_entrada:            num('dgf-xp-entrada'),
      xp_clear:              num('dgf-xp-clear'),
      moedas_clear:          num('dgf-moedas-clear'),
      penalidade_entrada_xp: num('dgf-pen-entrada'),
      penalidade_atraso_xp:  num('dgf-pen-atraso'),
      agenda_semanal:        this._coletarAgenda(),
      folgas:                this._folgasTmp.slice(),
    };

    try {
      if (this._editando) {
        await API.dungeons.atualizar(this._editando.id, payload);
        SoloDialog.toast('⚒️ Portão reforjado.', 'success');
        this._fecharForja();
        await this.carregar();
      } else {
        payload.missoes = this._missoesTmp;
        const result = await API.dungeons.criar(payload);
        this._fecharForja();
        await this.carregar();
        this._mostrarConfirmacaoCriacao(payload, result);
      }
    } catch (err) {
      SoloDialog.toast('Erro ao forjar: ' + (err.message || err), 'error');
    }
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
            <span class="dgc-stat-val" style="color:${tema.cor}">${nMiss} missão${nMiss !== 1 ? 'ões' : ''} carregada${nMiss !== 1 ? 's' : ''}</span>
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

  /* ── Constrói o modal uma única vez ───────────────────── */
  _garantirModal() {
    if (document.getElementById('dg-modal-backdrop')) return;

    const catOpts = this.CATEGORIAS.map(c => `<option value="${c}">${c}</option>`).join('');
    const rankOpts = this.RANKS.map(r => `<option value="${r}">Rank ${r}</option>`).join('');
    const natOpts = this.NATUREZAS.map(n => `<option value="${n.v}">${n.t}</option>`).join('');
    const diasLbl = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

    const el = document.createElement('div');
    el.id = 'dg-modal-backdrop';
    el.className = 'dg-modal-backdrop';
    el.innerHTML = `
    <div class="dg-modal">
      <h2 id="dg-forja-titulo">Forjar Novo Portão</h2>
      <div class="dg-modal-sub">Um ambiente isolado, com regras e missões próprias. Nada aqui toca suas rotinas.</div>

      <div class="dg-form-grid">
        <div class="dg-field full"><label>Nome do Portão</label>
          <input id="dgf-titulo" placeholder="Ex.: Trabalho CLT, Templo do Estudo..."></div>
        <div class="dg-field full"><label>Lore / Descrição</label>
          <textarea id="dgf-descricao" placeholder="A história deste lugar... (aparece dentro da Dungeon)"></textarea></div>

        <div class="dg-field"><label>Ícone</label><input id="dgf-icone" maxlength="4" value="🌀"></div>
        <div class="dg-field"><label>Categoria (tema visual)</label><select id="dgf-categoria">${catOpts}</select></div>
        <div class="dg-field"><label>Rank do Portão</label><select id="dgf-rank">${rankOpts}</select></div>
        <div class="dg-field"><label>Dificuldade</label>
          <select id="dgf-dificuldade">
            <option value="FACIL">Fácil</option><option value="NORMAL" selected>Normal</option>
            <option value="DIFICIL">Difícil</option><option value="LENDARIO">Lendário</option>
          </select></div>

        <div class="dg-field"><label>Permanência</label>
          <select id="dgf-permanencia">
            <option value="PERMANENTE">Permanente (recorrente)</option>
            <option value="TEMPORARIA">Temporária (uma janela)</option>
          </select></div>
        <div class="dg-field" id="dgf-wrap-recorrencia"><label>Recorrência</label>
          <select id="dgf-recorrencia">
            <option value="DIARIA">Diária</option><option value="SEMANAL">Semanal</option>
            <option value="MENSAL">Mensal</option><option value="ANUAL">Anual</option>
          </select></div>

        <div class="dg-field full" id="dgf-wrap-dias"><label>Dias da semana</label>
          <div class="dg-dias" id="dgf-dias">
            ${diasLbl.map((d, i) => `<span class="dg-dia" data-dia="${i}">${d}</span>`).join('')}
          </div></div>
        <div class="dg-field" id="dgf-wrap-dia-mes" style="display:none"><label>Dia do mês</label>
          <input id="dgf-dia-mes" type="number" min="1" max="31"></div>
        <div class="dg-field" id="dgf-wrap-mes-dia" style="display:none"><label>Data anual (MM-DD)</label>
          <input id="dgf-mes-dia" placeholder="07-16"></div>
        <div class="dg-field" id="dgf-wrap-data-inicio" style="display:none"><label>Início</label>
          <input id="dgf-data-inicio" type="date"></div>
        <div class="dg-field" id="dgf-wrap-data-fim" style="display:none"><label>Fim</label>
          <input id="dgf-data-fim" type="date"></div>

        <div class="dg-field"><label>Hora de entrada padrão (check-in)</label><input id="dgf-hora-entrada" type="time"></div>
        <div class="dg-field"><label>Hora de saída padrão</label><input id="dgf-hora-saida" type="time"></div>
        <div class="dg-field"><label>Tolerância (min)</label><input id="dgf-tolerancia" type="number" min="0" value="10"></div>

        <!-- Agenda semanal: fechado/horários por dia -->
        <div class="dg-field full">
          <label>Agenda semanal <span style="opacity:.5;text-transform:none">(por dia: aberto/fechado e horários próprios — vazio usa o padrão)</span></label>
          <div id="dgf-agenda" style="display:flex;flex-direction:column;gap:.3rem">
            ${['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map((lbl, i) => `
            <div style="display:flex;align-items:center;gap:.5rem" data-agenda-dia="${i}">
              <span class="dg-dia on" data-ag-toggle="${i}" style="width:44px" title="Clique para abrir/fechar este dia">${lbl}</span>
              <input type="time" data-ag-entrada="${i}" style="flex:1;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:8px;padding:.35rem .5rem;color:var(--text-primary);font-size:.8rem" title="Entrada neste dia (vazio = padrão)">
              <span style="color:var(--text-muted);font-size:.7rem">→</span>
              <input type="time" data-ag-saida="${i}" style="flex:1;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:8px;padding:.35rem .5rem;color:var(--text-primary);font-size:.8rem" title="Saída neste dia (vazio = padrão)">
            </div>`).join('')}
          </div>
        </div>

        <!-- Folgas programadas -->
        <div class="dg-field full">
          <label>Folgas programadas <span style="opacity:.5;text-transform:none">(datas em que o portão não abre — folga do domingo, feriado, etc.)</span></label>
          <div style="display:flex;gap:.5rem;align-items:center">
            <input type="date" id="dgf-folga-data" style="max-width:180px">
            <button type="button" class="dg-btn-ico" id="dgf-folga-add" title="Adicionar folga" style="width:auto;padding:0 .8rem">+ Folga</button>
          </div>
          <div id="dgf-folgas-lista" style="display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.5rem"></div>
        </div>
        <div class="dg-field"><label>XP de entrada <span style="opacity:.5">(vazio = auto)</span></label><input id="dgf-xp-entrada" type="number" min="0" placeholder="auto"></div>
        <div class="dg-field"><label>XP de clear</label><input id="dgf-xp-clear" type="number" min="0" placeholder="auto"></div>
        <div class="dg-field"><label>Moedas de clear</label><input id="dgf-moedas-clear" type="number" min="0" placeholder="auto"></div>
        <div class="dg-field"><label>Penalidade no-show (XP)</label><input id="dgf-pen-entrada" type="number" min="0" placeholder="auto"></div>
        <div class="dg-field"><label>Penalidade atraso (XP)</label><input id="dgf-pen-atraso" type="number" min="0" placeholder="auto"></div>
      </div>

      <!-- Missões -->
      <div style="margin-top:1.3rem;padding-top:1rem;border-top:1px solid var(--border-subtle)">
        <div style="font-family:var(--font-section);font-size:.78rem;letter-spacing:.14em;text-transform:uppercase;color:var(--text-secondary);margin-bottom:.6rem">
          🗡 Quadro de Missões da Dungeon
        </div>
        <div class="dg-form-grid">
          <div class="dg-field"><label>Título da missão</label><input id="dgfm-titulo" placeholder="Ex.: Entregar relatório"></div>
          <div class="dg-field"><label>Natureza</label><select id="dgfm-natureza">${natOpts}</select></div>
          <div class="dg-field"><label>Ícone</label><input id="dgfm-icone" maxlength="4" placeholder="⚔️"></div>
          <div class="dg-field" id="dgfm-wrap-xp"><label>XP / Moedas</label>
            <div style="display:flex;gap:.4rem">
              <input id="dgfm-xp" type="number" min="0" value="30" style="flex:1">
              <input id="dgfm-moedas" type="number" min="0" value="3" style="flex:1">
            </div></div>
          <div class="dg-field" id="dgfm-wrap-pen"><label>Penalidade se falhar <span style="opacity:.5">(vazio = 50% do XP)</span></label>
            <input id="dgfm-pen" type="number" min="0" placeholder="auto"></div>
          <div class="dg-field" id="dgfm-wrap-param1" style="display:none"><label id="dgfm-lbl-param1">Parâmetro</label>
            <input id="dgfm-param1" type="number" min="1" value="60"></div>
          <div class="dg-field" id="dgfm-wrap-param2" style="display:none"><label>Janela máx (min)</label>
            <input id="dgfm-param2" type="number" min="1" value="60"></div>
          <div class="dg-field" id="dgfm-wrap-expira"><label>Evento expira em (min)</label><input id="dgfm-expira" type="number" min="1" value="5"></div>
          <div class="dg-field" id="dgfm-wrap-hinicio" style="display:none"><label>Abre às</label>
            <input id="dgfm-hora-inicio" type="time"></div>
          <div class="dg-field" id="dgfm-wrap-hlimite" style="display:none"><label>Prazo até</label>
            <input id="dgfm-hora-limite" type="time"></div>
          <div class="dg-field full"><label>Dias da missão <span style="opacity:.5;text-transform:none">(nenhum marcado = todos os dias da dungeon)</span></label>
            <div class="dg-dias" id="dgfm-dias">
              ${['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map((d2, i) => `<span class="dg-dia" data-dia="${i}">${d2}</span>`).join('')}
            </div></div>
          <div class="dg-field" style="display:flex;align-items:flex-end">
            <button class="dg-btn-entrar" id="dgfm-add" style="padding:.55rem">+ Adicionar Missão</button></div>
        </div>
        <div class="dg-missoes-lista" id="dgf-missoes"></div>
      </div>

      <div class="dg-modal-footer">
        <button class="btn btn-ghost btn-sm" id="dgf-cancelar">Cancelar</button>
        <button class="dg-btn-entrar" id="dgf-salvar" style="flex:0 0 auto;padding:.6rem 1.6rem">⚒️ Forjar Portão</button>
      </div>
    </div>`;
    document.body.appendChild(el);

    // Bind estáticos
    el.addEventListener('click', e => { if (e.target === el) this._fecharForja(); });
    document.getElementById('dgf-cancelar').addEventListener('click', () => this._fecharForja());
    document.getElementById('dgf-salvar').addEventListener('click', () => this._salvar());
    document.getElementById('dgfm-add').addEventListener('click', () => this._adicionarMissao());
    document.getElementById('dgf-permanencia').addEventListener('change', () => this._toggleCamposRecorrencia());
    document.getElementById('dgf-recorrencia').addEventListener('change', () => this._toggleCamposRecorrencia());
    document.getElementById('dgfm-natureza').addEventListener('change', () => this._atualizarCamposNatureza());
    document.querySelectorAll('#dgf-dias .dg-dia').forEach(b =>
      b.addEventListener('click', () => b.classList.toggle('on')));
    document.querySelectorAll('#dgfm-dias .dg-dia').forEach(b =>
      b.addEventListener('click', () => b.classList.toggle('on')));
    document.querySelectorAll('[data-ag-toggle]').forEach(b =>
      b.addEventListener('click', () => {
        b.classList.toggle('on');
        const linha = b.closest('[data-agenda-dia]');
        linha.querySelectorAll('input').forEach(inp => inp.disabled = !b.classList.contains('on'));
        linha.style.opacity = b.classList.contains('on') ? '1' : '.4';
      }));
    // Seletores de ícone (dungeon e missão)
    this._bindIconPicker('dgf-icone');
    this._bindIconPicker('dgfm-icone');

    document.getElementById('dgf-folga-add').addEventListener('click', () => {
      const inp = document.getElementById('dgf-folga-data');
      if (!inp.value) return;
      if (!this._folgasTmp.includes(inp.value)) this._folgasTmp.push(inp.value);
      inp.value = '';
      this._renderFolgas();
    });
  },

  _folgasTmp: [],

  _renderFolgas() {
    const cont = document.getElementById('dgf-folgas-lista');
    if (!cont) return;
    this._folgasTmp.sort();
    cont.innerHTML = this._folgasTmp.length
      ? this._folgasTmp.map((f, i) => {
          const [a, m, dd] = f.split('-');
          return `<span class="dg-chip" style="display:inline-flex;align-items:center;gap:.35rem">🏖 ${dd}/${m}/${a}
            <span data-folga-rm="${i}" style="cursor:pointer;color:var(--red-crit);font-weight:700">✕</span></span>`;
        }).join('')
      : '<span style="font-size:.72rem;color:var(--text-muted)">Nenhuma folga programada.</span>';
    cont.querySelectorAll('[data-folga-rm]').forEach(x =>
      x.addEventListener('click', () => { this._folgasTmp.splice(parseInt(x.dataset.folgaRm), 1); this._renderFolgas(); }));
  },

  _preencherAgenda(agenda) {
    // agenda = {"1":{"aberto":true,"entrada":"08:00","saida":"17:30"},"2":{"aberto":false}} ou null
    for (let i = 0; i < 7; i++) {
      const cfg = agenda?.[String(i)];
      const tog = document.querySelector(`[data-ag-toggle="${i}"]`);
      const ent = document.querySelector(`[data-ag-entrada="${i}"]`);
      const sai = document.querySelector(`[data-ag-saida="${i}"]`);
      const aberto = !cfg || cfg.aberto !== false;
      tog.classList.toggle('on', aberto);
      ent.value = cfg?.entrada || '';
      sai.value = cfg?.saida || '';
      ent.disabled = !aberto; sai.disabled = !aberto;
      tog.closest('[data-agenda-dia]').style.opacity = aberto ? '1' : '.4';
    }
  },

  _coletarAgenda() {
    // Só inclui dias que diferem do padrão (fechado ou com horário próprio)
    const agenda = {};
    for (let i = 0; i < 7; i++) {
      const aberto = document.querySelector(`[data-ag-toggle="${i}"]`).classList.contains('on');
      const ent = document.querySelector(`[data-ag-entrada="${i}"]`).value;
      const sai = document.querySelector(`[data-ag-saida="${i}"]`).value;
      if (!aberto) agenda[String(i)] = { aberto: false };
      else if (ent || sai) agenda[String(i)] = { aberto: true, entrada: ent || null, saida: sai || null };
    }
    return Object.keys(agenda).length ? agenda : null;
  },
};

window.Dungeons = Dungeons;
