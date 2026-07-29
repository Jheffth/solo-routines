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

  /* ══════════════════════════════════════════════════════════
     A JANELA DE STATUS SAIU DAQUI

     O desenho do cartão do hunter — cores de rank, contagem dos
     cristais, partículas, relicário, botão de aura — virou uma
     PEÇA: js/pecas/hunter-card-classico.js. Eram ~310 das 1.231
     linhas deste arquivo.

     O que sobrou aqui é o papel do hospedeiro:

        BUSCAR o dado, ENTREGAR à peça, ATENDER o que ela pedir.

     O Dashboard não sabe mais desenhar o cartão, e é isso que
     permite que a mesma peça seja montada na Vitrine e no Perfil
     sem uma segunda implementação. Havia uma: o `renderHeroCard()`
     do perfil.js, que já tinha divergido desta.
     ══════════════════════════════════════════════════════════ */

  // O contêiner vazio que a peça ocupa. Continua sendo #hunter-card
  // porque o CSS e o console do Arquiteto procuram por esse id.
  _slotBanner() { return document.getElementById('hunter-card'); },

  /* ── Qual peça montar ──

     A escolha é uma PREFERÊNCIA, não um deploy: trocar é mudar um
     valor, e voltar atrás é mudá-lo de novo. Nada de reverter
     commit para desfazer uma decisão de gosto.

     Hoje mora em localStorage. Quando virar campo do usuário no
     banco, é só esta função que muda — o resto do app não sabe que
     existe escolha.

     O padrão continua sendo a Janela de Status clássica. A V4 entra
     por opção do Arquiteto, para que a primeira coisa que ele veja
     ao abrir não seja uma mudança que ninguém verificou na tela. */
  /* A escolha do banner mora no REGISTRO, não aqui: o Perfil monta a
     mesma peça, e uma preferência guardada dentro do Dashboard não
     chegaria lá. Trocar o banner tem que trocar em toda parte. */
  _pecaBanner() {
    const slot = this._slotBanner();
    return Pecas.escolhida('banner', slot && slot.dataset.pecaPadrao);
  },

  _opcoesBanner() { return Pecas.opcoesDe('banner'); },

  /* Trocar de banner, do console ou de um futuro botão:
       Dashboard.usarBanner('banner-v4')
       Dashboard.usarBanner('banner-v4', {campo:'brasa'})
       Dashboard.usarBanner(null)               → volta ao padrão  */
  usarBanner(id, opcoes) {
    Pecas.escolher('banner', id, opcoes);
    const slot = this._slotBanner();
    if (slot) Pecas.desmontar(slot);
    if (window.__dashDados) this._montarBanner(window.__dashDados);
    return this._pecaBanner();
  },

  /* ── Relíquias: o hospedeiro busca, a peça desenha ──
     Antes isto DESENHAVA (era `_renderRelicario`). Agora só traz o
     dado. A peça deixou de chamar a API por conta própria — do
     contrário, cada preview na Vitrine dispararia duas requisições. */
  async _carregarReliquias() {
    try {
      const [lista, altar] = await Promise.all([
        API.conquistas.listar(),
        API.perfil.reliquias().catch(() => ({ fixadas: [] })),
      ]);
      const todas = (lista || []).filter(c => c.desbloqueada).sort((a, b) => {
        if (a.desbloqueada_em && b.desbloqueada_em) return new Date(b.desbloqueada_em) - new Date(a.desbloqueada_em);
        return 0;
      });
      return { reliquias: todas, reliquias_fixadas: altar.fixadas || [] };
    } catch (_) { return { reliquias: [], reliquias_fixadas: [] }; }
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

  /* ══════════════════════════════════════════════════════════
     O HOSPEDEIRO

     Antes esta função tinha 127 linhas e fazia duas coisas
     misturadas: desenhava o cartão e cuidava do resto da página.
     Ao separar, ficou claro que só a segunda metade era dela.

     Agora: monta (ou repinta) a peça no slot, e trata do que NÃO é
     o cartão — barra lateral, sussurros, chip de dungeon, busca de
     hunters e o gancho de reset do Arquiteto.
     ══════════════════════════════════════════════════════════ */
  renderPersonagem(dados) {
    this._iniciarSussurros();
    window.__dashDados = dados;

    this._montarBanner(dados);

    // ── Daqui para baixo: o que NÃO é o cartão ──
    const sbNome = document.getElementById('sidebar-nome');
    if (sbNome) sbNome.textContent = dados.nome || 'Hunter';

    const sbRank = document.getElementById('sidebar-rank');
    if (sbRank) {
      if (dados.nivel_acesso === 'Arquiteto') {
        sbRank.innerHTML = `<span style="color:#fbbf24;font-weight:700">&#9733; Arquiteto &#9733;</span>`;
      } else {
        sbRank.textContent = `${dados.classe || 'E-Rank'} \u2014 Nv.${dados.nivel_atual || 1}`;
      }
    }

    if (dados.avatar_url) {
      const sb = document.getElementById('sidebar-avatar');
      if (sb) sb.innerHTML = `<img src="${dados.avatar_url}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    }

    this._renderChipDungeon();
    window.BuscaHunters?.montar();   // idempotente: só monta uma vez

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

  /* ── Montar ou repintar a peça ──

     MONTAR é a primeira vez; REPINTAR é toda vez depois. A
     distinção não é economia: `atualizarNumeros()` chama isto a
     cada ação do hunter, e remontar faria o cartão inteiro piscar —
     o mesmo incômodo já corrigido nas listas de missão.

     As relíquias chegam DEPOIS, por serem duas chamadas de rede. O
     cartão aparece na hora com o que já se sabe e completa quando
     elas chegam. Era assim antes, e continua. */
  _montarBanner(dados) {
    const slot = this._slotBanner();
    if (!slot || typeof Pecas === 'undefined') return;

    const pacote = { hunter: dados };

    if (slot.__peca) {
      // Repintura: preserva as relíquias já carregadas, senão elas
      // sumiriam a cada atualização de número.
      Object.assign(pacote, {
        reliquias:         slot.__peca.dados?.reliquias || [],
        reliquias_fixadas: slot.__peca.dados?.reliquias_fixadas || [],
      });
      Pecas.atualizar(slot, pacote);
    } else {
      Pecas.montar(slot, this._pecaBanner(), pacote, {
        acoes:  this._acoesBanner(),
        opcoes: this._opcoesBanner(),
      });
    }

    // As relíquias completam o cartão quando chegarem.
    this._carregarReliquias().then(r => {
      if (!slot.__peca) return;
      Pecas.atualizar(slot, Object.assign({ hunter: window.__dashDados || dados }, r));
    });
  },

  /* ── O que a peça pode PEDIR ──

     Aqui está a inversão de dependência inteira. A peça não navega,
     não abre modal e não conhece um id deste arquivo: ela pede pelo
     nome, e quem decide o que acontece é o Dashboard.

     Trocar a peça por outra não muda nada nesta lista — é o que
     torna a V4 aplicável sem reescrever o hospedeiro. */
  _acoesBanner() {
    return {
      'editar-perfil':  () => window.App && App.navigate('perfil'),
      'ver-reliquias':  () => window.App && App.navigate('perfil'),
      'trocar-aura':    () => this._abrirModalAura(window.__dashDados || {}),
      'editar-altar':   () => window.AltarReliquias?.abrir(() => this._repintarBanner()),

      /* Pedida só pela V4. Uma ação que a peça montada não usa não
         custa nada — e é o hospedeiro que decide o que ela faz, por
         isso a mesma V4 pode existir na Vitrine sem salvar nada. */
      'editar-epigrafe': () => this._editarEpigrafe(),
    };
  },

  /* A epígrafe (bio) do hunter. Veio do estandarte.js, onde usava
     `Swal.fire` — biblioteca que o resto do app não usa. Aqui é o
     SoloDialog, que é o diálogo do projeto. */
  async _editarEpigrafe() {
    const atual = (window.__dashDados && window.__dashDados.bio) || '';
    const nova = await SoloDialog.prompt(
      'Qual a sua epígrafe? (até 100 caracteres)',
      { titulo: 'Editar Citação', valor: atual, maxlength: 100, btnOk: 'Gravar' }
    );
    // `null` é cancelamento. String vazia NÃO é: quem quer apagar a
    // própria epígrafe tem direito de apagá-la.
    if (nova === null) return;
    try {
      await API.put('/perfil/', { bio: nova });
      if (window.__dashDados) window.__dashDados.bio = nova;
      this._repintarBanner();
      SoloDialog.toast('Epígrafe gravada.', 'success');
    } catch (e) {
      SoloDialog.toast('Não foi possível salvar a epígrafe.', 'error');
    }
  },

  // Repinta o cartão com o dado que já está em mãos, buscando as
  // relíquias de novo. Usado depois que o Altar muda a escolha.
  async _repintarBanner() {
    const slot = this._slotBanner();
    if (!slot || !slot.__peca) return;
    const r = await this._carregarReliquias();
    Pecas.atualizar(slot, Object.assign({ hunter: window.__dashDados || {} }, r));
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
    // "tudo" respeita o teto do backend (agora JANELA_MAXIMA_DIAS = 800)
    // Cobre 365 dias para trás e 365 dias para frente (futuro).
    if (periodo === 'tudo')  return { inicio: recuar(365), fim: recuar(-365), dias: 730 };
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

    const htmlAtual = cont.innerHTML.trim();
    const silencioso = htmlAtual.length > 0 && !htmlAtual.includes('Carregando') && !htmlAtual.includes('Nenhuma missão');
    if (!silencioso) {
      cont.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--text-muted);font-family:var(--font-section);font-size:.75rem">\u23F3 Carregando...</div>';
    }

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
        const abertas = lista.filter(m => !['CONCLUIDA', 'FRACASSADA', 'CANCELADA', 'CONFESSADA'].includes(m.status)).length;
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

    // ── RECONCILIAÇÃO, NÃO DEMOLIÇÃO ────────────────────────────────
    // Este bloco era um `cont.innerHTML = ...` que jogava a lista fora e a
    // redesenhava do zero. Funcionava, e piscava: a cada missão iniciada, ou
    // criada, TODOS os cartões morriam e renasciam. Além do tremor, isso
    // perdia a posição da rolagem e cortava qualquer animação em curso.
    //
    // Agora comparamos com o que já está na tela: cartão que não mudou é
    // deixado em paz (continua sendo o MESMO elemento do DOM), cartão que
    // mudou é repintado, cartão novo entra na posição certa, cartão que saiu
    // é removido. Quem chega ganha uma entrada suave — e só quem chega.
    // `mc-lista` marca este container como referência de largura para os
    // cartões (container-type: inline-size em missao-card.css). Sem isso o
    // cartão volta a medir a JANELA, e quebra em monitor médio — onde a
    // janela tem folga mas a coluna não.
    cont.classList.add('mc-lista');

    const html = [...porDia.entries()].map(([dia, itens]) => `
      <section data-dia="${dia}" style="margin-bottom:.9rem">
        <header style="position:sticky;top:0;z-index:3;display:flex;align-items:baseline;
          gap:.5rem;flex-wrap:wrap;padding:.35rem .15rem;margin-bottom:.45rem;
          background:var(--bg-card);border-bottom:1px solid rgba(124,58,237,.2)">
          <span style="font-family:var(--font-section);font-size:.74rem;font-weight:700;
            letter-spacing:.05em;color:var(--purple-glow);text-transform:capitalize">${this._rotuloDia(dia)}</span>
          <span data-resumo-dia style="font-family:var(--font-section);font-size:.62rem;color:var(--text-muted)">${this._resumoDoDia(itens)}</span>
        </header>
        <div data-cartoes style="display:flex;flex-direction:column;gap:.5rem">
          ${itens.map(m => MissaoCard.html(m, { compacto: true })).join('')}
        </div>
      </section>`).join('');

    this._reconciliar(cont, html);

    MissaoCard.montar(cont, {
      // Só os NÚMEROS do topo. Recarregar o extrato daqui seria circular:
      // a ação repinta o cartão, e o extrato voltaria para apagá-lo e
      // redesenhá-lo — o piscar que estamos removendo.
      onMudou: () => this.atualizarNumeros(),
      onAcao:  (acao, idAlvo, m) => this._gerirMissaoExtrato(acao, idAlvo, m),
    });
  },

  /* Aplica o HTML novo preservando os nós que não mudaram.

     A comparação é por `outerHTML`: se o cartão gerado é idêntico ao que já
     está lá, o elemento antigo permanece — mesma referência, mesma rolagem,
     mesma animação. É uma reconciliação humilde (sem chaves nem árvore), mas
     resolve o caso real: listas de cartões que mudam de um em um. */
  _reconciliar(cont, htmlNovo) {
    const molde = document.createElement('div');
    molde.innerHTML = htmlNovo;

    const secoesAtuais = new Map(
      [...cont.querySelectorAll(':scope > section[data-dia]')].map(s => [s.dataset.dia, s]));

    const novas = [...molde.querySelectorAll(':scope > section[data-dia]')];
    const vistos = new Set();

    novas.forEach((secNova, i) => {
      const dia = secNova.dataset.dia;
      vistos.add(dia);
      const secVelha = secoesAtuais.get(dia);

      if (!secVelha) {
        // Dia inteiro novo: entra na posição correta da ordem.
        const ref = cont.children[i] || null;
        cont.insertBefore(secNova, ref);
        secNova.querySelectorAll('[data-mc-card]').forEach(c => this._anunciar(c));
        return;
      }

      // Resumo do dia ("2 cumpridas · 1 em aberto") muda com frequência e é
      // barato: troca direto, é uma linha de texto.
      const rNovo = secNova.querySelector('[data-resumo-dia]');
      const rVelho = secVelha.querySelector('[data-resumo-dia]');
      if (rNovo && rVelho && rVelho.innerHTML !== rNovo.innerHTML) rVelho.innerHTML = rNovo.innerHTML;

      const caixaVelha = secVelha.querySelector('[data-cartoes]');
      const caixaNova  = secNova.querySelector('[data-cartoes]');
      if (!caixaVelha || !caixaNova) return;

      const atuais = new Map(
        [...caixaVelha.querySelectorAll('[data-mc-card]')].map(c => [c.dataset.mcCard, c]));
      const chavesNovas = new Set();

      [...caixaNova.children].forEach((cartaoNovo, pos) => {
        const chave = cartaoNovo.dataset.mcCard;
        chavesNovas.add(chave);
        const cartaoVelho = atuais.get(chave);

        if (!cartaoVelho) {
          const ref = caixaVelha.children[pos] || null;
          caixaVelha.insertBefore(cartaoNovo, ref);
          this._anunciar(cartaoNovo);                // só o recém-chegado brilha
          return;
        }
        // MUDOU? Só então mexe. Este `if` é o coração da correção.
        //
        // A comparação é pela ASSINATURA (data-mc-sig), não pelo HTML. O
        // cartão tem um cronômetro correndo dentro: comparar HTML acusaria
        // diferença a cada segundo e a lista se redesenharia inteira — o
        // defeito que estamos removendo. A assinatura só carrega o que muda
        // a cara do cartão; o tempo é atualizado no nó vivo pelo timer.
        if (cartaoVelho.dataset.mcSig !== cartaoNovo.dataset.mcSig) {
          cartaoVelho.replaceWith(cartaoNovo);
        } else if (caixaVelha.children[pos] !== cartaoVelho) {
          caixaVelha.insertBefore(cartaoVelho, caixaVelha.children[pos] || null);
        }
      });

      atuais.forEach((el, chave) => { if (!chavesNovas.has(chave)) el.remove(); });
    });

    secoesAtuais.forEach((sec, dia) => { if (!vistos.has(dia)) sec.remove(); });

    // Se o container tinha estado vazio (empty-state) ou qualquer outra coisa
    // que não seja seção de dia, limpa esses restos.
    [...cont.children].forEach(el => {
      if (!el.matches('section[data-dia]')) el.remove();
    });
  },

  /* Marca de chegada de USO ÚNICO.

     A classe é removida assim que a animação termina. Se ela ficasse grudada
     no elemento, um simples reordenamento — que reinsere o nó no DOM —
     faria a animação tocar de novo, e o cartão piscaria sem ter mudado nada.
     O `setTimeout` é a rede de segurança para quando `animationend` não vem
     (aba em segundo plano, ou o hunter com "reduzir movimento" ligado, onde
     a animação é desativada e o evento nunca dispara). */
  _anunciar(el) {
    if (!el) return;
    el.classList.add('mc-entrando');
    const limpar = () => el.classList.remove('mc-entrando');
    el.addEventListener('animationend', limpar, { once: true });
    setTimeout(limpar, 600);
  },

  /* Só os números do topo — sem tocar na lista de missões.
     Separado de `atualizarStatsMini` de propósito: aquele recarrega o extrato
     também, e chamá-lo depois de uma ação de cartão desfaria a repintura
     cirúrgica que o cartão acabou de fazer. */
  async atualizarNumeros() {
    try {
      const [perfil, stats] = await Promise.allSettled([
        API.auth.me(),
        API.get('/dashboard/stats'),
      ]);
      if (perfil.status === 'fulfilled' && perfil.value) this.renderPersonagem(perfil.value);
      if (stats.status === 'fulfilled' && stats.value)   this.renderStats(stats.value);
    } catch (_) {}
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
    /* Enfeita os `<select>` com a interface própria. Ele NÃO
       substitui o elemento: o select continua sendo a verdade, e é
       por isso que tudo abaixo desta linha segue igual ao que era —
       `.value`, o ouvinte de `change`, a leitura no carregamento. */
    if (typeof SrFiltro !== 'undefined') SrFiltro.montarTodos(document.getElementById('extrato-filtros'));

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

    /* A peça do banner também morre aqui. Ela segura um laço de
       partículas e um ouvinte de `resize` pendurado em `window` — o
       laço se desliga sozinho ao sair do DOM, o ouvinte não.

       Antes esta limpeza não existia porque não havia como fazê-la:
       o `_initFxJanela` pendurava o `resize` e nunca mais o soltava.
       Cada visita ao Dashboard deixava um para trás. */
    if (typeof Pecas !== 'undefined') {
      const slot = this._slotBanner();
      if (slot) Pecas.desmontar(slot);
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
  /* O botão ◈ de trocar aura saiu daqui: virou `botaoAura()` na peça.
     Ele era recriado a cada repintura do cartão — e o cartão repinta a
     cada missão. Na peça nasce uma vez e só troca de título.

     Era este botão que escrevia `dash-btn-trocar-aura` também de dentro
     da V4, dando dois elementos com o mesmo id na mesma página. Com o
     contrato, quem clica pede `trocar-aura` ao hospedeiro e o id deixa
     de ser um ponto de encontro. */

  /* ══════════════════════════════════════════════════════════
     AURA — o modal saiu daqui

     Eram tres funcoes e ~200 linhas: `_abrirModalAura` montava o
     modal com estilo embutido linha a linha, `_ativarAura` REABRIA o
     modal inteiro refazendo o fetch, e `_removerAura` chamava
     `Dashboard.carregar()` — o painel todo, perfil, conquistas,
     estatisticas e extrato — so para tirar uma aura.

     Agora o modal e uma peca de interface propria
     (js/modal-auras.js). O Dashboard so faz o que cabe a um
     hospedeiro: entrega o hunter e diz o que fazer quando a escolha
     mudar.
     ══════════════════════════════════════════════════════════ */
  _abrirModalAura(dados) {
    const hunter = dados || window.__dashDados || {};
    if (typeof ModalAuras === 'undefined') return;
    ModalAuras.abrir(hunter, (novaAura) => this._aplicarAura(novaAura));
  },

  /* Aplica a escolha na TELA, sem ida ao servidor: quem conversa com
     ele e o modal, que ja fez a chamada e desfaz sozinho se falhar.

     Repintar em vez de recarregar e a diferenca entre trocar uma aura
     e recarregar o painel inteiro — que era o que acontecia antes. */
  _aplicarAura(auraId) {
    if (window.__dashDados) window.__dashDados.aura_id = auraId;
    this._repintarBanner();
  },

};

