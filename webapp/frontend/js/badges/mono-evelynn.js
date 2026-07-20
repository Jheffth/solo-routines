/* ============================================================
   mono-evelynn.js — Insígnia "Mono Evelynn · Legado"

   Referência: Evelynn, Agony's Embrace (League of Legends).
   Paleta tirada da arte: magenta #ff2e9a, violeta #7b2cbf,
   magenta profundo #5c0f52, obsidiana #0a0714, olhos dourados
   #ffd75e e o pálido do cabelo #fbe4f2.

   REGRA DE CONSTRUÇÃO — SIMETRIA ABSOLUTA:
   toda forma aqui ou está centrada no eixo x=130, ou nasce de
   uma rotação de 45° em torno do centro, ou existe em par
   espelhado. Nada é desenhado "à mão livre" fora do eixo. Por
   isso a medalha é simétrica na vertical em qualquer tamanho —
   e isso é verificado por teste, comparando a metade esquerda
   com a direita invertida.

   Para uma badge nova no futuro, basta copiar este arquivo,
   trocar as formas e registrar no fim. Nada mais precisa mudar.
   ============================================================ */

const EvelynnFX = {

  _svgMedalhaEvelynn(tamanho = 260) {
    const C = 130;   // centro — todo o desenho gira em torno dele

    /* ── As lâminas (lashers) ────────────────────────────────
       Uma única lâmina é desenhada apontando para cima e depois
       replicada por rotação. Simetria radial de 8 pontas, que
       contém a simetria bilateral de graça. */
    const lamina = (ang, alcance, largura, classe) => {
      const topo = C - alcance;
      const ombro = C - alcance * 0.42;   // onde a lâmina é mais larga
      return `
      <path d="M 130 ${C + 4}
               C ${130 - largura} ${ombro + 26}, ${130 - largura * 0.72} ${ombro}, 130 ${topo}
               C ${130 + largura * 0.72} ${ombro}, ${130 + largura} ${ombro + 26}, 130 ${C + 4} Z"
            transform="rotate(${ang} ${C} ${C})"
            class="${classe}" fill="url(#evLamina)" stroke="#ff6ec4"
            stroke-width="1.4" stroke-opacity=".9"/>`;
    };

    // Alcance bem além do disco (r=88): as lâminas são a assinatura dela
    const laminasGrandes = [45, 135, 225, 315]
      .map(a => lamina(a, 124, 30, 'ev-lamina')).join('');
    const laminasMedias = [0, 90, 180, 270]
      .map(a => lamina(a, 104, 20, 'ev-lamina-media')).join('');

    /* ── Runas do anel — 24 traços radiais, simétricos ─────── */
    const runas = [];
    for (let i = 0; i < 24; i++) {
      const a = (Math.PI / 12) * i;
      const r1 = 86, r2 = i % 3 === 0 ? 74 : 79;
      runas.push(`M ${C + r1 * Math.cos(a)} ${C + r1 * Math.sin(a)}
                  L ${C + r2 * Math.cos(a)} ${C + r2 * Math.sin(a)}`);
    }

    /* ── Coroa de espinhos interna — 12 pontas, radial ─────── */
    const espinhos = [];
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI / 6) * i - Math.PI / 2;
      const p = (r, d) => `${C + r * Math.cos(a + d)} ${C + r * Math.sin(a + d)}`;
      espinhos.push(`M ${p(60, -0.13)} L ${p(78, 0)} L ${p(60, 0.13)} Z`);
    }

    /* ── O coração — o emblema dela, espelhado no eixo ─────── */
    const coracao = `M 130 156
      C 116 143, 100 132, 100 118
      C 100 107, 109 100, 118 100
      C 124 100, 128 103, 130 107
      C 132 103, 136 100, 142 100
      C 151 100, 160 107, 160 118
      C 160 132, 144 143, 130 156 Z`;

    /* ── Olhos dourados — par espelhado exato ──────────────── */
    const olho = (cx, s) => `
      <path d="M ${cx - 9 * s} 120 Q ${cx} 112, ${cx + 9 * s} 120
               Q ${cx} 126, ${cx - 9 * s} 120 Z"
            fill="url(#evOlho)"/>
      <ellipse cx="${cx}" cy="120" rx="1.7" ry="4.6" fill="#2b0a1e"/>`;

    return `
    <svg viewBox="0 0 260 260" width="${tamanho}" height="${tamanho}"
         style="overflow:visible" class="cq-svg">
      <defs>
        <!-- Da ponta (incandescente) para a base (sombra). Vertical no
             espaço local da lâmina, então gira junto com ela e o eixo
             de simetria se mantém. -->
        <linearGradient id="evLamina" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%"   stop-color="#fbe4f2"/>
          <stop offset="16%"  stop-color="#ff6ec4"/>
          <stop offset="42%"  stop-color="#ff2e9a"/>
          <stop offset="74%"  stop-color="#8a1668"/>
          <stop offset="100%" stop-color="#3d0a3a"/>
        </linearGradient>
        <radialGradient id="evDisco" cx="50%" cy="32%">
          <stop offset="0%"   stop-color="#3d1250"/>
          <stop offset="45%"  stop-color="#1a0b2e"/>
          <stop offset="100%" stop-color="#0a0714"/>
        </radialGradient>
        <radialGradient id="evNucleo" cx="50%" cy="30%">
          <stop offset="0%"   stop-color="#fbe4f2"/>
          <stop offset="22%"  stop-color="#ff6ec4"/>
          <stop offset="55%"  stop-color="#ff2e9a"/>
          <stop offset="85%"  stop-color="#7b2cbf"/>
          <stop offset="100%" stop-color="#3d0a3a"/>
        </radialGradient>
        <linearGradient id="evAro" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="#ff6ec4"/>
          <stop offset="50%"  stop-color="#7b2cbf"/>
          <stop offset="100%" stop-color="#ff2e9a"/>
        </linearGradient>
        <radialGradient id="evOlho" cx="50%" cy="40%">
          <stop offset="0%"   stop-color="#fff3c4"/>
          <stop offset="55%"  stop-color="#ffd75e"/>
          <stop offset="100%" stop-color="#c08a12"/>
        </radialGradient>
        <filter id="evBrilho" x="-45%" y="-45%" width="190%" height="190%">
          <feGaussianBlur stdDeviation="4.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="evSombra" x="-35%" y="-35%" width="170%" height="170%">
          <feDropShadow dx="0" dy="7" stdDeviation="6" flood-color="#000" flood-opacity=".85"/>
          <feDropShadow dx="0" dy="0" stdDeviation="16" flood-color="#ff2e9a" flood-opacity=".45"/>
        </filter>
      </defs>

      <g filter="url(#evSombra)">

        <!-- Lâminas: giram como as outras insígnias. Como o conjunto tem
             simetria radial de 8 dobras, girar não desequilibra — o eixo
             do espelho gira junto com ele. -->
        <g class="ev-lashers" filter="url(#evBrilho)">
          ${laminasGrandes}
          ${laminasMedias}
        </g>

        <!-- Disco de obsidiana -->
        <circle cx="130" cy="130" r="88" fill="url(#evDisco)"
                stroke="url(#evAro)" stroke-width="3"/>
        <circle cx="130" cy="130" r="80" fill="none"
                stroke="#ff2e9a" stroke-width="1" stroke-opacity=".45"/>

        <!-- Runas gravadas — giram ao contrário das lâminas (24 dobras,
             tão densas que o giro é imperceptível como assimetria) -->
        <path d="${runas.join(' ')}" stroke="#ff6ec4" stroke-width="1.6"
              stroke-opacity=".8" fill="none" class="ev-runas"/>

        <!-- Coroa de espinhos — terceira camada, terceira velocidade -->
        <path d="${espinhos.join(' ')}" fill="#7b2cbf" fill-opacity=".55"
              stroke="#ff2e9a" stroke-width=".8" stroke-opacity=".6"
              class="ev-espinhos"/>

        <!-- Núcleo -->
        <circle cx="130" cy="130" r="58" fill="#0a0714" fill-opacity=".9"/>
        <circle cx="130" cy="130" r="58" fill="none" stroke="url(#evAro)"
                stroke-width="2" stroke-opacity=".9"/>

        <!-- O coração de Evelynn -->
        <path d="${coracao}" fill="url(#evNucleo)" filter="url(#evBrilho)"
              stroke="#fbe4f2" stroke-width="1.6" stroke-opacity=".85"/>

        <!-- Olhos dourados, par espelhado -->
        ${olho(118, 1)}
        ${olho(142, 1)}

        <!-- Marca do Legado: par de louros espelhados abraçando o coração.
             Em cinza claro lia como arranhão; em magenta vira brilho. -->
        <path d="M 84 132 A 50 50 0 0 1 112 86" fill="none"
              stroke="#ff6ec4" stroke-width="2.6" stroke-opacity=".55"
              stroke-linecap="round"/>
        <path d="M 176 132 A 50 50 0 0 0 148 86" fill="none"
              stroke="#ff6ec4" stroke-width="2.6" stroke-opacity=".55"
              stroke-linecap="round"/>
        <circle cx="84" cy="132" r="3.2" fill="#fbe4f2" fill-opacity=".85"/>
        <circle cx="176" cy="132" r="3.2" fill="#fbe4f2" fill-opacity=".85"/>

        <!-- Brilho do aro: par espelhado que pulsa no lugar.
             Um traço girando quebraria o espelho a cada quadro. -->
        <g class="ev-pulso">
          <path d="M 130 42 A 88 88 0 0 1 192 68" fill="none" stroke="#fbe4f2"
                stroke-width="2.4" stroke-opacity=".85" stroke-linecap="round"/>
          <path d="M 130 42 A 88 88 0 0 0 68 68" fill="none" stroke="#fbe4f2"
                stroke-width="2.4" stroke-opacity=".85" stroke-linecap="round"/>
          <path d="M 130 218 A 88 88 0 0 0 192 192" fill="none" stroke="#ff6ec4"
                stroke-width="2" stroke-opacity=".6" stroke-linecap="round"/>
          <path d="M 130 218 A 88 88 0 0 1 68 192" fill="none" stroke="#ff6ec4"
                stroke-width="2" stroke-opacity=".6" stroke-linecap="round"/>
        </g>
      </g>
    </svg>`;
  },

  /* Ensaio da cerimônia — o mesmo canal das outras insígnias */
  cerimonia() {
    if (typeof ConquistaFX === 'undefined') return;
    ConquistaFX.show({
      codigo: 'mono_evelynn',
      titulo: 'Mono Evelynn',
      descricao: 'Legado — o abraço da agonia',
      icone: '💜',
      cor: '#ff2e9a',
      xp_bonus: 2500,
      moedas_bonus: 500,
    });
  },
};

window.EvelynnFX = EvelynnFX;

/* Inscrição no renderizador único: a partir daqui a arte vale na
   cerimônia, no selo, no carimbo, no perfil, no relicário, na Casa
   de Trocas e no catálogo — sem tocar em mais nenhum arquivo. */
window.ConquistaFX?.registrarInsignia?.(
  'mono_evelynn', tam => EvelynnFX._svgMedalhaEvelynn(tam));
