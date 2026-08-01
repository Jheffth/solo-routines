# -*- coding: utf-8 -*-
"""
FÊNIX V2 — a insígnia. Fogo frio: azul gelo e branco.

PEÇA NOVA. A `fenix-pioneira` original continua exatamente onde estava,
intocada, para comparação lado a lado — foi o pedido do Arquiteto.

O QUE ESTA VERSÃO TENTA CORRIGIR NA ORIGINAL

A Fênix antiga é doze cunhas triangulares em volta de um centro, girando
pelo keyframe global `aura-girar`. Ela não tem uma ave: tem um sol de
espinhos. O motivo era estrutural — o motor da época só sabia clonar uma
forma em círculo, então "fênix" virou "explosão radial laranja".

Aqui há um corpo, um pescoço que vira, duas asas abertas com penas de voo
escalonadas, uma cauda que escorre e volutas de ornamento. Nada disso era
possível antes de `geometria.contorno` existir.

AS ASAS SOBEM, e é a decisão de composição que mais importa. Asa
horizontal lê como planador; asa erguida lê como ave que ACABOU de bater
— é o instante da referência que o Arquiteto mandou, e é o que dá
verticalidade à silhueta dentro de um selo redondo.

DUAS PASSADAS POR ASA. Uma leva de penas curtas por baixo (as cobertas) e
outra de rêmiges longas por cima. Uma passada só deixa o ombro oco e a
asa vira leque de papel; a segunda é o que dá espessura ao braço da asa.
"""
from __future__ import annotations
import math

from .. import geometria as G
from .. import pincel as P
from .. import plumas as PL
from ..compositor import (Composicao, gradiente_linear, gradiente_radial,
                          metal, sombra_interna, brilho)

# A paleta pedida: azul gelo e branco. Nenhum laranja em lugar nenhum —
# é o que separa esta da original num piscar de olhos.
GELO = "#7fd4ff"
AZUL = "#2b6bff"
PROFUNDO = "#0a2a5e"
BRANCO = "#eaf6ff"
PRATA = "#c9dcf0"


def insignia(vb: int = 300) -> Composicao:
    c = Composicao("fenix-v2-insignia", vb)
    sem = P.Semente(20260801)
    cx, cy = c.centro
    k = vb / 300.0

    # ── materiais ────────────────────────────────────────────────────
    g_pena = c.id("pena")
    g_pena_i = c.id("penai")
    g_corpo = c.id("corpo")
    g_cauda = c.id("cauda")
    g_fundo = c.id("fundo")
    g_orn = c.id("orn")
    f_sombra = c.id("sombra")
    f_brilho = c.id("brilho")
    c.defs(
        # A pena pega luz na ponta e escurece na raiz. O inverso — claro
        # na raiz — achata a asa, porque a luz do céu vem de cima.
        gradiente_linear(g_pena, [
            (0.00, PROFUNDO, 1), (0.38, AZUL, 1),
            (0.72, GELO, 1), (1.00, BRANCO, 1)], 0, 1, 0.35, 0),
        gradiente_linear(g_pena_i, [
            (0.00, "#061c40", 1), (0.55, "#1a4a9e", 1), (1.00, GELO, 1)], 0, 1, 0.3, 0),
        gradiente_linear(g_corpo, [
            (0.00, BRANCO, 1), (0.30, GELO, 1),
            (0.70, AZUL, 1), (1.00, PROFUNDO, 1)], 0, 0, 1, 1),
        gradiente_linear(g_cauda, [
            (0.00, GELO, 1), (0.5, AZUL, 1), (1.00, PROFUNDO, 0.15)], 0, 0, 0, 1),
        gradiente_radial(g_fundo, [
            (0.00, GELO, .22), (0.5, AZUL, .14), (1.00, PROFUNDO, 0)]),
        gradiente_linear(g_orn, [
            (0.00, GELO, 1), (1.00, AZUL, .2)], 0, 0, 1, 1),
        sombra_interna(f_sombra, 0, 2.5 * k, 3.0 * k, "#02060f", .85),
        brilho(f_brilho, 2.2 * k, 1.05),
    )

    # ── o halo, ao fundo e desfocado ─────────────────────────────────
    c.camada("halo", z=0, desfoque=1.4 * k).add(
        f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{136*k:.1f}" fill="url(#{g_fundo})"/>')

    # ── o selo: moldura discreta ─────────────────────────────────────
    selo = c.camada("selo", z=1, opacidade=.26)
    for m in PL and P.anel_tracejado((cx, cy), 133 * k, 96, 3.2 * k, 1.0 * k):
        selo.add(f'<path d="{m}" fill="{GELO}"/>')

    # ── o corpo ──────────────────────────────────────────────────────
    # Um pouco abaixo do centro: a ave ocupa mais espaço para cima (asas)
    # do que para baixo, então centralizar o TORSO no meio do selo joga a
    # composição inteira para o alto.
    # O TAMANHO E LIMITADO PELA CAUDA, nao pelo corpo. Com altura 132 e
    # centro em +26k, o penacho passava de y=300 e o compositor recusou.
    # A ave inteira (cabeca + torso + cauda) tem de caber no selo.
    corpo = PL.corpo_ave((cx, cy + 12 * k), 124 * k, sem, inclinacao=-14.0)

    # ── as asas: duas passadas cada ──────────────────────────────────
    # ERGUIDAS. -142 e -38 graus apontam para cima e para fora; a
    # horizontal (-180/0) dava planador.
    asas = c.camada("asas", z=2)
    # AS ASAS DESCEM PARA O OMBRO. Ancoradas onde `corpo_ave` as devolve,
    # elas nasciam na altura do pescoco e cobriam a cabeca — a ave ficava
    # sem rosto. O deslocamento para baixo abre o espaco que a referencia
    # tem: cabeca livre acima da linha das asas.
    ombro = 22 * k
    # O V DA REFERENCIA. -148/-32 pareciam bem verticais no codigo e
    # renderizaram quase horizontais: `abertura` nao e a pegada real do
    # leque — 40 graus pedidos viram ~80 na tela (esta no docstring de
    # `asa`). Entao a direcao precisa ser MAIS vertical do que a
    # intuicao pede, e a abertura menor.
    for ancora0, direcao, sinal in ((corpo["ancora_asa_esq"], -126, -1),
                                    (corpo["ancora_asa_dir"], -54, +1)):
        ancora = (ancora0[0], ancora0[1] + ombro)
        # cobertas: curtas, por baixo, dando espessura ao ombro
        for d in PL.asa(ancora, direcao, 66 * k, sem, n=14,
                        abertura=sinal * 40.0, curvatura=0.50,
                        escalonamento=0.26, largura_pena=9.0 * k):
            asas.add(f'<path d="{d}" fill="url(#{g_pena_i})" opacity=".85"/>')
        # rêmiges: longas, por cima
        for d in PL.asa(ancora, direcao, 124 * k, sem, n=24,
                        abertura=sinal * 30.0, curvatura=0.70,
                        escalonamento=0.30, largura_pena=11.5 * k):
            asas.add(f'<path d="{d}" fill="url(#{g_pena})"/>')

    # ── a cauda, escorrendo ──────────────────────────────────────────
    cauda = c.camada("cauda", z=3, opacidade=.9)
    for d in PL.penacho(corpo["ancora_cauda"], 84, 74 * k, sem,
                        n=9, abertura=44.0, largura=5.6 * k, ondulacao=0.55):
        cauda.add(f'<path d="{d}" fill="url(#{g_cauda})"/>')

    # ── volutas: o ornamento da referência ───────────────────────────
    orn = c.camada("volutas", z=4, opacidade=.55, classe="fx-orn")
    for centro_v, raio, sentido in (((62 * k, 232 * k), 22 * k, +1),
                                    ((238 * k, 236 * k), 19 * k, -1)):
        orn.add(f'<path d="{PL.voluta(centro_v, raio, 2.0, sem, 2.6*k, sentido)}" '
                f'fill="url(#{g_orn})"/>')

    # ── o corpo por cima das asas ────────────────────────────────────
    tronco = c.camada("corpo", z=5, atributos=f'filter="url(#{f_sombra})"')
    tronco.add(
        f'<path d="{corpo["torso"]}" fill="url(#{g_corpo})"/>',
        f'<path d="{corpo["pescoco"]}" fill="url(#{g_corpo})"/>',
        f'<path d="{corpo["cabeca"]}" fill="url(#{g_corpo})"/>',
        f'<path d="{corpo["bico"]}" fill="{BRANCO}"/>',
        f'<circle cx="{corpo["olho"][0]:.1f}" cy="{corpo["olho"][1]:.1f}" '
        f'r="{2.6*k:.1f}" fill="{PROFUNDO}"/>')

    # ── a crista: o que faz virar fênix e não pássaro ────────────────
    crista = c.camada("crista", z=6, classe="fx-crista",
                      atributos=f'filter="url(#{f_brilho})"')
    topo = corpo["cabeca"]
    cabeca_lim = G.limites(topo)
    ancora_crista = ((cabeca_lim[0] + cabeca_lim[2]) / 2,
                     cabeca_lim[1] + 2 * k)
    for i, (ang, alt) in enumerate(((-118, 30), (-100, 40), (-82, 32), (-66, 22))):
        base = (ancora_crista[0] + math.cos(math.radians(ang)) * 3 * k,
                ancora_crista[1] + math.sin(math.radians(ang)) * 3 * k)
        crista.add(
            f'<path d="{P.labareda(base, alt*k, 7.5*k, sem, inclinacao=ang+90)}" '
            f'fill="url(#{g_pena})" opacity="{0.75 + i*0.05:.2f}"/>')

    # ── brasas frias em suspensão ────────────────────────────────────
    fagulhas = c.camada("fagulhas", z=7, classe="fx-fagulhas")
    for g in P.particulas((cx, cy), 62 * k, 124 * k, 16, sem, 1.1 * k, 2.6 * k):
        fagulhas.add(
            f'<circle cx="{g["x"]:.1f}" cy="{g["y"]:.1f}" r="{g["r"]:.1f}" '
            f'fill="{BRANCO}" opacity="{g["op"]}" '
            f'style="animation-delay:{g["atraso"]}s;animation-duration:{g["dur"]}s"/>')

    c.css(f"""
    /* NADA GIRA — nem aqui nem na aura. A rotacao continua e a lingua da
       Fenix original (aura-girar), e repeti-la seria entregar a mesma
       arte pintada de azul. O movimento aqui e ASCENSAO: a crista
       respira e as fagulhas sobem. */
    .fx-fagulhas circle {{
      animation-name: fx2-subir;
      animation-timing-function: ease-out;
      animation-iteration-count: infinite;
    }}
    @keyframes fx2-subir {{
      0%   {{ opacity: 0; transform: translateY(6px); }}
      25%  {{ opacity: .85; }}
      100% {{ opacity: 0; transform: translateY(-16px); }}
    }}
    .fx-crista path {{
      transform-box: fill-box;
      transform-origin: 50% 100%;
      animation: fx2-arder 3.4s ease-in-out infinite;
    }}
    @keyframes fx2-arder {{
      0%, 100% {{ transform: scaleY(1); opacity: .8; }}
      50%      {{ transform: scaleY(1.14); opacity: 1; }}
    }}
    .fx-orn path {{ animation: fx2-brilhar 5.2s ease-in-out infinite; }}
    @keyframes fx2-brilhar {{
      0%, 100% {{ opacity: .38; }}
      50%      {{ opacity: .75; }}
    }}
    @media (prefers-reduced-motion: reduce) {{
      .fx-fagulhas circle, .fx-crista path, .fx-orn path {{ animation: none; }}
      .fx-fagulhas circle {{ opacity: .6; }}
    }}
    """)
    return c
