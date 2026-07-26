/* ============================================================
   escudos.js — A Forja dos Escudos Lunares (Fable5 Standard)
   
   Gera emblemas SVG puros inspirados em insígnias celestiais.
   Não utiliza imagens. 100% matemática vetorial, feDropShadow
   e feGaussianBlur para manter a nitidez absoluta em 4K.
   ============================================================ */

const Escudos = {
  _seq: 0,

  /* Garante que gradientes e clip-paths não se misturem entre múltiplos
     escudos na mesma página (problema crônico de SVG inline). */
  _unico(svg) {
    const selo = `esc${++this._seq}`;
    const ids = new Set();
    svg.replace(/\sid="([^"]+)"/g, (_, id) => { ids.add(id); return ''; });
    ids.forEach(id => {
      const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      svg = svg.replace(new RegExp(`\\sid="${esc}"`, 'g'), ` id="${id}-${selo}"`)
               .replace(new RegExp(`url\\(#${esc}\\)`, 'g'), `url(#${id}-${selo})`);
    });
    return svg;
  },

  /* Curvas e caminhos base para as bordas do escudo (Hexágono invertido) */
  _paths: {
    // Escudo exterior principal
    hexExterno: 'M50 8 L85 24 L85 70 L50 95 L15 70 L15 24 Z',
    // Fundo interno
    hexInterno: 'M50 14 L80 28 L80 67 L50 88 L20 67 L20 28 Z',
    // Crescente lunar
    lua: 'M50 36 C 40 36, 32 44, 32 54 C 32 64, 40 72, 50 72 C 58 72, 53 66, 50 63 C 44 58, 44 50, 50 45 C 53 42, 58 36, 50 36 Z',
    // Estrela 5 pontas
    estrela: 'M62 42 L64 47 L69 47 L65 50 L66.5 55 L62 52 L57.5 55 L59 50 L55 47 L60 47 Z'
  },

  _gradientesComuns: `
    <linearGradient id="metalPrata" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="40%" stop-color="#b0c4de"/>
      <stop offset="80%" stop-color="#697b91"/>
      <stop offset="100%" stop-color="#2a3b4c"/>
    </linearGradient>
    <linearGradient id="metalOuro" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff5cc"/>
      <stop offset="35%" stop-color="#f5ce42"/>
      <stop offset="70%" stop-color="#d49d1e"/>
      <stop offset="100%" stop-color="#6e4f07"/>
    </linearGradient>
    <linearGradient id="metalBronze" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f2dcb6"/>
      <stop offset="40%" stop-color="#c48f56"/>
      <stop offset="80%" stop-color="#7a4b24"/>
      <stop offset="100%" stop-color="#3d210b"/>
    </linearGradient>
    <radialGradient id="fundoAzul" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#2c4b75"/>
      <stop offset="100%" stop-color="#0f1b2e"/>
    </radialGradient>
    <radialGradient id="fundoCosmo" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#192b4d"/>
      <stop offset="60%" stop-color="#0a1224"/>
      <stop offset="100%" stop-color="#000000"/>
    </radialGradient>
    <radialGradient id="galaxia" cx="40%" cy="40%" r="80%">
      <stop offset="0%" stop-color="#3b164f"/>
      <stop offset="40%" stop-color="#141a4a"/>
      <stop offset="80%" stop-color="#0d0d26"/>
      <stop offset="100%" stop-color="#000000"/>
    </radialGradient>
    <linearGradient id="gemaCiano" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#e0ffff"/>
      <stop offset="40%" stop-color="#00f0ff"/>
      <stop offset="100%" stop-color="#006680"/>
    </linearGradient>
    <filter id="glowCiano" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="glowOuro" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="shadow">
      <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#000" flood-opacity="0.7"/>
    </filter>
    <filter id="shadowG">
      <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#000" flood-opacity="0.85"/>
    </filter>
  `,

  /* --- GEOMETRIA PARAMÉTRICA --- */

  // Fundo constelação (pontinhos e linhas sutis)
  _constelacao() {
    return `
      <g stroke="#8ec8f5" stroke-opacity="0.3" stroke-width="0.5" fill="none">
        <path d="M40 30 L60 40 L50 60 L30 50 Z" />
        <path d="M60 40 L70 30" />
        <path d="M30 50 L20 60" />
        <circle cx="40" cy="30" r="1" fill="#fff" opacity="0.8"/>
        <circle cx="60" cy="40" r="1.5" fill="#fff" opacity="0.9"/>
        <circle cx="50" cy="60" r="0.8" fill="#fff" opacity="0.7"/>
        <circle cx="30" cy="50" r="1" fill="#fff" opacity="0.8"/>
      </g>
    `;
  },

  // Galáxia (estrelas e nebulosas espaciais)
  _galaxia() {
    return `
      <circle cx="45" cy="45" r="25" fill="#6a1b9a" opacity="0.2" filter="url(#glowCiano)"/>
      <circle cx="65" cy="65" r="15" fill="#00e5ff" opacity="0.15" filter="url(#glowCiano)"/>
      <g fill="#fff" opacity="0.8">
        <circle cx="35" cy="35" r="1"/>
        <circle cx="55" cy="70" r="0.8"/>
        <circle cx="65" cy="35" r="1.2"/>
        <circle cx="75" cy="50" r="0.6"/>
        <circle cx="30" cy="60" r="1.5"/>
        <circle cx="45" cy="80" r="0.7"/>
      </g>
      ${this._constelacao()}
    `;
  },

  // Asas Curtas Metálicas (E)
  _asaCurtaPrata() {
    return `
      <path d="M15 35 Q 5 30, 2 40 Q 5 45, 12 42 Z" fill="url(#metalPrata)"/>
      <path d="M15 45 Q 2 40, 0 52 Q 5 55, 13 49 Z" fill="url(#metalPrata)"/>
      <path d="M17 55 Q 5 52, 4 62 Q 8 63, 16 57 Z" fill="url(#metalPrata)"/>

      <path d="M85 35 Q 95 30, 98 40 Q 95 45, 88 42 Z" fill="url(#metalPrata)"/>
      <path d="M85 45 Q 98 40, 100 52 Q 95 55, 87 49 Z" fill="url(#metalPrata)"/>
      <path d="M83 55 Q 95 52, 96 62 Q 92 63, 84 57 Z" fill="url(#metalPrata)"/>
    `;
  },

  // Asas Médias Metálicas (D)
  _asaMediaPrata() {
    return `
      <path d="M18 25 Q 5 15, -2 30 Q 5 35, 12 32 Z" fill="url(#metalPrata)" filter="url(#shadow)"/>
      <path d="M15 35 Q 0 25, -5 42 Q 2 47, 10 40 Z" fill="url(#metalPrata)" filter="url(#shadow)"/>
      <path d="M15 45 Q -2 38, -6 54 Q 2 57, 12 49 Z" fill="url(#metalPrata)" filter="url(#shadow)"/>
      <path d="M17 55 Q 2 48, -2 65 Q 4 66, 14 57 Z" fill="url(#metalPrata)" filter="url(#shadow)"/>

      <path d="M82 25 Q 95 15, 102 30 Q 95 35, 88 32 Z" fill="url(#metalPrata)" filter="url(#shadow)"/>
      <path d="M85 35 Q 100 25, 105 42 Q 98 47, 90 40 Z" fill="url(#metalPrata)" filter="url(#shadow)"/>
      <path d="M85 45 Q 102 38, 106 54 Q 98 57, 88 49 Z" fill="url(#metalPrata)" filter="url(#shadow)"/>
      <path d="M83 55 Q 98 48, 102 65 Q 96 66, 86 57 Z" fill="url(#metalPrata)" filter="url(#shadow)"/>
    `;
  },

  // Asas Longas Metálicas/Ouro (C)
  _asaLongaPrata(corBase = 'metalPrata') {
    return `
      <g filter="url(#shadowG)">
        <path d="M22 20 Q -5 0, -12 25 Q 0 35, 15 28 Z" fill="url(#${corBase})"/>
        <path d="M18 30 Q -10 10, -18 38 Q -2 46, 12 36 Z" fill="url(#${corBase})"/>
        <path d="M15 42 Q -12 25, -16 52 Q 0 58, 11 46 Z" fill="url(#${corBase})"/>
        <path d="M15 52 Q -10 38, -12 65 Q -2 68, 13 55 Z" fill="url(#${corBase})"/>
        <path d="M18 62 Q -5 50, -6 75 Q 2 75, 15 62 Z" fill="url(#${corBase})"/>

        <path d="M78 20 Q 105 0, 112 25 Q 100 35, 85 28 Z" fill="url(#${corBase})"/>
        <path d="M82 30 Q 110 10, 118 38 Q 102 46, 88 36 Z" fill="url(#${corBase})"/>
        <path d="M85 42 Q 112 25, 116 52 Q 100 58, 89 46 Z" fill="url(#${corBase})"/>
        <path d="M85 52 Q 110 38, 112 65 Q 102 68, 87 55 Z" fill="url(#${corBase})"/>
        <path d="M82 62 Q 105 50, 106 75 Q 98 75, 85 62 Z" fill="url(#${corBase})"/>
      </g>
    `;
  },

  // Asas Ornamentais Plumadas (B, A)
  _asaPlumada(corBase = 'metalBronze') {
    // Estas asas descem de cima e tem um formato mais encorpado de anjo
    return `
      <g filter="url(#shadowG)">
        <!-- Esquerda -->
        <path d="M30 15 Q -15 -10, -15 35 C -15 60, 5 70, 20 60 C 15 50, 12 40, 25 35 C 15 30, 20 20, 30 15 Z" fill="url(#${corBase})"/>
        <path d="M22 28 Q -10 15, -10 45 Q 5 50, 15 45 Z" fill="url(#metalOuro)" opacity="0.6"/>
        <path d="M25 40 Q -5 30, -2 55 Q 10 55, 18 48 Z" fill="url(#metalOuro)" opacity="0.4"/>
        <!-- Direita -->
        <path d="M70 15 Q 115 -10, 115 35 C 115 60, 95 70, 80 60 C 85 50, 88 40, 75 35 C 85 30, 80 20, 70 15 Z" fill="url(#${corBase})"/>
        <path d="M78 28 Q 110 15, 110 45 Q 95 50, 85 45 Z" fill="url(#metalOuro)" opacity="0.6"/>
        <path d="M75 40 Q 105 30, 102 55 Q 90 55, 82 48 Z" fill="url(#metalOuro)" opacity="0.4"/>
      </g>
    `;
  },

  // Asas S-Rank (Ouro Plumadas com Joias) (S, N)
  _asaS(joias = true, expandida = false) {
    const scale = expandida ? 'transform="scale(1.15) translate(-6, -6)"' : '';
    const jLayer = joias ? `
      <polygon points="-2,35 -5,38 2,42 5,39" fill="url(#gemaCiano)" filter="url(#shadow)"/>
      <polygon points="2,48 -2,52 4,55 8,51" fill="url(#gemaCiano)" filter="url(#shadow)"/>
      <polygon points="8,60 5,64 10,67 13,63" fill="url(#gemaCiano)" filter="url(#shadow)"/>
      <polygon points="15,70 12,74 18,76 21,72" fill="url(#gemaCiano)" filter="url(#shadow)"/>

      <polygon points="102,35 105,38 98,42 95,39" fill="url(#gemaCiano)" filter="url(#shadow)"/>
      <polygon points="98,48 102,52 96,55 92,51" fill="url(#gemaCiano)" filter="url(#shadow)"/>
      <polygon points="92,60 95,64 90,67 87,63" fill="url(#gemaCiano)" filter="url(#shadow)"/>
      <polygon points="85,70 88,74 82,76 79,72" fill="url(#gemaCiano)" filter="url(#shadow)"/>
    ` : '';

    return `
      <g ${scale}>
        <!-- Asas de anjo ouro majestosas -->
        ${this._asaPlumada('metalOuro')}
        <!-- Camada superior da asa para 3D -->
        <path d="M28 20 Q -5 0, -5 35 Q 8 40, 18 35 Z" fill="url(#metalOuro)"/>
        <path d="M72 20 Q 105 0, 105 35 Q 92 40, 82 35 Z" fill="url(#metalOuro)"/>
        
        <!-- Mais penas na base -->
        <path d="M25 60 Q 5 65, 8 85 Q 15 80, 22 65 Z" fill="url(#metalOuro)" filter="url(#shadowG)"/>
        <path d="M75 60 Q 95 65, 92 85 Q 85 80, 78 65 Z" fill="url(#metalOuro)" filter="url(#shadowG)"/>
        ${jLayer}
      </g>
    `;
  },

  // Halo Flutuante (Rank A)
  _haloAnjo() {
    return `
      <g filter="url(#glowOuro)">
        <ellipse cx="50" cy="-5" rx="20" ry="6" fill="none" stroke="url(#metalOuro)" stroke-width="2"/>
        <ellipse cx="50" cy="-5" rx="20" ry="6" fill="none" stroke="#fff" stroke-width="0.5" opacity="0.8"/>
      </g>
    `;
  },

  // Círculo Rúnico Básico (Rank S)
  _anelRunicoBasico() {
    return `
      <g filter="url(#glowOuro)" opacity="0.8">
        <circle cx="50" cy="50" r="55" fill="none" stroke="url(#metalOuro)" stroke-width="1" stroke-dasharray="8 4"/>
        <circle cx="50" cy="50" r="48" fill="none" stroke="#fff5cc" stroke-width="0.5"/>
        <!-- Ramo rúnico superior -->
        <path d="M50 -5 L45 -15 L55 -15 Z" fill="none" stroke="url(#metalOuro)"/>
      </g>
    `;
  },

  // Círculo Cósmico Nacional (Rank N)
  _anelCosmico() {
    return `
      <g filter="url(#glowOuro)" opacity="0.9">
        <circle cx="50" cy="50" r="65" fill="none" stroke="url(#metalOuro)" stroke-width="1.5" stroke-dasharray="2 6 10 6"/>
        <circle cx="50" cy="50" r="58" fill="none" stroke="url(#metalOuro)" stroke-width="1" />
        <circle cx="50" cy="50" r="45" fill="none" stroke="#fff5cc" stroke-width="0.5" stroke-dasharray="2 4"/>
        <!-- Símbolos cardeais -->
        <polygon points="50,-15 53,-5 47,-5" fill="url(#metalOuro)"/>
        <polygon points="50,115 53,105 47,105" fill="url(#metalOuro)"/>
        <polygon points="-15,50 -5,47 -5,53" fill="url(#metalOuro)"/>
        <polygon points="115,50 105,47 105,53" fill="url(#metalOuro)"/>
      </g>
      <!-- Partículas de luz externas -->
      <circle cx="10" cy="10" r="2" fill="#fff" filter="url(#glowCiano)"/>
      <circle cx="90" cy="90" r="2.5" fill="#fff" filter="url(#glowCiano)"/>
      <circle cx="90" cy="10" r="1.5" fill="#fff" filter="url(#glowCiano)"/>
      <circle cx="10" cy="90" r="2" fill="#fff" filter="url(#glowCiano)"/>
    `;
  },

  /* ══════════════════════════════════════════════════════════
     O MOTOR PRINCIPAL: MONTAGEM DOS ESCUDOS
     ══════════════════════════════════════════════════════════ */
  rank(letra, tam = 100) {
    const L = String(letra || 'E').toUpperCase();
    
    // Configurações do layout por rank
    let bg = 'url(#fundoAzul)';
    let borderMain = 'url(#metalPrata)';
    let borderSub = 'url(#metalPrata)';
    let moonStar = 'url(#metalPrata)';
    let asaHtml = '';
    let haloHtml = '';
    let innerHtml = '';
    let gemasAro = '';

    switch (L) {
      case 'E':
        asaHtml = this._asaCurtaPrata();
        haloHtml = '<circle cx="50" cy="50" r="45" fill="#00e5ff" opacity="0.1" filter="url(#glowCiano)"/>';
        break;

      case 'D':
        asaHtml = this._asaMediaPrata();
        haloHtml = '<circle cx="50" cy="50" r="50" fill="#00e5ff" opacity="0.15" filter="url(#glowCiano)"/>';
        // Detalhe extra na borda
        borderSub = '#e2e8f0'; 
        break;

      case 'C':
        borderMain = 'url(#metalBronze)';
        borderSub = 'url(#metalPrata)';
        moonStar = 'url(#metalOuro)';
        bg = 'url(#fundoCosmo)';
        innerHtml = this._constelacao();
        asaHtml = this._asaLongaPrata('metalPrata');
        haloHtml = '<circle cx="50" cy="50" r="55" fill="#00e5ff" opacity="0.2" filter="url(#glowCiano)"/>';
        break;

      case 'B':
        borderMain = 'url(#metalOuro)';
        borderSub = 'url(#metalBronze)';
        moonStar = 'url(#metalOuro)';
        bg = 'url(#fundoCosmo)';
        innerHtml = this._constelacao();
        asaHtml = this._asaPlumada('metalOuro');
        // Rank B não tem auréola, apenas um leve brilho ciano
        haloHtml = '<circle cx="50" cy="50" r="60" fill="#00e5ff" opacity="0.2" filter="url(#glowCiano)"/>';
        break;

      case 'A':
        borderMain = 'url(#metalOuro)';
        borderSub = 'url(#metalBronze)';
        moonStar = 'url(#metalOuro)';
        bg = 'url(#fundoAzul)';
        asaHtml = this._asaPlumada('metalBronze');
        haloHtml = this._haloAnjo(); // A auréola fica no topo
        break;

      case 'S':
        borderMain = 'url(#metalOuro)';
        borderSub = 'url(#metalOuro)';
        moonStar = 'url(#metalOuro)';
        bg = 'url(#fundoCosmo)';
        innerHtml = this._constelacao();
        asaHtml = this._asaS(true, false);
        haloHtml = this._anelRunicoBasico();
        break;

      case 'N':
        borderMain = 'url(#metalOuro)';
        borderSub = 'url(#metalOuro)';
        moonStar = 'url(#metalOuro)';
        bg = 'url(#galaxia)';
        innerHtml = this._galaxia();
        asaHtml = this._asaS(true, true); // Expandida
        haloHtml = this._anelCosmico();
        
        // Joias incrustadas no próprio escudo
        gemasAro = `
          <polygon points="50,4 53,8 47,8" fill="url(#gemaCiano)"/>
          <polygon points="12,24 16,24 14,28" fill="url(#gemaCiano)"/>
          <polygon points="88,24 84,24 86,28" fill="url(#gemaCiano)"/>
          <polygon points="12,70 16,70 14,66" fill="url(#gemaCiano)"/>
          <polygon points="88,70 84,70 86,66" fill="url(#gemaCiano)"/>
          <polygon points="50,97 53,93 47,93" fill="url(#gemaCiano)"/>
        `;
        break;
    }

    // Para ranks com elementos massivos, aumenta o viewBox e desloca o centro
    // para não cortar halos ou asas longas.
    let vb = "0 0 100 100";
    let tr = "translate(0, 0)";
    if (L === 'C' || L === 'B' || L === 'A' || L === 'S' || L === 'N') {
      vb = "-30 -30 160 160"; // Expande 30px pra todos os lados
    }

    return this._unico(`
<svg viewBox="${vb}" width="${tam}" height="${tam}" class="escudo-rank escudo-${L}" aria-hidden="true" style="max-width:none; overflow:visible;">
  <defs>
    ${this._gradientesComuns}
  </defs>

  <!-- 1. Halos e Magia ao fundo -->
  ${haloHtml}

  <!-- 2. Asas -->
  ${asaHtml}

  <!-- 3. Escudo Base -->
  <g filter="url(#shadowG)">
    <path d="${this._paths.hexExterno}" fill="${borderMain}" stroke="${borderSub}" stroke-width="1.5"/>
    <!-- Linha de detalhe interno na borda (chanfro) -->
    <path d="M50 11 L82 26 L82 68 L50 92 L18 68 L18 26 Z" fill="none" stroke="#ffffff" stroke-width="0.5" opacity="0.4"/>
    
    <!-- 4. Fundo do Escudo -->
    <path d="${this._paths.hexInterno}" fill="${bg}" filter="url(#shadow)"/>
    
    <!-- 5. Detalhes do Fundo (Estrelas, Galáxia) -->
    ${innerHtml}

    <!-- 6. Lua e Estrela Centrais -->
    <g filter="url(#shadow)">
      <path d="${this._paths.lua}" fill="${moonStar}"/>
      <!-- Brilho na lua -->
      <path d="${this._paths.lua}" fill="none" stroke="#fff" stroke-width="0.5" opacity="0.6"/>
      
      <path d="${this._paths.estrela}" fill="${moonStar}"/>
      <!-- Brilho na estrela -->
      <path d="${this._paths.estrela}" fill="none" stroke="#fff" stroke-width="0.3" opacity="0.6"/>
    </g>

    <!-- 7. Joias do Aro (Rank N) -->
    ${gemasAro}
  </g>
</svg>`);
  }
};

// Export (caso seja usado em node)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Escudos;
}
