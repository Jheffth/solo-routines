"""Habilidades permanentes conquistadas por rotinas; sem crédito extra de XP."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from database import get_db, Usuario, Rotina, ExecucaoDia, Habilidade
from auth.router import get_usuario_atual
from motors import habilidades as motor, tempo

router = APIRouter(prefix="/habilidades", tags=["habilidades"])


class Converter(BaseModel):
    nome: str = Field(min_length=1, max_length=80)


@router.get("/")
def listar(db: Session = Depends(get_db), usuario: Usuario = Depends(get_usuario_atual)):
    habilidades = db.query(Habilidade).filter(Habilidade.usuario_id == usuario.id).order_by(Habilidade.id.desc()).all()
    rotinas = db.query(Rotina).filter(Rotina.usuario_id == usuario.id, Rotina.ativo == True).all()
    hist = motor.historicos(db, usuario.id, [r.id for r in rotinas])
    progressos = [motor.progresso(r, hist[r.id]) for r in rotinas]
    progressos.sort(key=lambda p: p["sequencia"] / p["meta"], reverse=True)
    for p in progressos:
        p.pop("execucao_ids")
    return {"habilidades": [motor.serializar(h) for h in habilidades], "progressos": progressos}


@router.post("/de-rotina/{rotina_id}", status_code=201)
def converter(rotina_id: int, payload: Converter, db: Session = Depends(get_db),
              usuario: Usuario = Depends(get_usuario_atual)):
    nome = payload.nome.strip()
    if not nome or any(ord(c) < 32 for c in nome):
        raise HTTPException(422, "Escolha um nome de 1 a 80 caracteres, sem quebras de linha.")
    r = db.query(Rotina).filter(Rotina.id == rotina_id, Rotina.usuario_id == usuario.id).with_for_update().first()
    if not r:
        raise HTTPException(404, "Rotina não encontrada")
    motor.proteger_origem(db, r.id)
    if not r.ativo:
        raise HTTPException(409, "A rotina precisa estar ativa para virar habilidade.")
    hist = motor.historicos(db, usuario.id, [r.id])[r.id]
    evidencia = motor.progresso(r, hist)
    if not evidencia["elegivel"]:
        raise HTTPException(409, f"São necessárias {evidencia['meta']} execuções perfeitas consecutivas. Progresso: {evidencia['sequencia']}.")
    evidencia.update({"regra_versao": 1, "criterio": "90 + 30 por degrau abaixo da dificuldade e prioridade máximas",
                      "base_historica": "Execuções registradas e configuração da rotina no momento da conversão",
                      "tipo": r.tipo, "dias_semana": r.dias_semana, "dia_mes": r.dia_mes,
                      "mes_dia": r.mes_dia, "hora_inicio": r.hora_inicio,
                      "hora_fim": r.hora_fim, "descricao": r.descricao})
    h = Habilidade(usuario_id=usuario.id, rotina_id=r.id, nome=nome,
                   evidencia=evidencia, criado_em=datetime.utcnow())
    db.add(h)
    r.ativo = False
    r.status = "ARQUIVADA"
    # Encerrar as ocorrências abertas não apaga nem altera as vitórias anteriores.
    for ed in hist:
        if ed.status in ("PENDENTE", "ATIVA", "PAUSADA"):
            ed.status = "CANCELADA"
            ed.cancelada_em = tempo.agora()
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Esta rotina já foi convertida em habilidade.")
    db.refresh(h)
    return motor.serializar(h)
