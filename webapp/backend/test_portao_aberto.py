# -*- coding: utf-8 -*-
"""
O PORTÃO QUE NÃO FECHA — ir e vir sem pedágio.

Pedido do Arquiteto, palavra por palavra:

    "Aplique também a lógica das dungeons que nunca fecham, que o user
     tem liberdade de sair e entrar. Por falar nisso deixe que o user
     entre e saia de dungeons quando quiser, se ela estiver aberta é
     claro. Assim ele pode migrar de dungeons quando for o caso."

O módulo de Dungeons nunca teve um único teste. Este é o primeiro, e ele
existe porque a liberdade de sair e voltar toca em TODAS as contas do
portão ao mesmo tempo: streak, XP de entrada, penalidade de atraso,
punição das missões pendentes e pagamento do clear. Cada uma delas tem um
jeito próprio de transformar "voltei" em "cheguei atrasado" ou em "ganhei
de novo" — e nenhum dos dois erros aparece na tela. Aparece no XP, dias
depois, sem ninguém saber de onde veio.

O QUE ESTE TESTE PROTEGE, EM ORDEM DE GRAVIDADE

1. VOLTAR NÃO É CHEGAR ATRASADO.
   Foi um bug real: com `pontual` e `tolerado` falsos na reentrada, todo
   retorno caía no ramo do atraso e cobrava `penalidade_atraso_xp` +
   zerava o streak. O hunter era punido exatamente pela liberdade que o
   portão aberto promete.

2. SAIR NÃO É ENCERRAR.
   `_resolver_sessao` expira as missões pendentes COM punição e fecha o
   rank do dia. Aplicar isso a quem só foi cuidar de outra dungeon é
   cobrar pedágio pela migração que o Arquiteto pediu.

3. VOLTAR NÃO É UMA NOVA TRAVESSIA.
   O outro extremo: se cada entrada pagasse `xp_entrada` e subisse o
   streak, a dungeon viraria uma máquina de XP acionada por um botão.

4. O CLEAR SE PAGA UMA VEZ — MAS PODE MELHORAR.
   Encerrar, voltar e encerrar de novo paga só a DIFERENÇA. Quem
   concluiu mais missões recebe o acréscimo; quem só girou a maçaneta
   recebe zero.

5. O PORTÃO COMUM NÃO MUDOU.
   Toda regra acima vale só para `sempre_aberta`. Na dungeon com hora
   marcada, sair continua sendo encerrar e a travessia continua sendo
   uma por dia.

6. SAIR PARA A PRESENÇA, NUNCA O PRAZO.

       "os portões não podem ter o tempo parado, se o user decidir sair
        de um deles, é escolha dele, mas se for uma dungeon com limite
        de tempo, o tempo não para" — o Arquiteto.

   Correção de um erro meu: a suspensão congelava a sessão inteira,
   prazo incluído. Sair viraria um botão de pausa — bastaria voltar às
   23h para reabrir uma travessia que devia ter fechado às 17:30, e a
   dungeon com limite de tempo deixaria de ter limite de tempo.

Uso: DATABASE_URL=sqlite:///./x.db SECRET_KEY=... python test_portao_aberto.py
"""
from datetime import timedelta

import main                                     # noqa: F401
from fastapi import HTTPException
from fastapi.testclient import TestClient
from database import (SessionLocal, Usuario, Dungeon, DungeonMissao,
                      DungeonSessao, DungeonMissaoExecucao)
from motors import tempo
from routers import dungeons as rd

falhas = testes = 0


def ok(cond, msg):
    global falhas, testes
    testes += 1
    if not cond:
        falhas += 1
    print(("  [ok]  " if cond else "  [XX]  ") + msg)


def erro(fn, trecho, msg):
    """Espera um HTTPException cuja mensagem contenha `trecho`."""
    try:
        fn()
        ok(False, msg + "  (não recusou!)")
    except HTTPException as ex:
        ok(trecho.lower() in str(ex.detail).lower(),
           msg + f"  → '{ex.detail}'")


def limpar(db, u):
    for d in db.query(Dungeon).filter_by(usuario_id=u.id).all():
        for s in db.query(DungeonSessao).filter_by(dungeon_id=d.id).all():
            db.query(DungeonMissaoExecucao).filter_by(dungeon_sessao_id=s.id).delete()
            db.delete(s)
        db.query(DungeonMissao).filter_by(dungeon_id=d.id).delete()
        db.delete(d)
    db.commit()


def nova_dungeon(db, u, aberta, com_missoes=2, **kw):
    d = Dungeon(
        usuario_id=u.id, titulo="Portão de teste", status="ATIVA",
        tipo_permanencia="PERMANENTE", tipo_recorrencia="DIARIA",
        hora_entrada=None if aberta else "23:59",
        hora_saida=None if aberta else "23:59",
        tolerancia_min=10, sempre_aberta=aberta,
        categoria="Pessoal", rank="E", dificuldade="NORMAL",
        xp_entrada=25, xp_clear=100, moedas_clear=10,
        penalidade_entrada_xp=50, penalidade_atraso_xp=15,
        streak_atual=0, streak_max=0, **kw
    )
    db.add(d); db.commit(); db.refresh(d)
    for i in range(com_missoes):
        db.add(DungeonMissao(
            dungeon_id=d.id, titulo=f"Missão {i+1}", icone="⚔️",
            tipo="ATIVA", natureza="PADRAO",
            xp_recompensa=30, moedas_recompensa=3, penalidade_xp=0,
            expira_em_min=5, ativo=True,
        ))
    db.commit()
    return d


def _agora_menos(d, s, minutos):
    """Recua a entrada da sessão, para simular o tempo passando."""
    return rd._agora() - timedelta(minutes=minutos)


def sessao(db, d, u):
    return db.query(DungeonSessao).filter_by(
        dungeon_id=d.id, usuario_id=u.id, data=tempo.hoje(), modo_teste=False
    ).first()


def rodar():
    print("\n=== O PORTÃO QUE NÃO FECHA ===\n")
    cli = TestClient(main.app)
    with cli:
        pass
    db = SessionLocal()
    u = (db.query(Usuario).filter_by(nivel_acesso="Arquiteto").first()
         or db.query(Usuario).first())
    limpar(db, u)

    # ── 1. A PRIMEIRA TRAVESSIA ─────────────────────────────────────
    print("-- a primeira travessia --")
    d = nova_dungeon(db, u, aberta=True)
    xp0 = u.xp_total or 0

    rd.entrar_dungeon(d.id, db=db, usuario=u)
    db.refresh(d); s = sessao(db, d, u)

    ok(s.status == "ATIVA", "entrou: a sessão está ATIVA")
    ok(s.visitas == 1, f"primeira visita contada (visitas={s.visitas})")
    ok(s.atraso_minutos == 0,
       "sem hora marcada não há atraso — ninguém chega tarde num portão sem porta")
    ok(d.streak_atual == 1, "a travessia pontual sobe o streak")
    ok((u.xp_total or 0) > xp0, "o XP de entrada foi pago")
    xp_apos_entrada = u.xp_total or 0
    entrada_original = s.entrada_em

    execs = db.query(DungeonMissaoExecucao).filter_by(dungeon_sessao_id=s.id).all()
    ok(len(execs) == 2, "as duas missões foram armadas na travessia")

    # ── 2. SAIR NÃO É ENCERRAR ──────────────────────────────────────
    print("\n-- sair não é encerrar --")
    r = rd.sair_dungeon(d.id, db=db, usuario=u)
    db.refresh(d); db.refresh(s)

    ok(s.status == "SUSPENSA", "saiu sem encerrar: a sessão apenas adormece")
    ok(r["relatorio"].get("suspensa") is True, "o relatório diz que foi suspensão")
    ok(s.rank_obtido is None, "nenhum rank foi fechado — o dia não acabou")
    ok((u.xp_total or 0) == xp_apos_entrada, "sair não paga clear")
    ok((s.xp_perdido or 0) == 0, "sair não pune")

    for e in db.query(DungeonMissaoExecucao).filter_by(dungeon_sessao_id=s.id).all():
        db.refresh(e)
    pend = [e for e in db.query(DungeonMissaoExecucao)
            .filter_by(dungeon_sessao_id=s.id).all() if e.status == "PENDENTE"]
    ok(len(pend) == 2,
       "as missões pendentes continuam de pé — ele foi cuidar de outra dungeon, não desistiu")

    # De fora, não se cumpre missão de dentro.
    erro(lambda: rd.cumprir_missao(pend[0].id, db=db, usuario=u),
         "não está ativa", "de fora do portão, a missão dele não obedece")

    # ── 3. A VOLTA ──────────────────────────────────────────────────
    print("\n-- a volta --")
    streak_antes = d.streak_atual
    perdido_antes = s.xp_perdido or 0

    rd.entrar_dungeon(d.id, db=db, usuario=u)
    db.refresh(d); db.refresh(s)

    ok(s.status == "ATIVA", "voltou: a sessão está ATIVA de novo")
    ok(s.visitas == 2, f"a segunda visita foi contada (visitas={s.visitas})")
    ok(s.entrada_em == entrada_original,
       "`entrada_em` guarda a PRIMEIRA travessia — reescrevê-la apagaria a pontualidade")
    ok(s.reaberta_em is not None, "a reabertura ficou registrada")
    ok(s.saida_em is None, "ele voltou: a saída anterior não vale mais")

    ok(d.streak_atual == streak_antes,
       "VOLTAR NÃO É CHEGAR ATRASADO: o streak não quebrou")
    ok((s.xp_perdido or 0) == perdido_antes,
       "VOLTAR NÃO É CHEGAR ATRASADO: nenhuma penalidade de atraso foi cobrada")
    ok((u.xp_total or 0) == xp_apos_entrada,
       "VOLTAR NÃO É UMA NOVA TRAVESSIA: o XP de entrada não se paga duas vezes")

    # Entrar de novo já estando dentro é clique repetido, não ida e volta.
    erro(lambda: rd.entrar_dungeon(d.id, db=db, usuario=u),
         "já está dentro", "entrar duas vezes seguidas é recusado")

    # ── 4. O CLEAR SE PAGA UMA VEZ ──────────────────────────────────
    print("\n-- o clear se paga uma vez, mas pode melhorar --")
    execs = db.query(DungeonMissaoExecucao).filter_by(dungeon_sessao_id=s.id).all()
    rd.cumprir_missao(execs[0].id, db=db, usuario=u)     # 1 de 2 = 50% → rank B
    db.refresh(u)
    xp_antes_clear = u.xp_total or 0

    r1 = rd.sair_dungeon(d.id, db=db, usuario=u, encerrar=True)
    db.refresh(s); db.refresh(u)
    rel1 = r1["relatorio"]

    ok(s.status == "CONCLUIDA", "encerrou de propósito: a sessão fecha")
    ok(rel1["rank_obtido"] == "B", f"1 de 2 missões = rank B (veio {rel1['rank_obtido']})")
    ok(rel1["xp_clear"] > 0, f"o clear foi pago ({rel1['xp_clear']} XP)")
    ok((s.clear_xp_pago or 0) == rel1["xp_clear_total"],
       "a sessão lembra quanto de clear já pagou")
    pago_1 = rel1["xp_clear"]
    xp_apos_clear = u.xp_total or 0
    ok(xp_apos_clear > xp_antes_clear, "o XP do hunter subiu com o clear")

    # A missão que ficou para trás foi punida — encerrar é encerrar.
    exec_largada = db.query(DungeonMissaoExecucao).filter_by(
        dungeon_sessao_id=s.id).filter(
        DungeonMissaoExecucao.status == "EXPIRADA").first()
    ok(exec_largada is not None,
       "ENCERRAR É ENCERRAR: a missão deixada para trás expirou (ao contrário de suspender)")

    # Voltar depois de encerrar, num portão aberto, é permitido.
    rd.entrar_dungeon(d.id, db=db, usuario=u)
    db.refresh(s); db.refresh(u); db.refresh(d)
    ok(s.status == "ATIVA", "num portão aberto dá para voltar mesmo depois de encerrar")
    ok(s.visitas == 3, f"terceira visita (visitas={s.visitas})")
    ok((u.xp_total or 0) == xp_apos_clear,
       "e a volta continua sem pagar entrada de novo")

    # Encerrar de novo sem fazer mais nada não paga clear nenhum.
    r2 = rd.sair_dungeon(d.id, db=db, usuario=u, encerrar=True)
    db.refresh(u)
    ok(r2["relatorio"]["xp_clear"] == 0,
       "girar a maçaneta duas vezes não paga o clear duas vezes")
    ok((u.xp_total or 0) == xp_apos_clear,
       "o XP do hunter não se mexeu com o encerramento repetido")

    # Agora ele volta, conclui a segunda missão e o rank SOBE: paga a diferença.
    rd.entrar_dungeon(d.id, db=db, usuario=u)
    db.refresh(s)
    resta = [e for e in db.query(DungeonMissaoExecucao)
             .filter_by(dungeon_sessao_id=s.id).all()
             if e.status in ("PENDENTE", "EM_PROGRESSO", "PAUSADA", "EXPIRADA")]
    for e in resta:
        e.status = "PENDENTE"          # o portão aberto rearma o que ficou
    db.commit()
    for e in resta:
        rd.cumprir_missao(e.id, db=db, usuario=u)

    xp_antes_dif = (db.query(Usuario).get(u.id).xp_total or 0)
    r3 = rd.sair_dungeon(d.id, db=db, usuario=u, encerrar=True)
    db.refresh(s); db.refresh(u)
    rel3 = r3["relatorio"]

    ok(rel3["rank_obtido"] == "S", f"2 de 2 = rank S (veio {rel3['rank_obtido']})")
    ok(rel3["xp_clear"] > 0, f"o rank subiu: recebeu a diferença ({rel3['xp_clear']} XP)")
    ok(rel3["xp_clear"] < rel3["xp_clear_total"],
       "e recebeu SÓ a diferença, não o clear inteiro outra vez")
    ok(rel3["xp_clear"] + pago_1 == rel3["xp_clear_total"],
       f"as duas parcelas somam o clear cheio ({pago_1} + {rel3['xp_clear']} "
       f"= {rel3['xp_clear_total']})")
    ok((u.xp_total or 0) > xp_antes_dif, "o acréscimo caiu na conta do hunter")

    # ── 5. O PORTÃO COMUM NÃO MUDOU ─────────────────────────────────
    print("\n-- o portão comum não mudou --")
    limpar(db, u)
    c = nova_dungeon(db, u, aberta=False, com_missoes=1)
    # hora_entrada no passado para que a travessia seja possível agora
    c.hora_entrada = "00:00"; c.hora_saida = "23:59"; db.commit()

    rd.entrar_dungeon(c.id, db=db, usuario=u)
    sc = sessao(db, c, u)
    ok(sc.status == "ATIVA", "entrou no portão comum")

    rd.sair_dungeon(c.id, db=db, usuario=u)      # sem `encerrar`
    db.refresh(sc)
    ok(sc.status == "CONCLUIDA",
       "no portão com hora marcada, SAIR É ENCERRAR — sem suspensão")
    ok(sc.rank_obtido is not None, "e o rank do dia foi fechado")

    erro(lambda: rd.entrar_dungeon(c.id, db=db, usuario=u),
         "já atravessou", "e a travessia continua sendo uma por dia")

    # ── 6. NO-SHOW: O QUE NÃO TEM HORA NÃO PERDE A HORA ─────────────
    print("\n-- o no-show e a varredura de ontem --")
    limpar(db, u)
    a = nova_dungeon(db, u, aberta=True, com_missoes=1)
    ontem = tempo.hoje() - timedelta(days=1)

    s_ontem = DungeonSessao(dungeon_id=a.id, usuario_id=u.id, data=ontem,
                            status="PENDENTE", modo_teste=False)
    db.add(s_ontem); db.commit(); db.refresh(s_ontem)

    xp_antes = u.xp_total or 0
    rd.listar_dungeons(db=db, usuario=u)
    db.refresh(s_ontem); db.refresh(u)

    ok(s_ontem.status != "FRACASSADA",
       f"portão aberto não fracassa por no-show (ficou {s_ontem.status})")
    ok((u.xp_total or 0) == xp_antes,
       "e não cobra a penalidade de entrada pela porta dos fundos")

    # Sessão SUSPENSA de ontem: o dia dela acaba com o clear PAGO.
    limpar(db, u)
    b = nova_dungeon(db, u, aberta=True, com_missoes=1)
    s_susp = DungeonSessao(dungeon_id=b.id, usuario_id=u.id, data=ontem,
                           status="SUSPENSA", modo_teste=False,
                           entrada_em=tempo.agora() - timedelta(days=1))
    db.add(s_susp); db.commit(); db.refresh(s_susp)
    m_b = db.query(DungeonMissao).filter_by(dungeon_id=b.id).first()
    db.add(DungeonMissaoExecucao(dungeon_missao_id=m_b.id,
                                 dungeon_sessao_id=s_susp.id,
                                 status="CONCLUIDA", progresso_pct=100.0))
    db.commit()

    xp_antes = u.xp_total or 0
    rd.listar_dungeons(db=db, usuario=u)
    db.refresh(s_susp); db.refresh(u)

    ok(s_susp.status == "CONCLUIDA", "a sessão suspensa de ontem foi resolvida")
    ok(s_susp.rank_obtido == "S", f"com o rank que ela merecia ({s_susp.rank_obtido})")
    ok((u.xp_total or 0) > xp_antes,
       "SUSPENDER NÃO É ESQUECER: o clear de ontem foi pago, não confiscado")

    # ── 7. O RELÓGIO NÃO PARA ───────────────────────────────────────
    #
    # "os portões não podem ter o tempo parado, se o user decidir sair de
    #  um deles, é escolha dele, mas se for uma dungeon com limite de
    #  tempo, o tempo não para" — o Arquiteto.
    #
    # É a correção de um erro meu: eu tinha feito a suspensão congelar a
    # sessão inteira, prazo incluído. Sair viraria um botão de pausa —
    # bastaria voltar às 23h para reabrir uma travessia que devia ter
    # fechado às 17:30, e a dungeon com limite de tempo deixaria de ter
    # limite de tempo.
    print("\n-- o relógio do mundo não espera --")
    limpar(db, u)

    # Um portão aberto COM limite de travessia: 90 minutos, contados da
    # primeira entrada — não do tempo de permanência.
    t = nova_dungeon(db, u, aberta=True, com_missoes=2, duracao_max_min=90)
    rd.entrar_dungeon(t.id, db=db, usuario=u)
    st = sessao(db, t, u)

    prazo = rd._prazo_da_sessao(t, st)
    ok(prazo is not None, "um portão aberto PODE ter limite de tempo")
    ok(abs((prazo - st.entrada_em).total_seconds() / 60 - 90) < 1,
       "e o prazo conta da PRIMEIRA travessia, não da permanência")

    r = rd.sair_dungeon(t.id, db=db, usuario=u)
    db.refresh(st)
    rel = r["relatorio"]
    ok(st.status == "SUSPENSA", "ele sai — a escolha é dele")
    ok(rel.get("prazo_em") is not None,
       "mas o relatório da saída já diz que existe um prazo correndo")
    ok(rel.get("minutos_restantes") is not None and rel["minutos_restantes"] <= 90,
       f"e quanto resta dele ({rel.get('minutos_restantes')} min)")
    ok(rd._prazo_da_sessao(t, st) == prazo,
       "O PRAZO NÃO SE MEXEU COM A SUSPENSÃO — sair não é pausar o mundo")

    # Agora o tempo passa: o prazo vence com ele do lado de fora.
    st.entrada_em = _agora_menos(t, st, 120)     # entrou há 2h; limite era 1h30
    db.commit()
    ok(rd._prazo_da_sessao(t, st) < rd._agora(),
       "duas horas depois, o prazo de 90 min já venceu — e ele estava fora")

    erro(lambda: rd.entrar_dungeon(t.id, db=db, usuario=u),
         "acabou", "voltar depois do prazo é recusado, não perdoado")

    # E a varredura da lista resolve a travessia vencida sozinha, sem
    # esperar que alguém abra ESTA dungeon.
    rd.listar_dungeons(db=db, usuario=u)
    db.refresh(st)
    ok(st.status == "CONCLUIDA",
       "a travessia vencida foi resolvida na varredura — não ficou parada esperando por ele")
    ok(st.saida_em is not None and st.saida_em <= rd._agora(),
       "e foi fechada no instante do PRAZO, não no instante em que o Sistema percebeu")

    # `hora_saida` é a outra fonte de prazo: o horário do mundo.
    limpar(db, u)
    h = nova_dungeon(db, u, aberta=True, com_missoes=1)
    h.hora_saida = "23:59"; db.commit()
    rd.entrar_dungeon(h.id, db=db, usuario=u)
    sh = sessao(db, h, u)
    ph = rd._prazo_da_sessao(h, sh)
    ok(ph is not None and ph.hour == 23 and ph.minute == 59,
       "a hora de saída também é prazo, mesmo num portão aberto")

    h.duracao_max_min = 30; db.commit()
    ok(rd._prazo_da_sessao(h, sh) < ph,
       "e com as duas fontes vale a MAIS APERTADA — o prazo não se escolhe pelo mais folgado")

    # O portão SEM limite nenhum: aí sim a suspensão é aberta, e o dia fecha.
    limpar(db, u)
    livre = nova_dungeon(db, u, aberta=True, com_missoes=1)
    rd.entrar_dungeon(livre.id, db=db, usuario=u)
    sl = sessao(db, livre, u)
    ok(rd._prazo_da_sessao(livre, sl) is None,
       "portão sem hora de saída e sem limite não tem prazo — só o fim do dia")
    rd.sair_dungeon(livre.id, db=db, usuario=u)
    rd.listar_dungeons(db=db, usuario=u)
    db.refresh(sl)
    ok(sl.status == "SUSPENSA",
       "e essa suspensão sobrevive à varredura: não há prazo para vencer")

    # ── 8. PRESENÇA E PRAZO SÃO NÚMEROS DIFERENTES ──────────────────
    print("\n-- presença não é a mesma coisa que prazo --")
    limpar(db, u)
    p2 = nova_dungeon(db, u, aberta=True, com_missoes=1, duracao_max_min=180)
    rd.entrar_dungeon(p2.id, db=db, usuario=u)
    s2 = sessao(db, p2, u)

    # Ele esteve 10 minutos dentro e entrou há 70: 60 minutos foram embora
    # do lado de fora.
    s2.entrada_em = rd._agora() - timedelta(minutes=70)
    s2.tempo_total_min = 10
    db.commit()

    fora = rd._minutos_fora(s2)
    ok(58 <= fora <= 62, f"minutos_fora ≈ 60 (veio {fora})")
    ok((s2.tempo_total_min or 0) == 10,
       "e `tempo_total_min` continua sendo só a PRESENÇA — somar o tempo de fora "
       "faria uma visita de 10 min, retomada horas depois, valer horas")

    d2 = rd._sessao_to_dict(s2)
    ok(d2["tempo_total_min"] == 10 and 58 <= d2["minutos_fora"] <= 62,
       "e a tela recebe os dois números separados, para poder dizer a verdade")

    limpar(db, u)
    db.close()
    print(f"\n=== {testes - falhas}/{testes} ===")
    return falhas


if __name__ == "__main__":
    import sys
    sys.exit(1 if rodar() else 0)
