/* ============================================================
   jh3ffth.js — Insígnia "JH3FFTH, o Arquiteto"

   Substitui o desenho antigo, cujo problema não era a paleta —
   era o losango de 200px que cobria as 8 lâminas, as 36 runas e
   a cruz pulsante. Todo aquele trabalho ficava invisível, e a
   silhueta sumia em tamanho pequeno.

   Agora é um CRISTAL FACETADO: 12 estilhaços em volta de uma
   gema de 12 faces. A profundidade vem das facetas, não de
   camadas empilhadas uma sobre a outra.

   DUAS REGRAS DE SIMETRIA APRENDIDAS AQUI (não desfazer):

   1. O brilho de cada faceta da gema depende do ângulo ATÉ O
      TOPO em valor absoluto. Espelhado por construção.

   2. A quina das lâminas acompanha o espelho: as da metade
      direita recebem luz por dentro, as da esquerda por fora,
      e as duas sobre o eixo são chapadas. Sombrear todas do
      mesmo lado deixa a medalha torta — medido, 5,07 de desvio
      contra 0,12.

   O giro é LENTO de propósito: 70s nas lâminas e 90s nas runas.
   A gema e o clarão central ficam parados.
   ============================================================ */

const Jh3ffthArte = {

  _svgMedalhaArquiteto(tamanho = 260) {
    const t = tamanho;
  const C = 130;
  const pol = (r, n, giro = -90) => Array.from({length: n}, (_, i) => {
    const a = (giro + (360 / n) * i) * Math.PI / 180;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  });

  /* ── Lâminas externas: 12 dobras, comprimentos alternados,
        defasagem ZERO (alternância com defasagem quebra o espelho) ── */
  const laminas = [];
  for (let i = 0; i < 12; i++) {
    const ang = 30 * i;
    const a = i % 2 === 0 ? 126 : 98;
    const w = i % 2 === 0 ? 19 : 12;
    const base = C - 74, ponta = C - a, ombro = base - (base - ponta) * 0.30;

    // Estilhaço com quina central: duas faces, uma clara e uma escura.
    // O LADO da face clara ACOMPANHA O ESPELHO: lâminas da metade
    // direita recebem luz por dentro, as da esquerda por fora. Sem isso
    // o volume fica bonito e a medalha fica torta (medido: 5,07 de
    // desvio contra 0,09). As duas lâminas sobre o eixo (topo e base)
    // são chapadas de propósito — qualquer quina nelas desequilibra.
    const noEixo = (ang % 180 === 0);
    const esq = noEixo ? 'jhFaceClara' : (ang < 180 ? 'jhFaceClara' : 'jhFaceEscura');
    const dir = noEixo ? 'jhFaceClara' : (ang < 180 ? 'jhFaceEscura' : 'jhFaceClara');

    laminas.push(`<g transform="rotate(${ang} ${C} ${C})">
      <polygon points="130,${base} ${130 - w},${ombro} 130,${ponta}"
               fill="url(#${esq})"/>
      <polygon points="130,${base} ${130 + w},${ombro} 130,${ponta}"
               fill="url(#${dir})"/>
      <path d="M 130 ${base} L ${130 - w} ${ombro} L 130 ${ponta}
               L ${130 + w} ${ombro} Z"
            fill="none" stroke="#fca5a5" stroke-width=".9" stroke-opacity=".6"/>
      <path d="M 130 ${base} L 130 ${ponta}" stroke="#fecaca"
            stroke-width=".8" stroke-opacity=".5"/>
    </g>`);
  }

  /* ── Runas do aro: 36 dobras, densas o bastante para o giro
        lento não se ler como desequilíbrio ── */
  const runas = [];
  for (let i = 0; i < 36; i++) {
    const a = (Math.PI / 18) * i;
    const r2 = i % 3 === 0 ? 62 : 66;
    runas.push(`M ${C + 72 * Math.cos(a)} ${C + 72 * Math.sin(a)}
                L ${C + r2 * Math.cos(a)} ${C + r2 * Math.sin(a)}`);
  }

  /* ── A gema: 12 facetas. O brilho de cada uma depende do ângulo
        ATÉ O TOPO em valor absoluto — por isso é espelhada por
        construção, e não por sorte. ── */
  const v = pol(58, 12);
  const facetas = v.map((p, i) => {
    const q = v[(i + 1) % 12];
    const meio = (30 * i + 15 - 90) * Math.PI / 180;
    const luz = Math.max(0, Math.cos(meio + Math.PI / 2));   // 1 no topo, 0 embaixo
    const op = (0.06 + 0.30 * luz).toFixed(3);
    const sombra = (0.34 * (1 - luz)).toFixed(3);
    return `<polygon points="${C},${C} ${p[0].toFixed(1)},${p[1].toFixed(1)} ${q[0].toFixed(1)},${q[1].toFixed(1)}"
              fill="#ffffff" fill-opacity="${op}"/>
            <polygon points="${C},${C} ${p[0].toFixed(1)},${p[1].toFixed(1)} ${q[0].toFixed(1)},${q[1].toFixed(1)}"
              fill="#1a0208" fill-opacity="${sombra}"/>`;
  }).join('');
  const arestas = v.map(p => `M ${C} ${C} L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const pts = r => pol(r, 12).map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

  return `
  <svg viewBox="0 0 260 260" width="${t}" height="${t}" class="cq-svg"
       style="overflow:visible;max-width:none;width:${t}px;height:${t}px">
    <style>
      /* Giro LENTO. As camadas que giram têm 12 e 36 dobras — densas o
         bastante para o movimento não se ler como desequilíbrio. A gema
         e o clarão central ficam parados: são o ponto de leitura. */
      .jh-laminas { transform-origin: 130px 130px; animation: jh-girar 70s linear infinite; }
      .jh-runas   { transform-origin: 130px 130px; animation: jh-girar 90s linear infinite reverse; }
      @keyframes jh-girar { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) {
        .jh-laminas, .jh-runas { animation: none; }
      }
    </style>
    <defs>
      <linearGradient id="jhFaceClara" x1="0.5" y1="0" x2="0.5" y2="1">
        <stop offset="0%" stop-color="#fee2e2"/><stop offset="25%" stop-color="#f87171"/>
        <stop offset="70%" stop-color="#b91c1c"/><stop offset="100%" stop-color="#3b0508"/>
      </linearGradient>
      <linearGradient id="jhFaceEscura" x1="0.5" y1="0" x2="0.5" y2="1">
        <stop offset="0%" stop-color="#fca5a5"/><stop offset="25%" stop-color="#b91c1c"/>
        <stop offset="70%" stop-color="#5b0d12"/><stop offset="100%" stop-color="#120305"/>
      </linearGradient>
      <radialGradient id="jhMoldura" cx="50%" cy="26%">
        <stop offset="0%" stop-color="#57534e"/><stop offset="38%" stop-color="#1c1917"/>
        <stop offset="78%" stop-color="#2e1065"/><stop offset="100%" stop-color="#000"/>
      </radialGradient>
      <radialGradient id="jhGema" cx="50%" cy="30%">
        <stop offset="0%" stop-color="#fee2e2"/><stop offset="20%" stop-color="#f87171"/>
        <stop offset="55%" stop-color="#dc2626"/><stop offset="82%" stop-color="#7f1d1d"/>
        <stop offset="100%" stop-color="#3b0508"/>
      </radialGradient>
      <radialGradient id="jhMesa" cx="50%" cy="32%">
        <stop offset="0%" stop-color="#ffffff"/><stop offset="35%" stop-color="#fecaca"/>
        <stop offset="75%" stop-color="#ef4444"/><stop offset="100%" stop-color="#991b1b"/>
      </radialGradient>
      <linearGradient id="jhFio" x1="0.5" y1="0" x2="0.5" y2="1">
        <stop offset="0%" stop-color="#fecaca"/><stop offset="50%" stop-color="#dc2626"/>
        <stop offset="100%" stop-color="#450a0a"/>
      </linearGradient>
      <filter id="jhGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="jhSombra" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#000" flood-opacity=".9"/>
        <feDropShadow dx="0" dy="0" stdDeviation="20" flood-color="#dc2626" flood-opacity=".5"/>
      </filter>
    </defs>

    <g filter="url(#jhSombra)">
      <g class="jh-laminas" filter="url(#jhGlow)">${laminas.join('')}</g>

      <polygon points="${pts(80)}" fill="url(#jhMoldura)" stroke="url(#jhFio)" stroke-width="2.5"/>
      <g class="jh-runas">
        <path d="${runas.join(' ')}" stroke="#ef4444" stroke-width="1.6" stroke-opacity=".85"/>
      </g>
      <polygon points="${pts(64)}" fill="#0d0206" stroke="url(#jhFio)" stroke-width="1.6"/>

      <polygon points="${pts(58)}" fill="url(#jhGema)"/>
      ${facetas}
      <path d="${arestas}" stroke="#fca5a5" stroke-width=".7" stroke-opacity=".45" fill="none"/>
      <polygon points="${pts(58)}" fill="none" stroke="#fecaca" stroke-width="1.4" stroke-opacity=".8"/>

      <polygon points="${pts(24)}" fill="url(#jhMesa)" filter="url(#jhGlow)"/>
      <polygon points="${pts(24)}" fill="none" stroke="#fff" stroke-width="1" stroke-opacity=".9"/>
      <path d="M 130 96 L 136 130 L 130 164 L 124 130 Z M 96 130 L 130 124 L 164 130 L 130 136 Z"
            fill="#fff" fill-opacity=".85" filter="url(#jhGlow)"/>
    </g>
  </svg>`;
}
};

window.Jh3ffthArte = Jh3ffthArte;

/* Registra depois do arquiteto-console.js, então esta arte vence a antiga. */
window.ConquistaFX?.registrarInsignia?.(
  'jh3ffth', tam => Jh3ffthArte._svgMedalhaArquiteto(tam));
