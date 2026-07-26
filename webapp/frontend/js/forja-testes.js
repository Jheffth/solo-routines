/* ============================================================
   forja-testes.js — A Bancada de Testes do Arquiteto

   POR QUE ESTA REESCRITA EXISTE

   A Forja anterior era uma lista de botões escritos à mão. Isso
   produziu três problemas, todos confirmados executando o código:

   1. Ela não conhecia o próprio jogo. A cerimônia de teste
      disparava 5 conquistas FALSAS, todas sem `codigo`. Como a
      arte é buscada por código, a cerimônia SEMPRE caía na
      medalha genérica — a arte da Fênix, da Isabella e das
      outras seis nunca era testável. Era o sintoma relatado.

   2. Botões apontando para o vazio. `vitrineInsignia(...)`,
      `Auras.vitrine(...)`, `IsabellaFX.cerimonia()` e
      `Jh3ffthFX.toggle()` não existem — 10 dos ~34 botões eram
      cliques que não faziam nada.

   3. Crescia por acumulação: cada arte nova exigia editar esta
      tela, e quem esquecia deixava a arte invisível aqui.

   A CORREÇÃO DE FUNDO: esta Forja não tem lista escrita à mão.
   Ela DESCOBRE o que existe — os emblemas vêm do banco, as auras
   vêm do registro de desenho. Arte nova aparece aqui sozinha, e
   o problema 3 não pode voltar.

   E ela some enquanto o efeito roda (o "eclipse"), porque testar
   animação espiando por trás de um painel nunca foi teste.

   Só o Arquiteto vê. Nada aqui persiste no banco.
   ============================================================ */

const ForjaTestes = {
  _aberta: false,
  _aba: 'emblemas',
  _busca: '',
  _emblemas: [],     // catálogo real, vindo do banco
  _carregado: false,

  /* ── Acesso ──────────────────────────────────────────────── */
  _ehArquiteto() {
    try { return window.Auth?.getUsuario?.()?.nivel_acesso === 'Arquiteto'; }
    catch (_) { return false; }
  },

  init() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        this.alternar();
      }
      if (e.key === 'Escape' && this._aberta) this.fechar();
    });
    document.getElementById('sidebar-rank')
      ?.addEventListener('dblclick', () => this.alternar());
  },

  alternar() {
    if (!this._ehArquiteto()) return;
    this._aberta ? this.fechar() : this.abrir();
  },

  async abrir() {
    if (!this._ehArquiteto()) return;
    this._montar();
    document.getElementById('forja-testes')?.classList.add('aberta');
    this._aberta = true;
    if (!this._carregado) await this._carregarCatalogo();
  },

  fechar() {
    document.getElementById('forja-testes')?.classList.remove('aberta');
    this._aberta = false;
  },

  /* ── O ECLIPSE ───────────────────────────────────────────
     A bancada se apaga, o efeito roda numa tela limpa, e ela
     volta. Sem isto, todo teste visual era observado por trás
     de um painel de 860px — que é justamente o que se quer ver.

     A bancada continua no DOM: removê-la e recriar perderia a
     busca digitada e a aba aberta. */
  async _eclipsar(fn, msDepois = 900) {
    const el = document.getElementById('forja-testes');
    if (!el) { await fn(); return; }
    el.classList.add('eclipse');
    try {
      // Um quadro de respiro para o fade começar antes do efeito.
      await new Promise(r => setTimeout(r, 180));
      const r = fn();
      if (r && typeof r.then === 'function') await r;   // respeita quem é assíncrono
    } catch (err) {
      console.warn('[Forja] o teste falhou:', err);
      SoloDialog?.toast?.('Este teste falhou: ' + (err?.message || err), 'error');
    } finally {
      setTimeout(() => el.classList.remove('eclipse'), msDepois);
    }
  },

  /* ── Catálogo: descoberto, nunca escrito à mão ───────────── */
  async _carregarCatalogo() {
    try {
      this._emblemas = (await API.get('/conquistas/')) || [];
    } catch (_) {
      this._emblemas = [];
    }
    this._carregado = true;
    this._render();
  },

  /* Auras vêm do registro de DESENHO: se pode ser desenhada,
     pode ser testada. É a fonte mais honesta que existe aqui. */
  _auras() {
    const reg = (typeof Auras !== 'undefined' && Auras._registro) || {};
    return Object.keys(reg).map(id => ({ id, nome: this._humanizar(id) }));
  },

  _comArte(codigo) {
    const reg = (typeof ConquistaFX !== 'undefined' && ConquistaFX._insignias) || {};
    return !!reg[codigo];
  },

  _humanizar(id) {
    return String(id).replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  },

  _esc(s) {
    return String(s ?? '').replace(/[&<>"]/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  },

  /* ── Abas ────────────────────────────────────────────────── */
  ABAS: [
    { id: 'escudos',   rotulo: '🛡 Escudos'    },
    { id: 'emblemas',  rotulo: '🎖 Emblemas'   },
    { id: 'auras',     rotulo: '✦ Auras'       },
    { id: 'cerimonias',rotulo: '🎬 Cerimônias' },
    { id: 'ascensao',  rotulo: '⬆ Ascensão'    },
    { id: 'efeitos',   rotulo: '✨ Efeitos'     },
    { id: 'interface', rotulo: '🗂 Interface'   },
    { id: 'hunters',   rotulo: '👥 Hunters'    },
  ],

  _montar() {
    if (document.getElementById('forja-testes')) return;
    const el = document.createElement('div');
    el.id = 'forja-testes';
    el.innerHTML = `
      <div class="ft-topo" id="ft-topo" title="Arraste para mover">
        <span class="ft-sigilo">⚒</span>
        <div>
          <div class="ft-titulo">Forja de Testes</div>
          <div class="ft-sub">Só o Arquiteto vê · nada é salvo</div>
        </div>
        <div class="ft-busca-wrap">
          <input class="ft-busca" id="ft-busca" type="search"
                 placeholder="Buscar emblema, aura, efeito..." autocomplete="off">
        </div>
        <button class="ft-fechar" id="ft-fechar" title="Fechar (Esc)">✕</button>
      </div>
      <div class="ft-corpo">
        <div class="ft-abas" id="ft-abas"></div>
        <div class="ft-lista" id="ft-lista"></div>
      </div>
      <div class="ft-rodape">
        <kbd>Ctrl</kbd><kbd>Alt</kbd><kbd>A</kbd> abre e fecha
        <span style="margin-left:auto">a bancada some sozinha durante o efeito</span>
      </div>`;
    document.body.appendChild(el);

    document.getElementById('ft-fechar').addEventListener('click', () => this.fechar());
    const busca = document.getElementById('ft-busca');
    busca.addEventListener('input', () => { this._busca = busca.value.trim().toLowerCase(); this._render(); });

    // Delegação: um ouvinte para a lista inteira.
    document.getElementById('ft-lista').addEventListener('click', (e) => {
      const b = e.target.closest('[data-ft-acao]');
      if (!b) return;
      const [grupo, arg] = b.dataset.ftAcao.split(':');
      this._executar(grupo, arg);
    });
    document.getElementById('ft-abas').addEventListener('click', (e) => {
      const b = e.target.closest('[data-ft-aba]');
      if (!b) return;
      this._aba = b.dataset.ftAba;
      this._render();
    });

    this._arrastar(el, document.getElementById('ft-topo'));
    this._render();
  },

  /* ── Itens de cada aba ───────────────────────────────────── */
  /* O catálogo de emblemas é a UNIÃO de duas fontes, e precisa ser:

     • o banco (/conquistas/) sabe os títulos e descrições reais, MAS
       esconde emblemas manuais que o Arquiteto ainda não possui — foi
       por isso que Fênix e Isabella não apareciam aqui;
     • o registro de arte (ConquistaFX._insignias) sabe tudo que tem
       desenho próprio, possuído ou não.

     Unindo os dois, nenhuma arte fica invisível na bancada, e um emblema
     novo aparece assim que for desenhado OU cadastrado. */
  _catalogoEmblemas() {
    const porCodigo = new Map();
    (this._emblemas || []).forEach(c => porCodigo.set(c.codigo, { ...c }));

    const artes = (typeof ConquistaFX !== 'undefined' && ConquistaFX._insignias) || {};
    Object.keys(artes).forEach(codigo => {
      if (!porCodigo.has(codigo)) {
        // Só a arte existe: monta uma ficha mínima para ela ser testável.
        porCodigo.set(codigo, {
          codigo, titulo: this._humanizar(codigo),
          descricao: 'Insígnia com arte própria', icone: '🏅',
          xp_bonus: 0, _soArte: true,
        });
      }
    });
    return [...porCodigo.values()];
  },

  _itens(aba) {
    if (aba === 'escudos') {
      const ranks = ['E', 'D', 'C', 'B', 'A', 'S', 'N'];
      return ranks.map(r => ({
        chave: 'escudo:' + r,
        nome: 'Rank ' + r,
        tag: 'Escudo S-Rank',
        arte: typeof Escudos !== 'undefined' ? Escudos.rank(r, 58) : '🛡',
        busca: `escudo rank ${r}`
      }));
    }
    if (aba === 'emblemas') {
      return this._catalogoEmblemas().map(c => ({
        chave: 'emb:' + c.codigo,
        nome: c.titulo,
        tag: this._comArte(c.codigo) ? 'arte própria' : 'medalha padrão',
        semArte: !this._comArte(c.codigo),
        arte: (typeof ConquistaFX !== 'undefined' && ConquistaFX.miniMedalha)
          ? ConquistaFX.miniMedalha(c, 56) : (c.icone || '🏆'),
        busca: `${c.titulo} ${c.codigo} ${c.descricao || ''}`,
      }));
    }
    if (aba === 'auras') {
      return this._auras().map(a => ({
        chave: 'aura:' + a.id,
        nome: a.nome,
        tag: 'cerimônia da aura',
        arte: (typeof Auras !== 'undefined' && Auras.svg) ? (Auras.svg(a.id, 58) || '✦') : '✦',
        busca: `${a.nome} ${a.id}`,
      }));
    }
    return (this._ACOES[aba] || []).map(a => ({
      chave: 'acao:' + a.id, nome: a.rotulo, desc: a.desc,
      acaoTexto: true, busca: `${a.rotulo} ${a.desc || ''}`,
    }));
  },

  /* Gatilhos que não são peças de arte. Cada um aponta para algo
     que EXISTE — os chamados quebrados da Forja antiga foram
     removidos, não recopiados. */
  _ACOES: {
    cerimonias: [
      { id: 'fila3',    rotulo: 'Fila — 3 cerimônias seguidas', desc: 'testa o enfileiramento' },
      { id: 'selo',     rotulo: 'Selo + carimbo no quadro',     desc: 'marca permanente no perfil' },
      { id: 'sequencia',rotulo: 'Ascensão → Cerimônia',         desc: 'a ordem real do Sistema' },
    ],
    ascensao: [
      { id: 'levelup',  rotulo: 'Ascensão (1 nível)',  desc: 'subida simples' },
      { id: 'multipla', rotulo: 'Ascensão múltipla',   desc: 'salto de 11 níveis' },
      { id: 'sincronizar', rotulo: 'Sincronizar meu nível', desc: 'reparo real — altera seus dados' },
    ],
    efeitos: [
      { id: 'explosao', rotulo: 'Explosão de partículas', desc: 'três ondas em sequência' },
      { id: 'xpfloat',  rotulo: 'Sparks + XP flutuante',  desc: 'ganho sem cerimônia' },
      { id: 'som_conquista', rotulo: 'Som: conquista',    desc: '' },
      { id: 'som_mensagem',  rotulo: 'Som: mensagem',     desc: '' },
      { id: 'som_carimbo',   rotulo: 'Som: carimbo',      desc: '' },
    ],
    interface: [
      { id: 'cardMissao',     rotulo: 'Cartão de Missão',          desc: 'proposta de interface' },
      { id: 'forjaMissao',    rotulo: 'Forja de Missões',           desc: 'proposta de interface' },
      { id: 'banner',         rotulo: 'Banner "O Monarca"',         desc: 'proposta de interface' },
      { id: 'bannerPremium',  rotulo: 'Banner Premium (melhorias)', desc: 'preview — toggle on/off' },
      // Proposta PARALELA e independente (js/estandarte.js). Convive com a
      // de cima de propósito: duas linguagens visuais diferentes para o
      // mesmo problema, comparáveis lado a lado. Não compartilham código,
      // nem seletor, nem arquivo.
      { id: 'estandarte',     rotulo: 'Vitrine de Banners (V1 e V2)', desc: 'V2 fiel à referência · aura e relíquias reais' },
    ],
    hunters: [
      { id: 'convites',      rotulo: 'Convocar hunters',    desc: 'gera convites reais' },
      { id: 'comemorativas', rotulo: 'Comemorativas',       desc: 'conceder / ocultar' },
      { id: 'enviarAura',    rotulo: 'Enviar aura a hunter',desc: 'presente real' },
    ],
  },

  _render() {
    const lista = document.getElementById('ft-lista');
    const abas  = document.getElementById('ft-abas');
    if (!lista || !abas) return;

    abas.innerHTML = this.ABAS.map(a => {
      const n = this._itens(a.id).length;
      return `<button class="ft-aba ${a.id === this._aba ? 'on' : ''}" data-ft-aba="${a.id}">
        ${a.rotulo}<span class="ft-aba-n">${n}</span></button>`;
    }).join('');

    let itens = this._itens(this._aba);
    if (this._busca) {
      itens = itens.filter(i => (i.busca || '').toLowerCase().includes(this._busca));
    }

    if (!itens.length) {
      lista.innerHTML = `<div class="ft-vazio">${
        this._busca ? 'Nada encontrado para esta busca.'
        : (this._aba === 'emblemas' && !this._carregado)
          ? 'Carregando o catálogo...'
          : 'Nada aqui ainda.'}</div>`;
      return;
    }

    lista.innerHTML = itens.map(i => i.acaoTexto
      ? `<button class="ft-acao" data-ft-acao="${i.chave}">
           <span class="ft-acao-ico">▶</span>
           <span>${this._esc(i.nome)}${i.desc ? `<span class="ft-acao-desc">${this._esc(i.desc)}</span>` : ''}</span>
         </button>`
      : `<button class="ft-item ${i.semArte ? 'sem-arte' : ''}" data-ft-acao="${i.chave}"
                 title="Disparar a cerimônia de ${this._esc(i.nome)}">
           ${i.semArte ? '<span class="ft-selo-padrao">padrão</span>' : ''}
           <span class="ft-arte">${i.arte}</span>
           <span class="ft-nome">${this._esc(i.nome)}</span>
           <span class="ft-tag">${this._esc(i.tag || '')}</span>
         </button>`
    ).join('');
  },

  /* ── Execução ────────────────────────────────────────────── */
  _executar(grupo, arg) {
    if (grupo === 'escudo') {
      return SoloDialog?.toast?.('Os Escudos são implementados no Estandarte (V3). Este é apenas um catálogo visual.', 'info');
    }
    // Emblema: dispara a cerimônia REAL, com o código verdadeiro —
    // que é o que faz a arte própria aparecer. A Forja antiga
    // omitia o código, e por isso só mostrava a medalha genérica.
    if (grupo === 'emb') {
      const c = this._catalogoEmblemas().find(x => x.codigo === arg);
      if (!c) return;
      return this._eclipsar(() => ConquistaFX.show({
        ...c,
        id: 'teste_' + Date.now(),   // fura o dedup para poder repetir o ensaio
      }), 2600);
    }

    if (grupo === 'aura') {
      return this._eclipsar(() => {
        // A cerimônia de aura reaproveita a de conquista: é a mesma
        // encenação, com o desenho da aura no lugar da medalha.
        const cat = { 'fenix-pioneira': '#ff6d00', 'bella-rosa': '#ff1493',
                      'pink-spirit': '#f48fb1', arquiteto: '#fbbf24', admin: '#38bdf8' };
        ConquistaFX.show({
          id: 'aura_' + Date.now(),
          codigo: arg,
          titulo: this._humanizar(arg),
          descricao: 'Aura cosmética',
          icone: '✦',
          cor: cat[arg] || '#c084fc',
          _auraId: arg,
        });
      }, 2600);
    }

    const A = window.ArquitetoConsole;
    const mapa = {
      fila3:       () => A?.fila3(),
      selo:        () => A?.selo(),
      sequencia:   () => A?.sequenciaCompleta(),
      levelup:     () => A?.levelup(),
      multipla:    () => A?.ascensaoMultipla(),
      sincronizar: () => A?.sincronizarNivel(),
      explosao:    () => A?.explosao(),
      xpfloat:     () => A?.xpfloat(),
      som_conquista: () => SFX?.play('conquista'),
      som_mensagem:  () => SFX?.play('mensagem'),
      som_carimbo:   () => SFX?.play('carimbo'),
      cardMissao:    () => A?.cardMissao(),
      forjaMissao:   () => A?.forjaMissao(),
      banner:        () => A?.banner(),
      bannerPremium: () => A?.bannerMelhorado(),
      // Chamada direta: nao encosta no ArquitetoConsole.
      estandarte:    () => window.Estandarte?.abrir(),
      convites:    () => A?.convites(),
      comemorativas: () => A?.comemorativas(),
      enviarAura:  () => A?.enviarAura(),
    };
    const fn = mapa[arg];
    if (!fn) return;

    // Painéis (convites, comemorativas, enviar aura) precisam da bancada
    // visível para serem usados — eclipsar só o que é animação.
    const painel = ['convites', 'comemorativas', 'enviarAura',
                    'cardMissao', 'forjaMissao', 'banner', 'bannerPremium',
                    'estandarte'].includes(arg);
    const som = arg.startsWith('som_');
    if (painel || som) {
      try { fn(); }
      catch (err) { SoloDialog?.toast?.('Este teste falhou: ' + (err?.message || err), 'error'); }
      return;
    }
    this._eclipsar(fn, arg === 'sequencia' ? 5200 : 2600);
  },

  /* ── Arrastar pela cabeça ────────────────────────────────── */
  _arrastar(el, cabeca) {
    let ax = 0, ay = 0, ox = 0, oy = 0, arrastando = false;
    cabeca.addEventListener('mousedown', (e) => {
      if (e.target.closest('input, button')) return;
      arrastando = true;
      const r = el.getBoundingClientRect();
      ox = r.left; oy = r.top; ax = e.clientX; ay = e.clientY;
      el.style.right = 'auto'; el.style.bottom = 'auto';
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!arrastando) return;
      el.style.left = (ox + e.clientX - ax) + 'px';
      el.style.top  = (oy + e.clientY - ay) + 'px';
    });
    document.addEventListener('mouseup', () => { arrastando = false; });
  },
};

document.addEventListener('DOMContentLoaded', () => ForjaTestes.init());
window.ForjaTestes = ForjaTestes;
