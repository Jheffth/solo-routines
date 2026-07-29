/* ============================================================
   sr-filtro.js — Os filtros do Extrato

   O PORQUÊ, QUE NÃO É ESTÉTICO

   O Extrato era o único canto do app com emoji. Não por descuido:
   os filtros são `<select>`, e `<option>` NÃO ACEITA HTML — só
   texto. Um SVG ali é impossível. O emoji era o teto do elemento,
   não uma escolha de quem escreveu.

   Ou seja: "trocar emoji por SVG" e "deixar os filtros num nível
   melhor" nunca foram dois pedidos. São o mesmo, e a resposta dos
   dois é a mesma — parar de usar `<select>` para DESENHAR.

   ────────────────────────────────────────────────────────────
   A DECISÃO QUE SUSTENTA TUDO: O <SELECT> FICA

   A tentação seria apagar os cinco `<select>` e montar listas
   próprias. Seria mais limpo de escrever e pior de tudo o resto.

   O `<select>` continua no HTML, escondido, e continua sendo A
   VERDADE. Esta interface o lê, escreve nele e dispara `change`.

   O que isso compra, e cada item já custou caro neste projeto:

     · o `_bindFiltrosExtrato` do dashboard.js NÃO MUDA UMA LINHA.
       Ele escuta `change` e lê `.value`, e continua funcionando.

     · `document.getElementById('filtro-tipo').value = 'DIARIA'`
       continua valendo — de qualquer lugar, inclusive do console.

     · se este arquivo falhar ao carregar, o hunter fica com os
       filtros NATIVOS. Feios, e funcionando. Um componente de
       enfeite não pode ser ponto único de falha de uma função.

     · teclado, leitor de tela e preenchimento do navegador
       continuam existindo de graça, porque o elemento real está lá.

   ────────────────────────────────────────────────────────────
   COMO CADA OPÇÃO SABE SEU DESENHO

   Por `data-glifo` no próprio `<option>`. O nome aponta para o
   alfabeto do `glifos.js` — o MESMO que o cartão de missão usa.

   É isso que faz o filtro "Saúde" e o chip "SAÚDE" no cartão
   serem o mesmo símbolo. Dois desenhos para o mesmo conceito é
   como se perde um alfabeto.
   ============================================================ */

const SrFiltro = {

  _seq: 0,
  _abertos: [],

  /* Varre a página e enfeita todo `<select class="sr-filtro">` que
     ainda não foi enfeitado. Idempotente de propósito: o Dashboard
     recarrega, e chamar duas vezes não pode duplicar nada. */
  montarTodos(raiz) {
    (raiz || document).querySelectorAll('select.sr-filtro').forEach(s => this.montar(s));
  },

  montar(sel) {
    if (!sel || sel.dataset.srPronto) return null;
    sel.dataset.srPronto = '1';

    const n = ++this._seq;
    const caixa = document.createElement('div');
    caixa.className = 'srf';
    caixa.style.setProperty('--f-cor', getComputedStyle(sel).getPropertyValue('--f-cor').trim() || '#7c3aed');

    /* O `<select>` vira invisível mas CONTINUA no fluxo do
       formulário e no DOM. `display:none` o tiraria da navegação por
       teclado de quem depende dele. */
    sel.classList.add('srf-nativo');
    sel.parentNode.insertBefore(caixa, sel);
    caixa.appendChild(sel);

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'srf-botao';
    botao.id = `srf-b${n}`;
    botao.setAttribute('aria-haspopup', 'listbox');
    botao.setAttribute('aria-expanded', 'false');

    const lista = document.createElement('div');
    lista.className = 'srf-lista';
    lista.setAttribute('role', 'listbox');
    lista.id = `srf-l${n}`;
    lista.hidden = true;

    caixa.appendChild(botao);
    caixa.appendChild(lista);

    const inst = { sel, caixa, botao, lista, aberta: false, marcado: -1 };
    caixa.__srf = inst;

    this._preencher(inst);
    this._ligar(inst);
    this._pintarBotao(inst);
    return inst;
  },

  /* ── A lista ──────────────────────────────────────────────
     Reconstruída a partir do `<select>`, sempre. Se alguém trocar
     as opções por JS, `SrFiltro.recarregar(sel)` reflete. */
  _preencher(inst) {
    inst.lista.innerHTML = [...inst.sel.options].map((o, i) => `
      <div class="srf-item" role="option" data-i="${i}"
           aria-selected="${o.selected ? 'true' : 'false'}"
           ${o.selected ? 'data-sel="1"' : ''}>
        <span class="srf-ico">${this._glifo(o.dataset.glifo)}</span>
        <span class="srf-txt">${this._esc(o.textContent.trim())}</span>
        <span class="srf-tique" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
               stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"
               style="max-width:none"><path d="M4 12.5l5.2 5.2L20 7"/></svg>
        </span>
      </div>`).join('');
  },

  _glifo(nome) {
    if (nome && typeof Glifos !== 'undefined' && Glifos.existe(nome)) return Glifos.linha(nome, 15);
    /* Sem glifo declarado, um ponto — e não um emoji de reserva.
       Reserva feia é reserva que fica. */
    return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"'
         + ' stroke-width="2" style="max-width:none"><circle cx="12" cy="12" r="3.4"/></svg>';
  },

  _pintarBotao(inst) {
    const o = inst.sel.options[inst.sel.selectedIndex] || inst.sel.options[0];
    if (!o) return;
    /* O botão mostra o glifo da opção ESCOLHIDA. Antes o `<select>`
       mostrava o emoji da opção; a informação é a mesma, o desenho é
       que passou a ser do projeto. */
    inst.botao.innerHTML =
      `<span class="srf-ico">${this._glifo(o.dataset.glifo)}</span>` +
      `<span class="srf-rotulo">${this._esc(o.textContent.trim())}</span>` +
      `<span class="srf-seta" aria-hidden="true">
         <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
              stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
              style="max-width:none"><path d="M5.5 9l6.5 6.5L18.5 9"/></svg>
       </span>`;
    /* Um filtro que NÃO está no valor padrão precisa se anunciar:
       senão o hunter olha uma lista recortada sem lembrar por quê. */
    inst.caixa.classList.toggle('srf-ativo', inst.sel.selectedIndex > 0);
    inst.botao.setAttribute('aria-label', inst.sel.getAttribute('aria-label') || o.textContent.trim());
  },

  /* ── Comportamento ────────────────────────────────────────── */
  _ligar(inst) {
    inst.botao.addEventListener('click', (e) => {
      e.preventDefault();
      inst.aberta ? this.fechar(inst) : this.abrir(inst);
    });

    inst.lista.addEventListener('click', (e) => {
      const item = e.target.closest('.srf-item');
      if (!item) return;
      this._escolher(inst, +item.dataset.i);
    });

    inst.botao.addEventListener('keydown', (e) => {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        this.abrir(inst);
      }
    });

    inst.lista.addEventListener('keydown', (e) => this._tecla(inst, e));

    /* Se alguém mudar o `<select>` por fora — outra tela, o console,
       um "limpar filtros" — o botão precisa acompanhar. Sem isto a
       interface mentiria sobre o próprio estado. */
    inst.sel.addEventListener('change', () => {
      this._pintarBotao(inst);
      this._preencher(inst);
    });
  },

  _tecla(inst, e) {
    const itens = [...inst.lista.querySelectorAll('.srf-item')];
    const ir = (d) => {
      inst.marcado = Math.max(0, Math.min(itens.length - 1, inst.marcado + d));
      this._marcar(inst, itens);
    };
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); ir(1); break;
      case 'ArrowUp':   e.preventDefault(); ir(-1); break;
      case 'Home':      e.preventDefault(); inst.marcado = 0; this._marcar(inst, itens); break;
      case 'End':       e.preventDefault(); inst.marcado = itens.length - 1; this._marcar(inst, itens); break;
      case 'Enter':
      case ' ':         e.preventDefault(); this._escolher(inst, inst.marcado); break;
      case 'Escape':    e.preventDefault(); this.fechar(inst, true); break;
      case 'Tab':       this.fechar(inst); break;
      default:
        /* Digitar a primeira letra salta para a opção — é o que o
           `<select>` nativo faz, e tirar seria piorar. */
        if (e.key.length === 1) {
          const alvo = itens.findIndex((it, i) =>
            i > inst.marcado && it.textContent.trim().toLowerCase().startsWith(e.key.toLowerCase()));
          const achou = alvo >= 0 ? alvo : itens.findIndex(it =>
            it.textContent.trim().toLowerCase().startsWith(e.key.toLowerCase()));
          if (achou >= 0) { inst.marcado = achou; this._marcar(inst, itens); }
        }
    }
  },

  _marcar(inst, itens) {
    itens.forEach((it, i) => it.classList.toggle('srf-marcado', i === inst.marcado));
    const it = itens[inst.marcado];
    /* Rolar até o item é CONFORTO, não função. Sem a guarda, um
       ambiente que não implementa `scrollIntoView` derruba a
       navegação por teclado inteira — e o hunter fica sem escolher
       porque o menu não conseguiu rolar. */
    if (it && it.scrollIntoView) it.scrollIntoView({ block: 'nearest' });
  },

  abrir(inst) {
    /* Um de cada vez: dois menus abertos é ruído, e o clique fora de
       um seria o clique dentro do outro. */
    this._abertos.slice().forEach(o => { if (o !== inst) this.fechar(o); });

    inst.aberta = true;
    inst.lista.hidden = false;
    inst.caixa.classList.add('srf-aberta');
    inst.botao.setAttribute('aria-expanded', 'true');
    inst.marcado = inst.sel.selectedIndex;
    this._marcar(inst, [...inst.lista.querySelectorAll('.srf-item')]);
    inst.lista.setAttribute('tabindex', '-1');
    inst.lista.focus({ preventScroll: true });
    this._abertos.push(inst);

    if (!this._foraLigado) {
      /* UM ouvinte no documento para todos os filtros, e não um por
         instância: cinco filtros dariam cinco ouvintes fazendo a
         mesma pergunta a cada clique da página. */
      this._fora = (ev) => {
        this._abertos.slice().forEach(o => {
          if (!o.caixa.contains(ev.target)) this.fechar(o);
        });
      };
      document.addEventListener('mousedown', this._fora);
      this._foraLigado = true;
    }
  },

  fechar(inst, devolverFoco) {
    if (!inst.aberta) return;
    inst.aberta = false;
    inst.lista.hidden = true;
    inst.caixa.classList.remove('srf-aberta');
    inst.botao.setAttribute('aria-expanded', 'false');
    this._abertos = this._abertos.filter(o => o !== inst);
    if (devolverFoco) inst.botao.focus();
  },

  _escolher(inst, i) {
    if (i < 0 || i >= inst.sel.options.length) return;
    const mudou = inst.sel.selectedIndex !== i;
    inst.sel.selectedIndex = i;
    this._pintarBotao(inst);
    this._preencher(inst);
    this.fechar(inst, true);
    /* O `change` é disparado À MÃO porque mexer em `selectedIndex`
       por código NÃO dispara evento — e é dele que o Extrato vive.
       Esquecer esta linha faria o filtro parecer quebrado sem
       nenhum erro no console. */
    if (mudou) inst.sel.dispatchEvent(new Event('change', { bubbles: true }));
  },

  recarregar(sel) {
    const inst = sel && sel.closest('.srf') && sel.closest('.srf').__srf;
    if (!inst) return;
    this._preencher(inst);
    this._pintarBotao(inst);
  },

  _esc(s) {
    return String(s ?? '').replace(/[&<>"]/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  },
};

window.SrFiltro = SrFiltro;
