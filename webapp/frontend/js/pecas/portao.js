/* ══════════════════════════════════════════════════════════════════
   O PORTÃO — a fenda, desenhada

   O Arquiteto, depois de eu estragar uma versão que estava boa:
   "esse aqui ficou ótimo, vamos criar com base nesse formato, apenas
    melhorando cores, neon, transparências, auras e efeitos".

   A GEOMETRIA ESTÁ CONGELADA. Arco de topo REDONDO, controle na altura
   do ápice (`k*0.12`), que mantém a tangente quase horizontal lá em
   cima e dá ao portal a massa de um arco de pedra. Eu já tentei afinar
   isto num bico ogival: perdeu o peso e virou uma lança. Foi tentado e
   recusado — se alguém for "melhorar" a curva de novo, é este parágrafo
   que deveria ler primeiro.

   O QUE FAZ ELE PARECER LUZ E NÃO ADESIVO

   1. DUAS CORES POR RANK, núcleo e franja. Neon monocromático fica
      chapado; num tubo de verdade o matiz deriva na borda.
   2. NEON EM TRÊS CAMADAS: bafo largo desfocado → corpo na cor →
      miolo branco fino. É a pilha que acende.
   3. AURA ANTES DO PORTAL: bafo, halo e a poça no chão. Sem ela o
      desenho fica recortado sobre o fundo.
   4. A ÍRIS — um ponto branco-quente logo acima da greta. É de onde a
      luz de fato nasce; sem ele o vazio é só um gradiente.
   5. BRASAS COM CORPO: núcleo, halo e centelha, nascendo concentradas
      embaixo e subindo esfriando. Chapadas e espalhadas por igual,
      pareciam nevasca.

   E O ARO É O PRAZO. Não existe barra de progresso: o próprio contorno
   do portal se acende conforme o dia corre, sobre um trilho apagado com
   runas de hora. É `_prazo_da_sessao` do servidor virando a coisa mais
   visível da tela, em vez de um número escondido.

   O SORTEIO É SEMEADO PELO ID. Brasas e lascas precisam ficar no mesmo
   lugar entre dois redesenhos — senão o portão "pisca" de forma
   diferente a cada `carregar()`, e o olho lê isso como defeito.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const VB = { w: 272, h: 292, cx: 136, ay: 30, by: 252, hw: 84, k: 118 };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* PRNG semeado — o mesmo portão sorteia sempre as mesmas brasas. */
  function dado(semente) {
    let x = (semente * 2654435761) % 2147483647 || 42;
    return () => { x = (x * 48271) % 2147483647; return (x - 1) / 2147483646; };
  }

  const qbez = (p0, c, p1, n) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      pts.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0],
                u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]);
    }
    return pts;
  };

  /* O ARCO. Congelado — ver o cabeçalho. */
  function arcoPts() {
    const { cx, ay, by, hw, k } = VB;
    const yj = ay + k;
    let pts = [[cx - hw, by]];
    for (let i = 1; i <= 10; i++) pts.push([cx - hw, by - (by - yj) * i / 10]);
    pts = pts.concat(qbez([cx - hw, yj], [cx - hw, ay + k * 0.12], [cx, ay], 34).slice(1));
    pts = pts.concat(qbez([cx, ay], [cx + hw, ay + k * 0.12], [cx + hw, yj], 34).slice(1));
    for (let i = 1; i <= 10; i++) pts.push([cx + hw, yj + (by - yj) * i / 10]);
    return pts;
  }

  const dDe = (pts, fechar) =>
    'M' + pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L') + (fechar ? ' Z' : '');

  const comprimento = (pts) => {
    let t = 0;
    for (let i = 0; i < pts.length - 1; i++)
      t += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    return t;
  };

  const PTS  = arcoPts();
  const DARC = dDe(PTS, false);
  const DFIL = dDe(PTS, true);
  const LARC = comprimento(PTS);

  /* ── As fissuras: a realidade cedendo ao redor da base ────────── */
  function rachaduras(rnd, cor, op) {
    const { cx, by } = VB;
    const out = [];
    for (let i = 0; i < 7; i++) {
      const ang = Math.PI * (0.08 + 0.84 * i / 6) + (rnd() - .5) * .12;
      const L = VB.w * 0.34 * (0.45 + rnd() * 0.55);
      let x = cx, y = by + 2;
      const seg = [[x, y]];
      const passos = 3 + Math.floor(rnd() * 3);
      for (let s = 0; s < passos; s++) {
        const a = ang + (rnd() - .5) * .6;
        x += Math.cos(a) * (L / passos);
        y += Math.sin(a) * (L / passos) * 0.30;
        seg.push([x, y]);
      }
      out.push(`<path d="${dDe(seg)}" fill="none" stroke="${cor}" `
             + `stroke-opacity="${(op * (0.4 + rnd() * 0.6)).toFixed(2)}" `
             + `stroke-width="${(0.7 + rnd() * 1.2).toFixed(1)}" stroke-linecap="round"/>`);
    }
    return out.join('');
  }

  /* ── As brasas: núcleo, halo e centelha ───────────────────────── */
  function brasas(rnd, cor) {
    const { cx, ay, by, hw } = VB;
    const alt = by - ay, out = [];
    for (let i = 0; i < 26; i++) {
      const u = Math.pow(rnd(), 1.7);
      const y = by - u * alt * 1.1;
      const esp = 0.55 + 0.8 * u;
      const x = cx + (rnd() * 2 - 1) * hw * esp;
      const r = (0.6 + rnd() * 1.4) * (1.25 - 0.5 * u);
      const op = (0.35 + rnd() * 0.65) * (1 - 0.45 * u);
      const dur = (3.4 + rnd() * 4.2).toFixed(1);
      const atr = (-rnd() * 7).toFixed(1);
      const g = `class="pt-brasa" style="--d:${dur}s;--a:${atr}s"`;
      out.push(`<g ${g}>`
        + `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * 3.2).toFixed(1)}" fill="${cor}" fill-opacity="${(op * .16).toFixed(2)}"/>`
        + `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${cor}" fill-opacity="${op.toFixed(2)}"/>`
        + (r > 1.5 ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * .45).toFixed(1)}" fill="#fff" fill-opacity="${(op * .8).toFixed(2)}"/>` : '')
        + `</g>`);
    }
    return out.join('');
  }

  /* ── As lascas de realidade, girando devagar ──────────────────── */
  function lascas(rnd, cor) {
    const { cx, ay, by, hw } = VB;
    const out = [];
    for (let i = 0; i < 9; i++) {
      const x = cx + (rnd() * 2 - 1) * hw * 1.5;
      const y = by - (10 + rnd() * (by - ay) * 1.05);
      const s = 3 + rnd() * 6;
      const rot = rnd() * 360;
      const op = 0.25 + rnd() * 0.45;
      const dur = (14 + rnd() * 16).toFixed(1);
      out.push(`<g class="pt-lasca" style="--d:${dur}s;--a:${(-rnd() * 20).toFixed(1)}s" `
        + `transform="translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${rot.toFixed(0)})">`
        + `<path d="M0,${(-s).toFixed(1)} L${(s * .42).toFixed(1)},0 L0,${(s * .62).toFixed(1)} L${(-s * .38).toFixed(1)},0 Z" `
        + `fill="${cor}" fill-opacity="${(op * .55).toFixed(2)}" stroke="${cor}" `
        + `stroke-opacity="${Math.min(1, op * 1.6).toFixed(2)}" stroke-width=".9"/>`
        + `<path d="M0,${(-s).toFixed(1)} L${(s * .42).toFixed(1)},0" stroke="#fff" `
        + `stroke-opacity="${(op * .7).toFixed(2)}" stroke-width=".7" fill="none"/></g>`);
    }
    return out.join('');
  }

  /* ═══════════════════════════════════════════════════════════════
     O DESENHO
     ═══════════════════════════════════════════════════════════════ */
  function fenda(d, e) {
    const { cx, ay, by, hw } = VB;
    const u    = 'p' + d.id;
    const rnd  = dado(d.id || 1);
    const mat  = e.materia;
    const nuc  = e.cores[0], fra = e.cores[1];
    const morto = (mat === 'selado' || mat === 'perdido');
    const vivo  = (mat === 'dentro' || mat === 'aberto');
    const o = [];

    /* ── Aura: o que existe ANTES do portal ───────────────────── */
    if (!morto) {
      o.push(`<ellipse class="pt-bafo" cx="${cx}" cy="${by - 70}" rx="${(hw * 2.1).toFixed(0)}" `
           + `ry="${((by - ay) * 0.78).toFixed(0)}" fill="url(#bafo${u})"/>`);
      o.push(`<ellipse class="pt-halo" cx="${cx}" cy="${by - 46}" rx="${(hw * 1.35).toFixed(0)}" `
           + `ry="${((by - ay) * 0.52).toFixed(0)}" fill="url(#halo${u})"/>`);
    }

    /* ── Chão: poça, reflexo e fissuras ───────────────────────── */
    if (!morto) {
      o.push(`<ellipse class="pt-poca" cx="${cx}" cy="${by + 5}" rx="${(hw * 1.75).toFixed(0)}" ry="19" fill="url(#chao${u})"/>`);
      /* O PORTAL DEVOLVIDO PELO CHÃO, recortado a 46px da base: mais
         que isso e o reflexo entra na lápide, o que denuncia o truque. */
      o.push(`<g clip-path="url(#poca${u})"><g transform="translate(0,${2 * by}) scale(1,-1)" opacity=".3">`
           + `<path d="${DFIL}" fill="url(#vazio${u})"/>`
           + `<path d="${DARC}" fill="none" stroke="${nuc}" stroke-opacity=".75" stroke-width="2.4" filter="url(#ptNeon)"/>`
           + `</g></g>`);
      o.push(`<rect x="${(cx - hw * 1.4).toFixed(0)}" y="${by}" width="${(hw * 2.8).toFixed(0)}" height="46" fill="url(#apaga${u})"/>`);
    }
    o.push(rachaduras(rnd, morto ? '#33333f' : nuc, morto ? .3 : .62));

    /* ── O vazio ──────────────────────────────────────────────── */
    o.push(`<path d="${DFIL}" fill="url(#vazio${u})"/>`);
    o.push(`<path d="${DFIL}" fill="url(#ptNeblina)" opacity="${morto ? .2 : .62}"/>`);
    if (!morto) {
      o.push(`<ellipse class="pt-iris" cx="${cx}" cy="${by - 24}" rx="${(hw * .72).toFixed(0)}" ry="34" fill="url(#iris${u})"/>`);
    }

    /* A LETRA GRAVADA NO VAZIO. Chapada, some contra o brilho da íris:
       contorno claro por baixo e miolo escuro por cima leem como relevo. */
    const opL = morto ? .10 : .30;
    o.push(`<text class="pt-rank" x="${cx}" y="${by - 62}" text-anchor="middle" `
         + `font-family="Georgia,serif" font-size="126" font-weight="800" `
         + `fill="none" stroke="${nuc}" stroke-width="2.2" opacity="${opL}">${esc(d.rank || 'E')}</text>`);
    o.push(`<text class="pt-rank" x="${cx}" y="${by - 62}" text-anchor="middle" `
         + `font-family="Georgia,serif" font-size="126" font-weight="800" `
         + `fill="#05050c" opacity="${morto ? .16 : .32}">${esc(d.rank || 'E')}</text>`);

    /* ── A matéria do estado ──────────────────────────────────── */
    if (mat === 'selado') {
      o.push(`<rect x="${cx - hw - 10}" y="${by - 124}" width="${hw * 2 + 20}" height="28" fill="#101018" stroke="${nuc}" stroke-opacity=".5"/>`);
      o.push(`<rect x="${cx - hw - 10}" y="${by - 124}" width="${hw * 2 + 20}" height="2" fill="${nuc}" fill-opacity=".35"/>`);
      for (let i = 0; i < 5; i++) {
        const xx = (cx - hw + 14 + i * (hw * 2 - 28) / 4).toFixed(0);
        o.push(`<circle cx="${xx}" cy="${by - 110}" r="5.5" fill="none" stroke="${nuc}" stroke-opacity=".75" stroke-width="2"/>`);
      }
    } else if (mat === 'perdido') {
      o.push(`<path d="M${cx - 42},${by - 196} L${cx + 10},${by - 134} L${cx - 28},${by - 110} L${cx + 36},${by - 34}" `
           + `fill="none" stroke="${nuc}" stroke-width="2.6" stroke-linejoin="round" filter="url(#ptNeon)"/>`);
    } else {
      o.push(lascas(rnd, nuc));
      o.push(brasas(rnd, nuc));
      o.push(`<path class="pt-greta" d="M${(cx - hw * .9).toFixed(0)},${by} L${(cx - hw * .2).toFixed(0)},${by - 3} `
           + `L${(cx + hw * .3).toFixed(0)},${by + 2} L${(cx + hw * .9).toFixed(0)},${by}" `
           + `stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" filter="url(#ptNeon)"/>`);
    }

    /* ── O ARO É O PRAZO ──────────────────────────────────────── */
    o.push(`<path d="${DARC}" fill="none" stroke="${fra}" stroke-opacity=".16" stroke-width="7"/>`);
    o.push(`<path d="${DARC}" fill="none" stroke="${nuc}" stroke-opacity=".30" stroke-width="1.6"/>`);
    /* As runas de hora — sem elas o aro é só um tubo bonito e ninguém
       vê que aquilo é uma barra, nem quanto falta. */
    o.push(`<path d="${DARC}" fill="none" stroke="${nuc}" stroke-opacity=".55" stroke-width="5" `
         + `stroke-dasharray="1.6 ${(LARC / 26).toFixed(1)}" stroke-linecap="round"/>`);

    const pct = e.pct;
    if (pct != null && pct > 0) {
      const dash = `stroke-dasharray="${(LARC * pct).toFixed(0)} ${LARC.toFixed(0)}" stroke-linecap="round"`;
      o.push(`<path class="pt-aro-bafo" d="${DARC}" fill="none" stroke="${fra}" stroke-width="9" stroke-opacity=".5" ${dash} filter="url(#ptNeonLargo)"/>`);
      o.push(`<path class="pt-aro" d="${DARC}" fill="none" stroke="${nuc}" stroke-width="3.4" ${dash} filter="url(#ptNeon)"/>`);
      o.push(`<path class="pt-aro-miolo" d="${DARC}" fill="none" stroke="#fff" stroke-width="1.1" stroke-opacity=".92" ${dash}/>`);
    } else if (!morto) {
      o.push(`<path class="pt-aro" d="${DARC}" fill="none" stroke="${nuc}" stroke-opacity=".85" stroke-width="1.6" filter="url(#ptNeon)"/>`);
    } else {
      /* PEDRA MORTA AINDA É PEDRA. Com opacidade .55 num cinza escuro, o
         portão selado quase sumia do fundo — e sumir não é o mesmo que
         estar trancado. Ele precisa ter volume suficiente para o olho
         reconhecer um portão ali, e só então perceber que não acende. */
      o.push(`<path d="${DARC}" fill="none" stroke="${nuc}" stroke-opacity=".9" stroke-width="2.2"/>`);
      o.push(`<path d="${DARC}" fill="none" stroke="#8c93ab" stroke-opacity=".3" stroke-width="1"/>`);
    }

    return `<svg class="pt-svg" viewBox="0 0 ${VB.w} ${VB.h}" aria-hidden="true">`
         + defs(u, nuc, fra, vivo, mat) + o.join('') + `</svg>`;
  }

  function defs(u, nuc, fra, vivo, mat) {
    const frio = (mat === 'fora');
    const opN  = vivo ? .55 : (frio ? .26 : .07);
    return `<defs>`
      + `<clipPath id="poca${u}"><rect x="${(VB.cx - VB.hw * 1.4).toFixed(0)}" y="${VB.by}" width="${(VB.hw * 2.8).toFixed(0)}" height="46"/></clipPath>`
      + `<radialGradient id="vazio${u}" cx="50%" cy="84%" r="92%">`
        + `<stop offset="0" stop-color="${nuc}" stop-opacity="${opN}"/>`
        + `<stop offset="30%" stop-color="${fra}" stop-opacity="${(opN * .52).toFixed(2)}"/>`
        + `<stop offset="72%" stop-color="#120f26" stop-opacity=".9"/>`
        + `<stop offset="100%" stop-color="#04040a" stop-opacity="1"/></radialGradient>`
      + `<radialGradient id="iris${u}" cx="50%" cy="50%" r="50%">`
        + `<stop offset="0" stop-color="#fff" stop-opacity="${vivo ? .5 : .22}"/>`
        + `<stop offset="35%" stop-color="${nuc}" stop-opacity="${vivo ? .4 : .18}"/>`
        + `<stop offset="100%" stop-color="${nuc}" stop-opacity="0"/></radialGradient>`
      + `<radialGradient id="bafo${u}" cx="50%" cy="62%" r="50%">`
        + `<stop offset="0" stop-color="${fra}" stop-opacity="${vivo ? .30 : .14}"/>`
        + `<stop offset="55%" stop-color="${nuc}" stop-opacity="${vivo ? .10 : .05}"/>`
        + `<stop offset="100%" stop-color="${nuc}" stop-opacity="0"/></radialGradient>`
      + `<radialGradient id="halo${u}" cx="50%" cy="62%" r="50%">`
        + `<stop offset="0" stop-color="${nuc}" stop-opacity="${vivo ? .26 : .12}"/>`
        + `<stop offset="100%" stop-color="${nuc}" stop-opacity="0"/></radialGradient>`
      + `<radialGradient id="chao${u}" cx="50%" cy="50%" r="50%">`
        + `<stop offset="0" stop-color="#fff" stop-opacity=".34"/>`
        + `<stop offset="30%" stop-color="${nuc}" stop-opacity=".42"/>`
        + `<stop offset="100%" stop-color="${fra}" stop-opacity="0"/></radialGradient>`
      + `<linearGradient id="apaga${u}" x1="0" y1="0" x2="0" y2="1">`
        + `<stop offset="0" stop-color="#05050b" stop-opacity="0"/>`
        + `<stop offset="100%" stop-color="#05050b" stop-opacity="1"/></linearGradient>`
      + `</defs>`;
  }

  /* ═══════════════════════════════════════════════════════════════
     A LÁPIDE E A AÇÃO
     ═══════════════════════════════════════════════════════════════ */
  function html(d, opcoes) {
    const e = PortaoEstado.ler(d, opcoes && opcoes.agora);
    const arq = !!(opcoes && opcoes.arquiteto);
    const g = (n) => (window.Glifos && Glifos.existe(n)) ? Glifos.linha(n, 15) : '';

    const selos = e.selos.map(s => `<span class="pt-selo-min">${esc(s)}</span>`).join('');

    /* AS FERRAMENTAS FICAM NA LÁPIDE, não na barra de ação.
       A barra tem uma coisa só para fazer, e um "destruir" do lado de
       "atravessar" é um clique errado esperando para acontecer. */
    const ferramentas = [
      ['cronica',  'Crônica do Portão', 'score'],
      ['editar',   'Reforjar',          'editar'],
      ['destruir', 'Destruir portão',   'excluir'],
    ].concat(arq ? [
      ['teste', 'Entrada do Arquiteto — modo teste', 'arquiteto'],
      ['reset', 'Reset do Arquiteto',                'resetar'],
    ] : []).map(([ico, dica, acao]) =>
      `<button class="pt-fer${acao === 'excluir' ? ' perigo' : ''}" data-pt-${acao}="${d.id}" `
      + `title="${esc(dica)}" aria-label="${esc(dica)}">${g(ico === 'cronica' ? 'arquivo'
          : ico === 'teste' ? 'padrao' : ico === 'reset' ? 'repeticao' : ico)}</button>`).join('');

    return `
    <article class="pt pt-${e.chave.toLowerCase()} pt-m-${e.materia}" data-pt="${d.id}"
             data-estado="${e.chave}"
             style="--pt-nuc:${e.cores[0]};--pt-fra:${e.cores[1]};--i:${(opcoes && opcoes.indice) || 0}">
      <div class="pt-fenda">
        ${fenda(d, e)}
        <div class="pt-selo" style="--sc:${e.selo_cor}">${esc(e.selo)}</div>
      </div>

      <div class="pt-lapide">
        <div class="pt-ferramentas">${ferramentas}</div>
        <h3 class="pt-titulo">${esc(d.titulo)}</h3>
        <p class="pt-sub">${esc(d.categoria || '')} · ${esc((d.dificuldade || '').toLowerCase())}${
          d.sempre_aberta ? ' · <span class="pt-inf">∞ nunca fecha</span>' : ''}</p>
        <p class="pt-prazo">${esc(e.prazo)}</p>
        <div class="pt-selos">${selos}</div>
      </div>

      <button class="pt-acao" data-pt-entrar="${d.id}" ${e.ativo ? '' : 'disabled'}>
        <span>${esc(e.botao)}</span>
      </button>
    </article>`;
  }

  /* ═══════════════════════════════════════════════════════════════
     OS FILTROS, UMA VEZ SÓ

     Dez portões são dez auras desfocadas. Se cada um trouxesse os seus
     `<filter>`, o compositor faria o mesmo trabalho dez vezes para
     produzir pixels idênticos. Eles moram num SVG oculto no documento e
     todos os portões apontam para lá.
     ═══════════════════════════════════════════════════════════════ */
  function garantirFiltros() {
    if (document.getElementById('pt-filtros')) return;
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.id = 'pt-filtros';
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('width', '0');
    el.setAttribute('height', '0');
    el.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    el.innerHTML = `
      <defs>
        <filter id="ptNeon" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="3.4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="ptNeonLargo" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="11"/>
        </filter>
        <radialGradient id="ptNeblina" cx="50%" cy="82%" r="76%">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".17"/>
          <stop offset="48%" stop-color="#8b7bff" stop-opacity=".12"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>`;
    document.body.appendChild(el);
  }

  /* SÓ QUEM ESTÁ NA TELA SE MEXE.
     A classe `.pt-vivo` é a chave de todas as animações do portão. Sem
     este observador, uma grade com vinte dungeons animaria vinte
     portais o tempo todo, inclusive os que estão a três telas de
     distância. */
  let olho = null;
  function observar(raiz) {
    if (!('IntersectionObserver' in window)) {
      raiz.querySelectorAll('.pt').forEach(p => p.classList.add('pt-vivo'));
      return;
    }
    if (!olho) {
      olho = new IntersectionObserver((entradas) => {
        entradas.forEach(en => en.target.classList.toggle('pt-vivo', en.isIntersecting));
      }, { rootMargin: '120px' });
    }
    raiz.querySelectorAll('.pt').forEach(p => olho.observe(p));
  }

  /* ═══════════════════════════════════════════════════════════════
     MONTAR A GRADE
     ═══════════════════════════════════════════════════════════════ */
  function montar(container, lista, opcoes) {
    if (!container) return;
    garantirFiltros();
    opcoes = opcoes || {};
    container.classList.add('pt-grade');
    container.innerHTML = lista
      .map((d, i) => html(d, Object.assign({}, opcoes, { indice: i })))
      .join('');
    observar(container);
    return container;
  }

  window.Portao = { html, fenda, montar, garantirFiltros, observar,
                    VB, LARC, DARC, _dado: dado };
})();
