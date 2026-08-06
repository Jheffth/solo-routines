"""
Router de Execuções — concluir rotinas recorrentes e obter histórico.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime, timedelta
from motors import tempo, prazos, economia, especiais

from database import get_db, Rotina, Execucao, ExecucaoDia, TarefaDia, Usuario
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

    return anexar(*_liquidar(db, usuario, rotina, hoje, payload.observacao))


def _liquidar(db: Session, usuario: Usuario, rotina: Rotina, hoje: date,
              observacao: Optional[str] = None):
    """
    O NÚCLEO DA CONCLUSÃO — prazo, liquidação, XP, punição e carimbo.

    Era o corpo do `concluir_rotina` e virou função porque a missão de
    repetição em modo META precisa concluir a rotina sozinha ao bater o
    alvo, e ela tem que concluir do MESMO jeito: mesmo cálculo de
    prazo, mesma punição por atraso, mesmo streak.

    Copiar estas cinquenta linhas para o outro endpoint teria criado a
    sexta segunda-verdade deste projeto — e a divergência apareceria
    devagar, num ajuste da Balança que só um dos dois caminhos honra.

    Devolve `(corpo, resultado)` já pronto para o `anexar()`.
    """
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
        observacao=observacao or f"Rotina concluída: {rotina.titulo}",
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

    # PROGRESSIVA ATIVA: dia concluído = +1 na corrente do desafio.
    # A lógica vive aqui (na conclusão), nunca no fechamento: a passiva
    # conta pelo SILENCIO (día que passou sem confissão); a ativa conta
    # pelo ATO (o hunter clicou Concluir). Dois momentos diferentes.
    if getattr(rotina, "eh_progressiva", False) and rotina.natureza != especiais.PASSIVA:
        try:
            rotina.dias_progressivos_ok = (rotina.dias_progressivos_ok or 0) + 1
            alvo = rotina.dias_progressivos_alvo or 0
            if alvo and rotina.dias_progressivos_ok >= alvo:
                # VITÓRIA DO DESAFIO. A rotina se conclui de forma permanente.
                rotina.ativo        = False
                rotina.status       = "CONCLUIDA"
                rotina.concluida_em = ed.concluida_em
        except Exception as exc:
            print(f"[EXECUCOES] ⚠ progressiva ativa {rotina.id}: {exc}")

    try:
        db.commit()
    except Exception:
        db.rollback()
    # ─────────────────────────────────────────────────────

    return ({"rotina_id": rotina.id, "resultado": resultado, "liquidacao": liq,
             # O frontend precisa saber se a corrente está encerrada (vitoriosa
             # ou fatal) para mostrar a tela de encerrament sem recarregar.
             "progressiva": {
                 "ok": rotina.dias_progressivos_ok if getattr(rotina, "eh_progressiva", False) else None,
                 "alvo": rotina.dias_progressivos_alvo,
                 "concluida": rotina.status == "CONCLUIDA" and not rotina.ativo,
             } if getattr(rotina, "eh_progressiva", False) else None,
             },
            resultado)


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
    # UMA PROGRESSIVA NÃO PODE SER REERGUIDA. A dureza do desafio é
    # exatamente o que o torna valioso: falhou um dia, a corrente acabou.
    # Oferecer reerguer quebraria a promessa que o hunter fez consigo mesmo.
    if getattr(rotina, "eh_progressiva", False):
        raise HTTPException(400, "Missões progressivas não podem ser reerguidas. "
                                 "A corrente exige que todos os dias sejam cumpridos.")
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

    # REERGUER DESFEZ O FRACASSO — então a penitência dele deixa de
    # existir. Pagar Mana para reabrir a missão E ainda carregar a
    # dívida seria cobrar duas vezes pela mesma falha.
    revogadas = 0
    try:
        from motors import penitencia
        revogadas = penitencia.revogar(db, usuario.id, rotina.titulo, ed.data)
    except Exception as e:
        print(f"[REERGUER] revogacao adiada: {e}")

    db.commit()

    return {
        "ok": True,
        "execucao_id": ed.id,
        "mana_gasta": custo,
        "mana_restante": usuario.moedas,
        "vale_ate": prazos.da_execucao(ed, rotina)["fim"].isoformat(),
        "penitencias_revogadas": revogadas,
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

    CONFESSAR NÃO GERA PENITÊNCIA. Este app já premia honestidade com
    metade da punição, e punir quem admitiu ensinaria a não admitir. O
    fechamento nunca vê esta missão como falha, então a regra se
    sustenta sozinha — mas está escrita aqui para não virar implícita.

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

    # PROGRESSIVA PASSIVA: confessar encerra o desafio definitivamente.
    # Não há reerguer, não há segunda chance — é esta dureza que dá
    # significado a cada dia que passou sem confissão.
    eh_fatal = False
    if getattr(rotina, "eh_progressiva", False):
        especiais.aplicar_fatal_failure(db, rotina, tempo.agora())
        eh_fatal = True

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
        "fatal_failure": eh_fatal,
        "mensagem": (
            "DESAFIO ENCERRADO. A corrente foi quebrada." if eh_fatal
            else f"Confissão registrada. −{liq['penalidade']} XP "
                 f"(metade da punição). Sua sequência continua intacta."
        ),
    }


class ResponderCondicicionalRequest(BaseModel):
    # Novo formato (frontend manda rotina_id + vitoria)
    rotina_id:   Optional[int]  = None
    vitoria:     Optional[bool] = None
    # Formato legado (execucao_id + ramo)
    execucao_id: Optional[int]  = None
    ramo:        Optional[str]  = None   # "A" ou "B"


@router.post("/responder")
def responder_condicional(
    payload: ResponderCondicicionalRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    O DESVIO DA MISSÃO CONDICIONAL.

    A missão condicional não tem fracasso automático — ela tem uma PERGUNTA.
    Ao concluir, o hunter escolhe o ramo que corresponde ao que aconteceu:

      Ramo A → cumpriu a condição (XP integral, ou bônus)
      Ramo B → não cumpriu, mas admite (XP reduzido, sem punição dupla)

    AMBOS OS RAMOS CONCLUEM A MISSÃO. A diferença é o quanto cada honestidade
    recebe. Isso encoraja o registro real em vez do silêncio conveniente.

    Aceita dois formatos:
      • Novo:   { rotina_id, vitoria: bool }   — frontend manda após dialog
      • Legado: { execucao_id, ramo: "A"|"B" } — retrocompat
    """
    # Resolve ramo a partir de qualquer dos dois formatos
    if payload.vitoria is not None:
        ramo = "A" if payload.vitoria else "B"
    elif payload.ramo:
        ramo = (payload.ramo or "A").upper()
    else:
        raise HTTPException(400, "Informe 'vitoria' (bool) ou 'ramo' (A/B).")

    if ramo not in ("A", "B"):
        raise HTTPException(400, "Ramo deve ser 'A' ou 'B'.")

    # Resolve ExecucaoDia
    if payload.rotina_id:
        hoje = tempo.hoje()
        ed = db.query(ExecucaoDia).filter(
            ExecucaoDia.rotina_id  == payload.rotina_id,
            ExecucaoDia.usuario_id == usuario.id,
            ExecucaoDia.data       == hoje,
        ).first()
        if not ed:
            raise HTTPException(404, "Execução de hoje não encontrada para esta rotina.")
        rotina = db.query(Rotina).filter(Rotina.id == payload.rotina_id).first()
    elif payload.execucao_id:
        ed = db.query(ExecucaoDia).filter(
            ExecucaoDia.id         == payload.execucao_id,
            ExecucaoDia.usuario_id == usuario.id,
        ).first()
        if not ed:
            raise HTTPException(404, "Execução não encontrada")
        rotina = db.query(Rotina).filter(Rotina.id == ed.rotina_id).first()
    else:
        raise HTTPException(400, "Informe rotina_id ou execucao_id.")

    if not rotina:
        raise HTTPException(404, "Rotina não encontrada")

    if not especiais.eh_condicional(getattr(rotina, "natureza", None)):
        raise HTTPException(400, "Esta missão não é condicional.")


    if ed.status in ("CONCLUIDA", "FRACASSADA", "CONFESSADA", "CANCELADA"):
        raise HTTPException(400, "Esta execução já foi encerrada.")

    # Lê o payload da condição para aplicar o bônus do ramo escolhido.
    import json as _json
    cond = {}
    try:
        cond = _json.loads(rotina.condicional_payload or "{}") if rotina.condicional_payload else {}
    except Exception:
        pass

    chave = "opcao_a" if ramo == "A" else "opcao_b"
    opcao = cond.get(chave) or {}

    # ══ O RAMO GERA UMA MISSÃO ═════════════════════════════════════
    #
    # ERA AQUI QUE A FUNCIONALIDADE FALTAVA. A versão anterior lia um
    # `xp_bonus` — um número — e concluía a própria pergunta com XP
    # somado. Nunca criava nada. O pedido do Arquiteto era outro:
    # "o card pergunta vira o container da missão, os cards de
    # consequência carregam a missão e os espólios".
    #
    # Então responder INSTANCIA a missão que o ramo carrega. A pergunta
    # não paga XP nenhum: ela não é esforço, é bifurcação — pagar aqui
    # e de novo na missão gerada seria recompensar duas vezes o mesmo
    # ato.
    #
    # A missão nasce como TarefaDia de HOJE (avulsa). Se um dia ela
    # precisar ser recorrente, o lugar é criar uma Rotina a partir do
    # mesmo payload — o formato já comporta, e por isso `missao` é um
    # objeto e não campos soltos.
    spec = opcao.get("missao") or {}
    gerada = None
    if spec.get("titulo"):
        gerada = TarefaDia(
            titulo=str(spec["titulo"])[:200],
            descricao=(spec.get("descricao") or None),
            data_prevista=tempo.hoje(),
            prioridade=(spec.get("prioridade") or rotina.prioridade or "MEDIA"),
            categoria=(spec.get("categoria") or rotina.categoria or "Pessoal"),
            status="PENDENTE",
            usuario_id=usuario.id,
            xp_recompensa=max(0, int(spec.get("xp") or 0)),
            moedas_recompensa=max(0, int(spec.get("moedas") or 0)),
            penalidade_xp=max(0, int(spec.get("penalidade_xp") or 0)),
            hora_inicio=(spec.get("hora_inicio") or None),
            hora_limite=(spec.get("hora_fim") or None),
            prazo_minutos=(int(spec["prazo_minutos"])
                           if spec.get("prazo_minutos") else None),
        )
        # O carimbo de origem, num JSON só. É o que faz o cartão desenhar
        # o fio até a pergunta em vez de aparecer como tarefa órfã.
        gerada.origem_condicional = _json.dumps({
            "pergunta": (cond.get("pergunta") or "")[:200],
            "resposta": (opcao.get("txt") or "")[:60],
            "ramo": ramo,
        }, ensure_ascii=False)
        db.add(gerada)
        db.flush()

    xp_bonus = 0

    # Conclusão normal pelo liquidar, depois ajuste de bônus.
    # A missão é SEMPRE concluída — a condicional não pune, bifurca.
    # A PERGUNTA NÃO PAGA. O espólio mora na missão gerada — está no
    # cartão, e prometer dos dois lados seria pagar duas vezes o mesmo
    # ato. Mantemos a chamada porque ela também registra o evento no
    # extrato; o que zera é o valor.
    resultado = aplicar_xp(
        db=db, usuario=usuario,
        xp_base=0 if gerada else max(0, (rotina.xp_recompensa or 0) + xp_bonus),
        moedas=0 if gerada else (rotina.moedas_recompensa or 0),
        hoje=ed.data or tempo.hoje(),
        rotina_id=rotina.id,
        observacao=f"Missão condicional (ramo {ramo}): {rotina.titulo}",
    )

    ed.status               = "CONCLUIDA"
    ed.concluida_em         = tempo.agora()
    ed.xp_ganho             = (resultado or {}).get("xp_ganho", 0)
    ed.moedas_ganhas        = (resultado or {}).get("moedas_ganhas", 0)
    ed.resposta_condicional = ramo
    ed.condicional_vitoria  = (ramo == "A")

    db.commit()

    return {
        "ok": True,
        "execucao_id": ed.id,
        "ramo": ramo,
        "xp_ganho": ed.xp_ganho,
        "xp_bonus": xp_bonus,
        "gerada": ({"id": gerada.id, "titulo": gerada.titulo} if gerada else None),
        "mensagem": opcao.get("txt", f"Ramo {ramo} registrado."),
        "resultado": resultado,
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


# ══════════════════════════════════════════════════════════════════════
#  ROTINA DE REPETIÇÕES
#
#  Dois modos, e a diferença entre eles não é cosmética:
#
#  META  (alvo_repeticoes preenchido)
#      "Responder 5 questões." Os cliques só CONTAM. Ao bater o alvo, a
#      rotina é concluída pelo caminho normal — mesmo prazo, mesmo
#      streak, mesma punição por atraso. Ela é uma missão de verdade.
#
#  BÔNUS (alvo_repeticoes nulo)
#      "Quantos copos de água eu bebi?" Não tem fim, então não pode ter
#      cobrança: NÃO conta streak e NÃO pune. Paga um XP pequeno por
#      clique, com teto por clique e teto diário POR CONTADOR.
#
#  O teto e o intervalo mínimo moram AQUI, no servidor. No cliente eles
#  seriam uma sugestão — e o primeiro `curl` faria XP do nada.
# ══════════════════════════════════════════════════════════════════════

class RepetirRequest(BaseModel):
    # UM DOS DOIS. A repeticao existe nas duas frentes: como rotina, que
    # tem instancia diaria, e como missao geral, que acontece uma vez e
    # guarda a contagem em si mesma.
    rotina_id: Optional[int] = None
    tarefa_id: Optional[int] = None


def _rotina_de_repeticao(db: Session, usuario: Usuario, rotina_id: int) -> Rotina:
    rotina = db.query(Rotina).filter(
        Rotina.id == rotina_id,
        Rotina.usuario_id == usuario.id,
        Rotina.ativo == True,
    ).first()
    if not rotina:
        raise HTTPException(404, "Rotina não encontrada")
    if especiais.normalizar(getattr(rotina, "natureza", None)) != especiais.REPETICAO:
        raise HTTPException(400, "Esta rotina não é uma rotina de repetições")
    return rotina


def _execucao_do_dia(db: Session, usuario: Usuario, rotina: Rotina, hoje: date) -> ExecucaoDia:
    ed = db.query(ExecucaoDia).filter(
        ExecucaoDia.rotina_id  == rotina.id,
        ExecucaoDia.usuario_id == usuario.id,
        ExecucaoDia.data       == hoje,
    ).first()
    if not ed:
        ed = ExecucaoDia(rotina_id=rotina.id, usuario_id=usuario.id,
                         data=hoje, status="ATIVA", repeticoes=0,
                         xp_repeticao_pago=0)
        db.add(ed)
        db.flush()
    return ed


def _pago_pelos_outros(db: Session, rotina: Rotina, hoje: date) -> int:
    """
    Quanto as OUTRAS rotinas do mesmo contador já pagaram hoje.

    A consulta filtra por `contador_id` e MAIS NADA — sem `usuario_id`.
    É essa ausência, e só ela, que faz um contador de guilda somar
    certo no dia em que ele existir, sem reescrever nada aqui.

    Rotina sem contador não divide teto com ninguém: ela é o próprio
    balde.
    """
    if not getattr(rotina, "contador_id", None):
        return 0
    from sqlalchemy import func
    das_rotinas = (db.query(func.sum(ExecucaoDia.xp_repeticao_pago))
                     .join(Rotina, Rotina.id == ExecucaoDia.rotina_id)
                     .filter(Rotina.contador_id == rotina.contador_id,
                             ExecucaoDia.data == hoje,
                             ExecucaoDia.rotina_id != rotina.id)
                     .scalar()) or 0
    # AS MISSOES GERAIS DO MESMO BALDE TAMBEM CONSOMEM A COTA. Esquecer
    # esta metade daria um teto por natureza em vez de por contador — e
    # o vazamento seria de 30 XP por dia, silencioso.
    das_tarefas = (db.query(func.sum(TarefaDia.xp_repeticao_pago))
                     .filter(TarefaDia.contador_id == rotina.contador_id,
                             TarefaDia.id != getattr(rotina, "_tarefa_atual", -1))
                     .scalar()) or 0
    return int(das_rotinas) + int(das_tarefas)


def _tarefa_de_repeticao(db: Session, usuario: Usuario, tarefa_id: int) -> TarefaDia:
    t = db.query(TarefaDia).filter(TarefaDia.id == tarefa_id,
                                   TarefaDia.usuario_id == usuario.id).first()
    if not t:
        raise HTTPException(404, "Missao nao encontrada")
    if especiais.normalizar(getattr(t, "natureza", None)) not in (especiais.REPETICAO, especiais.PUNICAO):
        raise HTTPException(400, "Esta missao nao e uma missao de repeticoes")
    return t


def _mover(db: Session, usuario: Usuario, rotina_id: int, passo: int,
           tarefa_id: int = None) -> dict:
    """
    Soma ou desfaz uma repeticao — na rotina ou na missao geral.

    O CORPO E O MESMO PARA AS DUAS, e isso nao e economia de linhas: e o
    que impede o teto de valer numa e nao na outra. A unica diferenca e
    ONDE mora a contagem, e ela se resolve em tres linhas.

      ROTINA        na `ExecucaoDia` de hoje (a rotina se repete, entao
                    cada dia tem o seu numero)
      MISSAO GERAL  na propria tarefa (ela acontece uma vez; nao ha dia
                    para separar)
    """
    if tarefa_id:
        return _mover_tarefa(db, usuario, tarefa_id, passo)
    rotina = _rotina_de_repeticao(db, usuario, rotina_id)
    hoje   = tempo.hoje()
    ed     = _execucao_do_dia(db, usuario, rotina, hoje)

    antes = int(ed.repeticoes or 0)
    if passo < 0 and antes == 0:
        raise HTTPException(400, "Não há repetição para desfazer hoje")

    # O INTERVALO MÍNIMO, se a rotina pedir um. Só vale para somar:
    # corrigir um erro nunca deve ficar bloqueado por espera.
    if passo > 0 and (rotina.intervalo_min_seg or 0) > 0 and ed.ultima_repeticao_em:
        espera = int(rotina.intervalo_min_seg)
        falta  = espera - (tempo.agora() - ed.ultima_repeticao_em).total_seconds()
        if falta > 0:
            raise HTTPException(429, f"Espere {int(falta) + 1}s para a próxima")

    depois = max(0, antes + passo)
    ed.repeticoes = depois

    alvo    = getattr(rotina, "alvo_repeticoes", None)
    eh_meta = bool(alvo and int(alvo) > 0)
    resultado, xp_delta = None, 0

    if not eh_meta:
        # BÔNUS. Recalcula o total devido e move só a diferença — ver o
        # porquê em `economia.xp_acumulado_repeticao`.
        outros = _pago_pelos_outros(db, rotina, hoje)
        devido = economia.xp_acumulado_repeticao(depois, outros, db)
        xp_delta = devido - int(ed.xp_repeticao_pago or 0)
        ed.xp_repeticao_pago = devido

        if xp_delta > 0:
            # Sem streak e sem linha de histórico: os dois motivos estão
            # documentados em `gamificacao.aplicar_xp`.
            resultado = aplicar_xp(
                db=db, usuario=usuario, xp_base=xp_delta, moedas=0, hoje=hoje,
                rotina_id=rotina.id, observacao=f"Repetição: {rotina.titulo}",
                conta_streak=False, registrar_execucao=False,
            )
        elif xp_delta < 0:
            usuario.xp_total = max(0, (usuario.xp_total or 0) + xp_delta)
            usuario.xp_atual = max(0, (usuario.xp_atual or 0) + xp_delta)

    if passo > 0:
        ed.ultima_repeticao_em = tempo.agora()

    # META CUMPRIDA. Conclui pelo caminho de sempre — e só uma vez: o
    # `status` é a trava, então desfazer e refazer não paga duas vezes.
    cumpriu = eh_meta and depois >= int(alvo) and ed.status != "CONCLUIDA"
    if cumpriu:
        corpo, resultado = _liquidar(
            db, usuario, rotina, hoje,
            observacao=f"{rotina.titulo} — {depois}/{alvo}")
    else:
        try:
            db.commit()
        except Exception:
            db.rollback()

    total_contador = None
    if getattr(rotina, "contador_id", None):
        from routers.contadores import total_de
        total_contador = total_de(db, rotina.contador_id)

    corpo = {
        "rotina_id":      rotina.id,
        "repeticoes":     depois,
        "alvo":           int(alvo) if eh_meta else None,
        "modo":           "META" if eh_meta else "BONUS",
        "xp_ganho":       xp_delta,
        "xp_pago_hoje":   int(ed.xp_repeticao_pago or 0),
        "meta_cumprida":  bool(cumpriu),
        "status":         ed.status,
        "total_contador": total_contador,
        "resultado":      resultado,
    }
    return anexar(corpo, resultado) if resultado else corpo


@router.post("/repetir")
def repetir(payload: RepetirRequest, db: Session = Depends(get_db),
            usuario: Usuario = Depends(get_usuario_atual)):
    """+1 repeticao — na rotina de hoje ou na missao geral."""
    if not payload.rotina_id and not payload.tarefa_id:
        raise HTTPException(400, "Informe rotina_id ou tarefa_id")
    return _mover(db, usuario, payload.rotina_id, +1, payload.tarefa_id)


@router.post("/desfazer-repeticao")
def desfazer_repeticao(payload: RepetirRequest, db: Session = Depends(get_db),
                       usuario: Usuario = Depends(get_usuario_atual)):
    """-1 repeticao. Devolve exatamente o que aquele clique pagou."""
    if not payload.rotina_id and not payload.tarefa_id:
        raise HTTPException(400, "Informe rotina_id ou tarefa_id")
    return _mover(db, usuario, payload.rotina_id, -1, payload.tarefa_id)


def _mover_tarefa(db: Session, usuario: Usuario, tarefa_id: int, passo: int) -> dict:
    """
    A mesma regra da rotina, com a contagem na própria missão.

    O que MUDA em relação à rotina, e por quê:

      · a contagem mora na tarefa (ela acontece uma vez; não há dia
        para separar);
      · o teto diário é o teto DELA — uma missão geral vive um dia, e o
        `xp_repeticao_pago` dela já é "o que pagou hoje";
      · ao bater a meta, ela conclui pela rota da própria tarefa, não
        pelo `_liquidar` da rotina.

    O que NÃO muda, e é o ponto: os dois tetos, o intervalo mínimo, o
    recálculo no desfazer, e o BÔNUS não mexendo em streak nem no
    histórico. Nenhum deles pode valer numa frente e não na outra.
    """
    t = _tarefa_de_repeticao(db, usuario, tarefa_id)
    hoje = tempo.hoje()

    antes = int(t.repeticoes or 0)
    if passo < 0 and antes == 0:
        raise HTTPException(400, "Não há repetição para desfazer")

    if passo > 0 and (t.intervalo_min_seg or 0) > 0 and t.ultima_repeticao_em:
        falta = int(t.intervalo_min_seg) - (tempo.agora() - t.ultima_repeticao_em).total_seconds()
        if falta > 0:
            raise HTTPException(429, f"Espere {int(falta) + 1}s para a próxima")

    depois = max(0, antes + passo)
    t.repeticoes = depois

    alvo    = t.alvo_repeticoes
    eh_meta = bool(alvo and int(alvo) > 0)
    resultado, xp_delta = None, 0

    if not eh_meta:
        # O TETO POR CONTADOR vale aqui também. Uma missão geral e uma
        # rotina no mesmo balde dividem a mesma cota — senão bastaria
        # criar as duas para dobrar o XP do dia.
        outros = 0
        if t.contador_id:
            outros_rot = (db.query(func.sum(ExecucaoDia.xp_repeticao_pago))
                            .join(Rotina, Rotina.id == ExecucaoDia.rotina_id)
                            .filter(Rotina.contador_id == t.contador_id,
                                    ExecucaoDia.data == hoje).scalar()) or 0
            outras_tar = (db.query(func.sum(TarefaDia.xp_repeticao_pago))
                            .filter(TarefaDia.contador_id == t.contador_id,
                                    TarefaDia.id != t.id).scalar()) or 0
            outros = int(outros_rot) + int(outras_tar)

        devido = economia.xp_acumulado_repeticao(depois, outros, db)
        xp_delta = devido - int(t.xp_repeticao_pago or 0)
        t.xp_repeticao_pago = devido

        if xp_delta > 0:
            resultado = aplicar_xp(
                db=db, usuario=usuario, xp_base=xp_delta, moedas=0, hoje=hoje,
                tarefa_id=t.id, observacao=f"Repetição: {t.titulo}",
                conta_streak=False, registrar_execucao=False,
            )
        elif xp_delta < 0:
            usuario.xp_total = max(0, (usuario.xp_total or 0) + xp_delta)
            usuario.xp_atual = max(0, (usuario.xp_atual or 0) + xp_delta)

    if passo > 0:
        t.ultima_repeticao_em = tempo.agora()

    cumpriu = eh_meta and depois >= int(alvo) and t.status != "CONCLUIDA"
    if cumpriu:
        liq = economia.liquidacao_tarefa(t, vencida=False) if hasattr(economia, "liquidacao_tarefa") else None
        xp  = liq["xp"] if liq else (t.xp_recompensa or 0)
        mc  = liq["moedas"] if liq else (t.moedas_recompensa or 0)
        resultado = aplicar_xp(db=db, usuario=usuario, xp_base=xp, moedas=mc,
                               hoje=hoje, tarefa_id=t.id,
                               observacao=f"{t.titulo} — {depois}/{alvo}")
        t.status = "CONCLUIDA"
        t.concluida_em = tempo.agora()

    try:
        db.commit()
    except Exception:
        db.rollback()

    total_contador = None
    if t.contador_id:
        from routers.contadores import total_de
        total_contador = total_de(db, t.contador_id)

    corpo = {
        "tarefa_id":      t.id,
        "repeticoes":     depois,
        "alvo":           int(alvo) if eh_meta else None,
        "modo":           "META" if eh_meta else "BONUS",
        "xp_ganho":       xp_delta,
        "xp_pago_hoje":   int(t.xp_repeticao_pago or 0),
        "meta_cumprida":  bool(cumpriu),
        "status":         t.status,
        "total_contador": total_contador,
        "resultado":      resultado,
    }
    return anexar(corpo, resultado) if resultado else corpo
