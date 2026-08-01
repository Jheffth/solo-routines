# -*- coding: utf-8 -*-
"""
A PENA DO PUNIDOR — insígnia e aura, construídas pelo motor.

A DIFERENÇA PARA AS DUAS TENTATIVAS ANTERIORES

  · a do antigravity era um sol de espinhos: 53 clones rotacionados em
    volta de uma agulha escura. A "pena" não tinha uma única barba —
    era um polígono de cinco pontos. Gramática da Fênix, que o
    Arquiteto já havia rejeitado.

  · a minha lia como pena, mas as barbas eram LINHAS de espessura
    constante. Dava um ancinho, e os dois lados se sobrepunham tanto
    que viravam um só. Silhueta de folha de palmeira.

Aqui as barbas são traços com corpo (`perfil_lamina`): saem grossas da
ráquis e morrem finas. E os dois lados têm eixos, contagens e
comprimentos DIFERENTES — pena real não é espelho.

O ASSUNTO É DESENHADO PELO MOTOR. No motor antigo a pena era uma string
crua no script de exportação; aqui não há uma única coordenada escrita à
mão que não passe por `pincel`/`geometria`.
"""
from __future__ import annotations
import math

from .. import geometria as G
from .. import pincel as P
from ..compositor import (Composicao, gradiente_linear, gradiente_radial,
                          metal, sombra_interna, brilho)

CARMESIM = "#ff0a3c"
AZUL = "#2b6bff"
NANQUIM = "#12101c"


def _eixo_pena(vb: int):
    """
    A ráquis. Nasce no bico (embaixo à esquerda) e sobe curvando.

    A curva é o que dá vida: uma pena reta parece uma flecha. O S suave
    — abre para a direita, volta no fim — é o que o olho reconhece.
    """
    k = vb / 300.0
    return [(104 * k, 232 * k), (112 * k, 158 * k),
            (150 * k, 104 * k), (214 * k, 62 * k)]


def insignia(vb: int = 300) -> Composicao:
    c = Composicao("pena-punidor-insignia", vb)
    sem = P.Semente(20260731)
    cx, cy = c.centro
    k = vb / 300.0
    eixo = _eixo_pena(vb)

    # ── materiais ────────────────────────────────────────────────────
    g_aco = c.id("aco")
    g_barba = c.id("barba")
    g_tinta = c.id("tinta")
    g_fundo = c.id("fundo")
    f_sombra = c.id("sombra")
    f_brilho = c.id("brilho")
    c.defs(
        metal(g_aco, "#2a2f3e", "#8d97ad", "#f2f5fb", angulo=118),
        gradiente_linear(g_barba, [
            (0.00, "#5b6274", 1), (0.34, "#aab3c6", 1),
            (0.62, "#e9edf6", 1), (1.00, "#7d8698", 1)], 0, 1, 1, 0),
        gradiente_linear(g_tinta, [
            (0.00, CARMESIM, 1), (0.55, "#a2185a", 1), (1.00, AZUL, 1)], 0, 0, 1, 1),
        gradiente_radial(g_fundo, [
            (0.00, CARMESIM, .28), (0.55, "#5c0f28", .16), (1.00, AZUL, 0)]),
        sombra_interna(f_sombra, 0, 3 * k, 3.2 * k, "#000", .8),
        brilho(f_brilho, 2.4 * k, 1.15),
    )

    # ── o véu, bem ao fundo e desfocado ──────────────────────────────
    # Camada com z baixo e desfoque: é o que cria AR entre o objeto e o
    # nada. Sem isso a pena flutua colada no fundo.
    c.camada("veu", z=0, desfoque=1.2 * k).add(
        f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{138*k:.1f}" fill="url(#{g_fundo})"/>')

    # ── a moldura: selo discreto, NUNCA o assunto ────────────────────
    # O SELO É MOLDURA, NÃO ASSUNTO. A 0.5 ele competia com a pena;
    # a 0.28 ele ancora sem disputar. Foi por não fazer esta conta
    # que a versão do antigravity virou um sol de espinhos com uma
    # agulha no meio.
    moldura = c.camada("selo", z=1, opacidade=.28)
    for m in P.anel_tracejado((cx, cy), 134 * k, 84, 3.4 * k, 1.1 * k):
        moldura.add(f'<path d="{m}" fill="{CARMESIM}"/>')
    moldura.add(
        f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{118*k:.1f}" fill="none" '
        f'stroke="{AZUL}" stroke-width="{0.9*k:.2f}" stroke-opacity=".5" '
        f'stroke-dasharray="{1.5*k:.1f} {13*k:.1f}"/>')

    # ── as barbas: dois lados DIFERENTES ─────────────────────────────
    # O lado de cima é mais longo e mais denso — a pena pega luz de um
    # lado só. Espelhar os dois é o que fez a versão anterior parecer
    # um pente.
    plumas = c.camada("plumagem", z=2)
    sup = P.plumagem(eixo, sem, n=52, escala=74 * k, inclinacao=0.60,
                     largura_barba=3.9 * k, lado=+1, curvatura=0.46,
                     comprimento=lambda t: math.sin(math.pi * (t ** 0.74)) ** 0.68)
    inf = P.plumagem(eixo, sem, n=40, escala=52 * k, inclinacao=0.66,
                     largura_barba=3.2 * k, lado=-1, curvatura=0.34,
                     comprimento=lambda t: math.sin(math.pi * (t ** 0.86)) ** 0.9 * 0.62)
    for d in inf:
        plumas.add(f'<path d="{d}" fill="url(#{g_barba})" opacity=".72"/>')
    for d in sup:
        plumas.add(f'<path d="{d}" fill="url(#{g_barba})" opacity=".95"/>')

    # ── veios carmesim: poucos, e só onde a barba é longa ────────────
    veios = c.camada("veios", z=3, opacidade=.55)
    for t in (0.26, 0.42, 0.58, 0.72):
        base = G.sobre(eixo, t)
        ang = math.radians(G.angulo_em(eixo, t))
        L = 44 * k
        fim = (base[0] + math.cos(ang + math.pi / 2 * .60) * L,
               base[1] + math.sin(ang + math.pi / 2 * .60) * L)
        veios.add(f'<path d="{P.gavinha(base, fim, sem, 1.7*k, .5)}" '
                  f'fill="{CARMESIM}"/>')

    # ── a ráquis, por cima das barbas ────────────────────────────────
    c.camada("raquis", z=4, atributos=f'filter="url(#{f_sombra})"').add(
        f'<path d="{P.raquis(eixo, 8.4*k)}" fill="url(#{g_aco})"/>')

    # ── o bico ───────────────────────────────────────────────────────
    b = P.bico(eixo, 30 * k)
    c.camada("bico", z=5, atributos=f'filter="url(#{f_sombra})"').add(
        f'<path d="{b["corpo"]}" fill="url(#{g_aco})"/>',
        f'<path d="{b["fenda"]}" stroke="#05060a" stroke-width="{1.5*k:.2f}" '
        f'fill="none" stroke-linecap="round"/>',
        f'<circle cx="{b["respiro"][0]:.2f}" cy="{b["respiro"][1]:.2f}" '
        f'r="{2.4*k:.2f}" fill="#05060a"/>')

    # ── a assinatura: o gesto que prova que houve uma mão ────────────
    pts = [(74 * k, 246 * k), (110 * k, 268 * k), (168 * k, 262 * k),
           (206 * k, 240 * k)]
    c.camada("assinatura", z=6, classe="fp-assina",
             atributos=f'filter="url(#{f_brilho})"').add(
        f'<path d="{P.floreio(pts, 5.2*k)}" fill="url(#{g_tinta})"/>')

    # ── gotas de tinta, DENTRO da tela ───────────────────────────────
    gotas = c.camada("gotas", z=7, classe="fp-gotas")
    # O RAIO É CONTIDO DE PROPÓSITO. A primeira tentativa espalhava as
    # gotas até 26k abaixo do bico e o compositor RECUSOU a arte: elas
    # chegavam a y=307 num viewBox de 300. Era o mesmo defeito que o
    # motor antigo entregava calado (gotas em y=-25).
    for g in P.particulas((b["ponta"][0], b["ponta"][1] + 10 * k),
                          4 * k, 16 * k, 5, sem, 1.6 * k, 3.2 * k):
        gotas.add(
            f'<circle cx="{g["x"]:.1f}" cy="{g["y"]:.1f}" r="{g["r"]:.1f}" '
            f'fill="{CARMESIM}" opacity="{g["op"]}" '
            f'style="animation-delay:{g["atraso"]}s;animation-duration:{g["dur"]}s"/>')

    c.css(f"""
    /* NADA GIRA. A rotação é a assinatura da Fênix (aura-girar), e
       repetir isso aqui foi o erro das duas versões anteriores. */
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
      0%   {{ opacity: 0; transform: translateY(-6px); }}
      20%  {{ opacity: .9; }}
      100% {{ opacity: 0; transform: translateY(14px); }}
    }}
    @media (prefers-reduced-motion: reduce) {{
      .fp-assina path, .fp-gotas circle {{ animation: none; opacity: .85; }}
    }}
    """)
    return c


def aura(vb: int = 300) -> Composicao:
    """
    A AURA — e ela não pode falar a língua das outras.

    A gramática universal deste app é um keyframe GLOBAL, `aura-girar`,
    usado por arquiteto (4×), admin (4×), pink-spirit (3×) e fênix (4×).
    Todas orbitam. A primeira aura do Punidor era a Fênix renomeada:
    `pnp-r1..r4`, `pnp-halo`, `pnp-pulse` espelhando `fnx-*`.

    Aqui nada gira. Quatro atos, e todos com movimento VERTICAL ou de
    CONTRAÇÃO — os dois gestos que nenhuma outra aura do app tem:

        o selo FECHA        três anéis que contraem até travar
        a tinta CAI         traços descendo, com gravidade
        o carimbo BATE      cunhas que golpeiam para dentro
        a assinatura ESCREVE o mesmo floreio da insígnia
    """
    c = Composicao("pena-punidor-aura", vb)
    sem = P.Semente(31072026)
    cx, cy = c.centro
    k = vb / 300.0

    g_veu = c.id("veu")
    g_cunha = c.id("cunha")
    g_tinta = c.id("tinta")
    f_glow = c.id("glow")
    corte = c.id("corte")
    c.defs(
        gradiente_radial(g_veu, [
            (0.00, CARMESIM, .30), (0.55, "#7a0f2e", .16), (1.00, AZUL, 0)]),
        gradiente_linear(g_cunha, [
            (0.00, CARMESIM, 0), (0.55, CARMESIM, .9), (1.00, "#fff", .95)], 0, 1, 0, 0),
        gradiente_linear(g_tinta, [
            (0.00, CARMESIM, 1), (0.5, "#a2185a", 1), (1.00, AZUL, 1)], 0, 0, 1, 0),
        brilho(f_glow, 2.4 * k, 1.1),
        # A chuva é recortada ao círculo: sem isto ela escorre para fora
        # da aura e vira listra na tela.
        f'<clipPath id="{corte}"><circle cx="{cx:.1f}" cy="{cy:.1f}" '
        f'r="{142*k:.1f}"/></clipPath>',
    )

    c.camada("veu", z=0, classe="fa-veu").add(
        f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{142*k:.1f}" fill="url(#{g_veu})"/>')

    # ── a tinta que cai ──────────────────────────────────────────────
    chuva = c.camada("chuva", z=1, classe="fa-chuva",
                     atributos=f'clip-path="url(#{corte})"')
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
    selo = c.camada("selo", z=2, atributos=f'filter="url(#{f_glow})"')
    for j, (r, w, dash, cor, op, atraso) in enumerate([
            (132, 1.6, f"{2*k:.1f} {10*k:.1f}", CARMESIM, .60, 0.0),
            (116, 1.1, f"{1*k:.1f} {14*k:.1f}", AZUL, .45, 0.35),
            (100, 2.2, f"{26*k:.1f} {220*k:.1f}", CARMESIM, .75, 0.7)]):
        selo.add(
            f'<circle class="fa-selo" cx="{cx:.1f}" cy="{cy:.1f}" r="{r*k:.1f}" '
            f'fill="none" stroke="{cor}" stroke-width="{w*k:.2f}" '
            f'stroke-dasharray="{dash}" stroke-linecap="round" opacity="{op}" '
            f'style="animation-delay:{atraso}s"/>')

    # ── o carimbo que bate ───────────────────────────────────────────
    carimbo = c.camada("carimbo", z=3, atributos=f'filter="url(#{f_glow})"')
    for j, ang in enumerate((0, 90, 180, 270)):
        base = (cx, cy - 122 * k)
        p3 = (cx, cy - 88 * k)
        p1 = (cx, cy - 111 * k)
        p2 = (cx, cy - 99 * k)
        d = G.contorno([base, p1, p2, p3], 26 * k, G.perfil_gota, passos=10)
        carimbo.add(
            f'<path class="fa-cunha" d="{d}" fill="url(#{g_cunha})" opacity=".85" '
            f'transform="rotate({ang} {cx:.1f} {cy:.1f})" '
            f'style="animation-delay:{j*.18:.2f}s"/>')

    # ── a assinatura, a mesma da insígnia ────────────────────────────
    pts = [(64 * k, 236 * k), (108 * k, 262 * k), (176 * k, 254 * k), (232 * k, 226 * k)]
    c.camada("assinatura", z=4, classe="fa-assina").add(
        f'<path d="{P.floreio(pts, 6.4*k)}" fill="url(#{g_tinta})" opacity=".9"/>')

    c.css(f"""
    /* NENHUM aura-girar. E esse keyframe GLOBAL que todas as outras
       auras usam, e foi por herda-lo que a primeira versao desta ficou
       identica a Fenix.
       (Sem crase aqui: este CSS vira template literal de JS, e uma crase
        o fecharia no meio — o motor recusa a arte se encontrar uma.) */
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
