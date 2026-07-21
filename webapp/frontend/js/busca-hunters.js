/* ============================================================
   busca-hunters.js — Procurar um hunter

   Vive em mais de um lugar: no cabeçalho da página inicial e
   dentro do perfil público (senão o perfil é um beco sem saída —
   você chega em alguém e não tem como ir para outro).

   Por isso o componente é MULTI-INSTÂNCIA. Nada de `id` nos
   campos: dois campos com o mesmo id na mesma página quebram
   getElementById em silêncio, e o bug só aparece quando alguém
   digita no segundo. Aqui cada instância guarda suas próprias
   referências, e a lista de resultados é uma só, compartilhada,
   ancorada no <body>.

   Por que é leve: o backend busca por PREFIXO (usa índice) e
   devolve no máximo 8 resultados com seis campos. Medido: ~3ms e
   1 KB. Com debounce de 350ms, uma busca inteira custa 2 ou 3
   requisições minúsculas.

   O que NÃO fazer aqui: chamar /emblemas/hunters e filtrar no
   navegador. Aquela rota devolve todo mundo com todos os
   emblemas — 1,3 MB para 2.000 hunters.
   ============================================================ */

const BuscaHunters = {
  _lista:    null,   // painel único de resultados, no <body>
  _ativa:    null,   // instância que está com a lista aberta
  _instancias: [],

  /* container: elemento ou id. Pode ser chamado quantas vezes for
     preciso; cada container só é preparado uma vez. */
  montar(container = 'busca-hunters', opcoes = {}) {
    const cx = typeof container === 'string'
      ? document.getElementById(container) : container;
    if (!cx || cx.dataset.bhPronto) return;
    cx.dataset.bhPronto = '1';

    cx.innerHTML = `
      <div class="bh-campo">
        <span class="bh-lupa">🔍</span>
        <input class="bh-input" autocomplete="off" spellcheck="false"
               placeholder="${opcoes.placeholder || 'Procurar hunter...'}"
               aria-label="Procurar hunter">
        <button class="bh-limpar" aria-label="Limpar" hidden>✕</button>
      </div>`;

    const inst = {
      cx,
      campo:  cx.querySelector('.bh-campo'),
      input:  cx.querySelector('.bh-input'),
      limpar: cx.querySelector('.bh-limpar'),
      voltarPara: opcoes.voltarPara || 'dashboard',
      timer: null, ultimo: '',
    };
    // O perfil refaz o innerHTML a cada hunter visitado, então o container
    // anterior é descartado e montar() roda de novo. Sem esta limpeza, o
    // array cresceria a cada navegação segurando nós já fora do DOM.
    this._instancias = this._instancias.filter(i => i.cx.isConnected);
    this._instancias.push(inst);
    this._garantirLista();

    inst.input.addEventListener('input', () => {
      const v = inst.input.value.trim();
      inst.limpar.hidden = !v;
      clearTimeout(inst.timer);
      if (v.length < 2) { this._fechar(); return; }
      inst.timer = setTimeout(() => this._buscar(inst, v), 350);
    });

    inst.input.addEventListener('keydown', e => {
      if (e.key === 'Escape') { this._fechar(); inst.input.blur(); }
      if (e.key === 'Enter') {
        const primeiro = this._lista?.querySelector('[data-bh-login]');
        if (primeiro) this._abrir(inst, primeiro.dataset.bhLogin);
      }
    });

    inst.limpar.addEventListener('click', () => {
      inst.input.value = ''; inst.limpar.hidden = true;
      this._fechar(); inst.input.focus();
    });
  },

  /* A lista mora no <body>, não dentro do campo. Motivo: a placa do
     cabeçalho usa clip-path para os cantos chanfrados, e clip-path
     RECORTA tudo que passa da borda — a lista sairia cortada ao meio. */
  _garantirLista() {
    if (this._lista) return;
    const l = document.createElement('div');
    l.className = 'bh-resultados';
    l.id = 'bh-resultados';
    l.hidden = true;
    document.body.appendChild(l);
    this._lista = l;

    const acompanhar = () => { if (this._ativa) this._posicionar(); };
    window.addEventListener('scroll', acompanhar, true);
    window.addEventListener('resize', acompanhar);
    document.addEventListener('click', e => {
      if (!this._ativa) return;
      const dentro = this._ativa.cx.contains(e.target) || l.contains(e.target);
      if (!dentro) this._fechar();
    });
  },

  /* Alinha pela direita quando o campo está no canto direito da tela,
     senão pela esquerda — e nunca deixa sair da janela. */
  _posicionar() {
    const inst = this._ativa;
    if (!inst || !this._lista) return;
    const r = inst.campo.getBoundingClientRect();
    const largura = Math.max(r.width, 280);
    const direita = r.left > window.innerWidth / 2;
    let esquerda = direita ? r.right - largura : r.left;
    esquerda = Math.max(8, Math.min(esquerda, window.innerWidth - largura - 8));
    this._lista.style.top   = `${r.bottom + 6}px`;
    this._lista.style.left  = `${esquerda}px`;
    this._lista.style.width = `${largura}px`;
  },

  async _buscar(inst, termo) {
    if (inst === this._ativa && termo === inst.ultimo) return;
    inst.ultimo = termo;
    this._ativa = inst;
    const l = this._lista;
    if (!l) return;
    l.hidden = false;
    this._posicionar();
    l.innerHTML = '<div class="bh-carregando">Procurando...</div>';
    try {
      const { resultados } = await API.hunters.buscar(termo);
      if (this._ativa !== inst) return;          // outra busca assumiu
      if (!resultados.length) {
        l.innerHTML = `<div class="bh-vazio">Nenhum hunter começando com "${termo}"</div>`;
        return;
      }
      l.innerHTML = resultados.map(h => `
        <button class="bh-item" data-bh-login="${h.login}">
          <span class="bh-av pr-${h.presenca || 'sumido'}">
            ${h.avatar_url ? `<img src="${h.avatar_url}" alt="">` : '🛡️'}
            <i class="bh-ponto"></i>
          </span>
          <span class="bh-info">
            <span class="bh-nome">${h.nome}</span>
            <span class="bh-sub">@${h.login} · ${h.classe || 'E-Rank'} — Nv.${h.nivel_atual || 1}</span>
          </span>
          <span class="bh-seta">→</span>
        </button>`).join('');
      l.querySelectorAll('[data-bh-login]').forEach(b =>
        b.addEventListener('click', () => this._abrir(inst, b.dataset.bhLogin)));
    } catch (err) {
      l.innerHTML = `<div class="bh-vazio">${err.message || 'Falha na busca'}</div>`;
    }
  },

  _abrir(inst, login) {
    this._fechar();
    inst.input.value = '';
    inst.limpar.hidden = true;
    inst.ultimo = '';
    window.HunterPublico?.abrir(login, inst.voltarPara);
  },

  _fechar() {
    if (this._lista) { this._lista.hidden = true; this._lista.innerHTML = ''; }
    if (this._ativa) this._ativa.ultimo = '';
    this._ativa = null;
  },
};

window.BuscaHunters = BuscaHunters;
