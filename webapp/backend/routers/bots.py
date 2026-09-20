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


@router.post("/whatsapp/webhook")
async def webhook_whatsapp(request: Request, db: Session = Depends(get_db)):
    """
    O que a Evolution empurra para cá.

    SEM SEGREDO NO CABEÇALHO — a Evolution v2 não oferece um. A proteção é
    de rede: este endpoint só deve ser alcançável de dentro do Docker
    (`http://app:8000/...`), nunca publicado no Caddy. Se um dia precisar
    ser público, um token na query vira obrigatório.

    NUNCA LEVANTA. Webhook que responde erro faz a Evolution reenviar em
    laço, e um defeito nosso viraria uma tempestade de repetições.
    """
    try:
        corpo = await request.json()
    except Exception:
        return {"ok": True}

    try:
        evento = (corpo.get("event") or "").upper().replace(".", "_")
        dados = corpo.get("data") or {}

        if evento == "MESSAGES_UPSERT":
            _mensagem_recebida(db, dados)
    except Exception as e:
        print(f"[WHATSAPP] webhook ignorado: {e}")
    return {"ok": True}


def _mensagem_recebida(db: Session, dados: dict) -> None:
    chave = dados.get("key") or {}
    if chave.get("fromMe"):
        return                      # eco do que nós mesmos mandamos

    jid = chave.get("remoteJid") or ""
    if not jid or "@g.us" in jid:
        return                      # grupo não é conversa de hunter

    msg = dados.get("message") or {}
    texto = (msg.get("conversation")
             or (msg.get("extendedTextMessage") or {}).get("text")
             or "").strip()
    if not texto:
        return

    u = vinculo.por_origem(db, "whatsapp", jid)

    if not u:
        codigo = "".join(c for c in texto if c.isdigit())
        if len(codigo) == vinculo.DIGITOS:
            try:
                novo = vinculo.vincular(db, "whatsapp", codigo, jid,
                                        nome=jid.split("@")[0])
                evolution.enviar(jid, f"✅ Conversa vinculada a {novo.nome}.")
            except vinculo.ErroVinculo as e:
                evolution.enviar(jid, f"❌ {e.mensagem}")
        else:
            evolution.enviar(jid,
                "🔒 Esta conversa não está vinculada.\n\n"
                "Abra o Solo Routines em *Bots*, gere o código do WhatsApp "
                "e mande os 6 dígitos aqui.")
        return

    if texto.lower().startswith("/desvincular"):
        vinculo.desvincular(db, u, "whatsapp")
        evolution.enviar(jid, "🔌 Conversa desvinculada.")
        return

    # POR ENQUANTO SÓ AVISA, NÃO OBEDECE. Os comandos do Telegram
    # (`/hoje`, `/ok`) mexem na economia do Sistema, e replicá-los aqui
    # antes de o canal estar provado seria abrir dois caminhos para
    # errar. O WhatsApp entra como canal de SAÍDA primeiro.
    evolution.enviar(jid,
        f"👋 Olá, {u.nome}. Este canal ainda é só de avisos.\n"
        "Para agir nas missões, use o app ou o bot do Telegram.")
