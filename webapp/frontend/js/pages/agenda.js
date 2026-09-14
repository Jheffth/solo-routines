/* ══════════════════════════════════════════════════════════════════
   A AGENDA — ligar o Solo ao Google Calendar

   O QUE ESTA TELA PRECISA FAZER DIREITO

   1. NÃO OFERECER O QUE O SERVIDOR NÃO PODE CUMPRIR. Se `CALENDARIO_CHAVE`
      não existe lá, o refresh token não teria onde ser guardado com cifra
      — e a resposta certa é o cartão nem aparecer. Botão que leva o hunter
      até a tela de consentimento do Google para falhar na volta é pior do
      que botão nenhum.

   2. MOSTRAR O ERRO. `ultimo_erro` vem do servidor e vai para a tela. Uma
      integração que para de funcionar em silêncio é o pior desfecho
      possível: o hunter simplesmente deixa de receber aviso e nunca
      descobre por quê.

   3. DIZER QUEM TOCA O ALARME. O Solo escreve o evento; quem notifica é o
      app do Google Calendar no celular. Sem essa frase na tela, "não chegou
      aviso" vira bug do Solo — e não é.

   O RETORNO DO GOOGLE chega como fragmento na URL (`#sr_cal=ok`), pelo
   mesmo caminho que o login já usa: fragmento não vai ao servidor nem aos
   logs de acesso.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const Agenda = {
    _dados: null,

    async montar() {
      const caixa = document.getElementById('perfil-agenda');
      if (!caixa) return;

      try {
        this._dados = await API.get('/calendario/status');
      } catch (_) {
        caixa.innerHTML = '';   // sem servidor, sem cartão
        return;
      }

      /* Servidor sem condição de guardar o segredo: não desenha nada para
         o hunter. O Arquiteto vê o motivo no console, que é onde ele pode
         agir. */
      if (!this._dados.disponivel) {
        caixa.innerHTML = '';
        console.info('[agenda] indisponível:', this._dados.motivo);
        return;
      }

      caixa.innerHTML = this._html(this._dados);
      this._ligar(caixa);
    },

    _html(d) {
      const erro = d.ultimo_erro ? `
        <div class="ag-erro">
          <b>A última sincronia falhou.</b>
          <span>${this._esc(d.ultimo_erro)}</span>
        </div>` : '';

      if (!d.conectado) {
        return `
        <div class="card ag-card mt-2">
          <div class="ag-topo">
            <div class="ag-glifo">${this._icone()}</div>
            <div>
              <h3 class="ag-titulo">Agenda do Google</h3>
              <p class="ag-sub">
                Seus portões e missões com horário viram eventos numa agenda
                própria, e o celular avisa antes da hora.
              </p>
            </div>
          </div>
          ${erro}
          <ul class="ag-promessas">
            <li><b>Uma agenda separada.</b> Chamada "Solo Routines", criada pelo app.
                Você esconde ou apaga quando quiser, sem perder nada aqui.</li>
            <li><b>O Solo não lê seus compromissos.</b> A permissão pedida só
                alcança a agenda que ele mesmo criou — não é promessa, é o
                limite técnico do acesso.</li>
            <li><b>Mão única.</b> O Solo escreve; nada volta de lá para cá.</li>
          </ul>
          <button type="button" class="ag-btn ag-btn-on" id="ag-conectar">
            ${this._gGoogle()} Conectar minha agenda
          </button>
        </div>`;
      }

      const p = d.preferencias || {};
      return `
        <div class="card ag-card mt-2 conectada">
          <div class="ag-topo">
            <div class="ag-glifo on">${this._icone()}</div>
            <div>
              <h3 class="ag-titulo">Agenda do Google <span class="ag-selo">conectada</span></h3>
              <p class="ag-sub">
                ${d.email ? `Como <b>${this._esc(d.email)}</b>. ` : ''}
                ${d.agenda ? 'A agenda "Solo Routines" está criada.'
                           : 'A agenda ainda não foi criada.'}
              </p>
            </div>
          </div>
          ${erro}

          <div class="ag-prefs">
            <label class="ag-chave">
              <input type="checkbox" data-ag-pref="dungeons" ${p.dungeons ? 'checked' : ''}>
              <span>Portões</span></label>
            <label class="ag-chave">
              <input type="checkbox" data-ag-pref="rotinas" ${p.rotinas ? 'checked' : ''}>
              <span>Rotinas com horário</span></label>
            <label class="ag-chave">
              <input type="checkbox" data-ag-pref="tarefas" ${p.tarefas ? 'checked' : ''}>
              <span>Missões com prazo</span></label>
          </div>

          <!-- PACTOS NÃO ESTÃO AQUI, e a ausência é deliberada. A tabela
               `pactos` não tem data nenhuma: ela é um CARDÁPIO de
               penitências que o Sistema serve quando o hunter falha, não
               uma agenda de vencimentos. Um interruptor "Pactos" que não
               sincronizasse nada seria só mais um botão mentiroso. -->


          <div class="ag-aviso-linha">
            <label for="ag-aviso">Avisar com antecedência de</label>
            <input type="number" class="ag-num" id="ag-aviso" min="0" max="1440"
                   value="${Number(p.aviso_min ?? 30)}"> <span>minutos</span>
          </div>

          <p class="ag-nota">
            O Solo entrega o evento; quem toca o alarme é o app do Google
            Calendar. Se ele não estiver instalado, ou com as notificações
            desligadas, o aviso não chega — e não há nada que o Solo possa
            fazer a respeito.
          </p>

          <div class="ag-acoes">
            <button type="button" class="ag-btn ag-btn-on" id="ag-sinc">Sincronizar agora</button>
            <button type="button" class="ag-btn" id="ag-testar">Testar conexão</button>
            <button type="button" class="ag-btn ag-perigo" id="ag-desconectar">Desconectar</button>
          </div>
          ${d.ultima_sync ? `<p class="ag-quando">Última sincronia: ${
            new Date(d.ultima_sync).toLocaleString('pt-BR')}</p>`
            : `<p class="ag-quando">Ainda não sincronizada.</p>`}
        </div>`;
    },

    /* O G do Google no botão de conectar. Não é enfeite: o hunter está
       prestes a sair do Solo e cair numa tela de outro domínio pedindo
       permissão. Ver de onde vem a marca ANTES do salto é o que separa
       "autorizar um app conhecido" de "cair numa página estranha". */
    _gGoogle() {
      return `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
        <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.3h6c-.3 1.4-1.1 2.6-2.3 3.4v2.8h3.7c2.2-2 3.4-5 3.4-8.3z"/>
        <path fill="#34A853" d="M12 23c3.1 0 5.7-1 7.6-2.8l-3.7-2.8c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v2.9C3.7 20.5 7.6 23 12 23z"/>
        <path fill="#FBBC05" d="M5.6 13.8c-.2-.7-.4-1.4-.4-2.3s.1-1.6.4-2.3V6.3H1.8C1 7.9.5 9.7.5 11.5s.5 3.6 1.3 5.2l3.8-2.9z"/>
        <path fill="#EA4335" d="M12 4.5c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1 15.1 0 12 0 7.6 0 3.7 2.5 1.8 6.3l3.8 2.9C6.5 6.5 9 4.5 12 4.5z"/>
      </svg>`;
    },

    _icone() {
      return `<svg viewBox="0 0 24 24" width="26" height="26" fill="none"
        stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="5" width="18" height="16" rx="2"/>
        <path d="M3 10h18M8 3v4M16 3v4"/><path d="m9 15 2 2 4-4"/></svg>`;
    },

    _esc(s) {
      return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]));
    },

    _ligar(caixa) {
      const bt = caixa.querySelector('#ag-conectar');
      if (bt) bt.onclick = () => this.conectar(bt);

      const s = caixa.querySelector('#ag-sinc');
      if (s) s.onclick = () => this.sincronizar(s);

      const t = caixa.querySelector('#ag-testar');
      if (t) t.onclick = () => this.testar(t);

      const d = caixa.querySelector('#ag-desconectar');
      if (d) d.onclick = () => this.desconectar();

      caixa.querySelectorAll('[data-ag-pref]').forEach(el => {
        el.onchange = () => this.salvarPrefs(caixa);
      });
      const a = caixa.querySelector('#ag-aviso');
      if (a) a.onchange = () => this.salvarPrefs(caixa);
    },

    async conectar(bt) {
      const antes = bt.innerHTML;   // innerHTML: o botão carrega o SVG do Google
      bt.disabled = true;
      bt.textContent = 'Abrindo o Google...';
      try {
        const r = await API.post('/calendario/conectar', {});
        /* `location.href`, e não `fetch`: o consentimento é uma página do
           Google, e o hunter precisa VER e clicar nela. */
        window.location.href = r.url;
      } catch (e) {
        bt.disabled = false;
        bt.innerHTML = antes;
        SoloDialog.toast(e.message || 'Não consegui iniciar a conexão.', 'error');
      }
    },

    /* O RESULTADO É DITO EM NÚMERO, não em "pronto!". Uma sincronia que
       responde "0 criados, 0 atualizados, 34 iguais" informa; um "sucesso"
       genérico esconde tanto o caso em que funcionou quanto o caso em que
       nada foi encontrado para escrever — e são situações muito
       diferentes para quem está esperando ver a agenda encher. */
    async sincronizar(bt) {
      const antes = bt.textContent;
      bt.disabled = true;
      bt.textContent = 'Sincronizando...';
      try {
        const r = await API.post('/calendario/sincronizar', {});
        const p = [];
        if (r.criados)     p.push(`${r.criados} criado(s)`);
        if (r.atualizados) p.push(`${r.atualizados} atualizado(s)`);
        if (r.removidos)   p.push(`${r.removidos} removido(s)`);
        if (!p.length)     p.push(`nada a mudar (${r.iguais || 0} em dia)`);
        SoloDialog.toast('Agenda: ' + p.join(', ') + '.',
                         r.erros ? 'warn' : 'success', r.erros ? 6000 : 4000);
        if (r.erros) {
          SoloDialog.toast(`${r.erros} item(ns) falharam.`, 'warn', 6000);
        }
      } catch (e) {
        SoloDialog.toast(e.message || 'A sincronia falhou.', 'error', 6000);
      } finally {
        bt.disabled = false;
        bt.textContent = antes;
        await this.montar();
      }
    },

    async testar(bt) {
      const antes = bt.textContent;
      bt.disabled = true;
      bt.textContent = 'Testando...';
      try {
        await API.post('/calendario/testar', {});
        SoloDialog.toast('Acesso renovado e agenda no lugar.', 'success');
      } catch (e) {
        SoloDialog.toast(e.message || 'A conexão falhou.', 'error');
      } finally {
        bt.disabled = false;
        bt.textContent = antes;
        await this.montar();   // repinta com o `ultimo_erro` novo, se houver
      }
    },

    /* `SoloDialog.confirm(msg, opts)` devolve Promise<boolean>. NÃO é
       `confirmar({...})` — esse é o `Modal.confirmar(titulo, msg, cb)` do
       app.js, que é por callback. Trocar um pelo outro faz o diálogo abrir
       e nunca resolver, e o botão fica morto sem erro no console. Este
       projeto já tropeçou nisso uma vez (ver missao-card.js:3225). */
    async desconectar() {
      const ok = await SoloDialog.confirm(
        'O Solo para de escrever e a permissão é revogada no Google. '
        + 'A agenda "Solo Routines" e o que já está nela continuam lá — '
        + 'apague pelo Google se quiser.',
        { titulo: 'Desconectar a agenda?', btnOk: 'Desconectar', tipo: 'warn' }
      );
      if (!ok) return;
      try {
        const r = await API.post('/calendario/desconectar', {});
        SoloDialog.toast(r.aviso || 'Agenda desconectada.',
                         r.aviso ? 'warn' : 'success');
      } catch (e) {
        SoloDialog.toast(e.message || 'Não consegui desconectar.', 'error');
      }
      await this.montar();
    },

    async salvarPrefs(caixa) {
      const corpo = {};
      caixa.querySelectorAll('[data-ag-pref]').forEach(el => {
        corpo[el.dataset.agPref] = el.checked;
      });
      const a = caixa.querySelector('#ag-aviso');
      if (a) corpo.aviso_min = parseInt(a.value, 10) || 0;
      try {
        await API.put('/calendario/preferencias', corpo);
      } catch (e) {
        SoloDialog.toast('Não consegui salvar a preferência.', 'error');
      }
    },

    /* ── A VOLTA DO GOOGLE ────────────────────────────────────────
       O fragmento é limpo assim que lido: deixá-lo na barra faria um F5
       repetir a mensagem de sucesso sobre uma conexão antiga. */
    lerRetorno() {
      const h = window.location.hash || '';
      if (h.indexOf('sr_cal') === -1) return false;
      const p = new URLSearchParams(h.slice(1));
      history.replaceState(null, '', window.location.pathname);

      if (p.get('sr_cal') === 'ok') {
        setTimeout(() => SoloDialog.toast('Agenda conectada.', 'success'), 400);
      } else if (p.get('sr_cal_erro')) {
        setTimeout(() => SoloDialog.toast(p.get('sr_cal_erro'), 'error', 8000), 400);
      }
      return true;
    },
  };

  window.Agenda = Agenda;
  document.addEventListener('DOMContentLoaded', () => Agenda.lerRetorno());
})();
