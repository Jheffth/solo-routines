/* ============================================================
   badge-card.js — O Pergaminho da Relíquia

   Substitui o `title=""` do navegador, que mostrava uma caixinha
   cinza do sistema operacional em cima de uma medalha forjada.

   Um card só, vivendo no <body>, reaproveitado por todas as
   badges da página. Motivo: são dezenas de relíquias em tela; um
   card por medalha seria desperdício de DOM e de memória.

   Vive no <body> e não dentro do elemento também por outro
   motivo já aprendido aqui: a placa do cabeçalho e outros
   contêineres usam clip-path, que RECORTA qualquer coisa que
   passe da borda. Ancorado no body, o card escapa disso.

   Uso:
       BadgeCard.ligar(elemento, dados)
   onde `dados` é o que você tiver — o card desenha o que existe
   e omite o resto. Numa vitrine pública, por exemplo, não há
   xp_bonus, e a linha simplesmente não aparece.
   ============================================================ */

const BadgeCard = {
  _el: null,
  _alvo: null,
  _timer: null,
  _ATRASO: 260,          // ms — evita o card piscando ao varrer o mouse

  _RARIDADE: {
    lendaria: { nome: 'Lendária', cor: '#fbbf24' },
    epica:    { nome: 'Épica',    cor: '#a855f7' },
    rara:     { nome: 'Rara',     cor: '#38bdf8' },
    comum:    { nome: 'Comum',    cor: '#94a3b8' },
  },

  /* Mesmos cortes do perfil e do backend. */
  _faixa(d) {
    if (d.raridade) return d.raridade;
    const xp = d.xp_bonus || 0;
    if (xp >= 2000) return 'lendaria';
    if (xp >= 500)  return 'epica';
    if (xp >= 200)  return 'rara';
    return 'comum';
  },

  /* ── As citações ──────────────────────────────────────────────────
     Ficam aqui, no frontend, de propósito: são texto de sabor e mudam
     muito mais que o resto. Se um dia cada emblema precisar carregar a
     própria frase, isso vira uma coluna e este mapa some. */
  _CITACOES: {
    jh3ffth:        'Ergueu o Sistema do nada. Onde havia vazio, hoje há Portão.',
    solo:           'Nem toda ordem nasce da luz. Algumas se forjam sozinhas, no escuro.',
    mono_evelynn:   'O que ela abraça, não solta. O que ela marca, não esquece.',
    diana:          'A foice não corta o inimigo. Corta a hesitação.',
    dominio_forja:  'Criar é a única forma de poder que ninguém pode tirar de você.',
    dominio_habilidades: 'Três mentes, um martelo. O Sistema aprendeu a se construir.',
    arquiteto_supremo:   'Antes da primeira missão, houve alguém que decidiu que haveria uma.',
    pioneiro:       'Chegou quando ainda era só promessa. Ficou para ver virar verdade.',
    aliado:         'Convocado não por mérito, mas por confiança — que é mais raro.',
    chamado_arquiteto: 'Você não encontrou o Sistema. O Sistema chamou por você.',
    'nexus-social': 'Conectou hunters. Forjou a rede — o lugar onde a solidao dos caçadores tem um fim.',
    'isabella':     'A primeira a chegar com graça. Onde ela olha, o Sistema se lembra de ser belo.',
  },
  _PADRAO: {
    lendaria: 'Poucos a carregam. Menos ainda sabem o que ela custou.',
    epica:    'Não se conquista por acaso. Só por insistência.',
    rara:     'A prova de que houve esforço onde poderia ter havido desistência.',
    comum:    'Todo caminho longo começa por uma dessas.',
  },

  _citacao(d) {
    return this._CITACOES[d.codigo] || this._PADRAO[this._faixa(d)] || '';
  },

  _garantir() {
    if (this._el) return;
    const el = document.createElement('div');
    el.className = 'bc-card';
    el.setAttribute('role', 'tooltip');
    el.hidden = true;
    document.body.appendChild(el);
    this._el = el;

    // Some junto se a página rolar ou a janela mudar de tamanho
    const fechar = () => this.esconder();
    window.addEventListener('scroll', fechar, true);
    window.addEventListener('resize', fechar);
    el.addEventListener('mouseenter', () => clearTimeout(this._timer));
    el.addEventListener('mouseleave', () => this.esconder());
  },

  /* Liga um elemento ao card. Remove o title para o tooltip do
     navegador não aparecer POR CIMA do nosso. */
  ligar(elemento, dados) {
    if (!elemento || !dados) return;
    this._garantir();
    elemento.removeAttribute('title');
    elemento.setAttribute('aria-label',
      `${dados.titulo || ''}${dados.descricao ? ' — ' + dados.descricao : ''}`);
    if (!elemento.hasAttribute('tabindex')) elemento.setAttribute('tabindex', '0');

    const abrir = () => {
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this.mostrar(elemento, dados), this._ATRASO);
    };
    const fechar = () => { clearTimeout(this._timer); this._timer = setTimeout(() => this.esconder(), 120); };

    elemento.addEventListener('mouseenter', abrir);
    elemento.addEventListener('mouseleave', fechar);
    elemento.addEventListener('focus', () => this.mostrar(elemento, dados));
    elemento.addEventListener('blur', fechar);
  },

  /* Atalho: liga vários de uma vez a partir de uma lista de dados. */
  ligarTodos(seletor, lista, chave = 'codigo') {
    const mapa = {};
    (lista || []).forEach(d => { mapa[d[chave]] = d; });
    document.querySelectorAll(seletor).forEach(el => {
      const d = mapa[el.dataset.bc];
      if (d) this.ligar(el, d);
    });
  },

  _medalha(d, tam = 118) {
    return (typeof ConquistaFX !== 'undefined' && ConquistaFX.miniMedalha)
      ? ConquistaFX.miniMedalha(d, tam)
      : `<span style="font-size:${tam * .5}px">${d.icone || '🏆'}</span>`;
  },

  mostrar(alvo, d) {
    this._garantir();
    this._alvo = alvo;
    const f = this._faixa(d);
    const rar = this._RARIDADE[f] || this._RARIDADE.comum;
    const dt = s => s ? new Date(s).toLocaleDateString('pt-BR') : null;
    const quando = dt(d.desbloqueada_em || d.em || d.recebido_em);

    const stats = [];
    if (d.xp_bonus)     stats.push(['✨', `+${Number(d.xp_bonus).toLocaleString('pt-BR')}`, 'XP']);
    if (d.moedas_bonus) stats.push(['🪙', `+${Number(d.moedas_bonus).toLocaleString('pt-BR')}`, 'Moedas']);
    if (quando)         stats.push(['📅', quando, 'Obtida']);

    const origem = d.veio_de ? `Recebida de ${d.veio_de}`
      : (d.de_missao === false ? 'Emblema personalizado'
      : (d.de_missao === true ? 'Conquistada em missão' : null));

    this._el.style.setProperty('--bc-cor', rar.cor);
    this._el.innerHTML = `
      <div class="bc-topo">
        <div class="bc-medalha">${this._medalha(d)}</div>
        <div class="bc-id">
          <div class="bc-selo">${rar.nome}</div>
          <div class="bc-titulo">${d.titulo || ''}</div>
          ${d.descricao ? `<div class="bc-desc">${d.descricao}</div>` : ''}
        </div>
      </div>

      <blockquote class="bc-citacao">${this._citacao(d)}</blockquote>

      ${stats.length ? `<div class="bc-stats">
        ${stats.map(([i, v, k]) => `
          <div class="bc-stat">
            <span class="bc-stat-ico">${i}</span>
            <span class="bc-stat-v">${v}</span>
            <span class="bc-stat-k">${k}</span>
          </div>`).join('')}
      </div>` : ''}

      ${origem ? `<div class="bc-origem">${origem}</div>` : ''}`;

    this._el.hidden = false;
    this._posicionar(alvo);
  },

  _posicionar(alvo) {
    const c = this._el, r = alvo.getBoundingClientRect();
    const cr = c.getBoundingClientRect();
    const margem = 12;

    // Prefere abrir ABAIXO; se não couber, abre acima.
    let topo = r.bottom + 10;
    if (topo + cr.height > window.innerHeight - margem) {
      topo = Math.max(margem, r.top - cr.height - 10);
    }
    let esq = r.left + r.width / 2 - cr.width / 2;
    esq = Math.max(margem, Math.min(esq, window.innerWidth - cr.width - margem));

    c.style.top  = `${topo}px`;
    c.style.left = `${esq}px`;
  },

  esconder() {
    clearTimeout(this._timer);
    if (this._el) { this._el.hidden = true; this._el.innerHTML = ''; }
    this._alvo = null;
  },
};

window.BadgeCard = BadgeCard;
