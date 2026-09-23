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
        /* As duas chamadas SAEM JUNTAS. Em série, a tela levaria a soma
           das duas latências para aparecer — e a segunda não depende em
           nada do resultado da primeira. */
        const [dados, pref] = await Promise.all([
          API.get('/bots/status'),
          API.get('/bots/avisos').catch(() => null),
        ]);
        this._dados = dados;
        this._pref = pref;
      } catch (e) {
        cx.innerHTML = `<div class="card bot-card"><p class="bot-vazio">
          Não consegui falar com o servidor. Tente de novo.</p></div>`;
        return;
      }
      cx.innerHTML = this._telegram(this._dados.telegram)
                   + this._whatsapp(this._dados.whatsapp)
                   + this._avisos(this._pref, this._dados);
      this._ligar(cx);
    },

    /* ── OS AVISOS ────────────────────────────────────────────────────
       O cartão fica DEPOIS dos dois canais e não antes: escolher quais
       avisos receber antes de existir um canal para recebê-los é
       configurar o nada. Se nenhum canal está conectado, o cartão diz
       isso em vez de oferecer chaves que não ligam coisa alguma.

       CADA LINHA DIZ O QUE CUSTA. "Missão começou" com dez missões de
       janela na agenda são dez eventos por dia — e a pessoa merece
       saber disso ANTES de ligar, não depois de silenciar o bot. */
    _avisos(p, dados) {
      /* Aceita o objeto inteiro OU só o Telegram, porque o teste do
         painel chamava com a segunda forma antes de o WhatsApp existir.
         Quebrar a chamada antiga para mudar um argumento seria trocar
         um defeito por outro. */
      const d = (dados && dados.telegram) ? dados : { telegram: dados || {} };
      const t = d.telegram || {};
      const w = d.whatsapp || {};
      const canais = [];
      if (t.vinculado) canais.push(['telegram', 'Telegram']);
      if (w.vinculado) canais.push(['whatsapp', 'WhatsApp']);
      return this._avisosCartao(p, t, w, canais);
    },

    _avisosCartao(p, t, w, canais) {
      const cabeca = `
        <div class="bot-topo">
          <div class="bot-marca bot-marca--av">${this._g('relogio', 22)}</div>
          <div>
            <h3 class="bot-titulo">Avisos</h3>
            <p class="bot-sub">O Sistema te procura quando uma missão
              precisa de você — não só quando você abre o app.</p>
          </div>
        </div>`;

      if (!p) {
        return `<div class="card bot-card">${cabeca}
          <p class="bot-falta">${this._g('caveira', 15)}
            <span>Não consegui ler suas preferências de aviso.</span></p></div>`;
      }

      if (!canais.length) {
        return `<div class="card bot-card">${cabeca}
          <p class="bot-nota">Conecte o Telegram ou o WhatsApp acima e
            estas opções passam a valer. Enquanto não houver canal, não
            há para onde o Sistema te avisar.</p></div>`;
      }

      /* O SELETOR SÓ APARECE COM DOIS CANAIS. Com um só, ele seria uma
         pergunta de resposta única — e toda pergunta na tela cobra um
         segundo de quem lê, mesmo quando não há o que decidir. */
      const escolhido = p.canal_avisos || canais[0][0];
      const seletor = canais.length < 2 ? '' : `
        <div class="bot-canal">
          <span>Receber avisos por</span>
          <select data-av="canal_avisos">
            ${canais.map(([v, r]) => `<option value="${v}"
              ${escolhido === v ? 'selected' : ''}>${r}</option>`).join('')}
            <option value="ambos" ${escolhido === 'ambos' ? 'selected' : ''}>Os dois</option>
          </select>
        </div>
        <p class="bot-nota">O canal não escolhido continua aceitando
          comandos — isto decide quem o Sistema <b>procura</b>, não com
          quem ele conversa.</p>`;

      const chave = (campo, titulo, custo) => `
        <label class="bot-chave">
          <input type="checkbox" data-av="${campo}" ${p[campo] ? 'checked' : ''}>
          <span class="bot-chave-bola"></span>
          <span class="bot-chave-txt"><b>${titulo}</b><i>${custo}</i></span>
        </label>`;

      const numero = (campo, rotulo, min, max) => `
        <label class="bot-num">
          <span>${rotulo}</span>
          <input type="number" data-av="${campo}" min="${min}" max="${max}"
                 value="${this._esc(p[campo])}"> <em>min</em>
        </label>`;

      return `<div class="card bot-card">${cabeca}
        ${seletor}
        <div class="bot-chaves">
          ${chave('beira', 'Falta pouco para o prazo',
                  'o último aviso que ainda salva a missão')}
          ${chave('acendeu', 'A missão começou sozinha',
                  'um por missão de janela — o mais frequente')}
          ${chave('portao', 'Um portão vai abrir',
                  'poucos por dia; é o que te faz chegar na hora')}
          ${chave('venceu', 'O prazo venceu',
                  'chega depois do estrago; serve para saber')}
        </div>

        <div class="bot-nums">
          ${numero('minutos_beira', 'Avisar faltando', 5, 120)}
          ${numero('minutos_portao', 'Portão, antes de abrir', 5, 180)}
        </div>

        <div class="bot-silencio">
          <span>Silêncio das</span>
          <input type="time" data-av="silencio_de" value="${this._esc(p.silencio_de)}">
          <span>às</span>
          <input type="time" data-av="silencio_ate" value="${this._esc(p.silencio_ate)}">
        </div>
        <p class="bot-nota">Nesse intervalo o Sistema cala — <b>exceto</b>
          missão cuja janela esteja de fato aberta nele. "Sem redes sociais
          entre 22h e 10h" é missão legítima das 04:00, e calá-la seria
          calar justamente quem precisa do aviso naquela hora.</p>

        <div class="bot-acoes">
          <button type="button" class="bot-bt bot-bt--on" data-av-salvar>
            ${this._g('salvar', 15)}<span>Salvar</span></button>
        </div>
      </div>`;
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

      /* O DIAGNÓSTICO ENTRA NOS TRÊS CAMINHOS, e a razão é o caso
         traiçoeiro: token configurado, hunter vinculado, cartão inteiro
         verde — e nenhum webhook registrado. O Telegram não tem para
         onde entregar, o hunter manda mensagem e não acontece nada, e a
         tela continua dizendo "conectado". Só o painel desmente. */
      const srv = this._servidorTg(t.servidor);

      if (!t.disponivel) {
        return `<div class="card bot-card">${cabeca}
          <p class="bot-falta">${this._g('caveira', 15)}
            <span>O servidor não tem <code>TELEGRAM_BOT_TOKEN</code> configurado.
            Sem ele não há bot para conectar.</span></p>${srv}</div>`;
      }

      if (t.vinculado) {
        return `<div class="card bot-card conectado">${cabeca}
          <p class="bot-nota">Vinculado desde
            <b>${t.desde ? new Date(t.desde).toLocaleDateString('pt-BR') : '—'}</b>.
            Mande <code>/ajuda</code> no chat para ver os comandos.</p>
          <div class="bot-acoes">
            <button type="button" class="bot-bt bot-bt--perigo" data-bot-sair="telegram">
              ${this._g('excluir', 15)}<span>Desvincular</span></button>
          </div>${srv}</div>`;
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
        </div>${srv}</div>`;
    },

    /* ── O PAINEL DO ARQUITETO ─────────────────────────────────────────
       O servidor só manda `servidor` para o Arquiteto; para todo mundo
       ele vem nulo e este bloco não existe. A regra de verdade está no
       backend — esconder na tela é conveniência, não segurança.

       O QUE ESTE PAINEL RESPONDE, e que nenhuma outra tela respondia:
       "o bot está no ar?". Antes a única forma de saber era entrar no
       servidor e rodar um curl no getWebhookInfo. E as duas perguntas
       que mais importam — quantos updates estão encalhados e qual foi o
       último erro de entrega — nem no servidor apareciam, porque quem
       as guarda é o Telegram, não nós. */
    _servidorTg(s) {
      if (!s) return '';

      const linha = (ok, texto, detalhe) => `
        <li class="${ok === null ? 'neutra' : (ok ? 'ok' : 'nao')}">
          <span class="bot-diag-marca">${ok === null ? '·' : (ok ? '✓' : '✕')}</span>
          <span>${texto}${detalhe ? ` <i>${this._esc(detalhe)}</i>` : ''}</span>
        </li>`;

      /* NÃO CONSEGUI PERGUNTAR ≠ NÃO ESTÁ REGISTRADO. Confundir os dois
         mandaria o Arquiteto reconfigurar um webhook que estava de pé —
         por isso a consulta falha aparece como aviso próprio, e não
         como um "✕ webhook" que seria mentira. */
      if (s.erro_consulta) {
        return `<div class="bot-diag">
          <h4>${this._g('engrenagem', 14)}<span>Estado do bot</span></h4>
          <p class="bot-falta"><span>Não consegui perguntar ao Telegram:
            <i>${this._esc(s.erro_consulta)}</i>. O estado abaixo pode estar
            velho — isto não quer dizer que o webhook caiu.</span></p>
        </div>`;
      }

      const itens = [
        linha(!!s.token_configurado, 'Token do BotFather',
              s.usuario_bot ? '@' + s.usuario_bot : ''),
        s.segredo_configurado
          ? linha(!s.segredo_fraco, 'Segredo do webhook',
                  s.segredo_fraco ? 'valor de exemplo — troque' : '')
          : linha(false, 'Segredo do webhook', 'TELEGRAM_SECRET vazio'),
        s.webhook_registrado
          ? linha(!!s.webhook_confere, 'Webhook registrado',
                  s.webhook_confere ? s.webhook_url
                    : 'aponta para ' + s.webhook_url + ' — o esperado é '
                      + s.webhook_esperado)
          : linha(false, 'Webhook registrado',
                  'o Telegram não tem para onde entregar'),

        /* REGISTRADO E SURDO é um estado próprio, e o mais traiçoeiro
           de todos: a lista aparece, os botões existem, o dedo recebe o
           efeito do toque — e nada acontece. O Telegram descarta o
           `callback_query` antes de chegar ao servidor quando ele não
           está no `allowed_updates`, então não há erro, não há update
           pendente, não há log. Só o painel desmente. */
        s.webhook_registrado
          ? linha(!!s.aceita_botoes, 'Botões (callback_query)',
                  s.aceita_botoes ? ''
                    : 'o Telegram descarta os toques — clique em '
                      + '"Registrar de novo" abaixo')
          : null,
      ].filter(Boolean);

      if (s.updates_pendentes) {
        itens.push(linha(false, 'Mensagens encalhadas',
          s.updates_pendentes + ' aguardando entrega'));
      }
      if (s.ultimo_erro) {
        itens.push(linha(false, 'Último erro de entrega', s.ultimo_erro));
      }
      if (s.lista_espera && s.lista_espera.length) {
        itens.push(linha(null, 'Lista de espera ativa',
          s.lista_espera.length + ' chat(s) — só eles podem tentar vincular'));
      }

      /* O VARREDOR DE AVISOS. Ele já ficou mudo um dia inteiro por causa
         de uma coluna que faltava no banco, e o único lugar onde isso
         aparecia era o log do servidor — justamente onde o Arquiteto não
         olha. "Nunca varreu" logo após um deploy é normal; "nunca
         varreu" cinco minutos depois é defeito. */
      const v = s.varredura || {};
      if (v.em) {
        const q = new Date(v.em);
        const min = Math.round((Date.now() - q.getTime()) / 60000);
        itens.push(linha(min <= 11, 'Última varredura de avisos',
          (min <= 1 ? 'agora' : 'há ' + min + ' min')
          + ' · ' + (v.avisos || 0) + ' aviso(s)'
          + (min > 11 ? ' — devia ser a cada 5 min' : '')));
      } else {
        itens.push(linha(null, 'Varredura de avisos',
          'ainda não rodou neste processo'));
      }
      if (v.erros) {
        itens.push(linha(false, 'Erro na varredura',
          v.ultimo_erro || (v.erros + ' hunter(s) com falha')));
      }

      const podeRegistrar = s.token_configurado && s.segredo_configurado;

      return `<div class="bot-diag ${s.pronto ? 'no-ar' : ''}">
        <h4>${this._g('engrenagem', 14)}<span>Estado do bot</span>
          ${s.pronto ? '<span class="bot-selo on">no ar</span>'
                     : '<span class="bot-selo">fora do ar</span>'}</h4>
        <ul class="bot-diag-lista">${itens.join('')}</ul>
        <div class="bot-acoes">
          <button type="button" class="bot-bt" data-bot-webhook
            ${podeRegistrar ? '' : 'disabled title="Preencha TELEGRAM_BOT_TOKEN e TELEGRAM_SECRET no .env do servidor"'}>
            ${this._g('radar', 15)}<span>${s.webhook_registrado
              ? 'Registrar de novo' : 'Registrar webhook'}</span></button>
        </div>
        <p class="bot-nota">Registrar aponta o Telegram para
          <code>${this._esc(s.webhook_esperado)}</code> e descarta as
          mensagens acumuladas — um <code>/ok</code> de ontem chegando hoje
          concluiria a missão errada.</p>
      </div>`;
    },

    /* ── WHATSAPP ─────────────────────────────────────────────── */
    _whatsapp(w) {
      const sessao = w.sessao || {};
      const arquiteto = !!(window.Auth && Auth.isCriador && Auth.isCriador());
      const sessaoOk = sessao.conectado === true;
      const recuperacao = arquiteto ? `
        <div class="bot-acoes">
          <button type="button" class="bot-bt" data-bot-reparear>
            ${this._g('olho', 15)}<span>Refazer pareamento</span></button>
        </div>` : '';
      const cabeca = `
        <div class="bot-topo">
          <div class="bot-marca bot-marca--wa">${this._svgWhatsapp()}</div>
          <div>
            <h3 class="bot-titulo">WhatsApp
              ${w.vinculado && sessaoOk ? '<span class="bot-selo on">conectado</span>'
                            : `<span class="bot-selo">${w.vinculado ? 'sessão desconectada' : 'conta não vinculada'}</span>`}</h3>
            <p class="bot-sub">Os mesmos comandos e os mesmos avisos, no
              aplicativo que você já deixa aberto — só que sem botão:
              aqui as escolhas vêm numeradas.</p>
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
        return `<div class="card bot-card${sessaoOk ? ' conectado' : ''}">${cabeca}
          <p class="bot-nota">Vinculado ao número
            <b>${this._esc(w.numero || '—')}</b> desde
            <b>${w.desde ? new Date(w.desde).toLocaleDateString('pt-BR') : '—'}</b>.</p>
          <p class="bot-nota">${sessaoOk ? 'Sessão do Sistema conectada.'
            : 'A sessão do Sistema está desconectada. É preciso parear novamente para receber avisos.'}</p>
          ${!sessaoOk && arquiteto ? `<div class="bot-qr-area" data-bot-area="qr"></div>
            <button type="button" class="bot-bt" data-bot-qr><span>Mostrar QR</span></button>` : ''}
          ${recuperacao}
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
      const passoQR = sessaoOk ? `
        <li class="feito">${this._g('concluida', 14)}
          <b>Sessão do Sistema conectada.</b> Falta vincular sua conta pelos passos abaixo.
          ${recuperacao}</li>`
        : (arquiteto ? `
        <li><b>Parear o número do Sistema</b> — só o Arquiteto faz, e uma
            vez só. Clique em "Mostrar QR" e escaneie pelo WhatsApp em
            <i>Aparelhos conectados</i>.
            <div class="bot-qr-area" data-bot-area="qr"></div>
            <button type="button" class="bot-bt" data-bot-qr>
              ${this._g('olho', 15)}<span>Mostrar QR</span></button>
            ${recuperacao}</li>`
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
          <li>Pronto. Mande <code>/ajuda</code> e ele lista tudo — são os
              mesmos comandos do Telegram.</li>
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
      const reparar = cx.querySelector('[data-bot-reparear]');
      if (reparar) reparar.onclick = () => this.refazerPareamento(reparar);
      const w = cx.querySelector('[data-bot-webhook]');
      if (w) w.onclick = () => this.registrarWebhook(w);
      const s = cx.querySelector('[data-av-salvar]');
      if (s) s.onclick = () => this.salvarAvisos(s);
    },

    async salvarAvisos(bt) {
      const corpo = {};
      document.querySelectorAll('[data-av]').forEach(el => {
        const k = el.dataset.av;
        if (el.type === 'checkbox') corpo[k] = el.checked;
        else if (el.type === 'number') corpo[k] = parseInt(el.value, 10);
        else corpo[k] = el.value;
      });
      bt.disabled = true;
      try {
        /* A RESPOSTA DO SERVIDOR REPINTA A TELA, e isso não é zelo
           excessivo: ele apara os minutos para a faixa permitida. Sem
           repintar, a pessoa digitaria 2, o servidor guardaria 5, e a
           tela continuaria mostrando 2 — uma discordância silenciosa
           que só apareceria no dia em que o aviso chegasse "errado". */
        this._pref = await API.put('/bots/avisos', corpo);
        SoloDialog.toast('Avisos salvos.', 'success');
        await this.carregar();
      } catch (e) {
        SoloDialog.toast(e.message || 'Não consegui salvar.', 'error');
        bt.disabled = false;
      }
    },

    /* Sem argumento nenhum: o servidor já sabe o próprio endereço
       público (OAUTH_REDIRECT_BASE). Pedir a URL aqui seria transferir
       para a tela um fato que o backend tem de primeira mão — e abrir a
       chance de registrar o webhook num endereço digitado errado. */
    async registrarWebhook(bt) {
      const ok = await SoloDialog.confirm(
        'O Telegram passa a entregar as mensagens neste servidor. '
        + 'As mensagens acumuladas são descartadas.',
        { titulo: 'Registrar o webhook?', btnOk: 'Registrar' }
      );
      if (!ok) return;
      bt.disabled = true;
      const rot = bt.querySelector('span');
      const antes = rot ? rot.textContent : '';
      if (rot) rot.textContent = 'Registrando...';
      try {
        const r = await API.post('/bot/configurar-webhook', {});
        SoloDialog.toast('Webhook registrado.', 'success');
        await this.carregar();   // repinta com o estado novo, não o suposto
        return r;
      } catch (e) {
        SoloDialog.toast(e.message || 'O Telegram recusou.', 'error', 7000);
        bt.disabled = false;
        if (rot) rot.textContent = antes;
      }
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
          // O servidor antigo envia UTC sem indicar o fuso no texto.
          const prazo = el.dataset.botPrazo;
          const resta = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(prazo) ? prazo : prazo + 'Z') - Date.now();
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
      if (area) area.textContent = 'Buscando um QR atualizado...';
      try {
        const r = await API.get('/bots/whatsapp/qrcode');
        if (area && r.qrcode) {
          area.innerHTML = `<img class="bot-qr" src="${r.qrcode}" alt="QR Code do WhatsApp">
            <p class="bot-nota">O QR do WhatsApp vive cerca de 20 segundos.
            Se não der tempo, clique de novo.</p>`;
        } else if (area && r.pairing_code) {
          area.innerHTML = `<div class="bot-codigo">
            <span class="bot-codigo-num">${this._esc(r.pairing_code)}</span></div>`;
        } else if (r.estado === 'open') {
          await this.carregar();
          SoloDialog.toast(this._dados.whatsapp.vinculado
            ? 'Sessão do Sistema conectada.'
            : 'Sessão do Sistema conectada. Agora vincule sua conta com o código de seis dígitos.', 'success');
        } else if (area) {
          area.textContent = 'O WhatsApp ainda está preparando o QR. Aguarde alguns segundos e clique em Mostrar QR novamente.';
        }
      } catch (e) {
        if (area) area.textContent = 'Não foi possível obter o QR. Clique em Mostrar QR para tentar novamente.';
        SoloDialog.toast(e.message || 'A Evolution não respondeu.', 'error', 6000);
      } finally {
        bt.disabled = false;
        if (rot) rot.textContent = 'Mostrar QR';
      }
    },

    async refazerPareamento(bt) {
      const ok = await SoloDialog.confirm(
        'Isso encerra a sessão atual do número do Sistema e pausa os avisos de WhatsApp de todos os usuários até você escanear o novo QR.',
        { titulo: 'Refazer pareamento do WhatsApp?', btnOk: 'Refazer pareamento', tipo: 'warn' }
      );
      if (!ok) return;
      bt.disabled = true;
      try {
        const r = await API.delete('/bots/whatsapp/sessao');
        if (!r.ok) throw new Error('Não foi possível encerrar a sessão atual. Tente novamente.');
        await this.carregar();
        const qr = document.querySelector('[data-bot-qr]');
        if (qr) await this.mostrarQR(qr);
      } catch (e) {
        SoloDialog.toast(e.message || 'Não consegui refazer o pareamento.', 'error', 6000);
      } finally {
        bt.disabled = false;
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
