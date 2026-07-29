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
    /* `opcoes.aura` e a escolha da BANCADA (a Vitrine experimentando);
       `u.aura_id` e o que o hunter realmente equipou. A bancada ganha
       quando existe, e nos dois casos quem decide entre cosmetica,
       cargo e NENHUMA e o `Auras.resolver` — um lugar so.

       Antes esta funcao reimplementava a regra, e tratava "sem
       cosmetica" e "nenhuma aura" como a mesma coisa. */
    const escolhida = (opcoes && opcoes.aura) || u.aura_id;
    return Auras.blocoDe(escolhida, u.nivel_acesso, tam);
  },

  /* ── As relíquias: vêm PRONTAS do hospedeiro ──
     Antes era `this._acervo`, preenchido por duas chamadas de API
     que a Vitrine fazia. Uma peça que busca dado sozinha dispara
     tráfego a cada preview.

     AS FIXADAS MANDAM. O Altar de Relíquias existe para o hunter
     escolher QUAIS cinco aparecem; sem escolha, valem as mais
     recentes. Eu tinha esquecido de aplicar isso aqui: a V4 mostrava
     sempre as cinco últimas, e quem tivesse escolhido no Altar via
     insígnias que não pediu. Foi o "badge com a arte errada".

     A regra é a mesma da peça clássica — e o fato de ela estar
     escrita duas vezes é dívida anotada: quando houver uma terceira
     peça com relicário, isto vira função do vocabulário. */
  reliquias(lista, fixadas, tam, comBotao) {
    const todas = lista || [];
    const escolhidas = (fixadas || [])
      .map(cod => todas.find(c => c.codigo === cod)).filter(Boolean);
    const acervo = (escolhidas.length ? escolhidas : todas).slice(0, 5);
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
              ${A.botaoAura()}
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
                <span class="pt-reliquias-fila">${this.reliquias(dados && dados.reliquias, dados && dados.reliquias_fixadas, 50, true)
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

  /* ══════════════════════════════════════════════════════════
     REPINTURA

     O Dashboard rechama o desenho a cada ação do hunter. Remontar a
     cada uma faria o banner inteiro piscar — e piscar foi
     exatamente a reclamação que fez as listas de missão serem
     reescritas. Um banner que apaga e volta a cada missão iniciada
     seria a mesma dor, num lugar mais visível.

     A regra: só se toca no que MUDOU.

       • os números das gemas moram num <span class="gema-valor">.
         São texto. Trocar texto não reinicia animação nenhuma.
       • a barra de XP é geometria calculada — a hélice, o nodo e o
         preenchimento saem todos do `pct`. Essa precisa ser gerada
         de novo, e só é quando o `pct` muda de verdade.
       • o que muda a MOLDURA (rank, campo de cor, avatar, aura)
         não cabe em repintura: aí a peça devolve `false` e o
         registro remonta.
     ══════════════════════════════════════════════════════════ */
  assinatura(u, o) {
    // O que, mudando, obriga a remontar.
    return [o.campo, o.rank || BannersArte.letraRank(u.classe),
            u.avatar_url || '', u.aura_id || '', u.nivel_acesso || ''].join('|');
  },

  repintar(el, dados, host) {
    const A = BannersArte;
    const u = (dados && dados.hunter) || {};
    const o = {
      campo: host.opcao('campo', this.PADRAO.campo),
      aura:  host.opcao('aura'),
      rank:  host.opcao('rank'),
    };

    const assin = this.assinatura(u, o);
    if (el.dataset.v4sig !== assin) return false;      // moldura mudou → remonta

    const texto = (sel, valor) => {
      const n = el.querySelector(sel);
      if (n && n.textContent !== String(valor)) n.textContent = valor;
    };

    texto('.pt-nome', u.nome || 'Hunter');
    texto('.pt-titulo', `"${u.titulo || 'Sem título'}"`);
    texto('.pt-v4-quote-text', u.bio || 'Desperte o seu sistema. Erga-se contra a maré do ordinário.');

    /* Gemas: só o número, que é texto solto dentro do SVG. A ordem
       é a da marcação — nível, mana, streak — e o `html()` acima é
       a única coisa que pode mudá-la. */
    const gemas = el.querySelectorAll('.pt-gema .gema-valor');
    const valores = [
      String(u.nivel_atual ?? 1),
      (u.moedas ?? 0).toLocaleString('pt-BR'),
      String(u.streak_atual ?? 0),
    ];
    gemas.forEach((n, i) => {
      if (valores[i] !== undefined && n.textContent !== valores[i]) n.textContent = valores[i];
    });

    // XP
    const xp = Math.max(0, u.xp_atual || 0);
    const alvo = Math.max(1, u.xp_proximo_nivel || 100);
    const pct = Math.min(100, (xp / alvo) * 100);
    texto('.pt-xp-num', `${xp.toLocaleString('pt-BR')} / ${alvo.toLocaleString('pt-BR')} XP`);

    // A barra só é redesenhada se o preenchimento realmente andou.
    // Redesenhar à toa reiniciaria a animação dos feixes a cada
    // número atualizado na tela.
    const caixa = el.querySelector('.pt-feixe-caixa');
    if (caixa && el.dataset.v4pct !== pct.toFixed(2)) {
      el.dataset.v4pct = pct.toFixed(2);
      const svgAntigo = caixa.querySelector('svg');
      const molde = el.ownerDocument.createElement('div');
      molde.innerHTML = A.barraXP(pct, A.CAMPOS[o.campo] || A.CAMPOS.petroleo);
      const svgNovo = molde.querySelector('svg');
      if (svgAntigo && svgNovo) svgAntigo.replaceWith(svgNovo);
    }

    // Relíquias: só se a lista mudou de conteúdo.
    const fila = el.querySelector('.pt-reliquias-fila');
    // A chave inclui as FIXADAS: mudar a escolha no Altar sem mudar o
    // acervo tem que redesenhar a fila, senão o hunter escolhe e nada
    // acontece até a próxima recarga.
    const codigos = ((dados && dados.reliquias) || []).map(c => c.codigo).join(',')
                  + '||' + ((dados && dados.reliquias_fixadas) || []).join(',');
    if (fila && el.dataset.v4rel !== codigos) {
      el.dataset.v4rel = codigos;
      fila.innerHTML = this.reliquias(dados && dados.reliquias, dados && dados.reliquias_fixadas, 50, true)
        || '<span class="pt-vazio">nenhuma relíquia no altar</span>';
      this.ligarAcoes(el, dados, host);
    }
    return true;
  },

  /* Os cliques não sabem o que fazem: pedem ao hospedeiro. É isto
     que permite a mesma peça responder de um jeito no Dashboard
     (abrir o modal de aura) e de outro na Vitrine (não fazer nada). */
  ligarAcoes(el, dados, host) {
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
    /* A INSÍGNIA NÃO NAVEGA.

       Havia aqui um clique que levava ao Perfil. Saiu a pedido do
       Arquiteto, e a razão é boa: no celular, o toque é o único
       jeito de ver o cartão da insígnia. Com a navegação junto, o
       cartão abria e a página trocava debaixo dele — o gesto tinha
       dois donos.

       O único efeito de uma insígnia é MOSTRAR o que ela é: o
       BadgeCard no hover, e no toque quando não há hover. Quem faz
       isso é o `ligarTodos` logo abaixo, e ele já dá conta dos dois.

       A ação `ver-reliquias` continua existindo no hospedeiro — a
       peça clássica ainda a usa. Uma ação que esta peça não pede
       não custa nada. */

    /* O CARTÃO DE INSÍGNIA (hover). Eu tinha escrito
       `ligarTodos('[data-bc]', [])` — com a lista VAZIA. O BadgeCard
       monta um mapa por código e só liga o que encontra nele; com
       lista vazia, nenhum elemento é ligado e o hover simplesmente
       não existe. Era isso, e não o CSS.

       O seletor também estava errado: `ligarTodos` varre o DOCUMENTO
       inteiro, então `[data-bc]` alcançaria as relíquias de qualquer
       outra peça na página. O selo da instância prende a varredura a
       este contêiner. */
    if (window.BadgeCard && window.BadgeCard.ligarTodos) {
      const lista = (dados && dados.reliquias) || [];
      window.BadgeCard.ligarTodos(`[data-peca-selo="${host.selo}"] [data-bc]`, lista);
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
      const u = (dados && dados.hunter) || {};
      const o = {
        campo: host.opcao('campo', BannerV4.PADRAO.campo),
        aura:  host.opcao('aura'),
        rank:  host.opcao('rank'),
      };
      el.innerHTML = BannerV4.html(dados, o);

      // Marcas da repintura: o que já está desenhado, para não
      // redesenhar o que não mudou.
      el.dataset.v4sig = BannerV4.assinatura(u, o);
      el.dataset.v4pct = Math.min(100,
        (Math.max(0, u.xp_atual || 0) / Math.max(1, u.xp_proximo_nivel || 100)) * 100).toFixed(2);
      el.dataset.v4rel = ((dados && dados.reliquias) || []).slice(0, 5).map(c => c.codigo).join(',');

      el.dataset.pecaSelo = host.selo;   // prende o BadgeCard a ESTA instância
      BannerV4.ligarCarrossel(el, host);
      BannerV4.ligarAcoes(el, dados, host);
    },

    // Repinta o que mudou; devolve false quando a moldura mudou e o
    // registro precisa remontar.
    atualizar(el, dados, host) {
      return BannerV4.repintar(el, dados, host);
    },
  });
}

window.BannerV4 = BannerV4;
