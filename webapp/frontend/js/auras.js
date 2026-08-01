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
<radialGradient id="fxflr-frente-${u}" cx="0.5" cy="0.5" r="0.5"><stop offset="0.0" stop-color="#eaf6ff" stop-opacity="0.55"/><stop offset="0.42" stop-color="#7fd4ff" stop-opacity="0.3"/><stop offset="1.0" stop-color="#7fd4ff" stop-opacity="0"/></radialGradient>
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
<path class="fx2-chama" d="M 49.08 155.80 L 49.37 154.78 L 49.59 153.76 L 49.73 152.73 L 49.80 151.69 L 49.78 150.65 L 49.68 149.60 L 49.49 148.56 L 49.21 147.51 L 48.85 146.47 L 48.40 145.45 L 47.87 144.45 L 47.26 143.48 L 46.57 142.54 L 45.82 141.66 L 45.01 140.82 L 44.15 140.04 L 43.24 139.33 L 42.30 138.67 L 41.34 138.08 L 40.35 137.55 L 39.34 137.07 L 38.32 136.62 L 37.27 136.20 L 36.20 135.80 L 35.09 135.41 L 33.93 135.00 L 33.93 135.00 L 35.05 135.50 L 36.04 136.12 L 36.90 136.84 L 37.61 137.64 L 38.19 138.50 L 38.62 139.41 L 38.93 140.33 L 39.12 141.26 L 39.21 142.18 L 39.22 143.09 L 39.17 143.98 L 39.08 144.85 L 38.97 145.70 L 38.87 146.54 L 38.77 147.38 L 38.71 148.21 L 38.70 149.05 L 38.75 149.89 L 38.86 150.75 L 39.06 151.62 L 39.35 152.51 L 39.73 153.41 L 40.21 154.31 L 40.79 155.23 L 41.48 156.14 L 42.27 157.03 Z" fill="url(#fxflr-chama-ext-${u})" style="animation-duration:4.20s;animation-delay:0.00s"/>
<path class="fx2-chama" d="M 67.04 181.13 L 68.49 179.34 L 69.70 177.42 L 70.66 175.38 L 71.36 173.25 L 71.79 171.05 L 71.95 168.82 L 71.83 166.58 L 71.44 164.35 L 70.80 162.17 L 69.92 160.07 L 68.82 158.06 L 67.51 156.16 L 66.03 154.40 L 64.40 152.78 L 62.65 151.31 L 60.80 149.98 L 58.88 148.80 L 56.91 147.74 L 54.90 146.81 L 52.88 145.96 L 50.84 145.19 L 48.79 144.47 L 46.73 143.78 L 44.64 143.09 L 42.52 142.38 L 40.35 141.63 L 40.35 141.63 L 42.45 142.54 L 44.37 143.64 L 46.10 144.90 L 47.62 146.30 L 48.94 147.81 L 50.06 149.39 L 50.97 151.02 L 51.68 152.68 L 52.22 154.33 L 52.60 155.97 L 52.84 157.56 L 52.97 159.10 L 53.01 160.58 L 53.00 162.00 L 52.95 163.36 L 52.90 164.67 L 52.86 165.93 L 52.87 167.17 L 52.92 168.39 L 53.04 169.62 L 53.23 170.87 L 53.50 172.17 L 53.85 173.52 L 54.27 174.94 L 54.76 176.46 L 55.30 178.08 Z" fill="url(#fxflr-chama-ext-${u})" style="animation-duration:4.90s;animation-delay:2.30s"/>
<path class="fx2-chama" d="M 84.16 178.21 L 84.07 174.55 L 83.98 171.12 L 83.85 167.86 L 83.62 164.72 L 83.25 161.66 L 82.73 158.62 L 82.03 155.59 L 81.16 152.52 L 80.10 149.42 L 78.86 146.27 L 77.44 143.08 L 75.85 139.87 L 74.09 136.65 L 72.18 133.44 L 70.13 130.28 L 67.93 127.19 L 65.62 124.22 L 63.20 121.37 L 60.68 118.68 L 58.10 116.16 L 55.46 113.81 L 52.77 111.62 L 50.04 109.56 L 47.26 107.58 L 44.38 105.63 L 41.39 103.66 L 41.39 103.66 L 44.17 105.90 L 46.41 108.48 L 48.11 111.30 L 49.29 114.27 L 49.99 117.34 L 50.25 120.44 L 50.14 123.55 L 49.73 126.65 L 49.09 129.75 L 48.30 132.85 L 47.42 135.99 L 46.51 139.18 L 45.66 142.44 L 44.91 145.81 L 44.32 149.29 L 43.97 152.89 L 43.89 156.62 L 44.16 160.47 L 44.81 164.42 L 45.90 168.43 L 47.47 172.47 L 49.55 176.47 L 52.16 180.36 L 55.31 184.08 L 58.98 187.53 L 63.14 190.64 Z" fill="url(#fxflr-chama-ext-${u})" style="animation-duration:5.60s;animation-delay:0.90s"/>
<path class="fx2-chama" d="M 103.52 208.29 L 105.64 203.51 L 107.08 198.49 L 107.85 193.36 L 107.99 188.21 L 107.55 183.12 L 106.58 178.16 L 105.15 173.35 L 103.31 168.74 L 101.13 164.32 L 98.67 160.11 L 95.97 156.09 L 93.10 152.28 L 90.10 148.64 L 87.02 145.16 L 83.90 141.83 L 80.80 138.63 L 77.75 135.55 L 74.81 132.55 L 72.01 129.62 L 69.39 126.76 L 67.01 123.93 L 64.90 121.13 L 63.11 118.35 L 61.70 115.59 L 60.71 112.86 L 60.21 110.18 L 60.21 110.18 L 60.47 112.90 L 60.85 115.83 L 61.37 118.96 L 62.03 122.31 L 62.81 125.86 L 63.71 129.58 L 64.71 133.46 L 65.79 137.46 L 66.94 141.57 L 68.15 145.74 L 69.40 149.96 L 70.67 154.19 L 71.96 158.41 L 73.25 162.59 L 74.53 166.69 L 75.79 170.71 L 77.03 174.61 L 78.23 178.39 L 79.41 182.03 L 80.54 185.53 L 81.64 188.90 L 82.71 192.16 L 83.75 195.35 L 84.74 198.53 L 85.66 201.77 L 86.47 205.15 Z" fill="url(#fxflr-chama-ext-${u})" style="animation-duration:4.40s;animation-delay:3.20s"/>
<path class="fx2-chama" d="M 123.11 218.99 L 123.15 216.03 L 123.11 213.22 L 122.97 210.54 L 122.71 207.98 L 122.34 205.52 L 121.83 203.16 L 121.21 200.86 L 120.46 198.61 L 119.60 196.41 L 118.65 194.22 L 117.61 192.04 L 116.51 189.86 L 115.37 187.66 L 114.21 185.43 L 113.07 183.17 L 111.96 180.88 L 110.91 178.56 L 109.95 176.20 L 109.11 173.82 L 108.41 171.42 L 107.88 169.01 L 107.54 166.61 L 107.41 164.24 L 107.50 161.91 L 107.84 159.66 L 108.45 157.50 L 108.45 157.50 L 107.59 159.57 L 106.60 161.66 L 105.49 163.78 L 104.28 165.96 L 103.00 168.22 L 101.68 170.56 L 100.33 173.00 L 98.98 175.54 L 97.67 178.19 L 96.43 180.94 L 95.29 183.80 L 94.28 186.74 L 93.43 189.77 L 92.77 192.86 L 92.33 196.01 L 92.13 199.19 L 92.21 202.38 L 92.57 205.56 L 93.23 208.71 L 94.20 211.79 L 95.50 214.79 L 97.12 217.68 L 99.05 220.42 L 101.30 223.00 L 103.85 225.40 L 106.68 227.59 Z" fill="url(#fxflr-chama-ext-${u})" style="animation-duration:5.10s;animation-delay:1.80s"/>
<path class="fx2-chama" d="M 135.33 207.70 L 135.23 203.52 L 135.06 199.47 L 134.80 195.52 L 134.44 191.65 L 133.98 187.86 L 133.40 184.12 L 132.72 180.43 L 131.93 176.77 L 131.05 173.12 L 130.10 169.48 L 129.08 165.83 L 128.03 162.18 L 126.95 158.51 L 125.89 154.81 L 124.85 151.10 L 123.86 147.37 L 122.96 143.63 L 122.17 139.89 L 121.51 136.14 L 121.00 132.41 L 120.68 128.71 L 120.55 125.05 L 120.64 121.44 L 120.96 117.92 L 121.54 114.50 L 122.38 111.20 L 122.38 111.20 L 121.27 114.42 L 120.01 117.68 L 118.62 120.99 L 117.14 124.38 L 115.58 127.84 L 113.98 131.40 L 112.35 135.06 L 110.73 138.83 L 109.16 142.70 L 107.65 146.68 L 106.26 150.76 L 105.00 154.95 L 103.92 159.22 L 103.05 163.58 L 102.42 168.00 L 102.06 172.47 L 102.00 176.97 L 102.26 181.49 L 102.86 185.99 L 103.81 190.46 L 105.14 194.86 L 106.84 199.17 L 108.92 203.36 L 111.37 207.40 L 114.18 211.27 L 117.34 214.94 Z" fill="url(#fxflr-chama-ext-${u})" style="animation-duration:5.80s;animation-delay:0.40s"/>
<path class="fx2-chama" d="M 152.65 222.12 L 154.94 216.47 L 157.01 210.71 L 158.85 204.86 L 160.46 198.94 L 161.83 192.94 L 162.96 186.89 L 163.85 180.80 L 164.51 174.67 L 164.95 168.53 L 165.17 162.38 L 165.19 156.24 L 165.02 150.13 L 164.67 144.05 L 164.16 138.02 L 163.52 132.06 L 162.74 126.17 L 161.87 120.37 L 160.90 114.66 L 159.87 109.05 L 158.78 103.56 L 157.66 98.18 L 156.51 92.92 L 155.36 87.77 L 154.22 82.75 L 153.09 77.85 L 152.00 73.04 L 152.00 73.04 L 152.85 77.89 L 153.34 82.89 L 153.52 88.01 L 153.40 93.24 L 153.02 98.54 L 152.40 103.92 L 151.58 109.35 L 150.57 114.83 L 149.42 120.35 L 148.15 125.90 L 146.80 131.48 L 145.40 137.09 L 143.98 142.73 L 142.58 148.40 L 141.22 154.09 L 139.94 159.81 L 138.75 165.56 L 137.69 171.35 L 136.77 177.16 L 136.01 183.01 L 135.44 188.90 L 135.05 194.82 L 134.86 200.77 L 134.88 206.75 L 135.10 212.77 L 135.52 218.80 Z" fill="url(#fxflr-chama-ext-${u})" style="animation-duration:4.60s;animation-delay:2.70s"/>
<path class="fx2-chama" d="M 178.97 226.11 L 180.95 221.67 L 182.53 217.13 L 183.73 212.55 L 184.55 207.96 L 185.04 203.40 L 185.21 198.89 L 185.10 194.46 L 184.75 190.10 L 184.19 185.83 L 183.46 181.65 L 182.60 177.55 L 181.65 173.52 L 180.66 169.54 L 179.66 165.62 L 178.71 161.72 L 177.84 157.84 L 177.12 153.95 L 176.59 150.06 L 176.30 146.15 L 176.31 142.22 L 176.68 138.29 L 177.44 134.37 L 178.66 130.49 L 180.35 126.71 L 182.56 123.07 L 185.30 119.63 L 185.30 119.63 L 182.33 122.89 L 179.49 126.14 L 176.77 129.43 L 174.15 132.81 L 171.63 136.31 L 169.22 139.96 L 166.93 143.77 L 164.77 147.73 L 162.76 151.84 L 160.92 156.08 L 159.25 160.43 L 157.77 164.85 L 156.50 169.32 L 155.42 173.81 L 154.56 178.30 L 153.91 182.76 L 153.48 187.16 L 153.27 191.50 L 153.28 195.76 L 153.49 199.93 L 153.92 204.01 L 154.55 208.01 L 155.37 211.95 L 156.36 215.85 L 157.51 219.75 L 158.78 223.68 Z" fill="url(#fxflr-chama-ext-${u})" style="animation-duration:5.30s;animation-delay:1.30s"/>
<path class="fx2-chama" d="M 194.44 223.90 L 196.84 221.28 L 198.89 218.47 L 200.57 215.53 L 201.90 212.50 L 202.87 209.43 L 203.50 206.35 L 203.81 203.30 L 203.83 200.29 L 203.58 197.34 L 203.11 194.46 L 202.44 191.66 L 201.60 188.93 L 200.64 186.28 L 199.59 183.70 L 198.48 181.18 L 197.36 178.70 L 196.25 176.26 L 195.21 173.84 L 194.26 171.44 L 193.44 169.05 L 192.78 166.67 L 192.33 164.30 L 192.12 161.94 L 192.18 159.62 L 192.54 157.37 L 193.23 155.21 L 193.23 155.21 L 192.30 157.28 L 191.31 159.38 L 190.28 161.52 L 189.21 163.74 L 188.11 166.03 L 186.99 168.40 L 185.86 170.84 L 184.73 173.35 L 183.63 175.91 L 182.55 178.51 L 181.51 181.14 L 180.52 183.77 L 179.60 186.39 L 178.77 188.99 L 178.02 191.56 L 177.37 194.08 L 176.84 196.55 L 176.43 198.97 L 176.14 201.34 L 176.00 203.67 L 175.99 205.97 L 176.12 208.26 L 176.38 210.58 L 176.75 212.94 L 177.22 215.40 L 177.76 217.98 Z" fill="url(#fxflr-chama-ext-${u})" style="animation-duration:6.00s;animation-delay:3.60s"/>
<path class="fx2-chama" d="M 219.97 198.00 L 220.39 194.39 L 221.08 191.24 L 221.92 188.39 L 222.80 185.63 L 223.72 182.81 L 224.68 179.80 L 225.72 176.55 L 226.85 173.01 L 228.10 169.20 L 229.46 165.13 L 230.93 160.84 L 232.50 156.35 L 234.14 151.72 L 235.83 146.98 L 237.54 142.18 L 239.23 137.37 L 240.89 132.59 L 242.46 127.88 L 243.93 123.29 L 245.25 118.85 L 246.39 114.60 L 247.32 110.59 L 248.01 106.84 L 248.45 103.37 L 248.62 100.19 L 248.55 97.26 L 248.55 97.26 L 248.28 100.15 L 247.27 103.08 L 245.61 105.97 L 243.41 108.82 L 240.74 111.63 L 237.68 114.43 L 234.28 117.24 L 230.61 120.10 L 226.72 123.03 L 222.68 126.08 L 218.55 129.27 L 214.38 132.65 L 210.24 136.26 L 206.21 140.13 L 202.33 144.29 L 198.71 148.79 L 195.41 153.65 L 192.53 158.90 L 190.18 164.53 L 188.47 170.54 L 187.55 176.87 L 187.53 183.43 L 188.55 190.04 L 190.67 196.50 L 193.91 202.54 L 198.18 207.94 Z" fill="url(#fxflr-chama-ext-${u})" style="animation-duration:4.80s;animation-delay:2.20s"/>
<path class="fx2-chama" d="M 236.44 193.57 L 237.62 191.13 L 238.76 188.91 L 239.82 186.80 L 240.77 184.73 L 241.63 182.61 L 242.38 180.40 L 243.05 178.05 L 243.65 175.56 L 244.21 172.90 L 244.74 170.08 L 245.24 167.12 L 245.74 164.02 L 246.25 160.81 L 246.78 157.52 L 247.32 154.17 L 247.89 150.79 L 248.50 147.43 L 249.13 144.10 L 249.80 140.83 L 250.50 137.67 L 251.23 134.64 L 251.99 131.76 L 252.78 129.06 L 253.59 126.56 L 254.44 124.27 L 255.34 122.22 L 255.34 122.22 L 254.17 124.13 L 252.64 126.01 L 250.79 127.86 L 248.67 129.71 L 246.32 131.55 L 243.78 133.41 L 241.06 135.30 L 238.22 137.25 L 235.29 139.28 L 232.31 141.41 L 229.32 143.66 L 226.35 146.07 L 223.46 148.65 L 220.69 151.42 L 218.08 154.41 L 215.68 157.62 L 213.55 161.07 L 211.75 164.75 L 210.32 168.65 L 209.32 172.75 L 208.82 177.02 L 208.87 181.40 L 209.51 185.82 L 210.77 190.17 L 212.68 194.36 L 215.21 198.25 Z" fill="url(#fxflr-chama-ext-${u})" style="animation-duration:5.50s;animation-delay:0.80s"/>
<path class="fx2-chama" d="M 244.68 172.44 L 246.08 171.11 L 247.38 169.73 L 248.55 168.30 L 249.61 166.81 L 250.55 165.28 L 251.37 163.70 L 252.08 162.09 L 252.68 160.45 L 253.19 158.79 L 253.60 157.11 L 253.93 155.41 L 254.20 153.71 L 254.40 152.02 L 254.57 150.33 L 254.70 148.65 L 254.81 147.00 L 254.92 145.38 L 255.04 143.79 L 255.19 142.26 L 255.37 140.77 L 255.59 139.35 L 255.87 138.01 L 256.22 136.74 L 256.64 135.57 L 257.15 134.51 L 257.75 133.57 L 257.75 133.57 L 257.02 134.41 L 256.16 135.25 L 255.18 136.09 L 254.10 136.95 L 252.92 137.84 L 251.66 138.76 L 250.34 139.72 L 248.96 140.72 L 247.55 141.76 L 246.12 142.84 L 244.70 143.98 L 243.29 145.17 L 241.92 146.41 L 240.61 147.71 L 239.38 149.07 L 238.23 150.48 L 237.18 151.95 L 236.26 153.49 L 235.46 155.08 L 234.81 156.74 L 234.30 158.45 L 233.95 160.23 L 233.75 162.06 L 233.71 163.95 L 233.83 165.89 L 234.10 167.89 Z" fill="url(#fxflr-chama-ext-${u})" style="animation-duration:4.30s;animation-delay:3.10s"/>
<path class="fx2-chama" d="M 257.06 161.14 L 257.64 160.80 L 258.19 160.48 L 258.71 160.11 L 259.23 159.68 L 259.73 159.18 L 260.24 158.59 L 260.76 157.93 L 261.27 157.19 L 261.79 156.39 L 262.31 155.52 L 262.82 154.61 L 263.33 153.66 L 263.81 152.68 L 264.28 151.69 L 264.72 150.69 L 265.12 149.70 L 265.49 148.72 L 265.80 147.78 L 266.06 146.88 L 266.26 146.03 L 266.39 145.26 L 266.43 144.56 L 266.39 143.95 L 266.26 143.46 L 266.05 143.10 L 265.79 142.82 L 265.79 142.82 L 265.97 143.14 L 265.95 143.48 L 265.76 143.80 L 265.44 144.11 L 265.00 144.42 L 264.46 144.73 L 263.82 145.06 L 263.10 145.40 L 262.31 145.77 L 261.45 146.17 L 260.55 146.61 L 259.62 147.09 L 258.66 147.62 L 257.69 148.21 L 256.73 148.85 L 255.78 149.56 L 254.87 150.34 L 254.01 151.19 L 253.21 152.12 L 252.48 153.13 L 251.86 154.21 L 251.36 155.37 L 250.99 156.60 L 250.80 157.88 L 250.80 159.19 L 251.02 160.48 Z" fill="url(#fxflr-chama-ext-${u})" style="animation-duration:5.00s;animation-delay:1.70s"/>
</g>
<!-- chamas-frente -->
<g class="fx2-chamas" filter="url(#fxflr-glow-${u})">
<path class="fx2-chama" d="M 60.76 171.87 L 61.22 170.79 L 61.52 169.67 L 61.67 168.54 L 61.68 167.41 L 61.56 166.30 L 61.32 165.23 L 60.99 164.21 L 60.58 163.23 L 60.09 162.30 L 59.55 161.43 L 58.96 160.60 L 58.34 159.81 L 57.70 159.07 L 57.05 158.36 L 56.39 157.68 L 55.75 157.02 L 55.14 156.38 L 54.55 155.76 L 54.01 155.14 L 53.52 154.52 L 53.09 153.89 L 52.75 153.26 L 52.49 152.62 L 52.35 151.98 L 52.32 151.33 L 52.43 150.70 L 52.43 150.70 L 52.24 151.32 L 52.06 151.96 L 51.89 152.66 L 51.74 153.42 L 51.61 154.24 L 51.52 155.12 L 51.45 156.05 L 51.41 157.01 L 51.40 158.00 L 51.41 159.01 L 51.45 160.03 L 51.51 161.05 L 51.60 162.05 L 51.71 163.02 L 51.84 163.96 L 51.99 164.86 L 52.16 165.71 L 52.36 166.50 L 52.58 167.24 L 52.82 167.91 L 53.10 168.53 L 53.42 169.09 L 53.77 169.62 L 54.17 170.13 L 54.61 170.65 L 55.08 171.22 Z" fill="url(#fxflr-chama-int-${u})" style="animation-duration:3.40s;animation-delay:0.00s"/>
<path class="fx2-chama" d="M 88.03 199.93 L 90.05 197.59 L 91.77 195.06 L 93.14 192.37 L 94.18 189.56 L 94.86 186.69 L 95.21 183.79 L 95.23 180.90 L 94.95 178.06 L 94.39 175.28 L 93.58 172.60 L 92.54 170.02 L 91.32 167.55 L 89.93 165.19 L 88.42 162.95 L 86.80 160.81 L 85.10 158.77 L 83.36 156.82 L 81.59 154.95 L 79.82 153.15 L 78.07 151.40 L 76.36 149.70 L 74.70 148.03 L 73.12 146.38 L 71.62 144.74 L 70.24 143.10 L 68.98 141.44 L 68.98 141.44 L 70.09 143.20 L 71.07 145.10 L 71.95 147.13 L 72.71 149.25 L 73.36 151.45 L 73.91 153.72 L 74.35 156.04 L 74.69 158.38 L 74.93 160.74 L 75.10 163.08 L 75.18 165.39 L 75.21 167.67 L 75.19 169.88 L 75.13 172.02 L 75.05 174.09 L 74.96 176.08 L 74.89 177.98 L 74.85 179.82 L 74.85 181.59 L 74.89 183.32 L 75.00 185.04 L 75.17 186.78 L 75.38 188.57 L 75.63 190.46 L 75.89 192.48 L 76.12 194.66 Z" fill="url(#fxflr-chama-int-${u})" style="animation-duration:4.50s;animation-delay:1.70s"/>
<path class="fx2-chama" d="M 110.78 215.45 L 111.06 213.37 L 111.32 211.39 L 111.54 209.45 L 111.71 207.54 L 111.81 205.62 L 111.84 203.68 L 111.78 201.70 L 111.64 199.67 L 111.41 197.59 L 111.10 195.46 L 110.70 193.29 L 110.22 191.09 L 109.65 188.86 L 109.00 186.63 L 108.27 184.40 L 107.46 182.20 L 106.58 180.04 L 105.62 177.94 L 104.59 175.90 L 103.50 173.94 L 102.35 172.06 L 101.14 170.27 L 99.89 168.54 L 98.59 166.87 L 97.22 165.23 L 95.79 163.59 L 95.79 163.59 L 97.09 165.33 L 98.09 167.18 L 98.79 169.10 L 99.23 171.07 L 99.42 173.05 L 99.40 175.03 L 99.19 177.01 L 98.83 178.97 L 98.35 180.93 L 97.79 182.89 L 97.17 184.87 L 96.53 186.87 L 95.88 188.91 L 95.27 190.99 L 94.72 193.12 L 94.25 195.32 L 93.90 197.59 L 93.68 199.92 L 93.64 202.31 L 93.79 204.75 L 94.15 207.23 L 94.76 209.73 L 95.62 212.21 L 96.75 214.65 L 98.15 217.01 L 99.84 219.25 Z" fill="url(#fxflr-chama-int-${u})" style="animation-duration:3.50s;animation-delay:0.50s"/>
<path class="fx2-chama" d="M 125.31 225.65 L 126.17 223.69 L 126.92 221.69 L 127.55 219.67 L 128.07 217.61 L 128.46 215.52 L 128.72 213.40 L 128.85 211.24 L 128.86 209.07 L 128.74 206.87 L 128.49 204.67 L 128.13 202.46 L 127.65 200.26 L 127.07 198.08 L 126.39 195.92 L 125.62 193.80 L 124.77 191.72 L 123.84 189.69 L 122.86 187.72 L 121.82 185.82 L 120.74 183.97 L 119.64 182.19 L 118.51 180.46 L 117.36 178.78 L 116.19 177.14 L 115.01 175.52 L 113.82 173.91 L 113.82 173.91 L 114.88 175.61 L 115.71 177.41 L 116.31 179.29 L 116.70 181.22 L 116.89 183.17 L 116.92 185.14 L 116.78 187.10 L 116.52 189.06 L 116.15 191.01 L 115.70 192.95 L 115.19 194.87 L 114.65 196.79 L 114.10 198.71 L 113.55 200.63 L 113.05 202.56 L 112.60 204.50 L 112.22 206.47 L 111.93 208.46 L 111.74 210.47 L 111.68 212.52 L 111.75 214.59 L 111.96 216.69 L 112.33 218.82 L 112.85 220.96 L 113.54 223.11 L 114.39 225.25 Z" fill="url(#fxflr-chama-int-${u})" style="animation-duration:4.60s;animation-delay:2.20s"/>
<path class="fx2-chama" d="M 154.38 231.57 L 156.60 227.29 L 158.40 222.86 L 159.81 218.31 L 160.82 213.70 L 161.45 209.05 L 161.72 204.40 L 161.66 199.78 L 161.30 195.20 L 160.66 190.69 L 159.77 186.25 L 158.68 181.90 L 157.42 177.63 L 156.02 173.45 L 154.51 169.35 L 152.94 165.33 L 151.33 161.39 L 149.72 157.51 L 148.14 153.69 L 146.64 149.93 L 145.23 146.22 L 143.95 142.54 L 142.84 138.92 L 141.93 135.33 L 141.24 131.79 L 140.81 128.31 L 140.68 124.90 L 140.68 124.90 L 140.57 128.31 L 140.40 131.85 L 140.17 135.50 L 139.89 139.27 L 139.58 143.16 L 139.23 147.16 L 138.87 151.25 L 138.48 155.41 L 138.08 159.63 L 137.69 163.88 L 137.30 168.15 L 136.93 172.41 L 136.58 176.64 L 136.28 180.84 L 136.03 184.97 L 135.84 189.04 L 135.71 193.03 L 135.67 196.94 L 135.72 200.78 L 135.86 204.55 L 136.10 208.27 L 136.43 211.96 L 136.84 215.66 L 137.33 219.40 L 137.86 223.22 L 138.40 227.17 Z" fill="url(#fxflr-chama-int-${u})" style="animation-duration:3.60s;animation-delay:1.00s"/>
<path class="fx2-chama" d="M 182.51 218.03 L 183.62 216.28 L 184.67 214.55 L 185.64 212.80 L 186.53 210.99 L 187.34 209.11 L 188.06 207.14 L 188.70 205.05 L 189.26 202.87 L 189.73 200.58 L 190.11 198.20 L 190.39 195.74 L 190.59 193.22 L 190.69 190.64 L 190.70 188.04 L 190.60 185.44 L 190.40 182.84 L 190.09 180.29 L 189.68 177.80 L 189.17 175.38 L 188.55 173.07 L 187.84 170.87 L 187.04 168.80 L 186.16 166.83 L 185.21 164.97 L 184.20 163.17 L 183.11 161.39 L 183.11 161.39 L 184.03 163.25 L 184.59 165.19 L 184.82 167.16 L 184.73 169.13 L 184.38 171.07 L 183.79 172.99 L 183.00 174.86 L 182.06 176.71 L 180.98 178.55 L 179.80 180.39 L 178.55 182.24 L 177.25 184.12 L 175.94 186.04 L 174.63 188.03 L 173.37 190.09 L 172.16 192.23 L 171.04 194.46 L 170.04 196.79 L 169.18 199.22 L 168.49 201.75 L 168.00 204.37 L 167.74 207.06 L 167.74 209.82 L 168.02 212.60 L 168.60 215.37 L 169.51 218.08 Z" fill="url(#fxflr-chama-int-${u})" style="animation-duration:4.70s;animation-delay:2.70s"/>
<path class="fx2-chama" d="M 203.88 219.58 L 205.07 217.52 L 206.16 215.45 L 207.13 213.36 L 207.98 211.24 L 208.71 209.07 L 209.32 206.85 L 209.81 204.58 L 210.18 202.24 L 210.45 199.86 L 210.60 197.42 L 210.67 194.94 L 210.64 192.43 L 210.54 189.90 L 210.36 187.35 L 210.13 184.81 L 209.85 182.28 L 209.52 179.78 L 209.17 177.32 L 208.81 174.92 L 208.43 172.57 L 208.06 170.31 L 207.70 168.12 L 207.37 166.01 L 207.06 163.99 L 206.80 162.05 L 206.60 160.18 L 206.60 160.18 L 206.59 162.06 L 206.31 163.98 L 205.79 165.93 L 205.06 167.88 L 204.14 169.84 L 203.06 171.79 L 201.86 173.75 L 200.55 175.72 L 199.16 177.69 L 197.72 179.69 L 196.26 181.71 L 194.81 183.78 L 193.39 185.89 L 192.03 188.06 L 190.76 190.29 L 189.61 192.59 L 188.59 194.96 L 187.73 197.41 L 187.06 199.93 L 186.60 202.52 L 186.36 205.18 L 186.37 207.88 L 186.64 210.62 L 187.17 213.38 L 187.99 216.13 L 189.08 218.83 Z" fill="url(#fxflr-chama-int-${u})" style="animation-duration:3.70s;animation-delay:1.50s"/>
<path class="fx2-chama" d="M 225.21 194.36 L 226.61 191.71 L 227.77 188.98 L 228.70 186.20 L 229.42 183.41 L 229.93 180.61 L 230.24 177.83 L 230.38 175.08 L 230.36 172.36 L 230.20 169.68 L 229.94 167.04 L 229.58 164.44 L 229.15 161.88 L 228.68 159.36 L 228.20 156.86 L 227.73 154.39 L 227.30 151.93 L 226.94 149.48 L 226.67 147.04 L 226.53 144.61 L 226.54 142.18 L 226.74 139.76 L 227.15 137.37 L 227.79 135.01 L 228.70 132.72 L 229.87 130.51 L 231.34 128.42 L 231.34 128.42 L 229.71 130.40 L 228.09 132.35 L 226.48 134.34 L 224.87 136.38 L 223.27 138.49 L 221.69 140.69 L 220.14 142.99 L 218.63 145.38 L 217.18 147.86 L 215.81 150.41 L 214.52 153.03 L 213.33 155.69 L 212.25 158.39 L 211.30 161.10 L 210.48 163.81 L 209.80 166.50 L 209.27 169.16 L 208.90 171.79 L 208.69 174.37 L 208.64 176.91 L 208.76 179.41 L 209.03 181.87 L 209.47 184.31 L 210.06 186.76 L 210.77 189.22 L 211.61 191.73 Z" fill="url(#fxflr-chama-int-${u})" style="animation-duration:4.80s;animation-delay:0.30s"/>
<path class="fx2-chama" d="M 247.35 177.85 L 248.25 177.22 L 249.11 176.54 L 249.92 175.81 L 250.67 175.03 L 251.36 174.18 L 252.00 173.28 L 252.57 172.31 L 253.08 171.30 L 253.53 170.23 L 253.92 169.12 L 254.23 167.97 L 254.48 166.80 L 254.67 165.61 L 254.78 164.41 L 254.83 163.22 L 254.80 162.04 L 254.71 160.90 L 254.55 159.79 L 254.32 158.74 L 254.03 157.75 L 253.68 156.84 L 253.29 156.00 L 252.86 155.24 L 252.41 154.54 L 251.93 153.89 L 251.42 153.24 L 251.42 153.24 L 251.85 153.93 L 252.11 154.67 L 252.21 155.43 L 252.16 156.18 L 251.98 156.92 L 251.69 157.63 L 251.31 158.33 L 250.85 159.01 L 250.32 159.67 L 249.74 160.34 L 249.12 161.01 L 248.47 161.69 L 247.80 162.39 L 247.11 163.12 L 246.43 163.88 L 245.76 164.68 L 245.10 165.52 L 244.48 166.41 L 243.89 167.35 L 243.34 168.33 L 242.85 169.37 L 242.43 170.45 L 242.08 171.58 L 241.81 172.75 L 241.63 173.95 L 241.55 175.17 Z" fill="url(#fxflr-chama-int-${u})" style="animation-duration:3.80s;animation-delay:2.00s"/>
</g>
<!-- brasa -->
<g opacity="0.85" filter="url(#fxflr-blur34-${u})">
<ellipse cx="150.0" cy="224.0" rx="104.0" ry="26.0" fill="url(#fxflr-brasa-${u})"/>
</g>
<!-- frente-fria -->
<g class="fx2-frente" clip-path="url(#fxflr-corte-${u})">
<ellipse cx="150.0" cy="150.0" rx="160.0" ry="34.0" fill="url(#fxflr-frente-${u})" opacity=".55"/>
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

