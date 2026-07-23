# -*- coding: utf-8 -*-
"""
Router do Arquiteto — a Sala de Poderes.

Aqui moram as ações que DESFAZEM estado: revogar cargo, recolher badge,
suspender acesso, retirar XP. São poderes de dono do Sistema, e por isso
seguem quatro princípios:

  1. SÓ O ARQUITETO. Administrador comum não entra nem para olhar.

  2. O INVIOLÁVEL É INVIOLÁVEL. Nenhum poder atinge quem tem `inviolavel`
     nem outro Arquiteto — inclusive o próprio autor. Um Sistema onde o dono
     pode se auto-destituir por engano é um Sistema que se perde sozinho.

  3. TUDO FICA ESCRITO. Todo poder exercido vira uma linha no Livro de
     Decretos, com autor, alvo, o que mudou e o estado anterior — para que
     qualquer decisão possa ser revista ou revertida à mão depois.

  4. O CATÁLOGO É A FONTE. `/arquiteto/poderes` descreve cada poder; o
     frontend desenha a partir dessa lista. Poder novo aparece na tela
     sozinho, sem mexer no HTML — que é como este painel vai crescer.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from database import (get_db, Usuario, Conquista, ConquistaUsuario,
                      Convite, RegistroPoder)
from auth.router import get_usuario_atual
from motors.gamificacao import recalcular_nivel

router = APIRouter(prefix="/arquiteto", tags=["arquiteto"])

NIVEIS = ["User", "Suporte", "Moderador", "Admin", "Criador"]  # "Arquiteto" nunca é concedido por aqui



# ══════════════════════════════════════════════════════════════════════════════
# CATÁLOGO DE PODERES — a lista que o painel desenha
# ══════════════════════════════════════════════════════════════════════════════
# Para acrescentar um poder novo no futuro: some uma entrada aqui e crie a rota.
# O painel passa a exibi-lo automaticamente, com ícone, cor e confirmação.
PODERES = [
    {
        "id": "revogar_badge", "nome": "Recolher Emblema", "icone": "🎖",
        "descricao": "Retira uma badge do hunter. O bônus de XP também é desfeito.",
        "grupo": "emblemas", "destrutivo": True, "alvo": "badge",
    },
    {
        "id": "revogar_cargo", "nome": "Revogar Administrador", "icone": "⚙️",
        "descricao": "Rebaixa o hunter para conta simples. Perde o Painel do Sistema.",
        "grupo": "cargo", "destrutivo": True, "alvo": "hunter",
    },
    {
        "id": "conceder_cargo", "nome": "Conceder Cargo", "icone": "🔑",
        "descricao": "Promove o hunter a Administrador ou Criador.",
        "grupo": "cargo", "destrutivo": False, "alvo": "hunter",
    },
    {
        "id": "revogar_acesso", "nome": "Suspender Acesso", "icone": "🚫",
        "descricao": "A conta deixa de entrar no Sistema. Nada é apagado.",
        "grupo": "acesso", "destrutivo": True, "alvo": "hunter",
    },
    {
        "id": "restaurar_acesso", "nome": "Restaurar Acesso", "icone": "🔓",
        "descricao": "Devolve a entrada ao hunter suspenso.",
        "grupo": "acesso", "destrutivo": False, "alvo": "hunter",
    },
    {
        "id": "revogar_xp", "nome": "Retirar XP", "icone": "📉",
        "descricao": "Remove XP e recalcula nível, rank e título pelo motor.",
        "grupo": "progresso", "destrutivo": True, "alvo": "valor",
    },
    {
        "id": "revogar_convite", "nome": "Anular Convite", "icone": "📜",
        "descricao": "Invalida um convite ainda não usado.",
        "grupo": "acesso", "destrutivo": True, "alvo": "convite",
    },
]


# ── Guardas ───────────────────────────────────────────────────────────────────
def _exige_arquiteto(u: Usuario):
    if u.nivel_acesso != "Arquiteto":
        raise HTTPException(403, "Somente o Arquiteto entra na Sala de Poderes")


def _alvo(db: Session, usuario_id: int, autor: Usuario) -> Usuario:
    """
    Resolve o alvo e aplica a trava mais importante do arquivo: ninguém
    exerce poder sobre um inviolável, sobre outro Arquiteto, nem sobre si.
    """
    alvo = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not alvo:
        raise HTTPException(404, "Hunter não encontrado")
    if alvo.id == autor.id:
        raise HTTPException(400, "O Arquiteto não exerce poder sobre si mesmo")
    if getattr(alvo, "inviolavel", False) or alvo.nivel_acesso == "Arquiteto":
        raise HTTPException(400, f"{alvo.nome} é inviolável — nenhum poder o atinge")
    return alvo


def _decretar(db: Session, autor: Usuario, poder: str, alvo: Optional[Usuario],
              detalhe: str, antes: str = None, motivo: str = None):
    """Escreve no Livro de Decretos. Nunca deixa de registrar."""
    db.add(RegistroPoder(
        poder          = poder,
        arquiteto_id   = autor.id,
        arquiteto_nome = autor.nome,
        alvo_id        = alvo.id if alvo else None,
        alvo_nome      = alvo.nome if alvo else None,
        detalhe        = (detalhe or "")[:300],
        antes          = (antes or "")[:200] or None,
        motivo         = (motivo or "")[:300] or None,
    ))


# ══════════════════════════════════════════════════════════════════════════════
# CATÁLOGO E DOSSIÊ
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/poderes")
def poderes(usuario: Usuario = Depends(get_usuario_atual)):
    _exige_arquiteto(usuario)
    return {"poderes": PODERES, "niveis": NIVEIS}


@router.get("/hunter/{usuario_id}")
def dossie(
    usuario_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Tudo que o Arquiteto precisa ver antes de decidir."""
    _exige_arquiteto(usuario)
    h = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not h:
        raise HTTPException(404, "Hunter não encontrado")

    badges = []
    for cu, q in (db.query(ConquistaUsuario, Conquista)
                    .join(Conquista, Conquista.id == ConquistaUsuario.conquista_id)
                    .filter(ConquistaUsuario.usuario_id == h.id)
                    .order_by(ConquistaUsuario.desbloqueada_em.desc()).all()):
        de = None
        if cu.presenteada_por:
            r = db.query(Usuario).filter(Usuario.id == cu.presenteada_por).first()
            de = r.nome if r else None
        badges.append({
            "codigo": q.codigo, "titulo": q.titulo, "icone": q.icone, "cor": q.cor,
            "xp_bonus": q.xp_bonus or 0, "moedas_bonus": q.moedas_bonus or 0,
            "de_missao": (q.condicao_tipo or "").lower() != "manual",
            "celebrada": bool(cu.celebrada), "veio_de": de,
            "recebida_em": cu.desbloqueada_em.isoformat() if cu.desbloqueada_em else None,
        })

    convites = [{
        "id": cv.id, "codigo": cv.codigo, "nota": cv.nota,
        "nivel_acesso": cv.nivel_acesso, "usado": cv.usado_por_id is not None,
        "revogado": bool(cv.revogado),
    } for cv in db.query(Convite).filter(Convite.criado_por_id == h.id).all()]

    decretos = (db.query(RegistroPoder)
                  .filter(RegistroPoder.alvo_id == h.id)
                  .order_by(RegistroPoder.criado_em.desc()).limit(20).all())

    return {
        "hunter": {
            "id": h.id, "nome": h.nome, "login": h.login, "email": h.email,
            "avatar_url": h.avatar_url, "nivel_acesso": h.nivel_acesso,
            "ativo": bool(h.ativo), "inviolavel": bool(getattr(h, "inviolavel", False)),
            "classe": h.classe, "titulo": h.titulo,
            "nivel_atual": h.nivel_atual, "xp_total": h.xp_total,
            "moedas": h.moedas, "streak_atual": h.streak_atual,
            "criado_em": h.criado_em.isoformat() if h.criado_em else None,
            "ultimo_acesso": h.ultimo_acesso.isoformat() if h.ultimo_acesso else None,
        },
        "badges": badges,
        "convites": convites,
        "protegido": bool(getattr(h, "inviolavel", False)) or h.nivel_acesso == "Arquiteto",
        "decretos": [{
            "poder": d.poder, "detalhe": d.detalhe,
            "quando": d.criado_em.isoformat() if d.criado_em else None,
        } for d in decretos],
    }


# ══════════════════════════════════════════════════════════════════════════════
# OS PODERES
# ══════════════════════════════════════════════════════════════════════════════
class AlvoBase(BaseModel):
    usuario_id: int
    motivo: Optional[str] = None


class BadgePayload(AlvoBase):
    codigo: str


@router.post("/revogar/badge")
def revogar_badge(
    payload: BadgePayload,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    Recolhe a badge E desfaz o bônus que ela concedeu — senão o hunter
    ficaria com XP de uma conquista que não tem mais.
    """
    _exige_arquiteto(usuario)
    alvo = _alvo(db, payload.usuario_id, usuario)

    q = db.query(Conquista).filter(Conquista.codigo == payload.codigo).first()
    if not q:
        raise HTTPException(404, "Emblema não encontrado")

    # Conquista de missão é prova de esforço do hunter. O Arquiteto entrega e
    # recolhe o que ele mesmo deu; o que o hunter suou para ganhar, não.
    if (q.condicao_tipo or "").lower() != "manual":
        raise HTTPException(
            400, "Este emblema foi conquistado pelo próprio hunter — não se revoga")

    posse = (db.query(ConquistaUsuario)
               .filter(ConquistaUsuario.usuario_id == alvo.id,
                       ConquistaUsuario.conquista_id == q.id).first())
    if not posse:
        raise HTTPException(400, f"{alvo.nome} não possui este emblema")

    xp_antes = alvo.xp_total or 0
    db.delete(posse)

    # Desfaz o bônus pelo motor — nível, rank e título voltam ao lugar certo.
    alvo.xp_total = max(0, xp_antes - (q.xp_bonus or 0))
    alvo.moedas   = max(0, (alvo.moedas or 0) - (q.moedas_bonus or 0))
    recalcular_nivel(db, alvo)

    _decretar(db, usuario, "revogar_badge", alvo,
              f"Emblema '{q.titulo}' recolhido (−{q.xp_bonus or 0} XP)",
              antes=f"xp_total={xp_antes}", motivo=payload.motivo)
    db.commit()
    return {"ok": True, "detalhe": f"{q.titulo} recolhido de {alvo.nome}",
            "xp_total": alvo.xp_total, "nivel_atual": alvo.nivel_atual}


@router.post("/revogar/cargo")
def revogar_cargo(
    payload: AlvoBase,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    _exige_arquiteto(usuario)
    alvo = _alvo(db, payload.usuario_id, usuario)
    if alvo.nivel_acesso == "User":
        raise HTTPException(400, f"{alvo.nome} já é conta simples")

    antes = alvo.nivel_acesso
    alvo.nivel_acesso = "User"
    _decretar(db, usuario, "revogar_cargo", alvo,
              f"Cargo {antes} revogado — agora é conta simples",
              antes=f"nivel_acesso={antes}", motivo=payload.motivo)
    db.commit()
    return {"ok": True, "detalhe": f"{alvo.nome} não é mais {antes}",
            "nivel_acesso": alvo.nivel_acesso}


class CargoPayload(AlvoBase):
    nivel_acesso: str

    @field_validator("nivel_acesso")
    @classmethod
    def _nivel(cls, v):
        v = (v or "").strip().capitalize()
        if v not in NIVEIS:
            raise ValueError(f"Cargo inválido — use um de: {', '.join(NIVEIS)}")
        return v


@router.post("/conceder/cargo")
def conceder_cargo(
    payload: CargoPayload,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    _exige_arquiteto(usuario)
    alvo = _alvo(db, payload.usuario_id, usuario)
    antes = alvo.nivel_acesso
    if antes == payload.nivel_acesso:
        raise HTTPException(400, f"{alvo.nome} já é {antes}")

    alvo.nivel_acesso = payload.nivel_acesso
    _decretar(db, usuario, "conceder_cargo", alvo,
              f"Cargo alterado de {antes} para {payload.nivel_acesso}",
              antes=f"nivel_acesso={antes}", motivo=payload.motivo)
    db.commit()
    return {"ok": True, "detalhe": f"{alvo.nome} agora é {payload.nivel_acesso}",
            "nivel_acesso": alvo.nivel_acesso}


@router.post("/revogar/acesso")
def revogar_acesso(
    payload: AlvoBase,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Suspende sem apagar: o progresso do hunter continua intacto."""
    _exige_arquiteto(usuario)
    alvo = _alvo(db, payload.usuario_id, usuario)
    if not alvo.ativo:
        raise HTTPException(400, f"{alvo.nome} já está suspenso")

    alvo.ativo = False
    _decretar(db, usuario, "revogar_acesso", alvo,
              "Acesso suspenso — a conta não entra mais no Sistema",
              antes="ativo=True", motivo=payload.motivo)
    db.commit()
    return {"ok": True, "detalhe": f"Acesso de {alvo.nome} suspenso", "ativo": False}


@router.post("/restaurar/acesso")
def restaurar_acesso(
    payload: AlvoBase,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    _exige_arquiteto(usuario)
    alvo = _alvo(db, payload.usuario_id, usuario)
    if alvo.ativo:
        raise HTTPException(400, f"{alvo.nome} já tem acesso")

    alvo.ativo = True
    _decretar(db, usuario, "restaurar_acesso", alvo,
              "Acesso restaurado", antes="ativo=False", motivo=payload.motivo)
    db.commit()
    return {"ok": True, "detalhe": f"Acesso de {alvo.nome} restaurado", "ativo": True}


class XpPayload(AlvoBase):
    quantidade: int

    @field_validator("quantidade")
    @classmethod
    def _qtd(cls, v):
        if v <= 0:
            raise ValueError("Informe uma quantidade positiva de XP a retirar")
        return v


@router.post("/revogar/xp")
def revogar_xp(
    payload: XpPayload,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    Retira XP e recalcula tudo PELO MOTOR. Mexer no xp_total sem recalcular
    foi o que já deixou uma conta com 33.000 XP presa no nível 1.
    """
    _exige_arquiteto(usuario)
    alvo = _alvo(db, payload.usuario_id, usuario)

    antes_xp    = alvo.xp_total or 0
    antes_nivel = alvo.nivel_atual or 1
    alvo.xp_total = max(0, antes_xp - payload.quantidade)
    estado = recalcular_nivel(db, alvo)

    _decretar(db, usuario, "revogar_xp", alvo,
              f"−{payload.quantidade} XP (nível {antes_nivel} → {alvo.nivel_atual})",
              antes=f"xp_total={antes_xp}", motivo=payload.motivo)
    db.commit()
    return {"ok": True,
            "detalhe": f"{payload.quantidade} XP retirados de {alvo.nome}",
            "xp_total": alvo.xp_total, "nivel_atual": alvo.nivel_atual,
            "classe": alvo.classe, "estado": estado}


class ConvitePayload(BaseModel):
    convite_id: int
    motivo: Optional[str] = None


@router.post("/revogar/convite")
def revogar_convite(
    payload: ConvitePayload,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    _exige_arquiteto(usuario)
    cv = db.query(Convite).filter(Convite.id == payload.convite_id).first()
    if not cv:
        raise HTTPException(404, "Convite não encontrado")
    if cv.usado_por_id:
        raise HTTPException(400, "Convite já foi usado — não há o que anular")
    if cv.revogado:
        raise HTTPException(400, "Convite já estava anulado")

    cv.revogado = True
    _decretar(db, usuario, "revogar_convite", None,
              f"Convite {cv.codigo} anulado", motivo=payload.motivo)
    db.commit()
    return {"ok": True, "detalhe": f"Convite {cv.codigo} anulado"}


# ══════════════════════════════════════════════════════════════════════════════
# LIVRO DE DECRETOS
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/decretos")
def decretos(
    limite: int = 60,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    _exige_arquiteto(usuario)
    limite = max(1, min(limite, 300))
    regs = (db.query(RegistroPoder)
              .order_by(RegistroPoder.criado_em.desc()).limit(limite).all())

    nomes = {p["id"]: p for p in PODERES}
    return {"decretos": [{
        "id": d.id,
        "poder": d.poder,
        "poder_nome": nomes.get(d.poder, {}).get("nome", d.poder),
        "icone": nomes.get(d.poder, {}).get("icone", "⟁"),
        "destrutivo": nomes.get(d.poder, {}).get("destrutivo", True),
        "por": d.arquiteto_nome,
        "alvo": d.alvo_nome,
        "detalhe": d.detalhe,
        "antes": d.antes,
        "motivo": d.motivo,
        "quando": d.criado_em.isoformat() if d.criado_em else None,
    } for d in regs]}
