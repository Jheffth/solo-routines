/* ============================================================
   loja.js — A Loja do Hunter

   Reformulada para vender COSMÉTICOS (auras, emblemas, o que
   vier), e não só recompensas da vida real.

   Duas decisões guiam este arquivo:

   1. QUEM JULGA É O BACKEND. A vitrine antiga reimplementava as
      regras de compra no cliente e errava: tratava estoque -1
      (ilimitado) como esgotado, e ignorava o nível mínimo — o
      card convidava a resgatar e o servidor recusava depois.
      Agora o backend manda `disponivel`, `pode_pagar`,
      `tem_nivel`, `esgotado` e `possui` prontos. Aqui só se
      DESENHA o veredito.

   2. COSMÉTICO SE MOSTRA. Um item que é uma aura desenha a aura
      de verdade (Auras.svg); um emblema desenha a medalha
      (ConquistaFX.miniMedalha). Vender um efeito visual usando
      um emoji como vitrine é vender no escuro.

   Requer: css/loja.css
   ============================================================ */

const Loja = {
  _itens: [],
  _moedas: 0,
  _fragmentos: 0,
  _aba: 'todos',

  /* Abas por natureza do item. `tipos:null` = todas. */
  ABAS: [
    { id: 'todos',      rotulo: 'Tudo',        tipos: null },
    { id: 'cosmeticos', rotulo: 'Cosméticos',  tipos: ['aura', 'emblema'] },
    { id: 'externas',   rotulo: 'Recompensas', tipos: ['externa'] },
  ],

  _podeForjar: false,
  _catalogo: null,
  _rascunho: null,

  async carregar() {
    await Promise.all([
      this.carregarMoedas(),
      this.carregarItens(),
      this.verificarForja(),
    ]);
  },

  /* Quem pode forjar é o SERVIDOR quem diz. A tela não conhece a lista de
     cargos — assim, quando a forja abrir para Admin e Suporte, nada aqui
     muda, e nunca aparece um botão que o servidor recusaria. */
  async verificarForja() {
    try {
      const r = await API.get('/recompensas/forja/permissao');
      this._podeForjar = !!(r && r.pode_forjar);
    } catch (_) { this._podeForjar = false; }
    this._pintarBotaoForja();
  },

  _pintarBotaoForja() {
    const alvo = document.getElementById('loja-forja-acao');
    if (!alvo) return;
    alvo.innerHTML = this._podeForjar
      ? `<button class="lj-forja-abrir" id="btn-abrir-forja">
           <span class="lj-forja-sigilo">⟁</span> Forjar item
         </button>`
      : '';
    document.getElementById('btn-abrir-forja')
      ?.addEventListener('click', () => this.abrirForja());
  },

  async carregarMoedas() {
    try {
      const me = await API.auth.me();
      this._moedas = me?.moedas ?? 0;
      this._fragmentos = me?.fragmentos ?? 0;
      this._pintarCarteira();
    } catch (_) { /* a carteira é enfeite: nunca derruba a vitrine */ }
  },

  _pintarCarteira() {
    const el = document.getElementById('loja-moedas');
    if (el) el.textContent = (this._moedas || 0).toLocaleString('pt-BR');
    
    let elFrag = document.getElementById('loja-fragmentos');
    if (!elFrag && el) {
       const wrapper = el.parentElement;
       if (wrapper) {
         wrapper.insertAdjacentHTML('afterend', `
            <div class="lj-carteira frag">
              <span style="font-size:1.15rem; filter: drop-shadow(0 0 6px rgba(96,165,250,0.5));">💎</span>
              <span class="lj-carteira-valor" id="loja-fragmentos">${(this._fragmentos || 0).toLocaleString('pt-BR')}</span>
              <span class="lj-carteira-lbl">Fragmentos</span>
            </div>
         `);
       }
    } else if (elFrag) {
       elFrag.textContent = (this._fragmentos || 0).toLocaleString('pt-BR');
    }
  },

  async carregarItens() {
    const cont = document.getElementById('grid-recompensas');
    if (!cont) return;
    cont.innerHTML = '<div class="loading-spinner-wrap" style="grid-column:1/-1">'
                   + '<div class="loading-spinner"></div></div>';
    try {
      this._itens = (await API.get('/recompensas/')) || [];
      this.render();
    } catch (err) {
      cont.innerHTML = this._estado('aviso', 'A loja não abriu',
        (err && err.message) || 'Não foi possível falar com o Sistema.',
        '<button class="lj-btn" onclick="Loja.carregar()">Tentar de novo</button>');
    }
  },

  /* ── Glifos (SVG de linha, como o resto do app) ──────────── */
  _moeda(tam = 16) {
    return `<svg viewBox="0 0 24 24" width="${tam}" height="${tam}" fill="none"
      stroke="currentColor" stroke-width="2" aria-hidden="true">
      <circle cx="12" cy="12" r="8"/>
      <path d="M12 8 L15 12 L12 16 L9 12 Z" fill="currentColor" stroke="none"/></svg>`;
  },
  _glifoEstado(tam = 40) {
    return `<svg viewBox="0 0 24 24" width="${tam}" height="${tam}" fill="none"
      stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="M3 7h18l-1.5 12.5a2 2 0 0 1-2 1.5H6.5a2 2 0 0 1-2-1.5z"/>
      <path d="M8 7V5a4 4 0 0 1 8 0v2"/></svg>`;
  },

  _esc(s) {
    return String(s ?? '').replace(/[&<>"]/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  },

  _estado(tipo, titulo, texto, extra = '') {
    return `<div class="lj-estado">
      <div class="lj-estado-glifo">${this._glifoEstado(44)}</div>
      <div class="lj-estado-titulo">${this._esc(titulo)}</div>
      <div class="lj-estado-txt">${this._esc(texto)}</div>
      ${extra}</div>`;
  },

  /* ── Render ──────────────────────────────────────────────── */
  render() {
    this._pintarAbas();
    const cont = document.getElementById('grid-recompensas');
    if (!cont) return;

    const lista = this._filtrados();
    if (!lista.length) {
      cont.innerHTML = this._itens.length
        ? this._estado('vazio', 'Nada nesta prateleira',
            'Nenhum item deste tipo à venda agora. Experimente outra aba.')
        : this._estado('vazio', 'A loja está vazia',
            'Nenhum item à venda. Itens são cadastrados pelo Arquiteto — '
          + 'inclusive auras e emblemas, que aparecem aqui com a aparência real.');
      return;
    }

    cont.innerHTML = lista.map(i => this._card(i)).join('');

    // Delegação: um ouvinte para a grade inteira, não um por cartão.
    if (!cont.dataset.ljBound) {
      cont.dataset.ljBound = '1';
      cont.addEventListener('click', (e) => {
        const achar = (attr) => {
          const b = e.target.closest(`[data-${attr}]`);
          if (!b) return null;
          const id = b.getAttribute(`data-${attr}`);
          return { b, item: this._itens.find(x => String(x.id) === id) };
        };

        const ed = achar('lj-editar');
        if (ed?.item) { e.preventDefault(); return this.abrirForja(ed.item); }

        const rc = achar('lj-recolher');
        if (rc?.item) { e.preventDefault(); return this.recolher(rc.item); }

        const cp = achar('lj-comprar');
        if (cp?.item && !cp.b.disabled) this.confirmarCompra(cp.item, cp.b);
      });
    }
    this._desenharPreviews(cont);
  },

  _filtrados() {
    const aba = this.ABAS.find(a => a.id === this._aba) || this.ABAS[0];
    if (!aba.tipos) return this._itens;
    return this._itens.filter(i => aba.tipos.includes(i.tipo || 'externa'));
  },

  _pintarAbas() {
    const barra = document.getElementById('loja-abas');
    if (!barra) return;
    barra.innerHTML = this.ABAS.map(a => {
      const n = a.tipos
        ? this._itens.filter(i => a.tipos.includes(i.tipo || 'externa')).length
        : this._itens.length;
      return `<button class="lj-aba ${a.id === this._aba ? 'on' : ''}" data-lj-aba="${a.id}">
        ${a.rotulo}<span class="lj-aba-n">${n}</span></button>`;
    }).join('');

    if (!barra.dataset.ljBound) {
      barra.dataset.ljBound = '1';
      barra.addEventListener('click', (e) => {
        const b = e.target.closest('[data-lj-aba]');
        if (!b) return;
        this._aba = b.dataset.ljAba;
        this.render();
      });
    }
  },

  /* Cosmético é roxo (poder do Sistema); recompensa da vida real
     é dourada (promessa do hunter a si mesmo). */
  _cor(item) {
    if (item.possui) return 'var(--green-done)';
    return (item.tipo === 'externa' || !item.tipo)
      ? 'var(--gold-xp)' : 'var(--purple-glow)';
  },

  _rotuloTipo(t) {
    return { aura: 'Aura', emblema: 'Emblema', externa: 'Recompensa' }[t] || t;
  },

  _card(i) {
    const tipo = i.tipo || 'externa';
    const travado = !i.disponivel;

    // O motivo do bloqueio vira o rótulo do botão: o hunter descobre
    // ANTES de clicar, e não pela mensagem de erro depois.
    let rotulo = 'Resgatar', motivo = '';
    if (i.possui)           { rotulo = 'Adquirido';    motivo = 'Você já possui este item'; }
    else if (i.esgotado)    { rotulo = 'Esgotado';     motivo = 'Sem unidades restantes'; }
    else if (!i.tem_nivel)  { rotulo = `Nível ${i.nivel_minimo}`; motivo = `Exige nível ${i.nivel_minimo}`; }
    else if (!i.pode_pagar) { rotulo = 'Sem saldo';    motivo = 'Saldo insuficiente'; }

    const chips = [];
    if (!i.tem_nivel && !i.possui)
      chips.push(`<span class="lj-chip lj-chip-nivel">Nível ${i.nivel_minimo}</span>`);
    // Estoque só aparece quando é FINITO. O "-1" (ilimitado) nunca deve
    // virar texto — antes ele aparecia cru como "Estoque: -1".
    if (!i.ilimitado && i.estoque > 0)
      chips.push(`<span class="lj-chip ${i.estoque <= 3 ? 'lj-chip-alerta' : ''}">Restam ${i.estoque}</span>`);
    if (i.categoria && tipo === 'externa')
      chips.push(`<span class="lj-chip">${this._esc(i.categoria)}</span>`);

    return `
    <article class="lj-card ${travado ? 'travado' : ''} ${i.possui ? 'possuido' : ''}"
             style="--lj-cor:${this._cor(i)}">
      <div class="lj-palco" data-lj-palco="${i.id}">
        <span class="lj-selo-tipo">${this._rotuloTipo(tipo)}</span>
        ${i.possui ? '<span class="lj-fita">✓ Seu</span>' : ''}
        <span class="lj-palco-emoji">${i.icone || '🎁'}</span>
      </div>

      <div class="lj-corpo">
        <div class="lj-nome">${this._esc(i.titulo)}</div>
        ${i.descricao ? `<div class="lj-desc">${this._esc(i.descricao)}</div>` : '<div class="lj-desc"></div>'}
        ${chips.length ? `<div class="lj-chips">${chips.join('')}</div>` : ''}
      </div>

      ${this._podeForjar && i.id !== 'previa' ? `
      <div class="lj-gerir">
        <button class="lj-gerir-btn" data-lj-editar="${i.id}" title="Editar item">✏️</button>
        <button class="lj-gerir-btn perigo" data-lj-recolher="${i.id}" title="Recolher da prateleira">⟁</button>
      </div>` : ''}

      <div class="lj-rodape">
        <span class="lj-preco ${!i.pode_pagar && !i.possui ? 'sem-saldo' : ''}">
          ${(i.custo_fragmentos || 0) > 0 
              ? `<span style="color:#60a5fa; margin-right:4px;">💎</span>${(i.custo_fragmentos).toLocaleString('pt-BR')}`
              : `${this._moeda(16)}${(i.custo_moedas || 0).toLocaleString('pt-BR')}`
          }
        </span>
        <button class="lj-btn" data-lj-comprar="${i.id}"
                ${travado ? 'disabled' : ''}
                ${motivo ? `title="${this._esc(motivo)}"` : ''}>
          ${rotulo}
        </button>
      </div>
    </article>`;
  },

  /* Troca o emoji pelo desenho real do cosmético, quando existir.
     Feito DEPOIS do innerHTML porque tanto Auras quanto ConquistaFX
     devolvem SVG que precisa entrar já montado. Se o componente não
     estiver carregado, o emoji fica — degrada, não quebra. */
  _desenharPreviews(cont) {
    this._filtrados().forEach(i => {
      const c = i.cosmetico;
      if (!c) return;
      const palco = cont.querySelector(`[data-lj-palco="${i.id}"]`);
      if (!palco) return;
      const emoji = palco.querySelector('.lj-palco-emoji');

      if (c.tipo === 'aura' && typeof Auras !== 'undefined' && Auras.svg) {
        const svg = Auras.svg(c.id, 104);
        if (svg) {
          emoji?.remove();
          const box = document.createElement('div');
          box.className = 'lj-palco-aura';
          box.style.width = '104px';
          box.style.height = '104px';
          box.innerHTML = svg;
          palco.appendChild(box);
        }
      } else if (c.tipo === 'emblema'
                 && typeof ConquistaFX !== 'undefined' && ConquistaFX.miniMedalha) {
        const html = ConquistaFX.miniMedalha({ codigo: c.id, icone: i.icone }, 84);
        if (html) {
          emoji?.remove();
          const box = document.createElement('div');
          box.className = 'lj-palco-medalha';
          box.innerHTML = html;
          palco.appendChild(box);
        }
      }
    });
  },

  /* ── Compra ──────────────────────────────────────────────── */
  async confirmarCompra(item, btn) {
    const nome = item.titulo || 'Item';
    const ehFragmento = (item.custo_fragmentos || 0) > 0;
    const custo = ehFragmento ? item.custo_fragmentos : (item.custo_moedas || 0);
    const meuSaldo = ehFragmento ? (this._fragmentos || 0) : (this._moedas || 0);
    const moedaStr = ehFragmento ? '💎 Fragmentos' : 'Mana Coins';
    const corMoeda = ehFragmento ? '#60a5fa' : '#fbbf24';

    const saldoDepois = meuSaldo - custo;
    const extra = item.unico
      ? '<br><span style="color:#c084fc;font-size:.82rem">Cosmético permanente — fica seu para sempre.</span>'
      : '';

    const pergunta =
      `Adquirir <strong>${this._esc(nome)}</strong>?<br><br>` +
      `Custo: <strong style="color:${corMoeda}">${custo.toLocaleString('pt-BR')} ${moedaStr}</strong><br>` +
      `Saldo depois: <strong>${saldoDepois.toLocaleString('pt-BR')}</strong>${extra}`;

    const ok = (typeof SoloDialog !== 'undefined')
      ? await SoloDialog.confirm(pergunta, {
          titulo: 'Confirmar aquisição', icon: '🛒', tipo: 'info',
          btnOk: 'Adquirir', btnCancel: 'Cancelar' })
      : false;   // sem diálogo, NÃO gasta as moedas do hunter por engano
    if (!ok) return;

    const original = btn ? btn.textContent.trim() : '';
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    try {
      const resp = await API.post(`/recompensas/${item.id}/resgatar`, {});
      if (resp) {
        if (resp.moedas_restantes !== undefined) this._moedas = resp.moedas_restantes;
        if (resp.fragmentos_restantes !== undefined) this._fragmentos = resp.fragmentos_restantes;
        this._pintarCarteira();
      }
      // A cerimônia do cosmético é disparada pela camada de API, através do
      // envelope sr_eventos — não repetimos a festa aqui.
      await this.carregarItens();
      SoloDialog?.toast?.(`"${nome}" é seu!`, 'success');
    } catch (err) {
      SoloDialog?.toast?.(err.message || 'Não foi possível concluir', 'error');
      if (btn) { btn.disabled = false; btn.textContent = original || 'Resgatar'; }
    }
  },
  /* ══════════════════════════════════════════════════════════
     A FORJA — onde os itens da prateleira nascem

     Fica na própria loja, e não numa tela de administração à
     parte, porque quem decide o que se vende precisa ver a
     vitrine no mesmo instante. Por isso também existe a prévia:
     o item aparece exatamente como o hunter vai vê-lo, ANTES de
     ser criado — usando o mesmo `_card()` da vitrine, sem cópia.
     ══════════════════════════════════════════════════════════ */

  _rascunhoVazio() {
    return {
      titulo: '', descricao: '', icone: '🎁', categoria: 'Lazer',
      custo_moedas: 100, custo_fragmentos: 0, nivel_minimo: 1, estoque: -1,
      tipo: 'externa', payload: null,
      _editando: null,          // id quando é edição, null quando é criação
    };
  },

  async abrirForja(item = null) {
    if (!this._podeForjar) return;

    // O catálogo é buscado uma vez e reaproveitado: escolher um cosmético
    // olhando o desenho é o que torna isto fluido.
    if (!this._catalogo) {
      try { this._catalogo = await API.get('/recompensas/catalogo-cosmeticos'); }
      catch (_) { this._catalogo = { auras: [], emblemas: [] }; }
    }

    this._rascunho = item
      ? { titulo: item.titulo, descricao: item.descricao || '', icone: item.icone || '🎁',
          categoria: item.categoria || 'Lazer', custo_moedas: item.custo_moedas || 0,
          custo_fragmentos: item.custo_fragmentos || 0,
          nivel_minimo: item.nivel_minimo || 1, estoque: item.estoque ?? -1,
          tipo: item.tipo || 'externa', payload: item.payload || null,
          _editando: item.id }
      : this._rascunhoVazio();

    this._renderForja();
    document.getElementById('loja-forja')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  fecharForja() {
    this._rascunho = null;
    const el = document.getElementById('loja-forja');
    if (el) { el.classList.add('hidden'); el.innerHTML = ''; }
  },

  _renderForja() {
    const cx = document.getElementById('loja-forja');
    const d = this._rascunho;
    if (!cx || !d) return;
    cx.classList.remove('hidden');

    const editando = d._editando !== null;
    const TIPOS = [
      { id: 'externa', rotulo: 'Recompensa real' },
      { id: 'aura',    rotulo: 'Aura' },
      { id: 'emblema', rotulo: 'Emblema' },
    ];

    cx.innerHTML = `
      <div class="lj-forja-aviso">
        <span class="lj-forja-aviso-ico">⟁</span>
        <span>${editando
          ? 'Editando um item da prateleira. As mudanças valem para todos os hunters.'
          : 'Forja do Arquiteto — o que nascer aqui vai à prateleira de todos os hunters.'}</span>
      </div>

      <div class="lj-forja-corpo">
        <div class="lj-forja-campos">
          <div class="lj-campo">
            <label class="lj-campo-lbl">Natureza do item</label>
            <div class="lj-tipos">
              ${TIPOS.map(t => `<button type="button" class="lj-tipo ${d.tipo === t.id ? 'on' : ''}"
                data-lj-tipo="${t.id}">${t.rotulo}</button>`).join('')}
            </div>
          </div>

          ${d.tipo === 'externa' ? '' : `
          <div class="lj-campo">
            <label class="lj-campo-lbl">Qual ${d.tipo === 'aura' ? 'aura' : 'emblema'}<span class="req">*</span></label>
            <div class="lj-galeria" id="lj-galeria"></div>
            <span class="lj-campo-dica">Escolha olhando — o hunter verá exatamente este desenho.</span>
          </div>`}

          <div class="lj-campo">
            <label class="lj-campo-lbl" for="lj-f-titulo">Nome<span class="req">*</span></label>
            <input class="lj-in" id="lj-f-titulo" maxlength="120"
                   value="${this._esc(d.titulo)}" placeholder="Como o item se chama na vitrine">
          </div>

          <div class="lj-campo">
            <label class="lj-campo-lbl" for="lj-f-desc">Descrição</label>
            <textarea class="lj-in" id="lj-f-desc" maxlength="400"
              placeholder="O que o hunter ganha com isto">${this._esc(d.descricao)}</textarea>
          </div>

          <div class="lj-forja-linha">
            <div class="lj-campo">
              <label class="lj-campo-lbl" for="lj-f-preco">Moedas</label>
              <input class="lj-in" id="lj-f-preco" type="number" min="0" value="${d.custo_moedas}">
            </div>
            <div class="lj-campo">
              <label class="lj-campo-lbl" for="lj-f-frag">Fragmentos 💎</label>
              <input class="lj-in" id="lj-f-frag" type="number" min="0" value="${d.custo_fragmentos || 0}">
            </div>
            <div class="lj-campo">
              <label class="lj-campo-lbl" for="lj-f-nivel">Nível Mínimo</label>
              <input class="lj-in" id="lj-f-nivel" type="number" min="0" value="${d.nivel_minimo}">
            </div>
            <div class="lj-campo" style="flex:0.7">
              <label class="lj-campo-lbl" for="lj-f-estoque">Estoque</label>
              <input class="lj-in" id="lj-f-estoque" type="number" min="-1" value="${d.estoque}">
              <span class="lj-campo-dica">−1 = inf</span>
            </div>
          </div>

          ${d.tipo === 'externa' ? `
          <div class="lj-forja-linha">
            <div class="lj-campo">
              <label class="lj-campo-lbl" for="lj-f-icone">Ícone</label>
              <input class="lj-in" id="lj-f-icone" maxlength="4" value="${this._esc(d.icone)}">
            </div>
            <div class="lj-campo">
              <label class="lj-campo-lbl" for="lj-f-cat">Categoria</label>
              <input class="lj-in" id="lj-f-cat" maxlength="40" value="${this._esc(d.categoria)}">
            </div>
          </div>` : ''}
        </div>

        <div class="lj-forja-previa">
          <div class="lj-previa-lbl">Como o hunter verá</div>
          <div class="lj-previa-palco" id="lj-previa"></div>
        </div>
      </div>

      <div class="lj-forja-erro hidden" id="lj-forja-erro"></div>

      <div class="lj-forja-acoes">
        <button type="button" class="lj-btn-cancelar" id="lj-f-cancelar">Cancelar</button>
        <button type="button" class="lj-btn-forjar" id="lj-f-salvar">
          ${editando ? 'Salvar alterações' : '⟁ Forjar e colocar à venda'}
        </button>
      </div>`;

    this._bindForja();
    this._renderGaleria();
    this._renderPrevia();
  },

  _bindForja() {
    const cx = document.getElementById('loja-forja');
    if (!cx) return;
    const d = this._rascunho;

    cx.querySelectorAll('[data-lj-tipo]').forEach(b => {
      b.addEventListener('click', () => {
        d.tipo = b.dataset.ljTipo;
        // Trocar de natureza invalida a escolha anterior: um id de aura não
        // serve como emblema. Melhor zerar do que salvar um item quebrado.
        d.payload = null;
        this._colher();
        this._renderForja();
      });
    });

    ['lj-f-titulo', 'lj-f-desc', 'lj-f-preco', 'lj-f-frag', 'lj-f-nivel',
     'lj-f-estoque', 'lj-f-icone', 'lj-f-cat'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => {
        this._colher();
        this._renderPrevia();
      });
    });

    document.getElementById('lj-f-cancelar')?.addEventListener('click', () => this.fecharForja());
    document.getElementById('lj-f-salvar')?.addEventListener('click', () => this.forjar());
  },

  /* Lê os campos para o rascunho. Existe para a prévia refletir o que está
     digitado sem esperar o salvamento. */
  _colher() {
    const d = this._rascunho;
    if (!d) return;
    const v = id => document.getElementById(id)?.value;
    const n = (id, padrao) => {
      const x = parseInt(v(id), 10);
      return Number.isNaN(x) ? padrao : x;
    };
    d.titulo    = v('lj-f-titulo')  ?? d.titulo;
    d.descricao = v('lj-f-desc')    ?? d.descricao;
    d.icone     = v('lj-f-icone')   ?? d.icone;
    d.categoria = v('lj-f-cat')     ?? d.categoria;
    d.custo_moedas = n('lj-f-preco',   d.custo_moedas);
    d.custo_fragmentos = n('lj-f-frag', d.custo_fragmentos);
    d.nivel_minimo = n('lj-f-nivel',   d.nivel_minimo);
    d.estoque      = n('lj-f-estoque', d.estoque);
  },

  _renderGaleria() {
    const g = document.getElementById('lj-galeria');
    const d = this._rascunho;
    if (!g || !d) return;

    const lista = d.tipo === 'aura'
      ? (this._catalogo?.auras || [])
      : (this._catalogo?.emblemas || []);

    if (!lista.length) {
      g.innerHTML = `<div class="lj-galeria-vazia">Nenhum ${
        d.tipo === 'aura' ? 'aura' : 'emblema'} disponível no catálogo.</div>`;
      return;
    }

    g.innerHTML = lista.map(c => {
      const id = c.id || c.codigo;
      let arte = `<span style="font-size:1.8rem">${c.icone || '✨'}</span>`;
      if (d.tipo === 'aura' && typeof Auras !== 'undefined' && Auras.svg) {
        arte = Auras.svg(id, 54) || arte;
      } else if (d.tipo === 'emblema'
                 && typeof ConquistaFX !== 'undefined' && ConquistaFX.miniMedalha) {
        arte = ConquistaFX.miniMedalha({ codigo: id, icone: c.icone }, 46) || arte;
      }
      return `<button type="button" class="lj-gal-item ${d.payload === id ? 'on' : ''}"
                data-lj-cosm="${this._esc(id)}" title="${this._esc(c.nome || c.titulo || id)}">
        <span class="lj-gal-arte">${arte}</span>
        <span class="lj-gal-nome">${this._esc(c.nome || c.titulo || id)}</span>
      </button>`;
    }).join('');

    g.querySelectorAll('[data-lj-cosm]').forEach(b => {
      b.addEventListener('click', () => {
        this._colher();
        d.payload = b.dataset.ljCosm;
        // Nome ainda em branco? Herda o do cosmético — poupa digitação e
        // evita item sem nome, que é o erro mais comum aqui.
        if (!d.titulo.trim()) {
          const alvo = (d.tipo === 'aura' ? this._catalogo.auras : this._catalogo.emblemas)
            .find(x => (x.id || x.codigo) === d.payload);
          if (alvo) d.titulo = alvo.nome || alvo.titulo || '';
        }
        this._renderForja();
      });
    });
  },

  /* A prévia usa o MESMO _card() da vitrine. Uma prévia desenhada por outro
     caminho mentiria assim que os dois divergissem. */
  _renderPrevia() {
    const alvo = document.getElementById('lj-previa');
    const d = this._rascunho;
    if (!alvo || !d) return;

    const falso = {
      id: 'previa',
      titulo: d.titulo || 'Sem nome',
      descricao: d.descricao,
      icone: d.icone,
      categoria: d.categoria,
      custo_moedas: d.custo_moedas,
      custo_fragmentos: d.custo_fragmentos || 0,
      nivel_minimo: d.nivel_minimo,
      estoque: d.estoque,
      ilimitado: d.estoque < 0,
      esgotado: false,
      tipo: d.tipo,
      payload: d.payload,
      unico: d.tipo !== 'externa',
      possui: false,
      pode_pagar: true,
      tem_nivel: true,
      disponivel: true,
      cosmetico: d.payload
        ? { tipo: d.tipo, id: d.payload,
            cor: (this._catalogo?.auras || []).find(a => a.id === d.payload)?.cor }
        : null,
    };
    alvo.innerHTML = this._card(falso);

    // Desenha o cosmético na prévia, como a vitrine faria.
    const palco = alvo.querySelector('[data-lj-palco="previa"]');
    if (palco && d.payload) {
      const emoji = palco.querySelector('.lj-palco-emoji');
      if (d.tipo === 'aura' && typeof Auras !== 'undefined' && Auras.svg) {
        const svg = Auras.svg(d.payload, 104);
        if (svg) {
          emoji?.remove();
          const box = document.createElement('div');
          box.className = 'lj-palco-aura';
          box.style.width = '104px'; box.style.height = '104px';
          box.innerHTML = svg;
          palco.appendChild(box);
        }
      } else if (d.tipo === 'emblema'
                 && typeof ConquistaFX !== 'undefined' && ConquistaFX.miniMedalha) {
        const html = ConquistaFX.miniMedalha({ codigo: d.payload, icone: d.icone }, 84);
        if (html) {
          emoji?.remove();
          const box = document.createElement('div');
          box.className = 'lj-palco-medalha';
          box.innerHTML = html;
          palco.appendChild(box);
        }
      }
    }
  },

  _erroForja(msg) {
    const el = document.getElementById('lj-forja-erro');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('hidden', !msg);
  },

  async forjar() {
    this._colher();
    const d = this._rascunho;
    if (!d) return;

    if (!d.titulo.trim())                     return this._erroForja('Dê um nome ao item.');
    if (d.tipo !== 'externa' && !d.payload)   return this._erroForja('Escolha qual cosmético este item entrega.');
    if (d.custo_moedas < 0)                   return this._erroForja('O preço não pode ser negativo.');
    this._erroForja('');

    const corpo = {
      titulo: d.titulo.trim(),
      descricao: (d.descricao || '').trim() || null,
      icone: d.icone || '🎁',
      categoria: d.categoria || 'Lazer',
      custo_moedas: d.custo_moedas,
      custo_fragmentos: d.custo_fragmentos || 0,
      nivel_minimo: d.nivel_minimo,
      estoque: d.estoque,
      tipo: d.tipo,
      payload: d.tipo === 'externa' ? null : d.payload,
    };

    const btn = document.getElementById('lj-f-salvar');
    if (btn) { btn.disabled = true; btn.textContent = 'Forjando...'; }
    try {
      if (d._editando !== null) await API.put(`/recompensas/${d._editando}`, corpo);
      else                      await API.post('/recompensas/', corpo);
      this.fecharForja();
      await this.carregarItens();
      SoloDialog?.toast?.(d._editando !== null ? 'Item atualizado' : '⟁ Item forjado e à venda', 'success');
    } catch (err) {
      this._erroForja(err.message || 'Não foi possível forjar');
      if (btn) { btn.disabled = false; btn.textContent = '⟁ Forjar e colocar à venda'; }
    }
  },

  async recolher(item) {
    const ok = (typeof SoloDialog !== 'undefined')
      ? await SoloDialog.confirm(
          `Retirar <strong>${this._esc(item.titulo)}</strong> da prateleira?<br><br>` +
          `<span style="color:#94a3b8;font-size:.82rem">O item sai da vitrine. ` +
          `Quem já resgatou continua com o que recebeu.</span>`,
          { titulo: 'Recolher item', tipo: 'error', icon: '⟁',
            btnOk: 'Recolher', btnCancel: 'Manter' })
      : false;
    if (!ok) return;
    try {
      await API.delete(`/recompensas/${item.id}`);
      await this.carregarItens();
      SoloDialog?.toast?.('Item recolhido da prateleira', 'info');
    } catch (err) {
      SoloDialog?.toast?.(err.message || 'Não foi possível recolher', 'error');
    }
  },
};

window.Loja = Loja;
