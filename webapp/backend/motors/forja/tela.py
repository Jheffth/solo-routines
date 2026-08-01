# -*- coding: utf-8 -*-
"""
TELA — a composição, agora sobre `drawsvg`.

POR QUE ESTE ARQUIVO SUBSTITUI O `compositor.py`

O Arquiteto sugeriu `svgwrite`, `drawSvg` e `Jinja2` ANTES de eu escrever
o motor, e eu ignorei as três alegando que "elas resolvem como escrever
`<path>`, e esse nunca foi o problema". Estava parcialmente errado: 262
das minhas linhas eram exatamente esse problema.

Medido depois, com o `drawsvg` na mão:

    id_prefix=       gera ids namespaced sozinho
    fill=gradiente   resolve a referencia url(#id) sozinho
    append_def       monta o bloco <defs> sozinho
    append_css       monta o <style> sozinho
    as_svg           emite o XML com header e namespaces corretos

Tudo isso eu tinha reimplementado à mão. O que SOBRA para este arquivo é
só o que a biblioteca não faz e o projeto precisa:

  1. CAMADAS COM PROFUNDIDADE — z-order e desfoque por distância, que é
     o que dá ar entre o objeto e o fundo.
  2. AS RECUSAS — quatro checagens que levantam exceção em vez de
     entregar arte defeituosa. Cada uma nasceu de um defeito real que
     foi para produção sem quebrar nada.
  3. O `{U}` DE RUNTIME — o `id_prefix` do drawsvg é fixo na geração, e
     o projeto renderiza a MESMA insígnia três vezes na mesma página
     (vitrine da Forja). Ids iguais fazem o primeiro SVG vencer e os
     outros herdarem o filtro errado. Então o prefixo vira uma
     interpolação de JavaScript, resolvida por instância no navegador.

O que NÃO mudou: `geometria.py`. Conferido que o drawsvg não tem curva
de espessura variável — é a única parte do motor que precisava mesmo ser
escrita do zero.
"""
from __future__ import annotations
import math
import re
from typing import Iterable

import drawsvg as dw

from . import geometria as G

# O prefixo que o drawsvg usa na geração e que vira `${u}` no JavaScript.
# Precisa ser algo que nunca apareça por acidente no resto do SVG.
_MARCA = "FORJAUID"


class ForjaErro(Exception):
    """Arte defeituosa. Melhor explodir no build que na tela do hunter."""


class Camada:
    """
    Um grupo com profundidade. `z` maior = mais perto do olho.

    O drawsvg tem `Group`, mas não tem ordenação por profundidade nem
    atmosfera. Camadas ao fundo recebem desfoque e perdem opacidade
    automaticamente — é o que separa "elementos empilhados" de "uma cena
    com ar".
    """

    def __init__(self, nome: str, z: float = 0.0, classe: str = "",
                 opacidade: float = 1.0, desfoque: float = 0.0,
                 atributos: str = "", **attrs):
        self.nome = nome
        self.z = z
        self.classe = classe
        self.opacidade = opacidade
        self.desfoque = desfoque
        self.atributos = atributos
        self.attrs = attrs
        self.itens: list = []

    def add(self, *elementos) -> "Camada":
        """
        Aceita elementos do drawsvg OU strings de path `d`.

        As strings existem porque `geometria` e `pincel` devolvem `d`
        cru — é a fronteira entre a matemática e o desenho, e forçá-los a
        conhecer o drawsvg acoplaria a parte que não precisa.
        """
        self.itens.extend(e for e in elementos if e is not None)
        return self


class Tela:
    """A composição em construção. Tudo passa por aqui para ser conferido."""

    def __init__(self, nome: str, vb: int = 300):
        self.nome = nome
        self.vb = vb
        self.centro = (vb / 2.0, vb / 2.0)
        self._d = dw.Drawing(vb, vb, id_prefix=_MARCA)
        self._camadas: list[Camada] = []
        self._css: list[str] = []

    # ── materiais ────────────────────────────────────────────────────
    #
    # Cada helper REGISTRA o def e devolve a string `url(#id)`.
    #
    # Devolver a referência em vez do objeto é o que permite as peças
    # continuarem escrevendo SVG em string — `fill="{ref}"` — enquanto o
    # drawsvg cuida do documento. O id e explicito (nao o automatico da
    # biblioteca) justamente porque a string precisa conhece-lo ANTES da
    # renderizacao; conferido que o drawsvg aceita e que a referencia
    # resolve.

    def _reg(self, nome: str, obj) -> str:
        ident = f"{_MARCA}_{nome}"
        obj.args["id"] = ident
        self._d.append_def(obj)
        return f"url(#{ident})"

    def linear(self, nome: str, paradas: Iterable[tuple],
               x1=0, y1=0, x2=0, y2=1) -> str:
        """
        Gradiente linear em coordenadas RELATIVAS ao viewBox (0..1).

        O drawsvg usa `userSpaceOnUse` — coordenadas absolutas. Para arte
        que se monta em 30, 92, 140 e 300px, o relativo e o que faz o
        gradiente acompanhar a escala.
        """
        g = dw.LinearGradient(x1 * self.vb, y1 * self.vb,
                              x2 * self.vb, y2 * self.vb)
        for o, cor, op in paradas:
            g.add_stop(o, cor, op)
        return self._reg(nome, g)

    def radial(self, nome: str, paradas: Iterable[tuple],
               cx=.5, cy=.5, r=.5) -> str:
        g = dw.RadialGradient(cx * self.vb, cy * self.vb, r * self.vb)
        for o, cor, op in paradas:
            g.add_stop(o, cor, op)
        return self._reg(nome, g)

    def metal(self, nome: str, escuro: str, medio: str, claro: str,
              angulo: float = 108) -> str:
        """
        Gradiente que le como metal: realce ESTREITO, retorno rapido.

        Gradiente suave de escuro a claro parece plastico. Metal tem uma
        faixa de luz curta porque a superficie e lisa e reflete o
        ambiente em poucos graus.
        """
        a = math.radians(angulo)
        return self.linear(nome, [
            (0.00, escuro, 1), (0.34, medio, 1), (0.46, claro, 1),
            (0.53, medio, 1), (0.78, escuro, 1), (1.00, medio, 1),
        ], 0.5 - math.cos(a) * .5, 0.5 - math.sin(a) * .5,
           0.5 + math.cos(a) * .5, 0.5 + math.sin(a) * .5)

    def desfoque(self, nome: str, raio: float) -> str:
        f = dw.Filter(x="-25%", y="-25%", width="150%", height="150%")
        f.append(dw.FilterItem("feGaussianBlur", stdDeviation=raio))
        return self._reg(nome, f)

    def sombra(self, nome: str, dx=0, dy=2, raio=2.5,
               cor="#000", op=.8) -> str:
        f = dw.Filter(x="-30%", y="-30%", width="160%", height="160%")
        f.append(dw.FilterItem("feDropShadow", dx=dx, dy=dy,
                               stdDeviation=raio, flood_color=cor,
                               flood_opacity=op))
        return self._reg(nome, f)

    def brilho(self, nome: str, raio=2.6, forca=1.0) -> str:
        """
        Glow que PRESERVA o desenho.

        `feGaussianBlur` sozinho borra o original; o `feMerge` recoloca o
        desenho nitido por cima do borrao. Sem ele a arte fica leitosa —
        e era assim que o motor antigo fazia.
        """
        f = dw.Filter(x="-40%", y="-40%", width="180%", height="180%")
        f.append(dw.Raw(
            f'<feGaussianBlur stdDeviation="{raio}" result="b"/>'
            f'<feComponentTransfer in="b" result="bb">'
            f'<feFuncA type="linear" slope="{forca}"/></feComponentTransfer>'
            f'<feMerge><feMergeNode in="bb"/>'
            f'<feMergeNode in="SourceGraphic"/></feMerge>'))
        return self._reg(nome, f)

    def recorte_circular(self, nome: str, cx: float, cy: float,
                         r: float) -> str:
        cp = dw.ClipPath()
        cp.append(dw.Circle(cx, cy, r))
        return self._reg(nome, cp)

    def css(self, *regras: str) -> "Tela":
        self._css.extend(regras)
        return self

    def camada(self, nome: str, z: float = 0.0, **kw) -> Camada:
        c = Camada(nome, z, **kw)
        self._camadas.append(c)
        return c

    # ── verificação ──────────────────────────────────────────────────
    def _conferir(self, svg: str) -> None:
        """
        As recusas. Cada uma corresponde a um defeito que foi para
        produção e não quebrou nada — que é o que o torna capaz de voltar.
        """
        # (a) referências órfãs. O drawsvg previne por construção, mas
        #     quem passar SVG cru pela porta das strings escapa disso.
        definidos = set(re.findall(r'\sid="([^"]+)"', svg))
        orfas = set(re.findall(r'url\(#([^)]+)\)', svg)) - definidos
        if orfas:
            raise ForjaErro(
                f"{self.nome}: referências órfãs {sorted(orfas)} — "
                f"url(#x) sem o #x definido não desenha e não avisa.")

        # (b) ids sem o marcador de instância
        crus = [i for i in definidos if _MARCA not in i]
        if crus:
            raise ForjaErro(
                f"{self.nome}: ids fixos {sorted(crus)} — colidem quando a "
                f"Forja mostra três tamanhos no mesmo documento.")

        # (c) nada fora do viewBox
        corpo = svg[svg.index("</defs>"):] if "</defs>" in svg else svg
        fora = []
        for d in re.findall(r'\sd="([^"]+)"', corpo):
            x0, y0, x1, y1 = G.limites(d)
            if x0 < -300 or y0 < -300 or x1 > self.vb + 300 or y1 > self.vb + 300:
                fora.append((round(x0), round(y0), round(x1), round(y1)))
        for m in re.finditer(r'c([xy])="(-?[\d.]+)"', corpo):
            v = float(m.group(2))
            if v < -300 or v > self.vb + 300:
                fora.append(("centro", v))
        if fora:
            raise ForjaErro(
                f"{self.nome}: {len(fora)} elemento(s) fora do viewBox "
                f"0..{self.vb}. Exemplos: {fora[:3]}")

        # (d) acessibilidade
        if "@keyframes" in svg and "prefers-reduced-motion" not in svg:
            raise ForjaErro(
                f"{self.nome}: tem animação e nenhuma saída para "
                f"prefers-reduced-motion.")

        # (e) a crase fecharia o template literal de JS no meio.
        if "`" in svg:
            raise ForjaErro(
                f"{self.nome}: o SVG contém uma crase. Ela fecharia o "
                f"template literal do JavaScript — já quebrou este "
                f"projeto três vezes.")

    # ── saída ────────────────────────────────────────────────────────
    def montar(self, classe_raiz: str = "forja-svg") -> str:
        """
        O SVG final, conferido, com `{U}` e `{TAM}` para o template.
        """
        for c in sorted(self._camadas, key=lambda x: x.z):
            if not c.itens:
                continue
            attrs = dict(c.attrs)
            if c.classe:
                attrs["class_"] = c.classe
            if c.opacidade < 1.0:
                attrs["opacity"] = round(c.opacidade, 3)
            if c.desfoque > 0:
                attrs["filter"] = self.desfoque(f"blur{int(c.desfoque*10)}",
                                                c.desfoque)
            g = dw.Group(**attrs)
            # `atributos` e a escapatoria para SVG cru (filter=, clip-path=)
            # que as pecas ja escreviam como texto. Injetado na abertura da
            # tag depois, porque o drawsvg nao aceita atributo arbitrario
            # em string.
            g._forja_extra = c.atributos
            for item in c.itens:
                g.append(dw.Raw(item) if isinstance(item, str) else item)
            self._d.append(g)

        if self._css:
            self._d.append_css("\n".join(self._css))

        svg = self._d.as_svg()
        self._conferir(svg)

        # O drawsvg emite width/height fixos e um header XML que não cabe
        # dentro de um template literal de JS. Troca pelos buracos.
        svg = re.sub(r'<\?xml[^>]*\?>\s*', '', svg)
        svg = re.sub(r'width="\d+" height="\d+"',
                     'width="{TAM}" height="{TAM}"', svg, count=1)
        svg = svg.replace(
            '<svg ', f'<svg class="{classe_raiz}" aria-hidden="true" '
                     f'focusable="false" '
                     f'style="display:block;overflow:hidden;'
                     f'width:{{TAM}}px;height:{{TAM}}px" ', 1)
        return svg.replace(_MARCA, "{U}")


def raw(svg: str):
    """Escapatória explícita para SVG cru. Passa pelas mesmas recusas."""
    return dw.Raw(svg)
