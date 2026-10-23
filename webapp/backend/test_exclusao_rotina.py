# -*- coding: utf-8 -*-
"""
Excluir uma rotina que JA TEM historico.

O erro que este teste reproduz e impede de voltar:

    IntegrityError: null value in column "rotina_id" of relation
    "execucao_dia" violates not-null constraint
    [SQL: UPDATE execucao_dia SET rotina_id=NULL WHERE ...]

Ao apagar a regra, o SQLAlchemy tentava ANULAR o vinculo das missoes ja
vividas — mas `execucao_dia.rotina_id` e NOT NULL. O defeito sempre existiu;
so quase nunca havia ExecucaoDia para anular. Depois que passamos a
materializar um registro por dia devido, ele virou certeza.

A regra travada aqui separa duas operacoes que sao diferentes de proposito:

    EXCLUIR    → apaga a REGRA, PRESERVA o historico (arquiva).
    EXTINGUIR  → apaga tudo e estorna o XP (poder do Arquiteto).

Uso: DATABASE_URL=sqlite:///./x.db SECRET_KEY=... python test_exclusao_rotina.py
"""
from datetime import date, timedelta
from motors import tempo

from fastapi.testclient import TestClient

import main
import database
from motors import fechamento
from auth.service import hash_senha

P = "/api"


def ok(cond, msg):
    print(("  [ok]  " if cond else "  [XX]  ") + msg)
    assert cond, msg


def _com_historico(c, H, uid, titulo):
    """Cria uma rotina e faz nascerem missoes de dias passados."""
    r = c.post(P + "/rotinas/", json={
        "titulo": titulo, "tipo": "DIARIA", "categoria": "Pessoal",
        "prioridade": "MEDIA", "xp_recompensa": 50, "moedas_recompensa": 5,
    }, headers=H).json()

    # Semeia os dias passados explicitamente. O `materializar` só cria o dia
    # corrente — inventar dias para trás fabricava derrotas nunca vividas.
    hoje = tempo.hoje()
    db = database.SessionLocal()
    rot = db.query(database.Rotina).get(r["id"])
    rot.criado_em = rot.criado_em - timedelta(days=4)
    for d in range(1, 5):
        db.add(database.ExecucaoDia(
            rotina_id=r["id"], usuario_id=uid,
            data=hoje - timedelta(days=d), status="PENDENTE"))
    db.commit()
    usuario = db.query(database.Usuario).get(uid)
    fechamento.processar_usuario(db, usuario)   # cria o dia de hoje e fecha os vencidos
    db.commit()
    n = db.query(database.ExecucaoDia).filter_by(rotina_id=r["id"]).count()
    db.close()
    return r["id"], n


def rodar():
    with TestClient(main.app) as c:
        db = database.SessionLocal()
        u = db.query(database.Usuario).filter_by(nivel_acesso="Arquiteto").first()
        u.senha_hash = hash_senha("admin123")
        login, uid = u.login, u.id
        db.commit()
        db.close()

        H = {"Authorization": "Bearer " + c.post(
            P + "/auth/login",
            data={"username": login, "password": "admin123"}).json()["access_token"]}

        print("\n=== EXCLUSAO DE ROTINA COM HISTORICO ===")

        # ── 1. EXCLUIR uma regra que ja produziu missoes ──────────────
        rid, n = _com_historico(c, H, uid, "Carregar Dolphin")
        ok(n >= 2, f"a regra produziu historico ({n} missoes)")

        d = c.delete(P + f"/rotinas/{rid}", headers=H)
        ok(d.status_code == 200, f"excluir NAO estoura IntegrityError ({d.status_code})")
        ok(d.json().get("modo") == "arquivada", "a regra foi arquivada, nao apagada")

        # O historico tem de continuar inteiro no extrato.
        db = database.SessionLocal()
        restantes = db.query(database.ExecucaoDia).filter_by(rotina_id=rid).count()
        rot = db.query(database.Rotina).get(rid)
        db.close()
        ok(restantes == n, f"as {n} missoes vividas continuam no banco")
        ok(rot is not None and rot.status == "ARQUIVADA", "regra marcada ARQUIVADA")
        ok(rot.ativo is False, "regra arquivada nao gera missao nova")

        ext = c.get(P + "/extrato/", params={"inicio": (tempo.hoje()-timedelta(days=5)).isoformat(),
                                             "fim": tempo.hoje().isoformat()}, headers=H).json()
        ok(len([m for m in ext["missoes"] if m["rotina_id"] == rid]) == n,
           "o extrato ainda mostra a historia da regra excluida")

        # ── 2. A regra arquivada some da AGENDA ───────────────────────
        agenda = c.get(P + "/rotinas/", headers=H).json()
        ok(all(x["id"] != rid for x in agenda), "arquivada sumiu da agenda")
        hoje_l = c.get(P + "/rotinas/hoje", headers=H).json()
        ok(all(x["id"] != rid for x in hoje_l), "arquivada nao aparece em /hoje")

        com_arq = c.get(P + "/rotinas/", params={"incluir_arquivadas": True}, headers=H).json()
        ok(any(x["id"] == rid for x in com_arq), "mas da para pedir as arquivadas")

        # ── 3. Regras vivas continuam visiveis (nao escondemos demais) ─
        viva = c.post(P + "/rotinas/", json={
            "titulo": "Regra Viva", "tipo": "DIARIA", "categoria": "Casa",
            "prioridade": "BAIXA",
        }, headers=H).json()
        agenda2 = c.get(P + "/rotinas/", headers=H).json()
        ok(any(x["id"] == viva["id"] for x in agenda2), "regra viva continua na agenda")

        # status NULL (linhas antigas) nao pode desaparecer
        db = database.SessionLocal()
        db.query(database.Rotina).filter_by(id=viva["id"]).update({"status": None})
        db.commit()
        db.close()
        agenda3 = c.get(P + "/rotinas/", headers=H).json()
        ok(any(x["id"] == viva["id"] for x in agenda3),
           "regra com status NULL (legado) NAO some da agenda")

        # ── 4. Sem historico: sai do banco de vez ─────────────────────
        limpa = c.post(P + "/rotinas/", json={
            "titulo": "Nunca Executada", "tipo": "ANUAL", "mes_dia": "12-25",
            "categoria": "Pessoal", "prioridade": "BAIXA",
        }, headers=H).json()
        d2 = c.delete(P + f"/rotinas/{limpa['id']}", headers=H)
        ok(d2.json().get("modo") == "removida", "regra sem historico e removida de vez")
        db = database.SessionLocal()
        ok(db.query(database.Rotina).get(limpa["id"]) is None, "sumiu do banco mesmo")
        db.close()

        # ── 5. EXTINGUIR (Arquiteto) varre tudo ───────────────────────
        rid2, n2 = _com_historico(c, H, uid, "Regra a Extinguir")
        ok(n2 >= 2, f"segunda regra com historico ({n2} missoes)")
        d3 = c.delete(P + f"/rotinas/{rid2}?extinguir=true", headers=H)
        ok(d3.status_code == 200, f"extinguir responde ({d3.status_code})")
        ok(d3.json().get("modo") == "extinta", "modo extinta")
        db = database.SessionLocal()
        ok(db.query(database.Rotina).get(rid2) is None, "a regra extinta sumiu")
        ok(db.query(database.ExecucaoDia).filter_by(rotina_id=rid2).count() == 0,
           "e o historico dela foi junto")
        db.close()

        # ── 6. EXTINGUIR UMA META com valores lancados ───────────────
        # O erro real: "Cirurgia da Vivi" (META R$ 66,67) dava Internal
        # Server Error ao extinguir. `meta_aportes.execucao_id` aponta para
        # `execucao_dia`; apagar o dia sem apagar os aportes viola a FK no
        # Postgres. O SQLite nao cobra FK por padrao, entao o teste confere
        # com `PRAGMA foreign_key_check` — que lista exatamente o orfao que
        # o Postgres recusaria.
        from sqlalchemy import text
        rm = c.post(P + "/rotinas/", json={
            "titulo": "Conseguir 66,67 para a cirurgia", "tipo": "DIARIA",
            "categoria": "Pessoal", "prioridade": "ALTA",
            "natureza": "META", "meta_alvo": 66.67, "meta_especie": "VALOR",
        }, headers=H).json()
        r1 = c.post(P + "/execucoes/meta/registrar",
                    json={"rotina_id": rm["id"], "valor": 70}, headers=H)
        ok(r1.status_code == 200, f"meta recebe valor ({r1.status_code})")
        d4 = c.delete(P + f"/rotinas/{rm['id']}?extinguir=true", headers=H)
        ok(d4.status_code == 200, f"extinguir META com aportes responde ({d4.status_code})")
        db = database.SessionLocal()
        ok(db.query(database.Rotina).get(rm["id"]) is None, "a meta extinta sumiu")
        orfaos = db.execute(text("PRAGMA foreign_key_check(meta_aportes)")).fetchall()
        ok(not orfaos, f"nenhum aporte orfao apontando para dia apagado ({len(orfaos)})")
        db.close()

        # A missao geral de META: os aportes apontam para a TarefaDia.
        tm = c.post(P + "/tarefas/", json={
            "titulo": "Meta avulsa", "natureza": "META", "meta_alvo": 50,
            "meta_especie": "VALOR", "prioridade": "MEDIA",
            "data_prevista": tempo.hoje().isoformat(),
        }, headers=H)
        if tm.status_code in (200, 201):
            tid = tm.json()["id"]
            c.post(P + "/execucoes/meta/registrar",
                   json={"tarefa_id": tid, "valor": 10}, headers=H)
            d5 = c.delete(P + f"/tarefas/{tid}?extinguir=true", headers=H)
            ok(d5.status_code == 200, f"extinguir missao geral de META responde ({d5.status_code})")
            db = database.SessionLocal()
            orfaos = db.execute(text("PRAGMA foreign_key_check(meta_aportes)")).fetchall()
            ok(not orfaos, "missao geral extinta nao deixa aporte orfao")
            db.close()
        else:
            print("  [--]  criacao de tarefa META indisponivel:", tm.status_code, tm.text[:120])

        print("\n=== EXCLUSAO OK ===")


if __name__ == "__main__":
    rodar()
