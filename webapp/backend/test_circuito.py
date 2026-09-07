# -*- coding: utf-8 -*-
"""
O CIRCUITO — a sessão com blocos.

Nasceu do treino real do Arquiteto:

    06:00–06:45 · Mobilidade 5min · Cardio 25–30min ·
    Prancha 3×20–30s · Agachamento 3×10–12

O QUE ESTE TESTE PROTEGE, EM ORDEM DE GRAVIDADE

1. UMA SESSÃO PERDIDA ENCHE UMA BARRA, NÃO QUATRO.
   É a razão de o circuito existir em vez de quatro rotinas. Com o
   medidor de punição no ar, fragmentar o treino puniria em quádruplo
   uma única manhã perdida. Se alguém um dia "simplificar" isto em
   quatro missões, é este assert que grita.

2. O PISO NÃO REPROVA, MARCA.
   Decisão do Arquiteto: 22 min numa faixa de 25–30 FECHA o bloco e
   deixa a sessão parcial. Recusar ensinaria a arredondar para cima na
   hora de lançar — e um sistema que premia a mentira perde o único
   dado que tinha.

3. O BOTÃO NÃO FECHA O QUE OS BLOCOS NÃO FECHARAM.
   Mesma trava da META, e aqui o motivo é ainda mais direto: o card
   existe para saber QUAIS partes foram feitas.

4. O ESTADO PARCIAL SOBREVIVE.
   O hunter fecha um bloco às 06:02 e volta às 06:40. Se o registro se
   perder no caminho, a natureza inteira não serve para nada.

Uso: DATABASE_URL=sqlite:///./x.db SECRET_KEY=... python test_circuito.py
"""
import json

import main                                     # noqa: F401
from fastapi import HTTPException
from fastapi.testclient import TestClient
from database import (SessionLocal, Usuario, Rotina, ExecucaoDia, TarefaDia,
                      Execucao, Pacto)
from motors import tempo, circuito as C, economia, medidor
from routers import execucoes as rex, tarefas as rt

falhas = testes = 0


def ok(cond, msg):
    global falhas, testes
    testes += 1
    if not cond:
        falhas += 1
    print(("  [ok]  " if cond else "  [XX]  ") + msg)


# O treino do Arquiteto, tal como a IA o descreveu.
TREINO = json.dumps({"etapas": [
    {"id": "mob", "titulo": "Mobilidade e destravamento", "modo": "TEMPO",
     "min": 5, "max": 5, "unidade": "min",
     "nota": "Giro de braços, rotações de tronco, agachamentos lentos"},
    {"id": "car", "titulo": "Cardio base", "modo": "TEMPO",
     "min": 25, "max": 30, "unidade": "min",
     "nota": "Caminhada acelerada — dá pra conversar, não pra cantar"},
    {"id": "pra", "titulo": "Prancha isométrica", "modo": "SERIE_TEMPO",
     "series": 3, "min": 20, "max": 30, "unidade": "s"},
    {"id": "agc", "titulo": "Agachamento livre", "modo": "SERIE_REP",
     "series": 3, "min": 10, "max": 12},
]}, ensure_ascii=False)


def limpar(db, u):
    for r in db.query(Rotina).filter_by(usuario_id=u.id).all():
        db.query(ExecucaoDia).filter_by(rotina_id=r.id).delete()
        db.delete(r)
    db.query(TarefaDia).filter_by(usuario_id=u.id).delete()
    db.query(Execucao).filter_by(usuario_id=u.id).delete()
    db.query(Pacto).filter_by(usuario_id=u.id).delete()
    db.commit()


def nova(db, u, **kw):
    r = Rotina(usuario_id=u.id, titulo="Treino de adaptação — fase 1",
               tipo="DIARIA", ativo=True, prioridade="ALTA",
               dificuldade="NORMAL", status="ATIVA", xp_recompensa=100,
               moedas_recompensa=10, circuito_payload=TREINO, **kw)
    db.add(r); db.commit(); db.refresh(r)
    return r


def rodar():
    print("\n=== O CIRCUITO ===\n")
    cli = TestClient(main.app)
    with cli:
        pass
    db = SessionLocal()
    u = db.query(Usuario).filter_by(nivel_acesso="Arquiteto").first() or db.query(Usuario).first()
    limpar(db, u)

    # ── O desenho ───────────────────────────────────────────────────
    print("-- o desenho do treino --")
    d = C.normalizar(TREINO)
    ok(len(d["etapas"]) == 4, "quatro blocos lidos")
    rot = {e["id"]: C.rotulo_faixa(e) for e in d["etapas"]}
    ok(rot["car"] == "25–30 min", f"a faixa vira texto: '{rot['car']}'")
    ok(rot["pra"] == "3 × 20–30 s", f"com séries: '{rot['pra']}'")
    ok(rot["agc"] == "3 × 10–12", f"e sem unidade quando não há: '{rot['agc']}'")
    ok(rot["mob"] == "5 min", "faixa de valor único não vira '5–5'")

    # Payload torto vira missão comum, não tela de erro.
    ok(C.normalizar("{lixo") is None, "JSON quebrado: vira missão comum, não explode")
    ok(C.normalizar('{"etapas":[]}') is None, "circuito sem blocos não é circuito")
    ok(C.normalizar('{"etapas":[{"titulo":""}]}') is None, "bloco sem título é descartado")
    invertido = C.normalizar('{"etapas":[{"titulo":"X","modo":"TEMPO","min":30,"max":25}]}')
    ok(invertido["etapas"][0]["min"] == 25,
       "faixa invertida (30–25) é lida como 25–30 — é digitação, não intenção")

    # ── O registro, bloco a bloco ───────────────────────────────────
    print("\n-- a sessão, das 06:02 às 06:40 --")
    r = nova(db, u)
    ed = ExecucaoDia(rotina_id=r.id, usuario_id=u.id, data=tempo.hoje(), status="ATIVA")
    db.add(ed); db.commit()

    def reg(etapa, valor=None):
        return rex.circuito_registrar(
            rex.CircuitoRegistrarRequest(rotina_id=r.id, etapa_id=etapa, valor=valor),
            db=db, usuario=u)

    resp = reg("mob", 5)
    ok(resp["circuito"]["fechados"] == 1, "bloco 1 fechado")
    ok(resp["circuito_cumprido"] is False, "e a sessão continua aberta")

    # O estado parcial sobrevive: releitura do banco, não da memória.
    db.expire_all()
    ed2 = db.query(ExecucaoDia).filter_by(rotina_id=r.id, data=tempo.hoje()).first()
    ok(C.progresso(d, C.ler_feito(ed2.circuito_feito))["fechados"] == 1,
       "o registro SOBREVIVE — o hunter pode largar o celular e voltar")

    resp = reg("car", 28)
    ok(resp["circuito"]["fechados"] == 2, "cardio de 28 min fecha o bloco 2")
    ok(resp["circuito"]["parcial"] is False, "28 está dentro de 25–30: nada de parcial")

    # Séries, uma a uma.
    print("\n-- as séries entram uma a uma --")
    reg("pra", 25)
    resp = reg("pra", 22)
    bloco = next(b for b in resp["circuito"]["blocos"] if b["id"] == "pra")
    ok(bloco["feito"] is False, "duas de três séries: o bloco ainda não fechou")
    ok(bloco["restam_series"] == 1, "e o card sabe que falta uma")
    resp = reg("pra", 20)
    bloco = next(b for b in resp["circuito"]["blocos"] if b["id"] == "pra")
    ok(bloco["feito"] is True, "a terceira fecha o bloco")
    ok(bloco["valores"] == [25, 22, 20], f"guardando cada série ({bloco['valores']})")

    try:
        reg("pra", 30)
        ok(False, "a quarta série deveria ser RECUSADA")
    except HTTPException as e:
        ok(e.status_code == 400, "e a quarta é recusada — 3 séries são 3")

    # ── A trava do botão ────────────────────────────────────────────
    print("\n-- o botão não fecha o que os blocos não fecharam --")
    try:
        rex.concluir_rotina(rex.ConcluirRotinaRequest(rotina_id=r.id),
                            db=db, usuario=u)
        ok(False, "concluir deveria ser RECUSADO com bloco em aberto")
    except HTTPException as e:
        ok(e.status_code == 400 and "circuito" in str(e.detail).lower(),
           f"recusado, e explica: …{str(e.detail)[-58:]}")

    # ── O último bloco conclui a sessão ─────────────────────────────
    print("\n-- o último bloco conclui sozinho --")
    reg("agc", 12); reg("agc", 11)
    resp = reg("agc", 10)
    ok(resp["circuito_cumprido"] is True, "a sessão se concluiu ao entregar o último bloco")
    ok(resp["parcial"] is False, "tudo dentro das faixas: sessão completa")
    db.expire_all()
    ed2 = db.query(ExecucaoDia).filter_by(rotina_id=r.id, data=tempo.hoje()).first()
    ok(ed2.status == "CONCLUIDA", "e a instância do dia está CONCLUIDA")
    xp_cheio = ed2.xp_ganho
    ok(xp_cheio > 0, f"com XP creditado ({xp_cheio})")

    # ── O PISO NÃO REPROVA, MARCA ───────────────────────────────────
    print("\n-- 22 min numa faixa de 25–30 --")
    limpar(db, u)
    r2 = nova(db, u)
    ed = ExecucaoDia(rotina_id=r2.id, usuario_id=u.id, data=tempo.hoje(), status="ATIVA")
    db.add(ed); db.commit()

    def reg2(etapa, valor=None):
        return rex.circuito_registrar(
            rex.CircuitoRegistrarRequest(rotina_id=r2.id, etapa_id=etapa, valor=valor),
            db=db, usuario=u)

    reg2("mob", 5)
    resp = reg2("car", 22)                      # abaixo do piso
    bloco = next(b for b in resp["circuito"]["blocos"] if b["id"] == "car")
    ok(bloco["feito"] is True, "o bloco FECHA — o piso não reprova")
    ok(bloco["abaixo"] is True, "mas fica marcado como abaixo do combinado")
    ok(resp["circuito"]["parcial"] is True, "e a sessão inteira vira PARCIAL")

    reg2("pra", 25); reg2("pra", 25); reg2("pra", 25)
    reg2("agc", 12); reg2("agc", 12)
    resp = reg2("agc", 12)
    ok(resp["circuito_cumprido"] is True, "a sessão fecha assim mesmo — não é fracasso")
    ok(resp["parcial"] is True, "declarada parcial")

    db.expire_all()
    ed2 = db.query(ExecucaoDia).filter_by(rotina_id=r2.id, data=tempo.hoje()).first()
    pct = economia.circuito_regras(db)["xp_parcial_pct"]
    ok(ed2.status == "CONCLUIDA", "concluída, não fracassada")
    ok(0 < ed2.xp_ganho < xp_cheio,
       f"e paga menos: {ed2.xp_ganho} contra {xp_cheio} ({pct}% na Balança)")

    # Uma série curta basta para marcar a sessão.
    print("\n-- uma série curta já marca --")
    e_pra = next(e for e in d["etapas"] if e["id"] == "pra")
    ok(C.bloco_abaixo_do_piso(e_pra, {"valores": [25, 18, 25]}) is True,
       "3 séries com UMA de 18s (piso 20): parcial")
    ok(C.bloco_abaixo_do_piso(e_pra, {"valores": [25, 22, 21]}) is False,
       "todas acima do piso: não é parcial")
    ok(C.bloco_abaixo_do_piso(e_pra, {"valores": [18, 18]}) is False,
       "bloco AINDA ABERTO não está 'abaixo do piso' — está em aberto")

    # ── Desfazer ────────────────────────────────────────────────────
    print("\n-- desfazer volta um passo, não o bloco inteiro --")
    resp = rex.circuito_desfazer(
        rex.CircuitoDesfazerRequest(rotina_id=r2.id, etapa_id="pra"),
        db=db, usuario=u)
    bloco = next(b for b in resp["circuito"]["blocos"] if b["id"] == "pra")
    ok(len(bloco["valores"]) == 2, "tirou a última série, guardou as outras duas")
    ok(resp["reabriu"] is True, "e reabriu a sessão, que estava fechada")
    db.expire_all()
    ed2 = db.query(ExecucaoDia).filter_by(rotina_id=r2.id, data=tempo.hoje()).first()
    ok(ed2.status != "CONCLUIDA" and ed2.xp_ganho == 0,
       "com o XP devolvido — desfazer e refazer não paga duas vezes")

    # ── UMA SESSÃO PERDIDA ENCHE UMA BARRA ──────────────────────────
    print("\n-- a razão de tudo isto: uma missão, uma punição --")
    limpar(db, u)
    r3 = nova(db, u)
    from motors import fechamento
    falha = {"titulo": r3.titulo, "data": tempo.hoje(), "xp": 10,
             "critica": False, "diaria": True, "rotina_id": r3.id}
    carga0 = medidor.carga(r3)
    fechamento._encher_medidores(db, medidor, [falha])
    db.refresh(r3)
    um_bloco = medidor.carga(r3) - carga0

    # O contrafactual: se o treino fosse quatro rotinas.
    quatro = [nova(db, u) for _ in range(4)]
    falhas4 = [{"titulo": x.titulo, "data": tempo.hoje(), "xp": 10, "critica": False,
                "diaria": True, "rotina_id": x.id} for x in quatro]
    fechamento._encher_medidores(db, medidor, falhas4)
    total4 = 0
    for x in quatro:
        db.refresh(x)
        total4 += medidor.carga(x)

    ok(um_bloco > 0, f"perder o circuito enche a barra dele ({um_bloco})")
    ok(abs(total4 - 4 * um_bloco) < 0.01,
       f"quatro rotinas encheriam {total4} — QUATRO vezes mais pela MESMA manhã")
    ok(total4 > um_bloco,
       "é isto que o circuito impede: uma manhã perdida é uma falha, não quatro")

    limpar(db, u)
    db.close()
    print(f"\n=== {testes - falhas}/{testes} ===")
    return falhas


if __name__ == "__main__":
    import sys
    sys.exit(1 if rodar() else 0)
