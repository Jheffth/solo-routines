"""
Router de Execuções — concluir rotinas recorrentes e obter histórico.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime, timedelta
from motors import tempo, prazos, economia, especiais

from database import get_db, Rotina, Execucao, ExecucaoDia, Usuario
from auth.router import get_usuario_atual
from motors.gamificacao import calcular_xp_rotina, aplicar_xp
from motors.celebracao import anexar

router = APIRouter(prefix="/execucoes", tags=["execucoes"])


class ConcluirRotinaRequest(BaseModel):
    rotina_id: int
    data_execucao: Optional[date] = None
    observacao: Optional[str] = None


@router.post("/rotina")
def concluir_rotina(
    payload: ConcluirRotinaRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Registra a conclusão de uma rotina, aplica XP e atualiza ExecucaoDia → CONCLUIDA."""
    rotina = db.query(Rotina).filter(
        Rotina.id == payload.rotina_id,
        Rotina.usuario_id == usuario.id,
        Rotina.ativo == True,
    ).first()
    if not rotina:
        raise HTTPException(404, "Rotina não encontrada")

    hoje = payload.data_execucao or tempo.hoje()

    # Evita duplo registro no mesmo dia
    ja_executou = db.query(Execucao).filter(
        Execucao.usuario_id == usuario.id,
        Execucao.rotina_id == rotina.id,
        Execucao.data_execucao == hoje,
    ).first()
    if ja_executou:
        raise HTTPException(400, "Esta rotina já foi concluída hoje!")

    rotina.ultima_execucao = hoje
    db.flush()

    # ── A instância do dia, que é quem sabe o prazo ───────
    ed = db.query(ExecucaoDia).filter(
        ExecucaoDia.rotina_id  == rotina.id,
        ExecucaoDia.usuario_id == usuario.id,
        ExecucaoDia.data       == hoje,
    ).first()
    if not ed:
        ed = ExecucaoDia(rotina_id=rotina.id, usuario_id=usuario.id, data=hoje)
        db.add(ed)
        db.flush()

    # QUANTO VALE CONCLUIR AGORA. Antes, concluir pagava o mesmo às 20:30 e às
    # 23:00 — o prazo da rotina não era consultado por ninguém na hora de
    # pagar, então a janela era pura decoração.
    p = prazos.da_execucao(ed, rotina)
    liq = economia.liquidacao(
        rotina,
        vencida=prazos.venceu(p),
        reerguida=bool(getattr(ed, "reerguida", False)),
    )

    resultado = aplicar_xp(
        db=db,
        usuario=usuario,
        xp_base=liq["xp"],
        moedas=liq["moedas"],
        hoje=hoje,
        rotina_id=rotina.id,
        observacao=payload.observacao or f"Rotina concluída: {rotina.titulo}",
    )

    # A punição do atraso é cobrada aqui, depois do crédito, para que o
    # level-up de aplicar_xp não veja um XP que já vai ser descontado.
    if liq["penalidade"]:
        usuario.xp_total = max(0, (usuario.xp_total or 0) - liq["penalidade"])
        usuario.xp_atual = max(0, (usuario.xp_atual or 0) - liq["penalidade"])
        ed.xp_perdido = liq["penalidade"]

    ed.status        = "CONCLUIDA"
    ed.concluida_em  = tempo.agora()
    ed.xp_ganho      = resultado.get("xp_ganho", 0) if isinstance(resultado, dict) else 0
    ed.moedas_ganhas = resultado.get("moedas_ganhas", 0) if isinstance(resultado, dict) else 0
    try:
        db.commit()
    except Exception:
        db.rollback()
    # ──────────────────────────────────────────────────────

    return anexar(
        {"rotina_id": rotina.id, "resultado": resultado, "liquidacao": liq},
        resultado,
    )


class ReerguerRequest(BaseModel):
    execucao_id: int


@router.post("/reerguer")
def reerguer(
    payload: ReerguerRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    A segunda chance que custa Mana.

    O Banho Revigorante fecha às 22:00. Se o hunter não tomou banho, o placar
    está certo em dizer que ele perdeu a corrida — mas ficar sem banho porque
    o relógio passou seria o app trabalhando contra o próprio propósito.
    Então ele paga Mana e a missão volta a ser jogável até as 23:59. À
    meia-noite nasce a de amanhã e esta deixa de importar.

    O que NÃO volta: a recompensa. Missão reerguida vale zero XP e zero Mana
    ao ser concluída. O ganho é o banho.
    """
    ed = db.query(ExecucaoDia).filter(
        ExecucaoDia.id == payload.execucao_id,
        ExecucaoDia.usuario_id == usuario.id,
    ).first()
    if not ed:
        raise HTTPException(404, "Missão não encontrada")

    rotina = db.query(Rotina).filter(Rotina.id == ed.rotina_id).first()
    if not rotina:
        raise HTTPException(404, "Rotina não encontrada")

    if ed.status != "FRACASSADA":
        raise HTTPException(400, "Só uma missão fracassada pode ser reerguida.")
    if getattr(ed, "reerguida", False):
        raise HTTPException(400, "Esta missão já foi reerguida uma vez.")
    if ed.data != tempo.hoje():
        raise HTTPException(400, "Só a missão de hoje pode ser reerguida — "
                                 "à meia-noite ela é substituída pela de amanhã.")
    # Só faz sentido para quem perdeu uma JANELA. Uma rotina de dia inteiro
    # que fracassou já viveu o dia inteiro; não há resto de dia para devolver.
    if not prazos.da_rotina(rotina, ed.data)["janela"]:
        raise HTTPException(400, "Só rotinas com janela de horário podem ser reerguidas.")

    custo = economia.custo_reerguer(db)
    if (usuario.moedas or 0) < custo:
        raise HTTPException(400, f"Mana insuficiente: são necessários {custo}.")

    usuario.moedas = (usuario.moedas or 0) - custo
    ed.status       = "PENDENTE"
    ed.reerguida    = True
    ed.reerguida_em = tempo.agora()
    ed.mana_gasta   = custo
    ed.fracassada_em = None
    ed.iniciada_em   = None      # PENDENTE não tem cronômetro correndo
    db.commit()

    return {
        "ok": True,
        "execucao_id": ed.id,
        "mana_gasta": custo,
        "mana_restante": usuario.moedas,
        "vale_ate": prazos.da_execucao(ed, rotina)["fim"].isoformat(),
        "mensagem": f"Missão reerguida por {custo} de Mana. "
                    "Vale até as 23:59 e não paga recompensa.",
    }


class ConfessarRequest(BaseModel):
    execucao_id: int
    observacao: Optional[str] = None


@router.post("/confessar")
def confessar(
    payload: ConfessarRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    "Eu quebrei o protocolo."

    A missão passiva se conclui sozinha ao fim da janela — "sem cafeína após
    as 16h" vence às 05:00 sem o hunter fazer nada. Este endpoint é o único
    jeito de ela falhar, e quem o aciona é o próprio hunter.

    NÃO HÁ COMO VERIFICAR. O servidor não sabe se ele tomou café; ninguém
    sabe. É por isso que confessar custa metade da punição e preserva o
    streak: a única defesa contra o autoengano é tornar a verdade barata.

    CONFISSÃO TARDIA. O protocolo é de sono — ele quebra às 04:00, dorme, e
    às 09:00 a missão já consta cumprida. Ele ainda precisa poder confessar,
    então a janela vai até o fim do dia seguinte. Nesse caso a recompensa já
    creditada é ESTORNADA, além da meia punição. Sem isso, a confissão só
    serviria para quem estivesse acordado no momento certo — e o
    arrependimento honesto chegaria sempre tarde demais.
    """
    ed = db.query(ExecucaoDia).filter(
        ExecucaoDia.id == payload.execucao_id,
        ExecucaoDia.usuario_id == usuario.id,
    ).first()
    if not ed:
        raise HTTPException(404, "Missão não encontrada")

    rotina = db.query(Rotina).filter(Rotina.id == ed.rotina_id).first()
    if not rotina:
        raise HTTPException(404, "Rotina não encontrada")

    if not especiais.eh_premium(getattr(rotina, "natureza", None)):
        raise HTTPException(400, "Só missões passivas podem ser confessadas. "
                                 "Numa missão comum, não concluir já é o desfecho.")
    if ed.status in ("FRACASSADA", "CONFESSADA", "CANCELADA"):
        raise HTTPException(400, "Esta missão já foi encerrada.")

    # NÃO SE CONFESSA O QUE AINDA NÃO COMEÇOU.
    # O protocolo "sem cafeína após as 16h" só entra em vigor às 16:00. Às
    # 11:59 não há o que quebrar — confessar ali seria registrar uma derrota
    # sobre um período que ainda não existe, e ainda cobraria a punição.
    p = prazos.da_execucao(ed, rotina)
    if not prazos.ja_abriu(p):
        h = p["inicio"].strftime("%H:%M")
        raise HTTPException(400, f"Este protocolo só entra em vigor às {h}. "
                                 "Não há o que confessar ainda.")

    # A janela do arrependimento: hoje ou ontem. Depois disso é história.
    limite = tempo.hoje() - timedelta(days=1)
    if ed.data < limite:
        raise HTTPException(400, "O prazo para confessar este protocolo já passou.")

    liq = economia.confissao(rotina)

    # Estorno do que a auto-conclusão já pagou (caso da confissão tardia).
    estorno_xp = ed.xp_ganho or 0
    estorno_mc = ed.moedas_ganhas or 0
    if estorno_xp or estorno_mc:
        usuario.xp_total = max(0, (usuario.xp_total or 0) - estorno_xp)
        usuario.xp_atual = max(0, (usuario.xp_atual or 0) - estorno_xp)
        usuario.moedas   = max(0, (usuario.moedas   or 0) - estorno_mc)

    if liq["penalidade"]:
        usuario.xp_total = max(0, (usuario.xp_total or 0) - liq["penalidade"])
        usuario.xp_atual = max(0, (usuario.xp_atual or 0) - liq["penalidade"])

    ed.status        = "CONFESSADA"
    ed.confessada_em = tempo.agora()
    ed.concluida_em  = None
    ed.xp_ganho      = 0
    ed.moedas_ganhas = 0
    ed.xp_perdido    = liq["penalidade"]

    # O nível pode ter caído com o estorno; devolve-o ao lugar certo.
    try:
        from motors.gamificacao import recalcular_nivel
        recalcular_nivel(db, usuario)
    except Exception:
        pass

    db.commit()

    return {
        "ok": True,
        "execucao_id": ed.id,
        "liquidacao": liq,
        "estornado_xp": estorno_xp,
        "estornado_moedas": estorno_mc,
        "streak_atual": usuario.streak_atual,
        "mensagem": (f"Confissão registrada. −{liq['penalidade']} XP "
                     f"(metade da punição). Sua sequência continua intacta."),
    }


@router.get("/historico")
def historico(
    dias: int = 30,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Histórico das últimas execuções do usuário."""
    from datetime import timedelta
    desde = tempo.hoje() - timedelta(days=dias)
    execs = db.query(Execucao).filter(
        Execucao.usuario_id == usuario.id,
        Execucao.data_execucao >= desde,
    ).order_by(Execucao.data_execucao.desc()).limit(200).all()

    return [
        {
            "id":            e.id,
            "rotina_id":     e.rotina_id,
            "tarefa_id":     e.tarefa_id,
            "data":          e.data_execucao.isoformat(),
            "xp_ganho":      e.xp_ganho,
            "moedas_ganhas": e.moedas_ganhas,
            "streak":        e.streak_na_hora,
            "bonus_streak":  e.bonus_streak,
        }
        for e in execs
    ]


@router.get("/heatmap")
def heatmap(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    Retorna dados para o heatmap anual (estilo GitHub):
    { "YYYY-MM-DD": total_execucoes }
    """
    from datetime import timedelta
    from collections import defaultdict

    um_ano_atras = tempo.hoje() - timedelta(days=365)
    execs = db.query(
        Execucao.data_execucao,
    ).filter(
        Execucao.usuario_id == usuario.id,
        Execucao.data_execucao >= um_ano_atras,
    ).all()

    mapa: dict[str, int] = defaultdict(int)
    for (d,) in execs:
        mapa[d.isoformat()] += 1

    return dict(mapa)
