/* ============================================================
   dominio-lancado.js — Insígnia S-Rank (Domínio Lançado)
   ============================================================ */

const DominioLancadoFX = {
  _seq: 0,
  _svg(tam) {
    const u = 'idominio' + (++this._seq);
    return `<svg class="conquista-svg" aria-hidden="true" focusable="false" style="display:block;overflow:hidden;width:${tam}px;height:${tam}px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
      <style>/*<![CDATA[*/
        .dl-expansao { transform-origin: 150px 150px; animation: dl-expandir 8s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
        .dl-giro { transform-origin: 150px 150px; animation: dl-girar 20s linear infinite; }
        .dl-giro-reverso { transform-origin: 150px 150px; animation: dl-girar 30s linear infinite reverse; }
        .dl-energia g { transform-origin: 150px 150px; animation: dl-raio 4s ease-out infinite; }
        @keyframes dl-expandir { 0% { transform: scale(0.8); opacity: 0.5; } 50% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(0.8); opacity: 0.5; } }
        @keyframes dl-girar { 100% { transform: rotate(360deg); } }
        @keyframes dl-raio { 0% { transform: scale(0.1) rotate(0deg); opacity: 1; } 100% { transform: scale(1.5) rotate(45deg); opacity: 0; } }
      /*]]>*/</style>
      <defs>
        <radialGradient cx="150" cy="150" r="150" id="${u}_bg" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#064e3b" />
          <stop offset="50%" stop-color="#022c22" />
          <stop offset="100%" stop-color="#000000" />
        </radialGradient>
        <radialGradient cx="150" cy="150" r="100" id="${u}_esfera" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#34d399" />
          <stop offset="40%" stop-color="#059669" />
          <stop offset="100%" stop-color="#064e3b" />
        </radialGradient>
        <filter x="-50%" y="-50%" width="200%" height="200%" id="${u}_glow">
          <feGaussianBlur stdDeviation="5.0" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter x="-50%" y="-50%" width="200%" height="200%" id="${u}_glow_forte">
          <feGaussianBlur stdDeviation="12.0" result="blur" />
          <feComponentTransfer in="blur" result="glow"><feFuncA type="linear" slope="2.0"/></feComponentTransfer>
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      <!-- Fundo Base -->
      <circle cx="150" cy="150" r="140" fill="url(#${u}_bg)" stroke="#064e3b" stroke-width="3" />
      
      <!-- Linhas de Força (Expansão do Domínio) -->
      <g class="dl-expansao">
        <circle cx="150" cy="150" r="120" fill="none" stroke="#10b981" stroke-width="2" filter="url(#${u}_glow)" opacity="0.4"/>
        <circle cx="150" cy="150" r="90" fill="none" stroke="#34d399" stroke-width="1" filter="url(#${u}_glow)" opacity="0.6"/>
        <circle cx="150" cy="150" r="60" fill="none" stroke="#6ee7b7" stroke-width="3" filter="url(#${u}_glow_forte)" opacity="0.8"/>
      </g>

      <!-- Geometria Sagrada / Barreiras -->
      <g class="dl-giro">
        <polygon points="150,20 262,85 262,215 150,280 38,215 38,85" fill="none" stroke="#059669" stroke-width="1.5" opacity="0.5" filter="url(#${u}_glow)"/>
      </g>
      <g class="dl-giro-reverso">
        <polygon points="150,30 253,90 253,210 150,270 47,210 47,90" fill="none" stroke="#10b981" stroke-width="1" opacity="0.7" transform="rotate(30 150 150)" filter="url(#${u}_glow)"/>
      </g>

      <!-- Esfera Central (Núcleo do Domínio) -->
      <circle cx="150" cy="150" r="50" fill="url(#${u}_esfera)" stroke="#6ee7b7" stroke-width="2" filter="url(#${u}_glow_forte)"/>
      <circle cx="150" cy="150" r="15" fill="#a7f3d0" filter="url(#${u}_glow_forte)"/>

      <!-- Raios de Energia Emitidos -->
      <g class="dl-energia">
        ${Array.from({length: 8}).map((_, i) => {
          const delay = (Math.random() * 4).toFixed(2);
          const a = (Math.PI / 4) * i;
          return \`<g style="animation-delay: \${delay}s">
            <path d="M 150 150 L \${150 + 100 * Math.cos(a)} \${150 + 100 * Math.sin(a)}" stroke="#34d399" stroke-width="3" fill="none" filter="url(#\${u}_glow)"/>
          </g>\`;
        }).join('')}
      </g>

      <!-- Runas de Contenção Orbitais -->
      <g class="dl-giro">
        ${Array.from({length: 12}).map((_, i) => {
          const a = (Math.PI / 6) * i;
          return \`<circle cx="\${150 + 120 * Math.cos(a)}" cy="\${150 + 120 * Math.sin(a)}" r="4" fill="#a7f3d0" filter="url(#\${u}_glow)"/>\`;
        }).join('')}
      </g>
    </svg>`;
  },

  celebrar() {
    if (typeof ConquistaFX === 'undefined') return;
    ConquistaFX.show({
      codigo: 'dominio_lancado',
      titulo: 'DOMÍNIO LANÇADO',
      descricao: 'Você sobrepôs sua própria realidade sobre o mundo.',
      icone: '💠', cor: '#10b981',
      xp_bonus: 30000, moedas_bonus: 3000,
      shimmer: 'linear-gradient(100deg, #6ee7b7 20%, #059669 40%, #6ee7b7 60%, #059669 80%)'
    });
  }
};

window.DominioLancadoFX = DominioLancadoFX;
window.ConquistaFX?.registrarInsignia?.('dominio_lancado', tam => DominioLancadoFX._svg(tam));
