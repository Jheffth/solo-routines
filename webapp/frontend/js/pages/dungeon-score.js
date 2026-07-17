/* ============================================================
   dungeon-score.js — 📜 Crônica do Portão
   Score permanente da dungeon: tudo que foi feito (e deixado
   de fazer) lá dentro, com filtros. Acessível de fora (card)
   e de dentro (HUD do interior).
   ============================================================ */

const DungeonScore = {
  _dungeonId: null,
  _dados: null,
  _filtros: { preset: '30', inicio: null, fim: null, status: '', natureza: '', apenas_falhas: false },

  DIAS: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'],
  MESES: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
  NAT_ICO: { PADRAO: '⚔️', AGENDADA: '🕒', RESISTENCIA: '⏳', EVENTO_ALEATORIO: '⚡', BEM_ESTAR: '💧', FLAVOR: '👁' },

  async abrir(dungeon) {
    this._dungeonId = dungeon.id || dungeon;
    this._filtros = { preset: '30', inicio: null, fim: null, status: '', natureza: '', apenas_falhas: false };
    this._garantirDOM();

    const el = document.getElementById('dg-score');
    // Tema da dungeon
    el.className = 'dg-score';
    if (dungeon.categoria) {
      const cat = dungeon.categoria.normalize('NFD').replace(/[̀-ͯ]/g, '');
      el.classList.add('dg-theme-' + cat, 'dg-rank-' + (dungeon.rank || 'E'));
    }
    el.classList.add('on');
    document.body.style.overflow = 'hidden';
    await this._carregar();
  },

  fechar() {
    document.getElementById('dg-score')?.classList.remove('on');
    // Se o interior estiver aberto por baixo, mantém o scroll travado
    if (!document.getElementById('dungeon-interior')?.classList.contains('on')) {
      document.body.style.overflow = '';
    }
  },

  /* ── Fetch com filtros ─────────────────────────────────── */
  _rangeDoPreset() {
    const f = this._filtros;
    if (f.preset === 'dia')    return { inicio: f.dia, fim: f.dia };   // um dia exato
    if (f.preset === 'custom') return { inicio: f.inicio, fim: f.fim };
    if (f.preset === 'tudo') return { inicio: null, fim: null };
    const dias = parseInt(f.preset) || 30;
    const ini = new Date(); ini.setDate(ini.getDate() - dias + 1);
    const iso = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    return { inicio: iso(ini), fim: null };
  },

  async _carregar() {
    const corpo = document.getElementById('dg-score-corpo');
    corpo.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';
    try {
      const range = this._rangeDoPreset();
      this._dados = await API.dungeons.score(this._dungeonId, {
        inicio: range.inicio, fim: range.fim,
        status: this._filtros.status,
        natureza: this._filtros.natureza,
        apenas_falhas: this._filtros.apenas_falhas,
      });
      this._render();
    } catch (err) {
      corpo.innerHTML = `<div class="dg-empty"><div class="dg-empty-icon">⚠️</div>A Crônica resistiu: ${err.message || err}</div>`;
    }
  },

  /* ── Render ────────────────────────────────────────────── */
  _render() {
    const { dungeon: d, resumo: r, sessoes } = this._dados;

    // Cabeçalho
    document.getElementById('dg-score-id').innerHTML = `
      <div class="dg-hud-icon" style="width:52px;height:52px;font-size:1.6rem">${d.icone || '🌀'}</div>
      <div style="min-width:0">
        <div class="dg-score-titulo">Crônica do Portão</div>
        <div class="dg-score-sub">${d.titulo}
          <span class="dg-rank-badge dg-badge-${d.rank}" style="width:1.5rem;height:1.5rem;font-size:.75rem;vertical-align:middle">${d.rank}</span>
          ${d.streak_atual > 0 ? `<span class="dg-streak" style="margin-left:.4rem">🔥 ${d.streak_atual} dias</span>` : ''}
        </div>
      </div>`;

    // Painel de estatísticas
    const fmtTempo = min => {
      const h = Math.floor(min / 60);
      return h > 0 ? `${h}h${String(min % 60).padStart(2, '0')}` : `${min}m`;
    };
    const rankBars = ['S', 'A', 'B', 'C', 'D', 'F'].map(k => {
      const n = r.ranks[k] || 0;
      const max = Math.max(1, ...Object.values(r.ranks));
      return `
      <div class="dg-rankbar" title="${n} sessõe(s) rank ${k}">
        <div class="dg-rankbar-fill dg-rb-${k}" style="height:${Math.max(4, n / max * 46)}px"></div>
        <div class="dg-rankbar-lbl dg-badge-${k}" style="border:none;background:none;width:auto;height:auto">${k}</div>
        <div class="dg-rankbar-n">${n}</div>
      </div>`;
    }).join('');

    document.getElementById('dg-score-stats').innerHTML = `
      <div class="dg-stat-chip"><div class="v">${r.sessoes_total}</div><div class="k">Sessões</div></div>
      <div class="dg-stat-chip"><div class="v" style="color:#34d399">${r.taxa_clear}%</div><div class="k">Taxa de clear</div></div>
      <div class="dg-stat-chip"><div class="v gold">+${r.xp_total}</div><div class="k">XP ganho</div></div>
      <div class="dg-stat-chip"><div class="v" style="color:var(--red-crit)">−${r.xp_perdido_total}</div><div class="k">XP perdido</div></div>
      <div class="dg-stat-chip"><div class="v cyan">+${r.moedas_total}</div><div class="k">Moedas</div></div>
      <div class="dg-stat-chip"><div class="v">${fmtTempo(r.tempo_total_min)}</div><div class="k">Tempo dentro</div></div>
      <div class="dg-stat-chip"><div class="v" style="color:#34d399">${r.missoes_concluidas}</div><div class="k">Missões ✔</div></div>
      <div class="dg-stat-chip"><div class="v" style="color:var(--red-crit)">${r.missoes_falhadas}</div><div class="k">Falhadas</div></div>
      <div class="dg-stat-chip"><div class="v" style="color:var(--gold-bright)">⚡${r.eventos_capturados}</div><div class="k">Eventos</div></div>
      <div class="dg-rankbars">${rankBars}</div>`;

    // Timeline
    const corpo = document.getElementById('dg-score-corpo');
    if (!sessoes.length) {
      corpo.innerHTML = `<div class="dg-empty" style="padding:2.5rem 1rem">
        <div class="dg-empty-icon">📜</div>
        <div>Nenhum registro neste período com esses filtros.</div></div>`;
      return;
    }
    corpo.innerHTML = sessoes.map((s, i) => this._sessaoHTML(s, i)).join('');
    corpo.querySelectorAll('[data-sc-toggle]').forEach(h =>
      h.addEventListener('click', () => h.closest('.dg-sc-sessao').classList.toggle('aberta')));
  },

  _sessaoHTML(s, i) {
    const dt = new Date(s.data + 'T12:00:00');
    const diaSem = this.DIAS[(dt.getDay() + 6) % 7];
    const dataFmt = `${dt.getDate()} ${this.MESES[dt.getMonth()]} ${dt.getFullYear()}`;
    const hora = iso => iso ? new Date(iso).toTimeString().slice(0, 5) : '--:--';

    const stChip = {
      CONCLUIDA:  `<span class="dg-exec-tag" style="color:#34d399;border:1px solid rgba(16,185,129,.4);background:rgba(16,185,129,.07)">✔ Clear</span>`,
      FRACASSADA: `<span class="dg-exec-tag exp" style="color:var(--red-crit);border-color:rgba(239,68,68,.4);background:rgba(239,68,68,.07)">☠ No-show</span>`,
      CANCELADA:  `<span class="dg-exec-tag can">✕ Cancelada</span>`,
      ATIVA:      `<span class="dg-exec-tag wait">⚔ Em andamento</span>`,
      PENDENTE:   `<span class="dg-exec-tag can">— Pendente</span>`,
    }[s.status] || '';

    const missoes = (s.missoes || []).map(e => {
      const m = e.missao;
      const ico = { CONCLUIDA: '✔', CANCELADA: '✕', EXPIRADA: '⌛', PENDENTE: '·', EM_PROGRESSO: '▶', PAUSADA: '⏸' }[e.status] || '·';
      const cor = e.status === 'CONCLUIDA' ? '#34d399'
                : (e.status === 'CANCELADA' || e.status === 'EXPIRADA') ? 'var(--red-crit)'
                : 'var(--text-muted)';
      const pontos = e.xp_ganho > 0 ? `<span style="color:var(--gold-bright)">+${e.xp_ganho} XP</span>`
                   : e.xp_perdido > 0 ? `<span style="color:var(--red-crit)">−${e.xp_perdido} XP</span>`
                   : '<span style="color:var(--text-dim)">—</span>';
      return `
      <div class="dg-sc-missao">
        <span class="st" style="color:${cor}">${ico}</span>
        <span class="ico">${m.icone || this.NAT_ICO[m.natureza] || '⚔️'}</span>
        <span class="titulo" style="${e.status === 'CONCLUIDA' ? '' : e.status === 'CANCELADA' || e.status === 'EXPIRADA' ? 'color:var(--text-muted);text-decoration:line-through' : 'color:var(--text-muted)'}">${m.titulo || '(sussurro)'}</span>
        <span class="nat">${this.NAT_ICO[m.natureza] || ''}</span>
        <span class="hora">${e.concluida_em ? hora(e.concluida_em) : '—'}</span>
        <span class="pts">${pontos}</span>
      </div>`;
    }).join('');

    return `
    <div class="dg-sc-sessao ${i === 0 ? 'aberta' : ''}">
      <div class="dg-sc-head" data-sc-toggle>
        <div class="dg-sc-data">
          <div class="dia">${diaSem}</div>
          <div class="data">${dataFmt}</div>
        </div>
        ${s.rank_obtido ? `<span class="dg-rank-badge dg-badge-${s.rank_obtido}" style="width:1.9rem;height:1.9rem;font-size:.9rem">${s.rank_obtido}</span>` : '<span style="width:1.9rem"></span>'}
        ${stChip}
        <span class="dg-sc-janela">🕐 ${hora(s.entrada_em)} → ${hora(s.saida_em)}${s.atraso_minutos > 0 ? ` <span style="color:var(--red-crit)">(+${s.atraso_minutos}min)</span>` : ''}</span>
        <span class="dg-sc-pts">
          ${s.xp_ganho > 0 ? `<span style="color:var(--gold-bright)">+${s.xp_ganho}</span>` : ''}
          ${s.xp_perdido > 0 ? `<span style="color:var(--red-crit)">−${s.xp_perdido}</span>` : ''}
          ${s.moedas_ganhas > 0 ? `<span style="color:var(--cyan-glow)">💰${s.moedas_ganhas}</span>` : ''}
        </span>
        <span class="dg-sc-seta">▾</span>
      </div>
      <div class="dg-sc-corpo-missoes">
        ${missoes || '<div style="font-size:.75rem;color:var(--text-muted);padding:.4rem .8rem">Sem registros de missão nesta sessão (com os filtros atuais).</div>'}
      </div>
    </div>`;
  },

  /* ── DOM (uma vez) ─────────────────────────────────────── */
  _garantirDOM() {
    if (document.getElementById('dg-score')) return;
    const el = document.createElement('div');
    el.id = 'dg-score';
    el.className = 'dg-score';
    el.innerHTML = `
      <div class="dg-score-box">
        <div class="dg-score-head">
          <div class="dg-hud-id" id="dg-score-id" style="flex:1;min-width:0"></div>
          <button class="dg-btn-sair" id="dg-score-fechar" style="flex-shrink:0">✕ Fechar</button>
        </div>
        <div class="dg-score-stats" id="dg-score-stats"></div>
        <div class="dg-score-filtros">
          <select id="dg-sc-preset" class="dg-sc-select">
            <option value="7">Últimos 7 dias</option>
            <option value="30" selected>Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="tudo">Tudo</option>
            <option value="dia">📅 Um dia específico...</option>
            <option value="custom">Período custom...</option>
          </select>
          <span id="dg-sc-wrap-dia" style="display:none">
            <input type="date" id="dg-sc-dia" class="dg-sc-select" title="Escolha o dia que quer revisitar">
          </span>
          <span id="dg-sc-custom" style="display:none;gap:.35rem;align-items:center">
            <input type="date" id="dg-sc-ini" class="dg-sc-select">
            <span style="color:var(--text-muted)">→</span>
            <input type="date" id="dg-sc-fim" class="dg-sc-select">
          </span>
          <select id="dg-sc-status" class="dg-sc-select">
            <option value="">Todas as sessões</option>
            <option value="CONCLUIDA">✔ Clears</option>
            <option value="FRACASSADA">☠ No-shows</option>
            <option value="CANCELADA">✕ Canceladas</option>
          </select>
          <select id="dg-sc-natureza" class="dg-sc-select">
            <option value="">Todas as missões</option>
            <option value="PADRAO">⚔️ Padrão</option>
            <option value="AGENDADA">🕒 Agendadas</option>
            <option value="RESISTENCIA">⏳ Resistência</option>
            <option value="EVENTO_ALEATORIO">⚡ Eventos</option>
            <option value="BEM_ESTAR">💧 Bem-estar</option>
          </select>
          <label class="dg-sc-toggle" title="Mostrar apenas o que ficou para trás">
            <input type="checkbox" id="dg-sc-falhas">
            <span>☠ Só o que deixei de fazer</span>
          </label>
        </div>
        <div class="dg-score-corpo" id="dg-score-corpo"></div>
      </div>`;
    document.body.appendChild(el);

    // Binds
    document.getElementById('dg-score-fechar').addEventListener('click', () => this.fechar());
    el.addEventListener('click', e => { if (e.target === el) this.fechar(); });

    const aplicar = () => {
      this._filtros.preset   = document.getElementById('dg-sc-preset').value;
      this._filtros.dia      = document.getElementById('dg-sc-dia').value || null;
      this._filtros.inicio   = document.getElementById('dg-sc-ini').value || null;
      this._filtros.fim      = document.getElementById('dg-sc-fim').value || null;
      this._filtros.status   = document.getElementById('dg-sc-status').value;
      this._filtros.natureza = document.getElementById('dg-sc-natureza').value;
      this._filtros.apenas_falhas = document.getElementById('dg-sc-falhas').checked;
      document.getElementById('dg-sc-wrap-dia').style.display =
        this._filtros.preset === 'dia' ? 'inline-flex' : 'none';
      document.getElementById('dg-sc-custom').style.display =
        this._filtros.preset === 'custom' ? 'inline-flex' : 'none';
      // Um dia específico sem data escolhida ainda: espera o usuário escolher
      if (this._filtros.preset === 'dia' && !this._filtros.dia) return;
      this._carregar();
    };
    ['dg-sc-preset', 'dg-sc-dia', 'dg-sc-ini', 'dg-sc-fim', 'dg-sc-status', 'dg-sc-natureza', 'dg-sc-falhas']
      .forEach(id => document.getElementById(id).addEventListener('change', aplicar));
  },
};

window.DungeonScore = DungeonScore;
