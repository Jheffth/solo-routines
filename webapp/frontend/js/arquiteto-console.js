/* ============================================================
   arquiteto-console.js — ⚒ Forja de Testes do Arquiteto
   Console secreto para disparar qualquer efeito do Sistema
   na hora, sem esperar eventos reais. 100% frontend:
   nenhum XP, nenhuma escrita no banco. Só o Arquiteto vê.

   Abrir: Ctrl+Alt+A  ou  duplo-clique no badge ★ ARQUITETO ★
   ============================================================ */
const Jh3ffthFX = {
  _ativo: false,
  toggle() {
    this._ativo = !this._ativo;
    if (this._ativo) {
      this._cerimonia();
    } else {
      const b = document.getElementById('jh3ffth-badge');
      if (b) {
        b.style.transform = 'scale(0)';
        setTimeout(() => b.remove(), 400);
      }
    }
  },

  _svgMedalhaArquiteto(tamanho = 260) {
    // Lâminas/Escamas Sapuris (Fractais negros afiados girando ao fundo)
    const laminas = [];
    for(let i=0; i<8; i++){
        const a = (Math.PI / 4) * i;
        const xTip = 130 + 125 * Math.cos(a);
        const yTip = 130 + 125 * Math.sin(a);
        const xSide = 130 + 80 * Math.cos(a + Math.PI/12);
        const ySide = 130 + 80 * Math.sin(a + Math.PI/12);
        const xBase1 = 130 + 40 * Math.cos(a - Math.PI/6);
        const yBase1 = 130 + 40 * Math.sin(a - Math.PI/6);
        const xBase2 = 130 + 40 * Math.cos(a + Math.PI/6);
        const yBase2 = 130 + 40 * Math.sin(a + Math.PI/6);
        laminas.push(`M ${xBase1} ${yBase1} L ${xTip} ${yTip} L ${xSide} ${ySide} L ${xBase2} ${yBase2} Z`);
    }

    // Runas de Sangue
    const runas = [];
    for (let i = 0; i < 36; i++) {
      const a = (Math.PI / 18) * i;
      const r1 = 95, r2 = i % 2 === 0 ? 85 : 90;
      runas.push(`M ${130 + r1 * Math.cos(a)} ${130 + r1 * Math.sin(a)} L ${130 + r2 * Math.cos(a)} ${130 + r2 * Math.sin(a)}`);
    }

    // Cruz/Estrela de Sangue (Estilo armadura divina)
    const estrelaSangue = [];
    for(let i=0; i<4; i++){
        const a = (Math.PI / 2) * i;
        const xTip = 130 + 115 * Math.cos(a);
        const yTip = 130 + 115 * Math.sin(a);
        const xMid1 = 130 + 15 * Math.cos(a + Math.PI/4);
        const yMid1 = 130 + 15 * Math.sin(a + Math.PI/4);
        const xMid2 = 130 + 15 * Math.cos(a - Math.PI/4);
        const yMid2 = 130 + 15 * Math.sin(a - Math.PI/4);
        estrelaSangue.push(`M 130 130 L ${xMid1} ${yMid1} L ${xTip} ${yTip} L ${xMid2} ${yMid2} Z`);
    }

    return `
    <svg viewBox="0 0 260 260" width="${tamanho}" height="${tamanho}" style="overflow:visible" class="cq-svg">
      <defs>
        <!-- Metal Negro da Surplice (Sapuris) -->
        <radialGradient id="sapuriMetal" cx="45%" cy="30%">
          <stop offset="0%" stop-color="#52525b"/>
          <stop offset="30%" stop-color="#18181b"/>
          <stop offset="70%" stop-color="#2e1065"/>
          <stop offset="100%" stop-color="#000000"/>
        </radialGradient>
        
        <!-- Brilho Escarlate do Núcleo -->
        <radialGradient id="rubyGlow" cx="50%" cy="50%">
          <stop offset="0%" stop-color="#fca5a5"/>
          <stop offset="25%" stop-color="#ef4444"/>
          <stop offset="60%" stop-color="#991b1b"/>
          <stop offset="100%" stop-color="#270202"/>
        </radialGradient>

        <!-- Fio de Corte da Armadura -->
        <linearGradient id="sapuriEdge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fca5a5"/>
          <stop offset="50%" stop-color="#991b1b"/>
          <stop offset="100%" stop-color="#450a0a"/>
        </linearGradient>

        <!-- Filtros S-Rank: Aura Sanguínea e Sombras -->
        <filter id="bloodGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>

        <filter id="sapuriShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="#000" flood-opacity="0.95"/>
          <feDropShadow dx="0" dy="0" stdDeviation="25" flood-color="#991b1b" flood-opacity="0.6"/>
        </filter>
      </defs>

      <g filter="url(#sapuriShadow)">
        
        <!-- Aro de Lâminas Sapuris (Giro lento) -->
        <g style="transform-origin: 130px 130px; animation: cq-anel-girar 28s linear infinite;">
          <path d="${laminas.join(' ')}" fill="url(#sapuriMetal)" stroke="url(#sapuriEdge)" stroke-width="1.5" opacity="0.9"/>
        </g>
        
        <!-- Runas Sanguíneas (Contra-rotação) -->
        <g style="transform-origin: 130px 130px; animation: cq-anel-girar 20s linear infinite reverse;">
          <circle cx="130" cy="130" r="95" fill="none" stroke="#270202" stroke-width="8"/>
          <path d="${runas.join(' ')}" stroke="#ef4444" stroke-width="2" filter="url(#bloodGlow)" opacity="0.8"/>
          <circle cx="130" cy="130" r="95" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="8 24"/>
        </g>
        
        <!-- Cruz de Sangue Pulsante -->
        <g class="cq-svg-star" style="animation-direction: alternate; animation-duration: 4s;">
          <path d="${estrelaSangue.join(' ')}" fill="none" stroke="#f87171" stroke-width="2.5" filter="url(#bloodGlow)"/>
          <path d="${estrelaSangue.join(' ')}" fill="rgba(220,38,38,0.2)"/>
        </g>

        <!-- Escudo de Diamante Gótico (O Núcleo da Armadura - Simétrico) -->
        <polygon points="130,30 230,130 130,230 30,130" fill="url(#sapuriMetal)" stroke="url(#sapuriEdge)" stroke-width="3"/>
        
        <!-- Gema de Rubi Central (Simétrica) -->
        <polygon points="130,45 215,130 130,215 45,130" fill="url(#rubyGlow)" filter="url(#bloodGlow)"/>
        
        <!-- Facetas de Vidro 3D do Rubi -->
        <polygon points="130,45 45,130 130,130" fill="rgba(255,255,255,0.3)"/>
        <polygon points="130,45 215,130 130,130" fill="rgba(255,255,255,0.05)"/>
        <polygon points="45,130 130,215 130,130" fill="rgba(0,0,0,0.4)"/>
        <polygon points="215,130 130,215 130,130" fill="rgba(0,0,0,0.7)"/>

        <!-- Veias de Hades (Luz correndo pelas bordas do diamante) -->
        <polygon points="130,30 230,130 130,230 30,130" fill="none" stroke="#fca5a5" stroke-width="2" stroke-dasharray="50 350" class="cq-svg-brilho"/>
        
        <!-- O Grande Núcleo do Arquiteto (Simétrico e Centralizado) -->
        <g transform="translate(130, 130)">
          <!-- Armação de Energia (Grade do Arquiteto) -->
          <polygon points="0,-45 45,0 0,45 -45,0" fill="none" stroke="#fca5a5" stroke-width="3" filter="url(#bloodGlow)"/>
          
          <!-- Cristal Maior Brilhante -->
          <polygon points="0,-30 30,0 0,30 -30,0" fill="#fff" filter="url(#bloodGlow)"/>
          <polygon points="0,-30 30,0 0,30 -30,0" fill="#fff" opacity="0.95"/>
          
          <!-- Cortes Estruturais (Visão Top-down de uma Pirâmide/Octaedro) -->
          <path d="M 0 -30 L 30 0 L 0 30 L -30 0 Z M -30 0 L 30 0 M 0 -30 L 0 30" fill="none" stroke="#991b1b" stroke-width="2"/>
        </g>
      </g>
    </svg>`;
  },

  async _cerimonia() {
    if (typeof SFX !== 'undefined') SFX.play('conquista');
    
    const ov = document.createElement('div');
    ov.className = 'cq-overlay';
    ov.style.background = 'radial-gradient(circle at center, rgba(30,5,5,0.95) 0%, rgba(5,0,0,0.98) 100%)';
    
    const shimmerStyle = `
      background: linear-gradient(100deg, #fff7e0 20%, #fbbf24 40%, #fff7e0 60%, #fbbf24 80%);
      background-size: 220% auto; -webkit-background-clip: text; background-clip: text; color: transparent;
      animation: cq-shimmer 2.4s linear infinite;
    `;

    const raiosArquiteto = `
      position:absolute;top:130px;left:50%;
      width:900px;height:900px;margin:-450px 0 0 -450px;
      border-radius:50%;
      background:conic-gradient(from 0deg, transparent 0%, rgba(220,38,38,0.15) 5%, transparent 10%, rgba(251,191,36,0.1) 15%, transparent 20%, rgba(220,38,38,0.15) 25%, transparent 30%, rgba(251,191,36,0.1) 35%, transparent 40%, rgba(220,38,38,0.15) 45%, transparent 50%, rgba(251,191,36,0.1) 55%, transparent 60%, rgba(220,38,38,0.15) 65%, transparent 70%, rgba(251,191,36,0.1) 75%, transparent 80%, rgba(220,38,38,0.15) 85%, transparent 90%, rgba(251,191,36,0.1) 95%, transparent 100%);
      mask-image: radial-gradient(circle at center, black 0%, transparent 60%);
      -webkit-mask-image: radial-gradient(circle at center, black 0%, transparent 60%);
      animation: spin 30s linear infinite; pointer-events:none; z-index:-1;
    `;

    ov.innerHTML = `
      <div class="cq-flash"></div>
      <div class="cq-palco">
        <div style="${raiosArquiteto}"></div>
        <div class="cq-medalha" style="width:260px;height:260px;margin-bottom:1rem;">
          ${this._svgMedalhaArquiteto(260)}
        </div>
        <div class="cq-textos">
          <div style="font-family:var(--font-section);font-size:0.85rem;font-weight:700;
                      letter-spacing:4px;color:var(--gold-bright);text-transform:uppercase;margin-bottom:0.6rem;
                      text-shadow: 0 0 10px rgba(251,191,36,0.5);">
            ⚠️ AUTORIDADE DE NÍVEL S ⚠️
          </div>
          <div style="font-family:var(--font-title);font-size:2.8rem;text-shadow:0 8px 25px rgba(0,0,0,0.8);
                      letter-spacing:2px; line-height:1.1; ${shimmerStyle}">
            JH3FFTH
          </div>
          <div style="font-family:var(--font-section);font-size:1.1rem;font-weight:700;
                      letter-spacing:6px;color:#d1d5db;margin-top:0.6rem; text-shadow:0 2px 4px #000;">
            O ARQUITETO
          </div>
          <div style="margin-top:1.5rem;font-family:'Orbitron',monospace;font-size:1.4rem;font-weight:700;
                      color:#fbbf24;text-shadow:0 0 15px rgba(251,191,36,0.8);letter-spacing:2px;">
            +INFINITO XP
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(ov);

    setTimeout(() => {
      const cx = window.innerWidth/2, cy = window.innerHeight/2 - 40;
      if (typeof Particles !== 'undefined') {
        Particles.burst(cx, cy, 60, 'rgba(239,68,68,');
        setTimeout(() => Particles.burst(cx, cy, 40, 'rgba(251,191,36,'), 150);
        setTimeout(() => Particles.burst(cx, cy, 30, 'rgba(15,23,42,'), 300);
      }
    }, 50);

    setTimeout(() => {
      if (typeof SFX !== 'undefined') SFX.play('carimbo');
      ov.classList.add('cq-saindo');
      
      this._selo();
      this._carimbarQuadro();

      setTimeout(() => {
        ov.remove();
      }, 500);
    }, 3800);
  },

  _selo() {
    let pilha = document.getElementById('cq-pilha');
    if (!pilha) {
      pilha = document.createElement('div');
      pilha.id = 'cq-pilha';
      document.body.appendChild(pilha);
    }
    const el = document.createElement('div');
    el.className = 'cq-selo';
    el.style.borderLeft = '4px solid #ef4444';
    el.style.background = 'linear-gradient(90deg, rgba(30,5,5,0.95), rgba(5,0,0,0.98))';
    el.innerHTML = `
      <div class="cq-selo-ico" style="position:relative;width:40px;height:40px;margin-right:14px;filter:drop-shadow(0 2px 4px rgba(220,38,38,0.5))">
        ${this._svgMedalhaArquiteto(40)}
      </div>
      <div>
        <div class="cq-selo-lbl" style="color:#fca5a5;font-weight:700;letter-spacing:1px;font-size:0.65rem">AUTORIDADE DE NÍVEL S</div>
        <div class="cq-selo-nome" style="color:#fff;font-size:1.1rem">JH3FFTH</div>
      </div>
      <div class="cq-selo-xp" style="color:#ef4444;text-shadow:0 0 10px rgba(239,68,68,0.5)">+INFINITO XP</div>`;
    pilha.appendChild(el);
    setTimeout(() => { el.classList.add('cq-selo-out'); setTimeout(() => el.remove(), 500); }, 6000);
  },

  _carimbarQuadro() {
    const quadro = document.getElementById('lista-conquistas-recentes');
    if (!quadro) return;
    quadro.querySelector('.empty-state')?.remove();
    // demo idempotente: nunca duplica um card já presente no quadro
    if (quadro.querySelector('[data-cq-chave="demo-arquiteto"]')) return;

    const card = document.createElement('div');
    card.className = 'conquista-mini cq-carimbo c-entering c-materializing';
    card.dataset.cqChave = 'demo-arquiteto';
    card.style.borderColor = 'rgba(239,68,68,0.4)';
    card.style.background = 'linear-gradient(90deg, rgba(30,5,5,0.9), rgba(15,0,0,0.95))';
    card.style.boxShadow = '0 0 15px rgba(239,68,68,0.2) inset, 0 0 8px rgba(239,68,68,0.2)';
    
    card.innerHTML = `
      <div class="cq-nevoa" style="background: radial-gradient(circle at left, rgba(239,68,68,0.3) 0%, transparent 60%);"></div>
      
      <span class="cq-medalhinha" style="width:52px;height:52px;flex-shrink:0;">
        ${this._svgMedalhaArquiteto(52)}
      </span>
      
      <div class="conquista-mini-info">
        <div class="conquista-mini-nome" style="color:#fca5a5; text-shadow:0 0 5px rgba(239,68,68,0.4)">JH3FFTH, O Arquiteto</div>
        <div class="conquista-mini-desc" style="color:#d1d5db">Você ativou a Forja da Criação.</div>
      </div>`;
    quadro.prepend(card);
    
    // Som do carimbo extra
    setTimeout(() => { if (typeof SFX !== 'undefined') SFX.play('carimbo'); }, 380);
  }
};

const DianaFX = {
  _svgMedalhaDiana(tamanho = 260) {
    return `
    <svg viewBox="0 0 260 260" width="${tamanho}" height="${tamanho}" style="overflow:visible" class="cq-svg">
      <defs>
        <radialGradient id="moonMetal" cx="45%" cy="30%">
          <stop offset="0%" stop-color="#94a3b8"/>
          <stop offset="30%" stop-color="#334155"/>
          <stop offset="70%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#020617"/>
        </radialGradient>
        <radialGradient id="moonstoneGlow" cx="50%" cy="50%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="25%" stop-color="#7dd3fc"/>
          <stop offset="60%" stop-color="#0369a1"/>
          <stop offset="100%" stop-color="#082f49"/>
        </radialGradient>
        <linearGradient id="moonEdge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="50%" stop-color="#38bdf8"/>
          <stop offset="100%" stop-color="#082f49"/>
        </linearGradient>
        <filter id="moonGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="moonShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="#000" flood-opacity="0.95"/>
          <feDropShadow dx="0" dy="0" stdDeviation="25" flood-color="#38bdf8" flood-opacity="0.6"/>
        </filter>
      </defs>

      <g filter="url(#moonShadow)">
        
        <!-- Foice Externa Girando -->
        <g style="transform-origin: 130px 130px; animation: cq-anel-girar 28s linear infinite;">
          <path d="M 130 15 A 115 115 0 1 1 15 130 A 110 110 0 0 0 110 25 L 125 15 Z" fill="url(#moonMetal)" stroke="#e2e8f0" stroke-width="1.5" filter="url(#moonGlow)"/>
          <path d="M 130 15 A 115 115 0 1 1 15 130 A 110 110 0 0 0 110 25 L 125 15 Z" fill="rgba(255,255,255,0.1)"/>
          <!-- Detalhe prateado na ponta da foice -->
          <circle cx="125" cy="15" r="4" fill="#ffffff" filter="url(#moonGlow)"/>
        </g>
        
        <!-- Anel Central Redondo -->
        <circle cx="130" cy="130" r="85" fill="url(#moonMetal)" stroke="url(#moonEdge)" stroke-width="4"/>
        
        <!-- Gema Moonstone Central com facetas redondas -->
        <circle cx="130" cy="130" r="75" fill="url(#moonstoneGlow)"/>
        <circle cx="130" cy="130" r="75" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
        <path d="M 55 130 A 75 75 0 0 1 205 130 Z" fill="rgba(255,255,255,0.2)"/>
        <path d="M 55 130 A 75 75 0 0 0 205 130 Z" fill="rgba(0,0,0,0.3)"/>
        
        <!-- Runas Místicas Internas (Contra-rotação) -->
        <g style="transform-origin: 130px 130px; animation: cq-anel-girar 20s linear infinite reverse;">
          <circle cx="130" cy="130" r="65" fill="none" stroke="rgba(56,189,248,0.6)" stroke-width="1.5" stroke-dasharray="4 8"/>
          <circle cx="130" cy="130" r="50" fill="none" stroke="#e0f2fe" stroke-width="1" stroke-dasharray="2 12" opacity="0.5"/>
        </g>
        
        <!-- Ícone: A Lâmina Crescente da Diana no Centro -->
        <g transform="translate(130, 130)">
          <path d="M -15 -35 A 30 30 0 1 1 -15 25 A 35 35 0 1 0 -15 -35 Z" fill="#ffffff" filter="url(#moonGlow)"/>
          <path d="M -15 -35 A 30 30 0 1 1 -15 25 A 35 35 0 1 0 -15 -35 Z" fill="#ffffff"/>
          <circle cx="-30" cy="5" r="7" fill="url(#moonMetal)" stroke="#ffffff" stroke-width="1.5"/>
          <circle cx="-30" cy="5" r="3" fill="#38bdf8" filter="url(#moonGlow)"/>
        </g>
      </g>
    </svg>`;
  },
  cerimonia() {
    if (typeof SFX !== 'undefined') SFX.play('conquista');
    const ov = document.createElement('div');
    ov.className = 'cq-overlay';
    ov.style.background = 'radial-gradient(circle at center, rgba(8,47,73,0.95) 0%, rgba(2,6,23,0.98) 100%)';
    const shimmerStyle = `background: linear-gradient(100deg, #ffffff 20%, #7dd3fc 40%, #ffffff 60%, #7dd3fc 80%); background-size: 220% auto; -webkit-background-clip: text; background-clip: text; color: transparent; animation: cq-shimmer 2.4s linear infinite;`;
    const raiosLuna = `position:absolute;top:130px;left:50%; width:900px;height:900px;margin:-450px 0 0 -450px; border-radius:50%; background:conic-gradient(from 0deg, transparent 0%, rgba(186,230,253,0.15) 5%, transparent 10%, rgba(255,255,255,0.1) 15%, transparent 20%, rgba(186,230,253,0.15) 25%, transparent 30%, rgba(255,255,255,0.1) 35%, transparent 40%, rgba(186,230,253,0.15) 45%, transparent 50%, rgba(255,255,255,0.1) 55%, transparent 60%, rgba(186,230,253,0.15) 65%, transparent 70%, rgba(255,255,255,0.1) 75%, transparent 80%, rgba(186,230,253,0.15) 85%, transparent 90%, rgba(255,255,255,0.1) 95%, transparent 100%); mask-image: radial-gradient(circle at center, black 0%, transparent 60%); -webkit-mask-image: radial-gradient(circle at center, black 0%, transparent 60%); animation: spin 40s linear infinite reverse; pointer-events:none; z-index:-1;`;
    ov.innerHTML = `
      <div class="cq-flash"></div>
      <div class="cq-palco">
        <div style="${raiosLuna}"></div>
        <div class="cq-medalha" style="width:260px;height:260px;margin-bottom:1rem;">${this._svgMedalhaDiana(260)}</div>
        <div class="cq-textos">
          <div style="font-family:var(--font-section);font-size:0.85rem;font-weight:700;letter-spacing:4px;color:#bae6fd;text-transform:uppercase;margin-bottom:0.6rem;text-shadow: 0 0 10px rgba(186,230,253,0.5);">🌙 FÚRIA DA LUA MINGUANTE 🌙</div>
          <div style="font-family:var(--font-title);font-size:2.8rem;text-shadow:0 8px 25px rgba(0,0,0,0.8);letter-spacing:2px; line-height:1.1; ${shimmerStyle}">PAULO</div>
          <div style="font-family:var(--font-section);font-size:1.1rem;font-weight:700;letter-spacing:6px;color:#e2e8f0;margin-top:0.6rem; text-shadow:0 2px 4px #000;">O MONO DIANA</div>
          <div style="margin-top:1.5rem;font-family:'Orbitron',monospace;font-size:1.4rem;font-weight:700;color:#7dd3fc;text-shadow:0 0 15px rgba(125,211,252,0.8);letter-spacing:2px;">+1.000.000 MAESTRIA</div>
        </div>
      </div>`;
    document.body.appendChild(ov);
    setTimeout(() => {
      const cx = window.innerWidth/2, cy = window.innerHeight/2 - 40;
      if (typeof Particles !== 'undefined') {
        Particles.burst(cx, cy, 60, 'rgba(255,255,255,');
        setTimeout(() => Particles.burst(cx, cy, 40, 'rgba(125,211,252,'), 150);
        setTimeout(() => Particles.burst(cx, cy, 30, 'rgba(8,47,73,'), 300);
      }
    }, 50);
    setTimeout(() => {
      if (typeof SFX !== 'undefined') SFX.play('carimbo');
      ov.classList.add('cq-saindo');
      this._selo();
      this._carimbarQuadro();
      setTimeout(() => ov.remove(), 500);
    }, 3800);
  },
  _selo() {
    let pilha = document.getElementById('cq-pilha');
    if (!pilha) { pilha = document.createElement('div'); pilha.id = 'cq-pilha'; document.body.appendChild(pilha); }
    const el = document.createElement('div');
    el.className = 'cq-selo';
    el.style.borderLeft = '4px solid #bae6fd';
    el.style.background = 'linear-gradient(90deg, rgba(8,47,73,0.95), rgba(2,6,23,0.98))';
    el.innerHTML = `
      <div class="cq-selo-ico" style="position:relative;width:40px;height:40px;margin-right:14px;filter:drop-shadow(0 2px 4px rgba(186,230,253,0.5))">${this._svgMedalhaDiana(40)}</div>
      <div><div class="cq-selo-lbl" style="color:#e0f2fe;font-weight:700;letter-spacing:1px;font-size:0.65rem">FÚRIA DA LUA MINGUANTE</div><div class="cq-selo-nome" style="color:#fff;font-size:1.1rem">PAULO</div></div>
      <div class="cq-selo-xp" style="color:#7dd3fc;text-shadow:0 0 10px rgba(125,211,252,0.5)">+1M MP</div>`;
    pilha.appendChild(el);
    setTimeout(() => { el.classList.add('cq-selo-out'); setTimeout(() => el.remove(), 500); }, 6000);
  },
  _carimbarQuadro() {
    const quadro = document.getElementById('lista-conquistas-recentes');
    if (!quadro) return;
    quadro.querySelector('.empty-state')?.remove();
    if (quadro.querySelector('[data-cq-chave="demo-diana"]')) return;

    const card = document.createElement('div');
    card.className = 'conquista-mini cq-carimbo c-entering c-materializing';
    card.dataset.cqChave = 'demo-diana';
    card.style.borderColor = 'rgba(56,189,248,0.4)';
    card.style.background = 'linear-gradient(90deg, rgba(5,15,30,0.9), rgba(0,5,15,0.95))';
    card.style.boxShadow = '0 0 15px rgba(56,189,248,0.2) inset, 0 0 8px rgba(56,189,248,0.2)';
    
    card.innerHTML = `
      <div class="cq-nevoa" style="background: radial-gradient(circle at left, rgba(56,189,248,0.3) 0%, transparent 60%);"></div>
      
      <span class="cq-medalhinha" style="width:52px;height:52px;flex-shrink:0;">
        ${this._svgMedalhaDiana(52)}
      </span>
      
      <div class="conquista-mini-info">
        <div class="conquista-mini-nome" style="color:#bae6fd; text-shadow:0 0 5px rgba(56,189,248,0.4)">Fúria da Lua Minguante</div>
        <div class="conquista-mini-desc" style="color:#d1d5db">O Mono Diana — Paulo (+1.000.000 Maestria)</div>
      </div>`;
    quadro.prepend(card);
    
    setTimeout(() => { if (typeof SFX !== 'undefined') SFX.play('carimbo'); }, 380);
  },

  vitrineCustomizada() {
    let ex = document.getElementById('mc-diana-vitrine');
    if (ex) { ex.remove(); return; }

    const ov = document.createElement('div');
    ov.id = 'mc-diana-vitrine';
    ov.className = 'cq-overlay';
    ov.style.zIndex = '10000';
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    ov.innerHTML = `
      <div style="background: linear-gradient(135deg, #0f172a 0%, #020617 100%); border: 1px solid #38bdf8 !important; position: relative; overflow: visible; box-shadow: 0 0 30px rgba(56,189,248,.35); border-radius: 8px; width: 400px; max-width: 90vw; cursor: default" onclick="event.stopPropagation()">
        <div class="cq-nevoa" style="background: radial-gradient(circle at center, rgba(186,230,253,0.5), rgba(56,189,248,0.18) 45%, transparent 70%);"></div>
        <div style="position:absolute; inset:1px; background:#0f172a; border-radius:6px; z-index:1; overflow:hidden">
          <div style="position:absolute; inset:-2px; background:linear-gradient(45deg, #0f172a, #7dd3fc, #0f172a); z-index:0; opacity:0; transition:opacity .3s"></div>
        </div>
        <div style="position:relative; z-index:2; padding:0.75rem 1rem; display:flex; align-items:center; gap:1rem; width:100%">
          <div style="flex-shrink:0; width:34px; height:34px; filter:drop-shadow(0 0 5px rgba(186,230,253,0.5)); animation: spin 15s linear infinite">${this._svgMedalhaDiana(34)}</div>
          <div style="flex:1; min-width:0">
            <div style="font-family:var(--font-section); font-size:0.55rem; letter-spacing:1px; color:#94a3b8; text-transform:uppercase; margin-bottom:2px">LENDÁRIO</div>
            <div style="font-family:var(--font-title); font-size:1.05rem; letter-spacing:0.5px; background:linear-gradient(90deg, #ffffff, #7dd3fc); -webkit-background-clip:text; color:transparent; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">O Mono Diana</div>
          </div>
          <div style="font-family:'Orbitron',monospace; font-size:0.75rem; color:#bae6fd; font-weight:700">+1M</div>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
  }
};

const ArquitetoConsole = {
  _aberto: false,

  _ehArquiteto() {
    try { return Auth.getUsuario()?.nivel_acesso === 'Arquiteto'; }
    catch (_) { return false; }
  },

  init() {
    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        this.toggle();
      }
    });
    // Duplo-clique no badge de rank da sidebar
    document.getElementById('sidebar-rank')?.addEventListener('dblclick', () => this.toggle());
  },

  toggle() {
    if (!this._ehArquiteto()) return;
    this._aberto ? this.fechar() : this.abrir();
  },

  abrir() {
    this._garantirDOM();
    document.getElementById('arq-console').style.display = 'flex';
    this._aberto = true;
  },

  fechar() {
    const el = document.getElementById('arq-console');
    if (el) el.style.display = 'none';
    this._aberto = false;
  },

  /* ── Disparadores (tudo simulado, nada persiste) ───────── */
  _CONQUISTAS_TESTE: [
    { icone: '🌀', titulo: 'Primeira Travessia',  descricao: 'Faça o primeiro clear de uma Dungeon', xp_bonus: 100 },
    { icone: '⭐', titulo: 'Perfeccionista',      descricao: 'Conquiste um clear rank S numa Dungeon', xp_bonus: 250 },
    { icone: '🔥', titulo: 'Imparável',           descricao: 'Some 30 clears de Dungeon', xp_bonus: 800 },
    { icone: '⚡', titulo: 'Caçador de Eventos',  descricao: 'Capture 10 eventos dentro de Dungeons', xp_bonus: 200 },
    { icone: '🌑', titulo: 'Lendário',            descricao: 'Alcance o nível 50', xp_bonus: 2000 },
  ],

  cerimonia() {
    const c = this._CONQUISTAS_TESTE[Math.floor(Math.random() * this._CONQUISTAS_TESTE.length)];
    // clona com timestamp p/ furar o dedup e sinaliza que é ensaio
    ConquistaFX.show({ ...c, id: 'teste_' + Date.now(), titulo: c.titulo });
  },

  fila3() {
    // Testa a fila: três cerimônias em sequência
    const embaralhado = [...this._CONQUISTAS_TESTE].sort(() => Math.random() - .5).slice(0, 3);
    embaralhado.forEach(c => ConquistaFX.show({ ...c, id: 'teste_' + Date.now() + Math.random() }));
  },

  levelup() {
    const niveis = [
      [7,  'D-Rank', 'Caçador em Ascensão', 120],
      [15, 'B-Rank', 'Lâmina Confiável', 300],
      [30, 'A-Rank', 'Elite dos Portões', 550],
      [50, 'National-Level', 'Monarca das Sombras', 5000],
    ];
    const [n, r, t, m] = niveis[Math.floor(Math.random() * niveis.length)];
    Ascensao.mostrar([{ nivel: n, rank: r, titulo: t, moedas_bonus: m, nivel_anterior: n - 1 }]);
  },

  /* Ascensão com salto grande (vários níveis de uma vez) */
  ascensaoMultipla() {
    Ascensao.mostrar([{
      nivel: 12, rank: 'D-Rank', titulo: 'Sentinela',
      moedas_bonus: 940, nivel_anterior: 1, niveis_ganhos: 11,
    }]);
  },

  /* Sequência real: Ascensão -> Cerimônia (a ordem do Sistema) */
  async sequenciaCompleta() {
    await Ascensao.mostrar([{
      nivel: 10, rank: 'D-Rank', titulo: 'Sentinela',
      moedas_bonus: 700, nivel_anterior: 1, niveis_ganhos: 9,
    }]);
    ConquistaFX.show({
      id: 'seq_' + Date.now(), codigo: 'solo', icone: '🌌', titulo: 'SOLO',
      descricao: 'O selo da empresa — sistema tático de produtividade S-Rank',
      xp_bonus: 7500,
    });
  },

  explosao() {
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    Particles.burst(cx, cy, 60, 'rgba(251,191,36,');
    setTimeout(() => Particles.burst(cx, cy, 40, 'rgba(168,85,247,'), 180);
    setTimeout(() => Particles.burst(cx, cy, 30, 'rgba(34,211,238,'), 360);
  },

  xpfloat() {
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    createSparks(cx, cy, 12);
    XPFloat.show(150, cx, cy);
  },

  som(nome) { SFX.play(nome); },

  selo() {
    const c = this._CONQUISTAS_TESTE[Math.floor(Math.random() * this._CONQUISTAS_TESTE.length)];
    ConquistaFX._selo(c);
    ConquistaFX._carimbarQuadro(c);
  },

  /* ── Convites: convocar novos hunters ────────────────── */
  async convites() {
    let ex = document.getElementById('arq-convites');
    if (ex) { ex.remove(); return; }
    try {
      const [{ convites, resumo }, badges] = await Promise.all([
        API.convites.listar(), API.convites.badges(),
      ]);
      this._badgesDisp = badges;
      const el = document.createElement('div');
      el.id = 'arq-convites';
      el.style.cssText = `
        position:fixed;inset:0;z-index:9995;display:flex;align-items:center;justify-content:center;
        background:rgba(3,3,8,.9);backdrop-filter:blur(7px);padding:1.2rem`;

      const ESTADOS = {
        DISPONIVEL: ['#34d399', 'rgba(16,185,129,.4)', '◆ Disponível'],
        USADO:      ['#38bdf8', 'rgba(56,189,248,.4)', '✔ Utilizado'],
        EXPIRADO:   ['#94a3b8', 'rgba(148,163,184,.3)', '⌛ Expirado'],
        REVOGADO:   ['#f87171', 'rgba(239,68,68,.35)', '✕ Revogado'],
      };

      el.innerHTML = `
        <div style="width:min(620px,100%);max-height:88vh;display:flex;flex-direction:column;
          background:linear-gradient(170deg,#0d0b18,#07070f 65%);border:1px solid rgba(56,189,248,.45);
          border-radius:16px;box-shadow:0 0 50px rgba(56,189,248,.2);overflow:hidden">

          <div style="display:flex;align-items:center;gap:.7rem;padding:1.2rem 1.3rem .9rem;border-bottom:1px solid rgba(148,163,184,.12)">
            <span style="font-size:1.3rem">📜</span>
            <div style="flex:1">
              <div style="font-family:var(--font-title);font-size:1.05rem;color:#7dd3fc">O Chamado do Arquiteto</div>
              <div style="font-family:var(--font-section);font-size:.6rem;letter-spacing:.14em;color:var(--text-muted)">
                ${resumo.disponiveis} DISPONÍVEIS · ${resumo.usados} CONVOCADOS · ${resumo.total} NO TOTAL</div>
            </div>
            <button onclick="document.getElementById('arq-convites').remove()"
              style="background:none;border:none;color:var(--text-muted);font-size:1.1rem;cursor:pointer">✕</button>
          </div>

          <div style="padding:.9rem 1.3rem;border-bottom:1px solid rgba(148,163,184,.1)">
            <div style="display:flex;gap:.5rem;align-items:end;flex-wrap:wrap;margin-bottom:.7rem">
              <div style="flex:1;min-width:140px">
                <label style="display:block;font-family:var(--font-section);font-size:.58rem;letter-spacing:.12em;
                  text-transform:uppercase;color:var(--text-muted);margin-bottom:.25rem">Para quem? (opcional)</label>
                <input id="conv-nota" placeholder="ex.: para a Diana" style="width:100%;background:rgba(0,0,0,.5);
                  border:1px solid rgba(148,163,184,.2);border-radius:8px;color:var(--text-primary);
                  font-family:var(--font-section);font-size:.82rem;padding:.5rem .7rem">
              </div>
              <div style="width:86px">
                <label style="display:block;font-family:var(--font-section);font-size:.58rem;letter-spacing:.12em;
                  text-transform:uppercase;color:var(--text-muted);margin-bottom:.25rem">Validade</label>
                <input id="conv-dias" type="number" min="0" value="30" title="0 = não expira"
                  style="width:100%;background:rgba(0,0,0,.5);border:1px solid rgba(148,163,184,.2);
                  border-radius:8px;color:var(--text-primary);font-family:'Orbitron',monospace;
                  font-size:.8rem;padding:.5rem;text-align:center">
              </div>
            </div>

            <!-- Tipo de conta -->
            <label style="display:block;font-family:var(--font-section);font-size:.58rem;letter-spacing:.12em;
              text-transform:uppercase;color:var(--text-muted);margin-bottom:.3rem">Tipo de conta</label>
            <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.7rem">
              ${[
                ['User',      '\u{1F464} Hunter',        'Acesso padrão',              '#94a3b8', 'rgba(148,163,184,.12)', 'rgba(148,163,184,.25)'],
                ['Suporte',   '\u{1F3A7} Suporte',        'Consulta dados',                '#38bdf8', 'rgba(56,189,248,.12)',  'rgba(56,189,248,.3)'],
                ['Moderador', '\u{1F6E1}\uFE0F Moderador', 'Modera social',                 '#8b5cf6', 'rgba(139,92,246,.12)',  'rgba(139,92,246,.3)'],
                ['Admin',     '\u2699\uFE0F Administrador','Painel Admin liberado',         '#fbbf24', 'rgba(251,191,36,.12)',  'rgba(251,191,36,.3)'],
                ['Criador',   '\u26D2 Criador',           'Cria conteúdo global',      '#10b981', 'rgba(16,185,129,.12)',  'rgba(16,185,129,.3)'],
              ].map(([id, rot, sub, cor, bg, borda], i) => `
                <div data-conv-nivel="${id}" onclick="ArquitetoConsole._selNivel('${id}')" style="
                  flex:1;min-width:calc(33% - .3rem);padding:.45rem .5rem;border-radius:9px;cursor:pointer;text-align:center;
                  background:${i===0?bg:'rgba(255,255,255,.025)'};
                  border:1px solid ${i===0?borda:'rgba(148,163,184,.18)'};transition:all .2s"
                  data-bg="${bg}" data-borda="${borda}" data-cor="${cor}">
                  <div style="font-family:var(--font-section);font-size:.72rem;font-weight:700;
                    color:${i===0?cor:'var(--text-secondary)'}">${rot}</div>
                  <div style="font-size:.54rem;color:var(--text-dim);margin-top:.1rem">${sub}</div>
                </div>`).join('')}
            </div>

            <!-- Badges de presente -->
            <label style="display:block;font-family:var(--font-section);font-size:.58rem;letter-spacing:.12em;
              text-transform:uppercase;color:var(--text-muted);margin-bottom:.3rem">
              Presentes <span style="text-transform:none;letter-spacing:0;opacity:.7">— além de "O Chamado", que é automático</span></label>
            <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.8rem">
              ${badges.length ? badges.map(b => `
                <div data-conv-badge="${b.codigo}" onclick="ArquitetoConsole._selBadge('${b.codigo}')"
                  title="${b.descricao || ''} (+${b.xp_bonus} XP)" style="
                  display:flex;align-items:center;gap:.35rem;padding:.35rem .65rem;border-radius:100px;
                  cursor:pointer;background:rgba(255,255,255,.025);
                  border:1px solid rgba(148,163,184,.2);transition:all .2s">
                  <span style="font-size:.9rem">${b.icone}</span>
                  <span style="font-family:var(--font-section);font-size:.68rem;font-weight:700;
                    color:var(--text-secondary)">${b.titulo}</span>
                </div>`).join('')
                : '<span style="font-size:.65rem;color:var(--text-dim)">Nenhuma badge presenteável cadastrada.</span>'}
            </div>

            <button onclick="ArquitetoConsole._gerarConvite()" style="
              width:100%;font-family:var(--font-section);font-size:.78rem;font-weight:700;letter-spacing:.08em;
              padding:.6rem 1.1rem;border-radius:8px;cursor:pointer;color:#fff;
              background:linear-gradient(100deg,#0369a1,#0284c7);border:1px solid #38bdf8;
              box-shadow:0 0 14px rgba(56,189,248,.35)">📜 Convocar Hunter</button>
          </div>

          <div style="flex:1;overflow-y:auto;padding:.8rem 1.3rem 1.2rem">
            ${convites.length ? convites.map(cv => {
              const [cor, borda, rot] = ESTADOS[cv.estado] || ESTADOS.EXPIRADO;
              return `
              <div style="display:flex;align-items:center;gap:.7rem;padding:.6rem .8rem;margin-bottom:.5rem;
                border-radius:11px;background:rgba(255,255,255,.025);border:1px solid ${borda}">
                <div style="flex:1;min-width:0">
                  <div style="font-family:'Orbitron',monospace;font-size:.85rem;font-weight:700;color:${cor};letter-spacing:.04em">${cv.codigo}</div>
                  <div style="font-size:.62rem;color:var(--text-muted);margin-top:.15rem">
                    ${rot}${(() => {
                      const mapa = {
                        Admin:     '<b style="color:#fbbf24">\u2699\uFE0F ADMIN</b>',
                        Criador:   '<b style="color:#10b981">\u26D2 CRIADOR</b>',
                        Moderador: '<b style="color:#8b5cf6">\u{1F6E1}\uFE0F MODERADOR</b>',
                        Suporte:   '<b style="color:#38bdf8">\u{1F3A7} SUPORTE</b>',
                      };
                      return mapa[cv.nivel_acesso] ? ' \u00b7 ' + mapa[cv.nivel_acesso] : '';
                    })()}${cv.nota ? ' \u00b7 ' + cv.nota : ''}${cv.usado_por ? ' \u00b7 <b style="color:#7dd3fc">' + cv.usado_por.nome + '</b>' : ''}
                  </div>
                  ${cv.badges?.length ? `<div style="font-size:.6rem;color:var(--gold-bright);margin-top:.15rem">
                    🎁 ${cv.badges.map(b => b.icone + ' ' + b.titulo).join(' · ')}</div>` : ''}
                </div>
                ${cv.estado === 'DISPONIVEL' ? `
                  <button onclick="ArquitetoConsole._copiarConvite('${cv.codigo}')" title="Copiar código"
                    style="font-size:.75rem;padding:.35rem .6rem;border-radius:7px;cursor:pointer;color:#7dd3fc;
                    background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.35)">📋</button>
                  <button onclick="ArquitetoConsole._revogarConvite(${cv.id})" title="Revogar"
                    style="font-size:.75rem;padding:.35rem .6rem;border-radius:7px;cursor:pointer;color:#f87171;
                    background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3)">✕</button>` : ''}
              </div>`;
            }).join('') : `<div style="text-align:center;padding:2rem 1rem;color:var(--text-muted);font-family:var(--font-section);font-size:.8rem">
                Nenhum convite ainda.<br><span style="font-size:.68rem;color:var(--text-dim)">Gere um código e envie a quem você quer convocar.</span></div>`}
          </div>

          <div style="padding:.7rem 1.3rem;border-top:1px solid rgba(148,163,184,.1);font-size:.6rem;
            color:var(--text-dim);font-family:var(--font-section);line-height:1.6">
            Quem entrar com o seu código recebe a badge <b style="color:#7dd3fc">O Chamado do Arquiteto</b> (+500 XP).<br>
            Cada código serve para um único hunter.
          </div>
        </div>`;
      el.addEventListener('click', e => { if (e.target === el) el.remove(); });
      document.body.appendChild(el);
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
    }
  },

  _convNivel: 'User',
  _convBadges: [],

  _selNivel(id) {
    this._convNivel = id;
    document.querySelectorAll('[data-conv-nivel]').forEach(el => {
      const on = el.dataset.convNivel === id;
      // Usa as cores guardadas como data-attributes no botão (geradas pelo template)
      const bg    = el.dataset.bg    || 'rgba(255,255,255,.025)';
      const borda = el.dataset.borda || 'rgba(148,163,184,.18)';
      const cor   = el.dataset.cor   || 'var(--text-secondary)';
      el.style.background  = on ? bg    : 'rgba(255,255,255,.025)';
      el.style.borderColor = on ? borda : 'rgba(148,163,184,.18)';
      el.querySelector('div').style.color = on ? cor : 'var(--text-secondary)';
    });
  },


  _selBadge(cod) {
    const i = this._convBadges.indexOf(cod);
    if (i >= 0) this._convBadges.splice(i, 1); else this._convBadges.push(cod);
    const el = document.querySelector(`[data-conv-badge="${cod}"]`);
    const on = this._convBadges.includes(cod);
    if (el) {
      el.style.background = on ? 'rgba(251,191,36,.16)' : 'rgba(255,255,255,.025)';
      el.style.borderColor = on ? 'var(--gold-bright)' : 'rgba(148,163,184,.2)';
      el.style.boxShadow = on ? '0 0 12px rgba(251,191,36,.3)' : 'none';
      el.querySelectorAll('span')[1].style.color = on ? 'var(--gold-bright)' : 'var(--text-secondary)';
    }
  },

  async _gerarConvite() {
    const nota = document.getElementById('conv-nota')?.value?.trim() || null;
    const dias = parseInt(document.getElementById('conv-dias')?.value);
    try {
      const r = await API.convites.gerar({
        nota, validade_dias: (isNaN(dias) || dias <= 0) ? null : dias, quantidade: 1,
        nivel_acesso: this._convNivel,
        badges: this._convBadges.length ? [...this._convBadges] : null,
      });
      this._convBadges = []; this._convNivel = 'User';
      const cod = r.convites[0].codigo;
      await this._copiarConvite(cod);
      if (typeof SFX !== 'undefined') SFX.play('carimbo');
      document.getElementById('arq-convites')?.remove();
      this.convites();
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
    }
  },

  async _copiarConvite(codigo) {
    try {
      await navigator.clipboard.writeText(codigo);
      SoloDialog?.toast?.(`📋 ${codigo} copiado`, 'success');
    } catch (_) {
      SoloDialog?.toast?.(`Código: ${codigo}`, 'info', 6000);
    }
  },

  async _revogarConvite(id) {
    const ok = await SoloDialog.confirm('Revogar este convite? Ele deixa de funcionar imediatamente.',
      { titulo: 'Revogar Convite', tipo: 'warn', icon: '✕', btnOk: 'Revogar', btnCancel: 'Manter' });
    if (!ok) return;
    try {
      await API.convites.revogar(id);
      SoloDialog?.toast?.('Convite revogado', 'info');
      document.getElementById('arq-convites')?.remove();
      this.convites();
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
    }
  },

  /* ── Vitrine do Cartão de Missão (componente real, modo demo) ── */
  cardMissao() {
    let ex = document.getElementById('mc-vitrine');
    if (ex) { ex.remove(); return; }

    const hhmm = (min) => {
      const d = new Date(Date.now() + min * 60000);
      return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    };

    // Amostras cobrindo as 4 prioridades (a cor do cartão) e os 4 ranks
    const amostras = [
      { id: 9001, titulo: 'O Futuro dos Cards Solo', categoria: 'Trabalho',
        prioridade: 'CRITICA', dificuldade: 'LENDARIO',
        xp_recompensa: 500, moedas_recompensa: 50, icone: '💠',
        hora_inicio: hhmm(-120), hora_fim: hhmm(180), status_hoje: 'PENDENTE' },
      { id: 9002, titulo: 'Treino de Força — Ciclo A', categoria: 'Saúde',
        prioridade: 'ALTA', dificuldade: 'DIFICIL',
        xp_recompensa: 220, moedas_recompensa: 20, icone: '💪',
        hora_inicio: hhmm(-60), hora_fim: hhmm(25), status_hoje: 'ATIVA' },
      { id: 9003, titulo: 'Revisar arquitetura do Sistema', categoria: 'Estudo',
        prioridade: 'MEDIA', dificuldade: 'NORMAL',
        xp_recompensa: 90, moedas_recompensa: 8, icone: '📚',
        hora_inicio: hhmm(-200), hora_fim: hhmm(400), status_hoje: 'PAUSADA' },
      { id: 9004, titulo: 'Preparar o jantar', categoria: 'Casa',
        prioridade: 'BAIXA', dificuldade: 'FACIL',
        xp_recompensa: 40, moedas_recompensa: 4, icone: '🍳', status_hoje: 'CONCLUIDA' },
      { id: 9005, titulo: 'Beber 3L de água', categoria: 'Saúde',
        prioridade: 'MEDIA', dificuldade: 'FACIL',
        xp_recompensa: 30, moedas_recompensa: 3, icone: '💧', status_hoje: 'FRACASSADA' },
    ];

    const el = document.createElement('div');
    el.id = 'mc-vitrine';
    el.style.cssText = `
      position:fixed;inset:0;z-index:9994;display:flex;align-items:center;justify-content:center;
      background:rgba(3,3,8,.9);backdrop-filter:blur(7px);padding:1.2rem`;
    el.innerHTML = `
      <div style="width:min(820px,100%);max-height:90vh;overflow-y:auto;padding:1.4rem 1.5rem;
        background:linear-gradient(170deg,#0d0b18,#07070f 65%);border:1px solid rgba(168,85,247,.45);
        border-radius:16px;box-shadow:0 0 50px rgba(168,85,247,.22)">
        <div style="display:flex;align-items:center;gap:.7rem;margin-bottom:1rem">
          <span style="font-size:1.2rem">🗂</span>
          <div style="flex:1">
            <div style="font-family:var(--font-title);font-size:1rem;color:var(--purple-glow)">Cartão de Missão — proposta</div>
            <div style="font-family:var(--font-section);font-size:.6rem;letter-spacing:.14em;color:var(--text-muted)">COMPONENTE REAL EM MODO DEMONSTRAÇÃO · OS BOTÕES TRANSITAM DE ESTADO</div>
          </div>
          <button onclick="document.getElementById('mc-vitrine').remove()"
            style="background:none;border:none;color:var(--text-muted);font-size:1.1rem;cursor:pointer">✕</button>
        </div>
        <div id="mc-vitrine-lista"></div>
        <div style="font-size:.62rem;color:var(--text-dim);margin-top:.8rem;font-family:var(--font-section);line-height:1.6">
          A <b>cor</b> vem da prioridade · o <b>selo de rank</b> vem da dificuldade.<br>
          Clique em <b>Iniciar</b> para ver a máquina de estados · timer regressivo real.
        </div>
      </div>`;
    el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    document.body.appendChild(el);

    const lista = document.getElementById('mc-vitrine-lista');
    MissaoCard.cachear(amostras);
    lista.innerHTML = amostras.map(m => MissaoCard.html(m)).join('');
    MissaoCard.montar(lista, { demo: true });
  },

  /* Vitrine do novo Lançador (componente real, modo demonstração) */
  forjaMissao() {
    if (typeof ForjaMissao === 'undefined') {
      SoloDialog?.toast?.('ForjaMissao não carregado', 'error');
      return;
    }
    ForjaMissao.abrir({ demo: true });
  },

  /* Liga/desliga o banner cosmético na Janela de Status */
  banner() {
    const janela = document.getElementById('hunter-card') || document.getElementById('perfil-window');
    if (!janela) {
      SoloDialog?.toast?.('Abra o Dashboard ou o Perfil primeiro', 'warn');
      return;
    }
    if (janela.dataset.banner) {
      delete janela.dataset.banner;
      SoloDialog?.toast?.('🚫 Banner removido', 'info');
    } else {
      janela.dataset.banner = 'monarca';
      SoloDialog?.toast?.('🖼 Banner "O Monarca" equipado', 'success');
    }
  },

  /* Insígnias com arte própria — fonte única: o registro do ConquistaFX.
     Não duplicar o mapa aqui: badge nova se registra num lugar só. */
  _insignia(codigo, tam = 44) {
    try { return window.ConquistaFX?._insigniaCustom?.(codigo, tam) || null; }
    catch (_) { return null; }
  },

  /* ── Comemorativas: conceder de verdade e controlar visibilidade ── */
  async comemorativas() {
    let cx = document.getElementById('arq-comemorativas');
    if (cx) { cx.remove(); return; }
    try {
      const lista = await API.conquistas.comemorativas();
      cx = document.createElement('div');
      cx.id = 'arq-comemorativas';
      cx.style.cssText = `
        position:fixed;inset:0;z-index:9995;display:flex;align-items:center;justify-content:center;
        background:rgba(3,3,8,.88);backdrop-filter:blur(6px);padding:1.2rem`;
      cx.innerHTML = `
        <div style="width:min(560px,100%);max-height:86vh;overflow-y:auto;padding:1.4rem 1.5rem;
          background:linear-gradient(170deg,#1a1206,#0d0d1a 60%);border:1px solid rgba(251,191,36,.5);
          border-radius:16px;box-shadow:0 0 50px rgba(251,191,36,.25)">
          <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:1rem">
            <span style="font-size:1.2rem">🏛</span>
            <div style="flex:1">
              <div style="font-family:var(--font-title);font-size:1rem;color:var(--gold-bright)">Comemorativas do Arquiteto</div>
              <div style="font-family:var(--font-section);font-size:.6rem;letter-spacing:.14em;color:var(--text-muted)">MARCOS DO DESENVOLVIMENTO · SÓ VOCÊ VÊ</div>
            </div>
            <button onclick="document.getElementById('arq-comemorativas').remove()"
              style="background:none;border:none;color:var(--text-muted);font-size:1.1rem;cursor:pointer">✕</button>
          </div>
          ${lista.map(c => `
            <div style="display:flex;align-items:center;gap:.8rem;padding:.7rem .8rem;margin-bottom:.5rem;
              border-radius:12px;background:rgba(255,255,255,.03);border:1px solid ${c.desbloqueada ? 'rgba(56,189,248,.4)' : 'rgba(148,163,184,.15)'}">
              <span style="width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">
                ${this._insignia(c.codigo, 44) || `<span style="font-size:1.5rem">${c.icone}</span>`}
              </span>
              <div style="flex:1;min-width:0">
                <div style="font-family:var(--font-section);font-weight:700;font-size:.85rem;color:var(--text-primary)">${c.titulo}</div>
                <div style="font-size:.66rem;color:var(--text-muted)">${c.descricao}</div>
                <div style="font-family:'Orbitron',monospace;font-size:.62rem;color:var(--gold-bright);margin-top:.15rem">+${c.xp_bonus} XP · +${c.moedas_bonus} 💰</div>
              </div>
              <div style="display:flex;flex-direction:column;gap:.3rem;align-items:stretch">
                ${c.desbloqueada
                  ? `<span style="font-size:.58rem;font-family:var(--font-section);color:#34d399;text-align:center">✔ CONQUISTADA</span>
                     <button onclick="ArquitetoConsole._revogar(${c.id})" title="Devolve ao estado bloqueado e estorna o bônus — permite reviver a cerimônia"
                       style="font-family:var(--font-section);font-size:.6rem;font-weight:700;
                       padding:.3rem .6rem;border-radius:7px;cursor:pointer;color:#f87171;
                       background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.35)">↺ REVOGAR</button>`
                  : `<button onclick="ArquitetoConsole._conceder(${c.id})" style="font-family:var(--font-section);font-size:.65rem;font-weight:700;
                      padding:.35rem .7rem;border-radius:7px;cursor:pointer;color:#38bdf8;
                      background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.4)">CONCEDER</button>`}
                <label style="display:flex;align-items:center;gap:.3rem;font-family:var(--font-section);font-size:.6rem;color:var(--text-muted);cursor:pointer">
                  <input type="checkbox" ${c.visivel ? 'checked' : ''}
                    onchange="ArquitetoConsole._visibilidade(${c.id}, this.checked)"
                    style="accent-color:var(--gold-bright);cursor:pointer">
                  visível
                </label>
              </div>
            </div>`).join('')}
          <div style="font-size:.6rem;color:var(--text-dim);margin-top:.6rem;font-family:var(--font-section)">
            Ocultar remove a medalha do seu perfil — o progresso permanece.
          </div>
        </div>`;
      cx.addEventListener('click', e => { if (e.target === cx) cx.remove(); });
      document.body.appendChild(cx);
    } catch (err) {
      SoloDialog.toast('Erro: ' + (err.message || err), 'error');
    }
  },

  async _conceder(id) {
    try {
      await API.conquistas.conceder(id);   // o interceptador do api.js dispara a Cerimônia
      document.getElementById('arq-comemorativas')?.remove();
    } catch (err) {
      SoloDialog.toast(err.message || String(err), 'error');
    }
  },

  async _revogar(id) {
    const ok = await SoloDialog.confirm(
      'Revogar esta comemorativa? Ela volta ao estado bloqueado e o XP/moedas do bônus são estornados — útil para rever a cerimônia.',
      { titulo: 'Revogar Comemorativa', tipo: 'warn', icon: '↺', btnOk: 'Revogar', btnCancel: 'Cancelar' }
    );
    if (!ok) return;
    try {
      const r = await API.conquistas.revogar(id);
      SoloDialog.toast(`↺ Revogada — −${r.xp_estornado} XP estornados`, 'info');
      // Reabre o painel já atualizado
      document.getElementById('arq-comemorativas')?.remove();
      this.comemorativas();
      // Estorno não passa pelo canal de celebração: atualiza a tela na mão
      window.App?.atualizarPaginaAtual?.();
    } catch (err) {
      SoloDialog.toast(err.message || String(err), 'error');
    }
  },

  /* Reconcilia nível/rank/título com o XP acumulado e celebra o resultado */
  async sincronizarNivel() {
    try {
      const r = await API.post('/conquistas/sincronizar-nivel', {});
      if (!r.level_ups?.length) {
        SoloDialog.toast('✔ Nível já está em dia', 'info');
        return;
      }
      // A Ascensão e a atualização da tela vêm pelo canal 'sr:recompensa'
    } catch (err) {
      SoloDialog.toast(err.message || String(err), 'error');
    }
  },

  async _visibilidade(id, visivel) {
    try {
      await API.conquistas.visibilidade(id, visivel);
      SoloDialog.toast(visivel ? '👁 Medalha visível no perfil' : '🚫 Medalha oculta', 'info');
    } catch (err) {
      SoloDialog.toast(err.message || String(err), 'error');
    }
  },

  dominioHabilidades() {
    if (typeof ConquistaFX === 'undefined') return;
    ConquistaFX.show({
      id: 'conq_dev_habilidades_' + Date.now(),
      codigo: 'dominio_habilidades',
      icone: '💻',
      titulo: 'Domínio das Habilidades',
      descricao: 'Desenvolvimento integrado S-Rank (Caçador, Opus e Gemini)',
      xp_bonus: 5000
    });
  },

  /* ── DOM ───────────────────────────────────────────────── */
  _garantirDOM() {
    if (document.getElementById('arq-console')) return;

    const btn = (rotulo, acao) => `
      <button onclick="ArquitetoConsole.${acao}" style="
        font-family:var(--font-section);font-size:.78rem;font-weight:700;letter-spacing:.06em;
        padding:.6rem .9rem;border-radius:10px;cursor:pointer;text-align:left;
        color:var(--gold-bright);background:rgba(251,191,36,.07);
        border:1px solid rgba(251,191,36,.35);transition:all .15s"
        onmouseover="this.style.background='rgba(251,191,36,.18)';this.style.boxShadow='0 0 12px rgba(251,191,36,.35)'"
        onmouseout="this.style.background='rgba(251,191,36,.07)';this.style.boxShadow='none'">
        ${rotulo}
      </button>`;

    const el = document.createElement('div');
    el.id = 'arq-console';
    el.style.cssText = `
      position:fixed;right:1.2rem;top:4.5rem;z-index:9990;display:none;
      flex-direction:column;gap:.15rem;width:290px;padding:.9rem 1rem 1rem;
      background:linear-gradient(170deg,#1a1206,#0d0d1a 60%);
      border:1px solid rgba(251,191,36,.55);border-radius:16px;
      box-shadow:0 0 40px rgba(251,191,36,.25), 0 18px 50px rgba(0,0,0,.6);`;
    /* ── Helpers de UI do painel ── */
    const CORES = {
      ouro:     ['var(--gold-bright)', '251,191,36'],
      roxo:     ['#d8b4fe',            '168,85,247'],
      violeta:  ['#c4b5fd',            '139,92,246'],
      ciano:    ['#67e8f9',            '34,211,238'],
      cinza:    ['#94a3b8',            '148,163,184'],
      vermelho: ['#f87171',            '239,68,68'],
      rosa:     ['#ff6ec4',            '255,46,154'],   // insígnias Evelynn
    };
    const bt = (rotulo, acao, tom = 'ouro', tracejado = false) => {
      const [cor, rgb] = CORES[tom] || CORES.ouro;
      const chamada = acao.includes('(') && !acao.startsWith('window.') && !acao.startsWith('if(')
        ? `ArquitetoConsole.${acao}` : acao;
      return `
      <button onclick="${chamada}" style="
        font-family:var(--font-section);font-size:.73rem;font-weight:700;letter-spacing:.04em;
        padding:.5rem .75rem;border-radius:9px;cursor:pointer;text-align:left;
        color:${cor};background:rgba(${rgb},.06);
        border:1px ${tracejado ? 'dashed' : 'solid'} rgba(${rgb},.32);transition:all .15s"
        onmouseover="this.style.background='rgba(${rgb},.18)';this.style.boxShadow='0 0 10px rgba(${rgb},.3)'"
        onmouseout="this.style.background='rgba(${rgb},.06)';this.style.boxShadow='none'">
        ${rotulo}
      </button>`;
    };
    const sec = (id, titulo, aberta, botoes, extra = '') => `
      <div class="arq-sec" data-sec="${id}">
        <button class="arq-sec-cab" data-arq-sec="${id}" style="
          display:flex;align-items:center;gap:.4rem;width:100%;
          font-family:var(--font-section);font-size:.6rem;font-weight:700;
          letter-spacing:.14em;text-transform:uppercase;color:var(--text-muted);
          background:none;border:none;cursor:pointer;padding:.45rem .2rem .3rem;text-align:left">
          <span class="arq-sec-seta" style="transition:transform .2s;display:inline-block;${aberta ? 'transform:rotate(90deg)' : ''}">▸</span>
          <span style="flex:1">${titulo}</span>
        </button>
        <div class="arq-sec-corpo" style="display:${aberta ? 'flex' : 'none'};flex-direction:column;gap:.3rem;padding-bottom:.35rem">
          ${botoes.join('')}${extra}
        </div>
      </div>`;

    el.innerHTML = `
      <div id="arq-console-handle" style="display:flex;align-items:center;gap:.5rem;padding-bottom:.5rem;margin-bottom:.2rem;border-bottom:1px solid rgba(251,191,36,.2);cursor:grab;user-select:none" title="Arraste para mover">
        <span style="font-size:1.1rem">⚒</span>
        <div style="flex:1">
          <div style="font-family:var(--font-title);font-size:.85rem;color:var(--gold-bright)">Forja de Testes</div>
          <div style="font-family:var(--font-section);font-size:.56rem;letter-spacing:.14em;color:var(--text-muted)">SÓ O ARQUITETO VÊ · NADA É SALVO</div>
        </div>
        <button onclick="ArquitetoConsole.fechar()" style="color:var(--text-muted);cursor:pointer;font-size:1rem;background:none;border:none">✕</button>
      </div>

      <div id="arq-console-corpo" style="display:flex;flex-direction:column;gap:.3rem;overflow-y:auto;max-height:min(72vh,620px);padding-right:.25rem;margin-right:-.25rem">

        ${sec('propostas', '🗂 Propostas de Interface', true, [
          bt('Cartão de Missão',        'cardMissao()',   'roxo'),
          bt('Forja de Missões',        'forjaMissao()',  'roxo'),
          bt('Banner "O Monarca"',      'banner()',       'roxo'),
        ])}

        ${sec('hunters', '📜 Hunters & Convites', false, [
          bt('Convocar hunters (convites)', 'convites()', 'ciano'),
        ])}

        ${sec('conquistas', '🏅 Conquistas & Cerimônias', false, [
          bt('Comemorativas (conceder/ocultar)', 'comemorativas()', 'ouro'),
          bt('Cerimônia de Conquista',           'cerimonia()',     'ouro'),
          bt('Fila — 3 cerimônias seguidas',     'fila3()',         'ouro'),
          bt('Selo + carimbo no quadro',         'selo()',          'ouro'),
        ])}

        ${sec('ascensao', '✨ Ascensão & Nível', false, [
          bt('Ascensão (1 nível)',            'levelup()',           'violeta'),
          bt('Ascensão múltipla (+11)',       'ascensaoMultipla()',  'violeta'),
          bt('Sequência: Ascensão → Cerimônia','sequenciaCompleta()', 'violeta'),
          bt('Sincronizar meu nível (reparo)','sincronizarNivel()',  'ciano'),
        ])}

        ${sec('efeitos', '💥 Efeitos Avulsos', false, [
          bt('Explosão de partículas', 'explosao()', 'ciano'),
          bt('Sparks + XP Float',      'xpfloat()',  'ciano'),
        ])}

        ${sec('gemini', '🧪 Protótipos (Gemini)', false, [
          bt('Medalha JH3FFTH',       'window.Jh3ffthFX.toggle()', 'cinza', true),
          bt('Medalha SOLO',          'window.SoloFX.toggle()',    'cinza', true),
          bt('Card de Rotina',        'window.SoloFX.demoCard()',  'cinza', true),
          bt('Lançador de Missões',   'window.SoloFX.demoLauncher()', 'cinza', true),
          bt('Domínio da Forja',      'window.ForjaFX.demo()',     'cinza', true),
          bt('Domínio das Habilidades','dominioHabilidades()', 'cinza', true),
          bt('Medalha Diana (Foice)', 'window.DianaFX.cerimonia()', 'ciano', true),
          bt('Vitrine: Mono Diana',   'window.DianaFX.vitrineCustomizada()', 'ciano', true),
        ])}

        ${sec('insignias', '🎖 Insígnias com arte própria', false, [
          bt('Cerimônia: Mono Evelynn', 'window.EvelynnFX.cerimonia()', 'rosa', true),
          bt('Vitrine: Mono Evelynn',   'vitrineInsignia("mono_evelynn")', 'rosa', true),
          bt('Vitrine: todas as artes', 'vitrineInsignia()', 'ciano', true),
          bt('Vitrine: auras',          'window.Auras.vitrine()', 'ouro', true),
        ])}

        ${sec('sons', '🔊 Sons', false, [], `
          <div style="display:flex;gap:.35rem">
            ${['conquista','carimbo','levelup'].map((s,i) => `
              <button onclick="ArquitetoConsole.som('${s}')" style="
                flex:1;font-family:var(--font-section);font-size:.62rem;font-weight:700;
                padding:.45rem .2rem;border-radius:8px;cursor:pointer;text-align:center;line-height:1.3;
                color:var(--gold-bright);background:rgba(251,191,36,.07);
                border:1px solid rgba(251,191,36,.3);transition:all .15s"
                onmouseover="this.style.background='rgba(251,191,36,.2)'"
                onmouseout="this.style.background='rgba(251,191,36,.07)'">
                <div style="font-size:.95rem">${['🎺','🔨','🌟'][i]}</div>${s}
              </button>`).join('')}
          </div>`)}

        ${sec('perigo', '☠ Zona de Perigo', false, [
          bt('Resetar Progresso (zera tudo)',
             'if(window.__resetPerfilArquiteto)window.__resetPerfilArquiteto();else SoloDialog.toast(\'Abra o Dashboard primeiro\',\'warn\')',
             'vermelho', true),
        ])}
      </div>

      <div style="font-size:.56rem;color:var(--text-dim);padding-top:.5rem;margin-top:.2rem;border-top:1px solid rgba(251,191,36,.15);font-family:var(--font-section)">
        Ctrl+Alt+A · duplo-clique no badge ★ Arquiteto ★
      </div>`;
    document.body.appendChild(el);
    this._tornarArrastavel(el);
    this._bindSecoes(el);
  },

  /* Seções recolhíveis — lembra o que ficou aberto */
  _bindSecoes(el) {
    let abertas = [];
    try { abertas = JSON.parse(localStorage.getItem('arq_secoes') || '["propostas"]'); }
    catch (_) { abertas = ['propostas']; }

    el.querySelectorAll('.arq-sec').forEach(sec => {
      const id = sec.dataset.sec;
      const corpo = sec.querySelector('.arq-sec-corpo');
      const seta = sec.querySelector('.arq-sec-seta');
      const abrir = (on) => {
        corpo.style.display = on ? 'flex' : 'none';
        seta.style.transform = on ? 'rotate(90deg)' : '';
      };
      abrir(abertas.includes(id));
      sec.querySelector('.arq-sec-cab').addEventListener('click', () => {
        const on = corpo.style.display === 'none';
        abrir(on);
        abertas = on ? [...new Set([...abertas, id])] : abertas.filter(x => x !== id);
        try { localStorage.setItem('arq_secoes', JSON.stringify(abertas)); } catch (_) {}
      });
    });
  },

  /* ── Arrastável (mouse e toque), com posição lembrada ──── */
  _tornarArrastavel(el) {
    const handle = el.querySelector('#arq-console-handle');
    if (!handle) return;

    // Restaura a última posição
    try {
      const pos = JSON.parse(localStorage.getItem('arq_console_pos') || 'null');
      if (pos) {
        el.style.left = Math.min(Math.max(pos.x, 0), window.innerWidth - 80) + 'px';
        el.style.top  = Math.min(Math.max(pos.y, 0), window.innerHeight - 80) + 'px';
        el.style.right = 'auto';
      }
    } catch (_) {}

    let ox = 0, oy = 0;
    const mover = e => {
      const x = Math.min(Math.max(e.clientX - ox, 4), window.innerWidth - el.offsetWidth - 4);
      const y = Math.min(Math.max(e.clientY - oy, 4), window.innerHeight - 60);
      el.style.left = x + 'px';
      el.style.top  = y + 'px';
    };
    const soltar = () => {
      document.removeEventListener('pointermove', mover);
      document.removeEventListener('pointerup', soltar);
      handle.style.cursor = 'grab';
      try {
        localStorage.setItem('arq_console_pos', JSON.stringify({
          x: parseInt(el.style.left) || 0, y: parseInt(el.style.top) || 0,
        }));
      } catch (_) {}
    };
    handle.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;   // não arrasta pelo ✕
      e.preventDefault();
      const r = el.getBoundingClientRect();
      el.style.left = r.left + 'px';
      el.style.top  = r.top + 'px';
      el.style.right = 'auto';
      ox = e.clientX - r.left;
      oy = e.clientY - r.top;
      handle.style.cursor = 'grabbing';
      document.addEventListener('pointermove', mover);
      document.addEventListener('pointerup', soltar);
    });
  },
};

const SoloFX = {
  _ativo: false,
  toggle() {
    this._ativo = !this._ativo;
    if (this._ativo) {
      this._cerimonia();
    } else {
      const b = document.getElementById('cq-pilha');
      if (b) b.innerHTML = '';
    }
  },

  demoCard() {
    let ex = document.getElementById('solo-demo-card');
    if (ex) { ex.remove(); return; }

    const card = document.createElement('div');
    card.id = 'solo-demo-card';
    card.style.cssText = `
      position:fixed; top:40%; left:50%; transform:translate(-50%, -50%);
      width:750px; background:linear-gradient(145deg, #090514, #030108);
      border:1px solid rgba(168,85,247,0.3); border-left:6px solid #a855f7; border-radius:12px;
      box-shadow:0 10px 30px rgba(0,0,0,0.9), 0 0 15px rgba(168,85,247,0.1) inset;
      padding:20px 24px; z-index:9999; display:flex; gap:20px;
      animation: conquista-enter 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;
      overflow:hidden; cursor:grab;
    `;

    const SVG = `
      <svg viewBox="0 0 100 100" style="width:100%; height:100%; overflow:visible" class="cq-svg">
        <defs>
          <filter id="soloCardGlow2" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <g style="transform-origin: 50px 50px; animation: cq-anel-girar 12s linear infinite reverse;">
          <circle cx="50" cy="50" r="35" fill="none" stroke="#581c87" stroke-width="2.5" stroke-dasharray="10 8"/>
        </g>
        <polygon points="50,20 65,50 50,80 35,50" fill="#a855f7" filter="url(#soloCardGlow2)"/>
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(216,180,254,0.7)" stroke-width="2" stroke-dasharray="25 248" class="cq-svg-brilho"/>
      </svg>
    `;

    card.innerHTML = `
      <div style="position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg, transparent, #a855f7, #d8b4fe, transparent); animation: cq-shimmer 3s linear infinite; background-size: 200% 100%;"></div>
      <div style="position:absolute; top:12px; right:16px; font-size:1.2rem; cursor:pointer; color:#4b5563; transition: color 0.2s" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#4b5563'" onclick="this.parentElement.remove()">✕</div>

      <!-- Ícone Cinético na Esquerda -->
      <div style="width:65px; height:65px; flex-shrink:0; background:rgba(88,28,135,0.15); border-radius:12px; display:flex; align-items:center; justify-content:center; box-shadow:0 0 15px rgba(88,28,135,0.4) inset; border:1px solid rgba(168,85,247,0.2);">
        <div style="width:50px; height:50px;">
          ${SVG}
        </div>
      </div>

      <!-- Conteúdo Direito (Linhas) -->
      <div style="flex:1; display:flex; flex-direction:column; justify-content:space-between;">
        
        <!-- Topo: Título + Tempo -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div style="font-family:var(--font-title); font-size:1.3rem; color:#fff; text-shadow:0 2px 4px rgba(168,85,247,0.5); letter-spacing:0.5px;">O Futuro dos Cards Solo</div>
          <div style="font-family:var(--font-section); font-size:0.85rem; color:#d1d5db; display:flex; align-items:center; gap:6px; margin-right:15px; text-shadow:0 0 5px rgba(0,0,0,0.8);">
            <span style="color:#d8b4fe">⏳ Prazo</span> 23h 00m 33s
          </div>
        </div>

        <!-- Meio: Tags + Recompensas -->
        <div style="display:flex; align-items:center; gap:12px; margin-top:8px;">
          <span style="background:rgba(216,180,254,0.15); color:#d8b4fe; border:1px solid #a855f7; padding:4px 10px; border-radius:20px; font-size:0.65rem; font-family:var(--font-section); font-weight:700; letter-spacing:1px; text-transform:uppercase; box-shadow:0 0 8px rgba(168,85,247,0.3) inset;">✦ S-RANK</span>
          <span style="background:rgba(15,23,42,0.8); color:#9ca3af; border:1px solid #475569; padding:4px 10px; border-radius:20px; font-size:0.65rem; font-family:var(--font-section); font-weight:700; letter-spacing:1px; text-transform:uppercase;">⏳ PENDENTE</span>
          <div style="width:1px; height:14px; background:#374151;"></div>
          <span style="font-size:0.85rem; font-weight:bold; color:var(--gold-bright); text-shadow:0 0 5px rgba(251,191,36,0.4);">⚡ 500 XP &nbsp;•&nbsp; 🪙 50</span>
        </div>

        <!-- Barra Magmática de Sincronização (Opcional p/ mostrar progresso em andamento) -->
        <div style="margin-top:14px;">
          <div style="height:4px; background:#1e1b4b; border-radius:2px; overflow:hidden; box-shadow:0 0 5px #000 inset;">
            <div style="width:30%; height:100%; background:linear-gradient(90deg, #581c87, #a855f7, #d8b4fe); box-shadow:0 0 10px #a855f7; animation: cq-shimmer 2s ease-in-out infinite alternate; background-size:200% 100%"></div>
          </div>
        </div>

        <!-- Botões (State Machine) -->
        <div id="demo-card-actions" style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
          
          <button id="demo-btn-iniciar" style="
            padding:8px 24px; border-radius:8px; cursor:pointer;
            background:linear-gradient(90deg, #1e1b4b, #2e1065);
            border:1px solid #7e22ce; color:#d8b4fe;
            font-family:var(--font-section); font-size:0.8rem; font-weight:700; letter-spacing:1px; text-transform:uppercase;
            box-shadow:0 0 10px rgba(168,85,247,0.2) inset, 0 4px 6px rgba(0,0,0,0.5);
            transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:8px;"
            onmouseover="this.style.background='linear-gradient(90deg, #2e1065, #581c87)'; this.style.boxShadow='0 0 20px rgba(168,85,247,0.5) inset, 0 4px 10px rgba(168,85,247,0.3)'"
            onmouseout="this.style.background='linear-gradient(90deg, #1e1b4b, #2e1065)'; this.style.boxShadow='0 0 10px rgba(168,85,247,0.2) inset, 0 4px 6px rgba(0,0,0,0.5)'"
            onclick="document.getElementById('demo-btn-iniciar').style.display='none'; document.getElementById('demo-btn-andamento').style.display='flex';">
            <span style="font-size:1rem; text-shadow:0 0 5px #d8b4fe">▶</span> INICIAR MISSÃO
          </button>
          
          <div id="demo-btn-andamento" style="display:none; gap:10px;">
            <button style="
              padding:8px 16px; border-radius:8px; cursor:pointer;
              background:linear-gradient(90deg, #1f2937, #111827);
              border:1px solid #4b5563; color:#d1d5db;
              font-family:var(--font-section); font-size:0.75rem; font-weight:700; letter-spacing:1px; text-transform:uppercase;
              box-shadow:0 0 8px rgba(0,0,0,0.5) inset; transition:all 0.2s;"
              onmouseover="this.style.background='#374151'; this.style.borderColor='#6b7280'"
              onmouseout="this.style.background='linear-gradient(90deg, #1f2937, #111827)'; this.style.borderColor='#4b5563'">
              ⏸ PAUSAR
            </button>
            <button style="
              padding:8px 16px; border-radius:8px; cursor:pointer;
              background:linear-gradient(90deg, #3f000f, #210008);
              border:1px solid #9f1239; color:#fca5a5;
              font-family:var(--font-section); font-size:0.75rem; font-weight:700; letter-spacing:1px; text-transform:uppercase;
              box-shadow:0 0 8px rgba(225,29,72,0.2) inset; transition:all 0.2s;"
              onmouseover="this.style.background='#70001a'; this.style.boxShadow='0 0 15px rgba(225,29,72,0.5) inset'"
              onmouseout="this.style.background='linear-gradient(90deg, #3f000f, #210008)'; this.style.boxShadow='0 0 8px rgba(225,29,72,0.2) inset'"
              onclick="document.getElementById('demo-btn-andamento').style.display='none'; document.getElementById('demo-btn-iniciar').style.display='flex';">
              ✖ CANCELAR HOJE
            </button>
            <button style="
              padding:8px 24px; border-radius:8px; cursor:pointer;
              background:linear-gradient(90deg, #3b0764, #581c87);
              border:1px solid #d8b4fe; color:#fff;
              font-family:var(--font-section); font-size:0.8rem; font-weight:700; letter-spacing:1px; text-transform:uppercase;
              box-shadow:0 0 20px rgba(168,85,247,0.5) inset, 0 0 15px rgba(168,85,247,0.4);
              transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:8px;"
              onmouseover="this.style.background='linear-gradient(90deg, #581c87, #7e22ce)'; this.style.boxShadow='0 0 25px rgba(216,180,254,0.8) inset, 0 0 25px rgba(168,85,247,0.8)'"
              onmouseout="this.style.background='linear-gradient(90deg, #3b0764, #581c87)'; this.style.boxShadow='0 0 20px rgba(168,85,247,0.5) inset, 0 0 15px rgba(168,85,247,0.4)'"
              onclick="document.getElementById('solo-demo-card').style.animation='conquista-materialize 0.5s reverse forwards'; setTimeout(() => document.getElementById('solo-demo-card').remove(), 500); if(typeof SFX !== 'undefined') SFX.play('carimbo');">
              <span style="font-size:1.1rem; color:#d8b4fe; text-shadow:0 0 10px #d8b4fe">✔</span> CONCLUIR
            </button>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(card);
    
    // Tornar o card arrastável
    let ox = 0, oy = 0;
    const handle = card;
    const mover = e => { card.style.left = (e.clientX - ox) + 'px'; card.style.top = (e.clientY - oy) + 'px'; };
    const soltar = () => { document.removeEventListener('pointermove', mover); document.removeEventListener('pointerup', soltar); };
    handle.addEventListener('pointerdown', e => {
      if(e.target.closest('div[onclick]') || e.target.closest('button')) return;
      ox = e.clientX - card.getBoundingClientRect().left - card.offsetWidth/2;
      oy = e.clientY - card.getBoundingClientRect().top - card.offsetHeight/2;
      document.addEventListener('pointermove', mover);
      document.addEventListener('pointerup', soltar);
    });
  },

  demoLauncher() {
    let ex = document.getElementById('solo-demo-launcher');
    if (ex) { ex.remove(); return; }

    const overlay = document.createElement('div');
    overlay.id = 'solo-demo-launcher';
    overlay.style.cssText = `
      position:fixed; top:0; left:0; width:100%; height:100%;
      background:rgba(0,0,0,0.85); z-index:9999;
      display:flex; align-items:center; justify-content:center;
      animation: conquista-enter 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards;
      backdrop-filter: blur(5px);
    `;

    const SVGIcon = `
      <svg viewBox="0 0 50 50" style="width:100%; height:100%; overflow:visible" class="cq-svg">
        <defs>
          <filter id="soloLchGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <g style="transform-origin: 25px 25px; animation: cq-anel-girar 8s linear infinite;">
          <polygon points="25,5 30,20 45,25 30,30 25,45 20,30 5,25 20,20" fill="none" stroke="#a855f7" stroke-width="1.5" filter="url(#soloLchGlow)"/>
        </g>
        <circle cx="25" cy="25" r="18" fill="none" stroke="rgba(216,180,254,0.6)" stroke-width="1" stroke-dasharray="10 40" style="transform-origin: 25px 25px; animation: cq-anel-girar 15s linear infinite reverse;"/>
      </svg>
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      width: 550px; background:linear-gradient(160deg, #0f0720, #04010a);
      border:1px solid rgba(168,85,247,0.4); border-radius:16px;
      box-shadow: 0 0 50px rgba(88,28,135,0.4), 0 0 20px rgba(168,85,247,0.1) inset;
      display:flex; flex-direction:column; overflow:hidden; position:relative;
    `;
    
    modal.innerHTML = `
      <style>
        .s-rank-btn {
          position: relative; overflow: hidden;
          transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .s-rank-btn::after {
          content: '';
          position: absolute; top: 0; left: 0; width: 100%; height: 100%;
          background: linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%);
          transform: translateX(-120%);
          transition: transform 0.6s ease-in-out;
          pointer-events: none;
        }
        .s-rank-btn:hover::after {
          transform: translateX(120%);
        }
        .s-rank-btn:hover {
          transform: scale(1.03);
          box-shadow: 0 0 30px rgba(216,180,254,0.6) inset, 0 8px 20px rgba(0,0,0,0.6) !important;
        }
      </style>
      <div style="position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg, transparent, #a855f7, #d8b4fe, transparent); animation: cq-shimmer 2.5s linear infinite; background-size: 200% 100%;"></div>
      
      <!-- Top Header -->
      <div style="padding: 24px; border-bottom: 1px solid rgba(168,85,247,0.2); display:flex; align-items:center; gap:16px; background:rgba(255,255,255,0.02);">
        <div style="width:48px; height:48px; background:linear-gradient(135deg, #2e1065, #000); border-radius:12px; border:1px solid #7e22ce; box-shadow:0 0 10px rgba(126,34,206,0.5) inset; padding:4px;">
          ${SVGIcon}
        </div>
        <div style="flex:1">
          <div style="font-family:var(--font-title); font-size:1.3rem; color:#fff; text-shadow:0 2px 4px rgba(168,85,247,0.5); letter-spacing:1px;">Nova Missão S-Rank</div>
          <div style="font-family:var(--font-section); font-size:0.65rem; color:#d8b4fe; letter-spacing:3px; font-weight:700; text-transform:uppercase; margin-top:4px; opacity:0.8;">Sistema de Missões Solo Routines</div>
        </div>
        <button style="background:none; border:none; color:#9ca3af; font-size:1.5rem; cursor:pointer; transition:0.2s" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#9ca3af'" onclick="document.getElementById('solo-demo-launcher').remove()">✕</button>
      </div>

      <!-- Scrollable Body -->
      <div style="padding: 24px; max-height:65vh; overflow-y:auto; display:flex; flex-direction:column; gap:24px;">
        
        <!-- Tabs -->
        <div style="display:flex; gap:12px;">
          <div style="flex:1; padding:12px; text-align:center; background:linear-gradient(90deg, rgba(88,28,135,0.3), rgba(15,7,32,0.8)); border:1px solid #a855f7; border-radius:8px; color:#d8b4fe; font-family:var(--font-title); font-size:0.85rem; letter-spacing:1px; cursor:pointer; box-shadow:0 0 15px rgba(168,85,247,0.2) inset;">ROTINA RECORRENTE</div>
          <div style="flex:1; padding:12px; text-align:center; background:rgba(255,255,255,0.03); border:1px solid #374151; border-radius:8px; color:#9ca3af; font-family:var(--font-title); font-size:0.85rem; letter-spacing:1px; cursor:pointer;">TAREFA AVULSA</div>
        </div>

        <!-- Título -->
        <div>
          <div style="font-family:var(--font-section); font-size:0.65rem; color:#d8b4fe; font-weight:700; letter-spacing:2px; text-transform:uppercase; margin-bottom:8px;">TÍTULO DA MISSÃO</div>
          <input type="text" placeholder="Designação da rotina..." style="width:100%; background:linear-gradient(90deg, rgba(0,0,0,0.6), rgba(15,7,32,0.4)); border:1px solid rgba(88,28,135,0.4); border-radius:8px; color:#fff; font-family:var(--font-title); font-size:1.1rem; letter-spacing:1px; padding:14px; outline:none; transition:all 0.3s; box-shadow:0 5px 15px rgba(0,0,0,0.5) inset;" onfocus="this.style.borderColor='#d8b4fe'; this.style.boxShadow='0 0 15px rgba(168,85,247,0.3) inset, 0 0 10px rgba(168,85,247,0.2)'" onblur="this.style.borderColor='rgba(88,28,135,0.4)'; this.style.boxShadow='0 5px 15px rgba(0,0,0,0.5) inset'">
        </div>

        <!-- Frequência -->
        <div>
          <div style="font-family:var(--font-section); font-size:0.65rem; color:#d8b4fe; font-weight:700; letter-spacing:2px; text-transform:uppercase; margin-bottom:12px;">FREQUÊNCIA</div>
          <div style="display:flex; gap:12px;">
            <div style="flex:1; padding:14px 8px; text-align:center; background:linear-gradient(180deg, #2e1065, #000); border:1px solid #a855f7; border-radius:8px; cursor:pointer; box-shadow:0 0 20px rgba(168,85,247,0.3) inset;">
              <div style="font-family:var(--font-title); font-weight:700; font-size:0.8rem; letter-spacing:1px; color:#fff; text-shadow:0 0 5px #d8b4fe;">DIÁRIA</div>
            </div>
            <div style="flex:1; padding:14px 8px; text-align:center; background:#111827; border:1px solid #374151; border-radius:8px; cursor:pointer; transition:0.2s;" onmouseover="this.style.borderColor='#6b7280'" onmouseout="this.style.borderColor='#374151'">
              <div style="font-family:var(--font-title); font-weight:700; font-size:0.8rem; letter-spacing:1px; color:#9ca3af;">SEMANAL</div>
            </div>
            <div style="flex:1; padding:14px 8px; text-align:center; background:#111827; border:1px solid #374151; border-radius:8px; cursor:pointer; transition:0.2s;" onmouseover="this.style.borderColor='#6b7280'" onmouseout="this.style.borderColor='#374151'">
              <div style="font-family:var(--font-title); font-weight:700; font-size:0.8rem; letter-spacing:1px; color:#9ca3af;">MENSAL</div>
            </div>
            <div style="flex:1; padding:14px 8px; text-align:center; background:#111827; border:1px solid #374151; border-radius:8px; cursor:pointer; transition:0.2s;" onmouseover="this.style.borderColor='#6b7280'" onmouseout="this.style.borderColor='#374151'">
              <div style="font-family:var(--font-title); font-weight:700; font-size:0.8rem; letter-spacing:1px; color:#9ca3af;">ANUAL</div>
            </div>
          </div>
        </div>

        <!-- Janela de Horário -->
        <div style="display:flex; align-items:center; gap:16px; padding:14px 16px; background:linear-gradient(90deg, rgba(0,0,0,0.4), transparent); border-left:3px solid rgba(168,85,247,0.3); cursor:pointer; transition:all 0.2s;" onmouseover="this.style.borderLeftColor='#d8b4fe'; this.style.background='linear-gradient(90deg, rgba(88,28,135,0.2), transparent)'" onmouseout="this.style.borderLeftColor='rgba(168,85,247,0.3)'; this.style.background='linear-gradient(90deg, rgba(0,0,0,0.4), transparent)'">
          <div style="width:20px; height:20px; border:1px solid #7e22ce; border-radius:4px; background:rgba(0,0,0,0.8); box-shadow:0 0 10px rgba(168,85,247,0.2) inset;"></div>
          <div>
            <div style="font-family:var(--font-title); font-size:0.85rem; color:#e5e7eb; letter-spacing:1px;">DEFINIR JANELA DE HORÁRIO</div>
            <div style="font-family:var(--font-section); font-size:0.65rem; color:#6b7280; letter-spacing:1px; margin-top:2px;">Sincronização temporal estrita</div>
          </div>
        </div>

        <!-- Prioridade -->
        <div>
          <div style="font-family:var(--font-section); font-size:0.65rem; color:#d8b4fe; font-weight:700; letter-spacing:2px; text-transform:uppercase; margin-bottom:12px;">NÍVEL DE PRIORIDADE</div>
          <div style="display:flex; gap:12px;">
            <div style="flex:1; padding:16px 8px; display:flex; flex-direction:column; align-items:center; background:#0b0f19; border:1px solid #1f2937; border-radius:8px; cursor:pointer;">
              <div style="width:12px; height:12px; border-radius:50%; background:#991b1b; box-shadow:0 0 8px #991b1b;"></div>
              <div style="font-family:var(--font-title); font-size:0.75rem; letter-spacing:1px; color:#6b7280; margin-top:10px;">CRÍTICA</div>
            </div>
            <div style="flex:1; padding:16px 8px; display:flex; flex-direction:column; align-items:center; background:#0b0f19; border:1px solid #1f2937; border-radius:8px; cursor:pointer;">
              <div style="width:12px; height:12px; border-radius:50%; background:#9a3412; box-shadow:0 0 8px #9a3412;"></div>
              <div style="font-family:var(--font-title); font-size:0.75rem; letter-spacing:1px; color:#6b7280; margin-top:10px;">ALTA</div>
            </div>
            <div style="flex:1; padding:16px 8px; display:flex; flex-direction:column; align-items:center; background:linear-gradient(180deg, rgba(63,46,20,0.5), #000); border:1px solid rgba(251,191,36,0.5); border-radius:8px; cursor:pointer; box-shadow:0 0 20px rgba(251,191,36,0.15) inset;">
              <div style="width:12px; height:12px; border-radius:50%; background:#f59e0b; box-shadow:0 0 15px #f59e0b, 0 0 25px rgba(251,191,36,0.6);"></div>
              <div style="font-family:var(--font-title); font-size:0.75rem; letter-spacing:1px; color:#fde68a; margin-top:10px; text-shadow:0 0 5px rgba(251,191,36,0.5);">MÉDIA</div>
            </div>
            <div style="flex:1; padding:16px 8px; display:flex; flex-direction:column; align-items:center; background:#0b0f19; border:1px solid #1f2937; border-radius:8px; cursor:pointer;">
              <div style="width:12px; height:12px; border-radius:50%; background:#065f46; box-shadow:0 0 8px #065f46;"></div>
              <div style="font-family:var(--font-title); font-size:0.75rem; letter-spacing:1px; color:#6b7280; margin-top:10px;">BAIXA</div>
            </div>
          </div>
        </div>

        <!-- Dificuldade -->
        <div>
          <div style="font-family:var(--font-section); font-size:0.65rem; color:#d8b4fe; font-weight:700; letter-spacing:2px; text-transform:uppercase; margin-bottom:12px;">CLASSE DE DIFICULDADE</div>
          <div style="display:flex; gap:12px;">
            <div style="flex:1; padding:16px 8px; text-align:center; background:#0b0f19; border:1px solid #1f2937; border-radius:8px; cursor:pointer;">
              <div style="font-family:var(--font-title); font-weight:700; font-size:0.9rem; letter-spacing:1px; color:#6b7280;">FÁCIL</div>
              <div style="font-family:var(--font-section); font-size:0.6rem; color:#4b5563; margin-top:4px; letter-spacing:1px;">x0.5 MULT</div>
            </div>
            <div style="flex:1; padding:16px 8px; text-align:center; background:linear-gradient(180deg, rgba(46,16,101,0.6), #000); border:1px solid #9333ea; border-radius:8px; cursor:pointer; box-shadow:0 0 20px rgba(147,51,234,0.3) inset, 0 5px 15px rgba(0,0,0,0.8);">
              <div style="font-family:var(--font-title); font-weight:700; font-size:0.9rem; letter-spacing:1px; color:#e9d5ff; text-shadow:0 0 8px rgba(168,85,247,0.8);">NORMAL</div>
              <div style="font-family:var(--font-section); font-size:0.6rem; color:#c084fc; margin-top:4px; letter-spacing:1px;">x1.0 MULT</div>
            </div>
            <div style="flex:1; padding:16px 8px; text-align:center; background:#0b0f19; border:1px solid #1f2937; border-radius:8px; cursor:pointer;">
              <div style="font-family:var(--font-title); font-weight:700; font-size:0.9rem; letter-spacing:1px; color:#6b7280;">DIFÍCIL</div>
              <div style="font-family:var(--font-section); font-size:0.6rem; color:#4b5563; margin-top:4px; letter-spacing:1px;">x1.5 MULT</div>
            </div>
            <div style="flex:1; padding:16px 8px; text-align:center; background:#0b0f19; border:1px solid #1f2937; border-radius:8px; cursor:pointer;">
              <div style="font-family:var(--font-title); font-weight:700; font-size:0.9rem; letter-spacing:1px; color:#6b7280;">LENDÁRIO</div>
              <div style="font-family:var(--font-section); font-size:0.6rem; color:#4b5563; margin-top:4px; letter-spacing:1px;">x2.5 MULT</div>
            </div>
          </div>
        </div>

        <!-- Categoria -->
        <div>
          <div style="font-family:var(--font-section); font-size:0.65rem; color:#d8b4fe; font-weight:700; letter-spacing:2px; text-transform:uppercase; margin-bottom:12px;">CLASSIFICAÇÃO TÁTICA</div>
          <div style="display:flex; gap:10px;">
            <div style="flex:1; padding:12px 6px; text-align:center; background:#0b0f19; border:1px solid #1f2937; border-radius:8px; cursor:pointer;">
              <div style="font-family:var(--font-title); font-size:0.75rem; letter-spacing:1px; color:#6b7280;">SAÚDE</div>
            </div>
            <div style="flex:1; padding:12px 6px; text-align:center; background:#0b0f19; border:1px solid #1f2937; border-radius:8px; cursor:pointer;">
              <div style="font-family:var(--font-title); font-size:0.75rem; letter-spacing:1px; color:#6b7280;">TRABALHO</div>
            </div>
            <div style="flex:1; padding:12px 6px; text-align:center; background:#0b0f19; border:1px solid #1f2937; border-radius:8px; cursor:pointer;">
              <div style="font-family:var(--font-title); font-size:0.75rem; letter-spacing:1px; color:#6b7280;">ESTUDO</div>
            </div>
            <div style="flex:1; padding:12px 6px; text-align:center; background:linear-gradient(180deg, rgba(63,46,20,0.4), #000); border:1px solid rgba(251,191,36,0.6); border-radius:8px; cursor:pointer; box-shadow:0 0 15px rgba(251,191,36,0.1) inset;">
              <div style="font-family:var(--font-title); font-size:0.75rem; letter-spacing:1px; color:#fde68a; text-shadow:0 0 5px rgba(251,191,36,0.5);">PESSOAL</div>
            </div>
            <div style="flex:1; padding:12px 6px; text-align:center; background:#0b0f19; border:1px solid #1f2937; border-radius:8px; cursor:pointer;">
              <div style="font-family:var(--font-title); font-size:0.75rem; letter-spacing:1px; color:#6b7280;">CASA</div>
            </div>
            <div style="flex:1; padding:12px 6px; text-align:center; background:#0b0f19; border:1px solid #1f2937; border-radius:8px; cursor:pointer;">
              <div style="font-family:var(--font-title); font-size:0.75rem; letter-spacing:1px; color:#6b7280;">COMBATE</div>
            </div>
          </div>
        </div>

        <!-- Recompensas e Punições Grid S-RANK PREMIUM -->
        <div style="display:flex; gap:20px; padding-top:10px; border-top:1px dashed rgba(168,85,247,0.2);">
          
          <div style="flex:1;">
            <div style="font-family:var(--font-section); font-size:0.65rem; color:#10b981; font-weight:700; letter-spacing:2px; margin-bottom:12px;">RECOMPENSA DE SUCESSO</div>
            <div style="display:flex; gap:12px;">
              <div style="flex:1; background:rgba(0,0,0,0.6); border:1px solid rgba(16,185,129,0.3); border-radius:8px; padding:10px; display:flex; flex-direction:column; align-items:center; box-shadow:0 5px 15px rgba(0,0,0,0.8) inset;">
                <div style="font-family:var(--font-section); font-size:0.6rem; color:#6ee7b7; letter-spacing:2px; margin-bottom:4px;">EXP YIELD</div>
                <input type="text" value="50" style="width:100%; background:transparent; border:none; color:#a7f3d0; font-family:var(--font-title); font-size:1.4rem; text-align:center; outline:none; text-shadow:0 0 10px rgba(16,185,129,0.5);">
              </div>
              <div style="flex:1; background:rgba(0,0,0,0.6); border:1px solid rgba(245,158,11,0.3); border-radius:8px; padding:10px; display:flex; flex-direction:column; align-items:center; box-shadow:0 5px 15px rgba(0,0,0,0.8) inset;">
                <div style="font-family:var(--font-section); font-size:0.6rem; color:#fcd34d; letter-spacing:2px; margin-bottom:4px;">MANA COINS</div>
                <input type="text" value="5" style="width:100%; background:transparent; border:none; color:#fef3c7; font-family:var(--font-title); font-size:1.4rem; text-align:center; outline:none; text-shadow:0 0 10px rgba(245,158,11,0.5);">
              </div>
            </div>
          </div>
          
          <div style="width:1px; background:linear-gradient(180deg, transparent, rgba(168,85,247,0.3), transparent);"></div>
          
          <div style="flex:1;">
            <div style="font-family:var(--font-section); font-size:0.65rem; color:#ef4444; font-weight:700; letter-spacing:2px; margin-bottom:12px;">PENALIDADE DE FRACASSO</div>
            <div style="display:flex; gap:12px; align-items:stretch;">
              <div style="flex:1; background:rgba(0,0,0,0.6); border:1px solid rgba(225,29,72,0.3); border-radius:8px; padding:10px; display:flex; flex-direction:column; align-items:center; box-shadow:0 5px 15px rgba(0,0,0,0.8) inset;">
                <div style="font-family:var(--font-section); font-size:0.6rem; color:#fca5a5; letter-spacing:2px; margin-bottom:4px;">EXP PERDIDO</div>
                <input type="text" value="8" style="width:100%; background:transparent; border:none; color:#fee2e2; font-family:var(--font-title); font-size:1.4rem; text-align:center; outline:none; text-shadow:0 0 10px rgba(225,29,72,0.5);">
              </div>
              <div style="flex:0.5; display:flex;">
                <button style="width:100%; background:linear-gradient(180deg, rgba(88,28,135,0.2), rgba(0,0,0,0.8)); border:1px solid rgba(168,85,247,0.4); color:#d8b4fe; font-family:var(--font-title); font-size:0.75rem; letter-spacing:1px; border-radius:8px; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(88,28,135,0.4)'; this.style.color='#fff'" onmouseout="this.style.background='linear-gradient(180deg, rgba(88,28,135,0.2), rgba(0,0,0,0.8))'; this.style.color='#d8b4fe'">AUTO</button>
              </div>
            </div>
          </div>

        </div>

        <!-- Descrição -->
        <div>
          <div style="font-family:var(--font-section); font-size:0.65rem; color:#d8b4fe; font-weight:700; letter-spacing:2px; text-transform:uppercase; margin-bottom:8px;">DESCRIÇÃO TÁTICA (OPCIONAL)</div>
          <textarea placeholder="Detalhes operacionais adicionais..." style="width:100%; height:80px; background:linear-gradient(180deg, rgba(0,0,0,0.6), rgba(15,7,32,0.2)); border:1px solid rgba(88,28,135,0.4); border-radius:8px; color:#e5e7eb; font-family:var(--font-base); font-size:0.9rem; padding:14px; outline:none; resize:none; transition:all 0.3s; box-shadow:0 5px 15px rgba(0,0,0,0.5) inset;" onfocus="this.style.borderColor='#d8b4fe'; this.style.boxShadow='0 0 15px rgba(168,85,247,0.2) inset, 0 0 10px rgba(168,85,247,0.1)'" onblur="this.style.borderColor='rgba(88,28,135,0.4)'; this.style.boxShadow='0 5px 15px rgba(0,0,0,0.5) inset'"></textarea>
        </div>

      </div>

      <!-- Footer Actions -->
      <div style="padding: 20px 24px; border-top: 1px solid rgba(168,85,247,0.2); background:rgba(0,0,0,0.7); display:flex; justify-content:flex-end; gap:16px;">
        <button style="background:none; border:none; color:#6b7280; font-family:var(--font-title); font-size:0.9rem; letter-spacing:2px; font-weight:700; cursor:pointer; padding:10px 20px; transition:0.2s" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#6b7280'" onclick="document.getElementById('solo-demo-launcher').remove()">CANCELAR</button>
        <button class="s-rank-btn" style="
          background:linear-gradient(90deg, #581c87, #7e22ce);
          border:1px solid #d8b4fe; color:#fff; border-radius:8px;
          font-family:var(--font-title); font-size:1.1rem; font-weight:700; letter-spacing:2px;
          padding:14px 40px; cursor:pointer; display:flex; align-items:center; justify-content:center;
          box-shadow:0 0 20px rgba(168,85,247,0.5) inset, 0 5px 15px rgba(0,0,0,0.5);"
          onclick="document.getElementById('solo-demo-launcher').querySelector('div').style.animation='conquista-materialize 0.4s reverse forwards'; setTimeout(() => document.getElementById('solo-demo-launcher').remove(), 400); if(typeof SFX !== 'undefined') SFX.play('conquista');">
          <svg viewBox="0 0 24 24" style="width:24px; height:24px; margin-right:12px; filter:drop-shadow(0 0 8px rgba(216,180,254,0.9));" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.5 17.5L3 6V3h3l11.5 11.5"></path>
            <path d="M13 19l6-6"></path>
            <path d="M16 16l4 4"></path>
            <path d="M19 21l2-2"></path>
            <path d="M9.5 17.5L21 6V3h-3L6.5 14.5"></path>
            <path d="M5 11l6-6"></path>
            <path d="M8 8L4 4"></path>
            <path d="M3 5l2-2"></path>
          </svg>
          FORJAR MISSÃO
        </button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  },

  _svgMedalhaSolo(tamanho = 260) {
    const asas = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const a1 = a - Math.PI / 8, a2 = a + Math.PI / 8;
      asas.push(`M 130 130 L ${130 + 80 * Math.cos(a1)} ${130 + 80 * Math.sin(a1)} L ${130 + 130 * Math.cos(a)} ${130 + 130 * Math.sin(a)} L ${130 + 80 * Math.cos(a2)} ${130 + 80 * Math.sin(a2)} Z`);
    }

    const espinhos = [];
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI / 6) * i - (Math.PI/12);
      espinhos.push(`M 130 130 L ${130 + 75 * Math.cos(a - 0.1)} ${130 + 75 * Math.sin(a - 0.1)} L ${130 + 105 * Math.cos(a)} ${130 + 105 * Math.sin(a)} L ${130 + 75 * Math.cos(a + 0.1)} ${130 + 75 * Math.sin(a + 0.1)} Z`);
    }

    const anelCentral = [];
    for (let i = 0; i < 24; i++) {
      const a = (Math.PI / 12) * i;
      const r = i % 2 === 0 ? 60 : 54;
      anelCentral.push(`${i === 0 ? 'M' : 'L'} ${130 + r * Math.cos(a)} ${130 + r * Math.sin(a)}`);
    }
    anelCentral.push('Z');

    return `
    <svg viewBox="0 0 260 260" width="${tamanho}" height="${tamanho}" style="overflow:visible" class="cq-svg">
      <defs>
        <radialGradient id="soloMetal" cx="35%" cy="30%">
          <stop offset="0%"  stop-color="#3b0764"/>
          <stop offset="35%" stop-color="#1e1b4b"/>
          <stop offset="75%" stop-color="#020617"/>
          <stop offset="100%" stop-color="#000000"/>
        </radialGradient>
        <radialGradient id="soloUV" cx="40%" cy="35%">
          <stop offset="0%"  stop-color="#d8b4fe"/>
          <stop offset="25%" stop-color="#a855f7"/>
          <stop offset="60%" stop-color="#581c87"/>
          <stop offset="100%" stop-color="#2e1065"/>
        </radialGradient>
        <linearGradient id="soloEdge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#c084fc"/>
          <stop offset="50%" stop-color="#7e22ce"/>
          <stop offset="100%" stop-color="#3b0764"/>
        </linearGradient>
        <filter id="soloGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="soloShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000" flood-opacity="0.9"/>
          <feDropShadow dx="0" dy="0" stdDeviation="15" flood-color="#a855f7" flood-opacity="0.4"/>
        </filter>
      </defs>
      
      <g filter="url(#soloShadow)">
        <g style="transform-origin: 130px 130px; animation: cq-anel-girar 28s linear infinite reverse;">
          <path d="${espinhos.join(' ')}" fill="url(#soloMetal)" stroke="#7e22ce" stroke-width="1.5"/>
        </g>
        <g class="cq-svg-star">
          <path d="${asas.join(' ')}" fill="url(#soloMetal)" stroke="url(#soloEdge)" stroke-width="2.5"/>
        </g>
        <path d="${anelCentral.join(' ')}" fill="#020617" stroke="#a855f7" stroke-width="2" filter="url(#soloGlow)"/>
        
        <!-- Deep Amethyst Core (Octagon) -->
        <polygon points="130,75 168,90 185,130 168,170 130,185 92,170 75,130 92,90" fill="url(#soloUV)" stroke="#d8b4fe" stroke-width="2" filter="url(#soloGlow)"/>
        
        <!-- Glass Facets for the Amethyst (Hades Underworld Crystal) -->
        <polygon points="130,75 168,90 130,130 92,90" fill="rgba(255,255,255,0.2)"/>
        <polygon points="92,90 130,130 75,130" fill="rgba(255,255,255,0.08)"/>
        
        <circle cx="130" cy="130" r="100" fill="none" stroke="rgba(216,180,254,.8)" stroke-width="3" stroke-dasharray="35 593" class="cq-svg-brilho"/>
        
        <!-- Gothic Crescent Moon + Diamond Core -->
        <g transform="translate(130, 130)">
          <path d="M 0 -24 C -18 -24, -28 -12, -28 4 C -28 20, -18 32, 0 32 C -8 22, -10 10, 0 -4 C 5 -10, 12 -15, 22 -18 C 16 -22, 8 -24, 0 -24 Z" fill="#fff" filter="url(#soloGlow)"/>
          <polygon points="12,4 20,-4 28,4 36,12 28,20 20,28 12,20 4,12" fill="#fff" opacity="0.9"/>
        </g>
      </g>
    </svg>`;
  },

  async _cerimonia() {
    if (typeof SFX !== 'undefined') SFX.play('conquista');
    
    const ov = document.createElement('div');
    ov.className = 'cq-overlay';
    ov.style.background = 'radial-gradient(circle at center, rgba(15,0,30,0.95) 0%, rgba(2,0,10,0.98) 100%)';
    
    const shimmerStyle = `
      background: linear-gradient(100deg, #f3e8ff 20%, #a855f7 40%, #f3e8ff 60%, #a855f7 80%);
      background-size: 220% auto; -webkit-background-clip: text; background-clip: text; color: transparent;
      animation: cq-shimmer 2.4s linear infinite;
    `;

    const raiosSolo = `
      position:absolute;top:130px;left:50%;
      width:900px;height:900px;margin:-450px 0 0 -450px;
      border-radius:50%;
      background:conic-gradient(from 0deg, transparent 0%, rgba(168,85,247,0.15) 5%, transparent 10%, rgba(147,51,234,0.1) 15%, transparent 20%, rgba(168,85,247,0.15) 25%, transparent 30%, rgba(147,51,234,0.1) 35%, transparent 40%, rgba(168,85,247,0.15) 45%, transparent 50%, rgba(147,51,234,0.1) 55%, transparent 60%, rgba(168,85,247,0.15) 65%, transparent 70%, rgba(147,51,234,0.1) 75%, transparent 80%, rgba(168,85,247,0.15) 85%, transparent 90%, rgba(147,51,234,0.1) 95%, transparent 100%);
      mask-image: radial-gradient(circle at center, black 0%, transparent 60%);
      -webkit-mask-image: radial-gradient(circle at center, black 0%, transparent 60%);
      animation: spin 25s linear infinite reverse; pointer-events:none; z-index:-1;
    `;

    ov.innerHTML = `
      <div class="cq-flash"></div>
      <div class="cq-palco">
        <div style="${raiosSolo}"></div>
        <div class="cq-medalha" style="width:260px;height:260px;margin-bottom:1rem;">
          ${this._svgMedalhaSolo(260)}
        </div>
        <div class="cq-textos">
          <div style="font-family:var(--font-section);font-size:0.85rem;font-weight:700;
                      letter-spacing:4px;color:#d8b4fe;text-transform:uppercase;margin-bottom:0.6rem;
                      text-shadow: 0 0 10px rgba(168,85,247,0.5);">
            ✦ IMPÉRIO DA ESCURIDÃO ✦
          </div>
          <div style="font-family:var(--font-title);font-size:2.8rem;text-shadow:0 8px 25px rgba(0,0,0,0.8);
                      letter-spacing:2px; line-height:1.1; ${shimmerStyle}">
            SOLO
          </div>
          <div style="font-family:var(--font-section);font-size:1.1rem;font-weight:700;
                      letter-spacing:6px;color:#d1d5db;margin-top:0.6rem; text-shadow:0 2px 4px #000;">
            SENHOR DO SUBMUNDO
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(ov);

    setTimeout(() => {
      const cx = window.innerWidth/2, cy = window.innerHeight/2 - 40;
      if (typeof Particles !== 'undefined') {
        Particles.burst(cx, cy, 60, 'rgba(168,85,247,');
        setTimeout(() => Particles.burst(cx, cy, 40, 'rgba(88,28,135,'), 150);
        setTimeout(() => Particles.burst(cx, cy, 30, 'rgba(15,23,42,'), 300);
      }
    }, 50);

    setTimeout(() => {
      if (typeof SFX !== 'undefined') SFX.play('carimbo');
      ov.classList.add('cq-saindo');
      
      this._selo();
      this._carimbarQuadro();

      setTimeout(() => {
        ov.remove();
      }, 500);
    }, 3800);
  },

  _selo() {
    let pilha = document.getElementById('cq-pilha');
    if (!pilha) {
      pilha = document.createElement('div');
      pilha.id = 'cq-pilha';
      document.body.appendChild(pilha);
    }
    const el = document.createElement('div');
    el.className = 'cq-selo';
    el.style.borderLeft = '4px solid #a855f7';
    el.style.background = 'linear-gradient(90deg, rgba(30,5,40,0.95), rgba(5,0,10,0.98))';
    el.innerHTML = `
      <div class="cq-selo-ico" style="position:relative;width:40px;height:40px;margin-right:14px;filter:drop-shadow(0 2px 4px rgba(168,85,247,0.5))">
        ${this._svgMedalhaSolo(40)}
      </div>
      <div>
        <div class="cq-selo-lbl" style="color:#d8b4fe;font-weight:700;letter-spacing:1px;font-size:0.65rem">SENHOR DO SUBMUNDO</div>
        <div class="cq-selo-nome" style="color:#fff;font-size:1.1rem">SOLO</div>
      </div>`;
    pilha.appendChild(el);
    setTimeout(() => { el.classList.add('cq-selo-out'); setTimeout(() => el.remove(), 500); }, 6000);
  },

  _carimbarQuadro() {
    const quadro = document.getElementById('lista-conquistas-recentes');
    if (!quadro) return;
    quadro.querySelector('.empty-state')?.remove();

    const card = document.createElement('div');
    card.className = 'conquista-mini cq-carimbo c-entering c-materializing';
    card.style.borderColor = 'rgba(168,85,247,0.4)';
    card.style.background = 'linear-gradient(90deg, rgba(30,5,40,0.9), rgba(15,0,25,0.95))';
    card.style.boxShadow = '0 0 15px rgba(168,85,247,0.2) inset, 0 0 8px rgba(168,85,247,0.2)';
    
    card.innerHTML = `
      <div class="cq-nevoa" style="background: radial-gradient(circle at left, rgba(168,85,247,0.3) 0%, transparent 60%);"></div>
      
      <span class="cq-medalhinha" style="width:52px;height:52px;flex-shrink:0;">
        ${this._svgMedalhaSolo(52)}
      </span>
      
      <div class="conquista-mini-info">
        <div class="conquista-mini-nome" style="color:#d8b4fe; text-shadow:0 0 5px rgba(168,85,247,0.4)">SOLO, O Império</div>
        <div class="conquista-mini-desc" style="color:#d1d5db">O Submundo despertou.</div>
      </div>`;
    quadro.prepend(card);
    
    setTimeout(() => { if (typeof SFX !== 'undefined') SFX.play('carimbo'); }, 380);
  }
};

const ForjaFX = {
  _svgMedalhaForja(tamanho = 260) {
    const asas = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      const a1 = a - Math.PI / 12, a2 = a + Math.PI / 12;
      asas.push(`M 130 130 L ${130 + 75 * Math.cos(a1)} ${130 + 75 * Math.sin(a1)} L ${130 + 130 * Math.cos(a)} ${130 + 130 * Math.sin(a)} L ${130 + 75 * Math.cos(a2)} ${130 + 75 * Math.sin(a2)} Z`);
    }

    const engrenagem = [];
    for (let i = 0; i < 24; i++) {
      const a = (Math.PI / 12) * i;
      const r = i % 2 === 0 ? 65 : 55;
      engrenagem.push(`${i === 0 ? 'M' : 'L'} ${130 + r * Math.cos(a)} ${130 + r * Math.sin(a)}`);
    }
    engrenagem.push('Z');

    return `
    <svg viewBox="0 0 260 260" width="${tamanho}" height="${tamanho}" style="overflow:visible" class="cq-svg">
      <defs>
        <radialGradient id="forjaMetal" cx="35%" cy="30%">
          <stop offset="0%"  stop-color="#064e3b"/>
          <stop offset="35%" stop-color="#022c22"/>
          <stop offset="75%" stop-color="#042f2e"/>
          <stop offset="100%" stop-color="#000000"/>
        </radialGradient>
        <radialGradient id="forjaUV" cx="40%" cy="35%">
          <stop offset="0%"  stop-color="#6ee7b7"/>
          <stop offset="25%" stop-color="#10b981"/>
          <stop offset="60%" stop-color="#047857"/>
          <stop offset="100%" stop-color="#064e3b"/>
        </radialGradient>
        <linearGradient id="forjaEdge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#67e8f9"/>
          <stop offset="50%" stop-color="#06b6d4"/>
          <stop offset="100%" stop-color="#164e63"/>
        </linearGradient>
        <filter id="forjaGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="forjaShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000" flood-opacity="0.9"/>
          <feDropShadow dx="0" dy="0" stdDeviation="15" flood-color="#10b981" flood-opacity="0.4"/>
        </filter>
      </defs>
      
      <g filter="url(#forjaShadow)">
        <g style="transform-origin: 130px 130px; animation: cq-anel-girar 20s linear infinite;">
          <path d="${engrenagem.join(' ')}" fill="url(#forjaMetal)" stroke="#06b6d4" stroke-width="2"/>
        </g>
        <g class="cq-svg-star" style="animation-direction: reverse;">
          <path d="${asas.join(' ')}" fill="url(#forjaMetal)" stroke="url(#forjaEdge)" stroke-width="2.5"/>
        </g>
        
        <!-- Glowing Core -->
        <polygon points="130,80 173,105 173,155 130,180 87,155 87,105" fill="url(#forjaUV)" stroke="#6ee7b7" stroke-width="2.5" filter="url(#forjaGlow)"/>
        
        <!-- Glass Facets -->
        <polygon points="130,80 173,105 130,130" fill="rgba(255,255,255,0.3)"/>
        <polygon points="87,105 130,130 87,155" fill="rgba(255,255,255,0.1)"/>
        <polygon points="130,130 173,155 130,180" fill="rgba(0,0,0,0.15)"/>
        
        <circle cx="130" cy="130" r="105" fill="none" stroke="rgba(110,231,183,0.8)" stroke-width="2" stroke-dasharray="20 40" class="cq-svg-brilho" style="animation: cq-anel-girar 10s linear infinite reverse;"/>
        
        <!-- Inner Diamond -->
        <polygon points="130,105 155,130 130,155 105,130" fill="#fff" filter="url(#forjaGlow)"/>
      </g>
    </svg>`;
  },

  async _cerimonia() {
    if (typeof SFX !== 'undefined') SFX.play('conquista');
    
    const ov = document.createElement('div');
    ov.className = 'cq-overlay';
    ov.style.background = 'radial-gradient(circle at center, rgba(2,30,20,0.95) 0%, rgba(0,10,10,0.98) 100%)';
    
    const shimmerStyle = `
      background: linear-gradient(100deg, #d1fae5 20%, #10b981 40%, #d1fae5 60%, #10b981 80%);
      background-size: 220% auto; -webkit-background-clip: text; background-clip: text; color: transparent;
      animation: cq-shimmer 2.4s linear infinite;
    `;

    const raiosForja = `
      position:absolute;top:130px;left:50%;
      width:900px;height:900px;margin:-450px 0 0 -450px;
      border-radius:50%;
      background:conic-gradient(from 0deg, transparent 0%, rgba(16,185,129,0.15) 5%, transparent 10%, rgba(6,182,212,0.1) 15%, transparent 20%, rgba(16,185,129,0.15) 25%, transparent 30%, rgba(6,182,212,0.1) 35%, transparent 40%, rgba(16,185,129,0.15) 45%, transparent 50%, rgba(6,182,212,0.1) 55%, transparent 60%, rgba(16,185,129,0.15) 65%, transparent 70%, rgba(6,182,212,0.1) 75%, transparent 80%, rgba(16,185,129,0.15) 85%, transparent 90%, rgba(6,182,212,0.1) 95%, transparent 100%);
      mask-image: radial-gradient(circle at center, black 0%, transparent 60%);
      -webkit-mask-image: radial-gradient(circle at center, black 0%, transparent 60%);
      animation: spin 25s linear infinite; pointer-events:none; z-index:-1;
    `;

    ov.innerHTML = `
      <div class="cq-flash" style="background:#a7f3d0"></div>
      <div class="cq-palco">
        <div style="${raiosForja}"></div>
        <div class="cq-medalha" style="width:260px;height:260px;margin-bottom:1rem;">
          ${this._svgMedalhaForja(260)}
        </div>
        <div class="cq-textos">
          <div style="font-family:var(--font-section);font-size:0.85rem;font-weight:700;
                      letter-spacing:4px;color:#6ee7b7;text-transform:uppercase;margin-bottom:0.6rem;
                      text-shadow: 0 0 10px rgba(16,185,129,0.5);">
            ✦ FORJA SUPREMA ✦
          </div>
          <div style="font-family:var(--font-title);font-size:2.8rem;text-shadow:0 8px 25px rgba(0,0,0,0.8);
                      letter-spacing:2px; line-height:1.1; ${shimmerStyle}">
            DOMÍNIO DA FORJA
          </div>
          <div style="font-family:var(--font-section);font-size:1.1rem;font-weight:700;
                      letter-spacing:6px;color:#d1d5db;margin-top:0.6rem; text-shadow:0 2px 4px #000;">
            A ARTE DA CRIAÇÃO
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(ov);

    setTimeout(() => {
      const cx = window.innerWidth/2, cy = window.innerHeight/2 - 40;
      if (typeof Particles !== 'undefined') {
        Particles.burst(cx, cy, 60, 'rgba(16,185,129,');
        setTimeout(() => Particles.burst(cx, cy, 40, 'rgba(6,182,212,'), 150);
        setTimeout(() => Particles.burst(cx, cy, 30, 'rgba(2,44,34,'), 300);
      }
    }, 50);

    setTimeout(() => {
      if (typeof SFX !== 'undefined') SFX.play('carimbo');
      ov.classList.add('cq-saindo');
      
      this._selo();
      this._carimbarQuadro();

      setTimeout(() => {
        ov.remove();
      }, 500);
    }, 3800);
  },

  _selo() {
    let pilha = document.getElementById('cq-pilha');
    if (!pilha) {
      pilha = document.createElement('div');
      pilha.id = 'cq-pilha';
      document.body.appendChild(pilha);
    }
    const el = document.createElement('div');
    el.className = 'cq-selo';
    el.style.borderLeft = '4px solid #10b981';
    el.style.background = 'linear-gradient(90deg, rgba(5,40,30,0.95), rgba(0,10,10,0.98))';
    el.innerHTML = `
      <div class="cq-selo-ico" style="position:relative;width:40px;height:40px;margin-right:14px;filter:drop-shadow(0 2px 4px rgba(16,185,129,0.5))">
        ${this._svgMedalhaForja(40)}
      </div>
      <div>
        <div class="cq-selo-lbl" style="color:#6ee7b7;font-weight:700;letter-spacing:1px;font-size:0.65rem">RECOMPENSA MÍTICA</div>
        <div class="cq-selo-nome" style="color:#fff;font-size:1.1rem">DOMÍNIO DA FORJA</div>
      </div>`;
    pilha.appendChild(el);
    setTimeout(() => { el.classList.add('cq-selo-out'); setTimeout(() => el.remove(), 500); }, 6000);
  },

  _carimbarQuadro() {
    const quadro = document.getElementById('lista-conquistas-recentes');
    if (!quadro) return;
    quadro.querySelector('.empty-state')?.remove();
    // Idempotente: este demo tem o mesmo nome da comemorativa real
    // "Domínio da Forja" — sem o guarda, o quadro ficava com cards repetidos.
    if (quadro.querySelector('[data-cq-chave="demo-forja"]')) return;
    const jaTemReal = [...quadro.querySelectorAll('.conquista-mini-nome')]
      .some(el => el.textContent.trim().toLowerCase() === 'domínio da forja');
    if (jaTemReal) return;

    const card = document.createElement('div');
    card.className = 'conquista-mini cq-carimbo c-entering c-materializing';
    card.dataset.cqChave = 'demo-forja';
    card.style.borderColor = 'rgba(16,185,129,0.4)';
    card.style.background = 'linear-gradient(90deg, rgba(5,40,30,0.9), rgba(0,15,15,0.95))';
    card.style.boxShadow = '0 0 15px rgba(16,185,129,0.2) inset, 0 0 8px rgba(16,185,129,0.2)';
    
    card.innerHTML = `
      <div class="cq-nevoa" style="background: radial-gradient(circle at left, rgba(16,185,129,0.3) 0%, transparent 60%);"></div>
      
      <span class="cq-medalhinha" style="width:52px;height:52px;flex-shrink:0;">
        ${this._svgMedalhaForja(52)}
      </span>
      
      <div class="conquista-mini-info">
        <div class="conquista-mini-nome" style="color:#6ee7b7; text-shadow:0 0 5px rgba(16,185,129,0.4)">DOMÍNIO DA FORJA</div>
        <div class="conquista-mini-desc" style="color:#d1d5db">A Arte da Criação.</div>
      </div>`;
    quadro.prepend(card);
    
    setTimeout(() => { if (typeof SFX !== 'undefined') SFX.play('carimbo'); }, 380);
  },

  /* API pública do ensaio (convenção: onclick nunca chama método `_privado`) */
  demo() { return this._cerimonia(); },
};

/* ── Vitrine das insígnias ────────────────────────────────────────────────
   Lê o REGISTRO do ConquistaFX, não uma lista escrita à mão. Toda arte
   nova que se registrar aparece aqui sozinha, em três tamanhos, para
   conferir leitura e simetria sem precisar conceder a badge a ninguém. */
ArquitetoConsole.vitrineInsignia = function (codigo) {
  const velha = document.getElementById('arq-vitrine-insignia');
  if (velha) { velha.remove(); if (codigo === undefined) return; }

  const reg = window.ConquistaFX?._insignias || {};
  const codigos = codigo ? [codigo] : Object.keys(reg);
  if (!codigos.length) { SoloDialog?.toast?.('Nenhuma insígnia registrada', 'info'); return; }

  const cx = document.createElement('div');
  cx.id = 'arq-vitrine-insignia';
  cx.style.cssText = `position:fixed;inset:0;z-index:9996;display:flex;align-items:center;
    justify-content:center;background:rgba(3,3,8,.9);backdrop-filter:blur(7px);padding:1.2rem`;

  const arte = (cod, tam) => {
    const svg = window.ConquistaFX?._insigniaCustom?.(cod, tam);
    return svg || `<span style="font-size:${tam * .5}px;opacity:.4">🎖</span>`;
  };

  cx.innerHTML = `
    <div style="width:min(720px,100%);max-height:88vh;overflow-y:auto;padding:1.5rem;
      background:linear-gradient(170deg,#1a0b2e,#0a0714 65%);
      border:1px solid rgba(255,46,154,.45);border-radius:18px;
      box-shadow:0 0 60px rgba(255,46,154,.25)">
      <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:1.2rem">
        <span style="font-size:1.2rem">🎖</span>
        <div style="flex:1">
          <div style="font-family:var(--font-title);font-size:1rem;color:#ff6ec4">
            Vitrine das Insígnias</div>
          <div style="font-family:var(--font-section);font-size:.6rem;letter-spacing:.14em;
            color:var(--text-muted)">CERIMÔNIA · MATERIAIS · CHIP — OS TRÊS TAMANHOS REAIS</div>
        </div>
        <button onclick="document.getElementById('arq-vitrine-insignia').remove()"
          style="background:none;border:none;color:var(--text-muted);font-size:1.1rem;
          cursor:pointer">✕</button>
      </div>
      ${codigos.map(cod => `
        <div style="display:flex;align-items:center;gap:1.4rem;padding:1rem;margin-bottom:.7rem;
          border-radius:14px;background:rgba(255,255,255,.03);
          border:1px solid rgba(255,46,154,.22)">
          <div style="display:flex;align-items:center;justify-content:center;width:150px;
            height:150px;flex-shrink:0">${arte(cod, 140)}</div>
          <div style="display:flex;align-items:center;justify-content:center;width:92px;
            height:92px;flex-shrink:0">${arte(cod, 92)}</div>
          <div style="display:flex;align-items:center;justify-content:center;width:34px;
            height:34px;flex-shrink:0">${arte(cod, 30)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-family:var(--font-section);font-size:.9rem;font-weight:700;
              color:var(--text-primary)">${cod}</div>
            <div style="font-family:var(--font-section);font-size:.66rem;
              color:var(--text-muted);margin-top:.2rem">arte própria registrada</div>
          </div>
        </div>`).join('')}
    </div>`;
  cx.addEventListener('click', e => { if (e.target === cx) cx.remove(); });
  document.body.appendChild(cx);
};

document.addEventListener('DOMContentLoaded', () => ArquitetoConsole.init());
window.ArquitetoConsole = ArquitetoConsole;
window.Jh3ffthFX = Jh3ffthFX;
window.SoloFX = SoloFX;
window.ForjaFX = ForjaFX;
window.DianaFX = DianaFX;

/* ── Inscrição das artes no renderizador único ────────────────────────────
   Toda badge desenhada à mão se declara aqui, UMA vez. A partir deste
   ponto ela aparece sozinha na cerimônia, no selo, no carimbo, no perfil,
   no relicário, na Casa de Trocas e no catálogo — sem tocar em mais nada.

   Para acrescentar uma badge nova no futuro, basta uma linha:
       ConquistaFX.registrarInsignia('codigo_da_badge', tam => SuaFX._svg(tam));
   Se o código não estiver aqui, ela cai na medalha premium padrão do
   Sistema (nunca no emoji). */
(function registrarInsignias() {
  const reg = window.ConquistaFX?.registrarInsignia?.bind(window.ConquistaFX);
  if (!reg) return;
  reg('jh3ffth',       tam => Jh3ffthFX._svgMedalhaArquiteto(tam));
  reg('solo',          tam => SoloFX._svgMedalhaSolo(tam));
  reg('dominio_forja', tam => ForjaFX._svgMedalhaForja(tam));
  reg('diana',         tam => DianaFX._svgMedalhaDiana(tam));
  if (window.NexusSocialArte)
    reg('nexus-social', tam => NexusSocialArte._svgMedalhaNexus(tam));
})();
