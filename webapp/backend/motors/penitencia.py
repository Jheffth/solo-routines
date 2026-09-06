# -*- coding: utf-8 -*-
"""
A PENITENCIA — onde a divida nasce, escala e se quita.

Este motor existe para que a regra da punicao viva num lugar so. O
fechamento do dia chama `cobrar`; o cartao chama `quitar`; o Reerguer
chama `revogar`. Nenhum deles conhece a regra — todos conhecem este
arquivo.

AS TRES REGRAS QUE NAO PODEM SER ESQUECIDAS

1. FALHAR UMA PENITENCIA NAO GERA OUTRA.
   Sem isto, um dia ruim vira espiral infinita e o app deixa de ser
   recuperavel. A penitencia que nao e cumprida simplesmente NAO SAI
   DA LISTA. Ela nao fracassa, nao pune, nao expira: ela fica. E ficar
   e a punicao.

2. O TETO DA DIVIDA PARA A BOLA DE NEVE.
   A partir de `divida_teto` pendentes, o Sistema PARA DE CRIAR. Parar
   de contar e mais ameacador que continuar — e impede alguem de
   acordar com quarenta cartoes depois de uma semana ruim.

3. AS DUAS PORTAS EXISTENTES SAO RESPEITADAS.
   Reerguer desfaz o fracasso, entao REVOGA a penitencia que ele gerou.
   Confessar e honestidade, e este app ja premia isso — confissao NAO
   gera penitencia. Punir quem admitiu ensina a nao admitir.
"""
from datetime import date, timedelta

from database import Pacto, Rotina, TarefaDia
from motors import ecos, economia, pactos as cat, tempo


# ── LEITURA ──────────────────────────────────────────────────────────

def pendentes(db, usuario_id: int) -> list:
    """As penitencias em aberto, mais antigas primeiro."""
    return (db.query(TarefaDia)
              .filter(TarefaDia.usuario_id == usuario_id,
                      TarefaDia.natureza == "PUNICAO",
                      TarefaDia.status.notin_(("CONCLUIDA", "CANCELADA")))
              .order_by(TarefaDia.origem_data.asc(), TarefaDia.id.asc())
              .all())


def contar(db, usuario_id: int) -> int:
    return len(pendentes(db, usuario_id))


def tem_pacto(db, usuario_id: int) -> bool:
    return db.query(Pacto).filter(Pacto.usuario_id == usuario_id,
                                  Pacto.ativo == True).count() > 0


# ── ESCALONAMENTO E DECAIMENTO ───────────────────────────────────────

def _aplicar_decaimento(db, p: Pacto, hoje: date, regras: dict) -> None:
    """
    O caminho de volta, cobrado na hora de sortear.

    Rodar isto num agendador diario seria trabalho para nada: o valor
    so importa quando a penitencia CAI. Entao o decaimento e calculado
    aqui, a partir da distancia entre hoje e a ultima queda — e o
    resultado e identico ao de um cron rodando todo dia, sem cron.
    """
    if not p.ultima_queda or p.valor_atual <= p.base:
        return
    dias = (hoje - p.ultima_queda).days
    degraus = dias // max(1, regras["decaimento_dias"])
    if degraus > 0:
        p.valor_atual = cat.decair(p.valor_atual, p.base, p.tipo, degraus,
                                   regras["escala_fator"])


def _sortear(db, usuario_id: int, hoje: date, regras: dict) -> Pacto | None:
    """
    Qual penitencia cai. Sorteio SEM REPOSICAO: o Sistema percorre o
    pacto inteiro antes de repetir qualquer uma.

    Aleatorio puro tiraria a mesma cinco vezes seguidas, e a mecanica
    viraria piada.
    """
    lista = (db.query(Pacto)
               .filter(Pacto.usuario_id == usuario_id, Pacto.ativo == True)
               .order_by(Pacto.id).all())
    if not lista:
        return None

    ciclo_atual = max((p.ciclo for p in lista), default=0)
    disponiveis = [i for i, p in enumerate(lista) if p.ciclo < ciclo_atual]
    if not disponiveis:                      # ciclo fechado: recomeca
        disponiveis = list(range(len(lista)))
        ciclo_atual += 1

    import random
    escolhido = lista[random.choice(disponiveis)]
    escolhido.ciclo = ciclo_atual

    _aplicar_decaimento(db, escolhido, hoje, regras)
    return escolhido


# ── A COBRANCA ───────────────────────────────────────────────────────

def cobrar(db, usuario, missao_titulo: str, missao_data: date,
           xp_perdido: int = 0, dobrar: bool = False,
           rotina_id: int | None = None, teste: bool = False) -> dict:
    """
    O Sistema cobra. Devolve o que aconteceu, para o Eco falar.

    `dobrar` e a severidade sem burocracia nova: uma falha critica
    sorteia DUAS penitencias em vez de uma. Nenhum campo a mais no
    pacto, e a escala e sentida na hora.
    """
    hoje = tempo.hoje()
    regras = economia.punicao_regras(db)
    ja = contar(db, usuario.id)

    # REGRA 2 — o teto. O Sistema para de criar e diz isso.
    if ja >= regras["divida_teto"]:
        return {"criadas": [], "no_teto": True, "pendentes": ja,
                "eco": ecos.sortear(ecos.FRIA,
                                    {"jogador": "Jogador", "n": ja,
                                     "missao": missao_titulo})}

    if not tem_pacto(db, usuario.id):
        return {"criadas": [], "sem_pacto": True, "pendentes": ja,
                "eco": ecos.sortear(ecos.VAZIO,
                                    {"jogador": "Jogador", "missao": missao_titulo})}

    quantas = 2 if dobrar else 1
    quantas = min(quantas, regras["divida_teto"] - ja)
    criadas = []

    for _ in range(quantas):
        p = _sortear(db, usuario.id, hoje, regras)
        if not p:
            break

        titulo = (p.titulo or "").replace("{n}", str(p.valor_atual))
        t = TarefaDia(
            titulo=titulo,
            descricao=None,
            data_prevista=hoje,
            prioridade="ALTA",
            categoria="Combate",
            status="PENDENTE",
            usuario_id=usuario.id,
            # NAO PAGA E NAO PUNE. Cumprir QUITA a divida; nao e uma
            # nova fonte de progresso. Se pagasse, falhar de proposito
            # viraria estrategia.
            xp_recompensa=0,
            moedas_recompensa=0,
            penalidade_xp=0,
        )
        t.natureza = "PUNICAO"
        t.pacto_id = p.id
        t.origem_titulo = missao_titulo
        t.origem_data = missao_data or hoje
        # O elo com o medidor: qual barra zerar quando esta divida for
        # quitada. `origem_titulo` continua sendo a copia que MOSTRA (e
        # sobrevive a exclusao da rotina); o id e o que AGE.
        t.origem_rotina_id = rotina_id
        # PUNICAO DE TESTE do Arquiteto. Marcada, nao enfraquecida: ela
        # cobra, escala o pacto, conta para o teto e e quitada igual. A
        # marca existe so para poder varrer depois — auditar o sistema
        # nao pode significar sujar o historico que se quer auditar.
        t.teste = bool(teste)
        # A REPARACAO: ao quitar, o Sistema devolve uma fracao do que
        # tomou. Nao e lucro — devolver mais que o perdido seria pagar
        # por falhar.
        t.xp_a_reparar = int(max(0, xp_perdido) * regras["reparacao_pct"] / 100)

        # O tipo do pacto vira a mecanica do cartao (§CAMADA 1).
        if p.tipo == cat.QUANTITATIVA:
            t.alvo_repeticoes = int(p.valor_atual)
        elif p.tipo == cat.RESTRITIVA:
            t.hora_inicio = tempo.agora().strftime("%H:%M")
        elif p.tipo == cat.TEMPORAL:
            t.prazo_minutos = int(p.valor_atual)
        elif p.tipo == cat.TRIBUTO:
            # O UNICO QUE SE EXECUTA SOZINHO. Nao vira cartao: o saldo
            # cai e pronto. E o unico tipo que garante que a divida
            # seja PAGA em vez de apenas exibida.
            usuario.moedas = max(0, (usuario.moedas or 0) - int(p.valor_atual))
            t.status = "CONCLUIDA"
            t.concluida_em = tempo.agora()

        db.add(t)
        db.flush()
        criadas.append(t)

        # Escala para a PROXIMA vez que esta penitencia cair.
        p.vezes_caiu = (p.vezes_caiu or 0) + 1
        p.ultima_queda = hoje
        p.valor_atual = cat.escalar(p.valor_atual, p.tipo, p.teto,
                                    regras["escala_fator"])

    total = ja + len(criadas)
    return {
        "criadas": [{"id": t.id, "titulo": t.titulo} for t in criadas],
        "no_teto": False,
        "pendentes": total,
        "eco": ecos.para_falha(total, True,
                               {"jogador": "Jogador", "missao": missao_titulo,
                                "n": total}),
    }


# ── AS PORTAS ────────────────────────────────────────────────────────

def revogar(db, usuario_id: int, missao_titulo: str, missao_data: date) -> int:
    """
    REERGUER desfez o fracasso — entao a penitencia dele nao existe
    mais. Pagar Mana para reabrir a missao e ainda carregar a divida
    seria cobrar duas vezes pela mesma falha.

    Devolve quantas foram revogadas.
    """
    q = (db.query(TarefaDia)
           .filter(TarefaDia.usuario_id == usuario_id,
                   TarefaDia.natureza == "PUNICAO",
                   TarefaDia.origem_titulo == missao_titulo,
                   TarefaDia.origem_data == missao_data,
                   TarefaDia.status.notin_(("CONCLUIDA", "CANCELADA"))))
    achadas = q.all()
    from motors import medidor
    for t in achadas:
        # Devolve o degrau: a penitencia nao chegou a valer.
        p = db.query(Pacto).get(t.pacto_id) if t.pacto_id else None
        if p:
            p.valor_atual = cat.decair(p.valor_atual, p.base, p.tipo, 1,
                                       economia.punicao_regras(db)["escala_fator"])
            p.vezes_caiu = max(0, (p.vezes_caiu or 1) - 1)
        # DEVOLVE TAMBEM O QUE A FALHA ENCHEU — nao zera.
        #
        # Reerguer desfez UMA falha, nao a insistencia inteira. Zerar aqui
        # daria ao Reerguer o poder de limpar semanas de descumprimento
        # por 25 de Mana, e o medidor viraria decoracao. Entao subtraimos
        # exatamente o passo daquela rotina: a barra volta ao ponto de
        # antes da falha desfeita.
        rid = getattr(t, "origem_rotina_id", None)
        if rid:
            r = db.query(Rotina).filter(Rotina.id == rid).first()
            if r:
                medidor.esvaziar(db, r, quanto=medidor.quanto_enche(r, db=db))
        db.delete(t)
    return len(achadas)


def abater(db, usuario, quanto: int = 1) -> dict | None:
    """
    CUMPRIR O DEVER ABATE A DÍVIDA — um pouco.

    Toda missão concluída tira um pedaço da barra da penitência mais
    antiga em aberto. A ideia é do Arquiteto e é boa: quem voltou aos
    trilhos já está pagando de alguma forma, e um Sistema que só aceita
    o pagamento na moeda exata da punição empurra quem falhou para longe
    — justamente no momento em que ele voltou.

    DUAS REGRAS QUE FAZEM ISTO NÃO VIRAR ESCAPATÓRIA

    1. NUNCA FECHA A ÚLTIMA UNIDADE. O abatimento reduz até faltar UMA,
       e para. O passo final é sempre um ato do hunter — se cumprir
       missões quitasse a penitência sozinha, a penitência deixaria de
       ser uma coisa a fazer e viraria um número que some.

    2. SÓ ABATE O QUE TEM BARRA. Penitência QUANTITATIVA ("faça 40
       flexões") tem alvo e progresso. TEMPORAL, RESTRITIVA e TRIBUTO
       não têm barra que se possa mover pela metade — cumprir metade de
       "sem doce até as 18h" não significa nada. Elas são deixadas em
       paz, e isso é uma decisão, não um esquecimento.

    Abate a MAIS ANTIGA: é a que mais pesa no teto e a que o hunter
    carrega há mais tempo.
    """
    if quanto <= 0:
        return None
    for t in pendentes(db, usuario.id):
        alvo = int(getattr(t, "alvo_repeticoes", 0) or 0)
        if alvo <= 1:
            continue                     # sem barra, ou barra de um passo só
        feitas = int(getattr(t, "repeticoes", 0) or 0)
        teto = alvo - 1                  # a regra 1, em uma linha
        if feitas >= teto:
            continue                     # já está a um passo do fim
        novo = min(teto, feitas + quanto)
        t.repeticoes = novo
        return {"tarefa_id": t.id, "titulo": t.titulo,
                "de": feitas, "para": novo, "alvo": alvo,
                "restam": alvo - novo}
    return None


def quitar(db, usuario, tarefa: TarefaDia) -> dict:
    """
    A divida foi paga. Devolve a fracao de XP e cala o Eco em tom bom.

    E o unico Eco que nao pune — e ele existe porque um Sistema que so
    fala quando voce erra vira ruido de fundo. Falar quando acerta e o
    que faz o silencio dele significar alguma coisa.
    """
    reparo = int(getattr(tarefa, "xp_a_reparar", 0) or 0)
    if reparo > 0:
        usuario.xp_total = (usuario.xp_total or 0) + reparo
        usuario.xp_atual = (usuario.xp_atual or 0) + reparo

    tarefa.status = "CONCLUIDA"
    tarefa.concluida_em = tempo.agora()

    # A DIVIDA PAGA ZERA O MEDIDOR da rotina que a gerou. A contagem de
    # insistencia recomeca do zero — quem pagou nao continua a um passo
    # da proxima punicao pela mesma rotina.
    from motors import medidor
    medidor.zerar_por_penitencia(db, tarefa)

    restantes = max(0, contar(db, usuario.id) - 1)
    return {
        "xp_reparado": reparo,
        "pendentes": restantes,
        "eco": ecos.sortear(ecos.QUITADO, {"jogador": "Jogador", "n": restantes}),
    }
