/* ============================================================
   modal-auras.js — O Cofre de Auras

   POR QUE SAIU DO dashboard.js

   Eram ~150 linhas de HTML com estilo embutido linha a linha, dentro
   de uma função do painel. Quatro problemas relatados pelo Arquiteto,
   e cada um tinha causa própria:

   1. "ÀS VEZES ABRE VAZIO."
      O `fetch` do inventário estava num `catch (_) {}` mudo. Qualquer
      soluço de rede — um 401, uma resposta lenta, o servidor
      reiniciando — virava `inv = []`, e o hunter lia "Nenhuma aura no
      inventário". FALHA e AUSÊNCIA são coisas diferentes e estavam
      dizendo a mesma frase.

      Pior: o modal só nascia DEPOIS do fetch. Entre o clique e a tela
      não havia nada — nenhum sinal de que algo estava acontecendo.

   2. "A AURA DO CARGO APARECE TRAVADA, COMO SE EU FOSSE OBRIGADO."
      Ele não é. Só que `aura_id = null` significava "sem cosmética", e
      aí o Sistema desenhava a do cargo. Não existia valor para "não
      quero aura nenhuma" — três estados espremidos em dois.
      Agora existe: `Auras.SEM_AURA`, com um slot próprio.

   3. "DEMORA MUITO PARA FECHAR."
      Não era o fechar. Era o que vinha depois dele:
        · equipar reabria o modal INTEIRO, refazendo o fetch;
        · desequipar chamava `Dashboard.carregar()` — o painel todo,
          perfil, conquistas, estatísticas e extrato.
      E, por cima, um `backdrop-filter: blur(10px)` em tela cheia
      sobre um banner cheio de animação, que obriga o navegador a
      recompor a tela inteira a cada quadro.

   4. "NÃO COMBINA COM O PROJETO."
      Cantos redondos e dourado avulso, enquanto o Sistema inteiro usa
      cantos chanfrados e roxo/ciano.

   COMO ELE FUNCIONA AGORA

   Abre NA HORA, com esqueleto. O dado chega depois e preenche. Se
   falhar, diz que falhou e oferece tentar de novo — nunca finge que o
   cofre está vazio.

   Ao escolher, aplica OTIMISTA: fecha na hora, repinta o banner na
   hora, e só então conversa com o servidor. Se o servidor recusar,
   desfaz e avisa. É o oposto de segurar o hunter esperando por uma
   confirmação que quase sempre vem.
   ============================================================ */

const ModalAuras = {

  /* ── O TOKEN DO CARTÃO DE CARGO ──────────────────────────────
     Só existe dentro desta tela. Ao escolher, vira `null` — que é o
     que o backend já entende por "sem cosmética, vale a do cargo".

     Não precisou de nada novo no servidor: a aura de cargo nunca foi
     um valor a gravar, é o que sobra quando não há outro. O erro
     estava em desenhar o cartão como se ele não fosse uma escolha. */
  CARGO: '__cargo',

  _el: null,
  _dados: null,
  _aoTrocar: null,

  /* ── Abrir ────────────────────────────────────────────────
     `hunter` é o perfil que o hospedeiro já tem em mãos, e
     `aoTrocar` é o que fazer quando a escolha mudar — quem repinta
     é quem chamou, não este modal. */
  abrir(hunter, aoTrocar) {
    this.fechar();
    this._hunter = hunter || {};
    this._aoTrocar = aoTrocar || (() => {});

    const el = document.createElement('div');
    el.id = 'dash-modal-aura';           // id antigo: outros lugares o procuram
    el.className = 'ma-fundo';
    el.innerHTML = this._moldura(this._esqueleto());
    document.body.appendChild(el);
    this._el = el;

    // Fechar: clique no fundo, no X, ou Esc.
    el.addEventListener('click', e => {
      if (e.target === el || e.target.closest('[data-ma="fechar"]')) this.fechar();
    });
    this._onTecla = e => { if (e.key === 'Escape') this.fechar(); };
    document.addEventListener('keydown', this._onTecla);

    // requestAnimationFrame para a classe de entrada pegar a transição:
    // aplicar no mesmo quadro em que o nó nasce não anima.
    requestAnimationFrame(() => el.classList.add('ma-aberto'));

    this._carregar();
    return el;
  },

  fechar() {
    if (this._onTecla) {
      document.removeEventListener('keydown', this._onTecla);
      this._onTecla = null;
    }
    const el = this._el || document.getElementById('dash-modal-aura');
    if (!el) return;
    this._el = null;
    /* Sai na hora do ponto de vista do hunter: a classe some, a
       opacidade cai, e o nó é removido depois. Nada de esperar
       requisição para o modal sumir. */
    el.classList.remove('ma-aberto');
    setTimeout(() => el.remove(), 160);
  },

  /* ── O dado ───────────────────────────────────────────────── */
  async _carregar() {
    try {
      const d = await API.get('/perfil/auras-inventario');
      this._dados = d || {};
      this._pintar();
    } catch (e) {
      /* AQUI ESTAVA O BUG. Antes: `catch (_) {}` e a tela dizia que o
         inventário estava vazio. Um erro de rede não é um cofre
         vazio, e tratar os dois igual fez o Arquiteto achar que tinha
         perdido as auras. */
      this._pintarErro(e && e.message);
    }
  },

  _corpo() { return this._el && this._el.querySelector('[data-ma="corpo"]'); },

  _moldura(corpo) {
    return `
      <div class="ma-caixa" role="dialog" aria-label="Minhas Auras" aria-modal="true">
        <div class="ma-topo">
          <span class="ma-glifo">◈</span>
          <div class="ma-titulos">
            <div class="ma-titulo">Minhas Auras</div>
            <div class="ma-sub">Inventário pessoal</div>
          </div>
          <button class="ma-x" data-ma="fechar" type="button" aria-label="Fechar">✕</button>
        </div>
        <div class="ma-corpo" data-ma="corpo">${corpo}</div>
      </div>`;
  },

  /* ── Estados ──────────────────────────────────────────────── */

  /* O esqueleto existe para o modal abrir INSTANTANEAMENTE. O tempo de
     rede não some, mas deixa de ser tempo de tela em branco. */
  _esqueleto() {
    const card = '<div class="ma-card ma-fantasma"><div class="ma-palco"></div><div class="ma-nome"></div></div>';
    return `<div class="ma-grade">${card.repeat(4)}</div>`;
  },

  _pintarErro(msg) {
    const c = this._corpo();
    if (!c) return;
    c.innerHTML = `
      <div class="ma-aviso">
        <div class="ma-aviso-glifo">⚠</div>
        <div class="ma-aviso-tit">Não consegui abrir o cofre</div>
        <div class="ma-aviso-txt">${msg ? this._esc(msg) : 'O Sistema não respondeu.'}</div>
        <button class="ma-btn ma-btn-forte" data-ma="tentar" type="button">Tentar de novo</button>
      </div>`;
    c.querySelector('[data-ma="tentar"]').onclick = () => {
      c.innerHTML = this._esqueleto();
      this._carregar();
    };
  },

  _pintar() {
    const c = this._corpo();
    if (!c) return;

    const d = this._dados || {};
    const inv = (d.inventario || []).filter(a => !a.de_cargo);
    const cargo = (d.inventario || []).find(a => a.de_cargo) || null;
    const ativa = d.aura_ativa || null;
    const SEM = (window.Auras && Auras.SEM_AURA) || '__nenhuma';

    const cards = [];

    /* O SLOT VAZIO, primeiro. Mesmo formato dos outros, com a silhueta
       apagada — pedido do Arquiteto. Ele não é "cancelar": é uma
       escolha como qualquer outra, e por isso tem cartão próprio e
       fica selecionado quando é o estado corrente. */
    cards.push(this._card({
      id: SEM,
      nome: 'Sem aura',
      descricao: 'O retrato limpo, sem nenhum halo.',
      ativa: ativa === SEM,
      vazio: true,
    }));

    /* A AURA DE CARGO É ESCOLHÍVEL.

       Ela não pode ser GRAVADA — o backend recusa `aura_id:
       "arquiteto"`, e com razão: quem concede é o Sistema, e aceitar
       o valor abriria porta para alguém se dar uma aura de cargo. Mas
       daí eu havia concluído que ela também não podia ser ESCOLHIDA,
       e são coisas diferentes.

       Escolhê-la é mandar `null`: "sem cosmética". O backend já
       aceitava isso desde sempre. O que faltava era o cartão saber
       que aquele clique era possível. */
    if (cargo) {
      cards.push(this._card({
        id: this.CARGO,
        arte: cargo.id,
        nome: cargo.nome,
        descricao: cargo.descricao,
        ativa: d.cargo_ativa === true || (ativa === null),
        cargo: true,
      }));
    }

    inv.forEach(a => cards.push(this._card({
      id: a.id || a.aura_id,
      nome: a.nome,
      descricao: a.de ? `Presente de ${a.de}` : (a.descricao || ''),
      ativa: ativa === (a.id || a.aura_id),
    })));

    c.innerHTML = `<div class="ma-grade">${cards.join('')}</div>`
      + (inv.length ? '' : `
        <div class="ma-nota">
          Nenhuma aura cosmética ainda — forje uma na aba Materiais ou peça ao Arquiteto.
        </div>`);

    c.querySelectorAll('[data-aura]').forEach(n => {
      n.onclick = () => this._escolher(n.dataset.aura);
    });
  },

  _card(o) {
    const clicavel = true;          // TUDO nesta grade é uma escolha
    const arte = o.arte || o.id;
    const palco = o.vazio
      ? `<span class="ma-silhueta" aria-hidden="true">
           <svg viewBox="0 0 80 80" width="80" height="80" style="max-width:none">
             <circle cx="40" cy="40" r="26" fill="none" stroke="currentColor"
                     stroke-width="1.2" stroke-dasharray="4 5" opacity=".55"/>
             <circle cx="40" cy="40" r="15" fill="none" stroke="currentColor"
                     stroke-width="1" opacity=".3"/>
           </svg>
         </span>`
      /* 88px, e não os 112 de antes. Cada aura é um SVG com dezenas de
         camadas animadas; quatro delas em tamanho grande faziam o modal
         inteiro engasgar — e era parte do "demora para fechar". */
      : ((window.Auras && Auras.existe(arte)) ? Auras.bloco(arte, 88) : '<span class="ma-sem-arte">◈</span>');

    return `
      <div class="ma-card${o.ativa ? ' ma-ativa' : ''}${o.cargo ? ' ma-cargo' : ''}${o.vazio ? ' ma-vazia' : ''}"
           ${clicavel ? `data-aura="${this._esc(o.id)}" role="button" tabindex="0"` : ''}>
        <div class="ma-palco">
          ${palco}
          <span class="ma-recorte" aria-hidden="true"></span>
        </div>
        <div class="ma-nome">${this._esc(o.nome || o.id)}</div>
        <div class="ma-desc">${this._esc(o.descricao || '')}</div>
        ${o.cargo
            /* O cartao do cargo SEMPRE diz que e do cargo, inclusive
               quando esta vigente. Mostrar so "Equipada" apagaria a
               unica informacao que importa ali: que essa aura nao foi
               escolhida, foi concedida — e por isso nao se clica nela. */
            ? `<div class="ma-selo${o.ativa ? '' : ' ma-selo-fraco'}">${o.ativa ? 'Equipada · ' : ''}Do cargo</div>`
            : (o.ativa ? '<div class="ma-selo">Equipada</div>' : '')}
      </div>`;
  },

  /* ── Escolher ─────────────────────────────────────────────
     OTIMISTA. Fecha e repinta na hora; conversa com o servidor
     depois. Se o servidor recusar, desfaz e diz por quê.

     O caminho anterior fazia o contrário: esperava a resposta, e
     então REABRIA o modal inteiro refazendo o fetch do inventário —
     o que o Arquiteto sentiu como "demora muito para fechar". */
  async _escolher(escolha) {
    // O token de tela vira o valor do servidor. `null` = vale a do cargo.
    const id = (escolha === this.CARGO) ? null : escolha;
    const anterior = this._hunter ? (this._hunter.aura_id ?? null) : null;
    if (id === anterior) { this.fechar(); return; }

    this.fechar();
    this._aoTrocar(id);                       // repinta já

    try {
      await API.put('/perfil/aura', { aura_id: id });
    } catch (e) {
      this._aoTrocar(anterior);               // desfaz
      SoloDialog?.toast?.('Não foi possível trocar a aura: ' + (e.message || ''), 'error');
    }
  },

  _esc(s) {
    return String(s ?? '').replace(/[&<>"]/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  },
};

window.ModalAuras = ModalAuras;
