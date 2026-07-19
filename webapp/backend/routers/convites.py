# -*- coding: utf-8 -*-
"""
Router de Convites — o Chamado do Arquiteto.
O cadastro é fechado: só entra quem recebe um código.
Somente o Arquiteto gera, revoga e acompanha os convites.
"""
import json
import secrets
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from database import get_db, Usuario, Convite, Conquista
from auth.router import get_usuario_atual

# Níveis que o Arquiteto pode conceder por convite
NIVEIS_PERMITIDOS = ("User", "Admin")

router = APIRouter(prefix="/convites", tags=["convites"])

# Alfabeto sem caracteres ambíguos (0/O, 1/I/L) — código é ditado por voz/WhatsApp
_ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


# Migração centralizada e agnóstica de banco: motors/migracao.py (roda no startup)


def _exige_arquiteto(u: Usuario):
    if u.nivel_acesso != "Arquiteto":
        raise HTTPException(403, "Somente o Arquiteto convoca hunters")


def _gerar_codigo(db: Session) -> str:
    """Código legível no formato SOLO-XXXX-XXXX, único no banco."""
    for _ in range(30):
        bloco = lambda: "".join(secrets.choice(_ALFABETO) for _ in range(4))
        cod = f"SOLO-{bloco()}-{bloco()}"
        if not db.query(Convite).filter(Convite.codigo == cod).first():
            return cod
    raise HTTPException(500, "Não foi possível gerar um código único")


class ConviteCreate(BaseModel):
    nota: Optional[str] = None            # "para o João"
    validade_dias: Optional[int] = 30     # null = não expira
    quantidade: int = 1                   # gerar vários de uma vez
    nivel_acesso: str = "User"            # User | Admin
    badges: Optional[List[str]] = None    # códigos de conquistas a presentear

    @field_validator("nivel_acesso")
    @classmethod
    def _nivel(cls, v):
        v = (v or "User").strip().capitalize()
        if v not in NIVEIS_PERMITIDOS:
            raise ValueError(f"Nível inválido — use um de: {', '.join(NIVEIS_PERMITIDOS)}")
        return v


def _badges_do(c: Convite) -> list:
    try:
        return json.loads(c.badges) if getattr(c, "badges", None) else []
    except Exception:
        return []


def _to_dict(c: Convite, db: Session) -> dict:
    usado_por = None
    if c.usado_por_id:
        u = db.query(Usuario).filter(Usuario.id == c.usado_por_id).first()
        usado_por = {"id": u.id, "nome": u.nome, "login": u.login} if u else None
    expirado = bool(c.expira_em and datetime.utcnow() > c.expira_em)
    if c.revogado:        estado = "REVOGADO"
    elif c.usado_por_id:  estado = "USADO"
    elif expirado:        estado = "EXPIRADO"
    else:                 estado = "DISPONIVEL"

    cods = _badges_do(c)
    presentes = []
    if cods:
        for q in db.query(Conquista).filter(Conquista.codigo.in_(cods)).all():
            presentes.append({"codigo": q.codigo, "titulo": q.titulo,
                              "icone": q.icone, "xp_bonus": q.xp_bonus})
    return {
        "id": c.id, "codigo": c.codigo, "nota": c.nota, "estado": estado,
        "nivel_acesso": getattr(c, "nivel_acesso", "User") or "User",
        "badges": presentes,
        "usado_por": usado_por,
        "usado_em":  c.usado_em.isoformat()  if c.usado_em  else None,
        "expira_em": c.expira_em.isoformat() if c.expira_em else None,
        "criado_em": c.criado_em.isoformat() if c.criado_em else None,
    }


@router.get("/badges-disponiveis")
def badges_disponiveis(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Conquistas que o Arquiteto pode presentear num convite."""
    _exige_arquiteto(usuario)
    # Presenteáveis = manuais e não exclusivas do Arquiteto
    qs = db.query(Conquista).filter(
        Conquista.ativo == True,
        Conquista.condicao_tipo == "manual",
    ).all()
    return [{
        "codigo": q.codigo, "titulo": q.titulo, "descricao": q.descricao,
        "icone": q.icone, "cor": q.cor, "xp_bonus": q.xp_bonus, "moedas_bonus": q.moedas_bonus,
        "exclusiva_arquiteto": bool(getattr(q, "exclusiva_arquiteto", False)),
    } for q in qs if not getattr(q, "exclusiva_arquiteto", False)
       and q.codigo != "chamado_arquiteto"]


@router.get("/")
def listar(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    _exige_arquiteto(usuario)
    convites = (db.query(Convite)
                  .filter(Convite.criado_por_id == usuario.id)
                  .order_by(Convite.criado_em.desc()).limit(100).all())
    itens = [_to_dict(c, db) for c in convites]
    return {
        "convites": itens,
        "resumo": {
            "total":       len(itens),
            "disponiveis": sum(1 for i in itens if i["estado"] == "DISPONIVEL"),
            "usados":      sum(1 for i in itens if i["estado"] == "USADO"),
        },
    }


@router.post("/", status_code=201)
def gerar(
    payload: ConviteCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    _exige_arquiteto(usuario)
    qtd = max(1, min(payload.quantidade or 1, 20))
    expira = (datetime.utcnow() + timedelta(days=payload.validade_dias)
              if payload.validade_dias else None)
    # Valida as badges pedidas (só manuais e não exclusivas do Arquiteto)
    badges = []
    if payload.badges:
        validas = {q.codigo for q in db.query(Conquista).filter(
            Conquista.codigo.in_(payload.badges),
            Conquista.ativo == True,
            Conquista.condicao_tipo == "manual",
        ).all() if not getattr(q, "exclusiva_arquiteto", False)}
        desconhecidas = set(payload.badges) - validas
        if desconhecidas:
            raise HTTPException(400, f"Badges não presenteáveis: {', '.join(sorted(desconhecidas))}")
        badges = sorted(validas)

    novos = []
    for _ in range(qtd):
        c = Convite(
            codigo=_gerar_codigo(db),
            criado_por_id=usuario.id,
            nota=(payload.nota or None),
            expira_em=expira,
        )
        try:
            c.nivel_acesso = payload.nivel_acesso
            c.badges = json.dumps(badges) if badges else None
        except Exception:
            pass
        db.add(c)
        db.flush()
        novos.append(c)
    db.commit()
    return {"ok": True, "convites": [_to_dict(c, db) for c in novos]}


@router.delete("/{convite_id}")
def revogar(
    convite_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    _exige_arquiteto(usuario)
    c = db.query(Convite).filter(Convite.id == convite_id,
                                 Convite.criado_por_id == usuario.id).first()
    if not c:
        raise HTTPException(404, "Convite não encontrado")
    if c.usado_por_id:
        raise HTTPException(400, "Convite já utilizado — não pode ser revogado")
    c.revogado = True
    db.commit()
    return {"ok": True, "id": c.id}


@router.get("/validar/{codigo}")
def validar(codigo: str, db: Session = Depends(get_db)):
    """Rota pública: a tela de registro confere o código antes de enviar o formulário."""
    c = db.query(Convite).filter(Convite.codigo == (codigo or "").strip().upper()).first()
    if not c:
        return {"valido": False, "motivo": "Código não encontrado"}
    if c.revogado:
        return {"valido": False, "motivo": "Convite revogado"}
    if c.usado_por_id:
        return {"valido": False, "motivo": "Convite já utilizado"}
    if c.expira_em and datetime.utcnow() > c.expira_em:
        return {"valido": False, "motivo": "Convite expirado"}
    convocador = db.query(Usuario).filter(Usuario.id == c.criado_por_id).first()
    cods = _badges_do(c)
    presentes = []
    if cods:
        presentes = [{"titulo": q.titulo, "icone": q.icone}
                     for q in db.query(Conquista).filter(Conquista.codigo.in_(cods)).all()]
    return {
        "valido": True,
        "convocado_por": convocador.nome if convocador else "o Arquiteto",
        "nota": c.nota,
        "nivel_acesso": getattr(c, "nivel_acesso", "User") or "User",
        "badges": presentes,
    }
