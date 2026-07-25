/* ============================================================
   missao-card.js — Cartão do Sistema (componente de produção)

   DOIS MODOS IRMÃOS, mesma família visual, mensagens diferentes:

     modo 'missao'  (padrão) → a OCORRÊNCIA. "carregar Dolphin em 14/07".
                               Status, prazo, ações de execução.
     modo 'agenda'          → a REGRA.      "carregar Dolphin toda terça".
                               Frequência, próxima ocorrência, gestão.

   Uso na lista (ocorrências):
     MissaoCard.cachear(missoes);
     container.innerHTML = missoes.map(m => MissaoCard.html(m)).join('');
     MissaoCard.montar(container, { onMudou: () => Dashboard.carregar() });

   Uso na agenda (regras cruas de /rotinas/):
     MissaoCard.cachear(rotinas, { modo: 'agenda' });
     container.innerHTML = rotinas.map(r => MissaoCard.html(r, { modo: 'agenda' })).join('');
     MissaoCard.montar(container, { onMudou, onAcao });

   - Estados vêm do backend; nada é inventado no cliente
   - Delegação de eventos: um listener por container, não por cartão
   - Timer único para todos os cartões (um setInterval global)
   Requer: css/missao-card.css
   ============================================================ */

const MissaoCard = {

  /* ── Tabelas ───────────────────────────────────────────────
     REGRA DE COR: quem comanda o cartão é a PRIORIDADE (urgência),
     mantendo a convenção que o app já usa nas listas.
     A DIFICULDADE vira o selo de rank (ela multiplica o XP).      */
  PRIORIDADES: {
    CRITICA: { cor: '#ef4444', rotulo: 'Crítica' },
    ALTA:    { cor: '#f97316', rotulo: 'Alta'    },
    MEDIA:   { cor: '#f59e0b', rotulo: 'Média'   },
    BAIXA:   { cor: '#10b981', rotulo: 'Baixa'   },
  },
  RANKS: {   // dificuldade -> selo de rank (multiplicador de XP)
    FACIL:    { letra: 'C', mult: '×0.5' },
    NORMAL:   { letra: 'B', mult: '×1'   },
    DIFICIL:  { letra: 'A', mult: '×1.5' },
    LENDARIO: { letra: 'S', mult: '×2.5' },
  },
  STATUS: {
    PENDENTE:   { rotulo: '⏳ Pendente',   classe: 'st-pendente'   },
    ATIVA:      { rotulo: '▶ Em curso',    classe: 'st-ativa'      },
    PAUSADA:    { rotulo: '⏸ Pausada',     classe: 'st-pausada'    },
    CONCLUIDA:  { rotulo: '✓ Concluída',   classe: 'st-concluida'  },
    FRACASSADA: { rotulo: '☠ Fracassada',  classe: 'st-fracassada' },
    CANCELADA:  { rotulo: '✕ Cancelada',   classe: 'st-cancelada'  },
  },
  /* Índice = weekday() do Python (0=segunda), que é o que o backend grava em
     dias_semana. Date.getDay() usa outra origem (0=domingo) — converter sempre. */
  DIAS_CURTOS: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],

  /* Glifos de categoria — SVG de linha (estilo profissional, sem emoji).
     Cada um é o miolo de um viewBox 0 0 24 24, traço = currentColor. */
  GLIFOS: {
    'saude':    '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    'trabalho': '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    'estudo':   '<path d="M12 7v13"/><path d="M3 18V5a1 1 0 0 1 1-1h4a4 4 0 0 1 4 4 4 4 0 0 1 4-4h4a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3H4a1 1 0 0 1-1-1z"/>',
    'casa':     '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 21V12h6v9"/>',
    'pessoal':  '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    'combate':  '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    'default':  '<path d="M12 2l8 10-8 10-8-10z"/>',
  },

  _catKey(categoria) {
    return (categoria || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');   // "Saúde" → "saude"
  },

  _glifoCat(categoria) {
    const paths = this.GLIFOS[this._catKey(categoria)] || this.GLIFOS.default;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  },

  /* Raio (XP) e disco de mana (moedas) — SVG, no lugar dos emojis. */
  _glifoXp() {
    return `<svg class="mc-glifo-xp" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13 2 L4 14 h6 l-1 8 L20 9 h-6 z"/></svg>`;
  },
  _glifoMoeda() {
    return `<svg class="mc-glifo-moeda" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" aria-hidden="true">
      <circle cx="12" cy="12" r="8"/><path d="M12 8 L15 12 L12 16 L9 12 Z" fill="currentColor" stroke="none"/></svg>`;
  },

  /* Glifos miúdos da ficha de agenda e do chip de data. Traço fino de 1.8
     para não pesar ao lado de texto de .62rem. */
  _glifoMini(paths) {
    return `<svg class="mc-glifo-mini" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  },
  _glifoCal()     { return this._glifoMini('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>'); },
  _glifoRelogio() { return this._glifoMini('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'); },
  _glifoCiclo()   { return this._glifoMini('<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>'); },

  /* ── Sigilo (ícone cinético em SVG) ────────────────────── */
  _sigilo(cor, categoria) {
    return `
      <div class="mc-sigilo">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <g class="mc-sigilo-anel">
            <circle cx="50" cy="50" r="34" fill="none" stroke="${cor}" stroke-opacity=".45"
                    stroke-width="2" stroke-dasharray="9 7"/>
          </g>
          <polygon points="50,26 62,50 50,74 38,50" fill="${cor}" fill-opacity=".18"
                   stroke="${cor}" stroke-opacity=".7" stroke-width="1.5"/>
          <g class="mc-sigilo-arco">
            <circle cx="50" cy="50" r="42" fill="none" stroke="${cor}" stroke-opacity=".85"
                    stroke-width="2" stroke-dasharray="22 242" stroke-linecap="round"/>
          </g>
        </svg>
        <span class="mc-sigilo-ico">${this._glifoCat(categoria)}</span>
      </div>`;
  },

  /* ── Utilitários ─────────────────────────────────────────── */
  _alpha(hex, a) {
    const n = parseInt(String(hex).slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  },
  _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },
  _hm(h) { return h ? String(h).slice(0, 5) : ''; },

  _hojeISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },
  /* new Date("2026-07-24") é lido como UTC e, a oeste de Greenwich, volta um
     dia. Por isso a data ISO é quebrada à mão em componentes locais. */
  _dataDe(iso) {
    if (!iso) return null;
    const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    if (!a || !m || !d) return null;
    return new Date(a, m - 1, d);
  },
  _ddmm(dt) {
    return String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0');
  },
  /* Sem o campo data o registro é legado (rotina crua de hoje) — trata como hoje. */
  _ehHoje(m) {
    return !m || !m.data || String(m.data).slice(0, 10) === this._hojeISO();
  },

  /* ── Chave de DOM/cache ──────────────────────────────────
     ExecucaoDia.id=5 e TarefaDia.id=5 coexistem, então `id` sozinho colide.
     O contrato manda usar `uid`; `id` só sobrevive como queda de compatibilidade
     para dados antigos (a página de Rotinas ainda entrega rotina crua). */
  _chave(m, modo) {
    if (modo === 'agenda') return 'a' + m.id;
    return String(m.uid != null ? m.uid : m.id);
  },

  /* ── Prazo: devolve {texto, classe, pct} ─────────────────
     Só faz sentido para a ocorrência de HOJE: o relógio compara com o agora.
     Numa missão de ontem o contador correria para trás sem significado algum. */
  _prazo(m) {
    if (!this._ehHoje(m)) return null;
    const fim = m.hora_fim || m.hora_limite;
    if (!fim) return null;
    const [h, mi] = fim.split(':').map(Number);
    const alvo = new Date(); alvo.setHours(h, mi, 0, 0);
    const ini = (() => {
      if (!m.hora_inicio) return null;
      const [hi, mii] = m.hora_inicio.split(':').map(Number);
      const d = new Date(); d.setHours(hi, mii, 0, 0); return d;
    })();

    let seg = Math.floor((alvo - Date.now()) / 1000);
    if (seg <= 0) return { texto: 'Prazo vencido', classe: 'vencido', pct: 100 };

    const hh = Math.floor(seg / 3600), mm = Math.floor((seg % 3600) / 60), ss = seg % 60;
    const texto = hh > 0 ? `${hh}h ${String(mm).padStart(2,'0')}m ${String(ss).padStart(2,'0')}s`
                         : `${mm}m ${String(ss).padStart(2,'0')}s`;
    // % da janela já decorrida (se houver hora de início)
    let pct = 0;
    if (ini && alvo > ini) pct = Math.min(100, Math.max(0, (Date.now() - ini) / (alvo - ini) * 100));
    return { texto, classe: seg < 1800 ? 'urgente' : '', pct };
  },

  /* O Arquiteto vê poderes que os demais hunters não têm */
  _ehArquiteto() {
    try { return window.Auth?.getUsuario?.()?.nivel_acesso === 'Arquiteto'; }
    catch (_) { return false; }
  },

  /* ── Selo de recompensa ──────────────────────────────────
     Enquanto a missão corre, o selo mostra o PROMETIDO. Depois de fechada
     mostra o REALIZADO — que raramente bate com o prometido (bônus de streak,
     penalidade). Num card já concluído o número prometido só engana. */
  _recompensa(m, status, rotulo) {
    const primeiro = (...vs) => {
      for (const v of vs) if (v !== null && v !== undefined) return v;
      return 0;
    };
    const tit = ` title="${this._esc(rotulo || 'Recompensa da missão')}"`;

    if (status === 'CONCLUIDA') {
      const xp = primeiro(m.xp_ganho, m.xp_ganho_hoje, m.xp_recompensa);
      const mo = primeiro(m.moedas_ganhas, m.moedas_hoje, m.moedas_recompensa);
      return `<div class="mc-recompensa mc-rec-ganho" title="Recompensa recebida">
        ${this._glifoXp()}<b>+${xp}</b><span class="mc-rec-un">XP</span>
        ${mo ? `<span class="mc-rec-sep"></span>${this._glifoMoeda()}<b class="mc-rec-moeda">+${mo}</b>` : ''}
      </div>`;
    }
    if (status === 'FRACASSADA') {
      const perda = Math.abs(primeiro(m.xp_perdido, m.xp_perdido_hoje, m.penalidade_xp));
      return `<div class="mc-recompensa mc-rec-perda" title="Penalidade aplicada">
        ${this._glifoXp()}<b>−${perda}</b><span class="mc-rec-un">XP</span>
      </div>`;
    }
    return `<div class="mc-recompensa"${tit}>
      ${this._glifoXp()}<b>${m.xp_recompensa || 0}</b><span class="mc-rec-un">XP</span>
      ${m.moedas_recompensa ? `<span class="mc-rec-sep"></span>${this._glifoMoeda()}<b class="mc-rec-moeda">${m.moedas_recompensa}</b>` : ''}
    </div>`;
  },

  /* ── Desfecho em selo (usado quando não há ação possível) ── */
  _selo(status) {
    switch (status) {
      case 'CONCLUIDA':  return `<span class="mc-selo mc-selo-ok">✓ Missão cumprida</span>`;
      case 'FRACASSADA': return `<span class="mc-selo mc-selo-falha">☠ Prazo perdido</span>`;
      case 'CANCELADA':  return `<span class="mc-selo mc-selo-neutro">✕ Cancelada</span>`;
      case 'ATIVA':      return `<span class="mc-selo mc-selo-neutro">▶ Ficou em curso</span>`;
      case 'PAUSADA':    return `<span class="mc-selo mc-selo-neutro">⏸ Ficou pausada</span>`;
      default:           return `<span class="mc-selo mc-selo-neutro">⏳ Não cumprida</span>`;
    }
  },

  /* ── Ações da OCORRÊNCIA (máquina de estados) ──────────── */
  _acoes(status, chave, m = {}) {
    const b = (acao, cls, rot, extra = '') =>
      `<button class="mc-btn ${cls}" data-mc-acao="${acao}" data-mc-id="${chave}" ${extra}>${rot}</button>`;

    // Duas permissões distintas, e tratá-las como uma só criava regressão:
    //   editavel    → EXECUTAR. Só hoje: não se conclui ontem nem se adianta amanhã.
    //   gerenciavel → EDITAR/EXCLUIR. De hoje em diante.
    // O passado é histórico: fica só o selo do desfecho. Já uma missão FUTURA
    // não é executável, mas continua editável — sem isto, agendar algo para
    // amanhã produzia um cartão que ninguém mais conseguia corrigir.
    // (comparar com !== false mantém os dados legados, que não trazem os campos.)
    const podeExecutar = m.editavel    !== false;
    const podeGerir    = m.gerenciavel !== undefined
      ? m.gerenciavel !== false
      : podeExecutar;

    if (!podeExecutar && !podeGerir) return this._selo(status);

    // Extinguir: exclusivo do Arquiteto — apaga a missão e estorna
    // todo o XP/moedas que ela já concedeu. Sempre disponível.
    const extinguir = this._ehArquiteto()
      ? b('extinguir', 'mc-btn-extinguir', '⟁',
          'title="Extinguir (Arquiteto) — apaga a missão e estorna todo o XP que ela já deu"')
      : '';

    // Editar / Excluir: ações discretas delegadas à página (onAcao),
    // presentes em QUALQUER estado. Não competem com Iniciar/Concluir.
    // 'excluir' é a exclusão NORMAL — diferente do 'extinguir' do Arquiteto.
    const gerir = podeGerir
      ? b('editar',  'mc-btn-editar',  '✏️', 'title="Editar missão"') +
        b('excluir', 'mc-btn-excluir', '🗑', 'title="Excluir missão"')
      : '';

    // Missão futura: existe, é ajustável, mas ainda não chegou a vez dela.
    if (!podeExecutar) {
      return `<span class="mc-selo mc-selo-neutro">🗓 Agendada</span>` + gerir + extinguir;
    }

    let acoes;
    switch (status) {
      case 'PENDENTE':
        acoes = b('iniciar', 'mc-btn-iniciar', '▶ Iniciar Missão') +
                b('cancelar', 'mc-btn-neutro', '✕', 'title="Cancelar hoje"');
        break;
      case 'ATIVA':
        acoes = b('pausar', 'mc-btn-neutro', '⏸ Pausar') +
                b('cancelar', 'mc-btn-perigo', '✕ Cancelar hoje') +
                b('concluir', 'mc-btn-concluir', '✓ Concluir');
        break;
      case 'PAUSADA':
        acoes = b('retomar', 'mc-btn-iniciar', '▶ Retomar') +
                b('cancelar', 'mc-btn-perigo', '✕ Cancelar hoje') +
                b('concluir', 'mc-btn-concluir', '✓ Concluir');
        break;
      case 'CONCLUIDA':
        acoes = `<span class="mc-selo mc-selo-ok">✓ Missão cumprida</span>`;
        break;
      case 'FRACASSADA':
        acoes = `<span class="mc-selo mc-selo-falha">☠ Prazo perdido</span>`;
        break;
      case 'CANCELADA':
        acoes = `<span class="mc-selo mc-selo-neutro">✕ Cancelada hoje</span>` +
                b('retomar', 'mc-btn-neutro', '↺ Retomar');
        break;
      default:
        acoes = '';
    }
    return acoes + gerir + extinguir;
  },

  /* ── Ações da REGRA (gestão, nunca execução) ─────────────
     Uma regra não se "conclui": ela agenda. Por isso aqui só existem
     suspender/reativar, editar, excluir e o extinguir do Arquiteto.
     Os nomes 'suspender'/'reativar' são propositalmente diferentes de
     'pausar'/'retomar' para que um clique na agenda nunca caia na rota
     de execução da ocorrência do dia. */
  _acoesAgenda(chave, ativo) {
    const b = (acao, cls, rot, extra = '') =>
      `<button class="mc-btn ${cls}" data-mc-acao="${acao}" data-mc-id="${chave}"
               data-mc-modo="agenda" ${extra}>${rot}</button>`;

    const extinguir = this._ehArquiteto()
      ? b('extinguir', 'mc-btn-extinguir', '⟁',
          'title="Extinguir (Arquiteto) — apaga a regra, o histórico e estorna o XP concedido"')
      : '';

    const alternar = ativo
      ? b('suspender', 'mc-btn-neutro',  '⏸ Suspender', 'title="A regra para de gerar missões"')
      : b('reativar',  'mc-btn-iniciar', '▶ Reativar',  'title="A regra volta a gerar missões"');

    return alternar +
      b('editar',  'mc-btn-editar',  '✏️', 'title="Editar regra"') +
      b('excluir', 'mc-btn-excluir', '🗑', 'title="Excluir regra"') +
      extinguir;
  },

  /* ── Frequência em linguagem humana ──────────────────────
     "Seg · Qua · Sex" lê-se de relance; "[0,2,4]" não. Os atalhos
     "Dias úteis"/"Fim de semana" cobrem os dois arranjos mais comuns. */
  _frequencia(r) {
    const tipo = (r.tipo || 'DIARIA').toUpperCase();
    if (tipo === 'DIARIA') return 'Todo dia';
    if (tipo === 'SEMANAL') {
      const dias = [...new Set(r.dias_semana || [])]
        .filter(d => Number.isInteger(d) && d >= 0 && d <= 6)
        .sort((a, b) => a - b);
      if (!dias.length)     return 'Semanal';
      if (dias.length === 7) return 'Todo dia';
      const chave = dias.join(',');
      if (chave === '0,1,2,3,4') return 'Dias úteis';
      if (chave === '5,6')       return 'Fim de semana';
      return dias.map(d => this.DIAS_CURTOS[d]).join(' · ');
    }
    if (tipo === 'MENSAL') return r.dia_mes ? `Todo dia ${r.dia_mes}` : 'Mensal';
    if (tipo === 'ANUAL') {
      const md = String(r.mes_dia || '').split('-');
      return md.length === 2 && md[0] && md[1] ? `Todo ${md[1]}/${md[0]}` : 'Anual';
    }
    if (tipo === 'AVULSA') return 'Sem repetição';
    return tipo;
  },

  /* Espelha _eh_rotina_de_hoje() do backend (rotinas.py). Se as duas
     divergirem, a agenda promete um dia em que nada será gerado. */
  _ocorreEm(r, d) {
    const tipo = (r.tipo || 'DIARIA').toUpperCase();
    if (tipo === 'DIARIA') return true;
    if (tipo === 'SEMANAL') {
      const dias = r.dias_semana || [];
      return dias.includes((d.getDay() + 6) % 7);   // Date.getDay(): 0=domingo
    }
    if (tipo === 'MENSAL') return !!r.dia_mes && d.getDate() === r.dia_mes;
    if (tipo === 'ANUAL') {
      const md = String(r.mes_dia || '').split('-');
      return md.length === 2 &&
             (d.getMonth() + 1) === Number(md[0]) && d.getDate() === Number(md[1]);
    }
    return false;   // AVULSA não se repete
  },

  /* Varredura dia a dia por até 366 dias: qualquer regra periódica cai dentro
     de um ano, e o laço é curto o bastante para rodar por cartão sem custo.
     Fórmula fechada por tipo daria o mesmo com três vezes mais casos de borda
     (dia 31 em fevereiro, 29/02 em ano comum). */
  _proxima(r) {
    if (r.ativo === false) return { texto: 'Suspensa', classe: 'ag-suspensa' };
    const d = new Date(); d.setHours(0, 0, 0, 0);
    for (let i = 0; i <= 366; i++) {
      if (this._ocorreEm(r, d)) {
        if (i === 0) return { texto: 'Hoje',   classe: 'ag-hoje' };
        if (i === 1) return { texto: 'Amanhã', classe: 'ag-breve' };
        const dia = this.DIAS_CURTOS[(d.getDay() + 6) % 7].toLowerCase();
        return { texto: `${dia}, ${this._ddmm(d)}`, classe: '' };
      }
      d.setDate(d.getDate() + 1);
    }
    return null;
  },

  _janela(r) {
    const i = this._hm(r.hora_inicio), f = this._hm(r.hora_fim);
    if (i && f) return `${i} – ${f}`;
    if (f)      return `até ${f}`;
    if (i)      return `a partir de ${i}`;
    return '';
  },

  /* ── HTML: porta de entrada dos dois modos ─────────────── */
  html(m, opts = {}) {
    return (opts.modo === 'agenda')
      ? this._htmlAgenda(m, opts)
      : this._htmlMissao(m, opts);
  },

  /* ── HTML da OCORRÊNCIA ──────────────────────────────────
     opts.compacto → variante FINA (usada no Extrato do Dashboard):
     mesmo componente, layout condensado numa faixa baixa. */
  _htmlMissao(m, opts = {}) {
    const compacto = opts.compacto ? ' mc-compacto' : '';
    const status = m.status_hoje || m.status || 'PENDENTE';
    const st     = this.STATUS[status] || this.STATUS.PENDENTE;
    const prior  = this.PRIORIDADES[(m.prioridade || 'MEDIA').toUpperCase()] || this.PRIORIDADES.MEDIA;
    const rank   = this.RANKS[(m.dificuldade || 'NORMAL').toUpperCase()] || this.RANKS.NORMAL;
    const prazo  = this._prazo(m);
    const chave  = this._chave(m, 'missao');
    const cor    = prior.cor;                      // ← a prioridade comanda

    // Card selado: o extrato mistura dias, e um cartão de ontem não pode
    // parecer clicável. A classe muda o visual; _acoes() corta os botões.
    const selado = m.editavel === false ? ' mc-selado' : '';

    // Chip de data: só aparece quando a missão NÃO é de hoje. Sem ele, ao
    // rolar o extrato o hunter perde a noção de qual dia está lendo.
    const dt = this._ehHoje(m) ? null : this._dataDe(m.data);
    const chipData = dt
      ? `<span class="mc-chip mc-chip-data" title="Dia desta missão">${this._glifoCal()} ${this._ddmm(dt)}</span>`
      : '';

    // Selo de recompensa — mesma marca nos dois modos. No cheio ele flutua
    // no topo direito; no compacto ele entra no FLUXO dos chips (à esquerda),
    // onde se alinha naturalmente em vez de flutuar num x variável.
    const recompensa = this._recompensa(m, status);

    return `
    <div class="mc ${st.classe}${compacto}${selado}" data-mc-card="${chave}"
         style="--mc-cor:${cor};--mc-cor-suave:${this._alpha(cor, .14)}">
      <div class="mc-fio"></div>
      ${this._sigilo(cor, m.categoria)}
      <div class="mc-corpo">
        <div class="mc-topo">
          <div class="mc-titulo" title="${this._esc(m.titulo)}">${this._esc(m.titulo) || 'Missão'}</div>
          ${compacto ? '' : recompensa}
        </div>

        <div class="mc-chips">
          <span class="mc-chip mc-chip-prior">◆ ${prior.rotulo}</span>
          <span class="mc-chip mc-chip-rank" title="Dificuldade ${(m.dificuldade || 'NORMAL').toLowerCase()} — XP ${rank.mult}">✦ ${rank.letra}-Rank</span>
          <span class="mc-chip mc-chip-status">${st.rotulo}</span>
          ${m.categoria ? `<span class="mc-chip mc-chip-cat">${this._esc(m.categoria)}</span>` : ''}
          ${chipData}
          ${prazo ? `<span class="mc-div"></span>
          <span class="mc-prazo ${prazo.classe}" data-mc-prazo="${chave}">
            <span class="lbl">⏳ Prazo</span> <span data-mc-timer>${prazo.texto}</span>
          </span>` : ''}
          ${compacto ? recompensa : ''}
        </div>

        ${prazo ? `<div class="mc-barra"><div class="mc-barra-fill" data-mc-barra="${chave}"
                     style="width:${prazo.pct}%"></div></div>` : ''}

        ${compacto ? '' : `<div class="mc-acoes">${this._acoes(status, chave, m)}</div>`}
      </div>
      ${compacto ? `<div class="mc-acoes">${this._acoes(status, chave, m)}</div>` : ''}
    </div>`;
  },

  /* ── HTML da REGRA (agenda) ──────────────────────────────
     Irmão do cartão de missão: mesmo casco, mesmo sigilo, mesmos chips.
     A diferença é o miolo — em vez de contador de prazo, uma FICHA de
     agendamento (frequência / próxima / janela). Nenhum data-mc-prazo é
     emitido aqui: regra não tem prazo, e registrar um faria o timer global
     girar de graça enquanto a tela estivesse aberta. */
  _htmlAgenda(r, opts = {}) {
    const prior = this.PRIORIDADES[(r.prioridade || 'MEDIA').toUpperCase()] || this.PRIORIDADES.MEDIA;
    const rank  = this.RANKS[(r.dificuldade || 'NORMAL').toUpperCase()] || this.RANKS.NORMAL;
    const cor   = prior.cor;
    const chave = this._chave(r, 'agenda');
    const ativo = r.ativo !== false;
    const prox  = this._proxima(r);
    const janela = this._janela(r);
    const tipo  = (r.tipo || 'DIARIA').toUpperCase();

    return `
    <div class="mc mc-agenda ${ativo ? 'ag-ativa' : 'ag-pausada'}" data-mc-card="${chave}"
         style="--mc-cor:${cor};--mc-cor-suave:${this._alpha(cor, .14)}">
      <div class="mc-fio"></div>
      ${this._sigilo(cor, r.categoria)}
      <div class="mc-corpo">
        <div class="mc-topo">
          <div class="mc-titulo" title="${this._esc(r.titulo)}">${this._esc(r.titulo) || 'Rotina'}</div>
          ${this._recompensa(r, 'PENDENTE', 'Recompensa por ocorrência')}
        </div>

        <div class="mc-chips">
          <span class="mc-chip mc-chip-prior">◆ ${prior.rotulo}</span>
          <span class="mc-chip mc-chip-rank" title="Dificuldade ${(r.dificuldade || 'NORMAL').toLowerCase()} — XP ${rank.mult}">✦ ${rank.letra}-Rank</span>
          <span class="mc-chip mc-chip-estado ${ativo ? 'on' : 'off'}">${ativo ? '◎ Ativa' : '⏸ Pausada'}</span>
          ${r.categoria ? `<span class="mc-chip mc-chip-cat">${this._esc(r.categoria)}</span>` : ''}
          <span class="mc-chip mc-chip-tipo">${tipo}</span>
        </div>

        ${r.descricao ? `<div class="mc-ag-desc">${this._esc(r.descricao)}</div>` : ''}

        <div class="mc-ag-ficha">
          <div class="mc-ag-linha">
            <span class="mc-ag-rot">${this._glifoCiclo()}Frequência</span>
            <span class="mc-ag-val">${this._frequencia(r)}</span>
          </div>
          <div class="mc-ag-linha">
            <span class="mc-ag-rot">${this._glifoCal()}Próxima</span>
            <span class="mc-ag-val ${prox ? prox.classe : ''}">${prox ? prox.texto : '—'}</span>
          </div>
          ${janela ? `<div class="mc-ag-linha">
            <span class="mc-ag-rot">${this._glifoRelogio()}Janela</span>
            <span class="mc-ag-val mc-ag-num">${janela}</span>
          </div>` : ''}
        </div>

        <div class="mc-acoes">${this._acoesAgenda(chave, ativo)}</div>
      </div>
    </div>`;
  },

  /* ── Montagem: delegação de eventos + timer único ──────── */
  montar(container, opts = {}) {
    if (!container) return;
    this._onMudou = opts.onMudou || null;
    this._onAcao  = opts.onAcao || null;
    this._demo    = !!opts.demo;

    if (!container.dataset.mcBound) {
      container.dataset.mcBound = '1';
      container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-mc-acao]');
        if (!btn) return;
        e.preventDefault();
        // A chave é STRING (uid "r123" / "a45"): parseInt aqui truncaria tudo
        // para o id numérico e reabriria a colisão que o uid resolve.
        this._executar(btn.dataset.mcAcao, btn.dataset.mcId, btn);
      });
    }
    this._iniciarTimer();
  },

  /* Um único intervalo atualiza TODOS os prazos da tela */
  _iniciarTimer() {
    if (this._timer) return;
    this._timer = setInterval(() => {
      const alvos = document.querySelectorAll('[data-mc-prazo]');
      if (!alvos.length) { clearInterval(this._timer); this._timer = null; return; }
      alvos.forEach(el => {
        const m = this._cache?.[el.dataset.mcPrazo];
        if (!m) return;
        const p = this._prazo(m);
        if (!p) return;
        el.querySelector('[data-mc-timer]').textContent = p.texto;
        el.classList.toggle('urgente', p.classe === 'urgente');
        el.classList.toggle('vencido', p.classe === 'vencido');
        const barra = document.querySelector(`[data-mc-barra="${el.dataset.mcPrazo}"]`);
        if (barra) barra.style.width = p.pct + '%';
      });
    }, 1000);
  },

  /* Encerra o timer de prazo na hora (a página chama ao sair da tela). */
  pararTimer() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  },

  /* ── Cache (alimenta timer, ações e diálogos) ────────────
     opts.modo  : 'missao' (uid) | 'agenda' (prefixo "a" + id da regra).
                  Os dois espaços de chave são disjuntos de propósito — uma
                  tela pode listar o extrato e a agenda ao mesmo tempo.
     opts.merge : some listas convivem na mesma tela; sem isto a segunda
                  chamada apagaria a primeira. */
  cachear(itens, opts = {}) {
    const modo = opts.modo === 'agenda' ? 'agenda' : 'missao';
    if (!opts.merge || !this._cache) this._cache = {};
    (itens || []).forEach(m => { this._cache[this._chave(m, modo)] = m; });
  },

  /* ── Roteamento das ações ────────────────────────────────
     ARMADILHA nº1 do contrato: `m.id` é o id da OCORRÊNCIA, mas as rotas
     /rotinas/ esperam o id da REGRA (`m.rotina_id`). Mandar m.id numa rota
     /rotinas/ age silenciosamente na rotina errada.
     O terceiro caso é o legado: registro sem `origem` vem da página de
     Rotinas, onde `m.id` ainda É o id da regra. */
  _rota(chave) {
    const m = this._cache?.[chave] || {};
    if (m.origem === 'geral')  return { m, base: '/tarefas', id: m.id,        tarefa: true  };
    if (m.origem === 'rotina') return { m, base: '/rotinas', id: m.rotina_id, tarefa: false };
    const legado = (m.id !== undefined && m.id !== null) ? m.id : parseInt(chave, 10);
    return { m, base: '/rotinas', id: legado, tarefa: false };
  },

  /* ── Execução das ações contra a API real ──────────────── */
  async _executar(acao, chave, btn) {
    if (btn?.dataset?.mcModo === 'agenda') return this._executarAgenda(acao, chave, btn);

    const { m, base, id, tarefa } = this._rota(chave);

    // Editar / Excluir (normal): o card não resolve — delega à página.
    // NÃO toca a API. (Não confundir com 'extinguir', do Arquiteto.)
    if (acao === 'editar' || acao === 'excluir') {
      this._onAcao && this._onAcao(acao, id, m, chave);
      return;
    }
    // Extinguir é irreversível: confirma ANTES de qualquer coisa
    if (acao === 'extinguir') return this._extinguir(chave);
    if (this._demo) return this._demoTransicao(acao, chave);

    // Trava de segurança: origem "rotina" sem rotina_id significa que a lista
    // não foi cacheada (ou veio malformada). Disparar assim mandaria a ação
    // para /rotinas/undefined — ou, pior, para a rotina errada num retry.
    if (!Number.isFinite(Number(id))) {
      SoloDialog?.toast?.('Não consegui identificar a missão — recarregue a lista.', 'error');
      return;
    }

    const card = document.querySelector(`[data-mc-card="${chave}"]`);
    btn.disabled = true;
    try {
      let resp;
      switch (acao) {
        case 'iniciar':  resp = await API.post(`${base}/${id}/iniciar`, {});  break;
        case 'pausar':   resp = await API.post(`${base}/${id}/pausar`, {});   break;
        case 'retomar':  resp = await API.post(`${base}/${id}/retomar`, {});  break;
        case 'cancelar': resp = await API.post(`${base}/${id}/cancelar`, {}); break;
        case 'concluir':
          // Tarefa fecha por rota própria; rotina fecha pela Execução, que é
          // quem grava streak e bônus.
          resp = tarefa ? await API.post(`/tarefas/${id}/concluir`, {})
                        : await API.execucoes.concluirRotina(id);
          if (typeof missionComplete === 'function' && card) {
            // As duas rotas premiam em envelopes diferentes: a tarefa devolve
            // {tarefa, resultado} e a rotina devolve o ganho na raiz. Sem
            // olhar os dois, a comemoração de toda missão geral saía "+0 XP".
            const g = resp?.resultado || resp || {};
            missionComplete(card, g.xp_ganho || 0, g.moedas_ganhas || 0);
          }
          break;
      }
      if (this._onMudou) await this._onMudou(resp, acao, id, chave);
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
      btn.disabled = false;
    }
  },

  /* ── Execução das ações da AGENDA ────────────────────────
     Suspender/reativar são um simples toque no campo `ativo`, então o card
     resolve sozinho e repinta só o próprio cartão — recarregar a lista
     inteira por um toggle seria desproporcional. Editar e excluir continuam
     com a página, que é quem tem o formulário e o diálogo de confirmação. */
  async _executarAgenda(acao, chave, btn) {
    const r  = this._cache?.[chave] || {};
    const id = r.id !== undefined ? r.id : parseInt(String(chave).slice(1), 10);

    if (acao === 'editar' || acao === 'excluir') {
      this._onAcao && this._onAcao(acao, id, r, chave);
      return;
    }
    if (acao === 'extinguir') return this._extinguir(chave, { agenda: true });
    if (acao !== 'suspender' && acao !== 'reativar') return;

    const ativo = (acao === 'reativar');
    btn.disabled = true;
    try {
      if (!this._demo) await API.put(`/rotinas/${id}`, { ativo });
      r.ativo = ativo;
      const card = document.querySelector(`[data-mc-card="${chave}"]`);
      if (card) card.outerHTML = this.html(r, { modo: 'agenda' });
      SoloDialog?.toast?.(ativo ? 'Regra reativada — volta a gerar missões.'
                                : 'Regra suspensa — não gera novas missões.', 'info');
      if (this._onMudou) await this._onMudou(null, acao, id, chave);
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
      btn.disabled = false;
    }
  },

  /* ── Extinguir (Arquiteto): apaga e estorna o XP ─────────
     Na agenda o alvo é a REGRA inteira; no extrato de origem "rotina" o
     backend também só expõe DELETE da regra — logo o texto avisa que o
     histórico vai junto. */
  async _extinguir(chave, opts = {}) {
    const agenda = !!opts.agenda;
    const alvo = agenda
      ? { m: this._cache?.[chave] || {}, base: '/rotinas',
          id: (this._cache?.[chave]?.id ?? parseInt(String(chave).slice(1), 10)) }
      : this._rota(chave);
    const m = alvo.m || {};
    const rotulo = agenda ? 'esta rotina' : 'esta missão';

    const ok = await SoloDialog.confirm(
      `Extinguir <b>"${this._esc(m.titulo) || rotulo}"</b> da existência?<br><br>` +
      `<span style="color:#f87171">Isto apaga ${agenda ? 'a rotina' : 'a missão'}, todo o seu histórico e ` +
      `<b>estorna o XP e as moedas</b> que ela já concedeu.</span><br>` +
      `<span style="color:#94a3b8;font-size:.8rem">Poder exclusivo do Arquiteto · irreversível</span>`,
      { titulo: agenda ? 'Extinguir Rotina' : 'Extinguir Missão', tipo: 'error', icon: '⟁',
        btnOk: 'Extinguir', btnCancel: 'Manter' }
    );
    if (!ok) return;

    const card = document.querySelector(`[data-mc-card="${chave}"]`);
    try {
      if (!this._demo) await API.delete(`${alvo.base}/${alvo.id}?extinguir=true`);
      // Dissolução: o cartão se desfaz antes de sumir
      if (card) {
        card.classList.add('mc-extinguindo');
        if (typeof SFX !== 'undefined') SFX.play('carimbo');
        setTimeout(() => card.remove(), 700);
      }
      if (this._cache) delete this._cache[chave];
      SoloDialog?.toast?.(agenda ? '⟁ Rotina extinta — XP estornado'
                                 : '⟁ Missão extinta — XP estornado', 'info');
      if (!this._demo && this._onMudou) {
        setTimeout(() => this._onMudou(null, 'extinguir', alvo.id, chave), 750);
      }
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
    }
  },

  /* Modo demonstração (Forja): transita o estado sem tocar a API */
  _demoTransicao(acao, chave) {
    const proximo = {
      iniciar: 'ATIVA', retomar: 'ATIVA', pausar: 'PAUSADA',
      cancelar: 'CANCELADA', concluir: 'CONCLUIDA',
    }[acao];
    const m = this._cache?.[chave];
    if (!m || !proximo) return;
    m.status_hoje = proximo;
    const card = document.querySelector(`[data-mc-card="${chave}"]`);
    if (card) {
      // Repinta preservando a variante: sem isto, um cartão do extrato
      // voltaria em tamanho cheio no meio da faixa fina.
      const compacto = card.classList.contains('mc-compacto');
      card.outerHTML = this.html(m, { compacto });
      if (acao === 'concluir' && typeof createSparks === 'function') {
        const novo = document.querySelector(`[data-mc-card="${chave}"]`);
        const r = novo?.getBoundingClientRect();
        if (r) createSparks(r.right - 80, r.top + r.height / 2, 12);
        if (typeof SFX !== 'undefined') SFX.play('carimbo');
      }
    }
  },
};

window.MissaoCard = MissaoCard;
