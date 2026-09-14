# -*- coding: utf-8 -*-
"""
O MOTOR DA AGENDA — o que fala com o Google Calendar.

O QUE ESTA FASE RESOLVE, E O QUE ELA DELIBERADAMENTE NÃO FAZ

Aqui está só o ELO: pedir acesso de longo prazo, guardar o segredo,
renovar o acesso curto quando ele vence, criar a agenda do Solo e
desligar tudo quando o hunter pedir. Traduzir portão e rotina em evento
vem depois — e vem separado, porque tradução é regra de domínio e isto
aqui é encanamento.

AS TRÊS COISAS QUE O FLUXO DE LOGIN NÃO PRECISAVA E ESTE PRECISA

  1. `access_type="offline"`. O login usa `online` e recebe um acesso de
     uma hora, que é tudo que ele precisa — lê o e-mail e esquece. Para
     escrever na agenda amanhã é preciso REFRESH TOKEN, e ele só vem com
     `offline`.

  2. `prompt="consent"`. Sem isso o Google devolve refresh token na
     PRIMEIRA autorização e mais nunca. Quem reconectasse depois de um
     `desconectar` receberia `refresh_token: null` e o app guardaria
     silêncio no lugar do segredo — reconexão que parece funcionar e não
     funciona. É por isso que ele está aqui mesmo sendo uma tela a mais.

  3. `include_granted_scopes="true"`. O hunter já autorizou o app para
     entrar. Sem isto, autorizar a agenda faria o Google emitir um token
     SÓ com o escopo novo, e o consentimento anterior viraria pó.

O ESCOPO É `calendar.app.created` — só agendas criadas pelo próprio app.
O Solo é tecnicamente incapaz de ler os outros compromissos do hunter. E
foi essa escolha que fez o Google classificar o escopo como NÃO
CONFIDENCIAL: verificação dispensada, sem tela de "app não verificado",
sem teto de 100 usuários. A Central de verificação do projeto confirma
por escrito. Trocar por `calendar.events` reabriria tudo isso.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta

import httpx

import config
from motors import cofre

# ── Endereços do Google ───────────────────────────────────────────────
AUTORIZAR = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN     = "https://oauth2.googleapis.com/token"
REVOGAR   = "https://oauth2.googleapis.com/revoke"
API       = "https://www.googleapis.com/calendar/v3"

ESCOPO = "https://www.googleapis.com/auth/calendar.app.created"

# O fuso que o Calendar entende. `motors/tempo.py` trabalha com OFFSET
# FIXO (-3) e a API quer nome IANA — são coisas diferentes, e a diferença
# aparece no dia em que o horário de verão voltar: o offset fixo erraria
# uma hora e a agenda erraria junto. Nome IANA não tem esse problema
# porque quem sabe as regras é o Google.
FUSO = "America/Sao_Paulo"

NOME_AGENDA = "Solo Routines"
DESCRICAO_AGENDA = (
    "Missões, portões e prazos do Solo Routines. "
    "Criada pelo app — apagar esta agenda não apaga nada no Solo."
)


class ErroCalendario(RuntimeError):
    """Falha ao falar com o Google. A mensagem é para o hunter ler."""


# ══════════════════════════════════════════════════════════════════════
# AUTORIZAÇÃO
# ══════════════════════════════════════════════════════════════════════
def url_de_consentimento(state: str, redirect_uri: str) -> str:
    """Para onde mandar o hunter autorizar."""
    from urllib.parse import urlencode
    return AUTORIZAR + "?" + urlencode({
        "client_id":     config.GOOGLE_CLIENT_ID,
        "redirect_uri":  redirect_uri,
        "response_type": "code",
        "scope":         ESCOPO,
        "state":         state,
        "access_type":   "offline",   # sem isto, nao ha refresh token
        "prompt":        "consent",   # sem isto, reconectar volta sem token
        "include_granted_scopes": "true",
    })


def trocar_codigo(code: str, redirect_uri: str) -> dict:
    """
    `code` → tokens.

    Não usa `raise_for_status` cego: quando o Google recusa, ele EXPLICA no
    corpo (`redirect_uri_mismatch`, `invalid_client`, código expirado). É
    a mesma lição já aprendida em `auth/oauth.py`, e é o que salva o debug.
    """
    try:
        with httpx.Client(timeout=15) as cli:
            r = cli.post(TOKEN, data={
                "grant_type":    "authorization_code",
                "code":          code,
                "redirect_uri":  redirect_uri,
                "client_id":     config.GOOGLE_CLIENT_ID,
                "client_secret": config.GOOGLE_CLIENT_SECRET,
            }, headers={"Accept": "application/json"})
    except httpx.HTTPError as e:
        raise ErroCalendario(f"Falha de rede ao falar com o Google: {e!r}")

    if r.status_code != 200:
        print(f"[CALENDARIO] token HTTP {r.status_code} "
              f"(redirect_uri={redirect_uri}): {r.text[:400]}")
        raise ErroCalendario("O Google recusou a autorização.")

    dados = r.json()
    if not dados.get("refresh_token"):
        # Acontece quando `prompt=consent` não foi enviado e o hunter já
        # tinha autorizado antes. Sem refresh token a conexão morre em uma
        # hora — e morrer calado é o pior desfecho possível.
        print(f"[CALENDARIO] SEM refresh_token: {json.dumps(dados)[:300]}")
        raise ErroCalendario(
            "O Google não devolveu acesso de longo prazo. "
            "Remova o Solo Routines em myaccount.google.com/permissions "
            "e conecte de novo."
        )
    return dados


def renovar(refresh_token: str) -> dict:
    """Refresh token → access token novo."""
    try:
        with httpx.Client(timeout=15) as cli:
            r = cli.post(TOKEN, data={
                "grant_type":    "refresh_token",
                "refresh_token": refresh_token,
                "client_id":     config.GOOGLE_CLIENT_ID,
                "client_secret": config.GOOGLE_CLIENT_SECRET,
            }, headers={"Accept": "application/json"})
    except httpx.HTTPError as e:
        raise ErroCalendario(f"Falha de rede ao renovar o acesso: {e!r}")

    if r.status_code != 200:
        # `invalid_grant` aqui quer dizer que o refresh token morreu: o
        # hunter revogou o acesso na conta Google, ou trocou a senha. Não
        # é erro nosso e não adianta tentar de novo — a saída é reconectar.
        print(f"[CALENDARIO] refresh HTTP {r.status_code}: {r.text[:300]}")
        if "invalid_grant" in r.text:
            raise ErroCalendario(
                "O acesso à sua agenda foi revogado no Google. Reconecte.")
        raise ErroCalendario("Não consegui renovar o acesso à sua agenda.")
    return r.json()


def revogar(token: str) -> bool:
    """
    Desconectar DE VERDADE.

    Apagar a linha do banco faz o Solo esquecer o token, mas não faz o
    Google esquecer a autorização: ela continuaria listada em
    myaccount.google.com como permissão ativa. "Desconectado" que deixa
    permissão viva é mentira de interface.
    """
    try:
        with httpx.Client(timeout=10) as cli:
            r = cli.post(REVOGAR, data={"token": token},
                         headers={"Content-Type": "application/x-www-form-urlencoded"})
        return r.status_code == 200
    except httpx.HTTPError:
        return False


# ══════════════════════════════════════════════════════════════════════
# O ACESSO VIVO
# ══════════════════════════════════════════════════════════════════════
def acesso_valido(db, conta) -> str:
    """
    Um access token que funciona AGORA, renovando se preciso.

    A MARGEM DE 60 SEGUNDOS não é exagero. Sem ela, um token que expira
    "daqui a 3 segundos" passa no teste, viaja pela rede e chega expirado
    — e o erro que volta é um 401 genérico, que parece problema de escopo
    e manda a investigação para o lado errado.
    """
    if not getattr(conta, "ativo", False):
        raise ErroCalendario("Esta agenda está desconectada.")

    agora = datetime.utcnow()
    token = cofre.abrir(getattr(conta, "access_cif", None))
    venc = getattr(conta, "expira_em", None)
    if token and venc and venc > agora + timedelta(seconds=60):
        return token

    refresh = cofre.abrir(getattr(conta, "refresh_cif", None))
    if not refresh:
        # Cofre sem chave, chave trocada, ou conta gravada antes do cofre
        # existir. Todos dão no mesmo desfecho útil.
        raise ErroCalendario(
            "Não consegui ler o acesso guardado. Reconecte sua agenda.")

    dados = renovar(refresh)
    novo = dados.get("access_token")
    if not novo:
        raise ErroCalendario("O Google não devolveu um acesso novo.")

    conta.access_cif = cofre.guardar(novo)
    conta.expira_em = agora + timedelta(seconds=int(dados.get("expires_in", 3600)))
    conta.ultimo_erro = None
    db.commit()
    return novo


def _chamar(metodo: str, caminho: str, token: str, **kw) -> dict:
    try:
        with httpx.Client(timeout=20) as cli:
            r = cli.request(metodo, API + caminho,
                            headers={"Authorization": f"Bearer {token}"}, **kw)
    except httpx.HTTPError as e:
        raise ErroCalendario(f"Falha de rede com o Calendar: {e!r}")

    if r.status_code in (200, 201, 204):
        return r.json() if r.content else {}
    print(f"[CALENDARIO] {metodo} {caminho} HTTP {r.status_code}: {r.text[:300]}")
    if r.status_code in (401, 403):
        raise ErroCalendario("O Google recusou o acesso à agenda. Reconecte.")
    if r.status_code == 404:
        raise ErroCalendario("A agenda do Solo não existe mais.")
    raise ErroCalendario(f"O Calendar respondeu {r.status_code}.")


# ══════════════════════════════════════════════════════════════════════
# A AGENDA DEDICADA
# ══════════════════════════════════════════════════════════════════════
def garantir_agenda(db, conta) -> str:
    """
    O id da agenda "Solo Routines", criando-a se preciso.

    UMA AGENDA SEPARADA É ARQUITETURA, não organização. Ela resolve quatro
    coisas de uma vez: o hunter esconde a camada inteira com um clique no
    app do Google; apagá-la não apaga nada no Solo; o escopo
    `calendar.app.created` só enxerga o que o app criou, o que torna a
    privacidade uma garantia técnica e não uma promessa; e, no dia da
    guilda, calendário separado é compartilhável — a agenda principal não.
    """
    token = acesso_valido(db, conta)

    if conta.calendario_id:
        try:
            _chamar("GET", f"/calendars/{conta.calendario_id}", token)
            return conta.calendario_id
        except ErroCalendario:
            # Apagada pelo hunter. Recriar é o certo: o Solo continua sendo
            # a fonte da verdade, a agenda é só o espelho.
            print("[CALENDARIO] agenda sumiu; recriando")
            conta.calendario_id = None

    novo = _chamar("POST", "/calendars", token, json={
        "summary":     NOME_AGENDA,
        "description": DESCRICAO_AGENDA,
        "timeZone":    FUSO,
    })
    cid = novo.get("id")
    if not cid:
        raise ErroCalendario("O Google não devolveu a agenda criada.")

    conta.calendario_id = cid
    conta.ultimo_erro = None
    db.commit()
    return cid
