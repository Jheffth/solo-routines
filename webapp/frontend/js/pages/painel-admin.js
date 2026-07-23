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
      // Recolher emblema é poder de Arquiteto — não de Administrador comum.
      { id: 'emblemas', ico: '🎖', txt: 'Recolher', on: !!this._perm?.eh_arquiteto },
      { id: 'convites', ico: '📜', txt: 'Convites', on: this.pode('gerar_convites') },
      { id: 'catalogo', ico: '💠', txt: 'Catálogo', on: !!this._perm?.eh_arquiteto },
      { id: 'poderes',  ico: '⟁', txt: 'Poderes',  on: !!this._perm?.eh_arquiteto },
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
          ${{
            Arquiteto: '⟁ ARQUITETO',
            Criador:   '⚒ CRIADOR',
            Admin:     '⚙️ ADMINISTRADOR',
            Moderador: '🛡️ MODERADOR',
            Suporte:   '🎧 SUPORTE',
          }[this._perm.nivel_acesso] || '⚙️ ' + (this._perm.nivel_acesso || '').toUpperCase()}
        </span>
        <span class="pa-cargo-txt">${{
            Arquiteto: 'Autoridade total sobre o Sistema',
            Criador:   'Criação de conteúdo global — dungeons e missões',
            Admin:     'Gestão plena — hunters, badges e configurações',
            Moderador: 'Moderação social — chat e amizades',
            Suporte:   'Consulta e suporte — visualização apenas',
          }[this._perm.nivel_acesso] || 'Acesso administrativo'}</span>
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
       poderes:  () => SalaPoderes.carregar(document.getElementById('pa-corpo')),
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
                  ${h.badges.map(b => this._chipBadge(h, b)).join('')}
                </div>` : ''}
              </div>
            </div>`).join('')}
        </div>`;

      el.querySelectorAll('[data-pa-revogar]').forEach(b =>
        b.addEventListener('click', () => this._revogarBadge(b)));
    } catch (err) {
      el.innerHTML = `<div class="pa-vazio">⚠️ ${err.message || err}</div>`;
    }
  },

  /* Um emblema na linha do hunter, em medalha de verdade.
     O ✕ só existe nos personalizados: o que o hunter conquistou com o
     próprio progresso não é do Arquiteto para tirar. */
  _chipBadge(h, b) {
    const medalha = (typeof ConquistaFX !== 'undefined' && ConquistaFX.miniMedalha)
      ? ConquistaFX.miniMedalha(b, 30)
      : `<span>${b.icone || '🎖'}</span>`;
    const revogavel = !b.de_missao && this._perm?.eh_arquiteto && !h.inviolavel;
    const titulo = `${b.titulo}`
      + (b.de_missao ? ' — conquistado pelo hunter' : ' — personalizado')
      + (b.pendente ? ' · aguardando cerimônia' : '');

    return `<span class="pa-badge-chip ${b.pendente ? 'pend' : ''} ${b.de_missao ? 'ganha' : ''}"
                  title="${titulo}">
      ${medalha}
      ${revogavel ? `<button class="pa-badge-x" title="Recolher ${b.titulo}"
        data-pa-revogar="${b.codigo}" data-pa-hid="${h.id}"
        data-pa-hnome="${(h.nome || '').replace(/"/g, '&quot;')}"
        data-pa-btitulo="${(b.titulo || '').replace(/"/g, '&quot;')}"
        data-pa-bxp="${b.xp_bonus || 0}">✕</button>` : ''}
    </span>`;
  },

  async _revogarBadge(btn) {
    const { paRevogar: codigo, paHid: hid, paHnome: nome,
            paBtitulo: titulo, paBxp: xp } = btn.dataset;

    const texto = `Recolher <b>${titulo}</b> de <b>${nome}</b>.`
      + (Number(xp) > 0 ? `<br>O bônus de <b>${Number(xp).toLocaleString('pt-BR')} XP</b>`
                        + ` também será desfeito e o nível recalculado.` : '')
      + `<br><br>Fica registrado no Livro de Decretos.`;

    const ok = typeof SoloDialog !== 'undefined' && SoloDialog.confirm
      ? await SoloDialog.confirm(texto, {
          icon: '🎖', titulo: 'Recolher emblema', tipo: 'warn',
          btnOk: 'Recolher', btnCancel: 'Voltar' })
      : true;
    if (!ok) return;

    btn.disabled = true;
    try {
      const r = await API.arquiteto.revogarBadge({
        usuario_id: parseInt(hid), codigo,
        motivo: 'Recolhido pelo Registro de Hunters',
      });
      if (typeof SFX !== 'undefined') SFX.play('carimbo');
      SoloDialog?.toast?.(r.detalhe || 'Emblema recolhido', 'success');
      this._abaHunters();
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
      btn.disabled = false;
    }
  },

  /* ══════════════ EMBLEMAS — RECOLHER ══════════════
     Esta guia REVOGA. O envio vive na Casa de Trocas (página Materiais);
     ter dois caminhos para dar a mesma badge só criaria confusão.
     Aqui é o inverso: escolhe o hunter, vê o que ele tem de personalizado
     e recolhe. O que ele conquistou sozinho não aparece — não é do
     Arquiteto para tirar. */
  async _abaEmblemas() {
    const el = document.getElementById('pa-corpo');
    el.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';
    try {
      const { hunters } = await API.emblemas.hunters();
      this._hunters = hunters;
      this._selecionados.clear();

      el.innerHTML = `
        <div class="pa-nota pa-nota-alerta">
          Aqui você <b>recolhe</b> emblemas personalizados. O bônus de XP é desfeito
          e o nível recalculado. Para <b>enviar</b>, use a página
          <b>💠 Materiais</b>.
        </div>

        <div class="pa-secao-lbl">1. Escolha o hunter</div>
        <div class="pa-hunters-sel">
          ${hunters.map(h => `
            <div class="pa-hunter-chip ${h.inviolavel ? 'travado' : ''}"
                 data-pa-alvo="${h.id}">
              <span>${h.avatar_url ? `<img src="${h.avatar_url}" alt="">` : '🛡️'}</span>
              <span>${h.nome}</span>
              ${h.inviolavel ? '<span title="Inviolável">🛡</span>' : ''}
            </div>`).join('')}
        </div>

        <div id="pa-recolher"></div>`;

      el.querySelectorAll('[data-pa-alvo]').forEach(x =>
        x.addEventListener('click', () => {
          el.querySelectorAll('[data-pa-alvo]').forEach(y => y.classList.remove('on'));
          x.classList.add('on');
          this._verEmblemasDo(parseInt(x.dataset.paAlvo));
        }));
    } catch (err) {
      el.innerHTML = `<div class="pa-vazio">⚠️ ${err.message || err}</div>`;
    }
  },

  _verEmblemasDo(id) {
    const alvo = document.getElementById('pa-recolher');
    const h = this._hunters.find(x => x.id === id);
    if (!h || !alvo) return;
    this._alvoSel = h;
    this._selecionados.clear();

    if (h.inviolavel) {
      alvo.innerHTML = `<div class="pa-nota pa-nota-alerta" style="margin-top:1rem">
        🛡 <b>${h.nome}</b> é inviolável — nenhum emblema dele pode ser recolhido.
      </div>`;
      return;
    }

    const medalha = b => (typeof ConquistaFX !== 'undefined' && ConquistaFX.miniMedalha)
      ? ConquistaFX.miniMedalha(b, 64)
      : `<span style="font-size:34px">${b.icone || '🎖'}</span>`;

    const pessoais = (h.badges || []).filter(b => !b.de_missao);
    const ganhas   = (h.badges || []).length - pessoais.length;

    alvo.innerHTML = `
      <div class="pa-secao-lbl">2. Emblemas de ${h.nome} — ${pessoais.length} recolhível(is)</div>
      ${pessoais.length ? `
        <div class="pa-emblemas">
          ${pessoais.map(b => `
            <div class="pa-emblema pa-emblema-rev" data-pa-rev="${b.codigo}"
                 title="${b.titulo}">
              <div class="pa-emblema-med">${medalha(b)}</div>
              <div class="pa-emblema-nome">${b.titulo}</div>
              <div class="pa-emblema-bonus">
                ${b.xp_bonus ? '−' + Number(b.xp_bonus).toLocaleString('pt-BR') + ' XP' : 'sem bônus'}
              </div>
              ${b.pendente ? '<div class="pa-emblema-desc">aguardando cerimônia</div>' : ''}
            </div>`).join('')}
        </div>
        <button class="pa-btn-recolher" id="pa-recolher-btn" disabled>Selecione o que recolher</button>`
        : '<div class="pa-vazio">Nenhum emblema personalizado com este hunter.</div>'}
      ${ganhas ? `<div class="pa-nota" style="margin-top:.9rem">
        ${ganhas} conquistado(s) pelo próprio progresso não aparece(m) aqui — são dele.
      </div>` : ''}`;

    alvo.querySelectorAll('[data-pa-rev]').forEach(x =>
      x.addEventListener('click', () => {
        const cod = x.dataset.paRev;
        if (this._selecionados.has(cod)) { this._selecionados.delete(cod); x.classList.remove('on'); }
        else { this._selecionados.add(cod); x.classList.add('on'); }
        this._atualizarRecolher();
      }));
    document.getElementById('pa-recolher-btn')
      ?.addEventListener('click', () => this._recolherEmblemas());
  },

  _atualizarRecolher() {
    const btn = document.getElementById('pa-recolher-btn');
    if (!btn) return;
    const n = this._selecionados.size;
    btn.disabled = !n;
    btn.textContent = n
      ? `Recolher ${n} emblema${n > 1 ? 's' : ''} de ${this._alvoSel.nome}`
      : 'Selecione o que recolher';
  },

  async _recolherEmblemas() {
    const btn = document.getElementById('pa-recolher-btn');
    const h   = this._alvoSel;
    const cods = [...this._selecionados];
    const pessoais = (h.badges || []).filter(b => cods.includes(b.codigo));
    const nomes = pessoais.map(b => b.titulo).join(', ');
    const xp = pessoais.reduce((t, b) => t + (b.xp_bonus || 0), 0);

    const texto = `Recolher <b>${nomes}</b> de <b>${h.nome}</b>.`
      + (xp ? `<br>Isso desfaz <b>${xp.toLocaleString('pt-BR')} XP</b> e recalcula o nível dele.` : '')
      + `<br><br>Fica registrado no Livro de Decretos.`;
    const ok = typeof SoloDialog !== 'undefined' && SoloDialog.confirm
      ? await SoloDialog.confirm(texto, {
          icon: '🎖', titulo: 'Recolher emblemas', tipo: 'warn',
          btnOk: 'Recolher', btnCancel: 'Voltar' })
      : true;
    if (!ok) return;

    btn.disabled = true;
    btn.textContent = 'Recolhendo...';
    // Um decreto por emblema: o Livro fica com o histórico item a item.
    const feitos = [], falhos = [];
    for (const codigo of cods) {
      try {
        await API.arquiteto.revogarBadge({
          usuario_id: h.id, codigo,
          motivo: 'Recolhido pelo Painel do Sistema',
        });
        feitos.push(codigo);
      } catch (err) {
        falhos.push(`${codigo}: ${err.message || err}`);
      }
    }
    if (feitos.length && typeof SFX !== 'undefined') SFX.play('carimbo');
    if (feitos.length) SoloDialog?.toast?.(
      `${feitos.length} emblema(s) recolhido(s) de ${h.nome}`, 'success');
    falhos.forEach(f => SoloDialog?.toast?.(f, 'error'));
    await this._abaEmblemas();
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
