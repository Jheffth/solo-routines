/* ============================================================
   monarca-das-sombras.js — Insígnia S-Rank (Monarca das Sombras)
   ============================================================ */

const MonarcaDasSombrasFX = {
  _seq: 0,
  _svg(tam) {
    const u = 'imonarca' + (++this._seq);
    return `<svg class="conquista-svg" aria-hidden="true" focusable="false" style="display:block;overflow:hidden;width:${tam}px;height:${tam}px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
      <style>/*<![CDATA[*/
        .mds-giro-lento { transform-origin: 150px 150px; animation: mds-girar 40s linear infinite; }
        .mds-giro-rapido { transform-origin: 150px 150px; animation: mds-girar 15s linear infinite reverse; }
        .mds-pulso { transform-origin: 150px 150px; animation: mds-pulsar 3s ease-in-out infinite; }
        .mds-particulas g { transform-origin: 150px 150px; animation: mds-flutuar 3s ease-in-out infinite alternate; }
        @keyframes mds-girar { 100% { transform: rotate(360deg); } }
        @keyframes mds-pulsar { 0%, 100% { transform: scale(1); filter: brightness(1); } 50% { transform: scale(1.05); filter: brightness(1.3); } }
        @keyframes mds-flutuar { 0% { transform: translateY(0px) scale(0.8); opacity: 0.5; } 100% { transform: translateY(-10px) scale(1.2); opacity: 1; } }
      /*]]>*/</style>
      <defs>
        <radialGradient cx="150" cy="150" r="150" id="${u}_bg" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#4c1d95" />
          <stop offset="50%" stop-color="#1e1b4b" />
          <stop offset="100%" stop-color="#000000" />
        </radialGradient>
        <linearGradient x1="0" y1="0" x2="300" y2="300" id="${u}_metal" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#c084fc" />
          <stop offset="50%" stop-color="#7e22ce" />
          <stop offset="100%" stop-color="#3b0764" />
        </linearGradient>
        <filter x="-40%" y="-40%" width="180%" height="180%" id="${u}_glow">
          <feGaussianBlur stdDeviation="4.0" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter x="-40%" y="-40%" width="180%" height="180%" id="${u}_glow_forte">
          <feGaussianBlur stdDeviation="8.0" result="blur" />
          <feComponentTransfer in="blur" result="glow"><feFuncA type="linear" slope="1.5"/></feComponentTransfer>
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      <!-- Fundo -->
      <circle cx="150" cy="150" r="135" fill="url(#${u}_bg)" stroke="#4c1d95" stroke-width="2" />
      
      <!-- Anéis Externos (Símbolo de Domínio) -->
      <g class="mds-giro-lento">
        <circle cx="150" cy="150" r="120" fill="none" stroke="#a855f7" stroke-width="1.5" stroke-dasharray="10 15" opacity="0.6"/>
        <circle cx="150" cy="150" r="105" fill="none" stroke="#c084fc" stroke-width="1" stroke-dasharray="2 6" opacity="0.8"/>
        <!-- Geometria rúnica -->
        <polygon points="150,20 262,85 262,215 150,280 38,215 38,85" fill="none" stroke="#7e22ce" stroke-width="1.5" opacity="0.4" />
        <polygon points="150,30 253,90 253,210 150,270 47,210 47,90" fill="none" stroke="#9333ea" stroke-width="0.8" opacity="0.3" transform="rotate(30 150 150)"/>
      </g>

      <!-- Espadas das Sombras / Adagas -->
      <g class="mds-giro-rapido">
        ${Array.from({length: 4}).map((_, i) => {
          const a = (Math.PI / 2) * i;
          return \`<path d="M 150 150 L \${150 + 12 * Math.cos(a - 0.1)} \${150 + 12 * Math.sin(a - 0.1)} L \${150 + 140 * Math.cos(a)} \${150 + 140 * Math.sin(a)} L \${150 + 12 * Math.cos(a + 0.1)} \${150 + 12 * Math.sin(a + 0.1)} Z" fill="url(#\${u}_metal)" filter="url(#\${u}_glow)"/>\`;
        }).join('')}
      </g>

      <!-- Cristal Central Pulsante -->
      <g class="mds-pulso">
        <polygon points="150,60 227,105 227,195 150,240 73,195 73,105" fill="url(#${u}_bg)" stroke="url(#${u}_metal)" stroke-width="3" filter="url(#${u}_glow_forte)"/>
        <!-- Reflexos do Cristal -->
        <polygon points="150,60 227,105 150,150" fill="rgba(192,132,252,0.15)"/>
        <polygon points="73,105 150,150 73,195" fill="rgba(255,255,255,0.05)"/>
        <!-- Olho Interior -->
        <path d="M 100 150 Q 150 100 200 150 Q 150 200 100 150 Z" fill="#000" stroke="#c084fc" stroke-width="2" filter="url(#${u}_glow)"/>
        <circle cx="150" cy="150" r="12" fill="#d8b4fe" filter="url(#${u}_glow_forte)"/>
        <circle cx="150" cy="150" r="4" fill="#ffffff" />
      </g>

      <!-- Partículas de Fumaça (Arise) -->
      <g class="mds-particulas">
        ${Array.from({length: 12}).map((_, i) => {
          const delay = (Math.random() * 3).toFixed(2);
          const dur = (2 + Math.random() * 2).toFixed(2);
          const cx = 50 + Math.random() * 200;
          const cy = 50 + Math.random() * 200;
          const r = 2 + Math.random() * 3;
          return \`<g style="animation-delay: \${delay}s; animation-duration: \${dur}s"><circle cx="\${cx}" cy="\${cy}" r="\${r}" fill="#c084fc" filter="url(#\${u}_glow_forte)" opacity="0.7"/></g>\`;
        }).join('')}
      </g>
    </svg>`;
  },

  celebrar() {
    if (typeof ConquistaFX === 'undefined') return;
    ConquistaFX.show({
      codigo: 'monarca_das_sombras',
      titulo: 'MONARCA DAS SOMBRAS',
      descricao: 'O Domínio Completo da Escuridão e do Sistema.',
      icone: '👑', cor: '#c084fc',
      xp_bonus: 50000, moedas_bonus: 5000,
      shimmer: 'linear-gradient(100deg, #e879f9 20%, #7c3aed 40%, #e879f9 60%, #7c3aed 80%)'
    });
  }
};

window.MonarcaDasSombrasFX = MonarcaDasSombrasFX;
window.ConquistaFX?.registrarInsignia?.('monarca_das_sombras', tam => MonarcaDasSombrasFX._svg(tam));
