"""Maestria é uma sequência perfeita, independente do streak de gamificação.

Histórico legado usa a configuração atual da regra: não há snapshots antigos
de frequência/dificuldade no banco. Isso fica explícito na evidência gravada.
"""
from collections import defaultdict
from datetime import timedelta
from fastapi import HTTPException
from database import Habilidade, ExecucaoDia, Rotina
from motors import tempo, prazos
from motors.fechamento import rotina_devida_em

DIFICULDADES = {"LENDARIO": 0, "DIFICIL": 1, "NORMAL": 2, "FACIL": 3}
PRIORIDADES = {"CRITICA": 0, "ALTA": 1, "MEDIA": 2, "BAIXA": 3}


def meta(rotina):
    return 90 + 30 * (DIFICULDADES.get(rotina.dificuldade, 2)
                      + PRIORIDADES.get(rotina.prioridade, 2))


def perfeita(ed):
    return (ed.status == "CONCLUIDA" and not ed.reerguida
            and not ed.confessada_em and not ed.fracassada_em
            and not ed.cancelada_em and not ed.xp_perdido
            and ed.resposta_condicional != "B" and ed.condicional_vitoria is not False)


def progresso(rotina, execucoes, agora=None):
    agora = agora or tempo.agora()
    por_dia = defaultdict(list)
    for ed in execucoes:
        if ed.data <= agora.date():
            por_dia[ed.data].append(ed)
    sequencia = []
    dia = agora.date()
    nascimento = tempo.dia_de_utc(rotina.criado_em) or dia
    inicio = min([nascimento, *por_dia.keys()])
    while dia >= inicio:
        registros = por_dia.get(dia, [])
        # Registros existentes continuam sendo evidência mesmo depois de
        # editar a frequência. Ausências vencidas nunca viram sucesso tácito.
        if registros:
            if all(perfeita(ed) for ed in registros):
                sequencia.append(registros[0])  # no máximo uma execução por dia
            elif all(ed.status in ("PENDENTE", "ATIVA", "PAUSADA")
                     and not ed.reerguida and not ed.confessada_em
                     for ed in registros) and prazos.da_rotina(rotina, dia)["fim"] > agora:
                pass  # a janela atual ainda não terminou
            else:
                break
        elif rotina_devida_em(rotina, dia) and prazos.da_rotina(rotina, dia)["fim"] <= agora:
            break
        dia -= timedelta(days=1)
    alvo = meta(rotina)
    return {"rotina_id": rotina.id, "titulo": rotina.titulo,
            "categoria": rotina.categoria, "natureza": rotina.natureza,
            "dificuldade": rotina.dificuldade, "prioridade": rotina.prioridade,
            "meta": alvo, "sequencia": len(sequencia),
            "elegivel": bool(rotina.ativo and len(sequencia) >= alvo),
            "inicio": sequencia[-1].data.isoformat() if sequencia else None,
            "fim": sequencia[0].data.isoformat() if sequencia else None,
            "execucao_ids": [ed.id for ed in reversed(sequencia)]}


def proteger_origem(db, rotina_id):
    # Mesmo lock da conversão: uma ação em andamento termina antes de
    # fotografar a trajetória, ou encontra a origem já protegida.
    db.query(Rotina.id).filter(Rotina.id == rotina_id).with_for_update().first()
    if db.query(Habilidade.id).filter(Habilidade.rotina_id == rotina_id).first():
        raise HTTPException(409, "Esta rotina já virou habilidade. Sua origem e histórico estão preservados.")


def serializar(h):
    return {"id": h.id, "nome": h.nome, "rotina_id": h.rotina_id,
            "criado_em": h.criado_em.isoformat() + "Z", "evidencia": h.evidencia}


def historicos(db, usuario_id, ids):
    grupos = defaultdict(list)
    if ids:
        for ed in db.query(ExecucaoDia).filter(ExecucaoDia.usuario_id == usuario_id,
                                              ExecucaoDia.rotina_id.in_(ids)).all():
            grupos[ed.rotina_id].append(ed)
    return grupos
