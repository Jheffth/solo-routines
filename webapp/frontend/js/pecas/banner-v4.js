/* ============================================================
   banner-v4.js — o Portal V4 como PEÇA

   PASSO 4b. A V4 sai da Vitrine e passa a poder ser montada em
   qualquer slot — o do Dashboard, o do Perfil, o da própria
   Vitrine. Ela não vira padrão de nada: entra como OPÇÃO.

   O DESENHO NÃO MUDOU. A marcação abaixo é a mesma do `htmlV4` do
   estandarte.js, e há um teste que compara as duas saídas
   caractere a caractere para garantir que continue assim.

   O QUE MUDOU É DE ONDE VÊM AS COISAS

   Antes o `htmlV4` lia estado da Vitrine — `this._opcoes` para o
   campo de cor, `this._acervo` para as relíquias, `this._auraReal`
   para a aura. Fora da Vitrine, esse estado não existe.

   Agora tudo entra por `dados` e `opcoes`. É o que permite que o
   Dashboard, que nunca ouviu falar da Vitrine, monte esta peça.

   ────────────────────────────────────────────────────────────
   OS DOIS DEFEITOS CORRIGIDOS AQUI

   1. O CARROSSEL VAZAVA. O `_bindBotoesDashboard` criava um
      `setInterval` de 5s e o `fechar()` da Vitrine não o limpava:
      ele seguia girando contra um `.pt-v4-grid` que já tinha saído
      do DOM. Na Vitrine isso durava até o F5. No Dashboard, aberto
      o dia inteiro, acumularia.

      Aqui o timer é `host.intervalo` — o registro o recolhe no
      desmonte, mesmo que esta peça esqueça de fazê-lo. Foi este
      vazamento, aliás, que fez o contrato ser desenhado assim.

   2. `testarNoDashboard()` NÃO CONHECIA A V4. A cadeia de versões
      lá tinha três ramos (`v1 : v2 : senão V3`), enquanto a do
      `_pintar()` tinha quatro. Escolher V4 e mandar testar no
      Dashboard mostrava a V3. Os dois caminhos tinham divergido —
      e agora existe um só, que é montar a peça.

   ────────────────────────────────────────────────────────────
   O QUE **NÃO** FOI MEXIDO, E POR QUÊ

   A epígrafe. Eu havia relatado que ela está `position: absolute;
   top: calc(100% + 85px)` dentro de um banner com `overflow:
   hidden`, e que isso a colocaria fora da caixa.

   Mexer nisso seria um palpite: não tenho navegador, e o Arquiteto
   viu a V4 pronta e disse que é a melhor versão de todas — ou
   seja, a epígrafe aparece. Uma correção às cegas do que já
   funciona é pior que o defeito teórico.

   Fica o registro do que é verificável sem renderizar:
   `.pt-v4-epigrafe` está definida DUAS vezes no estandarte.css
   (linha 1093 e linha 1248). A primeira é `position: relative;
   display: inline-flex`, a segunda é `position: absolute`. A
   segunda vence pela ordem da cascata — logo a primeira é código
   morto, e quem for editar a de cima vai achar que não fez efeito.

   ────────────────────────────────────────────────────────────
   A DÍVIDA DOS IDS, outra vez declarada

   Esta peça escreve `dash-altar`, `dash-altar-swap`,
   `dash-btn-trocar-aura` e `dash-btn-editar-epigrafe`. Não é
   descuido: o estandarte.css depende deles para o layout —
   `#dash-altar { margin-left:auto }` e o `#dash-altar-swap` que só
   aparece abaixo de 900px. Tirar os ids mudaria a tela.

   Como na peça clássica, a dívida está contida: internamente esta
   peça NUNCA usa `document.getElementById`. Toda busca é presa ao
   contêiner, então duas instâncias na mesma página desenham cada
   uma a sua.
   ============================================================ */

const BannerV4 = {

  PADRAO: { campo: 'abissal' },

  /* ── A aura: cosmética presenteada > aura de cargo ──
     Mesma regra da peça clássica e do Dashboard. Antes vinha de
     `this._opcoes.aura || this._auraReal`, que é escolha de
     bancada; aqui vem do hunter, que é o que vale em produção.
     `opcoes.aura` continua existindo para a Vitrine experimentar. */
  aura(u, tam, opcoes) {
    if (typeof Auras === 'undefined') return '';
    const forcada = opcoes && opcoes.aura;
    if (forcada === '__nenhuma') return '';
    const id = forcada || u.aura_id || null;
    if (id && Auras.existe && Auras.existe(id)) return Auras.bloco(id, tam);
    const cargo = u.nivel_acesso;
    if (cargo && Auras.existe && Auras.existe(String(cargo).toLowerCase())) {
      return Auras.bloco(String(cargo).toLowerCase(), tam);
    }
    return '';
  },

  /* ── As relíquias: vêm PRONTAS do hospedeiro ──
     Antes era `this._acervo`, preenchido por duas chamadas de API
     que a Vitrine fazia. Uma peça que busca dado sozinha dispara
     tráfego a cada preview. */
  reliquias(lista, tam, comBotao) {
    const acervo = (lista || []).slice(0, 5);
    if (!acervo.length) return '';
    const medalha = c => (typeof ConquistaFX !== 'undefined' && ConquistaFX.miniMedalha)
      ? ConquistaFX.miniMedalha(c, tam)
      : `<span style="font-size:${tam * .7}px">${c.icone || '🏆'}</span>`;
    const itens = acervo.map(c =>
      `<span class="est-reliquia" data-bc="${c.codigo}" style="cursor:pointer">${medalha(c)}</span>`).join('');
    const btn = comBotao
      ? `<button class="est-btn-altar est-btn-altar-desktop" id="dash-altar" title="Modificar Relíquias"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>`
      : '';
    return itens + btn;
  },

  /* ══════════════════════════════════════════════════════════
     A MARCAÇÃO — cópia do htmlV4, com os dados vindo de fora
     ══════════════════════════════════════════════════════════ */
  html(dados, opcoes) {
    const A = BannersArte;
    const u = (dados && dados.hunter) || {};
    const o = Object.assign({}, this.PADRAO, opcoes || {});
    const c = A.CAMPOS[o.campo] || A.CAMPOS.petroleo;
    const letra = o.rank || A.letraRank(u.classe);
    const corRank = A.RANK_CORES[letra] || '#a855f7';

    const xp = Math.max(0, u.xp_atual || 0);
    const alvo = Math.max(1, u.xp_proximo_nivel || 100);
    const pct = Math.min(100, (xp / alvo) * 100);

    const estilo = [
      `--pt-fundo:${c.fundo}`, `--pt-fundo2:${c.fundo2}`,
      `--pt-circuito:${c.circuito}`, `--pt-feixe:${c.feixe}`, `--pt-feixe2:${c.feixe2}`,
      `--pt-rank:${corRank}`,
    ].join(';');

    const cargo = u.nivel_acesso && u.nivel_acesso !== 'User' ? u.nivel_acesso : null;
    const epigrafe = u.bio || 'Desperte o seu sistema. Erga-se contra a maré do ordinário.';

    return `
      <div class="pt-banner pt-v4-banner" style="${estilo}">
        <div class="pt-v4-hologrid"></div>
        ${A.circuito()}

        <div class="pt-v3-grid pt-v4-grid">

          <!-- Coluna 1: Avatar + Identidade -->
          <div class="pt-v3-avatar-grupo pt-v4-avatar">
            <div class="pt-retrato">
              ${this.aura(u, 210, o)}
              ${A.orbitaHex()}
              <div class="pt-hex">
                <div class="pt-hex-luz"></div>
                <div class="pt-hex-foto">
                  ${u.avatar_url
                    ? `<img src="${A.esc(u.avatar_url)}" alt="">`
                    : `<span class="pt-inicial">${A.esc((u.nome || 'H')[0]).toUpperCase()}</span>`}
                </div>
              </div>
              ${A.seloHex(letra, corRank)}
              <button class="est-btn-aura" id="dash-btn-trocar-aura" title="Trocar Aura">◈</button>
            </div>

            <div class="pt-identidade">
              <div class="pt-nome">${A.esc(u.nome || 'Hunter')}</div>
              <div class="pt-titulo pt-v4-shimmer">"${A.esc(u.titulo || 'Sem título')}"</div>
              <div class="pt-chips">
                <span class="pt-chip pt-chip-rank">${letra}-Rank</span>
                ${cargo ? `<span class="pt-chip pt-chip-cargo">★ ${A.esc(cargo).toUpperCase()} ★</span>` : ''}
              </div>
            </div>
          </div>

          <!-- Coluna 2: Núcleo e Estruturas de Encaixe -->
          <div class="pt-nucleo pt-v4-nucleo">

            <div class="pt-v4-trilho-mestre">
              <div class="pt-v4-ancora pt-v4-ancora-esq"><svg viewBox="0 0 10 20"><path fill="currentColor" d="M10,0 L0,5 L0,15 L10,20 Z"/></svg></div>
              <div class="pt-linha-xp">
                <div class="pt-feixe-caixa">
                  <div class="pt-xp-num">${xp.toLocaleString('pt-BR')} / ${alvo.toLocaleString('pt-BR')} XP</div>
                  ${A.barraXP(pct, c)}
                </div>
              </div>
              <div class="pt-v4-ancora pt-v4-ancora-dir"><svg viewBox="0 0 10 20"><path fill="currentColor" d="M0,0 L10,5 L10,15 L0,20 Z"/></svg></div>
            </div>

            <div class="pt-v4-reliquias-dock">
              <div class="pt-reliquias">
                <span class="pt-reliquias-fila">${this.reliquias(dados && dados.reliquias, 50, true)
                  || '<span class="pt-vazio">nenhuma relíquia no altar</span>'}</span>
              </div>
            </div>

            <div class="pt-v4-epigrafe">
              <span class="pt-v4-quote-mark left">❝</span>
              <span class="pt-v4-quote-text">${A.esc(epigrafe)}</span>
              <span class="pt-v4-quote-mark right">❞</span>
              <button class="est-btn-editar-epigrafe" id="dash-btn-editar-epigrafe" title="Editar Epígrafe">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              </button>
            </div>

          </div>

          <!-- Coluna 3: Gemas -->
          <div class="pt-gemas pt-v4-gemas">
            <div class="pt-v4-fio-conector"></div>
            ${A.gema('ametista', u.nivel_atual ?? 1, 'Nível', { auraV3: true })}
            ${A.gema('ambar', (u.moedas ?? 0).toLocaleString('pt-BR'), 'Mana Coins', { auraV3: true })}
            ${A.gema('rubi', u.streak_atual ?? 0, 'Streak', { auraV3: true })}
          </div>

          <!-- Botões de Ação Mobile Soltos no Grid -->
          <div class="est-v4-acoes-mobile">
            <button class="est-btn-altar" id="dash-altar-swap" title="Girar Carrossel">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="1 4 1 10 7 10"></polyline>
                <polyline points="23 20 23 14 17 14"></polyline>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10"></path>
                <path d="M3.51 15A9 9 0 0 0 18.36 18.36L23 14"></path>
              </svg>
            </button>
            <button class="est-btn-altar" id="dash-altar" title="Modificar Relíquias">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
          </div>

        </div>
      </div>`;
  },

  /* ══════════════════════════════════════════════════════════
     O CARROSSEL

     No mobile as gemas e as relíquias se revezam na frente. O giro
     é automático a cada 5s ATÉ o hunter tocar no botão — a partir
     daí o controle é dele e o automático some. Comportamento
     copiado do original.

     A diferença: o timer é do host. Uma peça que morre com um
     `setInterval` na mão contamina o app que a hospeda.
     ══════════════════════════════════════════════════════════ */
  ligarCarrossel(el, host) {
    const grid = el.querySelector('.pt-v4-grid');
    const btn  = el.querySelector('#dash-altar-swap');
    if (!grid || !btn) return;

    let gemasNaFrente = false;
    const girar = () => {
      gemasNaFrente = !gemasNaFrente;
      grid.classList.toggle('cq-gemas-front', gemasNaFrente);
      grid.classList.toggle('cq-badges-front', !gemasNaFrente);
    };

    const auto = host.intervalo(girar, 5000);
    host.ouvir(btn, 'click', (e) => {
      e.preventDefault(); e.stopPropagation();
      clearInterval(auto);      // o hunter assumiu o controle
      girar();
    });
  },

  /* Os cliques não sabem o que fazem: pedem ao hospedeiro. É isto
     que permite a mesma peça responder de um jeito no Dashboard
     (abrir o modal de aura) e de outro na Vitrine (não fazer nada). */
  ligarAcoes(el, host) {
    const par = [
      ['#dash-btn-trocar-aura',      'trocar-aura'],
      ['#dash-btn-editar-epigrafe',  'editar-epigrafe'],
      ['#dash-altar',                'editar-altar'],
    ];
    for (const [sel, acao] of par) {
      el.querySelectorAll(sel).forEach(btn =>
        host.ouvir(btn, 'click', (e) => {
          e.preventDefault(); e.stopPropagation();
          host.acao(acao);
        }));
    }
    el.querySelectorAll('.est-reliquia').forEach(n =>
      host.ouvir(n, 'click', () => host.acao('ver-reliquias')));

    if (window.BadgeCard && host.el) {
      // O BadgeCard varre por seletor global; damos o contêiner para
      // ele não alcançar outra instância da peça na mesma página.
      window.BadgeCard.ligarTodos('[data-bc]', []);
    }
  },
};

if (typeof Pecas !== 'undefined') {
  Pecas.registrar({
    id: 'banner-v4',
    nome: 'Portal V4',
    familia: 'banner',
    padrao: false,          // entra como OPÇÃO; a rede continua sendo a clássica
    precisa: ['hunter'],
    opcoes: { campo: ['abissal', 'petroleo', 'brasa'] },

    montar(el, dados, host) {
      el.innerHTML = BannerV4.html(dados, {
        campo: host.opcao('campo', BannerV4.PADRAO.campo),
        aura:  host.opcao('aura'),
        rank:  host.opcao('rank'),
      });
      BannerV4.ligarCarrossel(el, host);
      BannerV4.ligarAcoes(el, host);
    },

    /* Sem `atualizar()`: a V4 é um bloco de HTML gerado de uma vez,
       sem nós estáveis para repintar por dentro. O registro remonta,
       e remontar aqui é correto — só custa o piscar.

       Fazer melhor exige separar os pedaços que mudam (XP, gemas)
       dos que não mudam (moldura, circuito), e isso é redesenho, não
       empacotamento. Não é trabalho deste passo. */
  });
}

window.BannerV4 = BannerV4;
