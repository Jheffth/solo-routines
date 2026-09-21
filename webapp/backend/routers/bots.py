# -*- coding: utf-8 -*-
"""
A ABA BOTS — conectar o hunter aos canais de aviso.

O QUE ESTA TELA RESOLVE

O bot do Telegram existia e servia UM hunter: `_get_usuario()` devolvia
"o primeiro usuário ativo". Não havia como um segundo hunter se
apresentar, e nada na interface explicava por que ele não recebia nada.

Aqui cada hunter gera o próprio código de seis dígitos, manda para o bot,
e a conversa passa a ser dele. O WhatsApp segue por outro caminho — um QR
que o celular escaneia — mas termina no mesmo lugar: um identificador
provadamente ligado a uma conta.

POR QUE OS DOIS CANAIS TÊM FLUXOS DIFERENTES

Telegram é conversa: o hunter já tem o app, acha o bot e escreve. O
código de seis dígitos é o que prova quem ele é.

WhatsApp via Evolution API é SESSÃO: existe um número do Sistema, e o
celular do Arquiteto pareia com ele por QR uma vez. Depois disso o
hunter escreve, e o vínculo usa o mesmo código de seis dígitos do
Telegram — a prova de identidade é a mesma, só a porta muda.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth.router import get_usuario_atual, get_arquiteto, NIVEL_ARQUITETO
from database import get_db, Usuario
from motors import evolution, vinculo

router = APIRouter(prefix="/bots", tags=["bots"])


@router.get("/status")
def status(db: Session = Depends(get_db),
           usuario: Usuario = Depends(get_usuario_atual)):
    """Tudo que a aba precisa para desenhar, numa chamada."""
    import os
    sit = vinculo.situacao(db, usuario)

    # `disponivel` é sobre o SERVIDOR, não sobre o hunter. Oferecer o
    # botão de um canal que o servidor não tem como cumprir leva o hunter
    # a um beco — e a culpa parece ser dele.
    sit["telegram"]["disponivel"] = bool(os.getenv("TELEGRAM_BOT_TOKEN", ""))
    sit["telegram"]["usuario_bot"] = os.getenv("TELEGRAM_BOT_USERNAME", "")
    sit["whatsapp"]["disponivel"] = evolution.configurado()

    # ── O DIAGNÓSTICO DO SERVIDOR, e por que ele vem NESTA chamada ────
    #
    # Ter o token não é estar pronto: sem webhook registrado o Telegram
    # não tem para onde entregar, e o hunter vive exatamente o mesmo
    # sintoma de quando não há token nenhum — manda `/vincular` e nada
    # acontece. A diferença só aparece perguntando ao Telegram.
    #
    # Junto do `/bots/status` de propósito: a aba faz UMA chamada e
    # desenha tudo. Um segundo pedido só para o Arquiteto criaria um
    # estado intermediário em que metade da tela sabe e a outra não.
    #
    # `isCriador`, não `isAdmin`: aqui saem o endereço do webhook e o
    # erro cru do Telegram. É diagnóstico de servidor.
    sit["telegram"]["servidor"] = None
    if usuario.nivel_acesso == NIVEL_ARQUITETO:
        try:
            from routers import bot_telegram
            sit["telegram"]["servidor"] = bot_telegram.diagnostico()
        except Exception as e:
            # Um diagnóstico que derruba a aba inteira é pior que
            # diagnóstico nenhum — o hunter perderia até o botão de
            # gerar código por causa de uma consulta externa.
            sit["telegram"]["servidor"] = {"erro_consulta": str(e)}

    if evolution.configurado():
        try:
            sit["whatsapp"]["sessao"] = evolution.estado()
        except Exception as e:
            sit["whatsapp"]["sessao"] = {"conectado": False, "detalhe": str(e)}
    return sit


# ══════════════════════════════════════════════════════════════════════
# PREFERÊNCIAS DE AVISO
# ══════════════════════════════════════════════════════════════════════
class PrefAviso(BaseModel):
    acendeu: Optional[bool] = None
    beira:   Optional[bool] = None
    venceu:  Optional[bool] = None
    portao:  Optional[bool] = None
    minutos_beira:  Optional[int] = None
    minutos_portao: Optional[int] = None
    silencio_de:  Optional[str] = None
    silencio_ate: Optional[str] = None
    canal_avisos: Optional[str] = None


def _pref_dict(p) -> dict:
    return {
        "acendeu": bool(p.acendeu), "beira": bool(p.beira),
        "venceu": bool(p.venceu),   "portao": bool(p.portao),
        "minutos_beira": p.minutos_beira or 15,
        "minutos_portao": p.minutos_portao or 30,
        "silencio_de": p.silencio_de or "23:00",
        "silencio_ate": p.silencio_ate or "06:00",
        "canal_avisos": p.canal_avisos or "telegram",
    }


@router.get("/avisos")
def ler_avisos(db: Session = Depends(get_db),
               usuario: Usuario = Depends(get_usuario_atual)):
    from motors import avisos
    p = avisos.preferencia(db, usuario)
    db.commit()          # a primeira leitura cria a linha padrão
    return _pref_dict(p)


@router.put("/avisos")
def salvar_avisos(payload: PrefAviso,
                  db: Session = Depends(get_db),
                  usuario: Usuario = Depends(get_usuario_atual)):
    from motors import avisos
    p = avisos.preferencia(db, usuario)

    for campo in ("acendeu", "beira", "venceu", "portao"):
        v = getattr(payload, campo)
        if v is not None:
            setattr(p, campo, bool(v))

    # OS LIMITES NÃO SÃO CAPRICHO. Abaixo de 5 minutos o aviso mente: o
    # varredor roda de 5 em 5, então "faltam 2 minutos" chegaria quando
    # faltasse qualquer coisa entre 2 e 7. Acima de 120 ele deixa de ser
    # "beira da falha" e vira mais uma cobrança no meio da tarde.
    if payload.minutos_beira is not None:
        p.minutos_beira = max(5, min(120, int(payload.minutos_beira)))
    if payload.minutos_portao is not None:
        p.minutos_portao = max(5, min(180, int(payload.minutos_portao)))

    def _hora_valida(s):
        try:
            h, m = str(s).split(":")
            return 0 <= int(h) <= 23 and 0 <= int(m) <= 59
        except Exception:
            return False

    for campo in ("silencio_de", "silencio_ate"):
        v = getattr(payload, campo)
        if v is not None:
            if not _hora_valida(v):
                raise HTTPException(400, f"Horário inválido: {v}. Use HH:MM.")
            setattr(p, campo, v)

    # O CANAL PREFERIDO. Um valor desconhecido vira "telegram" em vez de
    # ser guardado: uma string errada no banco calaria os avisos sem
    # nenhuma pista na tela — o pior modo de falhar que este sistema tem.
    if payload.canal_avisos is not None:
        v = str(payload.canal_avisos).lower().strip()
        p.canal_avisos = v if v in ("telegram", "whatsapp", "ambos") else "telegram"

    db.commit()
    return _pref_dict(p)


@router.post("/codigo/{canal}")
def gerar_codigo(canal: str,
                 db: Session = Depends(get_db),
                 usuario: Usuario = Depends(get_usuario_atual)):
    """
    Um código de seis dígitos para ESTE hunter.

    Só pelo painel, e é a regra que sustenta o resto: gerar o próprio
    código de dentro do bot seria um laço — quem já está lá não precisa,
    e quem não está não consegue pedir.
    """
    try:
        return vinculo.gerar(db, usuario, canal)
    except vinculo.ErroVinculo as e:
        raise HTTPException(400, e.mensagem)


@router.delete("/vinculo/{canal}")
def desvincular(canal: str,
                db: Session = Depends(get_db),
                usuario: Usuario = Depends(get_usuario_atual)):
    try:
        tinha = vinculo.desvincular(db, usuario, canal)
    except vinculo.ErroVinculo as e:
        raise HTTPException(400, e.mensagem)
    return {"ok": True, "estava_vinculado": tinha}


# ══════════════════════════════════════════════════════════════════════
# WHATSAPP — a sessão do Sistema
# ══════════════════════════════════════════════════════════════════════
@router.get("/whatsapp/qrcode")
def qrcode(usuario: Usuario = Depends(get_arquiteto)):
    """
    O QR que liga o NÚMERO DO SISTEMA ao WhatsApp.

    SÓ O ARQUITETO. Este QR não vincula um hunter — ele pareia a conta de
    WhatsApp que o Sistema usa para falar com todo mundo. Quem escaneia
    passa a ser o remetente de todos os avisos, de todos os hunters.
    Deixar isso aberto seria entregar o número do Sistema a quem pedisse.
    """
    if not evolution.configurado():
        raise HTTPException(400,
            "A Evolution API não está configurada neste servidor "
            "(EVOLUTION_API_URL e EVOLUTION_API_KEY no .env).")
    r = evolution.qrcode()
    if not r.get("ok"):
        raise HTTPException(502, f"A Evolution não respondeu: {r.get('detalhe')}")
    return r


@router.delete("/whatsapp/sessao")
def encerrar_sessao(usuario: Usuario = Depends(get_arquiteto)):
    if not evolution.configurado():
        raise HTTPException(400, "A Evolution API não está configurada.")
    return {"ok": evolution.desconectar()}


# ── O WEBHOOK DO WHATSAPP MUDOU DE CASA ──────────────────────────────
#
# Ele vivia aqui e agora é `routers/bot_whatsapp.py`, em
# `/api/whats/webhook`. A razão: deixou de ser "um aviso de boas-vindas"
# e virou a porta de um bot completo — idempotência, eco do próprio
# aparelho, escolha numerada. Isso é transporte de canal, não
# configuração de aba.
#
# QUEM JÁ TIVER A URL ANTIGA registrada na Evolution precisa trocá-la:
# `EVOLUTION_WEBHOOK` no .env aponta para o caminho novo, e o botão da
# aba Bots reconfigura.
