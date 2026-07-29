/* O Cofre de Auras — os quatro defeitos relatados.

   Cada bloco aqui corresponde a uma frase do Arquiteto:

     "às vezes abre vazio"          -> falha != ausência, e há esqueleto
     "aparece travada, obrigatória" -> existe o slot Sem aura
     "demora muito para fechar"     -> fecha antes de falar com o servidor
     "não combina com o projeto"    -> cantos chanfrados, sem backdrop-filter

   Uso:  node webapp/frontend/tests/teste_modal_auras.js
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const RAIZ = path.join(__dirname, '..');
const ler = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');

let falhas = 0, testes = 0;
function ok(cond, msg) {
  testes++; if (!cond) falhas++;
  console.log((cond ? '  [ok]  ' : '  [XX]  ') + msg);
}
const espera = ms => new Promise(r => setTimeout(r, ms));

const HUNTER = { nome: 'Jh3ffth', nivel_acesso: 'Arquiteto', aura_id: null };

const INVENTARIO = {
  aura_ativa: null,
  sem_aura: '__nenhuma',
  nenhuma_ativa: false,
  cargo_ativa: true,
  inventario: [
    { id: 'fenix-pioneira', nome: 'Fênix', descricao: 'Chama imortal.' },
    { id: 'bella-rosa', nome: 'Bella Rosa', de: 'Diana' },
    { id: 'arquiteto', nome: 'Aura de Cargo (Arquiteto)',
      descricao: 'Concedida automaticamente.', de_cargo: true, ativa: true },
  ],
};

function montar(respostas) {
  const dom = new JSDOM('<!doctype html><body></body>',
                        { pretendToBeVisual: true, url: 'http://localhost/' });
  const w = dom.window;
  const chamadas = [];
  w.API = {
    get: async (rota) => {
      chamadas.push(['GET', rota]);
      const r = respostas.get;
      if (r instanceof Error) throw r;
      if (typeof r === 'function') return r();
      return r;
    },
    put: async (rota, corpo) => {
      chamadas.push(['PUT', rota, corpo]);
      const r = respostas.put;
      if (r instanceof Error) throw r;
      return { ok: true };
    },
  };
  const avisos = [];
  w.SoloDialog = { toast: (m, t) => avisos.push([m, t]) };
  w.Auras = {
    SEM_AURA: '__nenhuma',
    _registro: { arquiteto: 1, 'fenix-pioneira': 1, 'bella-rosa': 1 },
    existe: id => ['arquiteto', 'fenix-pioneira', 'bella-rosa'].includes(id),
    bloco: (id, t) => `<span class="aura-wrap" data-a="${id}" data-t="${t}"></span>`,
  };
  w.console = { log(){}, warn(){}, error(){} };
  const ctx = vm.createContext(w);
  vm.runInContext(ler('js', 'modal-auras.js'), ctx);
  return { w, doc: w.document, M: w.ModalAuras, chamadas, avisos };
}

async function main() {
console.log('\n=== O COFRE DE AURAS ===\n');

/* ══ 1. "às vezes abre vazio" ══ */
console.log('-- abrir: a falha não pode virar "não tem nada" --');

// (a) O modal nasce ANTES do dado chegar.
const A = montar({ get: () => new Promise(r => setTimeout(() => r(INVENTARIO), 40)) });
A.M.abrir(HUNTER, () => {});
const caixa = A.doc.getElementById('dash-modal-aura');
ok(!!caixa, 'o modal aparece IMEDIATAMENTE, sem esperar a rede');
ok(caixa.querySelectorAll('.ma-fantasma').length === 4,
   '  com esqueleto pulsando, não com a tela vazia');
ok(!caixa.textContent.includes('Nenhuma aura'),
   '  e sem dizer que o cofre está vazio antes de ter perguntado');
await espera(70);
ok(A.doc.querySelectorAll('.ma-fantasma').length === 0, 'o esqueleto some quando o dado chega');
A.M.fechar(); await espera(200);

// (b) ERRO é ERRO — este era o bug.
const B = montar({ get: new Error('Falha de rede') });
B.M.abrir(HUNTER, () => {});
await espera(30);
const cB = B.doc.getElementById('dash-modal-aura');
ok(!!cB.querySelector('.ma-aviso'), 'falha de rede mostra tela de ERRO');
ok(cB.textContent.includes('Falha de rede'), '  dizendo o que aconteceu');
ok(!cB.textContent.includes('Nenhuma aura no inventário'),
   '  e NUNCA "Nenhuma aura no inventário" — era isso que assustava');
ok(!!cB.querySelector('[data-ma="tentar"]'), 'com um botão de tentar de novo');

// o "tentar de novo" refaz a chamada
const antes = B.chamadas.length;
B.w.API.get = async () => INVENTARIO;
cB.querySelector('[data-ma="tentar"]').onclick();
await espera(30);
ok(B.doc.querySelectorAll('.ma-card[data-aura]').length > 0,
   '  e ele realmente recarrega o cofre');
B.M.fechar(); await espera(200);

/* ══ 2. "aparece travada, como se eu fosse obrigado" ══ */
console.log('\n-- o slot Sem aura --');
const C = montar({ get: INVENTARIO });
C.M.abrir(HUNTER, () => {});
await espera(30);
const dC = C.doc;
const vazio = dC.querySelector('.ma-card.ma-vazia');
ok(!!vazio, 'existe um cartão "Sem aura"');
ok(vazio.dataset.aura === '__nenhuma', '  que aponta para o sentinela do backend');
ok(!!vazio.querySelector('.ma-silhueta svg'),
   '  com silhueta apagada, no mesmo formato dos outros — não um botão avulso');
ok(vazio === dC.querySelector('.ma-grade').firstElementChild,
   '  e vem primeiro, antes das auras');

const cargo = dC.querySelector('.ma-card.ma-cargo');
ok(!!cargo, 'a aura de cargo aparece');
ok(!cargo.hasAttribute('data-aura'), '  não é clicável (o Sistema é quem a concede)');
ok(cargo.textContent.includes('Concedida pelo cargo'),
   '  e o rótulo explica em vez de mostrar cadeado de proibido');
ok(cargo.classList.contains('ma-ativa'),
   '  está marcada como vigente, porque não há cosmética nem "sem aura"');

ok(dC.querySelectorAll('.ma-card[data-aura]').length === 3,
   'três cartões escolhíveis: Sem aura, Fênix e Bella Rosa');
ok(dC.querySelector('[data-aura="bella-rosa"]').textContent.includes('Presente de Diana'),
   'e a aura presenteada diz de quem veio');
C.M.fechar(); await espera(200);

// Com o sentinela ativo, o realce vai para o slot vazio.
const D = montar({ get: Object.assign({}, INVENTARIO,
  { aura_ativa: '__nenhuma', nenhuma_ativa: true, cargo_ativa: false }) });
D.M.abrir(Object.assign({}, HUNTER, { aura_id: '__nenhuma' }), () => {});
await espera(30);
ok(D.doc.querySelector('.ma-card.ma-vazia').classList.contains('ma-ativa'),
   'com "sem aura" escolhida, é o slot vazio que fica realçado');
ok(!D.doc.querySelector('.ma-card.ma-cargo').classList.contains('ma-ativa'),
   '  e a de cargo deixa de ser a vigente');
D.M.fechar(); await espera(200);

/* ══ 3. "demora muito para fechar" ══ */
console.log('\n-- a escolha fecha na hora --');
const E = montar({ get: INVENTARIO, put: null });
const repintado = [];
E.M.abrir(HUNTER, (id) => repintado.push(id));
await espera(30);

// PUT que nunca responde: o modal não pode ficar esperando por ele.
let liberar;
E.w.API.put = () => new Promise(r => { liberar = r; });
E.doc.querySelector('[data-aura="fenix-pioneira"]').onclick();
ok(!E.doc.getElementById('dash-modal-aura')?.classList.contains('ma-aberto'),
   'o modal fecha ANTES da resposta do servidor');
ok(repintado[0] === 'fenix-pioneira', 'e o banner é repintado na hora');
liberar && liberar({ ok: true });
await espera(220);
ok(!E.doc.getElementById('dash-modal-aura'), 'e o nó some do documento');

// Se o servidor recusar, desfaz.
const F = montar({ get: INVENTARIO, put: new Error('403 sem posse') });
const hist = [];
F.M.abrir(Object.assign({}, HUNTER, { aura_id: 'bella-rosa' }), (id) => hist.push(id));
await espera(30);
F.doc.querySelector('[data-aura="fenix-pioneira"]').onclick();
await espera(30);
ok(hist[0] === 'fenix-pioneira' && hist[1] === 'bella-rosa',
   'servidor recusando: aplica otimista e DESFAZ (fenix → bella-rosa)');
ok(F.avisos.some(a => a[1] === 'error'), '  avisando o hunter do que houve');

// Escolher a que já está equipada não gera chamada nenhuma.
const G = montar({ get: INVENTARIO });
G.M.abrir(Object.assign({}, HUNTER, { aura_id: 'fenix-pioneira' }), () => {});
await espera(30);
const putsAntes = G.chamadas.filter(c => c[0] === 'PUT').length;
G.doc.querySelector('[data-aura="fenix-pioneira"]').onclick();
await espera(30);
ok(G.chamadas.filter(c => c[0] === 'PUT').length === putsAntes,
   'clicar na aura já equipada só fecha — sem chamada à toa');
await espera(200);

/* ══ 4. "não combina com o projeto" ══ */
console.log('\n-- a cara do Sistema --');
const css = ler('css', 'modal-auras.css');
/* TIRAR OS COMENTARIOS ANTES DE PROCURAR. Esta armadilha ja mordeu
   duas vezes neste projeto: o cabecalho EXPLICA por que nao ha
   `backdrop-filter`, entao a busca no texto cru encontra justamente a
   prova de que o problema foi evitado — e acusa. */
const cssCodigo = css.replace(/\/\*[\s\S]*?\*\//g, '');
ok(/clip-path:\s*polygon/.test(cssCodigo),
   'cantos chanfrados, como a .sys-plate e o banner');
ok(!/backdrop-filter/.test(cssCodigo),
   'SEM backdrop-filter — era ele borrando o banner animado a cada quadro');
ok(/backdrop-filter/.test(css),
   '  (o comentario menciona: a licao fica registrada onde se le)');
ok(/--purple-glow|--purple-soft/.test(cssCodigo), 'usa a paleta do projeto, não um dourado avulso');
ok(/--font-section/.test(cssCodigo) && /--font-title/.test(cssCodigo), 'e a tipografia do projeto');
ok(/prefers-reduced-motion/.test(cssCodigo), 'respeita quem pediu menos movimento');

const js = ler('js', 'modal-auras.js');
const codigo = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
ok(!/fetch\(/.test(codigo), 'usa a classe API, não um fetch cru com token na mão');
ok(!/catch\s*\(\s*_\s*\)\s*\{\s*\}/.test(codigo),
   'e não há catch mudo — era o catch mudo que virava "cofre vazio"');
ok(!/Dashboard\./.test(codigo),
   'o modal não conhece o Dashboard: recebe o hunter e devolve a escolha');

/* ══ 5. Auras.resolver — os três estados ══ */
console.log('\n-- os três estados da aura --');
const dom2 = new JSDOM('<!doctype html><body></body>');
const w2 = dom2.window;
w2.console = { log(){}, warn(){}, error(){} };
const ctx2 = vm.createContext(w2);
vm.runInContext(ler('js', 'auras.js'), ctx2);
const Au = w2.Auras;
ok(Au.resolver(null, 'Arquiteto') === 'arquiteto',
   'sem cosmética: vale a aura do CARGO');
ok(Au.resolver('__nenhuma', 'Arquiteto') === null,
   'com o sentinela: NENHUMA aura, nem a do cargo — o Arquiteto não é obrigado');
ok(Au.resolver('fenix-pioneira', 'Arquiteto') === 'fenix-pioneira',
   'com cosmética: ela ganha do cargo');
ok(Au.resolver(null, 'User') === null, 'hunter comum sem cosmética: nada');
ok(Au.blocoDe('__nenhuma', 'Arquiteto', 100) === '', 'e o bloco sai vazio de verdade');
ok(Au.blocoDe(null, 'Arquiteto', 100).length > 0, 'enquanto o do cargo desenha');

console.log(`\n=== ${testes - falhas}/${testes} ===`);
if (falhas) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
