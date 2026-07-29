/* ============================================================
   banners-arte.js — O VOCABULÁRIO de desenho dos banners

   POR QUE ESTE ARQUIVO EXISTE

   A V4 precisa sair da Vitrine para virar peça e poder ser montada
   no Dashboard. Só que ela não é código solto: usa treze funções de
   desenho que a V1, a V2 e a V3 também usam.

   Se a V4 levasse essas funções junto, quebraria as outras três. Se
   as chamasse de dentro do estandarte.js, a PEÇA passaria a depender
   da VITRINE — exatamente a inversão que estamos desfazendo.

   A saída é separar o que são duas coisas diferentes:

       ARTE (aqui)          o vocabulário: hexágonos, barras de XP,
                            gemas, escudos, tecidos. Funções puras:
                            entra dado, sai HTML. Não sabem quem as
                            chama nem onde vão parar.

       VITRINE (estandarte) a bancada: controles, palco, botões de
                            versão, modo teste. Ela USA a arte.

       PEÇA (banner-v4)     também usa a arte — sem passar pela
                            Vitrine.

   COMO ISTO FOI FEITO SEM QUEBRAR NADA

   Treze das quinze funções JÁ ERAM PURAS: nenhuma lia estado da
   Vitrine. Foram movidas sem uma linha alterada. As três que liam
   (`_aura`, `_reliquias`, `_rank`) ficaram lá, porque o que elas
   leem é estado de bancada — a aura que o Arquiteto escolheu no
   painel, o acervo carregado, o rank forçado para teste.

   O estandarte.js manteve os mesmos nomes como atalhos de uma
   linha, então NENHUMA chamada da V1/V2/V3/V4 mudou.

   A GARANTIA: `tests/teste_banners_identicos.js` renderiza as quatro
   versões nos três campos de cor — doze combinações — com o
   estandarte.js de antes e o de depois, e compara caractere a
   caractere. É a única prova possível sem um navegador.
   ============================================================ */

const BannersArte = {

  TECIDOS: {
    obsidiana: {
      nome: 'Obsidiana e Ouro',
      pano: '#0d0a14', panoAlto: '#1a1426', pano2: '#080610',
      fio: '#d4a94a', fioAlto: '#f4d98a',
      cera: '#8b1a1a', ceraAlto: '#c23b3b',
      trilho: '#5a4a2a', luz: 'rgba(212,169,74,.55)',
    },
    sangue: {
      nome: 'Sangue do Monarca',
      pano: '#160709', panoAlto: '#2b0d12', pano2: '#0d0407',
      fio: '#e0b8c0', fioAlto: '#ffe3e9',
      cera: '#2a0a0d', ceraAlto: '#7a1f28',
      trilho: '#4a2228', luz: 'rgba(224,80,110,.5)',
    },
    gelo: {
      nome: 'Gelo Sombrio',
      pano: '#070d14', panoAlto: '#0f1c2b', pano2: '#04080e',
      fio: '#a8c8e0', fioAlto: '#dff0ff',
      cera: '#123045', ceraAlto: '#2d6b91',
      trilho: '#25404f', luz: 'rgba(120,190,230,.45)',
    },
  },

  /* ── Campos do V2 ────────────────────────────────────────
     "Petróleo" é o da referência. Os outros dois existem para provar que
     a peça aguenta troca de paleta sem desmontar. */

  CAMPOS: {
    petroleo: { nome: 'Petróleo',  fundo: '#0a1f24', fundo2: '#061418',
                circuito: '#1d5f68', feixe: '#3fd8e8', feixe2: '#8ff4ff' },
    abissal:  { nome: 'Abissal',   fundo: '#0d1030', fundo2: '#060818',
                circuito: '#2a3a7a', feixe: '#7c8cff', feixe2: '#c4ccff' },
    brasa:    { nome: 'Brasa',     fundo: '#251208', fundo2: '#140903',
                circuito: '#6b3a15', feixe: '#ff9d3f', feixe2: '#ffd9a8' },
  },

  /* Cor do RANK — do hunter, não do banner. Atravessa as duas propostas. */

  RANK_CORES: {
    E: '#94a3b8', D: '#22d3ee', C: '#10b981',
    B: '#3b82f6', A: '#a855f7', S: '#fbbf24', N: '#fb7185',
  },

  letraRank(classe) {
    const c = (classe || 'E-Rank').toUpperCase();
    if (c.includes('NATIONAL')) return 'N';
    const m = c.match(/\b([EDCBAS])\b|^([EDCBAS])-/);
    return (m && (m[1] || m[2])) || 'E';
  },

  /* ── Abertura ────────────────────────────────────────────── */

  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  orbitaHex() {
    return '<span class="pt-anel" aria-hidden="true"></span>';
  },

  /* SELO HEXAGONAL DO RANK — encostado no retrato.

     Era um círculo pequeno, solto no canto. Vira hexágono pela mesma razão
     que a foto é hexagonal: repetir a forma amarra as duas peças como um
     conjunto só, em vez de "uma foto e um distintivo". Encosta no vértice
     inferior-direito do hexágono grande, de modo que as arestas conversem.

     Em SVG, não em CSS, por um motivo prático: o bisel interno e o anel
     externo precisam acompanhar o recorte hexagonal. Com `clip-path` a
     borda some junto com o recorte — é preciso desenhar cada camada. */

  seloHex(letra, cor) {
    const hex = (r) => {
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        pts.push(`${(24 + r * Math.cos(a)).toFixed(2)},${(24 + r * Math.sin(a)).toFixed(2)}`);
      }
      return pts.join(' ');
    };
    return `
      <span class="pt-selo-hex" title="Rank ${letra}">
        <svg viewBox="0 0 48 48" width="48" height="48" style="max-width:none" aria-hidden="true">
          <defs>
            <linearGradient id="shBorda" x1=".2" y1="0" x2=".8" y2="1">
              <stop offset="0%"   stop-color="#fff3cd"/>
              <stop offset="45%"  stop-color="${cor}"/>
              <stop offset="100%" stop-color="#0a1116"/>
            </linearGradient>
            <radialGradient id="shMiolo" cx="38%" cy="30%">
              <stop offset="0%"   stop-color="#0f2b33"/>
              <stop offset="100%" stop-color="#040d11"/>
            </radialGradient>
            <filter id="shGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.6"/>
            </filter>
          </defs>
          <polygon points="${hex(23)}" fill="${cor}" opacity=".45" filter="url(#shGlow)"/>
          <polygon points="${hex(21)}" fill="url(#shBorda)"/>
          <polygon points="${hex(17)}" fill="url(#shMiolo)"/>
          <polygon points="${hex(17)}" fill="none" stroke="${cor}" stroke-width="1" opacity=".9"/>
          <path d="M ${hex(19).split(' ')[4]} L ${hex(19).split(' ')[5]} L ${hex(19).split(' ')[0]}"
                fill="none" stroke="#fff" stroke-width="1.4" opacity=".4" stroke-linecap="round"/>
        </svg>
        <span class="pt-selo-letra" style="color:${cor}">${letra}</span>
      </span>`;
  },

  /* ══════════════════════════════════════════════════════════
     A BARRA DE XP — em SVG, e não em CSS

     POR QUE MUDOU DE TECNOLOGIA

     A primeira versão empilhava três camadas de CSS: uma calha com
     `overflow: visible`, um halo em `radial-gradient` e um lustro em
     `background-position`. Funcionava na teoria e não apareceu na tela —
     e não é mistério: um brilho que precisa TRANSBORDAR os limites do
     elemento fica à mercê de cada `overflow`, `border-radius` e contexto
     de empilhamento no caminho até a raiz. Basta um ancestral recortando
     para ele sumir, e são muitos ancestrais.

     Em SVG o brilho não depende de nada disso. `feGaussianBlur` desenha o
     borrão DENTRO da própria tela do SVG, e a região de filtro
     (`x/y/width/height` a -50%/200%) reserva o espaço para ele existir.
     Deixa de ser uma aposta sobre a cascata e vira desenho.

     O EFEITO QUE CIRCUNDA A BARRA, em quatro camadas:

       1. AURA — o trecho preenchido, borrado e ampliado. É a luz que a
          energia joga em volta: ela acompanha o preenchimento, então
          cresce conforme o XP sobe.
       2. TRILHO — a calha escura com luz de borda embaixo (metal polido).
       3. FEIXE — o preenchimento, com degradê que clareia até a ponta.
       4. CENTELHA — um ponto de luz na cabeça do feixe, pulsando, mais
          uma faísca que corre pelo perímetro do trecho aceso.

     A centelha que corre usa `stroke-dasharray` com `stroke-dashoffset`
     animado: um traço curto percorrendo o contorno do trecho preenchido.
     É essa que dá a leitura de "circula a barra".
     ══════════════════════════════════════════════════════════ */

  barraXP(pct, campo) {
    /* A tela reserva 96px à ESQUERDA da barra: é lá que os três feixes
       saem do escudo e se juntam. O CSS puxa o SVG para a esquerda com
       margem negativa, de modo que essa faixa caia sobre o escudo. */
    const W = 980, H = 78;
    const zona = 45;                    // faixa de convergência e ancoragem do nodo
    const bx = zona, bw = W - zona - 14;
    const cy = H / 2, bh = 11;
    const by = cy - bh / 2;
    const fw = Math.max(bh, bw * (pct / 100));
    const px = bx + fw;

    /* ══════════════════════════════════════════════════════
       A HÉLICE — três correções sobre a versão anterior

       1. A AMPLITUDE, medida duas vezes. Primeiro estava alta demais (15
          numa barra de 5,5 de raio) e a onda parecia passar POR CIMA.
          Baixei para 9 e ficou pior: os arcos de trás quase não saíam da
          barra — sobravam 3,5px visíveis — então o que se via era só a
          camada da frente, e o efeito virou linha reta.

          O ponto certo é OUTRO: os dois arcos precisam aparecer FORA da
          barra, e a oclusão acontece só na travessia. Com 17, cada arco
          sobra 11px além da borda: dá para ver o de cima passando atrás e
          o de baixo passando à frente. É a alternância entre os dois que
          produz a volta, não a altura da onda.

       2. E FALTAVA PERSPECTIVA. Numa hélice real, o trecho que passa NA
          FRENTE está mais perto: mais grosso e mais brilhante. O que passa
          ATRÁS está mais longe: mais fino e mais apagado. Sem essa
          diferença, os dois lados parecem estar no mesmo plano — e o
          conjunto vira zigue-zague.

       3. AS PONTAS. Ela nascia e morria no corte. Agora entra pela
          esquerda como TRÊS FEIXES saindo do escudo, que se fundem num só
          na boca da barra; e à direita ultrapassa o fim e se dissolve
          numa máscara de desvanecimento.
       ══════════════════════════════════════════════════════ */
    const ciclos = 2.6;   // menos ciclos = arcos mais largos, leitura mais clara
    const lam = bw / ciclos;
    const amp = 17;                      // sobra ~11px de cada lado da barra
    const x0 = bx - lam, x1 = bx + bw + lam * .6;

    const pontoY = (x) => cy + Math.sin(((x - bx) / lam) * Math.PI * 2) * amp;

    const segmento = (xa, xb) => {
      const passos = 16;
      const d = [];
      for (let i = 0; i <= passos; i++) {
        const x = xa + (xb - xa) * (i / passos);
        d.push(`${i ? 'L' : 'M'} ${x.toFixed(1)} ${pontoY(x).toFixed(1)}`);
      }
      return d.join(' ');
    };

    const tras = [], frente = [];
    const meio = lam / 2;
    let k = 0;
    for (let xa = x0; xa < x1; xa += meio, k++) {
      const seg = segmento(xa, Math.min(xa + meio + 2, x1));
      (k % 2 === 0 ? tras : frente).push(seg);
    }

    /* O NODO DE ORIGEM E OS FEIXES.
       Como a barra estava 'flutuando', criamos um ancoradouro tecnológico (um losango).
       Os três feixes convergem das extremidades (perspectiva do circuito) 
       e injetam energia no nodo, que por sua vez ejeta a barra de XP. */
    const feixes = [-1.5, 0, 1.5].map((n, i) => {
      const yIni = cy + n * 18;
      const xIni = -10; // Nascem de fora da tela
      const yFim = cy;
      const d = `M ${xIni} ${yIni} C ${bx * 0.4} ${yIni} ${bx * 0.6} ${yFim} ${bx} ${yFim}`;
      return `<path class="pt-feixe-nasce pt-feixe-n${i}" d="${d}" fill="none"
                    stroke="url(#feixeNasce)" stroke-width="${2.5 - Math.abs(n) * .5}"
                    stroke-linecap="round" filter="url(#linhaBrilho)"/>`;
    }).join('');

    const nodoOrigem = `
      <g class="pt-nodo-ancora">
        <polygon points="${bx-10},${cy} ${bx},${cy-10} ${bx+10},${cy} ${bx},${cy+10}" fill="${campo.fundo2}" stroke="${campo.feixe}" stroke-width="1.5" filter="url(#linhaBrilho)"/>
        <circle cx="${bx}" cy="${cy}" r="3" fill="#fff" filter="url(#linhaBrilho)"/>
        <path d="M 0 ${cy} L ${bx} ${cy}" stroke="${campo.circuito}" stroke-width="1.5" stroke-dasharray="2 4" opacity="0.5"/>
      </g>
    `;

    return `
      <svg class="pt-barra" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"
           width="100%" height="${H}" aria-hidden="true"
           style="max-width:none;--lam:${lam.toFixed(2)}px">
        <defs>
          <linearGradient id="feixeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stop-color="${campo.feixe}" stop-opacity=".3"/>
            <stop offset="55%"  stop-color="${campo.feixe}"/>
            <stop offset="100%" stop-color="${campo.feixe2}"/>
          </linearGradient>
          <linearGradient id="trilhoGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stop-color="#000" stop-opacity=".78"/>
            <stop offset="100%" stop-color="#000" stop-opacity=".38"/>
          </linearGradient>
          <linearGradient id="linhaGrad" x1="0" y1="0" x2="1" y2="0"
                          gradientUnits="objectBoundingBox">
            <stop offset="0%"   stop-color="${campo.feixe}"  stop-opacity=".25"/>
            <stop offset="14%"  stop-color="${campo.feixe2}" stop-opacity=".95"/>
            <stop offset="30%"  stop-color="${campo.feixe}"  stop-opacity=".45"/>
            <stop offset="48%"  stop-color="${campo.feixe2}" stop-opacity="1"/>
            <stop offset="64%"  stop-color="${campo.feixe}"  stop-opacity=".35"/>
            <stop offset="82%"  stop-color="${campo.feixe2}" stop-opacity=".9"/>
            <stop offset="100%" stop-color="${campo.feixe}"  stop-opacity=".3"/>
          </linearGradient>
          <linearGradient id="feixeNasce" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stop-color="${campo.feixe2}" stop-opacity="0"/>
            <stop offset="35%"  stop-color="${campo.feixe2}" stop-opacity=".55"/>
            <stop offset="100%" stop-color="${campo.feixe2}" stop-opacity=".95"/>
          </linearGradient>

          <filter id="aura" x="-30%" y="-200%" width="160%" height="500%">
            <feGaussianBlur stdDeviation="8"/>
          </filter>
          <filter id="linhaBrilho" x="-30%" y="-200%" width="160%" height="500%">
            <feGaussianBlur stdDeviation="2.4"/>
          </filter>
          <filter id="auraForte" x="-40%" y="-200%" width="180%" height="500%">
            <feGaussianBlur stdDeviation="3"/>
          </filter>

          <!-- DESVANECIMENTO NAS PONTAS. A hélice ultrapassa o fim da barra
               e SOME aos poucos, em vez de ser cortada no meio do traço. À
               esquerda o mesmo, para a fusão dos feixes parecer nascimento. -->
          <linearGradient id="fadeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"    stop-color="#fff" stop-opacity="0"/>
            <stop offset="${(zona / W * 100).toFixed(1)}%" stop-color="#fff" stop-opacity="1"/>
            <stop offset="88%"   stop-color="#fff" stop-opacity="1"/>
            <stop offset="100%"  stop-color="#fff" stop-opacity="0"/>
          </linearGradient>
          <mask id="dissolver">
            <rect x="0" y="0" width="${W}" height="${H}" fill="url(#fadeGrad)"/>
          </mask>
        </defs>

        <!-- os três feixes nascendo do escudo -->
        <g>${feixes}</g>

        <g mask="url(#dissolver)">
          <!-- 1 · aura do trecho aceso -->
          <rect x="${bx}" y="${by}" width="${fw}" height="${bh}" rx="${bh / 2}"
                fill="${campo.feixe}" opacity=".5" filter="url(#aura)"/>

          <!-- 2 · a metade que passa ATRÁS: mais fina e mais apagada,
                   porque está mais longe do olho -->
          <g class="pt-onda pt-onda-tras">
            ${tras.map(d => `<path d="${d}" fill="none" stroke="url(#linhaGrad)"
                    stroke-width="2.4" stroke-linecap="round"
                    filter="url(#linhaBrilho)" opacity=".42"/>`).join('')}
          </g>

          <!-- 3 · trilho -->
          <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${bh / 2}"
                fill="url(#trilhoGrad)" stroke="${campo.circuito}" stroke-width="1"/>

          <!-- 4 · feixe -->
          <rect x="${bx}" y="${by}" width="${fw}" height="${bh}" rx="${bh / 2}"
                fill="url(#feixeGrad)" filter="url(#auraForte)" opacity=".85"/>
          <rect x="${bx}" y="${by}" width="${fw}" height="${bh}" rx="${bh / 2}"
                fill="url(#feixeGrad)"/>

          <!-- 5 · a metade DA FRENTE: mais grossa e mais brilhante,
                   porque está mais perto. É esta diferença que produz o
                   volume — sem ela, os dois lados parecem coplanares. -->
          <g class="pt-onda pt-onda-frente">
            ${frente.map(d => `<path d="${d}" fill="none" stroke="url(#linhaGrad)"
                    stroke-width="5" stroke-linecap="round"
                    filter="url(#linhaBrilho)" opacity="1"/>`).join('')}
          </g>

          <!-- 6 · centelha na cabeça do feixe -->
          <circle cx="${px}" cy="${cy}" r="11" fill="${campo.feixe2}"
                  opacity=".45" filter="url(#auraForte)"/>
          <circle class="pt-centelha" cx="${px}" cy="${cy}" r="5" fill="#fff"/>
          <circle cx="${px}" cy="${cy}" r="2.2" fill="#fff"/>
        </g>
      </svg>`;
  },

  /* Arcos de circuito no canto direito — a assinatura visual da referência.
     Ficam em opacidade baixa: é atmosfera, não desenho para olhar. */

  circuito() {
    return `
      <svg class="pt-circuito" viewBox="0 0 400 120" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
        <g fill="none" stroke="currentColor" stroke-width="1">
          <path d="M400 20 L330 20 L310 40 L250 40"/>
          <path d="M400 60 L350 60 L332 78 L268 78"/>
          <path d="M400 100 L360 100 L344 84 L300 84"/>
          <path d="M250 40 L235 55 L235 95"/>
          <circle cx="250" cy="40" r="3"/><circle cx="268" cy="78" r="3"/>
          <circle cx="300" cy="84" r="3"/><circle cx="235" cy="95" r="3"/>
          <path d="M400 8 A 112 112 0 0 0 288 120" stroke-opacity=".55"/>
          <path d="M400 -14 A 134 134 0 0 0 266 120" stroke-opacity=".35"/>
          <path d="M400 34 A 86 86 0 0 0 314 120" stroke-opacity=".45"/>
        </g>
      </svg>`;
  },

  /* PEDRA LAPIDADA de estatística.
     Antes era um hexágono com degradê, e hexágono com degradê não é pedra:
     é polígono pintado. Agora vem de `Gemas.pedraComValor`, que desenha
     mesa, facetas de coroa alternando luz, pavilhão e cintilação — o mesmo
     processo das badges (SVG forjado em código, IDs únicos, tamanho
     explícito). Sem a forja carregada, cai num disco simples em vez de
     sumir: a vitrine tem que abrir sempre. */

  gema(pedra, valor, rotulo, opts = {}) {
    if (typeof Gemas !== 'undefined' && Gemas.pedraComValor) {
      return `
        <div class="pt-gema" title="${rotulo}">
          ${Gemas.pedraComValor(pedra, valor, 56, opts)}
          <span class="pt-gema-rot">${rotulo}</span>
        </div>`;
    }
    return `
      <div class="pt-gema">
        <div class="pt-gema-fallback"><span class="pt-gema-val">${valor}</span></div>
        <span class="pt-gema-rot">${rotulo}</span>
      </div>`;
  },

  /* MEDALHA DE RANK — evolui de E a N (Gemas.rank).
     Substituiu o sigilo lunar, que era decoração fixa. Agora a peça à
     esquerda da barra CONTA alguma coisa: quanto mais alto o rank, mais
     raios, anéis e — no S e no N — coroa e louros. A diferença se vê na
     silhueta, de longe, sem precisar ler a letra. */

  medalhaRank(letra, tam = 46) {
    if (typeof Gemas !== 'undefined' && Gemas.rank) return Gemas.rank(letra, tam);
    return `<span class="pt-rank-fallback">${letra}</span>`;
  },

  /* ══════════════════════════════════════════════════════════
     V1 · O ESTANDARTE (heráldico)
     ══════════════════════════════════════════════════════════ */

  trilho() {
    return `
      <div class="est-trilho" aria-hidden="true">
        <span class="est-anel esq"></span>
        <span class="est-barra"></span>
        <span class="est-anel dir"></span>
      </div>`;
  },

  brasao() {
    return `
      <svg class="est-brasao" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <pattern id="est-losango" width="14" height="14" patternUnits="userSpaceOnUse"
                   patternTransform="rotate(45)">
            <path d="M0 0h14v14H0z" fill="none"/>
            <path d="M0 7h14M7 0v14" stroke="currentColor" stroke-width=".6" opacity=".5"/>
          </pattern>
        </defs>
        <path d="M0 0 L100 0 L100 60 L0 60 Z" fill="url(#est-losango)" opacity=".5"/>
        <path d="M100 0 L200 0 L200 60 L100 60 Z" fill="currentColor" opacity=".045"/>
        <path d="M0 0 L200 60" stroke="currentColor" stroke-width=".5" opacity=".12"/>
        <path d="M0 60 L200 0" stroke="currentColor" stroke-width=".5" opacity=".12"/>
      </svg>`;
  },

  fita(xp, alvo, pct) {
    return `
      <div class="est-fita">
        <div class="est-fita-corpo">
          <div class="est-fita-preenche" style="width:${pct}%"></div>
          <span class="est-fita-txt">${xp.toLocaleString('pt-BR')} / ${alvo.toLocaleString('pt-BR')} XP</span>
        </div>
        <span class="est-fita-cauda esq"></span>
        <span class="est-fita-cauda dir"></span>
      </div>`;
  },

  medalha(tipo, valor, rotulo) {
    return `
      <div class="est-medalha est-med-${tipo}">
        <span class="est-corrente" aria-hidden="true"></span>
        <span class="est-disco"><span class="est-valor">${valor}</span></span>
        <span class="est-med-rot">${rotulo}</span>
      </div>`;
  },

  bainha() {
    return `
      <svg class="est-bainha" viewBox="0 0 200 10" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 0 L0 6 L8 3 L16 8 L24 2 L33 7 L41 3 L50 9 L58 4 L67 8 L75 2 L84 7
                 L92 3 L101 9 L109 4 L118 7 L126 2 L135 8 L143 3 L152 9 L160 4 L169 7
                 L177 2 L186 8 L194 3 L200 6 L200 0 Z"/>
      </svg>`;
  },
};

window.BannersArte = BannersArte;
