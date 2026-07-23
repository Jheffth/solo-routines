# -*- coding: utf-8 -*-
"""
Login e registro sociais — Google e Discord (OAuth2 Authorization Code Flow).

Regras do Sistema mantidas:
  • REGISTRO continua fechado: exige convite válido, mesmo vindo do Google/Discord.
    O convite é validado ANTES de mandar o hunter ao provedor e de novo na volta.
  • LOGIN social só entra em conta que já existe. Vínculo automático a uma conta
    de senha só acontece por e-mail VERIFICADO pelo provedor — nunca por e-mail
    que o provedor não confirmou (senão qualquer um "reivindicaria" outra conta).
  • nivel_acesso jamais vem do provedor: sai do convite (User/Admin), nunca Arquiteto.

Sem credenciais configuradas (config.oauth_configurado), os endpoints respondem
404/400 e os botões nem aparecem no frontend — o app segue com senha normal.

O segredo do provedor (client_secret) é usado SÓ aqui, no servidor, na troca do
`code` por token — chamada máquina-a-máquina legítima, nunca exposta ao browser.
"""
import time
import secrets
import urllib.parse
from datetime import datetime
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from database import get_db, Usuario, IdentidadeOAuth
from auth.service import criar_token, registrar_log
from auth.registro_core import validar_convite, criar_conta, _login_unico
import config

router = APIRouter(prefix="/auth/oauth", tags=["oauth"])


# ── Catálogo dos provedores ───────────────────────────────────────────────
# Endpoints públicos e estáveis de cada provedor. Concentrados aqui para que
# acrescentar um terceiro (GitHub, etc.) seja só mais uma entrada neste mapa.
PROVEDORES = {
    "google": {
        "authorize": "https://accounts.google.com/o/oauth2/v2/auth",
        "token":     "https://oauth2.googleapis.com/token",
        "userinfo":  "https://www.googleapis.com/oauth2/v3/userinfo",
        "scope":     "openid email profile",
        "client_id":     lambda: config.GOOGLE_CLIENT_ID,
        "client_secret": lambda: config.GOOGLE_CLIENT_SECRET,
    },
    "discord": {
        "authorize": "https://discord.com/api/oauth2/authorize",
        "token":     "https://discord.com/api/oauth2/token",
        "userinfo":  "https://discord.com/api/users/@me",
        "scope":     "identify email",
        "client_id":     lambda: config.DISCORD_CLIENT_ID,
        "client_secret": lambda: config.DISCORD_CLIENT_SECRET,
    },
}


# ── Guarda de estado (CSRF + memória do convite) ──────────────────────────
# O `state` viaja até o provedor e volta. Ele prova que o callback responde a
# um pedido que ESTE servidor iniciou (anti-CSRF) e carrega o que não pode ir
# na URL pública: o convite e o modo (login/registro).
# Loja em memória: o fluxo dura segundos e é de uso único. Reinício do servidor
# no meio de um login é aceitável (o hunter só clica de novo).
_ESTADOS: dict[str, dict] = {}
_TTL_ESTADO = 600  # 10 min — tempo de sobra para autorizar no provedor


def _limpar_estados():
    agora = time.time()
    for s in [k for k, v in _ESTADOS.items() if agora - v["criado"] > _TTL_ESTADO]:
        _ESTADOS.pop(s, None)


def _redirect_uri(provedor: str) -> str:
    return f"{config.OAUTH_REDIRECT_BASE}/api/auth/oauth/{provedor}/callback"


def _voltar_front(fragmento: str) -> RedirectResponse:
    """Redireciona ao app carregando o resultado no fragmento (#...).
       O fragmento nunca chega ao servidor nem aos logs — bom lugar para o JWT."""
    base = config.OAUTH_REDIRECT_BASE or ""
    return RedirectResponse(url=f"{base}/#{fragmento}", status_code=302)


def _erro_front(msg: str) -> RedirectResponse:
    return _voltar_front("sr_erro=" + urllib.parse.quote(msg))


# ── Normalização do perfil de cada provedor ───────────────────────────────
def _perfil_google(dados: dict) -> dict:
    return {
        "provedor_id": str(dados.get("sub") or ""),
        "email":       (dados.get("email") or "").strip().lower() or None,
        "email_ok":    bool(dados.get("email_verified")),
        "nome":        dados.get("name") or dados.get("given_name") or "Hunter",
        "avatar":      dados.get("picture") or None,
        "sugestao_login": (dados.get("email") or "").split("@")[0],
    }


def _perfil_discord(dados: dict) -> dict:
    uid = str(dados.get("id") or "")
    avatar = dados.get("avatar")
    url = (f"https://cdn.discordapp.com/avatars/{uid}/{avatar}.png"
           if uid and avatar else None)
    nome = dados.get("global_name") or dados.get("username") or "Hunter"
    return {
        "provedor_id": uid,
        "email":       (dados.get("email") or "").strip().lower() or None,
        "email_ok":    bool(dados.get("verified")),
        "nome":        nome,
        "avatar":      url,
        "sugestao_login": dados.get("username") or nome,
    }


_NORMALIZA = {"google": _perfil_google, "discord": _perfil_discord}


# ── Endpoints ─────────────────────────────────────────────────────────────
@router.get("/disponiveis")
def disponiveis():
    """Diz ao frontend quais botões desenhar. Provedor sem credencial fica de fora."""
    return {p: config.oauth_configurado(p) for p in PROVEDORES}


@router.get("/{provedor}/login")
def login_social(provedor: str, request: Request,
                 modo: str = "login", codigo: Optional[str] = None,
                 db: Session = Depends(get_db)):
    """
    Ponto de partida. Guarda o convite/modo num `state` e manda o hunter ao
    provedor. Para modo=registro, o convite é conferido JÁ AQUI — assim quem
    não tem convite nem chega a autorizar o app no Google/Discord.
    """
    provedor = (provedor or "").lower()
    cfg = PROVEDORES.get(provedor)
    if not cfg or not config.oauth_configurado(provedor):
        raise HTTPException(404, "Provedor social indisponível")

    modo = "registro" if (modo or "").lower() == "registro" else "login"
    codigo = (codigo or "").strip().upper() or None
    if modo == "registro":
        if not codigo:
            raise HTTPException(400, "Registro exige um código de convite")
        validar_convite(db, codigo)   # levanta 400 com o motivo se não servir

    _limpar_estados()
    state = secrets.token_urlsafe(24)
    _ESTADOS[state] = {"provedor": provedor, "modo": modo,
                       "codigo": codigo, "criado": time.time()}

    params = {
        "client_id":     cfg["client_id"](),
        "redirect_uri":  _redirect_uri(provedor),
        "response_type": "code",
        "scope":         cfg["scope"],
        "state":         state,
    }
    if provedor == "google":
        params["access_type"] = "online"
        params["prompt"] = "select_account"
    if provedor == "discord":
        params["prompt"] = "consent"

    url = cfg["authorize"] + "?" + urllib.parse.urlencode(params)
    return RedirectResponse(url=url, status_code=302)


@router.get("/{provedor}/callback")
def callback_social(provedor: str, request: Request,
                    code: Optional[str] = None, state: Optional[str] = None,
                    error: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Volta do provedor. Troca o code por token, lê o perfil e resolve:
      • identidade já vinculada  → login
      • login sem vínculo        → tenta casar por e-mail verificado
      • registro                 → exige convite e cria a conta
    Sempre termina redirecionando ao app com #sr_token ou #sr_erro.
    """
    provedor = (provedor or "").lower()
    cfg = PROVEDORES.get(provedor)
    if not cfg or not config.oauth_configurado(provedor):
        return _erro_front("Provedor social indisponível.")

    if error:
        return _erro_front("Autorização cancelada no provedor.")
    if not code or not state:
        return _erro_front("Resposta inválida do provedor.")

    _limpar_estados()
    ctx = _ESTADOS.pop(state, None)   # uso único: consome o state
    if not ctx or ctx["provedor"] != provedor:
        return _erro_front("Sessão de login expirada. Tente novamente.")

    # 1. code → token de acesso.
    # Não usamos raise_for_status "cego": quando o provedor RECUSA (4xx), ele
    # explica o motivo no corpo (redirect_uri_mismatch, invalid_client, code
    # expirado…). Registramos isso no console — é o que salva o debug.
    redir = _redirect_uri(provedor)
    try:
        with httpx.Client(timeout=12) as cli:
            tok = cli.post(cfg["token"], data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redir,
                "client_id": cfg["client_id"](),
                "client_secret": cfg["client_secret"](),
            }, headers={"Accept": "application/json"})
            if tok.status_code != 200:
                print(f"[OAUTH] ✖ {provedor} /token HTTP {tok.status_code} "
                      f"(redirect_uri={redir}): {tok.text[:400]}")
                return _erro_front("O provedor recusou o login. "
                                   "Confira as credenciais e o redirect URI.")
            access = tok.json().get("access_token")
            if not access:
                print(f"[OAUTH] ✖ {provedor} /token sem access_token: {tok.text[:300]}")
                return _erro_front("O provedor não devolveu o acesso.")

            # 2. token → perfil
            ui = cli.get(cfg["userinfo"],
                         headers={"Authorization": f"Bearer {access}"})
            if ui.status_code != 200:
                print(f"[OAUTH] ✖ {provedor} /userinfo HTTP {ui.status_code}: {ui.text[:300]}")
                return _erro_front("Não consegui ler seu perfil no provedor.")
            perfil = _NORMALIZA[provedor](ui.json())
    except httpx.HTTPError as e:
        # Aqui é rede/SSL: nem chegou a falar com o provedor (proxy, firewall,
        # antivírus interceptando TLS, DNS…). É diferente de "provedor recusou".
        print(f"[OAUTH] ✖ {provedor} falha de transporte (rede/SSL): {e!r}")
        return _erro_front("Falha ao conversar com o provedor. Tente novamente.")

    if not perfil["provedor_id"]:
        return _erro_front("Perfil do provedor sem identificador.")

    modo = ctx["modo"]
    try:
        usuario = _resolver_conta(db, provedor, perfil, modo, ctx.get("codigo"))
    except HTTPException as e:
        db.rollback()
        return _erro_front(str(e.detail))
    except Exception as e:
        db.rollback()
        print(f"[OAUTH] 🚨 erro inesperado no callback {provedor}: {e}")
        return _erro_front("Erro interno ao entrar. Tente novamente.")

    token = criar_token({"sub": usuario.login, "nivel_acesso": usuario.nivel_acesso})
    registrar_log(db, usuario.login, "LOGIN_OAUTH",
                  f"Entrou via {provedor} (modo {modo})",
                  ip=request.client.host if request.client else None)
    return _voltar_front("sr_token=" + urllib.parse.quote(token))


def _resolver_conta(db: Session, provedor: str, perfil: dict,
                    modo: str, codigo: Optional[str]) -> Usuario:
    """
    Decide para qual conta o hunter entra. Ponto único onde a regra de
    identidade/vínculo/registro convive — mantê-la junta evita brechas.
    Não faz commit por conta própria a não ser no fim (registro amarra a
    identidade na mesma transação da criação da conta).
    """
    # (a) Identidade já vinculada? Caminho mais curto: login direto.
    ident = db.query(IdentidadeOAuth).filter(
        IdentidadeOAuth.provedor == provedor,
        IdentidadeOAuth.provedor_id == perfil["provedor_id"],
    ).first()
    if ident:
        usuario = db.query(Usuario).filter(Usuario.id == ident.usuario_id).first()
        if not usuario or not usuario.ativo:
            raise HTTPException(403, "Conta vinculada indisponível.")
        return usuario

    # (b) Sem vínculo ainda. Se o provedor confirmou o e-mail e existe uma
    #     conta com esse e-mail, ligamos as duas (login que "adota" a conta
    #     de senha). Vale para login E registro — se já há conta, não duplica.
    if perfil["email"] and perfil["email_ok"]:
        dono = db.query(Usuario).filter(Usuario.email == perfil["email"]).first()
        if dono:
            if not dono.ativo:
                raise HTTPException(403, "Conta vinculada indisponível.")
            _vincular(db, dono, provedor, perfil)
            db.commit()
            db.refresh(dono)
            return dono

    # (c) Nada casou. No login puro, não criamos conta às escondidas.
    if modo != "registro":
        raise HTTPException(400,
            "Nenhuma conta encontrada para este perfil. "
            "Use um convite para se registrar primeiro.")

    # (d) Registro: convite obrigatório (revalidado na volta do provedor).
    convite = validar_convite(db, codigo or "")
    login = _login_unico(db, perfil["sugestao_login"] or perfil["nome"])
    email = perfil["email"] if perfil["email_ok"] else None

    novo, _ = criar_conta(
        db, nome=perfil["nome"], login=login, email=email,
        convite=convite, senha=None, avatar_url=perfil.get("avatar"),
        origem=provedor,
    )
    _vincular(db, novo, provedor, perfil)
    db.commit()
    db.refresh(novo)
    return novo


def _vincular(db: Session, usuario: Usuario, provedor: str, perfil: dict) -> None:
    """Cria o elo (provedor, provedor_id) → usuário. Não faz commit."""
    db.add(IdentidadeOAuth(
        usuario_id=usuario.id,
        provedor=provedor,
        provedor_id=perfil["provedor_id"],
        email=perfil["email"],
        criado_em=datetime.utcnow(),
    ))
