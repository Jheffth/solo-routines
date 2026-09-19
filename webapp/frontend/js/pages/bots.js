/* ══════════════════════════════════════════════════════════════════
   A ABA BOTS — conectar o hunter aos canais de aviso

   O QUE ESTA TELA EXISTE PARA RESOLVER

   O bot do Telegram já funcionava — para UM hunter. O `_get_usuario()`
   devolvia "o primeiro usuário ativo", e não havia como um segundo se
   apresentar. Ele simplesmente não recebia nada, e nenhuma tela dizia
   por quê.

   Aqui cada hunter gera o próprio código de seis dígitos e prova ao bot
   quem é. O caminho do WhatsApp é outro — um QR que pareia o número do
   Sistema — mas termina no mesmo lugar.

   A TELA É, ANTES DE TUDO, UM MANUAL. Conectar bot é um daqueles
   trajetos que atravessam dois aplicativos e um QR, e onde a pessoa
   desiste no passo em que não sabe o que fazer. Por isso o passo a passo
   está NA TELA, numerado, e não num tooltip nem numa doc que ninguém
   abre. O botão que gera o código fica no passo onde ele é usado, não no
   topo.

   E A TELA NÃO OFERECE O QUE O SERVIDOR NÃO PODE CUMPRIR. Sem
   `TELEGRAM_BOT_TOKEN`, sem Evolution API, o cartão mostra o que falta
   em vez de um botão que leva a um beco — a mesma regra do cartão da
   agenda do Google.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const Bots = {
    _dados: null,
    _relogio: null,

    async carregar() {
      const cx = document.getElementById('bots-conteudo');
      if (!cx) return;
      cx.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';

      try {
        this._dados = await API.get('/bots/status');
      } catch (e) {
        cx.innerHTML = `<div class="card bot-card"><p class="bot-vazio">
          Não consegui falar com o servidor. Tente de novo.</p></div>`;
        return;
      }
      cx.innerHTML = this._telegram(this._dados.telegram)
                   + this._whatsapp(this._dados.whatsapp);
      this._ligar(cx);
    },

    _esc(s) {
      return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]));
    },

    _g(n, t) {
      try { return (typeof Glifos !== 'undefined' && Glifos.linha)
        ? Glifos.linha(n, t || 16) : ''; } catch (_) { return ''; }
    },

    /* ── TELEGRAM ─────────────────────────────────────────────── */
    _telegram(t) {
      const cabeca = `
        <div class="bot-topo">
          <div class="bot-marca bot-marca--tg">${this._svgTelegram()}</div>
          <div>
            <h3 class="bot-titulo">Telegram
              ${t.vinculado ? '<span class="bot-selo on">conectado</span>'
                            : '<span class="bot-selo">desconectado</span>'}</h3>
            <p class="bot-sub">Resumo do dia, cobrança das críticas e o
              fechamento da noite — direto no seu chat.</p>
          </div>
        </div>`;

      if (!t.disponivel) {
        return `<div class="card bot-card">${cabeca}
          <p class="bot-falta">${this._g('caveira', 15)}
            <span>O servidor não tem <code>TELEGRAM_BOT_TOKEN</code> configurado.
            Sem ele não há bot para conectar.</span></p></div>`;
      }

      if (t.vinculado) {
        return `<div class="card bot-card conectado">${cabeca}
          <p class="bot-nota">Vinculado desde
            <b>${t.desde ? new Date(t.desde).toLocaleDateString('pt-BR') : '—'}</b>.
            Mande <code>/ajuda</code> no chat para ver os comandos.</p>
          <div class="bot-acoes">
            <button type="button" class="bot-bt bot-bt--perigo" data-bot-sair="telegram">
              ${this._g('excluir', 15)}<span>Desvincular</span></button>
          </div></div>`;
      }

      const bot = t.usuario_bot
        ? `<a href="https://t.me/${this._esc(t.usuario_bot)}" target="_blank"
             rel="noopener">@${this._esc(t.usuario_bot)}</a>`
        : 'o bot do Sistema';

      return `<div class="card bot-card">${cabeca}
        <ol class="bot-passos">
          <li><b>Abra o Telegram</b> e comece uma conversa com ${bot}.</li>
          <li><b>Gere seu código</b> aqui embaixo. Ele vale 10 minutos.</li>
          <li><b>Mande no chat:</b> <code>/vincular 123456</code>
              — com os seis dígitos no lugar do exemplo.</li>
          <li>Pronto. O bot responde confirmando o seu nome.</li>
        </ol>
        <div class="bot-codigo-area" data-bot-area="telegram"></div>
        <div class="bot-acoes">
          <button type="button" class="bot-bt bot-bt--on" data-bot-codigo="telegram">
            ${this._g('etiqueta', 15)}<span>Gerar meu código</span></button>
        </div></div>`;
    },

    /* ── WHATSAPP ─────────────────────────────────────────────── */
    _whatsapp(w) {
      const sessao = w.sessao || {};
      const cabeca = `
        <div class="bot-topo">
          <div class="bot-marca bot-marca--wa">${this._svgWhatsapp()}</div>
          <div>
            <h3 class="bot-titulo">WhatsApp
              ${w.vinculado ? '<span class="bot-selo on">conectado</span>'
                            : '<span class="bot-selo">desconectado</span>'}</h3>
            <p class="bot-sub">Os mesmos avisos, no aplicativo que você
              já deixa aberto.</p>
          </div>
        </div>`;

      if (!w.disponivel) {
        return `<div class="card bot-card">${cabeca}
          <p class="bot-falta">${this._g('caveira', 15)}
            <span>A <b>Evolution API</b> não está configurada neste servidor
            (<code>EVOLUTION_API_URL</code> e <code>EVOLUTION_API_KEY</code>).
            É ela que mantém a sessão do WhatsApp.</span></p>
          <p class="bot-nota">
            A Evolution roda num contêiner ao lado do app e fala WhatsApp
            por baixo dos panos. Não é a API oficial da Meta — o que
            significa sem template aprovado e sem custo por conversa, mas
            também que o número pode ser banido se virar disparo em massa.
            Para os seus próprios avisos, é a escolha certa.</p>
          </div>`;
      }

      if (w.vinculado) {
        return `<div class="card bot-card conectado">${cabeca}
          <p class="bot-nota">Vinculado ao número
            <b>${this._esc(w.numero || '—')}</b> desde
            <b>${w.desde ? new Date(w.desde).toLocaleDateString('pt-BR') : '—'}</b>.</p>
          <div class="bot-acoes">
            <button type="button" class="bot-bt bot-bt--perigo" data-bot-sair="whatsapp">
              ${this._g('excluir', 15)}<span>Desvincular</span></button>
          </div></div>`;
      }

      /* A SESSÃO DO SISTEMA vem antes do vínculo do hunter, e a ordem
         importa: sem um número pareado não há de onde a mensagem sair.
         Por isso o passo do QR aparece primeiro e só para o Arquiteto. */
      /* `isCriador()`, e não `isAdmin()`. O `isAdmin` inclui Suporte e
         Moderador; o QR pareia o NÚMERO DO SISTEMA, de onde sairão os
         avisos de todos os hunters. Quem escaneia vira o remetente de
         todo mundo — isso é do dono da casa, não do plantão.
         A tela apenas esconde o botão; quem recusa de verdade é o
         `Depends(get_arquiteto)` no router, e é lá que a regra vale. */
      const arquiteto = (window.Auth && Auth.isCriador && Auth.isCriador());
      const sessaoOk = !!sessao.conectado;

      const passoQR = sessaoOk ? `
        <li class="feito">${this._g('concluida', 14)}
          <b>Número do Sistema pareado.</b> Já dá para receber.</li>`
        : (arquiteto ? `
        <li><b>Parear o número do Sistema</b> — só o Arquiteto faz, e uma
            vez só. Clique em "Mostrar QR" e escaneie pelo WhatsApp em
            <i>Aparelhos conectados</i>.
            <div class="bot-qr-area" data-bot-area="qr"></div>
            <button type="button" class="bot-bt" data-bot-qr>
              ${this._g('olho', 15)}<span>Mostrar QR</span></button></li>`
        : `
        <li class="pendente">${this._g('ampulheta', 14)}
          <b>Aguardando o Arquiteto parear o número do Sistema.</b>
          Enquanto isso, o WhatsApp não envia nada.</li>`);

      return `<div class="card bot-card">${cabeca}
        <ol class="bot-passos">
          ${passoQR}
          <li><b>Gere seu código</b> aqui embaixo (vale 10 minutos).</li>
          <li><b>Mande os seis dígitos</b> para o número do Sistema no
              WhatsApp. Só os números, sem mais nada.</li>
          <li>Pronto. Ele responde confirmando o seu nome.</li>
        </ol>
        <div class="bot-codigo-area" data-bot-area="whatsapp"></div>
        <div class="bot-acoes">
          <button type="button" class="bot-bt bot-bt--on" data-bot-codigo="whatsapp"
            ${sessaoOk ? '' : 'disabled title="O número do Sistema ainda não foi pareado"'}>
            ${this._g('etiqueta', 15)}<span>Gerar meu código</span></button>
        </div></div>`;
    },

    /* ── AÇÕES ────────────────────────────────────────────────── */
    _ligar(cx) {
      cx.querySelectorAll('[data-bot-codigo]').forEach(b => {
        b.onclick = () => this.gerarCodigo(b.dataset.botCodigo, b);
      });
      cx.querySelectorAll('[data-bot-sair]').forEach(b => {
        b.onclick = () => this.desvincular(b.dataset.botSair);
      });
      const q = cx.querySelector('[data-bot-qr]');
      if (q) q.onclick = () => this.mostrarQR(q);
    },

    async gerarCodigo(canal, bt) {
      bt.disabled = true;
      try {
        const r = await API.post(`/bots/codigo/${canal}`, {});
        const area = document.querySelector(`[data-bot-area="${canal}"]`);
        if (area) {
          area.innerHTML = `
            <div class="bot-codigo">
              <span class="bot-codigo-num">${this._esc(r.codigo)}</span>
              <span class="bot-codigo-prazo" data-bot-prazo="${r.expira_em}"></span>
            </div>`;
          this._contar();
        }
      } catch (e) {
        SoloDialog.toast(e.message || 'Não consegui gerar o código.', 'error');
      } finally {
        bt.disabled = false;
      }
    },

    /* O PRAZO CORRE NA TELA. Um código com validade que ninguém vê é um
       código que expira na mão da pessoa enquanto ela procura o chat —
       e o erro que ela recebe depois não explica isso. */
    _contar() {
      clearInterval(this._relogio);
      const pinta = () => {
        const els = document.querySelectorAll('[data-bot-prazo]');
        if (!els.length) { clearInterval(this._relogio); return; }
        els.forEach(el => {
          const resta = new Date(el.dataset.botPrazo) - Date.now();
          if (resta <= 0) {
            el.textContent = 'expirado — gere outro';
            el.classList.add('vencido');
            return;
          }
          const m = Math.floor(resta / 60000);
          const s = Math.floor((resta % 60000) / 1000);
          el.textContent = `vale por ${m}:${String(s).padStart(2, '0')}`;
        });
      };
      pinta();
      this._relogio = setInterval(pinta, 1000);
    },

    async mostrarQR(bt) {
      const area = document.querySelector('[data-bot-area="qr"]');
      bt.disabled = true;
      const rot = bt.querySelector('span');
      if (rot) rot.textContent = 'Buscando...';
      try {
        const r = await API.get('/bots/whatsapp/qrcode');
        if (area && r.qrcode) {
          area.innerHTML = `<img class="bot-qr" src="${r.qrcode}" alt="QR Code do WhatsApp">
            <p class="bot-nota">O QR do WhatsApp vive cerca de 20 segundos.
            Se não der tempo, clique de novo.</p>`;
        } else if (area && r.pairing_code) {
          area.innerHTML = `<div class="bot-codigo">
            <span class="bot-codigo-num">${this._esc(r.pairing_code)}</span></div>`;
        }
      } catch (e) {
        SoloDialog.toast(e.message || 'A Evolution não respondeu.', 'error', 6000);
      } finally {
        bt.disabled = false;
        if (rot) rot.textContent = 'Mostrar QR';
      }
    },

    async desvincular(canal) {
      const ok = await SoloDialog.confirm(
        'O Sistema para de mandar avisos por este canal. Você pode '
        + 'reconectar quando quiser.',
        { titulo: `Desvincular o ${canal}?`, btnOk: 'Desvincular', tipo: 'warn' }
      );
      if (!ok) return;
      try {
        await API.delete(`/bots/vinculo/${canal}`);
        SoloDialog.toast('Canal desvinculado.', 'success');
      } catch (e) {
        SoloDialog.toast(e.message || 'Não consegui desvincular.', 'error');
      }
      await this.carregar();
    },

    /* As marcas são desenhadas, não baixadas: um `<img>` de CDN aqui
       seria uma dependência externa numa tela que já funciona offline. */
    _svgTelegram() {
      return `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
        <path d="M21.9 4.3 18.7 19c-.2 1-.9 1.3-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.8 8.8-7.9c.4-.3-.1-.5-.6-.2L6.6 12.9l-4.7-1.5c-1-.3-1-.9.2-1.4l18.4-7c.8-.3 1.6.2 1.4 1.3z"/>
      </svg>`;
    },

    _svgWhatsapp() {
      return `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
        <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2zm5.8 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.5-1.2-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.4.5-.3.3c-.1.1-.2.3 0 .5.1.3.6 1.1 1.4 1.8 1 .9 1.8 1.1 2 1.2.3.1.4.1.6-.1l.8-.9c.2-.2.4-.2.6-.1l2 .9c.2.1.4.2.4.3.1.1.1.6-.1 1.3z"/>
      </svg>`;
    },
  };

  window.Bots = Bots;
})();
