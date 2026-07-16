"""
Router Gerencial — painel admin: usuários, logs e estatísticas gerais.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from database import get_db, Usuario, LogAuditoria, Rotina, TarefaDia, Execucao
from auth.router import get_admin
from auth.service import hash_senha

router = APIRouter(prefix="/gerencial", tags=["gerencial"])


class AjusteUsuario(BaseModel):
    nome: Optional[str] = None
    nivel_acesso: Optional[str] = None
    ativo: Optional[bool] = None
    xp_ajuste: Optional[int] = None
    moedas_ajuste: Optional[int] = None
    nova_senha: Optional[str] = None


@router.get("/stats")
def stats_gerais(
    db: Session = Depends(get_db),
    admin: Usuario = Depends(get_admin),
):
    total_usuarios = db.query(Usuario).count()
    total_rotinas  = db.query(Rotina).count()
    total_tarefas  = db.query(TarefaDia).count()
    total_execucoes= db.query(Execucao).count()
    return {
        "total_usuarios":  total_usuarios,
        "total_rotinas":   total_rotinas,
        "total_tarefas":   total_tarefas,
        "total_execucoes": total_execucoes,
    }


@router.get("/usuarios")
def listar_usuarios(
    db: Session = Depends(get_db),
    admin: Usuario = Depends(get_admin),
):
    usuarios = db.query(Usuario).order_by(Usuario.criado_em.desc()).all()
    return [
        {
            "id":           u.id,
            "nome":         u.nome,
            "login":        u.login,
            "classe":       u.classe,
            "titulo":       u.titulo,
            "nivel_atual":  u.nivel_atual,
            "xp_total":     u.xp_total,
            "moedas":       u.moedas,
            "nivel_acesso": u.nivel_acesso,
            "ativo":        u.ativo,
            "criado_em":    u.criado_em.isoformat() if u.criado_em else None,
            "ultimo_acesso":u.ultimo_acesso.isoformat() if u.ultimo_acesso else None,
        }
        for u in usuarios
    ]


@router.put("/usuarios/{usuario_id}")
def ajustar_usuario(
    usuario_id: int,
    payload: AjusteUsuario,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(get_admin),
):
    u = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not u:
        raise HTTPException(404, "Usuário não encontrado")

    # Proteção inviolável — Arquiteto não pode ser modificado por ninguém
    if getattr(u, 'inviolavel', False) and u.nivel_acesso == "Arquiteto":
        # Somente outro Arquiteto poderia, mas não permitimos rebaixamento
        raise HTTPException(403, "Este usuário é inviolável e não pode ser modificado")

    # Ninguém pode promover alguém para Arquiteto via API (apenas via seed/script)
    if payload.nivel_acesso == "Arquiteto":
        raise HTTPException(403, "Promoção ao nível Arquiteto não é permitida via painel")

    # Admin comum não pode modificar Criador ou Arquiteto
    if admin.nivel_acesso == "Admin" and u.nivel_acesso in ("Criador", "Arquiteto"):
        raise HTTPException(403, "Sem permissão para modificar este nível de usuário")

    if payload.nome is not None:         u.nome = payload.nome
    if payload.nivel_acesso is not None: u.nivel_acesso = payload.nivel_acesso
    if payload.ativo is not None:        u.ativo = payload.ativo
    if payload.xp_ajuste is not None:
        u.xp_total  += payload.xp_ajuste
        u.xp_atual  += payload.xp_ajuste
    if payload.moedas_ajuste is not None:
        u.moedas += payload.moedas_ajuste
    if payload.nova_senha:
        u.senha_hash = hash_senha(payload.nova_senha)

    db.commit()
    return {"ok": True}


@router.delete("/usuarios/{usuario_id}")
def deletar_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(get_admin),
):
    u = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not u:
        raise HTTPException(404, "Usuário não encontrado")

    # Arquiteto nunca pode ser excluído
    if getattr(u, 'inviolavel', False) or u.nivel_acesso == "Arquiteto":
        raise HTTPException(403, "Este usuário é inviolável e não pode ser excluído")

    # Admin não pode excluir Criador
    if admin.nivel_acesso == "Admin" and u.nivel_acesso in ("Criador", "Arquiteto"):
        raise HTTPException(403, "Sem permissão para excluir este usuário")

    db.delete(u)
    db.commit()
    return {"ok": True, "msg": f"Usuário {u.login} excluído"}


@router.get("/logs")
def listar_logs(
    limit: int = 100,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(get_admin),
):
    logs = db.query(LogAuditoria).order_by(
        LogAuditoria.data_hora.desc()
    ).limit(limit).all()
    return [
        {
            "id":        l.id,
            "data_hora": l.data_hora.isoformat(),
            "usuario":   l.usuario,
            "acao":      l.acao,
            "detalhes":  l.detalhes,
            "ip":        l.ip,
        }
        for l in logs
    ]
