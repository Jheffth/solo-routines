/* ══════════════════════════════════════════════════════════════
   Lobo Lunar — Alfa da Alcateia — insígnia
   GERADO por motors/forja com drawsvg + Jinja2.
   Não edite à mão: o próximo build sobrescreve.
   Fonte: motors/forja/pecas/lobo_lunar.py
   ══════════════════════════════════════════════════════════════ */

const LoboLunarFX = {
  _seq: 0,

  /* Cada chamada ganha um sufixo próprio para os ids internos.

     A Forja mostra a MESMA insígnia em três tamanhos no mesmo
     documento. Com ids fixos, os três SVGs declaram o mesmo id, o
     primeiro vence e os outros herdam o filtro errado — em silêncio.
     O `id_prefix` do drawsvg resolve na GERAÇÃO; este contador resolve
     em RUNTIME, que é onde o problema existe. */
  _svg(tam) {
    const u = 'ilobolunarfx' + (++this._seq);
    return `<svg class="conquista-svg" aria-hidden="true" focusable="false" style="display:block;overflow:hidden;width:${tam}px;height:${tam}px" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${tam}" height="${tam}" viewBox="0 0 300 300">
<style>/*<![CDATA[*/
    .ll-lua {
        transform-origin: 220.0px 60.0px;
        animation: ll-pulso-lunar 4s ease-in-out infinite;
    }
    @keyframes ll-pulso-lunar {
        0%, 100% { opacity: .7; transform: scale(1); }
        50%      { opacity: 1; transform: scale(1.06); }
    }

    .ll-aro {
        transform-origin: 150.0px 150.0px;
        animation: ll-girar 40s linear infinite;
    }
    .ll-aro-lento {
        transform-origin: 150.0px 150.0px;
        animation: ll-girar 60s linear infinite reverse;
    }
    @keyframes ll-girar {
        100% { transform: rotate(360deg); }
    }

    .ll-marca {
        transform-origin: 148.0px 78.0px;
        animation: ll-pulso-marca 3s ease-in-out infinite;
    }
    @keyframes ll-pulso-marca {
        0%, 100% { opacity: .7; transform: scale(1); }
        50%      { opacity: 1; transform: scale(1.15); }
    }

    .ll-particulas g {
        transform-origin: 150.0px 150.0px;
        animation-name: ll-flutuar;
        animation-timing-function: ease-in-out;
        animation-iteration-count: infinite;
        animation-direction: alternate;
    }
    @keyframes ll-flutuar {
        0%   { transform: scale(0.7) translate(0, 0); opacity: 0.5; }
        50%  { transform: scale(1.1) translate(0, -6px); opacity: 1; }
        100% { transform: scale(0.85) translate(0, -3px); opacity: 0.7; }
    }

    .ll-estrelas g {
        transform-origin: 150.0px 150.0px;
        animation: ll-piscar 2.5s ease-in-out infinite alternate;
    }
    @keyframes ll-piscar {
        0%   { opacity: .3; transform: scale(0.7); }
        100% { opacity: .9; transform: scale(1.2); }
    }

    @media (prefers-reduced-motion: reduce) {
        .ll-lua, .ll-aro, .ll-aro-lento, .ll-marca,
        .ll-particulas g, .ll-estrelas g
        { animation: none !important; }
    }
    /*]]>*/</style>
<defs>
<linearGradient x1="0" y1="0" x2="0" y2="300" gradientUnits="userSpaceOnUse" id="${u}_corpo">
<stop offset="0.0" stop-color="#f0f4ff" stop-opacity="1" />
<stop offset="0.35" stop-color="#b8c7e8" stop-opacity="1" />
<stop offset="0.7" stop-color="#5b7fbf" stop-opacity="1" />
<stop offset="1.0" stop-color="#1a1f3a" stop-opacity="1" />
</linearGradient>
<linearGradient x1="150.0" y1="0" x2="150.0" y2="300" gradientUnits="userSpaceOnUse" id="${u}_cabeca">
<stop offset="0.0" stop-color="#f0f4ff" stop-opacity="1" />
<stop offset="0.5" stop-color="#b8c7e8" stop-opacity="1" />
<stop offset="1.0" stop-color="#5b7fbf" stop-opacity="1" />
</linearGradient>
<linearGradient x1="300" y1="0" x2="0" y2="300" gradientUnits="userSpaceOnUse" id="${u}_focinho">
<stop offset="0.0" stop-color="#ffffff" stop-opacity="1" />
<stop offset="0.4" stop-color="#b8c7e8" stop-opacity="1" />
<stop offset="1.0" stop-color="#5b7fbf" stop-opacity="1" />
</linearGradient>
<linearGradient x1="0" y1="0" x2="300" y2="300" gradientUnits="userSpaceOnUse" id="${u}_cauda">
<stop offset="0.0" stop-color="#f0f4ff" stop-opacity="1" />
<stop offset="0.5" stop-color="#b8c7e8" stop-opacity="1" />
<stop offset="1.0" stop-color="#1a1f3a" stop-opacity="1" />
</linearGradient>
<linearGradient x1="0" y1="300" x2="300" y2="0" gradientUnits="userSpaceOnUse" id="${u}_crina">
<stop offset="0.0" stop-color="#1a1f3a" stop-opacity="1" />
<stop offset="0.6" stop-color="#5b7fbf" stop-opacity="1" />
<stop offset="1.0" stop-color="#b8c7e8" stop-opacity="1" />
</linearGradient>
<radialGradient cx="150.0" cy="150.0" r="150.0" gradientUnits="userSpaceOnUse" id="${u}_olho">
<stop offset="0.0" stop-color="#ffffff" stop-opacity="1" />
<stop offset="0.3" stop-color="#7ec8e3" stop-opacity="1" />
<stop offset="0.7" stop-color="#5b7fbf" stop-opacity="1" />
<stop offset="1.0" stop-color="#1a1f3a" stop-opacity="1" />
</radialGradient>
<radialGradient cx="150.0" cy="150.0" r="150.0" gradientUnits="userSpaceOnUse" id="${u}_lua">
<stop offset="0.0" stop-color="#ffffff" stop-opacity="0.9" />
<stop offset="0.3" stop-color="#b8c7e8" stop-opacity="0.5" />
<stop offset="0.7" stop-color="#5b7fbf" stop-opacity="0.1" />
<stop offset="1.0" stop-color="#1a1f3a" stop-opacity="0" />
</radialGradient>
<radialGradient cx="150.0" cy="150.0" r="150.0" gradientUnits="userSpaceOnUse" id="${u}_marca">
<stop offset="0.0" stop-color="#7ec8e3" stop-opacity="1" />
<stop offset="0.5" stop-color="#5b7fbf" stop-opacity="0.8" />
<stop offset="1.0" stop-color="#1a1f3a" stop-opacity="0.3" />
</radialGradient>
<filter x="-40%" y="-40%" width="180%" height="180%" id="${u}_glow">
<feGaussianBlur stdDeviation="3.0" result="b"/><feComponentTransfer in="b" result="bb"><feFuncA type="linear" slope="1.3"/></feComponentTransfer><feMerge><feMergeNode in="bb"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter x="-40%" y="-40%" width="180%" height="180%" id="${u}_glow_forte">
<feGaussianBlur stdDeviation="6.0" result="b"/><feComponentTransfer in="b" result="bb"><feFuncA type="linear" slope="1.6"/></feComponentTransfer><feMerge><feMergeNode in="bb"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter x="-40%" y="-40%" width="180%" height="180%" id="${u}_glow_lunar">
<feGaussianBlur stdDeviation="10.0" result="b"/><feComponentTransfer in="b" result="bb"><feFuncA type="linear" slope="1.2"/></feComponentTransfer><feMerge><feMergeNode in="bb"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter x="-30%" y="-30%" width="160%" height="160%" id="${u}_sombra">
<feDropShadow dx="0" dy="4.0" stdDeviation="10.0" flood-color="#1a1f3a" flood-opacity="0.5"></feDropShadow>
</filter>
</defs>
<g>
<circle cx="220.0" cy="60.0" r="65.0" fill="url(#${u}_lua)" class="ll-lua"/>
<circle cx="220.0" cy="60.0" r="68.0" fill="none" stroke="#b8c7e8" stroke-width="0.8" stroke-opacity=".4" stroke-dasharray="8.0 4.0"/>
</g>
<g>
<circle cx="150.0" cy="150.0" r="130.0" fill="none" stroke="#5b7fbf" stroke-width="1.2" stroke-opacity=".3" class="ll-aro"/>
<circle cx="150.0" cy="150.0" r="138.0" fill="none" stroke="#b8c7e8" stroke-width="0.5" stroke-opacity=".2" stroke-dasharray="3.0 12.0" class="ll-aro-lento"/>
<g class="ll-aro"><line x1="150.0" y1="25.0" x2="150.0" y2="16.0" stroke="#7ec8e3" stroke-width="1.5" stroke-opacity=".5" stroke-linecap="round"/><line x1="238.4" y1="61.6" x2="244.8" y2="55.2" stroke="#7ec8e3" stroke-width="1.5" stroke-opacity=".5" stroke-linecap="round"/><line x1="275.0" y1="150.0" x2="284.0" y2="150.0" stroke="#7ec8e3" stroke-width="1.5" stroke-opacity=".5" stroke-linecap="round"/><line x1="238.4" y1="238.4" x2="244.8" y2="244.8" stroke="#7ec8e3" stroke-width="1.5" stroke-opacity=".5" stroke-linecap="round"/><line x1="150.0" y1="275.0" x2="150.0" y2="284.0" stroke="#7ec8e3" stroke-width="1.5" stroke-opacity=".5" stroke-linecap="round"/><line x1="61.6" y1="238.4" x2="55.2" y2="244.8" stroke="#7ec8e3" stroke-width="1.5" stroke-opacity=".5" stroke-linecap="round"/><line x1="25.0" y1="150.0" x2="16.0" y2="150.0" stroke="#7ec8e3" stroke-width="1.5" stroke-opacity=".5" stroke-linecap="round"/><line x1="61.6" y1="61.6" x2="55.2" y2="55.2" stroke="#7ec8e3" stroke-width="1.5" stroke-opacity=".5" stroke-linecap="round"/></g>
</g>
<g>
<path d="M 148.0,260.0 C 140.0,270.0 125.0,275.0 110.0,268.0 C 95.0,260.0 82.0,245.0 78.0,230.0 C 75.0,218.0 80.0,210.0 88.0,212.0 C 96.0,215.0 98.0,225.0 100.0,235.0 C 105.0,248.0 115.0,258.0 130.0,260.0 C 140.0,262.0 145.0,262.0 148.0,260.0 Z" fill="url(#${u}_cauda)" stroke="#b8c7e8" stroke-width="0.8" stroke-opacity=".6"/>
<path d="M 110.0,268.0 C 100.0,260.0 88.0,248.0 82.0,235.0 C 80.0,228.0 84.0,222.0 90.0,224.0 C 95.0,228.0 98.0,235.0 100.0,242.0 C 106.0,252.0 118.0,260.0 130.0,262.0 Z" fill="url(#${u}_crina)" stroke="none" opacity=".7"/>
</g>
<g>
<path d="M 120.0,120.0 C 108.0,125.0 95.0,140.0 88.0,158.0 C 92.0,148.0 100.0,138.0 112.0,130.0 C 108.0,142.0 105.0,155.0 108.0,168.0 C 112.0,155.0 118.0,142.0 125.0,128.0 Z" fill="url(#${u}_crina)" stroke="#b8c7e8" stroke-width="0.6" stroke-opacity=".4"/>
<path d="M 168.0,115.0 C 178.0,118.0 190.0,130.0 195.0,148.0 C 190.0,138.0 182.0,128.0 172.0,122.0 C 176.0,134.0 178.0,148.0 175.0,160.0 C 170.0,148.0 165.0,132.0 168.0,115.0 Z" fill="url(#${u}_crina)" stroke="#b8c7e8" stroke-width="0.6" stroke-opacity=".4"/>
</g>
<g>
<path d="M 135.0,150.0 C 130.0,165.0 120.0,185.0 115.0,210.0 C 130.0,200.0 148.0,195.0 150.0,210.0 C 152.0,225.0 150.0,248.0 148.0,265.0 C 155.0,260.0 165.0,258.0 175.0,260.0 C 180.0,250.0 185.0,235.0 182.0,215.0 C 180.0,200.0 175.0,185.0 170.0,165.0 C 165.0,152.0 150.0,148.0 135.0,150.0 Z" fill="url(#${u}_corpo)" stroke="#b8c7e8" stroke-width="1.0" stroke-opacity=".5"/>
<path d="M 145.0,165.0 C 138.0,180.0 130.0,200.0 125.0,220.0 C 135.0,208.0 148.0,200.0 150.0,210.0 C 155.0,200.0 168.0,208.0 178.0,220.0 C 173.0,200.0 165.0,180.0 158.0,165.0 Z" fill="url(#${u}_crina)" stroke="none" opacity=".5"/>
<path d="M 125.0,200.0 C 118.0,220.0 110.0,245.0 108.0,268.0 C 106.0,280.0 108.0,288.0 112.0,290.0 C 118.0,292.0 122.0,285.0 122.0,275.0 C 122.0,260.0 120.0,240.0 125.0,220.0 C 128.0,210.0 130.0,200.0 125.0,200.0 Z" fill="url(#${u}_corpo)" stroke="#b8c7e8" stroke-width="0.8" stroke-opacity=".4"/>
<path d="M 172.0,200.0 C 178.0,220.0 185.0,245.0 188.0,268.0 C 190.0,280.0 188.0,288.0 184.0,290.0 C 178.0,292.0 174.0,285.0 174.0,275.0 C 174.0,260.0 176.0,240.0 172.0,220.0 C 168.0,210.0 166.0,200.0 172.0,200.0 Z" fill="url(#${u}_corpo)" stroke="#b8c7e8" stroke-width="0.8" stroke-opacity=".4"/>
</g>
<g>
<path d="M 115.0,78.0 C 110.0,58.0 100.0,38.0 88.0,25.0 C 95.0,40.0 100.0,55.0 105.0,70.0 C 108.0,78.0 112.0,82.0 115.0,78.0 Z" fill="url(#${u}_crina)" stroke="#b8c7e8" stroke-width="0.6"/>
<path d="M 175.0,72.0 C 182.0,52.0 192.0,32.0 205.0,20.0 C 198.0,36.0 192.0,52.0 185.0,68.0 C 182.0,74.0 178.0,76.0 175.0,72.0 Z" fill="url(#${u}_crina)" stroke="#b8c7e8" stroke-width="0.6"/>
<path d="M 110.0,100.0 C 110.0,82.0 118.0,68.0 130.0,62.0 C 142.0,56.0 158.0,56.0 170.0,62.0 C 182.0,68.0 190.0,82.0 190.0,100.0 C 190.0,112.0 185.0,120.0 175.0,128.0 C 165.0,136.0 155.0,142.0 150.0,148.0 C 145.0,154.0 140.0,160.0 135.0,160.0 C 130.0,160.0 120.0,155.0 112.0,148.0 C 104.0,140.0 110.0,112.0 110.0,100.0 Z" fill="url(#${u}_cabeca)" stroke="#b8c7e8" stroke-width="1.0" stroke-opacity=".6"/>
</g>
<g>
<path d="M 160.0,90.0 C 175.0,88.0 195.0,92.0 208.0,100.0 C 215.0,105.0 218.0,112.0 215.0,118.0 C 210.0,126.0 195.0,128.0 180.0,126.0 C 175.0,125.0 170.0,122.0 168.0,118.0 C 165.0,112.0 162.0,100.0 160.0,90.0 Z" fill="url(#${u}_focinho)" stroke="#b8c7e8" stroke-width="0.7"/>
<path d="M 160.0,108.0 C 170.0,106.0 185.0,108.0 195.0,112.0" fill="none" stroke="#5b7fbf" stroke-width="0.6" stroke-opacity=".5" stroke-linecap="round"/>
</g>
<g>
<path d="M 108.0,280.0 L 104.0,292.0 L 112.0,288.0 Z" fill="#7ec8e3" stroke="#ffffff" stroke-width="0.3" opacity=".8"/>
<path d="M 110.0,282.0 L 106.0,294.0 L 114.0,290.0 Z" fill="#7ec8e3" stroke="#ffffff" stroke-width="0.3" opacity=".8"/>
<path d="M 112.0,284.0 L 108.0,296.0 L 116.0,292.0 Z" fill="#7ec8e3" stroke="#ffffff" stroke-width="0.3" opacity=".8"/>
<path d="M 188.0,280.0 L 192.0,292.0 L 184.0,288.0 Z" fill="#7ec8e3" stroke="#ffffff" stroke-width="0.3" opacity=".8"/>
<path d="M 186.0,282.0 L 190.0,294.0 L 182.0,290.0 Z" fill="#7ec8e3" stroke="#ffffff" stroke-width="0.3" opacity=".8"/>
<path d="M 184.0,284.0 L 188.0,296.0 L 180.0,292.0 Z" fill="#7ec8e3" stroke="#ffffff" stroke-width="0.3" opacity=".8"/>
</g>
<g>
<path d="M 210.0,102.0 C 215.0,99.0 220.0,100.0 222.0,105.0 C 224.0,110.0 220.0,116.0 215.0,118.0 C 212.0,118.0 208.0,116.0 208.0,112.0 C 207.0,107.0 208.0,103.0 210.0,102.0 Z" fill="#1a1f3a" stroke="#7ec8e3" stroke-width="0.8"/>
<circle cx="214.0" cy="107.0" r="1.5" fill="#7ec8e3" opacity=".6"/>
</g>
<g>
<path d="M 128.0,95.0 C 132.0,90.0 140.0,88.0 146.0,90.0 C 150.0,92.0 150.0,96.0 146.0,98.0 C 140.0,100.0 132.0,98.0 128.0,95.0 Z" fill="url(#${u}_olho)" stroke="#7ec8e3" stroke-width="1.0"/>
<path d="M 170.0,90.0 C 174.0,85.0 182.0,83.0 188.0,85.0 C 192.0,87.0 192.0,91.0 188.0,93.0 C 182.0,95.0 174.0,93.0 170.0,90.0 Z" fill="url(#${u}_olho)" stroke="#7ec8e3" stroke-width="1.0"/>
<path d="M 134.0,93.0 C 137.0,91.0 141.0,91.0 143.0,93.0 C 143.0,95.0 140.0,96.0 137.0,95.0 Z" fill="#ffffff" filter="url(#${u}_glow_forte)"/>
<path d="M 176.0,88.0 C 179.0,86.0 183.0,86.0 185.0,88.0 C 185.0,90.0 182.0,91.0 179.0,90.0 Z" fill="#ffffff" filter="url(#${u}_glow_forte)"/>
</g>
<g class="ll-marca">
<path d="M 148.0,72.0 L 155.0,78.0 L 148.0,84.0 L 141.0,78.0 Z" fill="url(#${u}_marca)" stroke="#7ec8e3" stroke-width="0.8"/>
<line x1="148.0" y1="72.0" x2="148.0" y2="84.0" stroke="#ffffff" stroke-width="0.4" opacity=".6"/>
<line x1="141.0" y1="78.0" x2="155.0" y2="78.0" stroke="#ffffff" stroke-width="0.4" opacity=".6"/>
</g>
<g class="ll-particulas">
<g style="animation-delay:0.00s; animation-duration:2.50s"><circle cx="150.0" cy="95.0" r="1.2" fill="#f0f4ff" opacity="0.9" filter="url(#${u}_glow)"/><circle cx="150.0" cy="95.0" r="1.9" fill="#7ec8e3" opacity="0.36000000000000004" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:0.22s; animation-duration:3.00s"><circle cx="184.7" cy="74.6" r="2.0" fill="#f0f4ff" opacity="0.4" filter="url(#${u}_glow)"/><circle cx="184.7" cy="74.6" r="3.2" fill="#7ec8e3" opacity="0.16000000000000003" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:0.44s; animation-duration:3.50s"><circle cx="234.3" cy="77.8" r="2.8" fill="#f0f4ff" opacity="0.65" filter="url(#${u}_glow)"/><circle cx="234.3" cy="77.8" r="4.5" fill="#7ec8e3" opacity="0.26" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:0.66s; animation-duration:4.00s"><circle cx="260.6" cy="118.5" r="3.6" fill="#f0f4ff" opacity="0.9" filter="url(#${u}_glow)"/><circle cx="260.6" cy="118.5" r="5.8" fill="#7ec8e3" opacity="0.36000000000000004" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:0.88s; animation-duration:4.50s"><circle cx="212.3" cy="159.6" r="4.4" fill="#f0f4ff" opacity="0.65" filter="url(#${u}_glow)"/><circle cx="212.3" cy="159.6" r="7.0" fill="#7ec8e3" opacity="0.26" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:1.10s; animation-duration:2.50s"><circle cx="234.7" cy="116.6" r="1.2" fill="#f0f4ff" opacity="0.4" filter="url(#${u}_glow)"/><circle cx="234.7" cy="116.6" r="1.9" fill="#7ec8e3" opacity="0.16000000000000003" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:1.32s; animation-duration:3.00s"><circle cx="244.9" cy="155.3" r="2.0" fill="#f0f4ff" opacity="0.9" filter="url(#${u}_glow)"/><circle cx="244.9" cy="155.3" r="3.2" fill="#7ec8e3" opacity="0.36000000000000004" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:1.54s; animation-duration:3.50s"><circle cx="258.7" cy="207.6" r="2.8" fill="#f0f4ff" opacity="0.4" filter="url(#${u}_glow)"/><circle cx="258.7" cy="207.6" r="4.5" fill="#7ec8e3" opacity="0.16000000000000003" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:1.76s; animation-duration:4.00s"><circle cx="193.1" cy="206.4" r="3.6" fill="#f0f4ff" opacity="0.65" filter="url(#${u}_glow)"/><circle cx="193.1" cy="206.4" r="5.8" fill="#7ec8e3" opacity="0.26" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:1.98s; animation-duration:4.50s"><circle cx="166.5" cy="223.2" r="4.4" fill="#f0f4ff" opacity="0.9" filter="url(#${u}_glow)"/><circle cx="166.5" cy="223.2" r="7.0" fill="#7ec8e3" opacity="0.36000000000000004" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:2.20s; animation-duration:2.50s"><circle cx="220.2" cy="225.3" r="1.2" fill="#f0f4ff" opacity="0.65" filter="url(#${u}_glow)"/><circle cx="220.2" cy="225.3" r="1.9" fill="#7ec8e3" opacity="0.26" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:2.42s; animation-duration:3.00s"><circle cx="191.1" cy="274.4" r="2.0" fill="#f0f4ff" opacity="0.4" filter="url(#${u}_glow)"/><circle cx="191.1" cy="274.4" r="3.2" fill="#7ec8e3" opacity="0.16000000000000003" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:2.64s; animation-duration:3.50s"><circle cx="143.9" cy="204.7" r="2.8" fill="#f0f4ff" opacity="0.9" filter="url(#${u}_glow)"/><circle cx="143.9" cy="204.7" r="4.5" fill="#7ec8e3" opacity="0.36000000000000004" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:2.86s; animation-duration:4.00s"><circle cx="107.1" cy="221.1" r="3.6" fill="#f0f4ff" opacity="0.4" filter="url(#${u}_glow)"/><circle cx="107.1" cy="221.1" r="5.8" fill="#7ec8e3" opacity="0.16000000000000003" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:3.08s; animation-duration:4.50s"><circle cx="58.2" cy="212.4" r="4.4" fill="#f0f4ff" opacity="0.65" filter="url(#${u}_glow)"/><circle cx="58.2" cy="212.4" r="7.0" fill="#7ec8e3" opacity="0.26" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:3.30s; animation-duration:2.50s"><circle cx="100.5" cy="253.8" r="1.2" fill="#f0f4ff" opacity="0.9" filter="url(#${u}_glow)"/><circle cx="100.5" cy="253.8" r="1.9" fill="#7ec8e3" opacity="0.36000000000000004" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:3.52s; animation-duration:3.00s"><circle cx="101.6" cy="190.3" r="2.0" fill="#f0f4ff" opacity="0.65" filter="url(#${u}_glow)"/><circle cx="101.6" cy="190.3" r="3.2" fill="#7ec8e3" opacity="0.26" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:3.74s; animation-duration:3.50s"><circle cx="62.1" cy="173.7" r="2.8" fill="#f0f4ff" opacity="0.4" filter="url(#${u}_glow)"/><circle cx="62.1" cy="173.7" r="4.5" fill="#7ec8e3" opacity="0.16000000000000003" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:3.96s; animation-duration:4.00s"><circle cx="56.3" cy="134.2" r="3.6" fill="#f0f4ff" opacity="0.9" filter="url(#${u}_glow)"/><circle cx="56.3" cy="134.2" r="5.8" fill="#7ec8e3" opacity="0.36000000000000004" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:4.18s; animation-duration:4.50s"><circle cx="48.4" cy="80.7" r="4.4" fill="#f0f4ff" opacity="0.4" filter="url(#${u}_glow)"/><circle cx="48.4" cy="80.7" r="7.0" fill="#7ec8e3" opacity="0.16000000000000003" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:4.40s; animation-duration:2.50s"><circle cx="79.2" cy="145.0" r="1.2" fill="#f0f4ff" opacity="0.65" filter="url(#${u}_glow)"/><circle cx="79.2" cy="145.0" r="1.9" fill="#7ec8e3" opacity="0.26" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:4.62s; animation-duration:3.00s"><circle cx="84.2" cy="114.0" r="2.0" fill="#f0f4ff" opacity="0.9" filter="url(#${u}_glow)"/><circle cx="84.2" cy="114.0" r="3.2" fill="#7ec8e3" opacity="0.36000000000000004" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:4.84s; animation-duration:3.50s"><circle cx="88.6" cy="67.3" r="2.8" fill="#f0f4ff" opacity="0.65" filter="url(#${u}_glow)"/><circle cx="88.6" cy="67.3" r="4.5" fill="#7ec8e3" opacity="0.26" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:5.06s; animation-duration:4.00s"><circle cx="123.0" cy="21.8" r="3.6" fill="#f0f4ff" opacity="0.4" filter="url(#${u}_glow)"/><circle cx="123.0" cy="21.8" r="5.8" fill="#7ec8e3" opacity="0.16000000000000003" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:5.28s; animation-duration:4.50s"><circle cx="162.2" cy="96.4" r="4.4" fill="#f0f4ff" opacity="0.9" filter="url(#${u}_glow)"/><circle cx="162.2" cy="96.4" r="7.0" fill="#7ec8e3" opacity="0.36000000000000004" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:5.50s; animation-duration:2.50s"><circle cx="125.0" cy="70.8" r="1.2" fill="#f0f4ff" opacity="0.4" filter="url(#${u}_glow)"/><circle cx="125.0" cy="70.8" r="1.9" fill="#7ec8e3" opacity="0.16000000000000003" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:5.72s; animation-duration:3.00s"><circle cx="163.9" cy="39.9" r="2.0" fill="#f0f4ff" opacity="0.65" filter="url(#${u}_glow)"/><circle cx="163.9" cy="39.9" r="3.2" fill="#7ec8e3" opacity="0.26" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:5.94s; animation-duration:3.50s"><circle cx="210.8" cy="52.4" r="2.8" fill="#f0f4ff" opacity="0.9" filter="url(#${u}_glow)"/><circle cx="210.8" cy="52.4" r="4.5" fill="#7ec8e3" opacity="0.36000000000000004" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:6.16s; animation-duration:4.00s"><circle cx="202.6" cy="115.3" r="3.6" fill="#f0f4ff" opacity="0.65" filter="url(#${u}_glow)"/><circle cx="202.6" cy="115.3" r="5.8" fill="#7ec8e3" opacity="0.26" filter="url(#${u}_glow_forte)"/></g>
<g style="animation-delay:6.38s; animation-duration:4.50s"><circle cx="240.0" cy="136.2" r="4.4" fill="#f0f4ff" opacity="0.4" filter="url(#${u}_glow)"/><circle cx="240.0" cy="136.2" r="7.0" fill="#7ec8e3" opacity="0.16000000000000003" filter="url(#${u}_glow_forte)"/></g>
</g>
<g class="ll-estrelas">
<g style="animation-delay:0.0s"><line x1="243.4" y1="189.3" x2="251.4" y2="189.3" stroke="#7ec8e3" stroke-width="0.8" stroke-opacity=".6" stroke-linecap="round"/><line x1="247.4" y1="185.3" x2="247.4" y2="193.3" stroke="#7ec8e3" stroke-width="0.8" stroke-opacity=".6" stroke-linecap="round"/></g>
<g style="animation-delay:0.6s"><line x1="106.7" y1="247.4" x2="114.7" y2="247.4" stroke="#7ec8e3" stroke-width="0.8" stroke-opacity=".6" stroke-linecap="round"/><line x1="110.7" y1="243.4" x2="110.7" y2="251.4" stroke="#7ec8e3" stroke-width="0.8" stroke-opacity=".6" stroke-linecap="round"/></g>
<g style="animation-delay:1.2s"><line x1="48.6" y1="110.7" x2="56.6" y2="110.7" stroke="#7ec8e3" stroke-width="0.8" stroke-opacity=".6" stroke-linecap="round"/><line x1="52.6" y1="106.7" x2="52.6" y2="114.7" stroke="#7ec8e3" stroke-width="0.8" stroke-opacity=".6" stroke-linecap="round"/></g>
<g style="animation-delay:1.8s"><line x1="185.3" y1="52.6" x2="193.3" y2="52.6" stroke="#7ec8e3" stroke-width="0.8" stroke-opacity=".6" stroke-linecap="round"/><line x1="189.3" y1="48.6" x2="189.3" y2="56.6" stroke="#7ec8e3" stroke-width="0.8" stroke-opacity=".6" stroke-linecap="round"/></g>
</g>
</svg>`;
  },

  /* A cerimônia delega ao renderizador único do projeto. */
  celebrar() {
    if (typeof ConquistaFX === 'undefined') return;
    ConquistaFX.show({
      codigo: 'lobo_lunar', titulo: 'Lobo Lunar — Alfa da Alcateia',
      descricao: 'Forjado sob a lua cheia. O uivo que congela o ar e parte a noite ao meio.',
      icone: '🐺', cor: '#7ec8e3',
      xp_bonus: 8500, moedas_bonus: 850,
    });
  },
};

window.LoboLunarFX = LoboLunarFX;

/* Optional chaining nos DOIS pontos: este arquivo pode carregar antes
   do conquista-fx.js, e um erro aqui derrubaria o resto do script. */
window.ConquistaFX?.registrarInsignia?.('lobo_lunar', tam => LoboLunarFX._svg(tam));
