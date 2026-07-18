/* ============================================================
   dashboard.js \u2014 Solo Routines
   Carrega e renderiza o painel principal do Hunter
   ============================================================ */

const Dashboard = {
  _chartXP: null,
  _dadosCarregados: false,

  async carregar() {
    try {
      // Data de hoje formatada
      const hoje = new Date();
      const el = document.getElementById('dash-data');
      if (el) {
        el.textContent = hoje.toLocaleDateString('pt-BR', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
      }

      // Carrega dados em paralelo
      const [perfil, rotinasHoje, tarefasHoje, conquistas, dashStats] = await Promise.allSettled([
        API.auth.me(),
        API.rotinas.hoje(),
        API.tarefas.hoje(),
        API.conquistas.listar(),
        API.get('/dashboard/stats'),
      ]);

      // Perfil / personagem
      if (perfil.status === 'fulfilled' && perfil.value) {
        this.renderPersonagem(perfil.value);
      }

      // Rotinas de hoje
      const listaRotinas = rotinasHoje.status === 'fulfilled' ? (rotinasHoje.value || []) : [];
      this.renderRotinasHoje(listaRotinas);

      // Tarefas de hoje
      const listaTarefas = tarefasHoje.status === 'fulfilled' ? (tarefasHoje.value || []) : [];
      this.renderTarefasHoje(listaTarefas);

      // Stats (cards de contadores)
      if (dashStats.status === 'fulfilled' && dashStats.value) {
        this.renderStats(dashStats.value);
      } else {
        // Fallback: computa dos dados já carregados
        const concHoje = listaRotinas.filter(r => r.status_hoje === 'CONCLUIDA').length
                       + listaTarefas.filter(t => t.status  === 'CONCLUIDA').length;
        this.renderStats({
          execucoes_hoje:  concHoje,
          total_execucoes: 0,
          rotinas_ativas:  listaRotinas.filter(r => r.status_hoje === 'ATIVA').length,
        });
      }

      // Gráfico XP dos últimos 7 dias
      const xpSemana = (dashStats.status === 'fulfilled' && dashStats.value?.xp_semana)
        ? dashStats.value.xp_semana
        : [];
      this.renderGraficoXP(xpSemana);

      // Conquistas recentes
      const listaConq = conquistas.status === 'fulfilled' ? (conquistas.value || []) : [];
      this.renderConquistas(listaConq);

      this._dadosCarregados = true;
    } catch (err) {
      console.error('[Dashboard] Erro ao carregar:', err);
    }
  },

  // ── Cores por rank (Janela de Status) ──
  _RANK_CORES: {
    'E': '#94a3b8', 'D': '#22d3ee', 'C': '#10b981',
    'B': '#3b82f6', 'A': '#a855f7', 'S': '#fbbf24', 'N': '#fb7185',
  },

  _letraRank(classe) {
    const c = (classe || 'E-Rank').toUpperCase();
    if (c.includes('NATIONAL')) return 'N';
    const m = c.match(/\b([EDCBAS])\b|^([EDCBAS])-/);
    return (m && (m[1] || m[2])) || 'E';
  },

  // Contagem animada de números (Orbitron fica lindo contando)
  _contar(el, alvo, dur = 900) {
    if (!el) return;
    const ini = 0, t0 = performance.now();
    const passo = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(ini + (alvo - ini) * eased).toLocaleString('pt-BR');
      if (p < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  },

  // ── Relicário: as 3 últimas conquistas na Janela de Status ──
  async _renderRelicario() {
    const cont = document.getElementById('dash-relicario');
    if (!cont) return;
    try {
      const lista = await API.conquistas.listar();
      const desb = (lista || []).filter(c => c.desbloqueada).sort((a, b) => {
        if (a.desbloqueada_em && b.desbloqueada_em) return new Date(b.desbloqueada_em) - new Date(a.desbloqueada_em);
        return 0;
      }).slice(0, 8);   // cabe a coleção completa de comemorativas
      if (!desb.length) {
        cont.innerHTML = `<span class="hunter-relicario-lbl">Nenhuma relíquia ainda — cumpra missões</span>`;
        return;
      }
      const medalha = c => (typeof ConquistaFX !== 'undefined' && ConquistaFX.miniMedalha)
        ? ConquistaFX.miniMedalha(c, 34) : (c.icone || '🏆');
      cont.innerHTML = `<span class="hunter-relicario-lbl">Relíquias</span>` +
        desb.map(c => `<span class="hunter-reliquia" title="${c.titulo}${c.descricao ? ' — ' + c.descricao : ''}">${medalha(c)}</span>`).join('');
      cont.querySelectorAll('.hunter-reliquia').forEach(el =>
        el.addEventListener('click', () => window.App && App.navigate('perfil')));
    } catch (_) { /* silencioso */ }
  },

  // ── Chip: dungeon aberta agora ──
  async _renderChipDungeon() {
    const chip = document.getElementById('sys-dungeon-chip');
    if (!chip) return;
    try {
      const lista = await API.dungeons.listar();
      const abertas = (lista || []).filter(d =>
        d.devida_hoje && (!d.sessao_hoje || ['PENDENTE', 'ATIVA'].includes(d.sessao_hoje.status)));
      if (!abertas.length) { chip.style.display = 'none'; return; }
      const dentro = abertas.find(d => d.sessao_hoje?.status === 'ATIVA');
      const alvo = dentro || abertas[0];
      chip.textContent = dentro
        ? `⚔️ Você está em ${alvo.titulo}`
        : `🌀 ${abertas.length} portão${abertas.length > 1 ? 'es' : ''} aberto${abertas.length > 1 ? 's' : ''}`;
      chip.style.display = '';
      chip.onclick = () => window.App && App.navigate('dungeons');
    } catch (_) { chip.style.display = 'none'; }
  },

  // ── Sussurros do Sistema na placa ──
  _SUSSURROS_PLACA: [
    'O Sistema observa seu progresso',
    'Todo dia é uma chance de subir de rank',
    'Os fracos morrem, os fortes evoluem',
    'Seu potencial ainda não foi medido',
    'Nenhum portão se fecha para quem insiste',
    'A disciplina é a lâmina mais afiada',
    'Hunters comuns já teriam parado',
  ],

  _iniciarSussurros() {
    const el = document.getElementById('sys-whisper');
    if (!el || this._sussurroTimer) return;
    let i = 0;
    this._sussurroTimer = setInterval(() => {
      el.classList.add('trocando');
      setTimeout(() => {
        i = (i + 1) % this._SUSSURROS_PLACA.length;
        el.textContent = this._SUSSURROS_PLACA[i];
        el.classList.remove('trocando');
      }, 600);
    }, 9000);
  },

  // ── Partículas de mana dentro da Janela de Status ──
  _initFxJanela() {
    const canvas = document.getElementById('hunter-fx');
    if (!canvas || canvas.dataset.on) return;
    canvas.dataset.on = '1';
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0;
    const ajustar = () => {
      const r = canvas.getBoundingClientRect();
      W = canvas.width = r.width; H = canvas.height = r.height;
    };
    ajustar();
    window.addEventListener('resize', ajustar);

    const ps = Array.from({ length: 26 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.6 + .4,
      v: Math.random() * .00035 + .00012,
      a: Math.random() * .5 + .15,
    }));
    const loop = () => {
      if (!canvas.isConnected) return;
      ctx.clearRect(0, 0, W, H);
      const cor = getComputedStyle(document.getElementById('hunter-card'))
        .getPropertyValue('--rank-cor').trim() || '#a855f7';
      ps.forEach(p => {
        p.y -= p.v;
        if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
        ctx.fillStyle = cor;
        ctx.globalAlpha = p.a;
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      requestAnimationFrame(loop);
    };
    loop();
  },

  renderPersonagem(dados) {
    this._iniciarSussurros();
    this._initFxJanela();
    // Nome
    const elNome = document.getElementById('dash-nome');
    if (elNome) elNome.textContent = dados.nome || 'Hunter';

    const sbNome = document.getElementById('sidebar-nome');
    if (sbNome) sbNome.textContent = dados.nome || 'Hunter';

    // Titulo / classe
    const elTitulo = document.getElementById('dash-titulo');
    if (elTitulo) elTitulo.textContent = `"${dados.titulo || this._getTituloByRank(dados.rank)}"`;

    // ── Rank: colore a janela inteira ──
    const classe = dados.classe || dados.rank || 'E-Rank';
    const letra  = this._letraRank(classe);
    const cor    = this._RANK_CORES[letra] || '#a855f7';
    const janela = document.getElementById('hunter-card');
    if (janela) {
      janela.style.setProperty('--rank-cor', cor);
      janela.style.setProperty('--rank-aura', cor + '26');
    }
    const selo = document.getElementById('dash-rank-selo');
    if (selo) selo.textContent = letra;

    // Cristais com contagem animada
    this._contar(document.getElementById('dash-nivel'), dados.nivel_atual || dados.nivel || 1, 700);
    this._contar(document.getElementById('dash-moedas'), dados.moedas || 0);

    // Streak (chama apaga se zerado)
    const streak = dados.streak_atual || dados.streak_dias || 0;
    const elStreak = document.getElementById('dash-streak');
    if (elStreak) this._contar(elStreak, streak, 600);
    document.querySelector('.cristal-streak')?.classList.toggle('apagado', streak === 0);

    // XP
    const xpAtual  = dados.xp_atual   || 0;
    const xpProx   = dados.xp_proximo_nivel || dados.xp_proximo || 100;
    const pct      = Math.min(100, Math.round((xpAtual / xpProx) * 100));

    const elXPTxt = document.getElementById('dash-xp-txt');
    if (elXPTxt) elXPTxt.textContent = `${xpAtual.toLocaleString('pt-BR')} / ${xpProx.toLocaleString('pt-BR')} XP`;

    const elXPBar = document.getElementById('dash-xp-bar');
    if (elXPBar) setTimeout(() => { elXPBar.style.width = pct + '%'; }, 120);
    // Perto de subir (>=85%): a barra arde em ouro
    document.querySelector('.hunter-xp-track')?.classList.toggle('quase', pct >= 85);

    // Badges (rank textual + nível)
    const elRankBadge = document.getElementById('dash-rank-badge');
    if (elRankBadge) {
      const ehArq = dados.nivel_acesso === 'Arquiteto';
      elRankBadge.innerHTML = `
        <span style="font-family:var(--font-section);font-size:.68rem;font-weight:700;letter-spacing:.12em;
          padding:.2rem .7rem;border-radius:100px;color:${cor};
          border:1px solid ${cor}66;background:${cor}14">${classe}</span>
        ${ehArq ? `<span class="dg-badge-arquiteto" style="margin-left:0">★ ARQUITETO ★</span>` : ''}`;
    }

    // Relicário + chip de dungeon (extras da Janela de Status)
    this._renderRelicario();
    this._renderChipDungeon();

    // Sidebar rank
    const sbRank = document.getElementById('sidebar-rank');
    if (sbRank) {
      if (dados.nivel_acesso === 'Arquiteto') {
        sbRank.innerHTML = `<span style="color:#fbbf24;font-weight:700">&#9733; Arquiteto &#9733;</span>`;
      } else {
        sbRank.textContent = `${dados.classe || 'E-Rank'} \u2014 Nv.${dados.nivel_atual || 1}`;
      }
    }

    // Avatar (o do dashboard vive num hexágono — sem border-radius)
    if (dados.avatar_url) {
      const hex = document.getElementById('dash-avatar');
      if (hex) hex.innerHTML = `<img src="${dados.avatar_url}" alt="Avatar" style="width:100%;height:100%;object-fit:cover">`;
      const sb = document.getElementById('sidebar-avatar');
      if (sb) sb.innerHTML = `<img src="${dados.avatar_url}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    }
    // Aura de chamas do Arquiteto no hexágono
    if (dados.nivel_acesso === 'Arquiteto') {
      document.querySelector('.hunter-hex-wrap')?.classList.add('chamas-arquiteto');
    }

    // Botão Editar Perfil
    const btnEdit = document.getElementById('dash-btn-editar-perfil');
    if (btnEdit) {
      btnEdit.onclick = () => {
        if (window.App) App.navigate('perfil');
      };
    }

    // Reset de progresso: ação perigosa — mora na Forja de Testes (Ctrl+Alt+A),
    // fora do cabeçalho. Exposto aqui para a Forja consumir.
    window.__resetPerfilArquiteto = async () => {
      const ok = await SoloDialog.confirm(
        `Deseja RESETAR completamente o seu progresso?<br><span style="color:#94a3b8">Isso apagará nível, conquistas, moedas e XP!</span>`,
        { titulo: 'Resetar (Modo Arquiteto)', icon: '&#8635;', tipo: 'error', btnOk: 'Zerar Tudo', btnCancel: 'Cancelar' }
      );
      if (!ok) return;
      try {
        await API.post(`/gerencial/reset-perfil/${dados.id}`, {});
        SoloDialog.toast('Progresso zerado!', 'success');
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && key.startsWith('cq_seen_')) localStorage.removeItem(key);
        }
        setTimeout(() => { window.location.reload(); }, 800);
      } catch (err) {
        SoloDialog.toast('Erro ao resetar: ' + err.message, 'error');
      }
    };
  },

  renderStats(stats) {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set('stat-execucoes-hoje', stats.execucoes_hoje || 0);
    set('stat-total-exec',    stats.total_execucoes || 0);
    set('stat-rotinas-ativas',stats.rotinas_ativas  || 0);
  },

  _PRIOR_CORES_DASH: {
    CRITICA: { cor: '#ef4444', bg: 'rgba(239,68,68,.12)', label: '\uD83D\uDD34 CR\u00CDTICA' },
    ALTA:    { cor: '#f97316', bg: 'rgba(249,115,22,.12)', label: '\uD83D\uDFE0 ALTA'    },
    MEDIA:   { cor: '#f59e0b', bg: 'rgba(245,158,11,.12)', label: '\uD83D\uDFE1 M\u00C9DIA'   },
    BAIXA:   { cor: '#10b981', bg: 'rgba(16,185,129,.12)', label: '\uD83D\uDFE2 BAIXA'   },
  },

  _CAT_ICONS_DASH: { Saude:'\u2764\uFE0F', 'Sa\u00FAde':'\u2764\uFE0F', Trabalho:'\uD83D\uDCBC', Estudo:'\uD83D\uDCDA', Casa:'\uD83C\uDFE0', Pessoal:'\u26A1', Combate:'\u2694\uFE0F' },
  _dashTimer: null,
  _dashAutoCheck: null,
  _rodinasHojeLista: [],      // inst\u00E2ncias de hoje (com status_hoje)
  _todasRotinas:     [],      // todos os templates

  // \u2500\u2500 Tipo labels e \u00EDcones \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  _TIPO_CFG: {
    DIARIA:  { label: '\uD83C\uDF05 Di\u00E1ria',   cor: '#a855f7' },
    SEMANAL: { label: '\uD83D\uDCC6 Semanal',  cor: '#3b82f6' },
    MENSAL:  { label: '\uD83D\uDDD3 Mensal',   cor: '#06b6d4' },
    ANUAL:   { label: '\uD83C\uDFAF Anual',    cor: '#f59e0b' },
    AVULSA:  { label: '\u26A1 Avulsa',   cor: '#64748b' },
  },

  _STATUS_CFG_DASH: {
    PENDENTE:   { cor: '#a855f7', label: '\u23F3 N\u00E3o Iniciada' },
    ATIVA:      { cor: '#3b82f6', label: '\u25B6 Em Curso'      },
    CONCLUIDA:  { cor: '#10b981', label: '\u2713 Conclu\u00EDda'     },
    FRACASSADA: { cor: '#ef4444', label: '\u2620 Fracassada'    },
    CANCELADA:  { cor: '#64748b', label: '\u2715 Cancelada'     },
    PAUSADA:    { cor: '#94a3b8', label: '\u23F8 Pausada'       },
  },

  // \u2500\u2500 Carregar extrato com filtros \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  async carregarExtrato() {
    const periodo   = document.getElementById('filtro-periodo')?.value   || 'hoje';
    const tipo      = document.getElementById('filtro-tipo')?.value      || '';
    const categoria = document.getElementById('filtro-categoria')?.value || '';
    const statusFil = document.getElementById('filtro-status-missao')?.value || '';

    const cont    = document.getElementById('lista-rotinas-hoje');
    const countEl = document.getElementById('rotinas-count');
    if (!cont) return;

    cont.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--text-muted);font-family:var(--font-section);font-size:.75rem">\u23F3 Carregando...</div>';

    try {
      let lista = [];

      if (periodo === 'hoje') {
        // Hoje: usa /rotinas/hoje que traz status_hoje
        const hojeList = await API.get('/rotinas/hoje');
        this._rodinasHojeLista = hojeList || [];
        lista = [...this._rodinasHojeLista];
      } else {
        // Outros per\u00EDodos: lista todos e filtra por tipo correspondente
        const tipoMap = { semana: 'SEMANAL', mes: 'MENSAL', ano: 'ANUAL' };
        const tipoReq = tipoMap[periodo] || '';
        const q = tipoReq ? `?tipo=${tipoReq}` : '/';
        const todasResp = await API.get('/rotinas/' + (tipoReq ? `?tipo=${tipoReq}` : ''));
        this._todasRotinas = todasResp || [];
        // Para per\u00EDodos n\u00E3o-hoje, n\u00E3o temos exec_dia; mostramos como template
        lista = this._todasRotinas.map(r => ({ ...r, status_hoje: r.status_hoje || 'PENDENTE' }));
      }

      // Aplicar filtros locais
      if (tipo)      lista = lista.filter(r => r.tipo === tipo);
      if (categoria) lista = lista.filter(r => (r.categoria||'').toLowerCase() === categoria.toLowerCase() ||
                                               r.categoria === categoria);
      if (statusFil) lista = lista.filter(r => (r.status_hoje || 'PENDENTE') === statusFil);

      // Atualiza contador
      const naoFinal = lista.filter(r => !['CONCLUIDA','FRACASSADA','CANCELADA'].includes(r.status_hoje)).length;
      if (countEl) {
        const total = lista.length;
        countEl.textContent = `${total} miss\u00E3o${total !== 1 ? '\u00F5es' : ''} \u00B7 ${naoFinal} pendente${naoFinal !== 1 ? 's' : ''}`;
      }

      this._renderExtrato(lista, cont);
    } catch (err) {
      cont.innerHTML = `<div class="empty-state"><div class="empty-icon">\u26A0\uFE0F</div><div>${err.message||'Erro ao carregar'}</div></div>`;
    }
  },

  _renderExtrato(lista, cont) {
    // ── Ocultar concluídas (persistente) ───────────────────────
    const ocultar = localStorage.getItem('sr_ocultar_concluidas_extrato') === 'true';
    const toggle  = document.getElementById('toggle-ocultar-extrato');
    if (toggle) toggle.checked = ocultar;

    const FINAIS = ['CONCLUIDA', 'FRACASSADA', 'CANCELADA'];
    if (ocultar) lista = lista.filter(r => !FINAIS.includes(r.status_hoje || 'PENDENTE'));

    if (!lista.length) {
      cont.innerHTML = '<div class="empty-state"><div class="empty-icon">\uD83D\uDCCB</div><div>Nenhuma miss\u00E3o encontrada com esses filtros</div></div>';
      return;
    }

    // ── Ordenação: sem filtro → ATIVA primeiro; com filtro → filtro manda ──
    const temFiltro = !!(
      document.getElementById('filtro-tipo')?.value ||
      document.getElementById('filtro-categoria')?.value ||
      document.getElementById('filtro-status-missao')?.value
    );

    if (!temFiltro) {
      // Sem filtro: ATIVA → PENDENTE/PAUSADA → FINAIS; dentro de cada grupo por criado_em desc
      const ORD = { ATIVA: 0, PENDENTE: 1, PAUSADA: 1, CANCELADA: 2, FRACASSADA: 2, CONCLUIDA: 2 };
      lista = [...lista].sort((a, b) => {
        const sa = ORD[a.status_hoje || 'PENDENTE'] ?? 1;
        const sb = ORD[b.status_hoje || 'PENDENTE'] ?? 1;
        if (sa !== sb) return sa - sb;
        // dentro do grupo: mais recentes primeiro
        return (b.criado_em || '').localeCompare(a.criado_em || '');
      });
    } else {
      // Com filtro: mantém a ordem retornada pela API (status_hoje agrupado)
      const ORD = { ATIVA: 0, PENDENTE: 1, PAUSADA: 2, CANCELADA: 3, FRACASSADA: 4, CONCLUIDA: 5 };
      lista = [...lista].sort((a, b) => {
        const sa = ORD[a.status_hoje || 'PENDENTE'] ?? 9;
        const sb = ORD[b.status_hoje || 'PENDENTE'] ?? 9;
        return sa - sb;
      });
    }

    cont.innerHTML = lista.map(r => this._buildRotinaDashCard(r)).join('');
    this._bindRotinaDashCards(cont);
    this._iniciarTimerDash();
    this._iniciarAutoCheckDash();
  },

  renderRotinasHoje(lista) {
    this._rodinasHojeLista = lista || [];
    // Inicializa o extrato com "hoje" (chamada inicial)
    this.carregarExtrato();
    // Bind dos filtros (s\u00F3 une vez ap\u00F3s render do DOM)
    this._bindFiltrosExtrato();
  },

  _bindFiltrosExtrato() {
    const bind = (id) => {
      const el = document.getElementById(id);
      if (el && !el._extratoListenerAdded) {
        el.addEventListener('change', () => this.carregarExtrato());
        el._extratoListenerAdded = true;
      }
    };
    ['filtro-periodo','filtro-tipo','filtro-categoria','filtro-status-missao'].forEach(bind);

    // Toggle ocultar concluídas (Extrato) — persistente
    const toggleExtrato = document.getElementById('toggle-ocultar-extrato');
    if (toggleExtrato && !toggleExtrato._extratoListenerAdded) {
      toggleExtrato.checked = localStorage.getItem('sr_ocultar_concluidas_extrato') === 'true';
      toggleExtrato.addEventListener('change', () => {
        localStorage.setItem('sr_ocultar_concluidas_extrato', toggleExtrato.checked);
        this.carregarExtrato();
      });
      toggleExtrato._extratoListenerAdded = true;
    }

    const btnAtualizar = document.getElementById('btn-atualizar-extrato');
    if (btnAtualizar && !btnAtualizar._extratoListenerAdded) {
      btnAtualizar.addEventListener('click', () => this.carregarExtrato());
      btnAtualizar._extratoListenerAdded = true;
    }
  },

  _buildRotinaDashCard(r) {
    const id     = r.id;
    const status = r.status_hoje || 'PENDENTE';
    const scfg   = this._STATUS_CFG_DASH[status] || this._STATUS_CFG_DASH.PENDENTE;
    const tcfg   = this._TIPO_CFG[r.tipo] || this._TIPO_CFG.AVULSA;
    const prior  = this._PRIOR_CORES_DASH[r.prioridade] || this._PRIOR_CORES_DASH.MEDIA;
    const icone  = this._CAT_ICONS_DASH[r.categoria] || '\u2694\uFE0F';
    const xp     = r.xp_recompensa     || 0;
    const moedas = r.moedas_recompensa || 0;
    const penal  = r.penalidade_xp     || 0;

    const isFinal      = ['CONCLUIDA','FRACASSADA','CANCELADA'].includes(status);
    const isFracassada = status === 'FRACASSADA';
    const isConcluida  = status === 'CONCLUIDA';
    const isPendente   = status === 'PENDENTE';
    const isAtiva      = status === 'ATIVA';

    const bordaCor = isFinal ? scfg.cor : prior.cor;
    const bgGrad   = `linear-gradient(135deg,${isFinal ? scfg.cor + '0a' : prior.bg},var(--bg-card))`;

    // \u2500\u2500 Timer inteligente por status \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    let cdHtml = '';
    if (!isFinal) {
      const agora = new Date();

      if (isPendente && r.hora_inicio) {
        // PENDENTE com hora_inicio: mostra countdown AT\u00C9 o in\u00EDcio
        const [hI, mI] = r.hora_inicio.split(':').map(Number);
        const inicio = new Date(agora); inicio.setHours(hI, mI, 0, 0);
        const segsInicio = Math.floor((inicio - agora) / 1000);

        if (segsInicio > 0) {
          // Ainda n\u00E3o chegou a hora \u2014 countdown at\u00E9 in\u00EDcio
          cdHtml = `
            <div style="font-family:var(--font-section);font-size:.6rem;color:var(--cyan-skill);text-align:right;white-space:nowrap">
              \u23F0 Inicia \u00E0s ${r.hora_inicio}
            </div>
            <div class="dash-cd-inicio" data-rid="${id}" data-hora="${r.hora_inicio}" style="
              font-family:var(--font-section);font-size:.72rem;font-weight:700;
              color:var(--cyan-skill);text-align:right">
              ${this._fmtSegsCompact(segsInicio)}
            </div>`;
        } else {
          // Passou da hora_inicio mas n\u00E3o foi iniciada \u2014 countdown at\u00E9 fim
          const segs = this._calcSegsRestantesDash(r);
          const cdNeg = segs < 0;
          cdHtml = `
            <div style="font-family:var(--font-section);font-size:.6rem;color:${cdNeg ? '#f87171' : '#f59e0b'};text-align:right">
              ${cdNeg ? '\u26A0\uFE0F Atrasada' : '\u26A0\uFE0F Aguardando'}
            </div>
            <div class="dash-cd-val" data-rid="${id}" style="
              font-family:var(--font-section);font-size:.72rem;font-weight:700;
              color:${cdNeg ? '#f87171' : '#f59e0b'};text-align:right;
              ${cdNeg ? 'animation:glowPulse 1.2s infinite' : ''}">
              ${this._fmtCountdownDash(segs)}
            </div>`;
        }
      } else if (isPendente && !r.hora_inicio) {
        // PENDENTE sem hora_inicio: mostra prazo at\u00E9 fim do dia (sem countdown urgente)
        const segs = this._calcSegsRestantesDash(r);
        cdHtml = `
          <div style="font-family:var(--font-section);font-size:.6rem;color:var(--text-muted);text-align:right">
            \u231B Prazo
          </div>
          <div class="dash-cd-val" data-rid="${id}" style="
            font-family:var(--font-section);font-size:.72rem;font-weight:700;
            color:var(--text-muted);text-align:right">
            ${this._fmtCountdownDash(segs)}
          </div>`;
      } else {
        // ATIVA / PAUSADA: countdown do prazo
        const segs = this._calcSegsRestantesDash(r);
        const cdNeg = segs < 0;
        cdHtml = `
          <div style="font-family:var(--font-section);font-size:.6rem;color:${cdNeg ? '#f87171' : scfg.cor};text-align:right">
            ${cdNeg ? '\u26A0\uFE0F Vencido' : '\u23F1 Restante'}
          </div>
          <div class="dash-cd-val" data-rid="${id}" style="
            font-family:var(--font-section);font-size:.72rem;font-weight:700;
            color:${cdNeg ? '#f87171' : scfg.cor};text-align:right;
            ${cdNeg ? 'animation:glowPulse 1.2s infinite' : ''}">
            ${this._fmtCountdownDash(segs)}
          </div>`;
      }
    }

    // Badge de janela de hor\u00E1rio
    const janelaHtml = (r.hora_inicio || r.hora_fim) ? `
      <span style="font-size:.58rem;color:var(--cyan-skill);
        padding:.08rem .35rem;border-radius:100px;
        background:rgba(6,182,212,.1);border:1px solid rgba(6,182,212,.3)">
        \u23F0 ${r.hora_inicio||'?'}\u2192${r.hora_fim||'?'}
      </span>` : '';

    // ── Badge ID instância (#ED-XXX) ────────────────────────────
    const edId     = r.exec_dia_id;
    const idBadge  = edId
      ? `<span style="position:absolute;top:.45rem;right:.5rem;
           font-family:var(--font-section);font-size:.55rem;
           color:${scfg.cor};opacity:.75;letter-spacing:.04em;font-weight:700"
         >#ED-${edId}</span>`
      : '';

    // ── Timestamp de encerramento ────────────────────────────────
    let tsHtml = '';
    if (isConcluida && r.concluida_em) {
      const d = new Date(r.concluida_em);
      tsHtml = `<div style="font-family:var(--font-section);font-size:.6rem;color:#10b981;text-align:right;margin-top:.15rem">
        \u2713 ${d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})} ${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
      </div>`;
    } else if (isFracassada && r.fracassada_em) {
      const d = new Date(r.fracassada_em);
      tsHtml = `<div style="font-family:var(--font-section);font-size:.6rem;color:#ef4444;text-align:right;margin-top:.15rem">
        \u2620 ${d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})} ${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
      </div>`;
    } else if (status === 'CANCELADA' && r.cancelada_em) {
      const d = new Date(r.cancelada_em);
      tsHtml = `<div style="font-family:var(--font-section);font-size:.6rem;color:#64748b;text-align:right;margin-top:.15rem">
        \u2715 ${d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})} ${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
      </div>`;
    }

    return `
      <div class="dash-rotina-card" data-id="${id}" data-status="${status}"
        style="
          background:${bgGrad};border:1px solid ${bordaCor}44;
          border-left:3px solid ${bordaCor};
          border-radius:.75rem;padding:.7rem .9rem;
          cursor:pointer;position:relative;overflow:hidden;
          transition:transform .18s,box-shadow .18s;
          margin-bottom:.45rem;
          ${isFracassada ? 'opacity:.78' : ''}
          ${status === 'CANCELADA' ? 'opacity:.5' : ''}
          ${isConcluida ? 'opacity:.65' : ''}
        "
        onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 5px 18px rgba(0,0,0,.3)'"
        onmouseout="this.style.transform='';this.style.boxShadow=''"
      >
        ${idBadge}
        <div style="display:flex;align-items:center;gap:.7rem">
          <!-- Icone categoria -->
          <div style="
            width:34px;height:34px;border-radius:.45rem;flex-shrink:0;
            display:flex;align-items:center;justify-content:center;
            font-size:1rem;background:${prior.bg};border:1px solid ${bordaCor}44
            ${isFracassada ? ';filter:grayscale(.5)' : ''}
          ">${icone}</div>

          <!-- Corpo -->
          <div style="flex:1;min-width:0">
            <div style="
              font-family:var(--font-section);font-size:.85rem;font-weight:700;
              color:${scfg.cor};
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis
              ${isConcluida ? ';text-decoration:line-through;opacity:.8' : ''}
            ">${r.titulo}</div>

            <div style="display:flex;gap:.3rem;align-items:center;margin-top:.25rem;flex-wrap:wrap">
              <!-- Status badge -->
              <span style="
                font-size:.58rem;font-family:var(--font-section);font-weight:700;letter-spacing:.07em;
                padding:.08rem .4rem;border-radius:100px;
                background:${scfg.cor}18;border:1px solid ${scfg.cor}55;color:${scfg.cor}">
                ${scfg.label}
              </span>
              <!-- Tipo badge -->
              <span style="
                font-size:.58rem;font-family:var(--font-section);font-weight:600;
                padding:.08rem .4rem;border-radius:100px;
                background:${tcfg.cor}12;border:1px solid ${tcfg.cor}40;color:${tcfg.cor}">
                ${tcfg.label}
              </span>
              <!-- Janela -->
              ${janelaHtml}
              <!-- XP -->
              <span style="font-family:var(--font-section);font-size:.65rem;color:var(--gold-xp);font-weight:700">
                \u26A1${isConcluida ? '+' : ''}${isFracassada ? '-'+penal : xp}
              </span>
              ${moedas > 0 && !isFracassada ? `<span style="font-family:var(--font-section);font-size:.65rem;color:#fbbf24">+${moedas}\uD83E\uDE99</span>` : ''}
            </div>
          </div>

          <!-- Timer + timestamp -->
          <div style="flex-shrink:0;min-width:70px">
            ${cdHtml}
            ${isConcluida ? `<div style="font-family:var(--font-section);font-size:.7rem;font-weight:700;color:#10b981;text-align:right">\u2713 Conclu\u00EDda</div>` : ''}
            ${isFracassada ? `<div style="font-family:var(--font-section);font-size:.7rem;font-weight:700;color:#ef4444;text-align:right">\u2620 Falhou</div>` : ''}
            ${tsHtml}
          </div>
        </div>
      </div>`;
  },

  _bindRotinaDashCards(cont) {
    cont.querySelectorAll('.dash-rotina-card').forEach(card => {
      card.addEventListener('click', () => {
        const id   = parseInt(card.dataset.id);
        const item = this._rodinasHojeLista.find(r => r.id === id)
                  || this._todasRotinas.find(r => r.id === id);
        if (item) this._abrirModalRotinaDash(item);
      });
    });
  },

  _iniciarTimerDash() {
    if (this._dashTimer) clearInterval(this._dashTimer);
    this._dashTimer = setInterval(() => {
      const agora = new Date();
      const allList = [...this._rodinasHojeLista, ...this._todasRotinas.filter(x =>
        !this._rodinasHojeLista.find(h => h.id === x.id))];

      allList.forEach(r => {
        const status = r.status_hoje || 'PENDENTE';
        if (['CONCLUIDA','FRACASSADA','CANCELADA'].includes(status)) return;

        // Countdown de prazo (para ATIVA e PENDENTE sem hora_inicio ou hora_inicio j\u00E1 passou)
        const el = document.querySelector(`.dash-cd-val[data-rid="${r.id}"]`);
        if (el) {
          const segs = this._calcSegsRestantesDash(r);
          el.textContent = this._fmtCountdownDash(segs);
          el.style.color = segs < 0 ? '#f87171' : (status === 'ATIVA' ? '#3b82f6' : 'var(--text-muted)');
        }

        // Countdown at\u00E9 in\u00EDcio (s\u00F3 para PENDENTE com hora_inicio ainda no futuro)
        const elInicio = document.querySelector(`.dash-cd-inicio[data-rid="${r.id}"]`);
        if (elInicio && r.hora_inicio) {
          const [hI, mI] = r.hora_inicio.split(':').map(Number);
          const inicio = new Date(agora); inicio.setHours(hI, mI, 0, 0);
          const segsInicio = Math.floor((inicio - agora) / 1000);
          if (segsInicio <= 0) {
            // Hora chegou \u2014 recarrega card
            this._recarregarCardDash(r.id);
          } else {
            elInicio.textContent = this._fmtSegsCompact(segsInicio);
          }
        }
      });
    }, 1000);
  },

  // Auto-check: inicia ou fracassa miss\u00F5es por hor\u00E1rio
  _iniciarAutoCheckDash() {
    if (this._dashAutoCheck) clearInterval(this._dashAutoCheck);
    this._dashAutoCheck = setInterval(() => this._verificarAutoAcoesDash(), 30000);
    setTimeout(() => this._verificarAutoAcoesDash(), 2000);
  },

  async _verificarAutoAcoesDash() {
    const agora = new Date();
    for (const r of this._rodinasHojeLista) {
      const status = r.status_hoje || 'PENDENTE';
      if (['CONCLUIDA','FRACASSADA','CANCELADA'].includes(status)) continue;

      // Auto-start
      if (status === 'PENDENTE' && r.hora_inicio) {
        const [hI, mI] = r.hora_inicio.split(':').map(Number);
        const inicio = new Date(agora); inicio.setHours(hI, mI, 0, 0);
        if (agora >= inicio) {
          try {
            await API.post(`/rotinas/${r.id}/iniciar`, {});
            r.status_hoje = 'ATIVA';
            this._recarregarCardDash(r.id);
            if (typeof SoloDialog !== 'undefined')
              SoloDialog.toast(`\u25B6 Miss\u00E3o auto-iniciada: ${r.titulo}`, 'info');
          } catch (_) {}
        }
      }

      // Auto-fracassar
      if (['ATIVA','PENDENTE'].includes(status)) {
        const segs = this._calcSegsRestantesDash(r);
        if (segs <= 0) {
          try {
            const resp = await API.post(`/rotinas/${r.id}/fracassar`, {});
            r.status_hoje = 'FRACASSADA';
            Object.assign(r, resp);
            this._recarregarCardDash(r.id);
            if (typeof SoloDialog !== 'undefined')
              SoloDialog.toast(`\u2620\uFE0F Miss\u00E3o fracassada: ${r.titulo}`, 'error', 5000);
          } catch (_) {}
        }
      }
    }
  },

  _recarregarCardDash(id) {
    const r = this._rodinasHojeLista.find(x => x.id === id)
           || this._todasRotinas.find(x => x.id === id);
    if (!r) return;
    const card = document.querySelector(`.dash-rotina-card[data-id="${id}"]`);
    if (card) {
      const tmp = document.createElement('div');
      tmp.innerHTML = this._buildRotinaDashCard(r);
      card.replaceWith(tmp.firstElementChild);
    }
  },

  _pararTimerDash() {
    if (this._dashTimer)    { clearInterval(this._dashTimer);    this._dashTimer    = null; }
    if (this._dashAutoCheck){ clearInterval(this._dashAutoCheck); this._dashAutoCheck = null; }
  },

  _calcSegsRestantesDash(r) {
    const agora = new Date();
    if (r.hora_fim) {
      const [hFh, hFm] = r.hora_fim.split(':').map(Number);
      const prazo = new Date(agora);
      prazo.setHours(hFh, hFm, 0, 0);
      return Math.floor((prazo - agora) / 1000);
    }
    const fimDia = new Date(agora);
    fimDia.setHours(23, 59, 59, 0);
    return Math.floor((fimDia - agora) / 1000);
  },

  _fmtCountdownDash(segs) {
    const abs = Math.abs(segs);
    const h = Math.floor(abs / 3600);
    const m = Math.floor((abs % 3600) / 60);
    const s = abs % 60;
    const str = `${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
    return segs < 0 ? `-${str}` : str;
  },

  _fmtSegsCompact(segs) {
    const abs = Math.abs(segs);
    const h = Math.floor(abs / 3600);
    const m = Math.floor((abs % 3600) / 60);
    const s = abs % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2,'0')}m`;
    if (m > 0) return `${m}m ${String(s).padStart(2,'0')}s`;
    return `${s}s`;
  },


  _abrirModalRotinaDash(r) {
    const PRIOR = {
      CRITICA: { cor: '#ef4444', label: '\uD83D\uDD34 CR\u00CDTICA' },
      ALTA:    { cor: '#f97316', label: '\uD83D\uDFE0 ALTA'    },
      MEDIA:   { cor: '#f59e0b', label: '\uD83D\uDFE1 M\u00C9DIA'   },
      BAIXA:   { cor: '#10b981', label: '\uD83D\uDFE2 BAIXA'   },
    };
    const STATUS_CFG = {
      PENDENTE:   { cor: '#a855f7', label: '\u23F3 PENDENTE \u2014 Aguardando in\u00EDcio' },
      ATIVA:      { cor: '#3b82f6', label: '\u25B6 EM CURSO' },
      CONCLUIDA:  { cor: '#10b981', label: '\u2713 CONCLU\u00CDDA' },
      FRACASSADA: { cor: '#ef4444', label: '\u2620 FRACASSADA' },
      CANCELADA:  { cor: '#64748b', label: '\u2715 CANCELADA' },
      PAUSADA:    { cor: '#64748b', label: '\u23F8 PAUSADA' },
    };
    const DIFIC_MULT = { FACIL: 0.5, NORMAL: 1.0, DIFICIL: 1.5, LENDARIO: 2.5 };
    const PRIOR_MULT = { CRITICA: 1.5, ALTA: 1.2, MEDIA: 1.0, BAIXA: 0.7 };
    const CAT_ICONS  = { Saude:'\u2764\uFE0F','Sa\u00FAde':'\u2764\uFE0F',Trabalho:'\uD83D\uDCBC',Estudo:'\uD83D\uDCDA',Casa:'\uD83C\uDFE0',Pessoal:'\u26A1',Combate:'\u2694\uFE0F' };

    const prior      = PRIOR[r.prioridade] || PRIOR.MEDIA;
    const icone      = CAT_ICONS[r.categoria] || '\u2694\uFE0F';
    const status     = r.status_hoje || 'PENDENTE';
    const scfg       = STATUS_CFG[status] || STATUS_CFG.PENDENTE;
    const concluida  = status === 'CONCLUIDA';
    const fracassada = status === 'FRACASSADA';
    const isPendente = status === 'PENDENTE';
    const isFinal    = ['CONCLUIDA','FRACASSADA','CANCELADA'].includes(status);
    const exec       = r.exec_hoje;
    const segs       = this._calcSegsRestantesDash(r);
    const cdNeg      = segs < 0;

    // Prazo formatado
    const agora = new Date();
    let prazoStr, prazoLabel;
    if (r.hora_fim) {
      prazoStr  = r.hora_fim;
      prazoLabel = r.hora_inicio
        ? `Janela ${r.hora_inicio} \u2192 ${r.hora_fim}`
        : `Hoje at\u00E9 ${r.hora_fim}`;
    } else {
      const fimDia = new Date(agora);
      fimDia.setHours(23, 59, 59, 0);
      prazoStr  = fimDia.toLocaleString('pt-BR', { hour:'2-digit', minute:'2-digit' });
      prazoLabel = `Hoje \u00E0s ${prazoStr}`;
    }

    let modal = document.getElementById('dash-rotina-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'dash-rotina-modal';
      modal.className = 'draggable-window';
      modal.style.cssText = [
        'position:fixed','top:8%','left:50%','transform:translateX(-50%)',
        'width:min(560px,92vw)','z-index:9500',
        'background:rgba(13,13,26,0.82)',
        'backdrop-filter:blur(24px)',
        '-webkit-backdrop-filter:blur(24px)',
        'border:1px solid rgba(124,58,237,.35)',
        'border-radius:1.1rem',
        'box-shadow:0 12px 60px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.04)',
        'display:none','overflow:hidden'
      ].join(';');
      document.body.appendChild(modal);
      modal._drag = new DragWindow(modal);
    }

    const bordaCor = scfg.cor;

    modal.innerHTML = `
      <!-- Barra colorida de status no topo -->
      <div style="height:3px;background:linear-gradient(90deg,${bordaCor},transparent)"></div>

      <!-- Header arrast\u00E1vel -->
      <div class="window-header" style="
        display:flex;align-items:center;justify-content:space-between;
        padding:.9rem 1.2rem;border-bottom:1px solid ${bordaCor}22;
        cursor:move;background:${bordaCor}08
      ">
        <div style="display:flex;align-items:center;gap:.6rem">
          <div style="
            width:34px;height:34px;border-radius:.5rem;
            display:flex;align-items:center;justify-content:center;
            font-size:1.1rem;background:${bordaCor}20;border:1px solid ${bordaCor}44
          ">${icone}</div>
          <div>
            <div style="font-family:var(--font-section);font-size:.95rem;font-weight:700;color:var(--text-primary)">${r.titulo}</div>
            <div style="font-size:.65rem;font-family:var(--font-section);color:${scfg.cor};letter-spacing:.08em">${scfg.label} \u2022 ${r.tipo}</div>
          </div>
        </div>
        <button class="window-close-btn" onclick="document.getElementById('dash-rotina-modal').style.display='none'" style="
          background:none;border:none;color:var(--text-muted);font-size:1.3rem;cursor:pointer;
          width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;
          transition:.2s" onmouseover="this.style.background='rgba(239,68,68,.15)'" onmouseout="this.style.background='none'">\u00D7</button>
      </div>

      <!-- Corpo com glassmorphism -->
      <div style="padding:1.2rem;display:flex;flex-direction:column;gap:1rem">

        <!-- Status principal -->
        ${isFinal ? `
          <div style="
            background:${scfg.cor}15;border:1px solid ${scfg.cor}44;
            border-radius:.7rem;padding:.8rem;text-align:center
          ">
            <div style="font-family:var(--font-section);font-size:1rem;font-weight:700;color:${scfg.cor}">${scfg.label}</div>
            ${concluida && exec?.criado_em ? `<div style="font-size:.75rem;color:var(--text-muted);margin-top:.2rem">
              Conclu\u00EDda \u00E0s ${new Date(exec.criado_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
            </div>` : ''}
            ${fracassada && r.fracassada_em ? `<div style="font-size:.75rem;color:#f87171;margin-top:.2rem">
              Fracassou \u00E0s ${new Date(r.fracassada_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
            </div>` : ''}
          </div>` : `
          <div style="
            display:flex;align-items:center;justify-content:space-between;
            background:${cdNeg ? 'rgba(239,68,68,.08)' : scfg.cor + '12'};
            border:1px solid ${cdNeg ? 'rgba(239,68,68,.25)' : scfg.cor + '35'};
            border-radius:.7rem;padding:.8rem 1rem
          ">
            <div>
              <div style="font-family:var(--font-section);font-size:.65rem;color:var(--text-muted);letter-spacing:.1em;text-transform:uppercase">
                ${cdNeg ? '\u26A0\uFE0F Prazo Vencido' : (isPendente ? '\u23F3 Prazo para Iniciar' : '\u23F1 Prazo Restante')}
              </div>
              <div id="dash-modal-cd" style="
                font-family:var(--font-section);font-size:1.3rem;font-weight:900;
                color:${cdNeg ? '#f87171' : scfg.cor};
                letter-spacing:.05em;margin-top:.1rem
              ">${this._fmtCountdownDash(segs)}</div>
            </div>
            <div style="text-align:right">
              <div style="font-family:var(--font-section);font-size:.65rem;color:var(--text-muted);letter-spacing:.08em">PRAZO LIMITE</div>
              <div style="font-family:var(--font-section);font-size:.88rem;font-weight:700;color:var(--text-primary);margin-top:.1rem">${prazoLabel}</div>
            </div>
          </div>`
        }

        <!-- Recompensas / Puni\u00E7\u00F5es -->
        <div style="display:grid;grid-template-columns:repeat(${r.penalidade_xp > 0 ? 3 : 2},1fr);gap:.6rem">
          <div style="
            text-align:center;background:rgba(16,185,129,.06);
            border:1px solid rgba(16,185,129,.2);border-radius:.6rem;padding:.65rem
          ">
            <div style="font-family:var(--font-section);font-size:.6rem;color:var(--text-muted);letter-spacing:.1em;text-transform:uppercase">XP ${fracassada ? 'PERDIDO' : (concluida ? 'GANHO' : 'RECOMPENSA')}</div>
            <div style="font-family:var(--font-title);font-size:1.25rem;font-weight:700;color:${fracassada ? '#f87171' : '#10b981'};margin-top:.2rem">
              ${fracassada ? '-' + (r.xp_perdido_hoje || r.penalidade_xp || 0) : ('+' + (concluida && exec ? exec.xp_ganho : r.xp_recompensa))}
            </div>
          </div>
          <div style="
            text-align:center;background:rgba(245,158,11,.06);
            border:1px solid rgba(245,158,11,.2);border-radius:.6rem;padding:.65rem
          ">
            <div style="font-family:var(--font-section);font-size:.6rem;color:var(--text-muted);letter-spacing:.1em;text-transform:uppercase">MOEDAS</div>
            <div style="font-family:var(--font-title);font-size:1.25rem;font-weight:700;color:var(--gold-xp);margin-top:.2rem">
              +${concluida && exec ? exec.moedas_ganhas : r.moedas_recompensa}
            </div>
          </div>
          ${r.penalidade_xp > 0 ? `
          <div style="
            text-align:center;background:rgba(239,68,68,.06);
            border:1px solid rgba(239,68,68,.2);border-radius:.6rem;padding:.65rem
          ">
            <div style="font-family:var(--font-section);font-size:.6rem;color:var(--text-muted);letter-spacing:.1em;text-transform:uppercase">PUNI\u00C7\u00C3O</div>
            <div style="font-family:var(--font-title);font-size:1.25rem;font-weight:700;color:#f87171;margin-top:.2rem">-${r.penalidade_xp}</div>
          </div>` : ''}
        </div>

        ${concluida && exec?.streak > 0 ? `
        <div style="
          display:flex;align-items:center;justify-content:center;gap:.5rem;
          background:rgba(249,115,22,.08);border:1px solid rgba(249,115,22,.25);
          border-radius:.6rem;padding:.6rem
        ">
          <span style="font-size:1.3rem">\uD83D\uDD25</span>
          <div>
            <span style="font-family:var(--font-section);font-size:.85rem;font-weight:700;color:#f97316">Streak: ${exec.streak} dias</span>
            ${exec.bonus_streak > 0 ? `<span style="font-size:.72rem;color:var(--gold-xp);margin-left:.5rem">+${exec.bonus_streak} XP b\u00F4nus</span>` : ''}
          </div>
        </div>` : ''}

        <!-- Atributos -->
        <div>
          <div style="font-family:var(--font-section);font-size:.65rem;letter-spacing:.12em;
            text-transform:uppercase;color:var(--text-muted);margin-bottom:.5rem">Detalhes da Miss\u00E3o</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem">
            ${[
              ['Categoria',   r.categoria || 'Pessoal',     `${CAT_ICONS[r.categoria] || '\u2694\uFE0F'} ${r.categoria}`, 'var(--cyan-skill)'],
              ['Prioridade',  r.prioridade,                 `\u00D7${PRIOR_MULT[r.prioridade]||1} XP`,               prior.cor],
              ['Dificuldade', r.dificuldade || 'NORMAL',    `\u00D7${DIFIC_MULT[r.dificuldade]||1}`,                 'var(--purple-glow)'],
              ['Frequ\u00EAncia',  r.tipo,                       r.tipo.toLowerCase(),                                '#64748b'],
            ].map(([lbl, val, sub, cor]) => `
              <div style="
                background:rgba(100,116,139,.06);border:1px solid rgba(100,116,139,.12);
                border-radius:.5rem;padding:.5rem .7rem;
                display:flex;align-items:center;justify-content:space-between
              ">
                <span style="font-family:var(--font-section);font-size:.7rem;color:var(--text-muted)">${lbl}</span>
                <div style="text-align:right">
                  <div style="font-family:var(--font-section);font-size:.72rem;font-weight:700;color:${cor}">${val}</div>
                  <div style="font-size:.6rem;color:var(--text-muted)">${sub}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>

        ${r.descricao ? `
        <div style="
          background:rgba(100,116,139,.05);border:1px solid rgba(100,116,139,.12);
          border-radius:.5rem;padding:.6rem .8rem
        ">
          <div style="font-family:var(--font-section);font-size:.65rem;color:var(--text-muted);letter-spacing:.1em;text-transform:uppercase;margin-bottom:.3rem">Descri\u00E7\u00E3o</div>
          <div style="font-size:.8rem;color:var(--text-primary)">${r.descricao}</div>
        </div>` : ''}

        <!-- A\u00E7\u00F5es -->
        ${isPendente ? `
        <div style="display:flex;gap:.5rem;padding-top:.25rem">
          <button onclick="Dashboard._iniciarDoModal(${r.id})" style="
            flex:1;font-family:var(--font-section);font-size:.78rem;font-weight:700;
            padding:.5rem;border-radius:.5rem;cursor:pointer;
            border:1px solid #a855f7;background:rgba(168,85,247,.18);color:#a855f7;
            letter-spacing:.05em;transition:all .2s
            " onmouseover="this.style.background='rgba(168,85,247,.3)'" onmouseout="this.style.background='rgba(168,85,247,.18)'"
          >\u25B6 Iniciar Miss\u00E3o</button>
          <button onclick="App.navigate('rotinas')" style="
            font-family:var(--font-section);font-size:.78rem;padding:.5rem .9rem;border-radius:.5rem;
            cursor:pointer;border:1px solid rgba(124,58,237,.3);background:rgba(124,58,237,.1);
            color:var(--purple-glow);transition:all .2s
            ">Ver Rotinas</button>
        </div>` : ''}
        ${status === 'ATIVA' ? `
        <div style="display:flex;gap:.5rem;padding-top:.25rem">
          <button onclick="Dashboard._concluirDoModal(${r.id})" style="
            flex:1;font-family:var(--font-section);font-size:.78rem;font-weight:700;
            padding:.5rem;border-radius:.5rem;cursor:pointer;
            border:1px solid #10b981;background:rgba(16,185,129,.15);color:#10b981;
            letter-spacing:.05em;transition:all .2s
            " onmouseover="this.style.background='rgba(16,185,129,.3)'" onmouseout="this.style.background='rgba(16,185,129,.15)'"
          >\u25B6 Concluir Miss\u00E3o</button>
          <button onclick="App.navigate('rotinas')" style="
            font-family:var(--font-section);font-size:.78rem;padding:.5rem .9rem;border-radius:.5rem;
            cursor:pointer;border:1px solid rgba(124,58,237,.3);background:rgba(124,58,237,.1);
            color:var(--purple-glow);transition:all .2s
            ">Ver Rotinas</button>
        </div>` : ''}
        ${isFinal ? `
        <button onclick="App.navigate('rotinas')" style="
          width:100%;font-family:var(--font-section);font-size:.78rem;font-weight:700;
          padding:.5rem;border-radius:.5rem;cursor:pointer;
          border:1px solid ${scfg.cor}44;background:${scfg.cor}10;
          color:${scfg.cor};letter-spacing:.05em;transition:all .2s
          ">\uD83D\uDCCA Ver Detalhes em Rotinas</button>` : ''}

      </div><!-- /corpo -->
    `;

    modal.style.display = 'block';
    if (modal._drag) modal._drag.rebind();

    // Atualiza countdown do modal em tempo real
    if (!isFinal) {
      if (this._modalCdTimer) clearInterval(this._modalCdTimer);
      this._modalCdTimer = setInterval(() => {
        const el = document.getElementById('dash-modal-cd');
        if (!el || modal.style.display === 'none') {
          clearInterval(this._modalCdTimer); return;
        }
        const s2 = this._calcSegsRestantesDash(r);
        el.textContent = this._fmtCountdownDash(s2);
        el.style.color = s2 < 0 ? '#f87171' : scfg.cor;
      }, 1000);
    }
  },

  async _iniciarDoModal(id) {
    const r = this._rodinasHojeLista.find(x => x.id === id);
    if (!r) return;
    const btn = document.querySelector(`[onclick="Dashboard._iniciarDoModal(${id})"]`);
    if (btn) { btn.disabled = true; btn.textContent = '\u23F3 Iniciando...'; }
    try {
      const resp = await API.post(`/rotinas/${id}/iniciar`, {});
      r.status_hoje = 'ATIVA';
      Object.assign(r, resp);
      if (typeof Rotinas !== 'undefined') Rotinas._statusCache[id] = 'ATIVA';
      document.getElementById('dash-rotina-modal').style.display = 'none';
      this._recarregarCardDash(id);
      this._abrirModalRotinaDash(r);
      if (typeof SoloDialog !== 'undefined')
        SoloDialog.toast(`\u25B6 Miss\u00E3o iniciada: ${r.titulo}`, 'info');
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = '\u25B6 Iniciar Miss\u00E3o'; }
      if (typeof SoloDialog !== 'undefined')
        SoloDialog.toast('Erro ao iniciar: ' + (err.message || err), 'error');
    }
  },

  async _concluirDoModal(id) {
    const r = this._rodinasHojeLista.find(x => x.id === id);
    if (!r) return;
    const btn = document.querySelector(`[onclick="Dashboard._concluirDoModal(${id})"]`);
    if (btn) { btn.disabled = true; btn.textContent = '\u23F3 Concluindo...'; }
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const res  = await API.post('/execucoes/rotina', { rotina_id: id, data_execucao: hoje });
      r.status_hoje    = 'CONCLUIDA';
      r.concluida_hoje = true;
      r.exec_hoje      = res.resultado || {};

      // Sincroniza com Rotinas.js
      if (typeof Rotinas !== 'undefined') {
        Rotinas._statusCache[id] = 'CONCLUIDA';
        Rotinas._execCache[id]   = r.exec_hoje;
        const itemRotinas = Rotinas._lista?.find(x => x.id === id);
        if (itemRotinas) {
          itemRotinas.concluida_hoje = true;
          itemRotinas.exec_hoje      = r.exec_hoje;
        }
      }

      // Fecha modal
      document.getElementById('dash-rotina-modal').style.display = 'none';

      // Float XP
      const xpFloat = document.getElementById('xp-float');
      if (xpFloat) {
        xpFloat.textContent = `+${r.xp_recompensa} XP`;
        xpFloat.classList.add('visible');
        setTimeout(() => xpFloat.classList.remove('visible'), 1800);
      }

      // Atualização completa do dashboard (card + stats + XP)
      setTimeout(() => this.atualizarStatsMini(), 400);

    } catch (err) {
      if (err.message?.includes('j\u00E1 foi conclu\u00EDda')) {
        r.concluida_hoje = true;
        document.getElementById('dash-rotina-modal').style.display = 'none';
        setTimeout(() => this.atualizarStatsMini(), 400);
      } else {
        SoloDialog.toast('Erro: ' + (err.message || err), 'error');
        if (btn) { btn.disabled = false; btn.textContent = '\u25B6 Concluir Miss\u00E3o'; }
      }
    }
  },

  // ── Bind double-click nos cards de tarefa ────────────────────────────────
  _bindTarefaDblClick(cont) {
    cont.querySelectorAll('.dash-tarefa-card').forEach(card => {
      card.addEventListener('dblclick', () => {
        const id = parseInt(card.dataset.id);
        const t  = (this._tarefasHojeLista || []).find(x => x.id === id);
        if (t) this._abrirModalTarefaDash(t);
      });
    });
  },

  // ── Timer regressivo para prazo das tarefas ──────────────────────────────
  _iniciarTimerTarefas() {
    if (this._tarefaTimer) clearInterval(this._tarefaTimer);
    this._tarefaTimer = setInterval(() => {
      const agora = new Date();
      document.querySelectorAll('[data-tarefa-timer]').forEach(el => {
        const limite = el.dataset.limite; // HH:MM
        if (!limite) return;
        const [hh, mm] = limite.split(':').map(Number);
        const prazo = new Date(agora); prazo.setHours(hh, mm, 0, 0);
        const segs  = Math.floor((prazo - agora) / 1000);
        const neg   = segs < 0;
        const abs   = Math.abs(segs);
        const h = String(Math.floor(abs / 3600)).padStart(2,'0');
        const m = String(Math.floor((abs % 3600) / 60)).padStart(2,'0');
        const s = String(abs % 60).padStart(2,'0');
        el.textContent = `${h}h ${m}m ${s}s`;
        const corBase = el.dataset.corBase || 'var(--gold-xp)';
        el.style.color = neg ? '#f87171' : corBase;
        // Atualiza label acima (irmão anterior)
        const label = el.previousElementSibling;
        if (label) label.style.color = neg ? '#f87171' : 'var(--text-muted)';
      });
      // Modal de tarefa aberto
      const mcd = document.getElementById('dash-tarefa-modal-cd');
      if (mcd && this._modalTarefaAtual) {
        const t2  = this._modalTarefaAtual;
        const lim = t2.hora_limite || '23:59';
        const [hh2, mm2] = lim.split(':').map(Number);
        const prazo2 = new Date(agora); prazo2.setHours(hh2, mm2, 0, 0);
        const s2 = Math.floor((prazo2 - agora) / 1000);
        const abs2 = Math.abs(s2);
        const hS = String(Math.floor(abs2/3600)).padStart(2,'0');
        const mS = String(Math.floor((abs2%3600)/60)).padStart(2,'0');
        const sS = String(abs2%60).padStart(2,'0');
        mcd.textContent = `${hS}h ${mS}m ${sS}s`;
        mcd.style.color  = s2 < 0 ? '#f87171' : '#3b82f6';
      }
    }, 1000);
  },


  // ── Modal de detalhes da tarefa ──────────────────────────────────────────
  _abrirModalTarefaDash(t) {
    this._modalTarefaAtual = t;

    const PRIOR_CFG = {
      CRITICA: { cor:'#ef4444', label:'\uD83D\uDD34 CR\u00CDTICA' },
      ALTA:    { cor:'#f97316', label:'\uD83D\uDFE0 ALTA'    },
      MEDIA:   { cor:'#f59e0b', label:'\uD83D\uDFE1 M\u00C9DIA'   },
      BAIXA:   { cor:'#10b981', label:'\uD83D\uDFE2 BAIXA'   },
    };
    const CAT_ICONS = { 'Sa\u00FAde':'\u2764\uFE0F','Saude':'\u2764\uFE0F','Trabalho':'\uD83D\uDCBC','Estudo':'\uD83D\uDCDA','Casa':'\uD83C\uDFE0','Pessoal':'\u26A1','Combate':'\u2694\uFE0F' };

    const concluida = t.concluida || t.status === 'CONCLUIDA';
    const prior     = PRIOR_CFG[t.prioridade] || PRIOR_CFG.MEDIA;
    const icone     = CAT_ICONS[t.categoria] || '\uD83D\uDCCB';
    const xp        = t.xp_recompensa || t.xp || 0;
    const moedas    = t.moedas_recompensa || 0;
    const cat       = t.categoria || 'Pessoal';
    const bordaCor  = concluida ? '#10b981' : prior.cor;

    // Prazo
    let prazoLabel = 'Fim do dia';
    let segsAtual  = 0;
    if (t.hora_limite) {
      const agora = new Date();
      const [hh, mm] = t.hora_limite.split(':').map(Number);
      const prazo = new Date(agora); prazo.setHours(hh, mm, 0, 0);
      segsAtual  = Math.floor((prazo - agora) / 1000);
      prazoLabel = `Hoje at\u00E9 ${t.hora_limite}`;
    } else if (t.data_prevista) {
      prazoLabel = new Date(t.data_prevista + 'T00:00:00').toLocaleDateString('pt-BR');
    }

    const cdNeg = segsAtual < 0;
    const abs   = Math.abs(segsAtual);
    const hS = String(Math.floor(abs/3600)).padStart(2,'0');
    const mS = String(Math.floor((abs%3600)/60)).padStart(2,'0');
    const sS = String(abs%60).padStart(2,'0');
    const cdStr = t.hora_limite ? `${hS}h ${mS}m ${sS}s` : '—';

    let modal = document.getElementById('dash-tarefa-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'dash-tarefa-modal';
      modal.className = 'draggable-window';
      modal.style.cssText = [
        'position:fixed','top:8%','left:50%','transform:translateX(-50%)',
        'width:min(560px,92vw)','z-index:9500',
        'background:rgba(13,13,26,0.88)',
        'backdrop-filter:blur(24px)','-webkit-backdrop-filter:blur(24px)',
        'border:1px solid rgba(124,58,237,.35)',
        'border-radius:1.1rem',
        'box-shadow:0 12px 60px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.04)',
        'display:none','overflow:hidden'
      ].join(';');
      document.body.appendChild(modal);
      modal._drag = (typeof DragWindow !== 'undefined') ? new DragWindow(modal) : null;
    }

    modal.innerHTML = `
      <div style="height:3px;background:linear-gradient(90deg,${bordaCor},transparent)"></div>

      <!-- Header -->
      <div class="window-header" style="
        display:flex;align-items:center;justify-content:space-between;
        padding:.9rem 1.2rem;border-bottom:1px solid ${bordaCor}22;
        cursor:move;background:${bordaCor}08">
        <div style="display:flex;align-items:center;gap:.6rem">
          <div style="width:34px;height:34px;border-radius:.5rem;
            display:flex;align-items:center;justify-content:center;
            font-size:1.1rem;background:${bordaCor}20;border:1px solid ${bordaCor}44">
            ${concluida ? '\u2713' : icone}
          </div>
          <div>
            <div style="font-family:var(--font-section);font-size:.95rem;font-weight:700;color:var(--text-primary)">${t.titulo || 'Tarefa'}</div>
            <div style="font-size:.65rem;font-family:var(--font-section);color:${bordaCor};letter-spacing:.08em">
              ${concluida ? '\u2713 CONCLU\u00CDDA' : '\uD83D\uDCCB TAREFA'} \u2022 ${cat}
            </div>
          </div>
        </div>
        <button onclick="document.getElementById('dash-tarefa-modal').style.display='none'"
          style="background:none;border:none;color:var(--text-muted);font-size:1.3rem;cursor:pointer;
          width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:.2s"
          onmouseover="this.style.background='rgba(239,68,68,.15)'"
          onmouseout="this.style.background='none'">\u00D7</button>
      </div>

      <!-- Corpo -->
      <div style="padding:1.2rem;display:flex;flex-direction:column;gap:1rem">

        <!-- Timer / Status -->
        ${concluida ? `
          <div style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);
            border-radius:.7rem;padding:.8rem;text-align:center">
            <div style="font-family:var(--font-section);font-size:1rem;font-weight:700;color:#10b981">\u2713 CONCLU\u00CDDA</div>
          </div>` : `
          <div style="display:flex;align-items:center;justify-content:space-between;
            background:${cdNeg ? 'rgba(239,68,68,.08)' : prior.cor + '12'};
            border:1px solid ${cdNeg ? 'rgba(239,68,68,.25)' : prior.cor + '35'};
            border-radius:.7rem;padding:.8rem 1rem">
            <div>
              <div style="font-family:var(--font-section);font-size:.65rem;color:var(--text-muted);letter-spacing:.1em;text-transform:uppercase">
                ${cdNeg ? '\u26A0\uFE0F Prazo Vencido' : '\u23F0 Prazo Restante'}
              </div>
              <div id="dash-tarefa-modal-cd" style="font-family:var(--font-section);font-size:1.3rem;font-weight:900;
                color:${cdNeg ? '#f87171' : prior.cor};letter-spacing:.05em;margin-top:.1rem"
                data-limite="${t.hora_limite || ''}">${cdStr}</div>
            </div>
            <div style="text-align:right">
              <div style="font-family:var(--font-section);font-size:.65rem;color:var(--text-muted);letter-spacing:.08em">PRAZO LIMITE</div>
              <div style="font-family:var(--font-section);font-size:.88rem;font-weight:700;color:var(--text-primary);margin-top:.1rem">${prazoLabel}</div>
            </div>
          </div>`}

        <!-- Recompensas + Punição -->
        <div style="display:grid;grid-template-columns:repeat(${t.penalidade_xp > 0 ? 3 : 2},1fr);gap:.6rem">
          <div style="text-align:center;background:rgba(16,185,129,.06);
            border:1px solid rgba(16,185,129,.2);border-radius:.6rem;padding:.65rem">
            <div style="font-family:var(--font-section);font-size:.6rem;color:var(--text-muted);letter-spacing:.1em;text-transform:uppercase">XP RECOMPENSA</div>
            <div style="font-family:var(--font-title);font-size:1.25rem;font-weight:700;color:#10b981;margin-top:.2rem">+${xp}</div>
          </div>
          <div style="text-align:center;background:rgba(245,158,11,.06);
            border:1px solid rgba(245,158,11,.2);border-radius:.6rem;padding:.65rem">
            <div style="font-family:var(--font-section);font-size:.6rem;color:var(--text-muted);letter-spacing:.1em;text-transform:uppercase">MOEDAS</div>
            <div style="font-family:var(--font-title);font-size:1.25rem;font-weight:700;color:var(--gold-xp);margin-top:.2rem">+${moedas}</div>
          </div>
          ${t.penalidade_xp > 0 ? `
          <div style="text-align:center;background:rgba(239,68,68,.06);
            border:1px solid rgba(239,68,68,.2);border-radius:.6rem;padding:.65rem">
            <div style="font-family:var(--font-section);font-size:.6rem;color:var(--text-muted);letter-spacing:.1em;text-transform:uppercase">PUNI\u00C7\u00C3O</div>
            <div style="font-family:var(--font-title);font-size:1.25rem;font-weight:700;color:#f87171;margin-top:.2rem">-${t.penalidade_xp}</div>
          </div>` : ''}
        </div>

        <!-- Atributos -->
        <div>
          <div style="font-family:var(--font-section);font-size:.65rem;letter-spacing:.12em;
            text-transform:uppercase;color:var(--text-muted);margin-bottom:.5rem">Detalhes da Tarefa</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem">
            ${[
              ['Categoria',  cat,                              `${icone} ${cat}`,                                  'var(--cyan-skill)'],
              ['Prioridade', t.prioridade||'M\u00CDDIA',       prior.label,                                        prior.cor],
              ['Dificuldade',t.dificuldade||'NORMAL',           `\u00D7${({FACIL:.5,NORMAL:1,DIFICIL:1.5,LENDARIO:2.5}[t.dificuldade]||1)}`, 'var(--purple-glow)'],
              ['Status',     t.status||'Pendente',             t.status||'Pendente',                               concluida?'#10b981':'var(--text-muted)'],
            ].map(([lbl, , sub, cor]) => `
              <div style="background:rgba(100,116,139,.06);border:1px solid rgba(100,116,139,.12);
                border-radius:.5rem;padding:.5rem .7rem;
                display:flex;align-items:center;justify-content:space-between">
                <span style="font-family:var(--font-section);font-size:.7rem;color:var(--text-muted)">${lbl}</span>
                <div style="font-family:var(--font-section);font-size:.72rem;font-weight:700;color:${cor}">${sub}</div>
              </div>`).join('')}
          </div>
        </div>

        ${t.descricao ? `
        <div style="background:rgba(100,116,139,.05);border:1px solid rgba(100,116,139,.12);
          border-radius:.5rem;padding:.6rem .8rem">
          <div style="font-family:var(--font-section);font-size:.65rem;color:var(--text-muted);letter-spacing:.1em;text-transform:uppercase;margin-bottom:.3rem">Descri\u00E7\u00E3o</div>
          <div style="font-size:.8rem;color:var(--text-primary)">${t.descricao}</div>
        </div>` : ''}

        <!-- Ação -->
        ${!concluida ? `
        <div style="display:flex;gap:.5rem;padding-top:.25rem">
          <button onclick="Dashboard._concluirTarefaDoModal(${t.id})" style="
            flex:1;font-family:var(--font-section);font-size:.78rem;font-weight:700;
            padding:.5rem;border-radius:.5rem;cursor:pointer;
            border:1px solid #10b981;background:rgba(16,185,129,.15);color:#10b981;
            letter-spacing:.05em;transition:all .2s"
            onmouseover="this.style.background='rgba(16,185,129,.3)'"
            onmouseout="this.style.background='rgba(16,185,129,.15)'"
          >\u2713 Concluir Tarefa</button>
          <button onclick="App.navigate('tarefas')" style="
            font-family:var(--font-section);font-size:.78rem;padding:.5rem .9rem;border-radius:.5rem;
            cursor:pointer;border:1px solid rgba(124,58,237,.3);background:rgba(124,58,237,.1);
            color:var(--purple-glow);transition:all .2s">Ver Tarefas</button>
        </div>` : `
        <button onclick="App.navigate('tarefas')" style="
          width:100%;font-family:var(--font-section);font-size:.78rem;font-weight:700;
          padding:.5rem;border-radius:.5rem;cursor:pointer;
          border:1px solid #10b98144;background:rgba(16,185,129,.1);
          color:#10b981;letter-spacing:.05em">\uD83D\uDCCA Ver em Tarefas</button>`}

      </div>`;

    modal.style.display = 'block';
    if (modal._drag) modal._drag.rebind();
  },

  async _concluirTarefaDoModal(id) {
    const t   = (this._tarefasHojeLista || []).find(x => x.id === id);
    const btn = document.querySelector(`[onclick="Dashboard._concluirTarefaDoModal(${id})"]`);
    if (btn) { btn.disabled = true; btn.textContent = '\u23F3 Concluindo...'; }
    try {
      await API.post(`/tarefas/${id}/concluir`, {});
      if (t) { t.concluida = true; t.status = 'CONCLUIDA'; }
      document.getElementById('dash-tarefa-modal').style.display = 'none';
      // Atualiza card no dash
      const card = document.querySelector(`.dash-tarefa-card[data-id="${id}"]`);
      if (card && t) {
        const tmp = document.createElement('div');
        tmp.innerHTML = this._buildMissaoItem(t);
        card.replaceWith(tmp.firstElementChild);
      }
      const xp = t?.xp_recompensa || 0;
      const xpFloat = document.getElementById('xp-float');
      if (xpFloat && xp > 0) {
        xpFloat.textContent = `+${xp} XP`;
        xpFloat.style.opacity = '1'; xpFloat.style.transform = 'translateY(-30px)';
        setTimeout(() => { xpFloat.style.opacity='0'; xpFloat.style.transform='translateY(0)'; }, 1600);
      }
      setTimeout(() => this.atualizarStatsMini(), 600);
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = '\u2713 Concluir Tarefa'; }
      console.error('[Dashboard] Erro ao concluir tarefa do modal:', err);
    }
  },


  renderTarefasHoje(lista) {
    this._tarefasHojeLista = lista || [];
    this._renderTarefasFiltradas();
    this._bindFiltrosTarefas();
  },

  _renderTarefasFiltradas() {
    const cont    = document.getElementById('lista-tarefas-hoje');
    const countEl = document.getElementById('tarefas-count');
    if (!cont) return;

    let lista = [...(this._tarefasHojeLista || [])];

    // ── Filtros ativos ─────────────────────────────────────────
    const statusFil = document.getElementById('filtro-tarefa-status')?.value    || '';
    const priorFil  = document.getElementById('filtro-tarefa-prioridade')?.value || '';
    const temFiltro = !!(statusFil || priorFil);

    if (statusFil) lista = lista.filter(t => (t.status || (t.concluida ? 'CONCLUIDA' : 'PENDENTE')) === statusFil);
    if (priorFil)  lista = lista.filter(t => (t.prioridade || 'MEDIA') === priorFil);

    // ── Ocultar concluídas (persistente) ───────────────────────
    const ocultar = localStorage.getItem('sr_ocultar_concluidas_gerais') === 'true';
    const toggleEl = document.getElementById('toggle-ocultar-gerais');
    if (toggleEl) toggleEl.checked = ocultar;
    const FINAIS = ['CONCLUIDA', 'CANCELADA', 'FRACASSADA'];
    if (ocultar) lista = lista.filter(t => !FINAIS.includes(t.status || (t.concluida ? 'CONCLUIDA' : 'PENDENTE')));

    // ── Contador ─────────────────────────────────────────
    if (countEl) {
      const total    = lista.length;
      const ativas   = lista.filter(t => (t.status || '') === 'ATIVA').length;
      const pend     = lista.filter(t => !FINAIS.includes(t.status || (t.concluida ? 'CONCLUIDA' : 'PENDENTE'))).length;
      countEl.textContent = `${total} miss\u00E3o${total !== 1 ? '\u00F5es' : ''} \u00B7 ${pend} pendente${pend !== 1 ? 's' : ''}`;
      countEl.style.display = total ? '' : 'none';
    }

    if (!lista.length) {
      cont.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">&#9876;&#65039;</div>
          <div>Nenhuma miss\u00E3o encontrada com esses filtros</div>
        </div>`;
      return;
    }

    // ── Ordenação ─────────────────────────────────────────
    if (!temFiltro) {
      // Sem filtro: ATIVA primeiro, depois por data de criação desc, finais por último
      const SORD = { ATIVA: 0, PENDENTE: 1, PAUSADA: 1, CANCELADA: 2, FRACASSADA: 2, CONCLUIDA: 2 };
      lista.sort((a, b) => {
        const sa = SORD[a.status || (a.concluida ? 'CONCLUIDA' : 'PENDENTE')] ?? 1;
        const sb = SORD[b.status || (b.concluida ? 'CONCLUIDA' : 'PENDENTE')] ?? 1;
        if (sa !== sb) return sa - sb;
        return (b.criado_em || '').localeCompare(a.criado_em || '');
      });
    } else {
      // Com filtro: ordena por prioridade e depois por data
      const PORD = { CRITICA:0, ALTA:1, MEDIA:2, BAIXA:3 };
      lista.sort((a, b) => {
        const pa = PORD[a.prioridade || 'MEDIA'] ?? 2;
        const pb = PORD[b.prioridade || 'MEDIA'] ?? 2;
        if (pa !== pb) return pa - pb;
        return (b.criado_em || '').localeCompare(a.criado_em || '');
      });
    }

    cont.innerHTML = lista.map(t => this._buildMissaoItem(t)).join('');
    this._bindCheckboxes(cont);
    this._bindTarefaDblClick(cont);
    this._iniciarTimerTarefas();
  },

  _bindFiltrosTarefas() {
    const bind = (id) => {
      const el = document.getElementById(id);
      if (el && !el._tarefaListenerAdded) {
        el.addEventListener('change', () => this._renderTarefasFiltradas());
        el._tarefaListenerAdded = true;
      }
    };
    ['filtro-tarefa-status', 'filtro-tarefa-prioridade'].forEach(bind);

    // Toggle ocultar concluídas (Missões Gerais) — persistente
    const toggleGerais = document.getElementById('toggle-ocultar-gerais');
    if (toggleGerais && !toggleGerais._tarefaListenerAdded) {
      toggleGerais.checked = localStorage.getItem('sr_ocultar_concluidas_gerais') === 'true';
      toggleGerais.addEventListener('change', () => {
        localStorage.setItem('sr_ocultar_concluidas_gerais', toggleGerais.checked);
        this._renderTarefasFiltradas();
      });
      toggleGerais._tarefaListenerAdded = true;
    }

    const btnAtualizar = document.getElementById('btn-atualizar-tarefas-hoje');
    if (btnAtualizar && !btnAtualizar._tarefaListenerAdded) {
      btnAtualizar.addEventListener('click', async () => {
        // Re-busca da API em vez de só re-renderizar a lista em memória
        btnAtualizar.textContent = '⏳';
        btnAtualizar.disabled = true;
        try {
          const lista = await API.tarefas.hoje();
          this.renderTarefasHoje(lista || []);
        } catch (e) {
          console.error('[Dashboard] Erro ao atualizar tarefas:', e);
        } finally {
          btnAtualizar.textContent = '↻';
          btnAtualizar.disabled = false;
        }
      });
      btnAtualizar._tarefaListenerAdded = true;
    }
  },


  renderGraficoXP(dados) {
    // Converte formato backend {data:'2026-07-10', xp:50} para {label:'sex.', xp:50}
    const _toLabel = (item) => {
      if (item.label) return item.label; // já tem label
      if (item.data) {
        // Parse a data como local (sem deslocamento de fuso)
        const [y, m, d] = item.data.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        return dt.toLocaleDateString('pt-BR', { weekday: 'short' });
      }
      return '';
    };

    let chartData;
    if (!dados || !dados.length) {
      // Sem dados: gera 7 dias vazios com labels de dias
      chartData = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return {
          label: d.toLocaleDateString('pt-BR', { weekday: 'short' }),
          xp: 0
        };
      });
    } else {
      chartData = dados.map(item => ({
        label: _toLabel(item),
        xp: item.xp || item.valor || 0,
      }));
    }

    Charts.criarGraficoXPSemana('chart-xp-semana', chartData);
  },

  renderConquistas(lista) {
    const cont = document.getElementById('lista-conquistas-recentes');
    if (!cont) return;

    // Apenas as desbloqueadas, sem repetição (id ou título)
    const vistos = new Set();
    let desbloqueadas = lista.filter(c => {
      if (!c.desbloqueada) return false;
      const chave = String(c.id ?? '') + '|' + (c.titulo || '').trim().toLowerCase();
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });

    if (!desbloqueadas.length) {
      cont.innerHTML = `
        <div class="empty-state" style="width:100%">
          <div class="empty-icon">&#127942;</div>
          <div>Complete missoes para ganhar conquistas!</div>
        </div>`;
      return;
    }

    // Se houver data de desbloqueio, ordena pelas mais recentes, senão deixa como vieram
    desbloqueadas.sort((a, b) => {
      if (a.desbloqueada_em && b.desbloqueada_em) {
        return new Date(b.desbloqueada_em) - new Date(a.desbloqueada_em);
      }
      return 0;
    });

    const now = new Date();
    let delay = 0;

    cont.innerHTML = desbloqueadas.map((c, i) => {
      let isNew = false;
      if (c.desbloqueada_em) {
        // Se desbloqueada há menos de 1 minuto e ainda não foi listada nesta sessão
        isNew = (now - new Date(c.desbloqueada_em)) < 60000;
      }

      let classes = 'conquista-mini c-pulsing';
      let style = `--c-pulse-delay: ${Math.random()*2}s;`;

      if (isNew) {
        classes += ' c-materializing';
        style += `--c-delay: ${delay}ms;`;
        delay += 150;
      } else {
        classes += ' c-entering';
        style += `--c-delay: ${i * 50}ms;`;
      }

      // Insígnia própria (Jh3ffth / SOLO / Forja) tem prioridade sobre a medalha padrão
      const custom = (typeof ArquitetoConsole !== 'undefined' && ArquitetoConsole._insignia)
        ? ArquitetoConsole._insignia(c.codigo, 52) : null;
      const medalha = custom
        ? `<span class="cq-medalhinha" style="width:52px;height:52px">${custom}</span>`
        : ((typeof ConquistaFX !== 'undefined' && ConquistaFX.miniMedalha)
            ? ConquistaFX.miniMedalha(c)
            : `<div class="conquista-mini-icon">${c.icone || '&#127942;'}</div>`);
      return `
        <div class="${classes}" style="${style}" data-cq-chave="${c.id ?? (c.titulo || '')}">
          ${medalha}
          <div class="conquista-mini-info">
            <div class="conquista-mini-nome">${c.titulo || c.nome || 'Conquista'}</div>
            <div class="conquista-mini-desc">${c.descricao || ''}</div>
          </div>
        </div>
      `;
    }).join('');
  },

  _buildMissaoItem(t) {
    const STATUS_DASH = {
      ATIVA:      { cor: '#3b82f6', bg: 'rgba(59,130,246,.12)',  label: '\u25B6 Em Curso'    },
      PENDENTE:   { cor: '#a855f7', bg: 'rgba(168,85,247,.12)',  label: '\u23F3 Pendente'    },
      CONCLUIDA:  { cor: '#10b981', bg: 'rgba(16,185,129,.12)',  label: '\u2713 Conclu\u00EDda'   },
      FRACASSADA: { cor: '#ef4444', bg: 'rgba(239,68,68,.12)',   label: '\u2620 Fracassada'  },
      CANCELADA:  { cor: '#64748b', bg: 'rgba(100,116,139,.12)', label: '\u2715 Cancelada'   },
    };
    const statusStr  = t.status || (t.concluida ? 'CONCLUIDA' : 'PENDENTE');
    const concluida  = statusStr === 'CONCLUIDA';
    const isFinal    = ['CONCLUIDA','CANCELADA','FRACASSADA'].includes(statusStr);
    const scfg       = STATUS_DASH[statusStr] || STATUS_DASH.PENDENTE;
    const xp         = t.xp_recompensa || t.xp || 0;
    const moedas     = t.moedas_recompensa || 0;
    const cat        = t.categoria || 'Pessoal';
    const prior      = t.prioridade || 'MEDIA';
    const CAT_ICONS  = { 'Sa\u00FAde':'\u2764\uFE0F', 'Saude':'\u2764\uFE0F', 'Trabalho':'\uD83D\uDCBC', 'Estudo':'\uD83D\uDCDA', 'Casa':'\uD83C\uDFE0', 'Pessoal':'\u26A1', 'Combate':'\u2694\uFE0F' };
    const PRIOR_CFG  = {
      CRITICA: { cor:'#ef4444', bg:'rgba(239,68,68,.12)',  label:'\uD83D\uDD34 CR\u00CDTICA' },
      ALTA:    { cor:'#f97316', bg:'rgba(249,115,22,.12)', label:'\uD83D\uDFE0 ALTA'    },
      MEDIA:   { cor:'#f59e0b', bg:'rgba(245,158,11,.12)', label:'\uD83D\uDFE1 M\u00C9DIA'   },
      BAIXA:   { cor:'#10b981', bg:'rgba(16,185,129,.12)', label:'\uD83D\uDFE2 BAIXA'   },
    };
    const p        = PRIOR_CFG[prior] || PRIOR_CFG.MEDIA;
    const icone    = CAT_ICONS[cat] || '\uD83D\uDCCB';
    const bordaCor = scfg.cor;
    const bgGrad   = `linear-gradient(135deg,${scfg.bg},var(--bg-card))`;

    // ── Badge ID (#TR-XXX) ────────────────────────────────────
    const idBadge = t.id ? `<span style="position:absolute;top:.4rem;right:.5rem;
      font-family:var(--font-section);font-size:.55rem;
      color:${scfg.cor};opacity:.75;letter-spacing:.04em;font-weight:700">#TR-${t.id}</span>` : '';

    // ── Timestamp encerramento ─────────────────────────────────
    let tsHtml = '';
    if (concluida && t.concluida_em) {
      const d = new Date(t.concluida_em);
      tsHtml = `<div style="font-family:var(--font-section);font-size:.58rem;color:#10b981">
        \u2713 ${d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})} ${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
      </div>`;
    }

    // Timer de prazo
    let timerHtml = '';
    if (concluida) {
      timerHtml = `<div style="font-family:var(--font-section);font-size:.8rem;color:#10b981">\u2713 Conclu\u00EDda</div>
      ${tsHtml}`;
    } else if (!isFinal) {
      const agora = new Date();
      const limiteHHMM = t.hora_limite || '23:59';
      const [hh, mm] = limiteHHMM.split(':').map(Number);
      const prazo = new Date(agora); prazo.setHours(hh, mm, 0, 0);
      const segs  = Math.floor((prazo - agora) / 1000);
      const neg   = segs < 0;
      const abs   = Math.abs(segs);
      const hStr  = String(Math.floor(abs/3600)).padStart(2,'0');
      const mStr  = String(Math.floor((abs%3600)/60)).padStart(2,'0');
      const sStr  = String(abs%60).padStart(2,'0');
      const timerLabel = t.hora_limite ? (neg ? '\u26A0\uFE0F Vencida' : '\u23F3 Prazo') : (neg ? '\u26A0\uFE0F Expirado' : '\u23F3 Restante');
      const timerCor = neg ? '#f87171' : scfg.cor;
      timerHtml = `
        <div style="text-align:right;white-space:nowrap">
          <div style="font-family:var(--font-section);font-size:.6rem;color:${neg?'#f87171':'var(--text-muted)'};letter-spacing:.06em">${timerLabel}</div>
          <div style="font-family:var(--font-section);font-size:.9rem;font-weight:700;color:${timerCor}"
               data-tarefa-timer="${t.id}" data-limite="${limiteHHMM}" data-cor-base="${scfg.cor}">
            ${hStr}h ${mStr}m ${sStr}s
          </div>
        </div>`;
    } else {
      timerHtml = `<div style="font-family:var(--font-section);font-size:.7rem;color:${scfg.cor};text-align:right">${scfg.label}</div>`;
    }

    // Badges info
    const badgePrior = `<span style="font-family:var(--font-section);font-size:.6rem;padding:.12rem .45rem;border-radius:.3rem;background:${p.bg};color:${p.cor};border:1px solid ${p.cor}44">${p.label}</span>`;
    const badgeCat   = `<span style="font-family:var(--font-section);font-size:.6rem;padding:.12rem .45rem;border-radius:.3rem;background:rgba(255,255,255,.05);color:var(--text-muted);border:1px solid rgba(255,255,255,.08)">${cat}</span>`;
    const badgeXP    = xp    ? `<span style="font-family:var(--font-section);font-size:.6rem;color:var(--gold-xp)">\u26A1 ${xp}</span>` : '';
    const badgeMoeda = moedas ? `<span style="font-family:var(--font-section);font-size:.6rem;color:var(--gold-bright)">\uD83E\uFA99 +${moedas}</span>` : '';

    // Bot\u00E3o de a\u00E7\u00E3o
    const btnHtml = !isFinal ? `
      <button data-concluir-tarefa="${t.id}" data-xp="${xp}"
        style="font-family:var(--font-section);font-size:.6rem;padding:.2rem .6rem;border-radius:.35rem;
               border:1px solid ${p.cor}66;background:${p.bg};color:${p.cor};
               cursor:pointer;transition:.15s;white-space:nowrap;margin-left:.4rem"
        onmouseover="this.style.background='${p.cor}33'"
        onmouseout="this.style.background='${p.bg}'">
        \u2713 Concluir
      </button>` : '';

    return `
      <div class="dash-tarefa-card" data-id="${t.id}"
        style="
          background:${bgGrad};border:1px solid ${bordaCor}44;
          border-left:3px solid ${bordaCor};
          border-radius:.75rem;padding:.7rem .9rem;
          cursor:pointer;position:relative;overflow:hidden;
          transition:transform .18s,box-shadow .18s;
          margin-bottom:.45rem;
          ${isFinal ? 'opacity:.65' : ''}
        "
        onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 5px 18px rgba(0,0,0,.3)'"
        onmouseout="this.style.transform='';this.style.boxShadow=''">
        ${idBadge}
        <div style="display:flex;align-items:center;gap:.7rem">
          <!-- \u00cdcone -->
          <div style="width:34px;height:34px;border-radius:.45rem;flex-shrink:0;
            display:flex;align-items:center;justify-content:center;
            font-size:1rem;background:${scfg.bg};border:1px solid ${bordaCor}44">
            ${concluida ? '\u2713' : icone}
          </div>
          <!-- Corpo -->
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.25rem">
              <span style="font-family:var(--font-section);font-size:.85rem;font-weight:700;
                color:${scfg.cor};
                text-decoration:${concluida?'line-through':'none'};
                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px">
                ${t.titulo || 'Miss\u00E3o'}
              </span>
            </div>
            <div style="display:flex;align-items:center;gap:.3rem;flex-wrap:wrap">
              <span style="font-size:.58rem;font-family:var(--font-section);font-weight:700;letter-spacing:.07em;
                padding:.06rem .35rem;border-radius:100px;
                background:${scfg.cor}18;border:1px solid ${scfg.cor}44;color:${scfg.cor}">${scfg.label}</span>
              ${badgePrior}
              ${badgeCat}
              ${badgeXP}
              ${badgeMoeda}
            </div>
          </div>
          <!-- Timer + Bot\u00E3o -->
          <div style="display:flex;align-items:center;gap:.5rem;flex-shrink:0">
            ${timerHtml}
            ${btnHtml}
          </div>
        </div>
      </div>`;
  },

  _bindCheckboxes(container) {
    container.querySelectorAll('[data-concluir-tarefa]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id  = parseInt(btn.dataset.concluirTarefa);
        const xp  = parseInt(btn.dataset.xp) || 0;
        const row = btn.closest('.dash-tarefa-card');

        btn.disabled = true;
        btn.textContent = '...';

        try {
          const resp = await API.post(`/tarefas/${id}/concluir`, {});

          // Feedback visual imediato (antes do refresh completo)
          if (row) {
            row.style.opacity = '.5';
            row.style.transition = 'opacity .3s';
            const titulo = row.querySelector('span[style*="font-weight:700"]');
            if (titulo) titulo.style.textDecoration = 'line-through';
            btn.remove();
          }

          // Atualiza cache local para que o refresh saiba o novo status
          const t = (this._tarefasHojeLista || []).find(x => x.id === id);
          if (t) { t.status = 'CONCLUIDA'; t.concluida = true; }

          // Anima\u00e7\u00e3o XP
          const xpFloat = document.getElementById('xp-float');
          if (xpFloat && xp > 0) {
            xpFloat.textContent = `+${xp} XP`;
            xpFloat.style.opacity = '1';
            xpFloat.style.transform = 'translateY(-30px)';
            setTimeout(() => {
              xpFloat.style.opacity = '0';
              xpFloat.style.transform = 'translateY(0)';
            }, 1600);
          }

          // Level up (corrigido: o objeto global é LevelUp, não Animations)
          if (resp && resp.level_up && typeof LevelUp !== 'undefined') {
            LevelUp.show(resp.novo_nivel);
          }

          // Refresh completo: reconstr\u00f3i o card corretamente + stats + XP + extrato
          setTimeout(() => this.atualizarStatsMini(), 600);

        } catch (err) {
          console.error('[Dashboard] Erro ao concluir tarefa:', err);
          btn.disabled = false;
          btn.textContent = '\u2713 Concluir';
        }
      });
    });
  },

  async atualizarStatsMini() {
    // Atualização completa: personagem, stats, extrato (rotinas) e tarefas
    try {
      const [perfil, stats, tarefasHoje] = await Promise.allSettled([
        API.auth.me(),
        API.get('/dashboard/stats'),
        API.tarefas.hoje(),
      ]);

      if (perfil.status === 'fulfilled' && perfil.value) {
        this.renderPersonagem(perfil.value);
      }
      if (stats.status === 'fulfilled' && stats.value) {
        this.renderStats(stats.value);
      }
      if (tarefasHoje.status === 'fulfilled') {
        // Preserva cache local para que a atualização seja suave
        this._tarefasHojeLista = tarefasHoje.value || [];
        this._renderTarefasFiltradas();
      }

      // Recarrega o extrato de rotinas (busca fresh do servidor)
      await this.carregarExtrato();

    } catch (_) {}
  },

  _getTituloByRank(rank) {
    const titulos = {
      'E': 'O Mais Fraco', 'D': 'Iniciante',
      'C': 'Promissor', 'B': 'Experiente',
      'A': 'Elite', 'S': 'Monarch'
    };
    return titulos[rank] || 'Hunter';
  }
};

