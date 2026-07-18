/* ============================================================
   perfil.js — Solo Routines
   Página de perfil: hero card + formulário de edição + gráficos
   ============================================================ */

/* ConquistasAnim (legado): agora delega para a Cerimônia de Conquista
   oficial (ConquistaFX, em animations.js) — um único visual no app inteiro. */
window.ConquistasAnim = {
  async showUnlockModal(c) {
    if (typeof ConquistaFX !== 'undefined') ConquistaFX.show(c);
    return Promise.resolve();
  }
};

const Perfil = {
  _dadosCarregados: false,
  _dadosUsuario: null,

  async carregar() {
    try {
      const dados = await API.get('/perfil/');
      if (!dados) return;

      this._dadosUsuario = dados.usuario || null;

      if (dados.usuario)           this.renderHeroCard(dados.usuario);
      if (dados.usuario)           this.renderFormEdicao(dados.usuario);
      if (dados.radar_habilidades) this.renderRadar(dados.radar_habilidades);
      if (dados.xp_mensal)         this.renderXPMensal(dados.xp_mensal);
      if (dados.heatmap)           this.renderHeatmap(dados.heatmap);
      if (dados.conquistas)        this.renderConquistas(dados.conquistas);

      this._dadosCarregados = true;
    } catch (err) {
      console.error('[Perfil] Erro ao carregar:', err);
    }
  },

  // ── Hero card — topo da página ──────────────────────────
  renderHeroCard(dados) {
    const cont = document.getElementById('perfil-hunter-card');
    if (!cont) return;

    const isArquiteto = dados.nivel_acesso === 'Arquiteto';
    const xpAtual     = dados.xp_atual  || dados.xp_total || 0;
    const xpProx      = dados.xp_proximo_nivel || 100;
    const pct         = Math.min(100, Math.round((xpAtual / xpProx) * 100));
    const moedas      = dados.moedas      || 0;
    const nivel       = dados.nivel_atual || 1;
    const nome        = dados.nome  || dados.login || 'Hunter';
    const titulo      = dados.titulo || 'Hunter';
    const streak      = dados.streak_atual || 0;
    const classe      = dados.classe || 'E-Rank';

    const rankColors = { 'N':'#f59e0b','S':'#a855f7','A':'#3b82f6','B':'#10b981','C':'#06b6d4' };
    const rankColor  = rankColors[classe.charAt(0)] || '#7c3aed';

    const avatarHtml = dados.avatar_url
      ? `<img src="${dados.avatar_url}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
      : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:2.5rem;background:linear-gradient(135deg,var(--purple-main),var(--blue-mana))">&#128737;</div>`;

    cont.innerHTML = `
      <div style="
        display:flex;align-items:center;gap:2rem;flex-wrap:wrap;
        background:linear-gradient(135deg,rgba(124,58,237,.1),rgba(6,182,212,.04));
        border:1px solid rgba(124,58,237,.3);border-radius:1.2rem;
        padding:2rem 2.5rem;position:relative;overflow:hidden;
      ">
        <!-- Glow de fundo -->
        <div style="position:absolute;top:-60px;left:-60px;width:250px;height:250px;
          background:radial-gradient(circle,rgba(124,58,237,.18),transparent 70%);pointer-events:none"></div>

        <!-- Avatar -->
        <div class="${dados.nivel_acesso === 'Arquiteto' ? 'chamas-arquiteto' : ''}" style="
          width:90px;height:90px;border-radius:50%;flex-shrink:0;
          border:3px solid ${rankColor};box-shadow:0 0 24px ${rankColor}66;
          overflow:hidden;cursor:pointer;position:relative;
        " id="perfil-avatar-click" title="Clique para trocar foto">
          ${avatarHtml}
          <div style="position:absolute;inset:0;background:rgba(0,0,0,.5);display:flex;
            align-items:center;justify-content:center;opacity:0;transition:.2s;border-radius:50%"
            onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0">
            <span style="font-size:1.5rem">&#128247;</span>
          </div>
        </div>

        <!-- Dados principais -->
        <div style="flex:1;min-width:200px">
          <div style="font-family:var(--font-title);font-size:1.5rem;font-weight:700;
            color:var(--text-primary);letter-spacing:.08em;margin-bottom:.1rem">
            ${nome.toUpperCase()}
          </div>
          <div style="font-family:var(--font-section);font-size:.9rem;
            color:var(--gold-xp);margin-bottom:.6rem;font-style:italic">
            &ldquo;${titulo}&rdquo;
          </div>
          <div style="display:flex;gap:.6rem;align-items:center;flex-wrap:wrap">
            <span style="
              font-family:var(--font-section);font-size:.72rem;font-weight:700;
              letter-spacing:.12em;padding:.3rem .9rem;border-radius:100px;
              border:1.5px solid ${rankColor};color:${rankColor};background:${rankColor}18
            ">${classe}</span>
            ${isArquiteto ? `<span style="
              font-family:var(--font-section);font-size:.68rem;padding:.2rem .7rem;
              border-radius:100px;background:rgba(245,158,11,.15);
              border:1px solid rgba(245,158,11,.5);color:#fbbf24
            ">&#9889; Arquiteto</span>` : ''}
          </div>
        </div>

        <!-- Stats -->
        <div style="display:flex;gap:2.5rem;align-items:center;flex-shrink:0;flex-wrap:wrap">
          <div style="text-align:center">
            <div style="font-family:var(--font-section);font-size:.62rem;color:var(--text-muted);
              letter-spacing:.15em;text-transform:uppercase;margin-bottom:.3rem">NÍVEL</div>
            <div style="font-family:var(--font-title);font-size:2.2rem;font-weight:700;
              color:var(--purple-glow)">${nivel}</div>
          </div>
          <div style="text-align:center">
            <div style="font-family:var(--font-section);font-size:.62rem;color:var(--text-muted);
              letter-spacing:.15em;text-transform:uppercase;margin-bottom:.3rem">MANA COINS</div>
            <div style="font-family:var(--font-title);font-size:2.2rem;font-weight:700;
              color:var(--gold-xp)">${moedas.toLocaleString('pt-BR')}</div>
          </div>
          <div style="text-align:center">
            <div style="font-family:var(--font-section);font-size:.62rem;color:var(--text-muted);
              letter-spacing:.15em;text-transform:uppercase;margin-bottom:.3rem">STREAK</div>
            <div style="font-family:var(--font-title);font-size:2.2rem;font-weight:700;
              color:#f97316">&#128293; ${streak}</div>
          </div>
        </div>
      </div>

      <!-- XP Bar -->
      <div style="margin-top:.75rem;padding:0 .3rem">
        <div style="display:flex;justify-content:space-between;margin-bottom:.35rem">
          <span style="font-family:var(--font-section);font-size:.72rem;color:var(--text-muted)">XP para nível ${nivel + 1}</span>
          <span style="font-family:var(--font-section);font-size:.72rem;color:var(--gold-xp)">${xpAtual.toLocaleString('pt-BR')} / ${xpProx.toLocaleString('pt-BR')} XP</span>
        </div>
        <div class="xp-bar-container"><div class="xp-bar-fill" style="width:${pct}%"></div></div>
      </div>
    `;

    // Clique no avatar → seletor de arquivo local (PC e mobile)
    document.getElementById('perfil-avatar-click')?.addEventListener('click', () => this.escolherFoto());
  },

  // ── Upload de foto local ────────────────────────────────
  escolherFoto() {
    let input = document.getElementById('pf-avatar-file');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.id = 'pf-avatar-file';
      input.accept = 'image/png,image/jpeg,image/gif,image/webp';
      input.style.display = 'none';
      document.body.appendChild(input);
      input.addEventListener('change', () => this._enviarFoto(input));
    }
    input.value = '';
    input.click();
  },

  async _enviarFoto(input) {
    const arquivo = input.files?.[0];
    if (!arquivo) return;
    if (arquivo.size > 5 * 1024 * 1024) {
      SoloDialog.toast('Imagem muito grande — máximo 5 MB.', 'error');
      return;
    }
    try {
      SoloDialog.toast('⏳ Enviando foto...', 'info', 1500);
      const form = new FormData();
      form.append('arquivo', arquivo);
      const resp = await API.perfil.uploadAvatar(form);
      SoloDialog.toast('📷 Foto de perfil atualizada!', 'success');
      // Atualiza avatar em todos os cantos sem recarregar a página
      const url = resp.avatar_url + '?t=' + Date.now();   // quebra cache
      document.querySelectorAll('#dash-avatar, #sidebar-avatar, #perfil-avatar-click').forEach(el => {
        el.innerHTML = `<img src="${url}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      });
      if (this._dadosUsuario) this._dadosUsuario.avatar_url = resp.avatar_url;
      await this.carregar();
    } catch (err) {
      SoloDialog.toast('Erro no upload: ' + (err.message || err), 'error');
    }
  },

  async removerFoto() {
    try {
      await API.delete('/perfil/avatar');
      SoloDialog.toast('Foto removida.', 'info');
      await this.carregar();
    } catch (err) {
      SoloDialog.toast('Erro: ' + (err.message || err), 'error');
    }
  },

  // ── Formulário de edição ────────────────────────────────
  renderFormEdicao(dados) {
    const cont = document.getElementById('perfil-form-edicao');
    if (!cont) return;

    const isArquiteto = dados.nivel_acesso === 'Arquiteto';

    cont.innerHTML = `
      <div style="
        background:var(--bg-card);border:1px solid rgba(124,58,237,.2);
        border-radius:1rem;padding:1.5rem 2rem;margin-top:1.5rem
      ">
        <div style="font-family:var(--font-section);font-size:.8rem;font-weight:700;
          letter-spacing:.12em;text-transform:uppercase;color:var(--purple-glow);
          margin-bottom:1.2rem;display:flex;align-items:center;gap:.5rem">
          &#9998; Editar Informações
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1rem">

          <!-- Nome -->
          <div class="form-group">
            <label class="form-label">Nome de exibição</label>
            <input type="text" id="pf-edit-nome" class="form-input"
              value="${dados.nome || ''}" placeholder="Seu nome">
          </div>

          <!-- Título -->
          <div class="form-group">
            <label class="form-label">Título</label>
            <input type="text" id="pf-edit-titulo" class="form-input"
              value="${dados.titulo || ''}" placeholder="Ex: O Arquiteto do Sistema">
          </div>

          <!-- Classe -->
          <div class="form-group">
            <label class="form-label">Classe / Rank</label>
            <input type="text" id="pf-edit-classe" class="form-input"
              value="${dados.classe || ''}" placeholder="Ex: National Level">
          </div>

          <!-- Foto de Perfil (arquivo local) -->
          <div class="form-group">
            <label class="form-label">Foto de Perfil</label>
            <div style="display:flex;gap:.5rem;align-items:center">
              <button type="button" class="btn btn-sm" onclick="Perfil.escolherFoto()" style="
                font-family:var(--font-section);font-size:.75rem;padding:.5rem .9rem;border-radius:.5rem;
                border:1px solid rgba(124,58,237,.4);background:rgba(124,58,237,.12);
                color:var(--purple-glow);cursor:pointer">
                📷 Escolher do dispositivo
              </button>
              ${dados.avatar_url ? `
              <button type="button" class="btn btn-sm" onclick="Perfil.removerFoto()" style="
                font-family:var(--font-section);font-size:.75rem;padding:.5rem .9rem;border-radius:.5rem;
                border:1px solid rgba(239,68,68,.35);background:rgba(239,68,68,.07);
                color:#f87171;cursor:pointer">
                ✕ Remover
              </button>` : ''}
            </div>
            <div style="font-size:.65rem;color:var(--text-muted);margin-top:.35rem">
              PNG, JPG, GIF ou WEBP · máx. 5 MB · ou clique direto na foto lá em cima
            </div>
          </div>

          ${isArquiteto ? `
          <!-- Nível (Arquiteto) -->
          <div class="form-group">
            <label class="form-label" style="color:var(--purple-glow)">
              &#9889; Nível <span style="font-size:.65rem;color:var(--text-muted)">(Arquiteto)</span>
            </label>
            <input type="number" id="pf-edit-nivel" class="form-input"
              value="${dados.nivel_atual || 1}" min="1" max="9999"
              style="border-color:rgba(168,85,247,.4)">
          </div>

          <!-- Mana Coins (Arquiteto) -->
          <div class="form-group">
            <label class="form-label" style="color:var(--gold-xp)">
              &#128176; Mana Coins <span style="font-size:.65rem;color:var(--text-muted)">(Arquiteto)</span>
            </label>
            <input type="number" id="pf-edit-moedas" class="form-input"
              value="${dados.moedas || 0}" min="0"
              style="border-color:rgba(245,158,11,.4)">
          </div>

          <!-- XP Total (Arquiteto) -->
          <div class="form-group">
            <label class="form-label" style="color:var(--cyan-skill)">
              &#11088; XP Total <span style="font-size:.65rem;color:var(--text-muted)">(Arquiteto)</span>
            </label>
            <input type="number" id="pf-edit-xp" class="form-input"
              value="${dados.xp_total || 0}" min="0"
              style="border-color:rgba(6,182,212,.4)">
          </div>
          ` : ''}

        </div>

        <!-- Botões -->
        <div style="display:flex;gap:.75rem;margin-top:1.5rem;justify-content:flex-end">
          <button class="btn btn-ghost btn-sm" onclick="Perfil.carregar()" style="font-family:var(--font-section)">
            &#8635; Cancelar
          </button>
          <button class="btn btn-primary btn-sm" id="pf-btn-salvar"
            onclick="Perfil.salvarEdicao()" style="font-family:var(--font-section)">
            &#128190; Salvar Alterações
          </button>
        </div>
      </div>
    `;
  },

  // ── Salvar edição ───────────────────────────────────────
  async salvarEdicao() {
    const btn = document.getElementById('pf-btn-salvar');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    const dados = this._dadosUsuario;
    const isArquiteto = dados?.nivel_acesso === 'Arquiteto';

    try {
      const payload = {
        nome:       document.getElementById('pf-edit-nome')?.value?.trim()   || undefined,
        titulo:     document.getElementById('pf-edit-titulo')?.value?.trim()  || undefined,
        classe:     document.getElementById('pf-edit-classe')?.value?.trim()  || undefined,
        // avatar agora é via upload local (Perfil.escolherFoto), não por URL
      };

      let endpoint = '/perfil/';

      if (isArquiteto) {
        endpoint = '/perfil/arquiteto';
        const nivel  = document.getElementById('pf-edit-nivel')?.value;
        const moedas = document.getElementById('pf-edit-moedas')?.value;
        const xp     = document.getElementById('pf-edit-xp')?.value;
        if (nivel  !== undefined) payload.nivel_atual = parseInt(nivel);
        if (moedas !== undefined) payload.moedas      = parseInt(moedas);
        if (xp     !== undefined) payload.xp_total    = parseInt(xp);
      }

      const resp = await API.put(endpoint, payload);

      if (resp && resp.ok !== false) {
        // Atualiza dados locais
        if (payload.nome)       this._dadosUsuario.nome       = payload.nome;
        if (payload.titulo)     this._dadosUsuario.titulo     = payload.titulo;
        if (payload.classe)     this._dadosUsuario.classe     = payload.classe;
        if (payload.avatar_url !== undefined) this._dadosUsuario.avatar_url = payload.avatar_url;
        if (isArquiteto) {
          if (payload.nivel_atual !== undefined) this._dadosUsuario.nivel_atual = payload.nivel_atual;
          if (payload.moedas      !== undefined) this._dadosUsuario.moedas      = payload.moedas;
          if (payload.xp_total    !== undefined) { this._dadosUsuario.xp_total = payload.xp_total; this._dadosUsuario.xp_atual = payload.xp_total; }
        }

        // Re-renderiza o hero card
        this.renderHeroCard(this._dadosUsuario);

        // Atualiza sidebar
        const sbNome = document.getElementById('sidebar-nome');
        if (sbNome && payload.nome) sbNome.textContent = payload.nome;

        // Feedback visual
        if (btn) { btn.disabled = false; btn.innerHTML = '&#10003; Salvo!'; btn.style.background = '#10b981'; }
        setTimeout(() => {
          if (btn) { btn.innerHTML = '&#128190; Salvar Alterações'; btn.style.background = ''; btn.disabled = false; }
        }, 2000);
      }
    } catch (err) {
      SoloDialog.toast('Erro ao salvar: ' + (err.message || err), 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '&#128190; Salvar Alterações'; }
    }
  },

  // Salvar campo único (usado pelo avatar click)
  async _salvarCampo(payload, dados) {
    const endpoint = dados.nivel_acesso === 'Arquiteto' ? '/perfil/arquiteto' : '/perfil/';
    try {
      await API.put(endpoint, payload);
      // Atualiza e re-renderiza
      Object.assign(this._dadosUsuario, payload);
      this.renderHeroCard(this._dadosUsuario);
      this.renderFormEdicao(this._dadosUsuario);
    } catch (err) { SoloDialog.toast('Erro: ' + err.message, 'error'); }
  },

  // ── Gráfico Radar ───────────────────────────────────────
  renderRadar(dados) {
    let arr = [];
    if (Array.isArray(dados)) {
      arr = dados;
    } else if (dados && typeof dados === 'object') {
      arr = Object.entries(dados).map(([categoria, xp]) => ({ categoria, xp: xp || 0 }));
    }
    if (!arr.length) {
      arr = [
        { categoria: 'Saúde',    xp: 0 },
        { categoria: 'Trabalho', xp: 0 },
        { categoria: 'Estudo',   xp: 0 },
        { categoria: 'Casa',     xp: 0 },
        { categoria: 'Pessoal',  xp: 0 },
        { categoria: 'Combate',  xp: 0 },
      ];
    }
    Charts.criarGraficoRadar('chart-radar', arr);
  },

  // ── Gráfico XP Mensal ───────────────────────────────────
  renderXPMensal(dados) {
    if (!dados || !dados.length) {
      const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      dados = meses.map(m => ({ mes: m, xp: 0 }));
    }
    Charts.criarGraficoXPMensal('chart-xp-mensal', dados);
  },

  // ── Heatmap anual ───────────────────────────────────────
  renderHeatmap(dados) {
    Charts.criarHeatmap('heatmap-container', dados || {});
  },

  // ── Conquistas ──────────────────────────────────────────
  async renderConquistas(lista) {
    const cont = document.getElementById('perfil-conquistas');
    if (!cont) return;

    if (!lista || !lista.length) {
      cont.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-icon">&#127942;</div>
          <div>Nenhuma conquista encontrada</div>
        </div>`;
      return;
    }

    const now = new Date();
    const recent = lista.filter(c => c.desbloqueada && c.desbloqueada_em && (now - new Date(c.desbloqueada_em)) < 60000); // 1 minuto

    let delay = 0;
    cont.innerHTML = lista.map((c, i) => {
      const isNew = recent.includes(c) && !localStorage.getItem('cq_seen_'+c.id);
      let classes = 'conquista-badge';
      let style = '';
      
      if (c.desbloqueada) {
        classes += ' desbloqueada c-pulsing';
        style += `--c-pulse-delay: ${Math.random()*2}s;`;
      } else {
        classes += ' bloqueada';
      }
      
      if (isNew) {
        classes += ' c-materializing';
        style += `--c-delay: ${delay}ms;`;
        delay += 150;
      } else {
        classes += ' c-entering';
        style += `--c-delay: ${i * 50}ms;`;
      }
      
      return `
        <div class="${classes}" style="${style}">
          <div class="conquista-icon">${c.icone || '&#127942;'}</div>
          <div class="conquista-nome">${c.titulo || c.nome || 'Conquista'}</div>
          <div class="conquista-desc">${c.descricao || ''}</div>
          ${c.xp_bonus ? `<div class="conquista-xp-badge">+${c.xp_bonus} XP</div>` : ''}
        </div>
      `;
    }).join('');

    for (const c of recent) {
      if (!localStorage.getItem('cq_seen_'+c.id)) {
        await ConquistasAnim.showUnlockModal(c);
        localStorage.setItem('cq_seen_'+c.id, '1');
      }
    }
  },

  _getTituloByRank(rank) {
    const t = { 'E':'O Mais Fraco','D':'Iniciante','C':'Promissor','B':'Experiente','A':'Elite','S':'Monarch' };
    return t[rank] || 'Hunter';
  },

  _fmtDateDisplay(str) {
    if (!str) return '';
    const parts = str.split('T')[0].split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
};