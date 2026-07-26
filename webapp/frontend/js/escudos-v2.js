/* ============================================================
   escudos-v2.js — A Forja dos Escudos Lunares V2 (Premium)
   
   GEOMETRIA ABSOLUTA: 
   Não usa curvas chutadas. Todas as bordas, luas e penas são 
   fatiadas em polígonos matematicamente simétricos com luz e
   sombra próprias, criando um 3D facetado ultra premium.
   ============================================================ */

const EscudosV2 = {
  _seq: 0,

  _unico(svg) {
    const selo = `v4esc${++this._seq}`;
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
    <!-- PRATA -->
    <linearGradient id="prataLuz" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#94a3b8"/></linearGradient>
    <linearGradient id="prataSombra" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#64748b"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
    <linearGradient id="prataMid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#94a3b8"/><stop offset="100%" stop-color="#475569"/></linearGradient>

    <!-- OURO -->
    <linearGradient id="ouroLuz" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff8d6"/><stop offset="100%" stop-color="#f5cc42"/></linearGradient>
    <linearGradient id="ouroSombra" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#b8860b"/><stop offset="100%" stop-color="#3b2400"/></linearGradient>
    <linearGradient id="ouroMid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f5cc42"/><stop offset="100%" stop-color="#8a5c00"/></linearGradient>

    <!-- BRONZE -->
    <linearGradient id="bronzeLuz" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f5d6a9"/><stop offset="100%" stop-color="#c47a3f"/></linearGradient>
    <linearGradient id="bronzeSombra" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7a3e14"/><stop offset="100%" stop-color="#2d1304"/></linearGradient>

    <!-- CIANO (JOIAS) -->
    <linearGradient id="cianoLuz" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e0ffff"/><stop offset="100%" stop-color="#00ced1"/></linearGradient>
    <linearGradient id="cianoSombra" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#008b8b"/><stop offset="100%" stop-color="#003333"/></linearGradient>

    <!-- Fundo Azul Estelar -->
    <radialGradient id="fundoAzul" cx="50%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#1e3a5f"/>
      <stop offset="100%" stop-color="#0b172a"/>
    </radialGradient>

    <!-- Fundo Galáxia -->
    <radialGradient id="fundoCosmo" cx="50%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#2a124a"/>
      <stop offset="100%" stop-color="#050714"/>
    </radialGradient>

    <!-- Filtros -->
    <filter id="shadowForte" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="6" stdDeviation="4" flood-color="#000" flood-opacity="0.8"/>
    </filter>
    <filter id="shadowPenas" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#000" flood-opacity="0.6"/>
    </filter>
    <filter id="glowDivino" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="innerGlow">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur"/>
      <feFlood flood-color="#000" flood-opacity="0.8"/>
      <feComposite operator="in" in2="blur"/>
      <feComposite operator="arithmetic" k2="-1" k3="1" in2="SourceAlpha" result="inv"/>
      <feComposite operator="over" in2="SourceGraphic"/>
    </filter>
  `,

  /* =========================================================================
     1. MOLDURA HEXAGONAL 3D (FACETADA EM 6 POLÍGONOS DE LUZ E SOMBRA)
     P0(Top), P1(TopRight), P2(BotRight), P3(Bot), P4(BotLeft), P5(TopLeft)
     ========================================================================= */
  _moldura3D(material, scale = 1, cx = 100, cy = 100) {
    // Escala base
    const oR = 50 * scale; // Raio Externo
    const iR = 38 * scale; // Raio Interno
    
    // Calcula os 6 vértices
    const p = (r) => {
      const pts = [];
      for(let i=0; i<6; i++) {
        // Rotacionado 90 graus para o bico ficar em cima e embaixo (pontos 0 e 3)
        const ang = (i * 60 - 90) * Math.PI / 180;
        // Ajuste de achatamento lateral (hexágono de escudo é mais alto que largo)
        pts.push({ x: cx + r * Math.cos(ang) * 0.85, y: cy + r * Math.sin(ang) });
      }
      return pts;
    };

    const out = p(oR);
    const inn = p(iR);

    const lLight = \`url(#\${material}Luz)\`;
    const lMid   = \`url(#\${material}Mid)\`;
    const lDark  = \`url(#\${material}Sombra)\`;

    // 6 Facetas perfeitamente iluminadas (TopLeft é luz, BotRight é sombra)
    return \`
      <g filter="url(#shadowForte)">
        <!-- Top Left (Luz máxima) -->
        <polygon points="\${out[5].x},\${out[5].y} \${out[0].x},\${out[0].y} \${inn[0].x},\${inn[0].y} \${inn[5].x},\${inn[5].y}" fill="\${lLight}"/>
        <!-- Top Right (Luz média) -->
        <polygon points="\${out[0].x},\${out[0].y} \${out[1].x},\${out[1].y} \${inn[1].x},\${inn[1].y} \${inn[0].x},\${inn[0].y}" fill="\${lMid}"/>
        <!-- Right (Sombra) -->
        <polygon points="\${out[1].x},\${out[1].y} \${out[2].x},\${out[2].y} \${inn[2].x},\${inn[2].y} \${inn[1].x},\${inn[1].y}" fill="\${lDark}"/>
        <!-- Bottom Right (Sombra máxima) -->
        <polygon points="\${out[2].x},\${out[2].y} \${out[3].x},\${out[3].y} \${inn[3].x},\${inn[3].y} \${inn[2].x},\${inn[2].y}" fill="#111"/>
        <!-- Bottom Left (Sombra) -->
        <polygon points="\${out[3].x},\${out[3].y} \${out[4].x},\${out[4].y} \${inn[4].x},\${inn[4].y} \${inn[3].x},\${inn[3].y}" fill="\${lDark}"/>
        <!-- Left (Luz média) -->
        <polygon points="\${out[4].x},\${out[4].y} \${out[5].x},\${out[5].y} \${inn[5].x},\${inn[5].y} \${inn[4].x},\${inn[4].y}" fill="\${lMid}"/>
        
        <!-- Friso Interno Extra Metálico para destaque -->
        <polygon points="\${inn.map(v => v.x+','+v.y).join(' ')}" fill="none" stroke="\${lLight}" stroke-width="1.5" opacity="0.8"/>
        
        <!-- Fundo Escudo (Buraco Escuro) -->
        <polygon points="\${inn.map(v => v.x+','+v.y).join(' ')}" fill="var(--fundo)" filter="url(#innerGlow)"/>
      </g>
    \`;
  },

  /* =========================================================================
     2. LUA CRESCENTE E ESTRELA (3D REAL)
     ========================================================================= */
  _luaEstrela(material, scale = 1, cx = 100, cy = 100) {
    const sLuz = \`url(#\${material}Luz)\`;
    const sSombra = \`url(#\${material}Sombra)\`;
    const rArc = 15 * scale;
    const rIn = 12 * scale;
    
    // Desenho de crescente perfeito via Comandos Arc
    // Inicia no topo, desce no arco externo, sobe no arco interno
    const luaBase = \`M \${cx-5*scale},\${cy-15*scale} 
                     A \${rArc} \${rArc} 0 0 0 \${cx-5*scale},\${cy+15*scale} 
                     A \${rIn} \${rIn} 0 0 1 \${cx-5*scale},\${cy-15*scale} Z\`;

    // Estrela 3D (5 pirâmides)
    const eR = 6 * scale;
    const eCx = cx + 10 * scale;
    const eCy = cy;
    let facesEstrela = '';
    const p = [];
    for(let i=0; i<10; i++) {
      const ang = (i * 36 - 90) * Math.PI / 180;
      const raio = i % 2 === 0 ? eR : eR * 0.45;
      p.push({ x: eCx + raio * Math.cos(ang), y: eCy + raio * Math.sin(ang) });
    }
    for(let i=0; i<5; i++) {
      facesEstrela += \`<polygon points="\${eCx},\${eCy} \${p[i*2].x},\${p[i*2].y} \${p[(i*2+9)%10].x},\${p[(i*2+9)%10].y}" fill="\${sSombra}"/>\`;
      facesEstrela += \`<polygon points="\${eCx},\${eCy} \${p[i*2].x},\${p[i*2].y} \${p[(i*2+1)%10].x},\${p[(i*2+1)%10].y}" fill="\${sLuz}"/>\`;
    }

    return \`
      <g filter="url(#shadowForte)">
        <!-- Lua 3D Sombra e Luz (Offset simulando espessura) -->
        <path d="\${luaBase}" fill="\${sSombra}" transform="translate(1, 2)"/>
        <path d="\${luaBase}" fill="\${sLuz}"/>
        <!-- Estrela Facetada -->
        \${facesEstrela}
      </g>
    \`;
  },

  /* =========================================================================
     3. ASAS FEITAS DE PENAS GEOMÉTRICAS FACETADAS
     Uma pena é uma folha dividida no meio (Luz/Sombra).
     A asa é um arranjo radial destas penas ao redor do escudo.
     ========================================================================= */
  _penaGeometrica(x, y, scale, rotation, material) {
    return \`
      <g transform="translate(\${x},\${y}) rotate(\${rotation}) scale(\${scale})" filter="url(#shadowPenas)">
        <!-- Lado Luz (Esquerdo da folha) -->
        <path d="M0,0 Q-8,-15 0,-40 Z" fill="url(#\${material}Luz)"/>
        <!-- Lado Sombra (Direito da folha) -->
        <path d="M0,0 Q8,-15 0,-40 Z" fill="url(#\${material}Sombra)"/>
        <!-- Haste central fina -->
        <path d="M0,0 L0,-38" stroke="#fff" stroke-width="0.5" opacity="0.6"/>
      </g>
    \`;
  },

  _asaAnjo(cx, cy, side, material, rank) {
    // side = 1 (Direita), -1 (Esquerda)
    let penas = '';
    
    let configs = [];
    if (rank === 'E' || rank === 'D') {
      // Mecânicas/Sólidas
      configs = [
        { r: -70, x: 25, y: -20, s: 0.8 },
        { r: -90, x: 30, y: 0, s: 0.8 },
        { r: -110, x: 25, y: 20, s: 0.8 }
      ];
    } else if (rank === 'C') {
      configs = [
        { r: -50, x: 20, y: -25, s: 1 },
        { r: -70, x: 28, y: -10, s: 1 },
        { r: -90, x: 32, y: 10, s: 1 },
        { r: -110, x: 25, y: 30, s: 0.8 },
      ];
    } else {
      // Ranks B, A, S, N (Asas densas e longas para cima e pros lados)
      configs = [
        // Camada Fundo (Grandes)
        { r: -20, x: 10, y: -35, s: 1.5 },
        { r: -40, x: 20, y: -25, s: 1.4 },
        { r: -60, x: 30, y: -10, s: 1.3 },
        { r: -80, x: 35, y: 10,  s: 1.2 },
        { r: -100, x: 32, y: 30, s: 1.1 },
        { r: -120, x: 22, y: 50, s: 0.9 },
        // Camada Frente (Menores)
        { r: -30, x: 15, y: -20, s: 1.0 },
        { r: -50, x: 25, y: -5,  s: 0.9 },
        { r: -70, x: 30, y: 15,  s: 0.8 },
        { r: -90, x: 25, y: 35,  s: 0.7 },
      ];
    }

    if (rank === 'N') {
      // Nacional tem expansão colossal
      configs = configs.map(c => ({ r: c.r, x: c.x * 1.3, y: c.y * 1.3, s: c.s * 1.5 }));
      // Mais penas
      configs.push({ r: -10, x: 0, y: -50, s: 1.8 });
      configs.push({ r: -130, x: 15, y: 70, s: 1.2 });
    }

    for(let c of configs) {
      // Inverte x e rotação se for asa esquerda (-1)
      const px = cx + c.x * side;
      const py = cy + c.y;
      const rot = c.r * side;
      penas += this._penaGeometrica(px, py, c.s, rot, material);
    }
    
    // Como a asa é gerada com o ponto base (0,0) perto do escudo, agrupamos tudo.
    return \`<g>\${penas}</g>\`;
  },

  /* =========================================================================
     4. JOIAS CIANO (LAPIDAÇÃO 6 FACETAS)
     ========================================================================= */
  _joia(cx, cy, r) {
    const l = r * 0.8;
    return \`
      <g filter="url(#shadowPenas)">
        <!-- Top -->
        <polygon points="\${cx},\${cy-r} \${cx+l},\${cy-l} \${cx-l},\${cy-l}" fill="url(#cianoLuz)"/>
        <!-- Right -->
        <polygon points="\${cx+r},\${cy} \${cx+l},\${cy+l} \${cx+l},\${cy-l}" fill="url(#cianoLuz)"/>
        <!-- Bottom -->
        <polygon points="\${cx},\${cy+r} \${cx-l},\${cy+l} \${cx+l},\${cy+l}" fill="url(#cianoSombra)"/>
        <!-- Left -->
        <polygon points="\${cx-r},\${cy} \${cx-l},\${cy-l} \${cx-l},\${cy+l}" fill="url(#cianoSombra)"/>
        <!-- Mesa Central -->
        <polygon points="\${cx-l},\${cy-l} \${cx+l},\${cy-l} \${cx+l},\${cy+l} \${cx-l},\${cy+l}" fill="#00ffff"/>
        <circle cx="\${cx-l*0.5}" cy="\${cy-l*0.5}" r="\${r*0.2}" fill="#fff"/>
      </g>
    \`;
  },

  /* =========================================================================
     5. O MOTOR PRINCIPAL (MONTAGEM DO ESCUDO)
     ========================================================================= */

  rank(letra, tam = 100) {
    const L = String(letra || 'E').toUpperCase();
    
    let materialBase = 'prata';
    let varFundo = 'url(#fundoAzul)';
    let asa = '', magia = '', joias = '';

    const CX = 100;
    const CY = 100;

    switch (L) {
      case 'E':
        asa = this._asaAnjo(CX, CY, -1, 'prata', 'E') + this._asaAnjo(CX, CY, 1, 'prata', 'E');
        break;

      case 'D':
        asa = this._asaAnjo(CX, CY, -1, 'prata', 'D') + this._asaAnjo(CX, CY, 1, 'prata', 'D');
        magia = \`<circle cx="\${CX}" cy="\${CY}" r="65" fill="none" stroke="#00ced1" stroke-width="0.5" opacity="0.3" filter="url(#glowDivino)" />\`;
        break;

      case 'C':
        materialBase = 'prata';
        varFundo = 'url(#fundoCosmo)';
        magia = \`<circle cx="\${CX}" cy="\${CY}" r="75" fill="none" stroke="#00ced1" stroke-width="1.5" opacity="0.6" filter="url(#glowDivino)" />\`;
        asa = this._asaAnjo(CX, CY, -1, 'prata', 'C') + this._asaAnjo(CX, CY, 1, 'prata', 'C');
        break;

      case 'B':
        materialBase = 'ouro';
        varFundo = 'url(#fundoCosmo)';
        magia = \`<circle cx="\${CX}" cy="\${CY}" r="85" fill="none" stroke="#ffd700" stroke-width="1.5" opacity="0.5" filter="url(#glowDivino)" />\`;
        asa = this._asaAnjo(CX, CY, -1, 'ouro', 'B') + this._asaAnjo(CX, CY, 1, 'ouro', 'B');
        break;

      case 'A':
        materialBase = 'ouro';
        varFundo = 'url(#fundoAzul)';
        // Halo de Anjo
        magia = \`
          <g filter="url(#glowDivino)">
            <ellipse cx="\${CX}" cy="20" rx="40" ry="10" fill="none" stroke="#ffd700" stroke-width="3"/>
            <ellipse cx="\${CX}" cy="20" rx="40" ry="10" fill="none" stroke="#ffffff" stroke-width="1"/>
          </g>
        \`;
        asa = this._asaAnjo(CX, CY, -1, 'bronze', 'A') + this._asaAnjo(CX, CY, 1, 'bronze', 'A');
        break;

      case 'S':
        materialBase = 'ouro';
        varFundo = 'url(#fundoCosmo)';
        // Roda Rúnica
        magia = \`
          <g filter="url(#glowDivino)" opacity="0.9">
            <circle cx="\${CX}" cy="\${CY}" r="95" fill="none" stroke="#ffd700" stroke-width="2" stroke-dasharray="15 8"/>
            <circle cx="\${CX}" cy="\${CY}" r="85" fill="none" stroke="#fff" stroke-width="0.5"/>
            <!-- Hexagrama Mágico perfeito -->
            <polygon points="100,5 182,147 18,147" fill="none" stroke="#ffd700" stroke-width="1.5" opacity="0.6"/>
            <polygon points="100,195 182,53 18,53" fill="none" stroke="#ffd700" stroke-width="1.5" opacity="0.6"/>
          </g>
        \`;
        asa = this._asaAnjo(CX, CY, -1, 'ouro', 'S') + this._asaAnjo(CX, CY, 1, 'ouro', 'S');
        // Cravando joias nas asas S
        joias = this._joia(45, 60, 5) + this._joia(155, 60, 5)
              + this._joia(35, 90, 4) + this._joia(165, 90, 4);
        break;

      case 'N':
        materialBase = 'ouro';
        varFundo = 'url(#fundoCosmo)';
        // Fundo Galáxia e Roda Cósmica
        magia = \`
          <circle cx="\${CX}" cy="\${CY}" r="115" fill="none" stroke="#00ced1" stroke-width="3" filter="url(#glowDivino)"/>
          <circle cx="\${CX}" cy="\${CY}" r="108" fill="none" stroke="#ffd700" stroke-width="1.5" stroke-dasharray="4 8" filter="url(#glowDivino)"/>
          
          <!-- Luas Orbitais Nacionais -->
          <circle cx="100" cy="-15" r="5" fill="#00ffff" filter="url(#glowDivino)"/>
          <circle cx="100" cy="215" r="5" fill="#00ffff" filter="url(#glowDivino)"/>
          <circle cx="-15" cy="100" r="5" fill="#00ffff" filter="url(#glowDivino)"/>
          <circle cx="215" cy="100" r="5" fill="#00ffff" filter="url(#glowDivino)"/>
          
          <!-- Poeira Nebular Atrás -->
          <circle cx="80" cy="80" r="40" fill="#6a1b9a" opacity="0.4" filter="url(#glowDivino)"/>
          <circle cx="120" cy="120" r="35" fill="#00e5ff" opacity="0.3" filter="url(#glowDivino)"/>
        \`;
        
        asa = this._asaAnjo(CX, CY, -1, 'ouro', 'N') + this._asaAnjo(CX, CY, 1, 'ouro', 'N');
        
        // Joias densas espalhadas pelas asas e borda
        joias = this._joia(100, 40, 5) + this._joia(100, 160, 5)
              + this._joia(30, 40, 6) + this._joia(170, 40, 6)
              + this._joia(15, 80, 5) + this._joia(185, 80, 5)
              + this._joia(25, 120, 4) + this._joia(175, 120, 4);
        break;
    }

    const vb = "-50 -50 300 300";

    return this._unico(\`
<svg viewBox="\${vb}" width="\${tam}" height="\${tam}" class="escudo-v2 escudo-\${L}" style="max-width:none; overflow:visible; --fundo:\${varFundo};">
  <defs>
    \${this._gradientes}
  </defs>

  <!-- 1. Magia Cósmica (Atrás de tudo) -->
  \${magia}

  <!-- 2. Asas Geométricas (Atrás do Escudo) -->
  \${asa}

  <!-- 3. Moldura 3D Facetada e Fundo Encavado -->
  \${this._moldura3D(materialBase, 1.2, CX, CY)}

  <!-- 4. Lua, Estrela e Joias em Alto Relevo -->
  \${this._luaEstrela(materialBase, 1.2, CX, CY)}
  
  \${joias}
</svg>\`);
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EscudosV2;
}
