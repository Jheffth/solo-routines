/* ============================================================
   auras.js — Auras dos Hunters

   A aura antiga do Arquiteto era um borrão de CSS: gradiente
   radial deslocado (50% 68%) com turbulência SVG por cima. Dava
   a impressão de fogo, mas era assimétrica por construção e não
   dava para reaproveitar.

   Aqui a aura é SVG e toda forma nasce de repetição radial em
   torno do centro.

   POR QUE ELA PULSA E NÃO GIRA — medido, não achismo:
   a primeira versão tinha camadas girando em sentidos opostos.
   Parada, o espelho dava 0,03 de desvio; girando, dava 27,6.
   Cada camada mantém o próprio eixo de simetria ao girar, mas os
   eixos das duas deixam de coincidir, e a figura perde o espelho.
   Escala a partir do centro, ao contrário, preserva a simetria em
   TODOS os quadros — e fogo pulsa, não roda. Verificado por teste
   comparando a metade esquerda com a direita invertida.

   REGISTRO: para criar a aura de um novo rank ou cargo, basta
       Auras.registrar('nome', tam => svg);
   e usar Auras.svg('nome', tam). Nada mais precisa mudar.
   ============================================================ */

const Auras = {
  _seq: 0,
  _registro: {},

  registrar(id, desenhar) {
    if (id && typeof desenhar === 'function') this._registro[id] = desenhar;
  },

  svg(id, tam = 260) {
    const fn = this._registro[id];
    if (!fn) return '';
    try { return this._idsUnicos(fn(tam)); } catch (_) { return ''; }
  },

  /* ── Componente autossuficiente ───────────────────────────────────
     Devolve a aura JÁ EMBRULHADA e com o posicionamento em atributo
     `style`, sem depender de nenhuma folha externa.

     Motivo: a aura ficou invisível em produção porque o CSS dela não
     estava sendo servido (404). O desenho estava no DOM, correto, e
     mesmo assim não aparecia — um componente que só funciona se um
     segundo arquivo chegar é um componente frágil. As animações vão
     dentro do próprio SVG, num <style>, pelo mesmo motivo. */
  bloco(id, tam = 212) {
    const svg = this.svg(id, tam);
    if (!svg) return '';
    // A LARGURA DO WRAP É OBRIGATÓRIA. O projeto tem uma regra global
    // `img, svg { max-width: 100% }` em design-system.css. Sem largura
    // aqui, o 100% resolve contra um contêiner sem tamanho e o desenho
    // colapsa: fica no DOM, íntegro, e invisível na tela. Foi exatamente
    // o que aconteceu — e custou várias rodadas até medir o elemento.
    return `<div class="aura-wrap" style="position:absolute;top:50%;left:50%;
      width:${tam}px;height:${tam}px;
      transform:translate(-50%,-50%);pointer-events:none;z-index:0;line-height:0"
      >${svg}</div>`;
  },

  /* Estilo que viaja junto do desenho. Os nomes são prefixados para
     não colidirem com nada do resto do app. */
  _estilo() {
    return `
    <style>
      .aura-svg { display:block; overflow:visible; }
      .aura-halo, .aura-arder, .aura-arder2, .aura-brasas {
        transform-origin: 150px 150px;
      }
      /* GIRO CONTINUO. Houve uma versao em passos, com steps(12), que
         mantinha o espelho perfeito em todo quadro — e ficou truncada,
         sem fluidez. A licao: simetria estrita e requisito de EMBLEMA,
         nao de aura. Aura e brilho atras do avatar; ninguem a le
         procurando eixo, e travar o giro para ganhar um numero de teste
         custou justamente o impacto, que era o objetivo.

         Camadas em velocidades e sentidos diferentes: e a defasagem
         entre elas que da a sensacao de fogo vivo em vez de disco
         girando.

         ARMADILHA #1 DO PROJETO: girar e pulsar mexem os dois em
         transform. Declaradas juntas, a segunda anula a primeira. Por
         isso cada camada tem DOIS grupos aninhados: o de fora gira, o
         de dentro respira.

         ATENCAO: comentario dentro de template literal — nada de crase
         aqui dentro, e um unico par de abre-fecha de comentario. Um
         fecha sobrando joga texto solto no CSS, o navegador descarta as
         regras seguintes e a aura se espalha pela tela. */
      .aura-r1, .aura-r2, .aura-r3 { transform-origin: 150px 150px; }
      .aura-r1 { animation: aura-girar 46s linear infinite; }
      .aura-r2 { animation: aura-girar 31s linear infinite reverse; }
      .aura-r3 { animation: aura-girar 22s linear infinite; }
      .aura-arder  { transform-origin: 150px 150px;
                     animation: aura-respirar-a 3.4s ease-in-out infinite; }
      .aura-arder2 { transform-origin: 150px 150px;
                     animation: aura-respirar-b 2.3s ease-in-out infinite; }
      .aura-brasas { transform-origin: 150px 150px;
                     animation: aura-cintilar 1.7s ease-in-out infinite; }
      .aura-halo   { animation: aura-halo-pulso 5s ease-in-out infinite; }
      .aura-calor  { animation: aura-calor 6.5s ease-in-out infinite; }
      @keyframes aura-girar { to { transform: rotate(360deg); } }
      /* PERFORMANCE: o calor tem blur de 16px. Animar a escala obrigaria
         o navegador a re-rasterizar esse borrao a cada quadro — o caso
         mais caro de filtro SVG. Animando so a opacidade, o borrao e
         calculado UMA vez e a variacao roda no compositor, de graca. A
         pulsacao de tamanho se perde, mas num halo difuso ninguem nota.
         (Nada de crase neste comentario: ele vive num template literal.) */
      @keyframes aura-calor {
        0%,100% { opacity:.45; }
        50%     { opacity:.95; }
      }
      @keyframes aura-respirar-a {
        0%,100% { transform: scale(1);     opacity:.92; }
        50%     { transform: scale(1.075); opacity:1;   }
      }
      @keyframes aura-respirar-b {
        0%,100% { transform: scale(1.05);  opacity:.78; }
        50%     { transform: scale(.955);  opacity:1;   }
      }
      @keyframes aura-cintilar {
        0%,100% { transform: scale(1);     opacity:.35; }
        50%     { transform: scale(1.11);  opacity:.8;  }
      }
      @keyframes aura-halo-pulso {
        0%,100% { transform: scale(1);     opacity:.7;  }
        50%     { transform: scale(1.09);  opacity:1;   }
      }
      @media (prefers-reduced-motion: reduce) {
        .aura-halo, .aura-arder, .aura-arder2, .aura-brasas,
        .aura-calor, .aura-r1, .aura-r2, .aura-r3 { animation: none; }
      }
    </style>`;
  },

  existe(id) { return !!this._registro[id]; },

  /* Qual aura cabe a cada cargo. Um lugar só decide isso — assim uma
     tela nova não precisa reescrever a regra, e mudar a política de
     cargos não vira caça a `if` espalhado pelo projeto. */
  porCargo(nivelAcesso) {
    const n = (nivelAcesso || '').toLowerCase();
    if (n === 'arquiteto') return 'arquiteto';
    if (n === 'admin' || n === 'criador') return 'admin';
    return null;
  },

  /* ── O SENTINELA DE "NENHUMA AURA" ────────────────────────────────
     Espelha o `SEM_AURA` de routers/perfil.py. Os dois lados precisam
     concordar na string, e o backend é quem manda: ele devolve o valor
     em `sem_aura` na resposta do inventário. */
  SEM_AURA: '__nenhuma',

  /* ── QUEM DECIDE QUAL AURA DESENHAR ───────────────────────────────

     São TRÊS estados, e essa era a origem da confusão:

       null / vazio  →  sem cosmética; vale a aura do CARGO
       '__nenhuma'   →  o hunter escolheu não ter aura NENHUMA
       '<id>'        →  uma cosmética específica

     Antes cada lugar reimplementava a regra com um `||` — e todos
     tratavam os dois primeiros como a mesma coisa, o que fazia o
     Arquiteto ficar preso à própria aura de cargo sem saída.

     Devolve o id a desenhar, ou `null` para não desenhar nada. */
  resolver(auraId, nivelAcesso) {
    if (auraId === this.SEM_AURA) return null;
    if (auraId && this.existe(auraId)) return auraId;
    const cargo = this.porCargo(nivelAcesso);
    return (cargo && this.existe(cargo)) ? cargo : null;
  },

  /* O bloco pronto, já resolvido. É o que as peças chamam. */
  blocoDe(auraId, nivelAcesso, tam = 168) {
    const id = this.resolver(auraId, nivelAcesso);
    return id ? this.bloco(id, tam) : '';
  },

  /* Desenha a aura do cargo direto no hexágono, trocando a anterior. */
  aplicar(hexWrap, nivelAcesso, tam = 168) {
    if (!hexWrap) return false;
    hexWrap.classList.remove('chamas-arquiteto');   // resquício da aura antiga
    hexWrap.querySelector('.aura-wrap')?.remove();
    const id = this.porCargo(nivelAcesso);
    if (!id || !this.existe(id)) return false;
    hexWrap.insertAdjacentHTML('afterbegin', this.bloco(id, tam));
    return true;
  },

  /* ── Trava contra CSS quebrado ────────────────────────────────────
     O estilo viaja dentro do SVG, e CSS malformado NAO gera erro: o
     navegador descarta as regras a partir do ponto ruim, em silencio.
     Foi assim que um fecha-comentario sobrando derrubou o
     transform-origin das camadas e espalhou a aura pela tela, sem uma
     linha sequer no console. Este conferidor existe para nao repetir.
     (E sim: escrever o simbolo de fecha-comentario aqui dentro fecharia
     este proprio comentario. Por isso ele esta descrito por extenso.) */
  conferirEstilo() {
    const css = this._estilo().replace(/<\/?style>/g, '');
    const erros = [];
    const abre = (css.match(/\/\*/g) || []).length;
    const fecha = (css.match(/\*\//g) || []).length;
    if (abre !== fecha) erros.push(`comentários ${abre}/${fecha}`);

    const limpo = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const chaves = (limpo.match(/{/g) || []).length - (limpo.match(/}/g) || []).length;
    if (chaves !== 0) erros.push(`chaves desbalanceadas (${chaves})`);

    const solto = limpo.split('\n').map(l => l.trim()).filter(l =>
      l && !l.startsWith('.') && !l.startsWith('@') && !l.startsWith('}')
      && !l.includes('{') && !l.includes(':') && !l.includes('}'));
    if (solto.length) erros.push(`texto solto: "${solto[0].slice(0, 40)}"`);

    return erros;
  },

  /* Mesma armadilha das medalhas: <defs> com ids fixos colidem quando
     há duas auras na página, e o navegador resolve url(#id) para a
     primeira ocorrência — a segunda sai sem pintura. */
  _idsUnicos(svg) {
    if (!svg) return svg;
    const selo = `a${++this._seq}`;
    const ids = new Set();
    svg.replace(/\sid="([^"]+)"/g, (_, id) => { ids.add(id); return ''; });
    ids.forEach(id => {
      const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      svg = svg.replace(new RegExp(`\\sid="${esc}"`, 'g'), ` id="${id}-${selo}"`)
               .replace(new RegExp(`url\\(#${esc}\\)`, 'g'), `url(#${id}-${selo})`);
    });
    return svg;
  },

  /* ── Fábrica de chamas radiais ────────────────────────────────────
     Desenha UMA língua de fogo apontando para cima e a repete por
     rotação. `dobras` define a simetria: 12 dobras significa que a
     figura se repete a cada 30°, então em qualquer ângulo da animação
     ela continua equilibrada. */
  _coroaDeChamas({ dobras, raioInterno, alcances, largura, preenchimento,
                   opacidade = 1, defasagem = 0 }) {
    const C = 150, formas = [];
    const lista = Array.isArray(alcances) ? alcances : [alcances];

    for (let i = 0; i < dobras; i++) {
      const ang = (360 / dobras) * i + defasagem;
      // Comprimentos alternados dão o desenho irregular do fogo. Como o
      // ciclo divide o número de dobras, a simetria continua exata.
      const a = lista[i % lista.length];
      const w = largura * (a / Math.max(...lista));
      const base  = C - raioInterno;
      const ponta = base - a;

      // Barriga larga perto da base, afinando até uma PONTA. A versão
      // anterior fechava com curva cheia nas duas pontas e o resultado
      // parecia pétala de girassol, não língua de fogo.
      formas.push(`
        <path d="M 150 ${base}
                 C ${150 - w} ${base - a * 0.14},
                   ${150 - w * 0.82} ${base - a * 0.52},
                   ${150 - w * 0.20} ${base - a * 0.84}
                 Q ${150 - w * 0.05} ${base - a * 0.95}, 150 ${ponta}
                 Q ${150 + w * 0.05} ${base - a * 0.95},
                   ${150 + w * 0.20} ${base - a * 0.84}
                 C ${150 + w * 0.82} ${base - a * 0.52},
                   ${150 + w} ${base - a * 0.14},
                   150 ${base} Z"
              transform="rotate(${ang} ${C} ${C})"
              fill="${preenchimento}" opacity="${opacidade}"/>`);
    }
    return formas.join('');
  },
};

/* ══════════════════════════════════════════════════════════════════
   AURA DO ARQUITETO — "A Forja Viva"
   Ouro incandescente com o roxo do Sistema nas pontas. Três coroas
   de chamas em velocidades e sentidos diferentes, mais um halo que
   respira no centro. Nada aqui é desenhado fora do eixo.
   ══════════════════════════════════════════════════════════════════ */
Auras.registrar('arquiteto', function (tam) {
  /* ATENÇÃO ao mexer: comprimentos alternados só preservam o espelho
     quando a defasagem é ZERO. Com defasagem 15° e alternância, o
     espelho de 15° cai em 345°, que no ciclo é a chama CURTA enquanto
     15° é a longa — e a figura desequilibra (medido: 4,93 de desvio
     contra 0,03). Camada deslocada usa comprimento uniforme. */
  const grandes = Auras._coroaDeChamas({
    dobras: 12, raioInterno: 64, alcances: [78, 52], largura: 17,
    preenchimento: 'url(#auraOuro)',
  });
  const medias = Auras._coroaDeChamas({
    dobras: 12, raioInterno: 66, alcances: 36, largura: 10,
    preenchimento: 'url(#auraBranco)', opacidade: .9, defasagem: 15,
  });
  const brasas = Auras._coroaDeChamas({
    dobras: 24, raioInterno: 68, alcances: 16, largura: 4,
    preenchimento: '#fff4c8', opacidade: .55, defasagem: 7.5,
  });

  return `
  <svg viewBox="0 0 300 300" width="${tam}" height="${tam}"
       class="aura-svg" aria-hidden="true" focusable="false"
       style="display:block;overflow:visible;max-width:none;width:${tam}px;height:${tam}px">
    ${Auras._estilo()}
    <defs>
      <linearGradient id="auraOuro" x1="0.5" y1="0" x2="0.5" y2="1">
        <stop offset="0%"   stop-color="#f0abfc" stop-opacity="0"/>
        <stop offset="18%"  stop-color="#c084fc" stop-opacity=".55"/>
        <stop offset="42%"  stop-color="#fb923c" stop-opacity=".85"/>
        <stop offset="72%"  stop-color="#fbbf24"/>
        <stop offset="100%" stop-color="#fff4c8"/>
      </linearGradient>
      <linearGradient id="auraBranco" x1="0.5" y1="0" x2="0.5" y2="1">
        <stop offset="0%"   stop-color="#fde68a" stop-opacity="0"/>
        <stop offset="45%"  stop-color="#fcd34d" stop-opacity=".8"/>
        <stop offset="100%" stop-color="#fffbeb"/>
      </linearGradient>
      <!-- Vazado no miolo: ali fica o hexágono. Cheio, virava um
           borrão escuro em volta do avatar. -->
      <radialGradient id="auraHalo" cx="50%" cy="50%">
        <stop offset="0%"   stop-color="#fff4c8" stop-opacity="0"/>
        <stop offset="46%"  stop-color="#fff4c8" stop-opacity="0"/>
        <stop offset="56%"  stop-color="#fff4c8" stop-opacity=".30"/>
        <stop offset="72%"  stop-color="#fbbf24" stop-opacity=".18"/>
        <stop offset="100%" stop-color="#f97316" stop-opacity="0"/>
      </radialGradient>
      <!-- Calor: laranja no miolo sangrando para magenta e roxo nas
           bordas. É a mistura que a aura de CSS antiga acertava. -->
      <!-- O miolo fica LIMPO até 44%: ali entra o hexágono. Laranja
           translúcido sobre fundo preto vira barro, e o resultado era
           um anel sujo em volta do avatar. O brilho começa onde as
           chamas começam. -->
      <radialGradient id="auraCalor" cx="50%" cy="50%">
        <stop offset="0%"   stop-color="#fbbf24" stop-opacity="0"/>
        <stop offset="44%"  stop-color="#fbbf24" stop-opacity="0"/>
        <stop offset="58%"  stop-color="#fcd34d" stop-opacity=".50"/>
        <stop offset="74%"  stop-color="#fb923c" stop-opacity=".38"/>
        <stop offset="88%"  stop-color="#e879f9" stop-opacity=".20"/>
        <stop offset="100%" stop-color="#a855f7" stop-opacity="0"/>
      </radialGradient>
      <filter id="auraFundir" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="16"/>
      </filter>
      <filter id="auraGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="4.5"/>
      </filter>
      <filter id="auraSuave" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="1.6"/>
      </filter>
    </defs>

    <!-- Calor: o borrão largo que a aura antiga tinha e a minha perdeu.
         É ele que dá o impacto de fogo, antes de qualquer forma. -->
    <circle cx="150" cy="150" r="134" fill="url(#auraCalor)"
            class="aura-calor" filter="url(#auraFundir)"/>
    <circle cx="150" cy="150" r="120" fill="url(#auraHalo)" class="aura-halo"/>

    <g class="aura-r1"><g class="aura-arder"  filter="url(#auraGlow)">${grandes}</g></g>
    <g class="aura-r2"><g class="aura-arder2" filter="url(#auraSuave)">${medias}</g></g>
    <g class="aura-r3"><g class="aura-brasas">${brasas}</g></g>
  </svg>`;
});

/* ── Vitrine de auras ─────────────────────────────────────────────
   Diagnóstico de um clique: se este painel abrir, auras.js carregou
   e as auras desenham. Se o comando não existir no console, o
   arquivo não chegou ao navegador — é cache ou o servidor não está
   entregando js/auras.js. */
Auras.vitrine = function (filtroId) {
  const velha = document.getElementById('aura-vitrine');
  if (velha) { velha.remove(); if (!filtroId) return; }

  const todos = Object.keys(Auras._registro);
  const ids   = filtroId ? (Auras.existe(filtroId) ? [filtroId] : []) : todos;
  if (!ids.length) { if (typeof SoloDialog !== 'undefined') SoloDialog.toast(`Aura "${filtroId}" nao registrada`, 'error'); return; }

  const cx = document.createElement('div');
  cx.id = 'aura-vitrine';
  cx.style.cssText = `position:fixed;inset:0;z-index:9997;display:flex;align-items:center;
    justify-content:center;background:rgba(3,3,8,.92);backdrop-filter:blur(7px);padding:1.2rem`;

  cx.innerHTML = `
    <div style="width:min(760px,100%);max-height:88vh;overflow-y:auto;padding:1.5rem;
      background:linear-gradient(170deg,#1a1206,#0a0714 65%);
      border:1px solid rgba(251,191,36,.45);border-radius:18px">
      <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:1.2rem">
        <span style="font-size:1.2rem">🔥</span>
        <div style="flex:1">
          <div style="font-family:var(--font-title);font-size:1rem;color:var(--gold-bright)">
            Vitrine de Auras</div>
          <div style="font-family:var(--font-section);font-size:.6rem;letter-spacing:.14em;
            color:var(--text-muted)">${ids.length} REGISTRADA(S) · SE VOCÊ VÊ ISTO, auras.js CARREGOU</div>
        </div>
        <button onclick="document.getElementById('aura-vitrine').remove()"
          style="background:none;border:none;color:var(--text-muted);font-size:1.1rem;
          cursor:pointer">✕</button>
      </div>
      ${ids.map(id => `
        <div style="display:flex;align-items:center;gap:2rem;padding:1rem;margin-bottom:.7rem;
          border-radius:14px;background:rgba(255,255,255,.03);
          border:1px solid rgba(251,191,36,.22)">
          <div style="position:relative;width:212px;height:212px;flex-shrink:0;
            display:flex;align-items:center;justify-content:center">
            ${Auras.bloco(id, 212)}
            <div style="position:relative;z-index:2;width:112px;height:112px;
              background:linear-gradient(150deg,#3b2a6b,#1b3a5c);
              clip-path:polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)"></div>
          </div>
          <div style="flex:1">
            <div style="font-family:var(--font-section);font-size:.95rem;font-weight:700;
              color:var(--text-primary)">${id}</div>
            <div style="font-family:var(--font-section);font-size:.68rem;
              color:var(--text-muted);margin-top:.3rem">
              aura registrada · desenhada sobre um hexágono de 112px</div>
          </div>
        </div>`).join('')}
    </div>`;
  cx.addEventListener('click', e => { if (e.target === cx) cx.remove(); });
  document.body.appendChild(cx);
};

/* ── Diagnóstico ──────────────────────────────────────────────────
   Lê o DOM de verdade e diz onde a aura parou. Existe porque houve
   uma sequência de tentativas às cegas: o desenho estava correto e
   invisível, e sem medir o elemento renderizado não dava para saber
   se o problema era JS, CSS, posicionamento ou entrega de arquivo. */
Auras.diagnostico = function () {
  const L = [];
  const diz = (k, v) => L.push(`${String(k).padEnd(26)} ${v}`);

  diz('auras.js carregado', 'sim');
  diz('auras registradas', Object.keys(Auras._registro).join(', ') || '(nenhuma)');

  // O CSS viaja dentro do SVG. Um comentário mal fechado ali derruba as
  // regras seguintes em silêncio — e a aura se espalha pela tela, sem
  // nenhum erro no console. Já aconteceu; agora é conferido.
  const problemas = Auras.conferirEstilo();
  diz('css embutido', problemas.length ? 'QUEBRADO: ' + problemas.join('; ') : 'íntegro');

  // auras.css foi removido de propósito: o estilo viaja embutido no SVG.
  // Se a folha reaparecer, alguém a ressuscitou sem necessidade.
  const folha = [...document.styleSheets].some(s =>
    (s.href || '').includes('auras.css'));
  diz('estilo', folha ? 'folha externa (obsoleta) + embutido' : 'embutido (correto)');

  const wrap = document.querySelector('.aura-wrap');
  if (!wrap) {
    diz('elemento .aura-wrap', 'AUSENTE — o perfil nao chamou _aura()');
    console.log('%c[AURA] diagnostico\n' + L.join('\n'), 'font-family:monospace');
    return;
  }

  const cs = getComputedStyle(wrap);
  const r  = wrap.getBoundingClientRect();
  diz('.aura-wrap position', cs.position + (cs.position === 'absolute' ? '' : '  <-- PROBLEMA'));
  diz('.aura-wrap style inline', wrap.getAttribute('style') ? 'sim (autossuficiente)' : 'NAO (versao antiga)');
  diz('.aura-wrap tamanho', `${Math.round(r.width)} x ${Math.round(r.height)}`);

  const svg = wrap.querySelector('svg');
  if (!svg) { diz('svg dentro do wrap', 'AUSENTE'); }
  else {
    const rs = svg.getBoundingClientRect();
    diz('svg tamanho renderizado', `${Math.round(rs.width)} x ${Math.round(rs.height)}`
      + (rs.width < 100 ? '  <-- ESMAGADO' : ''));
    diz('svg <style> embutido', svg.querySelector('style') ? 'sim' : 'nao');
    diz('chamas no DOM', svg.querySelectorAll('path').length);
    const p = svg.querySelector('path');
    if (p) {
      const rp = p.getBoundingClientRect();
      diz('1a chama pintada em', `${Math.round(rp.width)} x ${Math.round(rp.height)}`
        + (rp.width < 2 ? '  <-- NAO PINTOU' : ''));
      diz('fill da 1a chama', p.getAttribute('fill'));
      const alvo = (p.getAttribute('fill') || '').match(/#([^)]+)\)/);
      diz('gradiente existe?', alvo && svg.querySelector(`#${CSS.escape(alvo[1])}`) ? 'sim' : 'NAO — referencia quebrada');
    }
  }
  console.log('%c[AURA] diagnostico\n' + L.join('\n'), 'font-family:monospace');
};

/* ══════════════════════════════════════════════════════════════════
   AURA DO ADMINISTRADOR — "O Selo do Guardião"

   Deliberadamente o oposto da do Arquiteto. Lá é fogo: quente,
   orgânico, chamas que respiram. Aqui é selo: frio, geométrico,
   lâminas retas e um anel de guarda tracejado girando devagar.

   A diferença não é enfeite. Se os dois cargos usassem fogo
   dourado, a aura deixaria de dizer quem é quem — que é a única
   função dela. Arquiteto cria; Administrador guarda.
   ══════════════════════════════════════════════════════════════════ */
Auras.registrar('admin', function (tam) {
  const C = 150;

  /* Lâminas retas, sem curva: o Guardião não arde, ele corta. */
  const lamina = (ang, alcance, largura) => {
    const base = C - 66, ponta = base - alcance, ombro = base - alcance * 0.34;
    return `<polygon points="150,${base} ${150 - largura},${ombro}
              150,${ponta} ${150 + largura},${ombro}"
            transform="rotate(${ang} ${C} ${C})" fill="url(#adLamina)"
            stroke="#e0f2fe" stroke-width=".8" stroke-opacity=".55"/>`;
  };
  const grandes = [0, 60, 120, 180, 240, 300].map(a => lamina(a, 74, 15)).join('');
  const medias  = [30, 90, 150, 210, 270, 330].map(a => lamina(a, 44, 9)).join('');

  /* Marcas de guarda: 24 traços curtos, como escala de instrumento */
  const marcas = [];
  for (let i = 0; i < 24; i++) {
    const a = (Math.PI / 12) * i;
    const r2 = i % 2 === 0 ? 92 : 97;
    marcas.push(`M ${C + 102 * Math.cos(a)} ${C + 102 * Math.sin(a)}
                 L ${C + r2 * Math.cos(a)} ${C + r2 * Math.sin(a)}`);
  }

  return `
  <svg viewBox="0 0 300 300" width="${tam}" height="${tam}"
       class="aura-svg" aria-hidden="true" focusable="false"
       style="display:block;overflow:visible;max-width:none;width:${tam}px;height:${tam}px">
    ${Auras._estilo()}
    <defs>
      <linearGradient id="adLamina" x1="0.5" y1="0" x2="0.5" y2="1">
        <stop offset="0%"   stop-color="#e0f2fe"/>
        <stop offset="26%"  stop-color="#38bdf8"/>
        <stop offset="68%"  stop-color="#1d4ed8"/>
        <stop offset="100%" stop-color="#0b1a3a"/>
      </linearGradient>
      <radialGradient id="adCalor" cx="50%" cy="50%">
        <stop offset="0%"   stop-color="#38bdf8" stop-opacity="0"/>
        <stop offset="44%"  stop-color="#38bdf8" stop-opacity="0"/>
        <stop offset="58%"  stop-color="#7dd3fc" stop-opacity=".42"/>
        <stop offset="76%"  stop-color="#3b82f6" stop-opacity=".30"/>
        <stop offset="90%"  stop-color="#818cf8" stop-opacity=".16"/>
        <stop offset="100%" stop-color="#4338ca" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="adHalo" cx="50%" cy="50%">
        <stop offset="0%"   stop-color="#e0f2fe" stop-opacity="0"/>
        <stop offset="46%"  stop-color="#e0f2fe" stop-opacity="0"/>
        <stop offset="56%"  stop-color="#e0f2fe" stop-opacity=".26"/>
        <stop offset="74%"  stop-color="#38bdf8" stop-opacity=".16"/>
        <stop offset="100%" stop-color="#1d4ed8" stop-opacity="0"/>
      </radialGradient>
      <filter id="adFundir" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="15"/>
      </filter>
      <filter id="adGlow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="3.4"/>
      </filter>
    </defs>

    <circle cx="150" cy="150" r="132" fill="url(#adCalor)"
            class="aura-calor" filter="url(#adFundir)"/>
    <circle cx="150" cy="150" r="118" fill="url(#adHalo)" class="aura-halo"/>

    <!-- Anel de guarda: tracejado, gira devagar e no sentido único -->
    <g class="aura-r1">
      <circle cx="150" cy="150" r="102" fill="none" stroke="#38bdf8"
              stroke-width="1.6" stroke-opacity=".7"
              stroke-dasharray="14 12" filter="url(#adGlow)"/>
      <path d="${marcas.join(' ')}" stroke="#7dd3fc" stroke-width="1.5"
            stroke-opacity=".75"/>
    </g>

    <g class="aura-r2"><g class="aura-arder"  filter="url(#adGlow)">${grandes}</g></g>
    <g class="aura-r3"><g class="aura-arder2">${medias}</g></g>
  </svg>`;
});


/* ===================================================================
   AURA BELLA ROSA — Femme Fatale (redesign espetacular)
   11 camadas: halos, 4 grupos de pétalas, espinhos, 2 shimmers,
   faíscas em órbita, anel tracejado duplo. Raios até 145.
   =================================================================== */
Auras.registrar('bella-rosa', function (tam) {
  const C = 150;

  /* ── pétalas (curva Bézier) ─────────────────────────────────────── */
  const petalas = (n, aL, aC, rBase, larg, fill, op) => {
    const ps = [];
    for (let i = 0; i < n; i++) {
      const ang  = (360 / n) * i;
      const a    = i % 2 === 0 ? aL : aC;
      const w    = larg * (a / aL);
      const base = C - rBase, ponta = base - a;
      ps.push(
        `<path d="M ${C} ${base}` +
        ` C ${C-w} ${base-a*.12},${C-w*.75} ${base-a*.50},${C-w*.18} ${base-a*.82}` +
        ` Q ${C-w*.04} ${base-a*.94},${C} ${ponta}` +
        ` Q ${C+w*.04} ${base-a*.94},${C+w*.18} ${base-a*.82}` +
        ` C ${C+w*.75} ${base-a*.50},${C+w} ${base-a*.12},${C} ${base} Z"` +
        ` transform="rotate(${ang} ${C} ${C})" fill="${fill}" opacity="${op}"/>`);
    }
    return ps.join('');
  };

  /* ── espinhos finos pontudos ─────────────────────────────────────── */
  const espinhos = (n, rBase, larg, fill, op) => {
    const ps = [];
    for (let i = 0; i < n; i++) {
      const ang  = (360 / n) * i;
      const aL   = i % 2 === 0 ? 60 : 44;
      const w    = larg * (aL / 60);
      const base = C - rBase, ponta = base - aL;
      ps.push(
        `<path d="M ${C} ${base}` +
        ` C ${C-w} ${base-aL*.08},${C-w*.5} ${base-aL*.45},${C-w*.08} ${base-aL*.88}` +
        ` Q ${C} ${ponta},${C+w*.08} ${base-aL*.88}` +
        ` C ${C+w*.5} ${base-aL*.45},${C+w} ${base-aL*.08},${C} ${base} Z"` +
        ` transform="rotate(${ang} ${C} ${C})" fill="${fill}" opacity="${op}"/>`);
    }
    return ps.join('');
  };

  /* ── shimmer em anel ─────────────────────────────────────────────── */
  const shimmer = (n, r, w1, w2, sw, op) => {
    const ps = [];
    for (let i = 0; i < n; i++) {
      const ang = (360 / n) * i, a = (ang - 90) * Math.PI / 180;
      const x1 = C + (r - w1) * Math.cos(a), y1 = C + (r - w1) * Math.sin(a);
      const x2 = C + (r + w2) * Math.cos(a), y2 = C + (r + w2) * Math.sin(a);
      ps.push(
        `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}"` +
        ` x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"` +
        ` stroke="#fff" stroke-width="${sw}" stroke-opacity="${op}" stroke-linecap="round"/>`);
    }
    return ps.join('');
  };

  /* ── faíscas em órbita ──────────────────────────────────────────── */
  const faiscas = (n, rMin, rMax, fill) => {
    const ps = [];
    for (let i = 0; i < n; i++) {
      const ang = (360 / n) * i, a = (ang - 90) * Math.PI / 180;
      const r   = rMin + (rMax - rMin) * (i % 3) / 2;
      const x   = C + r * Math.cos(a), y = C + r * Math.sin(a);
      const del = (i * 0.22).toFixed(2);
      ps.push(
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.2" fill="${fill}"` +
        ` opacity="0.7" style="animation:ps-spark 1.8s ${del}s ease-in-out infinite"/>`);
    }
    return ps.join('');
  };

  /* ── construção das camadas ─────────────────────────────────────── */
  const pExt  = petalas(20, 72, 48, 30, 16, 'url(#psPF)',  .60);
  const espnh = espinhos(24, 28, 20, 'url(#psEsp)', .50);
  const pMed  = petalas(16, 52, 34, 24, 12, 'url(#psPM)',  .70);
  const pInt  = petalas(20, 36, 22, 18,  9, 'url(#psPT)',  .90);
  const shExt = shimmer(32, 118, 6, 4, 1.6, .60);
  const shInt = shimmer(24,  88, 5, 3, 1.2, .45);
  const sparks = faiscas(8, 96, 108, '#ff80ab');

  return `
  <svg viewBox="0 0 300 300" width="${tam}" height="${tam}"
       class="aura-svg" aria-hidden="true" focusable="false"
       style="display:block;overflow:visible;max-width:none;width:${tam}px;height:${tam}px">
    <style>
      .ps-r1{transform-origin:150px 150px;animation:ps-spin1 80s linear infinite}
      .ps-r2{transform-origin:150px 150px;animation:ps-spin2 55s linear infinite reverse}
      .ps-r3{transform-origin:150px 150px;animation:ps-spin3 32s linear infinite}
      .ps-r4{transform-origin:150px 150px;animation:ps-spin4 120s linear infinite reverse}
      .ps-bloom{transform-origin:150px 150px;animation:ps-bloom 4s ease-in-out infinite}
      .ps-pulse{transform-origin:150px 150px;animation:ps-pulse 2.8s ease-in-out infinite reverse}
      .ps-halo{animation:ps-halo 6s ease-in-out infinite}
      @keyframes ps-spin1{to{transform:rotate(360deg)}}
      @keyframes ps-spin2{to{transform:rotate(-360deg)}}
      @keyframes ps-spin3{to{transform:rotate(360deg)}}
      @keyframes ps-spin4{to{transform:rotate(-360deg)}}
      @keyframes ps-bloom{0%,100%{transform:scale(1);opacity:.8}50%{transform:scale(1.09);opacity:1}}
      @keyframes ps-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
      @keyframes ps-halo{0%,100%{opacity:.3}50%{opacity:.85}}
      @keyframes ps-spark{0%,100%{opacity:0}50%{opacity:1}}
      @media(prefers-reduced-motion:reduce){
        .ps-r1,.ps-r2,.ps-r3,.ps-r4,.ps-bloom,.ps-pulse,.ps-halo{animation:none}
        circle[style*="ps-spark"]{animation:none!important}
      }
    </style>
    <defs>
      <!-- Gradientes pétalas -->
      <radialGradient id="psPF" cx="50%" cy="18%">
        <stop offset="0%"   stop-color="#c2185b" stop-opacity=".90"/>
        <stop offset="30%"  stop-color="#ffffff" stop-opacity=".95"/>
        <stop offset="65%"  stop-color="#ff69b4" stop-opacity=".65"/>
        <stop offset="100%" stop-color="#e91e63" stop-opacity=".15"/>
      </radialGradient>
      <radialGradient id="psPM" cx="50%" cy="18%">
        <stop offset="0%"   stop-color="#ffffff" stop-opacity="1"/>
        <stop offset="35%"  stop-color="#ff80ab" stop-opacity=".92"/>
        <stop offset="75%"  stop-color="#ff1493" stop-opacity=".55"/>
        <stop offset="100%" stop-color="#e91e63" stop-opacity=".18"/>
      </radialGradient>
      <radialGradient id="psPT" cx="50%" cy="15%">
        <stop offset="0%"   stop-color="#ffffff" stop-opacity="1"/>
        <stop offset="40%"  stop-color="#fce4ec" stop-opacity=".95"/>
        <stop offset="80%"  stop-color="#f48fb1" stop-opacity=".70"/>
        <stop offset="100%" stop-color="#ff69b4" stop-opacity=".25"/>
      </radialGradient>
      <!-- Gradiente espinhos -->
      <radialGradient id="psEsp" cx="50%" cy="12%">
        <stop offset="0%"   stop-color="#ffffff" stop-opacity="1"/>
        <stop offset="50%"  stop-color="#fce4ec" stop-opacity=".80"/>
        <stop offset="100%" stop-color="#ff1493" stop-opacity=".20"/>
      </radialGradient>
      <!-- Halos -->
      <radialGradient id="psHalo1" cx="50%" cy="50%">
        <stop offset="0%"   stop-color="#e91e63" stop-opacity="0"/>
        <stop offset="45%"  stop-color="#e91e63" stop-opacity="0"/>
        <stop offset="62%"  stop-color="#ff1493" stop-opacity=".22"/>
        <stop offset="78%"  stop-color="#e91e63" stop-opacity=".40"/>
        <stop offset="90%"  stop-color="#c2185b" stop-opacity=".20"/>
        <stop offset="100%" stop-color="#880e4f" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="psHalo2" cx="50%" cy="50%">
        <stop offset="0%"   stop-color="#f48fb1" stop-opacity="0"/>
        <stop offset="40%"  stop-color="#f48fb1" stop-opacity="0"/>
        <stop offset="58%"  stop-color="#fce4ec" stop-opacity=".30"/>
        <stop offset="75%"  stop-color="#f48fb1" stop-opacity=".18"/>
        <stop offset="90%"  stop-color="#ff80ab" stop-opacity=".08"/>
        <stop offset="100%" stop-color="#f48fb1" stop-opacity="0"/>
      </radialGradient>
      <!-- Filtros -->
      <filter id="psGlow"  x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="18"/></filter>
      <filter id="psBlur"  x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
      <filter id="psSharp" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2"/></filter>
      <filter id="psSpark" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1"/></filter>
    </defs>

    <!-- Camada 0a: Halo exterior grande (r≈145) pulsante magenta -->
    <circle cx="${C}" cy="${C}" r="145" fill="url(#psHalo1)" class="ps-halo" filter="url(#psGlow)"/>
    <!-- Camada 0b: Segundo halo médio (r≈125) branco/rose translúcido -->
    <circle cx="${C}" cy="${C}" r="125" fill="url(#psHalo2)" class="ps-halo" filter="url(#psBlur)"/>

    <!-- Camada 1: Pétalas externas grandes (20) gradiente rosa→magenta -->
    <g class="ps-r2"><g class="ps-bloom" filter="url(#psBlur)">${pExt}</g></g>

    <!-- Camada 2: Espinhos/cristais (24) branco→rosa vivo -->
    <g class="ps-r1"><g class="ps-pulse" filter="url(#psSharp)">${espnh}</g></g>

    <!-- Camada 3: Pétalas médias (16) branco→pink -->
    <g class="ps-r3"><g class="ps-bloom">${pMed}</g></g>

    <!-- Camada 4: Anel shimmer externo (r=118, 32 traços) -->
    <g class="ps-r4" filter="url(#psSharp)">${shExt}</g>

    <!-- Camada 5: Anel de faíscas em espiral (8 pontos piscando, r=96–108) -->
    <g class="ps-r1" filter="url(#psSpark)">${sparks}</g>

    <!-- Camada 6: Pétalas internas (20) muito luminosas -->
    <g class="ps-r2"><g class="ps-pulse">${pInt}</g></g>

    <!-- Camada 7: Anel shimmer interno (r=88, 24 traços) -->
    <g class="ps-r3" filter="url(#psSharp)">${shInt}</g>

    <!-- Camada 8: Anel tracejado duplo externo -->
    <g class="ps-r4">
      <circle cx="${C}" cy="${C}" r="132" fill="none"
              stroke="#ff80ab" stroke-width="1.2" stroke-opacity=".55"
              stroke-dasharray="12 8" filter="url(#psSharp)"/>
      <circle cx="${C}" cy="${C}" r="136" fill="none"
              stroke="#fce4ec" stroke-width="0.7" stroke-opacity=".35"
              stroke-dasharray="4 14" filter="url(#psSharp)"/>
    </g>
  </svg>`;
});

/* ===================================================================
   AURA PINK SPIRIT — Tradicional
   16 pétalas com shimmers luminosos.
   =================================================================== */
Auras.registrar('pink-spirit', function (tam) {
  const C = 150;

  /* 16 petalas alternando longas e curtas */
  const petalas = (aL, aC, rBase, larg, fill, op) => {
    const ps = [];
    for (let i = 0; i < 16; i++) {
      const ang = (360/16) * i;
      const a   = i % 2 === 0 ? aL : aC;
      const w   = larg * (a / aL);
      const base = C - rBase, ponta = base - a;
      ps.push(`<path d="M ${C} ${base}
               C ${C-w} ${base-a*.12}, ${C-w*.75} ${base-a*.50}, ${C-w*.18} ${base-a*.82}
               Q ${C-w*.04} ${base-a*.94}, ${C} ${ponta}
               Q ${C+w*.04} ${base-a*.94}, ${C+w*.18} ${base-a*.82}
               C ${C+w*.75} ${base-a*.50}, ${C+w} ${base-a*.12}, ${C} ${base} Z"
            transform="rotate(${ang} ${C} ${C})" fill="${fill}" opacity="${op}"/>`);
    }
    return ps.join('');
  };

  /* 24 tracos de shimmer em anel */
  const shimmer = (r, op) => {
    const ps = [];
    for (let i = 0; i < 24; i++) {
      const ang = (360/24)*i, a = (ang-90)*Math.PI/180;
      const x1 = C+(r-5)*Math.cos(a), y1 = C+(r-5)*Math.sin(a);
      const x2 = C+(r+3)*Math.cos(a), y2 = C+(r+3)*Math.sin(a);
      ps.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}"
                     x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
                     stroke="#fff" stroke-width="1.4" stroke-opacity="${op}"
                     stroke-linecap="round"/>`);
    }
    return ps.join('');
  };

  const pF = petalas(58,38,38,12,'url(#brPF)',.55);
  const pM = petalas(44,28,32,9, 'url(#brPM)',.72);
  const pT = petalas(30,18,26,7, 'url(#brPT)',.88);
  const sF = shimmer(100,.55);
  const sG = shimmer(88,.40);

  return `
  <svg viewBox="0 0 300 300" width="${tam}" height="${tam}"
       class="aura-svg" aria-hidden="true" focusable="false"
       style="display:block;overflow:visible;max-width:none;width:${tam}px;height:${tam}px">
    <style>
      .br-r1{transform-origin:150px 150px;animation:aura-girar 68s linear infinite}
      .br-r2{transform-origin:150px 150px;animation:aura-girar 45s linear infinite reverse}
      .br-r3{transform-origin:150px 150px;animation:aura-girar 29s linear infinite}
      .br-p{transform-origin:150px 150px;animation:br-bloom 4.8s ease-in-out infinite}
      .br-b{transform-origin:150px 150px;animation:br-bloom 3.2s ease-in-out infinite reverse}
      .br-h{animation:br-halo 7s ease-in-out infinite}
      @keyframes br-bloom{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.06);opacity:1}}
      @keyframes br-halo{0%,100%{opacity:.45}50%{opacity:.90}}
      @media(prefers-reduced-motion:reduce){.br-r1,.br-r2,.br-r3,.br-p,.br-b,.br-h{animation:none}}
    </style>
    <defs>
      <radialGradient id="brPF" cx="50%" cy="20%">
        <stop offset="0%"   stop-color="#fff"    stop-opacity=".97"/>
        <stop offset="35%"  stop-color="#fce4ec" stop-opacity=".80"/>
        <stop offset="70%"  stop-color="#f48fb1" stop-opacity=".50"/>
        <stop offset="100%" stop-color="#c2185b" stop-opacity=".15"/>
      </radialGradient>
      <radialGradient id="brPM" cx="50%" cy="18%">
        <stop offset="0%"   stop-color="#fff"    stop-opacity="1"/>
        <stop offset="40%"  stop-color="#f8bbd0" stop-opacity=".88"/>
        <stop offset="80%"  stop-color="#f06292" stop-opacity=".55"/>
        <stop offset="100%" stop-color="#880e4f" stop-opacity=".20"/>
      </radialGradient>
      <radialGradient id="brPT" cx="50%" cy="15%">
        <stop offset="0%"   stop-color="#fff"    stop-opacity="1"/>
        <stop offset="45%"  stop-color="#fce4ec" stop-opacity=".95"/>
        <stop offset="85%"  stop-color="#f48fb1" stop-opacity=".65"/>
        <stop offset="100%" stop-color="#e91e63" stop-opacity=".25"/>
      </radialGradient>
      <radialGradient id="brHalo" cx="50%" cy="50%">
        <stop offset="0%"   stop-color="#fff"    stop-opacity="0"/>
        <stop offset="42%"  stop-color="#fff"    stop-opacity="0"/>
        <stop offset="54%"  stop-color="#fce4ec" stop-opacity=".28"/>
        <stop offset="70%"  stop-color="#f48fb1" stop-opacity=".18"/>
        <stop offset="86%"  stop-color="#f06292" stop-opacity=".10"/>
        <stop offset="100%" stop-color="#e91e63" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="brCalor" cx="50%" cy="50%">
        <stop offset="0%"   stop-color="#f48fb1" stop-opacity="0"/>
        <stop offset="46%"  stop-color="#f48fb1" stop-opacity="0"/>
        <stop offset="60%"  stop-color="#fce4ec" stop-opacity=".35"/>
        <stop offset="78%"  stop-color="#f48fb1" stop-opacity=".22"/>
        <stop offset="92%"  stop-color="#e91e63" stop-opacity=".12"/>
        <stop offset="100%" stop-color="#880e4f" stop-opacity="0"/>
      </radialGradient>
      <filter id="brFundir" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="14"/></filter>
      <filter id="brGlow"   x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3"/></filter>
      <filter id="brShimmer" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.5"/></filter>
    </defs>
    <circle cx="${C}" cy="${C}" r="130" fill="url(#brCalor)" class="br-h" filter="url(#brFundir)"/>
    <circle cx="${C}" cy="${C}" r="115" fill="url(#brHalo)" class="br-h"/>
    <g class="br-r1" filter="url(#brShimmer)">${sF}</g>
    <g class="br-r2"><g class="br-p" filter="url(#brGlow)">${pF}</g></g>
    <g class="br-r3">${sG}</g>
    <g class="br-r1"><g class="br-b" filter="url(#brGlow)">${pM}</g></g>
    <g class="br-r2"><g class="br-p">${pT}</g></g>
    <g class="br-r3">
      <circle cx="${C}" cy="${C}" r="104" fill="none"
              stroke="#fce4ec" stroke-width="0.9" stroke-opacity=".65"
              stroke-dasharray="8 10" filter="url(#brGlow)"/>
    </g>
  </svg>`;
});

/* ===================================================================
   AURA FÊNIX — "Chama Imortal do Pioneiro"
   Inspirada no modelo S-Rank da Fênix: labaredas laranjas, âmbar e
   escarlates em rotação contínua, com coroas de penas em chamas,
   shimmer solar e brasas ascendentes em órbita.
   =================================================================== */
Auras.registrar('fenix-pioneira', function (tam) {
  const C = 150;

  /* Lâminas Solares (penas de chamas curvas) */
  const chamas = (n, aL, aC, rBase, larg, fill, op, curvar = 1) => {
    const ps = [];
    for (let i = 0; i < n; i++) {
      const ang = (360 / n) * i;
      const a = i % 2 === 0 ? aL : aC;
      const w = larg * (a / aL);
      const base = C - rBase, ponta = base - a;
      const kx = w * 0.35 * curvar;
      ps.push(
        `<path d="M ${C} ${base}` +
        ` C ${C - w} ${base - a * 0.15}, ${C - w * 0.8} ${base - a * 0.55}, ${C - w * 0.2 - kx} ${base - a * 0.85}` +
        ` Q ${C - kx} ${base - a * 0.96}, ${C + kx} ${ponta}` +
        ` Q ${C + w * 0.1 + kx} ${base - a * 0.94}, ${C + w * 0.25} ${base - a * 0.82}` +
        ` C ${C + w * 0.75} ${base - a * 0.50}, ${C + w} ${base - a * 0.12}, ${C} ${base} Z"` +
        ` transform="rotate(${ang} ${C} ${C})" fill="${fill}" opacity="${op}"/>`
      );
    }
    return ps.join('');
  };

  /* Raios solares afiados (lanças térmicas) */
  const lancas = (n, rBase, aL, larg, fill, op) => {
    const ps = [];
    for (let i = 0; i < n; i++) {
      const ang = (360 / n) * i;
      const w = larg;
      const base = C - rBase, ponta = base - aL;
      ps.push(
        `<path d="M ${C - w} ${base}` +
        ` Q ${C - w * 0.4} ${base - aL * 0.6}, ${C} ${ponta}` +
        ` Q ${C + w * 0.4} ${base - aL * 0.6}, ${C + w} ${base}` +
        ` Z" transform="rotate(${ang} ${C} ${C})" fill="${fill}" opacity="${op}"/>`
      );
    }
    return ps.join('');
  };

  /* Shimmer solar (traços brilhantes) */
  const shimmer = (n, r, w1, w2, sw, color, op) => {
    const ps = [];
    for (let i = 0; i < n; i++) {
      const ang = (360 / n) * i, a = (ang - 90) * Math.PI / 180;
      const x1 = C + (r - w1) * Math.cos(a), y1 = C + (r - w1) * Math.sin(a);
      const x2 = C + (r + w2) * Math.cos(a), y2 = C + (r + w2) * Math.sin(a);
      ps.push(
        `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}"` +
        ` x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"` +
        ` stroke="${color}" stroke-width="${sw}" stroke-opacity="${op}" stroke-linecap="round"/>`
      );
    }
    return ps.join('');
  };

  /* Brasas crepitantes (partículas de fogo em órbita) */
  const brasas = (n, rMin, rMax) => {
    const ps = [];
    const cores = ['#ffeb3b', '#ff9800', '#ff3d00', '#ffe57f'];
    for (let i = 0; i < n; i++) {
      const ang = (360 / n) * i + (i * 13) % 30, a = (ang - 90) * Math.PI / 180;
      const r = rMin + (rMax - rMin) * ((i * 7) % 10) / 10;
      const x = C + r * Math.cos(a), y = C + r * Math.sin(a);
      const cor = cores[i % cores.length];
      const raio = (1.4 + (i % 3) * 0.6).toFixed(1);
      const del = (i * 0.18).toFixed(2);
      ps.push(
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${raio}" fill="${cor}"` +
        ` opacity="0.85" style="animation:fnx-spark 1.6s ${del}s ease-in-out infinite"/>`
      );
    }
    return ps.join('');
  };

  const chExt = chamas(12, 78, 54, 62, 20, 'url(#fnxChamaExt)', .85, 1.2);
  const chMed = chamas(16, 56, 40, 64, 14, 'url(#fnxChamaMed)', .90, -0.8);
  const chInt = lancas(24, 64, 28, 5, 'url(#fnxChamaInt)', 1.0);
  const shExt = shimmer(36, 122, 7, 5, 1.8, '#ffcc00', .75);
  const shInt = shimmer(24, 86, 5, 3, 1.4, '#ff9800', .60);
  const spks  = brasas(20, 76, 136);

  return `
  <svg viewBox="0 0 300 300" width="${tam}" height="${tam}"
       class="aura-svg" aria-hidden="true" focusable="false"
       style="display:block;overflow:visible;max-width:none;width:${tam}px;height:${tam}px">
    <style>
      .fnx-r1{transform-origin:150px 150px;animation:aura-girar 52s linear infinite}
      .fnx-r2{transform-origin:150px 150px;animation:aura-girar 38s linear infinite reverse}
      .fnx-r3{transform-origin:150px 150px;animation:aura-girar 26s linear infinite}
      .fnx-r4{transform-origin:150px 150px;animation:aura-girar 75s linear infinite reverse}
      .fnx-bloom{transform-origin:150px 150px;animation:fnx-bloom 3.5s ease-in-out infinite}
      .fnx-pulse{transform-origin:150px 150px;animation:fnx-pulse 2.2s ease-in-out infinite reverse}
      .fnx-halo{animation:fnx-halo 5s ease-in-out infinite}
      @keyframes fnx-bloom{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.08);opacity:1}}
      @keyframes fnx-pulse{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.04);opacity:1}}
      @keyframes fnx-halo{0%,100%{opacity:.4}50%{opacity:.95}}
      @keyframes fnx-spark{0%,100%{transform:scale(.8);opacity:.2}50%{transform:scale(1.3);opacity:1}}
      @media(prefers-reduced-motion:reduce){
        .fnx-r1,.fnx-r2,.fnx-r3,.fnx-r4,.fnx-bloom,.fnx-pulse,.fnx-halo{animation:none}
        circle[style*="fnx-spark"]{animation:none!important}
      }
    </style>
    <defs>
      <!-- Gradientes labaredas Fênix -->
      <radialGradient id="fnxChamaExt" cx="50%" cy="15%">
        <stop offset="0%"   stop-color="#fffbdf" stop-opacity="1"/>
        <stop offset="25%"  stop-color="#ffcc00" stop-opacity=".95"/>
        <stop offset="60%"  stop-color="#ff6d00" stop-opacity=".75"/>
        <stop offset="85%"  stop-color="#d00000" stop-opacity=".45"/>
        <stop offset="100%" stop-color="#4a001f" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="fnxChamaMed" cx="50%" cy="18%">
        <stop offset="0%"   stop-color="#ffffff" stop-opacity="1"/>
        <stop offset="30%"  stop-color="#ffea00" stop-opacity=".95"/>
        <stop offset="65%"  stop-color="#ff6d00" stop-opacity=".80"/>
        <stop offset="100%" stop-color="#b71c1c" stop-opacity=".15"/>
      </radialGradient>
      <radialGradient id="fnxChamaInt" cx="50%" cy="10%">
        <stop offset="0%"   stop-color="#ffffff" stop-opacity="1"/>
        <stop offset="40%"  stop-color="#fff3e0" stop-opacity=".95"/>
        <stop offset="75%"  stop-color="#ffab00" stop-opacity=".80"/>
        <stop offset="100%" stop-color="#ff3d00" stop-opacity=".25"/>
      </radialGradient>
      <!-- Halos e Calor Magmático -->
      <radialGradient id="fnxCalor" cx="50%" cy="50%">
        <stop offset="0%"   stop-color="#ff6d00" stop-opacity="0"/>
        <stop offset="44%"  stop-color="#ff6d00" stop-opacity="0"/>
        <stop offset="56%"  stop-color="#ff9800" stop-opacity=".45"/>
        <stop offset="74%"  stop-color="#ff6d00" stop-opacity=".28"/>
        <stop offset="88%"  stop-color="#d00000" stop-opacity=".15"/>
        <stop offset="100%" stop-color="#4a001f" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="fnxHalo" cx="50%" cy="50%">
        <stop offset="0%"   stop-color="#ffcc00" stop-opacity="0"/>
        <stop offset="44%"  stop-color="#ffcc00" stop-opacity="0"/>
        <stop offset="58%"  stop-color="#ffe57f" stop-opacity=".35"/>
        <stop offset="72%"  stop-color="#ff8f00" stop-opacity=".22"/>
        <stop offset="86%"  stop-color="#b71c1c" stop-opacity=".10"/>
        <stop offset="100%" stop-color="#6a040f" stop-opacity="0"/>
      </radialGradient>
      <!-- Filtros térmicos -->
      <filter id="fnxBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="15"/></filter>
      <filter id="fnxGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5"/></filter>
      <filter id="fnxSharp" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="1.2"/></filter>
    </defs>
    <!-- Halos de fundo (Calor térmico e luz solar) -->
    <circle cx="${C}" cy="${C}" r="135" fill="url(#fnxCalor)" class="fnx-halo" filter="url(#fnxBlur)"/>
    <circle cx="${C}" cy="${C}" r="118" fill="url(#fnxHalo)" class="fnx-halo"/>
    
    <!-- Camada 1: Shimmer solar externo -->
    <g class="fnx-r1" filter="url(#fnxSharp)">${shExt}</g>
    
    <!-- Camada 2: Asas/Labaredas externas (12 chamas longas e curvas) -->
    <g class="fnx-r2"><g class="fnx-bloom" filter="url(#fnxGlow)">${chExt}</g></g>
    
    <!-- Camada 3: Labaredas intermediárias girando em sentido oposto -->
    <g class="fnx-r1"><g class="fnx-pulse" filter="url(#fnxGlow)">${chMed}</g></g>
    
    <!-- Camada 4: Shimmer interno e Coroa rúnica -->
    <g class="fnx-r3" filter="url(#fnxSharp)">${shInt}</g>
    <g class="fnx-r3"><g class="fnx-bloom">${chInt}</g></g>
    
    <!-- Camada 5: Brasas e centelhas crepitantes em órbita livre -->
    <g class="fnx-r4" filter="url(#fnxSharp)">${spks}</g>
    
    <!-- Camada 6: Anel duplo tracejado de fogo rúnico -->
    <g class="fnx-r1">
      <circle cx="${C}" cy="${C}" r="134" fill="none"
              stroke="#ffab00" stroke-width="1.3" stroke-opacity=".65"
              stroke-dasharray="14 8" filter="url(#fnxSharp)"/>
      <circle cx="${C}" cy="${C}" r="138" fill="none"
              stroke="#ff3d00" stroke-width="0.8" stroke-opacity=".40"
              stroke-dasharray="4 16" filter="url(#fnxSharp)"/>
    </g>
  </svg>`;
});

/* ============================================================
   AURA DO PUNIDOR — "A Sentença Viva"

   CONCEITO INÉDITO: Nada de pétalas, chamas ou espirais
   convencionais. Esta aura é construída sobre três linguagens
   visuais exclusivas:

   1. LÂMINAS DE JULGAMENTO: 16 lâminas assimétricas, como
      fragmentos de pena/espada, que giram lentamente ao redor
      do avatar. Cada lâmina é mais escura na base e mais fina
      na ponta — a geometria do veredito iminente.

   2. VÉU DE TINTA: Duas coroas de traços finos (como linhas
      manuscritas de um decreto), girando em sentidos opostos.
      Criam a ilusão de texto se formando ao redor do portador.

   3. SANGUE EM ÓRBITA: 24 gotículas carmesim que oscilam em
      amplitude irregular — algumas próximas, outras distantes —
      como respingos de uma sentença acabada de ser selada.

   PALETA: Preto-abissal (#0d0d1a), Carmesim-vivo (#c0392b),
           Rubi-escuro (#8b0000), Cinza-aço (#8b9dc3)
   ============================================================ */
/* ══════════════════════════════════════════════════════════════
   AURA — PENA DO PUNIDOR · A SENTENÇA

   A primeira versão era uma CÓPIA RENOMEADA da Fênix. Bastou olhar as
   classes lado a lado para ver:

     fnx-r1 fnx-r2 fnx-r3 fnx-r4  ·  fnx-halo  ·  fnx-pulse
     pnp-r1 pnp-r2 pnp-r3 pnp-r4  ·  pnp-halo  ·  pnp-pulse

   Mesmo esqueleto, outro nome, outra cor. O Arquiteto viu na hora, e a
   ordem foi clara: única, bonita, devastadora, sem parecer com nenhuma
   outra.

   O PROBLEMA REAL não era a cor. Era que TODAS as auras deste app
   falam a mesma gramática: coisas dispostas em RAIO em volta do
   centro, GIRANDO. Fênix, Bella Rosa, Pink Spirit — pétalas, chamas,
   lâminas: muda o desenho, não a sintaxe. Trocar laranja por carmesim
   nunca ia resolver.

   Então esta aura quebra a gramática. Ela não gira e não irradia:

     1. O SELO FECHA        três anéis de decreto que CONTRAEM até
                            travar, e recomeçam. Um selo não gira —
                            ele se fecha sobre alguém.

     2. A TINTA CAI         traços verticais descendo, como uma
                            sentença sendo escrita de cima. É o gesto
                            que nenhuma outra aura tem: movimento
                            VERTICAL num app onde tudo orbita.

     3. O CARIMBO BATE      quatro cunhas que golpeiam para DENTRO, em
                            intervalos, e recuam. Não é rotação: é
                            impacto.

     4. A ASSINATURA        o mesmo floreio da insígnia, escrevendo-se
                            na base. A aura e a medalha são o mesmo
                            objeto em duas escalas.

   PALETA: carmesim #ff0a3c e azul #2b6bff — as duas cores do giroflex
   da penitência. A Fênix é laranja; não há como confundir.
   ══════════════════════════════════════════════════════════════ */
/* FORJA:INICIO pena-punidor */
/* ══════════════════════════════════════════════════════════════
   Pena do Punidor — aura
   GERADO POR motors/forja. Não edite à mão.
   Fonte: motors/forja/pecas/pena_punidor.py
   ══════════════════════════════════════════════════════════════ */
Auras.registrar('pena-punidor', function (tam) {
  const u = 'a' + (++Auras._seq);
  return `<svg viewBox="0 0 300 300" width="${tam}" height="${tam}"
     xmlns="http://www.w3.org/2000/svg" class="aura-svg"
     aria-hidden="true" focusable="false"
     style="display:block;overflow:hidden;width:${tam}px;height:${tam}px">
  <defs>
<radialGradient id="fzwcg-veu-${u}" cx="0.5" cy="0.5" r="0.5"><stop offset="0.0" stop-color="#ff0a3c" stop-opacity="0.3"/><stop offset="0.55" stop-color="#7a0f2e" stop-opacity="0.16"/><stop offset="1.0" stop-color="#2b6bff" stop-opacity="0"/></radialGradient>
<linearGradient id="fzwcg-cunha-${u}" x1="0" y1="1" x2="0" y2="0"><stop offset="0.0" stop-color="#ff0a3c" stop-opacity="0"/><stop offset="0.55" stop-color="#ff0a3c" stop-opacity="0.9"/><stop offset="1.0" stop-color="#fff" stop-opacity="0.95"/></linearGradient>
<linearGradient id="fzwcg-tinta-${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0.0" stop-color="#ff0a3c" stop-opacity="1"/><stop offset="0.5" stop-color="#a2185a" stop-opacity="1"/><stop offset="1.0" stop-color="#2b6bff" stop-opacity="1"/></linearGradient>
<filter id="fzwcg-glow-${u}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.4" result="b"/><feComponentTransfer in="b" result="bb"><feFuncA type="linear" slope="1.1"/></feComponentTransfer><feMerge><feMergeNode in="bb"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<clipPath id="fzwcg-corte-${u}"><circle cx="150.0" cy="150.0" r="142.0"/></clipPath>
  </defs>
  <style>

    /* NENHUM aura-girar. E esse keyframe GLOBAL que todas as outras
       auras usam, e foi por herda-lo que a primeira versao desta ficou
       identica a Fenix.
       (Sem crase aqui: este CSS vira template literal de JS, e uma crase
        o fecharia no meio — o motor recusa a arte se encontrar uma.) */
    .fa-selo {
      transform-origin: 150.0px 150.0px;
      animation: fa-fechar 3.2s cubic-bezier(.16,.9,.3,1) infinite;
    }
    @keyframes fa-fechar {
      0%       { transform: scale(1.18); opacity: 0; }
      22%      { opacity: 1; }
      55%, 88% { transform: scale(1); }
      100%     { transform: scale(1); opacity: .25; }
    }
    .fa-chuva path {
      animation-name: fa-cair;
      animation-timing-function: cubic-bezier(.4,0,.9,.5);
      animation-iteration-count: infinite;
    }
    @keyframes fa-cair {
      0%   { transform: translateY(0); opacity: 0; }
      12%  { opacity: .9; }
      82%  { opacity: .55; }
      100% { transform: translateY(300px); opacity: 0; }
    }
    .fa-cunha {
      transform-box: fill-box;
      animation: fa-bater 2.6s cubic-bezier(.2,.9,.3,1) infinite;
    }
    @keyframes fa-bater {
      0%, 62% { transform: translateY(0); opacity: .30; }
      70%     { transform: translateY(26px); opacity: 1; }
      100%    { transform: translateY(0); opacity: .30; }
    }
    .fa-assina path { animation: fa-assinar 5.4s ease-in-out infinite; }
    @keyframes fa-assinar {
      0%       { opacity: 0; }
      18%, 78% { opacity: .9; }
      100%     { opacity: 0; }
    }
    .fa-veu { animation: fa-respirar 4.8s ease-in-out infinite;
               transform-origin: 150.0px 150.0px; }
    @keyframes fa-respirar {
      0%, 100% { opacity: .55; transform: scale(1); }
      50%      { opacity: .9;  transform: scale(1.05); }
    }
    @media (prefers-reduced-motion: reduce) {
      .fa-selo, .fa-chuva path, .fa-cunha, .fa-assina path, .fa-veu
        { animation: none; }
      .fa-chuva path { opacity: .5; }
    }
    
  </style>
<!-- veu -->
<g class="fa-veu">
<circle cx="150.0" cy="150.0" r="142.0" fill="url(#fzwcg-veu-${u})"/>
</g>
<!-- chuva -->
<g class="fa-chuva" clip-path="url(#fzwcg-corte-${u})">
<path d="M 26.00 8.00 L 25.51 9.73 L 25.18 11.47 L 24.97 13.20 L 24.90 14.95 L 24.97 16.70 L 25.18 18.45 L 25.51 20.22 L 26.00 22.00 L 26.00 22.00 L 26.49 20.22 L 26.82 18.45 L 27.03 16.70 L 27.10 14.95 L 27.03 13.20 L 26.82 11.47 L 26.49 9.73 L 26.00 8.00 Z" fill="#2b6bff" opacity="0" style="animation-duration:2.10s;animation-delay:0.00s"/>
<path d="M 42.40 8.00 L 42.09 10.60 L 41.88 13.20 L 41.75 15.81 L 41.70 18.42 L 41.75 21.05 L 41.88 23.68 L 42.09 26.33 L 42.40 29.00 L 42.40 29.00 L 42.71 26.33 L 42.92 23.68 L 43.05 21.05 L 43.10 18.42 L 43.05 15.81 L 42.92 13.20 L 42.71 10.60 L 42.40 8.00 Z" fill="#ff0a3c" opacity="0" style="animation-duration:3.40s;animation-delay:2.90s"/>
<path d="M 58.80 8.00 L 58.49 11.47 L 58.28 14.93 L 58.15 18.41 L 58.10 21.89 L 58.15 25.39 L 58.28 28.91 L 58.49 32.44 L 58.80 36.00 L 58.80 36.00 L 59.11 32.44 L 59.32 28.91 L 59.45 25.39 L 59.50 21.89 L 59.45 18.41 L 59.32 14.93 L 59.11 11.47 L 58.80 8.00 Z" fill="#ff0a3c" opacity="0" style="animation-duration:3.00s;animation-delay:2.70s"/>
<path d="M 75.20 8.00 L 74.89 12.33 L 74.68 16.67 L 74.55 21.01 L 74.50 25.37 L 74.55 29.74 L 74.68 34.14 L 74.89 38.55 L 75.20 43.00 L 75.20 43.00 L 75.51 38.55 L 75.72 34.14 L 75.85 29.74 L 75.90 25.37 L 75.85 21.01 L 75.72 16.67 L 75.51 12.33 L 75.20 8.00 Z" fill="#2b6bff" opacity="0" style="animation-duration:2.60s;animation-delay:2.50s"/>
<path d="M 91.60 8.00 L 91.11 13.20 L 90.78 18.40 L 90.57 23.61 L 90.50 28.84 L 90.57 34.09 L 90.78 39.36 L 91.11 44.66 L 91.60 50.00 L 91.60 50.00 L 92.09 44.66 L 92.42 39.36 L 92.63 34.09 L 92.70 28.84 L 92.63 23.61 L 92.42 18.40 L 92.09 13.20 L 91.60 8.00 Z" fill="#ff0a3c" opacity="0" style="animation-duration:2.20s;animation-delay:2.30s"/>
<path d="M 108.00 8.00 L 107.69 9.86 L 107.48 11.71 L 107.35 13.58 L 107.30 15.44 L 107.35 17.32 L 107.48 19.20 L 107.69 21.09 L 108.00 23.00 L 108.00 23.00 L 108.31 21.09 L 108.52 19.20 L 108.65 17.32 L 108.70 15.44 L 108.65 13.58 L 108.52 11.71 L 108.31 9.86 L 108.00 8.00 Z" fill="#ff0a3c" opacity="0" style="animation-duration:3.50s;animation-delay:2.10s"/>
<path d="M 124.40 8.00 L 124.09 10.72 L 123.88 13.45 L 123.75 16.18 L 123.70 18.92 L 123.75 21.67 L 123.88 24.43 L 124.09 27.20 L 124.40 30.00 L 124.40 30.00 L 124.71 27.20 L 124.92 24.43 L 125.05 21.67 L 125.10 18.92 L 125.05 16.18 L 124.92 13.45 L 124.71 10.72 L 124.40 8.00 Z" fill="#2b6bff" opacity="0" style="animation-duration:3.10s;animation-delay:1.90s"/>
<path d="M 140.80 8.00 L 140.49 11.59 L 140.28 15.18 L 140.15 18.78 L 140.10 22.39 L 140.15 26.01 L 140.28 29.65 L 140.49 33.32 L 140.80 37.00 L 140.80 37.00 L 141.11 33.32 L 141.32 29.65 L 141.45 26.01 L 141.50 22.39 L 141.45 18.78 L 141.32 15.18 L 141.11 11.59 L 140.80 8.00 Z" fill="#ff0a3c" opacity="0" style="animation-duration:2.70s;animation-delay:1.70s"/>
<path d="M 157.20 8.00 L 156.71 12.46 L 156.38 16.92 L 156.17 21.38 L 156.10 25.87 L 156.17 30.36 L 156.38 34.88 L 156.71 39.43 L 157.20 44.00 L 157.20 44.00 L 157.69 39.43 L 158.02 34.88 L 158.23 30.36 L 158.30 25.87 L 158.23 21.38 L 158.02 16.92 L 157.69 12.46 L 157.20 8.00 Z" fill="#ff0a3c" opacity="0" style="animation-duration:2.30s;animation-delay:1.50s"/>
<path d="M 173.60 8.00 L 173.29 13.32 L 173.08 18.65 L 172.95 23.99 L 172.90 29.34 L 172.95 34.71 L 173.08 40.11 L 173.29 45.54 L 173.60 51.00 L 173.60 51.00 L 173.91 45.54 L 174.12 40.11 L 174.25 34.71 L 174.30 29.34 L 174.25 23.99 L 174.12 18.65 L 173.91 13.32 L 173.60 8.00 Z" fill="#2b6bff" opacity="0" style="animation-duration:3.60s;animation-delay:1.30s"/>
<path d="M 190.00 8.00 L 189.69 9.98 L 189.48 11.96 L 189.35 13.95 L 189.30 15.94 L 189.35 17.94 L 189.48 19.95 L 189.69 21.97 L 190.00 24.00 L 190.00 24.00 L 190.31 21.97 L 190.52 19.95 L 190.65 17.94 L 190.70 15.94 L 190.65 13.95 L 190.52 11.96 L 190.31 9.98 L 190.00 8.00 Z" fill="#ff0a3c" opacity="0" style="animation-duration:3.20s;animation-delay:1.10s"/>
<path d="M 206.40 8.00 L 206.09 10.85 L 205.88 13.70 L 205.75 16.55 L 205.70 19.41 L 205.75 22.29 L 205.88 25.17 L 206.09 28.08 L 206.40 31.00 L 206.40 31.00 L 206.71 28.08 L 206.92 25.17 L 207.05 22.29 L 207.10 19.41 L 207.05 16.55 L 206.92 13.70 L 206.71 10.85 L 206.40 8.00 Z" fill="#ff0a3c" opacity="0" style="animation-duration:2.80s;animation-delay:0.90s"/>
<path d="M 222.80 8.00 L 222.31 11.71 L 221.98 15.43 L 221.77 19.15 L 221.70 22.89 L 221.77 26.64 L 221.98 30.40 L 222.31 34.19 L 222.80 38.00 L 222.80 38.00 L 223.29 34.19 L 223.62 30.40 L 223.83 26.64 L 223.90 22.89 L 223.83 19.15 L 223.62 15.43 L 223.29 11.71 L 222.80 8.00 Z" fill="#2b6bff" opacity="0" style="animation-duration:2.40s;animation-delay:0.70s"/>
<path d="M 239.20 8.00 L 238.89 12.58 L 238.68 17.16 L 238.55 21.76 L 238.50 26.36 L 238.55 30.98 L 238.68 35.63 L 238.89 40.30 L 239.20 45.00 L 239.20 45.00 L 239.51 40.30 L 239.72 35.63 L 239.85 30.98 L 239.90 26.36 L 239.85 21.76 L 239.72 17.16 L 239.51 12.58 L 239.20 8.00 Z" fill="#ff0a3c" opacity="0" style="animation-duration:3.70s;animation-delay:0.50s"/>
<path d="M 255.60 8.00 L 255.29 13.45 L 255.08 18.90 L 254.95 24.36 L 254.90 29.84 L 254.95 35.33 L 255.08 40.86 L 255.29 46.41 L 255.60 52.00 L 255.60 52.00 L 255.91 46.41 L 256.12 40.86 L 256.25 35.33 L 256.30 29.84 L 256.25 24.36 L 256.12 18.90 L 255.91 13.45 L 255.60 8.00 Z" fill="#ff0a3c" opacity="0" style="animation-duration:3.30s;animation-delay:0.30s"/>
<path d="M 272.00 8.00 L 271.69 10.10 L 271.48 12.21 L 271.35 14.32 L 271.30 16.44 L 271.35 18.56 L 271.48 20.69 L 271.69 22.84 L 272.00 25.00 L 272.00 25.00 L 272.31 22.84 L 272.52 20.69 L 272.65 18.56 L 272.70 16.44 L 272.65 14.32 L 272.52 12.21 L 272.31 10.10 L 272.00 8.00 Z" fill="#2b6bff" opacity="0" style="animation-duration:2.90s;animation-delay:0.10s"/>
<path d="M 40.40 8.00 L 39.91 10.97 L 39.58 13.94 L 39.37 16.92 L 39.30 19.91 L 39.37 22.91 L 39.58 25.92 L 39.91 28.95 L 40.40 32.00 L 40.40 32.00 L 40.89 28.95 L 41.22 25.92 L 41.43 22.91 L 41.50 19.91 L 41.43 16.92 L 41.22 13.94 L 40.89 10.97 L 40.40 8.00 Z" fill="#ff0a3c" opacity="0" style="animation-duration:2.50s;animation-delay:3.00s"/>
<path d="M 56.80 8.00 L 56.49 11.84 L 56.28 15.68 L 56.15 19.53 L 56.10 23.38 L 56.15 27.26 L 56.28 31.15 L 56.49 35.06 L 56.80 39.00 L 56.80 39.00 L 57.11 35.06 L 57.32 31.15 L 57.45 27.26 L 57.50 23.38 L 57.45 19.53 L 57.32 15.68 L 57.11 11.84 L 56.80 8.00 Z" fill="#ff0a3c" opacity="0" style="animation-duration:2.10s;animation-delay:2.80s"/>
</g>
<!-- selo -->
<g filter="url(#fzwcg-glow-${u})">
<circle class="fa-selo" cx="150.0" cy="150.0" r="132.0" fill="none" stroke="#ff0a3c" stroke-width="1.60" stroke-dasharray="2.0 10.0" stroke-linecap="round" opacity="0.6" style="animation-delay:0.0s"/>
<circle class="fa-selo" cx="150.0" cy="150.0" r="116.0" fill="none" stroke="#2b6bff" stroke-width="1.10" stroke-dasharray="1.0 14.0" stroke-linecap="round" opacity="0.45" style="animation-delay:0.35s"/>
<circle class="fa-selo" cx="150.0" cy="150.0" r="100.0" fill="none" stroke="#ff0a3c" stroke-width="2.20" stroke-dasharray="26.0 220.0" stroke-linecap="round" opacity="0.75" style="animation-delay:0.7s"/>
</g>
<!-- carimbo -->
<g filter="url(#fzwcg-glow-${u})">
<path class="fa-cunha" d="M 150.00 28.00 L 146.78 31.33 L 145.20 34.70 L 143.97 38.12 L 142.95 41.55 L 142.07 45.00 L 141.29 48.45 L 140.61 51.88 L 139.99 55.30 L 139.44 58.67 L 138.95 62.00 L 161.05 62.00 L 160.56 58.67 L 160.01 55.30 L 159.39 51.88 L 158.71 48.45 L 157.93 45.00 L 157.05 41.55 L 156.03 38.12 L 154.80 34.70 L 153.22 31.33 L 150.00 28.00 Z" fill="url(#fzwcg-cunha-${u})" opacity=".85" transform="rotate(0 150.0 150.0)" style="animation-delay:0.00s"/>
<path class="fa-cunha" d="M 150.00 28.00 L 146.78 31.33 L 145.20 34.70 L 143.97 38.12 L 142.95 41.55 L 142.07 45.00 L 141.29 48.45 L 140.61 51.88 L 139.99 55.30 L 139.44 58.67 L 138.95 62.00 L 161.05 62.00 L 160.56 58.67 L 160.01 55.30 L 159.39 51.88 L 158.71 48.45 L 157.93 45.00 L 157.05 41.55 L 156.03 38.12 L 154.80 34.70 L 153.22 31.33 L 150.00 28.00 Z" fill="url(#fzwcg-cunha-${u})" opacity=".85" transform="rotate(90 150.0 150.0)" style="animation-delay:0.18s"/>
<path class="fa-cunha" d="M 150.00 28.00 L 146.78 31.33 L 145.20 34.70 L 143.97 38.12 L 142.95 41.55 L 142.07 45.00 L 141.29 48.45 L 140.61 51.88 L 139.99 55.30 L 139.44 58.67 L 138.95 62.00 L 161.05 62.00 L 160.56 58.67 L 160.01 55.30 L 159.39 51.88 L 158.71 48.45 L 157.93 45.00 L 157.05 41.55 L 156.03 38.12 L 154.80 34.70 L 153.22 31.33 L 150.00 28.00 Z" fill="url(#fzwcg-cunha-${u})" opacity=".85" transform="rotate(180 150.0 150.0)" style="animation-delay:0.36s"/>
<path class="fa-cunha" d="M 150.00 28.00 L 146.78 31.33 L 145.20 34.70 L 143.97 38.12 L 142.95 41.55 L 142.07 45.00 L 141.29 48.45 L 140.61 51.88 L 139.99 55.30 L 139.44 58.67 L 138.95 62.00 L 161.05 62.00 L 160.56 58.67 L 160.01 55.30 L 159.39 51.88 L 158.71 48.45 L 157.93 45.00 L 157.05 41.55 L 156.03 38.12 L 154.80 34.70 L 153.22 31.33 L 150.00 28.00 Z" fill="url(#fzwcg-cunha-${u})" opacity=".85" transform="rotate(270 150.0 150.0)" style="animation-delay:0.54s"/>
</g>
<!-- assinatura -->
<g class="fa-assina">
<path d="M 64.00 236.00 L 66.68 239.12 L 69.89 241.46 L 73.29 243.54 L 76.84 245.41 L 80.51 247.11 L 84.28 248.63 L 88.15 249.99 L 92.11 251.19 L 96.14 252.24 L 100.24 253.14 L 104.40 253.90 L 108.62 254.52 L 112.89 255.01 L 117.20 255.36 L 121.56 255.57 L 125.95 255.67 L 130.37 255.63 L 134.81 255.48 L 139.28 255.20 L 143.77 254.81 L 148.28 254.31 L 152.79 253.69 L 157.31 252.97 L 161.84 252.14 L 166.37 251.20 L 170.89 250.17 L 175.41 249.03 L 179.92 247.80 L 184.41 246.47 L 188.89 245.04 L 193.35 243.53 L 197.78 241.92 L 202.19 240.23 L 206.57 238.45 L 210.92 236.59 L 215.23 234.64 L 219.49 232.61 L 223.72 230.50 L 227.89 228.30 L 232.00 226.00 L 232.00 226.00 L 227.71 227.92 L 223.39 229.77 L 219.04 231.56 L 214.66 233.26 L 210.26 234.89 L 205.83 236.44 L 201.38 237.90 L 196.92 239.29 L 192.44 240.59 L 187.96 241.80 L 183.47 242.93 L 178.97 243.97 L 174.48 244.92 L 169.99 245.78 L 165.51 246.56 L 161.04 247.24 L 156.58 247.84 L 152.15 248.34 L 147.73 248.75 L 143.33 249.07 L 138.97 249.29 L 134.63 249.42 L 130.33 249.45 L 126.06 249.39 L 121.83 249.24 L 117.64 248.98 L 113.50 248.64 L 109.41 248.19 L 105.36 247.65 L 101.37 247.01 L 97.42 246.28 L 93.53 245.45 L 89.70 244.53 L 85.92 243.51 L 82.20 242.39 L 78.52 241.19 L 74.90 239.90 L 71.32 238.54 L 67.75 237.13 L 64.00 236.00 Z" fill="url(#fzwcg-tinta-${u})" opacity=".9"/>
</g>

</svg>`;
});

/* FORJA:FIM pena-punidor */

/* FORJA:INICIO fenix-v2 */
/* ══════════════════════════════════════════════════════════════
   Fenix do Gelo — aura
   GERADO POR motors/forja. Não edite à mão.
   Fonte: motors/forja/pecas/fenix_v2_aura.py
   ══════════════════════════════════════════════════════════════ */
Auras.registrar('fenix-v2', function (tam) {
  const u = 'a' + (++Auras._seq);
  return `<svg viewBox="0 0 300 300" width="${tam}" height="${tam}"
     xmlns="http://www.w3.org/2000/svg" class="aura-svg"
     aria-hidden="true" focusable="false"
     style="display:block;overflow:hidden;width:${tam}px;height:${tam}px">
  <defs>
<radialGradient id="fxflr-veu-${u}" cx="0.5" cy="0.5" r="0.5"><stop offset="0.0" stop-color="#7fd4ff" stop-opacity="0.26"/><stop offset="0.52" stop-color="#2b6bff" stop-opacity="0.18"/><stop offset="1.0" stop-color="#0a2a5e" stop-opacity="0"/></radialGradient>
<linearGradient id="fxflr-chama-ext-${u}" x1="0" y1="1" x2="0" y2="0"><stop offset="0.0" stop-color="#0a2a5e" stop-opacity="0.95"/><stop offset="0.42" stop-color="#2b6bff" stop-opacity="0.85"/><stop offset="0.78" stop-color="#7fd4ff" stop-opacity="0.6"/><stop offset="1.0" stop-color="#eaf6ff" stop-opacity="0"/></linearGradient>
<linearGradient id="fxflr-chama-int-${u}" x1="0" y1="1" x2="0" y2="0"><stop offset="0.0" stop-color="#2b6bff" stop-opacity="1"/><stop offset="0.4" stop-color="#7fd4ff" stop-opacity="0.95"/><stop offset="0.82" stop-color="#eaf6ff" stop-opacity="0.8"/><stop offset="1.0" stop-color="#eaf6ff" stop-opacity="0"/></linearGradient>
<radialGradient id="fxflr-brasa-${u}" cx="0.5" cy="0.5" r="0.5"><stop offset="0.0" stop-color="#eaf6ff" stop-opacity="0.55"/><stop offset="0.4" stop-color="#7fd4ff" stop-opacity="0.34"/><stop offset="0.72" stop-color="#2b6bff" stop-opacity="0.16"/><stop offset="1.0" stop-color="#0a2a5e" stop-opacity="0"/></radialGradient>
<linearGradient id="fxflr-cristal-${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0.0" stop-color="#eaf6ff" stop-opacity="0.95"/><stop offset="0.55" stop-color="#7fd4ff" stop-opacity="0.85"/><stop offset="1.0" stop-color="#2b6bff" stop-opacity="0.55"/></linearGradient>
<linearGradient id="fxflr-frente-${u}" x1="0" y1="1" x2="0" y2="0"><stop offset="0.0" stop-color="#7fd4ff" stop-opacity="0"/><stop offset="0.34" stop-color="#7fd4ff" stop-opacity="0.3"/><stop offset="0.52" stop-color="#eaf6ff" stop-opacity="0.5"/><stop offset="0.7" stop-color="#7fd4ff" stop-opacity="0.26"/><stop offset="1.0" stop-color="#7fd4ff" stop-opacity="0"/></linearGradient>
<filter id="fxflr-glow-${u}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.6" result="b"/><feComponentTransfer in="b" result="bb"><feFuncA type="linear" slope="1.05"/></feComponentTransfer><feMerge><feMergeNode in="bb"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<clipPath id="fxflr-corte-${u}"><circle cx="150.0" cy="150.0" r="142.0"/></clipPath>
<filter id="fxflr-blur18-${u}" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="1.80"/></filter>
<filter id="fxflr-blur34-${u}" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="3.40"/></filter>
  </defs>
  <style>

    .fx2-chamas path {
      transform-box: fill-box;
      transform-origin: 50% 100%;
      animation-name: fx2-ascender;
      animation-timing-function: cubic-bezier(.25,.6,.35,1);
      animation-iteration-count: infinite;
    }
    @keyframes fx2-ascender {
      0%   { transform: translateY(5.00px) scaleY(.80); opacity: .10; }
      30%  { opacity: .95; }
      68%  { transform: translateY(-9.00px) scaleY(1.14); opacity: .60; }
      100% { transform: translateY(-20.00px) scaleY(1.24); opacity: 0; }
    }
    .fx2-frente rect {
      animation: fx2-varrer 7.6s cubic-bezier(.45,0,.55,1) infinite;
    }
    @keyframes fx2-varrer {
      0%   { transform: translateY(150.00px); opacity: 0; }
      18%  { opacity: 1; }
      80%  { opacity: .85; }
      100% { transform: translateY(-150.00px); opacity: 0; }
    }
    .fx2-cristal {
      transform-box: fill-box;
      transform-origin: 50% 50%;
      animation-name: fx2-cristalizar;
      animation-timing-function: cubic-bezier(.2,.9,.3,1);
      animation-iteration-count: infinite;
    }
    @keyframes fx2-cristalizar {
      0%       { transform: scale(.15); opacity: 0; }
      14%      { transform: scale(1.06); opacity: 1; }
      22%, 58% { transform: scale(1); opacity: .92; }
      100%     { transform: scale(.9) translateY(-7.00px); opacity: 0; }
    }
    .fx2-poeira circle {
      animation-name: fx2-sublimar;
      animation-timing-function: cubic-bezier(.35,0,.6,1);
      animation-iteration-count: infinite;
    }
    @keyframes fx2-sublimar {
      0%   { transform: translateY(0); opacity: 0; }
      22%  { opacity: .9; }
      72%  { opacity: .5; }
      100% { transform: translateY(-40.00px); opacity: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .fx2-chamas path, .fx2-frente rect, .fx2-cristal, .fx2-poeira circle
        { animation: none; }
      .fx2-chamas path { opacity: .85; }
      .fx2-frente rect { opacity: .35; }
      .fx2-poeira circle { opacity: .55; }
    }
    
  </style>
<!-- veu -->
<g >
<circle cx="150.0" cy="150.0" r="142.0" fill="url(#fxflr-veu-${u})"/>
<circle cx="150.0" cy="150.0" r="136.0" fill="none" stroke="#7fd4ff" stroke-width="0.80" stroke-opacity=".30"/>
</g>
<!-- chamas-fundo -->
<g class="fx2-chamas" opacity="0.72" filter="url(#fxflr-blur18-${u})">
<path class="fx2-chama" d="M 60.72 201.14 L 61.01 200.12 L 61.23 199.10 L 61.37 198.07 L 61.44 197.03 L 61.42 195.99 L 61.32 194.94 L 61.13 193.90 L 60.85 192.85 L 60.49 191.81 L 60.04 190.79 L 59.51 189.79 L 58.90 188.82 L 58.21 187.88 L 57.46 187.00 L 56.65 186.16 L 55.79 185.38 L 54.88 184.67 L 53.94 184.01 L 52.98 183.42 L 51.99 182.89 L 50.98 182.41 L 49.96 181.96 L 48.91 181.54 L 47.84 181.14 L 46.73 180.75 L 45.57 180.34 L 45.57 180.34 L 46.69 180.84 L 47.68 181.46 L 48.54 182.18 L 49.25 182.98 L 49.83 183.84 L 50.26 184.75 L 50.57 185.67 L 50.76 186.60 L 50.85 187.52 L 50.86 188.43 L 50.81 189.32 L 50.72 190.19 L 50.61 191.04 L 50.51 191.88 L 50.41 192.72 L 50.35 193.55 L 50.34 194.39 L 50.39 195.23 L 50.50 196.09 L 50.70 196.96 L 50.99 197.85 L 51.37 198.75 L 51.85 199.65 L 52.43 200.57 L 53.12 201.48 L 53.91 202.37 Z" fill="url(#fxflr-chama-ext-${u})" style="animation-duration:4.20s;animation-delay:0.00s"/>
<path class="fx2-chama" d="M 76.57 212.49 L 78.01 210.71 L 79.23 208.78 L 80.19 206.74 L 80.89 204.61 L 81.32 202.42 L 81.47 200.18 L 81.36 197.94 L 80.97 195.72 L 80.33 193.54 L 79.45 191.43 L 78.35 189.42 L 77.04 187.53 L 75.56 185.77 L 73.93 184.14 L 72.17 182.67 L 70.32 181.35 L 68.40 180.16 L 66.43 179.11 L 64.43 178.17 L 62.41 177.33 L 60.37 176.56 L 58.32 175.83 L 56.26 175.14 L 54.17 174.45 L 52.05 173.75 L 49.87 173.00 L 49.87 173.00 L 51.98 173.90 L 53.90 175.01 L 55.63 176.27 L 57.15 177.67 L 58.47 179.17 L 59.58 180.75 L 60.49 182.39 L 61.21 184.04 L 61.75 185.70 L 62.13 187.33 L 62.37 188.92 L 62.50 190.47 L 62.54 191.95 L 62.53 193.37 L 62.48 194.73 L 62.43 196.03 L 62.39 197.30 L 62.39 198.53 L 62.45 199.76 L 62.57 200.99 L 62.76 202.24 L 63.03 203.53 L 63.38 204.88 L 63.80 206.31 L 64.29 207.82 L 64.83 209.44 Z" fill="url(#fxflr-chama-ext-${u})" style="animation-duration:4.90s;animation-delay:2.30s"/>
<path class="fx2-chama" d="M 91.94 200.14 L 91.85 196.47 L 91.77 193.04 L 91.63 189.78 L 91.40 186.64 L 91.04 183.58 L 90.51 180.54 L 89.82 177.51 L 88.94 174.44 L 87.88 171.34 L 86.64 168.19 L 85.22 165.00 L 83.63 161.79 L 81.87 158.57 L 79.96 155.36 L 77.91 152.20 L 75.71 149.12 L 73.40 146.14 L 70.98 143.29 L 68.46 140.60 L 65.88 138.08 L 63.24 135.73 L 60.55 133.54 L 57.82 131.48 L 55.04 129.50 L 52.17 127.55 L 49.17 125.58 L 49.17 125.58 L 51.95 127.82 L 54.19 130.40 L 55.89 133.22 L 57.07 136.19 L 57.77 139.26 L 58.03 142.36 L 57.92 145.47 L 57.51 148.57 L 56.87 151.67 L 56.08 154.77 L 55.20 157.91 L 54.30 161.10 L 53.44 164.36 L 52.69 167.73 L 52.11 171.21 L 51.75 174.81 L 51.67 178.54 L 51.94 182.39 L 52.59 186.34 L 53.68 190.35 L 55.26 194.39 L 57.34 198.39 L 59.95 202.28 L 63.09 206.00 L 66.76 209.45 L 70.92 212.56 Z" fill="url(#fxflr-chama-ext-${u})" style="animation-duration:5.60s;animation-delay:0.90s"/>
<path class="fx2-chama" d="M 109.12 221.08 L 111.24 216.30 L 112.68 211.29 L 113.45 206.15 L 113.59 201.00 L 113.15 195.92 L 112.18 190.95 L 110.74 186.15 L 108.91 181.53 L 106.73 177.11 L 104.27 172.90 L 101.57 168.89 L 98.70 165.07 L 95.70 161.43 L 92.61 157.95 L 89.50 154.62 L 86.40 151.43 L 83.35 148.34 L 80.41 145.34 L 77.61 142.42 L 74.99 139.55 L 72.61 136.72 L 70.50 133.92 L 68.71 131.14 L 67.29 128.38 L 66.30 125.65 L 65.81 122.98 L 65.81 122.98 L 66.06 125.70 L 66.45 128.62 L 66.97 131.75 L 67.62 135.10 L 68.41 138.65 L 69.31 142.37 L 70.30 146.25 L 71.39 150.25 L 72.54 154.36 L 73.75 158.53 L 75.00 162.75 L 76.27 166.99 L 77.56 171.20 L 78.85 175.38 L 80.13 179.49 L 81.39 183.50 L 82.63 187.41 L 83.83 191.18 L 85.00 194.82 L 86.14 198.32 L 87.24 201.69 L 88.31 204.95 L 89.35 208.15 L 90.33 211.32 L 91.26 214.56 L 92.07 217.94 Z" fill="url(#fxflr-chama-ext-${u})" style="animation-duration:4.40s;animation-delay:3.20s"/>
<path class="fx2-chama" d="M 126.53 225.64 L 126.57 222.68 L 126.53 219.87 L 126.39 217.19 L 126.13 214.63 L 125.75 212.17 L 125.25 209.80 L 124.62 207.51 L 123.88 205.26 L 123.02 203.05 L 122.06 200.87 L 121.03 198.69 L 119.93 196.51 L 118.79 194.30 L 117.63 192.08 L 116.48 189.82 L 115.37 187.53 L 114.32 185.21 L 113.37 182.85 L 112.53 180.47 L 111.83 178.07 L 111.30 175.66 L 110.96 173.26 L 110.83 170.89 L 110.92 168.56 L 111.26 166.30 L 111.87 164.15 L 111.87 164.15 L 111.01 166.22 L 110.01 168.31 L 108.90 170.43 L 107.70 172.61 L 106.42 174.87 L 105.09 177.21 L 103.74 179.65 L 102.40 182.19 L 101.09 184.84 L 99.85 187.59 L 98.71 190.44 L 97.70 193.39 L 96.85 196.42 L 96.19 199.51 L 95.75 202.66 L 95.55 205.84 L 95.62 209.03 L 95.98 212.21 L 96.64 215.36 L 97.62 218.44 L 98.92 221.44 L 100.53 224.32 L 102.47 227.07 L 104.72 229.65 L 107.27 232.05 L 110.09 234.24 Z" fill="url(#fxflr-chama-ext-${u})" style="animation-duration:5.10s;animation-delay:1.80s"/>
<path class="fx2-chama" d="M 137.58 212.29 L 137.49 208.11 L 137.32 204.06 L 137.06 200.10 L 136.70 196.24 L 136.23 192.45 L 135.66 188.71 L 134.97 185.02 L 134.19 181.36 L 133.31 177.71 L 132.35 174.07 L 131.34 170.42 L 130.28 166.77 L 129.21 163.09 L 128.14 159.40 L 127.10 155.69 L 126.12 151.96 L 125.22 148.22 L 124.43 144.48 L 123.76 140.73 L 123.26 137.00 L 122.93 133.30 L 122.81 129.64 L 122.89 126.03 L 123.22 122.51 L 123.79 119.09 L 124.64 115.79 L 124.64 115.79 L 123.53 119.01 L 122.26 122.27 L 120.88 125.58 L 119.40 128.97 L 117.84 132.43 L 116.23 135.99 L 114.61 139.65 L 112.99 143.42 L 111.41 147.29 L 109.91 151.27 L 108.51 155.35 L 107.26 159.54 L 106.18 163.81 L 105.31 168.17 L 104.68 172.59 L 104.32 177.06 L 104.25 181.56 L 104.51 186.08 L 105.11 190.58 L 106.07 195.05 L 107.39 199.45 L 109.09 203.76 L 111.17 207.95 L 113.62 211.99 L 116.43 215.86 L 119.59 219.52 Z" fill="url(#fxflr-chama-ext-${u})" style="animation-duration:5.80s;animation-delay:0.40s"/>
<path class="fx2-chama" d="M 153.12 225.19 L 155.41 219.54 L 157.48 213.78 L 159.32 207.93 L 160.93 202.01 L 162.30 196.01 L 163.43 189.96 L 164.32 183.87 L 164.98 177.74 L 165.42 171.60 L 165.64 165.45 L 165.66 159.31 L 165.49 153.20 L 165.14 147.12 L 164.63 141.09 L 163.99 135.13 L 163.21 129.24 L 162.34 123.43 L 161.37 117.73 L 160.34 112.12 L 159.25 106.62 L 158.13 101.25 L 156.98 95.98 L 155.83 90.84 L 154.69 85.82 L 153.56 80.91 L 152.47 76.11 L 152.47 76.11 L 153.32 80.96 L 153.81 85.96 L 153.99 91.08 L 153.87 96.30 L 153.49 101.61 L 152.87 106.99 L 152.05 112.42 L 151.04 117.90 L 149.89 123.42 L 148.62 128.97 L 147.27 134.55 L 145.87 140.16 L 144.45 145.80 L 143.05 151.47 L 141.69 157.16 L 140.41 162.88 L 139.22 168.63 L 138.16 174.41 L 137.24 180.23 L 136.48 186.08 L 135.91 191.97 L 135.52 197.89 L 135.33 203.84 L 135.35 209.82 L 135.57 215.84 L 135.99 221.87 Z" fill="url(#fxflr-chama-ext-${u})" style="animation-duration:4.60s;animation-delay:2.70s"/>
<path class="fx2-chama" d="M 177.08 230.23 L 179.06 225.78 L 180.64 221.25 L 181.84 216.66 L 182.66 212.08 L 183.15 207.52 L 183.32 203.01 L 183.21 198.58 L 182.86 194.22 L 182.30 189.95 L 181.57 185.77 L 180.71 181.67 L 179.76 177.63 L 178.77 173.66 L 177.77 169.73 L 176.82 165.84 L 175.95 161.95 L 175.23 158.07 L 174.70 154.17 L 174.41 150.26 L 174.42 146.34 L 174.79 142.40 L 175.55 138.48 L 176.77 134.61 L 178.46 130.83 L 180.67 127.18 L 183.41 123.75 L 183.41 123.75 L 180.44 127.01 L 177.60 130.25 L 174.88 133.54 L 172.26 136.93 L 169.74 140.43 L 167.33 144.08 L 165.04 147.89 L 162.88 151.85 L 160.87 155.96 L 159.03 160.20 L 157.36 164.54 L 155.88 168.97 L 154.61 173.44 L 153.53 177.93 L 152.67 182.42 L 152.02 186.88 L 151.59 191.28 L 151.38 195.62 L 151.39 199.87 L 151.60 204.04 L 152.03 208.13 L 152.66 212.13 L 153.48 216.07 L 154.47 219.97 L 155.62 223.86 L 156.89 227.79 Z" fill="url(#fxflr-chama-ext-${u})" style="animation-duration:5.30s;animation-delay:1.30s"/>
<path class="fx2-chama" d="M 190.92 230.77 L 193.32 228.14 L 195.37 225.34 L 197.05 222.40 L 198.38 219.37 L 199.35 216.30 L 199.98 213.22 L 200.29 210.16 L 200.31 207.15 L 200.07 204.20 L 199.59 201.33 L 198.92 198.53 L 198.08 195.80 L 197.12 193.15 L 196.07 190.57 L 194.96 188.04 L 193.84 185.57 L 192.74 183.12 L 191.69 180.71 L 190.74 178.31 L 189.92 175.92 L 189.26 173.54 L 188.81 171.17 L 188.60 168.81 L 188.66 166.49 L 189.02 164.23 L 189.72 162.08 L 189.72 162.08 L 188.78 164.15 L 187.80 166.24 L 186.76 168.39 L 185.69 170.60 L 184.59 172.89 L 183.47 175.26 L 182.34 177.71 L 181.22 180.22 L 180.11 182.78 L 179.03 185.38 L 177.99 188.00 L 177.00 190.64 L 176.09 193.26 L 175.25 195.86 L 174.50 198.43 L 173.85 200.95 L 173.32 203.42 L 172.91 205.84 L 172.63 208.21 L 172.48 210.53 L 172.47 212.83 L 172.60 215.13 L 172.86 217.44 L 173.24 219.81 L 173.70 222.27 L 174.24 224.84 Z" fill="url(#fxflr-chama-ext-${u})" style="animation-duration:6.00s;animation-delay:3.60s"/>
<path class="fx2-chama" d="M 213.88 212.59 L 214.30 208.98 L 214.99 205.84 L 215.82 202.98 L 216.71 200.22 L 217.63 197.40 L 218.59 194.40 L 219.63 191.14 L 220.76 187.61 L 222.01 183.80 L 223.37 179.73 L 224.84 175.43 L 226.41 170.94 L 228.05 166.31 L 229.74 161.58 L 231.45 156.78 L 233.14 151.97 L 234.80 147.19 L 236.37 142.48 L 237.84 137.88 L 239.16 133.44 L 240.30 129.20 L 241.23 125.18 L 241.92 121.43 L 242.36 117.96 L 242.53 114.78 L 242.46 111.85 L 242.46 111.85 L 242.19 114.74 L 241.17 117.67 L 239.52 120.56 L 237.32 123.41 L 234.65 126.22 L 231.58 129.02 L 228.19 131.83 L 224.52 134.69 L 220.63 137.62 L 216.59 140.67 L 212.46 143.87 L 208.29 147.25 L 204.15 150.85 L 200.11 154.72 L 196.24 158.89 L 192.62 163.39 L 189.32 168.25 L 186.44 173.49 L 184.09 179.13 L 182.38 185.14 L 181.45 191.47 L 181.44 198.02 L 182.46 204.64 L 184.58 211.09 L 187.82 217.14 L 192.09 222.53 Z" fill="url(#fxflr-chama-ext-${u})" style="animation-duration:4.80s;animation-delay:2.20s"/>
<path class="fx2-chama" d="M 228.48 216.35 L 229.66 213.92 L 230.80 211.69 L 231.86 209.59 L 232.82 207.51 L 233.67 205.39 L 234.42 203.18 L 235.09 200.84 L 235.70 198.34 L 236.25 195.68 L 236.78 192.87 L 237.29 189.90 L 237.79 186.80 L 238.30 183.59 L 238.82 180.30 L 239.37 176.95 L 239.94 173.58 L 240.54 170.21 L 241.17 166.88 L 241.84 163.62 L 242.54 160.46 L 243.27 157.42 L 244.03 154.54 L 244.82 151.84 L 245.64 149.34 L 246.48 147.06 L 247.38 145.01 L 247.38 145.01 L 246.21 146.91 L 244.68 148.79 L 242.83 150.65 L 240.72 152.49 L 238.37 154.34 L 235.82 156.19 L 233.11 158.09 L 230.27 160.03 L 227.34 162.06 L 224.36 164.19 L 221.36 166.45 L 218.40 168.85 L 215.50 171.43 L 212.73 174.21 L 210.12 177.19 L 207.72 180.41 L 205.60 183.85 L 203.79 187.53 L 202.36 191.43 L 201.37 195.54 L 200.86 199.81 L 200.91 204.19 L 201.55 208.60 L 202.81 212.96 L 204.72 217.14 L 207.25 221.03 Z" fill="url(#fxflr-chama-ext-${u})" style="animation-duration:5.50s;animation-delay:0.80s"/>
<path class="fx2-chama" d="M 235.02 204.59 L 236.42 203.27 L 237.72 201.89 L 238.89 200.46 L 239.95 198.97 L 240.89 197.44 L 241.71 195.86 L 242.42 194.25 L 243.02 192.61 L 243.53 190.95 L 243.94 189.27 L 244.27 187.57 L 244.54 185.87 L 244.75 184.17 L 244.91 182.48 L 245.04 180.81 L 245.15 179.16 L 245.26 177.54 L 245.39 175.95 L 245.53 174.41 L 245.71 172.93 L 245.93 171.51 L 246.21 170.16 L 246.56 168.90 L 246.99 167.73 L 247.49 166.67 L 248.09 165.73 L 248.09 165.73 L 247.36 166.57 L 246.50 167.41 L 245.52 168.25 L 244.44 169.11 L 243.26 170.00 L 242.00 170.92 L 240.68 171.88 L 239.30 172.87 L 237.89 173.91 L 236.46 175.00 L 235.04 176.14 L 233.63 177.33 L 232.26 178.57 L 230.95 179.87 L 229.72 181.22 L 228.57 182.64 L 227.52 184.11 L 226.60 185.65 L 225.80 187.24 L 225.15 188.90 L 224.64 190.61 L 224.29 192.38 L 224.09 194.22 L 224.05 196.11 L 224.17 198.05 L 224.44 200.05 Z" fill="url(#fxflr-chama-ext-${u})" style="animation-duration:4.30s;animation-delay:3.10s"/>
<path class="fx2-chama" d="M 245.42 206.48 L 246.00 206.14 L 246.55 205.82 L 247.07 205.45 L 247.59 205.02 L 248.09 204.52 L 248.60 203.93 L 249.12 203.27 L 249.63 202.53 L 250.15 201.73 L 250.67 200.86 L 251.18 199.95 L 251.69 199.00 L 252.17 198.02 L 252.64 197.03 L 253.08 196.03 L 253.48 195.04 L 253.85 194.06 L 254.16 193.12 L 254.42 192.22 L 254.62 191.38 L 254.75 190.60 L 254.79 189.90 L 254.75 189.29 L 254.62 188.80 L 254.41 188.44 L 254.15 188.16 L 254.15 188.16 L 254.33 188.48 L 254.31 188.82 L 254.12 189.15 L 253.80 189.45 L 253.36 189.76 L 252.82 190.07 L 252.18 190.40 L 251.46 190.74 L 250.67 191.11 L 249.81 191.51 L 248.91 191.95 L 247.98 192.43 L 247.02 192.96 L 246.05 193.55 L 245.09 194.19 L 244.14 194.90 L 243.23 195.68 L 242.37 196.53 L 241.57 197.46 L 240.84 198.47 L 240.22 199.56 L 239.72 200.72 L 239.35 201.94 L 239.16 203.22 L 239.16 204.53 L 239.38 205.82 Z" fill="url(#fxflr-chama-ext-${u})" style="animation-duration:5.00s;animation-delay:1.70s"/>
</g>
<!-- chamas-frente -->
<g class="fx2-chamas" filter="url(#fxflr-glow-${u})">
<path class="fx2-chama" d="M 70.63 205.30 L 71.08 204.22 L 71.39 203.11 L 71.54 201.97 L 71.55 200.84 L 71.43 199.73 L 71.19 198.66 L 70.86 197.64 L 70.45 196.66 L 69.96 195.73 L 69.42 194.86 L 68.83 194.03 L 68.21 193.24 L 67.57 192.50 L 66.91 191.79 L 66.26 191.11 L 65.62 190.45 L 65.00 189.81 L 64.42 189.19 L 63.88 188.57 L 63.39 187.95 L 62.96 187.32 L 62.62 186.69 L 62.36 186.05 L 62.21 185.41 L 62.19 184.76 L 62.30 184.14 L 62.30 184.14 L 62.11 184.75 L 61.93 185.40 L 61.76 186.09 L 61.61 186.85 L 61.48 187.68 L 61.39 188.55 L 61.32 189.48 L 61.28 190.44 L 61.26 191.43 L 61.28 192.45 L 61.32 193.46 L 61.38 194.48 L 61.47 195.48 L 61.58 196.45 L 61.71 197.39 L 61.86 198.29 L 62.03 199.14 L 62.22 199.94 L 62.44 200.67 L 62.69 201.34 L 62.97 201.96 L 63.29 202.52 L 63.64 203.05 L 64.04 203.56 L 64.48 204.08 L 64.95 204.65 Z" fill="url(#fxflr-chama-int-${u})" style="animation-duration:3.40s;animation-delay:0.00s"/>
<path class="fx2-chama" d="M 94.97 217.99 L 97.00 215.66 L 98.71 213.13 L 100.09 210.43 L 101.12 207.63 L 101.81 204.75 L 102.15 201.85 L 102.17 198.97 L 101.89 196.12 L 101.33 193.35 L 100.52 190.67 L 99.49 188.08 L 98.26 185.61 L 96.88 183.26 L 95.36 181.01 L 93.74 178.87 L 92.05 176.83 L 90.30 174.89 L 88.53 173.02 L 86.76 171.21 L 85.01 169.47 L 83.30 167.77 L 81.64 166.10 L 80.06 164.45 L 78.57 162.80 L 77.18 161.16 L 75.92 159.50 L 75.92 159.50 L 77.03 161.27 L 78.02 163.17 L 78.89 165.19 L 79.65 167.31 L 80.30 169.52 L 80.85 171.79 L 81.29 174.11 L 81.63 176.45 L 81.88 178.80 L 82.04 181.14 L 82.13 183.46 L 82.15 185.73 L 82.13 187.94 L 82.07 190.09 L 81.99 192.16 L 81.91 194.14 L 81.84 196.05 L 81.79 197.88 L 81.79 199.65 L 81.84 201.39 L 81.95 203.11 L 82.11 204.84 L 82.32 206.64 L 82.57 208.52 L 82.83 210.54 L 83.06 212.73 Z" fill="url(#fxflr-chama-int-${u})" style="animation-duration:4.50s;animation-delay:1.70s"/>
<path class="fx2-chama" d="M 115.21 224.57 L 115.48 222.50 L 115.74 220.51 L 115.97 218.58 L 116.14 216.66 L 116.24 214.75 L 116.26 212.80 L 116.21 210.82 L 116.07 208.79 L 115.84 206.71 L 115.53 204.59 L 115.13 202.41 L 114.65 200.21 L 114.08 197.99 L 113.43 195.75 L 112.70 193.53 L 111.89 191.33 L 111.00 189.17 L 110.04 187.06 L 109.01 185.02 L 107.92 183.06 L 106.77 181.19 L 105.57 179.39 L 104.32 177.66 L 103.01 175.99 L 101.65 174.35 L 100.22 172.71 L 100.22 172.71 L 101.52 174.45 L 102.51 176.30 L 103.22 178.23 L 103.66 180.19 L 103.85 182.17 L 103.82 184.16 L 103.62 186.13 L 103.26 188.09 L 102.78 190.05 L 102.22 192.02 L 101.60 193.99 L 100.95 195.99 L 100.31 198.03 L 99.70 200.11 L 99.14 202.25 L 98.68 204.45 L 98.32 206.71 L 98.11 209.04 L 98.06 211.43 L 98.21 213.87 L 98.58 216.35 L 99.18 218.85 L 100.04 221.34 L 101.17 223.78 L 102.58 226.14 L 104.26 228.37 Z" fill="url(#fxflr-chama-int-${u})" style="animation-duration:3.50s;animation-delay:0.50s"/>
<path class="fx2-chama" d="M 128.23 231.31 L 129.08 229.34 L 129.83 227.34 L 130.46 225.32 L 130.98 223.26 L 131.37 221.17 L 131.63 219.05 L 131.76 216.90 L 131.77 214.72 L 131.65 212.53 L 131.41 210.32 L 131.04 208.12 L 130.57 205.92 L 129.98 203.73 L 129.30 201.57 L 128.53 199.45 L 127.68 197.37 L 126.75 195.35 L 125.77 193.38 L 124.73 191.47 L 123.66 189.62 L 122.55 187.84 L 121.42 186.11 L 120.27 184.43 L 119.10 182.79 L 117.93 181.18 L 116.73 179.56 L 116.73 179.56 L 117.79 181.26 L 118.62 183.07 L 119.22 184.94 L 119.61 186.87 L 119.81 188.82 L 119.83 190.79 L 119.70 192.75 L 119.43 194.71 L 119.06 196.66 L 118.61 198.60 L 118.10 200.52 L 117.56 202.44 L 117.01 204.36 L 116.47 206.28 L 115.96 208.21 L 115.51 210.15 L 115.13 212.12 L 114.84 214.11 L 114.66 216.12 L 114.59 218.17 L 114.66 220.24 L 114.87 222.35 L 115.24 224.47 L 115.76 226.61 L 116.45 228.76 L 117.30 230.91 Z" fill="url(#fxflr-chama-int-${u})" style="animation-duration:4.60s;animation-delay:2.20s"/>
<path class="fx2-chama" d="M 154.63 234.59 L 156.84 230.31 L 158.65 225.88 L 160.06 221.33 L 161.07 216.72 L 161.70 212.07 L 161.97 207.42 L 161.91 202.79 L 161.55 198.22 L 160.91 193.71 L 160.02 189.27 L 158.93 184.92 L 157.67 180.65 L 156.27 176.47 L 154.76 172.37 L 153.19 168.35 L 151.58 164.41 L 149.97 160.53 L 148.39 156.71 L 146.88 152.95 L 145.48 149.23 L 144.20 145.56 L 143.09 141.94 L 142.17 138.35 L 141.49 134.81 L 141.06 131.33 L 140.93 127.92 L 140.93 127.92 L 140.82 131.33 L 140.65 134.86 L 140.42 138.52 L 140.14 142.29 L 139.83 146.18 L 139.48 150.18 L 139.11 154.27 L 138.73 158.43 L 138.33 162.65 L 137.93 166.90 L 137.55 171.17 L 137.17 175.43 L 136.83 179.66 L 136.53 183.85 L 136.28 187.99 L 136.09 192.06 L 135.96 196.05 L 135.92 199.96 L 135.97 203.79 L 136.11 207.57 L 136.35 211.29 L 136.68 214.98 L 137.09 218.68 L 137.58 222.42 L 138.11 226.24 L 138.65 230.19 Z" fill="url(#fxflr-chama-int-${u})" style="animation-duration:3.60s;animation-delay:1.00s"/>
<path class="fx2-chama" d="M 179.98 223.03 L 181.09 221.28 L 182.13 219.55 L 183.11 217.80 L 184.00 216.00 L 184.81 214.11 L 185.53 212.14 L 186.17 210.06 L 186.73 207.87 L 187.19 205.58 L 187.57 203.20 L 187.86 200.74 L 188.06 198.22 L 188.16 195.65 L 188.17 193.05 L 188.07 190.44 L 187.87 187.85 L 187.56 185.29 L 187.15 182.80 L 186.64 180.39 L 186.02 178.07 L 185.31 175.88 L 184.51 173.80 L 183.63 171.83 L 182.68 169.97 L 181.67 168.17 L 180.58 166.40 L 180.58 166.40 L 181.50 168.25 L 182.06 170.19 L 182.28 172.16 L 182.20 174.13 L 181.85 176.08 L 181.26 177.99 L 180.47 179.87 L 179.52 181.72 L 178.45 183.55 L 177.27 185.39 L 176.02 187.24 L 174.72 189.12 L 173.41 191.05 L 172.10 193.03 L 170.84 195.09 L 169.63 197.23 L 168.51 199.46 L 167.51 201.79 L 166.65 204.22 L 165.96 206.75 L 165.47 209.37 L 165.21 212.07 L 165.21 214.82 L 165.49 217.60 L 166.07 220.37 L 166.98 223.08 Z" fill="url(#fxflr-chama-int-${u})" style="animation-duration:4.70s;animation-delay:2.70s"/>
<path class="fx2-chama" d="M 199.18 229.50 L 200.37 227.43 L 201.45 225.37 L 202.42 223.28 L 203.27 221.15 L 204.00 218.99 L 204.61 216.77 L 205.10 214.49 L 205.48 212.16 L 205.74 209.77 L 205.90 207.34 L 205.96 204.86 L 205.94 202.35 L 205.83 199.82 L 205.66 197.27 L 205.42 194.73 L 205.14 192.20 L 204.82 189.70 L 204.47 187.24 L 204.10 184.83 L 203.73 182.49 L 203.36 180.22 L 203.00 178.03 L 202.66 175.93 L 202.36 173.91 L 202.10 171.97 L 201.89 170.10 L 201.89 170.10 L 201.89 171.98 L 201.61 173.90 L 201.09 175.85 L 200.35 177.80 L 199.44 179.76 L 198.36 181.71 L 197.15 183.67 L 195.84 185.63 L 194.45 187.61 L 193.02 189.61 L 191.56 191.63 L 190.10 193.70 L 188.69 195.81 L 187.33 197.97 L 186.06 200.21 L 184.90 202.51 L 183.88 204.88 L 183.03 207.33 L 182.36 209.85 L 181.90 212.44 L 181.66 215.10 L 181.67 217.80 L 181.93 220.54 L 182.47 223.30 L 183.28 226.04 L 184.38 228.75 Z" fill="url(#fxflr-chama-int-${u})" style="animation-duration:3.70s;animation-delay:1.50s"/>
<path class="fx2-chama" d="M 218.09 213.23 L 219.48 210.57 L 220.65 207.84 L 221.58 205.06 L 222.29 202.27 L 222.80 199.48 L 223.11 196.70 L 223.25 193.94 L 223.23 191.22 L 223.08 188.54 L 222.81 185.90 L 222.45 183.31 L 222.03 180.75 L 221.56 178.22 L 221.08 175.72 L 220.61 173.25 L 220.18 170.79 L 219.81 168.34 L 219.54 165.90 L 219.40 163.47 L 219.42 161.04 L 219.61 158.62 L 220.02 156.23 L 220.67 153.87 L 221.57 151.58 L 222.75 149.37 L 224.22 147.28 L 224.22 147.28 L 222.59 149.26 L 220.97 151.22 L 219.35 153.20 L 217.75 155.24 L 216.15 157.35 L 214.57 159.55 L 213.02 161.85 L 211.51 164.24 L 210.06 166.72 L 208.68 169.27 L 207.39 171.89 L 206.20 174.56 L 205.13 177.25 L 204.17 179.96 L 203.35 182.67 L 202.67 185.36 L 202.15 188.02 L 201.77 190.65 L 201.56 193.23 L 201.51 195.77 L 201.63 198.27 L 201.91 200.73 L 202.35 203.18 L 202.93 205.62 L 203.65 208.08 L 204.48 210.59 Z" fill="url(#fxflr-chama-int-${u})" style="animation-duration:4.80s;animation-delay:0.30s"/>
<path class="fx2-chama" d="M 237.13 213.43 L 238.04 212.80 L 238.90 212.12 L 239.71 211.39 L 240.46 210.61 L 241.15 209.76 L 241.79 208.86 L 242.36 207.90 L 242.87 206.88 L 243.32 205.81 L 243.70 204.70 L 244.02 203.56 L 244.27 202.38 L 244.46 201.19 L 244.57 199.99 L 244.62 198.80 L 244.59 197.63 L 244.50 196.48 L 244.34 195.37 L 244.11 194.32 L 243.82 193.33 L 243.47 192.42 L 243.08 191.58 L 242.65 190.82 L 242.20 190.12 L 241.72 189.47 L 241.21 188.82 L 241.21 188.82 L 241.64 189.51 L 241.90 190.25 L 242.00 191.01 L 241.95 191.76 L 241.77 192.50 L 241.48 193.22 L 241.10 193.91 L 240.64 194.59 L 240.11 195.25 L 239.53 195.92 L 238.91 196.59 L 238.26 197.27 L 237.58 197.97 L 236.90 198.70 L 236.22 199.46 L 235.55 200.26 L 234.89 201.11 L 234.27 201.99 L 233.68 202.93 L 233.13 203.91 L 232.64 204.95 L 232.22 206.03 L 231.87 207.16 L 231.60 208.33 L 231.42 209.53 L 231.34 210.75 Z" fill="url(#fxflr-chama-int-${u})" style="animation-duration:3.80s;animation-delay:2.00s"/>
</g>
<!-- brasa -->
<g opacity="0.85" filter="url(#fxflr-blur34-${u})">
<ellipse cx="150.0" cy="224.0" rx="104.0" ry="26.0" fill="url(#fxflr-brasa-${u})"/>
</g>
<!-- frente-fria -->
<g class="fx2-frente" clip-path="url(#fxflr-corte-${u})">
<rect x="0" y="112.0" width="300" height="76.0" fill="url(#fxflr-frente-${u})" opacity=".75"/>
</g>
<!-- cristais -->
<g filter="url(#fxflr-glow-${u})">
<path class="fx2-cristal" d="M 203.63 127.40 L 204.52 129.25 L 205.54 130.99 L 206.67 132.65 L 207.91 134.22 L 209.28 135.68 L 210.76 137.06 L 212.36 138.36 L 214.09 139.56 L 214.09 139.56 L 213.16 137.67 L 212.12 135.89 L 210.98 134.22 L 209.73 132.65 L 208.37 131.19 L 206.90 129.83 L 205.33 128.56 L 203.63 127.40 Z" fill="url(#fxflr-cristal-${u})" style="animation-delay:0.00s;animation-duration:5.20s"/>
<path class="fx2-cristal" d="M 211.60 125.67 L 210.42 127.43 L 209.40 129.24 L 208.50 131.11 L 207.75 133.02 L 207.14 135.00 L 206.67 137.04 L 206.32 139.13 L 206.13 141.29 L 206.13 141.29 L 207.32 139.48 L 208.36 137.63 L 209.26 135.74 L 210.01 133.82 L 210.62 131.85 L 211.08 129.83 L 211.42 127.78 L 211.60 125.67 Z" fill="url(#fxflr-cristal-${u})" style="animation-delay:0.00s;animation-duration:5.20s"/>
<path class="fx2-cristal" d="M 218.73 131.61 L 216.19 131.55 L 213.68 131.66 L 211.18 131.90 L 208.71 132.29 L 206.26 132.83 L 203.83 133.52 L 201.40 134.35 L 198.99 135.34 L 198.99 135.34 L 201.60 135.39 L 204.16 135.28 L 206.68 135.03 L 209.16 134.64 L 211.60 134.10 L 214.01 133.42 L 216.39 132.60 L 218.73 131.61 Z" fill="url(#fxflr-cristal-${u})" style="animation-delay:0.00s;animation-duration:5.20s"/>
<path class="fx2-cristal" d="M 66.80 103.29 L 65.48 105.84 L 64.32 108.44 L 63.29 111.08 L 62.40 113.77 L 61.66 116.52 L 61.05 119.33 L 60.57 122.19 L 60.25 125.11 L 60.25 125.11 L 61.59 122.49 L 62.76 119.84 L 63.80 117.17 L 64.70 114.46 L 65.44 111.73 L 66.03 108.95 L 66.50 106.14 L 66.80 103.29 Z" fill="url(#fxflr-cristal-${u})" style="animation-delay:0.74s;animation-duration:6.10s"/>
<path class="fx2-cristal" d="M 73.50 111.85 L 70.91 111.91 L 68.35 112.14 L 65.82 112.51 L 63.32 113.02 L 60.85 113.68 L 58.40 114.49 L 55.97 115.44 L 53.55 116.56 L 53.55 116.56 L 56.21 116.47 L 58.81 116.23 L 61.37 115.86 L 63.88 115.35 L 66.34 114.69 L 68.76 113.88 L 71.15 112.95 L 73.50 111.85 Z" fill="url(#fxflr-cristal-${u})" style="animation-delay:0.74s;animation-duration:6.10s"/>
<path class="fx2-cristal" d="M 70.30 121.40 L 69.01 119.25 L 67.59 117.22 L 66.08 115.28 L 64.45 113.43 L 62.70 111.69 L 60.83 110.04 L 58.86 108.47 L 56.75 107.01 L 56.75 107.01 L 58.09 109.20 L 59.53 111.26 L 61.07 113.23 L 62.70 115.08 L 64.45 116.82 L 66.29 118.44 L 68.24 119.98 L 70.30 121.40 Z" fill="url(#fxflr-cristal-${u})" style="animation-delay:0.74s;animation-duration:6.10s"/>
<path class="fx2-cristal" d="M 231.00 56.80 L 229.60 58.16 L 228.34 59.60 L 227.20 61.12 L 226.19 62.72 L 225.30 64.40 L 224.55 66.17 L 223.90 68.01 L 223.39 69.94 L 223.39 69.94 L 224.82 68.54 L 226.09 67.06 L 227.25 65.53 L 228.26 63.92 L 229.14 62.25 L 229.89 60.50 L 230.52 58.69 L 231.00 56.80 Z" fill="url(#fxflr-cristal-${u})" style="animation-delay:1.48s;animation-duration:7.00s"/>
<path class="fx2-cristal" d="M 234.27 63.38 L 232.52 62.85 L 230.77 62.48 L 229.01 62.25 L 227.25 62.17 L 225.48 62.25 L 223.71 62.47 L 221.92 62.83 L 220.13 63.36 L 220.13 63.36 L 221.92 63.89 L 223.71 64.26 L 225.48 64.49 L 227.25 64.57 L 229.01 64.49 L 230.76 64.27 L 232.52 63.91 L 234.27 63.38 Z" fill="url(#fxflr-cristal-${u})" style="animation-delay:1.48s;animation-duration:7.00s"/>
<path class="fx2-cristal" d="M 230.79 69.60 L 230.36 67.80 L 229.78 66.07 L 229.09 64.41 L 228.26 62.82 L 227.30 61.30 L 226.20 59.85 L 224.98 58.45 L 223.61 57.13 L 223.61 57.13 L 224.06 58.98 L 224.65 60.74 L 225.35 62.42 L 226.18 64.02 L 227.14 65.53 L 228.23 66.96 L 229.44 68.33 L 230.79 69.60 Z" fill="url(#fxflr-cristal-${u})" style="animation-delay:1.48s;animation-duration:7.00s"/>
<path class="fx2-cristal" d="M 164.13 157.90 L 164.04 159.67 L 164.12 161.40 L 164.34 163.10 L 164.69 164.76 L 165.20 166.39 L 165.86 168.00 L 166.65 169.57 L 167.61 171.11 L 167.61 171.11 L 167.68 169.30 L 167.59 167.54 L 167.37 165.82 L 167.01 164.15 L 166.51 162.53 L 165.85 160.95 L 165.07 159.40 L 164.13 157.90 Z" fill="url(#fxflr-cristal-${u})" style="animation-delay:2.22s;animation-duration:5.20s"/>
<path class="fx2-cristal" d="M 169.94 160.46 L 168.56 161.09 L 167.30 161.83 L 166.12 162.67 L 165.05 163.63 L 164.09 164.69 L 163.23 165.87 L 162.45 167.15 L 161.79 168.55 L 161.79 168.55 L 163.20 167.90 L 164.49 167.14 L 165.67 166.28 L 166.74 165.33 L 167.70 164.27 L 168.55 163.10 L 169.31 161.84 L 169.94 160.46 Z" fill="url(#fxflr-cristal-${u})" style="animation-delay:2.22s;animation-duration:5.20s"/>
<path class="fx2-cristal" d="M 171.23 165.97 L 170.04 165.10 L 168.81 164.38 L 167.54 163.80 L 166.22 163.36 L 164.86 163.07 L 163.46 162.92 L 162.01 162.91 L 160.50 163.05 L 160.50 163.05 L 161.73 163.93 L 162.99 164.65 L 164.27 165.24 L 165.59 165.68 L 166.95 165.96 L 168.34 166.11 L 169.77 166.12 L 171.23 165.97 Z" fill="url(#fxflr-cristal-${u})" style="animation-delay:2.22s;animation-duration:5.20s"/>
<path class="fx2-cristal" d="M 79.39 57.27 L 78.47 59.76 L 77.71 62.28 L 77.09 64.82 L 76.62 67.40 L 76.30 70.00 L 76.12 72.65 L 76.08 75.32 L 76.20 78.04 L 76.20 78.04 L 77.13 75.48 L 77.89 72.92 L 78.51 70.35 L 78.99 67.76 L 79.31 65.16 L 79.48 62.55 L 79.52 59.92 L 79.39 57.27 Z" fill="url(#fxflr-cristal-${u})" style="animation-delay:2.96s;animation-duration:6.10s"/>
<path class="fx2-cristal" d="M 87.35 63.94 L 84.79 64.36 L 82.29 64.95 L 79.84 65.66 L 77.43 66.51 L 75.07 67.51 L 72.75 68.66 L 70.47 69.94 L 68.23 71.38 L 68.23 71.38 L 70.86 70.93 L 73.40 70.33 L 75.88 69.61 L 78.30 68.75 L 80.65 67.75 L 82.94 66.61 L 85.18 65.35 L 87.35 63.94 Z" fill="url(#fxflr-cristal-${u})" style="animation-delay:2.96s;animation-duration:6.10s"/>
<path class="fx2-cristal" d="M 84.45 73.00 L 83.14 71.26 L 81.71 69.66 L 80.20 68.15 L 78.59 66.76 L 76.88 65.49 L 75.07 64.33 L 73.16 63.26 L 71.13 62.32 L 71.13 62.32 L 72.49 64.09 L 73.95 65.72 L 75.48 67.24 L 77.09 68.63 L 78.80 69.90 L 80.59 71.05 L 82.47 72.09 L 84.45 73.00 Z" fill="url(#fxflr-cristal-${u})" style="animation-delay:2.96s;animation-duration:6.10s"/>
<path class="fx2-cristal" d="M 255.98 103.80 L 254.52 104.99 L 253.20 106.27 L 251.98 107.63 L 250.89 109.08 L 249.92 110.63 L 249.07 112.27 L 248.32 113.99 L 247.71 115.82 L 247.71 115.82 L 249.20 114.59 L 250.54 113.28 L 251.77 111.90 L 252.86 110.45 L 253.83 108.91 L 254.67 107.29 L 255.39 105.59 L 255.98 103.80 Z" fill="url(#fxflr-cristal-${u})" style="animation-delay:3.70s;animation-duration:7.00s"/>
<path class="fx2-cristal" d="M 259.10 110.39 L 257.35 109.72 L 255.58 109.21 L 253.80 108.84 L 251.99 108.62 L 250.17 108.55 L 248.33 108.63 L 246.47 108.85 L 244.59 109.23 L 244.59 109.23 L 246.39 109.91 L 248.19 110.42 L 250.00 110.79 L 251.80 111.01 L 253.62 111.08 L 255.44 110.99 L 257.26 110.77 L 259.10 110.39 Z" fill="url(#fxflr-cristal-${u})" style="animation-delay:3.70s;animation-duration:7.00s"/>
<path class="fx2-cristal" d="M 254.97 116.38 L 254.68 114.52 L 254.23 112.74 L 253.66 111.01 L 252.95 109.34 L 252.10 107.74 L 251.11 106.19 L 249.99 104.68 L 248.72 103.24 L 248.72 103.24 L 249.03 105.14 L 249.50 106.95 L 250.07 108.70 L 250.78 110.38 L 251.63 111.98 L 252.62 113.51 L 253.72 114.98 L 254.97 116.38 Z" fill="url(#fxflr-cristal-${u})" style="animation-delay:3.70s;animation-duration:7.00s"/>
<path class="fx2-cristal" d="M 66.75 138.66 L 67.67 140.05 L 68.69 141.31 L 69.79 142.47 L 70.99 143.51 L 72.30 144.43 L 73.70 145.24 L 75.19 145.95 L 76.79 146.53 L 76.79 146.53 L 75.84 145.11 L 74.80 143.83 L 73.68 142.66 L 72.48 141.62 L 71.18 140.70 L 69.79 139.90 L 68.32 139.21 L 66.75 138.66 Z" fill="url(#fxflr-cristal-${u})" style="animation-delay:4.44s;animation-duration:5.20s"/>
<path class="fx2-cristal" d="M 72.66 136.36 L 71.92 137.83 L 71.34 139.32 L 70.89 140.84 L 70.59 142.38 L 70.45 143.95 L 70.45 145.54 L 70.58 147.17 L 70.88 148.83 L 70.88 148.83 L 71.63 147.32 L 72.22 145.80 L 72.67 144.26 L 72.97 142.72 L 73.11 141.15 L 73.11 139.57 L 72.97 137.97 L 72.66 136.36 Z" fill="url(#fxflr-cristal-${u})" style="animation-delay:4.44s;animation-duration:5.20s"/>
<path class="fx2-cristal" d="M 77.59 140.25 L 75.95 140.34 L 74.38 140.58 L 72.85 140.95 L 71.37 141.46 L 69.94 142.12 L 68.57 142.92 L 67.24 143.84 L 65.95 144.93 L 65.95 144.93 L 67.63 144.83 L 69.23 144.58 L 70.78 144.20 L 72.26 143.69 L 73.68 143.03 L 75.04 142.24 L 76.35 141.33 L 77.59 140.25 Z" fill="url(#fxflr-cristal-${u})" style="animation-delay:4.44s;animation-duration:5.20s"/>
</g>
<!-- sublimacao -->
<g class="fx2-poeira">
<circle cx="171.9" cy="212.2" r="2.71" fill="#eaf6ff" opacity="0" style="animation-delay:2.38s;animation-duration:2.48s"/>
<circle cx="157.0" cy="91.3" r="2.58" fill="#eaf6ff" opacity="0" style="animation-delay:1.56s;animation-duration:3.37s"/>
<circle cx="156.7" cy="264.0" r="2.64" fill="#eaf6ff" opacity="0" style="animation-delay:0.66s;animation-duration:2.79s"/>
<circle cx="41.6" cy="199.2" r="2.34" fill="#eaf6ff" opacity="0" style="animation-delay:3.18s;animation-duration:4.11s"/>
<circle cx="97.9" cy="168.7" r="1.51" fill="#eaf6ff" opacity="0" style="animation-delay:3.87s;animation-duration:4.0s"/>
<circle cx="215.9" cy="177.7" r="1.54" fill="#eaf6ff" opacity="0" style="animation-delay:2.72s;animation-duration:2.47s"/>
<circle cx="106.0" cy="138.7" r="1.25" fill="#eaf6ff" opacity="0" style="animation-delay:2.11s;animation-duration:3.86s"/>
<circle cx="131.8" cy="88.0" r="1.18" fill="#eaf6ff" opacity="0" style="animation-delay:3.62s;animation-duration:2.88s"/>
<circle cx="78.9" cy="259.1" r="2.43" fill="#eaf6ff" opacity="0" style="animation-delay:0.7s;animation-duration:4.73s"/>
<circle cx="238.8" cy="148.3" r="1.04" fill="#eaf6ff" opacity="0" style="animation-delay:0.93s;animation-duration:4.44s"/>
<circle cx="97.8" cy="168.3" r="2.19" fill="#eaf6ff" opacity="0" style="animation-delay:1.37s;animation-duration:2.5s"/>
<circle cx="252.3" cy="166.0" r="2.19" fill="#eaf6ff" opacity="0" style="animation-delay:3.23s;animation-duration:2.95s"/>
<circle cx="132.3" cy="284.3" r="1.49" fill="#eaf6ff" opacity="0" style="animation-delay:3.61s;animation-duration:3.41s"/>
<circle cx="78.7" cy="205.9" r="1.00" fill="#eaf6ff" opacity="0" style="animation-delay:1.32s;animation-duration:5.03s"/>
<circle cx="175.2" cy="92.7" r="2.65" fill="#eaf6ff" opacity="0" style="animation-delay:3.99s;animation-duration:4.46s"/>
<circle cx="51.1" cy="113.5" r="1.42" fill="#eaf6ff" opacity="0" style="animation-delay:3.62s;animation-duration:2.6s"/>
<circle cx="73.0" cy="160.1" r="2.05" fill="#eaf6ff" opacity="0" style="animation-delay:2.8s;animation-duration:2.41s"/>
<circle cx="193.3" cy="273.9" r="2.22" fill="#eaf6ff" opacity="0" style="animation-delay:0.4s;animation-duration:3.3s"/>
<circle cx="193.9" cy="141.2" r="2.06" fill="#eaf6ff" opacity="0" style="animation-delay:0.47s;animation-duration:3.54s"/>
<circle cx="121.8" cy="261.7" r="1.91" fill="#eaf6ff" opacity="0" style="animation-delay:3.68s;animation-duration:4.56s"/>
<circle cx="156.3" cy="123.6" r="1.37" fill="#eaf6ff" opacity="0" style="animation-delay:1.11s;animation-duration:4.87s"/>
<circle cx="238.1" cy="243.5" r="1.37" fill="#eaf6ff" opacity="0" style="animation-delay:0.37s;animation-duration:2.72s"/>
<circle cx="36.8" cy="194.5" r="2.14" fill="#eaf6ff" opacity="0" style="animation-delay:2.74s;animation-duration:3.47s"/>
<circle cx="72.1" cy="248.9" r="1.97" fill="#eaf6ff" opacity="0" style="animation-delay:3.86s;animation-duration:4.27s"/>
<circle cx="77.3" cy="168.3" r="1.98" fill="#eaf6ff" opacity="0" style="animation-delay:1.37s;animation-duration:3.38s"/>
<circle cx="248.5" cy="137.1" r="2.11" fill="#eaf6ff" opacity="0" style="animation-delay:3.38s;animation-duration:2.4s"/>
</g>

</svg>`;
});

/* FORJA:FIM fenix-v2 */

window.Auras = Auras;

