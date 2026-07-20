/* ============================================================
   sala-poderes.js — A Sala de Poderes do Arquiteto

   Seção exclusiva para as ações que DESFAZEM estado: revogar
   cargo, recolher emblema, suspender acesso, retirar XP.

   Duas decisões de construção que importam para o futuro:

     1. A tela é desenhada a partir do CATÁLOGO que o backend
        devolve em /arquiteto/poderes. Poder novo entra no
        catálogo e aparece aqui sozinho — este arquivo não
        precisa mudar para o painel crescer.

     2. Todo poder destrutivo passa por confirmação nomeada e
        vira uma linha no Livro de Decretos. Nada acontece em
        silêncio.
   ============================================================ */

const SalaPoderes = {
  _poderes:  [],
  _niveis:   [],
  _hunters:  [],
  _dossie:   null,
  _aba:      'hunters',   // hunters | decretos

  async carregar(cont) {
    const el = cont || document.getElementById('pa-corpo');
    if (!el) return;
    this._el = el;
    el.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';
    try {
      const [cat, { hunters }] = await Promise.all([
        API.arquiteto.poderes(), API.emblemas.hunters(),
      ]);
      this._poderes = cat.poderes || [];
      this._niveis  = cat.niveis  || [];
      this._hunters = hunters || [];
      this._render();
    } catch (err) {
      el.innerHTML = `<div class="pa-vazio">⚠️ ${err.message || err}</div>`;
    }
  },

  _medalha(b, tam = 44) {
    return (typeof ConquistaFX !== 'undefined' && ConquistaFX.miniMedalha)
      ? ConquistaFX.miniMedalha(b, tam)
      : `<span style="font-size:${tam * 0.55}px">${b.icone || '🎖'}</span>`;
  },

  _render() {
    this._el.innerHTML = `
      <div class="sp-aviso">
        <span class="sp-aviso-ico">⟁</span>
        <div>
          <b>Sala de Poderes</b> — aqui as ações desfazem estado e valem na hora.
          Tudo o que você fizer fica escrito no Livro de Decretos.
        </div>
      </div>

      <div class="sp-abas">
        <button class="sp-aba ${this._aba === 'hunters' ? 'on' : ''}" data-sp-aba="hunters">
          👥 Exercer sobre um hunter</button>
        <button class="sp-aba ${this._aba === 'decretos' ? 'on' : ''}" data-sp-aba="decretos">
          📖 Livro de Decretos</button>
      </div>
      <div id="sp-corpo"></div>`;

    this._el.querySelectorAll('[data-sp-aba]').forEach(b =>
      b.addEventListener('click', () => { this._aba = b.dataset.spAba; this._render(); }));

    this._aba === 'decretos' ? this._verDecretos() : this._verHunters();
  },

  /* ══════════════ ESCOLHA DO ALVO ══════════════ */
  _verHunters() {
    const corpo = document.getElementById('sp-corpo');
    const COR = { Arquiteto: '#fbbf24', Criador: '#a855f7', Admin: '#38bdf8', User: '#94a3b8' };

    corpo.innerHTML = `
      <div class="sp-secao-lbl">Escolha o hunter</div>
      <div class="sp-alvos">
        ${this._hunters.map(h => `
          <button class="sp-alvo ${h.inviolavel || h.nivel_acesso === 'Arquiteto' ? 'protegido' : ''}
                        ${this._dossie?.hunter?.id === h.id ? 'on' : ''}"
                  data-sp-hunter="${h.id}">
            <span class="sp-alvo-av">${h.avatar_url
              ? `<img src="${h.avatar_url}" alt="">` : '🛡️'}</span>
            <span class="sp-alvo-info">
              <span class="sp-alvo-nome">${h.nome}</span>
              <span class="sp-alvo-cargo" style="color:${COR[h.nivel_acesso] || '#94a3b8'}">
                ${h.nivel_acesso}${h.ativo === false ? ' · suspenso' : ''}</span>
            </span>
            ${h.inviolavel || h.nivel_acesso === 'Arquiteto'
              ? '<span class="sp-escudo" title="Inviolável — nenhum poder o atinge">🛡</span>' : ''}
          </button>`).join('')}
      </div>
      <div id="sp-dossie"></div>`;

    corpo.querySelectorAll('[data-sp-hunter]').forEach(b =>
      b.addEventListener('click', () => this._abrirDossie(parseInt(b.dataset.spHunter))));

    if (this._dossie) this._pintarDossie();
  },

  async _abrirDossie(id) {
    const alvo = document.getElementById('sp-dossie');
    alvo.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';
    try {
      this._dossie = await API.arquiteto.dossie(id);
      this._verHunters();
    } catch (err) {
      alvo.innerHTML = `<div class="pa-vazio">⚠️ ${err.message || err}</div>`;
    }
  },

  /* ══════════════ DOSSIÊ E OS PODERES ══════════════ */
  _pintarDossie() {
    const el = document.getElementById('sp-dossie');
    const d = this._dossie, h = d.hunter;
    const dt = s => s ? new Date(s).toLocaleDateString('pt-BR') : '—';

    if (d.protegido) {
      el.innerHTML = `
        <div class="sp-protegido">
          <div class="sp-protegido-ico">🛡</div>
          <div>
            <b>${h.nome} é inviolável.</b><br>
            Nenhum poder o atinge — nem os seus. É a trava que impede o Sistema
            de perder seu próprio dono por um clique errado.
          </div>
        </div>`;
      return;
    }

    const tem = id => this._poderes.some(p => p.id === id);

    el.innerHTML = `
      <div class="sp-dossie">
        <div class="sp-cabeca">
          <div class="sp-cabeca-av">${h.avatar_url
            ? `<img src="${h.avatar_url}" alt="">` : '🛡️'}</div>
          <div class="sp-cabeca-info">
            <div class="sp-cabeca-nome">${h.nome}
              <span class="sp-tag">${h.nivel_acesso}</span>
              ${!h.ativo ? '<span class="sp-tag sp-tag-off">suspenso</span>' : ''}
            </div>
            <div class="sp-cabeca-sub">@${h.login}${h.email ? ' · ' + h.email : ''}
              · entrou em ${dt(h.criado_em)}</div>
            <div class="sp-cabeca-stats">
              <span>⚡ Nv.${h.nivel_atual}</span>
              <span>✨ ${(h.xp_total || 0).toLocaleString('pt-BR')} XP</span>
              <span>🪙 ${(h.moedas || 0).toLocaleString('pt-BR')}</span>
              <span>🎖 ${d.badges.length}</span>
            </div>
          </div>
        </div>

        ${tem('revogar_cargo') || tem('conceder_cargo') ? `
        <div class="sp-poder">
          <div class="sp-poder-cab"><span>🔑</span> Cargo</div>
          <div class="sp-poder-corpo">
            <select class="sp-select" id="sp-cargo">
              ${this._niveis.map(n => `<option value="${n}" ${n === h.nivel_acesso ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
            <button class="sp-btn" data-sp-acao="conceder_cargo">Aplicar cargo</button>
            ${h.nivel_acesso !== 'User'
              ? '<button class="sp-btn destrutivo" data-sp-acao="revogar_cargo">Revogar Administrador</button>'
              : ''}
          </div>
          <div class="sp-poder-nota">Rebaixar remove o acesso ao Painel do Sistema na hora.</div>
        </div>` : ''}

        <div class="sp-poder">
          <div class="sp-poder-cab"><span>${h.ativo ? '🚫' : '🔓'}</span> Acesso ao Sistema</div>
          <div class="sp-poder-corpo">
            ${h.ativo
              ? '<button class="sp-btn destrutivo" data-sp-acao="revogar_acesso">Suspender acesso</button>'
              : '<button class="sp-btn" data-sp-acao="restaurar_acesso">Restaurar acesso</button>'}
          </div>
          <div class="sp-poder-nota">Suspender não apaga nada: o progresso dele fica intacto.</div>
        </div>

        <div class="sp-poder">
          <div class="sp-poder-cab"><span>📉</span> Progresso</div>
          <div class="sp-poder-corpo">
            <input type="number" min="1" class="sp-input" id="sp-xp" placeholder="XP a retirar">
            <button class="sp-btn destrutivo" data-sp-acao="revogar_xp">Retirar XP</button>
          </div>
          <div class="sp-poder-nota">Nível, rank e título são recalculados pelo motor.</div>
        </div>

        ${(() => {
          // Só o que o Arquiteto entregou aparece aqui. O que o hunter
          // conquistou com o próprio progresso não é dele para retirar.
          const recolhiveis = d.badges.filter(b => !b.de_missao);
          const conquistadas = d.badges.length - recolhiveis.length;
          return `
        <div class="sp-poder">
          <div class="sp-poder-cab"><span>🎖</span> Emblemas personalizados — ${recolhiveis.length}</div>
          ${recolhiveis.length ? `
            <div class="sp-badges">
              ${recolhiveis.map(b => `
                <div class="sp-badge">
                  <div class="sp-badge-med">${this._medalha(b)}</div>
                  <div class="sp-badge-info">
                    <div class="sp-badge-nome">${b.titulo}</div>
                    <div class="sp-badge-sub">
                      ${b.veio_de ? 'de ' + b.veio_de : 'concedido pelo Sistema'}
                      ${!b.celebrada ? ' · aguardando cerimônia' : ''}
                      ${b.xp_bonus ? ' · +' + b.xp_bonus + ' XP' : ''}
                    </div>
                  </div>
                  <button class="sp-btn-x" data-sp-badge="${b.codigo}"
                          title="Recolher ${b.titulo}">✕</button>
                </div>`).join('')}
            </div>`
            : '<div class="sp-vazio">Nenhum emblema personalizado com ele.</div>'}
          <div class="sp-poder-nota">
            Recolher desfaz também o bônus de XP concedido.
            ${conquistadas ? `<br>As <b>${conquistadas}</b> conquistadas por progresso
              próprio não entram aqui — são dele.` : ''}
          </div>
        </div>`;
        })()}

        ${d.decretos.length ? `
        <div class="sp-poder">
          <div class="sp-poder-cab"><span>📖</span> Decretos sobre ${h.nome}</div>
          <div class="sp-mini-log">
            ${d.decretos.map(x => `<div class="sp-mini-log-item">
              <span>${x.detalhe}</span>
              <span class="sp-quando">${x.quando ? new Date(x.quando).toLocaleString('pt-BR') : ''}</span>
            </div>`).join('')}
          </div>
        </div>` : ''}
      </div>`;

    el.querySelectorAll('[data-sp-acao]').forEach(b =>
      b.addEventListener('click', () => this._exercer(b.dataset.spAcao, b)));
    el.querySelectorAll('[data-sp-badge]').forEach(b =>
      b.addEventListener('click', () => this._exercer('revogar_badge', b,
                                                      { codigo: b.dataset.spBadge })));
  },

  /* ══════════════ EXECUÇÃO ══════════════ */
  async _exercer(acao, btn, extra = {}) {
    const h = this._dossie.hunter;
    const poder = this._poderes.find(p => p.id === acao) || { nome: acao, destrutivo: true };
    const payload = { usuario_id: h.id, ...extra };

    if (acao === 'conceder_cargo') {
      payload.nivel_acesso = document.getElementById('sp-cargo')?.value;
    }
    if (acao === 'revogar_xp') {
      const q = parseInt(document.getElementById('sp-xp')?.value || 0);
      if (!q || q < 1) { SoloDialog?.toast?.('Informe quanto XP retirar', 'info'); return; }
      payload.quantidade = q;
    }

    // Poder destrutivo sempre pergunta, e pergunta nomeando o alvo.
    if (poder.destrutivo) {
      const texto = `<b>${poder.nome}</b> sobre <b>${h.nome}</b>.<br>`
                  + `${poder.descricao || ''}<br><br>`
                  + `Isto vale na hora e fica registrado no Livro de Decretos.`;
      const ok = typeof SoloDialog !== 'undefined' && SoloDialog.confirm
        ? await SoloDialog.confirm(texto, {
            icon: poder.icone || '⟁', titulo: 'Exercer poder', tipo: 'warn',
            btnOk: 'Exercer', btnCancel: 'Voltar' })
        : true;
      if (!ok) return;
    }

    const metodo = {
      revogar_badge:    d => API.arquiteto.revogarBadge(d),
      revogar_cargo:    d => API.arquiteto.revogarCargo(d),
      conceder_cargo:   d => API.arquiteto.concederCargo(d),
      revogar_acesso:   d => API.arquiteto.revogarAcesso(d),
      restaurar_acesso: d => API.arquiteto.restaurarAcesso(d),
      revogar_xp:       d => API.arquiteto.revogarXp(d),
    }[acao];
    if (!metodo) { SoloDialog?.toast?.('Poder desconhecido', 'error'); return; }

    if (btn) btn.disabled = true;
    try {
      const r = await metodo(payload);
      if (typeof SFX !== 'undefined') SFX.play('carimbo');
      SoloDialog?.toast?.(r.detalhe || 'Poder exercido', 'success');
      await this._abrirDossie(h.id);
      // a lista lateral pode ter mudado (cargo, suspensão)
      try { this._hunters = (await API.emblemas.hunters()).hunters; } catch (_) {}
      this._verHunters();
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
      if (btn) btn.disabled = false;
    }
  },

  /* ══════════════ LIVRO DE DECRETOS ══════════════ */
  async _verDecretos() {
    const corpo = document.getElementById('sp-corpo');
    corpo.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';
    try {
      const { decretos } = await API.arquiteto.decretos();
      if (!decretos.length) {
        corpo.innerHTML = '<div class="sp-vazio">Nenhum poder exercido até agora.</div>';
        return;
      }
      const dt = s => s ? new Date(s).toLocaleString('pt-BR') : '';
      corpo.innerHTML = `
        <div class="sp-log">
          ${decretos.map(d => `
            <div class="sp-log-item ${d.destrutivo ? 'destrutivo' : ''}">
              <div class="sp-log-ico">${d.icone}</div>
              <div class="sp-log-info">
                <div class="sp-log-titulo">${d.poder_nome}
                  ${d.alvo ? `<span class="sp-log-alvo">→ ${d.alvo}</span>` : ''}</div>
                <div class="sp-log-detalhe">${d.detalhe || ''}</div>
                ${d.motivo ? `<div class="sp-log-motivo">"${d.motivo}"</div>` : ''}
                <div class="sp-log-rodape">
                  por ${d.por || '—'} · ${dt(d.quando)}
                  ${d.antes ? ` · antes: ${d.antes}` : ''}
                </div>
              </div>
            </div>`).join('')}
        </div>`;
    } catch (err) {
      corpo.innerHTML = `<div class="pa-vazio">⚠️ ${err.message || err}</div>`;
    }
  },
};

window.SalaPoderes = SalaPoderes;
