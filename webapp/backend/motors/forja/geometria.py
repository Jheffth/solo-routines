# -*- coding: utf-8 -*-
"""
GEOMETRIA — a matemática que o motor anterior não tinha.

POR QUE ESTE ARQUIVO EXISTE

O primeiro motor oferecia quatro primitivas: polígono regular, gema
facetada, anel radial e cunha. Nenhuma delas desenha uma curva. O efeito
disso não foi "algumas artes ficaram limitadas" — foi que o motor só
sabia fazer UMA coisa: N cópias de uma forma em volta de um centro.
Mandala. E mandala girando é exatamente a estética que o Arquiteto
rejeitou duas vezes.

A prova estava no próprio script que o usava: a pena — o SUJEITO da
insígnia — teve de ser escrita à mão como string crua, contornando o
motor inteiro. Um gerador de insígnias que não consegue gerar o assunto
da insígnia é um gerador de moldura.

A primitiva que faltava é UMA: um traço curvo com ESPESSURA VARIÁVEL ao
longo do comprimento. Dela saem pena, chama, pétala, lâmina, fita,
gavinha, fumaça, raiz — tudo que é orgânico. É a diferença entre
desenhar e carimbar.

NADA AQUI SABE O QUE É UMA INSÍGNIA. Este módulo só conhece pontos,
curvas e normais; quem monta a arte é `pincel.py`. A separação é o que
permite construir formas novas sem tocar na matemática.
"""
from __future__ import annotations
import math
from typing import Callable, Sequence

Ponto = tuple[float, float]


# ── BÉZIER CÚBICA ────────────────────────────────────────────────────

def bezier(p0: Ponto, p1: Ponto, p2: Ponto, p3: Ponto, t: float) -> Ponto:
    """Ponto sobre a curva em t ∈ [0,1]."""
    u = 1.0 - t
    a, b, c, d = u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t
    return (a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
            a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1])


def tangente(p0: Ponto, p1: Ponto, p2: Ponto, p3: Ponto, t: float) -> Ponto:
    """
    Derivada — a direção da curva em t, normalizada.

    O caso t=0 com p0==p1 daria vetor nulo e uma normal (0,0), que
    colapsaria o contorno num traço de espessura zero exatamente na
    base. Por isso o fallback: quando a derivada some, olha um passo
    adiante em vez de devolver lixo.
    """
    u = 1.0 - t
    dx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0])
    dy = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1])
    n = math.hypot(dx, dy)
    if n < 1e-9:
        adiante = min(1.0, t + 1e-3)
        if adiante != t:
            return tangente(p0, p1, p2, p3, adiante)
        return (1.0, 0.0)
    return (dx / n, dy / n)


def normal(p0: Ponto, p1: Ponto, p2: Ponto, p3: Ponto, t: float) -> Ponto:
    """Perpendicular à esquerda da direção de avanço."""
    tx, ty = tangente(p0, p1, p2, p3, t)
    return (-ty, tx)


# ── PERFIS DE ESPESSURA ──────────────────────────────────────────────
#
# Um perfil é uma função t → largura relativa (0..1). É ele que dá
# CARÁTER ao traço: a mesma curva com perfis diferentes vira pena, chama
# ou lâmina. Ficam aqui os que se repetem; qualquer lambda serve.

def perfil_folha(t: float) -> float:
    """Grosso no meio, fino nas duas pontas. Pétala, folha, pena."""
    return math.sin(math.pi * min(1.0, max(0.0, t))) ** 0.85


def perfil_lamina(t: float) -> float:
    """Largo na base, ponta afiada. Lâmina, chama, espinho."""
    t = min(1.0, max(0.0, t))
    return (1.0 - t) ** 0.7


def perfil_gota(t: float) -> float:
    """Fino na base, bojudo no fim. Gota, bulbo, tocha."""
    t = min(1.0, max(0.0, t))
    return (t ** 0.6) * (1.0 - t * 0.15)


def perfil_fita(t: float) -> float:
    """Quase constante, com as pontas apenas suavizadas."""
    t = min(1.0, max(0.0, t))
    return min(1.0, math.sin(math.pi * t) * 2.2)


def perfil_caligrafico(t: float) -> float:
    """
    Como uma pena de nanquim: pressão sobe rápido e alivia devagar.

    O assimétrico é o ponto. Perfil simétrico lê como tubo; este lê como
    gesto de mão, e é ele que faz um floreio parecer escrito em vez de
    desenhado.
    """
    t = min(1.0, max(0.0, t))
    return math.sin(math.pi * (t ** 0.62)) ** 0.9


# ── CONTORNO: A PRIMITIVA CENTRAL ────────────────────────────────────

def contorno(eixo: Sequence[Ponto], largura: float,
             perfil: Callable[[float], float] = perfil_folha,
             passos: int = 48, fechar: bool = True,
             assimetria: float = 0.5) -> str:
    """
    Transforma uma Bézier num traço PREENCHIDO de espessura variável.

    É a primitiva que o motor antigo não tinha, e a razão de ele só
    conseguir fazer mandala.

    `assimetria` desloca a espessura entre os dois lados: 0.5 é
    simétrico; 0.8 engorda a esquerda. Um traço perfeitamente simétrico
    lê como tubo — a assimetria leve é o que dá a sensação de que
    alguém segurou uma caneta.

    Devolve um `d` de path fechado, pronto para preencher com gradiente.
    Não devolve `<path>` inteiro de propósito: quem decide fill, filtro
    e classe é a camada de cima.
    """
    p0, p1, p2, p3 = eixo
    esq: list[Ponto] = []
    dir_: list[Ponto] = []
    for i in range(passos + 1):
        t = i / passos
        px, py = bezier(p0, p1, p2, p3, t)
        nx, ny = normal(p0, p1, p2, p3, t)
        w = largura * max(0.0, perfil(t))
        we, wd = w * assimetria, w * (1.0 - assimetria)
        esq.append((px + nx * we, py + ny * we))
        dir_.append((px - nx * wd, py - ny * wd))

    # A ida pela esquerda, a volta pela direita — um contorno só.
    pontos = esq + list(reversed(dir_))
    d = f"M {pontos[0][0]:.2f} {pontos[0][1]:.2f}"
    for x, y in pontos[1:]:
        d += f" L {x:.2f} {y:.2f}"
    return d + (" Z" if fechar else "")


def suavizar(pontos: Sequence[Ponto], tensao: float = 0.5) -> str:
    """
    Um path que passa por todos os pontos com curvas, não com quinas.

    Catmull-Rom convertida para Bézier. Existe porque contornos gerados
    ponto a ponto ficam facetados nas bordas quando ampliados, e uma
    insígnia é vista em três tamanhos — inclusive 140px, onde faceta
    aparece.
    """
    if len(pontos) < 2:
        return ""
    d = f"M {pontos[0][0]:.2f} {pontos[0][1]:.2f}"
    n = len(pontos)
    for i in range(n - 1):
        p_ant = pontos[i - 1] if i > 0 else pontos[i]
        p_a, p_b = pontos[i], pontos[i + 1]
        p_pos = pontos[i + 2] if i + 2 < n else p_b
        c1 = (p_a[0] + (p_b[0] - p_ant[0]) * tensao / 3,
              p_a[1] + (p_b[1] - p_ant[1]) * tensao / 3)
        c2 = (p_b[0] - (p_pos[0] - p_a[0]) * tensao / 3,
              p_b[1] - (p_pos[1] - p_a[1]) * tensao / 3)
        d += (f" C {c1[0]:.2f} {c1[1]:.2f}, {c2[0]:.2f} {c2[1]:.2f},"
              f" {p_b[0]:.2f} {p_b[1]:.2f}")
    return d


def caminho(eixo: Sequence[Ponto]) -> str:
    """O `d` da linha central, sem espessura. Útil para stroke puro."""
    p0, p1, p2, p3 = eixo
    return (f"M {p0[0]:.2f} {p0[1]:.2f} C {p1[0]:.2f} {p1[1]:.2f}, "
            f"{p2[0]:.2f} {p2[1]:.2f}, {p3[0]:.2f} {p3[1]:.2f}")


def sobre(eixo: Sequence[Ponto], t: float) -> Ponto:
    """Atalho: ponto sobre o eixo. Para ancorar coisas na curva."""
    return bezier(eixo[0], eixo[1], eixo[2], eixo[3], t)


def angulo_em(eixo: Sequence[Ponto], t: float) -> float:
    """Ângulo da tangente em graus — para orientar o que se ancora."""
    tx, ty = tangente(eixo[0], eixo[1], eixo[2], eixo[3], t)
    return math.degrees(math.atan2(ty, tx))


def limites(d: str) -> tuple[float, float, float, float]:
    """
    Caixa (min_x, min_y, max_x, max_y) de um path — só dos números.

    Serve à validação: o motor antigo emitia gotas em y=-25 num viewBox
    0..300, e com `overflow:visible` no template elas desenhavam FORA da
    insígnia, por cima de outros elementos da tela. Ninguém percebeu
    porque nada quebra.
    """
    import re
    nums = [float(x) for x in re.findall(r'-?\d+\.?\d*', d)]
    xs, ys = nums[0::2], nums[1::2]
    if not xs or not ys:
        return (0.0, 0.0, 0.0, 0.0)
    return (min(xs), min(ys), max(xs), max(ys))
