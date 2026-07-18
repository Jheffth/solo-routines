/* ============================================================
   ascensao.js — REFERÊNCIA da Ascensão (level-up cerimonial)
   Regra central: N level-ups = UMA cerimônia (contador rolando).
   mostrar() retorna Promise -> permite encadear a Cerimônia depois.
   Dependências: Particles.burst, SFX.play('levelup'), ascensao.css
   ============================================================ */

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

window.Ascensao = Ascensao;
