/* ============================================================
   pacto.js — O PACTO

   ESTA PÁGINA É SÓ O CARDÁPIO.

   A primeira versão listava aqui as dívidas em aberto e as já
   quitadas. O Arquiteto cortou, e a correção é de ARQUITETURA:

     "a área do pacto é só um container, onde os pactos estarão
      visíveis, é igual à aba das rotinas. Quando necessários eles vão
      para o dashboard. Os pactos concluídos são visíveis no dashboard,
      em cinza, NUNCA AQUI."

   É a mesma separação que este app já faz e que o Extrato existe para
   sustentar:

     ROTINA      é a REGRA        → vive na aba Rotinas
     ExecucaoDia é a OCORRÊNCIA   → vive no Dashboard

     PACTO       é a REGRA        → vive aqui
     PENITÊNCIA  é a OCORRÊNCIA   → vive no Dashboard

   Eu tinha posto ocorrência na página de regra — exatamente a confusão
   que o cabeçalho de `extrato.py` documenta como o defeito original do
   projeto. A lição não é sobre esta tela: é que quando uma página nova
   se parece com uma que já existe, o certo é copiar a ESTRUTURA dela,
   não só o visual.
   ============================================================ */

const Pacto = {
  _itens: [],
  _pendentes: 0,
  _ligado: false,

  async carregar() {
    this._ligar();
    try {
      /* UMA leitura só. A contagem de dívidas vem junto do `/pactos`
         porque ela alimenta o SELO DO MENU e o aviso — não uma lista.
         Buscar as penitências aqui seria buscar dado que esta página
         não tem o direito de mostrar. */
      const pac = await API.get('/pactos');
      this._itens     = pac?.itens || [];
      this._pendentes = pac?.pendentes || 0;
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
      return;
    }
    this._pintar();
    this.atualizarBadge(this._pendentes);
  },

  /* O selo no menu. Ele existe para a dívida ser lembrada mesmo com o
     hunter em outra tela — é o único lugar do app onde um número no
     menu significa "você deve", e não "há novidade". */
  atualizarBadge(n) {
    const el = document.getElementById('nav-pacto-badge');
    if (!el) return;
    el.textContent = n;
    el.classList.toggle('hidden', !n);
  },

  _pintar() {
    this._pintarAviso();
    this._pintarCardapio();
  },

  /* ── O AVISO ──────────────────────────────────────────────

     Um PONTEIRO, não uma lista. A aba Rotinas faz exatamente isto —
     ela tem um botão "Ver missões de hoje →" e não desenha missão
     nenhuma. A dívida mora no Dashboard; aqui ela só é lembrada.

     Some quando não há dívida: um aviso permanente vira paisagem, e o
     silêncio é a informação certa quando não se deve nada. */
  _pintarAviso() {
    const el = document.getElementById('pacto-aviso');
    if (!el) return;
    if (!this._pendentes) { el.innerHTML = ''; return; }
    el.innerHTML = `
      <div class="pct-aviso">
        <span class="pct-aviso-n">${this._pendentes}</span>
        <span class="pct-aviso-txt">
          ${this._pendentes === 1 ? 'dívida em aberto' : 'dívidas em aberto'}
          — o Sistema já cobrou.
        </span>
        <button class="btn btn-sm" id="btn-pacto-dash">Ver no Dashboard →</button>
      </div>`;
  },

  /* ── O CARDÁPIO ───────────────────────────────────────────
     Cada linha mostra o valor CORRENTE, não a base — é ele que vai
     cair. Mostrar a base esconderia justamente o escalonamento, que é
     o que dá medo. */
  _pintarCardapio() {
    const el = document.getElementById('pacto-lista');
    if (!el) return;

    if (!this._itens.length) {
      el.innerHTML = `<div class="pct-vazio">
        ${this._gl('ampulheta', 15)}
        <div>
          <b>O Sistema não tem com que cobrar.</b>
          <span>Adote do catálogo ou escreva a sua — leva um toque.</span>
        </div>
      </div>`;
      return;
    }

    el.innerHTML = this._itens.map(p => {
      const noTeto = p.valor_atual >= p.teto;
      const pct = Math.min(100, Math.round((p.valor_atual / Math.max(1, p.teto)) * 100));
      return `
      <div class="pct-item" data-pct-id="${p.id}">
        <div class="pct-item-topo">
          <span class="pct-tipo pct-tipo-${(p.tipo || '').toLowerCase()}">${this._rotuloTipo(p.tipo)}</span>
          ${p.vezes_caiu ? `<span class="pct-caiu" title="Quantas vezes esta penitência já foi cobrada">
            caiu ${p.vezes_caiu}×</span>` : ''}
        </div>
        <div class="pct-item-titulo">${this._esc(p.exemplo)}</div>
        <div class="pct-escala">
          <div class="pct-escala-calha"><i style="width:${pct}%"></i></div>
          <span class="pct-escala-txt ${noTeto ? 'no-teto' : ''}">
            ${p.base} → <b>${p.valor_atual}</b> → ${p.teto}${noTeto ? ' · no teto' : ''}
          </span>
        </div>
        <div class="pct-item-acoes">
          <button class="btn btn-sm" data-pct-editar="${p.id}">Editar</button>
          <button class="btn btn-sm btn-perigo" data-pct-remover="${p.id}">Tirar do pacto</button>
        </div>
      </div>`;
    }).join('');
  },

  _rotuloTipo(t) {
    return ({
      QUANTITATIVA: 'contar',
      RESTRITIVA:   'aguentar',
      TEMPORAL:     'cronometrar',
      TRIBUTO:      'pagar',
    })[t] || 'contar';
  },

  /* ── O CATÁLOGO ───────────────────────────────────────────
     Adotar é UM TOQUE. Foi a resposta à objeção do Arquiteto sobre
     burocracia: escrever do zero é trabalho, e um pacto vazio nunca
     coloca o recurso de pé. */
  async abrirCatalogo() {
    let cat;
    try { cat = await API.get('/pactos/catalogo'); }
    catch (err) { SoloDialog?.toast?.(err.message, 'error'); return; }

    const jaTenho = new Set(this._itens.map(i => i.origem_chave).filter(Boolean));
    const porGrupo = {};
    (cat.itens || []).forEach(i => (porGrupo[i.grupo] ||= []).push(i));

    const corpo = (cat.grupos || []).map(g => `
      <div class="pcat-grupo">
        <div class="pcat-grupo-nome">${this._esc(g)}</div>
        ${(porGrupo[g] || []).map(i => `
          <label class="pcat-item ${jaTenho.has(i.chave) ? 'tenho' : ''}">
            <input type="checkbox" value="${i.chave}"
                   ${jaTenho.has(i.chave) ? 'disabled checked' : ''}>
            <span class="pcat-txt">${this._esc(i.exemplo)}</span>
            <span class="pcat-esc">×2 até ${i.teto}</span>
          </label>`).join('')}
      </div>`).join('');

    const escolhidas = await this._modal('Adotar do catálogo', `
      <p class="pcat-nota">O Sistema sorteia entre as que você adotar.
      Marque quantas quiser — quanto mais, menos previsível.</p>
      <div class="pcat-lista">${corpo}</div>`);
    if (!escolhidas) return;

    const chaves = [...escolhidas.querySelectorAll('input:checked:not(:disabled)')]
      .map(i => i.value);
    if (!chaves.length) return;
    try {
      const r = await API.post('/pactos/adotar', { chaves });
      SoloDialog?.toast?.(`${(r.adotados || []).length} penitência(s) no pacto.`, 'success');
      await this.carregar();
    } catch (err) { SoloDialog?.toast?.(err.message, 'error'); }
  },

  /* A CRIAÇÃO E A EDIÇÃO MORAM NA FORJA.

     Havia aqui um formulário próprio, num modal improvisado sobre o
     SoloDialog: quatro campos, sem prévia, sem a escada de escalação.
     Ele existia porque a Forja ainda não conhecia o Pacto.

     Agora conhece. Duas telas para criar a mesma coisa é a receita de
     uma delas envelhecer sozinha — e seria a daqui, que ninguém mais
     abriria depois de conhecer a outra. Este método virou uma porta
     para lá.

     O fallback existe porque a página do Pacto pode ser aberta antes do
     forja-missao.js, e um botão que não faz nada é pior que um aviso. */
  async editar(existente) {
    if (!window.ForjaMissao?.abrir) {
      SoloDialog?.toast?.('A Forja não está disponível nesta tela.', 'error');
      return;
    }
    ForjaMissao.abrir({
      tipo: 'PACTO',
      edicao: existente || null,
      aoSalvar: () => this.carregar(),
    });
  },

  async remover(id) {
    const p = this._itens.find(x => x.id === id);
    /* A CONFIRMAÇÃO DIZ O QUE NÃO ACONTECE. Tirar do cardápio não
       apaga o que já foi cobrado — e sem dizer isso, o hunter esvazia
       o pacto achando que zerou o passado. */
    const ok = await SoloDialog?.confirm?.(
      `Tirar "${p?.exemplo || ''}" do pacto?\n\n` +
      `As penitências que ela JÁ gerou continuam em aberto — o cardápio ` +
      `muda, a dívida não.`);
    if (!ok) return;
    try {
      await API.delete('/pactos/' + id);
      await this.carregar();
    } catch (err) { SoloDialog?.toast?.(err.message, 'error'); }
  },

  /* ── Plumbing ─────────────────────────────────────────── */
  _ligar() {
    if (this._ligado) return;
    this._ligado = true;
    document.getElementById('btn-pacto-catalogo')
      ?.addEventListener('click', () => this.abrirCatalogo());
    /* SEM listener no #btn-pacto-novo.
       Quem responde a esse botão agora é a ForjaMissao, por delegação
       global (fim de js/forja-missao.js). Manter este aqui abriria as
       DUAS telas no mesmo clique — o modal antigo por cima da Forja. */
    document.getElementById('pacto-aviso')?.addEventListener('click', ev => {
      // `App.navigate`, e nao `navegarPara`. O optional-chaining teria
      // engolido o nome errado em silencio — o botao simplesmente nao
      // faria nada, e ninguem saberia por que.
      if (ev.target.closest('#btn-pacto-dash')) App?.navigate?.('dashboard');
    });
    document.getElementById('pacto-lista')?.addEventListener('click', ev => {
      const ed = ev.target.closest('[data-pct-editar]');
      if (ed) { this.editar(this._itens.find(x => x.id === +ed.dataset.pctEditar)); return; }
      const rm = ev.target.closest('[data-pct-remover]');
      if (rm) this.remover(+rm.dataset.pctRemover);
    });
  },

  /* Um modal simples sobre o SoloDialog, que não tem formulário
     próprio. Devolve o elemento do form, ou null se cancelou. */
  _modal(titulo, html) {
    return new Promise(resolve => {
      const bd = document.createElement('div');
      bd.className = 'pct-modal-bd';
      bd.innerHTML = `
        <div class="pct-modal">
          <h3>${this._esc(titulo)}</h3>
          <form class="pct-form">${html}</form>
          <div class="pct-modal-acoes">
            <button class="btn" data-x>Cancelar</button>
            <button class="btn btn-primary" data-ok>Confirmar</button>
          </div>
        </div>`;
      document.body.appendChild(bd);
      const fim = valor => { bd.remove(); document.removeEventListener('keydown', onKey); resolve(valor); };
      const onKey = e => { if (e.key === 'Escape') fim(null); };
      document.addEventListener('keydown', onKey);
      bd.addEventListener('click', e => {
        if (e.target === bd || e.target.closest('[data-x]')) return fim(null);
        if (e.target.closest('[data-ok]')) return fim(bd.querySelector('.pct-form'));
      });
      setTimeout(() => bd.querySelector('input,select')?.focus(), 60);
    });
  },

  _gl(n, t) { return (typeof Glifos !== 'undefined') ? Glifos.linha(n, t) : ''; },
  _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  },
};

if (typeof window !== 'undefined') window.Pacto = Pacto;
