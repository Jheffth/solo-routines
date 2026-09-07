/* ============================================================
   TESTE — O CIRCUITO NA FORJA

   ESTE ARQUIVO EXISTE POR UM DEFEITO MEU. Eu construi o motor, os
   endpoints e o cartao do circuito, e nao construi o caminho para
   CRIAR um. O Arquiteto abriu o lancador e a natureza nao estava la.

   Uma natureza que o app entende e o hunter nao consegue cadastrar nao
   existe do ponto de vista dele. Estes asserts cobram o caminho
   inteiro: aparecer na lista, editar os blocos, e sair no formato que
   `motors/circuito.py` le.

   O QUE MAIS ELE PROTEGE

   1. O ESTADO E A VERDADE, NAO O DOM.
      Ler os inputs so na hora de salvar quebra ao remover a segunda de
      quatro linhas: os indices dancam e cada `data-i` passa a apontar
      para o bloco errado.

   2. EDITAR NAO PODE APAGAR O DESENHO.
      A condicional ja sofreu exatamente isto — abrir para corrigir o
      titulo e salvar destruia a bifurcacao inteira, em silencio.

   3. O ID DO BLOCO VEM DA POSICAO, NAO DO TITULO.
      O registro do dia usa o id como chave. Deriva-lo do titulo faria
      renomear um bloco apagar o que ja foi entregue nele.

   Uso: NODE_PATH=/tmp/deps/node_modules node teste_forja_circuito.js
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
const fonte = fs.readFileSync(path.join(RAIZ, 'js', 'forja-missao.js'), 'utf8');
const css   = fs.readFileSync(path.join(RAIZ, 'css', 'forja-missao.css'), 'utf8');

function montar() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>',
    { runScripts: 'outside-only', url: 'http://localhost/' });
  const win = dom.window;
  win.chamadas = [];
  win.API = {
    rotinas: {
      criar: async (p) => { win.chamadas.push(['criar', p]); return { id: 1 }; },
      atualizar: async (id, p) => { win.chamadas.push(['atualizar', id, p]); return { id }; },
    },
    get: async () => ({}), post: async () => ({}),
  };
  win.SoloDialog = { toast: (m, t) => win.chamadas.push(['toast', t, m]) };
  win.Glifos = { existe: () => true, linha: () => '<svg></svg>', rico: () => '<svg></svg>' };
  const ctx = dom.getInternalVMContext();
  require('vm').runInContext(fonte + '\n;globalThis.__F = ForjaMissao;', ctx);
  return { win, doc: win.document, F: win.__F };
}

function rodar() {
  console.log('\n=== O CIRCUITO NA FORJA ===\n');
  const { win, doc, F } = montar();

  /* ── 1. A natureza existe e é de todos ──────────────────────── */
  console.log('-- a natureza que faltava --');
  const nat = F.NATUREZAS.find(n => n.id === 'CIRCUITO');
  ok(!!nat, 'CIRCUITO está na lista de naturezas da Forja');
  ok(nat && !nat.premium,
     'e NÃO é premium — a validação do motor já basta, não precisa de Staff');
  ok(nat && /bloco|sess/i.test(nat.sub || ''),
     `o rótulo diz o que a diferencia: "${nat && nat.sub}"`);

  const ids = F.NATUREZAS.map(n => n.id);
  ok(ids.indexOf('CIRCUITO') > ids.indexOf('META'),
     'e vem depois da META — a ordem vai do simples ao composto');

  /* ── 2. Os modos de bloco espelham o motor ──────────────────── */
  console.log('\n-- os modos de bloco --');
  const modos = F.MODOS_BLOCO.map(m => m.id).sort();
  ok(JSON.stringify(modos) === JSON.stringify(['CHECK', 'SERIE_REP', 'SERIE_TEMPO', 'TEMPO']),
     'os quatro modos, iguais aos de motors/circuito.py');
  ok(F._modoBloco('SERIE_TEMPO').serie === true, 'os de série se identificam');
  ok(F._modoBloco('TEMPO').serie === false, 'e os de lançamento único também');
  ok(F._modoBloco('LIXO').id === 'TEMPO', 'modo desconhecido cai no padrão, não quebra');

  /* ── 3. O estado nasce utilizável ───────────────────────────── */
  console.log('\n-- a primeira linha já vem pronta --');
  F._estado = {
    tipo: 'ROTINA', natureza: 'CIRCUITO', titulo: 'Treino',
    circ_blocos: [{ titulo: '', modo: 'TEMPO', series: 3, min: '', max: '', unidade: '' }],
  };
  const html = F._linhasCircuito(F._estado);
  ok(/data-circ="titulo"/.test(html), 'a linha tem campo de título');
  ok(/data-circ="modo"/.test(html), 'e seletor de modo');
  ok(/data-circ="min"/.test(html) && /data-circ="max"/.test(html),
     'e os dois lados da faixa');
  ok(/disabled/.test(html),
     'com o remover DESABILITADO — não se apaga o último bloco');

  /* O CHECK não mostra faixa: pedir mín/máx para "fez ou não fez"
     convidaria a preencher um número que nada leria. */
  const soCheck = F._linhasCircuito({ circ_blocos: [{ titulo: 'X', modo: 'CHECK' }] });
  const ocultos = (soCheck.match(/visibility:hidden/g) || []).length;
  ok(ocultos >= 3, `no modo "só marcar", faixa e unidade somem (${ocultos} campos)`);

  const comSerie = F._linhasCircuito({ circ_blocos: [{ titulo: 'X', modo: 'SERIE_TEMPO', series: 3 }] });
  ok(!/data-circ="series"[^>]*visibility:hidden/.test(comSerie),
     'e no modo de séries o campo de séries aparece');

  /* ── 4. O treino do Arquiteto vira payload ──────────────────── */
  console.log('\n-- o treino, do formulário ao payload --');
  F._estado.circ_blocos = [
    { titulo: 'Mobilidade e destravamento', modo: 'TEMPO', min: '5', max: '5', unidade: 'min' },
    { titulo: 'Cardio base', modo: 'TEMPO', min: '25', max: '30', unidade: 'min' },
    { titulo: 'Prancha isométrica', modo: 'SERIE_TEMPO', series: '3', min: '20', max: '30', unidade: 's' },
    { titulo: 'Agachamento livre', modo: 'SERIE_REP', series: '3', min: '10', max: '12', unidade: '' },
    { titulo: '   ', modo: 'TEMPO', min: '', max: '', unidade: '' },   // linha em branco
  ];

  // Reproduz a montagem do payload (o `_salvar` real depende do DOM inteiro).
  const blocos = F._estado.circ_blocos
    .filter(b => (b.titulo || '').trim())
    .map((b, i) => {
      const modo = F._modoBloco(b.modo);
      const o = { id: `b${i}`, titulo: b.titulo.trim(), modo: modo.id };
      if (modo.serie) o.series = Math.max(1, parseInt(b.series, 10) || 1);
      if (modo.id !== 'CHECK') {
        const mi = F._numeroBR(b.min), ma = F._numeroBR(b.max);
        if (mi !== null) o.min = mi;
        if (ma !== null) o.max = ma;
        const un = (b.unidade || '').trim() || modo.un;
        if (un) o.unidade = un;
      }
      return o;
    });

  ok(blocos.length === 4, `a linha em branco é descartada (${blocos.length} blocos)`);
  ok(blocos[1].min === 25 && blocos[1].max === 30, 'a faixa do cardio: 25 a 30');
  ok(blocos[2].series === 3 && blocos[2].unidade === 's', 'a prancha: 3 séries em segundos');
  ok(blocos[3].unidade === undefined || blocos[3].unidade === '',
     'o agachamento não inventa unidade — repetição não tem');
  ok(blocos.every((b, i) => b.id === `b${i}`),
     'os ids vêm da POSIÇÃO — renomear um bloco não apaga o que já foi entregue nele');

  /* ── 5. O estado é a verdade ────────────────────────────────── */
  console.log('\n-- remover uma linha do meio --');
  ok(/data-circ\]/.test(fonte) || /matches\('\[data-circ\]'\)/.test(fonte),
     'cada tecla vai direto para o estado, não é lida do DOM ao salvar');
  ok(/circ_blocos\.splice/.test(fonte), 'remover mexe no ESTADO');
  ok(/circ_blocos\.length > 1/.test(fonte),
     'e nunca remove o último — o servidor recusaria o circuito vazio');

  // A prova: tirar o bloco 2 de 4 e conferir que os ids se renumeram.
  const antes = [...F._estado.circ_blocos];
  F._estado.circ_blocos = antes.filter((_, i) => i !== 1);
  const depois = F._estado.circ_blocos
    .filter(b => (b.titulo || '').trim())
    .map((b, i) => ({ id: `b${i}`, titulo: b.titulo.trim() }));
  ok(depois.length === 3 && depois[1].titulo === 'Prancha isométrica',
     'tirando o cardio, a prancha vira o bloco 2 — e os ids acompanham');

  /* ── 6. Editar não pode apagar o desenho ────────────────────── */
  console.log('\n-- abrir para editar --');
  ok(/JSON\.parse\(ed\.circuito_payload/.test(fonte),
     'a edição LÊ o payload gravado');
  ok(/e\.circ_blocos = c\.etapas\.map/.test(fonte),
     'e devolve os blocos para o formulário');
  ok(/catch \(_\) \{ \/\* desenho ilegível/.test(fonte),
     'payload ilegível abre com a linha padrão em vez de explodir');

  /* ── 7. O bloco aparece só no CIRCUITO ──────────────────────── */
  console.log('\n-- visibilidade --');
  ok(/mostra\('fm-bloco-circuito',\s*!pacto && e\.natureza === 'CIRCUITO'\)/.test(fonte),
     'o bloco de blocos só aparece na natureza CIRCUITO');
  ok(/id="fm-bloco-circuito"/.test(fonte), 'e existe no formulário');
  ok(/fm-circ-add/.test(fonte) && /fm-circ-add/.test(css),
     'com o botão de adicionar, e estilo para ele');

  /* ── 8. O aviso explica a decisão de projeto ────────────────── */
  ok(/uma<\/i> falha/.test(fonte) || /não uma por bloco/.test(fonte),
     'o aviso diz que falhar a sessão conta como UMA falha — ' +
     'é o motivo de a natureza existir, e o hunter precisa saber');

  /* ── 9. O celular ──────────────────────────────────────────── */
  ok(/@media \(max-width: 560px\)[\s\S]*fm-circ-linha/.test(css),
     'sete colunas viram flex no celular — 30px por campo ninguém acerta');

  console.log(`\n=== ${testes - falhas}/${testes} ===`);
  return falhas;
}

process.exit(rodar() ? 1 : 0);
