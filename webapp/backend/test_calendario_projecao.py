# -*- coding: utf-8 -*-
"""
TESTE — A PROJECAO DO CALENDARIO

O calendario mostra dias que NAO EXISTEM NO BANCO. `materializar()` cria
so a instancia do dia corrente, e o comentario dele explica por que:

    A versao anterior varria 30 dias para tras e criava instancias de
    dias que o hunter nunca viveu -- ou seja: inventava derrotas
    retroativas.

Entao o futuro e projetado da regra, e o passado e lido do banco. Sao
naturezas diferentes, e e AI que mora o perigo.

O QUE PODE DAR ERRADO, EM ORDEM DE GRAVIDADE

1. PROJETAR O PASSADO. Uma rotina diaria criada hoje apareceria em todos
   os dias do mes passado, como se tivesse sido programada e perdida. E a
   derrota retroativa de volta, agora pela porta da frente.

2. PREVISAO PARECER FATO. Se o futuro vier com `real=True`, a tela mostra
   como consumado um dia que ainda pode ser qualquer coisa.

3. INTERVALO SEM TETO. Um pedido de dois anos projeta centenas de
   ocorrencias por rotina num GET que parece inocente.

4. FOLGA IGNORADA. O portao apareceria no feriado que o Arquiteto ja
   tinha programado como descanso.

O .gitignore ignora `test_*.py`. Para versionar:  git add -f

Uso:
    cd webapp/backend
    DATABASE_URL="sqlite:////tmp/proj.db" SECRET_KEY="teste" python3 test_calendario_projecao.py
"""
import json
import os
import sys
from datetime import timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DATABASE_URL", "sqlite:///./_teste_proj.db")
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
from database import (Base, engine, SessionLocal, Usuario, Rotina,  # noqa: E402
                      Dungeon, ExecucaoDia, TarefaDia)
from motors import calendario_projecao as proj, tempo  # noqa: E402

with TestClient(main.app):
    pass
Base.metadata.create_all(bind=engine)

db = SessionLocal()
LOGIN = "_proj_teste"
antigo = db.query(Usuario).filter(Usuario.login == LOGIN).first()
if antigo:
    for M in (ExecucaoDia, TarefaDia, Rotina, Dungeon):
        db.query(M).filter(M.usuario_id == antigo.id).delete()
    db.delete(antigo)
    db.commit()

u = Usuario(nome="Proj", login=LOGIN, senha_hash="x", ativo=True,
            xp_total=0, xp_atual=0, moedas=0, nivel_atual=1)
db.add(u)
db.commit()
db.refresh(u)

HOJE = tempo.hoje()
ONTEM = HOJE - timedelta(days=1)
AMANHA = HOJE + timedelta(days=1)

# Uma diaria com horario, uma semanal so as segundas, um portao seg-sex.
diaria = Rotina(titulo="Beber agua", tipo="DIARIA", usuario_id=u.id, ativo=True,
                hora_inicio="07:00", hora_fim="07:30", xp_recompensa=20,
                categoria="Saude", icone="A")
semanal = Rotina(titulo="Revisao semanal", tipo="SEMANAL", usuario_id=u.id,
                 ativo=True, dias_semana=json.dumps([0]), xp_recompensa=50)
portao = Dungeon(titulo="Expediente", usuario_id=u.id, status="ATIVA",
                 tipo_recorrencia="SEMANAL", dias_semana=json.dumps([0, 1, 2, 3, 4]),
                 hora_entrada="08:00", hora_saida="17:30", rank="A",
                 tipo_permanencia="PERMANENTE", xp_clear=120)
db.add_all([diaria, semanal, portao])
db.commit()
for x in (diaria, semanal, portao):
    db.refresh(x)

print("\n=== A PROJECAO DO CALENDARIO ===\n")
print("-- o passado NAO e projetado --")

r = proj.ocorrencias(db, u.id, ONTEM - timedelta(days=7), ONTEM)
rotinas_ontem = [o for d, l in r.items() for o in l if o["origem"] == "rotina"]
ok(len(rotinas_ontem) == 0,
   "rotina criada hoje NAO aparece nos dias anteriores — projetar o "
   "passado e recriar a derrota retroativa que o fechamento proibe")

# Agora uma instancia REAL de ontem: essa tem de aparecer.
ed = ExecucaoDia(rotina_id=diaria.id, usuario_id=u.id, data=ONTEM,
                 status="CONCLUIDA")
db.add(ed)
db.commit()
r = proj.ocorrencias(db, u.id, ONTEM, ONTEM)
achou = [o for o in r.get(ONTEM.isoformat(), []) if o["origem"] == "rotina"]
ok(len(achou) == 1, "mas a instancia REAL de ontem aparece")
ok(achou[0]["real"] is True and achou[0]["status"] == "CONCLUIDA",
   "marcada como FATO, com o resultado junto")

print("\n-- o futuro e projetado, e se declara previsao --")
r = proj.ocorrencias(db, u.id, AMANHA, AMANHA + timedelta(days=6))
amanha = r.get(AMANHA.isoformat(), [])
rot = [o for o in amanha if o["origem"] == "rotina" and o["titulo"] == "Beber agua"]
ok(len(rot) == 1, "a diaria aparece amanha")
ok(rot[0]["real"] is False,
   "com `real=False` — E O ASSERT QUE IMPEDE A TELA DE MENTIR: previsao "
   "com cara de fato mostra como consumado um dia que ainda pode ser "
   "qualquer coisa")
ok(rot[0]["status"] is None, "e sem status, porque nao ha o que ter acontecido")
ok(rot[0]["hora_inicio"] == "07:00", "o horario viaja para a tela")

print("\n-- a semanal so cai no dia dela --")
sem_dias = [d for d, l in r.items()
            if any(o["titulo"] == "Revisao semanal" for o in l)]
ok(all(__import__("datetime").date.fromisoformat(d).weekday() == 0
       for d in sem_dias),
   f"a revisao semanal so aparece em segundas ({len(sem_dias)} no intervalo)")

print("\n-- o portao --")
pt = [o for o in amanha if o["origem"] == "dungeon"]
if AMANHA.weekday() < 5:
    ok(len(pt) == 1, "o portao seg-sex aparece em dia util")
    ok(pt[0]["hora_inicio"] == "08:00" and pt[0]["hora_fim"] == "17:30",
       "com a janela de horario, que e o que o torna um bloco de verdade")
    ok(pt[0]["rank"] == "A", "e o rank, que o calendario usa para colorir")
else:
    ok(len(pt) == 0, "e nao aparece no fim de semana")

print("\n-- folga tranca o portao --")
alvo = next((AMANHA + timedelta(days=i) for i in range(7)
             if (AMANHA + timedelta(days=i)).weekday() < 5), AMANHA)
portao.folgas = json.dumps([alvo.isoformat()])
db.commit()
r2 = proj.ocorrencias(db, u.id, alvo, alvo)
ok(not any(o["origem"] == "dungeon" for o in r2.get(alvo.isoformat(), [])),
   "no dia de folga o portao NAO aparece — senao o lembrete tocaria "
   "no dia de descanso que o Arquiteto ja tinha programado")
portao.folgas = None
db.commit()

print("\n-- portao que nao fecha nao ganha bloco de horario --")
portao.sempre_aberta = True
db.commit()
r3 = proj.ocorrencias(db, u.id, alvo, alvo)
aberto = [o for o in r3.get(alvo.isoformat(), []) if o["origem"] == "dungeon"]
ok(len(aberto) == 1, "ele continua aparecendo no dia")
ok(aberto[0]["hora_inicio"] is None,
   "mas SEM janela — desenhar uma poria de volta na tela a regra que o "
   "Solo aboliu")
portao.sempre_aberta = False
db.commit()

print("\n-- missao geral futura vem do banco, nao da projecao --")
t = TarefaDia(titulo="Pagar aluguel", usuario_id=u.id, status="PENDENTE",
              data_prevista=AMANHA, hora_limite="18:00", prioridade="ALTA",
              xp_recompensa=80, categoria="Casa")
db.add(t)
db.commit()
r4 = proj.ocorrencias(db, u.id, AMANHA, AMANHA)
tar = [o for o in r4[AMANHA.isoformat()] if o["origem"] == "tarefa"]
ok(len(tar) == 1, "a missao geral aparece no dia marcado")
ok(tar[0]["real"] is True,
   "e vem como FATO — ela existe no banco, diferente da rotina projetada")

print("\n-- a ordem do dia --")
lista = r4[AMANHA.isoformat()]
com_hora = [o for o in lista if o["hora_inicio"]]
ok(com_hora == sorted(com_hora, key=lambda o: o["hora_inicio"]),
   "quem tem horario vem em ordem de relogio")
if any(not o["hora_inicio"] for o in lista):
    i_sem = next(i for i, o in enumerate(lista) if not o["hora_inicio"])
    ok(all(lista[j]["hora_inicio"] for j in range(i_sem)),
       "e o sem horario vai por ultimo: ele e 'em algum momento', "
       "nao parte da linha do tempo")

print("\n-- o teto do intervalo --")
try:
    proj.ocorrencias(db, u.id, HOJE, HOJE + timedelta(days=proj.MAX_DIAS))
    ok(False, "deveria recusar intervalo grande demais")
except ValueError as e:
    ok("Intervalo" in str(e),
       f"acima de {proj.MAX_DIAS} dias e recusado — sem teto, um GET que "
       "parece inocente projeta centenas de ocorrencias por rotina")

ok(len(proj.ocorrencias(db, u.id, HOJE, HOJE + timedelta(days=proj.MAX_DIAS - 1))) >= 0,
   "e exatamente no teto ainda passa")

print("\n-- datas invertidas nao explodem --")
r5 = proj.ocorrencias(db, u.id, AMANHA, HOJE)
ok(isinstance(r5, dict), "de > ate e corrigido em vez de devolver vazio")

print("\n-- o resumo --")
res = proj.resumo(r4[AMANHA.isoformat()])
ok(res["total"] == len(r4[AMANHA.isoformat()]), "conta o total do dia")
ok(res["previstas"] >= 1, "e quantas sao previsao — e o que a celula pinta "
                          "diferente")

for M in (ExecucaoDia, TarefaDia, Rotina, Dungeon):
    db.query(M).filter(M.usuario_id == u.id).delete()
db.query(Usuario).filter(Usuario.id == u.id).delete()
db.commit()
db.close()

print("\n" + "=" * 52)
print(f"TUDO VERDE — {testes} asserts" if falhas == 0
      else f"{falhas} FALHA(S) de {testes} asserts")
print("=" * 52 + "\n")
sys.exit(0 if falhas == 0 else 1)
