/* ══════════════════════════════════════════════════════════════════
   A FORJA DE PORTÕES — o criador de Dungeons

   O Arquiteto: "analisar totalmente o que o nosso criador de dungeons já
   faz, mantenha a lógica dele, reformule com transparências e cores
   neon, efeitos e glitches. Deve ser um portão realmente útil e prático
   para a criação de dungeons realmente usáveis."

   MANTIVE A LÓGICA. Cada campo da forja antiga continua aqui, com o
   mesmo nome no payload e a mesma regra: permanência x recorrência,
   agenda semanal por dia, folgas, tolerância, os cinco valores de
   economia com "auto", o quadro de missões com suas naturezas. Nada foi
   removido — nem o que eu teria cortado, porque o portão de alguém já
   pode depender disso.

   O QUE MUDOU É ONDE A INFORMAÇÃO MORA.

   1. QUATRO CÂMARAS, NÃO UMA PAREDE.
      Vinte e cinco campos numa grade só é uma lista de tarefas
      disfarçada de formulário. Selo / Tempo / Quadro / Preço são as
      quatro perguntas que a pessoa realmente responde ao criar um
      portão, e cada uma cabe numa tela sem rolagem.

   2. "AUTO" DEIXOU DE SER SEGREDO.
      Os cinco campos de economia mostravam "auto" e mais nada. O
      Arquiteto não tinha como saber que Rank A + Difícil multiplica
      tudo por 2,625. Agora a prévia calcula e mostra: entrada, clear por
      rank, moedas, e o risco em XP. As fórmulas são as mesmas de
      `routers/dungeons.py` — se elas mudarem lá, mudam aqui (é o preço
      de mostrar a conta antes de o servidor fazê-la).

   3. O PORTÃO QUE NÃO FECHA TEM INTERRUPTOR.
      E, ligado, ele APAGA os horários na tela. Num portão sem porta,
      hora de entrada e tolerância não querem dizer nada — deixá-los
      acesos ensinaria uma regra que não existe.

   4. O ACERVO.
      "Reaproveitar e reformular as missões": as missões dos outros
      portões e as rotinas do mundo de fora aparecem como fichas
      clicáveis. Clicar copia o molde para o quadro, onde ele pode ser
      reformulado à vontade — é cópia, não vínculo.

   Depende de: API.dungeons, SoloDialog, Dungeons (para o seletor de
   ícones e a confirmação visual, que já eram bons e continuam de pé).
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* As mesmas tabelas de routers/dungeons.py. Elas vivem aqui para que a
     prévia mostre a conta ANTES de existir servidor para responder. */
  const MULT_RANK  = { E: 1.0, D: 1.1, C: 1.25, B: 1.5, A: 1.75, S: 2.0 };
  const MULT_DIFIC = { FACIL: 0.75, NORMAL: 1.0, DIFICIL: 1.5, LENDARIO: 2.5 };
  const MULT_CLEAR = { S: 1.0, A: 0.8, B: 0.6, C: 0.4, D: 0.25, F: 0.0 };

  const COR_RANK = {
    E: '#94a3b8', D: '#4ade80', C: '#60a5fa',
    B: '#c084fc', A: '#f97316', S: '#fbbf24',
  };

  const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  /* AS NATUREZAS, com a frase que explica o que cada uma FAZ.
     A forja antiga mostrava "⏳ Resistência (enche com o tempo)" dentro
     de um `<select>`, onde a explicação some assim que se escolhe. Como
     placa, ela fica na tela enquanto os campos daquela natureza estão
     abertos — que é exatamente quando ela é necessária. */
  /* `glifo` é o nome no alfabeto do Sistema (js/glifos.js), não um
     emoji. O arquivo de lá explica o porquê melhor do que eu: "cada
     sistema operacional desenha o seu, a cor não obedece ao tema, o peso
     não combina com o traço do app". As placas nasceram com emoji e
     eram, sozinhas, o último canto da forja fora do alfabeto.

     `ico` sobrevive como o ícone PADRÃO da missão daquela natureza —
     esse continua sendo emoji porque é escolha do hunter, feita no
     seletor de ícones, e vai gravado no banco. */
  const NATUREZAS = [
    { v: 'PADRAO',    glifo: 'padrao',    ico: '⚔️', nome: 'Padrão',
      diz: 'Iniciar, pausar, cumprir. A missão comum do quadro.' },
    { v: 'AGENDADA',  glifo: 'agendada',  ico: '🕒', nome: 'Agendada',
      diz: 'Abre numa hora e vence noutra, dentro da sessão.' },
    { v: 'CIRCUITO',  glifo: 'circuito',  ico: '🌀', nome: 'Circuito',
      diz: 'Vários blocos, um prazo, uma punição só.' },
    { v: 'META',      glifo: 'meta',      ico: '🎯', nome: 'Meta',
      diz: 'Um número a perseguir: km, páginas, litros.' },
    { v: 'REPETICAO', glifo: 'repeticao', ico: '🔁', nome: 'Repetição',
      diz: 'N vezes dentro da mesma travessia.' },
    { v: 'RESISTENCIA', glifo: 'ampulheta', ico: '⏳', nome: 'Resistência',
      diz: 'Enche sozinha com o tempo de permanência.' },
    { v: 'EVENTO_ALEATORIO', glifo: 'evento', ico: '⚡', nome: 'Evento',
      diz: 'Surge de surpresa e expira. Bônus, nunca punição.' },
    { v: 'BEM_ESTAR', glifo: 'bem_estar', ico: '💧', nome: 'Bem-estar',
      diz: 'Lembrete periódico: água, alongar, respirar.' },
    { v: 'FLAVOR',    glifo: 'olho',      ico: '👁', nome: 'Sussurro',
      diz: 'Só imersão. Não vale XP e não cobra nada.' },
  ];

  /* O DESENHO, COM UMA SAÍDA SE O ALFABETO NÃO CARREGOU.
     `forja-portao.js` pode ser carregado sem `glifos.js` (num teste, num
     recorte da página). Sem esta guarda a placa ficaria vazia — pior que
     o emoji que ela veio substituir. */
  const glifo = (nome, tam) => (
    window.Glifos && Glifos.existe(nome)
      ? Glifos.rico(nome, tam || 22)
      : `<svg viewBox="0 0 24 24" width="${tam || 22}" height="${tam || 22}"
           fill="none" stroke="currentColor" stroke-width="1.5"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
           ><path d="M12 2l8 10-8 10-8-10z"/></svg>`);

  const MODOS_BLOCO = [
    { v: 'TEMPO',       t: 'Tempo' },
    { v: 'SERIE_TEMPO', t: 'Séries × tempo' },
    { v: 'SERIE_REP',   t: 'Séries × reps' },
    { v: 'CHECK',       t: 'Feito / não feito' },
  ];

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const ForjaPortao = {
    _d: null,             // dungeon em edição (null = criando)
    _missoes: [],
    _folgas: [],
    _blocos: [],
    _acervo: [],
    _passo: 0,
    _aoSalvar: null,
    _natSel: 'PADRAO',

    PASSOS: [
      { n: 1, t: 'O Selo' },
      { n: 2, t: 'O Tempo' },
      { n: 3, t: 'O Quadro' },
      { n: 4, t: 'O Preço' },
    ],

    /* ═══════════════════════════════════════════════════════════════
       ABRIR
       ═══════════════════════════════════════════════════════════════ */
    abrir(dungeon, opcoes) {
      this._d        = dungeon || null;
      this._missoes  = dungeon ? (dungeon.missoes || []).slice() : [];
      this._folgas   = dungeon ? (dungeon.folgas || []).slice() : [];
      this._blocos   = [];
      this._passo    = 0;
      this._natSel   = 'PADRAO';
      this._aoSalvar = (opcoes && opcoes.aoSalvar) || null;

      this._montar();
      this._preencher(dungeon);
      this._irPara(0);
      this._pintar();

      const bd = document.getElementById('fp-backdrop');
      bd.style.display = 'flex';
      requestAnimationFrame(() => bd.classList.add('on'));

      this._carregarAcervo();
    },

    fechar() {
      const bd = document.getElementById('fp-backdrop');
      if (!bd) return;
      bd.classList.remove('on');
      setTimeout(() => { bd.style.display = 'none'; }, 240);
      this._d = null;
      this._missoes = [];
    },

    /* ═══════════════════════════════════════════════════════════════
       CONSTRUÇÃO — uma vez só
       ═══════════════════════════════════════════════════════════════ */
    _montar() {
      if (document.getElementById('fp-backdrop')) return;

      const el = document.createElement('div');
      el.id = 'fp-backdrop';
      el.className = 'fp-backdrop';
      el.style.display = 'none';
      el.innerHTML = `
      <div class="fp-caixa" id="fp-caixa">
        <div class="fp-borda"></div>
        <div class="fp-scan"></div>

        <div class="fp-topo">
          <div class="fp-titulo" id="fp-titulo" data-txt="⚒ FORJA DE PORTÕES">⚒ FORJA DE PORTÕES</div>
          <div class="fp-selo-rank" id="fp-selo-rank">RANK E</div>
          <button class="fp-x" id="fp-x" title="Fechar">✕</button>
        </div>

        <div class="fp-trilho" id="fp-trilho">
          ${this.PASSOS.map((p, i) => `
            <div class="fp-passo${i === 0 ? ' on' : ''}" data-fp-passo="${i}">
              <span class="n">${p.n}</span><span>${p.t}</span>
            </div>`).join('')}
        </div>

        <div class="fp-corpo">
          <div class="fp-campos" id="fp-campos">
            ${this._camaraSelo()}
            ${this._camaraTempo()}
            ${this._camaraQuadro()}
            ${this._camaraPreco()}
          </div>

          <div class="fp-previa">
            <div class="fp-previa-rotulo">Prévia do Portão</div>
            <div class="fp-portao" id="fp-portao">
              <div class="ico" id="fp-pv-ico">🌀</div>
              <div class="nome" id="fp-pv-nome">Portão sem nome</div>
              <div class="lore" id="fp-pv-lore"></div>
              <div class="selos" id="fp-pv-selos"></div>
            </div>

            <div class="fp-leitura">
              <div class="fp-leitura-topo">Leitura do Sistema</div>
              <div class="fp-linha"><span class="k">Multiplicador</span><span class="v neon" id="fp-lm">×1.00</span></div>
              <div class="fp-linha"><span class="k">XP de entrada</span><span class="v bom" id="fp-le">+25</span></div>
              <div class="fp-linha"><span class="k">Clear (rank S)</span><span class="v bom" id="fp-lc">+100</span></div>
              <div class="fp-linha"><span class="k">Clear (rank C)</span><span class="v" id="fp-lc2">+40</span></div>
              <div class="fp-linha"><span class="k">Moedas de clear</span><span class="v" id="fp-lmo">10</span></div>
              <div class="fp-linha"><span class="k">Risco por no-show</span><span class="v ruim" id="fp-lp">−50</span></div>
              <div class="fp-linha"><span class="k">Risco por atraso</span><span class="v ruim" id="fp-lpa">−15</span></div>
              <div class="fp-linha"><span class="k">Missões no quadro</span><span class="v" id="fp-lq">0</span></div>
              <div class="fp-linha"><span class="k">Prazo da travessia</span><span class="v" id="fp-lt">—</span></div>
            </div>

            <div class="fp-aviso vazio" id="fp-aviso"></div>
          </div>
        </div>

        <div class="fp-rodape">
          <button class="fp-btn" id="fp-voltar">◀ Anterior</button>
          <button class="fp-btn" id="fp-avancar">Próxima ▶</button>
          <button class="fp-btn principal" id="fp-forjar">⚒ Forjar Portão</button>
        </div>
      </div>`;
      document.body.appendChild(el);
      this._ligar(el);
    },

    /* ── CÂMARA 1: O SELO ─────────────────────────────────────────── */
    _camaraSelo() {
      const cats  = (window.Dungeons?.CATEGORIAS || ['Pessoal'])
        .map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
      const ranks = ['E', 'D', 'C', 'B', 'A', 'S']
        .map(r => `<option value="${r}">Rank ${r}</option>`).join('');
      return `
      <div class="fp-camara on" data-fp-camara="0">
        <div class="fp-secao">Identidade</div>
        <div class="fp-grade">
          <div class="fp-campo full"><label>Nome do portão</label>
            <input id="fp-titulo-i" placeholder="Ex.: Trabalho CLT, Templo do Estudo..."></div>
          <div class="fp-campo full"><label>Lore <span class="dica">— aparece dentro da Dungeon</span></label>
            <textarea id="fp-descricao" placeholder="A história deste lugar..."></textarea></div>
          <div class="fp-campo"><label>Ícone</label><input id="fp-icone" maxlength="4" value="🌀"></div>
          <div class="fp-campo"><label>Categoria <span class="dica">(tema visual)</span></label>
            <select id="fp-categoria">${cats}</select></div>
        </div>

        <div class="fp-secao">Peso</div>
        <div class="fp-grade">
          <div class="fp-campo"><label>Rank do portão</label><select id="fp-rank">${ranks}</select></div>
          <div class="fp-campo"><label>Dificuldade</label>
            <select id="fp-dificuldade">
              <option value="FACIL">Fácil</option>
              <option value="NORMAL" selected>Normal</option>
              <option value="DIFICIL">Difícil</option>
              <option value="LENDARIO">Lendário</option>
            </select></div>
        </div>
        <div style="margin-top:.6rem;font-size:.68rem;color:var(--text-muted);line-height:1.4">
          Rank e dificuldade não decoram: eles multiplicam <b>tudo</b> — o XP
          que o portão paga e o XP que ele cobra. A conta aparece na leitura
          do Sistema, ao lado.
        </div>
      </div>`;
    },

    /* ── CÂMARA 2: O TEMPO ────────────────────────────────────────── */
    _camaraTempo() {
      return `
      <div class="fp-camara" data-fp-camara="1">
        <div class="fp-secao">O portão</div>
        <div class="fp-grade">
          <div class="fp-chave" id="fp-chave-aberta">
            <span class="bolha"></span>
            <span class="txt">
              <b>Portão que não fecha</b>
              <span>Sem hora marcada, sem atraso, sem no-show. Entra e sai à vontade — dá para migrar entre dungeons no meio do dia.</span>
            </span>
          </div>

          <div class="fp-campo"><label>Permanência</label>
            <select id="fp-permanencia">
              <option value="PERMANENTE">Permanente (recorrente)</option>
              <option value="TEMPORARIA">Temporária (uma janela)</option>
            </select></div>
          <div class="fp-campo" id="fp-w-recorrencia"><label>Recorrência</label>
            <select id="fp-recorrencia">
              <option value="DIARIA">Diária</option>
              <option value="SEMANAL">Semanal</option>
              <option value="MENSAL">Mensal</option>
              <option value="ANUAL">Anual</option>
            </select></div>
          <div class="fp-campo full" id="fp-w-dias"><label>Dias da semana</label>
            <div class="fp-dias" id="fp-dias">
              ${DIAS.map((d, i) => `<span class="fp-dia" data-fp-dia="${i}">${d}</span>`).join('')}
            </div></div>
          <div class="fp-campo" id="fp-w-dia-mes"><label>Dia do mês</label>
            <input id="fp-dia-mes" type="number" min="1" max="31"></div>
          <div class="fp-campo" id="fp-w-mes-dia"><label>Data anual (MM-DD)</label>
            <input id="fp-mes-dia" placeholder="07-16"></div>
          <div class="fp-campo" id="fp-w-inicio"><label>Início</label>
            <input id="fp-data-inicio" type="date"></div>
          <div class="fp-campo" id="fp-w-fim"><label>Fim</label>
            <input id="fp-data-fim" type="date"></div>
        </div>

        <div class="fp-secao">Limite da travessia</div>
        <div class="fp-grade">
          <div class="fp-campo full"><label>Duração máxima (min)
            <span class="dica">— vazio = sem limite</span></label>
            <input id="fp-duracao" type="number" min="0" placeholder="sem limite">
            <div style="margin-top:.35rem;font-size:.67rem;color:var(--text-muted);line-height:1.45">
              O relógio conta da <b>primeira travessia do dia</b>, não do tempo
              lá dentro. Sair para outra dungeon gasta o prazo igual — o tempo
              não para porque você saiu.
            </div></div>
        </div>

        <div class="fp-secao" id="fp-sec-horarios">Horários</div>
        <div class="fp-grade" id="fp-grade-horarios">
          <div class="fp-campo"><label>Entrada padrão</label><input id="fp-hora-entrada" type="time"></div>
          <div class="fp-campo"><label>Saída padrão</label><input id="fp-hora-saida" type="time"></div>
          <div class="fp-campo"><label>Tolerância (min)</label>
            <input id="fp-tolerancia" type="number" min="0" value="10"></div>

          <div class="fp-campo full"><label>Agenda semanal
            <span class="dica">— por dia: aberto/fechado e horário próprio (vazio usa o padrão)</span></label>
            <div class="fp-agenda" id="fp-agenda">
              ${DIAS.map((lbl, i) => `
              <div class="fp-agenda-linha" data-fp-ag="${i}">
                <span class="fp-dia on" data-fp-ag-tog="${i}" title="Clique para abrir/fechar este dia">${lbl}</span>
                <input type="time" data-fp-ag-ent="${i}" title="Entrada neste dia">
                <span class="seta">→</span>
                <input type="time" data-fp-ag-sai="${i}" title="Saída neste dia">
              </div>`).join('')}
            </div></div>
        </div>

        <div class="fp-secao">Folgas programadas</div>
        <div style="display:flex;gap:.5rem;align-items:center">
          <input type="date" id="fp-folga-data"
                 style="max-width:180px;background:rgba(255,255,255,.04);border:1px solid var(--border-subtle);border-radius:9px;padding:.45rem .6rem;color:var(--text-primary);font-size:.8rem">
          <button class="fp-btn" id="fp-folga-add" style="padding:.42rem .8rem">+ Folga</button>
        </div>
        <div class="fp-chips" id="fp-folgas"></div>
      </div>`;
    },

    /* ── CÂMARA 3: O QUADRO ───────────────────────────────────────── */
    _camaraQuadro() {
      return `
      <div class="fp-camara" data-fp-camara="2">
        <div class="fp-secao">Natureza da missão</div>
        <div class="fp-naturezas" id="fp-naturezas">
          ${NATUREZAS.map(n => `
            <div class="fp-nat${n.v === 'PADRAO' ? ' on' : ''}" data-fp-nat="${n.v}">
              <span class="ico">${glifo(n.glifo)}</span>
              <span class="nome">${n.nome}</span>
              <span class="diz">${esc(n.diz)}</span>
            </div>`).join('')}
        </div>

        <div class="fp-secao">A missão</div>
        <div class="fp-grade">
          <div class="fp-campo full"><label>Título</label>
            <input id="fpm-titulo" placeholder="Ex.: Entregar o relatório do dia"></div>
          <div class="fp-campo"><label>Ícone</label><input id="fpm-icone" maxlength="4" placeholder="⚔️"></div>
          <div class="fp-campo" id="fpm-w-xp"><label>XP / Moedas</label>
            <div style="display:flex;gap:.4rem">
              <input id="fpm-xp" type="number" min="0" value="30">
              <input id="fpm-moedas" type="number" min="0" value="3">
            </div></div>
          <div class="fp-campo" id="fpm-w-pen"><label>Punição se falhar <span class="dica">(vazio = 50% do XP)</span></label>
            <input id="fpm-pen" type="number" min="0" placeholder="auto"></div>

          <div class="fp-campo" id="fpm-w-p1"><label id="fpm-lbl-p1">Parâmetro</label>
            <input id="fpm-p1" type="number" min="1" value="60"></div>
          <div class="fp-campo" id="fpm-w-p2"><label id="fpm-lbl-p2">Janela máx (min)</label>
            <input id="fpm-p2" type="number" min="1" value="60"></div>
          <div class="fp-campo" id="fpm-w-expira"><label>Expira em (min)</label>
            <input id="fpm-expira" type="number" min="1" value="5"></div>
          <div class="fp-campo" id="fpm-w-hi"><label>Abre às</label><input id="fpm-hi" type="time"></div>
          <div class="fp-campo" id="fpm-w-hl"><label>Prazo até</label><input id="fpm-hl" type="time"></div>

          <div class="fp-campo" id="fpm-w-alvo"><label>Alvo</label>
            <input id="fpm-alvo" type="number" step="any" min="0" placeholder="10"></div>
          <div class="fp-campo" id="fpm-w-unid"><label>Unidade</label>
            <input id="fpm-unid" maxlength="12" placeholder="km, pág, L..."></div>
          <div class="fp-campo" id="fpm-w-especie"><label>Contagem</label>
            <select id="fpm-especie">
              <option value="SOMA">Soma o que for lançado</option>
              <option value="PICO">Guarda o maior valor</option>
              <option value="MEDIA">Média dos lançamentos</option>
            </select></div>
          <div class="fp-campo" id="fpm-w-modo"><label>Direção</label>
            <select id="fpm-modo">
              <option value="SUBIR">Subir até o alvo</option>
              <option value="DESCER">Descer até o alvo</option>
            </select></div>
          <div class="fp-campo" id="fpm-w-reps"><label>Quantas vezes</label>
            <input id="fpm-reps" type="number" min="1" value="3"></div>

          <div class="fp-campo full"><label>Dias da missão
            <span class="dica">— nenhum marcado = todos os dias do portão</span></label>
            <div class="fp-dias" id="fpm-dias">
              ${DIAS.map((d, i) => `<span class="fp-dia" data-fpm-dia="${i}">${d}</span>`).join('')}
            </div></div>
        </div>

        <div id="fpm-w-circuito" style="display:none">
          <div class="fp-secao">Os blocos do circuito</div>
          <div class="fp-blocos" id="fpm-blocos"></div>
          <button class="fp-btn" id="fpm-bloco-add" style="margin-top:.5rem;padding:.4rem .8rem">+ Bloco</button>
        </div>

        <div style="margin-top:.9rem">
          <button class="fp-btn principal" id="fpm-add" style="margin-left:0">+ Pregar no quadro</button>
        </div>

        <div class="fp-secao">O quadro <span id="fpm-cont" style="opacity:.5"></span></div>
        <div class="fp-missoes" id="fpm-lista"></div>

        <div class="fp-secao">Acervo <span class="dica" style="text-transform:none;letter-spacing:0;opacity:.55">— clique para copiar um molde</span></div>
        <div class="fp-acervo" id="fpm-acervo">
          <span style="font-size:.7rem;color:var(--text-muted)">Consultando o acervo...</span>
        </div>
      </div>`;
    },

    /* ── CÂMARA 4: O PREÇO ────────────────────────────────────────── */
    _camaraPreco() {
      return `
      <div class="fp-camara" data-fp-camara="3">
        <div class="fp-secao">Recompensa</div>
        <div class="fp-grade">
          <div class="fp-campo"><label>XP de entrada <span class="dica">(vazio = auto)</span></label>
            <input id="fp-xp-entrada" type="number" min="0" placeholder="auto"></div>
          <div class="fp-campo"><label>XP de clear</label>
            <input id="fp-xp-clear" type="number" min="0" placeholder="auto"></div>
          <div class="fp-campo"><label>Moedas de clear</label>
            <input id="fp-moedas-clear" type="number" min="0" placeholder="auto"></div>
        </div>

        <div class="fp-secao">Risco</div>
        <div class="fp-grade">
          <div class="fp-campo"><label>Punição por no-show (XP)</label>
            <input id="fp-pen-entrada" type="number" min="0" placeholder="auto"></div>
          <div class="fp-campo"><label>Punição por atraso (XP)</label>
            <input id="fp-pen-atraso" type="number" min="0" placeholder="auto"></div>
        </div>

        <div style="margin-top:.9rem;font-size:.7rem;color:var(--text-muted);line-height:1.5">
          Deixar em branco é o normal: o Sistema calcula a partir do rank e da
          dificuldade, e a conta está na leitura ao lado. Preencher aqui é
          <b>sobrescrever</b> a Balança para este portão — o número que você
          escrever é o número que vale, sem multiplicador nenhum.
        </div>
      </div>`;
    },

    /* ═══════════════════════════════════════════════════════════════
       LIGAÇÕES
       ═══════════════════════════════════════════════════════════════ */
    _ligar(el) {
      const g = id => document.getElementById(id);

      el.addEventListener('click', e => { if (e.target === el) this.fechar(); });
      g('fp-x').addEventListener('click', () => this.fechar());
      g('fp-voltar').addEventListener('click', () => this._irPara(this._passo - 1));
      g('fp-avancar').addEventListener('click', () => this._irPara(this._passo + 1));
      g('fp-forjar').addEventListener('click', () => this._salvar());

      el.querySelectorAll('[data-fp-passo]').forEach(p =>
        p.addEventListener('click', () => this._irPara(parseInt(p.dataset.fpPasso))));

      /* Cada tecla repinta a prévia. `input` cobre digitação, colagem e
         os selects; `change` sozinho só reagiria ao sair do campo, e a
         prévia perderia a razão de existir. */
      el.addEventListener('input', () => this._pintar());
      el.addEventListener('change', () => this._pintar());

      g('fp-rank').addEventListener('change', () => this._glitch());
      g('fp-dificuldade').addEventListener('change', () => this._glitch());

      g('fp-permanencia').addEventListener('change', () => this._toggleTempo());
      g('fp-recorrencia').addEventListener('change', () => this._toggleTempo());
      g('fp-chave-aberta').addEventListener('click', () => {
        g('fp-chave-aberta').classList.toggle('on');
        this._toggleTempo();
        this._pintar();
      });

      el.querySelectorAll('[data-fp-dia]').forEach(b =>
        b.addEventListener('click', () => { b.classList.toggle('on'); this._pintar(); }));
      el.querySelectorAll('[data-fpm-dia]').forEach(b =>
        b.addEventListener('click', () => b.classList.toggle('on')));

      el.querySelectorAll('[data-fp-ag-tog]').forEach(b =>
        b.addEventListener('click', () => {
          b.classList.toggle('on');
          const linha = b.closest('[data-fp-ag]');
          const on = b.classList.contains('on');
          linha.querySelectorAll('input').forEach(i => { i.disabled = !on; });
          linha.style.opacity = on ? '1' : '.4';
          this._pintar();
        }));

      g('fp-folga-add').addEventListener('click', () => {
        const inp = g('fp-folga-data');
        if (!inp.value) return;
        if (!this._folgas.includes(inp.value)) this._folgas.push(inp.value);
        inp.value = '';
        this._renderFolgas();
      });

      el.querySelectorAll('[data-fp-nat]').forEach(n =>
        n.addEventListener('click', () => this._escolherNatureza(n.dataset.fpNat)));

      g('fpm-add').addEventListener('click', () => this._pregarMissao());
      g('fpm-bloco-add').addEventListener('click', () => {
        this._blocos.push({ titulo: '', modo: 'TEMPO', series: 3, min: 20, max: 30, unidade: 'min' });
        this._renderBlocos();
      });

      // O seletor de ícones do projeto continua sendo o bom.
      if (window.Dungeons?._bindIconPicker) {
        window.Dungeons._bindIconPicker('fp-icone');
        window.Dungeons._bindIconPicker('fpm-icone');
      }
    },

    /* ═══════════════════════════════════════════════════════════════
       PREENCHER (edição)
       ═══════════════════════════════════════════════════════════════ */
    _preencher(d) {
      const v = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };

      v('fp-titulo-i',    d?.titulo);
      v('fp-descricao',   d?.descricao);
      v('fp-icone',       d?.icone || '🌀');
      v('fp-categoria',   d?.categoria || 'Trabalho');
      v('fp-rank',        d?.rank || 'E');
      v('fp-dificuldade', d?.dificuldade || 'NORMAL');
      v('fp-permanencia', d?.tipo_permanencia || 'PERMANENTE');
      v('fp-recorrencia', d?.tipo_recorrencia || 'DIARIA');
      v('fp-dia-mes',     d?.dia_mes);
      v('fp-mes-dia',     d?.mes_dia);
      v('fp-data-inicio', d?.data_inicio);
      v('fp-data-fim',    d?.data_fim);
      v('fp-hora-entrada', d?.hora_entrada);
      v('fp-hora-saida',   d?.hora_saida);
      v('fp-tolerancia',   d?.tolerancia_min ?? 10);
      v('fp-duracao',      d?.duracao_max_min ?? '');
      v('fp-xp-entrada',   d?.xp_entrada ?? '');
      v('fp-xp-clear',     d?.xp_clear ?? '');
      v('fp-moedas-clear', d?.moedas_clear ?? '');
      v('fp-pen-entrada',  d?.penalidade_entrada_xp ?? '');
      v('fp-pen-atraso',   d?.penalidade_atraso_xp ?? '');

      document.getElementById('fp-chave-aberta')
        .classList.toggle('on', !!d?.sempre_aberta);

      const dias = d?.dias_semana?.length ? d.dias_semana : [0, 1, 2, 3, 4];
      document.querySelectorAll('[data-fp-dia]').forEach(b =>
        b.classList.toggle('on', dias.includes(parseInt(b.dataset.fpDia))));

      this._preencherAgenda(d?.agenda_semanal || null);
      this._renderFolgas();
      this._toggleTempo();
      this._escolherNatureza('PADRAO');
      this._renderMissoes();

      const t = document.getElementById('fp-titulo');
      const txt = d ? '⚒ REFORJAR PORTÃO' : '⚒ FORJA DE PORTÕES';
      t.textContent = txt; t.dataset.txt = txt;
      document.getElementById('fp-forjar').textContent =
        d ? '⚒ Reforjar Portão' : '⚒ Forjar Portão';
    },

    _preencherAgenda(agenda) {
      for (let i = 0; i < 7; i++) {
        const cfg = agenda?.[String(i)];
        const tog = document.querySelector(`[data-fp-ag-tog="${i}"]`);
        const ent = document.querySelector(`[data-fp-ag-ent="${i}"]`);
        const sai = document.querySelector(`[data-fp-ag-sai="${i}"]`);
        if (!tog) continue;
        const aberto = !cfg || cfg.aberto !== false;
        tog.classList.toggle('on', aberto);
        ent.value = cfg?.entrada || '';
        sai.value = cfg?.saida || '';
        ent.disabled = !aberto; sai.disabled = !aberto;
        tog.closest('[data-fp-ag]').style.opacity = aberto ? '1' : '.4';
      }
    },

    /* ═══════════════════════════════════════════════════════════════
       NAVEGAÇÃO
       ═══════════════════════════════════════════════════════════════ */
    _irPara(i) {
      const n = this.PASSOS.length;
      this._passo = Math.max(0, Math.min(n - 1, i));
      document.querySelectorAll('[data-fp-camara]').forEach(c =>
        c.classList.toggle('on', parseInt(c.dataset.fpCamara) === this._passo));
      document.querySelectorAll('[data-fp-passo]').forEach(p =>
        p.classList.toggle('on', parseInt(p.dataset.fpPasso) === this._passo));
      document.getElementById('fp-voltar').disabled  = this._passo === 0;
      document.getElementById('fp-avancar').disabled = this._passo === n - 1;
      document.getElementById('fp-campos').scrollTop = 0;
    },

    /* O TEMPO SE APAGA QUANDO NÃO EXISTE.
       Num portão que não fecha não há hora de entrada, tolerância nem
       agenda — deixar os campos acesos ensinaria uma regra que o backend
       não aplica (`_verificar_no_show` e `entrar_dungeon` saem cedo). */
    _toggleTempo() {
      const g = id => document.getElementById(id);
      const perm   = g('fp-permanencia').value;
      const recor  = g('fp-recorrencia').value;
      const aberta = g('fp-chave-aberta').classList.contains('on');
      const isPerm = perm === 'PERMANENTE';
      const show = (id, on) => { const e = g(id); if (e) e.style.display = on ? '' : 'none'; };

      show('fp-w-recorrencia', isPerm);
      show('fp-w-dias',    isPerm && recor === 'SEMANAL');
      show('fp-w-dia-mes', isPerm && recor === 'MENSAL');
      show('fp-w-mes-dia', isPerm && recor === 'ANUAL');
      show('fp-w-inicio',  !isPerm);
      show('fp-w-fim',     !isPerm);

      g('fp-sec-horarios').style.display    = aberta ? 'none' : '';
      g('fp-grade-horarios').style.display  = aberta ? 'none' : '';
    },

    _glitch() {
      const t = document.getElementById('fp-titulo');
      t.classList.remove('glitch');
      void t.offsetWidth;                 // reinicia a animação
      t.classList.add('glitch');
      setTimeout(() => t.classList.remove('glitch'), 460);
    },

    /* ═══════════════════════════════════════════════════════════════
       A PRÉVIA
       ═══════════════════════════════════════════════════════════════ */
    _pintar() {
      const g = id => document.getElementById(id);
      if (!g('fp-caixa')) return;

      const rank   = g('fp-rank').value || 'E';
      const dific  = g('fp-dificuldade').value || 'NORMAL';
      const cor    = COR_RANK[rank] || '#7c3aed';
      const mult   = (MULT_RANK[rank] || 1) * (MULT_DIFIC[dific] || 1);
      const aberta = g('fp-chave-aberta').classList.contains('on');

      g('fp-caixa').style.setProperty('--fp-cor', cor);
      g('fp-selo-rank').textContent = 'RANK ' + rank;

      g('fp-pv-ico').textContent  = g('fp-icone').value || '🌀';
      g('fp-pv-nome').textContent = g('fp-titulo-i').value.trim() || 'Portão sem nome';
      g('fp-pv-lore').textContent = g('fp-descricao').value.trim();

      // Os selos: o retrato do que o portão é, em cinco palavras.
      const selos = [];
      selos.push(`<span class="selo destaque">${esc(dific[0] + dific.slice(1).toLowerCase())}</span>`);
      selos.push(`<span class="selo">${esc(g('fp-categoria').value)}</span>`);
      const dur = parseInt(g('fp-duracao').value);
      if (dur > 0) {
        const h = Math.floor(dur / 60), mm = dur % 60;
        const txt = h ? (mm ? `${h}h${String(mm).padStart(2, '0')}` : `${h}h`) : `${dur}min`;
        selos.push(`<span class="selo destaque">⏳ limite ${txt}</span>`);
      }
      if (aberta) {
        selos.push('<span class="selo destaque">∞ nunca fecha</span>');
      } else {
        const he = g('fp-hora-entrada').value, hs = g('fp-hora-saida').value;
        if (he || hs) selos.push(`<span class="selo">${esc(he || '--:--')} → ${esc(hs || '--:--')}</span>`);
        const tol = parseInt(g('fp-tolerancia').value);
        if (tol > 0) selos.push(`<span class="selo">tolera ${tol}min</span>`);
      }
      const perm = g('fp-permanencia').value;
      if (perm === 'TEMPORARIA') selos.push('<span class="selo">temporária</span>');
      else {
        const rec = g('fp-recorrencia').value;
        if (rec === 'SEMANAL') {
          const ds = [...document.querySelectorAll('[data-fp-dia].on')]
            .map(b => DIAS[parseInt(b.dataset.fpDia)]);
          selos.push(`<span class="selo">${ds.length ? esc(ds.join(' ')) : 'sem dias!'}</span>`);
        } else if (rec !== 'DIARIA') {
          selos.push(`<span class="selo">${esc(rec.toLowerCase())}</span>`);
        }
      }
      if (this._folgas.length) selos.push(`<span class="selo">🏖 ${this._folgas.length}</span>`);
      g('fp-pv-selos').innerHTML = selos.join('');

      // A LEITURA — as mesmas contas do servidor, à vista.
      const num = id => { const x = g(id).value; return x === '' ? null : parseInt(x); };
      const auto = (campo, base) => {
        const dado = num(campo);
        return dado !== null && !isNaN(dado) ? dado : Math.trunc(base * mult);
      };
      const xpEnt = auto('fp-xp-entrada',   25);
      const xpCle = auto('fp-xp-clear',    100);
      const moeda = auto('fp-moedas-clear', 10);
      const penEn = auto('fp-pen-entrada',  50);
      const penAt = auto('fp-pen-atraso',   15);

      this._num('fp-lm',  '×' + mult.toFixed(2));
      this._num('fp-le',  '+' + xpEnt);
      this._num('fp-lc',  '+' + Math.trunc(xpCle * MULT_CLEAR.S));
      this._num('fp-lc2', '+' + Math.trunc(xpCle * MULT_CLEAR.C));
      this._num('fp-lmo', String(moeda));
      this._num('fp-lp',  aberta ? '—' : '−' + penEn);
      this._num('fp-lpa', aberta ? '—' : '−' + penAt);
      this._num('fp-lq',  String(this._missoes.length));

      // O PRAZO, DITO EM VOZ ALTA. Ele nasce de duas fontes e vale a mais
      // apertada — a mesma regra de `_prazo_da_sessao` no servidor.
      const fontes = [];
      if (dur > 0) fontes.push(`${dur} min desde a entrada`);
      if (!aberta && g('fp-hora-saida').value) fontes.push(`até ${g('fp-hora-saida').value}`);
      this._num('fp-lt', fontes.length ? fontes.join(' · ') : 'só o fim do dia');

      // OS AVISOS — o que a forja antiga deixava você descobrir depois.
      const avisos = [];
      if (!g('fp-titulo-i').value.trim())
        avisos.push('O portão ainda não tem nome.');
      if (!aberta && !g('fp-hora-entrada').value)
        avisos.push('Sem hora de entrada, o portão abre a qualquer momento — se é isso que você quer, ligue o interruptor lá em cima e diga isso ao Sistema.');
      if (!aberta && !g('fp-hora-saida').value)
        avisos.push('Sem hora de saída não há no-show nem check-out automático: a sessão fica aberta até você sair.');
      if (perm === 'PERMANENTE' && g('fp-recorrencia').value === 'SEMANAL'
          && !document.querySelector('[data-fp-dia].on'))
        avisos.push('Semanal sem nenhum dia marcado: este portão nunca vai abrir.');
      if (!this._missoes.length)
        avisos.push('O quadro está vazio — sem missões, todo clear sai rank S de graça.');
      if (dur > 0 && aberta)
        avisos.push(`O relógio não para quando você sai: os ${dur} min correm desde a entrada, esteja você dentro ou em outra dungeon.`);
      if (perm === 'TEMPORARIA' && !g('fp-data-fim').value)
        avisos.push('Temporária sem data de fim nunca se arquiva sozinha.');

      const av = g('fp-aviso');
      av.classList.toggle('vazio', !avisos.length);
      av.innerHTML = avisos.map(a => '⚠ ' + esc(a)).join('<br>');
    },

    /* Escreve o número e o faz piscar só se ele mudou. */
    _num(id, txt) {
      const el = document.getElementById(id);
      if (!el || el.textContent === txt) return;
      el.textContent = txt;
      el.classList.remove('pulsa');
      void el.offsetWidth;
      el.classList.add('pulsa');
    },

    /* ═══════════════════════════════════════════════════════════════
       FOLGAS
       ═══════════════════════════════════════════════════════════════ */
    _renderFolgas() {
      const c = document.getElementById('fp-folgas');
      if (!c) return;
      this._folgas.sort();
      c.innerHTML = this._folgas.length
        ? this._folgas.map((f, i) => {
            const [a, m, d] = f.split('-');
            return `<span class="fp-chip">🏖 ${d}/${m}/${a}
              <span class="rm" data-fp-folga="${i}">✕</span></span>`;
          }).join('')
        : '<span style="font-size:.7rem;color:var(--text-muted)">Nenhuma folga programada.</span>';
      c.querySelectorAll('[data-fp-folga]').forEach(x =>
        x.addEventListener('click', () => {
          this._folgas.splice(parseInt(x.dataset.fpFolga), 1);
          this._renderFolgas(); this._pintar();
        }));
      this._pintar();
    },

    /* ═══════════════════════════════════════════════════════════════
       O QUADRO DE MISSÕES
       ═══════════════════════════════════════════════════════════════ */
    _escolherNatureza(nat) {
      this._natSel = nat;
      document.querySelectorAll('[data-fp-nat]').forEach(n =>
        n.classList.toggle('on', n.dataset.fpNat === nat));
      this._lustrar(document.querySelector(`[data-fp-nat="${nat}"]`));

      const g = id => document.getElementById(id);
      const show = (id, on) => { const e = g(id); if (e) e.style.display = on ? '' : 'none'; };

      show('fpm-w-p1', false); show('fpm-w-p2', false);
      show('fpm-w-hi', false); show('fpm-w-hl', false);
      show('fpm-w-alvo', false); show('fpm-w-unid', false);
      show('fpm-w-especie', false); show('fpm-w-modo', false);
      show('fpm-w-reps', false);
      show('fpm-w-expira', nat === 'EVENTO_ALEATORIO' || nat === 'BEM_ESTAR');
      show('fpm-w-xp',  nat !== 'FLAVOR');
      show('fpm-w-pen', nat !== 'FLAVOR' && nat !== 'EVENTO_ALEATORIO' && nat !== 'BEM_ESTAR');
      g('fpm-w-circuito').style.display = nat === 'CIRCUITO' ? '' : 'none';

      if (nat === 'RESISTENCIA') { show('fpm-w-p1', true); g('fpm-lbl-p1').textContent = 'Meta (minutos)'; }
      if (nat === 'BEM_ESTAR')   { show('fpm-w-p1', true); g('fpm-lbl-p1').textContent = 'A cada (min)'; }
      if (nat === 'EVENTO_ALEATORIO') {
        show('fpm-w-p1', true); show('fpm-w-p2', true);
        g('fpm-lbl-p1').textContent = 'Janela mín (min)';
      }
      if (nat === 'AGENDADA') { show('fpm-w-hi', true); show('fpm-w-hl', true); }
      if (nat === 'META') {
        show('fpm-w-alvo', true); show('fpm-w-unid', true);
        show('fpm-w-especie', true); show('fpm-w-modo', true);
      }
      if (nat === 'REPETICAO') show('fpm-w-reps', true);
      if (nat === 'CIRCUITO' && !this._blocos.length) {
        this._blocos = [{ titulo: '', modo: 'TEMPO', series: 3, min: 20, max: 30, unidade: 'min' }];
        this._renderBlocos();
      }
    },

    /* A LUZ QUE ATRAVESSA A PLACA — e que precisa TERMINAR.
     *
     * A classe é transitória de propósito. Presa em `.on`, a animação
     * congelava no meio do cartão (o transform voltava a `none`, que é
     * o centro) e nunca mais tocava, porque reescolher a mesma natureza
     * não troca classe nenhuma.
     *
     * `animationend` é quem limpa — o navegador sabe a duração real,
     * então ela pode mudar no CSS sem que este arquivo fique sabendo. O
     * `setTimeout` é só a rede: em jsdom, e num navegador que respeita
     * `prefers-reduced-motion` (onde não há animação e portanto não há
     * evento), o `animationend` não vem. */
    _lustrar(placa) {
      if (!placa) return;
      placa.classList.remove('lustrando');
      void placa.offsetWidth;                 // reinicia a animação
      placa.classList.add('lustrando');

      clearTimeout(placa._lustro);
      const apagar = () => {
        clearTimeout(placa._lustro);
        placa.classList.remove('lustrando');
      };
      placa.addEventListener('animationend', apagar, { once: true });
      placa._lustro = setTimeout(apagar, 1600);
    },

    _renderBlocos() {
      const c = document.getElementById('fpm-blocos');
      if (!c) return;
      c.innerHTML = this._blocos.map((b, i) => {
        const serie = b.modo === 'SERIE_TEMPO' || b.modo === 'SERIE_REP';
        const check = b.modo === 'CHECK';
        return `
        <div class="fp-bloco" data-fp-bloco="${i}">
          <input data-b="titulo" value="${esc(b.titulo)}" placeholder="Nome do bloco">
          <select data-b="modo">
            ${MODOS_BLOCO.map(m => `<option value="${m.v}"${m.v === b.modo ? ' selected' : ''}>${m.t}</option>`).join('')}
          </select>
          <input data-b="series" type="number" min="1" value="${b.series || 1}"
                 title="Séries" ${serie ? '' : 'disabled'} style="${serie ? '' : 'opacity:.3'}">
          <input data-b="min" type="number" step="any" min="0" value="${b.min ?? ''}"
                 title="Mínimo" ${check ? 'disabled' : ''} style="${check ? 'opacity:.3' : ''}">
          <input data-b="max" type="number" step="any" min="0" value="${b.max ?? ''}"
                 title="Máximo" ${check ? 'disabled' : ''} style="${check ? 'opacity:.3' : ''}">
          <input data-b="unidade" value="${esc(b.unidade || '')}" placeholder="un"
                 ${check || b.modo === 'SERIE_REP' ? 'disabled' : ''}
                 style="${check || b.modo === 'SERIE_REP' ? 'opacity:.3' : ''}">
          <button class="rm" data-fp-bloco-rm="${i}" title="Remover bloco">✕</button>
          <div class="fp-faixa-prev">${esc(this._rotuloFaixa(b))}</div>
        </div>`;
      }).join('');

      c.querySelectorAll('[data-fp-bloco]').forEach(row => {
        const i = parseInt(row.dataset.fpBloco);
        row.querySelectorAll('[data-b]').forEach(inp =>
          inp.addEventListener('input', () => {
            const k = inp.dataset.b;
            this._blocos[i][k] = (k === 'titulo' || k === 'unidade' || k === 'modo')
              ? inp.value : (inp.value === '' ? null : parseFloat(inp.value));
            if (k === 'modo') this._renderBlocos();
            else row.querySelector('.fp-faixa-prev').textContent = this._rotuloFaixa(this._blocos[i]);
          }));
      });
      c.querySelectorAll('[data-fp-bloco-rm]').forEach(b =>
        b.addEventListener('click', () => {
          this._blocos.splice(parseInt(b.dataset.fpBlocoRm), 1);
          this._renderBlocos();
        }));
    },

    /* O mesmo texto que `motors/circuito.rotulo_faixa` produz — mostrado
       ANTES de gravar, para que ninguém descubra depois que "3 × 20–30 s"
       não era o que tinha em mente. */
    _rotuloFaixa(b) {
      if (b.modo === 'CHECK') return 'feito / não feito';
      const u   = b.unidade ? ' ' + b.unidade : '';
      const min = b.min, max = b.max;
      let faixa;
      if (min == null && max == null) return '—';
      else if (min == null) faixa = 'até ' + max;
      else if (max == null || max === min) faixa = String(min);
      else faixa = `${Math.min(min, max)}–${Math.max(min, max)}`;
      const s = (b.modo === 'SERIE_TEMPO' || b.modo === 'SERIE_REP')
        ? `${b.series || 1} × ` : '';
      return s + faixa + u;
    },

    _pregarMissao() {
      const g   = id => document.getElementById(id);
      const nat = this._natSel;
      const titulo = g('fpm-titulo').value.trim();
      if (!titulo) { this._toast('Dê um nome à missão.', 'error'); return; }

      const dias = [...document.querySelectorAll('[data-fpm-dia].on')]
        .map(b => parseInt(b.dataset.fpmDia));
      const inteiro = id => { const x = g(id).value; return x === '' ? null : (parseInt(x) || 0); };
      const real    = id => { const x = g(id).value; return x === '' ? null : parseFloat(x); };

      const m = {
        titulo,
        icone: g('fpm-icone').value || (NATUREZAS.find(n => n.v === nat)?.ico) || '⚔️',
        natureza: nat,
        tipo: (nat === 'RESISTENCIA' || nat === 'EVENTO_ALEATORIO'
               || nat === 'BEM_ESTAR' || nat === 'FLAVOR') ? 'PASSIVA' : 'ATIVA',
        xp_recompensa:     nat === 'FLAVOR' ? 0 : (parseInt(g('fpm-xp').value) || 30),
        moedas_recompensa: nat === 'FLAVOR' ? 0 : (parseInt(g('fpm-moedas').value) || 3),
        penalidade_xp:     inteiro('fpm-pen'),
        meta_minutos:       nat === 'RESISTENCIA'      ? (parseInt(g('fpm-p1').value) || 60) : null,
        intervalo_min:      nat === 'BEM_ESTAR'        ? (parseInt(g('fpm-p1').value) || 45) : null,
        janela_disparo_min: nat === 'EVENTO_ALEATORIO' ? (parseInt(g('fpm-p1').value) || 20) : null,
        janela_disparo_max: nat === 'EVENTO_ALEATORIO' ? (parseInt(g('fpm-p2').value) || 60) : null,
        expira_em_min:      parseInt(g('fpm-expira').value) || 5,
        dias_semana:        dias.length ? dias : null,
        hora_inicio:        nat === 'AGENDADA' ? (g('fpm-hi').value || null) : null,
        hora_limite:        nat === 'AGENDADA' ? (g('fpm-hl').value || null) : null,
        meta_alvo:      nat === 'META' ? real('fpm-alvo') : null,
        meta_unidade:   nat === 'META' ? (g('fpm-unid').value.trim() || null) : null,
        meta_especie:   nat === 'META' ? g('fpm-especie').value : null,
        meta_modo:      nat === 'META' ? g('fpm-modo').value : null,
        alvo_repeticoes: nat === 'REPETICAO' ? (parseInt(g('fpm-reps').value) || 3) : null,
      };

      if (nat === 'CIRCUITO') {
        const etapas = this._blocos
          .filter(b => (b.titulo || '').trim())
          .map((b, i) => ({
            id: 'b' + (i + 1), titulo: b.titulo.trim(), modo: b.modo,
            series: (b.modo === 'SERIE_TEMPO' || b.modo === 'SERIE_REP') ? (b.series || 1) : null,
            min: b.min, max: b.max,
            unidade: (b.modo === 'CHECK' || b.modo === 'SERIE_REP') ? null : (b.unidade || null),
          }));
        if (!etapas.length) {
          this._toast('Um circuito sem blocos é uma missão comum — dê nome a pelo menos um bloco.', 'error');
          return;
        }
        m.circuito_payload = { etapas };
      }

      this._missoes.push(m);
      g('fpm-titulo').value = '';
      document.querySelectorAll('[data-fpm-dia].on').forEach(b => b.classList.remove('on'));
      this._blocos = [];
      if (nat === 'CIRCUITO') this._escolherNatureza('CIRCUITO');
      this._renderMissoes();
      this._pintar();
    },

    _renderMissoes() {
      const c = document.getElementById('fpm-lista');
      if (!c) return;
      document.getElementById('fpm-cont').textContent =
        this._missoes.length ? `(${this._missoes.length})` : '';

      if (!this._missoes.length) {
        c.innerHTML = '<div class="fp-vazio">O quadro está vazio. Sem missões, o portão é só uma sala.</div>';
        return;
      }
      c.innerHTML = this._missoes.map((m, i) => {
        const nat = NATUREZAS.find(n => n.v === m.natureza);
        const det = [];
        if (m.natureza === 'AGENDADA' && (m.hora_inicio || m.hora_limite))
          det.push(`${m.hora_inicio || '--:--'} → ${m.hora_limite || '--:--'}`);
        if (m.natureza === 'CIRCUITO')
          det.push(`${(m.circuito_payload?.etapas || m.circuito?.etapas || []).length} blocos`);
        if (m.natureza === 'META' && m.meta_alvo != null)
          det.push(`alvo ${m.meta_alvo}${m.meta_unidade ? ' ' + m.meta_unidade : ''}`);
        if (m.natureza === 'REPETICAO' && m.alvo_repeticoes)
          det.push(`${m.alvo_repeticoes}×`);
        if (m.natureza === 'RESISTENCIA' && m.meta_minutos)
          det.push(`${m.meta_minutos} min dentro`);
        if (m.dias_semana?.length && m.dias_semana.length < 7)
          det.push(m.dias_semana.map(x => DIAS[x]).join(' '));
        return `
        <div class="fp-missao">
          <span class="ico">${esc(m.icone || nat?.ico || '⚔️')}</span>
          <span class="tit">${esc(m.titulo)}${det.length ? `<small>${esc(det.join(' · '))}</small>` : ''}</span>
          <span class="nat">${glifo(nat?.glifo || 'padrao', 12)}${esc(nat?.nome || m.natureza)}</span>
          <span class="xp">${m.natureza === 'FLAVOR' ? '—' : '+' + m.xp_recompensa}</span>
          <button class="rm" data-fp-miss-rm="${i}" title="Tirar do quadro">✕</button>
        </div>`;
      }).join('');
      c.querySelectorAll('[data-fp-miss-rm]').forEach(b =>
        b.addEventListener('click', () => this._tirarMissao(parseInt(b.dataset.fpMissRm))));
    },

    async _tirarMissao(i) {
      const m = this._missoes[i];
      if (this._d && m.id) {
        try { await API.dungeons.deletarMissao(m.id); }
        catch (err) { this._toast('Erro: ' + (err.message || err), 'error'); return; }
      }
      this._missoes.splice(i, 1);
      this._renderMissoes();
      this._pintar();
    },

    /* ═══════════════════════════════════════════════════════════════
       O ACERVO
       ═══════════════════════════════════════════════════════════════ */
    async _carregarAcervo() {
      const c = document.getElementById('fpm-acervo');
      if (!c) return;
      try {
        const r = await API.dungeons.acervo();
        this._acervo = r.acervo || [];
      } catch (_) {
        this._acervo = [];
      }
      if (!this._acervo.length) {
        c.innerHTML = '<span style="font-size:.7rem;color:var(--text-muted)">'
          + 'O acervo está vazio — as missões que você forjar aqui aparecerão nos próximos portões.</span>';
        return;
      }
      c.innerHTML = this._acervo.map((a, i) => `
        <span class="fp-acervo-item" data-fp-acervo="${i}" title="Copiar este molde para o quadro">
          ${esc(a.icone || '⚔️')} ${esc(a.titulo)}
          <span class="fonte">· ${esc(a.fonte || '')}</span>
        </span>`).join('');
      c.querySelectorAll('[data-fp-acervo]').forEach(x =>
        x.addEventListener('click', () => this._copiarDoAcervo(parseInt(x.dataset.fpAcervo))));
    },

    /* CÓPIA, NUNCA VÍNCULO. O molde vem sem `id`: a missão nova é dela
       mesma, e reformulá-la não mexe no portão de origem. */
    _copiarDoAcervo(i) {
      const a = this._acervo[i];
      if (!a) return;
      const m = Object.assign({}, a);
      delete m.id; delete m.fonte; delete m.ativo;
      if (m.circuito?.etapas) m.circuito_payload = { etapas: m.circuito.etapas };
      delete m.circuito;
      this._missoes.push(m);
      this._renderMissoes();
      this._pintar();
      this._toast(`"${a.titulo}" copiada para o quadro.`, 'success');
    },

    /* ═══════════════════════════════════════════════════════════════
       SALVAR
       ═══════════════════════════════════════════════════════════════ */
    _coletarAgenda() {
      const agenda = {};
      for (let i = 0; i < 7; i++) {
        const tog = document.querySelector(`[data-fp-ag-tog="${i}"]`);
        if (!tog) continue;
        const aberto = tog.classList.contains('on');
        const ent = document.querySelector(`[data-fp-ag-ent="${i}"]`).value;
        const sai = document.querySelector(`[data-fp-ag-sai="${i}"]`).value;
        if (!aberto) agenda[String(i)] = { aberto: false };
        else if (ent || sai) agenda[String(i)] = { aberto: true, entrada: ent || null, saida: sai || null };
      }
      return Object.keys(agenda).length ? agenda : null;
    },

    async _salvar() {
      const g = id => document.getElementById(id);
      const titulo = g('fp-titulo-i').value.trim();
      if (!titulo) {
        this._irPara(0);
        g('fp-titulo-i').focus();
        this._toast('O portão precisa de um nome.', 'error');
        return;
      }

      const perm   = g('fp-permanencia').value;
      const aberta = g('fp-chave-aberta').classList.contains('on');
      const dias   = [...document.querySelectorAll('[data-fp-dia].on')]
        .map(b => parseInt(b.dataset.fpDia));
      const num = id => { const x = g(id).value; return x === '' ? null : parseInt(x); };

      const payload = {
        titulo,
        descricao:        g('fp-descricao').value.trim() || null,
        icone:            g('fp-icone').value || '🌀',
        categoria:        g('fp-categoria').value,
        rank:             g('fp-rank').value,
        dificuldade:      g('fp-dificuldade').value,
        tipo_permanencia: perm,
        tipo_recorrencia: g('fp-recorrencia').value,
        dias_semana:      dias,
        dia_mes:          num('fp-dia-mes'),
        mes_dia:          g('fp-mes-dia').value || null,
        data_inicio:      perm === 'TEMPORARIA' ? (g('fp-data-inicio').value || null) : null,
        data_fim:         perm === 'TEMPORARIA' ? (g('fp-data-fim').value || null) : null,
        sempre_aberta:    aberta,
        /* O PORTÃO ABERTO NÃO GUARDA HORÁRIO ANTIGO.
           Se ele ficasse gravado, desligar o interruptor amanhã traria de
           volta uma hora que o Arquiteto esqueceu ter escrito — e com ela
           um no-show que ele não pediu. */
        hora_entrada:     aberta ? null : (g('fp-hora-entrada').value || null),
        hora_saida:       aberta ? null : (g('fp-hora-saida').value || null),
        tolerancia_min:   aberta ? 0 : (parseInt(g('fp-tolerancia').value) || 0),
        /* O LIMITE SOBREVIVE AO INTERRUPTOR.
           Ao contrário dos horários, `duracao_max_min` não é apagado pelo
           portão aberto — é justamente ali que ele importa. Um portão sem
           hora marcada não tem `hora_saida` para servir de prazo, e sem
           este campo "dungeon com limite de tempo" seria impossível de
           dizer exatamente onde sair e voltar é permitido. */
        duracao_max_min:  parseInt(g('fp-duracao').value) || null,
        agenda_semanal:   aberta ? null : this._coletarAgenda(),
        folgas:           this._folgas.slice(),
        xp_entrada:            num('fp-xp-entrada'),
        xp_clear:              num('fp-xp-clear'),
        moedas_clear:          num('fp-moedas-clear'),
        penalidade_entrada_xp: num('fp-pen-entrada'),
        penalidade_atraso_xp:  num('fp-pen-atraso'),
      };

      const btn = g('fp-forjar');
      btn.disabled = true;
      try {
        if (this._d) {
          await API.dungeons.atualizar(this._d.id, payload);
          // As missões novas (sem id) ainda não existem no servidor.
          for (const m of this._missoes.filter(x => !x.id)) {
            await API.dungeons.criarMissao(this._d.id, m);
          }
          this._toast('⚒️ Portão reforjado.', 'success');
          this.fechar();
          if (this._aoSalvar) await this._aoSalvar(null, payload);
        } else {
          payload.missoes = this._missoes;
          const r = await API.dungeons.criar(payload);
          this.fechar();
          if (this._aoSalvar) await this._aoSalvar(r, payload);
        }
      } catch (err) {
        this._toast('Erro ao forjar: ' + (err.message || err), 'error');
      } finally {
        btn.disabled = false;
      }
    },

    _toast(msg, tipo) {
      if (window.SoloDialog?.toast) window.SoloDialog.toast(msg, tipo);
      else console.log('[forja]', msg);
    },
  };

  window.ForjaPortao = ForjaPortao;
})();
