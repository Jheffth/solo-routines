/* ============================================================
   materiais.js — A Casa de Trocas do Portão

   Aqui o hunter envia emblemas personalizados para outro hunter.
   Três verdades que a tela precisa comunicar sem texto explicativo:

     1. A troca é REAL — quem envia perde. Por isso o inventário
        mostra o material sumindo da grade após o envio.
     2. As medalhas aparecem no formato PREMIUM (SVG forjado), nunca
        como emoji. Quem desenha é o ConquistaFX — mesma arte da
        Cerimônia, do selo e do perfil.
     3. O que é conquistado por missão fica à vista, mas acorrentado.
   ============================================================ */

const Materiais = {
  _enviaveis:        [],
  _presos:           [],
  _enviaveis_auras:  [],
  _sel:              new Set(),
  _sel_auras:        new Set(),
  _destino:     null,   // hunter confirmado
  _buscando:    null,   // debounce timer
  _limite:      10,

  async carregar() {
    const cont = document.getElementById('materiais-conteudo');
    if (!cont) return;
    if (!this._bound) {
      document.getElementById('btn-materiais-refresh')
        ?.addEventListener('click', () => this.carregar());
      this._bound = true;
    }
    cont.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';
    try {
      const inv = await API.materiais.inventario();
      this._enviaveis  = inv.enviaveis || [];
      this._presos     = inv.presos    || [];
      this._limite     = inv.limite_por_envio || 10;
      this._podeForjar       = !!inv.pode_forjar;
      this._forjaveis         = inv.forjaveis       || [];
      this._forjaveis_auras   = inv.forjaveis_auras || [];
      this._enviaveis_auras   = inv.enviaveis_auras || [];
      this._sel.clear();
      this._sel_auras.clear();
      this._destino = null;
      this._render();
      this._carregarHistorico();
    } catch (err) {
      cont.innerHTML = `<div class="mt-vazio">⚠️ ${err.message || err}</div>`;
    }
  },

  /* A medalha premium — delega para o mesmo renderizador da Cerimônia.
     Se por algum motivo o ConquistaFX não estiver na página, cai para o
     emoji apenas para não deixar buraco (nunca deve acontecer). */
  _medalha(m, tam = 92) {
    if (typeof ConquistaFX !== 'undefined' && ConquistaFX.miniMedalha) {
      return ConquistaFX.miniMedalha(m, tam);
    }
    return `<span class="mt-fallback" style="font-size:${tam * 0.5}px">${m.icone || '🎖'}</span>`;
  },

  _render() {
    const cont = document.getElementById('materiais-conteudo');

    cont.innerHTML = `
      <!-- A Forja vem ANTES de tudo: é a primeira coisa que o Arquiteto
           faz na página, e na largura em que as colunas empilham ela
           ficava enterrada no fim do scroll. -->
      ${this._podeForjar ? this._blocoForja() : ''}

      <div class="mt-layout">

        <!-- ── COLUNA ESQUERDA: o envio ─────────────────── -->
        <div class="mt-coluna">

          <div class="mt-bloco">
            <div class="mt-lbl">1 · Destinatário</div>
            <div class="mt-busca">
              <input id="mt-nick" class="mt-input" autocomplete="off" spellcheck="false"
                     placeholder="Digite o nick do hunter...">
              <div class="mt-busca-estado" id="mt-estado"></div>
            </div>
            <div id="mt-destino"></div>
          </div>

          <div class="mt-bloco">
            <div class="mt-lbl">2 · Materiais
              <span class="mt-contador" id="mt-contador"></span>
            </div>
            ${this._enviaveis.length || this._enviaveis_auras.length ? `
              <div class="mt-grade">
                ${this._enviaveis.map(m => this._cardMaterial(m, true)).join('')}
                ${this._enviaveis_auras.map(a => this._cardAura(a)).join('')}
              </div>` : `
              <div class="mt-vazio-suave">
                ${this._podeForjar
                  ? 'Inventário vazio — forje um item na <b>Forja do Arquiteto</b> acima.'
                  : 'Você ainda não possui materiais que circulam.<br>Emblemas personalizados chegam por convite, presente ou troca.'}
              </div>`}
          </div>

          <div class="mt-bloco">
            <div class="mt-lbl">3 · Bilhete <span class="mt-op">(opcional)</span></div>
            <input id="mt-msg" class="mt-input" maxlength="200"
                   placeholder="Uma palavra que ele verá na cerimônia...">
          </div>

          <button class="mt-enviar" id="mt-btn" disabled>Selecione um destinatário</button>
          <div class="mt-aviso">
            ⚠️ A troca é definitiva: o material sai do seu inventário e entra no dele.
          </div>
        </div>

        <!-- ── COLUNA DIREITA: o que é seu para sempre ──── -->
        <div class="mt-coluna">
          ${this._presos.length ? `
            <div class="mt-bloco">
              <div class="mt-lbl">Conquistados <span class="mt-op">— não circulam</span></div>
              <div class="mt-grade mt-grade-presos">
                ${this._presos.map(m => this._cardMaterial(m, false)).join('')}
              </div>
            </div>` : ''}

          <div class="mt-bloco">
            <div class="mt-lbl">Livro de Trocas</div>
            <div id="mt-historico">
              <div class="mt-vazio-suave">Carregando...</div>
            </div>
          </div>
        </div>
      </div>`;

    this._bind();
    this._atualizarBotao();
  },

  /* ── Forja do Arquiteto ────────────────────────────────────────────
     Ele não precisa possuir para enviar: basta o material existir e
     circular. Aqui ele estoca o inventário com um clique; e no envio,
     o backend forja sozinho o que faltar. */
  _blocoForja() {
    const cardsEmblemas = this._forjaveis.map(m => `
      <button class="mt-forja-item ${m.no_inventario ? 'tem' : ''}"
              data-mt-forjar="${m.codigo}"
              title="${m.no_inventario ? 'Já está no seu inventário' : 'Forjar ' + m.titulo}">
        <span class="mt-forja-med">${this._medalha(m, 58)}</span>
        <span class="mt-forja-nome">${m.titulo}</span>
        <span class="mt-forja-acao">${m.no_inventario ? '✓' : '+'}</span>
      </button>`).join('');
    const cardsAuras = this._forjaveis_auras.map(a => `
      <button class="mt-forja-item ${a.no_inventario ? 'tem' : ''}"
              data-mt-forjar-aura="${a.id}"
              title="${a.no_inventario ? 'Já está no seu inventário' : 'Forjar ' + a.nome}"
              style="border-color:rgba(244,143,177,.3)">
        <span class="mt-forja-med" style="position:relative;display:flex;align-items:center;justify-content:center">
          ${ (window.Auras && window.Auras.existe && window.Auras.existe(a.id)) ? window.Auras.bloco(a.id, 58) : '<span style="font-size:1.6rem">❇</span>' }
          <div style="position:absolute;z-index:2;width:26px;height:26px;
            background:linear-gradient(135deg,#2a1a4e,#0d1f36);
            clip-path:polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)"></div>
        </span>
        <span class="mt-forja-nome" style="color:${a.cor}">${a.nome}</span>
        <span class="mt-forja-acao" style="color:${a.cor}">${a.no_inventario ? '✓' : '+'}</span>
      </button>`).join('');
    return `
      <div class="mt-bloco mt-forja">
        <div class="mt-lbl mt-lbl-arq">⟁ Forja do Arquiteto</div>
        <div class="mt-forja-nota">
          Forje o item no seu inventário, selecione em “2 · Materiais” e envie.
        </div>
        <div class="mt-forja-tabs">
          <button class="mt-forja-tab active" data-forja-tab="emblemas">🖼️ Emblemas</button>
          <button class="mt-forja-tab"        data-forja-tab="auras">❇ Auras</button>
        </div>
        <div id="mt-forja-painel-emblemas" class="mt-forja-painel">
          ${cardsEmblemas.length ? '<div class="mt-forja-grade">' + cardsEmblemas + '</div>'
            : '<div class="mt-vazio-suave" style="font-size:.75rem">Nenhum emblema forjável ainda.</div>'}
        </div>
        <div id="mt-forja-painel-auras" class="mt-forja-painel" style="display:none">
          ${cardsAuras.length ? '<div class="mt-forja-grade">' + cardsAuras + '</div>'
            : '<div class="mt-vazio-suave" style="font-size:.75rem">Nenhuma aura no catálogo ainda.</div>'}
        </div>
      </div>`;
  },

  async _forjar(codigo, btn) {
    btn.disabled = true;
    try {
      const r = await API.materiais.forjar(codigo);
      if (typeof SFX !== 'undefined') SFX.play('carimbo');
      SoloDialog?.toast?.(
        r.ja_possui ? r.detalhe : `⟁ ${r.titulo} forjado no seu inventário`,
        r.ja_possui ? 'info' : 'success');
      if (!r.ja_possui) await this.carregar();
      else btn.disabled = false;
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
      btn.disabled = false;
    }
  },

  _cardMaterial(m, enviavel) {
    const veio = m.veio_de ? `<div class="mt-card-origem">de ${m.veio_de}</div>` : '';
    const delBtn = enviavel
      ? `<button class="mt-card-del" data-mt-deletar="${m.codigo}" title="Remover do inventário" onclick="event.stopPropagation()">✕</button>`
      : '';
    return `
      <div class="mt-card ${enviavel ? '' : 'preso'}"
           ${enviavel ? `data-mt="${m.codigo}"` : ''}
           title="${m.titulo}${m.descricao ? ' — ' + m.descricao : ''}">
        ${delBtn}
        <div class="mt-card-medalha">${this._medalha(m)}</div>
        <div class="mt-card-nome">${m.titulo}</div>
        ${veio}
        ${enviavel ? '<div class="mt-check">✓</div>' : '<div class="mt-cadeado">🔒</div>'}
      </div>`;
  },

  _bind() {
    const nick = document.getElementById('mt-nick');
    nick?.addEventListener('input', () => {
      this._destino = null;
      this._atualizarBotao();
      clearTimeout(this._buscando);
      const v = nick.value.trim();
      const estado = document.getElementById('mt-estado');
      if (v.length < 2) {
        estado.textContent = '';
        document.getElementById('mt-destino').innerHTML = '';
        return;
      }
      estado.innerHTML = '<span class="mt-spin"></span>';
      // debounce: o hunter ainda está digitando
      this._buscando = setTimeout(() => this._buscarHunter(v), 450);
    });

    document.querySelectorAll('[data-mt]').forEach(el =>
      el.addEventListener('click', () => {
        const cod = el.dataset.mt;
        if (this._sel.has(cod)) { this._sel.delete(cod); el.classList.remove('on'); }
        else {
          if (this._sel.size >= this._limite) {
            SoloDialog?.toast?.(`No máximo ${this._limite} materiais por envio`, 'info');
            return;
          }
          this._sel.add(cod); el.classList.add('on');
        }
        this._atualizarBotao();
      }));

    document.querySelectorAll('[data-mt-forjar]').forEach(b =>
      b.addEventListener('click', () => this._forjar(b.dataset.mtForjar, b)));

    document.querySelectorAll('[data-mt-forjar-aura]').forEach(b =>
      b.addEventListener('click', () => this._forjarAura(b.dataset.mtForjarAura, b)));

    document.querySelectorAll('[data-mt-aura]').forEach(el =>
      el.addEventListener('click', () => this._toggleAura(el.dataset.mtAura, el)));

    document.querySelectorAll('[data-forja-tab]').forEach(t =>
      t.addEventListener('click', () => this._trocarAbaForja(t.dataset.forjaTab)));

    document.querySelectorAll('[data-mt-deletar]').forEach(b =>
      b.addEventListener('click', e => { e.stopPropagation(); this._deletarMaterial(b.dataset.mtDeletar, b); }));

    document.querySelectorAll('[data-mt-deletar-aura]').forEach(b =>
      b.addEventListener('click', e => { e.stopPropagation(); this._deletarAura(b.dataset.mtDeletarAura); }));

    document.getElementById('mt-btn')?.addEventListener('click', () => this._enviar());
  },

  async _buscarHunter(nick) {
    const estado  = document.getElementById('mt-estado');
    const destino = document.getElementById('mt-destino');
    if (!estado || !destino) return;
    try {
      const h = await API.materiais.hunter(nick);
      this._destino = h;
      estado.innerHTML = '<span class="mt-ok">✓</span>';
      destino.innerHTML = `
        <div class="mt-destino">
          <div class="mt-destino-av">${h.avatar_url
            ? `<img src="${h.avatar_url}" alt="">` : '🛡️'}</div>
          <div>
            <div class="mt-destino-nome">${h.nome}</div>
            <div class="mt-destino-sub">@${h.login} · ${h.classe || 'E-Rank'} — Nv.${h.nivel_atual || 1}</div>
          </div>
          <div class="mt-destino-selo">destinatário</div>
        </div>`;
    } catch (err) {
      this._destino = null;
      estado.innerHTML = '<span class="mt-erro">✕</span>';
      destino.innerHTML = `<div class="mt-erro-txt">${err.message || 'Hunter não encontrado'}</div>`;
    }
    this._atualizarBotao();
  },

  _atualizarBotao() {
    const btn = document.getElementById('mt-btn');
    const ctr = document.getElementById('mt-contador');
    const total = this._sel.size + this._sel_auras.size;
    if (ctr) ctr.textContent = total ? `${total} selecionado${total > 1 ? 's' : ''}` : '';
    if (!btn) return;
    if (!this._destino)            { btn.disabled = true;  btn.textContent = 'Selecione um destinatário'; return; }
    if (!total)                    { btn.disabled = true;  btn.textContent = 'Escolha o que enviar';      return; }
    btn.disabled = false;
    btn.textContent = `Enviar ${total} item${total > 1 ? 'ns' : ''} para ${this._destino.nome}`;
  },

  async _enviar() {
    const btn       = document.getElementById('mt-btn');
    const msgVal    = document.getElementById('mt-msg')?.value?.trim() || null;
    const nomesEmbl = this._enviaveis.filter(m => this._sel.has(m.codigo)).map(m => m.titulo);
    const nomesAura = this._enviaveis_auras.filter(a => this._sel_auras.has(a.aura_id)).map(a => a.nome);
    const todos     = [...nomesEmbl, ...nomesAura].join(', ');

    const aviso = `<b>${todos}</b> deixará o seu inventário e passará a pertencer a `
                + `<b>${this._destino.nome}</b>. A troca é definitiva.`;
    const ok = typeof SoloDialog !== 'undefined' && SoloDialog.confirm
      ? await SoloDialog.confirm(aviso, {
          icon: '🎖', titulo: 'Selar a troca', tipo: 'warn',
          btnOk: 'Enviar', btnCancel: 'Voltar',
        })
      : true;
    if (!ok) return;

    btn.disabled = true;
    btn.textContent = 'Enviando...';
    try {
      // 1. Envia emblemas (fluxo original)
      if (this._sel.size) {
        const r = await API.materiais.enviar({
          nick:     this._destino.login,
          codigos:  [...this._sel],
          mensagem: msgVal,
        });
        if (typeof SFX !== 'undefined') SFX.play('carimbo');
        SoloDialog?.toast?.(`${r.enviados.map(e => e.titulo).join(', ')} → ${r.para.nome}`, 'success');
        (r.recusados || []).forEach(x =>
          SoloDialog?.toast?.(`${x.titulo || x.codigo}: ${x.motivo}`, 'info'));
      }
      // 2. Envia auras (fluxo novo, uma por vez)
      for (const auraId of this._sel_auras) {
        const r = await API.materiais.enviarAura({
          nick:     this._destino.login,
          aura_id:  auraId,
          mensagem: msgVal,
        });
        if (typeof SFX !== 'undefined') SFX.play('carimbo');
        SoloDialog?.toast?.(`✶ ${r.nome} → ${r.para.nome}`, 'success');
      }
      await this.carregar();
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
      btn.disabled = false;
      this._atualizarBotao();
    }
  },

  _cardAura(a) {
    const bloco = (window.Auras && window.Auras.existe && window.Auras.existe(a.aura_id))
      ? window.Auras.bloco(a.aura_id, 72) : '<span style="font-size:2rem">✶</span>';
    const veio = a.veio_de ? `<div class="mt-card-origem">de ${a.veio_de}</div>` : '';
    return `
      <div class="mt-card" data-mt-aura="${a.aura_id}"
           title="${a.nome}${a.descricao ? ' — ' + a.descricao : ''}">
        <button class="mt-card-del" data-mt-deletar-aura="${a.aura_id}" title="Remover do inventário" onclick="event.stopPropagation()">✕</button>
        <div class="mt-card-medalha" style="position:relative;display:flex;align-items:center;justify-content:center;height:92px">
          ${bloco}
          <div style="position:absolute;z-index:2;width:34px;height:34px;
            background:linear-gradient(135deg,#1a0a2e,#0d1f36);
            clip-path:polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)"></div>
        </div>
        <div class="mt-card-nome" style="color:${a.cor}">${a.nome}</div>
        ${veio}
        <div class="mt-check">✓</div>
      </div>`;
  },

  _toggleAura(auraId, el) {
    if (this._sel_auras.has(auraId)) {
      this._sel_auras.delete(auraId); el.classList.remove('on');
    } else {
      this._sel_auras.add(auraId); el.classList.add('on');
    }
    this._atualizarBotao();
  },

  async _forjarAura(auraId, btn) {
    btn.disabled = true;
    try {
      const r = await API.materiais.forjarAura(auraId);
      if (typeof SFX !== 'undefined') SFX.play('carimbo');
      SoloDialog?.toast?.(
        r.ja_possui ? r.detalhe : `✶ ${r.nome} forjada no seu inventário`,
        r.ja_possui ? 'info' : 'success');
      if (!r.ja_possui) await this.carregar();
      else btn.disabled = false;
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
      btn.disabled = false;
    }
  },

  async _deletarMaterial(codigo, btn) {
    const mat = this._enviaveis.find(m => m.codigo === codigo);
    const nome = mat ? mat.titulo : codigo;
    const ok = typeof SoloDialog !== 'undefined' && SoloDialog.confirm
      ? await SoloDialog.confirm(
          `Remover <b>${nome}</b> do seu inventário?<br><span style="color:#94a3b8;font-size:.78em">Se estiver equipado no perfil, será desequipado automaticamente.</span>`,
          { titulo: 'Remover Material', icon: '🗑', tipo: 'error', btnOk: 'Remover', btnCancel: 'Cancelar' }
        )
      : true;
    if (!ok) return;
    try {
      await API.materiais.deletar(codigo);
      if (typeof SFX !== 'undefined') SFX.play('carimbo');
      SoloDialog?.toast?.(`${nome} removido do inventário`, 'info');
      await this.carregar();
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
    }
  },

  async _deletarAura(auraId) {
    const cat = this._enviaveis_auras.find(a => a.aura_id === auraId);
    const nome = cat ? cat.nome : auraId;
    const ok = typeof SoloDialog !== 'undefined' && SoloDialog.confirm
      ? await SoloDialog.confirm(
          `Remover <b>${nome}</b> do seu inventário?<br><span style="color:#94a3b8;font-size:.78em">Se estiver equipada, será desequipada automaticamente.</span>`,
          { titulo: 'Remover Aura', icon: '✶', tipo: 'error', btnOk: 'Remover', btnCancel: 'Cancelar' }
        )
      : true;
    if (!ok) return;
    try {
      await API.materiais.deletarAura(auraId);
      SoloDialog?.toast?.(`${nome} removida do inventário`, 'info');
      await this.carregar();
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
    }
  },

  _trocarAbaForja(tabId) {
    document.querySelectorAll('.mt-forja-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.forjaTab === tabId));
    document.querySelectorAll('.mt-forja-painel').forEach(p =>
      p.style.display = p.id === 'mt-forja-painel-' + tabId ? '' : 'none');
    localStorage.setItem('mt_forja_aba', tabId);
  },

  async _carregarHistorico() {
    const el = document.getElementById('mt-historico');
    if (!el) return;
    try {
      const { registros } = await API.materiais.historico();
      if (!registros.length) {
        el.innerHTML = '<div class="mt-vazio-suave">Nenhuma troca registrada ainda.</div>';
        return;
      }
      const dt = s => s ? new Date(s).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
      el.innerHTML = `<div class="mt-log">
        ${registros.map(r => `
          <div class="mt-log-item ${r.direcao}">
            <div class="mt-log-seta">${r.direcao === 'enviado' ? '↗' : '↙'}</div>
            <div class="mt-log-med">${this._medalha({ codigo: r.codigo, icone: r.icone }, 34)}</div>
            <div class="mt-log-info">
              <div class="mt-log-titulo">${r.titulo}</div>
              <div class="mt-log-sub">
                ${r.direcao === 'enviado' ? 'para' : 'de'} <b>${r.outro}</b> · ${dt(r.quando)}
              </div>
              ${r.mensagem ? `<div class="mt-log-msg">"${r.mensagem}"</div>` : ''}
            </div>
          </div>`).join('')}
      </div>`;
    } catch (_) {
      el.innerHTML = '<div class="mt-vazio-suave">Livro indisponível no momento.</div>';
    }
  },
};

window.Materiais = Materiais;
