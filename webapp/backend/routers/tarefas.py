"""
Router de Tarefas do Dia — Missões Avulsas com prazo e prioridade.
Ciclo de vida: PENDENTE → ATIVA → CONCLUIDA | CANCELADA
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

from database import get_db, TarefaDia, Usuario
from auth.router import get_usuario_atual
from motors.gamificacao import calcular_xp_tarefa, aplicar_xp

router = APIRouter(prefix="/tarefas", tags=["tarefas"])


class TarefaCreate(BaseModel):
    titulo: str
    descricao: Optional[str] = None
    data_prevista: date
    hora_limite: Optional[str] = None   # "HH:MM"
    prioridade: str = "MEDIA"           # CRITICA | ALTA | MEDIA | BAIXA
    categoria: str = "Pessoal"
    dificuldade: str = "NORMAL"         # FACIL | NORMAL | DIFICIL | LENDARIO
    xp_recompensa: Optional[int] = None
    moedas_recompensa: Optional[int] = None
    penalidade_xp: int = 0


class TarefaUpdate(BaseModel):
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    data_prevista: Optional[date] = None
    hora_limite: Optional[str] = None
    prioridade: Optional[str] = None
    categoria: Optional[str] = None
    dificuldade: Optional[str] = None
    status: Optional[str] = None
    xp_recompensa: Optional[int] = None
    moedas_recompensa: Optional[int] = None
    penalidade_xp: Optional[int] = None


def _tarefa_to_dict(t: TarefaDia) -> dict:
    return {
        "id":                t.id,
        "titulo":            t.titulo,
        "descricao":         t.descricao,
        "data_prevista":     t.data_prevista.isoformat() if t.data_prevista else None,
        "hora_limite":       t.hora_limite,
        "prioridade":        t.prioridade,
        "categoria":         t.categoria,
        "dificuldade":       getattr(t, "dificuldade", "NORMAL") or "NORMAL",
        "status":            t.status,
        "xp_recompensa":     t.xp_recompensa,
        "moedas_recompensa": t.moedas_recompensa,
        "penalidade_xp":     t.penalidade_xp,
        "usuario_id":        t.usuario_id,
        "criado_em":         t.criado_em.isoformat() if t.criado_em else None,
        "concluida_em":      t.concluida_em.isoformat() if t.concluida_em else None,
    }


def _get_ou_404(tarefa_id: int, usuario: Usuario, db: Session) -> TarefaDia:
    t = db.query(TarefaDia).filter(
        TarefaDia.id == tarefa_id,
        TarefaDia.usuario_id == usuario.id
    ).first()
    if not t:
        raise HTTPException(404, "Tarefa não encontrada")
    return t


# ── Leitura ───────────────────────────────────────────────────────────────────

@router.get("/")
def listar_tarefas(
    data: Optional[date] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    q = db.query(TarefaDia).filter(TarefaDia.usuario_id == usuario.id)
    if data:
        q = q.filter(TarefaDia.data_prevista == data)
    if status:
        q = q.filter(TarefaDia.status == status.upper())
    return [_tarefa_to_dict(t) for t in q.order_by(TarefaDia.data_prevista, TarefaDia.id).all()]


@router.get("/hoje")
def tarefas_de_hoje(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    hoje = date.today()
    tarefas = db.query(TarefaDia).filter(
        TarefaDia.usuario_id == usuario.id,
        TarefaDia.data_prevista == hoje,
    ).order_by(TarefaDia.id).all()
    return [_tarefa_to_dict(t) for t in tarefas]


@router.get("/{tarefa_id}")
def obter_tarefa(
    tarefa_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    return _tarefa_to_dict(_get_ou_404(tarefa_id, usuario, db))


# ── Criação ───────────────────────────────────────────────────────────────────

@router.post("/", status_code=201)
def criar_tarefa(
    payload: TarefaCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    xp, mc = calcular_xp_tarefa(payload.prioridade.upper())
    if payload.xp_recompensa is not None:
        xp = payload.xp_recompensa
    if payload.moedas_recompensa is not None:
        mc = payload.moedas_recompensa

    campos = dict(
        titulo=payload.titulo,
        descricao=payload.descricao,
        data_prevista=payload.data_prevista,
        hora_limite=payload.hora_limite,
        prioridade=payload.prioridade.upper(),
        categoria=payload.categoria,
        status="PENDENTE",
        xp_recompensa=xp,
        moedas_recompensa=mc,
        penalidade_xp=payload.penalidade_xp,
        usuario_id=usuario.id,
    )

    tarefa = TarefaDia(**campos)

    # dificuldade: só atribui se a coluna existir no modelo
    try:
        if hasattr(TarefaDia, 'dificuldade'):
            tarefa.dificuldade = payload.dificuldade.upper()
    except Exception:
        pass

    db.add(tarefa)
    db.commit()
    db.refresh(tarefa)
    return _tarefa_to_dict(tarefa)


# ── Ciclo de vida ─────────────────────────────────────────────────────────────

@router.post("/{tarefa_id}/iniciar")
def iniciar_tarefa(
    tarefa_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """PENDENTE | PAUSADA → ATIVA"""
    t = _get_ou_404(tarefa_id, usuario, db)
    if t.status not in ("PENDENTE", "PAUSADA"):
        raise HTTPException(400, f"Não é possível iniciar tarefa com status '{t.status}'")
    t.status = "ATIVA"
    db.commit()
    db.refresh(t)
    return _tarefa_to_dict(t)


@router.post("/{tarefa_id}/pausar")
def pausar_tarefa(
    tarefa_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """ATIVA → PAUSADA"""
    t = _get_ou_404(tarefa_id, usuario, db)
    if t.status != "ATIVA":
        raise HTTPException(400, f"Só é possível pausar tarefas ATIVAS (atual: '{t.status}')")
    t.status = "PAUSADA"
    db.commit()
    db.refresh(t)
    return _tarefa_to_dict(t)


@router.post("/{tarefa_id}/retomar")
def retomar_tarefa(
    tarefa_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """PAUSADA | CANCELADA → ATIVA"""
    t = _get_ou_404(tarefa_id, usuario, db)
    if t.status not in ("PAUSADA", "CANCELADA"):
        raise HTTPException(400, f"Não é possível retomar tarefa com status '{t.status}'")
    t.status = "ATIVA"
    db.commit()
    db.refresh(t)
    return _tarefa_to_dict(t)


@router.post("/{tarefa_id}/cancelar")
def cancelar_tarefa(
    tarefa_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Qualquer status → CANCELADA (exceto já concluída/cancelada)"""
    t = _get_ou_404(tarefa_id, usuario, db)
    if t.status in ("CONCLUIDA", "CANCELADA"):
        raise HTTPException(400, f"Tarefa já está '{t.status}'")
    t.status = "CANCELADA"
    db.commit()
    db.refresh(t)
    return _tarefa_to_dict(t)


@router.post("/{tarefa_id}/concluir")
def concluir_tarefa(
    tarefa_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """ATIVA | PENDENTE → CONCLUIDA + aplica XP/moedas."""
    t = _get_ou_404(tarefa_id, usuario, db)
    if t.status == "CONCLUIDA":
        raise HTTPException(400, "Tarefa já foi concluída")

    t.status = "CONCLUIDA"
    t.concluida_em = datetime.utcnow()
    db.flush()

    resultado = aplicar_xp(
        db=db,
        usuario=usuario,
        xp_base=t.xp_recompensa,
        moedas=t.moedas_recompensa,
        hoje=date.today(),
        tarefa_id=t.id,
        observacao=f"Tarefa concluída: {t.titulo}",
    )
    return {"tarefa": _tarefa_to_dict(t), "resultado": resultado}


# ── Edição / Exclusão ─────────────────────────────────────────────────────────

@router.put("/{tarefa_id}")
def atualizar_tarefa(
    tarefa_id: int,
    payload: TarefaUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    t = _get_ou_404(tarefa_id, usuario, db)

    if payload.titulo is not None:             t.titulo = payload.titulo
    if payload.descricao is not None:          t.descricao = payload.descricao
    if payload.data_prevista is not None:      t.data_prevista = payload.data_prevista
    if payload.hora_limite is not None:        t.hora_limite = payload.hora_limite
    if payload.prioridade is not None:         t.prioridade = payload.prioridade.upper()
    if payload.categoria is not None:          t.categoria = payload.categoria
    if payload.status is not None:             t.status = payload.status.upper()
    if payload.xp_recompensa is not None:      t.xp_recompensa = payload.xp_recompensa
    if payload.moedas_recompensa is not None:  t.moedas_recompensa = payload.moedas_recompensa
    if payload.penalidade_xp is not None:      t.penalidade_xp = payload.penalidade_xp
    try:
        if payload.dificuldade is not None:    t.dificuldade = payload.dificuldade.upper()
    except Exception:
        pass

    db.commit()
    db.refresh(t)
    return _tarefa_to_dict(t)


@router.delete("/{tarefa_id}")
def deletar_tarefa(
    tarefa_id: int,
    extinguir: bool = False,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    Deleta a tarefa.
    Se extinguir=true e status=CONCLUIDA, reverte XP/moedas (Arquiteto).
    """
    t = _get_ou_404(tarefa_id, usuario, db)

    if extinguir and t.status == "CONCLUIDA":
        u = db.query(Usuario).filter(Usuario.id == usuario.id).first()
        if u:
            u.xp_total = max(0, (u.xp_total    or 0) - (t.xp_recompensa    or 0))
            u.moedas   = max(0, (u.moedas       or 0) - (t.moedas_recompensa or 0))

    db.delete(t)
    db.commit()
    return {"ok": True, "extinguido": extinguir}
