/* ============================================================
   TESTE — TODO ARQUIVO JS PRECISA PELO MENOS *PARSEAR*

   POR QUE ESTE ARQUIVO EXISTE

   O cartao da agenda subiu para producao e simplesmente NAO APARECEU.
   Nenhum erro na tela, nenhum aviso, o perfil carregando normalmente —
   so que sem ele. A causa levou uma investigacao no servidor para achar:

       <!-- ... a tabela `pactos` nao tem data nenhuma ... -->

   Um comentario HTML dentro de um template literal, citando o nome de uma
   tabela entre CRASES. A crase FECHOU o template literal no meio da
   string, e o resto do arquivo virou lixo sintatico:

       SyntaxError: Unexpected identifier 'pactos'

   O navegador descarta o arquivo inteiro e segue a vida. `window.Agenda`
   fica `undefined`, ninguem reclama, e o recurso some sem deixar rastro.

   E O PIOR DE TODOS OS DEFEITOS por um motivo especifico: os outros
   testes deste projeto carregam o modulo que vao testar, entao um erro
   de sintaxe faria ELES quebrarem. Mas um arquivo que ninguem testa —
   e `agenda.js` era um — passa direto.

   Este teste nao entende nada de nenhum arquivo. So pergunta uma coisa,
   para todos: "isto e JavaScript valido?". E barato, roda em milissegundos
   e pega uma familia inteira de erros que so aparecem em producao.

   Uso: node teste_sintaxe.js      (nao precisa de jsdom)
   ============================================================ */
const fs = require('fs');
const path = require('path');

let falhas = 0, testes = 0;
const ok = (cond, msg) => {
  testes++;
  if (!cond) falhas++;
  console.log((cond ? '  [ok]  ' : '  [XX]  ') + msg);
};

const RAIZ = path.join(__dirname, '..', 'js');

function varrer(dir) {
  const achados = [];
  for (const nome of fs.readdirSync(dir)) {
    const p = path.join(dir, nome);
    const st = fs.statSync(p);
    if (st.isDirectory()) achados.push(...varrer(p));
    else if (nome.endsWith('.js')) achados.push(p);
  }
  return achados;
}

console.log('\n=== SINTAXE DE TODO O FRONTEND ===\n');

const arquivos = varrer(RAIZ).sort();
console.log(`-- ${arquivos.length} arquivos em js/ --\n`);

const quebrados = [];
for (const arq of arquivos) {
  const rel = path.relative(path.join(__dirname, '..'), arq).replace(/\\/g, '/');
  const fonte = fs.readFileSync(arq, 'utf8');
  let erro = null;
  try {
    /* `new Function` COMPILA sem executar. E exatamente o que queremos:
       rodar de verdade exigiria DOM, API, e metade do app — e o objetivo
       aqui e so saber se o parser aceita o arquivo. */
    new Function(fonte);
  } catch (e) {
    // ReferenceError etc. nao acontecem sem executar; se veio erro, e de
    // parse. Guardamos a mensagem porque ela costuma apontar a linha.
    erro = `${e.name}: ${e.message}`;
  }
  ok(erro === null, erro ? `${rel} — ${erro}` : rel);
  if (erro) quebrados.push(rel);
}

if (quebrados.length) {
  console.log('\n  ARQUIVOS QUE O NAVEGADOR VAI DESCARTAR INTEIROS:');
  for (const q of quebrados) console.log('    - ' + q);
  console.log('\n  Suspeito numero um: CRASE dentro de template literal.');
  console.log('  Escrever `nome_de_coisa` entre crases e habito de prosa');
  console.log('  tecnica, e dentro de uma template string ela FECHA a string.');
}

console.log(`\n${'='.repeat(52)}`);
console.log(falhas === 0 ? `TUDO VERDE — ${testes} arquivos`
                         : `${falhas} ARQUIVO(S) QUEBRADO(S) de ${testes}`);
console.log('='.repeat(52) + '\n');
process.exit(falhas === 0 ? 0 : 1);
