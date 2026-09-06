# -*- coding: utf-8 -*-
"""
O MEDIDOR DE PUNICAO — a barra que enche quando o hunter insiste em falhar.

Cada rotina tem a sua, de 0 a 100. Falhou, enche um tanto. Cheia,
dispara a penitencia. Quitou a penitencia, zera.

POR QUE ELE EXISTE

O gatilho antigo (Regra B do `fechamento`) julga o DIA: se mais de X%
das diarias caiu, uma penitencia. Funciona, e e invisivel — o hunter nao
tem como ver o julgamento chegando. O proprio docstring das regras A-D
diz que o objetivo e "o hunter tem de conseguir prever o que o pune", e
um limiar percentual calculado a meia-noite nao e previsivel.

Uma barra que se ve encher e. Esta e a mesma regra com mostrador.

O QUE ELE NAO E

Nao e uma punicao A MAIS. Se o medidor e o julgamento do dia disparassem
juntos, um dia ruim com tres rotinas falhadas geraria tres penitencias
(barras) mais uma (dia) e bateria o teto de quatro num unico dia — a
espiral que a REGRA 1 do `penitencia.py` existe para impedir. Por isso o
medidor SUBSTITUI a Regra B, e a troca e uma chave na Balanca
(`medidor_dispara`), nao uma reescrita.

A CRITICA NAO E EXCECAO, E O TOPO DA ESCALA

`enche_prioridade[CRITICA] = 100`: uma falha enche a barra inteira e
dispara na hora, dobrada. E exatamente o que a Regra A ja fazia. Em vez
de manter duas mecanicas em sincronia, a Regra A virou o caso particular
do medidor em que o enchimento e total.

A DIFICULDADE ENCHE AO CONTRARIO DO XP

Em `mult_dificuldade`, dificil vale MAIS XP: e mais merito cumprir. Aqui
dificil enche MENOS: e mais compreensivel falhar. Quem nao fez o facil
nao tem desculpa; quem nao fez o lendario tem. Reaproveitar a tabela do
XP daria 2,5x de punicao ao lendario — puniria mais quem tentou a missao
mais dura.
"""
from database import Rotina, TarefaDia
from motors import economia

CHEIO = 100.0


def quanto_enche(rotina, regras: dict | None = None, db=None) -> float:
    """
    Quanto UMA falha desta rotina enche a barra dela.

    Prioridade da o tamanho, dificuldade multiplica. Ambos saem da
    Balanca: e o Arquiteto quem calibra severidade, nao o codigo.
    """
    r = regras or economia.enchimento_regras(db)
    pri = str(getattr(rotina, "prioridade", "") or "MEDIA").upper()
    dif = str(getattr(rotina, "dificuldade", "") or "NORMAL").upper()
    base = r["prioridade"].get(pri, r["prioridade"].get("MEDIA", 25))
    mult = r["dificuldade"].get(dif, r["dificuldade"].get("NORMAL", 1.0))
    return max(0.0, float(base) * float(mult))


def carga(rotina) -> float:
    """A leitura atual, sempre entre 0 e 100."""
    return max(0.0, min(CHEIO, float(getattr(rotina, "carga_punicao", 0) or 0)))


def cheio(rotina) -> bool:
    return carga(rotina) >= CHEIO


def encher(db, rotina, quanto: float | None = None, regras: dict | None = None) -> dict:
    """
    Enche a barra e diz se ela transbordou AGORA.

    `transbordou` e verdadeiro so na chamada que cruzou os 100. Uma barra
    que ja estava cheia e enchida de novo devolve `False` — senao cada
    leitura do extrato dispararia uma penitencia pela mesma barra, que e
    o defeito de escopo que ja custou caro no `_talvez_punir`.
    """
    antes = carga(rotina)
    passo = quanto_enche(rotina, regras, db) if quanto is None else max(0.0, float(quanto))
    depois = min(CHEIO, antes + passo)
    rotina.carga_punicao = depois
    db.flush()
    return {
        "rotina_id": rotina.id,
        "titulo":    rotina.titulo,
        "de":        round(antes, 1),
        "para":      round(depois, 1),
        "passo":     round(passo, 1),
        "transbordou": depois >= CHEIO and antes < CHEIO,
    }


def esvaziar(db, rotina, quanto: float | None = None) -> dict:
    """
    Tira da barra. Sem `quanto`, zera.

    Zerar e o que `quitar` faz: a divida daquela rotina foi paga, a
    contagem de insistencia recomeca.
    """
    antes = carga(rotina)
    depois = 0.0 if quanto is None else max(0.0, antes - max(0.0, float(quanto)))
    rotina.carga_punicao = depois
    db.flush()
    return {"rotina_id": rotina.id, "titulo": rotina.titulo,
            "de": round(antes, 1), "para": round(depois, 1)}


def zerar_por_penitencia(db, tarefa: TarefaDia) -> dict | None:
    """
    A penitencia foi quitada (ou revogada) — o medidor que a gerou zera.

    Usa `origem_rotina_id`, nunca o titulo: dois hunters podem ter rotinas
    homonimas, e renomear uma quebraria o elo em silencio.

    Devolve `None` sem drama quando nao ha o que zerar: penitencia de
    missao geral nao tem medidor, e rotina apagada tambem nao. A divida
    sobrevive a rotina de proposito.
    """
    rid = getattr(tarefa, "origem_rotina_id", None)
    if not rid:
        return None
    r = db.query(Rotina).filter(Rotina.id == rid).first()
    if not r:
        return None
    return esvaziar(db, r)


def leitura(rotina, regras: dict | None = None, db=None) -> dict:
    """
    O que a barra mostra em O Pacto.

    `falhas_para_encher` e o numero que torna a mecanica legivel: "faltam
    duas falhas". E o que o hunter — e o Arquiteto auditando — precisa
    saber para prever a punicao, que e o ponto inteiro do medidor.
    """
    atual = carga(rotina)
    passo = quanto_enche(rotina, regras, db)
    faltam = 0 if atual >= CHEIO else (
        None if passo <= 0 else max(1, int(-(-(CHEIO - atual) // passo)))
    )
    return {
        "rotina_id":   rotina.id,
        "titulo":      rotina.titulo,
        "prioridade":  rotina.prioridade,
        "dificuldade": rotina.dificuldade,
        "carga":       round(atual, 1),
        "passo":       round(passo, 1),
        "cheio":       atual >= CHEIO,
        "falhas_para_encher": faltam,
    }


def de_um_usuario(db, usuario_id: int) -> list:
    """Os medidores de todas as rotinas ativas, o mais cheio primeiro."""
    regras = economia.enchimento_regras(db)
    rotinas = (db.query(Rotina)
                 .filter(Rotina.usuario_id == usuario_id, Rotina.ativo == True)
                 .all())
    linhas = [leitura(r, regras, db) for r in rotinas]
    linhas.sort(key=lambda x: (-x["carga"], x["titulo"] or ""))
    return linhas
