# -*- coding: utf-8 -*-
"""
FÊNIX V2 — A AURA DO FOGO FRIO.

O PROBLEMA QUE ESTA PEÇA RESOLVE

O app tem seis auras e todas dizem a mesma frase: um keyframe GLOBAL
chamado aura-girar, aplicado a três ou quatro anéis concêntricos em
velocidades diferentes. Arquiteto, admin, pink-spirit e a Fênix original
são o MESMO gesto com paletas trocadas. Foi por isso que duas artes
foram recusadas: não por serem feias, mas por serem indistinguíveis
umas das outras a dois metros de distância.

A Pena do Punidor escapou disso invertendo o eixo: nada gira, tudo CAI
(chuva de tinta) ou CONTRAI (o selo que fecha). Repetir esse vocabulário
aqui recriaria o mesmo problema um degrau adiante.

Então esta aura fala uma terceira língua: ASCENSÃO.

    a chama SOBE       labaredas azuis que esticam e se dissolvem no topo
    o gelo SUBLIMA     partículas que sobem em vez de cair
    o cristal SE FORMA estilhaços que nascem, travam e derretem
    a frente fria PASSA uma faixa de luz que atravessa a aura de baixo
                       para cima e recomeça

Nada gira. Nada cai. Nada contrai para o centro. O olho lê o movimento
inteiro numa direção só — para cima — e é exatamente essa leitura que
nenhuma outra aura do app produz.

FOGO FRIO. A Fênix original é laranja e âmbar: queima. Esta é azul gelo
e branco, e as chamas terminam em cristal em vez de brasa. Mesma
silhueta ancestral (uma ave de fogo que se ergue), temperatura oposta.
As labaredas saem de pincel.labareda, que faz chama com duas inflexões —
não o triângulo do motor antigo, que transformou a Fênix num sol de
espinhos.

AVISO DE MANUTENÇÃO: este arquivo não pode conter o caractere de crase
em lugar nenhum, nem em comentário. O SVG gerado vira template literal
de JavaScript no frontend, e uma crase solta fecharia a string no meio.
Já quebrou o projeto três vezes.
"""
from __future__ import annotations
import math

from .. import geometria as G
from .. import pincel as P
from ..compositor import (Composicao, gradiente_linear, gradiente_radial,
                          brilho)

# ── PALETA: azul gelo e branco. Nenhum tom quente entra aqui. ─────────
GELO = "#7fd4ff"
AZUL = "#2b6bff"
PROFUNDO = "#0a2a5e"
BRANCO = "#eaf6ff"


def _arco_base(vb: int):
    """
    A linha de onde as chamas nascem: um arco de boca para cima.

    Chama saindo de uma reta horizontal lê como incêndio de mato. O arco
    rebaixado nas pontas e cheio no meio é o que dá à massa de fogo a
    silhueta de uma ave pousada prestes a subir — o corpo no centro, as
    asas descendo para os lados.
    """
    k = vb / 300.0
    # AS PONTAS SOBEM MUITO MAIS que a primeira versao. Com as bases quase
    # na mesma altura (196 nas pontas, 232 no meio) a diferenca de 36px se
    # perdia entre chamas de 100px e o conjunto lia como cerca viva. Agora
    # sao 96px de desnivel: as chamas das bordas nascem na LATERAL do
    # disco, e a massa envolve em vez de forrar o chao.
    return [(44 * k, 148 * k), (92 * k, 244 * k),
            (208 * k, 244 * k), (256 * k, 148 * k)]


def _altura_rel(t: float) -> float:
    """
    Quanto cada chama sobe, em fração da altura máxima.

    O QUE ESTE PERFIL CORRIGE. A primeira versão somava um seno largo com
    dois ombros suaves; o resultado ficava quase CONSTANTE entre t=0.15 e
    t=0.85 (0.80 a 0.84), e uma fileira de chamas de mesma altura, mesma
    largura e mesmo espaçamento não lê como fogo: lê como GRAMA. O render
    mostrou exatamente isso — um gramado azul.

    A correção é contraste, não mais elementos: três picos ESTREITOS
    (pescoço no centro, duas asas em t≈0.24 e t≈0.76) separados por vales
    fundos em t≈0.5±0.14. É o vale que faz o pico existir.
    """
    pescoco = 0.86 * math.exp(-((t - 0.50) / 0.105) ** 2)
    asa_e = 0.54 * math.exp(-((t - 0.24) / 0.115) ** 2)
    asa_d = 0.54 * math.exp(-((t - 0.76) / 0.115) ** 2)
    return 0.15 + pescoco + asa_e + asa_d


def _inclinacao(t: float) -> float:
    """
    O leque: as chamas abrem para fora conforme se afastam do centro.

    Chamas paralelas são talos. É a abertura progressiva — zero no
    pescoço, mais de trinta graus nas pontas — que transforma a mesma
    massa de fogo em duas asas erguidas.
    """
    return (t - 0.5) * 2.0 * 34.0


def _estilhaco(centro, raio: float, sem: P.Semente,
               largura: float = 2.6) -> list[str]:
    """
    Um cristal de gelo: três agulhas cruzadas a 60 graus.

    Feito com contorno e perfil_folha (fino nas pontas, corpo no meio) em
    vez de linhas retas de espessura constante — pelo mesmo motivo que as
    barbas da Pena precisaram de corpo: agulha de espessura fixa lê como
    asterisco de teclado, não como cristal.

    Os três braços recebem comprimentos ligeiramente diferentes. Cristal
    real não é simétrico perfeito, e simetria exata aqui volta a parecer
    carimbo.
    """
    saida: list[str] = []
    giro = sem.entre(0.0, math.pi)
    for i in range(3):
        a = giro + math.pi * i / 3.0
        dx, dy = math.cos(a), math.sin(a)
        r = raio * sem.jitter(1.0, 0.16)
        p0 = (centro[0] - dx * r, centro[1] - dy * r)
        p3 = (centro[0] + dx * r, centro[1] + dy * r)
        p1 = (p0[0] + (p3[0] - p0[0]) * 0.33, p0[1] + (p3[1] - p0[1]) * 0.33)
        p2 = (p0[0] + (p3[0] - p0[0]) * 0.66, p0[1] + (p3[1] - p0[1]) * 0.66)
        saida.append(G.contorno([p0, p1, p2, p3], largura,
                                G.perfil_folha, passos=8))
    return saida


def aura(vb: int = 300) -> Composicao:
    """
    A aura da Fênix V2 — fogo frio que sobe.

    Quatro atos, todos verticais e todos para CIMA. A escolha é
    deliberada e é o conteúdo inteiro da peça: aura-girar já foi usada
    seis vezes, e a queda e a contração já pertencem à Pena do Punidor.

    Tudo é determinístico: a irregularidade vem de Semente, nunca de
    random global, para que dois builds produzam bytes idênticos e uma
    revisão de arte signifique alguma coisa.
    """
    c = Composicao("fenix-v2-aura", vb)
    sem = P.Semente(20260731)
    cx, cy = c.centro
    k = vb / 300.0

    # ── materiais ────────────────────────────────────────────────────
    g_veu = c.id("veu")
    g_chama_ext = c.id("chama-ext")
    g_chama_int = c.id("chama-int")
    g_cristal = c.id("cristal")
    g_brasa = c.id("brasa")
    g_frente = c.id("frente")
    f_glow = c.id("glow")
    corte = c.id("corte")
    c.defs(
        gradiente_radial(g_veu, [
            (0.00, GELO, .26), (0.52, AZUL, .18), (1.00, PROFUNDO, 0)]),
        # A CHAMA ESFRIA PARA CIMA. No fogo quente o gradiente vai de
        # vermelho na base a amarelo na ponta; aqui vai de azul profundo
        # a branco quase transparente, e é isso que faz a labareda
        # parecer congelar em vez de queimar.
        gradiente_linear(g_chama_ext, [
            (0.00, PROFUNDO, .95), (0.42, AZUL, .85),
            (0.78, GELO, .60), (1.00, BRANCO, 0)], 0, 1, 0, 0),
        gradiente_linear(g_chama_int, [
            (0.00, AZUL, 1), (0.40, GELO, .95),
            (0.82, BRANCO, .80), (1.00, BRANCO, 0)], 0, 1, 0, 0),
        # A BRASA FRIA. Toda labareda começa com um corte reto na base, e
        # treze cortes retos na mesma altura desenham uma LINHA — o
        # render acusou um talho horizontal atravessando a aura. Este
        # borrão claro por cima dos pés das chamas dissolve o talho, que
        # é o que uma fogueira real faz: a base é a parte que ofusca.
        gradiente_radial(g_brasa, [
            (0.00, BRANCO, .55), (0.40, GELO, .34),
            (0.72, AZUL, .16), (1.00, PROFUNDO, 0)]),
        gradiente_linear(g_cristal, [
            (0.00, BRANCO, .95), (0.55, GELO, .85), (1.00, AZUL, .55)], 0, 0, 1, 1),
        # A frente fria: transparente nas bordas, luz no miolo. Uma faixa
        # de cor chapada leria como barra de carregamento.
        gradiente_radial(g_frente, [
            (0.00, BRANCO, .55), (0.42, GELO, .30), (1.00, GELO, 0)]),
        brilho(f_glow, 2.6 * k, 1.05),
        # Recorte ao disco: a frente fria varre a aura inteira e sem isto
        # ela escaparia para o resto da página como uma listra.
        f'<clipPath id="{corte}"><circle cx="{cx:.1f}" cy="{cy:.1f}" '
        f'r="{142*k:.1f}"/></clipPath>',
    )

    # ── o véu, parado ────────────────────────────────────────────────
    # ESTÁTICO DE PROPÓSITO. Um halo que pulsa é o gesto da Fênix antiga
    # (fnx-halo) e do véu da Pena (fa-respirar). Aqui o fundo é o único
    # elemento imóvel: ele existe para dar contraste ao que sobe.
    c.camada("veu", z=0).add(
        f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{142*k:.1f}" '
        f'fill="url(#{g_veu})"/>',
        f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{136*k:.1f}" fill="none" '
        f'stroke="{GELO}" stroke-width="{0.8*k:.2f}" stroke-opacity=".30"/>')

    # ── ATO 1: as chamas que sobem ───────────────────────────────────
    # Duas fileiras com números, alturas e nitidez diferentes. Uma
    # fileira só lê como serrilha; a de trás desfocada é o que cria ar
    # entre as duas e dá volume à massa de fogo.
    #
    # POUCAS E LARGAS, NÃO MUITAS E FINAS. A serpenteada de labareda vem
    # dos pontos de controle deslocados por uma FRAÇÃO DA LARGURA; numa
    # chama de 27 de largura e 110 de altura esse desvio é de nove pixels
    # e a curva desaparece — sai uma lâmina reta. Largura comparável à
    # altura é o que devolve as duas inflexões e faz a língua de fogo
    # existir. Foi por isso que a primeira fileira, com 21 chamas
    # estreitas e igualmente espaçadas, renderizou um gramado.
    eixo = _arco_base(vb)

    fundo = c.camada("chamas-fundo", z=1, classe="fx2-chamas",
                     opacidade=.72, desfoque=1.8 * k)
    for i in range(13):
        t = min(0.985, max(0.015, 0.03 + 0.94 * (i / 12.0)
                           + sem.entre(-0.022, 0.022)))
        base = G.sobre(eixo, t)
        # Pés em alturas diferentes: bases todas na mesma linha viram
        # uma régua, e a régua foi o que apareceu no primeiro render.
        base = (base[0], base[1] + sem.entre(-7.0, 9.0) * k)
        alt = 150 * k * _altura_rel(t) * sem.jitter(1.0, 0.11)
        # LARGURA LIMITADA PELA ALTURA. Sem este teto, as chamas curtas
        # das pontas (altura 0.15) ficavam mais largas que altas e
        # renderizavam como duas bolhas nos cantos de baixo.
        larg = min(46 * k * sem.jitter(1.0, 0.22), alt * 0.62)
        fundo.add(
            f'<path class="fx2-chama" '
            f'd="{P.labareda(base, alt, larg, sem, _inclinacao(t) + sem.entre(-4, 4))}" '
            f'fill="url(#{g_chama_ext})" '
            f'style="animation-duration:{4.2 + ((i*7) % 19)/10:.2f}s;'
            f'animation-delay:{((i*23) % 37)/10:.2f}s"/>')

    frente = c.camada("chamas-frente", z=2, classe="fx2-chamas",
                      atributos=f'filter="url(#{f_glow})"')
    for i in range(9):
        t = min(0.94, max(0.06, 0.10 + 0.80 * (i / 8.0)
                          + sem.entre(-0.026, 0.026)))
        base = G.sobre(eixo, t)
        base = (base[0], base[1] + sem.entre(-5.0, 11.0) * k)
        alt = 150 * k * _altura_rel(t) * 0.66 * sem.jitter(1.0, 0.14)
        larg = min(30 * k * sem.jitter(1.0, 0.24), alt * 0.58)
        frente.add(
            f'<path class="fx2-chama" '
            f'd="{P.labareda(base, alt, larg, sem, _inclinacao(t) * 0.7 + sem.entre(-5, 5))}" '
            f'fill="url(#{g_chama_int})" '
            f'style="animation-duration:{3.4 + ((i*11) % 21)/10:.2f}s;'
            f'animation-delay:{((i*17) % 29)/10:.2f}s"/>')

    # ── a brasa fria, por cima dos pés ───────────────────────────────
    # Vem DEPOIS das chamas de propósito: é a luz da base lavando o
    # corte reto de onde cada labareda nasce.
    c.camada("brasa", z=3, opacidade=.85, desfoque=3.4 * k).add(
        f'<ellipse cx="{cx:.1f}" cy="{cy + 74*k:.1f}" '
        f'rx="{104*k:.1f}" ry="{26*k:.1f}" fill="url(#{g_brasa})"/>')

    # ── ATO 2: a frente fria que atravessa ───────────────────────────
    # Uma faixa horizontal que sobe do pé ao topo do disco e reinicia.
    # É o gesto mais distante de tudo que o app já tem: não é órbita,
    # não é queda, não é pulso — é uma varredura.
    c.camada("frente-fria", z=4, classe="fx2-frente",
             atributos=f'clip-path="url(#{corte})"').add(
        # ELIPSE, NAO RETANGULO. O retangulo com bordas retas cruzava o
        # disco de ponta a ponta e lia como risco cinza atravessando a
        # arte — um artefato, nao um efeito. A elipse mais larga que o
        # disco tem as bordas ja dissolvidas pelo gradiente radial.
        f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{160*k:.1f}" ry="{34*k:.1f}" '
        f'fill="url(#{g_frente})" opacity=".55"/>')

    # ── ATO 3: os cristais que se formam e derretem ──────────────────
    # Posições fixas e espalhadas, nunca em anel: cristal em anel
    # equidistante volta a ser mandala, que é a estética recusada.
    #
    # O ângulo áureo espalha sem amontoar: sortear ângulo puro dá pares
    # colados e buracos, e o primeiro render entregou dois cristais
    # sobrepostos no canto. E o seno é rebaixado de propósito para jogar
    # os cristais para a METADE DE CIMA — é lá que a chama já se
    # desmanchou e o gelo tem por que aparecer.
    cristais = c.camada("cristais", z=5, atributos=f'filter="url(#{f_glow})"')
    AUREO = math.pi * (3.0 - math.sqrt(5.0))
    for j in range(7):
        ang = j * AUREO + 0.6 + sem.entre(-0.18, 0.18)
        raio_pos = 52 * k + 60 * k * (sem.entre(0.0, 1.0) ** 0.5)
        centro = (cx + math.cos(ang) * raio_pos,
                  cy + math.sin(ang) * raio_pos * 0.62 - 44 * k)
        for d in _estilhaco(centro, sem.entre(6.0, 11.0) * k, sem, 2.4 * k):
            cristais.add(
                f'<path class="fx2-cristal" d="{d}" fill="url(#{g_cristal})" '
                f'style="animation-delay:{(j * 0.74):.2f}s;'
                f'animation-duration:{5.2 + (j % 3) * 0.9:.2f}s"/>')

    # ── ATO 4: o gelo que sublima ────────────────────────────────────
    # Partículas que SOBEM. A Pena faz gotas caírem; aqui a mesma função
    # de pincel serve ao gesto oposto, e a inversão é o ponto.
    poeira = c.camada("sublimacao", z=6, classe="fx2-poeira")
    for g in P.particulas((cx, cy + 22 * k), 26 * k, 116 * k, 26, sem,
                          1.0 * k, 2.8 * k):
        poeira.add(
            f'<circle cx="{g["x"]:.1f}" cy="{g["y"]:.1f}" r="{g["r"]:.2f}" '
            f'fill="{BRANCO}" opacity="0" '
            f'style="animation-delay:{g["atraso"]}s;'
            f'animation-duration:{g["dur"]}s"/>')

    # ── movimento ────────────────────────────────────────────────────
    # Nenhuma rotação, em nenhum lugar. Nenhum uso de aura-girar, o
    # keyframe global que as seis auras antigas compartilham e que é a
    # razão de elas se confundirem entre si.
    # (Nenhuma crase neste bloco: ele vira template literal de JS.)
    c.css(f"""
    .fx2-chamas path {{
      transform-box: fill-box;
      transform-origin: 50% 100%;
      animation-name: fx2-ascender;
      animation-timing-function: cubic-bezier(.25,.6,.35,1);
      animation-iteration-count: infinite;
    }}
    @keyframes fx2-ascender {{
      0%   {{ transform: translateY({5*k:.2f}px) scaleY(.80); opacity: .10; }}
      30%  {{ opacity: .95; }}
      68%  {{ transform: translateY({-9*k:.2f}px) scaleY(1.14); opacity: .60; }}
      100% {{ transform: translateY({-20*k:.2f}px) scaleY(1.24); opacity: 0; }}
    }}
    .fx2-frente rect {{
      animation: fx2-varrer 7.6s cubic-bezier(.45,0,.55,1) infinite;
    }}
    @keyframes fx2-varrer {{
      0%   {{ transform: translateY({150*k:.2f}px); opacity: 0; }}
      18%  {{ opacity: 1; }}
      80%  {{ opacity: .85; }}
      100% {{ transform: translateY({-150*k:.2f}px); opacity: 0; }}
    }}
    .fx2-cristal {{
      transform-box: fill-box;
      transform-origin: 50% 50%;
      animation-name: fx2-cristalizar;
      animation-timing-function: cubic-bezier(.2,.9,.3,1);
      animation-iteration-count: infinite;
    }}
    @keyframes fx2-cristalizar {{
      0%       {{ transform: scale(.15); opacity: 0; }}
      14%      {{ transform: scale(1.06); opacity: 1; }}
      22%, 58% {{ transform: scale(1); opacity: .92; }}
      100%     {{ transform: scale(.9) translateY({-7*k:.2f}px); opacity: 0; }}
    }}
    .fx2-poeira circle {{
      animation-name: fx2-sublimar;
      animation-timing-function: cubic-bezier(.35,0,.6,1);
      animation-iteration-count: infinite;
    }}
    @keyframes fx2-sublimar {{
      0%   {{ transform: translateY(0); opacity: 0; }}
      22%  {{ opacity: .9; }}
      72%  {{ opacity: .5; }}
      100% {{ transform: translateY({-40*k:.2f}px); opacity: 0; }}
    }}
    @media (prefers-reduced-motion: reduce) {{
      .fx2-chamas path, .fx2-frente rect, .fx2-cristal, .fx2-poeira circle
        {{ animation: none; }}
      .fx2-chamas path {{ opacity: .85; }}
      .fx2-frente rect {{ opacity: .35; }}
      .fx2-poeira circle {{ opacity: .55; }}
    }}
    """)
    return c
