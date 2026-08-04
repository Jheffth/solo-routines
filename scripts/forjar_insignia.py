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

from motors.forja.tela import ForjaErro                 # noqa: E402
from motors.forja import entrega                        # noqa: E402
from motors.forja.pecas import pena_punidor             # noqa: E402
from motors.forja.pecas import fenix_v3                 # noqa: E402
from motors.forja.pecas import lobo_sombrio             # noqa: E402
from motors.forja.pecas import isabella                 # noqa: E402
from motors.forja.pecas import lobo_lunar               # noqa: E402

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
    "fenix_v3": {
        "modulo": fenix_v3,
        "badge": {
            "destino": os.path.join(FRONT, "js", "badges", "fenix-v3.js"),
            "ns": "FenixV3FX",
            "codigo": "fenix_v3",
            "titulo": "Ascensão da Fênix V3",
            "descricao": "Forjada no calor de uma Supernova. A entidade de fogo geométrico absoluto.",
            "icone": "🔥",
            "cor": "#fb8500",
            "xp": 9999,
            "moedas": 999,
        },
        "aura": {
            "id": "fenix-v3",
            "titulo": "Fênix V3 (Supernova)",
        },
    },
    "lobo_sombrio": {
        "modulo": lobo_sombrio,
        "badge": {
            "destino": os.path.join(FRONT, "js", "badges", "lobo-sombrio.js"),
            "ns": "LoboSombrioFX",
            "codigo": "lobo_sombrio",
            "titulo": "Monarca Lobo Sombrio",
            "descricao": "Extraído da Escuridão — Vetorizado pela Forja com perfeição absoluta.",
            "icone": "🐺",
            "cor": "#7c3aed",
            "xp": 8000,
            "moedas": 800,
        },
        "aura": {
            "id": "lobo-sombrio",
            "titulo": "Lobo Sombrio (Abissal)",
        },
    },
    "isabella": {
        "modulo": isabella,
        "badge": {
            "destino": os.path.join(FRONT, "js", "badges", "isabella.js"),
            "ns": "IsabellaFX",
            "codigo": "isabella",
            "titulo": "Bella Rosa — Femme Fatale",
            "descricao": "Elegância extrema, banhada em pétalas de seda e aço.",
            "icone": "🎀",
            "cor": "#f48fb1",
            "xp": 6666,
            "moedas": 666,
        },
        "aura": {
            "id": "isabella",
            "titulo": "Bella Rosa (Femme Fatale)",
        },
    },
    "lobo_lunar": {
        "modulo": lobo_lunar,
        "badge": {
            "destino": os.path.join(FRONT, "js", "badges", "lobo-lunar.js"),
            "ns": "LoboLunarFX",
            "codigo": "lobo_lunar",
            "titulo": "Lobo Lunar — Alfa da Alcateia",
            "descricao": "Forjado sob a lua cheia. O uivo que congela o ar e parte a noite ao meio.",
            "icone": "🐺",
            "cor": "#7ec8e3",
            "xp": 8500,
            "moedas": 850,
        },
        "aura": {
            "id": "lobo-lunar",
            "titulo": "Lobo Lunar (Alcateia de Gelo)",
        },
    }
}


def forjar(chave: str) -> None:
    p = PECAS[chave]
    mod = p["modulo"]
    fonte = f"motors/forja/pecas/{mod.__name__.rsplit('.', 1)[-1]}.py"
    print(f"\n── {p['badge']['titulo']} ──")

    svg = mod.insignia(300).montar(classe_raiz="conquista-svg")
    entrega.escrever_insignia(svg, p["badge"]["destino"], fonte=fonte,
                              **{k: v for k, v in p["badge"].items()
                                 if k != "destino"})

    mod_aura = p.get("modulo_aura", mod)
    if hasattr(mod_aura, "aura"):
        fonte_a = f"motors/forja/pecas/{mod_aura.__name__.rsplit('.', 1)[-1]}.py"
        svg_a = mod_aura.aura(300).montar(classe_raiz="aura-svg")
        bloco = entrega.bloco_aura(svg_a, aura_id=p["aura"]["id"],
                                   titulo=p["aura"]["titulo"], fonte=fonte_a)
        entrega.encaixar_aura(os.path.join(FRONT, "js", "auras.js"),
                              p["aura"]["id"], bloco)


def amostras(destino: str = "/tmp") -> None:
    """
    PNGs para julgar a olho.

    Existe porque as duas versões anteriores desta insígnia foram
    aprovadas por medição — contagem de barbas, ausência de rotação — e
    reprovadas pelo Arquiteto assim que ele OLHOU. Assert nenhum
    responde "está bonito?".
    """
    for chave, p in PECAS.items():
        mod = p["modulo"]
        ma = p.get("modulo_aura", mod)
        for nome, fn in (("insignia", getattr(mod, "insignia", None)),
                         ("aura", getattr(ma, "aura", None))):
            if not fn:
                continue
            svg = fn(300).montar()
            png = entrega.amostra_png(
                svg, os.path.join(destino, f"{chave}_{nome}.png"))
            if png:
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
