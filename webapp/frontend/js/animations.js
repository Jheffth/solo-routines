// ============================================================
// SOLO ROUTINES — Animations Engine
// Partículas canvas, level-up FX, XP float, sparks
// ============================================================

// ── Canvas de Partículas ───────────────────────────────────
const Particles = {
  canvas: null,
  ctx: null,
  particles: [],
  animId: null,

  init() {
    this.canvas = document.getElementById('particles-bg');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._spawn(60);
    this._loop();
  },

  _resize() {
    if (!this.canvas) return;
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  _spawn(count) {
    for (let i = 0; i < count; i++) {
      this.particles.push(this._newParticle());
    }
  },

  _newParticle(y = null) {
    const colors = [
      'rgba(124,58,237,',   // roxo
      'rgba(168,85,247,',   // roxo claro
      'rgba(6,182,212,',    // ciano
      'rgba(59,130,246,',   // azul
      'rgba(245,158,11,',   // dourado
    ];
    const color = colors[Math.floor(Math.random() * colors.length)];
    return {
      x:     Math.random() * window.innerWidth,
      y:     y !== null ? y : Math.random() * window.innerHeight,
      size:  Math.random() * 2.5 + 0.5,
      speedX: (Math.random() - 0.5) * 0.4,
      speedY: -(Math.random() * 0.6 + 0.2),
      opacity: Math.random() * 0.5 + 0.1,
      color,
      life: 1,
      decay: Math.random() * 0.003 + 0.001,
    };
  },

  _loop() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.particles = this.particles.filter(p => p.life > 0);

    for (const p of this.particles) {
      p.x += p.speedX;
      p.y += p.speedY;
      p.life -= p.decay;
      const alpha = p.life * p.opacity;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color + alpha + ')';
      this.ctx.fill();
    }

    // Repõe partículas
    while (this.particles.length < 60) {
      this.particles.push(this._newParticle(window.innerHeight + 10));
    }

    this.animId = requestAnimationFrame(() => this._loop());
  },

  burst(x, y, count = 20, color = 'rgba(245,158,11,') {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i;
      const speed = Math.random() * 3 + 1;
      this.particles.push({
        x, y,
        size:  Math.random() * 3 + 1,
        speedX: Math.cos(angle) * speed,
        speedY: Math.sin(angle) * speed - 2,
        opacity: 0.9,
        color,
        life: 1,
        decay: 0.02 + Math.random() * 0.02,
      });
    }
  },
};

// ── Level Up Effect ────────────────────────────────────────
// ══════════════════════════════════════════════════════════
// ASCENSÃO — level-up cerimonial
//   Múltiplos níveis viram UMA cerimônia (contador rolando),
//   nunca N animações seguidas.
//   Retorna Promise: quem chamou pode encadear a Cerimônia depois.
// ══════════════════════════════════════════════════════════
const Ascensao = {
  _reduzido: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches,

  /* levelUps: array vindo do backend [{nivel, rank, titulo, moedas_bonus, nivel_anterior?}] */
  mostrar(levelUps) {
    if (!levelUps || !levelUps.length) return Promise.resolve();
    const ultimo   = levelUps[levelUps.length - 1];
    const nFinal   = ultimo.nivel;
    const nInicial = ultimo.nivel_anterior ?? (levelUps[0].nivel - 1);
    const saltos   = ultimo.niveis_ganhos ?? levelUps.length;
    const moedas   = levelUps.reduce((s, l) => s + (l.moedas_bonus || 0), 0);
    // Ranks atravessados (sem repetir) — mostra a escalada quando há salto grande
    const ranks = [...new Set(levelUps.map(l => l.rank).filter(Boolean))];

    if (this._reduzido) {
      SoloDialog?.toast?.(`⬆ Nível ${nFinal} — ${ultimo.titulo || ''}`, 'success');
      return new Promise(r => setTimeout(r, 800));
    }

    return new Promise(resolve => {
      const ov = document.createElement('div');
      ov.className = 'asc-overlay';
      ov.innerHTML = `
        <div class="asc-rasgo"></div>
        <div class="asc-flash"></div>
        <div class="asc-pilar"></div>
        <div class="asc-ondas">
          <span class="asc-onda"></span><span class="asc-onda o2"></span><span class="asc-onda o3"></span>
        </div>
        <div class="asc-runas">
          ${Array.from({ length: 12 }, (_, i) =>
            `<span class="asc-runa" style="--a:${i * 30}deg;--d:${i * 60}ms">◆</span>`).join('')}
        </div>
        <div class="asc-palco">
          <div class="asc-lbl">⟁ ASCENSÃO ⟁</div>
          <div class="asc-nivel">
            <span class="asc-num" id="asc-num">${nInicial}</span>
          </div>
          <div class="asc-rank">${ultimo.rank || ''}</div>
          <div class="asc-titulo">"${ultimo.titulo || ''}"</div>
          ${saltos > 1 ? `<div class="asc-saltos">+${saltos} NÍVEIS · ${ranks.join(' → ')}</div>` : ''}
          ${moedas > 0 ? `<div class="asc-moedas">💰 +${moedas.toLocaleString('pt-BR')} Mana Coins</div>` : ''}
        </div>`;
      document.body.appendChild(ov);

      // Som + tremor da tela
      if (typeof SFX !== 'undefined') SFX.play('levelup');
      document.getElementById('app-container')?.classList.add('asc-tremor');
      setTimeout(() => document.getElementById('app-container')?.classList.remove('asc-tremor'), 900);

      // Tempestade de partículas
      const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      if (typeof Particles !== 'undefined') {
        Particles.burst(cx, cy, 70, 'rgba(168,85,247,');
        setTimeout(() => Particles.burst(cx, cy, 50, 'rgba(34,211,238,'), 200);
        setTimeout(() => Particles.burst(cx, cy, 40, 'rgba(251,191,36,'), 420);
      }

      // Contador rolando do nível antigo ao novo (o "peso" do salto)
      const elNum = ov.querySelector('#asc-num');
      const dur = Math.min(1800, 700 + saltos * 120);
      const t0 = performance.now();
      const rolar = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        elNum.textContent = Math.round(nInicial + (nFinal - nInicial) * eased);
        if (p < 1) requestAnimationFrame(rolar);
        else elNum.classList.add('asc-num-final');
      };
      setTimeout(() => requestAnimationFrame(rolar), 650);

      const encerrar = () => {
        if (ov.dataset.saindo) return;
        ov.dataset.saindo = '1';
        ov.classList.add('asc-saindo');
        setTimeout(() => { ov.remove(); resolve(); }, 600);
      };
      ov.addEventListener('click', encerrar);
      setTimeout(encerrar, 4200);
    });
  },
};

const LevelUp = {
  /* Compatibilidade: chamadas antigas caem na Ascensão */
  show(nivel, rank, titulo, moedasBonus) {
    return Ascensao.mostrar([{ nivel, rank, titulo, moedas_bonus: moedasBonus }]);
  },

  _showAntigo(nivel, rank, titulo, moedasBonus) {
    const overlay = document.getElementById('level-up-overlay');
    if (!overlay) return;
    if (typeof SFX !== 'undefined') SFX.play('levelup');

    overlay.innerHTML = `
      <div class="level-up-backdrop"></div>
      <div class="level-up-content">
        <span class="level-up-title">✨ LEVEL UP! ✨</span>
        <div class="level-up-rank" style="margin-top:1rem">
          Nível ${nivel}${rank ? ` — <strong>${rank}</strong>` : ''}
        </div>
        ${titulo ? `<div class="level-up-titulo">"${titulo}"</div>` : ''}
        ${moedasBonus ? `<div style="margin-top:1rem; font-family:var(--font-section); color:var(--gold-xp); font-size:1rem;">
          💰 +${moedasBonus} Mana Coins de bônus!
        </div>` : ''}
      </div>
    `;
    overlay.classList.add('show');
    overlay.style.display = 'flex';

    // Burst de partículas douradas
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    Particles.burst(cx, cy, 50, 'rgba(251,191,36,');
    Particles.burst(cx, cy, 30, 'rgba(124,58,237,');

    setTimeout(() => {
      overlay.classList.remove('show');
      overlay.style.display = 'none';
    }, 3500);
  },

  // Level-ups do resultado da API: TUDO numa cerimônia só (Ascensão)
  processarResultado(resultado) {
    if (!resultado) return Promise.resolve();
    return Ascensao.mostrar(resultado.level_ups || []);
    // Conquistas: disparadas pelo interceptador global do api.js (canal único)
  },
};

// ── XP Float ──────────────────────────────────────────────
const XPFloat = {
  show(xp, x, y) {
    const el = document.createElement('div');
    el.className = 'xp-float-item';
    el.textContent = `+${xp} XP ✨`;
    el.style.cssText = `left:${x - 30}px; top:${y - 10}px;`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  },

  showAtElement(el, xp, moedas) {
    const rect = el.getBoundingClientRect();
    XPFloat.show(xp, rect.left + rect.width / 2, rect.top);
    if (moedas) {
      setTimeout(() => {
        const mc = document.createElement('div');
        mc.className = 'xp-float-item';
        mc.style.cssText = `left:${rect.left + rect.width / 2 + 20}px; top:${rect.top - 20}px; color:var(--gold-xp);`;
        mc.textContent = `+${moedas} 💰`;
        document.body.appendChild(mc);
        setTimeout(() => mc.remove(), 1600);
      }, 200);
    }
  },
};

// ══════════════════════════════════════════════════════════
// CERIMÔNIA DE CONQUISTA — 3 atos
//   I.   Flash dourado + burst de partículas
//   II.  Medalha forjada no centro (runas girando, raios, shimmer)
//   III. Recolhe num selo de canto + carimbo no quadro de recentes
// Fila: várias conquistas = uma cerimônia por vez.
// ══════════════════════════════════════════════════════════
const ConquistaFX = {
  _fila: [],
  _rodando: false,
  _vistas: new Map(),   // dedup: mesma conquista não repete cerimônia em 15s
  _reduzido: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches,

  show(conquista) {
    const chave = conquista.id ?? conquista.titulo ?? JSON.stringify(conquista);
    const agora = Date.now();
    if (this._vistas.has(chave) && agora - this._vistas.get(chave) < 15000) return;
    this._vistas.set(chave, agora);
    this._fila.push(conquista);
    if (!this._rodando) this._proxima();
  },

  _proxima() {
    const c = this._fila.shift();
    if (!c) { this._rodando = false; return; }
    this._rodando = true;
    this._reduzido ? this._versaoCalma(c) : this._cerimonia(c);
  },

  /* ── Registro de insígnias com arte própria ──────────────────────────
     Cada badge desenhada à mão se inscreve aqui uma única vez e passa a
     valer em TODOS os lugares: cerimônia, selo lateral, carimbo, grade do
     perfil, Materiais e catálogo. Badges novas só precisam chamar
     ConquistaFX.registrarInsignia('codigo', tam => svg) — nada mais. */
  _insignias: {
    // Ponte de compatibilidade: as artes moram no arquiteto-console.js e
    // se registram sozinhas ao carregar. Este mapa é o plano B caso a
    // ordem dos scripts mude.
    jh3ffth:       tam => window.Jh3ffthFX?._svgMedalhaArquiteto?.(tam),
    solo:          tam => window.SoloFX?._svgMedalhaSolo?.(tam),
    dominio_forja: tam => window.ForjaFX?._svgMedalhaForja?.(tam),
    diana:         tam => window.DianaFX?._svgMedalhaDiana?.(tam),
  },

  registrarInsignia(codigo, desenhar) {
    if (codigo && typeof desenhar === 'function') this._insignias[codigo] = desenhar;
  },

  /* ── IDs únicos por instância ────────────────────────────────────────
     ARMADILHA: os SVGs trazem <defs> com ids fixos (soloUV, cqOuro...).
     Com duas medalhas na mesma página os ids colidem e o navegador resolve
     url(#id) para a PRIMEIRA ocorrência — que pode estar num container
     oculto. O resultado é a medalha sair sem pintura: invisível.
     Aqui cada instância ganha um sufixo próprio e o problema deixa de
     existir para qualquer badge, inclusive as que ainda serão criadas. */
  _seqSvg: 0,
  _idsUnicos(svg) {
    if (!svg || typeof svg !== 'string') return svg;
    const selo = `i${++this._seqSvg}`;
    const ids = new Set();
    svg.replace(/\sid="([^"]+)"/g, (_, id) => { ids.add(id); return ''; });
    if (!ids.size) return svg;
    ids.forEach(id => {
      const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      svg = svg.replace(new RegExp(`\\sid="${esc}"`, 'g'), ` id="${id}-${selo}"`)
               .replace(new RegExp(`url\\(#${esc}\\)`, 'g'), `url(#${id}-${selo})`)
               .replace(new RegExp(`href="#${esc}"`, 'g'), `href="#${id}-${selo}"`);
    });
    return svg;
  },

  /* Arte própria da conquista, quando existe. Substitui a medalha padrão. */
  _insigniaCustom(codigo, tam) {
    try {
      const desenhar = codigo && this._insignias[codigo];
      return desenhar ? (this._idsUnicos(desenhar(tam)) || null) : null;
    } catch (_) { return null; }
  },

  /* Medalha em miniatura — para os selos permanentes (quadro/perfil) */
  miniMedalha(c, tamanho = 52) {
    const custom = this._insigniaCustom(c.codigo, tamanho);
    if (custom) {
      return `<span class="cq-medalhinha" style="width:${tamanho}px;height:${tamanho}px">${custom}</span>`;
    }
    return `<span class="cq-medalhinha" style="width:${tamanho}px;height:${tamanho}px">
      ${this._idsUnicos(this._svgMedalha(tamanho))}
      <span class="cq-medalhinha-ico" style="font-size:${Math.round(tamanho * 0.3)}px">${c.icone || '🏆'}</span>
    </span>`;
  },

  /* Medalha do Sistema — SVG forjado (estrela arcana + gema + louros + coroa) */
  _svgMedalha(tamanho = 240) {
    // 12 pontas alternadas da estrela
    const pontas = [];
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI / 6) * i - Math.PI / 2;
      const rExt = i % 2 === 0 ? 128 : 98;
      const a1 = a - Math.PI / 12, a2 = a + Math.PI / 12;
      pontas.push(`M ${130 + 88 * Math.cos(a1)} ${130 + 88 * Math.sin(a1)}
                   L ${130 + rExt * Math.cos(a)} ${130 + rExt * Math.sin(a)}
                   L ${130 + 88 * Math.cos(a2)} ${130 + 88 * Math.sin(a2)} Z`);
    }
    // Runas gravadas no anel
    const runas = [];
    for (let i = 0; i < 24; i++) {
      const a = (Math.PI / 12) * i;
      const r1 = 80, r2 = i % 3 === 0 ? 70 : 74;
      runas.push(`M ${130 + r1 * Math.cos(a)} ${130 + r1 * Math.sin(a)}
                  L ${130 + r2 * Math.cos(a)} ${130 + r2 * Math.sin(a)}`);
    }
    return `
    <svg viewBox="0 0 260 260" width="${tamanho}" height="${tamanho}" class="cq-svg">
      <defs>
        <radialGradient id="cqOuro" cx="38%" cy="30%">
          <stop offset="0%"  stop-color="#fff6d8"/>
          <stop offset="35%" stop-color="#fbbf24"/>
          <stop offset="75%" stop-color="#b45309"/>
          <stop offset="100%" stop-color="#78350f"/>
        </radialGradient>
        <linearGradient id="cqBorda" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"  stop-color="#fde68a"/>
          <stop offset="50%" stop-color="#d97706"/>
          <stop offset="100%" stop-color="#fbbf24"/>
        </linearGradient>
        <radialGradient id="cqGema" cx="40%" cy="32%">
          <stop offset="0%"  stop-color="#e9d5ff"/>
          <stop offset="35%" stop-color="#a855f7"/>
          <stop offset="80%" stop-color="#4c1d95"/>
          <stop offset="100%" stop-color="#2d0a5e"/>
        </radialGradient>
        <filter id="cqGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <!-- Estrela de 12 pontas (gira lenta via CSS) -->
      <g class="cq-svg-star" filter="url(#cqGlow)">
        <path d="${pontas.join(' ')}" fill="url(#cqBorda)" opacity=".95"/>
      </g>

      <!-- Corpo da medalha -->
      <circle cx="130" cy="130" r="88" fill="url(#cqOuro)" stroke="url(#cqBorda)" stroke-width="5" filter="url(#cqGlow)"/>
      <circle cx="130" cy="130" r="83" fill="none" stroke="#78350f" stroke-width="1.5" opacity=".7"/>
      <path d="${runas.join(' ')}" stroke="#92610a" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>
      <circle cx="130" cy="130" r="64" fill="none" stroke="#fde68a" stroke-width="1.6" opacity=".8"/>

      <!-- Gema central -->
      <polygon points="130,72 178,100 178,160 130,188 82,160 82,100"
        fill="url(#cqGema)" stroke="#e9d5ff" stroke-width="2.5" filter="url(#cqGlow)"/>
      <polygon points="130,82 168,104 130,126 92,104" fill="rgba(255,255,255,.28)"/>

      <!-- Louros -->
      <g stroke="url(#cqBorda)" stroke-width="4" fill="none" stroke-linecap="round">
        <path d="M 52 178 Q 34 140 48 100"/>
        <path d="M 208 178 Q 226 140 212 100"/>
      </g>
      <g fill="url(#cqBorda)">
        ${[0,1,2,3,4].map(i => `
          <ellipse cx="${46 - i*1.5}" cy="${170 - i*17}" rx="11" ry="4.5" transform="rotate(${-38 + i*9} ${46 - i*1.5} ${170 - i*17})"/>
          <ellipse cx="${214 + i*1.5}" cy="${170 - i*17}" rx="11" ry="4.5" transform="rotate(${38 - i*9} ${214 + i*1.5} ${170 - i*17})"/>`).join('')}
      </g>

      <!-- Coroa -->
      <g filter="url(#cqGlow)">
        <path d="M 106 34 L 112 16 L 122 30 L 130 10 L 138 30 L 148 16 L 154 34 Z"
          fill="url(#cqBorda)" stroke="#fde68a" stroke-width="1.5"/>
        <circle cx="130" cy="8" r="3.5" fill="#fff6d8"/>
      </g>

      <!-- Brilho varrendo (CSS anima o gradiente) -->
      <circle cx="130" cy="130" r="88" fill="none" stroke="rgba(255,255,255,.55)"
        stroke-width="3" stroke-dasharray="40 512" class="cq-svg-brilho"/>
    </svg>`;
  },

  _cerimonia(c) {
    // Overlay da cerimônia
    const ov = document.createElement('div');
    ov.className = 'cq-overlay';
    ov.innerHTML = `
      <div class="cq-flash"></div>
      <div class="cq-palco">
        <div class="cq-raios"></div>
        <div class="cq-medalha">
          <div class="cq-anel r2"></div>
          ${(() => {
            // Insígnia própria (Jh3ffth / SOLO / Forja) tem prioridade no clímax
            const custom = this._insigniaCustom(c.codigo, 240);
            return custom ? custom
                 : `${this._svgMedalha()}<div class="cq-ico">${c.icone || '🏆'}</div>`;
          })()}
        </div>
        <div class="cq-textos">
          <div class="cq-lbl">⟁ CONQUISTA DESBLOQUEADA ⟁</div>
          <div class="cq-nome">${c.titulo || 'Conquista'}</div>
          ${c.descricao ? `<div class="cq-desc">${c.descricao}</div>` : ''}
          ${c.xp_bonus ? `<div class="cq-xp">+${c.xp_bonus} XP</div>` : ''}
        </div>
      </div>`;
    document.body.appendChild(ov);

    // Ato I: som + flash + explosão de partículas
    if (typeof SFX !== 'undefined') SFX.play('conquista');
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2 - 40;
    Particles.burst(cx, cy, 60, 'rgba(251,191,36,');
    setTimeout(() => Particles.burst(cx, cy, 35, 'rgba(168,85,247,'), 180);
    setTimeout(() => Particles.burst(cx, cy, 25, 'rgba(34,211,238,'), 360);

    // Ato III: recolher para o canto + carimbar o quadro
    setTimeout(() => {
      ov.classList.add('cq-saindo');
      this._selo(c);
      this._carimbarQuadro(c);
    }, 3000);
    setTimeout(() => { ov.remove(); this._proxima(); }, 3600);

    // Clique pula a cerimônia
    ov.addEventListener('click', () => {
      if (ov.classList.contains('cq-saindo')) return;
      ov.classList.add('cq-saindo');
      this._selo(c);
      this._carimbarQuadro(c);
      setTimeout(() => { ov.remove(); }, 600);
    });
  },

  // Versão discreta (prefers-reduced-motion)
  _versaoCalma(c) {
    this._selo(c);
    this._carimbarQuadro(c);
    setTimeout(() => this._proxima(), 1200);
  },

  // Selo compacto no canto (persistente por alguns segundos)
  _selo(c) {
    let pilha = document.getElementById('cq-pilha');
    if (!pilha) {
      pilha = document.createElement('div');
      pilha.id = 'cq-pilha';
      document.body.appendChild(pilha);
    }
    const el = document.createElement('div');
    el.className = 'cq-selo';
    const seloCustom = this._insigniaCustom(c.codigo, 40);
    el.innerHTML = `
      <div class="cq-selo-ico">${seloCustom
        ? `<span class="cq-medalhinha" style="width:40px;height:40px">${seloCustom}</span>`
        : (c.icone || '🏆')}</div>
      <div>
        <div class="cq-selo-lbl">Conquista</div>
        <div class="cq-selo-nome">${c.titulo || ''}</div>
      </div>
      ${c.xp_bonus ? `<div class="cq-selo-xp">+${c.xp_bonus}</div>` : ''}`;
    pilha.appendChild(el);
    setTimeout(() => { el.classList.add('cq-selo-out'); setTimeout(() => el.remove(), 500); }, 6000);
  },

  // Carimbo no quadro "Conquistas Recentes" (se visível): slam + neblina
  _carimbarQuadro(c) {
    const quadro = document.getElementById('lista-conquistas-recentes');
    if (!quadro) return;
    quadro.querySelector('.empty-state')?.remove();

    // Idempotente: se esta conquista já está no quadro, não carimba de novo.
    // (o quadro também é populado pelo Dashboard a partir do banco, e havia
    //  demos do console carimbando o mesmo título → cards duplicados)
    const chave = String(c.id ?? c.titulo ?? '');
    if (chave && quadro.querySelector(`[data-cq-chave="${CSS.escape(chave)}"]`)) return;
    const titulo = (c.titulo || '').trim().toLowerCase();
    if (titulo) {
      const jaTem = [...quadro.querySelectorAll('.conquista-mini-nome')]
        .some(el => el.textContent.trim().toLowerCase() === titulo);
      if (jaTem) return;
    }

    const card = document.createElement('div');
    card.className = 'conquista-mini cq-carimbo';
    card.dataset.cqChave = chave;
    card.innerHTML = `
      <div class="cq-nevoa"></div>
      ${this.miniMedalha(c)}
      <div class="conquista-mini-info">
        <div class="conquista-mini-nome">${c.titulo || 'Conquista'}</div>
        <div class="conquista-mini-desc">${c.descricao || ''}</div>
      </div>`;
    quadro.prepend(card);
    // Som do carimbo no momento do impacto
    setTimeout(() => { if (typeof SFX !== 'undefined') SFX.play('carimbo'); }, 380);
  },
};

// ── Spark Effect ───────────────────────────────────────────
function createSparks(x, y, count = 8) {
  for (let i = 0; i < count; i++) {
    const spark = document.createElement('div');
    spark.className = 'spark';
    const angle  = Math.random() * Math.PI * 2;
    const dist   = Math.random() * 40 + 20;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    spark.style.cssText = `
      left:${x}px; top:${y}px;
      --dx:${dx}px; --dy:${dy}px;
      background:${Math.random() > 0.5 ? 'var(--gold-bright)' : 'var(--green-done)'};
    `;
    document.body.appendChild(spark);
    setTimeout(() => spark.remove(), 700);
  }
}

// ── Mission Complete Effect ────────────────────────────────
function missionComplete(checkboxEl, xp, moedas) {
  const rect = checkboxEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top  + rect.height / 2;
  createSparks(cx, cy);
  XPFloat.showAtElement(checkboxEl, xp, moedas);
  Particles.burst(cx, cy, 15, 'rgba(16,185,129,');
}

// ── Inicialização ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Particles.init();
});

window.Particles   = Particles;
window.LevelUp     = LevelUp;
window.Ascensao    = Ascensao;
window.XPFloat     = XPFloat;
window.ConquistaFX = ConquistaFX;
window.missionComplete = missionComplete;
window.createSparks = createSparks;
