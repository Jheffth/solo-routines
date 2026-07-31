/* ============================================================
   pena-do-punidor.js — Insígnia "Pena do Punidor"
   Padrão S-Rank (Fable5) — Arquitetura exclusiva Solo Rotinas

   CONCEITO    : Uma pena de cálamo escultórica, fina e afiada
                 como uma lâmina, com nervuras de sangue rubro
                 percorrendo cada barba. Representa o poder de
                 legislar, punir e manter a ordem no sistema.

   SILHUETA    : Pena longa diagonal (45°), haste de nanquim,
                 barbas externas escuras com veios carmesim,
                 barbas internas em cinza aço iluminado.
   BICO        : Ponta de pena estilográfica (nib) metálica com
                 fenda central — a marca que registra as leis.
   ARABESCOS   : Scroll ink — curvas que saem da ponta da caneta,
                 simulando a assinatura da sentença.
   GEM         : Olho-de-dragão vermelho na junção da haste,
                 facetado, pulsando como um coração de sangue.
   PARTÍCULAS  : 22 gotículas de tinta negra e carmesim que caem
                 e evaporam em torno da pena.

   PALETA      :
     Haste/Cálamo : #1a1a2e → #2d1b3d (nanquim profundo)
     Barbas ext.  : #2c1810 → #6b2424 (brasa escura)
     Veios/Nervuras: #c0392b → #e74c3c (carmesim vivo)
     Barbas int.  : #8b9dc3 → #d4dde8 (aço frio iluminado)
     Nib metálico : #556070 → #a8b8c8 (chumbo polido)
     Gema         : #ff0033 → #8b0000 (rubi de sangue)
     Scroll ink   : #c0392b (assinatura carmesim)
   ============================================================ */

const PenaPunidorFX = {

  _pt(r, deg, cx = 130, cy = 130) {
    const a = (deg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  },

  _svgMedalha(tamanho = 260) {
    const C = 130;

    /* ── 1. Halo orbital de fundo (anel de sentenças) ── */
    const aroR = 96;
    const aroC = 2 * Math.PI * aroR;

    // 18 traços como marcas de tinta em volta
    const marcas = Array.from({ length: 18 }, (_, i) => {
      const ang = i * 20;
      const [x1, y1] = this._pt(86, ang);
      const [x2, y2] = this._pt(94, ang);
      const comprido = i % 3 === 0;
      const [x3, y3] = this._pt(comprido ? 98 : 90, ang);
      return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}"
                    x2="${x3.toFixed(2)}" y2="${y3.toFixed(2)}"
                    stroke="#c0392b" stroke-width="${comprido ? 1.8 : 1}"
                    stroke-opacity="${comprido ? 0.7 : 0.35}"
                    stroke-linecap="round"/>`;
    }).join('');

    /* ── 2. Partículas: gotículas de tinta carmesim e negra ── */
    const particulas = Array.from({ length: 22 }, (_, i) => {
      // Concentradas ao redor do bico (canto inferior esquerdo) e ao longo da haste
      const ang = (i * 16.36 + (i % 5) * 11) % 360;
      const r = 52 + (i % 6) * 14 + (i % 2) * 6;
      const sz = 1.5 + (i % 4) * 0.65;
      const [cx, cy] = this._pt(r, ang, 130, 130);

      const carmesim = i % 3 !== 0;
      const cor = carmesim ? '#e74c3c' : '#1a0a0a';
      const corHalo = carmesim ? '#8b0000' : '#2d1b3d';
      const op = i % 3 === 0 ? '.9' : (i % 2 === 0 ? '.7' : '.5');
      const delay = (i * 0.19).toFixed(2);
      const dur = (2.4 + (i % 4) * 0.5).toFixed(2);

      return `
      <g class="pnp-gota-item" style="animation-delay:${delay}s;animation-duration:${dur}s">
        <circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${sz.toFixed(2)}"
                fill="${cor}" fill-opacity="${op}" filter="url(#pnpGlowMini)"/>
        <circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(sz * 1.9).toFixed(2)}"
                fill="${corHalo}" fill-opacity="${(parseFloat(op) * 0.4).toFixed(2)}"
                filter="url(#pnpGlowMini)"/>
      </g>`;
    }).join('');

    /* ── 3. GEOMETRIA DA PENA ──────────────────────────────
       A pena é desenhada em coordenadas locais (viewBox 260x260),
       inclinada a ~-45° em torno do centro.
       Haste: linha central diagonal de (72,60) a (188,196)
       Bico (nib): extremo inferior esquerdo afilado
       Cálamo: extremo superior direito mais largo
    ─────────────────────────────────────────────────────── */

    // Haste central (cálamo escuro, fino e longo)
    const haste = `M 188,72 C 180,80 155,105 130,130 C 110,150 90,168 72,188`;

    // Barbas externas (lado esquerdo da pena — mais largas, mais escuras)
    // Geradas como uma série de linhas diagonais saindo da haste
    const barbasExt = Array.from({ length: 14 }, (_, i) => {
      const t = i / 13; // 0 a 1 ao longo da pena
      // Ponto de inserção na haste (interpolação linear)
      const hx = 188 - t * (188 - 72);
      const hy = 72 + t * (188 - 72);
      // Ponta da barba (perpendicular à haste, lado esquerdo)
      const px = hx - (18 + i * 3.5) * Math.cos(Math.PI / 4 + 0.15);
      const py = hy + (18 + i * 3.5) * Math.sin(Math.PI / 4 + 0.15);
      const op = 0.55 + t * 0.30;
      const sw = 1.2 + t * 0.8;
      return `<line x1="${hx.toFixed(1)}" y1="${hy.toFixed(1)}"
                    x2="${px.toFixed(1)}" y2="${py.toFixed(1)}"
                    stroke="url(#pnpBarbaExt)" stroke-width="${sw.toFixed(1)}"
                    stroke-opacity="${op.toFixed(2)}" stroke-linecap="round"/>`;
    }).join('');

    // Barbas internas (lado direito da pena — mais claras, aço iluminado)
    const barbasInt = Array.from({ length: 14 }, (_, i) => {
      const t = i / 13;
      const hx = 188 - t * (188 - 72);
      const hy = 72 + t * (188 - 72);
      const px = hx + (14 + i * 2.8) * Math.cos(Math.PI / 4 - 0.15);
      const py = hy - (14 + i * 2.8) * Math.sin(Math.PI / 4 - 0.15);
      const op = 0.50 + t * 0.35;
      const sw = 1.0 + t * 0.6;
      return `<line x1="${hx.toFixed(1)}" y1="${hy.toFixed(1)}"
                    x2="${px.toFixed(1)}" y2="${py.toFixed(1)}"
                    stroke="url(#pnpBarbaInt)" stroke-width="${sw.toFixed(1)}"
                    stroke-opacity="${op.toFixed(2)}" stroke-linecap="round"/>`;
    }).join('');

    // Veios carmesim (nervuras de sangue que correm pelas barbas)
    const veios = Array.from({ length: 7 }, (_, i) => {
      const t = (i + 1) / 9;
      const hx = 188 - t * (188 - 72);
      const hy = 72 + t * (188 - 72);
      const ex = hx - (8 + i * 4) * Math.cos(Math.PI / 4 + 0.15);
      const ey = hy + (8 + i * 4) * Math.sin(Math.PI / 4 + 0.15);
      return `<line x1="${hx.toFixed(1)}" y1="${hy.toFixed(1)}"
                    x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}"
                    stroke="#c0392b" stroke-width="0.9"
                    stroke-opacity="0.85" stroke-linecap="round"/>`;
    }).join('');

    // Contorno externo da pena (silhueta completa)
    const silueta = `
      M 188,72
      C 182,68 176,65 170,66
      C 148,70 122,90 102,108
      C 88,122 78,136 72,148
      L 68,188
      C 72,184 76,178 80,172
      C 90,158 104,146 118,136
      C 140,118 165,98 188,72 Z`;

    // Silueta interna (brilho interno da pena)
    const siluetaInt = `
      M 185,78
      C 178,74 172,72 166,74
      C 148,80 124,98 106,116
      C 96,126 86,140 82,152
      L 80,172
      C 84,165 92,155 102,146
      C 122,128 148,108 172,88
      C 178,83 182,80 185,78 Z`;

    /* ── 4. Bico estilográfico (nib metálico com fenda) ── */
    // Triângulo afilado na ponta inferior esquerda
    const nib = `M 72,188 L 64,196 L 78,192 Z`;
    const nibFenda = `M 70,190 L 68,193`; // fenda central do nib
    // Sombra reflexiva do nib (canto polido)
    const nibBrilho = `M 74,188 L 70,192 L 75,191 Z`;

    /* ── 5. Scroll ink — curvas da assinatura saindo do bico ── */
    const scroll = `
      M 64,196
      C 58,204 55,214 58,222
      C 60,228 66,230 72,228
      C 78,226 80,218 76,212
      C 73,208 68,208 66,212
      C 64,215 65,220 68,221`;

    /* ── 6. Gema olho-de-dragão (na junção da haste com as barbas) ── */
    // Hexágono facetado vermelho sangue no centro da pena
    const gema = `M 130,118 L 138,124 L 138,136 L 130,142 L 122,136 L 122,124 Z`;
    const gemaBrilho = `M 130,118 L 138,124 L 130,128 L 122,124 Z`;
    const gemaFenda = `M 130,118 L 130,142`; // fenda vertical da gema
    // Pupila vertical (olho reptiliano)
    const gemaPupila = `M 130,122 L 130,138`;

    return `
    <svg viewBox="0 0 260 260" width="${tamanho}" height="${tamanho}" class="cq-svg"
         style="overflow:visible;max-width:none;width:${tamanho}px;height:${tamanho}px">
      <style>
        .pnp-roda   { transform-origin: 130px 130px; animation: pnp-spin 40s linear infinite; }
        .pnp-cometa { transform-origin: 130px 130px; animation: pnp-spin 4s linear infinite; }
        .pnp-gema   { transform-origin: 130px 130px; animation: pnp-pulso 2.8s ease-in-out infinite; }
        .pnp-gota-item {
          transform-origin: 130px 130px;
          animation: pnp-gota 2.4s ease-in-out infinite alternate;
        }
        @keyframes pnp-spin { to { transform: rotate(360deg); } }
        @keyframes pnp-pulso {
          0%,100% { transform: scale(1);    filter: drop-shadow(0 0 6px rgba(192,57,43,0.9)); }
          50%     { transform: scale(1.10); filter: drop-shadow(0 0 14px rgba(231,76,60,1)); }
        }
        @keyframes pnp-gota {
          0%   { transform: scale(0.75) translate(0, 0);  opacity: 0.4; }
          50%  { transform: scale(1.15) translate(0,-4px); opacity: 1; }
          100% { transform: scale(0.85) translate(0,-2px); opacity: 0.6; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pnp-roda,.pnp-cometa,.pnp-gema,.pnp-gota-item { animation: none !important; }
        }
      </style>
      <defs>
        <!-- Gradientes da Pena -->
        <linearGradient id="pnpHaste" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="#3d2060"/>
          <stop offset="50%"  stop-color="#1a1a2e"/>
          <stop offset="100%" stop-color="#0d0d1a"/>
        </linearGradient>

        <linearGradient id="pnpBarbaExt" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stop-color="#6b2424"/>
          <stop offset="50%"  stop-color="#3d1010"/>
          <stop offset="100%" stop-color="#1a0808"/>
        </linearGradient>

        <linearGradient id="pnpBarbaInt" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%"   stop-color="#d4dde8"/>
          <stop offset="50%"  stop-color="#8b9dc3"/>
          <stop offset="100%" stop-color="#556070"/>
        </linearGradient>

        <linearGradient id="pnpSilueta" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stop-color="#2d1b3d" stop-opacity="0.95"/>
          <stop offset="40%"  stop-color="#1a1a2e" stop-opacity="0.90"/>
          <stop offset="100%" stop-color="#0d0d1a" stop-opacity="0.85"/>
        </linearGradient>

        <linearGradient id="pnpNib" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stop-color="#a8b8c8"/>
          <stop offset="50%"  stop-color="#6a7a8a"/>
          <stop offset="100%" stop-color="#3a4a5a"/>
        </linearGradient>

        <!-- Gema olho-de-dragão -->
        <radialGradient id="pnpGema" cx="40%" cy="30%">
          <stop offset="0%"   stop-color="#ff6666"/>
          <stop offset="25%"  stop-color="#cc0000"/>
          <stop offset="60%"  stop-color="#8b0000"/>
          <stop offset="100%" stop-color="#3d0000"/>
        </radialGradient>

        <!-- Filtros -->
        <filter id="pnpGlowMini" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="2.2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="pnpGlowGema" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="pnpAura" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="8"  stdDeviation="10" flood-color="#000"     flood-opacity=".95"/>
          <feDropShadow dx="0" dy="0"  stdDeviation="20" flood-color="#8b0000"  flood-opacity=".70"/>
          <feDropShadow dx="0" dy="0"  stdDeviation="40" flood-color="#c0392b"  flood-opacity=".45"/>
          <feDropShadow dx="0" dy="-4" stdDeviation="25" flood-color="#2d1b3d"  flood-opacity=".50"/>
        </filter>
        <filter id="pnpGlowScroll" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <g filter="url(#pnpAura)">

        <!-- ── CAMADA 0: ARO ORBITAL DE SENTENÇAS (FUNDO) ── -->
        <g class="pnp-roda">
          <circle cx="${C}" cy="${C}" r="${aroR}" fill="none"
                  stroke="#8b0000" stroke-width="1.8" stroke-opacity=".45"/>
          <circle cx="${C}" cy="${C}" r="${aroR - 10}" fill="none"
                  stroke="#c0392b" stroke-width="0.8"
                  stroke-dasharray="5 7" stroke-opacity=".30"/>
          ${marcas}
        </g>

        <!-- Cometa de tinta orbital -->
        <g class="pnp-cometa">
          <circle cx="${C}" cy="${C}" r="${aroR}" fill="none"
                  stroke="#e74c3c" stroke-width="2.4"
                  stroke-dasharray="${(aroC * 0.08).toFixed(1)} ${(aroC * 0.92).toFixed(1)}"
                  stroke-linecap="round" filter="url(#pnpGlowMini)"/>
        </g>

        <!-- ── CAMADA 1: SILUETA DA PENA (BASE ESCURA) ── -->
        <path d="${silueta}" fill="url(#pnpSilueta)" stroke="#6b2424" stroke-width="1.2"/>

        <!-- ── CAMADA 2: BARBAS EXTERNAS (ESCURAS, SANGUE) ── -->
        ${barbasExt}

        <!-- Veios carmesim (nervuras de sangue) -->
        ${veios}

        <!-- ── CAMADA 3: BARBAS INTERNAS (AÇO FRIO ILUMINADO) ── -->
        ${barbasInt}

        <!-- Brilho interno da pena -->
        <path d="${siluetaInt}" fill="#d4dde8" fill-opacity="0.08"/>

        <!-- ── CAMADA 4: HASTE CENTRAL (CÁLAMO / NANQUIM) ── -->
        <path d="${haste}" fill="none"
              stroke="url(#pnpHaste)" stroke-width="3.5"
              stroke-linecap="round" stroke-linejoin="round"/>
        <!-- Brilho fino na haste -->
        <path d="${haste}" fill="none"
              stroke="#a8b8c8" stroke-width="0.8"
              stroke-opacity="0.45" stroke-linecap="round"/>

        <!-- ── CAMADA 5: NIB ESTILOGRÁFICO (METÁLICO) ── -->
        <path d="${nib}" fill="url(#pnpNib)" stroke="#c8d8e8" stroke-width="1.2"/>
        <path d="${nibBrilho}" fill="#e8f0f8" fill-opacity="0.6"/>
        <path d="${nibFenda}" fill="none"
              stroke="#2a3a4a" stroke-width="0.8" stroke-linecap="round"/>

        <!-- ── CAMADA 6: SCROLL INK (ASSINATURA DA SENTENÇA) ── -->
        <path d="${scroll}" fill="none"
              stroke="#c0392b" stroke-width="1.6"
              stroke-linecap="round" stroke-linejoin="round"
              filter="url(#pnpGlowScroll)"/>
        <!-- Reflexo pálido da assinatura -->
        <path d="${scroll}" fill="none"
              stroke="#ff6666" stroke-width="0.6"
              stroke-opacity="0.45" stroke-linecap="round"/>

        <!-- ── CAMADA 7: GEMA OLHO-DE-DRAGÃO (PULSANDO) ── -->
        <g class="pnp-gema" filter="url(#pnpGlowGema)">
          <path d="${gema}" fill="url(#pnpGema)" stroke="#ff4444" stroke-width="1.4"/>
          <path d="${gemaBrilho}" fill="#ff9999" fill-opacity="0.55"/>
          <path d="${gemaFenda}" fill="none"
                stroke="#2d0000" stroke-width="1.0" stroke-opacity="0.80"/>
          <!-- Reflexo puntual (glint) -->
          <circle cx="126" cy="122" r="2.0" fill="#ffffff" fill-opacity="0.75"/>
          <!-- Pupila reptiliana -->
          <path d="${gemaPupila}" fill="none"
                stroke="#1a0000" stroke-width="1.8"
                stroke-linecap="round" stroke-opacity="0.9"/>
        </g>

        <!-- ── CAMADA 8: GOTÍCULAS DE TINTA (FRENTE) ── -->
        <g>${particulas}</g>
      </g>
    </svg>`;
  },

  cerimonia() {
    if (typeof ConquistaFX === 'undefined') return;
    ConquistaFX.show({
      codigo:    'pena_do_punidor',
      titulo:    'Pena do Punidor',
      descricao: 'Forjada pelo Arquiteto que escreveu as leis de ferro do Sistema — cada traço desta pena é uma sentença inapelável',
      icone:     '✒',
      cor:       '#c0392b',
      xp_bonus:  7777,
      moedas_bonus: 777,
    });
  },
};

window.PenaPunidorFX = PenaPunidorFX;

/* Inscrição no renderizador único do sistema */
window.ConquistaFX?.registrarInsignia?.(
  'pena_do_punidor', tam => PenaPunidorFX._svgMedalha(tam));
