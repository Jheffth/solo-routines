/* ============================================================
   status-window.js — REFERÊNCIA dos comportamentos da Janela de Status
   Copie os métodos para o objeto da sua página (Dashboard, Perfil, ...).
   Requer: css/status-window.css e o HTML de template.html
   ============================================================ */

const StatusWindow = {

  /* ── 1. Cores por rank ─────────────────────────────────── */
  RANK_CORES: {
    'E': '#94a3b8', 'D': '#22d3ee', 'C': '#10b981',
    'B': '#3b82f6', 'A': '#a855f7', 'S': '#fbbf24', 'N': '#fb7185',
  },

  letraRank(classe) {
    const c = (classe || 'E-Rank').toUpperCase();
    if (c.includes('NATIONAL')) return 'N';
    const m = c.match(/\b([EDCBAS])\b|^([EDCBAS])-/);
    return (m && (m[1] || m[2])) || 'E';
  },

  /* Aplica a cor do rank no painel inteiro (borda, anel, selo, aura, partículas) */
  aplicarRank(janelaEl, classe) {
    const letra = this.letraRank(classe);
    const cor = this.RANK_CORES[letra] || '#a855f7';
    janelaEl.style.setProperty('--rank-cor', cor);
    janelaEl.style.setProperty('--rank-aura', cor + '26');
    return { letra, cor };
  },

  /* ── 2. Contagem animada (easeOutCubic) ────────────────── */
  contar(el, alvo, dur = 900) {
    if (!el) return;
    const t0 = performance.now();
    const passo = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(alvo * eased).toLocaleString('pt-BR');
      if (p < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  },

  /* ── 3. Barra de XP (com estado de iminência) ───────────── */
  aplicarXP(barEl, trackEl, xpAtual, xpProx) {
    const pct = Math.min(100, Math.round((xpAtual / (xpProx || 1)) * 100));
    if (barEl) setTimeout(() => { barEl.style.width = pct + '%'; }, 120);
    // >=85% => a barra arde em ouro
    trackEl?.classList.toggle('quase', pct >= 85);
    return pct;
  },

  /* ── 4. Partículas locais reativas ao rank ─────────────── */
  initParticulas(canvasId, qtd = 26) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || canvas.dataset.on) return;
    canvas.dataset.on = '1';
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0;
    const ajustar = () => {
      const r = canvas.getBoundingClientRect();
      W = canvas.width = r.width; H = canvas.height = r.height;
    };
    ajustar();
    window.addEventListener('resize', ajustar);

    const ps = Array.from({ length: qtd }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.6 + .4,
      v: Math.random() * .00035 + .00012,
      a: Math.random() * .5 + .15,
    }));

    const loop = () => {
      if (!canvas.isConnected) return;          // evita vazamento ao trocar de página
      ctx.clearRect(0, 0, W, H);
      const cor = getComputedStyle(canvas.parentElement)
        .getPropertyValue('--rank-cor').trim() || '#a855f7';
      ps.forEach(p => {
        p.y -= p.v;
        if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
        ctx.fillStyle = cor; ctx.globalAlpha = p.a; ctx.fill();
      });
      ctx.globalAlpha = 1;
      requestAnimationFrame(loop);
    };
    loop();
  },

  /* ── 5. Sussurros rotativos na placa ───────────────────── */
  SUSSURROS: [
    'O Sistema observa seu progresso',
    'Todo dia é uma chance de subir de rank',
    'Seu potencial ainda não foi medido',
    'A disciplina é a lâmina mais afiada',
  ],
  iniciarSussurros(elId = 'sys-whisper', intervalo = 9000) {
    const el = document.getElementById(elId);
    if (!el || this._timer) return;
    let i = 0;
    this._timer = setInterval(() => {
      el.classList.add('trocando');                 // CSS: opacity 0 + transition
      setTimeout(() => {
        i = (i + 1) % this.SUSSURROS.length;
        el.textContent = this.SUSSURROS[i];
        el.classList.remove('trocando');
      }, 600);
    }, intervalo);
  },

  /* ── 6. Chip contextual (só existe quando há informação) ── */
  async renderChip(chipId, carregarDados, montar) {
    const chip = document.getElementById(chipId);
    if (!chip) return;
    try {
      const dados = await carregarDados();
      const info = montar(dados);                   // -> {texto, onClick} | null
      if (!info) { chip.style.display = 'none'; return; }
      chip.textContent = info.texto;
      chip.style.display = '';
      chip.onclick = info.onClick;
    } catch (_) { chip.style.display = 'none'; }
  },
};

/* ── Exemplo de uso completo ──────────────────────────────
const janela = document.getElementById('hunter-card');
const { letra, cor } = StatusWindow.aplicarRank(janela, dados.classe);
document.getElementById('dash-rank-selo').textContent = letra;
StatusWindow.contar(document.getElementById('dash-nivel'), dados.nivel_atual, 700);
StatusWindow.contar(document.getElementById('dash-moedas'), dados.moedas);
StatusWindow.aplicarXP(
  document.getElementById('dash-xp-bar'),
  document.querySelector('.hunter-xp-track'),
  dados.xp_atual, dados.xp_proximo_nivel);
StatusWindow.initParticulas('hunter-fx');
StatusWindow.iniciarSussurros();
─────────────────────────────────────────────────────────── */

window.StatusWindow = StatusWindow;
