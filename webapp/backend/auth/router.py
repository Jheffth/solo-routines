from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db, Usuario
from auth.service import (
    autenticar_usuario, criar_token, decodificar_token,
    registrar_log, hash_senha
)

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    usuario: dict


class RegistroRequest(BaseModel):
    nome: str
    login: str
    senha: str


def get_usuario_atual(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Usuario:
    payload = decodificar_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    login = payload.get("sub")
    usuario = db.query(Usuario).filter(Usuario.login == login, Usuario.ativo == True).first()
    if not usuario:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado")
    return usuario


# Hierarquia: Arquiteto > Criador > Admin > User
NIVEIS_ADMIN = ("Admin", "Criador", "Arquiteto")
NIVEL_ARQUITETO = "Arquiteto"


def get_admin(usuario: Usuario = Depends(get_usuario_atual)) -> Usuario:
    if usuario.nivel_acesso not in NIVEIS_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a administradores")
    return usuario


def get_arquiteto(usuario: Usuario = Depends(get_usuario_atual)) -> Usuario:
    """Apenas o Arquiteto pode acessar — nível supremo inviolável."""
    if usuario.nivel_acesso != NIVEL_ARQUITETO:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito ao Arquiteto")
    return usuario


@router.post("/login", response_model=TokenResponse)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    usuario = autenticar_usuario(db, form_data.username, form_data.password)
    if not usuario:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login ou senha incorretos")

    token = criar_token({"sub": usuario.login, "nivel_acesso": usuario.nivel_acesso})
    registrar_log(db, usuario.login, "LOGIN", "Login bem-sucedido",
                  ip=request.client.host if request.client else None)

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        usuario={
            "id": usuario.id,
            "nome": usuario.nome,
            "login": usuario.login,
            "avatar_url": usuario.avatar_url,
            "classe": usuario.classe,
            "titulo": usuario.titulo,
            "xp_total": usuario.xp_total,
            "xp_atual": usuario.xp_atual,
            "nivel_atual": usuario.nivel_atual,
            "xp_proximo_nivel": usuario.xp_proximo_nivel,
            "moedas": usuario.moedas,
            "streak_atual": usuario.streak_atual,
            "streak_max": usuario.streak_max,
            "nivel_acesso": usuario.nivel_acesso,
        }
    )


@router.post("/registro")
def registro(payload: RegistroRequest, db: Session = Depends(get_db)):
    existe = db.query(Usuario).filter(Usuario.login == payload.login).first()
    if existe:
        raise HTTPException(status_code=400, detail="Login já está em uso")

    novo = Usuario(
        nome=payload.nome,
        login=payload.login,
        senha_hash=hash_senha(payload.senha),
        classe="E-Rank",
        titulo="O Mais Fraco",
        xp_total=0,
        xp_atual=0,
        nivel_atual=1,
        xp_proximo_nivel=100,
        moedas=50,
        nivel_acesso="User",
        ativo=True,
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)
    registrar_log(db, novo.login, "REGISTRO", f"Novo usuário criado: {novo.nome}")
    return {"ok": True, "msg": f"Hunter {novo.nome} registrado! Bem-vindo ao Sistema!"}


@router.get("/me")
def me(usuario: Usuario = Depends(get_usuario_atual)):
    return {
        "id": usuario.id,
        "nome": usuario.nome,
        "login": usuario.login,
        "avatar_url": usuario.avatar_url,
        "classe": usuario.classe,
        "titulo": usuario.titulo,
        "xp_total": usuario.xp_total,
        "xp_atual": usuario.xp_atual,
        "nivel_atual": usuario.nivel_atual,
        "xp_proximo_nivel": usuario.xp_proximo_nivel,
        "moedas": usuario.moedas,
        "streak_atual": usuario.streak_atual,
        "streak_max": usuario.streak_max,
        "nivel_acesso": usuario.nivel_acesso,
        "criado_em": usuario.criado_em,
        "ultimo_acesso": usuario.ultimo_acesso,
    }
