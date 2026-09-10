# -*- coding: utf-8 -*-
"""
O DOSSIE DA MISSAO — o que o cartao nao cabe.

O cartao responde "o que fazer agora". Este motor responde "como tenho
me saido nisso" — e sao perguntas diferentes o bastante para morarem em
telas diferentes.

O QUE ELE NAO FAZ, E POR QUE

Nao guarda nada. Todo numero aqui e DERIVADO de `ExecucaoDia` na hora da
leitura. Uma coluna `vezes_concluida` na Rotina seria mais rapida e
seria a decima segunda-verdade deste projeto: bastaria um `revogar`, um
Reerguer ou uma edicao para ela discordar do historico que ela resume.

A CORRENTE DA ROTINA NAO E A CORRENTE DO HUNTER

`Usuario.streak_atual` conta DIAS EM QUE ELE FEZ ALGUMA COISA. Aqui a
conta e outra: dias seguidos em que ESTA rotina foi cumprida, contados
para tras a partir da ultima ocorrencia dela. Um hunter com streak de
trinta pode ter uma rotina especifica quebrada ha uma semana, e e
exatamente esse contraste que o dossie existe para mostrar.

DIAS EM QUE A ROTINA NAO ERA DEVIDA NAO QUEBRAM NADA. Uma rotina de
segunda e quarta nao "falha" na terca — ela nem foi pedida. Por isso a
corrente anda sobre as INSTANCIAS existentes, e nao sobre o calendario.
"""
from datetime import date, timedelta

from database import ExecucaoDia, Execucao, Rotina, TarefaDia

CONCLUIDA = "CONCLUIDA"
FRACASSADA = "FRACASSADA"
CONFESSADA = "CONFESSADA"
CANCELADA = "CANCELADA"
FINAIS = (CONCLUIDA, FRACASSADA, CONFESSADA, CANCELADA)

DIAS_PT = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]


def _segundos(ed) -> int | None:
    """Quanto durou, do Iniciar ao Concluir. `None` quando nao da para saber."""
    ini, fim = getattr(ed, "iniciada_em", None), getattr(ed, "concluida_em", None)
    if not ini or not fim:
        return None
    s = int((fim - ini).total_seconds())
    # Negativo e relogio bagunçado; acima de 24h e instancia esquecida
    # aberta de um dia para o outro. Nenhum dos dois e "tempo de execucao".
    return s if 0 < s <= 86400 else None


def _corrente(instancias: list) -> dict:
    """
    Dias seguidos cumpridos, contados de tras para frente.

    A CONFISSAO NAO QUEBRA. E a regra que o proprio app ja tem escrita
    ("confessar custa metade e NAO quebra o streak"): quem admitiu foi
    honesto, e punir a honestidade ensina a nao admitir. Ela nao SOMA,
    porem — a corrente e de cumprimento, nao de sinceridade.

    CANCELADA tambem nao quebra: a missao nao chegou a existir naquele
    dia. Fica de fora da conta dos dois lados.
    """
    ordenadas = sorted(instancias, key=lambda x: x.data, reverse=True)
    atual = 0
    for ed in ordenadas:
        st = (ed.status or "").upper()
        if st == CONCLUIDA:
            atual += 1
        elif st in (CANCELADA, CONFESSADA):
            continue                       # neutro: nao soma, nao quebra
        elif st == FRACASSADA:
            break
        else:
            break                          # em aberto: a corrente ainda nao fechou

    # O RECORDE percorre no sentido do tempo, guardando a maior sequencia.
    melhor = corr = 0
    for ed in sorted(instancias, key=lambda x: x.data):
        st = (ed.status or "").upper()
        if st == CONCLUIDA:
            corr += 1
            melhor = max(melhor, corr)
        elif st in (CANCELADA, CONFESSADA):
            continue
        else:
            corr = 0
    return {"atual": atual, "recorde": max(melhor, atual)}


def _por_dia_da_semana(instancias: list) -> dict:
    """
    Onde a rotina vive e onde ela morre.

    Precisa de AMOSTRA para significar alguma coisa: uma terça com uma
    unica ocorrencia cumprida daria "100% na terça", e isso nao e um
    padrao, e uma coincidencia. Abaixo de tres ocorrencias o dia nao
    concorre a melhor nem a pior.
    """
    tab = {}
    for ed in instancias:
        st = (ed.status or "").upper()
        if st not in (CONCLUIDA, FRACASSADA):
            continue
        d = ed.data.weekday()
        t = tab.setdefault(d, {"ok": 0, "total": 0})
        t["total"] += 1
        if st == CONCLUIDA:
            t["ok"] += 1

    linhas = []
    for d in range(7):
        t = tab.get(d)
        if not t:
            continue
        linhas.append({"dia": DIAS_PT[d], "n": t["total"],
                       "pct": round(t["ok"] * 100 / t["total"])})

    com_amostra = [x for x in linhas if x["n"] >= 3]
    melhor = max(com_amostra, key=lambda x: x["pct"], default=None)
    pior = min(com_amostra, key=lambda x: x["pct"], default=None)
    # Melhor e pior iguais nao dizem nada: e a rotina inteira no mesmo
    # patamar, e anunciar "melhor: terça · pior: terça" seria ruido.
    if melhor and pior and melhor["pct"] == pior["pct"]:
        melhor = pior = None
    return {"linhas": linhas, "melhor": melhor, "pior": pior}


def de_rotina(db, usuario, rotina: Rotina, hoje: date, dias_fita: int = 30) -> dict:
    """O dossie de uma rotina — a leitura longa do cartao."""
    inst = (db.query(ExecucaoDia)
              .filter(ExecucaoDia.rotina_id == rotina.id,
                      ExecucaoDia.usuario_id == usuario.id)
              .order_by(ExecucaoDia.data).all())

    cont = {k: 0 for k in FINAIS}
    cont["ABERTA"] = 0
    tempos, xp_ganho, xp_perdido, reergues, mana = [], 0, 0, 0, 0
    for ed in inst:
        st = (ed.status or "").upper()
        cont[st if st in cont else "ABERTA"] += 1
        xp_ganho += int(ed.xp_ganho or 0)
        xp_perdido += int(ed.xp_perdido or 0)
        if getattr(ed, "reerguida", False):
            reergues += 1
            mana += int(getattr(ed, "mana_gasta", 0) or 0)
        s = _segundos(ed)
        if s and st == CONCLUIDA:
            tempos.append(s)

    julgadas = cont[CONCLUIDA] + cont[FRACASSADA]
    taxa = round(cont[CONCLUIDA] * 100 / julgadas) if julgadas else None

    # A FITA dos ultimos dias — so as instancias que existiram. Dia sem
    # instancia nao aparece: a rotina nao foi pedida, e inventar um
    # quadradinho cinza sugeriria uma falta que nao houve.
    corte = hoje - timedelta(days=dias_fita - 1)
    fita = [{"data": ed.data.isoformat(), "status": (ed.status or "ABERTA").upper()}
            for ed in inst if ed.data >= corte]

    penitencias = (db.query(TarefaDia)
                     .filter(TarefaDia.usuario_id == usuario.id,
                             TarefaDia.natureza == "PUNICAO",
                             TarefaDia.origem_rotina_id == rotina.id).count())

    nasceu = getattr(rotina, "criado_em", None)
    return {
        "tipo": "rotina",
        "titulo": rotina.titulo,
        "natureza": getattr(rotina, "natureza", "ATIVA"),
        "tipo_rotina": rotina.tipo,
        "categoria": rotina.categoria,
        "prioridade": rotina.prioridade,
        "dificuldade": getattr(rotina, "dificuldade", "NORMAL"),
        "nasceu_em": nasceu.date().isoformat() if nasceu else None,
        "dias_de_vida": (hoje - nasceu.date()).days if nasceu else None,

        "corrente": _corrente(inst),
        "contagem": {
            "total": len(inst),
            "cumpridas": cont[CONCLUIDA],
            "fracassadas": cont[FRACASSADA],
            "confessadas": cont[CONFESSADA],
            "canceladas": cont[CANCELADA],
            "em_aberto": cont["ABERTA"],
        },
        "taxa": taxa,
        "tempo": {
            "recorde": min(tempos) if tempos else None,
            "medio": round(sum(tempos) / len(tempos)) if tempos else None,
            "pior": max(tempos) if tempos else None,
            "amostras": len(tempos),
        },
        "xp": {"ganho": xp_ganho, "perdido": xp_perdido,
               "saldo": xp_ganho - xp_perdido},
        "reergues": {"vezes": reergues, "mana": mana},
        "semana": _por_dia_da_semana(inst),
        "penitencias_geradas": penitencias,
        "fita": fita,
    }


def de_tarefa(db, usuario, t: TarefaDia, hoje: date) -> dict:
    """
    O dossie de uma missao geral.

    UMA MISSAO GERAL NAO TEM HISTORICO — ela acontece uma vez. Entao o
    que este dossie mostra nao e serie temporal: e a FICHA do
    compromisso, com o que ele custou e de onde veio.

    Devolver a mesma forma da rotina, com tudo zerado, seria pior que
    devolver menos: taxa de 0%, corrente de 0 e recorde vazio fariam uma
    missao cumprida parecer um fracasso.
    """
    s = _segundos(t)
    st = (t.status or "PENDENTE").upper()

    # O XP CREDITADO NAO MORA NA TarefaDia. Ela tem `xp_recompensa` (o
    # prometido) e `penalidade_xp` (o preco de falhar), mas o que de fato
    # entrou no saldo passou por `aplicar_xp` e ficou em `Execucao` — com
    # bonus de streak, corte por atraso e tudo mais que o caminho aplica.
    #
    # A primeira versao deste motor lia `getattr(t, "xp_ganho", 0)`, um
    # campo que NAO EXISTE nesta tabela: devolvia zero em silencio, e uma
    # missao cumprida aparecia no dossie sem ter pago nada.
    ganho = 0
    if st == CONCLUIDA:
        linha = (db.query(Execucao)
                   .filter(Execucao.usuario_id == usuario.id,
                           Execucao.tarefa_id == t.id).first())
        ganho = int(getattr(linha, "xp_ganho", 0) or 0) if linha else 0

    return {
        "tipo": "geral",
        "titulo": t.titulo,
        "natureza": getattr(t, "natureza", "ATIVA"),
        "categoria": t.categoria,
        "prioridade": t.prioridade,
        "dificuldade": getattr(t, "dificuldade", "NORMAL"),
        "status": st,
        "data": t.data_prevista.isoformat() if t.data_prevista else None,
        "hora_limite": getattr(t, "hora_limite", None),
        "nasceu_em": t.criado_em.isoformat() if getattr(t, "criado_em", None) else None,
        "concluida_em": t.concluida_em.isoformat() if getattr(t, "concluida_em", None) else None,
        "duracao": s,
        "xp": {"ganho": ganho,
               "perdido": int(getattr(t, "penalidade_xp", 0) or 0) if st == FRACASSADA else 0,
               "prometido": int(getattr(t, "xp_recompensa", 0) or 0)},
        # De onde ela veio: penitencia tem dono, condicional tem pergunta.
        "origem_titulo": getattr(t, "origem_titulo", None),
        "origem_data": (t.origem_data.isoformat()
                        if getattr(t, "origem_data", None) else None),
        "eh_penitencia": (getattr(t, "natureza", "") or "").upper() == "PUNICAO",
        "teste": bool(getattr(t, "teste", False)),
    }
