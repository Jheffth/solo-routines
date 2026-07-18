#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
⚒ Forja de Ícones — Solo Routines
Converte um SVG (extraído de um HTML/JS do projeto ou de um arquivo .svg)
em pacote completo de ícones com transparência real, aura e glow.

Uso:
  # extrai o 1º <svg> depois de um marcador no HTML
  python3 forjar_icone.py --html webapp/frontend/index.html --marcador "<!-- SVG LOGO -->"

  # a partir de um .svg direto
  python3 forjar_icone.py --svg meu_emblema.svg --nome minha_marca --cor 168,85,247

Saídas (em --saida, padrão = pasta atual):
  <nome>_1024.png          logo master
  favicon.png              512x512
  apple-touch-icon.png     180x180
  <nome>.ico               multi-resolução p/ atalho do Windows

Requisitos: pip install --break-system-packages cairosvg pillow
"""
import argparse, io, os, re, sys

try:
    import cairosvg
    from PIL import Image, ImageFilter
except ImportError:
    sys.exit("Faltam dependências:\n  pip install --break-system-packages cairosvg pillow")


def extrair_svg(caminho: str, marcador: str | None) -> str:
    """Extrai o primeiro <svg>...</svg> de um arquivo (HTML, JS ou SVG)."""
    txt = io.open(caminho, encoding="utf-8").read()
    ini = 0
    if marcador and marcador in txt:
        ini = txt.index(marcador)
    ini = txt.index("<svg", ini)
    fim = txt.index("</svg>", ini) + 6
    return txt[ini:fim]


def limpar_svg(svg: str) -> str:
    """Remove o que o renderizador não entende (animações, filtros, traços soltos)."""
    # animação de rotação CSS -> rotação estática elegante
    svg = re.sub(r'style="transform-origin:\s*([\d.]+)px\s+([\d.]+)px;\s*animation:[^"]*"',
                 r'transform="rotate(12 \1 \2)"', svg)
    # arcos de brilho (stroke-dasharray) viram riscos soltos sem animação
    svg = re.sub(r'<circle[^>]*stroke-dasharray[^>]*/>', '', svg)
    # filtros SVG: o glow é recriado no pós-processamento
    svg = re.sub(r'\s*filter="url\(#[^)]*\)"', '', svg)
    # classes de animação do app
    svg = re.sub(r'\s*class="(cq-svg[^"]*|[^"]*girar[^"]*)"', '', svg)
    # garante namespace e tira dimensões relativas
    if 'xmlns=' not in svg:
        svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"', 1)
    svg = re.sub(r'\s(width|height)="[^"]*"', '', svg, count=2)
    svg = re.sub(r'\sstyle="[^"]*(width|height)[^"]*"', '', svg, count=1)
    return svg


def forjar(svg: str, nome: str, cor: tuple, saida: str, tamanho: int = 1200):
    os.makedirs(saida, exist_ok=True)
    tmp_svg = os.path.join(saida, f"_{nome}_limpo.svg")
    io.open(tmp_svg, "w", encoding="utf-8").write(svg)

    # 1. Renderiza a 86% do canvas (margem para a aura não ser cortada)
    interno = int(tamanho * 0.86)
    png_bruto = os.path.join(saida, f"_{nome}_bruto.png")
    cairosvg.svg2png(url=tmp_svg, write_to=png_bruto,
                     output_width=interno, output_height=interno)  # SEM background_color!

    base = Image.open(png_bruto).convert("RGBA")
    canvas = Image.new("RGBA", (tamanho, tamanho), (0, 0, 0, 0))
    off = (tamanho - base.width) // 2
    canvas.paste(base, (off, off), base)

    # 2. Aura externa (desfoque do alfa pintado na cor da marca)
    alpha = canvas.split()[3]
    mascara = alpha.filter(ImageFilter.GaussianBlur(int(tamanho * 0.028)))
    aura = Image.new("RGBA", (tamanho, tamanho), cor + (255,))
    aura.putalpha(mascara.point(lambda p: int(p * 0.5)))

    # 3. Glow interno (a própria arte desfocada por baixo)
    glow = canvas.filter(ImageFilter.GaussianBlur(int(tamanho * 0.0075)))

    # 4. Composição final
    out = Image.alpha_composite(Image.new("RGBA", (tamanho, tamanho), (0, 0, 0, 0)), aura)
    out = Image.alpha_composite(out, glow)
    out = Image.alpha_composite(out, canvas)

    # 5. Exportações
    p = lambda f: os.path.join(saida, f)
    out.resize((1024, 1024), Image.LANCZOS).save(p(f"{nome}_1024.png"))
    out.resize((512, 512), Image.LANCZOS).save(p("favicon.png"))
    out.resize((180, 180), Image.LANCZOS).save(p("apple-touch-icon.png"))
    out.resize((256, 256), Image.LANCZOS).save(
        p(f"{nome}.ico"), format="ICO",
        sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])

    # limpeza dos temporários
    for f in (tmp_svg, png_bruto):
        try: os.remove(f)
        except OSError: pass

    print(f"""
✔ Forjado em: {os.path.abspath(saida)}
  {nome}_1024.png        logo master (papelaria, redes)
  favicon.png            -> webapp/frontend/favicon.png
  apple-touch-icon.png   -> webapp/frontend/apple-touch-icon.png
  {nome}.ico             -> raiz do projeto (atalho do Windows)

Próximos passos:
  1. Copie favicon.png e apple-touch-icon.png para webapp/frontend/
  2. Confirme no <head>: <link rel="icon" type="image/png" href="/favicon.png">
  3. VEJA as imagens antes de entregar (reduza a 16px e confira!)
  4. Atalho: Propriedades -> Alterar Icone -> Procurar -> {nome}.ico
""")


def main():
    ap = argparse.ArgumentParser(description="Forja de Ícones — Solo Routines")
    ap.add_argument("--html", help="arquivo HTML/JS de onde extrair o <svg>")
    ap.add_argument("--svg", help="arquivo .svg de entrada")
    ap.add_argument("--marcador", default="<!-- SVG LOGO -->",
                    help="comentário que precede o <svg> no HTML")
    ap.add_argument("--nome", default="marca", help="nome base dos arquivos")
    ap.add_argument("--cor", default="168,85,247", help="cor da aura R,G,B")
    ap.add_argument("--saida", default=".", help="pasta de saída")
    a = ap.parse_args()

    if not a.html and not a.svg:
        ap.error("informe --html ou --svg")

    svg = extrair_svg(a.svg or a.html, None if a.svg else a.marcador)
    svg = limpar_svg(svg)
    cor = tuple(int(x) for x in a.cor.split(","))
    forjar(svg, a.nome, cor, a.saida)


if __name__ == "__main__":
    main()
