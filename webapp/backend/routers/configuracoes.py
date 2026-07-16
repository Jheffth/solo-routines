"""
Router de Configurações do App — logo, fontes, tema.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db, ConfiguracaoApp, Usuario
from auth.router import get_usuario_atual, get_admin

router = APIRouter(prefix="/configuracoes", tags=["configuracoes"])

# Chaves permitidas e seus valores padrão
CHAVES_VALIDAS = {
    "app_nome":      "Solo Routines",
    "logo_url":      "",
    "fonte_titulo":  "Cinzel Decorative",
    "fonte_secao":   "Rajdhani",
    "fonte_body":    "Inter",
    "cor_destaque":  "#7c3aed",
    "notif_manha":   "07:00",
    "notif_tarde":   "14:00",
    "notif_noite":   "21:00",
}

FONTES_TITULO = [
    "Cinzel Decorative", "Uncial Antiqua", "MedievalSharp", "Almendra Display",
    "Caesar Dressing", "Pirata One", "Jim Nightshade", "Sancreek",
    "Trade Winds", "IM Fell English SC",
]
FONTES_SECAO = [
    "Rajdhani", "Orbitron", "Exo 2", "Russo One",
    "Oxanium", "Share Tech Mono", "Aldrich", "Nova Square",
]
FONTES_BODY = [
    "Inter", "Roboto", "Open Sans", "Nunito", "Lato", "Poppins",
]


class ConfigUpdate(BaseModel):
    chave: str
    valor: str


@router.get("/")
def listar_configs(db: Session = Depends(get_db)):
    """Retorna todas as configurações públicas (sem auth — o frontend precisa na tela de login)."""
    configs = {c.chave: c.valor for c in db.query(ConfiguracaoApp).all()}
    # Garantir defaults
    for chave, default in CHAVES_VALIDAS.items():
        if chave not in configs:
            configs[chave] = default
    return {
        "configs": configs,
        "opcoes_fontes_titulo": FONTES_TITULO,
        "opcoes_fontes_secao":  FONTES_SECAO,
        "opcoes_fontes_body":   FONTES_BODY,
    }


@router.put("/")
def atualizar_config(
    payload: ConfigUpdate,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(get_admin),
):
    if payload.chave not in CHAVES_VALIDAS:
        raise HTTPException(400, f"Chave '{payload.chave}' inválida")

    cfg = db.query(ConfiguracaoApp).filter(ConfiguracaoApp.chave == payload.chave).first()
    if cfg:
        cfg.valor = payload.valor
    else:
        db.add(ConfiguracaoApp(chave=payload.chave, valor=payload.valor))
    db.commit()
    return {"ok": True, "chave": payload.chave, "valor": payload.valor}


@router.put("/batch")
def atualizar_configs_batch(
    payload: dict,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(get_admin),
):
    """Atualiza múltiplas configurações de uma vez."""
    atualizadas = {}
    for chave, valor in payload.items():
        if chave not in CHAVES_VALIDAS:
            continue
        cfg = db.query(ConfiguracaoApp).filter(ConfiguracaoApp.chave == chave).first()
        if cfg:
            cfg.valor = str(valor)
        else:
            db.add(ConfiguracaoApp(chave=chave, valor=str(valor)))
        atualizadas[chave] = valor
    db.commit()
    return {"ok": True, "atualizadas": atualizadas}
