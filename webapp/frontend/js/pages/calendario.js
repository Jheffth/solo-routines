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

      /* ── DUAS TELAS, NÃO UMA ENCOLHIDA ────────────────────────
         A primeira versão espremia a grade de sete colunas no celular e
         trocava as pastilhas por pontinhos. O resultado é inútil, e o
         Arquiteto disse isso com todas as letras: os pontos mostram que
         EXISTE algo, nunca O QUÊ, e com 12 ocorrências por dia todo dia
         fica idêntico. Uma grade de 42 células iguais não é calendário,
         é papel de parede.

         Num aparelho estreito não há largura para sete colunas de
         texto — e não adianta insistir. O que cabe é uma coluna, e uma
         coluna pede AGENDA: dia a dia, na vertical, com os títulos
         legíveis. A faixa de dias no topo devolve o panorama que a
         lista sozinha perderia. */
      cx.innerHTML = this._estreito()
        ? this._cabecalho() + this._faixa(dados) + this._agenda(dados)
        : this._cabecalho() + this._grade(dados) + this._legenda();

      this._ligar(cx);
      if (this._estreito()) this._ligarAgenda(cx);
      this._vizinhos();
      this._observarLargura();
    },

    /* O limiar mora AQUI e o CSS o repete. Dois números diferentes
       criariam uma faixa de largura em que o JS monta a agenda e o CSS
       estiliza a grade — ou o contrário. */
    _estreito() {
      return window.matchMedia('(max-width: 760px)').matches;
    },

    /* Girar o aparelho atravessa o limiar, e a tela montada para a outra
       largura fica quebrada até alguém navegar. Repinta só quando
       CRUZA — repintar a cada pixel de resize seria um desperdício. */
    _observarLargura() {
      if (this._mq) return;
      this._mq = window.matchMedia('(max-width: 760px)');
      const trocou = () => { this._diaAberto = null; this._pintar(); };
      if (this._mq.addEventListener) this._mq.addEventListener('change', trocou);
      else this._mq.addListener(trocou);
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
                   ${lista.length ? 'tabindex="0" role="button" aria-expanded="false"' : ''}>
          <div class="cal-num">${d.getDate()}</div>
          <div class="cal-resumo"><div>${this._pastilhas(lista)}</div></div>
          ${this._gaveta(lista)}
          ${this._densidade(res, lista)}
        </div>`;
      }
      return html + '</div>';
    },

    /* ══════════════════════════════════════════════════════════════
       A AGENDA — a tela do celular

       Uma coluna, dia a dia, com os títulos inteiros. É o formato que
       cabe num aparelho estreito sem mentir: não há truque de layout
       que faça sete colunas de texto caberem em 380px.
       ══════════════════════════════════════════════════════════════ */

    /* A FAIXA devolve o panorama que a lista sozinha perde. Cada dia é
       um botão estreito com o número e uma barra de densidade — dá para
       ver "a semana que vem é pesada" sem rolar a agenda inteira. */
    _faixa(dados) {
      const ini = new Date(this._ref.getFullYear(), this._ref.getMonth(), 1);
      const fim = new Date(this._ref.getFullYear(), this._ref.getMonth() + 1, 0);
      const SD = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

      let h = `<div class="cal-barra">
        <button type="button" class="cal-fseta" data-cal-passo="-1"
                aria-label="Dia anterior">‹</button>
        <div class="cal-faixa" role="tablist">`;

      for (let d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) {
        const iso = this._iso(d);
        const lista = dados.dias[iso] || [];
        const res = dados.resumos[iso] || {};
        const cls = ['cal-fd'];
        if (iso === dados.hoje) cls.push('hoje');
        if (iso > dados.hoje) cls.push('futuro');
        if (!lista.length) cls.push('vazio');
        h += `<button type="button" class="${cls.join(' ')}" data-cal-ir-dia="${iso}">
          <span class="cal-fd-sem">${SD[d.getDay()]}</span>
          <span class="cal-fd-num">${d.getDate()}</span>
          ${lista.length ? this._densidade(res, lista) : '<i class="cal-fd-nada"></i>'}
        </button>`;
      }

      return h + `</div>
        <button type="button" class="cal-fseta" data-cal-passo="1"
                aria-label="Próximo dia">›</button>
      </div>`;
    },

    /* ── AS SETAS DA FAIXA ───────────────────────────────────────
       Elas movem a SELEÇÃO, não a rolagem. Rolar a faixa deixaria o dia
       escolhido para trás e a agenda parada — dois controles de
       navegação discordando um do outro na mesma tela.

       E ELAS ATRAVESSAM O MÊS. Travar no dia 1 é exatamente o beco que
       o Arquiteto descreveu: a pessoa quer "andar pelos dias" e esbarra
       numa parede que não tem motivo de existir. Os meses vizinhos já
       estão em cache (`_vizinhos`), então a travessia é instantânea. */
    async _passoDia(dir) {
      const dados = this._cache[this._chave(this._ref)];
      if (!dados) return;

      const base = this._diaSel || dados.hoje;
      const d = new Date(base + 'T12:00:00');
      d.setDate(d.getDate() + dir);

      if (d.getMonth() !== this._ref.getMonth()) {
        this._ref = new Date(d.getFullYear(), d.getMonth(), 1);
        this._diaSel = this._iso(d);
        await this._pintar();          // o mês novo já vem do cache
        return;
      }
      this._irAteDia(this._iso(d));
    },

    _agenda(dados) {
      const ini = new Date(this._ref.getFullYear(), this._ref.getMonth(), 1);
      const fim = new Date(this._ref.getFullYear(), this._ref.getMonth() + 1, 0);
      const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

      let h = '<div class="cal-agenda">';
      let vazios = 0;

      for (let d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) {
        const iso = this._iso(d);
        const lista = dados.dias[iso] || [];

        /* DIA VAZIO NÃO GANHA SEÇÃO. Trinta cabeçalhos com "nada" fazem
           a rolagem parecer o dobro do tamanho e escondem os dias que
           importam entre linhas mortas. Eles viram uma contagem. */
        if (!lista.length) { vazios++; continue; }
        if (vazios) {
          h += `<div class="cal-ag-pulo">${vazios} ${vazios === 1 ? 'dia livre' : 'dias livres'}</div>`;
          vazios = 0;
        }

        const hoje = iso === dados.hoje;
        const futuro = iso > dados.hoje;
        h += `<section class="cal-ag-dia${hoje ? ' hoje' : ''}${futuro ? ' futuro' : ''}"
                 id="ag-${iso}">
          <header class="cal-ag-cab">
            <span class="cal-ag-num">${d.getDate()}</span>
            <span class="cal-ag-sem">${SEMANA[d.getDay()]}</span>
            ${hoje ? '<span class="cal-ag-selo">hoje</span>' : ''}
            <span class="cal-ag-conta">${lista.length}</span>
          </header>
          <div class="cal-ag-itens">`;

        for (const o of lista) {
          const cls = ['cal-ag-item', 'cal-ag-item--' + o.origem];
          if (!o.real) cls.push('prev');
          if (o.status === 'CONCLUIDA') cls.push('ok');
          if (o.status === 'FRACASSADA' || o.status === 'FRACASSADA_FATAL') cls.push('ko');
          const hora = o.hora_inicio
            ? `${o.hora_inicio}${o.hora_fim ? '–' + o.hora_fim : ''}`
            : '—';
          h += `<button type="button" class="${cls.join(' ')}"
                  data-cal-ir="${o.origem}">
            <span class="cal-ag-hora">${hora}</span>
            <span class="cal-ag-txt">${this._esc(o.titulo)}</span>
            ${o.rank ? `<span class="cal-ag-rank">${o.rank}</span>` : ''}
          </button>`;
        }
        h += '</div></section>';
      }
      if (vazios) {
        h += `<div class="cal-ag-pulo">${vazios} ${vazios === 1 ? 'dia livre' : 'dias livres'}</div>`;
      }
      return h + '</div>';
    },

    _ligarAgenda(cx) {
      cx.querySelectorAll('[data-cal-ir-dia]').forEach(b => {
        b.onclick = () => this._irAteDia(b.dataset.calIrDia);
      });
      cx.querySelectorAll('.cal-ag-item[data-cal-ir]').forEach(b => {
        b.onclick = () => this._ir(b.dataset.calIr);
      });
      cx.querySelectorAll('[data-cal-passo]').forEach(b => {
        b.onclick = () => this._passoDia(Number(b.dataset.calPasso));
      });

      /* Abre no dia escolhido — ou em hoje. `_diaSel` sobrevive à troca
         de mês feita pelas setas, senão atravessar para o dia 1 do mês
         seguinte jogaria a tela de volta para "hoje", que está no mês
         anterior. */
      const dados = this._cache[this._chave(this._ref)];
      const alvo = this._diaSel || dados?.hoje;
      if (alvo) this._irAteDia(alvo, false);

      this._seguirRolagem(cx);
    },

    /* ── A FAIXA SEGUE A LEITURA ─────────────────────────────────
       Rolando a agenda com o dedo, a faixa acompanha e destaca o dia
       que está sendo lido. Sem isso ela vira um enfeite que só muda
       quando alguém a toca — e o hunter perde a referência de onde
       está no mês exatamente quando mais precisa dela. */
    _seguirRolagem(cx) {
      if (this._obs) this._obs.disconnect();
      const secoes = cx.querySelectorAll('.cal-ag-dia');
      if (!secoes.length) return;

      this._obs = new IntersectionObserver((entradas) => {
        // O topo da tela manda: a seção mais alta ainda visível é a que
        // o hunter está lendo.
        const visiveis = entradas.filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (!visiveis.length) return;
        const iso = visiveis[0].target.id.replace('ag-', '');
        this._marcarNaFaixa(iso, true);
      }, { rootMargin: '-84px 0px -70% 0px', threshold: 0 });

      secoes.forEach(s => this._obs.observe(s));
    },

    /* `suave` distingue quem chamou: a rolagem do dedo não pode
       arrastar a faixa com animação (fica perseguindo o dedo e treme),
       mas o clique numa seta precisa do movimento para o olho
       acompanhar para onde foi. */
    _marcarNaFaixa(iso, suave) {
      const bt = document.querySelector(`[data-cal-ir-dia="${iso}"]`);
      if (!bt || bt.classList.contains('sel')) return;
      document.querySelectorAll('.cal-fd.sel').forEach(x => x.classList.remove('sel'));
      bt.classList.add('sel');

      /* `scrollIntoView` no botão rolaria a PÁGINA junto, desfazendo a
         leitura da agenda. Mexer só no `scrollLeft` da faixa mantém a
         página parada — e centralizar é o que traz o dia de hoje para a
         vista sem o hunter procurar. */
      const faixa = bt.parentElement;
      const alvo = bt.offsetLeft - (faixa.clientWidth / 2) + (bt.offsetWidth / 2);
      faixa.scrollTo({ left: Math.max(0, alvo), behavior: suave ? 'smooth' : 'auto' });
    },

    /* `_diaSel` É GRAVADO AQUI, e não só quando as setas mexem nele.
       Sem isto, tocar no dia 24 na faixa não mudava a seleção guardada,
       e a seta seguinte pulava de volta para o dia seguinte a HOJE — o
       controle discordava do que estava na tela. */
    _irAteDia(iso, rolar = true) {
      this._diaSel = iso;
      this._marcarNaFaixa(iso, rolar);
      const sec = document.getElementById('ag-' + iso);
      if (!sec) return;
      sec.scrollIntoView({ block: 'start', behavior: rolar ? 'smooth' : 'auto' });
      sec.classList.add('pisca');
      setTimeout(() => sec.classList.remove('pisca'), 900);
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

    /* ── A GAVETA ────────────────────────────────────────────────
       A lista inteira do dia, dobrada dentro da própria célula. Ela é
       montada JUNTO com a grade, e não no clique, por dois motivos:

       · a animação de abrir precisa do conteúdo já medido, senão a
         gaveta salta em vez de deslizar;
       · montar no clique significaria remontar a cada abertura, e o
         hunter abre e fecha vários dias seguidos ao varrer o mês.

       O custo é baixo: são as mesmas ocorrências que a resposta já
       trouxe, e o `<div>` fechado tem altura zero. */
    _gaveta(lista) {
      if (!lista.length) return '';
      const linhas = lista.map((o, i) => {
        const cls = ['cal-p', 'cal-p--' + o.origem];
        if (!o.real) cls.push('prev');
        if (o.status === 'CONCLUIDA') cls.push('ok');
        if (o.status === 'FRACASSADA' || o.status === 'FRACASSADA_FATAL') cls.push('ko');
        const hora = o.hora_inicio
          ? `<b>${o.hora_inicio}</b> ` : '<b class="sh">—</b> ';
        return `<span class="${cls.join(' ')}" data-cal-ir="${o.origem}"
                  data-cal-i="${i}" title="${this._esc(o.titulo)}">
                  ${hora}${this._esc(o.titulo)}</span>`;
      }).join('');

      return `<div class="cal-gaveta"><div>
        <div class="cal-rolo">${linhas}</div>
        <div class="cal-setas">
          <button type="button" class="cal-seta" data-cal-rola="-1"
                  aria-label="Anteriores">▲</button>
          <span class="cal-conta">${lista.length} no dia</span>
          <button type="button" class="cal-seta" data-cal-rola="1"
                  aria-label="Próximas">▼</button>
        </div>
      </div></div>`;
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
          /* O DIA SELECIONADO MORRE AO TROCAR DE MES pelas setas do
             cabecalho. Mante-lo apontaria para uma data que nao existe
             mais na tela, e a agenda tentaria rolar ate uma secao
             ausente -- ficando parada no topo sem explicacao. */
          this._diaSel = null;
          this.fecharDia();
          document.querySelectorAll('.cal-dia.aberto').forEach(o => this.fechar(o));
          this._pintar();
        };
      });
      const h = cx.querySelector('[data-cal-hoje]');
      if (h) h.onclick = () => {
        const n = new Date();
        this._ref = new Date(n.getFullYear(), n.getMonth(), 1);
        this._diaSel = null;          // "Hoje" quer dizer hoje, nao o ultimo escolhido
        this.fecharDia();
        document.querySelectorAll('.cal-dia.aberto').forEach(o => this.fechar(o));
        this._pintar();
      };
      cx.querySelectorAll('[data-cal-dia]').forEach(c => {
        c.onclick = (e) => {
          // Clique num item da gaveta navega; clique na célula alterna.
          const item = e.target.closest('[data-cal-ir]');
          if (item) { e.stopPropagation(); this._ir(item.dataset.calIr); return; }
          if (e.target.closest('[data-cal-rola]')) return;   // seta tem o seu
          this.alternar(c);
        };
        c.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.alternar(c); }
          if (e.key === 'Escape') this.fechar(c);
        };
        c.querySelectorAll('[data-cal-rola]').forEach(b => {
          b.onclick = (ev) => {
            ev.stopPropagation();
            this._rolar(c, Number(b.dataset.calRola));
          };
        });
      });
    },

    /* ── ABRIR E FECHAR ──────────────────────────────────────────
       UM DIA ABERTO POR VEZ. Dois abertos esticariam duas linhas da
       grade ao mesmo tempo e o mês perderia a forma — que é justamente
       o que se veio ver. */
    alternar(cel) {
      if (!cel || cel.classList.contains('vazio')) return;

      /* NO ESTREITO, O PAINEL. Uma célula de 90px não segura uma lista
         de missões — abrir ali entregaria texto cortado. O painel tem a
         tela inteira, e no celular é a única forma que funciona.
         O limiar é o MESMO do CSS (760px); dois números diferentes
         criariam uma faixa em que a célula abre e a gaveta está oculta. */
      if (window.matchMedia('(max-width: 760px)').matches) {
        this.abrirDia(cel.dataset.calDia);
        return;
      }

      const jaAberto = cel.classList.contains('aberto');
      document.querySelectorAll('.cal-dia.aberto').forEach(o => this.fechar(o));
      if (jaAberto) return;

      cel.classList.add('aberto');
      cel.setAttribute('aria-expanded', 'true');
      this._diaAberto = cel.dataset.calDia;

      /* A SETA SÓ EXISTE SE FALTAR ESPAÇO. Medir depois da transição
         começar daria a altura fechada (zero) e a seta nunca apareceria
         — por isso a medição espera o próximo quadro, quando a gaveta
         já tem altura. */
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const rolo = cel.querySelector('.cal-rolo');
        if (rolo && rolo.scrollHeight > rolo.clientHeight + 2) {
          cel.classList.add('transborda');
          this._atualizarSetas(cel);
          rolo.onscroll = () => this._atualizarSetas(cel);
        }
      }));
    },

    fechar(cel) {
      if (!cel) return;
      cel.classList.remove('aberto', 'transborda');
      cel.setAttribute('aria-expanded', 'false');
      const rolo = cel.querySelector('.cal-rolo');
      if (rolo) { rolo.scrollTop = 0; rolo.onscroll = null; }
      if (this._diaAberto === cel.dataset.calDia) this._diaAberto = null;
    },

    _rolar(cel, dir) {
      const rolo = cel.querySelector('.cal-rolo');
      if (!rolo) return;
      // Rola por PÁGINA, não por pixel fixo: três linhas de altura
      // variável não são um número redondo, e rolar 60px deixaria meia
      // pastilha cortada no topo.
      rolo.scrollBy({ top: dir * (rolo.clientHeight - 24), behavior: 'smooth' });
    },

    /* Seta desligada na ponta: um botão que rola para onde não há nada
       é um clique que não faz nada, e o hunter conclui que quebrou. */
    _atualizarSetas(cel) {
      const rolo = cel.querySelector('.cal-rolo');
      const [cima, baixo] = cel.querySelectorAll('[data-cal-rola]');
      if (!rolo || !cima || !baixo) return;
      const fim = rolo.scrollHeight - rolo.clientHeight;
      cima.disabled = rolo.scrollTop <= 2;
      baixo.disabled = rolo.scrollTop >= fim - 2;
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
