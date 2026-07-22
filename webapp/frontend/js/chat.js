/* ============================================================
   chat.js — A Conversa Privada (1-a-1)

   Uma janela flutuante, ancorada no canto inferior direito,
   que vive no <body>. Uma só instância reaproveitada: abrir a
   conversa de outro hunter troca o conteúdo, não cria outra
   janela.

   Contrato de API (js/api.js):
     API.social.conversa(login, antesDe)
       -> { com:{id,login,nome,avatar_url,presenca,aura},
            mensagens:[{id,de_mim,corpo,quando,lida}],  # cronológica
            ha_mais:bool }
     API.social.enviar(login, corpo)
       -> { ok, mensagem:{id,de_mim:true,corpo,quando,lida:false} }
       403 se não forem amigos.

   Armadilhas obedecidas (CONTRATO_SOCIAL.md):
     - Todo setInterval de polling é limpo ao fechar (clearInterval).
     - A janela mora no <body> (escapa de clip-path de contêineres).
     - Nada de title="" — presença e nome falam por si.
   ============================================================ */

const Chat = {
  /* ── Estado ──────────────────────────────────────────────── */
  _win: null,        // raiz da janela (montada uma vez)
  _cab: null,        // cabeçalho (avatar/nome/presença)
  _corpo: null,      // contêiner rolável
  _lista: null,      // onde as bolhas vivem
  _btnMais: null,    // "carregar mais antigas"
  _input: null,
  _avisoEl: null,
  _login: null,      // hunter da conversa atual
  _com: null,        // dados do interlocutor
  _ids: new Set(),   // ids já renderizados (dedup do polling)
  _maisAntiga: null, // `quando` da mensagem mais velha visível
  _haMais: false,
  _timer: null,      // setInterval do polling
  _buscando: false,  // trava reentrância do polling
  _carregandoMais: false,
  _seq: 0,           // gera ids otimistas temporários

  /* ── API pública ─────────────────────────────────────────── */
  abrir(login) {
    if (!login) return;
    this._montar();

    this._login = login;
    this._win.hidden = false;
    this._win.classList.add('ch-visivel');

    // Zera o estado da conversa anterior antes de carregar a nova.
    this._ids.clear();
    this._com = null;
    this._maisAntiga = null;
    this._haMais = false;
    this._lista.innerHTML = '';
    this._aviso('');
    this._input.value = '';
    this._ajustarAltura();
    this._renderCabecalho();
    this._atualizarBotaoMais();
    this._placeholder('Invocando a conversa…');
    this._input.focus();

    this._carregarInicial(login);
  },

  fechar() {
    // A limpeza do timer é a parte inegociável: sem ela, o polling
    // continua batendo no servidor com a janela fechada.
    this._pararPolling();
    if (this._win) {
      this._win.hidden = true;
      this._win.classList.remove('ch-visivel');
    }
    this._login = null;
  },

  /* ── Montagem (uma única vez) ─────────────────────────────── */
  _montar() {
    if (this._win) return;

    const win = document.createElement('div');
    win.className = 'ch-janela';
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-label', 'Conversa privada');
    win.hidden = true;
    win.innerHTML =
      '<header class="ch-cabecalho"></header>' +
      '<div class="ch-corpo">' +
        '<button type="button" class="ch-mais" hidden>Carregar mais antigas</button>' +
        '<div class="ch-lista" aria-live="polite"></div>' +
      '</div>' +
      '<div class="ch-aviso" role="alert" hidden></div>' +
      '<footer class="ch-rodape">' +
        '<textarea class="ch-input" rows="1" maxlength="2000" ' +
          'placeholder="Escreva uma mensagem…" aria-label="Mensagem"></textarea>' +
        '<button type="button" class="ch-enviar" aria-label="Enviar">➤</button>' +
      '</footer>';

    document.body.appendChild(win);

    this._win     = win;
    this._cab     = win.querySelector('.ch-cabecalho');
    this._corpo   = win.querySelector('.ch-corpo');
    this._lista   = win.querySelector('.ch-lista');
    this._btnMais = win.querySelector('.ch-mais');
    this._input   = win.querySelector('.ch-input');
    this._avisoEl = win.querySelector('.ch-aviso');
    const btnEnviar = win.querySelector('.ch-enviar');

    // ── Eventos ──
    this._btnMais.addEventListener('click', () => this._carregarMais());
    btnEnviar.addEventListener('click', () => this._enviar());

    this._input.addEventListener('keydown', (e) => {
      // Enter envia; Shift+Enter quebra linha.
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._enviar();
      }
    });
    this._input.addEventListener('input', () => this._ajustarAltura());

    // Delegação: cabeçalho carrega o botão de fechar (é re-renderizado).
    this._cab.addEventListener('click', (e) => {
      if (e.target.closest('.ch-fechar')) this.fechar();
    });
  },

  /* ── Cabeçalho ────────────────────────────────────────────── */
  _renderCabecalho() {
    const com = this._com;
    const nome = (com && com.nome) || (this._login ? '@' + this._login : '');
    const pres = this._presenca(com);
    this._cab.innerHTML =
      '<div class="ch-av pr-' + pres.classe + '">' +
        this._avatarInterno(com) +
        '<i class="ch-ponto"></i>' +
      '</div>' +
      '<div class="ch-ident">' +
        '<div class="ch-nome">' + this._esc(nome) + '</div>' +
        '<div class="ch-presenca pr-' + pres.classe + '">' +
          '<i class="ch-ponto-txt"></i>' + this._esc(pres.txt) +
        '</div>' +
      '</div>' +
      '<button type="button" class="ch-fechar" aria-label="Fechar conversa">✕</button>';
  },

  _avatarInterno(com) {
    if (com && com.avatar_url) {
      return '<img src="' + this._esc(com.avatar_url) + '" alt="">';
    }
    const base = (com && com.nome) || this._login || '?';
    return '<span class="ch-inicial">' + this._esc(base.trim().charAt(0).toUpperCase() || '?') + '</span>';
  },

  /* Presença: mesma lógica textual de hunter-publico._vistoEm.
     `com` só garante `presenca`; se vier `visto_ha_min`, usamos o
     texto exato "visto há X"; senão caímos num rótulo por faixa. */
  _presenca(com) {
    if (!com) return { txt: '', classe: 'sumido' };
    const p = com.presenca || 'sumido';
    if (p === 'online') return { txt: 'online agora', classe: 'online' };

    const min = com.visto_ha_min;
    if (min === null || min === undefined) {
      const rotulo = {
        recente: 'visto há pouco',
        hoje: 'visto hoje',
        ausente: 'visto esta semana',
        sumido: 'há muito tempo',
      };
      return { txt: rotulo[p] || 'offline', classe: p };
    }
    if (min < 60) return { txt: `visto há ${min} min`, classe: p };
    const h = Math.floor(min / 60);
    if (h < 24) return { txt: `visto há ${h}h`, classe: p };
    const d = Math.floor(h / 24);
    if (d === 1) return { txt: 'visto ontem', classe: p };
    if (d < 7) return { txt: `visto há ${d} dias`, classe: p };
    if (d < 30) return { txt: `visto há ${Math.floor(d / 7)} sem`, classe: p };
    const m = Math.floor(d / 30);
    return { txt: `visto há ${m} ${m === 1 ? 'mês' : 'meses'}`, classe: 'sumido' };
  },

  /* ── Carga inicial ────────────────────────────────────────── */
  async _carregarInicial(login) {
    try {
      const r = await API.social.conversa(login);
      // A janela pode ter fechado ou trocado de hunter durante o await.
      if (this._login !== login) return;

      this._com = r.com || null;
      this._renderCabecalho();
      this._haMais = !!r.ha_mais;

      const ms = r.mensagens || [];
      this._lista.innerHTML = '';
      ms.forEach((m) => this._appendMsg(m));
      if (ms.length) this._maisAntiga = ms[0].quando;
      if (!ms.length) this._placeholder('Nenhuma mensagem ainda. Diga olá.');

      this._atualizarBotaoMais();
      this._irAoFim();
    } catch (err) {
      if (this._login !== login) return;
      this._placeholder('');
      this._aviso(err && err.message ? err.message : 'Não foi possível abrir a conversa.');
    } finally {
      // Só começa o polling depois da carga inicial e se a janela
      // continua aberta neste mesmo hunter — evita corrida e vazamento.
      if (this._login === login && this._win && !this._win.hidden) {
        this._iniciarPolling();
      }
    }
  },

  /* ── Polling: mensagens novas a cada ~4s ──────────────────── */
  _iniciarPolling() {
    this._pararPolling();
    this._timer = setInterval(() => this._buscarNovas(), 4000);
  },

  _pararPolling() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  },

  async _buscarNovas() {
    if (this._buscando || !this._login) return;
    const login = this._login;
    this._buscando = true;
    try {
      const r = await API.social.conversa(login);
      if (this._login !== login || !this._win || this._win.hidden) return;

      if (r.com) { this._com = r.com; this._renderCabecalho(); }

      const perto = this._pertoDoFim();
      let novas = 0;
      (r.mensagens || []).forEach((m) => {
        if (!this._ids.has(m.id)) { this._appendMsg(m); novas++; }
      });
      // Só puxa o scroll se o usuário já estava lendo o fim; se ele
      // rolou para cima lendo o histórico, não o arrancamos de lá.
      if (novas && perto) this._irAoFim();
    } catch (err) {
      /* Polling falha em silêncio: um soluço de rede não vira aviso. */
    } finally {
      this._buscando = false;
    }
  },

  /* ── Carregar mais antigas ────────────────────────────────── */
  async _carregarMais() {
    if (this._carregandoMais || !this._maisAntiga || !this._login) return;
    const login = this._login;
    this._carregandoMais = true;
    this._btnMais.disabled = true;
    this._btnMais.textContent = 'Carregando…';

    const alturaAntes = this._corpo.scrollHeight;
    try {
      const r = await API.social.conversa(login, this._maisAntiga);
      if (this._login !== login) return;

      const antigas = (r.mensagens || []).filter((m) => !this._ids.has(m.id));
      this._prependMsgs(antigas);
      this._haMais = !!r.ha_mais;
      if (antigas.length) this._maisAntiga = antigas[0].quando;

      // Preserva a posição de leitura: o conteúdo cresceu para cima,
      // então o scrollTop precisa compensar a altura acrescida.
      this._corpo.scrollTop = this._corpo.scrollHeight - alturaAntes;
    } catch (err) {
      this._aviso('Não foi possível carregar mensagens antigas.');
    } finally {
      this._carregandoMais = false;
      this._btnMais.disabled = false;
      this._btnMais.textContent = 'Carregar mais antigas';
      this._atualizarBotaoMais();
    }
  },

  _atualizarBotaoMais() {
    this._btnMais.hidden = !this._haMais;
  },

  /* ── Envio (otimista) ─────────────────────────────────────── */
  async _enviar() {
    const corpo = (this._input.value || '').trim();
    if (!corpo || !this._login) return;
    const login = this._login;

    this._input.value = '';
    this._ajustarAltura();
    this._aviso('');

    const tmpId = 'tmp-' + (++this._seq);
    const bolha = this._appendMsg({
      id: tmpId,
      de_mim: true,
      corpo: corpo,
      quando: new Date().toISOString(),
      lida: false,
    });
    if (bolha) bolha.classList.add('ch-pendente');
    this._irAoFim();

    try {
      const r = await API.social.enviar(login, corpo);
      const m = r && r.mensagem;
      const el = this._lista.querySelector('[data-id="' + tmpId + '"]');

      if (m && el) {
        // Se o polling já trouxe esta mensagem (mesmo id real), a bolha
        // temporária vira duplicata: descartamos a temporária.
        if (this._ids.has(m.id)) {
          el.remove();
          this._ids.delete(tmpId);
        } else {
          el.dataset.id = m.id;
          this._ids.delete(tmpId);
          this._ids.add(m.id);
          el.classList.remove('ch-pendente');
          const hora = el.querySelector('.ch-hora');
          if (hora) hora.textContent = this._hora(m.quando);
        }
      } else if (m) {
        this._ids.delete(tmpId);
        this._ids.add(m.id);
      }
    } catch (err) {
      // Ex.: 403 "não são amigos". A bolha fica marcada como falha e o
      // motivo aparece no aviso.
      const el = this._lista.querySelector('[data-id="' + tmpId + '"]');
      if (el) { el.classList.remove('ch-pendente'); el.classList.add('ch-falhou'); }
      this._aviso(err && err.message ? err.message : 'Não foi possível enviar a mensagem.');
    }
  },

  /* ── Bolhas ───────────────────────────────────────────────── */
  _bolha(msg) {
    const div = document.createElement('div');
    div.className = 'ch-bolha ' + (msg.de_mim ? 'ch-minha' : 'ch-dele');
    div.dataset.id = msg.id;

    const corpo = document.createElement('div');
    corpo.className = 'ch-texto';
    corpo.textContent = msg.corpo || '';   // textContent: nunca injeta HTML do outro

    const meta = document.createElement('div');
    meta.className = 'ch-meta';
    const hora = document.createElement('span');
    hora.className = 'ch-hora';
    hora.textContent = this._hora(msg.quando);
    meta.appendChild(hora);

    div.appendChild(corpo);
    div.appendChild(meta);
    return div;
  },

  _appendMsg(msg) {
    if (msg.id != null) this._ids.add(msg.id);
    this._limparPlaceholder();
    const el = this._bolha(msg);
    this._lista.appendChild(el);
    return el;
  },

  _prependMsgs(lista) {
    if (!lista || !lista.length) return;
    const frag = document.createDocumentFragment();
    lista.forEach((m) => {
      if (m.id != null) this._ids.add(m.id);
      frag.appendChild(this._bolha(m));
    });
    this._lista.insertBefore(frag, this._lista.firstChild);
  },

  /* ── Utilidades ───────────────────────────────────────────── */
  _pertoDoFim() {
    const c = this._corpo;
    return (c.scrollHeight - c.scrollTop - c.clientHeight) < 60;
  },

  _irAoFim() {
    this._corpo.scrollTop = this._corpo.scrollHeight;
  },

  _ajustarAltura() {
    const t = this._input;
    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight, 120) + 'px';
  },

  _aviso(txt) {
    if (!this._avisoEl) return;
    this._avisoEl.textContent = txt || '';
    this._avisoEl.hidden = !txt;
  },

  _placeholder(txt) {
    if (!txt) { this._limparPlaceholder(); return; }
    this._lista.innerHTML = '<div class="ch-placeholder">' + this._esc(txt) + '</div>';
  },

  _limparPlaceholder() {
    const ph = this._lista.querySelector('.ch-placeholder');
    if (ph) ph.remove();
  },

  _hora(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  },

  _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },
};

window.Chat = Chat;
