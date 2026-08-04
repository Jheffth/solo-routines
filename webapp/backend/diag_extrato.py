#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys, os
sys.stdout.reconfigure(encoding='utf-8') if hasattr(sys.stdout, 'reconfigure') else None
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal, Usuario, ExecucaoDia, Rotina, TarefaDia
from motors import tempo, fechamento, prazos
from datetime import timedelta

db = SessionLocal()
try:
    hoje = tempo.hoje()
    agora = tempo.agora()
    u = db.query(Usuario).filter(Usuario.login == "Jh3ffth").first()
    if not u:
        print("Usuario Jh3ffth nao encontrado")
        sys.exit(1)

    print(f"\n=== DIAGNOSTICO EXTRATO — {hoje} {agora.strftime('%H:%M:%S')} ===\n")

    # 1. ExecucaoDia de hoje
    eds = db.query(ExecucaoDia).filter(
        ExecucaoDia.usuario_id == u.id,
        ExecucaoDia.data == hoje,
    ).all()
    print(f"ExecucaoDia de hoje: {len(eds)}")
    for ed in eds:
        r = db.query(Rotina).filter(Rotina.id == ed.rotina_id).first()
        p = prazos.da_execucao(ed, r) if r else None
        venceu = prazos.venceu(p, agora) if p else "N/A"
        restante = prazos.restante(p, agora) if p else "N/A"
        print(f"  [{ed.status}] {r.titulo if r else '?'}")
        print(f"    inicio={p['inicio'] if p else '?'} fim={p['fim'] if p else '?'}")
        print(f"    venceu={venceu} restante_seg={restante}")

    print()

    # 2. Simular o extrato — query de rotinas no intervalo 30 dias atras até hoje
    inicio = hoje - timedelta(days=30)
    fim = hoje + timedelta(days=30)
    print(f"Consulta extrato: inicio={inicio} fim={fim}")

    q = (db.query(ExecucaoDia, Rotina)
           .join(Rotina, Rotina.id == ExecucaoDia.rotina_id)
           .filter(ExecucaoDia.usuario_id == u.id,
                   ExecucaoDia.data >= inicio,
                   ExecucaoDia.data <= fim))
    resultados = q.all()
    print(f"Total ExecucaoDia no intervalo: {len(resultados)}")

    hoje_eds = [(ed, r) for ed, r in resultados if ed.data == hoje]
    print(f"De hoje: {len(hoje_eds)}")
    for ed, r in hoje_eds:
        print(f"  [{ed.status}] {r.titulo} (data={ed.data})")

    print()

    # 3. Verificar se processar_usuario vai bem
    print("Rodando processar_usuario...")
    try:
        res = fechamento.processar_usuario(db, u)
        db.commit()
        print(f"  OK: {res}")
    except Exception as e:
        db.rollback()
        print(f"  ERRO: {e}")
        import traceback; traceback.print_exc()

    # 4. Penitencias
    pens = db.query(TarefaDia).filter(
        TarefaDia.usuario_id == u.id,
        TarefaDia.natureza == "PUNICAO",
        TarefaDia.status.notin_(("CONCLUIDA", "CANCELADA")),
    ).all()
    print(f"\nPenitencias pendentes: {len(pens)}")
    for p in pens:
        prazo_p = prazos.da_tarefa(p)
        print(f"  [{p.status}] {p.titulo} data_prevista={p.data_prevista}")
        print(f"    editavel calculado: {(p.natureza or '').upper() == 'PUNICAO'}")
        print(f"    prazo.fim={prazo_p['fim']} venceu={prazos.venceu(prazo_p, agora)}")

    print("\n=== FIM ===")
finally:
    db.close()
