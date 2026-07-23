/* ============================================================
   nexus-social.js — Insígnia "Nexus Social"

   Arte EXCLUSIVA, arquitetura completamente diferente de qualquer
   outra badge do projeto:

   SILHUETA: Hexagonal (6 lados), não dodecagonal.

   CAMADAS (de fora para dentro):
   1. 6 Torres de Sinal — stacks de 3 arcos radar em cada vértice
      do hexágono externo. Giram lentamente (90s).
   2. 18 nós de conexão no aro — pontinhos que representam
      a lista de amigos. Giram no sentido oposto (75s).
   3. 6 Nós Orbitais — hexágonos mini-safira que orbitam o
      centro a 50s. Ligados ao centro por feixes de energia.
   4. Corpo hexagonal (facetado, 6 triângulos com luminância
      real baseada em ângulo ao topo — simétrico por construção).
   5. Mesa hexagonal central.
   6. Glifo de rede: 6 raios + nós terminais, representando
      a teia social.

   IDENTIDADE: Azul gélido glacial, linhas de sinal, orbiting nodes.
   Não tem lâminas de cristal, não tem anel de runas traçadas.
   ============================================================ */

const NexusSocialArte = {

  _svgMedalhaNexus(tamanho = 260) {
    const t  = tamanho;
    const C  = 130;                           // centro do viewBox 260×260
    const r2 = d => d * Math.PI / 180;       // graus → radianos

    // Ponto a raio r, ângulo d graus (0=topo, horário)
    const pt = (r, d) => [
      C + r * Math.cos(r2(d - 90)),
      C + r * Math.sin(r2(d - 90)),
    ];

    // String de pontos para <polygon>
    const pStr = (r, n, off = 0) =>
      Array.from({length: n}, (_, i) => {
        const [x, y] = pt(r, off + (360 / n) * i);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      }).join(' ');

    /* ──────────────────────────────────────────────────────────
       1. TORRES DE SINAL (6 × 3 arcos radar)
          Cada torre fica num vértice do hexágono externo (offset 30°
          = hexágono de topo-plano). Cada grupo é desenhado como se
          a torre estivesse no topo e depois girado ao lugar.
          Os arcos abrem PARA FORA (afastando do centro).

       Matemática dos arcos (arc centered no base-dot da torre):
         raio R, spanning 100° (220°→320° em ângulo padrão SVG):
         dx = R·sin(50°)  dy = R·cos(50°)
    ────────────────────────────────────────────────────────── */
    const TB = C - 96;   // y da base da torre quando ang=0 (topo)

    //  sin(50°)=0.7660   cos(50°)=0.6428
    const arc = (R) => {
      const dx = R * 0.7660, dy = R * 0.6428;
      return `M ${(C - dx).toFixed(2)} ${(TB - dy).toFixed(2)} ` +
             `A ${R} ${R} 0 0 1 ${(C + dx).toFixed(2)} ${(TB - dy).toFixed(2)}`;
    };

    const torres = Array.from({length: 6}, (_, i) => {
      const ang = 30 + i * 60;   // 30°, 90°, 150°... (vértices do hex flat-top)
      return `<g transform="rotate(${ang} ${C} ${C})">
        <circle cx="${C}" cy="${TB}" r="3.8"
                fill="#38bdf8" fill-opacity=".95" filter="url(#nxGlow)"/>
        <path d="${arc(11)}"
              fill="none" stroke="#38bdf8" stroke-width="3"
              stroke-opacity=".9" stroke-linecap="round"/>
        <path d="${arc(18)}"
              fill="none" stroke="#7dd3fc" stroke-width="2"
              stroke-opacity=".55" stroke-linecap="round"/>
        <path d="${arc(26)}"
              fill="none" stroke="#bae6fd" stroke-width="1.4"
              stroke-opacity=".28" stroke-linecap="round"/>
      </g>`;
    }).join('');

    /* ──────────────────────────────────────────────────────────
       2. ANEL DE 18 NÓS (Lista de Amigos)
          Pontinhos no raio 78. 1 em cada 3 é maior (hunter online).
    ────────────────────────────────────────────────────────── */
    const nos18 = Array.from({length: 18}, (_, i) => {
      const [x, y] = pt(78, i * 20);
      const destaque = i % 3 === 0;
      return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}"
               r="${destaque ? 3.4 : 1.9}"
               fill="${destaque ? '#38bdf8' : '#7dd3fc'}"
               fill-opacity="${destaque ? '.92' : '.45'}"/>`;
    }).join('');

    /* ──────────────────────────────────────────────────────────
       3. FEIXES + NÓS ORBITAIS (6 hexágonos-safira em órbita)
          Raio de órbita 60. Feixes do centro a cada nó.
          Tudo dentro do grupo .nx-orbit → gira junto.
    ────────────────────────────────────────────────────────── */
    const ORB_R = 60;
    const feixes = Array.from({length: 6}, (_, i) => {
      const [x, y] = pt(ORB_R, i * 60);
      return `<line x1="${C}" y1="${C}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}"
               stroke="#38bdf8" stroke-width="1.2" stroke-opacity=".35"/>`;
    }).join('');

    const nosOrbitais = Array.from({length: 6}, (_, i) => {
      const [ox, oy] = pt(ORB_R, i * 60);
      // Mini hexágono (flat-top, offset 0°)
      const hexMiniPts = Array.from({length: 6}, (_, j) => {
        const a = r2(j * 60);
        return `${(ox + 7.5 * Math.cos(a)).toFixed(2)},${(oy + 7.5 * Math.sin(a)).toFixed(2)}`;
      }).join(' ');
      return `<polygon points="${hexMiniPts}"
               fill="#0ea5e9" fill-opacity=".85"
               stroke="#bae6fd" stroke-width="1.4"
               filter="url(#nxGlow)"/>
              <circle cx="${ox.toFixed(2)}" cy="${oy.toFixed(2)}"
               r="2.5" fill="#e0f2fe" fill-opacity=".75"/>`;
    }).join('');

    /* ──────────────────────────────────────────────────────────
       4. CORPO HEXAGONAL PRINCIPAL (flat-top, offset 30°)
          Facetas com luminância real: brilho = max(0, cos(ângulo ao topo))
    ────────────────────────────────────────────────────────── */
    const bodyPts  = pStr(84, 6, 30);   // hex externo
    const innerPts = pStr(70, 6, 30);   // anel interno
    const gemPts   = pStr(52, 6, 30);   // gema
    const mesaPts  = pStr(22, 6, 30);   // mesa central

    // 6 vértices da gema (flat-top, 30° offset)
    const vGem = Array.from({length: 6}, (_, i) => pt(52, 30 + i * 60));

    const facetas = vGem.map((p, i) => {
      const q    = vGem[(i + 1) % 6];
      // ângulo do ponto médio da faceta → padrão matemático
      const midDeg = 30 + i * 60 + 30 - 90;   // = i*60 - 30
      const luz  = Math.max(0, Math.cos(r2(midDeg) + Math.PI / 2));
      const op   = (0.06 + 0.36 * luz).toFixed(3);
      const sh   = (0.40 * (1 - luz)).toFixed(3);
      return `<polygon points="${C},${C} ${p[0].toFixed(2)},${p[1].toFixed(2)} ${q[0].toFixed(2)},${q[1].toFixed(2)}"
               fill="#ffffff" fill-opacity="${op}"/>
              <polygon points="${C},${C} ${p[0].toFixed(2)},${p[1].toFixed(2)} ${q[0].toFixed(2)},${q[1].toFixed(2)}"
               fill="#051524" fill-opacity="${sh}"/>`;
    }).join('');

    const arestas = vGem.map(p =>
      `M ${C} ${C} L ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ');

    /* ──────────────────────────────────────────────────────────
       5. FILETE ORBITAL (arco de brilho girando na borda externa)
    ────────────────────────────────────────────────────────── */
    const filR   = 85;
    const filC   = 2 * Math.PI * filR;

    /* ──────────────────────────────────────────────────────────
       6. GLIFO CENTRAL (rede: 6 raios + nós terminais)
    ────────────────────────────────────────────────────────── */
    const glifo = Array.from({length: 6}, (_, i) => {
      const [x1, y1] = pt(7,  i * 60);
      const [x2, y2] = pt(15, i * 60);
      return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}"
                    x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"
               stroke="#bae6fd" stroke-width="1.7" stroke-opacity=".9"/>
              <circle cx="${x2.toFixed(2)}" cy="${y2.toFixed(2)}"
               r="2.4" fill="#38bdf8" fill-opacity=".85"/>`;
    }).join('');

    /* ──────────────────────────────────────────────────────────
       SVG FINAL
    ────────────────────────────────────────────────────────── */
    return `
    <svg viewBox="0 0 260 260" width="${t}" height="${t}" class="cq-svg"
         style="overflow:visible;max-width:none;width:${t}px;height:${t}px">
      <style>
        .nx-towers { transform-origin:130px 130px; animation:nx-gir 90s linear infinite; }
        .nx-orbit  { transform-origin:130px 130px; animation:nx-gir 50s linear infinite; }
        .nx-dots   { transform-origin:130px 130px; animation:nx-gir 75s linear infinite reverse; }
        .nx-filete { transform-origin:130px 130px; animation:nx-gir 3.2s linear infinite; }
        @keyframes nx-gir { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          .nx-towers,.nx-orbit,.nx-dots,.nx-filete { animation:none; }
        }
      </style>
      <defs>
        <radialGradient id="nxMoldura" cx="50%" cy="28%">
          <stop offset="0%"   stop-color="#1e3a5f"/>
          <stop offset="38%"  stop-color="#0a1929"/>
          <stop offset="76%"  stop-color="#0c4a6e"/>
          <stop offset="100%" stop-color="#000305"/>
        </radialGradient>
        <radialGradient id="nxGema" cx="50%" cy="30%">
          <stop offset="0%"   stop-color="#e0f2fe"/>
          <stop offset="18%"  stop-color="#38bdf8"/>
          <stop offset="52%"  stop-color="#0284c7"/>
          <stop offset="82%"  stop-color="#075985"/>
          <stop offset="100%" stop-color="#082f49"/>
        </radialGradient>
        <radialGradient id="nxMesa" cx="50%" cy="30%">
          <stop offset="0%"   stop-color="#ffffff"/>
          <stop offset="28%"  stop-color="#bae6fd"/>
          <stop offset="68%"  stop-color="#0ea5e9"/>
          <stop offset="100%" stop-color="#0369a1"/>
        </radialGradient>
        <linearGradient id="nxFio" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%"   stop-color="#bae6fd"/>
          <stop offset="50%"  stop-color="#0284c7"/>
          <stop offset="100%" stop-color="#082f49"/>
        </linearGradient>
        <filter id="nxGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="nxSombra" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="8"  stdDeviation="10"
                        flood-color="#000" flood-opacity=".9"/>
          <feDropShadow dx="0" dy="0"  stdDeviation="24"
                        flood-color="#0ea5e9" flood-opacity=".5"/>
        </filter>
      </defs>

      <g filter="url(#nxSombra)">

        <!-- ① Torres de sinal (6 stacks radar, giram lentamente) -->
        <g class="nx-towers">${torres}</g>

        <!-- ② Corpo hexagonal principal (flat-top) -->
        <polygon points="${bodyPts}"
                 fill="url(#nxMoldura)" stroke="url(#nxFio)" stroke-width="2.5"/>

        <!-- ③ Filete de brilho orbital na borda -->
        <g class="nx-filete">
          <circle cx="${C}" cy="${C}" r="${filR}"
                  fill="none" stroke="#e0f2fe" stroke-width="2.8" stroke-opacity=".88"
                  stroke-dasharray="${(filC * 0.07).toFixed(1)} ${(filC * 0.93).toFixed(1)}"
                  stroke-linecap="round"/>
        </g>

        <!-- ④ Anel de 18 nós de amizade (contra-giram) -->
        <g class="nx-dots">${nos18}</g>

        <!-- ⑤ Anel interno hex -->
        <polygon points="${innerPts}"
                 fill="#040e1a" stroke="url(#nxFio)" stroke-width="1.5"/>

        <!-- ⑥ Feixes + nós orbitais (giram juntos) -->
        <g class="nx-orbit">
          ${feixes}
          ${nosOrbitais}
        </g>

        <!-- ⑦ Gema hexagonal facetada -->
        <polygon points="${gemPts}" fill="url(#nxGema)"/>
        ${facetas}
        <path d="${arestas}"
              stroke="#7dd3fc" stroke-width=".7" stroke-opacity=".45" fill="none"/>
        <polygon points="${gemPts}"
                 fill="none" stroke="#bae6fd" stroke-width="1.4" stroke-opacity=".8"/>

        <!-- ⑧ Mesa central -->
        <polygon points="${mesaPts}" fill="url(#nxMesa)" filter="url(#nxGlow)"/>
        <polygon points="${mesaPts}"
                 fill="none" stroke="#fff" stroke-width="1" stroke-opacity=".9"/>

        <!-- ⑨ Glifo de rede (6 raios + nós terminais) -->
        ${glifo}

        <!-- ⑩ Núcleo -->
        <circle cx="${C}" cy="${C}" r="4.5"
                fill="#fff" fill-opacity=".8" filter="url(#nxGlow)"/>

      </g>
    </svg>`;
  },
};

window.NexusSocialArte = NexusSocialArte;

/* Registra no sistema de conquistas */
window.ConquistaFX?.registrarInsignia?.(
  'nexus-social', tam => NexusSocialArte._svgMedalhaNexus(tam));
