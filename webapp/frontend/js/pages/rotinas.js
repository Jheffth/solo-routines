/* ============================================================
   rotinas.js — Solo Routines · PAINEL DE AGENDAMENTO

   Esta guia cuida da REGRA, não da execução.

     ROTINA  = a regra      "carregar Dolphin toda terça"   → aqui
     MISSÃO  = a ocorrência "carregar Dolphin em 14/07"     → Dashboard/Extrato

   Por isso nada aqui inicia, pausa ou conclui nada: a lista é desenhada com
   MissaoCard no modo 'agenda', que só oferece suspender/reativar/editar/
   excluir. Quem executa o dia é o Dashboard, onde a ocorrência vive.

   O fechamento do dia (PENDENTE vencido → FRACASSADA) passou a ser do job
   noturno do backend (motors/fechamento.py). O cliente NÃO chama mais
   /rotinas/{id}/fracassar — se os dois fizessem isso, a penalidade de XP
   seria cobrada duas vezes.
   ============================================================ */

const Rotinas = {
  _tipoAtivo:   'DIARIA',
  _lista:       [],
  _ordem:       'PRIORIDADE',
  _isArquiteto: false,

  // Ordem de urgência — usada quando o hunter ordena "por prioridade"
  _PRIOR_ORDER: { CRITICA: 0, ALTA: 1, MEDIA: 2, BAIXA: 3 },
  _TIPO_ORDER:  { DIARIA: 0, SEMANAL: 1, MENSAL: 2, ANUAL: 3, AVULSA: 4 },

  // ── Inicialização ──────────────────────────────────────────
  async carregar() {
    const u = typeof Auth !== 'undefined' ? Auth.getUsuario() : null;
    this._isArquiteto = u?.nivel_acesso === 'Arquiteto';
    this._carregarOrdem();
    await this.carregarPorTipo(this._tipoAtivo);
    this._bindTabs();
    this._bindBotaoNova();
    this._bindOrdenacao();
  },

  // ── Preferência de ordenação ───────────────────────────────
  _carregarOrdem() {
    this._ordem = localStorage.getItem('sr_rotinas_ordem') || 'PRIORIDADE';
  },
  _salvarOrdem(o) {
    this._ordem = o;
    try { localStorage.setItem('sr_rotinas_ordem', o); } catch (_) {}
  },

  /* Chamado por App.navigate ao sair da guia. Esta página não abre nenhum
     intervalo próprio (regra não tem prazo, logo não tem contador), mas o
     MissaoCard mantém um timer global compartilhado — encerrá-lo aqui evita
     que ele fique girando sobre cartões que já saíram de vista. */
  destruir() {
    if (typeof MissaoCard !== 'undefined' && MissaoCard.pararTimer) MissaoCard.pararTimer();
  },

  // ── Carrega as regras de um tipo ───────────────────────────
  async carregarPorTipo(tipo) {
    this._tipoAtivo = tipo;
    this.destruir();
    const cont = document.getElementById('lista-rotinas');
    if (!cont) return;
    cont.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';

    try {
      const lista = await API.get(`/rotinas/?tipo=${tipo}`);
      this._lista = lista || [];
      this.renderLista(this._ordenarLista(this._lista));
    } catch (err) {
      console.error('[Rotinas]', err);
      cont.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div>'
        + '<div>O Sistema não respondeu — ' + (err.message || '') + '</div></div>';
    }
  },

  // ── Render da lista (MissaoCard em modo agenda) ────────────
  renderLista(lista) {
    const cont = document.getElementById('lista-rotinas');
    if (!cont) return;

    if (!lista.length) {
      cont.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">&#128260;</div>
          <div>Nenhuma regra ${this._rotuloTipo()} registrada</div>
          <div style="font-size:.78rem;color:var(--text-muted);max-width:34rem;margin:.4rem auto .9rem;line-height:1.5">
            Uma rotina é a regra que gera missões todo dia devido.
            Registre a regra aqui; cumpri-la é assunto do Dashboard.
          </div>
          <button class="btn btn-primary btn-sm" id="btn-nova-rotina-empty">+ Criar primeira rotina</button>
        </div>`;
      document.getElementById('btn-nova-rotina-empty')
        ?.addEventListener('click', () => this.abrirFormulario());
      return;
    }

    // O modo 'agenda' indexa o cache por "a"+id — espaço de chaves separado do
    // extrato, então merge:true não atropela o que o Dashboard já cacheou.
    MissaoCard.cachear(lista, { modo: 'agenda', merge: true });

    // mc-lista: o cartão mede ESTA coluna, não a janela (missao-card.css).
    cont.classList.add('mc-lista');
    cont.innerHTML = this._notaDePapel()
      + '<div style="display:flex;flex-direction:column;gap:.9rem">'
      + lista.map(r => MissaoCard.html(r, { modo: 'agenda' })).join('')
      + '</div>';

    document.getElementById('btn-rotinas-ir-dash')
      ?.addEventListener('click', () => { if (typeof App !== 'undefined') App.navigate('dashboard'); });

    MissaoCard.montar(cont, {
      onMudou: (resp, acao) => this._aposMudanca(acao),
      // idAlvo já vem roteado pelo card: no modo agenda é o id da REGRA.
      onAcao: (acao, idAlvo, r) => {
        const alvo = this._lista.find(x => x.id === idAlvo) || r;
        if (acao === 'editar')  this.abrirFormulario(alvo);
        if (acao === 'excluir') this.confirmarExcluir(alvo);
      },
    });
  },

  /* Faixa de contexto: sem ela o hunter abre a guia procurando o botão
     "Concluir" que agora mora no Dashboard, e conclui que algo quebrou. */
  _notaDePapel() {
    return `
      <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;
        margin-bottom:1rem;padding:.6rem .9rem;border-radius:.6rem;
        border:1px solid rgba(124,58,237,.22);background:rgba(124,58,237,.07)">
        <span style="font-size:.78rem;color:var(--text-muted);line-height:1.5;flex:1;min-width:14rem">
          Aqui você define <strong style="color:var(--purple-glow)">a regra</strong>:
          com que frequência ela ocorre e o que vale. Iniciar e concluir a missão do dia
          acontece no Dashboard.
        </span>
        <button id="btn-rotinas-ir-dash" style="
          font-family:var(--font-section);font-size:.7rem;font-weight:700;letter-spacing:.06em;
          padding:.35rem .8rem;border-radius:.45rem;cursor:pointer;white-space:nowrap;
          border:1px solid rgba(168,85,247,.45);background:rgba(124,58,237,.18);
          color:#e9d5ff;transition:all .2s">
          Ver missões de hoje →
        </button>
      </div>`;
  },

  _rotuloTipo() {
    return ({ DIARIA: 'diária', SEMANAL: 'semanal', MENSAL: 'mensal', ANUAL: 'anual' })[this._tipoAtivo]
      || String(this._tipoAtivo).toLowerCase();
  },

  /* Suspender/reativar o card já resolve sozinho: ele chama a API, muda o
     campo "ativo" no objeto cacheado — que é o MESMO objeto desta lista — e
     repinta só o próprio cartão. Refazer o GET aqui faria a lista inteira
     piscar à toa. A exceção é a ordenação POR STATUS, em que o cartão
     acabou de mudar de lugar. Extinguir e o resto pedem dados frescos. */
  _aposMudanca(acao) {
    if (acao === 'suspender' || acao === 'reativar') {
      if (this._ordem === 'STATUS' || this._ordem === 'PRIORIDADE')
        this.renderLista(this._ordenarLista(this._lista));
      return;
    }
    this.carregarPorTipo(this._tipoAtivo);
  },

  // ── Exclusão da regra (o card delega, a página confirma) ───
  async confirmarExcluir(item) {
    if (!item) return;
    // SoloDialog é const de topo (não vira propriedade de window). Sem ele,
    // o fallback é NÃO excluir: apagar uma regra por engano é irreversível.
    const ok = (typeof SoloDialog !== 'undefined')
      ? await SoloDialog.confirm(
          `Excluir a rotina "<strong>${item.titulo}</strong>"?<br><br>`
          + `<span style="color:#94a3b8">Ela deixa de gerar missões. `
          + `O histórico já registrado permanece no Extrato.</span>`,
          { titulo: 'Excluir Rotina', icon: '🗑️', tipo: 'error', btnOk: 'Excluir', btnCancel: 'Cancelar' }
        )
      : false;
    if (!ok) return;
    try {
      await API.delete(`/rotinas/${item.id}`);
      this._lista = this._lista.filter(r => r.id !== item.id);
      this.renderLista(this._ordenarLista(this._lista));
      if (typeof SoloDialog !== 'undefined') SoloDialog.toast('Rotina excluída.', 'success');
    } catch (err) {
      if (typeof SoloDialog !== 'undefined')
        SoloDialog.toast('Erro ao excluir: ' + (err.message || err), 'error');
    }
  },

  /* Ordenação da AGENDA: aqui não existe status de execução, então "por
     status" quer dizer ativa antes de suspensa, e "por data" é a data de
     criação da regra (a próxima ocorrência quem calcula é o cartão). */
  _ordenarLista(lista) {
    const s = [...lista];
    const prio = r => this._PRIOR_ORDER[r.prioridade] ?? 9;

    if (this._ordem === 'STATUS') {
      return s.sort((a, b) => {
        const at = (a.ativo === false ? 1 : 0), bt = (b.ativo === false ? 1 : 0);
        return at !== bt ? at - bt : prio(a) - prio(b);
      });
    }
    if (this._ordem === 'TIPO') {
      return s.sort((a, b) => {
        const ta = this._TIPO_ORDER[a.tipo] ?? 9, tb = this._TIPO_ORDER[b.tipo] ?? 9;
        return ta !== tb ? ta - tb : prio(a) - prio(b);
      });
    }
    if (this._ordem === 'DATA' || this._ordem === 'RECENTE')
      return s.sort((a, b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0));
    if (this._ordem === 'TITULO')
      return s.sort((a, b) => (a.titulo || '').localeCompare(b.titulo || ''));

    // Padrão: prioridade, com a regra suspensa caindo para o fim — ela não
    // gera missão nenhuma, então não disputa atenção com as que geram.
    return s.sort((a, b) => {
      const at = (a.ativo === false ? 1 : 0), bt = (b.ativo === false ? 1 : 0);
      return at !== bt ? at - bt : prio(a) - prio(b);
    });
  },

  // ── Abas de tipo ───────────────────────────────────────────
  _bindTabs() {
    const tabs = document.querySelectorAll('[data-tipo-rotina], .rotina-tab');
    tabs.forEach(tab => {
      if (tab._rotinaTabBound) return;
      tab._rotinaTabBound = true;
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const tipo = tab.dataset.tipoRotina || tab.dataset.tipo;
        if (tipo) this.carregarPorTipo(tipo);
      });
    });
  },

  _bindBotaoNova() {
    const btn = document.getElementById('btn-nova-rotina');
    if (!btn) return;
    // .btn-primary não existe globalmente no projeto — estilo inline mesmo
    Object.assign(btn.style, {
      fontFamily: 'var(--font-section)',
      fontSize: '.82rem',
      fontWeight: '700',
      letterSpacing: '.06em',
      padding: '.55rem 1.2rem',
      borderRadius: '8px',
      border: '1px solid rgba(168,85,247,.6)',
      background: 'linear-gradient(110deg,rgba(124,58,237,.5),rgba(168,85,247,.35))',
      color: '#e9d5ff',
      cursor: 'pointer',
      flexShrink: '0',
      whiteSpace: 'nowrap',
      transition: 'all .2s',
      boxShadow: '0 0 12px rgba(168,85,247,.2)',
    });
    btn.textContent = '+ Nova Rotina';
    btn.onmouseover = () => {
      btn.style.background = 'linear-gradient(110deg,rgba(124,58,237,.8),rgba(168,85,247,.6))';
      btn.style.boxShadow = '0 0 20px rgba(168,85,247,.4)';
    };
    btn.onmouseout = () => {
      btn.style.background = 'linear-gradient(110deg,rgba(124,58,237,.5),rgba(168,85,247,.35))';
      btn.style.boxShadow = '0 0 12px rgba(168,85,247,.2)';
    };
    if (!btn._rotinaBound) {
      btn._rotinaBound = true;
      btn.addEventListener('click', () => this.abrirFormulario());
    }
  },

  _bindOrdenacao() {
    const btns = document.querySelectorAll('[data-ordem]');
    btns.forEach(btn => {
      // Reflete a preferência salva no visual dos botões ao (re)entrar na guia
      btn.classList.toggle('active', btn.dataset.ordem === this._ordem);
      if (btn._ordemBound) return;
      btn._ordemBound = true;
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._salvarOrdem(btn.dataset.ordem);
        this.renderLista(this._ordenarLista(this._lista));
      });
    });
    // <select id="rotinas-ordem"> legado, se ainda existir em alguma tela
    const sel = document.getElementById('rotinas-ordem');
    if (sel && !sel._ordemBound) {
      sel._ordemBound = true;
      sel.value = this._ordem;
      sel.addEventListener('change', () => {
        this._salvarOrdem(sel.value);
        this.renderLista(this._ordenarLista(this._lista));
      });
    }
  },

  abrirFormulario(item = null) {
    // A Forja substituiu o lançador antigo. `edicao` recebe a rotina crua
    // que esta página já tem — a Forja distingue criar de reforjar sozinha.
    if (typeof ForjaMissao !== 'undefined') {
      ForjaMissao.abrir({
        tipo: 'ROTINA',
        edicao: item || null,
        aoSalvar: () => this.carregar?.(),
      });
    }
  },
};

// O Extrato do Dashboard delega editar/excluir de missões de origem "rotina"
// para cá. Hoje isso funciona por escopo léxico entre scripts clássicos —
// frágil demais para um contrato entre telas: se este arquivo virar módulo,
// o roteamento quebraria em silêncio. Tornar a ponte explícita custa 1 linha.
window.Rotinas = Rotinas;
