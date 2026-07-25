# -*- coding: utf-8 -*-
"""
Efeitos da loja — o que ACONTECE quando um item é resgatado.

Até aqui, resgatar apenas debitava Mana Coins. Comprei um item no teste e
comparei o hunter antes e depois: o único campo alterado foi `moedas`. Ou
seja, a loja cobrava e não entregava nada — o que basta para uma recompensa
da vida real ("um dia de folga"), mas torna impossível vender uma aura.

Este módulo é um REGISTRO, no mesmo espírito do `Auras.registrar` que o
frontend já usa e que funciona bem: cada tipo de item declara como se
entrega, e o resgate só pergunta "quem sabe entregar isto?".

Acrescentar um tipo novo (moldura, título, som) é escrever uma função e
registrá-la aqui embaixo. Nada no resgate muda.

Contrato de um efeito:

    def entregar(db, usuario, recompensa) -> dict | None

    Devolve o que deve ser CELEBRADO na tela, no formato de
    motors/celebracao (conquistas / level_ups / xp / moedas), ou None quando
    não há cerimônia. Não faz commit: quem chama controla a transação.

    Levanta ValueError quando a entrega não é possível (item já possuído,
    payload apontando para um cosmético que não existe). O resgate traduz
    isso em 400 — e, principalmente, NÃO cobra por algo que não entregou.
"""
from datetime import datetime

from sqlalchemy.orm import Session

from database import Usuario, AuraUsuario, Conquista, ConquistaUsuario
from motors import cosmeticos


# ── Efeitos ──────────────────────────────────────────────────────────

def _entregar_externa(db: Session, usuario: Usuario, r) -> None:
    """Recompensa da vida real: o Sistema registra, quem cumpre é o hunter.

    Não há o que entregar aqui, e isso é correto — não um esquecimento."""
    return None


def _entregar_aura(db: Session, usuario: Usuario, r) -> dict:
    """Põe a aura no inventário do hunter e a deixa pronta para a cerimônia."""
    aura_id = (r.payload or "").strip()
    if not cosmeticos.existe(aura_id):
        raise ValueError("Esta aura não existe mais no catálogo.")

    ja_tem = db.query(AuraUsuario).filter(
        AuraUsuario.usuario_id == usuario.id,
        AuraUsuario.aura_id    == aura_id,
    ).first()
    if ja_tem:
        raise ValueError("Você já possui esta aura.")

    cat = cosmeticos.aura(aura_id)
    db.add(AuraUsuario(
        usuario_id=usuario.id,
        aura_id=aura_id,
        obtida_em=datetime.utcnow(),
        mensagem="Adquirida na Loja do Hunter",
        # celebrada=False: a aura se revela numa cerimônia, como quando é
        # presenteada. Comprar não pode ser mais sem graça do que ganhar.
        celebrada=False,
    ))
    return {"conquistas": [{
        "codigo": aura_id, "titulo": cat["nome"],
        "descricao": cat["descricao"], "icone": "✨", "cor": cat["cor"],
        "tipo_cosmetico": "aura",
    }]}


def _entregar_emblema(db: Session, usuario: Usuario, r) -> dict:
    """Concede um emblema comprável (nunca um conquistado por mérito)."""
    codigo = (r.payload or "").strip()
    q = db.query(Conquista).filter(Conquista.codigo == codigo).first()
    if not q:
        raise ValueError("Este emblema não existe mais no catálogo.")

    ja_tem = db.query(ConquistaUsuario).filter(
        ConquistaUsuario.usuario_id   == usuario.id,
        ConquistaUsuario.conquista_id == q.id,
    ).first()
    if ja_tem:
        raise ValueError("Você já possui este emblema.")

    cu = ConquistaUsuario(usuario_id=usuario.id, conquista_id=q.id,
                          desbloqueada_em=datetime.utcnow())
    try:
        cu.celebrada = False
    except Exception:
        pass
    db.add(cu)

    # O emblema comprado entrega o bônus que ele anuncia, como qualquer outro.
    xp = q.xp_bonus or 0
    mo = q.moedas_bonus or 0
    if xp or mo:
        usuario.xp_total = (usuario.xp_total or 0) + xp
        usuario.xp_atual = (usuario.xp_atual or 0) + xp
        usuario.moedas   = (usuario.moedas   or 0) + mo

    return {"conquistas": [{
        "codigo": q.codigo, "titulo": q.titulo, "descricao": q.descricao,
        "icone": q.icone, "xp_bonus": xp, "moedas_bonus": mo,
    }], "xp_ganho": xp, "moedas_ganhas": mo}


# ── Registro ─────────────────────────────────────────────────────────
# Um tipo novo entra aqui e passa a existir em todo o sistema.
EFEITOS = {
    "externa": _entregar_externa,
    "aura":    _entregar_aura,
    "emblema": _entregar_emblema,
}

# Tipos cujo item é POSSUÍDO para sempre: comprar duas vezes não faz sentido
# e o próprio efeito recusa. A vitrine usa isto para mostrar "Adquirido" em
# vez de convidar a uma compra que vai falhar.
TIPOS_UNICOS = ("aura", "emblema")


def tipos_disponiveis() -> list:
    return sorted(EFEITOS.keys())


def eh_unico(tipo: str) -> bool:
    return (tipo or "externa") in TIPOS_UNICOS


def entregar(db: Session, usuario: Usuario, recompensa) -> dict | None:
    """Entrega o item. Tipo desconhecido não vira cobrança silenciosa."""
    tipo = (getattr(recompensa, "tipo", None) or "externa").lower()
    fn = EFEITOS.get(tipo)
    if not fn:
        raise ValueError(f"O Sistema não sabe entregar um item do tipo '{tipo}'.")
    return fn(db, usuario, recompensa)


def ja_possui(db: Session, usuario_id: int, recompensa) -> bool:
    """O hunter já tem este cosmético? Serve à vitrine, antes do clique."""
    tipo = (getattr(recompensa, "tipo", None) or "externa").lower()
    alvo = (getattr(recompensa, "payload", None) or "").strip()
    if not alvo:
        return False
    if tipo == "aura":
        return db.query(AuraUsuario).filter(
            AuraUsuario.usuario_id == usuario_id,
            AuraUsuario.aura_id    == alvo,
        ).first() is not None
    if tipo == "emblema":
        return db.query(ConquistaUsuario).join(
            Conquista, Conquista.id == ConquistaUsuario.conquista_id
        ).filter(
            ConquistaUsuario.usuario_id == usuario_id,
            Conquista.codigo == alvo,
        ).first() is not None
    return False
