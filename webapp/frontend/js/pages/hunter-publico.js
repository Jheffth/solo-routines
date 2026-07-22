/* ============================================================
   hunter-publico.js — A vitrine de um hunter

   Primeira versão, feita para crescer: o cabeçalho, os números e
   o relicário são blocos independentes, então dá para acrescentar
   histórico, dungeons ou comparação lado a lado sem remexer no
   que já existe.

   As relíquias usam o mesmo renderizador da Cerimônia — medalha
   forjada, nunca emoji.
   ============================================================ */

const HunterPublico = {
  _dados: null,
  _voltarPara: 'dashboard',

  /* Mesma tabela do dashboard: a cor do rank é a identidade do hunter.
     Ela não pinta só um selo — cascateia por --rank-cor e tinge o cartão
     inteiro, a aura, a barra de XP e o brilho das relíquias. É o que faz
     visitar um E-Rank e um S-Rank parecerem dois lugares diferentes. */
  _RANK_CORES: {
    'E': '#94a3b8', 'D': '#22d3ee', 'C': '#10b981',
    'B': '#3b82f6', 'A': '#a855f7', 'S': '#fbbf24', 'N': '#fb7185',
  },

  _letraRank(classe) {
    const c = (classe || 'E-Rank').toUpperCase();
    if (c.includes('NATIONAL')) return 'N';
    const m = c.match(/\b([EDCBAS])\b|^([EDCBAS])-/);
    return (m && (m[1] || m[2])) || 'E';
  },

  /* ── Presença ──────────────────────────────────────────────────────
     O texto vem dos MINUTOS decorridos, calculados no servidor. Se
     usássemos o carimbo de data, o relógio errado ou o fuso do
     visitante fariam surgir "visto daqui a 3 horas". */
  _vistoEm(presenca, min) {
    if (presenca === 'online') return { txt: 'online agora', classe: 'online' };
    if (min === null || min === undefined) return { txt: 'nunca entrou', classe: 'sumido' };
    if (min < 60)  return { txt: `visto há ${min} min`, classe: presenca };
    const h = Math.floor(min / 60);
    if (h < 24)    return { txt: `visto há ${h}h`, classe: presenca };
    const d = Math.floor(h / 24);
    if (d === 1)   return { txt: 'visto ontem', classe: presenca };
    if (d < 7)     return { txt: `visto há ${d} dias`, classe: presenca };
    if (d < 30)    return { txt: `visto há ${Math.floor(d / 7)} sem`, classe: presenca };
    const m = Math.floor(d / 30);
    return { txt: `visto há ${m} ${m === 1 ? 'mês' : 'meses'}`, classe: 'sumido' };
  },

  /* A aura falha em SILÊNCIO se auras.js não tiver carregado — e silêncio
     é o pior jeito de errar: a tela fica igual e ninguém sabe por quê.
     Aqui o motivo vai para o console. */
  _aura(h) {
    // A aura da vitrine vem do rótulo de posto que o backend manda
    // ('arquiteto' | 'admin' | null) — não mais fixa em Arquiteto. Fallback
    // no campo antigo para não sumir caso o backend não tenha reiniciado.
    const id = h.aura || (h.arquiteto ? 'arquiteto' : null);
    if (!id) return '';
    if (!window.Auras) {
      console.warn('[AURA] auras.js não carregou. Confira se o arquivo está sendo '
        + 'servido em js/auras.js (aba Network) e reinicie o backend se ele '
        + 'serve o frontend.');
      return '';
    }
    if (!Auras.existe(id)) {
      console.warn(`[AURA] aura "${id}" não registrada. Registradas:`,
        Object.keys(Auras._registro));
      return '';
    }
    // bloco() já vem com posicionamento e animação embutidos.
    const bloco = Auras.bloco(id, 212);
    if (!bloco) { console.warn('[AURA] o desenho voltou vazio.'); return ''; }
    return bloco;
  },

  _RARIDADE: {
    lendaria: { nome: 'Lendária', cor: '#fbbf24' },
    epica:    { nome: 'Épica',    cor: '#a855f7' },
    rara:     { nome: 'Rara',     cor: '#38bdf8' },
    comum:    { nome: 'Comum',    cor: '#94a3b8' },
  },

  async abrir(login, voltarPara = 'dashboard') {
    this._voltarPara = voltarPara;
    if (window.App) await App.navigate('hunter');
    const cont = document.getElementById('hunter-publico-conteudo');
    if (!cont) return;
    cont.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';
    try {
      this._dados = await API.hunters.perfil(login);
      this._render();
    } catch (err) {
      cont.innerHTML = `
        <div class="hp-vazio">
          <div class="hp-vazio-ico">🔍</div>
          <div>${err.message || 'Hunter não encontrado'}</div>
          <button class="hp-voltar" onclick="App.navigate('${this._voltarPara}')">
            ← Voltar</button>
        </div>`;
    }
  },

  _medalha(r, tam = 88) {
    return (typeof ConquistaFX !== 'undefined' && ConquistaFX.miniMedalha)
      ? ConquistaFX.miniMedalha(r, tam)
      : `<span style="font-size:${tam * 0.5}px">${r.icone || '🏆'}</span>`;
  },

  _render() {
    const cont = document.getElementById('hunter-publico-conteudo');
    const { hunter: h, reliquias, resumo } = this._dados;

    const pct = h.xp_proximo_nivel
      ? Math.min(100, Math.round((h.xp_atual / h.xp_proximo_nivel) * 100)) : 0;
    const dt = s => s ? new Date(s).toLocaleDateString('pt-BR') : '—';

    // Mais raras primeiro: quem chega na vitrine vê o melhor antes de rolar
    const PESO = { lendaria: 4, epica: 3, rara: 2, comum: 1 };
    const porRaridade = (a, b) =>
      (PESO[b.raridade] || 1) - (PESO[a.raridade] || 1) ||
      (b.em || '').localeCompare(a.em || '');

    const conquistadas = reliquias.filter(r => r.de_missao).sort(porRaridade);
    const presentes    = reliquias.filter(r => !r.de_missao).sort(porRaridade);

    // A cor do rank tinge tudo. O Arquiteto mantém o dourado dele.
    const letra = this._letraRank(h.classe);
    const cor   = h.arquiteto ? '#fbbf24' : (this._RANK_CORES[letra] || '#a855f7');
    cont.style.setProperty('--rank-cor', cor);

    cont.innerHTML = `
      <div class="hp-topo">
        <button class="hp-voltar" id="hp-btn-voltar">← Voltar</button>
        <!-- Sem isto o perfil é um beco sem saída: você chega em
             alguém e não tem como ir para outro hunter. -->
        <div class="bh-wrap hp-busca" id="hp-busca"></div>
      </div>

      <div class="hp-cartao ${h.arquiteto ? 'arquiteto' : ''}">
        <div class="hp-hex-wrap">
          ${this._aura(h)}
          <div class="hp-hex-ring"></div>
          <div class="hp-hex">
            ${h.avatar_url ? `<img src="${h.avatar_url}" alt="${h.nome}">` : '🛡️'}
          </div>
          <div class="hp-hex-rank">${letra}</div>
        </div>

        <div class="hp-identidade">
          <div class="hp-nome">
            ${h.nome}
            ${h.arquiteto ? '<span class="hp-coroa" title="O Arquiteto do Sistema">⟁</span>' : ''}
            ${h.eu_mesmo ? '<span class="hp-selo-eu">você</span>' : ''}
          </div>
          <div class="hp-titulo">"${h.titulo || 'Hunter'}"</div>
          <div class="hp-linha-rank">
            <span class="hp-rank">${h.classe || 'E-Rank'}</span>
            <span class="hp-nick">@${h.login}</span>
            ${(() => {
              if (h.eu_mesmo) return '';
              const v = this._vistoEm(h.presenca, h.visto_ha_min);
              return `<span class="hp-presenca pr-${v.classe}">
                        <i class="hp-ponto"></i>${v.txt}</span>`;
            })()}
          </div>

          <div class="hp-xp">
            <div class="hp-xp-lbl">
              <span>Progresso para o próximo nível</span>
              <span>${(h.xp_atual || 0).toLocaleString('pt-BR')} / ${(h.xp_proximo_nivel || 0).toLocaleString('pt-BR')} XP</span>
            </div>
            <div class="hp-xp-barra"><div class="hp-xp-preenche" style="width:${pct}%"></div></div>
          </div>
        </div>

        <div class="hp-numeros">
          <div class="hp-num"><div class="v">${h.nivel_atual || 1}</div><div class="k">Nível</div></div>
          <div class="hp-num"><div class="v">${(h.xp_total || 0).toLocaleString('pt-BR')}</div><div class="k">XP total</div></div>
          <div class="hp-num"><div class="v">${h.streak_atual || 0}</div><div class="k">Streak</div></div>
          <div class="hp-num"><div class="v">${resumo.total}</div><div class="k">Relíquias</div></div>
        </div>
      </div>

      ${this._blocoFeitos()}

      ${this._reliquiaMaior(reliquias)}

      <div class="hp-secao">
        <div class="hp-secao-lbl">Conquistadas — ${conquistadas.length}</div>
        ${conquistadas.length
          ? `<div class="hp-grade">${conquistadas.map(r => this._reliquia(r)).join('')}</div>`
          : this._vazioSecao(h, 'conquistadas')}
      </div>

      <div class="hp-secao">
        <div class="hp-secao-lbl">Emblemas personalizados — ${presentes.length}</div>
        ${presentes.length
          ? `<div class="hp-grade">${presentes.map(r => this._reliquia(r)).join('')}</div>`
          : this._vazioSecao(h, 'presentes')}
      </div>

      ${h.eu_mesmo ? `
        <div class="hp-espelho">
          👁 É assim que os outros hunters veem você.
          <button class="hp-espelho-link" id="hp-editar">Editar minha ficha</button>
        </div>`
      : `
        <div class="hp-acoes">
          <button class="hp-acao" id="hp-enviar">💠 Enviar material para ${h.nome}</button>
        </div>`}`;

    // A busca é remontada a cada perfil (o innerHTML acima a apagou).
    // 'voltarPara' aponta para o dashboard: navegar de perfil em perfil
    // não deve empilhar um caminho de volta infinito.
    window.BuscaHunters?.montar('hp-busca', {
      placeholder: 'Procurar outro hunter...', voltarPara: 'dashboard',
    });

    window.BadgeCard?.ligarTodos('#hunter-publico-conteudo [data-bc]', reliquias);

    document.getElementById('hp-btn-voltar')
      ?.addEventListener('click', () => App.navigate(this._voltarPara));
    document.getElementById('hp-enviar')
      ?.addEventListener('click', () => this._irParaTrocas(h.login));
    document.getElementById('hp-editar')
      ?.addEventListener('click', () => App.navigate('perfil'));
  },

  /* ── Feitos do Sistema ────────────────────────────────────────────
     Nível e XP são abstrações do trabalho. Este bloco mostra o
     trabalho: quanto foi cumprido, com que constância, por quanto
     tempo. Sempre tem o que dizer — mesmo para quem entrou hoje,
     que é justamente quando a linha antiga dizia "0 dias · 0 · 0". */
  _blocoFeitos() {
    const f = this._dados.feitos || {};
    const h = this._dados.hunter;
    const d = h.dias_no_sistema;

    const tempo = d === null ? '—'
      : d === 0 ? 'Entrou hoje'
      : d === 1 ? '1 dia de Sistema'
      : `${d} dias de Sistema`;

    const itens = [
      ['✅', (f.execucoes_total || 0).toLocaleString('pt-BR'),
             f.execucoes_total === 1 ? 'missão cumprida' : 'missões cumpridas'],
      ['📆', `${f.consistencia || 0}%`, 'de consistência'],
      ['🔥', f.streak_max || 0, 'recorde de streak'],
      ['⏳', tempo, ''],
    ];

    return `
      <div class="hp-feitos">
        ${itens.map(([ico, valor, rot]) => `
          <div class="hp-feito">
            <span class="hp-feito-ico">${ico}</span>
            <span class="hp-feito-txt">
              <b>${valor}</b>${rot ? `<span>${rot}</span>` : ''}
            </span>
          </div>`).join('')}
      </div>`;
  },

  /* ── A Relíquia Maior ─────────────────────────────────────────────
     A peça mais rara em destaque, acima das seções. Sem hierarquia
     um acervo não parece valioso: a Lendária ficava no mesmo
     quadradinho da Comum, e ainda por baixo dela na rolagem. */
  _reliquiaMaior(reliquias) {
    if (!reliquias.length) return '';
    const PESO = { lendaria: 4, epica: 3, rara: 2, comum: 1 };
    // Se o hunter fixou um altar, o destaque sai de lá: a escolha do dono
    // vale mais que o cálculo de raridade.
    const fixadas = this._dados.fixadas || [];
    const pool = fixadas.length
      ? reliquias.filter(r => fixadas.includes(r.codigo))
      : reliquias;
    const maior = [...(pool.length ? pool : reliquias)].sort((a, b) =>
      (PESO[b.raridade] || 1) - (PESO[a.raridade] || 1) ||
      (b.em || '').localeCompare(a.em || ''))[0];

    const rar = this._RARIDADE[maior.raridade] || this._RARIDADE.comum;
    const dt = maior.em ? new Date(maior.em).toLocaleDateString('pt-BR') : '';

    return `
      <div class="hp-maior rar-${maior.raridade || 'comum'}" style="--rar-cor:${rar.cor}">
        <div class="hp-maior-halo"></div>
        <div class="hp-maior-med">${this._medalha(maior, 168)}</div>
        <div class="hp-maior-txt">
          <div class="hp-maior-lbl">A Relíquia Maior</div>
          <div class="hp-maior-nome">${maior.titulo}</div>
          ${maior.descricao ? `<div class="hp-maior-desc">${maior.descricao}</div>` : ''}
          <div class="hp-maior-rodape">
            <span class="hp-maior-rar">${rar.nome}</span>
            <span class="hp-maior-tipo">${maior.de_missao ? 'conquistada' : 'personalizada'}</span>
            ${dt ? `<span class="hp-maior-data">${dt}</span>` : ''}
          </div>
        </div>
      </div>`;
  },

  /* A ausência precisa ser visível: antes a seção sumia, e não dava
     para distinguir "não conquistou nada" de "essa seção não existe". */
  _vazioSecao(h, tipo) {
    const quem = h.eu_mesmo ? 'Você' : h.nome;
    const txt = tipo === 'conquistadas'
      ? `${quem} ainda não desbloqueou nenhuma conquista por missão.`
      : `${quem} ainda não recebeu emblemas personalizados.`;
    return `<div class="hp-vazio-suave">${txt}</div>`;
  },

  _reliquia(r) {
    const dt = r.em ? new Date(r.em).toLocaleDateString('pt-BR') : '';
    const rar = this._RARIDADE[r.raridade] || this._RARIDADE.comum;
    // A raridade pinta a moldura e o brilho. Sem isso, uma Lendária de
    // 2.500 XP ficava no mesmo quadradinho cinza de uma Comum de 50.
    return `
      <div class="hp-reliquia rar-${r.raridade || 'comum'}"
           style="--rar-cor:${rar.cor}" data-bc="${r.codigo}">
        <div class="hp-reliquia-med">${this._medalha(r)}</div>
        <div class="hp-reliquia-nome">${r.titulo}</div>
        <div class="hp-reliquia-rar">${rar.nome}</div>
        ${dt ? `<div class="hp-reliquia-data">${dt}</div>` : ''}
      </div>`;
  },

  /* Leva para a Casa de Trocas com o destinatário já preenchido */
  async _irParaTrocas(login) {
    await App.navigate('materiais');
    setTimeout(() => {
      const campo = document.getElementById('mt-nick');
      if (!campo) return;
      campo.value = login;
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      campo.focus();
    }, 350);
  },
};

window.HunterPublico = HunterPublico;
