/* ============================================================
   eco.js — O ECO DO SISTEMA

   O momento em que o Sistema toma a tela e fala.

   DE ONDE ISTO VEIO

   O Arquiteto lembrou de frases de impacto ocupando a tela inteira do
   celular, e de nunca ter visto o mesmo no computador. A causa estava
   em `css/dungeon.css`:

       @media (max-width: 1100px) { .dg-col-feed { grid-column: 1/-1; } }

   Os "Ecos da Masmorra" são uma das três colunas no monitor e viram a
   largura inteira no celular. O efeito que ele amou NUNCA FOI
   DESENHADO — foi o grid se reorganizando.

   Este arquivo é esse acidente virando peça, e desta vez igual nos
   dois lugares.

   A COREOGRAFIA, em quatro tempos

     0,0s   a tela ESMAECE           blur + escurecimento, 700ms
     0,4s   o sussurro entra         áudio, baixo
     0,6s   a frase SE ASSENTA       de longe e espaçada, para perto
     2,8s   a frase RESPIRA          uma pulsação lenta
     4,5s   tudo se desfaz

   O DETALHE QUE FAZ FUNCIONAR: a tela não fica preta. Fica embaçada e
   escura, COM O CARTÃO FRACASSADO AINDA LEGÍVEL POR TRÁS. O Sistema
   não te tira do lugar — ele te faz olhar.

   Uso:
     Eco.mostrar({ texto, intensidade })       // e pronto
     Eco.mostrar({ ... , som: false })         // mudo
     Eco.fechar()                              // à força
   ============================================================ */

const Eco = {
  _fila: [],
  _emCena: false,
  _no: null,
  _timers: [],

  /* Quanto tempo cada intensidade fica. O Sistema frio demora mais —
     e a demora É a mensagem: ele não tem pressa. */
  DURACAO: {
    SECA:      4200,
    ENCARANDO: 4800,
    FRIA:      5600,
    VAZIO:     4200,
    QUITADO:   3400,   // a boa notícia não se arrasta
  },

  /* ── ENTRADA ──────────────────────────────────────────────
     Sempre pela fila. Dois ecos ao mesmo tempo viram ruído, e o
     projeto já resolveu isto uma vez nas cerimônias. */
  mostrar(eco) {
    if (!eco || !eco.texto) return;
    this._fila.push(eco);
    if (!this._emCena) this._proximo();
  },

  _proximo() {
    const eco = this._fila.shift();
    if (!eco) { this._emCena = false; return; }
    this._emCena = true;
    this._render(eco);
  },

  _render(eco) {
    this.fechar(true);      // limpa qualquer resto, sem tocar na fila

    const intens = (eco.intensidade || 'SECA').toUpperCase();
    const dur = this.DURACAO[intens] || this.DURACAO.SECA;

    const el = document.createElement('div');
    el.className = `eco eco-${intens.toLowerCase()}`;
    el.setAttribute('role', 'status');
    /* `aria-live=assertive`: quem usa leitor de tela precisa ouvir
       isto AGORA. É o único lugar do app onde interromper é o certo. */
    el.setAttribute('aria-live', 'assertive');
    el.innerHTML = `
      <div class="eco-veu"></div>
      <div class="eco-corpo">
        <div class="eco-marca" aria-hidden="true">${this._sigilo()}</div>
        <p class="eco-frase">${this._esc(eco.texto)}</p>
        ${eco.rodape ? `<p class="eco-rodape">${this._esc(eco.rodape)}</p>` : ''}
      </div>`;
    document.body.appendChild(el);
    this._no = el;

    // Um quadro depois, para a transição existir.
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));

    if (eco.som !== false) this._t(() => this._sussurrar(), 400);
    this._t(() => this._fecharEProsseguir(), dur);

    /* SAÍDA A QUALQUER MOMENTO. Um efeito bonito que prende o hunter
       deixa de ser bonito na terceira vez. */
    el.addEventListener('click', () => this._fecharEProsseguir());
    this._onKey = (ev) => {
      if (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        this._fecharEProsseguir();
      }
    };
    document.addEventListener('keydown', this._onKey);
  },

  /* O som é BÔNUS, nunca a peça.

     Navegador bloqueia autoplay até haver interação, e um fracasso
     costuma ser detectado numa carga de página — exatamente quando não
     houve clique nenhum. Se o áudio não vier, o Eco não muda em nada. */
  _sussurrar() {
    try {
      if (typeof SFX !== 'undefined' && SFX.play) { SFX.play('sussurro'); return; }
      const a = new Audio('/sounds/sussurro.mp3');
      a.volume = 0.45;
      a.play().catch(() => {});
    } catch (_) { /* mudo é um desfecho aceitável */ }
  },

  _fecharEProsseguir() {
    if (!this._no) return;
    const el = this._no;
    el.classList.remove('on');
    el.classList.add('saindo');
    this._limparTimers();
    if (this._onKey) { document.removeEventListener('keydown', this._onKey); this._onKey = null; }
    this._no = null;
    setTimeout(() => {
      el.remove();
      // Um respiro entre um eco e o outro. Emendados, viram uma coisa só.
      setTimeout(() => this._proximo(), 260);
    }, 520);
  },

  fechar(silencioso) {
    this._limparTimers();
    if (this._onKey) { document.removeEventListener('keydown', this._onKey); this._onKey = null; }
    if (this._no) { this._no.remove(); this._no = null; }
    if (!silencioso) { this._fila.length = 0; this._emCena = false; }
  },

  _t(fn, ms) { this._timers.push(setTimeout(fn, ms)); },
  _limparTimers() { this._timers.forEach(clearTimeout); this._timers = []; },

  _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  },

  /* O sigilo que abre o Eco. Um losango partido — o mesmo vocabulário
     geométrico do resto do app, sem virar ícone de alerta genérico. */
  _sigilo() {
    return `<svg viewBox="0 0 48 48" width="46" height="46" aria-hidden="true">
      <path d="M24 3 44 24 24 45 4 24Z" fill="none" stroke="currentColor"
            stroke-width="1.2" opacity=".55"/>
      <path d="M24 11 37 24 24 37 11 24Z" fill="none" stroke="currentColor"
            stroke-width="1.6"/>
      <path d="M24 17v9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <circle cx="24" cy="30.5" r="1.4" fill="currentColor"/>
    </svg>`;
  },

  /* ── Para a Forja e para quem quiser inspecionar ────────── */
  emCena() { return !!this._no; },
  naFila()  { return this._fila.length; },
};

if (typeof window !== 'undefined') window.Eco = Eco;
