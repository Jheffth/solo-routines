# -*- coding: utf-8 -*-
"""
COMPOSITOR — monta o SVG e RECUSA entregar arte quebrada.

Este arquivo existe por causa de quatro defeitos medidos no motor
anterior. Nenhum deles quebrava nada, e é justamente por isso que
sobreviveram:

  1. ELE MENTIA. `exportar_js` imprimia "Insígnia gerada com sucesso" e
     escrevia um JavaScript que não compilava — crase escapada dentro de
     código de topo. O arquivo entrou no repositório e só foi descoberto
     quando um teste tentou carregá-lo.

  2. IDs GLOBAIS. `id="shadow"`, `id="glow"`, `id="grad-carmesim"`. A
     vitrine da Forja renderiza TRÊS tamanhos da mesma insígnia no mesmo
     documento; três `id="shadow"` e o primeiro vence — as outras duas
     herdam o filtro errado, em silêncio.

  3. COORDENADAS FORA DA TELA. Gotas em y = -5, -20, -25 num viewBox
     0..300, com `overflow:visible` no template. Elas não sumiam: elas
     desenhavam POR CIMA de outros elementos da página.

  4. SEM `prefers-reduced-motion`. Três animações infinitas, uma delas
     uma rotação de 40s, sem nenhuma saída para quem não pode vê-las.

A regra aqui é simples: `montar()` levanta exceção em vez de devolver
arte defeituosa. Um build que falha é barato; uma insígnia quebrada em
produção custa uma sessão inteira para achar.
"""
from __future__ import annotations
import math
import re
import string
import random
from typing import Iterable

from . import geometria as G


class ForjaErro(Exception):
    """Arte defeituosa. Melhor explodir no build que na tela do hunter."""


class Camada:
    """
    Um grupo com profundidade. `z` maior = mais perto do olho.

    ATMOSFERA POR DISTÂNCIA: camadas ao fundo recebem desfoque e perdem
    opacidade automaticamente. Isso é o que separa "elementos empilhados"
    de "uma cena com ar" — e o motor antigo não tinha nada disso, então
    tudo ficava no mesmo plano, gritando com a mesma força.
    """

    def __init__(self, nome: str, z: float = 0.0, classe: str = "",
                 opacidade: float = 1.0, desfoque: float = 0.0,
                 atributos: str = ""):
        self.nome = nome
        self.z = z
        self.classe = classe
        self.opacidade = opacidade
        self.desfoque = desfoque
        self.atributos = atributos
        self.corpo: list[str] = []

    def add(self, *svg: str) -> "Camada":
        self.corpo.extend(s for s in svg if s)
        return self


class Composicao:
    """
    O SVG em construção. Tudo passa por aqui para poder ser verificado.
    """

    def __init__(self, nome: str, view_box: int = 300, semente: int = 7):
        self.nome = nome
        self.vb = view_box
        self.centro = (view_box / 2.0, view_box / 2.0)
        self._camadas: list[Camada] = []
        self._defs: list[str] = []
        self._css: list[str] = []
        self._ids: set[str] = set()
        # Prefixo curto e determinístico por nome — dois builds da mesma
        # insígnia dão o mesmo arquivo, e insígnias diferentes nunca
        # colidem. O sufixo por INSTÂNCIA (no navegador) vem do template.
        r = random.Random(nome)
        self._pre = "f" + "".join(r.choice(string.ascii_lowercase) for _ in range(4))

    # ── ids ──────────────────────────────────────────────────────────
    def id(self, base: str) -> str:
        """
        Um id namespaced. NUNCA devolver um id cru daqui.

        O `{U}` é substituído no navegador por um sufixo único por
        instância (ver template). Assim o mesmo arquivo pode ser
        renderizado três vezes na mesma página sem que os filtros de um
        vazem para o outro — o defeito 2 da lista acima.
        """
        nid = f"{self._pre}-{base}-{{U}}"
        self._ids.add(nid)
        return nid

    def url(self, base: str) -> str:
        return f"url(#{self._pre}-{base}-{{U}})"

    # ── acúmulo ──────────────────────────────────────────────────────
    def defs(self, *svg: str) -> "Composicao":
        self._defs.extend(svg)
        return self

    def css(self, *regras: str) -> "Composicao":
        self._css.extend(regras)
        return self

    def camada(self, nome: str, z: float = 0.0, **kw) -> Camada:
        c = Camada(nome, z, **kw)
        self._camadas.append(c)
        return c

    # ── verificação ──────────────────────────────────────────────────
    def _conferir(self, svg: str) -> None:
        """
        As quatro checagens. Levantam ForjaErro — não avisam e seguem.
        """
        # (a) toda referência resolve
        definidos = set(re.findall(r'\sid="([^"]+)"', svg))
        usados = set(re.findall(r'url\(#([^)]+)\)', svg))
        orfas = usados - definidos
        if orfas:
            raise ForjaErro(
                f"{self.nome}: referências órfãs {sorted(orfas)} — "
                f"url(#x) sem o #x definido não desenha nada e não avisa.")

        # (b) nenhum id cru
        crus = [i for i in definidos if "{U}" not in i]
        if crus:
            raise ForjaErro(
                f"{self.nome}: ids sem namespace {sorted(crus)} — "
                f"colidem quando a Forja mostra três tamanhos juntos.")

        # (c) nada fora do viewBox
        corpo = svg[svg.index("</defs>"):] if "</defs>" in svg else svg
        fora = []
        for d in re.findall(r'\sd="([^"]+)"', corpo):
            x0, y0, x1, y1 = G.limites(d)
            if x0 < -2 or y0 < -2 or x1 > self.vb + 2 or y1 > self.vb + 2:
                fora.append((round(x0), round(y0), round(x1), round(y1)))
        for m in re.finditer(r'c([xy])="(-?[\d.]+)"', corpo):
            v = float(m.group(2))
            if v < -2 or v > self.vb + 2:
                fora.append(("centro", v))
        if fora:
            raise ForjaErro(
                f"{self.nome}: {len(fora)} elemento(s) fora do viewBox "
                f"0..{self.vb} — com overflow:visible eles desenham por "
                f"cima do resto da tela. Exemplos: {fora[:3]}")

        # (d) acessibilidade
        if "@keyframes" in svg and "prefers-reduced-motion" not in svg:
            raise ForjaErro(
                f"{self.nome}: tem animação e nenhuma saída para "
                f"prefers-reduced-motion.")

    # ── saída ────────────────────────────────────────────────────────
    def montar(self, extra_svg: str = "", classe_raiz: str = "forja-svg") -> str:
        """
        O SVG final, conferido. `{U}` fica no texto para o template.

        `classe_raiz` existe porque o projeto já tem duas convenções em
        uso — `aura-svg` nas cinco auras escritas à mão e `conquista-svg`
        nas insígnias. Nenhum CSS as usa hoje (conferido), mas inventar
        uma terceira classe seria deixar uma divergência plantada para
        quando alguém finalmente escrever esse CSS.
        """
        camadas = sorted(self._camadas, key=lambda c: c.z)
        partes = []
        for c in camadas:
            if not c.corpo:
                continue
            attrs = []
            if c.classe:
                attrs.append(f'class="{c.classe}"')
            if c.opacidade < 1.0:
                attrs.append(f'opacity="{c.opacidade:.2f}"')
            if c.desfoque > 0:
                fid = self.id(f"blur{int(c.desfoque*10)}")
                self._defs.append(
                    f'<filter id="{fid}" x="-25%" y="-25%" width="150%" height="150%">'
                    f'<feGaussianBlur stdDeviation="{c.desfoque:.2f}"/></filter>')
                attrs.append(f'filter="url(#{fid})"')
            if c.atributos:
                attrs.append(c.atributos)
            partes.append(f'<!-- {c.nome} -->\n<g {" ".join(attrs)}>\n'
                          + "\n".join(c.corpo) + "\n</g>")

        css = "\n".join(self._css)
        svg = (
            f'<svg viewBox="0 0 {self.vb} {self.vb}" width="{{TAM}}" height="{{TAM}}"\n'
            f'     xmlns="http://www.w3.org/2000/svg" class="{classe_raiz}"\n'
            f'     aria-hidden="true" focusable="false"\n'
            f'     style="display:block;overflow:hidden;width:{{TAM}}px;height:{{TAM}}px">\n'
            f'  <defs>\n' + "\n".join(self._defs) + f'\n  </defs>\n'
            f'  <style>\n{css}\n  </style>\n'
            + "\n".join(partes) + f"\n{extra_svg}\n</svg>"
        )
        self._conferir(svg)
        return svg


# ── AJUDANTES DE MATERIAL ────────────────────────────────────────────

def gradiente_linear(cid: str, paradas: Iterable[tuple[float, str, float]],
                     x1=0, y1=0, x2=0, y2=1) -> str:
    stops = "".join(
        f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>'
        for o, c, a in paradas)
    return (f'<linearGradient id="{cid}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">'
            f'{stops}</linearGradient>')


def gradiente_radial(cid: str, paradas: Iterable[tuple[float, str, float]],
                     cx=.5, cy=.5, r=.5) -> str:
    stops = "".join(
        f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>'
        for o, c, a in paradas)
    return (f'<radialGradient id="{cid}" cx="{cx}" cy="{cy}" r="{r}">'
            f'{stops}</radialGradient>')


def metal(cid: str, escuro: str, medio: str, claro: str, angulo: float = 108) -> str:
    """
    Um gradiente que lê como metal: três bandas com um realce ESTREITO.

    O realce estreito é o truque inteiro. Gradiente suave de escuro a
    claro parece plástico; metal tem uma faixa de luz curta e um retorno
    rápido ao escuro, porque a superfície é lisa e reflete o ambiente em
    poucos graus.
    """
    a = math.radians(angulo)
    x1, y1 = 0.5 - math.cos(a) * .5, 0.5 - math.sin(a) * .5
    x2, y2 = 0.5 + math.cos(a) * .5, 0.5 + math.sin(a) * .5
    return gradiente_linear(cid, [
        (0.00, escuro, 1), (0.34, medio, 1), (0.46, claro, 1),
        (0.53, medio, 1), (0.78, escuro, 1), (1.00, medio, 1),
    ], f"{x1:.3f}", f"{y1:.3f}", f"{x2:.3f}", f"{y2:.3f}")


def sombra_interna(cid: str, dx=0, dy=2, desfoque=2.5, cor="#000", op=.75) -> str:
    """Profundidade sem empilhar cópias deslocadas."""
    return (f'<filter id="{cid}" x="-30%" y="-30%" width="160%" height="160%">'
            f'<feDropShadow dx="{dx}" dy="{dy}" stdDeviation="{desfoque}" '
            f'flood-color="{cor}" flood-opacity="{op}"/></filter>')


def brilho(cid: str, desfoque=2.6, intensidade=1.0) -> str:
    """Glow que PRESERVA o desenho — feMerge, não só blur."""
    return (f'<filter id="{cid}" x="-40%" y="-40%" width="180%" height="180%">'
            f'<feGaussianBlur stdDeviation="{desfoque}" result="b"/>'
            f'<feComponentTransfer in="b" result="bb">'
            f'<feFuncA type="linear" slope="{intensidade}"/></feComponentTransfer>'
            f'<feMerge><feMergeNode in="bb"/><feMergeNode in="SourceGraphic"/>'
            f'</feMerge></filter>')
