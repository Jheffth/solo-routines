# -*- coding: utf-8 -*-
"""
META — a missão que se cumpre chegando a um NÚMERO.

    "Ganhar 100 reais no turno da manhã"
    "Correr 5 km"
    "Chegar a 78 kg"
    "Ler 40 páginas"

POR QUE NÃO É REPETIÇÃO

A repetição conta EVENTOS, e o passo dela é fixo em +1 (`_mover`, em
routers/execucoes.py). Para R$ 100 seriam cem cliques, e R$ 12,50 não
cabe num contador inteiro. A meta acumula QUANTIDADE, com passo livre e
casas decimais.

AS DUAS MATEMÁTICAS — e esta é a decisão central deste motor

  ACÚMULO   os aportes SOMAM. 32,59 + 31,78 = 64,37. Começa em zero e
            sobe até o alvo. É dinheiro, distância, páginas, minutos.

  MEDIÇÃO   a última leitura SUBSTITUI a anterior. 82,4 e depois 82,1
            não são 164,5 — são duas pesagens, e vale a última. O alvo
            pode ser MENOR que o ponto de partida (emagrecer), e aí o
            progresso corre para baixo.

Tratar peso como acúmulo somaria pesagens e produziria absurdo. Foi por
causa desse caso que o modo existe: sem ele, "controlar o peso" seria
uma funcionalidade quebrada por construção, e quebrada de um jeito que
só apareceria depois da segunda pesagem.

O QUE A ESPÉCIE DECIDE

Ela não muda a matemática — quem muda é o modo. A espécie decide como o
número é ESCRITO e DIGITADO: casas decimais, símbolo, teclado do celular
e o passo sugerido. "R$ 1.234,50" e "1234.5 km" são o mesmo float com
roupas diferentes, e errar a roupa faz o hunter desconfiar do número.
"""
from __future__ import annotations

# ── OS DOIS MODOS ────────────────────────────────────────────────────
ACUMULO = "ACUMULO"
MEDICAO = "MEDICAO"
MODOS = (ACUMULO, MEDICAO)

# ── AS ESPÉCIES ──────────────────────────────────────────────────────
#
# `modo_padrao` é só o palpite inicial do lançador. O hunter pode querer
# ACUMULAR peso (a tonelagem levantada na semana) em vez de MEDIR o
# próprio — e o campo continua dele. Padrão não é prisão.
ESPECIES = {
    "VALOR": {
        "rotulo": "Valor",
        "unidade": "R$",
        "casas": 2,
        "passo": 50.0,
        "modo_padrao": ACUMULO,
        "teclado": "decimal",
        "exemplo": "Ganhar 100 reais no turno da manhã",
    },
    "TEMPO": {
        "rotulo": "Tempo",
        "unidade": "min",
        "casas": 0,
        "passo": 15.0,
        "modo_padrao": ACUMULO,
        "teclado": "numeric",
        "exemplo": "Estudar 90 minutos",
    },
    "PESO": {
        "rotulo": "Peso",
        "unidade": "kg",
        "casas": 1,
        "passo": 0.5,
        # A ÚNICA espécie cujo padrão é MEDIÇÃO, e o motivo de este motor
        # ter dois modos.
        "modo_padrao": MEDICAO,
        "teclado": "decimal",
        "exemplo": "Chegar a 78 kg",
    },
    "DISTANCIA": {
        "rotulo": "Distância",
        "unidade": "km",
        "casas": 2,
        "passo": 1.0,
        "modo_padrao": ACUMULO,
        "teclado": "decimal",
        "exemplo": "Correr 5 km",
    },
    "CONTAGEM": {
        "rotulo": "Contagem",
        "unidade": "un",
        "casas": 0,
        "passo": 1.0,
        "modo_padrao": ACUMULO,
        "teclado": "numeric",
        "exemplo": "Ler 40 páginas",
    },
    "LIVRE": {
        "rotulo": "Outra",
        "unidade": "",
        "casas": 2,
        "passo": 1.0,
        "modo_padrao": ACUMULO,
        "teclado": "decimal",
        "exemplo": "A unidade é sua",
    },
}
ESPECIE_PADRAO = "VALOR"


def especie(chave) -> dict:
    """A espécie pedida, ou a padrão. Nunca explode: espécie desconhecida
    no banco não pode derrubar o cartão de quem só queria ver o dia."""
    return ESPECIES.get((chave or "").strip().upper(), ESPECIES[ESPECIE_PADRAO])


def modo(valor, chave_especie=None) -> str:
    """O modo declarado; na ausência, o padrão da espécie."""
    v = (valor or "").strip().upper()
    if v in MODOS:
        return v
    return especie(chave_especie)["modo_padrao"]


def eh_meta_valida(rotina_ou_tarefa) -> bool:
    """
    Isto é uma meta que dá para operar?

    São DUAS condições, e a segunda é a que pega o caso real: a natureza
    ser META não basta — sem `meta_alvo` não há para onde correr, a barra
    não tem fim e `alcancada()` nunca fecharia. Uma meta sem alvo é uma
    missão que não pode ser cumprida, e é melhor o router recusar do que
    o hunter descobrir isso somando valores a noite inteira.
    """
    from motors import especiais
    if especiais.normalizar(getattr(rotina_ou_tarefa, "natureza", None)) != especiais.META:
        return False
    alvo = getattr(rotina_ou_tarefa, "meta_alvo", None)
    try:
        return alvo is not None and float(alvo) != 0
    except (TypeError, ValueError):
        return False


def unidade_de(rotina_ou_tarefa) -> str:
    """A unidade escrita pelo hunter vence a da espécie — ele pode querer
    'US$' ou 'páginas' e não há por que discutir."""
    propria = (getattr(rotina_ou_tarefa, "meta_unidade", None) or "").strip()
    if propria:
        return propria
    return especie(getattr(rotina_ou_tarefa, "meta_especie", None))["unidade"]


def formatar(valor, chave_especie=None, unidade=None) -> str:
    """
    O número vestido: casas decimais da espécie, vírgula decimal e ponto
    de milhar. `1234.5` com espécie VALOR vira `R$ 1.234,50`.

    Formatar no BACKEND é uma decisão: o cartão, o extrato, o Eco e o
    Telegram mostram o mesmo número, e nenhum deles precisa saber quantas
    casas tem um quilograma.
    """
    if valor is None:
        return ""
    e = especie(chave_especie)
    casas = e["casas"]
    un = unidade if unidade is not None else e["unidade"]
    try:
        n = float(valor)
    except (TypeError, ValueError):
        return ""
    texto = f"{n:,.{casas}f}".replace(",", "\x00").replace(".", ",").replace("\x00", ".")
    if not un:
        return texto
    # Símbolo de moeda vem antes; unidade de medida vem depois. "R$ 100"
    # e "5,00 km" — o contrário soa errado nos dois casos.
    return f"{un} {texto}" if un in ("R$", "US$", "€", "$") else f"{texto} {un}"


def leitura(atual, inicial=None, modo_meta=ACUMULO) -> float:
    """
    O valor CORRENTE de uma meta — e a correção de um absurdo.

    O acumulador nasce em zero. No ACÚMULO isso é a verdade: ninguém
    ganhou nada ainda. Na MEDIÇÃO é mentira, e mentira que se vê: uma
    meta "chegar a 78 kg" partindo de 85 aparecia como `0,0 kg` e
    **100% cumprida** no instante em que era criada — porque zero está
    do lado de lá do alvo, e a fração estourava para 1.

    Enquanto não houve pesagem, o valor corrente É O PONTO DE PARTIDA.

    ZERO CONTA COMO "AINDA NÃO MEDIDO", e isso é seguro justamente
    porque é MEDIÇÃO: peso, gordura, pressão. Nenhuma delas vale zero
    numa pessoa viva. No ACÚMULO, onde zero é um valor legítimo, esta
    função não faz nada.
    """
    atual = float(atual or 0)
    if modo_meta == MEDICAO and atual == 0 and inicial is not None:
        return float(inicial)
    return atual


def progresso(atual, alvo, inicial=None, modo_meta=ACUMULO) -> float:
    """
    A fração cumprida, de 0 a 1 — o número que enche a barra e o cartão.

    NO ACÚMULO é `atual / alvo`, e o zero é o começo.

    NA MEDIÇÃO o começo é `inicial`, e a conta é quanto do CAMINHO entre
    o início e o alvo já foi andado. Serve para os dois sentidos sem um
    `if` para emagrecer e outro para engordar: quem sai de 85 rumo a 78 e
    está em 82 andou 3 de 7 — e a mesma divisão responde para quem sai de
    60 rumo a 70.

    Sem `inicial`, a medição não tem de onde medir; devolve 0 em vez de
    inventar um ponto de partida.
    """
    try:
        alvo = float(alvo)
    except (TypeError, ValueError):
        return 0.0
    atual = float(atual or 0)

    if modo_meta == MEDICAO:
        if inicial is None:
            return 0.0
        inicial = float(inicial)
        caminho = alvo - inicial
        if caminho == 0:
            return 1.0 if atual == alvo else 0.0
        return max(0.0, min(1.0, (atual - inicial) / caminho))

    if alvo == 0:
        return 0.0
    return max(0.0, min(1.0, atual / alvo))


def alcancada(atual, alvo, inicial=None, modo_meta=ACUMULO) -> bool:
    """
    A meta foi batida?

    NA MEDIÇÃO O SENTIDO IMPORTA. Quem emagrece bate ao ficar ABAIXO do
    alvo; quem engorda, ao ficar ACIMA. Comparar sempre com `>=` daria a
    meta de emagrecimento por cumprida no primeiro dia, antes de perder
    um grama — o sentido sai da comparação entre início e alvo, não de
    um campo a mais para o hunter preencher.
    """
    try:
        alvo = float(alvo)
    except (TypeError, ValueError):
        return False
    atual = float(atual or 0)

    if modo_meta == MEDICAO and inicial is not None:
        return atual <= alvo if float(inicial) > alvo else atual >= alvo
    return atual >= alvo


def aplicar(anterior, valor, modo_meta=ACUMULO) -> float:
    """
    O acumulado depois de registrar `valor`.

    É UMA LINHA E MESMO ASSIM MORA AQUI, porque é a linha que erra:
    somar pesagens produz 164,5 kg e ninguém percebe até a segunda
    medição. Com a regra num lugar só, o router não tem como escolher
    errado.
    """
    if modo_meta == MEDICAO:
        return float(valor)            # a última leitura vale
    return float(anterior or 0) + float(valor)
