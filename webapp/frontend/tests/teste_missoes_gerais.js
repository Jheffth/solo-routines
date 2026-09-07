/* ============================================================
   TESTE — A ABA MISSÕES GERAIS MOSTRA O QUE EXISTE

   O ARQUITETO RELATOU: "minhas missões gerais não estão aparecendo na
   aba Missões Gerais, elas deveriam aparecer aqui, mesmo as concluídas
   ou canceladas. Como elas não estão, entendo que talvez as que eu abra
   também não irão aparecer."

   Ele estava certo nas duas coisas. Medido na conta dele, na produção:

       35 missões gerais no banco
        0 na tela

   A aba abria em HOJE e pedia `?data=<hoje>`; o backend filtra por dia
   exato. Nenhuma das 35 era de hoje — 16 de 04/08, 5 canceladas em
   02/09, 3 em 06/09. E a dedução dele estava certa: uma missão criada
   hoje apareceria hoje e sumiria amanhã.

   NÃO ERA DADO PERDIDO, ERA VISTA ERRADA. É a mesma lição que o Extrato
   já tinha aprendido e que não foi aplicada aqui:

       "um livro-caixa abre mostrando o que existe. Abrir em 'hoje'
        escondia todo o histórico logo no momento em que ele passou a
        existir."

   Uso: NODE_PATH=/tmp/deps/node_modules node teste_missoes_gerais.js
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
const fonte = fs.readFileSync(path.join(RAIZ, 'js', 'pages', 'tarefas.js'), 'utf8');
const css   = fs.readFileSync(path.join(RAIZ, 'css', 'components.css'), 'utf8');

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const HOJE = iso(new Date());
const ONTEM = iso(new Date(Date.now() - 86400000));
const VELHO = '2026-08-04';

/* A forma real dos dados do Arquiteto: nada de hoje, tudo no passado. */
const DADOS = [
  { id: 1, titulo: 'Comprar material',  data_prevista: VELHO, status: 'CONCLUIDA', prioridade: 'ALTA',  categoria: 'Casa' },
  { id: 2, titulo: 'Ligar para o médico', data_prevista: VELHO, status: 'FRACASSADA', prioridade: 'CRITICA', categoria: 'Saude' },
  { id: 3, titulo: 'Revisar contrato',  data_prevista: ONTEM, status: 'CANCELADA', prioridade: 'MEDIA', categoria: 'Trabalho' },
  { id: 4, titulo: 'Pagar a conta',     data_prevista: ONTEM, status: 'CONCLUIDA', prioridade: 'ALTA',  categoria: 'Casa' },
];

function montar(dados) {
  const dom = new JSDOM(`<!doctype html><html><body>
    <input type="date" id="filter-data-tarefa">
    <input type="checkbox" id="toggle-ocultar-tarefas">
    <div id="lista-tarefas"></div>
  </body></html>`, { runScripts: 'outside-only', url: 'http://localhost/' });

  const win = dom.window;
  win.pedidos = [];
  win.API = {
    get: async (u) => {
      win.pedidos.push(u);
      const m = /data=([\d-]+)/.exec(u);
      return m ? dados.filter(x => x.data_prevista === m[1]) : dados;
    },
  };
  win.Auth = { getUsuario: () => ({ nivel_acesso: 'Arquiteto' }) };
  win.MissaoCard = {
    cachear() {}, montar() {}, pararTimer() {},
    html: (m) => `<div data-mc-card="${m.uid}" data-status="${m.status}">${m.titulo}</div>`,
  };
  win.SoloDialog = { toast() {} };
  const ctx = dom.getInternalVMContext();
  require('vm').runInContext(fonte + '\n;globalThis.__T = Tarefas;', ctx);
  return { win, doc: win.document, T: win.__T };
}

async function rodar() {
  console.log('\n=== A ABA MISSÕES GERAIS ===\n');

  /* ── 1. O defeito relatado ──────────────────────────────────── */
  console.log('-- o que o Arquiteto viu --');
  const { win, doc, T } = montar(DADOS);
  await T.carregar();

  const cards = doc.querySelectorAll('[data-mc-card]');
  ok(cards.length === 4,
     `as ${DADOS.length} missões aparecem — nenhuma é de hoje, e todas estão lá (${cards.length})`);
  ok(!win.pedidos.some(u => /data=/.test(u)),
     'a aba abre pedindo TUDO, sem filtro de data');
  ok(T._dataAtual === null, 'e o estado nasce em "tudo", não em hoje');

  /* Concluídas e canceladas são o ponto do pedido dele. */
  const st = [...cards].map(c => c.dataset.status);
  ok(st.includes('CONCLUIDA'), 'as CONCLUÍDAS estão lá');
  ok(st.includes('CANCELADA'), 'as CANCELADAS também');
  ok(st.includes('FRACASSADA'), 'e as FRACASSADAS');

  /* ── 2. Agrupado por dia, do recente para trás ──────────────── */
  console.log('\n-- o livro, por dia --');
  const dias = [...doc.querySelectorAll('.tf-dia-rot')].map(e => e.textContent.trim());
  ok(dias.length === 2, `dois dias distintos viram dois cabeçalhos (${dias.length})`);
  ok(dias[0] === 'Ontem', `o mais recente no topo ("${dias[0]}")`);
  ok(/04\/08/.test(dias[1]), `e o mais antigo embaixo ("${dias[1]}")`);
  ok(/2 missões/.test(doc.body.textContent), 'cada dia diz quantas teve');

  /* ── 3. O recorte por dia continua existindo ────────────────── */
  console.log('\n-- a data como recorte --');
  win.pedidos.length = 0;
  await T.carregarPorData(ONTEM);
  ok(win.pedidos.some(u => u.includes(`data=${ONTEM}`)),
     'escolher um dia volta a pedir só aquele dia');
  ok(doc.querySelectorAll('[data-mc-card]').length === 2,
     'e mostra só as duas daquele dia');
  ok(!doc.querySelector('.tf-dia-rot'),
     'sem agrupamento por dia quando o dia é um só — cabeçalho de um item é ruído');

  /* ── 4. O caminho de volta ──────────────────────────────────── */
  console.log('\n-- voltar para o livro --');
  ok(!!doc.getElementById('btn-tarefas-tudo'),
     'há um botão "Ver todas" na vista de um dia');
  T._verTudo();
  await new Promise(r => setTimeout(r, 10));
  ok(T._dataAtual === null, '_verTudo volta o estado para tudo');
  ok(doc.getElementById('filter-data-tarefa').value === '',
     'e limpa o campo de data — senão a tela diria um dia e mostraria outro');

  /* Limpar o campo à mão faz o mesmo. */
  const campo = doc.getElementById('filter-data-tarefa');
  campo.value = ONTEM;
  campo.dispatchEvent(new win.Event('change'));
  await new Promise(r => setTimeout(r, 10));
  ok(T._dataAtual === ONTEM, 'escolher no campo recorta');
  campo.value = '';
  campo.dispatchEvent(new win.Event('change'));
  await new Promise(r => setTimeout(r, 10));
  ok(T._dataAtual === null, 'e limpar o campo devolve o livro inteiro');

  /* ── 5. O que ele deduziu sozinho ───────────────────────────── */
  console.log('\n-- "as que eu abra também não irão aparecer" --');
  const comHoje = [...DADOS, { id: 9, titulo: 'Missão de hoje', data_prevista: HOJE,
                               status: 'PENDENTE', prioridade: 'ALTA', categoria: 'Pessoal' }];
  const b = montar(comHoje);
  await b.T.carregar();
  ok(b.doc.body.textContent.includes('Missão de hoje'),
     'uma missão criada hoje aparece hoje');

  /* A prova do amanhã: a mesma missão, com a data no passado. */
  const amanha = comHoje.map(x => x.id === 9 ? { ...x, data_prevista: ONTEM } : x);
  const c = montar(amanha);
  await c.T.carregar();
  ok(c.doc.body.textContent.includes('Missão de hoje'),
     'e CONTINUA aparecendo quando o dia vira — era isto que sumia');

  /* ── 6. Ocultar concluídas segue funcionando ────────────────── */
  console.log('\n-- o toggle não foi atropelado --');
  const d = montar(DADOS);
  d.win.localStorage.setItem('sr_ocultar_concluidas_tarefas', 'true');
  await d.T.carregar();
  ok(d.doc.querySelectorAll('[data-mc-card]').length === 0,
     'com "ocultar concluídas" ligado e tudo encerrado, a lista fica vazia');
  ok(/Nenhuma missão geral ainda/.test(d.doc.body.textContent),
     'e o vazio de "tudo" não fala em dia nenhum');

  /* ── 7. Erro continua visível ───────────────────────────────── */
  console.log('\n-- falha não vira lista vazia --');
  const e = montar(DADOS);
  e.win.API.get = async () => { throw new Error('500'); };
  await e.T.carregar();
  ok(/não respondeu/.test(e.doc.body.textContent),
     'endpoint fora do ar mostra ERRO — o defeito que já escondeu uma causa aqui');

  /* ── 8. Backend e CSS ───────────────────────────────────────── */
  console.log('\n-- as pontas --');
  const rot = fs.readFileSync(path.join(RAIZ, '..', 'backend', 'routers', 'tarefas.py'), 'utf8');
  ok(/inicio: Optional\[date\]/.test(rot) && /fim: Optional\[date\]/.test(rot),
     'o backend aceita intervalo, além do dia exato');
  ok(/data_prevista\.desc\(\)/.test(rot),
     'e devolve do mais recente para trás — 35 itens em ordem crescente ' +
     'enterrariam o de ontem no fim');
  ok(/TarefaDia\.data_prevista == data/.test(rot),
     'o filtro de dia exato foi PRESERVADO — /tarefas/hoje depende dele');
  ok(/\.tf-dia\s*\{[\s\S]*?position: sticky/.test(css),
     'o cabeçalho do dia gruda ao rolar');

  console.log(`\n=== ${testes - falhas}/${testes} ===`);
  return falhas;
}

rodar().then(f => process.exit(f ? 1 : 0));
