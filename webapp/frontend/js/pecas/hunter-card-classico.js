/* ============================================================
   hunter-card-classico.js — a Janela de Status, empacotada

   PASSO 2 do PLANO_VITRINE_COMO_ATELIE, e o passo que decide o
   resto: se o cartão que já existe couber no contrato sem
   contorções, o contrato está certo. Se precisar de exceção, é o
   contrato que está errado — melhor descobrir aqui, com uma peça
   que já funciona, do que depois com três.

   O QUE ESTA PEÇA É

   Exatamente o cartão de hoje. Mesmas classes, mesmos ids, mesmo
   texto — a marcação foi copiada do index.html e há um teste que
   compara as duas, caractere a caractere, para garantir que ela
   continue idêntica. Nada aqui é redesenho.

   O que mudou é de onde ela vem: em vez de marcação parada no
   index.html mais ~310 linhas de desenho no dashboard.js, é um
   objeto que sabe se montar em qualquer contêiner — o do
   Dashboard, o do Perfil ou o da Vitrine.

   ────────────────────────────────────────────────────────────
   O QUE FICOU DE FORA, E POR QUÊ

   O `renderPersonagem()` do dashboard.js fazia muito mais do que
   desenhar o cartão. Ao separar, ficou claro que ele mexia em
   cinco coisas que não são o cartão:

     • a barra lateral (sidebar-nome, sidebar-rank, sidebar-avatar)
     • o chip de dungeon aberta (sys-dungeon-chip)
     • os sussurros do Sistema (sys-whisper)
     • a busca de hunters
     • window.__resetPerfilArquiteto

   Nada disso está aqui. São do hospedeiro, e continuam nele. Uma
   peça que mexesse na barra lateral não poderia ser montada na
   Vitrine sem efeito colateral.

   ────────────────────────────────────────────────────────────
   A DÍVIDA DOS IDS — declarada, não escondida

   O contrato diz que uma peça não escreve id do hospedeiro. Esta
   escreve, e é a única que pode: ela É o cartão do hospedeiro, e
   três lugares de fora ainda dependem desses ids.

     perfil.js:226        lê #dash-avatar para trocar a foto
     estandarte.css:1459  estiliza #dash-altar
     estandarte.js        também cria #dash-altar (na V4)

   Manter os ids é o que torna esta peça uma cópia FIEL, e é a
   fidelidade que permite provar que a tela não mudou.

   A dívida está contida: internamente esta peça NUNCA usa
   `document.getElementById`. Toda busca é `el.querySelector`,
   presa ao próprio contêiner. No dia em que os três dependentes
   migrarem, apagar os ids daqui não quebra nada dentro da peça —
   e, aí sim, duas instâncias poderão conviver na mesma página.

   Um id foi descartado já: `hunter-fx`, do canvas. Ninguém de fora
   lia, então virou busca por classe.
   ============================================================ */

const HunterCardClassico = {

  /* As cores de rank. Cópia do `_RANK_CORES` do dashboard.js —
     nota: são as mesmas sete de `Gemas.LUZ_RANK`. Unificar é
     trabalho para quando a peça estiver montada e verificada; uma
     mudança de cor no meio do passo 2 estragaria a única coisa que
     este passo precisa provar, que é a fidelidade. */
  RANK_CORES: {
    'E': '#94a3b8', 'D': '#22d3ee', 'C': '#10b981',
    'B': '#3b82f6', 'A': '#a855f7', 'S': '#fbbf24', 'N': '#fb7185',
  },

  /* Os títulos, exatamente como no `_getTituloByRank` do dashboard.js.

     Eu havia escrito outros aqui — "Aprendiz de Caçador", "Caçador
     Supremo" — inventados. Ficariam bonitos e estariam ERRADOS: o
     hunter veria o próprio título mudar sozinho no dia em que a
     peça entrasse. O teste de fidelidade não pegaria, porque ele
     compara a marcação vazia, e o título só aparece depois de
     pintar com dados. Por isso existe um teste só para esta tabela.

     Note que NÃO há 'N' e que a chave é o `rank` CRU, não a letra
     extraída — é assim que está hoje, e fidelidade vem antes de
     coerência. Corrigir isto é assunto de outro commit, visível. */
  TITULOS: {
    'E': 'O Mais Fraco', 'D': 'Iniciante',
    'C': 'Promissor',    'B': 'Experiente',
    'A': 'Elite',        'S': 'Monarch',
  },

  letraRank(classe) {
    const c = (classe || 'E-Rank').toUpperCase();
    if (c.includes('NATIONAL')) return 'N';
    const m = c.match(/\b([EDCBAS])\b|^([EDCBAS])-/);
    return (m && (m[1] || m[2])) || 'E';
  },

  tituloDe(rank) { return this.TITULOS[rank] || 'Hunter'; },

  /* ══════════════════════════════════════════════════════════
     A MARCAÇÃO

     Cópia literal do index.html, linhas 461–522. O teste
     `teste_hunter_card.js` recorta aquele bloco do arquivo e
     compara com o que sai daqui. Se alguém mexer num dos dois, o
     teste acusa — que é o ponto.
     ══════════════════════════════════════════════════════════ */
  esqueleto() {
    return `<canvas class="hunter-window-fx" id="hunter-fx"></canvas>
            <div class="hunter-window-body">

              <!-- Coluna 1: avatar em hexágono de rank -->
              <div class="hunter-hex-wrap">
                <div class="hunter-hex-ring"></div>
                <div class="hunter-hex" id="dash-avatar">&#128737;&#65039;</div>
                <div class="hunter-hex-rank" id="dash-rank-selo">E</div>
              </div>

              <!-- Coluna 2: identidade + XP -->
              <div class="hunter-ident">
                <div class="hunter-nome" id="dash-nome">Hunter</div>
                <div class="hunter-titulo" id="dash-titulo">"O Mais Fraco"</div>
                <div class="hunter-badges" id="dash-rank-badge"></div>

                <div class="hunter-xp">
                  <div class="hunter-xp-top">
                    <span class="hunter-xp-lbl">Progresso para o próximo nível</span>
                    <span class="hunter-xp-val" id="dash-xp-txt">0 / 100 XP</span>
                  </div>
                  <div class="hunter-xp-track">
                    <div class="hunter-xp-fill" id="dash-xp-bar" style="width:0%"></div>
                    <div class="hunter-xp-ticks"></div>
                  </div>
                </div>

                <!-- Relíquias recentes -->
                <div class="hunter-relicario" id="dash-relicario"></div>
              </div>

              <!-- Coluna 3: cristais de status -->
              <div class="hunter-cristais">
                <div class="cristal cristal-nivel">
                  <div class="cristal-gema"><span id="dash-nivel">1</span></div>
                  <div class="cristal-lbl">Nível</div>
                </div>
                <div class="cristal cristal-moedas">
                  <div class="cristal-gema"><span id="dash-moedas">0</span></div>
                  <div class="cristal-lbl">Mana Coins</div>
                </div>
                <div class="cristal cristal-streak">
                  <div class="cristal-gema">
                    <span class="cristal-chama" id="dash-streak-chama">&#128293;</span>
                    <span id="dash-streak">0</span>
                  </div>
                  <div class="cristal-lbl">Streak</div>
                </div>
              </div>
            </div>

          <div style="margin-top:.25rem;display:flex;justify-content:flex-end;gap:.5rem">
            <button id="dash-btn-reset-arquiteto" style="display:none"></button>
            <button id="dash-btn-editar-perfil" class="btn btn-ghost btn-sm" style="
              font-family:var(--font-section);font-size:.75rem;letter-spacing:.06em;
              border:1px solid rgba(124,58,237,.4);color:var(--purple-glow);
              padding:.35rem .9rem;border-radius:.5rem;cursor:pointer;
              transition:all .2s;display:flex;align-items:center;gap:.4rem;
            " onmouseover="this.style.background='rgba(124,58,237,.15)'" onmouseout="this.style.background='transparent'">
              &#9998; Editar Perfil
            </button>
          </div>`;
  },

  /* ══════════════════════════════════════════════════════════
     PINTURA

     Separada da montagem porque o Dashboard repinta o cartão a
     cada ação do hunter (`atualizarNumeros`). Remontar a cada
     repintura faria o cartão inteiro piscar — o mesmo incômodo que
     o hunter já reclamou nas listas de missão.
     ══════════════════════════════════════════════════════════ */
  /* `dados` é o PACOTE inteiro que o hospedeiro entrega:
     { hunter, reliquias, reliquias_fixadas }. Não é só o hunter.

     Eu já errei isto aqui: `pintar` recebia apenas `dados.hunter` e
     o relicário procurava `hunter.reliquias`, que nunca existe. Os
     testes da peça isolada passavam porque eu montava o dado do
     jeito errado nos dois lados — foi o teste de integração com o
     dashboard.js de verdade que acusou. */
  pintar(el, dados, host, animar) {
    const q = s => el.querySelector(s);   // SEMPRE preso ao contêiner
    const pacote = dados || {};
    const d = pacote.hunter || {};

    const classe = d.classe || d.rank || 'E-Rank';
    const letra  = this.letraRank(classe);
    const cor    = this.RANK_CORES[letra] || '#a855f7';

    /* A cor do rank vira variável do contêiner. É dela que o canvas
       de partículas se serve — antes ele lia de `#hunter-card`, o
       que amarrava a animação ao Dashboard. */
    el.style.setProperty('--rank-cor', cor);
    el.style.setProperty('--rank-aura', cor + '26');

    const nome = q('#dash-nome');       if (nome)  nome.textContent = d.nome || 'Hunter';
    const tit  = q('#dash-titulo');     if (tit)   tit.textContent  = `"${d.titulo || this.tituloDe(d.rank)}"`;
    const selo = q('#dash-rank-selo');  if (selo)  selo.textContent = letra;

    // Cristais
    this.contar(q('#dash-nivel'),  d.nivel_atual || d.nivel || 1, host, animar, 700);
    this.contar(q('#dash-moedas'), d.moedas || 0, host, animar);
    const streak = d.streak_atual || d.streak_dias || 0;
    this.contar(q('#dash-streak'), streak, host, animar, 600);
    el.querySelector('.cristal-streak')?.classList.toggle('apagado', streak === 0);

    // XP
    const xpAtual = d.xp_atual || 0;
    const xpProx  = d.xp_proximo_nivel || d.xp_proximo || 100;
    const pct     = Math.min(100, Math.round((xpAtual / xpProx) * 100));

    const txt = q('#dash-xp-txt');
    if (txt) txt.textContent = `${xpAtual.toLocaleString('pt-BR')} / ${xpProx.toLocaleString('pt-BR')} XP`;

    const barra = q('#dash-xp-bar');
    if (barra) {
      // O atraso existe para a transição de CSS pegar: aplicar a
      // largura no mesmo quadro em que o elemento nasce não anima.
      if (animar) host.espera(() => { barra.style.width = pct + '%'; }, 120);
      else barra.style.width = pct + '%';
    }
    // Perto de subir (>=85%): a barra arde em ouro
    el.querySelector('.hunter-xp-track')?.classList.toggle('quase', pct >= 85);

    // Selos de rank
    const badges = q('#dash-rank-badge');
    if (badges) {
      const ehArq = d.nivel_acesso === 'Arquiteto';
      badges.innerHTML = `
        <span style="font-family:var(--font-section);font-size:.68rem;font-weight:700;letter-spacing:.12em;
          padding:.2rem .7rem;border-radius:100px;color:${cor};
          border:1px solid ${cor}66;background:${cor}14">${classe}</span>
        ${ehArq ? `<span class="dg-badge-arquiteto" style="margin-left:0">★ ARQUITETO ★</span>` : ''}`;
    }

    // Avatar
    if (d.avatar_url) {
      const hex = q('#dash-avatar');
      if (hex) hex.innerHTML =
        `<img src="${d.avatar_url}" alt="Avatar" style="width:100%;height:100%;object-fit:cover">`;
    }

    this.aura(el, d);
    this.relicario(el, pacote, host);

    // O botão ◈ já existe (criado na montagem); aqui só o rótulo muda.
    const btnAura = el.querySelector('#dash-btn-trocar-aura');
    if (btnAura) btnAura.title = d.aura_id ? `Aura ativa: ${d.aura_id}` : 'Gerenciar Aura';
  },

  /* ── O botão ◈, dentro do hexágono ──────────────────────

     Vinha do `_bindBtnTrocarAura` do dashboard.js, que o recriava
     A CADA repintura — e o hunter repinta o cartão a cada missão.
     Aqui ele nasce UMA vez, na montagem, e depois só troca de
     título. Recriar um nó a cada repintura era o tipo de coisa que
     nunca aparece num teste e sempre aparece num perfilador.

     O clique não sabe o que faz: pede `trocar-aura` ao hospedeiro.
     Era este botão que escrevia `dash-btn-trocar-aura` de dentro da
     V4, colidindo com o do Dashboard. */
  botaoAura(el, host) {
    const hexWrap = el.querySelector('.hunter-hex-wrap');
    if (!hexWrap) return;
    hexWrap.style.position = 'relative';   // garante, caso o CSS mude

    const btn = el.ownerDocument.createElement('button');
    btn.id = 'dash-btn-trocar-aura';
    btn.innerHTML = '◈';
    btn.style.cssText = [
      'position:absolute', 'bottom:-14px', 'left:50%',
      'transform:translateX(-50%)',
      'width:28px', 'height:28px', 'border-radius:50%',
      'background:linear-gradient(135deg,#2a0a3e,#130a28)',
      'border:1.5px solid rgba(244,143,177,.65)',
      'color:#f48fb1', 'font-size:.72rem', 'cursor:pointer', 'z-index:20',
      'box-shadow:0 0 10px rgba(244,143,177,.3),inset 0 0 6px rgba(244,143,177,.1)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'transition:box-shadow .2s,background .2s', 'padding:0',
    ].join(';');
    btn.onmouseover = () => {
      btn.style.boxShadow = '0 0 18px rgba(244,143,177,.6),inset 0 0 8px rgba(244,143,177,.2)';
      btn.style.background = 'linear-gradient(135deg,#3e1060,#1a0a38)';
    };
    btn.onmouseout = () => {
      btn.style.boxShadow = '0 0 10px rgba(244,143,177,.3),inset 0 0 6px rgba(244,143,177,.1)';
      btn.style.background = 'linear-gradient(135deg,#2a0a3e,#130a28)';
    };
    host.ouvir(btn, 'click', () => host.acao('trocar-aura'));
    hexWrap.appendChild(btn);
  },

  /* ── Aura: cosmética presenteada (aura_id) > aura de cargo ──
     `Auras` é vocabulário compartilhado, como Glifos e Gemas — não
     é o hospedeiro. A peça pode falar com ele direto. */
  aura(el, d) {
    const hw = el.querySelector('.hunter-hex-wrap');
    if (!hw || !window.Auras) return;
    const aid = d.aura_id || null;
    if (aid && Auras.existe(aid)) {
      hw.querySelector('.aura-wrap')?.remove();
      hw.insertAdjacentHTML('afterbegin', Auras.bloco(aid, 168));
    } else {
      Auras.aplicar(hw, d.nivel_acesso, 168);
    }
  },

  /* ── Relicário: as relíquias fixadas, ou as mais recentes ──

     ANTES esta função buscava na API por conta própria (duas
     chamadas). Agora recebe pronto: o hospedeiro é dono dos dados.
     Sem isso a peça não poderia ser montada na Vitrine sem
     disparar tráfego de rede a cada preview. */
  relicario(el, pacote, host) {
    const cont = el.querySelector('#dash-relicario');
    if (!cont) return;

    const todas = pacote.reliquias || [];
    if (!todas.length) { cont.innerHTML = ''; return; }

    // Cinco, e só cinco: a sexta quebrava a linha e ficava órfã.
    const fixadas = (pacote.reliquias_fixadas || [])
      .map(cod => todas.find(c => c.codigo === cod)).filter(Boolean);
    const desb = (fixadas.length ? fixadas : todas).slice(0, 5);
    if (!desb.length) {
      cont.innerHTML = `<span class="hunter-relicario-lbl">Nenhuma relíquia ainda — cumpra missões</span>`;
      return;
    }

    const medalha = c => (typeof ConquistaFX !== 'undefined' && ConquistaFX.miniMedalha)
      ? ConquistaFX.miniMedalha(c, 34) : (c.icone || '🏆');

    // Sem `title`: quem conta a história da relíquia é o BadgeCard.
    cont.innerHTML = `<span class="hunter-relicario-lbl">Relíquias</span>`
      + desb.map(c => `<span class="hunter-reliquia" data-bc="${c.codigo}">${medalha(c)}</span>`).join('')
      + (todas.length > 1
          ? `<button class="hunter-relicario-editar" id="dash-altar"
               title="Escolher quais relíquias exibir">✎</button>` : '');

    // Os cliques NÃO sabem para onde vão: quem sabe é o hospedeiro.
    cont.querySelectorAll('.hunter-reliquia').forEach(n =>
      host.ouvir(n, 'click', () => host.acao('ver-reliquias')));
    const editar = cont.querySelector('#dash-altar');
    if (editar) host.ouvir(editar, 'click', () => host.acao('editar-altar'));

    /* `ligarTodos` varre o DOCUMENTO inteiro, não o contêiner. Com
       `#dash-relicario` ele alcançaria o relicário de qualquer outra
       instância desta peça na página — e como o id se repete, a
       segunda instância roubaria os cartões da primeira. O selo da
       instância prende a varredura aqui dentro. */
    el.dataset.pecaSelo = host.selo;
    window.BadgeCard?.ligarTodos(`[data-peca-selo="${host.selo}"] [data-bc]`, desb);
  },

  /* ── Contagem animada dos cristais ──
     `host.quadro` devolvendo false encerra o laço. Sem essa saída,
     um número que já chegou continuaria pedindo quadros para
     sempre — três cristais, três laços eternos por instância. */
  contar(el, alvo, host, animar, dur = 900) {
    if (!el) return;
    const fmt = n => Math.round(n).toLocaleString('pt-BR');
    if (!animar || !host) { el.textContent = fmt(alvo); return; }
    const t0 = performance.now();
    host.quadro((t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(alvo * eased);
      return p < 1;              // false encerra
    });
  },

  /* ── Partículas de mana ──
     O laço original tinha um só freio: `if (!canvas.isConnected)`.
     Agora tem os três do host — e o ouvinte de `resize`, que antes
     ficava pendurado em `window` para sempre, é recolhido no
     desmonte. */
  fx(el, host) {
    const canvas = el.querySelector('.hunter-window-fx');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0, H = 0;
    const ajustar = () => {
      const r = canvas.getBoundingClientRect();
      W = canvas.width = r.width; H = canvas.height = r.height;
    };
    ajustar();
    host.ouvir(window, 'resize', ajustar);

    const ps = Array.from({ length: 26 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.6 + .4,
      v: Math.random() * .00035 + .00012,
      a: Math.random() * .5 + .15,
    }));

    host.quadro(() => {
      ctx.clearRect(0, 0, W, H);
      // A cor vem do PRÓPRIO contêiner, não de #hunter-card.
      const cor = getComputedStyle(el).getPropertyValue('--rank-cor').trim() || '#a855f7';
      ps.forEach(p => {
        p.y -= p.v;
        if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
        ctx.fillStyle = cor;
        ctx.globalAlpha = p.a;
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    });
  },
};

/* ══════════════════════════════════════════════════════════
   O REGISTRO
   ══════════════════════════════════════════════════════════ */
if (typeof Pecas !== 'undefined') {
  Pecas.registrar({
    id: 'hunter-card-classico',
    nome: 'Janela de Status',
    familia: 'banner',
    padrao: true,          // a rede de segurança de todas as outras
    precisa: ['hunter'],

    montar(el, dados, host) {
      el.innerHTML = HunterCardClassico.esqueleto();
      HunterCardClassico.botaoAura(el, host);
      HunterCardClassico.pintar(el, dados, host, true);
      HunterCardClassico.fx(el, host);
      const editar = el.querySelector('#dash-btn-editar-perfil');
      if (editar) host.ouvir(editar, 'click', () => host.acao('editar-perfil'));
    },

    // Repinta sem apagar: nada de piscar a cada missão iniciada.
    atualizar(el, dados, host) {
      HunterCardClassico.pintar(el, dados, host, false);
    },

    /* Não há destruir(): timers e ouvintes já são recolhidos pelo
       registro. Esta ausência é deliberada — e é o teste de que o
       contrato realmente dispensa disciplina. */
  });
}

window.HunterCardClassico = HunterCardClassico;
