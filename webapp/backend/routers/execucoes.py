"""
Router de Execuções — concluir rotinas recorrentes e obter histórico.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

from database import get_db, Rotina, Execucao, ExecucaoDia, Usuario
from auth.router import get_usuario_atual
from motors.gamificacao import calcular_xp_rotina, aplicar_xp

router = APIRouter(prefix="/execucoes", tags=["execucoes"])


class ConcluirRotinaRequest(BaseModel):
    rotina_id: int
    data_execucao: Optional[date] = None
    observacao: Optional[str] = None


@router.post("/rotina")
def concluir_rotina(
    payload: ConcluirRotinaRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Registra a conclusão de uma rotina, aplica XP e atualiza ExecucaoDia → CONCLUIDA."""
    rotina = db.query(Rotina).filter(
        Rotina.id == payload.rotina_id,
        Rotina.usuario_id == usuario.id,
        Rotina.ativo == True,
    ).first()
    if not rotina:
        raise HTTPException(404, "Rotina não encontrada")

    hoje = payload.data_execucao or date.today()

    # Evita duplo registro no mesmo dia
    ja_executou = db.query(Execucao).filter(
        Execucao.usuario_id == usuario.id,
        Execucao.rotina_id == rotina.id,
        Execucao.data_execucao == hoje,
    ).first()
    if ja_executou:
        raise HTTPException(400, "Esta rotina já foi concluída hoje!")

    rotina.ultima_execucao = hoje
    db.flush()

    xp_base, moedas = calcular_xp_rotina(rotina.tipo)
    if rotina.prioridade == "CRITICA":
        xp_base = int(xp_base * 1.5)
    elif rotina.prioridade == "ALTA":
        xp_base = int(xp_base * 1.2)

    resultado = aplicar_xp(
        db=db,
        usuario=usuario,
        xp_base=rotina.xp_recompensa or xp_base,
        moedas=rotina.moedas_recompensa or moedas,
        hoje=hoje,
        rotina_id=rotina.id,
        observacao=payload.observacao or f"Rotina concluída: {rotina.titulo}",
    )

    # ── Atualiza ExecucaoDia → CONCLUIDA ──────────────────
    ed = db.query(ExecucaoDia).filter(
        ExecucaoDia.rotina_id  == rotina.id,
        ExecucaoDia.usuario_id == usuario.id,
        ExecucaoDia.data       == hoje,
    ).first()
    if not ed:
        ed = ExecucaoDia(rotina_id=rotina.id, usuario_id=usuario.id, data=hoje)
        db.add(ed)
    ed.status       = "CONCLUIDA"
    ed.concluida_em  = datetime.utcnow()
    ed.xp_ganho     = resultado.get("xp_ganho", 0) if isinstance(resultado, dict) else 0
    ed.moedas_ganhas = resultado.get("moedas_ganhas", 0) if isinstance(resultado, dict) else 0
    try:
        db.commit()
    except Exception:
        db.rollback()
    # ──────────────────────────────────────────────────────

    return {"rotina_id": rotina.id, "resultado": resultado}


@router.get("/historico")
def historico(
    dias: int = 30,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Histórico das últimas execuções do usuário."""
    from datetime import timedelta
    desde = date.today() - timedelta(days=dias)
    execs = db.query(Execucao).filter(
        Execucao.usuario_id == usuario.id,
        Execucao.data_execucao >= desde,
    ).order_by(Execucao.data_execucao.desc()).limit(200).all()

    return [
        {
            "id":            e.id,
            "rotina_id":     e.rotina_id,
            "tarefa_id":     e.tarefa_id,
            "data":          e.data_execucao.isoformat(),
            "xp_ganho":      e.xp_ganho,
            "moedas_ganhas": e.moedas_ganhas,
            "streak":        e.streak_na_hora,
            "bonus_streak":  e.bonus_streak,
        }
        for e in execs
    ]


@router.get("/heatmap")
def heatmap(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    Retorna dados para o heatmap anual (estilo GitHub):
    { "YYYY-MM-DD": total_execucoes }
    """
    from datetime import timedelta
    from collections import defaultdict

    um_ano_atras = date.today() - timedelta(days=365)
    execs = db.query(
        Execucao.data_execucao,
    ).filter(
        Execucao.usuario_id == usuario.id,
        Execucao.data_execucao >= um_ano_atras,
    ).all()

    mapa: dict[str, int] = defaultdict(int)
    for (d,) in execs:
        mapa[d.isoformat()] += 1

    return dict(mapa)
