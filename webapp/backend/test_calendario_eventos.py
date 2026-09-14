# -*- coding: utf-8 -*-
"""
TESTE — A TRADUCAO DE MISSAO PARA EVENTO (Fases 2 e 3)

A Fase 1 so mantinha o acesso vivo. Esta escreve na agenda de verdade, e
os erros daqui tem uma propriedade desagradavel: NINGUEM OS VE NO SOLO.
Uma recorrencia errada nao quebra tela nenhuma — ela marca o portao no dia
errado, o alarme toca na hora errada, e o hunter culpa a memoria dele.

O QUE ESTE ARQUIVO PROTEGE, EM ORDEM DE GRAVIDADE

1. A ANCORA DA RECORRENCIA (`DTSTART`).
   Num evento `BYDAY=TU,TH` cujo DTSTART cai numa segunda, o Google expande
   a partir da segunda e a semana do hunter comeca com um compromisso que
   a regra nao pede. A ancora tem de SATISFAZER a propria regra.

2. O EVENTO QUE ATRAVESSA A MEIA-NOITE.
   Portao 22:00 → 06:00 tem duracao negativa se a conta for ingenua, e o
   Google recusa o evento inteiro. O turno da noite e exatamente o caso em
   que o hunter mais precisa do lembrete.

3. `useDefault: false` NOS LEMBRETES.
   Sem isso o evento herda o padrao da conta, que em agenda secundaria
   costuma ser NENHUM lembrete. Os eventos apareceriam e o celular nunca
   tocaria — falhando exatamente no unico motivo pelo qual o Arquiteto
   pediu esta integracao.

4. O `solo_rev` MUDAR QUANDO A MISSAO MUDA, E SO ENTAO.
   Se nao mudar, a edicao nunca chega a agenda. Se mudar a toa, toda
   sincronia reescreve tudo, gasta quota e faz o Google notificar
   "evento atualizado" sem nada ter mudado.

5. FOLGA VIRAR `EXDATE`.
   Sem isso o alarme toca no feriado que o Arquiteto ja tinha programado
   como descanso.

Funcoes puras: nao toca rede nem banco.

O .gitignore ignora `test_*.py`. Para versionar:  git add -f

Uso:
    cd webapp/backend
    python test_calendario_eventos.py
"""
import json
import os
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from motors import calendario_eventos as ev  # noqa: E402

falhas = 0
testes = 0


def ok(cond, msg):
    global falhas, testes
    testes += 1
    if not cond:
        falhas += 1
    print(("  [ok]  " if cond else "  [XX]  ") + msg)


class Obj:
    def __init__(self, **kw):
        self.__dict__.update(kw)


# 13/09/2026 e um DOMINGO (weekday 6).
HOJE = date(2026, 9, 13)


def dungeon(**kw):
    base = dict(
        id=7, titulo="Libanus Restaurante", descricao=None,
        tipo_recorrencia="SEMANAL", dias_semana=json.dumps([0, 1, 2, 3, 4]),
        dia_mes=None, mes_dia=None, data_inicio=None, data_fim=None,
        hora_entrada="08:00", hora_saida="17:30", sempre_aberta=False,
        folgas=None, rank="A", categoria="Trabalho", status="ATIVA",
        xp_entrada=40, xp_clear=120, duracao_max_min=None,
    )
    base.update(kw)
    return Obj(**base)


def rotina(**kw):
    base = dict(
        id=12, titulo="Estudar", descricao=None, icone="",
        tipo="DIARIA", dias_semana=None, dia_mes=None, mes_dia=None,
        hora_inicio="06:30", hora_fim="07:30", ativo=True, status="ATIVA",
        xp_recompensa=50, eh_progressiva=False,
        dias_progressivos_alvo=None, dias_progressivos_ok=0,
    )
    base.update(kw)
    return Obj(**base)


# ══════════════════════════════════════════════════════════════════
print("\n=== A TRADUCAO DE MISSAO PARA EVENTO ===\n")
print("-- a ancora satisfaz a propria regra --")

# Seg a sex, olhando de um DOMINGO: a primeira ocorrencia e a segunda-feira.
a = ev.ancora(dungeon(), HOJE)
ok(a == date(2026, 9, 14), f"seg-sex visto do domingo ancora na segunda ({a})")
ok(a.weekday() in [0, 1, 2, 3, 4],
   "e o dia da ancora ESTA na regra — senao o Google cria uma "
   "ocorrencia fantasma no primeiro dia")

# So terca e quinta.
a2 = ev.ancora(dungeon(dias_semana=json.dumps([1, 3])), HOJE)
ok(a2 == date(2026, 9, 15), f"ter/qui ancora na terca ({a2})")
ok(a2.weekday() == 1, "e nao na segunda, que nao esta na regra")

a3 = ev.ancora(rotina(tipo="MENSAL", dia_mes=20), HOJE)
ok(a3 == date(2026, 9, 20), f"mensal dia 20 ancora no dia 20 ({a3})")

a4 = ev.ancora(rotina(tipo="ANUAL", mes_dia="12-25"), HOJE)
ok(a4 == date(2026, 12, 25), f"anual 12-25 ancora no Natal ({a4})")

print("\n-- a recorrencia --")
ok(ev.rrule_de(dungeon()) == "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
   "seg-sex vira BYDAY=MO,TU,WE,TH,FR")
ok(ev.rrule_de(rotina()) == "RRULE:FREQ=DAILY", "diaria e diaria")
ok(ev.rrule_de(rotina(tipo="MENSAL", dia_mes=5))
   == "RRULE:FREQ=MONTHLY;BYMONTHDAY=5", "mensal usa BYMONTHDAY")
ok(ev.rrule_de(rotina(tipo="ANUAL", mes_dia="03-08"))
   == "RRULE:FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=8", "anual usa mes e dia")

# DIARIA com dias marcados e, na pratica, semanal.
ok("FREQ=WEEKLY" in ev.rrule_de(rotina(tipo="DIARIA",
                                       dias_semana=json.dumps([0, 2, 4]))),
   "diaria COM dias marcados vira semanal — o Solo aceita as duas "
   "formas, o Google precisa de uma so")

r_ate = ev.rrule_de(dungeon(data_fim=date(2026, 12, 31)))
ok("UNTIL=20261231T235959Z" in r_ate,
   "data_fim vira UNTIL com o dia INTEIRO — sem a hora, o Google corta "
   "a ultima ocorrencia e a missao some no dia do prazo")

print("\n-- a meia-noite --")
noturno = ev.de_dungeon(dungeon(hora_entrada="22:00", hora_saida="06:00"),
                        HOJE)
ok(noturno is not None, "o portao noturno gera evento")
ok(noturno["end"]["dateTime"] > noturno["start"]["dateTime"],
   "e o fim vem DEPOIS do comeco — a conta ingenua daria duracao "
   "negativa e o Google recusaria o evento inteiro")
ok(noturno["end"]["dateTime"].startswith("2026-09-15"),
   "o fim cai no dia seguinte")

print("\n-- os lembretes, que sao o motivo de tudo isto --")
e1 = ev.de_dungeon(dungeon(), HOJE, aviso_min=30)
ok(e1["reminders"]["useDefault"] is False,
   "useDefault=false — herdar o padrao da conta significaria NENHUM "
   "lembrete em agenda secundaria, e o celular nunca tocaria")
mins = [o["minutes"] for o in e1["reminders"]["overrides"]]
ok(30 in mins, "o aviso pedido esta la")
ok(5 in mins, "e um segundo, colado na hora, para levantar")
ok(len(e1["reminders"]["overrides"]) <= 5, "dentro do teto de 5 do Calendar")

e0 = ev.de_dungeon(dungeon(), HOJE, aviso_min=0)
ok([o["minutes"] for o in e0["reminders"]["overrides"]] == [0],
   "aviso 0 = so na hora, sem o segundo")

print("\n-- as folgas viram EXDATE --")
com_folga = ev.de_dungeon(
    dungeon(folgas=json.dumps(["2026-09-21", "2026-10-12"])), HOJE)
exd = [r for r in com_folga["recurrence"] if r.startswith("EXDATE")]
ok(len(exd) == 1, "sai uma linha EXDATE")
ok("20260921T080000" in exd[0] and "20261012T080000" in exd[0],
   "com as duas folgas, no horario de entrada do portao")
ok(f"TZID={ev.FUSO}" in exd[0], "e com o fuso junto")

print("\n-- o que NAO vai para a agenda --")
ok(ev.de_dungeon(dungeon(sempre_aberta=True), HOJE) is None,
   "portao que nao fecha nao vira bloco de tempo — inventar um "
   "desenharia a regra que o Solo justamente aboliu")
ok(ev.de_dungeon(dungeon(status="ARQUIVADA"), HOJE) is None,
   "portao arquivado fica de fora")
ok(ev.de_rotina(rotina(hora_inicio=None), HOJE) is None,
   "rotina SEM horario fica de fora — viraria faixa cinza de dia "
   "inteiro, e cinco delas ensinam o hunter a ignorar a agenda")
ok(ev.de_rotina(rotina(ativo=False), HOJE) is None, "rotina inativa, idem")

t_sem_hora = Obj(id=3, titulo="X", descricao=None, status="ATIVA",
                 data_prevista=date(2026, 9, 20), hora_limite=None,
                 xp_recompensa=10)
ok(ev.de_tarefa(t_sem_hora) is None, "missao geral sem prazo fica de fora")

t_feita = Obj(id=4, titulo="Y", descricao=None, status="CONCLUIDA",
              data_prevista=date(2026, 9, 20), hora_limite="18:00",
              xp_recompensa=10)
ok(ev.de_tarefa(t_feita) is None, "e missao ja concluida tambem")

print("\n-- a missao geral: o prazo e o FIM --")
t = Obj(id=5, titulo="Pagar o aluguel", descricao=None, status="ATIVA",
        data_prevista=date(2026, 9, 20), hora_limite="18:00",
        xp_recompensa=80)
et = ev.de_tarefa(t)
ok(et["end"]["dateTime"] == "2026-09-20T18:00:00",
   "o evento TERMINA no hora_limite — o prazo e o fim, nao o comeco")
ok(et["start"]["dateTime"] == "2026-09-20T17:30:00",
   "e comeca meia hora antes, para ter corpo visivel na agenda")
ok("recurrence" not in et, "sem recorrencia: e pontual")

print("\n-- o selo dentro do evento --")
priv = e1["extendedProperties"]["private"]
ok(priv["solo_origem"] == "dungeon" and priv["solo_id"] == "7",
   "o vinculo viaja DENTRO do evento — e a rede que reencontra tudo "
   "se o banco local perder o elo, em vez de duplicar a agenda")
ok(bool(priv.get("solo_rev")), "com a revisao junto")

print("\n-- a revisao muda quando a missao muda, e so entao --")
r1 = ev.de_dungeon(dungeon(), HOJE)["extendedProperties"]["private"]["solo_rev"]
r2 = ev.de_dungeon(dungeon(), HOJE)["extendedProperties"]["private"]["solo_rev"]
ok(r1 == r2, "mesma dungeon, mesma revisao — senao TODA sincronia "
             "reescreveria a agenda inteira")

r3 = ev.de_dungeon(dungeon(hora_entrada="09:00"),
                   HOJE)["extendedProperties"]["private"]["solo_rev"]
ok(r1 != r3, "mudou o horario, mudou a revisao")

r4 = ev.de_dungeon(dungeon(titulo="Outro nome"),
                   HOJE)["extendedProperties"]["private"]["solo_rev"]
ok(r1 != r4, "mudou o titulo, mudou a revisao")

r5 = ev.de_dungeon(dungeon(), HOJE, aviso_min=15
                   )["extendedProperties"]["private"]["solo_rev"]
ok(r1 != r5, "mudou a antecedencia do aviso, mudou a revisao")

print("\n-- o basico do evento --")
ok(e1["start"]["timeZone"] == "America/Sao_Paulo",
   "fuso IANA, nao offset fixo: horario de verao nao quebra a agenda")
ok(e1["start"]["dateTime"] == "2026-09-14T08:00:00", "comeca as 08:00")
ok(e1["end"]["dateTime"] == "2026-09-14T17:30:00", "termina as 17:30")
ok("Libanus" in e1["summary"], "o nome do portao esta no titulo")
ok("Solo Routines" in e1["description"], "e a assinatura na descricao")

print("\n-- dado corrompido nao derruba a sincronia --")
quebrada = ev.de_dungeon(dungeon(dias_semana="{ isto nao e json"), HOJE)
ok(quebrada is not None,
   "dias_semana ilegivel nao levanta excecao — uma dungeon com dado "
   "estranho nao pode parar as outras vinte")
ok(quebrada["recurrence"][0] == "RRULE:FREQ=WEEKLY",
   "ela cai para semanal SEM BYDAY (todos os dias) em vez de sumir: "
   "aparecer demais e recuperavel, sumir e invisivel")
ok(ev.de_dungeon(dungeon(hora_entrada="25:99"), HOJE) is None,
   "mas hora impossivel recusa o evento, em vez de inventar um horario")

print("\n" + "=" * 52)
print(f"TUDO VERDE — {testes} asserts" if falhas == 0
      else f"{falhas} FALHA(S) de {testes} asserts")
print("=" * 52 + "\n")
sys.exit(0 if falhas == 0 else 1)
