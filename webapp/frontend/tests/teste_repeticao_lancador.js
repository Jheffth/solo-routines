/* O lançador da Rotina de repetições — o modo, o alvo e o token {n}.

   Três promessas do plano sendo verificadas:

   1. A REPETIÇÃO NÃO É PREMIUM. O bloco de natureza deixou de depender
      de `_podeEspeciais` — escondê-lo do hunter comum esconderia junto
      uma opção que ele pode usar. É a PASSIVA que some, não o bloco.

   2. A PRÉVIA DO {n} É OBRIGATÓRIA. É a primeira sintaxe que este app
      pede ao hunter; sem ver o resultado ele não confia.

   3. O {n} É RESOLVIDO NO SALVAR. Guardar a sintaxe obrigaria o
      Extrato, a busca, o bot e a futura guilda a conhecê-la.

   Uso:  node webapp/frontend/tests/teste_repeticao_lancador.js
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

console.log('\n=== O LANÇADOR DA REPETIÇÃO ===\n');

const dom = new JSDOM('<!doctype html><body></body>',
  { pretendToBeVisual: true, runScripts: 'outside-only', url: 'http://localhost/' });
const w = dom.window, doc = w.document;
w.console = { log(){}, warn(){}, error(){} };

/* Dublês: o lançador conversa com API e SoloDialog. */
const chamadas = [];
w.API = {
  get: async (u) => {
    chamadas.push(['GET', u]);
    if (u.startsWith('/rotinas/especiais/permissao')) return { pode_especiais: w.__staff };
    if (u.startsWith('/contadores')) return w.__contadores;
    if (u.startsWith('/economia/simular')) return {
      xp_recompensa: 50, moedas_recompensa: 5, penalidade_xp: 7,
      prazo_minutos: 60, repeticao: { por_clique: 3, por_dia: 30 },
    };
    return {};
  },
  post: async (u, b) => { chamadas.push(['POST', u, b]); return { id: 77, nome: b.nome }; },
  rotinas: {
    criar:     async (p) => { chamadas.push(['CRIAR', p]); return { id: 1, ...p }; },
    atualizar: async (i, p) => { chamadas.push(['ATUALIZAR', i, p]); return { id: i, ...p }; },
  },
};
w.SoloDialog = { toast: (m, t) => chamadas.push(['TOAST', m, t]) };
w.__staff = false;
w.__contadores = [];

const ctx = vm.createContext(w);
vm.runInContext(ler('js', 'glifos.js'), ctx);
vm.runInContext(ler('js', 'missao-card.js'), ctx);
vm.runInContext(ler('js', 'forja-missao.js'), ctx);
const FM = vm.runInContext('ForjaMissao', ctx);

const esperar = () => new Promise(r => setTimeout(r, 0));
const $ = s => doc.querySelector(s);
const clicar = el => el && el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const digitar = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };

(async () => {

/* ══ 1. A repetição não é premium ══ */
console.log('-- a repetição é de todo mundo --');
w.__staff = false;
FM.abrir();
await esperar(); await esperar();

const bloco = $('#fm-bloco-natureza');
ok(!!bloco, 'o bloco de natureza existe');
ok(bloco.style.display !== 'none',
   'e APARECE para o hunter comum — antes ele sumia junto com a passiva');
const ops = [...doc.querySelectorAll('[data-fm-campo="natureza"]')].map(o => o.dataset.fmValor);
ok(ops.includes('REPETICAO'), '  com a opção REPETICAO');
ok(ops.includes('ATIVA'), '  e a ATIVA');
ok(!ops.includes('PASSIVA'),
   'e SEM a PASSIVA: a permissão passou a ser por item, não por bloco');
ok(!/Premium/i.test(bloco.textContent),
   'sem selo "Premium" no bloco — ele não é mais premium por inteiro');

/* ══ 2. Com permissão, a passiva volta ══ */
console.log('\n-- e a staff continua vendo a passiva --');
w.__staff = true;
FM.abrir();
await esperar(); await esperar();
const ops2 = [...doc.querySelectorAll('[data-fm-campo="natureza"]')].map(o => o.dataset.fmValor);
ok(ops2.includes('PASSIVA'),
   'com permissão, a passiva aparece — e já na PRIMEIRA abertura');
ok(ops2.filter(v => v === 'PASSIVA').length === 1,
   '  uma vez só: repintar não pode duplicar a opção');
FM._repintarNaturezas(); FM._repintarNaturezas();
ok([...doc.querySelectorAll('[data-fm-valor="PASSIVA"]')].length === 1,
   '  nem depois de repintar duas vezes');

/* ══ 3. O bloco de repetição só aparece na natureza certa ══ */
console.log('\n-- o bloco de repetição --');
const brep = $('#fm-bloco-repeticao');
ok(!!brep, 'o bloco existe');
ok(brep.style.display === 'none', 'e nasce escondido');
clicar(doc.querySelector('[data-fm-valor="REPETICAO"]'));
await esperar(); await esperar();
ok(brep.style.display !== 'none', 'aparece ao escolher REPETICAO');
ok(chamadas.some(c => c[0] === 'GET' && c[1].startsWith('/contadores')),
   '  e SÓ AÍ busca os contadores: quase nenhuma missão é de repetição');
clicar(doc.querySelector('[data-fm-valor="ATIVA"]'));
ok(brep.style.display === 'none', 'e some ao voltar para ATIVA');
clicar(doc.querySelector('[data-fm-valor="REPETICAO"]'));
await esperar();

/* ══ 4. Meta e Livre ══ */
console.log('\n-- os dois modos --');
const modos = [...doc.querySelectorAll('[data-fm-campo="rep_modo"]')].map(o => o.dataset.fmValor);
ok(modos.length === 2 && modos.includes('META') && modos.includes('BONUS'),
   'dois modos: META e BONUS');
ok($('#fm-rep-meta').style.display !== 'none', 'META nasce escolhido');
ok($('#fm-rep-bonus').style.display === 'none', '  e o painel do livre escondido');
clicar(doc.querySelector('[data-fm-valor="BONUS"]'));
ok($('#fm-rep-bonus').style.display !== 'none', 'trocar para Livre mostra o outro painel');
ok($('#fm-rep-meta').style.display === 'none', '  e esconde o da meta');
ok(/máx.*3.*por clique/i.test($('#fm-rep-teto').textContent),
   'o teto por clique vem do SERVIDOR (3), não escrito na tela');
ok(/30/.test($('#fm-rep-teto').textContent), '  e o teto do dia também (30)');
digitar(doc.querySelector('[data-fm-xprep]'), '9');
ok(/vai valer 3/.test($('#fm-rep-teto').textContent),
   'pedir 9 avisa que vai valer 3 — o corte é dito ANTES de salvar');
digitar(doc.querySelector('[data-fm-xprep]'), '1');
clicar(doc.querySelector('[data-fm-valor="META"]'));

/* ══ 5. O token {n} ══ */
console.log('\n-- o token {n} --');
ok(FM._resolverTitulo('Responder {n} questões', 5) === 'Responder 5 questões',
   '{n} vira o número');
ok(FM._resolverTitulo('Responder {N} questões', 5) === 'Responder 5 questões',
   '  maiúsculo também');
ok(FM._resolverTitulo('Fazer {n} de {n}', 3) === 'Fazer 3 de 3',
   '  e todas as ocorrências, não só a primeira');
ok(FM._resolverTitulo('Beber 8 copos', 8) === 'Beber 8 copos',
   'quem não usa o token não é tocado — a variável é ganho, não imposto');
ok(FM._resolverTitulo('Guardar {5} reais', 9) === 'Guardar {5} reais',
   'e {5} continua {5}: só {n} é sintaxe, o resto é texto do hunter');
ok(FM._resolverTitulo('Ler {n} páginas', null) === 'Ler __ páginas',
   'sem alvo o token vira um espaço visível, não some escondido');
/* Regex com /g guarda `lastIndex` entre chamadas — chamar duas vezes
   seguidas devolveria resultados diferentes se ele não fosse zerado. */
ok(FM._resolverTitulo('A {n} B', 2) === FM._resolverTitulo('A {n} B', 2),
   'chamar duas vezes dá o mesmo resultado (lastIndex zerado)');

/* ══ 6. A prévia ══ */
console.log('\n-- a prévia --');
const tit = $('#fm-titulo-input');
digitar(tit, 'Responder {n} questões de História');
const prev = $('#fm-rep-previa');
ok(!prev.hidden, 'escrever {n} acende a prévia');
ok(/informe o número/i.test(prev.textContent),
   '  e sem alvo ela pede o número em vez de mostrar lixo');
digitar(doc.querySelector('[data-fm-alvo]'), '5');
ok(/Responder 5 questões de História/.test(prev.textContent),
   'com o alvo, mostra o título final ao vivo');
digitar(doc.querySelector('[data-fm-alvo]'), '12');
ok(/Responder 12 questões/.test(prev.textContent), '  e acompanha cada tecla');
digitar(tit, 'Sem token nenhum');
ok(prev.hidden, 'sem {n} no título, a prévia se cala — não há o que prever');

/* ══ 7. A sugestão de contador ══ */
console.log('\n-- a sugestão de contador --');
w.__contadores = [
  { id: 1, nome: 'Questões', unidade: 'questões', total: 412 },
  { id: 2, nome: 'Flexões', unidade: 'flexões', total: 90 },
];
FM._contadores = w.__contadores;
FM._estado.titulo = 'Responder 5 questões de História';
FM._estado.contador_id = null;
FM._estado._contadorTocado = false;
FM._pintarContadores();
ok(FM._estado.contador_id === 1,
   'o lançador SUGERE "Questões" pelo título — confirmar é um olhar, escolher é trabalho');
ok(doc.querySelector('[data-fm-contador="1"]').classList.contains('sel'),
   '  e a sugestão já aparece marcada');
ok(/412/.test(doc.querySelector('[data-fm-contador="1"]').textContent),
   '  com o total, que é o que identifica o balde certo');

FM._estado.titulo = 'Fazer flexões';
FM._estado.contador_id = null; FM._estado._contadorTocado = false;
FM._pintarContadores();
ok(FM._estado.contador_id === 2, 'outro título, outra sugestão');

/* A sugestão CALA depois da escolha. */
clicar(doc.querySelector('[data-fm-contador="1"]'));
ok(FM._estado.contador_id === 1, 'escolher manualmente troca');
FM._estado.titulo = 'Fazer flexões de novo';
FM._pintarContadores();
ok(FM._estado.contador_id === 1,
   'e a partir daí o título NÃO remexe na escolha — o app não discorda do hunter');

clicar(doc.querySelector('[data-fm-contador=""]'));
ok(FM._estado.contador_id === null, '"Nenhum" é uma escolha legítima: conta só o dia');

ok(!!doc.querySelector('[data-fm-contador="novo"]'), 'há a opção de criar um novo');
ok(!chamadas.some(c => c[0] === 'POST' && c[1] === '/contadores'),
   '  mas escolher "criar" NÃO cria ainda — senão fechar o lançador deixaria órfãos');

/* ══ 8. O que vai no payload ══ */
console.log('\n-- o payload --');
async function salvar(mudar) {
  chamadas.length = 0;
  FM.abrir();
  await esperar(); await esperar();
  FM._contadores = w.__contadores;
  Object.assign(FM._estado, { natureza: 'REPETICAO', titulo: 'x' }, mudar);
  await FM._salvar();
  return chamadas.find(c => c[0] === 'CRIAR')?.[1];
}

let p = await salvar({ rep_modo: 'META', alvo_repeticoes: 5,
                       titulo: 'Responder {n} questões', contador_id: 1 });
ok(p.natureza === 'REPETICAO', 'natureza vai como REPETICAO');
ok(p.alvo_repeticoes === 5, 'o alvo vai (5)');
ok(p.titulo === 'Responder 5 questões',
   'e o TÍTULO VAI RESOLVIDO — o {n} morre aqui, não vaza para o resto do app');
ok(p.contador_id === 1, 'o contador escolhido vai');
ok(p.xp_por_repeticao === 0,
   'META não paga por clique: a recompensa é cumprir, não apertar');

p = await salvar({ rep_modo: 'BONUS', xp_por_repeticao: 2, contador_id: 2 });
ok(p.alvo_repeticoes === null, 'no BONUS o alvo vai nulo — é o que define o modo');
ok(p.xp_por_repeticao === 2, '  e o XP por clique vai');

/* Criar contador: só agora bate no servidor. */
chamadas.length = 0;
FM.abrir(); await esperar(); await esperar();
FM._contadores = w.__contadores;
Object.assign(FM._estado, { natureza: 'REPETICAO', rep_modo: 'BONUS',
                            titulo: 'Beber água', contador_id: 'novo' });
await FM._salvar();
const post = chamadas.find(c => c[0] === 'POST' && c[1] === '/contadores');
ok(!!post, 'escolher "criar novo" cria o contador NA HORA DE SALVAR');
ok(post[2].nome === 'Beber água', '  com o nome tirado do título');
ok(chamadas.find(c => c[0] === 'CRIAR')[1].contador_id === 77,
   '  e a rotina já nasce atrelada a ele');

/* ══ 9. A validação ══ */
console.log('\n-- a validação --');
chamadas.length = 0;
FM.abrir(); await esperar(); await esperar();
Object.assign(FM._estado, { natureza: 'REPETICAO', rep_modo: 'META',
                            titulo: 'Sem número', alvo_repeticoes: '' });
await FM._salvar();
ok(!chamadas.some(c => c[0] === 'CRIAR'),
   'META sem alvo NÃO salva — sem número o cartão não sabe em quantos se dividir');
ok(chamadas.some(c => c[0] === 'TOAST' && /n[úu]mero/i.test(c[1])),
   '  e diz por quê, em vez de falhar calado');

/* ══ 10. Editar traz de volta ══ */
console.log('\n-- editar --');
FM.abrir({ edicao: { id: 9, titulo: 'Responder 5 questões', tipo: 'DIARIA',
                     natureza: 'REPETICAO', alvo_repeticoes: 5, contador_id: 1,
                     xp_por_repeticao: 1 } });
await esperar(); await esperar();
ok(FM._estado.rep_modo === 'META', 'editar uma META volta em META');
ok(FM._estado.alvo_repeticoes === 5, '  com o alvo');
ok(FM._estado.contador_id === 1, '  e o contador');
ok(FM._estado._contadorTocado === true,
   '  e a sugestão fica calada: editar já é ter decidido');

FM.abrir({ edicao: { id: 9, titulo: 'Beber água', tipo: 'DIARIA',
                     natureza: 'REPETICAO', alvo_repeticoes: null,
                     xp_por_repeticao: 2 } });
await esperar(); await esperar();
ok(FM._estado.rep_modo === 'BONUS', 'e um sem alvo volta em BONUS');
ok(FM._estado.xp_por_repeticao === 2, '  com o XP por clique');

/* ══ 11. Nada de emoji ══ */
console.log('\n-- o alfabeto --');
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2190}-\u{27BF}\u{2B00}-\u{2BFF}\u{2600}-\u{26FF}]/u;
FM.abrir(); await esperar(); await esperar();
clicar(doc.querySelector('[data-fm-valor="REPETICAO"]'));
await esperar();
ok(!EMOJI.test($('#fm-bloco-repeticao').textContent), 'sem emoji no bloco');
ok($('#fm-bloco-repeticao').querySelector('svg'), '  e os ícones são SVG');

console.log(`\n=== ${testes - falhas}/${testes} ===`);
process.exit(falhas ? 1 : 0);

})();
