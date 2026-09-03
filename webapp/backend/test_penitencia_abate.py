# -*- coding: utf-8 -*-
"""
DUAS MECÂNICAS DA PENITÊNCIA — o abatimento e a extinção.

1. CUMPRIR O DEVER ABATE A DÍVIDA
   Cada missão concluída tira um pedaço da barra da penitência mais
   antiga em aberto. Quem voltou aos trilhos já está pagando de alguma
   forma, e um Sistema que só aceita pagamento na moeda exata da punição
   empurra para longe justamente quem voltou.

   MAS NUNCA FECHA A ÚLTIMA UNIDADE. Se cumprir missões quitasse a
   penitência sozinha, ela deixaria de ser uma coisa a fazer e viraria
   um número que some. O passo final é sempre um ato do hunter.

2. EXTINGUIR NÃO É APAGAR — E ESTE ERA O DEFEITO
   A penitência extinta pelo Arquiteto era DELETADA do banco. Só que é
   a existência dessa linha que faz `_ja_julgado` dizer "este dia já foi
   julgado". Sumindo com ela, o dia voltava a ser julgável e o
   fechamento seguinte mandava uma penitência NOVA pela MESMA falha: o
   Arquiteto perdoava e o Sistema cobrava de novo, para sempre.

   É o assert mais importante deste arquivo, e o mais fácil de quebrar
   sem perceber — porque apagar "funciona": a penitência some da tela, e
   a outra só aparece no fechamento seguinte.

Uso: DATABASE_URL=sqlite:///./x.db SECRET_KEY=... python test_penitencia_abate.py
"""
from datetime import datetime, timedelta

import main                                     # noqa: F401
from fastapi.testclient import TestClient
from database import SessionLocal, Usuario, Rotina, ExecucaoDia, TarefaDia, Pacto
from motors import tempo, penitencia, economia, fechamento, especiais

falhas = testes = 0


def ok(cond, msg):
    global falhas, testes
    testes += 1
    if not cond:
        falhas += 1
    print(("  [ok]  " if cond else "  [XX]  ") + msg)


def rodar():
    print("\n=== ABATIMENTO E EXTINÇÃO ===\n")
    cli = TestClient(main.app)
    with cli:
        pass
    db = SessionLocal()
    u = db.query(Usuario).filter_by(nivel_acesso="Arquiteto").first()
    hoje = tempo.hoje()

    def limpar():
        db.query(TarefaDia).filter_by(usuario_id=u.id).delete()
        db.query(Pacto).filter_by(usuario_id=u.id).delete()
        for r in db.query(Rotina).filter(Rotina.usuario_id == u.id).all():
            db.query(ExecucaoDia).filter_by(rotina_id=r.id).delete()
            db.delete(r)
        db.commit()

    def penitencia_de(alvo, dia=None):
        """Uma penitência quantitativa em aberto, com barra."""
        t = TarefaDia(titulo=f"Fazer {alvo} flexões", data_prevista=hoje,
                      prioridade="ALTA", categoria="Combate", status="PENDENTE",
                      usuario_id=u.id, xp_recompensa=0, moedas_recompensa=0,
                      penalidade_xp=0, alvo_repeticoes=alvo, repeticoes=0)
        t.natureza = "PUNICAO"
        t.origem_data = dia or hoje
        t.origem_titulo = "Treino perdido"
        db.add(t); db.commit(); db.refresh(t)
        return t

    # ══ 1. O ABATIMENTO ══════════════════════════════════════════════
    print("-- concluir missões reduz a barra --")
    limpar()
    p = penitencia_de(10)
    regras = economia.punicao_regras(db)
    passo = regras["abate_por_missao"]
    ok(passo >= 1, f"a Balança define o abatimento ({passo} por missão)")

    for i in range(1, 4):
        penitencia.abater(db, u, passo)
        db.commit(); db.refresh(p)
    ok(p.repeticoes == 3 * passo,
       f"três missões abateram {p.repeticoes} de {p.alvo_repeticoes}")

    print("\n-- mas NUNCA fecha a última unidade --")
    for _ in range(50):
        penitencia.abater(db, u, passo)
    db.commit(); db.refresh(p)
    ok(p.repeticoes == p.alvo_repeticoes - 1,
       f"cinquenta missões param em {p.repeticoes}/{p.alvo_repeticoes} — "
       f"falta uma, e ela é do hunter")
    ok(p.status == "PENDENTE",
       "a penitência continua PENDENTE — abater não quita")

    print("\n-- o que NÃO recebe abatimento --")
    limpar()
    sem_barra = TarefaDia(titulo="Sem doce até as 18h", data_prevista=hoje,
                          prioridade="ALTA", categoria="Combate", status="PENDENTE",
                          usuario_id=u.id, alvo_repeticoes=None)
    sem_barra.natureza = "PUNICAO"
    sem_barra.origem_data = hoje
    db.add(sem_barra); db.commit()
    r = penitencia.abater(db, u, passo)
    ok(r is None,
       "penitência sem barra (restritiva/temporal) é deixada em paz — "
       "cumprir metade de 'sem doce' não significa nada")

    print("\n-- e a mais ANTIGA é a que recebe --")
    limpar()
    velha = penitencia_de(10, dia=hoje - timedelta(days=3))
    nova  = penitencia_de(10, dia=hoje)
    penitencia.abater(db, u, passo)
    db.commit(); db.refresh(velha); db.refresh(nova)
    ok(velha.repeticoes == passo and nova.repeticoes == 0,
       "a dívida mais velha é a que anda primeiro")

    # ══ 2. A EXTINÇÃO ════════════════════════════════════════════════
    print("\n-- extinguir ENCERRA, não apaga --")
    limpar()
    p = penitencia_de(10)
    pid, dia_julgado = p.id, p.origem_data

    from routers import tarefas as rt
    rt.deletar_tarefa(pid, extinguir=True, db=db, usuario=u)

    ainda = db.query(TarefaDia).filter_by(id=pid).first()
    ok(ainda is not None,
       "a linha SOBREVIVE — é ela que registra que o dia foi julgado")
    ok(ainda.status == "CANCELADA",
       f"e fica encerrada ({ainda.status}), não pendente")
    ok(ainda.cancelada_em is not None, "com a data da extinção")
    ok(penitencia.contar(db, u.id) == 0,
       "sai das pendentes — o teto libera na hora, como um perdão deve")

    print("\n-- e o Sistema NÃO cobra de novo pela mesma falha --")
    ok(fechamento._ja_julgado(db, u, dia_julgado) is True,
       "o dia continua JULGADO depois da extinção — era exatamente isto "
       "que a exclusão apagava, e por isso vinha outra penitência igual")

    # A prova do contrário: se a linha fosse apagada, o dia reabriria.
    db.delete(ainda); db.commit()
    ok(fechamento._ja_julgado(db, u, dia_julgado) is False,
       "(controle) apagando a linha, o dia VOLTA a ser julgável — "
       "é o defeito que o encerramento evita")

    # ══ 3. A FILA QUE NÃO PODE EXISTIR ══════════════════════════════
    print("\n-- extinguir NÃO faz nascer outra no lugar --")
    limpar()
    db.add(Pacto(usuario_id=u.id, titulo="Faça {n} flexões", tipo="QUANTITATIVA",
                 base=10, valor_atual=10, ativo=True, ciclo=0))
    # Seis dias seguidos com o dia inteiro perdido: o cenário real do
    # Arquiteto, que tinha 23 falhas em sete dias e o teto cheio.
    for i in range(1, 7):
        d = hoje - timedelta(days=i)
        for k in range(2):
            r = Rotina(usuario_id=u.id, titulo=f"D{i}-{k}", tipo="DIARIA", ativo=True,
                       prioridade="ALTA", dificuldade="NORMAL", status="ATIVA",
                       penalidade_xp=40,
                       criado_em=datetime.utcnow() - timedelta(days=20))
            db.add(r); db.commit(); db.refresh(r)
            db.add(ExecucaoDia(rotina_id=r.id, usuario_id=u.id, data=d,
                               status="FRACASSADA"))
    db.commit()

    for _ in range(5):
        fechamento.fechar_vencidas(db, u); db.commit()
    pact = db.query(Pacto).filter_by(usuario_id=u.id).first()
    antes_pend = penitencia.contar(db, u.id)
    antes_caiu = pact.vezes_caiu or 0
    ok(antes_pend >= 1, f"o cenário produziu {antes_pend} penitência(s)")

    alvo_ext = penitencia.pendentes(db, u.id)[0]
    rt.deletar_tarefa(alvo_ext.id, extinguir=True, db=db, usuario=u)
    for _ in range(3):
        fechamento.fechar_vencidas(db, u); db.commit()
    db.refresh(pact)

    # ESTE É O ASSERT DA QUEIXA: "eu extingo a punição e ela volta,
    # ainda gera um acúmulo de caiu x vezes".
    ok(penitencia.contar(db, u.id) == antes_pend - 1,
       f"depois de extinguir, o total CAI e fica ({penitencia.contar(db, u.id)}) — "
       f"nenhuma nasceu para ocupar a vaga")
    ok((pact.vezes_caiu or 0) == antes_caiu,
       f"e o pacto NÃO caiu de novo (vezes_caiu segue em {antes_caiu}) — "
       f"era este acúmulo que denunciava a fila")

    print("\n-- missão comum continua sendo apagada de verdade --")
    limpar()
    comum = TarefaDia(titulo="Missão qualquer", data_prevista=hoje,
                      prioridade="ALTA", categoria="Pessoal", status="PENDENTE",
                      usuario_id=u.id)
    db.add(comum); db.commit(); db.refresh(comum)
    cid = comum.id
    rt.deletar_tarefa(cid, extinguir=True, db=db, usuario=u)
    ok(db.query(TarefaDia).filter_by(id=cid).first() is None,
       "só a PENITÊNCIA é preservada — o resto é apagado como sempre foi")

    limpar()
    db.close()
    print(f"\n=== {testes - falhas}/{testes} ===")
    return falhas


if __name__ == "__main__":
    import sys
    sys.exit(1 if rodar() else 0)
