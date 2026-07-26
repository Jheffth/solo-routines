/* ============================================================
   escudos-img.js — Motor de Imagem S-Rank (IA Nativa)
   
   Carrega os escudos individuais gerados por IA com fundo preto absoluto.
   A transparência é simulada com perfeição usando mix-blend-mode: screen.
   Como o fundo é puramente preto e não há textos, não precisamos de máscaras
   que cortem as asas. O resultado é orgânico e de altíssima qualidade.
   ============================================================ */

const EscudosImg = {
  rank(letra, tam = 90) {
    const L = String(letra || 'E').toUpperCase();
    const rankMap = { 'E': 'E', 'D': 'D', 'C': 'C', 'B': 'B', 'A': 'A', 'S': 'S', 'N': 'N' };
    const r = rankMap[L] || 'E';
    
    // mix-blend-mode: screen elimina completamente o fundo preto (#000000).
    return `
      <div class="escudo-imagem-srank" style="
        width: ${tam}px; 
        height: ${tam}px; 
        display: inline-flex;
        justify-content: center;
        align-items: center;
        position: relative;
        overflow: visible;
      ">
        <img src="assets/img/rank-${r.toLowerCase()}.jpg" style="
          width: 100%;
          height: 100%;
          object-fit: contain;
          transform: scale(1.6);
          mix-blend-mode: screen;
          filter: drop-shadow(0 0 10px rgba(255,255,255,0.1));
          pointer-events: none;
        " alt="Rank ${r}">
      </div>
    `;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EscudosImg;
}
