# -*- coding: utf-8 -*-
"""
PINCEL — o vocabulário de formas, construído sobre `geometria`.

Tudo aqui nasce de UMA primitiva: `geometria.contorno`, o traço curvo de
espessura variável. Pena, chama, floreio, gavinha e faísca são a mesma
matemática com eixos e perfis diferentes.

A REGRA QUE ESTE ARQUIVO SEGUE, e que o motor antigo não seguia:

    o SUJEITO da arte se desenha aqui, não na mão de quem chama.

No motor antigo a pena era uma string crua dentro do script de
exportação — o engine só produzia a moldura. Se o assunto precisa ser
escrito à mão, o motor não é motor.

ALEATORIEDADE COM SEMENTE. Toda irregularidade passa por `Semente`, um
RNG próprio. Duas razões: arte que muda a cada build vira impossível de
revisar, e sem irregularidade nenhuma o resultado parece impresso —
barbas de pena perfeitamente iguais leem como pente, não como pena.
"""
from __future__ import annotations
import math
import random
from typing import Callable, Sequence

from . import geometria as G

Ponto = tuple[float, float]


class Semente:
    """
    RNG isolado e reproduzível.

    `random` global seria contaminado por qualquer outro import, e a
    mesma insígnia sairia diferente entre execuções — o que torna
    impossível dizer se uma mudança melhorou ou só embaralhou.
    """

    def __init__(self, valor: int = 7):
        self._r = random.Random(valor)

    def entre(self, a: float, b: float) -> float:
        return self._r.uniform(a, b)

    def jitter(self, base: float, pct: float) -> float:
        return base * (1.0 + self._r.uniform(-pct, pct))

    def talvez(self, p: float) -> bool:
        return self._r.random() < p


# ── A PENA ───────────────────────────────────────────────────────────

def plumagem(eixo: Sequence[Ponto], sem: Semente,
             n: int = 44,
             escala: float = 60.0,
             comprimento: Callable[[float], float] | None = None,
             inclinacao: float = 0.58,
             largura_barba: float = 3.4,
             de: float = 0.06, ate: float = 0.97,
             lado: int = 1,
             curvatura: float = 0.42) -> list[str]:
    """
    As barbas de uma pena, ancoradas na ráquis.

    O QUE DEU ERRADO NA MINHA PRIMEIRA PENA, e que isto corrige: as
    barbas eram LINHAS de espessura constante. O resultado lia como
    ancinho. Barba de pena tem corpo: sai grossa da ráquis e morre fina
    na ponta — é `perfil_lamina`, não `stroke-width`.

    Cada barba é uma curva, não um segmento. Uma barba reta é um palito;
    a leve curva para a ponta é o que faz o olho ler "pena".

    `lado` = +1 ou -1. Os dois lados NÃO são espelho exato: a natureza
    não é, e simetria perfeita aqui volta a parecer carimbo.

    `escala` É O COMPRIMENTO MÁXIMO EM PIXELS, e `comprimento(t)` devolve
    a FRAÇÃO dele (0..1). A primeira versão não tinha `escala`: o perfil
    normalizado virava direto o comprimento, e cada barba nascia com
    cerca de um pixel. A pena renderizava sem uma única barba visível —
    só a ráquis — e nada acusava erro, porque um traço de 1px é um traço
    válido. Separar FORMA (a fração) de TAMANHO (os pixels) é o que
    impede a mesma confusão de voltar.
    """
    if comprimento is None:
        # Curto na base, máximo a 40% do caminho, afinando até a ponta.
        def comprimento(t: float) -> float:
            return math.sin(math.pi * (t ** 0.78)) ** 0.72

    barbas: list[str] = []
    for i in range(n):
        t = de + (ate - de) * (i / max(1, n - 1))
        base = G.sobre(eixo, t)
        ang = math.radians(G.angulo_em(eixo, t))

        # IRREGULARIDADE EM DUAS FREQUÊNCIAS. Só ruído branco (o jitter)
        # não basta: as pontas continuam formando um arco liso, e o olho
        # lê "penteado" em vez de "pena". A onda lenta cria as ondulações
        # largas que uma pena real tem; o jitter quebra a onda.
        onda = 1.0 + 0.09 * math.sin(t * 11.0 + 1.7) + 0.05 * math.sin(t * 27.0)
        comp = comprimento(t) * escala * onda * sem.jitter(1.0, 0.10)
        if comp <= escala * 0.02:
            continue

        # A barba sai inclinada PARA A PONTA da pena, nunca perpendicular
        # — perpendicular é o que faz parecer espinha de peixe.
        desvio = ang + lado * (math.pi / 2) * inclinacao
        L = comp

        # Eixo da própria barba: uma curva curta que abre e volta.
        px, py = base
        dx, dy = math.cos(desvio), math.sin(desvio)
        # normal da barba, para curvá-la
        cx, cy = -dy * curvatura, dx * curvatura
        p3 = (px + dx * L, py + dy * L)
        p1 = (px + dx * L * 0.34 + cx * L * 0.18,
              py + dy * L * 0.34 + cy * L * 0.18)
        p2 = (px + dx * L * 0.72 + cx * L * 0.30,
              py + dy * L * 0.72 + cy * L * 0.30)

        w = largura_barba * sem.jitter(1.0, 0.16)
        barbas.append(G.contorno([base, p1, p2, p3], w,
                                 G.perfil_lamina, passos=10,
                                 assimetria=0.5))
    return barbas


def raquis(eixo: Sequence[Ponto], largura: float = 9.0) -> str:
    """
    O eixo rígido da pena. Grosso no cálamo, fino na ponta.

    Perfil próprio (não `perfil_lamina`) porque a ráquis não some na
    ponta: ela afina e continua existindo até o fim, senão as barbas do
    topo ficam soltas no ar.
    """
    return G.contorno(eixo, largura,
                      lambda t: (1.0 - t) ** 0.55 * 0.82 + 0.18,
                      passos=56, assimetria=0.52)


def bico(eixo: Sequence[Ponto], tamanho: float = 30.0) -> dict:
    """
    A ponta metálica: corpo, fenda e furo de respiro.

    Devolve um dicionário em vez de um blob de SVG para quem chama poder
    dar material diferente a cada parte — o corpo em aço, a fenda em
    sombra. Um bico chapado numa cor só é o que faz uma pena parecer
    clip-art.
    """
    base = G.sobre(eixo, 0.0)
    ang = math.radians(G.angulo_em(eixo, 0.0))
    # aponta para TRÁS do eixo (o eixo começa no cálamo)
    dx, dy = -math.cos(ang), -math.sin(ang)
    nx, ny = -dy, dx
    ponta = (base[0] + dx * tamanho, base[1] + dy * tamanho)
    larg = tamanho * 0.30
    ombro_e = (base[0] + nx * larg, base[1] + ny * larg)
    ombro_d = (base[0] - nx * larg, base[1] - ny * larg)
    meio = (base[0] + dx * tamanho * 0.45, base[1] + dy * tamanho * 0.45)

    corpo = (f"M {ombro_e[0]:.2f} {ombro_e[1]:.2f}"
             f" Q {base[0] + dx*tamanho*0.5 + nx*larg*0.75:.2f} {base[1] + dy*tamanho*0.5 + ny*larg*0.75:.2f},"
             f" {ponta[0]:.2f} {ponta[1]:.2f}"
             f" Q {base[0] + dx*tamanho*0.5 - nx*larg*0.75:.2f} {base[1] + dy*tamanho*0.5 - ny*larg*0.75:.2f},"
             f" {ombro_d[0]:.2f} {ombro_d[1]:.2f} Z")
    fenda = (f"M {meio[0]:.2f} {meio[1]:.2f} L {ponta[0]:.2f} {ponta[1]:.2f}")
    return {"corpo": corpo, "fenda": fenda,
            "respiro": (meio[0], meio[1]), "ponta": ponta}


# ── FOGO, FUMAÇA, GAVINHA ────────────────────────────────────────────

def labareda(base: Ponto, altura: float, largura: float,
             sem: Semente, inclinacao: float = 0.0) -> str:
    """
    Uma língua de fogo: sobe, serpenteia e afina.

    Não é o triângulo do motor antigo. Fogo tem dois pontos de inflexão
    — é isso que separa chama de cunha, e é a única razão de a Fênix
    antiga parecer um sol de espinhos.
    """
    lean = math.radians(inclinacao)
    topo = (base[0] + math.sin(lean) * altura, base[1] - math.cos(lean) * altura)
    p1 = (base[0] + sem.entre(-0.34, 0.34) * largura, base[1] - altura * 0.34)
    p2 = (base[0] + sem.entre(-0.5, 0.5) * largura + math.sin(lean) * altura * 0.7,
          base[1] - altura * 0.72)
    return G.contorno([base, p1, p2, topo], largura,
                      lambda t: (1 - t) ** 0.85 * math.sin(math.pi * (0.15 + t * 0.85)),
                      passos=26, assimetria=sem.entre(0.42, 0.58))


def gavinha(inicio: Ponto, fim: Ponto, sem: Semente,
            largura: float = 3.0, curva: float = 0.5) -> str:
    """Fio orgânico entre dois pontos — veia, raiz, fumaça fina."""
    dx, dy = fim[0] - inicio[0], fim[1] - inicio[1]
    nx, ny = -dy, dx
    k = curva * sem.entre(0.6, 1.4)
    p1 = (inicio[0] + dx * 0.3 + nx * k * 0.22, inicio[1] + dy * 0.3 + ny * k * 0.22)
    p2 = (inicio[0] + dx * 0.7 - nx * k * 0.18, inicio[1] + dy * 0.7 - ny * k * 0.18)
    return G.contorno([inicio, p1, p2, fim], largura,
                      G.perfil_folha, passos=22)


def floreio(pontos: Sequence[Ponto], largura: float = 7.0) -> str:
    """
    O gesto de assinatura: um traço calligráfico que passa por pontos.

    Usa `perfil_caligrafico` — pressão que sobe rápido e alivia devagar.
    É essa assimetria que faz o traço parecer ESCRITO, e não desenhado.
    """
    if len(pontos) < 4:
        pontos = list(pontos) + [pontos[-1]] * (4 - len(pontos))
    trechos = []
    for i in range(0, len(pontos) - 3, 3):
        eixo = pontos[i:i + 4]
        if len(eixo) < 4:
            break
        trechos.append(G.contorno(eixo, largura, G.perfil_caligrafico,
                                  passos=40, assimetria=0.62))
    return " ".join(trechos)


# ── PARTÍCULAS ───────────────────────────────────────────────────────

def particulas(centro: Ponto, raio_i: float, raio_e: float,
               n: int, sem: Semente,
               r_min: float = 1.0, r_max: float = 3.4) -> list[dict]:
    """
    Pontos dispersos num anel, com raio e atraso próprios.

    Devolve DADOS, não SVG: quem chama decide se vira brasa, poeira,
    gota ou estrela, e com que animação. Foi assim que as brasas da
    Fênix e as gotas da Pena viraram o mesmo código.

    A distribuição usa sqrt para não amontoar tudo na borda interna —
    sem isso, um anel de partículas fica com um miolo denso e um vazio
    externo que o olho lê como erro.
    """
    saida = []
    for i in range(n):
        ang = sem.entre(0, math.tau)
        u = sem.entre(0.0, 1.0) ** 0.5
        r = raio_i + (raio_e - raio_i) * u
        saida.append({
            "x": centro[0] + math.cos(ang) * r,
            "y": centro[1] + math.sin(ang) * r,
            "r": sem.entre(r_min, r_max),
            "atraso": round(sem.entre(0.0, 4.0), 2),
            "dur": round(sem.entre(2.4, 5.2), 2),
            "op": round(sem.entre(0.35, 0.95), 2),
        })
    return saida


def anel_tracejado(centro: Ponto, raio: float, n: int,
                   comprimento: float = 6.0, largura: float = 1.6) -> list[str]:
    """
    Marcas curtas ao longo de um círculo — selo, régua, coroa.

    Existe para ficar claro que este motor NÃO proíbe o radial: ele só
    deixou de ser a única coisa possível. Radial como MOLDURA é
    legítimo; radial como sujeito é a mandala que já foi rejeitada.
    """
    marcas = []
    for i in range(n):
        a = math.tau * i / n
        cx, cy = math.cos(a), math.sin(a)
        p0 = (centro[0] + cx * (raio - comprimento / 2),
              centro[1] + cy * (raio - comprimento / 2))
        p3 = (centro[0] + cx * (raio + comprimento / 2),
              centro[1] + cy * (raio + comprimento / 2))
        p1 = (p0[0] + (p3[0] - p0[0]) * .33, p0[1] + (p3[1] - p0[1]) * .33)
        p2 = (p0[0] + (p3[0] - p0[0]) * .66, p0[1] + (p3[1] - p0[1]) * .66)
        marcas.append(G.contorno([p0, p1, p2, p3], largura,
                                 G.perfil_fita, passos=6))
    return marcas
