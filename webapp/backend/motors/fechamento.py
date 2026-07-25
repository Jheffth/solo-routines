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

from sqlalchemy.orm import Session

from database import SessionLocal, Rotina, ExecucaoDia, TarefaDia, Usuario

# Quantos dias para trás o job tenta materializar. Cobre uma ausência longa
# sem varrer o banco inteiro toda madrugada.
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


def _primeiro_dia(rotina: Rotina, limite: date) -> date:
    """
    Nunca materializamos antes de a rotina existir — senão inventaríamos
    fracassos de dias em que ela nem tinha sido criada.
    """
    nascimento = rotina.criado_em.date() if rotina.criado_em else limite
    return max(nascimento, limite)


def materializar(db: Session, usuario_id: int, ate: date | None = None,
                 janela: int = JANELA_DIAS) -> int:
    """
    Garante que exista um ExecucaoDia para cada dia devido dentro da janela.
    Devolve quantas instâncias foram criadas. Idempotente.
    """
    hoje = ate or date.today()
    inicio_janela = hoje - timedelta(days=janela)
    criadas = 0

    rotinas = db.query(Rotina).filter(
        Rotina.usuario_id == usuario_id, Rotina.ativo == True
    ).all()
    if not rotinas:
        return 0

    # Uma consulta só para saber o que já existe — evita N+1 por dia/rotina.
    existentes = {
        (ed.rotina_id, ed.data)
        for ed in db.query(ExecucaoDia.rotina_id, ExecucaoDia.data).filter(
            ExecucaoDia.usuario_id == usuario_id,
            ExecucaoDia.data >= inicio_janela,
            ExecucaoDia.data <= hoje,
        ).all()
    }

    for r in rotinas:
        dia = _primeiro_dia(r, inicio_janela)
        while dia <= hoje:
            if rotina_devida_em(r, dia) and (r.id, dia) not in existentes:
                db.add(ExecucaoDia(
                    rotina_id=r.id, usuario_id=usuario_id,
                    data=dia, status="PENDENTE",
                ))
                criadas += 1
            dia += timedelta(days=1)

    if criadas:
        db.flush()
    return criadas


def fechar_vencidas(db: Session, usuario: Usuario, ate: date | None = None) -> dict:
    """
    Fecha o que já venceu: instâncias de dias ANTERIORES a hoje que ficaram
    PENDENTE ou ATIVA viram FRACASSADA, com a penalidade declarada.
    O dia corrente nunca é tocado aqui.
    """
    hoje = ate or date.today()
    agora = datetime.utcnow()
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


def processar_usuario(db: Session, usuario: Usuario, ate: date | None = None) -> dict:
    """Materializa e fecha, para um hunter. Não faz commit — quem chama decide."""
    criadas = materializar(db, usuario.id, ate=ate)
    resumo = fechar_vencidas(db, usuario, ate=ate)
    resumo["materializadas"] = criadas
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
