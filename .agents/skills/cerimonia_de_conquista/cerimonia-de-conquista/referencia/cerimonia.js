/* ============================================================
   cerimonia.js — REFERÊNCIA da Cerimônia de Conquista
   Copie para o seu projeto e adapte. Dependências:
     - Particles.burst(x, y, n, 'rgba(r,g,b,')  (canvas de partículas)
     - SFX.play('conquista'|'carimbo')          (ver sfx.js)
     - CSS de cerimonia.css
   Exporte no fim: window.ConquistaFX = ConquistaFX;
   ============================================================ */

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

  /* Medalha em miniatura — para os selos permanentes (quadro/perfil) */
  miniMedalha(c, tamanho = 52) {
    return `<span class="cq-medalhinha" style="width:${tamanho}px;height:${tamanho}px">
      ${this._svgMedalha(tamanho)}
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
          ${this._svgMedalha()}
          <div class="cq-ico">${c.icone || '🏆'}</div>
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
    el.innerHTML = `
      <div class="cq-selo-ico">${c.icone || '🏆'}</div>
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

    const card = document.createElement('div');
    card.className = 'conquista-mini cq-carimbo';
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

window.ConquistaFX = ConquistaFX;
