/* ============================================================
   escudos-img.js — Motor Híbrido S-Rank (Raster + SVG FX)
   
   Usa as imagens base geradas (com tamanhos padronizados) e injeta
   auras, chamas e argolas puramente em SVG por trás delas para os Ranks A, S e N.
   ============================================================ */

const EscudosImg = {
  rank(letra, tam = 90) {
    const L = String(letra || 'E').toUpperCase();
    const rankMap = { 'E': 'E', 'D': 'D', 'C': 'C', 'B': 'B', 'A': 'A', 'S': 'S', 'N': 'N' };
    const r = rankMap[L] || 'E';
    
    // Configuração do ativo base
    let src = `assets/img/rank-${r.toLowerCase()}.png`;
    let style = "width: 100%; height: 100%; object-fit: contain; transform: scale(1.6); filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5)); pointer-events: none;";
    let svgEfeitos = "";

    if (r === 'E') {
      // O Rank E base gerado sem asas tem fundo branco, recortamos em hexágono exato
      src = "assets/img/escudo-base.jpg";
      style = "width: 100%; height: 100%; object-fit: cover; transform: scale(1.2); clip-path: polygon(50% 2%, 93% 25%, 93% 75%, 50% 98%, 7% 75%, 7% 25%); filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5)); pointer-events: none;";
    } else if (r === 'A') {
      // Rank A: Usa a base B + Halo Cósmico Dourado em SVG
      src = "assets/img/rank-b.png";
      svgEfeitos = `
        <svg viewBox="0 0 100 100" style="position:absolute; width:180%; height:180%; left:-40%; top:-40%; z-index:-1; animation: pt-girar 15s linear infinite;">
          <defs>
            <radialGradient id="haloA" cx="50%" cy="50%" r="50%">
              <stop offset="60%" stop-color="#fbbf24" stop-opacity="0"/>
              <stop offset="90%" stop-color="#fbbf24" stop-opacity="0.6"/>
              <stop offset="100%" stop-color="#fbbf24" stop-opacity="0"/>
            </radialGradient>
            <filter id="glowA"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          <circle cx="50" cy="50" r="45" fill="url(#haloA)"/>
          <circle cx="50" cy="50" r="40" fill="none" stroke="#fef3c7" stroke-width="0.5" stroke-dasharray="4 8" filter="url(#glowA)"/>
        </svg>
      `;
    } else if (r === 'S') {
      // Rank S: Usa a base B (Pintada de Carmesim) + Chamas em SVG
      src = "assets/img/rank-b.png";
      style += " filter: hue-rotate(-45deg) saturate(1.8) drop-shadow(0 4px 10px rgba(220,38,38,0.8));";
      svgEfeitos = `
        <svg viewBox="0 0 100 100" style="position:absolute; width:220%; height:220%; left:-60%; top:-60%; z-index:-1; animation: pt-girar 10s linear infinite reverse;">
          <defs>
            <radialGradient id="haloS" cx="50%" cy="50%" r="50%">
              <stop offset="50%" stop-color="#dc2626" stop-opacity="0"/>
              <stop offset="85%" stop-color="#ef4444" stop-opacity="0.8"/>
              <stop offset="100%" stop-color="#991b1b" stop-opacity="0"/>
            </radialGradient>
            <filter id="glowS"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          <path d="M50 5 Q 80 30 95 50 Q 80 70 50 95 Q 20 70 5 50 Q 20 30 50 5" fill="url(#haloS)" opacity="0.7"/>
          <circle cx="50" cy="50" r="35" fill="none" stroke="#fca5a5" stroke-width="1.5" stroke-dasharray="2 12" filter="url(#glowS)"/>
        </svg>
      `;
    } else if (r === 'N') {
      // Rank N: Usa a base B (Pintada de Abissal) + Argolas Negras em SVG
      src = "assets/img/rank-b.png";
      style += " filter: hue-rotate(150deg) brightness(0.8) saturate(1.5) drop-shadow(0 4px 15px rgba(59,130,246,0.9));";
      svgEfeitos = `
        <svg viewBox="0 0 100 100" style="position:absolute; width:250%; height:250%; left:-75%; top:-75%; z-index:-1; animation: pt-girar 20s linear infinite;">
          <defs>
            <radialGradient id="haloN" cx="50%" cy="50%" r="50%">
              <stop offset="40%" stop-color="#1e1b4b" stop-opacity="0"/>
              <stop offset="75%" stop-color="#3b82f6" stop-opacity="0.9"/>
              <stop offset="100%" stop-color="#020617" stop-opacity="0"/>
            </radialGradient>
            <filter id="glowN"><feGaussianBlur stdDeviation="5"/></filter>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#haloN)" opacity="0.8"/>
          <circle cx="50" cy="50" r="42" fill="none" stroke="#93c5fd" stroke-width="0.8" stroke-dasharray="10 20" filter="url(#glowN)"/>
          <circle cx="50" cy="50" r="30" fill="none" stroke="#818cf8" stroke-width="2" stroke-dasharray="1 30"/>
        </svg>
      `;
    }

    return `
      <div class="escudo-imagem-srank" style="
        width: ${tam}px; 
        height: ${tam}px; 
        display: inline-flex;
        justify-content: center;
        align-items: center;
        position: relative;
        overflow: visible;
        z-index: 1;
      ">
        ${svgEfeitos}
        <img src="${src}" style="${style}" alt="Rank ${r}">
      </div>
    `;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EscudosImg;
}
