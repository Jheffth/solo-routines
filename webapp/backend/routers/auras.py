# -*- coding: utf-8 -*-
"""
Router de Auras -- pendentes e celebradas.
Chamado no login do hunter para disparar a ceremonia de recebimento.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, Usuario, AuraUsuario
from auth.router import get_usuario_atual

router = APIRouter(prefix="/auras", tags=["auras"])

# Catalogo local (sincronizado com materiais.py)
# O catálogo mora em motors/cosmeticos.py. Antes havia uma cópia aqui, e ela
# já estava desatualizada: não conhecia "pink-spirit", então essa aura era
# celebrada sem nome e branca. Alias mantido para não mexer no resto do arquivo.
from motors.cosmeticos import AURAS as CATALOGO_AURAS

@router.get("/pendentes")
def pendentes(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    Retorna auras recebidas que ainda nao foram celebradas (celebrada=False).
    O frontend usa isso no login para disparar a ceremonia de recebimento.
    """
    auras = (db.query(AuraUsuario)
               .filter(AuraUsuario.usuario_id == usuario.id,
                       AuraUsuario.celebrada  == False)
               .all())
    resultado = []
    for au in auras:
        cat = CATALOGO_AURAS.get(au.aura_id, {})
        de_nome = None
        if au.presenteada_por:
            remetente = db.query(Usuario).filter(Usuario.id == au.presenteada_por).first()
            de_nome = remetente.nome if remetente else None
        resultado.append({
            "aura_id":       au.aura_id,
            "nome":          cat.get("nome", au.aura_id),
            "descricao":     cat.get("descricao", ""),
            "cor":           cat.get("cor", "#ffffff"),
            "de":            de_nome,
            "mensagem":      au.mensagem,
            "obtida_em":     au.obtida_em.isoformat() if au.obtida_em else None,
        })
    return {"auras": resultado}


@router.post("/celebradas")
def celebradas(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    Marca todas as auras pendentes como celebradas e ativa a mais recente.
    Chamado logo apos a ceremonia de recebimento.
    """
    auras = (db.query(AuraUsuario)
               .filter(AuraUsuario.usuario_id == usuario.id,
                       AuraUsuario.celebrada  == False)
               .all())
    if not auras:
        return {"ok": True, "celebradas": 0}

    for au in auras:
        au.celebrada = True

    # Ativa a aura mais recente no perfil
    mais_recente = max(auras, key=lambda a: a.obtida_em or datetime.min)
    usuario.aura_id = mais_recente.aura_id

    db.commit()
    return {"ok": True, "celebradas": len(auras), "aura_ativa": mais_recente.aura_id}