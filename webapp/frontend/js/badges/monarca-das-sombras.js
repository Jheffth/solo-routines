/* ============================================================
   monarca-das-sombras.js — Insígnia do Monarca das Sombras
   Padrão: Solo Routines (Cerimônia de Conquista S-Rank)
   ============================================================ */

const MonarcaDasSombrasFX = {
  _svg(tamanho = 260) {
    // 1. Estrela giratória de 12 pontas (Base Cósmica)
    const pontas = [];
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI / 6) * i - Math.PI / 2;
      const rExt = i % 2 === 0 ? 128 : 98;
      pontas.push(`M ${130 + 88 * Math.cos(a - Math.PI / 12)} ${130 + 88 * Math.sin(a - Math.PI / 12)}
                   L ${130 + rExt * Math.cos(a)} ${130 + rExt * Math.sin(a)}
                   L ${130 + 88 * Math.cos(a + Math.PI / 12)} ${130 + 88 * Math.sin(a + Math.PI / 12)} Z`);
    }

    // 2. Lâminas giratórias (Estilo adagas do Sung Jin-Woo)
    const laminas = [];
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i;
      laminas.push(`M 130 130 L ${130 + 15 * Math.cos(a - 0.2)} ${130 + 15 * Math.sin(a - 0.2)}
                    L ${130 + 130 * Math.cos(a)} ${130 + 130 * Math.sin(a)}
                    L ${130 + 15 * Math.cos(a + 0.2)} ${130 + 15 * Math.sin(a + 0.2)} Z`);
    }

    // 3. Anel de Runas Obscuras
    const runas = [];
    for (let i = 0; i < 24; i++) {
      const a = (Math.PI / 12) * i;
      const rIn = 72, rOut = 80;
      runas.push(`M ${130 + rIn * Math.cos(a)} ${130 + rIn * Math.sin(a)} L ${130 + rOut * Math.cos(a + 0.1)} ${130 + rOut * Math.sin(a + 0.1)}`);
    }

    return `
    <svg viewBox="0 0 260 260" width="${tamanho}" height="${tamanho}" style="overflow:visible" class="cq-svg">
      <defs>
        <!-- Gradientes Sombrios (Sepuries) -->
        <radialGradient id="monarcaBase" cx="38%" cy="30%">
          <stop offset="0%" stop-color="#4c1d95" /> <!-- Roxo profundo -->
          <stop offset="40%" stop-color="#312e81" /> <!-- Indigo escuro -->
          <stop offset="80%" stop-color="#0f172a" /> <!-- Quase preto -->
          <stop offset="100%" stop-color="#000000" />
        </radialGradient>
        
        <linearGradient id="monarcaLaminas" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#c084fc" /> <!-- Roxo brilhante -->
          <stop offset="50%" stop-color="#2563eb" /> <!-- Azul eletrizante -->
          <stop offset="100%" stop-color="#020617" />
        </linearGradient>

        <radialGradient id="monarcaCristal" cx="30%" cy="30%">
          <stop offset="0%" stop-color="#e879f9" /> <!-- Magenta -->
          <stop offset="50%" stop-color="#9333ea" /> <!-- Roxo médio -->
          <stop offset="100%" stop-color="#312e81" />
        </radialGradient>

        <filter id="monarcaSombra">
          <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000" flood-opacity="0.9"/>
          <feDropShadow dx="0" dy="0" stdDeviation="15" flood-color="#a855f7" flood-opacity="0.5"/>
        </filter>
      </defs>

      <g filter="url(#monarcaSombra)">
        <!-- Estrela de Fundo (Girando lentamente) -->
        <g class="cq-svg-star" style="animation-duration: 26s;">
          <path d="${pontas.join(' ')}" fill="url(#monarcaBase)" stroke="#4c1d95" stroke-width="1.5" />
        </g>

        <!-- Lâminas Sombrias (Sentido oposto) -->
        <g style="transform-origin: 130px 130px; animation: cq-anel-girar 15s linear infinite reverse;">
          <path d="${laminas.join(' ')}" fill="url(#monarcaLaminas)" stroke="#e879f9" stroke-width="1" />
        </g>

        <!-- Disco Central Escuro -->
        <circle cx="130" cy="130" r="90" fill="url(#monarcaBase)" stroke="#312e81" stroke-width="3" />

        <!-- Runas Giratórias -->
        <g style="transform-origin: 130px 130px; animation: cq-anel-girar 18s linear infinite;">
          <path d="${runas.join(' ')}" stroke="#c084fc" stroke-width="2" fill="none" opacity="0.8" />
        </g>

        <!-- Joia Hexagonal Central (Lapidada) -->
        <polygon points="130,55 195,92 195,168 130,205 65,168 65,92" fill="url(#monarcaCristal)" stroke="#e879f9" stroke-width="2"/>
        <!-- Reflexos do Cristal (Vidro) -->
        <polygon points="130,55 195,92 130,130" fill="rgba(255,255,255,0.2)"/>
        <polygon points="65,92 130,130 65,168" fill="rgba(255,255,255,0.08)"/>
        <polygon points="130,130 195,168 130,205" fill="rgba(0,0,0,0.4)"/>
        
        <!-- O Olho do Monarca (Emblema Central) -->
        <path d="M 100 130 Q 130 90 160 130 Q 130 170 100 130 Z" fill="#000" stroke="#c084fc" stroke-width="2"/>
        <circle cx="130" cy="130" r="10" fill="#e879f9" />
        
        <!-- Filete de Brilho Perpétuo na Borda Externa -->
        <circle cx="130" cy="130" r="128" fill="none" stroke="rgba(232,121,249,0.8)" stroke-width="2" stroke-dasharray="30 800" style="transform-origin:130px 130px; animation: cq-anel-girar 3s linear infinite;" />
      </g>
    </svg>`;
  },

  demo() {
    if (typeof ConquistaFX === 'undefined') return;
    ConquistaFX.show({
      id: 'monarca-das-sombras_' + Date.now(),
      titulo: 'MONARCA DAS SOMBRAS',
      descricao: 'O Domínio Completo da Escuridão e do Sistema.',
      codigo: 'monarca_das_sombras',
      xp: 50000,
      xpCor: '#e879f9',
      shimmer: 'linear-gradient(100deg, #e879f9 20%, #7c3aed 40%, #e879f9 60%, #7c3aed 80%)'
    });
  }
};

window.MonarcaDasSombrasFX = MonarcaDasSombrasFX;
window.ConquistaFX?.registrarInsignia?.('monarca_das_sombras', tam => MonarcaDasSombrasFX._svg(tam));
