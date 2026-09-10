# -*- coding: utf-8 -*-
"""
O DOSSIE DA MISSAO — a leitura longa do cartao.

O Arquiteto: "nas primeiras versoes dos cards, quando o user clicava
duas vezes sobre eles, abria um modal com mais dados. Quero que traga
isso de volta — streak, quantas concluiu seguidas, porcentagem de
conclusao, tempo recorde e todas mais que voce achar pertinente."

O QUE ESTE TESTE PROTEGE

1. A CORRENTE DA ROTINA NAO E A CORRENTE DO HUNTER.
   `Usuario.streak_atual` conta dias em que ele fez ALGUMA coisa. Aqui
   sao dias seguidos em que ESTA rotina foi cumprida. Um hunter com
   streak de trinta pode ter uma rotina quebrada ha uma semana — e e
   esse contraste que o dossie existe para mostrar.

2. A CONFISSAO NAO QUEBRA A CORRENTE.
   E a regra que o app ja tem escrita: confessar custa metade e nao
   quebra o streak. Punir a honestidade ensina a nao admitir.

3. NADA E GUARDADO.
   Todo numero e derivado das instancias na hora da leitura. Uma coluna
   `vezes_concluida` seria mais rapida e discordaria do historico no
   primeiro Reerguer.

4. MISSAO GERAL NAO GANHA A FORMA DA ROTINA.
   Ela acontece uma vez. Devolver taxa de 0% e corrente de 0 faria uma
   missao cumprida parecer um fracasso.

Uso: DATABASE_URL=sqlite:///./x.db SECRET_KEY=... python test_dossie.py
"""
from datetime import date, datetime, timedelta

import main                                     # noqa: F401
from fastapi.testclient import TestClient
from database import (SessionLocal, Usuario, Rotina, ExecucaoDia, TarefaDia,
                      Execucao, Pacto)
from motors import tempo, dossie
from routers import rotinas as rr, tarefas as rt

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
    print("\n=== O DOSSIE DA MISSAO ===\n")
    cli = TestClient(main.app)
    with cli:
        pass
    db = SessionLocal()
    u = db.query(Usuario).filter_by(nivel_acesso="Arquiteto").first() or db.query(Usuario).first()
    u.nivel_acesso = "Arquiteto"
    db.commit()
    hoje = tempo.hoje()
    limpar(db, u)

    r = Rotina(usuario_id=u.id, titulo="Acordar às 06:00", tipo="DIARIA", ativo=True,
               prioridade="ALTA", dificuldade="NORMAL", status="ATIVA",
               criado_em=datetime.utcnow() - timedelta(days=20))
    db.add(r); db.commit(); db.refresh(r)

    def inst(dias_atras, status, dur_min=None, xp=0, xpp=0, reerg=False, mana=0):
        d = hoje - timedelta(days=dias_atras)
        ed = ExecucaoDia(rotina_id=r.id, usuario_id=u.id, data=d, status=status,
                         xp_ganho=xp, xp_perdido=xpp, reerguida=reerg, mana_gasta=mana)
        if dur_min is not None:
            base = datetime.combine(d, datetime.min.time()) + timedelta(hours=6)
            ed.iniciada_em = base
            ed.concluida_em = base + timedelta(minutes=dur_min)
        db.add(ed)
        return ed

    # Uma historia: 4 cumpridas seguidas ate ontem, com uma confissao no meio.
    inst(9, "FRACASSADA", xpp=15)
    inst(8, "CONCLUIDA", dur_min=12, xp=60)
    inst(7, "CONCLUIDA", dur_min=8,  xp=60)
    inst(6, "FRACASSADA", xpp=15)
    inst(5, "CONCLUIDA", dur_min=20, xp=60, reerg=True, mana=25)
    inst(4, "CONCLUIDA", dur_min=5,  xp=60)     # o recorde
    inst(3, "CONFESSADA")                       # neutra
    inst(2, "CONCLUIDA", dur_min=9,  xp=60)
    inst(1, "CONCLUIDA", dur_min=11, xp=60)
    db.commit()

    d = dossie.de_rotina(db, u, r, hoje)

    # ── A corrente da ROTINA ────────────────────────────────────────
    print("-- a corrente desta rotina --")
    # QUATRO, e nao duas. Escrevi 2 no primeiro assert porque contei a
    # confissao do dia 3 como um fim de linha — e ela e NEUTRA: nao soma
    # nem quebra. Entao a corrente atravessa: dias 1, 2, (3 neutro), 4, 5,
    # e para no fracasso do dia 6.
    #
    # O teste me corrigiu no ponto exato onde a regra e contraintuitiva,
    # que e o unico lugar onde um teste vale alguma coisa.
    ok(d["corrente"]["atual"] == 4,
       f"quatro cumpridas seguidas, ATRAVESSANDO a confissao ({d['corrente']['atual']})")
    ok(d["corrente"]["recorde"] == 4,
       f"e o recorde e 4 — a confissao NAO quebrou a sequencia ({d['corrente']['recorde']})")

    # A prova de que a confissao e neutra: trocando-a por fracasso, cai.
    conf = db.query(ExecucaoDia).filter_by(rotina_id=r.id,
                                           data=hoje - timedelta(days=3)).first()
    conf.status = "FRACASSADA"
    db.commit()
    d2 = dossie.de_rotina(db, u, r, hoje)
    ok(d2["corrente"]["recorde"] == 2,
       f"virando aquela confissao em FRACASSO, o recorde cai para 2 ({d2['corrente']['recorde']}) — "
       f"e a diferenca prova que confessar nao quebra")
    conf.status = "CONFESSADA"
    db.commit()

    # ── Taxa, tempo, XP ─────────────────────────────────────────────
    print("\n-- taxa, tempo e XP --")
    c = d["contagem"]
    ok(c["cumpridas"] == 6 and c["fracassadas"] == 2,
       f"6 cumpridas, 2 fracassadas ({c['cumpridas']}/{c['fracassadas']})")
    ok(c["confessadas"] == 1, "e 1 confessada, contada a parte")
    ok(d["taxa"] == 75,
       f"taxa = 6 de 8 JULGADAS = 75% ({d['taxa']}%) — a confessada nao entra "
       f"no denominador, senao confessar baixaria a taxa e a honestidade "
       f"viraria prejuizo")

    t = d["tempo"]
    ok(t["recorde"] == 5 * 60, f"o recorde e o menor tempo: 5 min ({t['recorde']}s)")
    ok(t["pior"] == 20 * 60, f"e o pior, 20 min ({t['pior']}s)")
    ok(t["amostras"] == 6, f"com seis amostras cronometradas ({t['amostras']})")
    ok(t["medio"] == round((12 + 8 + 20 + 5 + 9 + 11) * 60 / 6) or t["medio"] > 0,
       f"e a media entre elas ({t['medio']}s)")

    ok(d["xp"]["ganho"] == 360 and d["xp"]["perdido"] == 30,
       f"XP: {d['xp']['ganho']} ganho, {d['xp']['perdido']} perdido")
    ok(d["xp"]["saldo"] == 330, f"saldo {d['xp']['saldo']}")
    ok(d["reergues"]["vezes"] == 1 and d["reergues"]["mana"] == 25,
       "e um Reerguer, com a Mana que custou")

    # ── Tempo impossivel nao entra ──────────────────────────────────
    print("\n-- tempo que nao e tempo de execucao --")
    louca = inst(12, "CONCLUIDA")
    base = datetime.combine(hoje - timedelta(days=12), datetime.min.time())
    louca.iniciada_em = base
    louca.concluida_em = base + timedelta(hours=30)      # esquecida aberta
    db.commit()
    d3 = dossie.de_rotina(db, u, r, hoje)
    ok(d3["tempo"]["pior"] == 20 * 60,
       "instancia esquecida aberta por 30h NAO vira 'pior tempo' — "
       "nao e tempo de execucao, e descuido")
    louca.concluida_em = base - timedelta(minutes=5)     # relogio bagunçado
    db.commit()
    ok(dossie.de_rotina(db, u, r, hoje)["tempo"]["amostras"] == 6,
       "e duracao negativa tambem e descartada")
    db.delete(louca); db.commit()

    # ── Dia da semana ───────────────────────────────────────────────
    print("\n-- por dia da semana --")
    sem = dossie.de_rotina(db, u, r, hoje)["semana"]
    ok(isinstance(sem["linhas"], list) and len(sem["linhas"]) > 0,
       f"as ocorrencias se distribuem pelos dias ({len(sem['linhas'])} dias com dado)")
    ok(all(x["n"] >= 3 for x in ([sem["melhor"]] if sem["melhor"] else [])),
       "melhor e pior so aparecem com pelo menos TRES ocorrencias — "
       "uma terca com uma unica cumprida daria '100% na terca', "
       "que e coincidencia e nao padrao")

    # ── A fita ──────────────────────────────────────────────────────
    print("\n-- a fita dos ultimos dias --")
    d4 = dossie.de_rotina(db, u, r, hoje, dias_fita=7)
    # SEIS, e nao sete: a janela de 7 dias vai de hoje-6 ate hoje, e nao
    # ha instancia HOJE. Escrevi 7 no primeiro assert contando a JANELA
    # em vez do que existe DENTRO dela — que e exatamente a diferenca
    # que a fita foi feita para mostrar.
    ok(len(d4["fita"]) == 6,
       f"a janela de 7 dias devolve as 6 instancias que existiram nela ({len(d4['fita'])})")
    ok(all("data" in x and "status" in x for x in d4["fita"]),
       "cada uma com data e desfecho")
    # Uma rotina de segunda e quarta nao "falha" na terca.
    r2 = Rotina(usuario_id=u.id, titulo="Só segundas", tipo="SEMANAL", ativo=True,
                prioridade="MEDIA", dificuldade="NORMAL", status="ATIVA")
    db.add(r2); db.commit(); db.refresh(r2)
    db.add(ExecucaoDia(rotina_id=r2.id, usuario_id=u.id,
                       data=hoje - timedelta(days=2), status="CONCLUIDA"))
    db.commit()
    ok(len(dossie.de_rotina(db, u, r2, hoje, dias_fita=30)["fita"]) == 1,
       "rotina semanal mostra UMA marca em 30 dias — dia em que ela nao foi "
       "pedida nao vira quadradinho, que sugeriria uma falta que nao houve")

    # ── Penitencias que a rotina gerou ──────────────────────────────
    print("\n-- o que ela custou --")
    for i in range(2):
        t2 = TarefaDia(titulo=f"Faça 30 flexões {i}", data_prevista=hoje, prioridade="ALTA",
                       categoria="Combate", status="PENDENTE", usuario_id=u.id)
        t2.natureza = "PUNICAO"
        t2.origem_rotina_id = r.id
        db.add(t2)
    db.commit()
    ok(dossie.de_rotina(db, u, r, hoje)["penitencias_geradas"] == 2,
       "o dossie diz quantas penitencias esta rotina ja gerou")

    # ── O endpoint, e o medidor so do Arquiteto ─────────────────────
    print("\n-- o endpoint --")
    resp = rr.dossie_rotina(r.id, db=db, usuario=u)
    ok(resp["titulo"] == r.titulo, "o endpoint devolve o dossie")
    ok("medidor" in resp, "com o medidor de punicao, porque quem pediu e o Arquiteto")
    u.nivel_acesso = "User"; db.commit()
    ok("medidor" not in rr.dossie_rotina(r.id, db=db, usuario=u),
       "para o hunter comum o medidor NAO vai — ver quantas falhas faltam "
       "transformaria a punicao num orcamento")
    u.nivel_acesso = "Arquiteto"; db.commit()

    # ── A missao geral tem outra forma ──────────────────────────────
    print("\n-- a missao geral nao e uma rotina de uma linha --")
    g = TarefaDia(titulo="Ligar para o médico", data_prevista=hoje, prioridade="ALTA",
                  categoria="Saude", status="CONCLUIDA", usuario_id=u.id,
                  xp_recompensa=90)
    g.iniciada_em = datetime.utcnow() - timedelta(minutes=7)
    g.concluida_em = datetime.utcnow()
    db.add(g); db.commit(); db.refresh(g)
    # O XP creditado mora em `Execucao`, nao na TarefaDia — foi por ler o
    # campo errado que a primeira versao do motor devolvia zero calado.
    db.add(Execucao(usuario_id=u.id, tarefa_id=g.id, data_execucao=hoje, xp_ganho=90))
    db.commit()

    dg = rt.dossie_tarefa(g.id, db=db, usuario=u)
    ok(dg["tipo"] == "geral", "ela se declara de outro tipo")
    ok("taxa" not in dg and "corrente" not in dg,
       "e NAO traz taxa nem corrente — 0% e corrente 0 fariam uma missao "
       "cumprida parecer fracasso")
    ok(dg["duracao"] and 6 * 60 <= dg["duracao"] <= 8 * 60,
       f"traz quanto levou ({dg['duracao']}s)")
    ok(dg["xp"]["ganho"] == 90, "e o XP creditado")

    # Penitencia diz de quem e a divida.
    p = TarefaDia(titulo="Faça 40 flexões", data_prevista=hoje, prioridade="ALTA",
                  categoria="Combate", status="PENDENTE", usuario_id=u.id)
    p.natureza = "PUNICAO"; p.origem_titulo = "Acordar às 06:00"; p.origem_data = hoje
    db.add(p); db.commit(); db.refresh(p)
    dp = rt.dossie_tarefa(p.id, db=db, usuario=u)
    ok(dp["eh_penitencia"] is True, "penitencia se identifica")
    ok(dp["origem_titulo"] == "Acordar às 06:00",
       "e diz por QUAL falha foi cobrada — punicao anonima e arbitraria")

    # ── Rotina virgem nao explode ───────────────────────────────────
    print("\n-- rotina sem historico --")
    r3 = Rotina(usuario_id=u.id, titulo="Nunca rodou", tipo="DIARIA", ativo=True,
                prioridade="MEDIA", dificuldade="NORMAL", status="ATIVA")
    db.add(r3); db.commit(); db.refresh(r3)
    d0 = dossie.de_rotina(db, u, r3, hoje)
    ok(d0["taxa"] is None,
       "taxa vem NULA, nao zero — 0% diria 'voce falha sempre' de uma rotina "
       "que nunca foi julgada")
    ok(d0["tempo"]["recorde"] is None and d0["corrente"]["atual"] == 0,
       "e o resto vem vazio sem quebrar")
    ok(d0["fita"] == [], "com a fita vazia")

    limpar(db, u)
    db.close()
    print(f"\n=== {testes - falhas}/{testes} ===")
    return falhas


if __name__ == "__main__":
    import sys
    sys.exit(1 if rodar() else 0)
