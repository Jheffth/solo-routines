/* ============================================================
   O DOSSIÊ — a leitura longa do cartão

   O Arquiteto: "nas primeiras versões dos cards, quando o user clicava
   duas vezes sobre eles, abria um modal com mais dados da missão. Quero
   que traga isso de volta."

   O CARTÃO E O DOSSIÊ RESPONDEM PERGUNTAS DIFERENTES. O cartão diz "o
   que fazer agora" e por isso é curto; o dossiê diz "como tenho me saído
   nisso" e por isso é longo. Enfiar o segundo no primeiro foi o erro que
   o Arquiteto já reprovou no circuito — cartão grosso cheio de coisas.

   POR QUE DUPLO CLIQUE, E NÃO UM BOTÃO

   O cartão já tem seis ações concorrendo por espaço (iniciar, pausar,
   concluir, editar, excluir, extinguir). Um sétimo botão para "ver mais"
   competiria com os que fazem a missão andar. O duplo clique é gesto
   sobre o corpo do cartão: não ocupa pixel nenhum e não disputa com
   nada — e é onde ele já esteve antes.

   O QUE NÃO PODE ACONTECER: abrir o dossiê ao clicar duas vezes rápido
   em CONCLUIR. Por isso o gesto é ignorado quando nasce sobre qualquer
   `[data-mc-acao]`, campo ou link.
   ============================================================ */

const DossieMissao = {
  _aberto: null,          // a chave da missão em cartaz
  _ligado: false,
  _antes: null,           // quem tinha o foco antes de abrir

  /* ── A PORTA ────────────────────────────────────────────── */
  ligar() {
    if (this._ligado) return;
    this._ligado = true;

    /* Delegação no documento, uma vez. Ligar por cartão morreria na
       primeira repintura — e a lista repinta a cada ação. */
    document.addEventListener('dblclick', (ev) => {
      const alvo = ev.target;
      // Nunca sobre o que já faz alguma coisa: dois cliques rápidos em
      // "Concluir" são dois cliques em Concluir, não um pedido de dossiê.
      if (alvo.closest('[data-mc-acao]') || alvo.closest('input, textarea, select, a, summary')) return;
      const card = alvo.closest('[data-mc-card]');
      if (!card) return;
      ev.preventDefault();
      this.abrir(card.dataset.mcCard);
    });

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && this._aberto) this.fechar();
      if (ev.key === 'Tab' && this._aberto) this._prenderFoco(ev);
    });
  },

  /* O foco preso é o que torna o modal navegável por teclado. Sem isto o
     Tab escapa para o cartão atrás, que está visualmente coberto — e o
     hunter perde o cursor num lugar que não vê. */
  _prenderFoco(ev) {
    const cx = document.getElementById('dm-caixa');
    if (!cx) return;
    const focaveis = cx.querySelectorAll('button, [href], input, select, [tabindex]:not([tabindex="-1"])');
    if (!focaveis.length) return;
    const primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
    if (ev.shiftKey && document.activeElement === primeiro) { ev.preventDefault(); ultimo.focus(); }
    else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primeiro.focus(); }
  },

  async abrir(chave) {
    const m = (typeof MissaoCard !== 'undefined') ? MissaoCard._cache?.[chave] : null;
    if (!m) return;
    this._aberto = chave;
    this._antes = document.activeElement;

    /* A COR VEM DA PRIORIDADE, pela mesma tabela do cartao — o dossie
       de uma critica tem de chegar magenta como o cartao dela. Ler de
       `MissaoCard.PRIORIDADES` em vez de copiar a paleta e o que impede
       as duas telas de divergirem no dia em que a escala mudar. */
    const cor = (typeof MissaoCard !== 'undefined' && MissaoCard.PRIORIDADES)
      ? (MissaoCard.PRIORIDADES[(m.prioridade || 'MEDIA').toUpperCase()]
         || MissaoCard.PRIORIDADES.MEDIA).cor
      : '#7c3aed';
    this._montar(m, cor);
    // Esqueleto primeiro, dados depois: a janela abre na hora e preenche.
    // Esperar a rede para desenhar faria o duplo clique parecer sem efeito.
    try {
      const geral = m.origem === 'geral';
      const id = geral ? m.id : m.rotina_id;
      const d = await API.get(`${geral ? '/tarefas' : '/rotinas'}/${id}/dossie`);
      if (this._aberto === chave) this._pintar(d, m);
    } catch (err) {
      const c = document.getElementById('dm-corpo');
      if (c) c.innerHTML = `<div class="dm-erro">O Sistema não respondeu — ${this._esc(err.message || '')}</div>`;
    }
  },

  fechar() {
    const bd = document.getElementById('dm-backdrop');
    if (!bd) { this._aberto = null; return; }
    bd.classList.remove('on');
    // Espera a saída terminar antes de tirar do DOM — remover na hora
    // cortaria a transição no primeiro quadro.
    setTimeout(() => bd.remove(), 260);
    this._aberto = null;
    try { this._antes?.focus?.(); } catch (_) {}
  },

  /* ── O ESQUELETO ───────────────────────────────────────── */
  _montar(m, cor) {
    document.getElementById('dm-backdrop')?.remove();
    const el = document.createElement('div');
    el.id = 'dm-backdrop';
    el.className = 'dm-backdrop';
    el.style.setProperty('--dm-cor', cor);
    el.style.setProperty('--dm-cor-suave', this._alpha(cor, .16));
    el.innerHTML = `
      <div class="dm-caixa" id="dm-caixa" role="dialog" aria-modal="true"
           aria-label="Dossiê de ${this._esc(m.titulo || 'missão')}">
        <div class="dm-borda" aria-hidden="true"></div>
        <div class="dm-brilho" aria-hidden="true"></div>
        <header class="dm-topo">
          <div class="dm-selo" aria-hidden="true"><i></i></div>
          <div class="dm-tit">
            <span class="dm-rot">Dossiê</span>
            <h3>${this._esc(m.titulo || 'Missão')}</h3>
          </div>
          <button type="button" class="dm-x" id="dm-fechar" aria-label="Fechar">×</button>
        </header>
        <div class="dm-corpo" id="dm-corpo">
          <div class="dm-carregando"><i></i><i></i><i></i></div>
        </div>
      </div>`;
    document.body.appendChild(el);

    el.addEventListener('click', (ev) => { if (ev.target === el) this.fechar(); });
    document.getElementById('dm-fechar').addEventListener('click', () => this.fechar());
    /* Um quadro antes de acender, para a transicao ter de onde sair: a
       classe aplicada no mesmo quadro da insercao nao anima nada.
       `requestAnimationFrame` nem sempre existe (jsdom, por exemplo), e
       um modal que so abre onde ha rAF nao e um modal. */
    const proximoQuadro = (typeof requestAnimationFrame === 'function')
      ? requestAnimationFrame : (fn) => setTimeout(fn, 16);
    proximoQuadro(() => el.classList.add('on'));
    setTimeout(() => document.getElementById('dm-fechar')?.focus(), 60);
  },

  /* ── O CONTEÚDO ────────────────────────────────────────── */
  _pintar(d, m) {
    const c = document.getElementById('dm-corpo');
    if (!c) return;
    c.innerHTML = d.tipo === 'geral' ? this._geral(d) : this._rotina(d);
  },

  _rotina(d) {
    const cont = d.contagem || {};
    const t = d.tempo || {};
    const xp = d.xp || {};
    const cr = d.corrente || {};

    /* AS PLACAS. Quatro números que respondem, juntos, "como tenho me
       saído": a corrente que estou carregando, quanto do que foi pedido
       eu entreguei, meu melhor tempo e o saldo de XP. */
    const placas = [
      { rot: 'Corrente', val: cr.atual ?? 0, sub: `recorde ${cr.recorde ?? 0}`,
        cls: (cr.atual || 0) > 0 ? 'ok' : '' },
      { rot: 'Taxa', val: d.taxa === null || d.taxa === undefined ? '—' : d.taxa + '%',
        sub: `${cont.cumpridas || 0} de ${(cont.cumpridas || 0) + (cont.fracassadas || 0)} julgadas`,
        cls: d.taxa === null ? '' : (d.taxa >= 70 ? 'ok' : d.taxa >= 40 ? 'meio' : 'ruim') },
      { rot: 'Recorde', val: t.recorde != null ? this._dur(t.recorde) : '—',
        sub: t.medio != null ? `média ${this._dur(t.medio)}` : 'sem cronômetro ainda' },
      { rot: 'Saldo XP', val: (xp.saldo > 0 ? '+' : '') + (xp.saldo ?? 0),
        sub: `${xp.ganho ?? 0} ganho · ${xp.perdido ?? 0} perdido`,
        cls: (xp.saldo || 0) >= 0 ? 'ok' : 'ruim' },
    ];

    const sem = d.semana || {};
    const semanaLinhas = (sem.linhas || []).map(l => `
      <div class="dm-sem-linha">
        <span class="dm-sem-dia">${this._esc(l.dia)}</span>
        <div class="dm-sem-trilho"><i style="width:${l.pct}%"></i></div>
        <span class="dm-sem-pct">${l.pct}%</span>
        <span class="dm-sem-n">${l.n}×</span>
      </div>`).join('');

    return `
      ${this._grade(placas)}

      ${d.fita?.length ? `
      <section class="dm-sec">
        <h4>Últimos dias</h4>
        <div class="dm-fita">${d.fita.map(f => `
          <i class="dm-fita-q dm-q-${(f.status || '').toLowerCase()}"
             title="${this._esc(f.data)} — ${this._rotStatus(f.status)}"></i>`).join('')}</div>
        <div class="dm-legenda">
          <span><i class="dm-fita-q dm-q-concluida"></i>cumprida</span>
          <span><i class="dm-fita-q dm-q-fracassada"></i>fracassada</span>
          <span><i class="dm-fita-q dm-q-confessada"></i>confessada</span>
          <span><i class="dm-fita-q dm-q-aberta"></i>em aberto</span>
        </div>
      </section>` : ''}

      ${semanaLinhas ? `
      <section class="dm-sec">
        <h4>Por dia da semana</h4>
        ${sem.melhor && sem.pior ? `
          <p class="dm-nota">
            Você cumpre mais na <b class="ok">${this._esc(sem.melhor.dia)}</b>
            (${sem.melhor.pct}%) e menos na <b class="ruim">${this._esc(sem.pior.dia)}</b>
            (${sem.pior.pct}%).
          </p>` : '<p class="dm-nota">Ainda sem amostra para apontar um padrão — precisa de pelo menos três ocorrências no mesmo dia.</p>'}
        <div class="dm-semana">${semanaLinhas}</div>
      </section>` : ''}

      <section class="dm-sec">
        <h4>A ficha</h4>
        <div class="dm-linhas">
          ${this._linha('Instâncias', cont.total ?? 0)}
          ${this._linha('Cumpridas', cont.cumpridas ?? 0, 'ok')}
          ${this._linha('Fracassadas', cont.fracassadas ?? 0, (cont.fracassadas || 0) ? 'ruim' : '')}
          ${cont.confessadas ? this._linha('Confessadas', cont.confessadas) : ''}
          ${cont.em_aberto ? this._linha('Em aberto', cont.em_aberto) : ''}
          ${d.reergues?.vezes ? this._linha('Reerguidas',
              `${d.reergues.vezes}× · ${d.reergues.mana} de Mana`) : ''}
          ${d.penitencias_geradas ? this._linha('Penitências que gerou',
              d.penitencias_geradas, 'ruim') : ''}
          ${t.pior != null ? this._linha('Pior tempo', this._dur(t.pior)) : ''}
          ${d.dias_de_vida != null ? this._linha('Existe há',
              `${d.dias_de_vida} dia${d.dias_de_vida === 1 ? '' : 's'}`) : ''}
          ${this._linha('Natureza', this._rotNatureza(d.natureza))}
          ${this._linha('Recorrência', (d.tipo_rotina || '').toLowerCase())}
          ${this._linha('Prioridade · Dificuldade',
              `${(d.prioridade || '').toLowerCase()} · ${(d.dificuldade || '').toLowerCase()}`)}
        </div>
      </section>

      ${d.medidor ? `
      <section class="dm-sec dm-arq">
        <h4>Medidor de punição <span class="dm-arq-selo">Arquiteto</span></h4>
        <div class="dm-med">
          <div class="dm-med-trilho"><i style="width:${Math.min(100, d.medidor.carga)}%"></i></div>
          <span>${d.medidor.carga} / 100 · +${d.medidor.passo} por falha</span>
        </div>
        <p class="dm-nota">${d.medidor.cheio ? 'Cheio — a próxima leitura dispara.'
          : `Faltam ${d.medidor.falhas_para_encher} falha${d.medidor.falhas_para_encher === 1 ? '' : 's'} para disparar.`}</p>
      </section>` : ''}`;
  },

  _geral(d) {
    const xp = d.xp || {};
    const placas = [
      { rot: 'Estado', val: this._rotStatus(d.status),
        cls: d.status === 'CONCLUIDA' ? 'ok' : (d.status === 'FRACASSADA' ? 'ruim' : '') },
      { rot: 'XP', val: (d.status === 'CONCLUIDA' ? '+' + (xp.ganho || 0)
                        : (xp.perdido ? '−' + xp.perdido : xp.prometido || 0)),
        sub: d.status === 'CONCLUIDA' ? 'creditado'
             : (xp.perdido ? 'perdido' : 'prometido'),
        cls: d.status === 'CONCLUIDA' ? 'ok' : (xp.perdido ? 'ruim' : '') },
      { rot: 'Levou', val: d.duracao != null ? this._dur(d.duracao) : '—',
        sub: d.duracao != null ? 'do início ao fim' : 'sem cronômetro' },
    ];
    return `
      ${this._grade(placas)}
      <p class="dm-nota">Missão geral acontece uma vez — não há série para
        comparar. O que ela tem é a própria ficha.</p>
      <section class="dm-sec">
        <h4>A ficha</h4>
        <div class="dm-linhas">
          ${this._linha('Prevista para', d.data || '—')}
          ${d.hora_limite ? this._linha('Hora limite', d.hora_limite) : ''}
          ${d.nasceu_em ? this._linha('Criada em', this._quando(d.nasceu_em)) : ''}
          ${d.concluida_em ? this._linha('Concluída em', this._quando(d.concluida_em), 'ok') : ''}
          ${this._linha('Natureza', this._rotNatureza(d.natureza))}
          ${this._linha('Prioridade · Dificuldade',
              `${(d.prioridade || '').toLowerCase()} · ${(d.dificuldade || '').toLowerCase()}`)}
          ${d.eh_penitencia && d.origem_titulo
            ? this._linha('Cobrada por', `${this._esc(d.origem_titulo)}${d.origem_data ? ' · ' + d.origem_data : ''}`, 'ruim')
            : (d.origem_titulo ? this._linha('Nasceu de', this._esc(d.origem_titulo)) : '')}
          ${d.teste ? this._linha('Marca', 'punição de TESTE do Arquiteto') : ''}
        </div>
      </section>`;
  },

  /* ── Peças ─────────────────────────────────────────────── */
  _grade(placas) {
    return `<div class="dm-grade">${placas.map(p => `
      <div class="dm-placa ${p.cls || ''}">
        <span class="dm-placa-rot">${this._esc(p.rot)}</span>
        <b class="dm-placa-val">${this._esc(String(p.val))}</b>
        ${p.sub ? `<span class="dm-placa-sub">${this._esc(p.sub)}</span>` : ''}
      </div>`).join('')}</div>`;
  },

  _linha(rot, val, cls = '') {
    return `<div class="dm-linha"><span>${this._esc(rot)}</span>
      <b class="${cls}">${this._esc(String(val))}</b></div>`;
  },

  /* "4m 12s", "1h 03m" — nunca "252 segundos". */
  _dur(s) {
    s = Math.max(0, Math.round(s));
    if (s < 60) return `${s}s`;
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
    return r ? `${m}m ${String(r).padStart(2, '0')}s` : `${m}m`;
  },

  _quando(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit' });
    } catch (_) { return iso; }
  },

  _rotStatus(s) {
    return ({ CONCLUIDA: 'cumprida', FRACASSADA: 'fracassada', CONFESSADA: 'confessada',
              CANCELADA: 'cancelada', PENDENTE: 'pendente', ATIVA: 'em curso',
              PAUSADA: 'pausada', ABERTA: 'em aberto' })[(s || '').toUpperCase()] || '—';
  },

  _rotNatureza(n) {
    return ({ ATIVA: 'ativa', PASSIVA: 'passiva', REPETICAO: 'repetição',
              META: 'meta', CONDICIONAL: 'condicional', CIRCUITO: 'circuito',
              PUNICAO: 'penitência' })[(n || '').toUpperCase()] || (n || '—').toLowerCase();
  },

  _alpha(hex, a) {
    const h = String(hex || '#7c3aed').replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  },

  _esc(s) {
    return String(s ?? '').replace(/[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
};

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => DossieMissao.ligar());
  } else {
    DossieMissao.ligar();
  }
}
