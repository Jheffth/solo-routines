# -*- coding: utf-8 -*-
"""
Fechamento do dia — o que transforma uma agenda em histórico.

Por que existe: até aqui, a instância diária de uma rotina (ExecucaoDia) só
nascia quando o hunter ABRIA o app e a rotina era do dia. Quem passasse três
dias fora simplesmente não tinha esses dias no banco — e um extrato honesto
precisa deles. Pior: o "fracassou" era disparado pelo navegador, então um dia
vencido ficava PENDENTE para sempre se ninguém entrasse.

Este motor resolve os dois lados:
  • materializa as instâncias dos dias devidos (idempotente);
  • fecha o que venceu: PENDENTE|ATIVA de dia passado → FRACASSADA, com a
    penalidade que a própria rotina/missão declara.

Roda no scheduler (madrugada) e é seguro chamar quantas vezes quiser: tudo é
"garantir que", nunca "somar de novo".

REGRA DE OURO: só fechamos dias JÁ PASSADOS. O dia corrente é do hunter até
a virada — quem decide que hoje fracassou é o prazo da missão, não este job.
"""
import json
from datetime import date, datetime, timedelta
from motors import tempo

from sqlalchemy.orm import Session

from database import SessionLocal, Rotina, ExecucaoDia, TarefaDia, Usuario

# Quantos dias para trás o fechamento OLHA ao fechar pendências.
# Não é backfill: serve para o job encontrar dias que já existiam e ficaram
# abertos, nunca para inventar dias que ninguém viveu.
JANELA_DIAS = 30


def rotina_devida_em(rotina: Rotina, dia: date) -> bool:
    """A rotina cai neste dia, segundo sua frequência? (não olha o passado)"""
    if not rotina.ativo:
        return False
    if rotina.tipo == "DIARIA":
        return True
    if rotina.tipo == "SEMANAL":
        try:
            dias = json.loads(rotina.dias_semana) if rotina.dias_semana else []
        except Exception:
            dias = []
        return dia.weekday() in dias
    if rotina.tipo == "MENSAL":
        return dia.day == rotina.dia_mes
    if rotina.tipo == "ANUAL":
        if rotina.mes_dia:
            try:
                m, d = rotina.mes_dia.split("-")
                return dia.month == int(m) and dia.day == int(d)
            except Exception:
                return False
    return False


def materializar(db: Session, usuario_id: int, ate: date | None = None) -> int:
    """
    Garante que exista o ExecucaoDia do DIA CORRENTE para cada rotina devida.
    Devolve quantas instâncias foram criadas. Idempotente.

    SÓ O DIA CORRENTE, e isto é uma decisão, não um limite técnico.

    A versão anterior varria 30 dias para trás e criava instâncias de dias
    que o hunter nunca viveu — que o fechamento em seguida marcava como
    FRACASSADA, com penalidade. Ou seja: inventava derrotas retroativas.
    Isso contradizia a decisão tomada ("começar do zero: o que não foi
    observado não vira registro") e podia zerar o XP de alguém por dias
    anteriores à existência da funcionalidade.

    Não perdemos histórico com isso: o job das 00h05 roda todo dia e
    materializa o dia dele. Cada dia nasce no seu próprio dia, mesmo que o
    hunter não abra o app.
    """
    hoje = ate or tempo.hoje()
    criadas = 0

    rotinas = db.query(Rotina).filter(
        Rotina.usuario_id == usuario_id, Rotina.ativo == True
    ).all()
    if not rotinas:
        return 0

    # Uma consulta só para saber o que já existe hoje — nada de N+1.
    existentes = {
        ed.rotina_id
        for ed in db.query(ExecucaoDia.rotina_id).filter(
            ExecucaoDia.usuario_id == usuario_id,
            ExecucaoDia.data == hoje,
        ).all()
    }

    for r in rotinas:
        # Uma rotina criada hoje à noite não deve gerar a missão de hoje se
        # a janela dela já passou? Deve sim — quem cria decide. O que não
        # pode é gerar dias ANTERIORES ao próprio nascimento.
        nascimento = tempo.dia_de_utc(r.criado_em) or hoje
        if nascimento > hoje:
            continue
        if rotina_devida_em(r, hoje) and r.id not in existentes:
            db.add(ExecucaoDia(
                rotina_id=r.id, usuario_id=usuario_id,
                data=hoje, status="PENDENTE",
            ))
            criadas += 1

    if criadas:
        db.flush()
    return criadas


def fechar_vencidas(db: Session, usuario: Usuario, ate: date | None = None) -> dict:
    """
    Fecha o que já venceu: instâncias de dias ANTERIORES a hoje que ficaram
    PENDENTE ou ATIVA viram FRACASSADA, com a penalidade declarada.
    O dia corrente nunca é tocado aqui.
    """
    hoje = ate or tempo.hoje()
    agora = tempo.agora()
    rotinas_fechadas = 0
    gerais_fechadas = 0
    xp_perdido_total = 0

    # ── Instâncias de rotina ──────────────────────────────────────────
    pendentes = db.query(ExecucaoDia).filter(
        ExecucaoDia.usuario_id == usuario.id,
        ExecucaoDia.data < hoje,
        ExecucaoDia.status.in_(("PENDENTE", "ATIVA")),
    ).all()

    if pendentes:
        # Penalidade vive na rotina-mãe: busca todas de uma vez.
        ids = {ed.rotina_id for ed in pendentes}
        penal = {
            r.id: (getattr(r, "penalidade_xp", 0) or 0)
            for r in db.query(Rotina).filter(Rotina.id.in_(ids)).all()
        }
        for ed in pendentes:
            pen = penal.get(ed.rotina_id, 0)
            ed.status = "FRACASSADA"
            ed.fracassada_em = agora
            ed.xp_perdido = pen
            xp_perdido_total += pen
            rotinas_fechadas += 1

    # ── Missões gerais (avulsas) ──────────────────────────────────────
    tarefas = db.query(TarefaDia).filter(
        TarefaDia.usuario_id == usuario.id,
        TarefaDia.data_prevista < hoje,
        TarefaDia.status.in_(("PENDENTE", "ATIVA", "PAUSADA")),
    ).all()
    for t in tarefas:
        t.status = "FRACASSADA"
        xp_perdido_total += (t.penalidade_xp or 0)
        gerais_fechadas += 1

    # Uma subtração só, no fim: XP nunca fica negativo.
    if xp_perdido_total:
        usuario.xp_total = max(0, (usuario.xp_total or 0) - xp_perdido_total)
        usuario.xp_atual = max(0, (usuario.xp_atual or 0) - xp_perdido_total)

    return {
        "rotinas": rotinas_fechadas,
        "gerais": gerais_fechadas,
        "xp_perdido": xp_perdido_total,
    }


def reparar_fechamento_indevido(db: Session, usuario: Usuario,
                                ate: date | None = None) -> dict:
    """
    Desfaz as derrotas que o relógio errado provocou.

    Enquanto o servidor decidia o dia em UTC, às 21:00 de Brasília ele já
    considerava amanhã — e fechava como FRACASSADA as missões de HOJE que
    ainda tinham prazo, descontando o XP. Uma rotina com janela 20:00–22:00
    era punida uma hora antes de vencer, todo dia.

    Este reparo é conservador de propósito: mexe apenas em instâncias de
    HOJE OU DO FUTURO. O passado é histórico legítimo e não se reescreve.

    Idempotente: rodar duas vezes não devolve XP duas vezes, porque ao
    reabrir ele zera `xp_perdido` — na segunda passada não há o que devolver.
    """
    hoje = ate or tempo.hoje()

    indevidas = db.query(ExecucaoDia).filter(
        ExecucaoDia.usuario_id == usuario.id,
        ExecucaoDia.data >= hoje,                    # hoje ou depois
        ExecucaoDia.status == "FRACASSADA",
    ).all()

    xp_devolvido = 0
    for ed in indevidas:
        xp_devolvido += ed.xp_perdido or 0
        ed.status = "PENDENTE"                       # volta a ser jogável
        ed.fracassada_em = None
        ed.xp_perdido = 0
        # E o cronômetro volta ao zero. Sem isto, a missão reaberta ficava
        # PENDENTE mas com a hora de início preservada — e o cartão exibia um
        # contador correndo há 11 horas numa missão que nem começou. Voltar a
        # PENDENTE significa, por definição, que ela ainda não teve largada.
        ed.iniciada_em = None

    tarefas = db.query(TarefaDia).filter(
        TarefaDia.usuario_id == usuario.id,
        TarefaDia.data_prevista >= hoje,
        TarefaDia.status == "FRACASSADA",
    ).all()
    for t in tarefas:
        xp_devolvido += t.penalidade_xp or 0
        t.status = "PENDENTE"
        t.iniciada_em = None      # mesma regra: PENDENTE não tem cronômetro

    if xp_devolvido:
        usuario.xp_total = (usuario.xp_total or 0) + xp_devolvido
        usuario.xp_atual = (usuario.xp_atual or 0) + xp_devolvido
        # O nível pode ter caído junto com o XP; devolve-o ao lugar.
        try:
            from motors.gamificacao import recalcular_nivel
            recalcular_nivel(db, usuario)
        except Exception:
            pass

    return {"reabertas": len(indevidas) + len(tarefas), "xp_devolvido": xp_devolvido}


def processar_usuario(db: Session, usuario: Usuario, ate: date | None = None) -> dict:
    """Materializa e fecha, para um hunter. Não faz commit — quem chama decide."""
    # O reparo vem PRIMEIRO: se o relógio errado fechou a missão de hoje,
    # ela precisa voltar a existir antes que qualquer outra coisa a leia.
    reparo = reparar_fechamento_indevido(db, usuario, ate=ate)
    criadas = materializar(db, usuario.id, ate=ate)
    resumo = fechar_vencidas(db, usuario, ate=ate)
    resumo["materializadas"] = criadas
    resumo["reabertas"] = reparo["reabertas"]
    resumo["xp_devolvido"] = reparo["xp_devolvido"]
    return resumo


def rodar(ate: date | None = None, verbose: bool = True) -> dict:
    """
    Passada completa: todos os hunters ativos. É o que o scheduler chama.
    Uma sessão por execução; um hunter com problema não derruba os outros.
    """
    db = SessionLocal()
    total = {"materializadas": 0, "rotinas": 0, "gerais": 0, "xp_perdido": 0, "erros": 0}
    try:
        usuarios = db.query(Usuario).filter(Usuario.ativo == True).all()
        for u in usuarios:
            try:
                r = processar_usuario(db, u, ate=ate)
                db.commit()
                for k in ("materializadas", "rotinas", "gerais", "xp_perdido"):
                    total[k] += r.get(k, 0)
            except Exception as e:
                db.rollback()
                total["erros"] += 1
                print(f"[FECHAMENTO] ⚠ hunter {u.login}: {e}")
    finally:
        db.close()

    if verbose:
        print(f"[FECHAMENTO] {total['materializadas']} instância(s) criada(s), "
              f"{total['rotinas']} rotina(s) e {total['gerais']} missão(ões) geral(is) "
              f"fechada(s), -{total['xp_perdido']} XP.")
    return total
