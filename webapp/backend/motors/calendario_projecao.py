# -*- coding: utf-8 -*-
"""
A PROJEÇÃO — o que está programado, dia a dia.

O FATO QUE DECIDE ESTE ARQUIVO

`motors/fechamento.py`, em `materializar()`, diz em letras maiúsculas:

    SÓ O DIA CORRENTE, e isto é uma decisão, não um limite técnico. A
    versão anterior varria 30 dias para trás e criava instâncias de dias
    que o hunter nunca viveu — ou seja: inventava derrotas retroativas.

Consequência: **os dias futuros não existem no banco**. Só há
`ExecucaoDia` de hoje. Um calendário que mostra a semana que vem não
consulta linhas — ele PROJETA A REGRA.

E daí sai a distinção que atravessa a tela inteira:

    passado → FATO      (linhas reais; nunca se projeta o passado,
                         senão voltamos a inventar derrota)
    hoje    → FATO      (já materializado pelo job das 00h05)
    futuro  → PREVISÃO  (projeção; `real=False`)

Se previsão e fato tiverem a mesma aparência, a tela mente de um jeito
particularmente cruel: mostra como consumado um dia que ainda pode ser
qualquer coisa. O `real` existe para o desenho poder separá-los.

POR QUE ESTE MOTOR EXISTE EM VEZ DE MAIS UMA CÓPIA

A pergunta "esta missão cai neste dia?" já tinha TRÊS respostas no
projeto: `rotina_devida_em` no fechamento, as funções privadas do
`routers/dungeons.py`, e o RRULE do `calendario_eventos.py`. Uma quarta
aqui era o erro previsível — e este projeto já pagou por ele: o
`_prazo_da_sessao` chegou a ter três cópias divergentes, e o HUD mostrava
"ABERTO" numa dungeon vencida.

As quatro funções de dungeon subiram do router para cá, e o router passou
a importá-las daqui. Uma cópia a menos, não uma a mais.
"""
from __future__ import annotations

import json
from datetime import date, datetime, timedelta

from database import Dungeon, ExecucaoDia, Rotina, TarefaDia
from motors import fechamento, tempo

# Teto de dias por consulta. Acima disto, ou a tela pediu o que não cabe
# nela, ou é um laço — e 700 ocorrências por rotina num `GET` que parece
# inocente derrubam o servidor sem nenhum aviso.
MAX_DIAS = 92


# ══════════════════════════════════════════════════════════════════════
# DUNGEON — funções que vieram do routers/dungeons.py
# ══════════════════════════════════════════════════════════════════════
def agenda_do_dia(d: Dungeon, dia: date):
    """Config da agenda semanal para o weekday do dia (None = sem override)."""
    try:
        agenda = json.loads(d.agenda_semanal) if getattr(d, "agenda_semanal", None) else {}
        return agenda.get(str(dia.weekday()))
    except Exception:
        return None


def horario_do_dia(d: Dungeon, dia: date) -> tuple:
    """(entrada, saída) — o override da agenda semanal ou o padrão."""
    cfg = agenda_do_dia(d, dia)
    if cfg:
        return (cfg.get("entrada") or d.hora_entrada, cfg.get("saida") or d.hora_saida)
    return (d.hora_entrada, d.hora_saida)


def eh_folga(d: Dungeon, dia: date) -> bool:
    try:
        folgas = json.loads(d.folgas) if getattr(d, "folgas", None) else []
        return dia.isoformat() in folgas
    except Exception:
        return False


def dungeon_devida_em(d: Dungeon, dia: date) -> bool:
    """O portão abre neste dia?"""
    if d.status != "ATIVA":
        return False
    if eh_folga(d, dia):
        return False
    cfg = agenda_do_dia(d, dia)
    if cfg is not None and not cfg.get("aberto", True):
        return False

    if d.tipo_permanencia == "TEMPORARIA":
        ini = d.data_inicio or dia
        fim = d.data_fim or dia
        return ini <= dia <= fim

    t = d.tipo_recorrencia or "DIARIA"
    if t == "DIARIA":
        return True
    if t == "SEMANAL":
        try:
            dias = json.loads(d.dias_semana) if d.dias_semana else []
        except Exception:
            dias = []
        return dia.weekday() in dias
    if t == "MENSAL":
        return dia.day == d.dia_mes
    if t == "ANUAL" and d.mes_dia:
        try:
            m, dd = d.mes_dia.split("-")
            return dia.month == int(m) and dia.day == int(dd)
        except Exception:
            return False
    return False


# ══════════════════════════════════════════════════════════════════════
# A OCORRÊNCIA
# ══════════════════════════════════════════════════════════════════════
def _oco(origem, oid, titulo, **extra) -> dict:
    base = {
        "origem": origem, "origem_id": oid, "titulo": titulo,
        "icone": None, "cor": None, "categoria": None, "rank": None,
        "hora_inicio": None, "hora_fim": None, "natureza": None,
        "real": False, "status": None,
    }
    base.update(extra)
    return base


def _de_rotina(r: Rotina, ed: ExecucaoDia | None) -> dict:
    return _oco(
        "rotina", r.id, r.titulo,
        icone=r.icone, cor=r.cor, categoria=r.categoria,
        hora_inicio=r.hora_inicio, hora_fim=r.hora_fim,
        natureza=getattr(r, "natureza", None),
        prioridade=getattr(r, "prioridade", None),
        xp=getattr(r, "xp_recompensa", 0),
        real=ed is not None,
        status=(ed.status if ed else None),
    )


def _de_dungeon(d: Dungeon, dia: date) -> dict:
    ent, sai = horario_do_dia(d, dia)
    # `sempre_aberta` NÃO ganha bloco de horário: um portão que não fecha
    # não tem janela, e desenhar uma seria pôr de volta na tela a regra
    # que o Solo aboliu.
    if getattr(d, "sempre_aberta", False):
        ent = sai = None
    return _oco(
        "dungeon", d.id, d.titulo,
        icone=d.icone, cor=d.cor, categoria=d.categoria, rank=d.rank,
        hora_inicio=ent, hora_fim=sai,
        sempre_aberta=bool(getattr(d, "sempre_aberta", False)),
        xp=getattr(d, "xp_clear", 0),
        real=False,
    )


def _de_tarefa(t: TarefaDia) -> dict:
    return _oco(
        "tarefa", t.id, t.titulo,
        categoria=t.categoria, hora_inicio=getattr(t, "hora_inicio", None),
        hora_fim=t.hora_limite, natureza=getattr(t, "natureza", None),
        prioridade=t.prioridade, xp=t.xp_recompensa,
        real=True, status=t.status,
    )


# ══════════════════════════════════════════════════════════════════════
# O MOTOR
# ══════════════════════════════════════════════════════════════════════
def ocorrencias(db, usuario_id: int, de: date, ate: date) -> dict:
    """
    `{ 'YYYY-MM-DD': [ocorrência, ...] }` para o intervalo.

    Levanta `ValueError` num intervalo grande demais — o teto existe para
    o endpoint poder recusar com uma mensagem em vez de travar.
    """
    if ate < de:
        de, ate = ate, de
    if (ate - de).days + 1 > MAX_DIAS:
        raise ValueError(f"Intervalo grande demais (máximo {MAX_DIAS} dias).")

    hoje = tempo.hoje()

    rotinas = db.query(Rotina).filter(
        Rotina.usuario_id == usuario_id, Rotina.ativo == True).all()      # noqa: E712
    dungeons = db.query(Dungeon).filter(
        Dungeon.usuario_id == usuario_id, Dungeon.status == "ATIVA").all()

    # UMA CONSULTA para as instâncias reais do intervalo inteiro, e não
    # uma por dia. Trinta dias × N rotinas seriam trinta idas ao banco
    # para montar uma tela só.
    execs = db.query(ExecucaoDia).filter(
        ExecucaoDia.usuario_id == usuario_id,
        ExecucaoDia.data >= de, ExecucaoDia.data <= ate).all()
    por_dia_rot = {}
    for e in execs:
        por_dia_rot.setdefault(e.data, {})[e.rotina_id] = e

    tarefas = db.query(TarefaDia).filter(
        TarefaDia.usuario_id == usuario_id,
        TarefaDia.data_prevista >= de, TarefaDia.data_prevista <= ate).all()
    por_dia_tar = {}
    for t in tarefas:
        por_dia_tar.setdefault(t.data_prevista, []).append(t)

    saida = {}
    dia = de
    while dia <= ate:
        lista = []

        # ── ROTINAS ──────────────────────────────────────────────────
        reais = por_dia_rot.get(dia, {})
        if dia <= hoje:
            # PASSADO E HOJE: só o que existe. Projetar aqui recriaria a
            # "derrota retroativa" que o fechamento proíbe — e ainda
            # mostraria como programada uma rotina criada depois daquele
            # dia, que nunca esteve lá.
            for r in rotinas:
                ed = reais.get(r.id)
                if ed:
                    lista.append(_de_rotina(r, ed))
        else:
            for r in rotinas:
                if fechamento.rotina_devida_em(r, dia):
                    lista.append(_de_rotina(r, None))

        # ── PORTÕES ──────────────────────────────────────────────────
        # Sempre projetados: a sessão só nasce quando o hunter atravessa,
        # então ausência de linha não quer dizer que o portão não abriu.
        for d in dungeons:
            if dungeon_devida_em(d, dia):
                lista.append(_de_dungeon(d, dia))

        # ── MISSÕES GERAIS ───────────────────────────────────────────
        for t in por_dia_tar.get(dia, []):
            lista.append(_de_tarefa(t))

        if lista:
            # Sem hora vai por último: o que tem horário compõe a linha do
            # tempo do dia; o resto é "em algum momento".
            lista.sort(key=lambda o: (o["hora_inicio"] is None,
                                      o["hora_inicio"] or "", o["titulo"]))
            saida[dia.isoformat()] = lista
        dia += timedelta(days=1)

    return saida


def resumo(lista: list) -> dict:
    """Os números que a célula do mês mostra sem precisar da lista toda."""
    feitas = sum(1 for o in lista if o.get("status") == "CONCLUIDA")
    perdidas = sum(1 for o in lista
                   if o.get("status") in ("FRACASSADA", "FRACASSADA_FATAL"))
    return {
        "total": len(lista),
        "concluidas": feitas,
        "fracassadas": perdidas,
        "previstas": sum(1 for o in lista if not o.get("real")),
        "xp": sum(int(o.get("xp") or 0) for o in lista),
        "portoes": sum(1 for o in lista if o["origem"] == "dungeon"),
    }
