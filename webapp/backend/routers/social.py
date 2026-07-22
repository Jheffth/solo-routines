# -*- coding: utf-8 -*-
"""
Router Social — BuddyList (amizades) e Chat 1-a-1 (mensagens).

Três compromissos sustentam esta feature:

  1. RELAÇÃO ÚNICA POR PAR. Uma amizade é sempre gravada como par ordenado
     (usuario_a_id < usuario_b_id). (A→B) e (B→A) nunca viram duas linhas —
     antes de criar OU consultar qualquer relação, normalizamos com (min,max).

  2. CONVERSA É PRIVILÉGIO DE AMIGO. Só se troca mensagem com quem aceitou o
     pedido (status='aceita'). Falar com estranho → 403.

  3. NADA DE N+1. O contador de não-lidas sai de UMA query agregada
     (group by de_id), nunca de um laço consultando conversa por conversa.
     A BuddyList devolve só o cartão público do hunter — jamais e-mail,
     moedas ou o nível de acesso cru.
"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from sqlalchemy import or_, and_, func
from sqlalchemy.orm import Session

from database import get_db, Usuario, Amizade, Mensagem
from auth.router import get_usuario_atual
# Reaproveitamos a MESMA lógica de presença e de aura de cargo da vitrine, para
# que um hunter apareça igual na BuddyList e no perfil público.
from routers.hunters import _presenca, _aura_cargo

router = APIRouter(prefix="/social", tags=["social"])

CORPO_MAX  = 2000
LIMITE_MSG = 40      # mensagens por página de conversa
LIMITE_MAX = 100

DIGITANDO_JANELA_S = 6   # segundos que um heartbeat "digitando…" continua válido

# ── "Digitando…" — estado efêmero, EM MEMÓRIA ─────────────────────────────────
# Chave (de_id, para_id) → datetime.utcnow() do último heartbeat.
#
# POR QUE UM DICT NO MÓDULO E NÃO O BANCO?
#   "Digitando…" é um sinal volátil, de validade de 6 segundos, escrito a cada
#   ~2s enquanto alguém teclou. Persistir isso no banco seria escrita constante
#   por uma informação que expira em segundos e não precisa sobreviver a nada.
#   Este app roda em ESCALA PEQUENA e SINGLE-PROCESS (um worker), então um dict
#   no processo é a escolha certa: custo zero, sem I/O, sem migração.
#
#   LIMITE CONSCIENTE: só funciona com um único processo. Num futuro multi-worker
#   (vários uvicorn / gunicorn), cada worker teria o seu dict e o sinal se
#   perderia entre eles — nesse dia isto migra para Redis (com TTL nativo) ou uma
#   coluna "digitando_ate". NÃO implementamos Redis agora de propósito: seria
#   complexidade sem retorno para o tamanho atual.
_DIGITANDO: dict = {}


# ── Helpers ───────────────────────────────────────────────────────────────────
def _par(id1: int, id2: int):
    """Par ordenado da relação: sempre (menor, maior). Garante unicidade."""
    return (id1, id2) if id1 < id2 else (id2, id1)


def _buscar_amizade(db: Session, id1: int, id2: int) -> Optional[Amizade]:
    """A (única) relação entre dois hunters, indiferente de quem pediu."""
    a, b = _par(id1, id2)
    return (db.query(Amizade)
              .filter(Amizade.usuario_a_id == a, Amizade.usuario_b_id == b)
              .first())


def _por_login(db: Session, login: str, apenas_ativos: bool = True) -> Optional[Usuario]:
    """Resolve um hunter pelo nick. Conta inativa não é alvo de pedido/conversa."""
    login = (login or "").strip()
    if not login:
        return None
    q = db.query(Usuario).filter(Usuario.login.ilike(login))
    if apenas_ativos:
        q = q.filter(Usuario.ativo == True)
    return q.first()


def _cartao(u: Usuario) -> dict:
    """
    Cartão público de um hunter na BuddyList. Conjunto ENXUTO de propósito:
    nome, nick, avatar, classe, nível, faixa de presença e aura de cargo.
    Nunca e-mail, moedas nem o nivel_acesso cru.
    """
    return {
        "id":          u.id,
        "login":       u.login,
        "nome":        u.nome,
        "avatar_url":  u.avatar_url,
        "classe":      u.classe,
        "nivel_atual": u.nivel_atual,
        "presenca":    _presenca(u.ultimo_acesso),
        # minutos decorridos (não o carimbo) para o texto "visto há X" ficar
        # exato no frontend, como na vitrine pública.
        "visto_ha_min": (
            int((datetime.utcnow() - u.ultimo_acesso).total_seconds() // 60)
            if u.ultimo_acesso else None),
        "aura":        _aura_cargo(u.nivel_acesso),
    }


def _sou_amigo(db: Session, eu: Usuario, outro: Usuario) -> bool:
    rel = _buscar_amizade(db, eu.id, outro.id)
    return bool(rel and rel.status == "aceita")


def _limpar_digitando(agora: Optional[datetime] = None) -> None:
    """
    Descarta heartbeats vencidos (> janela). Chamado a cada consulta/registro,
    o que mantém o dict pequeno sem precisar de nenhuma tarefa de fundo: como o
    sinal só é lido/escrito quando alguém abre conversa ou digita, a limpeza
    oportunista basta para o dict não crescer para sempre.
    """
    agora = agora or datetime.utcnow()
    limite = agora - timedelta(seconds=DIGITANDO_JANELA_S)
    vencidos = [k for k, ts in _DIGITANDO.items() if ts < limite]
    for k in vencidos:
        _DIGITANDO.pop(k, None)


def _esta_digitando(de_id: int, para_id: int, agora: Optional[datetime] = None) -> bool:
    """True se `de_id` mandou heartbeat PARA `para_id` dentro da janela de 6s."""
    agora = agora or datetime.utcnow()
    ts = _DIGITANDO.get((de_id, para_id))
    return bool(ts and (agora - ts) <= timedelta(seconds=DIGITANDO_JANELA_S))


# ══════════════════════════════════════════════════════════════════════════════
# BUDDYLIST — a lista de amigos + pedidos + contador global de não-lidas
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/amigos")
def amigos(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    Tudo que a BuddyList precisa em três consultas — e só três, por mais
    amigos que o hunter tenha:

      1. as relações que o envolvem (aceitas + pendentes)
      2. os cartões dos hunters do outro lado, de uma vez (IN)
      3. o contador de não-lidas por remetente, agregado (group by de_id)
    """
    minhas = (db.query(Amizade)
                .filter(or_(Amizade.usuario_a_id == usuario.id,
                            Amizade.usuario_b_id == usuario.id),
                        Amizade.status.in_(("pendente", "aceita")))
                .all())

    # ids dos hunters do outro lado de cada relação
    outros_ids = set()
    for rel in minhas:
        outros_ids.add(rel.usuario_b_id if rel.usuario_a_id == usuario.id
                       else rel.usuario_a_id)

    outros = {}
    if outros_ids:
        outros = {u.id: u for u in db.query(Usuario)
                                     .filter(Usuario.id.in_(outros_ids)).all()}

    # Contador de não-lidas: UMA query agregada. Nunca um laço por conversa.
    nao_lidas_rows = (db.query(Mensagem.de_id, func.count(Mensagem.id))
                        .filter(Mensagem.para_id == usuario.id,
                                Mensagem.lida_em.is_(None))
                        .group_by(Mensagem.de_id).all())
    nao_lidas = {de_id: cnt for de_id, cnt in nao_lidas_rows}

    amigos_lst, pend_receb, pend_env = [], [], []
    for rel in minhas:
        outro_id = (rel.usuario_b_id if rel.usuario_a_id == usuario.id
                    else rel.usuario_a_id)
        outro = outros.get(outro_id)
        # Conta suspensa/apagada não aparece na BuddyList.
        if not outro or not outro.ativo:
            continue
        cartao = _cartao(outro)
        if rel.status == "aceita":
            cartao["nao_lidas"] = int(nao_lidas.get(outro_id, 0))
            amigos_lst.append(cartao)
        else:  # pendente
            cartao["amizade_id"] = rel.id
            if rel.solicitante_id == usuario.id:
                pend_env.append(cartao)
            else:
                pend_receb.append(cartao)

    # Ordenação: online primeiro, depois por nome.
    amigos_lst.sort(key=lambda c: (0 if c["presenca"] == "online" else 1,
                                   (c["nome"] or "").lower()))

    total_nao_lidas = int(sum(nao_lidas.values()))

    return {
        "amigos":               amigos_lst,
        "pendentes_recebidos":  pend_receb,
        "pendentes_enviados":   pend_env,
        "total_nao_lidas":      total_nao_lidas,
    }


# ══════════════════════════════════════════════════════════════════════════════
# PEDIR AMIZADE
# ══════════════════════════════════════════════════════════════════════════════
class PedirPayload(BaseModel):
    login: str

    @field_validator("login")
    @classmethod
    def _login(cls, v):
        v = (v or "").strip()
        if not v:
            raise ValueError("Informe o nick do hunter")
        return v


@router.post("/pedir")
def pedir(
    payload: PedirPayload,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    Envia um pedido de amizade. Regras:
      • para si mesmo → 400
      • inexistente / inativo → 404
      • já são amigos (aceita) → 400
      • já há pedido pendente → devolve o pendente sem criar outro
      • existia recusa antiga → o pedido é reaberto (reason abaixo)
    """
    alvo = _por_login(db, payload.login, apenas_ativos=True)
    if not alvo:
        raise HTTPException(404, "Nenhum hunter ativo com esse nick no Sistema")
    if alvo.id == usuario.id:
        raise HTTPException(400, "Você não pode enviar um pedido para si mesmo")

    rel = _buscar_amizade(db, usuario.id, alvo.id)
    if rel:
        if rel.status == "aceita":
            raise HTTPException(400, "Vocês já são amigos")
        if rel.status == "pendente":
            # Pedido já em aberto: devolve o existente, não empilha outro.
            return {"ok": True, "status": "pendente", "amizade_id": rel.id}
        # status == "recusada": reabrimos a relação como novo pedido, agora do
        # solicitante atual. (Decisão: sem política de cooldown definida no
        # contrato, reabrir é o comportamento menos frustrante — uma recusa
        # acidental não bloqueia a amizade para sempre.)
        rel.solicitante_id = usuario.id
        rel.status = "pendente"
        rel.criado_em = datetime.utcnow()
        rel.respondido_em = None
        db.commit()
        return {"ok": True, "status": "pendente", "amizade_id": rel.id}

    a, b = _par(usuario.id, alvo.id)
    nova = Amizade(
        usuario_a_id=a, usuario_b_id=b,
        solicitante_id=usuario.id, status="pendente",
        criado_em=datetime.utcnow(),
    )
    db.add(nova)
    db.commit()
    db.refresh(nova)
    return {"ok": True, "status": "pendente", "amizade_id": nova.id}


# ══════════════════════════════════════════════════════════════════════════════
# RESPONDER (aceitar / recusar) — só quem RECEBEU o pedido
# ══════════════════════════════════════════════════════════════════════════════
class ResponderPayload(BaseModel):
    amizade_id: int
    aceitar: bool


@router.post("/responder")
def responder(
    payload: ResponderPayload,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    rel = db.query(Amizade).filter(Amizade.id == payload.amizade_id).first()
    if not rel:
        raise HTTPException(404, "Pedido não encontrado")
    # Preciso fazer parte da relação.
    if usuario.id not in (rel.usuario_a_id, rel.usuario_b_id):
        raise HTTPException(404, "Pedido não encontrado")
    # Só o LADO QUE RECEBEU responde — o solicitante não aceita o próprio pedido.
    if rel.solicitante_id == usuario.id:
        raise HTTPException(403, "Você não pode responder ao próprio pedido")
    if rel.status != "pendente":
        raise HTTPException(400, "Este pedido já foi respondido")

    rel.status = "aceita" if payload.aceitar else "recusada"
    rel.respondido_em = datetime.utcnow()
    db.commit()
    return {"ok": True, "status": rel.status}


# ══════════════════════════════════════════════════════════════════════════════
# REMOVER — desfaz amizade OU cancela um pedido enviado
# ══════════════════════════════════════════════════════════════════════════════
@router.delete("/amigo/{login}")
def remover(
    login: str,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    # Permitimos remover mesmo hunter inativo — para limpar amizade com conta
    # que foi suspensa depois.
    alvo = _por_login(db, login, apenas_ativos=False)
    if not alvo:
        raise HTTPException(404, "Nenhum hunter com esse nick no Sistema")

    rel = _buscar_amizade(db, usuario.id, alvo.id)
    if not rel:
        raise HTTPException(404, "Vocês não têm nenhuma relação a desfazer")

    db.delete(rel)
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# CONVERSA — histórico paginado + marcar como lidas as recebidas
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/conversa/{login}")
def conversa(
    login: str,
    antes_de: Optional[str] = Query(None, description="ISO: carrega mensagens anteriores a este instante"),
    limite: int = Query(LIMITE_MSG, ge=1, le=LIMITE_MAX),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    Abre a conversa com um amigo. Só amigo aceito conversa → 403 caso contrário.
    Abrir a conversa MARCA como lidas todas as mensagens recebidas desse hunter.
    Devolve a página em ordem cronológica (mais antiga primeiro).
    """
    alvo = _por_login(db, login, apenas_ativos=True)
    if not alvo:
        raise HTTPException(404, "Nenhum hunter ativo com esse nick no Sistema")
    if not _sou_amigo(db, usuario, alvo):
        raise HTTPException(403, "Vocês precisam ser amigos para conversar")

    limite = max(1, min(int(limite or LIMITE_MSG), LIMITE_MAX))

    # Todas as mensagens entre nós dois, nos dois sentidos.
    entre_nos = or_(
        and_(Mensagem.de_id == usuario.id, Mensagem.para_id == alvo.id),
        and_(Mensagem.de_id == alvo.id,   Mensagem.para_id == usuario.id),
    )
    q = db.query(Mensagem).filter(entre_nos)

    if antes_de:
        try:
            marco = datetime.fromisoformat(antes_de.replace("Z", "+00:00"))
            if marco.tzinfo is not None:
                marco = marco.replace(tzinfo=None)
            q = q.filter(Mensagem.criado_em < marco)
        except (ValueError, TypeError):
            pass  # marco inválido: ignora o filtro, devolve a página mais recente

    # Buscamos a página mais recente (desc) + 1 para saber se "há mais",
    # e devolvemos em ordem cronológica.
    linhas = (q.order_by(Mensagem.criado_em.desc(), Mensagem.id.desc())
                .limit(limite + 1).all())
    ha_mais = len(linhas) > limite
    linhas = linhas[:limite]
    linhas.reverse()

    # Marca como lidas TODAS as recebidas desse hunter (não só as da página).
    db.query(Mensagem).filter(
        Mensagem.de_id == alvo.id,
        Mensagem.para_id == usuario.id,
        Mensagem.lida_em.is_(None),
    ).update({Mensagem.lida_em: datetime.utcnow()}, synchronize_session=False)
    db.commit()

    mensagens = []
    for m in linhas:
        de_mim = m.de_id == usuario.id
        mensagens.append({
            "id":     m.id,
            "de_mim": de_mim,
            "corpo":  m.corpo,
            "quando": m.criado_em.isoformat() if m.criado_em else None,
            # As minhas: lida = o outro já leu? As recebidas: acabamos de marcar.
            "lida":   (m.lida_em is not None) if de_mim else True,
        })

    return {
        "com": {
            "id":         alvo.id,
            "login":      alvo.login,
            "nome":       alvo.nome,
            "avatar_url": alvo.avatar_url,
            "presenca":   _presenca(alvo.ultimo_acesso),
            # minutos decorridos: o cabeçalho do chat mostra "visto há X"
            # exato, igual à BuddyList e à vitrine.
            "visto_ha_min": (
                int((datetime.utcnow() - alvo.ultimo_acesso).total_seconds() // 60)
                if alvo.ultimo_acesso else None),
            "aura":       _aura_cargo(alvo.nivel_acesso),
            # "digitando…": true se o interlocutor (alvo) mandou heartbeat PARA
            # MIM — chave (alvo_id, meu_id) — nos últimos 6s. Estado em memória.
            "digitando":  _esta_digitando(alvo.id, usuario.id),
        },
        "mensagens": mensagens,
        "ha_mais":   ha_mais,
    }


# ══════════════════════════════════════════════════════════════════════════════
# ENVIAR — só entre amigos
# ══════════════════════════════════════════════════════════════════════════════
class EnviarPayload(BaseModel):
    login: str
    corpo: str

    @field_validator("login")
    @classmethod
    def _login(cls, v):
        v = (v or "").strip()
        if not v:
            raise ValueError("Informe o destinatário")
        return v

    @field_validator("corpo")
    @classmethod
    def _corpo(cls, v):
        v = (v or "").strip()
        if not v:
            raise ValueError("A mensagem não pode ser vazia")
        if len(v) > CORPO_MAX:
            raise ValueError(f"A mensagem excede o limite de {CORPO_MAX} caracteres")
        return v


@router.post("/enviar")
def enviar(
    payload: EnviarPayload,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    alvo = _por_login(db, payload.login, apenas_ativos=True)
    if not alvo:
        raise HTTPException(404, "Nenhum hunter ativo com esse nick no Sistema")
    if not _sou_amigo(db, usuario, alvo):
        raise HTTPException(403, "Vocês precisam ser amigos para trocar mensagens")

    msg = Mensagem(
        de_id=usuario.id, para_id=alvo.id,
        corpo=payload.corpo, criado_em=datetime.utcnow(),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    return {"ok": True, "mensagem": {
        "id":     msg.id,
        "de_mim": True,
        "corpo":  msg.corpo,
        "quando": msg.criado_em.isoformat() if msg.criado_em else None,
        "lida":   False,
    }}


# ══════════════════════════════════════════════════════════════════════════════
# NOVIDADES — polling leve (chamado a cada ~5s)
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/novidades")
def novidades(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    Contadores para o polling: não-lidas por hunter (login→count),
    total geral e quantos pedidos de amizade estão esperando resposta.
    Duas queries agregadas + uma para resolver os nicks — nada de laço.
    """
    linhas = (db.query(Mensagem.de_id, func.count(Mensagem.id))
                .filter(Mensagem.para_id == usuario.id,
                        Mensagem.lida_em.is_(None))
                .group_by(Mensagem.de_id).all())
    por_id = {de_id: int(cnt) for de_id, cnt in linhas}

    por_hunter = {}
    if por_id:
        for u in db.query(Usuario.id, Usuario.login).filter(Usuario.id.in_(por_id.keys())).all():
            por_hunter[u.login] = por_id[u.id]

    total_nao_lidas = int(sum(por_id.values()))

    pedidos_recebidos = (db.query(func.count(Amizade.id))
                           .filter(Amizade.status == "pendente",
                                   or_(Amizade.usuario_a_id == usuario.id,
                                       Amizade.usuario_b_id == usuario.id),
                                   Amizade.solicitante_id != usuario.id)
                           .scalar()) or 0

    return {
        "total_nao_lidas":   total_nao_lidas,
        "por_hunter":        por_hunter,
        "pedidos_recebidos": int(pedidos_recebidos),
    }


# ══════════════════════════════════════════════════════════════════════════════
# DIGITANDO — heartbeat "estou digitando para <login>" (estado EM MEMÓRIA)
# ══════════════════════════════════════════════════════════════════════════════
class DigitandoPayload(BaseModel):
    login: str

    @field_validator("login")
    @classmethod
    def _login(cls, v):
        v = (v or "").strip()
        if not v:
            raise ValueError("Informe o destinatário")
        return v


@router.post("/digitando")
def digitando(
    payload: DigitandoPayload,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    Heartbeat "estou digitando para <login>". NÃO toca o banco: só registra o
    carimbo (de_id, para_id) → agora no dict em memória `_DIGITANDO`.

    Só registra entre AMIGOS ACEITOS. Se o alvo não existe ou não é amigo,
    IGNORA SILENCIOSAMENTE e ainda assim devolve {ok:true} — digitar não é uma
    operação que "falha": nada sensível vaza, e o frontend não precisa tratar
    erro num sinal tão trivial.
    """
    agora = datetime.utcnow()
    _limpar_digitando(agora)   # limpeza oportunista: mantém o dict enxuto

    alvo = _por_login(db, payload.login, apenas_ativos=True)
    if alvo and alvo.id != usuario.id and _sou_amigo(db, usuario, alvo):
        _DIGITANDO[(usuario.id, alvo.id)] = agora
    # Não-amigo / inexistente: ignora sem erro (contrato: retorna ok mesmo assim).
    return {"ok": True}
