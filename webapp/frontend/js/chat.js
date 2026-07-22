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
  _digitandoEl: null, // linha "digitando…" acima do campo
  _login: null,      // hunter da conversa atual
  _com: null,        // dados do interlocutor
  _ids: new Set(),   // ids já renderizados (dedup do polling)
  _maisAntiga: null, // `quando` da mensagem mais velha visível
  _haMais: false,
  _timer: null,      // setInterval do polling
  _digThrottle: null,// setTimeout do throttle do heartbeat "digitando"
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
    this._mostrarDigitando(false);
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
    this._mostrarDigitando(false);
    this._fecharMenuBolha();   // não deixa o menu flutuante órfão no body
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
      '<div class="ch-digitando" hidden aria-hidden="true">' +
        '<span class="ch-dig-pontos"><i></i><i></i><i></i></span>' +
        '<span class="ch-dig-txt">digitando…</span>' +
      '</div>' +
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
    this._digitandoEl = win.querySelector('.ch-digitando');
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
    this._input.addEventListener('input', () => {
      this._ajustarAltura();
      this._talvezDigitando();
    });

    // Delegação: o cabeçalho é re-renderizado a cada poll, então os botões
    // dele são tratados por delegação, não por bind direto.
    this._cab.addEventListener('click', (e) => {
      if (e.target.closest('.ch-fechar')) this.fechar();
      else if (e.target.closest('.ch-limpar')) this._limparConversa();
    });

    this._instalarArrasto();
  },

  /* ── Janela arrastável ────────────────────────────────────────────
     Segura o cabeçalho e arrasta. Ao começar, troca a ancoragem de
     right/bottom para left/top (senão o arrasto brigaria com o CSS).
     O cabeçalho é re-renderizado a cada poll, mas o CONTÊINER `_cab`
     persiste — então basta ligar o mousedown nele uma vez. */
  _instalarArrasto() {
    const iniciar = (px, py) => {
      const r = this._win.getBoundingClientRect();
      // Fixa a posição atual em left/top e solta o right/bottom.
      this._win.style.left   = r.left + 'px';
      this._win.style.top    = r.top + 'px';
      this._win.style.right  = 'auto';
      this._win.style.bottom = 'auto';
      this._dragDX = px - r.left;
      this._dragDY = py - r.top;
      this._win.classList.add('ch-arrastando');
    };
    const mover = (px, py) => {
      const w = this._win.offsetWidth, h = this._win.offsetHeight;
      let x = px - this._dragDX, y = py - this._dragDY;
      // Não deixa sumir da tela: mantém uma margem visível.
      x = Math.max(8 - w + 60, Math.min(x, window.innerWidth - 60));
      y = Math.max(8, Math.min(y, window.innerHeight - 40));
      this._win.style.left = x + 'px';
      this._win.style.top  = y + 'px';
    };
    const soltar = () => {
      this._win.classList.remove('ch-arrastando');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', soltar);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', soltar);
    };
    const onMove = (e) => mover(e.clientX, e.clientY);
    const onTouchMove = (e) => {
      if (!e.touches[0]) return;
      mover(e.touches[0].clientX, e.touches[0].clientY);
      e.preventDefault();
    };

    this._cab.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;   // clique em ✕/🧹 não arrasta
      iniciar(e.clientX, e.clientY);
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', soltar);
      e.preventDefault();
    });
    this._cab.addEventListener('touchstart', (e) => {
      if (e.target.closest('button') || !e.touches[0]) return;
      iniciar(e.touches[0].clientX, e.touches[0].clientY);
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', soltar);
    }, { passive: true });
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
      '<button type="button" class="ch-limpar" aria-label="Limpar conversa" title="Limpar conversa (só para você)">🧹</button>' +
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
      this._mostrarDigitando(!!(r.com && r.com.digitando));
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
  /* Maior id REAL já visto (ignora as bolhas otimistas "tmp-N", que não
     existem no servidor). null se ainda não há nada — aí o poll pega tudo. */
  _maiorId() {
    let max = 0;
    this._ids.forEach((id) => {
      if (typeof id === 'number' && id > max) max = id;
    });
    return max || null;
  },

  _iniciarPolling() {
    this._pararPolling();
    this._timer = setInterval(() => this._buscarNovas(), 3000);
  },

  _pararPolling() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    // O throttle do "digitando" também é um timer: não pode vazar ao fechar.
    if (this._digThrottle) {
      clearTimeout(this._digThrottle);
      this._digThrottle = null;
    }
  },

  async _buscarNovas() {
    if (this._buscando || !this._login) return;
    const login = this._login;
    this._buscando = true;
    try {
      // Poll leve: manda o maior id que já temos; o servidor devolve só o
      // que chegou depois, em vez de reenviar as últimas 40 a cada 3s.
      const r = await API.social.conversa(login, null, this._maiorId());
      if (this._login !== login || !this._win || this._win.hidden) return;

      if (r.com) { this._com = r.com; this._renderCabecalho(); }

      const perto = this._pertoDoFim();
      let novas = 0;
      let novasDele = 0;   // mensagens novas do interlocutor
      (r.mensagens || []).forEach((m) => {
        if (!this._ids.has(m.id)) {
          this._appendMsg(m);
          novas++;
          if (!m.de_mim) novasDele++;
        }
      });
      // Só puxa o scroll se o usuário já estava lendo o fim; se ele
      // rolou para cima lendo o histórico, não o arrancamos de lá.
      if (novas && perto) this._irAoFim();

      // Reconcilia lápides: mensagens que o outro apagou PARA TODOS têm id
      // antigo, então o poll leve não as traz como "novas". A lista
      // r.apagadas diz quais viraram lápide — convertemos as bolhas na hora.
      if (Array.isArray(r.apagadas)) {
        r.apagadas.forEach((id) => this._virarLapide(id));
      }

      // Som com o chat ABERTO. Não colide com o poll global (app.js): lá o
      // som toca quando as não-lidas SOBEM, o que só acontece com o chat
      // fechado. Aqui a conversa está aberta e já marcou como lida, então
      // as não-lidas não sobem — os dois nunca disparam para a mesma msg.
      if (novasDele) window.SFX?.play('mensagem');

      // "digitando…": chegou mensagem do interlocutor → ele parou; senão
      // reflete o heartbeat que o backend reportou em com.digitando.
      if (novasDele) this._mostrarDigitando(false);
      else           this._mostrarDigitando(!!(r.com && r.com.digitando));
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

  /* ── Indicador "digitando…" ───────────────────────────────── */
  /* Heartbeat de saída: ao digitar, avisa o servidor — mas no máximo
     uma vez a cada ~2s (throttle de borda de ataque). Campo vazio não
     dispara. O timer é limpo em _pararPolling (logo, também ao fechar). */
  _talvezDigitando() {
    const login = this._login;
    if (!login) return;
    if (!(this._input.value || '').trim()) return; // não anuncia campo vazio
    if (this._digThrottle) return;                 // já dentro da janela de 2s
    Promise.resolve()
      .then(() => API.social.digitando(login))
      .catch(() => { /* heartbeat é best-effort: falha em silêncio */ });
    this._digThrottle = setTimeout(() => { this._digThrottle = null; }, 2000);
  },

  /* Mostra/esconde a linha "digitando…" acima do campo de texto. */
  _mostrarDigitando(on) {
    if (!this._digitandoEl) return;
    this._digitandoEl.hidden = !on;
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
          // RECRIA a bolha com o id REAL. Trocar só o dataset.id não bastava:
          // o gatilho ⋮ do menu só é criado para ids numéricos, e a bolha
          // otimista nasceu com "tmp-N" — sem ele. Por isso o ⋮ não aparecia
          // nas mensagens que EU enviei até recarregar a página.
          this._ids.delete(tmpId);
          this._ids.add(m.id);
          const nova = this._bolha({
            id: m.id, de_mim: true, corpo: corpo,
            quando: m.quando, lida: false, apagada: false,
          });
          el.replaceWith(nova);
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

    // Lápide: apagada para todos. Sem texto, sem menu — só o registro de
    // que ali houve uma mensagem.
    if (msg.apagada) {
      div.classList.add('ch-apagada');
      const t = document.createElement('div');
      t.className = 'ch-texto ch-texto-apagada';
      t.textContent = '🚫 mensagem apagada';
      div.appendChild(t);
      const meta = document.createElement('div');
      meta.className = 'ch-meta';
      const hora = document.createElement('span');
      hora.className = 'ch-hora';
      hora.textContent = this._hora(msg.quando);
      meta.appendChild(hora);
      div.appendChild(meta);
      return div;
    }

    const corpo = document.createElement('div');
    corpo.className = 'ch-texto';
    corpo.textContent = msg.corpo || '';   // textContent: nunca injeta HTML do outro

    const meta = document.createElement('div');
    meta.className = 'ch-meta';
    const hora = document.createElement('span');
    hora.className = 'ch-hora';
    hora.textContent = this._hora(msg.quando);
    meta.appendChild(hora);

    // Gatilho do menu de exclusão. Só nas mensagens reais (não nas
    // otimistas "tmp-", que ainda não existem no servidor).
    const idReal = typeof msg.id === 'number';
    if (idReal) {
      const trig = document.createElement('button');
      trig.className = 'ch-msg-menu';
      trig.type = 'button';
      trig.setAttribute('aria-label', 'Opções da mensagem');
      trig.textContent = '⋮';
      trig.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this._menuBolha(msg, trig);
      });
      div.appendChild(trig);
    }

    div.appendChild(corpo);
    div.appendChild(meta);
    return div;
  },

  /* Menu flutuante de uma bolha: apagar para mim / para todos.
     Ancorado no <body> para escapar de qualquer clip-path da janela. */
  _menuBolha(msg, ancora) {
    this._fecharMenuBolha();
    const menu = document.createElement('div');
    menu.className = 'ch-menu-msg';
    menu.id = 'ch-menu-msg';

    const opt = (txt, perigo, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ch-menu-item' + (perigo ? ' perigo' : '');
      b.textContent = txt;
      b.addEventListener('click', (e) => { e.stopPropagation(); this._fecharMenuBolha(); fn(); });
      return b;
    };

    menu.appendChild(opt('Apagar para mim', false, () => this._apagar(msg.id, 'mim')));
    // "Para todos" só nas MINHAS mensagens — ninguém apaga a do outro.
    if (msg.de_mim) {
      menu.appendChild(opt('Apagar para todos', true, () => this._apagar(msg.id, 'todos')));
    }

    document.body.appendChild(menu);
    const r = ancora.getBoundingClientRect();
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    let top = r.bottom + 4, left = r.right - mw;
    if (top + mh > window.innerHeight - 8) top = r.top - mh - 4;
    left = Math.max(8, Math.min(left, window.innerWidth - mw - 8));
    menu.style.top = top + 'px';
    menu.style.left = left + 'px';

    // Fecha ao clicar fora
    this._fecharMenuFn = (e) => { if (!menu.contains(e.target)) this._fecharMenuBolha(); };
    setTimeout(() => document.addEventListener('click', this._fecharMenuFn), 0);
  },

  _fecharMenuBolha() {
    document.getElementById('ch-menu-msg')?.remove();
    if (this._fecharMenuFn) {
      document.removeEventListener('click', this._fecharMenuFn);
      this._fecharMenuFn = null;
    }
  },

  /* Converte uma bolha já renderizada em lápide, se ainda não for. Usado
     na reconciliação do poll quando o OUTRO apagou para todos. */
  _virarLapide(id) {
    const el = this._lista.querySelector('[data-id="' + id + '"]');
    if (!el || el.classList.contains('ch-apagada')) return;
    const nova = this._bolha({ id, de_mim: el.classList.contains('ch-minha'),
                               apagada: true, quando: null });
    el.replaceWith(nova);
  },

  async _apagar(id, escopo) {
    try {
      await API.social.apagarMsg(id, escopo);
      const el = this._lista.querySelector('[data-id="' + id + '"]');
      if (escopo === 'todos') {
        // Vira lápide na hora do MEU lado; o outro reconcilia no próximo poll.
        this._virarLapide(id);
      } else {
        // Some só da minha vista.
        if (el) el.remove();
        this._ids.delete(id);
      }
    } catch (err) {
      this._aviso(err && err.message ? err.message : 'Não foi possível apagar.');
    }
  },

  async _limparConversa() {
    if (!this._login) return;
    const nome = (this._com && this._com.nome) || 'este hunter';
    // typeof, NÃO window.SoloDialog: SoloDialog é um const de topo, então
    // não vira propriedade do window. Checar window.SoloDialog dava undefined
    // e o fallback ": true" limpava SEM pedir confirmação.
    const ok = (typeof SoloDialog !== 'undefined' && SoloDialog.confirm)
      ? await SoloDialog.confirm(
          'Isto limpa a conversa com <b>' + nome + '</b> só do SEU lado. '
          + 'O outro continua vendo tudo.',
          { icon: '🧹', titulo: 'Limpar conversa', tipo: 'warn',
            btnOk: 'Limpar', btnCancel: 'Voltar' })
      : false;   // sem diálogo disponível, NÃO limpa em silêncio
    if (!ok) return;
    try {
      await API.social.limpar(this._login);
      this._ids.clear();
      this._lista.innerHTML = '';
      this._placeholder('Conversa limpa. Novas mensagens aparecem aqui.');
    } catch (err) {
      this._aviso(err && err.message ? err.message : 'Não foi possível limpar.');
    }
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
