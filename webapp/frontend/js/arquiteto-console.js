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

        <!-- Escudo Pipa Gótico (O Núcleo da Armadura) -->
        <polygon points="130,25 200,105 130,235 60,105" fill="url(#sapuriMetal)" stroke="url(#sapuriEdge)" stroke-width="3"/>
        
        <!-- Gema de Rubi Central -->
        <polygon points="130,40 180,105 130,215 80,105" fill="url(#rubyGlow)" filter="url(#bloodGlow)"/>
        
        <!-- Facetas de Vidro 3D do Rubi -->
        <polygon points="130,40 80,105 130,105" fill="rgba(255,255,255,0.3)"/>
        <polygon points="130,40 180,105 130,105" fill="rgba(255,255,255,0.05)"/>
        <polygon points="80,105 130,215 130,105" fill="rgba(0,0,0,0.4)"/>
        <polygon points="180,105 130,215 130,105" fill="rgba(0,0,0,0.7)"/>

        <!-- Veias de Hades (Luz correndo pelas bordas do escudo) -->
        <polygon points="130,25 200,105 130,235 60,105" fill="none" stroke="#fca5a5" stroke-width="2" stroke-dasharray="50 350" class="cq-svg-brilho"/>
        
        <!-- O Olho Demoniaco do Arquiteto -->
        <g transform="translate(130, 105)">
          <path d="M -35 0 C -15 -20, 15 -20, 35 0 C 15 20, -15 20, -35 0 Z" fill="#000" stroke="#fca5a5" stroke-width="2"/>
          <circle cx="0" cy="0" r="11" fill="#ef4444" filter="url(#bloodGlow)"/>
          <circle cx="0" cy="0" r="11" fill="#fff"/>
          <path d="M 0 -8 L 4 0 L 0 8 L -4 0 Z" fill="#450a0a"/> 
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

  /* Insígnias com arte própria (mesmo mapa usado no perfil) */
  _insignia(codigo, tam = 44) {
    const mapa = {
      jh3ffth:       () => window.Jh3ffthFX?._svgMedalhaArquiteto?.(tam),
      solo:          () => window.SoloFX?._svgMedalhaSolo?.(tam),
      dominio_forja: () => window.ForjaFX?._svgMedalhaForja?.(tam),
    };
    try { return (mapa[codigo] && mapa[codigo]()) || null; }
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
      flex-direction:column;gap:.45rem;width:270px;padding:1rem 1.1rem 1.2rem;
      background:linear-gradient(170deg,#1a1206,#0d0d1a 60%);
      border:1px solid rgba(251,191,36,.55);border-radius:16px;
      box-shadow:0 0 40px rgba(251,191,36,.25), 0 18px 50px rgba(0,0,0,.6);`;
    el.innerHTML = `
      <div id="arq-console-handle" style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;cursor:grab;user-select:none" title="Arraste para mover">
        <span style="font-size:1.1rem">⚒</span>
        <div style="flex:1">
          <div style="font-family:var(--font-title);font-size:.85rem;color:var(--gold-bright)">Forja de Testes</div>
          <div style="font-family:var(--font-section);font-size:.58rem;letter-spacing:.14em;color:var(--text-muted)">SÓ O ARQUITETO VÊ · NADA É SALVO</div>
        </div>
        <button onclick="ArquitetoConsole.fechar()" style="color:var(--text-muted);cursor:pointer;font-size:1rem;background:none;border:none">✕</button>
      </div>
      <button onclick="window.Jh3ffthFX.toggle()" style="
        font-family:var(--font-section);font-size:.78rem;font-weight:700;letter-spacing:.06em;
        padding:.6rem .9rem;border-radius:10px;cursor:pointer;text-align:left;
        color:#fca5a5;background:rgba(239,68,68,.07);
        border:1px solid rgba(239,68,68,.35);transition:all .15s"
        onmouseover="this.style.background='rgba(239,68,68,.18)';this.style.boxShadow='0 0 12px rgba(239,68,68,.35)'"
        onmouseout="this.style.background='rgba(239,68,68,.07)';this.style.boxShadow='none'">
        👁‍🗨 TOGGLE MEDALHA JH3FFTH
      </button>
      <button onclick="window.SoloFX.toggle()" style="
        font-family:var(--font-section);font-size:.78rem;font-weight:700;letter-spacing:.06em;
        padding:.6rem .9rem;border-radius:10px;cursor:pointer;text-align:left;
        color:#d8b4fe;background:rgba(168,85,247,.07);
        border:1px solid rgba(168,85,247,.35);transition:all .15s"
        onmouseover="this.style.background='rgba(168,85,247,.18)';this.style.boxShadow='0 0 12px rgba(168,85,247,.35)'"
        onmouseout="this.style.background='rgba(168,85,247,.07)';this.style.boxShadow='none'">
        👁‍🗨 TOGGLE MEDALHA SOLO
      </button>
      <button onclick="window.SoloFX.demoCard()" style="
        font-family:var(--font-section);font-size:.78rem;font-weight:700;letter-spacing:.06em;
        padding:.6rem .9rem;border-radius:10px;cursor:pointer;text-align:left;
        color:#94a3b8;background:rgba(100,116,139,.07);
        border:1px dashed rgba(100,116,139,.35);transition:all .15s"
        onmouseover="this.style.background='rgba(100,116,139,.18)';this.style.boxShadow='0 0 12px rgba(100,116,139,.35)'"
        onmouseout="this.style.background='rgba(100,116,139,.07)';this.style.boxShadow='none'">
        🧪 TESTAR CARD DE ROTINA
      </button>
      <button onclick="window.SoloFX.demoLauncher()" style="
        font-family:var(--font-section);font-size:.78rem;font-weight:700;letter-spacing:.06em;
        padding:.6rem .9rem;border-radius:10px;cursor:pointer;text-align:left;
        color:#94a3b8;background:rgba(100,116,139,.07);
        border:1px dashed rgba(100,116,139,.35);transition:all .15s"
        onmouseover="this.style.background='rgba(100,116,139,.18)';this.style.boxShadow='0 0 12px rgba(100,116,139,.35)'"
        onmouseout="this.style.background='rgba(100,116,139,.07)';this.style.boxShadow='none'">
        🧪 TESTAR LANÇADOR DE MISSÕES
      </button>
      <button onclick="window.ForjaFX.demo()" style="
        font-family:var(--font-section);font-size:.78rem;font-weight:700;letter-spacing:.06em;
        padding:.6rem .9rem;border-radius:10px;cursor:pointer;text-align:left;
        color:#10b981;background:rgba(16,185,129,.07);
        border:1px dashed rgba(16,185,129,.35);transition:all .15s"
        onmouseover="this.style.background='rgba(16,185,129,.18)';this.style.boxShadow='0 0 12px rgba(16,185,129,.35)'"
        onmouseout="this.style.background='rgba(16,185,129,.07)';this.style.boxShadow='none'">
        🧪 TESTAR DOMÍNIO DA FORJA
      </button>
      <button onclick="ArquitetoConsole.dominioHabilidades()" style="
        font-family:var(--font-section);font-size:.78rem;font-weight:700;letter-spacing:.06em;
        padding:.6rem .9rem;border-radius:10px;cursor:pointer;text-align:left;
        color:#38bdf8;background:rgba(56,189,248,.07);
        border:1px dashed rgba(56,189,248,.35);transition:all .15s"
        onmouseover="this.style.background='rgba(56,189,248,.18)';this.style.boxShadow='0 0 12px rgba(56,189,248,.35)'"
        onmouseout="this.style.background='rgba(56,189,248,.07)';this.style.boxShadow='none'">
        🧪 TESTAR DOMÍNIO DAS HABILIDADES
      </button>
      ${btn('🏛 Comemorativas (conceder/ocultar)', 'comemorativas()')}
      ${btn('🏅 Cerimônia de Conquista', 'cerimonia()')}
      ${btn('🎞 Fila — 3 cerimônias seguidas', 'fila3()')}
      ${btn('✨ Ascensão (1 nível)', 'levelup()')}
      ${btn('🌌 Ascensão múltipla (+11 níveis)', 'ascensaoMultipla()')}
      ${btn('🎬 Sequência: Ascensão → Cerimônia', 'sequenciaCompleta()')}
      ${btn('🔧 Sincronizar meu nível (reparo)', 'sincronizarNivel()')}
      ${btn('💥 Explosão de partículas', 'explosao()')}
      ${btn('⚔️ Sparks + XP Float', 'xpfloat()')}
      ${btn('📜 Selo + carimbo no quadro', 'selo()')}
      <div style="font-family:var(--font-section);font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;color:var(--text-muted);margin-top:.3rem">Sons</div>
      <div style="display:flex;gap:.4rem">
        ${btn('<div style="font-size:1.1rem;margin-bottom:.2rem">🎺</div>conquista', "som('conquista')").replace('text-align:left', 'flex:1;text-align:center;padding:.5rem .2rem;line-height:1.2').replace('padding:.6rem .9rem;', '')}
        ${btn('<div style="font-size:1.1rem;margin-bottom:.2rem">🔨</div>carimbo', "som('carimbo')").replace('text-align:left', 'flex:1;text-align:center;padding:.5rem .2rem;line-height:1.2').replace('padding:.6rem .9rem;', '')}
        ${btn('<div style="font-size:1.1rem;margin-bottom:.2rem">🌟</div>levelup', "som('levelup')").replace('text-align:left', 'flex:1;text-align:center;padding:.5rem .2rem;line-height:1.2').replace('padding:.6rem .9rem;', '')}
      </div>
      <div style="font-family:var(--font-section);font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;color:var(--text-muted);margin-top:.5rem">Zona de Perigo</div>
      <button onclick="if(window.__resetPerfilArquiteto)window.__resetPerfilArquiteto();else SoloDialog.toast('Abra o Dashboard primeiro','warn')" style="
        font-family:var(--font-section);font-size:.75rem;font-weight:700;letter-spacing:.06em;
        padding:.55rem .9rem;border-radius:10px;cursor:pointer;text-align:left;
        color:#f87171;background:rgba(239,68,68,.07);
        border:1px solid rgba(239,68,68,.4);transition:all .15s"
        onmouseover="this.style.background='rgba(239,68,68,.2)';this.style.boxShadow='0 0 12px rgba(239,68,68,.4)'"
        onmouseout="this.style.background='rgba(239,68,68,.07)';this.style.boxShadow='none'">
        ↺ Resetar Progresso (zera tudo)
      </button>
      <div style="font-size:.6rem;color:var(--text-dim);margin-top:.4rem;font-family:var(--font-section)">
        Atalho: Ctrl+Alt+A · ou duplo-clique no badge ★ Arquiteto ★
      </div>`;
    document.body.appendChild(el);
    this._tornarArrastavel(el);
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

document.addEventListener('DOMContentLoaded', () => ArquitetoConsole.init());
window.ArquitetoConsole = ArquitetoConsole;
window.Jh3ffthFX = Jh3ffthFX;
window.SoloFX = SoloFX;
window.ForjaFX = ForjaFX;
