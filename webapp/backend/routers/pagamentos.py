# -*- coding: utf-8 -*-
"""
Pagamentos — Fragmentos do Monarca 🔮 e Assinaturas via Mercado Pago.

ROTAS PÚBLICAS (sem autenticação):
  GET  /pagamentos/planos          — catálogo de planos de assinatura
  GET  /pagamentos/pacotes         — catálogo de pacotes de Fragmentos
  POST /pagamentos/webhook         — receptor de notificações do Mercado Pago

ROTAS AUTENTICADAS:
  GET  /pagamentos/minha-assinatura — dados da assinatura ativa do usuário
  GET  /pagamentos/meu-saldo        — saldo de Fragmentos + histórico
  POST /pagamentos/comprar-pacote   — inicia compra de Fragmentos (Pix/cartão)
  POST /pagamentos/assinar          — inicia assinatura (redirect MP)

ROTAS DO ARQUITETO:
  POST /pagamentos/arquiteto/conceder-assinatura  — conceder assinatura manual
  GET  /pagamentos/arquiteto/assinaturas          — painel de assinaturas ativas
  POST /pagamentos/arquiteto/creditar-fragmentos  — creditar 🔮 manualmente

──────────────────────────────────────────────────────────────────────────────
INTEGRAÇÃO MERCADO PAGO (pendente configuração de credenciais):

  Para pagamentos únicos (Pix/cartão):
    SDK: mercadopago.SDK(ACCESS_TOKEN).payment().create(...)
    Webhook: "payment" → payment.status == "approved" → creditar Fragmentos

  Para assinaturas recorrentes (mensais):
    SDK: .preapproval().create(...)  — gera URL de aprovação
    Webhook: "subscription_preapproval" → status → ativar/cancelar Assinatura

  Variáveis de ambiente necessárias:
    MP_ACCESS_TOKEN  — chave privada da conta MP
    MP_WEBHOOK_SECRET — para validar assinatura HMAC dos webhooks
    BASE_URL          — URL pública do servidor (para return_url)

Os endpoints de iniciação de pagamento atualmente retornam 501 com instruções
claras. Implemente preenchendo as seções marcadas com # ← MP.
──────────────────────────────────────────────────────────────────────────────
"""
import hashlib
import hmac
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, Usuario, Plano, PacoteFragmentos, Assinatura, Pagamento
from auth.router import get_usuario_atual, get_arquiteto

router = APIRouter(prefix="/pagamentos", tags=["pagamentos"])

MP_ACCESS_TOKEN  = os.getenv("MP_ACCESS_TOKEN", "")
MP_WEBHOOK_SECRET = os.getenv("MP_WEBHOOK_SECRET", "")


# ─── helpers ──────────────────────────────────────────────────────────────────

def _plano_to_dict(p: Plano) -> dict:
    return {
        "id":                      p.id,
        "nome":                    p.nome,
        "descricao":               p.descricao,
        "preco_brl":               p.preco_brl,
        "ciclo":                   p.ciclo,
        "fragmentos_bonus_mensal": p.fragmentos_bonus_mensal,
        "destaque":                p.destaque,
        "ordem":                   p.ordem,
    }


def _pacote_to_dict(p: PacoteFragmentos) -> dict:
    return {
        "id":                   p.id,
        "nome":                 p.nome,
        "descricao":            p.descricao,
        "icone":                p.icone,
        "fragmentos_entregues": p.fragmentos_entregues,
        "preco_brl":            p.preco_brl,
        "bonus_pct":            p.bonus_pct,
        "destaque":             p.destaque,
        "ordem":                p.ordem,
    }


# ─── catálogo público ──────────────────────────────────────────────────────────

@router.get("/planos")
def listar_planos(db: Session = Depends(get_db)):
    """Catálogo de planos de assinatura — exibido na página de upgrades."""
    planos = (
        db.query(Plano)
        .filter(Plano.ativo == True)
        .order_by(Plano.ordem)
        .all()
    )
    return {"planos": [_plano_to_dict(p) for p in planos]}


@router.get("/pacotes")
def listar_pacotes(db: Session = Depends(get_db)):
    """Catálogo de pacotes de Fragmentos — exibido na loja premium."""
    pacotes = (
        db.query(PacoteFragmentos)
        .filter(PacoteFragmentos.ativo == True)
        .order_by(PacoteFragmentos.ordem)
        .all()
    )
    return {"pacotes": [_pacote_to_dict(p) for p in pacotes]}


# ─── área autenticada ──────────────────────────────────────────────────────────

@router.get("/minha-assinatura")
def minha_assinatura(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Retorna a assinatura ativa do usuário, ou null se não houver."""
    from motors import assinaturas as assin_motor
    sub = assin_motor.assinatura_ativa(db, usuario.id)
    if not sub:
        return {"assinatura": None, "assinante": False}
    try:
        db.commit()  # persiste expiração detectada em tempo real
    except Exception:
        pass
    return {"assinatura": assin_motor.to_dict(sub), "assinante": True}


@router.get("/meu-saldo")
def meu_saldo(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Saldo de Fragmentos do Monarca + últimos 50 movimentos."""
    from motors import fragmentos as frag_motor
    return {
        "fragmentos": usuario.fragmentos or 0,
        "historico":  frag_motor.historico(db, usuario.id),
    }


class ComprarPacotePayload(BaseModel):
    pacote_id: int
    metodo: str = "pix"   # "pix" | "cartao"


@router.post("/comprar-pacote")
def comprar_pacote(
    payload: ComprarPacotePayload,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    Inicia a compra de um pacote de Fragmentos.

    [PENDENTE] Integração Mercado Pago — preencha a seção marcada com # ← MP.
    Por ora retorna 501 com instruções.
    """
    pacote = db.query(PacoteFragmentos).filter(
        PacoteFragmentos.id == payload.pacote_id,
        PacoteFragmentos.ativo == True,
    ).first()
    if not pacote:
        raise HTTPException(404, "Pacote não encontrado")

    # ← MP: criar preferência de pagamento
    # preference_data = {
    #     "items": [{"title": pacote.nome, "quantity": 1, "unit_price": pacote.preco_brl}],
    #     "external_reference": f"PACOTE:{usuario.id}:{pacote.id}",
    #     "notification_url": f"{BASE_URL}/api/pagamentos/webhook",
    # }
    # result = mercadopago.SDK(MP_ACCESS_TOKEN).preference().create(preference_data)
    # init_point = result["response"]["init_point"]
    #
    # Criar registro de Pagamento pendente:
    # pag = Pagamento(usuario_id=usuario.id, tipo="FRAGMENTOS",
    #                 referencia_id=pacote.id, valor_brl=pacote.preco_brl)
    # db.add(pag); db.commit()
    # return {"ok": True, "checkout_url": init_point}

    raise HTTPException(
        501,
        detail={
            "msg": "Integração Mercado Pago ainda não configurada.",
            "pacote": _pacote_to_dict(pacote),
            "instrucoes": "Configure MP_ACCESS_TOKEN e implemente a preferência de pagamento.",
        }
    )


class AssinarPayload(BaseModel):
    plano_id: int


@router.post("/assinar")
def assinar(
    payload: AssinarPayload,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    Inicia uma assinatura recorrente (Mensal/Semestral) ou pagamento único (Vitalícia).

    [PENDENTE] Integração Mercado Pago.
    """
    plano = db.query(Plano).filter(
        Plano.id == payload.plano_id,
        Plano.ativo == True,
    ).first()
    if not plano:
        raise HTTPException(404, "Plano não encontrado")

    # ← MP: para MENSAL — Preapproval (assinatura recorrente)
    # Para SEMESTRAL — Preferência única com validade de 6 meses
    # Para VITALICIO — Preferência única

    raise HTTPException(
        501,
        detail={
            "msg": "Integração Mercado Pago ainda não configurada.",
            "plano": _plano_to_dict(plano),
            "instrucoes": "Configure MP_ACCESS_TOKEN e implemente Preapproval/Preference.",
        }
    )


# ─── webhook Mercado Pago ──────────────────────────────────────────────────────

@router.post("/webhook")
async def webhook_mp(
    request: Request,
    db: Session = Depends(get_db),
    x_signature: Optional[str] = Header(None),
):
    """
    Receptor de notificações do Mercado Pago.

    O MP envia notificações para dois tipos principais:
      - type="payment"                    → compra de pacote de Fragmentos
      - type="subscription_preapproval"  → atualização de assinatura mensal

    Validação HMAC: o MP envia o header x-signature com o HMAC-SHA256 do body.
    Se MP_WEBHOOK_SECRET estiver configurado, validamos antes de processar.
    """
    body = await request.body()

    # Valida assinatura HMAC se o secret estiver configurado
    if MP_WEBHOOK_SECRET:
        expected = hmac.new(
            MP_WEBHOOK_SECRET.encode(),
            body,
            hashlib.sha256,
        ).hexdigest()
        if x_signature != expected:
            raise HTTPException(401, "Assinatura do webhook inválida")

    try:
        data = await request.json()
    except Exception:
        raise HTTPException(400, "Payload inválido")

    tipo     = data.get("type", "")
    acao     = data.get("action", "")
    data_id  = data.get("data", {}).get("id")

    if not data_id:
        return {"ok": True, "ignorado": True}

    # ── Pagamento único (Fragmentos) ─────────────────────────────────────────
    if tipo == "payment":
        return await _processar_pagamento(db, data_id)

    # ── Assinatura recorrente (Mensal) ────────────────────────────────────────
    if tipo == "subscription_preapproval":
        return await _processar_assinatura(db, data_id, acao)

    # Tipo desconhecido — aceita sem erro para o MP não retentar
    return {"ok": True, "tipo": tipo, "ignorado": True}


async def _processar_pagamento(db: Session, mp_payment_id: str) -> dict:
    """
    Processa um webhook de pagamento único (Pix / cartão).
    Credita os Fragmentos se aprovado e idempotente (nunca processa 2x).
    """
    # Verifica idempotência — se o pagamento já foi processado, ignora
    pag_existente = db.query(Pagamento).filter(
        Pagamento.mp_payment_id == str(mp_payment_id),
        Pagamento.processado_em != None,
    ).first()
    if pag_existente:
        return {"ok": True, "idempotente": True}

    # ← MP: buscar detalhes do pagamento
    # payment = mercadopago.SDK(MP_ACCESS_TOKEN).payment().get(mp_payment_id)
    # status   = payment["response"]["status"]
    # ref      = payment["response"].get("external_reference", "")  # "PACOTE:user_id:pacote_id"
    # valor    = payment["response"]["transaction_amount"]
    #
    # if status == "approved":
    #     _, usuario_id, pacote_id = ref.split(":")
    #     usuario = db.query(Usuario).filter(Usuario.id == int(usuario_id)).first()
    #     pacote  = db.query(PacoteFragmentos).filter(PacoteFragmentos.id == int(pacote_id)).first()
    #     if usuario and pacote:
    #         from motors import fragmentos as frag_motor
    #         pag = Pagamento(usuario_id=usuario.id, tipo="FRAGMENTOS",
    #                         referencia_id=pacote.id, mp_payment_id=str(mp_payment_id),
    #                         mp_status=status, valor_brl=valor,
    #                         fragmentos_creditados=pacote.fragmentos_entregues,
    #                         webhook_recebido_em=datetime.utcnow(), processado_em=datetime.utcnow())
    #         db.add(pag); db.flush()
    #         frag_motor.creditar(db, usuario, pacote.fragmentos_entregues,
    #                             motivo="compra_pacote", referencia_id=pag.id)
    #         db.commit()

    return {"ok": True, "mp_payment_id": mp_payment_id, "pendente_mp": True}


async def _processar_assinatura(db: Session, preapproval_id: str, acao: str) -> dict:
    """
    Processa atualização de assinatura recorrente (Preapproval).
    """
    # ← MP: buscar detalhes do preapproval
    # preapproval = mercadopago.SDK(MP_ACCESS_TOKEN).preapproval().get(preapproval_id)
    # status = preapproval["response"]["status"]  # authorized | paused | cancelled
    # ref    = preapproval["response"].get("external_reference", "")  # "PLANO:user_id:plano_id"
    #
    # sub = db.query(Assinatura).filter(
    #     Assinatura.mp_preapproval_id == str(preapproval_id)
    # ).first()
    #
    # if status == "authorized" and not sub:
    #     _, usuario_id, plano_id = ref.split(":")
    #     usuario = db.query(Usuario).filter(Usuario.id == int(usuario_id)).first()
    #     from motors import assinaturas as assin_motor
    #     assin_motor.ativar(db, usuario, int(plano_id),
    #                        origem="pagamento", mp_preapproval_id=str(preapproval_id))
    #     db.commit()
    # elif status == "cancelled" and sub:
    #     from motors import assinaturas as assin_motor
    #     assin_motor.cancelar(db, sub)
    #     db.commit()

    return {"ok": True, "preapproval_id": preapproval_id, "pendente_mp": True}


# ─── Painel do Arquiteto ───────────────────────────────────────────────────────

class ConcederAssinaturaPayload(BaseModel):
    usuario_id: int
    ciclo: str          # "MENSAL" | "SEMESTRAL" | "VITALICIO"
    motivo: Optional[str] = None


@router.post("/arquiteto/conceder-assinatura", status_code=201)
def conceder_assinatura(
    payload: ConcederAssinaturaPayload,
    db: Session = Depends(get_db),
    arquiteto: Usuario = Depends(get_arquiteto),
):
    """Arquiteto concede assinatura premium a um usuário sem pagamento."""
    from motors import assinaturas as assin_motor

    alvo = db.query(Usuario).filter(Usuario.id == payload.usuario_id).first()
    if not alvo:
        raise HTTPException(404, "Usuário não encontrado")

    try:
        sub = assin_motor.ativar_pelo_arquiteto(db, alvo, payload.ciclo)
        db.commit()
    except ValueError as e:
        raise HTTPException(400, str(e))

    return {
        "ok": True,
        "msg": f"Assinatura {payload.ciclo} concedida para {alvo.nome}.",
        "assinatura": assin_motor.to_dict(sub),
    }


class CreditarFragmentosPayload(BaseModel):
    usuario_id: int
    quantidade: int
    motivo: Optional[str] = "bonus_arquiteto"
    observacao: Optional[str] = None


@router.post("/arquiteto/creditar-fragmentos", status_code=201)
def creditar_fragmentos(
    payload: CreditarFragmentosPayload,
    db: Session = Depends(get_db),
    arquiteto: Usuario = Depends(get_arquiteto),
):
    """Arquiteto credita Fragmentos manualmente (campanhas, correções, etc.)."""
    from motors import fragmentos as frag_motor

    if payload.quantidade <= 0:
        raise HTTPException(400, "Quantidade deve ser maior que zero")

    alvo = db.query(Usuario).filter(Usuario.id == payload.usuario_id).first()
    if not alvo:
        raise HTTPException(404, "Usuário não encontrado")

    novo_saldo = frag_motor.creditar(
        db, alvo,
        delta=payload.quantidade,
        motivo=payload.motivo or "bonus_arquiteto",
        observacao=payload.observacao or f"Crédito manual pelo Arquiteto",
    )
    db.commit()

    return {
        "ok": True,
        "usuario": alvo.nome,
        "fragmentos_creditados": payload.quantidade,
        "novo_saldo": novo_saldo,
    }


@router.get("/arquiteto/assinaturas")
def painel_assinaturas(
    db: Session = Depends(get_db),
    arquiteto: Usuario = Depends(get_arquiteto),
):
    """Lista todas as assinaturas ativas para o painel do Arquiteto."""
    from motors import assinaturas as assin_motor

    ativas = db.query(Assinatura).filter(Assinatura.status == "ATIVA").all()
    return {
        "total": len(ativas),
        "assinaturas": [
            {
                **assin_motor.to_dict(sub),
                "usuario_id":    sub.usuario_id,
                "usuario_nome":  sub.usuario.nome if sub.usuario else None,
                "usuario_login": sub.usuario.login if sub.usuario else None,
            }
            for sub in ativas
        ],
    }
