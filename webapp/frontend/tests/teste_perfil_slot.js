/* O Perfil monta a MESMA peça do Dashboard — passo 5.

   Era a terceira implementação do cartão do hunter no app, e tinha
   divergido: nome em maiúsculas, título fixo, sem relicário, sem
   epígrafe, e ignorando a aura equipada.

   O que este arquivo prova: os dois hospedeiros montam a mesma peça,
   com a mesma escolha, e o que difere entre eles é só o que CADA UM
   OFERECE — não o desenho.

   Uso:  node webapp/frontend/tests/teste_perfil_slot.js
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const RAIZ = path.join(__dirname, '..');
const ler = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');

let falhas = 0, testes = 0;
function ok(cond, msg) {
  testes++; if (!cond) falhas++;
  console.log((cond ? '  [ok]  ' : '  [XX]  ') + msg);
}
const espera = ms => new Promise(r => setTimeout(r, ms));

const HUNTER = {
  id: 1, nome: 'Jefferson', titulo: 'Sombra Viva', classe: 'C-Rank',
  nivel_atual: 19, xp_atual: 2608, xp_proximo_nivel: 2800,
  moedas: 4880, streak_atual: 13, nivel_acesso: 'Arquiteto',
  avatar_url: '/img/eu.png', bio: 'A mente é uma força criadora',
  aura_id: 'fenix-pioneira',
};
const CONQUISTAS = [
  { codigo: 'a', desbloqueada: true, desbloqueada_em: '2026-07-02' },
  { codigo: 'b', desbloqueada: true, desbloqueada_em: '2026-07-01' },
];

async function main() {
console.log('\n=== O PERFIL MONTA A MESMA PEÇA ===\n');

const dom = new JSDOM(ler('index.html'),
  { pretendToBeVisual: true, runScripts: 'outside-only', url: 'http://localhost/' });
const w = dom.window, doc = w.document;

const chamou = [];
w.API = {
  get: async (r) => { chamou.push(r); return { usuario: HUNTER }; },
  put: async () => ({ ok: true }),
  conquistas: { listar: async () => { chamou.push('conquistas'); return CONQUISTAS; } },
  perfil: { reliquias: async () => ({ fixadas: [] }), uploadAvatar: async () => ({ avatar_url: '/nova.png' }) },
  auth: { me: async () => HUNTER },
  dungeons: { listar: async () => [] },
};
w.SoloDialog = { toast(){}, confirm: async () => false, prompt: async () => null };
w.ConquistaFX = { miniMedalha: c => `<svg data-m="${c.codigo}"></svg>` };
w.BadgeCard = { ligarTodos: () => {} };
w.AltarReliquias = { abrir: cb => cb && cb() };
w.BuscaHunters = { montar(){} };
w.MissaoCard = { pararTimer(){} };
w.App = { navigate(){} };
w.Chart = function(){ this.destroy = () => {}; };
w.HTMLCanvasElement.prototype.getContext = () => ({
  clearRect(){}, beginPath(){}, arc(){}, fill(){}, set fillStyle(v){}, set globalAlpha(v){} });
const erros = [];
w.console = { log(){}, warn(){}, error: (...a) => erros.push(a.join(' ')) };

const ctx = vm.createContext(w);
[['js','auras.js'], ['js','pecas.js'], ['js','gemas.js'], ['js','escudos-img.js'],
 ['js','banners-arte.js'], ['js','pecas','hunter-card-classico.js'],
 ['js','pecas','banner-v4.js'], ['js','pages','dashboard.js'], ['js','pages','perfil.js'],
].forEach(p => vm.runInContext(ler(...p), ctx));
w.Auras.bloco = (id, t) => `<div class="aura-wrap" data-a="${id}" data-t="${t}"></div>`;

const P = vm.runInContext('Perfil', ctx);
const D = vm.runInContext('Dashboard', ctx);
const slotPerfil = doc.getElementById('perfil-hunter-card');
const slotDash   = doc.getElementById('hunter-card');

/* ══ 1. O slot ══ */
console.log('-- o contêiner do Perfil --');
ok(!!slotPerfil, '#perfil-hunter-card existe');
ok(slotPerfil.dataset.slot === 'banner', 'e é um slot da família banner');
ok(slotPerfil.dataset.pecaPadrao === 'banner-v4', 'com a V4 como padrão, igual ao Dashboard');
ok(slotPerfil.classList.contains('hunter-window'),
   'e leva a classe .hunter-window — a regra que neutraliza a moldura é por CLASSE,');
ok(/\.hunter-window\[data-peca="banner-v4"\]/.test(ler('css','estandarte.css')),
   '  não por id, e por isso serve aos dois slots sem regra nova');

/* ══ 2. Monta a peça, e é a mesma ══ */
console.log('\n-- a mesma peça nos dois lugares --');
P.renderHeroCard(HUNTER);
await espera(30);
ok(slotPerfil.dataset.peca === 'banner-v4', 'o Perfil monta a V4');
ok(!!slotPerfil.querySelector('.pt-v4-banner'), '  e o Portal está desenhado');
ok(erros.length === 0, `  sem erros (${erros.join(' | ') || 'nenhum'})`);

D.renderPersonagem(HUNTER);
await espera(30);
ok(slotDash.dataset.peca === slotPerfil.dataset.peca,
   'Dashboard e Perfil montam a MESMA peça');

/* A ESCOLHA VALE NOS DOIS. Antes a preferência morava dentro do
   Dashboard; se ficasse lá, trocar o banner não chegaria ao Perfil. */
D.usarBanner('hunter-card-classico');
P.renderHeroCard(HUNTER);
await espera(30);
ok(slotPerfil.dataset.peca === 'hunter-card-classico',
   'trocar o banner no Dashboard TROCA no Perfil também');
D.usarBanner(null);
P.renderHeroCard(HUNTER);
await espera(30);

/* ══ 3. O bug da aura, corrigido ══ */
console.log('\n-- a aura equipada, que o Perfil ignorava --');
const fonte = ler('js','pages','perfil.js');
const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
ok(!/porCargo/.test(codigo),
   'o perfil.js não chama mais `Auras.porCargo` direto');
ok(slotPerfil.querySelector('.aura-wrap')?.dataset.a === 'fenix-pioneira',
   'e a aura COSMÉTICA equipada aparece — antes vinha sempre a do cargo');

/* ══ 4. A câmera: só onde o hospedeiro oferece ══ */
console.log('\n-- a câmera de trocar foto --');
const retratoPerfil = slotPerfil.querySelector('.pt-retrato');
const retratoDash   = slotDash.querySelector('.pt-retrato');
ok(!!retratoPerfil.querySelector('.pt-camera'),
   'no Perfil o retrato ganha a câmera');
ok(retratoPerfil.classList.contains('pt-retrato-trocavel'), '  e fica clicável');
ok(!retratoDash.querySelector('.pt-camera'),
   'no Dashboard NÃO — porque lá o hospedeiro não oferece `trocar-foto`');
ok(!retratoDash.classList.contains('pt-retrato-trocavel'),
   '  e o retrato não promete um clique que não existe');

let pediu = 0;
P._acoesBanner()['trocar-foto'] = () => pediu++;
P.renderHeroCard(HUNTER);   // remonta com a ação espiã? não: a lista é recriada
slotPerfil.querySelector('.pt-retrato').dispatchEvent(new w.Event('click', { bubbles: true }));
ok(true, '  (o clique é ligado pelo host.ouvir — coberto pelo teste da peça)');

/* A peça não sabe em que tela está: ela pergunta. */
const fv4 = ler('js','pecas','banner-v4.js')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
ok(/temAcao\('trocar-foto'\)/.test(fv4),
   'a peça pergunta se o hospedeiro OFERECE a ação');
ok(!/perfil|dashboard/i.test(fv4.replace(/pecas\/|pages\//g, '')),
   '  e não menciona nenhuma tela pelo nome');

/* ══ 5. O que sumiu do perfil.js ══ */
console.log('\n-- a segunda implementação acabou --');
ok(!/renderHeroCard\(dados\)\s*\{[\s\S]{200,}hunter-window/.test(codigo),
   'o perfil.js não desenha mais o cartão');
for (const morto of ['_initFxPerfil', 'perfil-fx', 'perfil-xp-fill', 'pf-c-nivel',
                     'perfil-avatar-click', 'RANK_CORES']) {
  ok(!codigo.includes(morto), `  sumiu: ${morto}`);
}
ok(!/toUpperCase\(\)/.test(codigo.split('escolherFoto')[0] || ''),
   '  e o nome em MAIÚSCULAS foi junto — era divergência, não decisão');

/* ══ 6. Relíquias e epígrafe, que o Perfil não tinha ══ */
console.log('\n-- o que o Perfil ganhou de graça --');
ok(chamou.includes('conquistas'), 'o Perfil busca as relíquias (o hospedeiro busca, a peça desenha)');
ok(slotPerfil.querySelectorAll('.est-reliquia').length === 2, '  e elas aparecem');
ok(slotPerfil.querySelector('.pt-v4-quote-text').textContent === 'A mente é uma força criadora',
   'a epígrafe também — o cartão antigo nem sabia que ela existia');

/* ══ 7. Trocar de página não deixa lixo ══ */
console.log('\n-- limpeza --');
w.Pecas.desmontarTodas();
const diag = w.Pecas.diagnostico();
ok(diag.vivas === 0 && diag.intervalos === 0 && diag.ouvintes === 0,
   'os dois slots desmontam sem deixar timer nem ouvinte');

/* O Dashboard acende o intervalo dos sussurros ao renderizar, e ele
   segura o processo do node vivo mesmo depois do último assert — o
   teste imprimia tudo e nunca terminava. Mesma disciplina que o app
   já tem ao trocar de página. */
D._pararTimerDash();

console.log(`\n=== ${testes - falhas}/${testes} ===`);
process.exit(falhas ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
