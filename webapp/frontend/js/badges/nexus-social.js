/* ============================================================
   nexus-social.js — Insígnia "Nexus Social"

   Premia a implementação do sistema de Rede Social, Chat e
   Lista de Amigos. Azul gélido com transparências de cristal
   de gelo. Simetria absoluta por construção (mesma técnica do
   cristal Jh3ffth: facetas com brilho = |cos(ângulo ao topo)|).

   Paleta: azul glacial → ciano profundo → branco névoa
   Movimentos: 80s lâminas, 100s runas (lentos, dignos)
   ============================================================ */

const NexusSocialArte = {

  _svgMedalhaNexus(tamanho = 260) {
    const t = tamanho;
    const C = 130;
    const pol = (r, n, giro = -90) => Array.from({length: n}, (_, i) => {
      const a = (giro + (360 / n) * i) * Math.PI / 180;
      return [C + r * Math.cos(a), C + r * Math.sin(a)];
    });

    /* ── Lâminas externas: 12 estilhaços de gelo ── */
    const laminas = [];
    for (let i = 0; i < 12; i++) {
      const ang = 30 * i;
      const a = i % 2 === 0 ? 126 : 98;
      const w = i % 2 === 0 ? 19 : 12;
      const base = C - 74, ponta = C - a, ombro = base - (base - ponta) * 0.30;

      const noEixo = (ang % 180 === 0);
      const esq = noEixo ? 'nxFaceClara' : (ang < 180 ? 'nxFaceClara' : 'nxFaceEscura');
      const dir = noEixo ? 'nxFaceClara' : (ang < 180 ? 'nxFaceEscura' : 'nxFaceClara');

      laminas.push(`<g transform="rotate(${ang} ${C} ${C})">
        <polygon points="130,${base} ${130 - w},${ombro} 130,${ponta}"
                 fill="url(#${esq})"/>
        <polygon points="130,${base} ${130 + w},${ombro} 130,${ponta}"
                 fill="url(#${dir})"/>
        <path d="M 130 ${base} L ${130 - w} ${ombro} L 130 ${ponta}
                 L ${130 + w} ${ombro} Z"
              fill="none" stroke="#bfdbfe" stroke-width=".9" stroke-opacity=".6"/>
        <path d="M 130 ${base} L 130 ${ponta}" stroke="#dbeafe"
              stroke-width=".8" stroke-opacity=".5"/>
      </g>`);
    }

    /* ── Runas do aro: 36 traços gélidos ── */
    const runas = [];
    for (let i = 0; i < 36; i++) {
      const a = (Math.PI / 18) * i;
      const r2 = i % 3 === 0 ? 62 : 66;
      runas.push(`M ${C + 72 * Math.cos(a)} ${C + 72 * Math.sin(a)}
                  L ${C + r2 * Math.cos(a)} ${C + r2 * Math.sin(a)}`);
    }

    /* ── Gema de safira glacial: 12 facetas com brilho simétrico ── */
    const v = pol(58, 12);
    const facetas = v.map((p, i) => {
      const q = v[(i + 1) % 12];
      const meio = (30 * i + 15 - 90) * Math.PI / 180;
      const luz = Math.max(0, Math.cos(meio + Math.PI / 2));
      const op = (0.06 + 0.32 * luz).toFixed(3);
      const sombra = (0.36 * (1 - luz)).toFixed(3);
      return `<polygon points="${C},${C} ${p[0].toFixed(1)},${p[1].toFixed(1)} ${q[0].toFixed(1)},${q[1].toFixed(1)}"
                fill="#ffffff" fill-opacity="${op}"/>
              <polygon points="${C},${C} ${p[0].toFixed(1)},${p[1].toFixed(1)} ${q[0].toFixed(1)},${q[1].toFixed(1)}"
                fill="#0c1929" fill-opacity="${sombra}"/>`;
    }).join('');
    const arestas = v.map(p => `M ${C} ${C} L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    const pts = r => pol(r, 12).map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

    /* ── Glifo central: 6 nós interconectados (rede social) ── */
    const nos = pol(20, 6);
    const linhasNo = [];
    for (let i = 0; i < 6; i++) {
      for (let j = i + 1; j < 6; j++) {
        if (j - i <= 2 || j - i >= 4) {
          linhasNo.push(`M ${nos[i][0].toFixed(1)} ${nos[i][1].toFixed(1)} L ${nos[j][0].toFixed(1)} ${nos[j][1].toFixed(1)}`);
        }
      }
    }
    const nosCirculos = nos.map(p =>
      `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="#e0f2fe" stroke="#38bdf8" stroke-width="1"/>`
    ).join('');

    /* ── Fio de brilho orbital (filete girante) ── */
    const fileteR = 82;
    const circunf = 2 * Math.PI * fileteR;

    return `
    <svg viewBox="0 0 260 260" width="${t}" height="${t}" class="cq-svg"
         style="overflow:visible;max-width:none;width:${t}px;height:${t}px">
      <style>
        .nx-laminas { transform-origin: 130px 130px; animation: nx-girar 80s linear infinite; }
        .nx-runas   { transform-origin: 130px 130px; animation: nx-girar 100s linear infinite reverse; }
        .nx-filete  { transform-origin: 130px 130px; animation: nx-girar 3.2s linear infinite; }
        @keyframes nx-girar { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          .nx-laminas, .nx-runas, .nx-filete { animation: none; }
        }
      </style>
      <defs>
        <linearGradient id="nxFaceClara" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stop-color="#e0f2fe"/>
          <stop offset="25%" stop-color="#38bdf8"/>
          <stop offset="70%" stop-color="#0369a1"/>
          <stop offset="100%" stop-color="#082f49"/>
        </linearGradient>
        <linearGradient id="nxFaceEscura" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stop-color="#7dd3fc"/>
          <stop offset="25%" stop-color="#0284c7"/>
          <stop offset="70%" stop-color="#0c4a6e"/>
          <stop offset="100%" stop-color="#041726"/>
        </linearGradient>
        <radialGradient id="nxMoldura" cx="50%" cy="26%">
          <stop offset="0%" stop-color="#334155"/>
          <stop offset="38%" stop-color="#0f172a"/>
          <stop offset="78%" stop-color="#0c4a6e"/>
          <stop offset="100%" stop-color="#000"/>
        </radialGradient>
        <radialGradient id="nxGema" cx="50%" cy="30%">
          <stop offset="0%" stop-color="#e0f2fe"/>
          <stop offset="20%" stop-color="#38bdf8"/>
          <stop offset="55%" stop-color="#0284c7"/>
          <stop offset="82%" stop-color="#075985"/>
          <stop offset="100%" stop-color="#082f49"/>
        </radialGradient>
        <radialGradient id="nxMesa" cx="50%" cy="32%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="35%" stop-color="#bae6fd"/>
          <stop offset="75%" stop-color="#0ea5e9"/>
          <stop offset="100%" stop-color="#0369a1"/>
        </radialGradient>
        <linearGradient id="nxFio" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stop-color="#bae6fd"/>
          <stop offset="50%" stop-color="#0284c7"/>
          <stop offset="100%" stop-color="#082f49"/>
        </linearGradient>
        <filter id="nxGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="nxSombra" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#000" flood-opacity=".9"/>
          <feDropShadow dx="0" dy="0" stdDeviation="20" flood-color="#0ea5e9" flood-opacity=".45"/>
        </filter>
      </defs>

      <g filter="url(#nxSombra)">
        <!-- Lâminas de gelo girantes -->
        <g class="nx-laminas" filter="url(#nxGlow)">${laminas.join('')}</g>

        <!-- Moldura dodecagonal -->
        <polygon points="${pts(80)}" fill="url(#nxMoldura)" stroke="url(#nxFio)" stroke-width="2.5"/>

        <!-- Runas glaciais (giro reverso) -->
        <g class="nx-runas">
          <path d="${runas.join(' ')}" stroke="#38bdf8" stroke-width="1.6" stroke-opacity=".85"/>
        </g>

        <!-- Filete de brilho orbital -->
        <g class="nx-filete">
          <circle cx="${C}" cy="${C}" r="${fileteR}" fill="none"
                  stroke="#e0f2fe" stroke-width="2.5" stroke-opacity=".9"
                  stroke-dasharray="${(circunf * 0.08).toFixed(1)} ${(circunf * 0.92).toFixed(1)}"
                  stroke-linecap="round"/>
        </g>

        <!-- Anel interno -->
        <polygon points="${pts(64)}" fill="#040e1a" stroke="url(#nxFio)" stroke-width="1.6"/>

        <!-- Gema de safira -->
        <polygon points="${pts(58)}" fill="url(#nxGema)"/>
        ${facetas}
        <path d="${arestas}" stroke="#7dd3fc" stroke-width=".7" stroke-opacity=".45" fill="none"/>
        <polygon points="${pts(58)}" fill="none" stroke="#bae6fd" stroke-width="1.4" stroke-opacity=".8"/>

        <!-- Mesa central -->
        <polygon points="${pts(24)}" fill="url(#nxMesa)" filter="url(#nxGlow)"/>
        <polygon points="${pts(24)}" fill="none" stroke="#fff" stroke-width="1" stroke-opacity=".9"/>

        <!-- Glifo central: rede de nós interconectados -->
        <path d="${linhasNo.join(' ')}" stroke="#7dd3fc" stroke-width="1.2" stroke-opacity=".7" fill="none" filter="url(#nxGlow)"/>
        ${nosCirculos}

        <!-- Clarão central (ponto fixo de leitura) -->
        <circle cx="${C}" cy="${C}" r="5" fill="#fff" fill-opacity=".7" filter="url(#nxGlow)"/>
      </g>
    </svg>`;
  }
};

window.NexusSocialArte = NexusSocialArte;

/* Registra a insígnia no sistema de conquistas */
window.ConquistaFX?.registrarInsignia?.(
  'nexus-social', tam => NexusSocialArte._svgMedalhaNexus(tam));
