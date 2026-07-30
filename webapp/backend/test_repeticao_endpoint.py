# -*- coding: utf-8 -*-
"""
O endpoint de repeticao — onde o teto para de ser teoria.

Passo 4 do PLANO_MISSAO_REPETICAO. Aqui XP de verdade passa a existir,
entao a maior parte dos asserts e sobre o que NAO deve acontecer:

  · o teto nao vaza nem com 200 cliques
  · o teto e POR CONTADOR, e duas rotinas do mesmo contador dividem
  · o BONUS nao mexe no streak (senao a ofensiva vira enfeite)
  · o BONUS nao grava linha em `Execucao` (senao polui o historico E
    faz a rotina se achar concluida)
  · desfazer devolve EXATAMENTE o que aquele clique pagou
  · a META conclui uma vez so, mesmo desfazendo e refazendo

Uso: DATABASE_URL=sqlite:///./x.db SECRET_KEY=... python test_repeticao_endpoint.py
"""
from fastapi.testclient import TestClient
from datetime import timedelta

import main
from database import (SessionLocal, Contador, Rotina, ExecucaoDia, Execucao,
                      Usuario)
from motors import tempo, economia

falhas = 0


def ok(cond, msg):
    global falhas
    if not cond:
        falhas += 1
    print(("  [ok]  " if cond else "  [XX]  ") + msg)


def rodar():
    print("\n=== O ENDPOINT DE REPETICAO ===\n")
    cli = TestClient(main.app)
    with cli:
        pass
    db = SessionLocal()
    u = db.query(Usuario).filter_by(nivel_acesso="Arquiteto").first()

    # Limpeza: este teste roda muitas vezes no mesmo banco.
    hoje = tempo.hoje()
    for r in db.query(Rotina).filter(Rotina.usuario_id == u.id,
                                     Rotina.natureza == "REPETICAO").all():
        db.query(ExecucaoDia).filter_by(rotina_id=r.id).delete()
        db.query(Execucao).filter_by(rotina_id=r.id).delete()
        db.delete(r)
    db.query(Contador).filter_by(usuario_id=u.id).delete()
    db.commit()

    # Senha conhecida: o banco de teste pode vir de qualquer lugar.
    from auth.service import hash_senha
    u.senha_hash = hash_senha("teste123")
    db.commit()
    tok = cli.post("/api/auth/login",
                   data={"username": u.login, "password": "teste123"})
    ok(tok.status_code == 200, f"login do Arquiteto ({tok.status_code})")
    H = {"Authorization": "Bearer " + tok.json()["access_token"]}

    cont = Contador(usuario_id=u.id, nome="Questoes", unidade="questoes")
    db.add(cont)
    db.flush()

    def nova(titulo, alvo=None, xp=1, contador=True, intervalo=None):
        r = Rotina(titulo=titulo, tipo="DIARIA", categoria="Estudo",
                   prioridade="MEDIA", dificuldade="NORMAL",
                   natureza="REPETICAO", usuario_id=u.id, ativo=True,
                   alvo_repeticoes=alvo, xp_por_repeticao=xp,
                   intervalo_min_seg=intervalo,
                   contador_id=cont.id if contador else None)
        db.add(r)
        db.commit()
        return r

    def clicar(rid, n=1):
        for _ in range(n):
            r = cli.post("/api/execucoes/repetir", json={"rotina_id": rid},
                         headers=H)
        return r

    def desfazer(rid):
        return cli.post("/api/execucoes/desfazer-repeticao",
                        json={"rotina_id": rid}, headers=H)

    # ══ 1. BONUS: contar e pagar ═════════════════════════════════
    print("-- o contador simples (BONUS) --")
    b = nova("Beber agua", alvo=None, xp=1)
    r = clicar(b.id)
    ok(r.status_code == 200, f"primeiro clique responde 200 ({r.status_code})")
    j = r.json()
    ok(j["repeticoes"] == 1, "conta 1")
    ok(j["modo"] == "BONUS", "e se declara BONUS")
    ok(j["xp_ganho"] == 1, "pagando 1 XP, como o Arquiteto pediu")
    ok(j["alvo"] is None, "sem alvo — nao ha o que cumprir")
    ok(j["meta_cumprida"] is False, "  logo nunca 'cumprida'")

    xp0 = db.query(Usuario).get(u.id).xp_total
    clicar(b.id, 4)
    db.expire_all()
    ok(db.query(Usuario).get(u.id).xp_total == xp0 + 4,
       "quatro cliques, quatro XP no total do hunter")

    # ══ 2. O TETO, contra o `curl` ═══════════════════════════════
    print("\n-- o teto nao vaza --")
    t = economia.repeticao_tetos(db)
    clicar(b.id, 60)                       # 65 cliques no total
    db.expire_all()
    ed = db.query(ExecucaoDia).filter_by(rotina_id=b.id, data=hoje).first()
    ok(ed.repeticoes == 65, f"65 cliques contam 65 ({ed.repeticoes})")
    ok(ed.xp_repeticao_pago == t["por_dia"],
       f"mas pagam o teto: {ed.xp_repeticao_pago} XP, nao 65")

    j = clicar(b.id).json()
    ok(j["xp_ganho"] == 0, "no teto, o clique seguinte paga ZERO")
    ok(j["repeticoes"] == 66, "  e continua contando — o registro nao para")

    # ══ 3. O TETO E POR CONTADOR ═════════════════════════════════
    print("\n-- o teto e por contador, nao global --")
    b2 = nova("Mais questoes", alvo=None, xp=1)          # mesmo contador
    j = clicar(b2.id).json()
    ok(j["xp_ganho"] == 0,
       "outra rotina do MESMO contador ja nasce no teto — nao dobra a cota")

    fora = nova("Flexoes", alvo=None, xp=1, contador=False)
    j = clicar(fora.id).json()
    ok(j["xp_ganho"] == 1,
       "rotina de OUTRO balde paga normal — o teto nunca foi global")

    # ══ 4. O QUE O BONUS NAO PODE FAZER ══════════════════════════
    print("\n-- o BONUS nao e uma missao --")
    db.expire_all()
    n_exec = db.query(Execucao).filter_by(rotina_id=b.id).count()
    ok(n_exec == 0,
       f"66 cliques NAO viraram linha em `Execucao` ({n_exec}) — nem historico "
       "poluido, nem rotina se achando concluida")

    uu = db.query(Usuario).get(u.id)
    uu.streak_atual = 4
    uu.ultima_atividade = hoje - timedelta(days=1)
    db.commit()
    clicar(b.id)
    db.expire_all()
    uu = db.query(Usuario).get(u.id)
    ok(uu.streak_atual == 4,
       "e NAO mexeram no streak — o contador nao mantem a ofensiva viva")
    ok(uu.ultima_atividade == hoje - timedelta(days=1),
       "  nem carimbaram atividade no dia")

    # ══ 5. DESFAZER devolve o que aquele clique pagou ════════════
    print("\n-- desfazer --")
    # BALDE PROPRIO. Na primeira escrita este teste usou o contador
    # `cont`, que a esta altura ja estava no teto — os dois cliques
    # pagaram 0 e o desfazer devolveu 0, corretamente. O assert e que
    # estava errado. Para medir "devolve o que pagou" e preciso um
    # clique que tenha pago de verdade.
    d = nova("Alongar", alvo=None, xp=3, contador=False)
    clicar(d.id, 2)
    db.expire_all()
    antes_xp = db.query(Usuario).get(u.id).xp_total
    j = desfazer(d.id).json()
    db.expire_all()
    ok(j["repeticoes"] == 1, "volta para 1")
    ok(db.query(Usuario).get(u.id).xp_total == antes_xp - 3,
       "devolvendo os 3 XP daquele clique, nem mais nem menos")

    # A ARMADILHA: o clique que pagou MENOS por bater o teto.
    e = nova("Teto quebrado", alvo=None, xp=3, contador=False)
    clicar(e.id, 9)          # 9 x 3 = 27
    j = clicar(e.id).json()  # o 10o so cabe 3 -> fecha em 30
    ok(j["xp_ganho"] == 3, f"o 10o clique fecha o teto pagando 3 ({j['xp_ganho']})")
    j = clicar(e.id).json()
    ok(j["xp_ganho"] == 0, "o 11o paga 0")
    db.expire_all()
    antes_xp = db.query(Usuario).get(u.id).xp_total
    desfazer(e.id)
    db.expire_all()
    ok(db.query(Usuario).get(u.id).xp_total == antes_xp,
       "desfazer um clique que pagou ZERO devolve ZERO — nao os 3 do preco cheio")

    # ══ 6. META: conta, conclui e pune ═══════════════════════════
    print("\n-- a missao de META --")
    m = nova("Responder 5 questoes", alvo=5, xp=1)
    j = clicar(m.id).json()
    ok(j["modo"] == "META", "se declara META")
    ok(j["alvo"] == 5, "  com o alvo na resposta, para a barra saber em quantos")
    ok(j["xp_ganho"] == 0,
       "e NAO paga por clique: a recompensa e cumprir, nao apertar")

    db.expire_all()
    uu = db.query(Usuario).get(u.id)
    uu.streak_atual = 4
    uu.ultima_atividade = hoje - timedelta(days=1)
    db.commit()

    for _ in range(3):
        j = clicar(m.id).json()
    ok(j["meta_cumprida"] is False, "em 4/5 ainda nao cumpriu")
    j = clicar(m.id).json()
    ok(j["meta_cumprida"] is True, "no 5o, cumpriu")
    ok(j["status"] == "CONCLUIDA", "  e a execucao do dia virou CONCLUIDA")
    ok((j.get("resultado") or {}).get("xp_ganho", 0) > 0,
       "pagando a missao inteira de uma vez")

    db.expire_all()
    ok(db.query(Usuario).get(u.id).streak_atual == 5,
       "a META CONTA para o streak — ela tem meta definida, entao e missao")
    ok(db.query(Execucao).filter_by(rotina_id=m.id).count() == 1,
       "  e deixa UMA linha no historico, nao cinco")

    # A trava do duplo pagamento.
    xp_apos = db.query(Usuario).get(u.id).xp_total
    desfazer(m.id)
    j = clicar(m.id).json()
    db.expire_all()
    ok(j["meta_cumprida"] is False,
       "desfazer e refazer NAO conclui de novo — o status e a trava")
    ok(db.query(Usuario).get(u.id).xp_total == xp_apos,
       "  e portanto nao paga duas vezes pela mesma missao")

    # ══ 7. As bordas ═════════════════════════════════════════════
    print("\n-- bordas --")
    z = nova("Nada ainda", alvo=None, xp=1)
    ok(desfazer(z.id).status_code == 400,
       "desfazer sem nenhuma repeticao hoje: 400, nao -1")

    comum = db.query(Rotina).filter(Rotina.usuario_id == u.id,
                                    Rotina.natureza != "REPETICAO").first()
    if comum:
        r = cli.post("/api/execucoes/repetir",
                     json={"rotina_id": comum.id}, headers=H)
        ok(r.status_code == 400,
           "clicar 'repetir' numa rotina comum: 400 — o endpoint checa a natureza")

    r = cli.post("/api/execucoes/repetir", json={"rotina_id": 999999}, headers=H)
    ok(r.status_code == 404, "rotina inexistente: 404")
    r = cli.post("/api/execucoes/repetir", json={"rotina_id": z.id})
    ok(r.status_code in (401, 403), f"sem token: {r.status_code}")

    iv = nova("Com espera", alvo=None, xp=1, intervalo=60, contador=False)
    ok(clicar(iv.id).status_code == 200, "com intervalo minimo, o 1o clique passa")
    ok(clicar(iv.id).status_code == 429, "  e o 2o imediato leva 429")
    ok(desfazer(iv.id).status_code == 200,
       "  mas DESFAZER passa: corrigir erro nao pode ficar preso na espera")

    # ══ 8. O TOTAL DO CONTADOR ═══════════════════════════════════
    print("\n-- o total derivado --")
    from sqlalchemy import func
    esperado = int((db.query(func.sum(ExecucaoDia.repeticoes))
                      .join(Rotina, Rotina.id == ExecucaoDia.rotina_id)
                      .filter(Rotina.contador_id == cont.id).scalar()) or 0)
    j = clicar(b.id).json()
    ok(j["total_contador"] == esperado + 1,
       f"a resposta ja traz o total do contador ({j['total_contador']})")
    ok(j["total_contador"] > j["repeticoes"],
       "  somando TODAS as rotinas do balde, nao so a clicada")

    db.close()
    print(f"\n=== {'TUDO PASSOU' if not falhas else str(falhas) + ' FALHA(S)'} ===")
    return 1 if falhas else 0


if __name__ == "__main__":
    raise SystemExit(rodar())
