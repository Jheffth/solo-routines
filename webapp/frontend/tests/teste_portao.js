/* ============================================================
   TESTE — O PORTÃO

   ESTE ARQUIVO NASCE DE UM DEFEITO QUE EU MESMO CRIEI.

   Construí no servidor a sessão SUSPENSA — sair de um portão aberto sem
   punição, com o prazo correndo, e voltar depois. Escrevi 64 asserts
   para ela. E não toquei na grade: `_statusInfo` tinha cinco casos e
   nenhum para `SUSPENSA`, então o hunter que saísse encontrava "—" e um
   botão desabilitado. A porta de volta que eu tinha acabado de abrir no
   backend simplesmente não existia na tela.

   É o tipo de buraco que teste de backend nunca pega: os dois lados
   estavam certos isoladamente e o contrato entre eles, quebrado.

   O QUE ESTE ARQUIVO PROTEGE, EM ORDEM DE GRAVIDADE

   1. TODO ESTADO DO SERVIDOR TEM UMA PORTA NA TELA.
      Há um assert que varre os status que `routers/dungeons.py` sabe
      produzir e exige que nenhum caia em fallback mudo.

   2. QUEM PODE VOLTAR, VOLTA.
      SUSPENSA e CONCLUIDA num portão aberto precisam devolver
      `ativo: true`. O servidor aceita a reentrada; recusar aqui é a
      mesma falha, do outro lado.

   3. O PRAZO NA TELA É O PRAZO DO SERVIDOR.
      `PortaoEstado.prazoDa` espelha `_prazo_da_sessao`: duas fontes
      (hora de saída e duração máxima contada da PRIMEIRA travessia) e
      vale a mais apertada. Divergir aqui faz o portão mentir sobre
      quanto tempo resta — pior do que não dizer nada.

   4. O RELÓGIO É INJETÁVEL.
      Sem isso, "portão selado às 06:00" passaria de manhã e falharia à
      tarde. Teste que depende da hora da máquina não é teste.

   5. A GEOMETRIA DO ARCO ESTÁ CONGELADA.
      O Arquiteto aprovou um arco de topo redondo depois de eu estragar
      uma versão boa transformando-a em bico ogival. O assert guarda a
      curva contra a próxima "melhoria".

   Uso: NODE_PATH=/tmp/deps/node_modules node teste_portao.js
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

const RAIZ = path.join(__dirname, '..');
const ler  = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');
const css  = ler('css', 'portao.css');
/* AS REGRAS, SEM A PROSA. Este CSS comenta bastante, inclusive citando
   seletores que foram removidos para explicar por quê. Um assert que
   procura seletor no texto cru encontra o comentário e aprova (ou
   reprova) a coisa errada. */
const regras = css.replace(/\/\*[\s\S]*?\*\//g, '');

function montar() {
  /* `pretendToBeVisual` é o que dá `requestAnimationFrame` ao jsdom — e a
     travessia agenda o `.on` nele. Sem isso, o teste quebrava no meio da
     travessia por falta de um global que existe em todo navegador; é
     defeito da bancada, não da peça. É também o que as outras bancadas
     desta pasta já usam (teste_pecas, teste_modal_auras). */
  const dom = new JSDOM('<!doctype html><html><body></body></html>',
    { runScripts: 'outside-only', pretendToBeVisual: true,
      url: 'http://localhost/' });
  const win = dom.window;
  const ctx = dom.getInternalVMContext();
  vm.runInContext(ler('js', 'glifos.js'), ctx);
  vm.runInContext(ler('js', 'pecas', 'portao-estado.js'), ctx);
  vm.runInContext(ler('js', 'pecas', 'portao.js'), ctx);
  return { dom, win, E: win.PortaoEstado, P: win.Portao };
}

/* Um portão comum: abre 08:00, fecha 17:30, tolera 10 min. */
const base = (extra) => Object.assign({
  id: 1, titulo: 'Trabalho CLT', categoria: 'Trabalho', dificuldade: 'DIFICIL',
  rank: 'A', devida_hoje: true, folga_hoje: false,
  hora_entrada: '08:00', hora_saida: '17:30',
  hora_entrada_hoje: '08:00', hora_saida_hoje: '17:30',
  tolerancia_min: 10, sempre_aberta: false, duracao_max_min: null,
  total_missoes: 6, streak_atual: 12, sessao_hoje: null,
}, extra || {});

const hoje = (h, m) => { const d = new Date(2026, 8, 10, h, m, 0, 0); return d; };
const iso  = (h, m) => hoje(h, m).toISOString();

function rodar() {
  console.log('\n=== O PORTÃO ===\n');
  const { win, E, P } = montar();

  /* ── 1. O BURACO QUE ORIGINOU ESTE ARQUIVO ─────────────────────── */
  console.log('-- SUSPENSA: a porta de volta --');
  {
    const d = base({
      sempre_aberta: true, hora_entrada: null, hora_saida: null,
      hora_entrada_hoje: null, hora_saida_hoje: null,
      duracao_max_min: 90,
      sessao_hoje: { status: 'SUSPENSA', entrada_em: iso(14, 10),
                     visitas: 2, minutos_fora: 38, tempo_total_min: 14 },
    });
    const e = E.ler(d, hoje(15, 8));

    ok(e.chave === 'FORA', `sair de um portão aberto tem estado próprio (${e.chave})`);
    ok(e.ativo === true && e.acao === 'entrar',
       'E TEM BOTÃO. Era aqui que a grade dizia "—" e desabilitava a volta');
    ok(e.botao === 'RETOMAR', `o botão se chama pelo que faz: "${e.botao}"`);
    ok(/prazo corre/i.test(e.selo), `o selo avisa que o relógio não parou: "${e.selo}"`);
    ok(/32 min/.test(e.prazo), `e diz quanto resta: "${e.prazo}"`);
    ok(/38 min fora/.test(e.prazo), 'e quanto do prazo ele gastou do lado de fora');
    ok(e.materia === 'fora', 'a matéria do portal esfria, mas não morre');
  }

  /* ── 2. O PRAZO É O DO SERVIDOR ────────────────────────────────── */
  console.log('\n-- o prazo espelha `_prazo_da_sessao` --');
  {
    const s = { status: 'ATIVA', entrada_em: iso(8, 0), tempo_total_min: 60 };

    const so_hora = E.prazoDa(base({ sessao_hoje: s }), s, hoje(9, 0));
    ok(so_hora.getHours() === 17 && so_hora.getMinutes() === 30,
       'com hora de saída, o prazo é ela');

    const so_dur = E.prazoDa(
      base({ hora_saida: null, hora_saida_hoje: null, duracao_max_min: 90, sessao_hoje: s }),
      s, hoje(9, 0));
    ok(so_dur.getHours() === 9 && so_dur.getMinutes() === 30,
       'sem hora de saída, o prazo é a duração contada da PRIMEIRA travessia');

    const duas = E.prazoDa(base({ duracao_max_min: 90, sessao_hoje: s }), s, hoje(9, 0));
    ok(duas.getHours() === 9 && duas.getMinutes() === 30,
       'com as duas, vale a MAIS APERTADA — o prazo não se escolhe pelo mais folgado');

    const nenhum = E.prazoDa(
      base({ hora_saida: null, hora_saida_hoje: null, sessao_hoje: s }), s, hoje(9, 0));
    ok(nenhum === null, 'sem nenhuma das duas, a travessia não tem prazo');

    // A DURAÇÃO NÃO PARA QUANDO ELE SAI: conta de `entrada_em`, não do
    // tempo de permanência. É a regra que o Arquiteto corrigiu.
    const fora = { status: 'SUSPENSA', entrada_em: iso(8, 0), tempo_total_min: 5 };
    const pf = E.prazoDa(
      base({ hora_saida: null, hora_saida_hoje: null, duracao_max_min: 90, sessao_hoje: fora }),
      fora, hoje(9, 0));
    ok(pf.getHours() === 9 && pf.getMinutes() === 30,
       'e ela conta da entrada mesmo com ele fora — 5 min dentro não viram 85 de crédito');
  }

  /* ── 3. O ARO É A BARRA ────────────────────────────────────────── */
  console.log('\n-- o aro acende conforme o dia corre --');
  {
    const s = { status: 'ATIVA', entrada_em: iso(8, 0), tempo_total_min: 60 };
    const d = base({ sessao_hoje: s });

    ok(E.ler(d, hoje(8, 0)).pct === 0, 'às 08:00 o aro está apagado');
    const meio = E.ler(d, hoje(12, 45)).pct;
    ok(Math.abs(meio - 0.5) < 0.02, `ao meio da janela, metade do aro (${meio.toFixed(2)})`);
    ok(E.ler(d, hoje(17, 30)).pct === 1, 'na hora de fechar, o aro inteiro');
    ok(E.ler(base({ hora_saida: null, hora_saida_hoje: null, sessao_hoje: s }), hoje(12, 0)).pct === null,
       'sem prazo não há aro a encher — e a leitura devolve null, não zero');
  }

  /* ── 4. NENHUM ESTADO CAI NO VAZIO ─────────────────────────────── */
  console.log('\n-- todo status do servidor tem uma porta --');
  {
    // Os status que `routers/dungeons.py` sabe gravar numa sessão.
    const STATUS = ['PENDENTE', 'ATIVA', 'SUSPENSA', 'CONCLUIDA',
                    'FRACASSADA', 'CANCELADA', 'EXPIRADA'];
    const mudos = [];
    STATUS.forEach(st => {
      const e = E.ler(base({
        sessao_hoje: { status: st, entrada_em: iso(8, 0), tempo_total_min: 30,
                       rank_obtido: 'B', pct_missoes_concluidas: 50, xp_ganho: 120,
                       visitas: 1, minutos_fora: 0, xp_perdido: 0 },
      }), hoje(12, 0));
      if (!e.chave || !e.selo || !e.prazo || e.prazo === '—') mudos.push(st);
    });
    ok(mudos.length === 0,
       mudos.length ? 'STATUS SEM PORTA: ' + mudos.join(', ')
                    : `os ${STATUS.length} status do servidor têm estado, selo e texto`);
  }

  /* ── 5. QUEM PODE VOLTAR, VOLTA ────────────────────────────────── */
  console.log('\n-- a reentrada no portão aberto --');
  {
    const sess = { status: 'CONCLUIDA', entrada_em: iso(8, 0), rank_obtido: 'S',
                   pct_missoes_concluidas: 100, xp_ganho: 300, visitas: 2 };

    const aberto = E.ler(base({
      sempre_aberta: true, hora_saida: null, hora_saida_hoje: null,
      hora_entrada: null, hora_entrada_hoje: null, sessao_hoje: sess,
    }), hoje(15, 0));
    ok(aberto.ativo === true && aberto.botao === 'VOLTAR',
       'clear num portão que não fecha ainda deixa voltar — o servidor deixa desde o portão aberto');

    const comum = E.ler(base({ sessao_hoje: sess }), hoje(15, 0));
    ok(comum.ativo === false && comum.botao === 'ATRAVESSADO',
       'mas no portão com hora marcada a travessia continua sendo uma por dia');
    ok(comum.materia === 'selado' && aberto.materia === 'fora',
       'e a matéria do portal conta essa diferença sem precisar ler o botão');
  }

  /* ── 6. O RELÓGIO DA PORTA ─────────────────────────────────────── */
  console.log('\n-- selado, aberto, atrasado, perdido --');
  {
    const d = base({ sessao_hoje: { status: 'PENDENTE' } });

    const selado = E.ler(d, hoje(6, 30));
    ok(selado.chave === 'SELADO' && !selado.ativo, 'antes das 08:00 o portão está selado');
    ok(/faltam 1h30/.test(selado.prazo), `e diz quanto falta: "${selado.prazo}"`);

    const aberto = E.ler(d, hoje(8, 5));
    ok(aberto.chave === 'ABERTO' && aberto.ativo, 'na janela, aberto e atravessável');
    ok(/08:10/.test(aberto.prazo), 'com o prazo de tolerância à vista');

    const atras = E.ler(d, hoje(9, 0));
    ok(atras.chave === 'ATRASADO' && atras.ativo,
       'passada a tolerância ele AINDA entra — o portão não fecha por atraso');
    ok(/punição na entrada/.test(atras.prazo), 'mas a tela avisa o preço antes do clique');

    const perdido = E.ler(d, hoje(18, 0));
    ok(perdido.chave === 'PERDIDO' && !perdido.ativo, 'passada a saída, o portão se perdeu');
    ok(perdido.materia === 'perdido', 'e a fenda vira ruína');
  }

  /* ── 7. FOLGA E DIA QUE NÃO É DELE ─────────────────────────────── */
  console.log('\n-- o portão que nem existe hoje --');
  {
    const folga = E.ler(base({ folga_hoje: true }), hoje(10, 0));
    ok(folga.chave === 'FOLGA' && !folga.ativo, 'folga programada tranca o portão');
    const fora = E.ler(base({ devida_hoje: false }), hoje(10, 0));
    ok(fora.chave === 'FECHADO' && !fora.ativo, 'e dia que não é dele idem');
    ok(folga.pct === null && fora.pct === null,
       'nenhum dos dois acende aro: não há travessia a cronometrar');
  }

  /* ── 8. O DESENHO ──────────────────────────────────────────────── */
  console.log('\n-- a fenda --');
  {
    const d = base({ sessao_hoje: { status: 'ATIVA', entrada_em: iso(8, 0), tempo_total_min: 60,
                                    pct_missoes_concluidas: 50, xp_ganho: 180 } });
    win.document.body.innerHTML = P.html(d, { agora: hoje(12, 0), arquiteto: true });
    const el = win.document.querySelector('.pt');

    ok(!!el, 'o portão se monta');
    ok(el.style.getPropertyValue('--pt-nuc') === '#ff9a3c'
       && el.style.getPropertyValue('--pt-fra') === '#ff3d6e',
       'com DUAS cores do rank: núcleo e franja (neon de uma cor só fica chapado)');

    const svg = el.querySelector('.pt-svg');
    ok(!!svg, 'a fenda é SVG');
    ok(svg.querySelectorAll('.pt-brasa').length === 26, 'as brasas estão lá');
    ok(svg.querySelectorAll('.pt-lasca').length === 9, 'e as lascas de realidade');
    ok(!!svg.querySelector('.pt-iris'), 'a íris — de onde a luz nasce');
    ok(!!svg.querySelector('.pt-greta'), 'e a greta na base');

    const aro = svg.querySelector('.pt-aro');
    ok(!!aro && /^\d+ \d+$/.test(aro.getAttribute('stroke-dasharray')),
       'O ARO É A BARRA: o prazo vira stroke-dasharray no contorno do portal');

    ok(el.querySelector('.pt-acao').disabled === false, 'o botão obedece ao estado');
    ok(el.querySelectorAll('.pt-fer').length === 5,
       'o Arquiteto vê cinco ferramentas (as três comuns + teste e reset)');
    /* Contar `pt-fer` no texto cru dá errado: `pt-ferramentas`, o nome do
       contêiner, contém a mesma sequência. Só o DOM sabe a diferença. */
    const caixa = win.document.createElement('div');
    caixa.innerHTML = P.html(d, { agora: hoje(12, 0) });
    ok(caixa.querySelectorAll('.pt-fer').length === 3,
       'e o hunter comum vê três — teste e reset são do Arquiteto');

    // As brasas não podem reembaralhar entre dois desenhos do MESMO portão.
    const a1 = P.fenda(d, win.PortaoEstado.ler(d, hoje(12, 0)));
    const a2 = P.fenda(d, win.PortaoEstado.ler(d, hoje(12, 0)));
    ok(a1 === a2,
       'o sorteio é semeado pelo id: redesenhar não faz o portão piscar diferente');
    const outro = P.fenda(Object.assign({}, d, { id: 2 }),
                          win.PortaoEstado.ler(d, hoje(12, 0)));
    ok(outro !== a1, 'mas dois portões diferentes têm brasas diferentes');
  }

  /* ── 8b. AS FERRAMENTAS NÃO PISAM NO NOME ──────────────────────── */
  console.log('\n-- o nome do portão é do hunter --');
  {
    /* DEFEITO REAL, VISTO NA TELA: as ferramentas moravam em
       `position:absolute` no canto da lápide. Com "Estúdio" cabia; com
       "Libanus Restaurante" o nome passava por baixo dos botões e os
       dois viravam um borrão. Nenhum `padding-right` conserta, porque o
       número de botões muda (o Arquiteto vê cinco) e o nome é do hunter. */
    const d = base({ titulo: 'Libanus Restaurante Árabe e Cia',
                     sessao_hoje: { status: 'PENDENTE' } });
    win.document.body.innerHTML = P.html(d, { agora: hoje(10, 0), arquiteto: true });
    const el = win.document.querySelector('.pt');

    const fer = el.querySelector('.pt-ferramentas');
    const est = win.getComputedStyle(fer);
    ok(est.position !== 'absolute',
       'as ferramentas saíram do `absolute` — era ele que as punha sobre o nome');
    ok(!!el.querySelector('.pt-rodape .pt-ferramentas'),
       'elas têm linha própria no pé da lápide');
    ok(!el.querySelector('.pt-titulo .pt-fer'),
       'e nenhuma delas vive dentro do título');

    const titulo = el.querySelector('.pt-titulo');
    ok(titulo.textContent === 'Libanus Restaurante Árabe e Cia',
       'o nome chega inteiro, por mais longo que seja');
    ok(!/padding-right/.test(win.getComputedStyle(titulo).cssText || '')
       || win.getComputedStyle(titulo).paddingRight !== '2.2rem',
       'sem reservar um vão fixo que nunca seria o certo para 3 e para 5 botões');

    ok(/\.pt-ferramentas\s*\{[^}]*opacity:\s*\.28/.test(regras),
       'ficam discretas em repouso, mas SEMPRE ocupando o espaço delas — '
       + 'aparecer via `opacity` é o que evita o salto de layout no hover');
  }

  /* ── 8c. O HOVER ───────────────────────────────────────────────── */
  console.log('\n-- o portão percebe a mão --');
  {
    const d = base({ sessao_hoje: { status: 'ATIVA', entrada_em: iso(8, 0), tempo_total_min: 60 } });
    win.document.body.innerHTML = P.html(d, { agora: hoje(12, 0) });
    const svg = win.document.querySelector('.pt-svg');

    const lampejos = svg.querySelectorAll('.pt-lampejo');
    ok(lampejos.length === 2, 'o lampejo existe no desenho, em duas camadas (miolo e cor)');
    ok(/\.pt-lampejo\s*\{[^}]*opacity:\s*0/.test(regras),
       'apagado em repouso — ele só existe para o hover');
    ok(/\.pt:hover \.pt-lampejo[\s\S]{0,200}pt-volta/.test(regras),
       'e no hover ele dá a VOLTA no aro');

    /* O LAMPEJO NÃO PODE SER CONFUNDIDO COM O PRAZO. Os dois vivem no
       mesmo contorno: o prazo é um arco LONGO e parado, o lampejo é um
       traço CURTO em movimento. Se o traço do hover fosse comprido, o
       hunter leria "o tempo pulou" toda vez que passasse o mouse. */
    const dash = lampejos[0].getAttribute('stroke-dasharray');
    const curto = parseFloat(dash.split(' ')[0]);
    ok(curto < P.LARC * 0.06,
       `o traço do hover é CURTO (${curto} de ${P.LARC.toFixed(0)}) — comprido, viraria prazo`);

    ok(/\.pt:hover \.pt-fenda\s*\{[^}]*scale\(1\.0/.test(regras),
       'a fenda inspira de leve');
    ok(/\.pt-m-selado:hover \.pt-fenda[\s\S]{0,120}transform:\s*none/.test(regras),
       'e portão morto NÃO reage — pedra não percebe ninguém');
    ok(/\.pt:hover \.pt-brasa[\s\S]{0,80}\* \.6/.test(regras),
       'as brasas sobem mais rápido');
  }

  /* ── 8d. A TRAVESSIA ───────────────────────────────────────────── */
  console.log('\n-- atravessar o portal --');
  {
    const d = base({ sessao_hoje: { status: 'PENDENTE' } });
    win.document.body.innerHTML = P.html(d, { agora: hoje(10, 0) });
    const el = win.document.querySelector('.pt');

    ok(typeof P.travessia === 'function', 'a travessia é da PEÇA, não do interior');

    /* jsdom não faz layout, então `getBoundingClientRect` devolve zeros;
       o que dá para cobrar aqui é a estrutura e a COR — que é o ponto:
       a animação antiga usava o tema da CATEGORIA e não tinha relação
       nenhuma com o portão clicado. */
    P.travessia(el);
    const ov = win.document.getElementById('pt-travessia');
    ok(!!ov, 'a travessia monta o véu');
    ok(ov.style.getPropertyValue('--pt-nuc') === '#ff9a3c',
       'NA COR DO PORTÃO, lida do próprio elemento — não do tema da categoria');
    ok(ov.style.getPropertyValue('--pt-fra') === '#ff3d6e', 'com a franja junto');

    if (ov.querySelector('.pt-tv-fenda')) {
      ok(!!ov.querySelector('.pt-tv-fenda svg'),
         'a fenda CLONADA é que cresce — é aquele portal, não um anel genérico');
      ok(!!ov.querySelector('.pt-tv-onda'), 'a onda de choque');
      ok(!!ov.querySelector('.pt-tv-clarao'), 'e o clarão do instante de atravessar');
    } else {
      ok(ov.classList.contains('seco'),
         'sem retângulo de origem (jsdom não faz layout), cai no corte seco');
    }

    ok(/transform-origin:\s*var\(--ox\) var\(--oy\)/.test(regras),
       'o crescimento é ancorado na BASE do arco — é por onde se entra');
    ok(/#pt-travessia\.seco/.test(regras),
       'e quem pediu menos movimento leva um corte, não um segundo e meio de cerimônia');

    ov.remove();
  }

  /* ── 9. A CURVA CONGELADA ──────────────────────────────────────── */
  console.log('\n-- a geometria aprovada --');
  {
    const { VB } = P;
    const topo = P.DARC.split(' L').map(p => parseFloat(p.split(',')[1]));
    const yMin = Math.min.apply(null, topo);
    ok(Math.abs(yMin - VB.ay) < 1.5, 'o ápice está onde foi aprovado');

    /* A PROVA DE QUE O ARCO É REDONDO E NÃO UM BICO.
       Num bico, a 6% da largura do centro a curva já caiu bastante. Aqui
       ela mal se move — é o que dá ao portal massa de arco de pedra. O
       Arquiteto recusou a versão ogival; este assert é o guarda. */
    const pts = P.DARC.slice(1).split(' L').map(p => p.split(',').map(Number));
    const perto = pts.filter(p => Math.abs(p[0] - VB.cx) < VB.hw * 0.06);
    const queda = Math.max.apply(null, perto.map(p => p[1])) - yMin;
    ok(queda < 1.2,
       `o topo é REDONDO, não ogival (cai ${queda.toFixed(2)}px no miolo — um bico cairia muito mais)`);
  }

  /* ── 10. O CUSTO ───────────────────────────────────────────────── */
  console.log('\n-- dez portões não podem derreter a máquina --');
  {
    ok(/\.pt-vivo \.pt-brasa/.test(css),
       'nenhuma animação roda sem `.pt-vivo` — quem está fora da tela fica parado');
    ok(/IntersectionObserver/.test(ler('js', 'pecas', 'portao.js')),
       'e é o IntersectionObserver que dá e tira essa classe');
    ok(/id="ptNeon"/.test(ler('js', 'pecas', 'portao.js')),
       'os filtros de brilho são compartilhados, não um jogo por portão');

    win.document.body.innerHTML = '';
    const cont = win.document.createElement('div');
    win.document.body.appendChild(cont);
    P.montar(cont, [1, 2, 3].map(i => base({ id: i, sessao_hoje: { status: 'PENDENTE' } })),
             { agora: hoje(10, 0) });
    ok(cont.querySelectorAll('.pt').length === 3, 'a grade monta os três portões');
    ok(win.document.querySelectorAll('#pt-filtros').length === 1,
       'e o SVG de filtros é criado UMA vez para todos');

    ok(/prefers-reduced-motion/.test(css),
       'quem pediu menos movimento fica com o portão inteiro, parado');
  }

  console.log(`\n=== ${testes - falhas}/${testes} ===`);
  return falhas;
}

process.exit(rodar() ? 1 : 0);
