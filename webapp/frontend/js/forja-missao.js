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
    { id: 'ROTINA', ico: 'rotina', txt: 'Rotina Recorrente', sub: 'repete no ciclo' },
    { id: 'TAREFA', ico: 'avulsa', txt: 'Tarefa Avulsa',     sub: 'uma única vez'  },
  ],

  /* NATUREZA — a inversão. Só aparece para quem tem permissão, e só na
     Rotina: um protocolo que vale uma vez só não é protocolo. */
  NATUREZAS: [
    { id: 'ATIVA',   ico: 'ativa',   txt: 'Ativa',   cor: '#8b5cf6',
      sub: 'você cumpre' },
    { id: 'PASSIVA', ico: 'passiva', txt: 'Passiva', cor: '#6366f1',
      sub: 'você mantém' },
  ],
  _podeEspeciais: false,
  FREQUENCIAS: [
    { id: 'DIARIA',  ico: 'diaria', txt: 'Diária'  },
    { id: 'SEMANAL', ico: 'semanal', txt: 'Semanal' },
    { id: 'MENSAL',  ico: 'mensal', txt: 'Mensal'  },
    { id: 'ANUAL',   ico: 'anual', txt: 'Anual'   },
  ],
  PRIORIDADES: [
    { id: 'CRITICA', ico: 'prior_critica', txt: 'Crítica', cor: '#e11d48', sub: 'urgente'  },
    { id: 'ALTA',    ico: 'prior_alta', txt: 'Alta',    cor: '#f59e0b', sub: 'importa'  },
    { id: 'MEDIA',   ico: 'prior_media', txt: 'Média',   cor: '#64748b', sub: 'padrão'   },
    { id: 'BAIXA',   ico: 'prior_baixa', txt: 'Baixa',   cor: '#3b82f6', sub: 'tranquila'},
  ],
  DIFICULDADES: [
    { id: 'FACIL',    ico: 'dific_facil', txt: 'Fácil',    cor: '#22d3ee', sub: 'C · ×0.5' },
    { id: 'NORMAL',   ico: 'dific_normal', txt: 'Normal',   cor: '#8b5cf6', sub: 'B · ×1'   },
    { id: 'DIFICIL',  ico: 'dific_dificil', txt: 'Difícil',  cor: '#f97316', sub: 'A · ×1.5' },
    { id: 'LENDARIO', ico: 'dific_lendario', txt: 'Lendário', cor: '#fbbf24', sub: 'S · ×2.5' },
  ],
  CATEGORIAS: [
    { id: 'Saúde',    ico: 'saude', txt: 'Saúde',    cor: '#f43f5e' },
    { id: 'Trabalho', ico: 'trabalho', txt: 'Trabalho', cor: '#3b82f6' },
    { id: 'Estudo',   ico: 'estudo', txt: 'Estudo',   cor: '#8b5cf6' },
    { id: 'Casa',     ico: 'casa', txt: 'Casa',     cor: '#14b8a6' },
    { id: 'Pessoal',  ico: 'pessoal', txt: 'Pessoal',  cor: '#f59e0b' },
    { id: 'Combate',  ico: 'combate', txt: 'Combate',  cor: '#ec4899' },
  ],

  /* Mesmas tabelas do backend (rotinas.py) — prévia fiel */
  _XP_TIPO:  { DIARIA: 50, SEMANAL: 200, MENSAL: 500, ANUAL: 2000 },
  _MC_TIPO:  { DIARIA: 5,  SEMANAL: 25,  MENSAL: 60,  ANUAL: 250  },
  _MULT_DIF: { FACIL: .5, NORMAL: 1, DIFICIL: 1.5, LENDARIO: 2.5 },
  _BONUS_PRI:{ CRITICA: 1.5, ALTA: 1.2, MEDIA: 1, BAIXA: .7 },
  _PENAL_PRI:{ CRITICA: .5, ALTA: .3, MEDIA: .15, BAIXA: 0 },

  /* ── Glifos do alfabeto do Sistema (js/glifos.js) ────────
     Vivem como MÉTODOS, não como variáveis locais de _render().
     Eu os havia declarado dentro do _render, e o resumo — que é
     desenhado por _atualizar() — quebrou com "gl is not defined"
     ao abrir o painel. Um ajudante usado por duas funções não
     pode morar dentro de uma delas.

     Sem o módulo carregado devolvem vazio, nunca a chave crua:
     um campo sem ícone é feio; "dific_lendario" na tela é pior. */
  _ico(nome, tam = 30) {
    return (typeof Glifos !== 'undefined') ? Glifos.rico(nome, tam) : '';
  },
  _gl(nome, tam = 15) {
    return (typeof Glifos !== 'undefined') ? Glifos.linha(nome, tam) : '';
  },

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

  /* ── Abertura ──────────────────────────────────────────────
     ForjaMissao.abrir()                          → criar, tipo livre
     ForjaMissao.abrir({ tipo: 'TAREFA' })        → criar, já na aba certa
     ForjaMissao.abrir({ edicao: item })          → editar (PUT, não POST)
     ForjaMissao.abrir({ demo: true })            → vitrine, nada salva
     ForjaMissao.abrir({ aoSalvar: fn })          → avisa a página que chamou

     `edicao` aceita o dict que as páginas já têm em mãos: a rotina crua de
     /rotinas/ ou a tarefa de /tarefas/. O lançador antigo fazia isso e as
     páginas dependem — Rotinas.abrirFormulario(item) é edição. */
  abrir(opts = {}) {
    this._demo = !!opts.demo;
    this._aoSalvar = opts.aoSalvar || null;
    const ed = opts.edicao || null;
    this._editId = ed ? ed.id : null;

    const hoje = this._dataLocal();
    this._estado = {
      tipo: opts.tipo === 'TAREFA' ? 'TAREFA' : 'ROTINA',
      titulo: '', frequencia: 'DIARIA',
      prioridade: 'MEDIA', dificuldade: 'NORMAL', categoria: 'Pessoal',
      janela: false, hora_inicio: '', hora_fim: '',
      natureza: 'ATIVA',
      dias_semana: [], dia_mes: '', mes_dia: '',
      data_prevista: hoje,
      prazo_custom: false, prazo_valor: 30, prazo_unidade: 60,   // 30 × 60 = meia hora
      xp: null, mc: null, pen: null, auto: true, descricao: '',
    };

    if (ed) this._carregarEdicao(ed, opts.tipo);

    this._servidor = null;
    this._render();
    this._consultarServidor();
    this._consultarEspeciais();
    document.getElementById('fm-backdrop').classList.add('on');
    setTimeout(() => document.getElementById('fm-titulo-input')?.focus(), 120);
  },

  /* Pergunta ao SERVIDOR se este hunter pode forjar missão especial.

     Deduzir do cargo aqui seria a regra existindo em dois lugares — e quando
     as outorgas com prazo chegarem (Insígnia VIP), o cliente ficaria com a
     versão velha, oferecendo o que o servidor recusa. A tela decide o que
     MOSTRAR; quem decide o que PODE é o servidor, a cada requisição. */
  async _consultarEspeciais() {
    try {
      const p = await API.get('/rotinas/especiais/permissao');
      this._podeEspeciais = !!p?.pode_especiais;
    } catch (_) {
      this._podeEspeciais = false;    // na dúvida, não oferece
    }
    const bloco = document.getElementById('fm-bloco-natureza');
    if (bloco) {
      bloco.style.display =
        (this._podeEspeciais && this._estado.tipo === 'ROTINA') ? '' : 'none';
    }
  },

  /* "2026-07-25" no fuso LOCAL. toISOString() daria o dia UTC — que depois
     das 21h de Brasília já é amanhã, e a tarefa nasceria no dia errado.
     Este exato descuido já quebrou um teste deste projeto. */
  _dataLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  _carregarEdicao(ed, tipoForcado) {
    const e = this._estado;
    // Tarefa se denuncia pelo campo `data_prevista`; rotina, pelo `tipo` de
    // frequência. O chamador pode forçar, mas não precisa.
    const ehTarefa = tipoForcado === 'TAREFA' || (!!ed.data_prevista && !ed.tipo);

    e.tipo        = ehTarefa ? 'TAREFA' : 'ROTINA';
    e.titulo      = ed.titulo || '';
    e.descricao   = ed.descricao || '';
    e.prioridade  = ed.prioridade || 'MEDIA';
    e.dificuldade = ed.dificuldade || 'NORMAL';
    e.categoria   = ed.categoria || 'Pessoal';

    if (ehTarefa) {
      e.data_prevista = (ed.data_prevista || '').slice(0, 10) || e.data_prevista;
      if (ed.hora_limite) { e.janela = true; e.hora_fim = ed.hora_limite; }
      if (ed.prazo_personalizado && ed.prazo_minutos) {
        e.prazo_custom = true;
        // Reapresenta na maior unidade inteira: 2880 vira "2 dias", não "2880 min".
        const m = ed.prazo_minutos;
        if (m % 1440 === 0)    { e.prazo_valor = m / 1440; e.prazo_unidade = 1440; }
        else if (m % 60 === 0) { e.prazo_valor = m / 60;   e.prazo_unidade = 60; }
        else                   { e.prazo_valor = m;        e.prazo_unidade = 1; }
      }
    } else {
      e.frequencia = ed.tipo || 'DIARIA';
      e.natureza = (ed.natureza || 'ATIVA').toUpperCase();
      e.dias_semana = Array.isArray(ed.dias_semana) ? [...ed.dias_semana]
        : (typeof ed.dias_semana === 'string' && ed.dias_semana
            ? (() => { try { return JSON.parse(ed.dias_semana); } catch (_) { return []; } })()
            : []);
      e.dia_mes = ed.dia_mes || '';
      e.mes_dia = ed.mes_dia || '';
      if (ed.hora_inicio || ed.hora_fim) {
        e.janela = true;
        e.hora_inicio = ed.hora_inicio || '';
        e.hora_fim = ed.hora_fim || '';
      }
    }
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

    const ico = (n, t) => this._ico(n, t);
    const gl  = (n, t) => this._gl(n, t);

    const grupo = (campo, itens, cols) => `
      <div class="fm-opcoes c${cols}">
        ${itens.map(o => `
          <div class="fm-op ${e[campo] === o.id ? 'sel' : ''}"
               style="--op-cor:${o.cor || 'var(--purple-glow)'}"
               data-fm-campo="${campo}" data-fm-valor="${o.id}">
            <span class="ico">${ico(o.ico)}</span>
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
            <div class="fm-titulo">${this._editId ? 'Reforjar Missão' : 'Forjar Missão'}</div>
            <div class="fm-sub">${this._demo ? 'Vitrine — nada será salvo'
              : (this._editId ? 'Editando — a recompensa é recalculada pelo Sistema'
                              : 'Sistema de Missões Solo Routines')}</div>
          </div>
          <button class="fm-fechar" data-fm-fechar>✕</button>
        </div>

        <div class="fm-corpo">
          <!-- ── Formulário ── -->
          <div class="fm-form">
            <div class="fm-bloco fm-full">${grupo('tipo', this.TIPOS, 2)}</div>

            <div class="fm-bloco fm-full">
              <div class="fm-rotulo">${gl("titulo")} Título da missão <span class="obrig">*</span></div>
              <input id="fm-titulo-input" class="fm-input" maxlength="120"
                     placeholder="O que precisa ser feito?" value="${e.titulo}">
            </div>

            <div class="fm-bloco fm-full" id="fm-bloco-freq" ${e.tipo === 'TAREFA' ? 'style="display:none"' : ''}>
              <div class="fm-rotulo">${gl("rotina")} Frequência</div>
              ${grupo('frequencia', this.FREQUENCIAS, 4)}

              <!-- Cada frequência tem a sua pergunta. O lançador antigo tinha
                   estes campos e o backend precisa deles: uma SEMANAL sem
                   dias_semana simplesmente nunca é devida (rotina_devida_em). -->
              <div class="fm-agenda" id="fm-agenda-semanal"
                   ${e.frequencia === 'SEMANAL' ? '' : 'style="display:none"'}>
                <div class="fm-rotulo">${gl("agendada", 12)} Em quais dias?</div>
                <div class="fm-dias">
                  ${['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map((d, i) => `
                    <button type="button" class="fm-dia ${e.dias_semana.includes(i) ? 'sel' : ''}"
                            data-fm-dia="${i}">${d}</button>`).join('')}
                </div>
              </div>
              <div class="fm-agenda" id="fm-agenda-mensal"
                   ${e.frequencia === 'MENSAL' ? '' : 'style="display:none"'}>
                <div class="fm-rotulo">${gl("agendada", 12)} Dia do mês</div>
                <input type="number" class="fm-input fm-input-curto" min="1" max="31"
                       data-fm-campo-txt="dia_mes" value="${e.dia_mes}" placeholder="1–31">
              </div>
              <div class="fm-agenda" id="fm-agenda-anual"
                   ${e.frequencia === 'ANUAL' ? '' : 'style="display:none"'}>
                <div class="fm-rotulo">${gl("agendada", 12)} Data no ano</div>
                <input type="date" class="fm-input fm-input-curto"
                       data-fm-anual value="${e.mes_dia ? '2026-' + e.mes_dia : ''}">
              </div>
            </div>

            <!-- NATUREZA — a inversão da missão passiva.
                 Nasce oculto e só aparece se o servidor autorizar
                 (_consultarEspeciais). Nunca decidimos isso pelo cargo que
                 temos em mãos: a permissão é do servidor. -->
            <div class="fm-bloco fm-full" id="fm-bloco-natureza" style="display:none">
              <div class="fm-rotulo">${gl("passiva", 14)} Natureza da missão
                <span class="fm-selo-premium">Premium</span></div>
              ${grupo('natureza', this.NATUREZAS, 2)}
              <div class="fm-nota-natureza" id="fm-nota-natureza"></div>
            </div>

            <div class="fm-bloco fm-full" id="fm-bloco-data" ${e.tipo === 'TAREFA' ? '' : 'style="display:none"'}>
              <div class="fm-rotulo">${gl("agendada", 12)} Para quando?</div>
              <input type="date" class="fm-input fm-input-curto"
                     data-fm-campo-txt="data_prevista" value="${e.data_prevista}">
            </div>

            <!-- Prioridade e Dificuldade lado a lado -->
            <div class="fm-bloco">
              <div class="fm-rotulo">${gl("prior_alta")} Prioridade</div>
              ${grupo('prioridade', this.PRIORIDADES, 2)}
            </div>

            <div class="fm-bloco">
              <div class="fm-rotulo">${gl("dific_dificil")} Dificuldade</div>
              ${grupo('dificuldade', this.DIFICULDADES, 2)}
            </div>

            <div class="fm-bloco fm-full">
              <div class="fm-rotulo">${gl("etiqueta")} Categoria</div>
              ${grupo('categoria', this.CATEGORIAS, 6)}
            </div>

            <div class="fm-bloco fm-full">
              <label class="fm-toggle">
                <input type="checkbox" data-fm-janela ${e.janela ? 'checked' : ''}>
                <span class="fm-toggle-corpo">
                  <span class="fm-toggle-txt">${gl("relogio",14)} Definir janela de horário</span>
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

            <!-- MODALIDADE PERSONALIZADA (só missão avulsa): o hunter escolhe
                 o PRAZO — e apenas o prazo. A recompensa não sobe junto, e o
                 texto avisa antes que ele descubra do jeito ruim. -->
            <div class="fm-bloco fm-full" id="fm-bloco-prazo" ${e.tipo === 'TAREFA' ? '' : 'style="display:none"'}>
              <label class="fm-toggle">
                <input type="checkbox" data-fm-prazo-custom ${e.prazo_custom ? 'checked' : ''}>
                <span class="fm-toggle-corpo">
                  <span class="fm-toggle-txt">${gl("ampulheta", 14)} Prazo personalizado</span>
                  <span class="fm-toggle-sub">Você escolhe quanto tempo a missão dura — a recompensa não muda com o prazo</span>
                </span>
              </label>
              <div class="fm-horarios ${e.prazo_custom ? 'on' : ''}" id="fm-prazo-campos">
                <div><div class="fm-rotulo">Duração</div>
                  <input type="number" class="fm-input" min="1" max="365"
                         data-fm-prazo-valor value="${e.prazo_valor}"></div>
                <div><div class="fm-rotulo">Unidade</div>
                  <select class="fm-input" data-fm-prazo-unidade>
                    <option value="1"    ${e.prazo_unidade === 1 ? 'selected' : ''}>minutos</option>
                    <option value="60"   ${e.prazo_unidade === 60 ? 'selected' : ''}>horas</option>
                    <option value="1440" ${e.prazo_unidade === 1440 ? 'selected' : ''}>dias</option>
                  </select></div>
              </div>
            </div>

            <!-- ── O QUE O SISTEMA VAI CONCEDER ──────────────────
                 Estes números são EXIBIÇÃO, não campos. Antes eram
                 editáveis, e isso virou mentira quando o servidor
                 passou a precificar sozinho: dava para digitar
                 9.999.999 XP e a missão nascia valendo 50.
                 Agora quem responde é o servidor (/economia/simular),
                 então o que está na tela é o que será concedido. -->
            <div class="fm-caixa fm-caixa-premio">
              <div class="fm-rotulo">${gl("xp")} Recompensa</div>
              <div class="fm-mini">
                <div class="fm-mini-campo"><label>XP</label>
                  <div class="fm-valor" id="fm-v-xp">—</div></div>
                <div class="fm-mini-campo"><label>Mana</label>
                  <div class="fm-valor" id="fm-v-mc">—</div></div>
              </div>
              <div class="fm-nota-calc">${gl("engrenagem", 11)} calculado pelo Sistema</div>
            </div>
            <div class="fm-caixa fm-caixa-punicao">
              <div class="fm-rotulo">${gl("dific_lendario")} Punição e prazo</div>
              <div class="fm-mini">
                <div class="fm-mini-campo"><label>XP perdido</label>
                  <div class="fm-valor fm-valor-perda" id="fm-v-pen">—</div></div>
                <div class="fm-mini-campo"><label>Prazo</label>
                  <div class="fm-valor fm-valor-prazo" id="fm-v-prazo">—</div></div>
              </div>
            </div>

            <div class="fm-bloco fm-full">
              <div class="fm-rotulo">${gl("avulsa")} Descrição (opcional)</div>
              <textarea class="fm-textarea" data-fm-campo-txt="descricao"
                placeholder="Detalhes, critério de conclusão, lembretes...">${e.descricao}</textarea>
            </div>
          </div>

          <!-- ── Prévia ao vivo ── -->
          <div class="fm-lado">
            <div class="fm-previa-lbl">${gl("olho")} Prévia do cartão</div>
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
          <button class="fm-btn fm-btn-forjar" data-fm-salvar>
            ${gl("bigorna")} ${this._editId ? 'Selar alterações' : 'Forjar Missão'}</button>
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
      // Dias da semana: seleção MÚLTIPLA — não passa pelo fluxo dos grupos.
      const dia = ev.target.closest('[data-fm-dia]');
      if (dia) {
        const i = parseInt(dia.dataset.fmDia, 10);
        const ds = this._estado.dias_semana;
        const pos = ds.indexOf(i);
        if (pos >= 0) ds.splice(pos, 1); else ds.push(i);
        dia.classList.toggle('sel', pos < 0);
        this._atualizar();
        return;
      }

      const op = ev.target.closest('[data-fm-campo]');
      if (op) {
        this._estado[op.dataset.fmCampo] = op.dataset.fmValor;
        // repinta o grupo inteiro (seleção única)
        op.parentElement.querySelectorAll('.fm-op').forEach(x => x.classList.remove('sel'));
        op.classList.add('sel');
        const mostra = (id, on) => {
          const el = document.getElementById(id);
          if (el) el.style.display = on ? '' : 'none';
        };
        if (op.dataset.fmCampo === 'tipo') {
          const t = this._estado.tipo === 'TAREFA';
          mostra('fm-bloco-freq', !t);
          mostra('fm-bloco-data', t);
          mostra('fm-bloco-prazo', t);
          // Protocolo que vale uma vez só não é protocolo: a natureza
          // passiva não existe para tarefa avulsa.
          mostra('fm-bloco-natureza', !t && this._podeEspeciais);
          if (t) this._estado.natureza = 'ATIVA';
        }
        // A passiva EXIGE janela — é dela que sai o "das 16:00 às 05:00".
        // Marcar sozinho evita o erro do servidor num caminho que o hunter
        // não tem como adivinhar.
        if (op.dataset.fmCampo === 'natureza' && this._estado.natureza === 'PASSIVA'
            && !this._estado.janela) {
          this._estado.janela = true;
          const chk = bd.querySelector('[data-fm-janela]');
          if (chk) chk.checked = true;
          document.getElementById('fm-horarios')?.classList.add('on');
        }
        if (op.dataset.fmCampo === 'frequencia') {
          const f = this._estado.frequencia;
          mostra('fm-agenda-semanal', f === 'SEMANAL');
          mostra('fm-agenda-mensal',  f === 'MENSAL');
          mostra('fm-agenda-anual',   f === 'ANUAL');
        }
        // Estas cinco escolhas são exatamente as que mudam o preço. Qualquer
        // uma delas obriga a perguntar de novo ao servidor — era isto que
        // faltava, e por isso XP e punição ficavam parados.
        if (['tipo', 'frequencia', 'prioridade', 'dificuldade', 'categoria']
              .includes(op.dataset.fmCampo)) {
          this._agendarConsulta();
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
        return;
      }
      if (ev.target.matches('[data-fm-prazo-custom]')) {
        this._estado.prazo_custom = ev.target.checked;
        document.getElementById('fm-prazo-campos')?.classList.toggle('on', this._estado.prazo_custom);
        this._atualizar();
        return;
      }
      if (ev.target.matches('[data-fm-prazo-unidade]')) {
        this._estado.prazo_unidade = parseInt(ev.target.value, 10) || 1;
        this._atualizar();
        return;
      }
      // O input date entrega "2026-03-15"; o backend guarda só "MM-DD",
      // porque a rotina anual não pertence a um ano específico.
      if (ev.target.matches('[data-fm-anual]')) {
        this._estado.mes_dia = (ev.target.value || '').slice(5);
        this._atualizar();
      }
    });

    bd.addEventListener('input', (ev) => {
      const t = ev.target;
      if (t.id === 'fm-titulo-input') { this._estado.titulo = t.value; this._atualizar(); return; }
      if (t.matches('[data-fm-prazo-valor]')) {
        this._estado.prazo_valor = Math.max(1, parseInt(t.value, 10) || 1);
        this._atualizar();
        return;
      }
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
  /* Pergunta ao SERVIDOR quanto a missão vale e quanto tempo ela tem.

     Antes o cliente recalculava por conta própria, com uma cópia das tabelas.
     Duas cópias divergem na primeira vez que o Arquiteto muda um valor — e a
     prévia passaria a prometer o que o servidor não daria. Agora ele pergunta;
     o cálculo local sobrou apenas como resposta imediata enquanto a rede não
     volta, para os números não piscarem "—" a cada clique. */
  /* OS NÚMEROS CONGELAVAM, e este era o defeito.

     Esta consulta só acontecia UMA VEZ, na abertura. Como `_atualizar()` dá
     preferência ao valor do servidor (`s.xp_recompensa ?? calc.xp`), e esse
     valor passava a existir logo no primeiro retorno, todo clique posterior
     em Crítica, Lendário ou Semanal repintava a tela com o MESMO número da
     abertura. O palpite local — que reagia corretamente — nunca era usado,
     porque o `??` só cede quando o lado esquerdo é nulo.

     Ou seja: quanto mais fiel eu fiz a prévia (perguntando ao servidor), mais
     morta ela ficou. Agora toda mudança de característica reconsulta.

     ESPERA um tiquinho antes de disparar: clicar Crítica → Lendário →
     Difícil em sequência renderia três requisições, e a resposta da primeira
     poderia chegar por último e pintar o valor errado. O debounce resolve as
     duas coisas — e `_pedido` garante que resposta atrasada de um pedido
     velho seja descartada. */
  _agendarConsulta() {
    clearTimeout(this._debounce);
    this._debounce = setTimeout(() => this._consultarServidor(), 180);
  },

  async _consultarServidor() {
    const e = this._estado;
    const meu = (this._pedido = (this._pedido || 0) + 1);
    try {
      const v = await API.get('/economia/simular?' + new URLSearchParams({
        tipo: e.frequencia, prioridade: e.prioridade,
        dificuldade: e.dificuldade, categoria: e.categoria,
        avulsa: e.tipo === 'TAREFA',
      }));
      if (meu !== this._pedido) return;   // chegou tarde: já há pedido mais novo
      this._servidor = v;
      this._atualizar();
    } catch (_) { /* silencioso: fica o palpite local */ }
  },

  _fmtPrazo(min) {
    if (!min && min !== 0) return '—';
    if (min >= 1440) {
      const d = Math.floor(min / 1440), h = Math.round((min % 1440) / 60);
      return h ? `${d}d ${h}h` : `${d}d`;
    }
    if (min >= 60) {
      const h = Math.floor(min / 60), m = min % 60;
      return m ? `${h}h ${m}min` : `${h}h`;
    }
    return `${min}min`;
  },

  _atualizar() {
    const e = this._estado;
    const pri = this.PRIORIDADES.find(p => p.id === e.prioridade) || this.PRIORIDADES[2];

    // O servidor manda; o cálculo local é só o palpite enquanto ele não responde.
    const calc = this._calcular(e);
    const s    = this._servidor || {};
    const xp   = s.xp_recompensa     ?? calc.xp;
    const mc   = s.moedas_recompensa ?? calc.mc;
    const pen  = s.penalidade_xp     ?? calc.pen;
    // Prazo personalizado vence a tabela NA EXIBIÇÃO DO PRAZO — e em nada
    // mais. XP, Mana e punição continuam vindo do servidor, indiferentes.
    const prazo = (e.tipo === 'TAREFA' && e.prazo_custom)
      ? Math.max(5, e.prazo_valor * e.prazo_unidade)
      : s.prazo_minutos;

    const por = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    por('fm-v-xp',    xp.toLocaleString('pt-BR'));
    por('fm-v-mc',    mc.toLocaleString('pt-BR'));
    por('fm-v-pen',   pen ? '−' + pen.toLocaleString('pt-BR') : '0');
    por('fm-v-prazo', this._fmtPrazo(prazo));

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
      const diasTxt = e.tipo === 'ROTINA' && e.frequencia === 'SEMANAL' && e.dias_semana.length
        ? [...e.dias_semana].sort().map(i => ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'][i]).join(' · ')
        : '';
      resumo.innerHTML = `
        <div class="fm-resumo-linha"><span>Tipo</span><b>${e.tipo === 'TAREFA' ? 'Tarefa' : 'Rotina'} · ${freqTxt}</b></div>
        ${diasTxt ? `<div class="fm-resumo-linha"><span>Dias</span><b>${diasTxt}</b></div>` : ''}
        <div class="fm-resumo-linha"><span>Ao concluir</span><b class="ganho">+${xp} XP · +${mc} ${this._gl("moeda", 12)}</b></div>
        <div class="fm-resumo-linha"><span>Se falhar</span><b class="perda">−${pen} XP</b></div>
        ${e.tipo === 'TAREFA' && e.prazo_custom
          ? `<div class="fm-resumo-linha"><span>Prazo escolhido</span><b>${this._fmtPrazo(prazo)}</b></div>` : ''}
        ${e.janela && e.hora_fim ? `<div class="fm-resumo-linha"><span>Prazo diário</span><b>${e.hora_inicio || '--:--'} → ${e.hora_fim}</b></div>` : ''}`;
    }

    // A nota da natureza explica a inversão em uma frase. Sem ela, "Passiva"
    // é só uma palavra — e o hunter descobre o que ela faz só no dia seguinte.
    const nota = document.getElementById('fm-nota-natureza');
    if (nota) {
      nota.innerHTML = e.natureza === 'PASSIVA'
        ? `${this._gl('passiva', 12)} <b>Protocolo:</b> ela se acende sozinha no
           início da janela e se <b>cumpre sozinha</b> no fim. Você só age se
           <b>quebrar</b> — aí confessa, paga metade da punição e mantém a sequência.
           <i>Ex.: sem cafeína das 16:00 às 05:00.</i>`
        : `${this._gl('ativa', 12)} <b>Missão normal:</b> você precisa iniciar e
           concluir. Passar do prazo é fracasso.`;
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
      SoloDialog?.toast?.('Vitrine — nada foi salvo', 'info');
      this.fechar();
      return;
    }

    // Validações que o servidor recusaria de formas menos gentis.
    if (e.tipo === 'ROTINA' && e.frequencia === 'SEMANAL' && !e.dias_semana.length) {
      SoloDialog?.toast?.('Escolha ao menos um dia da semana.', 'error'); return;
    }
    if (e.tipo === 'ROTINA' && e.frequencia === 'MENSAL' && !(+e.dia_mes >= 1 && +e.dia_mes <= 31)) {
      SoloDialog?.toast?.('Informe o dia do mês (1 a 31).', 'error'); return;
    }
    if (e.tipo === 'ROTINA' && e.frequencia === 'ANUAL' && !e.mes_dia) {
      SoloDialog?.toast?.('Escolha a data no ano.', 'error'); return;
    }
    // A passiva sem janela seria um protocolo que dura o dia todo e se cumpre
    // sozinho à meia-noite: XP de graça, todo dia. O servidor recusa; aqui a
    // mensagem explica o porquê antes da viagem.
    if (e.tipo === 'ROTINA' && e.natureza === 'PASSIVA' && !(e.janela && e.hora_inicio && e.hora_fim)) {
      SoloDialog?.toast?.('Missão passiva precisa da janela de horário — '
                        + 'é dela que sai o protocolo (ex.: 16:00 → 05:00).', 'error');
      return;
    }

    const btn = document.querySelector('[data-fm-salvar]');
    if (btn) btn.disabled = true;
    try {
      let salvo = null;
      if (e.tipo === 'ROTINA') {
        const payload = {
          titulo: e.titulo.trim(),
          descricao: e.descricao || null,
          tipo: e.frequencia,
          dias_semana: e.frequencia === 'SEMANAL' ? e.dias_semana : null,
          dia_mes:     e.frequencia === 'MENSAL'  ? parseInt(e.dia_mes, 10) : null,
          mes_dia:     e.frequencia === 'ANUAL'   ? e.mes_dia : null,
          categoria: e.categoria,
          prioridade: e.prioridade,
          dificuldade: e.dificuldade,
          xp_recompensa: e.xp ?? calc.xp,
          moedas_recompensa: e.mc ?? calc.mc,
          penalidade_xp: (e.auto || e.pen === null) ? calc.pen : e.pen,
          hora_inicio: e.janela ? (e.hora_inicio || null) : null,
          hora_fim:    e.janela ? (e.hora_fim || null) : null,
          natureza:    e.natureza || 'ATIVA',
        };
        salvo = this._editId ? await API.rotinas.atualizar(this._editId, payload)
                             : await API.rotinas.criar(payload);
      } else {
        const payload = {
          titulo: e.titulo.trim(),
          descricao: e.descricao || null,
          data_prevista: e.data_prevista || this._dataLocal(),
          hora_limite: e.janela ? (e.hora_fim || null) : null,
          categoria: e.categoria,
          prioridade: e.prioridade,
          // A dificuldade FALTAVA aqui. Como o servidor tem `dificuldade`
          // com default "NORMAL", escolher Lendária numa missão geral não
          // dava erro nenhum: era criada e precificada como Normal enquanto
          // a prévia exibia a promessa maior. A rotina já mandava; a geral não.
          dificuldade: e.dificuldade,
          xp_recompensa: e.xp ?? calc.xp,
          moedas_recompensa: e.mc ?? calc.mc,
          penalidade_xp: (e.auto || e.pen === null) ? calc.pen : e.pen,
          // Personalizada: só o prazo viaja. A recompensa continua sendo a da
          // tabela — o servidor a recalcula e ignora qualquer outro pedido.
          prazo_minutos: e.prazo_custom
            ? Math.max(5, e.prazo_valor * e.prazo_unidade) : null,
        };
        salvo = this._editId ? await API.tarefas.atualizar(this._editId, payload)
                             : await API.tarefas.criar(payload);
      }
      SoloDialog?.toast?.(this._editId ? 'Missão reforjada!' : 'Missão forjada!', 'success');
      if (typeof SFX !== 'undefined') SFX.play('carimbo');
      this.fechar();
      if (this._aoSalvar) await this._aoSalvar(salvo);

      // NÃO recarrega a página. `App.atualizarPaginaAtual()` refazia o
      // Dashboard inteiro — personagem, stats, gráficos, extrato — para
      // mostrar UM cartão novo. A tela sumia e voltava, e a missão recém
      // criada aparecia no meio do tremor, sem se destacar.
      // Agora só o extrato é pedido de novo, e ele reconcilia: os cartões
      // que já estavam lá permanecem intactos e só o novo entra, brilhando.
      if (window.App?.currentPage === 'dashboard' && window.Dashboard?.carregarExtrato) {
        await Dashboard.carregarExtrato();
        Dashboard.atualizarNumeros?.();
      } else {
        window.App?.atualizarPaginaAtual?.();
      }
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
      if (btn) btn.disabled = false;
    }
  },
};

window.ForjaMissao = ForjaMissao;

/* ── A Forja assume os botões do app ───────────────────────────
   Esta delegação morava em pages/lancador.js (o lançador antigo). Com o
   antigo aposentado, quem responde aos botões de "nova missão" é a Forja.
   Delegação no document, uma única vez: os botões vivem em telas que são
   recriadas a cada navegação, e um listener por botão morreria com elas. */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('button, a');
  if (!btn) return;
  const id = btn.id;
  if (id === 'btn-nova-missao' || id === 'btn-nova-rotina' ||
      id === 'btn-fab' || id === 'btn-nova-rotina-dash') {
    e.preventDefault();
    ForjaMissao.abrir({ tipo: 'ROTINA' });
  } else if (id === 'btn-nova-tarefa' || id === 'btn-add-tarefa') {
    e.preventDefault();
    ForjaMissao.abrir({ tipo: 'TAREFA' });
  }
});
