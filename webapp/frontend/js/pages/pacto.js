/* ============================================================
   pacto.js — O PACTO

   O lugar reservado da punição. O Arquiteto pediu "tal como as rotinas
   já possuem", e a distinção que justifica a tela é esta:

     no EXTRATO   a penitência existe para INCOMODAR — topo da lista,
                  giroflex, cronômetro correndo
     aqui         ela existe para ser CONSULTADA

   E a tela responde a pergunta que o Extrato não responde: **quanto eu
   já paguei?** Sem ela, a penitência é só cobrança; com ela, vira
   registro — que é a diferença entre um app que julga e um que anota.

   Duas metades, nesta ordem:
     1. AS DÍVIDAS   o que o Sistema cobra agora
     2. O CARDÁPIO   o que ele usa para cobrar

   A ordem não é arbitrária: quem abre esta tela abre por causa da
   dívida, não do cardápio.
   ============================================================ */

const Pacto = {
  _itens: [],
  _abertas: [],
  _quitadas: [],
  _resumo: {},
  _ligado: false,

  async carregar() {
    this._ligar();
    try {
      const [pac, pen] = await Promise.all([
        API.get('/pactos'),
        API.get('/pactos/penitencias'),
      ]);
      this._itens    = pac?.itens || [];
      this._abertas  = pen?.abertas || [];
      this._quitadas = pen?.quitadas || [];
      this._resumo   = pen?.resumo || {};
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
      return;
    }
    this._pintar();
    this.atualizarBadge(this._resumo.em_aberto || 0);
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
    this._pintarResumo();
    this._pintarAbertas();
    this._pintarCardapio();
    this._pintarQuitadas();
  },

  /* ── O RESUMO ─────────────────────────────────────────────
     Quatro números, e o último é de propósito uma boa notícia: uma
     tela de punição que só sabe cobrar vira uma tela que ninguém abre. */
  _pintarResumo() {
    const el = document.getElementById('pacto-resumo');
    if (!el) return;
    const r = this._resumo;
    const noTeto = (r.em_aberto || 0) >= (r.divida_teto || 4);
    const bloco = (valor, rotulo, classe = '') =>
      `<div class="pct-num ${classe}">
         <b>${valor}</b><span>${rotulo}</span>
       </div>`;
    el.innerHTML =
      bloco(r.em_aberto || 0, 'em aberto', (r.em_aberto ? 'devendo' : '')) +
      bloco(r.quitadas || 0, 'quitadas') +
      bloco(this._itens.length, 'no cardápio') +
      bloco('+' + (r.xp_reparado || 0), 'XP recuperado', 'bom') +
      (noTeto
        ? `<div class="pct-teto">O Sistema parou de contar. Resolva o que já existe.</div>`
        : '');
  },

  _pintarAbertas() {
    const el = document.getElementById('pacto-abertas');
    const tit = document.getElementById('pct-titulo-abertas');
    if (!el) return;
    if (tit) tit.textContent = this._abertas.length
      ? `Dívidas em aberto (${this._abertas.length})`
      : 'Dívidas em aberto';

    if (!this._abertas.length) {
      el.innerHTML = `<div class="pct-vazio pct-vazio-bom">
        ${this._gl('concluida', 15)} Nada em aberto. O Sistema não tem o que cobrar.
      </div>`;
      return;
    }
    /* O MESMO CARTÃO do Extrato. Um segundo desenho para a penitência
       seria a mesma armadilha do `_repeticao`: duas telas que divergem
       no primeiro ajuste. */
    MissaoCard.cachear(this._abertas);
    el.innerHTML = this._abertas.map(m => MissaoCard.html(m)).join('');
    MissaoCard.montar(el, { onMudou: () => this.carregar() });
  },

  _pintarQuitadas() {
    const el = document.getElementById('pacto-quitadas');
    const sec = document.getElementById('pct-secao-quitadas');
    if (!el) return;
    if (sec) sec.classList.toggle('hidden', !this._quitadas.length);
    if (!this._quitadas.length) return;

    MissaoCard.cachear(this._quitadas);
    el.innerHTML = this._quitadas.map(m => MissaoCard.html(m, { compacto: true })).join('');
    MissaoCard.montar(el, {});
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

  async novaPenitencia(existente) {
    const p = existente || {};
    const form = await this._modal(existente ? 'Editar penitência' : 'Nova penitência', `
      <label class="pct-campo">
        <span>O que você deve</span>
        <input class="input" name="titulo" maxlength="160"
               placeholder="Fazer {n} flexões"
               value="${this._esc(p.titulo || '')}">
        <small>Use <code>{n}</code> onde entra o número. Sem ele, a
        penitência não escala.</small>
      </label>
      <label class="pct-campo">
        <span>Como se cumpre</span>
        <select class="input" name="tipo">
          <option value="QUANTITATIVA" ${p.tipo === 'QUANTITATIVA' ? 'selected' : ''}>contar — aperto + a cada vez</option>
          <option value="RESTRITIVA"   ${p.tipo === 'RESTRITIVA' ? 'selected' : ''}>aguentar — X horas sem algo</option>
          <option value="TEMPORAL"     ${p.tipo === 'TEMPORAL' ? 'selected' : ''}>cronometrar — X minutos de algo</option>
          <option value="TRIBUTO"      ${p.tipo === 'TRIBUTO' ? 'selected' : ''}>pagar — o Sistema cobra em Mana</option>
        </select>
      </label>
      <div class="pct-dupla">
        <label class="pct-campo">
          <span>Começa em</span>
          <input class="input" name="base" type="number" min="1" value="${p.base || 1}">
        </label>
        <label class="pct-campo">
          <span>Teto</span>
          <input class="input" name="teto" type="number" min="1" value="${p.teto || 32}">
        </label>
      </div>
      <p class="pct-nota">Ela dobra a cada vez que cai, até o teto — e
      recua um degrau a cada semana limpa.</p>`);
    if (!form) return;

    const dados = {
      titulo: form.querySelector('[name=titulo]').value.trim(),
      tipo:   form.querySelector('[name=tipo]').value,
      base:   parseInt(form.querySelector('[name=base]').value, 10) || 1,
      teto:   parseInt(form.querySelector('[name=teto]').value, 10) || 32,
    };
    if (!dados.titulo) { SoloDialog?.toast?.('Escreva o que você deve.', 'error'); return; }
    try {
      if (existente) await API.patch('/pactos/' + existente.id, dados);
      else           await API.post('/pactos', dados);
      await this.carregar();
    } catch (err) { SoloDialog?.toast?.(err.message, 'error'); }
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
    document.getElementById('btn-pacto-novo')
      ?.addEventListener('click', () => this.novaPenitencia());
    document.getElementById('pacto-lista')?.addEventListener('click', ev => {
      const ed = ev.target.closest('[data-pct-editar]');
      if (ed) { this.novaPenitencia(this._itens.find(x => x.id === +ed.dataset.pctEditar)); return; }
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
