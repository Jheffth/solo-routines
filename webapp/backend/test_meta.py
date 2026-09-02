# -*- coding: utf-8 -*-
"""
A MISSÃO DE META — chegar a um número, somando ou medindo.

O QUE ESTE ARQUIVO EXISTE PARA PRENDER

1. AS DUAS MATEMÁTICAS NÃO PODEM SE MISTURAR.
   Somar pesagens dá 164,5 kg e ninguém percebe até a segunda medição.
   É o assert mais importante daqui: se um refactor fizer a MEDIÇÃO
   acumular, nada explode — só o número fica absurdo, e absurdo em
   silêncio é o que mais custou tempo neste projeto.

2. O SENTIDO DA MEDIÇÃO SAI DOS DADOS, não de um campo a mais.
   Quem sai de 85 rumo a 78 bate ao ficar ABAIXO; quem sai de 60 rumo a
   70 bate ao ficar ACIMA. Um `>=` fixo daria a meta de emagrecimento
   por cumprida no primeiro dia, antes de perder um grama.

3. DESFAZER TEM DE VOLTAR AO ESTADO ANTERIOR, exatamente.
   Digitar 3259 no lugar de 32,59 é o erro mais provável desta tela.

4. O XP CAI UMA VEZ SÓ, ao alcançar. Desfazer e refazer não paga duas.

Uso: DATABASE_URL=sqlite:///./x.db SECRET_KEY=... python test_meta.py
"""
from datetime import datetime, timedelta

import main                                     # noqa: F401  (cria o schema)
from fastapi.testclient import TestClient
from database import SessionLocal, Usuario, Rotina, ExecucaoDia, TarefaDia, MetaAporte
from motors import tempo, meta as M

falhas = testes = 0


def ok(cond, msg):
    global falhas, testes
    testes += 1
    if not cond:
        falhas += 1
    print(("  [ok]  " if cond else "  [XX]  ") + msg)


def rodar():
    print("\n=== A MISSÃO DE META ===\n")
    cli = TestClient(main.app)
    with cli:
        pass
    db = SessionLocal()
    u = db.query(Usuario).filter_by(nivel_acesso="Arquiteto").first()
    hoje = tempo.hoje()

    from routers import execucoes as ex

    def limpar():
        db.query(MetaAporte).filter_by(usuario_id=u.id).delete()
        for r in db.query(Rotina).filter(Rotina.usuario_id == u.id).all():
            db.query(ExecucaoDia).filter_by(rotina_id=r.id).delete()
            db.delete(r)
        db.commit()

    def cria(titulo, alvo, especie, modo=None, inicial=None, xp=120):
        r = Rotina(usuario_id=u.id, titulo=titulo, tipo="DIARIA", ativo=True,
                   natureza="META", meta_alvo=alvo, meta_especie=especie,
                   meta_modo=modo, meta_inicial=inicial,
                   prioridade="ALTA", dificuldade="NORMAL", status="ATIVA",
                   xp_recompensa=xp, moedas_recompensa=10,
                   criado_em=datetime.utcnow() - timedelta(days=2))
        db.add(r)
        db.commit()
        db.refresh(r)
        return r

    class Reg:
        def __init__(s, rid, valor):
            s.rotina_id, s.tarefa_id, s.valor, s.nota = rid, None, valor, None

    class Desf:
        def __init__(s, rid):
            s.rotina_id, s.tarefa_id = rid, None

    # ══ 1. ACÚMULO — os números do Arquiteto ═════════════════════════
    print("-- acúmulo: 32,59 + 31,78 rumo a R$ 100 --")
    limpar()
    r = cria("Ganhar 100 no turno da manhã", 100.0, "VALOR")

    resp = ex.meta_registrar(Reg(r.id, 32.59), db=db, usuario=u)
    ok(abs(resp["meta_atual"] - 32.59) < 1e-9,
       f"primeiro aporte: {resp['meta_texto']}")
    resp = ex.meta_registrar(Reg(r.id, 31.78), db=db, usuario=u)
    ok(abs(resp["meta_atual"] - 64.37) < 1e-9,
       f"SOMOU o segundo: {resp['meta_texto']} (32,59 + 31,78)")
    ok(resp["meta_texto"] == "R$ 64,37",
       f"e escreve como dinheiro: {resp['meta_texto']}")
    ok(abs(resp["meta_progresso"] - 0.6437) < 1e-6,
       f"progresso {resp['meta_progresso']*100:.2f}%")
    ok(resp["meta_cumprida"] is False, "ainda não bateu")
    ok(len(resp["meta_aportes"]) == 2, "o livro guarda os DOIS lançamentos")

    print("\n-- desfazer o erro de digitação --")
    # 3259 em vez de 32,59: o alvo estoura, a missão conclui e o XP cai.
    # É o caminho mais provável do defeito real, e foi este teste que o
    # encontrou — a primeira versão do desfazer devolvia o saldo e
    # deixava a missão CONCLUÍDA, com XP pago por um valor inexistente.
    xp_antes = u.xp_total or 0
    ex.meta_registrar(Reg(r.id, 3259), db=db, usuario=u)
    db.refresh(u)
    ok((u.xp_total or 0) > xp_antes, "o dedo gordo concluiu a missão e pagou XP")

    ed_erro = db.query(ExecucaoDia).filter_by(rotina_id=r.id, data=hoje).first()
    pago_pela_missao = int(ed_erro.xp_ganho or 0)
    xp_depois_do_erro = u.xp_total or 0

    d = ex.meta_desfazer(Desf(r.id), db=db, usuario=u)
    db.refresh(u)
    ok(abs(d["meta_atual"] - 64.37) < 1e-9,
       f"voltou EXATAMENTE ao estado anterior: {d['meta_texto']}")
    ok(len(d["meta_aportes"]) == 2, "e o livro também")
    ok(d.get("reabriu") is True and d["status"] == "ATIVA",
       "e a missão foi REABERTA — cumprida por engano não é cumprida")
    ok((u.xp_total or 0) == xp_depois_do_erro - pago_pela_missao,
       f"o XP QUE A MISSÃO PAGOU foi devolvido ({pago_pela_missao})")

    # NÃO É O TOTAL QUE VOLTA, e isto é decisão, não descuido.
    # Medindo: o XP subiu 2426 enquanto a missão pagou 126 — a diferença
    # foram CONQUISTAS que o crédito disparou. Elas ficam. Revogar
    # conquista significaria tirar insígnia e aura já celebradas por
    # causa de um erro de digitação, mentira maior que a imprecisão.
    ok((u.xp_total or 0) >= xp_antes,
       "as conquistas disparadas pelo caminho NÃO são revogadas")

    print("\n-- alcançar o alvo paga o XP, uma vez só --")
    xp0 = u.xp_total or 0
    resp = ex.meta_registrar(Reg(r.id, 40), db=db, usuario=u)
    db.refresh(u)
    ok(resp["meta_cumprida"] is True, f"bateu com {resp['meta_texto']}")
    ok(resp["status"] == "CONCLUIDA", "a missão foi concluída")
    ganho = (u.xp_total or 0) - xp0
    ok(ganho > 0, f"o XP caiu ({ganho})")

    xp1 = u.xp_total or 0
    ex.meta_registrar(Reg(r.id, 10), db=db, usuario=u)
    db.refresh(u)
    ok((u.xp_total or 0) == xp1,
       "somar depois de concluída NÃO paga de novo — o status é a trava")

    # ══ 2. MEDIÇÃO — emagrecer ═══════════════════════════════════════
    print("\n-- medição: 85 kg rumo a 78 (o alvo é MENOR) --")
    limpar()
    r = cria("Chegar a 78 kg", 78.0, "PESO", inicial=85.0)
    ok(M.modo(r.meta_modo, r.meta_especie) == M.MEDICAO,
       "PESO nasce em modo MEDIÇÃO sem ninguém precisar dizer")

    a = ex.meta_registrar(Reg(r.id, 82.4), db=db, usuario=u)
    b = ex.meta_registrar(Reg(r.id, 82.1), db=db, usuario=u)
    ok(abs(b["meta_atual"] - 82.1) < 1e-9,
       f"a última pesagem SUBSTITUI a anterior: {b['meta_texto']}")
    ok(abs(b["meta_atual"] - 164.5) > 1,
       "e NÃO somou — 82,4 + 82,1 = 164,5 kg seria o absurdo que o modo evita")
    ok(b["meta_cumprida"] is False, "82,1 ainda não é 78")

    c = ex.meta_registrar(Reg(r.id, 77.8), db=db, usuario=u)
    ok(c["meta_cumprida"] is True,
       "ficar ABAIXO do alvo cumpre — quem emagrece bate por baixo")

    print("\n-- medição: desfazer volta à leitura anterior --")
    limpar()
    r = cria("Chegar a 78 kg", 78.0, "PESO", inicial=85.0)
    ex.meta_registrar(Reg(r.id, 84.0), db=db, usuario=u)
    ex.meta_registrar(Reg(r.id, 83.2), db=db, usuario=u)
    d = ex.meta_desfazer(Desf(r.id), db=db, usuario=u)
    ok(abs(d["meta_atual"] - 84.0) < 1e-9,
       f"voltou para a pesagem anterior: {d['meta_texto']}")
    d = ex.meta_desfazer(Desf(r.id), db=db, usuario=u)
    ok(abs(d["meta_atual"] - 85.0) < 1e-9,
       "e sem aporte nenhum volta ao PONTO DE PARTIDA, não a zero — "
       "zero kg seria pior que errado")

    # ══ 3. MEDIÇÃO — engordar, o sentido oposto ══════════════════════
    print("\n-- medição: 60 kg rumo a 70 (o alvo é MAIOR) --")
    limpar()
    r = cria("Chegar a 70 kg", 70.0, "PESO", inicial=60.0)
    x = ex.meta_registrar(Reg(r.id, 65), db=db, usuario=u)
    ok(abs(x["meta_progresso"] - 0.5) < 1e-9,
       f"metade do caminho ({x['meta_progresso']*100:.0f}%) — a mesma "
       f"divisão serve para os dois sentidos")
    ok(x["meta_cumprida"] is False, "65 ainda não é 70")
    y = ex.meta_registrar(Reg(r.id, 70.2), db=db, usuario=u)
    ok(y["meta_cumprida"] is True, "ficar ACIMA cumpre quando o alvo é maior")

    # ══ 4. AS RECUSAS ════════════════════════════════════════════════
    print("\n-- o que o router recusa --")
    limpar()
    comum = Rotina(usuario_id=u.id, titulo="Comum", tipo="DIARIA", ativo=True,
                   natureza="ATIVA", prioridade="ALTA", dificuldade="NORMAL",
                   status="ATIVA", criado_em=datetime.utcnow())
    db.add(comum); db.commit(); db.refresh(comum)
    try:
        ex.meta_registrar(Reg(comum.id, 10), db=db, usuario=u)
        ok(False, "registrar numa missão que não é meta deveria falhar")
    except Exception as e:
        ok("meta" in str(e).lower(), "missão que não é meta é recusada")

    sem_alvo = cria("Sem alvo", None, "VALOR")
    try:
        ex.meta_registrar(Reg(sem_alvo.id, 10), db=db, usuario=u)
        ok(False, "meta sem alvo deveria falhar")
    except Exception as e:
        ok("meta" in str(e).lower(),
           "meta SEM ALVO é recusada — sem alvo a barra não tem fim e "
           "a missão não poderia ser cumprida nunca")

    limpar()
    db.close()
    print(f"\n=== {testes - falhas}/{testes} ===")
    return falhas


if __name__ == "__main__":
    import sys
    sys.exit(1 if rodar() else 0)
