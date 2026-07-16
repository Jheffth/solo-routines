"""
Router de Rotinas — CRUD + ciclo de vida diário completo.
Ciclo: PENDENTE → ATIVA → CONCLUIDA | FRACASSADA | CANCELADA
Cada rotina gera um registro ExecucaoDia por dia que ela é devida.
"""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime

from database import get_db, Rotina, Execucao, ExecucaoDia, Usuario
from auth.router import get_usuario_atual

router = APIRouter(prefix="/rotinas", tags=["rotinas"])

# ── Tabelas de multiplicadores ──────────────────────────────────────────────
_MULT_DIFIC  = {"FACIL": 0.5, "NORMAL": 1.0, "DIFICIL": 1.5, "LENDARIO": 2.5}
_XP_TIPO     = {"DIARIA": 50,  "SEMANAL": 200, "MENSAL": 500,  "ANUAL": 2000}
_MC_TIPO     = {"DIARIA": 5,   "SEMANAL": 25,  "MENSAL": 60,   "ANUAL": 250}
_PENAL_PRIOR = {"CRITICA": 0.5, "ALTA": 0.3, "MEDIA": 0.15, "BAIXA": 0.0}


# ── Schemas Pydantic ──────────────────────────────────────────────────────────
class RotinaCreate(BaseModel):
    titulo:            str
    descricao:         Optional[str]       = None
    tipo:              str                 # DIARIA | SEMANAL | MENSAL | ANUAL
    dias_semana:       Optional[List[int]] = None
    dia_mes:           Optional[int]       = None
    mes_dia:           Optional[str]       = None   # "MM-DD"
    categoria:         str                 = "Pessoal"
    prioridade:        str                 = "MEDIA"
    dificuldade:       str                 = "NORMAL"
    icone:             str                 = "⚔️"
    cor:               str                 = "#7c3aed"
    xp_recompensa:     Optional[int]       = None
    moedas_recompensa: Optional[int]       = None
    penalidade_xp:     Optional[int]       = None
    hora_inicio:       Optional[str]       = None   # "HH:MM" janela de execução
    hora_fim:          Optional[str]       = None   # "HH:MM" prazo da janela


class RotinaUpdate(BaseModel):
    titulo:            Optional[str]       = None
    descricao:         Optional[str]       = None
    tipo:              Optional[str]       = None
    dias_semana:       Optional[List[int]] = None
    dia_mes:           Optional[int]       = None
    mes_dia:           Optional[str]       = None
    categoria:         Optional[str]       = None
    prioridade:        Optional[str]       = None
    dificuldade:       Optional[str]       = None
    icone:             Optional[str]       = None
    cor:               Optional[str]       = None
    xp_recompensa:     Optional[int]       = None
    moedas_recompensa: Optional[int]       = None
    penalidade_xp:     Optional[int]       = None
    ativo:             Optional[bool]      = None
    hora_inicio:       Optional[str]       = None
    hora_fim:          Optional[str]       = None


# ── Helpers ──────────────────────────────────────────────────────────────────
def _calcular_xp(tipo: str, prioridade: str, dificuldade: str) -> int:
    base       = _XP_TIPO.get(tipo, 50)
    mult       = _MULT_DIFIC.get(dificuldade, 1.0)
    bonus_prior = {"CRITICA": 1.5, "ALTA": 1.2, "MEDIA": 1.0, "BAIXA": 0.7}
    return max(10, int(base * mult * bonus_prior.get(prioridade, 1.0)))

def _calcular_mc(tipo: str, dificuldade: str) -> int:
    return max(1, int(_MC_TIPO.get(tipo, 5) * _MULT_DIFIC.get(dificuldade, 1.0)))

def _calcular_penalidade(xp: int, prioridade: str) -> int:
    return int(xp * _PENAL_PRIOR.get(prioridade, 0.0))


def _rotina_to_dict(r: Rotina, exec_dia: "ExecucaoDia | None" = None,
                    exec_hoje: "Execucao | None" = None) -> dict:
    """Serializa uma Rotina + o ExecucaoDia do dia (instância diária)."""
    ed = exec_dia   # instância diária

    # Status diário: vem do ExecucaoDia. Se não existe ainda → PENDENTE
    status_hoje = ed.status if ed else "PENDENTE"

    # Compatibilidade retroativa: se há Execucao (concluída) e ainda não temos ed, marca concluída
    if exec_hoje and status_hoje == "PENDENTE":
        status_hoje = "CONCLUIDA"

    return {
        # Dados da rotina (template)
        "id":               r.id,
        "titulo":           r.titulo,
        "descricao":        r.descricao,
        "tipo":             r.tipo,
        "dias_semana":      json.loads(r.dias_semana) if r.dias_semana else [],
        "dia_mes":          r.dia_mes,
        "mes_dia":          r.mes_dia,
        "categoria":        r.categoria,
        "prioridade":       r.prioridade,
        "dificuldade":      getattr(r, "dificuldade", "NORMAL"),
        "icone":            r.icone,
        "cor":              r.cor,
        "xp_recompensa":    r.xp_recompensa,
        "moedas_recompensa":r.moedas_recompensa,
        "penalidade_xp":    getattr(r, "penalidade_xp", 0),
        "hora_inicio":      getattr(r, "hora_inicio", None),
        "hora_fim":         getattr(r, "hora_fim",    None),
        "ativo":            r.ativo,
        "ultima_execucao":  r.ultima_execucao.isoformat() if r.ultima_execucao else None,
        "criado_em":        r.criado_em.isoformat() if r.criado_em else None,
        "usuario_id":       r.usuario_id,

        # Dados diários (ExecucaoDia)
        "exec_dia_id":      ed.id            if ed else None,
        "status_hoje":      status_hoje,
        "iniciada_em":      ed.iniciada_em.isoformat()   if ed and ed.iniciada_em   else None,
        "concluida_hoje":   status_hoje == "CONCLUIDA",
        "concluida_em":     ed.concluida_em.isoformat()  if ed and ed.concluida_em  else None,
        "fracassada_em":    ed.fracassada_em.isoformat() if ed and ed.fracassada_em else None,
        "cancelada_em":     ed.cancelada_em.isoformat()  if ed and ed.cancelada_em  else None,
        "xp_ganho_hoje":    ed.xp_ganho      if ed else 0,
        "xp_perdido_hoje":  ed.xp_perdido    if ed else 0,
        "moedas_hoje":      ed.moedas_ganhas if ed else 0,

        # Retrocompat com exec_hoje (Execucao histórica)
        "exec_hoje": {
            "xp_ganho":       exec_hoje.xp_ganho       if exec_hoje else (ed.xp_ganho if ed else 0),
            "moedas_ganhas":  exec_hoje.moedas_ganhas  if exec_hoje else (ed.moedas_ganhas if ed else 0),
            "streak":         exec_hoje.streak_na_hora  if exec_hoje else 0,
            "bonus_streak":   exec_hoje.bonus_streak    if exec_hoje else 0,
            "criado_em":      exec_hoje.criado_em.isoformat() if exec_hoje and exec_hoje.criado_em else None,
        } if (exec_hoje or ed) else None,
    }


def _eh_rotina_de_hoje(rotina: Rotina, hoje: date) -> bool:
    """Verifica se a rotina é devida hoje conforme sua frequência."""
    if not rotina.ativo:
        return False
    if rotina.tipo == "DIARIA":
        return True
    if rotina.tipo == "SEMANAL":
        dias = json.loads(rotina.dias_semana) if rotina.dias_semana else []
        return hoje.weekday() in dias
    if rotina.tipo == "MENSAL":
        return hoje.day == rotina.dia_mes
    if rotina.tipo == "ANUAL":
        if rotina.mes_dia:
            try:
                m, d = rotina.mes_dia.split("-")
                return hoje.month == int(m) and hoje.day == int(d)
            except Exception:
                return False
    return False


def _obter_ou_criar_exec_dia(db: Session, rotina: Rotina,
                              usuario_id: int, hoje: date) -> ExecucaoDia:
    """Busca o ExecucaoDia de hoje. Se não existe, cria como PENDENTE."""
    ed = db.query(ExecucaoDia).filter(
        ExecucaoDia.rotina_id  == rotina.id,
        ExecucaoDia.usuario_id == usuario_id,
        ExecucaoDia.data       == hoje,
    ).first()
    if not ed:
        ed = ExecucaoDia(
            rotina_id=rotina.id,
            usuario_id=usuario_id,
            data=hoje,
            status="PENDENTE",
        )
        db.add(ed)
        try:
            db.commit()
            db.refresh(ed)
        except Exception:
            db.rollback()
            # Pode ter criado concorrentemente — tenta buscar novamente
            ed = db.query(ExecucaoDia).filter(
                ExecucaoDia.rotina_id  == rotina.id,
                ExecucaoDia.usuario_id == usuario_id,
                ExecucaoDia.data       == hoje,
            ).first()
    return ed


# ── Endpoints CRUD ───────────────────────────────────────────────────────────

@router.get("/")
def listar_rotinas(
    tipo:  Optional[str]  = None,
    ativo: Optional[bool] = None,
    db:    Session        = Depends(get_db),
    usuario: Usuario      = Depends(get_usuario_atual),
):
    q = db.query(Rotina).filter(Rotina.usuario_id == usuario.id)
    if tipo:
        q = q.filter(Rotina.tipo == tipo.upper())
    if ativo is not None:
        q = q.filter(Rotina.ativo == ativo)
    hoje = date.today()
    resultado = []
    for r in q.order_by(Rotina.criado_em.desc()).all():
        # Para a listagem geral, inclui exec_dia se for dia dela
        ed = None
        if _eh_rotina_de_hoje(r, hoje):
            ed = _obter_ou_criar_exec_dia(db, r, usuario.id, hoje)
        resultado.append(_rotina_to_dict(r, exec_dia=ed))
    return resultado


@router.get("/hoje")
def rotinas_de_hoje(
    db:    Session   = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    hoje  = date.today()
    todas = db.query(Rotina).filter(
        Rotina.usuario_id == usuario.id, Rotina.ativo == True
    ).all()
    resultado = []
    for r in todas:
        if not _eh_rotina_de_hoje(r, hoje):
            continue
        # Garante que existe um ExecucaoDia para hoje (cria como PENDENTE se não existir)
        ed = _obter_ou_criar_exec_dia(db, r, usuario.id, hoje)
        # Execucao histórica (para compatibilidade com XP já registrado)
        exec_hist = db.query(Execucao).filter(
            Execucao.usuario_id   == usuario.id,
            Execucao.rotina_id    == r.id,
            Execucao.data_execucao == hoje,
        ).first()
        resultado.append(_rotina_to_dict(r, exec_dia=ed, exec_hoje=exec_hist))
    return resultado


@router.get("/{rotina_id}")
def obter_rotina(
    rotina_id: int,
    db:    Session   = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    r = db.query(Rotina).filter(
        Rotina.id == rotina_id, Rotina.usuario_id == usuario.id
    ).first()
    if not r:
        raise HTTPException(404, "Rotina não encontrada")
    hoje = date.today()
    ed = None
    if _eh_rotina_de_hoje(r, hoje):
        ed = _obter_ou_criar_exec_dia(db, r, usuario.id, hoje)
    return _rotina_to_dict(r, exec_dia=ed)


@router.post("/", status_code=201)
def criar_rotina(
    payload: RotinaCreate,
    db:    Session   = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    tipo  = payload.tipo.upper()
    prior = payload.prioridade.upper()
    dific = payload.dificuldade.upper()

    xp  = payload.xp_recompensa  or _calcular_xp(tipo, prior, dific)
    mc  = payload.moedas_recompensa or _calcular_mc(tipo, dific)
    pen = payload.penalidade_xp if payload.penalidade_xp is not None else _calcular_penalidade(xp, prior)

    rotina = Rotina(
        titulo=payload.titulo, descricao=payload.descricao,
        tipo=tipo,
        dias_semana=json.dumps(payload.dias_semana) if payload.dias_semana else None,
        dia_mes=payload.dia_mes, mes_dia=payload.mes_dia,
        categoria=payload.categoria, prioridade=prior,
        icone=payload.icone, cor=payload.cor,
        xp_recompensa=xp, moedas_recompensa=mc,
        usuario_id=usuario.id, ativo=True,
    )
    try: rotina.dificuldade   = dific
    except Exception: pass
    try: rotina.penalidade_xp = pen
    except Exception: pass
    try: rotina.hora_inicio   = payload.hora_inicio
    except Exception: pass
    try: rotina.hora_fim      = payload.hora_fim
    except Exception: pass

    db.add(rotina)
    db.commit()
    db.refresh(rotina)

    # Cria ExecucaoDia de hoje se a rotina já é devida hoje
    hoje = date.today()
    ed = None
    if _eh_rotina_de_hoje(rotina, hoje):
        ed = _obter_ou_criar_exec_dia(db, rotina, usuario.id, hoje)

    return _rotina_to_dict(rotina, exec_dia=ed)


@router.put("/{rotina_id}")
def atualizar_rotina(
    rotina_id: int,
    payload:   RotinaUpdate,
    db:        Session   = Depends(get_db),
    usuario:   Usuario   = Depends(get_usuario_atual),
):
    r = db.query(Rotina).filter(
        Rotina.id == rotina_id, Rotina.usuario_id == usuario.id
    ).first()
    if not r:
        raise HTTPException(404, "Rotina não encontrada")

    if payload.titulo       is not None: r.titulo       = payload.titulo
    if payload.descricao    is not None: r.descricao    = payload.descricao
    if payload.tipo         is not None: r.tipo         = payload.tipo.upper()
    if payload.dias_semana  is not None: r.dias_semana  = json.dumps(payload.dias_semana)
    if payload.dia_mes      is not None: r.dia_mes      = payload.dia_mes
    if payload.mes_dia      is not None: r.mes_dia      = payload.mes_dia
    if payload.categoria    is not None: r.categoria    = payload.categoria
    if payload.prioridade   is not None: r.prioridade   = payload.prioridade.upper()
    if payload.icone        is not None: r.icone        = payload.icone
    if payload.cor          is not None: r.cor          = payload.cor
    if payload.xp_recompensa     is not None: r.xp_recompensa     = payload.xp_recompensa
    if payload.moedas_recompensa is not None: r.moedas_recompensa = payload.moedas_recompensa
    if payload.ativo        is not None: r.ativo        = payload.ativo
    try:
        if payload.dificuldade   is not None: r.dificuldade   = payload.dificuldade.upper()
        if payload.penalidade_xp is not None: r.penalidade_xp = payload.penalidade_xp
        if payload.hora_inicio   is not None: r.hora_inicio   = payload.hora_inicio or None
        if payload.hora_fim      is not None: r.hora_fim      = payload.hora_fim or None
    except Exception:
        pass

    db.commit()
    db.refresh(r)
    hoje = date.today()
    ed = _obter_ou_criar_exec_dia(db, r, usuario.id, hoje) if _eh_rotina_de_hoje(r, hoje) else None
    return _rotina_to_dict(r, exec_dia=ed)


@router.delete("/{rotina_id}")
def deletar_rotina(
    rotina_id: int,
    extinguir: bool = False,
    db:    Session   = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    r = db.query(Rotina).filter(
        Rotina.id == rotina_id, Rotina.usuario_id == usuario.id
    ).first()
    if not r:
        raise HTTPException(404, "Rotina não encontrada")

    if extinguir and usuario.nivel_acesso == "Arquiteto":
        total = db.query(
            func.sum(Execucao.xp_ganho).label('xp'),
            func.sum(Execucao.moedas_ganhas).label('moedas')
        ).filter(Execucao.rotina_id == r.id, Execucao.usuario_id == usuario.id).one()
        usuario.xp_total = max(0, (usuario.xp_total or 0) - (total.xp    or 0))
        usuario.xp_atual = max(0, (usuario.xp_atual or 0) - (total.xp    or 0))
        usuario.moedas   = max(0, (usuario.moedas   or 0) - (total.moedas or 0))
        db.query(Execucao).filter(Execucao.rotina_id == r.id).delete()
        db.query(ExecucaoDia).filter(ExecucaoDia.rotina_id == r.id).delete()

    db.delete(r)
    db.commit()
    return {"ok": True}


# ── Endpoints de ciclo de vida diário ────────────────────────────────────────

@router.post("/{rotina_id}/iniciar")
def iniciar_rotina(
    rotina_id: int,
    db:    Session   = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Usuário clica 'Iniciar': PENDENTE → ATIVA."""
    r = db.query(Rotina).filter(
        Rotina.id == rotina_id, Rotina.usuario_id == usuario.id
    ).first()
    if not r:
        raise HTTPException(404, "Rotina não encontrada")

    hoje = date.today()
    ed = _obter_ou_criar_exec_dia(db, r, usuario.id, hoje)

    if ed.status not in ("PENDENTE", "PAUSADA"):
        raise HTTPException(400, f"Não é possível iniciar — status atual: {ed.status}")

    ed.status     = "ATIVA"
    ed.iniciada_em = datetime.utcnow()
    db.commit()
    db.refresh(ed)
    return _rotina_to_dict(r, exec_dia=ed)


@router.post("/{rotina_id}/fracassar")
def fracassar_rotina(
    rotina_id: int,
    db:    Session   = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Frontend chama quando prazo vence: ATIVA|PENDENTE → FRACASSADA, aplica penalidade."""
    r = db.query(Rotina).filter(
        Rotina.id == rotina_id, Rotina.usuario_id == usuario.id
    ).first()
    if not r:
        raise HTTPException(404, "Rotina não encontrada")

    hoje = date.today()
    ed = _obter_ou_criar_exec_dia(db, r, usuario.id, hoje)

    if ed.status in ("CONCLUIDA", "FRACASSADA"):
        return _rotina_to_dict(r, exec_dia=ed)  # já finalizada, não mexe

    pen = getattr(r, "penalidade_xp", 0) or 0

    ed.status       = "FRACASSADA"
    ed.fracassada_em = datetime.utcnow()
    ed.xp_perdido   = pen

    # Aplica penalidade ao usuário
    if pen > 0:
        usuario.xp_total = max(0, (usuario.xp_total or 0) - pen)
        usuario.xp_atual = max(0, (usuario.xp_atual or 0) - pen)

    db.commit()
    db.refresh(ed)
    return _rotina_to_dict(r, exec_dia=ed)


@router.post("/{rotina_id}/cancelar")
def cancelar_rotina(
    rotina_id: int,
    db:    Session   = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Cancela o dia de hoje (ATIVA → CANCELADA)."""
    r = db.query(Rotina).filter(
        Rotina.id == rotina_id, Rotina.usuario_id == usuario.id
    ).first()
    if not r:
        raise HTTPException(404, "Rotina não encontrada")

    hoje = date.today()
    ed = _obter_ou_criar_exec_dia(db, r, usuario.id, hoje)

    if ed.status not in ("PENDENTE", "ATIVA"):
        raise HTTPException(400, f"Não é possível cancelar — status: {ed.status}")

    ed.status       = "CANCELADA"
    ed.cancelada_em  = datetime.utcnow()
    db.commit()
    db.refresh(ed)
    return _rotina_to_dict(r, exec_dia=ed)


@router.post("/{rotina_id}/retomar")
def retomar_rotina(
    rotina_id: int,
    db:    Session   = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Retoma missão PAUSADA ou CANCELADA → ATIVA novamente (mesmo dia)."""
    r = db.query(Rotina).filter(
        Rotina.id == rotina_id, Rotina.usuario_id == usuario.id
    ).first()
    if not r:
        raise HTTPException(404, "Rotina não encontrada")

    hoje = date.today()
    ed = _obter_ou_criar_exec_dia(db, r, usuario.id, hoje)

    if ed.status in ("PAUSADA", "CANCELADA"):
        ed.status       = "ATIVA"
        ed.cancelada_em = None
        db.commit()
        db.refresh(ed)
    elif ed.status not in ("ATIVA",):
        raise HTTPException(400, f"Não é possível retomar — status atual: {ed.status}")

    return _rotina_to_dict(r, exec_dia=ed)


@router.post("/{rotina_id}/pausar")
def pausar_rotina(
    rotina_id: int,
    db:    Session   = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Pausa momentânea (visual only — não muda o prazo). ATIVA → PAUSADA."""
    r = db.query(Rotina).filter(
        Rotina.id == rotina_id, Rotina.usuario_id == usuario.id
    ).first()
    if not r:
        raise HTTPException(404, "Rotina não encontrada")
    hoje = date.today()
    ed = _obter_ou_criar_exec_dia(db, r, usuario.id, hoje)
    if ed.status == "ATIVA":
        ed.status = "PAUSADA"
        db.commit()
        db.refresh(ed)
    return _rotina_to_dict(r, exec_dia=ed)
