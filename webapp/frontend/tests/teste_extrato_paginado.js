/* ============================================================
   TESTE — EXTRATO SOB DEMANDA

   O Arquiteto foi explícito:

       "eu quero ver meu extrato de missões, isso é uma escolha
        minha, então se há uma forma de exibir as ultimas e quando
        eu rolar ir aparecendo as outras faça isso.
        Quanto os scrolls eles estão funcionando bem como estão"

   Duas promessas, e este arquivo cobra as duas:

     1. NADA SE PERDE. Rolando até o fim, o hunter chega exatamente
        no mesmo extrato de antes — mesmos dias, mesmos cartões.
        Paginar é adiar, não esconder.

     2. A ROLAGEM NÃO FOI TOCADA. Nenhum `overflow`, `height` ou
        `maxHeight` é escrito pelo código de paginação, e o
        observador usa o container como `root` — ou seja, pega
        carona na rolagem que já existia.

   O QUE MAIS ESTE TESTE GUARDA

     · Penitências pinadas nunca são adiadas — dívida aberta
       aparece no primeiro quadro, sempre.
     · A sentinela sobrevive à repintura (`_reconciliar` apaga tudo
       que não é seção de dia — ela precisa ser poupada).
     · O texto da sentinela não contém "Carregando", senão
       `carregarExtrato` acha que a lista está vazia.
     · Trocar de filtro volta ao primeiro lote; um refresh comum
       NÃO volta (senão o chão sai do pé de quem rolou até março).

   Uso: NODE_PATH=/tmp/deps/node_modules node teste_extrato_paginado.js
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

const ARQ = path.join(__dirname, '..', 'js', 'pages', 'dashboard.js');
const fonte = fs.readFileSync(ARQ, 'utf8');

/* ── Dublê do IntersectionObserver ──────────────────────────────
   jsdom não implementa a API. O dublê guarda os alvos e expõe
   `disparar()` para simular "o hunter rolou até a sentinela".

   Ele é FIEL no ponto que importa: só entrega os alvos que estão
   sendo observados AGORA. Se o código sob teste esquecer de
   re-observar a sentinela depois de movê-la, o disparo não
   encontra nada — e o teste do lote 3 em diante falha, que é
   exatamente o defeito que queremos impedir. */
function instalarObservador(win) {
  const vivos = [];
  win.IntersectionObserver = class {
    constructor(cb, opts) { this.cb = cb; this.opts = opts || {}; this.alvos = new Set(); vivos.push(this); }
    observe(el)   { this.alvos.add(el); }
    unobserve(el) { this.alvos.delete(el); }
    disconnect()  { this.alvos.clear(); const i = vivos.indexOf(this); if (i >= 0) vivos.splice(i, 1); }
  };
  win.__rolarAteOFim = () => {
    let houve = false;
    // cópia: o callback repinta a lista e mexe no conjunto de alvos
    for (const obs of [...vivos]) {
      const alvos = [...obs.alvos];
      if (!alvos.length) continue;
      houve = true;
      obs.cb(alvos.map(el => ({ target: el, isIntersecting: true })), obs);
    }
    return houve;
  };
  return vivos;
}

/* Cartão de missão de mentira: HTML mínimo com as marcas que a
   reconciliação usa (`data-mc-card`, `data-mc-sig`). O teste é da
   paginação, não do desenho do cartão. */
function instalarMissaoCard(win) {
  win.MissaoCard = {
    montados: 0,
    cachear() {},
    montar() { this.montados++; },
    html(m) {
      const chave = m.uid || m.id;
      return `<div data-mc-card="${chave}" data-mc-sig="${m.status}">${m.titulo}</div>`;
    },
  };
}

function montarAmbiente() {
  const dom = new JSDOM(`<!doctype html><html><body>
    <span id="rotinas-count"></span>
    <div id="extrato-resumo"></div>
    <div id="lista-rotinas-hoje" style="overflow-y:auto;max-height:380px"></div>
  </body></html>`, {
    runScripts: 'outside-only',
    // Sem `url`, a origem é opaca e o primeiro toque em localStorage
    // levanta SecurityError — e `_renderExtrato` lê a preferência de
    // ocultar concluídas logo na primeira linha.
    url: 'http://localhost/',
  });

  const win = dom.window;
  instalarObservador(win);
  instalarMissaoCard(win);
  win.localStorage.setItem('sr_ocultar_concluidas_extrato', 'false');
  win.API = { get: async () => ({}) };
  win.Eco = { mostrar() {} };

  // Node 22: createContext(dom.window) não expõe mais os globais.
  const ctx = dom.getInternalVMContext();
  const vm = require('vm');
  vm.runInContext(fonte + '\n;globalThis.__Dashboard = Dashboard;', ctx);
  return { win, doc: win.document, Dashboard: win.__Dashboard };
}

/* 30 dias, 3 missões por dia = 90 registros + 2 penitências abertas. */
function fabricarLista(dias = 30, porDia = 3) {
  const lista = [];
  for (let d = 0; d < dias; d++) {
    const data = new Date(2026, 7, 1 + d).toISOString().slice(0, 10);
    for (let i = 0; i < porDia; i++) {
      lista.push({ uid: `m-${d}-${i}`, id: `${d}${i}`, data,
                   titulo: `Missão ${d}.${i}`, status: 'CONCLUIDA', natureza: 'ATIVA' });
    }
  }
  lista.push({ uid: 'pen-1', id: 'p1', data: '2026-08-03', titulo: 'Flexões',
               status: 'PENDENTE', natureza: 'PUNICAO' });
  lista.push({ uid: 'pen-2', id: 'p2', data: '2026-08-05', titulo: 'Abdominais',
               status: 'PENDENTE', natureza: 'PUNICAO' });
  return lista;
}

const secoesDeDia = (cont) =>
  [...cont.querySelectorAll(':scope > section[data-dia]')]
    .filter(s => s.dataset.dia !== '__penitencias__');

function rodar() {
  console.log('\n=== EXTRATO SOB DEMANDA ===\n');

  const { win, doc, Dashboard } = montarAmbiente();
  const cont = doc.getElementById('lista-rotinas-hoje');
  const lista = fabricarLista(30, 3);
  Dashboard._extratoLista = lista;

  /* ── 1. O primeiro quadro é curto ───────────────────────────── */
  console.log('-- o primeiro quadro --');
  Dashboard._renderExtrato(lista, cont);

  const dias1 = secoesDeDia(cont).length;
  ok(dias1 === Dashboard._DIAS_POR_LOTE,
     `nascem ${Dashboard._DIAS_POR_LOTE} dias, não 30 (vieram ${dias1})`);
  ok(Dashboard._totalDiasExtrato === 30,
     `mas o extrato SABE que existem 30 dias (${Dashboard._totalDiasExtrato})`);

  const nosCurto = cont.querySelectorAll('*').length;
  ok(nosCurto < 60, `DOM inicial enxuto: ${nosCurto} nós`);

  /* ── 2. As penitências não esperam ──────────────────────────── */
  const pin = cont.querySelector(':scope > section[data-dia="__penitencias__"]');
  ok(!!pin, 'a seção de DÍVIDAS ABERTAS está no topo desde o primeiro quadro');
  ok(pin && pin.querySelectorAll('[data-mc-card]').length === 2,
     'com as duas penitências — dívida nunca é adiada');
  ok(cont.children[0] === pin, 'e ela é o PRIMEIRO elemento da lista');

  /* ── 3. A sentinela existe, é a última, e não mente ─────────── */
  console.log('\n-- a sentinela --');
  let sent = cont.querySelector(':scope > [data-extrato-sentinela]');
  ok(!!sent, 'a sentinela foi posta no fim da lista');
  ok(cont.children[cont.children.length - 1] === sent,
     'e é o ÚLTIMO elemento — senão ela dispararia cedo demais');
  ok(/26 dias/.test(sent.textContent), `ela diz quantos faltam: "${sent.textContent}"`);
  ok(!sent.textContent.includes('Carregando'),
     'e evita a palavra "Carregando" — `carregarExtrato` a usa como sentinela de lista vazia');

  /* ── 4. Rolar revela, e a sentinela continua viva ───────────── */
  console.log('\n-- rolando --');
  const antes = secoesDeDia(cont).length;
  ok(win.__rolarAteOFim(), 'rolar até a sentinela dispara o observador');
  const depois = secoesDeDia(cont).length;
  ok(depois === antes + Dashboard._DIAS_POR_LOTE,
     `o lote seguinte entrou: ${antes} → ${depois} dias`);

  sent = cont.querySelector(':scope > [data-extrato-sentinela]');
  ok(!!sent, 'a sentinela SOBREVIVEU à repintura');
  ok(cont.children[cont.children.length - 1] === sent,
     'e voltou para o fim, abaixo dos dias novos');

  /* Este é o teste que pega o erro clássico: observar uma vez e
     esquecer de re-armar. Do terceiro lote em diante o disparo só
     funciona se o código re-observou a sentinela movida. */
  ok(win.__rolarAteOFim(), 'o observador foi RE-ARMADO — dispara de novo');
  ok(secoesDeDia(cont).length === depois + Dashboard._DIAS_POR_LOTE,
     `terceiro lote entrou: ${secoesDeDia(cont).length} dias`);

  /* ── 5. Rolando até o fim, nada se perde ────────────────────── */
  console.log('\n-- até o fim: o extrato inteiro, como sempre foi --');
  let voltas = 0;
  while (secoesDeDia(cont).length < 30 && voltas < 50) { win.__rolarAteOFim(); voltas++; }

  ok(secoesDeDia(cont).length === 30,
     `os 30 dias estão na tela (${voltas} rolagens)`);

  const cartoes = cont.querySelectorAll('[data-mc-card]').length;
  ok(cartoes === lista.length,
     `e as ${lista.length} missões, uma a uma — nenhuma se perdeu (${cartoes})`);

  const ordem = secoesDeDia(cont).map(s => s.dataset.dia);
  const ordenado = [...ordem].sort((a, b) => b.localeCompare(a));
  ok(JSON.stringify(ordem) === JSON.stringify(ordenado),
     'na ordem certa: o dia mais recente no topo');

  ok(!cont.querySelector(':scope > [data-extrato-sentinela]'),
     'e a sentinela se aposentou — não há mais o que revelar');
  ok(Dashboard._obsExtrato === null, 'o observador foi desligado (sem vazamento)');

  /* ── 6. A ROLAGEM NÃO FOI TOCADA ────────────────────────────── */
  console.log('\n-- a rolagem que o Arquiteto mandou não mexer --');
  ok(cont.style.overflowY === 'auto',
     `overflow-y segue "auto", como estava (${cont.style.overflowY})`);
  ok(cont.style.maxHeight === '380px',
     `max-height segue 380px (${cont.style.maxHeight})`);

  // A prova documental: o código de paginação não escreve rolagem.
  const trecho = fonte.slice(fonte.indexOf('_sentinelaExtrato(cont, faltam)'),
                             fonte.indexOf('_reiniciarPaginacaoExtrato()'));
  ok(!/style\.(overflow|height|maxHeight)/.test(trecho),
     'e o código da sentinela não escreve overflow/height em nenhum lugar');
  ok(/root:\s*cont/.test(fonte),
     'o observador usa o PRÓPRIO container como root — pega carona na rolagem existente');

  /* ── 7. Filtro reinicia; refresh não ────────────────────────── */
  console.log('\n-- quando voltar ao topo, e quando não voltar --');
  Dashboard._reiniciarPaginacaoExtrato();
  Dashboard._renderExtrato(lista, cont);
  ok(secoesDeDia(cont).length === Dashboard._DIAS_POR_LOTE,
     'trocar o filtro volta ao primeiro lote — a lista é outra');

  // Agora simula: o hunter rolou fundo e uma missão terminou.
  win.__rolarAteOFim(); win.__rolarAteOFim();
  const rolado = secoesDeDia(cont).length;
  Dashboard._renderExtrato(lista, cont);          // refresh comum, SEM reiniciar
  ok(secoesDeDia(cont).length === rolado,
     `um refresh comum NÃO recolhe a lista (${rolado} dias seguem abertos)`);

  /* ── 8. Lista vazia não deixa observador solto ──────────────── */
  console.log('\n-- lista vazia --');
  Dashboard._renderExtrato([], cont);
  ok(cont.textContent.includes('Nenhuma missão'), 'o estado vazio aparece');
  ok(Dashboard._obsExtrato === null,
     'e o observador foi solto — nada apontando para nó fora da árvore');

  console.log(`\n=== ${testes - falhas}/${testes} ===`);
  return falhas;
}

process.exit(rodar() ? 1 : 0);
