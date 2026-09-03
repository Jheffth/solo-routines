/* CHAMADAS FANTASMA AO SoloDialog — o botão que não faz nada, calado.

   O DEFEITO QUE ISTO PRENDE

   O botão Reerguer não funcionava. O backend estava correto (testado
   ponta a ponta: reerguer reabre e a meta volta a aceitar valores), o
   cartão oferecia o botão, e mesmo assim clicar não produzia efeito
   nenhum — sem diálogo, sem requisição, sem erro no console.

   A causa:

       const confirmado = (typeof SoloDialog !== 'undefined'
                           && SoloDialog.confirmar)          // ← não existe
         ? await SoloDialog.confirmar({ ... })
         : false;
       if (!confirmado) return;                              // ← sai calado

   `js/dialog.js` expõe `confirm(msg, opts)`. Nunca houve `confirmar`.
   E a guarda — escrita para ser defensiva — converteu "o método não
   existe" em "o usuário disse não". O erro que teria denunciado tudo na
   primeira execução foi apagado pela própria proteção.

   Estava em TRÊS lugares: Reerguer, Confessar e Restaurar a Balança.
   Três botões mortos, meses.

   O QUE ESTE TESTE MEDE

   Toda propriedade acessada em `SoloDialog.x` no frontend tem de existir
   de fato no objeto exportado por `dialog.js`. É uma verificação de
   contrato entre arquivos que o JavaScript não faz sozinho — e que
   nenhum lint pega, porque `SoloDialog.confirmar` é sintaticamente
   perfeito.

   Uso:  node webapp/frontend/tests/teste_dialog_api.js
*/
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

let falhas = 0, testes = 0;
function ok(cond, msg) {
  testes++; if (!cond) falhas++;
  console.log((cond ? '  [ok]  ' : '  [XX]  ') + msg);
}

const semComentarios = txt => txt
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

console.log('\n=== CONTRATO DO SoloDialog ===\n');

/* ── O que dialog.js REALMENTE oferece ─────────────────────────
   Lê os métodos declarados no objeto literal. Não executa o arquivo:
   ele mexe no DOM na carga, e um jsdom aqui só traria fragilidade. */
const dialog = semComentarios(fs.readFileSync(path.join(RAIZ, 'js', 'dialog.js'), 'utf8'));
const oferecidos = new Set([
  ...[...dialog.matchAll(/^\s{2}(\w+)\s*\(/gm)].map(m => m[1]),      // metodo() {
  ...[...dialog.matchAll(/^\s{2}(\w+)\s*:/gm)].map(m => m[1]),       // prop:
]);
ok(oferecidos.has('confirm'), `dialog.js expõe ${oferecidos.size} membros, com confirm()`);
ok(!oferecidos.has('confirmar'),
   'e NÃO expõe confirmar() — o método que três botões chamavam');

/* ── O que o frontend CHAMA ────────────────────────────────────
   Ignora `SoloDialog?.x` opcional: aquele encadeamento já assume que o
   membro pode faltar e degrada de propósito (é o caso dos toasts). O
   que se procura aqui é a chamada DIRETA, que promete existir. */
const arquivos = [];
(function varrer(dir) {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) { if (n !== 'tests') varrer(p); continue; }
    if (n.endsWith('.js')) arquivos.push(p);
  }
})(path.join(RAIZ, 'js'));

const fantasmas = [];
for (const arq of arquivos) {
  const txt = semComentarios(fs.readFileSync(arq, 'utf8'));
  for (const m of txt.matchAll(/SoloDialog\s*\.\s*(\w+)/g)) {
    if (!oferecidos.has(m[1])) {
      const linha = txt.slice(0, m.index).split('\n').length;
      fantasmas.push(`${path.basename(arq)}:${linha} → SoloDialog.${m[1]}`);
    }
  }
}

ok(fantasmas.length === 0,
   fantasmas.length
     ? `chamadas a membros inexistentes:\n         ${fantasmas.join('\n         ')}`
     : `${arquivos.length} arquivos: nenhuma chamada a membro inexistente`);

/* ── A GUARDA QUE ESCONDE O ERRO ───────────────────────────────

   `(SoloDialog.metodo) ? await ... : false` converte "o método não
   existe" em "o usuário recusou" — e o botão morre em silêncio, sem
   diálogo, sem requisição, sem erro. Foi assim que Reerguer ficou
   quebrado por meses.

   MAS SÓ É DEFEITO QUANDO O MEMBRO NÃO EXISTE. A primeira versão deste
   assert reprovava TODA guarda, e acusou `chat.js`, onde ela é
   legítima e documentada: lá o problema histórico era `window.
   SoloDialog` dar `undefined` (SoloDialog é `const` de topo, não vira
   propriedade do window) e o fallback limpar a conversa SEM confirmar.
   Guarda sobre método existente é, no pior caso, código morto.

   Reprovar código correto é como um teste começa a ser ignorado. */
const suspeitas = [];
for (const arq of arquivos) {
  const txt = semComentarios(fs.readFileSync(arq, 'utf8'));
  for (const m of txt.matchAll(/&&\s*SoloDialog\s*\.\s*(\w+)\s*\)\s*\n?\s*\?/g)) {
    if (oferecidos.has(m[1])) continue;          // existe: no máximo é inútil
    const linha = txt.slice(0, m.index).split('\n').length;
    suspeitas.push(`${path.basename(arq)}:${linha} → guarda em .${m[1]} (inexistente)`);
  }
}
ok(suspeitas.length === 0,
   suspeitas.length
     ? `guardas que transformam método AUSENTE em "não":\n         ${suspeitas.join('\n         ')}`
     : 'nenhuma guarda escondendo membro inexistente');

console.log(`\n=== ${testes - falhas}/${testes} ===`);
process.exit(falhas ? 1 : 0);
