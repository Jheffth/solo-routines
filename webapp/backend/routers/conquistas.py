"""
Router de Conquistas — listar e verificar achievements do usuário.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db, Conquista, ConquistaUsuario, Usuario
from auth.router import get_usuario_atual
from motors.gamificacao import verificar_conquistas

router = APIRouter(prefix="/conquistas", tags=["conquistas"])


@router.get("/")
def listar_conquistas(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Lista todas as conquistas (desbloqueadas e bloqueadas)."""
    todas = db.query(Conquista).filter(Conquista.ativo == True).all()
    desbloqueadas_map = {
        cu.conquista_id: cu.desbloqueada_em
        for cu in
        db.query(ConquistaUsuario).filter(
            ConquistaUsuario.usuario_id == usuario.id
        ).all()
    }
    return [
        {
            "id":             c.id,
            "titulo":         c.titulo,
            "descricao":      c.descricao,
            "icone":          c.icone,
            "cor":            c.cor,
            "xp_bonus":       c.xp_bonus,
            "moedas_bonus":   c.moedas_bonus,
            "desbloqueada":   c.id in desbloqueadas_map,
            "desbloqueada_em": desbloqueadas_map[c.id].isoformat() if c.id in desbloqueadas_map and desbloqueadas_map[c.id] else None,
        }
        for c in todas
    ]


@router.post("/verificar")
def checar_conquistas(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Executa verificação manual de conquistas (útil para testes)."""
    novas = verificar_conquistas(db, usuario)
    db.commit()
    return {"novas_conquistas": novas}
