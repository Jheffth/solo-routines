# -*- coding: utf-8 -*-
"""
A CORRENTE E A PLACA DA PENITÊNCIA.

Dois mostradores para mecânicas que já estavam vivas e invisíveis.

O QUE ESTE TESTE PROTEGE, EM ORDEM DE IMPORTÂNCIA

1. DIA SEM REGISTRO NUNCA VIRA FALHA.
   Antes desta versão o app não gravava histórico. Pintar esses dias de
   vermelho seria o Sistema inventando fracassos que nunca aconteceram —
   mentir sobre o passado do hunter para preencher um gráfico. São três
   estados, e o terceiro é o que impede a mentira.

2. O DESENHO NÃO PODE CONTRADIZER O NÚMERO.
   Verde = existe `Execucao` no dia, que é exatamente a condição usada
   por `atualizar_streak` para manter a corrente viva. Um critério mais
   severo ("cumpriu TODAS") mostraria elos quebrados sob um streak de
   cinco, e o hunter concluiria — com razão — que um dos dois mente.

3. O MULTIPLICADOR EXIBIDO É O MULTIPLICADOR COBRADO.
   A regra `+5%/dia, teto 2x` estava só dentro de `calcular_bonus_streak`.
   Agora a tela a mostra. Se o router recalculasse por conta própria, a
   placa mentiria sobre o XP no dia em que a Balança calibrasse os
   números. Há assert amarrando os dois.

Uso: DATABASE_URL=sqlite:///./x.db SECRET_KEY=... python test_corrente.py
"""
from datetime import timedelta

import main                                     # noqa: F401
from fastapi.testclient import TestClient
from database import (SessionLocal, Usuario, Rotina, ExecucaoDia, TarefaDia,
                      Execucao, Pacto)
from motors import tempo, gamificacao, economia
from routers import dashboard as rd

falhas = testes = 0


def ok(cond, msg):
    global falhas, testes
    testes += 1
    if not cond:
        falhas += 1
    print(("  [ok]  " if cond else "  [XX]  ") + msg)


def limpar(db, u):
    for r in db.query(Rotina).filter_by(usuario_id=u.id).all():
        db.query(ExecucaoDia).filter_by(rotina_id=r.id).delete()
        db.delete(r)
    db.query(TarefaDia).filter_by(usuario_id=u.id).delete()
    db.query(Execucao).filter_by(usuario_id=u.id).delete()
    db.query(Pacto).filter_by(usuario_id=u.id).delete()
    db.commit()


def rodar():
    print("\n=== A CORRENTE E A PLACA ===\n")
    cli = TestClient(main.app)
    with cli:
        pass
    db = SessionLocal()
    u = db.query(Usuario).filter_by(nivel_acesso="Arquiteto").first()
    if not u:
        u = db.query(Usuario).first()
    hoje = tempo.hoje()
    limpar(db, u)

    # ── O multiplicador: uma regra, um lugar ────────────────────────
    print("-- o multiplicador que ninguém via --")
    ok(gamificacao.multiplicador_streak(0) == 1.0, "streak 0 não multiplica nada (1.0)")
    ok(gamificacao.multiplicador_streak(5) == 1.25, "streak 5 vale 1.25x (+5% ao dia)")
    ok(gamificacao.multiplicador_streak(20) == 2.0, "streak 20 bate o teto: 2.0x")
    ok(gamificacao.multiplicador_streak(500) == 2.0, "e o teto SEGURA — 500 dias ainda é 2.0x")
    ok(gamificacao.multiplicador_streak(-3) == 1.0, "streak negativo não quebra a conta")

    # O elo que impede a tela de mentir: o número exibido tem de sair da
    # MESMA função que cobra o bônus no XP real.
    base = 1000
    for s in (0, 1, 7, 19, 20, 33):
        esperado = int(base * gamificacao.multiplicador_streak(s)) - base
        ok(gamificacao.calcular_bonus_streak(base, s) == esperado,
           f"streak {s}: o bônus cobrado ({esperado} XP) sai do multiplicador exibido")

    ok(gamificacao.dias_ate_o_teto_do_streak(5) == 15, "faltam 15 dias para o dobro, com streak 5")
    ok(gamificacao.dias_ate_o_teto_do_streak(20) == 0, "e zero quando já está no teto")

    # ── A corrente: três estados ────────────────────────────────────
    print("\n-- os três estados do dia --")
    r = Rotina(usuario_id=u.id, titulo="Diária", tipo="DIARIA", ativo=True,
               prioridade="ALTA", dificuldade="NORMAL", status="ATIVA")
    db.add(r); db.commit(); db.refresh(r)

    # d-1: exigiu e cumpriu       → CUMPRIDO
    # d-2: exigiu e não cumpriu   → QUEBROU
    # d-3: nada aconteceu         → SEM_REGISTRO
    d1, d2, d3 = hoje - timedelta(days=1), hoje - timedelta(days=2), hoje - timedelta(days=3)
    db.add(ExecucaoDia(rotina_id=r.id, usuario_id=u.id, data=d1, status="CONCLUIDA"))
    db.add(Execucao(usuario_id=u.id, rotina_id=r.id, data_execucao=d1, xp_ganho=50))
    db.add(ExecucaoDia(rotina_id=r.id, usuario_id=u.id, data=d2, status="FRACASSADA"))
    db.commit()

    resp = rd.corrente(dias=7, db=db, usuario=u)
    porData = {d["data"]: d["estado"] for d in resp["dias"]}

    ok(porData[d1.isoformat()] == "CUMPRIDO", "dia com execução → CUMPRIDO")
    ok(porData[d2.isoformat()] == "QUEBROU", "dia que exigiu e não teve execução → QUEBROU")
    ok(porData[d3.isoformat()] == "SEM_REGISTRO",
       "dia em que o Sistema não pediu nada → SEM_REGISTRO, não falha")

    vermelhos = [d for d in resp["dias"] if d["estado"] == "QUEBROU"]
    ok(len(vermelhos) == 1,
       f"UM único dia vermelho — o resto do vazio não virou fracasso ({len(vermelhos)})")

    ok(len(resp["dias"]) == 7, "a janela devolve os 7 dias pedidos")
    ok(resp["dias"][-1]["data"] == hoje.isoformat(), "e termina em HOJE, à direita")
    ok(resp["dias"][0]["data"] == (hoje - timedelta(days=6)).isoformat(),
       "começando 6 dias atrás, à esquerda")

    # ── Cumprir UMA basta, porque é a regra do próprio streak ───────
    print("\n-- verde não exige perfeição (nem poderia) --")
    # `execucao_dia` tem UNIQUE(rotina_id, usuario_id, data): uma rotina
    # rende UMA instância por dia. Para ter três missões no mesmo dia são
    # precisas três rotinas — a constraint do banco ensinou isso aqui.
    d4 = hoje - timedelta(days=4)
    trio = []
    for i in range(3):
        x = Rotina(usuario_id=u.id, titulo=f"Diária {i}", tipo="DIARIA", ativo=True,
                   prioridade="ALTA", dificuldade="NORMAL", status="ATIVA")
        db.add(x); trio.append(x)
    db.commit()
    db.add(ExecucaoDia(rotina_id=trio[0].id, usuario_id=u.id, data=d4, status="CONCLUIDA"))
    db.add(ExecucaoDia(rotina_id=trio[1].id, usuario_id=u.id, data=d4, status="FRACASSADA"))
    db.add(ExecucaoDia(rotina_id=trio[2].id, usuario_id=u.id, data=d4, status="FRACASSADA"))
    db.add(Execucao(usuario_id=u.id, rotina_id=trio[0].id, data_execucao=d4, xp_ganho=10))
    db.commit()
    e = {d["data"]: d["estado"] for d in rd.corrente(dias=7, db=db, usuario=u)["dias"]}
    ok(e[d4.isoformat()] == "CUMPRIDO",
       "1 cumprida e 2 fracassadas ainda é CUMPRIDO — é o que mantém o streak vivo")

    # ── Missão geral também acende o elo ────────────────────────────
    d5 = hoje - timedelta(days=5)
    t = TarefaDia(titulo="Geral", data_prevista=d5, prioridade="ALTA",
                  categoria="Pessoal", status="PENDENTE", usuario_id=u.id)
    db.add(t); db.commit()
    e = {d["data"]: d["estado"] for d in rd.corrente(dias=7, db=db, usuario=u)["dias"]}
    ok(e[d5.isoformat()] == "QUEBROU",
       "missão geral pendente também faz o dia EXIGIR — some do cinza")

    # ── Limites da janela ───────────────────────────────────────────
    print("\n-- a janela não estoura --")
    ok(len(rd.corrente(dias=0,    db=db, usuario=u)["dias"]) == 1, "dias=0 vira 1")
    ok(len(rd.corrente(dias=9999, db=db, usuario=u)["dias"]) == 365, "dias=9999 trava em 365")

    # ── A placa da penitência ───────────────────────────────────────
    print("\n-- a placa da penitência --")
    regras = economia.punicao_regras(db)
    p = rd.resumo_penitencia(db=db, usuario=u)
    ok(p["abertas"] == 0, "sem dívidas: zero em aberto")
    ok(p["teto"] == regras["divida_teto"], f"o teto vem da Balança ({p['teto']})")
    ok(p["no_teto"] is False, "e não estamos nele")
    ok(p["tem_pacto"] is False, "sem pacto, e a placa diz isso em vez de mentir zero")
    ok(p["abate_por_missao"] == regras["abate_por_missao"],
       f"o abate por missão também vem da Balança ({p['abate_por_missao']})")

    # Enche até o teto e confirma que a placa acusa.
    for i in range(regras["divida_teto"]):
        d = TarefaDia(titulo=f"Faça {30 + i} flexões", data_prevista=hoje,
                      prioridade="ALTA", categoria="Combate", status="PENDENTE",
                      usuario_id=u.id, alvo_repeticoes=30 + i)
        d.natureza = "PUNICAO"
        d.origem_data = hoje
        db.add(d)
    db.commit()

    p = rd.resumo_penitencia(db=db, usuario=u)
    ok(p["abertas"] == regras["divida_teto"],
       f"{p['abertas']} dívidas abertas contadas")
    ok(p["no_teto"] is True,
       "NO TETO — o Sistema parou de criar, e agora a tela conta isso")

    # ── Decaimento: o caminho de volta, visível ─────────────────────
    print("\n-- o caminho de volta --")
    pac = Pacto(usuario_id=u.id, titulo="Faça {n} flexões", tipo="QUANTITATIVA",
                base=30, valor_atual=60, teto=200, ativo=True,
                ultima_queda=hoje - timedelta(days=2), ciclo=0, vezes_caiu=1)
    db.add(pac); db.commit()
    p = rd.resumo_penitencia(db=db, usuario=u)
    esperado = regras["decaimento_dias"] - 2
    ok(p["dias_para_decair"] == esperado,
       f"faltam {esperado} dias para a severidade recuar um degrau")
    ok(p["decaimento_dias"] == regras["decaimento_dias"],
       "e o tamanho do degrau é o da Balança, não um número inventado aqui")

    # Pacto já na base não tem o que devolver — não deve entrar na conta.
    pac.valor_atual = pac.base
    db.commit()
    p = rd.resumo_penitencia(db=db, usuario=u)
    ok(p["dias_para_decair"] is None,
       "pacto já na base não anuncia decaimento — não há o que decair")

    # ── O XP da semana depois do GROUP BY ───────────────────────────
    print("\n-- o gráfico de XP, agora em uma query --")
    s = rd.dashboard_stats(db=db, usuario=u)
    ok(len(s["xp_semana"]) == 7, "sete dias, sempre — inclusive os sem execução")
    dias_xp = {x["data"]: x["xp"] for x in s["xp_semana"]}
    ok(dias_xp.get(d1.isoformat()) == 50, "o dia com 50 XP aparece com 50")
    ok(dias_xp.get(d3.isoformat()) == 0, "e o dia sem execução aparece como 0, não some")
    ok([x["data"] for x in s["xp_semana"]] == sorted(x["data"] for x in s["xp_semana"]),
       "em ordem crescente, do mais antigo ao mais novo")

    limpar(db, u)
    db.close()
    print(f"\n=== {testes - falhas}/{testes} ===")
    return falhas


if __name__ == "__main__":
    import sys
    sys.exit(1 if rodar() else 0)
