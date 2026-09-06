# -*- coding: utf-8 -*-
"""
O MEDIDOR DE PUNIÇÃO — a barra que enche quando o hunter insiste.

O QUE ESTE TESTE PROTEGE, EM ORDEM DE GRAVIDADE

1. O MEDIDOR E O JULGAMENTO DO DIA NÃO PUNEM JUNTOS.
   Se os dois disparassem, um dia ruim com três rotinas falhadas geraria
   três penitências (barras) mais uma (dia) e bateria o teto de quatro
   num único dia. É a espiral que a REGRA 1 do `penitencia.py` existe
   para impedir, e o defeito mais caro que este recurso poderia
   introduzir. O medidor SUBSTITUI a Regra B; não soma a ela.

2. A CHAVE NASCE DESLIGADA, E DESLIGADA ELE SÓ MEDE.
   `fechamento.py` já quebrou duas vezes neste projeto. O modo observação
   é o que permite ao Arquiteto comparar antes de trocar o gatilho.

3. UMA BARRA CHEIA DISPARA UMA VEZ, NÃO A CADA LEITURA.
   O extrato faz polling. Uma barra que já estava cheia e é enchida de
   novo não pode transbordar de novo — é o mesmo defeito de escopo que
   fez a punição gerar quatro cartões por um dia ruim.

4. TESTAR O SISTEMA NÃO PODE DESLIGAR O SISTEMA.
   Quatro punições de teste enchem o teto e o Sistema para de criar as
   reais — o sintoma que o Arquiteto já trouxe uma vez. A varredura tem
   de devolver tudo, inclusive o degrau que o pacto escalou.

Uso: DATABASE_URL=sqlite:///./x.db SECRET_KEY=... python test_medidor.py
"""
from datetime import timedelta

import main                                     # noqa: F401
from fastapi import HTTPException
from fastapi.testclient import TestClient
from database import (SessionLocal, Usuario, Rotina, ExecucaoDia, TarefaDia,
                      Execucao, Pacto)
from motors import tempo, medidor, economia, penitencia, fechamento
from routers import pactos as rp

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


def nova_rotina(db, u, titulo, prioridade="MEDIA", dificuldade="NORMAL"):
    r = Rotina(usuario_id=u.id, titulo=titulo, tipo="DIARIA", ativo=True,
               prioridade=prioridade, dificuldade=dificuldade, status="ATIVA",
               penalidade_xp=10)
    db.add(r); db.commit(); db.refresh(r)
    return r


def novo_pacto(db, u):
    p = Pacto(usuario_id=u.id, titulo="Faça {n} flexões", tipo="QUANTITATIVA",
              base=30, valor_atual=30, teto=200, ativo=True, ciclo=0, vezes_caiu=0)
    db.add(p); db.commit(); db.refresh(p)
    return p


def rodar():
    print("\n=== O MEDIDOR DE PUNIÇÃO ===\n")
    cli = TestClient(main.app)
    with cli:
        pass
    db = SessionLocal()
    u = db.query(Usuario).filter_by(nivel_acesso="Arquiteto").first() or db.query(Usuario).first()
    u.nivel_acesso = "Arquiteto"
    db.commit()
    hoje = tempo.hoje()
    limpar(db, u)

    # ── Quanto cada falha enche ─────────────────────────────────────
    print("-- a escala do enchimento --")
    rc = nova_rotina(db, u, "Crítica",  "CRITICA", "NORMAL")
    ra = nova_rotina(db, u, "Alta",     "ALTA",    "NORMAL")
    rm = nova_rotina(db, u, "Média",    "MEDIA",   "NORMAL")
    rb = nova_rotina(db, u, "Baixa",    "BAIXA",   "NORMAL")

    ok(medidor.quanto_enche(rc, db=db) >= 100,
       "CRÍTICA enche a barra INTEIRA numa falha — a Regra A virou o topo da escala")
    ok(medidor.quanto_enche(ra, db=db) == 40, "ALTA enche 40 (3 falhas)")
    ok(medidor.quanto_enche(rm, db=db) == 25, "MÉDIA enche 25 (4 falhas)")
    ok(medidor.quanto_enche(rb, db=db) == 15, "BAIXA enche 15 (7 falhas)")

    # O sentido invertido — a decisão que mais fácil se perde numa refatoração.
    rf = nova_rotina(db, u, "Fácil",    "MEDIA", "FACIL")
    rl = nova_rotina(db, u, "Lendária", "MEDIA", "LENDARIO")
    ok(medidor.quanto_enche(rf, db=db) > medidor.quanto_enche(rm, db=db),
       "falhar o FÁCIL enche MAIS que o normal — não tem desculpa")
    ok(medidor.quanto_enche(rl, db=db) < medidor.quanto_enche(rm, db=db),
       "e falhar o LENDÁRIO enche MENOS — é compreensível falhar o que é duro")

    # ── Transbordo acontece uma vez só ──────────────────────────────
    print("\n-- a barra transborda UMA vez --")
    ok(medidor.encher(db, rm)["transbordou"] is False, "1ª falha da média: 25, não transborda")
    medidor.encher(db, rm); medidor.encher(db, rm)
    ok(medidor.carga(rm) == 75, f"três falhas somam 75 ({medidor.carga(rm)})")
    ok(medidor.encher(db, rm)["transbordou"] is True, "a QUARTA transborda")
    ok(medidor.encher(db, rm)["transbordou"] is False,
       "e a quinta NÃO — barra cheia não transborda de novo (o polling não pune)")
    ok(medidor.carga(rm) == 100, "a carga trava em 100, não passa")

    leitura = medidor.leitura(rm, db=db)
    ok(leitura["cheio"] is True and leitura["falhas_para_encher"] == 0,
       "e a leitura diz que está cheia")
    medidor.esvaziar(db, rm)
    ok(medidor.carga(rm) == 0, "esvaziar sem argumento ZERA")
    ok(medidor.leitura(rm, db=db)["falhas_para_encher"] == 4,
       "e a leitura volta a prever 4 falhas — é isso que torna a punição previsível")

    # ── MODO OBSERVAÇÃO: enche e não pune ───────────────────────────
    print("\n-- modo observação: mede, não pune --")
    ok(economia.punicao_regras(db)["medidor_dispara"] is False,
       "a chave nasce DESLIGADA — fechamento.py não se troca às cegas")

    novo_pacto(db, u)
    ed = ExecucaoDia(rotina_id=ra.id, usuario_id=u.id, data=hoje, status="FRACASSADA")
    db.add(ed); db.commit()
    falha = {"titulo": ra.titulo, "data": hoje, "xp": 10,
             "critica": False, "diaria": True, "rotina_id": ra.id}

    carga_antes = medidor.carga(ra)
    fechamento._talvez_punir(db, u, [falha], hoje)
    db.refresh(ra)
    ok(medidor.carga(ra) > carga_antes,
       f"a barra ENCHEU mesmo com a chave desligada ({carga_antes} → {medidor.carga(ra)})")

    # E encheu até estourar sem punir por ela.
    medidor.esvaziar(db, ra, quanto=None)
    ra.carga_punicao = 99
    db.commit()
    antes_pen = penitencia.contar(db, u.id)
    fechamento._talvez_punir(db, u, [falha], hoje)
    db.refresh(ra)
    ok(medidor.carga(ra) == 100, "a barra transbordou (99 + 40 → 100)")
    ok(penitencia.contar(db, u.id) == antes_pen,
       "e NINGUÉM foi punido pelo transbordo — desligada, ela só mede")

    # ── CHAVE LIGADA: o medidor pune, e a Regra B se cala ───────────
    print("\n-- chave ligada: o medidor é o gatilho --")
    from motors import economia as _e
    original = _e.punicao_regras

    def ligada(db_=None):
        r = original(db_)
        r["medidor_dispara"] = True
        return r
    _e.punicao_regras = ligada
    fechamento.economia.punicao_regras = ligada

    db.query(TarefaDia).filter_by(usuario_id=u.id).delete(); db.commit()
    ra.carga_punicao = 99
    db.commit()
    r = fechamento._talvez_punir(db, u, [falha], hoje)
    db.refresh(ra)
    ok(r is not None and r.get("gatilho") == "medidor",
       f"a barra cheia disparou, e o gatilho se identifica ({r and r.get('gatilho')})")
    ok(penitencia.contar(db, u.id) == 1, "UMA penitência — não uma por barra mais uma pelo dia")

    div = penitencia.pendentes(db, u.id)[0]
    ok(div.origem_titulo == ra.titulo,
       f"e ela NOMEIA a rotina cuja barra encheu ('{div.origem_titulo}')")
    ok(div.origem_rotina_id == ra.id,
       "com o id junto — o texto mostra, o id age")

    # A trava contra a espiral: nada mais é cobrado no mesmo dia.
    antes = penitencia.contar(db, u.id)
    rm.carga_punicao = 99
    db.commit()
    fechamento._talvez_punir(db, u, [falha, {"titulo": rm.titulo, "data": hoje, "xp": 5,
                                             "critica": False, "diaria": True,
                                             "rotina_id": rm.id}], hoje)
    ok(penitencia.contar(db, u.id) == antes,
       "segunda barra cheia no MESMO dia não cobra de novo — um julgamento por dia")

    # ── Quitar zera o medidor ───────────────────────────────────────
    print("\n-- a dívida paga zera a barra --")
    db.refresh(ra)
    ok(medidor.carga(ra) == 100, "a barra da rotina punida está cheia")
    penitencia.quitar(db, u, div)
    db.commit(); db.refresh(ra)
    ok(medidor.carga(ra) == 0,
       "quitar ZERA — quem pagou não continua a um passo da próxima punição")

    # ── Reerguer devolve o passo, não zera ──────────────────────────
    print("\n-- Reerguer devolve o passo, e só ele --")
    ra.carga_punicao = 60
    db.commit()
    penitencia.cobrar(db, u, ra.titulo, hoje, xp_perdido=10, rotina_id=ra.id)
    db.commit()
    penitencia.revogar(db, u.id, ra.titulo, hoje)
    db.commit(); db.refresh(ra)
    ok(medidor.carga(ra) == 20,
       f"60 − 40 = 20: volta ao ponto de antes da falha desfeita ({medidor.carga(ra)})")
    ok(medidor.carga(ra) != 0,
       "e NÃO zera — Reerguer desfaz uma falha, não semanas de insistência")

    _e.punicao_regras = original
    fechamento.economia.punicao_regras = original

    # ── Os botões do Arquiteto ──────────────────────────────────────
    print("\n-- a bancada de teste do Arquiteto --")
    db.query(TarefaDia).filter_by(usuario_id=u.id).delete()
    rm.carga_punicao = 0
    db.commit()

    resp = rp.encher_medidor(rm.id, corpo=None, db=db, usuario=u)
    ok(resp["medidor"]["carga"] == 25, "o + enche um passo daquela rotina (25)")
    ok(resp["punicao"] is None, "sem transbordo, nada é cobrado")

    resp = rp.encher_medidor(rm.id, corpo=rp.MedidorIn(quanto=100), db=db, usuario=u)
    ok(resp["medidor"]["carga"] == 100, "e com valor explícito enche até o topo")
    ok(resp["punicao"] is not None, "o transbordo DISPAROU a punição de verdade")
    ok(len(resp["punicao"]["criadas"]) > 0, "com cartão criado — não é simulação")

    criada = db.query(TarefaDia).filter_by(usuario_id=u.id, natureza="PUNICAO").first()
    ok(criada.teste is True, "marcada como TESTE")
    ok(criada.origem_titulo == rm.titulo,
       f"e nomeando a rotina cuja barra o Arquiteto encheu ('{criada.origem_titulo}')")
    ok(criada.origem_rotina_id == rm.id, "com o elo para o medidor")

    resp = rp.esvaziar_medidor(rm.id, corpo=None, db=db, usuario=u)
    ok(resp["medidor"]["carga"] == 0, "o − zera")

    # ── A varredura devolve tudo ────────────────────────────────────
    print("\n-- testar o sistema não pode desligar o sistema --")
    pac = db.query(Pacto).filter_by(usuario_id=u.id).first()
    escalado = pac.valor_atual
    ok(escalado > pac.base, f"o pacto escalou com a punição de teste ({pac.base} → {escalado})")

    r = rp.limpar_testes(db=db, usuario=u)
    db.refresh(pac)
    ok(r["removidas"] >= 1, f"a varredura removeu {r['removidas']}")
    ok(penitencia.contar(db, u.id) == 0, "o teto está livre de novo")
    ok(pac.valor_atual < escalado,
       f"e o pacto DESESCALOU — a punição de teste não pode deixar rastro ({pac.valor_atual})")

    # ── A guarda ────────────────────────────────────────────────────
    print("\n-- só o Arquiteto opera --")
    u.nivel_acesso = "User"
    db.commit()
    for nome, fn in (("encher", lambda: rp.encher_medidor(rm.id, None, db, u)),
                     ("esvaziar", lambda: rp.esvaziar_medidor(rm.id, None, db, u)),
                     ("limpar", lambda: rp.limpar_testes(db, u))):
        try:
            fn()
            ok(False, f"{nome} deveria ser RECUSADO para user comum")
        except HTTPException as e:
            ok(e.status_code == 403, f"{nome}: 403 para user comum")

    # A leitura continua aberta: é o dado dele, quem esconde é a tela.
    lst = rp.listar_medidores(db=db, usuario=u)
    ok(len(lst["medidores"]) > 0, "mas LER os próprios medidores é permitido")
    ok(lst["sou_arquiteto"] is False,
       "e a resposta diz à interface que ela deve esconder")
    ok(lst["dispara"] is False, "e se encher pune ou apenas mede")

    u.nivel_acesso = "Arquiteto"
    db.commit()
    limpar(db, u)
    db.close()
    print(f"\n=== {testes - falhas}/{testes} ===")
    return falhas


if __name__ == "__main__":
    import sys
    sys.exit(1 if rodar() else 0)
