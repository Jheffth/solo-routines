# -*- coding: utf-8 -*-
"""
A INSÍGNIA ISABELLA COSTA (FEMME FATALE) — construída pelo motor Forja.

Esta versão utiliza a "Abordagem Definitiva (O Método Base64)" com a arte do laço
rosa, envelopada em efeitos SVG nativos: anéis giratórios, aros com lâminas S-Rank
girando no sentido contrário e a aura rosa.
"""
from __future__ import annotations
import math

from .. import pincel as P
from ..tela import Tela

# Paleta "Femme Fatale"
ROSA_CLARO = "#f8bbd0"
ROSA_MEDIO = "#f48fb1"
ROSA_FORTE = "#e91e63"
BURGUNDY   = "#880e4f"
DARK_PINK  = "#4a0020"

def insignia(vb: int = 300) -> Tela:
    c = Tela("isabella-insignia", vb)
    sem = P.Semente(20260802)
    cx, cy = c.centro
    k = vb / 300.0

    from .isabella_b64 import ISABELLA_PNG_B64

    # ── materiais ────────────────────────────────────────────────────
    g_fundo = c.radial("fundo", [(0.00, ROSA_FORTE, .15), (0.80, BURGUNDY, 0)])
    f_glow_laminas = c.brilho("brilho_laminas", 1.5 * k, 1.2)
    f_glow_contorno = c.sombra("sombra_contorno", 0, 0, 12.0 * k, ROSA_FORTE, .6)

    # ── o véu, bem ao fundo e desfocado ──────────────────────────────
    c.camada("veu", z=0, desfoque=2.0 * k).add(
        f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{145*k:.1f}" fill="{g_fundo}"/>')

    # ── Fundo Animado: Círculo Giratório + Lâminas S-Rank ────────────
    bg_fx = c.camada("bg_fx", z=1, atributos=f'filter="{f_glow_laminas}"')
    
    # Círculo base girando (sentido horário)
    bg_fx.add(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{115*k:.1f}" fill="none" '
              f'stroke="{ROSA_FORTE}" stroke-width="{1.5*k:.2f}" stroke-dasharray="{6*k:.1f} {12*k:.1f}" '
              f'class="isa-spin"/>')
              
    # Lâminas no padrão Solo Routines girando no sentido anti-horário (Wireframe elegante)
    pontas = []
    r_int = 125 * k
    for i in range(12):
        a = (math.pi / 6) * i - math.pi / 2
        r_ext = 145 * k if i % 2 == 0 else 132 * k
        a_m = a - math.pi / 16
        a_p = a + math.pi / 16
        x0 = cx + r_int * math.cos(a_m)
        y0 = cy + r_int * math.sin(a_m)
        x1 = cx + r_ext * math.cos(a)
        y1 = cy + r_ext * math.sin(a)
        x2 = cx + r_int * math.cos(a_p)
        y2 = cy + r_int * math.sin(a_p)
        pontas.append(f'M {x0:.1f} {y0:.1f} L {x1:.1f} {y1:.1f} L {x2:.1f} {y2:.1f} Z')
        
    caminhos = "".join(f'<path d="{p}"/>' for p in pontas)
    bg_fx.add(f'<g class="isa-spin-reverse" fill="none" stroke="{ROSA_CLARO}" stroke-width="{1.5*k:.1f}" stroke-opacity=".9">'
              f'{caminhos}</g>')

    # ── A ARTE PRINCIPAL (Laço Rosa PNG Base64 - Arte Complexa Recortada) ──
    img_h = 240 * k
    img_w = round(img_h, 1)
    img_x = round(cx - img_w / 2, 1)
    img_y = round(cy - img_h / 2, 1)
    
    main = c.camada("main", z=2, atributos=f'filter="{f_glow_contorno}"')
    main.add(
        f'<image href="data:image/png;base64,{ISABELLA_PNG_B64}" '
        f'x="{img_x}" y="{img_y}" width="{img_w}" height="{img_h}" '
        f'preserveAspectRatio="xMidYMid meet" />'
    )

    # ── Cintilação Única da Bella Costa ──────────────────────────────
    gotas = c.camada("gotas", z=3, classe="isa-gotas", atributos=f'filter="{f_glow_laminas}"')
    for g in P.particulas((cx, cy), 130 * k, 140 * k, 18, sem, 1.0 * k, 3.0 * k):
        # Distribui as partículas em volta da insígnia, em vez de subindo
        gotas.add(
            f'<circle cx="{g["x"]:.1f}" cy="{g["y"]:.1f}" r="{g["r"]:.1f}" '
            f'fill="#ffffff" opacity="0" '
            f'style="animation-delay:{g["atraso"]}s;animation-duration:{g["dur"]}s"/>')

    c.css(f"""
    /* Rotações infinitas para as lâminas e anéis */
    .isa-spin {{
      transform-origin: {cx:.1f}px {cy:.1f}px;
      animation: isa-girar 28s linear infinite;
    }}
    .isa-spin-reverse {{
      transform-origin: {cx:.1f}px {cy:.1f}px;
      animation: isa-girar 38s linear infinite reverse;
    }}
    @keyframes isa-girar {{
      to {{ transform: rotate(360deg); }}
    }}
    
    .isa-gotas circle {{
      animation-name: isa-cintilar;
      animation-timing-function: ease-in-out;
      animation-iteration-count: infinite;
    }}
    @keyframes isa-cintilar {{
      0%, 100% {{ opacity: 0; transform: scale(0.5); }}
      50%      {{ opacity: 1; transform: scale(1.5); box-shadow: 0 0 10px #f8bbd0; }}
    }}
    
    @media (prefers-reduced-motion: reduce) {{
      .isa-spin, .isa-spin-reverse {{ animation: none; }}
      .isa-gotas circle {{ animation: none; opacity: .7; }}
    }}
    """)
    return c


def aura(vb: int = 300) -> Tela:
    """
    Aura da Bella Costa — Baseada num pulso respiratório elegante e sensual.
    """
    c = Tela("isabella-aura", vb)
    cx, cy = c.centro
    k = vb / 300.0

    g_veu = c.radial("veu", [
        (0.00, ROSA_CLARO, .25), (0.45, ROSA_FORTE, .15), (1.00, BURGUNDY, 0)])
    
    c.camada("veu", z=0, classe="isa-aura-pulso").add(
        f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{148*k:.1f}" fill="{g_veu}"/>')

    c.css(f"""
    .isa-aura-pulso {{ 
      transform-origin: {cx:.1f}px {cy:.1f}px;
      animation: isa-respirar 4.2s ease-in-out infinite; 
    }}
    @keyframes isa-respirar {{
      0%, 100% {{ opacity: .6; transform: scale(1); }}
      50%      {{ opacity: 1;  transform: scale(1.08); }}
    }}
    @media (prefers-reduced-motion: reduce) {{
      .isa-aura-pulso {{ animation: none; }}
    }}
    """)
    return c
