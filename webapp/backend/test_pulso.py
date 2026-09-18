# -*- coding: utf-8 -*-
"""
TESTE — O PULSO

O incomodo do Arquiteto: "cumpro missoes no celular, chego em casa e o
computador nao mudou; e preciso atualizar a pagina."

O pulso e a metade barata da solucao: um numero que muda quando algo
muda, para o front poder PERGUNTAR de 15 em 15 segundos sem pagar o
preco de RECARREGAR.

DUAS MANEIRAS DE ESTRAGAR ISSO, E SAO OPOSTAS

1. O PULSO QUE NAO MUDA quando devia. A tela fica velha e o hunter
   continua sem saber — exatamente o defeito que estamos consertando,
   so que agora com codigo novo por cima.

2. O PULSO QUE MUDA SOZINHO. Um `datetime.now()` esquecido na conta faz
   a revisao mudar a cada chamada, a tela recarrega a cada 15 segundos
   para sempre, e o "conserto" vira um moto-continuo que castiga o
   servidor. Este e o pior dos dois, porque parece funcionar: a tela
   fica MUITO atualizada.

O assert da ESTABILIDADE (duas chamadas seguidas devolvem o mesmo
numero) e o que separa um do outro, e e o mais importante do arquivo.

O .gitignore ignora `test_*.py`. Para versionar:  git add -f

Uso:
    cd webapp/backend
    DATABASE_URL="sqlite:////tmp/pulso.db" SECRET_KEY="teste" python3 test_pulso.py
"""
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DATABASE_URL", "sqlite:///./_teste_pulso.db")
os.environ.setdefault("SECRET_KEY", "teste")

falhas = 0
testes = 0


def ok(cond, msg):
    global falhas, testes
    testes += 1
    if not cond:
        falhas += 1
    print(("  [ok]  " if cond else "  [XX]  ") + msg)


from fastapi.testclient import TestClient  # noqa: E402
import main  # noqa: E402
from database import Base, engine, SessionLocal, Usuario, ExecucaoDia, Rotina  # noqa: E402
from motors import tempo  # noqa: E402
from routers.dashboard import pulso  # noqa: E402

with TestClient(main.app):
    pass

Base.metadata.create_all(bind=engine)
db = SessionLocal()

LOGIN = "_pulso_teste"
db.query(ExecucaoDia).filter(ExecucaoDia.usuario_id.in_(
    db.query(Usuario.id).filter(Usuario.login == LOGIN))).delete(synchronize_session=False)
db.query(Rotina).filter(Rotina.usuario_id.in_(
    db.query(Usuario.id).filter(Usuario.login == LOGIN))).delete(synchronize_session=False)
db.query(Usuario).filter(Usuario.login == LOGIN).delete()
db.commit()

u = Usuario(nome="Pulso", login=LOGIN, senha_hash="x", xp_total=100, xp_atual=100,
            moedas=10, nivel_atual=3, streak_atual=2, ativo=True)
db.add(u)
db.commit()
db.refresh(u)

hoje = tempo.hoje()


def rev():
    db.refresh(u)
    return pulso(db=db, usuario=u)["rev"]


print("\n=== O PULSO ===\n")
print("-- estabilidade: o assert que impede o moto-continuo --")

a, b = rev(), rev()
ok(a == b,
   "duas chamadas seguidas devolvem o MESMO numero — um `now()` na "
   "conta faria a tela recarregar a cada 15s para sempre")
ok(isinstance(a, str) and 8 <= len(a) <= 16,
   f"e ele e curto ({len(a)} chars): a resposta inteira tem de caber "
   "em poucas dezenas de bytes")

print("\n-- muda quando o hunter ganha XP --")
antes = rev()
u.xp_total += 50
db.commit()
ok(rev() != antes, "XP mudou -> pulso mudou")

print("\n-- muda quando ganha moedas --")
antes = rev()
u.moedas += 5
db.commit()
ok(rev() != antes, "moedas mudaram -> pulso mudou")

print("\n-- muda quando sobe de nivel --")
antes = rev()
u.nivel_atual += 1
db.commit()
ok(rev() != antes, "nivel mudou -> pulso mudou")

print("\n-- muda quando a corrente anda --")
antes = rev()
u.streak_atual += 1
db.commit()
ok(rev() != antes, "streak mudou -> pulso mudou")

print("\n-- muda quando nasce uma missao do dia --")
r = Rotina(titulo="Pulso", tipo="DIARIA", usuario_id=u.id, ativo=True)
db.add(r)
db.commit()
db.refresh(r)

antes = rev()
ed = ExecucaoDia(rotina_id=r.id, usuario_id=u.id, data=hoje, status="PENDENTE")
db.add(ed)
db.commit()
ok(rev() != antes, "instancia criada -> pulso mudou")

print("\n-- E MUDA QUANDO ELA E CONCLUIDA, mesmo sem XP --")
# O CASO QUE O XP SOZINHO NAO PEGARIA. Uma missao de 0 XP concluida no
# celular nao mexe em `xp_total` — se o pulso olhasse so para o XP, a
# tela do computador continuaria mostrando a missao em aberto.
antes = rev()
ed.status = "CONCLUIDA"
ed.concluida_em = datetime.utcnow()
ed.xp_ganho = 0
db.commit()
ok(rev() != antes,
   "concluir sem XP nenhum ainda move o pulso — e por isso a contagem "
   "de concluidas entra na conta, e nao so o XP")

print("\n-- nao muda a toa --")
antes = rev()
import time  # noqa: E402
time.sleep(1.1)
ok(rev() == antes, "um segundo depois, sem escrita nenhuma, o pulso e o mesmo")

print("\n-- cada hunter tem o seu --")
outro = Usuario(nome="Outro", login=LOGIN + "_2", senha_hash="x",
                xp_total=100, xp_atual=100, moedas=10, nivel_atual=3,
                streak_atual=2, ativo=True)
db.add(outro)
db.commit()
db.refresh(outro)
ok(pulso(db=db, usuario=outro)["rev"] != rev(),
   "hunters diferentes, pulsos diferentes — senao a atividade de um "
   "faria a tela do outro recarregar")

antes_outro = pulso(db=db, usuario=outro)["rev"]
u.xp_total += 999
db.commit()
ok(pulso(db=db, usuario=outro)["rev"] == antes_outro,
   "e mexer num nao move o pulso do outro")

# limpeza
db.query(ExecucaoDia).filter(ExecucaoDia.usuario_id == u.id).delete()
db.query(Rotina).filter(Rotina.usuario_id == u.id).delete()
db.query(Usuario).filter(Usuario.id.in_([u.id, outro.id])).delete()
db.commit()
db.close()

print("\n" + "=" * 50)
print(f"TUDO VERDE — {testes} asserts" if falhas == 0
      else f"{falhas} FALHA(S) de {testes} asserts")
print("=" * 50 + "\n")
sys.exit(0 if falhas == 0 else 1)
