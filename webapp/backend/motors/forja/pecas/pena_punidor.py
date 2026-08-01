# -*- coding: utf-8 -*-
"""
A PENA DO PUNIDOR — insígnia e aura, construídas pelo motor.

Esta versão utiliza a "Abordagem Definitiva (O Método Base64)" com uma arte premium
gerada por Inteligência Artificial (fundo removido), envelopada em efeitos de
luz, sombra e partículas 100% SVG.
"""
from __future__ import annotations
import math

from .. import geometria as G
from .. import pincel as P
from ..tela import Tela

CARMESIM = "#ff0a3c"
AZUL = "#2b6bff"
NANQUIM = "#12101c"

def insignia(vb: int = 300) -> Tela:
    c = Tela("pena-punidor-insignia", vb)
    sem = P.Semente(20260731)
    cx, cy = c.centro
    k = vb / 300.0

    from .pena_punidor_b64 import PENA_PNG_B64

    # ── materiais ────────────────────────────────────────────────────
    g_tinta = c.linear("tinta", [
        (0.00, CARMESIM, 1), (0.55, "#a2185a", 1), (1.00, AZUL, 1)], 0, 0, 1, 1)
    g_fundo = c.radial("fundo", [
        (0.00, CARMESIM, .35), (0.55, "#5c0f28", .20), (1.00, AZUL, 0)])
    
    # Efeito de "Aura no Contorno": uma sombra/brilho forte que vaza da imagem
    f_glow_contorno = c.sombra("sombra_contorno", 0, 0, 8.0 * k, CARMESIM, .9)
    f_brilho = c.brilho("brilho", 2.4 * k, 1.15)

    # ── o véu, bem ao fundo e desfocado ──────────────────────────────
    c.camada("veu", z=0, desfoque=1.2 * k).add(
        f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{148*k:.1f}" fill="{g_fundo}"/>')

    # ── a moldura: selo discreto ─────────────────────────────────────
    moldura = c.camada("selo", z=1, opacidade=.45)
    for m in P.anel_tracejado((cx, cy), 142 * k, 84, 3.4 * k, 1.1 * k):
        moldura.add(f'<path d="{m}" fill="{CARMESIM}"/>')
    moldura.add(
        f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{128*k:.1f}" fill="none" '
        f'stroke="{AZUL}" stroke-width="{1.2*k:.2f}" stroke-opacity=".6" '
        f'stroke-dasharray="{1.5*k:.1f} {13*k:.1f}"/>')

    # ── A ARTE PRINCIPAL (PNG Base64) ────────────────────────────────
    # A imagem tem 726x804 (quase quadrada, levemente mais alta).
    # O usuário pediu escala épica (S-Rank), um pouco maior que o Lobo (295px).
    # Vamos usar img_h = 315. Como o Forja só dá overflow se > vb+300, 315 é seguro.
    img_h = 315 * k
    img_w = round(726 / 804 * img_h, 1)
    img_x = round(cx - img_w / 2, 1)
    img_y = round(cy - img_h / 2, 1)
    
    main = c.camada("main", z=2, atributos=f'filter="{f_glow_contorno}"')
    main.add(
        f'<image href="data:image/png;base64,{PENA_PNG_B64}" '
        f'x="{img_x}" y="{img_y}" width="{img_w}" height="{img_h}" '
        f'preserveAspectRatio="xMidYMid meet" />'
    )

    # ── a assinatura: o gesto que prova que houve uma mão ────────────
    pts = [(74 * k, 260 * k), (110 * k, 282 * k), (168 * k, 276 * k),
           (206 * k, 254 * k)]
    c.camada("assinatura", z=6, classe="fp-assina",
             atributos=f'filter="{f_brilho}"').add(
        f'<path d="{P.floreio(pts, 5.2*k)}" fill="{g_tinta}"/>')

    # ── gotas de tinta e energia (partículas em torno do contorno) ───
    gotas = c.camada("gotas", z=7, classe="fp-gotas", atributos=f'filter="{f_glow_contorno}"')
    # O centro inferior para sair a energia (bico virtual da pena)
    for g in P.particulas((cx, cy + 120 * k), 10 * k, 35 * k, 12, sem, 1.6 * k, 4.2 * k):
        gotas.add(
            f'<circle cx="{g["x"]:.1f}" cy="{g["y"]:.1f}" r="{g["r"]:.1f}" '
            f'fill="{CARMESIM}" opacity="{g["op"]}" '
            f'style="animation-delay:{g["atraso"]}s;animation-duration:{g["dur"]}s"/>')
            
    # Mais algumas partículas roxas para simular a energia subindo
    for g in P.particulas((cx, cy + 60 * k), 25 * k, 60 * k, 8, sem, 1.2 * k, 2.5 * k):
        gotas.add(
            f'<circle cx="{g["x"]:.1f}" cy="{g["y"]:.1f}" r="{g["r"]:.1f}" '
            f'fill="{AZUL}" opacity="{g["op"]}" '
            f'style="animation-delay:{g["atraso"]}s;animation-duration:{g["dur"]}s"/>')

    c.css(f"""
    /* NADA GIRA. A rotação é a assinatura da Fênix. */
    .fp-assina path {{ animation: fp-escrever 6s ease-in-out infinite; }}
    @keyframes fp-escrever {{
      0%, 8%   {{ opacity: 0; }}
      26%, 74% {{ opacity: 1; }}
      100%     {{ opacity: 0; }}
    }}
    .fp-gotas circle {{
      animation-name: fp-pingar;
      animation-timing-function: cubic-bezier(.4,0,.9,.4);
      animation-iteration-count: infinite;
    }}
    @keyframes fp-pingar {{
      0%   {{ opacity: 0; transform: translateY(10px) scale(0.8); }}
      30%  {{ opacity: .9; transform: translateY(0px) scale(1.2); }}
      100% {{ opacity: 0; transform: translateY(-30px) scale(0.5); }}
    }}
    @media (prefers-reduced-motion: reduce) {{
      .fp-assina path, .fp-gotas circle {{ animation: none; opacity: .85; }}
    }}
    """)
    return c


def aura(vb: int = 300) -> Tela:
    """
    A AURA — Quatro atos verticais/contração.
    """
    c = Tela("pena-punidor-aura", vb)
    sem = P.Semente(31072026)
    cx, cy = c.centro
    k = vb / 300.0

    g_veu = c.radial("veu", [
        (0.00, CARMESIM, .30), (0.55, "#7a0f2e", .16), (1.00, AZUL, 0)])
    g_cunha = c.linear("cunha", [
        (0.00, CARMESIM, 0), (0.55, CARMESIM, .9), (1.00, "#fff", .95)], 0, 1, 0, 0)
    g_tinta = c.linear("tinta", [
        (0.00, CARMESIM, 1), (0.5, "#a2185a", 1), (1.00, AZUL, 1)], 0, 0, 1, 0)
    f_glow = c.brilho("glow", 2.4 * k, 1.1)
    corte = c.recorte_circular("corte", cx, cy, 148 * k)

    c.camada("veu", z=0, classe="fa-veu").add(
        f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{148*k:.1f}" fill="{g_veu}"/>')

    # ── a tinta que cai ──────────────────────────────────────────────
    chuva = c.camada("chuva", z=1, classe="fa-chuva",
                     atributos=f'clip-path="{corte}"')
    for i in range(18):
        x = (26 + (i * 16.4) % 248) * k
        comp = (14 + (i * 7) % 34) * k
        p0 = (x, 8 * k)
        p3 = (x, 8 * k + comp)
        p1 = (x, 8 * k + comp * .33)
        p2 = (x, 8 * k + comp * .66)
        cor = AZUL if i % 3 == 0 else CARMESIM
        chuva.add(
            f'<path d="{G.contorno([p0,p1,p2,p3], (2.2 if i%4==0 else 1.4)*k, G.perfil_folha, passos=8)}" '
            f'fill="{cor}" opacity="0" '
            f'style="animation-duration:{2.1 + ((i*13)%17)/10:.2f}s;'
            f'animation-delay:{((i*29)%31)/10:.2f}s"/>')

    # ── o selo que fecha ─────────────────────────────────────────────
    selo = c.camada("selo", z=2, atributos=f'filter="{f_glow}"')
    for j, (r, w, dash, cor, op, atraso) in enumerate([
            (140, 1.6, f"{2*k:.1f} {10*k:.1f}", CARMESIM, .60, 0.0),
            (124, 1.1, f"{1*k:.1f} {14*k:.1f}", AZUL, .45, 0.35),
            (108, 2.2, f"{26*k:.1f} {220*k:.1f}", CARMESIM, .75, 0.7)]):
        selo.add(
            f'<circle class="fa-selo" cx="{cx:.1f}" cy="{cy:.1f}" r="{r*k:.1f}" '
            f'fill="none" stroke="{cor}" stroke-width="{w*k:.2f}" '
            f'stroke-dasharray="{dash}" stroke-linecap="round" opacity="{op}" '
            f'style="animation-delay:{atraso}s"/>')

    # ── o carimbo que bate ───────────────────────────────────────────
    carimbo = c.camada("carimbo", z=3, atributos=f'filter="{f_glow}"')
    for j, ang in enumerate((0, 90, 180, 270)):
        base = (cx, cy - 130 * k)
        p3 = (cx, cy - 96 * k)
        p1 = (cx, cy - 119 * k)
        p2 = (cx, cy - 107 * k)
        d = G.contorno([base, p1, p2, p3], 26 * k, G.perfil_gota, passos=10)
        carimbo.add(
            f'<path class="fa-cunha" d="{d}" fill="{g_cunha}" opacity=".85" '
            f'transform="rotate({ang} {cx:.1f} {cy:.1f})" '
            f'style="animation-delay:{j*.18:.2f}s"/>')

    # ── a assinatura, a mesma da insígnia ────────────────────────────
    pts = [(64 * k, 246 * k), (108 * k, 272 * k), (176 * k, 264 * k), (232 * k, 236 * k)]
    c.camada("assinatura", z=4, classe="fa-assina").add(
        f'<path d="{P.floreio(pts, 6.4*k)}" fill="{g_tinta}" opacity=".9"/>')

    c.css(f"""
    /* NENHUM aura-girar. (Sem crase aqui). */
    .fa-selo {{
      transform-origin: {cx:.1f}px {cy:.1f}px;
      animation: fa-fechar 3.2s cubic-bezier(.16,.9,.3,1) infinite;
    }}
    @keyframes fa-fechar {{
      0%       {{ transform: scale(1.18); opacity: 0; }}
      22%      {{ opacity: 1; }}
      55%, 88% {{ transform: scale(1); }}
      100%     {{ transform: scale(1); opacity: .25; }}
    }}
    .fa-chuva path {{
      animation-name: fa-cair;
      animation-timing-function: cubic-bezier(.4,0,.9,.5);
      animation-iteration-count: infinite;
    }}
    @keyframes fa-cair {{
      0%   {{ transform: translateY(0); opacity: 0; }}
      12%  {{ opacity: .9; }}
      82%  {{ opacity: .55; }}
      100% {{ transform: translateY({300*k:.0f}px); opacity: 0; }}
    }}
    .fa-cunha {{
      transform-box: fill-box;
      animation: fa-bater 2.6s cubic-bezier(.2,.9,.3,1) infinite;
    }}
    @keyframes fa-bater {{
      0%, 62% {{ transform: translateY(0); opacity: .30; }}
      70%     {{ transform: translateY({26*k:.0f}px); opacity: 1; }}
      100%    {{ transform: translateY(0); opacity: .30; }}
    }}
    .fa-assina path {{ animation: fa-assinar 5.4s ease-in-out infinite; }}
    @keyframes fa-assinar {{
      0%       {{ opacity: 0; }}
      18%, 78% {{ opacity: .9; }}
      100%     {{ opacity: 0; }}
    }}
    .fa-veu {{ animation: fa-respirar 4.8s ease-in-out infinite;
               transform-origin: {cx:.1f}px {cy:.1f}px; }}
    @keyframes fa-respirar {{
      0%, 100% {{ opacity: .55; transform: scale(1); }}
      50%      {{ opacity: .9;  transform: scale(1.05); }}
    }}
    @media (prefers-reduced-motion: reduce) {{
      .fa-selo, .fa-chuva path, .fa-cunha, .fa-assina path, .fa-veu
        {{ animation: none; }}
      .fa-chuva path {{ opacity: .5; }}
    }}
    """)
    return c
