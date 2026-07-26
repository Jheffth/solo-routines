/* ============================================================
   escudos-v2.js — A Forja dos Escudos Lunares V2 (Masterpiece)
   
   Gera emblemas S-Rank com volumetria real: chanfros, biséis,
   penas sobrepostas individuais e joias lapidadas.
   100% Matemática Vetorial.
   ============================================================ */

const EscudosV2 = {
  _seq: 0,

  _unico(svg) {
    const selo = `v2esc${++this._seq}`;
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
    <!-- Prata Fria (Ranks E, D, C) -->
    <linearGradient id="prataTopo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="30%" stop-color="#aeb9c4"/>
      <stop offset="100%" stop-color="#556475"/>
    </linearGradient>
    <linearGradient id="prataBase" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3c4a59"/>
      <stop offset="70%" stop-color="#728498"/>
      <stop offset="100%" stop-color="#e0e8f0"/>
    </linearGradient>
    <linearGradient id="prataBrilho" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="50%" stop-color="#8a9ba8" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#2c3a47"/>
    </linearGradient>

    <!-- Ouro Quente (Ranks B, A, S, N) -->
    <linearGradient id="ouroTopo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff8d6"/>
      <stop offset="40%" stop-color="#d4af37"/>
      <stop offset="100%" stop-color="#8a611c"/>
    </linearGradient>
    <linearGradient id="ouroBase" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5e410b"/>
      <stop offset="50%" stop-color="#b8860b"/>
      <stop offset="100%" stop-color="#fceda4"/>
    </linearGradient>
    <linearGradient id="ouroBrilho" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="40%" stop-color="#ffd700" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#4a3000"/>
    </linearGradient>

    <!-- Bronze/Ouro Escuro (Rank A) -->
    <linearGradient id="bronzeTopo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f5d6a9"/>
      <stop offset="50%" stop-color="#b87333"/>
      <stop offset="100%" stop-color="#5c3317"/>
    </linearGradient>

    <!-- Joia Ciano (S, N) -->
    <linearGradient id="gemaCianoClaro" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#e0ffff"/>
      <stop offset="100%" stop-color="#00ced1"/>
    </linearGradient>
    <linearGradient id="gemaCianoEscuro" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#008b8b"/>
      <stop offset="100%" stop-color="#004d4d"/>
    </linearGradient>

    <!-- Fundos -->
    <radialGradient id="fundoProfundo" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#1e3459"/>
      <stop offset="60%" stop-color="#0b172a"/>
      <stop offset="100%" stop-color="#040914"/>
    </radialGradient>
    <radialGradient id="fundoCosmoReal" cx="40%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#301f54"/>
      <stop offset="40%" stop-color="#0a122e"/>
      <stop offset="100%" stop-color="#000000"/>
    </radialGradient>

    <!-- Filtros de Volume (Bevel, Inset Shadow e Drop Shadow) -->
    <filter id="insetShadow">
      <feOffset dx="0" dy="3"/>
      <feGaussianBlur stdDeviation="3" result="offset-blur"/>
      <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse"/>
      <feFlood flood-color="black" flood-opacity="0.9" result="color"/>
      <feComposite operator="in" in="color" in2="inverse" result="shadow"/>
      <feComposite operator="over" in="shadow" in2="SourceGraphic"/>
    </filter>
    <filter id="sombraPenas" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="1" dy="2" stdDeviation="1.5" flood-color="#000" flood-opacity="0.6"/>
    </filter>
    <filter id="sombraMestra" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#000" flood-opacity="0.75"/>
    </filter>
    <filter id="glowForte" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="glowDivino" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="8" result="blur1"/>
      <feGaussianBlur stdDeviation="3" result="blur2"/>
      <feMerge>
        <feMergeNode in="blur1"/>
        <feMergeNode in="blur2"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  `,

  /* --- GEOMETRIA 3D CORE --- */

  // O Hexágono base esculpido com profundidade real.
  _escudoBase(material) {
    // material: 'prata', 'ouro', 'bronze'
    const topo = `url(#${material}Topo)`;
    const base = `url(#${material}Base)`;
    const brilho = `url(#${material}Brilho)`;

    return `
      <g filter="url(#sombraMestra)">
        <!-- 1. Borda Externa (Sombra Inferior/Bevel) -->
        <path d="M50 4 L92 24 L92 72 L50 97 L8 72 L8 24 Z" fill="${base}"/>
        <!-- 2. Borda Externa (Luz Superior/Bevel) -->
        <path d="M50 6 L89 25 L89 71 L50 94 L11 71 L11 25 Z" fill="${topo}"/>
        
        <!-- 3. Friso central metálico (Degrau interno) -->
        <path d="M50 14 L81 29 L81 67 L50 86 L19 67 L19 29 Z" fill="${base}"/>
        <path d="M50 15 L79 30 L79 66 L50 84 L21 66 L21 30 Z" fill="${brilho}"/>
        
        <!-- 4. Fundo Escuro com Inset Shadow para parecer um buraco raso -->
        <path d="M50 18 L76 31 L76 64 L50 80 L24 64 L24 31 Z" fill="url(#fundoProfundo)" filter="url(#insetShadow)"/>
      </g>
    `;
  },

  // Lua Crescente em 3D (Reflexo Metálico curvo)
  _lua3D(material) {
    const cor = `url(#${material}Topo)`;
    const reflexo = `url(#${material}Brilho)`;
    
    // A lua é construída com duas elipses booleanas na prática, mas em SVG
    // desenhamos o path exato. Para o 3D, duplicamos deslocando levemente.
    return `
      <g filter="url(#sombraPenas)">
        <!-- Corpo Base Sombra -->
        <path d="M50 32 C 34 32, 28 46, 28 58 C 28 70, 36 80, 50 80 C 62 80, 56 70, 50 66 C 40 58, 40 48, 50 42 C 55 38, 62 32, 50 32 Z" fill="url(#${material}Base)"/>
        <!-- Corpo Base Luz (Bevel) -->
        <path d="M49 33 C 35 33, 29 46, 29 57 C 29 68, 36 78, 49 78 C 60 78, 55 69, 49 65 C 40 58, 40 48, 49 43 C 54 39, 60 33, 49 33 Z" fill="${cor}"/>
        <!-- Specular Highlight (Brilho da borda) -->
        <path d="M48 34 C 36 34, 30 46, 30 56 C 30 67, 36 76, 48 76 C 45 76, 33 66, 33 56 C 33 46, 39 35, 48 34 Z" fill="#ffffff" opacity="0.6"/>
      </g>
    `;
  },

  // Estrela Facetada (5 pirâmides conectadas no centro cx, cy)
  _estrela3D(cx, cy, r, material) {
    const p = [];
    const n = 5;
    for (let i = 0; i < n * 2; i++) {
      const ang = (i * Math.PI) / n - Math.PI / 2;
      const raio = i % 2 === 0 ? r : r * 0.45;
      p.push({ x: cx + raio * Math.cos(ang), y: cy + raio * Math.sin(ang) });
    }
    
    // Construir 5 triângulos claros e 5 escuros para o brilho facetado
    let faces = '';
    const luz = `url(#${material}Brilho)`;
    const sombra = `url(#${material}Base)`;
    
    for (let i = 0; i < n; i++) {
      const pTop = p[i * 2];
      const pLeft = p[(i * 2 + 9) % 10]; // Vértice interno anterior
      const pRight = p[(i * 2 + 1) % 10]; // Vértice interno seguinte
      
      faces += `
        <polygon points="${cx},${cy} ${pTop.x},${pTop.y} ${pLeft.x},${pLeft.y}" fill="${sombra}" />
        <polygon points="${cx},${cy} ${pTop.x},${pTop.y} ${pRight.x},${pRight.y}" fill="${luz}" />
      `;
    }
    return `<g filter="url(#sombraPenas)">${faces}</g>`;
  },

  // Joia Ciano Facetada (Skill Fable5)
  _gemaLapidada(cx, cy, r) {
    const top = cy - r, bot = cy + r, left = cx - r, right = cx + r;
    const m = r * 0.4; // Tamanho da "mesa" (topo plano)
    
    return `
      <g filter="url(#sombraPenas)">
        <!-- Base Escura -->
        <polygon points="${cx},${top} ${right},${cy} ${cx},${bot} ${left},${cy}" fill="url(#gemaCianoEscuro)"/>
        <!-- Facetas de Luz -->
        <polygon points="${cx},${top} ${right},${cy} ${cx+m},${cy-m} ${cx-m},${cy-m}" fill="url(#gemaCianoClaro)" opacity="0.8"/>
        <polygon points="${left},${cy} ${cx},${top} ${cx-m},${cy-m} ${cx-m},${cy+m}" fill="#ffffff" opacity="0.6"/>
        <!-- Mesa -->
        <polygon points="${cx-m},${cy-m} ${cx+m},${cy-m} ${cx+m},${cy+m} ${cx-m},${cy+m}" fill="#00ffff" opacity="0.9"/>
        <!-- Ponto de Brilho -->
        <circle cx="${cx-m*0.5}" cy="${cy-m*0.5}" r="${r*0.15}" fill="#ffffff" filter="url(#glowForte)"/>
      </g>
    `;
  },

  /* --- SISTEMA DE ASAS PLUMADAS --- */
  
  // Pluma unitária
  _pena(x, y, escX, escY, angulo, gradBase) {
    return `
      <g transform="translate(${x},${y}) rotate(${angulo}) scale(${escX}, ${escY})">
        <!-- Estrutura curva de uma pena -->
        <path d="M0,0 C10,-5 25,0 30,15 C20,12 5,10 0,0 Z" fill="${gradBase}" filter="url(#sombraPenas)"/>
        <!-- Raque central da pena -->
        <path d="M0,0 C10,-2 20,3 28,14" fill="none" stroke="#ffffff" stroke-width="0.5" opacity="0.5"/>
      </g>
    `;
  },

  // Gera uma asa varrendo um arco
  _asaPlumada(cx, cy, lado, material, qtd, raioInic, raioFim, angInic, angFim, escI, escF) {
    // lado: 1 para direita, -1 para esquerda
    let html = '';
    const grad = `url(#${material}Topo)`;
    
    for (let i = 0; i < qtd; i++) {
      const p = i / (qtd - 1 || 1);
      const raio = raioInic + (raioFim - raioInic) * p;
      const angBase = angInic + (angFim - angInic) * p;
      const esc = escI + (escF - escI) * p;
      
      const x = cx + Math.cos(angBase * Math.PI / 180) * raio * lado;
      const y = cy + Math.sin(angBase * Math.PI / 180) * raio;
      
      // A rotação da pena depende da posição dela
      const angPena = angBase + (lado === 1 ? -15 : 195); 
      
      html += this._pena(x, y, esc * lado, esc, angPena, grad);
    }
    return html;
  },

  // Asas Mecânicas/Sólidas (Para Ranks E, D)
  _asaSolida(material, extensao) {
    const topo = `url(#${material}Topo)`;
    const base = `url(#${material}Base)`;
    
    const e = extensao === 'longa' ? 1.4 : 1;
    
    return `
      <g filter="url(#sombraMestra)">
        <!-- Esq -->
        <path d="M12 ${30*e} L-10 ${10*e} L-15 ${30*e} L8 ${40*e} Z" fill="${base}"/>
        <path d="M10 ${30*e} L-8 ${12*e} L-12 ${28*e} L6 ${38*e} Z" fill="${topo}"/>
        
        <path d="M12 ${42*e} L-15 ${35*e} L-18 ${50*e} L6 ${52*e} Z" fill="${base}"/>
        <path d="M10 ${42*e} L-12 ${37*e} L-14 ${48*e} L5 ${50*e} Z" fill="${topo}"/>
        
        <path d="M12 ${54*e} L-10 ${60*e} L-8 ${75*e} L10 ${64*e} Z" fill="${base}"/>
        <path d="M10 ${54*e} L-8 ${60*e} L-6 ${72*e} L8 ${62*e} Z" fill="${topo}"/>
        
        <!-- Dir -->
        <path d="M88 ${30*e} L110 ${10*e} L115 ${30*e} L92 ${40*e} Z" fill="${base}"/>
        <path d="M90 ${30*e} L108 ${12*e} L112 ${28*e} L94 ${38*e} Z" fill="${topo}"/>
        
        <path d="M88 ${42*e} L115 ${35*e} L118 ${50*e} L94 ${52*e} Z" fill="${base}"/>
        <path d="M90 ${42*e} L112 ${37*e} L114 ${48*e} L95 ${50*e} Z" fill="${topo}"/>
        
        <path d="M88 ${54*e} L110 ${60*e} L108 ${75*e} L90 ${64*e} Z" fill="${base}"/>
        <path d="M90 ${54*e} L108 ${60*e} L106 ${72*e} L92 ${62*e} Z" fill="${topo}"/>
      </g>
    `;
  },

  /* --- CONSTRUTORES DE RANK --- */

  rank(letra, tam = 100) {
    const L = String(letra || 'E').toUpperCase();
    
    let materialBase = 'prata';
    let asaEsq = '', asaDir = '', extras = '', fundo = '';
    
    // Background comum a todos (pode ser sobreposto)
    fundo = `
      <g opacity="0.4">
        <circle cx="35" cy="40" r="1" fill="#fff"/>
        <circle cx="65" cy="50" r="1.5" fill="#fff"/>
        <circle cx="45" cy="65" r="1" fill="#fff"/>
        <path d="M35 40 L45 65 L65 50" fill="none" stroke="#fff" stroke-width="0.3"/>
      </g>
    `;

    switch (L) {
      case 'E':
        asaEsq = this._asaSolida('prata', 'curta');
        break;

      case 'D':
        asaEsq = this._asaSolida('prata', 'longa');
        fundo += '<circle cx="50" cy="50" r="60" fill="none" stroke="#00ced1" stroke-width="0.5" opacity="0.3" filter="url(#glowForte)"/>';
        break;

      case 'C':
        materialBase = 'prata';
        fundo += '<circle cx="50" cy="50" r="65" fill="none" stroke="#00ced1" stroke-width="1" opacity="0.5" filter="url(#glowForte)"/>';
        // Asas C são pratas, mas já plumadas
        asaEsq = this._asaPlumada(10, 50, -1, 'prata', 12, 10, 35, 270, 150, 0.5, 1.2);
        asaDir = this._asaPlumada(90, 50,  1, 'prata', 12, 10, 35, 270, 390, 0.5, 1.2);
        break;

      case 'B':
        materialBase = 'ouro';
        fundo += '<circle cx="50" cy="50" r="70" fill="none" stroke="#d4af37" stroke-width="1" opacity="0.3" filter="url(#glowForte)"/>';
        // Asas grandes de ouro
        asaEsq = this._asaPlumada(10, 50, -1, 'ouro', 16, 5, 45, 270, 120, 0.6, 1.5);
        asaDir = this._asaPlumada(90, 50,  1, 'ouro', 16, 5, 45, 270, 420, 0.6, 1.5);
        break;

      case 'A':
        materialBase = 'ouro'; // A imagem mostra escudo ouro/bronze
        // Auréola flutuante
        extras += `
          <g filter="url(#glowDivino)">
            <ellipse cx="50" cy="-15" rx="35" ry="10" fill="none" stroke="#ffd700" stroke-width="3"/>
            <ellipse cx="50" cy="-15" rx="35" ry="10" fill="none" stroke="#ffffff" stroke-width="1"/>
          </g>
        `;
        // Asas densas de bronze
        asaEsq = this._asaPlumada(15, 45, -1, 'bronze', 20, 0, 50, 270, 110, 0.7, 1.8);
        asaDir = this._asaPlumada(85, 45,  1, 'bronze', 20, 0, 50, 270, 430, 0.7, 1.8);
        break;

      case 'S':
        materialBase = 'ouro';
        // Geometria Sagrada Rúnica
        extras += `
          <g filter="url(#glowDivino)" opacity="0.8">
            <circle cx="50" cy="50" r="75" fill="none" stroke="#ffd700" stroke-width="1.5" stroke-dasharray="10 5"/>
            <circle cx="50" cy="50" r="65" fill="none" stroke="#fff" stroke-width="0.5"/>
            <!-- Hexagrama Mágico -->
            <polygon points="50, -15 106, 82 -6, 82" fill="none" stroke="#ffd700" stroke-width="1" opacity="0.6"/>
            <polygon points="50, 115 106, 18 -6, 18" fill="none" stroke="#ffd700" stroke-width="1" opacity="0.6"/>
          </g>
        `;
        // Asas Magistrais de Ouro
        asaEsq = this._asaPlumada(10, 50, -1, 'ouro', 22, 0, 55, 270, 100, 0.8, 2);
        asaDir = this._asaPlumada(90, 50,  1, 'ouro', 22, 0, 55, 270, 440, 0.8, 2);
        // Joias encrustadas nas asas S
        extras += this._gemaLapidada(-15, 30, 6) + this._gemaLapidada(115, 30, 6)
                + this._gemaLapidada(-25, 50, 5) + this._gemaLapidada(125, 50, 5)
                + this._gemaLapidada(-18, 70, 4) + this._gemaLapidada(118, 70, 4);
        break;

      case 'N':
        materialBase = 'ouro';
        // Fundo Galáxia Realista
        fundo = `
          <rect x="0" y="0" width="100" height="100" fill="url(#fundoCosmoReal)"/>
          <circle cx="40" cy="40" r="20" fill="#6a1b9a" opacity="0.4" filter="url(#glowForte)"/>
          <circle cx="65" cy="65" r="15" fill="#00e5ff" opacity="0.3" filter="url(#glowForte)"/>
          <g fill="#fff" opacity="0.9">
            <circle cx="35" cy="35" r="1.5" filter="url(#glowForte)"/>
            <circle cx="65" cy="70" r="1"/>
            <circle cx="70" cy="30" r="1.2"/>
            <circle cx="30" cy="65" r="1.5" filter="url(#glowForte)"/>
          </g>
        `;
        // Círculo Cósmico Majestoso
        extras += `
          <g filter="url(#glowDivino)" opacity="0.9">
            <circle cx="50" cy="50" r="85" fill="none" stroke="#00ced1" stroke-width="2"/>
            <circle cx="50" cy="50" r="80" fill="none" stroke="#ffd700" stroke-width="1" stroke-dasharray="2 8"/>
            <circle cx="50" cy="50" r="95" fill="none" stroke="#d4af37" stroke-width="0.5"/>
            <!-- Luas orbitais -->
            <circle cx="50" cy="-35" r="4" fill="#00ffff" filter="url(#glowForte)"/>
            <circle cx="50" cy="135" r="4" fill="#00ffff" filter="url(#glowForte)"/>
            <circle cx="-35" cy="50" r="4" fill="#00ffff" filter="url(#glowForte)"/>
            <circle cx="135" cy="50" r="4" fill="#00ffff" filter="url(#glowForte)"/>
          </g>
        `;
        // Asas Extremas Expandidas
        asaEsq = this._asaPlumada(0, 50, -1, 'ouro', 28, 0, 75, 270, 90, 1.0, 2.5);
        asaDir = this._asaPlumada(100, 50,  1, 'ouro', 28, 0, 75, 270, 450, 1.0, 2.5);
        // Joias por toda a asa
        extras += this._gemaLapidada(-35, 20, 8) + this._gemaLapidada(135, 20, 8)
                + this._gemaLapidada(-45, 45, 6) + this._gemaLapidada(145, 45, 6)
                + this._gemaLapidada(-40, 70, 5) + this._gemaLapidada(140, 70, 5)
                + this._gemaLapidada(-25, 90, 4) + this._gemaLapidada(125, 90, 4);
        
        // Joias encrustadas no aro do escudo
        extras += this._gemaLapidada(50, 10, 4)  + this._gemaLapidada(50, 90, 4)
                + this._gemaLapidada(15, 30, 3)  + this._gemaLapidada(85, 30, 3)
                + this._gemaLapidada(15, 70, 3)  + this._gemaLapidada(85, 70, 3);
        break;
    }

    // Viewport expandido para Ranks Superiores devido às asas massivas e círculos
    const vb = (L === 'E' || L === 'D') ? "-20 -20 140 140" : "-60 -60 220 220";

    return this._unico(`
<svg viewBox="${vb}" width="${tam}" height="${tam}" class="escudo-v2 escudo-${L}" style="max-width:none; overflow:visible;">
  <defs>
    ${this._gradientes}
  </defs>

  <!-- 1. Magia de Fundo, Halos, Anéis Cósmicos -->
  ${extras}

  <!-- 2. Asas Volumétricas Atrás do Escudo -->
  <g>
    ${asaEsq}
    ${asaDir}
  </g>

  <!-- 3. Escudo 3D -->
  ${this._escudoBase(materialBase)}
  
  <!-- 4. Estrelas, Galáxias, Fundo do Escudo -->
  <g filter="url(#insetShadow)">
    ${fundo}
  </g>

  <!-- 5. Lua e Estrela Lapidadas em 3D -->
  ${this._lua3D(materialBase)}
  ${this._estrela3D(67, 50, 6, materialBase)}
  
  <!-- Joias Extras do Nacional rendem *após* a lua para ficar por cima -->
  ${L === 'N' ? extras.split('<!-- Joias Extras -->')[1] || '' : ''}
</svg>`);
  }
};

// Export (caso seja usado em node)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EscudosV2;
}
