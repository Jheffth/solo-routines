/* ============================================================
   TESTE — O DOSSIE (modal de duplo clique)

   O Arquiteto pediu de volta o modal que existia nas primeiras versoes:
   duplo clique no cartao abre uma janela com os dados longos da missao.

   O QUE ESTE ARQUIVO PROTEGE

   1. DOIS CLIQUES EM "CONCLUIR" SAO DOIS CLIQUES EM CONCLUIR.
      O gesto e sobre o CORPO do cartao. Nascendo sobre um botao, um
      campo ou um link, ele nao existe — senao clicar rapido para
      concluir abriria uma janela por cima da acao que o hunter quis.

   2. A JANELA ABRE ANTES DOS DADOS.
      Esqueleto primeiro, conteudo quando a rede responder. Esperar para
      desenhar faria o duplo clique parecer sem efeito no unico momento
      em que o hunter esta olhando.

   3. MISSAO GERAL NAO GANHA A FORMA DA ROTINA.
      Ela acontece uma vez: taxa de 0% e corrente de 0 fariam uma missao
      cumprida parecer fracasso.

   4. O MEDIDOR SO APARECE PARA QUEM O SERVIDOR MANDOU.
      A tela nunca decide isso — ela desenha o que veio.

   Uso: NODE_PATH=/tmp/deps/node_modules node teste_dossie_modal.js
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
const fonte = fs.readFileSync(path.join(RAIZ, 'js', 'dossie-missao.js'), 'utf8');
const css   = fs.readFileSync(path.join(RAIZ, 'css', 'dossie-missao.css'), 'utf8');
const html  = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');

const DOSSIE_ROTINA = {
  tipo: 'rotina', titulo: 'Acordar às 06:00', natureza: 'ATIVA',
  tipo_rotina: 'DIARIA', categoria: 'Saude', prioridade: 'CRITICA',
  dificuldade: 'NORMAL', nasceu_em: '2026-08-20', dias_de_vida: 19,
  corrente: { atual: 4, recorde: 9 },
  contagem: { total: 19, cumpridas: 14, fracassadas: 4, confessadas: 1,
              canceladas: 0, em_aberto: 0 },
  taxa: 78,
  tempo: { recorde: 300, medio: 650, pior: 1200, amostras: 6 },
  xp: { ganho: 840, perdido: 60, saldo: 780 },
  reergues: { vezes: 2, mana: 50 },
  semana: {
    linhas: [{ dia: 'segunda', n: 3, pct: 100 }, { dia: 'terça', n: 3, pct: 33 }],
    melhor: { dia: 'segunda', n: 3, pct: 100 },
    pior:   { dia: 'terça',   n: 3, pct: 33 },
  },
  penitencias_geradas: 2,
  fita: [{ data: '2026-09-06', status: 'CONCLUIDA' },
         { data: '2026-09-07', status: 'FRACASSADA' },
         { data: '2026-09-08', status: 'CONFESSADA' }],
};

const DOSSIE_GERAL = {
  tipo: 'geral', titulo: 'Ligar para o médico', natureza: 'ATIVA',
  categoria: 'Saude', prioridade: 'ALTA', dificuldade: 'NORMAL',
  status: 'CONCLUIDA', data: '2026-09-08', hora_limite: '18:00',
  nasceu_em: '2026-09-08T09:12:00', concluida_em: '2026-09-08T09:19:00',
  duracao: 420, xp: { ganho: 90, perdido: 0, prometido: 90 },
  origem_titulo: null, origem_data: null, eh_penitencia: false, teste: false,
};

function montar(resposta) {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div class="mc-lista">
      <div class="mc" data-mc-card="r7">
        <div class="mc-titulo">Acordar às 06:00</div>
        <button class="mc-btn" data-mc-acao="concluir" data-mc-id="r7">Concluir</button>
        <input class="mc-meta-input">
      </div>
    </div>
  </body></html>`, { runScripts: 'outside-only', url: 'http://localhost/' });

  const win = dom.window;
  win.pedidos = [];
  win.API = { get: async (u) => { win.pedidos.push(u); if (win.__erro) throw new Error('500'); return resposta; } };
  win.MissaoCard = {
    PRIORIDADES: {
      CRITICA: { cor: '#e11d48' }, ALTA: { cor: '#f59e0b' },
      MEDIA:   { cor: '#64748b' }, BAIXA: { cor: '#3b82f6' },
    },
    _cache: {
      r7: { uid: 'r7', id: 7, rotina_id: 7, origem: 'rotina',
            titulo: 'Acordar às 06:00', prioridade: 'CRITICA' },
      g9: { uid: 'g9', id: 9, rotina_id: null, origem: 'geral',
            titulo: 'Ligar para o médico', prioridade: 'ALTA' },
    },
  };
  const ctx = dom.getInternalVMContext();
  require('vm').runInContext(fonte + '\n;globalThis.__D = DossieMissao;', ctx);
  /* O arquivo se liga sozinho, mas espera o DOM: em jsdom o
     `readyState` fica em "loading" e o evento nao chega sozinho.
     Disparar aqui prova o caminho REAL — o mesmo que o navegador
     percorre quando o `<script src>` roda antes do fim do body. */
  win.document.dispatchEvent(new win.Event('DOMContentLoaded'));
  return { win, doc: win.document, D: win.__D };
}

const esperar = (ms = 12) => new Promise(r => setTimeout(r, ms));

async function rodar() {
  console.log('\n=== O DOSSIE ===\n');
  const { win, doc, D } = montar(DOSSIE_ROTINA);

  /* ── 1. O gesto ─────────────────────────────────────────────── */
  console.log('-- o duplo clique --');
  const card = doc.querySelector('[data-mc-card]');
  card.querySelector('.mc-titulo').dispatchEvent(
    new win.MouseEvent('dblclick', { bubbles: true }));
  await esperar();
  ok(!!doc.getElementById('dm-backdrop'), 'duplo clique no CORPO do cartao abre o dossie');
  D.fechar();
  await esperar(300);

  // O que NAO pode acontecer.
  card.querySelector('[data-mc-acao]').dispatchEvent(
    new win.MouseEvent('dblclick', { bubbles: true }));
  await esperar();
  ok(!doc.getElementById('dm-backdrop'),
     'sobre CONCLUIR, nao abre — dois cliques rapidos ali sao dois cliques ' +
     'em Concluir, nao um pedido de dossie');

  card.querySelector('input').dispatchEvent(
    new win.MouseEvent('dblclick', { bubbles: true }));
  await esperar();
  ok(!doc.getElementById('dm-backdrop'),
     'nem sobre um campo — duplo clique ali seleciona palavra');

  /* ── 2. A janela abre antes dos dados ───────────────────────── */
  console.log('\n-- esqueleto primeiro, dados depois --');
  let travar;
  win.API.get = (u) => { win.pedidos.push(u); return new Promise(r => { travar = () => r(DOSSIE_ROTINA); }); };
  D.abrir('r7');
  ok(!!doc.getElementById('dm-backdrop'),
     'a janela existe ANTES da rede responder — esperar faria o gesto ' +
     'parecer sem efeito');
  ok(!!doc.querySelector('.dm-carregando'), 'com o sinal de espera');
  travar();
  await esperar();
  ok(!doc.querySelector('.dm-carregando'), 'e ele sai quando os dados chegam');

  /* ── 3. O conteudo da rotina ────────────────────────────────── */
  console.log('\n-- o dossie de uma rotina --');
  const txt = doc.getElementById('dm-corpo').textContent;
  ok(/Corrente/.test(txt) && /recorde 9/.test(txt),
     'a corrente DESTA rotina, com o recorde');
  ok(/78%/.test(txt), 'a taxa de conclusao');
  ok(/5m/.test(txt), 'o tempo recorde, em minutos e nao em segundos crus');
  ok(/média 10m 50s/.test(txt) || /média/.test(txt), 'e a media ao lado');
  ok(/\+780/.test(txt), 'o saldo de XP');
  ok(/2× · 50 de Mana/.test(txt), 'quantas vezes foi reerguida e o que custou');
  ok(/Penitências que gerou/.test(txt) && /2/.test(txt),
     'e quantas penitencias ela ja gerou — o custo que so ela conhece');

  const quadros = doc.querySelectorAll('.dm-fita-q');
  ok(quadros.length >= 3, 'a fita dos ultimos dias aparece');
  ok(!!doc.querySelector('.dm-q-concluida') && !!doc.querySelector('.dm-q-fracassada') &&
     !!doc.querySelector('.dm-q-confessada'),
     'com um tom por desfecho — inclusive a confessada, que nao e derrota');

  ok(/segunda/.test(txt) && /terça/.test(txt), 'o desempenho por dia da semana');
  ok(/Você cumpre mais na/.test(txt),
     'com a leitura em FRASE, nao so a barra: "cumpre mais na segunda"');

  /* Sem amostra, nao inventa padrao. */
  const semAmostra = { ...DOSSIE_ROTINA, semana: { linhas: [{ dia: 'sexta', n: 1, pct: 100 }], melhor: null, pior: null } };
  D._pintar(semAmostra, {});
  ok(/sem amostra/i.test(doc.getElementById('dm-corpo').textContent),
     'com uma ocorrencia so, ele DIZ que nao ha padrao — "100% na sexta" ' +
     'de uma unica vez e coincidencia, nao padrao');

  /* ── 4. O medidor e do servidor ─────────────────────────────── */
  console.log('\n-- o medidor --');
  D._pintar(DOSSIE_ROTINA, {});
  ok(!doc.querySelector('.dm-arq'),
     'sem `medidor` na resposta, a secao do Arquiteto NAO aparece');
  D._pintar({ ...DOSSIE_ROTINA,
              medidor: { carga: 60, passo: 40, cheio: false, falhas_para_encher: 1 } }, {});
  ok(!!doc.querySelector('.dm-arq'), 'com ele, aparece');
  ok(/Arquiteto/.test(doc.querySelector('.dm-arq').textContent),
     'marcada como do Arquiteto — o hunter comum nao ve o orcamento de falhas');
  ok(/1 falha/.test(doc.querySelector('.dm-arq').textContent),
     'dizendo quantas faltam para disparar');

  /* ── 5. A missao geral tem outra forma ──────────────────────── */
  console.log('\n-- a missao geral --');
  D.fechar(); await esperar(300);
  const b = montar(DOSSIE_GERAL);
  await b.D.abrir('g9');
  await esperar();
  ok(b.win.pedidos.some(u => /\/tarefas\/9\/dossie/.test(u)),
     'missao geral pergunta a /tarefas, nao a /rotinas');
  const t2 = b.doc.getElementById('dm-corpo').textContent;
  ok(!/Corrente/.test(t2) && !/Taxa/.test(t2),
     'e NAO traz corrente nem taxa — 0% faria uma missao cumprida ' +
     'parecer fracasso');
  ok(/cumprida/.test(t2), 'traz o estado por extenso');
  ok(/7m/.test(t2), 'quanto levou');
  ok(/\+90/.test(t2), 'e o XP creditado');
  ok(/acontece uma vez/.test(t2),
     'com a frase que explica POR QUE ela tem menos numeros');

  /* Penitencia diz de quem e a divida. */
  const c = montar({ ...DOSSIE_GERAL, eh_penitencia: true, natureza: 'PUNICAO',
                     origem_titulo: 'Acordar às 06:00', origem_data: '2026-09-07' });
  await c.D.abrir('g9'); await esperar();
  ok(/Cobrada por/.test(c.doc.getElementById('dm-corpo').textContent),
     'penitencia diz por QUAL falha foi cobrada — punicao anonima e arbitraria');

  /* ── 6. Fechar ──────────────────────────────────────────────── */
  console.log('\n-- fechar --');
  const d2 = montar(DOSSIE_ROTINA);
  await d2.D.abrir('r7'); await esperar();
  d2.doc.getElementById('dm-fechar').click();
  ok(d2.D._aberto === null, 'o X fecha');
  await esperar(300);
  ok(!d2.doc.getElementById('dm-backdrop'),
     'e a janela so sai do DOM depois da transicao — remover na hora ' +
     'cortaria a saida no primeiro quadro');

  await d2.D.abrir('r7'); await esperar();
  d2.doc.getElementById('dm-backdrop').dispatchEvent(
    new d2.win.MouseEvent('click', { bubbles: true }));
  ok(d2.D._aberto === null, 'clicar FORA fecha');

  await d2.D.abrir('r7'); await esperar();
  d2.doc.dispatchEvent(new d2.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  ok(d2.D._aberto === null, 'e Esc tambem');

  /* ── 7. Rede fora do ar ─────────────────────────────────────── */
  console.log('\n-- quando o servidor nao responde --');
  const e = montar(DOSSIE_ROTINA);
  e.win.__erro = true;
  await e.D.abrir('r7'); await esperar();
  ok(!!e.doc.querySelector('.dm-erro'),
     'a janela MOSTRA o erro — vazia, pareceria uma missao sem historico');
  ok(!!e.doc.getElementById('dm-backdrop'), 'e continua fechavel');

  /* ── 8. O visual pertence ao Sistema ────────────────────────── */
  console.log('\n-- vidro e neon, como os cartoes --');
  ok(/backdrop-filter/.test(css), 'o fundo e vidro fosco');
  ok(/conic-gradient\(from var\(--giro/.test(css),
     'a borda viva e a MESMA do bloco em curso do circuito — o dossie ' +
     'reusa a linguagem do cartao em vez de inventar outra');
  ok(/clip-path: polygon\(50% 0/.test(css),
     'e o selo e o hexagono do Sistema');
  ok(/MissaoCard\.PRIORIDADES/.test(fonte),
     'a cor sai da tabela do cartao, nao de uma paleta copiada — ' +
     'copiar e como as duas telas divergem');
  ok(/prefers-reduced-motion/.test(css),
     'com "reduzir movimento" a borda para de girar');
  ok(/aria-modal="true"/.test(fonte) && /_prenderFoco/.test(fonte),
     'e o foco fica preso na janela: sem isso o Tab escapa para o cartao ' +
     'atras, que esta coberto');
  ok(/dossie-missao\.js/.test(html) && /dossie-missao\.css/.test(html),
     'os arquivos estao declarados no index');

  console.log(`\n=== ${testes - falhas}/${testes} ===`);
  return falhas;
}

rodar().then(f => process.exit(f ? 1 : 0));
