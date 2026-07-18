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

    // Dentro do hexágono a foto não pode ser circular
    const avatarHtml = dados.avatar_url
      ? `<img src="${dados.avatar_url}" alt="Avatar" style="width:100%;height:100%;object-fit:cover">`
      : `<span style="font-size:2.1rem">&#128737;&#65039;</span>`;

    // Rank: letra + cor (mesma linguagem da Janela de Status do dashboard)
    const RANK_CORES = { 'E':'#94a3b8','D':'#22d3ee','C':'#10b981','B':'#3b82f6','A':'#a855f7','S':'#fbbf24','N':'#fb7185' };
    const cUp = (classe || 'E-Rank').toUpperCase();
    const letra = cUp.includes('NATIONAL') ? 'N'
                : ((cUp.match(/\b([EDCBAS])\b|^([EDCBAS])-/) || [])[1]
                || (cUp.match(/^([EDCBAS])-/) || [])[1] || 'E');
    const cor = RANK_CORES[letra] || '#a855f7';

    cont.innerHTML = `
      <div class="hunter-window" id="perfil-window" style="--rank-cor:${cor};--rank-aura:${cor}26">
        <canvas class="hunter-window-fx" id="perfil-fx"></canvas>
        <div class="hunter-window-body">

          <!-- Hexágono de rank (clicável: troca a foto) -->
          <div class="hunter-hex-wrap ${isArquiteto ? 'chamas-arquiteto' : ''}"
               id="perfil-avatar-click" title="Clique para trocar a foto" style="cursor:pointer">
            <div class="hunter-hex-ring"></div>
            <div class="hunter-hex">${avatarHtml}</div>
            <div class="hunter-hex-rank">${letra}</div>
            <div class="hunter-hex-camera">&#128247;</div>
          </div>

          <!-- Identidade -->
          <div class="hunter-ident">
            <div class="hunter-nome">${nome.toUpperCase()}</div>
            <div class="hunter-titulo">&ldquo;${titulo}&rdquo;</div>
            <div class="hunter-badges">
              <span style="font-family:var(--font-section);font-size:.68rem;font-weight:700;letter-spacing:.12em;
                padding:.2rem .7rem;border-radius:100px;color:${cor};
                border:1px solid ${cor}66;background:${cor}14">${classe}</span>
              ${isArquiteto ? `<span class="dg-badge-arquiteto" style="margin-left:0">★ ARQUITETO ★</span>` : ''}
            </div>

            <div class="hunter-xp">
              <div class="hunter-xp-top">
                <span class="hunter-xp-lbl">Progresso para o nível ${nivel + 1}</span>
                <span class="hunter-xp-val">${xpAtual.toLocaleString('pt-BR')} / ${xpProx.toLocaleString('pt-BR')} XP</span>
              </div>
              <div class="hunter-xp-track ${pct >= 85 ? 'quase' : ''}">
                <div class="hunter-xp-fill" id="perfil-xp-fill" style="width:0%"></div>
                <div class="hunter-xp-ticks"></div>
              </div>
            </div>
          </div>

          <!-- Cristais -->
          <div class="hunter-cristais">
            <div class="cristal cristal-nivel">
              <div class="cristal-gema"><span id="pf-c-nivel">0</span></div>
              <div class="cristal-lbl">Nível</div>
            </div>
            <div class="cristal cristal-moedas">
              <div class="cristal-gema"><span id="pf-c-moedas">0</span></div>
              <div class="cristal-lbl">Mana Coins</div>
            </div>
            <div class="cristal cristal-streak ${streak === 0 ? 'apagado' : ''}">
              <div class="cristal-gema">
                <span class="cristal-chama">&#128293;</span><span id="pf-c-streak">0</span>
              </div>
              <div class="cristal-lbl">Streak</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Anima barra e contadores (mesmo comportamento do dashboard)
    setTimeout(() => {
      const bar = document.getElementById('perfil-xp-fill');
      if (bar) bar.style.width = pct + '%';
    }, 120);
    this._contar(document.getElementById('pf-c-nivel'), nivel, 700);
    this._contar(document.getElementById('pf-c-moedas'), moedas, 900);
    this._contar(document.getElementById('pf-c-streak'), streak, 600);
    this._initFxPerfil();

    // Clique no hexágono → seletor de arquivo local (PC e mobile)
    document.getElementById('perfil-avatar-click')?.addEventListener('click', () => this.escolherFoto());
  },

  // Contagem animada (espelha Dashboard._contar)
  _contar(el, alvo, dur = 900) {
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

  // Partículas de mana na janela do perfil
  _initFxPerfil() {
    const canvas = document.getElementById('perfil-fx');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0;
    const ajustar = () => {
      const r = canvas.getBoundingClientRect();
      W = canvas.width = r.width; H = canvas.height = r.height;
    };
    ajustar();
    window.addEventListener('resize', ajustar);
    const ps = Array.from({ length: 26 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.6 + .4,
      v: Math.random() * .00035 + .00012,
      a: Math.random() * .5 + .15,
    }));
    const loop = () => {
      if (!canvas.isConnected) return;
      ctx.clearRect(0, 0, W, H);
      const cor = getComputedStyle(canvas.parentElement).getPropertyValue('--rank-cor').trim() || '#a855f7';
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
    const recent = lista.filter(c => c.desbloqueada && c.desbloqueada_em && (now - new Date(c.desbloqueada_em)) < 60000);

    // Ordena: desbloqueadas primeiro, depois por raridade (XP) decrescente
    const ordenada = [...lista].sort((a, b) => {
      if (a.desbloqueada !== b.desbloqueada) return a.desbloqueada ? -1 : 1;
      return (b.xp_bonus || 0) - (a.xp_bonus || 0);
    });

    let delay = 0;
    cont.innerHTML = ordenada.map((c, i) => {
      const isNew = recent.includes(c) && !localStorage.getItem('cq_seen_' + c.id);
      const rar   = this._raridade(c.xp_bonus || 0);

      let classes = `reliquia-card rar-${rar.k}`;
      let style = '';
      if (c.desbloqueada) {
        classes += ' desbloqueada c-pulsing';
        style += `--c-pulse-delay:${Math.random() * 2}s;`;
      } else {
        classes += ' bloqueada';
      }
      if (c.exclusiva_arquiteto) classes += ' comemorativa';

      if (isNew) { classes += ' c-materializing'; style += `--c-delay:${delay}ms;`; delay += 150; }
      else       { classes += ' c-entering';      style += `--c-delay:${i * 45}ms;`; }

      // Medalha: insígnia própria (se houver) → SVG da cerimônia → emoji
      const medalha = this._medalhaDe(c, 64);

      return `
        <div class="${classes}" style="${style}" title="${c.desbloqueada ? 'Conquistada' : 'Bloqueada'} — ${rar.nome}">
          <div class="reliquia-brilho"></div>
          ${c.exclusiva_arquiteto ? '<div class="reliquia-selo-arq">⟁</div>' : ''}
          <div class="reliquia-medalha">${medalha}</div>
          <div class="reliquia-nome">${c.titulo || c.nome || 'Conquista'}</div>
          <div class="reliquia-desc">${c.descricao || ''}</div>
          <div class="reliquia-rodape">
            <span class="reliquia-rar">${rar.nome}</span>
            ${c.xp_bonus ? `<span class="reliquia-xp">+${c.xp_bonus.toLocaleString('pt-BR')} XP</span>` : ''}
          </div>
          ${c.desbloqueada && c.desbloqueada_em
            ? `<div class="reliquia-data">⟢ ${this._fmtDateDisplay(c.desbloqueada_em)}</div>`
            : (c.desbloqueada ? '' : '<div class="reliquia-cadeado">🔒</div>')}
        </div>`;
    }).join('');

    for (const c of recent) {
      if (!localStorage.getItem('cq_seen_' + c.id)) {
        await ConquistasAnim.showUnlockModal(c);
        localStorage.setItem('cq_seen_' + c.id, '1');
      }
    }
  },

  /* Insígnias com arte própria (desenhadas no arquiteto-console.js).
     Cada entrada aponta para a função que gera o SVG da medalha. */
  _medalhaCustom(codigo, tam) {
    const mapa = {
      jh3ffth:       () => window.Jh3ffthFX?._svgMedalhaArquiteto?.(tam),
      solo:          () => window.SoloFX?._svgMedalhaSolo?.(tam),
      dominio_forja: () => window.ForjaFX?._svgMedalhaForja?.(tam),
    };
    try { return (mapa[codigo] && mapa[codigo]()) || null; }
    catch (_) { return null; }
  },

  _medalhaDe(c, tam = 64) {
    const custom = this._medalhaCustom(c.codigo, tam);
    if (custom) {
      return `<span class="cq-medalhinha" style="width:${tam}px;height:${tam}px">${custom}</span>`;
    }
    return (typeof ConquistaFX !== 'undefined' && ConquistaFX.miniMedalha)
      ? ConquistaFX.miniMedalha(c, tam)
      : `<div style="font-size:2rem">${c.icone || '🏆'}</div>`;
  },

  // Raridade por faixa de XP — dita moldura, brilho e rótulo
  _raridade(xp) {
    if (xp >= 2000) return { k: 'lendaria', nome: 'Lendária' };
    if (xp >= 500)  return { k: 'epica',    nome: 'Épica'    };
    if (xp >= 200)  return { k: 'rara',     nome: 'Rara'     };
    return              { k: 'comum',    nome: 'Comum'    };
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