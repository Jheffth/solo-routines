# -*- coding: utf-8 -*-
"""
Os contadores — o balde onde as repeticoes se acumulam, ponta a ponta.

Passos 6 e 7 do PLANO_MISSAO_REPETICAO. O caminho inteiro: criar a
rotina como o lancador cria, clicar, e ver o total do contador subir.

O QUE ESTE TESTE PROTEGE

  · a posse — mandar `contador_id` de outro hunter nao pode somar
    no balde dele
  · o teto de entrada — `xp_por_repeticao: 500` vira 3 na GRAVACAO,
    nao so na hora de pagar
  · arquivar != apagar — o total sobrevive
  · a soma nao filtra por usuario (a porta da guilda)
  · a media e por DIA ATIVO, nao por dia de calendario

Uso: DATABASE_URL=sqlite:///./x.db SECRET_KEY=... python test_contadores.py
"""
from fastapi.testclient import TestClient

import main
from database import SessionLocal, Contador, Rotina, ExecucaoDia, Usuario
from auth.service import hash_senha
from motors import tempo

falhas = 0


def ok(cond, msg):
    global falhas
    if not cond:
        falhas += 1
    print(("  [ok]  " if cond else "  [XX]  ") + msg)


def rodar():
    print("\n=== OS CONTADORES ===\n")
    cli = TestClient(main.app)
    with cli:
        pass
    db = SessionLocal()

    def entrar(u, senha="teste123"):
        u.senha_hash = hash_senha(senha)
        db.commit()
        r = cli.post("/api/auth/login", data={"username": u.login, "password": senha})
        return {"Authorization": "Bearer " + r.json()["access_token"]}

    dono = db.query(Usuario).filter_by(nivel_acesso="Arquiteto").first()
    for r in db.query(Rotina).filter(Rotina.natureza == "REPETICAO").all():
        db.query(ExecucaoDia).filter_by(rotina_id=r.id).delete()
        db.delete(r)
    db.query(Contador).delete()
    db.commit()
    H = entrar(dono)

    # ══ 1. CRIAR, como o lancador cria ═══════════════════════════
    print("-- criar --")
    r = cli.post("/api/contadores", json={"nome": "Questões", "unidade": "questões"},
                 headers=H)
    ok(r.status_code == 200, f"cria um contador ({r.status_code})")
    cid = r.json()["id"]
    ok(r.json()["total"] == 0, "nasce em zero")

    r2 = cli.post("/api/contadores", json={"nome": "questões"}, headers=H)
    ok(r2.json()["id"] == cid,
       "criar de novo com o MESMO nome devolve o mesmo balde — dois 'Questões' "
       "seriam dois totais para a mesma coisa")

    ok(cli.post("/api/contadores", json={"nome": "  "}, headers=H).status_code == 400,
       "nome vazio: 400")

    # ══ 2. A ROTINA, com o payload do lancador ═══════════════════
    print("\n-- a rotina de repeticao --")
    base = dict(tipo="DIARIA", categoria="Estudo", prioridade="MEDIA",
                dificuldade="NORMAL", natureza="REPETICAO")
    r = cli.post("/api/rotinas/", headers=H,
                 json={**base, "titulo": "Responder 5 questões",
                       "alvo_repeticoes": 5, "contador_id": cid,
                       "xp_por_repeticao": 0})
    ok(r.status_code in (200, 201), f"cria a rotina META ({r.status_code})")
    meta_id = r.json()["id"]
    ok(r.json()["alvo_repeticoes"] == 5, "o alvo volta na resposta")
    ok(r.json()["contador_id"] == cid, "  e o contador")
    ok(r.json()["natureza"] == "REPETICAO", "  e a natureza")

    # O TETO NA ENTRADA. Guardar 500 e limitar so na hora de pagar
    # deixaria o numero mentiroso no lancador e no cartao.
    r = cli.post("/api/rotinas/", headers=H,
                 json={**base, "titulo": "Beber água", "contador_id": cid,
                       "xp_por_repeticao": 500})
    bonus_id = r.json()["id"]
    ok(r.json()["xp_por_repeticao"] == 3,
       f"pedir 500 XP por clique GRAVA 3 ({r.json()['xp_por_repeticao']}) — "
       "o teto age na entrada, nao so no pagamento")
    ok(r.json()["alvo_repeticoes"] is None, "sem alvo, o modo e BONUS")

    # ══ 3. A POSSE ═══════════════════════════════════════════════
    print("\n-- a posse do balde --")
    outro = (db.query(Usuario)
               .filter(Usuario.id != dono.id, Usuario.ativo == True).first())
    if outro:
        H2 = entrar(outro)
        r = cli.post("/api/rotinas/", headers=H2,
                     json={**base, "titulo": "Invasão", "contador_id": cid})
        ok(r.json().get("contador_id") is None,
           "mandar o contador_id de OUTRO hunter nao atrela — o total dele nao "
           "sobe por conta de uma rotina que nao e dele")
        ok(r.status_code in (200, 201),
           "  e nao explode: rotina sem contador e um caso legitimo")
        ok(cli.get(f"/api/contadores/{cid}", headers=H2).status_code == 404,
           "e ler o contador alheio: 404")
        H = entrar(dono)

    # ══ 4. CLICAR e ver o total subir ════════════════════════════
    print("\n-- clicar --")
    for _ in range(3):
        cli.post("/api/execucoes/repetir", json={"rotina_id": meta_id}, headers=H)
    for _ in range(7):
        cli.post("/api/execucoes/repetir", json={"rotina_id": bonus_id}, headers=H)

    d = cli.get(f"/api/contadores/{cid}", headers=H).json()
    ok(d["total"] == 10, f"3 + 7 de rotinas diferentes = {d['total']} no mesmo balde")
    ok(d["hoje"] == 10, "  todas de hoje")
    ok(len(d["fontes"]) == 2, "e o contador diz DE ONDE cada numero veio")
    ok({f["modo"] for f in d["fontes"]} == {"META", "BONUS"},
       "  com o modo de cada rotina")
    ok(sum(f["n"] for f in d["fontes"]) == d["total"],
       "  e as fontes somam exatamente o total — senao o numero seria magico")
    ok(len(d["serie"]) == 30, "a serie tem 30 dias para o grafico")
    ok(d["serie"][-1]["n"] == 10, "  com hoje no fim")

    # A rotina devolve a contagem do dia: sem isso o cartao nasce em
    # zero a cada recarga e o hunter perde o que fez ao trocar de aba.
    hoje_lista = cli.get("/api/rotinas/hoje", headers=H).json()
    achou = [x for x in (hoje_lista if isinstance(hoje_lista, list)
                         else hoje_lista.get("rotinas", []))
             if x.get("id") == bonus_id]
    if achou:
        ok(achou[0].get("repeticoes") == 7,
           "a lista de hoje ja traz a contagem — o cartao nao nasce zerado")

    # ══ 5. A MEDIA E POR DIA ATIVO ═══════════════════════════════
    print("\n-- as estatisticas --")
    from datetime import timedelta
    hoje = tempo.hoje()
    db.add(ExecucaoDia(rotina_id=meta_id, usuario_id=dono.id,
                       data=hoje - timedelta(days=20), status="ATIVA", repeticoes=30))
    db.commit()
    d = cli.get(f"/api/contadores/{cid}", headers=H).json()
    ok(d["melhor_dia"] == 30, f"melhor dia = {d['melhor_dia']}")
    ok(d["dias_ativos"] == 2, "dois dias ativos")
    ok(d["media_dia"] == 20.0,
       f"media = {d['media_dia']} — por dia ATIVO, nao por dia de calendario. "
       "'quanto eu faco quando faco' e o numero que interessa")

    # ══ 6. ARQUIVAR != APAGAR ════════════════════════════════════
    print("\n-- arquivar --")
    total_antes = d["total"]
    r = cli.delete(f"/api/contadores/{cid}", headers=H)
    ok(r.status_code == 200, "arquiva")
    ok(r.json()["total_preservado"] == total_antes,
       f"e o total SOBREVIVE ({total_antes}) — um registro de anos nao some "
       "por um clique numa lixeira")
    ok(cid not in [c["id"] for c in cli.get("/api/contadores", headers=H).json()],
       "sai da lista do lancador")
    ok(cid in [c["id"] for c in
               cli.get("/api/contadores?incluir_arquivados=true", headers=H).json()],
       "  mas continua acessivel")
    ok(cli.get(f"/api/contadores/{cid}", headers=H).json()["total"] == total_antes,
       "e o detalhe continua mostrando o numero")
    cli.post(f"/api/contadores/{cid}/restaurar", headers=H)
    ok(cid in [c["id"] for c in cli.get("/api/contadores", headers=H).json()],
       "restaurar traz de volta")

    # ══ 7. A PORTA DA GUILDA ═════════════════════════════════════
    print("\n-- a porta da guilda --")
    fonte = open("routers/contadores.py", encoding="utf-8").read()
    # SEM OS COMENTARIOS: esta armadilha ja mordeu tres vezes neste
    # projeto — o comentario que EXPLICA a regra e contado como se
    # fosse a violacao dela.
    import re
    codigo = re.sub(r'"""[\s\S]*?"""', '', fonte)
    codigo = re.sub(r'#.*$', '', codigo, flags=re.M)
    somas = [l for l in codigo.split("\n") if "func.sum" in l]
    ok(len(somas) >= 2, f"ha {len(somas)} somas no router")
    trecho = codigo[codigo.index("def total_de"):codigo.index("def _resumo")]
    ok("usuario_id" not in trecho,
       "a soma do total NAO filtra por usuario — e essa ausencia que deixa um "
       "contador de guilda somar certo sem reescrever a consulta")
    ok("contador_id" in trecho, "  ela filtra por contador_id, e so")

    db.close()
    print(f"\n=== {'TUDO PASSOU' if not falhas else str(falhas) + ' FALHA(S)'} ===")
    return 1 if falhas else 0


if __name__ == "__main__":
    raise SystemExit(rodar())
