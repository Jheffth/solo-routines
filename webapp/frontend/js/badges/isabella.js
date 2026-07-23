/* ============================================================
   isabella.js — Insígnia "Isabella Costa · Femme Fatale"

   ARQUITETURA EXCLUSIVA — completamente distinta de qualquer
   outra badge do projeto:

   SIMETRIA   : 8 dobras (octogonal) — não 6 nem 12
   SILHUETA   : 8 pétalas de rosa satin emergindo do corpo
   FILIGRANA  : 8 arcos de renda girando em contra-rotação
   ANEL       : 16 lágrimas de cristal rose (alternadas)
   GEMA OVAL  : Pérola octogonal facetada centro
   GLIFO      : Coroa de 5 pontas — elegância suprema
   CORES      : Branco acetinado · rosa claro · rose deep
                Transparências como camadas de seda

   Animações:
     - Pétalas:    70 s  direto  (suave, feminino)
     - Filigrana:  90 s  reverso (ondulante)
     - Lágrimas:   55 s  direto  (ligeiro)
   ============================================================ */

const IsabellaFX = {

  /* Gera a coordenada polar (cx=130 cy=130) */
  _pt(r, deg) {
    const a = (deg - 90) * Math.PI / 180;
    return [130 + r * Math.cos(a), 130 + r * Math.sin(a)];
  },

  /* Octógono de raio r, offset de ângulo off */
  _octo(r, off = 0) {
    return Array.from({ length: 8 }, (_, i) => {
      const [x, y] = IsabellaFX._pt(r, i * 45 + off);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
  },

  /* ─── SVG PRINCIPAL ─────────────────────────────────────── */
  _svgMedalhaIsabella(tamanho = 260) {
    const C = 130;
    const pt = IsabellaFX._pt.bind(null);

    /* ── 8 Pétalas de Rosa ── */
    const petalas = Array.from({ length: 8 }, (_, i) => {
      const ang = i * 45;
      return `
      <g transform="rotate(${ang} ${C} ${C})">
        <!-- Pétala principal -->
        <path d="M ${C},${C - 18}
                 C ${C - 16},${C - 52} ${C - 9},${C - 82} ${C},${C - 96}
                 C ${C + 9},${C - 82} ${C + 16},${C - 52} ${C},${C - 18} Z"
              fill="url(#ibPetala)" stroke="url(#ibFioPetala)"
              stroke-width="0.9" stroke-opacity=".55"/>
        <!-- Nervura central (shimmer de seda) -->
        <path d="M ${C},${C - 18} C ${C - 1},${C - 55} ${C},${C - 80} ${C},${C - 94}"
              fill="none" stroke="#ffffff" stroke-width="0.8"
              stroke-opacity=".55" stroke-linecap="round"/>
        <!-- Gota de orvalho na ponta -->
        <circle cx="${C}" cy="${C - 97}" r="2.8"
                fill="#fff" fill-opacity=".8" filter="url(#ibGlowMini)"/>
      </g>`;
    }).join('');

    /* ── 8 Arcos de Renda (entre pétalas, contra-rotação) ── */
    const filigrana = Array.from({ length: 8 }, (_, i) => {
      const ang = 22.5 + i * 45;           // entre cada duas pétalas
      const [x1, y1] = pt(38, ang - 18);
      const [xm, ym] = pt(58, ang);        // ápice do arco
      const [x2, y2] = pt(38, ang + 18);
      // Arco primário
      const arco = `M ${x1.toFixed(2)} ${y1.toFixed(2)}
                    Q ${xm.toFixed(2)} ${ym.toFixed(2)}
                      ${x2.toFixed(2)} ${y2.toFixed(2)}`;
      // Ponto decorativo no ápice
      return `
      <path d="${arco}" fill="none"
            stroke="url(#ibFioRenda)" stroke-width="1.4"
            stroke-opacity=".75" stroke-linecap="round"/>
      <circle cx="${xm.toFixed(2)}" cy="${ym.toFixed(2)}" r="2.2"
              fill="#fce4ec" fill-opacity=".7" filter="url(#ibGlowMini)"/>`;
    }).join('');

    /* ── 16 Lágrimas de Cristal (alternado: 8 grandes + 8 pequenas) ── */
    const lagrimas = Array.from({ length: 16 }, (_, i) => {
      const ang  = i * 22.5;
      const r    = i % 2 === 0 ? 103 : 85;  // grandes nas pontas, pequenas entre
      const sz   = i % 2 === 0 ? 5.2 : 3.4;
      const [cx, cy] = pt(r, ang);
      return `
      <ellipse cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}"
               rx="${(sz * 0.62).toFixed(2)}" ry="${sz.toFixed(2)}"
               transform="rotate(${ang} ${cx.toFixed(2)} ${cy.toFixed(2)})"
               fill="url(#ibLagrima)" stroke="#fce4ec"
               stroke-width=".7" stroke-opacity=".8"/>`;
    }).join('');

    /* ── Facetas da Gema Oval ── */
    const rx = 30, ry = 36;
    const gemPts = Array.from({ length: 8 }, (_, i) => {
      const a = (i * 45 - 90) * Math.PI / 180;
      return [C + rx * Math.cos(a), C + ry * Math.sin(a)];
    });
    const gemStr = gemPts.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');

    const facetas = gemPts.map((p, i) => {
      const q   = gemPts[(i + 1) % 8];
      const ang = (i * 45 + 22.5 - 90) * Math.PI / 180;
      const luz = Math.max(0, Math.cos(ang + Math.PI * 0.5));
      const op  = (0.05 + 0.42 * luz).toFixed(3);
      const sh  = (0.30 * (1 - luz)).toFixed(3);
      return `<polygon points="${C},${C} ${p[0].toFixed(2)},${p[1].toFixed(2)} ${q[0].toFixed(2)},${q[1].toFixed(2)}"
               fill="#ffffff" fill-opacity="${op}"/>
              <polygon points="${C},${C} ${p[0].toFixed(2)},${p[1].toFixed(2)} ${q[0].toFixed(2)},${q[1].toFixed(2)}"
               fill="#880e4f" fill-opacity="${sh}"/>`;
    }).join('');
    const arestas = gemPts.map(p =>
      `M ${C} ${C} L ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ');

    /* Mesa central da gema */
    const rxm = 13, rym = 16;
    const mesaStr = Array.from({ length: 8 }, (_, i) => {
      const a = (i * 45 - 90) * Math.PI / 180;
      return `${(C + rxm * Math.cos(a)).toFixed(2)},${(C + rym * Math.sin(a)).toFixed(2)}`;
    }).join(' ');

    /* ── Glifo: Coroa de 5 Pontas ── */
    const coroa = `
      <path d="M ${C - 11},${C + 4}
               L ${C - 13},${C - 5}
               L ${C - 6},${C - 1}
               L ${C},    ${C - 12}
               L ${C + 6},${C - 1}
               L ${C + 13},${C - 5}
               L ${C + 11},${C + 4} Z"
            fill="none" stroke="#fce4ec" stroke-width="1.5"
            stroke-opacity=".92" stroke-linejoin="round"/>
      <circle cx="${C - 13}" cy="${C - 6}"  r="1.8" fill="#f48fb1" fill-opacity=".95"/>
      <circle cx="${C}"      cy="${C - 13}" r="2.4" fill="#ffffff"  fill-opacity=".95"
              filter="url(#ibGlowMini)"/>
      <circle cx="${C + 13}" cy="${C - 6}"  r="1.8" fill="#f48fb1" fill-opacity=".95"/>`;

    /* ── Monta o SVG ── */
    return `
    <svg viewBox="0 0 260 260" width="${tamanho}" height="${tamanho}" class="cq-svg"
         style="overflow:visible;max-width:none;width:${tamanho}px;height:${tamanho}px">
      <style>
        .ib-petals   { transform-origin:130px 130px;
                       animation:ib-spin 70s linear infinite; }
        .ib-filigree { transform-origin:130px 130px;
                       animation:ib-spin 90s linear infinite reverse; }
        .ib-tears    { transform-origin:130px 130px;
                       animation:ib-spin 55s linear infinite; }
        @keyframes ib-spin { to { transform:rotate(360deg); } }
        @media (prefers-reduced-motion:reduce) {
          .ib-petals,.ib-filigree,.ib-tears { animation:none; }
        }
      </style>
      <defs>
        <!-- Pétala: branco -> rosa -> rose profundo -->
        <radialGradient id="ibPetala" cx="50%" cy="20%">
          <stop offset="0%"   stop-color="#fce4ec" stop-opacity=".98"/>
          <stop offset="30%"  stop-color="#f8bbd0" stop-opacity=".85"/>
          <stop offset="65%"  stop-color="#f48fb1" stop-opacity=".65"/>
          <stop offset="100%" stop-color="#c2185b" stop-opacity=".25"/>
        </radialGradient>
        <!-- Corpo octogonal -->
        <radialGradient id="ibCorpo" cx="50%" cy="28%">
          <stop offset="0%"   stop-color="#fce4ec"/>
          <stop offset="35%"  stop-color="#f8bbd0" stop-opacity=".7"/>
          <stop offset="70%"  stop-color="#880e4f" stop-opacity=".5"/>
          <stop offset="100%" stop-color="#1a0008"/>
        </radialGradient>
        <!-- Anel interno -->
        <radialGradient id="ibAnel" cx="50%" cy="28%">
          <stop offset="0%"   stop-color="#2d0015"/>
          <stop offset="60%"  stop-color="#1a0008"/>
          <stop offset="100%" stop-color="#0d0004"/>
        </radialGradient>
        <!-- Gema oval -->
        <radialGradient id="ibGema" cx="50%" cy="25%">
          <stop offset="0%"   stop-color="#ffffff"/>
          <stop offset="18%"  stop-color="#fce4ec"/>
          <stop offset="45%"  stop-color="#f48fb1"/>
          <stop offset="75%"  stop-color="#ad1457"/>
          <stop offset="100%" stop-color="#4a0020"/>
        </radialGradient>
        <!-- Mesa central da gema -->
        <radialGradient id="ibMesa" cx="50%" cy="25%">
          <stop offset="0%"   stop-color="#ffffff"/>
          <stop offset="35%"  stop-color="#fce4ec"/>
          <stop offset="70%"  stop-color="#f48fb1"/>
          <stop offset="100%" stop-color="#c2185b"/>
        </radialGradient>
        <!-- Lágrimas -->
        <radialGradient id="ibLagrima" cx="50%" cy="25%">
          <stop offset="0%"   stop-color="#ffffff"  stop-opacity=".97"/>
          <stop offset="55%"  stop-color="#fce4ec"  stop-opacity=".82"/>
          <stop offset="100%" stop-color="#f48fb1"  stop-opacity=".45"/>
        </radialGradient>
        <!-- Fios das pétalas -->
        <linearGradient id="ibFioPetala" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%"   stop-color="#ffffff"  stop-opacity=".85"/>
          <stop offset="60%"  stop-color="#f48fb1"  stop-opacity=".50"/>
          <stop offset="100%" stop-color="#880e4f"  stop-opacity=".20"/>
        </linearGradient>
        <!-- Filigrana de renda -->
        <linearGradient id="ibFioRenda" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stop-color="#fce4ec"/>
          <stop offset="100%" stop-color="#f48fb1"  stop-opacity=".35"/>
        </linearGradient>
        <!-- Glow mini (orvalho + gemas) -->
        <filter id="ibGlowMini" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="2.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <!-- Glow pétalas -->
        <filter id="ibGlowPetal" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <!-- Sombra e aura rose -->
        <filter id="ibAura" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="10" stdDeviation="12"
                        flood-color="#000" flood-opacity=".88"/>
          <feDropShadow dx="0" dy="0"  stdDeviation="20"
                        flood-color="#e91e63" flood-opacity=".55"/>
          <feDropShadow dx="0" dy="0"  stdDeviation="36"
                        flood-color="#f48fb1" flood-opacity=".25"/>
        </filter>
      </defs>

      <g filter="url(#ibAura)">
        <!-- ① Lágrimas de cristal — anel externo (giram ligeiro) -->
        <g class="ib-tears">${lagrimas}</g>

        <!-- ② Pétalas de rosa satin (giram lento) -->
        <g class="ib-petals" filter="url(#ibGlowPetal)">${petalas}</g>

        <!-- ③ Corpo octogonal -->
        <polygon points="${IsabellaFX._octo(80)}"
                 fill="url(#ibCorpo)"
                 stroke="url(#ibFioPetala)" stroke-width="2"/>

        <!-- ④ Filigrana de renda (contra-rotação) -->
        <g class="ib-filigree">${filigrana}</g>

        <!-- ⑤ Anel interno escuro -->
        <polygon points="${IsabellaFX._octo(65)}"
                 fill="url(#ibAnel)"
                 stroke="url(#ibFioPetala)" stroke-width="1.3" stroke-opacity=".55"/>

        <!-- ⑥ Gema oval facetada -->
        <polygon points="${gemStr}" fill="url(#ibGema)"/>
        ${facetas}
        <path d="${arestas}"
              stroke="#f8bbd0" stroke-width=".55" stroke-opacity=".35" fill="none"/>
        <polygon points="${gemStr}"
                 fill="none" stroke="#fce4ec" stroke-width="1.1" stroke-opacity=".82"/>

        <!-- ⑦ Mesa central -->
        <polygon points="${mesaStr}"
                 fill="url(#ibMesa)" filter="url(#ibGlowMini)"/>
        <polygon points="${mesaStr}"
                 fill="none" stroke="#fff" stroke-width=".9" stroke-opacity=".92"/>

        <!-- ⑧ Coroa de 5 pontas -->
        ${coroa}

        <!-- ⑨ Pérola central -->
        <circle cx="${C}" cy="${C}" r="4.2"
                fill="#fff" fill-opacity=".9" filter="url(#ibGlowMini)"/>
      </g>
    </svg>`;
  },
};

window.IsabellaFX = IsabellaFX;
