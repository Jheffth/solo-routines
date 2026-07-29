/* O cartão de PROTOCOLO (missão passiva) — a vigília e a barra.

   Três pedidos do Arquiteto, e um assert para cada:

     "a animação deve ser mais lenta"        -> 14s, contra 3,4s
     "não só no topo, em volta dele inteiro" -> perímetro em SVG
     "barra de progresso dentro dela"        -> enche sozinha, com aura

   O que NÃO dá para provar aqui: se ficou bonito. O que dá: que a
   moldura cerca, que o tracejado é responsivo, e que a barra reflete
   o tempo cumprido — e não o que falta.

   Uso:  node webapp/frontend/tests/teste_protocolo.js
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

const dom = new JSDOM('<!doctype html><body><div id="lista"></div></body>',
                      { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window, doc = w.document;
w.console = { log(){}, warn(){}, error(){} };
const ctx = vm.createContext(w);
vm.runInContext(ler('js', 'glifos.js'), ctx);
vm.runInContext(ler('js', 'missao-card.js'), ctx);
const MC = w.MissaoCard;
const css = ler('css', 'missao-card.css');
const semCom = t => t.replace(/\/\*[\s\S]*?\*\//g, '');
const cssCod = semCom(css);

/* Uma passiva no meio da vigília: 12h de janela, 4h24 já corridas. */
const EM_VIGOR = {
  id: 9102, titulo: 'Sem redes sociais entre 22h e 10h', categoria: 'Combate',
  prioridade: 'ALTA', dificuldade: 'DIFICIL', natureza: 'PASSIVA',
  xp_recompensa: 90, moedas_recompensa: 7, status: 'PENDENTE',
  prazo_ate_abrir: -4.4 * 3600, prazo_minutos: 720,
  prazo_restante: Math.round(720 * 60 * 0.634),
};
const AGUARDANDO = Object.assign({}, EM_VIGOR, {
  id: 9101, titulo: 'Sem cafeína após as 16h',
  prazo_ate_abrir: 3 * 3600, prazo_minutos: 780, prazo_restante: 780 * 60,
});
const COMUM = {
  id: 1, titulo: 'Ler 10 páginas', categoria: 'Estudo', prioridade: 'MEDIA',
  dificuldade: 'NORMAL', status: 'PENDENTE',
  prazo_minutos: 60, prazo_restante: 1800,
};

console.log('\n=== O CARTÃO DE PROTOCOLO ===\n');

MC.cachear([EM_VIGOR, AGUARDANDO, COMUM]);
const cx = doc.getElementById('lista');
cx.innerHTML = [EM_VIGOR, AGUARDANDO, COMUM].map(m => MC.html(m)).join('');

const cartao = (id) => cx.querySelector(`[data-mc-card="${id}"]`)
                    || [...cx.querySelectorAll('.mc')].find(c => c.textContent.includes(id));
const vigil = cx.querySelectorAll('.mc-passiva')[0];
const espera = cx.querySelectorAll('.mc-passiva')[1];
const comum  = [...cx.querySelectorAll('.mc')].find(c => !c.classList.contains('mc-passiva'));

/* ══ 1. "em volta dele inteiramente" ══ */
console.log('-- a vigília cerca, não encima --');
ok(cx.querySelectorAll('.mc-passiva').length === 2, 'os dois protocolos foram marcados como passivos');
ok(!comum.querySelector('.mc-vigia'), 'a missão comum NÃO ganha moldura de vigília');

const svg = vigil.querySelector('svg.mc-vigia');
ok(!!svg, 'o protocolo ganha uma moldura em SVG');
ok(svg.querySelectorAll('rect').length === 2,
   '  com duas camadas: o halo borrado e o traço nítido');
ok(/\.mc-vigia\s*\{[^}]*inset:\s*0/.test(cssCod),
   'ela ocupa o cartão INTEIRO (inset: 0), não uma faixa no topo');
ok(/\.mc-passiva \.mc-fio\s*\{\s*display:\s*none/.test(cssCod),
   'e a faixa antiga do topo foi desligada — senão seriam duas');

/* O TRACEJADO RESPONSIVO. `pathLength="100"` normaliza o contorno:
   sem ele, o traço de um cartão largo e o de um estreito teriam
   tamanhos diferentes — o mesmo protocolo com duas aparências. */
ok([...svg.querySelectorAll('rect')].every(r => r.getAttribute('pathLength') === '100'),
   'os retângulos usam pathLength="100": o tracejado não muda com a largura');
ok(svg.getAttribute('preserveAspectRatio') === 'none',
   '  e o SVG acompanha a caixa em vez de manter proporção');
ok(/vector-effect:\s*non-scaling-stroke/.test(cssCod),
   '  com traço que não engorda ao esticar');
ok(/stroke-dasharray:\s*2 2\.6/.test(cssCod), 'e o formato tracejado foi mantido');

/* ══ 2. "mais lenta" ══ */
console.log('\n-- mais lenta --');
const dur = /\.mc-vigia\.em-vigor \.mc-vigia-fio\s*\{[^}]*animation:[^;]*?(\d+(?:\.\d+)?)s/.exec(cssCod);
ok(dur && +dur[1] >= 12, `a volta leva ${dur ? dur[1] : '?'}s (a faixa antiga levava 3,4s)`);
ok(!/mc-vigilia 3\.4s/.test(cssCod), 'a animação antiga de 3,4s não existe mais');
ok(/@keyframes mc-vigilia\s*\{[^}]*stroke-dashoffset/.test(cssCod),
   'e ela anda por stroke-dashoffset — o tracejado corre pelo contorno');

/* Só corre quando VALE. Fora da janela o protocolo existe, parado. */
ok(svg.classList.contains('em-vigor'), 'em vigília, a moldura está acesa');
ok(!espera.querySelector('.mc-vigia').classList.contains('em-vigor'),
   'aguardando a hora, ela NÃO corre — existe apagada, que é a informação certa');

/* ══ 3. "barra de progresso dentro dela" ══ */
console.log('\n-- a barra que enche sozinha --');
const prot = vigil.querySelector('.mc-prot');
ok(!!prot, 'o protocolo tem barra própria');
ok(!comum.querySelector('.mc-prot'), '  e a missão comum continua com a barra fina de sempre');
ok(!!vigil.querySelector('.mc-prot-aura'), 'com AURA vazando da calha');
ok(!!vigil.querySelector('.mc-prot-cabeca'), 'e cabeça de luz na ponta');
ok(/\.mc-prot-calha\s*\{[^}]*overflow:\s*visible/.test(cssCod),
   'a calha é `overflow: visible` — sem isso a aura viraria só uma segunda barra');

/* O NÚMERO. A barra é lenta demais para se ver andar: numa vigília
   de 12h, um minuto move 0,14%. O texto é a prova de movimento. */
const pct = vigil.querySelector('[data-mc-prot-pct]');
ok(!!pct, 'e a porcentagem em texto');
const v = parseFloat(pct.textContent);
ok(v > 35 && v < 39, `mostra ${pct.textContent} — o CUMPRIDO, não o que falta`);
ok(/font-variant-numeric:\s*tabular-nums/.test(cssCod),
   '  com dígitos de largura fixa, senão o número dança a cada tique');

const largura = parseFloat(vigil.querySelector('.mc-prot-fill').style.width);
ok(Math.abs(largura - v) < 0.6, `a barra (${largura.toFixed(1)}%) bate com o número`);

const aguardaPct = parseFloat(espera.querySelector('[data-mc-prot-pct]').textContent);
ok(aguardaPct === 0, 'quem ainda não entrou em vigor está em 0%');
ok(/\.mc-passiva\.st-pendente \.mc-prot-cabeca\s*\{\s*display:\s*none/.test(cssCod),
   '  e sem a cabeça pulsando: prometer movimento parado seria mentir');

/* ══ 4. As duas camadas andam juntas ══ */
console.log('\n-- aura e corpo não se descolam --');
const fills = vigil.querySelectorAll('[data-mc-prot-fill]');
ok(fills.length === 2, 'aura e corpo carregam a mesma marca de preenchimento');
ok(fills[0].style.width === fills[1].style.width,
   '  e nascem com a MESMA largura');
const js = semCom(ler('js', 'missao-card.js'));
ok(/querySelectorAll\('\[data-mc-prot-fill\]'\)\.forEach/.test(js),
   'no tique, as duas são atualizadas juntas — senão o brilho descolaria');

/* ══ 5. Movimento reduzido ══ */
console.log('\n-- quem pediu menos movimento --');
const bloco = /prefers-reduced-motion[^{]*\{([\s\S]*?)\n\}/.exec(css);
ok(bloco && /\.mc-vigia rect/.test(bloco[1]), 'a vigília para de correr');
ok(bloco && /\.mc-prot-cabeca/.test(bloco[1]), '  e a cabeça para de pulsar');
ok(!/\.mc-vigia\s*\{\s*display:\s*none/.test(bloco ? bloco[1] : ''),
   'mas a moldura FICA: ela é informação, não enfeite');

/* ══ 6. Na Forja ══ */
console.log('\n-- a prévia na Forja --');
const forja = ler('js', 'arquiteto-console.js');
ok((forja.match(/natureza: 'PASSIVA'/g) || []).length === 3,
   'três protocolos entraram na vitrine do Cartão de Missão');
ok(/prazo_ate_abrir:\s*3 \* 3600/.test(forja), '  um aguardando a hora');
ok(/0\.634/.test(forja), '  um no meio da vigília');
ok(/0\.04/.test(forja), '  e um quase cumprido');
ok(/prazo_minutos/.test(forja) && /prazo_restante/.test(forja),
   'com os campos que o cartão REALMENTE lê — senão a prévia mentiria');

console.log(`\n=== ${testes - falhas}/${testes} ===`);
process.exit(falhas ? 1 : 0);
