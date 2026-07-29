/* O Portal V4 como peça — FIDELIDADE ao htmlV4 e ciclo de vida.

   A pergunta central: a peça desenha exatamente o que o
   `Estandarte.htmlV4()` desenhava? A comparação é caractere a
   caractere, com os dois rodando no mesmo DOM e com os mesmos dados.

   Uso:  node webapp/frontend/tests/teste_banner_v4.js
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
  nome: 'Jh3ffth', titulo: 'O Arquiteto', classe: 'S-Rank',
  nivel_atual: 42, xp_atual: 900, xp_proximo_nivel: 1000,
  moedas: 1234, streak_atual: 7, nivel_acesso: 'Arquiteto',
  avatar_url: '/img/eu.png', bio: 'Erga-se.', aura_id: 'monarca',
};
const ACERVO = [{ codigo: 'primeira-luz', icone: '🏆' }, { codigo: 'mono-evelynn', icone: '🌙' }];

function ambiente() {
  const dom = new JSDOM('<!doctype html><body><div id="slot" data-slot="banner"></div></body>',
                        { pretendToBeVisual: true });
  const w = dom.window;
  w.Auth = { getUsuario: () => HUNTER };
  w.Auras = {
    _registro: { arquiteto: 1, monarca: 1 },
    existe: id => ['arquiteto', 'monarca'].includes(String(id)),
    bloco: (id, t) => `<div class="aura-wrap" data-a="${id}" data-t="${t}"></div>`,
  };
  w.ConquistaFX = { miniMedalha: (c, t) => `<svg data-m="${c.codigo}" data-t="${t}"></svg>` };
  w.BadgeCard = { ligarTodos: () => {} };
  w.API = { conquistas:{listar:async()=>[]}, perfil:{reliquias:async()=>({})}, auth:{me:async()=>({})} };
  w.console = { log(){}, warn(){}, error(){} };
  return w;
}

function rodar(w, arquivos) {
  const ctx = vm.createContext(w);
  arquivos.forEach(a => vm.runInContext(ler(...a), ctx));
  return ctx;
}

async function main() {
console.log('\n=== O PORTAL V4 COMO PEÇA ===\n');

/* ══ 1. FIDELIDADE ══
   Os dois no MESMO DOM, na mesma ordem: os ids únicos das gemas
   (Gemas._seq) precisam partir do mesmo ponto nas duas gerações,
   senão a diferença seria só do contador. Por isso cada lado tem
   seu próprio ambiente. */
console.log('-- a marcação, contra o htmlV4 da Vitrine --');

const wA = ambiente();
rodar(wA, [['js','gemas.js'], ['js','escudos-img.js'], ['js','banners-arte.js'], ['js','estandarte.js']]);
wA.Estandarte._acervo = ACERVO;
wA.Estandarte._auraReal = 'monarca';
wA.Estandarte._emTesteDash = true;      // é neste modo que o botão do altar aparece

const wB = ambiente();
rodar(wB, [['js','gemas.js'], ['js','escudos-img.js'], ['js','banners-arte.js'],
           ['js','pecas.js'], ['js','pecas','banner-v4.js']]);

const amostras = {};
for (const campo of ['abissal', 'petroleo', 'brasa']) {
  wA.Estandarte._opcoes = Object.assign({}, wA.Estandarte._opcoes, { campo, aura: '', rank: '' });
  const daVitrine = wA.Estandarte.htmlV4(HUNTER);
  const daPeca    = wB.BannerV4.html({ hunter: HUNTER, reliquias: ACERVO }, { campo });
  amostras[campo] = daPeca;

  const norm = s => s.replace(/\s+/g, ' ').trim();
  const igual = norm(daVitrine) === norm(daPeca);
  ok(igual, `campo "${campo}" — ${daPeca.length} caracteres, idêntico ao htmlV4`);
  if (!igual) {
    const a = norm(daVitrine), b = norm(daPeca);
    let i = 0; while (i < a.length && a[i] === b[i]) i++;
    console.log('         diverge em ' + i + ':');
    console.log('         vitrine: …' + JSON.stringify(a.slice(Math.max(0,i-80), i+80)));
    console.log('         peça   : …' + JSON.stringify(b.slice(Math.max(0,i-80), i+80)));
  }
}

/* ANTI-VACUIDADE. Um teste que compara duas coisas que ignoram a
   opção passa sempre e não prova nada. Se os três campos saem
   iguais, a comparação acima não estava exercitando o que dizia. */
ok(amostras.abissal !== amostras.petroleo && amostras.petroleo !== amostras.brasa,
   'os três campos geram HTML DIFERENTE (a comparação não é vazia)');
const cor = h => (h.match(/--pt-fundo:([^;]*)/) || [])[1];
ok(cor(amostras.abissal) === '#0d1030' && cor(amostras.brasa) === '#251208',
   `  e a cor de fundo muda com o campo (abissal ${cor(amostras.abissal)}, brasa ${cor(amostras.brasa)})`);

/* ══ 2. Registro ══ */
console.log('\n-- registro --');
const P = wB.Pecas;
ok(P.existe('banner-v4'), 'a V4 está registrada');
ok(P.padraoDa('banner') === null || P.padraoDa('banner').id !== 'banner-v4',
   'e NÃO é a padrão — entra como opção, a rede continua sendo a clássica');
ok(P.obter('banner-v4').opcoes.campo.includes('abissal'), 'oferece o campo Abissal');

/* ══ 3. Montagem ══ */
console.log('\n-- montagem --');
const doc = wB.document, el = doc.getElementById('slot');
const pedidos = [];
const inst = P.montar(el, 'banner-v4', { hunter: HUNTER, reliquias: ACERVO }, {
  opcoes: { campo: 'abissal' },
  acoes: {
    'trocar-aura':     () => pedidos.push('trocar-aura'),
    'editar-epigrafe': () => pedidos.push('editar-epigrafe'),
    'editar-altar':    () => pedidos.push('editar-altar'),
    'ver-reliquias':   () => pedidos.push('ver-reliquias'),
  },
});
ok(inst !== null, 'monta');
ok(!!el.querySelector('.pt-v4-banner'), 'o banner está lá');
ok(el.querySelector('.pt-nome').textContent === 'Jh3ffth', 'com o nome do hunter');
ok(el.querySelector('.pt-xp-num').textContent === '900 / 1.000 XP', 'e o XP');
ok(el.querySelectorAll('.est-reliquia').length === 2, 'as duas relíquias entregues pelo hospedeiro');
ok(el.querySelector('.pt-v4-quote-text').textContent === 'Erga-se.', 'e a epígrafe do hunter');

/* ══ 4. O carrossel — o vazamento que motivou o contrato ══ */
console.log('\n-- o carrossel (o setInterval que vazava) --');
const grid = el.querySelector('.pt-v4-grid');
ok(P.diagnostico().intervalos === 1, 'o giro automático é UM intervalo, rastreado pelo registro');
ok(!grid.classList.contains('cq-gemas-front'), 'começa com as relíquias à frente');

// o clique do hunter toma o controle e desliga o automático
el.querySelector('#dash-altar-swap').dispatchEvent(new wB.Event('click'));
ok(grid.classList.contains('cq-gemas-front'), 'o clique gira na hora');

P.desmontar(el);
const d = P.diagnostico();
ok(d.intervalos === 0 && d.vivas === 0 && d.ouvintes === 0,
   'e ao desmontar sobra ZERO — o que o fechar() da Vitrine não fazia');

/* ══ 5. As ações voltam ao hospedeiro ══ */
console.log('\n-- os botões pedem, não fazem --');
P.montar(el, 'banner-v4', { hunter: HUNTER, reliquias: ACERVO }, {
  opcoes: { campo: 'abissal' },
  acoes: {
    'trocar-aura':     () => pedidos.push('trocar-aura'),
    'editar-epigrafe': () => pedidos.push('editar-epigrafe'),
    'editar-altar':    () => pedidos.push('editar-altar'),
    'ver-reliquias':   () => pedidos.push('ver-reliquias'),
  },
});
el.querySelector('#dash-btn-trocar-aura').dispatchEvent(new wB.Event('click'));
el.querySelector('#dash-btn-editar-epigrafe').dispatchEvent(new wB.Event('click'));
el.querySelector('.est-reliquia').dispatchEvent(new wB.Event('click'));
ok(pedidos.includes('trocar-aura'), 'o ◈ pede "trocar-aura"');
ok(pedidos.includes('editar-epigrafe'), 'o lápis pede "editar-epigrafe"');
ok(pedidos.includes('ver-reliquias'), 'a relíquia pede "ver-reliquias"');

// há DOIS #dash-altar no HTML (desktop e mobile) — os dois devem funcionar
ok(el.querySelectorAll('#dash-altar').length === 2,
   'existem dois #dash-altar (desktop e mobile) — herança do layout');
el.querySelectorAll('#dash-altar').forEach(b => b.dispatchEvent(new wB.Event('click')));
ok(pedidos.filter(p => p === 'editar-altar').length === 2,
   '  e os DOIS respondem, porque a busca é por querySelectorAll no contêiner');

/* ══ 5b. Os três defeitos que o Arquiteto viu na tela ══ */
console.log('\n-- o que apareceu errado no Dashboard --');

// (a) AS FIXADAS MANDAM. Sem isto a V4 mostrava as cinco mais
//     recentes, ignorando a escolha feita no Altar — foi o
//     "badge com a arte errada".
const SETE = ['a','b','c','d','e','f','g'].map(k => ({ codigo: k, icone: '🏆' }));
P.desmontar(el);
P.montar(el, 'banner-v4', { hunter: HUNTER, reliquias: SETE, reliquias_fixadas: ['g','b'] }, {});
const mostradas = [...el.querySelectorAll('.est-reliquia')].map(n => n.dataset.bc);
ok(JSON.stringify(mostradas) === JSON.stringify(['g','b']),
   `a escolha do Altar manda: pediu [g,b], mostrou [${mostradas}]`);

P.desmontar(el);
P.montar(el, 'banner-v4', { hunter: HUNTER, reliquias: SETE, reliquias_fixadas: [] }, {});
ok(el.querySelectorAll('.est-reliquia').length === 5,
   'sem escolha, valem as cinco primeiras (a sexta não cabe na fila)');

// (b) O HOVER. Estava passando lista VAZIA para o BadgeCard, que
//     monta um mapa por código e só liga o que acha nele.
const ligados = [];
wB.BadgeCard = { ligarTodos: (sel, lista) => ligados.push({ sel, n: (lista || []).length }) };
P.desmontar(el);
P.montar(el, 'banner-v4', { hunter: HUNTER, reliquias: ACERVO }, {});
ok(ligados.length === 1 && ligados[0].n === ACERVO.length,
   `o BadgeCard recebe as ${ACERVO.length} relíquias, não uma lista vazia`);
ok(/data-peca-selo="pc\d+"/.test(ligados[0].sel),
   `  e o seletor é preso a ESTA instância (${ligados[0].sel})`);
ok(el.dataset.pecaSelo && el.querySelector('[data-bc]'),
   '  com o selo carimbado no contêiner para o seletor achar');

// (c) A LARGURA é CSS, não JS: verificada no arquivo.
const css = fs.readFileSync(path.join(RAIZ, 'css', 'estandarte.css'), 'utf8');
ok(/\.hunter-window\[data-peca="banner-v4"\] \.pt-banner \{[^}]*width: 100%/.test(css),
   'o CSS solta a largura do banner dentro do slot (era max-width:1000px, da bancada)');
ok(/\.hunter-window\[data-peca="banner-v4"\] \{[^}]*padding: 0/.test(css),
   '  e neutraliza a moldura da Janela de Status, para não haver duas');

/* ══ 6. A peça não conhece o hospedeiro ══ */
console.log('\n-- a fronteira, no código --');
const fonte = ler('js','pecas','banner-v4.js');
const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
ok(!/document\.getElementById/.test(codigo),
   'nunca usa document.getElementById — toda busca é presa ao contêiner');
ok(!/\bEstandarte\b/.test(codigo), 'e NÃO depende da Vitrine (a inversão foi desfeita)');
ok(!/\bAPI\.|fetch\(/.test(codigo), 'nem busca dado por conta própria');
ok(/\bBannersArte\b/.test(codigo), 'usa o vocabulário compartilhado, como Auras e Gemas');
ok(/\bAuras\b/.test(codigo), '  e fala com Auras direto — biblioteca de desenho não é hospedeiro');

/* ══ 7. Duas na mesma página ══ */
console.log('\n-- Vitrine e Dashboard lado a lado --');
const outro = doc.createElement('div'); doc.body.appendChild(outro);
P.montar(outro, 'banner-v4', { hunter: Object.assign({}, HUNTER, { nome: 'Outro' }) },
         { opcoes: { campo: 'brasa' } });
ok(el.querySelector('.pt-nome').textContent === 'Jh3ffth' &&
   outro.querySelector('.pt-nome').textContent === 'Outro',
   'cada instância desenha a sua');
ok(P.diagnostico().intervalos === 2, 'e cada uma tem o próprio carrossel');
P.desmontarTodas();
ok(P.diagnostico().intervalos === 0, 'os dois somem juntos');

console.log(`\n=== ${testes - falhas}/${testes} ===`);
if (falhas) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
