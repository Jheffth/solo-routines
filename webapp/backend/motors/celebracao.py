# -*- coding: utf-8 -*-
"""
Celebração — o backend DECLARA o que deve virar festa na tela.

O problema que isto encerra: o frontend adivinhava a celebração pelo NOME dos
campos da resposta. Ele vasculhava cinco formatos diferentes procurando
`xp_ganho`, `level_ups`, `novas_conquistas`, `eventos_xp`… e, ao achar
qualquer um, entendia "o hunter acabou de ganhar isto agora".

Adivinhar pelo nome tem um custo que apareceu do pior jeito: o `/extrato/resumo`
devolve o XP SOMADO do período — um relato, não um ganho. O frontend leu como
recompensa, disparou o evento de recompensa, o app recarregou a página, refez a
leitura… e o servidor entrou num laço infinito. O mesmo mecanismo fazia
`/emblemas/pendentes` reexibir a cerimônia de medalhas a cada leitura.

A regra nova é explícita e tem um só nome:

    sr_eventos  →  "celebre isto agora"

Se a chave não existe, não há festa. Ponto. Nenhum campo chamado `xp_ganho`,
`total_xp` ou o que for volta a ligar fogos por acidente.

O modo de falhar também melhora. Antes, esquecer era catastrófico (laço
infinito). Agora, esquecer de anexar o envelope só faz a animação não aparecer:
visível, inofensivo e fácil de corrigir.
"""
from typing import Optional


def eventos(resultado: Optional[dict] = None, **extras) -> dict:
    """
    Monta o envelope canônico a partir do que `aplicar_xp` devolveu.

    Aceita também os casos que não passam por `aplicar_xp` (concessão manual de
    emblema, level-up forçado pelo Arquiteto), via `extras`.
    """
    r = resultado or {}
    env = {
        "xp_ganho":      extras.get("xp_ganho",      r.get("xp_ganho", 0)) or 0,
        "moedas_ganhas": extras.get("moedas_ganhas", r.get("moedas_ganhas", 0)) or 0,
        "level_ups":     extras.get("level_ups",     r.get("level_ups")) or [],
        "conquistas":    extras.get("conquistas",    r.get("conquistas")) or [],
    }
    return env


def vazio(env: dict) -> bool:
    """Nada a comemorar? Então não vale sujar a resposta com o envelope."""
    return not (env["xp_ganho"] or env["moedas_ganhas"]
                or env["level_ups"] or env["conquistas"])


def anexar(payload: dict, resultado: Optional[dict] = None, **extras) -> dict:
    """
    Carimba `sr_eventos` no topo da resposta e devolve o próprio payload.

    Uso nos endpoints que de fato concedem recompensa:

        return anexar({"tarefa": ..., "resultado": resultado}, resultado)

    Fica no TOPO de propósito: o frontend lê um lugar só, nunca mais precisa
    procurar dentro de `resultado`, `eventos_xp` ou seja lá qual aninhamento.
    """
    env = eventos(resultado, **extras)
    if not vazio(env):
        payload["sr_eventos"] = env
    return payload
