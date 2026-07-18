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
    const pontas = [];
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i - Math.PI / 2;
      const rExt = 120;
      const a1 = a - Math.PI / 8, a2 = a + Math.PI / 8;
      pontas.push(`M 130 130 
                   L ${130 + 65 * Math.cos(a1)} ${130 + 65 * Math.sin(a1)}
                   L ${130 + rExt * Math.cos(a)} ${130 + rExt * Math.sin(a)}
                   L ${130 + 65 * Math.cos(a2)} ${130 + 65 * Math.sin(a2)} Z`);
    }
    
    const runas = [];
    for (let i = 0; i < 24; i++) {
      const a = (Math.PI / 12) * i;
      const r1 = 80, r2 = i % 3 === 0 ? 66 : 74;
      runas.push(`M ${130 + r1 * Math.cos(a)} ${130 + r1 * Math.sin(a)} L ${130 + r2 * Math.cos(a)} ${130 + r2 * Math.sin(a)}`);
    }

    const hexagono = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      hexagono.push(`${130 + 55 * Math.cos(a)},${130 + 55 * Math.sin(a)}`);
    }

    return `
    <svg viewBox="0 0 260 260" width="${tamanho}" height="${tamanho}" style="overflow:visible" class="cq-svg">
      <defs>
        <radialGradient id="arqObsidian" cx="38%" cy="30%">
          <stop offset="0%"  stop-color="#71717a"/>
          <stop offset="35%" stop-color="#27272a"/>
          <stop offset="75%" stop-color="#09090b"/>
          <stop offset="100%" stop-color="#000000"/>
        </radialGradient>
        <radialGradient id="arqRuby" cx="40%" cy="35%">
          <stop offset="0%"  stop-color="#fca5a5"/>
          <stop offset="35%" stop-color="#dc2626"/>
          <stop offset="75%" stop-color="#7f1d1d"/>
          <stop offset="100%" stop-color="#270202"/>
        </radialGradient>
        <linearGradient id="arqRubyBright" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f87171"/>
          <stop offset="50%" stop-color="#b91c1c"/>
          <stop offset="100%" stop-color="#7f1d1d"/>
        </linearGradient>
        <filter id="arqGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="arqShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000" flood-opacity="0.9"/>
          <feDropShadow dx="0" dy="0" stdDeviation="15" flood-color="#dc2626" flood-opacity="0.5"/>
        </filter>
      </defs>
      
      <g filter="url(#arqShadow)">
        <!-- Outer Ring Base -->
        <circle cx="130" cy="130" r="95" fill="url(#arqObsidian)" stroke="url(#arqRubyBright)" stroke-width="2"/>
        
        <!-- Mechanical Runes (Counter-clockwise rotation) -->
        <g style="transform-origin: 130px 130px; animation: cq-anel-girar 22s linear infinite reverse;">
          <path d="${runas.join(' ')}" stroke="#f87171" stroke-width="2" opacity="0.6"/>
          <path d="${runas.join(' ')}" stroke="#f87171" stroke-width="4" filter="url(#arqGlow)" opacity="0.4"/>
        </g>
        
        <!-- 8-Pointed Star (Clockwise rotation like Fable5's star) -->
        <g class="cq-svg-star">
          <path d="${pontas.join(' ')}" fill="url(#arqObsidian)" stroke="url(#arqRubyBright)" stroke-width="1.5"/>
        </g>
        
        <!-- Inner Core (Hexagon) -->
        <polygon points="${hexagono.join(' ')}" fill="url(#arqRuby)" stroke="#fca5a5" stroke-width="2" filter="url(#arqGlow)"/>
        
        <!-- Glass Facets for the Ruby -->
        <polygon points="130,76 178,104 130,130 82,104" fill="rgba(255,255,255,0.18)"/>
        <polygon points="82,104 130,130 82,156" fill="rgba(255,255,255,0.06)"/>
        
        <!-- Sweeping light highlight tracing the rim -->
        <circle cx="130" cy="130" r="95" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="2.5" stroke-dasharray="35 562" class="cq-svg-brilho"/>
        
        <!-- Vector Icon (The Eye) -->
        <g transform="translate(130, 130)">
          <path d="M -28 0 C -15 -18, 15 -18, 28 0 C 15 18, -15 18, -28 0 Z" fill="none" stroke="#fff" stroke-width="3"/>
          <circle cx="0" cy="0" r="9" fill="#fff" filter="url(#arqGlow)" opacity="0.6"/>
          <circle cx="0" cy="0" r="9" fill="#fff"/>
          <circle cx="0" cy="0" r="3" fill="#450a0a"/>
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

    const card = document.createElement('div');
    card.className = 'conquista-mini cq-carimbo c-entering c-materializing';
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
    LevelUp.show(n, r, t, m);
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
        font-family:var(--font-title);font-size:.8rem;font-weight:700;letter-spacing:.08em;
        padding:.6rem .9rem;border-radius:10px;cursor:pointer;text-align:center;
        color:#fca5a5;background:linear-gradient(90deg, #7f1d1d, #450a0a);
        border:1px solid #ef4444;transition:all .15s;margin-bottom:.4rem;
        box-shadow:0 0 15px rgba(239,68,68,0.4);"
        onmouseover="this.style.boxShadow='0 0 25px rgba(239,68,68,0.8)'"
        onmouseout="this.style.boxShadow='0 0 15px rgba(239,68,68,0.4)'">
        👁‍🗨 TOGGLE MEDALHA JH3FFTH
      </button>
      <button onclick="window.SoloFX.toggle()" style="
        font-family:var(--font-title);font-size:.8rem;font-weight:700;letter-spacing:.08em;
        padding:.6rem .9rem;border-radius:10px;cursor:pointer;text-align:center;
        color:#d8b4fe;background:linear-gradient(90deg, #3b0764, #170529);
        border:1px solid #a855f7;transition:all .15s;margin-bottom:.4rem;
        box-shadow:0 0 15px rgba(168,85,247,0.4);"
        onmouseover="this.style.boxShadow='0 0 25px rgba(168,85,247,0.8)'"
        onmouseout="this.style.boxShadow='0 0 15px rgba(168,85,247,0.4)'">
        👁‍🗨 TOGGLE MEDALHA SOLO
      </button>
      ${btn('🏅 Cerimônia de Conquista', 'cerimonia()')}
      ${btn('🎞 Fila — 3 cerimônias seguidas', 'fila3()')}
      ${btn('✨ Level Up (rank aleatório)', 'levelup()')}
      ${btn('💥 Explosão de partículas', 'explosao()')}
      ${btn('⚔️ Sparks + XP Float', 'xpfloat()')}
      ${btn('📜 Selo + carimbo no quadro', 'selo()')}
      <div style="font-family:var(--font-section);font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;color:var(--text-muted);margin-top:.3rem">Sons</div>
      <div style="display:flex;gap:.4rem">
        ${btn('🎺 conquista', "som('conquista')").replace('text-align:left', 'flex:1;text-align:center')}
        ${btn('🔨 carimbo', "som('carimbo')").replace('text-align:left', 'flex:1;text-align:center')}
        ${btn('🌟 levelup', "som('levelup')").replace('text-align:left', 'flex:1;text-align:center')}
      </div>
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

document.addEventListener('DOMContentLoaded', () => ArquitetoConsole.init());
window.ArquitetoConsole = ArquitetoConsole;
window.Jh3ffthFX = Jh3ffthFX;
window.SoloFX = SoloFX;
