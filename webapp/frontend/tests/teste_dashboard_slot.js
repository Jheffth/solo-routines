/* O Dashboard hospedando a peça — teste de INTEGRAÇÃO.

   Os outros dois testes olham as peças isoladas. Este monta o
   index.html de verdade, roda o dashboard.js de verdade e pergunta:
   depois de `renderPersonagem()`, a tela é a mesma de antes?

   O gabarito é a marcação que morava no index.html antes do passo 3.
   Comparar contra ele é a única prova possível sem um navegador.

   Uso:  npm i jsdom  &&  node webapp/frontend/tests/teste_dashboard_slot.js
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const RAIZ = path.join(__dirname, '..');
const lerJS = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');

let falhas = 0, testes = 0;
function ok(cond, msg) {
  testes++; if (!cond) falhas++;
  console.log((cond ? '  [ok]  ' : '  [XX]  ') + msg);
}
const espera = ms => new Promise(r => setTimeout(r, ms));

async function main() {
console.log('\n=== O DASHBOARD HOSPEDANDO A PEÇA ===\n');

/* A `url` não é enfeite: sem ela o jsdom serve a página como
   "about:blank", e aí `localStorage` LANÇA SecurityError. Como a
   preferência de banner é lida dentro de um try/catch, o erro sumiria
   em silêncio e o teste acusaria "a preferência não funciona" quando
   o problema era o ambiente do teste. */
const dom = new JSDOM(fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8'),
                      { pretendToBeVisual: true, runScripts: 'outside-only',
                        url: 'http://localhost/' });
const w = dom.window, doc = w.document;

/* ── Dublês: só o que renderPersonagem encosta ───────────── */
const chamadas = [];
const RELIQUIAS = [
  { codigo: 'a', desbloqueada: true, desbloqueada_em: '2026-01-03' },
  { codigo: 'b', desbloqueada: true, desbloqueada_em: '2026-01-02' },
  { codigo: 'c', desbloqueada: false },
];
w.API = {
  conquistas: { listar: async () => { chamadas.push('conquistas'); return RELIQUIAS; } },
  perfil:     { reliquias: async () => { chamadas.push('reliquias'); return { fixadas: [] }; } },
  dungeons:   { listar: async () => [] },
  auth:       { me: async () => ({}) },
  get: async () => ({}), post: async () => ({}),
};
const navegou = [];
w.App   = { navigate: p => navegou.push(p) };
w.Auras = { existe: () => false, bloco: () => '<div class="aura-wrap"></div>', aplicar: () => {} };
w.ConquistaFX = { miniMedalha: c => `<svg data-m="${c.codigo}"></svg>` };
w.BadgeCard = { ligarTodos: () => {} };
w.AltarReliquias = { abrir: cb => { chamadas.push('altar'); cb && cb(); } };
w.BuscaHunters = { montar: () => {} };
w.SoloDialog = { toast(){}, confirm: async () => false };
w.MissaoCard = { pararTimer(){} };
w.Chart = function(){ this.destroy = () => {}; };
let pintadas = 0;
w.HTMLCanvasElement.prototype.getContext = function () {
  return { clearRect(){}, beginPath(){}, arc(){}, fill(){ pintadas++; },
           set fillStyle(v){}, set globalAlpha(v){} };
};
const erros = [];
w.console = { log(){}, warn(){}, error: (...a) => erros.push(a.join(' ')) };

/* A MESMA ORDEM do index.html. Se o teste carregasse menos scripts
   que a página, ele provaria uma configuração que não existe — foi o
   que aconteceu quando a V4 entrou: sem `banner-v4.js` carregado, o
   slot caía na clássica e o teste dizia que o padrão não funcionava. */
const ctx = vm.createContext(w);
[['js','pecas.js'],
 ['js','gemas.js'], ['js','escudos-img.js'], ['js','banners-arte.js'],
 ['js','pecas','hunter-card-classico.js'],
 ['js','pecas','banner-v4.js'],
 ['js','pages','dashboard.js'],
].forEach(p => vm.runInContext(lerJS(...p), ctx));

/* `const Dashboard = {...}` num script clássico NÃO vira propriedade
   de window — fica no escopo léxico global. É a mesma pegadinha que
   já mordeu o SoloDialog neste projeto. Por isso o acesso é por
   avaliação no contexto, e não por `w.Dashboard` (que é undefined). */
const D = vm.runInContext('Dashboard', ctx);
ok(!!D, 'o Dashboard existe (via escopo léxico — não está em window)');
const slot = doc.getElementById('hunter-card');

/* ── 1. O ponto de partida ───────────────────────────────── */
console.log('-- o slot antes de qualquer coisa --');
ok(!!slot, '#hunter-card existe no index.html');
ok(slot.innerHTML.trim() === '', 'e está VAZIO (a marcação saiu daqui)');
ok(slot.dataset.pecaPadrao === 'banner-v4',
   'e o slot abre na V4 (o padrão declarado no HTML desde a ativação)');

/* ── 2. O Dashboard monta ────────────────────────────────── */
console.log('\n-- renderPersonagem() --');
const hunter = {
  id: 1, nome: 'Jh3ffth', classe: 'S-Rank', rank: 'S',
  nivel_atual: 42, moedas: 1234, streak_atual: 7,
  xp_atual: 900, xp_proximo_nivel: 1000,
  nivel_acesso: 'Arquiteto', avatar_url: '/img/eu.png',
};
/* Este teste continua provando a FIDELIDADE da peça clássica: ela é
   a rede de segurança de todas as outras, e o dia em que ela quebrar
   é o dia em que um erro na V4 vira tela vazia. Por isso monta-se
   ela explicitamente, e não o padrão do slot. */
D.usarBanner('hunter-card-classico');
D.renderPersonagem(hunter);
ok(!!slot.__peca, 'a peça foi montada no slot');
ok(slot.dataset.peca === 'hunter-card-classico', 'e é a clássica, montada por preferência');
ok(erros.length === 0, `sem erros no console (${erros.join(' | ') || 'nenhum'})`);

/* ── 3. FIDELIDADE: a tela é a mesma? ────────────────────── */
console.log('\n-- a tela contra o gabarito --');
const gabarito = doc.createElement('div');
gabarito.innerHTML = fs.readFileSync(path.join(__dirname, 'gabarito-hunter-card.html'), 'utf8');

/* A comparação certa é de INCLUSÃO, não de igualdade. A peça
   pintada legitimamente tem MAIS coisa que o gabarito: relíquias,
   selos de rank, o botão ◈ — tudo que só existe depois dos dados.
   E tem classes a mais nos mesmos nós: com 90% de XP a barra ganha
   `quase`, que é o ouro de quem está perto de subir.

   Então: para cada caixa do gabarito, existe na tela um nó com a
   mesma tag e com TODAS aquelas classes? Se sim, nada sumiu. */
const caixas = n => [...n.querySelectorAll('*')]
  .filter(e => !['IMG', 'SVG', 'BUTTON'].includes(e.tagName))
  .map(e => ({ tag: e.tagName, cls: [...e.classList] }));

const naTela = caixas(slot);
const faltando = caixas(gabarito).filter(g =>
  !naTela.some(t => t.tag === g.tag && g.cls.every(c => t.cls.includes(c))));

ok(faltando.length === 0,
   'nenhuma caixa do gabarito sumiu da tela' +
   (faltando.length ? ' — faltam: ' + faltando.map(f => f.tag + '.' + f.cls.join('.')).join(', ') : ''));
ok(slot.querySelector('.hunter-xp-track').classList.contains('quase'),
   '  (e a barra ganhou "quase": 90% de XP acende o ouro)');

const idsGab  = [...gabarito.querySelectorAll('[id]')].map(e => e.id).sort();
const idsTela = [...slot.querySelectorAll('[id]')].map(e => e.id).sort();
const idsSumidos = idsGab.filter(i => !idsTela.includes(i));
ok(idsSumidos.length === 0,
   `os ${idsGab.length} ids do cartão continuam na tela${idsSumidos.length ? ' — sumiram: ' + idsSumidos.join(', ') : ''}`);
ok(idsTela.includes('dash-btn-trocar-aura'),
   'e o botão ◈ de aura foi injetado, como o dashboard.js fazia');

/* ── 4. Os dados chegaram ────────────────────────────────── */
console.log('\n-- os dados do hunter --');
ok(slot.querySelector('#dash-nome').textContent === 'Jh3ffth', 'o nome');
ok(slot.querySelector('#dash-rank-selo').textContent === 'S', 'o selo de rank');
ok(slot.querySelector('#dash-xp-txt').textContent === '900 / 1.000 XP', 'o XP');
ok(slot.querySelector('#dash-rank-badge').textContent.includes('ARQUITETO'), 'o selo de Arquiteto');
ok(slot.querySelector('#dash-avatar').innerHTML.includes('/img/eu.png'), 'o avatar');
ok(doc.getElementById('sidebar-nome').textContent === 'Jh3ffth',
   'e a BARRA LATERAL continua sendo trabalho do hospedeiro');

// O título: a tabela do dashboard.js foi copiada para a peça. Se
// alguém "melhorar" os nomes, o hunter vê o próprio título mudar.
ok(slot.querySelector('#dash-titulo').textContent === '"Monarch"',
   'o título de S-Rank é "Monarch" — o mesmo de antes, não um inventado');

/* ── 5. As relíquias chegam depois (duas chamadas de rede) ── */
console.log('\n-- relíquias, que chegam atrasadas --');
await espera(30);
ok(chamadas.includes('conquistas') && chamadas.includes('reliquias'),
   'o HOSPEDEIRO buscou as relíquias (a peça não chama a API)');
ok(slot.querySelectorAll('.hunter-reliquia').length === 2,
   'as duas desbloqueadas apareceram (a terceira não está)');
ok(slot.querySelector('#dash-nome').textContent === 'Jh3ffth',
   'e a chegada delas não apagou o resto do cartão');

/* ── 6. Repintura não pisca ──────────────────────────────── */
console.log('\n-- repintura (o atualizarNumeros) --');
const noNome = slot.querySelector('#dash-nome');
const noRel  = slot.querySelector('.hunter-reliquia');
D.renderPersonagem(Object.assign({}, hunter, { moedas: 9999 }));
ok(slot.querySelector('#dash-nome') === noNome,
   'o nó do nome é O MESMO: repintou, não remontou');
await espera(30);
ok(slot.querySelectorAll('.hunter-reliquia').length === 2,
   'e as relíquias não sumiram na repintura');

/* ── 7. As ações voltam para o hospedeiro ────────────────── */
console.log('\n-- a peça pede, o Dashboard faz --');
slot.querySelector('#dash-btn-editar-perfil').dispatchEvent(new w.Event('click'));
ok(navegou.includes('perfil'), 'clicar em "Editar Perfil" navega — decisão do hospedeiro');
slot.querySelector('.hunter-reliquia').dispatchEvent(new w.Event('click'));
ok(navegou.filter(p => p === 'perfil').length === 2, 'clicar numa relíquia também');
const altarAntes = chamadas.filter(c => c === 'altar').length;
slot.querySelector('#dash-altar')?.dispatchEvent(new w.Event('click'));
ok(chamadas.filter(c => c === 'altar').length === altarAntes + 1,
   'e o ✎ abre o Altar de Relíquias');

/* ── 8. Partículas ───────────────────────────────────────── */
console.log('\n-- partículas --');
await espera(50);
ok(pintadas > 0, `o canvas de mana está sendo pintado (${pintadas})`);

/* ── 9. Sair da página limpa tudo ────────────────────────── */
console.log('\n-- sair do Dashboard --');
const antesDePartir = pintadas;
D._pararTimerDash();
const diag = w.Pecas.diagnostico();
ok(diag.vivas === 0, 'a peça foi desmontada ao trocar de página');
ok(diag.ouvintes === 0 && diag.quadros === 0 && diag.intervalos === 0,
   'ZERO ouvintes, quadros e timers — inclusive o resize da janela');
await espera(50);
ok(pintadas === antesDePartir, `as partículas pararam (travadas em ${antesDePartir})`);
ok(slot.innerHTML.trim() === '', 'e o slot voltou a ficar vazio');

/* ── 10. Voltar ao Dashboard remonta ─────────────────────── */
console.log('\n-- voltar --');
D.renderPersonagem(hunter);
ok(!!slot.__peca && slot.querySelector('#dash-nome').textContent === 'Jh3ffth',
   'voltar ao Dashboard remonta o cartão do zero');
ok(w.Pecas.diagnostico().vivas === 1, 'e não fica uma instância duplicada');

/* ── 11. A rede de segurança ─────────────────────────────── */
console.log('\n-- se a peça escolhida falhar --');
D._pararTimerDash();
D.usarBanner('peca-que-nao-existe');
erros.length = 0;
D.renderPersonagem(hunter);
/* SÃO DUAS REDES, e é importante não confundi-las:
   1ª — preferência apontando para peça que não existe cai no padrão
        DECLARADO NO SLOT (hoje a V4);
   2ª — se essa também falhasse ao montar, o registro cairia na peça
        marcada `padrao: true`, que é a clássica.
   Aqui se exercita a primeira. */
ok(slot.dataset.peca === 'banner-v4',
   'preferência inexistente cai no padrão declarado no slot');
ok(!!slot.querySelector('.pt-v4-banner'), '  e o hunter vê um banner, não um buraco');
ok(slot.querySelector('.pt-nome').textContent === 'Jh3ffth', '  com o nome no lugar');

/* A segunda rede: a V4 registrada, mas quebrada na montagem. */
D._pararTimerDash();
const v4 = w.Pecas.obter('banner-v4');
const montarBom = v4.montar;
v4.montar = () => { throw new Error('a V4 quebrou'); };
erros.length = 0;
D.renderPersonagem(hunter);
ok(slot.dataset.peca === 'hunter-card-classico',
   'V4 estourando ao montar cai para a CLÁSSICA (a rede de verdade)');
ok(slot.querySelector('#dash-nome').textContent === 'Jh3ffth', '  e o cartão de sempre aparece');
v4.montar = montarBom;

/* E a V4 boa, montada pelo padrão do slot. */
D._pararTimerDash();
D.usarBanner(null);
D.renderPersonagem(hunter);
ok(slot.dataset.peca === 'banner-v4', 'sem preferência, o slot abre na V4');

/* ── Repintura da V4: o banner NÃO pode piscar ─────────────
   Foi a reclamação que reescreveu as listas de missão. Um banner
   que apaga e volta a cada missão iniciada seria a mesma dor, num
   lugar mais visível. */
console.log('\n-- a V4 repinta sem piscar --');
const noBanner = slot.querySelector('.pt-v4-banner');
const noNomeV4 = slot.querySelector('.pt-nome');
D.renderPersonagem(Object.assign({}, hunter, { moedas: 9999, xp_atual: 950 }));
ok(slot.querySelector('.pt-v4-banner') === noBanner, 'o banner é O MESMO nó: repintou');
ok(slot.querySelector('.pt-nome') === noNomeV4, '  e o nome também');
const gemas = slot.querySelectorAll('.pt-gema .gema-valor');
ok(gemas[1] && gemas[1].textContent === '9.999', '  a gema de mana chegou em 9.999');
ok(slot.querySelector('.pt-xp-num').textContent === '950 / 1.000 XP', '  e o XP acompanhou');

// Mas trocar de RANK muda a moldura inteira: aí remontar é o certo.
D.renderPersonagem(Object.assign({}, hunter, { classe: 'B-Rank' }));
ok(slot.querySelector('.pt-v4-banner') !== noBanner,
   'trocar de rank REMONTA — a peça pede, porque a moldura mudou de cor');
ok(slot.querySelector('.pt-chip-rank').textContent === 'B-Rank', '  e o chip mostra o novo rank');

/* ── 12. O que o dashboard.js deixou de saber ────────────── */
console.log('\n-- a fronteira, no código --');
const fonte = lerJS('js', 'pages', 'dashboard.js');
const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const proibidos = ['dash-nome','dash-titulo','dash-avatar','dash-nivel','dash-moedas',
                   'dash-streak','dash-xp-bar','dash-xp-txt','dash-rank-selo',
                   'dash-rank-badge','dash-relicario','dash-altar','hunter-fx',
                   'hunter-hex-wrap','hunter-xp-track','cristal-streak'];
const achados = proibidos.filter(id => codigo.includes(id));
ok(achados.length === 0,
   `o dashboard.js não toca em NENHUM id do cartão${achados.length ? ' — ainda toca: ' + achados.join(', ') : ''}`);
ok(!/_initFxJanela|_bindBtnTrocarAura|_getTituloByRank|_RANK_CORES/.test(codigo),
   'e as funções de desenho saíram de vez');

D._pararTimerDash();
console.log(`\n=== ${testes - falhas}/${testes} ===`);
if (falhas) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
