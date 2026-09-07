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

  /* ── 1. A escada ────────────────────────────────────────────── */
  console.log('-- a escada, o efeito deste card --');
  const degraus = card.querySelectorAll('.mc-circ-degrau');
  ok(degraus.length === 4, `quatro degraus, um por bloco (${degraus.length})`);
  ok(degraus[0].classList.contains('mc-circ-ok'), 'mobilidade entregue: verde');
  ok(degraus[1].classList.contains('mc-circ-parcial'),
     'cardio curto: ÂMBAR — nem verde nem apagado');
  ok(!degraus[2].classList.contains('mc-circ-ok') &&
     !degraus[2].classList.contains('mc-circ-parcial'),
     'prancha em aberto: apagado');
  ok(/2 de 4/.test(card.textContent), 'e a conta em texto: 2 de 4');
  ok(!!card.querySelector('.mc-circ-selo-parcial'),
     'a sessão se declara parcial');

  /* O selo e o degrau nao podem dividir a mesma classe: um e um
     retangulo de 5px, o outro e uma etiqueta de texto. */
  ok(card.querySelectorAll('.mc-circ-parcial').length === 1,
     'e "parcial" de degrau não colide com o selo (nomes diferentes)');

  /* ── 2. Os blocos ───────────────────────────────────────────── */
  console.log('\n-- os blocos --');
  const blocos = card.querySelectorAll('.mc-circ-bloco');
  ok(blocos.length === 4, 'quatro blocos listados');
  ok(/25–30 min/.test(card.textContent), 'a faixa do cardio aparece: 25–30 min');
  ok(/3 × 20–30 s/.test(card.textContent), 'e a da prancha, com séries');
  ok(/3 × 10–12/.test(card.textContent), 'e a do agachamento, sem unidade');
  ok(/5 min/.test(card.textContent) && !/5–5/.test(card.textContent),
     'faixa de valor único não vira "5–5"');
  ok(/Giro de braços/.test(card.textContent),
     'a nota do bloco aparece — é onde mora a instrução');

  ok(blocos[1].classList.contains('mc-circ-b-parcial'),
     'o bloco curto se destaca dos demais');
  const val = blocos[1].querySelector('.mc-circ-valor');
  ok(val && val.classList.contains('curta'),
     'e o valor entregue (22) é marcado como curto');

  /* ── 3. As séries ───────────────────────────────────────────── */
  console.log('\n-- as séries --');
  const fichas = blocos[2].querySelectorAll('.mc-circ-serie');
  ok(fichas.length === 2, 'duas séries lançadas viram duas fichas');
  ok(fichas[1].classList.contains('curta'),
     'a de 18s (piso 20) sai marcada — a média não esconde a série fraca');
  ok(/Série 3/.test(blocos[2].textContent),
     'e o botão pede a PRÓXIMA série pelo número certo');
  ok(!!blocos[2].querySelector('.mc-circ-input'),
     'com campo para o valor dela');
  ok(!blocos[3].querySelector('.mc-circ-serie'),
     'bloco não começado não mostra ficha nenhuma');

  /* ── 4. A trava do Concluir ─────────────────────────────────── */
  console.log('\n-- o botão que não aparece --');
  ok(!card.querySelector('[data-mc-acao="concluir"]'),
     'NÃO há botão Concluir com dois blocos em aberto');
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
  ok(/border-radius:\s*0 \.35rem \.35rem 0/.test(css),
     'e a borda de um lado só não arredonda os quatro cantos');
  ok(/_seloFaltaCircuito/.test(fonte) && /_ehCircuito\(m\) && !m\.circuito\.completo/.test(fonte),
     'a trava do Concluir lê `completo` do SERVIDOR, não recontando aqui');
  ok(/data-mc-circ-input="\$\{chave\}\|/.test(fonte),
     'o input é endereçado por missão e bloco');

  console.log(`\n=== ${testes - falhas}/${testes} ===`);
  return falhas;
}

rodarAsync().then(f => process.exit(f ? 1 : 0));
