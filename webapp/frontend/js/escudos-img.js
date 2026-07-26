/* ============================================================
   escudos-img.js — Motor de Imagem Singular
   
   Carrega o escudo do Rank específico como um elemento independente.
   A transparência é simulada perfeitamente injetando mix-blend-mode: screen
   junto a uma máscara linear para apagar o texto inferior original da imagem,
   enquanto o contraste agressivo esmaga o fundo transformando-o em preto puro (que desaparece no blend).
   ============================================================ */

const EscudosImg = {
  rank(letra, tam = 95) {
    const L = String(letra || 'E').toUpperCase();
    const rankMap = { 'E': 'E', 'D': 'D', 'C': 'C', 'B': 'B', 'A': 'A', 'S': 'S', 'N': 'N' };
    const r = rankMap[L] || 'E';
    
    // filter: contrast(1.8) brightness(0.7) força as partes cinzas/azuis do fundo a ficarem totalmente pretas.
    // mix-blend-mode: screen ignora o preto absoluto.
    // mask-image: linear-gradient apaga apenas a borda inferior (onde o texto "RANK X" fica) preservando as ASAS LATERAIS.
    
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
        <img src="assets/img/rank-${r}.jpg" style="
          width: 145%;
          height: 145%;
          object-fit: cover;
          object-position: center 30%;
          mix-blend-mode: screen;
          filter: contrast(1.8) brightness(0.75) saturate(1.2);
          mask-image: linear-gradient(to bottom, black 0%, black 82%, transparent 98%);
          -webkit-mask-image: linear-gradient(to bottom, black 0%, black 82%, transparent 98%);
          position: absolute;
          left: -22.5%;
          top: -22.5%;
          pointer-events: none;
        " alt="Rank ${r}">
      </div>
    `;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EscudosImg;
}
