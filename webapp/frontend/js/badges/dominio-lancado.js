/* ============================================================
   dominio-lancado.js — Insígnia Especial do Arquiteto: Domínio Lançado
   Padrão: Solo Routines (Cerimônia de Conquista S-Rank)
   ============================================================ */

const DominioLancadoFX = {
  _svg(tamanho = 260) {
    // 1. Estrela giratória (Geometria Arquiteto)
    const pontas = [];
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i - Math.PI / 2;
      const rExt = i % 2 === 0 ? 130 : 90;
      pontas.push(`M ${130 + 70 * Math.cos(a - Math.PI / 8)} ${130 + 70 * Math.sin(a - Math.PI / 8)}
                   L ${130 + rExt * Math.cos(a)} ${130 + rExt * Math.sin(a)}
                   L ${130 + 70 * Math.cos(a + Math.PI / 8)} ${130 + 70 * Math.sin(a + Math.PI / 8)} Z`);
    }

    // 2. Lâminas do Domínio (Giro Acelerado)
    const laminas = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      laminas.push(`M 130 130 L ${130 + 20 * Math.cos(a - 0.15)} ${130 + 20 * Math.sin(a - 0.15)}
                    L ${130 + 125 * Math.cos(a)} ${130 + 125 * Math.sin(a)}
                    L ${130 + 20 * Math.cos(a + 0.15)} ${130 + 20 * Math.sin(a + 0.15)} Z`);
    }

    // 3. Circuito do Sistema (Runas Tecnológicas)
    const runas = [];
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI / 8) * i;
      const rIn = 65, rOut = 85;
      runas.push(`M ${130 + rIn * Math.cos(a)} ${130 + rIn * Math.sin(a)} 
                  L ${130 + rOut * Math.cos(a)} ${130 + rOut * Math.sin(a)} 
                  L ${130 + (rOut + 10) * Math.cos(a + 0.1)} ${130 + (rOut + 10) * Math.sin(a + 0.1)}`);
    }

    return `
    <svg viewBox="0 0 260 260" width="${tamanho}" height="${tamanho}" style="overflow:visible" class="cq-svg">
      <defs>
        <!-- Gradientes Fluorescentes (Verde e Azul) -->
        <radialGradient id="arqBase" cx="50%" cy="50%">
          <stop offset="0%" stop-color="#022c22" /> <!-- Verde ultra escuro -->
          <stop offset="60%" stop-color="#083344" /> <!-- Cyan escuro -->
          <stop offset="100%" stop-color="#000000" />
        </radialGradient>
        
        <linearGradient id="arqLaminas" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#6ee7b7" /> <!-- Verde Fluorescente -->
          <stop offset="50%" stop-color="#22d3ee" /> <!-- Azul Fluorescente -->
          <stop offset="100%" stop-color="#065f46" />
        </linearGradient>

        <radialGradient id="arqCristal" cx="40%" cy="30%">
          <stop offset="0%" stop-color="#34d399" />
          <stop offset="50%" stop-color="#0ea5e9" />
          <stop offset="100%" stop-color="#0f172a" />
        </radialGradient>

        <filter id="arqSombra">
          <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000" flood-opacity="0.9"/>
          <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="#22d3ee" flood-opacity="0.6"/>
        </filter>
      </defs>

      <g filter="url(#arqSombra)">
        <!-- Estrela de Fundo (Octógono Geométrico) -->
        <g class="cq-svg-star" style="animation-duration: 22s;">
          <path d="${pontas.join(' ')}" fill="url(#arqBase)" stroke="#22d3ee" stroke-width="2" />
        </g>

        <!-- Lâminas Cortantes (Giro Rápido) -->
        <g style="transform-origin: 130px 130px; animation: cq-anel-girar 12s linear infinite reverse;">
          <path d="${laminas.join(' ')}" fill="url(#arqLaminas)" opacity="0.9" />
        </g>

        <!-- Circuito do Sistema -->
        <g style="transform-origin: 130px 130px; animation: cq-anel-girar 20s linear infinite;">
          <path d="${runas.join(' ')}" stroke="#6ee7b7" stroke-width="2.5" fill="none" opacity="0.9" stroke-linecap="round"/>
        </g>

        <!-- Octógono Central (O Núcleo do Sistema) -->
        <polygon points="130,50 186,74 210,130 186,186 130,210 74,186 50,130 74,74" fill="url(#arqBase)" stroke="#22d3ee" stroke-width="3"/>

        <!-- Gema Central Triangular Reversa (Símbolo de Controle) -->
        <polygon points="130,80 180,110 130,170 80,110" fill="url(#arqCristal)" stroke="#6ee7b7" stroke-width="2"/>
        <!-- Vidro -->
        <polygon points="130,80 180,110 130,130" fill="rgba(255,255,255,0.4)"/>
        <polygon points="80,110 130,130 130,170" fill="rgba(0,0,0,0.3)"/>
        <polygon points="180,110 130,130 130,170" fill="rgba(0,0,0,0.1)"/>
        
        <!-- Furo Central Brilhante -->
        <circle cx="130" cy="130" r="12" fill="#fff" />
        
        <!-- Pulsar Externo -->
        <circle cx="130" cy="130" r="128" fill="none" stroke="#6ee7b7" stroke-width="3" stroke-dasharray="10 50" style="transform-origin:130px 130px; animation: cq-anel-girar 5s linear infinite;" />
      </g>
    </svg>`;
  },

  demo() {
    if (typeof ConquistaFX === 'undefined') return;
    ConquistaFX.show({
      id: 'dominio_lancado_' + Date.now(),
      titulo: 'DOMÍNIO LANÇADO',
      descricao: 'O Arquiteto alterou as regras do próprio Sistema.',
      codigo: 'dominio_lancado',
      xp: 100000,
      xpCor: '#6ee7b7',
      shimmer: 'linear-gradient(100deg, #d1fae5 20%, #22d3ee 40%, #6ee7b7 60%, #0ea5e9 80%)'
    });
  }
};

window.DominioLancadoFX = DominioLancadoFX;
window.ConquistaFX?.registrarInsignia?.('dominio_lancado', tam => DominioLancadoFX._svg(tam));
