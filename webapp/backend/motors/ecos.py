# -*- coding: utf-8 -*-
"""
Os ECOS DO SISTEMA — a voz que fala quando o hunter falha.

POR QUE ISTO É UM MOTOR E NÃO UMA LISTA NO CLIENTE

Pela mesma razão que a Balança existe: texto no cliente é conteúdo que
o Arquiteto não consegue ajustar sem deploy. E aqui há um segundo
motivo — o Arquiteto vai gerar MIL sussurros. Mil frases no bundle do
navegador seriam ~80 KB carregados em toda visita para exibir UMA.

A INTELIGÊNCIA, em quatro camadas

1. INTENSIDADE — o Sistema muda de tom conforme a dívida cresce.
   Não é decoração: é o que cria pavor sem precisar travar nada.

2. SORTEIO SEM REPETIÇÃO RECENTE — a mesma frase duas vezes seguidas
   mata a ilusão de que há alguém do outro lado. O motor guarda as
   últimas vistas e evita repetir.

3. VARIÁVEIS — `{n}`, `{missao}`, `{dias}`. Uma frase que sabe o nome
   do que você não fez é outra coisa: "Você acha que o Sistema brinca?"
   vira "Fio dental. O Sistema anotou."

4. RARIDADE — algumas frases são raras de propósito. Ver uma frase
   pela primeira vez depois de trinta falhas é o que faz o hunter
   sentir que o Sistema tem mais a dizer do que ele já ouviu.

O CATÁLOGO É SEMENTE, NÃO TETO

As frases abaixo são o mínimo para o recurso funcionar. O formato foi
desenhado para receber mil: a lista é plana, cada item se descreve, e
acrescentar não exige tocar em código nenhum.
"""
import random

# ── AS INTENSIDADES ──────────────────────────────────────────────────
# A escada que o Sistema sobe conforme a dívida se acumula.
SECA        = "SECA"         # 1 pendência — constatação, sem julgamento
ENCARANDO   = "ENCARANDO"    # 2 a 3       — o Sistema te olha nos olhos
FRIA        = "FRIA"         # 4 ou mais   — parou de perguntar por quê
VAZIO       = "VAZIO"        # sem pacto   — ameaça e convite
QUITADO     = "QUITADO"      # pagou       — a única voz que não pune

INTENSIDADES = (SECA, ENCARANDO, FRIA, VAZIO, QUITADO)


def intensidade_por_divida(pendentes: int, tem_pacto: bool = True) -> str:
    """
    Qual voz o Sistema usa. Uma função pura, e é de propósito: a
    escolha do tom não pode depender de onde o Eco foi chamado.
    """
    if not tem_pacto:
        return VAZIO
    if pendentes >= 4:
        return FRIA
    if pendentes >= 2:
        return ENCARANDO
    return SECA


# ── O CATÁLOGO ───────────────────────────────────────────────────────
#
# Formato de cada entrada:
#     (intensidade, texto, peso)
#
# `peso` é a raridade: 3 = comum, 2 = ocasional, 1 = rara.
# Frases raras existem para o hunter descobrir uma nova no trigésimo
# fracasso — é o que sustenta a sensação de que há alguém escrevendo.
#
# Variáveis disponíveis no texto:
#     {jogador}   como o Sistema o chama          → "Jogador"
#     {missao}    o título da missão que falhou   → "Passar fio dental"
#     {n}         quantas pendências existem      → "3"
#     {dias}      há quantos dias a mais antiga   → "5"
#
# Toda variável ausente é substituída por algo neutro — uma frase nunca
# aparece com "{missao}" cru na tela. Ver `_preencher`.

CATALOGO = [
    # ══ SECA — a primeira falha. Constatação, não sermão. ══════════
    (SECA, "O Sistema registra.", 3),
    (SECA, "Você não cumpriu. Isso ficou anotado.", 3),
    (SECA, "Uma dívida foi aberta em seu nome, {jogador}.", 3),
    (SECA, "{missao}. O Sistema anotou.", 3),
    (SECA, "Nada acontece sem registro.", 2),
    (SECA, "O Sistema não julga. Ele apenas guarda.", 2),
    (SECA, "Havia uma promessa aqui.", 2),
    (SECA, "O dia fechou. A conta, não.", 2),
    (SECA, "Anotado. Sem alarde.", 2),
    (SECA, "O Sistema esperou até o fim. Você não veio.", 1),
    (SECA, "Este é o tipo de coisa que ninguém vê. Exceto o Sistema.", 1),

    # ══ ENCARANDO — reincidência. Agora ele fala com você. ═════════
    (ENCARANDO, "Você acha que o Sistema brinca, {jogador}?", 3),
    (ENCARANDO, "{n} dívidas. O Sistema está contando.", 3),
    (ENCARANDO, "Não confunda paciência com permissão.", 3),
    (ENCARANDO, "Você prometeu. O Sistema apenas escutou.", 3),
    (ENCARANDO, "De novo {missao}. O Sistema percebeu o padrão.", 2),
    (ENCARANDO, "A segunda vez não é acidente, {jogador}.", 2),
    (ENCARANDO, "O Sistema tem memória. Você tem desculpas.", 2),
    (ENCARANDO, "Duas. E o dia ainda não acabou.", 2),
    (ENCARANDO, "Você negocia consigo mesmo. O Sistema não participa.", 1),
    (ENCARANDO, "Há {dias} dias isto se repete. O Sistema notou antes de você.", 1),

    # ══ FRIA — acúmulo. O Sistema parou de perguntar. ══════════════
    (FRIA, "{n}. O Sistema parou de perguntar por quê.", 3),
    (FRIA, "Não há punição maior que carregar o próprio registro.", 3),
    (FRIA, "Continue. O Sistema tem mais tempo que você.", 3),
    (FRIA, "O Sistema parou de contar. Resolva o que já existe.", 3),
    (FRIA, "{n} dívidas. Nenhuma delas vai embora sozinha.", 2),
    (FRIA, "Você não está atrasado. Você está parado.", 2),
    (FRIA, "O Sistema não tem raiva. Tem registro.", 2),
    (FRIA, "Há {dias} dias a mesma linha espera.", 2),
    (FRIA, "Um dia isto vai ser um número que você não vai querer ler.", 1),
    (FRIA, "O Sistema já viu jogadores desaparecerem exatamente aqui.", 1),

    # ══ VAZIO — falhou, e não há pacto para cobrar. ════════════════
    (VAZIO, "O Sistema não tem com que cobrar. Ainda.", 3),
    (VAZIO, "Nenhum pacto foi firmado. A falha fica sem preço.", 3),
    (VAZIO, "Você falhou impunemente, {jogador}. Aproveite.", 2),
    (VAZIO, "Sem pacto, o Sistema só observa. Por enquanto.", 2),
    (VAZIO, "O Sistema aguarda o dia em que você definir o próprio preço.", 1),

    # ══ QUITADO — a única voz que não pune. ════════════════════════
    (QUITADO, "Dívida quitada. O Sistema registra também isto.", 3),
    (QUITADO, "Pago. O Sistema não guarda rancor — guarda o registro.", 3),
    (QUITADO, "Você pagou o que devia.", 3),
    (QUITADO, "Uma linha a menos.", 2),
    (QUITADO, "O Sistema esperava que você não voltasse. Você voltou.", 1),
]


# ── SELEÇÃO ──────────────────────────────────────────────────────────

def _preencher(texto: str, ctx: dict) -> str:
    """
    Troca as variáveis, e NUNCA deixa uma chave crua na tela.

    Uma frase com "{missao}" aparecendo literalmente destrói em um
    segundo a ilusão de que há uma entidade falando. O fallback é
    neutro de propósito: a frase perde precisão, não sentido.
    """
    padroes = {
        "jogador": ctx.get("jogador") or "Jogador",
        "missao":  ctx.get("missao")  or "O que ficou por fazer",
        "n":       str(ctx.get("n") if ctx.get("n") is not None else 1),
        "dias":    str(ctx.get("dias") if ctx.get("dias") is not None else 1),
    }
    for chave, valor in padroes.items():
        texto = texto.replace("{" + chave + "}", str(valor))
    return texto


def sortear(intensidade: str, ctx: dict = None, evitar=None) -> dict:
    """
    Escolhe um eco.

    `evitar` é a lista das últimas frases mostradas. Repetir a mesma
    duas vezes seguidas é o que mais rápido revela que não há ninguém
    do outro lado — mais rápido até que uma frase mal escrita.

    O sorteio é PONDERADO pelo peso, então frase rara é rara de
    verdade. Se todas as candidatas estiverem na lista de evitar, o
    filtro cede — melhor repetir que ficar mudo.
    """
    ctx = ctx or {}
    evitar = set(evitar or ())

    candidatas = [e for e in CATALOGO if e[0] == intensidade]
    if not candidatas:                       # intensidade desconhecida
        candidatas = [e for e in CATALOGO if e[0] == SECA]

    frescas = [e for e in candidatas if e[1] not in evitar]
    pool = frescas or candidatas             # cede em vez de emudecer

    texto = random.choices(pool, weights=[max(1, e[2]) for e in pool], k=1)[0][1]
    return {
        "intensidade": intensidade,
        "cru":   texto,                      # com as chaves, para o `evitar`
        "texto": _preencher(texto, ctx),
    }


def para_falha(pendentes: int, tem_pacto: bool = True,
               ctx: dict = None, evitar=None) -> dict:
    """Atalho: o Eco de uma falha, com o tom já decidido pela dívida."""
    ctx = dict(ctx or {})
    ctx.setdefault("n", pendentes)
    return sortear(intensidade_por_divida(pendentes, tem_pacto), ctx, evitar)


def estatisticas() -> dict:
    """Quantas frases há, por intensidade. Serve à Forja e ao teste."""
    por = {}
    for i, _t, _p in CATALOGO:
        por[i] = por.get(i, 0) + 1
    return {"total": len(CATALOGO), "por_intensidade": por}
