/* ============================================================
   fenix-pioneira.js — Insígnia "Fênix · Assinante Pioneiro"

   ARQUITETURA EXCLUSIVA — Padrão S-Rank (Fable5):
   Desenvolvida para a comercialização e reconhecimento dos
   primeiros assinantes do serviço Solo Rotinas.

   SILHUETA   : Silhueta Escultórica Real de Fênix (formato orgânico
                e majestoso, não circular), com Asas Imperiais em
                múltiplas camadas de lâminas solares afiadas.
   CAUDA      : Chamas Cascata em lâminas inferiores fluindo em
                camadas de fogo rubro, laranja ardente e ouro.
   CABEÇA     : Soberana voltada à direita com Bico de Ouro Branco,
                Olho de Diamante e Crista Solar flamejante em 4 plumas.
   CORAÇÃO    : Gema Magmática do Assinante Pioneiro no peito, facetada
                como escudo solar e pulsando em energia incandescente.
   RODA SOLAR : Halo Rúnico Orbital no plano de fundo (cerimônia),
                girando lentamente para conferir profundidade 3D.
   FAÍSCAS    : 28 brasas e centelhas flutuantes com animação de crepitar
                e ascensão térmica (elogio do usuário mantido e ampliado).
   CORES      : Laranjados ardentes (#f97316, #ea580c), âmbar solar (#f59e0b),
                ouro branco incandescente (#fff7ed) e brasa rubra (#7c2d12).

   Animações (com suporte nativo a prefers-reduced-motion):
     - Roda Solar Rúnica: 35s linear infinito (sentido horário)
     - Coração Magmático: 3s ease-in-out infinito (pulso térmico)
     - Faíscas e Brasas:  2.8s crepitar alternado + ascensão
     - Filete Cometa:     3.2s linear infinito (varredura contínua)
   ============================================================ */

const FenixFX = {

  /* Gera coordenadas polares (cx=130 cy=130) */
  _pt(r, deg, cx = 130, cy = 130) {
    const a = (deg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  },

  /* ─── SVG PRINCIPAL DA INSÍGNIA (ESCULTOUTRA S-RANK REAL) ─── */
  _svgMedalhaFenix(tamanho = 260) {
    const C = 130;
    const pt = FenixFX._pt.bind(null);

    /* ── 1. Roda Solar Rúnica e Halo de Fundo (Profundidade 3D) ── */
    const aroR = 98;
    const aroC = 2 * Math.PI * aroR;
    
    // 12 Runas / marcações orbitais na roda de fundo
    const runasFundo = Array.from({ length: 12 }, (_, i) => {
      const ang = i * 30;
      const [x1, y1] = pt(88, ang);
      const [x2, y2] = pt(96, ang);
      return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"
                    stroke="#ea580c" stroke-width="1.8" stroke-opacity=".55" stroke-linecap="round"/>`;
    }).join('');

    /* ── 2. Faíscas e Brasas Flutuantes (28 centelhas crepitantes) ── */
    const particulas = Array.from({ length: 28 }, (_, i) => {
      // Distribuição orgânica ao redor das asas, crista e cauda
      const ang = (i * 12.8 + (i % 3) * 7) % 360;
      const r   = 65 + (i % 5) * 16 + (i % 2) * 8;
      const sz  = 1.8 + (i % 4) * 0.7;
      const [cx, cy] = pt(r, ang, 130, 125);
      
      const op = i % 3 === 0 ? '.95' : (i % 2 === 0 ? '.75' : '.55');
      const delay = (i * 0.18).toFixed(2);
      const dur   = (2.2 + (i % 4) * 0.4).toFixed(2);
      
      return `
      <g class="fnx-brasa-item" style="animation-delay: ${delay}s; animation-duration: ${dur}s">
        <circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${sz.toFixed(2)}"
                fill="#fff7ed" fill-opacity="${op}" filter="url(#fnxGlowMini)"/>
        <circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(sz * 1.8).toFixed(2)}"
                fill="#f97316" fill-opacity="${(op * 0.5).toFixed(2)}" filter="url(#fnxGlowMini)"/>
      </g>`;
    }).join('');

    /* ── 3. Cauda em Chamas Cascata (Lâminas Inferiores) ── */
    // Lâminas de fogo externas da cauda (esquerda e direita)
    const caudaExtEsq = `M 118,145 C 95,170 75,200 68,235 C 85,215 95,195 108,180 C 95,210 90,230 92,250 C 105,225 115,200 122,170 Z`;
    const caudaExtDir = `M 142,145 C 165,170 185,200 192,235 C 175,215 165,195 152,180 C 165,210 170,230 168,250 C 155,225 145,200 138,170 Z`;
    
    // Lâminas médias flamejantes da cauda
    const caudaMedEsq = `M 122,150 C 105,180 95,215 98,245 C 110,220 118,195 125,175 Z`;
    const caudaMedDir = `M 138,150 C 155,180 165,215 162,245 C 150,220 142,195 135,175 Z`;
    
    // Lâmina central suprema (lança de fogo que desce até a base)
    const caudaCentral = `M 130,150 C 124,185 122,220 130,255 C 138,220 136,185 130,150 Z`;

    /* ── 4. Asas Imperiais da Fênix (Lâminas Solares Estendidas) ── */
    // Camada 1: Asas Externas Míticas (Lâminas Maiores - Escudo de Brasa e Ouro)
    const asaExtEsq = `
      M 124,110 
      C 95,95 55,70 15,22 
      C 32,52 50,65 64,68 
      C 42,75 25,85 14,100 
      C 38,90 58,95 72,100 
      C 50,108 35,118 25,135 
      C 52,122 75,122 96,125
      C 75,132 60,142 50,158
      C 75,145 98,142 116,140 Z`;
      
    const asaExtDir = `
      M 136,110 
      C 165,95 205,70 245,22 
      C 228,52 210,65 196,68 
      C 218,75 235,85 246,100 
      C 222,90 202,95 188,100 
      C 210,108 225,118 235,135 
      C 208,122 185,122 164,125
      C 185,132 200,142 210,158
      C 185,145 162,142 144,140 Z`;

    // Camada 2: Asas Intermediárias (Laranja Ardente e Brilho)
    const asaMedEsq = `
      M 122,112 
      C 98,100 62,78 30,38 
      C 45,60 62,70 75,74 
      C 55,82 40,92 32,106 
      C 52,98 70,102 82,106 
      C 65,114 52,122 45,136 
      C 68,126 88,126 102,128 Z`;

    const asaMedDir = `
      M 138,112 
      C 162,100 198,78 230,38 
      C 215,60 198,70 185,74 
      C 205,82 220,92 228,106 
      C 208,98 190,102 178,106 
      C 195,114 208,122 215,136 
      C 192,126 172,126 158,128 Z`;

    // Camada 3: Asas Internas Incandescentes (Ouro Branco e Âmbar)
    const asaIntEsq = `
      M 120,115 C 102,105 75,88 50,56 C 62,72 75,80 86,84 C 70,90 58,98 52,110 C 68,104 82,108 92,112 Z`;
    const asaIntDir = `
      M 140,115 C 158,105 185,88 210,56 C 198,72 185,80 174,84 C 190,90 202,98 208,110 C 192,104 178,108 168,112 Z`;

    /* ── 5. Filigranas Acobreadas / Nervuras de Fogo nas Asas ── */
    const nervurasEsq = `
      M 122,108 Q 80,80 22,28
      M 115,115 Q 75,95 28,100
      M 112,122 Q 80,120 35,134`;
    const nervurasDir = `
      M 138,108 Q 180,80 238,28
      M 145,115 Q 185,95 232,100
      M 148,122 Q 180,120 225,134`;

    /* ── 6. Torso e Armadura Peitoral da Fênix ── */
    const peitoral = `M 120,102 C 115,118 115,135 120,148 C 125,153 135,153 140,148 C 145,135 145,118 140,102 C 135,98 125,98 120,102 Z`;

    /* ── 7. Cabeça Soberana, Bico de Ouro e Crista Solar ── */
    // Pescoço curvo e elegante
    const pescoco = `M 122,104 C 118,88 122,72 130,62 C 136,70 140,86 138,104 Z`;
    
    // Cabeça e bico afiado voltado à direita (raptor real)
    const cabeca = `M 125,66 C 124,58 132,52 138,54 C 144,55 152,58 155,62 C 148,64 142,63 138,65 C 136,70 130,72 125,66 Z`;
    
    // Crista flamejante (4 plumas de fogo projetadas para trás/esquerda)
    const crista = `
      M 130,55 C 122,42 112,32 98,24 C 110,36 118,44 124,53
      M 128,52 C 118,38 106,28 92,20 C 105,32 115,42 122,50
      M 125,56 C 116,46 105,38 92,32 C 104,42 112,50 120,57
      M 134,53 C 132,38 126,26 116,15 C 126,28 132,40 134,53 Z`;

    /* ── 8. Coração Magmático (Gema do Assinante Pioneiro) ── */
    // Gema em escudo dodecagonal facetado no centro do peito
    const gemaPeito = `M 130,108 L 138,116 L 138,128 L 130,136 L 122,128 L 122,116 Z`;
    const gemaBrilho = `M 130,108 L 138,116 L 130,122 L 122,116 Z`;

    /* ── Monta o SVG Escultórico ── */
    return `
    <svg viewBox="0 0 260 260" width="${tamanho}" height="${tamanho}" class="cq-svg"
         style="overflow:visible;max-width:none;width:${tamanho}px;height:${tamanho}px">
      <style>
        .fnx-roda-fundo { transform-origin: 130px 130px; animation: fnx-spin 35s linear infinite; }
        .fnx-cometa     { transform-origin: 130px 130px; animation: fnx-spin 3.2s linear infinite; }
        .fnx-coracao    { transform-origin: 130px 122px; animation: fnx-pulse 3s ease-in-out infinite; }
        
        .fnx-brasa-item {
          transform-origin: 130px 125px;
          animation: fnx-crepitar 2.8s ease-in-out infinite alternate;
        }

        @keyframes fnx-spin { to { transform: rotate(360deg); } }
        @keyframes fnx-pulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 8px rgba(251,146,60,0.8)); }
          50%      { transform: scale(1.08); filter: drop-shadow(0 0 16px rgba(255,247,237,1)); }
        }
        @keyframes fnx-crepitar {
          0%   { transform: scale(0.8) translate(0, 0); opacity: 0.6; }
          50%  { transform: scale(1.2) translate(0, -5px); opacity: 1; }
          100% { transform: scale(0.9) translate(0, -2px); opacity: 0.8; }
        }

        @media (prefers-reduced-motion: reduce) {
          .fnx-roda-fundo, .fnx-cometa, .fnx-coracao, .fnx-brasa-item {
            animation: none !important;
          }
        }
      </style>
      <defs>
        <!-- Gradients das Asas e Cauda -->
        <linearGradient id="fnxAsaExtGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stop-color="#ffedd5"/>
          <stop offset="30%"  stop-color="#f97316"/>
          <stop offset="70%"  stop-color="#c2410c"/>
          <stop offset="100%" stop-color="#4a0404"/>
        </linearGradient>

        <linearGradient id="fnxAsaMedGrad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%"   stop-color="#fff7ed"/>
          <stop offset="40%"  stop-color="#fb923c"/>
          <stop offset="85%"  stop-color="#ea580c"/>
          <stop offset="100%" stop-color="#7c2d12"/>
        </linearGradient>

        <linearGradient id="fnxAsaIntGrad" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%"   stop-color="#ffffff"/>
          <stop offset="45%"  stop-color="#ffedd5"/>
          <stop offset="85%"  stop-color="#f97316"/>
          <stop offset="100%" stop-color="#9a3412"/>
        </linearGradient>

        <!-- Corpo e Peitoral -->
        <linearGradient id="fnxPeitoGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="#ffedd5"/>
          <stop offset="35%"  stop-color="#f97316"/>
          <stop offset="75%"  stop-color="#9a3412"/>
          <stop offset="100%" stop-color="#3b0a00"/>
        </linearGradient>

        <!-- Coração Magmático (Gema do Assinante) -->
        <radialGradient id="fnxGemaGrad" cx="50%" cy="30%">
          <stop offset="0%"   stop-color="#ffffff"/>
          <stop offset="30%"  stop-color="#ffedd5"/>
          <stop offset="65%"  stop-color="#f97316"/>
          <stop offset="100%" stop-color="#9a3412"/>
        </radialGradient>

        <!-- Cauda de Chamas -->
        <linearGradient id="fnxCaudaGrad" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%"   stop-color="#fb923c"/>
          <stop offset="40%"  stop-color="#ea580c"/>
          <stop offset="75%"  stop-color="#9a3412"/>
          <stop offset="100%" stop-color="#4a0404"/>
        </linearGradient>

        <!-- Filtros de Glow e Sombra S-Rank -->
        <filter id="fnxGlowMini" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="2.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>

        <filter id="fnxGlowAsas" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>

        <filter id="fnxAura" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity=".95"/>
          <feDropShadow dx="0" dy="0"  stdDeviation="25" flood-color="#ea580c" flood-opacity=".65"/>
          <feDropShadow dx="0" dy="0"  stdDeviation="45" flood-color="#f97316" flood-opacity=".40"/>
        </filter>
      </defs>

      <g filter="url(#fnxAura)">
        <!-- ── CAMADA 0: RODA SOLAR RÚNICA DE FUNDO (PROFUNDIDADE 3D) ── -->
        <g class="fnx-roda-fundo">
          <circle cx="${C}" cy="${C}" r="${aroR}" fill="none" stroke="#7c2d12" stroke-width="2" stroke-opacity=".5"/>
          <circle cx="${C}" cy="${C}" r="${aroR - 12}" fill="none" stroke="#ea580c" stroke-width="1" stroke-dasharray="6 6" stroke-opacity=".4"/>
          ${runasFundo}
        </g>
        
        <!-- Cometa Solar Orbital de Fundo -->
        <g class="fnx-cometa">
          <circle cx="${C}" cy="${C}" r="${aroR}" fill="none" stroke="#fff7ed" stroke-width="2.6"
                  stroke-dasharray="${(aroC * 0.1).toFixed(1)} ${(aroC * 0.9).toFixed(1)}"
                  stroke-linecap="round" filter="url(#fnxGlowMini)"/>
        </g>

        <!-- ── CAMADA 1: CAUDA EM CHAMAS CASCATA (LÂMINAS INFERIORES) ── -->
        <g filter="url(#fnxGlowAsas)">
          <path d="${caudaExtEsq}" fill="url(#fnxCaudaGrad)" stroke="#ffedd5" stroke-width="1.2"/>
          <path d="${caudaExtDir}" fill="url(#fnxCaudaGrad)" stroke="#ffedd5" stroke-width="1.2"/>
          <path d="${caudaMedEsq}" fill="url(#fnxAsaMedGrad)" stroke="#fff7ed" stroke-width="1"/>
          <path d="${caudaMedDir}" fill="url(#fnxAsaMedGrad)" stroke="#fff7ed" stroke-width="1"/>
          <path d="${caudaCentral}" fill="url(#fnxAsaIntGrad)" stroke="#ffffff" stroke-width="1.5" filter="url(#fnxGlowMini)"/>
        </g>

        <!-- ── CAMADA 2: ASAS IMPERIAIS DA FÊNIX (LÂMINAS CURVAS) ── -->
        <!-- Asas Externas Míticas -->
        <g filter="url(#fnxGlowAsas)">
          <path d="${asaExtEsq}" fill="url(#fnxAsaExtGrad)" stroke="#ffedd5" stroke-width="1.4"/>
          <path d="${asaExtDir}" fill="url(#fnxAsaExtGrad)" stroke="#ffedd5" stroke-width="1.4"/>
        </g>

        <!-- Asas Intermediárias Ardentes -->
        <path d="${asaMedEsq}" fill="url(#fnxAsaMedGrad)" stroke="#fff7ed" stroke-width="1.2" filter="url(#fnxGlowMini)"/>
        <path d="${asaMedDir}" fill="url(#fnxAsaMedGrad)" stroke="#fff7ed" stroke-width="1.2" filter="url(#fnxGlowMini)"/>

        <!-- Asas Internas Incandescentes -->
        <path d="${asaIntEsq}" fill="url(#fnxAsaIntGrad)" stroke="#ffffff" stroke-width="1" filter="url(#fnxGlowMini)"/>
        <path d="${asaIntDir}" fill="url(#fnxAsaIntGrad)" stroke="#ffffff" stroke-width="1" filter="url(#fnxGlowMini)"/>

        <!-- Filigranas e Nervuras Solares -->
        <path d="${nervurasEsq}" fill="none" stroke="#fff7ed" stroke-width="1.3" stroke-opacity=".85" stroke-linecap="round"/>
        <path d="${nervurasDir}" fill="none" stroke="#fff7ed" stroke-width="1.3" stroke-opacity=".85" stroke-linecap="round"/>

        <!-- ── CAMADA 3: PEITORAL, PESCOÇO E CABEÇA SOBERANA ── -->
        <!-- Pescoço e Peitoral -->
        <path d="${peitoral}" fill="url(#fnxPeitoGrad)" stroke="#ffedd5" stroke-width="1.4"/>
        <path d="${pescoco}" fill="url(#fnxAsaMedGrad)" stroke="#fff7ed" stroke-width="1"/>

        <!-- Crista Solar Flamejante (4 Plumas) -->
        <path d="${crista}" fill="none" stroke="url(#fnxAsaIntGrad)" stroke-width="3.2" stroke-linecap="round" filter="url(#fnxGlowMini)"/>
        <path d="${crista}" fill="none" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>

        <!-- Cabeça Real e Bico de Ouro Branco -->
        <path d="${cabeca}" fill="url(#fnxAsaIntGrad)" stroke="#ffffff" stroke-width="1.2" filter="url(#fnxGlowMini)"/>
        <!-- Olho de Diamante com Glint Solar -->
        <circle cx="134" cy="59.5" r="2.2" fill="#ffffff" filter="url(#fnxGlowMini)"/>
        <circle cx="134.5" cy="59" r="0.8" fill="#c2410c"/>

        <!-- ── CAMADA 4: CORAÇÃO MAGMÁTICO (GEMA DO ASSINANTE PIONEIRO) ── -->
        <g class="fnx-coracao">
          <path d="${gemaPeito}" fill="url(#fnxGemaGrad)" stroke="#ffffff" stroke-width="1.5"/>
          <path d="${gemaBrilho}" fill="#ffffff" fill-opacity=".7"/>
          <circle cx="130" cy="122" r="3.5" fill="#ffffff" filter="url(#fnxGlowMini)"/>
        </g>

        <!-- ── CAMADA 5: FAÍSCAS E BRASAS FLUTUANTES (EM PRIMEIRO PLANO) ── -->
        <g class="fnx-particulas">${particulas}</g>
      </g>
    </svg>`;
  },

  /* Cerimônia em 3 Atos (padrão S-Rank / Solo Rotinas) */
  cerimonia() {
    if (typeof ConquistaFX === 'undefined') return;
    ConquistaFX.show({
      codigo: 'fenix_pioneira',
      titulo: 'Fênix · Assinante Pioneiro',
      descricao: 'Comercialização — A chama imortal dos primeiros assinantes que acreditaram no Sistema antes de todos',
      icone: '🔥',
      cor: '#f97316',
      xp_bonus: 5000,
      moedas_bonus: 1000,
    });
  },
};

window.FenixFX = FenixFX;

/* Inscrição no renderizador único do sistema */
window.ConquistaFX?.registrarInsignia?.(
  'fenix_pioneira', tam => FenixFX._svgMedalhaFenix(tam));

