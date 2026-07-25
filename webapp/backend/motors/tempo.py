# -*- coding: utf-8 -*-
"""
O relógio do Sistema — uma fonte única, no fuso do hunter.

POR QUE EXISTE

`date.today()` devolve o dia segundo o fuso do SERVIDOR. Em produção o
servidor roda em UTC, e o hunter vive em Brasília (UTC-3). A partir das
21:00 de Brasília, o servidor já virou o dia — e todo código que perguntava
"que dia é hoje?" respondia AMANHÃ.

O estrago concreto: uma rotina com janela das 20:00 às 22:00 era marcada
FRACASSADA às 21:00, com penalidade de XP, enquanto o relógio na tela do
hunter ainda mostrava duas horas de prazo. O cartão dizia "faltam 2h39m" e
"fracassada" ao mesmo tempo, porque o navegador contava em Brasília e o
servidor julgava em UTC.

O projeto JÁ tinha essa convenção escrita: `routers/dungeons.py` declara
"este router usa _agora() que retorna a hora de Brasília (UTC-3)". Só que
ela vivia numa ilha, e o resto do sistema não a seguia. Agora mora aqui, e
todo mundo bebe da mesma fonte.

REGRA: qualquer decisão sobre QUE DIA É HOJE usa `hoje()`. Nunca
`date.today()`, que é o fuso de quem hospeda, não o de quem usa.
"""
import os
from datetime import date, datetime, timedelta, timezone

# Deslocamento do fuso do app, em horas. Brasília = -3.
# Fica em variável de ambiente para o dia em que houver hunters em outro
# fuso, ou para quando o horário de verão voltar a existir no Brasil.
try:
    _OFFSET_HORAS = int(os.getenv("APP_UTC_OFFSET", "-3"))
except ValueError:
    _OFFSET_HORAS = -3

FUSO = timezone(timedelta(hours=_OFFSET_HORAS))


def agora() -> datetime:
    """Hora atual no fuso do app, SEM tzinfo.

    Devolvemos ingênuo (naive) de propósito: as colunas DateTime do projeto
    são todas sem fuso, e misturar consciente com ingênuo levanta TypeError
    em qualquer comparação. Melhor uma convenção clara do que meia tipagem.
    """
    return datetime.now(tz=FUSO).replace(tzinfo=None)


def hoje() -> date:
    """O dia corrente do ponto de vista do hunter."""
    return agora().date()


def de_utc(dt: datetime | None) -> datetime | None:
    """
    Converte um horário gravado em UTC para o fuso do app.

    Serve para os campos antigos que foram escritos com `datetime.utcnow()`:
    ler `.date()` direto neles erra o dia na faixa da noite, que é justamente
    quando as rotinas noturnas acontecem.
    """
    if dt is None:
        return None
    return (dt.replace(tzinfo=timezone.utc) + timedelta(hours=_OFFSET_HORAS)) \
        .replace(tzinfo=None)


def dia_de_utc(dt: datetime | None) -> date | None:
    """O DIA de um horário gravado em UTC, já no fuso do hunter."""
    convertido = de_utc(dt)
    return convertido.date() if convertido else None
