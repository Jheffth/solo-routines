# -*- coding: utf-8 -*-
"""
A FÊNIX V3 (A COROA SOLAR) — insígnia e aura paramétricas.
Uma entidade puramente matemática e de fogo.
"""
from __future__ import annotations
import math

from .. import geometria as G
from .. import pincel as P
from ..tela import Tela

DOURADO = "#ffb703"
LARANJA = "#fb8500"
CARMESIM = "#d00000"
VINHO = "#6a040f"
BRANCO = "#ffffff"


def lapidar_gema(cx: float, cy: float, raio_ext: float, raio_int: float, lados: int,
                 cor_base: str, cor_brilho: str, cor_sombra: str) -> str:
    """Uma joia poligonal 3D, útil para corações/núcleos."""
    svg = []
    # Base
    pts_base = []
    for i in range(lados):
        ang = math.radians((360 / lados) * i - 90)
        pts_base.append(f"{cx + raio_ext * math.cos(ang):.1f},{cy + raio_ext * math.sin(ang):.1f}")
    svg.append(f'<polygon points="{" ".join(pts_base)}" fill="{cor_base}"/>')
    
    # Facetas
    for i in range(lados):
        ang1 = math.radians((360 / lados) * i - 90)
        ang2 = math.radians((360 / lados) * (i + 1) - 90)
        
        p1 = (cx + raio_ext * math.cos(ang1), cy + raio_ext * math.sin(ang1))
        p2 = (cx + raio_ext * math.cos(ang2), cy + raio_ext * math.sin(ang2))
        p_int1 = (cx + raio_int * math.cos(ang1), cy + raio_int * math.sin(ang1))
        p_int2 = (cx + raio_int * math.cos(ang2), cy + raio_int * math.sin(ang2))
        
        c_ext = cor_brilho if i < lados / 2 else cor_sombra
        c_int = cor_brilho if i % 2 == 0 else cor_sombra
        
        svg.append(f'<polygon points="{p_int1[0]:.1f},{p_int1[1]:.1f} {p1[0]:.1f},{p1[1]:.1f} {p2[0]:.1f},{p2[1]:.1f} {p_int2[0]:.1f},{p_int2[1]:.1f}" fill="{c_ext}"/>')
        svg.append(f'<polygon points="{cx:.1f},{cy:.1f} {p_int1[0]:.1f},{p_int1[1]:.1f} {p_int2[0]:.1f},{p_int2[1]:.1f}" fill="{c_int}"/>')
    
    return "\n".join(svg)


def _eixo_asa(vb: int, lado: int):
    """
    O arco estrutural de uma asa.
    Nasce no centro embaixo e sobe arqueando para fora.
    """
    k = vb / 300.0
    # Se lado == 1 (direita), else -1 (esquerda)
    cx = 150 * k
    return [(cx + 20 * lado * k, 220 * k),
            (cx + 70 * lado * k, 150 * k),
            (cx + 90 * lado * k, 70 * k),
            (cx + 50 * lado * k, 30 * k)]


def insignia(vb: int = 300) -> Tela:
    c = Tela("fenix-v3-insignia", vb)
    sem = P.Semente(20260801)
    cx, cy = c.centro
    k = vb / 300.0

    # ── materiais ────────────────────────────────────────────────────
    g_fogo_vivo = c.linear("fogo_vivo", [
        (0.00, DOURADO, 1), (0.40, LARANJA, 1),
        (0.70, CARMESIM, 1), (1.00, VINHO, 1)], 0, 1, 0, 0)
    g_ouro = c.linear("ouro", [
        (0.00, "#ffea00", 1), (0.50, "#ffb703", 1), (1.00, "#fb8500", 1)], 0, 0, 1, 1)
    g_brasa = c.radial("brasa", [
        (0.00, DOURADO, .40), (0.40, LARANJA, .20), (1.00, VINHO, 0)])
    f_sombra = c.sombra("sombra", 0, 4 * k, 4 * k, "#000", .8)
    f_brilho = c.brilho("brilho", 3 * k, 1.2)

    # ── Fundo: Halo Solar ────────────────────────────────────────────
    c.camada("halo", z=0, desfoque=2 * k).add(
        f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{115*k:.1f}" fill="{g_brasa}"/>')

    # ── Coroa Cinética (Aro orbital nas costas) ──────────────────────
    coroa = c.camada("coroa", z=1, classe="fv3-girar-lento", opacidade=.4)
    # Aros cruzados
    for m in P.anel_tracejado((cx, cy), 100 * k, 36, 12 * k, 2 * k):
        coroa.add(f'<path d="{m}" fill="{g_ouro}"/>')
    for m in P.anel_tracejado((cx, cy), 115 * k, 12, 4 * k, 4 * k):
        coroa.add(f'<path d="{m}" fill="{CARMESIM}"/>')

    # ── Asas de Fogo (Geometria Paramétrica) ─────────────────────────
    # Em vez de desenhar um pássaro, desenhamos 6 arcos de plumagem
    asas = c.camada("asas", z=2)
    for lado in (1, -1):
        eixo_princ = _eixo_asa(vb, lado)
        # Asa primária (fogo longo)
        plumas_prim = P.plumagem(eixo_princ, sem, n=45, escala=55 * k, inclinacao=0.7,
                                 largura_barba=5 * k, lado=lado, curvatura=0.3,
                                 comprimento=lambda t: math.sin(math.pi * t) ** 0.5)
        for d in plumas_prim:
            asas.add(f'<path d="{d}" fill="{g_fogo_vivo}" opacity="0.9"/>')
            
        # Asa secundária (ouro curto)
        eixo_sec = [(cx + 15 * lado * k, 190 * k), (cx + 50 * lado * k, 140 * k),
                    (cx + 60 * lado * k, 90 * k), (cx + 40 * lado * k, 60 * k)]
        plumas_sec = P.plumagem(eixo_sec, sem, n=30, escala=35 * k, inclinacao=0.8,
                                largura_barba=3.5 * k, lado=lado, curvatura=0.4,
                                comprimento=lambda t: math.sin(math.pi * t) ** 0.8)
        for d in plumas_sec:
            asas.add(f'<path d="{d}" fill="{g_ouro}" opacity="0.85"/>')

    # ── O Coração / Corpo (Gema) ─────────────────────────────────────
    corpo = c.camada("coracao", z=3, atributos=f'filter="{f_sombra}"')
    gema_svg = lapidar_gema(cx, cy + 20 * k, 45 * k, 18 * k, 12, 
                            cor_base=VINHO, cor_brilho=LARANJA, cor_sombra=CARMESIM)
    corpo.add(f'<g class="fv3-pulsar">{gema_svg}</g>')
    
    # ── Labaredas subindo do coração ─────────────────────────────────
    chamas = c.camada("chamas", z=4, classe="fv3-flicker")
    for _ in range(5):
        base_x = cx + sem.entre(-20 * k, 20 * k)
        base_y = cy + 10 * k
        altura = sem.entre(60 * k, 120 * k)
        larg = sem.entre(8 * k, 15 * k)
        incl = sem.entre(-15, 15)
        fogo = P.labareda((base_x, base_y), altura, larg, sem, incl)
        chamas.add(f'<path d="{fogo}" fill="{g_ouro}" opacity="0.8"/>')

    # ── Assinatura da V3 (A Vontade do Monarca) ──────────────────────
    assinatura = c.camada("assinatura", z=5, classe="fv3-assina", atributos=f'filter="{f_brilho}"')
    pts = [(cx - 50 * k, cy + 90 * k), (cx, cy + 120 * k), 
           (cx + 50 * k, cy + 80 * k), (cx + 20 * k, cy + 140 * k)]
    assinatura.add(f'<path d="{P.floreio(pts, 6 * k)}" fill="{BRANCO}" opacity="0.9"/>')

    # ── Partículas Ascendentes (Brasas) ──────────────────────────────
    brasas = c.camada("brasas", z=6, classe="fv3-brasas")
    for g in P.particulas((cx, cy + 40 * k), 10 * k, 80 * k, 20, sem, 1.5 * k, 3.5 * k):
        brasas.add(
            f'<circle cx="{g["x"]:.1f}" cy="{g["y"]:.1f}" r="{g["r"]:.1f}" '
            f'fill="{DOURADO}" opacity="{g["op"]}" '
            f'style="animation-delay:{g["atraso"]}s;animation-duration:{g["dur"]}s"/>')

    c.css(f"""
    .fv3-girar-lento {{ transform-origin: {cx:.1f}px {cy:.1f}px; animation: fv3-spin 45s linear infinite; }}
    @keyframes fv3-spin {{ 100% {{ transform: rotate(360deg); }} }}
    
    .fv3-pulsar {{ transform-origin: {cx:.1f}px {cy+20*k:.1f}px; animation: fv3-pulse 3s ease-in-out infinite; }}
    @keyframes fv3-pulse {{
        0%, 100% {{ transform: scale(1); filter: brightness(1); }}
        50% {{ transform: scale(1.05); filter: brightness(1.3); }}
    }}
    
    .fv3-flicker path {{ animation: fv3-flick 1.5s infinite alternate; }}
    @keyframes fv3-flick {{
        0% {{ opacity: 0.6; transform: scaleY(0.95); }}
        100% {{ opacity: 1; transform: scaleY(1.1); }}
    }}
    
    .fv3-brasas circle {{
        animation-name: fv3-subir;
        animation-timing-function: cubic-bezier(.2,.8,.4,1);
        animation-iteration-count: infinite;
    }}
    @keyframes fv3-subir {{
        0%   {{ opacity: 0; transform: translateY(20px) scale(0.5); }}
        20%  {{ opacity: 1; transform: translateY(0) scale(1.2); }}
        100% {{ opacity: 0; transform: translateY(-80px) scale(0.2); }}
    }}
    
    .fv3-assina path {{ animation: fv3-escrever 6s ease-in-out infinite; }}
    @keyframes fv3-escrever {{
        0%, 10% {{ opacity: 0; }}
        30%, 70% {{ opacity: 1; }}
        100% {{ opacity: 0; }}
    }}
    
    @media (prefers-reduced-motion: reduce) {{
        .fv3-girar-lento, .fv3-pulsar, .fv3-flicker path, .fv3-brasas circle, .fv3-assina path {{ animation: none; }}
    }}
    """)
    return c


def aura(vb: int = 300) -> Tela:
    """
    A AURA FÊNIX V3 — Supernova.
    Oposta à Pena (que cai e contrai), a V3 queima, sobe e expande.
    """
    c = Tela("fenix-v3-aura", vb)
    sem = P.Semente(20260802)
    cx, cy = c.centro
    k = vb / 300.0

    g_fogo = c.radial("fogo", [
        (0.00, DOURADO, .35), (0.40, LARANJA, .15), (1.00, VINHO, 0)])
    f_glow = c.brilho("glow", 4 * k, 1.2)
    corte = c.recorte_circular("corte", cx, cy, 145 * k)

    # Véu incandescente
    c.camada("veu", z=0, classe="fa3-veu").add(
        f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{145*k:.1f}" fill="{g_fogo}"/>')

    # Ondas de Choque Solares (Expansão contínua)
    ondas = c.camada("ondas", z=1, atributos=f'filter="{f_glow}" clip-path="{corte}"')
    for j, (r, w, dash, cor, op, atraso) in enumerate([
            (20, 2.5, f"{5*k:.1f} {10*k:.1f}", DOURADO, .8, 0.0),
            (40, 1.5, f"{10*k:.1f} {20*k:.1f}", LARANJA, .6, 0.8),
            (60, 3.0, "none", CARMESIM, .4, 1.6)]):
        ondas.add(
            f'<circle class="fa3-onda" cx="{cx:.1f}" cy="{cy:.1f}" r="{140*k:.1f}" '
            f'fill="none" stroke="{cor}" stroke-width="{w*k:.2f}" '
            f'stroke-dasharray="{dash}" stroke-linecap="round" opacity="{op}" '
            f'style="animation-delay:{atraso}s"/>')

    # Erupções Solares (Labaredas radiais que giram e estouram para fora)
    erupcoes = c.camada("erupcoes", z=2, classe="fa3-girar-fogo", atributos=f'clip-path="{corte}"')
    for i in range(12):
        ang = math.radians((360 / 12) * i)
        dist = 40 * k
        bx = cx + dist * math.cos(ang)
        by = cy + dist * math.sin(ang)
        fogo = P.labareda((bx, by), 120 * k, 18 * k, sem, inclinacao=45)
        # Apontando para fora
        rot = (360 / 12) * i + 90
        erupcoes.add(f'<path class="fa3-erupcao" d="{fogo}" fill="{LARANJA}" opacity="0.5" '
                     f'transform="rotate({rot} {bx:.1f} {by:.1f})" '
                     f'style="animation-delay:{i*0.2:.2f}s"/>')

    # Brasas Vulcânicas
    brasas = c.camada("brasas", z=3, classe="fa3-brasas", atributos=f'clip-path="{corte}"')
    for g in P.particulas((cx, cy), 20 * k, 120 * k, 25, sem, 1.5 * k, 4.0 * k):
        brasas.add(
            f'<circle cx="{g["x"]:.1f}" cy="{g["y"]:.1f}" r="{g["r"]:.1f}" '
            f'fill="{DOURADO}" opacity="{g["op"]}" '
            f'style="animation-delay:{g["atraso"]}s;animation-duration:{g["dur"]}s"/>')

    c.css(f"""
    .fa3-veu {{ animation: fa3-respirar 4s ease-in-out infinite; transform-origin: {cx:.1f}px {cy:.1f}px; }}
    @keyframes fa3-respirar {{
        0%, 100% {{ opacity: .6; transform: scale(1); }}
        50% {{ opacity: 1; transform: scale(1.03); }}
    }}
    
    .fa3-onda {{
        transform-origin: {cx:.1f}px {cy:.1f}px;
        animation: fa3-expandir 2.4s cubic-bezier(.1,.6,.3,1) infinite;
    }}
    @keyframes fa3-expandir {{
        0% {{ transform: scale(0); opacity: 1; }}
        100% {{ transform: scale(1.1); opacity: 0; }}
    }}
    
    .fa3-girar-fogo {{
        transform-origin: {cx:.1f}px {cy:.1f}px;
        animation: fa3-spin 30s linear infinite;
    }}
    @keyframes fa3-spin {{ 100% {{ transform: rotate(360deg); }} }}
    
    .fa3-erupcao {{ animation: fa3-explode 2s ease-in-out infinite alternate; }}
    @keyframes fa3-explode {{
        0% {{ opacity: 0.2; transform: scaleY(0.8); }}
        100% {{ opacity: 0.8; transform: scaleY(1.2); }}
    }}
    
    .fa3-brasas circle {{
        animation-name: fa3-flutuar;
        animation-timing-function: cubic-bezier(.4,0,.2,1);
        animation-iteration-count: infinite;
    }}
    @keyframes fa3-flutuar {{
        0%   {{ transform: scale(0.1) translateY(0); opacity: 0; }}
        20%  {{ opacity: 1; }}
        100% {{ transform: scale(1.5) translateY(-60px); opacity: 0; }}
    }}
    
    @media (prefers-reduced-motion: reduce) {{
        .fa3-veu, .fa3-onda, .fa3-girar-fogo, .fa3-erupcao, .fa3-brasas circle {{ animation: none; }}
    }}
    """)
    return c
