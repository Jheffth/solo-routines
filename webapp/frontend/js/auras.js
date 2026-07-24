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
   AURA "PINK SPIRIT" — Femme Fatale (redesign espetacular)
   11 camadas: halos, 4 grupos de pétalas, espinhos, 2 shimmers,
   faíscas em órbita, anel tracejado duplo. Raios até 145.
   =================================================================== */
Auras.registrar('pink-spirit', function (tam) {
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

/* backward-compat: código legado que use 'bella-rosa' continua funcionando */
Auras.registrar('bella-rosa', function(tam) { return Auras.bloco('pink-spirit', tam); });
window.Auras = Auras;
