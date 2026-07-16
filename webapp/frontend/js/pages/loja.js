/* ============================================================
   loja.js — Solo Routines
   Carrega recompensas, renderiza grid, resgata com confirmacao
   ============================================================ */

const Loja = {
  _recompensas: [],
  _moedas: 0,

  async carregar() {
    await Promise.all([
      this.carregarMoedas(),
      this.carregarRecompensas()
    ]);
  },

  async carregarMoedas() {
    try {
      const me = await API.auth.me();
      // API retorna: { moedas: 1000564, nome: ... }
      this._moedas = me?.moedas ?? me?.moedas_atual ?? 0;
      const el = document.getElementById('loja-moedas');
      if (el) el.textContent = this._moedas.toLocaleString('pt-BR');
    } catch (_) {}
  },

  async carregarRecompensas() {
    const cont = document.getElementById('grid-recompensas');
    if (!cont) return;

    cont.innerHTML = '<div class="loading-spinner-wrap" style="grid-column:1/-1"><div class="loading-spinner"></div></div>';

    try {
      const lista = await API.get('/recompensas/');
      this._recompensas = lista || [];
      this.renderGrid(this._recompensas);
    } catch (err) {
      cont.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-icon">&#128717;&#65039;</div>
          <div>Erro ao carregar a loja</div>
          <button class="btn btn-ghost btn-sm" onclick="Loja.carregar()">Tentar novamente</button>
        </div>`;
    }
  },

  renderGrid(lista) {
    const cont = document.getElementById('grid-recompensas');
    if (!cont) return;

    if (!lista.length) {
      cont.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-icon">&#128717;&#65039;</div>
          <div>A loja esta vazia no momento</div>
          <div style="font-family:var(--font-section);font-size:.8rem;color:var(--text-muted);margin-top:.5rem">
            O administrador pode adicionar recompensas no Painel Admin
          </div>
        </div>`;
      return;
    }

    cont.innerHTML = lista.map(r => this._buildCard(r)).join('');

    // Bind botoes de resgatar
    cont.querySelectorAll('.btn-resgatar').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const item = this._recompensas.find(r => String(r.id) === String(id));
        if (item) this.confirmarResgate(item);
      });
    });
  },

  _buildCard(r) {
    const semEstoque = r.estoque !== null && r.estoque !== undefined && r.estoque <= 0;
    const podePagar  = this._moedas >= (r.custo_moedas || 0);
    const icone = r.icone || '&#127873;';
    const titulo = r.titulo || r.nome || 'Recompensa';
    const imgHtml = r.imagem_url
      ? `<img src="${r.imagem_url}" alt="${titulo}" style="width:100%;height:100%;object-fit:cover">`
      : `<span style="font-size:3rem">${icone}</span>`;

    return `
      <div class="recompensa-card ${semEstoque ? 'sem-estoque' : ''}">
        ${r.resgatada ? '<div class="recompensa-resgatada-badge">&#9989; Resgatada</div>' : ''}
        <div class="recompensa-card-img">${imgHtml}</div>
        <div class="recompensa-card-body">
          <div class="recompensa-nome">${titulo}</div>
          <div class="recompensa-desc">${r.descricao || ''}</div>
          ${r.estoque !== null && r.estoque !== undefined
            ? `<div class="recompensa-estoque ${r.estoque <= 3 ? 'baixo' : ''}">
                Estoque: ${r.estoque}
               </div>`
            : ''}
        </div>
        <div class="recompensa-card-footer">
          <div>
            <div class="recompensa-preco">
              &#128176; ${(r.custo_moedas || 0).toLocaleString('pt-BR')}
            </div>
          </div>
          <button class="btn btn-sm ${podePagar && !semEstoque ? 'btn-gold' : 'btn-ghost'} btn-resgatar"
                  data-id="${r.id}"
                  ${semEstoque ? 'disabled title="Sem estoque"' : ''}
                  ${!podePagar && !semEstoque ? 'title="Mana Coins insuficientes"' : ''}>
            ${semEstoque ? 'Esgotado' : !podePagar ? '&#128274; Insuficiente' : '&#9889; Resgatar'}
          </button>
        </div>
      </div>
    `;
  },

  async confirmarResgate(recompensa) {
    const titulo = recompensa.titulo || recompensa.nome || 'Recompensa';
    const ok = await SoloDialog.confirm(
      `Resgatar <strong>${titulo}</strong>?<br><br>
       Custo: <strong style="color:#f59e0b">${recompensa.custo_moedas} 🪙 Mana Coins</strong><br>
       Seu saldo: <strong>${this._moedas} Mana Coins</strong>`,
      { titulo: 'Confirmar Resgate', icon: '🛒', tipo: 'info', btnOk: 'Resgatar', btnCancel: 'Cancelar' }
    );
    if (!ok) return;
    try {
      const resp = await API.post(`/recompensas/${recompensa.id}/resgatar`, {});
      if (resp) {
        this._moedas = resp.moedas_restantes ?? (this._moedas - (recompensa.custo_moedas || 0));
        const el = document.getElementById('loja-moedas');
        if (el) el.textContent = this._moedas.toLocaleString('pt-BR');
      }
      await this.carregarRecompensas();
      SoloDialog.toast(`"${titulo}" resgatado com sucesso! 🎉`, 'success');
    } catch (err) {
      SoloDialog.toast(err.message || 'Erro ao resgatar recompensa', 'error');
    }
  }
};