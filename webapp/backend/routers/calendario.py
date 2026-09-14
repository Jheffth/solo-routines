# -*- coding: utf-8 -*-
"""
A AGENDA DO HUNTER — conectar, conferir e desconectar.

ESTE ROUTER NÃO SE PARECE COM `auth/oauth.py`, E O MOTIVO IMPORTA

Lá, o callback do Google TERMINA em login: ninguém estava autenticado
quando o fluxo começou, e o token do Solo é o prêmio no fim. Aqui é o
contrário — o hunter JÁ ESTÁ dentro do Solo e está autorizando o app a
escrever na agenda dele. O fluxo não cria sessão; ele amarra uma conta a
uma sessão que já existe.

Isso produz uma dificuldade concreta: o Google chama o callback com um
GET de navegador, sem o `Authorization` do Solo junto. Não dá para saber
quem voltou lendo o cabeçalho. A resposta é guardar o `usuario_id` no
`state` — ele já é único, de uso único, com validade curta, e nunca
trafega numa URL pública onde outro site pudesse lê-lo.

CALLBACK PRÓPRIO, MAS SEM URI NOVO. O `redirect_uri` cadastrado no
console é o do login (`/api/auth/oauth/google/callback`). Criar um
segundo exigiria mexer no Google Cloud e esperar propagar — então este
fluxo reaproveita aquele endereço e se distingue pelo `modo` guardado no
`state`, que é exatamente para isso que ele existe.
"""
import secrets
import time
from datetime import datetime, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

import config
from auth.router import get_usuario_atual
from database import get_db, Usuario, ContaCalendario, EventoCalendario
from motors import calendario as motor, calendario_sinc as sinc, cofre

router = APIRouter(prefix="/calendario", tags=["calendario"])

# O MESMO endereço do login — ver o cabeçalho deste arquivo.
def _redirect_uri() -> str:
    return f"{config.OAUTH_REDIRECT_BASE}/api/auth/oauth/google/callback"


# ── Guarda de estado ──────────────────────────────────────────────────
# Mesma ideia do `_ESTADOS` de `auth/oauth.py`: memória, uso único, TTL
# curto. O fluxo dura segundos; reinício do servidor no meio dele custa
# um clique a mais, e não vale um registro no banco.
_ESTADOS: dict[str, dict] = {}
_TTL = 600


def _limpar():
    agora = time.time()
    for s in [k for k, v in _ESTADOS.items() if agora - v["criado"] > _TTL]:
        _ESTADOS.pop(s, None)


def guardar_estado(usuario_id: int) -> str:
    _limpar()
    s = secrets.token_urlsafe(24)
    _ESTADOS[s] = {"usuario_id": usuario_id, "criado": time.time()}
    return s


def consumir_estado(state: str) -> Optional[dict]:
    _limpar()
    return _ESTADOS.pop(state, None)


def _conta(db: Session, usuario: Usuario) -> Optional[ContaCalendario]:
    return db.query(ContaCalendario).filter(
        ContaCalendario.usuario_id == usuario.id,
        ContaCalendario.provedor == "google",
    ).first()


# ══════════════════════════════════════════════════════════════════════
# ESTADO
# ══════════════════════════════════════════════════════════════════════
@router.get("/status")
def status(db: Session = Depends(get_db),
           usuario: Usuario = Depends(get_usuario_atual)):
    """O que a tela precisa saber antes de oferecer o botão."""
    c = _conta(db, usuario)
    pronto = bool(config.oauth_configurado("google")) and cofre.disponivel()
    return {
        # `disponivel` é sobre o SERVIDOR, não sobre o hunter. Sem chave de
        # cifra, oferecer o botão seria convidar alguém a entregar um
        # refresh token que não teríamos onde guardar com segurança.
        "disponivel": pronto,
        "motivo": None if pronto else (
            "Login do Google não configurado."
            if not config.oauth_configurado("google")
            else "CALENDARIO_CHAVE ausente no servidor."
        ),
        "conectado":   bool(c and c.ativo),
        "email":       c.email if c else None,
        "agenda":      bool(c and c.calendario_id),
        "conectado_em": c.conectado_em.isoformat() if c and c.conectado_em else None,
        "ultima_sync": c.ultima_sync.isoformat() if c and c.ultima_sync else None,
        # O ERRO APARECE. Integração que falha calada é pior que integração
        # que não existe: o hunter para de receber aviso e nunca sabe por quê.
        "ultimo_erro": c.ultimo_erro if c else None,
        "preferencias": {
            "dungeons": bool(c.sinc_dungeons) if c else True,
            "rotinas":  bool(c.sinc_rotinas) if c else True,
            "tarefas":  bool(c.sinc_tarefas) if c else True,
            "pactos":   bool(c.sinc_pactos) if c else True,
            "aviso_min": int(c.aviso_min or 30) if c else 30,
        },
    }


# ══════════════════════════════════════════════════════════════════════
# CONECTAR
# ══════════════════════════════════════════════════════════════════════
@router.post("/conectar")
def conectar(db: Session = Depends(get_db),
             usuario: Usuario = Depends(get_usuario_atual)):
    """
    Devolve a URL de consentimento. NÃO redireciona.

    Redirecionar aqui não funcionaria: a chamada sai por `fetch`, com o
    token do Solo no cabeçalho, e o navegador seguiria o 302 por baixo dos
    panos em vez de levar o hunter ao Google. Quem navega é o front.
    """
    if not config.oauth_configurado("google"):
        raise HTTPException(400, "Login do Google não está configurado no servidor.")
    if not cofre.disponivel():
        raise HTTPException(
            400, "O servidor não tem CALENDARIO_CHAVE configurada — sem ela "
                 "seu acesso ficaria guardado sem cifra, e isso não é aceitável.")
    return {"url": motor.url_de_consentimento(
        guardar_estado(usuario.id), _redirect_uri())}


def concluir_conexao(db: Session, usuario_id: int, code: str) -> None:
    """
    O miolo do callback. Vive aqui, e não em `auth/oauth.py`, para que
    aquele arquivo continue sendo só sobre identidade.
    """
    dados = motor.trocar_codigo(code, _redirect_uri())

    email = None
    try:
        with httpx.Client(timeout=10) as cli:
            r = cli.get("https://www.googleapis.com/oauth2/v3/userinfo",
                        headers={"Authorization": f"Bearer {dados['access_token']}"})
            if r.status_code == 200:
                email = (r.json().get("email") or "").strip().lower() or None
    except Exception:
        # Só serve para mostrar "conectado como fulano@". Falhar aqui não
        # pode custar a conexão inteira.
        pass

    c = db.query(ContaCalendario).filter(
        ContaCalendario.usuario_id == usuario_id,
        ContaCalendario.provedor == "google").first()
    if not c:
        c = ContaCalendario(usuario_id=usuario_id, provedor="google")
        db.add(c)

    c.refresh_cif = cofre.guardar(dados["refresh_token"])
    c.access_cif = cofre.guardar(dados.get("access_token"))
    c.expira_em = datetime.utcnow() + timedelta(seconds=int(dados.get("expires_in", 3600)))
    c.escopos = dados.get("scope")
    c.email = email
    c.ativo = True
    c.conectado_em = datetime.utcnow()
    c.ultimo_erro = None
    db.commit()
    db.refresh(c)

    # A agenda nasce agora, não na primeira sincronia: é o que faz o hunter
    # VER que funcionou, em vez de ter de acreditar.
    #
    # MAS FALHAR AQUI NÃO DESFAZ A CONEXÃO. O caro já aconteceu — o hunter
    # passou pela tela do Google e o refresh token está guardado. Se o
    # Calendar estiver fora do ar neste segundo, mandá-lo repetir tudo
    # seria cobrar de novo por um passo que deu certo. O erro fica
    # registrado, aparece na tela, e o botão "Testar conexão" refaz só
    # esta parte.
    try:
        motor.garantir_agenda(db, c)
        # E JÁ NASCE COM CONTEÚDO. Uma agenda vazia depois de todo o
        # trajeto do consentimento parece que não funcionou — e o hunter
        # não tem como saber que faltava um segundo passo que ninguém
        # pediu. `reconciliar=True` porque pode ser uma RE-conexão, e aí
        # os eventos antigos ainda estão lá esperando ser reencontrados.
        sinc.sincronizar(db, c, reconciliar=True)
    except motor.ErroCalendario as e:
        c.ultimo_erro = f"Conectado, mas a primeira sincronia falhou: {e}"
        db.commit()


# ══════════════════════════════════════════════════════════════════════
# DESCONECTAR
# ══════════════════════════════════════════════════════════════════════
@router.post("/desconectar")
def desconectar(db: Session = Depends(get_db),
                usuario: Usuario = Depends(get_usuario_atual)):
    """
    Desliga de verdade: revoga no Google E apaga o segredo daqui.

    A ORDEM É PROPOSITAL. Revogar primeiro, apagar depois — se apagássemos
    antes e a revogação falhasse, o Solo teria perdido o token sem ter
    desfeito a permissão, e ela ficaria viva na conta do hunter sem
    ninguém capaz de retirá-la pelo app.

    A AGENDA NÃO É APAGADA. Ela é do hunter, e apagá-la levaria junto o
    histórico que ele talvez queira manter. Desconectar é parar de
    escrever, não varrer o passado.
    """
    c = _conta(db, usuario)
    if not c:
        return {"ok": True, "ja_estava": True}

    revogado = False
    alvo = cofre.abrir(c.refresh_cif) or cofre.abrir(c.access_cif)
    if alvo:
        revogado = motor.revogar(alvo)

    db.query(EventoCalendario).filter(EventoCalendario.conta_id == c.id).delete()
    c.refresh_cif = None
    c.access_cif = None
    c.expira_em = None
    c.ativo = False
    c.ultimo_erro = None
    db.commit()

    return {
        "ok": True,
        "revogado": revogado,
        # Honestidade: se a revogação falhou, o hunter precisa saber que
        # ainda há uma permissão pendurada na conta Google dele.
        "aviso": None if revogado else
            "Desliguei aqui, mas não consegui revogar no Google. "
            "Remova em myaccount.google.com/permissions.",
    }


# ══════════════════════════════════════════════════════════════════════
# PREFERÊNCIAS
# ══════════════════════════════════════════════════════════════════════
class Preferencias(BaseModel):
    dungeons: Optional[bool] = None
    rotinas:  Optional[bool] = None
    tarefas:  Optional[bool] = None
    pactos:   Optional[bool] = None
    aviso_min: Optional[int] = None


@router.put("/preferencias")
def preferencias(p: Preferencias,
                 db: Session = Depends(get_db),
                 usuario: Usuario = Depends(get_usuario_atual)):
    c = _conta(db, usuario)
    if not c:
        raise HTTPException(400, "Conecte sua agenda primeiro.")

    if p.dungeons is not None: c.sinc_dungeons = bool(p.dungeons)
    if p.rotinas  is not None: c.sinc_rotinas  = bool(p.rotinas)
    if p.tarefas  is not None: c.sinc_tarefas  = bool(p.tarefas)
    if p.pactos   is not None: c.sinc_pactos   = bool(p.pactos)
    if p.aviso_min is not None:
        # O Calendar aceita até 4 semanas de antecedência (40320 min). Piso
        # em zero: "no horário" é um aviso legítimo.
        c.aviso_min = max(0, min(40320, int(p.aviso_min)))
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════
# DIAGNÓSTICO
# ══════════════════════════════════════════════════════════════════════
@router.post("/sincronizar")
def sincronizar(db: Session = Depends(get_db),
                usuario: Usuario = Depends(get_usuario_atual)):
    """
    Põe a agenda em dia, agora.

    É SÍNCRONO, e isso é uma escolha com prazo de validade. Com dezenas de
    missões a chamada leva alguns segundos — aceitável quando o hunter
    clicou no botão e está esperando. Com centenas, isto vira trabalho de
    fila; a hora de mudar é quando a espera incomodar, não antes.
    """
    c = _conta(db, usuario)
    if not c or not c.ativo:
        raise HTTPException(400, "Nenhuma agenda conectada.")
    try:
        return {"ok": True, **sinc.sincronizar(db, c)}
    except motor.ErroCalendario as e:
        c.ultimo_erro = str(e)
        db.commit()
        raise HTTPException(400, str(e))


@router.post("/testar")
def testar(db: Session = Depends(get_db),
           usuario: Usuario = Depends(get_usuario_atual)):
    """
    Renova o acesso e confere a agenda, agora.

    É o botão que prova a Fase 1: conectar, esperar mais de uma hora e
    clicar aqui exercita o caminho do refresh — o único que separa uma
    conexão de verdade de um token de uma hora que vai morrer calado.
    """
    c = _conta(db, usuario)
    if not c or not c.ativo:
        raise HTTPException(400, "Nenhuma agenda conectada.")
    try:
        cid = motor.garantir_agenda(db, c)
        c.ultima_sync = datetime.utcnow()
        c.ultimo_erro = None
        db.commit()
        return {"ok": True, "agenda": cid,
                "expira_em": c.expira_em.isoformat() if c.expira_em else None}
    except motor.ErroCalendario as e:
        c.ultimo_erro = str(e)
        db.commit()
        raise HTTPException(400, str(e))
