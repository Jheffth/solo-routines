/* A PENA DO PUNIDOR — o que o navegador recebe.

   A ARTE NÃO É MAIS MEDIDA AQUI. Ela nasce em
   `webapp/backend/motors/forja/pecas/pena_punidor.py`, e quem garante
   forma, ids, viewBox e reduced-motion é `test_forja.py`, junto do
   motor. Duplicar aquelas contagens deste lado criaria dois donos da
   mesma verdade — e quando a arte mudasse, o teste errado quebraria.

   O que resta aqui é o que só existe do lado do cliente:

     · o arquivo CARREGA e registra a insígnia
     · a aura não fala a língua da Fênix
     · frontend e backend concordam sobre código, cor, XP e moedas

   O terceiro é o que faltava quando a Forja mostrava "Insígnia com arte
   própria": a arte estava registrada e a Conquista não existia no seed.

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

/* Comentário mente em busca de texto cru — já aconteceu três vezes neste
   projeto, inclusive num assert que procurava "aura-girar" e casava com
   o comentário dizendo que ela NÃO é usada. */
const semComentarios = txt => txt
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

console.log('\n-- os arquivos gerados carregam --');
const badge = ler('js', 'badges', 'pena-do-punidor.js');
const auras = ler('js', 'auras.js');
ok(/GERADO por motors\/forja com drawsvg \+ Jinja2/.test(badge),
   'a insígnia é gerada pelo motor, sobre drawsvg + Jinja2');
ok(/FORJA:INICIO pena-punidor/.test(auras), 'a aura foi inserida pelo motor');
ok(/FORJA:FIM pena-punidor/.test(auras), 'com marcador de fim — o resto de auras.js é preservado');

const ctxB = vm.createContext({ window: {}, console });
vm.runInContext(badge, ctxB);
const FX = vm.runInContext('PenaPunidorFX', ctxB);
ok(typeof FX._svg === 'function', 'PenaPunidorFX._svg existe');
const med = FX._svg(260);
ok(med.trim().startsWith('<svg') && med.trim().endsWith('</svg>'), 'SVG bem formado');
ok(med.includes('class="conquista-svg"'), 'usa a classe das insígnias');

console.log('\n-- ids únicos: a vitrine mostra TRÊS tamanhos juntos --');
/* O formato do id mudou com o motor novo: o drawsvg gera o def e o
   sufixo de instância vem do contador em runtime. O que importa não é o
   formato — é que DUAS chamadas não colidam. */
const idDe = s => (s.match(/ id="([^"]+)"/) || [])[1];
ok(idDe(FX._svg(140)) !== idDe(FX._svg(92)),
   'duas chamadas geram ids diferentes (com id fixo, o primeiro SVG vence)');

console.log('\n-- a aura não fala a língua da Fênix --');
const ctxA = vm.createContext({ window: {}, document: {}, console });
vm.runInContext(auras, ctxA);
const A = vm.runInContext('Auras', ctxA);
ok(typeof A._registro['pena-punidor'] === 'function', 'a aura está registrada');
const pnp = semComentarios(A._registro['pena-punidor'](260));
const fnx = semComentarios(A._registro['fenix-pioneira'](260));
ok(!/aura-girar/.test(pnp), 'a Pena NÃO usa aura-girar');
ok((fnx.match(/aura-girar/g) || []).length === 4,
   'a Fênix usa aura-girar 4× — o teste sabe distinguir');
const classes = s => new Set(
  [...s.matchAll(/class="([a-z0-9 _-]+)"/g)].flatMap(m => m[1].split(' ')));
const cp = classes(pnp);
for (const id of Object.keys(A._registro)) {
  if (id === 'pena-punidor') continue;
  const co = classes(semComentarios(A._registro[id](260)));
  ok([...cp].filter(c => co.has(c) && c !== 'aura-svg').length === 0,
     `zero classes em comum com ${id}`);
}
ok(pnp.includes('prefers-reduced-motion'), 'a aura honra reduced-motion');
ok(A._registro['pena-punidor'](77).includes('width="77"'), 'respeita o tamanho');

console.log('\n-- o registro dos dois lados (a causa do fallback na Forja) --');
const cf = (badge.match(/codigo: '([a-z_]+)'/) || [])[1];
const cr = (badge.match(/registrarInsignia\?\.\('([a-z_]+)'/) || [])[1];
ok(cf === 'pena_do_punidor', 'celebrar() usa pena_do_punidor');
ok(cr === cf, 'registrarInsignia usa o MESMO código');
ok(ler('index.html').includes('js/badges/pena-do-punidor.js'), 'carregada no index.html');

const seed = fs.readFileSync(path.join(RAIZ, '..', 'backend', 'seed.py'), 'utf8');
ok(seed.split('CONQUISTAS_PRESENTE = [')[1].split('\n]')[0].includes('"pena_do_punidor"'),
   'o backend conhece o código (sem isto a Forja cai no texto de arte órfã)');
ok(/\("pena_do_punidor",[\s\S]{0,300}?"#ff0a3c", 7777, 777\)/.test(seed),
   'cor, xp e moedas no seed');
ok(badge.includes('xp_bonus: 7777') && badge.includes('moedas_bonus: 777'),
   'e os mesmos números no frontend');
/* O ARQUITETO MUDOU ESTA REGRA e o assert seguia a antiga.
   `pena_do_punidor` foi adicionado a TRANSFERIVEIS depois que eu escrevi
   "não é transferível, coerente com a aura". Decisão dele vence a minha
   inferência, então o teste passa a registrar o estado REAL — e a
   divergência que sobrou, para ficar visível:

       badge pena_do_punidor  transferivel = True   (circula)
       aura  pena-punidor     enviavel     = False  (não circula)

   Pode ser proposital (o emblema circula, a aura não) ou esquecimento.
   O teste não decide; ele só impede que a diferença passe despercebida. */
const transferiveis = seed.split('TRANSFERIVEIS = {')[1].split('}')[0];
const cos = fs.readFileSync(path.join(RAIZ, '..', 'backend', 'motors',
                                      'cosmeticos.py'), 'utf8');
const auraEnviavel = /"pena-punidor":[\s\S]*?"enviavel":\s*True/.test(cos);
ok(transferiveis.includes('pena_do_punidor'),
   'o badge circula (TRANSFERIVEIS) — regra atual do Arquiteto');
ok(!auraEnviavel,
   'e a aura NÃO circula (enviavel: False) — a divergência está registrada, ' +
   'não corrigida por conta própria');

console.log(`\n=== ${testes - falhas}/${testes} ===`);
process.exit(falhas ? 1 : 0);
