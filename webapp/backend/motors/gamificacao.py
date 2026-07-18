"""
Motor de XP, Streaks, Level-up e Conquistas do Solo Routines.
Centraliza toda a lógica de gamificação.
"""
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta
from database import (
    Usuario, Nivel, Conquista, ConquistaUsuario, Execucao, TarefaDia,
    ExecucaoDia, Dungeon, DungeonSessao, DungeonMissao, DungeonMissaoExecucao,
)


# ── Tabela de XP por prioridade ──────────────────────────────────
XP_POR_PRIORIDADE = {
    "CRITICA": 150,
    "ALTA":    100,
    "MEDIA":    60,
    "BAIXA":    30,
}
MOEDAS_POR_PRIORIDADE = {
    "CRITICA": 20,
    "ALTA":    15,
    "MEDIA":   10,
    "BAIXA":    5,
}
XP_POR_TIPO_ROTINA = {
    "DIARIA":  50,
    "SEMANAL": 200,
    "MENSAL":  500,
    "ANUAL":   2000,
}
MOEDAS_POR_TIPO_ROTINA = {
    "DIARIA":  5,
    "SEMANAL": 25,
    "MENSAL":  60,
    "ANUAL":   250,
}


def calcular_xp_tarefa(prioridade: str) -> tuple[int, int]:
    """Retorna (xp, moedas) para uma tarefa pela prioridade."""
    return (
        XP_POR_PRIORIDADE.get(prioridade, 60),
        MOEDAS_POR_PRIORIDADE.get(prioridade, 10),
    )


def calcular_xp_rotina(tipo: str) -> tuple[int, int]:
    """Retorna (xp, moedas) para uma rotina pelo tipo."""
    return (
        XP_POR_TIPO_ROTINA.get(tipo, 50),
        MOEDAS_POR_TIPO_ROTINA.get(tipo, 5),
    )


def calcular_bonus_streak(xp_base: int, streak: int) -> int:
    """Aplica bônus de streak: até 2x com 20 dias."""
    multiplicador = min(1.0 + streak * 0.05, 2.0)
    return int(xp_base * multiplicador) - xp_base


def atualizar_streak(db: Session, usuario: Usuario, hoje: date) -> int:
    """
    Atualiza o streak do usuário.
    Retorna o streak atual após a atualização.
    """
    if usuario.ultima_atividade is None:
        usuario.streak_atual = 1
    elif usuario.ultima_atividade == hoje:
        pass  # Já registrou hoje, mantém streak
    elif usuario.ultima_atividade == hoje - timedelta(days=1):
        usuario.streak_atual += 1
    else:
        usuario.streak_atual = 1  # Quebrou a sequência

    if usuario.streak_atual > usuario.streak_max:
        usuario.streak_max = usuario.streak_atual

    usuario.ultima_atividade = hoje
    return usuario.streak_atual


def processar_level_up(db: Session, usuario: Usuario) -> list[dict]:
    """
    Verifica e processa level-up(s).
    Retorna lista de level-ups ocorridos para notificação no frontend.
    """
    eventos = []
    while True:
        prox_nivel = db.query(Nivel).filter(Nivel.nivel == usuario.nivel_atual + 1).first()
        if not prox_nivel:
            break  # Nível máximo (50)

        if usuario.xp_atual >= prox_nivel.xp_para_proximo:
            usuario.xp_atual -= prox_nivel.xp_para_proximo
            usuario.nivel_atual += 1
            usuario.classe = prox_nivel.rank
            usuario.titulo = prox_nivel.titulo
            usuario.moedas += prox_nivel.moedas_bonus

            # Atualiza XP para próximo nível
            prox_prox = db.query(Nivel).filter(Nivel.nivel == usuario.nivel_atual + 1).first()
            usuario.xp_proximo_nivel = prox_prox.xp_para_proximo if prox_prox else 0

            eventos.append({
                "nivel": usuario.nivel_atual,
                "rank": prox_nivel.rank,
                "titulo": prox_nivel.titulo,
                "moedas_bonus": prox_nivel.moedas_bonus,
            })
        else:
            break
    return eventos


def verificar_conquistas(db: Session, usuario: Usuario) -> list[dict]:
    """
    Verifica e desbloqueia conquistas automaticamente.
    Retorna lista de conquistas desbloqueadas.
    """
    desbloqueadas = []

    # IDs de conquistas que o usuário já tem
    ja_tem = {
        cu.conquista_id
        for cu in db.query(ConquistaUsuario).filter(
            ConquistaUsuario.usuario_id == usuario.id
        ).all()
    }

    todas = db.query(Conquista).filter(Conquista.ativo == True).all()
    hoje = date.today()

    for conquista in todas:
        if conquista.id in ja_tem:
            continue

        desbloqueou = False
        cond = conquista.condicao_tipo
        val  = conquista.condicao_valor

        if cond == "execucoes_total":
            total = db.query(Execucao).filter(Execucao.usuario_id == usuario.id).count()
            desbloqueou = total >= val

        elif cond == "streak":
            desbloqueou = usuario.streak_atual >= val or usuario.streak_max >= val

        elif cond == "nivel":
            desbloqueou = usuario.nivel_atual >= val

        elif cond == "moedas_acumuladas":
            desbloqueou = usuario.moedas >= val

        elif cond == "execucoes_dia":
            total_hoje = db.query(Execucao).filter(
                Execucao.usuario_id == usuario.id,
                Execucao.data_execucao == hoje
            ).count()
            desbloqueou = total_hoje >= val

        elif cond == "rotinas_total":
            total_rot = db.query(Execucao).filter(
                Execucao.usuario_id == usuario.id,
                Execucao.rotina_id != None
            ).count()
            desbloqueou = total_rot >= val

        # ── Semanas perfeitas (condições que estavam órfãs no motor) ──
        # Perfeito = nos últimos N dias, pelo menos 1 conclusão por dia
        # e NENHUM fracasso de rotina no período.
        elif cond in ("rotinas_semana_perfeita", "semanas_perfeitas"):
            dias = 7 * (val if cond == "semanas_perfeitas" else 1)
            inicio = hoje - timedelta(days=dias - 1)
            eds = db.query(ExecucaoDia).filter(
                ExecucaoDia.usuario_id == usuario.id,
                ExecucaoDia.data >= inicio,
            ).all()
            if eds:
                dias_ok = {ed.data for ed in eds if ed.status == "CONCLUIDA"}
                fracassou = any(ed.status == "FRACASSADA" for ed in eds)
                desbloqueou = (not fracassou) and len(dias_ok) >= dias

        # ── Condições de Dungeon (sessões de teste nunca contam) ──
        elif cond == "dungeon_clears":
            desbloqueou = db.query(DungeonSessao).filter(
                DungeonSessao.usuario_id == usuario.id,
                DungeonSessao.modo_teste == False,
                DungeonSessao.status == "CONCLUIDA",
            ).count() >= val

        elif cond == "dungeon_clear_s":
            desbloqueou = db.query(DungeonSessao).filter(
                DungeonSessao.usuario_id == usuario.id,
                DungeonSessao.modo_teste == False,
                DungeonSessao.rank_obtido == "S",
            ).count() >= val

        elif cond == "dungeon_streak":
            melhor = db.query(func.max(Dungeon.streak_max)).filter(
                Dungeon.usuario_id == usuario.id
            ).scalar() or 0
            desbloqueou = melhor >= val

        elif cond == "dungeon_eventos":
            desbloqueou = db.query(DungeonMissaoExecucao).join(
                DungeonSessao, DungeonMissaoExecucao.dungeon_sessao_id == DungeonSessao.id
            ).join(
                DungeonMissao, DungeonMissaoExecucao.dungeon_missao_id == DungeonMissao.id
            ).filter(
                DungeonSessao.usuario_id == usuario.id,
                DungeonSessao.modo_teste == False,
                DungeonMissaoExecucao.status == "CONCLUIDA",
                DungeonMissao.natureza.in_(("EVENTO_ALEATORIO", "BEM_ESTAR")),
            ).count() >= val

        elif cond == "dungeon_tempo":
            total_min = db.query(func.sum(DungeonSessao.tempo_total_min)).filter(
                DungeonSessao.usuario_id == usuario.id,
                DungeonSessao.modo_teste == False,
            ).scalar() or 0
            desbloqueou = total_min >= val

        elif cond == "rotinas_semana_perfeita":
            # Semana perfeita = execuções em todos os 7 dias da semana anterior
            inicio_sem = hoje - timedelta(days=hoje.weekday() + 7)
            fim_sem    = inicio_sem + timedelta(days=6)
            dias_exec  = db.query(Execucao.data_execucao).filter(
                Execucao.usuario_id == usuario.id,
                Execucao.data_execucao >= inicio_sem,
                Execucao.data_execucao <= fim_sem,
            ).distinct().count()
            desbloqueou = dias_exec >= 7

        elif cond == "semanas_perfeitas":
            # 4 semanas perfeitas nos últimos 28 dias
            semanas_ok = 0
            for i in range(4):
                ini = hoje - timedelta(days=(i + 1) * 7)
                fim = ini + timedelta(days=6)
                dias = db.query(Execucao.data_execucao).filter(
                    Execucao.usuario_id == usuario.id,
                    Execucao.data_execucao >= ini,
                    Execucao.data_execucao <= fim,
                ).distinct().count()
                if dias >= 7:
                    semanas_ok += 1
            desbloqueou = semanas_ok >= val

        if desbloqueou:
            cu = ConquistaUsuario(usuario_id=usuario.id, conquista_id=conquista.id)
            db.add(cu)
            usuario.xp_total  += conquista.xp_bonus
            usuario.xp_atual  += conquista.xp_bonus
            usuario.moedas    += conquista.moedas_bonus
            desbloqueadas.append({
                "id":       conquista.id,
                "titulo":   conquista.titulo,
                "icone":    conquista.icone,
                "xp_bonus": conquista.xp_bonus,
            })

    if desbloqueadas:
        db.flush()

    return desbloqueadas


def aplicar_xp(
    db: Session,
    usuario: Usuario,
    xp_base: int,
    moedas: int,
    hoje: date,
    rotina_id: int = None,
    tarefa_id: int = None,
    observacao: str = None,
) -> dict:
    """
    Aplica XP ao usuário, atualiza streak, processa level-up e conquistas.
    Retorna dicionário com todos os eventos para o frontend exibir.
    """
    # Streak
    streak = atualizar_streak(db, usuario, hoje)
    bonus_streak = calcular_bonus_streak(xp_base, streak)
    xp_total_ganho = xp_base + bonus_streak

    # Aplicar XP e moedas
    usuario.xp_total += xp_total_ganho
    usuario.xp_atual += xp_total_ganho
    usuario.moedas   += moedas

    # Registrar execução
    execucao = Execucao(
        usuario_id=usuario.id,
        rotina_id=rotina_id,
        tarefa_id=tarefa_id,
        data_execucao=hoje,
        xp_ganho=xp_total_ganho,
        moedas_ganhas=moedas,
        streak_na_hora=streak,
        bonus_streak=bonus_streak,
        observacao=observacao,
    )
    db.add(execucao)
    db.flush()

    # Level-up
    level_ups = processar_level_up(db, usuario)

    # Conquistas
    conquistas_novas = verificar_conquistas(db, usuario)

    db.commit()

    return {
        "xp_ganho":       xp_total_ganho,
        "xp_base":        xp_base,
        "bonus_streak":   bonus_streak,
        "moedas_ganhas":  moedas,
        "streak_atual":   streak,
        "xp_total":       usuario.xp_total,
        "xp_atual":       usuario.xp_atual,
        "nivel_atual":    usuario.nivel_atual,
        "xp_proximo":     usuario.xp_proximo_nivel,
        "moedas_total":   usuario.moedas,
        "level_ups":      level_ups,
        "conquistas":     conquistas_novas,
    }
