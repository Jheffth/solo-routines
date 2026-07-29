/* A Janela de Status empacotada como peça — teste de FIDELIDADE.

   A pergunta que este arquivo responde é uma só: a peça desenha
   exatamente o cartão que o index.html já desenhava?

   Por isso o teste não descreve a marcação esperada — ele compara
   com o GABARITO, que é o bloco recortado do index.html antes de o
   slot substituí-lo. Se alguém mexer em um dos dois lados, o teste
   acusa a divergência. É a única forma de provar "a tela não mudou"
   sem ter um navegador na mão.

   Uso:  npm i jsdom  &&  node webapp/frontend/tests/teste_hunter_card.js
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const RAIZ    = path.join(__dirname, '..');
const PECAS   = path.join(RAIZ, 'js', 'pecas.js');
const CLASSICO = path.join(RAIZ, 'js', 'pecas', 'hunter-card-classico.js');

/* O GABARITO é a marcação como estava no index.html antes do passo 3,
   congelada em arquivo. Enquanto o index.html ainda tinha o cartão,
   este teste recortava de lá. Agora o index.html tem um slot vazio —
   se a referência sumisse com ele, a garantia de "a tela não mudou"
   morreria justamente no passo que mais precisa dela. */
const GABARITO = path.join(__dirname, 'gabarito-hunter-card.html');

let falhas = 0, testes = 0;
function ok(cond, msg) {
  testes++;
  if (!cond) falhas++;
  console.log((cond ? '  [ok]  ' : '  [XX]  ') + msg);
}
const espera = ms => new Promise(r => setTimeout(r, ms));

/* AURAS DE VERDADE, DESENHO DE MENTIRA.

   Antes este arquivo tinha um dublê inteiro de `Auras` escrito à mão.
   Quando o módulo real ganhou `resolver`/`blocoDe`, o dublê ficou para
   trás e o teste passou a exercitar uma versão de `Auras` que não
   existe mais — o mesmo tipo de armadilha que já mordeu aqui, em que
   teste e implementação combinam entre si e discordam da realidade.

   Agora o auras.js real é carregado, e só o `bloco` (que desenha) é
   trocado por um marcador. A REGRA — qual aura vale entre cosmética,
   cargo e nenhuma — continua sendo a de produção. */
function ligarAurasReais(w, ctx, ler) {
  vm.runInContext(ler('js', 'auras.js'), ctx);
  const orig = w.Auras.bloco.bind(w.Auras);
  w.Auras.bloco = (id, t) => `<div class="aura-wrap" data-a="${id}" data-t="${t}"></div>`;
  w.Auras._blocoReal = orig;
  return w.Auras;
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

const dom = new JSDOM('<!doctype html><body><div id="slot" data-slot="banner"></div></body>',
                      { pretendToBeVisual: true });
const w = dom.window;

// Dublês do vocabulário compartilhado. A peça fala com eles, mas
// eles não são o hospedeiro — são bibliotecas de desenho.
const chamou = { desenhada: null, badgeCard: 0 };
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
ligarAurasReais(w, ctx, (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8'));
/* Em vez de contar CHAMADAS, o teste anota QUAL aura foi desenhada.
   É o que realmente importa e não depende de por onde a decisão
   passou — a versão anterior contava `bloco` e `aplicar` separados, e
   quebrou assim que a regra virou uma função só. */
const _bloco = w.Auras.bloco;
w.Auras.bloco = (id, t) => { chamou.desenhada = id; return _bloco(id, t); };
vm.runInContext(fs.readFileSync(PECAS, 'utf8'), ctx);
vm.runInContext(fs.readFileSync(CLASSICO, 'utf8'), ctx);

const P = w.Pecas, doc = w.document, el = doc.getElementById('slot');

/* ══ 1. FIDELIDADE — o teste que dá sentido ao passo ══ */
console.log('-- fidelidade ao gabarito (a tela de antes do passo 3) --');
const doIndex = fs.readFileSync(GABARITO, 'utf8');
const daPeca  = w.HunterCardClassico.esqueleto();
ok(normalizar(doIndex) === normalizar(daPeca),
   'a marcação da peça é IDÊNTICA à que o index.html tinha');
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
ok(chamou.desenhada === 'arquiteto',
   `sem aura_id: desenha a aura de CARGO (${chamou.desenhada})`);

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
// As relíquias vêm NO PACOTE, ao lado do hunter — não dentro dele.
// Eu já errei este lado uma vez: montava o dado do jeito errado
// aqui E na peça, então os dois combinavam e o teste passava. Foi o
// teste de integração com o dashboard.js real que acusou.
P.atualizar(el, { hunter,
  reliquias: [ {codigo:'a'},{codigo:'b'},{codigo:'c'},{codigo:'d'},{codigo:'e'},{codigo:'f'},{codigo:'g'} ],
  reliquias_fixadas: [],
});
ok(el.querySelectorAll('.hunter-reliquia').length === 5,
   'sete relíquias, cinco desenhadas (a sexta quebrava a linha)');
ok(!!el.querySelector('#dash-altar'), 'e o botão de editar o altar aparece');
el.querySelector('#dash-altar').dispatchEvent(new w.Event('click'));
el.querySelector('.hunter-reliquia').dispatchEvent(new w.Event('click'));
ok(acoes.includes('editar-altar') && acoes.includes('ver-reliquias'),
   'os cliques viram AÇÕES pedidas ao hospedeiro (a peça não navega sozinha)');

P.atualizar(el, { hunter,
  reliquias: [{codigo:'a'},{codigo:'b'},{codigo:'c'}], reliquias_fixadas: ['c'],
});
ok(el.querySelectorAll('.hunter-reliquia').length === 1 &&
   el.querySelector('.hunter-reliquia').dataset.bc === 'c',
   'com relíquias fixadas, só as fixadas aparecem');

/* ══ 8. Aura cosmética ganha da de cargo ══ */
console.log('\n-- aura --');
chamou.desenhada = null;
P.atualizar(el, { hunter: Object.assign({}, hunter, { aura_id: 'fenix-pioneira' }) });
ok(chamou.desenhada === 'fenix-pioneira',
   'com aura_id válida, a cosmética ganha da aura de cargo');

/* O TERCEIRO ESTADO, que não existia: o Arquiteto escolhendo NÃO ter
   aura. Antes isto caía na do cargo, e ele ficava preso a ela. */
chamou.desenhada = null;
P.atualizar(el, { hunter: Object.assign({}, hunter, { aura_id: '__nenhuma' }) });
ok(chamou.desenhada === null, 'com "__nenhuma": não desenha aura alguma');
ok(!el.querySelector('.aura-wrap'), '  e o halo some do retrato de verdade');

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
