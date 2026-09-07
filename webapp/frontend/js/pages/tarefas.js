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
  // `null` = TUDO. A aba abre no livro inteiro; a data e recorte.
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

    /* A ABA ABRE MOSTRANDO O QUE EXISTE.

       Ela abria em HOJE e pedia `?data=<hoje>` — e o backend filtra por
       dia exato. Resultado medido na conta do Arquiteto: 35 missões
       gerais no banco, ZERO na tela, porque nenhuma era de hoje. As
       concluídas de agosto, as canceladas de setembro, todas invisíveis.

       Pior: uma missão criada hoje aparecia hoje e sumia amanhã. O
       Arquiteto deduziu isso sozinho antes de eu confirmar.

       É a MESMA lição que o Extrato já tinha aprendido, e que não foi
       aplicada aqui — o comentário está em `dashboard.carregarExtrato`:
       "um livro-caixa abre mostrando o que existe. Abrir em 'hoje'
       escondia todo o histórico logo no momento em que ele passou a
       existir."

       `null` = tudo. A data continua existindo como RECORTE. */
    const inputData = document.getElementById('filter-data-tarefa');
    if (inputData && !inputData._tarefaChangeAdded) {
      inputData.value = this._dataAtual || '';
      inputData.addEventListener('change', (e) => {
        // Campo limpo volta para tudo — é o caminho de volta sem botão.
        this._dataAtual = e.target.value || null;
        this.carregarPorData(this._dataAtual);
      });
      inputData._tarefaChangeAdded = true;
    } else if (inputData) {
      inputData.value = this._dataAtual || '';
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
    /* UMA VERDADE SO. Este metodo recebia a data e NAO gravava
       `_dataAtual` — e e `_dataAtual` que o render consulta para decidir
       entre a vista de dia e o livro. Chamado direto (o `onMudou` do
       cartao faz isso), os dois discordavam: pedia um dia ao servidor e
       desenhava como se fosse tudo. */
    this._dataAtual = data || null;
    this.destruir();
    const cont = document.getElementById('lista-tarefas');
    if (!cont) return;
    
    const htmlAtual = cont.innerHTML.trim();
    const silencioso = htmlAtual.length > 0 && !htmlAtual.includes('loading-spinner') && !htmlAtual.includes('empty-state');
    if (!silencioso) {
      cont.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';
    }

    try {
      // Sem data = tudo. Com data = aquele dia.
      const lista = await API.get(data ? `/tarefas/?data=${data}` : '/tarefas/');
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
          <div>${this._dataAtual ? `Nenhuma missão geral para ${this._rotuloDia()}`
                                 : 'Nenhuma missão geral ainda'}</div>
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

    // Cache indexado por uid ("g"+id). merge:true porque o Dashboard pode ter
    // cacheado o extrato antes — os dois espaços de chave convivem.
    MissaoCard.cachear(missoes, { modo: 'missao', merge: true });

    // mc-lista: o cartão mede ESTA coluna, não a janela (missao-card.css).
    cont.classList.add('mc-lista');

    /* DUAS VISTAS, E ELAS NÃO SÃO A MESMA COISA.

       UM DIA é uma vista de trabalho: o que está em aberto sobe, o que
       terminou desce para "Encerradas".

       TUDO é um livro: agrupado por dia, do mais recente para trás.
       Separar aberto de encerrado aqui misturaria uma missão de agosto
       com a de ontem no mesmo bloco, e a linha do tempo — que é a
       informação desta vista — se perderia. */
    let html = this._avisoDia() + '<div style="display:flex;flex-direction:column;gap:.9rem">';

    if (this._dataAtual) {
      const ativas = visiveis.filter(m => !this._FINAIS.includes(m.status));
      const finais = visiveis.filter(m =>  this._FINAIS.includes(m.status));
      html += ativas.map(m => MissaoCard.html(m, { modo: 'missao' })).join('');
      if (finais.length) {
        html += `<div class="tf-sep">Encerradas (${finais.length})</div>`;
        html += finais.map(m => MissaoCard.html(m, { modo: 'missao' })).join('');
      }
    } else {
      const porDia = new Map();
      visiveis.forEach(m => {
        const d = String(m.data || '').slice(0, 10) || 'sem-data';
        if (!porDia.has(d)) porDia.set(d, []);
        porDia.get(d).push(m);
      });
      // O backend já devolve em ordem decrescente; ordenar de novo aqui
      // é o que garante a ordem mesmo se alguém mexer no `order_by`.
      const dias = [...porDia.keys()].sort((a, b) =>
        a === 'sem-data' ? 1 : b === 'sem-data' ? -1 : b.localeCompare(a));
      html += dias.map(d => {
        const itens = porDia.get(d);
        const abertas = itens.filter(m => !this._FINAIS.includes(m.status)).length;
        return `<section>
          <div class="tf-dia">
            <span class="tf-dia-rot">${this._rotuloData(d)}</span>
            <span class="tf-dia-cont">${itens.length} miss${itens.length > 1 ? 'ões' : 'ão'}${abertas ? ` · ${abertas} em aberto` : ''}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:.9rem">
            ${itens.map(m => MissaoCard.html(m, { modo: 'missao' })).join('')}
          </div>
        </section>`;
      }).join('');
    }
    html += '</div>';
    cont.innerHTML = html;

    document.getElementById('btn-tarefas-hoje')
      ?.addEventListener('click', () => this._irParaHoje());
    document.getElementById('btn-tarefas-tudo')
      ?.addEventListener('click', () => this._verTudo());

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
  /* Cabeçalho humano do dia, no agrupamento. "2026-09-06" não diz nada;
     "Ontem" e "Sábado, 06/09" dizem. Espelha `dashboard._rotuloDia` — e a
     data ISO é quebrada à mão porque `new Date("2026-09-06")` seria lida
     como UTC e voltaria um dia no fuso de Brasília. */
  _rotuloData(iso) {
    if (!iso || iso === 'sem-data') return 'Sem data';
    const [a, m, d] = iso.split('-').map(Number);
    if (!a || !m || !d) return iso;
    const dt = new Date(a, m - 1, d);
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dif = Math.round((dt - hoje) / 86400000);
    if (dif === 0)  return 'Hoje';
    if (dif === -1) return 'Ontem';
    if (dif === 1)  return 'Amanhã';
    const semana = dt.toLocaleDateString('pt-BR', { weekday: 'long' }).replace('-feira', '');
    return `${semana}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
  },

  _avisoDia() {
    /* Vendo tudo: uma linha discreta com o atalho para o dia. Não é o
       aviso de "somente leitura" — aqui a leitura é o ponto. */
    if (!this._dataAtual) {
      return `
        <div class="tf-faixa">
          <span>Todas as suas missões gerais, das mais recentes para trás.
            As de dias passados são somente leitura.</span>
          <button id="btn-tarefas-hoje" class="tf-faixa-btn">Ver só hoje</button>
        </div>`;
    }
    if (this._dataAtual === this._hojeISO()) {
      return `
        <div class="tf-faixa">
          <span>Vendo <strong>hoje</strong>.</span>
          <button id="btn-tarefas-tudo" class="tf-faixa-btn">Ver todas</button>
        </div>`;
    }
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
        <button id="btn-tarefas-tudo" class="tf-faixa-btn">Ver todas</button>
      </div>`;
  },

  _irParaHoje() {
    this._dataAtual = this._hojeISO();
    const inputData = document.getElementById('filter-data-tarefa');
    if (inputData) inputData.value = this._dataAtual;
    this.carregarPorData(this._dataAtual);
  },

  /* O caminho de volta para o livro inteiro. Limpar o campo de data faz
     o mesmo, mas ninguem descobre que limpar um `input[type=date]` e uma
     acao — o botao e o que torna a saida visivel. */
  _verTudo() {
    this._dataAtual = null;
    const inputData = document.getElementById('filter-data-tarefa');
    if (inputData) inputData.value = '';
    this.carregarPorData(null);
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
        aoSalvar: (salvo) => {
          if (salvo && salvo.data_prevista) {
            this._dataAtual = String(salvo.data_prevista).slice(0, 10);
            const inputData = document.getElementById('filter-data-tarefa');
            if (inputData) inputData.value = this._dataAtual;
          }
          this.carregar?.();
        },
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
