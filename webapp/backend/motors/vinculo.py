# -*- coding: utf-8 -*-
"""
O VÍNCULO — como um bot descobre com QUAL hunter está falando.

O PROBLEMA, EM UMA FRASE

Qualquer pessoa pode escrever para o bot. O `chat_id` que chega prova que
ALGUÉM falou, nunca QUEM. Sem um segredo curto que só o dono da conta
consegue ver, o bot não tem como saber de quem é aquela conversa — e um
bot que adivinha entrega o XP, as missões e a rotina de alguém para
quem pedir primeiro.

A SOLUÇÃO: UM CÓDIGO QUE NASCE NO PAINEL E MORRE NO BOT

O hunter, já autenticado no app, pede um código de seis dígitos. Manda
para o bot. O bot troca o código pelo vínculo. Daí em diante o `chat_id`
é credencial suficiente, porque foi provado uma vez.

O SENTIDO IMPORTA: o código sai do painel, não do bot. Gerar o próprio
código de dentro do bot seria um laço — quem já está lá não precisa, e
quem não está não consegue pedir.

AS TRÊS DEFESAS, E POR QUE SÃO TRÊS

Seis dígitos são um milhão de combinações, e um milhão de palpites é
coisa de segundos para um script. Cada defesa fecha um caminho que as
outras deixam aberto:

  · VALIDADE CURTA (10 min) — código vazado ontem não serve hoje.
  · USO ÚNICO — consumido, morre. Dois bots não entram com o mesmo.
  · LIMITE POR ORIGEM (5 erros → 15 min de castigo) — é esta que
    transforma "improvável" em "impossível na prática". Sem ela, as
    outras duas só encurtam a janela do ataque; não o impedem.

O limite mora no BANCO, não em memória: o processo reinicia a cada
deploy, e um limite que zera no deploy é um limite que o atacante zera
sozinho — basta esperar.

Desenho emprestado do Solo CMV, que já resolveu isto em produção.
"""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta

from database import CodigoVinculo, TentativaVinculo, Usuario

DIGITOS = 6
MINUTOS_VALIDADE = 10
ERROS_ATE_BLOQUEAR = 5
MINUTOS_BLOQUEIO = 15

CANAIS = ("telegram", "whatsapp")


class ErroVinculo(Exception):
    """Falha esperada. A mensagem vai direto para o chat do hunter."""
    def __init__(self, mensagem: str):
        super().__init__(mensagem)
        self.mensagem = mensagem


def _agora() -> datetime:
    return datetime.utcnow()


def _canal_valido(canal: str) -> str:
    c = (canal or "").strip().lower()
    if c not in CANAIS:
        raise ErroVinculo(f"Canal desconhecido: {canal}")
    return c


# ══════════════════════════════════════════════════════════════════════
# GERAR — no painel
# ══════════════════════════════════════════════════════════════════════
def gerar(db, usuario: Usuario, canal: str) -> dict:
    """Um código novo para este hunter, neste canal."""
    canal = _canal_valido(canal)

    # Códigos anteriores do mesmo hunter/canal morrem agora. Dois códigos
    # vivos ao mesmo tempo dobram a superfície de adivinhação sem dar
    # nenhuma comodidade: o hunter usa o que está na tela.
    db.query(CodigoVinculo).filter(
        CodigoVinculo.usuario_id == usuario.id,
        CodigoVinculo.canal == canal,
        CodigoVinculo.usado_em.is_(None),
    ).delete(synchronize_session=False)

    # `secrets`, não `random`: o segundo é previsível a partir de algumas
    # saídas, e aqui a saída é pública por natureza — ela vai para um chat.
    codigo = "".join(str(secrets.randbelow(10)) for _ in range(DIGITOS))
    expira = _agora() + timedelta(minutes=MINUTOS_VALIDADE)

    db.add(CodigoVinculo(usuario_id=usuario.id, canal=canal,
                         codigo=codigo, expira_em=expira))
    db.commit()

    return {"codigo": codigo, "expira_em": expira.isoformat(),
            "validade_min": MINUTOS_VALIDADE, "canal": canal}


# ══════════════════════════════════════════════════════════════════════
# CONSUMIR — no bot
# ══════════════════════════════════════════════════════════════════════
def _tentativa(db, canal: str, origem: str) -> TentativaVinculo:
    t = db.query(TentativaVinculo).filter(
        TentativaVinculo.canal == canal,
        TentativaVinculo.origem == str(origem),
    ).first()
    if not t:
        t = TentativaVinculo(canal=canal, origem=str(origem), erros=0)
        db.add(t)
        db.flush()
    return t


def vincular(db, canal: str, codigo: str, origem: str,
             nome: str | None = None) -> Usuario:
    """
    Troca o código pelo vínculo. Quem chama é o bot.

    Devolve o `Usuario` vinculado, ou levanta `ErroVinculo` com um texto
    que pode ir direto para o chat.
    """
    canal = _canal_valido(canal)
    origem = str(origem).strip()
    codigo = "".join(c for c in str(codigo or "") if c.isdigit())

    t = _tentativa(db, canal, origem)
    agora = _agora()

    if t.bloqueado_ate and t.bloqueado_ate > agora:
        faltam = int((t.bloqueado_ate - agora).total_seconds() // 60) + 1
        raise ErroVinculo(f"Muitas tentativas. Tente de novo em {faltam} min.")

    if len(codigo) != DIGITOS:
        raise ErroVinculo(f"O código tem {DIGITOS} dígitos.")

    reg = db.query(CodigoVinculo).filter(
        CodigoVinculo.canal == canal,
        CodigoVinculo.codigo == codigo,
        CodigoVinculo.usado_em.is_(None),
        CodigoVinculo.expira_em > agora,
    ).first()

    if not reg:
        # ERRO ÚNICO PARA CAUSAS DIFERENTES. "Código inexistente" e
        # "código expirado" são mensagens distintas que, juntas, contam
        # a um atacante quando ele acertou os dígitos e chegou tarde —
        # o que reduz um milhão de palpites a um problema de tempo.
        t.erros = (t.erros or 0) + 1
        t.atualizado_em = agora
        if t.erros >= ERROS_ATE_BLOQUEAR:
            t.bloqueado_ate = agora + timedelta(minutes=MINUTOS_BLOQUEIO)
            t.erros = 0
        db.commit()
        raise ErroVinculo("Código inválido ou expirado. "
                          "Gere outro na aba Bots do app.")

    usuario = db.query(Usuario).filter(Usuario.id == reg.usuario_id).first()
    if not usuario or not usuario.ativo:
        raise ErroVinculo("A conta deste código não está disponível.")

    # A ORIGEM SÓ PODE PERTENCER A UM HUNTER. Sem isto, o mesmo celular
    # ficaria vinculado a duas contas e o bot responderia a conversa de
    # uma com os dados da outra. A coluna é UNIQUE no banco; aqui a
    # colisão vira uma mensagem em vez de um 500.
    campo = "telegram_chat_id" if canal == "telegram" else "whatsapp_jid"
    dono = db.query(Usuario).filter(
        getattr(Usuario, campo) == origem,
        Usuario.id != usuario.id,
    ).first()
    if dono:
        raise ErroVinculo("Este contato já está vinculado a outra conta. "
                          "Desvincule lá primeiro.")

    if canal == "telegram":
        usuario.telegram_chat_id = origem
        usuario.telegram_nome = (nome or "")[:64] or None
        usuario.telegram_vinculado_em = agora
    else:
        usuario.whatsapp_jid = origem
        usuario.whatsapp_numero = (nome or "")[:30] or None
        usuario.whatsapp_vinculado_em = agora

    reg.usado_em = agora
    t.erros = 0
    t.bloqueado_ate = None
    db.commit()
    db.refresh(usuario)
    return usuario


# ══════════════════════════════════════════════════════════════════════
# LER E DESFAZER
# ══════════════════════════════════════════════════════════════════════
def por_origem(db, canal: str, origem: str) -> Usuario | None:
    """
    O hunter dono desta conversa — ou None.

    É ESTA FUNÇÃO que substitui o antigo `_get_usuario()`, que devolvia
    "o primeiro usuário ativo". Aquele funcionava com um hunter só; com
    dois, entregava a rotina de um para o outro sem avisar ninguém.
    """
    canal = _canal_valido(canal)
    campo = "telegram_chat_id" if canal == "telegram" else "whatsapp_jid"
    return db.query(Usuario).filter(
        getattr(Usuario, campo) == str(origem),
        Usuario.ativo == True,          # noqa: E712
    ).first()


def vinculados(db, canal: str) -> list:
    """Todos os hunters alcançáveis por este canal — a lista dos avisos."""
    canal = _canal_valido(canal)
    campo = "telegram_chat_id" if canal == "telegram" else "whatsapp_jid"
    return db.query(Usuario).filter(
        getattr(Usuario, campo).isnot(None),
        Usuario.ativo == True,          # noqa: E712
    ).all()


def desvincular(db, usuario: Usuario, canal: str) -> bool:
    canal = _canal_valido(canal)
    if canal == "telegram":
        tinha = bool(usuario.telegram_chat_id)
        usuario.telegram_chat_id = None
        usuario.telegram_nome = None
        usuario.telegram_vinculado_em = None
    else:
        tinha = bool(usuario.whatsapp_jid)
        usuario.whatsapp_jid = None
        usuario.whatsapp_numero = None
        usuario.whatsapp_vinculado_em = None
    db.commit()
    return tinha


def situacao(db, usuario: Usuario) -> dict:
    """O que a aba Bots mostra."""
    return {
        "telegram": {
            "vinculado": bool(usuario.telegram_chat_id),
            "nome": usuario.telegram_nome,
            "desde": usuario.telegram_vinculado_em.isoformat()
                     if usuario.telegram_vinculado_em else None,
        },
        "whatsapp": {
            "vinculado": bool(usuario.whatsapp_jid),
            "numero": usuario.whatsapp_numero,
            "desde": usuario.whatsapp_vinculado_em.isoformat()
                     if usuario.whatsapp_vinculado_em else None,
        },
    }
