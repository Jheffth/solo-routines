# -*- coding: utf-8 -*-
"""
Prazos — QUANDO uma missão vence. Fonte única.

O sistema tem três modalidades de missão, e cada uma conta o tempo de um jeito
diferente. Antes disso aqui, cada arquivo inventava a sua conta: o cartão
contava a duração desde o play, o fechamento olhava só a data, e a janela de
horário da rotina não era usada por ninguém. Resultado: o Banho Revigorante,
com janela 20:00–22:00, só fracassava à meia-noite — duas horas depois de ter
perdido a corrida.

AS TRÊS MODALIDADES

  1. ROTINA COM JANELA — "corrida contra o tempo"
     Banho Revigorante, 20:00 às 22:00.
     Vigência começa às 20:00 e a missão se ACENDE SOZINHA ali.
     Às 22:00 ela fecha. Fracassou, acabou. Só volta pagando Mana (Reerguer).

  2. ROTINA SEM JANELA — "o dia inteiro é seu"
     Vigência 00:00, prazo 23:59:59 do mesmo dia. Não se auto-inicia:
     quem dá a largada é o hunter.

  3. MISSÃO GERAL — "intenção com prazo"
     Dar comida aos peixes, 30 minutos.
     O prazo conta a partir da INTENÇÃO, não do play. Criou às 14:00 com 30
     min? Vence às 14:30, tenha o hunter começado ou não. Clicar Iniciar às
     14:20 mostra 10 minutos no relógio; clicar às 14:40 começa com -10.
     Ela não fecha sozinha: fica lá, no vermelho, até ser concluída — e aí a
     recompensa é zero e a punição é aplicada.

A REGRA QUE UNIFICA
Toda missão tem dois instantes: `inicio` (quando passa a valer) e `fim`
(quando vence). Tudo o mais — cronômetro, fechamento, punição, auto-início —
é comparação com esses dois. Nada aqui é gravado em coluna: é calculado, e por
isso não pode ficar velho quando o hunter edita a rotina.

Todos os instantes são horário de Brasília (motors/tempo.py), ingênuos.
"""
from datetime import date, datetime, time, timedelta

from motors import tempo

# Fim do dia. 23:59:59 e não 00:00 do dia seguinte, para que a comparação
# "vence hoje" continue caindo dentro do próprio dia.
_FIM_DO_DIA = time(23, 59, 59)


def _hhmm(texto: str | None) -> time | None:
    """"20:00" → time(20,0). Devolve None para vazio ou lixo — nunca explode:
    um horário malformado no banco não pode derrubar o dashboard inteiro."""
    if not texto:
        return None
    try:
        h, m = str(texto).strip().split(":")[:2]
        h, m = int(h), int(m)
        if 0 <= h <= 23 and 0 <= m <= 59:
            return time(h, m)
    except Exception:
        pass
    return None


def janela_de(rotina) -> tuple[time | None, time | None]:
    """Os dois horários declarados na rotina, já validados."""
    return _hhmm(getattr(rotina, "hora_inicio", None)), \
           _hhmm(getattr(rotina, "hora_fim", None))


def da_rotina(rotina, dia: date) -> dict:
    """
    Vigência e vencimento da instância desta rotina NESTE dia.

    Devolve:
      inicio       — quando a missão passa a valer
      fim          — quando ela vence
      janela       — True se o hunter declarou horário
      auto_inicia  — True se ela deve se acender sozinha na hora do início
      minutos      — duração da vigência, para exibição
    """
    h_ini, h_fim = janela_de(rotina)

    if h_ini and h_fim:
        inicio = datetime.combine(dia, h_ini)
        fim = datetime.combine(dia, h_fim)
        # Janela que atravessa a meia-noite (22:00 → 01:00): o fim é amanhã.
        # Sem isto a conta daria negativa e a missão nasceria vencida.
        if fim <= inicio:
            fim += timedelta(days=1)
        auto = True
        tem_janela = True

    elif h_ini:                      # só abertura: vale da hora dita até o fim do dia
        inicio = datetime.combine(dia, h_ini)
        fim = datetime.combine(dia, _FIM_DO_DIA)
        auto = True
        tem_janela = True

    elif h_fim:                      # só fechamento: vale desde a meia-noite
        inicio = datetime.combine(dia, time(0, 0))
        fim = datetime.combine(dia, h_fim)
        auto = False
        tem_janela = True

    else:                            # o dia inteiro é dele
        inicio = datetime.combine(dia, time(0, 0))
        fim = datetime.combine(dia, _FIM_DO_DIA)
        auto = False
        tem_janela = False

    return {
        "inicio": inicio,
        "fim": fim,
        "janela": tem_janela,
        "auto_inicia": auto,
        "minutos": max(1, int((fim - inicio).total_seconds() // 60)),
    }


def da_tarefa(tarefa) -> dict:
    """
    Vigência e vencimento de uma missão geral.

    O prazo conta da INTENÇÃO. Três regras, e a terceira nasceu de um bug.

    • Missão criada para um dia futuro não pode nascer vencida. A vigência
      é o mais TARDE entre "quando foi criada" e a abertura do dia previsto.

    • Sem prazo declarado, ela vale o dia previsto inteiro. Missão sem prazo
      não é missão eterna; é missão de um dia.

    • A ABERTURA DO DIA NÃO É MEIA-NOITE.

      Era. E o Arquiteto encontrou o resultado: uma missão CRÍTICA marcada
      para amanhã abria às 00:00 e morria às 00:30 — enquanto ele dormia.
      Uma ALTA morria às 02:00. O `max(criada, meia-noite)` protegia contra
      "nascer vencida" e criava um problema pior: nascer com a janela toda
      gasta no sono.

      O erro de raciocínio foi tratar "o dia" como um intervalo de
      calendário. Para quem usa o app, o dia começa quando a pessoa acorda.

      Agora:
        · com `hora_inicio`, a contagem começa NAQUELE horário — foi o que
          o Arquiteto propôs, e é a única resposta que não inventa nada;
        · sem `hora_inicio`, uma missão para dia FUTURO vale o dia inteiro.
          Se ele não disse a que horas, o Sistema não tem o que adivinhar,
          e adivinhar errado é o bug que estamos consertando.

      Missão para HOJE não muda: a contagem segue começando na criação,
      que é o que "vou fazer agora" quer dizer.
    """
    dia = getattr(tarefa, "data_prevista", None) or tempo.hoje()
    hora = _hhmm(getattr(tarefa, "hora_inicio", None))
    abertura_do_dia = datetime.combine(dia, hora or time(0, 0))

    criada = tempo.de_utc(getattr(tarefa, "criado_em", None))
    inicio = max(criada, abertura_do_dia) if criada else abertura_do_dia

    # A PENITENCIA NAO TEM PRAZO. Ela nasce no dia da falha, mas a divida
    # nunca expira — o cartao nao pode bloquea-la so porque o relogio virou.
    # Devolvemos um prazo que comeca hoje e termina daqui a 365 dias.
    if getattr(tarefa, "natureza", None) == "PUNICAO":
        hoje = tempo.hoje()
        inicio = datetime.combine(hoje, time(0, 0))
        fim = datetime.combine(hoje + timedelta(days=365), _FIM_DO_DIA)
        return {
            "inicio": inicio, "fim": fim,
            "janela": False, "auto_inicia": False,
            "minutos": 525600,  # um ano
        }

    # DIA FUTURO SEM HORA: o dia inteiro, e o `prazo_minutos` não se aplica.
    # Aplicá-lo daria a janela de meia-noite que o Arquiteto reportou.
    futura_sem_hora = hora is None and dia > tempo.hoje()

    minutos = getattr(tarefa, "prazo_minutos", None)
    if minutos and minutos > 0 and not futura_sem_hora:
        fim = inicio + timedelta(minutes=int(minutos))
    else:
        fim = datetime.combine(dia, _FIM_DO_DIA)

    return {
        "inicio": inicio,
        "fim": fim,
        "janela": False,
        "auto_inicia": False,        # missão geral nunca se acende sozinha
        "minutos": max(1, int((fim - inicio).total_seconds() // 60)),
    }


def da_execucao(execucao, rotina) -> dict:
    """
    O prazo da INSTÂNCIA — que é o da rotina, exceto quando ela foi reerguida.

    Reerguer não devolve a janela perdida: o Banho Revigorante das 20:00–22:00
    não volta a ser das 20:00–22:00, porque 22:00 já passou e a corrida já
    foi perdida. O que ele devolve é o RESTO DO DIA — até 23:59, quando a
    instância de amanhã nasce e esta deixa de fazer sentido.

    Por isso a missão reerguida não tem cronômetro de corrida: ela tem o
    lembrete de que o dia acaba. É o suficiente para não dormir sem banho.
    """
    dia = execucao.data
    if getattr(execucao, "reerguida", False):
        base = da_rotina(rotina, dia)
        return {
            "inicio": tempo.de_utc(getattr(execucao, "reerguida_em", None))
                      or base["inicio"],
            "fim": datetime.combine(dia, _FIM_DO_DIA),
            "janela": False,          # a janela foi perdida; sobrou o dia
            "auto_inicia": False,     # a segunda largada é dada pelo hunter
            "minutos": base["minutos"],
            "reerguida": True,
        }
    p = da_rotina(rotina, dia)
    p["reerguida"] = False
    return p


def restante(prazo: dict, agora: datetime | None = None) -> int:
    """
    Segundos até o vencimento. NEGATIVO quando já venceu — e isso é de
    propósito: o cartão precisa saber de quanto é a dívida para mostrar
    "-10:32" em vermelho, não só que ela existe.
    """
    agora = agora or tempo.agora()
    return int((prazo["fim"] - agora).total_seconds())


def venceu(prazo: dict, agora: datetime | None = None) -> bool:
    return restante(prazo, agora) < 0


def ja_abriu(prazo: dict, agora: datetime | None = None) -> bool:
    """A vigência já começou? Antes disso a missão de janela nem deve pulsar."""
    agora = agora or tempo.agora()
    return agora >= prazo["inicio"]


def deve_auto_iniciar(prazo: dict, agora: datetime | None = None) -> bool:
    """
    Chegou a hora de acender sozinha. Note que não basta ter passado das
    20:00 — se já passou das 22:00 a missão não "inicia", ela fracassa, e
    quem cuida disso é o fechamento.
    """
    return prazo["auto_inicia"] and ja_abriu(prazo, agora) and not venceu(prazo, agora)


def ate_abrir(prazo: dict, agora: datetime | None = None) -> int:
    """
    Segundos até a vigência começar. NEGATIVO quando já começou.

    Espelha `restante`, e existe pelo mesmo motivo: o cartão não pode decidir
    isso lendo `prazo_inicio` como data local. O servidor manda horário de
    Brasília sem fuso, e o navegador o interpretaria com o relógio do hunter —
    um protocolo das 16:00 apareceria aberto às 13:00 para quem estivesse com
    o computador adiantado. Segundos não têm fuso.
    """
    agora = agora or tempo.agora()
    return int((prazo["inicio"] - agora).total_seconds())


def para_json(prazo: dict) -> dict:
    """Formato que o frontend consome. O cartão só precisa do fim e do resto."""
    return {
        "prazo_inicio":    prazo["inicio"].isoformat(),
        "prazo_final":     prazo["fim"].isoformat(),
        "prazo_minutos":   prazo["minutos"],
        "prazo_janela":    prazo["janela"],
        "prazo_restante":  restante(prazo),
        # A vigência já começou? O cartão precisa saber para não oferecer
        # Confessar às 11:59 num protocolo que só entra em vigor às 16:00.
        "prazo_abriu":     ja_abriu(prazo),
        "prazo_ate_abrir": ate_abrir(prazo),
    }
