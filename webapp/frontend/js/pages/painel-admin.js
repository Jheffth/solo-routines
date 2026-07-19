/* ============================================================
   painel-admin.js — Painel do Sistema
   Abas: Hunters · Emblemas · Convites · Logs
   Cada aba respeita o mapa de privilégios (Arquiteto x Admin).
   ============================================================ */

const PainelAdmin = {
  _perm: null,
  _aba: 'hunters',
  _hunters: [],
  _colecionaveis: [],
  _selecionados: new Set(),

  async carregar() {
    const cont = document.getElementById('painel-admin-conteudo');
    if (!cont) return;
    if (!this._bound) {
      document.getElementById('btn-sistema-refresh')
        ?.addEventListener('click', () => this.carregar());
      this._bound = true;
    }
    cont.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';
    try {
      this._perm = await API.emblemas.permissoes();
      this._render();
    } catch (err) {
      cont.innerHTML = `<div class="pa-vazio">⚠️ ${err.message || err}</div>`;
    }
  },

  pode(acao) { return !!this._perm?.pode?.[acao]; },

  _render() {
    const cont = document.getElementById('painel-admin-conteudo');
    const abas = [
      { id: 'hunters',  ico: '👥', txt: 'Hunters',  on: this.pode('ver_hunters') },
      { id: 'emblemas', ico: '🎖', txt: 'Emblemas', on: this.pode('enviar_emblemas') },
      { id: 'convites', ico: '📜', txt: 'Convites', on: this.pode('gerar_convites') },
      { id: 'catalogo', ico: '💠', txt: 'Catálogo', on: !!this._perm?.eh_arquiteto },
      { id: 'sistema',  ico: '⚙️', txt: 'Sistema',  on: this.pode('configurar_sistema') },
    ].filter(a => a.on);

    if (!abas.length) {
      cont.innerHTML = `<div class="pa-vazio">Você não tem privilégios administrativos.</div>`;
      return;
    }
    if (!abas.find(a => a.id === this._aba)) this._aba = abas[0].id;

    cont.innerHTML = `
      <div class="pa-cargo">
        <span class="pa-cargo-selo ${this._perm.eh_arquiteto ? 'arq' : ''}">
          ${this._perm.eh_arquiteto ? '⟁ ARQUITETO' : '⚙️ ' + (this._perm.nivel_acesso || '').toUpperCase()}
        </span>
        <span class="pa-cargo-txt">${this._perm.eh_arquiteto
          ? 'Autoridade total sobre o Sistema'
          : 'Acesso administrativo — ações críticas reservadas ao Arquiteto'}</span>
      </div>
      <div class="pa-abas">
        ${abas.map(a => `<button class="pa-aba ${a.id === this._aba ? 'on' : ''}"
          data-pa-aba="${a.id}">${a.ico} ${a.txt}</button>`).join('')}
      </div>
      <div id="pa-corpo"></div>`;

    cont.querySelectorAll('[data-pa-aba]').forEach(b =>
      b.addEventListener('click', () => { this._aba = b.dataset.paAba; this._render(); }));

    ({ hunters:  () => this._abaHunters(),
       emblemas: () => this._abaEmblemas(),
       convites: () => this._abaConvites(),
       catalogo: () => this._abaCatalogo(),
       sistema:  () => this._abaSistema() }[this._aba] || (() => {}))();
  },

  /* ══════════════ HUNTERS ══════════════ */
  async _abaHunters() {
    const el = document.getElementById('pa-corpo');
    el.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';
    try {
      const { hunters, resumo } = await API.emblemas.hunters();
      this._hunters = hunters;
      const dt = s => s ? new Date(s).toLocaleDateString('pt-BR') : '—';
      const NIVEL_COR = { Arquiteto: '#fbbf24', Criador: '#a855f7', Admin: '#38bdf8', User: '#94a3b8' };

      el.innerHTML = `
        <div class="pa-stats">
          <div class="pa-stat"><div class="v">${resumo.total}</div><div class="k">Hunters</div></div>
          <div class="pa-stat"><div class="v" style="color:#34d399">${resumo.ativos}</div><div class="k">Ativos</div></div>
          <div class="pa-stat"><div class="v" style="color:#38bdf8">${resumo.admins}</div><div class="k">Admins</div></div>
          <div class="pa-stat"><div class="v" style="color:var(--gold-bright)">${resumo.novos_7d}</div><div class="k">Novos (7d)</div></div>
        </div>
        <div class="pa-lista">
          ${hunters.map(h => `
            <div class="pa-hunter">
              <div class="pa-hunter-av">${h.avatar_url
                ? `<img src="${h.avatar_url}" alt="">`
                : '<span>🛡️</span>'}</div>
              <div class="pa-hunter-info">
                <div class="pa-hunter-nome">
                  ${h.nome}
                  <span class="pa-nivel" style="color:${NIVEL_COR[h.nivel_acesso] || '#94a3b8'};
                    border-color:${NIVEL_COR[h.nivel_acesso] || '#94a3b8'}66">${h.nivel_acesso}</span>
                  ${!h.ativo ? '<span class="pa-nivel" style="color:#f87171;border-color:rgba(239,68,68,.4)">inativo</span>' : ''}
                </div>
                <div class="pa-hunter-sub">
                  @${h.login}${h.email ? ' · ' + h.email : ''} · entrou em ${dt(h.criado_em)}
                  ${h.convite ? ' · convite <b>' + h.convite + '</b>' : ''}
                </div>
                <div class="pa-hunter-stats">
                  <span>⚡ Nv.${h.nivel_atual}</span>
                  <span>✨ ${(h.xp_total || 0).toLocaleString('pt-BR')} XP</span>
                  <span>🪙 ${(h.moedas || 0).toLocaleString('pt-BR')}</span>
                  <span>🔥 ${h.streak_atual || 0}</span>
                  <span>🎖 ${h.badges.length}</span>
                </div>
                ${h.badges.length ? `<div class="pa-hunter-badges">
                  ${h.badges.map(b => `<span title="${b.titulo}${b.pendente ? ' (aguardando cerimônia)' : ''}"
                    class="${b.pendente ? 'pend' : ''}">${b.icone}</span>`).join('')}
                </div>` : ''}
              </div>
              ${this.pode('enviar_emblemas') ? `
              <button class="pa-btn-mini" title="Enviar emblema"
                onclick="PainelAdmin._presentearRapido(${h.id}, '${h.nome.replace(/'/g, "\\'")}')">🎖</button>` : ''}
            </div>`).join('')}
        </div>`;
    } catch (err) {
      el.innerHTML = `<div class="pa-vazio">⚠️ ${err.message || err}</div>`;
    }
  },

  /* ══════════════ EMBLEMAS ══════════════ */
  async _abaEmblemas() {
    const el = document.getElementById('pa-corpo');
    el.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';
    try {
      const [cols, { hunters }] = await Promise.all([
        API.emblemas.colecionaveis(), API.emblemas.hunters(),
      ]);
      this._colecionaveis = cols;
      this._hunters = hunters;
      this._selecionados.clear();

      el.innerHTML = `
        <div class="pa-nota">
          Emblemas <b>colecionáveis</b> são presentes — nunca se conquistam por missão.
          Quem receber será celebrado com a Cerimônia ao entrar no Sistema.
        </div>

        <div class="pa-secao-lbl">1. Escolha o emblema</div>
        <div class="pa-emblemas">
          ${cols.length ? cols.map(e => `
            <div class="pa-emblema" data-pa-emb="${e.codigo}">
              <div class="pa-emblema-ico">${e.icone}</div>
              <div class="pa-emblema-nome">${e.titulo}</div>
              <div class="pa-emblema-desc">${e.descricao || ''}</div>
              <div class="pa-emblema-bonus">+${e.xp_bonus} XP · +${e.moedas_bonus} 🪙</div>
            </div>`).join('')
            : '<div class="pa-vazio">Nenhum emblema colecionável cadastrado.</div>'}
        </div>

        <div class="pa-secao-lbl">2. Escolha os hunters</div>
        <div class="pa-hunters-sel">
          ${hunters.map(h => `
            <div class="pa-hunter-chip" data-pa-hunter="${h.id}">
              <span>${h.avatar_url ? `<img src="${h.avatar_url}" alt="">` : '🛡️'}</span>
              <span>${h.nome}</span>
            </div>`).join('')}
        </div>

        <div class="pa-secao-lbl">3. Bilhete (opcional)</div>
        <input id="pa-msg" class="pa-input" maxlength="200"
               placeholder="Uma mensagem que ele verá na cerimônia...">

        <button class="pa-btn-enviar" id="pa-enviar" disabled>🎖 Enviar Emblema</button>`;

      el.querySelectorAll('[data-pa-emb]').forEach(x =>
        x.addEventListener('click', () => {
          el.querySelectorAll('[data-pa-emb]').forEach(y => y.classList.remove('on'));
          x.classList.add('on');
          this._embSel = x.dataset.paEmb;
          this._atualizarEnvio();
        }));
      el.querySelectorAll('[data-pa-hunter]').forEach(x =>
        x.addEventListener('click', () => {
          const id = parseInt(x.dataset.paHunter);
          if (this._selecionados.has(id)) { this._selecionados.delete(id); x.classList.remove('on'); }
          else { this._selecionados.add(id); x.classList.add('on'); }
          this._atualizarEnvio();
        }));
      document.getElementById('pa-enviar').addEventListener('click', () => this._enviarEmblema());
    } catch (err) {
      el.innerHTML = `<div class="pa-vazio">⚠️ ${err.message || err}</div>`;
    }
  },

  _atualizarEnvio() {
    const btn = document.getElementById('pa-enviar');
    if (!btn) return;
    const n = this._selecionados.size;
    btn.disabled = !(this._embSel && n);
    btn.textContent = n ? `🎖 Enviar para ${n} hunter${n > 1 ? 's' : ''}` : '🎖 Enviar Emblema';
  },

  async _enviarEmblema() {
    const btn = document.getElementById('pa-enviar');
    btn.disabled = true;
    try {
      const r = await API.emblemas.presentear({
        usuario_ids: [...this._selecionados],
        codigo: this._embSel,
        mensagem: document.getElementById('pa-msg')?.value?.trim() || null,
      });
      const nomes = r.enviados.map(e => e.nome).join(', ');
      SoloDialog?.toast?.(nomes ? `🎖 ${r.emblema} enviado para ${nomes}` : 'Nenhum envio novo', 'success');
      if (r.ignorados?.length) {
        SoloDialog?.toast?.(`${r.ignorados.length} ignorado(s): já possuíam`, 'info');
      }
      if (typeof SFX !== 'undefined') SFX.play('carimbo');
      this._abaEmblemas();
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
      btn.disabled = false;
    }
  },

  async _presentearRapido(id, nome) {
    this._aba = 'emblemas';
    this._render();
    setTimeout(() => {
      this._selecionados.clear();
      this._selecionados.add(id);
      document.querySelector(`[data-pa-hunter="${id}"]`)?.classList.add('on');
      this._atualizarEnvio();
      SoloDialog?.toast?.(`Escolha o emblema para ${nome}`, 'info');
    }, 400);
  },

  /* ══════════════ CONVITES ══════════════ */
  _abaConvites() {
    document.getElementById('pa-corpo').innerHTML = `
      <div class="pa-nota">O Sistema é fechado: só entra quem recebe um chamado.</div>
      <button class="pa-btn-enviar" onclick="ArquitetoConsole.convites()">📜 Abrir gestão de convites</button>`;
  },

  /* ══════════════ CATÁLOGO — o que circula na Casa de Trocas ══════════════ */
  async _abaCatalogo() {
    const el = document.getElementById('pa-corpo');
    el.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';
    try {
      const { itens } = await API.materiais.catalogo();
      const medalha = m => (typeof ConquistaFX !== 'undefined' && ConquistaFX.miniMedalha)
        ? ConquistaFX.miniMedalha(m, 46)
        : `<span style="font-size:26px">${m.icone || '🎖'}</span>`;

      const circulam = itens.filter(i => !i.de_missao);
      const presos   = itens.filter(i => i.de_missao);

      el.innerHTML = `
        <div class="pa-nota">
          Emblemas <b>personalizados</b> podem receber o status de circulação — hunters
          trocam entre si na página Materiais. Conquistas de missão nunca circulam:
          são prova de esforço próprio.
        </div>

        <div class="pa-secao-lbl">Personalizados — ${circulam.length}</div>
        <div class="pa-lista">
          ${circulam.map(m => `
            <div class="pa-hunter pa-cat">
              <div class="pa-cat-med">${medalha(m)}</div>
              <div class="pa-hunter-info">
                <div class="pa-hunter-nome">${m.titulo}</div>
                <div class="pa-hunter-sub">${m.descricao || ''}</div>
                <div class="pa-hunter-stats">
                  <span>👤 ${m.donos} dono${m.donos === 1 ? '' : 's'}</span>
                  <span>✨ ${m.xp_bonus} XP</span>
                  <span>🪙 ${m.moedas_bonus}</span>
                </div>
              </div>
              <button class="pa-toggle ${m.transferivel ? 'on' : ''}"
                      data-pa-cat="${m.codigo}" data-pa-val="${m.transferivel ? 0 : 1}"
                      title="${m.transferivel ? 'Circula — clique para travar' : 'Travado — clique para liberar'}">
                <span class="pa-toggle-bola"></span>
              </button>
            </div>`).join('')}
        </div>

        <div class="pa-secao-lbl">De missão — ${presos.length} · nunca circulam</div>
        <div class="pa-cat-presos">
          ${presos.map(m => `<span class="pa-cat-chip" title="${m.titulo}">
            ${m.icone} ${m.titulo}</span>`).join('')}
        </div>`;

      el.querySelectorAll('[data-pa-cat]').forEach(b =>
        b.addEventListener('click', async () => {
          const cod = b.dataset.paCat, val = b.dataset.paVal === '1';
          b.disabled = true;
          try {
            await API.materiais.definirStatus(cod, val);
            SoloDialog?.toast?.(val ? 'Emblema liberado para trocas' : 'Emblema travado', 'success');
            this._abaCatalogo();
          } catch (err) {
            SoloDialog?.toast?.(err.message || String(err), 'error');
            b.disabled = false;
          }
        }));
    } catch (err) {
      el.innerHTML = `<div class="pa-vazio">⚠️ ${err.message || err}</div>`;
    }
  },

  /* ══════════════ SISTEMA (casca) ══════════════ */
  _abaSistema() {
    document.getElementById('pa-corpo').innerHTML = `
      <div class="pa-nota">Configurações gerais do Sistema — em construção.</div>
      <div class="pa-grid-cascas">
        ${[['🎨','Identidade visual','Logo, cores e fontes do app'],
           ['🔔','Notificações','Telegram e lembretes automáticos'],
           ['🗂','Catálogo de emblemas','Criar e editar colecionáveis'],
           ['📊','Métricas do Sistema','Uso, retenção e progressão'],
           ['🛡','Segurança','Sessões, tentativas e bloqueios'],
           ['💾','Backup','Exportar e restaurar dados']
        ].map(([i, t, d]) => `
          <div class="pa-casca">
            <div class="pa-casca-ico">${i}</div>
            <div>
              <div class="pa-casca-titulo">${t}</div>
              <div class="pa-casca-desc">${d}</div>
            </div>
            <span class="pa-casca-tag">em breve</span>
          </div>`).join('')}
      </div>`;
  },
};

window.PainelAdmin = PainelAdmin;
