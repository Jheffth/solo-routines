/* Teste de contrato do registro de peças.

   Roda pecas.js num DOM de verdade (jsdom) e verifica as promessas
   que o arquivo faz — sobretudo a mais importante: que uma peça
   DESLEIXADA, que nunca implementa destruir(), ainda assim não vaza
   nada. É o teste que teria pego o vazamento do carrossel da V4.

   Uso:  npm i jsdom  &&  node webapp/frontend/tests/teste_pecas.js
   (o unico requisito e o jsdom; nao ha build nem framework)
*/
const fs = require('fs');
const { JSDOM } = require('jsdom');
const vm = require('vm');

const CAMINHO = require('path').join(__dirname, '..', 'js', 'pecas.js');

const dom = new JSDOM('<!doctype html><body><div id="slot" data-slot="banner"></div></body>',
                      { pretendToBeVisual: true });
const w = dom.window;

let falhas = 0, testes = 0;
function ok(cond, msg) {
  testes++;
  if (!cond) falhas++;
  console.log((cond ? '  [ok]  ' : '  [XX]  ') + msg);
}
const espera = ms => new Promise(r => setTimeout(r, ms));

// Silenciar os avisos esperados, mas CONTAR: vários testes checam
// justamente que o registro reclamou.
const log = { warn: [], error: [] };
w.console = {
  log: () => {},
  warn: (...a) => log.warn.push(a.join(' ')),
  error: (...a) => log.error.push(a.join(' ')),
};

const ctx = vm.createContext(w);
vm.runInContext(fs.readFileSync(CAMINHO, 'utf8'), ctx);
const P = w.Pecas;
const doc = w.document;
const el = doc.getElementById('slot');

async function main() {
console.log('\n=== O REGISTRO DAS PEÇAS ===\n');

/* ── 1. Validação na carga ───────────────────────────────── */
console.log('-- validação --');
ok(P.registrar({ id: 'a', nome: 'A', familia: 'banner', montar() {} }) === true,
   'uma peça bem formada é aceita');
ok(P.registrar({ id: 'b', nome: 'B', familia: 'banner' }) === false,
   'sem montar() é REJEITADA na carga (não fica para estourar depois)');
ok(P.registrar({ nome: 'C', familia: 'banner', montar() {} }) === false,
   'sem id é rejeitada');
ok(P.registrar(null) === false, 'null não derruba o registro');
ok(P.existe('a') && !P.existe('b'), 'só a válida entrou no registro');

/* ── 2. Padrão da família ────────────────────────────────── */
console.log('\n-- padrão da família --');
P.registrar({ id: 'classico', nome: 'Clássico', familia: 'banner', padrao: true,
              precisa: ['hunter'],
              montar(el, d) { el.innerHTML = `<b>${(d.hunter || {}).nome || '?'}</b>`; } });
ok(P.padraoDa('banner').id === 'classico', 'a padrão da família é encontrada');
P.registrar({ id: 'outra', nome: 'Outra', familia: 'banner', padrao: true, montar() {} });
ok(P.padraoDa('banner').id === 'classico',
   'uma SEGUNDA padrão não rouba o posto (ambiguidade evitada)');
ok(log.warn.some(m => m.includes('NÃO virou padrão')), '  e o registro avisou');

/* ── 3. Montagem básica ──────────────────────────────────── */
console.log('\n-- montagem --');
const inst = P.montar(el, 'classico', { hunter: { nome: 'Jh3ffth' } });
ok(inst !== null, 'a peça monta');
ok(el.innerHTML.includes('Jh3ffth'), '  e desenhou com os dados que recebeu');
ok(el.dataset.peca === 'classico', '  o contêiner registra qual peça está nele');

/* ── 4. `precisa` avisa, mas não impede ──────────────────── */
console.log('\n-- contrato de dados --');
log.warn.length = 0;
P.montar(el, 'classico', {});
ok(log.warn.some(m => m.includes('pediu [hunter]')),
   'dado declarado e não entregue vira AVISO');
ok(el.innerHTML.includes('?'), '  e a peça monta assim mesmo (nada de tela branca)');

/* ── 5. O VAZAMENTO — o teste que importa ────────────────── */
console.log('\n-- a peça desleixada (o caso do carrossel da V4) --');
let batidas = 0;
P.registrar({
  id: 'carrossel', nome: 'Carrossel', familia: 'banner',
  montar(el, d, host) {
    host.intervalo(() => { batidas++; }, 5);   // o carrossel da V4
    host.espera(() => {}, 100000);
    host.ouvir(w, 'resize', () => {});
    el.innerHTML = 'girando';
  },
  // destruir() NÃO existe, de propósito. É exatamente o ponto.
});
P.montar(el, 'carrossel', {});
let d = P.diagnostico();
ok(d.intervalos === 1 && d.esperas === 1 && d.ouvintes === 1,
   'com a peça viva: 1 intervalo, 1 espera, 1 ouvinte rastreados');

await espera(60);
const girou = batidas;
ok(girou > 0, `o intervalo estava mesmo girando (${girou} batidas)`);

P.desmontar(el);
d = P.diagnostico();
ok(d.vivas === 0, 'desmontada: nenhuma instância viva');
ok(d.intervalos === 0 && d.esperas === 0 && d.ouvintes === 0,
   'ZERO timers e ouvintes sobraram — MESMO sem a peça ter destruir()');

await espera(60);
ok(batidas === girou,
   `e ele PAROU de verdade: parou em ${girou} e ficou nelas após 60ms`);

/* ── 6. Fallback ─────────────────────────────────────────── */
console.log('\n-- queda para a padrão --');
P.registrar({ id: 'quebrada', nome: 'Quebrada', familia: 'banner',
              montar() { throw new Error('estourei'); } });
log.error.length = 0;
const i2 = P.montar(el, 'quebrada', { hunter: { nome: 'Jh3ffth' } });
ok(i2 !== null && i2.peca.id === 'classico',
   'peça que estoura cai para a padrão da família');
ok(el.innerHTML.includes('Jh3ffth'), '  e o hunter vê o cartão de sempre, não um buraco');
ok(log.error.some(m => m.includes('estourou em montar')), '  o erro foi registrado');

const i3 = P.montar(el, 'nao-existe-essa', { hunter: { nome: 'X' } }, { familia: 'banner' });
ok(i3 !== null && i3.peca.id === 'classico', 'peça inexistente também cai para a padrão');

/* ── 7. Troca no mesmo lugar ─────────────────────────────── */
console.log('\n-- troca de peça no mesmo contêiner --');
P.montar(el, 'carrossel', {});
ok(P.diagnostico().intervalos === 1, 'carrossel montado, 1 intervalo');
P.montar(el, 'classico', { hunter: { nome: 'Jh3ffth' } });
d = P.diagnostico();
ok(d.vivas === 1 && d.intervalos === 0,
   'trocar de peça desmonta a anterior — o timer dela não sobrevive à troca');

/* ── 8. destruir() com defeito não contamina ─────────────── */
console.log('\n-- destruir() defeituoso --');
P.registrar({ id: 'suicida', nome: 'Suicida', familia: 'banner',
              montar(el, d, host) { host.intervalo(() => {}, 10); },
              destruir() { throw new Error('estourei ao morrer'); } });
P.montar(el, 'suicida', {});
log.error.length = 0;
P.desmontar(el);
ok(P.diagnostico().intervalos === 0,
   'destruir() estourou e MESMO ASSIM o timer foi recolhido');
ok(log.error.some(m => m.includes('estourou em destruir')), '  com o erro registrado');

/* ── 9. A inversão de dependência ────────────────────────── */
console.log('\n-- a peça não conhece o hospedeiro --');
let pedido = null;
P.registrar({ id: 'com-botao', nome: 'Com botão', familia: 'banner',
              montar(el, d, host) {
                // `el.innerHTML +=` reanalisa o HTML e RECRIA os nós: o botão
                // voltaria sem o onclick. insertAdjacentHTML preserva.
                el.innerHTML = '<button data-acao="trocar-aura">aura</button>';
                el.insertAdjacentHTML('beforeend', `<i id="${host.id('grad')}"></i>`);
                el.querySelector('button').onclick = () => host.acao('trocar-aura', 7);
              } });
P.montar(el, 'com-botao', {}, { acoes: { 'trocar-aura': (n) => { pedido = n; return 'feito'; } } });
el.querySelector('button').click();
ok(pedido === 7, 'a peça pede a ação e o HOSPEDEIRO executa');
ok(!el.innerHTML.includes('dash-'), '  e ela não escreveu nenhum id do Dashboard');
ok(/id="pc\d+-grad"/.test(el.innerHTML), '  ids próprios saem carimbados por instância');

log.warn.length = 0;
el.__peca.host.acao('acao-que-nao-existe');
ok(log.warn.some(m => m.includes('não oferece')),
   'pedir ação que o hospedeiro não tem avisa em vez de quebrar');

/* ── 10. host.quadro() se desliga sozinho ────────────────── */
console.log('\n-- o laço de animação --');
let quadros = 0;
P.registrar({ id: 'animada', nome: 'Animada', familia: 'banner',
              montar(el, d, host) { host.quadro(() => { quadros++; }); } });
P.montar(el, 'animada', {});
await espera(60);
const rodou = quadros;
ok(rodou > 0, `o laço de quadros rodou (${rodou} quadros)`);
P.desmontar(el);
await espera(60);
ok(quadros === rodou, `e parou no desmonte (ficou em ${rodou})`);

// O segundo freio: `return false` encerra um laço finito.
let finitos = 0;
P.registrar({ id: 'finita', nome: 'Finita', familia: 'banner',
              montar(el, d, host) { host.quadro(() => { finitos++; return finitos < 3; }); } });
P.montar(el, 'finita', {});
await espera(60);
ok(finitos === 3, `'return false' encerra o laço no ponto certo (parou em ${finitos})`);
ok(P.diagnostico().quadros === 0, '  e não deixa quadro pendurado');
P.desmontar(el);

// O terceiro freio: o contêiner sai do DOM sem ninguém desmontar.
const orfao = doc.createElement('div');
doc.body.appendChild(orfao);
let orfaos = 0;
P.registrar({ id: 'orfa', nome: 'Órfã', familia: 'banner',
              montar(el, d, host) {
                host.quadro(() => { orfaos++; });
                host.ouvir(w, 'resize', () => {});   // o perigoso: vive em window
              } });
P.montar(orfao, 'orfa', {});
await espera(40);
const antesDeArrancar = orfaos;
orfao.remove();                       // arrancado, sem desmontar
await espera(60);
ok(orfaos === antesDeArrancar,
   'contêiner arrancado do DOM: o laço percebe e se desliga sozinho');
// Mas o ouvinte em `window` NÃO se desliga sozinho — daí a coleta.
ok(P.diagnostico().vivas === 0,
   'e a instância órfã é COLETADA: o ouvinte de window não fica pendurado');

/* ── 11. Repintura ───────────────────────────────────────── */
console.log('\n-- repintura --');
let pinturas = 0;
P.registrar({ id: 'repintavel', nome: 'Repintável', familia: 'banner',
              montar(el, d) { el.innerHTML = `<b>${d.n || 0}</b>`; },
              atualizar(el, d) { pinturas++; el.querySelector('b').textContent = d.n; } });
P.montar(el, 'repintavel', { n: 1 });
const noAntes = el.querySelector('b');
P.atualizar(el, { n: 2 });
ok(el.querySelector('b') === noAntes, 'quem tem atualizar() repinta o MESMO nó (não pisca)');
ok(el.querySelector('b').textContent === '2' && pinturas === 1, '  e o dado novo entrou');

P.registrar({ id: 'burra', nome: 'Burra', familia: 'banner',
              montar(el, d) { el.innerHTML = `<i>${d.n || 0}</i>`; } });
P.montar(el, 'burra', { n: 1 });
const noBurro = el.querySelector('i');
P.atualizar(el, { n: 2 });
ok(el.querySelector('i') !== noBurro && el.querySelector('i').textContent === '2',
   'quem NÃO tem atualizar() é remontada — correto, só que piscando');
ok(P.diagnostico().vivas === 1, '  e a remontagem não deixa duas instâncias vivas');
P.desmontar(el);

/* ── 12. Este arquivo não desenha nada sozinho ───────────── */
console.log('\n-- inércia --');
const fonte = fs.readFileSync(CAMINHO, 'utf8');

// TIRAR OS COMENTÁRIOS ANTES DE PROCURAR. Esta armadilha já mordeu uma
// vez neste projeto: o cabeçalho do arquivo EXPLICA por que a peça não
// pode escrever `dash-btn-trocar-aura`, então a busca no texto cru
// encontra justamente a prova de que o problema foi evitado, e acusa.
const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

ok(typeof w.Pecas === 'object', 'Pecas está em window (script clássico, como Glifos e Gemas)');
ok(!/document\.getElementById|document\.querySelector\(/.test(codigo),
   'pecas.js não busca NENHUM elemento da página por conta própria');
ok(!/dash-|hunter-card|pt-v4|est-/.test(codigo),
   'e o CÓDIGO não menciona nenhum id do Dashboard nem da Vitrine');
ok(/dash-btn-trocar-aura/.test(fonte),
   '  (mas o comentário menciona: a lição está registrada onde se lê)');

/* ── 12. Estado final ────────────────────────────────────── */
P.desmontarTodas();
const fim = P.diagnostico();
console.log('\n-- estado final --');
ok(fim.vivas === 0 && fim.intervalos === 0 && fim.esperas === 0 &&
   fim.quadros === 0 && fim.ouvintes === 0,
   'desmontarTodas() zera tudo');

console.log(`\n=== ${testes - falhas}/${testes} ===`);
if (falhas) process.exit(1);
}

main();
