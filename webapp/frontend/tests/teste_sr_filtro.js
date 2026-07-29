/* Os filtros do Extrato — SVG no lugar de emoji, sem perder o
   `<select>`.

   A promessa central deste componente é uma só: o `<select>`
   continua sendo A VERDADE. Se ela cair, o `_bindFiltrosExtrato` do
   Dashboard para de funcionar sem nenhum erro no console — e é por
   isso que a maior parte dos asserts aqui é sobre ELE, não sobre a
   aparência.

   Uso:  node webapp/frontend/tests/teste_sr_filtro.js
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

console.log('\n=== OS FILTROS DO EXTRATO ===\n');

const dom = new JSDOM(ler('index.html'),
  { pretendToBeVisual: true, runScripts: 'outside-only', url: 'http://localhost/' });
const w = dom.window, doc = w.document;
w.console = { log(){}, warn(){}, error(){} };
const ctx = vm.createContext(w);
vm.runInContext(ler('js', 'glifos.js'), ctx);
vm.runInContext(ler('js', 'sr-filtro.js'), ctx);
const SF = w.SrFiltro;

/* ══ 1. Nenhum emoji sobrou ══ */
console.log('-- o emoji acabou --');
const html = ler('index.html');
const bloco = html.slice(html.indexOf('id="extrato-filtros"'),
                         html.indexOf('id="lista-rotinas-hoje"'));
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2190}-\u{27BF}\u{2B00}-\u{2BFF}\u{2600}-\u{26FF}]/u;
ok(!EMOJI.test(bloco), 'nenhum emoji na barra de filtros');
const opcoes = [...bloco.matchAll(/<option[^>]*>/g)];
ok(opcoes.length === 27, `as ${opcoes.length} opções continuam lá`);
ok(opcoes.every(o => /data-glifo="/.test(o[0])),
   'e TODAS declaram um glifo do alfabeto');

/* Cada glifo declarado tem que existir de verdade — um nome errado
   viraria o círculo de reserva silenciosamente. */
const nomes = [...bloco.matchAll(/data-glifo="([^"]+)"/g)].map(m => m[1]);
const orfaos = [...new Set(nomes)].filter(n => !w.Glifos.existe(n));
ok(orfaos.length === 0,
   `os ${new Set(nomes).size} nomes usados existem no alfabeto${orfaos.length ? ' — órfãos: ' + orfaos : ''}`);

/* O MESMO alfabeto do cartão de missão. Dois desenhos para o mesmo
   conceito é como se perde um alfabeto. */
ok(w.Glifos.existe('saude') && w.Glifos.existe('combate'),
   'e é o mesmo alfabeto que o cartão usa (saude, combate…)');

/* ══ 2. O <select> continua sendo a verdade ══ */
console.log('\n-- o <select> não foi embora --');
SF.montarTodos(doc.getElementById('extrato-filtros'));
const sel = doc.getElementById('filtro-tipo');
ok(!!sel && sel.tagName === 'SELECT', '#filtro-tipo continua sendo um <select> de verdade');
ok(sel.options.length === 6, '  com as 6 opções');
ok(sel.closest('.srf') !== null, 'e agora mora dentro do componente');
ok(sel.classList.contains('srf-nativo'), '  escondido, mas NO documento');

const css = ler('css', 'sr-filtro.css');
ok(!/\.srf-nativo\s*\{[^}]*display:\s*none/.test(css),
   'escondido por clip, NÃO por display:none — que o tiraria do formulário e do teclado');

/* ══ 3. Escolher dispara `change` — a linha que faz tudo funcionar ══ */
console.log('\n-- escolher --');
const caixa = sel.closest('.srf');
let mudou = 0, valorNoEvento = null;
sel.addEventListener('change', () => { mudou++; valorNoEvento = sel.value; });

const itens = caixa.querySelectorAll('.srf-item');
ok(itens.length === 6, 'a lista desenhada tem as mesmas 6 opções');
ok(itens[1].querySelector('svg'), '  cada uma com SVG, não com texto de emoji');

itens[3].dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
ok(sel.value === 'MENSAL', `clicar na 4ª opção muda o <select> (${sel.value})`);
ok(mudou === 1, 'e DISPARA `change` — mexer em selectedIndex por código não dispara sozinho');
ok(valorNoEvento === 'MENSAL', '  já com o valor novo quando o Extrato lê');

/* Escolher a mesma de novo não deve gerar consulta à toa. */
const antes = mudou;
caixa.querySelectorAll('.srf-item')[3].dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
ok(mudou === antes, 'reescolher a mesma opção não dispara `change` de novo');

/* ══ 4. Mudar por fora reflete na interface ══ */
console.log('\n-- mudança vinda de fora --');
sel.value = 'DIARIA';
sel.dispatchEvent(new w.Event('change', { bubbles: true }));
ok(caixa.querySelector('.srf-rotulo').textContent === 'Diária',
   'mexer no <select> por código (console, "limpar filtros") atualiza o botão');
ok(caixa.querySelector('.srf-item[data-i="1"]').dataset.sel === '1',
   '  e o tique acompanha');

/* ══ 5. O filtro ativo se anuncia ══ */
console.log('\n-- filtro ativo --');
ok(caixa.classList.contains('srf-ativo'),
   'com valor diferente do "todos", o filtro se marca como ativo');
sel.value = '';
sel.dispatchEvent(new w.Event('change', { bubbles: true }));
ok(!caixa.classList.contains('srf-ativo'),
   'e volta ao normal no "Todos os tipos" — senão o hunter olha uma lista');
ok(/\.srf-ativo\s+\.srf-botao::after/.test(css),
   '  o sinal é um ponto no canto, não um "×" roubando o clique de abrir');

/* ══ 6. Teclado ══ */
console.log('\n-- teclado --');
const inst = caixa.__srf;
SF.abrir(inst);
ok(!inst.lista.hidden, 'abre');
ok(inst.botao.getAttribute('aria-expanded') === 'true', '  e avisa o leitor de tela');
inst.lista.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
inst.lista.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
ok(sel.selectedIndex === 1, 'seta + Enter escolhem');
SF.abrir(inst);
inst.lista.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
ok(inst.lista.hidden, 'Esc fecha');
ok(sel.selectedIndex === 1, '  sem mudar a escolha');

/* ══ 7. Um menu de cada vez ══ */
console.log('\n-- dois filtros não ficam abertos juntos --');
const outro = doc.getElementById('filtro-status-missao').closest('.srf').__srf;
SF.abrir(inst); SF.abrir(outro);
ok(inst.lista.hidden && !outro.lista.hidden,
   'abrir um fecha o outro — senão o clique fora de um é o clique dentro do outro');
SF.fechar(outro);

/* ══ 8. Montar duas vezes não duplica ══ */
console.log('\n-- idempotência --');
const antesN = doc.querySelectorAll('.srf').length;
SF.montarTodos(doc.getElementById('extrato-filtros'));
ok(doc.querySelectorAll('.srf').length === antesN,
   `montar de novo não duplica (${antesN} filtros) — o Dashboard recarrega`);

/* ══ 9. A promessa: o Dashboard não mudou ══ */
console.log('\n-- o Dashboard não precisou saber de nada --');
/* SEM OS COMENTÁRIOS. Terceira vez que esta armadilha morde neste
   projeto: o comentário EXPLICA o componente, então contá-lo no
   texto cru acusa exatamente a prova de que a explicação existe. */
const semCom = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const dash = semCom(ler('js', 'pages', 'dashboard.js'));
ok(/filtro-periodo/.test(dash),
   'o dashboard.js continua lendo os filtros pelos mesmos ids');
/* UMA LINHA, não uma ocorrência: a linha cita `SrFiltro` duas vezes
   porque tem a guarda `typeof ... !== 'undefined'` — obrigatória
   neste projeto, onde um `const` de topo em script clássico NÃO
   vira propriedade de window e some se o arquivo não carregar. */
const linhasComFiltro = dash.split('\n').filter(l => l.includes('SrFiltro'));
ok(linhasComFiltro.length === 1,
   'e o toca em UMA linha só: mandar montar, e mais nada');
ok(/typeof SrFiltro !== 'undefined'/.test(linhasComFiltro[0] || ''),
   '  com guarda: se o arquivo não carregar, o Extrato continua de pé');

const fonte = ler('js', 'sr-filtro.js');
const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
ok(!/Dashboard|Extrato/.test(codigo),
   'e o componente não conhece o Dashboard — serve qualquer <select class="sr-filtro">');
ok(/dispatchEvent\(new Event\('change'/.test(codigo),
   'o `change` é disparado à mão, que é a linha de que tudo depende');

console.log(`\n=== ${testes - falhas}/${testes} ===`);
process.exit(falhas ? 1 : 0);
