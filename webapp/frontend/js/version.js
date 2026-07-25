/**
 * version.js — Carrega e exibe a versão do servidor no footer.
 * Compara versão local vs Render via SHA do git.
 */
(function() {
  'use strict';

  const ENV_COLORS = {
    dev:        { bg: 'rgba(16,185,129,.15)',  color: '#10b981', label: 'LOCAL' },
    production: { bg: 'rgba(251,191,36,.15)', color: '#fbbf24', label: 'RENDER' },
    prod:       { bg: 'rgba(251,191,36,.15)', color: '#fbbf24', label: 'RENDER' },
    staging:    { bg: 'rgba(59,130,246,.15)', color: '#3b82f6', label: 'STAGE' },
  };

  async function carregarVersao() {
    const txtEl = document.getElementById('version-text');
    const envEl = document.getElementById('version-env');
    const shaEl = document.getElementById('version-sha');
    if (!txtEl) return;

    try {
      const resp = await fetch('/api/versao/', { credentials: 'include' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const d = await resp.json();

      // Versão
      txtEl.textContent = `v${d.versao}`;

      // Ambiente
      const env = (d.ambiente || 'dev').toLowerCase();
      const cfg = ENV_COLORS[env] || { bg: 'rgba(100,116,139,.15)', color: '#64748b', label: env.toUpperCase() };
      envEl.textContent  = cfg.label;
      envEl.style.background = cfg.bg;
      envEl.style.color      = cfg.color;
      envEl.style.border     = `1px solid ${cfg.color}44`;

      // SHA
      if (d.sha && d.sha !== 'unknown') {
        shaEl.textContent = `#${d.sha}`;
      }

      // Tooltip rico
      const badge = document.getElementById('version-badge');
      if (badge) {
        const ts = d.timestamp ? new Date(d.timestamp).toLocaleString('pt-BR') : '?';
        badge.title = `Solo Routines ${d.versao}\nAmbiente: ${cfg.label}\nCommit: ${d.sha}\nServidor: ${ts}`;
      }

    } catch (e) {
      txtEl.textContent = 'v?';
      console.warn('[version.js] Não foi possível carregar versão:', e.message);
    }
  }

  // Carrega ao iniciar (com pequeno delay para não atrasar o app)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(carregarVersao, 800));
  } else {
    setTimeout(carregarVersao, 800);
  }

  // Expõe para uso externo
  window.SoloVersion = { recarregar: carregarVersao };
})();
