/* ============================================================
   escudos-img.js — Motor de Imagem Singular
   
   Carrega o escudo do Rank específico como um elemento independente.
   A transparência é simulada perfeitamente injetando mix-blend-mode: lighten
   junto a uma máscara radial pesada que destrói o fundo quadrado e as legendas originais.
   ============================================================ */

const EscudosImg = {
  rank(letra, tam = 100) {
    const L = String(letra || 'E').toUpperCase();
    const rankMap = { 'E': 'E', 'D': 'D', 'C': 'C', 'B': 'B', 'A': 'A', 'S': 'S', 'N': 'N' };
    const r = rankMap[L] || 'E';
    
    // Aumentamos o tamanho visual renderizando a imagem maior e mascarando
    // Mix-blend-mode: lighten mescla o fundo azul da imagem com o preto do banner
    // Filtro de brilho compensa o escurecimento do blend
    return `
      <div class="escudo-imagem-srank" style="
        width: ${tam}px; 
        height: ${tam}px; 
        display: inline-flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
      ">
        <img src="assets/img/rank-${r}.jpg" style="
          width: 140%;
          height: 140%;
          object-fit: cover;
          object-position: center 30%;
          mix-blend-mode: lighten;
          filter: contrast(1.15) brightness(1.1);
          mask-image: radial-gradient(circle at 50% 50%, black 50%, transparent 68%);
          -webkit-mask-image: radial-gradient(circle at 50% 50%, black 50%, transparent 68%);
        " alt="Rank ${r}">
      </div>
    `;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EscudosImg;
}
