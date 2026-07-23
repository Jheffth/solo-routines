# -*- coding: utf-8 -*-
"""
Router de Emblemas — colecionáveis presenteáveis + cerimônia pendente.

Dois princípios:
  1. Emblema colecionável NUNCA é conquistado por missão. É dado por alguém.
     (o inverso também vale: conquista de missão jamais pode ser presenteada)
  2. Toda badge concedida fora da sessão do hunter fica PENDENTE de cerimônia
     e é celebrada quando ele entra — nunca aparece calada no perfil.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, Usuario, Conquista, ConquistaUsuario
from auth.router import get_usuario_atual
from motors.gamificacao import recalcular_nivel

router = APIRouter(prefix="/emblemas", tags=["emblemas"])


# ── Permissões ────────────────────────────────────────────────────────────────
def eh_arquiteto(u: Usuario) -> bool:
    return u.nivel_acesso == "Arquiteto"


def eh_admin(u: Usuario) -> bool:
    return u.nivel_acesso in ("Admin", "Criador", "Arquiteto")


def eh_gestor(u: Usuario) -> bool:
    """Admin e acima — painel completo de gestão."""
    return u.nivel_acesso in ("Admin", "Criador", "Arquiteto")


def eh_moderador(u: Usuario) -> bool:
    return u.nivel_acesso in ("Moderador", "Admin", "Criador", "Arquiteto")


def eh_suporte(u: Usuario) -> bool:
    return u.nivel_acesso in ("Suporte", "Moderador", "Admin", "Criador", "Arquiteto")


def _exige_arquiteto(u: Usuario):
    if not eh_arquiteto(u):
        raise HTTPException(403, "Somente o Arquiteto pode fazer isso")


def _presenteavel(q: Conquista) -> bool:
    """Colecionável = manual (não é conquistada por missão)."""
    return (q.condicao_tipo or "").lower() == "manual"


# ══════════════════════════════════════════════════════════════════════════════
# CERIMÔNIA PENDENTE — o hunter é celebrado ao entrar
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/pendentes")
def pendentes(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    Badges recebidas enquanto o hunter estava fora (registro, presente).
    O frontend chama no login e dispara a Cerimônia para cada uma.
    """
    itens = (db.query(ConquistaUsuario)
               .filter(ConquistaUsuario.usuario_id == usuario.id,
                       ConquistaUsuario.celebrada == False)
               .order_by(ConquistaUsuario.desbloqueada_em.asc()).all())
    saida = []
    for cu in itens:
        q = db.query(Conquista).filter(Conquista.id == cu.conquista_id).first()
        if not q:
            continue
        remetente = None
        if cu.presenteada_por:
            r = db.query(Usuario).filter(Usuario.id == cu.presenteada_por).first()
            remetente = r.nome if r else None
        saida.append({
            "id": q.id, "codigo": q.codigo, "titulo": q.titulo,
            "descricao": q.descricao, "icone": q.icone,
            "xp_bonus": q.xp_bonus, "moedas_bonus": q.moedas_bonus,
            "presenteada_por": remetente, "mensagem": cu.mensagem,
        })
    return {"novas_conquistas": saida}   # formato que o interceptador já entende


@router.post("/celebradas")
def marcar_celebradas(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Chamado após a cerimônia terminar — evita repetir na próxima entrada."""
    n = (db.query(ConquistaUsuario)
           .filter(ConquistaUsuario.usuario_id == usuario.id,
                   ConquistaUsuario.celebrada == False)
           .update({"celebrada": True}, synchronize_session=False))
    db.commit()
    return {"ok": True, "celebradas": n}


# ══════════════════════════════════════════════════════════════════════════════
# ENVIO DE EMBLEMAS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/colecionaveis")
def colecionaveis(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Emblemas que podem ser presenteados (nunca os de missão)."""
    _exige_arquiteto(usuario)
    qs = db.query(Conquista).filter(Conquista.ativo == True).all()
    return [{
        "id": q.id, "codigo": q.codigo, "titulo": q.titulo, "descricao": q.descricao,
        "icone": q.icone, "cor": q.cor, "xp_bonus": q.xp_bonus, "moedas_bonus": q.moedas_bonus,
        "exclusiva_arquiteto": bool(getattr(q, "exclusiva_arquiteto", False)),
    } for q in qs if _presenteavel(q)
       and not getattr(q, "exclusiva_arquiteto", False)]


class PresentePayload(BaseModel):
    usuario_ids: List[int]
    codigo: str
    mensagem: Optional[str] = None


@router.post("/presentear")
def presentear(
    payload: PresentePayload,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    Envia um emblema colecionável a um ou mais hunters.
    A badge entra PENDENTE: eles serão celebrados ao entrar no Sistema.
    """
    _exige_arquiteto(usuario)

    q = db.query(Conquista).filter(Conquista.codigo == payload.codigo).first()
    if not q:
        raise HTTPException(404, "Emblema não encontrado")
    if not _presenteavel(q):
        raise HTTPException(400,
            "Este emblema é conquistado por missão — não pode ser presenteado")
    if getattr(q, "exclusiva_arquiteto", False):
        raise HTTPException(400, "Emblema exclusivo do Arquiteto não é presenteável")

    enviados, ignorados = [], []
    for uid in payload.usuario_ids:
        alvo = db.query(Usuario).filter(Usuario.id == uid, Usuario.ativo == True).first()
        if not alvo:
            ignorados.append({"id": uid, "motivo": "hunter não encontrado"})
            continue
        ja = db.query(ConquistaUsuario).filter(
            ConquistaUsuario.usuario_id == uid,
            ConquistaUsuario.conquista_id == q.id).first()
        if ja:
            ignorados.append({"id": uid, "nome": alvo.nome, "motivo": "já possui"})
            continue

        cu = ConquistaUsuario(usuario_id=uid, conquista_id=q.id,
                              desbloqueada_em=datetime.utcnow())
        try:
            cu.celebrada = False                 # aguarda a cerimônia
            cu.presenteada_por = usuario.id
            cu.mensagem = (payload.mensagem or None)
        except Exception:
            pass
        db.add(cu)

        alvo.xp_total = (alvo.xp_total or 0) + (q.xp_bonus or 0)
        alvo.xp_atual = (alvo.xp_atual or 0) + (q.xp_bonus or 0)
        alvo.moedas   = (alvo.moedas or 0) + (q.moedas_bonus or 0)
        recalcular_nivel(db, alvo)
        enviados.append({"id": alvo.id, "nome": alvo.nome})

    db.commit()
    return {"ok": True, "emblema": q.titulo, "enviados": enviados, "ignorados": ignorados}


@router.delete("/recolher")
def recolher(
    usuario_id: int,
    codigo: str,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Retira um emblema presenteado (estorna o bônus)."""
    _exige_arquiteto(usuario)
    q = db.query(Conquista).filter(Conquista.codigo == codigo).first()
    if not q:
        raise HTTPException(404, "Emblema não encontrado")
    if not _presenteavel(q):
        raise HTTPException(400, "Só emblemas presenteáveis podem ser recolhidos")

    cu = db.query(ConquistaUsuario).filter(
        ConquistaUsuario.usuario_id == usuario_id,
        ConquistaUsuario.conquista_id == q.id).first()
    if not cu:
        raise HTTPException(404, "Este hunter não possui o emblema")

    alvo = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if alvo:
        alvo.xp_total = max(0, (alvo.xp_total or 0) - (q.xp_bonus or 0))
        alvo.moedas   = max(0, (alvo.moedas or 0) - (q.moedas_bonus or 0))
        recalcular_nivel(db, alvo)
    db.delete(cu)
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# REGISTRO DE HUNTERS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/hunters")
def hunters(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Todos os hunters cadastrados — quem entrou, quando e com o quê."""
    if not eh_admin(usuario):
        raise HTTPException(403, "Acesso restrito a administradores")

    from database import Convite
    arq = eh_arquiteto(usuario)
    usuarios = db.query(Usuario).order_by(Usuario.criado_em.desc()).all()

    # ── Carga em lote — NÃO voltar a consultar dentro do laço ──────────────
    # Esta rota já custou 10.006 consultas para 2.000 hunters (um N+1: uma
    # busca de posses por usuário, mais uma de conquista por posse, mais uma
    # de convite). Agora são três consultas no total, independentemente de
    # quantos hunters existam. Ao mexer aqui, mantenha tudo fora do laço.
    posses = (db.query(ConquistaUsuario, Conquista)
                .join(Conquista, Conquista.id == ConquistaUsuario.conquista_id)
                .all())
    badges_por_usuario = {}
    for cu, q in posses:
        badges_por_usuario.setdefault(cu.usuario_id, []).append({
            "codigo": q.codigo, "titulo": q.titulo, "icone": q.icone,
            "pendente": not bool(getattr(cu, "celebrada", True)),
            # conquistada por esforço próprio → não se revoga
            "de_missao": (q.condicao_tipo or "").lower() != "manual",
            "xp_bonus": q.xp_bonus or 0,
        })

    convite_por_usuario = {
        cv.usado_por_id: cv.codigo
        for cv in db.query(Convite).filter(Convite.usado_por_id.isnot(None)).all()
    }

    saida = []
    for u in usuarios:
        badges = badges_por_usuario.get(u.id, [])
        convite = convite_por_usuario.get(u.id)
        item = {
            "id": u.id, "nome": u.nome, "login": u.login,
            "nivel_acesso": u.nivel_acesso, "ativo": u.ativo,
            "classe": u.classe, "titulo": u.titulo,
            "nivel_atual": u.nivel_atual, "xp_total": u.xp_total, "moedas": u.moedas,
            "streak_atual": u.streak_atual,
            "avatar_url": u.avatar_url,
            "criado_em": u.criado_em.isoformat() if u.criado_em else None,
            "ultimo_acesso": u.ultimo_acesso.isoformat() if u.ultimo_acesso else None,
            "badges": badges,
            "convite": convite,
        }
        # Dados sensíveis só para o Arquiteto
        if arq:
            item["email"] = u.email
            item["inviolavel"] = bool(u.inviolavel)
        saida.append(item)

    return {
        "hunters": saida,
        "resumo": {
            "total": len(saida),
            "ativos": sum(1 for h in saida if h["ativo"]),
            "admins": sum(1 for h in saida if h["nivel_acesso"] in ("Admin", "Criador")),
            "novos_7d": sum(1 for h in saida if h["criado_em"] and
                            (datetime.utcnow() - datetime.fromisoformat(h["criado_em"])).days <= 7),
        },
    }


@router.get("/permissoes")
def permissoes(usuario: Usuario = Depends(get_usuario_atual)):
    """
    Mapa de privilégios do usuário logado — o frontend usa para montar
    o Painel Admin mostrando só o que ele pode fazer.

    Hierarquia: Arquiteto > Criador > Admin > Moderador > Suporte > User
    """
    arq  = eh_arquiteto(usuario)
    adm  = eh_admin(usuario)          # Admin, Criador, Arquiteto
    gest = adm                         # mesmo nível por ora
    mod  = eh_moderador(usuario)       # Moderador e acima
    sup  = eh_suporte(usuario)         # Suporte e acima
    return {
        "nivel_acesso": usuario.nivel_acesso,
        "eh_arquiteto": arq,
        "eh_admin":     adm,
        "pode": {
            # ── Qualquer nível acima de Hunter ──
            "ver_painel":          sup,
            "ver_hunters":         sup,
            "ver_logs":            sup,

            # ── Moderador e acima ──
            "moderar_chat":        mod,
            "moderar_amizades":    mod,

            # ── Admin e acima ──
            "editar_hunter":       adm,
            "ajustar_xp":          adm,
            "excluir_hunter":      adm,
            "enviar_emblemas":     adm,
            "configurar_sistema":  adm,

            # ── Criador e acima ──
            "criar_emblemas":      gest,
            "criar_dungeons_globais": gest,

            # ── Só Arquiteto ──
            "ver_email_hunters":   arq,
            "gerar_convites":      arq,
            "definir_admin":       arq,
            "resetar_progresso":   arq,
        },
    }
