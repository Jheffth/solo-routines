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
   GERADO por motors/forja com drawsvg + Jinja2. Não edite à mão.
   Fonte: motors/forja/pecas/pena_punidor.py
   ══════════════════════════════════════════════════════════════ */
Auras.registrar('pena-punidor', function (tam) {
  const u = 'apenapunidor' + (++Auras._seq);
  return `<svg class="aura-svg" aria-hidden="true" focusable="false" style="display:block;overflow:hidden;width:${tam}px;height:${tam}px" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${tam}" height="${tam}" viewBox="0 0 300 300">
<style>/*<![CDATA[*/
    /* NENHUM aura-girar. (Sem crase aqui). */
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
    /*]]>*/</style>
<defs>
<radialGradient cx="150.0" cy="150.0" r="150.0" gradientUnits="userSpaceOnUse" id="${u}_veu">
<stop offset="0.0" stop-color="#ff0a3c" stop-opacity="0.3" />
<stop offset="0.55" stop-color="#7a0f2e" stop-opacity="0.16" />
<stop offset="1.0" stop-color="#2b6bff" stop-opacity="0" />
</radialGradient>
<linearGradient x1="0" y1="300" x2="0" y2="0" gradientUnits="userSpaceOnUse" id="${u}_cunha">
<stop offset="0.0" stop-color="#ff0a3c" stop-opacity="0" />
<stop offset="0.55" stop-color="#ff0a3c" stop-opacity="0.9" />
<stop offset="1.0" stop-color="#fff" stop-opacity="0.95" />
</linearGradient>
<linearGradient x1="0" y1="0" x2="300" y2="0" gradientUnits="userSpaceOnUse" id="${u}_tinta">
<stop offset="0.0" stop-color="#ff0a3c" stop-opacity="1" />
<stop offset="0.5" stop-color="#a2185a" stop-opacity="1" />
<stop offset="1.0" stop-color="#2b6bff" stop-opacity="1" />
</linearGradient>
<filter x="-40%" y="-40%" width="180%" height="180%" id="${u}_glow">
<feGaussianBlur stdDeviation="2.4" result="b"/><feComponentTransfer in="b" result="bb"><feFuncA type="linear" slope="1.1"/></feComponentTransfer><feMerge><feMergeNode in="bb"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<clipPath id="${u}_corte">
<circle cx="150.0" cy="150.0" r="148.0" />
</clipPath>
</defs>
<g class="fa-veu">
<circle cx="150.0" cy="150.0" r="148.0" fill="url(#${u}_veu)"/>
</g>
<g class="fa-chuva">
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
<g>
<circle class="fa-selo" cx="150.0" cy="150.0" r="140.0" fill="none" stroke="#ff0a3c" stroke-width="1.60" stroke-dasharray="2.0 10.0" stroke-linecap="round" opacity="0.6" style="animation-delay:0.0s"/>
<circle class="fa-selo" cx="150.0" cy="150.0" r="124.0" fill="none" stroke="#2b6bff" stroke-width="1.10" stroke-dasharray="1.0 14.0" stroke-linecap="round" opacity="0.45" style="animation-delay:0.35s"/>
<circle class="fa-selo" cx="150.0" cy="150.0" r="108.0" fill="none" stroke="#ff0a3c" stroke-width="2.20" stroke-dasharray="26.0 220.0" stroke-linecap="round" opacity="0.75" style="animation-delay:0.7s"/>
</g>
<g>
<path class="fa-cunha" d="M 150.00 20.00 L 146.78 23.33 L 145.20 26.70 L 143.97 30.12 L 142.95 33.55 L 142.07 37.00 L 141.29 40.45 L 140.61 43.88 L 139.99 47.30 L 139.44 50.67 L 138.95 54.00 L 161.05 54.00 L 160.56 50.67 L 160.01 47.30 L 159.39 43.88 L 158.71 40.45 L 157.93 37.00 L 157.05 33.55 L 156.03 30.12 L 154.80 26.70 L 153.22 23.33 L 150.00 20.00 Z" fill="url(#${u}_cunha)" opacity=".85" transform="rotate(0 150.0 150.0)" style="animation-delay:0.00s"/>
<path class="fa-cunha" d="M 150.00 20.00 L 146.78 23.33 L 145.20 26.70 L 143.97 30.12 L 142.95 33.55 L 142.07 37.00 L 141.29 40.45 L 140.61 43.88 L 139.99 47.30 L 139.44 50.67 L 138.95 54.00 L 161.05 54.00 L 160.56 50.67 L 160.01 47.30 L 159.39 43.88 L 158.71 40.45 L 157.93 37.00 L 157.05 33.55 L 156.03 30.12 L 154.80 26.70 L 153.22 23.33 L 150.00 20.00 Z" fill="url(#${u}_cunha)" opacity=".85" transform="rotate(90 150.0 150.0)" style="animation-delay:0.18s"/>
<path class="fa-cunha" d="M 150.00 20.00 L 146.78 23.33 L 145.20 26.70 L 143.97 30.12 L 142.95 33.55 L 142.07 37.00 L 141.29 40.45 L 140.61 43.88 L 139.99 47.30 L 139.44 50.67 L 138.95 54.00 L 161.05 54.00 L 160.56 50.67 L 160.01 47.30 L 159.39 43.88 L 158.71 40.45 L 157.93 37.00 L 157.05 33.55 L 156.03 30.12 L 154.80 26.70 L 153.22 23.33 L 150.00 20.00 Z" fill="url(#${u}_cunha)" opacity=".85" transform="rotate(180 150.0 150.0)" style="animation-delay:0.36s"/>
<path class="fa-cunha" d="M 150.00 20.00 L 146.78 23.33 L 145.20 26.70 L 143.97 30.12 L 142.95 33.55 L 142.07 37.00 L 141.29 40.45 L 140.61 43.88 L 139.99 47.30 L 139.44 50.67 L 138.95 54.00 L 161.05 54.00 L 160.56 50.67 L 160.01 47.30 L 159.39 43.88 L 158.71 40.45 L 157.93 37.00 L 157.05 33.55 L 156.03 30.12 L 154.80 26.70 L 153.22 23.33 L 150.00 20.00 Z" fill="url(#${u}_cunha)" opacity=".85" transform="rotate(270 150.0 150.0)" style="animation-delay:0.54s"/>
</g>
<g class="fa-assina">
<path d="M 64.00 246.00 L 66.68 249.12 L 69.89 251.46 L 73.29 253.54 L 76.84 255.41 L 80.51 257.11 L 84.28 258.63 L 88.15 259.99 L 92.11 261.19 L 96.14 262.24 L 100.24 263.14 L 104.40 263.90 L 108.62 264.52 L 112.89 265.01 L 117.20 265.36 L 121.56 265.57 L 125.95 265.67 L 130.37 265.63 L 134.81 265.48 L 139.28 265.20 L 143.77 264.81 L 148.28 264.31 L 152.79 263.69 L 157.31 262.97 L 161.84 262.14 L 166.37 261.20 L 170.89 260.17 L 175.41 259.03 L 179.92 257.80 L 184.41 256.47 L 188.89 255.04 L 193.35 253.53 L 197.78 251.92 L 202.19 250.23 L 206.57 248.45 L 210.92 246.59 L 215.23 244.64 L 219.49 242.61 L 223.72 240.50 L 227.89 238.30 L 232.00 236.00 L 232.00 236.00 L 227.71 237.92 L 223.39 239.77 L 219.04 241.56 L 214.66 243.26 L 210.26 244.89 L 205.83 246.44 L 201.38 247.90 L 196.92 249.29 L 192.44 250.59 L 187.96 251.80 L 183.47 252.93 L 178.97 253.97 L 174.48 254.92 L 169.99 255.78 L 165.51 256.56 L 161.04 257.24 L 156.58 257.84 L 152.15 258.34 L 147.73 258.75 L 143.33 259.07 L 138.97 259.29 L 134.63 259.42 L 130.33 259.45 L 126.06 259.39 L 121.83 259.24 L 117.64 258.98 L 113.50 258.64 L 109.41 258.19 L 105.36 257.65 L 101.37 257.01 L 97.42 256.28 L 93.53 255.45 L 89.70 254.53 L 85.92 253.51 L 82.20 252.39 L 78.52 251.19 L 74.90 249.90 L 71.32 248.54 L 67.75 247.13 L 64.00 246.00 Z" fill="url(#${u}_tinta)" opacity=".9"/>
</g>
</svg>`;
});

/* FORJA:FIM pena-punidor */

/* FORJA:INICIO fenix-v3 */
/* ══════════════════════════════════════════════════════════════
   Fênix V3 (Supernova) — aura
   GERADO por motors/forja com drawsvg + Jinja2. Não edite à mão.
   Fonte: motors/forja/pecas/fenix_v3.py
   ══════════════════════════════════════════════════════════════ */
Auras.registrar('fenix-v3', function (tam) {
  const u = 'afenixv3' + (++Auras._seq);
  return `<svg class="aura-svg" aria-hidden="true" focusable="false" style="display:block;overflow:hidden;width:${tam}px;height:${tam}px" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${tam}" height="${tam}" viewBox="0 0 300 300">
<style>/*<![CDATA[*/
    .fa3-veu { transform-origin: 150.0px 150.0px; animation: fa3-respirar 4.5s ease-in-out infinite; }
    @keyframes fa3-respirar {
        0%, 100% { opacity: .65; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.05); }
    }
    
    .fa3-onda {
        transform-origin: 150.0px 150.0px;
        animation: fa3-expandir 2.8s cubic-bezier(.1,.7,.3,1) infinite;
    }
    @keyframes fa3-expandir {
        0% { transform: scale(0.1); opacity: 1; stroke-width: 6.0px; }
        100% { transform: scale(1.1); opacity: 0; stroke-width: 1.0px; }
    }
    
    .fa3-girar-lento {
        transform-origin: 150.0px 150.0px;
        animation: fa3-spin 45s linear infinite;
    }
    @keyframes fa3-spin { 100% { transform: rotate(360deg); } }
    
    .fa3-pulsar-chama { animation: fa3-flicker 1.8s ease-in-out infinite alternate; }
    @keyframes fa3-flicker {
        0% { opacity: 0.2; transform: scaleY(0.85); }
        100% { opacity: 0.6; transform: scaleY(1.15); }
    }
    
    .fa3-brasas circle {
        animation-name: fa3-subir;
        animation-timing-function: cubic-bezier(.3,0,.7,1);
        animation-iteration-count: infinite;
    }
    @keyframes fa3-subir {
        0%   { transform: translateY(20px) scale(0.5); opacity: 0; }
        30%  { opacity: 1; }
        100% { transform: translateY(-100px) scale(1.2); opacity: 0; }
    }
    
    @media (prefers-reduced-motion: reduce) {
        .fa3-veu, .fa3-onda, .fa3-girar-lento, .fa3-pulsar-chama, .fa3-brasas circle { animation: none; }
    }
    /*]]>*/</style>
<defs>
<radialGradient cx="150.0" cy="150.0" r="150.0" gradientUnits="userSpaceOnUse" id="${u}_fogo">
<stop offset="0.0" stop-color="#ffb703" stop-opacity="0.4" />
<stop offset="0.45" stop-color="#fb8500" stop-opacity="0.15" />
<stop offset="1.0" stop-color="#6a040f" stop-opacity="0" />
</radialGradient>
<filter x="-40%" y="-40%" width="180%" height="180%" id="${u}_glow">
<feGaussianBlur stdDeviation="5.0" result="b"/><feComponentTransfer in="b" result="bb"><feFuncA type="linear" slope="1.4"/></feComponentTransfer><feMerge><feMergeNode in="bb"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<clipPath id="${u}_corte">
<circle cx="150.0" cy="150.0" r="142.0" />
</clipPath>
</defs>
<g class="fa3-veu">
<circle cx="150.0" cy="150.0" r="145.0" fill="url(#${u}_fogo)"/>
</g>
<g>
<circle class="fa3-onda" cx="150.0" cy="150.0" r="135.0" fill="none" stroke="#ffb703" stroke-width="3.0" stroke-dasharray="6.0 12.0" opacity="0.8" style="animation-delay:0s"/>
<circle class="fa3-onda" cx="150.0" cy="150.0" r="135.0" fill="none" stroke="#ea580c" stroke-width="1.5" stroke-dasharray="15.0 30.0" opacity="0.6" style="animation-delay:0.7s"/>
</g>
<g class="fa3-girar-lento">
<path class="fa3-pulsar-chama" d="M 199.00 149.43 L 199.22 144.71 L 199.82 140.07 L 200.78 135.46 L 202.05 130.85 L 203.63 126.23 L 205.50 121.58 L 207.64 116.92 L 210.06 112.24 L 212.72 107.56 L 215.62 102.89 L 218.75 98.25 L 222.08 93.67 L 225.59 89.17 L 229.28 84.78 L 233.12 80.52 L 237.09 76.42 L 241.16 72.50 L 245.32 68.80 L 249.54 65.35 L 253.80 62.17 L 258.07 59.29 L 262.32 56.74 L 266.53 54.54 L 270.66 52.74 L 274.69 51.35 L 278.56 50.41 L 278.56 50.41 L 274.65 51.23 L 270.51 52.30 L 266.16 53.65 L 261.62 55.27 L 256.93 57.16 L 252.10 59.31 L 247.18 61.74 L 242.20 64.42 L 237.20 67.37 L 232.21 70.59 L 227.28 74.06 L 222.45 77.79 L 217.75 81.77 L 213.23 86.00 L 208.93 90.47 L 204.90 95.18 L 201.18 100.12 L 197.83 105.27 L 194.89 110.62 L 192.41 116.15 L 190.45 121.83 L 189.05 127.61 L 188.27 133.46 L 188.15 139.31 L 188.72 145.09 L 190.01 150.71 Z" fill="#fb8500" opacity="0.4" transform="rotate(90.0 195.0 150.0)" style="animation-delay:0.00s"/>
<path class="fa3-pulsar-chama" d="M 195.50 166.99 L 196.08 162.29 L 197.01 157.62 L 198.26 152.97 L 199.81 148.32 L 201.65 143.64 L 203.75 138.94 L 206.11 134.22 L 208.70 129.50 L 211.52 124.77 L 214.54 120.07 L 217.76 115.41 L 221.15 110.81 L 224.70 106.30 L 228.38 101.90 L 232.18 97.64 L 236.08 93.54 L 240.05 89.64 L 244.07 85.95 L 248.12 82.51 L 252.18 79.34 L 256.22 76.47 L 260.21 73.93 L 264.13 71.75 L 267.95 69.95 L 271.63 68.57 L 275.14 67.63 L 275.14 67.63 L 271.59 68.45 L 267.79 69.52 L 263.74 70.87 L 259.47 72.48 L 255.02 74.37 L 250.41 76.52 L 245.69 78.94 L 240.87 81.62 L 236.01 84.57 L 231.14 87.77 L 226.29 91.23 L 221.51 94.95 L 216.84 98.91 L 212.32 103.12 L 208.00 107.56 L 203.91 112.24 L 200.11 117.15 L 196.63 122.26 L 193.54 127.57 L 190.87 133.05 L 188.67 138.68 L 187.00 144.42 L 185.89 150.24 L 185.41 156.07 L 185.58 161.86 L 186.44 167.53 Z" fill="#fb8500" opacity="0.4" transform="rotate(112.5 191.6 167.2)" style="animation-delay:0.15s"/>
<path class="fa3-pulsar-chama" d="M 186.09 181.62 L 186.81 177.05 L 187.96 172.53 L 189.48 168.01 L 191.35 163.45 L 193.54 158.85 L 196.05 154.19 L 198.84 149.49 L 201.89 144.75 L 205.18 140.00 L 208.68 135.26 L 212.35 130.55 L 216.16 125.90 L 220.09 121.33 L 224.10 116.87 L 228.15 112.54 L 232.21 108.39 L 236.25 104.43 L 240.23 100.69 L 244.11 97.21 L 247.86 94.01 L 251.43 91.11 L 254.80 88.56 L 257.92 86.36 L 260.75 84.56 L 263.25 83.17 L 265.38 82.23 L 265.38 82.23 L 263.20 83.05 L 260.54 84.15 L 257.44 85.52 L 253.96 87.17 L 250.12 89.08 L 245.98 91.26 L 241.59 93.70 L 236.99 96.40 L 232.23 99.35 L 227.35 102.55 L 222.41 105.99 L 217.46 109.68 L 212.55 113.61 L 207.73 117.77 L 203.04 122.17 L 198.55 126.79 L 194.31 131.63 L 190.37 136.69 L 186.79 141.94 L 183.62 147.38 L 180.95 152.98 L 178.81 158.72 L 177.29 164.56 L 176.45 170.44 L 176.34 176.30 L 177.02 182.05 Z" fill="#fb8500" opacity="0.4" transform="rotate(135.0 181.8 181.8)" style="animation-delay:0.30s"/>
<path class="fa3-pulsar-chama" d="M 171.17 191.27 L 171.71 186.64 L 172.68 182.06 L 174.03 177.49 L 175.74 172.89 L 177.79 168.26 L 180.15 163.58 L 182.81 158.87 L 185.73 154.14 L 188.91 149.39 L 192.30 144.66 L 195.88 139.97 L 199.63 135.34 L 203.51 130.79 L 207.49 126.36 L 211.54 122.07 L 215.62 117.94 L 219.70 114.02 L 223.76 110.31 L 227.75 106.86 L 231.64 103.68 L 235.39 100.81 L 238.97 98.27 L 242.33 96.09 L 245.45 94.30 L 248.28 92.92 L 250.78 91.99 L 250.78 91.99 L 248.24 92.80 L 245.26 93.88 L 241.88 95.24 L 238.16 96.86 L 234.11 98.75 L 229.80 100.91 L 225.27 103.32 L 220.55 105.99 L 215.70 108.92 L 210.76 112.10 L 205.79 115.53 L 200.82 119.21 L 195.92 123.13 L 191.12 127.29 L 186.48 131.70 L 182.05 136.34 L 177.89 141.20 L 174.05 146.29 L 170.59 151.58 L 167.57 157.06 L 165.04 162.72 L 163.08 168.51 L 161.75 174.40 L 161.11 180.32 L 161.22 186.21 L 162.11 191.96 Z" fill="#fb8500" opacity="0.4" transform="rotate(157.5 167.2 191.6)" style="animation-delay:0.45s"/>
<path class="fa3-pulsar-chama" d="M 155.08 194.90 L 156.00 190.29 L 157.18 185.72 L 158.60 181.16 L 160.25 176.60 L 162.11 172.01 L 164.17 167.39 L 166.43 162.75 L 168.87 158.08 L 171.50 153.40 L 174.30 148.73 L 177.26 144.08 L 180.39 139.47 L 183.66 134.94 L 187.07 130.50 L 190.60 126.18 L 194.25 122.02 L 198.01 118.04 L 201.85 114.27 L 205.76 110.74 L 209.73 107.48 L 213.74 104.52 L 217.77 101.90 L 221.80 99.64 L 225.79 97.79 L 229.72 96.36 L 233.56 95.41 L 233.56 95.41 L 229.69 96.24 L 225.64 97.35 L 221.42 98.75 L 217.05 100.44 L 212.56 102.41 L 207.98 104.65 L 203.32 107.17 L 198.63 109.96 L 193.93 113.00 L 189.25 116.31 L 184.62 119.86 L 180.08 123.65 L 175.67 127.69 L 171.41 131.94 L 167.35 136.42 L 163.52 141.10 L 159.95 145.98 L 156.69 151.04 L 153.77 156.27 L 151.23 161.63 L 149.10 167.12 L 147.44 172.69 L 146.26 178.31 L 145.61 183.96 L 145.52 189.56 L 146.00 195.08 Z" fill="#fb8500" opacity="0.4" transform="rotate(180.0 150.0 195.0)" style="animation-delay:0.60s"/>
<path class="fa3-pulsar-chama" d="M 137.25 191.65 L 138.22 186.95 L 139.44 182.28 L 140.89 177.61 L 142.56 172.94 L 144.44 168.26 L 146.50 163.56 L 148.76 158.84 L 151.20 154.12 L 153.81 149.41 L 156.58 144.72 L 159.52 140.07 L 162.61 135.48 L 165.85 130.97 L 169.22 126.57 L 172.73 122.30 L 176.35 118.19 L 180.09 114.26 L 183.92 110.54 L 187.84 107.07 L 191.84 103.86 L 195.89 100.95 L 199.99 98.38 L 204.11 96.16 L 208.22 94.33 L 212.31 92.93 L 216.34 91.99 L 216.34 91.99 L 212.28 92.81 L 208.07 93.90 L 203.74 95.27 L 199.28 96.91 L 194.72 98.84 L 190.08 101.04 L 185.40 103.51 L 180.68 106.25 L 175.97 109.26 L 171.29 112.52 L 166.68 116.04 L 162.16 119.81 L 157.77 123.82 L 153.54 128.07 L 149.51 132.54 L 145.71 137.23 L 142.18 142.12 L 138.95 147.20 L 136.06 152.45 L 133.54 157.84 L 131.43 163.35 L 129.77 168.96 L 128.59 174.62 L 127.91 180.30 L 127.76 185.94 L 128.17 191.50 Z" fill="#fb8500" opacity="0.4" transform="rotate(202.5 132.8 191.6)" style="animation-delay:0.75s"/>
<path class="fa3-pulsar-chama" d="M 122.37 182.17 L 123.64 177.53 L 125.21 172.90 L 127.05 168.25 L 129.16 163.58 L 131.50 158.87 L 134.07 154.12 L 136.84 149.36 L 139.80 144.58 L 142.93 139.80 L 146.21 135.05 L 149.62 130.34 L 153.14 125.70 L 156.76 121.14 L 160.44 116.70 L 164.18 112.41 L 167.94 108.28 L 171.71 104.34 L 175.46 100.63 L 179.17 97.17 L 182.81 93.98 L 186.35 91.10 L 189.78 88.55 L 193.07 86.36 L 196.18 84.56 L 199.08 83.17 L 201.74 82.23 L 201.74 82.23 L 199.04 83.05 L 195.99 84.14 L 192.62 85.51 L 188.96 87.15 L 185.04 89.07 L 180.91 91.25 L 176.59 93.70 L 172.12 96.41 L 167.55 99.38 L 162.90 102.59 L 158.22 106.06 L 153.55 109.76 L 148.94 113.71 L 144.41 117.89 L 140.02 122.29 L 135.81 126.91 L 131.82 131.74 L 128.09 136.77 L 124.68 141.98 L 121.62 147.36 L 118.96 152.87 L 116.76 158.51 L 115.05 164.23 L 113.88 169.99 L 113.29 175.74 L 113.33 181.41 Z" fill="#fb8500" opacity="0.4" transform="rotate(225.0 118.2 181.8)" style="animation-delay:0.90s"/>
<path class="fa3-pulsar-chama" d="M 112.64 166.90 L 113.21 162.26 L 114.15 157.67 L 115.43 153.09 L 117.02 148.50 L 118.91 143.88 L 121.08 139.22 L 123.52 134.53 L 126.20 129.83 L 129.12 125.11 L 132.24 120.41 L 135.56 115.74 L 139.06 111.12 L 142.70 106.59 L 146.46 102.16 L 150.33 97.87 L 154.28 93.74 L 158.28 89.81 L 162.30 86.09 L 166.33 82.62 L 170.32 79.42 L 174.26 76.53 L 178.11 73.97 L 181.84 71.77 L 185.43 69.96 L 188.82 68.57 L 191.99 67.63 L 191.99 67.63 L 188.78 68.45 L 185.26 69.54 L 181.44 70.90 L 177.35 72.53 L 173.04 74.44 L 168.54 76.62 L 163.88 79.06 L 159.11 81.76 L 154.26 84.72 L 149.38 87.94 L 144.50 91.41 L 139.67 95.13 L 134.94 99.09 L 130.34 103.29 L 125.93 107.73 L 121.75 112.40 L 117.84 117.28 L 114.26 122.38 L 111.06 127.67 L 108.29 133.13 L 106.00 138.75 L 104.24 144.48 L 103.07 150.30 L 102.55 156.13 L 102.71 161.92 L 103.59 167.58 Z" fill="#fb8500" opacity="0.4" transform="rotate(247.5 108.4 167.2)" style="animation-delay:1.05s"/>
<path class="fa3-pulsar-chama" d="M 110.22 150.42 L 111.59 145.79 L 113.15 141.18 L 114.89 136.57 L 116.79 131.94 L 118.85 127.29 L 121.06 122.61 L 123.41 117.91 L 125.90 113.20 L 128.52 108.49 L 131.27 103.79 L 134.15 99.13 L 137.16 94.51 L 140.28 89.97 L 143.52 85.54 L 146.87 81.22 L 150.33 77.06 L 153.88 73.08 L 157.53 69.31 L 161.26 65.77 L 165.07 62.51 L 168.93 59.55 L 172.85 56.92 L 176.79 54.66 L 180.74 52.80 L 184.68 51.37 L 188.56 50.41 L 188.56 50.41 L 184.64 51.24 L 180.59 52.36 L 176.41 53.77 L 172.11 55.47 L 167.73 57.45 L 163.27 59.71 L 158.77 62.25 L 154.23 65.06 L 149.71 68.13 L 145.20 71.45 L 140.76 75.02 L 136.40 78.83 L 132.16 82.87 L 128.06 87.14 L 124.13 91.61 L 120.41 96.28 L 116.93 101.14 L 113.71 106.16 L 110.80 111.34 L 108.21 116.64 L 105.98 122.06 L 104.13 127.55 L 102.71 133.10 L 101.72 138.67 L 101.20 144.21 L 101.17 149.69 Z" fill="#fb8500" opacity="0.4" transform="rotate(270.0 105.0 150.0)" style="animation-delay:1.20s"/>
<path class="fa3-pulsar-chama" d="M 113.13 133.46 L 114.76 128.90 L 116.65 124.33 L 118.79 119.73 L 121.15 115.09 L 123.72 110.40 L 126.49 105.68 L 129.43 100.91 L 132.53 96.13 L 135.77 91.34 L 139.12 86.57 L 142.58 81.83 L 146.12 77.15 L 149.73 72.56 L 153.37 68.08 L 157.04 63.73 L 160.70 59.56 L 164.34 55.58 L 167.93 51.82 L 171.45 48.31 L 174.88 45.08 L 178.19 42.16 L 181.35 39.58 L 184.34 37.36 L 187.13 35.54 L 189.69 34.14 L 191.99 33.19 L 191.99 33.19 L 189.64 34.02 L 186.92 35.13 L 183.86 36.53 L 180.48 38.21 L 176.82 40.17 L 172.92 42.40 L 168.81 44.89 L 164.53 47.65 L 160.12 50.66 L 155.61 53.91 L 151.05 57.41 L 146.47 61.15 L 141.92 65.11 L 137.43 69.30 L 133.05 73.70 L 128.82 78.31 L 124.78 83.11 L 120.98 88.09 L 117.45 93.25 L 114.24 98.56 L 111.39 104.00 L 108.95 109.55 L 106.97 115.18 L 105.47 120.86 L 104.52 126.53 L 104.15 132.16 Z" fill="#fb8500" opacity="0.4" transform="rotate(292.5 108.4 132.8)" style="animation-delay:1.35s"/>
<path class="fa3-pulsar-chama" d="M 122.67 118.13 L 123.57 113.57 L 124.85 109.03 L 126.45 104.50 L 128.36 99.93 L 130.57 95.32 L 133.05 90.66 L 135.77 85.96 L 138.74 81.23 L 141.91 76.48 L 145.27 71.75 L 148.79 67.04 L 152.45 62.39 L 156.22 57.81 L 160.07 53.35 L 163.98 49.02 L 167.91 44.86 L 171.84 40.89 L 175.73 37.15 L 179.55 33.65 L 183.28 30.44 L 186.88 27.53 L 190.32 24.96 L 193.56 22.75 L 196.57 20.93 L 199.31 19.53 L 201.74 18.59 L 201.74 18.59 L 199.26 19.41 L 196.37 20.51 L 193.10 21.89 L 189.49 23.55 L 185.58 25.49 L 181.41 27.69 L 177.03 30.15 L 172.46 32.87 L 167.77 35.85 L 162.99 39.07 L 158.16 42.55 L 153.34 46.26 L 148.56 50.21 L 143.89 54.39 L 139.35 58.80 L 135.01 63.43 L 130.91 68.28 L 127.10 73.32 L 123.63 78.55 L 120.56 83.96 L 117.95 89.51 L 115.84 95.19 L 114.29 100.95 L 113.37 106.76 L 113.12 112.54 L 113.59 118.23 Z" fill="#fb8500" opacity="0.4" transform="rotate(315.0 118.2 118.2)" style="animation-delay:1.50s"/>
<path class="fa3-pulsar-chama" d="M 136.70 108.84 L 138.00 104.11 L 139.55 99.38 L 141.32 94.64 L 143.30 89.88 L 145.48 85.11 L 147.84 80.32 L 150.37 75.52 L 153.06 70.73 L 155.91 65.96 L 158.89 61.22 L 162.01 56.54 L 165.25 51.93 L 168.59 47.41 L 172.04 43.02 L 175.58 38.76 L 179.19 34.68 L 182.87 30.79 L 186.60 27.11 L 190.36 23.68 L 194.15 20.52 L 197.95 17.66 L 201.73 15.13 L 205.49 12.95 L 209.19 11.16 L 212.82 9.77 L 216.34 8.84 L 216.34 8.84 L 212.78 9.65 L 209.03 10.73 L 205.08 12.07 L 200.97 13.69 L 196.70 15.59 L 192.31 17.75 L 187.82 20.19 L 183.27 22.89 L 178.67 25.85 L 174.06 29.07 L 169.48 32.55 L 164.96 36.28 L 160.53 40.24 L 156.23 44.45 L 152.09 48.88 L 148.16 53.53 L 144.46 58.39 L 141.03 63.44 L 137.91 68.66 L 135.13 74.04 L 132.74 79.55 L 130.77 85.16 L 129.24 90.84 L 128.20 96.55 L 127.66 102.25 L 127.67 107.88 Z" fill="#fb8500" opacity="0.4" transform="rotate(337.5 132.8 108.4)" style="animation-delay:1.65s"/>
<path class="fa3-pulsar-chama" d="M 154.86 105.69 L 156.49 101.18 L 158.42 96.65 L 160.61 92.10 L 163.04 87.49 L 165.70 82.84 L 168.57 78.13 L 171.62 73.37 L 174.84 68.59 L 178.20 63.80 L 181.69 59.01 L 185.27 54.26 L 188.93 49.57 L 192.64 44.95 L 196.38 40.45 L 200.12 36.08 L 203.83 31.88 L 207.50 27.88 L 211.09 24.10 L 214.57 20.58 L 217.92 17.34 L 221.11 14.40 L 224.11 11.81 L 226.89 9.59 L 229.41 7.76 L 231.65 6.36 L 233.56 5.41 L 233.56 5.41 L 231.59 6.24 L 229.18 7.36 L 226.37 8.77 L 223.20 10.46 L 219.71 12.43 L 215.93 14.67 L 211.91 17.18 L 207.68 19.94 L 203.29 22.96 L 198.78 26.22 L 194.18 29.72 L 189.55 33.45 L 184.93 37.41 L 180.35 41.59 L 175.87 45.98 L 171.53 50.58 L 167.37 55.37 L 163.44 60.35 L 159.78 65.50 L 156.44 70.80 L 153.48 76.23 L 150.93 81.78 L 148.84 87.41 L 147.27 93.09 L 146.27 98.78 L 145.87 104.41 Z" fill="#fb8500" opacity="0.4" transform="rotate(360.0 150.0 105.0)" style="animation-delay:1.80s"/>
<path class="fa3-pulsar-chama" d="M 172.38 108.54 L 173.51 103.98 L 174.90 99.44 L 176.54 94.91 L 178.41 90.36 L 180.49 85.77 L 182.78 81.14 L 185.25 76.47 L 187.91 71.78 L 190.74 67.07 L 193.73 62.36 L 196.87 57.68 L 200.14 53.04 L 203.53 48.48 L 207.03 44.01 L 210.62 39.68 L 214.28 35.49 L 218.00 31.49 L 221.77 27.71 L 225.55 24.17 L 229.34 20.90 L 233.11 17.95 L 236.84 15.32 L 240.50 13.07 L 244.06 11.21 L 247.50 9.79 L 250.78 8.84 L 250.78 8.84 L 247.47 9.67 L 243.89 10.78 L 240.09 12.19 L 236.07 13.89 L 231.87 15.87 L 227.53 18.12 L 223.06 20.65 L 218.50 23.44 L 213.89 26.49 L 209.27 29.79 L 204.65 33.33 L 200.10 37.12 L 195.63 41.13 L 191.29 45.37 L 187.11 49.83 L 183.13 54.49 L 179.40 59.34 L 175.95 64.37 L 172.82 69.56 L 170.05 74.90 L 167.69 80.36 L 165.77 85.92 L 164.34 91.54 L 163.42 97.18 L 163.07 102.80 L 163.31 108.34 Z" fill="#fb8500" opacity="0.4" transform="rotate(382.5 167.2 108.4)" style="animation-delay:1.95s"/>
<path class="fa3-pulsar-chama" d="M 186.38 117.65 L 186.86 113.10 L 187.76 108.62 L 189.03 104.17 L 190.66 99.69 L 192.62 95.17 L 194.89 90.59 L 197.47 85.95 L 200.31 81.27 L 203.42 76.57 L 206.75 71.86 L 210.29 67.17 L 213.99 62.53 L 217.84 57.96 L 221.80 53.49 L 225.84 49.15 L 229.92 44.98 L 234.02 40.99 L 238.09 37.23 L 242.10 33.72 L 246.01 30.49 L 249.80 27.56 L 253.41 24.98 L 256.82 22.76 L 259.98 20.94 L 262.85 19.54 L 265.38 18.59 L 265.38 18.59 L 262.80 19.42 L 259.79 20.52 L 256.38 21.90 L 252.61 23.56 L 248.54 25.50 L 244.20 27.70 L 239.64 30.17 L 234.91 32.89 L 230.05 35.87 L 225.11 39.10 L 220.14 42.57 L 215.18 46.29 L 210.29 50.25 L 205.51 54.45 L 200.90 58.87 L 196.52 63.52 L 192.40 68.39 L 188.61 73.46 L 185.21 78.73 L 182.25 84.18 L 179.80 89.80 L 177.92 95.53 L 176.68 101.36 L 176.14 107.21 L 176.36 113.02 L 177.37 118.70 Z" fill="#fb8500" opacity="0.4" transform="rotate(405.0 181.8 118.2)" style="animation-delay:2.10s"/>
<path class="fa3-pulsar-chama" d="M 195.47 133.11 L 196.66 128.35 L 198.07 123.59 L 199.70 118.83 L 201.53 114.06 L 203.54 109.28 L 205.74 104.50 L 208.10 99.71 L 210.63 94.93 L 213.31 90.17 L 216.14 85.45 L 219.12 80.79 L 222.23 76.20 L 225.46 71.70 L 228.83 67.32 L 232.30 63.09 L 235.88 59.01 L 239.56 55.13 L 243.33 51.46 L 247.18 48.04 L 251.10 44.88 L 255.07 42.02 L 259.08 39.49 L 263.11 37.31 L 267.15 35.51 L 271.17 34.13 L 275.14 33.19 L 275.14 33.19 L 271.14 34.00 L 267.00 35.08 L 262.73 36.42 L 258.35 38.03 L 253.87 39.92 L 249.31 42.08 L 244.69 44.51 L 240.04 47.21 L 235.38 50.18 L 230.75 53.41 L 226.17 56.90 L 221.69 60.64 L 217.32 64.63 L 213.10 68.86 L 209.07 73.31 L 205.25 77.99 L 201.69 82.87 L 198.42 87.94 L 195.47 93.18 L 192.87 98.57 L 190.65 104.09 L 188.86 109.70 L 187.51 115.38 L 186.64 121.08 L 186.27 126.75 L 186.42 132.35 Z" fill="#fb8500" opacity="0.4" transform="rotate(427.5 191.6 132.8)" style="animation-delay:2.25s"/>
</g>
<g class="fa3-brasas">
<circle cx="187.1" cy="206.2" r="3.0" fill="#ffb703" opacity="0.95" style="animation-duration:3.57s; animation-delay:0.41s"/>
<circle cx="172.3" cy="139.0" r="2.0" fill="#ffb703" opacity="0.64" style="animation-duration:3.40s; animation-delay:0.53s"/>
<circle cx="182.4" cy="160.0" r="2.5" fill="#ffb703" opacity="0.83" style="animation-duration:3.43s; animation-delay:2.42s"/>
<circle cx="194.4" cy="256.8" r="2.4" fill="#ffb703" opacity="0.96" style="animation-duration:3.02s; animation-delay:0.33s"/>
<circle cx="139.5" cy="230.2" r="1.6" fill="#ffb703" opacity="0.64" style="animation-duration:2.14s; animation-delay:0.84s"/>
<circle cx="117.8" cy="263.8" r="2.7" fill="#ffb703" opacity="0.78" style="animation-duration:3.89s; animation-delay:1.96s"/>
<circle cx="175.0" cy="170.8" r="2.5" fill="#ffb703" opacity="0.55" style="animation-duration:2.54s; animation-delay:1.94s"/>
<circle cx="223.1" cy="162.5" r="2.0" fill="#ffb703" opacity="0.95" style="animation-duration:3.98s; animation-delay:1.19s"/>
<circle cx="128.0" cy="251.1" r="4.3" fill="#ffb703" opacity="0.94" style="animation-duration:2.45s; animation-delay:1.61s"/>
<circle cx="128.4" cy="159.3" r="3.9" fill="#ffb703" opacity="0.97" style="animation-duration:2.53s; animation-delay:1.26s"/>
<circle cx="178.6" cy="248.2" r="4.0" fill="#ffb703" opacity="0.72" style="animation-duration:2.67s; animation-delay:1.53s"/>
<circle cx="148.6" cy="251.4" r="2.2" fill="#ffb703" opacity="0.54" style="animation-duration:2.92s; animation-delay:0.82s"/>
<circle cx="116.0" cy="182.4" r="3.1" fill="#ffb703" opacity="0.93" style="animation-duration:2.20s; animation-delay:1.99s"/>
<circle cx="205.2" cy="234.1" r="4.3" fill="#ffb703" opacity="0.71" style="animation-duration:2.56s; animation-delay:2.62s"/>
<circle cx="87.4" cy="255.6" r="3.3" fill="#ffb703" opacity="0.69" style="animation-duration:3.43s; animation-delay:0.33s"/>
<circle cx="151.1" cy="221.4" r="2.7" fill="#ffb703" opacity="0.74" style="animation-duration:2.45s; animation-delay:1.71s"/>
<circle cx="222.3" cy="139.3" r="3.4" fill="#ffb703" opacity="0.81" style="animation-duration:2.53s; animation-delay:2.56s"/>
<circle cx="80.6" cy="146.9" r="3.3" fill="#ffb703" opacity="0.95" style="animation-duration:2.80s; animation-delay:0.89s"/>
<circle cx="170.8" cy="176.6" r="3.3" fill="#ffb703" opacity="0.81" style="animation-duration:3.61s; animation-delay:0.03s"/>
<circle cx="86.1" cy="135.6" r="3.7" fill="#ffb703" opacity="0.91" style="animation-duration:3.87s; animation-delay:0.03s"/>
<circle cx="228.2" cy="179.1" r="4.2" fill="#ffb703" opacity="0.73" style="animation-duration:2.47s; animation-delay:0.00s"/>
<circle cx="166.2" cy="245.0" r="1.7" fill="#ffb703" opacity="0.85" style="animation-duration:3.65s; animation-delay:2.01s"/>
<circle cx="210.7" cy="172.4" r="2.2" fill="#ffb703" opacity="0.75" style="animation-duration:2.48s; animation-delay:0.36s"/>
<circle cx="94.0" cy="252.1" r="2.0" fill="#ffb703" opacity="0.99" style="animation-duration:2.81s; animation-delay:1.92s"/>
<circle cx="195.4" cy="217.1" r="3.7" fill="#ffb703" opacity="0.70" style="animation-duration:2.20s; animation-delay:2.04s"/>
</g>
</svg>`;
});

/* FORJA:FIM fenix-v3 */

/* FORJA:INICIO lobo-sombrio */
/* ══════════════════════════════════════════════════════════════
   Lobo Sombrio (Abissal) — aura
   GERADO por motors/forja com drawsvg + Jinja2. Não edite à mão.
   Fonte: motors/forja/pecas/lobo_sombrio.py
   ══════════════════════════════════════════════════════════════ */
Auras.registrar('lobo-sombrio', function (tam) {
  const u = 'alobosombrio' + (++Auras._seq);
  return `<svg class="aura-svg" aria-hidden="true" focusable="false" style="display:block;overflow:hidden;width:${tam}px;height:${tam}px" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${tam}" height="${tam}" viewBox="0 0 300 300">
<style>/*<![CDATA[*/
    .ls-aura-pulso {
        animation: ls-p 4s ease-in-out infinite alternate;
        transform-origin: 150px 150px;
    }
    @keyframes ls-p {
        0% { transform: scale(0.95); opacity: 0.6; }
        100% { transform: scale(1.05); opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
        .ls-aura-pulso { animation: none !important; }
    }
    /*]]>*/</style>
<defs>
<radialGradient cx="150.0" cy="150.0" r="150.0" gradientUnits="userSpaceOnUse" id="${u}_radial">
<stop offset="0" stop-color="transparent" stop-opacity="1.0" />
<stop offset="70" stop-color="#4c1d95" stop-opacity="1.0" />
<stop offset="100" stop-color="#000000" stop-opacity="1.0" />
</radialGradient>
</defs>
<g>
<circle cx="150" cy="150" r="150" fill="url(#${u}_radial)" class="ls-aura-pulso"/>
</g>
<g>
<polygon points="150,10 160,50 150,70 140,50" fill="#5b21b6" transform="rotate(0.0 150 150)"/>
<polygon points="150,10 160,50 150,70 140,50" fill="#5b21b6" transform="rotate(30.0 150 150)"/>
<polygon points="150,10 160,50 150,70 140,50" fill="#5b21b6" transform="rotate(60.0 150 150)"/>
<polygon points="150,10 160,50 150,70 140,50" fill="#5b21b6" transform="rotate(90.0 150 150)"/>
<polygon points="150,10 160,50 150,70 140,50" fill="#5b21b6" transform="rotate(120.0 150 150)"/>
<polygon points="150,10 160,50 150,70 140,50" fill="#5b21b6" transform="rotate(150.0 150 150)"/>
<polygon points="150,10 160,50 150,70 140,50" fill="#5b21b6" transform="rotate(180.0 150 150)"/>
<polygon points="150,10 160,50 150,70 140,50" fill="#5b21b6" transform="rotate(210.0 150 150)"/>
<polygon points="150,10 160,50 150,70 140,50" fill="#5b21b6" transform="rotate(240.0 150 150)"/>
<polygon points="150,10 160,50 150,70 140,50" fill="#5b21b6" transform="rotate(270.0 150 150)"/>
<polygon points="150,10 160,50 150,70 140,50" fill="#5b21b6" transform="rotate(300.0 150 150)"/>
<polygon points="150,10 160,50 150,70 140,50" fill="#5b21b6" transform="rotate(330.0 150 150)"/>
</g>
</svg>`;
});

/* FORJA:FIM lobo-sombrio */

/* FORJA:INICIO isabella */
/* ══════════════════════════════════════════════════════════════
   Bella Rosa (Femme Fatale) — aura
   GERADO por motors/forja com drawsvg + Jinja2. Não edite à mão.
   Fonte: motors/forja/pecas/isabella.py
   ══════════════════════════════════════════════════════════════ */
Auras.registrar('isabella', function (tam) {
  const u = 'aisabella' + (++Auras._seq);
  return `<svg class="aura-svg" aria-hidden="true" focusable="false" style="display:block;overflow:hidden;width:${tam}px;height:${tam}px" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${tam}" height="${tam}" viewBox="0 0 300 300">
<style>/*<![CDATA[*/
    .isa-aura-pulso { 
      transform-origin: 150.0px 150.0px;
      animation: isa-respirar 4.2s ease-in-out infinite; 
    }
    @keyframes isa-respirar {
      0%, 100% { opacity: .6; transform: scale(1); }
      50%      { opacity: 1;  transform: scale(1.08); }
    }
    @media (prefers-reduced-motion: reduce) {
      .isa-aura-pulso { animation: none; }
    }
    /*]]>*/</style>
<defs>
<radialGradient cx="150.0" cy="150.0" r="150.0" gradientUnits="userSpaceOnUse" id="${u}_veu">
<stop offset="0.0" stop-color="#f8bbd0" stop-opacity="0.25" />
<stop offset="0.45" stop-color="#e91e63" stop-opacity="0.15" />
<stop offset="1.0" stop-color="#880e4f" stop-opacity="0" />
</radialGradient>
</defs>
<g class="isa-aura-pulso">
<circle cx="150.0" cy="150.0" r="148.0" fill="url(#${u}_veu)"/>
</g>
</svg>`;
});

/* FORJA:FIM isabella */

/* FORJA:INICIO lobo-lunar */
/* ══════════════════════════════════════════════════════════════
   Lobo Lunar (Alcateia de Gelo) — aura
   GERADO por motors/forja com drawsvg + Jinja2. Não edite à mão.
   Fonte: motors/forja/pecas/lobo_lunar.py
   ══════════════════════════════════════════════════════════════ */
Auras.registrar('lobo-lunar', function (tam) {
  const u = 'alobolunar' + (++Auras._seq);
  return `<svg class="aura-svg" aria-hidden="true" focusable="false" style="display:block;overflow:hidden;width:${tam}px;height:${tam}px" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${tam}" height="${tam}" viewBox="0 0 300 300">
<style>/*<![CDATA[*/
    .la-bruma {
        transform-origin: 150.0px 150.0px;
        animation: la-respirar 5s ease-in-out infinite;
    }
    @keyframes la-respirar {
        0%, 100% { opacity: .5; transform: scale(1); }
        50%      { opacity: .8; transform: scale(1.04); }
    }

    .la-onda {
        transform-origin: 150.0px 150.0px;
        animation: la-expandir 3s cubic-bezier(.1,.7,.3,1) infinite;
    }
    @keyframes la-expandir {
        0%   { transform: scale(0.2); opacity: .8; }
        100% { transform: scale(1.1); opacity: 0; }
    }

    .la-girar {
        transform-origin: 150.0px 150.0px;
        animation: la-spin 50s linear infinite;
    }
    @keyframes la-spin {
        100% { transform: rotate(360deg); }
    }

    .la-cristal {
        animation: la-flicker 1.6s ease-in-out infinite alternate;
    }
    @keyframes la-flicker {
        0%   { opacity: .4; transform: scale(0.9); }
        100% { opacity: .8; transform: scale(1.1); }
    }

    .la-gelo circle {
        animation-name: la-subir;
        animation-timing-function: cubic-bezier(.3,0,.7,1);
        animation-iteration-count: infinite;
    }
    @keyframes la-subir {
        0%   { transform: translateY(18px) scale(0.4); opacity: 0; }
        30%  { opacity: .8; }
        100% { transform: translateY(-90px) scale(1.1); opacity: 0; }
    }

    .la-constelacao {
        animation: la-brilho-const 6s ease-in-out infinite;
    }
    @keyframes la-brilho-const {
        0%, 100% { opacity: .3; }
        50%      { opacity: .7; }
    }

    @media (prefers-reduced-motion: reduce) {
        .la-bruma, .la-onda, .la-girar, .la-cristal,
        .la-gelo circle, .la-constelacao { animation: none !important; }
    }
    /*]]>*/</style>
<defs>
<radialGradient cx="150.0" cy="150.0" r="150.0" gradientUnits="userSpaceOnUse" id="${u}_bruma">
<stop offset="0.0" stop-color="#b8c7e8" stop-opacity="0.3" />
<stop offset="0.5" stop-color="#5b7fbf" stop-opacity="0.08" />
<stop offset="1.0" stop-color="#1a1f3a" stop-opacity="0" />
</radialGradient>
<linearGradient x1="0" y1="0" x2="300" y2="300" gradientUnits="userSpaceOnUse" id="${u}_cristal">
<stop offset="0.0" stop-color="#ffffff" stop-opacity="1" />
<stop offset="0.5" stop-color="#7ec8e3" stop-opacity="0.6" />
<stop offset="1.0" stop-color="#5b7fbf" stop-opacity="0.2" />
</linearGradient>
<filter x="-40%" y="-40%" width="180%" height="180%" id="${u}_glow">
<feGaussianBlur stdDeviation="4.0" result="b"/><feComponentTransfer in="b" result="bb"><feFuncA type="linear" slope="1.3"/></feComponentTransfer><feMerge><feMergeNode in="bb"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter x="-40%" y="-40%" width="180%" height="180%" id="${u}_glow_forte">
<feGaussianBlur stdDeviation="8.0" result="b"/><feComponentTransfer in="b" result="bb"><feFuncA type="linear" slope="1.5"/></feComponentTransfer><feMerge><feMergeNode in="bb"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<clipPath id="${u}_corte">
<circle cx="150.0" cy="150.0" r="142.0" />
</clipPath>
</defs>
<g class="la-bruma">
<circle cx="150.0" cy="150.0" r="148.0" fill="url(#${u}_bruma)"/>
</g>
<g>
<circle cx="150.0" cy="150.0" r="120.0" fill="none" stroke="#b8c7e8" stroke-width="2.4" stroke-dasharray="8.0 16.0" opacity="0.5" class="la-onda" style="animation-delay:0.0s"/>
<circle cx="150.0" cy="150.0" r="120.0" fill="none" stroke="#b8c7e8" stroke-width="1.6" stroke-dasharray="8.0 16.0" opacity="0.5" class="la-onda" style="animation-delay:1.2s"/>
<circle cx="150.0" cy="150.0" r="120.0" fill="none" stroke="#b8c7e8" stroke-width="0.8" stroke-dasharray="8.0 16.0" opacity="0.5" class="la-onda" style="animation-delay:2.4s"/>
</g>
<g class="la-girar">
<g transform="rotate(15.0 225.0 150.0)" style="animation-delay:0.00s" class="la-cristal"><polygon points="225.0,144.0 228.6,150.0 225.0,156.0 221.4,150.0" fill="url(#${u}_cristal)" stroke="#ffffff" stroke-width="0.8" opacity=".7"/></g>
<g transform="rotate(45.0 215.0 187.5)" style="animation-delay:0.20s" class="la-cristal"><polygon points="215.0,181.5 218.6,187.5 215.0,193.5 211.4,187.5" fill="url(#${u}_cristal)" stroke="#ffffff" stroke-width="0.8" opacity=".7"/></g>
<g transform="rotate(75.0 187.5 215.0)" style="animation-delay:0.40s" class="la-cristal"><polygon points="187.5,209.0 191.1,215.0 187.5,221.0 183.9,215.0" fill="url(#${u}_cristal)" stroke="#ffffff" stroke-width="0.8" opacity=".7"/></g>
<g transform="rotate(105.0 150.0 225.0)" style="animation-delay:0.60s" class="la-cristal"><polygon points="150.0,219.0 153.6,225.0 150.0,231.0 146.4,225.0" fill="url(#${u}_cristal)" stroke="#ffffff" stroke-width="0.8" opacity=".7"/></g>
<g transform="rotate(135.0 112.5 215.0)" style="animation-delay:0.80s" class="la-cristal"><polygon points="112.5,209.0 116.1,215.0 112.5,221.0 108.9,215.0" fill="url(#${u}_cristal)" stroke="#ffffff" stroke-width="0.8" opacity=".7"/></g>
<g transform="rotate(165.0 85.0 187.5)" style="animation-delay:1.00s" class="la-cristal"><polygon points="85.0,181.5 88.6,187.5 85.0,193.5 81.4,187.5" fill="url(#${u}_cristal)" stroke="#ffffff" stroke-width="0.8" opacity=".7"/></g>
<g transform="rotate(195.0 75.0 150.0)" style="animation-delay:1.20s" class="la-cristal"><polygon points="75.0,144.0 78.6,150.0 75.0,156.0 71.4,150.0" fill="url(#${u}_cristal)" stroke="#ffffff" stroke-width="0.8" opacity=".7"/></g>
<g transform="rotate(225.0 85.0 112.5)" style="animation-delay:1.40s" class="la-cristal"><polygon points="85.0,106.5 88.6,112.5 85.0,118.5 81.4,112.5" fill="url(#${u}_cristal)" stroke="#ffffff" stroke-width="0.8" opacity=".7"/></g>
<g transform="rotate(255.0 112.5 85.0)" style="animation-delay:1.60s" class="la-cristal"><polygon points="112.5,79.0 116.1,85.0 112.5,91.0 108.9,85.0" fill="url(#${u}_cristal)" stroke="#ffffff" stroke-width="0.8" opacity=".7"/></g>
<g transform="rotate(285.0 150.0 75.0)" style="animation-delay:1.80s" class="la-cristal"><polygon points="150.0,69.0 153.6,75.0 150.0,81.0 146.4,75.0" fill="url(#${u}_cristal)" stroke="#ffffff" stroke-width="0.8" opacity=".7"/></g>
<g transform="rotate(315.0 187.5 85.0)" style="animation-delay:2.00s" class="la-cristal"><polygon points="187.5,79.0 191.1,85.0 187.5,91.0 183.9,85.0" fill="url(#${u}_cristal)" stroke="#ffffff" stroke-width="0.8" opacity=".7"/></g>
<g transform="rotate(345.0 215.0 112.5)" style="animation-delay:2.20s" class="la-cristal"><polygon points="215.0,106.5 218.6,112.5 215.0,118.5 211.4,112.5" fill="url(#${u}_cristal)" stroke="#ffffff" stroke-width="0.8" opacity=".7"/></g>
</g>
<g class="la-gelo">
<circle cx="216.0" cy="103.4" r="2.7" fill="#f0f4ff" opacity="0.43" style="animation-duration:2.75s; animation-delay:1.97s"/>
<circle cx="182.1" cy="187.7" r="3.1" fill="#f0f4ff" opacity="0.79" style="animation-duration:2.46s; animation-delay:0.43s"/>
<circle cx="215.8" cy="163.1" r="2.5" fill="#f0f4ff" opacity="0.84" style="animation-duration:4.47s; animation-delay:2.76s"/>
<circle cx="230.9" cy="183.8" r="1.5" fill="#f0f4ff" opacity="0.61" style="animation-duration:3.33s; animation-delay:2.73s"/>
<circle cx="196.8" cy="173.0" r="1.4" fill="#f0f4ff" opacity="0.87" style="animation-duration:4.48s; animation-delay:1.30s"/>
<circle cx="156.9" cy="179.5" r="1.6" fill="#f0f4ff" opacity="0.76" style="animation-duration:3.47s; animation-delay:0.18s"/>
<circle cx="163.1" cy="182.3" r="3.3" fill="#f0f4ff" opacity="0.53" style="animation-duration:2.18s; animation-delay:0.41s"/>
<circle cx="148.9" cy="132.9" r="3.0" fill="#f0f4ff" opacity="0.59" style="animation-duration:3.37s; animation-delay:2.52s"/>
<circle cx="199.7" cy="239.0" r="3.3" fill="#f0f4ff" opacity="0.44" style="animation-duration:2.74s; animation-delay:1.25s"/>
<circle cx="62.1" cy="72.8" r="2.3" fill="#f0f4ff" opacity="0.76" style="animation-duration:3.34s; animation-delay:0.17s"/>
<circle cx="73.6" cy="124.5" r="2.1" fill="#f0f4ff" opacity="0.85" style="animation-duration:3.74s; animation-delay:2.71s"/>
<circle cx="179.6" cy="79.8" r="3.3" fill="#f0f4ff" opacity="0.52" style="animation-duration:2.26s; animation-delay:2.62s"/>
<circle cx="177.4" cy="159.0" r="2.4" fill="#f0f4ff" opacity="0.44" style="animation-duration:2.90s; animation-delay:0.99s"/>
<circle cx="166.9" cy="105.9" r="2.5" fill="#f0f4ff" opacity="0.63" style="animation-duration:2.48s; animation-delay:2.56s"/>
<circle cx="190.6" cy="152.4" r="2.0" fill="#f0f4ff" opacity="0.62" style="animation-duration:4.09s; animation-delay:0.02s"/>
<circle cx="167.1" cy="229.9" r="3.3" fill="#f0f4ff" opacity="0.64" style="animation-duration:2.31s; animation-delay:0.13s"/>
<circle cx="239.1" cy="150.4" r="2.3" fill="#f0f4ff" opacity="0.47" style="animation-duration:3.20s; animation-delay:1.29s"/>
<circle cx="141.4" cy="81.3" r="2.8" fill="#f0f4ff" opacity="0.52" style="animation-duration:3.56s; animation-delay:1.46s"/>
<circle cx="165.7" cy="106.2" r="3.4" fill="#f0f4ff" opacity="0.86" style="animation-duration:2.52s; animation-delay:1.94s"/>
<circle cx="226.0" cy="165.2" r="1.8" fill="#f0f4ff" opacity="0.57" style="animation-duration:3.84s; animation-delay:2.60s"/>
<circle cx="168.1" cy="191.5" r="3.2" fill="#f0f4ff" opacity="0.80" style="animation-duration:4.01s; animation-delay:0.99s"/>
<circle cx="66.4" cy="199.0" r="2.9" fill="#f0f4ff" opacity="0.72" style="animation-duration:3.21s; animation-delay:0.86s"/>
</g>
<g class="la-constelacao">
<line x1="238.5" y1="165.3" x2="197.3" y2="217.1" stroke="#7ec8e3" stroke-width="0.3" stroke-opacity=".35" stroke-dasharray="2.0 4.0"/>
<line x1="111.8" y1="244.3" x2="81.3" y2="195.1" stroke="#7ec8e3" stroke-width="0.3" stroke-opacity=".35" stroke-dasharray="2.0 4.0"/>
<line x1="79.4" y1="100.0" x2="141.9" y2="92.6" stroke="#7ec8e3" stroke-width="0.3" stroke-opacity=".35" stroke-dasharray="2.0 4.0"/>
<line x1="141.9" y1="92.6" x2="206.3" y2="63.2" stroke="#7ec8e3" stroke-width="0.3" stroke-opacity=".35" stroke-dasharray="2.0 4.0"/>
<circle cx="238.5" cy="165.3" r="2.5" fill="#ffffff" opacity="0.54" filter="url(#${u}_glow)"/>
<circle cx="197.3" cy="217.1" r="2.5" fill="#ffffff" opacity="0.43" filter="url(#${u}_glow)"/>
<circle cx="111.8" cy="244.3" r="2.5" fill="#ffffff" opacity="0.51" filter="url(#${u}_glow)"/>
<circle cx="81.3" cy="195.1" r="2.5" fill="#ffffff" opacity="0.39" filter="url(#${u}_glow)"/>
<circle cx="79.4" cy="100.0" r="2.5" fill="#ffffff" opacity="0.54" filter="url(#${u}_glow)"/>
<circle cx="141.9" cy="92.6" r="2.5" fill="#ffffff" opacity="0.31" filter="url(#${u}_glow)"/>
<circle cx="206.3" cy="63.2" r="2.5" fill="#ffffff" opacity="0.65" filter="url(#${u}_glow)"/>
</g>
</svg>`;
});

/* FORJA:FIM lobo-lunar */

/* ============================================================
   Aura: Monarca das Sombras (Sombria, Sepuries, Roxo)
   ============================================================ */
Auras.registrar('monarca-das-sombras', function (tam) {
  const u = 'aura_monarca_' + Auras._seq++;
  
  // Fogo sombrio (Base roxa e magenta)
  const fogoBase = Auras._coroaDeChamas({ 
    picos: 14, min: 90, max: 140, base: 120, turb: 0.1 
  });
  
  const fogoInterno = Auras._coroaDeChamas({ 
    picos: 10, min: 70, max: 100, base: 85, turb: 0.15 
  });

  return `
    ${Auras._estilo()}
    <svg viewBox="0 0 300 300" width="${tam}" height="${tam}" class="aura-svg">
      <defs>
        <radialGradient id="${u}_brilho" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.5"/>
          <stop offset="60%" stop-color="#4c1d95" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        
        <radialGradient id="${u}_fogoExt" cx="50%" cy="50%" r="50%">
          <stop offset="60%" stop-color="#312e81"/>
          <stop offset="90%" stop-color="#7c3aed"/>
          <stop offset="100%" stop-color="#e879f9" stop-opacity="0"/>
        </radialGradient>

        <radialGradient id="${u}_fogoInt" cx="50%" cy="50%" r="50%">
          <stop offset="50%" stop-color="#0f172a"/>
          <stop offset="80%" stop-color="#9333ea"/>
          <stop offset="100%" stop-color="#e879f9" stop-opacity="0"/>
        </radialGradient>

        <filter id="${u}_glow">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        
        <!-- Sombra Projetada Escura -->
        <filter id="${u}_sombra">
           <feDropShadow dx="0" dy="0" stdDeviation="15" flood-color="#c084fc" flood-opacity="0.3"/>
        </filter>
      </defs>

      <!-- Brilho de Fundo Sombrio -->
      <circle cx="150" cy="150" r="140" fill="url(#${u}_brilho)" class="aura-arder2"/>

      <g filter="url(#${u}_sombra)">
        <!-- Coroa de Chamas Externa -->
        <g class="aura-r1">
          <g class="aura-arder" filter="url(#${u}_glow)">
            <path d="${fogoBase}" fill="url(#${u}_fogoExt)" opacity="0.8"/>
          </g>
        </g>

        <!-- Coroa de Chamas Interna (Sentido Inverso) -->
        <g class="aura-r2">
          <g class="aura-arder2" filter="url(#${u}_glow)">
            <path d="${fogoInterno}" fill="url(#${u}_fogoInt)" opacity="0.9"/>
          </g>
        </g>
        
        <!-- Partículas Sombrias (Estrelas / Fagulhas) -->
        <g class="aura-r3" opacity="0.7" filter="url(#${u}_glow)">
          <circle cx="150" cy="30" r="3" fill="#e879f9" />
          <circle cx="250" cy="100" r="2" fill="#c084fc" />
          <circle cx="230" cy="220" r="3.5" fill="#e879f9" />
          <circle cx="90" cy="250" r="2" fill="#c084fc" />
          <circle cx="40" cy="150" r="2.5" fill="#e879f9" />
        </g>
        
        <!-- Anel Central Obscuro -->
        <circle cx="150" cy="150" r="75" fill="none" stroke="#7c3aed" stroke-width="2" stroke-dasharray="10 30" class="aura-r2" opacity="0.6"/>
      </g>
    </svg>`;
});

/* ============================================================
   Aura: Domínio Lançado (Arquiteto S-Rank, Verde/Azul)
   ============================================================ */
Auras.registrar('dominio-lancado', function (tam) {
  const u = 'aura_dominio_' + Auras._seq++;
  
  // Geometria precisa, não fogo caótico
  const lamina = `M145 20 L155 20 L150 5 Z`;
  const matriz = [];
  for(let i=0; i<12; i++) {
    matriz.push(`<g transform="rotate(${i*30} 150 150)"><path d="${lamina}" fill="#6ee7b7" opacity="0.8"/></g>`);
  }

  const matrizInterna = [];
  for(let i=0; i<8; i++) {
    matrizInterna.push(`<g transform="rotate(${i*45} 150 150)"><rect x="148" y="45" width="4" height="15" fill="#22d3ee" rx="2" opacity="0.9"/></g>`);
  }

  return `
    ${Auras._estilo()}
    <svg viewBox="0 0 300 300" width="${tam}" height="${tam}" class="aura-svg">
      <defs>
        <radialGradient id="${u}_brilho" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#022c22" stop-opacity="0.8"/>
          <stop offset="50%" stop-color="#0891b2" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>

        <filter id="${u}_glow">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <!-- Brilho de Fundo -->
      <circle cx="150" cy="150" r="145" fill="url(#${u}_brilho)" class="aura-arder2"/>

      <g filter="url(#${u}_glow)">
        <!-- Pistas de Dados Externas (Círculos concêntricos hifados) -->
        <g class="aura-r1">
          <circle cx="150" cy="150" r="135" fill="none" stroke="#6ee7b7" stroke-width="1.5" stroke-dasharray="15 25" opacity="0.5"/>
          <circle cx="150" cy="150" r="120" fill="none" stroke="#22d3ee" stroke-width="1" stroke-dasharray="4 8" opacity="0.6"/>
          ${matriz.join('')}
        </g>

        <!-- Matriz Interna (Sentido Inverso) -->
        <g class="aura-r2">
          <circle cx="150" cy="150" r="95" fill="none" stroke="#2dd4bf" stroke-width="2" stroke-dasharray="30 40" opacity="0.7"/>
          <circle cx="150" cy="150" r="85" fill="none" stroke="#0284c7" stroke-width="3" opacity="0.3"/>
          ${matrizInterna.join('')}
        </g>
        
        <!-- Núcleo Pulsante -->
        <g class="aura-arder">
          <circle cx="150" cy="150" r="70" fill="none" stroke="#6ee7b7" stroke-width="1" opacity="0.8" stroke-dasharray="2 4"/>
          <!-- Triângulos orbitando o centro -->
          <polygon points="150,65 155,75 145,75" fill="#22d3ee" class="aura-r3"/>
          <polygon points="150,235 155,225 145,225" fill="#22d3ee" class="aura-r3"/>
        </g>
      </g>
    </svg>`;
});

window.Auras = Auras;

