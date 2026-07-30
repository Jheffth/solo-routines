# -*- coding: utf-8 -*-
"""
A fundacao da missao de repeticao — os tetos, a natureza e o esquema.

Passos 1 a 3 do PLANO_MISSAO_REPETICAO. Nada de interface ainda: o que se
prova aqui e que a TORNEIRA NAO ABRE, que a natureza nova nao e engolida
pelo `normalizar()`, e que o banco velho vira o banco novo sem perder nada.

POR QUE OS TETOS VEM ANTES DE TUDO

O modo BONUS paga XP por clique. Sem os dois tetos, o primeiro teste do
endpoint de repeticao ja criaria XP de verdade num contador sem limite —
e este projeto ja teve um vazamento de XP que so foi descoberto quando o
grafico do Arquiteto disparou.

Uso: DATABASE_URL=sqlite:///./rep.db SECRET_KEY=... python test_repeticao_base.py
"""
from fastapi.testclient import TestClient
from sqlalchemy import inspect

import main
from database import SessionLocal, engine, Contador, Rotina, ExecucaoDia, Usuario
from motors import economia, especiais


def ok(cond, msg):
    print(("  [ok]  " if cond else "  [XX]  ") + msg)
    assert cond, msg


def rodar():
    print("\n=== A FUNDACAO DA MISSAO DE REPETICAO ===\n")

    with TestClient(main.app):
        pass
    db = SessionLocal()

    # ══ 1. OS TETOS ══════════════════════════════════════════════
    print("-- os dois tetos, antes de qualquer XP correr --")
    t = economia.repeticao_tetos(db)
    ok(t["por_clique"] == 3, f"teto por clique = {t['por_clique']}")
    ok(t["por_dia"] == 30, f"teto por dia, por contador = {t['por_dia']}")

    # A TORNEIRA. Uma rotina declarando 500 XP por clique nao paga 500.
    ok(economia.xp_da_repeticao(500, 0, db) == 3,
       "rotina pedindo 500 XP por clique paga 3 — o teto de entrada segura")
    ok(economia.xp_da_repeticao(1, 0, db) == 1,
       "e quem pede 1 recebe 1: o teto limita, nao nivela")

    # O teto do DIA: 30 pagos, o 31o clique paga zero.
    ok(economia.xp_da_repeticao(3, 29, db) == 1,
       "com 29 ja pagos hoje, o proximo clique paga so 1 (fecha em 30)")
    ok(economia.xp_da_repeticao(3, 30, db) == 0,
       "no teto do dia, o clique paga ZERO")
    ok(economia.xp_da_repeticao(3, 999, db) == 0,
       "e passar do teto nunca vira XP negativo")

    # A simulacao que prova o ponto: 500 cliques nao fazem 500 XP.
    pago, total = 0, 0
    for _ in range(500):
        x = economia.xp_da_repeticao(3, pago, db)
        pago += x
        total += x
    ok(total == 30,
       f"500 cliques num dia pagam {total} XP, nao 1500 — a torneira nao abre")

    # ══ 2. A NATUREZA ════════════════════════════════════════════
    print("\n-- REPETICAO no catalogo de naturezas --")
    ok(especiais.REPETICAO == "REPETICAO", "a constante existe")
    ok("REPETICAO" in especiais.NATUREZAS, "e esta no catalogo")
    ok(especiais.normalizar("REPETICAO") == "REPETICAO",
       "o normalizar() a reconhece")
    ok(especiais.normalizar("repeticao") == "REPETICAO",
       "  em minusculas tambem")
    ok(especiais.normalizar("qualquer-coisa") == "ATIVA",
       "  e o desconhecido continua virando ATIVA")

    # SEM PORTA. O premium nao entra agora; travar seria antecipar.
    ok(not especiais.eh_premium("REPETICAO"),
       "ela NAO e premium — nada aqui e travado")
    ok(especiais.eh_premium("PASSIVA"),
       "  enquanto a passiva continua sendo (essa nao mudou)")
    u = db.query(Usuario).filter_by(nivel_acesso="Arquiteto").first()
    ok(especiais.pode_criar(u, "REPETICAO"), "o Arquiteto pode criar")

    class _Comum:
        nivel_acesso = "User"
    ok(especiais.pode_criar(_Comum(), "REPETICAO"),
       "e o hunter comum TAMBEM — e essa e a diferenca para a passiva")
    ok(not especiais.pode_criar(_Comum(), "PASSIVA"),
       "  que ele continua nao podendo criar")

    # ══ 3. O ESQUEMA ═════════════════════════════════════════════
    print("\n-- as tabelas --")
    i = inspect(engine)
    ok("contadores" in i.get_table_names(), "a tabela `contadores` existe")

    cols = {c["name"] for c in i.get_columns("contadores")}
    ok(cols == {"id", "usuario_id", "nome", "unidade", "criado_em", "arquivado_em"},
       f"com as seis colunas e nada mais: {sorted(cols)}")
    ok("escopo" not in cols and "congelado_em" not in cols,
       "SEM `escopo` nem `congelado_em` — coluna sem regra atras e palpite no esquema")
    ok("total" not in cols,
       "e SEM `total`: ele e somado das execucoes, senao vira segunda verdade")

    rot = {c["name"] for c in i.get_columns("rotinas")}
    for c in ("alvo_repeticoes", "contador_id", "xp_por_repeticao", "intervalo_min_seg"):
        ok(c in rot, f"rotinas.{c}")
    ed = {c["name"] for c in i.get_columns("execucao_dia")}
    for c in ("repeticoes", "xp_repeticao_pago", "ultima_repeticao_em"):
        ok(c in ed, f"execucao_dia.{c}")

    # DEFAULT 0 importa: o cartao SOMA e COMPARA estes numeros. Um NULL
    # viraria `None + 1` em Python e `NULL > 0` em SQL — os dois erram em
    # silencio, cada um do seu jeito.
    defs = {c["name"]: c.get("default") for c in i.get_columns("execucao_dia")}
    ok(str(defs.get("repeticoes")).strip("'") == "0",
       "repeticoes nasce 0, nao NULL (o cartao soma este numero)")
    ok(str(defs.get("xp_repeticao_pago")).strip("'") == "0",
       "xp_repeticao_pago idem (o teto compara este numero)")

    # ══ 4. GRAVAR E SOMAR ════════════════════════════════════════
    print("\n-- o contador soma de verdade --")
    db.query(Contador).filter_by(usuario_id=u.id).delete()
    db.commit()

    c = Contador(usuario_id=u.id, nome="Fazer questões", unidade="questões")
    db.add(c)
    db.flush()

    from datetime import date, timedelta
    hoje = date.today()
    for i_dia, reps in enumerate([7, 12, 4]):
        r = Rotina(titulo=f"Questões dia {i_dia}", tipo="DIARIA", categoria="Estudo",
                   prioridade="MEDIA", dificuldade="NORMAL",
                   natureza="REPETICAO", contador_id=c.id, xp_por_repeticao=1,
                   usuario_id=u.id, ativo=True)
        db.add(r); db.flush()
        db.add(ExecucaoDia(rotina_id=r.id, usuario_id=u.id,
                           data=hoje - timedelta(days=i_dia),
                           status="ATIVA", repeticoes=reps))
    db.commit()

    # A CONSULTA QUE IMPORTA: soma por `contador_id` E NADA MAIS.
    # Nunca `AND usuario_id` — e isso que deixa a porta da guilda aberta.
    from sqlalchemy import func
    total = (db.query(func.sum(ExecucaoDia.repeticoes))
               .join(Rotina, Rotina.id == ExecucaoDia.rotina_id)
               .filter(Rotina.contador_id == c.id)
               .scalar()) or 0
    ok(total == 23, f"tres rotinas, tres dias, um contador: {total} questões")
    ok(len(db.query(Rotina).filter_by(contador_id=c.id).all()) == 3,
       "  vindas de rotinas diferentes, somando no mesmo lugar")

    db.close()
    print("\n=== fim ===")


if __name__ == "__main__":
    rodar()
