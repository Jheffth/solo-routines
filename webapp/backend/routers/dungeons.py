# -*- coding: utf-8 -*-
"""
Router de Dungeons — ambientes isolados com missões próprias.

Ciclo da sessão diária:  PENDENTE → ATIVA → CONCLUIDA | FRACASSADA | CANCELADA

Regra de ouro (isolamento): nada aqui cria/edita/conclui Rotina ou TarefaDia.
O único canal de saída para o resto do sistema é motors.gamificacao.aplicar_xp,
que credita XP/moedas/streak global no perfil do hunter.

Nota de tempo: este router usa _agora() que retorna a hora de Brasília (UTC-3)
para comparar com hora_entrada/hora_saida que são horários de parede do usuário.
"""
import json
import random
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime, timedelta, timezone, time as dtime
from motors import tempo

from database import (
    get_db, Usuario, Rotina,
    Dungeon, DungeonSessao, DungeonMissao, DungeonMissaoExecucao,
)
from auth.router import get_usuario_atual
from motors.celebracao import anexar
from motors.gamificacao import aplicar_xp
from motors import circuito

router = APIRouter(prefix="/dungeons", tags=["dungeons"])

# Fuso de Brasília: UTC-3
# O relógio agora mora em motors/tempo.py. Este arquivo foi quem primeiro
# acertou o fuso — e a lição custou caro no resto do sistema, que seguiu
# usando date.today() e passou a fracassar missões de hoje às 21h. Manter
# duas cópias do mesmo relógio é o que permite que elas divirjam.
_TZ_BRASILIA = tempo.FUSO

def _agora() -> datetime:
    """Hora atual no fuso de Brasília (UTC-3), sem tzinfo (naive), compatível com _parse_hhmm."""
    return datetime.now(tz=_TZ_BRASILIA).replace(tzinfo=None)

# Migração centralizada e agnóstica de banco: motors/migracao.py (roda no startup)

# ── Multiplicadores ──────────────────────────────────────────────────────────
_MULT_RANK   = {"E": 1.0, "D": 1.1, "C": 1.25, "B": 1.5, "A": 1.75, "S": 2.0}
_MULT_DIFIC  = {"FACIL": 0.75, "NORMAL": 1.0, "DIFICIL": 1.5, "LENDARIO": 2.5}
# Proporção do xp_clear pago conforme o rank obtido na saída
_MULT_CLEAR  = {"S": 1.0, "A": 0.8, "B": 0.6, "C": 0.4, "D": 0.25, "F": 0.0}

# ── AS NATUREZAS DO PORTÃO ───────────────────────────────────────────────────
#
# Estas tuplas existem porque as mesmas listas de naturezas estavam escritas
# à mão em vinte lugares deste arquivo. Cada natureza nova obrigava a caçar
# todas elas, e uma esquecida não quebra nada de imediato: a missão só some
# em silêncio de uma conta, de um armamento ou de uma punição. Nomeando os
# GRUPOS, uma natureza nova entra numa linha e o resto do arquivo obedece.
#
# MANUAIS   — o hunter começa e termina no braço. São as que expiram COM
#             punição se ele encerrar a sessão deixando-as para trás.
# ARMADAS   — nascem junto com a sessão, na travessia do portão.
# BONUS     — aparecem sozinhas, valem XP e nunca punem quem as ignora.
# CONTAVEIS — as que decidem o % de clear e, com ele, o rank do dia.
_NATUREZAS_MANUAIS   = ("PADRAO", "AGENDADA", "CIRCUITO", "META", "REPETICAO")
_NATUREZAS_ARMADAS   = _NATUREZAS_MANUAIS + ("RESISTENCIA",)
_NATUREZAS_BONUS     = ("EVENTO_ALEATORIO", "BEM_ESTAR")
_NATUREZAS_CONTAVEIS = _NATUREZAS_ARMADAS

# Sussurros do sistema (FLAVOR global — missões FLAVOR adicionam frases próprias)
_SUSSURROS = [
    "Você sente a pressão da masmorra ao seu redor...",
    "A entidade observa seu progresso em silêncio.",
    "As paredes desta dungeon já viram muitos hunters desistirem. Você não é um deles.",
    "Algo se move nas sombras. Continue focado.",
    "O Sistema registra cada segundo da sua permanência.",
    "Mana flui pelo ambiente. Aproveite enquanto dura.",
    "Hunters comuns já teriam saído. Você ainda está aqui.",
    "O portão permanece estável. Por enquanto.",
    "Sua presença fortalece o selo desta masmorra.",
    "Nível de ameaça constante. Mantenha o ritmo, Hunter.",
]


def _mult(d: Dungeon) -> float:
    return _MULT_RANK.get(d.rank, 1.0) * _MULT_DIFIC.get(d.dificuldade, 1.0)


def _pen_missao(m: DungeonMissao, mult: float) -> int:
    """Penalidade de uma missão contável falhada. null = auto (50% da recompensa)."""
    base = getattr(m, "penalidade_xp", None)
    if base is None:
        base = int((m.xp_recompensa or 0) * 0.5)
    return max(0, int(base * mult))


def _punir_missao(db: Session, usuario: Usuario, s: DungeonSessao,
                  e: DungeonMissaoExecucao, m: DungeonMissao, mult: float) -> int:
    """
    Aplica a penalidade de missão falhada (cancelada/expirada/não cumprida).
    Em modo teste apenas simula (registra nos números da sessão, perfil intacto).
    Retorna o valor aplicado.
    """
    pen = _pen_missao(m, mult)
    if pen <= 0:
        return 0
    e.xp_perdido = (getattr(e, "xp_perdido", 0) or 0) + pen
    s.xp_perdido = (s.xp_perdido or 0) + pen
    if not s.modo_teste:
        usuario.xp_total = max(0, (usuario.xp_total or 0) - pen)
        usuario.xp_atual = max(0, (usuario.xp_atual or 0) - pen)
    return pen


# ── Schemas ──────────────────────────────────────────────────────────────────
class MissaoCreate(BaseModel):
    titulo:             str
    descricao:          Optional[str] = None
    icone:              str           = "⚔️"
    tipo:               str           = "ATIVA"    # ATIVA | PASSIVA
    natureza:           str           = "PADRAO"   # PADRAO|AGENDADA|RESISTENCIA|EVENTO_ALEATORIO|BEM_ESTAR|FLAVOR
    xp_recompensa:      int           = 30
    moedas_recompensa:  int           = 3
    penalidade_xp:      Optional[int] = None        # null = auto (50%); 0 = sem punição
    intervalo_min:      Optional[int] = None
    meta_minutos:       Optional[int] = None
    janela_disparo_min: Optional[int] = None
    janela_disparo_max: Optional[int] = None
    expira_em_min:      Optional[int] = 5
    dias_semana:        Optional[List[int]] = None  # só aparece nesses dias (null = todos)
    hora_inicio:        Optional[str] = None        # AGENDADA: "15:00"
    hora_limite:        Optional[str] = None        # AGENDADA: "16:00"
    # CIRCUITO: os blocos, no mesmo formato do mundo de fora (motors/circuito)
    circuito_payload:   Optional[dict] = None
    # META: um alvo numérico a perseguir dentro da sessão
    meta_alvo:          Optional[float] = None
    meta_unidade:       Optional[str]   = None      # "km", "pág", "L"...
    meta_especie:       Optional[str]   = None      # SOMA | MEDIA | PICO
    meta_modo:          Optional[str]   = None      # SUBIR | DESCER
    meta_inicial:       Optional[float] = None
    # REPETICAO: N vezes dentro da mesma travessia
    alvo_repeticoes:    Optional[int]   = None


class MissaoUpdate(BaseModel):
    titulo:             Optional[str] = None
    descricao:          Optional[str] = None
    icone:              Optional[str] = None
    tipo:               Optional[str] = None
    natureza:           Optional[str] = None
    xp_recompensa:      Optional[int] = None
    moedas_recompensa:  Optional[int] = None
    penalidade_xp:      Optional[int] = None
    intervalo_min:      Optional[int] = None
    meta_minutos:       Optional[int] = None
    janela_disparo_min: Optional[int] = None
    janela_disparo_max: Optional[int] = None
    expira_em_min:      Optional[int] = None
    ativo:              Optional[bool] = None
    dias_semana:        Optional[List[int]] = None
    hora_inicio:        Optional[str] = None
    hora_limite:        Optional[str] = None
    circuito_payload:   Optional[dict]  = None
    meta_alvo:          Optional[float] = None
    meta_unidade:       Optional[str]   = None
    meta_especie:       Optional[str]   = None
    meta_modo:          Optional[str]   = None
    meta_inicial:       Optional[float] = None
    alvo_repeticoes:    Optional[int]   = None


class DungeonCreate(BaseModel):
    titulo:                str
    descricao:             Optional[str]       = None
    tipo_permanencia:      str                 = "PERMANENTE"
    tipo_recorrencia:      str                 = "DIARIA"
    dias_semana:           Optional[List[int]] = None
    dia_mes:               Optional[int]       = None
    mes_dia:               Optional[str]       = None
    data_inicio:           Optional[date]      = None
    data_fim:              Optional[date]      = None
    hora_entrada:          Optional[str]       = None
    hora_saida:            Optional[str]       = None
    tolerancia_min:        int                 = 10
    sempre_aberta:         bool                = False  # o portão que não fecha
    agenda_semanal:        Optional[dict]      = None   # {"0":{"aberto":true,"entrada":"08:00","saida":"17:30"},...}
    folgas:                Optional[List[str]] = None   # ["2026-07-22", ...]
    categoria:             str                 = "Pessoal"
    rank:                  str                 = "E"
    dificuldade:           str                 = "NORMAL"
    icone:                 str                 = "🌀"
    cor:                   str                 = "#7c3aed"
    tema_ambiente:         Optional[str]       = None
    xp_entrada:            Optional[int]       = None
    xp_clear:              Optional[int]       = None
    moedas_clear:          Optional[int]       = None
    penalidade_entrada_xp: Optional[int]       = None
    penalidade_atraso_xp:  Optional[int]       = None
    missoes:               Optional[List[MissaoCreate]] = None


class DungeonUpdate(BaseModel):
    titulo:                Optional[str]       = None
    descricao:             Optional[str]       = None
    tipo_permanencia:      Optional[str]       = None
    tipo_recorrencia:      Optional[str]       = None
    dias_semana:           Optional[List[int]] = None
    dia_mes:               Optional[int]       = None
    mes_dia:               Optional[str]       = None
    data_inicio:           Optional[date]      = None
    data_fim:              Optional[date]      = None
    hora_entrada:          Optional[str]       = None
    hora_saida:            Optional[str]       = None
    tolerancia_min:        Optional[int]       = None
    sempre_aberta:         Optional[bool]      = None
    agenda_semanal:        Optional[dict]      = None
    folgas:                Optional[List[str]] = None
    categoria:             Optional[str]       = None
    rank:                  Optional[str]       = None
    dificuldade:           Optional[str]       = None
    icone:                 Optional[str]       = None
    cor:                   Optional[str]       = None
    tema_ambiente:         Optional[str]       = None
    xp_entrada:            Optional[int]       = None
    xp_clear:              Optional[int]       = None
    moedas_clear:          Optional[int]       = None
    penalidade_entrada_xp: Optional[int]       = None
    penalidade_atraso_xp:  Optional[int]       = None
    status:                Optional[str]       = None


# ── Helpers de tempo/recorrência ─────────────────────────────────────────────
def _parse_hhmm(hhmm: Optional[str], dia: date) -> Optional[datetime]:
    if not hhmm:
        return None
    try:
        h, m = hhmm.split(":")
        return datetime(dia.year, dia.month, dia.day, int(h), int(m))
    except Exception:
        return None


def _agenda_do_dia(d: Dungeon, dia: date) -> Optional[dict]:
    """Config da agenda semanal para o weekday do dia (None = sem override)."""
    try:
        agenda = json.loads(d.agenda_semanal) if getattr(d, "agenda_semanal", None) else {}
        return agenda.get(str(dia.weekday()))
    except Exception:
        return None


def _horario_do_dia(d: Dungeon, dia: date) -> tuple:
    """(hora_entrada, hora_saida) do dia — override da agenda semanal ou padrão."""
    cfg = _agenda_do_dia(d, dia)
    if cfg:
        return (cfg.get("entrada") or d.hora_entrada, cfg.get("saida") or d.hora_saida)
    return (d.hora_entrada, d.hora_saida)


def _eh_folga(d: Dungeon, dia: date) -> bool:
    try:
        folgas = json.loads(d.folgas) if getattr(d, "folgas", None) else []
        return dia.isoformat() in folgas
    except Exception:
        return False


def _eh_dungeon_de_hoje(d: Dungeon, hoje: date) -> bool:
    """A dungeon é devida hoje?"""
    if d.status != "ATIVA":
        return False
    # Folga programada (data específica) tranca o portão
    if _eh_folga(d, hoje):
        return False
    # Agenda semanal com dia explicitamente fechado
    cfg = _agenda_do_dia(d, hoje)
    if cfg is not None and not cfg.get("aberto", True):
        return False
    if d.tipo_permanencia == "TEMPORARIA":
        ini = d.data_inicio or hoje
        fim = d.data_fim or hoje
        return ini <= hoje <= fim
    # PERMANENTE — mesma convenção de Rotina
    t = d.tipo_recorrencia or "DIARIA"
    if t == "DIARIA":
        return True
    if t == "SEMANAL":
        dias = json.loads(d.dias_semana) if d.dias_semana else []
        return hoje.weekday() in dias
    if t == "MENSAL":
        return hoje.day == d.dia_mes
    if t == "ANUAL" and d.mes_dia:
        try:
            m, dd = d.mes_dia.split("-")
            return hoje.month == int(m) and hoje.day == int(dd)
        except Exception:
            return False
    return False


def _missao_eh_de_hoje(m: DungeonMissao, hoje: date) -> bool:
    """A missão aparece hoje? (dias_semana da missão; null = todos os dias)"""
    try:
        dias = json.loads(m.dias_semana) if getattr(m, "dias_semana", None) else None
        return dias is None or len(dias) == 0 or hoje.weekday() in dias
    except Exception:
        return True


def _obter_ou_criar_sessao(db: Session, d: Dungeon, usuario_id: int, hoje: date,
                           teste: bool = False) -> DungeonSessao:
    """Sessão do dia. teste=True busca/cria a sessão paralela do Arquiteto (nunca credita XP)."""
    q = db.query(DungeonSessao).filter(
        DungeonSessao.dungeon_id == d.id,
        DungeonSessao.usuario_id == usuario_id,
        DungeonSessao.data       == hoje,
        DungeonSessao.modo_teste == teste,
    )
    s = q.first()
    if not s:
        s = DungeonSessao(dungeon_id=d.id, usuario_id=usuario_id, data=hoje,
                          status="PENDENTE", modo_teste=teste)
        db.add(s)
        try:
            db.commit()
            db.refresh(s)
        except Exception:
            db.rollback()
            s = q.first()
    return s


def _verificar_no_show(db: Session, d: Dungeon, s: DungeonSessao, usuario: Usuario) -> DungeonSessao:
    """
    Fracasso automático por no-show: o portão fica ABERTO durante toda a
    janela — quem atrasa entra (e é punido na entrada). Só fracassa quem
    não atravessou até a hora de SAÍDA do dia.
    """
    # O PORTÃO QUE NÃO FECHA NÃO TEM NO-SHOW. Não há hora de saída para
    # perder, então não há como chegar tarde demais — a dungeon existe o
    # dia inteiro e o hunter entra quando puder.
    if getattr(d, "sempre_aberta", False):
        return s
    _h_entrada, h_saida = _horario_do_dia(d, s.data)
    if s.status != "PENDENTE" or not h_saida:
        return s
    agora = _agora()
    prazo = _parse_hhmm(h_saida, s.data)
    if not prazo or agora <= prazo:
        return s

    pen = d.penalidade_entrada_xp or 0
    s.status        = "FRACASSADA"
    s.fracassada_em = agora
    s.rank_obtido   = "F"
    s.xp_perdido    = pen
    d.streak_atual  = 0
    if pen > 0:
        usuario.xp_total = max(0, (usuario.xp_total or 0) - pen)
        usuario.xp_atual = max(0, (usuario.xp_atual or 0) - pen)
    db.commit()
    db.refresh(s)
    return s


# ── Serializers ──────────────────────────────────────────────────────────────
def _missao_to_dict(m: DungeonMissao) -> dict:
    try:
        dias = json.loads(m.dias_semana) if getattr(m, "dias_semana", None) else None
    except Exception:
        dias = None
    return {
        "id": m.id, "dungeon_id": m.dungeon_id,
        "titulo": m.titulo, "descricao": m.descricao, "icone": m.icone,
        "tipo": m.tipo, "natureza": m.natureza,
        "xp_recompensa": m.xp_recompensa, "moedas_recompensa": m.moedas_recompensa,
        "penalidade_xp": getattr(m, "penalidade_xp", None),
        "intervalo_min": m.intervalo_min, "meta_minutos": m.meta_minutos,
        "janela_disparo_min": m.janela_disparo_min, "janela_disparo_max": m.janela_disparo_max,
        "expira_em_min": m.expira_em_min, "ativo": m.ativo,
        "dias_semana": dias,
        "hora_inicio": getattr(m, "hora_inicio", None),
        "hora_limite": getattr(m, "hora_limite", None),
        # `para_json` lê os ATRIBUTOS do objeto (`circuito_payload` e
        # `circuito_feito`), não os valores crus. Na dungeon o desenho e o
        # registro moram na mesma linha, então `m` faz os dois papéis.
        "circuito": circuito.para_json(m, m),
        "meta_alvo": getattr(m, "meta_alvo", None),
        "meta_unidade": getattr(m, "meta_unidade", None),
        "meta_especie": getattr(m, "meta_especie", None),
        "meta_modo": getattr(m, "meta_modo", None),
        "meta_inicial": getattr(m, "meta_inicial", None),
        "meta_atual": getattr(m, "meta_atual", 0) or 0,
        "alvo_repeticoes": getattr(m, "alvo_repeticoes", None),
        "repeticoes": getattr(m, "repeticoes", 0) or 0,
    }


def _exec_to_dict(e: DungeonMissaoExecucao, m: DungeonMissao = None) -> dict:
    return {
        "id": e.id,
        "dungeon_missao_id": e.dungeon_missao_id,
        "dungeon_sessao_id": e.dungeon_sessao_id,
        "status": e.status,
        "progresso_pct": round(e.progresso_pct or 0.0, 1),
        "disparada_em": e.disparada_em.isoformat() if e.disparada_em else None,
        "concluida_em": e.concluida_em.isoformat() if e.concluida_em else None,
        "xp_ganho": e.xp_ganho, "moedas_ganhas": e.moedas_ganhas,
        "xp_perdido": getattr(e, "xp_perdido", 0) or 0,
        "missao": _missao_to_dict(m or e.missao),
    }


def _sessao_to_dict(s: DungeonSessao) -> dict:
    if not s:
        return None
    return {
        "id": s.id, "dungeon_id": s.dungeon_id, "data": s.data.isoformat(),
        "status": s.status,
        "modo_teste": bool(getattr(s, "modo_teste", False)),
        "entrada_em": s.entrada_em.isoformat() if s.entrada_em else None,
        "saida_em": s.saida_em.isoformat() if s.saida_em else None,
        "reaberta_em": (s.reaberta_em.isoformat()
                        if getattr(s, "reaberta_em", None) else None),
        "visitas": int(getattr(s, "visitas", 0) or 0),
        "clear_xp_pago": int(getattr(s, "clear_xp_pago", 0) or 0),
        "clear_moedas_pago": int(getattr(s, "clear_moedas_pago", 0) or 0),
        "fracassada_em": s.fracassada_em.isoformat() if s.fracassada_em else None,
        "atraso_minutos": s.atraso_minutos or 0,
        "tempo_total_min": s.tempo_total_min or 0,
        "pct_missoes_concluidas": round(s.pct_missoes_concluidas or 0.0, 1),
        "rank_obtido": s.rank_obtido,
        "xp_ganho": s.xp_ganho or 0, "xp_perdido": s.xp_perdido or 0,
        "moedas_ganhas": s.moedas_ganhas or 0,
    }


def _dungeon_to_dict(d: Dungeon, sessao: DungeonSessao = None, hoje: date = None,
                     incluir_missoes: bool = False) -> dict:
    hoje = hoje or tempo.hoje()
    out = {
        "id": d.id, "titulo": d.titulo, "descricao": d.descricao,
        "tipo_permanencia": d.tipo_permanencia, "tipo_recorrencia": d.tipo_recorrencia,
        "dias_semana": json.loads(d.dias_semana) if d.dias_semana else [],
        "dia_mes": d.dia_mes, "mes_dia": d.mes_dia,
        "data_inicio": d.data_inicio.isoformat() if d.data_inicio else None,
        "data_fim": d.data_fim.isoformat() if d.data_fim else None,
        "hora_entrada": d.hora_entrada, "hora_saida": d.hora_saida,
        "hora_entrada_hoje": _horario_do_dia(d, hoje)[0],
        "hora_saida_hoje": _horario_do_dia(d, hoje)[1],
        "folga_hoje": _eh_folga(d, hoje),
        "agenda_semanal": (json.loads(d.agenda_semanal) if getattr(d, "agenda_semanal", None) else None),
        "folgas": (json.loads(d.folgas) if getattr(d, "folgas", None) else []),
        "tolerancia_min": d.tolerancia_min,
        "sempre_aberta": bool(getattr(d, "sempre_aberta", False)),
        "categoria": d.categoria, "rank": d.rank, "dificuldade": d.dificuldade,
        "icone": d.icone, "cor": d.cor, "tema_ambiente": d.tema_ambiente,
        "xp_entrada": d.xp_entrada, "xp_clear": d.xp_clear, "moedas_clear": d.moedas_clear,
        "penalidade_entrada_xp": d.penalidade_entrada_xp,
        "penalidade_atraso_xp": d.penalidade_atraso_xp,
        "streak_atual": d.streak_atual or 0, "streak_max": d.streak_max or 0,
        "status": d.status,
        "devida_hoje": _eh_dungeon_de_hoje(d, hoje),
        "criado_em": d.criado_em.isoformat() if d.criado_em else None,
        "total_missoes": d.missoes.filter(DungeonMissao.ativo == True).count(),
        "sessao_hoje": _sessao_to_dict(sessao),
    }
    if incluir_missoes:
        out["missoes"] = [
            _missao_to_dict(m) for m in
            d.missoes.filter(DungeonMissao.ativo == True).order_by(DungeonMissao.id).all()
        ]
    return out


def _criar_missao(d_id: int, p: MissaoCreate) -> DungeonMissao:
    tipo = p.tipo.upper()
    nat  = p.natureza.upper()
    # Naturezas passivas forçam tipo PASSIVA; AGENDADA é ativa; FLAVOR nunca dá XP
    if nat in ("RESISTENCIA", "EVENTO_ALEATORIO", "BEM_ESTAR", "FLAVOR"):
        tipo = "PASSIVA"
    elif nat in _NATUREZAS_MANUAIS:
        tipo = "ATIVA"
    # `circuito.normalizar` nunca levanta: payload torto vira None e a missão
    # continua existindo como uma missão comum. Um portão não pode ficar
    # impossível de criar porque um bloco veio malformado.
    desenho = circuito.normalizar(p.circuito_payload) if nat == "CIRCUITO" else None
    xp  = 0 if nat == "FLAVOR" else p.xp_recompensa
    mc  = 0 if nat == "FLAVOR" else p.moedas_recompensa
    pen = 0 if nat == "FLAVOR" else p.penalidade_xp
    return DungeonMissao(
        dungeon_id=d_id, titulo=p.titulo, descricao=p.descricao, icone=p.icone,
        tipo=tipo, natureza=nat, xp_recompensa=xp, moedas_recompensa=mc,
        penalidade_xp=pen,
        intervalo_min=p.intervalo_min, meta_minutos=p.meta_minutos,
        janela_disparo_min=p.janela_disparo_min, janela_disparo_max=p.janela_disparo_max,
        expira_em_min=p.expira_em_min or 5, ativo=True,
        dias_semana=json.dumps(p.dias_semana) if p.dias_semana else None,
        hora_inicio=p.hora_inicio, hora_limite=p.hora_limite,
        # As naturezas pesadas viajam pelo mesmo motor do mundo de fora
        circuito_payload=json.dumps(desenho) if desenho else None,
        meta_alvo=p.meta_alvo if nat == "META" else None,
        meta_unidade=p.meta_unidade if nat == "META" else None,
        meta_especie=(p.meta_especie or "SOMA").upper() if nat == "META" else None,
        meta_modo=(p.meta_modo or "SUBIR").upper() if nat == "META" else None,
        meta_inicial=p.meta_inicial if nat == "META" else None,
        meta_atual=(p.meta_inicial or 0) if nat == "META" else 0,
        alvo_repeticoes=p.alvo_repeticoes if nat == "REPETICAO" else None,
    )


# ══════════════════════════════════════════════════════════════════════════════
# CRUD DE DUNGEONS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/")
def listar_dungeons(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    hoje = tempo.hoje()
    resultado = []

    # Higiene: sessões PENDENTES de dias anteriores = no-show consumado
    pendentes_antigas = db.query(DungeonSessao).filter(
        DungeonSessao.usuario_id == usuario.id,
        DungeonSessao.status == "PENDENTE",
        DungeonSessao.modo_teste == False,
        DungeonSessao.data < hoje,
    ).all()
    for sp in pendentes_antigas:
        dp = sp.dungeon
        # O PORTÃO QUE NÃO FECHA NÃO TEM NO-SHOW — nem com atraso de um dia.
        # `_verificar_no_show` já respeita isso; esta varredura corria por
        # fora e puniria o mesmo hunter pela porta dos fundos, cobrando a
        # penalidade de entrada por um portão que nunca marcou hora.
        if getattr(dp, "sempre_aberta", False):
            sp.status      = "EXPIRADA"
            sp.rank_obtido = None
            continue
        pen = dp.penalidade_entrada_xp or 0
        sp.status        = "FRACASSADA"
        sp.fracassada_em = _agora()
        sp.rank_obtido   = "F"
        sp.xp_perdido    = pen
        dp.streak_atual  = 0
        if pen > 0:
            usuario.xp_total = max(0, (usuario.xp_total or 0) - pen)
            usuario.xp_atual = max(0, (usuario.xp_atual or 0) - pen)
    if pendentes_antigas:
        db.commit()

    # Higiene: fecha sessões ATIVAS esquecidas de dias anteriores
    # (usuário fechou o app sem check-out — resolve sem crédito de clear)
    antigas = db.query(DungeonSessao).filter(
        DungeonSessao.usuario_id == usuario.id,
        DungeonSessao.status.in_(("ATIVA", "SUSPENSA")),
        DungeonSessao.data < hoje,
    ).all()
    for sa in antigas:
        # SUSPENDER NÃO É ESQUECER. Quem sai de um portão aberto sai de
        # propósito, deixando o trabalho feito para trás — e o dia dele
        # acaba com o clear pago, não confiscado. A regra do esquecimento
        # continua valendo só para o portão comum, onde sair já era
        # encerrar e ficar ATIVA de um dia para o outro é descuido.
        if getattr(sa.dungeon, "sempre_aberta", False):
            _resolver_sessao(db, sa.dungeon, sa, usuario,
                             agora=datetime.combine(sa.data, dtime(23, 59, 59)),
                             credita=True, auto=True)
            continue
        execs_a = db.query(DungeonMissaoExecucao).filter(
            DungeonMissaoExecucao.dungeon_sessao_id == sa.id
        ).all()
        cont = [e for e in execs_a if e.missao.natureza in _NATUREZAS_CONTAVEIS]
        conc = [e for e in cont if e.status == "CONCLUIDA"]
        pct  = (len(conc) / len(cont) * 100.0) if cont else 100.0
        sa.pct_missoes_concluidas = pct
        sa.rank_obtido = "S" if pct >= 90 else "A" if pct >= 70 else "B" if pct >= 50 else "C" if pct >= 30 else "D"
        sa.status   = "CONCLUIDA"
        sa.saida_em = sa.ultimo_heartbeat_em or sa.entrada_em
    if antigas:
        db.commit()

    q = db.query(Dungeon).filter(
        Dungeon.usuario_id == usuario.id,
        Dungeon.status != "ARQUIVADA",
    ).order_by(Dungeon.criado_em.desc())

    for d in q.all():
        # Arquiva temporárias vencidas automaticamente
        if d.tipo_permanencia == "TEMPORARIA" and d.data_fim and d.data_fim < hoje:
            d.status = "ARQUIVADA"
            db.commit()
            continue
        s = None
        if _eh_dungeon_de_hoje(d, hoje):
            s = _obter_ou_criar_sessao(db, d, usuario.id, hoje)
            s = _verificar_no_show(db, d, s, usuario)
            _verificar_saida_automatica(db, d, s, usuario)
        resultado.append(_dungeon_to_dict(d, sessao=s, hoje=hoje))
    return resultado


@router.post("/", status_code=201)
def criar_dungeon(
    payload: DungeonCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    rank  = payload.rank.upper()
    mult  = _MULT_RANK.get(rank, 1.0) * _MULT_DIFIC.get(payload.dificuldade.upper(), 1.0)

    d = Dungeon(
        titulo=payload.titulo, descricao=payload.descricao,
        tipo_permanencia=payload.tipo_permanencia.upper(),
        tipo_recorrencia=payload.tipo_recorrencia.upper(),
        dias_semana=json.dumps(payload.dias_semana) if payload.dias_semana else None,
        dia_mes=payload.dia_mes, mes_dia=payload.mes_dia,
        data_inicio=payload.data_inicio, data_fim=payload.data_fim,
        hora_entrada=payload.hora_entrada, hora_saida=payload.hora_saida,
        tolerancia_min=payload.tolerancia_min,
        sempre_aberta=bool(payload.sempre_aberta),
        agenda_semanal=json.dumps(payload.agenda_semanal) if payload.agenda_semanal else None,
        folgas=json.dumps(payload.folgas) if payload.folgas else None,
        categoria=payload.categoria, rank=rank,
        dificuldade=payload.dificuldade.upper(),
        icone=payload.icone, cor=payload.cor,
        tema_ambiente=payload.tema_ambiente or payload.categoria,
        xp_entrada=payload.xp_entrada if payload.xp_entrada is not None else int(25 * mult),
        xp_clear=payload.xp_clear if payload.xp_clear is not None else int(100 * mult),
        moedas_clear=payload.moedas_clear if payload.moedas_clear is not None else int(10 * mult),
        penalidade_entrada_xp=payload.penalidade_entrada_xp if payload.penalidade_entrada_xp is not None else int(50 * mult),
        penalidade_atraso_xp=payload.penalidade_atraso_xp if payload.penalidade_atraso_xp is not None else int(15 * mult),
        status="ATIVA", usuario_id=usuario.id,
    )
    db.add(d)
    db.commit()
    db.refresh(d)

    for mp in (payload.missoes or []):
        db.add(_criar_missao(d.id, mp))
    if payload.missoes:
        db.commit()

    return _dungeon_to_dict(d, incluir_missoes=True)


@router.get("/acervo/missoes")
def acervo_de_missoes(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    O ACERVO — tudo que o hunter já escreveu, pronto para ser reaproveitado.

    Pedido do Arquiteto: "considerando também reaproveitar e reformular as
    missões". Toda missão que ele forja é uma frase pensada — o horário
    certo, o XP calibrado, o ícone escolhido. Obrigá-lo a reescrever a
    mesma coisa em cada portão novo é o tipo de atrito que faz alguém
    parar de criar dungeons.

    Devolve missões de OUTROS portões e as rotinas do mundo de fora,
    achatadas no mesmo formato do quadro. Vem como MOLDE, nunca como
    vínculo: alterar a cópia não toca no original, senão mudar o XP de um
    portão mudaria o de outro sem ninguém pedir.
    """
    vistos = set()
    acervo = []

    q = (db.query(DungeonMissao, Dungeon.titulo)
           .join(Dungeon, DungeonMissao.dungeon_id == Dungeon.id)
           .filter(Dungeon.usuario_id == usuario.id,
                   DungeonMissao.ativo == True)
           .order_by(DungeonMissao.id.desc()))
    for m, dtitulo in q.all():
        chave = ((m.titulo or "").strip().lower(), m.natureza)
        if chave in vistos:
            continue
        vistos.add(chave)
        molde = _missao_to_dict(m)
        molde.pop("id", None)
        molde.pop("dungeon_id", None)
        molde["fonte"] = dtitulo
        acervo.append(molde)

    # As rotinas do mundo de fora entram como PADRAO: elas não têm a
    # mecânica do portão, só o texto e o peso. É molde, não migração.
    rot = (db.query(Rotina)
             .filter(Rotina.usuario_id == usuario.id,
                     Rotina.ativo == True,
                     Rotina.status == "ATIVA")
             .order_by(Rotina.id.desc()).limit(40).all())
    for r in rot:
        chave = ((r.titulo or "").strip().lower(), "PADRAO")
        if chave in vistos:
            continue
        vistos.add(chave)
        acervo.append({
            "titulo": r.titulo, "descricao": r.descricao,
            "icone": getattr(r, "icone", None) or "⚔️",
            "tipo": "ATIVA", "natureza": "PADRAO",
            "xp_recompensa": r.xp_recompensa or 30,
            "moedas_recompensa": r.moedas_recompensa or 3,
            "penalidade_xp": None,
            "expira_em_min": 5, "dias_semana": None,
            "hora_inicio": None, "hora_limite": None,
            "fonte": "Rotina",
        })

    return {"acervo": acervo[:120]}


@router.get("/{dungeon_id}")
def obter_dungeon(
    dungeon_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    d = db.query(Dungeon).filter(
        Dungeon.id == dungeon_id, Dungeon.usuario_id == usuario.id
    ).first()
    if not d:
        raise HTTPException(404, "Dungeon não encontrada")
    hoje = tempo.hoje()
    s = None
    if _eh_dungeon_de_hoje(d, hoje):
        s = _obter_ou_criar_sessao(db, d, usuario.id, hoje)
        s = _verificar_no_show(db, d, s, usuario)
        _verificar_saida_automatica(db, d, s, usuario)
    return _dungeon_to_dict(d, sessao=s, hoje=hoje, incluir_missoes=True)


@router.put("/{dungeon_id}")
def atualizar_dungeon(
    dungeon_id: int,
    payload: DungeonUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    d = db.query(Dungeon).filter(
        Dungeon.id == dungeon_id, Dungeon.usuario_id == usuario.id
    ).first()
    if not d:
        raise HTTPException(404, "Dungeon não encontrada")

    data = payload.dict(exclude_unset=True)
    if "dias_semana" in data and data["dias_semana"] is not None:
        data["dias_semana"] = json.dumps(data["dias_semana"])
    if "agenda_semanal" in data:
        data["agenda_semanal"] = json.dumps(data["agenda_semanal"]) if data["agenda_semanal"] else None
    if "folgas" in data:
        data["folgas"] = json.dumps(data["folgas"]) if data["folgas"] is not None else None
    for campo in ("tipo_permanencia", "tipo_recorrencia", "rank", "dificuldade", "status"):
        if campo in data and data[campo] is not None:
            data[campo] = data[campo].upper()
    for k, v in data.items():
        setattr(d, k, v)
    db.commit()
    db.refresh(d)
    return _dungeon_to_dict(d, incluir_missoes=True)


@router.delete("/{dungeon_id}")
def deletar_dungeon(
    dungeon_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    d = db.query(Dungeon).filter(
        Dungeon.id == dungeon_id, Dungeon.usuario_id == usuario.id
    ).first()
    if not d:
        raise HTTPException(404, "Dungeon não encontrada")

    sess_ids = [s.id for s in db.query(DungeonSessao.id).filter(DungeonSessao.dungeon_id == d.id).all()]
    if sess_ids:
        db.query(DungeonMissaoExecucao).filter(
            DungeonMissaoExecucao.dungeon_sessao_id.in_(sess_ids)
        ).delete(synchronize_session=False)
    db.query(DungeonSessao).filter(DungeonSessao.dungeon_id == d.id).delete(synchronize_session=False)
    db.query(DungeonMissao).filter(DungeonMissao.dungeon_id == d.id).delete(synchronize_session=False)
    db.delete(d)
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# CRUD DE MISSÕES DA DUNGEON
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/{dungeon_id}/missoes", status_code=201)
def criar_missao(
    dungeon_id: int,
    payload: MissaoCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    d = db.query(Dungeon).filter(
        Dungeon.id == dungeon_id, Dungeon.usuario_id == usuario.id
    ).first()
    if not d:
        raise HTTPException(404, "Dungeon não encontrada")
    m = _criar_missao(d.id, payload)
    db.add(m)
    db.commit()
    db.refresh(m)
    return _missao_to_dict(m)


@router.put("/missoes/{missao_id}")
def atualizar_missao(
    missao_id: int,
    payload: MissaoUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    m = db.query(DungeonMissao).join(Dungeon).filter(
        DungeonMissao.id == missao_id, Dungeon.usuario_id == usuario.id
    ).first()
    if not m:
        raise HTTPException(404, "Missão não encontrada")
    data = payload.dict(exclude_unset=True)
    for campo in ("tipo", "natureza"):
        if campo in data and data[campo] is not None:
            data[campo] = data[campo].upper()
    if "dias_semana" in data:
        data["dias_semana"] = json.dumps(data["dias_semana"]) if data["dias_semana"] else None
    if "circuito_payload" in data:
        desenho = circuito.normalizar(data["circuito_payload"])
        data["circuito_payload"] = json.dumps(desenho) if desenho else None
    for campo in ("meta_especie", "meta_modo"):
        if data.get(campo):
            data[campo] = data[campo].upper()
    for k, v in data.items():
        setattr(m, k, v)
    if m.natureza in ("RESISTENCIA", "EVENTO_ALEATORIO", "BEM_ESTAR", "FLAVOR"):
        m.tipo = "PASSIVA"
    elif m.natureza in _NATUREZAS_MANUAIS:
        m.tipo = "ATIVA"
    if m.natureza == "FLAVOR":
        m.xp_recompensa = 0
        m.moedas_recompensa = 0
    db.commit()
    db.refresh(m)
    return _missao_to_dict(m)


@router.delete("/missoes/{missao_id}")
def deletar_missao(
    missao_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    m = db.query(DungeonMissao).join(Dungeon).filter(
        DungeonMissao.id == missao_id, Dungeon.usuario_id == usuario.id
    ).first()
    if not m:
        raise HTTPException(404, "Missão não encontrada")
    db.query(DungeonMissaoExecucao).filter(
        DungeonMissaoExecucao.dungeon_missao_id == m.id
    ).delete(synchronize_session=False)
    db.delete(m)
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# CICLO DE VIDA DA SESSÃO
# ══════════════════════════════════════════════════════════════════════════════

def _get_dungeon(db, dungeon_id, usuario) -> Dungeon:
    d = db.query(Dungeon).filter(
        Dungeon.id == dungeon_id, Dungeon.usuario_id == usuario.id
    ).first()
    if not d:
        raise HTTPException(404, "Dungeon não encontrada")
    return d


@router.get("/{dungeon_id}/sessao")
def estado_sessao(
    dungeon_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Estado completo do interior: dungeon + sessão de hoje + execuções de missão."""
    d = _get_dungeon(db, dungeon_id, usuario)
    hoje = tempo.hoje()
    s = _obter_ou_criar_sessao(db, d, usuario.id, hoje)
    s = _verificar_no_show(db, d, s, usuario)
    relatorio_auto = _verificar_saida_automatica(db, d, s, usuario)

    execs = db.query(DungeonMissaoExecucao).filter(
        DungeonMissaoExecucao.dungeon_sessao_id == s.id
    ).all()
    return {
        "dungeon": _dungeon_to_dict(d, sessao=s, hoje=hoje, incluir_missoes=True),
        "sessao": _sessao_to_dict(s),
        "execucoes": [_exec_to_dict(e) for e in execs],
        "relatorio_auto": relatorio_auto,
        "agora": _agora().isoformat(),
    }


@router.post("/{dungeon_id}/entrar")
def entrar_dungeon(
    dungeon_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Check-in: PENDENTE → ATIVA. Calcula atraso, credita/penaliza, arma as missões."""
    d = _get_dungeon(db, dungeon_id, usuario)
    hoje = tempo.hoje()

    if not _eh_dungeon_de_hoje(d, hoje):
        raise HTTPException(400, "Esta Dungeon não está aberta hoje")

    s = _obter_ou_criar_sessao(db, d, usuario.id, hoje)
    s = _verificar_no_show(db, d, s, usuario)

    aberto = bool(getattr(d, "sempre_aberta", False))

    if s.status == "FRACASSADA":
        raise HTTPException(400, "O portão se fechou — você não o atravessou a tempo")

    # JÁ ESTÁ LÁ DENTRO. Entrar duas vezes seguidas não é ir e vir — é um
    # clique repetido, e atendê-lo zeraria a entrada da visita em curso.
    if s.status == "ATIVA":
        raise HTTPException(400, "Você já está dentro desta Dungeon")

    # A REENTRADA É O PEDIDO DO ARQUITETO: "deixe que o user entre e saia
    # de dungeons quando quiser, se ela estiver aberta". No portão comum a
    # travessia continua sendo uma por dia — sair é encerrar. No portão que
    # não fecha, sair é só sair, e voltar é permitido.
    if s.status in ("CONCLUIDA", "SUSPENSA") and not aberto:
        raise HTTPException(400, "Você já atravessou este portão hoje")

    if s.status not in ("PENDENTE", "CONCLUIDA", "SUSPENSA"):
        raise HTTPException(400, f"Não é possível entrar — status: {s.status}")

    agora = _agora()

    # A HORA DA PORTA só existe para quem tem porta. Aqui morava também uma
    # SEGUNDA trava ("15 minutos antes"), e ela era código morto no caso
    # normal — se a primeira passou, `agora >= abre_em`, e `abre_em - 15min`
    # é anterior a isso. Pior: ela lia `d.hora_entrada` (o padrão) enquanto
    # a primeira lia o horário DO DIA, então uma dungeon com agenda semanal
    # própria ficava inentrável, recusada por um horário que não era o dela.
    if not aberto:
        # O portão só se abre NA hora de entrada — nunca antes (regra do Sistema)
        h_abre, _hs = _horario_do_dia(d, hoje)
        abre_em = _parse_hhmm(h_abre, hoje)
        if abre_em and agora < abre_em:
            raise HTTPException(400, f"O portão ainda está selado — abre às {h_abre}")

    mult  = _mult(d)

    # ATRASO SÓ EXISTE CONTRA UM HORÁRIO. No portão que não fecha não há
    # hora marcada, então ninguém chega tarde — e sem atraso não há
    # penalidade de entrada nem travessia "tolerada".
    atraso = 0
    if not aberto:
        # Atraso em relação à hora de entrada (respeitando a agenda do dia)
        h_entrada_hoje, _ = _horario_do_dia(d, hoje)
        prazo_entrada = _parse_hhmm(h_entrada_hoje, hoje)
        if prazo_entrada and agora > prazo_entrada:
            atraso = int((agora - prazo_entrada).total_seconds() // 60)

    # A VOLTA NÃO É UMA NOVA TRAVESSIA.
    #
    # Reentrar num portão aberto retoma a MESMA sessão do dia: o XP de
    # entrada não é pago de novo e o streak não sobe de novo. Se pagasse,
    # sair e voltar dez vezes renderia dez entradas — e a dungeon viraria
    # uma máquina de XP acionada por um botão.
    retorno = (s.status in ("CONCLUIDA", "SUSPENSA"))

    s.status              = "ATIVA"
    s.ultimo_heartbeat_em = agora
    s.visitas             = (getattr(s, "visitas", 0) or 0) + 1
    if retorno:
        # `entrada_em` guarda a PRIMEIRA travessia do dia e não se mexe:
        # é dela que sai o atraso, e reescrevê-la apagaria o registro de
        # que o hunter chegou na hora.
        s.reaberta_em = agora
        s.saida_em    = None          # ele voltou; a saída de antes não vale mais
    else:
        s.entrada_em     = agora
        s.atraso_minutos = atraso

    eventos_xp = None
    pontual    = (not retorno) and atraso <= 0
    tolerado   = (not retorno) and 0 < atraso <= (d.tolerancia_min or 0)

    if pontual:
        d.streak_atual = (d.streak_atual or 0) + 1
        d.streak_max   = max(d.streak_max or 0, d.streak_atual)
        xp_in = int((d.xp_entrada or 0) * mult)
        if xp_in > 0:
            eventos_xp = aplicar_xp(
                db, usuario, xp_in, 0, hoje,
                observacao=f"Dungeon [{d.titulo}] — travessia pontual",
            )
            s.xp_ganho = (s.xp_ganho or 0) + eventos_xp["xp_ganho"]
    elif tolerado:
        # Mantém o streak, mas entra com XP reduzido e leva a penalidade de atraso
        d.streak_atual = (d.streak_atual or 0) + 1
        d.streak_max   = max(d.streak_max or 0, d.streak_atual)
        pen = d.penalidade_atraso_xp or 0
        xp_in = max(0, int((d.xp_entrada or 0) * mult * 0.5))
        if xp_in > 0:
            eventos_xp = aplicar_xp(
                db, usuario, xp_in, 0, hoje,
                observacao=f"Dungeon [{d.titulo}] — travessia atrasada ({atraso} min)",
            )
            s.xp_ganho = (s.xp_ganho or 0) + eventos_xp["xp_ganho"]
        if pen > 0:
            usuario.xp_total = max(0, (usuario.xp_total or 0) - pen)
            usuario.xp_atual = max(0, (usuario.xp_atual or 0) - pen)
            s.xp_perdido = (s.xp_perdido or 0) + pen
    elif retorno:
        # VOLTAR NÃO É CHEGAR ATRASADO.
        #
        # Sem este ramo, o `else` abaixo pegaria toda reentrada: `pontual`
        # e `tolerado` são falsos no retorno, então cada volta zeraria o
        # streak da dungeon e cobraria a penalidade de atraso de novo. O
        # hunter que saísse para outra masmorra e voltasse seria punido
        # por ter voltado — o oposto exato da liberdade que o Arquiteto
        # pediu.
        pass
    else:
        # Atraso além da tolerância: o portão continua aberto — entra,
        # mas sem XP de entrada, com penalidade cheia e o streak quebra
        d.streak_atual = 0
        pen = (d.penalidade_atraso_xp or 0)
        if pen > 0:
            usuario.xp_total = max(0, (usuario.xp_total or 0) - pen)
            usuario.xp_atual = max(0, (usuario.xp_atual or 0) - pen)
            s.xp_perdido = (s.xp_perdido or 0) + pen

    # Arma as missões da sessão: PADRAO/AGENDADA pendentes, RESISTENCIA em progresso
    # (respeitando os dias da semana de cada missão)
    missoes = d.missoes.filter(DungeonMissao.ativo == True).all()
    for m in missoes:
        if m.natureza in _NATUREZAS_ARMADAS and _missao_eh_de_hoje(m, hoje):
            ja = db.query(DungeonMissaoExecucao).filter(
                DungeonMissaoExecucao.dungeon_missao_id == m.id,
                DungeonMissaoExecucao.dungeon_sessao_id == s.id,
            ).first()
            if not ja:
                db.add(DungeonMissaoExecucao(
                    dungeon_missao_id=m.id, dungeon_sessao_id=s.id,
                    status="EM_PROGRESSO" if m.natureza == "RESISTENCIA" else "PENDENTE",
                    progresso_pct=0.0,
                ))

    db.commit()
    db.refresh(s)

    execs = db.query(DungeonMissaoExecucao).filter(
        DungeonMissaoExecucao.dungeon_sessao_id == s.id
    ).all()
    return anexar({
        "sessao": _sessao_to_dict(s),
        "dungeon": _dungeon_to_dict(d, sessao=s, hoje=hoje, incluir_missoes=True),
        "execucoes": [_exec_to_dict(e) for e in execs],
        "pontual": pontual,
        "atraso_minutos": atraso,
        "eventos_xp": eventos_xp,
        "agora_server": _agora().isoformat(),
    }, eventos_xp)


@router.post("/{dungeon_id}/entrar-arquiteto")
def entrar_arquiteto(
    dungeon_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    ⟁ Entrada do Arquiteto — exclusiva de nivel_acesso == 'Arquiteto'.
    Abre a dungeon MESMO fechada (fora do dia, fora do horário, já resolvida)
    numa sessão paralela de MODO TESTE: tudo funciona (missões, heartbeat,
    eventos, clear), mas nada é creditado ao perfil nem ao streak da dungeon.
    Reentrar reseta a sessão de teste para um novo ensaio limpo.
    """
    if usuario.nivel_acesso != "Arquiteto":
        raise HTTPException(403, "Somente o Arquiteto pode atravessar este selo")

    d = _get_dungeon(db, dungeon_id, usuario)
    hoje = tempo.hoje()
    agora = _agora()

    s = _obter_ou_criar_sessao(db, d, usuario.id, hoje, teste=True)

    # Reset completo da sessão de teste (ensaio sempre começa limpo)
    db.query(DungeonMissaoExecucao).filter(
        DungeonMissaoExecucao.dungeon_sessao_id == s.id
    ).delete(synchronize_session=False)
    s.status                 = "ATIVA"
    s.entrada_em             = agora
    s.saida_em               = None
    s.fracassada_em          = None
    s.atraso_minutos         = 0
    s.tempo_total_min        = 0
    s.ultimo_heartbeat_em    = agora
    s.pct_missoes_concluidas = 0.0
    s.rank_obtido            = None
    s.xp_ganho               = 0
    s.xp_perdido             = 0
    s.moedas_ganhas          = 0

    # Arma as missões normalmente
    for m in d.missoes.filter(DungeonMissao.ativo == True).all():
        if m.natureza in _NATUREZAS_ARMADAS and _missao_eh_de_hoje(m, hoje):
            db.add(DungeonMissaoExecucao(
                dungeon_missao_id=m.id, dungeon_sessao_id=s.id,
                status="EM_PROGRESSO" if m.natureza == "RESISTENCIA" else "PENDENTE",
                progresso_pct=0.0,
            ))

    db.commit()
    db.refresh(s)

    execs = db.query(DungeonMissaoExecucao).filter(
        DungeonMissaoExecucao.dungeon_sessao_id == s.id
    ).all()
    return {
        "sessao": _sessao_to_dict(s),
        "dungeon": _dungeon_to_dict(d, hoje=hoje, incluir_missoes=True),
        "execucoes": [_exec_to_dict(e) for e in execs],
        "pontual": True,
        "atraso_minutos": 0,
        "eventos_xp": None,
        "modo_teste": True,
    }


@router.post("/{dungeon_id}/heartbeat")
def heartbeat(
    dungeon_id: int,
    teste: bool = False,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    Pulso da sessão ativa (o frontend chama a cada ~30s).
    - Acumula tempo_total_min
    - Progride missões RESISTENCIA (bônus ao completar)
    - Expira e dispara EVENTO_ALEATORIO / BEM_ESTAR
    - Ocasionalmente devolve um sussurro (FLAVOR)
    """
    d = _get_dungeon(db, dungeon_id, usuario)
    hoje = tempo.hoje()
    if teste and usuario.nivel_acesso != "Arquiteto":
        raise HTTPException(403, "Somente o Arquiteto usa sessões de teste")
    s = _obter_ou_criar_sessao(db, d, usuario.id, hoje, teste=teste)

    # Check-out automático: passou da hora de saída, o Sistema encerra sozinho
    relatorio_auto = _verificar_saida_automatica(db, d, s, usuario)
    if relatorio_auto:
        return {"sessao": _sessao_to_dict(s), "novos_eventos": [], "concluidas": [],
                "expirados": [], "sussurro": None, "execucoes": [],
                "relatorio_auto": relatorio_auto}

    if s.status != "ATIVA":
        return {"sessao": _sessao_to_dict(s), "novos_eventos": [], "concluidas": [],
                "expirados": [], "sussurro": None, "execucoes": [],
                "relatorio_auto": None}

    agora = _agora()
    ultimo = s.ultimo_heartbeat_em or s.entrada_em or agora
    delta_min = max(0.0, min((agora - ultimo).total_seconds() / 60.0, 5.0))  # cap anti-gap
    s.tempo_total_min = int((s.tempo_total_min or 0) + round(delta_min))
    s.ultimo_heartbeat_em = agora

    mult = _mult(d)
    novos_eventos, concluidas, expirados = [], [], []
    eventos_xp = None

    execs = db.query(DungeonMissaoExecucao).filter(
        DungeonMissaoExecucao.dungeon_sessao_id == s.id
    ).all()
    execs_por_missao = {}
    for e in execs:
        execs_por_missao.setdefault(e.dungeon_missao_id, []).append(e)

    missoes = d.missoes.filter(DungeonMissao.ativo == True).all()

    for m in missoes:
        lst = execs_por_missao.get(m.id, [])

        # ── RESISTENCIA: barra que enche com o tempo de presença ──
        if m.natureza == "RESISTENCIA" and m.meta_minutos:
            e = next((x for x in lst if x.status == "EM_PROGRESSO"), None)
            if e:
                e.progresso_pct = min(100.0, (s.tempo_total_min / m.meta_minutos) * 100.0)
                if e.progresso_pct >= 100.0:
                    e.status = "CONCLUIDA"
                    e.concluida_em = agora
                    xp = int((m.xp_recompensa or 0) * mult)
                    mc = int((m.moedas_recompensa or 0) * mult)
                    if s.modo_teste:
                        # Simula os números, mas nada toca o perfil
                        e.xp_ganho = xp
                        e.moedas_ganhas = mc
                        s.xp_ganho = (s.xp_ganho or 0) + xp
                        s.moedas_ganhas = (s.moedas_ganhas or 0) + mc
                    elif xp > 0 or mc > 0:
                        eventos_xp = aplicar_xp(
                            db, usuario, xp, mc, hoje,
                            observacao=f"Dungeon [{d.titulo}] — resistência completa: {m.titulo}",
                        )
                        e.xp_ganho = eventos_xp["xp_ganho"]
                        e.moedas_ganhas = mc
                        s.xp_ganho = (s.xp_ganho or 0) + eventos_xp["xp_ganho"]
                        s.moedas_ganhas = (s.moedas_ganhas or 0) + mc
                    concluidas.append(_exec_to_dict(e, m))

        # ── AGENDADA: expira quando passa da hora_limite (com punição) ──
        elif m.natureza == "AGENDADA" and m.hora_limite:
            limite = _parse_hhmm(m.hora_limite, s.data)
            if limite:
                for e in lst:
                    if e.status in ("PENDENTE", "EM_PROGRESSO", "PAUSADA") and agora > limite:
                        e.status = "EXPIRADA"
                        _punir_missao(db, usuario, s, e, m, mult)
                        expirados.append(_exec_to_dict(e, m))

        # ── EVENTO_ALEATORIO / BEM_ESTAR: pop-ins temporários ──
        elif m.natureza in _NATUREZAS_BONUS:
            pendente = next((x for x in lst if x.status == "PENDENTE"), None)

            # 1. Expira pendentes velhos (sem punição — é opcional por design)
            if pendente and pendente.disparada_em:
                exp = pendente.disparada_em + timedelta(minutes=m.expira_em_min or 5)
                if agora > exp:
                    pendente.status = "EXPIRADA"
                    expirados.append(_exec_to_dict(pendente, m))
                    pendente = None

            # 2. Decide se dispara um novo
            if not pendente:
                ultima = max(
                    [x.disparada_em for x in lst if x.disparada_em] + [s.entrada_em or agora]
                )
                decorrido = (agora - ultima).total_seconds() / 60.0
                if m.natureza == "BEM_ESTAR":
                    intervalo = m.intervalo_min or 45
                    dispara = decorrido >= intervalo
                else:
                    jmin = m.janela_disparo_min or 20
                    jmax = max(m.janela_disparo_max or 60, jmin + 1)
                    if decorrido >= jmax:
                        dispara = True
                    elif decorrido >= jmin:
                        # chance proporcional dentro da janela → imprevisível mas garantido
                        dispara = random.random() < (delta_min / max(1.0, (jmax - jmin) / 2.0))
                    else:
                        dispara = False
                if dispara:
                    novo = DungeonMissaoExecucao(
                        dungeon_missao_id=m.id, dungeon_sessao_id=s.id,
                        status="PENDENTE", disparada_em=agora,
                    )
                    db.add(novo)
                    db.flush()
                    novos_eventos.append(_exec_to_dict(novo, m))

    # ── Sussurro do sistema (FLAVOR) — efêmero, ~12% dos pulsos ──
    sussurro = None
    if random.random() < 0.12:
        frases = list(_SUSSURROS)
        for m in missoes:
            if m.natureza == "FLAVOR":
                frases.append(m.titulo)
        sussurro = random.choice(frases)

    db.commit()
    db.refresh(s)
    execs = db.query(DungeonMissaoExecucao).filter(
        DungeonMissaoExecucao.dungeon_sessao_id == s.id
    ).all()

    return anexar({
        "sessao": _sessao_to_dict(s),
        "execucoes": [_exec_to_dict(e) for e in execs],
        "novos_eventos": novos_eventos,
        "concluidas": concluidas,
        "expirados": expirados,
        "sussurro": sussurro,
        "eventos_xp": eventos_xp,
        "relatorio_auto": None,
        "agora": agora.isoformat(),
    }, eventos_xp)


@router.post("/execucoes/{exec_id}/cumprir")
def cumprir_missao(
    exec_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Cumpre uma missão ativa ou captura um evento/bem-estar disparado."""
    e = db.query(DungeonMissaoExecucao).join(DungeonSessao).filter(
        DungeonMissaoExecucao.id == exec_id,
        DungeonSessao.usuario_id == usuario.id,
    ).first()
    if not e:
        raise HTTPException(404, "Execução de missão não encontrada")

    s = e.sessao
    m = e.missao
    d = s.dungeon

    if s.status != "ATIVA":
        raise HTTPException(400, "A sessão da Dungeon não está ativa")
    if e.status not in ("PENDENTE", "EM_PROGRESSO", "PAUSADA"):
        raise HTTPException(400, f"Missão já finalizada — status: {e.status}")

    agora = _agora()

    # Evento com prazo: confere se ainda vale
    if m.natureza in _NATUREZAS_BONUS and e.disparada_em:
        exp = e.disparada_em + timedelta(minutes=m.expira_em_min or 5)
        if agora > exp:
            e.status = "EXPIRADA"
            db.commit()
            raise HTTPException(400, "O evento se dissipou — tarde demais")

    # Missão AGENDADA: respeita a janela de horário
    if m.natureza == "AGENDADA":
        if m.hora_inicio:
            inicio = _parse_hhmm(m.hora_inicio, s.data)
            if inicio and agora < inicio:
                raise HTTPException(400, f"Esta missão só abre às {m.hora_inicio}")
        if m.hora_limite:
            limite = _parse_hhmm(m.hora_limite, s.data)
            if limite and agora > limite:
                e.status = "EXPIRADA"
                _punir_missao(db, usuario, s, e, m, _mult(d))
                db.commit()
                raise HTTPException(400, f"O prazo desta missão venceu às {m.hora_limite}")

    mult = _mult(d)
    xp   = int((m.xp_recompensa or 0) * mult)
    mc   = int((m.moedas_recompensa or 0) * mult)

    e.status        = "CONCLUIDA"
    e.progresso_pct = 100.0
    e.concluida_em  = agora

    eventos_xp = None
    if s.modo_teste:
        # Modo teste do Arquiteto: simula, mas não credita nada ao perfil
        e.xp_ganho      = xp
        e.moedas_ganhas = mc
        s.xp_ganho      = (s.xp_ganho or 0) + xp
        s.moedas_ganhas = (s.moedas_ganhas or 0) + mc
    elif xp > 0 or mc > 0:
        eventos_xp = aplicar_xp(
            db, usuario, xp, mc, tempo.hoje(),
            observacao=f"Dungeon [{d.titulo}] — missão: {m.titulo}",
        )
        e.xp_ganho      = eventos_xp["xp_ganho"]
        e.moedas_ganhas = mc
        s.xp_ganho      = (s.xp_ganho or 0) + eventos_xp["xp_ganho"]
        s.moedas_ganhas = (s.moedas_ganhas or 0) + mc

    db.commit()
    db.refresh(e)
    return anexar({
        "execucao": _exec_to_dict(e),
        "sessao": _sessao_to_dict(s),
        "eventos_xp": eventos_xp,
    }, eventos_xp)


# ── Ciclo de vida da missão de livre execução (PADRAO/AGENDADA) ──────────────

def _get_exec(db, exec_id, usuario) -> DungeonMissaoExecucao:
    e = db.query(DungeonMissaoExecucao).join(DungeonSessao).filter(
        DungeonMissaoExecucao.id == exec_id,
        DungeonSessao.usuario_id == usuario.id,
    ).first()
    if not e:
        raise HTTPException(404, "Execução de missão não encontrada")
    if e.sessao.status != "ATIVA":
        raise HTTPException(400, "A sessão da Dungeon não está ativa")
    if e.missao.natureza not in _NATUREZAS_MANUAIS:
        raise HTTPException(400, "Esta missão não tem ciclo manual")
    return e


@router.post("/execucoes/{exec_id}/iniciar")
def iniciar_missao_exec(
    exec_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """PENDENTE → EM_PROGRESSO."""
    e = _get_exec(db, exec_id, usuario)
    m = e.missao
    if e.status != "PENDENTE":
        raise HTTPException(400, f"Não é possível iniciar — status: {e.status}")
    if m.natureza == "AGENDADA" and m.hora_inicio:
        inicio = _parse_hhmm(m.hora_inicio, e.sessao.data)
        if inicio and _agora() < inicio:
            raise HTTPException(400, f"Esta missão só abre às {m.hora_inicio}")
    e.status = "EM_PROGRESSO"
    db.commit()
    db.refresh(e)
    return {"execucao": _exec_to_dict(e)}


@router.post("/execucoes/{exec_id}/pausar")
def pausar_missao_exec(
    exec_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """EM_PROGRESSO → PAUSADA."""
    e = _get_exec(db, exec_id, usuario)
    if e.status != "EM_PROGRESSO":
        raise HTTPException(400, f"Não é possível pausar — status: {e.status}")
    e.status = "PAUSADA"
    db.commit()
    db.refresh(e)
    return {"execucao": _exec_to_dict(e)}


@router.post("/execucoes/{exec_id}/retomar")
def retomar_missao_exec(
    exec_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """PAUSADA → EM_PROGRESSO."""
    e = _get_exec(db, exec_id, usuario)
    if e.status != "PAUSADA":
        raise HTTPException(400, f"Não é possível retomar — status: {e.status}")
    e.status = "EM_PROGRESSO"
    db.commit()
    db.refresh(e)
    return {"execucao": _exec_to_dict(e)}


@router.post("/execucoes/{exec_id}/cancelar")
def cancelar_missao_exec(
    exec_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """PENDENTE|EM_PROGRESSO|PAUSADA → CANCELADA. Desistir tem preço: penalidade de XP."""
    e = _get_exec(db, exec_id, usuario)
    if e.status not in ("PENDENTE", "EM_PROGRESSO", "PAUSADA"):
        raise HTTPException(400, f"Não é possível cancelar — status: {e.status}")
    e.status = "CANCELADA"
    s = e.sessao
    pen = _punir_missao(db, usuario, s, e, e.missao, _mult(s.dungeon))
    db.commit()
    db.refresh(e)
    return {"execucao": _exec_to_dict(e), "sessao": _sessao_to_dict(s), "penalidade": pen}


def _resolver_sessao(db: Session, d: Dungeon, s: DungeonSessao, usuario: Usuario,
                     agora: datetime = None, credita: bool = True,
                     auto: bool = False) -> tuple:
    """
    Resolve uma sessão ATIVA (check-out): fecha tempo, expira pendentes,
    calcula % e rank de clear, credita a recompensa (se credita e não teste).
    Retorna (relatorio, eventos_xp).
    """
    agora = agora or _agora()
    hoje  = tempo.hoje()

    # Fecha o tempo da sessão
    ultimo = s.ultimo_heartbeat_em or s.entrada_em or agora
    delta_min = max(0.0, min((agora - ultimo).total_seconds() / 60.0, 5.0))
    s.tempo_total_min = int((s.tempo_total_min or 0) + round(delta_min))

    execs = db.query(DungeonMissaoExecucao).filter(
        DungeonMissaoExecucao.dungeon_sessao_id == s.id
    ).all()

    # Expira eventos ainda pendentes (sem punição — bônus é opcional por design)
    for e in execs:
        if e.status == "PENDENTE" and e.missao.natureza in _NATUREZAS_BONUS:
            e.status = "EXPIRADA"

    # Missões contáveis deixadas para trás no check-out: expiram COM punição
    mult_pen = _mult(d)
    falhadas = []
    for e in execs:
        if (e.missao.natureza in _NATUREZAS_MANUAIS
                and e.status in ("PENDENTE", "EM_PROGRESSO", "PAUSADA")):
            e.status = "EXPIRADA"
            pen = _punir_missao(db, usuario, s, e, e.missao, mult_pen)
            falhadas.append({"titulo": e.missao.titulo, "penalidade": pen})

    # % de clear — só missões contáveis
    contaveis  = [e for e in execs if e.missao.natureza in _NATUREZAS_CONTAVEIS]
    concluidas = [e for e in contaveis if e.status == "CONCLUIDA"]
    bonus_ext  = [e for e in execs
                  if e.missao.natureza in _NATUREZAS_BONUS
                  and e.status == "CONCLUIDA"]
    pct = (len(concluidas) / len(contaveis) * 100.0) if contaveis else 100.0

    # Rank de clear
    if   pct >= 90: rank = "S"
    elif pct >= 70: rank = "A"
    elif pct >= 50: rank = "B"
    elif pct >= 30: rank = "C"
    else:           rank = "D"
    if (s.atraso_minutos or 0) > 0 and rank == "S":
        rank = "A"

    mult     = _mult(d)
    xp_total_clear = int((d.xp_clear or 0) * mult * _MULT_CLEAR[rank]) if credita else 0
    mc_total_clear = int((d.moedas_clear or 0) * mult * _MULT_CLEAR[rank]) if credita else 0

    # SÓ A DIFERENÇA É PAGA.
    #
    # `xp_total_clear` é o clear a que a sessão tem direito AGORA, com o
    # rank que ela tem agora. Num portão que não fecha o hunter pode
    # encerrar, voltar, concluir mais missões e encerrar de novo — e o que
    # ele recebe na segunda vez é o quanto o clear subiu, nunca o clear
    # inteiro outra vez. Rank que cai não devolve XP: o piso é zero.
    ja_xp    = int(getattr(s, "clear_xp_pago", 0) or 0)
    ja_mc    = int(getattr(s, "clear_moedas_pago", 0) or 0)
    xp_clear = max(0, xp_total_clear - ja_xp)
    mc_clear = max(0, mc_total_clear - ja_mc)

    s.status                 = "CONCLUIDA"
    s.saida_em               = agora
    s.pct_missoes_concluidas = pct
    s.rank_obtido            = rank
    s.clear_xp_pago          = max(ja_xp, xp_total_clear)
    s.clear_moedas_pago      = max(ja_mc, mc_total_clear)

    eventos_xp = None
    if s.modo_teste:
        # Modo teste: simula o clear no relatório, nada é creditado
        s.xp_ganho      = (s.xp_ganho or 0) + xp_clear
        s.moedas_ganhas = (s.moedas_ganhas or 0) + mc_clear
    elif xp_clear > 0 or mc_clear > 0:
        origem = "check-out automático no horário de saída" if auto else "CLEAR"
        eventos_xp = aplicar_xp(
            db, usuario, xp_clear, mc_clear, hoje,
            observacao=f"Dungeon [{d.titulo}] — {origem} rank {rank} ({pct:.0f}%)",
        )
        s.xp_ganho      = (s.xp_ganho or 0) + eventos_xp["xp_ganho"]
        s.moedas_ganhas = (s.moedas_ganhas or 0) + mc_clear

    db.commit()
    db.refresh(s)

    relatorio = {
        "modo_teste": bool(s.modo_teste),
        "auto_saida": auto,
        "rank_obtido": rank,
        "pct_missoes": round(pct, 1),
        "missoes_concluidas": len(concluidas),
        "missoes_totais": len(contaveis),
        "bonus_capturados": len(bonus_ext),
        "tempo_total_min": s.tempo_total_min,
        "atraso_minutos": s.atraso_minutos or 0,
        "xp_sessao": s.xp_ganho or 0,
        "xp_perdido": s.xp_perdido or 0,
        "moedas_sessao": s.moedas_ganhas or 0,
        "xp_clear": xp_clear,
        "moedas_clear": mc_clear,
        "xp_clear_total": xp_total_clear,
        "moedas_clear_total": mc_total_clear,
        "streak_dungeon": d.streak_atual or 0,
        "missoes_falhadas": falhadas,
    }
    return relatorio, eventos_xp


def _suspender_sessao(db: Session, d: Dungeon, s: DungeonSessao,
                      agora: datetime = None) -> dict:
    """
    ⏸ SAÍDA SEM ENCERRAMENTO — o hunter atravessa o portão de volta.

    Num portão que não fecha, sair não é terminar. `_resolver_sessao` faz
    três coisas irreversíveis: expira as missões pendentes COM punição,
    fecha o rank do dia e paga o clear. Aplicar isso a quem só foi cuidar
    de outra dungeon seria cobrar pedágio pela liberdade que o portão
    aberto promete.

    Aqui a sessão apenas ADORMECE: o relógio para, o progresso fica
    inteiro, nada é punido e nada é pago. Ela volta a correr na próxima
    travessia, e só é resolvida quando o hunter encerrar de propósito ou
    quando o dia acabar por ele.
    """
    agora = agora or _agora()

    ultimo = s.ultimo_heartbeat_em or s.entrada_em or agora
    delta_min = max(0.0, min((agora - ultimo).total_seconds() / 60.0, 5.0))
    s.tempo_total_min = int((s.tempo_total_min or 0) + round(delta_min))

    s.status              = "SUSPENSA"
    s.saida_em            = agora
    s.ultimo_heartbeat_em = None

    execs = db.query(DungeonMissaoExecucao).filter(
        DungeonMissaoExecucao.dungeon_sessao_id == s.id
    ).all()
    contaveis  = [e for e in execs if e.missao.natureza in _NATUREZAS_CONTAVEIS]
    concluidas = [e for e in contaveis if e.status == "CONCLUIDA"]
    pendentes  = [e for e in contaveis
                  if e.status in ("PENDENTE", "EM_PROGRESSO", "PAUSADA")]

    db.commit()
    db.refresh(s)

    return {
        "suspensa": True,
        "modo_teste": bool(s.modo_teste),
        "tempo_total_min": s.tempo_total_min,
        "visitas": int(getattr(s, "visitas", 0) or 0),
        "missoes_concluidas": len(concluidas),
        "missoes_totais": len(contaveis),
        "missoes_aguardando": len(pendentes),
        "xp_sessao": s.xp_ganho or 0,
        "xp_perdido": s.xp_perdido or 0,
        "moedas_sessao": s.moedas_ganhas or 0,
        "clear_ja_pago": int(getattr(s, "clear_xp_pago", 0) or 0),
        "streak_dungeon": d.streak_atual or 0,
    }


def _verificar_saida_automatica(db: Session, d: Dungeon, s: DungeonSessao,
                                usuario: Usuario) -> Optional[dict]:
    """
    Check-out automático: se a sessão está ATIVA (ou SUSPENSA, largada do
    lado de fora de um portão aberto) e o horário de saída do dia já
    passou, o Sistema tira o hunter da dungeon sozinho, com clear normal.
    Retorna o relatório se resolveu, senão None.
    """
    if not s or s.status not in ("ATIVA", "SUSPENSA"):
        return None

    _h_ent, h_saida = _horario_do_dia(d, s.data)
    limite = _parse_hhmm(h_saida, s.data) if h_saida else None

    # O PORTÃO ABERTO NÃO TEM HORA DE SAÍDA — TEM FIM DE DIA.
    #
    # Sem isto, uma sessão suspensa num portão sem `hora_saida` nunca seria
    # resolvida: o dia vira, uma sessão nova é criada para a data de hoje, e
    # a de ontem fica encalhada para sempre com o clear por pagar. A
    # meia-noite da própria data é o limite natural — o crédito é do dia em
    # que o trabalho foi feito, não do dia em que o Sistema percebeu.
    if not limite and s.data < tempo.hoje():
        limite = datetime.combine(s.data, dtime(23, 59, 59))

    if not limite or _agora() <= limite:
        return None
    relatorio, _ev = _resolver_sessao(db, d, s, usuario, agora=limite, credita=True, auto=True)
    return relatorio


@router.post("/{dungeon_id}/sair")
def sair_dungeon(
    dungeon_id: int,
    teste: bool = False,
    encerrar: bool = False,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    Check-out. Duas saídas, e a diferença é o portão:

    - portão com hora marcada → sair É encerrar. Fechou, fechou.
    - portão que não fecha     → sair só SUSPENDE (o hunter foi cuidar de
      outra dungeon e pode voltar). Para fechar o dia de propósito e
      receber o clear, `encerrar=true`.
    """
    d = _get_dungeon(db, dungeon_id, usuario)
    hoje = tempo.hoje()
    if teste and usuario.nivel_acesso != "Arquiteto":
        raise HTTPException(403, "Somente o Arquiteto usa sessões de teste")
    s = _obter_ou_criar_sessao(db, d, usuario.id, hoje, teste=teste)

    if s.status != "ATIVA":
        raise HTTPException(400, f"Não é possível sair — status: {s.status}")

    aberto = bool(getattr(d, "sempre_aberta", False))
    if aberto and not encerrar:
        relatorio = _suspender_sessao(db, d, s)
        return {
            "relatorio": relatorio,
            "sessao": _sessao_to_dict(s),
            "eventos_xp": None,
        }

    relatorio, eventos_xp = _resolver_sessao(db, d, s, usuario)
    return anexar({
        "relatorio": relatorio,
        "sessao": _sessao_to_dict(s),
        "eventos_xp": eventos_xp,
    }, eventos_xp)


@router.post("/{dungeon_id}/resetar")
def resetar_sessao(
    dungeon_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    ↺ Reset do Arquiteto — apaga a sessão real de HOJE como se nunca tivesse
    acontecido, revertendo XP/moedas/penalidades que ela gerou no perfil.
    O estado resultante segue o relógio:
      - antes da hora de entrada  → portão selado (nunca aberto)
      - dentro da janela          → portão aberto, nunca atravessado
      - após o prazo de entrada   → fechado como no-show (rank F), SEM nova penalidade
    """
    if usuario.nivel_acesso != "Arquiteto":
        raise HTTPException(403, "Somente o Arquiteto pode reverter o tempo de um portão")

    d = _get_dungeon(db, dungeon_id, usuario)
    hoje  = tempo.hoje()
    agora = _agora()

    s = db.query(DungeonSessao).filter(
        DungeonSessao.dungeon_id == d.id,
        DungeonSessao.usuario_id == usuario.id,
        DungeonSessao.data       == hoje,
        DungeonSessao.modo_teste == False,
    ).first()

    if s:
        # Reverte o que a sessão creditou/penalizou no perfil
        ganho_xp = s.xp_ganho or 0
        ganho_mc = s.moedas_ganhas or 0
        perdido  = s.xp_perdido or 0
        usuario.xp_total = max(0, (usuario.xp_total or 0) - ganho_xp + perdido)
        usuario.xp_atual = max(0, (usuario.xp_atual or 0) - ganho_xp + perdido)
        usuario.moedas   = max(0, (usuario.moedas or 0) - ganho_mc)

        # Streak da dungeon: desfaz o +1 da travessia (aproximação honesta)
        if s.entrada_em and s.status in ("ATIVA", "CONCLUIDA"):
            d.streak_atual = max(0, (d.streak_atual or 0) - 1)

        db.query(DungeonMissaoExecucao).filter(
            DungeonMissaoExecucao.dungeon_sessao_id == s.id
        ).delete(synchronize_session=False)
        db.delete(s)
        db.commit()

    # Após a hora de SAÍDA do dia? Fecha como no-show — mas sem punir de novo
    _he, h_saida = _horario_do_dia(d, hoje)
    prazo = _parse_hhmm(h_saida, hoje) if h_saida else None
    if prazo and agora > prazo and _eh_dungeon_de_hoje(d, hoje):
        db.add(DungeonSessao(
            dungeon_id=d.id, usuario_id=usuario.id, data=hoje,
            status="FRACASSADA", fracassada_em=prazo,
            rank_obtido="F", xp_perdido=0, modo_teste=False,
        ))
        db.commit()

    # Estado final recalculado
    s2 = None
    if _eh_dungeon_de_hoje(d, hoje):
        s2 = _obter_ou_criar_sessao(db, d, usuario.id, hoje)
    return {"ok": True, "dungeon": _dungeon_to_dict(d, sessao=s2, hoje=hoje)}


@router.post("/{dungeon_id}/fracassar")
def fracassar_sessao(
    dungeon_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Força a checagem de no-show (o servidor também faz isso sozinho ao listar)."""
    d = _get_dungeon(db, dungeon_id, usuario)
    s = _obter_ou_criar_sessao(db, d, usuario.id, tempo.hoje())
    s = _verificar_no_show(db, d, s, usuario)
    return {"sessao": _sessao_to_dict(s)}


@router.post("/{dungeon_id}/cancelar")
def cancelar_sessao(
    dungeon_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Cancela a sessão de hoje sem penalidade (PENDENTE|ATIVA → CANCELADA)."""
    d = _get_dungeon(db, dungeon_id, usuario)
    s = _obter_ou_criar_sessao(db, d, usuario.id, tempo.hoje())
    if s.status not in ("PENDENTE", "ATIVA"):
        raise HTTPException(400, f"Não é possível cancelar — status: {s.status}")
    s.status = "CANCELADA"
    db.commit()
    db.refresh(s)
    return {"sessao": _sessao_to_dict(s)}


@router.get("/{dungeon_id}/score")
def score_dungeon(
    dungeon_id: int,
    inicio: Optional[date] = None,      # filtro: a partir de
    fim: Optional[date] = None,         # filtro: até
    status: Optional[str] = None,       # filtro: CONCLUIDA|FRACASSADA|CANCELADA|ATIVA
    natureza: Optional[str] = None,     # filtro: PADRAO|AGENDADA|RESISTENCIA|EVENTO_ALEATORIO|BEM_ESTAR
    apenas_falhas: bool = False,        # só missões deixadas para trás (canceladas/expiradas)
    limit: int = 120,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    📜 Crônica do Portão — score permanente da dungeon.
    Tudo que foi feito (e deixado de fazer) lá dentro, sessão por sessão,
    com horário de conclusão e pontos de cada missão. Sessões de teste ficam fora.
    """
    d = _get_dungeon(db, dungeon_id, usuario)

    q = db.query(DungeonSessao).filter(
        DungeonSessao.dungeon_id == d.id,
        DungeonSessao.usuario_id == usuario.id,
        DungeonSessao.modo_teste == False,
    )
    if inicio: q = q.filter(DungeonSessao.data >= inicio)
    if fim:    q = q.filter(DungeonSessao.data <= fim)
    if status: q = q.filter(DungeonSessao.status == status.upper())
    sessoes = q.order_by(DungeonSessao.data.desc()).limit(max(1, min(limit, 366))).all()

    nat_filtro = natureza.upper() if natureza else None
    ranks = {"S": 0, "A": 0, "B": 0, "C": 0, "D": 0, "F": 0}
    tot = {"xp": 0, "xp_perdido": 0, "moedas": 0, "tempo": 0,
           "concluidas": 0, "falhadas": 0, "eventos": 0,
           "clears": 0, "fracassos": 0}

    saida = []
    for s in sessoes:
        if s.rank_obtido in ranks:
            ranks[s.rank_obtido] += 1
        tot["xp"]         += s.xp_ganho or 0
        tot["xp_perdido"] += s.xp_perdido or 0
        tot["moedas"]     += s.moedas_ganhas or 0
        tot["tempo"]      += s.tempo_total_min or 0
        if s.status == "CONCLUIDA":  tot["clears"] += 1
        if s.status == "FRACASSADA": tot["fracassos"] += 1

        execs = db.query(DungeonMissaoExecucao).filter(
            DungeonMissaoExecucao.dungeon_sessao_id == s.id
        ).order_by(DungeonMissaoExecucao.concluida_em.asc().nullslast()).all()

        missoes_out = []
        for e in execs:
            m = e.missao
            eh_contavel = m.natureza in _NATUREZAS_CONTAVEIS
            eh_falha = e.status in ("CANCELADA", "EXPIRADA") and eh_contavel
            if e.status == "CONCLUIDA":
                tot["eventos" if m.natureza in _NATUREZAS_BONUS else "concluidas"] += 1
            elif eh_falha:
                tot["falhadas"] += 1
            # Filtros de exibição
            if nat_filtro and m.natureza != nat_filtro:
                continue
            if apenas_falhas and not eh_falha:
                continue
            missoes_out.append(_exec_to_dict(e, m))

        saida.append({**_sessao_to_dict(s), "missoes": missoes_out})

    decididas = tot["clears"] + tot["fracassos"]
    return {
        "dungeon": {"id": d.id, "titulo": d.titulo, "icone": d.icone,
                    "rank": d.rank, "categoria": d.categoria,
                    "streak_atual": d.streak_atual or 0, "streak_max": d.streak_max or 0},
        "resumo": {
            "sessoes_total": len(sessoes),
            "clears": tot["clears"],
            "fracassos": tot["fracassos"],
            "taxa_clear": round(tot["clears"] / decididas * 100.0, 1) if decididas else 0.0,
            "ranks": ranks,
            "xp_total": tot["xp"],
            "xp_perdido_total": tot["xp_perdido"],
            "moedas_total": tot["moedas"],
            "tempo_total_min": tot["tempo"],
            "missoes_concluidas": tot["concluidas"],
            "missoes_falhadas": tot["falhadas"],
            "eventos_capturados": tot["eventos"],
        },
        "sessoes": saida,
    }


@router.get("/{dungeon_id}/historico")
def historico_sessoes(
    dungeon_id: int,
    limit: int = 30,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    d = _get_dungeon(db, dungeon_id, usuario)
    sessoes = db.query(DungeonSessao).filter(
        DungeonSessao.dungeon_id == d.id,
        DungeonSessao.usuario_id == usuario.id,
        DungeonSessao.modo_teste == False,   # ensaios do Arquiteto ficam fora do histórico
    ).order_by(DungeonSessao.data.desc()).limit(limit).all()
    return [_sessao_to_dict(s) for s in sessoes]
