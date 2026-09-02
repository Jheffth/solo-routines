/* OS BLOCOS DO LANÇADOR — quem manda na visibilidade é UMA função.

   O DEFEITO QUE ISTO PRENDE

   Escolher a natureza CONDICIONAL não revelava o bloco da bifurcação.
   O formulário ficava sem os campos de pergunta e resposta, e ao enviar
   a validação dizia "Preencha a pergunta e as duas respostas" — sobre
   campos que não existiam na tela. Um beco sem saída completo.

   A causa é a profecia que o próprio código escreveu. `_trocarTipo()`
   diz, no comentário:

       "UMA função, e não condições espalhadas pelos handlers: o pacto
        some/aparece em nove blocos, e nove `if` soltos garantem que um
        dia um deles fique para trás."

   Ficou. O handler de `natureza` mostrava só `fm-bloco-repeticao`, à
   mão. Quando a CONDICIONAL nasceu, ela ganhou a sua linha DENTRO de
   `_trocarTipo()` — que só roda ao trocar o TIPO. Trocar a NATUREZA
   nunca a alcançava.

   O QUE ESTE TESTE MEDE, e por que assim

   Não a aparência: a REGRA. Ele confere que o handler de `natureza`
   delega para `_trocarTipo()` em vez de decidir sozinho, e que
   `_trocarTipo()` cobre todos os blocos que o formulário declara.

   Esse segundo assert é o que importa a longo prazo: ele varre os
   `id="fm-bloco-*"` do HTML gerado e exige que cada um apareça na
   função que decide visibilidade. Um bloco novo que nasça esquecido
   quebra o teste no dia em que for escrito, não no dia em que alguém
   tentar usá-lo.

   Uso:  node webapp/frontend/tests/teste_lancador_blocos.js
*/
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(RAIZ, 'js', 'forja-missao.js'), 'utf8');

let falhas = 0, testes = 0;
function ok(cond, msg) {
  testes++; if (!cond) falhas++;
  console.log((cond ? '  [ok]  ' : '  [XX]  ') + msg);
}

/* Comentário mente em busca de texto cru — já custou caro neste
   projeto, inclusive um assert que casou com o comentário explicando
   por que a coisa NÃO era usada. */
const semComentarios = src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/* Fatia com FIM, e que estoura se não achar as duas pontas. Fatia sem
   limite já enganou dois asserts neste repositório: uma media o arquivo
   inteiro, outra media uma string vazia e passou. */
function fatia(txt, inicio, fim) {
  const i = txt.indexOf(inicio);
  if (i < 0) throw new Error(`não achei o início: ${inicio}`);
  const f = txt.indexOf(fim, i + inicio.length);
  if (f < 0) throw new Error(`não achei o fim: ${fim}`);
  if (f - i < 20) throw new Error(`fatia curta demais entre ${inicio} e ${fim}`);
  return txt.slice(i, f);
}

console.log('\n=== BLOCOS DO LANÇADOR ===\n');

console.log('-- trocar a NATUREZA reavalia a visibilidade --');
const handlerNatureza = fatia(
  semComentarios,
  "if (op.dataset.fmCampo === 'natureza')",
  "if (op.dataset.fmCampo === 'pct_tipo')");

ok(/this\._trocarTipo\(\)/.test(handlerNatureza),
   'o handler de natureza delega para _trocarTipo() — quem decide a ' +
   'visibilidade é uma função só');
ok(!/mostra\(\s*['"]fm-bloco-/.test(handlerNatureza),
   'e NÃO decide sozinho com mostra() — foi assim que a condicional ' +
   'ficou invisível enquanto a validação a exigia');

console.log('\n-- todo bloco declarado no HTML é decidido por _trocarTipo --');
const corpoTrocarTipo = fatia(semComentarios, '_trocarTipo() {', '\n  },');

/* Os ids que o formulário realmente cria. */
const declarados = [...new Set(
  [...src.matchAll(/id="(fm-bloco-[a-z-]+)"/g)].map(m => m[1]))];
ok(declarados.length >= 8, `o formulário declara ${declarados.length} blocos`);

const esquecidos = declarados.filter(id => !corpoTrocarTipo.includes(id));
ok(esquecidos.length === 0,
   esquecidos.length
     ? `blocos fora de _trocarTipo(): ${esquecidos.join(', ')} — eles ` +
       'podem ficar visíveis quando não deveriam, ou invisíveis quando ' +
       'a validação os exigir'
     : 'todos os blocos passam por _trocarTipo()');

console.log('\n-- a condicional, especificamente --');
ok(/mostra\('fm-bloco-condicional',[^)]*natureza === 'CONDICIONAL'/.test(corpoTrocarTipo),
   'o bloco da bifurcação aparece quando a natureza é CONDICIONAL');

/* O outro lado da armadilha: a validação exige o que o bloco coleta.
   Se um dia os campos mudarem de id, é melhor descobrir aqui do que
   pelo Arquiteto travado num formulário. */
for (const campo of ['fm-cond-pergunta', 'fm-cond-a-txt', 'fm-cond-b-txt',
                     'fm-cond-a-titulo', 'fm-cond-b-titulo']) {
  ok(src.includes(`id="${campo}"`),
     `o campo ${campo} existe no formulário`);
}

console.log(`\n=== ${testes - falhas}/${testes} ===`);
process.exit(falhas ? 1 : 0);
