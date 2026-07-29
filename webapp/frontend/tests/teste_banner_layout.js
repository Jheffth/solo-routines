/* O banner nas larguras do meio — teste de ESTRUTURA do CSS.

   Não tenho navegador: nada aqui prova que ficou bonito. O que dá
   para provar sem renderizar é que as REGRAS existem, que medem a
   coisa certa, e que as faixas não se sobrepõem — que era o defeito.

   A conta que motivou tudo, refeita aqui como teste: se a coluna do
   meio some, a barra de XP some junto, porque a altura dela é
   proporcional à largura.

   Uso:  node webapp/frontend/tests/teste_banner_layout.js
*/
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(RAIZ, 'css', 'estandarte.css'), 'utf8');
const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');

let falhas = 0, testes = 0;
function ok(cond, msg) {
  testes++; if (!cond) falhas++;
  console.log((cond ? '  [ok]  ' : '  [XX]  ') + msg);
}

/* Recorta um bloco @container/@media pela contagem de chaves. */
function bloco(cabecalho) {
  const i = semComentarios.indexOf(cabecalho);
  if (i < 0) return null;
  let j = semComentarios.indexOf('{', i), n = 0;
  for (let k = j; k < semComentarios.length; k++) {
    if (semComentarios[k] === '{') n++;
    else if (semComentarios[k] === '}') { n--; if (n === 0) return semComentarios.slice(i, k + 1); }
  }
  return null;
}

console.log('\n=== O BANNER NAS LARGURAS DO MEIO ===\n');

/* ══ 1. A régua ══ */
console.log('-- a régua passou a ser o banner --');
ok(/\.pt-v4-banner\s*\{[^}]*container-type:\s*inline-size/.test(semComentarios),
   'o banner se declara contêiner de consulta');
ok(/container-name:\s*banner/.test(semComentarios), '  com nome próprio, para as regras o alcançarem');

const meio = bloco('@container banner (min-width: 621px) and (max-width: 1180px)');
const estreito = bloco('@container banner (max-width: 620px)');
ok(!!meio, 'existe o degrau do meio (621–1180px de banner)');
ok(!!estreito, 'e o estreito (até 620px), que é o carrossel');

/* AS FAIXAS NÃO PODEM SE SOBREPOR. Era isso que tornava impossível
   consertar com media query: o carrossel disparava pela janela e o
   resto pelo banner, então havia larguras em que os dois valiam. */
const limSup = +(/max-width:\s*(\d+)px/.exec(estreito) || [])[1];
const limInf = +(/min-width:\s*(\d+)px/.exec(meio) || [])[1];
ok(limInf === limSup + 1,
   `as duas faixas se encostam sem sobrepor (${limSup} | ${limInf})`);

/* E o carrossel NÃO pode mais medir a janela — se medisse, voltaria
   a valer junto com o degrau do meio em algumas larguras. */
const carrosselPorMedia = /@media[^{]*\{[^{]*\.pt-v4-grid\s*\{[^}]*grid-template-areas:\s*none/.test(semComentarios);
ok(!carrosselPorMedia || /@supports not/.test(semComentarios),
   'o carrossel deixou de disparar pela janela (só a reserva ainda o faz)');

/* ══ 2. O layout que o Arquiteto desenhou ══ */
console.log('\n-- as faixas, na ordem pedida --');
const areas = (/grid-template-areas:\s*([^;]+);/.exec(meio) || [])[1] || '';
const linhas = (areas.match(/"[^"]+"/g) || []).map(l => l.replace(/"/g, '').trim().split(/\s+/));
ok(linhas.length === 4, `quatro faixas (${linhas.length})`);
ok(linhas[0] && linhas[0][0] === 'xp' && linhas[0][1] === 'xp',
   '1ª — a barra de XP, ocupando a largura inteira');
ok(linhas[1] && linhas[1][0] === 'epi',
   '2ª — a epígrafe, logo abaixo da barra');
ok(linhas[2] && linhas[2][0] === 'hunter' && linhas[2][1] === 'gemas',
   '3ª — a base: foto/nome/título à esquerda, gemas à direita');
ok(linhas[3] && linhas[3][0] === 'reliq' && linhas[3][1] === 'reliq',
   '4ª — as insígnias, na largura toda');
ok(/\.pt-v4-reliquias-dock\s*\{[^}]*justify-self:\s*center/.test(meio),
   '  e centralizadas nela');

/* `display: contents` é o que permite tudo isso sem tocar no HTML. */
ok(/\.pt-v4-nucleo\s*\{\s*display:\s*contents/.test(meio),
   'o núcleo vira `display: contents`: seus filhos sobem para a grade');
ok(/\.pt-v4-epigrafe\s*\{[^}]*position:\s*static/.test(meio),
   '  e a epígrafe sai do absoluto — sem núcleo, não há o que ancorar');
ok(/\.pt-v4-reliquias-dock\s*\{[^}]*position:\s*static/.test(meio),
   '  o relicário também');
ok(/white-space:\s*normal/.test(meio),
   'a epígrafe pode quebrar linha (era `nowrap`, e transbordava)');

/* A altura: o Arquiteto pediu para NÃO esticar o banner. */
ok(/\.pt-retrato\s*\{\s*width:\s*140px/.test(meio),
   'o retrato encolhe para 140px — as faixas novas custam altura, e ela volta daí');

/* ══ 3. A conta que motivou tudo ══ */
console.log('\n-- a aritmética, refeita --');
const SIDEBAR = 260, PAD_PAG = 48, PAD_BANNER = 58;
const COL1 = 400, COL3 = 185, VAOS = 48;
const bannerDe = j => j - (j > 768 ? SIDEBAR : 0) - PAD_PAG;
const alturaBarra = larg => Math.round(Math.max(larg, 0) / 980 * 78);

const antes = j => bannerDe(j) - PAD_BANNER - COL1 - COL3 - VAOS;   // 3 colunas
const depois = j => bannerDe(j) - PAD_BANNER;                        // faixa inteira

ok(antes(901) < 0,
   `em 901px de janela a coluna do meio era NEGATIVA (${antes(901)}px) — transbordava`);
ok(alturaBarra(antes(1363)) < 32,
   `no print do Arquiteto a barra tinha ${alturaBarra(antes(1363))}px de altura (desenhada para 78)`);
ok(alturaBarra(depois(1363)) > 70,
   `com a faixa inteira ela passa a ${alturaBarra(depois(1363))}px — volta a ser a peça desenhada`);
ok(bannerDe(1363) > 620 && bannerDe(1363) <= 1180,
   `e a janela do print (banner ${bannerDe(1363)}px) cai dentro do degrau novo`);
ok(bannerDe(1920) > 1180,
   `enquanto o monitor grande (banner ${bannerDe(1920)}px) segue nas três colunas`);
ok(bannerDe(390) <= 620,
   `e o celular (banner ${bannerDe(390)}px) segue no carrossel`);

/* ══ 4. A reserva ══ */
console.log('\n-- para quem não tem container query --');
ok(/@supports not \(container-type: inline-size\)/.test(semComentarios),
   'existe reserva: navegador antigo empilha em vez de transbordar');

console.log(`\n=== ${testes - falhas}/${testes} ===`);
if (falhas) process.exit(1);
