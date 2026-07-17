"""
Router de Dashboard — dados consolidados para a tela principal.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date, timedelta

from database import (
    get_db, Usuario, Rotina, TarefaDia, Execucao,
    ConquistaUsuario, Conquista, Nivel
)
from auth.router import get_usuario_atual
from routers.rotinas import _eh_rotina_de_hoje

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
def dashboard_stats(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Stats rápidos + XP dos últimos 7 dias para o dashboard."""
    hoje = date.today()
    total_exec = db.query(Execucao).filter(Execucao.usuario_id == usuario.id).count()
    exec_hoje  = db.query(Execucao).filter(
        Execucao.usuario_id == usuario.id,
        Execucao.data_execucao == hoje,
    ).count()
    rot_ativas = db.query(Rotina).filter(
        Rotina.usuario_id == usuario.id,
        Rotina.ativo == True,
    ).count()

    # XP dos últimos 7 dias
    xp_semana = []
    for i in range(6, -1, -1):
        dia = hoje - timedelta(days=i)
        execucoes_dia = db.query(Execucao).filter(
            Execucao.usuario_id == usuario.id,
            Execucao.data_execucao == dia,
        ).all()
        xp_dia = sum(e.xp_ganho or 0 for e in execucoes_dia)
        xp_semana.append({"data": dia.isoformat(), "xp": xp_dia})

    return {
        "execucoes_hoje":  exec_hoje,
        "total_execucoes": total_exec,
        "rotinas_ativas":  rot_ativas,
        "xp_semana":       xp_semana,
    }



@router.get("/")
def dashboard(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    hoje = date.today()

    # ── Nível e progresso XP ──────────────────────────────
    nivel_info = db.query(Nivel).filter(Nivel.nivel == usuario.nivel_atual).first()
    prox_nivel = db.query(Nivel).filter(Nivel.nivel == usuario.nivel_atual + 1).first()
    pct_xp = 0
    if prox_nivel and prox_nivel.xp_para_proximo > 0:
        pct_xp = round((usuario.xp_atual / prox_nivel.xp_para_proximo) * 100, 1)

    # ── Rotinas de hoje ───────────────────────────────────
    todas_rotinas = db.query(Rotina).filter(
        Rotina.usuario_id == usuario.id, Rotina.ativo == True
    ).all()
    rotinas_hoje = [
        {
            "id":             r.id,
            "titulo":         r.titulo,
            "tipo":           r.tipo,
            "prioridade":     r.prioridade,
            "icone":          r.icone,
            "cor":            r.cor,
            "xp_recompensa":  r.xp_recompensa,
            "moedas_recompensa": r.moedas_recompensa,
            "concluida_hoje": r.ultima_execucao == hoje,
        }
        for r in todas_rotinas if _eh_rotina_de_hoje(r, hoje)
    ]

    # ── Tarefas de hoje ───────────────────────────────────
    tarefas_hoje_db = db.query(TarefaDia).filter(
        TarefaDia.usuario_id == usuario.id,
        TarefaDia.data_prevista == hoje,
    ).all()
    tarefas_hoje = [
        {
            "id":              t.id,
            "titulo":          t.titulo,
            "prioridade":      t.prioridade,
            "categoria":       t.categoria,
            "hora_limite":     t.hora_limite,
            "status":          t.status,
            "xp_recompensa":   t.xp_recompensa,
            "moedas_recompensa": t.moedas_recompensa,
        }
        for t in tarefas_hoje_db
    ]

    # ── Stats rápidos ─────────────────────────────────────
    total_execucoes = db.query(Execucao).filter(
        Execucao.usuario_id == usuario.id
    ).count()
    execucoes_hoje = db.query(Execucao).filter(
        Execucao.usuario_id == usuario.id,
        Execucao.data_execucao == hoje,
    ).count()

    # ── XP dos últimos 7 dias ─────────────────────────────
    xp_semana = []
    for i in range(6, -1, -1):
        dia = hoje - timedelta(days=i)
        xp_dia = sum(
            e.xp_ganho for e in
            db.query(Execucao).filter(
                Execucao.usuario_id == usuario.id,
                Execucao.data_execucao == dia,
            ).all()
        )
        xp_semana.append({"data": dia.isoformat(), "xp": xp_dia})

    # ── Conquistas recentes ───────────────────────────────
    conquistas_recentes = []
    cus = db.query(ConquistaUsuario).filter(
        ConquistaUsuario.usuario_id == usuario.id
    ).order_by(ConquistaUsuario.desbloqueada_em.desc()).limit(3).all()
    for cu in cus:
        c = db.query(Conquista).filter(Conquista.id == cu.conquista_id).first()
        if c:
            conquistas_recentes.append({
                "titulo":         c.titulo,
                "icone":          c.icone,
                "cor":            c.cor,
                "desbloqueada_em": cu.desbloqueada_em.isoformat(),
            })

    return {
        "personagem": {
            "nome":          usuario.nome,
            "avatar_url":    usuario.avatar_url,
            "classe":        usuario.classe,
            "titulo":        usuario.titulo,
            "nivel_atual":   usuario.nivel_atual,
            "xp_atual":      usuario.xp_atual,
            "xp_total":      usuario.xp_total,
            "xp_proximo":    usuario.xp_proximo_nivel,
            "pct_xp":        pct_xp,
            "moedas":        usuario.moedas,
            "streak_atual":  usuario.streak_atual,
            "streak_max":    usuario.streak_max,
            "rank_icone":    nivel_info.icone_rank if nivel_info else "⚪",
        },
        "rotinas_hoje":      rotinas_hoje,
        "tarefas_hoje":      tarefas_hoje,
        "stats": {
            "total_execucoes":  total_execucoes,
            "execucoes_hoje":   execucoes_hoje,
            "rotinas_ativas":   len([r for r in todas_rotinas if r.ativo]),
        },
        "xp_semana":         xp_semana,
        "conquistas_recentes": conquistas_recentes,
    }
