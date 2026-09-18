/* ══════════════════════════════════════════════════════════════════
   A SINCRONIA — manter a tela em dia sem recarregar à toa

   O INCÔMODO QUE ORIGINOU ISTO, nas palavras do Arquiteto:

     "abro o app no celular, cumpro algumas missões, mas o app estava
      aberto no computador; quando chego em casa, nada no computador
      mudou — é preciso atualizar a página."

   E o mais interessante: A MÁQUINA JÁ EXISTIA. `app.js` já tinha três
   gatilhos — o evento do cartão, a volta da aba e uma ronda de 60s.
   Havia dois furos, e nenhum deles era falta de código.

   FURO 1 · A ABA QUE NUNCA FICOU OCULTA

   `visibilitychange` dispara quando a aba é ESCONDIDA e quando VOLTA.
   Mas o computador que dorme com a aba em primeiro plano nunca a
   esconde: a tela apaga, o sistema suspende, e para o navegador aquela
   aba continuou visível o tempo todo. Nenhum evento acontece.

   E os timers não ajudam: `setInterval` suspende junto com a máquina.
   Ao acordar, ele retoma a contagem de onde parou — não dispara uma
   rajada para compensar as horas perdidas.

   O jeito de perceber o sono é olhar o RELÓGIO DE PAREDE, não o timer.
   Se entre dois tiques de 15 segundos passaram 4 horas, a máquina
   dormiu. Nenhum evento avisa; a aritmética, sim.

   FURO 2 · A RONDA CARA DEMAIS PARA SER FREQUENTE

   A ronda recarregava a PÁGINA INTEIRA a cada 60s. Baixar para 15s
   deixaria a tela quatro vezes mais reativa e custaria quatro vezes
   mais — para, quase sempre, descobrir que nada mudou.

   Por isso o `/dashboard/pulso`: uma pergunta de ~20 bytes. Pergunta-se
   de quinze em quinze segundos; recarrega-se só quando a resposta muda.
   Mais reativo E mais barato que a ronda anterior, ao mesmo tempo.

   O DIÁRIO, E POR QUE ELE EXISTE

   O `catch` da sincronia antiga era silencioso na tela — correto — mas
   isso também significava que, quando o Arquiteto dizia "não
   atualizou", não havia como saber se a sincronia tinha rodado e
   falhado, ou simplesmente nunca rodado. São causas opostas.

   `SoloSinc.diario()` devolve os últimos 40 eventos, e eles sobrevivem
   ao recarregar a página — que é exatamente o momento em que a prova
   se perderia. É o instrumento do diagnóstico, não decoração.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const PULSO_MS   = 15000;   // de quanto em quanto se PERGUNTA
  const RONDA_MS   = 300000;  // rede de segurança: recarrega de 5 em 5 min
  const SONO_MS    = 90000;   // salto de relógio acima disto = a máquina dormiu
  const DIARIO_MAX = 40;
  const CHAVE      = 'sr_sinc_diario';

  const SoloSinc = {
    _rev: null,
    _pulsoTimer: null,
    _rondaTimer: null,
    _ultimoTique: Date.now(),
    _ligado: false,

    /* ── O DIÁRIO ────────────────────────────────────────────────
       Em `localStorage` de propósito: um diário que morre no F5
       some justamente quando o Arquiteto vai olhar para ele. */
    anotar(evento, extra) {
      try {
        const d = this.diario();
        d.push({ t: new Date().toISOString(), evento, ...(extra || {}) });
        while (d.length > DIARIO_MAX) d.shift();
        localStorage.setItem(CHAVE, JSON.stringify(d));
      } catch (_) { /* cota cheia ou modo privado: seguir sem diário */ }
    },

    diario() {
      try { return JSON.parse(localStorage.getItem(CHAVE) || '[]'); }
      catch (_) { return []; }
    },

    /* O que colar aqui quando algo não atualizar. */
    diagnostico() {
      const d = this.diario();
      console.table(d);
      return {
        ligado: this._ligado,
        revisaoAtual: this._rev,
        ultimoTiqueHa: Math.round((Date.now() - this._ultimoTique) / 1000) + 's',
        temToken: !!localStorage.getItem('sr_token'),
        visivel: !document.hidden,
        online: navigator.onLine,
        eventos: d,
      };
    },

    /* ── O PULSO ─────────────────────────────────────────────── */
    async _perguntar(motivo) {
      if (document.hidden) return;                 // aba oculta não pergunta
      if (!localStorage.getItem('sr_token')) return;

      try {
        const r = await API.get('/dashboard/pulso');
        const nova = r && r.rev;
        if (!nova) return;

        if (this._rev === null) {                  // primeira leitura
          this._rev = nova;
          this.anotar('pulso:base', { rev: nova });
          return;
        }
        if (nova !== this._rev) {
          this.anotar('pulso:mudou', { de: this._rev, para: nova, motivo });
          this._rev = nova;
          this.recarregar('pulso');
        }
      } catch (e) {
        /* Silencioso na TELA, nunca no diário. Foi a falta deste
           registro que tornou o defeito original indiagnosticável. */
        this.anotar('pulso:erro', { erro: String(e && e.message || e) });
      }
    },

    recarregar(motivo) {
      this.anotar('recarregar', { motivo, pagina: window.App && App.currentPage });
      try {
        if (window.App && App.atualizarPaginaAtual) App.atualizarPaginaAtual();
      } catch (e) {
        this.anotar('recarregar:erro', { erro: String(e && e.message || e) });
      }
    },

    /* ── O RELÓGIO DE PAREDE ─────────────────────────────────────
       O único jeito de perceber que a máquina dormiu. Nenhum evento
       do navegador conta essa história quando a aba ficou visível o
       tempo todo — mas o salto no relógio conta. */
    _tique() {
      const agora = Date.now();
      const salto = agora - this._ultimoTique;
      this._ultimoTique = agora;

      if (salto > SONO_MS) {
        this.anotar('acordou', { paradoSegundos: Math.round(salto / 1000) });
        this._rev = null;          // a base velha não vale mais nada
        this.recarregar('acordou');
        this._perguntar('acordou');
        return;
      }
      this._perguntar('ronda');
    },

    iniciar() {
      if (this._ligado) return;
      this._ligado = true;
      this.anotar('iniciou');

      this._ultimoTique = Date.now();
      clearInterval(this._pulsoTimer);
      this._pulsoTimer = setInterval(() => this._tique(), PULSO_MS);

      /* A RONDA CONTINUA EXISTINDO, mais espaçada. O pulso compara um
         retrato do que o hunter VÊ — se algo mudar fora desse retrato,
         só a recarga periódica pega. Rede de segurança, não o caminho
         principal. */
      clearInterval(this._rondaTimer);
      this._rondaTimer = setInterval(() => {
        if (!document.hidden) this.recarregar('ronda');
      }, RONDA_MS);

      // A aba voltou — o caso em que o computador NÃO dormiu.
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { this.anotar('ocultou'); return; }
        this.anotar('voltou');
        this._ultimoTique = Date.now();   // não confundir aba oculta com sono
        this._perguntar('voltou');
      });

      /* A REDE VOLTOU. Wi-Fi caído derruba toda pergunta enquanto
         durar; sem isto, a tela só se recuperaria no próximo tique. */
      window.addEventListener('online', () => {
        this.anotar('rede:voltou');
        this._perguntar('rede');
      });
      window.addEventListener('offline', () => this.anotar('rede:caiu'));

      /* Voltar pelo botão "voltar" do navegador restaura a página do
         cache de páginas, com os dados congelados de quando ela saiu. */
      window.addEventListener('pageshow', (e) => {
        if (e.persisted) {
          this.anotar('bfcache');
          this._rev = null;
          this.recarregar('bfcache');
        }
      });

      this._perguntar('inicio');
    },

    parar() {
      clearInterval(this._pulsoTimer);
      clearInterval(this._rondaTimer);
      this._ligado = false;
      this.anotar('parou');
    },
  };

  window.SoloSinc = SoloSinc;
})();
