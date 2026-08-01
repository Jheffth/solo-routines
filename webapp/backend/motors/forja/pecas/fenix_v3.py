# -*- coding: utf-8 -*-
"""
A FÊNIX V3 (A COROA SOLAR) — insígnia e aura híbridas.
A V3 abandona a matemática crua e une a anatomia escultural perfeita
(caminhos orgânicos) com o poder procedimental do motor Forja (partículas, filtros).
"""
from __future__ import annotations
import math

from .. import pincel as P
from ..tela import Tela

# Cores Base
OURO_BRANCO = "#fff7ed"
AMBAR = "#fb923c"
LARANJA_FOGO = "#ea580c"
BRASA_RUBRA = "#7c2d12"
BRANCO_PURO = "#ffffff"


def _paths_fenix():
    """Os paths esculpidos anatômicos da fênix, originalmente desenhados para a V1."""
    return {
        "cauda_ext_esq": "M 118,145 C 95,170 75,200 68,235 C 85,215 95,195 108,180 C 95,210 90,230 92,250 C 105,225 115,200 122,170 Z",
        "cauda_ext_dir": "M 142,145 C 165,170 185,200 192,235 C 175,215 165,195 152,180 C 165,210 170,230 168,250 C 155,225 145,200 138,170 Z",
        "cauda_med_esq": "M 122,150 C 105,180 95,215 98,245 C 110,220 118,195 125,175 Z",
        "cauda_med_dir": "M 138,150 C 155,180 165,215 162,245 C 150,220 142,195 135,175 Z",
        "cauda_central": "M 130,150 C 124,185 122,220 130,255 C 138,220 136,185 130,150 Z",
        
        "asa_ext_esq": "M 124,110 C 95,95 55,70 15,22 C 32,52 50,65 64,68 C 42,75 25,85 14,100 C 38,90 58,95 72,100 C 50,108 35,118 25,135 C 52,122 75,122 96,125 C 75,132 60,142 50,158 C 75,145 98,142 116,140 Z",
        "asa_ext_dir": "M 136,110 C 165,95 205,70 245,22 C 228,52 210,65 196,68 C 218,75 235,85 246,100 C 222,90 202,95 188,100 C 210,108 225,118 235,135 C 208,122 185,122 164,125 C 185,132 200,142 210,158 C 185,145 162,142 144,140 Z",
        
        "asa_med_esq": "M 122,112 C 98,100 62,78 30,38 C 45,60 62,70 75,74 C 55,82 40,92 32,106 C 52,98 70,102 82,106 C 65,114 52,122 45,136 C 68,126 88,126 102,128 Z",
        "asa_med_dir": "M 138,112 C 162,100 198,78 230,38 C 215,60 198,70 185,74 C 205,82 220,92 228,106 C 208,98 190,102 178,106 C 195,114 208,122 215,136 C 192,126 172,126 158,128 Z",
        
        "asa_int_esq": "M 120,115 C 102,105 75,88 50,56 C 62,72 75,80 86,84 C 70,90 58,98 52,110 C 68,104 82,108 92,112 Z",
        "asa_int_dir": "M 140,115 C 158,105 185,88 210,56 C 198,72 185,80 174,84 C 190,90 202,98 208,110 C 192,104 178,108 168,112 Z",
        
        "nervuras_esq": "M 122,108 Q 80,80 22,28 M 115,115 Q 75,95 28,100 M 112,122 Q 80,120 35,134",
        "nervuras_dir": "M 138,108 Q 180,80 238,28 M 145,115 Q 185,95 232,100 M 148,122 Q 180,120 225,134",
        
        "peitoral": "M 120,102 C 115,118 115,135 120,148 C 125,153 135,153 140,148 C 145,135 145,118 140,102 C 135,98 125,98 120,102 Z",
        "pescoco": "M 122,104 C 118,88 122,72 130,62 C 136,70 140,86 138,104 Z",
        "cabeca": "M 125,66 C 124,58 132,52 138,54 C 144,55 152,58 155,62 C 148,64 142,63 138,65 C 136,70 130,72 125,66 Z",
        "crista": "M 130,55 C 122,42 112,32 98,24 C 110,36 118,44 124,53 M 128,52 C 118,38 106,28 92,20 C 105,32 115,42 122,50 M 125,56 C 116,46 105,38 92,32 C 104,42 112,50 120,57 M 134,53 C 132,38 126,26 116,15 C 126,28 132,40 134,53 Z",
        
        "gema_peito": "M 130,108 L 138,116 L 138,128 L 130,136 L 122,128 L 122,116 Z",
        "gema_brilho": "M 130,108 L 138,116 L 130,122 L 122,116 Z",
    }


def insignia(vb: int = 300) -> Tela:
    c = Tela("fenix-v3-insignia", vb)
    sem = P.Semente(20260810)
    k = vb / 260.0  # Fator de escala, já que os paths da V1 são base 260.
    
    # Centro em base 260 para as âncoras locais das animações
    C = 130
    
    # ── Materiais (Gradientes e Filtros S-Rank da Fênix) ──────────────
    # A V3 usa o motor de shaders da Forja (`tela.py`) em vez de gradientes crús.
    g_asa_ext = c.linear("asa_ext", [
        (0.00, "#ffedd5", 1), (0.30, "#f97316", 1), (0.70, "#c2410c", 1), (1.00, "#4a0404", 1)], 0, 0, 1, 1)
        
    g_asa_med = c.linear("asa_med", [
        (0.00, "#fff7ed", 1), (0.40, "#fb923c", 1), (0.85, "#ea580c", 1), (1.00, "#7c2d12", 1)], 0, 1, 1, 0)
        
    g_asa_int = c.linear("asa_int", [
        (0.00, BRANCO_PURO, 1), (0.45, "#ffedd5", 1), (0.85, "#f97316", 1), (1.00, "#9a3412", 1)], 0.5, 0, 0.5, 1)
        
    g_cauda = c.linear("cauda", [
        (0.00, "#fb923c", 1), (0.40, "#ea580c", 1), (0.75, "#9a3412", 1), (1.00, "#4a0404", 1)], 0.5, 0, 0.5, 1)
        
    g_peitoral = c.linear("peitoral", [
        (0.00, "#ffedd5", 1), (0.35, "#f97316", 1), (0.75, "#9a3412", 1), (1.00, "#3b0a00", 1)], 0, 0, 0, 1)
        
    g_gema = c.radial("gema", [
        (0.00, BRANCO_PURO, 1), (0.30, "#ffedd5", 1), (0.65, "#f97316", 1), (1.00, "#9a3412", 1)])
        
    f_glow = c.brilho("glow", 4 * k, 1.3)
    f_glow_forte = c.brilho("glow_forte", 8 * k, 1.8)
    f_sombra = c.sombra("sombra", 0, 6 * k, 12 * k, "#ea580c", 0.6)

    # Pegamos os paths anatômicos e os escalamos
    import re
    P_SVG_orig = _paths_fenix()
    P_SVG = {}
    for nome, d in P_SVG_orig.items():
        P_SVG[nome] = re.sub(r'[\d.]+', lambda m: str(round(float(m.group(0)) * k, 1)), d)
    
    # ── Camadas (Base 300px via k) ───────────────────────────────────
    # 1. Roda Solar e Cometa (A Vontade do Assinante)
    fundo = c.camada("fundo", z=1, atributos=f'filter="{f_sombra}"')
    
    aro_cx, aro_cy = C * k, C * k
    fundo.add(f'<circle cx="{aro_cx:.1f}" cy="{aro_cy:.1f}" r="{98*k:.1f}" fill="none" stroke="{BRASA_RUBRA}" stroke-width="{2*k:.1f}" stroke-opacity=".5" class="fv3-roda-fundo"/>')
    fundo.add(f'<circle cx="{aro_cx:.1f}" cy="{aro_cy:.1f}" r="{86*k:.1f}" fill="none" stroke="{LARANJA_FOGO}" stroke-width="{1*k:.1f}" stroke-dasharray="{6*k:.1f} {6*k:.1f}" stroke-opacity=".4" class="fv3-roda-fundo"/>')
    
    runas = []
    for i in range(12):
        ang = math.radians(i * 30 - 90)
        x1, y1 = aro_cx + 88 * k * math.cos(ang), aro_cy + 88 * k * math.sin(ang)
        x2, y2 = aro_cx + 96 * k * math.cos(ang), aro_cy + 96 * k * math.sin(ang)
        runas.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{LARANJA_FOGO}" stroke-width="{1.8*k:.1f}" stroke-opacity=".55" stroke-linecap="round"/>')
    fundo.add(f'<g class="fv3-roda-fundo">{"".join(runas)}</g>')
        
    fundo.add(
        f'<circle cx="{aro_cx:.1f}" cy="{aro_cy:.1f}" r="{98*k:.1f}" fill="none" stroke="{OURO_BRANCO}" stroke-width="{2.6*k:.1f}" '
        f'stroke-dasharray="{60*k:.1f} {550*k:.1f}" stroke-linecap="round" filter="{f_glow}" class="fv3-cometa"/>')

    # 2. Cauda Cascata
    cauda = c.camada("cauda", z=2, atributos=f'filter="{f_sombra}"')
    cauda.add(f'<path d="{P_SVG["cauda_ext_esq"]}" fill="{g_cauda}" stroke="#ffedd5" stroke-width="{1.2*k:.1f}"/>')
    cauda.add(f'<path d="{P_SVG["cauda_ext_dir"]}" fill="{g_cauda}" stroke="#ffedd5" stroke-width="{1.2*k:.1f}"/>')
    cauda.add(f'<path d="{P_SVG["cauda_med_esq"]}" fill="{g_asa_med}" stroke="{OURO_BRANCO}" stroke-width="{1*k:.1f}"/>')
    cauda.add(f'<path d="{P_SVG["cauda_med_dir"]}" fill="{g_asa_med}" stroke="{OURO_BRANCO}" stroke-width="{1*k:.1f}"/>')
    cauda.add(f'<path d="{P_SVG["cauda_central"]}" fill="{g_asa_int}" stroke="{BRANCO_PURO}" stroke-width="{1.5*k:.1f}" filter="{f_glow}"/>')

    # 3. Asas Imperiais (Camadas Solares)
    asas = c.camada("asas", z=3, atributos=f'filter="{f_sombra}"')
    asas.add(f'<path d="{P_SVG["asa_ext_esq"]}" fill="{g_asa_ext}" stroke="#ffedd5" stroke-width="{1.4*k:.1f}"/>')
    asas.add(f'<path d="{P_SVG["asa_ext_dir"]}" fill="{g_asa_ext}" stroke="#ffedd5" stroke-width="{1.4*k:.1f}"/>')
    
    asas.add(f'<path d="{P_SVG["asa_med_esq"]}" fill="{g_asa_med}" stroke="{OURO_BRANCO}" stroke-width="{1.2*k:.1f}" filter="{f_glow}"/>')
    asas.add(f'<path d="{P_SVG["asa_med_dir"]}" fill="{g_asa_med}" stroke="{OURO_BRANCO}" stroke-width="{1.2*k:.1f}" filter="{f_glow}"/>')
    
    asas.add(f'<path d="{P_SVG["asa_int_esq"]}" fill="{g_asa_int}" stroke="{BRANCO_PURO}" stroke-width="{1*k:.1f}" filter="{f_glow}"/>')
    asas.add(f'<path d="{P_SVG["asa_int_dir"]}" fill="{g_asa_int}" stroke="{BRANCO_PURO}" stroke-width="{1*k:.1f}" filter="{f_glow}"/>')
    
    asas.add(f'<path d="{P_SVG["nervuras_esq"]}" fill="none" stroke="{OURO_BRANCO}" stroke-width="{1.3*k:.1f}" stroke-opacity=".85" stroke-linecap="round"/>')
    asas.add(f'<path d="{P_SVG["nervuras_dir"]}" fill="none" stroke="{OURO_BRANCO}" stroke-width="{1.3*k:.1f}" stroke-opacity=".85" stroke-linecap="round"/>')

    # 4. Peitoral e Cabeça (Anatomia Real)
    corpo = c.camada("corpo", z=4, atributos=f'filter="{f_sombra}"')
    corpo.add(f'<path d="{P_SVG["peitoral"]}" fill="{g_peitoral}" stroke="#ffedd5" stroke-width="{1.4*k:.1f}"/>')
    corpo.add(f'<path d="{P_SVG["pescoco"]}" fill="{g_asa_med}" stroke="{OURO_BRANCO}" stroke-width="{1*k:.1f}"/>')
    
    # Crista com Glow triplo
    corpo.add(f'<path d="{P_SVG["crista"]}" fill="none" stroke="{g_asa_int}" stroke-width="{3.2*k:.1f}" stroke-linecap="round" filter="{f_glow_forte}"/>')
    corpo.add(f'<path d="{P_SVG["crista"]}" fill="none" stroke="{BRANCO_PURO}" stroke-width="{1.2*k:.1f}" stroke-linecap="round"/>')
    
    corpo.add(f'<path d="{P_SVG["cabeca"]}" fill="{g_asa_int}" stroke="{BRANCO_PURO}" stroke-width="{1.2*k:.1f}" filter="{f_glow}"/>')
    
    # Olho de Diamante
    corpo.add(f'<circle cx="{134*k:.1f}" cy="{59.5*k:.1f}" r="{2.2*k:.1f}" fill="{BRANCO_PURO}" filter="{f_glow}"/>')
    corpo.add(f'<circle cx="{134.5*k:.1f}" cy="{59*k:.1f}" r="{0.8*k:.1f}" fill="#c2410c"/>')

    # 5. O Coração Magmático (Pulsante)
    gema = c.camada("gema", z=5, classe="fv3-coracao")
    gema.add(f'<path d="{P_SVG["gema_peito"]}" fill="{g_gema}" stroke="{BRANCO_PURO}" stroke-width="{1.5*k:.1f}"/>')
    gema.add(f'<path d="{P_SVG["gema_brilho"]}" fill="{BRANCO_PURO}" opacity=".7"/>')
    gema.add(f'<circle cx="{130*k:.1f}" cy="{122*k:.1f}" r="{3.5*k:.1f}" fill="{BRANCO_PURO}" filter="{f_glow_forte}"/>')

    # 6. Partículas e Brasas Dinâmicas V3 (Forja Engine)
    # Muito mais vivas que a V1 porque o Forja gera tamanhos estocásticos 
    # e delays determinísticos através da seed `sem`.
    brasas = c.camada("particulas", z=6, classe="fv3-brasas")
    # Emitidas a partir das chamas da cauda e crista
    for i in range(35):
        # Distribuição ao redor
        ang = math.radians((i * 12.8 + (i % 3) * 7) % 360 - 90)
        r = (65 + (i % 5) * 16 + (i % 2) * 8) * k
        bx, by = aro_cx + r * math.cos(ang), 125 * k + r * math.sin(ang)
        sz = (1.6 + (i % 4) * 0.8) * k
        
        op = 0.95 if i % 3 == 0 else (0.75 if i % 2 == 0 else 0.55)
        delay = i * 0.18
        dur = 2.2 + (i % 4) * 0.4
        
        brasas.add(
            f'<g style="animation-delay:{delay:.2f}s; animation-duration:{dur:.2f}s">'
            f'<circle cx="{bx:.1f}" cy="{by:.1f}" r="{sz:.1f}" fill="{OURO_BRANCO}" opacity="{op}" filter="{f_glow}"/>'
            f'<circle cx="{bx:.1f}" cy="{by:.1f}" r="{(sz*1.8):.1f}" fill="#f97316" opacity="{op*0.5}" filter="{f_glow_forte}"/>'
            f'</g>'
        )

    # 7. Regras Cinéticas CSS (Restritas ao Escopo Fênix V3)
    c.css(f"""
    .fv3-roda-fundo {{ transform-origin: {aro_cx:.1f}px {aro_cy:.1f}px; animation: fv3-spin 35s linear infinite; }}
    .fv3-cometa     {{ transform-origin: {aro_cx:.1f}px {aro_cy:.1f}px; animation: fv3-spin 3.2s linear infinite; }}
    .fv3-coracao    {{ transform-origin: {130*k:.1f}px {122*k:.1f}px; animation: fv3-pulse 3s ease-in-out infinite; }}
    
    .fv3-brasas g {{
        transform-origin: {aro_cx:.1f}px {125*k:.1f}px;
        animation-name: fv3-crepitar;
        animation-timing-function: ease-in-out;
        animation-iteration-count: infinite;
        animation-direction: alternate;
    }}

    @keyframes fv3-spin {{ 100% {{ transform: rotate(360deg); }} }}
    @keyframes fv3-pulse {{
        0%, 100% {{ transform: scale(1); filter: brightness(1) drop-shadow(0 0 4px #fb923c); }}
        50%      {{ transform: scale(1.08); filter: brightness(1.2) drop-shadow(0 0 10px #fff7ed); }}
    }}
    @keyframes fv3-crepitar {{
        0%   {{ transform: scale(0.8) translate(0, 0); opacity: 0.6; }}
        50%  {{ transform: scale(1.2) translate(0, -5px); opacity: 1; }}
        100% {{ transform: scale(0.9) translate(0, -2px); opacity: 0.8; }}
    }}

    @media (prefers-reduced-motion: reduce) {{
        .fv3-roda-fundo, .fv3-cometa, .fv3-coracao, .fv3-brasas g {{ animation: none !important; }}
    }}
    """)
    return c


def aura(vb: int = 300) -> Tela:
    """
    A AURA FÊNIX V3 — Coroa Radiante
    Faz parte do conjunto cerimonial. 
    Uma expansão monumental de energia e luz incandescente.
    """
    c = Tela("fenix-v3-aura", vb)
    sem = P.Semente(20260811)
    cx, cy = c.centro
    k = vb / 300.0

    g_fogo = c.radial("fogo", [
        (0.00, "#ffb703", .40), (0.45, "#fb8500", .15), (1.00, "#6a040f", 0)])
    f_glow = c.brilho("glow", 5 * k, 1.4)
    corte = c.recorte_circular("corte", cx, cy, 142 * k)

    # 1. Véu Magmático (Fundo Térmico)
    c.camada("veu", z=0, classe="fa3-veu").add(
        f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{145*k:.1f}" fill="{g_fogo}"/>')

    # 2. Coroas de Choque Solares (Expansão contínua)
    ondas = c.camada("ondas", z=1, atributos=f'filter="{f_glow}" clip-path="{corte}"')
    # Aro de Ouro
    ondas.add(f'<circle class="fa3-onda" cx="{cx:.1f}" cy="{cy:.1f}" r="{135*k:.1f}" fill="none" stroke="#ffb703" stroke-width="{3*k:.1f}" stroke-dasharray="{6*k:.1f} {12*k:.1f}" opacity="0.8" style="animation-delay:0s"/>')
    # Aro de Fogo
    ondas.add(f'<circle class="fa3-onda" cx="{cx:.1f}" cy="{cy:.1f}" r="{135*k:.1f}" fill="none" stroke="#ea580c" stroke-width="{1.5*k:.1f}" stroke-dasharray="{15*k:.1f} {30*k:.1f}" opacity="0.6" style="animation-delay:0.7s"/>')

    # 3. Labaredas Radiais Extensas (Sol Eclíptico)
    erupcoes = c.camada("erupcoes", z=2, classe="fa3-girar-lento", atributos=f'clip-path="{corte}"')
    for i in range(16):
        ang = math.radians((360 / 16) * i)
        bx = cx + 45 * k * math.cos(ang)
        by = cy + 45 * k * math.sin(ang)
        # O motor de labaredas cria chamas orgânicas matemáticas
        fogo = P.labareda((bx, by), 130 * k, 20 * k, sem, inclinacao=40)
        
        rot = (360 / 16) * i + 90
        erupcoes.add(f'<path class="fa3-pulsar-chama" d="{fogo}" fill="#fb8500" opacity="0.4" '
                     f'transform="rotate({rot} {bx:.1f} {by:.1f})" '
                     f'style="animation-delay:{i*0.15:.2f}s"/>')

    # 4. Cinzas Ascendentes Vivas
    brasas = c.camada("brasas", z=3, classe="fa3-brasas", atributos=f'clip-path="{corte}"')
    for i in range(25):
        bx = cx + sem.entre(-80*k, 80*k)
        by = cy + sem.entre(-20*k, 120*k)
        r = sem.entre(1.5*k, 4.5*k)
        op = sem.entre(0.5, 1.0)
        dur = sem.entre(2.0, 4.0)
        atraso = sem.entre(0, 3.0)
        brasas.add(f'<circle cx="{bx:.1f}" cy="{by:.1f}" r="{r:.1f}" fill="#ffb703" opacity="{op:.2f}" '
                   f'style="animation-duration:{dur:.2f}s; animation-delay:{atraso:.2f}s"/>')

    c.css(f"""
    .fa3-veu {{ transform-origin: {cx:.1f}px {cy:.1f}px; animation: fa3-respirar 4.5s ease-in-out infinite; }}
    @keyframes fa3-respirar {{
        0%, 100% {{ opacity: .65; transform: scale(1); }}
        50% {{ opacity: 1; transform: scale(1.05); }}
    }}
    
    .fa3-onda {{
        transform-origin: {cx:.1f}px {cy:.1f}px;
        animation: fa3-expandir 2.8s cubic-bezier(.1,.7,.3,1) infinite;
    }}
    @keyframes fa3-expandir {{
        0% {{ transform: scale(0.1); opacity: 1; stroke-width: {6*k:.1f}px; }}
        100% {{ transform: scale(1.1); opacity: 0; stroke-width: {1*k:.1f}px; }}
    }}
    
    .fa3-girar-lento {{
        transform-origin: {cx:.1f}px {cy:.1f}px;
        animation: fa3-spin 45s linear infinite;
    }}
    @keyframes fa3-spin {{ 100% {{ transform: rotate(360deg); }} }}
    
    .fa3-pulsar-chama {{ animation: fa3-flicker 1.8s ease-in-out infinite alternate; }}
    @keyframes fa3-flicker {{
        0% {{ opacity: 0.2; transform: scaleY(0.85); }}
        100% {{ opacity: 0.6; transform: scaleY(1.15); }}
    }}
    
    .fa3-brasas circle {{
        animation-name: fa3-subir;
        animation-timing-function: cubic-bezier(.3,0,.7,1);
        animation-iteration-count: infinite;
    }}
    @keyframes fa3-subir {{
        0%   {{ transform: translateY(20px) scale(0.5); opacity: 0; }}
        30%  {{ opacity: 1; }}
        100% {{ transform: translateY(-100px) scale(1.2); opacity: 0; }}
    }}
    
    @media (prefers-reduced-motion: reduce) {{
        .fa3-veu, .fa3-onda, .fa3-girar-lento, .fa3-pulsar-chama, .fa3-brasas circle {{ animation: none; }}
    }}
    """)
    return c
