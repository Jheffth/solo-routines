# -*- coding: utf-8 -*-
"""
Catálogo de cosméticos — a fonte única de verdade.

Por que este arquivo existe: o catálogo de auras estava DUPLICADO em dois
routers, e os dois já haviam divergido. `auras.py` conhecia só "bella-rosa";
`materiais.py` conhecia "bella-rosa" e "pink-spirit". Como a cerimônia usa
`CATALOGO.get(id, {})` com valores de reserva, uma aura pink-spirit pendente
era celebrada SEM NOME e BRANCA — o hunter recebia um presente anônimo.

Duplicar catálogo é assim: não quebra na hora, quebra quando alguém adiciona
um item em um lugar só. Com a loja passando a VENDER cosméticos, seriam três
lugares para esquecer. Então passa a ser um só.

Como acrescentar um cosmético novo:
    1. desenhe-o no frontend  (Auras.registrar('meu-id', fn) em js/auras.js)
    2. descreva-o aqui        (uma entrada em AURAS)
    3. cadastre-o na loja     (tipo="aura", payload="meu-id")
Nada mais. O resto do sistema o enxerga sozinho.
"""

# ── Auras ────────────────────────────────────────────────────────────
# `enviavel` = pode circular na Casa de Trocas entre hunters.
AURAS = {
    "bella-rosa": {
        "id":        "bella-rosa",
        "nome":      "Bella Rosa — Femme Fatale",
        "descricao": "11 camadas: halos magenta, 4 grupos de pétalas, espinhos, "
                     "shimmers e faíscas em órbita. Aura espetacular e expansiva.",
        "cor":       "#ff1493",
        "enviavel":  True,
    },
    "pink-spirit": {
        "id":        "pink-spirit",
        "nome":      "Pink Spirit",
        "descricao": "Aura rosa tradicional. 16 pétalas com shimmers luminosos.",
        "cor":       "#f48fb1",
        "enviavel":  True,
    },
}


def aura(aura_id: str) -> dict:
    """Descrição da aura, ou um esqueleto honesto quando o id é desconhecido.

    O esqueleto carrega o próprio id como nome: se algum dia aparecer uma aura
    fora do catálogo, ela some do rodapé como "bella-rosa" em vez de virar um
    borrão branco sem identidade. É feio de propósito — para ser notado."""
    return AURAS.get(aura_id) or {
        "id": aura_id, "nome": aura_id, "descricao": "",
        "cor": "#ffffff", "enviavel": False,
    }


def existe(aura_id: str) -> bool:
    return aura_id in AURAS


def enviaveis() -> list:
    """As que circulam na Casa de Trocas."""
    return [a for a in AURAS.values() if a.get("enviavel")]
