/* ============================================================
   TESTE — O CARTAO DA META QUE DEIXA IR ALEM

   O par deste arquivo no backend e `test_meta_superacao.py`, que prova as
   regras. Aqui provamos o CARTAO — e o cartao era o culpado.

   O BACKEND JA ACEITAVA. `meta_registrar` so recusava CANCELADA e
   FRACASSADA; CONCLUIDA passava direto, e a trava do XP (`if bateu and
   status != "CONCLUIDA"`) ja impedia pagar duas vezes. Quem fechava a
   porta era esta linha do `_corpoMeta`:

       const encerrada = ['CONCLUIDA','CANCELADA','FRACASSADA'].includes(st)

   `CONCLUIDA` ali dentro apagava o campo de lancar no instante em que o
   alvo era batido. O Arquiteto fazia R$ 100 numa manha que ia ate as 11h
   e ficava proibido de registrar os R$ 48 seguintes: o Sistema premiava
   chegar e punia continuar.

   O QUE ESTE ARQUIVO PROTEGE

   1. QUE `CONCLUIDA` VOLTE A CALAR O CARTAO. O assert central. A
      permissao agora vem de `meta_janela_aberta`, que olha o PRAZO —
      nao o status.

   2. QUE A JANELA FECHADA CONTINUE FECHANDO. O oposto e igualmente
      grave: campo vivo depois do prazo convida a um lancamento que o
      servidor vai recusar, e o hunter leva um erro na cara.

   3. QUE PAYLOAD VELHO NAO LIBERE O QUE O SERVIDOR RECUSA. Aba aberta
      desde antes do deploy nao tem o campo novo. Sem o campo, vale a
      regra antiga.

   4. QUE SUPERAR SEJA VISIVEL. A barra para em 100% por construcao. Se
      ela fosse o unico sinal, 148% e 100% desenhariam igual.

   Uso: NODE_PATH=/tmp/deps/node_modules node teste_meta_superacao.js
   ============================================================ */
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const { JSDOM } = require('jsdom');

let falhas = 0, testes = 0;
const ok = (cond, msg) => {
  testes++;
  if (!cond) falhas++;
  console.log((cond ? '  [ok]  ' : '  [XX]  ') + msg);
};

const RAIZ  = path.join(__dirname, '..');
const fonte = fs.readFileSync(path.join(RAIZ, 'js', 'missao-card.js'), 'utf8');
const css   = fs.readFileSync(path.join(RAIZ, 'css', 'missao-card.css'), 'utf8');
/* As regras, sem a prosa: os comentarios deste projeto CITAM a linha
   que foi removida para explicar o porque. Um assert que procura no
   texto cru encontraria a explicacao e reprovaria a propria correcao. */
const regras = css.replace(/\/\*[\s\S]*?\*\//g, '');

/* A missao da foto do Arquiteto: "CONSEGUIR R$100,00 NO TURNO DA MANHA",
   06:30 as 11:00. Os campos de meta chegam prontos do backend. */
function missao(over = {}) {
  return Object.assign({
    id: 12, rotina_id: 12, uid: 'r12', origem: 'rotina',
    titulo: 'Conseguir R$100,00 no turno da manhã.',
    status: 'ATIVA', status_hoje: 'ATIVA', categoria: 'Pessoal',
    prioridade: 'ALTA', dificuldade: 'NORMAL',

    eh_meta: true,
    meta_alvo: 100, meta_atual: 0, meta_inicial: null,
    meta_modo: 'ACUMULO', meta_especie: 'VALOR', meta_unidade: 'R$',
    meta_passo: 50, meta_casas: 2, meta_teclado: 'decimal',
    meta_progresso: 0, meta_alcancada: false,
    meta_texto: 'R$ 0,00', meta_alvo_texto: 'R$ 100,00',
    meta_aportes: [],
    meta_excedente: 0, meta_excedente_texto: 'R$ 0,00',
    meta_fracao_total: 0, meta_janela_aberta: true, meta_prazo: '11:00',
  }, over);
}

function montar() {
  const dom = new JSDOM('<!doctype html><html><body><div id="lista"></div></body></html>',
    { runScripts: 'outside-only', url: 'http://localhost/' });
  const win = dom.window;
  win.chamadas = [];
  win.API = { post: async (u, b) => { win.chamadas.push([u, b]); return { ok: true }; } };
  win.SoloDialog = { toast: (m, t) => win.chamadas.push(['toast', t, m]) };
  win.Glifos = { existe: () => true, linha: () => '<svg></svg>', rico: () => '<svg></svg>' };
  const ctx = dom.getInternalVMContext();
  vm.runInContext(fonte + '\n;globalThis.__MC = MissaoCard;', ctx);
  return { win, doc: win.document, MC: win.__MC };
}

function desenhar(MC, doc, m) {
  doc.getElementById('lista').innerHTML = MC.html(m, { compacto: true });
  return doc.getElementById('lista');
}

const temEntrada = (el) => !!el.querySelector('.mc-meta-input');
const selo       = (el) => el.querySelector('.mc-meta-super');

function rodar() {
  console.log('\n=== O CARTAO DA META QUE DEIXA IR ALEM ===\n');
  const { doc, MC } = montar();

  /* ── 1. O CASO QUE ORIGINOU O PEDIDO ────────────────────────── */
  console.log('-- alvo batido as 09h, prazo ate as 11h --');
  {
    const el = desenhar(MC, doc, missao({
      status: 'CONCLUIDA', status_hoje: 'CONCLUIDA',
      meta_atual: 100, meta_progresso: 1, meta_alcancada: true,
      meta_texto: 'R$ 100,00', meta_fracao_total: 1,
      meta_janela_aberta: true,
    }));

    ok(temEntrada(el),
       'CONCLUIDA com a janela aberta AINDA MOSTRA o campo de lancar — '
       + 'este assert e o pedido inteiro');
    ok(!!el.querySelector('.mc-meta-entrada.alem'),
       'e o campo se marca como "alem": a missao ja esta cumprida, '
       + 'o que vier e extra');
    const inp = el.querySelector('.mc-meta-input');
    ok(inp.getAttribute('placeholder') === 'Somar mais',
       'o texto muda de "Somar valor" para "Somar mais"');
    ok(!selo(el),
       'mas ainda NAO ha selo: bater exato nao e superar');
  }

  /* ── 2. O EXCEDENTE ─────────────────────────────────────────── */
  console.log('\n-- R$ 148 de uma meta de R$ 100 --');
  {
    const el = desenhar(MC, doc, missao({
      status: 'CONCLUIDA', status_hoje: 'CONCLUIDA',
      meta_atual: 148, meta_progresso: 1, meta_alcancada: true,
      meta_texto: 'R$ 148,00', meta_fracao_total: 1.48,
      meta_excedente: 48, meta_excedente_texto: 'R$ 48,00',
      meta_janela_aberta: true,
    }));

    const s = selo(el);
    ok(!!s, 'o selo da superacao aparece');
    ok(/R\$ 48,00/.test(s.textContent), 'ele diz quanto passou do alvo');
    ok(/148%/.test(s.textContent), 'e quanto isso e do alvo, sem teto');
    ok(/acima da meta/i.test(s.textContent),
       'com a janela aberta o selo e convite, nao veredito');

    const pct = el.querySelector('.mc-meta-pct');
    ok(pct.textContent.trim() === '148%',
       'o numero escrito passa de 100 — senao superar e empatar '
       + 'ficariam identicos na tela');

    const fill = el.querySelector('.mc-meta-fill');
    ok(/width:\s*100%/.test(fill.getAttribute('style')),
       'mas a BARRA para em 100%: ela mede o caminho ate o alvo e '
       + '148% vazaria o cartao');

    ok(el.querySelector('.mc-meta').classList.contains('superada'),
       'a raiz ganha a classe que acende o pulso da barra');
    ok(temEntrada(el), 'e da para somar ainda mais');
  }

  /* ── 3. O RELOGIO FECHA ─────────────────────────────────────── */
  console.log('\n-- passou das 11h --');
  {
    const el = desenhar(MC, doc, missao({
      status: 'CONCLUIDA', status_hoje: 'CONCLUIDA',
      meta_atual: 148, meta_progresso: 1, meta_alcancada: true,
      meta_texto: 'R$ 148,00', meta_fracao_total: 1.48,
      meta_excedente: 48, meta_excedente_texto: 'R$ 48,00',
      meta_janela_aberta: false,
      // COM lancamentos: sem eles o livro nem se desenha, e o assert do
      // desfazer passaria sem ter provado nada.
      meta_aportes: [{ valor: 48 }, { valor: 100 }],
    }));

    ok(!!el.querySelector('.mc-meta-livro'),
       'o livro dos lancamentos continua a vista — o registro fica');
    ok(!temEntrada(el),
       'janela fechada tira o campo — deixa-lo convidaria a um '
       + 'lancamento que o servidor ja recusa');
    ok(!el.querySelector('.mc-meta-desfazer'),
       'e tira o desfazer junto: apagar tambem mexe no total fechado');
    const s = selo(el);
    ok(!!s, 'o selo FICA — e o total do turno');
    ok(s.classList.contains('fechado'), 'mas em tom de registro');
    ok(/total do turno/i.test(s.textContent),
       'e o rotulo passa de convite a veredito');
  }

  /* ── 4. MISSAO MORTA ────────────────────────────────────────── */
  console.log('\n-- cancelada e fracassada continuam mudas --');
  {
    for (const st of ['CANCELADA', 'FRACASSADA']) {
      const el = desenhar(MC, doc, missao({
        status: st, status_hoje: st,
        meta_atual: 40, meta_progresso: .4,
        meta_janela_aberta: true,   // ate com a janela aberta
      }));
      ok(!temEntrada(el), `${st} nao aceita valor nem dentro do prazo`);
    }
  }

  /* ── 4b. A META REERGUIDA ───────────────────────────────────── */
  console.log('\n-- reerguida: a segunda chance precisa do campo --');
  {
    const el = desenhar(MC, doc, missao({
      status: 'PENDENTE', status_hoje: 'PENDENTE', reerguida: true,
      meta_atual: 40, meta_progresso: .4, meta_texto: 'R$ 40,00',
      meta_fracao_total: .4,
      // O servidor manda `true` porque `motors/meta.janela_aberta`
      // trata `reerguida` — reerguer devolve o resto do dia.
      meta_janela_aberta: true,
    }));
    ok(temEntrada(el),
       'a meta reerguida MOSTRA o campo de lancar — foi por isto que o '
       + 'hunter pagou Mana');
    ok(!selo(el), 'e ainda sem selo: ela nem chegou ao alvo');
  }

  /* ── 5. PAYLOAD VELHO ───────────────────────────────────────── */
  console.log('\n-- aba aberta desde antes do deploy --');
  {
    const m = missao({
      status: 'CONCLUIDA', status_hoje: 'CONCLUIDA',
      meta_atual: 100, meta_progresso: 1, meta_alcancada: true,
    });
    delete m.meta_janela_aberta;          // o campo nem existe
    const el = desenhar(MC, doc, m);
    ok(!temEntrada(el),
       'sem o campo novo vale a regra antiga — liberar um campo que '
       + 'o servidor recusaria daria erro na cara do hunter');
  }

  /* ── 6. EM ANDAMENTO ────────────────────────────────────────── */
  console.log('\n-- a meta comum, no meio do caminho --');
  {
    const el = desenhar(MC, doc, missao({
      meta_atual: 40, meta_progresso: .4, meta_texto: 'R$ 40,00',
      meta_fracao_total: .4,
    }));
    ok(temEntrada(el), 'aceita valor, como sempre aceitou');
    ok(el.querySelector('.mc-meta-input').getAttribute('placeholder') === 'Somar valor',
       'com o texto de sempre');
    ok(!selo(el), 'sem selo');
    ok(!el.querySelector('.mc-meta-entrada.alem'),
       'e sem a marca de "alem" — ainda falta chegar');
    ok(el.querySelector('.mc-meta-pct').textContent.trim() === '40%',
       'o percentual e o normal');
  }

  /* ── 7. A BALANCA NAO SUPERA ────────────────────────────────── */
  console.log('\n-- peso: 76 kg numa meta de 78 --');
  {
    const el = desenhar(MC, doc, missao({
      meta_modo: 'MEDICAO', meta_especie: 'PESO', meta_unidade: 'kg',
      meta_alvo: 78, meta_inicial: 85, meta_atual: 76,
      meta_progresso: 1, meta_alcancada: true, meta_fracao_total: 1,
      meta_texto: '76,0 kg', meta_alvo_texto: '78,0 kg',
      meta_excedente: 0, meta_janela_aberta: true,
      status: 'CONCLUIDA', status_hoje: 'CONCLUIDA',
    }));
    ok(!selo(el),
       'nenhum selo: "+2,0 kg · 103% do alvo" numa balanca nao quer '
       + 'dizer nada');
    ok(temEntrada(el),
       'mas continua aceitando pesagem enquanto ha dia');
    ok(!el.querySelector('.mc-meta-chip'),
       'e sem atalhos de somar, como a medicao sempre foi');
  }

  /* ── 8. O CSS EXISTE ────────────────────────────────────────── */
  console.log('\n-- o desenho do selo --');
  ok(/\.mc-meta-super\b/.test(regras), '.mc-meta-super esta no CSS');
  ok(/\.mc-meta-super\.fechado/.test(regras), 'com o estado fechado');
  ok(/\.mc-meta\.superada\s+\.mc-meta-fill/.test(regras),
     'e o pulso da barra de quem superou');
  ok(/prefers-reduced-motion/.test(regras),
     'com a saida para quem pediu menos movimento');

  console.log(`\n${'='.repeat(50)}`);
  console.log(falhas === 0 ? `TUDO VERDE — ${testes} asserts`
                           : `${falhas} FALHA(S) de ${testes} asserts`);
  console.log('='.repeat(50) + '\n');
  process.exit(falhas === 0 ? 0 : 1);
}

rodar();
