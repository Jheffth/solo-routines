/* ============================================================
   gerencial.js — Solo Routines
   Painel Admin: stats, usuarios, config visual, logs
   ============================================================ */

const Gerencial = {
  _configs: {},
  _fontes: [
    { nome: 'Cinzel Decorative', valor: "'Cinzel Decorative', serif" },
    { nome: 'Orbitron',          valor: "'Orbitron', sans-serif" },
    { nome: 'Rajdhani',          valor: "'Rajdhani', sans-serif" },
    { nome: 'Inter',             valor: "'Inter', sans-serif" },
    { nome: 'Exo 2',             valor: "'Exo 2', sans-serif" },
    { nome: 'Oxanium',           valor: "'Oxanium', monospace" }
  ],

  async carregar() {
    this._popularSelectsFontes();
    this._bindConfigPreview();
    this._bindSalvarConfig();
    this._bindRefresh();
    this._bindNovoUsuario();

    await Promise.all([
      this.carregarStats(),
      this.carregarUsuarios(),
      this.carregarLogs(),
      this.carregarConfigs()
    ]);
  },

  // ── Stats gerais ─────────────────────────────────────────
  async carregarStats() {
    const cont = document.getElementById('gerencial-stats');
    if (!cont) return;
    try {
      const stats = await API.get('/gerencial/stats');
      if (!stats) return;

      const itens = [
        { icon: '&#128101;', label: 'Usuários',        valor: stats.total_usuarios   || 0 },
        { icon: '&#128260;', label: 'Rotinas Ativas',  valor: stats.total_rotinas    || 0 },
        { icon: '&#128203;', label: 'Tarefas',         valor: stats.total_tarefas    || 0 },
        { icon: '&#9889;',   label: 'Execuções Total', valor: stats.total_execucoes  || 0 }
      ];

      cont.innerHTML = itens.map(i => `
        <div class="gerencial-stat">
          <div class="gerencial-stat-icon">${i.icon}</div>
          <div class="gerencial-stat-value">${i.valor}</div>
          <div class="gerencial-stat-label">${i.label}</div>
        </div>
      `).join('');
    } catch (err) {
      console.error('[Gerencial] Erro stats:', err);
    }
  },

  // ── Lista de usuários ─────────────────────────────────────
  async carregarUsuarios() {
    const tbody = document.getElementById('tbody-usuarios');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:1rem"><div class="loading-spinner" style="margin:auto"></div></td></tr>';

    try {
      const lista = await API.get('/gerencial/usuarios');
      if (!lista || !lista.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">Nenhum usuário encontrado</td></tr>';
        return;
      }

      tbody.innerHTML = lista.map(u => {
        const isArq   = u.nivel_acesso === 'Arquiteto';
        const rankStr = u.nivel_acesso || 'User';
        const chipCor = isArq ? '#f59e0b' : u.nivel_acesso === 'Admin' ? '#a855f7' : '#64748b';
        return `
        <tr>
          <td style="font-weight:600;color:var(--text-primary)">${u.nome || '-'}</td>
          <td style="color:var(--text-muted)">${u.login || '-'}</td>
          <td><span style="
            font-family:var(--font-section);font-size:.7rem;font-weight:700;
            padding:.2rem .6rem;border-radius:100px;letter-spacing:.08em;
            background:${chipCor}22;border:1px solid ${chipCor}66;color:${chipCor}
          ">${rankStr}</span></td>
          <td style="color:var(--purple-glow);font-weight:600">${u.nivel_atual || 1}</td>
          <td style="color:var(--gold-xp)">${(u.xp_total || 0).toLocaleString('pt-BR')}</td>
          <td style="color:var(--gold-xp);font-weight:600">${(u.moedas || 0).toLocaleString('pt-BR')}</td>
          <td>
            <div style="display:flex;gap:.4rem">
              ${!isArq ? `
              <button class="miss-action-btn" onclick="Gerencial.ajustarXP(${u.id},'${u.nome}')" title="Ajustar XP">&#9889;</button>
              <button class="miss-action-btn" onclick="Gerencial.ajustarMoedas(${u.id},'${u.nome}')" title="Ajustar Moedas">&#128176;</button>
              <button class="miss-action-btn delete" onclick="Gerencial.excluirUsuario(${u.id},'${u.nome}')" title="Excluir">&#128465;</button>
              ` : `<span style="color:var(--gold-xp);font-size:.7rem">&#9888; Arquiteto</span>`}
            </div>
          </td>
        </tr>`;
      }).join('');
    } catch (err) {
      console.error('[Gerencial] Erro usuários:', err);
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#f87171">Erro ao carregar usuários — ' + (err.message || err) + '</td></tr>';
    }
  },

  // ── Logs de auditoria ─────────────────────────────────────
  async carregarLogs() {
    const tbody = document.getElementById('tbody-logs');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:1rem"><div class="loading-spinner" style="margin:auto"></div></td></tr>';

    try {
      const logs = await API.get('/gerencial/logs?limit=50');
      if (!logs || !logs.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">Sem registros de log</td></tr>';
        return;
      }

      tbody.innerHTML = logs.map(l => `
        <tr>
          <td style="color:var(--text-muted);white-space:nowrap;font-size:.8rem">${this._fmtDateTime(l.criado_em || l.data)}</td>
          <td style="color:var(--cyan-skill)">${l.usuario_nome || l.usuario || '-'}</td>
          <td><span style="
            font-family:var(--font-section);font-size:.68rem;padding:.15rem .5rem;
            border-radius:100px;background:rgba(124,58,237,.15);
            border:1px solid rgba(124,58,237,.3);color:var(--purple-glow)
          ">${l.acao || l.tipo || '-'}</span></td>
          <td style="color:var(--text-muted);font-size:.8rem">${l.detalhes || l.descricao || ''}</td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('[Gerencial] Erro logs:', err);
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#f87171">Erro ao carregar logs — ' + (err.message || err) + '</td></tr>';
    }
  },

  // ── Configurações visuais ─────────────────────────────────
  async carregarConfigs() {
    try {
      const configs = await API.get('/configuracoes/');
      if (!configs) return;
      this._configs = configs;

      const set = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined && val !== null) el.value = val;
      };

      set('cfg-logo',         configs.logo_url    || configs.logo    || '');
      set('cfg-app-nome',     configs.app_nome    || 'Solo Routines');
      set('cfg-cor-destaque', configs.cor_destaque || '#7c3aed');
      set('cfg-fonte-titulo', configs.fonte_titulo || this._fontes[0].valor);
      set('cfg-fonte-secao',  configs.fonte_secao  || this._fontes[2].valor);
      set('cfg-fonte-body',   configs.fonte_body   || this._fontes[3].valor);

      const hexEl = document.getElementById('cfg-cor-hex');
      if (hexEl) hexEl.textContent = configs.cor_destaque || '#7c3aed';
    } catch (_) {}
  },

  // ── Ajustar XP ───────────────────────────────────────
  async ajustarXP(id, nome) {
    const ok = await SoloDialog.confirm(
      `Ajustar XP de <strong>${nome}</strong>:<br><br>
       <input id="solo-ajuste-val" type="number" placeholder="Ex: 100 ou -50" style="
         width:100%;padding:.5rem .75rem;background:rgba(124,58,237,.1);
         border:1px solid rgba(124,58,237,.4);border-radius:.5rem;
         color:#e2e8f0;font-family:var(--font-section);font-size:.9rem;
         outline:none;margin-top:.25rem
       ">
       <div style="font-size:.7rem;color:#64748b;margin-top:.35rem">Positivo para adicionar, negativo para remover</div>`,
      { titulo: 'Ajustar XP', icon: '⚡', tipo: 'info', btnOk: 'Aplicar', btnCancel: 'Cancelar' }
    );
    if (!ok) return;
    const xp_ajuste = parseInt(document.getElementById('solo-ajuste-val')?.value);
    if (isNaN(xp_ajuste)) return SoloDialog.toast('Valor inválido', 'error');
    try {
      await API.put(`/gerencial/usuarios/${id}`, { xp_ajuste });
      await this.carregarUsuarios();
      SoloDialog.toast(`XP de ${nome} ajustado em ${xp_ajuste > 0 ? '+' : ''}${xp_ajuste}`, 'success');
    } catch (err) {
      SoloDialog.toast('Erro: ' + (err.message || err), 'error');
    }
  },

  // ── Ajustar Moedas ─────────────────────────────────────
  async ajustarMoedas(id, nome) {
    const ok = await SoloDialog.confirm(
      `Ajustar Mana Coins de <strong>${nome}</strong>:<br><br>
       <input id="solo-ajuste-moedas" type="number" placeholder="Ex: 50 ou -20" style="
         width:100%;padding:.5rem .75rem;background:rgba(245,158,11,.08);
         border:1px solid rgba(245,158,11,.35);border-radius:.5rem;
         color:#e2e8f0;font-family:var(--font-section);font-size:.9rem;
         outline:none;margin-top:.25rem
       ">
       <div style="font-size:.7rem;color:#64748b;margin-top:.35rem">Positivo para adicionar, negativo para remover</div>`,
      { titulo: 'Ajustar Mana Coins', icon: '🪙', tipo: 'info', btnOk: 'Aplicar', btnCancel: 'Cancelar' }
    );
    if (!ok) return;
    const moedas_ajuste = parseInt(document.getElementById('solo-ajuste-moedas')?.value);
    if (isNaN(moedas_ajuste)) return SoloDialog.toast('Valor inválido', 'error');
    try {
      await API.put(`/gerencial/usuarios/${id}`, { moedas_ajuste });
      await this.carregarUsuarios();
      SoloDialog.toast(`Moedas de ${nome} ajustadas em ${moedas_ajuste > 0 ? '+' : ''}${moedas_ajuste}`, 'success');
    } catch (err) {
      SoloDialog.toast('Erro: ' + (err.message || err), 'error');
    }
  },

  // ── Excluir usuário ─────────────────────────────────────
  async excluirUsuario(id, nome) {
    const ok = await SoloDialog.confirm(
      `Excluir usuário <strong style="color:#f87171">${nome}</strong>?<br><br>
       <span style="color:#94a3b8">Esta ação é irreversível.</span>`,
      { titulo: 'Excluir Usuário', icon: '🗑️', tipo: 'error', btnOk: 'Excluir', btnCancel: 'Cancelar' }
    );
    if (!ok) return;
    try {
      await API.delete(`/gerencial/usuarios/${id}`);
      await this.carregarUsuarios();
      await this.carregarStats();
      SoloDialog.toast(`Usuário "${nome}" excluído.`, 'success');
    } catch (err) {
      SoloDialog.toast('Erro ao excluir: ' + (err.message || err), 'error');
    }
  },

  _popularSelectsFontes() {
    ['cfg-fonte-titulo','cfg-fonte-secao','cfg-fonte-body'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = this._fontes.map(f =>
        `<option value="${f.valor}">${f.nome}</option>`
      ).join('');
    });
  },

  _bindConfigPreview() {
    const updatePreview = () => {
      const fTitulo = document.getElementById('cfg-fonte-titulo')?.value || '';
      const fSecao  = document.getElementById('cfg-fonte-secao')?.value || '';
      const fBody   = document.getElementById('cfg-fonte-body')?.value || '';
      const pt = document.getElementById('preview-titulo');
      const ps = document.getElementById('preview-secao');
      const pb = document.getElementById('preview-body');
      if (pt && fTitulo) pt.style.fontFamily = fTitulo;
      if (ps && fSecao)  ps.style.fontFamily = fSecao;
      if (pb && fBody)   pb.style.fontFamily = fBody;
    };
    ['cfg-fonte-titulo','cfg-fonte-secao','cfg-fonte-body'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', updatePreview);
    });
    const corInput = document.getElementById('cfg-cor-destaque');
    const corHex   = document.getElementById('cfg-cor-hex');
    if (corInput) {
      corInput.addEventListener('input', e => {
        const cor = e.target.value;
        if (corHex) corHex.textContent = cor;
        document.documentElement.style.setProperty('--purple-main', cor);
      });
    }
    const nomeInput = document.getElementById('cfg-app-nome');
    if (nomeInput) {
      nomeInput.addEventListener('input', e => {
        const el = document.getElementById('sidebar-app-nome');
        if (el) el.textContent = e.target.value;
      });
    }
  },

  _bindSalvarConfig() {
    const btn = document.getElementById('btn-salvar-config');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Salvando...';
      try {
        const payload = {
          logo_url:     document.getElementById('cfg-logo')?.value || '',
          app_nome:     document.getElementById('cfg-app-nome')?.value || 'Solo Routines',
          cor_destaque: document.getElementById('cfg-cor-destaque')?.value || '#7c3aed',
          fonte_titulo: document.getElementById('cfg-fonte-titulo')?.value || '',
          fonte_secao:  document.getElementById('cfg-fonte-secao')?.value || '',
          fonte_body:   document.getElementById('cfg-fonte-body')?.value || ''
        };
        await API.put('/configuracoes/', payload);
        if (typeof App !== 'undefined') App.aplicarConfig(payload);
        SoloDialog.toast('Configurações salvas com sucesso! ✅', 'success');
      } catch (err) {
        SoloDialog.toast('Erro ao salvar: ' + (err.message || err), 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '&#128190; Salvar Configurações';
      }
    });
  },

  _bindRefresh() {
    document.getElementById('btn-gerencial-refresh')?.addEventListener('click', () => this.carregar());
  },

  _bindNovoUsuario() {
    document.getElementById('btn-novo-usuario')?.addEventListener('click', () => {
      if (typeof Lancador !== 'undefined') Lancador.open('usuario');
    });
  },

  _fmtDateTime(str) {
    if (!str) return '-';
    try {
      return new Date(str).toLocaleString('pt-BR', {
        day:'2-digit', month:'2-digit', year:'numeric',
        hour:'2-digit', minute:'2-digit'
      });
    } catch (_) { return str; }
  }
};