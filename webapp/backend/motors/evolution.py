# -*- coding: utf-8 -*-
"""
EVOLUTION API — o portão do WhatsApp.

PORTADO DO SOLO CMV, que já resolveu isto em produção. Os comentários de
lá descrevem armadilhas que só aparecem depois de horas perdidas, e vêm
junto de propósito: elas não são óbvias em leitura nenhuma da documentação.

O QUE É: a Evolution API é um contêiner que fala WhatsApp por baixo dos
panos (Baileys), expõe HTTP, e mantém a sessão viva. Não é a API oficial
da Meta — o que significa SEM template aprovado e SEM custo por conversa,
e também que o número pode ser banido se for usado como spam. Para um
punhado de hunters recebendo os próprios avisos, é a escolha certa; para
disparo em massa, não seria.

AS DUAS ARMADILHAS QUE O SOLO CMV JÁ PAGOU PARA APRENDER

1. O WEBHOOK DA v2 É UM OBJETO. Na v1 ia solto: `webhook` como string,
   mais `webhook_by_events` e `events` no primeiro nível. Mandando no
   formato antigo, a v2 ACEITA a criação da instância e simplesmente
   ignora o webhook — sem erro, sem aviso. O sintoma é o QR nunca
   chegar: um QR do WhatsApp vive ~20 segundos, e escanear um vencido
   faz o celular aceitar e o servidor descartar.

2. O ESTADO É "close", SEM O D. O código original testava "closed",
   nunca casava, e o ramo de recriar instância travada era código morto.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

URL      = os.getenv("EVOLUTION_API_URL", "http://whatsapp:8080").rstrip("/")
API_KEY  = os.getenv("EVOLUTION_API_KEY", "")
INSTANCIA = os.getenv("EVOLUTION_INSTANCE", "solo_rotinas")
WEBHOOK  = os.getenv("EVOLUTION_WEBHOOK",
                     "http://app:8000/api/whats/webhook")

EVENTOS = ["QRCODE_UPDATED", "CONNECTION_UPDATE", "MESSAGES_UPSERT"]


def configurado() -> bool:
    """Há Evolution para falar? A aba Bots pergunta ANTES de oferecer o QR."""
    return bool(URL and API_KEY)


def _req(metodo: str, caminho: str, payload: dict | None = None,
         timeout: int = 10) -> dict:
    req = urllib.request.Request(
        f"{URL}{caminho}",
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={"apikey": API_KEY, "Content-Type": "application/json",
                 "User-Agent": "SoloRoutines"},
        method=metodo,
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            bruto = r.read().decode("utf-8")
            return {"status": r.getcode(),
                    "dados": json.loads(bruto) if bruto else {}}
    except urllib.error.HTTPError as e:
        return {"status": e.code, "erro": e.read().decode("utf-8", "replace")}
    except Exception as e:
        return {"status": 0, "erro": str(e)}


def _bloco_webhook() -> dict:
    """O formato da v2 — objeto, não campos soltos. Ver armadilha 1."""
    return {"enabled": True, "url": WEBHOOK, "byEvents": False,
            "base64": True, "events": EVENTOS}


def estado() -> dict:
    r = _req("GET", f"/instance/connectionState/{INSTANCIA}", timeout=6)
    if r.get("status") == 200:
        d = r.get("dados") or {}
        st = (d.get("instance") or {}).get("state") or d.get("state") or "close"
        return {"conectado": st == "open", "estado": st}
    return {"conectado": False, "estado": "close", "detalhe": r.get("erro")}


def registrar_webhook() -> bool:
    """Idempotente, e separado da criação de propósito: instância criada
    antes desta correção nasceu sem webhook e nunca seria recriada."""
    r = _req("POST", f"/webhook/set/{INSTANCIA}",
             payload={"webhook": _bloco_webhook()}, timeout=8)
    return r.get("status") in (200, 201)


def garantir_instancia() -> dict:
    r = _req("POST", "/instance/create", payload={
        "instanceName": INSTANCIA,
        "qrcode": True,
        "integration": "WHATSAPP-BAILEYS",
        "webhook": _bloco_webhook(),
    }, timeout=12)

    # 403 = "esse nome já está em uso", o caso normal a partir da segunda
    # chamada. Não é falha — mas é a hora de garantir o webhook dela.
    if r.get("status") in (200, 201, 403):
        registrar_webhook()
        return {"ok": True, "novo": r.get("status") in (200, 201)}
    return {"ok": False, "detalhe": r.get("erro")}


def qrcode() -> dict:
    """
    O QR para a tela. Recria a instância só quando ela está travada.

    NÃO RECRIAR EM `connecting`: alguém pode estar com o QR na mão neste
    instante, e recriar invalidaria justamente aquele.
    """
    st = (estado().get("estado") or "").lower()
    if st in ("close", "closed", "refused"):
        _req("DELETE", f"/instance/delete/{INSTANCIA}", timeout=8)
        garantir_instancia()
    elif st != "connecting":
        garantir_instancia()

    r = _req("GET", f"/instance/connect/{INSTANCIA}", timeout=12)
    if r.get("status") not in (200, 201):
        return {"ok": False, "detalhe": r.get("erro")}

    d = r.get("dados") or {}
    b64 = d.get("base64") or (d.get("qrcode") or {}).get("base64")
    if b64 and not b64.startswith("data:"):
        b64 = f"data:image/png;base64,{b64}"
    return {"ok": True, "qrcode": b64,
            "pairing_code": d.get("pairingCode"),
            "estado": estado().get("estado")}


def enviar(jid: str, texto: str) -> bool:
    """Uma mensagem. O `jid` é o identificador do contato no WhatsApp."""
    if not configurado():
        return False
    numero = str(jid).split("@")[0]
    r = _req("POST", f"/message/sendText/{INSTANCIA}",
             payload={"number": numero, "text": texto}, timeout=12)
    return r.get("status") in (200, 201)


def desconectar() -> bool:
    return _req("DELETE", f"/instance/logout/{INSTANCIA}",
                timeout=8).get("status") in (200, 201)
