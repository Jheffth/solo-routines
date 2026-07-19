"""
Router de Conquistas — listar, verificar e (Arquiteto) gerenciar comemorativas.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, Conquista, ConquistaUsuario, Usuario
from auth.router import get_usuario_atual
from motors.gamificacao import verificar_conquistas, creditar_bonus, recalcular_nivel

router = APIRouter(prefix="/conquistas", tags=["conquistas"])


# Migração centralizada e agnóstica de banco: motors/migracao.py (roda no startup)


def _eh_arquiteto(u: Usuario) -> bool:
    return u.nivel_acesso == "Arquiteto"


@router.get("/")
def listar_conquistas(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    Lista as conquistas (desbloqueadas e bloqueadas).
    Comemorativas do Arquiteto só aparecem para ele — e apenas se marcadas
    como visíveis (ele controla). Para os demais, ficam sempre ocultas.
    """
    todas = db.query(Conquista).filter(Conquista.ativo == True).all()
    desbloqueadas_map = {
        cu.conquista_id: cu.desbloqueada_em
        for cu in db.query(ConquistaUsuario).filter(
            ConquistaUsuario.usuario_id == usuario.id
        ).all()
    }
    arq = _eh_arquiteto(usuario)
    saida = []
    for c in todas:
        exclusiva = bool(getattr(c, "exclusiva_arquiteto", False))
        visivel   = bool(getattr(c, "visivel", True))
        if exclusiva and not arq:
            continue                     # invisível para hunters comuns
        if exclusiva and not visivel:
            continue                     # o Arquiteto escolheu ocultar

        # Emblemas manuais (presentes, colecionáveis, materiais de troca) não
        # se desbloqueiam jogando — mostrá-los trancados só polui o relicário.
        # Quem não possui, não vê.
        if (c.condicao_tipo or "").lower() == "manual" and c.id not in desbloqueadas_map:
            continue
        saida.append({
            "id":              c.id,
            "codigo":          c.codigo,
            "titulo":          c.titulo,
            "descricao":       c.descricao,
            "icone":           c.icone,
            "cor":             c.cor,
            "xp_bonus":        c.xp_bonus,
            "moedas_bonus":    c.moedas_bonus,
            "desbloqueada":    c.id in desbloqueadas_map,
            "desbloqueada_em": desbloqueadas_map[c.id].isoformat()
                               if c.id in desbloqueadas_map and desbloqueadas_map[c.id] else None,
            "exclusiva_arquiteto": exclusiva,
            "visivel":         visivel,
        })
    return saida


@router.post("/verificar")
def checar_conquistas(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Executa verificação manual de conquistas (útil para testes)."""
    novas = verificar_conquistas(db, usuario)
    db.commit()
    return {"novas_conquistas": novas}


# ══════════════════════════════════════════════════════════════════════════════
# COMEMORATIVAS — exclusivas do Arquiteto
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/comemorativas")
def listar_comemorativas(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Painel do Arquiteto: todas as comemorativas, visíveis ou não."""
    if not _eh_arquiteto(usuario):
        raise HTTPException(403, "Somente o Arquiteto acessa as comemorativas")

    todas = db.query(Conquista).filter(Conquista.exclusiva_arquiteto == True).all()
    tem = {cu.conquista_id for cu in db.query(ConquistaUsuario).filter(
        ConquistaUsuario.usuario_id == usuario.id).all()}
    return [{
        "id": c.id, "codigo": c.codigo, "titulo": c.titulo, "descricao": c.descricao,
        "icone": c.icone, "cor": c.cor, "xp_bonus": c.xp_bonus,
        "moedas_bonus": c.moedas_bonus,
        "visivel": bool(getattr(c, "visivel", True)),
        "desbloqueada": c.id in tem,
    } for c in todas]


class VisibilidadePayload(BaseModel):
    visivel: bool


@router.put("/{conquista_id}/visibilidade")
def alternar_visibilidade(
    conquista_id: int,
    payload: VisibilidadePayload,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """O Arquiteto decide se a comemorativa aparece no perfil."""
    if not _eh_arquiteto(usuario):
        raise HTTPException(403, "Somente o Arquiteto altera a visibilidade")
    c = db.query(Conquista).filter(Conquista.id == conquista_id).first()
    if not c:
        raise HTTPException(404, "Conquista não encontrada")
    if not getattr(c, "exclusiva_arquiteto", False):
        raise HTTPException(400, "Só comemorativas do Arquiteto podem ser ocultadas")
    c.visivel = payload.visivel
    db.commit()
    return {"ok": True, "id": c.id, "visivel": c.visivel}


@router.post("/{conquista_id}/conceder")
def conceder_comemorativa(
    conquista_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    Concede uma comemorativa ao Arquiteto (marco alcançado).
    Credita o bônus e devolve o objeto para a Cerimônia de Conquista.
    """
    if not _eh_arquiteto(usuario):
        raise HTTPException(403, "Somente o Arquiteto recebe comemorativas")
    c = db.query(Conquista).filter(Conquista.id == conquista_id).first()
    if not c:
        raise HTTPException(404, "Conquista não encontrada")
    if not getattr(c, "exclusiva_arquiteto", False):
        raise HTTPException(400, "Esta conquista não é comemorativa")

    ja = db.query(ConquistaUsuario).filter(
        ConquistaUsuario.usuario_id == usuario.id,
        ConquistaUsuario.conquista_id == c.id,
    ).first()
    if ja:
        raise HTTPException(400, "Comemorativa já concedida")

    db.add(ConquistaUsuario(usuario_id=usuario.id, conquista_id=c.id,
                            desbloqueada_em=datetime.utcnow()))
    # Passa pelo MOTOR: credita e processa os level-ups decorrentes
    level_ups = creditar_bonus(db, usuario, c.xp_bonus or 0, c.moedas_bonus or 0)
    db.commit()

    # 'codigo' -> insígnia própria na Cerimônia | 'level_ups' -> Ascensão antes dela
    return {
        "level_ups": level_ups,
        "novas_conquistas": [{
            "id": c.id, "codigo": c.codigo, "titulo": c.titulo, "descricao": c.descricao,
            "icone": c.icone, "xp_bonus": c.xp_bonus,
        }],
    }


@router.post("/sincronizar-nivel")
def sincronizar_nivel(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    Reconcilia nível/rank/título com o xp_total acumulado.
    Útil quando XP entrou sem passar pelo motor (bug corrigido) — o perfil
    ficava com XP alto preso num nível baixo.
    """
    antes = {"nivel": usuario.nivel_atual, "rank": usuario.classe,
             "titulo": usuario.titulo, "xp_total": usuario.xp_total}
    estado = recalcular_nivel(db, usuario)
    db.commit()

    ganhou = estado["nivel"] - (antes["nivel"] or 1)
    level_ups = []
    if ganhou > 0:
        level_ups = [{
            "nivel": estado["nivel"], "rank": estado["rank"],
            "titulo": estado["titulo"], "moedas_bonus": 0,
            "niveis_ganhos": ganhou, "nivel_anterior": antes["nivel"],
        }]
    return {"ok": True, "antes": antes, "depois": estado, "level_ups": level_ups}


@router.delete("/{conquista_id}/revogar")
def revogar_comemorativa(
    conquista_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    Devolve a comemorativa ao estado bloqueado e estorna o bônus creditado.
    Serve para reviver a Cerimônia (ensaio) sem inflar o perfil.
    """
    if not _eh_arquiteto(usuario):
        raise HTTPException(403, "Somente o Arquiteto revoga comemorativas")
    c = db.query(Conquista).filter(Conquista.id == conquista_id).first()
    if not c:
        raise HTTPException(404, "Conquista não encontrada")
    if not getattr(c, "exclusiva_arquiteto", False):
        raise HTTPException(400, "Só comemorativas do Arquiteto podem ser revogadas")

    cu = db.query(ConquistaUsuario).filter(
        ConquistaUsuario.usuario_id == usuario.id,
        ConquistaUsuario.conquista_id == c.id,
    ).first()
    if not cu:
        raise HTTPException(400, "Esta comemorativa ainda não foi concedida")

    # Estorna o XP e recalcula nível/rank/título a partir do xp_total,
    # senão o perfil ficaria com nível alto e XP baixo.
    usuario.xp_total = max(0, (usuario.xp_total or 0) - (c.xp_bonus or 0))
    usuario.moedas   = max(0, (usuario.moedas or 0) - (c.moedas_bonus or 0))
    db.delete(cu)
    estado = recalcular_nivel(db, usuario)
    db.commit()
    return {"ok": True, "id": c.id, "codigo": c.codigo,
            "xp_estornado": c.xp_bonus or 0, "moedas_estornadas": c.moedas_bonus or 0,
            "estado": estado}
