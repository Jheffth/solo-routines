# -*- coding: utf-8 -*-
"""
O EXTRATO fala a mesma lingua do cartao.

O BUG QUE ISTO CORRIGE

O Arquiteto lancou uma missao de repeticao pelo lancador novo, tudo
certo ate a gravacao — e recebeu no Extrato um cartao de missao comum.

A causa: `_missao_geral` cravava `"natureza": "ATIVA"` como CONSTANTE,
com um comentario meu dizendo "missao geral nunca e passiva". Era a
regra que confundia RECORRENCIA com NATUREZA, ja derrubada no lancador
e no banco — mas ela sobreviveu aqui porque estava escrita como
constante, e constante nao aparece quando se procura por quem LE o
campo.

E o Extrato era o TERCEIRO serializador do mesmo conceito. Eu tinha
atualizado `rotinas.py` e `tarefas.py` e nao sabia que existia um
terceiro.

O QUE ESTE TESTE PROTEGE

  · o Extrato devolve `natureza`, `alvo_repeticoes`, `repeticoes` e
    `contador_id` nas DUAS origens
  · e devolve os MESMOS nomes que o cartao le — um dicionario certo com
    nome errado e igual a nada
  · a passiva avulsa chega com a janela inteira
  · o total do contador vem sem N+1

Uso: DATABASE_URL=sqlite:///./x.db SECRET_KEY=... python test_extrato_natureza.py
"""
from fastapi.testclient import TestClient

import main
from database import (SessionLocal, Contador, Rotina, ExecucaoDia, TarefaDia,
                      Usuario)
from auth.service import hash_senha
from motors import tempo

falhas = 0


def ok(cond, msg):
    global falhas
    if not cond:
        falhas += 1
    print(("  [ok]  " if cond else "  [XX]  ") + msg)


def rodar():
    print("\n=== O EXTRATO E AS NATUREZAS ===\n")
    cli = TestClient(main.app)
    with cli:
        pass
    db = SessionLocal()
    u = db.query(Usuario).filter_by(nivel_acesso="Arquiteto").first()
    db.query(TarefaDia).filter_by(usuario_id=u.id).delete()
    for r in db.query(Rotina).filter(Rotina.usuario_id == u.id).all():
        db.query(ExecucaoDia).filter_by(rotina_id=r.id).delete()
        db.delete(r)
    db.query(Contador).delete()
    u.senha_hash = hash_senha("teste123")
    db.commit()
    tok = cli.post("/api/auth/login",
                   data={"username": u.login, "password": "teste123"})
    H = {"Authorization": "Bearer " + tok.json()["access_token"]}
    hoje = tempo.hoje()

    def extrato():
        d = cli.get("/api/extrato/", headers=H).json()
        linhas = d if isinstance(d, list) else d.get("missoes", d.get("itens", []))
        return {x["titulo"]: x for x in linhas}

    cont = cli.post("/api/contadores", json={"nome": "Questoes de Leis",
                                             "unidade": "questoes"}, headers=H).json()

    # ══ 1. O CASO EXATO DO ARQUITETO ═════════════════════════════
    print("-- a missao que o Arquiteto lancou --")
    t = cli.post("/api/tarefas/", headers=H, json={
        "titulo": "Responder 2 questoes de Leis",
        "data_prevista": hoje.isoformat(), "prioridade": "ALTA",
        "categoria": "Estudo", "dificuldade": "NORMAL",
        "natureza": "REPETICAO", "alvo_repeticoes": 2,
        "contador_id": cont["id"]}).json()
    cli.post("/api/execucoes/repetir", json={"tarefa_id": t["id"]}, headers=H)

    m = extrato()["Responder 2 questoes de Leis"]
    ok(m["natureza"] == "REPETICAO",
       "o Extrato devolve REPETICAO — aqui estava cravado 'ATIVA' como constante, "
       "e era por isso que o cartao saia comum")
    ok(m["alvo_repeticoes"] == 2, "com o alvo (2), sem o qual nao ha segmentos")
    ok(m["repeticoes"] == 1, "e a contagem de hoje (1)")
    ok(m["contador_id"] == cont["id"], "e o balde")
    ok(m.get("total_contador") == 1, "mais o total acumulado, que a caixa mostra")
    ok(m.get("unidade_contador") == "questoes", "com a unidade do contador")

    # ══ 2. OS NOMES SAO OS QUE O CARTAO LE ═══════════════════════
    print("\n-- os nomes batem com o cartao --")
    # O cartao (missao-card.js) le exatamente estes. Um dicionario certo
    # com nome errado e igual a nao mandar nada — e falha em silencio.
    import re, os
    fonte = open(os.path.join(os.path.dirname(__file__), "..", "frontend",
                              "js", "missao-card.js"), encoding="utf-8").read()
    for campo in ("alvo_repeticoes", "repeticoes", "total_contador",
                  "unidade_contador", "natureza"):
        ok(f"m.{campo}" in fonte or f'"{campo}"' in fonte,
           f"o cartao le `{campo}` — e o Extrato manda com esse nome")
        ok(campo in m, f"  presente na resposta")

    # ══ 3. O MODO LIVRE ══════════════════════════════════════════
    print("\n-- o contador livre --")
    t2 = cli.post("/api/tarefas/", headers=H, json={
        "titulo": "Questoes avulsas", "data_prevista": hoje.isoformat(),
        "prioridade": "MEDIA", "categoria": "Estudo", "dificuldade": "NORMAL",
        "natureza": "REPETICAO", "contador_id": cont["id"]}).json()
    for _ in range(5):
        cli.post("/api/execucoes/repetir", json={"tarefa_id": t2["id"]}, headers=H)
    m2 = extrato()["Questoes avulsas"]
    ok(m2["alvo_repeticoes"] is None,
       "sem alvo — e o que faz o cartao desenhar a caixa em vez da barra")
    ok(m2["repeticoes"] == 5, "com a contagem (5)")
    ok(m2["total_contador"] == 6, "e o total do balde somando as duas missoes (6)")

    # ══ 4. A PASSIVA AVULSA ══════════════════════════════════════
    print("\n-- o protocolo de um dia --")
    cli.post("/api/tarefas/", headers=H, json={
        "titulo": "Sem cafe na vespera", "data_prevista": hoje.isoformat(),
        "prioridade": "BAIXA", "categoria": "Saude", "dificuldade": "NORMAL",
        "natureza": "PASSIVA", "hora_inicio": "16:00", "hora_limite": "23:00"})
    p = extrato()["Sem cafe na vespera"]
    ok(p["natureza"] == "PASSIVA", "chega como PASSIVA")
    ok(p["hora_inicio"] == "16:00",
       "COM a hora de inicio — ela era `None` fixo, e sem ela o cartao nao "
       "sabe quando o protocolo entra em vigor")
    ok(p["hora_fim"] == "23:00", "e o fim, que ja vinha do hora_limite")
    ok("confessada_em" in p, "e o campo da confissao existe")

    # ══ 5. A ROTINA TAMBEM ═══════════════════════════════════════
    print("\n-- e a rotina, pela outra origem --")
    r = cli.post("/api/rotinas/", headers=H, json={
        "titulo": "Questoes diarias", "tipo": "DIARIA", "categoria": "Estudo",
        "prioridade": "MEDIA", "dificuldade": "NORMAL",
        "natureza": "REPETICAO", "alvo_repeticoes": 3,
        "contador_id": cont["id"]}).json()
    cli.post("/api/execucoes/repetir", json={"rotina_id": r["id"]}, headers=H)
    cli.post("/api/execucoes/repetir", json={"rotina_id": r["id"]}, headers=H)
    mr = extrato()["Questoes diarias"]
    ok(mr["natureza"] == "REPETICAO", "a rotina tambem chega certa")
    ok(mr["alvo_repeticoes"] == 3, "  com o alvo")
    ok(mr["repeticoes"] == 2,
       "e a contagem vinda da INSTANCIA DO DIA, nao da rotina — a rotina se "
       "repete, entao cada dia tem o seu numero")

    # ══ 6. A MISSAO COMUM NAO REGREDIU ═══════════════════════════
    print("\n-- a missao comum continua comum --")
    cli.post("/api/tarefas/", headers=H, json={
        "titulo": "Missao de sempre", "data_prevista": hoje.isoformat(),
        "prioridade": "MEDIA", "categoria": "Casa", "dificuldade": "NORMAL"})
    mc = extrato()["Missao de sempre"]
    ok(mc["natureza"] == "ATIVA", "sem natureza declarada, continua ATIVA")
    ok(mc["alvo_repeticoes"] is None, "  sem alvo")
    ok(mc["repeticoes"] == 0, "  e contagem zero, nao None (o cartao soma este numero)")
    ok("total_contador" not in mc,
       "  e SEM total: missao sem balde nao carrega campo de balde")

    db.close()
    print(f"\n=== {'TUDO PASSOU' if not falhas else str(falhas) + ' FALHA(S)'} ===")
    return 1 if falhas else 0


if __name__ == "__main__":
    raise SystemExit(rodar())
