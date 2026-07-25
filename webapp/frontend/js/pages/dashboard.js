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
      // `/tarefas/hoje` saiu daqui: as missões gerais chegam pelo Extrato,
      // junto com as de rotina e com o mesmo cartão. Buscá-las de novo era
      // a segunda vitrine que fazia a mesma missão aparecer duas vezes.
      const [perfil, conquistas, dashStats] = await Promise.allSettled([
        API.auth.me(),
        API.conquistas.listar(),
        API.get('/dashboard/stats'),
      ]);

      // Perfil / personagem
      if (perfil.status === 'fulfilled' && perfil.value) {
        this.renderPersonagem(perfil.value);
      }

      // Extrato: fonte única das missões (rotinas + gerais, de todos os dias).
      // Os filtros precisam estar ligados ANTES do primeiro carregamento —
      // é deles que sai o intervalo de datas da consulta.
      this._bindFiltrosExtrato();
      const missoes = await this.carregarExtrato();

      // Stats (cards de contadores)
      if (dashStats.status === 'fulfilled' && dashStats.value) {
        this.renderStats(dashStats.value);
      } else {
        // Fallback: computa do que o extrato acabou de trazer. Restringe a HOJE
        // porque as placas são um retrato do dia, não do período filtrado.
        const hojeISO = this._isoLocal(new Date());
        const doDia = missoes.filter(m => String(m.data || '').slice(0, 10) === hojeISO);
        this.renderStats({
          execucoes_hoje:  doDia.filter(m => m.status === 'CONCLUIDA').length,
          total_execucoes: 0,
          rotinas_ativas:  doDia.filter(m => m.status === 'ATIVA').length,
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
      const [lista, altar] = await Promise.all([
        API.conquistas.listar(),
        API.perfil.reliquias().catch(() => ({ fixadas: [] })),
      ]);
      const todas = (lista || []).filter(c => c.desbloqueada).sort((a, b) => {
        if (a.desbloqueada_em && b.desbloqueada_em) return new Date(b.desbloqueada_em) - new Date(a.desbloqueada_em);
        return 0;
      });

      // Cinco, e só cinco: a sexta quebrava a linha e ficava órfã.
      // O hunter escolhe quais; sem escolha, as mais recentes.
      const fixadas = (altar.fixadas || [])
        .map(cod => todas.find(c => c.codigo === cod)).filter(Boolean);
      const desb = (fixadas.length ? fixadas : todas).slice(0, 5);
      if (!desb.length) {
        cont.innerHTML = `<span class="hunter-relicario-lbl">Nenhuma relíquia ainda — cumpra missões</span>`;
        return;
      }
      const medalha = c => (typeof ConquistaFX !== 'undefined' && ConquistaFX.miniMedalha)
        ? ConquistaFX.miniMedalha(c, 34) : (c.icone || '🏆');
      // Sem `title`: quem conta a história da relíquia agora é o
      // BadgeCard, não a caixinha cinza do sistema operacional.
      cont.innerHTML = `<span class="hunter-relicario-lbl">Relíquias</span>`
        + desb.map(c => `<span class="hunter-reliquia" data-bc="${c.codigo}">${medalha(c)}</span>`).join('')
        + (todas.length > 1
            ? `<button class="hunter-relicario-editar" id="dash-altar"
                 title="Escolher quais relíquias exibir">✎</button>` : '');
      cont.querySelectorAll('.hunter-reliquia').forEach(el =>
        el.addEventListener('click', () => window.App && App.navigate('perfil')));
      document.getElementById('dash-altar')?.addEventListener('click', () =>
        window.AltarReliquias?.abrir(() => this._renderRelicario()));
      window.BadgeCard?.ligarTodos('#dash-relicario [data-bc]', desb);
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
    window.BuscaHunters?.montar();   // idempotente: só monta uma vez

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
    // Aura: cosm\u00e9tica presenteada (aura_id) > aura de cargo.
    void (function _aplicarAura() {
      var _hw = document.querySelector("#hunter-card .hunter-hex-wrap");
      if (!_hw || !window.Auras) return;
      var _aid = dados.aura_id || null;
      if (_aid && Auras.existe(_aid)) {
        _hw.querySelector(".aura-wrap") && _hw.querySelector(".aura-wrap").remove();
        _hw.insertAdjacentHTML("afterbegin", Auras.bloco(_aid, 168));
      } else { Auras.aplicar(_hw, dados.nivel_acesso, 168); }
    }());
    window.__dashDados = dados;

    // Botão Editar Perfil
    const btnEdit = document.getElementById('dash-btn-editar-perfil');
    if (btnEdit) {
      btnEdit.onclick = () => {
        if (window.App) App.navigate('perfil');
      };
    }

    // Bot\u00e3o "Trocar Aura" injetado ao lado de Editar Perfil
    Dashboard._bindBtnTrocarAura(dados);

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

  // As tabelas de cor/icone que viviam aqui saíram com os cartões artesanais:
  // quem pinta status, tipo e categoria agora é o MissaoCard, sozinho.
  _extratoLista: [],          // última página do extrato, na forma canônica

  // ── Extrato de missões ─────────────────────────────────────────────────
  // Data local em YYYY-MM-DD. toISOString() devolveria o dia em UTC e, a oeste
  // de Greenwich, o extrato abriria mostrando "ontem" durante a madrugada.
  _isoLocal(d) {
    return d.getFullYear() + '-'
      + String(d.getMonth() + 1).padStart(2, '0') + '-'
      + String(d.getDate()).padStart(2, '0');
  },

  // O filtro de per\u00EDodo agora \u00E9 um INTERVALO DE DATAS de verdade. Antes ele era
  // traduzido para TIPO de rotina (semana -> SEMANAL), o que respondia a outra
  // pergunta: "quais regras se repetem toda semana" em vez de "o que aconteceu
  // nos \u00FAltimos sete dias". Era da\u00ED que vinha o extrato sempre vazio.
  _intervaloExtrato(periodo) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const fim = this._isoLocal(hoje);
    const recuar = (n) => {
      const d = new Date(hoje);
      d.setDate(d.getDate() - n);
      return this._isoLocal(d);
    };

    if (periodo === 'mes') {
      const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      return { inicio: this._isoLocal(primeiro), fim, dias: hoje.getDate() };
    }
    // "tudo" respeita o teto do backend (JANELA_MAXIMA_DIAS = 370): pedir mais
    // s\u00F3 faria a API recortar de volta em sil\u00EAncio.
    if (periodo === 'tudo')  return { inicio: recuar(365), fim, dias: 365 };
    if (periodo === '7dias') return { inicio: recuar(6),   fim, dias: 7  };
    if (periodo === '30dias')return { inicio: recuar(29),  fim, dias: 30 };
    return { inicio: fim, fim, dias: 1 };   // hoje
  },

  // Retorna a lista can\u00F4nica para quem chamou (carregar() usa no fallback dos
  // contadores) \u2014 assim ningu\u00E9m precisa refazer a mesma consulta.
  async carregarExtrato() {
    // Padrão TUDO: o extrato é um livro-caixa, e um livro-caixa abre mostrando
    // o que existe. Abrir em "hoje" escondia todo o histórico logo no momento
    // em que ele passou a existir. Quem quiser recortar o dia, recorta.
    const periodo   = document.getElementById('filtro-periodo')?.value   || 'tudo';
    const origem    = document.getElementById('filtro-origem')?.value    || '';
    const tipo      = document.getElementById('filtro-tipo')?.value      || '';
    const categoria = document.getElementById('filtro-categoria')?.value || '';
    const statusFil = document.getElementById('filtro-status-missao')?.value || '';

    const cont    = document.getElementById('lista-rotinas-hoje');
    const countEl = document.getElementById('rotinas-count');
    if (!cont) return [];

    cont.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--text-muted);font-family:var(--font-section);font-size:.75rem">\u23F3 Carregando...</div>';

    const janela = this._intervaloExtrato(periodo);

    try {
      // Todos os filtros v\u00E3o para a API: o backend \u00E9 quem sabe unir as duas
      // origens e normalizar o vocabul\u00E1rio de status entre elas.
      const q = new URLSearchParams({ inicio: janela.inicio, fim: janela.fim });
      if (origem)    q.set('origem', origem);
      if (tipo)      q.set('tipo', tipo);
      if (categoria) q.set('categoria', categoria);
      if (statusFil) q.set('status', statusFil);

      const resp  = await API.get('/extrato/?' + q.toString());
      const lista = (resp && resp.missoes) || [];
      this._extratoLista = lista;

      if (countEl) {
        const total  = resp?.total ?? lista.length;
        const abertas = lista.filter(m => !['CONCLUIDA', 'FRACASSADA', 'CANCELADA'].includes(m.status)).length;
        countEl.textContent = `${total} miss\u00E3o${total !== 1 ? '\u00F5es' : ''} \u00B7 ${abertas} em aberto`;
      }

      this._renderExtrato(lista, cont);
      this._renderResumoPeriodo(janela.dias);
      return lista;
    } catch (err) {
      cont.innerHTML = `<div class="empty-state"><div class="empty-icon">\u26A0\uFE0F</div><div>${err.message||'Erro ao carregar'}</div></div>`;
      return [];
    }
  },

  // Placa de resumo do per\u00EDodo (taxa de sucesso, XP ganho/perdido). \u00C9 uma
  // consulta barata e separada: se ela falhar, o extrato continua de p\u00E9.
  async _renderResumoPeriodo(dias) {
    const el = document.getElementById('extrato-resumo');
    if (!el) return;
    try {
      const r = await API.get('/extrato/resumo?dias=' + Math.max(1, dias));
      const c = r.contagem || {};
      const taxa = (r.taxa_sucesso === null || r.taxa_sucesso === undefined)
        ? '\u2014' : r.taxa_sucesso + '%';
      const bloco = (rotulo, valor, cor) => `
        <span style="display:inline-flex;align-items:baseline;gap:.28rem">
          <span style="font-family:var(--font-section);font-size:.58rem;letter-spacing:.1em;
            text-transform:uppercase;color:var(--text-muted)">${rotulo}</span>
          <b style="font-family:var(--font-section);font-size:.72rem;color:${cor}">${valor}</b>
        </span>`;
      el.innerHTML =
        bloco('Taxa', taxa, '#a855f7') +
        bloco('Cumpridas', c.CONCLUIDA || 0, '#10b981') +
        bloco('Fracassadas', c.FRACASSADA || 0, '#ef4444') +
        bloco('XP', '+' + (r.xp_ganho || 0), 'var(--gold-xp)') +
        ((r.xp_perdido || 0) > 0 ? bloco('Perdido', '\u2212' + r.xp_perdido, '#f87171') : '');
      el.style.display = 'flex';
    } catch (_) {
      el.innerHTML = '';
      el.style.display = 'none';
    }
  },

  // Cabeçalho humano do dia. new Date("2026-07-24") seria lido como UTC e
  // voltaria um dia aqui no fuso de Brasília — por isso a data ISO é quebrada
  // à mão em componentes locais.
  _rotuloDia(iso) {
    if (!iso || iso === 'sem-data') return 'Sem data';
    const [a, m, d] = iso.split('-').map(Number);
    if (!a || !m || !d) return iso;
    const dt = new Date(a, m - 1, d);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dif = Math.round((dt - hoje) / 86400000);
    if (dif === 0)  return 'Hoje';
    if (dif === -1) return 'Ontem';
    if (dif === 1)  return 'Amanhã';
    // pt-BR devolve "quarta-feira"; o "-feira" só rouba largura do cabeçalho.
    const semana = dt.toLocaleDateString('pt-BR', { weekday: 'long' }).replace('-feira', '');
    return `${semana}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
  },

  // Mini-placar do dia: o veredito antes dos detalhes. Ler "3 cumpridas ·
  // 1 fracassada" vale mais do que contar cartões um a um.
  _resumoDoDia(itens) {
    const n = (st) => itens.filter(m => (m.status || 'PENDENTE') === st).length;
    const ok = n('CONCLUIDA'), ko = n('FRACASSADA'), cc = n('CANCELADA');
    const abertas = itens.length - ok - ko - cc;
    const partes = [];
    if (ok) partes.push(`<b style="color:#10b981">${ok}</b> cumprida${ok > 1 ? 's' : ''}`);
    if (ko) partes.push(`<b style="color:#ef4444">${ko}</b> fracassada${ko > 1 ? 's' : ''}`);
    if (cc) partes.push(`<b style="color:#64748b">${cc}</b> cancelada${cc > 1 ? 's' : ''}`);
    if (abertas > 0) partes.push(`<b style="color:#a855f7">${abertas}</b> em aberto`);
    return partes.join(' · ');
  },

  _renderExtrato(lista, cont) {
    const ocultar = localStorage.getItem('sr_ocultar_concluidas_extrato') === 'true';
    const toggle  = document.getElementById('toggle-ocultar-extrato');
    if (toggle) toggle.checked = ocultar;

    // Esconde SÓ as concluídas, nunca as fracassadas: o extrato existe
    // justamente para o hunter encarar o que perdeu. O rótulo do controle
    // também promete apenas "ocultar concluídas".
    if (ocultar) lista = lista.filter(m => (m.status || 'PENDENTE') !== 'CONCLUIDA');

    if (!lista.length) {
      // Não existe backfill: os dias anteriores a esta versão simplesmente não
      // têm registro. Sem esta explicação o extrato vazio parece defeito.
      cont.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <div>Nenhuma missão neste período</div>
          <div style="font-size:.7rem;color:var(--text-muted);margin-top:.35rem;max-width:30rem;line-height:1.5">
            O histórico começa a ser gravado a partir de agora — dias anteriores
            não têm registro. Cumpra as missões de hoje e o extrato se preenche sozinho.
          </div>
        </div>`;
      return;
    }

    // ── Agrupamento por dia ──────────────────────────────────────────
    // A API já devolve mais recente primeiro e, dentro do dia, o que ainda
    // pede ação no topo. O Map preserva essa ordem de chegada, então basta
    // empilhar; reordenar aqui só desfaria o critério do backend.
    const porDia = new Map();
    lista.forEach(m => {
      const dia = String(m.data || '').slice(0, 10) || 'sem-data';
      if (!porDia.has(dia)) porDia.set(dia, []);
      porDia.get(dia).push(m);
    });

    if (typeof MissaoCard === 'undefined') {
      cont.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><div>Componente de missão não carregado</div></div>';
      return;
    }

    // A lista canônica do /extrato/ já traz uid — é ela que vai para o cache.
    MissaoCard.cachear(lista, { modo: 'missao' });

    // Cabeçalho grudento: a lista rola dentro de uma caixa baixa, e sem o
    // sticky o hunter perde de vista de que dia é a faixa que está lendo.
    cont.innerHTML = [...porDia.entries()].map(([dia, itens]) => `
      <section style="margin-bottom:.9rem">
        <header style="position:sticky;top:0;z-index:3;display:flex;align-items:baseline;
          gap:.5rem;flex-wrap:wrap;padding:.35rem .15rem;margin-bottom:.45rem;
          background:var(--bg-card);border-bottom:1px solid rgba(124,58,237,.2)">
          <span style="font-family:var(--font-section);font-size:.74rem;font-weight:700;
            letter-spacing:.05em;color:var(--purple-glow);text-transform:capitalize">${this._rotuloDia(dia)}</span>
          <span style="font-family:var(--font-section);font-size:.62rem;color:var(--text-muted)">${this._resumoDoDia(itens)}</span>
        </header>
        <div style="display:flex;flex-direction:column;gap:.5rem">
          ${itens.map(m => MissaoCard.html(m, { compacto: true })).join('')}
        </div>
      </section>`).join('');

    MissaoCard.montar(cont, {
      onMudou: () => this.atualizarStatsMini(),
      onAcao:  (acao, idAlvo, m) => this._gerirMissaoExtrato(acao, idAlvo, m),
    });
  },

  // Editar/excluir não são executadas pelo card — ele delega para a página dona
  // do formulário. E são páginas DIFERENTES conforme a origem: mandar uma
  // missão geral para Rotinas abriria o formulário errado (e apagaria a rotina
  // de mesmo id, já que ExecucaoDia.id e TarefaDia.id colidem).
  async _gerirMissaoExtrato(acao, idAlvo, m) {
    if (acao !== 'editar' && acao !== 'excluir') return;
    const dados = m || {};
    const geral = dados.origem === 'geral';

    // Rotinas e Tarefas são const de topo: não viram propriedade de window.
    const pagina = geral
      ? (typeof Tarefas !== 'undefined' ? Tarefas : null)
      : (typeof Rotinas !== 'undefined' ? Rotinas : null);
    if (!pagina) {
      if (typeof SoloDialog !== 'undefined')
        SoloDialog.toast('Abra a guia correspondente para editar esta missão.', 'info');
      return;
    }

    try {
      if (geral) {
        // Na origem geral a ocorrência É o registro editável: idAlvo (já
        // roteado pelo card) é o id da TarefaDia. Só os nomes de campo mudam.
        const alvo = { ...dados, id: idAlvo, hora_limite: dados.hora_fim, data_prevista: dados.data };
        if (acao === 'editar') pagina.abrirFormulario(alvo);
        else                   await pagina.confirmarExcluir(alvo);
      } else if (acao === 'editar') {
        // A missão canônica não carrega dias_semana/dia_mes/mes_dia — abrir o
        // formulário só com o que ela tem zeraria a recorrência ao salvar.
        // Por isso busca a REGRA crua antes.
        pagina.abrirFormulario(await API.get('/rotinas/' + idAlvo));
      } else {
        await pagina.confirmarExcluir({ id: idAlvo, titulo: dados.titulo });
      }
    } catch (err) {
      if (typeof SoloDialog !== 'undefined')
        SoloDialog.toast('Não consegui abrir a missão: ' + (err.message || err), 'error');
      return;
    }
    if (acao === 'excluir') this.carregarExtrato();
  },



  _bindFiltrosExtrato() {
    const IDS = ['filtro-periodo','filtro-origem','filtro-tipo',
                 'filtro-categoria','filtro-status-missao'];

    const bind = (id) => {
      const el = document.getElementById(id);
      if (el && !el._extratoListenerAdded) {
        el.addEventListener('change', () => {
          this._marcarFiltrosAtivos();
          this.carregarExtrato();
        });
        el._extratoListenerAdded = true;
      }
    };
    IDS.forEach(bind);
    this._marcarFiltrosAtivos();

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

  /* Acende o filtro que está recortando a lista. Sem isto, uma lista curta
     por causa de um filtro esquecido parece uma lista vazia por falta de
     dados — e o hunter conclui que o extrato está quebrado.
     "Tudo" e "Todas" são o repouso: não acendem. */
  _marcarFiltrosAtivos() {
    ['filtro-periodo','filtro-origem','filtro-tipo',
     'filtro-categoria','filtro-status-missao'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const emRepouso = el.value === '' || el.value === 'tudo';
      el.classList.toggle('sr-filtro-ativo', !emRepouso);
    });
  },

  // Todo relógio do Dashboard morre aqui. O app.js chama isto ao trocar de
  // página; um setInterval esquecido continua repintando um DOM que já foi
  // embora e, no caso do MissaoCard, segurando a lista inteira na memória.
  _pararTimerDash() {
    if (this._tarefaTimer)   { clearInterval(this._tarefaTimer);   this._tarefaTimer   = null; }
    if (this._modalCdTimer)  { clearInterval(this._modalCdTimer);  this._modalCdTimer  = null; }
    // Zerar a referência importa: _iniciarSussurros usa ela como trava de
    // idempotência, então sem isso a placa nunca voltaria a falar.
    if (this._sussurroTimer) { clearInterval(this._sussurroTimer); this._sussurroTimer = null; }
    if (typeof MissaoCard !== 'undefined' && MissaoCard.pararTimer) MissaoCard.pararTimer();
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

  /* _buildMissaoItem foi REMOVIDO. Era o cartao artesanal da secao
     "Missoes Gerais de Hoje", extinta: as missoes gerais agora usam o
     MissaoCard no Extrato, igual as de rotina. Ele havia sobrevivido a
     unificacao dos cartoes e voltou a aparecer na tela, com visual e
     comportamento proprios, ao lado do cartao novo. */



  async atualizarStatsMini() {
    // Atualização completa: personagem, stats, extrato (rotinas) e tarefas
    try {
      const [perfil, stats] = await Promise.allSettled([
        API.auth.me(),
        API.get('/dashboard/stats'),
      ]);

      if (perfil.status === 'fulfilled' && perfil.value) {
        this.renderPersonagem(perfil.value);
      }
      if (stats.status === 'fulfilled' && stats.value) {
        this.renderStats(stats.value);
      }

      // Extrato por último: ele reflete o estado que as chamadas acima acabaram
      // de mudar, e o backend ainda aproveita para fechar os dias vencidos.
      await this.carregarExtrato();

    } catch (_) {}
  },


  /* ─── Aura: botão no cabeçalho + modal de inventário ───────────────── */
  _bindBtnTrocarAura(dados) {
    // Injeta botão ◈ DENTRO do .hunter-hex-wrap, logo abaixo do avatar
    const hexWrap = document.querySelector('#hunter-card .hunter-hex-wrap');

    // Remove instância anterior para recriar sempre atualizado
    document.getElementById('dash-btn-trocar-aura')?.remove();

    const btn = document.createElement('button');
    btn.id = 'dash-btn-trocar-aura';

    if (hexWrap) {
      // hexWrap já tem position:relative no CSS — botão fica dentro dele
      hexWrap.style.position = 'relative';   // garante, caso o CSS mude
      btn.style.cssText = [
        'position:absolute',
        'bottom:-14px',
        'left:50%',
        'transform:translateX(-50%)',
        'width:28px', 'height:28px',
        'border-radius:50%',
        'background:linear-gradient(135deg,#2a0a3e,#130a28)',
        'border:1.5px solid rgba(244,143,177,.65)',
        'color:#f48fb1',
        'font-size:.72rem',
        'cursor:pointer',
        'z-index:20',
        'box-shadow:0 0 10px rgba(244,143,177,.3),inset 0 0 6px rgba(244,143,177,.1)',
        'display:flex', 'align-items:center', 'justify-content:center',
        'transition:box-shadow .2s,background .2s',
        'padding:0',
      ].join(';');
      btn.onmouseover = () => {
        btn.style.boxShadow = '0 0 18px rgba(244,143,177,.6),inset 0 0 8px rgba(244,143,177,.2)';
        btn.style.background = 'linear-gradient(135deg,#3e1060,#1a0a38)';
      };
      btn.onmouseout = () => {
        btn.style.boxShadow = '0 0 10px rgba(244,143,177,.3),inset 0 0 6px rgba(244,143,177,.1)';
        btn.style.background = 'linear-gradient(135deg,#2a0a3e,#130a28)';
      };
      hexWrap.appendChild(btn);
    } else {
      // Fallback: ao lado do Editar Perfil
      const fc = document.getElementById('dash-btn-editar-perfil')?.parentElement;
      if (!fc) return;
      btn.className = 'btn btn-ghost btn-sm';
      btn.style.cssText = [
        'font-family:var(--font-section)', 'font-size:.75rem', 'letter-spacing:.06em',
        'border:1px solid rgba(244,143,177,.4)', 'color:#f48fb1',
        'padding:.35rem .9rem', 'border-radius:.5rem', 'cursor:pointer',
        'transition:all .2s', 'display:flex', 'align-items:center', 'gap:.4rem',
      ].join(';');
      btn.onmouseover = () => btn.style.background = 'rgba(244,143,177,.12)';
      btn.onmouseout  = () => btn.style.background = 'transparent';
      fc.insertBefore(btn, fc.firstChild);
    }

    const temAura = !!(dados && dados.aura_id);
    btn.innerHTML = '◈';
    btn.title     = temAura ? `Aura ativa: ${dados.aura_id}` : 'Gerenciar Aura';
    // onclick direto — sem bind antigo que pode ter sido perdido
    btn.addEventListener('click', () => Dashboard._abrirModalAura(window.__dashDados || dados));
  },


  async _abrirModalAura(dados) {
    document.getElementById('dash-modal-aura')?.remove();
    let inv = [];
    try {
      // Token correto: sr_token (igual à classe API)
      const tk = localStorage.getItem('sr_token');
      const r  = await fetch('/api/perfil/auras-inventario', {
        headers: { Authorization: `Bearer ${tk}` }
      });
      const d  = await r.json();
      inv      = d.inventario || [];
    } catch (_) {}

    const cx = document.createElement('div');
    cx.id    = 'dash-modal-aura';
    cx.style.cssText = 'position:fixed;inset:0;z-index:8999;display:flex;align-items:center;' +
      'justify-content:center;background:rgba(2,2,6,.94);backdrop-filter:blur(10px);padding:1rem';

    const auraAtiva   = (dados && dados.aura_id) || null;
    const auraAtivaCat = auraAtiva ? inv.find(a => (a.id || a.aura_id) === auraAtiva) : null;

    /* ── Seção: aura equipada atualmente ── */
    const ativaSection = auraAtivaCat ? (() => {
      const aId = auraAtivaCat.id || auraAtivaCat.aura_id;
      const blocoSvg = (window.Auras && Auras.bloco) ? Auras.bloco(aId, 96) : '';
      return `<div style="
          background:linear-gradient(135deg,rgba(251,191,36,.12),rgba(251,191,36,.04));
          border:1px solid rgba(251,191,36,.3);border-radius:14px;padding:1rem 1.2rem;
          margin-bottom:1.2rem;display:flex;align-items:center;gap:1rem">
        <div style="position:relative;width:96px;height:96px;flex-shrink:0;
          display:flex;align-items:center;justify-content:center">
          ${blocoSvg}
          <div style="position:absolute;z-index:2;width:38px;height:38px;
            background:linear-gradient(135deg,#1a1030,#0d1f36);
            clip-path:polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)"></div>
        </div>
        <div style="flex:1">
          <div style="color:#fbbf24;font-size:.52rem;letter-spacing:.14em;
            font-family:var(--font-section);margin-bottom:.25rem">⬡ EQUIPADA ATUALMENTE</div>
          <div style="color:#f0c060;font-weight:700;font-size:.9rem;
            font-family:var(--font-section)">${auraAtivaCat.nome || aId}</div>
          <div style="color:#64748b;font-size:.6rem;font-family:var(--font-section);
            margin-top:.2rem">${auraAtivaCat.descricao || ''}</div>
        </div>
        <button onclick="Dashboard._removerAura()" style="
          padding:.3rem .75rem;border-radius:8px;cursor:pointer;white-space:nowrap;
          background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);
          color:#f87171;font-family:var(--font-section);font-size:.6rem;font-weight:700;
          transition:all .18s"
          onmouseover="this.style.background='rgba(239,68,68,.22)'"
          onmouseout="this.style.background='rgba(239,68,68,.1)'">Desequipar</button>
      </div>`;
    })() : '';

    /* ── Grade de auras (2 colunas, tamanho grande, com animação) ── */
    const gridItens = inv.map(function(a) {
      const aId   = a.id || a.aura_id;
      const ativa = auraAtiva === aId;
      const traved = !!a.de_cargo;
      // Aura grande com animação completa (tamanho 112 = mesmo da Vitrine)
      const blocoSvg = (window.Auras && Auras.bloco) ? Auras.bloco(aId, 112) : `<span style="font-size:3rem;opacity:.3">◈</span>`;
      const labelEquip = ativa
        ? (traved
            ? '<div style="font-size:.52rem;color:#475569;font-family:var(--font-section)">⬡ CARGO · EQUIPADA</div>'
            : '<div style="color:#fbbf24;font-size:.55rem;font-family:var(--font-section);letter-spacing:.06em">⬡ EQUIPADA</div>')
        : (traved
            ? '<div style="font-size:.52rem;color:#334155;font-family:var(--font-section)">🔒 Vinculada ao cargo</div>'
            : '');
      const btnAtivar = traved && ativa
        ? `<button onclick="Dashboard._removerAura()" style="
            margin-top:.5rem;padding:.25rem .7rem;border-radius:6px;cursor:pointer;
            background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);
            color:#f87171;font-family:var(--font-section);font-size:.6rem;font-weight:700;
            transition:all .18s"
            onmouseover="this.style.background='rgba(239,68,68,.22)'"
            onmouseout="this.style.background='rgba(239,68,68,.1)'">Desequipar</button>`
        : (!traved && !ativa
            ? `<button onclick="Dashboard._ativarAura('${aId}')" style="
                margin-top:.5rem;padding:.25rem .7rem;border-radius:6px;border:none;cursor:pointer;
                background:rgba(251,191,36,.15);border:1px solid rgba(251,191,36,.3);
                color:#fbbf24;font-family:var(--font-section);font-size:.6rem;font-weight:700;
                transition:all .18s"
                onmouseover="this.style.background='rgba(251,191,36,.28)'"
                onmouseout="this.style.background='rgba(251,191,36,.15)'">Equipar</button>`
            : '');
      return `<div style="
          background:${ativa ? 'rgba(251,191,36,.08)' : 'rgba(255,255,255,.02)'};
          border:1px solid ${ativa ? 'rgba(251,191,36,.35)' : 'rgba(255,255,255,.07)'};
          border-radius:14px;padding:1rem .75rem;
          display:flex;flex-direction:column;align-items:center;gap:.4rem;
          transition:border-color .2s;cursor:${traved ? 'default' : 'pointer'}"
          ${!traved && !ativa ? `onclick="Dashboard._ativarAura('${aId}')"` : ''}>
        <div style="position:relative;width:112px;height:112px;
          display:flex;align-items:center;justify-content:center">
          ${blocoSvg}
          <div style="position:absolute;z-index:2;width:44px;height:44px;
            background:linear-gradient(135deg,#1a1030,#0d1f36);
            clip-path:polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)"></div>
        </div>
        <div style="text-align:center">
          <div style="font-family:var(--font-section);font-size:.72rem;
            color:${a.cor || '#e2e8f0'};font-weight:700">${a.nome || aId}</div>
          ${labelEquip}
          ${btnAtivar}
        </div>
      </div>`;
    }).join('');

    const semAuras = `<div style="text-align:center;padding:3rem 1rem">
      <div style="font-size:2.5rem;opacity:.2;margin-bottom:.8rem">◈</div>
      <div style="font-family:var(--font-section);font-size:.82rem;color:#475569">Nenhuma aura no inventário</div>
      <div style="font-family:var(--font-section);font-size:.6rem;color:#334155;margin-top:.3rem">Forje uma na aba Materiais ou peça ao Arquiteto</div>
    </div>`;

    cx.innerHTML =
      `<div style="width:min(560px,98%);max-height:88vh;overflow-y:auto;
          padding:1.6rem;border-radius:20px;
          background:linear-gradient(160deg,#09060f 0%,#050310 60%,#030208 100%);
          border:1px solid rgba(251,191,36,.2);
          box-shadow:0 0 60px rgba(251,191,36,.08),0 0 120px rgba(60,10,120,.1)">
        <!-- Header -->
        <div style="display:flex;align-items:center;gap:.8rem;margin-bottom:1.4rem">
          <div style="width:38px;height:38px;border-radius:50%;flex-shrink:0;
            background:linear-gradient(135deg,rgba(251,191,36,.2),rgba(251,191,36,.06));
            border:1px solid rgba(251,191,36,.3);
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 0 16px rgba(251,191,36,.2);font-size:1.1rem;color:#fbbf24">◈</div>
          <div style="flex:1">
            <div style="font-family:var(--font-title);font-size:1.05rem;color:#f0c060;
              text-shadow:0 0 20px rgba(251,191,36,.3)">Minhas Auras</div>
            <div style="font-family:var(--font-section);font-size:.52rem;letter-spacing:.14em;
              color:#334155;margin-top:.1rem">INVENTÁRIO PESSOAL</div>
          </div>
          <button onclick="document.getElementById('dash-modal-aura').remove()"
            style="width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.04);
            border:1px solid rgba(255,255,255,.08);color:#475569;font-size:.9rem;cursor:pointer;
            display:flex;align-items:center;justify-content:center;transition:all .18s"
            onmouseover="this.style.background='rgba(255,255,255,.09)'"
            onmouseout="this.style.background='rgba(255,255,255,.04)'">✕</button>
        </div>
        <!-- Aura equipada -->
        ${ativaSection}
        <!-- Grade de auras (2 colunas) -->
        ${inv.length
          ? `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.75rem">${gridItens}</div>`
          : semAuras}
      </div>`;

    cx.addEventListener('click', e => { if (e.target === cx) cx.remove(); });
    document.body.appendChild(cx);
  },


  async _ativarAura(auraId) {
    try {
      const tk = localStorage.getItem('sr_token');
      const r  = await fetch('/api/perfil/aura', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ aura_id: auraId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || 'Erro');
      const hexWrap = document.querySelector('#hunter-card .hunter-hex-wrap');
      if (hexWrap && window.Auras && Auras.existe(auraId)) {
        const old = hexWrap.querySelector('.aura-wrap');
        if (old) old.remove();
        hexWrap.insertAdjacentHTML('afterbegin', Auras.bloco(auraId, 168));
      }
      if (window.__dashDados) window.__dashDados.aura_id = auraId;
      document.getElementById('dash-modal-aura')?.remove();
      Dashboard._abrirModalAura(window.__dashDados || { aura_id: auraId });
    } catch (e) { alert('Erro: ' + e.message); }
  },

  async _removerAura() {
    try {
      const tk = localStorage.getItem('sr_token');
      const r  = await fetch('/api/perfil/aura', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ aura_id: null }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail); }
      if (window.__dashDados) window.__dashDados.aura_id = null;
      const hexWrap = document.querySelector('#hunter-card .hunter-hex-wrap');
      if (hexWrap && window.Auras) {
        const dados = window.__dashDados;
        if (dados) Auras.aplicar(hexWrap, dados.nivel_acesso, 168);
      }
      document.getElementById('dash-modal-aura')?.remove();
      await Dashboard.carregar(); // refresh completo do dashboard
    } catch (e) { alert('Erro: ' + e.message); }
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

