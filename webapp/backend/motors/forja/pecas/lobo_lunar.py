# -*- coding: utf-8 -*-
"""
LOBO LUNAR — insígnia e aura, 100% procedurais.

Construída sobre o mesmo motor da Fênix V3: paths anatômicos, camadas
com profundidade, gradientes, filtros de brilho, partículas com semente
e animações CSS — nada de Base64, nada de PNG embutido.

Paleta: prata lunar, gelo, azul meia-noite. O lobo não é fogo — é gelo.
"""
from __future__ import annotations
import math

from .. import pincel as P
from ..tela import Tela

# Paleta Lunar
PRATA_BRANCO = "#f0f4ff"
PRATA_GLACIAL = "#b8c7e8"
AZUL_GELO = "#5b7fbf"
AZUL_MEIA_NOITE = "#1a1f3a"
AZUL_ABISSAL = "#0a0d1e"
BRANCO_PURO = "#ffffff"
CIANO_LUNAR = "#7ec8e3"


def _paths_lobo():
    """Paths anatômicos do lobo — geometria angular, orelhas pontudas,
    focinho alongado, pelagem em camadas."""
    return {
        # --- CABEÇA ---
        "cabeca": "M 110,100 C 110,82 118,68 130,62 C 142,56 158,56 170,62 "
                  "C 182,68 190,82 190,100 C 190,112 185,120 175,128 "
                  "C 165,136 155,142 150,148 C 145,154 140,160 135,160 "
                  "C 130,160 120,155 112,148 C 104,140 110,112 110,100 Z",

        # Focinho alongado
        "focinho": "M 160,90 C 175,88 195,92 208,100 C 215,105 218,112 215,118 "
                   "C 210,126 195,128 180,126 C 175,125 170,122 168,118 "
                   "C 165,112 162,100 160,90 Z",

        # Nariz (ponta do focinho)
        "nariz": "M 210,102 C 215,99 220,100 222,105 C 224,110 220,116 215,118 "
                 "C 212,118 208,116 208,112 C 207,107 208,103 210,102 Z",

        # Orelha esquerda (pontuda, triangular)
        "orelha_esq": "M 115,78 C 110,58 100,38 88,25 C 95,40 100,55 105,70 "
                      "C 108,78 112,82 115,78 Z",

        # Orelha direita
        "orelha_dir": "M 175,72 C 182,52 192,32 205,20 C 198,36 192,52 185,68 "
                      "C 182,74 178,76 175,72 Z",

        # Olho esquerdo (amendoado, felino)
        "olho_esq": "M 128,95 C 132,90 140,88 146,90 C 150,92 150,96 146,98 "
                    "C 140,100 132,98 128,95 Z",

        # Olho direito
        "olho_dir": "M 170,90 C 174,85 182,83 188,85 C 192,87 192,91 188,93 "
                    "C 182,95 174,93 170,90 Z",

        # Íris + pupila (brilho)
        "pupila_esq": "M 134,93 C 137,91 141,91 143,93 C 143,95 140,96 137,95 Z",
        "pupila_dir": "M 176,88 C 179,86 183,86 185,88 C 185,90 182,91 179,90 Z",

        # --- CORPO / PEITORAL ---
        "peitoral": "M 135,150 C 130,165 120,185 115,210 C 130,200 148,195 150,210 "
                    "C 152,225 150,248 148,265 C 155,260 165,258 175,260 "
                    "C 180,250 185,235 182,215 C 180,200 175,185 170,165 "
                    "C 165,152 150,148 135,150 Z",

        # Pelagem do peito (em V)
        "peito_pelo": "M 145,165 C 138,180 130,200 125,220 "
                      "C 135,208 148,200 150,210 "
                      "C 155,200 168,208 178,220 "
                      "C 173,200 165,180 158,165 Z",

        # --- PATAS DIANTEIRAS ---
        "pata_esq": "M 125,200 C 118,220 110,245 108,268 "
                    "C 106,280 108,288 112,290 "
                    "C 118,292 122,285 122,275 "
                    "C 122,260 120,240 125,220 "
                    "C 128,210 130,200 125,200 Z",

        "pata_dir": "M 172,200 C 178,220 185,245 188,268 "
                    "C 190,280 188,288 184,290 "
                    "C 178,292 174,285 174,275 "
                    "C 174,260 176,240 172,220 "
                    "C 168,210 166,200 172,200 Z",

        # Garras
        "garra_esq_1": "M 108,280 L 104,292 L 112,288 Z",
        "garra_esq_2": "M 110,282 L 106,294 L 114,290 Z",
        "garra_esq_3": "M 112,284 L 108,296 L 116,292 Z",
        "garra_dir_1": "M 188,280 L 192,292 L 184,288 Z",
        "garra_dir_2": "M 186,282 L 190,294 L 182,290 Z",
        "garra_dir_3": "M 184,284 L 188,296 L 180,292 Z",

        # --- CAUDA (curva para cima e para trás) ---
        "cauda": "M 148,260 C 140,270 125,275 110,268 "
                 "C 95,260 82,245 78,230 "
                 "C 75,218 80,210 88,212 "
                 "C 96,215 98,225 100,235 "
                 "C 105,248 115,258 130,260 "
                 "C 140,262 145,262 148,260 Z",

        # Pelagem da cauda
        "cauda_pelo": "M 110,268 C 100,260 88,248 82,235 "
                      "C 80,228 84,222 90,224 "
                      "C 95,228 98,235 100,242 "
                      "C 106,252 118,260 130,262 Z",

        # --- CRINA / PELAGEM DO PESCOÇO ---
        "crina_esq": "M 120,120 C 108,125 95,140 88,158 "
                     "C 92,148 100,138 112,130 "
                     "C 108,142 105,155 108,168 "
                     "C 112,155 118,142 125,128 Z",

        "crina_dir": "M 168,115 C 178,118 190,130 195,148 "
                     "C 190,138 182,128 172,122 "
                     "C 176,134 178,148 175,160 "
                     "C 170,148 165,132 168,115 Z",

        # --- DETALHES FACIAIS ---
        # Marca na testa (diamante/losango)
        "marca_testa": "M 148,72 L 155,78 L 148,84 L 141,78 Z",

        # Linhas do focinho
        "focinho_linha": "M 160,108 C 170,106 185,108 195,112",
    }


def insignia(vb: int = 300) -> Tela:
    c = Tela("lobo-lunar-insignia", vb)
    sem = P.Semente(20260802)
    k = vb / 300.0
    C = 150  # centro em base 300

    # --- MATERIAIS (Gradientes e Filtros) ---
    g_corpo = c.linear("corpo", [
        (0.00, PRATA_BRANCO, 1), (0.35, PRATA_GLACIAL, 1),
        (0.70, AZUL_GELO, 1), (1.00, AZUL_MEIA_NOITE, 1)], 0, 0, 0, 1)

    g_cabeca = c.linear("cabeca", [
        (0.00, PRATA_BRANCO, 1), (0.50, PRATA_GLACIAL, 1),
        (1.00, AZUL_GELO, 1)], 0.5, 0, 0.5, 1)

    g_focinho = c.linear("focinho", [
        (0.00, BRANCO_PURO, 1), (0.40, PRATA_GLACIAL, 1),
        (1.00, AZUL_GELO, 1)], 1, 0, 0, 1)

    g_cauda = c.linear("cauda", [
        (0.00, PRATA_BRANCO, 1), (0.50, PRATA_GLACIAL, 1),
        (1.00, AZUL_MEIA_NOITE, 1)], 0, 0, 1, 1)

    g_crina = c.linear("crina", [
        (0.00, AZUL_MEIA_NOITE, 1), (0.60, AZUL_GELO, 1),
        (1.00, PRATA_GLACIAL, 1)], 0, 1, 1, 0)

    g_olho = c.radial("olho", [
        (0.00, BRANCO_PURO, 1), (0.30, CIANO_LUNAR, 1),
        (0.70, AZUL_GELO, 1), (1.00, AZUL_MEIA_NOITE, 1)])

    g_lua = c.radial("lua", [
        (0.00, BRANCO_PURO, 0.9), (0.30, PRATA_GLACIAL, 0.5),
        (0.70, AZUL_GELO, 0.1), (1.00, AZUL_MEIA_NOITE, 0)])

    g_marca = c.radial("marca", [
        (0.00, CIANO_LUNAR, 1), (0.50, AZUL_GELO, 0.8),
        (1.00, AZUL_MEIA_NOITE, 0.3)])

    f_glow = c.brilho("glow", 3 * k, 1.3)
    f_glow_forte = c.brilho("glow_forte", 6 * k, 1.6)
    f_glow_lunar = c.brilho("glow_lunar", 10 * k, 1.2)
    f_sombra = c.sombra("sombra", 0, 4 * k, 10 * k, AZUL_MEIA_NOITE, 0.5)

    # Escala dos paths (base 300)
    import re
    P_SVG_orig = _paths_lobo()
    P_SVG = {}
    for nome, d in P_SVG_orig.items():
        P_SVG[nome] = re.sub(
            r'[\d.]+',
            lambda m: str(round(float(m.group(0)) * k, 1)),
            d
        )

    # --- CAMADAS ---

    # 0. Fundo — Lua cheia atrás do lobo
    fundo = c.camada("fundo", z=0, atributos=f'filter="{f_glow_lunar}"')
    lua_cx, lua_cy = 220 * k, 60 * k
    fundo.add(
        f'<circle cx="{lua_cx:.1f}" cy="{lua_cy:.1f}" r="{65*k:.1f}" '
        f'fill="{g_lua}" class="ll-lua"/>'
    )
    fundo.add(
        f'<circle cx="{lua_cx:.1f}" cy="{lua_cy:.1f}" r="{68*k:.1f}" '
        f'fill="none" stroke="{PRATA_GLACIAL}" stroke-width="{0.8*k:.1f}" '
        f'stroke-opacity=".4" stroke-dasharray="{8*k:.1f} {4*k:.1f}"/>'
    )

    # 1. Aro externo — círculo rúnico
    aro = c.camada("aro", z=1)
    aro.add(
        f'<circle cx="{C*k:.1f}" cy="{C*k:.1f}" r="{130*k:.1f}" '
        f'fill="none" stroke="{AZUL_GELO}" stroke-width="{1.2*k:.1f}" '
        f'stroke-opacity=".3" class="ll-aro"/>'
    )
    aro.add(
        f'<circle cx="{C*k:.1f}" cy="{C*k:.1f}" r="{138*k:.1f}" '
        f'fill="none" stroke="{PRATA_GLACIAL}" stroke-width="{0.5*k:.1f}" '
        f'stroke-opacity=".2" stroke-dasharray="{3*k:.1f} {12*k:.1f}" '
        f'class="ll-aro-lento"/>'
    )

    # Runas ao redor do aro
    runas = []
    for i in range(8):
        ang = math.radians(i * 45 - 90)
        x1 = C * k + 125 * k * math.cos(ang)
        y1 = C * k + 125 * k * math.sin(ang)
        x2 = C * k + 134 * k * math.cos(ang)
        y2 = C * k + 134 * k * math.sin(ang)
        runas.append(
            f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
            f'stroke="{CIANO_LUNAR}" stroke-width="{1.5*k:.1f}" '
            f'stroke-opacity=".5" stroke-linecap="round"/>'
        )
    aro.add(f'<g class="ll-aro">{"".join(runas)}</g>')

    # 2. Cauda (atrás do corpo)
    cauda_cam = c.camada("cauda", z=2, atributos=f'filter="{f_sombra}"')
    cauda_cam.add(
        f'<path d="{P_SVG["cauda"]}" fill="{g_cauda}" '
        f'stroke="{PRATA_GLACIAL}" stroke-width="{0.8*k:.1f}" '
        f'stroke-opacity=".6"/>'
    )
    cauda_cam.add(
        f'<path d="{P_SVG["cauda_pelo"]}" fill="{g_crina}" '
        f'stroke="none" opacity=".7"/>'
    )

    # 3. Crina / pelagem do pescoço
    crina = c.camada("crina", z=3, atributos=f'filter="{f_sombra}"')
    crina.add(
        f'<path d="{P_SVG["crina_esq"]}" fill="{g_crina}" '
        f'stroke="{PRATA_GLACIAL}" stroke-width="{0.6*k:.1f}" '
        f'stroke-opacity=".4"/>'
    )
    crina.add(
        f'<path d="{P_SVG["crina_dir"]}" fill="{g_crina}" '
        f'stroke="{PRATA_GLACIAL}" stroke-width="{0.6*k:.1f}" '
        f'stroke-opacity=".4"/>'
    )

    # 4. Corpo — peitoral + patas
    corpo = c.camada("corpo", z=4, atributos=f'filter="{f_sombra}"')
    corpo.add(
        f'<path d="{P_SVG["peitoral"]}" fill="{g_corpo}" '
        f'stroke="{PRATA_GLACIAL}" stroke-width="{1*k:.1f}" '
        f'stroke-opacity=".5"/>'
    )
    corpo.add(
        f'<path d="{P_SVG["peito_pelo"]}" fill="{g_crina}" '
        f'stroke="none" opacity=".5"/>'
    )
    # Patas
    corpo.add(
        f'<path d="{P_SVG["pata_esq"]}" fill="{g_corpo}" '
        f'stroke="{PRATA_GLACIAL}" stroke-width="{0.8*k:.1f}" '
        f'stroke-opacity=".4"/>'
    )
    corpo.add(
        f'<path d="{P_SVG["pata_dir"]}" fill="{g_corpo}" '
        f'stroke="{PRATA_GLACIAL}" stroke-width="{0.8*k:.1f}" '
        f'stroke-opacity=".4"/>'
    )

    # 5. Cabeça + orelhas
    cabeca = c.camada("cabeca", z=5, atributos=f'filter="{f_sombra}"')
    cabeca.add(
        f'<path d="{P_SVG["orelha_esq"]}" fill="{g_crina}" '
        f'stroke="{PRATA_GLACIAL}" stroke-width="{0.6*k:.1f}"/>'
    )
    cabeca.add(
        f'<path d="{P_SVG["orelha_dir"]}" fill="{g_crina}" '
        f'stroke="{PRATA_GLACIAL}" stroke-width="{0.6*k:.1f}"/>'
    )
    cabeca.add(
        f'<path d="{P_SVG["cabeca"]}" fill="{g_cabeca}" '
        f'stroke="{PRATA_GLACIAL}" stroke-width="{1*k:.1f}" '
        f'stroke-opacity=".6"/>'
    )

    # 6. Focinho
    focinho_cam = c.camada("focinho", z=6)
    focinho_cam.add(
        f'<path d="{P_SVG["focinho"]}" fill="{g_focinho}" '
        f'stroke="{PRATA_GLACIAL}" stroke-width="{0.7*k:.1f}"/>'
    )
    focinho_cam.add(
        f'<path d="{P_SVG["focinho_linha"]}" fill="none" '
        f'stroke="{AZUL_GELO}" stroke-width="{0.6*k:.1f}" '
        f'stroke-opacity=".5" stroke-linecap="round"/>'
    )

    # 7. Nariz (brilha)
    nariz_cam = c.camada("nariz", z=7, atributos=f'filter="{f_glow}"')
    nariz_cam.add(
        f'<path d="{P_SVG["nariz"]}" fill="{AZUL_MEIA_NOITE}" '
        f'stroke="{CIANO_LUNAR}" stroke-width="{0.8*k:.1f}"/>'
    )
    nariz_cam.add(
        f'<circle cx="{214*k:.1f}" cy="{107*k:.1f}" r="{1.5*k:.1f}" '
        f'fill="{CIANO_LUNAR}" opacity=".6"/>'
    )

    # 8. Olhos (brilho ciano/lunar)
    olhos = c.camada("olhos", z=7, atributos=f'filter="{f_glow}"')
    olhos.add(
        f'<path d="{P_SVG["olho_esq"]}" fill="{g_olho}" '
        f'stroke="{CIANO_LUNAR}" stroke-width="{1*k:.1f}"/>'
    )
    olhos.add(
        f'<path d="{P_SVG["olho_dir"]}" fill="{g_olho}" '
        f'stroke="{CIANO_LUNAR}" stroke-width="{1*k:.1f}"/>'
    )
    # Pupilas
    olhos.add(
        f'<path d="{P_SVG["pupila_esq"]}" fill="{BRANCO_PURO}" '
        f'filter="{f_glow_forte}"/>'
    )
    olhos.add(
        f'<path d="{P_SVG["pupila_dir"]}" fill="{BRANCO_PURO}" '
        f'filter="{f_glow_forte}"/>'
    )

    # 9. Marca da testa (diamante — brilha)
    marca = c.camada("marca", z=8, classe="ll-marca",
                     atributos=f'filter="{f_glow}"')
    marca.add(
        f'<path d="{P_SVG["marca_testa"]}" fill="{g_marca}" '
        f'stroke="{CIANO_LUNAR}" stroke-width="{0.8*k:.1f}"/>'
    )
    marca.add(
        f'<line x1="{148*k:.1f}" y1="{72*k:.1f}" x2="{148*k:.1f}" y2="{84*k:.1f}" '
        f'stroke="{BRANCO_PURO}" stroke-width="{0.4*k:.1f}" opacity=".6"/>'
    )
    marca.add(
        f'<line x1="{141*k:.1f}" y1="{78*k:.1f}" x2="{155*k:.1f}" y2="{78*k:.1f}" '
        f'stroke="{BRANCO_PURO}" stroke-width="{0.4*k:.1f}" opacity=".6"/>'
    )

    # 10. Garras (brilho sutil)
    garras = c.camada("garras", z=6, atributos=f'filter="{f_glow}"')
    for nome_garra in ["garra_esq_1", "garra_esq_2", "garra_esq_3",
                        "garra_dir_1", "garra_dir_2", "garra_dir_3"]:
        garras.add(
            f'<path d="{P_SVG[nome_garra]}" fill="{CIANO_LUNAR}" '
            f'stroke="{BRANCO_PURO}" stroke-width="{0.3*k:.1f}" '
            f'opacity=".8"/>'
        )

    # 11. Partículas — flocos de gelo / poeira lunar
    particulas = c.camada("particulas", z=9, classe="ll-particulas")
    for i in range(30):
        ang = math.radians((i * 13.7 + i % 5 * 11) % 360 - 90)
        r = (55 + (i % 4) * 20 + (i % 3) * 8) * k
        px = C * k + r * math.cos(ang)
        py = C * k + r * math.sin(ang)
        sz = (1.2 + (i % 5) * 0.8) * k
        op = 0.9 if i % 3 == 0 else (0.65 if i % 2 == 0 else 0.4)
        delay = i * 0.22
        dur = 2.5 + (i % 5) * 0.5

        particulas.add(
            f'<g style="animation-delay:{delay:.2f}s; '
            f'animation-duration:{dur:.2f}s">'
            f'<circle cx="{px:.1f}" cy="{py:.1f}" r="{sz:.1f}" '
            f'fill="{PRATA_BRANCO}" opacity="{op}" '
            f'filter="{f_glow}"/>'
            f'<circle cx="{px:.1f}" cy="{py:.1f}" r="{(sz*1.6):.1f}" '
            f'fill="{CIANO_LUNAR}" opacity="{op*0.4}" '
            f'filter="{f_glow_forte}"/>'
            f'</g>'
        )

    # 12. Estrelas de 4 pontas (cristais de gelo)
    estrelas = c.camada("estrelas", z=10, classe="ll-estrelas")
    for i in range(4):
        ang = math.radians(i * 90 + 22)
        sx = C * k + 105 * k * math.cos(ang)
        sy = C * k + 105 * k * math.sin(ang)
        t = 4 * k
        estrelas.add(
            f'<g style="animation-delay:{i*0.6:.1f}s">'
            f'<line x1="{sx-t:.1f}" y1="{sy:.1f}" x2="{sx+t:.1f}" y2="{sy:.1f}" '
            f'stroke="{CIANO_LUNAR}" stroke-width="{0.8*k:.1f}" '
            f'stroke-opacity=".6" stroke-linecap="round"/>'
            f'<line x1="{sx:.1f}" y1="{sy-t:.1f}" x2="{sx:.1f}" y2="{sy+t:.1f}" '
            f'stroke="{CIANO_LUNAR}" stroke-width="{0.8*k:.1f}" '
            f'stroke-opacity=".6" stroke-linecap="round"/>'
            f'</g>'
        )

    # --- CSS ANIMATIONS ---
    c.css(f"""
    .ll-lua {{
        transform-origin: {lua_cx:.1f}px {lua_cy:.1f}px;
        animation: ll-pulso-lunar 4s ease-in-out infinite;
    }}
    @keyframes ll-pulso-lunar {{
        0%, 100% {{ opacity: .7; transform: scale(1); }}
        50%      {{ opacity: 1; transform: scale(1.06); }}
    }}

    .ll-aro {{
        transform-origin: {C*k:.1f}px {C*k:.1f}px;
        animation: ll-girar 40s linear infinite;
    }}
    .ll-aro-lento {{
        transform-origin: {C*k:.1f}px {C*k:.1f}px;
        animation: ll-girar 60s linear infinite reverse;
    }}
    @keyframes ll-girar {{
        100% {{ transform: rotate(360deg); }}
    }}

    .ll-marca {{
        transform-origin: {148*k:.1f}px {78*k:.1f}px;
        animation: ll-pulso-marca 3s ease-in-out infinite;
    }}
    @keyframes ll-pulso-marca {{
        0%, 100% {{ opacity: .7; transform: scale(1); }}
        50%      {{ opacity: 1; transform: scale(1.15); }}
    }}

    .ll-particulas g {{
        transform-origin: {C*k:.1f}px {C*k:.1f}px;
        animation-name: ll-flutuar;
        animation-timing-function: ease-in-out;
        animation-iteration-count: infinite;
        animation-direction: alternate;
    }}
    @keyframes ll-flutuar {{
        0%   {{ transform: scale(0.7) translate(0, 0); opacity: 0.5; }}
        50%  {{ transform: scale(1.1) translate(0, -6px); opacity: 1; }}
        100% {{ transform: scale(0.85) translate(0, -3px); opacity: 0.7; }}
    }}

    .ll-estrelas g {{
        transform-origin: {C*k:.1f}px {C*k:.1f}px;
        animation: ll-piscar 2.5s ease-in-out infinite alternate;
    }}
    @keyframes ll-piscar {{
        0%   {{ opacity: .3; transform: scale(0.7); }}
        100% {{ opacity: .9; transform: scale(1.2); }}
    }}

    @media (prefers-reduced-motion: reduce) {{
        .ll-lua, .ll-aro, .ll-aro-lento, .ll-marca,
        .ll-particulas g, .ll-estrelas g
        {{ animation: none !important; }}
    }}
    """)

    return c


def aura(vb: int = 300) -> Tela:
    """Aura do Lobo Lunar — vento gelado, cristais flutuantes,
    expansão de bruma prateada."""
    c = Tela("lobo-lunar-aura", vb)
    sem = P.Semente(20260803)
    cx, cy = c.centro
    k = vb / 300.0

    g_bruma = c.radial("bruma", [
        (0.00, PRATA_GLACIAL, 0.30), (0.50, AZUL_GELO, 0.08),
        (1.00, AZUL_MEIA_NOITE, 0)])
    g_cristal = c.linear("cristal", [
        (0.00, BRANCO_PURO, 1), (0.50, CIANO_LUNAR, 0.6),
        (1.00, AZUL_GELO, 0.2)], 0, 0, 1, 1)
    f_glow = c.brilho("glow", 4 * k, 1.3)
    f_glow_forte = c.brilho("glow_forte", 8 * k, 1.5)
    corte = c.recorte_circular("corte", cx, cy, 142 * k)

    # 1. Bruma de fundo
    c.camada("bruma", z=0, classe="la-bruma").add(
        f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{148*k:.1f}" fill="{g_bruma}"/>'
    )

    # 2. Anéis de vento (expansão contínua)
    vento = c.camada("vento", z=1, atributos=f'filter="{f_glow}" clip-path="{corte}"')
    for i in range(3):
        delay = i * 1.2
        vento.add(
            f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{120*k:.1f}" '
            f'fill="none" stroke="{PRATA_GLACIAL}" '
            f'stroke-width="{(3-i)*0.8*k:.1f}" '
            f'stroke-dasharray="{8*k:.1f} {16*k:.1f}" '
            f'opacity="0.5" class="la-onda" '
            f'style="animation-delay:{delay:.1f}s"/>'
        )

    # 3. Cristais de gelo (losangos girando)
    cristais = c.camada("cristais", z=2, classe="la-girar",
                        atributos=f'filter="{f_glow_forte}" clip-path="{corte}"')
    for i in range(12):
        ang = math.radians((360 / 12) * i)
        bx = cx + 75 * k * math.cos(ang)
        by = cy + 75 * k * math.sin(ang)
        t = 6 * k
        rot = (360 / 12) * i + 15
        cristais.add(
            f'<g transform="rotate({rot} {bx:.1f} {by:.1f})" '
            f'style="animation-delay:{i*0.2:.2f}s" class="la-cristal">'
            f'<polygon points="{bx:.1f},{by-t:.1f} {bx+t*0.6:.1f},{by:.1f} '
            f'{bx:.1f},{by+t:.1f} {bx-t*0.6:.1f},{by:.1f}" '
            f'fill="{g_cristal}" stroke="{BRANCO_PURO}" '
            f'stroke-width="{0.8*k:.1f}" opacity=".7"/>'
            f'</g>'
        )

    # 4. Partículas de gelo
    gelo = c.camada("gelo", z=3, classe="la-gelo",
                    atributos=f'clip-path="{corte}"')
    for i in range(22):
        gx = cx + sem.entre(-90 * k, 90 * k)
        gy = cy + sem.entre(-90 * k, 90 * k)
        r = sem.entre(1.2 * k, 3.5 * k)
        op = sem.entre(0.4, 0.9)
        dur = sem.entre(2.0, 4.5)
        atraso = sem.entre(0, 3.0)
        gelo.add(
            f'<circle cx="{gx:.1f}" cy="{gy:.1f}" r="{r:.1f}" '
            f'fill="{PRATA_BRANCO}" opacity="{op:.2f}" '
            f'style="animation-duration:{dur:.2f}s; '
            f'animation-delay:{atraso:.2f}s"/>'
        )

    # 5. Constelação (linhas conectando estrelas)
    constel = c.camada("constelacao", z=4, classe="la-constelacao",
                       atributos=f'clip-path="{corte}"')
    estrelas_pts = []
    for i in range(7):
        ang = math.radians((360 / 7) * i + sem.entre(-10, 10))
        r = sem.entre(55 * k, 105 * k)
        estrelas_pts.append((
            cx + r * math.cos(ang),
            cy + r * math.sin(ang),
            sem.entre(0.3, 0.7)
        ))
    # Linhas entre estrelas próximas
    for a_idx, (ax, ay, _) in enumerate(estrelas_pts):
        for b_idx, (bx, by, _) in enumerate(estrelas_pts):
            if b_idx <= a_idx:
                continue
            dist = math.hypot(bx - ax, by - ay)
            if dist < 80 * k:
                constel.add(
                    f'<line x1="{ax:.1f}" y1="{ay:.1f}" '
                    f'x2="{bx:.1f}" y2="{by:.1f}" '
                    f'stroke="{CIANO_LUNAR}" stroke-width="{0.3*k:.1f}" '
                    f'stroke-opacity=".35" stroke-dasharray="{2*k:.1f} {4*k:.1f}"/>'
                )
    # Estrelas
    for sx, sy, op in estrelas_pts:
        r = 2.5 * k
        constel.add(
            f'<circle cx="{sx:.1f}" cy="{sy:.1f}" r="{r:.1f}" '
            f'fill="{BRANCO_PURO}" opacity="{op:.2f}" filter="{f_glow}"/>'
        )

    c.css(f"""
    .la-bruma {{
        transform-origin: {cx:.1f}px {cy:.1f}px;
        animation: la-respirar 5s ease-in-out infinite;
    }}
    @keyframes la-respirar {{
        0%, 100% {{ opacity: .5; transform: scale(1); }}
        50%      {{ opacity: .8; transform: scale(1.04); }}
    }}

    .la-onda {{
        transform-origin: {cx:.1f}px {cy:.1f}px;
        animation: la-expandir 3s cubic-bezier(.1,.7,.3,1) infinite;
    }}
    @keyframes la-expandir {{
        0%   {{ transform: scale(0.2); opacity: .8; }}
        100% {{ transform: scale(1.1); opacity: 0; }}
    }}

    .la-girar {{
        transform-origin: {cx:.1f}px {cy:.1f}px;
        animation: la-spin 50s linear infinite;
    }}
    @keyframes la-spin {{
        100% {{ transform: rotate(360deg); }}
    }}

    .la-cristal {{
        animation: la-flicker 1.6s ease-in-out infinite alternate;
    }}
    @keyframes la-flicker {{
        0%   {{ opacity: .4; transform: scale(0.9); }}
        100% {{ opacity: .8; transform: scale(1.1); }}
    }}

    .la-gelo circle {{
        animation-name: la-subir;
        animation-timing-function: cubic-bezier(.3,0,.7,1);
        animation-iteration-count: infinite;
    }}
    @keyframes la-subir {{
        0%   {{ transform: translateY(18px) scale(0.4); opacity: 0; }}
        30%  {{ opacity: .8; }}
        100% {{ transform: translateY(-90px) scale(1.1); opacity: 0; }}
    }}

    .la-constelacao {{
        animation: la-brilho-const 6s ease-in-out infinite;
    }}
    @keyframes la-brilho-const {{
        0%, 100% {{ opacity: .3; }}
        50%      {{ opacity: .7; }}
    }}

    @media (prefers-reduced-motion: reduce) {{
        .la-bruma, .la-onda, .la-girar, .la-cristal,
        .la-gelo circle, .la-constelacao {{ animation: none !important; }}
    }}
    """)

    return c
