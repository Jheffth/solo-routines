/* ============================================================
   TESTE — A BANCADA DO ARQUITETO (medidores de punicao)

   O par deste arquivo no backend e `test_medidor.py`, que prova as
   regras. Aqui provamos a TELA, e sobretudo as tres coisas que ela
   pode fazer de errado:

   1. MOSTRAR A BARRA PARA QUEM NAO DEVE VE-LA.
      O medidor existe para todo hunter — e o que move o gatilho. Mas
      saber que faltam duas falhas transforma a punicao num orcamento
      ("ainda posso falhar duas"), o oposto do que ela deve provocar.
      E quem decide e o SERVIDOR (`sou_arquiteto`), nunca um campo que
      o proprio cliente guarda.

   2. CONFUNDIR "MEDINDO" COM "PUNINDO".
      Em modo observacao a barra enche e nao pune. Se a tela nao disser
      isso com todas as letras, o Arquiteto vai encher uma barra, nao
      ver punicao nenhuma e concluir que o sistema quebrou — quando ele
      esta funcionando exatamente como projetado.

   3. ACUMULAR LISTENERS.
      As barras sao repintadas a cada acao. Um listener por botao ou
      morre com o innerHTML, ou se empilha a cada repintura e um clique
      passa a valer por tres. Por isso a delegacao — e ha assert nela.

   Uso: NODE_PATH=/tmp/deps/node_modules node teste_bancada_medidor.js
   ============================================================ */
const fs   = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

let falhas = 0, testes = 0;
const ok = (cond, msg) => {
  testes++;
  if (!cond) falhas++;
  console.log((cond ? '  [ok]  ' : '  [XX]  ') + msg);
};

const RAIZ  = path.join(__dirname, '..');
const fonte = fs.readFileSync(path.join(RAIZ, 'js', 'pages', 'pacto.js'), 'utf8');
const html  = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const css   = fs.readFileSync(path.join(RAIZ, 'css', 'pacto.css'), 'utf8');

const MEDIDORES = [
  { rotina_id: 1, titulo: 'Acordar às 06:00', prioridade: 'ALTA',  dificuldade: 'NORMAL',
    carga: 80, passo: 40, cheio: false, falhas_para_encher: 1 },
  { rotina_id: 2, titulo: 'Ler 05 páginas',   prioridade: 'MEDIA', dificuldade: 'NORMAL',
    carga: 0,  passo: 25, cheio: false, falhas_para_encher: 4 },
  { rotina_id: 3, titulo: 'Sem café',         prioridade: 'CRITICA', dificuldade: 'NORMAL',
    carga: 100, passo: 100, cheio: true, falhas_para_encher: 0 },
];

function montar(resposta) {
  const dom = new JSDOM(`<!doctype html><html><body>
    <span id="nav-pacto-badge" class="hidden"></span>
    <div id="pacto-aviso"></div>
    <div id="pacto-lista"></div>
    <div id="pacto-bancada" hidden>
      <span id="medidor-estado"></span>
      <button id="btn-limpar-testes" hidden>Varrer testes</button>
      <p id="medidor-nota"></p>
      <div id="pacto-medidores"></div>
    </div>
  </body></html>`, { runScripts: 'outside-only', url: 'http://localhost/' });

  const win = dom.window;
  win.chamadas = [];
  win.API = {
    get: async (u) => { win.chamadas.push(['GET', u]); return resposta; },
    post: async (u, b) => { win.chamadas.push(['POST', u, b]); return win.__respPost || { ok: true }; },
  };
  win.SoloDialog = { toast: (m, t) => win.chamadas.push(['toast', t, m]) };
  const ctx = dom.getInternalVMContext();
  require('vm').runInContext(fonte + '\n;globalThis.__P = Pacto;', ctx);
  return { win, doc: win.document, P: win.__P };
}

async function rodar() {
  console.log('\n=== A BANCADA DO ARQUITETO ===\n');

  /* ── 1. O user comum nao ve ─────────────────────────────────── */
  console.log('-- quem ve e quem nao ve --');
  {
    const { doc, P } = montar({ medidores: MEDIDORES, dispara: false, sou_arquiteto: false });
    await P.carregarMedidores();
    ok(doc.getElementById('pacto-bancada').hidden === true,
       'user comum: a bancada fica ESCONDIDA');
    ok(doc.getElementById('pacto-medidores').innerHTML.trim() === '',
       'e nenhuma barra chega a ser desenhada');
    ok(!doc.body.innerHTML.includes('Acordar'),
       'o titulo da rotina nem aparece no DOM — nao ha o que inspecionar');
  }

  /* Quem decide e o servidor. Se a tela olhasse um campo local, um
     cliente adulterado revelaria a bancada. */
  ok(/sou_arquiteto/.test(fonte),
     'a condicao e `sou_arquiteto`, vinda do servidor');
  ok(!/nivel_acesso\s*===?\s*['"]Arquiteto/.test(fonte),
     'e NAO um nivel_acesso lido do lado do cliente');

  /* ── 2. O Arquiteto ve, e ve o estado ───────────────────────── */
  console.log('\n-- observacao nao e punicao --');
  const { win, doc, P } = montar({ medidores: MEDIDORES, dispara: false, sou_arquiteto: true });
  await P.carregarMedidores();

  ok(doc.getElementById('pacto-bancada').hidden === false, 'o Arquiteto ve a bancada');
  ok(doc.getElementById('medidor-estado').textContent === 'OBSERVAÇÃO',
     'e o selo diz OBSERVAÇÃO');
  ok(doc.getElementById('medidor-estado').classList.contains('pct-observando'),
     'com a cor de quem so mede');
  ok(/medem sem punir/.test(doc.getElementById('medidor-nota').innerHTML),
     'e a nota explica que encher NAO pune agora');
  ok(/Regra B|julgamento do dia/.test(doc.getElementById('medidor-nota').innerHTML),
     'dizendo quem esta punindo no lugar');

  /* ── 3. As barras ───────────────────────────────────────────── */
  console.log('\n-- as barras --');
  const barras = doc.querySelectorAll('.pct-medidor');
  ok(barras.length === 3, `tres medidores desenhados (${barras.length})`);
  const trilho = doc.querySelector('.pct-medidor .pct-medidor-trilho > i');
  ok(/width:\s*80%/.test(trilho.getAttribute('style')), 'carga 80 desenha 80%');
  ok(/1 falha até disparar/.test(doc.body.textContent),
     'e a previsao e escrita: "1 falha ate disparar"');
  ok(/4 falhas até disparar/.test(doc.body.textContent),
     'no plural quando e mais de uma');
  ok(/cheia até disparar/.test(doc.body.textContent), 'e "cheia" quando esta no topo');
  ok(barras[2].classList.contains('pct-medidor--cheio'),
     'a barra cheia se destaca das outras');
  ok(/\+40\/falha/.test(doc.body.textContent),
     'cada barra mostra quanto UMA falha enche — e o que torna a punicao previsivel');

  /* Os botoes nas extremidades, como pedido. */
  const linha = doc.querySelector('.pct-medidor-linha');
  ok(linha.firstElementChild.dataset.med === 'menos',
     'o − fica na extremidade ESQUERDA');
  ok(linha.lastElementChild.dataset.med === 'mais',
     'e o + na extremidade DIREITA');
  ok(doc.querySelectorAll('[aria-label]').length >= 6,
     'os botoes tem rotulo acessivel (sao so "+" e "−" na tela)');

  /* ── 4. O + dispara de verdade ──────────────────────────────── */
  console.log('\n-- o + nao simula --');
  win.chamadas.length = 0;
  win.__respPost = { ok: true, medidor: { carga: 100 },
                     punicao: { criadas: [{ id: 9, titulo: 'Faça 30 flexões' }], no_teto: false } };
  await P._mexerMedidor(1, 'mais');

  const posts = win.chamadas.filter(c => c[0] === 'POST');
  ok(posts.length === 1 && /\/pactos\/medidores\/1\/encher/.test(posts[0][1]),
     'o + chama o endpoint de encher da rotina certa');
  const toast = win.chamadas.find(c => c[0] === 'toast');
  ok(toast && /TESTE/.test(toast[2]),
     'e avisa que a punicao disparada e de TESTE');
  ok(win.chamadas.some(c => c[0] === 'GET' && c[1] === '/pactos'),
     'a pagina inteira recarrega — o selo do menu e o aviso de divida ' +
     'provam que o disparo percorreu o caminho real');

  /* O teto e um SUCESSO, nao um erro: e o Sistema se recusando a criar. */
  win.chamadas.length = 0;
  win.__respPost = { ok: true, medidor: { carga: 100 },
                     punicao: { criadas: [], no_teto: true } };
  await P._mexerMedidor(1, 'mais');
  const t2 = win.chamadas.find(c => c[0] === 'toast');
  ok(t2 && /teto/i.test(t2[2]) && t2[1] !== 'error',
     'no teto, a tela explica que a recusa e o comportamento CORRETO');

  /* ── 5. O − ─────────────────────────────────────────────────── */
  win.chamadas.length = 0;
  win.__respPost = { ok: true, medidor: { carga: 0 } };
  await P._mexerMedidor(2, 'menos');
  ok(win.chamadas.some(c => c[0] === 'POST' && /\/2\/esvaziar/.test(c[1])),
     'o − chama esvaziar');
  ok(!win.chamadas.some(c => c[0] === 'toast' && /TESTE/.test(c[2])),
     'e nao anuncia punicao nenhuma');

  /* ── 6. Varrer testes ───────────────────────────────────────── */
  console.log('\n-- varrer testes --');
  win.chamadas.length = 0;
  win.__respPost = { ok: true, removidas: 3, pendentes: 0 };
  await P._varrerTestes();
  ok(win.chamadas.some(c => c[0] === 'POST' && /limpar-testes/.test(c[1])),
     'o botao varre as punicoes de teste');
  const t3 = win.chamadas.find(c => c[0] === 'toast');
  ok(t3 && /3/.test(t3[2]), 'e diz quantas saíram');

  /* ── 7. Modo ARMADO ─────────────────────────────────────────── */
  console.log('\n-- modo armado --');
  {
    const { doc, P } = montar({ medidores: MEDIDORES, dispara: true, sou_arquiteto: true });
    await P.carregarMedidores();
    ok(doc.getElementById('medidor-estado').textContent === 'ARMADO', 'o selo vira ARMADO');
    ok(doc.getElementById('medidor-estado').classList.contains('pct-armado'),
       'com a cor de quem pune');
    ok(/dispara a penitência/.test(doc.getElementById('medidor-nota').innerHTML),
       'e a nota diz que encher PUNE');
    ok(/Regra B.*desligad/i.test(doc.getElementById('medidor-nota').innerHTML),
       'e que o gatilho do dia foi desligado — os dois nunca punem juntos');
  }

  /* ── 8. Falha de rede nao derruba O Pacto ───────────────────── */
  console.log('\n-- o resto da pagina sobrevive --');
  {
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="pacto-bancada" hidden></div><div id="pacto-medidores"></div>
    </body></html>`, { runScripts: 'outside-only', url: 'http://localhost/' });
    dom.window.API = { get: async () => { throw new Error('500'); } };
    const ctx = dom.getInternalVMContext();
    require('vm').runInContext(fonte + '\n;globalThis.__P = Pacto;', ctx);
    let explodiu = false;
    try { await dom.window.__P.carregarMedidores(); } catch (_) { explodiu = true; }
    ok(!explodiu, 'endpoint fora do ar nao levanta excecao');
    ok(dom.window.document.getElementById('pacto-bancada').hidden === true,
       'a bancada some, e O Pacto continua de pe');
  }

  /* ── 9. Delegacao, e nao listener por botao ─────────────────── */
  console.log('\n-- os cliques nao se acumulam --');
  ok(/getElementById\('pacto-medidores'\)\?\.addEventListener/.test(fonte),
     'o clique e ouvido no CONTAINER, uma vez');
  ok(/closest\('\[data-med\]'\)/.test(fonte),
     'e resolvido por closest — repintar as barras nao duplica nada');
  ok(/_ligado/.test(fonte), 'e a ligacao roda uma vez so');

  /* ── 10. HTML e CSS ─────────────────────────────────────────── */
  ok(/id="pacto-bancada"[^>]*hidden/.test(html),
     'a bancada nasce escondida no HTML — o padrao seguro e nao mostrar');
  const bloco = css.slice(css.indexOf('.pct-bancada {'));
  ok(!/animation\s*:/.test(bloco),
     'e nada na bancada anima — numero que se mexe nao se le');

  console.log(`\n=== ${testes - falhas}/${testes} ===`);
  return falhas;
}

rodar().then(f => process.exit(f ? 1 : 0));
