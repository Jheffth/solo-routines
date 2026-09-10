/* ============================================================
   TESTE — A FORJA DE PORTÕES

   A forja antiga tinha vinte e cinco campos e nenhum teste. Trocar um
   formulário assim por outro é o momento exato em que um campo some sem
   ninguém notar: ele continua no HTML, para de ir no payload, e o portão
   nasce sem tolerância, sem folgas ou sem agenda. Ninguém descobre no
   dia da criação — descobre semanas depois, quando o portão se comporta
   de um jeito que ninguém pediu.

   O QUE ESTE ARQUIVO PROTEGE, EM ORDEM DE GRAVIDADE

   1. NENHUM CAMPO DA FORJA ANTIGA SE PERDEU.
      O Arquiteto disse "mantenha a lógica dele". O primeiro bloco de
      asserts compara o payload com a lista literal de chaves que o
      formulário velho mandava. Se um campo cair, este teste grita.

   2. O PORTÃO ABERTO APAGA O QUE NÃO EXISTE.
      Ligado o interruptor, `hora_entrada`, `hora_saida`, `tolerancia` e
      `agenda_semanal` têm de sair NULOS — não guardados "para depois".
      Se ficassem gravados, desligar o interruptor amanhã ressuscitaria
      um horário esquecido, e com ele um no-show que ninguém pediu.

   3. A CONTA NA TELA É A CONTA DO SERVIDOR.
      A prévia mostra XP de entrada, clear e punição calculados. Se a
      fórmula divergir de `routers/dungeons.py`, a forja passa a mentir —
      e mentir com precisão é pior do que escrever "auto".

   4. AS NATUREZAS NOVAS CHEGAM INTEIRAS.
      CIRCUITO tem de sair com `circuito_payload.etapas`; META com alvo,
      unidade, espécie e modo; REPETIÇÃO com `alvo_repeticoes`. Uma
      natureza que o backend entende e a forja não sabe montar não
      existe do ponto de vista do hunter — foi exatamente o que
      aconteceu com o CIRCUITO no lançador.

   5. O ACERVO COPIA, NÃO VINCULA.
      O molde tem de chegar sem `id`. Com `id`, "reformular" a cópia
      viraria editar o original — e mexer no XP de um portão mudaria o
      de outro sem ninguém pedir.

   Uso: NODE_PATH=/tmp/deps/node_modules node teste_forja_portao.js
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
const fonte = fs.readFileSync(path.join(RAIZ, 'js', 'forja-portao.js'), 'utf8');
const css   = fs.readFileSync(path.join(RAIZ, 'css', 'forja-portao.css'), 'utf8');

/* Os campos que a forja ANTIGA mandava. Lista literal, copiada do
   `_salvar()` que foi substituído — é o contrato que "mantenha a lógica
   dele" significa na prática. */
const CAMPOS_HERDADOS = [
  'titulo', 'descricao', 'icone', 'categoria', 'rank', 'dificuldade',
  'tipo_permanencia', 'tipo_recorrencia', 'dias_semana', 'dia_mes',
  'mes_dia', 'data_inicio', 'data_fim', 'hora_entrada', 'hora_saida',
  'tolerancia_min', 'duracao_max_min', 'xp_entrada', 'xp_clear', 'moedas_clear',
  'penalidade_entrada_xp', 'penalidade_atraso_xp', 'agenda_semanal',
  'folgas',
];

function montar() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>',
    { runScripts: 'outside-only', url: 'http://localhost/' });
  const win = dom.window;
  win.chamadas = [];
  win.API = {
    dungeons: {
      criar:        async (p)     => { win.chamadas.push(['criar', p]); return { id: 7, titulo: p.titulo }; },
      atualizar:    async (id, p) => { win.chamadas.push(['atualizar', id, p]); return { id }; },
      criarMissao:  async (id, m) => { win.chamadas.push(['criarMissao', id, m]); return Object.assign({ id: 99 }, m); },
      deletarMissao: async (mid)  => { win.chamadas.push(['deletarMissao', mid]); },
      acervo:       async ()      => ({ acervo: win.__acervo || [] }),
    },
    get: async () => ({}), post: async () => ({}),
  };
  win.SoloDialog = { toast: (m, t) => win.chamadas.push(['toast', t, m]) };
  win.Dungeons = {
    CATEGORIAS: ['Trabalho', 'Saúde', 'Estudo', 'Casa', 'Pessoal', 'Combate'],
    RANKS: ['E', 'D', 'C', 'B', 'A', 'S'],
    _bindIconPicker: () => {},
  };
  if (!win.requestAnimationFrame) win.requestAnimationFrame = (f) => win.setTimeout(f, 0);

  const ctx = dom.getInternalVMContext();
  vm.runInContext(fonte, ctx);
  return { dom, win, F: win.ForjaPortao };
}

const g   = (win, id) => win.document.getElementById(id);
const set = (win, id, val) => { const e = g(win, id); if (e) e.value = val; };

async function rodar() {
  console.log('\n=== A FORJA DE PORTÕES ===\n');

  /* ── 1. O CONTRATO COM A FORJA ANTIGA ──────────────────────────── */
  console.log('-- nenhum campo se perdeu --');
  {
    const { win, F } = montar();
    F.abrir(null, {});

    set(win, 'fp-titulo-i', 'Trabalho CLT');
    set(win, 'fp-descricao', 'O expediente.');
    set(win, 'fp-rank', 'A');
    set(win, 'fp-dificuldade', 'DIFICIL');
    set(win, 'fp-recorrencia', 'SEMANAL');
    set(win, 'fp-hora-entrada', '08:00');
    set(win, 'fp-hora-saida', '17:30');
    set(win, 'fp-tolerancia', '12');
    set(win, 'fp-xp-entrada', '40');
    F._folgas = ['2026-07-22'];

    await F._salvar();
    const [tipo, payload] = win.chamadas.find(c => c[0] === 'criar');

    ok(tipo === 'criar', 'a forja chamou o endpoint de criação');
    const faltando = CAMPOS_HERDADOS.filter(k => !(k in payload));
    ok(faltando.length === 0,
       faltando.length ? 'CAMPOS PERDIDOS: ' + faltando.join(', ')
                       : `os ${CAMPOS_HERDADOS.length} campos da forja antiga continuam no payload`);

    ok(payload.titulo === 'Trabalho CLT', 'o nome viajou');
    ok(payload.rank === 'A' && payload.dificuldade === 'DIFICIL', 'rank e dificuldade viajaram');
    ok(payload.hora_entrada === '08:00' && payload.hora_saida === '17:30', 'os horários viajaram');
    ok(payload.tolerancia_min === 12, 'a tolerância viajou');
    ok(payload.xp_entrada === 40, 'o XP escrito à mão sobrescreve o auto');
    ok(payload.xp_clear === null, 'e o que ficou em branco vai NULO (o servidor calcula)');
    ok(JSON.stringify(payload.folgas) === '["2026-07-22"]', 'as folgas viajaram');
    ok(Array.isArray(payload.dias_semana), 'os dias da semana viajaram');
    ok('sempre_aberta' in payload, 'e o campo novo do portão aberto está lá');
  }

  /* ── 2. O PORTÃO QUE NÃO FECHA ─────────────────────────────────── */
  console.log('\n-- o portão aberto apaga o que não existe --');
  {
    const { win, F } = montar();
    F.abrir(null, {});
    set(win, 'fp-titulo-i', 'Estúdio');
    set(win, 'fp-hora-entrada', '08:00');
    set(win, 'fp-hora-saida', '17:30');
    set(win, 'fp-tolerancia', '15');

    // O Arquiteto liga o interruptor DEPOIS de já ter escrito horários.
    g(win, 'fp-chave-aberta').click();
    ok(g(win, 'fp-chave-aberta').classList.contains('on'), 'o interruptor liga');
    ok(g(win, 'fp-grade-horarios').style.display === 'none',
       'e os horários somem da tela na hora — eles não querem dizer mais nada');

    await F._salvar();
    const p = win.chamadas.find(c => c[0] === 'criar')[1];

    ok(p.sempre_aberta === true, 'o portão nasce aberto');
    ok(p.hora_entrada === null && p.hora_saida === null,
       'os horários que ele digitou antes NÃO ficam guardados');
    ok(p.tolerancia_min === 0, 'nem a tolerância — sem hora marcada não há atraso a tolerar');
    ok(p.agenda_semanal === null, 'nem a agenda semanal');
  }

  /* ── 3. A CONTA NA TELA ────────────────────────────────────────── */
  console.log('\n-- a leitura do Sistema bate com o servidor --');
  {
    const { win, F } = montar();
    F.abrir(null, {});

    // Rank E + Normal = ×1.00 → os padrões crus de routers/dungeons.py
    ok(g(win, 'fp-lm').textContent === '×1.00', 'rank E + normal = ×1.00');
    ok(g(win, 'fp-le').textContent === '+25', 'XP de entrada padrão = 25');
    ok(g(win, 'fp-lc').textContent === '+100', 'clear rank S = 100 (×1.0)');
    ok(g(win, 'fp-lc2').textContent === '+40', 'clear rank C = 40 (×0.4)');
    ok(g(win, 'fp-lp').textContent === '−50', 'no-show custa 50');

    // Rank A (×1.75) + Difícil (×1.5) = ×2.625 — o número que "auto"
    // escondia do Arquiteto.
    set(win, 'fp-rank', 'A');
    set(win, 'fp-dificuldade', 'DIFICIL');
    F._pintar();
    ok(g(win, 'fp-lm').textContent === '×2.63', 'rank A + difícil = ×2.63 (era isto que "auto" escondia)');
    ok(g(win, 'fp-le').textContent === '+65', 'entrada 25×2.625 = 65 (trunca, como o int() do servidor)');
    ok(g(win, 'fp-lc').textContent === '+262', 'clear S 100×2.625 = 262');
    ok(g(win, 'fp-lp').textContent === '−131', 'e o no-show sobe junto: 50×2.625 = 131');

    // Ligado o interruptor, as punições de horário deixam de existir.
    g(win, 'fp-chave-aberta').click();
    ok(g(win, 'fp-lp').textContent === '—' && g(win, 'fp-lpa').textContent === '—',
       'no portão aberto não há no-show nem atraso — e a leitura diz isso');
  }

  /* ── 4. OS AVISOS ──────────────────────────────────────────────── */
  console.log('\n-- os avisos aparecem antes do erro, não depois --');
  {
    const { win, F } = montar();
    F.abrir(null, {});
    const av = () => g(win, 'fp-aviso').textContent;

    ok(av().includes('nome'), 'sem nome, a forja avisa');
    set(win, 'fp-titulo-i', 'Portão');
    F._pintar();
    ok(av().includes('quadro está vazio'), 'quadro vazio: "todo clear sai rank S de graça"');

    set(win, 'fp-recorrencia', 'SEMANAL');
    win.document.querySelectorAll('[data-fp-dia].on').forEach(b => b.classList.remove('on'));
    F._pintar();
    ok(av().includes('nunca vai abrir'),
       'semanal sem nenhum dia marcado: o portão nunca abriria e ninguém saberia por quê');
  }

  /* ── 5. AS NATUREZAS NOVAS ─────────────────────────────────────── */
  console.log('\n-- as naturezas pesadas chegam inteiras --');
  {
    const { win, F } = montar();
    F.abrir(null, {});
    set(win, 'fp-titulo-i', 'Academia');

    // CIRCUITO — o treino do Arquiteto
    F._escolherNatureza('CIRCUITO');
    ok(g(win, 'fpm-w-circuito').style.display !== 'none', 'CIRCUITO abre o editor de blocos');
    F._blocos = [
      { titulo: 'Mobilidade', modo: 'TEMPO', min: 5, max: 5, unidade: 'min' },
      { titulo: 'Cardio', modo: 'TEMPO', min: 25, max: 30, unidade: 'min' },
      { titulo: 'Prancha', modo: 'SERIE_TEMPO', series: 3, min: 20, max: 30, unidade: 's' },
      { titulo: 'Agachamento', modo: 'SERIE_REP', series: 3, min: 10, max: 12 },
    ];
    F._renderBlocos();
    ok(F._rotuloFaixa(F._blocos[1]) === '25–30 min', 'a faixa vira texto ANTES de gravar: "25–30 min"');
    ok(F._rotuloFaixa(F._blocos[2]) === '3 × 20–30 s', 'com séries: "3 × 20–30 s"');
    ok(F._rotuloFaixa(F._blocos[0]) === '5 min', 'faixa de valor único não vira "5–5"');
    ok(F._rotuloFaixa({ modo: 'CHECK' }) === 'feito / não feito', 'e o CHECK se explica sozinho');

    set(win, 'fpm-titulo', 'Treino de adaptação');
    g(win, 'fpm-add').click();

    const circ = F._missoes[0];
    ok(circ && circ.natureza === 'CIRCUITO', 'a missão de circuito foi pregada no quadro');
    ok(circ.circuito_payload?.etapas?.length === 4, 'com os quatro blocos');
    ok(circ.circuito_payload.etapas[0].id === 'b1'
       && circ.circuito_payload.etapas[3].id === 'b4',
       'o id do bloco vem da POSIÇÃO — renomear não apaga o que já foi entregue nele');
    ok(circ.circuito_payload.etapas[3].unidade === null,
       'SERIE_REP não carrega unidade (repetição não tem "un")');
    ok(F._blocos.length === 0 || F._blocos.every(b => !b.titulo),
       'e os blocos são limpos para a próxima missão');

    // Um circuito sem blocos é recusado, com explicação.
    F._escolherNatureza('CIRCUITO');
    F._blocos = [];
    set(win, 'fpm-titulo', 'Circuito vazio');
    g(win, 'fpm-add').click();
    ok(F._missoes.length === 1, 'circuito sem bloco nenhum não entra no quadro');
    ok(win.chamadas.some(c => c[0] === 'toast' && /bloco/i.test(c[2])),
       'e a forja diz por quê, em vez de gravar uma missão quebrada');

    // META
    F._escolherNatureza('META');
    ok(g(win, 'fpm-w-alvo').style.display !== 'none', 'META abre alvo e unidade');
    set(win, 'fpm-titulo', 'Ler o manual');
    set(win, 'fpm-alvo', '120');
    set(win, 'fpm-unid', 'pág');
    set(win, 'fpm-especie', 'SOMA');
    g(win, 'fpm-add').click();
    const meta = F._missoes[1];
    ok(meta.meta_alvo === 120 && meta.meta_unidade === 'pág',
       'a meta viaja com alvo e unidade');
    ok(meta.meta_especie === 'SOMA' && meta.meta_modo === 'SUBIR',
       'e com espécie e direção');
    ok(meta.circuito_payload === undefined, 'sem carregar payload de circuito junto');

    // REPETIÇÃO
    F._escolherNatureza('REPETICAO');
    set(win, 'fpm-titulo', 'Rodada de revisão');
    set(win, 'fpm-reps', '4');
    g(win, 'fpm-add').click();
    ok(F._missoes[2].alvo_repeticoes === 4, 'a repetição viaja com o alvo de vezes');

    // FLAVOR não vale XP — nem se o campo estiver preenchido.
    F._escolherNatureza('FLAVOR');
    set(win, 'fpm-titulo', 'A masmorra respira');
    set(win, 'fpm-xp', '999');
    g(win, 'fpm-add').click();
    ok(F._missoes[3].xp_recompensa === 0,
       'sussurro não paga XP, mesmo com 999 escrito no campo');

    ok(g(win, 'fp-lq').textContent === '4', 'a prévia conta as quatro missões do quadro');
  }

  /* ── 6. O ACERVO ───────────────────────────────────────────────── */
  console.log('\n-- o acervo copia, não vincula --');
  {
    const { win, F } = montar();
    win.__acervo = [
      { titulo: 'Entregar relatório', icone: '📋', natureza: 'PADRAO',
        xp_recompensa: 45, moedas_recompensa: 4, fonte: 'Trabalho CLT', id: 31 },
      { titulo: 'Treino', icone: '💪', natureza: 'CIRCUITO', xp_recompensa: 100,
        moedas_recompensa: 10, fonte: 'Academia',
        circuito: { etapas: [{ id: 'b1', titulo: 'Cardio', modo: 'TEMPO', min: 25, max: 30 }] } },
    ];
    F.abrir(null, {});
    await new Promise(r => win.setTimeout(r, 10));

    const fichas = win.document.querySelectorAll('[data-fp-acervo]');
    ok(fichas.length === 2, 'as duas missões do acervo viraram fichas clicáveis');
    ok(win.document.getElementById('fpm-acervo').textContent.includes('Trabalho CLT'),
       'e cada ficha diz de onde veio');

    fichas[0].click();
    const copia = F._missoes[0];
    ok(copia.titulo === 'Entregar relatório', 'clicar copia o molde para o quadro');
    ok(copia.xp_recompensa === 45, 'com o XP que já estava calibrado');
    ok(copia.id === undefined,
       'e SEM id: é cópia, não vínculo — reformular aqui não toca no portão de origem');
    ok(copia.fonte === undefined, 'a procedência não vai para o servidor');

    fichas[1].click();
    const copiaCirc = F._missoes[1];
    ok(copiaCirc.circuito_payload?.etapas?.length === 1,
       'o circuito do acervo volta a ser payload, pronto para o servidor');
    ok(copiaCirc.circuito === undefined, 'sem a leitura antiga pendurada junto');
  }

  /* ── 7. EDIÇÃO ─────────────────────────────────────────────────── */
  console.log('\n-- reforjar um portão existente --');
  {
    const { win, F } = montar();
    const existente = {
      id: 12, titulo: 'Templo do Estudo', descricao: 'Silêncio.',
      icone: '📚', categoria: 'Estudo', rank: 'B', dificuldade: 'DIFICIL',
      tipo_permanencia: 'PERMANENTE', tipo_recorrencia: 'SEMANAL',
      dias_semana: [1, 3], hora_entrada: '19:00', hora_saida: '21:00',
      tolerancia_min: 5, sempre_aberta: false,
      agenda_semanal: { '5': { aberto: false } },
      folgas: ['2026-12-25'],
      xp_entrada: null, xp_clear: 300, moedas_clear: null,
      penalidade_entrada_xp: null, penalidade_atraso_xp: null,
      missoes: [{ id: 5, titulo: 'Ler 20 páginas', natureza: 'PADRAO',
                  icone: '📖', xp_recompensa: 50 }],
    };
    F.abrir(existente, {});

    ok(g(win, 'fp-titulo-i').value === 'Templo do Estudo', 'os campos vieram preenchidos');
    ok(g(win, 'fp-rank').value === 'B', 'inclusive o rank');
    ok(g(win, 'fp-xp-clear').value === '300', 'e o XP de clear sobrescrito');
    ok(F._folgas.length === 1, 'as folgas voltaram');
    ok(F._missoes.length === 1, 'o quadro voltou com a missão que já existia');
    ok(g(win, 'fp-titulo').textContent.includes('REFORJAR'), 'o título diz que é reforja');

    const marcados = [...win.document.querySelectorAll('[data-fp-dia].on')]
      .map(b => parseInt(b.dataset.fpDia)).sort();
    ok(JSON.stringify(marcados) === '[1,3]', 'os dias marcados são os do portão, não o padrão');

    const sab = win.document.querySelector('[data-fp-ag-tog="5"]');
    ok(!sab.classList.contains('on'), 'e o sábado fechado da agenda voltou fechado');

    // Uma missão nova, pregada durante a edição, precisa ser criada no
    // servidor: `atualizar` não leva o quadro junto.
    F._escolherNatureza('PADRAO');
    set(win, 'fpm-titulo', 'Revisar as anotações');
    g(win, 'fpm-add').click();
    await F._salvar();

    ok(win.chamadas.some(c => c[0] === 'atualizar' && c[1] === 12), 'o portão foi atualizado');
    const criadas = win.chamadas.filter(c => c[0] === 'criarMissao');
    ok(criadas.length === 1, 'só a missão NOVA foi criada no servidor');
    ok(criadas[0][2].titulo === 'Revisar as anotações',
       'e é a certa — a que já tinha id não foi duplicada');
  }

  /* ── 7b. O LIMITE DE TEMPO ─────────────────────────────────────── */
  console.log('\n-- o limite da travessia sobrevive ao interruptor --');
  {
    const { win, F } = montar();
    F.abrir(null, {});
    set(win, 'fp-titulo-i', 'Estúdio');
    set(win, 'fp-hora-saida', '17:30');
    set(win, 'fp-duracao', '90');
    F._pintar();

    ok(g(win, 'fp-lt').textContent.includes('90 min'),
       'a leitura diz o prazo da travessia');
    ok(g(win, 'fp-pv-selos').innerHTML.includes('1h30'),
       'e a prévia carimba "limite 1h30" no portão');

    g(win, 'fp-chave-aberta').click();
    F._pintar();
    ok(g(win, 'fp-pv-selos').innerHTML.includes('1h30'),
       'ligar o portão aberto NÃO apaga o limite — é ali que ele importa');
    ok(g(win, 'fp-aviso').textContent.includes('não para'),
       'e a forja avisa que o relógio corre mesmo com ele fora');

    await F._salvar();
    const p = win.chamadas.find(c => c[0] === 'criar')[1];
    ok(p.duracao_max_min === 90,
       'o limite viaja no payload, mesmo com o portão aberto');
    ok(p.hora_saida === null,
       'enquanto a hora de saída, essa sim, foi apagada pelo interruptor');

    // Sem limite escrito, o campo vai nulo — não zero.
    const b = montar();
    b.F.abrir(null, {});
    set(b.win, 'fp-titulo-i', 'Sem prazo');
    await b.F._salvar();
    const p2 = b.win.chamadas.find(c => c[0] === 'criar')[1];
    ok(p2.duracao_max_min === null,
       'campo vazio vira NULO, não 0 — zero seria um prazo de zero minutos');
    ok(g(b.win, 'fp-lt').textContent === 'só o fim do dia',
       'e a leitura diz que a travessia não tem prazo');
  }

  /* ── 8. A CASCA ────────────────────────────────────────────────── */
  console.log('\n-- vidro, neon e glitch --');
  {
    const { win, F } = montar();
    F.abrir(null, {});
    const caixa = g(win, 'fp-caixa');

    ok(caixa.style.getPropertyValue('--fp-cor') === '#94a3b8',
       'a cor do rank E desce por --fp-cor');
    set(win, 'fp-rank', 'S');
    F._pintar();
    ok(caixa.style.getPropertyValue('--fp-cor') === '#fbbf24',
       'e trocar para rank S repinta a janela inteira de dourado');
    ok(g(win, 'fp-selo-rank').textContent === 'RANK S', 'o selo do topo acompanha');

    F._glitch();
    ok(g(win, 'fp-titulo').classList.contains('glitch'),
       'o glitch dispara na troca de rank');
    ok(g(win, 'fp-titulo').dataset.txt === g(win, 'fp-titulo').textContent,
       'e as duas cópias do glitch leem o mesmo texto do título');

    ok(/backdrop-filter/.test(css), 'a transparência é vidro de verdade (backdrop-filter)');
    ok(/conic-gradient\(from var\(--fp-giro/.test(css),
       'a borda viva é o mesmo conic-gradient do dossiê e do circuito');
    ok(/mask-composite/.test(css), 'em máscara xor — pinta o perímetro sem engordar o layout');
    ok(/prefers-reduced-motion/.test(css),
       'e quem pediu menos movimento fica com a forja inteira, sem o giro');

    // As quatro câmaras
    ok(win.document.querySelectorAll('[data-fp-camara]').length === 4, 'são quatro câmaras');
    ok(win.document.querySelectorAll('.fp-camara.on').length === 1,
       'e só uma aparece por vez — o resto era a parede de vinte e cinco campos');
    F._irPara(2);
    ok(g(win, 'fp-campos').querySelector('[data-fp-camara="2"]').classList.contains('on'),
       'o trilho navega entre elas');
    ok(g(win, 'fp-voltar').disabled === false && g(win, 'fp-avancar').disabled === false,
       'no meio do trilho dá para ir e vir');
    F._irPara(0);
    ok(g(win, 'fp-voltar').disabled === true, 'na primeira câmara não há "anterior"');
  }

  console.log(`\n=== ${testes - falhas}/${testes} ===`);
  return falhas;
}

rodar().then(f => process.exit(f ? 1 : 0));
