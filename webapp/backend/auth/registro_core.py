# -*- coding: utf-8 -*-
"""
Núcleo do registro — compartilhado entre o cadastro por senha e o OAuth.

Extraído para que a regra do Sistema (convite obrigatório, queima do convite,
badges com cerimônia pendente, nível derivado do XP) exista em UM lugar só.
Login/senha e "entrar com Google/Discord" chamam a mesma função — se a regra
de convite mudar, muda aqui e vale para os dois caminhos.
"""
import json
import secrets
from datetime import datetime
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from database import Usuario, Convite, Conquista, ConquistaUsuario
from auth.service import hash_senha, registrar_log


def validar_convite(db: Session, codigo: str) -> Convite:
    """Confere o convite ou levanta HTTPException 400 com o motivo exato."""
    convite = db.query(Convite).filter(Convite.codigo == (codigo or "").strip()).first()
    if not convite:
        raise HTTPException(400, "Código de convite inválido")
    if convite.revogado:
        raise HTTPException(400, "Este convite foi revogado")
    if convite.usado_por_id:
        raise HTTPException(400, "Este convite já foi utilizado")
    if convite.expira_em and datetime.utcnow() > convite.expira_em:
        raise HTTPException(400, "Este convite expirou")
    return convite


def _login_unico(db: Session, base: str) -> str:
    """
    Garante um nick único a partir de uma sugestão (ex.: prefixo do e-mail).
    'jefferson' → 'jefferson', 'jefferson2', ... até achar um livre.
    """
    base = "".join(c for c in (base or "").lower() if c.isalnum() or c in "._-")[:24] or "hunter"
    login = base
    n = 1
    while db.query(Usuario).filter(Usuario.login == login).first():
        n += 1
        login = f"{base}{n}"
    return login


def criar_conta(
    db: Session,
    *,
    nome: str,
    login: str,
    email: Optional[str],
    convite: Convite,
    senha: Optional[str] = None,
    avatar_url: Optional[str] = None,
    origem: str = "senha",
) -> tuple[Usuario, list[str]]:
    """
    Cria a conta a partir de um convite JÁ VALIDADO. Reúne a regra inteira:
    nível do convite (nunca Arquiteto), queima do convite, badges com
    cerimônia pendente, nível derivado do XP. Não faz commit — o chamador
    decide (para poder amarrar identidade OAuth na mesma transação).

    `senha=None` (caso OAuth): grava um hash aleatório inútil, então login por
    senha fica impossível para essa conta, sem precisar tornar a coluna
    anulável (migração arriscada em Postgres).
    """
    nivel = (getattr(convite, "nivel_acesso", "User") or "User").strip().capitalize()
    if nivel not in ("User", "Admin"):
        nivel = "User"

    senha_hash = hash_senha(senha) if senha else hash_senha(secrets.token_urlsafe(32))

    novo = Usuario(
        nome=nome,
        login=login,
        email=email,
        senha_hash=senha_hash,
        avatar_url=avatar_url,
        classe="E-Rank",
        titulo="O Mais Fraco",
        xp_total=0, xp_atual=0, nivel_atual=1, xp_proximo_nivel=100,
        moedas=50,
        nivel_acesso=nivel,
        ativo=True,
    )
    db.add(novo)
    db.flush()

    # Queima o convite
    convite.usado_por_id = novo.id
    convite.usado_em = datetime.utcnow()

    # Badges: "O Chamado" (sempre) + as presenteadas no convite
    codigos = ["chamado_arquiteto"]
    try:
        codigos += json.loads(convite.badges) if getattr(convite, "badges", None) else []
    except Exception:
        pass

    concedidas = []
    for q in db.query(Conquista).filter(Conquista.codigo.in_(codigos)).all():
        cu = ConquistaUsuario(usuario_id=novo.id, conquista_id=q.id,
                              desbloqueada_em=datetime.utcnow())
        try:
            cu.celebrada = False               # cerimônia dispara no 1º login
            cu.presenteada_por = convite.criado_por_id
        except Exception:
            pass
        db.add(cu)
        novo.xp_total = (novo.xp_total or 0) + (q.xp_bonus or 0)
        novo.xp_atual = (novo.xp_atual or 0) + (q.xp_bonus or 0)
        novo.moedas   = (novo.moedas or 0) + (q.moedas_bonus or 0)
        concedidas.append(q.titulo)

    try:
        from motors.gamificacao import recalcular_nivel
        recalcular_nivel(db, novo)
    except Exception:
        pass

    registrar_log(db, novo.login, "REGISTRO",
                  f"Novo hunter convocado ({origem}): {novo.nome} · nível {nivel} · "
                  f"convite {convite.codigo} · badges: {', '.join(concedidas) or 'nenhuma'}")
    return novo, concedidas
