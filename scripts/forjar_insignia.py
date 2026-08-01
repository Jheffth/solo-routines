# -*- coding: utf-8 -*-
"""
FORJAR — gera as artes do projeto a partir do motor.

    python scripts/forjar_insignia.py            # tudo
    python scripts/forjar_insignia.py pena       # só a Pena
    python scripts/forjar_insignia.py --amostras # PNGs para conferir a olho

A VERSÃO ANTERIOR DESTE ARQUIVO desenhava a arte aqui dentro: a pena era
uma string crua de SVG, com coordenadas na mão, porque o motor não tinha
como fazer curvas. Sobrava para ele só a moldura — os anéis radiais.

Agora o script não desenha nada. Ele diz QUAIS peças forjar e PARA ONDE
vão. Todo traço nasce em `motors/forja/pecas/`, e todo traço passa por
`geometria`/`pincel`. Se voltar a aparecer coordenada escrita à mão aqui,
é sinal de que faltou uma primitiva no motor — e a resposta certa é
criar a primitiva, não contornar.
"""
import os
import sys

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(RAIZ, "webapp", "backend"))

from motors.forja.compositor import ForjaErro          # noqa: E402
from motors.forja import saida                          # noqa: E402
from motors.forja.pecas import pena_punidor             # noqa: E402

FRONT = os.path.join(RAIZ, "webapp", "frontend")

PECAS = {
    "pena": {
        "modulo": pena_punidor,
        "badge": {
            "destino": os.path.join(FRONT, "js", "badges", "pena-do-punidor.js"),
            "ns": "PenaPunidorFX",
            "codigo": "pena_do_punidor",
            "titulo": "Pena do Punidor",
            "descricao": ("Forjada pelo Arquiteto que escreveu as leis de ferro "
                          "do Sistema — cada traço desta pena é uma sentença "
                          "inapelável"),
            "icone": "✒",
            "cor": "#ff0a3c",
            "xp": 7777,
            "moedas": 777,
        },
        "aura": {
            "id": "pena-punidor",
            "titulo": "Pena do Punidor",
        },
    },
}


def forjar(chave: str) -> None:
    p = PECAS[chave]
    mod = p["modulo"]
    fonte = f"motors/forja/pecas/{mod.__name__.rsplit('.', 1)[-1]}.py"
    print(f"\n── {p['badge']['titulo']} ──")

    saida.escrever_badge(mod.insignia(300), p["badge"]["destino"],
                         ns=p["badge"]["ns"], codigo=p["badge"]["codigo"],
                         titulo=p["badge"]["titulo"],
                         descricao=p["badge"]["descricao"],
                         icone=p["badge"]["icone"], cor=p["badge"]["cor"],
                         xp=p["badge"]["xp"], moedas=p["badge"]["moedas"],
                         fonte=fonte)

    if hasattr(mod, "aura"):
        bloco = saida._AURA.format(
            aura_id=p["aura"]["id"], titulo=p["aura"]["titulo"], fonte=fonte,
            corpo=saida._js_template_literal(mod.aura(300).montar(classe_raiz="aura-svg")))
        saida.substituir_aura_em(os.path.join(FRONT, "js", "auras.js"),
                                 p["aura"]["id"], bloco)


def amostras(destino: str = "/tmp") -> None:
    """
    PNGs para julgar a olho.

    Existe porque as duas versões anteriores desta insígnia foram
    aprovadas por medição — contagem de barbas, ausência de rotação — e
    reprovadas pelo Arquiteto assim que ele OLHOU. Assert nenhum
    responde "está bonito?".
    """
    try:
        import cairosvg
    except ImportError:
        print("  cairosvg não instalado: pip install cairosvg")
        return
    for chave, p in PECAS.items():
        mod = p["modulo"]
        for nome, fn in (("insignia", getattr(mod, "insignia", None)),
                         ("aura", getattr(mod, "aura", None))):
            if not fn:
                continue
            svg = fn(300).montar().replace("{U}", "x").replace("{TAM}", "520")
            png = os.path.join(destino, f"{chave}_{nome}.png")
            cairosvg.svg2png(bytestring=svg.encode(), write_to=png,
                             output_width=520, output_height=520,
                             background_color="#0a0714")
            print(f"  amostra: {png}")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    try:
        if "--amostras" in sys.argv:
            amostras()
        else:
            for chave in (args or PECAS.keys()):
                if chave not in PECAS:
                    print(f"peça desconhecida: {chave}. Disponíveis: "
                          f"{', '.join(PECAS)}")
                    sys.exit(2)
                forjar(chave)
            print("\nTudo forjado e conferido.")
    except ForjaErro as e:
        # O MOTOR RECUSA EM VEZ DE ENTREGAR ARTE QUEBRADA. O anterior
        # imprimia "gerada com sucesso" e escrevia um JS que não
        # compilava; o arquivo foi para o repositório assim.
        print(f"\n[FORJA RECUSOU]\n{e}\n")
        sys.exit(1)
