/* ══════════════════════════════════════════════════════════════════
   A ABA CALENDÁRIO — o mapa da programação

   O QUE ELA É, E O QUE ELA NÃO É

   Ela serve para ANALISAR: ver o que vem, quando os portões abrem, como
   está a semana. Não inicia nem encerra missão nenhuma — decisão do
   Arquiteto, e ela simplifica muito mais do que parece. Sem ação, a aba
   inteira é uma função pura do intervalo de datas: nada de estado
   otimista, nada de repintura cirúrgica, nada de conflito entre o que a
   tela mostra e o que o servidor aceita.

   A REGRA QUE ATRAVESSA O DESENHO INTEIRO

       passado e hoje → FATO      (linha real; aconteceu)
       futuro         → PREVISÃO  (projeção; ainda pode ser qualquer coisa)

   Os dias futuros NÃO EXISTEM no banco: `materializar()` cria só o dia
   corrente, de propósito, para não inventar derrotas retroativas. O
   servidor projeta a regra e marca cada ocorrência com `real`.

   Se as duas tiverem a mesma aparência, a tela mostra como consumado um
   dia que ainda nem chegou. Por isso previsão é vazada e tracejada, e
   fato é sólido. Não é estilo — é a integridade do que a tela afirma.

   DESEMPENHO

   · uma chamada por mês, com os resumos já calculados pelo servidor;
   · cada célula é montada como string e injetada de uma vez — 35 células
     construídas nó a nó é o custo que o LEVANTAMENTO_DASHBOARD já mediu;
   · sem `setInterval`: o calendário não tem cronômetro, e quem avisa que
     algo mudou é o `SoloSinc`;
   · meses vizinhos pré-carregados DEPOIS da primeira pintura.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
               'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const SEM = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
  const MAX_PASTILHAS = 3;

  const Calendario = {
    _ref: null,        // primeiro dia do mês em foco
    _cache: {},        // 'AAAA-MM' → resposta do servidor
    _hoje: null,
    _diaAberto: null,

    async carregar() {
      if (!this._ref) {
        const h = new Date();
        this._ref = new Date(h.getFullYear(), h.getMonth(), 1);
      }
      await this._pintar();
    },

    /* ── DATAS ───────────────────────────────────────────────────
       `toISOString()` converte para UTC e, num fuso negativo, devolve o
       dia ANTERIOR depois das 21h. O calendário inteiro deslizaria um
       dia à noite. Por isso a data é montada à mão. */
    _iso(d) {
      return d.getFullYear() + '-'
           + String(d.getMonth() + 1).padStart(2, '0') + '-'
           + String(d.getDate()).padStart(2, '0');
    },

    _chave(ref) {
      return ref.getFullYear() + '-' + String(ref.getMonth() + 1).padStart(2, '0');
    },

    /* A grade começa na SEGUNDA — é a convenção que o Solo já usa em
       `dias_semana` (0=seg) e no heatmap do Perfil. */
    _inicioGrade(ref) {
      const p = new Date(ref.getFullYear(), ref.getMonth(), 1);
      const desloc = (p.getDay() + 6) % 7;     // domingo=0 → 6
      p.setDate(p.getDate() - desloc);
      return p;
    },

    async _buscar(ref) {
      const k = this._chave(ref);
      if (this._cache[k]) return this._cache[k];

      const ini = this._inicioGrade(ref);
      const fim = new Date(ini);
      fim.setDate(fim.getDate() + 41);         // 6 semanas cobrem qualquer mês

      const r = await API.get(
        `/calendario/ocorrencias?de=${this._iso(ini)}&ate=${this._iso(fim)}`);
      this._cache[k] = r;
      this._hoje = r.hoje;
      return r;
    },

    async _pintar() {
      const cx = document.getElementById('cal-conteudo');
      if (!cx) return;
      cx.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';

      let dados;
      try {
        dados = await this._buscar(this._ref);
      } catch (e) {
        cx.innerHTML = `<div class="card"><p class="cal-vazio">
          ${this._esc(e.message || 'Não consegui carregar o calendário.')}</p></div>`;
        return;
      }

      cx.innerHTML = this._cabecalho() + this._grade(dados) + this._legenda();
      this._ligar(cx);
      this._vizinhos();
    },

    _cabecalho() {
      const r = this._ref;
      return `
        <div class="cal-topo">
          <button type="button" class="cal-nav" data-cal-mes="-1" aria-label="Mês anterior">‹</button>
          <div class="cal-mes">
            <h2>${MES[r.getMonth()]}</h2><span>${r.getFullYear()}</span>
          </div>
          <button type="button" class="cal-nav" data-cal-mes="1" aria-label="Próximo mês">›</button>
          <button type="button" class="cal-hoje" data-cal-hoje>Hoje</button>
        </div>`;
    },

    _grade(dados) {
      const ini = this._inicioGrade(this._ref);
      const mesAtual = this._ref.getMonth();
      let html = '<div class="cal-grade">';
      html += SEM.map(s => `<div class="cal-cab">${s}</div>`).join('');

      for (let i = 0; i < 42; i++) {
        const d = new Date(ini);
        d.setDate(d.getDate() + i);
        const iso = this._iso(d);
        const lista = dados.dias[iso] || [];
        const res = dados.resumos[iso] || {};

        const fora = d.getMonth() !== mesAtual;
        const hoje = iso === dados.hoje;
        const futuro = iso > dados.hoje;

        const cls = ['cal-dia'];
        if (fora) cls.push('fora');
        if (hoje) cls.push('hoje');
        if (futuro) cls.push('futuro');
        if (!lista.length) cls.push('vazio');

        html += `<div class="${cls.join(' ')}" data-cal-dia="${iso}"
                   ${lista.length ? 'tabindex="0" role="button"' : ''}>
          <div class="cal-num">${d.getDate()}</div>
          ${this._pastilhas(lista)}
          ${this._densidade(res, lista)}
        </div>`;
      }
      return html + '</div>';
    },

    _pastilhas(lista) {
      if (!lista.length) return '';
      const mostra = lista.slice(0, MAX_PASTILHAS);
      let h = '<div class="cal-pastilhas">';
      for (const o of mostra) {
        const cls = ['cal-p', 'cal-p--' + o.origem];
        if (!o.real) cls.push('prev');
        if (o.status === 'CONCLUIDA') cls.push('ok');
        if (o.status === 'FRACASSADA' || o.status === 'FRACASSADA_FATAL') cls.push('ko');
        const hora = o.hora_inicio ? `<b>${o.hora_inicio}</b> ` : '';
        h += `<span class="${cls.join(' ')}" title="${this._esc(o.titulo)}">
                ${hora}${this._esc(o.titulo)}</span>`;
      }
      if (lista.length > MAX_PASTILHAS) {
        h += `<span class="cal-mais">+${lista.length - MAX_PASTILHAS}</span>`;
      }
      return h + '</div>';
    },

    /* A BARRA DE DENSIDADE responde "que semana é essa?" de relance —
       antes de o olho ler um único título. */
    _densidade(res, lista) {
      if (!lista.length) return '';
      const t = res.total || lista.length;
      const ok = res.concluidas || 0;
      const ko = res.fracassadas || 0;
      const resto = Math.max(0, t - ok - ko);
      const p = n => (n / t * 100).toFixed(1) + '%';
      return `<div class="cal-densidade" title="${t} no dia">
        ${ok ? `<i class="ok" style="width:${p(ok)}"></i>` : ''}
        ${ko ? `<i class="ko" style="width:${p(ko)}"></i>` : ''}
        ${resto ? `<i style="width:${p(resto)}"></i>` : ''}
      </div>`;
    },

    _legenda() {
      return `<div class="cal-legenda">
        <span><i class="cal-am cal-am--rotina"></i> rotina</span>
        <span><i class="cal-am cal-am--dungeon"></i> portão</span>
        <span><i class="cal-am cal-am--tarefa"></i> missão geral</span>
        <span class="cal-sep"></span>
        <span><i class="cal-am prev"></i> previsão — ainda não aconteceu</span>
      </div>`;
    },

    /* ── O PAINEL DO DIA ─────────────────────────────────────────
       Sem botão de ação, por decisão do Arquiteto. Cada item leva para
       a tela dona dele: o calendário é um mapa, e mapa não dirige. */
    async abrirDia(iso) {
      const dados = this._cache[this._chave(this._ref)];
      const lista = (dados?.dias || {})[iso] || [];
      if (!lista.length) return;

      this._diaAberto = iso;
      const d = new Date(iso + 'T12:00:00');
      const futuro = iso > (dados.hoje || '');

      const itens = lista.map(o => {
        const hora = o.hora_inicio
          ? `<span class="cal-it-hora">${o.hora_inicio}${o.hora_fim ? '–' + o.hora_fim : ''}</span>`
          : '<span class="cal-it-hora vazia">sem hora</span>';
        const selo = o.status
          ? `<span class="cal-it-selo ${o.status.toLowerCase()}">${o.status.toLowerCase()}</span>`
          : (futuro ? '<span class="cal-it-selo prev">previsto</span>' : '');
        return `<button type="button" class="cal-item cal-item--${o.origem}"
                  data-cal-ir="${o.origem}" data-cal-id="${o.origem_id}">
          ${hora}
          <span class="cal-it-txt">${this._esc(o.titulo)}</span>
          ${o.rank ? `<span class="cal-it-rank">${o.rank}</span>` : ''}
          ${selo}
        </button>`;
      }).join('');

      const painel = document.getElementById('cal-painel');
      painel.innerHTML = `
        <div class="cal-painel-cab">
          <div>
            <h3>${d.getDate()} de ${MES[d.getMonth()]}</h3>
            <p>${lista.length} ${lista.length === 1 ? 'missão' : 'missões'}
               ${futuro ? '· programação prevista' : ''}</p>
          </div>
          <button type="button" class="cal-fechar" data-cal-fechar aria-label="Fechar">✕</button>
        </div>
        <div class="cal-itens">${itens}</div>`;
      painel.classList.add('on');

      painel.querySelector('[data-cal-fechar]').onclick = () => this.fecharDia();
      painel.querySelectorAll('[data-cal-ir]').forEach(b => {
        b.onclick = () => this._ir(b.dataset.calIr);
      });
    },

    fecharDia() {
      document.getElementById('cal-painel')?.classList.remove('on');
      this._diaAberto = null;
    },

    /* `App.navigate`, e não um nome inventado. O router do SPA se chama
       assim desde sempre (`_bindNavegacao` → `this.navigate(page)`), e
       chamar um método que não existe falharia em silêncio: o clique
       não faria nada e não haveria erro visível para investigar. */
    _ir(origem) {
      const destino = { rotina: 'rotinas', dungeon: 'dungeons', tarefa: 'tarefas' }[origem];
      if (destino && window.App && App.navigate) App.navigate(destino);
    },

    /* Meses vizinhos DEPOIS da primeira pintura: navegar fica
       instantâneo sem atrasar o que o hunter veio ver. */
    _vizinhos() {
      const volta = new Date(this._ref); volta.setMonth(volta.getMonth() - 1);
      const vai = new Date(this._ref); vai.setMonth(vai.getMonth() + 1);
      setTimeout(() => {
        this._buscar(volta).catch(() => {});
        this._buscar(vai).catch(() => {});
      }, 400);
    },

    _ligar(cx) {
      cx.querySelectorAll('[data-cal-mes]').forEach(b => {
        b.onclick = () => {
          this._ref.setMonth(this._ref.getMonth() + Number(b.dataset.calMes));
          this.fecharDia();
          this._pintar();
        };
      });
      const h = cx.querySelector('[data-cal-hoje]');
      if (h) h.onclick = () => {
        const n = new Date();
        this._ref = new Date(n.getFullYear(), n.getMonth(), 1);
        this.fecharDia();
        this._pintar();
      };
      cx.querySelectorAll('[data-cal-dia]').forEach(c => {
        c.onclick = () => this.abrirDia(c.dataset.calDia);
        c.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.click(); }
        };
      });
    },

    /* O SoloSinc avisa quando algo mudou. O cache do mês morre aqui —
       senão o calendário mostraria o retrato de antes da mudança. */
    invalidar() {
      this._cache = {};
    },

    _esc(s) {
      return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]));
    },
  };

  window.Calendario = Calendario;
})();
