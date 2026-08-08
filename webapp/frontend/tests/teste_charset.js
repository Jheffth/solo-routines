/* MOJIBAKE — o defeito que nenhum teste pega e todo mundo vê.

   O QUE ACONTECEU

   `index.html` foi salvo por um editor que leu o arquivo UTF-8 como se
   fosse cp1252 e gravou de volta em UTF-8. O resultado é texto
   DUPLAMENTE codificado: o arquivo continua sendo UTF-8 perfeitamente
   válido — nenhum parser reclama, nenhum teste quebra — mas o conteúdo
   virou "Extrato de MissÃµes" e "MISSÃMES GERAIS" na tela do Arquiteto.

   É o pior tipo de defeito: invisível para as máquinas, gritante para
   as pessoas. Por isso o teste procura as ASSINATURAS do estrago em vez
   de validar a codificação — validar não adiantaria, o arquivo passa.

   AS ASSINATURAS

     Ã seguido de continuação   ← "ção" virou "Ã§Ã£o"
     Â seguido de continuação   ← "·" virou "Â·"
     ðY                         ← emoji virou "ðY..."
     ï»¿                        ← o próprio BOM, mojibakado

   FALSO POSITIVO É POSSÍVEL e está tratado: "PORTÃO", "AQUISIÇÃO" e
   "Âmbar" têm Ã e Â legítimos. A diferença é o que vem DEPOIS — num
   mojibake o caractere seguinte é sempre um byte de continuação UTF-8
   (U+0080–U+00BF), que nenhuma palavra em português produz.

   Uso:  node webapp/frontend/tests/teste_charset.js
*/
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');   // webapp/
const EXTS = new Set(['.html', '.js', '.css', '.json', '.md', '.py']);
const PULAR = new Set(['node_modules', '.git', 'venv', '.venv', '__pycache__']);

/* Ã/Â colado num byte de continuação. Palavra nenhuma faz isso. */
const MOJIBAKE = /[ÃÂ][-¿]|ðŸ|ï»¿/;

let falhas = 0, vistos = 0;
const achados = [];

function varrer(dir) {
  for (const nome of fs.readdirSync(dir)) {
    if (PULAR.has(nome)) continue;
    const p = path.join(dir, nome);
    const st = fs.statSync(p);
    if (st.isDirectory()) { varrer(p); continue; }
    if (!EXTS.has(path.extname(nome))) continue;
    /* O PRÓPRIO TESTE CONTÉM AS ASSINATURAS — elas estão no comentário
       de cima, como exemplo. Sem esta linha ele se acusa e o relatório
       nunca fica limpo, que é a forma mais rápida de um teste virar
       ruído que se ignora. */
    if (path.resolve(p) === path.resolve(__filename)) continue;
    vistos++;

    const bruto = fs.readFileSync(p);
    const txt = bruto.toString('utf8');

    /* 1. BOM. Antes do <!doctype> ele joga alguns navegadores em quirks
          mode, e foi ele que veio junto do salvamento estragado. */
    if (bruto.length >= 3 && bruto[0] === 0xEF && bruto[1] === 0xBB && bruto[2] === 0xBF) {
      achados.push(`${path.relative(RAIZ, p)} — começa com BOM`);
    }

    /* 2. Mojibake. Reporta a PRIMEIRA ocorrência com contexto, porque
          "tem mojibake em index.html" não ajuda ninguém a achar. */
    const m = txt.match(MOJIBAKE);
    if (m) {
      const i = txt.indexOf(m[0]);
      const trecho = txt.slice(Math.max(0, i - 30), i + 18).replace(/\n/g, '⏎');
      const linha = txt.slice(0, i).split('\n').length;
      achados.push(`${path.relative(RAIZ, p)}:${linha} — «…${trecho}…»`);
    }
  }
}

console.log('\n=== CHARSET ===\n');
varrer(RAIZ);

if (achados.length) {
  falhas = achados.length;
  for (const a of achados) console.log('  [XX]  ' + a);
  console.log(`\n  Conserto: o texto foi lido como cp1252 e regravado em UTF-8.`);
  console.log(`  Para reverter, em Python:`);
  console.log(`      t = open(arq, encoding='utf-8').read().lstrip('\\ufeff')`);
  console.log(`      open(arq,'w',encoding='utf-8',newline='').write(`);
  console.log(`          t.encode('cp1252','strict').decode('utf-8'))`);
  console.log(`  (cp1252 tem 5 buracos — 0x81 0x8D 0x8F 0x90 0x9D. Se um deles`);
  console.log(`   aparecer, mapeie-os para si mesmos antes de codificar.)`);
} else {
  console.log(`  [ok]  ${vistos} arquivos sem mojibake e sem BOM`);
}

console.log(`\n=== ${falhas ? falhas + ' ARQUIVO(S) ESTRAGADO(S)' : 'CHARSET OK'} ===`);
process.exit(falhas ? 1 : 0);
