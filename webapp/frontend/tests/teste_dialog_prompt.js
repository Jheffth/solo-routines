/* SoloDialog.prompt — a caixa de texto que apareceu como TEXTO.

   O bug que originou este arquivo: `_abrir` faz
   `msg.replace(/\n/g, '<br>')`, o que é certo para uma mensagem e
   fatal para uma tag. O <input> estava escrito em várias linhas, as
   quebras viraram <br> DENTRO da tag, o navegador fechou o input no
   primeiro `<` e cuspiu o resto como texto — os atributos do campo
   apareceram escritos por extenso no lugar dele.

   Nada nisso quebra em JavaScript. Só se vê na tela, ou aqui.

   Uso:  node webapp/frontend/tests/teste_dialog_prompt.js
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const RAIZ = path.join(__dirname, '..');

let falhas = 0, testes = 0;
function ok(cond, msg) {
  testes++; if (!cond) falhas++;
  console.log((cond ? '  [ok]  ' : '  [XX]  ') + msg);
}
const espera = ms => new Promise(r => setTimeout(r, ms));

async function main() {
console.log('\n=== O PROMPT DO SISTEMA ===\n');

const dom = new JSDOM('<!doctype html><body></body>',
                      { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
w.console = { log(){}, warn(){}, error(){} };
const ctx = vm.createContext(w);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'js', 'dialog.js'), 'utf8'), ctx);
const D = vm.runInContext('SoloDialog', ctx);
const doc = w.document;

/* ── 1. O campo é um ELEMENTO, não texto ─────────────────── */
console.log('-- o campo existe de verdade --');
const p1 = D.prompt('Qual a sua epígrafe? (até 100 caracteres)',
                    { titulo: 'Editar Citação', valor: 'Erga-se.', maxlength: 100 });

const campo = doc.getElementById('solo-dialog-input');
ok(!!campo, 'existe um #solo-dialog-input no documento');
ok(campo && campo.tagName === 'INPUT', 'e ele é uma tag INPUT — não texto solto');
ok(campo && campo.value === 'Erga-se.', 'já vem preenchido com o valor atual');
ok(campo && campo.getAttribute('maxlength') === '100', 'com o limite de caracteres');

/* O CORAÇÃO DO BUG: nenhum atributo do campo pode ter vazado para o
   texto visível da caixa. */
const caixa = doc.getElementById('solo-dialog-box');
const visivel = caixa ? caixa.textContent : '';
ok(!/maxlength|placeholder|box-sizing|font-family/.test(visivel),
   'NENHUM atributo do input aparece como texto na caixa');
ok(!caixa.querySelector('#solo-dialog-input + br, br + #solo-dialog-input'),
   'e nenhum <br> foi injetado dentro da tag');
ok(visivel.includes('Qual a sua epígrafe?'), 'a pergunta, essa sim, aparece');

/* ── 2. Gravar devolve o texto ───────────────────────────── */
console.log('\n-- gravar --');
campo.value = 'Nova epígrafe';
campo.dispatchEvent(new w.Event('input'));
doc.querySelector('#solo-dialog-btns [data-papel="btn-ok"]').click();
ok(await p1 === 'Nova epígrafe', 'devolve o que foi digitado');

/* ── 3. Cancelar devolve null, e vazio NÃO é cancelar ────── */
console.log('\n-- cancelar não é o mesmo que apagar --');
const p2 = D.prompt('msg', { valor: 'algo' });
doc.querySelector('#solo-dialog-btns [data-papel="btn-cancel"]').click();
ok(await p2 === null, 'cancelar devolve null');

const p3 = D.prompt('msg', { valor: 'algo' });
const c3 = doc.getElementById('solo-dialog-input');
c3.value = '';
c3.dispatchEvent(new w.Event('input'));
doc.querySelector('#solo-dialog-btns [data-papel="btn-ok"]').click();
ok(await p3 === '', 'string vazia é resposta VÁLIDA: dá para apagar a própria epígrafe');

/* ── 4. Enter grava ──────────────────────────────────────── */
console.log('\n-- o Enter --');
const p4 = D.prompt('msg', { valor: 'x' });
const c4 = doc.getElementById('solo-dialog-input');
c4.value = 'pelo teclado';
c4.dispatchEvent(new w.Event('input'));
c4.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
ok(await p4 === 'pelo teclado', 'Enter no campo confirma, sem precisar do mouse');

/* ── 5. Aspas no valor não quebram a tag ─────────────────── */
console.log('\n-- texto hostil --');
const p5 = D.prompt('msg', { valor: 'ele disse "olá" & <b>foi</b>' });
const c5 = doc.getElementById('solo-dialog-input');
ok(c5 && c5.value === 'ele disse "olá" & <b>foi</b>',
   'aspas, & e tags no valor voltam intactos — e não escapam do atributo');
ok(!doc.getElementById('solo-dialog-box').querySelector('b'),
   '  o <b> não virou negrito de verdade (nada de HTML injetado)');
doc.querySelector('#solo-dialog-btns [data-papel="btn-cancel"]').click();
await p5;

/* ── 5b. A RAIZ: tag em várias linhas sobrevive ──────────
   Não bastava consertar o prompt. O `_abrir` quebrava QUALQUER
   tag esparramada em várias linhas, e já estava mordendo o painel
   do Arquiteto: os diálogos "Ajustar XP" e "Ajustar Moedas" do
   gerencial.js têm um <input> escrito em cinco linhas. */
console.log('\n-- a raiz: quebra de linha não pode estragar tag --');
ok(D._quebrarLinhas('a\nb') === 'a<br>b', 'texto em duas linhas ainda vira <br>');
ok(D._quebrarLinhas('<i\nclass="x">a</i>') === '<i\nclass="x">a</i>',
   'mas a quebra DENTRO de uma tag é preservada, não virada em <br>');
ok(D._quebrarLinhas('linha\n<b>t</b>\noutra') === 'linha<br><b>t</b><br>outra',
   'e o texto ao redor das tags continua quebrando');

// O caso real do gerencial.js, palavra por palavra.
const pXP = D.confirm(
  `Ajustar XP de <strong>Jefferson</strong>:<br><br>
   <input id="solo-ajuste-val" type="number" placeholder="Ex: 100" style="
     width:100%;padding:.5rem .75rem;
     outline:none;margin-top:.25rem
   ">
   <div style="font-size:.7rem">Positivo para adicionar</div>`,
  { titulo: 'Ajustar XP' });
const campoXP = doc.getElementById('solo-ajuste-val');
ok(!!campoXP && campoXP.tagName === 'INPUT', 'o "Ajustar XP" do Arquiteto tem um INPUT de verdade');
ok(campoXP.type === 'number' && campoXP.placeholder === 'Ex: 100',
   '  com tipo e placeholder intactos');
ok(!/margin-top|placeholder=/.test(doc.getElementById('solo-dialog-box').textContent),
   '  e nenhum atributo vazou como texto');
doc.querySelector('#solo-dialog-btns [data-papel="btn-cancel"]').click();
await pXP;
await espera(220);

/* ── 6. O prompt não some se o hunter cancelar duas vezes ── */
console.log('\n-- uso repetido --');
const p6 = D.prompt('msg', { valor: '1' });
doc.querySelector('#solo-dialog-btns [data-papel="btn-cancel"]').click();
await p6;
await espera(220);                       // a animação de saída remove a caixa
const p7 = D.prompt('msg', { valor: '2' });
ok(!!doc.getElementById('solo-dialog-input'), 'abrir de novo funciona');
ok(doc.querySelectorAll('#solo-dialog-input').length === 1,
   '  e não sobra um campo antigo pendurado no documento');
doc.querySelector('#solo-dialog-btns [data-papel="btn-cancel"]').click();
await p7;

console.log(`\n=== ${testes - falhas}/${testes} ===`);
if (falhas) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
