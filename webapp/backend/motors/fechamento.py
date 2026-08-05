# -*- coding: utf-8 -*-
"""
Fechamento do dia — o que transforma uma agenda em histórico.

Por que existe: até aqui, a instância diária de uma rotina (ExecucaoDia) só
nascia quando o hunter ABRIA o app e a rotina era do dia. Quem passasse três
dias fora simplesmente não tinha esses dias no banco — e um extrato honesto
precisa deles. Pior: o "fracassou" era disparado pelo navegador, então um dia
vencido ficava PENDENTE para sempre se ninguém entrasse.

Este motor resolve os dois lados:
  • materializa as instâncias dos dias devidos (idempotente);
  • fecha o que venceu: PENDENTE|ATIVA de dia passado → FRACASSADA, com a
    penalidade que a própria rotina/missão declara.

Roda no scheduler (madrugada) e é seguro chamar quantas vezes quiser: tudo é
"garantir que", nunca "somar de novo".

REGRA DE OURO: quem decide que uma missão fracassou é o PRAZO dela, não a
virada do dia. Uma rotina com janela 20:00–22:00 fracassa às 22:00 do próprio
dia; uma rotina de dia inteiro, às 23:59. Missão geral não fecha por prazo —
ela vira dívida no vermelho e só fecha quando o dia previsto passa.
"""
import json
from datetime import date, datetime, timedelta
from motors import tempo, prazos, especiais

from sqlalchemy.orm import Session

from database import SessionLocal, Rotina, ExecucaoDia, TarefaDia, Usuario

# Quantos dias para trás o fechamento OLHA ao fechar pendências.
# Não é backfill: serve para o job encontrar dias que já existiam e ficaram
# abertos, nunca para inventar dias que ninguém viveu.
JANELA_DIAS = 30


def rotina_devida_em(rotina: Rotina, dia: date) -> bool:
    """A rotina cai neste dia, segundo sua frequência? (não olha o passado)"""
    if not rotina.ativo:
        return False
    if rotina.tipo == "DIARIA":
        return True
    if rotina.tipo == "SEMANAL":
        try:
            dias = json.loads(rotina.dias_semana) if rotina.dias_semana else []
        except Exception:
            dias = []
        return dia.weekday() in dias
    if rotina.tipo == "MENSAL":
        return dia.day == rotina.dia_mes
    if rotina.tipo == "ANUAL":
        if rotina.mes_dia:
            try:
                m, d = rotina.mes_dia.split("-")
                return dia.month == int(m) and dia.day == int(d)
            except Exception:
                return False
    return False


def materializar(db: Session, usuario_id: int, ate: date | None = None) -> int:
    """
    Garante que exista o ExecucaoDia do DIA CORRENTE para cada rotina devida.
    Devolve quantas instâncias foram criadas. Idempotente.

    SÓ O DIA CORRENTE, e isto é uma decisão, não um limite técnico.

    A versão anterior varria 30 dias para trás e criava instâncias de dias
    que o hunter nunca viveu — que o fechamento em seguida marcava como
    FRACASSADA, com penalidade. Ou seja: inventava derrotas retroativas.
    Isso contradizia a decisão tomada ("começar do zero: o que não foi
    observado não vira registro") e podia zerar o XP de alguém por dias
    anteriores à existência da funcionalidade.

    Não perdemos histórico com isso: o job das 00h05 roda todo dia e
    materializa o dia dele. Cada dia nasce no seu próprio dia, mesmo que o
    hunter não abra o app.
    """
    hoje = ate or tempo.hoje()
    criadas = 0

    rotinas = db.query(Rotina).filter(
        Rotina.usuario_id == usuario_id, Rotina.ativo == True
    ).all()
    if not rotinas:
        return 0

    # Uma consulta só para saber o que já existe hoje — nada de N+1.
    existentes = {
        ed.rotina_id
        for ed in db.query(ExecucaoDia.rotina_id).filter(
            ExecucaoDia.usuario_id == usuario_id,
            ExecucaoDia.data == hoje,
        ).all()
    }

    agora = tempo.agora()

    for r in rotinas:
        # Uma rotina criada hoje à noite não deve gerar a missão de hoje se
        # a janela dela já passou? Deve sim — quem cria decide. O que não
        # pode é gerar dias ANTERIORES ao próprio nascimento.
        nascimento = tempo.dia_de_utc(r.criado_em) or hoje
        if nascimento > hoje:
            continue

        # ── A PROGRESSIVA É A EXCEÇÃO, e por uma razão de gravidade ──
        #
        # Para uma rotina comum, nascer com a janela já vencida custa um
        # pouco de XP e mais nada — por isso a decisão acima é razoável.
        # Para uma PROGRESSIVA é fatal: o dia vence, `fechar_vencidas`
        # marca FRACASSADA, e `aplicar_fatal_failure` desliga o desafio
        # PARA SEMPRE. Progressiva não pode ser reerguida.
        #
        # O Arquiteto criou um desafio com janela das 06:20 às 06:40 e ele
        # nasceu morto no Dashboard, sem que houvesse um instante em que
        # fosse possível cumpri-lo. Um desafio que morre antes da largada
        # não é dureza, é defeito.
        #
        # A regra: no DIA EM QUE ELA NASCE, a progressiva só ganha
        # instância se ainda houver tempo de cumpri-la. Caso contrário a
        # corrente começa amanhã, inteira. Dos dias seguintes em diante o
        # rigor volta ao normal — aí o hunter teve o dia todo para agir.
        if getattr(r, "eh_progressiva", False) and nascimento == hoje:
            if prazos.da_rotina(r, hoje)["fim"] <= agora:
                continue

        if rotina_devida_em(r, hoje) and r.id not in existentes:
            db.add(ExecucaoDia(
                rotina_id=r.id, usuario_id=usuario_id,
                data=hoje, status="PENDENTE",
            ))
            criadas += 1

    if criadas:
        db.flush()
    return criadas


def fechar_vencidas(db: Session, usuario: Usuario, ate: date | None = None) -> dict:
    """
    Fecha o que já venceu — pelo RELÓGIO, não pelo calendário.

    Esta função olhava só a data: `data < hoje`. Com isso, o Banho
    Revigorante, cuja janela termina às 22:00, só era declarado fracassado à
    meia-noite — duas horas depois de a corrida ter sido perdida. Pior: entre
    22:00 e 00:00 o cartão continuava oferecendo o botão Iniciar, numa missão
    que já não podia mais ser vencida.

    Agora quem manda é `motors/prazos.py`. Cada instância sabe o seu instante
    de vencimento e é fechada quando ele passa — 22:00 para a janela, 23:59
    para a rotina de dia inteiro.

    A MISSÃO GERAL NÃO É FECHADA AQUI, e isso é uma decisão do Arquiteto:
    rotina de janela é corrida contra o tempo (vence e acaba); missão geral é
    dívida (vence e continua lá, no vermelho, até ser quitada). Ela só fecha
    quando o próprio DIA PREVISTO já passou — aí não é mais dívida de hoje,
    é história.
    """
    hoje = ate or tempo.hoje()
    agora = tempo.agora()
    rotinas_fechadas = 0
    gerais_fechadas = 0
    xp_perdido_total = 0
    # As falhas do dia, coletadas para a penitencia decidir DEPOIS. Ela
    # nao pode decidir no meio do laco: o gatilho olha o dia inteiro
    # ("todas as diarias falharam"), e no meio do laco o dia ainda nao
    # acabou de ser lido.
    falhas_do_dia = []
    # As passivas cumpridas são separadas e pagas DEPOIS do laço: creditar XP
    # no meio de uma varredura de instâncias misturaria a subtração das
    # derrotas com a soma das vitórias, e o nível do hunter subiria e desceria
    # dentro da mesma transação.
    passivas_cumpridas = []

    # ── Instâncias de rotina ──────────────────────────────────────────
    # Trazemos HOJE também (antes era só `< hoje`), porque uma janela pode
    # vencer dentro do próprio dia. Quem decide é o prazo, um por um.
    abertas = db.query(ExecucaoDia).filter(
        ExecucaoDia.usuario_id == usuario.id,
        ExecucaoDia.data <= hoje,
        ExecucaoDia.status.in_(("PENDENTE", "ATIVA")),
    ).all()

    if abertas:
        ids = {ed.rotina_id for ed in abertas}
        mae = {r.id: r for r in db.query(Rotina).filter(Rotina.id.in_(ids)).all()}

        for ed in abertas:
            r = mae.get(ed.rotina_id)
            if r is None:
                continue
            p = prazos.da_execucao(ed, r)
            if not prazos.venceu(p, agora):
                continue                      # ainda tem tempo — não se toca

            # ── A INVERSÃO DA MISSÃO PASSIVA ──────────────────────
            # Numa missão comum, chegar ao prazo sem concluir é derrota.
            # Numa passiva é VITÓRIA: o protocolo foi mantido a noite
            # inteira. "Sem cafeína após as 16h" vence às 05:00 sozinho,
            # e quem quebrou tinha o botão Confessar à disposição.
            #
            # `concluida_em` recebe a HORA DO PRAZO (05:00), não o instante
            # em que o servidor percebeu. O hunter abre o app às 07:30 e vê
            # "concluída às 05:00" — que é a verdade. Foi o mesmo cuidado
            # tomado com `iniciada_em` no auto-início; sem ele o cronômetro
            # do cartão mentiria sobre quanto o protocolo durou.
            if especiais.eh_premium(getattr(r, "natureza", None)):
                passivas_cumpridas.append((ed, r, p["fim"]))
                continue

            pen = getattr(r, "penalidade_xp", 0) or 0
            # Missão reerguida já foi punida quando fracassou da primeira vez.
            # Punir de novo cobraria duas vezes pelo mesmo fracasso — e o
            # hunter ainda pagou Mana pela segunda chance.
            if getattr(ed, "reerguida", False):
                pen = 0
            ed.status = "FRACASSADA"
            ed.fracassada_em = agora
            ed.xp_perdido = pen
            xp_perdido_total += pen
            rotinas_fechadas += 1
            falhas_do_dia.append({
                "titulo": r.titulo, "data": ed.data,
                "xp": pen, "critica": (r.prioridade or "").upper() == "CRITICA",
                "diaria": (r.tipo or "").upper() == "DIARIA",
            })
            # FATAL FAILURE — a derrota que encerra o desafio inteiro.
            # Uma missão progressiva não tem segunda chance: fracassar UM
            # dia mata o desafio permanentemente. O hunter viu o aviso
            # quando criou — a dureza é o que dá valor à corrente.
            if getattr(r, "eh_progressiva", False):
                especiais.aplicar_fatal_failure(db, r, agora)

    # ── Missões gerais (avulsas) ──────────────────────────────────────
    # Só as de dias já passados. A de hoje que estourou o prazo continua
    # aberta de propósito: o contador fica negativo e o hunter ainda pode
    # quitá-la — pagando a punição, sem receber a recompensa.
    tarefas = db.query(TarefaDia).filter(
        TarefaDia.usuario_id == usuario.id,
        TarefaDia.data_prevista < hoje,
        TarefaDia.status.in_(("PENDENTE", "ATIVA", "PAUSADA")),
    ).all()
    for t in tarefas:
        # UMA PENITENCIA NAO GERA OUTRA. Sem esta linha, um dia ruim
        # vira espiral infinita — a penitencia nao cumprida simplesmente
        # NAO SAI DA LISTA, e ficar ja e a punicao.
        if especiais.normalizar(getattr(t, "natureza", None)) == especiais.PUNICAO:
            continue
        t.status = "FRACASSADA"
        xp_perdido_total += (t.penalidade_xp or 0)
        gerais_fechadas += 1
        falhas_do_dia.append({
            "titulo": t.titulo, "data": t.data_prevista,
            "xp": t.penalidade_xp or 0,
            "critica": (t.prioridade or "").upper() == "CRITICA",
            "diaria": False,
        })

    # Uma subtração só, no fim: XP nunca fica negativo.
    if xp_perdido_total:
        usuario.xp_total = max(0, (usuario.xp_total or 0) - xp_perdido_total)
        usuario.xp_atual = max(0, (usuario.xp_atual or 0) - xp_perdido_total)

    # ── Protocolos mantidos: agora sim, o pagamento ───────────────────
    passivas = 0
    for ed, r, fim in passivas_cumpridas:
        ed.status = "CONCLUIDA"
        ed.concluida_em = fim
        try:
            from motors.gamificacao import aplicar_xp
            res = aplicar_xp(
                db=db, usuario=usuario,
                xp_base=getattr(r, "xp_recompensa", 0) or 0,
                moedas=getattr(r, "moedas_recompensa", 0) or 0,
                hoje=ed.data, rotina_id=r.id,
                observacao=f"Protocolo mantido: {r.titulo}",
            )
            ed.xp_ganho = (res or {}).get("xp_ganho", 0)
            ed.moedas_ganhas = (res or {}).get("moedas_ganhas", 0)
        except Exception as e:
            # Um protocolo que não conseguiu pagar não pode derrubar o
            # fechamento dos outros hunters. Fica concluído e sem crédito,
            # e o log mostra o quê.
            print(f"[FECHAMENTO] ⚠ passiva {r.titulo}: {e}")
        # PROGRESSIVA PASSIVA: dia mantido = +1 na corrente.
        # Se bateu o alvo, a própria missão se conclui gloriosa.
        if getattr(r, "eh_progressiva", False):
            try:
                r.dias_progressivos_ok = (r.dias_progressivos_ok or 0) + 1
                alvo = r.dias_progressivos_alvo or 0
                if alvo and r.dias_progressivos_ok >= alvo:
                    r.ativo   = False
                    r.status  = "CONCLUIDA"
                    r.concluida_em = fim
            except Exception as exc:
                print(f"[FECHAMENTO] ⚠ progressiva passiva {r.titulo}: {exc}")
        passivas += 1

    # ── A PENITENCIA ──────────────────────────────────────────────────
    # Depois de tudo fechado, e so agora: o gatilho olha o dia inteiro.
    punicao = _talvez_punir(db, usuario, falhas_do_dia, hoje)

    return {
        "rotinas": rotinas_fechadas,
        "gerais": gerais_fechadas,
        "passivas": passivas,
        "xp_perdido": xp_perdido_total,
        "punicao": punicao,
    }


def _talvez_punir(db: Session, usuario: Usuario, falhas: list, hoje) -> dict | None:
    """
    O GATILHO. Nao e qualquer falha.

    Punicao frequente vira paisagem, e paisagem nao assusta — a obra
    ensina isso: o Jinwoo entra na zona de punicao UMA VEZ, e o que
    move a historia depois e o medo dela.

    Dispara em tres casos, e nenhum deles e "perdeu uma missao":

      · uma missao CRITICA falhou       -> cobra dobrado
      · TODAS as diarias do dia falharam -> cobra
      · reincidencia de N dias seguidos  -> cobra

    Nunca derruba o fechamento: se a punicao explodir, o dia ainda
    fecha. Uma divida perdida e melhor que um app travado.
    """
    if not falhas:
        return None
    try:
        from motors import penitencia, economia as _eco
        regras = _eco.punicao_regras(db)

        criticas = [f for f in falhas if f["critica"]]
        diarias  = [f for f in falhas if f["diaria"]]
        todas_diarias = bool(diarias) and len(diarias) == _diarias_do_dia(db, usuario, hoje)

        gatilho, dobrar = None, False
        if criticas:
            gatilho, dobrar = "critica", True
        elif todas_diarias:
            gatilho = "dia_perdido"
        elif _dias_seguidos_com_falha(db, usuario, hoje) >= regras["dias_seguidos"]:
            gatilho = "reincidencia"

        if not gatilho:
            return None

        alvo = (criticas or falhas)[0]
        r = penitencia.cobrar(db, usuario, alvo["titulo"], alvo["data"],
                              xp_perdido=alvo["xp"], dobrar=dobrar)
        r["gatilho"] = gatilho
        return r
    except Exception as e:
        print(f"[FECHAMENTO] penitencia adiada: {e}")
        return None


def _diarias_do_dia(db: Session, usuario: Usuario, dia) -> int:
    """Quantas diarias existiam no dia — para saber se TODAS falharam."""
    return (db.query(ExecucaoDia)
              .join(Rotina, Rotina.id == ExecucaoDia.rotina_id)
              .filter(ExecucaoDia.usuario_id == usuario.id,
                      ExecucaoDia.data == dia,
                      Rotina.tipo == "DIARIA").count())


def _dias_seguidos_com_falha(db: Session, usuario: Usuario, hoje) -> int:
    """
    Quantos dias seguidos, contando de ontem para tras, tiveram falha.

    Para em quanto a Balanca pede; contar o historico inteiro seria
    varrer anos para responder "chegou a tres?".
    """
    from motors import economia as _eco
    limite = _eco.punicao_regras(db)["dias_seguidos"] + 1
    n = 0
    for i in range(1, limite + 1):
        d = hoje - timedelta(days=i)
        houve = (db.query(ExecucaoDia)
                   .filter(ExecucaoDia.usuario_id == usuario.id,
                           ExecucaoDia.data == d,
                           ExecucaoDia.status == "FRACASSADA").count())
        if not houve:
            break
        n += 1
    return n


def reparar_fechamento_indevido(db: Session, usuario: Usuario,
                                ate: date | None = None) -> dict:
    """
    Desfaz as derrotas que o relógio errado provocou.

    Enquanto o servidor decidia o dia em UTC, às 21:00 de Brasília ele já
    considerava amanhã — e fechava como FRACASSADA as missões de HOJE que
    ainda tinham prazo, descontando o XP. Uma rotina com janela 20:00–22:00
    era punida uma hora antes de vencer, todo dia.

    Este reparo é conservador de propósito: mexe apenas em instâncias de
    HOJE OU DO FUTURO. O passado é histórico legítimo e não se reescreve.

    Idempotente: rodar duas vezes não devolve XP duas vezes, porque ao
    reabrir ele zera `xp_perdido` — na segunda passada não há o que devolver.
    """
    hoje = ate or tempo.hoje()
    agora = tempo.agora()

    candidatas = db.query(ExecucaoDia).filter(
        ExecucaoDia.usuario_id == usuario.id,
        ExecucaoDia.data >= hoje,                    # hoje ou depois
        ExecucaoDia.status == "FRACASSADA",
    ).all()

    # AGORA HÁ FRACASSO LEGÍTIMO DENTRO DO DIA CORRENTE.
    # Quando este reparo foi escrito, nada podia fracassar hoje — só a
    # meia-noite fechava missão, então toda derrota de hoje era erro de fuso.
    # Com a janela de horário isso deixou de ser verdade: às 22:01 o Banho
    # Revigorante fracassa por mérito próprio, ainda dentro de hoje. Reabri-lo
    # devolveria o XP e apagaria a derrota — o reparo viraria um perdão
    # automático, e a janela deixaria de significar qualquer coisa.
    ids = {ed.rotina_id for ed in candidatas}
    mae = {r.id: r for r in db.query(Rotina).filter(Rotina.id.in_(ids)).all()} if ids else {}
    indevidas = [
        ed for ed in candidatas
        if ed.rotina_id in mae
        and not prazos.venceu(prazos.da_execucao(ed, mae[ed.rotina_id]), agora)
    ]

    xp_devolvido = 0
    for ed in indevidas:
        xp_devolvido += ed.xp_perdido or 0
        ed.status = "PENDENTE"                       # volta a ser jogável
        ed.fracassada_em = None
        ed.xp_perdido = 0
        # E o cronômetro volta ao zero. Sem isto, a missão reaberta ficava
        # PENDENTE mas com a hora de início preservada — e o cartão exibia um
        # contador correndo há 11 horas numa missão que nem começou. Voltar a
        # PENDENTE significa, por definição, que ela ainda não teve largada.
        ed.iniciada_em = None

    tarefas = db.query(TarefaDia).filter(
        TarefaDia.usuario_id == usuario.id,
        TarefaDia.data_prevista >= hoje,
        TarefaDia.status == "FRACASSADA",
        # PENITENCIA NAO E FECHAMENTO INDEVIDO. Ela tem `data_prevista` igual
        # ao dia da falha, entao quando nasce hoje a query a capturaria e a
        # reabriria como erro de fuso — destruindo o fluxo de vida dela.
        # A divida nunca expira; so o hunter a quita ou o Reerguer a revoga.
        TarefaDia.natureza != "PUNICAO",
    ).all()
    for t in tarefas:
        xp_devolvido += t.penalidade_xp or 0
        t.status = "PENDENTE"
        t.iniciada_em = None      # mesma regra: PENDENTE não tem cronômetro

    if xp_devolvido:
        usuario.xp_total = (usuario.xp_total or 0) + xp_devolvido
        usuario.xp_atual = (usuario.xp_atual or 0) + xp_devolvido
        # O nível pode ter caído junto com o XP; devolve-o ao lugar.
        try:
            from motors.gamificacao import recalcular_nivel
            recalcular_nivel(db, usuario)
        except Exception:
            pass

    return {"reabertas": len(indevidas) + len(tarefas), "xp_devolvido": xp_devolvido}


def auto_iniciar(db: Session, usuario: Usuario, ate: date | None = None) -> int:
    """
    Acende sozinhas as missões cuja janela já abriu.

    O Banho Revigorante das 20:00 não espera clique: às 20:00 ele está em
    curso, o hunter tendo aberto o app ou não. Devolve quantas acenderam.

    POR QUE ISTO É CALCULADO NA LEITURA, e não por um processo a cada minuto:
    o resultado visível é idêntico — quando o hunter abre o app às 21:00, a
    missão está ATIVA desde as 20:00 — e não exige um worker acordado 24h,
    que no plano free do Render hiberna e simplesmente não dispararia. O que
    a leitura não faz é notificação push; quando isso existir, o processo por
    minuto vira necessário, e o gancho é esta mesma função.

    A SUTILEZA QUE FAZ O CRONÔMETRO NÃO MENTIR: `iniciada_em` recebe a hora da
    JANELA (20:00), não o instante em que o servidor percebeu. Abrir o app às
    21:00 tem que mostrar "1h em curso", não "acabou de começar".
    """
    hoje = ate or tempo.hoje()
    agora = tempo.agora()

    pendentes = db.query(ExecucaoDia).filter(
        ExecucaoDia.usuario_id == usuario.id,
        ExecucaoDia.data == hoje,
        ExecucaoDia.status == "PENDENTE",
    ).all()
    if not pendentes:
        return 0

    ids = {ed.rotina_id for ed in pendentes}
    mae = {r.id: r for r in db.query(Rotina).filter(Rotina.id.in_(ids)).all()}

    acesas = 0
    for ed in pendentes:
        r = mae.get(ed.rotina_id)
        if r is None:
            continue
        # Missão reerguida NÃO se acende de novo: a segunda largada é do
        # hunter, senão o Reerguer devolveria o automatismo que ele perdeu.
        if getattr(ed, "reerguida", False):
            continue
        p = prazos.da_execucao(ed, r)
        if prazos.deve_auto_iniciar(p, agora):
            ed.status = "ATIVA"
            ed.iniciada_em = p["inicio"]
            acesas += 1

    if acesas:
        db.flush()
    return acesas


def processar_usuario(db: Session, usuario: Usuario, ate: date | None = None) -> dict:
    """Materializa e fecha, para um hunter. Não faz commit — quem chama decide."""
    # A ORDEM IMPORTA, e cada passo depende do anterior:
    #   1. reparo      — desfaz derrota ilegítima antes que alguém a leia
    #   2. materializa — o dia de hoje precisa existir para poder acender
    #   3. auto-início — acende o que a janela já abriu
    #   4. fechamento  — fecha o que a janela já encerrou
    # Acender antes de fechar não é redundante: uma janela 20:00–22:00 lida às
    # 23:00 passa por acender (não, já venceu) e cai no fechamento, que a
    # marca FRACASSADA. Se a ordem fosse invertida, a missão acenderia depois
    # de fechada e voltaria a ATIVA.
    reparo = reparar_fechamento_indevido(db, usuario, ate=ate)
    criadas = materializar(db, usuario.id, ate=ate)
    acesas = auto_iniciar(db, usuario, ate=ate)
    resumo = fechar_vencidas(db, usuario, ate=ate)
    resumo["materializadas"] = criadas
    resumo["acesas"] = acesas
    resumo["reabertas"] = reparo["reabertas"]
    resumo["xp_devolvido"] = reparo["xp_devolvido"]
    return resumo


def rodar(ate: date | None = None, verbose: bool = True) -> dict:
    """
    Passada completa: todos os hunters ativos. É o que o scheduler chama.
    Uma sessão por execução; um hunter com problema não derruba os outros.
    """
    db = SessionLocal()
    total = {"materializadas": 0, "rotinas": 0, "gerais": 0, "passivas": 0,
             "xp_perdido": 0, "erros": 0}
    try:
        usuarios = db.query(Usuario).filter(Usuario.ativo == True).all()
        for u in usuarios:
            try:
                r = processar_usuario(db, u, ate=ate)
                db.commit()
                for k in ("materializadas", "rotinas", "gerais", "passivas", "xp_perdido"):
                    total[k] += r.get(k, 0)
            except Exception as e:
                db.rollback()
                total["erros"] += 1
                print(f"[FECHAMENTO] ⚠ hunter {u.login}: {e}")
    finally:
        db.close()

    if verbose:
        print(f"[FECHAMENTO] {total['materializadas']} instância(s) criada(s), "
              f"{total['rotinas']} rotina(s) e {total['gerais']} missão(ões) geral(is) "
              f"fechada(s), {total['passivas']} protocolo(s) mantido(s), "
              f"-{total['xp_perdido']} XP.")
    return total
