/* ============================================================
   tarefas.js — Solo Routines · MISSÕES GERAIS (avulsas)

   Ciclo de vida: PENDENTE → ATIVA | PAUSADA → CONCLUIDA | CANCELADA | FRACASSADA

   A página não desenha mais cartão nenhum: quem desenha é o MissaoCard, o
   mesmo componente do Dashboard e do Extrato. Enquanto esta tela tinha HTML
   próprio, cada guia do app envelhecia num ritmo diferente — era essa a
   origem da falta de padrão visual.

   Aqui sobra o que é de fato da página: escolher o dia, ordenar, agrupar,
   abrir o formulário e confirmar exclusões. Iniciar/pausar/concluir/cancelar
   o cartão resolve sozinho contra /tarefas/{id}/...
   ============================================================ */

const Tarefas = {
  _dataAtual:   null,
  _lista:       [],       // tarefas CRUAS de /tarefas/ — é o que o formulário espera
  _ordem:       'PRIORIDADE',
  _isArquiteto: false,

  _PRIOR_ORDER: { CRITICA: 0, ALTA: 1, MEDIA: 2, BAIXA: 3 },
  // Um dia encerrado não volta atrás: estes três saem do bloco "em curso".
  _FINAIS: ['CONCLUIDA', 'CANCELADA', 'FRACASSADA'],

  // ── Inicialização ─────────────────────────────────────────
  async carregar() {
    const u = typeof Auth !== 'undefined' ? Auth.getUsuario() : null;
    this._isArquiteto = u?.nivel_acesso === 'Arquiteto';
    this._ordem = localStorage.getItem('sr_tarefas_ordem') || 'PRIORIDADE';

    this._dataAtual = this._hojeISO();

    const inputData = document.getElementById('filter-data-tarefa');
    if (inputData && !inputData._tarefaChangeAdded) {
      inputData.value = this._dataAtual;
      inputData.addEventListener('change', (e) => {
        this._dataAtual = e.target.value;
        this.carregarPorData(this._dataAtual);
      });
      inputData._tarefaChangeAdded = true;
    } else if (inputData) {
      inputData.value = this._dataAtual;
    }

    await this.carregarPorData(this._dataAtual);
    this._bindBotaoNova();
    this._bindOrdenacao();
  },

  /* Esta página não abre intervalo próprio — o único contador em tela é o
     timer global do MissaoCard. Encerrá-lo ao sair evita que ele siga girando
     sobre cartões que já não estão à vista. */
  destruir() {
    if (typeof MissaoCard !== 'undefined' && MissaoCard.pararTimer) MissaoCard.pararTimer();
  },

  // ── Carrega o dia ─────────────────────────────────────────
  async carregarPorData(data) {
    this.destruir();
    const cont = document.getElementById('lista-tarefas');
    if (!cont) return;
    cont.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';

    try {
      const lista = await API.get(`/tarefas/?data=${data}`);
      this._lista = lista || [];
      this.renderLista(this._ordenarLista(this._lista));
    } catch (err) {
      console.error('[Tarefas]', err);
      cont.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div>'
        + '<div>O Sistema não respondeu — ' + (err.message || '') + '</div></div>';
    }
  },

  /* ── Adaptação: tarefa crua → missão canônica ──────────────
     /tarefas/ é anterior ao contrato do Extrato e devolve outro dicionário:
     "data_prevista" em vez de "data", "hora_limite" em vez de "hora_fim", e
     ainda usa o status antigo ATRASADA. O MissaoCard fala só o vocabulário
     canônico, então a tradução acontece aqui, num lugar só — em vez de o
     card ganhar um "se vier da tela de tarefas...".

     "uid" e "origem" não são enfeite: é por eles que o card decide mandar a
     ação para /tarefas/{id} em vez de /rotinas/{id}, e é o "g" do uid que
     impede a colisão com uma ocorrência de rotina de mesmo id numérico. */
  _paraMissao(t) {
    const status = (t.status === 'ATRASADA') ? 'FRACASSADA' : (t.status || 'PENDENTE');
    const dia = String(t.data_prevista || '').slice(0, 10);
    return {
      ...t,
      uid:       'g' + t.id,
      origem:    'geral',
      rotina_id: null,          // missão geral não nasce de regra nenhuma
      data:      dia,
      hora_fim:  t.hora_limite || null,
      status,
      // Só o dia corrente aceita ação: concluir ontem retroativamente não
      // existe no backend, e um cartão clicável do passado só mente.
      editavel:  dia === this._hojeISO(),
    };
  },

  // ── Render ────────────────────────────────────────────────
  renderLista(lista) {
    const cont = document.getElementById('lista-tarefas');
    if (!cont) return;

    const ocultar = localStorage.getItem('sr_ocultar_concluidas_tarefas') === 'true';
    const toggleEl = document.getElementById('toggle-ocultar-tarefas');
    if (toggleEl) toggleEl.checked = ocultar;

    const missoes = lista.map(t => this._paraMissao(t));
    const visiveis = ocultar ? missoes.filter(m => !this._FINAIS.includes(m.status)) : missoes;

    if (!visiveis.length) {
      cont.innerHTML = this._avisoDia() + `
        <div class="empty-state">
          <div class="empty-icon">⚔️</div>
          <div>Nenhuma missão geral para ${this._rotuloDia()}</div>
          <div style="font-size:.78rem;color:var(--text-muted);max-width:32rem;margin:.4rem auto .9rem;line-height:1.5">
            Missão geral é a que não se repete — o compromisso de uma vez só.
            O que volta toda semana é rotina, e mora na guia Rotinas.
          </div>
          <button class="btn btn-primary btn-sm" id="btn-nova-tarefa-empty">+ Adicionar Missão</button>
        </div>`;
      document.getElementById('btn-nova-tarefa-empty')
        ?.addEventListener('click', () => this.abrirFormulario());
      return;
    }

    const ativas = visiveis.filter(m => !this._FINAIS.includes(m.status));
    const finais = visiveis.filter(m =>  this._FINAIS.includes(m.status));

    // Cache indexado por uid ("g"+id). merge:true porque o Dashboard pode ter
    // cacheado o extrato antes — os dois espaços de chave convivem.
    MissaoCard.cachear(missoes, { modo: 'missao', merge: true });

    let html = this._avisoDia() + '<div style="display:flex;flex-direction:column;gap:.9rem">';
    html += ativas.map(m => MissaoCard.html(m, { modo: 'missao' })).join('');
    if (finais.length) {
      html += `
        <div style="font-family:var(--font-section);font-size:.72rem;color:var(--text-muted);
          letter-spacing:1.5px;text-transform:uppercase;margin-top:.5rem;padding-top:.5rem;
          border-top:1px solid rgba(255,255,255,.06)">
          Encerradas (${finais.length})
        </div>`;
      html += finais.map(m => MissaoCard.html(m, { modo: 'missao' })).join('');
    }
    html += '</div>';
    cont.innerHTML = html;

    document.getElementById('btn-tarefas-hoje')
      ?.addEventListener('click', () => this._irParaHoje());

    MissaoCard.montar(cont, {
      onMudou: () => this.carregarPorData(this._dataAtual),
      // idAlvo já vem roteado pelo card: com origem 'geral' é o id da tarefa.
      onAcao: (acao, idAlvo, m) => {
        const alvo = this._lista.find(t => t.id === idAlvo) || m;
        if (acao === 'editar')  this.abrirFormulario(alvo);
        if (acao === 'excluir') this.confirmarExcluir(alvo);
      },
    });
  },

  /* Fora do dia corrente todo cartão vem selado (editavel:false), e sem um
     aviso isso parece defeito. A faixa explica e devolve o caminho de volta. */
  _avisoDia() {
    if (this._dataAtual === this._hojeISO()) return '';
    return `
      <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;
        margin-bottom:1rem;padding:.6rem .9rem;border-radius:.6rem;
        border:1px solid rgba(100,116,139,.28);background:rgba(100,116,139,.08)">
        <span style="font-size:.78rem;color:var(--text-muted);line-height:1.5;flex:1;min-width:14rem">
          Você está vendo <strong>${this._rotuloDia()}</strong>. Fora do dia corrente
          as missões são somente leitura — o Sistema não aceita ação retroativa.
        </span>
        <button id="btn-tarefas-hoje" style="
          font-family:var(--font-section);font-size:.7rem;font-weight:700;letter-spacing:.06em;
          padding:.35rem .8rem;border-radius:.45rem;cursor:pointer;white-space:nowrap;
          border:1px solid rgba(168,85,247,.45);background:rgba(124,58,237,.18);
          color:#e9d5ff;transition:all .2s">
          Voltar para hoje
        </button>
      </div>`;
  },

  _irParaHoje() {
    this._dataAtual = this._hojeISO();
    const inputData = document.getElementById('filter-data-tarefa');
    if (inputData) inputData.value = this._dataAtual;
    this.carregarPorData(this._dataAtual);
  },

  _rotuloDia() {
    return this._dataAtual === this._hojeISO() ? 'hoje' : this._fmtDateDisplay(this._dataAtual);
  },

  // ── Ordenação ─────────────────────────────────────────────
  // Opera sobre a tarefa crua, mas usando o status já normalizado — senão
  // uma ATRASADA ficaria misturada com as que ainda estão em curso.
  _ordenarLista(lista) {
    const st = t => (t.status === 'ATRASADA' ? 'FRACASSADA' : (t.status || 'PENDENTE'));
    return [...lista].sort((a, b) => {
      const aC = this._FINAIS.includes(st(a)) ? 1 : 0;
      const bC = this._FINAIS.includes(st(b)) ? 1 : 0;
      if (aC !== bC) return aC - bC;
      if (this._ordem === 'PRIORIDADE')
        return (this._PRIOR_ORDER[a.prioridade] ?? 2) - (this._PRIOR_ORDER[b.prioridade] ?? 2);
      if (this._ordem === 'STATUS')
        return st(a).localeCompare(st(b));
      if (this._ordem === 'DATA')
        return String(a.data_prevista || '').localeCompare(String(b.data_prevista || ''));
      return 0;
    });
  },

  // ── Formulário ────────────────────────────────────────────
  abrirFormulario(tarefa) {
    // A Forja substituiu o lançador antigo (mesma troca da página Rotinas).
    if (typeof ForjaMissao !== 'undefined') {
      ForjaMissao.abrir({
        tipo: 'TAREFA',
        edicao: tarefa || null,
        aoSalvar: () => this.carregar?.(),
      });
    }
  },

  // ── Exclusão (o card delega; a página confirma) ────────────
  async confirmarExcluir(t) {
    if (!t) return;
    // SoloDialog é const de topo, não propriedade de window. Sem ele o
    // fallback é NÃO excluir — apagar por engano aqui não tem volta.
    const ok = (typeof SoloDialog !== 'undefined')
      ? await SoloDialog.confirm(
          `Excluir a missão "<strong>${t.titulo}</strong>"?<br>`
          + `<span style="color:#94a3b8">Esta ação é irreversível.</span>`,
          { titulo: 'Excluir Missão', icon: '🗑️', tipo: 'error', btnOk: 'Excluir', btnCancel: 'Cancelar' }
        )
      : false;
    if (!ok) return;
    try {
      await API.delete(`/tarefas/${t.id}`);
      this._lista = this._lista.filter(x => x.id !== t.id);
      this.renderLista(this._ordenarLista(this._lista));
      if (typeof SoloDialog !== 'undefined') SoloDialog.toast('Missão excluída.', 'success');
    } catch (err) {
      console.error('[Tarefas] Erro ao excluir:', err);
      if (typeof SoloDialog !== 'undefined')
        SoloDialog.toast('Erro ao excluir: ' + (err.message || err), 'error');
    }
  },

  // ── Barra superior ────────────────────────────────────────
  _bindBotaoNova() {
    ['btn-nova-tarefa', 'btn-add-tarefa'].forEach(id => {
      const btn = document.getElementById(id);
      if (!btn || btn._tarefaNovaBound) return;
      btn._tarefaNovaBound = true;
      btn.addEventListener('click', () => this.abrirFormulario());
    });
  },

  _bindOrdenacao() {
    const btns = document.querySelectorAll('[data-ordem-tarefa]');
    btns.forEach(btn => {
      btn.style.background = this._ordem === btn.dataset.ordemTarefa
        ? 'rgba(124,58,237,.25)' : 'rgba(124,58,237,.08)';
      if (btn._ordemBound) return;
      btn._ordemBound = true;
      btn.addEventListener('click', () => {
        this._ordem = btn.dataset.ordemTarefa;
        try { localStorage.setItem('sr_tarefas_ordem', this._ordem); } catch (_) {}
        btns.forEach(b => { b.style.background = 'rgba(124,58,237,.08)'; });
        btn.style.background = 'rgba(124,58,237,.25)';
        this.renderLista(this._ordenarLista(this._lista));
      });
    });

    const toggleOcultar = document.getElementById('toggle-ocultar-tarefas');
    if (toggleOcultar && !toggleOcultar._tarefasListenerAdded) {
      toggleOcultar.checked = localStorage.getItem('sr_ocultar_concluidas_tarefas') === 'true';
      toggleOcultar.addEventListener('change', () => {
        try { localStorage.setItem('sr_ocultar_concluidas_tarefas', toggleOcultar.checked); } catch (_) {}
        this.renderLista(this._ordenarLista(this._lista));
      });
      toggleOcultar._tarefasListenerAdded = true;
    }
  },

  // ── Helpers de data ───────────────────────────────────────
  /* new Date("2026-07-24") é lido como UTC e, a oeste de Greenwich, volta um
     dia. Por isso a data de hoje é montada a partir dos componentes locais. */
  _hojeISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },
  _fmtDateDisplay(str) {
    if (!str) return '';
    const p = String(str).split('T')[0].split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(str);
  },
};

// Mesma ponte explícita das Rotinas: o Extrato roteia para cá as missões de
// origem "geral". Não depender de escopo léxico entre <script> soltos.
window.Tarefas = Tarefas;
