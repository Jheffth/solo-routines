/* ══════════════════════════════════════════════════════════════
   Ascensão da Fênix V3 — insígnia
   GERADO por motors/forja com drawsvg + Jinja2.
   Não edite à mão: o próximo build sobrescreve.
   Fonte: motors/forja/pecas/fenix_v3.py
   ══════════════════════════════════════════════════════════════ */

const FenixV3FX = {
  _seq: 0,

  /* Cada chamada ganha um sufixo próprio para os ids internos.

     A Forja mostra a MESMA insígnia em três tamanhos no mesmo
     documento. Com ids fixos, os três SVGs declaram o mesmo id, o
     primeiro vence e os outros herdam o filtro errado — em silêncio.
     O `id_prefix` do drawsvg resolve na GERAÇÃO; este contador resolve
     em RUNTIME, que é onde o problema existe. */
  _svg(tam) {
    const u = 'ifenixv3fx' + (++this._seq);
    return `<svg class="conquista-svg" aria-hidden="true" focusable="false" style="display:block;overflow:hidden;width:${tam}px;height:${tam}px" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${tam}" height="${tam}" viewBox="0 0 300 300">
<style>/*<![CDATA[*/
    .fv3-roda-fundo { transform-origin: 150.0px 150.0px; animation: fv3-spin 35s linear infinite; }
    .fv3-cometa     { transform-origin: 150.0px 150.0px; animation: fv3-spin 3.2s linear infinite; }
    .fv3-coracao    { transform-origin: 150.0px 140.8px; animation: fv3-pulse 3s ease-in-out infinite; }
    
    .fv3-brasas g {
        transform-origin: 150.0px 144.2px;
        animation-name: fv3-crepitar;
        animation-timing-function: ease-in-out;
        animation-iteration-count: infinite;
        animation-direction: alternate;
    }

    @keyframes fv3-spin { 100% { transform: rotate(360deg); } }
    @keyframes fv3-pulse {
        0%, 100% { transform: scale(1); filter: brightness(1) drop-shadow(0 0 4px #fb923c); }
        50%      { transform: scale(1.08); filter: brightness(1.2) drop-shadow(0 0 10px #fff7ed); }
    }
    @keyframes fv3-crepitar {
        0%   { transform: scale(0.8) translate(0, 0); opacity: 0.6; }
        50%  { transform: scale(1.2) translate(0, -5px); opacity: 1; }
        100% { transform: scale(0.9) translate(0, -2px); opacity: 0.8; }
    }

    @media (prefers-reduced-motion: reduce) {
        .fv3-roda-fundo, .fv3-cometa, .fv3-coracao, .fv3-brasas g { animation: none !important; }
    }
    /*]]>*/</style>
<defs>
<linearGradient x1="0" y1="0" x2="300" y2="300" gradientUnits="userSpaceOnUse" id="${u}_asa_ext">
<stop offset="0.0" stop-color="#ffedd5" stop-opacity="1" />
<stop offset="0.3" stop-color="#f97316" stop-opacity="1" />
<stop offset="0.7" stop-color="#c2410c" stop-opacity="1" />
<stop offset="1.0" stop-color="#4a0404" stop-opacity="1" />
</linearGradient>
<linearGradient x1="0" y1="300" x2="300" y2="0" gradientUnits="userSpaceOnUse" id="${u}_asa_med">
<stop offset="0.0" stop-color="#fff7ed" stop-opacity="1" />
<stop offset="0.4" stop-color="#fb923c" stop-opacity="1" />
<stop offset="0.85" stop-color="#ea580c" stop-opacity="1" />
<stop offset="1.0" stop-color="#7c2d12" stop-opacity="1" />
</linearGradient>
<linearGradient x1="150.0" y1="0" x2="150.0" y2="300" gradientUnits="userSpaceOnUse" id="${u}_asa_int">
<stop offset="0.0" stop-color="#ffffff" stop-opacity="1" />
<stop offset="0.45" stop-color="#ffedd5" stop-opacity="1" />
<stop offset="0.85" stop-color="#f97316" stop-opacity="1" />
<stop offset="1.0" stop-color="#9a3412" stop-opacity="1" />
</linearGradient>
<linearGradient x1="150.0" y1="0" x2="150.0" y2="300" gradientUnits="userSpaceOnUse" id="${u}_cauda">
<stop offset="0.0" stop-color="#fb923c" stop-opacity="1" />
<stop offset="0.4" stop-color="#ea580c" stop-opacity="1" />
<stop offset="0.75" stop-color="#9a3412" stop-opacity="1" />
<stop offset="1.0" stop-color="#4a0404" stop-opacity="1" />
</linearGradient>
<linearGradient x1="0" y1="0" x2="0" y2="300" gradientUnits="userSpaceOnUse" id="${u}_peitoral">
<stop offset="0.0" stop-color="#ffedd5" stop-opacity="1" />
<stop offset="0.35" stop-color="#f97316" stop-opacity="1" />
<stop offset="0.75" stop-color="#9a3412" stop-opacity="1" />
<stop offset="1.0" stop-color="#3b0a00" stop-opacity="1" />
</linearGradient>
<radialGradient cx="150.0" cy="150.0" r="150.0" gradientUnits="userSpaceOnUse" id="${u}_gema">
<stop offset="0.0" stop-color="#ffffff" stop-opacity="1" />
<stop offset="0.3" stop-color="#ffedd5" stop-opacity="1" />
<stop offset="0.65" stop-color="#f97316" stop-opacity="1" />
<stop offset="1.0" stop-color="#9a3412" stop-opacity="1" />
</radialGradient>
<filter x="-40%" y="-40%" width="180%" height="180%" id="${u}_glow">
<feGaussianBlur stdDeviation="4.615384615384615" result="b"/><feComponentTransfer in="b" result="bb"><feFuncA type="linear" slope="1.3"/></feComponentTransfer><feMerge><feMergeNode in="bb"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter x="-40%" y="-40%" width="180%" height="180%" id="${u}_glow_forte">
<feGaussianBlur stdDeviation="9.23076923076923" result="b"/><feComponentTransfer in="b" result="bb"><feFuncA type="linear" slope="1.8"/></feComponentTransfer><feMerge><feMergeNode in="bb"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter x="-30%" y="-30%" width="160%" height="160%" id="${u}_sombra">
<feDropShadow dx="0" dy="6.9230769230769225" stdDeviation="13.846153846153845" flood-color="#ea580c" flood-opacity="0.6"></feDropShadow>
</filter>
</defs>
<g>
<circle cx="150.0" cy="150.0" r="113.1" fill="none" stroke="#7c2d12" stroke-width="2.3" stroke-opacity=".5" class="fv3-roda-fundo"/>
<circle cx="150.0" cy="150.0" r="99.2" fill="none" stroke="#ea580c" stroke-width="1.2" stroke-dasharray="6.9 6.9" stroke-opacity=".4" class="fv3-roda-fundo"/>
<g class="fv3-roda-fundo"><line x1="150.0" y1="48.5" x2="150.0" y2="39.2" stroke="#ea580c" stroke-width="2.1" stroke-opacity=".55" stroke-linecap="round"/><line x1="200.8" y1="62.1" x2="205.4" y2="54.1" stroke="#ea580c" stroke-width="2.1" stroke-opacity=".55" stroke-linecap="round"/><line x1="237.9" y1="99.2" x2="245.9" y2="94.6" stroke="#ea580c" stroke-width="2.1" stroke-opacity=".55" stroke-linecap="round"/><line x1="251.5" y1="150.0" x2="260.8" y2="150.0" stroke="#ea580c" stroke-width="2.1" stroke-opacity=".55" stroke-linecap="round"/><line x1="237.9" y1="200.8" x2="245.9" y2="205.4" stroke="#ea580c" stroke-width="2.1" stroke-opacity=".55" stroke-linecap="round"/><line x1="200.8" y1="237.9" x2="205.4" y2="245.9" stroke="#ea580c" stroke-width="2.1" stroke-opacity=".55" stroke-linecap="round"/><line x1="150.0" y1="251.5" x2="150.0" y2="260.8" stroke="#ea580c" stroke-width="2.1" stroke-opacity=".55" stroke-linecap="round"/><line x1="99.2" y1="237.9" x2="94.6" y2="245.9" stroke="#ea580c" stroke-width="2.1" stroke-opacity=".55" stroke-linecap="round"/><line x1="62.1" y1="200.8" x2="54.1" y2="205.4" stroke="#ea580c" stroke-width="2.1" stroke-opacity=".55" stroke-linecap="round"/><line x1="48.5" y1="150.0" x2="39.2" y2="150.0" stroke="#ea580c" stroke-width="2.1" stroke-opacity=".55" stroke-linecap="round"/><line x1="62.1" y1="99.2" x2="54.1" y2="94.6" stroke="#ea580c" stroke-width="2.1" stroke-opacity=".55" stroke-linecap="round"/><line x1="99.2" y1="62.1" x2="94.6" y2="54.1" stroke="#ea580c" stroke-width="2.1" stroke-opacity=".55" stroke-linecap="round"/></g>
<circle cx="150.0" cy="150.0" r="113.1" fill="none" stroke="#fff7ed" stroke-width="3.0" stroke-dasharray="69.2 634.6" stroke-linecap="round" filter="url(#${u}_glow)" class="fv3-cometa"/>
</g>
<g>
<path d="M 136.2,167.3 C 109.6,196.2 86.5,230.8 78.5,271.2 C 98.1,248.1 109.6,225.0 124.6,207.7 C 109.6,242.3 103.8,265.4 106.2,288.5 C 121.2,259.6 132.7,230.8 140.8,196.2 Z" fill="url(#${u}_cauda)" stroke="#ffedd5" stroke-width="1.4"/>
<path d="M 163.8,167.3 C 190.4,196.2 213.5,230.8 221.5,271.2 C 201.9,248.1 190.4,225.0 175.4,207.7 C 190.4,242.3 196.2,265.4 193.8,288.5 C 178.8,259.6 167.3,230.8 159.2,196.2 Z" fill="url(#${u}_cauda)" stroke="#ffedd5" stroke-width="1.4"/>
<path d="M 140.8,173.1 C 121.2,207.7 109.6,248.1 113.1,282.7 C 126.9,253.8 136.2,225.0 144.2,201.9 Z" fill="url(#${u}_asa_med)" stroke="#fff7ed" stroke-width="1.2"/>
<path d="M 159.2,173.1 C 178.8,207.7 190.4,248.1 186.9,282.7 C 173.1,253.8 163.8,225.0 155.8,201.9 Z" fill="url(#${u}_asa_med)" stroke="#fff7ed" stroke-width="1.2"/>
<path d="M 150.0,173.1 C 143.1,213.5 140.8,253.8 150.0,294.2 C 159.2,253.8 156.9,213.5 150.0,173.1 Z" fill="url(#${u}_asa_int)" stroke="#ffffff" stroke-width="1.7" filter="url(#${u}_glow)"/>
</g>
<g>
<path d="M 143.1,126.9 C 109.6,109.6 63.5,80.8 17.3,25.4 C 36.9,60.0 57.7,75.0 73.8,78.5 C 48.5,86.5 28.8,98.1 16.2,115.4 C 43.8,103.8 66.9,109.6 83.1,115.4 C 57.7,124.6 40.4,136.2 28.8,155.8 C 60.0,140.8 86.5,140.8 110.8,144.2 C 86.5,152.3 69.2,163.8 57.7,182.3 C 86.5,167.3 113.1,163.8 133.8,161.5 Z" fill="url(#${u}_asa_ext)" stroke="#ffedd5" stroke-width="1.6"/>
<path d="M 156.9,126.9 C 190.4,109.6 236.5,80.8 282.7,25.4 C 263.1,60.0 242.3,75.0 226.2,78.5 C 251.5,86.5 271.2,98.1 283.8,115.4 C 256.2,103.8 233.1,109.6 216.9,115.4 C 242.3,124.6 259.6,136.2 271.2,155.8 C 240.0,140.8 213.5,140.8 189.2,144.2 C 213.5,152.3 230.8,163.8 242.3,182.3 C 213.5,167.3 186.9,163.8 166.2,161.5 Z" fill="url(#${u}_asa_ext)" stroke="#ffedd5" stroke-width="1.6"/>
<path d="M 140.8,129.2 C 113.1,115.4 71.5,90.0 34.6,43.8 C 51.9,69.2 71.5,80.8 86.5,85.4 C 63.5,94.6 46.2,106.2 36.9,122.3 C 60.0,113.1 80.8,117.7 94.6,122.3 C 75.0,131.5 60.0,140.8 51.9,156.9 C 78.5,145.4 101.5,145.4 117.7,147.7 Z" fill="url(#${u}_asa_med)" stroke="#fff7ed" stroke-width="1.4" filter="url(#${u}_glow)"/>
<path d="M 159.2,129.2 C 186.9,115.4 228.5,90.0 265.4,43.8 C 248.1,69.2 228.5,80.8 213.5,85.4 C 236.5,94.6 253.8,106.2 263.1,122.3 C 240.0,113.1 219.2,117.7 205.4,122.3 C 225.0,131.5 240.0,140.8 248.1,156.9 C 221.5,145.4 198.5,145.4 182.3,147.7 Z" fill="url(#${u}_asa_med)" stroke="#fff7ed" stroke-width="1.4" filter="url(#${u}_glow)"/>
<path d="M 138.5,132.7 C 117.7,121.2 86.5,101.5 57.7,64.6 C 71.5,83.1 86.5,92.3 99.2,96.9 C 80.8,103.8 66.9,113.1 60.0,126.9 C 78.5,120.0 94.6,124.6 106.2,129.2 Z" fill="url(#${u}_asa_int)" stroke="#ffffff" stroke-width="1.2" filter="url(#${u}_glow)"/>
<path d="M 161.5,132.7 C 182.3,121.2 213.5,101.5 242.3,64.6 C 228.5,83.1 213.5,92.3 200.8,96.9 C 219.2,103.8 233.1,113.1 240.0,126.9 C 221.5,120.0 205.4,124.6 193.8,129.2 Z" fill="url(#${u}_asa_int)" stroke="#ffffff" stroke-width="1.2" filter="url(#${u}_glow)"/>
<path d="M 140.8,124.6 Q 92.3,92.3 25.4,32.3 M 132.7,132.7 Q 86.5,109.6 32.3,115.4 M 129.2,140.8 Q 92.3,138.5 40.4,154.6" fill="none" stroke="#fff7ed" stroke-width="1.5" stroke-opacity=".85" stroke-linecap="round"/>
<path d="M 159.2,124.6 Q 207.7,92.3 274.6,32.3 M 167.3,132.7 Q 213.5,109.6 267.7,115.4 M 170.8,140.8 Q 207.7,138.5 259.6,154.6" fill="none" stroke="#fff7ed" stroke-width="1.5" stroke-opacity=".85" stroke-linecap="round"/>
</g>
<g>
<path d="M 138.5,117.7 C 132.7,136.2 132.7,155.8 138.5,170.8 C 144.2,176.5 155.8,176.5 161.5,170.8 C 167.3,155.8 167.3,136.2 161.5,117.7 C 155.8,113.1 144.2,113.1 138.5,117.7 Z" fill="url(#${u}_peitoral)" stroke="#ffedd5" stroke-width="1.6"/>
<path d="M 140.8,120.0 C 136.2,101.5 140.8,83.1 150.0,71.5 C 156.9,80.8 161.5,99.2 159.2,120.0 Z" fill="url(#${u}_asa_med)" stroke="#fff7ed" stroke-width="1.2"/>
<path d="M 150.0,63.5 C 140.8,48.5 129.2,36.9 113.1,27.7 C 126.9,41.5 136.2,50.8 143.1,61.2 M 147.7,60.0 C 136.2,43.8 122.3,32.3 106.2,23.1 C 121.2,36.9 132.7,48.5 140.8,57.7 M 144.2,64.6 C 133.8,53.1 121.2,43.8 106.2,36.9 C 120.0,48.5 129.2,57.7 138.5,65.8 M 154.6,61.2 C 152.3,43.8 145.4,30.0 133.8,17.3 C 145.4,32.3 152.3,46.2 154.6,61.2 Z" fill="none" stroke="url(#${u}_asa_int)" stroke-width="3.7" stroke-linecap="round" filter="url(#${u}_glow_forte)"/>
<path d="M 150.0,63.5 C 140.8,48.5 129.2,36.9 113.1,27.7 C 126.9,41.5 136.2,50.8 143.1,61.2 M 147.7,60.0 C 136.2,43.8 122.3,32.3 106.2,23.1 C 121.2,36.9 132.7,48.5 140.8,57.7 M 144.2,64.6 C 133.8,53.1 121.2,43.8 106.2,36.9 C 120.0,48.5 129.2,57.7 138.5,65.8 M 154.6,61.2 C 152.3,43.8 145.4,30.0 133.8,17.3 C 145.4,32.3 152.3,46.2 154.6,61.2 Z" fill="none" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>
<path d="M 144.2,76.2 C 143.1,66.9 152.3,60.0 159.2,62.3 C 166.2,63.5 175.4,66.9 178.8,71.5 C 170.8,73.8 163.8,72.7 159.2,75.0 C 156.9,80.8 150.0,83.1 144.2,76.2 Z" fill="url(#${u}_asa_int)" stroke="#ffffff" stroke-width="1.4" filter="url(#${u}_glow)"/>
<circle cx="154.6" cy="68.7" r="2.5" fill="#ffffff" filter="url(#${u}_glow)"/>
<circle cx="155.2" cy="68.1" r="0.9" fill="#c2410c"/>
</g>
<g class="fv3-coracao">
<path d="M 150.0,124.6 L 159.2,133.8 L 159.2,147.7 L 150.0,156.9 L 140.8,147.7 L 140.8,133.8 Z" fill="url(#${u}_gema)" stroke="#ffffff" stroke-width="1.7"/>
<path d="M 150.0,124.6 L 159.2,133.8 L 150.0,140.8 L 140.8,133.8 Z" fill="#ffffff" opacity=".7"/>
<circle cx="150.0" cy="140.8" r="4.0" fill="#ffffff" filter="url(#${u}_glow_forte)"/>
</g>
<g class="fv3-brasas">
<g style="animation-delay:0.00s; animation-duration:2.20s"><circle cx="150.0" cy="69.2" r="1.8" fill="#fff7ed" opacity="0.95" filter="url(#${u}_glow)"/><circle cx="150.0" cy="69.2" r="3.3" fill="#f97316" opacity="0.475" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:0.18s; animation-duration:2.60s"><circle cx="184.8" cy="47.6" r="2.8" fill="#fff7ed" opacity="0.55" filter="url(#${u}_glow)"/><circle cx="184.8" cy="47.6" r="5.0" fill="#f97316" opacity="0.275" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:0.36s; animation-duration:3.00s"><circle cx="221.3" cy="58.0" r="3.7" fill="#fff7ed" opacity="0.75" filter="url(#${u}_glow)"/><circle cx="221.3" cy="58.0" r="6.6" fill="#f97316" opacity="0.375" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:0.54s; animation-duration:3.40s"><circle cx="236.7" cy="34.8" r="4.6" fill="#fff7ed" opacity="0.95" filter="url(#${u}_glow)"/><circle cx="236.7" cy="34.8" r="8.3" fill="#f97316" opacity="0.475" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:0.72s; animation-duration:2.20s"><circle cx="276.5" cy="65.8" r="1.8" fill="#fff7ed" opacity="0.75" filter="url(#${u}_glow)"/><circle cx="276.5" cy="65.8" r="3.3" fill="#f97316" opacity="0.375" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:0.90s; animation-duration:2.60s"><circle cx="232.4" cy="126.7" r="2.8" fill="#fff7ed" opacity="0.55" filter="url(#${u}_glow)"/><circle cx="232.4" cy="126.7" r="5.0" fill="#f97316" opacity="0.275" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:1.08s; animation-duration:3.00s"><circle cx="241.0" cy="122.9" r="3.7" fill="#fff7ed" opacity="0.95" filter="url(#${u}_glow)"/><circle cx="241.0" cy="122.9" r="6.6" fill="#f97316" opacity="0.475" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:1.26s; animation-duration:3.40s"><circle cx="270.4" cy="158.2" r="4.6" fill="#fff7ed" opacity="0.55" filter="url(#${u}_glow)"/><circle cx="270.4" cy="158.2" r="8.3" fill="#f97316" opacity="0.275" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:1.44s; animation-duration:2.20s"><circle cx="266.8" cy="202.2" r="1.8" fill="#fff7ed" opacity="0.75" filter="url(#${u}_glow)"/><circle cx="266.8" cy="202.2" r="3.3" fill="#f97316" opacity="0.375" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:1.62s; animation-duration:2.60s"><circle cx="293.0" cy="211.5" r="2.8" fill="#fff7ed" opacity="0.95" filter="url(#${u}_glow)"/><circle cx="293.0" cy="211.5" r="5.0" fill="#f97316" opacity="0.475" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:1.80s; animation-duration:3.00s"><circle cx="203.0" cy="197.3" r="3.7" fill="#fff7ed" opacity="0.75" filter="url(#${u}_glow)"/><circle cx="203.0" cy="197.3" r="6.6" fill="#f97316" opacity="0.375" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:1.98s; animation-duration:3.40s"><circle cx="193.7" cy="237.1" r="4.6" fill="#fff7ed" opacity="0.55" filter="url(#${u}_glow)"/><circle cx="193.7" cy="237.1" r="8.3" fill="#f97316" opacity="0.275" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:2.16s; animation-duration:2.20s"><circle cx="199.8" cy="244.5" r="1.8" fill="#fff7ed" opacity="0.95" filter="url(#${u}_glow)"/><circle cx="199.8" cy="244.5" r="3.3" fill="#f97316" opacity="0.475" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:2.34s; animation-duration:2.60s"><circle cx="166.0" cy="282.9" r="2.8" fill="#fff7ed" opacity="0.55" filter="url(#${u}_glow)"/><circle cx="166.0" cy="282.9" r="5.0" fill="#f97316" opacity="0.275" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:2.52s; animation-duration:3.00s"><circle cx="116.0" cy="289.1" r="3.7" fill="#fff7ed" opacity="0.75" filter="url(#${u}_glow)"/><circle cx="116.0" cy="289.1" r="6.6" fill="#f97316" opacity="0.375" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:2.70s; animation-duration:3.40s"><circle cx="132.5" cy="226.6" r="4.6" fill="#fff7ed" opacity="0.95" filter="url(#${u}_glow)"/><circle cx="132.5" cy="226.6" r="8.3" fill="#f97316" opacity="0.475" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:2.88s; animation-duration:2.20s"><circle cx="100.7" cy="223.7" r="1.8" fill="#fff7ed" opacity="0.75" filter="url(#${u}_glow)"/><circle cx="100.7" cy="223.7" r="3.3" fill="#f97316" opacity="0.375" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:3.06s; animation-duration:2.60s"><circle cx="55.1" cy="219.5" r="2.8" fill="#fff7ed" opacity="0.55" filter="url(#${u}_glow)"/><circle cx="55.1" cy="219.5" r="5.0" fill="#f97316" opacity="0.275" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:3.24s; animation-duration:3.00s"><circle cx="49.5" cy="227.3" r="3.7" fill="#fff7ed" opacity="0.95" filter="url(#${u}_glow)"/><circle cx="49.5" cy="227.3" r="6.6" fill="#f97316" opacity="0.475" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:3.42s; animation-duration:3.40s"><circle cx="1.3" cy="197.8" r="4.6" fill="#fff7ed" opacity="0.55" filter="url(#${u}_glow)"/><circle cx="1.3" cy="197.8" r="8.3" fill="#f97316" opacity="0.275" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:3.60s; animation-duration:2.20s"><circle cx="75.0" cy="144.2" r="1.8" fill="#fff7ed" opacity="0.75" filter="url(#${u}_glow)"/><circle cx="75.0" cy="144.2" r="3.3" fill="#f97316" opacity="0.375" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:3.78s; animation-duration:2.60s"><circle cx="47.3" cy="146.4" r="2.8" fill="#fff7ed" opacity="0.95" filter="url(#${u}_glow)"/><circle cx="47.3" cy="146.4" r="5.0" fill="#f97316" opacity="0.475" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:3.96s; animation-duration:3.00s"><circle cx="43.9" cy="108.5" r="3.7" fill="#fff7ed" opacity="0.75" filter="url(#${u}_glow)"/><circle cx="43.9" cy="108.5" r="6.6" fill="#f97316" opacity="0.375" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:4.14s; animation-duration:3.40s"><circle cx="40.6" cy="57.5" r="4.6" fill="#fff7ed" opacity="0.55" filter="url(#${u}_glow)"/><circle cx="40.6" cy="57.5" r="8.3" fill="#f97316" opacity="0.275" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:4.32s; animation-duration:2.20s"><circle cx="31.4" cy="54.2" r="1.8" fill="#fff7ed" opacity="0.95" filter="url(#${u}_glow)"/><circle cx="31.4" cy="54.2" r="3.3" fill="#f97316" opacity="0.475" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:4.50s; animation-duration:2.60s"><circle cx="104.1" cy="73.6" r="2.8" fill="#fff7ed" opacity="0.55" filter="url(#${u}_glow)"/><circle cx="104.1" cy="73.6" r="5.0" fill="#f97316" opacity="0.275" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:4.68s; animation-duration:3.00s"><circle cx="128.7" cy="53.2" r="3.7" fill="#fff7ed" opacity="0.75" filter="url(#${u}_glow)"/><circle cx="128.7" cy="53.2" r="6.6" fill="#f97316" opacity="0.375" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:4.86s; animation-duration:3.40s"><circle cx="119.9" cy="26.9" r="4.6" fill="#fff7ed" opacity="0.95" filter="url(#${u}_glow)"/><circle cx="119.9" cy="26.9" r="8.3" fill="#f97316" opacity="0.475" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:5.04s; animation-duration:2.20s"><circle cx="162.3" cy="14.4" r="1.8" fill="#fff7ed" opacity="0.75" filter="url(#${u}_glow)"/><circle cx="162.3" cy="14.4" r="3.3" fill="#f97316" opacity="0.375" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:5.22s; animation-duration:2.60s"><circle cx="217.3" cy="1.2" r="2.8" fill="#fff7ed" opacity="0.55" filter="url(#${u}_glow)"/><circle cx="217.3" cy="1.2" r="5.0" fill="#f97316" opacity="0.275" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:5.40s; animation-duration:3.00s"><circle cx="180.5" cy="75.7" r="3.7" fill="#fff7ed" opacity="0.95" filter="url(#${u}_glow)"/><circle cx="180.5" cy="75.7" r="6.6" fill="#f97316" opacity="0.475" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:5.58s; animation-duration:3.40s"><circle cx="221.1" cy="70.1" r="4.6" fill="#fff7ed" opacity="0.55" filter="url(#${u}_glow)"/><circle cx="221.1" cy="70.1" r="8.3" fill="#f97316" opacity="0.275" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:5.76s; animation-duration:2.20s"><circle cx="250.3" cy="94.5" r="1.8" fill="#fff7ed" opacity="0.75" filter="url(#${u}_glow)"/><circle cx="250.3" cy="94.5" r="3.3" fill="#f97316" opacity="0.375" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:5.94s; animation-duration:2.60s"><circle cx="273.7" cy="79.5" r="2.8" fill="#fff7ed" opacity="0.95" filter="url(#${u}_glow)"/><circle cx="273.7" cy="79.5" r="5.0" fill="#f97316" opacity="0.475" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:6.12s; animation-duration:3.00s"><circle cx="297.5" cy="124.0" r="3.7" fill="#fff7ed" opacity="0.75" filter="url(#${u}_glow)"/><circle cx="297.5" cy="124.0" r="6.6" fill="#f97316" opacity="0.375" filter="url(#${u}_glow_forte)"/></g>
</g>
</svg>`;
  },

  /* A cerimônia delega ao renderizador único do projeto. */
  celebrar() {
    if (typeof ConquistaFX === 'undefined') return;
    ConquistaFX.show({
      codigo: 'fenix_v3', titulo: 'Ascensão da Fênix V3',
      descricao: 'Forjada no calor de uma Supernova. A entidade de fogo geométrico absoluto.',
      icone: '🔥', cor: '#fb8500',
      xp_bonus: 9999, moedas_bonus: 999,
    });
  },
};

window.FenixV3FX = FenixV3FX;

/* Optional chaining nos DOIS pontos: este arquivo pode carregar antes
   do conquista-fx.js, e um erro aqui derrubaria o resto do script. */
window.ConquistaFX?.registrarInsignia?.('fenix_v3', tam => FenixV3FX._svg(tam));
