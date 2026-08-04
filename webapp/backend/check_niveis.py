from database import SessionLocal, Nivel, Usuario

db = SessionLocal()

print("=== NIVEIS (primeiros 10) ===")
for n in db.query(Nivel).order_by(Nivel.nivel).all()[:10]:
    print(f"Nivel {n.nivel}: xp_necessario={n.xp_necessario}, xp_para_proximo={n.xp_para_proximo}, rank={n.rank}")

print()
print("=== USUARIOS ATIVOS ===")
for u in db.query(Usuario).filter(Usuario.ativo == True).all():
    print(f"User '{u.nome}': nivel={u.nivel_atual}, xp_total={u.xp_total}, xp_atual={u.xp_atual}, xp_proximo={u.xp_proximo_nivel}")

db.close()
