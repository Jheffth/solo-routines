/* ============================================================
   gemas.js — A Lapidação: pedras preciosas e medalhas de rank

   POR QUE ESTE ARQUIVO EXISTE

   O banner mostrava três hexágonos coloridos e chamava de gema. Hexágono
   com gradiente não é pedra — é polígono pintado. O que faz o olho ler
   "pedra preciosa" são quatro coisas, e nenhuma delas é a cor:

     1. A MESA — a faceta plana do topo, a mais clara de todas
     2. As FACETAS DA COROA — triângulos ao redor da mesa, cada um pegando
        a luz num ângulo diferente, alternando claro e escuro
     3. O PAVILHÃO — o fundo, mais escuro, que dá profundidade
     4. A CINTILAÇÃO — um ponto de luz especular fora do centro

   Sem alternar claro/escuro entre facetas vizinhas, some o efeito de
   lapidação. É esse contraste que o cérebro lê como "superfície facetada".

   O MESMO PROCESSO DAS BADGES

   Segue `ConquistaFX._svgMedalha`: SVG forjado em código, `<defs>` com
   gradientes próprios, dimensões explícitas em width/height, e IDs
   tornados únicos antes de ir para o DOM.

   `_idsUnicos` NÃO é preciosismo: duas gemas na mesma página com
   `id="mesa"` fazem a segunda usar o gradiente da primeira, porque o
   documento resolve `url(#mesa)` pelo primeiro que encontrar. O resultado
   é o rubi saindo roxo, e leva um tempo até alguém entender o porquê.

   A LARGURA EXPLÍCITA TAMBÉM NÃO É: existe uma regra global
   `img, svg { max-width: 100% }` em design-system.css que colapsa
   qualquer SVG sem tamanho próprio. Já custou caro neste projeto.

   Uso:
     Gemas.pedra('ametista', 54)      → a gema, sozinha
     Gemas.rank('S', 44)              → a medalha de rank
     Gemas.existe('rubi')             → bool
   ============================================================ */

const Gemas = {

  _seq: 0,

  /* ── Catálogo de pedras ──────────────────────────────────
     Cada pedra é definida por cinco tons, do brilho ao fundo. Não é uma
     cor com opacidades: uma safira escurece para o azul-tinta, um âmbar
     escurece para o marrom-queimado. A curva de escurecimento é o que
     diferencia uma pedra de um plástico colorido. */
  PEDRAS: {
    ametista: {
      nome: 'Ametista',
      brilho: '#f5eaff', mesa: '#c9a4f5', corpo: '#8b5cf6',
      fundo: '#4c1d95', sombra: '#2e1065', fogo: '#e9d5ff',
    },
    ambar: {
      nome: 'Âmbar',
      brilho: '#fff8e1', mesa: '#ffe08a', corpo: '#f59e0b',
      fundo: '#b45309', sombra: '#6b3208', fogo: '#fde68a',
    },
    rubi: {
      nome: 'Rubi',
      brilho: '#ffeef0', mesa: '#ffa8b4', corpo: '#f43f5e',
      fundo: '#9f1239', sombra: '#4c0519', fogo: '#fecdd3',
    },
    safira: {
      nome: 'Safira',
      brilho: '#e8f4ff', mesa: '#8ec8f5', corpo: '#3b82f6',
      fundo: '#1e40af', sombra: '#0f2167', fogo: '#bfdbfe',
    },
    esmeralda: {
      nome: 'Esmeralda',
      brilho: '#e6fff4', mesa: '#7ee8bd', corpo: '#10b981',
      fundo: '#065f46', sombra: '#022c22', fogo: '#a7f3d0',
    },
    obsidiana: {
      nome: 'Obsidiana',
      brilho: '#e2e8f0', mesa: '#94a3b8', corpo: '#475569',
      fundo: '#1e293b', sombra: '#020617', fogo: '#cbd5e1',
    },
  },

  /* ── O BRASÃO: o modelo que o Arquiteto enviou ──────────
     A referência é heráldica clássica: ESCUDO ao centro, ESPADAS CRUZADAS
     por trás, COROA no topo, ASAS abrindo dos lados e filigrana ao fundo.

     Era isso que faltava — eu vinha desenhando só o escudo, e escudo
     sozinho é uma forma, não um brasão. As espadas cruzadas são a peça
     que mais muda a silhueta: elas rompem o contorno em quatro diagonais
     e é isso que faz a coisa parecer emblema de ordem militar.

     A progressão vai de PRATA ESCURA a OURO, ganhando um elemento por
     degrau — a silhueta conta o rank antes de qualquer cor:

       E  escudo nu ................ prata escura
       D  + rebites ................ prata
       C  + ESPADAS cruzadas ....... prata clara
       B  + coroa ................. prata e ouro
       A  + asas curtas ........... ouro
       S  + asas plenas · filigrana  ouro polido
       N  + auréola ............... ouro branco                          */
  RANKS: {
    E: { metal: ['#aeb8c4', '#69737f', '#333b45'], rebites: 0,
         espadas: false, coroa: false, asas: 0, filigrana: false, halo: false },
    D: { metal: ['#ccd6e0', '#8b96a2', '#454f5a'], rebites: 6,
         espadas: false, coroa: false, asas: 0, filigrana: false, halo: false },
    C: { metal: ['#f2f7fb', '#b9c5d1', '#606b77'], rebites: 6,
         espadas: true,  coroa: false, asas: 0, filigrana: false, halo: false },
    B: { metal: ['#fdf3d2', '#ccc08a', '#75704a'], rebites: 0,
         espadas: true,  coroa: true,  asas: 0, filigrana: false, halo: false },
    A: { metal: ['#fff0b8', '#e0ac33', '#8f6410'], rebites: 0,
         espadas: true,  coroa: true,  asas: 1, filigrana: false, halo: true },
    S: { metal: ['#fffbe3', '#f4c33c', '#a3720c'], rebites: 0,
         espadas: true,  coroa: true,  asas: 2, filigrana: true,  halo: true },
    N: { metal: ['#ffffff', '#ffe9a8', '#c08a1e'], rebites: 0,
         espadas: true,  coroa: true,  asas: 3, filigrana: true,  halo: true },
  },

  /* A LUZ de cada rank — só brilho, nunca o corpo da peça. */
  LUZ_RANK: {
    E: '#94a3b8', D: '#22d3ee', C: '#10b981',
    B: '#3b82f6', A: '#a855f7', S: '#fbbf24', N: '#fb7185',
  },

  existe(id) { return !!this.PEDRAS[id]; },

  /* IDs únicos por instância. Copiado em espírito de ConquistaFX._idsUnicos:
     sem isto, a segunda gema da página herda os gradientes da primeira. */
  _unico(svg) {
    const selo = `g${++this._seq}`;
    const ids = new Set();
    svg.replace(/\sid="([^"]+)"/g, (_, id) => { ids.add(id); return ''; });
    ids.forEach(id => {
      const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      svg = svg.replace(new RegExp(`\\sid="${esc}"`, 'g'), ` id="${id}-${selo}"`)
               .replace(new RegExp(`url\\(#${esc}\\)`, 'g'), `url(#${id}-${selo})`);
    });
    return svg;
  },

  /* Ponto de um polígono regular de N lados, raio r, com rotação. */
  _p(cx, cy, r, ang) {
    return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
  },
  _poligono(cx, cy, r, lados, giro = -Math.PI / 2) {
    const pts = [];
    for (let i = 0; i < lados; i++) {
      const [x, y] = this._p(cx, cy, r, giro + (Math.PI * 2 / lados) * i);
      pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
    return pts.join(' ');
  },

  /* ══════════════════════════════════════════════════════════
     A PEDRA LAPIDADA
     ══════════════════════════════════════════════════════════ */
  pedra(id, tam = 54, opts = {}) {
    const p = this.PEDRAS[id] || this.PEDRAS.ametista;
    const lados = opts.lados || 6;
    const cx = 50, cy = 50;
    const rExt = 46;          // cintura da pedra
    const rMesa = 24;         // a faceta plana do topo

    // Facetas da COROA: entre a mesa e a cintura. Cada uma é um trapézio
    // ligando um lado da mesa ao lado correspondente da cintura.
    // A ALTERNÂNCIA claro/escuro é o que produz a leitura de "lapidado" —
    // com todas iguais, vira um polígono com degradê.
    const giro = -Math.PI / 2;
    const passo = Math.PI * 2 / lados;
    const facetas = [];
    for (let i = 0; i < lados; i++) {
      const a1 = giro + passo * i;
      const a2 = giro + passo * (i + 1);
      const [x1, y1] = this._p(cx, cy, rExt, a1);
      const [x2, y2] = this._p(cx, cy, rExt, a2);
      const [m1, n1] = this._p(cx, cy, rMesa, a1);
      const [m2, n2] = this._p(cx, cy, rMesa, a2);
      // A luz vem de cima-esquerda: facetas do topo-esquerdo mais claras.
      const meio = (a1 + a2) / 2;
      const luz = Math.max(0, Math.cos(meio - (-Math.PI * 0.75)));   // 0..1
      const claro = i % 2 === 0;
      const op = (claro ? .55 : .18) + luz * .35;
      facetas.push(
        `<polygon points="${x1.toFixed(2)},${y1.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)}
                          ${m2.toFixed(2)},${n2.toFixed(2)} ${m1.toFixed(2)},${n1.toFixed(2)}"
                  fill="${claro ? p.mesa : p.fundo}" fill-opacity="${op.toFixed(2)}"
                  stroke="${p.brilho}" stroke-opacity=".18" stroke-width=".5"/>`);
    }

    // Facetas do PAVILHÃO — insinuadas por linhas convergindo ao ponto
    // baixo. É o que dá a sensação de que a pedra tem fundo, não é um disco.
    const pav = [];
    for (let i = 0; i < lados; i++) {
      const [x, y] = this._p(cx, cy, rExt, giro + passo * i);
      pav.push(`M ${x.toFixed(2)} ${y.toFixed(2)} L ${cx} ${cy + 14}`);
    }

    const particulasFable = Array.from({length: 16}).map((_, i) => {
      // Distribuição orgânica ao redor da pedra (padrão Fable5)
      const ang = (i * 22.5 + (i % 3) * 7) % 360;
      const raio = 38 + (i % 4) * 8 + (i % 2) * 5;
      const sz = 1.0 + (i % 3) * 0.5;
      
      const rad = ang * Math.PI / 180;
      const cxP = 50 + Math.cos(rad) * raio;
      const cyP = 50 + Math.sin(rad) * raio;

      const op = i % 3 === 0 ? '.95' : (i % 2 === 0 ? '.75' : '.55');
      const delay = (i * 0.15).toFixed(2);
      const dur   = (2.0 + (i % 4) * 0.5).toFixed(2);

      return `
      <g class="gem-brasa-item" style="transform-origin: ${cxP.toFixed(2)}px ${cyP.toFixed(2)}px; animation-delay: ${delay}s; animation-duration: ${dur}s">
        <!-- Núcleo quente (tom mais claro) -->
        <circle cx="${cxP.toFixed(2)}" cy="${cyP.toFixed(2)}" r="${sz.toFixed(2)}"
                fill="${p.mesa}" fill-opacity="${op}" filter="url(#brilhoParticula)"/>
        <!-- Halo da brasa (tom médio da gema) -->
        <circle cx="${cxP.toFixed(2)}" cy="${cyP.toFixed(2)}" r="${(sz * 2.2).toFixed(2)}"
                fill="${p.brilho}" fill-opacity="${(op * 0.6).toFixed(2)}" filter="url(#brilhoParticula)"/>
      </g>`;
    }).join('');

    return this._unico(`
<svg viewBox="0 0 100 100" width="${tam}" height="${tam}"
     class="gema-svg" aria-hidden="true" style="max-width:none;overflow:visible;">
  <style>
    .gem-brasa-item {
      animation: gem-crepitar 2.8s ease-in-out infinite alternate;
    }
    @keyframes gem-crepitar {
      0%   { transform: scale(0.7) translate(0, 0); opacity: 0.5; }
      50%  { transform: scale(1.3) translate(0, -6px); opacity: 1; }
      100% { transform: scale(0.85) translate(0, -2px); opacity: 0.7; }
    }
    @media (prefers-reduced-motion: reduce) {
      .gem-brasa-item { animation: none !important; }
    }
  </style>
  <defs>
    <radialGradient id="corpo" cx="38%" cy="30%">
      <stop offset="0%"   stop-color="${p.brilho}"/>
      <stop offset="28%"  stop-color="${p.mesa}"/>
      <stop offset="62%"  stop-color="${p.corpo}"/>
      <stop offset="100%" stop-color="${p.fundo}"/>
    </radialGradient>
    <linearGradient id="mesaGrad" x1="0" y1="0" x2=".7" y2="1">
      <stop offset="0%"   stop-color="${p.brilho}"/>
      <stop offset="45%"  stop-color="${p.mesa}"/>
      <stop offset="100%" stop-color="${p.corpo}"/>
    </linearGradient>
    <radialGradient id="fogo" cx="50%" cy="62%">
      <stop offset="0%"   stop-color="${p.fogo}" stop-opacity=".85"/>
      <stop offset="60%"  stop-color="${p.corpo}" stop-opacity=".25"/>
      <stop offset="100%" stop-color="${p.sombra}" stop-opacity="0"/>
    </radialGradient>
    <filter id="brilhoExt" x="-45%" y="-45%" width="190%" height="190%">
      <feGaussianBlur stdDeviation="3.5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="brilhoParticula" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="1.0" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="corteBase">
      <polygon points="${this._poligono(cx, cy, rExt, lados)}" />
    </clipPath>
  </defs>

  <!-- Aura intensa: dupla camada de brilho usando os tons mais claros da gema -->
  <polygon points="${this._poligono(cx, cy, rExt + 8, lados)}"
           fill="${p.brilho}" opacity=".5" filter="url(#brilhoExt)"/>
  <polygon points="${this._poligono(cx, cy, rExt + 3, lados)}"
           fill="${p.mesa}" opacity=".65" filter="url(#brilhoExt)"/>

  <!-- partículas flutuantes (Aura da Fênix replicada com CSS Keyframes) -->
  <g class="pt-particulas">
    ${particulasFable}
  </g>

  <!-- corpo -->
  <polygon points="${this._poligono(cx, cy, rExt, lados)}" fill="url(#corpo)"/>

  <!-- fogo interno (o brilho que "vive" dentro da pedra) -->
  <polygon points="${this._poligono(cx, cy, rExt - 2, lados)}" fill="url(#fogo)"/>

  <!-- pavilhão -->
  <g stroke="${p.sombra}" stroke-opacity=".45" stroke-width=".7" fill="none">
    <path d="${pav.join(' ')}"/>
  </g>

  <!-- coroa: as facetas alternadas -->
  <g>${facetas.join('')}</g>

  <!-- mesa: a faceta plana do topo, sempre a mais clara -->
  <polygon points="${this._poligono(cx, cy, rMesa, lados)}" fill="url(#mesaGrad)"/>
  <polygon points="${this._poligono(cx, cy, rMesa, lados)}" fill="none"
           stroke="${p.brilho}" stroke-opacity=".55" stroke-width=".8"/>

  <!-- feixe de luz varrendo a gema por dentro (efeito reflexo de lente) -->
  <g clip-path="url(#corteBase)">
    <rect x="-10" y="-20" width="15" height="150" fill="#ffffff" opacity="0.3" transform="rotate(35 50 50)">
      <animate attributeName="x" values="-100; 150; 150" keyTimes="0; 0.4; 1" dur="5s" repeatCount="indefinite"/>
    </rect>
  </g>

  <!-- cintilação estática -->
  <ellipse cx="38" cy="32" rx="9" ry="5.5" fill="${p.brilho}" opacity=".7"
           transform="rotate(-32 38 32)"/>
  <circle cx="63" cy="63" r="2.4" fill="${p.brilho}" opacity=".45"/>

  <!-- aresta da cintura -->
  <polygon points="${this._poligono(cx, cy, rExt, lados)}" fill="none"
           stroke="${p.brilho}" stroke-opacity=".6" stroke-width="1.2"/>
</svg>`);
  },

  /* Pedra com número dentro — é o que o banner usa nas estatísticas. */
  pedraComValor(id, valor, tam = 58) {
    const p = this.PEDRAS[id] || this.PEDRAS.ametista;
    return `
      <span class="gema-slot" style="width:${tam}px;height:${tam}px">
        ${this.pedra(id, tam)}
        <span class="gema-valor" style="font-size:${Math.max(10, Math.round(tam * .26))}px;
              color:${p.brilho}">${valor}</span>
      </span>`;
  },

  /* ══════════════════════════════════════════════════════════
     O BRASÃO — escudo, espadas cruzadas, coroa e asas

     Ordem de desenho, e ela é o que dá profundidade:
       halo → filigrana → asas → espadas → escudo → coroa
     As espadas ficam ATRÁS do escudo: só as pontas e os punhos aparecem,
     que é como um brasão de verdade se monta.
     ══════════════════════════════════════════════════════════ */

  /* Uma espada inclinada. Desenhada na vertical e girada — assim as duas
     são a mesma peça espelhada, e não dois desenhos que precisam combinar. */
  _espada(ang) {
    return `
      <g transform="rotate(${ang} 50 52)">
        <!-- lâmina: dois lados, um claro e um escuro, para ter gume -->
        <path d="M50 4 L53.4 12 L53.4 62 L46.6 62 L46.6 12 Z" fill="url(#lamina)"/>
        <path d="M50 4 L50 62" stroke="url(#metalEsc)" stroke-width=".7" opacity=".5"/>
        <!-- guarda -->
        <path d="M38 62 L62 62 L60 67 L40 67 Z" fill="url(#metalLin)"
              stroke="url(#metalEsc)" stroke-width=".6"/>
        <!-- punho e pomo -->
        <rect x="47.4" y="67" width="5.2" height="14" rx="1.4" fill="url(#metalEsc)"/>
        <circle cx="50" cy="84" r="3.4" fill="url(#metalRad)" stroke="url(#metalEsc)" stroke-width=".6"/>
      </g>`;
  },

  /* Asa em leque. `n` = 1 curta, 2 média, 3 plena. */
  _asa(lado, n) {
    if (!n) return '';
    const penas = 3 + n * 2;
    const alc = 14 + n * 9;
    const partes = [];
    for (let i = 0; i < penas; i++) {
      const t = i / (penas - 1);
      const x0 = 50 + lado * 22;
      const y0 = 34 + t * 12;
      const comp = alc * (1 - t * .38);
      partes.push(
        `<path d="M ${x0} ${y0}
                  Q ${(x0 + lado * comp * .55).toFixed(1)} ${(y0 - 4).toFixed(1)}
                    ${(x0 + lado * comp).toFixed(1)} ${(y0 + 4 + t * 4).toFixed(1)}"
               fill="none" stroke="url(#metalLin)" stroke-width="${(3.2 - t).toFixed(1)}"
               stroke-linecap="round"/>`);
    }
    return `<g opacity=".95">${partes.join('')}</g>`;
  },

  rank(letra, tam = 46) {
    const L = String(letra || 'E').toUpperCase();
    const r = this.RANKS[L] || this.RANKS.E;
    const luz = this.LUZ_RANK[L] || '#94a3b8';

    /* O escudo é mais estreito que antes: precisa deixar as pontas e os
       punhos das espadas aparecerem nas quatro diagonais. */
    const dCorpo = 'M50 22 L72 29 L72 52 Q72 72 50 83 Q28 72 28 52 L28 29 Z';
    const dBisel = 'M50 26 L68 32 L68 52 Q68 69 50 78 Q32 69 32 52 L32 32 Z';
    const dCampo = 'M50 30 L64 35 L64 52 Q64 66 50 73 Q36 66 36 52 L36 35 Z';

    const rebites = [];
    for (let i = 0; i < r.rebites; i++) {
      const t = i / (r.rebites - 1);
      const x = 31 + t * 38;
      rebites.push(`<circle cx="${x.toFixed(1)}" cy="34.6" r="1.5" fill="url(#metalEsc)"/>
                    <circle cx="${x.toFixed(1)}" cy="34" r="1.4" fill="url(#metalRad)"/>`);
    }

    const espadas = r.espadas ? this._espada(-38) + this._espada(38) : '';

    const coroa = r.coroa ? `
      <g transform="translate(0 -1)">
        <path d="M37 21 L41 11 L45.5 17.5 L50 8 L54.5 17.5 L59 11 L63 21 Z"
              fill="url(#metalLin)" stroke="url(#metalEsc)" stroke-width=".7"
              stroke-linejoin="round"/>
        <circle cx="50" cy="9" r="2" fill="${luz}"/>
        <circle cx="41" cy="12" r="1.3" fill="${luz}" opacity=".8"/>
        <circle cx="59" cy="12" r="1.3" fill="${luz}" opacity=".8"/>
      </g>` : '';

    /* Filigrana: o ornamento pálido que a referência traz ao fundo. Fica
       em opacidade baixíssima — é textura, não desenho para olhar. */
    const filigrana = r.filigrana ? `
      <g fill="none" stroke="url(#metalLin)" stroke-width="1.4" opacity=".22">
        <path d="M22 40 Q 8 44 12 56 Q 16 66 26 62"/>
        <path d="M78 40 Q 92 44 88 56 Q 84 66 74 62"/>
        <path d="M26 34 Q 14 30 10 36"/>
        <path d="M74 34 Q 86 30 90 36"/>
      </g>` : '';

    const halo = r.halo
      ? `<circle cx="50" cy="52" r="46" fill="${luz}" opacity=".18" filter="url(#sBlur)"/>` : '';

    return this._unico(`
<svg viewBox="0 0 100 100" width="${tam}" height="${tam}"
     class="gema-rank gema-rank-${L}" aria-hidden="true" style="max-width:none">
  <defs>
    <linearGradient id="metalLin" x1=".1" y1="0" x2=".7" y2="1">
      <stop offset="0%"   stop-color="${r.metal[0]}"/>
      <stop offset="45%"  stop-color="${r.metal[1]}"/>
      <stop offset="100%" stop-color="${r.metal[2]}"/>
    </linearGradient>
    <radialGradient id="metalRad" cx="35%" cy="28%">
      <stop offset="0%"   stop-color="${r.metal[0]}"/>
      <stop offset="55%"  stop-color="${r.metal[1]}"/>
      <stop offset="100%" stop-color="${r.metal[2]}"/>
    </radialGradient>
    <linearGradient id="metalEsc" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="${r.metal[2]}"/>
      <stop offset="100%" stop-color="#0a0d11"/>
    </linearGradient>
    <!-- A lâmina precisa de gume: claro de um lado, escuro do outro, com
         a transição no meio. Um degradê suave viraria tubo, não lâmina. -->
    <linearGradient id="lamina" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="${r.metal[2]}"/>
      <stop offset="46%"  stop-color="${r.metal[1]}"/>
      <stop offset="52%"  stop-color="${r.metal[0]}"/>
      <stop offset="100%" stop-color="${r.metal[1]}"/>
    </linearGradient>
    <linearGradient id="corpoGrad" x1=".2" y1="0" x2=".8" y2="1">
      <stop offset="0%"   stop-color="${r.metal[0]}"/>
      <stop offset="26%"  stop-color="${r.metal[1]}"/>
      <stop offset="68%"  stop-color="${r.metal[2]}"/>
      <stop offset="100%" stop-color="${r.metal[1]}"/>
    </linearGradient>
    <radialGradient id="campoGrad" cx="42%" cy="30%">
      <stop offset="0%"   stop-color="${luz}" stop-opacity=".28"/>
      <stop offset="55%"  stop-color="#10161d"/>
      <stop offset="100%" stop-color="#05080b"/>
    </radialGradient>
    <filter id="sBlur" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="4"/>
    </filter>
  </defs>

  ${halo}
  ${filigrana}
  ${this._asa(-1, r.asas)}
  ${this._asa( 1, r.asas)}
  ${espadas}

  <!-- o escudo por cima das espadas: só pontas e punhos ficam à mostra -->
  <path d="${dCorpo}" fill="url(#corpoGrad)" stroke="url(#metalEsc)" stroke-width="1.6"/>
  <path d="${dBisel}" fill="none" stroke="url(#metalLin)" stroke-width="2.6" opacity=".85"/>
  <path d="${dBisel}" fill="none" stroke="url(#metalEsc)" stroke-width=".9"
        transform="translate(0 1.4)" opacity=".8"/>
  <path d="${dCampo}" fill="url(#campoGrad)"/>
  <path d="${dCampo}" fill="none" stroke="${luz}" stroke-width=".9" opacity=".5"/>

  ${rebites.join('')}

  <!-- vinco central e lustro -->
  <path d="M50 34 V 70" stroke="${luz}" stroke-width=".7" opacity=".26"/>
  <path d="M34 34 Q 43 29 55 27" fill="none" stroke="${r.metal[0]}"
        stroke-width="2.4" stroke-linecap="round" opacity=".5"/>

  ${coroa}
</svg>`);
  },

  /* Nome legível — para tooltip e legenda. */
  nomeRank(letra) {
    return ({ E: 'Rank E', D: 'Rank D', C: 'Rank C', B: 'Rank B',
              A: 'Rank A', S: 'Rank S', N: 'National Level' })[String(letra).toUpperCase()]
           || 'Rank E';
  },
};

window.Gemas = Gemas;
