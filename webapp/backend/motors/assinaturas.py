# -*- coding: utf-8 -*-
"""
Assinaturas — motor de controle de acesso premium.

Gerencia o ciclo de vida das assinaturas dos hunters:
  PENDENTE → ATIVA → EXPIRADA | CANCELADA

Origens possíveis:
  "pagamento"  — Mercado Pago processou e aprovou
  "convite"    — O Arquiteto emitiu um convite com assinatura embutida
  "arquiteto"  — O Arquiteto concedeu manualmente via painel

A flag usuario.assinante é um cache rápido para guards de endpoint.
Ela é mantida sincronizada por este motor — nunca atualize diretamente.

REGRA DE CONVIVÊNCIA COM PAGAMENTOS:
  Este motor NÃO faz chamadas ao Mercado Pago.
  Ele só registra o estado APÓS o pagamento ter sido confirmado.
  O router de pagamentos é responsável por chamar ativar() após receber
  o webhook de aprovação do MP.
"""
from datetime import datetime, timedelta
from typing import Optional

CICLO_DIAS = {
    "MENSAL":    30,
    "SEMESTRAL": 180,
    "VITALICIO": None,   # sem expiração
}

TIPOS_VALIDOS = tuple(CICLO_DIAS.keys())


def assinatura_ativa(db, usuario_id: int):
    """
    Retorna a Assinatura ATIVA do usuário, ou None.
    Verifica expiração em tempo real e sincroniza o status se necessário.
    """
    from database import Assinatura, Usuario

    sub = (
        db.query(Assinatura)
        .filter(Assinatura.usuario_id == usuario_id, Assinatura.status == "ATIVA")
        .first()
    )
    if not sub:
        return None

    # Vitalícia nunca expira
    if sub.vitalicia:
        return sub

    # Verifica se já expirou
    if sub.expira_em and sub.expira_em < datetime.utcnow():
        sub.status = "EXPIRADA"
        u = db.query(Usuario).filter(Usuario.id == usuario_id).first()
        if u:
            u.assinante = False
        try:
            db.flush()
        except Exception:
            pass
        return None

    return sub


def eh_assinante(db, usuario) -> bool:
    """Guard rápido para qualquer endpoint premium."""
    return assinatura_ativa(db, usuario.id) is not None


def ativar(
    db,
    usuario,
    plano_id: int,
    origem: str = "pagamento",
    mp_preapproval_id: Optional[str] = None,
) -> "Assinatura":
    """
    Ativa uma assinatura para o usuário.

    Se já houver uma assinatura ATIVA, ela é marcada como EXPIRADA antes
    de criar a nova (regra: máximo 1 ativa por usuário).

    Retorna a nova Assinatura criada (sem commit — o caller decide quando commitar).
    """
    from database import Assinatura, Plano

    plano = db.query(Plano).filter(Plano.id == plano_id).first()
    if not plano:
        raise ValueError(f"Plano {plano_id} não encontrado.")

    # Expira assinatura anterior se existir
    anterior = (
        db.query(Assinatura)
        .filter(Assinatura.usuario_id == usuario.id, Assinatura.status == "ATIVA")
        .first()
    )
    if anterior:
        anterior.status = "EXPIRADA"

    vitalicia = plano.ciclo == "VITALICIO"
    dias = CICLO_DIAS.get(plano.ciclo)
    expira = None if vitalicia else (datetime.utcnow() + timedelta(days=dias))

    nova = Assinatura(
        usuario_id=usuario.id,
        plano_id=plano_id,
        status="ATIVA",
        origem=origem,
        mp_preapproval_id=mp_preapproval_id,
        vitalicia=vitalicia,
        inicio_em=datetime.utcnow(),
        expira_em=expira,
        proximo_ciclo_em=expira if not vitalicia else None,
    )
    db.add(nova)
    usuario.assinante = True
    db.flush()
    return nova


def ativar_por_convite(db, usuario, assinatura_tipo: str) -> Optional["Assinatura"]:
    """
    Ativa uma assinatura a partir de um convite do Arquiteto.
    Busca o plano correspondente ao tipo e chama ativar() sem mp_preapproval_id.
    Retorna None se não encontrar o plano (não lança exceção — convite não é
    pagamento, falhar aqui não deve travar o registro).
    """
    from database import Plano

    tipo = (assinatura_tipo or "").strip().upper()
    if tipo not in TIPOS_VALIDOS:
        return None

    plano = db.query(Plano).filter(Plano.ciclo == tipo, Plano.ativo == True).first()
    if not plano:
        # Plano não cadastrado ainda — log mas não falha
        print(f"[ASSINATURAS] ⚠ Plano ciclo={tipo} não encontrado ao ativar por convite.")
        return None

    return ativar(db, usuario, plano.id, origem="convite")


def ativar_pelo_arquiteto(db, usuario, ciclo: str) -> Optional["Assinatura"]:
    """
    Ativa uma assinatura manualmente pelo Arquiteto via painel.
    Idêntico ao convite mas com origem="arquiteto".
    """
    from database import Plano

    tipo = (ciclo or "").strip().upper()
    if tipo not in TIPOS_VALIDOS:
        raise ValueError(f"Ciclo inválido: {ciclo}. Use: {', '.join(TIPOS_VALIDOS)}")

    plano = db.query(Plano).filter(Plano.ciclo == tipo, Plano.ativo == True).first()
    if not plano:
        raise ValueError(f"Plano ciclo={tipo} não encontrado no catálogo.")

    return ativar(db, usuario, plano.id, origem="arquiteto")


def cancelar(db, assinatura) -> "Assinatura":
    """
    Cancela uma assinatura ativa.
    O acesso permanece até o fim do período pago (expira_em).
    Apenas mensais (Preapproval) precisam de cancelamento no MP — isso
    é responsabilidade do router de pagamentos, não deste motor.
    """
    from database import Usuario

    assinatura.status = "CANCELADA"
    assinatura.cancelada_em = datetime.utcnow()

    # Só remove a flag assinante se já expirou ou é imediato
    if assinatura.expira_em and assinatura.expira_em <= datetime.utcnow():
        u = db.query(Usuario).filter(Usuario.id == assinatura.usuario_id).first()
        if u:
            u.assinante = False

    db.flush()
    return assinatura


def creditar_bonus_mensal(db) -> dict:
    """
    Credita os Fragmentos bônus mensais para todas as assinaturas ativas.
    Deve ser chamado por um job mensal (cron / Arquiteto manual).

    Retorna {"creditados": N, "erros": [...]}
    """
    from database import Assinatura
    from motors import fragmentos as frag_motor

    resultado = {"creditados": 0, "erros": []}
    agora = datetime.utcnow()

    ativas = (
        db.query(Assinatura)
        .filter(Assinatura.status == "ATIVA")
        .all()
    )

    for sub in ativas:
        # Pula vencidas (assinatura_ativa() faz isso em tempo real, mas aqui é batch)
        if not sub.vitalicia and sub.expira_em and sub.expira_em < agora:
            continue
        # Pula se o próximo ciclo ainda não chegou
        if sub.proximo_ciclo_em and sub.proximo_ciclo_em > agora:
            continue

        try:
            bonus = sub.plano.fragmentos_bonus_mensal if sub.plano else 0
            if bonus > 0:
                from database import Usuario
                u = db.query(Usuario).filter(Usuario.id == sub.usuario_id).first()
                if u:
                    frag_motor.creditar(
                        db, u, bonus,
                        motivo="bonus_mensal",
                        referencia_id=sub.id,
                        observacao=f"Bônus mensal — plano {sub.plano.nome if sub.plano else sub.plano_id}",
                    )
                    # Avança o próximo ciclo em 30 dias
                    sub.proximo_ciclo_em = agora + timedelta(days=30)
                    resultado["creditados"] += 1
        except Exception as e:
            resultado["erros"].append(f"usuario_id={sub.usuario_id}: {e}")

    try:
        db.commit()
    except Exception as e:
        resultado["erros"].append(f"commit: {e}")

    return resultado


def to_dict(sub) -> dict:
    """Serializa uma Assinatura para resposta de API."""
    return {
        "id":               sub.id,
        "plano_id":         sub.plano_id,
        "plano_nome":       sub.plano.nome if sub.plano else None,
        "ciclo":            sub.plano.ciclo if sub.plano else None,
        "status":           sub.status,
        "origem":           sub.origem,
        "vitalicia":        sub.vitalicia,
        "inicio_em":        sub.inicio_em.isoformat() if sub.inicio_em else None,
        "expira_em":        sub.expira_em.isoformat() if sub.expira_em else None,
        "proximo_ciclo_em": sub.proximo_ciclo_em.isoformat() if sub.proximo_ciclo_em else None,
        "cancelada_em":     sub.cancelada_em.isoformat() if sub.cancelada_em else None,
    }
