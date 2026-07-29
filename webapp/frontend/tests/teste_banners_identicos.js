/* As quatro versões do banner, antes e depois — teste de NÃO-REGRESSÃO.

   A extração do vocabulário de desenho mexe em código que a V1, a V2,
   a V3 e a V4 usam. Nenhuma delas pode mudar um caractere.

   Este teste não guarda gabarito em arquivo: ele pega o estandarte.js
   de um COMMIT do git e o da árvore de trabalho, roda os dois com o
   mesmo hunter de mentira, e compara a saída das quatro versões vezes
   os três campos de cor. Se um pixel de HTML mudar, ele aponta onde.

   Uso:  node webapp/frontend/tests/teste_banners_identicos.js [commit]
         (o commit padrão é o anterior à extração)
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { JSDOM } = require('jsdom');

const RAIZ = path.join(__dirname, '..');
const REPO = path.join(RAIZ, '..', '..');
const REF  = process.argv[2] || 'HEAD';

let falhas = 0, testes = 0;
function ok(cond, msg) {
  testes++; if (!cond) falhas++;
  console.log((cond ? '  [ok]  ' : '  [XX]  ') + msg);
}

/* O hunter de mentira. Fixo de propósito: qualquer coisa aleatória
   faria as duas execuções divergirem por motivo errado. */
const HUNTER = {
  nome: 'Jh3ffth', titulo: 'O Arquiteto', classe: 'S-Rank',
  nivel_atual: 42, xp_atual: 900, xp_proximo_nivel: 1000,
  moedas: 1234, streak_atual: 7, nivel_acesso: 'Arquiteto',
  avatar_url: '/img/eu.png', bio: 'Erga-se.',
};
const ACERVO = [
  { codigo: 'primeira-luz', icone: '🏆' },
  { codigo: 'mono-evelynn', icone: '🌙' },
];

/* Roda um estandarte.js num DOM limpo e devolve o HTML das 4 versões
   em todos os campos de cor. O DOM é novo a cada execução para que os
   contadores de id único (Gemas._seq) partam do mesmo lugar. */
function renderizar(fonteEstandarte, fonteGemas, fonteEscudos) {
  const dom = new JSDOM('<!doctype html><body></body>');
  const w = dom.window;
  w.Auth = { getUsuario: () => HUNTER };
  w.Auras = {
    _registro: { arquiteto: 1, monarca: 1 },
    existe: id => ['arquiteto', 'monarca'].includes(String(id)),
    bloco: (id, t) => `<div class="aura-wrap" data-a="${id}" data-t="${t}"></div>`,
  };
  w.ConquistaFX = { miniMedalha: (c, t) => `<svg data-m="${c.codigo}" data-t="${t}"></svg>` };
  w.API = { conquistas: { listar: async () => [] }, perfil: { reliquias: async () => ({}) }, auth: { me: async () => ({}) } };
  w.console = { log(){}, warn(){}, error(){} };

  const ctx = vm.createContext(w);
  if (fonteGemas)   vm.runInContext(fonteGemas, ctx);
  if (fonteEscudos) vm.runInContext(fonteEscudos, ctx);
  vm.runInContext(fonteEstandarte, ctx);

  const E = w.Estandarte;
  if (!E) throw new Error('Estandarte não ficou em window');

  E._acervo = ACERVO;
  E._auraReal = 'monarca';

  const saida = {};
  for (const campo of Object.keys(E.CAMPOS || { petroleo: 1 })) {
    for (const [nome, fn] of [['V1', 'html'], ['V2', 'htmlV2'], ['V3', 'htmlV3'], ['V4', 'htmlV4']]) {
      if (typeof E[fn] !== 'function') continue;
      // opções fixas: nada pode vir de estado acumulado
      E._opcoes = Object.assign({}, E._opcoes, { campo, tecido: 'obsidiana', aura: '', rank: '' });
      saida[`${nome}·${campo}`] = E[fn](HUNTER);
    }
  }
  return saida;
}

function doGit(ref, arquivo) {
  try {
    return execFileSync('git', ['show', `${ref}:${arquivo}`], { cwd: REPO, encoding: 'utf8' });
  } catch (_) { return null; }
}

console.log(`\n=== OS BANNERS, ANTES (${REF}) E DEPOIS ===\n`);

const rel = p => path.posix.join('webapp/frontend', p);
const antes = renderizar(
  doGit(REF, rel('js/estandarte.js')),
  doGit(REF, rel('js/gemas.js')),
  doGit(REF, rel('js/escudos-img.js')),
);
const depoisFontes = [
  fs.existsSync(path.join(RAIZ, 'js/banners-arte.js')) ? fs.readFileSync(path.join(RAIZ, 'js/banners-arte.js'), 'utf8') : '',
  fs.readFileSync(path.join(RAIZ, 'js/estandarte.js'), 'utf8'),
].join('\n;\n');
const depois = renderizar(
  depoisFontes,
  fs.readFileSync(path.join(RAIZ, 'js/gemas.js'), 'utf8'),
  fs.readFileSync(path.join(RAIZ, 'js/escudos-img.js'), 'utf8'),
);

const chaves = [...new Set([...Object.keys(antes), ...Object.keys(depois)])].sort();
ok(chaves.length > 0, `${chaves.length} combinações de versão × campo para comparar`);

for (const k of chaves) {
  const a = antes[k], b = depois[k];
  if (a === undefined) { ok(false, `${k}: só existe DEPOIS`); continue; }
  if (b === undefined) { ok(false, `${k}: DESAPARECEU`); continue; }
  const igual = a === b;
  ok(igual, `${k} — ${a.length} caracteres, idêntico`);
  if (!igual) {
    let i = 0; while (i < a.length && a[i] === b[i]) i++;
    console.log('         diverge em ' + i + ':');
    console.log('         antes : …' + JSON.stringify(a.slice(Math.max(0, i - 70), i + 70)));
    console.log('         depois: …' + JSON.stringify(b.slice(Math.max(0, i - 70), i + 70)));
  }
}

console.log(`\n=== ${testes - falhas}/${testes} ===`);
if (falhas) process.exit(1);
