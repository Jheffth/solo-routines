/* ============================================================
   pena-do-punidor.js — Insígnia "PENA DO PUNIDOR"

   O Arquiteto rejeitou a primeira versão: "a arte e os efeitos dela
   ficaram muito feios", e mandou a referência — uma pena de escrever
   clássica, com o floreio da tinta saindo da ponta.

   O QUE ESTAVA ERRADO, e é erro de MÉTODO, não de gosto:

   A primeira versão empilhava efeito sobre efeito — halo orbital,
   dezoito marcas girando, gema pulsante, vinte e duas partículas — e
   desenhava a pena como uma lasca fina no meio de tudo isso. O
   resultado é o que se viu: a moldura ficou mais forte que o objeto.

   Uma insígnia é um OBJETO, não um espetáculo em volta de um objeto.

   Nesta versão a hierarquia se inverte: a PENA ocupa a insígnia, e
   tudo o mais existe para emoldurá-la sem competir.

   A SILHUETA, fiel à referência:
     · pena grande na diagonal, curvando como pluma de verdade
     · RAQUE — o eixo claro que percorre toda a extensão
     · BARBAS geradas uma a uma, longas na base e curtas na ponta,
       INCLINADAS para a ponta. É a inclinação que faz o olho ler
       "pena" em vez de "espinha de peixe"
     · a haste desce e vira BICO metálico com fenda e furo de respiro
     · e o FLOREIO: o traço de tinta que sai da ponta e fecha em
       espiral, exatamente como na referência

   A PALETA é a da penitência, de propósito. Esta é a insígnia do
   Arquiteto que escreve as sentenças, e o giroflex do cartão de
   punição usa as mesmas duas cores — a insígnia e o cartão falam a
   mesma língua.

     pluma   #10131c → #dbe4f0   nanquim azulado, iluminado na raque
     veio    #ff0a3c             o carmesim do Sistema
     nib     #39414f → #cfd8e6   chumbo polido
     tinta   #ff0a3c → #2b6bff   o floreio, do vermelho ao azul
   ============================================================ */

const PenaPunidorFX = {

  /* O EIXO DA PLUMA. Uma Bézier cúbica avaliada em `t`, e todas as
     peças da pena consultam esta mesma função: as barbas, os veios e
     a raque desenhada. Uma curva só, três consumidores — se ela mudar,
     a pena inteira acompanha em vez de descolar. */
  _eixo(t) {
    const p0 = [96, 214], p1 = [104, 150], p2 = [140, 96], p3 = [196, 54];
    const u = 1 - t;
    return [
      u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0],
      u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1],
    ];
  },

  _tangente(t) {
    const [x1, y1] = this._eixo(Math.max(0, t - 0.01));
    const [x2, y2] = this._eixo(Math.min(1, t + 0.01));
    return Math.atan2(y2 - y1, x2 - x1);
  },

  /* ── AS BARBAS ─────────────────────────────────────────────
     Geradas em laço, não escritas à mão. É o que permite ter setenta
     com espaçamento e curvatura coerentes — desenhar oito à mão foi o
     que deixou a primeira versão com cara de lasca. */
  _barbas(id) {
    let sup = '', inf = '';
    const N = 34;
    for (let i = 0; i < N; i++) {
      const t = 0.10 + (i / N) * 0.88;
      const [x, y] = this._eixo(t);
      const a = this._tangente(t);

      /* O COMPRIMENTO desenha a forma da pluma: barriga no terço
         inferior, afinando até a ponta. O expoente 0.75 na senóide é
         o que empurra a parte mais larga para baixo do meio — uma
         pena real não é simétrica. */
      const perfil = Math.sin(Math.pow(1 - t, 0.75) * Math.PI * 0.92);
      const lenSup = 30 + perfil * 44;
      const lenInf = 24 + perfil * 34;

      // INCLINADAS para a ponta, nunca perpendiculares.
      const incl = 0.62;
      const asup = a - Math.PI / 2 + incl;
      const ainf = a + Math.PI / 2 + incl;
      const dx1 = Math.cos(asup), dy1 = Math.sin(asup);
      const dx2 = Math.cos(ainf), dy2 = Math.sin(ainf);
      const ondul = Math.sin(i * 1.7) * 3;   // as pontas não alinham

      sup += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} Q${(x + dx1 * lenSup * .55 + ondul).toFixed(1)} ${(y + dy1 * lenSup * .55).toFixed(1)} ${(x + dx1 * lenSup).toFixed(1)} ${(y + dy1 * lenSup - 2).toFixed(1)}" stroke="url(#${id}-plumaSup)" stroke-width="${(2.6 - t * 1.2).toFixed(2)}" fill="none" stroke-linecap="round" opacity="${(.92 - t * .18).toFixed(2)}"/>`;
      inf += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} Q${(x + dx2 * lenInf * .55 - ondul).toFixed(1)} ${(y + dy2 * lenInf * .55).toFixed(1)} ${(x + dx2 * lenInf).toFixed(1)} ${(y + dy2 * lenInf + 2).toFixed(1)}" stroke="url(#${id}-plumaInf)" stroke-width="${(2.2 - t * 1.0).toFixed(2)}" fill="none" stroke-linecap="round" opacity="${(.85 - t * .2).toFixed(2)}"/>`;
    }
    return { sup, inf };
  },

  /* Os VEIOS carmesim. QUATRO, finos. Eles são o acento, não o
     assunto — na primeira versão eram tantos que a pena parecia
     ferida em vez de nobre. */
  _veios(id) {
    return [0.22, 0.38, 0.55, 0.72].map((t, k) => {
      const [x, y] = this._eixo(t);
      const len = 40 - k * 6;
      return `<path d="M${x.toFixed(1)} ${y.toFixed(1)} q${(len * .5).toFixed(1)} ${(-len * .42).toFixed(1)} ${len.toFixed(1)} ${(-len * .72).toFixed(1)}" stroke="url(#${id}-veio)" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".9"/>`;
    }).join('');
  },

  _svgMedalha(tamanho = 260) {
    /* ID ÚNICO por instância. Dois `linearGradient` com o mesmo id na
       mesma página fazem o segundo herdar o primeiro — e a insígnia
       aparece na Forja, no perfil e na cerimônia ao mesmo tempo. */
    const id = 'pp' + Math.random().toString(36).slice(2, 8);
    const { sup, inf } = this._barbas(id);

    return `
<svg viewBox="0 0 260 260" width="${tamanho}" height="${tamanho}"
     xmlns="http://www.w3.org/2000/svg" class="pp-medalha" role="img"
     aria-label="Insígnia Pena do Punidor">
  <defs>
    <!-- A PLUMA: escura na borda, iluminada junto à raque. É esse
         degradê ao longo da BARBA que dá volume — sem ele, seriam
         traços chapados. -->
    <linearGradient id="${id}-plumaSup" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0"   stop-color="#dbe4f0"/>
      <stop offset=".30" stop-color="#5a6a86"/>
      <stop offset="1"   stop-color="#10131c"/>
    </linearGradient>
    <linearGradient id="${id}-plumaInf" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0"   stop-color="#c3cfe0"/>
      <stop offset=".34" stop-color="#48566f"/>
      <stop offset="1"   stop-color="#0b0e15"/>
    </linearGradient>
    <linearGradient id="${id}-veio" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#ff0a3c" stop-opacity=".95"/>
      <stop offset="1" stop-color="#ff0a3c" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${id}-raque" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0"   stop-color="#8e9ab0"/>
      <stop offset=".45" stop-color="#eef3fa"/>
      <stop offset="1"   stop-color="#9fb0c8"/>
    </linearGradient>
    <linearGradient id="${id}-nib" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0"   stop-color="#cfd8e6"/>
      <stop offset=".5"  stop-color="#6b7688"/>
      <stop offset="1"   stop-color="#39414f"/>
    </linearGradient>
    <!-- O FLOREIO vai do carmesim ao azul: as duas cores do giroflex
         da penitência. A insígnia e o cartão falam a mesma língua. -->
    <linearGradient id="${id}-tinta" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0"   stop-color="#ff0a3c"/>
      <stop offset=".55" stop-color="#a2185a"/>
      <stop offset="1"   stop-color="#2b6bff"/>
    </linearGradient>
    <radialGradient id="${id}-fundo" cx=".5" cy=".42" r=".62">
      <stop offset="0"   stop-color="#1a1020"/>
      <stop offset=".62" stop-color="#0a0710"/>
      <stop offset="1"   stop-color="#05030a"/>
    </radialGradient>
    <radialGradient id="${id}-brasa" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#ff0a3c" stop-opacity=".5"/>
      <stop offset="1" stop-color="#ff0a3c" stop-opacity="0"/>
    </radialGradient>
    <filter id="${id}-suave" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="3.2"/>
    </filter>
    <filter id="${id}-brilho" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="1.6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- ── AS ANIMAÇÕES ─────────────────────────────────────
       Embutidas no SVG, como a Fênix faz. Elas são POUCAS de
       propósito: a versão anterior animava tudo ao mesmo tempo — anel
       girando, marcas, gema, vinte e duas partículas — e o olho não
       tinha onde pousar.

       Aqui só três coisas se movem, e cada uma tem um motivo:
         · o FLOREIO se escreve, uma vez, no começo
         · a GOTA se forma e cai do bico
         · a BRASA respira devagar, por trás da pena

       Nada gira. Uma insígnia que gira parece um carregando. -->
  <style>
    /* O FLOREIO SE ESCREVE. O stroke-dasharray do tamanho do traco
       e o dashoffset indo a zero: a tinta aparece como se a pena
       estivesse assinando agora. Uma vez, e fica. */
    .pp-floreio path {
      stroke-dasharray: 420;
      stroke-dashoffset: 420;
      animation: pp-escrever 2.4s cubic-bezier(.32,.9,.36,1) .35s forwards;
    }
    .pp-floreio path:nth-child(2) { animation-delay: 1.1s; animation-duration: 1.8s; }
    @keyframes pp-escrever { to { stroke-dashoffset: 0; } }

    /* A GOTA se forma no bico e cai. É o que dá vida ao objeto sem
       animar o objeto — a pena fica parada, a tinta é que anda. */
    .pp-gota {
      transform-origin: 88px 245px;
      animation: pp-pingar 3.6s ease-in-out 1.2s infinite;
    }
    @keyframes pp-pingar {
      0%, 55%  { transform: translateY(0) scale(.5); opacity: .35; }
      70%      { transform: translateY(0) scale(1);  opacity: 1; }
      100%     { transform: translateY(14px) scale(.3); opacity: 0; }
    }
    .pp-gotas circle {
      animation: pp-cair 4.2s ease-in infinite;
    }
    @keyframes pp-cair {
      0%       { opacity: 0;   transform: translateY(0); }
      12%      { opacity: .85; }
      100%     { opacity: 0;   transform: translateY(20px); }
    }

    /* A BRASA respira. Lenta — 5,5s — porque ela é ambiente, não
       evento. Rápida, viraria pulso de alerta. */
    .pp-brasa { animation: pp-respirar 5.5s ease-in-out infinite; transform-origin: 140px 132px; }
    @keyframes pp-respirar {
      0%, 100% { opacity: .55; transform: scale(1); }
      50%      { opacity: .95; transform: scale(1.06); }
    }

    /* A GEMA tem UM brilho, discreto. Ela é o ponto de foco depois da
       silhueta — não pode competir com ela. */
    .pp-gema { animation: pp-gema 3.2s ease-in-out infinite; }
    @keyframes pp-gema {
      0%, 100% { filter: drop-shadow(0 0 3px #ff0a3c); }
      50%      { filter: drop-shadow(0 0 9px #ff0a3c); }
    }

    @media (prefers-reduced-motion: reduce) {
      .pp-floreio path { stroke-dashoffset: 0; animation: none; }
      .pp-gota, .pp-gotas circle, .pp-brasa, .pp-gema { animation: none; }
      .pp-gotas circle { opacity: .5; }
    }
  </style>

  <!-- ── O FUNDO ──────────────────────────────────────────
       Discreto de propósito. O erro da versão anterior foi um fundo
       que competia: anel girando, dezoito marcas, halo pulsante. -->
  <circle cx="130" cy="130" r="122" fill="url(#${id}-fundo)"/>
  <circle cx="130" cy="130" r="122" fill="none" stroke="#2a1a2e" stroke-width="1.5"/>
  <circle cx="130" cy="130" r="112" fill="none" stroke="#ff0a3c"
          stroke-opacity=".22" stroke-width="1" stroke-dasharray="1 7"/>
  <circle cx="130" cy="130" r="104" fill="none" stroke="#2b6bff"
          stroke-opacity=".16" stroke-width="1"/>

  <!-- O calor por trás da pena. UM só: dois halos brigam entre si. -->
  <ellipse cx="140" cy="132" rx="84" ry="92" fill="url(#${id}-brasa)"
           filter="url(#${id}-suave)" class="pp-brasa"/>

  <!-- ── O FLOREIO ────────────────────────────────────────
       O traço de tinta da referência: sai do bico, corre para a
       esquerda e fecha em espiral. Desenhado progressivamente, como
       se estivesse sendo escrito agora — é a única animação de que
       esta insígnia precisava. -->
  <g class="pp-floreio">
    <path d="M92 232 C 70 244, 42 240, 34 222 C 27 207, 42 193, 56 199
             C 70 205, 68 226, 50 234 C 36 240, 20 236, 12 224"
          stroke="url(#${id}-tinta)" stroke-width="3.4" fill="none"
          stroke-linecap="round" filter="url(#${id}-brilho)"/>
    <path d="M100 236 C 124 248, 158 246, 186 232"
          stroke="url(#${id}-tinta)" stroke-width="2" fill="none"
          stroke-linecap="round" opacity=".6"/>
  </g>

  <!-- ── A PENA ───────────────────────────────────────────
       Barbas primeiro, raque por cima: é a ordem que faz o eixo
       parecer estar SOBRE a pluma, e não riscado nela. -->
  <g class="pp-pena">
    <g class="pp-barbas">${inf}${sup}</g>
    ${this._veios(id)}

    <path d="M96 214 C 104 150, 140 96, 196 54"
          stroke="url(#${id}-raque)" stroke-width="4.2" fill="none"
          stroke-linecap="round"/>
    <path d="M96 214 C 104 150, 140 96, 196 54"
          stroke="#fff" stroke-opacity=".5" stroke-width="1.1" fill="none"
          stroke-linecap="round"/>

    <!-- A HASTE desce da raque até o bico: mais grossa, sem barbas. -->
    <path d="M96 214 L 90 228" stroke="url(#${id}-raque)" stroke-width="6"
          fill="none" stroke-linecap="round" opacity=".92"/>

    <!-- ── O BICO ────────────────────────────────────────
         Nib de caneta-tinteiro: dois lados convergindo, fenda central
         e furo de respiro. É o detalhe que transforma "pluma" em
         "instrumento de escrever" — e ele faltava na referência
         anterior. -->
    <g class="pp-nib">
      <path d="M95 224 L 88 244 L 79 230 Z" fill="url(#${id}-nib)"/>
      <path d="M95 224 L 88 244 L 79 230 Z" fill="none" stroke="#e8eef7"
            stroke-opacity=".45" stroke-width=".8"/>
      <path d="M89.5 227 L 87.6 242" stroke="#05070c" stroke-width="1.4"
            stroke-linecap="round"/>
      <circle cx="89.8" cy="228.5" r="1.9" fill="#05070c"/>
      <circle cx="88" cy="245.5" r="2.6" fill="#ff0a3c" class="pp-gota"/>
    </g>

    <!-- A GEMA na junção — UMA, pequena, onde a mão seguraria. Na
         versão anterior ela era enorme e no meio da pluma: lia como
         um botão colado. -->
    <g class="pp-gema" transform="translate(99 209)">
      <circle r="7.5" fill="#2b0710"/>
      <path d="M0 -6 L5.2 0 L0 6 L-5.2 0 Z" fill="#ff0a3c"/>
      <path d="M0 -6 L5.2 0 L0 0 Z" fill="#ff6b8a" opacity=".8"/>
      <circle r="7.5" fill="none" stroke="#ffb3c4" stroke-opacity=".5" stroke-width="1"/>
    </g>
  </g>

  <!-- ── AS GOTAS ─────────────────────────────────────────
       SEIS, não vinte e duas. Elas caem do bico e somem. Vinte e duas
       viravam chuva, e chuva esconde o objeto. -->
  <g class="pp-gotas">
    ${[0, 1, 2, 3, 4, 5].map(i => `<circle cx="${82 + i * 4}" cy="250" r="${(1.6 - i * .12).toFixed(2)}" fill="#ff0a3c" opacity="0" style="animation-delay:${(i * .7).toFixed(2)}s"/>`).join('')}
  </g>
</svg>`;
  },

  /* A cerimônia. O renderizador único do projeto cuida do resto —
     esta função existe para a Forja poder disparar a insígnia. */
  celebrar() {
    if (typeof ConquistaFX === 'undefined') return;
    ConquistaFX.show({
      codigo:    'pena_do_punidor',
      titulo:    'Pena do Punidor',
      descricao: 'Forjada pelo Arquiteto que escreveu as leis de ferro do '
               + 'Sistema — cada traço desta pena é uma sentença inapelável',
      icone:     '✒',
      cor:       '#ff0a3c',
      xp_bonus:  7777,
      moedas_bonus: 777,
    });
  },
};

window.PenaPunidorFX = PenaPunidorFX;

/* Inscrição no renderizador único do sistema */
window.ConquistaFX?.registrarInsignia?.(
  'pena_do_punidor', tam => PenaPunidorFX._svgMedalha(tam));
