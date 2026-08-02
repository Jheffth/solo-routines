/* O BOOT — nenhuma tela pode ser desmentida meio segundo depois.

   O Claude-em-Chrome reportou: ao abrir `localhost:8000` já logado, a
   tela de LOGIN aparece por um instante e só depois vira o dashboard.
   Parece que você foi deslogado.

   Duas causas, e as duas invisíveis lendo só o JavaScript:

     1. `#login-screen` NÃO tinha `hidden` no HTML, enquanto `#main-app`
        tinha. O login era o estado PADRÃO do documento — pintava antes
        de qualquer script rodar.

     2. `App.init` fazia `await _carregarConfigs()` no passo 2 e só
        checava a sessão no passo 9. Dois round-trips EM SÉRIE antes de
        a tela poder decidir. Com o banco em us-east-1, isso são
        segundos de tela errada.

   Uso:  node webapp/frontend/tests/teste_boot.js
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

const index = ler('index.html');
const appJs = ler('js', 'app.js');
const semCom = txt => txt.replace(/\/\*[\s\S]*?\*\//g, '')
                         .replace(/^\s*\/\/.*$/gm, '');

/* ARMADILHA JA PAGA — pela quarta vez neste projeto: fatiar por
   `indexOf` de um nome que tambem aparece como CHAMADA antes da
   definicao. `indexOf('mostrarApp(usuario)')` acha `this.mostrarApp(
   usuario)` dentro do init, que vem ANTES do metodo — a fatia sai
   invertida ou truncada, e os asserts que a usam mentem em silencio.

   `fatia` exige os dois marcos na ordem certa e recusa resultado curto
   demais para conter o que se procura. */
function fatia(txt, de, ate, min = 60) {
  const i = txt.indexOf(de);
  if (i < 0) throw new Error(`marco inicial ausente: ${de}`);
  const j = ate ? txt.indexOf(ate, i + de.length) : txt.length;
  if (ate && j < 0) throw new Error(`marco final ausente depois de ${de}: ${ate}`);
  const r = txt.slice(i, ate ? j : undefined);
  if (r.length < min) throw new Error(`fatia curta demais (${r.length}): ${de} -> ${ate}`);
  return r;
}

console.log('\n-- o estado inicial do documento nao decide nada --');
const attrsDe = (id) => {
  const m = new RegExp(`<div id="${id}"([^>]*)>`).exec(index);
  return m ? m[1] : null;
};
ok(/class="[^"]*hidden/.test(attrsDe('login-screen') || ''),
   'o #login-screen nasce OCULTO (era o estado padrão e pintava primeiro)');
ok(/class="[^"]*hidden/.test(attrsDe('main-app') || ''),
   'o #main-app tambem');
ok(index.includes('id="boot-portal"'),
   'e existe um portal cobrindo tudo enquanto a sessao e checada');
ok(index.indexOf('id="boot-portal"') < index.indexOf('id="login-screen"'),
   'o portal vem ANTES das telas no documento');
ok(index.includes('css/boot.css'), 'o estilo do portal esta carregado');

console.log('\n-- configs e sessao esperam JUNTAS, nao em fila --');
/* O marco final tem de ser CODIGO: `semCom` remove os comentarios, e a
   primeira versao usava um texto que so existia dentro de um. Alem
   disso `_fecharPortal()` aparece como CHAMADA dentro do proprio init —
   com a chave (`_fecharPortal() {`) casa so a DEFINICAO, que vem depois. */
const init = fatia(semCom(appJs), 'async init()', '_fecharPortal() {');
ok(!/await this\._carregarConfigs\(\)/.test(init),
   'o await das configs saiu do meio do boot');
ok(/const promessaConfigs = this\._carregarConfigs\(\)/.test(init) &&
   /const promessaSessao/.test(init),
   'as duas viram promessas disparadas juntas');
const iConfig = init.indexOf('promessaConfigs = ');
const iSessao = init.indexOf('promessaSessao = ');
const iEspera = init.indexOf('await promessaConfigs');
ok(iConfig >= 0 && iSessao >= 0 && iEspera > iSessao,
   'e as DUAS partem antes de qualquer await (senao continuam em serie)');

/* Um `Promise.all` cru faria a primeira falha derrubar a outra: config
   que nao carrega mandaria o hunter para o login. */
ok(/catch \(_\) \{ return null; \}/.test(init),
   'a sessao tem catch proprio — config que falha nao desloga ninguem');

console.log('\n-- o portal so sai depois da decisao --');
ok(/_fecharPortal\(\)/.test(appJs), 'existe quem feche o portal');
const fechar = fatia(appJs, '_fecharPortal() {', 'mostrarApp(usuario) {');
ok(/\.remove\(\)/.test(fechar),
   'o portal e REMOVIDO, nao so escondido (overlay invisivel ainda captura clique)');
ok(/classList\.add\('saindo'\)/.test(fechar),
   'com transicao — corte seco a zero e o que faz uma tela "piscar"');

/* O DASHBOARD CARREGA DEPOIS do portal sair. Segurar o portal ate o
   extrato chegar devolveria a espera em branco. */
const iMostrar = init.indexOf('this.mostrarApp(usuario)');
const iFechar = init.indexOf('this._fecharPortal()');
const iDash = init.indexOf('Dashboard.carregar()');
ok(iMostrar < iFechar && iFechar < iDash,
   'ordem: mostra o app, fecha o portal, e SO ENTAO carrega o dashboard');

console.log('\n-- o boot inteiro, rodando --');
{
  const dom = new JSDOM(index, { pretendToBeVisual: true,
    runScripts: 'outside-only', url: 'http://localhost:8000/' });
  const w = dom.window;
  const doc = w.document;

  /* Antes de qualquer script: e isto que o hunter ve no primeiro pixel. */
  const visivel = (id) => {
    const el = doc.getElementById(id);
    return el && !el.classList.contains('hidden');
  };
  ok(visivel('boot-portal'), 'no primeiro pixel: so o portal esta visivel');
  ok(!visivel('login-screen'), 'o login NAO aparece (era o defeito)');
  ok(!visivel('main-app'), 'e o app tambem nao');
}

console.log('\n-- os esqueletos --');
const esq = ler('js', 'esqueleto.js');
const ctx = vm.createContext({ window: {}, console });
vm.runInContext(esq, ctx);
const E = vm.runInContext('Esqueleto', ctx);

ok(typeof E.lista === 'function' && typeof E.grade === 'function',
   'Esqueleto tem lista() e grade()');
const html = E.lista(4);
ok((html.match(/sk-card/g) || []).length === 4, 'lista(4) devolve 4 blocos');
ok(html.includes('sk-selo') && html.includes('sk-linha titulo'),
   'com a FORMA do cartao (sigilo + titulo), nao um retangulo generico');
ok(html.includes('aria-hidden="true"'),
   'e escondido do leitor de tela — e decoracao, nao conteudo');
ok(!E.lista(2, { botao: false }).includes('sk-botao'),
   'o botao e opcional (paginas em grade nao tem)');

/* O guarda: recarregar uma lista que JA tem conteudo nao pode piscar. */
ok(E.trocar(null, 'x') === false, 'trocar() aceita elemento nulo sem quebrar');
const falso = { innerHTML: '<div class="mc">missao real</div>' };
ok(E.trocar(falso, html) === false && falso.innerHTML.includes('missao real'),
   'NAO troca quando a tela ja tem conteudo real (senao a lista pisca)');
const vazio = { innerHTML: '' };
ok(E.trocar(vazio, html) === true, 'troca quando esta vazia');
const comSpin = { innerHTML: '<div class="loading-spinner"></div>' };
ok(E.trocar(comSpin, html) === true, 'e quando tem o spinner antigo');

console.log('\n-- as paginas trocaram o spinner pelo esqueleto --');
for (const [arq, chamada] of [['rotinas', 'Esqueleto.lista'],
                              ['tarefas', 'Esqueleto.lista'],
                              ['materiais', 'Esqueleto.grade'],
                              ['dungeons', 'Esqueleto.lista']]) {
  const src = ler('js', 'pages', arq + '.js');
  ok(src.includes(chamada), `${arq}.js usa ${chamada}`);
}
/* O GUARDA PRECISA CONHECER O ESQUELETO. `rotinas` e `tarefas` decidem
   se recarregam em silencio olhando o HTML atual; sem `sk-lista` na
   lista de marcadores, um esqueleto pendente passaria por conteudo real
   e a lista nunca se preencheria. */
for (const arq of ['rotinas', 'tarefas']) {
  const src = ler('js', 'pages', arq + '.js');
  ok(/\['loading-spinner', 'sk-lista', 'empty-state'\]/.test(src),
     `${arq}.js: o guarda de recarga silenciosa conhece o esqueleto`);
}
ok(index.indexOf('js/esqueleto.js') < index.indexOf('js/pages/rotinas.js'),
   'esqueleto.js carrega antes de quem o usa');

console.log('\n-- acessibilidade --');
const bootCss = ler('css', 'boot.css');
ok(/@media \(prefers-reduced-motion: reduce\)/.test(bootCss),
   'quem pediu menos movimento tem saida');
ok(/\.sk-selo, \.sk-linha, \.sk-botao \{[\s\S]*?animation: none/.test(bootCss),
   'e os esqueletos param de pulsar');

console.log(`\n=== ${testes - falhas}/${testes} ===`);
process.exit(falhas ? 1 : 0);
