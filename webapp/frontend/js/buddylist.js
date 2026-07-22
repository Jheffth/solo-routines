/* ============================================================
   buddylist.js — A Guilda (lista de amigos)

   Um drawer lateral ancorado no <body>. Abre por um botão que o
   orquestrador coloca no menu: chama BuddyList.abrir() (ou
   .alternar()). Vive fora de qualquer contêiner com clip-path,
   então a lista de busca de "adicionar amigo" mora dentro dele
   sem risco de ser recortada.

   Fonte de verdade: CONTRATO_SOCIAL.md. Consome API.social.* e
   API.hunters.buscar. Nada de reimplementar busca — chama o
   endpoint com debounce, igual busca-hunters.js.

   Presença: reaproveita as classes .pr-online|recente|hoje|
   ausente|sumido de hunter-publico.css (que só definem a COR do
   pontinho). Aqui não se redefine cor nenhuma de presença.

   Polling: enquanto ABERTO, API.social.novidades() a cada 5s
   atualiza os contadores. O timer é morto no fechar() — nada
   de setInterval vazando e multiplicando requisições.
   ============================================================ */

const BuddyList = {
  _raiz:    null,
  _aberto:  false,
  _dados:   null,   // último payload de API.social.amigos()
  _timer:   null,   // setInterval do polling — SEMPRE limpo ao fechar
  _buscaTimer: null,
  _ultimaBusca: '',
  _carregando: false,

  /* ── Ciclo de vida ─────────────────────────────────────── */
  abrir() {
    this._montar();
    if (this._aberto) { this.carregar(); return; }
    this._aberto = true;
    this._raiz.hidden = false;
    // força reflow para a transição de entrada valer
    void this._raiz.offsetWidth;
    this._raiz.classList.add('bl-on');
    document.addEventListener('keydown', this._onEsc);
    this.carregar();
    this._iniciarPolling();
  },

  fechar() {
    if (!this._aberto) return;
    this._aberto = false;
    this._pararPolling();
    clearTimeout(this._buscaTimer);
    document.removeEventListener('keydown', this._onEsc);
    if (this._raiz) {
      this._raiz.classList.remove('bl-on');
      // esconde depois da transição (guarda o estado atual num closure)
      const r = this._raiz;
      setTimeout(() => { if (!this._aberto) r.hidden = true; }, 260);
    }
  },

  alternar() { this._aberto ? this.fechar() : this.abrir(); },

  /* ── Construção do drawer (uma única vez) ──────────────── */
  _montar() {
    if (this._raiz) return;
    // Handlers com `this` amarrado — para poder add/removeEventListener
    this._onEsc = (e) => { if (e.key === 'Escape') this.fechar(); };

    const r = document.createElement('div');
    r.className = 'bl-raiz';
    r.id = 'buddylist-raiz';
    r.hidden = true;
    r.innerHTML = `
      <div class="bl-fundo" data-bl-fundo></div>
      <aside class="bl-drawer" role="dialog" aria-label="Guilda — seus amigos">
        <header class="bl-cab">
          <span class="bl-cab-tit">GUILDA</span>
          <span class="bl-cab-total" data-bl-total hidden></span>
          <button class="bl-cab-x" data-bl-fechar aria-label="Fechar">✕</button>
        </header>

        <div class="bl-add">
          <div class="bl-add-campo">
            <span class="bl-add-lupa">🔍</span>
            <input class="bl-add-input" data-bl-busca autocomplete="off"
                   spellcheck="false" placeholder="Adicionar hunter..."
                   aria-label="Procurar hunter para adicionar">
            <button class="bl-add-limpar" data-bl-limpar aria-label="Limpar" hidden>✕</button>
          </div>
          <div class="bl-add-res" data-bl-res hidden></div>
        </div>

        <div class="bl-corpo" data-bl-corpo>
          <div class="bl-spinner"><i></i></div>
        </div>
      </aside>`;
    document.body.appendChild(r);
    this._raiz = r;

    r.querySelector('[data-bl-fundo]').addEventListener('click', () => this.fechar());
    r.querySelector('[data-bl-fechar]').addEventListener('click', () => this.fechar());

    const input  = r.querySelector('[data-bl-busca]');
    const limpar = r.querySelector('[data-bl-limpar]');
    input.addEventListener('input', () => {
      const v = input.value.trim();
      limpar.hidden = !v;
      clearTimeout(this._buscaTimer);
      if (v.length < 2) { this._fecharBusca(); return; }
      this._buscaTimer = setTimeout(() => this._buscar(v), 350);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); this._fecharBusca(); input.blur(); }
    });
    limpar.addEventListener('click', () => {
      input.value = ''; limpar.hidden = true;
      this._fecharBusca(); input.focus();
    });
  },

  /* ── Carregar e desenhar a lista ───────────────────────── */
  async carregar() {
    if (!this._raiz) return;
    const corpo = this._raiz.querySelector('[data-bl-corpo]');
    if (!this._dados) corpo.innerHTML = '<div class="bl-spinner"><i></i></div>';
    try {
      const dados = await API.social.amigos();
      this._dados = dados;
      this._render();
    } catch (err) {
      corpo.innerHTML = `<div class="bl-vazio">⚠️ ${this._esc(err.message || 'Falha ao carregar')}</div>`;
    }
  },

  _render() {
    const d = this._dados || {};
    const corpo = this._raiz.querySelector('[data-bl-corpo]');
    const amigos = d.amigos || [];
    const pedidos = d.pendentes_recebidos || [];
    const enviados = d.pendentes_enviados || [];

    const online  = amigos.filter(a => a.presenca === 'online');
    const offline = amigos.filter(a => a.presenca !== 'online');

    // Badge total no cabeçalho
    const total = d.total_nao_lidas || 0;
    const elTotal = this._raiz.querySelector('[data-bl-total]');
    elTotal.textContent = total > 99 ? '99+' : total;
    elTotal.hidden = total <= 0;

    let html = '';

    if (pedidos.length) {
      html += this._secao('⚔️ Pedidos recebidos', pedidos.length,
        pedidos.map(p => this._pedidoHtml(p)).join(''));
    }

    html += this._secao(`🟢 Online`, online.length,
      online.length ? online.map(a => this._amigoHtml(a)).join('')
                    : '<div class="bl-nada">Ninguém online agora.</div>');

    html += this._secao(`🌙 Offline`, offline.length,
      offline.length ? offline.map(a => this._amigoHtml(a)).join('')
                     : '<div class="bl-nada">Sem amigos offline.</div>');

    if (enviados.length) {
      html += this._secao('📨 Pedidos enviados', enviados.length,
        enviados.map(p => this._enviadoHtml(p)).join(''));
    }

    if (!amigos.length && !pedidos.length && !enviados.length) {
      html = `<div class="bl-vazio">
                <div class="bl-vazio-ico">🛡️</div>
                Sua guilda está vazia.<br>Procure um hunter acima para começar.
              </div>`;
    }

    corpo.innerHTML = html;
    this._ligarEventos(corpo);
  },

  _secao(titulo, n, conteudoHtml) {
    return `
      <section class="bl-secao">
        <div class="bl-secao-cab">
          <span class="bl-secao-tit">${titulo}</span>
          <span class="bl-secao-n">${n}</span>
        </div>
        <div class="bl-secao-corpo">${conteudoHtml}</div>
      </section>`;
  },

  _avatarHtml(a) {
    const cls = 'pr-' + (a.presenca || 'sumido');
    const img = a.avatar_url
      ? `<img src="${this._esc(a.avatar_url)}" alt="">`
      : '🛡️';
    return `<span class="bl-av ${cls}">${img}<i class="bl-ponto"></i></span>`;
  },

  _amigoHtml(a) {
    const v = this._vistoEm(a.presenca, a.visto_ha_min);
    const nl = a.nao_lidas || 0;
    const badge = nl > 0
      ? `<span class="bl-nl" data-bl-nl>${nl > 99 ? '99+' : nl}</span>` : '';
    return `
      <div class="bl-linha" data-bl-amigo="${this._esc(a.login)}" data-bl-login="${this._esc(a.login)}"
           role="button" tabindex="0" aria-label="Conversar com ${this._esc(a.nome)}">
        ${this._avatarHtml(a)}
        <span class="bl-info">
          <span class="bl-nome">${this._esc(a.nome)}</span>
          <span class="bl-sub pr-${v.classe}">${v.txt}</span>
        </span>
        ${badge}
        <button class="bl-x" data-bl-remover="${this._esc(a.login)}"
                aria-label="Remover ${this._esc(a.nome)} da guilda">✕</button>
      </div>`;
  },

  _pedidoHtml(p) {
    return `
      <div class="bl-linha bl-linha-pedido">
        ${this._avatarHtml(p)}
        <span class="bl-info">
          <span class="bl-nome">${this._esc(p.nome)}</span>
          <span class="bl-sub">@${this._esc(p.login)} quer entrar na guilda</span>
        </span>
        <span class="bl-pedido-acoes">
          <button class="bl-bt bl-bt-sim" data-bl-aceitar="${p.amizade_id}"
                  aria-label="Aceitar ${this._esc(p.nome)}">✓</button>
          <button class="bl-bt bl-bt-nao" data-bl-recusar="${p.amizade_id}"
                  aria-label="Recusar ${this._esc(p.nome)}">✕</button>
        </span>
      </div>`;
  },

  _enviadoHtml(p) {
    return `
      <div class="bl-linha bl-linha-enviado">
        ${this._avatarHtml(p)}
        <span class="bl-info">
          <span class="bl-nome">${this._esc(p.nome)}</span>
          <span class="bl-sub">aguardando resposta…</span>
        </span>
        <button class="bl-x" data-bl-remover="${this._esc(p.login)}"
                aria-label="Cancelar pedido para ${this._esc(p.nome)}">✕</button>
      </div>`;
  },

  _ligarEventos(corpo) {
    corpo.querySelectorAll('[data-bl-amigo]').forEach(el => {
      const login = el.dataset.blAmigo;
      const ir = (e) => {
        if (e.target.closest('[data-bl-remover]')) return; // clique no ✕ não abre chat
        this._abrirChat(login);
      };
      el.addEventListener('click', ir);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ir(e); }
      });
    });
    corpo.querySelectorAll('[data-bl-aceitar]').forEach(b =>
      b.addEventListener('click', () => this._responder(+b.dataset.blAceitar, true)));
    corpo.querySelectorAll('[data-bl-recusar]').forEach(b =>
      b.addEventListener('click', () => this._responder(+b.dataset.blRecusar, false)));
    corpo.querySelectorAll('[data-bl-remover]').forEach(b =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this._remover(b.dataset.blRemover);
      }));
  },

  _abrirChat(login) {
    if (window.Chat && typeof window.Chat.abrir === 'function') {
      // Fecha o drawer: chat e BuddyList ancoram na mesma borda direita e
      // se sobreporiam. Um de cada vez mantém a tela limpa.
      this.fechar();
      window.Chat.abrir(login);
    } else {
      this._toast('O Chat ainda não está disponível.', 'warn');
    }
  },

  /* ── Ações que mutam a guilda (recarregam sozinhas) ────── */
  async _responder(amizadeId, aceitar) {
    try {
      await API.social.responder(amizadeId, aceitar);
      this._toast(aceitar ? '⚔️ Aliança firmada.' : 'Pedido recusado.', 'info');
      await this.carregar();
    } catch (err) { this._toast(err.message || String(err), 'error'); }
  },

  async _pedir(login) {
    try {
      const r = await API.social.pedir(login);
      const st = r?.status;
      this._toast(st === 'aceita' ? '⚔️ Vocês já são amigos.' : '📨 Pedido enviado.', 'info');
      this._fecharBusca();
      const input = this._raiz.querySelector('[data-bl-busca]');
      if (input) { input.value = ''; this._raiz.querySelector('[data-bl-limpar]').hidden = true; }
      await this.carregar();
    } catch (err) { this._toast(err.message || String(err), 'error'); }
  },

  async _remover(login) {
    try {
      await API.social.remover(login);
      await this.carregar();
    } catch (err) { this._toast(err.message || String(err), 'error'); }
  },

  /* ── Busca "adicionar amigo" (usa o endpoint, com debounce) ── */
  async _buscar(termo) {
    if (termo === this._ultimaBusca && !this._raiz.querySelector('[data-bl-res]').hidden) return;
    this._ultimaBusca = termo;
    const res = this._raiz.querySelector('[data-bl-res]');
    res.hidden = false;
    res.innerHTML = '<div class="bl-res-msg">Procurando…</div>';
    try {
      const { resultados } = await API.hunters.buscar(termo);
      if (this._ultimaBusca !== termo) return;          // outra busca assumiu
      if (!resultados || !resultados.length) {
        res.innerHTML = `<div class="bl-res-msg">Nenhum hunter começando com "${this._esc(termo)}".</div>`;
        return;
      }
      res.innerHTML = resultados.map(h => `
        <div class="bl-res-item">
          <span class="bl-av pr-${h.presenca || 'sumido'}">
            ${h.avatar_url ? `<img src="${this._esc(h.avatar_url)}" alt="">` : '🛡️'}
            <i class="bl-ponto"></i>
          </span>
          <span class="bl-info">
            <span class="bl-nome">${this._esc(h.nome)}
              ${h.eu_mesmo ? '<i class="bl-selo-eu">você</i>' : ''}</span>
            <span class="bl-sub">@${this._esc(h.login)} · ${this._esc(h.classe || 'E-Rank')} — Nv.${h.nivel_atual || 1}</span>
          </span>
          ${h.eu_mesmo ? ''
            : `<button class="bl-bt bl-bt-add" data-bl-pedir="${this._esc(h.login)}"
                       aria-label="Enviar pedido para ${this._esc(h.nome)}">+ Amigo</button>`}
        </div>`).join('');
      res.querySelectorAll('[data-bl-pedir]').forEach(b =>
        b.addEventListener('click', () => this._pedir(b.dataset.blPedir)));
    } catch (err) {
      res.innerHTML = `<div class="bl-res-msg">${this._esc(err.message || 'Falha na busca')}</div>`;
    }
  },

  _fecharBusca() {
    this._ultimaBusca = '';
    const res = this._raiz?.querySelector('[data-bl-res]');
    if (res) { res.hidden = true; res.innerHTML = ''; }
  },

  /* ── Polling leve: só contadores, enquanto aberto ──────── */
  _iniciarPolling() {
    this._pararPolling();
    this._timer = setInterval(() => this._novidades(), 5000);
  },
  _pararPolling() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  },

  async _novidades() {
    if (!this._aberto) { this._pararPolling(); return; }  // cinto de segurança
    try {
      const nv = await API.social.novidades();
      if (!this._aberto) return;
      this._aplicarNovidades(nv);
    } catch { /* rede instável: tenta de novo no próximo tick */ }
  },

  _aplicarNovidades(nv) {
    // Total no cabeçalho
    const total = nv?.total_nao_lidas || 0;
    const elTotal = this._raiz.querySelector('[data-bl-total]');
    if (elTotal) {
      elTotal.textContent = total > 99 ? '99+' : total;
      elTotal.hidden = total <= 0;
    }
    // Badge por amigo, sem redesenhar a lista toda
    const porHunter = nv?.por_hunter || {};
    this._raiz.querySelectorAll('[data-bl-login]').forEach(linha => {
      const login = linha.dataset.blLogin;
      const n = porHunter[login] || 0;
      let badge = linha.querySelector('[data-bl-nl]');
      if (n > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'bl-nl';
          badge.dataset.blNl = '1';
          const xBtn = linha.querySelector('[data-bl-remover]');
          linha.insertBefore(badge, xBtn || null);
        }
        badge.textContent = n > 99 ? '99+' : n;
      } else if (badge) {
        badge.remove();
      }
    });
    // Se o nº de pedidos recebidos mudou, precisamos dos detalhes: recarrega.
    const pedAgora = (this._dados?.pendentes_recebidos || []).length;
    if (typeof nv?.pedidos_recebidos === 'number' && nv.pedidos_recebidos !== pedAgora) {
      this.carregar();
    }
  },

  /* ── Presença em texto — espelho de hunter-publico.js::_vistoEm.
     O contrato de /social/amigos entrega `presenca` (a faixa). Se o
     backend também mandar `visto_ha_min`, damos o texto exato; senão,
     caímos num rótulo por faixa. ─────────────────────────────────── */
  _vistoEm(presenca, min) {
    if (presenca === 'online') return { txt: 'online agora', classe: 'online' };
    if (min === null || min === undefined) {
      const rotulo = {
        recente: 'visto há pouco',
        hoje:    'visto hoje',
        ausente: 'visto esta semana',
        sumido:  'há muito tempo',
      }[presenca] || 'offline';
      return { txt: rotulo, classe: presenca || 'sumido' };
    }
    if (min < 60)  return { txt: `visto há ${min} min`, classe: presenca };
    const h = Math.floor(min / 60);
    if (h < 24)    return { txt: `visto há ${h}h`, classe: presenca };
    const dd = Math.floor(h / 24);
    if (dd === 1)  return { txt: 'visto ontem', classe: presenca };
    if (dd < 7)    return { txt: `visto há ${dd} dias`, classe: presenca };
    if (dd < 30)   return { txt: `visto há ${Math.floor(dd / 7)} sem`, classe: presenca };
    const m = Math.floor(dd / 30);
    return { txt: `visto há ${m} ${m === 1 ? 'mês' : 'meses'}`, classe: 'sumido' };
  },

  /* ── Utilidades ────────────────────────────────────────── */
  _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  _toast(msg, tipo) {
    if (window.SoloDialog && typeof window.SoloDialog.toast === 'function') {
      window.SoloDialog.toast(msg, tipo || 'info');
    }
  },
};

window.BuddyList = BuddyList;
