/* ============================================================
   pecas.js — O Registro das Peças

   POR QUE ESTE ARQUIVO EXISTE

   Hoje o "cartão do hunter" está desenhado em dois lugares:
   `dashboard.js` (≈310 das suas 1.231 linhas) e `perfil.js`
   (`renderHeroCard`, linha 40). Mesmo cartão, HTML diferente,
   ids diferentes, formatação de XP diferente — e já divergiram.

   É o mesmo padrão que este projeto já pagou três vezes: catálogo
   de auras duplicado, dois relógios, duas tabelas de recompensa.
   A correção foi sempre a mesma — FONTE ÚNICA. Aqui ela não existe.

   O QUE UMA PEÇA É

   Um pedaço de interface que sabe se desenhar dentro de qualquer
   contêiner que lhe derem, e sabe morrer sem deixar sujeira.

   Quem hospeda a peça não sabe desenhar. Quem desenha não sabe
   onde está. A regra que sustenta tudo:

       O HOSPEDEIRO é dono dos DADOS.
       A PEÇA é dona dos PIXELS.

   Assim a Vitrine e o Dashboard deixam de ser dois códigos que
   fazem a mesma coisa e viram dois lugares que montam a MESMA
   peça. "Aplicar no Dashboard" para de significar copiar código.

   ────────────────────────────────────────────────────────────
   AS DUAS DECISÕES QUE NÃO SÃO ESTILO — SÃO CICATRIZ

   1) A PEÇA NUNCA SEGURA UM TIMER.

   O carrossel da V4 cria um `setInterval` de 5s e o `fechar()` da
   Vitrine não o limpa: ele segue girando contra um `.pt-v4-grid`
   que já saiu do DOM. Na Vitrine isso dura até o F5. No Dashboard,
   que fica aberto o dia inteiro, acumula.

   A saída óbvia seria exigir disciplina: "toda peça implemente
   `destruir()` e limpe seus timers". Disciplina falha — foi o que
   acabou de acontecer. Então aqui a peça NÃO RECEBE o handle:
   ela pede `host.intervalo(fn, ms)` e o registro guarda o número.
   Uma peça que esqueceu de limpar continua sendo limpa.

   O `dashboard.js` já tinha intuído metade disso na linha 204:
   `if (!canvas.isConnected) return;` — um laço que se desliga ao
   perceber que o DOM sumiu. `host.quadro()` generaliza a ideia.

   2) A PEÇA NUNCA ESCREVE UM ID DO HOSPEDEIRO.

   A V4 escreve `dash-btn-trocar-aura` e `dash-altar` — ids que o
   `dashboard.js` também cria (são 16 ids `dash-*` ao todo). Se ela
   entrasse no Dashboard como está, existiriam dois elementos com o
   mesmo id na mesma página, e `getElementById` devolveria o
   primeiro. O botão de trocar aura passaria a obedecer o errado.

   É o mesmo mecanismo do `_idsUnicos` do `gemas.js`, onde o rubi
   saía roxo por herdar o gradiente da ametista. Ali doeu na cor;
   aqui doeria no clique.

   `precisa: [...]` inverte a dependência: a peça DECLARA o que
   quer, o hospedeiro ENTREGA. E `host.acao('trocar-aura')` põe o
   hospedeiro no comando do que acontece ao clicar.

   ────────────────────────────────────────────────────────────
   USO

     Pecas.registrar({
       id: 'hunter-card-classico', nome: 'Janela do Hunter',
       familia: 'banner', padrao: true,
       precisa: ['hunter', 'reliquias', 'aura'],
       montar(el, dados, host) { ... },
     });

     const inst = Pecas.montar(el, 'banner-v4', dados, {
       acoes: { 'trocar-aura': () => Dashboard.abrirModalAura() },
     });

     Pecas.desmontar(el);      // solta timers e ouvintes
     Pecas.diagnostico();      // o que continua vivo — para os testes

   ESTE ARQUIVO NÃO DESENHA NADA. Ele é o contrato e a caixa de
   ferramentas. Sozinho, não muda um pixel na tela.
   ============================================================ */

const Pecas = {

  _registro: {},
  _vivas: [],
  _seq: 0,

  /* Campos que toda peça precisa ter, e o que se espera de cada um. */
  _OBRIGATORIOS: {
    id:      'string',
    nome:    'string',
    familia: 'string',
    montar:  'function',
  },

  /* ══════════════════════════════════════════════════════════
     REGISTRO
     ══════════════════════════════════════════════════════════ */

  /* A validação é DURA e acontece na carga da página, não na
     montagem. Uma peça malformada deve estourar enquanto você está
     olhando para o console — não três telas depois, na frente do
     hunter. */
  registrar(peca) {
    if (!peca || typeof peca !== 'object') {
      console.error('[Pecas] registrar() recebeu algo que não é uma peça:', peca);
      return false;
    }

    for (const [campo, tipo] of Object.entries(this._OBRIGATORIOS)) {
      if (typeof peca[campo] !== tipo) {
        console.error(
          `[Pecas] peça "${peca.id || '(sem id)'}" rejeitada: ` +
          `falta "${campo}" (esperado ${tipo}, veio ${typeof peca[campo]}).`
        );
        return false;
      }
    }

    if (this._registro[peca.id]) {
      console.warn(`[Pecas] "${peca.id}" já existia e foi substituída.`);
    }

    /* `padrao: true` é a rede de segurança da família: é ela que
       entra quando a peça escolhida falha. Duas padrão na mesma
       família é ambiguidade — a primeira vence e a segunda avisa. */
    if (peca.padrao) {
      const jaTem = this.padraoDa(peca.familia);
      if (jaTem && jaTem.id !== peca.id) {
        console.warn(
          `[Pecas] a família "${peca.familia}" já tinha padrão ` +
          `("${jaTem.id}"); "${peca.id}" NÃO virou padrão.`
        );
        peca = Object.assign({}, peca, { padrao: false });
      }
    }

    this._registro[peca.id] = Object.assign({
      precisa: [],
      opcoes:  {},
      padrao:  false,
    }, peca);

    return true;
  },

  existe(id)   { return !!this._registro[id]; },
  obter(id)    { return this._registro[id] || null; },
  familias()   { return [...new Set(Object.values(this._registro).map(p => p.familia))]; },
  daFamilia(f) { return Object.values(this._registro).filter(p => p.familia === f); },
  padraoDa(f)  { return this.daFamilia(f).find(p => p.padrao) || null; },

  /* ══════════════════════════════════════════════════════════
     A CAIXA DE FERRAMENTAS DO HOSPEDEIRO

     Tudo o que a peça pode fazer contra o mundo lá fora passa por
     aqui — e por isso tudo pode ser desfeito.
     ══════════════════════════════════════════════════════════ */

  _criarHost(inst, opts) {
    const acoes  = (opts && opts.acoes)  || {};
    const opcoes = (opts && opts.opcoes) || {};

    return {
      el: inst.el,

      /* Timers rastreados. A peça nunca vê o número devolvido por
         setInterval/setTimeout — logo, nunca pode perdê-lo. */
      intervalo(fn, ms) {
        const h = setInterval(fn, ms);
        inst.intervalos.push(h);
        return h;
      },
      espera(fn, ms) {
        const h = setTimeout(fn, ms);
        inst.esperas.push(h);
        return h;
      },

      /* Laço de animação com TRÊS freios: o desmonte explícito, o
         próprio DOM (se o contêiner sair da página sem ninguém
         avisar, o laço percebe e para) e o retorno da função.

         `return false` encerra o laço. Nem toda animação é eterna:
         a contagem crescente dos cristais tem fim, e sem uma saída
         ela continuaria pedindo quadros para sempre só para
         recalcular um número que já chegou. */
      quadro(fn) {
        /* Cada laço ocupa UMA vaga fixa, que é sobrescrita a cada
           quadro. A versão ingênua empilhava um número por quadro:
           depois de um minuto de partículas, `diagnostico()`
           acusaria milhares de "quadros vivos" que já dispararam.
           Um detector de vazamento que inventa vazamento é pior do
           que não ter detector. */
        const vaga = inst.quadros.length;
        inst.quadros.push(0);
        const passo = (t) => {
          if (inst.morta || !inst.el.isConnected) { inst.quadros[vaga] = 0; return; }
          if (fn(t) === false)                    { inst.quadros[vaga] = 0; return; }
          inst.quadros[vaga] = requestAnimationFrame(passo);
        };
        inst.quadros[vaga] = requestAnimationFrame(passo);
      },

      /* Ouvintes rastreados. Importa sobretudo para `window` e
         `document`: os que ficam DENTRO do contêiner morrem junto
         com ele, mas um `resize` pendurado em window sobrevive à
         troca de página — e o dashboard.js já pendura um (linha 195). */
      ouvir(alvo, evento, fn, opcoesEvt) {
        alvo.addEventListener(evento, fn, opcoesEvt);
        inst.ouvintes.push([alvo, evento, fn, opcoesEvt]);
      },

      /* A inversão de dependência, na prática: a peça pede, o
         hospedeiro decide. Nada de getElementById('dash-...'). */
      acao(nome, dados) {
        const fn = acoes[nome];
        if (typeof fn !== 'function') {
          console.warn(
            `[Pecas] "${inst.peca.id}" pediu a ação "${nome}", ` +
            `que este hospedeiro não oferece.`
          );
          return undefined;
        }
        return fn(dados, inst);
      },
      temAcao(nome) { return typeof acoes[nome] === 'function'; },

      opcao(nome, padrao) {
        return (nome in opcoes) ? opcoes[nome] : padrao;
      },

      /* Sufixo único por instância, para quando a peça REALMENTE
         precisar de um id (gradiente de SVG, `for` de label...).
         Mesma lição do `_idsUnicos` do gemas.js. */
      selo: inst.selo,
      id(sufixo) { return `${inst.selo}-${sufixo}`; },
    };
  },

  /* ══════════════════════════════════════════════════════════
     MONTAGEM
     ══════════════════════════════════════════════════════════ */

  /* Devolve a instância, ou null se nem a peça nem o padrão da
     família conseguiram subir. Nunca lança: uma peça quebrada não
     pode derrubar a tela que a hospeda. */
  montar(el, idPeca, dados, opts) {
    if (!el) { console.error('[Pecas] montar() sem contêiner.'); return null; }
    this._coletar();

    /* Trocar de peça no mesmo lugar desmonta a anterior primeiro.
       Sem isto, os timers da antiga sobreviveriam à troca — que é
       exatamente o vazamento que este arquivo existe para evitar. */
    this.desmontar(el);

    let peca = this.obter(idPeca);
    let motivo = null;

    if (!peca) {
      motivo = `peça "${idPeca}" não está registrada`;
      peca = this.padraoDa((opts && opts.familia) || el.dataset.slot || '');
    }

    if (!peca) {
      console.error(`[Pecas] ${motivo}, e não há peça padrão para cair.`);
      return null;
    }
    if (motivo) console.warn(`[Pecas] ${motivo}; usando o padrão "${peca.id}".`);

    const inst = this._instanciar(el, peca, dados, opts);
    if (inst) return inst;

    /* A peça escolhida estourou. Cai para a padrão da família —
       desde que não seja ela mesma, para não entrar em laço. */
    const padrao = this.padraoDa(peca.familia);
    if (padrao && padrao.id !== peca.id) {
      console.warn(`[Pecas] "${peca.id}" falhou ao montar; caindo para "${padrao.id}".`);
      return this._instanciar(el, padrao, dados, opts);
    }

    console.error(`[Pecas] "${peca.id}" falhou e era o próprio padrão. Contêiner vazio.`);
    return null;
  },

  _instanciar(el, peca, dados, opts) {
    const inst = {
      el, peca, dados,
      opts: opts || {},              // guardado para a remontagem de atualizar()
      selo: `pc${++this._seq}`,
      intervalos: [], esperas: [], quadros: [], ouvintes: [],
      morta: false,
    };
    inst.host = this._criarHost(inst, opts);

    /* `precisa` é declaração, não exigência: falta de dado vira
       aviso, não tela em branco. O hospedeiro pode legitimamente
       ainda não ter carregado as relíquias. */
    const faltando = (peca.precisa || []).filter(k => !dados || !(k in dados));
    if (faltando.length) {
      console.warn(`[Pecas] "${peca.id}" pediu [${faltando.join(', ')}] e não recebeu.`);
    }

    try {
      peca.montar(el, dados || {}, inst.host);
    } catch (e) {
      console.error(`[Pecas] "${peca.id}" estourou em montar():`, e);
      this._limpar(inst);
      el.innerHTML = '';
      return null;
    }

    el.__peca = inst;
    el.dataset.peca = peca.id;
    this._vivas.push(inst);
    return inst;
  },

  /* ══════════════════════════════════════════════════════════
     REPINTURA

     Dado novo não é peça nova. O `atualizarNumeros()` do Dashboard
     rechama `renderPersonagem()` a cada ação do hunter — se cada
     chamada dessas remontasse a peça, o cartão piscaria inteiro a
     cada missão iniciada. Foi exatamente o incômodo que o
     `_reconciliar()` do dashboard.js e o `repintar()` do
     MissaoCard já existem para resolver.

     A peça implementa `atualizar()` se souber repintar sem apagar.
     Se não souber, remontamos — correto, só que piscando.
     ══════════════════════════════════════════════════════════ */

  atualizar(el, dados) {
    const inst = el && el.__peca;
    if (!inst || inst.morta) return false;

    if (typeof inst.peca.atualizar !== 'function') {
      this.montar(el, inst.peca.id, dados, inst.opts);
      return true;
    }
    inst.dados = dados;
    let r;
    try {
      r = inst.peca.atualizar(el, dados || {}, inst.host);
    } catch (e) {
      console.error(`[Pecas] "${inst.peca.id}" estourou em atualizar():`, e);
      return false;
    }

    /* `return false` de dentro de atualizar() significa "não dá para
       repintar isto, remonte". Nem toda mudança de dado cabe numa
       repintura: trocar de rank muda a cor do banner inteiro, trocar
       de avatar muda o hexágono. A peça é quem sabe onde fica essa
       fronteira — e é melhor ela pedir a remontagem do que fingir
       que repintou e deixar metade da tela desatualizada. */
    if (r === false) {
      this.montar(el, inst.peca.id, dados, inst.opts);
    }
    return true;
  },

  /* ══════════════════════════════════════════════════════════
     DESMONTE
     ══════════════════════════════════════════════════════════ */

  desmontar(el) {
    const inst = el && el.__peca;
    if (!inst || inst.morta) return false;

    /* `destruir()` é OPCIONAL de propósito. Timers e ouvintes já
       são recolhidos pelo registro; a peça só precisa implementá-lo
       se tiver algo que o registro não conhece — um observer, uma
       conexão, um nó que ela mesma pendurou no `body`. */
    if (typeof inst.peca.destruir === 'function') {
      try { inst.peca.destruir(el, inst.host); }
      catch (e) { console.error(`[Pecas] "${inst.peca.id}" estourou em destruir():`, e); }
    }

    this._limpar(inst);
    el.innerHTML = '';
    delete el.__peca;
    delete el.dataset.peca;
    return true;
  },

  /* A limpeza roda MESMO se destruir() estourou — está fora do try
     de propósito. Uma peça com defeito não pode levar o app junto. */
  _limpar(inst) {
    inst.morta = true;
    inst.intervalos.forEach(clearInterval);
    inst.esperas.forEach(clearTimeout);
    inst.quadros.forEach(cancelAnimationFrame);
    inst.ouvintes.forEach(([alvo, ev, fn, o]) => {
      try { alvo.removeEventListener(ev, fn, o); } catch (_) {}
    });
    inst.intervalos = []; inst.esperas = []; inst.quadros = []; inst.ouvintes = [];
    this._vivas = this._vivas.filter(i => i !== inst);
  },

  desmontarTodas() {
    [...this._vivas].forEach(i => this.desmontar(i.el));
  },

  /* ── A COLETA DOS ÓRFÃOS ──────────────────────────────────

     Um contêiner pode sumir do DOM sem ninguém chamar desmontar():
     basta alguém fazer `innerHTML = ''` no pai. Acontece neste
     projeto.

     O laço de quadros sobrevive a isso sozinho (ele testa
     `isConnected`), mas o OUVINTE não: um `resize` pendurado em
     `window` — e a Janela de Status pendura um — continua vivo
     apontando para um elemento que ninguém mais vê. A cada
     navegação, mais um.

     Por isso a coleta roda antes de montar e ao diagnosticar.

     REGRA QUE ISTO IMPÕE AO HOSPEDEIRO: quem tirar o contêiner do
     documento e quiser devolvê-lo depois precisa REMONTAR. Não
     existe peça hibernando fora da página. */
  _coletar() {
    [...this._vivas]
      .filter(i => !i.el || !i.el.isConnected)
      .forEach(i => this.desmontar(i.el));
  },

  /* ══════════════════════════════════════════════════════════
     DIAGNÓSTICO

     O teste de contrato: monta, desmonta, e confere que sobrou
     ZERO. É o teste que teria pego o vazamento da V4 antes do
     Arquiteto ver.
     ══════════════════════════════════════════════════════════ */

  diagnostico() {
    this._coletar();
    return {
      registradas: Object.keys(this._registro).length,
      vivas: this._vivas.length,
      intervalos: this._vivas.reduce((n, i) => n + i.intervalos.length, 0),
      esperas:    this._vivas.reduce((n, i) => n + i.esperas.length, 0),
      // só as vagas OCUPADAS: um laço encerrado deixa a vaga em 0
      quadros:    this._vivas.reduce((n, i) => n + i.quadros.filter(Boolean).length, 0),
      ouvintes:   this._vivas.reduce((n, i) => n + i.ouvintes.length, 0),
      detalhe: this._vivas.map(i => ({
        peca: i.peca.id,
        intervalos: i.intervalos.length,
        ouvintes: i.ouvintes.length,
      })),
    };
  },
};

window.Pecas = Pecas;
