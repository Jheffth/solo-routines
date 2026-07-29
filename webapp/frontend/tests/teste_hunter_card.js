/* A Janela de Status empacotada como peça — teste de FIDELIDADE.

   A pergunta que este arquivo responde é uma só: a peça desenha
   exatamente o cartão que o index.html já desenhava?

   Por isso o teste não descreve a marcação esperada — ele RECORTA
   o bloco do index.html e compara. Se alguém mexer em um dos dois
   lados, o teste acusa a divergência. É a única forma de provar
   "a tela não mudou" sem ter um navegador na mão.

   Uso:  npm i jsdom  &&  node webapp/frontend/tests/teste_hunter_card.js
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const RAIZ    = path.join(__dirname, '..');
const INDEX   = path.join(RAIZ, 'index.html');
const PECAS   = path.join(RAIZ, 'js', 'pecas.js');
const CLASSICO = path.join(RAIZ, 'js', 'pecas', 'hunter-card-classico.js');

let falhas = 0, testes = 0;
function ok(cond, msg) {
  testes++;
  if (!cond) falhas++;
  console.log((cond ? '  [ok]  ' : '  [XX]  ') + msg);
}
const espera = ms => new Promise(r => setTimeout(r, ms));

/* ── Recorta o miolo do #hunter-card do index.html ──────────
   Contando as <div> para achar o fecho certo: o bloco tem divs
   aninhadas, então parar na primeira </div> pegaria o lugar
   errado. */
function recortarHunterCard(html) {
  const abre = html.indexOf('<div class="hunter-window" id="hunter-card">');
  if (abre < 0) throw new Error('não achei o #hunter-card no index.html');
  let i = html.indexOf('>', abre) + 1;
  const inicio = i;
  let nivel = 1;
  const re = /<(\/?)div\b[^>]*>/g;
  re.lastIndex = i;
  let m;
  while ((m = re.exec(html))) {
    nivel += m[1] ? -1 : 1;
    if (nivel === 0) return html.slice(inicio, m.index);
  }
  throw new Error('o #hunter-card não fecha');
}

/* Normaliza para comparar: o que importa é a marcação, não a
   indentação nem os comentários. */
const normalizar = s => s
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\s+/g, ' ')
  .replace(/>\s+</g, '><')
  .trim();

async function main() {
console.log('\n=== A JANELA DE STATUS COMO PEÇA ===\n');

const html = fs.readFileSync(INDEX, 'utf8');
const dom = new JSDOM('<!doctype html><body><div id="slot" data-slot="banner"></div></body>',
                      { pretendToBeVisual: true });
const w = dom.window;

// Dublês do vocabulário compartilhado. A peça fala com eles, mas
// eles não são o hospedeiro — são bibliotecas de desenho.
const chamou = { auraAplicar: 0, auraBloco: 0, badgeCard: 0 };
w.Auras = {
  existe: id => id === 'aura-teste',
  bloco: () => { chamou.auraBloco++; return '<div class="aura-wrap">aura</div>'; },
  aplicar: () => { chamou.auraAplicar++; },
};
w.ConquistaFX = { miniMedalha: c => `<svg data-m="${c.codigo}"></svg>` };
w.BadgeCard = { ligarTodos: () => { chamou.badgeCard++; } };

// jsdom não desenha em canvas. Um contexto de mentira deixa o laço
// de partículas RODAR, que é o que precisamos observar.
let pintadas = 0;
w.HTMLCanvasElement.prototype.getContext = function () {
  return {
    clearRect(){}, beginPath(){}, arc(){}, fill(){ pintadas++; },
    set fillStyle(v){}, set globalAlpha(v){},
  };
};

const log = { warn: [], error: [] };
w.console = { log(){}, warn:(...a)=>log.warn.push(a.join(' ')), error:(...a)=>log.error.push(a.join(' ')) };

const ctx = vm.createContext(w);
vm.runInContext(fs.readFileSync(PECAS, 'utf8'), ctx);
vm.runInContext(fs.readFileSync(CLASSICO, 'utf8'), ctx);

const P = w.Pecas, doc = w.document, el = doc.getElementById('slot');

/* ══ 1. FIDELIDADE — o teste que dá sentido ao passo ══ */
console.log('-- fidelidade à marcação do index.html --');
const doIndex = recortarHunterCard(html);
const daPeca  = w.HunterCardClassico.esqueleto();
ok(normalizar(doIndex) === normalizar(daPeca),
   'a marcação da peça é IDÊNTICA à do index.html');
if (normalizar(doIndex) !== normalizar(daPeca)) {
  const a = normalizar(doIndex), b = normalizar(daPeca);
  let i = 0; while (i < a.length && a[i] === b[i]) i++;
  console.log('        divergem em ' + i + ':');
  console.log('        index: …' + a.slice(Math.max(0,i-60), i+60));
  console.log('        peça : …' + b.slice(Math.max(0,i-60), i+60));
}

// Comparação estrutural independente, em DOM de verdade.
const caixaA = doc.createElement('div'); caixaA.innerHTML = doIndex;
const caixaB = doc.createElement('div'); caixaB.innerHTML = daPeca;
const ids = n => [...n.querySelectorAll('[id]')].map(x => x.id).sort();
const cls = n => [...new Set([...n.querySelectorAll('[class]')]
                    .flatMap(x => [...x.classList]))].sort();
ok(JSON.stringify(ids(caixaA)) === JSON.stringify(ids(caixaB)),
   `os ${ids(caixaA).length} ids são exatamente os mesmos`);
ok(JSON.stringify(cls(caixaA)) === JSON.stringify(cls(caixaB)),
   `as ${cls(caixaA).length} classes são exatamente as mesmas`);
ok(caixaA.querySelectorAll('*').length === caixaB.querySelectorAll('*').length,
   `mesma contagem de elementos (${caixaA.querySelectorAll('*').length})`);
ok(caixaA.textContent.replace(/\s+/g,' ').trim() === caixaB.textContent.replace(/\s+/g,' ').trim(),
   'mesmo texto visível');

/* ══ 2. A peça se registrou como padrão ══ */
console.log('\n-- registro --');
ok(P.existe('hunter-card-classico'), 'a peça está registrada');
ok(P.padraoDa('banner')?.id === 'hunter-card-classico',
   'e é a PADRÃO da família banner (a rede das outras)');

/* ══ 3. Montagem e pintura ══ */
console.log('\n-- montagem com dados --');
const hunter = {
  nome: 'Jh3ffth', classe: 'S-Rank', nivel_atual: 42, moedas: 1234,
  streak_atual: 7, xp_atual: 900, xp_proximo_nivel: 1000,
  nivel_acesso: 'Arquiteto', avatar_url: '/img/eu.png',
};
const inst = P.montar(el, 'hunter-card-classico', { hunter }, {
  acoes: { 'editar-perfil': () => { acoes.push('editar-perfil'); },
           'editar-altar':  () => { acoes.push('editar-altar'); },
           'ver-reliquias': () => { acoes.push('ver-reliquias'); } },
});
const acoes = [];
ok(inst !== null, 'monta');
ok(el.querySelector('#dash-nome').textContent === 'Jh3ffth', 'o nome entra');
ok(el.querySelector('#dash-rank-selo').textContent === 'S', 'S-Rank vira o selo "S"');
ok(el.style.getPropertyValue('--rank-cor') === '#fbbf24',
   'a cor do rank S vira variável DO CONTÊINER (antes: de #hunter-card)');
ok(el.querySelector('#dash-xp-txt').textContent === '900 / 1.000 XP',
   'o XP sai formatado em pt-BR');
ok(el.querySelector('.hunter-xp-track').classList.contains('quase'),
   '90% acende o "quase" (a barra arde em ouro perto de subir)');
ok(el.querySelector('#dash-rank-badge').innerHTML.includes('ARQUITETO'),
   'o selo de Arquiteto aparece');
ok(el.querySelector('#dash-avatar').innerHTML.includes('/img/eu.png'), 'o avatar entra');
ok(chamou.auraAplicar === 1 && chamou.auraBloco === 0,
   'sem aura_id: cai na aura de cargo');

/* ══ 4. O que NÃO é da peça ══ */
console.log('\n-- a fronteira: o que ficou com o hospedeiro --');
const fonte = fs.readFileSync(CLASSICO, 'utf8');
const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
ok(!/sidebar-/.test(codigo), 'a peça não toca na barra lateral');
ok(!/sys-whisper|sys-dungeon-chip/.test(codigo), 'nem nos sussurros nem no chip de dungeon');
ok(!/__resetPerfilArquiteto|BuscaHunters/.test(codigo), 'nem no reset nem na busca de hunters');
ok(!/document\.getElementById/.test(codigo),
   'e NUNCA usa document.getElementById — toda busca é presa ao contêiner');
ok(!/\bAPI\./.test(codigo), 'não chama a API: quem busca dado é o hospedeiro');

/* ══ 5. Contagem animada dos cristais ══ */
console.log('\n-- os cristais contam --');
const nivel = el.querySelector('#dash-nivel');
ok(nivel.textContent !== '42', `a contagem começa abaixo do alvo (em "${nivel.textContent}")`);
await espera(900);
ok(nivel.textContent === '42', 'e chega em 42');
ok(el.querySelector('#dash-moedas').textContent === '1.234', 'as moedas chegam em 1.234');
await espera(120);
const qDepois = P.diagnostico().quadros;

/* ══ 6. Repintura sem piscar ══ */
console.log('\n-- repintura (o atualizarNumeros do Dashboard) --');
const antesHTML = el.querySelector('#dash-nome');
P.atualizar(el, { hunter: Object.assign({}, hunter, { nome: 'Arquiteto', moedas: 9 }) });
ok(el.querySelector('#dash-nome') === antesHTML,
   'o nó do nome é O MESMO: repintou, não remontou (nada pisca)');
ok(el.querySelector('#dash-nome').textContent === 'Arquiteto', 'e o texto novo entrou');
ok(el.querySelector('#dash-moedas').textContent === '9',
   'na repintura o número vai direto, sem reanimar do zero');

/* ══ 7. Relicário vem PRONTO do hospedeiro ══ */
console.log('\n-- relíquias --');
P.atualizar(el, { hunter: Object.assign({}, hunter, {
  reliquias: [ {codigo:'a'},{codigo:'b'},{codigo:'c'},{codigo:'d'},{codigo:'e'},{codigo:'f'},{codigo:'g'} ],
  reliquias_fixadas: [],
}) });
ok(el.querySelectorAll('.hunter-reliquia').length === 5,
   'sete relíquias, cinco desenhadas (a sexta quebrava a linha)');
ok(!!el.querySelector('#dash-altar'), 'e o botão de editar o altar aparece');
el.querySelector('#dash-altar').dispatchEvent(new w.Event('click'));
el.querySelector('.hunter-reliquia').dispatchEvent(new w.Event('click'));
ok(acoes.includes('editar-altar') && acoes.includes('ver-reliquias'),
   'os cliques viram AÇÕES pedidas ao hospedeiro (a peça não navega sozinha)');

P.atualizar(el, { hunter: Object.assign({}, hunter, {
  reliquias: [{codigo:'a'},{codigo:'b'},{codigo:'c'}], reliquias_fixadas: ['c'],
}) });
ok(el.querySelectorAll('.hunter-reliquia').length === 1 &&
   el.querySelector('.hunter-reliquia').dataset.bc === 'c',
   'com relíquias fixadas, só as fixadas aparecem');

/* ══ 8. Aura cosmética ganha da de cargo ══ */
console.log('\n-- aura --');
chamou.auraAplicar = 0;
P.atualizar(el, { hunter: Object.assign({}, hunter, { aura_id: 'aura-teste' }) });
ok(chamou.auraBloco === 1 && chamou.auraAplicar === 0,
   'com aura_id válida, a cosmética ganha da aura de cargo');

/* ══ 9. As partículas e a limpeza ══ */
console.log('\n-- partículas e desmonte --');
ok(pintadas > 0, `o canvas está sendo pintado (${pintadas} partículas)`);
const d1 = P.diagnostico();
ok(d1.ouvintes > 0, `${d1.ouvintes} ouvintes rastreados (inclusive o resize da janela)`);

const antesPint = pintadas;
P.desmontar(el);
const d2 = P.diagnostico();
ok(d2.vivas === 0 && d2.quadros === 0 && d2.ouvintes === 0 && d2.intervalos === 0,
   'desmontou: ZERO quadros, ouvintes e timers — e a peça não tem destruir()');
await espera(100);
ok(pintadas === antesPint,
   `as partículas pararam de verdade (travadas em ${antesPint})`);
ok(el.innerHTML === '', 'o contêiner ficou vazio');

/* ══ 10. Duas instâncias ao mesmo tempo ══ */
console.log('\n-- duas na mesma página (o caso da Vitrine ao lado do Dashboard) --');
// A ORDEM NO DOCUMENTO importa para o teste do final: quem é
// inserido primeiro é quem o getElementById encontra.
const primeiro = doc.createElement('div'); doc.body.appendChild(primeiro);
const segundo  = doc.createElement('div'); doc.body.appendChild(segundo);
P.montar(primeiro, 'hunter-card-classico', { hunter: Object.assign({}, hunter, { nome: 'A', classe: 'E-Rank' }) });
P.montar(segundo,  'hunter-card-classico', { hunter: Object.assign({}, hunter, { nome: 'B', classe: 'S-Rank' }) });
ok(primeiro.querySelector('#dash-nome').textContent === 'A' &&
   segundo.querySelector('#dash-nome').textContent === 'B',
   'cada instância pinta a SUA (as buscas são presas ao contêiner)');
ok(primeiro.style.getPropertyValue('--rank-cor') !== segundo.style.getPropertyValue('--rank-cor'),
   'e cada uma tem a própria cor de rank');
ok(doc.querySelectorAll('#dash-nome').length === 2,
   '  RESSALVA: os ids se repetem no documento — dívida declarada,');
ok(doc.getElementById('dash-nome').textContent === 'A',
   '  e getElementById devolve sempre a PRIMEIRA do documento,');
ok(doc.getElementById('dash-nome') !== segundo.querySelector('#dash-nome'),
   '  nunca a segunda. É exatamente por isso que a peça não o usa.');

P.desmontarTodas();
const fim = P.diagnostico();
ok(fim.vivas === 0 && fim.quadros === 0 && fim.ouvintes === 0, 'tudo desmontado, nada vazou');

console.log(`\n=== ${testes - falhas}/${testes} ===`);
if (falhas) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
