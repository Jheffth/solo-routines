# -*- coding: utf-8 -*-
"""
A TRADUÇÃO — de missão do Solo para evento do Google.

AQUI NÃO SE FALA COM O GOOGLE. Entra um objeto do domínio, sai um dict.
Função pura, sem rede, sem banco, sem relógio implícito (o `hoje` é
injetado, senão um teste de recorrência falharia dependendo do dia em que
fosse rodado). É o mesmo desenho de `motors/meta.py` e `motors/medidor.py`,
e pelo mesmo motivo: regra que dá para testar sem subir nada.

A DECISÃO CENTRAL: SINCRONIZA-SE A REGRA, NÃO O DIA

Uma rotina diária vira UM evento com `RRULE:FREQ=DAILY`, não trinta
eventos. Quem expande a recorrência é o Google. Isso muda a ordem de
grandeza de tudo: o Solo escreve na agenda quando a REGRA muda — criar,
editar, arquivar — e não a cada dia nem a cada conclusão.

E é o que torna a mão única barata. Refletir conclusão exigiria reescrever
a ocorrência daquele dia, uma chamada por missão por dia, com toda a
disputa de escrita que a mão dupla traz. A agenda mostra COMPROMISSO, não
resultado; o resultado o hunter vê no Solo.

O QUE NÃO VAI PARA A AGENDA, E POR QUÊ

Missão sem horário. Uma rotina sem `hora_inicio` é "em algum momento do
dia": viraria evento de dia inteiro, e cinco dessas encheriam o topo da
agenda de faixas cinzas todo santo dia. É assim que alguém aprende a
ignorar a integração inteira — e a partir daí ela deixou de servir mesmo
para as missões que tinham horário de verdade.
"""
from __future__ import annotations

import hashlib
import json
from datetime import date, datetime, timedelta

FUSO = "America/Sao_Paulo"

# Solo usa 0=segunda..6=domingo. `date.weekday()` do Python usa a MESMA
# convenção, e o RRULE segue a mesma ordem. Coincidência feliz que evita
# uma tabela de conversão — mas explicitada aqui, porque o dia em que
# alguém mudar o Solo para 0=domingo, é esta lista que quebra em silêncio.
BYDAY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]

# As cores do Calendar são um enum fechado (1..11), não hex. Aproximamos o
# rank; cor errada é cosmética, mas cor CONSTANTE é o que deixa a semana
# legível de relance.
COR_RANK = {"E": "8", "D": "10", "C": "9", "B": "3", "A": "6", "S": "5"}
COR_ROTINA = "1"    # lavanda
COR_TAREFA = "7"    # pavão


def _hhmm(txt):
    """'08:30' → (8, 30). Qualquer outra coisa → None."""
    if not txt:
        return None
    p = str(txt).strip().split(":")
    if len(p) < 2:
        return None
    try:
        h, m = int(p[0]), int(p[1])
    except (TypeError, ValueError):
        return None
    if not (0 <= h <= 23 and 0 <= m <= 59):
        return None
    return h, m


def _lista(campo):
    """O JSON de `dias_semana`/`folgas` como lista. Nunca explode: dado
    corrompido no banco não pode derrubar uma sincronia inteira."""
    if not campo:
        return []
    if isinstance(campo, (list, tuple)):
        return list(campo)
    try:
        v = json.loads(campo)
        return list(v) if isinstance(v, (list, tuple)) else []
    except Exception:
        return []


def _dias_de(regra):
    """Os weekdays válidos, 0..6. Vazio = todos os dias."""
    out = []
    for d in _lista(getattr(regra, "dias_semana", None)):
        try:
            n = int(d)
        except (TypeError, ValueError):
            continue
        if 0 <= n <= 6:
            out.append(n)
    return sorted(set(out))


# ══════════════════════════════════════════════════════════════════════
# A ÂNCORA E A RECORRÊNCIA
# ══════════════════════════════════════════════════════════════════════
def ancora(regra, hoje: date) -> date:
    """
    O PRIMEIRO dia em que o evento acontece — a data do `DTSTART`.

    PARECE DETALHE E NÃO É. Num evento semanal com `BYDAY=TU,TH`, o Google
    expande a partir do DTSTART; se o DTSTART cair numa segunda, a primeira
    ocorrência sai em dia que a regra não pede, e a semana do hunter começa
    com um compromisso fantasma. Então a âncora tem de SATISFAZER a regra.

    Procura no máximo 366 dias à frente: acima disso, ou a regra é vazia ou
    está corrompida, e um laço infinito num deploy é caro demais para o
    ganho de cobrir o caso.
    """
    tipo = (getattr(regra, "tipo_recorrencia", None)
            or getattr(regra, "tipo", None) or "DIARIA").upper()
    inicio = getattr(regra, "data_inicio", None) or hoje
    if inicio < hoje:
        inicio = hoje

    if tipo == "SEMANAL":
        dias = _dias_de(regra)
        if not dias:
            return inicio
        for i in range(366):
            d = inicio + timedelta(days=i)
            if d.weekday() in dias:
                return d
        return inicio

    if tipo == "MENSAL":
        alvo = getattr(regra, "dia_mes", None)
        if not alvo:
            return inicio
        for i in range(366):
            d = inicio + timedelta(days=i)
            if d.day == int(alvo):
                return d
        return inicio

    if tipo == "ANUAL":
        md = (getattr(regra, "mes_dia", None) or "").strip()
        try:
            mes, dia = [int(x) for x in md.split("-")[:2]]
        except (ValueError, AttributeError):
            return inicio
        for i in range(400):
            d = inicio + timedelta(days=i)
            if d.month == mes and d.day == dia:
                return d
        return inicio

    return inicio   # DIARIA


def rrule_de(regra) -> str | None:
    """A regra de recorrência, ou None para evento pontual."""
    tipo = (getattr(regra, "tipo_recorrencia", None)
            or getattr(regra, "tipo", None) or "DIARIA").upper()

    if tipo == "SEMANAL":
        dias = _dias_de(regra)
        partes = ["FREQ=WEEKLY"]
        if dias:
            partes.append("BYDAY=" + ",".join(BYDAY[d] for d in dias))
    elif tipo == "MENSAL":
        partes = ["FREQ=MONTHLY"]
        if getattr(regra, "dia_mes", None):
            partes.append(f"BYMONTHDAY={int(regra.dia_mes)}")
    elif tipo == "ANUAL":
        partes = ["FREQ=YEARLY"]
        md = (getattr(regra, "mes_dia", None) or "").strip()
        try:
            mes, dia = [int(x) for x in md.split("-")[:2]]
            partes += [f"BYMONTH={mes}", f"BYMONTHDAY={dia}"]
        except (ValueError, AttributeError):
            pass
    else:
        partes = ["FREQ=DAILY"]
        # DIARIA com dias_semana marcados é, na prática, semanal. O Solo
        # aceita as duas formas; o Google precisa de uma só.
        dias = _dias_de(regra)
        if dias and len(dias) < 7:
            partes = ["FREQ=WEEKLY", "BYDAY=" + ",".join(BYDAY[d] for d in dias)]

    fim = getattr(regra, "data_fim", None)
    if fim:
        # UNTIL em UTC, com o dia inteiro incluído. Sem o horário, o Google
        # corta a última ocorrência — a missão sumiria justamente no dia do
        # prazo, que é o dia que mais importa.
        partes.append("UNTIL=" + fim.strftime("%Y%m%dT235959Z"))

    return "RRULE:" + ";".join(partes)


def exdates(regra, hora_inicio) -> list:
    """
    As folgas viram EXDATE — o dia em que o portão não abre.

    Sem isto, a agenda marcaria o portão no feriado que o Arquiteto já
    tinha programado como folga, e o lembrete tocaria no dia de descanso.
    """
    hm = _hhmm(hora_inicio)
    if not hm:
        return []
    fora = []
    for txt in _lista(getattr(regra, "folgas", None)):
        try:
            d = datetime.strptime(str(txt)[:10], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            continue
        fora.append(f"{d.strftime('%Y%m%d')}T{hm[0]:02d}{hm[1]:02d}00")
    if not fora:
        return []
    return [f"EXDATE;TZID={FUSO}:" + ",".join(sorted(fora))]


# ══════════════════════════════════════════════════════════════════════
# O MOLDE DO EVENTO
# ══════════════════════════════════════════════════════════════════════
def _quando(dia: date, hm, minutos_extra=0) -> dict:
    dt = datetime(dia.year, dia.month, dia.day, hm[0], hm[1])
    dt += timedelta(minutes=minutos_extra)
    return {"dateTime": dt.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": FUSO}


def _lembretes(aviso_min) -> dict:
    """
    O aviso no celular — o motivo de tudo isto existir.

    `useDefault: false` é obrigatório: sem ele o evento herda o padrão da
    conta, que na maioria das contas é "nenhum lembrete" em agendas
    secundárias. O hunter teria os eventos e nenhum alarme.

    Dois lembretes quando a antecedência é grande: um para se organizar,
    outro para levantar. O Calendar aceita até 5 por evento — dois é o que
    avisa sem virar barulho.
    """
    n = max(0, min(40320, int(aviso_min or 0)))
    ovr = [{"method": "popup", "minutes": n}]
    if n >= 15:
        ovr.append({"method": "popup", "minutes": 5})
    return {"useDefault": False, "overrides": ovr}


def _selo(origem: str, oid: int) -> dict:
    """
    O vínculo gravado DENTRO do evento.

    É a rede de reconciliação: se o banco local perder o elo (restauração
    de backup, hunter reconectando a conta), dá para varrer a agenda e
    reencontrar cada evento por aqui, em vez de criar tudo de novo. Evento
    duplicado é o defeito clássico dessas integrações, e o pior — ninguém
    percebe até haver três cópias de cada rotina.
    """
    return {"private": {"solo_origem": origem, "solo_id": str(oid)}}


def revisao(ev: dict) -> str:
    """
    A impressão digital do evento.

    Se ela não mudou, não há PATCH a fazer. É o que impede a sincronia de
    reescrever a agenda inteira toda vez — e, com ela, de gastar quota e
    de fazer o Google notificar "evento atualizado" sem nada ter mudado.

    O `solo_rev` fica de fora da conta: ele é o RESULTADO dela, e incluí-lo
    seria pedir que o hash dependesse de si mesmo.
    """
    limpo = {k: v for k, v in ev.items() if k != "extendedProperties"}
    bruto = json.dumps(limpo, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha1(bruto.encode("utf-8")).hexdigest()[:16]


def _fechar(ev: dict, origem: str, oid: int) -> dict:
    ev["extendedProperties"] = _selo(origem, oid)
    ev["extendedProperties"]["private"]["solo_rev"] = revisao(ev)
    return ev


# ══════════════════════════════════════════════════════════════════════
# OS QUATRO TRADUTORES
# ══════════════════════════════════════════════════════════════════════
def de_dungeon(d, hoje: date, aviso_min: int = 30) -> dict | None:
    """
    O PORTÃO — o que mais se parece com um compromisso de agenda.

    Ele já tem começo, fim e lugar na semana; é quase transcrição.

    `sempre_aberta` fica de fora: um portão que não fecha não tem bloco de
    tempo, e inventar um seria desenhar na agenda uma regra que o Solo
    justamente aboliu.
    """
    if getattr(d, "sempre_aberta", False):
        return None
    if (getattr(d, "status", "ATIVA") or "ATIVA").upper() != "ATIVA":
        return None

    ini = _hhmm(getattr(d, "hora_entrada", None))
    if not ini:
        return None
    fim = _hhmm(getattr(d, "hora_saida", None))

    dia = ancora(d, hoje)
    # Portão que atravessa a meia-noite (22:00 → 06:00): o fim é no dia
    # seguinte. Sem isto, o evento teria duração negativa e o Google recusa.
    dur = 60
    if fim:
        dur = (fim[0] * 60 + fim[1]) - (ini[0] * 60 + ini[1])
        if dur <= 0:
            dur += 24 * 60

    ev = {
        "summary": f"⛩ {d.titulo}",
        "description": _descricao_dungeon(d),
        "start": _quando(dia, ini),
        "end": _quando(dia, ini, dur),
        "reminders": _lembretes(aviso_min),
        "colorId": COR_RANK.get((getattr(d, "rank", "E") or "E").upper(), "8"),
    }
    rec = [rrule_de(d)] + exdates(d, getattr(d, "hora_entrada", None))
    ev["recurrence"] = [r for r in rec if r]
    return _fechar(ev, "dungeon", d.id)


def _descricao_dungeon(d) -> str:
    linhas = [f"Portão rank {getattr(d, 'rank', 'E')} · {getattr(d, 'categoria', '')}".strip(" ·")]
    if getattr(d, "descricao", None):
        linhas.append(str(d.descricao))
    ganho = []
    if getattr(d, "xp_entrada", 0):
        ganho.append(f"entrada +{d.xp_entrada} XP")
    if getattr(d, "xp_clear", 0):
        ganho.append(f"clear +{d.xp_clear} XP")
    if ganho:
        linhas.append(" · ".join(ganho))
    if getattr(d, "duracao_max_min", None):
        linhas.append(f"Limite de {d.duracao_max_min} min, contados da primeira travessia.")
    linhas.append("— Solo Routines")
    return "\n".join(linhas)


def de_rotina(r, hoje: date, aviso_min: int = 30) -> dict | None:
    """
    A ROTINA com horário. Sem `hora_inicio`, fica de fora (ver o cabeçalho).

    `hora_fim` ausente vira um bloco de 30 minutos: um evento de duração
    zero não aparece direito em nenhuma visão de semana do Calendar.
    """
    if not getattr(r, "ativo", True):
        return None
    if (getattr(r, "status", "ATIVA") or "ATIVA").upper() != "ATIVA":
        return None

    ini = _hhmm(getattr(r, "hora_inicio", None))
    if not ini:
        return None
    fim = _hhmm(getattr(r, "hora_fim", None))

    dur = 30
    if fim:
        dur = (fim[0] * 60 + fim[1]) - (ini[0] * 60 + ini[1])
        if dur <= 0:
            dur += 24 * 60

    dia = ancora(r, hoje)
    desc = []
    if getattr(r, "descricao", None):
        desc.append(str(r.descricao))
    if getattr(r, "xp_recompensa", 0):
        desc.append(f"+{r.xp_recompensa} XP")
    if getattr(r, "eh_progressiva", False) and getattr(r, "dias_progressivos_alvo", None):
        feitos = getattr(r, "dias_progressivos_ok", 0) or 0
        desc.append(f"Progressiva: {feitos}/{r.dias_progressivos_alvo} dias")
    desc.append("— Solo Routines")

    ev = {
        "summary": f"{getattr(r, 'icone', '') or ''} {r.titulo}".strip(),
        "description": "\n".join(desc),
        "start": _quando(dia, ini),
        "end": _quando(dia, ini, dur),
        "recurrence": [rrule_de(r)],
        "reminders": _lembretes(aviso_min),
        "colorId": COR_ROTINA,
    }
    return _fechar(ev, "rotina", r.id)


def de_tarefa(t, aviso_min: int = 30) -> dict | None:
    """
    A MISSÃO GERAL — evento pontual, sem recorrência.

    Sem `hora_limite` fica de fora, mesmo argumento da rotina. Sem
    `data_prevista` também: não há dia onde pousar.
    """
    if (getattr(t, "status", "") or "").upper() in ("CONCLUIDA", "CANCELADA"):
        return None
    dia = getattr(t, "data_prevista", None)
    if not dia:
        return None
    hm = _hhmm(getattr(t, "hora_limite", None))
    if not hm:
        return None

    desc = []
    if getattr(t, "descricao", None):
        desc.append(str(t.descricao))
    if getattr(t, "xp_recompensa", 0):
        desc.append(f"+{t.xp_recompensa} XP")
    desc.append("— Solo Routines")

    # O `hora_limite` é o FIM, não o começo: é o prazo. Meia hora antes dá
    # ao evento um corpo visível na agenda sem inventar um horário de
    # início que o hunter nunca escolheu.
    ev = {
        "summary": t.titulo,
        "description": "\n".join(desc),
        "start": _quando(dia, hm, -30),
        "end": _quando(dia, hm),
        "reminders": _lembretes(aviso_min),
        "colorId": COR_TAREFA,
    }
    return _fechar(ev, "tarefa", t.id)
