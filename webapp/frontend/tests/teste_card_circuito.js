/* ============================================================
   TESTE — O CARD DO CIRCUITO

   O par deste arquivo no backend e `test_circuito.py`, que prova as
   regras. Aqui provamos o CARTAO, e as tres coisas que ele pode fazer
   de errado:

   1. OFERECER O BOTAO CONCLUIR COM BLOCO EM ABERTO.
      E o acidente que ja custou caro na META: o Arquiteto digitou 38,
      clicou em Concluir em vez de Somar, e a missao fechou zerada. O
      circuito herda a mesma protecao — no lugar do botao, um selo
      dizendo o que falta.

   2. CONFUNDIR "ABAIXO DO PISO" COM "EM ABERTO".
      Sao estados diferentes e o desenho tem de separa-los: ambar para
      quem entregou menos que o combinado, apagado para quem nao
      entregou. Trata-los igual esconderia a decisao do Arquiteto de
      aceitar a entrega curta.

   3. ADIVINHAR O ESTADO EM VEZ DE ECOAR O SERVIDOR.
      O que fecha um bloco de series e a contagem contra o combinado, e
      o combinado mora no servidor. Adivinhar aqui faria o card declarar
      "feito" um bloco que o backend considera aberto.

   Uso: NODE_PATH=/tmp/deps/node_modules node teste_card_circuito.js
   ============================================================ */
const fs   = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

let falhas = 0, testes = 0;
const ok = (cond, msg) => {
  testes++;
  if (!cond) falhas++;
  console.log((cond ? '  [ok]  ' : '  [XX]  ') + msg);
};

const RAIZ  = path.join(__dirname, '..');
const fonte = fs.readFileSync(path.join(RAIZ, 'js', 'missao-card.js'), 'utf8');
const css   = fs.readFileSync(path.join(RAIZ, 'css', 'missao-card.css'), 'utf8');

/* O treino do Arquiteto, no meio da sessao: mobilidade feita, cardio
   entregue CURTO (22 numa faixa de 25-30), prancha em 2 de 3 series,
   agachamento nem comecado. */
function missao(over = {}) {
  return Object.assign({
    // `rotina_id` e nao so `id`: `_rota()` le rotina_id quando a origem e
    // 'rotina'. O fixture sem ele fazia a acao abortar com "nao consegui
    // identificar a missao" — e o teste acusou certo.
    id: 7, rotina_id: 7, uid: 'r7', origem: 'rotina',
    titulo: 'Treino de adaptação — fase 1',
    status: 'ATIVA', status_hoje: 'ATIVA', categoria: 'Saude',
    prioridade: 'ALTA', dificuldade: 'NORMAL',
    circuito: {
      total: 4, fechados: 2, faltam: 2, parciais: 1,
      completo: false, parcial: true, pct: 50,
      blocos: [
        { id: 'mob', titulo: 'Mobilidade e destravamento', modo: 'TEMPO',
          min: 5, max: 5, unidade: 'min', series: null,
          nota: 'Giro de braços, rotações de tronco',
          valor: 5, valores: [], feito: true, abaixo: false, restam_series: null },
        { id: 'car', titulo: 'Cardio base', modo: 'TEMPO',
          min: 25, max: 30, unidade: 'min', series: null, nota: null,
          valor: 22, valores: [], feito: true, abaixo: true, restam_series: null },
        { id: 'pra', titulo: 'Prancha isométrica', modo: 'SERIE_TEMPO',
          min: 20, max: 30, unidade: 's', series: 3, nota: null,
          valor: null, valores: [25, 18], feito: false, abaixo: false, restam_series: 1 },
        { id: 'agc', titulo: 'Agachamento livre', modo: 'SERIE_REP',
          min: 10, max: 12, unidade: '', series: 3, nota: null,
          valor: null, valores: [], feito: false, abaixo: false, restam_series: 3 },
      ],
    },
  }, over);
}

function montar() {
  const dom = new JSDOM('<!doctype html><html><body><div id="lista"></div></body></html>',
    { runScripts: 'outside-only', url: 'http://localhost/' });
  const win = dom.window;
  win.chamadas = [];
  win.API = { post: async (u, b) => { win.chamadas.push([u, b]); return win.__resp || { ok: true }; } };
  win.SoloDialog = { toast: (m, t) => win.chamadas.push(['toast', t, m]) };
  win.Glifos = { existe: () => true, linha: () => '<svg></svg>', rico: () => '<svg></svg>' };
  const ctx = dom.getInternalVMContext();
  require('vm').runInContext(fonte + '\n;globalThis.__MC = MissaoCard;', ctx);
  return { win, doc: win.document, MC: win.__MC };
}

function rodar() {
  console.log('\n=== O CARD DO CIRCUITO ===\n');
  const { win, doc, MC } = montar();
  const m = missao();

  const html = MC.html(m, { compacto: true });
  doc.getElementById('lista').innerHTML = html;
  const card = doc.querySelector('[data-mc-card]');

  /* ── 1. É UM GRUPO, e conta como UM cartão ──────────────────── */
  console.log('-- o cartao mestre e as filhas --');
  const grupo = card;
  ok(grupo.classList.contains('mc-grupo-circ'),
     'o circuito vira um GRUPO, nao um cartao grosso');
  ok(grupo.dataset.mcCard === 'r7',
     '`data-mc-card` mora no INVOLUCRO — e ele que a lista reconcilia');
  ok(!!grupo.dataset.mcSig, 'com a assinatura junto, para a repintura comparar');
  ok(doc.querySelectorAll('[data-mc-card]').length === 1,
     'UM dono da chave na tela — as filhas nao viram missoes separadas');

  const mestre = grupo.querySelector('[data-mc-mestre]');
  ok(!!mestre, 'o cartao mestre esta dentro do grupo');
  ok(!mestre.hasAttribute('data-mc-card'),
     'e NAO carrega a chave — dois donos quebrariam repintar()');
  ok(mestre.classList.contains('mc'),
     'o mestre continua sendo um cartao de verdade, com o cromo de sempre');

  /* ── 2. O mestre ficou magro ────────────────────────────────── */
  console.log('\n-- o mestre so tem o veredito --');
  const resumo = mestre.querySelector('.mc-circ-resumo');
  ok(!!resumo, 'ele mostra a escada e a conta');
  ok(/2 de 4 blocos/.test(mestre.textContent), 'em texto: "2 de 4 blocos"');
  ok(!mestre.querySelector('.mc-cf'),
     'e NENHUM bloco dentro dele — era isso o "card grosso cheio de coisas"');
  ok(!mestre.querySelector('.mc-cf-input'),
     'nem campo de lancamento: o mestre nao coleta, ele resume');

  const degraus = resumo.querySelectorAll('.mc-circ-degrau');
  ok(degraus.length === 4, `quatro degraus, um por bloco (${degraus.length})`);
  ok(degraus[0].classList.contains('mc-circ-ok'), 'entregue: aceso');
  ok(degraus[1].classList.contains('mc-circ-parcial'),
     'entregue curto: AMBAR — nem aceso nem apagado');
  ok(!degraus[2].classList.contains('mc-circ-ok'), 'em aberto: apagado');

  /* ── 3. As filhas, e o elo ──────────────────────────────────── */
  console.log('\n-- as filhas e o cordao --');
  const filhas = grupo.querySelectorAll('.mc-cf');
  ok(filhas.length === 4, 'quatro cartoes subordinados');
  ok([...filhas].every(f => f.tagName === 'ARTICLE'),
     'cada bloco e um <article> proprio, nao uma linha de lista');
  ok([...filhas].every(f => f.querySelector('.mc-cf-no')),
     'cada filha tem seu NO no cordao — nenhuma flutua solta');
  ok([...filhas].every(f => f.querySelector('.mc-cf-fio')),
     'e o fio horizontal que a amarra ao cordao');
  ok(!!grupo.querySelector('.mc-circ-trilho .mc-circ-pulso'),
     'o cordao desce do mestre com o pulso — a animacao propria da natureza');

  ok(filhas[0].classList.contains('mc-cf-ok'), 'a 1a esta entregue');
  ok(filhas[1].classList.contains('mc-cf-parcial'), 'a 2a, entregue curta');
  ok(filhas[2].classList.contains('mc-cf-alvo'),
     'a 3a e o ALVO — o primeiro bloco em aberto');
  ok(!filhas[3].classList.contains('mc-cf-alvo'),
     'e SO ela respira: destacar todos os abertos seria nao destacar nenhum');

  ok(/25–30 min/.test(filhas[1].textContent), 'a faixa aparece na filha');
  /* "22min", sem espaco: a unidade e um <span> menor colado ao numero,
     e nao um sufixo de texto. E o que faz "22" ser lido como grandeza e
     "min" como legenda, em vez de uma frase. */
  ok(/22\s*min/.test(filhas[1].textContent), 'com o que foi entregue ao lado');
  ok(!!filhas[1].querySelector('.mc-cf-valor span'),
     'e a unidade e um span proprio — grandeza e legenda tem pesos diferentes');
  ok(filhas[1].querySelector('.mc-cf-valor.curta'),
     'e o valor curto e marcado');
  ok(/Giro de bra/.test(filhas[0].textContent),
     'a nota do bloco vive na filha — e onde a instrucao pertence');

  /* ── 3b. O QUE O ARQUITETO DISSE QUE FALTAVA ─────────────────
     "os cards filhos sao pobres, nao sao modernos, medioceres. Nao tem
      efeitos, nao tem animacoes, nao tem informacoes, nao tem svg."
     Cada assert abaixo cobra um item dessa lista. */
  console.log('\n-- glifo, medida e efeito --');
  ok([...filhas].every(f => f.querySelector('.mc-cf-ico svg')),
     'SVG: cada filha tem o glifo do seu modo');
  const dTempo = filhas[0].querySelector('.mc-cf-ico svg').innerHTML;
  const dSerie = filhas[2].querySelector('.mc-cf-ico svg').innerHTML;
  ok(dTempo !== dSerie,
     'e o glifo de TEMPO e diferente do de SERIE — o icone separa as ' +
     'duas leituras antes de qualquer numero');

  ok(!!filhas[0].querySelector('.mc-cf-no b'),
     'o no virou hexagono NUMERADO — o chip "1/4" sumiu do corpo');
  ok(filhas[3].querySelector('.mc-cf-no b').textContent === '4',
     'com o numero do bloco dentro');

  /* A FAIXA DESENHADA. Antes eram dois numeros soltos que o hunter
     comparava de cabeca; agora a janela e uma regiao e o entregue e um
     marcador — ficar aquem virou coisa que se ve. */
  const trilho = filhas[1].querySelector('.mc-cf-trilho');
  ok(!!trilho, 'INFORMACAO: a faixa virou trilho');
  const jan = trilho.querySelector('.mc-cf-janela');
  const mrc = trilho.querySelector('.mc-cf-marca');
  ok(!!jan && !!mrc, 'com a janela combinada e o marcador do entregue');
  ok(mrc.classList.contains('curta'),
     'e o marcador de 22 numa faixa de 25-30 sai em ambar');
  const posJ = parseFloat(/left:([\d.]+)%/.exec(jan.getAttribute('style'))[1]);
  const posM = parseFloat(/left:([\d.]+)%/.exec(mrc.getAttribute('style'))[1]);
  ok(posM < posJ,
     `o marcador para ANTES da janela (${posM.toFixed(1)}% < ${posJ.toFixed(1)}%) — ` +
     'a falta e visivel, nao calculada');

  /* Faixa de valor unico daria janela de largura ZERO. */
  const j0 = filhas[0].querySelector('.mc-cf-janela').getAttribute('style');
  const a0 = parseFloat(/left:([\d.]+)%/.exec(j0)[1]);
  const b0 = 100 - parseFloat(/right:([\d.]+)%/.exec(j0)[1]);
  ok(b0 - a0 >= 3, `faixa de 5 a 5 ganha largura minima (${(b0-a0).toFixed(1)}%) — ` +
     'alvo exato continua sendo alvo');

  /* OS SLOTS. A caixa vazia diz quantas faltam sem uma palavra. */
  const slots = filhas[2].querySelectorAll('.mc-cf-slot');
  ok(slots.length === 3, `tres slots para 3 series, nao duas fichas (${slots.length})`);
  ok(slots[0].classList.contains('cheio') && slots[1].classList.contains('cheio'),
     'duas cheias');
  ok(slots[1].classList.contains('curta'), 'a de 18s (piso 20) marcada');
  ok(!slots[2].classList.contains('cheio'),
     'e a TERCEIRA vazia — e ela que diz que falta uma, sem texto');
  ok(filhas[3].querySelectorAll('.mc-cf-slot').length === 3,
     'bloco nem comecado ja mostra os tres lugares a preencher');
  ok(/Série 3/.test(filhas[2].textContent), 'e o botao pede a proxima');

  /* EFEITO: a varredura, so no alvo e so enquanto vive. */
  ok(!!filhas[2].querySelector('.mc-cf-luz'),
     'EFEITO: o alvo tem a varredura');
  ok(!filhas[0].querySelector('.mc-cf-luz') && !filhas[3].querySelector('.mc-cf-luz'),
     'e SO ele — varrer todas seria nao varrer nenhuma');
  ok(!!filhas[0].querySelector('.mc-cf-selo'),
     'o entregue ganha o selo de cumprido');
  ok(!filhas[2].querySelector('.mc-cf-selo'), 'o que esta em aberto, nao');

  /* ── 4. A trava do Concluir ─────────────────────────────────── */
  console.log('\n-- o botão que não aparece --');
  ok(!card.querySelector('[data-mc-acao="concluir"]'),
     'NÃO há botão Concluir com dois blocos em aberto');
  ok(!!card.querySelector('[data-mc-mestre] .mc-selo-etapa'),
     'e o selo do que falta fica NO MESTRE — e la que a conclusao mora');
  ok(/Faltam 2 blocos/.test(card.textContent),
     'no lugar dele, um selo dizendo o que falta');

  // Com tudo entregue, o botao volta.
  const m2 = missao();
  m2.circuito = { ...m2.circuito, fechados: 4, faltam: 0, completo: true };
  m2.circuito.blocos = m2.circuito.blocos.map(b => ({ ...b, feito: true }));
  doc.getElementById('lista').innerHTML = MC.html(m2, { compacto: true });
  ok(!!doc.querySelector('[data-mc-acao="concluir"]'),
     'com os quatro blocos fechados, o Concluir aparece');

  /* ── 5. As ações falam com o servidor ───────────────────────── */
  console.log('\n-- registrar e desfazer --');
  doc.getElementById('lista').innerHTML = html;
  MC.cachear([m], { modo: 'missao' });

  const btn = doc.querySelector('[data-mc-acao="circ-registrar"][data-mc-bloco="pra"]');
  ok(!!btn, 'o botão da prancha carrega o id do bloco');

  const campo = doc.querySelector('[data-mc-circ-input$="|pra"]');
  ok(!!campo, 'e o campo é endereçado por missão E bloco — dois circuitos ' +
              'na tela não disputam o mesmo input');

  return { win, doc, MC, m, btn, campo, card };
}

async function rodarAsync() {
  const { win, doc, MC, m, btn, campo } = rodar();

  campo.value = '24';
  win.__resp = {
    ok: true, status: 'ATIVA',
    circuito: { ...m.circuito, fechados: 3, faltam: 1 },
    circuito_cumprido: false,
  };
  await MC._circuito(m.uid, btn, true);
  const post = win.chamadas.find(c => c[0] === '/execucoes/circuito/registrar');
  ok(!!post, 'registrar chama o endpoint certo');
  ok(post && post[1].etapa_id === 'pra' && post[1].valor === 24,
     `mandando o bloco e o valor lido do campo (${post && post[1].valor})`);
  ok(post && post[1].rotina_id === 7 && !('tarefa_id' in post[1]),
     'com a origem certa — rotina, não missão geral');

  // Campo vazio nao vira requisicao.
  win.chamadas.length = 0;
  campo.value = '';
  await MC._circuito(m.uid, btn, true);
  ok(!win.chamadas.some(c => c[0] === '/execucoes/circuito/registrar'),
     'campo vazio NÃO manda requisição');
  ok(win.chamadas.some(c => c[0] === 'toast' && /valor/i.test(c[2])),
     'e avisa em vez de falhar em silêncio');

  /* A sessao parcial precisa ser dita.

     RECONSULTAR O DOM AQUI NÃO É ZELO, É NECESSIDADE: `repintar()` troca
     os nós do cartão, então `btn` e `campo` do começo do teste já estão
     órfãos. No app isso não é problema — os cliques são ouvidos por
     delegação em `[data-mc-acao]` —, mas um teste que guarda referências
     testa nós que ninguém mais vê. */
  console.log('\n-- a sessão parcial é notícia --');
  win.chamadas.length = 0;
  const btn2 = doc.querySelector('[data-mc-acao="circ-registrar"][data-mc-bloco="pra"]');
  const campo2 = doc.querySelector('[data-mc-circ-input$="|pra"]');
  ok(!!btn2 && !!campo2, 'depois da repintura, o bloco continua acionável');
  campo2.value = '25';
  win.__resp = {
    ok: true, status: 'CONCLUIDA',
    circuito: { ...m.circuito, fechados: 4, faltam: 0, completo: true, parcial: true },
    circuito_cumprido: true, parcial: true,
    resultado: { xp_ganho: 73, moedas_ganhas: 7 },
  };
  await MC._circuito(m.uid, btn2, true);
  const aviso = win.chamadas.find(c => c[0] === 'toast' && /parcial/i.test(c[2]));
  ok(!!aviso, 'ao fechar parcial, o card explica POR QUE o XP veio menor');
  ok(/XP reduzido/i.test(aviso[2]),
     'sem isso, o desconto pareceria defeito aos olhos do hunter');

  /* Desfazer. A sessão acabou de FECHAR na chamada acima — e é
     justamente aí que o desfazer mais importa: se o hunter errou o
     número da última série, esconder o botão tornaria o erro permanente
     pela tela. Este assert existe porque a primeira versão o escondia. */
  console.log('\n-- desfazer sobrevive à conclusão --');
  win.chamadas.length = 0;
  const btnU = doc.querySelector('[data-mc-acao="circ-desfazer"][data-mc-bloco="pra"]');
  ok(!!btnU, 'com a sessão fechada, o desfazer CONTINUA à mão');
  ok(!doc.querySelector('[data-mc-acao="circ-registrar"]'),
     'mas o registrar some — corrigir sim, acrescentar depois de fechado não');
  win.__resp = { ok: true, circuito: m.circuito, reabriu: true };
  await MC._circuito(m.uid, btnU, false);
  const del = win.chamadas.find(c => c[0] === '/execucoes/circuito/desfazer');
  ok(!!del && del[1].etapa_id === 'pra', 'desfazer age no bloco certo');
  ok(win.chamadas.some(c => c[0] === 'toast' && /reaberta/i.test(c[2])),
     'e avisa quando reabriu a sessão e devolveu o XP');

  /* ── 6. O código e o CSS ────────────────────────────────────── */
  console.log('\n-- o desenho pertence ao Sistema --');
  ok(/mc-circ-degrau/.test(css), 'a escada existe no CSS');

  /* O CORDAO E DESENHADO POR SEGMENTOS, um por filha. A primeira versao
     era uma linha unica com o trecho aceso em PORCENTAGEM — e as filhas
     nao tem a mesma altura: um bloco com tres series lancadas e o dobro
     de um em aberto. A porcentagem apontava para o meio do nada e a
     linha sobrava abaixo do ultimo no. */
  ok(/\.mc-cf::before/.test(css),
     'cada filha desenha o trecho de cordao que chega ao SEU no');
  ok(!/--circ-aceso/.test(css) && !/--circ-aceso/.test(fonte),
     'e a variavel de porcentagem foi ELIMINADA dos dois lados — ' +
     'dado morto no CSS envelhece sem ninguem notar');
  ok(/\.mc-cf-ok::before/.test(css) && /\.mc-cf-parcial::before/.test(css),
     'o trecho acende junto com o no que ele alimenta');

  /* O pulso e a respiracao sao enfeite; o cordao aceso e informacao. */
  const rm = css.slice(css.indexOf('prefers-reduced-motion', css.indexOf('mc-circ-pulso')));
  ok(/mc-circ-pulso\s*\{\s*animation: none/.test(rm),
     'com "reduzir movimento" o pulso para');
  ok(/mc-cf-alvo .mc-cf-no\s*\{\s*animation: none/.test(rm),
     'e o no do alvo tambem — mas o cordao aceso continua, porque e dado');
  ok(/_seloFaltaCircuito/.test(fonte) && /_ehCircuito\(m\) && !m\.circuito\.completo/.test(fonte),
     'a trava do Concluir lê `completo` do SERVIDOR, não recontando aqui');
  ok(/data-mc-circ-input="\$\{chave\}\|/.test(fonte),
     'o input é endereçado por missão e bloco');

  console.log(`\n=== ${testes - falhas}/${testes} ===`);
  return falhas;
}

rodarAsync().then(f => process.exit(f ? 1 : 0));
