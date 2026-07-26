# -*- coding: utf-8 -*-
"""
Extrato de Missões — o livro-caixa do hunter.

A distinção que este arquivo existe para sustentar:

    ROTINA   é a REGRA ("carregar Dolphin toda terça").  Vive na guia Rotinas.
    MISSÃO   é a OCORRÊNCIA ("carregar Dolphin em 14/07").  Vive aqui.

Uma rotina gera N missões ao longo do tempo, cada uma com identidade e destino
próprios: a de ontem pode ter fracassado e a de hoje estar em curso. Antes, a
tela pedia `/rotinas/hoje` e recebia TEMPLATES com um campo `status_hoje`
grudado — por isso o extrato não conseguia mostrar nenhum dia além de hoje.

Aqui as duas fontes viram uma coisa só:
  • ExecucaoDia  → missões nascidas de uma rotina  (origem="rotina")
  • TarefaDia    → missões gerais, de uso único    (origem="geral")

Como os dois IDs vêm de sequências diferentes, um `uid` ("r123"/"g45") dá ao
frontend uma chave única sem que precise saber de onde a missão veio.
"""
from datetime import date, datetime, timedelta
from motors import tempo, prazos
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db, Usuario, Rotina, ExecucaoDia, TarefaDia
from auth.router import get_usuario_atual
from motors import fechamento

router = APIRouter(prefix="/extrato", tags=["extrato"])

# Teto de segurança: o extrato é uma tela, não um dump do banco.
JANELA_MAXIMA_DIAS = 370
LIMITE_PADRAO = 500

# CONFESSADA entra aqui: é desfecho, não pendência. Sem ela, a missão
# confessada continuaria oferecendo botões de execução no cartão e contaria
# como "em aberto" no resumo do dia.
FINAIS = ("CONCLUIDA", "FRACASSADA", "CANCELADA", "CONFESSADA")


def _duracao(inicio, fim) -> int | None:
    """
    Quanto a missão levou, em segundos.

    Calculada AQUI, e não no navegador, de propósito: a subtração entre dois
    instantes é imune a fuso, enquanto o cliente teria de adivinhar em que
    fuso cada carimbo foi gravado. Devolvemos o número pronto; o cliente só
    formata.

    Devolve None quando a missão não foi iniciada ou ainda não terminou —
    "sem duração" é diferente de "durou zero".
    """
    if not inicio or not fim:
        return None
    segundos = int((fim - inicio).total_seconds())
    return segundos if segundos >= 0 else None


def _missao_de_rotina(ed: ExecucaoDia, r: Rotina, hoje: date) -> dict:
    """ExecucaoDia + a rotina-mãe → a forma canônica de missão."""
    return {
        "uid":        f"r{ed.id}",
        "id":         ed.id,               # identidade da OCORRÊNCIA
        "origem":     "rotina",
        "rotina_id":  r.id,                # identidade da REGRA (para editar)
        "data":       ed.data.isoformat() if ed.data else None,

        "titulo":     r.titulo,
        "descricao":  r.descricao,
        "categoria":  r.categoria,
        "prioridade": r.prioridade,
        "dificuldade": getattr(r, "dificuldade", "NORMAL") or "NORMAL",
        "icone":      r.icone,
        "cor":        r.cor,
        "tipo":       r.tipo,              # DIARIA | SEMANAL | MENSAL | ANUAL

        "status":     ed.status or "PENDENTE",
        "hora_inicio": getattr(r, "hora_inicio", None),
        "hora_fim":    getattr(r, "hora_fim", None),

        # Prometido pela regra
        "xp_recompensa":     r.xp_recompensa,
        "moedas_recompensa": r.moedas_recompensa,
        "penalidade_xp":     getattr(r, "penalidade_xp", 0) or 0,
        # Realizado nesta ocorrência
        "xp_ganho":      ed.xp_ganho      or 0,
        "moedas_ganhas": ed.moedas_ganhas or 0,
        "xp_perdido":    ed.xp_perdido    or 0,

        "iniciada_em":   ed.iniciada_em.isoformat()   if ed.iniciada_em   else None,
        "concluida_em":  ed.concluida_em.isoformat()  if ed.concluida_em  else None,
        "fracassada_em": ed.fracassada_em.isoformat() if ed.fracassada_em else None,
        "cancelada_em":  ed.cancelada_em.isoformat()  if ed.cancelada_em  else None,
        # Quanto levou, do play ao fim. Pronta para a tela apenas formatar.
        "duracao_segundos": _duracao(ed.iniciada_em, ed.concluida_em),

        # QUANDO VENCE. O cartão conta para este instante, não para a duração:
        # uma missão de janela iniciada faltando 10 minutos mostra 10 minutos,
        # não "acabou de começar". Calculado pelo servidor porque o relógio do
        # navegador é do hunter — e o placar não pode depender dele.
        **prazos.para_json(prazos.da_execucao(ed, r)),
        "reerguida": bool(getattr(ed, "reerguida", False)),
        "mana_gasta": getattr(ed, "mana_gasta", 0) or 0,

        # MISSÃO PASSIVA — o cartão precisa saber, porque tudo se inverte:
        # o botão vira Confessar, o desfecho do prazo é vitória, e o tom do
        # cronômetro é de vigília, não de corrida.
        "natureza": getattr(r, "natureza", "ATIVA") or "ATIVA",
        "confessada_em": ed.confessada_em.isoformat()
                         if getattr(ed, "confessada_em", None) else None,

        # Duas permissões diferentes, e confundi-las custa caro:
        #   editavel    → EXECUTAR (iniciar/concluir). Só faz sentido hoje:
        #                 ninguém conclui ontem, ninguém adianta amanhã.
        #   gerenciavel → EDITAR/EXCLUIR. Vale de hoje em diante; o passado é
        #                 histórico e não se reescreve.
        "editavel":    ed.data == hoje,
        "gerenciavel": ed.data >= hoje,
    }


def _missao_geral(t: TarefaDia, hoje: date) -> dict:
    """TarefaDia → a mesma forma canônica. Uso único, sem regra-mãe."""
    status = t.status or "PENDENTE"
    if status == "ATRASADA":          # vocabulário antigo → o do extrato
        status = "FRACASSADA"
    return {
        "uid":        f"g{t.id}",
        "id":         t.id,
        "origem":     "geral",
        "rotina_id":  None,
        "data":       t.data_prevista.isoformat() if t.data_prevista else None,

        "titulo":     t.titulo,
        "descricao":  t.descricao,
        "categoria":  t.categoria,
        "prioridade": t.prioridade,
        "dificuldade": getattr(t, "dificuldade", "NORMAL") or "NORMAL",
        "icone":      "🎯",
        "cor":        "#38bdf8",
        "tipo":       "AVULSA",

        "status":     status,
        "hora_inicio": None,
        "hora_fim":    t.hora_limite,

        "xp_recompensa":     t.xp_recompensa,
        "moedas_recompensa": t.moedas_recompensa,
        "penalidade_xp":     t.penalidade_xp or 0,
        "xp_ganho":      t.xp_recompensa     if status == "CONCLUIDA" else 0,
        "moedas_ganhas": t.moedas_recompensa if status == "CONCLUIDA" else 0,
        "xp_perdido":    (t.penalidade_xp or 0) if status == "FRACASSADA" else 0,

        "iniciada_em":   t.iniciada_em.isoformat() if getattr(t, "iniciada_em", None) else None,
        "concluida_em":  t.concluida_em.isoformat() if t.concluida_em else None,
        "fracassada_em": None,
        "cancelada_em":  None,
        "duracao_segundos": _duracao(getattr(t, "iniciada_em", None), t.concluida_em),

        # Missão geral: o prazo conta desde a INTENÇÃO (a criação), não desde
        # o play. Ver motors/prazos.py.
        **prazos.para_json(prazos.da_tarefa(t)),
        "reerguida": False,
        "mana_gasta": 0,
        # Missão geral nunca é passiva: passiva é protocolo que se repete.
        "natureza": "ATIVA",
        "confessada_em": None,

        "editavel":    t.data_prevista == hoje,
        "gerenciavel": t.data_prevista >= hoje if t.data_prevista else False,
    }


@router.get("/")
def listar_extrato(
    inicio:    Optional[date] = Query(None, description="Data inicial (padrão: 30 dias atrás)"),
    fim:       Optional[date] = Query(None, description="Data final (padrão: hoje)"),
    origem:    Optional[str]  = Query(None, description="rotina | geral"),
    status:    Optional[str]  = Query(None, description="PENDENTE|ATIVA|CONCLUIDA|FRACASSADA|CANCELADA"),
    categoria: Optional[str]  = Query(None),
    tipo:      Optional[str]  = Query(None, description="DIARIA|SEMANAL|MENSAL|ANUAL|AVULSA"),
    limite:    int            = Query(LIMITE_PADRAO, le=2000),
    db:        Session        = Depends(get_db),
    usuario:   Usuario        = Depends(get_usuario_atual),
):
    """
    Todas as missões do intervalo, das duas origens, mais novas primeiro.

    Antes de ler, põe a casa em dia: materializa as instâncias dos dias
    devidos e fecha as vencidas. Sem isso o extrato mostraria buracos nos
    dias em que o hunter não abriu o app — que é justamente quando ele mais
    precisa saber o que perdeu.
    """
    hoje = tempo.hoje()
    fim = fim or hoje
    inicio = inicio or (fim - timedelta(days=30))
    if (fim - inicio).days > JANELA_MAXIMA_DIAS:
        inicio = fim - timedelta(days=JANELA_MAXIMA_DIAS)

    # Põe a casa em dia (idempotente). Nunca derruba a leitura.
    try:
        fechamento.processar_usuario(db, usuario)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[EXTRATO] ⚠ fechamento adiado: {e}")

    missoes: list[dict] = []

    # ── Missões nascidas de rotinas ───────────────────────────────────
    if origem in (None, "", "rotina"):
        q = (db.query(ExecucaoDia, Rotina)
               .join(Rotina, Rotina.id == ExecucaoDia.rotina_id)
               .filter(ExecucaoDia.usuario_id == usuario.id,
                       ExecucaoDia.data >= inicio,
                       ExecucaoDia.data <= fim))
        if categoria:
            q = q.filter(Rotina.categoria == categoria)
        if tipo and tipo != "AVULSA":
            q = q.filter(Rotina.tipo == tipo.upper())
        # JOIN numa consulta só: nada de N+1 buscando a rotina de cada dia.
        for ed, r in q.all():
            missoes.append(_missao_de_rotina(ed, r, hoje))

    # ── Missões gerais ────────────────────────────────────────────────
    if origem in (None, "", "geral") and (not tipo or tipo == "AVULSA"):
        q2 = db.query(TarefaDia).filter(
            TarefaDia.usuario_id == usuario.id,
            TarefaDia.data_prevista >= inicio,
            TarefaDia.data_prevista <= fim,
        )
        if categoria:
            q2 = q2.filter(TarefaDia.categoria == categoria)
        for t in q2.all():
            missoes.append(_missao_geral(t, hoje))

    # Filtro de status depois da união: o vocabulário já está normalizado.
    if status:
        alvo = status.upper()
        missoes = [m for m in missoes if m["status"] == alvo]

    # Mais recentes primeiro; dentro do dia, o que ainda pede ação no topo.
    ORDEM_STATUS = {"ATIVA": 0, "PENDENTE": 1, "PAUSADA": 2,
                    "CONCLUIDA": 3, "FRACASSADA": 4, "CANCELADA": 5}
    missoes.sort(key=lambda m: (
        m["data"] or "",
        -ORDEM_STATUS.get(m["status"], 9),
    ), reverse=True)

    total = len(missoes)
    missoes = missoes[:limite]

    return {
        "inicio": inicio.isoformat(),
        "fim":    fim.isoformat(),
        "total":  total,
        "exibidas": len(missoes),
        "missoes": missoes,
    }


@router.get("/resumo")
def resumo_extrato(
    dias:    int     = Query(30, ge=1, le=JANELA_MAXIMA_DIAS),
    db:      Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Contadores do período — alimenta o cabeçalho do extrato."""
    hoje   = tempo.hoje()
    inicio = hoje - timedelta(days=dias)

    contagem = {"CONCLUIDA": 0, "FRACASSADA": 0, "PENDENTE": 0,
                "ATIVA": 0, "CANCELADA": 0}
    xp_ganho = xp_perdido = 0

    for ed in db.query(ExecucaoDia).filter(
        ExecucaoDia.usuario_id == usuario.id,
        ExecucaoDia.data >= inicio, ExecucaoDia.data <= hoje,
    ).all():
        contagem[ed.status] = contagem.get(ed.status, 0) + 1
        xp_ganho   += ed.xp_ganho   or 0
        xp_perdido += ed.xp_perdido or 0

    for t in db.query(TarefaDia).filter(
        TarefaDia.usuario_id == usuario.id,
        TarefaDia.data_prevista >= inicio, TarefaDia.data_prevista <= hoje,
    ).all():
        st = "FRACASSADA" if t.status == "ATRASADA" else (t.status or "PENDENTE")
        contagem[st] = contagem.get(st, 0) + 1
        if st == "CONCLUIDA":
            xp_ganho += t.xp_recompensa or 0

    finalizadas = contagem["CONCLUIDA"] + contagem["FRACASSADA"]
    return {
        "dias": dias,
        "contagem": contagem,
        "xp_ganho": xp_ganho,
        "xp_perdido": xp_perdido,
        "taxa_sucesso": round(contagem["CONCLUIDA"] / finalizadas * 100, 1) if finalizadas else None,
    }
