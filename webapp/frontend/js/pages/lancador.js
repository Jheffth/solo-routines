// ============================================================
// SOLO ROUTINES — Lançador de Missões v2
// Janela arrastável premium para criar rotinas e tarefas
// ============================================================

const Lancador = {
  _win:        null,
  _tipo:       'ROTINA',
  _prioridade: 'MEDIA',
  _dificuldade:'NORMAL',
  _categoria:  'Pessoal',
  _diasSemana: [],
  _freq:       'DIARIA',
  _editId:     null,   // id ao editar (null = novo)

  // ── Dados estáticos ───────────────────────────────────────
  CATEGORIAS: [
    { id: 'Saúde',    icon: '❤️',  label: 'Saúde',    cor: '#ef4444' },
    { id: 'Trabalho', icon: '💼',  label: 'Trabalho', cor: '#3b82f6' },
    { id: 'Estudo',   icon: '📚',  label: 'Estudo',   cor: '#8b5cf6' },
    { id: 'Casa',     icon: '🏠',  label: 'Casa',     cor: '#10b981' },
    { id: 'Pessoal',  icon: '⚡',  label: 'Pessoal',  cor: '#f59e0b' },
    { id: 'Combate',  icon: '⚔️',  label: 'Combate',  cor: '#ec4899' },
  ],

  DIAS: [
    { label: 'S', full: 'Segunda', idx: 0 },
    { label: 'T', full: 'Terça',   idx: 1 },
    { label: 'Q', full: 'Quarta',  idx: 2 },
    { label: 'Q', full: 'Quinta',  idx: 3 },
    { label: 'S', full: 'Sexta',   idx: 4 },
    { label: 'S', full: 'Sábado',  idx: 5 },
    { label: 'D', full: 'Domingo', idx: 6 },
  ],

  PRIORIDADES: [
    { id: 'CRITICA', label: 'Crítica', icon: '🔴', cor: '#ef4444', glow: 'rgba(239,68,68,.35)' },
    { id: 'ALTA',    label: 'Alta',    icon: '🟠', cor: '#f97316', glow: 'rgba(249,115,22,.3)'  },
    { id: 'MEDIA',   label: 'Média',   icon: '🟡', cor: '#f59e0b', glow: 'rgba(245,158,11,.3)'  },
    { id: 'BAIXA',   label: 'Baixa',   icon: '🟢', cor: '#10b981', glow: 'rgba(16,185,129,.3)'  },
  ],

  DIFICULDADES: [
    { id: 'FACIL',    label: 'Fácil',    icon: '☁️',  xpMult: 0.5,  desc: 'Sem desafio'      },
    { id: 'NORMAL',   label: 'Normal',   icon: '⚡',  xpMult: 1.0,  desc: 'Padrão'           },
    { id: 'DIFICIL',  label: 'Difícil',  icon: '🔥',  xpMult: 1.5,  desc: 'Desafiador'       },
    { id: 'LENDARIO', label: 'Lendário', icon: '💀',  xpMult: 2.5,  desc: 'Quase impossível' },
  ],

  XP_BASE:  { DIARIA: 50, SEMANAL: 200, MENSAL: 500, ANUAL: 2000 },
  MC_BASE:  { DIARIA: 5,  SEMANAL: 25,  MENSAL: 60,  ANUAL: 250  },
  XP_PRIOR: { CRITICA: 1.5, ALTA: 1.2, MEDIA: 1.0, BAIXA: 0.7   },
  PENAL_PRIOR: { CRITICA: 0.5, ALTA: 0.3, MEDIA: 0.15, BAIXA: 0.0 },
  XP_DIFIC: { FACIL: 0.5, NORMAL: 1.0, DIFICIL: 1.5, LENDARIO: 2.5 },

  // ── Inicialização ─────────────────────────────────────────
  init() {
    const el = document.getElementById('lancador-window');
    if (!el) { console.warn('[Lancador] #lancador-window não encontrado'); return; }

    // 1. Constrói o formulário PRIMEIRO (para que .window-header exista)
    this._buildForm(el);

    // 2. Cria DragWindow com o header já no DOM
    this._win = new DragWindow(el, {
      backdropId: 'window-backdrop',
      onClose:    () => this._reset(),
    });

    // 3. Vincula eventos globais (delegação no document)
    this._bindGlobal();
    window.Lancador = this;
    console.log('[Lancador] inicializado com sucesso');
  },

  // ── Abre o modal ──────────────────────────────────────────
  abrir(tipo = 'ROTINA', dadosEdicao = null) {
    if (!this._win) this.init();
    this._reset();

    if (tipo === 'TAREFA') this._setTipo('TAREFA');
    else                   this._setTipo('ROTINA');

    if (dadosEdicao) this._preencherEdicao(dadosEdicao);

    // Garante visibilidade diretamente (fallback)
    const el = document.getElementById('lancador-window');
    if (el) {
      el.style.display = 'flex';
      el.classList.add('visible');
    }
    // Mostra backdrop
    const bd = document.getElementById('window-backdrop');
    if (bd) bd.classList.add('visible');

    this._win?.open();
    requestAnimationFrame(() => {
      this._win?.center();
      document.getElementById('lanc-titulo')?.focus();
    });
    console.log('[Lancador] aberto, tipo:', tipo);
  },


  fechar() {
    const el = document.getElementById('lancador-window');
    if (!el) return;

    // Esconde imediatamente — sem depender do timeout do DragWindow
    el.classList.remove('visible');
    el.style.display = 'none';

    // Remove o backdrop
    const bd = document.getElementById('window-backdrop');
    if (bd) bd.classList.remove('visible');

    // Notifica o DragWindow sem acionar o close() (que tem o setTimeout)
    if (this._win) {
      this._win.el.classList.remove('visible', 'closing');
    }

    this._reset();
  },


  // ── Constrói o HTML do formulário ─────────────────────────
  _buildForm(el) {
    el.innerHTML = `
      <div class="lanc-header window-header">
        <div class="lanc-header-left">
          <div class="lanc-header-icon">⚔️</div>
          <div>
            <div class="lanc-header-title" id="lanc-header-title">Nova Missão</div>
            <div class="lanc-header-sub">Sistema de Missões Solo Routines</div>
          </div>
        </div>
        <button class="window-close-btn" id="lanc-close" title="Fechar">✕</button>
      </div>

      <div class="lanc-body">

        <!-- TIPO TOGGLE -->
        <div class="lanc-tipo-toggle">
          <button class="lanc-tipo-btn active" data-tipo="ROTINA" id="lanc-btn-rotina">
            <span>🔄</span> Rotina Recorrente
          </button>
          <button class="lanc-tipo-btn" data-tipo="TAREFA" id="lanc-btn-tarefa">
            <span>📋</span> Tarefa Avulsa
          </button>
        </div>

        <!-- TÍTULO -->
        <div class="lanc-field">
          <label class="lanc-label">⚔️ Título da Missão <span class="req">*</span></label>
          <input type="text" class="lanc-input" id="lanc-titulo"
            placeholder="Descreva sua missão..." autocomplete="off" maxlength="120">
        </div>

        <!-- FREQUÊNCIA (apenas Rotina) -->
        <div id="lanc-sec-freq" class="lanc-section">
          <label class="lanc-label">📅 Frequência</label>
          <div class="lanc-freq-grid" id="lanc-freq-grid">
            ${['DIARIA','SEMANAL','MENSAL','ANUAL'].map(f => `
              <button class="lanc-freq-btn${f==='DIARIA'?' active':''}" data-freq="${f}">
                ${{ DIARIA:'☀️', SEMANAL:'📆', MENSAL:'🗓️', ANUAL:'🏆' }[f]}
                <span>${{ DIARIA:'Diária', SEMANAL:'Semanal', MENSAL:'Mensal', ANUAL:'Anual' }[f]}</span>
              </button>`).join('')}
          </div>

          <!-- Dias da semana (semanal) -->
          <div id="lanc-sec-dias" class="lanc-dias-wrap hidden">
            <label class="lanc-label" style="margin-bottom:.5rem">Dias da Semana</label>
            <div class="lanc-dias-grid" id="lanc-dias-grid">
              ${this.DIAS.map(d => `
                <button class="lanc-dia-btn" data-idx="${d.idx}" title="${d.full}">${d.label}</button>
              `).join('')}
            </div>
          </div>

          <!-- Dia do mês (mensal) -->
          <div id="lanc-sec-dia-mes" class="hidden" style="margin-top:.75rem">
            <label class="lanc-label">Dia do mês</label>
            <input type="number" class="lanc-input" id="lanc-dia-mes"
              min="1" max="31" placeholder="1 a 31" style="max-width:110px">
          </div>

          <!-- Data anual (anual) -->
          <div id="lanc-sec-anual" class="hidden" style="margin-top:.75rem">
            <label class="lanc-label">Data anual</label>
            <input type="date" class="lanc-input" id="lanc-data-anual" style="max-width:180px">
          </div>
        </div>

        <!-- ⏰ JANELA DE HORÁRIO (opcional, apenas Rotina) -->
        <div id="lanc-sec-janela" class="lanc-section" style="margin-top:-.25rem">
          <div style="display:flex;align-items:center;gap:.6rem;cursor:pointer" id="lanc-janela-toggle-row">
            <!-- Checkbox customizado -->
            <div id="lanc-janela-check" style="
              width:18px;height:18px;border-radius:4px;flex-shrink:0;
              border:2px solid rgba(124,58,237,.5);background:transparent;
              display:flex;align-items:center;justify-content:center;
              transition:all .2s;cursor:pointer
            ">
              <span id="lanc-janela-check-icon" style="display:none;font-size:.7rem">✓</span>
            </div>
            <div>
              <div style="font-family:var(--font-section);font-size:.78rem;font-weight:700;color:var(--text-primary)">
                ⏰ Definir Janela de Horário
              </div>
              <div style="font-size:.65rem;color:var(--text-muted);margin-top:.1rem">
                A missão só é válida dentro desse intervalo de horas
              </div>
            </div>
          </div>

          <!-- Campos (ocultos por padrão) -->
          <div id="lanc-janela-campos" style="display:none;margin-top:.85rem">
            <div style="
              background:rgba(124,58,237,.06);border:1px solid rgba(124,58,237,.2);
              border-radius:.7rem;padding:.85rem;display:flex;flex-direction:column;gap:.75rem
            ">
              <div style="font-size:.68rem;color:var(--text-muted);line-height:1.5">
                🕐 Ex: <strong style="color:var(--purple-glow)">Banho Revitalizador</strong> — válido
                apenas das <strong>20:00</strong> às <strong>22:00</strong>. Fora desse horário,
                a missão não conta e é marcada como falha.
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:.65rem">
                <div>
                  <label style="
                    font-family:var(--font-section);font-size:.65rem;letter-spacing:.1em;
                    text-transform:uppercase;color:var(--text-muted);display:block;margin-bottom:.3rem
                  ">🟢 Início da janela</label>
                  <input type="time" class="lanc-input" id="lanc-hora-inicio"
                    style="width:100%;font-family:var(--font-section);font-size:.85rem"
                    placeholder="20:00">
                </div>
                <div>
                  <label style="
                    font-family:var(--font-section);font-size:.65rem;letter-spacing:.1em;
                    text-transform:uppercase;color:var(--text-muted);display:block;margin-bottom:.3rem
                  ">🔴 Prazo final</label>
                  <input type="time" class="lanc-input" id="lanc-hora-fim"
                    style="width:100%;font-family:var(--font-section);font-size:.85rem"
                    placeholder="22:00">
                </div>
              </div>

              <!-- Preview dinâmico da janela -->
              <div id="lanc-janela-preview" style="
                font-family:var(--font-section);font-size:.72rem;
                color:var(--cyan-skill);text-align:center;
                padding:.4rem;border-radius:.4rem;
                background:rgba(6,182,212,.06);border:1px solid rgba(6,182,212,.15)
              ">Selecione os horários acima</div>
            </div>
          </div>
        </div>

        <!-- DATA / HORA LIMITE (apenas Tarefa) -->
        <div id="lanc-sec-tarefa" class="lanc-section hidden">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
            <div class="lanc-field">
              <label class="lanc-label">📅 Data</label>
              <input type="date" class="lanc-input" id="lanc-data-tarefa">
            </div>
            <div class="lanc-field">
              <label class="lanc-label">⏰ Hora Limite</label>
              <input type="time" class="lanc-input" id="lanc-hora-tarefa">
            </div>
          </div>
        </div>

        <!-- PRIORIDADE -->
        <div class="lanc-field">
          <label class="lanc-label">🎯 Prioridade</label>
          <div class="lanc-prior-grid" id="lanc-prior-grid">
            ${this.PRIORIDADES.map(p => `
              <button class="lanc-prior-btn${p.id==='MEDIA'?' active':''}"
                data-prior="${p.id}"
                style="--prior-cor:${p.cor};--prior-glow:${p.glow}">
                <span class="lanc-prior-icon">${p.icon}</span>
                <span>${p.label}</span>
              </button>`).join('')}
          </div>
        </div>

        <!-- DIFICULDADE -->
        <div class="lanc-field">
          <label class="lanc-label">💪 Dificuldade</label>
          <div class="lanc-dific-grid" id="lanc-dific-grid">
            ${this.DIFICULDADES.map(d => `
              <button class="lanc-dific-btn${d.id==='NORMAL'?' active':''}" data-dific="${d.id}" title="${d.desc}">
                <span>${d.icon}</span>
                <span class="lanc-dific-label">${d.label}</span>
                <span class="lanc-dific-mult">×${d.xpMult}</span>
              </button>`).join('')}
          </div>
        </div>

        <!-- CATEGORIA -->
        <div class="lanc-field">
          <label class="lanc-label">🏷️ Categoria</label>
          <div class="lanc-cat-grid" id="lanc-cat-grid">
            ${this.CATEGORIAS.map(c => `
              <button class="lanc-cat-btn${c.id==='Pessoal'?' active':''}"
                data-cat="${c.id}" style="--cat-cor:${c.cor}">
                <span class="lanc-cat-icon">${c.icon}</span>
                <span class="lanc-cat-label">${c.label}</span>
              </button>`).join('')}
          </div>
        </div>

        <!-- RECOMPENSA & PUNIÇÃO -->
        <div class="lanc-recomp-panel">
          <div class="lanc-recomp-col">
            <div class="lanc-recomp-title lanc-recomp-title--reward">
              ✨ Recompensa (ao concluir)
            </div>
            <div class="lanc-recomp-row">
              <div class="lanc-recomp-field">
                <label class="lanc-label-sm">⚡ XP</label>
                <input type="number" class="lanc-input-sm" id="lanc-xp" min="0" max="9999">
              </div>
              <div class="lanc-recomp-field">
                <label class="lanc-label-sm">🪙 Mana Coins</label>
                <input type="number" class="lanc-input-sm" id="lanc-mc" min="0" max="9999">
              </div>
            </div>
          </div>
          <div class="lanc-recomp-divider"></div>
          <div class="lanc-recomp-col">
            <div class="lanc-recomp-title lanc-recomp-title--punish">
              💀 Punição (se não concluir)
            </div>
            <div class="lanc-recomp-row">
              <div class="lanc-recomp-field">
                <label class="lanc-label-sm">⚡ XP perdido</label>
                <input type="number" class="lanc-input-sm" id="lanc-pen" min="0" max="9999">
              </div>
              <button class="lanc-auto-btn" id="lanc-auto-calc" title="Recalcular automaticamente">
                🔄 Auto
              </button>
            </div>
          </div>
        </div>

        <!-- DESCRIÇÃO -->
        <div class="lanc-field">
          <label class="lanc-label">📝 Descrição <span style="color:var(--text-muted);font-size:.75rem">(opcional)</span></label>
          <textarea class="lanc-input lanc-textarea" id="lanc-desc"
            placeholder="Detalhes adicionais da missão..." rows="2"></textarea>
        </div>

        <!-- ERRO -->
        <div class="lanc-erro hidden" id="lanc-erro"></div>

        <!-- AÇÕES -->
        <div class="lanc-actions">
          <button class="lanc-btn-cancel" id="lanc-cancel">Cancelar</button>
          <button class="lanc-btn-submit" id="lanc-submit">
            <span id="lanc-submit-txt">⚔️ Criar Missão</span>
          </button>
        </div>

      </div><!-- /lanc-body -->
    `;

    this._bindForm();
    this._calcAuto();
  },

  // ── Binds internos do formulário ──────────────────────────
  _bindForm() {
    // Tipo
    document.querySelectorAll('.lanc-tipo-btn').forEach(btn => {
      btn.addEventListener('click', () => this._setTipo(btn.dataset.tipo));
    });

    // Frequência
    document.querySelectorAll('.lanc-freq-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.lanc-freq-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._freq = btn.dataset.freq;
        this._toggleFreqSec();
        this._calcAuto();
      });
    });

    // Dias da semana
    document.querySelectorAll('.lanc-dia-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        btn.classList.toggle('active');
        if (btn.classList.contains('active'))
          this._diasSemana = [...new Set([...this._diasSemana, idx])].sort();
        else
          this._diasSemana = this._diasSemana.filter(d => d !== idx);
      });
    });

    // Prioridade
    document.querySelectorAll('.lanc-prior-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.lanc-prior-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._prioridade = btn.dataset.prior;
        this._calcAuto();
      });
    });

    // Dificuldade
    document.querySelectorAll('.lanc-dific-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.lanc-dific-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._dificuldade = btn.dataset.dific;
        this._calcAuto();
      });
    });

    // Categoria
    document.querySelectorAll('.lanc-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.lanc-cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._categoria = btn.dataset.cat;
      });
    });

    // ── Janela de Horário ─────────────────────────────────
    const janelaRow    = document.getElementById('lanc-janela-toggle-row');
    const janelaCheck  = document.getElementById('lanc-janela-check');
    const janelaIcon   = document.getElementById('lanc-janela-check-icon');
    const janelaCampos = document.getElementById('lanc-janela-campos');
    const janelaPreview= document.getElementById('lanc-janela-preview');

    let janelaAtiva = false;
    const toggleJanela = () => {
      janelaAtiva = !janelaAtiva;
      // Visual do checkbox
      janelaIcon.style.display  = janelaAtiva ? 'block' : 'none';
      janelaCheck.style.background   = janelaAtiva ? 'var(--purple-main)' : 'transparent';
      janelaCheck.style.borderColor  = janelaAtiva ? 'var(--purple-main)' : 'rgba(124,58,237,.5)';
      // Mostra/oculta campos
      janelaCampos.style.display = janelaAtiva ? 'block' : 'none';
    };
    janelaRow?.addEventListener('click', toggleJanela);

    // Preview dinâmico ao digitar os horários
    const atualizarPreview = () => {
      const hi = document.getElementById('lanc-hora-inicio')?.value;
      const hf = document.getElementById('lanc-hora-fim')?.value;
      if (!janelaPreview) return;
      if (hi && hf) {
        const [hIh, hIm] = hi.split(':');
        const [hFh, hFm] = hf.split(':');
        const durMin = (parseInt(hFh)*60 + parseInt(hFm)) - (parseInt(hIh)*60 + parseInt(hIm));
        if (durMin <= 0) {
          janelaPreview.textContent = '⚠️ O prazo final deve ser maior que o início';
          janelaPreview.style.color = '#f87171';
        } else {
          const dur = durMin >= 60
            ? `${Math.floor(durMin/60)}h${durMin%60 > 0 ? String(durMin%60).padStart(2,'0')+'min' : ''}`
            : `${durMin} min`;
          janelaPreview.textContent = `⏰ Janela ativa: ${hi} → ${hf}  (duração: ${dur})`;
          janelaPreview.style.color = 'var(--cyan-skill)';
        }
      } else {
        janelaPreview.textContent = 'Selecione os horários acima';
        janelaPreview.style.color = 'var(--cyan-skill)';
      }
    };
    document.getElementById('lanc-hora-inicio')?.addEventListener('input', atualizarPreview);
    document.getElementById('lanc-hora-fim')?.addEventListener('input',    atualizarPreview);
    // ─────────────────────────────────────────────────────

    // Auto-calc
    document.getElementById('lanc-auto-calc')?.addEventListener('click', () => this._calcAuto(true));

    // Fechar / cancelar
    document.getElementById('lanc-close')?.addEventListener('click',  () => this.fechar());
    document.getElementById('lanc-cancel')?.addEventListener('click', () => this.fechar());

    // Submit
    document.getElementById('lanc-submit')?.addEventListener('click', () => this._salvar());

    // Define data padrão da tarefa = hoje
    const dtTarefa = document.getElementById('lanc-data-tarefa');
    if (dtTarefa) dtTarefa.value = new Date().toISOString().split('T')[0];
  },

  // ── Eventos globais com delegação (funcionam após login) ─
  _bindGlobal() {
    // Garante que só registra uma vez (evita listeners duplicados)
    if (this._globalBound) return;
    this._globalBound = true;

    // Delegação no document para botões de abrir o lançador
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button, a');
      if (!btn) return;
      const id = btn.id;
      if (id === 'btn-nova-missao' || id === 'btn-nova-rotina' || id === 'btn-fab') {
        e.preventDefault();
        this.abrir('ROTINA');
      } else if (id === 'btn-nova-tarefa' || id === 'btn-add-tarefa') {
        e.preventDefault();
        this.abrir('TAREFA');
      }
    });

    // Backdrop — usa captura para garantir execução antes de outros handlers
    document.getElementById('window-backdrop')?.addEventListener('click', (e) => {
      // Fecha o lançador se estiver aberto
      const lanc = document.getElementById('lancador-window');
      if (lanc && lanc.style.display !== 'none' && lanc.classList.contains('visible')) {
        this.fechar();
      }
    });
  },

  // ── Alterna tipo Rotina / Tarefa ──────────────────────────
  _setTipo(tipo) {
    this._tipo = tipo;
    document.querySelectorAll('.lanc-tipo-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.tipo === tipo)
    );
    const secFreq   = document.getElementById('lanc-sec-freq');
    const secTarefa = document.getElementById('lanc-sec-tarefa');
    const secJanela = document.getElementById('lanc-sec-janela');
    if (secFreq)   secFreq.classList.toggle('hidden', tipo === 'TAREFA');
    if (secTarefa) secTarefa.classList.toggle('hidden', tipo === 'ROTINA');
    if (secJanela) secJanela.style.display = tipo === 'ROTINA' ? '' : 'none';
    const title = document.getElementById('lanc-header-title');
    if (title) title.textContent = tipo === 'ROTINA' ? 'Nova Rotina Recorrente' : 'Nova Tarefa Avulsa';
    this._calcAuto();
  },

  // ── Mostra/oculta seções da frequência ───────────────────
  _toggleFreqSec() {
    document.getElementById('lanc-sec-dias')?.classList.toggle('hidden',    this._freq !== 'SEMANAL');
    document.getElementById('lanc-sec-dia-mes')?.classList.toggle('hidden', this._freq !== 'MENSAL');
    document.getElementById('lanc-sec-anual')?.classList.toggle('hidden',   this._freq !== 'ANUAL');
  },

  // ── Cálculo automático de XP / MC / Penalidade ───────────
  _calcAuto(force = false) {
    const xpInput  = document.getElementById('lanc-xp');
    const mcInput  = document.getElementById('lanc-mc');
    const penInput = document.getElementById('lanc-pen');
    if (!xpInput) return;

    const multDific   = this.XP_DIFIC[this._dificuldade]   || 1.0;
    const multPrior   = this.XP_PRIOR[this._prioridade]    || 1.0;
    const pctPenal    = this.PENAL_PRIOR[this._prioridade] || 0;

    const baseXP  = this._tipo === 'ROTINA' ? (this.XP_BASE[this._freq] || 50) : 60;
    const baseMC  = this._tipo === 'ROTINA' ? (this.MC_BASE[this._freq] || 5)  : 10;

    const xp  = Math.max(10, Math.round(baseXP * multDific * multPrior));
    const mc  = Math.max(1,  Math.round(baseMC * multDific));
    const pen = Math.round(xp * pctPenal);

    if (force || !xpInput.dataset.manual)  { xpInput.value  = xp;  }
    if (force || !mcInput.dataset.manual)  { mcInput.value  = mc;  }
    if (force || !penInput.dataset.manual) { penInput.value = pen; }

    // Marca como manual se o usuário editou
    [xpInput, mcInput, penInput].forEach(inp => {
      inp.addEventListener('input', () => inp.dataset.manual = '1', { once: true });
    });
  },

  // ── Salvar ────────────────────────────────────────────────
  async _salvar() {
    const titulo = document.getElementById('lanc-titulo')?.value?.trim();
    if (!titulo) { this._erro('⚔️ Informe o título da missão!'); return; }

    // Validações específicas
    if (this._tipo === 'ROTINA' && this._freq === 'SEMANAL' && !this._diasSemana.length) {
      this._erro('📅 Selecione ao menos um dia da semana!'); return;
    }
    if (this._tipo === 'ROTINA' && this._freq === 'MENSAL') {
      const dm = parseInt(document.getElementById('lanc-dia-mes')?.value);
      if (!dm || dm < 1 || dm > 31) { this._erro('📅 Informe um dia do mês válido (1-31)!'); return; }
    }
    if (this._tipo === 'TAREFA' && !document.getElementById('lanc-data-tarefa')?.value) {
      this._erro('📅 Informe a data da tarefa!'); return; }

    this._ocultarErro();
    const btn = document.getElementById('lanc-submit');
    const txt = document.getElementById('lanc-submit-txt');
    if (btn) btn.disabled = true;
    if (txt) txt.textContent = '⏳ Salvando...';

    try {
      let resultado;

      if (this._tipo === 'ROTINA') {
        // Valida janela de horário
        const janelaAtiva = document.getElementById('lanc-janela-campos')?.style.display !== 'none';
        const horaInicio  = document.getElementById('lanc-hora-inicio')?.value || null;
        const horaFim     = document.getElementById('lanc-hora-fim')?.value    || null;
        if (janelaAtiva) {
          if (!horaInicio || !horaFim) {
            this._erro('\u23F0 Preencha in\u00EDcio e fim da janela de hor\u00E1rio!');
            if (btn) btn.disabled = false;
            if (txt) txt.textContent = '\u2694\uFE0F ' + (this._editId ? 'Salvar Altera\u00E7\u00F5es' : 'Criar Miss\u00E3o');
            return;
          }
          const [hIh, hIm] = horaInicio.split(':').map(Number);
          const [hFh, hFm] = horaFim.split(':').map(Number);
          if ((hFh*60 + hFm) <= (hIh*60 + hIm)) {
            this._erro('\u23F0 O prazo final deve ser maior que o in\u00EDcio!');
            if (btn) btn.disabled = false;
            if (txt) txt.textContent = '\u2694\uFE0F ' + (this._editId ? 'Salvar Altera\u00E7\u00F5es' : 'Criar Miss\u00E3o');
            return;
          }
        }

        const payload = {
          titulo,
          descricao:         document.getElementById('lanc-desc')?.value?.trim() || null,
          tipo:              this._freq,
          categoria:         this._categoria,
          prioridade:        this._prioridade,
          dificuldade:       this._dificuldade,
          icone:             this.CATEGORIAS.find(c => c.id === this._categoria)?.icon || '⚔️',
          xp_recompensa:     parseInt(document.getElementById('lanc-xp')?.value)  || null,
          moedas_recompensa: parseInt(document.getElementById('lanc-mc')?.value)  || null,
          penalidade_xp:     parseInt(document.getElementById('lanc-pen')?.value) || 0,
          hora_inicio:       janelaAtiva ? horaInicio : null,
          hora_fim:          janelaAtiva ? horaFim    : null,
        };
        if (this._freq === 'SEMANAL') payload.dias_semana = this._diasSemana;
        if (this._freq === 'MENSAL')  payload.dia_mes = parseInt(document.getElementById('lanc-dia-mes')?.value);
        if (this._freq === 'ANUAL') {
          const dtAnual = document.getElementById('lanc-data-anual')?.value;
          if (dtAnual) payload.mes_dia = dtAnual.substring(5); // MM-DD
        }

        if (this._editId) {
          resultado = await API.rotinas.atualizar(this._editId, payload);
        } else {
          resultado = await API.rotinas.criar(payload);
        }
      } else {
        // Tarefa
        const payloadT = {
          titulo,
          descricao:         document.getElementById('lanc-desc')?.value?.trim() || null,
          data_prevista:     document.getElementById('lanc-data-tarefa')?.value,
          hora_limite:       document.getElementById('lanc-hora-tarefa')?.value || null,
          categoria:         this._categoria,
          prioridade:        this._prioridade,
          xp_recompensa:     parseInt(document.getElementById('lanc-xp')?.value)  || null,
          moedas_recompensa: parseInt(document.getElementById('lanc-mc')?.value)  || null,
          penalidade_xp:     parseInt(document.getElementById('lanc-pen')?.value) || 0,
        };
        if (this._editId) {
          resultado = await API.tarefas.atualizar(this._editId, payloadT);
        } else {
          resultado = await API.tarefas.criar(payloadT);
        }
      }

      // Sucesso!
      this._animarSucesso(resultado);
      this.fechar();

      // Atualiza a lista da página atual
      const paginaAtual = window.App?.currentPage;
      if (paginaAtual === 'dashboard')  Dashboard?.carregar?.();
      if (paginaAtual === 'rotinas')    Rotinas?.carregar?.();
      if (paginaAtual === 'tarefas')    Tarefas?.carregar?.();

    } catch (err) {
      this._erro('\u274C ' + (err.message || 'Erro ao salvar miss\u00E3o'));
      if (btn) btn.disabled = false;
      if (txt) txt.textContent = '\u2694\uFE0F ' + (this._editId ? 'Salvar Altera\u00E7\u00F5es' : 'Criar Miss\u00E3o');
    } finally {
      // Garante que o bot\u00E3o sempre volta ao estado normal
      // (fechar() j\u00E1 chama _reset que agora tamb\u00E9m restaura o bot\u00E3o)
    }
  },

  // ── Animação de sucesso ───────────────────────────────────
  _animarSucesso(dados) {
    const xp = dados?.xp_recompensa || parseInt(document.getElementById('lanc-xp')?.value) || 0;
    // Float de XP
    const float = document.getElementById('xp-float');
    if (float && xp) {
      float.textContent = `+${xp} XP`;
      float.classList.add('visible');
      setTimeout(() => float.classList.remove('visible'), 1800);
    }
  },

  // ── Helpers de erro ───────────────────────────────────────
  _erro(msg) {
    const el = document.getElementById('lanc-erro');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },
  _ocultarErro() {
    document.getElementById('lanc-erro')?.classList.add('hidden');
  },

  // ── Preenche o form para edição ───────────────────────────
  _preencherEdicao(d) {
    this._editId = d.id;
    document.getElementById('lanc-header-title').textContent = 'Editar Missão';
    document.getElementById('lanc-submit-txt').textContent   = '💾 Salvar Alterações';
    if (d.titulo)     document.getElementById('lanc-titulo').value = d.titulo;
    if (d.descricao)  document.getElementById('lanc-desc').value   = d.descricao;

    if (d.tipo) {
      this._freq = d.tipo;
      document.querySelectorAll('.lanc-freq-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.freq === d.tipo);
      });
      this._toggleFreqSec();
      if (d.tipo === 'SEMANAL' && d.dias_semana?.length) {
        this._diasSemana = d.dias_semana;
        this._diasSemana.forEach(idx => {
          document.querySelector(`.lanc-dia-btn[data-idx="${idx}"]`)?.classList.add('active');
        });
      }
      if (d.tipo === 'MENSAL' && d.dia_mes)
        document.getElementById('lanc-dia-mes').value = d.dia_mes;
    }
    if (d.prioridade) {
      this._prioridade = d.prioridade;
      document.querySelectorAll('.lanc-prior-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.prior === d.prioridade));
    }
    if (d.dificuldade) {
      this._dificuldade = d.dificuldade;
      document.querySelectorAll('.lanc-dific-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.dific === d.dificuldade));
    }
    if (d.categoria) {
      this._categoria = d.categoria;
      document.querySelectorAll('.lanc-cat-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.cat === d.categoria));
    }
    if (d.xp_recompensa)     { const el = document.getElementById('lanc-xp');  if(el){el.value=d.xp_recompensa; el.dataset.manual='1';} }
    if (d.moedas_recompensa) { const el = document.getElementById('lanc-mc');  if(el){el.value=d.moedas_recompensa; el.dataset.manual='1';} }
    if (d.penalidade_xp)     { const el = document.getElementById('lanc-pen'); if(el){el.value=d.penalidade_xp; el.dataset.manual='1';} }
  },

  // ── Reset ─────────────────────────────────────────────────
  _reset() {
    this._tipo        = 'ROTINA';
    this._prioridade  = 'MEDIA';
    this._dificuldade = 'NORMAL';
    this._categoria   = 'Pessoal';
    this._diasSemana  = [];
    this._freq        = 'DIARIA';
    this._editId      = null;
    // Sempre restaura o bot\u00E3o de submit ao fechar/reabrir
    const btn = document.getElementById('lanc-submit');
    const txt = document.getElementById('lanc-submit-txt');
    if (btn) btn.disabled = false;
    if (txt) txt.textContent = '\u2694\uFE0F Criar Miss\u00E3o';
  },
};

// Auto-init quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('lancador-window')) Lancador.init();
});
window.Lancador = Lancador;
