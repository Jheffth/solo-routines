/* ============================================================
   altar-reliquias.js — O hunter escolhe o que exibir

   A Janela de Status mostrava as relíquias mais recentes e
   quebrava a linha ao passar de cinco — a sexta caía sozinha,
   órfã. Além de feio, tirava do dono a decisão sobre o que
   mostrar, que numa vitrine importa tanto quanto o que se tem.

   Agora são cinco, escolhidas por ele. Sem escolha, o Sistema
   usa as mais recentes — ninguém começa com o altar vazio.
   ============================================================ */

const AltarReliquias = {
  _acervo: [],
  _sel: new Set(),
  _limite: 5,
  _aoSalvar: null,

  async abrir(aoSalvar) {
    this._aoSalvar = aoSalvar;
    try {
      const d = await API.perfil.reliquias();
      this._acervo = d.acervo || [];
      this._limite = d.limite || 5;
      this._sel = new Set(d.fixadas && d.fixadas.length
        ? d.fixadas
        : this._acervo.slice(0, this._limite).map(r => r.codigo));
      this._render();
    } catch (err) {
      SoloDialog?.toast?.(err.message || 'Não foi possível abrir o altar', 'error');
    }
  },

  _medalha(r, tam = 62) {
    return (typeof ConquistaFX !== 'undefined' && ConquistaFX.miniMedalha)
      ? ConquistaFX.miniMedalha(r, tam)
      : `<span style="font-size:${tam * .5}px">${r.icone || '🏆'}</span>`;
  },

  _render() {
    document.getElementById('altar-overlay')?.remove();
    const cx = document.createElement('div');
    cx.id = 'altar-overlay';
    cx.className = 'al-overlay';
    cx.innerHTML = `
      <div class="al-painel">
        <div class="al-cab">
          <div>
            <div class="al-titulo">Altar de Relíquias</div>
            <div class="al-sub">Escolha até ${this._limite} para exibir na sua vitrine</div>
          </div>
          <button class="al-x" id="al-fechar" aria-label="Fechar">✕</button>
        </div>

        <div class="al-contador" id="al-contador"></div>
        <div class="al-grade" id="al-grade">
          ${this._acervo.length ? this._acervo.map(r => `
            <button class="al-item ${this._sel.has(r.codigo) ? 'on' : ''}"
                    data-al="${r.codigo}" title="${r.titulo}">
              <span class="al-med">${this._medalha(r)}</span>
              <span class="al-nome">${r.titulo}</span>
              <span class="al-marca">✓</span>
            </button>`).join('')
            : '<div class="al-vazio">Você ainda não tem relíquias.</div>'}
        </div>

        <div class="al-rodape">
          <button class="al-btn-limpar" id="al-limpar">Usar as mais recentes</button>
          <button class="al-btn-salvar" id="al-salvar">Fixar no altar</button>
        </div>
      </div>`;
    document.body.appendChild(cx);

    cx.addEventListener('click', e => { if (e.target === cx) cx.remove(); });
    document.getElementById('al-fechar').addEventListener('click', () => cx.remove());
    document.getElementById('al-limpar').addEventListener('click', () => this._salvar([]));
    document.getElementById('al-salvar').addEventListener('click', () => this._salvar([...this._sel]));

    cx.querySelectorAll('[data-al]').forEach(b =>
      b.addEventListener('click', () => this._alternar(b)));
    this._atualizar();
  },

  _alternar(b) {
    const cod = b.dataset.al;
    if (this._sel.has(cod)) { this._sel.delete(cod); b.classList.remove('on'); }
    else {
      if (this._sel.size >= this._limite) {
        SoloDialog?.toast?.(`O altar comporta ${this._limite} relíquias`, 'info');
        return;
      }
      this._sel.add(cod); b.classList.add('on');
    }
    this._atualizar();
  },

  _atualizar() {
    const el = document.getElementById('al-contador');
    if (el) el.innerHTML = `<b>${this._sel.size}</b> de ${this._limite} escolhidas`;
  },

  async _salvar(codigos) {
    try {
      await API.perfil.definirReliquias(codigos);
      if (typeof SFX !== 'undefined') SFX.play('carimbo');
      SoloDialog?.toast?.(codigos.length
        ? `${codigos.length} relíquia(s) fixada(s) no altar`
        : 'O altar voltará a mostrar as mais recentes', 'success');
      document.getElementById('altar-overlay')?.remove();
      this._aoSalvar?.();
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
    }
  },
};

window.AltarReliquias = AltarReliquias;
