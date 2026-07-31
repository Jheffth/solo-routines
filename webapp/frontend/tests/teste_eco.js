/* O ECO DO SISTEMA — o momento em que ele toma a tela.

   ESTE TESTE TEM UM LIMITE, e ele precisa estar escrito: o Eco é a
   primeira peça deste projeto cuja QUALIDADE não é mensurável. Dá para
   provar que ele aparece, que enfileira, que fecha no Esc e que
   respeita `reduced-motion`. Não dá para provar que é bonito, nem que
   a frase dá o arrepio certo.

   O que se prova aqui é o que quebraria em silêncio:

   · a tela não fica PRETA — o cartão fracassado continua atrás, e é
     isso que faz o Sistema "fazer você olhar" em vez de te tirar do
     lugar;
   · dois ecos não se sobrepõem;
   · sempre há saída (Esc, Enter, clique);
   · o som é BÔNUS: sem áudio, o Eco não muda em nada;
   · a mesma coreografia no celular e no monitor — foi a falta disso
     que escondeu o efeito do Arquiteto por meses.

   Uso:  node webapp/frontend/tests/teste_eco.js
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

console.log('\n=== O ECO DO SISTEMA ===\n');

const dom = new JSDOM('<!doctype html><body><div id="fundo">cartão fracassado</div></body>',
  { pretendToBeVisual: true, runScripts: 'outside-only', url: 'http://localhost/' });
const w = dom.window, doc = w.document;
w.console = { log(){}, warn(){}, error(){} };

/* Dublê de áudio: registra as tentativas sem tocar nada. */
const tocou = [];
w.Audio = function (src) { this.src = src; this.volume = 1;
  this.play = () => { tocou.push(src); return Promise.resolve(); }; };
w.SFX = { play: (n) => tocou.push('sfx:' + n) };

const ctx = vm.createContext(w);
vm.runInContext(ler('js', 'eco.js'), ctx);
const Eco = vm.runInContext('Eco', ctx);
const css = ler('css', 'eco.css');

const esperar = ms => new Promise(r => setTimeout(r, ms));
const $ = s => doc.querySelector(s);

(async () => {

/* ══ 1. Ele aparece ══ */
console.log('-- o Eco entra --');
Eco.mostrar({ texto: 'O Sistema registra.', intensidade: 'SECA' });
ok(!!$('.eco'), 'o Eco aparece no documento');
ok($('.eco-frase').textContent === 'O Sistema registra.', 'com a frase pedida');
ok($('.eco').classList.contains('eco-seca'), 'e marcado pela intensidade');
ok(!!$('.eco-veu'), 'tem o véu');
ok(!!$('.eco-marca svg'), 'e o sigilo em SVG, não emoji');

/* A TELA NÃO FICA PRETA — é o detalhe que faz o efeito funcionar.
   O véu embaça e escurece; o que está atrás continua no documento. */
ok(!!doc.getElementById('fundo'),
   'o que estava atrás CONTINUA lá — o Sistema não te tira do lugar, te faz olhar');
ok(/backdrop-filter:\s*blur/.test(css),
   'e o véu EMBAÇA em vez de cobrir: é isso que mantém o cartão visível e ilegível');
ok(!/\.eco-veu\s*\{[^}]*background:\s*#000/.test(css),
   'nada de preto sólido');

/* ══ 2. A coreografia existe ══ */
console.log('\n-- a frase se assenta --');
const bloco = re => { const m = re.exec(css.replace(/\/\*[\s\S]*?\*\//g, '')); return m ? m[1] : ''; };
const frase = bloco(/\.eco-frase\s*\{([^}]*)\}/);
ok(/letter-spacing:\s*\.34em/.test(frase),
   'a frase começa ESPAÇADA (.34em) e se aproxima — sem isso ela só "aparece"');
ok(/\.eco\.on\s+\.eco-frase\s*\{[^}]*letter-spacing:\s*\.1em/.test(css),
   '  fechando em .1em');
ok(/transition:[^;]*letter-spacing/.test(frase),
   '  e é transição, não corte');
ok(/@keyframes\s+eco-respira/.test(css),
   'a frase RESPIRA depois de assentar — parada, pareceria uma imagem');
ok(/clamp\(/.test(frase),
   'o tamanho usa clamp: mesma leitura no celular e no monitor');

/* ══ 3. Sempre há saída ══ */
console.log('\n-- sempre há saída --');
$('.eco').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
await esperar(60);
ok($('.eco').classList.contains('saindo'), 'clicar em qualquer lugar fecha');
await esperar(900);
ok(!$('.eco'), '  e o nó some depois da saída');

Eco.mostrar({ texto: 'De novo.', intensidade: 'SECA' });
doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
await esperar(60);
ok($('.eco').classList.contains('saindo'), 'Esc fecha');
await esperar(900);

Eco.mostrar({ texto: 'E de novo.', intensidade: 'SECA' });
doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
await esperar(60);
ok($('.eco').classList.contains('saindo'),
   'Enter também — um efeito bonito que prende deixa de ser bonito na terceira vez');
await esperar(900);

/* ══ 4. Fila, nunca sobreposição ══ */
console.log('\n-- fila --');
Eco.mostrar({ texto: 'Primeiro',  intensidade: 'SECA' });
Eco.mostrar({ texto: 'Segundo',   intensidade: 'ENCARANDO' });
Eco.mostrar({ texto: 'Terceiro',  intensidade: 'FRIA' });
ok(doc.querySelectorAll('.eco').length === 1,
   'três pedidos, UM na tela — sobrepostos virariam ruído');
ok($('.eco-frase').textContent === 'Primeiro', '  o primeiro da fila');
ok(Eco.naFila() === 2, '  e dois esperando');

Eco.fechar();
ok(!$('.eco'), 'fechar() limpa a tela');
ok(Eco.naFila() === 0, '  e esvazia a fila');

/* ══ 5. O som é bônus, nunca a peça ══ */
console.log('\n-- o som --');
tocou.length = 0;
Eco.mostrar({ texto: 'Com som', intensidade: 'SECA' });
await esperar(500);
ok(tocou.length > 0, 'o sussurro é disparado');
ok(tocou.some(t => /sussurro/.test(t)), `  pelo nome certo (${tocou[0]})`);
Eco.fechar();

tocou.length = 0;
Eco.mostrar({ texto: 'Sem som', intensidade: 'SECA', som: false });
await esperar(500);
ok(tocou.length === 0, '`som: false` não toca nada');
ok(!!$('.eco-frase'), '  e o Eco continua exatamente igual — o áudio é bônus');
Eco.fechar();

/* O arquivo tem que existir de verdade. */
ok(fs.existsSync(path.join(RAIZ, 'sounds', 'sussurro.mp3')),
   'o arquivo sussurro.mp3 está em /sounds/');

/* ══ 6. Acessibilidade ══ */
console.log('\n-- acessibilidade --');
Eco.mostrar({ texto: 'Anunciado', intensidade: 'FRIA' });
ok($('.eco').getAttribute('aria-live') === 'assertive',
   'aria-live=assertive: é o único lugar do app onde interromper é o certo');
ok($('.eco').getAttribute('role') === 'status', '  com role de status');
ok($('.eco-marca').getAttribute('aria-hidden') === 'true',
   'e o sigilo é decorativo — o leitor de tela não lê "svg"');
Eco.fechar();

const semCom = css.replace(/\/\*[\s\S]*?\*\//g, '');
const reduz = semCom.slice(semCom.indexOf('prefers-reduced-motion'));
ok(/animation:\s*none/.test(reduz) && /transition:\s*none/.test(reduz),
   'sem movimento, quando o sistema operacional pede');
ok(/letter-spacing:\s*\.1em/.test(reduz),
   '  e a frase fica no estado FINAL, não no inicial — senão ficaria ilegível');

/* ══ 7. Injeção ══ */
console.log('\n-- injeção --');
Eco.mostrar({ texto: '<img src=x onerror=alert(1)>', intensidade: 'SECA' });
ok(!$('.eco img'), 'a frase é escapada — ela vem do servidor, mas confiar é opcional');
Eco.fechar();

/* ══ 8. Bordas ══ */
console.log('\n-- bordas --');
Eco.mostrar({});
ok(!$('.eco'), 'sem texto, não mostra nada em vez de mostrar uma caixa vazia');
Eco.mostrar(null);
ok(!$('.eco'), 'null também não explode');
Eco.mostrar({ texto: 'Intensidade inventada', intensidade: 'BANANA' });
ok(!!$('.eco'), 'intensidade desconhecida ainda mostra');
ok($('.eco').classList.contains('eco-banana'),
   '  com a classe correspondente (o CSS cai no padrão)');
Eco.fechar();

/* ══ 9. Celular e monitor ══ */
console.log('\n-- o celular e o monitor --');
/* O efeito que o Arquiteto amou era um ACIDENTE: `dg-col-feed` virava
   largura inteira abaixo de 1100px. Aqui o Eco é `position: fixed;
   inset: 0` — tela cheia nos dois, por desenho. */
ok(/\.eco\s*\{[^}]*position:\s*fixed/.test(css) &&
   /\.eco\s*\{[^}]*inset:\s*0/.test(css),
   'tela cheia por DESENHO, não por acidente de grid');
const mobile = semCom.slice(semCom.indexOf('max-width: 520px'));
ok(mobile.length > 0, 'há ajuste para o celular');
ok(!/display:\s*none/.test(mobile),
   '  e ele ajusta o respiro, sem esconder nada — foi esconder que causou o problema original');

console.log(`\n=== ${testes - falhas}/${testes} ===`);
process.exit(falhas ? 1 : 0);

})();
