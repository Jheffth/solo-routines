# -*- coding: utf-8 -*-
"""
A SINCRONIA — o que decide criar, atualizar, apagar ou não fazer nada.

O PRINCÍPIO: NUNCA CRIAR SEM PROCURAR ANTES

Evento duplicado é o defeito clássico destas integrações e o pior de
todos, porque é silencioso: ninguém percebe até a agenda estar com três
cópias de cada rotina, e aí o estrago já tem semanas. A defesa é dupla,
de propósito:

  1. A tabela `EventoCalendario` — a via rápida. Um SELECT diz qual evento
     do Google corresponde a qual missão.
  2. `extendedProperties.private.solo_id` DENTRO do evento — a rede de
     reconciliação. Se o banco local perder o elo (restauração de backup,
     hunter reconectando a conta), `_reconciliar` varre a agenda e
     reencontra cada evento pelo selo em vez de criar tudo de novo.

Só a tabela seria rápida e frágil; só o selo seria robusto e caro. Juntos,
o caminho comum custa um SELECT e o caminho ruim ainda se recupera.

O SEGUNDO PRINCÍPIO: NÃO ESCREVER À TOA

`solo_rev` é o hash do evento gerado. Se ele bate com o que está guardado,
não há PATCH — a missão não mudou. Sem isso, cada sincronia reescreveria a
agenda inteira, gastaria quota e faria o Google notificar "evento
atualizado" sem nada ter mudado, que é como um app ensina o usuário a
desligar as notificações dele.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import or_

from database import (
    ContaCalendario, EventoCalendario, Dungeon, Rotina, TarefaDia,
)
from motors import calendario as motor
from motors import calendario_eventos as trad
from motors import tempo


# ══════════════════════════════════════════════════════════════════════
# O QUE DEVERIA ESTAR NA AGENDA
# ══════════════════════════════════════════════════════════════════════
def _desejado(db, conta) -> dict:
    """
    `{(origem, id): evento}` — o retrato do que a agenda deve conter.

    Colher tudo ANTES de escrever qualquer coisa é o que permite a etapa
    seguinte: o que está na agenda e não está aqui deve ser APAGADO. Sem o
    retrato completo, uma rotina arquivada ficaria para sempre marcada.
    """
    hoje = tempo.hoje()
    aviso = int(getattr(conta, "aviso_min", 30) or 30)
    uid = conta.usuario_id
    out = {}

    if getattr(conta, "sinc_dungeons", True):
        for d in db.query(Dungeon).filter(
                Dungeon.usuario_id == uid, Dungeon.status == "ATIVA").all():
            ev = trad.de_dungeon(d, hoje, aviso)
            if ev:
                out[("dungeon", d.id)] = ev

    if getattr(conta, "sinc_rotinas", True):
        for r in db.query(Rotina).filter(
                Rotina.usuario_id == uid, Rotina.ativo == True).all():   # noqa: E712
            ev = trad.de_rotina(r, hoje, aviso)
            if ev:
                out[("rotina", r.id)] = ev

    if getattr(conta, "sinc_tarefas", True):
        # SÓ O FUTURO E O HOJE. Missão geral vencida não vira compromisso —
        # e uma varredura no histórico inteiro criaria centenas de eventos
        # num passado que ninguém vai olhar, queimando quota por nada.
        for t in db.query(TarefaDia).filter(
                TarefaDia.usuario_id == uid,
                TarefaDia.data_prevista >= hoje).all():
            ev = trad.de_tarefa(t, aviso)
            if ev:
                out[("tarefa", t.id)] = ev

    return out


# ══════════════════════════════════════════════════════════════════════
# A RECONCILIAÇÃO
# ══════════════════════════════════════════════════════════════════════
def _reconciliar(db, conta, token, cal_id) -> None:
    """
    Reencontra, pelo selo no evento, o que o banco local esqueceu.

    Roda antes de criar qualquer coisa. É barato (uma listagem) e evita o
    dano caro (duplicar a agenda inteira).
    """
    # SEM FILTRO, de propósito. A tentação é usar `privateExtendedProperty`
    # para pedir só os nossos — mas o Google faz AND entre múltiplos desses
    # parâmetros, então pedir "origem=dungeon" E "origem=rotina" na mesma
    # chamada não devolve nada. E o filtro nem é necessário: esta agenda foi
    # criada pelo app e só contém o que o app escreveu — é justamente o que
    # o escopo `calendar.app.created` garante.
    try:
        dados = motor._chamar(
            "GET",
            f"/calendars/{cal_id}/events?maxResults=2500&showDeleted=false",
            token)
    except motor.ErroCalendario:
        return   # sem reconciliação dá para seguir; sem sincronia, não

    conhecidos = {
        (e.origem, e.origem_id)
        for e in db.query(EventoCalendario).filter(
            EventoCalendario.conta_id == conta.id).all()
    }

    novos = 0
    for item in (dados.get("items") or []):
        priv = ((item.get("extendedProperties") or {}).get("private") or {})
        origem = priv.get("solo_origem")
        sid = priv.get("solo_id")
        if not origem or not sid:
            continue
        try:
            sid = int(sid)
        except (TypeError, ValueError):
            continue
        if (origem, sid) in conhecidos:
            continue
        db.add(EventoCalendario(
            conta_id=conta.id, origem=origem, origem_id=sid,
            evento_id=item["id"], revisao=priv.get("solo_rev"),
        ))
        novos += 1
    if novos:
        db.commit()
        print(f"[CALENDARIO] reconciliacao recuperou {novos} vinculo(s)")


# ══════════════════════════════════════════════════════════════════════
# A SINCRONIA
# ══════════════════════════════════════════════════════════════════════
def sincronizar(db, conta, reconciliar: bool = True) -> dict:
    """
    Põe a agenda em dia. Devolve o que foi feito, para a tela mostrar.

    OS ERROS SÃO CONTADOS, NÃO PROPAGADOS. Uma dungeon com dado estranho
    não pode impedir as outras vinte de sincronizar — mas o número aparece
    no resultado, porque falha que ninguém conta é falha que ninguém
    conserta.
    """
    if not getattr(conta, "ativo", False):
        raise motor.ErroCalendario("Esta agenda está desconectada.")

    token = motor.acesso_valido(db, conta)
    cal_id = motor.garantir_agenda(db, conta)

    if reconciliar:
        _reconciliar(db, conta, token, cal_id)

    desejado = _desejado(db, conta)
    atuais = {
        (e.origem, e.origem_id): e
        for e in db.query(EventoCalendario).filter(
            EventoCalendario.conta_id == conta.id).all()
    }

    conta_res = {"criados": 0, "atualizados": 0, "removidos": 0,
                 "iguais": 0, "erros": 0}

    # ── Criar e atualizar ────────────────────────────────────────────
    for chave, ev in desejado.items():
        rev = ev["extendedProperties"]["private"]["solo_rev"]
        elo = atuais.get(chave)
        try:
            if elo is None:
                novo = motor._chamar("POST", f"/calendars/{cal_id}/events",
                                     token, json=ev)
                db.add(EventoCalendario(
                    conta_id=conta.id, origem=chave[0], origem_id=chave[1],
                    evento_id=novo["id"], revisao=rev,
                    atualizado_em=datetime.utcnow()))
                conta_res["criados"] += 1
            elif elo.revisao != rev:
                motor._chamar("PUT",
                              f"/calendars/{cal_id}/events/{elo.evento_id}",
                              token, json=ev)
                elo.revisao = rev
                elo.atualizado_em = datetime.utcnow()
                conta_res["atualizados"] += 1
            else:
                # A MISSÃO NÃO MUDOU. Nada a fazer, e é o caminho mais
                # comum de longe — é ele que torna a sincronia barata.
                conta_res["iguais"] += 1
        except motor.ErroCalendario as e:
            print(f"[CALENDARIO] {chave} falhou: {e}")
            conta_res["erros"] += 1
            if elo is not None and "não existe" in str(e):
                # Evento apagado no Google: solta o elo para que a próxima
                # passada recrie em vez de bater na mesma porta fechada.
                db.delete(elo)

    # ── Remover o que não deve mais estar lá ─────────────────────────
    for chave, elo in atuais.items():
        if chave in desejado:
            continue
        try:
            motor._chamar("DELETE",
                          f"/calendars/{cal_id}/events/{elo.evento_id}", token)
        except motor.ErroCalendario:
            # Já não existia. O objetivo era que sumisse; sumiu.
            pass
        db.delete(elo)
        conta_res["removidos"] += 1

    conta.ultima_sync = datetime.utcnow()
    conta.ultimo_erro = (f"{conta_res['erros']} item(ns) falharam na última "
                         f"sincronia." if conta_res["erros"] else None)
    db.commit()
    return conta_res


# ══════════════════════════════════════════════════════════════════════
# O GATILHO
# ══════════════════════════════════════════════════════════════════════
def marcar_sujo(db, usuario_id: int) -> None:
    """
    "Algo mudou; a agenda precisa de uma passada."

    NÃO SINCRONIZA AQUI, e essa é a decisão. Chamar o Google dentro do
    `salvar` de uma rotina penduraria a latência de uma API externa no
    botão de salvar do hunter — e faria o salvamento FALHAR quando o
    Google estivesse fora do ar. Uma agenda desatualizada é um
    aborrecimento; não conseguir salvar a própria rotina é um app quebrado.

    Marcar é barato e não pode falhar; quem sincroniza é `/sincronizar` ou
    a varredura do fechamento.
    """
    try:
        c = db.query(ContaCalendario).filter(
            ContaCalendario.usuario_id == usuario_id,
            ContaCalendario.ativo == True).first()          # noqa: E712
        if c:
            c.ultima_sync = None      # None = pendente
            db.commit()
    except Exception as e:
        print(f"[CALENDARIO] marcar_sujo falhou (ignorado): {e}")


def sincronizar_todas(db, horas: int = 12, limite: int = 200) -> int:
    """
    A VARREDURA — todas as agendas conectadas, uma vez por dia.

    POR QUE VARRER TODAS EM VEZ DE SÓ AS MARCADAS

    Marcar cada alteração exigiria um gancho em cada ponto que cria, edita
    ou arquiva rotina, portão e missão — dezenas de lugares, e o gancho
    que alguém esquecer de pôr produz uma agenda que fica errada em
    silêncio. Uma varredura diária é ignorante e não esquece nada.

    E ela é barata pelo motivo de sempre: a sincronia compara `solo_rev` e,
    quando nada mudou, não escreve. Uma conta em dia custa uma listagem e
    zero escritas — não importa quantas missões o hunter tenha.

    `marcar_sujo` continua existindo para adiantar o relógio quando algo
    muda. É otimização; esta função é a garantia.
    """
    limite_tempo = datetime.utcnow() - timedelta(hours=horas)
    contas = db.query(ContaCalendario).filter(
        ContaCalendario.ativo == True,                       # noqa: E712
        or_(ContaCalendario.ultima_sync == None,             # noqa: E711
            ContaCalendario.ultima_sync < limite_tempo),
    ).limit(limite).all()

    feitas = 0
    for c in contas:
        try:
            sincronizar(db, c, reconciliar=False)
            feitas += 1
        except Exception as e:
            # UMA CONTA RUIM NÃO PARA A FILA. Token revogado de um hunter
            # não pode impedir a agenda dos outros de atualizar.
            print(f"[CALENDARIO] conta {c.id} falhou: {e}")
            try:
                c.ultimo_erro = str(e)
                c.ultima_sync = datetime.utcnow()   # tira da fila
                db.commit()
            except Exception:
                db.rollback()
    return feitas
