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
const LevelUp = {
  show(nivel, rank, titulo, moedasBonus) {
    const overlay = document.getElementById('level-up-overlay');
    if (!overlay) return;

    overlay.innerHTML = `
      <div class="level-up-backdrop"></div>
      <div class="level-up-content">
        <span class="level-up-title">✨ LEVEL UP! ✨</span>
        <div class="level-up-rank" style="margin-top:1rem">
          Nível ${nivel} — <strong>${rank}</strong>
        </div>
        <div class="level-up-titulo">"${titulo}"</div>
        <div style="margin-top:1rem; font-family:var(--font-section); color:var(--gold-xp); font-size:1rem;">
          💰 +${moedasBonus} Mana Coins de bônus!
        </div>
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

  // Verificar e exibir level-ups do resultado da API
  processarResultado(resultado) {
    if (!resultado) return;
    const lu = resultado.level_ups || [];
    let delay = 0;
    for (const l of lu) {
      setTimeout(() => {
        LevelUp.show(l.nivel, l.rank, l.titulo, l.moedas_bonus);
      }, delay);
      delay += 4000;
    }
    const cq = resultado.conquistas || [];
    for (const c of cq) {
      setTimeout(() => ConquistaFX.show(c), delay);
      delay += 1500;
    }
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

// ── Conquista Toast ────────────────────────────────────────
const ConquistaFX = {
  show(conquista) {
    let container = document.getElementById('conquista-toast');
    if (!container) {
      container = document.createElement('div');
      container.id = 'conquista-toast';
      document.body.appendChild(container);
    }

    const item = document.createElement('div');
    item.className = 'conquista-item';
    item.innerHTML = `
      <div class="conquista-icon">${conquista.icone || '🏆'}</div>
      <div class="conquista-info">
        <div class="conquista-title">🎉 Conquista Desbloqueada!</div>
        <div class="conquista-desc">${conquista.titulo}</div>
        ${conquista.xp_bonus ? `<div style="font-size:.75rem;color:var(--gold-xp);margin-top:.2rem">+${conquista.xp_bonus} XP</div>` : ''}
      </div>
    `;
    container.appendChild(item);
    setTimeout(() => item.remove(), 5000);
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
window.XPFloat     = XPFloat;
window.ConquistaFX = ConquistaFX;
window.missionComplete = missionComplete;
window.createSparks = createSparks;
