/* ============================================================
   balanca-economia.js — A Balança do Sistema

   As tabelas que decidem quanto vale cada missão vivem no banco
   (parametros_economia) e são lidas por motors/economia.py. Os
   endpoints de leitura e escrita já existiam; faltava o lugar
   onde o Arquiteto mexe neles sem abrir o console do navegador.

   O QUE ESTA TELA PRECISA FAZER BEM

   1. Não mentir sobre o efeito. Mudar "XP base — Crítica" de 120
      para 200 não altera missão nenhuma que já existe: os valores
      são carimbados na criação. A tela diz isso, porque a
      alternativa é o Arquiteto achar que quebrou o histórico.

   2. Deixar comparar antes de salvar. Cada campo alterado mostra
      o valor anterior ao lado, e nada vai ao servidor até o
      clique em Selar. Edição de economia não pode ter autosave.

   3. Mostrar o resultado, não só o número. O simulador embaixo
      usa /economia/simular — o mesmo endpoint do lançador — para
      responder "e uma rotina diária, média e normal, quanto fica?"

   Permissão: /economia/tabelas já exige Arquiteto no servidor.
   Aqui a checagem é só para não oferecer o que vai ser negado.

   Requer: css/balanca-economia.css, js/glifos.js
   ============================================================ */

const BalancaEconomia = {
  _grupos: [],
  _sujos: {},          // "grupo::chave" → valor novo
  _originais: {},      // "grupo::chave" → valor que veio do servidor
  _el: null,

  _gl(nome, tam = 14) {
    return (typeof Glifos !== 'undefined' && Glifos.existe(nome))
      ? Glifos.linha(nome, tam) : '';
  },

  _k(grupo, chave) { return grupo + '::' + chave; },

  /* Números da economia são de dois tipos e formatá-los igual confunde:
     multiplicadores e frações precisam das casas decimais (1.5, 0.15),
     XP e minutos são inteiros e ficariam ridículos como "120.00". */
  _fmt(v) {
    const n = Number(v);
    if (!isFinite(n)) return '0';
    return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  },

  async abrir() {
    try {
      const perm = await API.get('/economia/permissao');
      // A chave é `pode_balancear`, não `pode`. Eu havia lido `pode` e a tela
      // negava acesso ao próprio Arquiteto — silenciosamente, porque
      // `undefined` é falsy e não dá erro nenhum. O teste de integração pegou.
      if (!perm?.pode_balancear) {
        SoloDialog?.toast?.('Só o Arquiteto equilibra a balança.', 'warn');
        return;
      }
    } catch (_) { /* servidor decide de novo na leitura */ }

    this._sujos = {};
    this._originais = {};
    try {
      const d = await API.get('/economia/tabelas');
      this._grupos = d.grupos || [];
    } catch (err) {
      SoloDialog?.toast?.(err.message || 'Não consegui ler as tabelas', 'error');
      return;
    }
    this._grupos.forEach(g => g.itens.forEach(i => {
      this._originais[this._k(g.grupo, i.chave)] = i.valor;
    }));
    this._render();
  },

  fechar() {
    this._el?.remove();
    this._el = null;
  },

  _render() {
    this.fechar();
    const el = document.createElement('div');
    el.className = 'be-overlay';
    el.id = 'be-overlay';
    el.innerHTML = `
      <div class="be-painel" role="dialog" aria-label="Balança da Economia">
        <header class="be-topo">
          <span class="be-sigilo">${this._gl('engrenagem', 22)}</span>
          <div class="be-titulos">
            <h2>A Balança do Sistema</h2>
            <p>TABELAS QUE DECIDEM QUANTO VALE CADA MISSÃO · SÓ O ARQUITETO EDITA</p>
          </div>
          <button class="be-x" data-be-fechar aria-label="Fechar">${this._gl('cancelada', 15)}</button>
        </header>

        <div class="be-aviso">
          ${this._gl('olho', 13)}
          <span>Mudar um valor <b>não reescreve o passado</b>. A recompensa é
          carimbada na missão quando ela é criada — as que já existem seguem
          valendo o que valiam. A nova tabela manda da próxima criação em diante.</span>
        </div>

        <div class="be-corpo">${this._grupos.map(g => this._grupo(g)).join('')}</div>

        ${this._simulador()}

        <footer class="be-rodape">
          <button class="be-btn be-btn-fantasma" data-be-restaurar>
            ${this._gl('ampulheta', 13)} Restaurar semente
          </button>
          <span class="be-contagem" data-be-contagem>Nada alterado</span>
          <button class="be-btn be-btn-fantasma" data-be-fechar>Fechar</button>
          <button class="be-btn be-btn-selar" data-be-salvar disabled>
            ${this._gl('concluida', 13)} Selar alterações
          </button>
        </footer>
      </div>`;

    el.addEventListener('click', e => { if (e.target === el) this.fechar(); });
    document.body.appendChild(el);
    this._el = el;
    this._ligar();
    this._simular();
  },

  _grupo(g) {
    return `
      <section class="be-grupo">
        <h3 class="be-grupo-tit">${g.titulo}</h3>
        <div class="be-grade">
          ${g.itens.map(i => `
            <label class="be-linha" data-be-linha="${this._k(g.grupo, i.chave)}">
              <span class="be-rot">${i.rotulo}</span>
              <input class="be-input" type="number" step="any"
                     data-be-grupo="${g.grupo}" data-be-chave="${i.chave}"
                     value="${this._fmt(i.valor)}">
              <span class="be-antes" data-be-antes></span>
            </label>`).join('')}
        </div>
      </section>`;
  },

  /* O simulador responde a pergunta que a grade sozinha não responde:
     "e no fim das contas, quanto vale?" Ele chama o MESMO endpoint que o
     lançador usa, então o que aparece aqui é o que o hunter vai receber. */
  _simulador() {
    const op = (v, r) => `<option value="${v}">${r}</option>`;
    return `
      <section class="be-sim">
        <h3 class="be-grupo-tit">${this._gl('bigorna', 14)} Provar a mistura</h3>
        <div class="be-sim-campos">
          <label>Tipo
            <select data-be-sim="tipo">
              ${op('DIARIA','Diária')}${op('SEMANAL','Semanal')}
              ${op('MENSAL','Mensal')}${op('ANUAL','Anual')}${op('AVULSA','Avulsa')}
            </select>
          </label>
          <label>Prioridade
            <select data-be-sim="prioridade">
              ${op('CRITICA','Crítica')}${op('ALTA','Alta')}
              ${op('MEDIA','Média')}${op('BAIXA','Baixa')}
            </select>
          </label>
          <label>Dificuldade
            <select data-be-sim="dificuldade">
              ${op('FACIL','Fácil')}${op('NORMAL','Normal')}
              ${op('DIFICIL','Difícil')}${op('LENDARIO','Lendária')}
            </select>
          </label>
        </div>
        <div class="be-sim-saida" data-be-sim-saida>
          <span class="be-pill">XP <b data-be-sim-xp>—</b></span>
          <span class="be-pill">Mana <b data-be-sim-mc>—</b></span>
          <span class="be-pill be-pill-perda">Punição <b data-be-sim-pen>—</b></span>
          <span class="be-pill">Prazo <b data-be-sim-prazo>—</b></span>
        </div>
        <p class="be-sim-nota">Valores do servidor, pela tabela <b>já salva</b>.
          Sele as alterações para vê-las aqui.</p>
      </section>`;
  },

  _ligar() {
    const el = this._el;

    el.querySelectorAll('[data-be-fechar]').forEach(b =>
      b.addEventListener('click', () => this.fechar()));

    el.addEventListener('input', e => {
      const inp = e.target.closest('.be-input');
      if (inp) return this._mudou(inp);
      if (e.target.closest('[data-be-sim]')) this._simular();
    });
    el.addEventListener('change', e => {
      if (e.target.closest('[data-be-sim]')) this._simular();
    });

    el.querySelector('[data-be-salvar]')?.addEventListener('click', () => this._salvar());
    el.querySelector('[data-be-restaurar]')?.addEventListener('click', () => this._restaurar());
  },

  _mudou(inp) {
    const grupo = inp.dataset.beGrupo, chave = inp.dataset.beChave;
    const k = this._k(grupo, chave);
    const antes = this._originais[k];
    const agora = parseFloat(inp.value);

    const linha = inp.closest('.be-linha');
    const selo = linha?.querySelector('[data-be-antes]');

    if (!isFinite(agora) || agora === antes) {
      delete this._sujos[k];
      linha?.classList.remove('sujo');
      if (selo) selo.textContent = '';
    } else {
      this._sujos[k] = { grupo, chave, valor: agora };
      linha?.classList.add('sujo');
      // Mostrar o valor ANTERIOR ao lado é o que permite desfazer de cabeça:
      // sem isso, o Arquiteto que digitou 2000 por engano não tem como saber
      // que era 120 sem recarregar a tela e perder o resto das alterações.
      if (selo) selo.textContent = 'era ' + this._fmt(antes);
    }
    this._contar();
  },

  _contar() {
    const n = Object.keys(this._sujos).length;
    const c = this._el?.querySelector('[data-be-contagem]');
    const b = this._el?.querySelector('[data-be-salvar]');
    if (c) c.textContent = n ? `${n} valor(es) alterado(s)` : 'Nada alterado';
    if (b) b.disabled = n === 0;
  },

  async _salvar() {
    const itens = Object.values(this._sujos);
    if (!itens.length) return;
    const btn = this._el.querySelector('[data-be-salvar]');
    btn.disabled = true;
    try {
      const r = await API.put('/economia/tabelas', { itens });
      SoloDialog?.toast?.(`Balança selada: ${r.alterados} valor(es).`, 'success');
      await this.abrir();          // relê do servidor: a verdade é a dele
    } catch (err) {
      SoloDialog?.toast?.(err.message || 'Falha ao salvar', 'error');
      btn.disabled = false;
    }
  },

  async _restaurar() {
    // Destrutivo: confirma. `SoloDialog` é const de topo, não vive em window —
    // e sem diálogo disponível a resposta é NÃO, nunca "prossiga assim mesmo".
    const ok = (typeof SoloDialog !== 'undefined' && SoloDialog.confirmar)
      ? await SoloDialog.confirmar({
          titulo: 'Restaurar a semente?',
          texto: 'Todos os valores voltam ao que o código traz de fábrica. '
               + 'As missões já criadas não mudam — só as próximas.',
          confirmar: 'Restaurar tudo',
          cancelar: 'Cancelar',
        })
      : false;
    if (!ok) return;
    try {
      await API.post('/economia/restaurar', {});
      SoloDialog?.toast?.('Balança restaurada à semente.', 'success');
      await this.abrir();
    } catch (err) {
      SoloDialog?.toast?.(err.message || 'Falha ao restaurar', 'error');
    }
  },

  async _simular() {
    const el = this._el;
    if (!el) return;
    const v = s => el.querySelector(`[data-be-sim="${s}"]`)?.value || '';
    try {
      const q = new URLSearchParams({
        tipo: v('tipo'), prioridade: v('prioridade'), dificuldade: v('dificuldade'),
      });
      const r = await API.get('/economia/simular?' + q.toString());
      const put = (sel, val) => {
        const n = el.querySelector(sel);
        if (n) n.textContent = val;
      };
      put('[data-be-sim-xp]',  r.xp_recompensa ?? '—');
      put('[data-be-sim-mc]',  r.moedas_recompensa ?? '—');
      put('[data-be-sim-pen]', r.penalidade_xp ?? '—');
      put('[data-be-sim-prazo]', this._prazo(r.prazo_minutos));
    } catch (_) { /* simulação é conforto, não pode derrubar a tela */ }
  },

  _prazo(min) {
    if (!min && min !== 0) return '—';
    if (min < 60) return min + ' min';
    if (min < 1440) {
      const h = Math.floor(min / 60), m = min % 60;
      return m ? `${h}h ${m}min` : `${h}h`;
    }
    const d = Math.round(min / 1440);
    return d + (d === 1 ? ' dia' : ' dias');
  },
};

window.BalancaEconomia = BalancaEconomia;
