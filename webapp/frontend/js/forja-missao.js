/* ============================================================
   forja-missao.js — A Forja de Missões (lançador)

   Princípio: a escolha nunca é abstrata. Cada opção carrega a cor
   que o cartão terá, e uma PRÉVIA AO VIVO mostra o resultado real
   enquanto o hunter decide.

   Uso:
     ForjaMissao.abrir();                    // cria de verdade
     ForjaMissao.abrir({ demo: true });      // vitrine (não salva)

   Requer: css/forja-missao.css + missao-card.(js|css)
   ============================================================ */

const ForjaMissao = {
  _demo: false,
  _estado: null,

  /* ── Catálogos (a cor vive aqui e propaga para tudo) ───── */
  TIPOS: [
    { id: 'ROTINA', ico: '🔄', txt: 'Rotina Recorrente', sub: 'repete no ciclo' },
    { id: 'TAREFA', ico: '📋', txt: 'Tarefa Avulsa',     sub: 'uma única vez'  },
  ],
  FREQUENCIAS: [
    { id: 'DIARIA',  ico: '🌅', txt: 'Diária'  },
    { id: 'SEMANAL', ico: '📆', txt: 'Semanal' },
    { id: 'MENSAL',  ico: '🗓', txt: 'Mensal'  },
    { id: 'ANUAL',   ico: '🎯', txt: 'Anual'   },
  ],
  PRIORIDADES: [
    { id: 'CRITICA', ico: '🔴', txt: 'Crítica', cor: '#ef4444', sub: 'urgente'  },
    { id: 'ALTA',    ico: '🟠', txt: 'Alta',    cor: '#f97316', sub: 'importa'  },
    { id: 'MEDIA',   ico: '🟡', txt: 'Média',   cor: '#f59e0b', sub: 'padrão'   },
    { id: 'BAIXA',   ico: '🟢', txt: 'Baixa',   cor: '#10b981', sub: 'tranquila'},
  ],
  DIFICULDADES: [
    { id: 'FACIL',    ico: '☁️', txt: 'Fácil',    cor: '#10b981', sub: 'C · ×0.5' },
    { id: 'NORMAL',   ico: '⚡', txt: 'Normal',   cor: '#3b82f6', sub: 'B · ×1'   },
    { id: 'DIFICIL',  ico: '🔥', txt: 'Difícil',  cor: '#a855f7', sub: 'A · ×1.5' },
    { id: 'LENDARIO', ico: '💀', txt: 'Lendário', cor: '#fbbf24', sub: 'S · ×2.5' },
  ],
  CATEGORIAS: [
    { id: 'Saúde',    ico: '❤️', txt: 'Saúde',    cor: '#ef4444' },
    { id: 'Trabalho', ico: '💼', txt: 'Trabalho', cor: '#3b82f6' },
    { id: 'Estudo',   ico: '📚', txt: 'Estudo',   cor: '#8b5cf6' },
    { id: 'Casa',     ico: '🏠', txt: 'Casa',     cor: '#10b981' },
    { id: 'Pessoal',  ico: '⚡', txt: 'Pessoal',  cor: '#f59e0b' },
    { id: 'Combate',  ico: '⚔️', txt: 'Combate',  cor: '#ec4899' },
  ],

  /* Mesmas tabelas do backend (rotinas.py) — prévia fiel */
  _XP_TIPO:  { DIARIA: 50, SEMANAL: 200, MENSAL: 500, ANUAL: 2000 },
  _MC_TIPO:  { DIARIA: 5,  SEMANAL: 25,  MENSAL: 60,  ANUAL: 250  },
  _MULT_DIF: { FACIL: .5, NORMAL: 1, DIFICIL: 1.5, LENDARIO: 2.5 },
  _BONUS_PRI:{ CRITICA: 1.5, ALTA: 1.2, MEDIA: 1, BAIXA: .7 },
  _PENAL_PRI:{ CRITICA: .5, ALTA: .3, MEDIA: .15, BAIXA: 0 },

  _calcular(e) {
    const xp = Math.max(10, Math.round(
      (this._XP_TIPO[e.frequencia] || 50) *
      (this._MULT_DIF[e.dificuldade] || 1) *
      (this._BONUS_PRI[e.prioridade] || 1)));
    const mc = Math.max(1, Math.round(
      (this._MC_TIPO[e.frequencia] || 5) * (this._MULT_DIF[e.dificuldade] || 1)));
    const pen = Math.round(xp * (this._PENAL_PRI[e.prioridade] ?? .15));
    return { xp, mc, pen };
  },

  /* ── Abertura ──────────────────────────────────────────── */
  abrir(opts = {}) {
    this._demo = !!opts.demo;
    this._estado = {
      tipo: 'ROTINA', titulo: '', frequencia: 'DIARIA',
      prioridade: 'MEDIA', dificuldade: 'NORMAL', categoria: 'Pessoal',
      janela: false, hora_inicio: '', hora_fim: '',
      xp: null, mc: null, pen: null, auto: true, descricao: '',
    };
    this._render();
    document.getElementById('fm-backdrop').classList.add('on');
    setTimeout(() => document.getElementById('fm-titulo-input')?.focus(), 120);
  },

  fechar() {
    document.getElementById('fm-backdrop')?.classList.remove('on');
  },

  /* ── Render do modal ───────────────────────────────────── */
  _render() {
    let bd = document.getElementById('fm-backdrop');
    if (!bd) {
      bd = document.createElement('div');
      bd.id = 'fm-backdrop';
      bd.className = 'fm-backdrop';
      document.body.appendChild(bd);
      bd.addEventListener('click', e => { if (e.target === bd) this.fechar(); });
    }

    const e = this._estado;
    const grupo = (campo, itens, cols) => `
      <div class="fm-opcoes c${cols}">
        ${itens.map(o => `
          <div class="fm-op ${e[campo] === o.id ? 'sel' : ''}"
               style="--op-cor:${o.cor || 'var(--purple-glow)'}"
               data-fm-campo="${campo}" data-fm-valor="${o.id}">
            <span class="ico">${o.ico}</span>
            <span class="txt">${o.txt}</span>
            ${o.sub ? `<span class="sub">${o.sub}</span>` : ''}
          </div>`).join('')}
      </div>`;

    bd.innerHTML = `
      <div class="fm-modal" id="fm-modal">
        <div class="fm-fio"></div>

        <div class="fm-head">
          <div class="fm-sigilo">
            <svg viewBox="0 0 50 50" aria-hidden="true">
              <g class="fm-sigilo-anel">
                <polygon points="25,6 30,20 44,25 30,30 25,44 20,30 6,25 20,20"
                  fill="none" stroke="currentColor" stroke-width="1.6" style="color:var(--fm-cor)"/>
              </g>
              <g class="fm-sigilo-orb">
                <circle cx="25" cy="25" r="19" fill="none" stroke="currentColor" stroke-opacity=".55"
                  stroke-width="1" stroke-dasharray="9 38" style="color:var(--fm-cor)"/>
              </g>
            </svg>
          </div>
          <div style="flex:1;min-width:0">
            <div class="fm-titulo">Forjar Missão</div>
            <div class="fm-sub">${this._demo ? 'Vitrine — nada será salvo' : 'Sistema de Missões Solo Routines'}</div>
          </div>
          <button class="fm-fechar" data-fm-fechar>✕</button>
        </div>

        <div class="fm-corpo">
          <!-- ── Formulário ── -->
          <div class="fm-form">
            <div class="fm-bloco fm-full">${grupo('tipo', this.TIPOS, 2)}</div>

            <div class="fm-bloco fm-full">
              <div class="fm-rotulo">⚔️ Título da missão <span class="obrig">*</span></div>
              <input id="fm-titulo-input" class="fm-input" maxlength="120"
                     placeholder="O que precisa ser feito?" value="${e.titulo}">
            </div>

            <div class="fm-bloco fm-full" id="fm-bloco-freq" ${e.tipo === 'TAREFA' ? 'style="display:none"' : ''}>
              <div class="fm-rotulo">🔁 Frequência</div>
              ${grupo('frequencia', this.FREQUENCIAS, 4)}
            </div>

            <!-- Prioridade e Dificuldade lado a lado -->
            <div class="fm-bloco">
              <div class="fm-rotulo">🎯 Prioridade</div>
              ${grupo('prioridade', this.PRIORIDADES, 2)}
            </div>

            <div class="fm-bloco">
              <div class="fm-rotulo">💪 Dificuldade</div>
              ${grupo('dificuldade', this.DIFICULDADES, 2)}
            </div>

            <div class="fm-bloco fm-full">
              <div class="fm-rotulo">🏷 Categoria</div>
              ${grupo('categoria', this.CATEGORIAS, 6)}
            </div>

            <div class="fm-bloco fm-full">
              <label class="fm-toggle">
                <input type="checkbox" data-fm-janela ${e.janela ? 'checked' : ''}>
                <span>
                  <span class="fm-toggle-txt">⏰ Definir janela de horário</span><br>
                  <span class="fm-toggle-sub">A missão só vale nesse intervalo — o prazo aparece no cartão</span>
                </span>
              </label>
              <div class="fm-horarios ${e.janela ? 'on' : ''}" id="fm-horarios">
                <div><div class="fm-rotulo">Início</div>
                  <input type="time" class="fm-input" data-fm-campo-txt="hora_inicio" value="${e.hora_inicio}"></div>
                <div><div class="fm-rotulo">Prazo final</div>
                  <input type="time" class="fm-input" data-fm-campo-txt="hora_fim" value="${e.hora_fim}"></div>
              </div>
            </div>

            <!-- Recompensa e Punição já são 2 colunas -->
            <div class="fm-caixa fm-caixa-premio">
              <div class="fm-rotulo">✨ Recompensa</div>
              <div class="fm-mini">
                <div class="fm-mini-campo"><label>XP</label>
                  <input class="fm-num" type="number" min="0" data-fm-num="xp" value="${e.xp ?? ''}" placeholder="auto"></div>
                <div class="fm-mini-campo"><label>Mana</label>
                  <input class="fm-num" type="number" min="0" data-fm-num="mc" value="${e.mc ?? ''}" placeholder="auto"></div>
              </div>
            </div>
            <div class="fm-caixa fm-caixa-punicao">
              <div class="fm-rotulo">💀 Punição</div>
              <div class="fm-mini" style="grid-template-columns:1fr auto;align-items:end">
                <div class="fm-mini-campo"><label>XP perdido</label>
                  <input class="fm-num" type="number" min="0" data-fm-num="pen" value="${e.pen ?? ''}" placeholder="auto"></div>
                <button class="fm-auto ${e.auto ? 'on' : ''}" data-fm-auto>⚙ Auto</button>
              </div>
            </div>

            <div class="fm-bloco fm-full">
              <div class="fm-rotulo">📄 Descrição (opcional)</div>
              <textarea class="fm-textarea" data-fm-campo-txt="descricao"
                placeholder="Detalhes, critério de conclusão, lembretes...">${e.descricao}</textarea>
            </div>
          </div>

          <!-- ── Prévia ao vivo ── -->
          <div class="fm-lado">
            <div class="fm-previa-lbl">👁 Prévia do cartão</div>
            <div class="fm-previa" id="fm-previa"></div>
            <div class="fm-resumo" id="fm-resumo"></div>
            <div class="fm-previa-nota">
              A cor vem da <b>prioridade</b>; o selo de rank, da <b>dificuldade</b>.
              Deixe XP/Mana em branco para o Sistema calcular.
            </div>
          </div>
        </div>

        <div class="fm-rodape">
          <button class="fm-btn fm-btn-cancelar" data-fm-fechar>Cancelar</button>
          <button class="fm-btn fm-btn-forjar" data-fm-salvar>⚒ Forjar Missão</button>
        </div>
      </div>`;

    this._bind(bd);
    this._atualizar();
  },

  /* ── Eventos (delegação) ───────────────────────────────── */
  _bind(bd) {
    if (bd.dataset.bound) return;
    bd.dataset.bound = '1';

    bd.addEventListener('click', (ev) => {
      const op = ev.target.closest('[data-fm-campo]');
      if (op) {
        this._estado[op.dataset.fmCampo] = op.dataset.fmValor;
        // repinta o grupo inteiro (seleção única)
        op.parentElement.querySelectorAll('.fm-op').forEach(x => x.classList.remove('sel'));
        op.classList.add('sel');
        if (op.dataset.fmCampo === 'tipo') {
          const bloco = document.getElementById('fm-bloco-freq');
          if (bloco) bloco.style.display = this._estado.tipo === 'TAREFA' ? 'none' : '';
        }
        this._atualizar();
        return;
      }
      if (ev.target.closest('[data-fm-fechar]')) { this.fechar(); return; }
      if (ev.target.closest('[data-fm-auto]'))   { this._estado.auto = !this._estado.auto;
        ev.target.closest('[data-fm-auto]').classList.toggle('on', this._estado.auto);
        if (this._estado.auto) this._estado.pen = null;
        this._atualizar(); return; }
      if (ev.target.closest('[data-fm-salvar]')) { this._salvar(); return; }
    });

    bd.addEventListener('change', (ev) => {
      if (ev.target.matches('[data-fm-janela]')) {
        this._estado.janela = ev.target.checked;
        document.getElementById('fm-horarios')?.classList.toggle('on', this._estado.janela);
        this._atualizar();
      }
    });

    bd.addEventListener('input', (ev) => {
      const t = ev.target;
      if (t.id === 'fm-titulo-input') { this._estado.titulo = t.value; this._atualizar(); return; }
      if (t.dataset.fmCampoTxt) { this._estado[t.dataset.fmCampoTxt] = t.value; this._atualizar(); return; }
      if (t.dataset.fmNum) {
        const v = t.value === '' ? null : Math.max(0, parseInt(t.value) || 0);
        this._estado[t.dataset.fmNum] = v;
        if (t.dataset.fmNum === 'pen' && v !== null) {
          this._estado.auto = false;
          document.querySelector('[data-fm-auto]')?.classList.remove('on');
        }
        this._atualizar();
      }
    });

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && document.getElementById('fm-backdrop')?.classList.contains('on')) {
        this.fechar();
      }
    });
  },

  /* ── Atualiza cor do modal + prévia + resumo ───────────── */
  _atualizar() {
    const e = this._estado;
    const pri = this.PRIORIDADES.find(p => p.id === e.prioridade) || this.PRIORIDADES[2];
    const calc = this._calcular(e);
    const xp  = e.xp  ?? calc.xp;
    const mc  = e.mc  ?? calc.mc;
    const pen = (e.auto || e.pen === null) ? calc.pen : e.pen;

    // A cor da prioridade comanda o modal inteiro
    document.getElementById('fm-modal')?.style.setProperty('--fm-cor', pri.cor);

    // Prévia: usa o COMPONENTE REAL do cartão
    const previa = document.getElementById('fm-previa');
    if (previa && window.MissaoCard) {
      const fake = {
        id: 0, titulo: e.titulo || 'Título da missão…',
        categoria: e.categoria, prioridade: e.prioridade, dificuldade: e.dificuldade,
        xp_recompensa: xp, moedas_recompensa: mc,
        hora_inicio: e.janela ? e.hora_inicio : '', hora_fim: e.janela ? e.hora_fim : '',
        status_hoje: 'PENDENTE',
      };
      MissaoCard.cachear([]);            // prévia não entra no timer global
      previa.innerHTML = MissaoCard.html(fake);
    }

    // Resumo econômico
    const resumo = document.getElementById('fm-resumo');
    if (resumo) {
      const freqTxt = e.tipo === 'TAREFA' ? 'Avulsa'
        : (this.FREQUENCIAS.find(f => f.id === e.frequencia)?.txt || '');
      resumo.innerHTML = `
        <div class="fm-resumo-linha"><span>Tipo</span><b>${e.tipo === 'TAREFA' ? 'Tarefa' : 'Rotina'} · ${freqTxt}</b></div>
        <div class="fm-resumo-linha"><span>Ao concluir</span><b class="ganho">+${xp} XP · +${mc} 🪙</b></div>
        <div class="fm-resumo-linha"><span>Se falhar</span><b class="perda">−${pen} XP</b></div>
        ${e.janela && e.hora_fim ? `<div class="fm-resumo-linha"><span>Prazo diário</span><b>${e.hora_inicio || '--:--'} → ${e.hora_fim}</b></div>` : ''}`;
    }

    // Botão só habilita com título
    const btn = document.querySelector('[data-fm-salvar]');
    if (btn) btn.disabled = !e.titulo.trim();
  },

  /* ── Salvar (API real) ─────────────────────────────────── */
  async _salvar() {
    const e = this._estado;
    if (!e.titulo.trim()) { SoloDialog?.toast?.('Dê um nome à missão.', 'error'); return; }
    const calc = this._calcular(e);

    if (this._demo) {
      SoloDialog?.toast?.('🎭 Vitrine — nada foi salvo', 'info');
      this.fechar();
      return;
    }

    const btn = document.querySelector('[data-fm-salvar]');
    if (btn) btn.disabled = true;
    try {
      if (e.tipo === 'ROTINA') {
        await API.rotinas.criar({
          titulo: e.titulo.trim(),
          descricao: e.descricao || null,
          tipo: e.frequencia,
          categoria: e.categoria,
          prioridade: e.prioridade,
          dificuldade: e.dificuldade,
          xp_recompensa: e.xp ?? calc.xp,
          moedas_recompensa: e.mc ?? calc.mc,
          penalidade_xp: (e.auto || e.pen === null) ? calc.pen : e.pen,
          hora_inicio: e.janela ? (e.hora_inicio || null) : null,
          hora_fim:    e.janela ? (e.hora_fim || null) : null,
        });
      } else {
        const hoje = new Date();
        const data = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;
        await API.tarefas.criar({
          titulo: e.titulo.trim(),
          descricao: e.descricao || null,
          data_prevista: data,
          hora_limite: e.janela ? (e.hora_fim || null) : null,
          categoria: e.categoria,
          prioridade: e.prioridade,
          xp_recompensa: e.xp ?? calc.xp,
          moedas_recompensa: e.mc ?? calc.mc,
          penalidade_xp: (e.auto || e.pen === null) ? calc.pen : e.pen,
        });
      }
      SoloDialog?.toast?.('⚒ Missão forjada!', 'success');
      if (typeof SFX !== 'undefined') SFX.play('carimbo');
      this.fechar();
      window.App?.atualizarPaginaAtual?.();
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
      if (btn) btn.disabled = false;
    }
  },
};

window.ForjaMissao = ForjaMissao;
