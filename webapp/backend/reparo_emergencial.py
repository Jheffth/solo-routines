#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys, os
# Fix encoding para Windows
sys.stdout.reconfigure(encoding='utf-8') if hasattr(sys.stdout, 'reconfigure') else None
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal, Usuario, TarefaDia, ExecucaoDia, Rotina
from motors import fechamento, tempo

db = SessionLocal()

try:
    hoje = tempo.hoje()
    print(f"\n{'='*60}")
    print(f"  REPARO EMERGENCIAL — {hoje}")
    print(f"{'='*60}\n")

    usuarios = db.query(Usuario).filter(Usuario.ativo == True).all()
    print(f"Usuários ativos: {len(usuarios)}\n")

    for u in usuarios:
        print(f"─── {u.nome} ({u.login}) ───")

        # Estado das penitências ANTES
        pens = db.query(TarefaDia).filter(
            TarefaDia.usuario_id == u.id,
            TarefaDia.natureza == "PUNICAO",
            TarefaDia.status.notin_(("CONCLUIDA", "CANCELADA")),
        ).all()
        print(f"  Penitências pendentes: {len(pens)}")
        for p in pens:
            print(f"    • [{p.status}] {p.titulo} — data_prevista={p.data_prevista}")

        # ExecucaoDia de hoje ANTES
        eds_hoje = db.query(ExecucaoDia).filter(
            ExecucaoDia.usuario_id == u.id,
            ExecucaoDia.data == hoje,
        ).all()
        print(f"  ExecucaoDia de hoje ({hoje}) ANTES: {len(eds_hoje)}")

        # Roda o processamento completo (com o fix já aplicado)
        try:
            r = fechamento.processar_usuario(db, u)
            db.commit()
            print(f"  ✅ Fechamento OK: materializadas={r['materializadas']}, "
                  f"rotinas={r['rotinas']}, gerais={r['gerais']}, "
                  f"acesas={r['acesas']}, reabertas={r['reabertas']}")
        except Exception as e:
            db.rollback()
            print(f"  ❌ Erro no fechamento: {e}")
            import traceback
            traceback.print_exc()

        # ExecucaoDia de hoje APÓS reparo
        eds_hoje_pos = db.query(ExecucaoDia).filter(
            ExecucaoDia.usuario_id == u.id,
            ExecucaoDia.data == hoje,
        ).all()
        print(f"  ExecucaoDia de hoje APÓS: {len(eds_hoje_pos)}")
        for ed in eds_hoje_pos:
            r_nome = db.query(Rotina.titulo).filter(Rotina.id == ed.rotina_id).scalar()
            print(f"    • [{ed.status}] {r_nome}")
        print()

    print(f"{'='*60}")
    print("  Reparo concluído. Recarregue o app.")
    print(f"{'='*60}\n")

finally:
    db.close()
