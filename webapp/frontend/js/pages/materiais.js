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
  _enviaveis:   [],
  _presos:      [],
  _sel:         new Set(),
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
      this._podeForjar = !!inv.pode_forjar;
      this._forjaveis  = inv.forjaveis || [];
      this._sel.clear();
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
            ${this._enviaveis.length ? `
              <div class="mt-grade">
                ${this._enviaveis.map(m => this._cardMaterial(m, true)).join('')}
              </div>` : `
              <div class="mt-vazio-suave">
                ${this._podeForjar
                  ? 'Inventário vazio — use a <b>Forja do Arquiteto</b> ao lado para gerar o que quiser enviar.'
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
          ${this._podeForjar ? this._blocoForja() : ''}
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
    return `
      <div class="mt-bloco mt-forja">
        <div class="mt-lbl mt-lbl-arq">⟁ Forja do Arquiteto</div>
        <div class="mt-forja-nota">
          Gere qualquer material que circula. Ao enviar, a forja repõe sozinha —
          você pode mandar o mesmo emblema para quantos hunters quiser.
        </div>
        <div class="mt-forja-grade">
          ${this._forjaveis.map(m => `
            <button class="mt-forja-item ${m.no_inventario ? 'tem' : ''}"
                    data-mt-forjar="${m.codigo}"
                    title="${m.no_inventario ? 'Já está no seu inventário' : 'Forjar ' + m.titulo}">
              <span class="mt-forja-med">${this._medalha(m, 40)}</span>
              <span class="mt-forja-nome">${m.titulo}</span>
              <span class="mt-forja-acao">${m.no_inventario ? '✓' : '+'}</span>
            </button>`).join('')}
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
    return `
      <div class="mt-card ${enviavel ? '' : 'preso'}"
           ${enviavel ? `data-mt="${m.codigo}"` : ''}
           title="${m.titulo}${m.descricao ? ' — ' + m.descricao : ''}">
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
    if (ctr) ctr.textContent = this._sel.size ? `${this._sel.size} selecionado${this._sel.size > 1 ? 's' : ''}` : '';
    if (!btn) return;

    if (!this._destino)      { btn.disabled = true;  btn.textContent = 'Selecione um destinatário'; return; }
    if (!this._sel.size)     { btn.disabled = true;  btn.textContent = 'Escolha o que enviar';      return; }
    btn.disabled = false;
    btn.textContent = `Enviar ${this._sel.size} material${this._sel.size > 1 ? 'is' : ''} para ${this._destino.nome}`;
  },

  async _enviar() {
    const btn = document.getElementById('mt-btn');
    const nomes = this._enviaveis.filter(m => this._sel.has(m.codigo)).map(m => m.titulo).join(', ');

    const aviso = `<b>${nomes}</b> deixará o seu inventário e passará a pertencer a `
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
      const r = await API.materiais.enviar({
        nick:     this._destino.login,
        codigos:  [...this._sel],
        mensagem: document.getElementById('mt-msg')?.value?.trim() || null,
      });
      if (typeof SFX !== 'undefined') SFX.play('carimbo');
      SoloDialog?.toast?.(
        `${r.enviados.map(e => e.titulo).join(', ')} → ${r.para.nome}`, 'success');
      (r.recusados || []).forEach(x =>
        SoloDialog?.toast?.(`${x.titulo || x.codigo}: ${x.motivo}`, 'info'));
      await this.carregar();
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
      btn.disabled = false;
      this._atualizarBotao();
    }
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
