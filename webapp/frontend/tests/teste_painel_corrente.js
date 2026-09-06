/* ============================================================
   TESTE — A CORRENTE E A PLACA DA PENITENCIA (desenho)

   O par deste arquivo no backend e `test_corrente.py`, que prova os
   dados. Aqui provamos o DESENHO, e principalmente as tres coisas que
   um mostrador destes pode fazer de errado:

   1. PINTAR DE VERMELHO UM DIA QUE NUNCA FRACASSOU.
      Antes desta versao o app nao gravava historico. Um elo cinza que
      vira vermelho e o Sistema inventando derrotas — a pior mentira
      que este painel poderia contar.

   2. RECALCULAR O MULTIPLICADOR NO CLIENTE.
      A regra (+5%/dia, teto 2x) vive em `gamificacao`. Se a tela
      refizesse a conta, ela mentiria sobre o XP no dia em que a
      Balanca calibrasse a curva. O numero e ECOADO, nunca calculado.

   3. SOMAR FLEXOES COM ABDOMINAIS.
      O numero grande da penitencia conta DIVIDAS, porque e com dividas
      que o teto se compara. Somar repeticoes de exercicios diferentes
      daria um total sem significado e incomparavel com o teto.

   Uso: NODE_PATH=/tmp/deps/node_modules node teste_painel_corrente.js
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
const fonte = fs.readFileSync(path.join(RAIZ, 'js', 'pages', 'dashboard.js'), 'utf8');
const html  = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const css   = fs.readFileSync(path.join(RAIZ, 'css', 'components.css'), 'utf8');

function montar() {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div class="sr-painel sr-corrente" id="painel-corrente" style="display:none">
      <span id="corrente-recorde"></span>
      <b id="corrente-dias">0</b>
      <span id="corrente-mult"></span>
      <div id="corrente-elos"></div>
      <div id="corrente-teto"></div>
    </div>
    <div class="sr-painel sr-penitencia" id="painel-penitencia" style="display:none">
      <span id="pen-teto"></span>
      <b id="pen-total">0</b>
      <span id="pen-unidade"></span>
      <div id="pen-barras"></div>
      <div id="pen-rodape"></div>
    </div>
  </body></html>`, { runScripts: 'outside-only', url: 'http://localhost/' });

  const win = dom.window;
  win.MissaoCard = { cachear() {}, montar() {}, html: () => '' };
  win.API = { get: async () => ({}) };
  const ctx = dom.getInternalVMContext();
  require('vm').runInContext(fonte + '\n;globalThis.__D = Dashboard;', ctx);
  return { win, doc: win.document, D: win.__D };
}

function diasFalsos(estados) {
  const hoje = new Date();
  return estados.map((e, i) => {
    const d = new Date(hoje);
    d.setDate(d.getDate() - (estados.length - 1 - i));
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { data: iso, estado: e };
  });
}

function rodar() {
  console.log('\n=== A CORRENTE E A PLACA (desenho) ===\n');
  const { doc, D } = montar();

  /* ── 1. Os tres estados viram tres cores ────────────────────── */
  console.log('-- os tres estados --');
  D.renderCorrente({
    streak_atual: 5, streak_max: 11,
    multiplicador: 1.25, multiplicador_teto: 2.0, dias_para_o_teto: 15,
    dias: diasFalsos(['SEM_REGISTRO', 'SEM_REGISTRO', 'QUEBROU', 'CUMPRIDO', 'CUMPRIDO']),
  });

  const elos = [...doc.querySelectorAll('#corrente-elos .sr-elo')];
  ok(elos.length === 5, `cinco elos desenhados (${elos.length})`);
  ok(elos.filter(e => e.classList.contains('sr-elo--vazio')).length === 2,
     'dois cinzas para os dois dias sem registro');
  ok(elos.filter(e => e.classList.contains('sr-elo--ko')).length === 1,
     'UM vermelho — so o dia que realmente quebrou');
  ok(elos.filter(e => e.classList.contains('sr-elo--ok')).length === 2,
     'dois verdes para os dias cumpridos');

  /* A mentira que este teste existe para impedir. */
  const cinzasVermelhos = elos.filter(
    e => e.classList.contains('sr-elo--vazio') && e.classList.contains('sr-elo--ko'));
  ok(cinzasVermelhos.length === 0,
     'NENHUM dia sem registro foi pintado de fracasso');

  ok(elos[elos.length - 1].classList.contains('sr-elo--hoje'),
     'o elo de hoje ganha contorno — e o unico que ainda pode mudar');
  ok(elos.every(e => (e.getAttribute('title') || '').length > 3),
     'cada elo diz que dia e e o que aconteceu, ao passar o mouse');

  /* ── 2. O multiplicador e ecoado, nao recalculado ───────────── */
  console.log('\n-- o multiplicador invisivel, agora visivel --');
  ok(doc.getElementById('corrente-dias').textContent === '5', 'o streak aparece: 5');
  ok(/recorde 11/.test(doc.getElementById('corrente-recorde').textContent),
     'e o recorde ao lado');
  ok(doc.getElementById('corrente-mult').textContent === 'XP ×1,25',
     `o multiplicador aparece como "${doc.getElementById('corrente-mult').textContent}"`);
  ok(/15 dias/.test(doc.getElementById('corrente-teto').innerHTML),
     'e quantos dias faltam para o dobro');

  /* Um valor que NENHUMA formula do cliente produziria a partir de
     streak=5. Se a tela recalculasse, mostraria 1,25 e este assert cai. */
  D.renderCorrente({
    streak_atual: 5, streak_max: 11,
    multiplicador: 1.60, multiplicador_teto: 2.0, dias_para_o_teto: 8,
    dias: diasFalsos(['CUMPRIDO']),
  });
  ok(doc.getElementById('corrente-mult').textContent === 'XP ×1,60',
     'a tela ECOA o servidor (1,60 com streak 5) — nao refaz a conta');

  /* ── 3. O teto do multiplicador troca de tom ────────────────── */
  D.renderCorrente({
    streak_atual: 25, streak_max: 25,
    multiplicador: 2.0, multiplicador_teto: 2.0, dias_para_o_teto: 0,
    dias: diasFalsos(['CUMPRIDO', 'CUMPRIDO']),
  });
  ok(doc.getElementById('corrente-mult').classList.contains('sr-mult--teto'),
     'no maximo, o multiplicador muda de cor — parar de crescer e noticia');
  ok(!/faltam/.test(doc.getElementById('corrente-teto').innerHTML),
     'e o rodape para de prometer dias que nao existem mais');

  /* ── 4. A placa da penitencia ───────────────────────────────── */
  console.log('\n-- a placa da penitencia --');
  D._penitResumo = { abertas: 2, teto: 4, no_teto: false,
                     abate_por_missao: 1, decaimento_dias: 7, dias_para_decair: 3 };
  D.renderPenitencia([
    { natureza: 'PUNICAO', status: 'PENDENTE', titulo: 'Faça 30 flexões',   alvo_repeticoes: 30, repeticoes: 12 },
    { natureza: 'PUNICAO', status: 'PENDENTE', titulo: 'Sem doce até 18h',  alvo_repeticoes: 0,  repeticoes: 0 },
    { natureza: 'PUNICAO', status: 'CONCLUIDA', titulo: 'Ja quitada',       alvo_repeticoes: 20, repeticoes: 20 },
    { natureza: 'ATIVA',   status: 'PENDENTE',  titulo: 'Missao comum',     alvo_repeticoes: 0,  repeticoes: 0 },
  ]);

  ok(doc.getElementById('painel-penitencia').style.display === '', 'a placa aparece');
  ok(doc.getElementById('pen-total').textContent === '2',
     'DUAS dividas — a quitada e a missao comum ficam de fora');
  ok(/dívidas em aberto/.test(doc.getElementById('pen-unidade').textContent),
     'a unidade e "dividas", nao "repeticoes"');
  ok(/2 de 4 do teto/.test(doc.getElementById('pen-teto').textContent),
     'e ela se compara com o teto na MESMA unidade');

  const linhas = doc.querySelectorAll('#pen-barras .sr-pen-linha');
  ok(linhas.length === 2, 'duas linhas, uma por divida');
  const trilho = doc.querySelector('#pen-barras .sr-trilho > i');
  ok(trilho && /width:\s*40\.0%/.test(trilho.getAttribute('style')),
     '12 de 30 desenha a barra em 40%');
  ok(/12 \/ 30/.test(doc.getElementById('pen-barras').textContent),
     'com o progresso escrito ao lado');
  ok(/sem meio caminho/.test(doc.getElementById('pen-barras').textContent),
     'a divida sem barra e DITA, nao desenhada — meia restricao nao existe');

  const rod = doc.getElementById('pen-rodape').innerHTML;
  ok(/abate/.test(rod) && /1 repetição/.test(rod),
     'o rodape mostra o ABATE funcionando');
  ok(/3 dias/.test(rod), 'e quando a severidade recua — o caminho de volta');

  /* ── 5. No teto, a placa muda de tom ────────────────────────── */
  D._penitResumo = { abertas: 4, teto: 4, no_teto: true,
                     abate_por_missao: 1, decaimento_dias: 7, dias_para_decair: null };
  D.renderPenitencia([
    { natureza: 'PUNICAO', status: 'PENDENTE', titulo: 'a', alvo_repeticoes: 10, repeticoes: 0 },
    { natureza: 'PUNICAO', status: 'ATIVA',    titulo: 'b', alvo_repeticoes: 10, repeticoes: 0 },
    { natureza: 'PUNICAO', status: 'PENDENTE', titulo: 'c', alvo_repeticoes: 10, repeticoes: 0 },
    { natureza: 'PUNICAO', status: 'PENDENTE', titulo: 'd', alvo_repeticoes: 10, repeticoes: 0 },
  ]);
  ok(doc.getElementById('pen-teto').classList.contains('sr-pen-teto-batido'),
     'no teto, a nota acende');
  ok(/no teto/.test(doc.getElementById('pen-rodape').innerHTML),
     'e o rodape explica que o Sistema parou de criar');
  ok(!/recua um degrau/.test(doc.getElementById('pen-rodape').innerHTML),
     'sem decaimento pendente, nada e prometido (null nao vira "0 dias")');

  /* ── 6. Sem divida, a placa some ────────────────────────────── */
  D._penitResumo = { abertas: 0, teto: 4, no_teto: false, abate_por_missao: 1,
                     decaimento_dias: 7, dias_para_decair: null };
  D.renderPenitencia([]);
  ok(doc.getElementById('painel-penitencia').style.display === 'none',
     'sem divida a placa some — placa zerada permanente vira mobilia');

  /* ── 7. Nada explode com resposta ruim ──────────────────────── */
  console.log('\n-- resposta ruim nao derruba o dashboard --');
  let explodiu = false;
  try {
    D.renderCorrente(null);
    D.renderCorrente({});
    D.renderCorrente({ dias: [] });
    D._penitResumo = undefined;
    D.renderPenitencia(undefined);
  } catch (e) { explodiu = true; console.log('      ' + e.message); }
  ok(!explodiu, 'null, vazio e undefined passam sem exceção');

  /* ── 8. A promessa do HTML e do CSS ─────────────────────────── */
  console.log('\n-- o desenho pertence ao Sistema --');
  ok(/id="painel-corrente"/.test(html) && /id="painel-penitencia"/.test(html),
     'os dois paineis existem no index.html');
  ok(/sr-painel::after/.test(css),
     'e usam o mesmo pino de parafuso das placas — pertencem ao conjunto');

  /* A pagina ja roda 272 animacoes. Estes dois sao instrumentos de
     leitura: texto que oscila nao se le. */
  const bloco = css.slice(css.indexOf('.sr-painel {'), css.indexOf('@media (max-width: 640px)'));
  ok(!/animation\s*:/.test(bloco),
     'e NAO animam — instrumento de leitura nao balanca como placa');

  /* A regra que nao pode ser perdida numa refatoracao de CSS. */
  ok(/\.sr-elo--vazio\s*\{[^}]*rgba\(255,255,255/.test(css),
     'o elo sem registro e cinza no CSS, nunca vermelho');

  console.log(`\n=== ${testes - falhas}/${testes} ===`);
  return falhas;
}

process.exit(rodar() ? 1 : 0);
