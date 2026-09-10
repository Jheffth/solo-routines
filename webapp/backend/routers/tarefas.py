"""
Router de Tarefas do Dia — Missões Avulsas com prazo e prioridade.
Ciclo de vida: PENDENTE → ATIVA → CONCLUIDA | CANCELADA
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from motors import tempo
from motors import economia, prazos, especiais
from routers.rotinas import _contador_valido

from database import get_db, TarefaDia, Usuario
from auth.router import get_usuario_atual
from motors.gamificacao import calcular_xp_tarefa, aplicar_xp
from motors.celebracao import anexar

router = APIRouter(prefix="/tarefas", tags=["tarefas"])


class TarefaCreate(BaseModel):
    titulo: str
    descricao: Optional[str] = None
    data_prevista: date
    hora_limite: Optional[str] = None   # "HH:MM"
    prioridade: str = "MEDIA"           # CRITICA | ALTA | MEDIA | BAIXA
    categoria: str = "Pessoal"
    dificuldade: str = "NORMAL"         # FACIL | NORMAL | DIFICIL | LENDARIO
    xp_recompensa: Optional[int] = None
    moedas_recompensa: Optional[int] = None
    penalidade_xp: int = 0
    # MODALIDADE PERSONALIZADA: o hunter escolhe QUANTO TEMPO a missão dura —
    # e SÓ isso. O prazo é a única alavanca que ele tem; XP, Mana e punição
    # continuam saindo da tabela do servidor, indiferentes ao prazo escolhido.
    # Uma missão de 300 dias vale o mesmo que a de 30 minutos com a mesma
    # prioridade e dificuldade. Se prazo maior pagasse mais, criar missões de
    # um ano viraria a nova porta do exploit de 999.999 XP.
    prazo_minutos: Optional[int] = None
    # AS NATUREZAS NA MISSAO GERAL. Um protocolo para a vespera de uma
    # prova e um contador usado "vez ou outra" sao missoes gerais, nao
    # rotinas — recorrencia e natureza sao eixos independentes.
    natureza: Optional[str] = None            # ATIVA | PASSIVA | REPETICAO
    hora_inicio: Optional[str] = None         # janela da passiva
    alvo_repeticoes: Optional[int] = None
    contador_id: Optional[int] = None
    # SEM `xp_por_repeticao`: quem precifica e a Balanca.
    intervalo_min_seg: Optional[int] = None


class TarefaUpdate(BaseModel):
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    data_prevista: Optional[date] = None
    hora_limite: Optional[str] = None
    prioridade: Optional[str] = None
    categoria: Optional[str] = None
    dificuldade: Optional[str] = None
    status: Optional[str] = None
    xp_recompensa: Optional[int] = None
    moedas_recompensa: Optional[int] = None
    penalidade_xp: Optional[int] = None
    prazo_minutos: Optional[int] = None
    natureza: Optional[str] = None
    hora_inicio: Optional[str] = None
    alvo_repeticoes: Optional[int] = None
    contador_id: Optional[int] = None
    # SEM `xp_por_repeticao`: quem precifica e a Balanca.
    intervalo_min_seg: Optional[int] = None


def _tarefa_to_dict(t: TarefaDia) -> dict:
    return {
        "id":                t.id,
        "titulo":            t.titulo,
        "descricao":         t.descricao,
        "data_prevista":     t.data_prevista.isoformat() if t.data_prevista else None,
        "hora_limite":       t.hora_limite,
        "prioridade":        t.prioridade,
        "categoria":         t.categoria,
        "dificuldade":       getattr(t, "dificuldade", "NORMAL") or "NORMAL",
        "status":            t.status,
        "xp_recompensa":     t.xp_recompensa,
        "moedas_recompensa": t.moedas_recompensa,
        "penalidade_xp":     t.penalidade_xp,
        "usuario_id":        t.usuario_id,
        "criado_em":         t.criado_em.isoformat() if t.criado_em else None,
        "prazo_minutos":     getattr(t, "prazo_minutos", None),
        "prazo_personalizado": bool(getattr(t, "prazo_personalizado", False)),
        "iniciada_em":       t.iniciada_em.isoformat() if getattr(t, "iniciada_em", None) else None,
        "concluida_em":      t.concluida_em.isoformat() if t.concluida_em else None,
        # AS NATUREZAS. O cartao le exatamente estes nomes — sao os mesmos
        # da rotina de proposito: um so componente desenha os dois, e a
        # missao geral nao vira um segundo dialeto.
        "natureza":          getattr(t, "natureza", "ATIVA") or "ATIVA",
        "hora_inicio":       getattr(t, "hora_inicio", None),
        # `hora_fim` NAO e coluna nova: a missao geral ja tinha o
        # `hora_limite`, e e ele que fecha a janela. Duplicar seria criar
        # duas verdades sobre o mesmo horario.
        "hora_fim":          t.hora_limite,
        "confessada_em":     t.confessada_em.isoformat() if getattr(t, "confessada_em", None) else None,
        "alvo_repeticoes":   getattr(t, "alvo_repeticoes", None),
        "contador_id":       getattr(t, "contador_id", None),
        "repeticoes":        (getattr(t, "repeticoes", 0) or 0),
        # PENITENCIA — o cartao precisa dizer por qual falha ela veio.
        # Uma punicao anonima e arbitraria; nomear a falha a torna justa.
        "origem_titulo":     getattr(t, "origem_titulo", None),
        "origem_data":       t.origem_data.isoformat() if getattr(t, "origem_data", None) else None,
        "xp_a_reparar":      getattr(t, "xp_a_reparar", 0) or 0,
    }


def _get_ou_404(tarefa_id: int, usuario: Usuario, db: Session) -> TarefaDia:
    t = db.query(TarefaDia).filter(
        TarefaDia.id == tarefa_id,
        TarefaDia.usuario_id == usuario.id
    ).first()
    if not t:
        raise HTTPException(404, "Tarefa não encontrada")
    return t


# ── Leitura ───────────────────────────────────────────────────────────────────

@router.get("/")
def listar_tarefas(
    data: Optional[date] = None,
    inicio: Optional[date] = None,
    fim: Optional[date] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    As missões gerais. SEM FILTRO, DEVOLVE TUDO.

    `inicio`/`fim` são o recorte por intervalo; `data` continua existindo
    para o dia exato — há chamadas antigas que o usam, e tirá-lo
    quebraria o `/tarefas/hoje` da agenda sem ganhar nada.

    A ORDEM É DECRESCENTE, e isso não é detalhe. Crescente colocava
    agosto no topo e a missão de ontem no fim de uma lista de trinta e
    cinco — quem abre a aba quer ver o que é recente.
    """
    q = db.query(TarefaDia).filter(TarefaDia.usuario_id == usuario.id)
    if data:
        q = q.filter(TarefaDia.data_prevista == data)
    if inicio:
        q = q.filter(TarefaDia.data_prevista >= inicio)
    if fim:
        q = q.filter(TarefaDia.data_prevista <= fim)
    if status:
        q = q.filter(TarefaDia.status == status.upper())
    return [_tarefa_to_dict(t) for t in
            q.order_by(TarefaDia.data_prevista.desc(), TarefaDia.id.desc()).all()]


@router.get("/hoje")
def tarefas_de_hoje(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    hoje = tempo.hoje()
    tarefas = db.query(TarefaDia).filter(
        TarefaDia.usuario_id == usuario.id,
        TarefaDia.data_prevista == hoje,
    ).order_by(TarefaDia.id).all()
    return [_tarefa_to_dict(t) for t in tarefas]


@router.get("/{tarefa_id}/dossie")
def dossie_tarefa(
    tarefa_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    A ficha da missão geral.

    Não é a mesma forma da rotina, de propósito: uma missão geral
    acontece UMA vez. Devolver taxa de 0% e corrente de 0 faria uma
    missão cumprida parecer um fracasso.
    """
    from motors import dossie as motor_dossie
    return motor_dossie.de_tarefa(db, usuario,
                                  _get_ou_404(tarefa_id, usuario, db), tempo.hoje())


@router.get("/{tarefa_id}")
def obter_tarefa(
    tarefa_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    return _tarefa_to_dict(_get_ou_404(tarefa_id, usuario, db))


# ── Criação ───────────────────────────────────────────────────────────────────

@router.post("/", status_code=201)
def criar_tarefa(
    payload: TarefaCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    # QUEM PRECIFICA É O SERVIDOR. O `xp_recompensa` que o cliente mandou é
    # ignorado de propósito: aceitá-lo permitia pedir uma missão de 999.999 XP
    # e ir ao nível 100 numa requisição. O cliente diz o que a missão É; o
    # valor sai da tabela em motors/economia.py.
    valores = economia.recompensa_tarefa(payload.prioridade, payload.dificuldade,
                                          payload.categoria, db)

    campos = dict(
        titulo=payload.titulo,
        descricao=payload.descricao,
        data_prevista=payload.data_prevista,
        hora_limite=payload.hora_limite,
        prioridade=payload.prioridade.upper(),
        categoria=payload.categoria,
        status="PENDENTE",
        xp_recompensa=valores["xp_recompensa"],
        moedas_recompensa=valores["moedas_recompensa"],
        penalidade_xp=valores["penalidade_xp"],
        usuario_id=usuario.id,
    )

    tarefa = TarefaDia(**campos)

    # dificuldade e prazo: só atribui se a coluna existir no modelo
    try:
        if hasattr(TarefaDia, 'dificuldade'):
            tarefa.dificuldade = payload.dificuldade.upper()
        if hasattr(TarefaDia, 'prazo_minutos'):
            if payload.prazo_minutos and payload.prazo_minutos > 0:
                # Personalizada: o prazo é do hunter (clampado no teto duro),
                # e a marca impede que uma edição futura recalcule por cima.
                tarefa.prazo_minutos = min(economia.TETO_MINUTOS,
                                           max(5, int(payload.prazo_minutos)))
                tarefa.prazo_personalizado = True
            else:
                tarefa.prazo_minutos = valores["prazo_minutos"]
    except Exception:
        pass

    # ── A NATUREZA ──────────────────────────────────────────────────
    natureza = especiais.normalizar(payload.natureza)
    if not especiais.pode_criar(usuario, natureza):
        raise HTTPException(403, "Missoes especiais sao exclusivas da Staff por enquanto.")

    # A PASSIVA EXIGE JANELA, aqui como na rotina. Sem ela seria um
    # protocolo que dura o dia todo e se cumpre sozinho a meia-noite:
    # XP de graca. A missao geral ja tinha `hora_limite` para o fim —
    # so faltava o inicio.
    if natureza == especiais.PASSIVA and not (payload.hora_inicio and payload.hora_limite):
        raise HTTPException(400, "Missao passiva exige janela de horario: "
                                 "ela vale de um horario a outro.")
    tarefa.natureza = natureza
    tarefa.hora_inicio = payload.hora_inicio

    if natureza == especiais.REPETICAO:
        alvo = payload.alvo_repeticoes
        tarefa.alvo_repeticoes = int(alvo) if alvo and int(alvo) > 0 else None
        tarefa.contador_id = _contador_valido(db, usuario, payload.contador_id)
        tarefa.intervalo_min_seg = max(0, int(payload.intervalo_min_seg or 0)) or None

    db.add(tarefa)
    db.commit()
    db.refresh(tarefa)
    return _tarefa_to_dict(tarefa)


# ── Ciclo de vida ─────────────────────────────────────────────────────────────

@router.post("/{tarefa_id}/iniciar")
def iniciar_tarefa(
    tarefa_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """PENDENTE | PAUSADA → ATIVA"""
    t = _get_ou_404(tarefa_id, usuario, db)
    if t.status not in ("PENDENTE", "PAUSADA"):
        raise HTTPException(400, f"Não é possível iniciar tarefa com status '{t.status}'")
    t.status = "ATIVA"
    # O relógio começa a correr aqui. Só marcamos na PRIMEIRA largada: retomar
    # depois de uma pausa não pode reiniciar a contagem, senão a missão que o
    # hunter carregou o dia inteiro apareceria como se tivesse levado 2 minutos.
    if not t.iniciada_em:
        t.iniciada_em = tempo.agora()
    db.commit()
    db.refresh(t)
    return _tarefa_to_dict(t)


@router.post("/{tarefa_id}/pausar")
def pausar_tarefa(
    tarefa_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """ATIVA → PAUSADA"""
    t = _get_ou_404(tarefa_id, usuario, db)
    if t.status != "ATIVA":
        raise HTTPException(400, f"Só é possível pausar tarefas ATIVAS (atual: '{t.status}')")
    t.status = "PAUSADA"
    db.commit()
    db.refresh(t)
    return _tarefa_to_dict(t)


@router.post("/{tarefa_id}/retomar")
def retomar_tarefa(
    tarefa_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """PAUSADA | CANCELADA → ATIVA"""
    t = _get_ou_404(tarefa_id, usuario, db)
    if t.status not in ("PAUSADA", "CANCELADA"):
        raise HTTPException(400, f"Não é possível retomar tarefa com status '{t.status}'")
    t.status = "ATIVA"
    db.commit()
    db.refresh(t)
    return _tarefa_to_dict(t)


@router.post("/{tarefa_id}/cancelar")
def cancelar_tarefa(
    tarefa_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """RECUSA: o Sistema não deixa desistir. Ver o bloco abaixo."""
    # ── NÃO HÁ COMO DESISTIR ─────────────────────────────────────────
    #
    # "Cancelar hoje" era desistir com um clique. O Arquiteto foi
    # direto: o Sistema não foi feito para deixar desistir. Uma missão
    # termina de três jeitos — cumprida, vencida pelo tempo, ou extinta
    # pelo Arquiteto. Não há um quarto.
    #
    # As saídas legítimas continuam de pé, e cada uma cobra alguma
    # coisa: PAUSAR (o dia segue correndo), CONFESSAR (a passiva, com
    # preço), REERGUER (paga Mana) e EXTINGUIR (poder do Arquiteto,
    # irreversível). O que deixou de existir foi a saída GRÁTIS.
    #
    # A ROTA CONTINUA VIVA, e de propósito: `retomar` precisa dela para
    # trazer de volta o que já foi cancelado antes desta regra. Recusar
    # aqui, em vez de apagar o endpoint, também dá uma resposta clara a
    # quem chamar direto — 404 diria "não existe", e existe: é proibido.
    raise HTTPException(
        400,
        "O Sistema não aceita desistência. Uma missão termina cumprida, "
        "vencida pelo tempo, ou extinta pelo Arquiteto — se ela não faz "
        "mais sentido, extinga-a; se o dia apertou, pause.")

    t = _get_ou_404(tarefa_id, usuario, db)
    if t.status in ("CONCLUIDA", "CANCELADA"):
        raise HTTPException(400, f"Tarefa já está '{t.status}'")
    t.status = "CANCELADA"
    db.commit()
    db.refresh(t)
    return _tarefa_to_dict(t)


@router.post("/{tarefa_id}/concluir")
def concluir_tarefa(
    tarefa_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """ATIVA | PENDENTE → CONCLUIDA + aplica XP/moedas."""
    t = _get_ou_404(tarefa_id, usuario, db)
    if t.status == "CONCLUIDA":
        raise HTTPException(400, "Tarefa já foi concluída")

    # ── QUITAR UMA PENITÊNCIA ─────────────────────────────────────────
    # Não passa pela liquidação normal, e é de propósito: cumprir a
    # penitência QUITA a dívida, não é uma nova fonte de progresso. Se
    # pagasse XP cheio, falhar de propósito viraria estratégia.
    #
    # O que ela devolve é uma FRAÇÃO do que a falha tomou — reparação
    # parcial, nunca lucro. Devolver mais que o perdido seria pagar por
    # ter falhado.
    if especiais.normalizar(getattr(t, "natureza", None)) == especiais.PUNICAO:
        from motors import penitencia
        r = penitencia.quitar(db, usuario, t)
        db.commit()
        return anexar({"tarefa": _tarefa_to_dict(t), **r}, None)

    # ── UMA META NÃO SE CONCLUI POR DECLARAÇÃO ───────────────────────
    # Mesma trava de `concluir_rotina` (execucoes.py), pelo mesmo motivo:
    # concluir uma meta é dizer "cheguei lá", e quem sabe se chegou é o
    # número. O caminho legítimo é registrar valores até o alvo — e é
    # `meta_registrar` que fecha a missão quando ele é alcançado.
    from motors import meta as motor_meta
    if motor_meta.eh_meta_valida(t):
        modo_m = motor_meta.modo(getattr(t, "meta_modo", None),
                                 getattr(t, "meta_especie", None))
        atual_m = motor_meta.leitura(getattr(t, "meta_atual", 0),
                                     getattr(t, "meta_inicial", None), modo_m)
        if not motor_meta.alcancada(atual_m, t.meta_alvo,
                                    getattr(t, "meta_inicial", None), modo_m):
            esp = getattr(t, "meta_especie", None)
            un = motor_meta.unidade_de(t)
            raise HTTPException(400,
                f"Esta é uma missão de meta: ela se conclui ao alcançar o "
                f"alvo. Você está em {motor_meta.formatar(atual_m, esp, un)} "
                f"de {motor_meta.formatar(t.meta_alvo, esp, un)} — registre "
                f"os valores para chegar lá.")

    # ── NEM UM CIRCUITO ──────────────────────────────────────────────
    # Mesma trava, mesmo motivo: o card do circuito existe para saber
    # QUAIS blocos foram feitos, e um botão que fecha com blocos em
    # aberto joga fora o dado inteiro que a natureza guarda.
    from motors import circuito as motor_circuito
    if motor_circuito.eh_circuito(t) and not motor_circuito.completo(t, t):
        d = motor_circuito.normalizar(t.circuito_payload)
        p = motor_circuito.progresso(d, motor_circuito.ler_feito(t.circuito_feito))
        raise HTTPException(400,
            f"Esta é uma missão de circuito: ela se conclui ao entregar os "
            f"blocos. Você fechou {p['fechados']} de {p['total']} — "
            f"falta{'m' if p['faltam'] > 1 else ''} {p['faltam']}.")

    # O prazo da missão geral conta desde a INTENÇÃO (quando foi criada), não
    # desde o play. Quem cria uma missão de 30 minutos às 14:00 tem até 14:30,
    # tenha começado ou não. Concluir depois disso continua valendo a pena
    # para o hábito — mas não paga, e cobra a punição.
    liq = economia.liquidacao(t, vencida=prazos.venceu(prazos.da_tarefa(t)))

    t.status = "CONCLUIDA"
    t.concluida_em = tempo.agora()
    db.flush()

    resultado = aplicar_xp(
        db=db,
        usuario=usuario,
        xp_base=liq["xp"],
        moedas=liq["moedas"],
        hoje=tempo.hoje(),
        tarefa_id=t.id,
        observacao=f"Tarefa concluída: {t.titulo}",
    )

    if liq["penalidade"]:
        usuario.xp_total = max(0, (usuario.xp_total or 0) - liq["penalidade"])
        usuario.xp_atual = max(0, (usuario.xp_atual or 0) - liq["penalidade"])
        db.commit()

    # ── CUMPRIR O DEVER ABATE A DÍVIDA ───────────────────────────────
    # O mesmo abatimento da rotina (`_liquidar`, em execucoes.py): cada
    # missão concluída tira um pedaço da barra da penitência mais antiga
    # em aberto, sem nunca fechar a última unidade.
    #
    # A PENITÊNCIA NÃO ABATE A SI MESMA. Cumprir uma penitência já a
    # quita pelo caminho de `penitencia.quitar`; deixá-la abater a
    # seguinte transformaria a dívida numa fila que se paga sozinha.
    abate = None
    if especiais.normalizar(getattr(t, "natureza", None)) != especiais.PUNICAO:
        try:
            from motors import penitencia as _pen
            _n = economia.punicao_regras(db).get("abate_por_missao", 0)
            if _n:
                abate = _pen.abater(db, usuario, _n)
                if abate:
                    db.commit()
        except Exception as exc:
            print(f"[TAREFAS] ⚠ abatimento adiado: {exc}")

    return anexar(
        {"tarefa": _tarefa_to_dict(t), "resultado": resultado, "liquidacao": liq,
         "abate_penitencia": abate},
        resultado,
    )


# ── Edição / Exclusão ─────────────────────────────────────────────────────────

@router.put("/{tarefa_id}")
def atualizar_tarefa(
    tarefa_id: int,
    payload: TarefaUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    t = _get_ou_404(tarefa_id, usuario, db)

    if payload.titulo is not None:             t.titulo = payload.titulo
    if payload.descricao is not None:          t.descricao = payload.descricao
    if payload.data_prevista is not None:      t.data_prevista = payload.data_prevista
    if payload.hora_limite is not None:        t.hora_limite = payload.hora_limite
    if payload.prioridade is not None:         t.prioridade = payload.prioridade.upper()
    if payload.categoria is not None:          t.categoria = payload.categoria
    if payload.status is not None:             t.status = payload.status.upper()
    try:
        if payload.dificuldade is not None:    t.dificuldade = payload.dificuldade.upper()
    except Exception:
        pass

    # Prazo personalizado também pode ser ajustado na edição — só o prazo.
    # `economia.aplicar` logo abaixo respeita a marca e não recalcula por cima.
    if payload.prazo_minutos is not None and payload.prazo_minutos > 0 \
            and hasattr(t, "prazo_minutos"):
        t.prazo_minutos = min(economia.TETO_MINUTOS, max(5, int(payload.prazo_minutos)))
        t.prazo_personalizado = True

    # A EDIÇÃO era a segunda porta do mesmo buraco: bastava criar uma missão
    # honesta e depois editá-la pedindo 999.999 XP. Aqui a recompensa é sempre
    # RECALCULADA a partir do que a missão passou a ser — nunca copiada do que
    # o cliente pediu.
    economia.aplicar(t, economia.recompensa_tarefa(
        t.prioridade, getattr(t, "dificuldade", "NORMAL"), t.categoria, db))

    db.commit()
    db.refresh(t)
    return _tarefa_to_dict(t)


@router.delete("/{tarefa_id}")
def deletar_tarefa(
    tarefa_id: int,
    extinguir: bool = False,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    Deleta a tarefa.
    Se extinguir=true e status=CONCLUIDA, reverte XP/moedas (Arquiteto).
    """
    t = _get_ou_404(tarefa_id, usuario, db)

    if extinguir and t.status == "CONCLUIDA":
        u = db.query(Usuario).filter(Usuario.id == usuario.id).first()
        if u:
            u.xp_total = max(0, (u.xp_total    or 0) - (t.xp_recompensa    or 0))
            u.moedas   = max(0, (u.moedas       or 0) - (t.moedas_recompensa or 0))

    # ══ A PENITÊNCIA NÃO É APAGADA — ELA É ENCERRADA ═════════════════
    #
    # APAGAR ERA O DEFEITO. `_ja_julgado` (motors/fechamento) pergunta se
    # existe uma TarefaDia de PUNICAO com `origem_data` naquele dia. É
    # essa linha que diz "este dia já foi julgado". Sumindo com ela, o
    # dia voltava a ser julgável — e o fechamento seguinte mandava uma
    # penitência NOVA pela MESMA falha. O Arquiteto perdoava e o Sistema
    # cobrava de novo, para sempre.
    #
    # Encerrar em vez de apagar resolve os dois lados de uma vez: sai das
    # pendentes (CANCELADA está fora do filtro de `penitencia.pendentes`,
    # então o teto libera na hora) e o dia continua constando como
    # julgado. É o mesmo desfecho de "quitar", só que sem reparação —
    # perdão não paga XP.
    #
    # E o registro sobrevive: quem olhar o extrato de aquele dia vê que
    # houve punição e que ela foi extinta, em vez de um dia falho sem
    # consequência aparente.
    if especiais.normalizar(getattr(t, "natureza", None)) == especiais.PUNICAO:
        t.status = "CANCELADA"
        t.cancelada_em = tempo.agora()
        db.commit()
        return {"ok": True, "extinguido": extinguir, "encerrada": True,
                "motivo": "Penitência extinta pelo Arquiteto — o dia segue "
                          "julgado, e o Sistema não cobra de novo."}

    db.delete(t)
    db.commit()
    return {"ok": True, "extinguido": extinguir}
