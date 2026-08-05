# -*- coding: utf-8 -*-
"""
O relogio do Sistema — a missao de hoje nao pode fracassar antes da hora.

O DEFEITO QUE ISTO IMPEDE DE VOLTAR

`date.today()` devolve o dia no fuso do SERVIDOR. Em producao o servidor roda
em UTC e o hunter vive em Brasilia (UTC-3). A partir das 21:00 de Brasilia o
servidor ja virou o dia — e o fechamento marcava como FRACASSADA, com
penalidade, as missoes de HOJE que ainda tinham prazo.

Sintoma observado na tela: o cartao mostrava "Prazo 2h 39m" e "FRACASSADA" ao
mesmo tempo. O navegador contava em Brasilia, o servidor julgava em UTC.

Uma rotina com janela 20:00–22:00 era punida todo dia as 21:00.

Uso: DATABASE_URL=sqlite:///./f.db SECRET_KEY=... python test_fuso.py
"""
from datetime import date, datetime, time, timedelta, timezone

from fastapi.testclient import TestClient

import main
import database
from motors import fechamento, tempo
from auth.service import hash_senha

P = "/api"


def ok(cond, msg):
    print(("  [ok]  " if cond else "  [XX]  ") + msg)
    assert cond, msg


def rodar():
    print("\n=== RELOGIO DO SISTEMA ===")

    # ── O relogio, isolado ────────────────────────────────────────
    ok(tempo.FUSO.utcoffset(None) == timedelta(hours=-3),
       "o relogio do app marca Brasilia (UTC-3)")

    # As 21:00 de Brasilia, UTC ja e o dia seguinte. E exatamente a
    # janela em que as rotinas noturnas acontecem.
    momento = datetime(2026, 7, 25, 21, 0, tzinfo=timezone(timedelta(hours=-3)))
    dia_hunter = momento.date()
    dia_servidor_utc = momento.astimezone(timezone.utc).date()
    ok(dia_hunter != dia_servidor_utc,
       f"as 21h de Brasilia o servidor UTC ja virou o dia ({dia_hunter} vs {dia_servidor_utc})")

    # ── O caso real, ponta a ponta ────────────────────────────────
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

        hoje = tempo.hoje()

        # RELOGIO CONGELADO AS 21:00 — a hora exata do bug original, e agora
        # tambem uma necessidade: desde que a janela de horario passou a valer,
        # o status de uma rotina 20:00–22:00 depende da hora em que o teste
        # roda. Este arquivo chegou a falhar as 22:36 porque a missao havia
        # (corretamente) fracassado. Um teste que so passa de manha nao esta
        # verificando nada.
        _agora_real, _hoje_real = tempo.agora, tempo.hoje
        tempo.agora = lambda: datetime.combine(hoje, time(21, 0))
        tempo.hoje = lambda: hoje

        # A rotina do print: janela 20:00–22:00, penalidade de 8 XP.
        r = c.post(P + "/rotinas/", json={
            "titulo": "Fio Dental Rotineiro", "tipo": "DIARIA",
            "categoria": "Saude", "prioridade": "MEDIA",
            "xp_recompensa": 50, "moedas_recompensa": 5, "penalidade_xp": 8,
            "hora_inicio": "20:00", "hora_fim": "22:00",
        }, headers=H)
        ok(r.status_code in (200, 201), f"rotina noturna criada ({r.status_code})")
        rid = r.json()["id"]

        db = database.SessionLocal()
        usuario = db.query(database.Usuario).get(uid)
        fechamento.processar_usuario(db, usuario)
        db.commit()
        xp_antes = usuario.xp_total
        db.close()

        def missao_hoje():
            resp = c.get(P + "/extrato/", params={"inicio": hoje.isoformat(),
                                                  "fim": hoje.isoformat()}, headers=H).json()
            achadas = [m for m in resp["missoes"] if m["rotina_id"] == rid]
            return achadas[0] if achadas else None

        m = missao_hoje()
        ok(m is not None, "a missao de hoje existe")
        # As 21:00 ela esta EM CURSO, nao pendente: a janela abriu as 20:00 e
        # missao de janela se acende sozinha. O que importa aqui — e era o bug —
        # e que ela nao esta FRACASSADA uma hora antes de vencer.
        ok(m["status"] == "ATIVA", "as 21:00 ela esta em curso (janela aberta as 20:00)")
        ok(m["status"] != "FRACASSADA", "e NAO fracassada: o prazo so vence as 22:00")

        # ── O NUCLEO: fechar com o "hoje" do servidor UTC ─────────
        # `ate` recebe o dia seguinte, que e exatamente o que
        # `date.today()` devolvia as 21h de Brasilia.
        db = database.SessionLocal()
        usuario = db.query(database.Usuario).get(uid)
        fechamento.fechar_vencidas(db, usuario, ate=hoje)   # o dia CERTO
        db.commit()
        db.close()

        m = missao_hoje()
        ok(m["status"] != "FRACASSADA",
           "com o relogio certo, a missao de hoje segue viva")
        ok(m["xp_perdido"] == 0, "e nada foi descontado")

        # ── O reparo do estrago ja gravado ────────────────────────
        # Simula o banco como ficou: missao de hoje marcada FRACASSADA
        # com penalidade aplicada, que e o que o hunter viu na tela.
        db = database.SessionLocal()
        ed = db.query(database.ExecucaoDia).filter_by(
            rotina_id=rid, data=hoje).first()
        ed.status = "FRACASSADA"
        ed.fracassada_em = datetime.utcnow()
        ed.xp_perdido = 8
        usuario = db.query(database.Usuario).get(uid)
        usuario.xp_total = max(0, usuario.xp_total - 8)
        usuario.xp_atual = max(0, usuario.xp_atual - 8)
        xp_danificado = usuario.xp_total
        db.commit()
        db.close()

        # Confere pelo BANCO, nao pelo extrato: ler o extrato ja dispara o
        # reparo automatico, e o estado danificado sumiria antes de ser visto.
        db = database.SessionLocal()
        conferida = db.query(database.ExecucaoDia).filter_by(
            rotina_id=rid, data=hoje).first()
        db.close()
        ok(conferida.status == "FRACASSADA", "estado danificado reproduzido no banco")

        db = database.SessionLocal()
        usuario = db.query(database.Usuario).get(uid)
        rep = fechamento.reparar_fechamento_indevido(db, usuario)
        db.commit()
        xp_reparado = usuario.xp_total
        db.close()

        ok(rep["reabertas"] == 1, "o reparo encontrou 1 missao fechada por engano")
        ok(rep["xp_devolvido"] == 8, "e devolveu os 8 XP")
        ok(xp_reparado == xp_danificado + 8, "o XP do hunter voltou ao lugar")
        m = missao_hoje()
        ok(m["status"] != "FRACASSADA", "a missao voltou a ser jogavel")
        ok(m["xp_perdido"] == 0, "sem marca de penalidade")

        # Rodar o reparo de novo nao pode devolver XP outra vez.
        db = database.SessionLocal()
        usuario = db.query(database.Usuario).get(uid)
        rep2 = fechamento.reparar_fechamento_indevido(db, usuario)
        db.commit()
        xp_final = usuario.xp_total
        db.close()
        ok(rep2["xp_devolvido"] == 0 and xp_final == xp_reparado,
           "reparar 2x nao devolve XP em dobro")

        # ── O passado continua sendo passado ──────────────────────
        # O reparo nao pode ressuscitar derrotas legitimas de ontem.
        ontem = hoje - timedelta(days=1)
        db = database.SessionLocal()
        db.add(database.ExecucaoDia(
            rotina_id=rid, usuario_id=uid, data=ontem,
            status="FRACASSADA", xp_perdido=8,
            fracassada_em=datetime.utcnow()))
        db.commit()
        usuario = db.query(database.Usuario).get(uid)
        fechamento.reparar_fechamento_indevido(db, usuario)
        db.commit()
        velha = db.query(database.ExecucaoDia).filter_by(
            rotina_id=rid, data=ontem).first()
        ok(velha.status == "FRACASSADA",
           "a derrota de ONTEM permanece — historico nao se reescreve")
        db.close()

        # ── Sem backfill: nao inventamos dias nao vividos ─────────
        db = database.SessionLocal()
        rot = db.query(database.Rotina).get(rid)
        rot.criado_em = rot.criado_em - timedelta(days=20)   # rotina "antiga"
        db.commit()
        antes = db.query(database.ExecucaoDia).filter_by(rotina_id=rid).count()
        usuario = db.query(database.Usuario).get(uid)
        fechamento.materializar(db, usuario.id)
        db.commit()
        depois = db.query(database.ExecucaoDia).filter_by(rotina_id=rid).count()
        db.close()
        ok(depois == antes,
           f"rotina de 20 dias NAO cria 20 derrotas retroativas ({antes} -> {depois})")

        # ── O AGENDADOR BEBE DA MESMA FONTE ───────────────────────
        #
        # Este arquivo inteiro existe porque o fuso do SERVIDOR nao e o do
        # hunter. O APScheduler ficou de fora dessa regra: sem argumento,
        # `BackgroundScheduler()` agenda pelo fuso do sistema operacional.
        # Num servidor em UTC, o job "00h05" dispara as 21h05 de Brasilia
        # — e o gatilho "TODAS as diarias do dia falharam" julga um dia
        # que ainda nao acabou, entao nunca fecha. A punicao some sem um
        # unico erro em log, e so aparece quando alguem repara na falta.
        #
        # O assert compara com `tempo.FUSO` em vez de escrever "-03:00":
        # `APP_UTC_OFFSET` pode mudar o fuso do app, e um teste que fixa a
        # string passaria a reprovar a configuracao correta.
        import main as _main
        ok(str(_main.scheduler.timezone) == str(tempo.FUSO),
           f"o scheduler usa o relogio do app ({_main.scheduler.timezone}), "
           f"nao o do servidor — sobrevive a troca de hospedagem")

    print("\n=== RELOGIO OK ===")


if __name__ == "__main__":
    rodar()
