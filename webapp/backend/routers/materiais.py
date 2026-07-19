# -*- coding: utf-8 -*-
"""
Router de Materiais — a Casa de Trocas do Portão.

Regras que sustentam o valor de colecionar:

  1. TRANSFERÊNCIA REAL, NUNCA CÓPIA.
     Quem envia PERDE o emblema. Se todo mundo pudesse duplicar, colecionar
     não significaria nada — a badge SOLO que circula é a mesma badge SOLO.

  2. SÓ CIRCULA O QUE FOI MARCADO PARA CIRCULAR.
     Conquista de missão jamais entra aqui: ela é prova de esforço próprio e
     não pode mudar de dono. Só emblemas com `transferivel = True`.

  3. XP NÃO É FARMÁVEL.
     O bônus do emblema é creditado UMA VEZ, na primeira vez que ele chega às
     mãos de alguém. Numa transferência ninguém ganha e ninguém perde XP —
     senão dois hunters passariam a badge de um para o outro a noite inteira.

  4. QUEM RECEBE É CELEBRADO.
     O emblema chega com `celebrada = False` e a Cerimônia dispara no próximo
     login do destinatário — o material nunca aparece calado no perfil.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import (get_db, Usuario, Conquista, ConquistaUsuario,
                      TransferenciaMaterial)
from auth.router import get_usuario_atual

router = APIRouter(prefix="/materiais", tags=["materiais"])

LIMITE_POR_ENVIO = 10   # nada de despejar o inventário inteiro de uma vez


# ── Helpers ───────────────────────────────────────────────────────────────────
def _eh_arquiteto(u: Usuario) -> bool:
    return u.nivel_acesso == "Arquiteto"


def _material(q: Conquista) -> dict:
    """Forma canônica de um material — o frontend desenha a medalha por `codigo`."""
    return {
        "codigo":     q.codigo,
        "titulo":     q.titulo,
        "descricao":  q.descricao,
        "icone":      q.icone,
        "cor":        q.cor,
        "xp_bonus":   q.xp_bonus or 0,
        "moedas_bonus": q.moedas_bonus or 0,
    }


def _resolver_hunter(db: Session, nick: str) -> Optional[Usuario]:
    """Aceita o login ou o nome — o hunter digita o que lembra."""
    nick = (nick or "").strip()
    if not nick:
        return None
    return (db.query(Usuario)
              .filter(Usuario.ativo == True,
                      or_(Usuario.login.ilike(nick), Usuario.nome.ilike(nick)))
              .first())


# ══════════════════════════════════════════════════════════════════════════════
# INVENTÁRIO — o que EU posso enviar
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/inventario")
def inventario(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    Devolve os materiais do hunter separados em duas pilhas:
      • enviaveis — transferíveis, prontos para a Casa de Trocas
      • presos    — conquistados por missão; ficam à mostra, mas sem botão
    A segunda pilha existe de propósito: o hunter vê o que é dele para sempre.
    """
    posses = (db.query(ConquistaUsuario, Conquista)
                .join(Conquista, Conquista.id == ConquistaUsuario.conquista_id)
                .filter(ConquistaUsuario.usuario_id == usuario.id)
                .order_by(ConquistaUsuario.desbloqueada_em.desc()).all())

    enviaveis, presos = [], []
    for posse, q in posses:
        item = _material(q)
        item["recebido_em"] = posse.desbloqueada_em.isoformat() if posse.desbloqueada_em else None
        if posse.presenteada_por:
            de = db.query(Usuario).filter(Usuario.id == posse.presenteada_por).first()
            item["veio_de"] = de.nome if de else None
        (enviaveis if q.transferivel else presos).append(item)

    return {"enviaveis": enviaveis, "presos": presos,
            "limite_por_envio": LIMITE_POR_ENVIO}


# ══════════════════════════════════════════════════════════════════════════════
# DESTINATÁRIO — confere o nick antes de enviar
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/hunter/{nick}")
def buscar_hunter(
    nick: str,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    Confirma que o nick existe ANTES do envio — o hunter não descobre o erro
    de digitação depois de ter perdido o emblema.
    """
    alvo = _resolver_hunter(db, nick)
    if not alvo:
        raise HTTPException(404, "Nenhum hunter com esse nick no Sistema")
    if alvo.id == usuario.id:
        raise HTTPException(400, "Você não pode enviar materiais para si mesmo")
    return {
        "id": alvo.id, "login": alvo.login, "nome": alvo.nome,
        "avatar_url": alvo.avatar_url, "classe": alvo.classe,
        "nivel_atual": alvo.nivel_atual,
    }


# ══════════════════════════════════════════════════════════════════════════════
# ENVIO — o material muda de dono
# ══════════════════════════════════════════════════════════════════════════════
class EnvioPayload(BaseModel):
    nick:     str
    codigos:  List[str]
    mensagem: Optional[str] = None

    @field_validator("codigos")
    @classmethod
    def _codigos(cls, v):
        v = [c for c in (v or []) if c]
        if not v:
            raise ValueError("Escolha ao menos um material")
        if len(v) > LIMITE_POR_ENVIO:
            raise ValueError(f"No máximo {LIMITE_POR_ENVIO} materiais por envio")
        return v

    @field_validator("mensagem")
    @classmethod
    def _msg(cls, v):
        v = (v or "").strip()
        return v[:300] or None


@router.post("/enviar")
def enviar(
    payload: EnvioPayload,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    alvo = _resolver_hunter(db, payload.nick)
    if not alvo:
        raise HTTPException(404, "Nenhum hunter com esse nick no Sistema")
    if alvo.id == usuario.id:
        raise HTTPException(400, "Você não pode enviar materiais para si mesmo")

    enviados, recusados = [], []

    for codigo in payload.codigos:
        q = db.query(Conquista).filter(Conquista.codigo == codigo).first()
        if not q:
            recusados.append({"codigo": codigo, "motivo": "material inexistente"})
            continue
        if not q.transferivel:
            recusados.append({"codigo": codigo, "titulo": q.titulo,
                              "motivo": "este emblema não circula — é conquistado, não trocado"})
            continue

        posse = (db.query(ConquistaUsuario)
                   .filter(ConquistaUsuario.usuario_id == usuario.id,
                           ConquistaUsuario.conquista_id == q.id).first())
        if not posse:
            recusados.append({"codigo": codigo, "titulo": q.titulo,
                              "motivo": "você não possui este material"})
            continue

        ja_tem = (db.query(ConquistaUsuario)
                    .filter(ConquistaUsuario.usuario_id == alvo.id,
                            ConquistaUsuario.conquista_id == q.id).first())
        if ja_tem:
            recusados.append({"codigo": codigo, "titulo": q.titulo,
                              "motivo": f"{alvo.nome} já possui este material"})
            continue

        # A troca em si: a posse sai de um e nasce no outro.
        # Note que NÃO mexemos em XP — ver regra 3 no cabeçalho.
        db.delete(posse)
        db.add(ConquistaUsuario(
            usuario_id      = alvo.id,
            conquista_id    = q.id,
            desbloqueada_em = datetime.utcnow(),
            celebrada       = False,          # dispara a Cerimônia no login dele
            presenteada_por = usuario.id,
            mensagem        = payload.mensagem,
        ))
        db.add(TransferenciaMaterial(
            conquista_id    = q.id,
            codigo          = q.codigo,
            de_usuario_id   = usuario.id,
            para_usuario_id = alvo.id,
            mensagem        = payload.mensagem,
        ))
        enviados.append({"codigo": q.codigo, "titulo": q.titulo, "icone": q.icone})

    if enviados:
        db.commit()
    else:
        db.rollback()

    if not enviados and recusados:
        raise HTTPException(400, recusados[0]["motivo"])

    return {"ok": True, "para": {"id": alvo.id, "nome": alvo.nome, "login": alvo.login},
            "enviados": enviados, "recusados": recusados}


# ══════════════════════════════════════════════════════════════════════════════
# HISTÓRICO — o livro de trocas do hunter
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/historico")
def historico(
    limite: int = 40,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    limite = max(1, min(limite, 200))
    regs = (db.query(TransferenciaMaterial)
              .filter(or_(TransferenciaMaterial.de_usuario_id == usuario.id,
                          TransferenciaMaterial.para_usuario_id == usuario.id))
              .order_by(TransferenciaMaterial.criado_em.desc())
              .limit(limite).all())

    if not regs:
        return {"registros": []}

    ids = {r.de_usuario_id for r in regs} | {r.para_usuario_id for r in regs}
    nomes = {u.id: u.nome for u in db.query(Usuario).filter(Usuario.id.in_(ids)).all()}
    codigos = {r.codigo for r in regs}
    conq = {q.codigo: q for q in db.query(Conquista).filter(Conquista.codigo.in_(codigos)).all()}

    saida = []
    for r in regs:
        q = conq.get(r.codigo)
        enviou = r.de_usuario_id == usuario.id
        saida.append({
            "id": r.id,
            "direcao": "enviado" if enviou else "recebido",
            "codigo": r.codigo,
            "titulo": q.titulo if q else r.codigo,
            "icone":  q.icone if q else "🎖",
            "cor":    q.cor if q else "#f59e0b",
            "outro":  nomes.get(r.para_usuario_id if enviou else r.de_usuario_id, "—"),
            "mensagem": r.mensagem,
            "quando": r.criado_em.isoformat() if r.criado_em else None,
        })
    return {"registros": saida}


# ══════════════════════════════════════════════════════════════════════════════
# CATÁLOGO — só o Arquiteto decide o que circula
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/catalogo")
def catalogo(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    if not _eh_arquiteto(usuario):
        raise HTTPException(403, "Somente o Arquiteto pode fazer isso")

    itens = db.query(Conquista).order_by(Conquista.titulo.asc()).all()
    return {"itens": [{
        **_material(q),
        "transferivel":  bool(q.transferivel),
        "colecionavel":  bool(q.colecionavel),
        "de_missao":     (q.condicao_tipo or "").lower() != "manual",
        "donos":         q.usuarios.count(),
    } for q in itens]}


class StatusPayload(BaseModel):
    transferivel: bool


@router.patch("/catalogo/{codigo}")
def definir_status(
    codigo: str,
    payload: StatusPayload,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Liga/desliga a circulação de um emblema na Casa de Trocas."""
    if not _eh_arquiteto(usuario):
        raise HTTPException(403, "Somente o Arquiteto pode fazer isso")

    q = db.query(Conquista).filter(Conquista.codigo == codigo).first()
    if not q:
        raise HTTPException(404, "Material não encontrado")

    # Trava de integridade: conquista de missão nunca circula, nem por decreto.
    if payload.transferivel and (q.condicao_tipo or "").lower() != "manual":
        raise HTTPException(
            400, "Conquistas de missão não podem circular — são prova de esforço próprio")

    q.transferivel = payload.transferivel

    # Circular e ser "exclusiva do Arquiteto" são status contraditórios: se o
    # emblema muda de dono, quem o recebe precisa poder vê-lo no próprio perfil.
    if payload.transferivel and getattr(q, "exclusiva_arquiteto", False):
        q.exclusiva_arquiteto = False

    db.commit()
    return {"ok": True, "codigo": q.codigo,
            "transferivel": bool(q.transferivel),
            "exclusiva_arquiteto": bool(q.exclusiva_arquiteto)}
