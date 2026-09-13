/* ══════════════════════════════════════════════════════════════════
   O SELO DO RODAPÉ — o que está no ar, dito sem rodeio.

   O QUE ESTAVA ERRADO AQUI

   Havia uma tabela traduzindo o ambiente para um rótulo:

       production: { label: 'RENDER' },
       prod:       { label: 'RENDER' },

   O backend respondia "production", certinho. Quem mentia era esta linha:
   ela devolvia o nome do HOSPEDEIRO ANTIGO. O projeto migrou para o Contabo
   e o rodapé continuou anunciando Render, porque ninguém traduz de novo um
   rótulo que já está escrito.

   A lição está na distinção que a tabela apagava: `ambiente` é o REGIME
   (produção ou desenvolvimento) e `hospedeiro` é a CASA (Contabo, Render,
   a sua máquina). Eram sinônimos enquanto existiu um servidor só. Agora são
   dois campos, e o front não inventa nenhum dos dois — mostra o que o
   servidor mandou.

   O SELO TAMBÉM DENUNCIA A SI MESMO. Se o backend disser que não há selo
   (`selar_build.py` não rodou antes do deploy), o rodapé fica ÂMBAR e
   escreve "sem selo" em vez de um número bonito. Um selo de versão que
   inventa versão é pior do que nenhum: foi assim que "1.6.0" ficou meses no
   ar com o VERSION marcando 1.8.0.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* Só o REGIME. O nome da casa vem do servidor, nunca daqui — foi
     justamente uma casa cravada em código que criou o bug do "RENDER". */
  const REGIME = {
    dev:        { bg: 'rgba(16,185,129,.15)',  cor: '#10b981', rotulo: 'LOCAL' },
    local:      { bg: 'rgba(16,185,129,.15)',  cor: '#10b981', rotulo: 'LOCAL' },
    production: { bg: 'rgba(251,191,36,.15)',  cor: '#fbbf24', rotulo: 'PRODUÇÃO' },
    producao:   { bg: 'rgba(251,191,36,.15)',  cor: '#fbbf24', rotulo: 'PRODUÇÃO' },
    prod:       { bg: 'rgba(251,191,36,.15)',  cor: '#fbbf24', rotulo: 'PRODUÇÃO' },
    staging:    { bg: 'rgba(59,130,246,.15)',  cor: '#3b82f6', rotulo: 'HOMOLOG' },
  };

  const ALERTA = { bg: 'rgba(245,158,11,.18)', cor: '#f59e0b' };

  async function carregarVersao() {
    const txtEl = document.getElementById('version-text');
    const envEl = document.getElementById('version-env');
    const shaEl = document.getElementById('version-sha');
    if (!txtEl) return;

    try {
      const resp = await fetch('/api/versao/', { credentials: 'include' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const d = await resp.json();

      const semSelo = !d.selado || d.versao === 'sem selo';

      /* ── A versão ───────────────────────────────────────────────
         Sem selo, o rodapé NÃO escreve número. Escrever um número
         plausível aqui é exatamente o erro que estamos corrigindo. */
      txtEl.textContent = semSelo ? 'sem selo' : `v${d.versao}`;
      txtEl.style.color = semSelo ? ALERTA.cor : 'var(--text-secondary,#94a3b8)';

      /* ── O regime, e só o regime ────────────────────────────────
         Ambiente desconhecido vira o próprio texto em maiúsculas, não
         um chute: se amanhã aparecer "homolog2", o rodapé diz
         "HOMOLOG2" em vez de fingir que é produção. */
      const amb = String(d.ambiente || 'dev').toLowerCase();
      const cfg = REGIME[amb] || {
        bg: 'rgba(100,116,139,.15)', cor: '#64748b', rotulo: amb.toUpperCase(),
      };

      /* ── A casa ─────────────────────────────────────────────────
         Vem do backend (`HOSPEDEIRO` no compose). Se o servidor não
         disser onde está, o rodapé cala — em vez de repetir o último
         hospedeiro que alguém digitou aqui dentro. */
      const casa = (d.hospedeiro || '').trim().toUpperCase();

      if (envEl) {
        envEl.textContent = casa ? `${cfg.rotulo} · ${casa}` : cfg.rotulo;
        envEl.style.background = cfg.bg;
        envEl.style.color      = cfg.cor;
        envEl.style.border     = `1px solid ${cfg.cor}44`;
      }

      /* ── O commit ───────────────────────────────────────────────
         "sem selo" não vira "#sem selo": um hash falso com cerquilha
         parece hash de verdade. O sufixo "+" marca árvore suja — o
         que subiu tem coisa além do commit. */
      if (shaEl) {
        if (semSelo || !d.sha || d.sha === 'sem selo') {
          shaEl.textContent = '';
        } else {
          shaEl.textContent = `#${d.sha}${d.sujo ? '+' : ''}`;
          shaEl.style.color = d.sujo ? ALERTA.cor : 'var(--text-muted,#64748b)';
        }
      }

      /* ── O balão ao passar o cursor ─────────────────────────────── */
      const badge = document.getElementById('version-badge');
      if (badge) {
        const ts = d.timestamp ? new Date(d.timestamp).toLocaleString('pt-BR') : '?';
        const linhas = [
          `Solo Routines ${semSelo ? '(sem selo de build)' : d.versao}`,
          `Regime: ${cfg.rotulo}`,
          casa ? `Hospedeiro: ${casa}` : 'Hospedeiro: não informado',
          `Commit: ${semSelo ? 'não selado' : d.sha + (d.sujo ? ' (+ alterações não commitadas)' : '')}`,
          d.ramo && d.ramo !== '?' ? `Ramo: ${d.ramo}` : null,
          `Servidor: ${ts}`,
        ].filter(Boolean);

        if (semSelo) {
          linhas.push('');
          linhas.push('Rode scripts/selar_build.py antes do deploy');
          linhas.push('para o rodapé saber qual commit está no ar.');
        }
        badge.title = linhas.join('\n');
      }

    } catch (e) {
      txtEl.textContent = 'v?';
      console.warn('[version.js] Não foi possível carregar versão:', e.message);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(carregarVersao, 800));
  } else {
    setTimeout(carregarVersao, 800);
  }

  window.SoloVersion = { recarregar: carregarVersao };
})();
