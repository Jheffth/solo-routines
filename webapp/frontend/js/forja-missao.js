/* ============================================================
   forja-missao.js — A Forja de Missões (lançador)

   Princípio: a escolha nunca é abstrata. Cada opção carrega a cor
   que o cartão terá, e uma PRÉVIA AO VIVO mostra o resultado real
   enquanto o hunter decide.

   Uso:
     ForjaMissao.abrir();                    // cria de verdade
     ForjaMissao.abrir({ demo: true });      // vitrine (não salva)

   Requer: css/forja-missao.css + missao-card.(js|css)
   ============================================================ */

const ForjaMissao = {
  _demo: false,
  _estado: null,

  /* ── Catálogos (a cor vive aqui e propaga para tudo) ───── */
  TIPOS: [
    { id: 'ROTINA', ico: 'rotina',  txt: 'Rotina Recorrente', sub: 'repete no ciclo' },
    { id: 'TAREFA', ico: 'avulsa',  txt: 'Tarefa Avulsa',     sub: 'uma única vez'  },
    /* O PACTO NÃO É UMA MISSÃO — é o preço de falhar numa. Ele mora
       aqui porque é aqui que o hunter vem quando quer criar alguma
       coisa, e mandá-lo a outra tela para escrever a própria punição
       era o tipo de fricção que faz um recurso nunca ser usado.

       O que ele cria é a REGRA. A ocorrência (a penitência com
       giroflex) nasce sozinha quando o Sistema cobra, e vive no
       Dashboard. Regra e ocorrência separadas, como Rotina e
       ExecuçãoDia. */
    { id: 'PACTO',  ico: 'caveira', txt: 'Pacto',             sub: 'o preço de falhar',
      cor: '#ff0a3c' },
  ],

  /* Os quatro tipos de penitência. O texto aqui descreve o GESTO, não a
     categoria: "contar", "aguentar", "cronometrar", "pagar" — porque na
     hora de escrever o próprio castigo o hunter pensa no que vai fazer,
     não na taxonomia.

     `escala` e `natureza` nascem VAZIOS de propósito e são preenchidos
     pelo servidor em _consultarPactos(). São dele: `ESCALA_DO_TIPO` vive
     em motors/pactos.py, e uma cópia aqui viraria a segunda verdade no
     dia em que o Arquiteto mudasse o fator. Os valores abaixo são só o
     desenho inicial, para a tela não nascer muda. */
  PACTO_TIPOS: [
    { id: 'QUANTITATIVA', ico: 'repeticao',  txt: 'Contar',      sub: 'fazer {n} vezes',
      cor: '#ff0a3c', escala: null, natureza: null },
    { id: 'RESTRITIVA',   ico: 'passiva',    txt: 'Aguentar',    sub: '{n} horas sem algo',
      cor: '#2b6bff', escala: null, natureza: null },
    { id: 'TEMPORAL',     ico: 'ampulheta',  txt: 'Cronometrar', sub: '{n} minutos de algo',
      cor: '#a855f7', escala: null, natureza: null },
    { id: 'TRIBUTO',      ico: 'moeda',      txt: 'Pagar',       sub: 'o Sistema debita Mana',
      cor: '#f59e0b', escala: null, natureza: null },
  ],

  /* NATUREZA — a inversão. Só aparece para quem tem permissão, e só na
     Rotina: um protocolo que vale uma vez só não é protocolo. */
  /* A PASSIVA é da Staff; a REPETIÇÃO é de todo mundo.

     Por isso o bloco inteiro deixou de depender de `_podeEspeciais`:
     esconder a natureza para o hunter comum esconderia junto uma opção
     que ele PODE usar. Agora o bloco aparece sempre (em rotina) e é a
     opção PASSIVA que some — a permissão é por item, não por bloco. */
  NATUREZAS: [
    { id: 'ATIVA',     ico: 'ativa',     txt: 'Ativa',     cor: '#8b5cf6',
      sub: 'você cumpre' },
    { id: 'REPETICAO', ico: 'repeticao', txt: 'Repetições', cor: '#0ea5e9',
      sub: 'você acumula' },
    { id: 'PASSIVA',   ico: 'passiva',   txt: 'Passiva',   cor: '#6366f1',
      sub: 'você mantém', premium: true },
  ],
  _naturezas() {
    return this.NATUREZAS.filter(n => !n.premium || this._podeEspeciais);
  },
  REP_MODOS: [
    { id: 'META',  ico: 'concluida',  txt: 'Meta',  cor: '#0ea5e9',
      sub: 'tem um número para bater' },
    { id: 'BONUS', ico: 'repeticao', txt: 'Livre', cor: '#22d3ee',
      sub: 'conta sem fim' },
  ],
  _podeEspeciais: false,
  _contadores: null,
  FREQUENCIAS: [
    { id: 'DIARIA',  ico: 'diaria', txt: 'Diária'  },
    { id: 'SEMANAL', ico: 'semanal', txt: 'Semanal' },
    { id: 'MENSAL',  ico: 'mensal', txt: 'Mensal'  },
    { id: 'ANUAL',   ico: 'anual', txt: 'Anual'   },
  ],
  PRIORIDADES: [
    { id: 'CRITICA', ico: 'prior_critica', txt: 'Crítica', cor: '#e11d48', sub: 'urgente'  },
    { id: 'ALTA',    ico: 'prior_alta', txt: 'Alta',    cor: '#f59e0b', sub: 'importa'  },
    { id: 'MEDIA',   ico: 'prior_media', txt: 'Média',   cor: '#64748b', sub: 'padrão'   },
    { id: 'BAIXA',   ico: 'prior_baixa', txt: 'Baixa',   cor: '#3b82f6', sub: 'tranquila'},
  ],
  DIFICULDADES: [
    { id: 'FACIL',    ico: 'dific_facil', txt: 'Fácil',    cor: '#22d3ee', sub: 'C · ×0.5' },
    { id: 'NORMAL',   ico: 'dific_normal', txt: 'Normal',   cor: '#8b5cf6', sub: 'B · ×1'   },
    { id: 'DIFICIL',  ico: 'dific_dificil', txt: 'Difícil',  cor: '#f97316', sub: 'A · ×1.5' },
    { id: 'LENDARIO', ico: 'dific_lendario', txt: 'Lendário', cor: '#fbbf24', sub: 'S · ×2.5' },
  ],
  CATEGORIAS: [
    { id: 'Saúde',    ico: 'saude', txt: 'Saúde',    cor: '#f43f5e' },
    { id: 'Trabalho', ico: 'trabalho', txt: 'Trabalho', cor: '#3b82f6' },
    { id: 'Estudo',   ico: 'estudo', txt: 'Estudo',   cor: '#8b5cf6' },
    { id: 'Casa',     ico: 'casa', txt: 'Casa',     cor: '#14b8a6' },
    { id: 'Pessoal',  ico: 'pessoal', txt: 'Pessoal',  cor: '#f59e0b' },
    { id: 'Combate',  ico: 'combate', txt: 'Combate',  cor: '#ec4899' },
  ],

  /* Mesmas tabelas do backend (rotinas.py) — prévia fiel */
  _XP_TIPO:  { DIARIA: 50, SEMANAL: 200, MENSAL: 500, ANUAL: 2000 },
  _MC_TIPO:  { DIARIA: 5,  SEMANAL: 25,  MENSAL: 60,  ANUAL: 250  },
  _MULT_DIF: { FACIL: .5, NORMAL: 1, DIFICIL: 1.5, LENDARIO: 2.5 },
  _BONUS_PRI:{ CRITICA: 1.5, ALTA: 1.2, MEDIA: 1, BAIXA: .7 },
  _PENAL_PRI:{ CRITICA: .5, ALTA: .3, MEDIA: .15, BAIXA: 0 },

  /* ── Glifos do alfabeto do Sistema (js/glifos.js) ────────
     Vivem como MÉTODOS, não como variáveis locais de _render().
     Eu os havia declarado dentro do _render, e o resumo — que é
     desenhado por _atualizar() — quebrou com "gl is not defined"
     ao abrir o painel. Um ajudante usado por duas funções não
     pode morar dentro de uma delas.

     Sem o módulo carregado devolvem vazio, nunca a chave crua:
     um campo sem ícone é feio; "dific_lendario" na tela é pior. */
  /* Escapar existia duas vezes como `const esc` local, dentro de duas
     funções diferentes. A terceira cópia teria sido a hora de virar
     método — então virou agora, antes de haver a terceira. */
  _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  },

  _ico(nome, tam = 30) {
    return (typeof Glifos !== 'undefined') ? Glifos.rico(nome, tam) : '';
  },
  _gl(nome, tam = 15) {
    return (typeof Glifos !== 'undefined') ? Glifos.linha(nome, tam) : '';
  },

  _calcular(e) {
    const xp = Math.max(10, Math.round(
      (this._XP_TIPO[e.frequencia] || 50) *
      (this._MULT_DIF[e.dificuldade] || 1) *
      (this._BONUS_PRI[e.prioridade] || 1)));
    const mc = Math.max(1, Math.round(
      (this._MC_TIPO[e.frequencia] || 5) * (this._MULT_DIF[e.dificuldade] || 1)));
    const pen = Math.round(xp * (this._PENAL_PRI[e.prioridade] ?? .15));
    return { xp, mc, pen };
  },

  /* ── Abertura ──────────────────────────────────────────────
     ForjaMissao.abrir()                          → criar, tipo livre
     ForjaMissao.abrir({ tipo: 'TAREFA' })        → criar, já na aba certa
     ForjaMissao.abrir({ edicao: item })          → editar (PUT, não POST)
     ForjaMissao.abrir({ demo: true })            → vitrine, nada salva
     ForjaMissao.abrir({ aoSalvar: fn })          → avisa a página que chamou

     `edicao` aceita o dict que as páginas já têm em mãos: a rotina crua de
     /rotinas/ ou a tarefa de /tarefas/. O lançador antigo fazia isso e as
     páginas dependem — Rotinas.abrirFormulario(item) é edição. */
  abrir(opts = {}) {
    this._demo = !!opts.demo;
    this._aoSalvar = opts.aoSalvar || null;
    const ed = opts.edicao || null;
    this._editId = ed ? ed.id : null;

    const hoje = this._dataLocal();
    this._estado = {
      tipo: ['TAREFA', 'PACTO'].includes(opts.tipo) ? opts.tipo : 'ROTINA',
      titulo: '', frequencia: 'DIARIA',
      prioridade: 'MEDIA', dificuldade: 'NORMAL', categoria: 'Pessoal',
      janela: false, hora_inicio: '', hora_fim: '',
      natureza: 'ATIVA',
      dias_semana: [], dia_mes: '', mes_dia: '',
      data_prevista: hoje,
      prazo_custom: false, prazo_valor: 30, prazo_unidade: 60,   // 30 × 60 = meia hora
      xp: null, mc: null, pen: null, auto: true, descricao: '',
      rep_modo: 'META', alvo_repeticoes: '', contador_id: null,
      contador_novo: '',
      /* O PACTO. `pct_base` é onde a penitência começa; `pct_teto` é
         onde ela para de dobrar. O teto existe porque sem ele a oitava
         reincidência pediria 256 flexões — e uma punição impossível
         deixa de ser punição e vira motivo para fechar o app. */
      pct_tipo: 'QUANTITATIVA', pct_base: 1, pct_teto: 32, pct_unidade: '',
    };

    if (ed) this._carregarEdicao(ed, opts.tipo);

    this._servidor = null;
    this._render();
    this._consultarServidor();
    this._consultarPactos();
    this._consultarEspeciais();
    document.getElementById('fm-backdrop').classList.add('on');
    setTimeout(() => document.getElementById('fm-titulo-input')?.focus(), 120);
  },

  /* Pergunta ao SERVIDOR se este hunter pode forjar missão especial.

     Deduzir do cargo aqui seria a regra existindo em dois lugares — e quando
     as outorgas com prazo chegarem (Insígnia VIP), o cliente ficaria com a
     versão velha, oferecendo o que o servidor recusa. A tela decide o que
     MOSTRAR; quem decide o que PODE é o servidor, a cada requisição. */
  async _consultarEspeciais() {
    try {
      const p = await API.get('/rotinas/especiais/permissao');
      this._podeEspeciais = !!p?.pode_especiais;
    } catch (_) {
      this._podeEspeciais = false;    // na dúvida, não oferece
    }
    // O BLOCO NÃO DEPENDE MAIS DA PERMISSÃO — só a opção PASSIVA depende.
    // Antes, esconder o bloco para o hunter comum escondia junto a
    // REPETIÇÃO, que ele pode usar. A permissão passou a ser por item.
    // A NATUREZA VALE PARA OS DOIS TIPOS. Ela estava presa a ROTINA por
    // uma regra que eu mesmo inventei — "protocolo que vale uma vez so
    // nao e protocolo" — e que confundia RECORRENCIA com NATUREZA.
    //
    // O Arquiteto desmontou em uma frase: um protocolo para a vespera de
    // uma prova, um contador usado "vez ou outra". Sao missoes gerais, e
    // recusa-las era o app decidindo pelo hunter o que ele quer registrar.
    this._repintarNaturezas();
  },

  /* Redesenha as opções de natureza depois que o servidor respondeu.
     Sem isto, quem TEM permissão abriria o lançador sem a Passiva —
     ela chegaria só na segunda abertura. */
  _repintarNaturezas() {
    const alvo = document.querySelector('#fm-bloco-natureza .fm-opcoes');
    if (!alvo || !this._podeEspeciais) return;
    if (alvo.querySelector('[data-fm-valor="PASSIVA"]')) return;
    const o = this.NATUREZAS.find(n => n.id === 'PASSIVA');
    alvo.insertAdjacentHTML('beforeend', `
      <div class="fm-op ${this._estado.natureza === o.id ? 'sel' : ''}"
           style="--op-cor:${o.cor}"
           data-fm-campo="natureza" data-fm-valor="${o.id}">
        <span class="ico">${this._ico(o.ico)}</span>
        <span class="txt">${o.txt}</span>
        <span class="sub">${o.sub}</span>
      </div>`);
  },

  /* "Criar contador" cria de verdade, e so na hora de salvar.

     Criar no clique deixaria contadores orfaos toda vez que o hunter
     abrisse o lancador, mudasse de ideia e fechasse — e um contador
     vazio na lista e ruido permanente, porque arquivar e o unico jeito
     de tirar. */
  async _resolverContador() {
    const e = this._estado;
    if (e.contador_id === 'novo') {
      const nome = (this._resolverTitulo(e.titulo, e.alvo_repeticoes) || '').trim();
      if (!nome) return null;
      try {
        const c = await API.post('/contadores', { nome: nome.slice(0, 80) });
        return c?.id ?? null;
      } catch (_) { return null; }
    }
    return Number.isFinite(e.contador_id) ? e.contador_id : null;
  },

  /* ── O PACTO ──────────────────────────────────────────────

     Pergunta ao servidor os fatores de escala. Mesmo motivo de
     _consultarServidor: `ESCALA_DO_TIPO` vive em motors/pactos.py, e
     desenhar a escada com uma cópia local significaria prometer uma
     progressão que o Sistema não vai cumprir.

     Falha em silêncio de propósito. Sem resposta a escada não aparece,
     mas o formulário continua inteiro e salvável — quem valida de
     verdade é o servidor no POST. Um pacto que não pode ser criado
     porque um endpoint decorativo caiu seria pior que uma prévia
     ausente. */
  async _consultarPactos() {
    try {
      const r = await API.get('/pactos/catalogo');
      const porId = {};
      (r.tipos || []).forEach(t => { porId[t.id] = t; });
      this.PACTO_TIPOS.forEach(t => {
        if (!porId[t.id]) return;
        t.escala   = porId[t.id].escala;
        t.natureza = porId[t.id].natureza;
      });
      this._catalogoPacto = r;
      if (this._estado?.tipo === 'PACTO') this._atualizar();
    } catch (e) { /* a escada some; o formulário fica */ }
  },

  _pactoTipo() {
    return this.PACTO_TIPOS.find(t => t.id === this._estado.pct_tipo)
        || this.PACTO_TIPOS[0];
  },

  /* A ESCADA. É o coração desta tela: um pacto só assusta quando o
     hunter VÊ para onde ele cresce. "Fazer 1 flexão" é inofensivo;
     "1 → 2 → 4 → 8 → 16 → 32" é um contrato.

     Três comportamentos distintos, e cada um precisa aparecer:

       · escala 2.0   dobra        1 → 2 → 4 → 8 …
       · escala 1.5   sobe devagar 20 → 30 → 45 …   (dobrar MINUTOS
                                                     chega ao absurdo)
       · escala null  não escala por reincidência — a restritiva cresce
                      por CONFISSÃO, e dizer "×2" nela seria mentira. */
  _escada(limite = 7) {
    const t = this._pactoTipo();
    const base = Math.max(1, parseInt(this._estado.pct_base, 10) || 1);
    const teto = Math.max(base, parseInt(this._estado.pct_teto, 10) || base);
    if (!t.escala || t.escala <= 1) return { degraus: [base], fixa: true, teto };
    const degraus = [];
    let v = base;
    while (degraus.length < limite) {
      degraus.push(v);
      if (v >= teto) break;
      const proximo = Math.round(v * t.escala);
      v = Math.min(teto, proximo > v ? proximo : v + 1);
    }
    return { degraus, fixa: false, teto };
  },

  /* O título do pacto GUARDA o `{n}` — e é aqui que ele difere da
     missão de repetição, que o resolve na hora de salvar.

     A razão: a repetição nasce com um alvo fixo ("Fazer 20 flexões" é
     sempre 20). O pacto MUDA de número a cada reincidência, e o
     backend substitui o token pelo `valor_atual` toda vez que serve o
     item. Resolver aqui congelaria a penitência no valor inicial e
     mataria a escalação inteira em silêncio — o pacto continuaria
     existindo, só nunca doeria mais. */
  _previaPacto() {
    const e = this._estado;
    const t = this._pactoTipo();
    const esc = this._escada();
    const tem = /\{n\}/.test(e.titulo || '');
    const amostra = txt => String(txt || '').replace(/\{n\}/g, esc.degraus[0]);

    const alvo = document.getElementById('fm-pct-previa');
    if (!alvo) return;

    if (!(e.titulo || '').trim()) {
      alvo.innerHTML = '<div class="fm-pct-vazio">Escreva o que você deve ao Sistema.</div>';
      return;
    }

    const escadaHtml = esc.fixa
      ? `<div class="fm-pct-nota-fixa">Esta não escala por reincidência —
           ela cresce quando você <b>confessa</b>, e o relógio zera.</div>`
      : `<div class="fm-pct-escada">
           ${esc.degraus.map((d, i) => `
             <span class="fm-pct-degrau ${d >= esc.teto ? 'teto' : ''}"
                   title="${i === 0 ? 'primeira vez' : (i + 1) + 'ª reincidência'}">${d}</span>
           `).join('<span class="fm-pct-seta">›</span>')}
           ${esc.degraus[esc.degraus.length - 1] >= esc.teto
              ? '<span class="fm-pct-teto-lbl">teto</span>' : '<span class="fm-pct-seta">…</span>'}
         </div>`;

    alvo.innerHTML = `
      <div class="fm-pct-cartao" style="--pct-cor:${t.cor}">
        <div class="fm-pct-selo">${this._ico('caveira', 22)}</div>
        <div class="fm-pct-texto">${this._esc(amostra(e.titulo))}</div>
      </div>
      ${escadaHtml}
      ${tem ? '' : `<div class="fm-pct-aviso">
          Sem <code>{n}</code> no título, o número não aparece — a penitência
          escala por dentro e o texto continua dizendo a mesma coisa.</div>`}
      <div class="fm-pct-vira">
        ${t.natureza
          ? `Quando cair, vira um cartão <b>${{ REPETICAO: 'de Repetição',
               PASSIVA: 'Passivo', ATIVA: 'comum' }[t.natureza] || t.natureza}</b>
             no seu Dashboard, em vermelho e azul.`
          : 'O Sistema debita a Mana sozinho — não vira cartão.'}
      </div>`;
  },

  /* ── O TOKEN {n} ──────────────────────────────────────────

     "Responder {n} questões de História" com alvo 5 vira "Responder
     5 questões de História".

     TRÊS DECISÕES, e todas foram no sentido de cobrar menos:

     · A PRÉVIA É OBRIGATÓRIA. É a primeira sintaxe que este app pede
       ao hunter. Sem ver o resultado ele não confia — e com razão.

     · O {n} É OPCIONAL. Quem não quiser escreve o número na mão e o
       Sistema não reclama. A variável é um ganho para quem muda o
       alvo depois, não um imposto para quem nunca vai mudar.

     · A RESOLUÇÃO ACONTECE NO TÍTULO SALVO, não na exibição. Guardar
       "{n}" e resolver toda vez que o cartão desenha espalharia a
       sintaxe pelo app inteiro — o Extrato, a busca, a notificação do
       bot, a futura guilda, todos teriam que conhecê-la. O lançador
       é o único lugar onde ela precisa existir.

     Aceita {n} e {N}, e não toca em mais nada entre chaves: quem
     escrever "{5}" está escrevendo cinco entre chaves. */
  TOKEN_N: /\{[nN]\}/g,

  _resolverTitulo(titulo, alvo) {
    const t = String(titulo || '');
    if (!this.TOKEN_N.test(t)) { this.TOKEN_N.lastIndex = 0; return t; }
    this.TOKEN_N.lastIndex = 0;
    return t.replace(this.TOKEN_N, alvo ? String(alvo) : '__');
  },

  _previaTitulo() {
    const el = document.getElementById('fm-rep-previa');
    const e  = this._estado;
    if (!el) return;

    // O teto do XP por clique vem do servidor, não de um número
    // digitado aqui — a Balança pode mudar sem tocar nesta tela.
    // O QUE A BALANCA DIZ. Numeros do servidor, sempre — se estivessem
    // escritos aqui, mudar a Balanca deixaria a tela mentindo ate o
    // proximo deploy.
    const teto = document.getElementById('fm-rep-teto');
    if (teto) {
      const r = this._servidor?.repeticao;
      teto.innerHTML = r
        ? `${this._gl('xp', 12)} Cada repetição paga <b>${r.por_clique} XP</b>,
           até <b>${r.por_dia}</b> por dia neste contador.
           <span class="fm-rep-fonte">definido na Balança</span>`
        : `${this._gl('xp', 12)} <i>consultando a Balança…</i>`;
    }

    this.TOKEN_N.lastIndex = 0;
    const tem = this.TOKEN_N.test(e.titulo || '');
    this.TOKEN_N.lastIndex = 0;

    if (e.rep_modo !== 'META' || !tem) { el.innerHTML = ''; el.hidden = true; return; }
    const esc = s => String(s).replace(/[&<>"]/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    el.hidden = false;
    el.innerHTML = e.alvo_repeticoes
      ? `<span class="fm-rep-seta">↳</span> ficará: <b>${esc(this._resolverTitulo(e.titulo, e.alvo_repeticoes))}</b>`
      : `<span class="fm-rep-seta">↳</span> <i>informe o número acima para ver o título final</i>`;
  },

  /* ── OS CONTADORES ────────────────────────────────────────
     "A sugestão de contador vem ANTES da lista": escolher entre trinta
     é trabalho, confirmar uma sugestão é um olhar. */
  async _consultarContadores() {
    try { this._contadores = await API.get('/contadores') || []; }
    catch (_) { this._contadores = []; }
    this._pintarContadores();
  },

  /* Acha o contador cujo nome mais se parece com o título da missão.
     Palavras de 4+ letras, sem acento — "Responder 5 questões de
     História" acha "Questões" por causa de "questoes". */
  _sugerirContador(titulo) {
    const norm = s => (s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');   // marcas de acento
    const alvo = norm(titulo);
    if (!alvo || !this._contadores?.length) return null;
    let melhor = null, pontos = 0;
    for (const c of this._contadores) {
      const p = norm(c.nome).split(/\s+/)
        .filter(w => w.length >= 4 && alvo.includes(w)).length;
      if (p > pontos) { pontos = p; melhor = c; }
    }
    return pontos ? melhor : null;
  },

  _pintarContadores() {
    const el = document.getElementById('fm-rep-contadores');
    if (!el) return;
    const e = this._estado;
    const esc = s => String(s || '').replace(/[&<>"]/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    if (this._contadores === null) { el.innerHTML = '<div class="fm-rep-vazio">carregando…</div>'; return; }

    // A sugestão só age enquanto o hunter não escolheu nada. Depois
    // disso, mudar o título não pode remexer na escolha dele.
    if (e.contador_id === null && !e._contadorTocado) {
      const s = this._sugerirContador(e.titulo);
      if (s) e.contador_id = s.id;
    }

    const item = (id, txt, sub, sel, extra = '') =>
      `<button type="button" class="fm-rep-item${sel ? ' sel' : ''}"
               data-fm-contador="${id}" ${extra}>
         <span class="fm-rep-item-nome">${esc(txt)}</span>
         ${sub ? `<span class="fm-rep-item-sub">${esc(sub)}</span>` : ''}
       </button>`;

    el.innerHTML =
      this._contadores.map(c => item(c.id, c.nome,
        `${(c.total || 0).toLocaleString('pt-BR')} ${c.unidade || 'no total'}`,
        e.contador_id === c.id)).join('')
      + item('novo', '+ Criar contador', 'a partir do título desta missão',
             e.contador_id === 'novo')
      + item('', '— Nenhum', 'conta só o dia, sem acumular',
             e.contador_id === null || e.contador_id === '');
  },

  /* "2026-07-25" no fuso LOCAL. toISOString() daria o dia UTC — que depois
     das 21h de Brasília já é amanhã, e a tarefa nasceria no dia errado.
     Este exato descuido já quebrou um teste deste projeto. */
  _dataLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  _carregarEdicao(ed, tipoForcado) {
    const e = this._estado;

    /* O PACTO PRIMEIRO — e não por gosto de ordem.

       COLISÃO DE NOMES, já paga: o campo `tipo` significa coisas
       diferentes nos dois mundos. Numa rotina é a FREQUÊNCIA ("DIARIA");
       num pacto é o MODO ("QUANTITATIVA"). A detecção abaixo lê `ed.tipo`
       para decidir entre rotina e tarefa — então um pacto caía como
       ROTINA com frequência "QUANTITATIVA", que não existe: o formulário
       abria sem nenhuma frequência marcada e salvava uma rotina quebrada.

       `origem_chave` e `valor_atual` só existem no pacto; qualquer um
       deles serve de assinatura, e uso os dois porque um pacto escrito à
       mão não tem origem_chave. */
    const ehPacto = tipoForcado === 'PACTO'
                 || ed.valor_atual !== undefined
                 || (ed.base !== undefined && ed.teto !== undefined);
    if (ehPacto) {
      e.tipo        = 'PACTO';
      e.titulo      = ed.titulo || '';
      e.pct_tipo    = ed.tipo || 'QUANTITATIVA';
      e.pct_base    = ed.base ?? 1;
      e.pct_teto    = ed.teto ?? 32;
      e.pct_unidade = ed.unidade || '';
      e._pctTocado  = true;   // são os números DELE; trocar de modo não os apaga
      return;
    }

    // Tarefa se denuncia pelo campo `data_prevista`; rotina, pelo `tipo` de
    // frequência. O chamador pode forçar, mas não precisa.
    const ehTarefa = tipoForcado === 'TAREFA' || (!!ed.data_prevista && !ed.tipo);

    e.tipo        = ehTarefa ? 'TAREFA' : 'ROTINA';
    e.titulo      = ed.titulo || '';
    e.descricao   = ed.descricao || '';
    e.prioridade  = ed.prioridade || 'MEDIA';
    e.dificuldade = ed.dificuldade || 'NORMAL';
    e.categoria   = ed.categoria || 'Pessoal';

    if (ehTarefa) {
      e.data_prevista = (ed.data_prevista || '').slice(0, 10) || e.data_prevista;
      if (ed.hora_limite) { e.janela = true; e.hora_fim = ed.hora_limite; }
      if (ed.hora_inicio) { e.janela = true; e.hora_inicio = ed.hora_inicio; }
      if (ed.prazo_personalizado && ed.prazo_minutos) {
        e.prazo_custom = true;
        // Reapresenta na maior unidade inteira: 2880 vira "2 dias", não "2880 min".
        const m = ed.prazo_minutos;
        if (m % 1440 === 0)    { e.prazo_valor = m / 1440; e.prazo_unidade = 1440; }
        else if (m % 60 === 0) { e.prazo_valor = m / 60;   e.prazo_unidade = 60; }
        else                   { e.prazo_valor = m;        e.prazo_unidade = 1; }
      }
    } else {
      e.frequencia = ed.tipo || 'DIARIA';
      e.natureza = (ed.natureza || 'ATIVA').toUpperCase();
    if (e.natureza === 'REPETICAO') {
      const alvo = parseInt(ed.alvo_repeticoes, 10);
      e.rep_modo = (Number.isFinite(alvo) && alvo > 0) ? 'META' : 'BONUS';
      e.alvo_repeticoes = e.rep_modo === 'META' ? alvo : '';
      e.contador_id = ed.contador_id ?? null;
      // Editar ja e ter decidido: a sugestao nao pode reescrever a
      // escolha que o hunter fez quando criou.
      e._contadorTocado = true;
    }
      e.dias_semana = Array.isArray(ed.dias_semana) ? [...ed.dias_semana]
        : (typeof ed.dias_semana === 'string' && ed.dias_semana
            ? (() => { try { return JSON.parse(ed.dias_semana); } catch (_) { return []; } })()
            : []);
      e.dia_mes = ed.dia_mes || '';
      e.mes_dia = ed.mes_dia || '';
      if (ed.hora_inicio || ed.hora_fim) {
        e.janela = true;
        e.hora_inicio = ed.hora_inicio || '';
        e.hora_fim = ed.hora_fim || '';
      }
    }
  },

  fechar() {
    document.getElementById('fm-backdrop')?.classList.remove('on');
  },

  /* ── Render do modal ───────────────────────────────────── */
  _render() {
    let bd = document.getElementById('fm-backdrop');
    if (!bd) {
      bd = document.createElement('div');
      bd.id = 'fm-backdrop';
      bd.className = 'fm-backdrop';
      document.body.appendChild(bd);
      bd.addEventListener('click', e => { if (e.target === bd) this.fechar(); });
    }

    const e = this._estado;

    const ico = (n, t) => this._ico(n, t);
    const gl  = (n, t) => this._gl(n, t);

    const grupo = (campo, itens, cols) => `
      <div class="fm-opcoes c${cols}">
        ${itens.map(o => `
          <div class="fm-op ${e[campo] === o.id ? 'sel' : ''}"
               style="--op-cor:${o.cor || 'var(--purple-glow)'}"
               data-fm-campo="${campo}" data-fm-valor="${o.id}">
            <span class="ico">${ico(o.ico)}</span>
            <span class="txt">${o.txt}</span>
            ${o.sub ? `<span class="sub">${o.sub}</span>` : ''}
          </div>`).join('')}
      </div>`;

    bd.innerHTML = `
      <div class="fm-modal" id="fm-modal">
        <div class="fm-fio"></div>

        <div class="fm-head">
          <div class="fm-sigilo">
            <svg viewBox="0 0 50 50" aria-hidden="true">
              <g class="fm-sigilo-anel">
                <polygon points="25,6 30,20 44,25 30,30 25,44 20,30 6,25 20,20"
                  fill="none" stroke="currentColor" stroke-width="1.6" style="color:var(--fm-cor)"/>
              </g>
              <g class="fm-sigilo-orb">
                <circle cx="25" cy="25" r="19" fill="none" stroke="currentColor" stroke-opacity=".55"
                  stroke-width="1" stroke-dasharray="9 38" style="color:var(--fm-cor)"/>
              </g>
            </svg>
          </div>
          <div style="flex:1;min-width:0">
            <div class="fm-titulo">${this._editId ? 'Reforjar Missão' : 'Forjar Missão'}</div>
            <div class="fm-sub">${this._demo ? 'Vitrine — nada será salvo'
              : (this._editId ? 'Editando — a recompensa é recalculada pelo Sistema'
                              : 'Sistema de Missões Solo Routines')}</div>
          </div>
          <button class="fm-fechar" data-fm-fechar>✕</button>
        </div>

        <div class="fm-corpo">
          <!-- ── Formulário ── -->
          <div class="fm-form">
            <div class="fm-bloco fm-full">${grupo('tipo', this.TIPOS, 3)}</div>

            <div class="fm-bloco fm-full">
              <div class="fm-rotulo">${gl("titulo")} Título da missão <span class="obrig">*</span></div>
              <input id="fm-titulo-input" class="fm-input" maxlength="120"
                     placeholder="O que precisa ser feito?" value="${e.titulo}">
            </div>

            <!-- ── O PACTO ──────────────────────────────────────
                 Só aparece quando o tipo é PACTO. Aqui não há prioridade,
                 dificuldade, categoria nem recompensa: um pacto não paga
                 XP, ele cobra. Deixar aqueles campos na tela faria o
                 formulário prometer coisas que o POST /pactos ignora. -->
            <div class="fm-bloco fm-full" id="fm-bloco-pacto"
                 ${e.tipo === 'PACTO' ? '' : 'style="display:none"'}>
              <div class="fm-rotulo">${gl("caveira", 14)} Como se cumpre</div>
              ${grupo('pct_tipo', this.PACTO_TIPOS, 2)}

              <div class="fm-pct-numeros" id="fm-pct-numeros">
                <label class="fm-pct-campo">
                  <span class="fm-pct-lbl">Começa em</span>
                  <input type="number" min="1" max="9999" class="fm-input fm-input-mini"
                         data-fm-pct-base value="${e.pct_base}">
                </label>
                <label class="fm-pct-campo">
                  <span class="fm-pct-lbl">Teto</span>
                  <input type="number" min="1" max="9999" class="fm-input fm-input-mini"
                         data-fm-pct-teto value="${e.pct_teto}">
                </label>
                <label class="fm-pct-campo fm-pct-campo-larga">
                  <span class="fm-pct-lbl">Unidade <span class="fm-pct-opc">(opcional)</span></span>
                  <input type="text" maxlength="30" class="fm-input"
                         data-fm-campo-txt="pct_unidade" value="${e.pct_unidade}"
                         placeholder="flexões, horas, minutos...">
                </label>
              </div>

              <!-- O CAMINHO CURTO. Escrever a própria punição do zero é
                   trabalho; adotar do catálogo é um toque. Sem esta porta,
                   quem nunca parou para inventar castigos nunca teria um
                   pacto — e a punição inteira ficaria sem uso. -->
              <button type="button" class="fm-pct-catalogo" data-fm-pct-catalogo>
                ${gl("tudo", 12)} ou adote prontos do catálogo
              </button>
            </div>

            <div class="fm-bloco fm-full" id="fm-bloco-freq\" ${e.tipo === 'TAREFA' ? 'style="display:none"' : ''}>
              <div class="fm-rotulo">${gl("rotina")} Frequência</div>
              ${grupo('frequencia', this.FREQUENCIAS, 4)}

              <!-- Cada frequência tem a sua pergunta. O lançador antigo tinha
                   estes campos e o backend precisa deles: uma SEMANAL sem
                   dias_semana simplesmente nunca é devida (rotina_devida_em). -->
              <div class="fm-agenda" id="fm-agenda-semanal"
                   ${e.frequencia === 'SEMANAL' ? '' : 'style="display:none"'}>
                <div class="fm-rotulo">${gl("agendada", 12)} Em quais dias?</div>
                <div class="fm-dias">
                  ${['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map((d, i) => `
                    <button type="button" class="fm-dia ${e.dias_semana.includes(i) ? 'sel' : ''}"
                            data-fm-dia="${i}">${d}</button>`).join('')}
                </div>
              </div>
              <div class="fm-agenda" id="fm-agenda-mensal"
                   ${e.frequencia === 'MENSAL' ? '' : 'style="display:none"'}>
                <div class="fm-rotulo">${gl("agendada", 12)} Dia do mês</div>
                <input type="number" class="fm-input fm-input-curto" min="1" max="31"
                       data-fm-campo-txt="dia_mes" value="${e.dia_mes}" placeholder="1–31">
              </div>
              <div class="fm-agenda" id="fm-agenda-anual"
                   ${e.frequencia === 'ANUAL' ? '' : 'style="display:none"'}>
                <div class="fm-rotulo">${gl("agendada", 12)} Data no ano</div>
                <input type="date" class="fm-input fm-input-curto"
                       data-fm-anual value="${e.mes_dia ? '2026-' + e.mes_dia : ''}">
              </div>
            </div>

            <!-- NATUREZA — a inversão da missão passiva.
                 Nasce oculto e só aparece se o servidor autorizar
                 (_consultarEspeciais). Nunca decidimos isso pelo cargo que
                 temos em mãos: a permissão é do servidor. -->
            <div class="fm-bloco fm-full" id="fm-bloco-natureza">
              <div class="fm-rotulo">${gl("passiva", 14)} Natureza da missão</div>
              ${grupo('natureza', this._naturezas(), 3)}
              <div class="fm-nota-natureza" id="fm-nota-natureza"></div>
            </div>

            <!-- REPETIÇÕES — só aparece quando a natureza é REPETICAO. -->
            <div class="fm-bloco fm-full" id="fm-bloco-repeticao"
                 ${e.natureza === 'REPETICAO' ? '' : 'style="display:none"'}>
              <div class="fm-rotulo">${gl("repeticao", 14)} Como contar</div>
              ${grupo('rep_modo', this.REP_MODOS, 2)}

              <div id="fm-rep-meta" ${e.rep_modo === 'META' ? '' : 'style="display:none"'}>
                <div class="fm-rep-linha">
                  <label class="fm-rep-campo">
                    <span class="fm-rep-lbl">Quantas vezes?</span>
                    <input type="number" min="1" max="999" class="fm-input fm-input-mini"
                           data-fm-alvo value="${e.alvo_repeticoes || ''}" placeholder="5">
                  </label>
                  <div class="fm-rep-dica">
                    Escreva <code>{n}</code> no título e ele vira o número.
                  </div>
                </div>
                <!-- A PRÉVIA É OBRIGATÓRIA. O token {n} é a primeira sintaxe
                     que este app pede ao hunter; sem ver o resultado ele não
                     confia, e com razão.
                     (Sem crase aqui dentro: este HTML mora num template
                     literal, e uma crase o fecharia no meio.) -->
                <div class="fm-rep-previa" id="fm-rep-previa"></div>
              </div>

              <!-- O XP NAO E CAMPO. Havia um input aqui, e ele era a unica
                   porta do app por onde o hunter mandava um preco. Quem
                   precifica e a Balanca, como em todo o resto — entao o
                   numero e MOSTRADO, nao pedido. -->
              <div id="fm-rep-bonus" ${e.rep_modo === 'BONUS' ? '' : 'style="display:none"'}>
                <div class="fm-rep-balanca" id="fm-rep-teto"></div>
              </div>

              <div class="fm-rep-contador">
                <div class="fm-rep-lbl">${gl("etiqueta", 12)} Contador
                  <span class="fm-rep-sub">onde este número se acumula</span></div>
                <div class="fm-rep-lista" id="fm-rep-contadores"></div>
              </div>
            </div>

            <div class="fm-bloco fm-full" id="fm-bloco-data" ${e.tipo === 'TAREFA' ? '' : 'style="display:none"'}>
              <div class="fm-rotulo">${gl("agendada", 12)} Para quando?</div>
              <div class="fm-quando">
                <input type="date" class="fm-input fm-input-curto"
                       data-fm-campo-txt="data_prevista" value="${e.data_prevista}">
                <!-- A HORA DE INÍCIO. Sem ela, uma missão crítica marcada
                     para amanhã abria às 00:00 e morria às 00:30 — o
                     Arquiteto reportou. O campo existia para a passiva; aqui
                     ele ganha a segunda função. -->
                <label class="fm-quando-hora">
                  <span class="fm-quando-lbl">${gl("relogio", 11)} A partir das</span>
                  <input type="time" class="fm-input fm-input-curto"
                         data-fm-campo-txt="hora_inicio" value="${e.hora_inicio || ''}">
                </label>
              </div>
              <!-- O EFEITO É DITO NA TELA, e muda conforme a escolha. O
                   hunter não pode ter que descobrir amanhã de manhã que o
                   prazo dele correu de madrugada. -->
              <div class="fm-quando-nota" id="fm-quando-nota"></div>
            </div>

            <!-- Prioridade e Dificuldade lado a lado -->
            <div class="fm-bloco" id="fm-bloco-prior">
              <div class="fm-rotulo">${gl("prior_alta")} Prioridade</div>
              ${grupo('prioridade', this.PRIORIDADES, 2)}
            </div>

            <div class="fm-bloco" id="fm-bloco-dific">
              <div class="fm-rotulo">${gl("dific_dificil")} Dificuldade</div>
              ${grupo('dificuldade', this.DIFICULDADES, 2)}
            </div>

            <div class="fm-bloco fm-full" id="fm-bloco-categoria">
              <div class="fm-rotulo">${gl("etiqueta")} Categoria</div>
              ${grupo('categoria', this.CATEGORIAS, 6)}
            </div>

            <div class="fm-bloco fm-full" id="fm-bloco-janela">
              <label class="fm-toggle">
                <input type="checkbox" data-fm-janela ${e.janela ? 'checked' : ''}>
                <span class="fm-toggle-corpo">
                  <span class="fm-toggle-txt">${gl("relogio",14)} Definir janela de horário</span>
                  <span class="fm-toggle-sub">A missão só vale nesse intervalo — o prazo aparece no cartão</span>
                </span>
              </label>
              <div class="fm-horarios ${e.janela ? 'on' : ''}" id="fm-horarios">
                <div><div class="fm-rotulo">Início</div>
                  <input type="time" class="fm-input" data-fm-campo-txt="hora_inicio" value="${e.hora_inicio}"></div>
                <div><div class="fm-rotulo">Prazo final</div>
                  <input type="time" class="fm-input" data-fm-campo-txt="hora_fim" value="${e.hora_fim}"></div>
              </div>
            </div>

            <!-- MODALIDADE PERSONALIZADA (só missão avulsa): o hunter escolhe
                 o PRAZO — e apenas o prazo. A recompensa não sobe junto, e o
                 texto avisa antes que ele descubra do jeito ruim. -->
            <div class="fm-bloco fm-full" id="fm-bloco-prazo" ${e.tipo === 'TAREFA' ? '' : 'style="display:none"'}>
              <label class="fm-toggle">
                <input type="checkbox" data-fm-prazo-custom ${e.prazo_custom ? 'checked' : ''}>
                <span class="fm-toggle-corpo">
                  <span class="fm-toggle-txt">${gl("ampulheta", 14)} Prazo personalizado</span>
                  <span class="fm-toggle-sub">Você escolhe quanto tempo a missão dura — a recompensa não muda com o prazo</span>
                </span>
              </label>
              <div class="fm-horarios ${e.prazo_custom ? 'on' : ''}" id="fm-prazo-campos">
                <div><div class="fm-rotulo">Duração</div>
                  <input type="number" class="fm-input" min="1" max="365"
                         data-fm-prazo-valor value="${e.prazo_valor}"></div>
                <div><div class="fm-rotulo">Unidade</div>
                  <select class="fm-input" data-fm-prazo-unidade>
                    <option value="1"    ${e.prazo_unidade === 1 ? 'selected' : ''}>minutos</option>
                    <option value="60"   ${e.prazo_unidade === 60 ? 'selected' : ''}>horas</option>
                    <option value="1440" ${e.prazo_unidade === 1440 ? 'selected' : ''}>dias</option>
                  </select></div>
              </div>
            </div>

            <!-- ── O QUE O SISTEMA VAI CONCEDER ──────────────────
                 Estes números são EXIBIÇÃO, não campos. Antes eram
                 editáveis, e isso virou mentira quando o servidor
                 passou a precificar sozinho: dava para digitar
                 9.999.999 XP e a missão nascia valendo 50.
                 Agora quem responde é o servidor (/economia/simular),
                 então o que está na tela é o que será concedido. -->
            <div class="fm-caixa fm-caixa-premio" id="fm-caixa-premio">
              <div class="fm-rotulo">${gl("xp")} Recompensa</div>
              <div class="fm-mini">
                <div class="fm-mini-campo"><label>XP</label>
                  <div class="fm-valor" id="fm-v-xp">—</div></div>
                <div class="fm-mini-campo"><label>Mana</label>
                  <div class="fm-valor" id="fm-v-mc">—</div></div>
              </div>
              <div class="fm-nota-calc">${gl("engrenagem", 11)} calculado pelo Sistema</div>
            </div>
            <div class="fm-caixa fm-caixa-punicao" id="fm-caixa-punicao">
              <div class="fm-rotulo">${gl("dific_lendario")} Punição e prazo</div>
              <div class="fm-mini">
                <div class="fm-mini-campo"><label>XP perdido</label>
                  <div class="fm-valor fm-valor-perda" id="fm-v-pen">—</div></div>
                <div class="fm-mini-campo"><label>Prazo</label>
                  <div class="fm-valor fm-valor-prazo" id="fm-v-prazo">—</div></div>
              </div>
            </div>

            <div class="fm-bloco fm-full" id="fm-bloco-desc">
              <div class="fm-rotulo">${gl("avulsa")} Descrição (opcional)</div>
              <textarea class="fm-textarea" data-fm-campo-txt="descricao"
                placeholder="Detalhes, critério de conclusão, lembretes...">${e.descricao}</textarea>
            </div>
          </div>

          <!-- ── Prévia ao vivo ── -->
          <div class="fm-lado">
            <div class="fm-previa-lbl">${gl("olho")} Prévia do cartão</div>
            <div class="fm-previa" id="fm-previa"></div>
            <div class="fm-resumo" id="fm-resumo"></div>
            <!-- A prévia do pacto NÃO é um cartão de missão. Mostrar o
                 cartão da penitência aqui confundiria de novo a REGRA com
                 a OCORRÊNCIA — o erro que o Arquiteto já corrigiu uma vez.
                 O que importa antes de firmar é para onde isto CRESCE. -->
            <div class="fm-pct-previa" id="fm-pct-previa" style="display:none"></div>
            <div class="fm-previa-nota">
              A cor vem da <b>prioridade</b>; o selo de rank, da <b>dificuldade</b>.
              Deixe XP/Mana em branco para o Sistema calcular.
            </div>
          </div>
        </div>

        <div class="fm-rodape">
          <button class="fm-btn fm-btn-cancelar" data-fm-fechar>Cancelar</button>
          <button class="fm-btn fm-btn-forjar" data-fm-salvar>
            ${gl("bigorna")} ${this._editId ? 'Selar alterações' : 'Forjar Missão'}</button>
        </div>
      </div>`;

    this._bind(bd);
    // _trocarTipo aplica o estado inicial dos blocos. Sem esta chamada,
    // abrir JÁ em PACTO (pelo botão da aba) desenharia o bloco do pacto
    // por cima do formulário de missão inteiro — os dois visíveis.
    this._trocarTipo();
  },

  /* ── Eventos (delegação) ───────────────────────────────── */
  _bind(bd) {
    if (bd.dataset.bound) return;
    bd.dataset.bound = '1';

    bd.addEventListener('click', (ev) => {
      // Dias da semana: seleção MÚLTIPLA — não passa pelo fluxo dos grupos.
      const dia = ev.target.closest('[data-fm-dia]');
      if (dia) {
        const i = parseInt(dia.dataset.fmDia, 10);
        const ds = this._estado.dias_semana;
        const pos = ds.indexOf(i);
        if (pos >= 0) ds.splice(pos, 1); else ds.push(i);
        dia.classList.toggle('sel', pos < 0);
        this._atualizar();
        return;
      }

      const op = ev.target.closest('[data-fm-campo]');
      if (op) {
        this._estado[op.dataset.fmCampo] = op.dataset.fmValor;
        // repinta o grupo inteiro (seleção única)
        op.parentElement.querySelectorAll('.fm-op').forEach(x => x.classList.remove('sel'));
        op.classList.add('sel');
        const mostra = (id, on) => {
          const el = document.getElementById(id);
          if (el) el.style.display = on ? '' : 'none';
        };
        if (op.dataset.fmCampo === 'tipo') {
          // TRÊS estados agora, não dois. Enquanto eram ROTINA e TAREFA,
          // `const t = tipo === 'TAREFA'` e `!t` bastavam. Com o PACTO no
          // meio, `!t` passou a significar "rotina OU pacto" — e a
          // frequência voltaria a aparecer no pacto.
          this._trocarTipo();
        }
        if (op.dataset.fmCampo === 'natureza') {
          const rep = this._estado.natureza === 'REPETICAO';
          mostra('fm-bloco-repeticao', rep);
          if (rep) {
            // A lista só é buscada quando ela vai aparecer. Consultar na
            // abertura seria uma requisição em toda missão criada, e a
            // esmagadora maioria não é de repetição.
            if (this._contadores === null) this._consultarContadores();
            else this._pintarContadores();
          }
        }
        if (op.dataset.fmCampo === 'pct_tipo') {
          /* Cada tipo tem números que fazem sentido. Trocar de "contar"
             para "cronometrar" mantendo base 1 e teto 32 daria "1 minuto,
             teto 32" — tecnicamente válido e obviamente errado. Os
             padrões só entram se o hunter ainda não mexeu nos campos. */
          if (!this._estado._pctTocado) {
            const padrao = { QUANTITATIVA: [1, 32], RESTRITIVA: [12, 48],
                             TEMPORAL: [20, 180], TRIBUTO: [50, 800] }[this._estado.pct_tipo];
            if (padrao) {
              this._estado.pct_base = padrao[0];
              this._estado.pct_teto = padrao[1];
              const b = document.querySelector('[data-fm-pct-base]');
              const t = document.querySelector('[data-fm-pct-teto]');
              if (b) b.value = padrao[0];
              if (t) t.value = padrao[1];
            }
          }
          this._atualizar();
          return;
        }
        if (op.dataset.fmCampo === 'rep_modo') {
          mostra('fm-rep-meta',  this._estado.rep_modo === 'META');
          mostra('fm-rep-bonus', this._estado.rep_modo === 'BONUS');
          this._previaTitulo();
        }
        // A passiva EXIGE janela — é dela que sai o "das 16:00 às 05:00".
        // Marcar sozinho evita o erro do servidor num caminho que o hunter
        // não tem como adivinhar.
        if (op.dataset.fmCampo === 'natureza' && this._estado.natureza === 'PASSIVA'
            && !this._estado.janela) {
          this._estado.janela = true;
          const chk = bd.querySelector('[data-fm-janela]');
          if (chk) chk.checked = true;
          document.getElementById('fm-horarios')?.classList.add('on');
        }
        if (op.dataset.fmCampo === 'frequencia') {
          const f = this._estado.frequencia;
          mostra('fm-agenda-semanal', f === 'SEMANAL');
          mostra('fm-agenda-mensal',  f === 'MENSAL');
          mostra('fm-agenda-anual',   f === 'ANUAL');
        }
        // Estas cinco escolhas são exatamente as que mudam o preço. Qualquer
        // uma delas obriga a perguntar de novo ao servidor — era isto que
        // faltava, e por isso XP e punição ficavam parados.
        if (['tipo', 'frequencia', 'prioridade', 'dificuldade', 'categoria']
              .includes(op.dataset.fmCampo)) {
          this._agendarConsulta();
        }
        this._atualizar();
        return;
      }
      const ct = ev.target.closest('[data-fm-contador]');
      if (ct) {
        const v = ct.dataset.fmContador;
        this._estado.contador_id = v === '' ? null : (v === 'novo' ? 'novo' : parseInt(v, 10));
        // A partir daqui a sugestao se cala. Ela ajuda quem nao decidiu;
        // sobrescrever quem decidiu seria o app discordando do hunter.
        this._estado._contadorTocado = true;
        this._pintarContadores();
        return;
      }
      if (ev.target.closest('[data-fm-fechar]')) { this.fechar(); return; }
      if (ev.target.closest('[data-fm-auto]'))   { this._estado.auto = !this._estado.auto;
        ev.target.closest('[data-fm-auto]').classList.toggle('on', this._estado.auto);
        if (this._estado.auto) this._estado.pen = null;
        this._atualizar(); return; }
      if (ev.target.closest('[data-fm-pct-catalogo]')) {
        /* DELEGA em vez de redesenhar. O catálogo já existe inteiro em
           pages/pacto.js, com os grupos e a marcação do que já foi
           adotado. Uma segunda cópia aqui seria a mesma lista em dois
           lugares — e a que ninguém lembra de atualizar é sempre a
           segunda. */
        this.fechar();
        if (window.Pacto?.abrirCatalogo) {
          if (window.App?.currentPage !== 'pacto') window.App?.navigate?.('pacto');
          setTimeout(() => Pacto.abrirCatalogo(), 120);
        } else {
          window.App?.navigate?.('pacto');
        }
        return;
      }
      if (ev.target.closest('[data-fm-salvar]')) { this._salvar(); return; }
    });

    bd.addEventListener('change', (ev) => {
      if (ev.target.matches('[data-fm-janela]')) {
        this._estado.janela = ev.target.checked;
        document.getElementById('fm-horarios')?.classList.toggle('on', this._estado.janela);
        this._atualizar();
        return;
      }
      if (ev.target.matches('[data-fm-prazo-custom]')) {
        this._estado.prazo_custom = ev.target.checked;
        document.getElementById('fm-prazo-campos')?.classList.toggle('on', this._estado.prazo_custom);
        this._atualizar();
        return;
      }
      if (ev.target.matches('[data-fm-prazo-unidade]')) {
        this._estado.prazo_unidade = parseInt(ev.target.value, 10) || 1;
        this._atualizar();
        return;
      }
      // O input date entrega "2026-03-15"; o backend guarda só "MM-DD",
      // porque a rotina anual não pertence a um ano específico.
      if (ev.target.matches('[data-fm-anual]')) {
        this._estado.mes_dia = (ev.target.value || '').slice(5);
        this._atualizar();
      }
    });

    bd.addEventListener('input', (ev) => {
      const t = ev.target;
      if (t.id === 'fm-titulo-input') {
        this._estado.titulo = t.value;
        if (this._estado.tipo === 'PACTO') { this._atualizar(); return; }
        this._previaTitulo();
        // A sugestao de contador segue o titulo — mas so ate o hunter
        // escolher um. Depois disso, mexer no titulo nao pode remexer
        // na escolha dele.
        if (!this._estado._contadorTocado) this._pintarContadores();
        this._atualizar(); return;
      }
      if (t.matches('[data-fm-alvo]')) {
        const v = parseInt(t.value, 10);
        this._estado.alvo_repeticoes = (Number.isFinite(v) && v > 0) ? v : '';
        this._previaTitulo();
        this._atualizar(); return;
      }
      if (t.matches('[data-fm-pct-base]') || t.matches('[data-fm-pct-teto]')) {
        // `_pctTocado` congela os padrões por tipo: depois que o hunter
        // escolheu os próprios números, trocar de tipo não pode
        // sobrescrevê-los.
        this._estado._pctTocado = true;
        const campo = t.matches('[data-fm-pct-base]') ? 'pct_base' : 'pct_teto';
        const v = parseInt(t.value, 10);
        this._estado[campo] = Number.isFinite(v) && v > 0 ? v : '';
        this._atualizar(); return;
      }
      if (t.matches('[data-fm-prazo-valor]')) {
        this._estado.prazo_valor = Math.max(1, parseInt(t.value, 10) || 1);
        this._atualizar();
        return;
      }
      if (t.dataset.fmCampoTxt) { this._estado[t.dataset.fmCampoTxt] = t.value; this._atualizar(); return; }
      if (t.dataset.fmNum) {
        const v = t.value === '' ? null : Math.max(0, parseInt(t.value) || 0);
        this._estado[t.dataset.fmNum] = v;
        if (t.dataset.fmNum === 'pen' && v !== null) {
          this._estado.auto = false;
          document.querySelector('[data-fm-auto]')?.classList.remove('on');
        }
        this._atualizar();
      }
    });

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && document.getElementById('fm-backdrop')?.classList.contains('on')) {
        this.fechar();
      }
    });
  },

  /* Quem aparece em cada tipo. UMA função, e não condições espalhadas
     pelos handlers: o pacto some/aparece em nove blocos, e nove `if`
     soltos garantem que um dia um deles fique para trás. */
  _trocarTipo() {
    const e = this._estado;
    const pacto  = e.tipo === 'PACTO';
    const tarefa = e.tipo === 'TAREFA';
    const mostra = (id, on) => {
      const el = document.getElementById(id);
      if (el) el.style.display = on ? '' : 'none';
    };

    mostra('fm-bloco-pacto', pacto);

    // Tudo que é de MISSÃO some no pacto. Um pacto não tem frequência
    // (ele não acontece — ele espera), não tem prioridade nem
    // dificuldade (quem escolhe é o Sistema, sorteando), e sobretudo
    // não tem recompensa: ele cobra, não paga.
    mostra('fm-bloco-freq',      !pacto && !tarefa);
    mostra('fm-bloco-data',      !pacto && tarefa);
    mostra('fm-bloco-prazo',     !pacto && tarefa);
    mostra('fm-bloco-natureza',  !pacto && this._blocoNaturezaLiberado !== false);
    mostra('fm-bloco-repeticao', !pacto && e.natureza === 'REPETICAO');
    mostra('fm-bloco-prior',     !pacto);
    mostra('fm-bloco-dific',     !pacto);
    mostra('fm-bloco-categoria', !pacto);
    mostra('fm-bloco-janela',    !pacto);
    mostra('fm-bloco-desc',      !pacto);
    mostra('fm-caixa-premio',    !pacto);
    mostra('fm-caixa-punicao',   !pacto);

    // O rótulo do botão. "Forjar Missão" num pacto seria o formulário
    // dizendo que faz outra coisa do que faz.
    const btn = document.querySelector('[data-fm-salvar]');
    if (btn) {
      btn.innerHTML = this._gl('bigorna') + ' ' + (
        this._editId ? (pacto ? 'Selar pacto' : 'Selar alterações')
                     : (pacto ? 'Firmar Pacto' : 'Forjar Missão'));
    }
    const tit = document.querySelector('.fm-titulo');
    if (tit) tit.textContent = pacto
      ? (this._editId ? 'Reescrever Pacto' : 'Firmar Pacto')
      : (this._editId ? 'Reforjar Missão'  : 'Forjar Missão');

    const inp = document.getElementById('fm-titulo-input');
    if (inp) inp.placeholder = pacto ? 'Fazer {n} flexões'
                                     : 'O que precisa ser feito?';

    this._atualizar();
  },

  /* ── Atualiza cor do modal + prévia + resumo ───────────── */
  /* Pergunta ao SERVIDOR quanto a missão vale e quanto tempo ela tem.

     Antes o cliente recalculava por conta própria, com uma cópia das tabelas.
     Duas cópias divergem na primeira vez que o Arquiteto muda um valor — e a
     prévia passaria a prometer o que o servidor não daria. Agora ele pergunta;
     o cálculo local sobrou apenas como resposta imediata enquanto a rede não
     volta, para os números não piscarem "—" a cada clique. */
  /* OS NÚMEROS CONGELAVAM, e este era o defeito.

     Esta consulta só acontecia UMA VEZ, na abertura. Como `_atualizar()` dá
     preferência ao valor do servidor (`s.xp_recompensa ?? calc.xp`), e esse
     valor passava a existir logo no primeiro retorno, todo clique posterior
     em Crítica, Lendário ou Semanal repintava a tela com o MESMO número da
     abertura. O palpite local — que reagia corretamente — nunca era usado,
     porque o `??` só cede quando o lado esquerdo é nulo.

     Ou seja: quanto mais fiel eu fiz a prévia (perguntando ao servidor), mais
     morta ela ficou. Agora toda mudança de característica reconsulta.

     ESPERA um tiquinho antes de disparar: clicar Crítica → Lendário →
     Difícil em sequência renderia três requisições, e a resposta da primeira
     poderia chegar por último e pintar o valor errado. O debounce resolve as
     duas coisas — e `_pedido` garante que resposta atrasada de um pedido
     velho seja descartada. */
  _agendarConsulta() {
    clearTimeout(this._debounce);
    this._debounce = setTimeout(() => this._consultarServidor(), 180);
  },

  async _consultarServidor() {
    const e = this._estado;
    const meu = (this._pedido = (this._pedido || 0) + 1);
    try {
      const v = await API.get('/economia/simular?' + new URLSearchParams({
        tipo: e.frequencia, prioridade: e.prioridade,
        dificuldade: e.dificuldade, categoria: e.categoria,
        avulsa: e.tipo === 'TAREFA',
      }));
      if (meu !== this._pedido) return;   // chegou tarde: já há pedido mais novo
      this._servidor = v;
      this._atualizar();
    } catch (_) { /* silencioso: fica o palpite local */ }
  },

  _fmtPrazo(min) {
    if (!min && min !== 0) return '—';
    if (min >= 1440) {
      const d = Math.floor(min / 1440), h = Math.round((min % 1440) / 60);
      return h ? `${d}d ${h}h` : `${d}d`;
    }
    if (min >= 60) {
      const h = Math.floor(min / 60), m = min % 60;
      return m ? `${h}h ${m}min` : `${h}h`;
    }
    return `${min}min`;
  },

  /* ── A AMOSTRA DA PRÉVIA ──────────────────────────────────

     Este objeto era construído inline dentro do `_atualizar`, e sem
     `natureza`. O resultado: a prévia mudava de cor, de rank, de
     prazo — e NÃO mudava na única coisa que muda o cartão inteiro.
     Trocar de Ativa para Repetições reescreve o miolo, a moldura e os
     botões, e a prévia continuava desenhando uma missão comum.

     O Arquiteto pegou. Virou método por isso: um objeto que precisa
     de três formas diferentes não cabe mais como literal no meio de
     outra função.

     CADA NATUREZA PRECISA DE CAMPOS DIFERENTES, e é aí que estava a
     armadilha — não bastava passar `natureza` adiante:

       PASSIVA     o cartão só desenha a moldura e a barra do
                   protocolo se houver PRAZO. Sem `prazo_ate_abrir`,
                   `prazo_minutos` e `prazo_restante` ele cai no
                   layout comum e a prévia continuaria mentindo, agora
                   de um jeito mais sutil.

       REPETIÇÃO   com alvo, precisa de `repeticoes` para os segmentos
                   terem o que mostrar; sem alvo, precisa de um total
                   para a caixa fazer sentido.

     OS NÚMEROS DA AMOSTRA SÃO INVENTADOS, e de propósito: uma missão
     que ainda não existe não tem progresso. Mostrar tudo em zero
     seria honesto e inútil — o hunter não veria o desenho que está
     escolhendo. A nota abaixo da prévia já diz que é ilustração. */
  _amostra(e, xp, mc) {
    const base = {
      id: 0, titulo: e.titulo || 'Título da missão…',
      categoria: e.categoria, prioridade: e.prioridade, dificuldade: e.dificuldade,
      xp_recompensa: xp, moedas_recompensa: mc,
      hora_inicio: e.janela ? e.hora_inicio : '', hora_fim: e.janela ? e.hora_fim : '',
      status_hoje: 'PENDENTE',
      natureza: e.natureza || 'ATIVA',
    };

    if (e.natureza === 'PASSIVA') {
      // Em vigor e a meio caminho: é o estado em que o protocolo passa
      // a maior parte da vida, e o único em que dá para julgar a
      // moldura correndo e a barra enchendo.
      const janela = 12 * 60;
      return { ...base,
        prazo_ate_abrir: -3600,               // negativo = já começou
        prazo_minutos:   janela,
        prazo_restante:  Math.round(janela * 60 * 0.55) };
    }

    if (e.natureza === 'REPETICAO') {
      const alvo = e.rep_modo === 'META' ? parseInt(e.alvo_repeticoes, 10) : null;
      if (Number.isFinite(alvo) && alvo > 0) {
        // Pouco mais de um terço: acende segmentos cheios E deixa um
        // em curso, que é o que mostra o preenchimento por dentro.
        return { ...base, alvo_repeticoes: alvo,
                 repeticoes: Math.max(1, Math.round(alvo * 0.4)) };
      }
      const c = (this._contadores || []).find(x => x.id === e.contador_id);
      return { ...base, alvo_repeticoes: null, repeticoes: 7,
               total_contador: c ? (c.total || 0) + 7 : 128,
               unidade_contador: c?.unidade || '' };
    }

    return base;
  },

  _atualizar() {
    const e = this._estado;

    /* O PACTO SAI CEDO. O resto desta função desenha o cartão da missão,
       pede preço ao servidor e escreve XP/Mana/punição na tela — nada
       disso existe num pacto, e deixá-la seguir escreveria "+120 XP" ao
       lado de uma penitência. */
    if (e.tipo === 'PACTO') {
      document.getElementById('fm-modal')
        ?.style.setProperty('--fm-cor', this._pactoTipo().cor);
      const ver = (id, on) => {
        const el = document.getElementById(id);
        if (el) el.style.display = on ? '' : 'none';
      };
      ver('fm-previa', false); ver('fm-resumo', false);
      ver('fm-pct-previa', true);
      const nota = document.querySelector('.fm-previa-nota');
      if (nota) nota.style.display = 'none';
      // O TRIBUTO não tem unidade escrita pelo hunter: quem diz quanto
      // custa é a Balança, e o campo aberto seria uma segunda opinião.
      const num = document.getElementById('fm-pct-numeros');
      if (num) num.classList.toggle('fm-pct-tributo', e.pct_tipo === 'TRIBUTO');
      this._previaPacto();
      return;
    }
    document.getElementById('fm-pct-previa')?.style.setProperty('display', 'none');
    ['fm-previa', 'fm-resumo'].forEach(id => {
      const el = document.getElementById(id); if (el) el.style.display = '';
    });
    const notaP = document.querySelector('.fm-previa-nota');
    if (notaP) notaP.style.display = '';

    const pri = this.PRIORIDADES.find(p => p.id === e.prioridade) || this.PRIORIDADES[2];

    // O servidor manda; o cálculo local é só o palpite enquanto ele não responde.
    const calc = this._calcular(e);
    const s    = this._servidor || {};
    const xp   = s.xp_recompensa     ?? calc.xp;
    const mc   = s.moedas_recompensa ?? calc.mc;
    const pen  = s.penalidade_xp     ?? calc.pen;
    // Prazo personalizado vence a tabela NA EXIBIÇÃO DO PRAZO — e em nada
    // mais. XP, Mana e punição continuam vindo do servidor, indiferentes.
    const prazo = (e.tipo === 'TAREFA' && e.prazo_custom)
      ? Math.max(5, e.prazo_valor * e.prazo_unidade)
      : s.prazo_minutos;

    const por = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    por('fm-v-xp',    xp.toLocaleString('pt-BR'));
    por('fm-v-mc',    mc.toLocaleString('pt-BR'));
    por('fm-v-pen',   pen ? '−' + pen.toLocaleString('pt-BR') : '0');
    por('fm-v-prazo', this._fmtPrazo(prazo));

    // A cor da prioridade comanda o modal inteiro
    document.getElementById('fm-modal')?.style.setProperty('--fm-cor', pri.cor);

    // Prévia: usa o COMPONENTE REAL do cartão
    const previa = document.getElementById('fm-previa');
    if (previa && window.MissaoCard) {
      MissaoCard.cachear([]);            // prévia não entra no timer global
      previa.innerHTML = MissaoCard.html(this._amostra(e, xp, mc));
    }

    // Resumo econômico
    const resumo = document.getElementById('fm-resumo');
    if (resumo) {
      const freqTxt = e.tipo === 'TAREFA' ? 'Avulsa'
        : (this.FREQUENCIAS.find(f => f.id === e.frequencia)?.txt || '');
      const diasTxt = e.tipo === 'ROTINA' && e.frequencia === 'SEMANAL' && e.dias_semana.length
        ? [...e.dias_semana].sort().map(i => ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'][i]).join(' · ')
        : '';
      resumo.innerHTML = `
        <div class="fm-resumo-linha"><span>Tipo</span><b>${e.tipo === 'TAREFA' ? 'Tarefa' : 'Rotina'} · ${freqTxt}</b></div>
        ${diasTxt ? `<div class="fm-resumo-linha"><span>Dias</span><b>${diasTxt}</b></div>` : ''}
        <div class="fm-resumo-linha"><span>Ao concluir</span><b class="ganho">+${xp} XP · +${mc} ${this._gl("moeda", 12)}</b></div>
        <div class="fm-resumo-linha"><span>Se falhar</span><b class="perda">−${pen} XP</b></div>
        ${e.tipo === 'TAREFA' && e.prazo_custom
          ? `<div class="fm-resumo-linha"><span>Prazo escolhido</span><b>${this._fmtPrazo(prazo)}</b></div>` : ''}
        ${e.janela && e.hora_fim ? `<div class="fm-resumo-linha"><span>Prazo diário</span><b>${e.hora_inicio || '--:--'} → ${e.hora_fim}</b></div>` : ''}`;
    }

    // A nota da natureza explica a inversão em uma frase. Sem ela, "Passiva"
    // é só uma palavra — e o hunter descobre o que ela faz só no dia seguinte.
    const nota = document.getElementById('fm-nota-natureza');
    if (nota) {
      // TRES naturezas, tres notas. Com duas, a repeticao caia no `else`
      // e era descrita como "missao normal" — a explicacao errada e pior
      // que nenhuma, porque o hunter acredita nela.
      const NOTAS = {
        PASSIVA: `${this._gl('passiva', 12)} <b>Protocolo:</b> ela se acende sozinha no
           início da janela e se <b>cumpre sozinha</b> no fim. Você só age se
           <b>quebrar</b> — aí confessa, paga metade da punição e mantém a sequência.
           <i>Ex.: sem cafeína das 16:00 às 05:00.</i>`,
        REPETICAO: e.rep_modo === 'META'
          ? `${this._gl('repeticao', 12)} <b>Meta:</b> você aperta <b>+1</b> a cada vez
             que fizer, e a missão se <b>conclui sozinha</b> ao bater o número. Conta
             para a sequência e pune se o dia acabar sem cumprir.
             <i>Ex.: responder 5 questões de História.</i>`
          : `${this._gl('repeticao', 12)} <b>Livre:</b> um contador sem fim. Cada
             clique vale um XP pequeno, com teto diário. <b>Não conta para a
             sequência e não pune</b> — é bônus, não cobrança.
             <i>Ex.: quantos copos de água eu bebi.</i>`,
        ATIVA: `${this._gl('ativa', 12)} <b>Missão normal:</b> você precisa iniciar e
           concluir. Passar do prazo é fracasso.`,
      };
      nota.innerHTML = NOTAS[e.natureza] || NOTAS.ATIVA;
    }

    this._notaQuando(e);

    // Botão só habilita com título
    const btn = document.querySelector('[data-fm-salvar]');
    if (btn) btn.disabled = !e.titulo.trim();
  },

  /* ── QUANDO O PRAZO COMEÇA A CORRER ───────────────────────

     O Arquiteto marcou uma missão crítica para amanhã e ela ia morrer
     às 00:30, dormindo. A causa estava no servidor e já foi corrigida;
     esta nota existe para o defeito não voltar por outro caminho — o
     de o hunter não saber o que vai acontecer.

     Regra que a nota explica, em uma frase por caso:
       hoje                    conta a partir de agora
       futuro, sem hora        vale o dia inteiro
       futuro, com hora        conta a partir daquela hora

     O campo de hora some quando a JANELA está ligada: os dois editam o
     mesmo `hora_inicio`, e dois controles para um estado é como se
     perde a confiança num formulário. */
  _notaQuando(e) {
    const campo = document.querySelector('.fm-quando-hora');
    if (campo) campo.style.display = e.janela ? 'none' : '';

    const nota = document.getElementById('fm-quando-nota');
    if (!nota || e.tipo !== 'TAREFA') { if (nota) nota.innerHTML = ''; return; }

    const futura = (e.data_prevista || '') > this._dataLocal();
    const hora = e.janela ? '' : (e.hora_inicio || '');
    const gl = (n, t) => this._gl(n, t);

    if (!futura) {
      nota.className = 'fm-quando-nota';
      nota.innerHTML = `${gl('relogio', 11)} O prazo começa a correr <b>agora</b>, ao criar.`;
      return;
    }
    if (hora) {
      nota.className = 'fm-quando-nota ok';
      nota.innerHTML = `${gl('relogio', 11)} O prazo só começa a correr às
        <b>${hora}</b> do dia marcado. Antes disso ela espera.`;
      return;
    }
    // Sem hora: o Sistema não adivinha, e diz isso.
    nota.className = 'fm-quando-nota aviso';
    nota.innerHTML = `${gl('ampulheta', 11)} Sem horário, ela vale o
      <b>dia inteiro</b>. Informe uma hora se quiser o prazo curto valendo
      a partir dela.`;
  },

  /* ── Salvar (API real) ─────────────────────────────────── */
  async _salvar() {
    const e = this._estado;

    /* O PACTO SAI ANTES DE TUDO. Abaixo há validação de frequência, de
       janela da passiva, de alvo da repetição — nenhuma se aplica, e
       todas dariam mensagens sem sentido num pacto. */
    if (e.tipo === 'PACTO') return this._salvarPacto();

    if (!e.titulo.trim()) { SoloDialog?.toast?.('Dê um nome à missão.', 'error'); return; }
    const calc = this._calcular(e);

    if (this._demo) {
      SoloDialog?.toast?.('Vitrine — nada foi salvo', 'info');
      this.fechar();
      return;
    }

    // Validações que o servidor recusaria de formas menos gentis.
    if (e.tipo === 'ROTINA' && e.frequencia === 'SEMANAL' && !e.dias_semana.length) {
      SoloDialog?.toast?.('Escolha ao menos um dia da semana.', 'error'); return;
    }
    if (e.tipo === 'ROTINA' && e.frequencia === 'MENSAL' && !(+e.dia_mes >= 1 && +e.dia_mes <= 31)) {
      SoloDialog?.toast?.('Informe o dia do mês (1 a 31).', 'error'); return;
    }
    if (e.tipo === 'ROTINA' && e.frequencia === 'ANUAL' && !e.mes_dia) {
      SoloDialog?.toast?.('Escolha a data no ano.', 'error'); return;
    }
    // A passiva sem janela seria um protocolo que dura o dia todo e se cumpre
    // sozinho à meia-noite: XP de graça, todo dia. O servidor recusa; aqui a
    // mensagem explica o porquê antes da viagem.
    if (e.natureza === 'PASSIVA' && !(e.janela && e.hora_inicio && e.hora_fim)) {
      SoloDialog?.toast?.('Missão passiva precisa da janela de horário — '
                        + 'é dela que sai o protocolo (ex.: 16:00 → 05:00).', 'error');
      return;
    }

    // A META SEM NUMERO nao e meta: sem alvo o cartao nao sabe em quantos
    // segmentos se dividir, e o servidor a trataria como BONUS — o hunter
    // veria uma missao que nunca cumpre.
    if (e.natureza === 'REPETICAO' && e.rep_modo === 'META'
        && !(parseInt(e.alvo_repeticoes, 10) > 0)) {
      SoloDialog?.toast?.('Quantas vezes? A meta precisa de um numero.', 'error');
      return;
    }

    const btn = document.querySelector('[data-fm-salvar]');
    if (btn) btn.disabled = true;
    try {
      let salvo = null;
      if (e.tipo === 'ROTINA') {
        const payload = {
          titulo: e.titulo.trim(),
          descricao: e.descricao || null,
          tipo: e.frequencia,
          dias_semana: e.frequencia === 'SEMANAL' ? e.dias_semana : null,
          dia_mes:     e.frequencia === 'MENSAL'  ? parseInt(e.dia_mes, 10) : null,
          mes_dia:     e.frequencia === 'ANUAL'   ? e.mes_dia : null,
          categoria: e.categoria,
          prioridade: e.prioridade,
          dificuldade: e.dificuldade,
          xp_recompensa: e.xp ?? calc.xp,
          moedas_recompensa: e.mc ?? calc.mc,
          penalidade_xp: (e.auto || e.pen === null) ? calc.pen : e.pen,
          hora_inicio: e.janela ? (e.hora_inicio || null) : null,
          hora_fim:    e.janela ? (e.hora_fim || null) : null,
          natureza:    e.natureza || 'ATIVA',
        };

        if (e.natureza === 'REPETICAO') {
          const meta = e.rep_modo === 'META';
          // O {n} e resolvido AQUI, uma vez, e o titulo salvo ja vai
          // pronto. Guardar a sintaxe obrigaria o Extrato, a busca, o bot
          // e a futura guilda a conhece-la.
          payload.alvo_repeticoes = meta ? parseInt(e.alvo_repeticoes, 10) : null;
          payload.titulo = this._resolverTitulo(payload.titulo,
                                                payload.alvo_repeticoes);
          payload.contador_id = await this._resolverContador();
        }
        salvo = this._editId ? await API.rotinas.atualizar(this._editId, payload)
                             : await API.rotinas.criar(payload);
      } else {
        const payload = {
          titulo: e.titulo.trim(),
          descricao: e.descricao || null,
          data_prevista: e.data_prevista || this._dataLocal(),
          hora_limite: e.janela ? (e.hora_fim || null) : null,
          categoria: e.categoria,
          prioridade: e.prioridade,
          // A dificuldade FALTAVA aqui. Como o servidor tem `dificuldade`
          // com default "NORMAL", escolher Lendária numa missão geral não
          // dava erro nenhum: era criada e precificada como Normal enquanto
          // a prévia exibia a promessa maior. A rotina já mandava; a geral não.
          dificuldade: e.dificuldade,
          xp_recompensa: e.xp ?? calc.xp,
          moedas_recompensa: e.mc ?? calc.mc,
          penalidade_xp: (e.auto || e.pen === null) ? calc.pen : e.pen,
          // Personalizada: só o prazo viaja. A recompensa continua sendo a da
          // tabela — o servidor a recalcula e ignora qualquer outro pedido.
          prazo_minutos: e.prazo_custom
            ? Math.max(5, e.prazo_valor * e.prazo_unidade) : null,
          // A NATUREZA VIAJA TAMBEM NA MISSAO GERAL. `hora_inicio` abre a
          // janela da passiva; o `hora_limite` acima ja fechava. Nao criei
          // um `hora_fim` novo aqui de proposito — duas colunas para o
          // mesmo horario seriam duas verdades.
          natureza: e.natureza || 'ATIVA',
          // A HORA VIAJA MESMO SEM JANELA. Ela tem duas funcoes na missao
          // geral: abrir a janela da passiva, e dizer a partir de quando o
          // prazo corre numa missao futura. Amarra-la ao `janela` deixaria
          // o segundo caso sem jeito de existir.
          hora_inicio: e.hora_inicio || null,
        };

        if (e.natureza === 'REPETICAO') {
          const meta = e.rep_modo === 'META';
          payload.alvo_repeticoes = meta ? parseInt(e.alvo_repeticoes, 10) : null;
          payload.titulo = this._resolverTitulo(payload.titulo,
                                                payload.alvo_repeticoes);
          payload.contador_id = await this._resolverContador();
        }

        salvo = this._editId ? await API.tarefas.atualizar(this._editId, payload)
                             : await API.tarefas.criar(payload);
      }
      SoloDialog?.toast?.(this._editId ? 'Missão reforjada!' : 'Missão forjada!', 'success');
      if (typeof SFX !== 'undefined') SFX.play('carimbo');
      this.fechar();
      if (this._aoSalvar) await this._aoSalvar(salvo);

      // NÃO recarrega a página. `App.atualizarPaginaAtual()` refazia o
      // Dashboard inteiro — personagem, stats, gráficos, extrato — para
      // mostrar UM cartão novo. A tela sumia e voltava, e a missão recém
      // criada aparecia no meio do tremor, sem se destacar.
      // Agora só o extrato é pedido de novo, e ele reconcilia: os cartões
      // que já estavam lá permanecem intactos e só o novo entra, brilhando.
      if (window.App?.currentPage === 'dashboard' && window.Dashboard?.carregarExtrato) {
        await Dashboard.carregarExtrato();
        Dashboard.atualizarNumeros?.();
      } else {
        window.App?.atualizarPaginaAtual?.();
      }
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
      if (btn) btn.disabled = false;
    }
  },

  async _salvarPacto() {
    const e = this._estado;
    const titulo = (e.titulo || '').trim();
    if (!titulo) {
      SoloDialog?.toast?.('Escreva o que você deve ao Sistema.', 'error'); return;
    }
    if (this._demo) {
      SoloDialog?.toast?.('Vitrine — nada foi salvo', 'info'); this.fechar(); return;
    }

    const base = Math.max(1, parseInt(e.pct_base, 10) || 1);
    /* O TETO NUNCA FICA ABAIXO DA BASE. O servidor já corrige com
       `max(base, teto)`, mas corrigir em silêncio faria o hunter sair
       daqui achando que firmou teto 5 sobre base 20. Aqui ele é avisado. */
    let teto = parseInt(e.pct_teto, 10) || base;
    if (teto < base) {
      teto = base;
      SoloDialog?.toast?.('O teto não pode ser menor que o início — igualei aos dois.', 'info');
    }

    const payload = {
      titulo,                       // com o {n} INTACTO — ver _previaPacto
      tipo:     e.pct_tipo,
      base,
      teto,
      unidade: (e.pct_unidade || '').trim() || null,
    };

    const btn = document.querySelector('[data-fm-salvar]');
    if (btn) btn.disabled = true;
    try {
      const salvo = this._editId
        ? await API.patch('/pactos/' + this._editId, payload)
        : await API.post('/pactos', payload);
      SoloDialog?.toast?.(this._editId ? 'Pacto reescrito.' : 'Pacto firmado.', 'success');
      if (typeof SFX !== 'undefined') SFX.play('carimbo');
      this.fechar();
      if (this._aoSalvar) await this._aoSalvar(salvo);
      /* O pacto NÃO aparece no Dashboard — só a penitência que ele gerar.
         Recarregar o extrato aqui não mostraria nada de novo e daria a
         impressão de que a criação falhou. Quem precisa saber é a aba
         do Pacto, e só se o hunter estiver nela. */
      if (window.App?.currentPage === 'pacto') await window.Pacto?.carregar?.();
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
      if (btn) btn.disabled = false;
    }
  },
};

window.ForjaMissao = ForjaMissao;

/* ── A Forja assume os botões do app ───────────────────────────
   Esta delegação morava em pages/lancador.js (o lançador antigo). Com o
   antigo aposentado, quem responde aos botões de "nova missão" é a Forja.
   Delegação no document, uma única vez: os botões vivem em telas que são
   recriadas a cada navegação, e um listener por botão morreria com elas. */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('button, a');
  if (!btn) return;
  const id = btn.id;
  if (id === 'btn-nova-missao' || id === 'btn-nova-rotina' ||
      id === 'btn-fab' || id === 'btn-nova-rotina-dash') {
    e.preventDefault();
    ForjaMissao.abrir({ tipo: 'ROTINA' });
  } else if (id === 'btn-nova-tarefa' || id === 'btn-add-tarefa') {
    e.preventDefault();
    ForjaMissao.abrir({ tipo: 'TAREFA' });
  } else if (id === 'btn-pacto-novo') {
    // A aba do Pacto tinha um formulário próprio, num modal improvisado
    // sobre o SoloDialog. Duas telas de criação para a mesma coisa é o
    // caminho mais curto para uma delas envelhecer sozinha.
    e.preventDefault();
    ForjaMissao.abrir({ tipo: 'PACTO', aoSalvar: () => window.Pacto?.carregar?.() });
  }
});
