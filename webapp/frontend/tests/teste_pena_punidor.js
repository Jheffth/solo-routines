/* A PENA DO PUNIDOR — insígnia, aura e registro.

   Este arquivo nasceu de um erro específico e vale documentá-lo, porque
   ele se repete sozinho quando ninguém mede: a primeira Aura do Punidor
   era a Fênix RENOMEADA. Bastou pôr as classes lado a lado para ver.

       fnx-r1 fnx-r2 fnx-r3 fnx-r4  ·  fnx-halo  ·  fnx-pulse
       pnp-r1 pnp-r2 pnp-r3 pnp-r4  ·  pnp-halo  ·  pnp-pulse

   Trocar a cor não resolvia, porque a cor nunca foi o problema. O
   problema é que TODAS as auras deste app falam a mesma gramática:
   coisas dispostas em raio, girando — e a rotação vem de um keyframe
   GLOBAL, `aura-girar`, usado por arquiteto (4x), admin (4x),
   pink-spirit (3x) e fenix (4x).

   Então o teste central aqui não é "a aura é bonita" — isso nenhum
   assert alcança. É "a aura não fala a língua das outras", e isso é
   mensurável: zero classes em comum, zero keyframes em comum, zero
   `aura-girar`.

   ARMADILHA JÁ PAGA — não reintroduzir: a primeira versão deste teste
   afirmava "a Fênix gira" olhando `rotate(` DENTRO do <style> dela.
   Passava vazio, porque o `rotate(` da Fênix está no atributo
   `transform` de paths estáticos (que só POSICIONA as chamas em raio),
   e a rotação de verdade vem do `aura-girar`. O controle estava errado,
   não o código. Todo assert de diferença aqui tem um par que prova que
   o teste sabe distinguir.

   Uso:  node webapp/frontend/tests/teste_pena_punidor.js
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');
const ler = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');

let falhas = 0, testes = 0;
function ok(cond, msg) {
  testes++; if (!cond) falhas++;
  console.log((cond ? '  [ok]  ' : '  [XX]  ') + msg);
}

/* auras.js é script clássico: `const Auras = {...}` NÃO vira propriedade
   de window. Só `vm.runInContext('Auras', ctx)` alcança. */
const ctx = vm.createContext({ window: {}, document: {}, console });
vm.runInContext(ler('js', 'auras.js'), ctx);
const Auras = vm.runInContext('Auras', ctx);

const pnp = Auras._registro['pena-punidor'](260);
const fnx = Auras._registro['fenix-pioneira'](260);

const classes = s => new Set(
  [...s.matchAll(/class="([a-z0-9 _-]+)"/g)].flatMap(m => m[1].split(' ')).filter(Boolean));
const keyframes = s => [...s.matchAll(/@keyframes ([a-z0-9-]+)/g)].map(m => m[1]);
const cPnp = classes(pnp), kPnp = keyframes(pnp);

console.log('\n-- a aura existe e desenha --');
ok(typeof Auras._registro['pena-punidor'] === 'function', 'registrada em Auras');
ok(pnp.trim().startsWith('<svg') && pnp.trim().endsWith('</svg>'), 'SVG bem formado');
ok(pnp.includes('viewBox="0 0 300 300"'), 'viewBox 300 — mesma caixa das irmãs');
ok(pnp.includes('class="aura-svg"'), 'classe aura-svg (o contrato do slot)');
ok(Auras._registro['pena-punidor'](77).includes('width="77"'), 'respeita o tamanho pedido');

console.log('\n-- NÃO fala a língua das outras --');
ok(!pnp.includes('aura-girar'), 'a Pena não usa aura-girar');
ok((fnx.match(/aura-girar/g) || []).length === 4,
   'a Fênix usa aura-girar 4x — o teste sabe distinguir');
ok(!/rotate\s*\([^)]*\)/.test(pnp.slice(pnp.indexOf('<style>'), pnp.indexOf('</style>'))),
   'nada gira dentro do <style> da Pena');
for (const id of Object.keys(Auras._registro)) {
  if (id === 'pena-punidor') continue;
  const outra = Auras._registro[id](260), cOutra = classes(outra);
  ok([...cPnp].filter(c => cOutra.has(c) && c !== 'aura-svg').length === 0,
     `zero classes em comum com ${id}`);
  ok(keyframes(outra).filter(k => kPnp.includes(k)).length === 0,
     `zero keyframes em comum com ${id}`);
}

console.log('\n-- paleta: o giroflex da penitência, não o fogo da Fênix --');
ok(pnp.includes('#ff0a3c') && pnp.includes('#2b6bff'), 'carmesim + azul do giroflex');
ok(!/#ff8c|#ff6b|#ffa5|#f39c12/i.test(pnp), 'sem o laranja da Fênix');

console.log('\n-- as quatro ideias estão no desenho --');
ok((pnp.match(/class="pn\d+-selo pn\d+-selo\d"/g) || []).length === 3, 'o selo tem 3 anéis');
ok(/scale\(1\.18\)/.test(pnp) && /scale\(1\)/.test(pnp), 'o selo CONTRAI (1.18 → 1), não gira');
ok((pnp.match(/-tinta"/g) || []).length === 18, 'a tinta tem 18 traços');
ok(/translateY\(320px\)/.test(pnp), 'a tinta CAI — movimento vertical, único no app');
ok(pnp.includes('clip-path="url(#') && pnp.includes('-corte'),
   'a chuva é recortada ao círculo (senão escorre e vira listra na tela)');
ok((pnp.match(/-cunha"/g) || []).length === 4, 'o carimbo tem 4 cunhas');
ok(/translateY\(26px\)/.test(pnp), 'o carimbo BATE para dentro — impacto, não órbita');
ok(new Set([...pnp.matchAll(/-cunha"[\s\S]{0,300}?animation-delay:([\d.]+)s/g)]
     .map(m => m[1])).size === 4,
   'cada cunha com atraso próprio (sem isso as 4 juntas viram um zoom)');
ok(/-assina/.test(pnp) && /stroke-dashoffset: 300/.test(pnp), 'a assinatura se escreve');

console.log('\n-- higiene --');
const a = Auras._registro['pena-punidor'](260), b = Auras._registro['pena-punidor'](260);
const idDe = s => (s.match(/id="(pn\d+)-veu"/) || [])[1];
ok(idDe(a) && idDe(b) && idDe(a) !== idDe(b),
   'ids únicos por instância (duas auras na mesma tela não se roubam os gradientes)');
ok(pnp.includes('prefers-reduced-motion'), 'prefers-reduced-motion honrado');
ok([...pnp.matchAll(/ id="([\w-]+)"/g)].map(m => m[1]).every(d => pnp.includes('url(#' + d + ')')),
   'nenhum <defs> órfão');

/* ── A INSÍGNIA ──────────────────────────────────────────────────── */
console.log('\n-- a insígnia --');
const ctxB = vm.createContext({ window: {}, console });
vm.runInContext(ler('js', 'badges', 'pena-do-punidor.js'), ctxB);
const FX = vm.runInContext('PenaPunidorFX', ctxB);
const med = FX._svgMedalha(260);

/* ARMADILHA JÁ PAGA — não reintroduzir: a primeira versão destes três
   asserts contava ocorrências no SVG inteiro, e `indexOf('pp-gotas')`
   caía na REGRA CSS dentro do <style>, não no grupo desenhado. Contava
   a folha de estilo achando que contava o desenho. Por isso o corte em
   `</style>` abaixo, e por isso as contagens finas vêm das funções
   geradoras, que devolvem exatamente o que foi gerado. */
const arte = med.slice(med.indexOf('</style>'));
const barbas = FX._barbas('t');

ok(med.trim().startsWith('<svg') && med.trim().endsWith('</svg>'), 'SVG bem formado');
ok((barbas.sup.match(/<path/g) || []).length === 34 &&
   (barbas.inf.match(/<path/g) || []).length === 34, 'as barbas: 34 de cada lado');
ok((FX._veios('t').match(/<path/g) || []).length === 4,
   'apenas 4 veios (mais que isso vira grade e some a pena)');
ok(arte.includes('class="pp-nib"'), 'a ponta metálica existe no desenho');
ok((arte.slice(arte.indexOf('class="pp-gotas"')).match(/<(circle|ellipse)/g) || []).length === 6,
   '6 gotas de tinta');
ok((arte.slice(arte.indexOf('class="pp-floreio"'),
                arte.indexOf('class="pp-pena"')).match(/<path/g) || []).length === 2,
   'o floreio tem 2 traços');
const idM = s => (s.match(/id="(pp[a-z0-9]+)/) || [])[1];
ok(idM(FX._svgMedalha(90)) !== idM(FX._svgMedalha(90)), 'ids únicos por instância');
ok(!/animation:[^;}]*girar|rotate\(\s*\d+deg\s*\)\s*;/.test(
     med.slice(med.indexOf('<style>'), med.indexOf('</style>'))),
   'nada gira na insígnia — a pena é um objeto, não um carrossel');
ok(med.includes('prefers-reduced-motion'), 'prefers-reduced-motion honrado');

console.log('\n-- o registro (a causa do "Insígnia com arte própria" na Forja) --');
const bruto = ler('js', 'badges', 'pena-do-punidor.js');
const codCelebrar = (bruto.match(/codigo:\s*'([a-z_]+)'/) || [])[1];
const codRegistro = (bruto.match(/registrarInsignia\?\.\(\s*'([a-z_]+)'/) || [])[1];
ok(codCelebrar === 'pena_do_punidor', 'celebrar() usa o código pena_do_punidor');
ok(codRegistro === codCelebrar, 'registrarInsignia usa o MESMO código de celebrar()');
ok(ler('index.html').includes('js/badges/pena-do-punidor.js'), 'carregada no index.html');

/* O backend é a outra metade: arte registrada sem Conquista no seed
   deixa a Forja caindo no texto genérico de arte órfã. */
const seed = fs.readFileSync(path.join(RAIZ, '..', 'backend', 'seed.py'), 'utf8');
const presentes = seed.split('CONQUISTAS_PRESENTE = [')[1].split('\n]')[0];
ok(presentes.includes('"pena_do_punidor"'), 'o backend conhece o código (seed.py)');
ok(/\("pena_do_punidor",[\s\S]{0,300}?"#ff0a3c", 7777, 777\)/.test(seed),
   'cor, xp e moedas registrados no seed');
ok(bruto.includes('xp_bonus:  7777') && bruto.includes('moedas_bonus: 777'),
   'os números do frontend batem com os do backend');
ok(bruto.includes("cor:       '#ff0a3c'"), 'a cor do frontend bate com a do backend');

/* A aura irmã é `enviavel: False` — "se ganha por direito". Um emblema
   que circula e uma aura que não circula seriam duas regras para o
   mesmo objeto. */
ok(!seed.split('TRANSFERIVEIS = {')[1].split('}')[0].includes('pena_do_punidor'),
   'não é transferível — coerente com a aura, que não é enviável');

const cos = fs.readFileSync(path.join(RAIZ, '..', 'backend', 'motors', 'cosmeticos.py'), 'utf8')
              .replace(/^\s*#.*$/gm, '');   // comentários mentem em busca de texto cru
const desc = (cos.match(/"pena-punidor":[\s\S]{0,900}?"descricao":([\s\S]{0,600}?)"cor"/) || [])[1] || '';
ok(!/rbit/.test(desc), 'a descrição não usa "órbita" — vocabulário da Fênix');
ok(/órbita/.test((cos.match(/"fenix-pioneira":([\s\S]{0,600}?)"enviavel"/) || [])[1] || ''),
   'a Fênix AINDA diz "órbita" — o teste sabe distinguir');
ok(['selo', 'tinta', 'carimbo', 'assinatura'].every(k => desc.includes(k)),
   'a descrição do catálogo cita as 4 ideias que a arte realmente tem');

console.log(`\n=== ${testes - falhas}/${testes} ===`);
process.exit(falhas ? 1 : 0);
