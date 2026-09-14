# -*- coding: utf-8 -*-
"""
TESTE — A META QUE DEIXA IR ALEM

O Arquiteto descreveu o defeito assim:

    "quando eu atinjo a meta em reais para concluir as que eu tenho, elas
    auto concluem. Mude. Elas podem ate ganhar o status de concluida,
    porem, se ainda houver tempo, ela deve permitir que eu continue
    lancando valores."

O que havia era um sistema que PREMIAVA CHEGAR E PUNIA CONTINUAR: bater
R$ 100 numa manha que ia ate as 11h fechava o cartao na hora, e os R$ 48
seguintes nao tinham onde ser registrados. Quem trabalha melhor do que
prometeu ficava sem prova disso.

A INVERSAO QUE ESTE TESTE PROTEGE

    Antes:  o ALVO fechava a meta.
    Agora:  o RELOGIO fecha a meta. O alvo e so um marco.

Tres coisas podem dar errado nessa inversao, e cada uma tem seu bloco:

  1. O EXCEDENTE VIRAR XP SEM NINGUEM MANDAR. O XP cai uma vez, ao bater
     o alvo. Se cada aporte extra pagasse, "ganhar 1000 reais" renderia
     mais que qualquer missao do app — e o Arquiteto foi explicito de que
     quem define XP e a Balanca, nao o valor digitado.

  2. A JANELA NAO FECHAR NUNCA. Se aportes fossem aceitos para sempre,
     um lancamento as 23h entraria numa meta cujo turno acabou as 08h, e
     o total do turno passaria a incluir dinheiro que nao foi ganho ali.

  3. A SUPERACAO FICAR INVISIVEL. `progresso()` e cortado em 1.0 porque
     e ele que da a largura da barra. Se fosse o unico numero, 148% e
     100% seriam escritos igual, e o esforco a mais nao existiria.

Nao precisa de banco: sao funcoes puras.

O .gitignore ignora `test_*.py`. Para versionar:  git add -f

Uso:
    cd webapp/backend
    python test_meta_superacao.py
"""
import os
import sys
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from motors import meta  # noqa: E402

falhas = 0
testes = 0


def ok(cond, msg):
    global falhas, testes
    testes += 1
    if not cond:
        falhas += 1
    print(("  [ok]  " if cond else "  [XX]  ") + msg)


class Regra:
    """Uma rotina de meta: 'Conseguir R$ 100 no turno da manha', 06:30-11:00."""
    def __init__(self, **kw):
        self.meta_alvo = 100.0
        self.meta_inicial = None
        self.meta_modo = meta.ACUMULO
        self.meta_especie = "VALOR"
        self.hora_inicio = "06:30"
        self.hora_fim = "11:00"
        self.__dict__.update(kw)


class Acum:
    def __init__(self, meta_atual=0.0, data=None, status="ATIVA"):
        self.meta_atual = meta_atual
        self.data = data
        self.status = status


HOJE = date(2026, 9, 13)
def as_(h, m=0):
    return datetime(2026, 9, 13, h, m, 0)


# ══════════════════════════════════════════════════════════════════
print("\n=== A META QUE DEIXA IR ALEM ===\n")
print("-- o excedente, que antes nao tinha onde existir --")

ok(meta.excedente(148.0, 100.0) == 48.0,
   "R$ 148 numa meta de R$ 100 sao R$ 48 acima")
ok(meta.excedente(100.0, 100.0) == 0.0,
   "bater exato nao e superar — excedente zero")
ok(meta.excedente(72.0, 100.0) == 0.0,
   "e quem nao chegou nao tem excedente negativo")

# O selo so aparece com excedente > 0. Se esta funcao devolvesse
# negativo, toda meta em andamento nasceria com um selo de "-28,00".
ok(meta.excedente(0.0, 100.0) == 0.0, "meta recem-aberta nao mostra selo")

print("\n-- a fracao sem teto, ao lado da barra com teto --")
ok(abs(meta.progresso(148.0, 100.0) - 1.0) < 1e-9,
   "`progresso` corta em 1.0 — e ele que da a largura da barra")
ok(abs(meta.fracao_total(148.0, 100.0) - 1.48) < 1e-9,
   "`fracao_total` conta a verdade inteira: 148%")
ok(meta.fracao_total(148.0, 100.0) != meta.progresso(148.0, 100.0),
   "os dois numeros SAO diferentes — se fossem iguais, superar "
   "seria indistinguivel de empatar")

print("\n-- a medicao fica de fora, de proposito --")
# Quem mira 78 kg e chega a 76 nao "superou em 2 kg" de um jeito que se
# some ao lado do numero. Um selo de "+2,0 kg · 103% do alvo" numa
# balanca nao quer dizer nada.
ok(meta.excedente(76.0, 78.0, meta.MEDICAO) == 0.0,
   "peso nao gera excedente")
ok(meta.fracao_total(76.0, 78.0, 85.0, meta.MEDICAO) <= 1.0,
   "e a fracao da medicao continua com teto")

# ══════════════════════════════════════════════════════════════════
print("\n-- a janela: o relogio fecha, o alvo nao --")

r = Regra()
a_hoje = Acum(meta_atual=148.0, data=HOJE, status="CONCLUIDA")

ok(meta.janela_aberta(r, a_hoje, as_(9, 0), HOJE),
   "CONCLUIDA as 09:00, com prazo ate as 11:00: AINDA ACEITA. "
   "Este e o assert que descreve o pedido inteiro")
ok(meta.janela_aberta(r, a_hoje, as_(10, 59), HOJE),
   "um minuto antes do prazo ainda aceita")
ok(meta.janela_aberta(r, a_hoje, as_(11, 0), HOJE),
   "as 11:00 em ponto ainda aceita — o minuto do limite e inteiro")
ok(not meta.janela_aberta(r, a_hoje, as_(11, 1), HOJE),
   "as 11:01 recusa: o turno acabou e o total esta fechado")
ok(not meta.janela_aberta(r, a_hoje, as_(23, 0), HOJE),
   "e as 23h muito menos — era por aqui que o total do turno "
   "receberia dinheiro ganho fora dele")

print("\n-- o dia importa tanto quanto a hora --")
a_ontem = Acum(meta_atual=148.0, data=HOJE - timedelta(days=1))
ok(not meta.janela_aberta(r, a_ontem, as_(7, 0), HOJE),
   "as 07:00 de hoje NAO reabrem a meta de ontem que ia ate as 11:00")

print("\n-- meta sem prazo declarado --")
sem = Regra(hora_fim=None, hora_limite=None)
ok(meta.janela_aberta(sem, a_hoje, as_(23, 30), HOJE),
   "sem hora limite, a janela e o dia inteiro (a escolha do Arquiteto)")
ok(not meta.janela_aberta(sem, a_ontem, as_(9, 0), HOJE),
   "mas o dia inteiro e O DIA — ontem continua fechado")

print("\n-- missao geral usa hora_limite, nao hora_fim --")
class RegraTarefa:
    meta_alvo = 100.0
    meta_inicial = None
    meta_modo = meta.ACUMULO
    meta_especie = "VALOR"
    hora_limite = "11:00"
t = RegraTarefa()
ok(meta.janela_aberta(t, a_hoje, as_(10, 0), HOJE),
   "a missao geral respeita `hora_limite`")
ok(not meta.janela_aberta(t, a_hoje, as_(12, 0), HOJE),
   "e fecha no mesmo horario")

print("\n-- prazo ilegivel nao tranca a porta --")
quebrada = Regra(hora_fim="onze horas")
ok(meta.janela_aberta(quebrada, a_hoje, as_(23, 0), HOJE),
   "dado corrompido deixa passar: perder lancamento por causa de um "
   "campo mal gravado seria pior que aceitar um tardio")

# ══════════════════════════════════════════════════════════════════
print("\n-- a conclusao continua sendo conclusao --")
# `alcancada` nao mudou, e nao devia: quem decide o XP e ela, uma vez so.
ok(meta.alcancada(100.0, 100.0), "bater o alvo continua concluindo")
ok(meta.alcancada(148.0, 100.0), "e passar dele tambem")
ok(not meta.alcancada(99.99, 100.0), "faltando um centavo, nao")

# O caminho do `desfazer`: tirar um aporte extra NAO deve reabrir a
# missao enquanto o saldo seguir acima do alvo. Quem garante isso no
# router e esta funcao.
ok(meta.alcancada(120.0, 100.0),
   "desfazer um extra e ficar em 120 mantem a missao cumprida")
ok(not meta.alcancada(80.0, 100.0),
   "mas cair para 80 reabre — e ai o XP volta, como ja era")

# ══════════════════════════════════════════════════════════════════
print("\n" + "=" * 50)
print(f"TUDO VERDE — {testes} asserts" if falhas == 0
      else f"{falhas} FALHA(S) de {testes} asserts")
print("=" * 50 + "\n")
sys.exit(0 if falhas == 0 else 1)
