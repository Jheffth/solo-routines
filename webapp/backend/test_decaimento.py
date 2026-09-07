# -*- coding: utf-8 -*-
"""
O CAMINHO DE VOLTA — o teto deixou de ser permanente.

O ARQUITETO VIU E TROUXE:

    "Faça 30 flexões · caiu 51× · 10 → 30 → 30 · no teto"

Um pacto que subiu ao teto em DUAS quedas e ficou lá pelas outras 49.
Entre a queda nº 2 e a nº 51 não havia diferença nenhuma — que é
exatamente a morte da mecânica que o docstring de `decair` foi escrito
para evitar: "sem reset, o hunter chega ao teto e mora lá".

O DEFEITO ERA DE FORMA, NÃO DE FÓRMULA

`decair` estava certo. O que estava errado era QUANDO ele rodava:
`_aplicar_decaimento` era chamado de um lugar só, dentro do sorteio, ou
seja, no instante em que a penitência caía de novo. Três consequências,
todas medidas:

  1. comportar-se não devolvia nada. Trinta dias limpos rodavam o
     decaimento ZERO vezes — o único jeito de ver a penitência recuar
     era falhar outra vez;
  2. com o teto de dívidas cheio, `cobrar` retorna ANTES do sorteio;
     então nada decaía, nunca, justamente para quem estava mais fundo;
  3. e quando enfim rodava, a escalada da mesma queda anulava o recuo.

A correção: `valor_vigente` deriva o valor a cada leitura. `valor_atual`
e `ultima_queda` sempre contiveram a verdade — faltava calculá-la em vez
de esperar um evento para gravá-la.

Uso: DATABASE_URL=sqlite:///./x.db SECRET_KEY=... python test_decaimento.py
"""
from datetime import date, timedelta

import main                                     # noqa: F401
from fastapi.testclient import TestClient
from database import SessionLocal, Usuario, Pacto, TarefaDia, Rotina, ExecucaoDia
from motors import tempo, pactos as cat, economia, penitencia
from routers import pactos as rp

falhas = testes = 0


def ok(cond, msg):
    global falhas, testes
    testes += 1
    if not cond:
        falhas += 1
    print(("  [ok]  " if cond else "  [XX]  ") + msg)


def rodar():
    print("\n=== O CAMINHO DE VOLTA ===\n")
    cli = TestClient(main.app)
    with cli:
        pass
    db = SessionLocal()
    u = db.query(Usuario).filter_by(nivel_acesso="Arquiteto").first() or db.query(Usuario).first()
    u.nivel_acesso = "Arquiteto"
    db.query(Pacto).filter_by(usuario_id=u.id).delete()
    db.query(TarefaDia).filter_by(usuario_id=u.id).delete()
    db.commit()

    r = economia.punicao_regras(db)
    D, FD, FE = r["decaimento_dias"], r["decaimento_fator"], r["escala_fator"]
    Q = date(2026, 9, 6)

    # ── O caso do Arquiteto, dia a dia ──────────────────────────────
    print("-- 'Faça 30 flexões · caiu 51× · no teto' --")
    vig = lambda d: cat.valor_vigente(30, 10, "QUANTITATIVA", Q, Q + timedelta(days=d), D, FD)

    ok(vig(0) == 30, "no dia da queda: 30 — o teto é real")
    ok(vig(D - 1) == 30, f"e continua 30 até o {D-1}º dia limpo — recuo tem preço")
    ok(vig(D) < 30, f"no {D}º dia limpo ele RECUA ({vig(D)})")
    ok(vig(2 * D) == 10, f"e em {2*D} dias volta à base ({vig(2*D)})")
    ok(vig(365) == 10, "nunca abaixo da base — a penitência recua, não some")

    # A prova do defeito antigo, em uma linha.
    ok(vig(30) != 30,
       "TRINTA DIAS LIMPOS mudam o número — antes desta correção, não mudavam")

    # ── O que o card serve ──────────────────────────────────────────
    print("\n-- o que o card mostra --")
    p = Pacto(usuario_id=u.id, titulo="Faça {n} flexões", tipo="QUANTITATIVA",
              base=10, valor_atual=30, teto=30, ativo=True, ciclo=0,
              vezes_caiu=51, ultima_queda=tempo.hoje() - timedelta(days=D))
    db.add(p); db.commit(); db.refresh(p)

    s = rp._serial(p, r, tempo.hoje())
    ok(s["valor_atual"] == 15, f"o card serve o VIGENTE, não o gravado ({s['valor_atual']})")
    ok(s["valor_registrado"] == 30, "e o gravado vem junto, para conferência (30)")
    ok(s["recuando"] is True, "com a marca de que o recuo está em curso")
    ok("15" in s["exemplo"], f"o texto da penitência acompanha: '{s['exemplo']}'")
    ok(s["dias_para_recuar"] == D,
       f"e diz quando cai o próximo degrau ({s['dias_para_recuar']} dias)")
    ok(s["na_base"] is False, "ainda não está na base")

    # Depois de duas semanas limpas.
    p.ultima_queda = tempo.hoje() - timedelta(days=2 * D)
    db.commit()
    s = rp._serial(p, r, tempo.hoje())
    ok(s["valor_atual"] == 10 and s["na_base"] is True,
       "duas semanas limpas: de volta à base, e o card diz isso")
    ok(s["dias_para_recuar"] is None, "sem prometer recuo que não existe mais")

    # ── A contagem regressiva é cíclica ─────────────────────────────
    print("\n-- a contagem regressiva não trava em zero --")
    # O defeito que a placa do dashboard tinha: `dias − passados`, preso
    # em zero. Com 10 dias corridos e degrau de 7, dizia "recua já".
    faltam = cat.dias_para_recuar(50, 5, "QUANTITATIVA", Q, Q + timedelta(days=D + 3), D, FD)
    ok(faltam == D - 3,
       f"passados {D+3} dias, faltam {faltam} para o degrau seguinte (não 0)")

    # ── O recuo materializa antes de escalar ────────────────────────
    print("\n-- o recuo conquistado não se perde na queda --")
    db.query(Pacto).filter_by(usuario_id=u.id).delete()
    p = Pacto(usuario_id=u.id, titulo="Faça {n} flexões", tipo="QUANTITATIVA",
              base=10, valor_atual=30, teto=30, ativo=True, ciclo=0,
              vezes_caiu=51, ultima_queda=tempo.hoje() - timedelta(days=2 * D))
    db.add(p); db.commit(); db.refresh(p)

    res = penitencia.cobrar(db, u, "Rotina X", tempo.hoje(), xp_perdido=10)
    db.commit(); db.refresh(p)
    criada = db.query(TarefaDia).filter_by(usuario_id=u.id, natureza="PUNICAO").first()

    ok(criada is not None, "a penitência caiu")
    ok(criada.alvo_repeticoes == 10,
       f"e cobrou o VIGENTE (10), não o gravado (30) — o tempo limpo valeu ({criada.alvo_repeticoes})")
    ok(p.valor_atual == 20,
       f"e só então escalou: 10 → 20 ({p.valor_atual}), em vez de 30 → 30")
    ok(p.ultima_queda == tempo.hoje(), "com o relógio do recuo zerado a partir de hoje")

    # ── O teto de dívidas não congela mais o recuo ──────────────────
    print("\n-- teto de dívidas cheio não congela mais o pacto --")
    # Antes, `cobrar` retornava antes do sorteio e o decaimento nunca
    # rodava — quem estava mais afundado era quem menos recuava.
    db.query(TarefaDia).filter_by(usuario_id=u.id).delete()
    for i in range(r["divida_teto"]):
        t = TarefaDia(titulo=f"divida {i}", data_prevista=tempo.hoje(), prioridade="ALTA",
                      categoria="Combate", status="PENDENTE", usuario_id=u.id)
        t.natureza = "PUNICAO"
        db.add(t)
    p.valor_atual = 30
    p.ultima_queda = tempo.hoje() - timedelta(days=2 * D)
    db.commit()

    res = penitencia.cobrar(db, u, "Rotina Y", tempo.hoje())
    ok(res.get("no_teto") is True, "o Sistema recusa criar — correto")
    s = rp._serial(p, r, tempo.hoje())
    ok(s["valor_atual"] == 10,
       f"MAS o pacto recuou assim mesmo ({s['valor_atual']}) — o recuo é do tempo, não da queda")

    # ── Subida e descida são calibráveis em separado ────────────────
    print("\n-- a assimetria é do Arquiteto, na Balança --")
    ok("decaimento_fator" in r, "existe um fator de descida próprio")
    ok(FD == FE,
       f"que NASCE igual ao de subida ({FD} = {FE}) — o defeito era a derivação, "
       f"não a calibração")
    # Com um fator mais generoso, uma semana apaga duas quedas.
    generoso = cat.valor_vigente(30, 10, "QUANTITATIVA", Q, Q + timedelta(days=D), D, 3.0)
    ok(generoso == 10,
       f"e virar para 3 na Balança faz uma semana limpa apagar duas quedas ({generoso})")

    # ── Nada disso quebra o que já existia ──────────────────────────
    print("\n-- o que não mudou --")
    ok(cat.escalar(10, "QUANTITATIVA", 30, FE) == 20, "escalar segue igual")
    ok(cat.escalar(20, "QUANTITATIVA", 30, FE) == 30, "e ainda trava no teto")
    ok(cat.decair(30, 10, "QUANTITATIVA", 0, FD) == 30, "zero degraus não mexe em nada")
    ok(cat.valor_vigente(30, 10, "QUANTITATIVA", None, tempo.hoje(), D, FD) == 30,
       "pacto que nunca caiu não recua do nada")
    # ESTE ASSERT EU ESCREVI ERRADO NA PRIMEIRA VEZ, esperando que fator
    # 1 descesse até a base. Não desce, e está certo: dividir por 1 é não
    # decair, e essa é a leitura honesta de "fator 1". O que o guard
    # `max(1.0001, f)` protege é outra coisa — a divisão por zero e o
    # valor que cresceria com fator < 1. Registrado porque um assert
    # errado que "passa depois de ajustar o código" é como um defeito
    # entra fingindo ser correção.
    ok(cat.decair(30, 10, "QUANTITATIVA", 3, 1.0) == 30,
       "fator 1 é 'não decai' — e o resultado não explode nem sobe")
    ok(cat.decair(30, 10, "QUANTITATIVA", 3, 0) == 10,
       "fator 0 não divide por zero: cai no padrão e desce até a base")
    ok(cat.decair(30, 10, "QUANTITATIVA", 3, -5) >= 10,
       "e fator negativo não faz a penitência CRESCER no caminho de volta")
    ok(economia.punicao_regras(db)["decaimento_fator"] >= 1.01,
       "a Balança nunca entrega um fator que não desce")

    db.query(Pacto).filter_by(usuario_id=u.id).delete()
    db.query(TarefaDia).filter_by(usuario_id=u.id).delete()
    db.commit()
    db.close()
    print(f"\n=== {testes - falhas}/{testes} ===")
    return falhas


if __name__ == "__main__":
    import sys
    sys.exit(1 if rodar() else 0)
