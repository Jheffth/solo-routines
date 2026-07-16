"""
Router de Perfil — dados detalhados para gráficos e histórico.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date, timedelta
from collections import defaultdict
from pydantic import BaseModel
from typing import Optional

from database import (
    get_db, Usuario, Execucao, Rotina, TarefaDia,
    Conquista, ConquistaUsuario, Recompensa, RecompensaUsuario
)
from auth.router import get_usuario_atual

router = APIRouter(prefix="/perfil", tags=["perfil"])


# ── Schema de auto-edição: qualquer usuário ──────────────
class PerfilEdit(BaseModel):
    nome:       Optional[str] = None
    titulo:     Optional[str] = None
    avatar_url: Optional[str] = None
    classe:     Optional[str] = None


# ── Schema de auto-edição: exclusivo Arquiteto ──────────
class ArquitetoEdit(BaseModel):
    nome:        Optional[str] = None
    titulo:      Optional[str] = None
    avatar_url:  Optional[str] = None
    classe:      Optional[str] = None
    nivel_atual: Optional[int] = None
    moedas:      Optional[int] = None
    xp_total:    Optional[int] = None


@router.put("/")
def editar_perfil(
    payload: PerfilEdit,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Qualquer usuário pode atualizar nome, título e avatar."""
    if payload.nome       is not None: usuario.nome       = payload.nome
    if payload.titulo     is not None: usuario.titulo     = payload.titulo
    if payload.avatar_url is not None: usuario.avatar_url = payload.avatar_url
    if payload.classe     is not None: usuario.classe     = payload.classe
    db.commit()
    db.refresh(usuario)
    return {"ok": True, "nome": usuario.nome, "titulo": usuario.titulo, "avatar_url": usuario.avatar_url}


@router.put("/arquiteto")
def editar_arquiteto(
    payload: ArquitetoEdit,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Permite que o Arquiteto edite livremente todos os seus atributos."""
    if usuario.nivel_acesso != "Arquiteto":
        raise HTTPException(403, "Apenas o Arquiteto pode usar este endpoint")

    if payload.nome        is not None: usuario.nome        = payload.nome
    if payload.titulo      is not None: usuario.titulo      = payload.titulo
    if payload.avatar_url  is not None: usuario.avatar_url  = payload.avatar_url
    if payload.classe      is not None: usuario.classe      = payload.classe
    if payload.nivel_atual is not None: usuario.nivel_atual  = payload.nivel_atual
    if payload.moedas      is not None: usuario.moedas       = payload.moedas
    if payload.xp_total    is not None:
        usuario.xp_total  = payload.xp_total
        usuario.xp_atual  = payload.xp_total

    db.commit()
    db.refresh(usuario)
    return {
        "ok":          True,
        "nome":        usuario.nome,
        "titulo":      usuario.titulo,
        "avatar_url":  usuario.avatar_url,
        "nivel_atual": usuario.nivel_atual,
        "moedas":      usuario.moedas,
        "xp_total":    usuario.xp_total,
    }


@router.get("/")
def perfil_completo(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    hoje = date.today()
    um_ano_atras = hoje - timedelta(days=365)

    # ── Radar de habilidades por categoria ───────────────
    categorias = ["Saúde", "Trabalho", "Estudo", "Casa", "Pessoal", "Combate"]
    radar = {}
    for cat in categorias:
        execs_cat = db.query(Execucao).join(
            Rotina, Rotina.id == Execucao.rotina_id, isouter=True
        ).join(
            TarefaDia, TarefaDia.id == Execucao.tarefa_id, isouter=True
        ).filter(
            Execucao.usuario_id == usuario.id,
        ).all()
        total_cat = 0
        for e in execs_cat:
            if e.rotina and e.rotina.categoria == cat:
                total_cat += 1
            elif e.tarefa and e.tarefa.categoria == cat:
                total_cat += 1
        radar[cat] = total_cat

    # ── XP por mês (últimos 12) ───────────────────────────
    xp_mensal = []
    for m in range(11, -1, -1):
        ref = hoje.replace(day=1) - timedelta(days=m * 30)
        inicio = ref.replace(day=1)
        if ref.month == 12:
            fim = ref.replace(year=ref.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            fim = ref.replace(month=ref.month + 1, day=1) - timedelta(days=1)
        xp_m = sum(
            e.xp_ganho for e in
            db.query(Execucao).filter(
                Execucao.usuario_id == usuario.id,
                Execucao.data_execucao >= inicio,
                Execucao.data_execucao <= fim,
            ).all()
        )
        xp_mensal.append({
            "mes": inicio.strftime("%b/%Y"),
            "xp":  xp_m,
        })

    # ── Heatmap anual ─────────────────────────────────────
    execs_ano = db.query(Execucao.data_execucao).filter(
        Execucao.usuario_id == usuario.id,
        Execucao.data_execucao >= um_ano_atras,
    ).all()
    heatmap: dict[str, int] = defaultdict(int)
    for (d,) in execs_ano:
        heatmap[d.isoformat()] += 1

    # ── Todas as conquistas ───────────────────────────────
    todas_cq = db.query(Conquista).filter(Conquista.ativo == True).all()
    desbloqueadas_ids = {
        cu.conquista_id for cu in
        db.query(ConquistaUsuario).filter(ConquistaUsuario.usuario_id == usuario.id).all()
    }
    conquistas_lista = [
        {
            "id":           c.id,
            "titulo":       c.titulo,
            "descricao":    c.descricao,
            "icone":        c.icone,
            "cor":          c.cor,
            "xp_bonus":     c.xp_bonus,
            "desbloqueada": c.id in desbloqueadas_ids,
        }
        for c in todas_cq
    ]

    # ── Histórico de recompensas ──────────────────────────
    resgates = db.query(RecompensaUsuario).filter(
        RecompensaUsuario.usuario_id == usuario.id
    ).order_by(RecompensaUsuario.resgatada_em.desc()).limit(20).all()
    resgates_lista = []
    for rs in resgates:
        r = db.query(Recompensa).filter(Recompensa.id == rs.recompensa_id).first()
        if r:
            resgates_lista.append({
                "titulo":       r.titulo,
                "icone":        r.icone,
                "resgatada_em": rs.resgatada_em.isoformat(),
            })

    return {
        "usuario": {
            "id":               usuario.id,
            "nome":             usuario.nome,
            "login":            usuario.login,
            "avatar_url":       usuario.avatar_url,
            "classe":           usuario.classe,
            "titulo":           usuario.titulo,
            "nivel_atual":      usuario.nivel_atual,
            "xp_total":         usuario.xp_total,
            "xp_atual":         usuario.xp_atual,
            "xp_proximo_nivel": usuario.xp_proximo_nivel,
            "moedas":           usuario.moedas,
            "streak_max":       usuario.streak_max,
            "streak_atual":     usuario.streak_atual,
            "nivel_acesso":     usuario.nivel_acesso,
            "criado_em":        usuario.criado_em.isoformat(),
        },
        "radar_habilidades": radar,
        "xp_mensal":         xp_mensal,
        "heatmap":           dict(heatmap),
        "conquistas":        conquistas_lista,
        "resgates_recentes": resgates_lista,
    }
