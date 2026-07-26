/* ============================================================
   escudos-img.js — Motor de Sprite de Imagem (Alta Fidelidade)
   
   Extrai os escudos de alta qualidade gerados por IA diretamente 
   do arquivo de imagem original, utilizando recortes CSS (sprite), 
   máscaras radiais para ocultar os textos (ex: "RANK 1") e 
   mix-blend-mode para fundir perfeitamente com o fundo escuro.
   ============================================================ */

const EscudosImg = {
  rank(letra, tam = 100) {
    const L = String(letra || 'E').toUpperCase();
    
    // Mapeamento de coordenadas (Grid SpriteSheet)
    // A imagem tem 4 escudos em cima e 3 embaixo
    const map = {
      'E': { px: 0,   py: 0   }, // RANK 1
      'D': { px: 31,  py: 0   }, // RANK 2
      'C': { px: 66,  py: 0   }, // RANK 3
      'B': { px: 100, py: 0   }, // RANK 4 (Topo Direita)
      'A': { px: 10,  py: 100 }, // RANK 4 (Baixo Esquerda com Halo)
      'S': { px: 50,  py: 100 }, // RANK 6
      'N': { px: 90,  py: 100 }  // RANK 7
    };

    const cfg = map[L] || map['E'];
    
    // Um contêiner que mascara as bordas e os textos, extraindo apenas a gema.
    // O mix-blend-mode: screen absorve o fundo escuro da imagem, deixando as asas de ouro/prata brilharem no banner.
    return `
      <div class="escudo-imagem-srank" style="
        width: ${tam}px; 
        height: ${tam}px; 
        display: inline-block;
        background-image: url('assets/img/escudos-sprite.jpg');
        background-size: 380% 210%;
        background-position: ${cfg.px}% ${cfg.py}%;
        background-repeat: no-repeat;
        mix-blend-mode: lighten;
        filter: contrast(1.1) brightness(1.05);
        mask-image: radial-gradient(circle at 50% 43%, black 50%, transparent 68%);
        -webkit-mask-image: radial-gradient(circle at 50% 43%, black 50%, transparent 68%);
      "></div>
    `;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EscudosImg;
}
