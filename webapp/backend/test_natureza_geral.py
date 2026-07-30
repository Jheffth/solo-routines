# -*- coding: utf-8 -*-
"""
As naturezas na MISSAO GERAL — passiva e repeticao fora da rotina.

O ERRO QUE ISTO CORRIGE

Eu tinha escrito no codigo que "um protocolo que vale uma vez so nao e
protocolo", e prendi as duas naturezas a ROTINA. O Arquiteto desmontou
em uma frase: um protocolo para a vespera de uma prova, um contador
usado "vez ou outra". Sao missoes gerais.

A regra confundia RECORRENCIA com NATUREZA. Sao eixos independentes:
com que frequencia a missao aparece, e de que jeito ela se cumpre.

O QUE ESTE TESTE PROTEGE

  · os dois tetos valem na missao geral tambem — senao bastaria criar
    uma tarefa em vez de uma rotina para burlar
  · rotina e tarefa no MESMO contador dividem a mesma cota diaria
  · o total do balde soma as DUAS frentes
  · o BONUS avulso nao mexe no streak nem no historico
  · a passiva avulsa exige janela, como a da rotina

Uso: DATABASE_URL=sqlite:///./x.db SECRET_KEY=... python test_natureza_geral.py
"""
from fastapi.testclient import TestClient
from datetime import timedelta

import main
from database import (SessionLocal, Contador, Rotina, ExecucaoDia, TarefaDia,
                      Execucao, Usuario)
from auth.service import hash_senha
from motors import tempo, especiais

falhas = 0


def ok(cond, msg):
    global falhas
    if not cond:
        falhas += 1
    print(("  [ok]  " if cond else "  [XX]  ") + msg)


def rodar():
    print("\n=== AS NATUREZAS NA MISSAO GERAL ===\n")
    cli = TestClient(main.app)
    with cli:
        pass
    db = SessionLocal()
    u = db.query(Usuario).filter_by(nivel_acesso="Arquiteto").first()

    db.query(TarefaDia).filter_by(usuario_id=u.id).delete()
    for r in db.query(Rotina).filter(Rotina.natureza == "REPETICAO").all():
        db.query(ExecucaoDia).filter_by(rotina_id=r.id).delete()
        db.delete(r)
    db.query(Contador).delete()
    u.senha_hash = hash_senha("teste123")
    db.commit()
    tok = cli.post("/api/auth/login",
                   data={"username": u.login, "password": "teste123"})
    H = {"Authorization": "Bearer " + tok.json()["access_token"]}
    hoje = tempo.hoje()

    def nova(**kw):
        base = dict(titulo="X", data_prevista=hoje.isoformat(),
                    prioridade="MEDIA", categoria="Estudo", dificuldade="NORMAL")
        return cli.post("/api/tarefas/", json={**base, **kw}, headers=H)

    def clicar(tid, n=1):
        for _ in range(n):
            r = cli.post("/api/execucoes/repetir", json={"tarefa_id": tid}, headers=H)
        return r

    # ══ 1. A REPETICAO EXISTE COMO MISSAO GERAL ══════════════════
    print("-- o contador avulso --")
    cont = cli.post("/api/contadores", json={"nome": "Questoes",
                                             "unidade": "questoes"}, headers=H).json()
    r = nova(titulo="Questoes do simulado", natureza="REPETICAO",
             contador_id=cont["id"], xp_por_repeticao=1)
    ok(r.status_code in (200, 201), f"cria missao geral de repeticao ({r.status_code})")
    t = r.json()
    tid = t["id"]
    ok(t["natureza"] == "REPETICAO",
       "a natureza volta na resposta — nao foi silenciosamente virada ATIVA")
    ok(t["alvo_repeticoes"] is None, "sem alvo, e o modo BONUS")
    ok(t["contador_id"] == cont["id"], "e ja nasce atrelada ao balde")
    ok(t["repeticoes"] == 0, "com a contagem em zero")

    j = clicar(tid).json()
    ok(j["repeticoes"] == 1, "clicar conta")
    ok(j["modo"] == "BONUS", "  no modo certo")
    ok(j["xp_ganho"] == 1, "  e paga 1 XP")
    ok(j.get("tarefa_id") == tid, "  a resposta se identifica como tarefa")

    # ══ 2. OS TETOS VALEM AQUI TAMBEM ════════════════════════════
    print("\n-- o teto nao escolhe frente --")
    r = nova(titulo="Ganancia", natureza="REPETICAO", xp_por_repeticao=500)
    ok(r.json()["xp_por_repeticao"] == 3,
       f"pedir 500 XP por clique GRAVA 3 ({r.json()['xp_por_repeticao']}) — "
       "o teto de entrada nao e exclusivo da rotina")

    g = r.json()["id"]
    clicar(g, 40)
    db.expire_all()
    tg = db.query(TarefaDia).get(g)
    ok(tg.repeticoes == 40, f"40 cliques contam 40 ({tg.repeticoes})")
    ok(tg.xp_repeticao_pago == 30,
       f"e pagam o teto do dia: {tg.xp_repeticao_pago}, nao 120")

    # ══ 3. A COTA E DO CONTADOR, NAO DA FRENTE ═══════════════════
    print("\n-- rotina e tarefa dividem a mesma cota --")
    rot = Rotina(titulo="Questoes diarias", tipo="DIARIA", categoria="Estudo",
                 prioridade="MEDIA", dificuldade="NORMAL", natureza="REPETICAO",
                 usuario_id=u.id, ativo=True, contador_id=cont["id"],
                 xp_por_repeticao=1)
    db.add(rot); db.commit()
    for _ in range(40):
        cli.post("/api/execucoes/repetir", json={"rotina_id": rot.id}, headers=H)

    j = clicar(tid).json()
    ok(j["xp_ganho"] == 0,
       "a rotina esgotou a cota do balde e a MISSAO GERAL do mesmo balde nao "
       "ganha mais — senao bastaria criar as duas para dobrar o XP do dia")

    solta = nova(titulo="Outro balde", natureza="REPETICAO", xp_por_repeticao=1).json()["id"]
    ok(clicar(solta).json()["xp_ganho"] == 1,
       "e uma missao de OUTRO balde continua pagando: o teto nunca foi global")

    # ══ 4. O TOTAL SOMA AS DUAS FRENTES ══════════════════════════
    print("\n-- o total do balde --")
    d = cli.get(f"/api/contadores/{cont['id']}", headers=H).json()
    db.expire_all()
    da_tarefa = db.query(TarefaDia).get(tid).repeticoes
    da_rotina = 40
    ok(d["total"] == da_tarefa + da_rotina,
       f"o total soma rotina ({da_rotina}) + missao geral ({da_tarefa}) = {d['total']}")
    ok(sum(f["n"] for f in d["fontes"]) == d["total"],
       "  e as fontes somam exatamente o total — senao o numero contradiz a lista")
    ok(any(f.get("avulsa") for f in d["fontes"]),
       "a missao geral aparece na lista de fontes, marcada como avulsa")
    ok(d["hoje"] == d["total"],
       "e ela entra no 'hoje' pelo dia previsto dela")

    # ══ 5. O BONUS AVULSO NAO E UMA MISSAO ═══════════════════════
    print("\n-- o BONUS avulso tambem nao mexe no streak --")
    db.expire_all()
    uu = db.query(Usuario).get(u.id)
    uu.streak_atual = 6
    uu.ultima_atividade = hoje - timedelta(days=1)
    db.commit()
    clicar(solta)
    db.expire_all()
    uu = db.query(Usuario).get(u.id)
    ok(uu.streak_atual == 6, "o streak nao se mexe")
    ok(uu.ultima_atividade == hoje - timedelta(days=1), "  nem a atividade")
    ok(db.query(Execucao).filter_by(tarefa_id=solta).count() == 0,
       "e nao ha linha de historico — a regra e a mesma das duas frentes")

    # ══ 6. META AVULSA ═══════════════════════════════════════════
    print("\n-- a meta avulsa --")
    m = nova(titulo="Responder 5 questoes", natureza="REPETICAO",
             alvo_repeticoes=5).json()
    mid = m["id"]
    ok(m["alvo_repeticoes"] == 5, "o alvo grava")
    j = clicar(mid, 4).json()
    ok(j["meta_cumprida"] is False, "em 4/5 nao cumpriu")
    ok(j["xp_ganho"] == 0, "  e nao paga por clique")
    j = clicar(mid).json()
    ok(j["meta_cumprida"] is True, "no 5o, cumpriu")
    ok(j["status"] == "CONCLUIDA", "  e a missao fechou")
    ok((j.get("resultado") or {}).get("xp_ganho", 0) > 0,
       "  pagando a missao inteira")
    # `expire_all` ANTES de ler: a sessao do teste tem o usuario no mapa
    # de identidade, e o XP foi mudado pelo request, noutra sessao. Ler
    # sem expirar devolveria o valor de antes do pagamento — e o assert
    # acusaria pagamento duplo onde nao houve.
    db.expire_all()
    xp_apos = db.query(Usuario).get(u.id).xp_total
    cli.post("/api/execucoes/desfazer-repeticao", json={"tarefa_id": mid}, headers=H)
    clicar(mid)
    db.expire_all()
    ok(db.query(Usuario).get(u.id).xp_total == xp_apos,
       "desfazer e refazer nao paga duas vezes — o status e a trava aqui tambem")

    # ══ 7. A PASSIVA AVULSA ══════════════════════════════════════
    print("\n-- a passiva avulsa --")
    r = nova(titulo="Sem cafe na vespera da prova", natureza="PASSIVA",
             hora_inicio="16:00", hora_limite="23:00")
    ok(r.status_code in (200, 201),
       f"cria protocolo para UM dia ({r.status_code}) — a vespera de uma prova "
       "e um protocolo legitimo")
    p = r.json()
    ok(p["natureza"] == "PASSIVA", "a natureza grava")
    ok(p["hora_inicio"] == "16:00", "com o inicio da janela")
    ok(p["hora_fim"] == "23:00",
       "e o fim vindo do `hora_limite` que ja existia — sem coluna duplicada")

    r = nova(titulo="Protocolo sem janela", natureza="PASSIVA")
    ok(r.status_code == 400,
       "passiva SEM janela: 400 — seria um protocolo que se cumpre sozinho "
       "a meia-noite, XP de graca")

    # ══ 8. AS BORDAS ═════════════════════════════════════════════
    print("\n-- bordas --")
    comum = nova(titulo="Missao comum").json()["id"]
    ok(cli.post("/api/execucoes/repetir", json={"tarefa_id": comum},
                headers=H).status_code == 400,
       "clicar 'repetir' numa missao geral comum: 400")
    ok(cli.post("/api/execucoes/repetir", json={"tarefa_id": 999999},
                headers=H).status_code == 404, "tarefa inexistente: 404")
    ok(cli.post("/api/execucoes/repetir", json={}, headers=H).status_code == 400,
       "sem rotina_id nem tarefa_id: 400, em vez de somar no vazio")

    outro = (db.query(Usuario)
               .filter(Usuario.id != u.id, Usuario.ativo == True).first())
    if outro:
        outro.senha_hash = hash_senha("teste123")
        db.commit()
        t2 = cli.post("/api/auth/login",
                      data={"username": outro.login, "password": "teste123"})
        H2 = {"Authorization": "Bearer " + t2.json()["access_token"]}
        ok(cli.post("/api/execucoes/repetir", json={"tarefa_id": tid},
                    headers=H2).status_code == 404,
           "e contar na missao geral de outro hunter: 404")

    # ══ 9. A REPETICAO CONTINUA LIVRE ════════════════════════════
    print("\n-- permissao --")
    class _Comum:
        nivel_acesso = "User"
    ok(especiais.pode_criar(_Comum(), "REPETICAO"),
       "o hunter comum cria repeticao — na tarefa como na rotina")
    ok(not especiais.pode_criar(_Comum(), "PASSIVA"),
       "  e a passiva continua da Staff, tambem nas duas")

    db.close()
    print(f"\n=== {'TUDO PASSOU' if not falhas else str(falhas) + ' FALHA(S)'} ===")
    return 1 if falhas else 0


if __name__ == "__main__":
    raise SystemExit(rodar())
