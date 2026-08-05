# -*- coding: utf-8 -*-
"""
POR QUE A PUNIÇÃO PAROU DE CAIR — diagnóstico SOMENTE LEITURA.

    python scripts/diagnostico_punicao.py

Nada é gravado. A única escrita possível acontece dentro de um SAVEPOINT
que é desfeito no fim, e serve para uma coisa só: fazer aparecer o erro
que o código de produção esconde.

O PROBLEMA QUE ISTO INVESTIGA

A punição não avisa quando não cai. Ela tem QUATRO portas que se fecham
em silêncio, e nenhuma delas registra nada em log:

  1. `_talvez_punir` — se o gatilho não bate, devolve None e pronto.
     Não basta falhar uma missão: tem de ser CRÍTICA, ou TODAS as
     diárias do dia, ou N dias seguidos.
  2. `cobrar` → `sem_pacto` — sem Pacto ativo não há o que sortear.
  3. `cobrar` → `no_teto`   — atingido o teto, o Sistema PARA de criar.
  4. `except Exception: print(...); return None` dentro de
     `_talvez_punir`. Este é o mais perigoso: QUALQUER erro no caminho
     da penitência — coluna que falta, tipo incompatível, constraint —
     vira uma linha no stdout do servidor e o app segue funcionando
     perfeitamente em tudo o mais.

A porta 4 é a que casa com "parou depois da migração para o servidor
novo": nada mais quebrou, nenhum erro apareceu na tela, e a punição
simplesmente deixou de existir. Por isso o script REEXECUTA o caminho
com o `except` desligado — o objetivo é ver a exceção que a produção
engoliu, se ela existir.

E POR QUE NÃO É (SÓ) O SCHEDULER: `processar_usuario` roda em toda
leitura do Extrato (`routers/extrato.py`), não apenas no cron das 00h05.
Abrir o Dashboard já deveria bastar. Se a punição não cai nem assim, o
scheduler é inocente — mas o relógio dele é conferido abaixo do mesmo
jeito, porque ele desloca QUANDO o dia é julgado.
"""
import os
import sys
import time
import traceback
from datetime import timedelta

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACK = os.path.join(RAIZ, "webapp", "backend")
sys.path.insert(0, BACK)
os.chdir(BACK)                       # o .env mora aqui

from database import (SessionLocal, Usuario, Pacto, TarefaDia,      # noqa: E402
                      ExecucaoDia, Rotina, engine)
from motors import tempo, penitencia, economia, fechamento          # noqa: E402
from sqlalchemy import inspect, text                                # noqa: E402


def titulo(t):
    print(f"\n{'─' * 66}\n  {t}\n{'─' * 66}")


def diag():
    print("\n╔" + "═" * 64 + "╗")
    print("║  DIAGNÓSTICO DA PUNIÇÃO — somente leitura".ljust(65) + "║")
    print("╚" + "═" * 64 + "╝")

    # ══ 1. O RELÓGIO ═══════════════════════════════════════════════
    # O fechamento julga o dia pelo relógio de Brasília (motors/tempo),
    # mas o APScheduler agenda pelo fuso do SISTEMA OPERACIONAL. Num
    # servidor em UTC, o job das 00h05 dispara às 21h05 de Brasília — no
    # meio do dia do hunter, quando as diárias da noite ainda nem
    # venceram. O gatilho "TODAS as diárias falharam" nunca fecha assim.
    titulo("1 · O RELÓGIO")
    print(f"  TZ do sistema        : {os.environ.get('TZ') or time.tzname}")
    print(f"  APP_UTC_OFFSET       : {os.getenv('APP_UTC_OFFSET', '-3 (padrão)')}")
    print(f"  tempo.agora()        : {tempo.agora():%Y-%m-%d %H:%M:%S}  (Brasília)")
    print(f"  datetime local do SO : {__import__('datetime').datetime.now():%Y-%m-%d %H:%M:%S}")
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        tz_sched = BackgroundScheduler().timezone
        print(f"  fuso do APScheduler  : {tz_sched}")
        if str(tz_sched).upper() in ("UTC", "ETC/UTC"):
            print("    ⚠ o cron das 00h05 dispara às 21h05 de Brasília — o dia é")
            print("      julgado antes de acabar, e 'todas as diárias falharam'")
            print("      quase nunca fecha. Corrige-se com BackgroundScheduler(")
            print("      timezone=tempo.FUSO) ou TZ=America/Sao_Paulo no serviço.")
    except Exception as e:
        print(f"  fuso do APScheduler  : não consegui ler ({e})")

    # ══ 2. O SCHEMA ════════════════════════════════════════════════
    # Banco novo, migração que não rodou: as colunas que só a penitência
    # usa somem sem que mais nada quebre, porque nenhuma outra tela toca
    # nelas. É o defeito perfeito para passar despercebido.
    titulo("2 · AS COLUNAS QUE SÓ A PENITÊNCIA USA")
    print(f"  banco: {engine.dialect.name}")
    insp = inspect(engine)
    try:
        cols = {c["name"] for c in insp.get_columns("tarefas_dia")}
        faltando = [c for c in ("natureza", "pacto_id", "origem_titulo",
                                "origem_data", "xp_a_reparar", "alvo_repeticoes",
                                "prazo_minutos", "hora_inicio")
                    if c not in cols]
        if faltando:
            print(f"  ✗ FALTAM em tarefas_dia: {', '.join(faltando)}")
            print("    ⇒ é isto. `cobrar` explode ao montar a TarefaDia, o")
            print("      `except` de `_talvez_punir` engole, e nada acontece.")
        else:
            print("  ✓ todas presentes em tarefas_dia")
        if "pactos" not in insp.get_table_names():
            print("  ✗ a TABELA `pactos` não existe no banco novo")
        else:
            print("  ✓ tabela `pactos` existe")
    except Exception as e:
        print(f"  ✗ não consegui inspecionar: {e}")

    db = SessionLocal()
    hoje = tempo.hoje()
    regras = economia.punicao_regras(db)
    print(f"\n  regras da Balança: {regras}")

    usuarios = db.query(Usuario).filter(Usuario.ativo == True).all()
    print(f"  hunters ativos: {len(usuarios)}")

    for u in usuarios:
        titulo(f"3 · HUNTER  {u.login}  (id {u.id})")

        # ── as duas portas silenciosas de `cobrar` ────────────────
        pactos = db.query(Pacto).filter(Pacto.usuario_id == u.id).all()
        ativos = [p for p in pactos if p.ativo]
        print(f"  pactos: {len(pactos)} no total, {len(ativos)} ATIVOS")
        if not ativos:
            print("    ✗ SEM PACTO ATIVO ⇒ `cobrar` devolve sem_pacto e NADA é")
            print("      criado. O Eco sai ('Você falhou impunemente'), a")
            print("      penitência não. Se os pactos não vieram na migração,")
            print("      é exatamente este o sintoma.")
        else:
            for p in ativos[:6]:
                print(f"      · [{p.tipo}] {p.titulo!r} base={p.base} "
                      f"atual={p.valor_atual} ciclo={p.ciclo}")

        pend = penitencia.contar(db, u.id)
        print(f"  penitências PENDENTES: {pend} / teto {regras['divida_teto']}")
        if pend >= regras["divida_teto"]:
            print("    ✗ NO TETO ⇒ o Sistema PAROU DE CRIAR, e isso é de")
            print("      propósito (evita a bola de neve). Quitar as abertas")
            print("      destrava. Não é defeito — mas parece um.")

        # ── houve falha para punir? ───────────────────────────────
        d7 = hoje - timedelta(days=7)
        frac = (db.query(ExecucaoDia)
                  .filter(ExecucaoDia.usuario_id == u.id,
                          ExecucaoDia.data >= d7,
                          ExecucaoDia.status == "FRACASSADA").count())
        abertas = (db.query(ExecucaoDia)
                     .filter(ExecucaoDia.usuario_id == u.id,
                             ExecucaoDia.data < hoje,
                             ExecucaoDia.status.in_(("PENDENTE", "ATIVA"))).count())
        print(f"  execuções FRACASSADAS nos últimos 7 dias: {frac}")
        print(f"  execuções de dias PASSADOS ainda em aberto: {abertas}")
        if abertas:
            print("    ⚠ dia velho sem fechar significa que `fechar_vencidas` não")
            print("      está passando por elas — sem falha registrada não há o")
            print("      que punir, e o problema é ANTES da penitência.")
        if not frac and not abertas:
            print("    ⚠ nenhuma falha na semana: a punição não cair pode ser")
            print("      simplesmente não haver o que punir.")

        # ── o gatilho, com os dados reais ─────────────────────────
        # Reconstrói o que `fechar_vencidas` entregaria HOJE, sem fechar
        # nada: só para saber se o gatilho fecharia.
        falhas_hoje = (db.query(ExecucaoDia, Rotina)
                         .join(Rotina, Rotina.id == ExecucaoDia.rotina_id)
                         .filter(ExecucaoDia.usuario_id == u.id,
                                 ExecucaoDia.data == hoje,
                                 ExecucaoDia.status == "FRACASSADA").all())
        lista = [{"titulo": r.titulo, "data": ed.data, "xp": r.penalidade_xp or 0,
                  "critica": (r.prioridade or "").upper() == "CRITICA",
                  "diaria": (r.tipo or "").upper() == "DIARIA"}
                 for ed, r in falhas_hoje]
        total_diarias = fechamento._diarias_do_dia(db, u, hoje)
        seguidos = fechamento._dias_seguidos_com_falha(db, u, hoje)
        print(f"\n  gatilho HOJE ({hoje}):")
        print(f"    falhas de hoje        : {len(lista)}")
        print(f"    delas CRÍTICAS        : {sum(1 for f in lista if f['critica'])}")
        print(f"    diárias falhadas/total: "
              f"{sum(1 for f in lista if f['diaria'])} / {total_diarias}")
        print(f"    dias seguidos c/ falha: {seguidos} "
              f"(precisa {regras['dias_seguidos']})")

        # ══ 4. A EXCEÇÃO ENGOLIDA ═══════════════════════════════════
        # `_talvez_punir` tem `except Exception: print(); return None`.
        # Aqui o caminho é refeito SEM esse except, dentro de um SAVEPOINT
        # que é desfeito — se houver um erro escondido, ele aparece.
        if lista and ativos and pend < regras["divida_teto"]:
            titulo("4 · O CAMINHO REAL, COM O `except` DESLIGADO")
            print("  (dentro de um SAVEPOINT — nada fica gravado)")
            sp = db.begin_nested()
            try:
                alvo = ([f for f in lista if f["critica"]] or lista)[0]
                r = penitencia.cobrar(db, u, alvo["titulo"], alvo["data"],
                                      xp_perdido=alvo["xp"],
                                      dobrar=alvo["critica"])
                print(f"  ✓ `cobrar` NÃO explodiu. Devolveu: "
                      f"criadas={len(r.get('criadas') or [])} "
                      f"sem_pacto={r.get('sem_pacto')} no_teto={r.get('no_teto')}")
                if not r.get("criadas"):
                    print("    ⇒ então o motivo é uma das portas acima, não um erro.")
            except Exception:
                print("  ✗✗ EXCEÇÃO — É ISTO QUE A PRODUÇÃO ESTAVA ENGOLINDO:\n")
                traceback.print_exc()
            finally:
                sp.rollback()
        else:
            titulo("4 · O CAMINHO REAL — não executado")
            print("  falta condição para tentar cobrar hoje:")
            print(f"    há falha hoje? {bool(lista)} | pacto ativo? {bool(ativos)} "
                  f"| abaixo do teto? {pend < regras['divida_teto']}")

    db.rollback()          # garante que nada, em hipótese alguma, ficou
    db.close()
    print("\n" + "═" * 66)
    print("  fim — nada foi gravado")
    print("═" * 66 + "\n")


if __name__ == "__main__":
    diag()
