"""
Router de Dashboard — dados consolidados para a tela principal.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import date, timedelta
from motors import tempo

from database import (
    get_db, Usuario, Rotina, TarefaDia, Execucao, ExecucaoDia, Pacto,
    ConquistaUsuario, Conquista, Nivel
)
from motors import economia, gamificacao, penitencia, pactos as cat
from auth.router import get_usuario_atual
from routers.rotinas import _eh_rotina_de_hoje

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
def dashboard_stats(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Stats rápidos + XP dos últimos 7 dias para o dashboard."""
    hoje = tempo.hoje()
    total_exec = db.query(Execucao).filter(Execucao.usuario_id == usuario.id).count()
    exec_hoje  = db.query(Execucao).filter(
        Execucao.usuario_id == usuario.id,
        Execucao.data_execucao == hoje,
    ).count()
    rot_ativas = db.query(Rotina).filter(
        Rotina.usuario_id == usuario.id,
        Rotina.ativo == True,
    ).count()

    # XP dos últimos 7 dias — UMA query.
    #
    # Eram SETE, uma por dia, e cada uma carregava as linhas inteiras
    # (`.all()`) só para somar uma coluna. Contra o banco remoto isso
    # eram seis idas e voltas jogadas fora a cada abertura do dashboard.
    inicio = hoje - timedelta(days=6)
    somas = dict(
        db.query(Execucao.data_execucao, func.coalesce(func.sum(Execucao.xp_ganho), 0))
          .filter(Execucao.usuario_id == usuario.id,
                  Execucao.data_execucao >= inicio,
                  Execucao.data_execucao <= hoje)
          .group_by(Execucao.data_execucao)
          .all()
    )
    # Os dias sem execução não voltam do GROUP BY — e o gráfico precisa
    # deles, senão a semana encolhe e a linha mente sobre o intervalo.
    xp_semana = [
        {"data": (inicio + timedelta(days=i)).isoformat(),
         "xp":   int(somas.get(inicio + timedelta(days=i), 0) or 0)}
        for i in range(7)
    ]

    return {
        "execucoes_hoje":  exec_hoje,
        "total_execucoes": total_exec,
        "rotinas_ativas":  rot_ativas,
        "xp_semana":       xp_semana,
    }



@router.get("/corrente")
def corrente(
    dias: int = 30,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    A CORRENTE — o streak desenhado dia a dia.

    POR QUE ISTO PRECISA DE UM ENDPOINT E NÃO SAI DO `streak_atual`

    `Usuario.streak_atual` é UM INTEIRO. Ele sabe que a corrente tem
    cinco elos, e não sabe nada sobre os vinte e cinco dias antes. O
    histórico existe, mas espalhado: em `Execucao` (o que foi cumprido)
    e em `ExecucaoDia`/`TarefaDia` (o que foi exigido). Esta função
    junta os dois e devolve um estado por dia.

    OS TRÊS ESTADOS, E POR QUE NÃO SÃO DOIS

      CUMPRIDO      houve ao menos uma execução no dia
      QUEBROU       o dia exigiu missões e nenhuma foi cumprida
      SEM_REGISTRO  o Sistema não tem nada sobre esse dia

    O terceiro não é preciosismo. Antes desta versão o app não gravava
    o histórico, e pintar esses dias de vermelho seria o Sistema
    inventando fracassos que nunca aconteceram — mentir sobre o passado
    do hunter para preencher um gráfico. Dia sem registro é cinza.

    A DEFINIÇÃO DE "CUMPRIDO" É EMPRESTADA, NÃO INVENTADA

    Verde aqui = existe `Execucao` no dia. É exatamente a condição que
    `gamificacao.atualizar_streak` usa para manter a corrente viva (ela
    grava `ultima_atividade` no mesmo momento). Se eu tivesse escolhido
    um critério mais severo — "cumpriu TODAS as do dia" — o desenho
    contradiria o número ao lado dele, e o hunter veria uma corrente
    quebrada sob um streak de cinco.
    """
    # `int(dias or 30)` estava errado: 0 é falso em Python, então dias=0
    # virava 30 em vez de ser travado em 1. O ausente e o zero são coisas
    # diferentes e agora são tratados como tal.
    dias = 30 if dias is None else int(dias)
    dias = max(1, min(365, dias))
    hoje = tempo.hoje()
    inicio = hoje - timedelta(days=dias - 1)

    # Uma query por fonte, agrupada — não uma por dia.
    cumpridos = {
        d for (d,) in db.query(Execucao.data_execucao)
                        .filter(Execucao.usuario_id == usuario.id,
                                Execucao.data_execucao >= inicio,
                                Execucao.data_execucao <= hoje)
                        .distinct().all()
    }
    exigidos = {
        d for (d,) in db.query(ExecucaoDia.data)
                        .filter(ExecucaoDia.usuario_id == usuario.id,
                                ExecucaoDia.data >= inicio,
                                ExecucaoDia.data <= hoje)
                        .distinct().all()
    }
    exigidos |= {
        d for (d,) in db.query(TarefaDia.data_prevista)
                        .filter(TarefaDia.usuario_id == usuario.id,
                                TarefaDia.data_prevista >= inicio,
                                TarefaDia.data_prevista <= hoje)
                        .distinct().all()
    }

    linha = []
    for i in range(dias):
        d = inicio + timedelta(days=i)
        if d in cumpridos:
            estado = "CUMPRIDO"
        elif d in exigidos:
            estado = "QUEBROU"
        else:
            estado = "SEM_REGISTRO"
        linha.append({"data": d.isoformat(), "estado": estado})

    streak = usuario.streak_atual or 0
    return {
        "streak_atual": streak,
        "streak_max":   usuario.streak_max or 0,
        # Lidos do motor, nunca recalculados aqui — ver o comentário em
        # gamificacao.multiplicador_streak.
        "multiplicador":      round(gamificacao.multiplicador_streak(streak), 2),
        "multiplicador_teto": gamificacao.STREAK_TETO,
        "dias_para_o_teto":   gamificacao.dias_ate_o_teto_do_streak(streak),
        "dias": linha,
    }


@router.get("/penitencia")
def resumo_penitencia(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    A PLACA DA PENITÊNCIA — três mecânicas que já existiam e ninguém via.

      · O TETO. `penitencia.cobrar` para de criar em `divida_teto` e
        anuncia isso num Eco. Quem não leu o Eco nunca soube que há um
        limite, nem o quanto falta para bater nele.

      · O DECAIMENTO. A severidade recua a cada `decaimento_dias` de
        tempo limpo — o motor chama isso de "o caminho de volta". Era
        invisível de duas formas: não aparecia aqui, e nem chegava a ser
        calculado enquanto o hunter se comportava (ver
        `pactos.valor_vigente`).

      · O ABATE. Cumprir missão tira da barra da penitência mais antiga.
        Foi construído e nunca teve mostrador; o hunter não via a
        mecânica funcionando.

    As BARRAS de cada dívida não vêm daqui: o extrato já entrega
    `alvo_repeticoes` e `repeticoes` (via `_repeticao`), e o dashboard
    já tem essa lista em memória. Pedir de novo seria uma segunda
    vitrine do mesmo dado — o erro que já custou caro neste arquivo.
    """
    regras = economia.punicao_regras(db)
    abertas = penitencia.pendentes(db, usuario.id)

    # Quando o próximo degrau de recuo cai — o mais próximo entre os
    # pactos que ainda têm o que devolver.
    #
    # ISTO TINHA CONTA PRÓPRIA e ela estava errada: `decaimento_dias −
    # dias_passados`, travado em zero. Com 10 dias corridos e degrau de
    # 7, dava 0 ("recua já"), quando o degrau seguinte só cai em 4 dias.
    # A conta certa é cíclica, e agora mora num lugar só —
    # `pactos.dias_para_recuar`, a mesma que o card do Pacto usa.
    hoje = tempo.hoje()
    proximo_decaimento = None
    for p in db.query(Pacto).filter(Pacto.usuario_id == usuario.id,
                                    Pacto.ativo == True).all():
        faltam = cat.dias_para_recuar(p.valor_atual, p.base, p.tipo,
                                      p.ultima_queda, hoje,
                                      regras["decaimento_dias"],
                                      regras["decaimento_fator"])
        if faltam is None:
            continue
        if proximo_decaimento is None or faltam < proximo_decaimento:
            proximo_decaimento = faltam

    return {
        "abertas":       len(abertas),
        "teto":          regras["divida_teto"],
        "no_teto":       len(abertas) >= regras["divida_teto"],
        "abate_por_missao": regras["abate_por_missao"],
        "decaimento_dias":  regras["decaimento_dias"],
        "dias_para_decair": proximo_decaimento,
        "tem_pacto":     penitencia.tem_pacto(db, usuario.id),
    }


@router.get("/")
def dashboard(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    hoje = tempo.hoje()

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
