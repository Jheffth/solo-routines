/* ============================================================
   escudos-v2.js — A Forja dos Escudos Lunares V2 (Masterpiece)
   
   Reescrita total focada em volumetria, proporção áurea,
   extrusão metálica e asas desenhadas à mão (padrão Fênix).
   ============================================================ */

const EscudosV2 = {
  _seq: 0,

  _unico(svg) {
    const selo = `v3esc${++this._seq}`;
    const ids = new Set();
    svg.replace(/\sid="([^"]+)"/g, (_, id) => { ids.add(id); return ''; });
    ids.forEach(id => {
      const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      svg = svg.replace(new RegExp(`\\sid="${esc}"`, 'g'), ` id="${id}-${selo}"`)
               .replace(new RegExp(`url\\(#${esc}\\)`, 'g'), `url(#${id}-${selo})`);
    });
    return svg;
  },

  _gradientes: `
    <!-- Prata Imperial -->
    <linearGradient id="prataTopo" x1="0" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="40%" stop-color="#a0b3c6"/>
      <stop offset="80%" stop-color="#556b82"/>
      <stop offset="100%" stop-color="#2a3c50"/>
    </linearGradient>
    <linearGradient id="prataBase" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="60%" stop-color="#475569"/>
      <stop offset="100%" stop-color="#94a3b8"/>
    </linearGradient>
    <linearGradient id="prataBrilho" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="50%" stop-color="#94a3b8" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.8"/>
    </linearGradient>

    <!-- Ouro Real -->
    <linearGradient id="ouroTopo" x1="0" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stop-color="#fff8d6"/>
      <stop offset="35%" stop-color="#f5cc42"/>
      <stop offset="70%" stop-color="#b8860b"/>
      <stop offset="100%" stop-color="#5e410b"/>
    </linearGradient>
    <linearGradient id="ouroBase" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3b2400"/>
      <stop offset="50%" stop-color="#8a5c00"/>
      <stop offset="100%" stop-color="#fceda4"/>
    </linearGradient>
    <linearGradient id="ouroBrilho" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="50%" stop-color="#ffd700" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.9"/>
    </linearGradient>

    <!-- Bronze Nobre -->
    <linearGradient id="bronzeTopo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f5d6a9"/>
      <stop offset="40%" stop-color="#c47a3f"/>
      <stop offset="80%" stop-color="#7a3e14"/>
      <stop offset="100%" stop-color="#3d1b06"/>
    </linearGradient>
    
    <!-- Fundo Azul Estelar (Ranks Iniciais) -->
    <radialGradient id="fundoAzul" cx="50%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#223e63"/>
      <stop offset="100%" stop-color="#0a1324"/>
    </radialGradient>

    <!-- Fundo Galáxia (S e N) -->
    <radialGradient id="fundoCosmo" cx="50%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#2a124a"/>
      <stop offset="50%" stop-color="#12183b"/>
      <stop offset="100%" stop-color="#050714"/>
    </radialGradient>

    <!-- Filtros de Iluminação Profunda -->
    <filter id="shadowForte" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000" flood-opacity="0.8"/>
    </filter>
    <filter id="shadowLeve" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.6"/>
    </filter>
    <filter id="glowCiano" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="glowOuro" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="insetCavity">
      <feOffset dx="0" dy="4"/>
      <feGaussianBlur stdDeviation="4" result="offset-blur"/>
      <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse"/>
      <feFlood flood-color="black" flood-opacity="1" result="color"/>
      <feComposite operator="in" in="color" in2="inverse" result="shadow"/>
      <feComposite operator="over" in="shadow" in2="SourceGraphic"/>
    </filter>
  `,

  /* =========================================================================
     1. O ESCUDO 3D (BASE HEXAGONAL ROBUSTA)
     A moldura é larga, extrudada e com chanfros de luz.
     ========================================================================= */
  _escudoBase(material) {
    const topo = `url(#${material}Topo)`;
    const base = `url(#${material}Base)`;
    const brilho = `url(#${material}Brilho)`;

    return `
      <!-- 1.1 Chanfro de Sombra (Bisel Inferior Direito) -->
      <path d="M100 20 L170 60 L170 140 L100 180 L30 140 L30 60 Z" fill="${base}" filter="url(#shadowForte)"/>
      
      <!-- 1.2 Chanfro de Luz (Bisel Superior Esquerdo) -->
      <path d="M100 22 L166 61 L166 138 L100 176 L34 138 L34 61 Z" fill="${topo}"/>
      
      <!-- 1.3 Degrau Metálico Central -->
      <path d="M100 36 L154 68 L154 130 L100 162 L46 130 L46 68 Z" fill="${base}"/>
      <path d="M100 38 L151 69 L151 128 L100 158 L49 128 L49 69 Z" fill="${brilho}"/>
      
      <!-- 1.4 A Cavidade (Fundo do Escudo) -->
      <path d="M100 44 L144 71 L144 125 L100 151 L56 125 L56 71 Z" fill="var(--fundo)" filter="url(#insetCavity)"/>
    `;
  },

  /* =========================================================================
     2. A LUA E A ESTRELA (LAPIDAÇÃO 3D REAL)
     A lua usa arcos perfeitos e um offset para gerar a espessura.
     ========================================================================= */
  _luaEstrela(material) {
    const topo = `url(#${material}Topo)`;
    const base = `url(#${material}Base)`;
    const brilho = `url(#${material}Brilho)`;

    return `
      <g filter="url(#shadowLeve)">
        <!-- Lua - Base Escura (Sombra 3D) -->
        <path d="M96 68 A 28 28 0 1 0 96 128 A 38 38 0 1 1 96 68 Z" fill="${base}"/>
        <!-- Lua - Topo Iluminado -->
        <path d="M94 69 A 28 28 0 1 0 94 127 A 37 37 0 1 1 94 69 Z" fill="${topo}"/>
        <!-- Lua - Especular -->
        <path d="M93 70 A 28 28 0 1 0 93 126 A 37 37 0 1 1 93 70 Z" fill="${brilho}" opacity="0.6"/>

        <!-- Estrela 3D Facetada (Centro em 118, 98, raio 10) -->
        <!-- Facetas de Luz -->
        <polygon points="118,98 118,84 114,94" fill="${brilho}"/>
        <polygon points="118,98 132,94 122,100" fill="${brilho}"/>
        <polygon points="118,98 126,110 118,103" fill="${brilho}"/>
        <polygon points="118,98 106,108 112,100" fill="${brilho}"/>
        <polygon points="118,98 104,92 114,94" fill="${brilho}"/>
        <!-- Facetas de Sombra -->
        <polygon points="118,98 118,84 122,94" fill="${base}"/>
        <polygon points="118,98 132,94 126,102" fill="${base}"/>
        <polygon points="118,98 126,110 120,103" fill="${base}"/>
        <polygon points="118,98 106,108 114,103" fill="${base}"/>
        <polygon points="118,98 104,92 110,98" fill="${base}"/>
      </g>
    `;
  },

  /* =========================================================================
     3. AS ASAS (ESCULPIDAS À MÃO, NÃO GERADAS POR LOOP)
     Estas asas são projetadas para abraçar o escudo perfeitamente.
     ========================================================================= */
  
  _asasDef() {
    return `
      <!-- Asa Prata Sólida (Ranks E, D) -->
      <g id="asaSolida">
        <path d="M30 65 L-10 40 L-15 50 L20 80 Z" fill="url(#prataBase)"/>
        <path d="M30 65 L-5 45 L-10 48 L22 75 Z" fill="url(#prataTopo)"/>
        <path d="M25 80 L-18 60 L-22 75 L15 100 Z" fill="url(#prataBase)"/>
        <path d="M25 80 L-10 65 L-15 72 L18 95 Z" fill="url(#prataTopo)"/>
        <path d="M20 95 L-10 90 L-12 110 L18 115 Z" fill="url(#prataBase)"/>
        <path d="M20 95 L-5 92 L-6 105 L18 110 Z" fill="url(#prataTopo)"/>
      </g>

      <!-- Asa Prata Plumada (Rank C) -->
      <g id="asaPrataPluma">
        <path d="M30 70 C 0 50, -20 20, -25 35 C -20 60, 5 80, 25 85 Z" fill="url(#prataBase)"/>
        <path d="M28 72 C 5 55, -12 30, -18 40 C -15 58, 5 75, 23 80 Z" fill="url(#prataTopo)"/>
        
        <path d="M25 85 C -10 70, -30 45, -35 65 C -25 90, 0 100, 20 100 Z" fill="url(#prataBase)"/>
        <path d="M23 87 C -5 75, -20 55, -25 70 C -18 88, 0 95, 18 95 Z" fill="url(#prataTopo)"/>
        
        <path d="M20 100 C -5 95, -25 80, -30 105 C -15 120, 5 115, 25 110 Z" fill="url(#prataBase)"/>
        <path d="M18 98 C -2 95, -15 85, -20 102 C -10 112, 5 110, 20 105 Z" fill="url(#prataTopo)"/>
      </g>

      <!-- Asa Ouro Imperial (Ranks B, A, S, N) -->
      <g id="asaOuroMagne" filter="url(#shadowForte)">
        <!-- Pena Suprema Superior -->
        <path d="M30 65 C -10 40, -40 0, -45 15 C -30 50, -5 75, 25 85 Z" fill="url(#ouroBase)"/>
        <path d="M30 66 C -5 45, -30 10, -35 20 C -25 50, 0 72, 23 82 Z" fill="url(#ouroTopo)"/>
        <path d="M30 66 C -5 45, -30 10, -35 20 C -25 50, 0 72, 23 82 Z" fill="url(#ouroBrilho)" opacity="0.4"/>
        
        <!-- Pena Majestosa Média -->
        <path d="M25 85 C -20 65, -55 35, -60 55 C -45 90, -10 105, 20 105 Z" fill="url(#ouroBase)"/>
        <path d="M25 86 C -10 70, -40 45, -45 60 C -35 88, -5 100, 18 100 Z" fill="url(#ouroTopo)"/>
        <path d="M25 86 C -10 70, -40 45, -45 60 C -35 88, -5 100, 18 100 Z" fill="url(#ouroBrilho)" opacity="0.3"/>
        
        <!-- Pena Larga Inferior -->
        <path d="M20 105 C -15 95, -50 75, -55 100 C -35 125, -5 125, 25 120 Z" fill="url(#ouroBase)"/>
        <path d="M20 106 C -10 98, -40 85, -42 102 C -28 120, 0 118, 22 115 Z" fill="url(#ouroTopo)"/>
        
        <!-- Escudo de Ouro (Cobre a base das penas) -->
        <path d="M35 70 C 5 80, -5 110, 15 130 C 25 115, 30 90, 35 70 Z" fill="url(#ouroBase)"/>
        <path d="M32 72 C 10 82, 0 108, 17 125 C 24 112, 28 92, 32 72 Z" fill="url(#ouroTopo)"/>
      </g>
      
      <!-- Asa Bronze Nobre (Rank A) -->
      <g id="asaBronzeMagne" filter="url(#shadowForte)">
        <!-- Mesma curvatura da ouro, mas com cores bronze -->
        <path d="M30 65 C -10 40, -40 0, -45 15 C -30 50, -5 75, 25 85 Z" fill="url(#bronzeTopo)"/>
        <path d="M25 85 C -20 65, -55 35, -60 55 C -45 90, -10 105, 20 105 Z" fill="url(#bronzeTopo)"/>
        <path d="M20 105 C -15 95, -50 75, -55 100 C -35 125, -5 125, 25 120 Z" fill="url(#bronzeTopo)"/>
        <path d="M35 70 C 5 80, -5 110, 15 130 C 25 115, 30 90, 35 70 Z" fill="url(#ouroTopo)"/>
      </g>
    `;
  },

  // Joia cravada S-Rank
  _joia(cx, cy, r) {
    const l = r * 0.8;
    return `
      <g filter="url(#shadowLeve)">
        <polygon points="${cx},${cy-r} ${cx+r},${cy} ${cx},${cy+r} ${cx-r},${cy}" fill="#004d4d"/>
        <polygon points="${cx},${cy-r} ${cx+r},${cy} ${cx+l},${cy-l} ${cx-l},${cy-l}" fill="#00ced1"/>
        <polygon points="${cx-r},${cy} ${cx},${cy-r} ${cx-l},${cy-l} ${cx-l},${cy+l}" fill="#e0ffff" opacity="0.8"/>
        <polygon points="${cx-l},${cy-l} ${cx+l},${cy-l} ${cx+l},${cy+l} ${cx-l},${cy+l}" fill="#00ffff"/>
        <circle cx="${cx-l*0.5}" cy="${cy-l*0.5}" r="${r*0.2}" fill="#fff" filter="url(#glowCiano)"/>
      </g>
    `;
  },

  /* =========================================================================
     4. CONSTRUTOR DE RANKS
     ========================================================================= */

  rank(letra, tam = 100) {
    const L = String(letra || 'E').toUpperCase();
    
    let materialBase = 'prata';
    let varFundo = 'url(#fundoAzul)';
    let asa = '', magia = '', joias = '';

    // Estrelas de fundo
    const estrelas = `
      <circle cx="70" cy="80" r="1.5" fill="#fff" opacity="0.6"/>
      <circle cx="130" cy="100" r="2" fill="#fff" opacity="0.8"/>
      <circle cx="90" cy="130" r="1" fill="#fff" opacity="0.5"/>
      <circle cx="120" cy="75" r="1.5" fill="#fff" opacity="0.7"/>
    `;

    switch (L) {
      case 'E':
        asa = `<use href="#asaSolida"/><use href="#asaSolida" transform="translate(200, 0) scale(-1, 1)"/>`;
        break;

      case 'D':
        magia = `<circle cx="100" cy="100" r="85" fill="none" stroke="#00ced1" stroke-width="0.5" opacity="0.3" filter="url(#glowCiano)"/>`;
        // Usa asa sólida escalada
        asa = `<use href="#asaSolida" transform="scale(1.2) translate(-15, -15)"/><use href="#asaSolida" transform="translate(200, 0) scale(-1.2, 1.2) translate(-15, -15)"/>`;
        break;

      case 'C':
        materialBase = 'prata';
        varFundo = 'url(#fundoCosmo)';
        magia = `<circle cx="100" cy="100" r="90" fill="none" stroke="#00ced1" stroke-width="1.5" opacity="0.6" filter="url(#glowCiano)"/>`;
        asa = `<use href="#asaPrataPluma"/><use href="#asaPrataPluma" transform="translate(200, 0) scale(-1, 1)"/>`;
        break;

      case 'B':
        materialBase = 'ouro';
        varFundo = 'url(#fundoCosmo)';
        magia = `<circle cx="100" cy="100" r="95" fill="none" stroke="#ffd700" stroke-width="1.5" opacity="0.5" filter="url(#glowOuro)"/>`;
        asa = `<use href="#asaOuroMagne"/><use href="#asaOuroMagne" transform="translate(200, 0) scale(-1, 1)"/>`;
        break;

      case 'A':
        materialBase = 'ouro';
        varFundo = 'url(#fundoAzul)';
        // Halo de Anjo no topo
        magia = `
          <g filter="url(#glowOuro)">
            <ellipse cx="100" cy="-10" rx="45" ry="12" fill="none" stroke="#ffd700" stroke-width="4"/>
            <ellipse cx="100" cy="-10" rx="45" ry="12" fill="none" stroke="#ffffff" stroke-width="1"/>
          </g>
        `;
        asa = `<use href="#asaBronzeMagne"/><use href="#asaBronzeMagne" transform="translate(200, 0) scale(-1, 1)"/>`;
        break;

      case 'S':
        materialBase = 'ouro';
        varFundo = 'url(#fundoCosmo)';
        magia = `
          <g filter="url(#glowOuro)" opacity="0.9">
            <circle cx="100" cy="100" r="105" fill="none" stroke="#ffd700" stroke-width="2" stroke-dasharray="15 8"/>
            <circle cx="100" cy="100" r="95" fill="none" stroke="#fff" stroke-width="0.5"/>
            <!-- Geometria rúnica cravada -->
            <polygon points="100,-5 190,150 10,150" fill="none" stroke="#ffd700" stroke-width="1.5" opacity="0.7"/>
            <polygon points="100,205 190,50 10,50" fill="none" stroke="#ffd700" stroke-width="1.5" opacity="0.7"/>
          </g>
        `;
        asa = `<use href="#asaOuroMagne"/><use href="#asaOuroMagne" transform="translate(200, 0) scale(-1, 1)"/>`;
        joias = this._joia(45, 80, 7) + this._joia(155, 80, 7)
              + this._joia(35, 110, 6) + this._joia(165, 110, 6);
        break;

      case 'N':
        materialBase = 'ouro';
        varFundo = 'url(#fundoCosmo)';
        // Fundo Galáxia Extra Denso
        magia = `
          <circle cx="100" cy="100" r="115" fill="none" stroke="#00ced1" stroke-width="3" filter="url(#glowCiano)"/>
          <circle cx="100" cy="100" r="108" fill="none" stroke="#ffd700" stroke-width="1.5" stroke-dasharray="4 8" filter="url(#glowOuro)"/>
          
          <!-- Luas Orbitais Nacionais -->
          <circle cx="100" cy="-15" r="5" fill="#00ffff" filter="url(#glowCiano)"/>
          <circle cx="100" cy="215" r="5" fill="#00ffff" filter="url(#glowCiano)"/>
          <circle cx="-15" cy="100" r="5" fill="#00ffff" filter="url(#glowCiano)"/>
          <circle cx="215" cy="100" r="5" fill="#00ffff" filter="url(#glowCiano)"/>
          
          <!-- Nebulosa -->
          <circle cx="80" cy="80" r="30" fill="#6a1b9a" opacity="0.5" filter="url(#glowCiano)"/>
          <circle cx="120" cy="120" r="25" fill="#00e5ff" opacity="0.4" filter="url(#glowCiano)"/>
        `;
        // Asas Nacionais Magnificadas
        asa = `<use href="#asaOuroMagne" transform="scale(1.2) translate(-15, -15)"/>
               <use href="#asaOuroMagne" transform="translate(200, 0) scale(-1.2, 1.2) translate(-15, -15)"/>`;
        
        // Joias densas ao longo da moldura e asas
        joias = this._joia(100, 25, 5) + this._joia(100, 170, 5)
              + this._joia(38, 65, 4) + this._joia(162, 65, 4)
              + this._joia(38, 133, 4) + this._joia(162, 133, 4)
              // Joias nas asas
              + this._joia(25, 60, 8) + this._joia(175, 60, 8)
              + this._joia(15, 100, 7) + this._joia(185, 100, 7)
              + this._joia(20, 135, 6) + this._joia(180, 135, 6);
        break;
    }

    // Viewport gigante (200x200 de base) com margem farta para efeitos orbitais
    const vb = "-50 -50 300 300";

    return this._unico(`
<svg viewBox="${vb}" width="${tam}" height="${tam}" class="escudo-v2 escudo-${L}" style="max-width:none; overflow:visible; --fundo:${varFundo};">
  <defs>
    ${this._gradientes}
    ${this._asasDef()}
  </defs>

  <!-- Magia de Fundo, Halos, Anéis Cósmicos -->
  ${magia}

  <!-- Asas Atrás do Escudo -->
  ${asa}

  <!-- Escudo Base com Extrusão Metálica Real -->
  ${this._escudoBase(materialBase)}
  
  <!-- Estrelas no poço -->
  ${estrelas}

  <!-- Lua Crescente Biselada e Estrela Facetada -->
  ${this._luaEstrela(materialBase)}
  
  <!-- Joias de Rank S/N (Sobrepostas a tudo) -->
  ${joias}
</svg>`);
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EscudosV2;
}
