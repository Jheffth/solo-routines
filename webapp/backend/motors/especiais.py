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

  REPETICAO  o desfecho não é um evento, é uma CONTAGEM.

           Dois modos, e o que os separa é um campo que pode faltar:

             com `alvo_repeticoes`   META. A barra tem fim, o Sistema sabe
                                     o que é vencer. Fracassa no prazo,
                                     pune, conta para o streak.
             sem `alvo_repeticoes`   BÔNUS. Não há meta, o placar é o
                                     resultado. Não fracassa, não pune,
                                     NÃO conta para o streak.

           O bônus não entra no streak de propósito: streak é a moeda da
           constância, e constância se mede contra um compromisso. Uma
           missão que não promete nada não pode manter a corrente viva com
           um clique.

           ELA NÃO É PREMIUM, e nada aqui a trava — entra no catálogo só
           para o `normalizar()` não a rebaixar a ATIVA, o que apagaria a
           contagem inteira em silêncio.

  PASSIVA  o estado natural é o SUCESSO. O hunter age para PERDER.
           Se o prazo vence sem confissão → CONCLUIDA + recompensa.
           É um protocolo: "sem cafeína após as 16h", corrido até as 05:00.
           Quem quebra vai ao cartão e CONFESSA — não há como verificar, e é
           justamente por isso que confessar precisa ser barato (economia.py).

  CONDICIONAL  a missão tem uma PERGUNTA. Ao concluir o dia, o hunter
           escolhe entre dois ramos (A ou B). A missão sempre é concluída —
           o que muda é o ajuste de XP e a mensagem de retorno.

           Diferente da PASSIVA: a condicional não inverte o desfecho —
           ela bifurca. "Fiz o treino? → A (cheio) | B (incompleto)".
           O ramo B não é derrota: é honestidade recompensada de forma menor.

O ADJETIVO PROGRESSIVA

  Qualquer natureza pode ser PROGRESSIVA (campo `eh_progressiva = True`).
  Uma missão progressiva tem um ALVO DE DIAS CONSECUTIVOS. Falhar um único
  dia encerra a missão com status FRACASSADA_FATAL — sem reerguer, sem
  segunda chance.

  PASSIVA PROGRESSIVA: "Sem gastos banais por 30 dias". O hunter só age para
  CONFESSAR. Cada dia sem confissão = +1 dia progressivo. Confessar mata
  a missão.

  O que o `fechamento.py` precisa para decidir o fatal failure:
    - r.eh_progressiva == True
    - ed.status == "FRACASSADA"  (ou CONFESSADA na passiva)
    → marcar r.ativo = False, r.status = "FRACASSADA_FATAL"
"""
from auth.router import NIVEIS_ADMIN

# Naturezas conhecidas. "ATIVA" é o padrão de todo o app até aqui.
ATIVA      = "ATIVA"
PASSIVA    = "PASSIVA"
REPETICAO  = "REPETICAO"
CONDICIONAL = "CONDICIONAL"
# PUNICAO nao e criada pelo hunter: nasce do fechamento do dia. Por isso
# ela esta em NATUREZAS (o cartao precisa reconhece-la) e NAO no
# lancador — `pode_criar` a recusa de proposito, ver abaixo.
PUNICAO    = "PUNICAO"
NATUREZAS  = (ATIVA, PASSIVA, REPETICAO, CONDICIONAL, PUNICAO)

# Naturezas que exigem permissão para serem criadas. ATIVA e REPETICAO
# são de todos. CONDICIONAL é premium: a bifurcação precisa de payload
# validado, e liberar para usuários comuns antes de ter validação robusta
# é risco desnecessário.
PREMIUM = (PASSIVA, CONDICIONAL)

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


def eh_condicional(natureza) -> bool:
    return normalizar(natureza) == CONDICIONAL


def pode_criar(usuario, natureza) -> bool:
    """
    A pergunta que os routers fazem. Uma linha, um lugar.

    PUNICAO nao e forjavel por ninguem — nem pelo Arquiteto. Ela nasce
    do fechamento do dia, e so de la.

    Sem esta recusa, um `POST /tarefas/` com `natureza: PUNICAO` criaria
    uma penitencia a mao: um cartao que se anuncia como divida sem que
    divida nenhuma exista. Pior que o exploit e a mentira — o unico
    valor da penitencia e ela ser CONSEQUENCIA de algo.
    """
    if natureza == PUNICAO:
        return False
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
        "naturezas": list(NATUREZAS) if liberado else [ATIVA, REPETICAO],
        "motivo": None if liberado
                  else "Missões especiais são exclusivas da Staff por enquanto.",
    }


def aplicar_fatal_failure(db, rotina, agora) -> None:
    """
    Mata a missão progressiva de forma permanente.

    Chamado por `fechamento.py` quando uma missão com `eh_progressiva=True`
    falha em qualquer dia. Não há segunda chance — é exatamente o que torna
    o desafio progressivo difícil e valioso.

    O status FRACASSADA_FATAL não é um status de ExecucaoDia: ele vive na
    ROTINA, porque a missão inteira (não só o dia) terminou. Novas
    instâncias diárias não serão criadas pelo gerador.
    """
    try:
        rotina.ativo   = False
        rotina.status  = "FRACASSADA_FATAL"
        import motors.tempo as tempo
        rotina.cancelada_em = agora
    except Exception as exc:
        print(f"[ESPECIAIS] ⚠ fatal_failure({rotina.id}): {exc}")
