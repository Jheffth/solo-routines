/* NAVEGAÇÃO — toda página registrada carrega os próprios dados.

   Este arquivo nasceu de um bug que não quebrou nada e por isso passou:

     O Pacto foi criado, salvo, e o `GET /pactos` devolvia. A aba
     existia, a página aparecia. E ficava vazia — para sempre.

   A causa: `App` tem DOIS switches sobre a mesma lista de páginas.

     navigate(page)          → chamado ao CLICAR na aba
     atualizarPaginaAtual()  → chamado ao voltar/ganhar XP

   O `case 'pacto'` entrou só no segundo. Nenhum erro, nenhum log: o
   switch simplesmente não casava e a função terminava em silêncio. O
   Arquiteto viu uma tela vazia e concluiu, com razão, que a criação
   tinha falhado — quando o dado estava salvo o tempo todo.

   O padrão é o problema, não o Pacto: duas listas da mesma coisa
   divergem na primeira página nova. Então este teste não pergunta "o
   pacto está lá?" — pergunta "as duas listas concordam?", e vai
   proteger a próxima página também.

   Uso:  node webapp/frontend/tests/teste_navegacao_paginas.js
*/
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const ler = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');

let falhas = 0, testes = 0;
function ok(cond, msg) {
  testes++; if (!cond) falhas++;
  console.log((cond ? '  [ok]  ' : '  [XX]  ') + msg);
}

const app = ler('js', 'app.js');
const index = ler('index.html');

/* Recorta um switch pelo nome da função que o contém. Marcos explícitos
   e conferidos: uma fatia vazia faria os asserts abaixo passarem sem
   medir nada, que é pior que falhar. */
function corpoDe(nome, fim) {
  const i = app.indexOf(nome);
  if (i < 0) throw new Error(`não achei ${nome} em app.js`);
  const j = app.indexOf(fim, i);
  if (j < 0) throw new Error(`não achei o fim (${fim}) depois de ${nome}`);
  const r = app.slice(i, j);
  if (r.length < 100) throw new Error(`fatia curta demais para ${nome}: ${r.length}`);
  return r;
}
const casosDe = txt => new Set(
  [...txt.matchAll(/case\s+'([a-z-]+)'\s*:/g)].map(m => m[1]));

const navegar   = corpoDe('async navigate(page) {', 'mostrarLogin()');
const atualizar = corpoDe('async atualizarPaginaAtual() {', 'mostrarLogin()');

const casosNav = casosDe(navegar);
const casosAtu = casosDe(atualizar);

console.log('\n-- os dois switches existem e foram medidos --');
ok(casosNav.size >= 8, `navigate() tem ${casosNav.size} casos`);
ok(casosAtu.size >= 8, `atualizarPaginaAtual() tem ${casosAtu.size} casos`);

console.log('\n-- toda aba do menu sabe navegar --');
/* A verdade sobre quais páginas existem está no HTML, não em nenhum dos
   dois switches — é de lá que o clique parte. */
const abas = [...index.matchAll(/data-page="([a-z-]+)"/g)].map(m => m[1]);
const unicas = [...new Set(abas)];
ok(unicas.length >= 5, `o menu tem ${unicas.length} abas: ${unicas.join(', ')}`);

/* `hunter` é a exceção documentada em app.js: quem o abre é
   HunterPublico.abrir(login), que já sabe de quem é o perfil. */
const SEM_CARGA = new Set(['hunter']);
for (const p of unicas) {
  if (SEM_CARGA.has(p)) continue;
  ok(casosNav.has(p),
     `navigate() carrega "${p}" ao clicar na aba`);
}

console.log('\n-- e o refresh não esquece nenhuma --');
/* `gerencial` e `sistema` são painéis do Arquiteto: aparecem em
   navigate() e de propósito não entram no refresh automático. */
const SEM_REFRESH = new Set(['hunter', 'gerencial', 'sistema']);
for (const p of casosNav) {
  if (SEM_REFRESH.has(p)) continue;
  ok(casosAtu.has(p),
     `atualizarPaginaAtual() também trata "${p}"`);
}

console.log('\n-- o caso exato que falhou --');
ok(casosNav.has('pacto'),
   'PACTO em navigate() — sem isto a aba abre vazia e o pacto some da vista');
ok(casosAtu.has('pacto'), 'PACTO em atualizarPaginaAtual()');
ok(index.includes('id="page-pacto"'), 'a seção #page-pacto existe no HTML');
ok(index.includes('data-page="pacto"'), 'e a aba aponta para ela');
ok(index.includes('js/pages/pacto.js'), 'e o script está carregado');

console.log('\n-- quem o switch chama precisa existir --');
/* `await Pacto.carregar()` com `Pacto` indefinido derruba a navegação
   inteira — o switch não tem optional chaining. */
/* ARMADILHA JÁ PAGA — não reintroduzir: a primeira versão adivinhava o
   arquivo pelo nome da página (`pages/${pag}.js`) ou pelo nome do objeto
   em minúsculas. Acusou `PainelAdmin` de faltar, quando ele mora em
   `painel-admin.js` — com hífen — e está carregado. Era a heurística
   errada, não o código.

   Agora a busca é pelo fato: qual arquivo DEFINE o objeto, e esse
   arquivo está no index.html? */
const arquivosJs = [];
(function varrer(dir) {
  for (const e of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
    if (e.isDirectory()) varrer(path.join(dir, e.name));
    else if (e.name.endsWith('.js')) arquivosJs.push(path.join(dir, e.name));
  }
})('js');

for (const m of navegar.matchAll(/case\s+'([a-z-]+)'\s*:\s*await\s+([A-Za-z_]+)\./g)) {
  const [, pag, objeto] = m;
  const dono = arquivosJs.find(f =>
    new RegExp(`(const|let|var|window\\.)\\s*${objeto}\\s*=`).test(
      fs.readFileSync(path.join(RAIZ, f), 'utf8')));
  const carregado = dono && index.includes(dono.replace(/\\/g, '/'));
  ok(!!carregado,
     `"${pag}" chama ${objeto} → ${dono || 'NÃO DEFINIDO EM LUGAR NENHUM'}` +
     (dono && !carregado ? ' (existe mas NÃO está no index.html)' : ''));
}

console.log(`\n=== ${testes - falhas}/${testes} ===`);
process.exit(falhas ? 1 : 0);
