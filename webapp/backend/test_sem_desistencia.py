# -*- coding: utf-8 -*-
"""
NÃO HÁ COMO DESISTIR — a regra que o Arquiteto declarou.

    "cancelar hoje é desistir e o sistema não foi feito para deixar
     desistir"

Uma missão termina de TRÊS jeitos, e não há um quarto:

    · CUMPRIDA          — o hunter fez
    · VENCIDA           — o tempo acabou
    · EXTINTA           — o Arquiteto tirou da existência

O que sumiu foi a saída GRÁTIS. As outras continuam de pé e cada uma
cobra alguma coisa: PAUSAR (o dia segue correndo), CONFESSAR (a passiva,
com preço), REERGUER (paga Mana) e EXTINGUIR (irreversível).

POR QUE O ENDPOINT CONTINUA EXISTINDO, recusando em vez de sumir

Tirar a rota daria 404 — "não existe" —, e existe: é proibido, o que é
outra coisa. E `retomar` ainda precisa trazer de volta o que foi
cancelado ANTES desta regra: apagar o caminho deixaria esses registros
presos para sempre num estado sem saída.

POR QUE A TRAVA NÃO PODE SER SÓ O BOTÃO

Esconder resolve a tentação, não a porta. Qualquer chamada direta
continuaria desistindo — e o teste bate no ENDPOINT justamente por isso.

Uso: DATABASE_URL=sqlite:///./x.db SECRET_KEY=... python test_sem_desistencia.py
"""
from datetime import datetime, timedelta

import main                                     # noqa: F401
from fastapi.testclient import TestClient
from database import SessionLocal, Usuario, Rotina, ExecucaoDia, TarefaDia
from motors import tempo

falhas = testes = 0


def ok(cond, msg):
    global falhas, testes
    testes += 1
    if not cond:
        falhas += 1
    print(("  [ok]  " if cond else "  [XX]  ") + msg)


def rodar():
    print("\n=== NÃO HÁ COMO DESISTIR ===\n")
    cli = TestClient(main.app)
    with cli:
        pass
    db = SessionLocal()
    u = db.query(Usuario).filter_by(nivel_acesso="Arquiteto").first()
    hoje = tempo.hoje()

    for r in db.query(Rotina).filter_by(usuario_id=u.id).all():
        db.query(ExecucaoDia).filter_by(rotina_id=r.id).delete()
        db.delete(r)
    db.query(TarefaDia).filter_by(usuario_id=u.id).delete()
    db.commit()

    from routers import rotinas as rr, tarefas as rt

    print("-- o endpoint recusa, e explica --")
    r = Rotina(usuario_id=u.id, titulo="Rotina qualquer", tipo="DIARIA", ativo=True,
               prioridade="ALTA", dificuldade="NORMAL", status="ATIVA",
               criado_em=datetime.utcnow() - timedelta(days=2))
    db.add(r); db.commit(); db.refresh(r)
    db.add(ExecucaoDia(rotina_id=r.id, usuario_id=u.id, data=hoje, status="ATIVA"))
    db.commit()

    try:
        rr.cancelar_rotina(r.id, db=db, usuario=u)
        ok(False, "cancelar a rotina deveria ser RECUSADO")
    except Exception as e:
        ok("desistência" in str(e).lower() or "desistencia" in str(e).lower(),
           f"rotina: …{str(e)[-62:]}")

    ed = db.query(ExecucaoDia).filter_by(rotina_id=r.id, data=hoje).first()
    ok(ed.status == "ATIVA",
       "e a missão segue ATIVA — a recusa não deixa estado pela metade")

    t = TarefaDia(titulo="Missão geral", data_prevista=hoje, prioridade="ALTA",
                  categoria="Pessoal", status="PENDENTE", usuario_id=u.id)
    db.add(t); db.commit(); db.refresh(t)
    try:
        rt.cancelar_tarefa(t.id, db=db, usuario=u)
        ok(False, "cancelar a missão geral deveria ser RECUSADO")
    except Exception as e:
        ok("desist" in str(e).lower(), f"missão geral: …{str(e)[-62:]}")
    db.refresh(t)
    ok(t.status == "PENDENTE", "e ela também fica como estava")

    print("\n-- as saídas que CUSTAM continuam abertas --")
    # PAUSAR não é desistir: o dia continua correndo contra o hunter.
    rr.pausar_rotina(r.id, db=db, usuario=u)
    db.refresh(ed)
    ok(ed.status == "PAUSADA", "PAUSAR continua permitido — o prazo não para")
    rr.retomar_rotina(r.id, db=db, usuario=u)
    db.refresh(ed)
    ok(ed.status in ("ATIVA", "PENDENTE"), "e RETOMAR traz de volta")

    print("\n-- retomar ainda resgata o que foi cancelado ANTES da regra --")
    # É por isso que a rota não foi apagada: sem ela, os registros
    # cancelados no passado ficariam presos num estado sem saída.
    ed.status = "CANCELADA"
    ed.cancelada_em = tempo.agora()
    db.commit()
    rr.retomar_rotina(r.id, db=db, usuario=u)
    db.refresh(ed)
    ok(ed.status != "CANCELADA",
       f"um CANCELADA antigo volta a ser jogável ({ed.status})")

    print("\n-- e o Arquiteto ainda pode EXTINGUIR --")
    # A saída do Arquiteto não é desistência: é poder, e é irreversível.
    t2 = TarefaDia(titulo="Para extinguir", data_prevista=hoje, prioridade="ALTA",
                   categoria="Pessoal", status="PENDENTE", usuario_id=u.id)
    db.add(t2); db.commit(); db.refresh(t2)
    tid = t2.id
    rt.deletar_tarefa(tid, extinguir=True, db=db, usuario=u)
    ok(db.query(TarefaDia).filter_by(id=tid).first() is None,
       "extinguir segue funcionando — é a saída que tem dono e preço")

    db.close()
    print(f"\n=== {testes - falhas}/{testes} ===")
    return falhas


if __name__ == "__main__":
    import sys
    sys.exit(1 if rodar() else 0)
