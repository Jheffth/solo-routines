# -*- coding: utf-8 -*-
"""
Missões especiais — quem pode criar, e o que cada natureza significa.

PONTO ÚNICO DE PERMISSÃO. Este arquivo existe para que a regra "quem pode
forjar uma missão passiva" tenha UM endereço. Toda vez que este projeto
espalhou uma regra por vários arquivos, ela divergiu: os catálogos de aura
duplicados, os dois relógios, as duas tabelas de recompensa. E numa trava de
acesso a divergência é pior que feia — é uma porta esquecida.

São QUATRO portas, sempre: criar e editar, pela tela e pela API. A tela é a
mais fácil de lembrar e a menos importante: quem quer burlar usa a API.

HOJE: Arquiteto e toda a Staff (`NIVEIS_ADMIN`). Amanhã, quando existirem
outorgas com prazo (Insígnia VIP), basta acrescentar a consulta a elas AQUI —
e todos os pontos de checagem passam a respeitá-la de uma vez.

AS NATUREZAS

  ATIVA    o estado natural é o FRACASSO. O hunter age para vencer.
           Se o prazo vence sem conclusão → FRACASSADA + punição.

  PASSIVA  o estado natural é o SUCESSO. O hunter age para PERDER.
           Se o prazo vence sem confissão → CONCLUIDA + recompensa.
           É um protocolo: "sem cafeína após as 16h", corrido até as 05:00.
           Quem quebra vai ao cartão e CONFESSA — não há como verificar, e é
           justamente por isso que confessar precisa ser barato (economia.py).
"""
from auth.router import NIVEIS_ADMIN

# Naturezas conhecidas. "ATIVA" é o padrão de todo o app até aqui.
ATIVA = "ATIVA"
PASSIVA = "PASSIVA"
NATUREZAS = (ATIVA, PASSIVA)

# Naturezas que exigem permissão para serem criadas. ATIVA é de todos.
PREMIUM = (PASSIVA,)

# Quem pode forjar missão especial. Mesma tupla que já define a Staff em
# auth/router.py — importada, não copiada, para não haver duas verdades.
FORJADORES_ESPECIAIS = NIVEIS_ADMIN


def normalizar(valor) -> str:
    """Qualquer coisa fora do catálogo vira ATIVA. Um valor desconhecido no
    banco não pode virar uma missão de comportamento imprevisível."""
    v = (valor or ATIVA).strip().upper()
    return v if v in NATUREZAS else ATIVA


def eh_premium(natureza) -> bool:
    return normalizar(natureza) in PREMIUM


def pode_criar(usuario, natureza) -> bool:
    """A pergunta que os routers fazem. Uma linha, um lugar."""
    if not eh_premium(natureza):
        return True
    return (getattr(usuario, "nivel_acesso", "") or "") in FORJADORES_ESPECIAIS


def permissao(usuario) -> dict:
    """O que a tela precisa saber para decidir o que OFERECER.

    A tela nunca decide se PODE — ela decide o que MOSTRAR. Quem decide se
    pode é o servidor, em `pode_criar`, a cada requisição."""
    liberado = (getattr(usuario, "nivel_acesso", "") or "") in FORJADORES_ESPECIAIS
    return {
        "pode_especiais": liberado,
        "naturezas": list(NATUREZAS) if liberado else [ATIVA],
        "motivo": None if liberado
                  else "Missões especiais são exclusivas da Staff por enquanto.",
    }
