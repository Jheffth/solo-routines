# -*- coding: utf-8 -*-
"""
Fragmentos do Monarca 🔮 — motor central de moeda premium.

REGRA ABSOLUTA: Nenhum código fora deste módulo modifica usuario.fragmentos
diretamente. Todo movimento (crédito ou débito) passa por aqui e gera uma
entrada no FragmentosLedger. É a mesma disciplina de motors/gamificacao.py
para XP — uma única porta de entrada e saída.

Por que ledger em vez de só um campo?
  usuario.fragmentos = 100  →  não diz de onde veio, quando, por quê.
  Com o ledger:             →  auditoria completa, reversível, rastreável.
  Isso importa quando há dinheiro real envolvido.

MOTIVOS válidos para passar em `motivo`:
  "compra_pacote"   — Fragmentos comprados via Mercado Pago
  "assinatura"      — Fragmentos bônus de um plano de assinatura
  "gasto_loja"      — Fragmentos gastos na loja da plataforma
  "bonus_mensal"    — Crédito mensal automático de plano ativo
  "convite"         — Fragmentos bonus de um convite do Arquiteto
  "bonus_arquiteto" — Crédito manual pelo Arquiteto (campanhas, correções)
  "indicacao"       — Recompensa por indicar um novo hunter
  "correcao"        — Ajuste manual de erro (negativo ou positivo)
"""
from datetime import datetime
from typing import Optional


def creditar(
    db,
    usuario,
    delta: int,
    motivo: str,
    referencia_id: Optional[int] = None,
    observacao: Optional[str] = None,
) -> int:
    """
    Credita `delta` Fragmentos ao usuario e registra no ledger.
    Retorna o novo saldo.

    Nunca credita valor negativo: use debitar() para gastos.
    """
    from database import FragmentosLedger

    if delta <= 0:
        raise ValueError(f"creditar() exige delta positivo (recebido: {delta}). Use debitar() para gastos.")

    usuario.fragmentos = (usuario.fragmentos or 0) + delta

    entrada = FragmentosLedger(
        usuario_id=usuario.id,
        delta=delta,
        saldo_apos=usuario.fragmentos,
        motivo=motivo,
        referencia_id=referencia_id,
        observacao=observacao,
        criado_em=datetime.utcnow(),
    )
    db.add(entrada)
    db.flush()
    return usuario.fragmentos


def debitar(
    db,
    usuario,
    delta: int,
    motivo: str,
    referencia_id: Optional[int] = None,
    observacao: Optional[str] = None,
) -> int:
    """
    Debita `delta` Fragmentos do usuario e registra no ledger.
    Retorna o novo saldo.

    Lança ValueError se o saldo for insuficiente.
    O delta passado deve ser positivo (o sinal negativo é aplicado internamente).
    """
    from database import FragmentosLedger

    if delta <= 0:
        raise ValueError(f"debitar() exige delta positivo (recebido: {delta}).")

    saldo_atual = usuario.fragmentos or 0
    if saldo_atual < delta:
        raise ValueError(
            f"Saldo insuficiente de Fragmentos: {saldo_atual} disponíveis, {delta} necessários."
        )

    usuario.fragmentos = saldo_atual - delta

    entrada = FragmentosLedger(
        usuario_id=usuario.id,
        delta=-delta,       # negativo no ledger = saída
        saldo_apos=usuario.fragmentos,
        motivo=motivo,
        referencia_id=referencia_id,
        observacao=observacao,
        criado_em=datetime.utcnow(),
    )
    db.add(entrada)
    db.flush()
    return usuario.fragmentos


def saldo(db, usuario_id: int) -> int:
    """Saldo atual de Fragmentos de um usuário (leitura direta do campo)."""
    from database import Usuario
    u = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    return u.fragmentos if u else 0


def historico(db, usuario_id: int, limite: int = 50) -> list:
    """
    Histórico de movimentos de Fragmentos, mais recente primeiro.
    Retorna lista de dicts prontos para serialização.
    """
    from database import FragmentosLedger
    entradas = (
        db.query(FragmentosLedger)
        .filter(FragmentosLedger.usuario_id == usuario_id)
        .order_by(FragmentosLedger.criado_em.desc())
        .limit(limite)
        .all()
    )
    return [
        {
            "id":            e.id,
            "delta":         e.delta,
            "saldo_apos":    e.saldo_apos,
            "motivo":        e.motivo,
            "referencia_id": e.referencia_id,
            "observacao":    e.observacao,
            "criado_em":     e.criado_em.isoformat() if e.criado_em else None,
        }
        for e in entradas
    ]
