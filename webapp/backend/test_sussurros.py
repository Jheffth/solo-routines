# -*- coding: utf-8 -*-
"""
OS SUSSURROS — os ecos da penitência saindo pelo Solo Bot, na voz do Sistema.

O que este teste vigia:

  1. NA PENITÊNCIA: o eco só sai DEPOIS do commit. Um rollback descarta a
     intenção — avisar uma punição que não aconteceu seria a pior mentira
     que o Sistema pode contar.
  2. O TOM chega à ponte como "sussurro", e a preferência do hunter decide
     a voz: "Com voz" → voz=True, "Só texto" → voz=False, "Desligado" →
     nada sai.
  3. O TESTE DO ARQUITETO (o + do medidor) só sai para o próprio
     Arquiteto, e marcado "[teste] ".
  4. O ESPONTÂNEO: só com 4+ dívidas, no máximo um por dia, nunca antes da
     hora sorteada, nunca depois das 21h, valendo até o fim do dia, com
     {missao} = a dívida mais antiga e {dias} = a idade dela.
  5. Não repetir: as frases enviadas voltam em `evitar`, e só as últimas
     dez ficam guardadas.

Uso: DATABASE_URL=sqlite:///./x.db SECRET_KEY=... python test_sussurros.py
"""
from datetime import datetime, time, timedelta

from fastapi.testclient import TestClient

import main
import database
from auth.service import hash_senha

P = "/api"


def ok(cond, msg):
    print(("  [ok]  " if cond else "  [XX]  ") + msg)
    assert cond, msg


def main_teste():
    import solobot_ponte
    from motors import ecos, fechamento, penitencia, sussurros, tempo

    enviados = []

    def _avisar(uid, texto, opcoes=None, falado=None, voz=None, valido_ate=None, tom=None):
        enviados.append({"uid": uid, "texto": texto, "falado": falado, "voz": voz,
                         "valido_ate": valido_ate, "tom": tom})
        return True

    original_avisar = solobot_ponte.avisar
    solobot_ponte.avisar = _avisar

    try:
        with TestClient(main.app) as c:
            db = database.SessionLocal()
            arq = db.query(database.Usuario).filter_by(nivel_acesso="Arquiteto").first()
            arq.senha_hash = hash_senha("admin123")
            login_arq, uid_arq = arq.login, arq.id
            db.commit()
            db.close()
            A = {"Authorization": "Bearer " + c.post(
                P + "/auth/login", data={"username": login_arq, "password": "admin123"}
            ).json()["access_token"]}

            cod = c.post(P + "/convites/", json={"nivel_acesso": "User", "badges": []},
                         headers=A).json()["convites"][0]["codigo"]
            c.post(P + "/auth/registro", json={"nome": "Kaio", "login": "kaio",
                   "senha": "senha123", "email": "k@x.com", "codigo": cod})
            db = database.SessionLocal()
            uid_k = db.query(database.Usuario).filter_by(login="kaio").first().id
            db.close()

            print("\n=== SUSSURROS DO SISTEMA ===")

            def pref(uid, modo):
                db = database.SessionLocal()
                u = db.query(database.Usuario).filter_by(id=uid).first()
                from motors import avisos
                avisos.preferencia(db, u).sussurros = modo
                db.commit()
                db.close()

            eco = {"texto": "Eu vi.", "cru": "Eu vi."}

            # ── 1 · SÓ DEPOIS DO COMMIT ─────────────────────────────────
            enviados.clear()
            db = database.SessionLocal()
            u = db.query(database.Usuario).filter_by(id=uid_k).first()
            sussurros.apos_commit(db, u, eco)
            ok(not enviados, "antes do commit nada sai — a penitencia pode ainda ser desfeita")
            db.commit()
            ok(len(enviados) == 1, "depois do commit, o eco sai uma vez")
            ok(enviados[0]["tom"] == "sussurro", "com tom='sussurro'")
            ok(enviados[0]["voz"] is True, "e com voz — o padrao e 'Com voz'")
            ok(enviados[0]["falado"] is None,
               "sem `falado`: o Solo Bot fala a frase literal, sem IA no Rotinas")
            db.close()

            enviados.clear()
            db = database.SessionLocal()
            u = db.query(database.Usuario).filter_by(id=uid_k).first()
            sussurros.apos_commit(db, u, eco)
            db.rollback()
            db.commit()
            ok(not enviados, "rollback descarta: punicao que nao aconteceu nao e anunciada")
            db.close()

            # ── 2 · A PREFERÊNCIA ───────────────────────────────────────
            for modo, esperado in (("texto", False), ("desligado", None)):
                pref(uid_k, modo)
                enviados.clear()
                db = database.SessionLocal()
                u = db.query(database.Usuario).filter_by(id=uid_k).first()
                sussurros.apos_commit(db, u, eco)
                db.commit()
                db.close()
                if esperado is None:
                    ok(not enviados, "'Desligado' nao manda nada")
                else:
                    ok(enviados and enviados[0]["voz"] is False, "'So texto' manda com voz=False")
            pref(uid_k, "voz")

            r = c.put(P + "/bots/avisos", json={"sussurros": "gritar"}, headers=A)
            ok(r.status_code == 422, "valor desconhecido na preferencia e recusado")
            r = c.put(P + "/bots/avisos", json={"sussurros": "texto"}, headers=A)
            ok(r.json().get("sussurros") == "texto", "a API grava e devolve a escolha")
            ok(c.get(P + "/bots/avisos", headers=A).json()["sussurros"] == "texto",
               "e a leitura confirma")
            c.put(P + "/bots/avisos", json={"sussurros": "voz"}, headers=A)

            # ── 3 · O TESTE DO ARQUITETO ────────────────────────────────
            enviados.clear()
            db = database.SessionLocal()
            k = db.query(database.Usuario).filter_by(id=uid_k).first()
            sussurros.apos_commit(db, k, eco, teste=True, autor_id=uid_k)
            db.commit()
            ok(not enviados, "teste de quem nao e o Arquiteto nao sai")
            a = db.query(database.Usuario).filter_by(id=uid_arq).first()
            sussurros.apos_commit(db, a, eco, teste=True, autor_id=uid_arq)
            db.commit()
            ok(enviados and enviados[0]["texto"].startswith("[teste] "),
               "o do proprio Arquiteto sai, marcado '[teste] '")
            db.close()

            # ── 4 · NA PENITÊNCIA DE VERDADE (fechamento._cobrar) ───────
            enviados.clear()
            db = database.SessionLocal()
            k = db.query(database.Usuario).filter_by(id=uid_k).first()
            alvo = {"titulo": "Treino da manha", "data": tempo.hoje(), "xp": 10,
                    "critica": False, "diaria": True, "rotina_id": None}
            res = fechamento._cobrar(db, k, penitencia, alvo, tempo.hoje(), "teste", False)
            ok(res.get("eco") and not enviados, "_cobrar produz o eco e ainda nao envia")
            db.commit()
            ok(len(enviados) == 1 and enviados[0]["texto"] == res["eco"]["texto"],
               "depois do commit do fechamento, o eco da penitencia sai pelo Solo Bot")
            db.close()

            # ── 5 · O ESPONTÂNEO ────────────────────────────────────────
            # quatro dividas do Kaio, a mais antiga com 6 dias
            db = database.SessionLocal()
            db.query(database.TarefaDia).filter_by(usuario_id=uid_k, natureza="PUNICAO").delete()
            base = datetime.utcnow()
            for i, titulo in enumerate(["Divida mais antiga", "D2", "D3"]):
                db.add(database.TarefaDia(
                    usuario_id=uid_k, titulo=titulo, natureza="PUNICAO",
                    status="PENDENTE", teste=False, data_prevista=tempo.hoje(),
                    criado_em=base - timedelta(days=6 - i)))
            db.commit()
            db.close()

            agora_real, randint_real = sussurros.tempo.agora, sussurros.random.randint
            para_falha_real = sussurros.ecos.para_falha
            ctxs = []

            def para_falha(n, pacto, ctx=None, evitar=None):
                ctxs.append({"n": n, "ctx": dict(ctx or {}), "evitar": list(evitar or [])})
                return para_falha_real(n, pacto, ctx, evitar)

            relogio = {"t": datetime.combine(tempo.hoje(), time(9, 0))}
            sussurros.tempo.agora = lambda: relogio["t"]
            sussurros.random.randint = lambda a, b: 300          # sorteio: 10h + 300 min = 15h
            sussurros.ecos.para_falha = para_falha

            def varre():
                db = database.SessionLocal()
                u = db.query(database.Usuario).filter_by(id=uid_k).first()
                r = sussurros.varrer(db, u)
                db.close()
                return r

            try:
                enviados.clear()
                relogio["t"] = datetime.combine(tempo.hoje(), time(15, 30))
                ok(varre() is False and not enviados, "com 3 dividas, nada espontaneo")

                db = database.SessionLocal()
                db.add(database.TarefaDia(
                    usuario_id=uid_k, titulo="D4", natureza="PUNICAO", status="PENDENTE",
                    teste=False, data_prevista=tempo.hoje(), criado_em=base))
                # a da bancada do Arquiteto nao conta
                db.add(database.TarefaDia(
                    usuario_id=uid_k, titulo="Teste", natureza="PUNICAO", status="PENDENTE",
                    teste=True, data_prevista=tempo.hoje(), criado_em=base))
                db.query(database.SussurroAgenda).filter_by(usuario_id=uid_k).delete()
                db.commit()
                db.close()

                relogio["t"] = datetime.combine(tempo.hoje(), time(11, 0))
                ok(varre() is False and not enviados, "antes da hora sorteada, nada")
                db = database.SessionLocal()
                ag = db.query(database.SussurroAgenda).filter_by(usuario_id=uid_k).one()
                ok(ag.horario.time() == time(15, 0), "o horario e sorteado e guardado no banco")
                db.close()

                sussurros.random.randint = lambda a, b: 0       # um 2o sorteio nao pode acontecer
                relogio["t"] = datetime.combine(tempo.hoje(), time(15, 5))
                ok(varre() is True and len(enviados) == 1,
                   "passada a hora sorteada (e nao a de um 2o sorteio), sai um sussurro")
                e = enviados[0]
                ok(e["tom"] == "sussurro" and e["voz"] is True, "na voz do Sistema")
                va = e["valido_ate"]
                ok(va is not None and va.tzinfo is not None and va.time() >= time(23, 59),
                   "valendo ate o fim do dia, com fuso")
                ok(ctxs and ctxs[-1]["n"] == 4,
                   "conta 4 dividas — a da bancada do Arquiteto fica de fora")
                ok(ctxs[-1]["ctx"].get("missao") == "Divida mais antiga",
                   "{missao} e a divida mais antiga")
                ok(ctxs[-1]["ctx"].get("dias") == 6, "{dias} e ha quantos dias ela existe")

                enviados.clear()
                relogio["t"] = datetime.combine(tempo.hoje(), time(18, 0))
                ok(varre() is False and not enviados, "no maximo um por dia")

                # dia seguinte, depois das 21h: nada
                amanha = tempo.hoje() + timedelta(days=1)
                sussurros.random.randint = lambda a, b: 0
                relogio["t"] = datetime.combine(amanha, time(21, 30))
                ok(varre() is False and not enviados, "depois das 21h, nada")

                # dia seguinte, desligado: nem sorteia
                relogio["t"] = datetime.combine(amanha + timedelta(days=1), time(12, 0))
                pref(uid_k, "desligado")
                ok(varre() is False and not enviados, "'Desligado' cala o espontaneo")
                db = database.SessionLocal()
                n_ag = db.query(database.SussurroAgenda).filter_by(
                    usuario_id=uid_k, dia=relogio["t"].date()).count()
                db.close()
                ok(n_ag == 0, "e nem chega a sortear horario")
                pref(uid_k, "voz")
            finally:
                sussurros.tempo.agora = agora_real
                sussurros.random.randint = randint_real
                sussurros.ecos.para_falha = para_falha_real

            # ── 6 · NÃO REPETIR ─────────────────────────────────────────
            db = database.SessionLocal()
            k = db.query(database.Usuario).filter_by(id=uid_k).first()
            for i in range(14):
                sussurros.apos_commit(db, k, {"texto": f"frase {i}", "cru": f"cru {i}"})
                db.commit()
            rec = sussurros.recentes(db, uid_k)
            total = db.query(database.SussurroEnviado).filter_by(usuario_id=uid_k).count()
            db.close()
            ok(total == 10, "so as ultimas dez frases ficam guardadas")
            ok(rec[0] == "cru 13" and "cru 3" not in rec, "e as mais novas sao as que valem")
            ok(ctxs and isinstance(ctxs[-1]["evitar"], list),
               "o espontaneo passa as recentes em `evitar`")

    finally:
        solobot_ponte.avisar = original_avisar

    # ── 7 · A PONTE RECEBE O TOM ────────────────────────────────────────
    corpos = []
    post_real, token_real = solobot_ponte._post, solobot_ponte.token
    solobot_ponte._post = lambda cam, corpo, timeout=8.0: (corpos.append(corpo) or {"entregues": 1})
    solobot_ponte.token = lambda: "tok"
    try:
        r = solobot_ponte.avisar(1, "Eu vi.", voz=True, tom="sussurro")
    finally:
        solobot_ponte._post, solobot_ponte.token = post_real, token_real
    ok(r is True and corpos and corpos[0].get("tom") == "sussurro",
       "a ponte manda tom='sussurro' no corpo do aviso")

    print("\n=== SUSSURROS OK ===\n")


if __name__ == "__main__":
    main_teste()
