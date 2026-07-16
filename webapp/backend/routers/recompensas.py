"""
Router de Recompensas — catálogo da loja e resgate de itens.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from database import get_db, Recompensa, RecompensaUsuario, Usuario
from auth.router import get_usuario_atual, get_admin

router = APIRouter(prefix="/recompensas", tags=["recompensas"])


class RecompensaCreate(BaseModel):
    titulo: str
    descricao: Optional[str] = None
    icone: str = "🎁"
    categoria: str = "Lazer"
    custo_moedas: int = 100
    custo_xp: int = 0
    nivel_minimo: int = 1
    estoque: int = -1


class RecompensaUpdate(BaseModel):
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    icone: Optional[str] = None
    categoria: Optional[str] = None
    custo_moedas: Optional[int] = None
    nivel_minimo: Optional[int] = None
    estoque: Optional[int] = None
    ativo: Optional[bool] = None


def _recompensa_to_dict(r: Recompensa, usuario_id: int = None, db: Session = None) -> dict:
    resgatada = False
    if usuario_id and db:
        resgatada = db.query(RecompensaUsuario).filter(
            RecompensaUsuario.usuario_id == usuario_id,
            RecompensaUsuario.recompensa_id == r.id,
        ).first() is not None
    return {
        "id":           r.id,
        "titulo":       r.titulo,
        "descricao":    r.descricao,
        "icone":        r.icone,
        "categoria":    r.categoria,
        "custo_moedas": r.custo_moedas,
        "custo_xp":     r.custo_xp,
        "nivel_minimo": r.nivel_minimo,
        "estoque":      r.estoque,
        "ativo":        r.ativo,
        "resgatada":    resgatada,
    }


@router.get("/")
def listar_recompensas(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    recompensas = db.query(Recompensa).filter(Recompensa.ativo == True).all()
    return [_recompensa_to_dict(r, usuario.id, db) for r in recompensas]


@router.post("/{recompensa_id}/resgatar")
def resgatar_recompensa(
    recompensa_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    r = db.query(Recompensa).filter(
        Recompensa.id == recompensa_id, Recompensa.ativo == True
    ).first()
    if not r:
        raise HTTPException(404, "Recompensa não encontrada")

    if usuario.nivel_atual < r.nivel_minimo:
        raise HTTPException(400, f"Você precisa ser nível {r.nivel_minimo} para resgatar isto")

    if usuario.xp_total < r.custo_xp:
        raise HTTPException(400, f"XP insuficiente. Necessário: {r.custo_xp} XP")

    if usuario.moedas < r.custo_moedas:
        raise HTTPException(400, f"Mana Coins insuficientes. Necessário: {r.custo_moedas} 💰")

    if r.estoque == 0:
        raise HTTPException(400, "Esta recompensa está esgotada")

    # Debita moedas
    usuario.moedas -= r.custo_moedas
    if r.estoque > 0:
        r.estoque -= 1

    # Registra resgate
    resgate = RecompensaUsuario(
        usuario_id=usuario.id,
        recompensa_id=r.id,
    )
    db.add(resgate)
    db.commit()
    return {"ok": True, "msg": f"🎉 Recompensa '{r.titulo}' resgatada!", "moedas_restantes": usuario.moedas}


# ── Admin ──────────────────────────────────────────────────────
@router.post("/", status_code=201)
def criar_recompensa(
    payload: RecompensaCreate,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(get_admin),
):
    r = Recompensa(**payload.dict())
    db.add(r)
    db.commit()
    db.refresh(r)
    return _recompensa_to_dict(r)


@router.put("/{recompensa_id}")
def atualizar_recompensa(
    recompensa_id: int,
    payload: RecompensaUpdate,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(get_admin),
):
    r = db.query(Recompensa).filter(Recompensa.id == recompensa_id).first()
    if not r:
        raise HTTPException(404, "Recompensa não encontrada")

    for field, value in payload.dict(exclude_none=True).items():
        setattr(r, field, value)
    db.commit()
    db.refresh(r)
    return _recompensa_to_dict(r)


@router.delete("/{recompensa_id}")
def deletar_recompensa(
    recompensa_id: int,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(get_admin),
):
    r = db.query(Recompensa).filter(Recompensa.id == recompensa_id).first()
    if not r:
        raise HTTPException(404, "Recompensa não encontrada")
    r.ativo = False
    db.commit()
    return {"ok": True}
