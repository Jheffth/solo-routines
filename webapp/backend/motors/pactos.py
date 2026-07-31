# -*- coding: utf-8 -*-
"""
O PACTO — as penitências, e as duas camadas que quase virei uma só.

O Arquiteto separou o que eu tinha misturado:

    CAMADA 1   TIPO DE CARD    a MECÂNICA — como o Sistema sabe que
                               a dívida foi paga
    CAMADA 2   PACTO PRONTO    o CONTEÚDO — item de catálogo, adotado
                               num toque, que É uma instância de um
                               tipo da camada 1

Eu havia listado "Antecipação" e "Registro" como tipos. Não são
mecânica nenhuma: uma é missão comum com data, a outra é missão comum
com título. Classifiquei por como SOAVAM, não por como se comportam —
o mesmo erro que me fez tratar recorrência e natureza como um eixo só.

POR QUE QUATRO TIPOS É O TETO

Não é escolha de escopo. Só há quatro formas de o Sistema saber que a
penitência foi cumprida:

    contou      QUANTITATIVA   o hunter aperta +N vezes
    aguentou    RESTRITIVA     a janela fechou sem confissão
    cronometrou TEMPORAL       o cronômetro rodou até o fim
    pagou       TRIBUTO        o Sistema debitou, e ninguém precisou fazer nada

Qualquer penitência imaginável cai numa dessas. O catálogo cresce sem
limite; os tipos, não.
"""

# ── CAMADA 1: OS QUATRO TIPOS ────────────────────────────────────────
QUANTITATIVA = "QUANTITATIVA"   # → natureza REPETICAO, modo META
RESTRITIVA   = "RESTRITIVA"     # → natureza PASSIVA (janela + Confessar)
TEMPORAL     = "TEMPORAL"       # → natureza ATIVA com prazo
TRIBUTO      = "TRIBUTO"        # → o Sistema debita Mana sozinho

TIPOS = (QUANTITATIVA, RESTRITIVA, TEMPORAL, TRIBUTO)

# A natureza de missão que cada tipo usa ao virar cartão. Três dos
# quatro reaproveitam o que já existe — foi por isso que o custo desta
# feature despencou quando o Arquiteto descreveu os tipos e eu os
# encontrei já construídos no código.
NATUREZA_DO_TIPO = {
    QUANTITATIVA: "REPETICAO",
    RESTRITIVA:   "PASSIVA",
    TEMPORAL:     "ATIVA",
    TRIBUTO:      None,          # não vira cartão: cobra e pronto
}

# Fator de escala por tipo. A quantitativa dobra; a temporal sobe mais
# devagar porque dobrar MINUTOS chega ao absurdo rápido demais —
# 20 → 40 → 80 → 160 já é quase três horas no quarto tropeço.
ESCALA_DO_TIPO = {
    QUANTITATIVA: 2.0,
    RESTRITIVA:   None,   # não escala por reincidência: cresce por CONFISSÃO
    TEMPORAL:     1.5,
    TRIBUTO:      2.0,
}


# ── CAMADA 2: O CATÁLOGO ─────────────────────────────────────────────
#
# Dados, não código. Cada entrada:
#     (chave, grupo, tipo, titulo, base, teto, unidade)
#
# `{n}` no título é substituído pelo valor corrente — o mesmo token que
# o lançador já usa nas missões de repetição. Uma sintaxe, um lugar.
#
# Os números abaixo são um PALPITE meu, e o Arquiteto foi avisado
# disso: "12 horas sem redes sociais" soa razoável e eu não tenho como
# calibrar sem usar. Estão aqui para o recurso nascer funcionando, não
# para ficarem como estão.

CATALOGO = [
    # ── CORPO ────────────────────────────────────────────────────
    ("flexoes",     "Corpo", QUANTITATIVA, "Fazer {n} flexões",            1,  32, "flexões"),
    ("abdominais",  "Corpo", QUANTITATIVA, "Fazer {n} abdominais",         5, 100, "abdominais"),
    ("agachamentos","Corpo", QUANTITATIVA, "Fazer {n} agachamentos",       5, 100, "agachamentos"),
    ("escada",      "Corpo", QUANTITATIVA, "Subir {n} lances de escada",   2,  20, "lances"),
    ("prancha",     "Corpo", TEMPORAL,     "{n} minutos de prancha",       1,   8, "min"),
    ("polichinelo", "Corpo", QUANTITATIVA, "Fazer {n} polichinelos",      20, 200, "polichinelos"),

    # ── RESTRIÇÃO ────────────────────────────────────────────────
    ("sem_redes",   "Restrição", RESTRITIVA, "{n} horas sem redes sociais", 12, 48, "h"),
    ("sem_doce",    "Restrição", RESTRITIVA, "{n} horas sem doce",          24, 72, "h"),
    ("sem_jogos",   "Restrição", RESTRITIVA, "{n} horas sem jogos",         12, 48, "h"),
    ("sem_delivery","Restrição", RESTRITIVA, "{n} horas sem delivery",      24, 72, "h"),
    ("sem_tela",    "Restrição", RESTRITIVA, "{n} horas sem tela após as 22h", 12, 36, "h"),

    # ── TEMPO ────────────────────────────────────────────────────
    ("leitura_pe",  "Tempo", TEMPORAL, "{n} minutos de leitura em pé",   20, 120, "min"),
    ("estudo_extra","Tempo", TEMPORAL, "{n} minutos de estudo extra",    30, 180, "min"),
    ("faxina",      "Tempo", TEMPORAL, "{n} minutos de faxina",          15,  90, "min"),
    ("caminhada",   "Tempo", TEMPORAL, "{n} minutos de caminhada",       20, 120, "min"),

    # ── TRIBUTO ──────────────────────────────────────────────────
    # O único que se executa sozinho, e por isso o único que garante
    # que a dívida seja PAGA em vez de apenas exibida.
    ("tributo_mana","Tributo", TRIBUTO, "{n} de Mana ao Sistema",         50, 400, "Mana"),

    # ── REFLEXÃO ─────────────────────────────────────────────────
    # Eu havia chamado isto de "tipo REGISTRO". Não é mecânica: é
    # conteúdo. Fica no catálogo mesmo sendo o mais leve fisicamente
    # porque escrever POR QUE falhou é mais desconfortável que trinta
    # abdominais — e é o único item com chance de mudar alguma coisa.
    ("escrever_3",  "Reflexão", TEMPORAL, "Escrever três linhas sobre a falha", 5, 15, "min"),
    ("reler_metas", "Reflexão", TEMPORAL, "Reler suas metas do mês",            5, 15, "min"),
    ("planejar",    "Reflexão", TEMPORAL, "Planejar o dia de amanhã por escrito", 10, 30, "min"),
]


def catalogo() -> list:
    """O catálogo em forma de dicionário, pronto para a API."""
    return [
        {"chave": c, "grupo": g, "tipo": t, "titulo": ti,
         "base": b, "teto": te, "unidade": u,
         "exemplo": ti.replace("{n}", str(b))}
        for c, g, t, ti, b, te, u in CATALOGO
    ]


def do_catalogo(chave: str) -> dict | None:
    for item in catalogo():
        if item["chave"] == chave:
            return item
    return None


def grupos() -> list:
    """Os grupos, na ordem em que aparecem no catálogo."""
    vistos, ordem = set(), []
    for _c, g, *_ in CATALOGO:
        if g not in vistos:
            vistos.add(g)
            ordem.append(g)
    return ordem


# ── ESCALONAMENTO E DECAIMENTO ───────────────────────────────────────

def escalar(valor: int, tipo: str, teto: int, fator_balanca: float = None) -> int:
    """
    O próximo degrau, quando a MESMA penitência cai de novo.

    Foi a melhor ideia desta feature, e é do Arquiteto: cair na mesma
    penitência duas vezes não é repetição, é AGRAVAMENTO. Um pacto de
    três itens já assusta.

    O teto não é só segurança. Se alguém quebra a mesma restrição toda
    vez, subir de 24h para 25h é punir por uma estratégia que não está
    funcionando — e mais do mesmo não vai passar a funcionar. Melhor
    travar e deixar o ACÚMULO falar.
    """
    f = ESCALA_DO_TIPO.get(tipo)
    if f is None:                      # RESTRITIVA cresce por confissão
        f = float(fator_balanca or 2)
    if fator_balanca and tipo in (QUANTITATIVA, TRIBUTO):
        f = float(fator_balanca)
    return int(min(teto, max(1, round(valor * f))))


def fator_efetivo(tipo: str, fator_balanca: float = None) -> float:
    """
    O fator que `escalar` REALMENTE aplica — não o que a tabela declara.

    DIVERGÊNCIA ENCONTRADA, e é preciso saber que ela existe:

        ESCALA_DO_TIPO[RESTRITIVA] = None   # "não escala por reincidência"
        escalar(12, RESTRITIVA, 48)  → 24   # dobra

    O `None` da tabela quer dizer "esta cresce por CONFISSÃO, não por
    reincidência". Mas `escalar` lê o mesmo `None` como "não há fator
    próprio, use o padrão" e cai em `float(fator_balanca or 2)`. Duas
    leituras do mesmo valor, e nenhuma das duas está escrita errado
    sozinha — só juntas.

    Esta função existe para que quem PERGUNTA o fator (o lançador, para
    desenhar a escada) receba o comportamento observado, e não a
    intenção declarada. Uma prévia que promete "não escala" enquanto o
    Sistema dobra é pior que prévia nenhuma.

    Quando o Arquiteto decidir qual das duas leituras vale, o conserto é
    num lugar só: ou `ESCALA_DO_TIPO`, ou o `if f is None` de `escalar`.
    Esta função continua dizendo a verdade nos dois casos, porque ela
    MEDE em vez de declarar.
    """
    antes = 100
    depois = escalar(antes, tipo, 10 ** 9, fator_balanca)
    return round(depois / antes, 4)


def decair(valor: int, base: int, tipo: str, degraus: int = 1,
           fator_balanca: float = None) -> int:
    """
    O caminho de volta.

    A LACUNA que o escalonamento abria: sem reset, o hunter chega ao
    teto e mora lá — e aí o escalonamento morre como mecânica, porque
    deixa de haver diferença entre a primeira falha e a centésima.

    O decaimento espelha o streak, que este app já entende, e faz o bom
    comportamento desfazer o estrago de forma VISÍVEL: 16 flexões viram
    8 depois de uma semana limpa, 4 depois de duas.

    Nunca cai abaixo da base — a penitência não some, ela recua.
    """
    f = ESCALA_DO_TIPO.get(tipo) or float(fator_balanca or 2)
    if fator_balanca and tipo in (QUANTITATIVA, TRIBUTO):
        f = float(fator_balanca)
    v = float(valor)
    for _ in range(max(0, int(degraus))):
        v = v / f
    return int(max(base, round(v)))


def sortear_indice(total: int, ja_sorteados: list) -> int:
    """
    SORTEIO SEM REPOSIÇÃO — o Sistema percorre o pacto inteiro antes de
    repetir qualquer penitência.

    Aleatório puro tira "30 abdominais" cinco vezes seguidas e a
    mecânica vira piada. Com três penitências cadastradas, as três caem
    antes de a primeira voltar.

    Quando o ciclo fecha, ele recomeça: `ja_sorteados` é zerado pelo
    chamador ao receber -1... não. Devolve o índice E o novo estado,
    para que a decisão de zerar não fique espalhada.
    """
    import random
    if total <= 0:
        return -1
    restantes = [i for i in range(total) if i not in set(ja_sorteados or ())]
    if not restantes:                  # ciclo fechado: recomeça
        restantes = list(range(total))
    return random.choice(restantes)
