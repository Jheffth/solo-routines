import re
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from typing import Optional
from database import get_db, Usuario, Convite, Conquista, ConquistaUsuario
from auth.service import (
    autenticar_usuario, criar_token, decodificar_token,
    registrar_log, hash_senha, ErroDeBanco
)

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    usuario: dict


class RegistroRequest(BaseModel):
    nome:   str
    login:  str
    senha:  str
    email:  Optional[str] = None
    codigo: str                      # convite obrigatório — cadastro é fechado

    @field_validator("nome")
    @classmethod
    def _nome(cls, v):
        v = (v or "").strip()
        if len(v) < 2:   raise ValueError("O nome precisa de ao menos 2 caracteres")
        if len(v) > 100: raise ValueError("Nome muito longo")
        return v

    @field_validator("login")
    @classmethod
    def _login(cls, v):
        v = (v or "").strip()
        if not re.fullmatch(r"[A-Za-z0-9._-]{3,30}", v):
            raise ValueError("Login: 3 a 30 caracteres, apenas letras, números, ponto, hífen ou _")
        return v

    @field_validator("senha")
    @classmethod
    def _senha(cls, v):
        if len(v or "") < 6:  raise ValueError("A senha precisa de ao menos 6 caracteres")
        if len(v) > 128:      raise ValueError("Senha muito longa")
        return v

    @field_validator("email")
    @classmethod
    def _email(cls, v):
        if not v:
            return None
        v = v.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[A-Za-z]{2,}", v):
            raise ValueError("E-mail inválido")
        return v

    @field_validator("codigo")
    @classmethod
    def _codigo(cls, v):
        v = (v or "").strip().upper()
        if not v: raise ValueError("Código de convite obrigatório")
        return v


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
    try:
        usuario = autenticar_usuario(db, form_data.username, form_data.password)
    except ErroDeBanco as e:
        # Falha de infraestrutura não pode se disfarçar de senha errada
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Falha no banco de dados — o Sistema não conseguiu validar seu acesso. "
                   "Verifique os logs do servidor (possível schema desatualizado).",
        )
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
    """Cadastro fechado: exige um convite válido do Arquiteto."""
    # 1. Convite
    convite = db.query(Convite).filter(Convite.codigo == payload.codigo).first()
    if not convite:
        raise HTTPException(400, "Código de convite inválido")
    if convite.revogado:
        raise HTTPException(400, "Este convite foi revogado")
    if convite.usado_por_id:
        raise HTTPException(400, "Este convite já foi utilizado")
    if convite.expira_em and datetime.utcnow() > convite.expira_em:
        raise HTTPException(400, "Este convite expirou")

    # 2. Unicidade
    if db.query(Usuario).filter(Usuario.login == payload.login).first():
        raise HTTPException(400, "Login já está em uso")
    if payload.email and db.query(Usuario).filter(Usuario.email == payload.email).first():
        raise HTTPException(400, "E-mail já cadastrado")

    # Nível de acesso definido no convite (User ou Admin) — nunca Arquiteto
    nivel = (getattr(convite, "nivel_acesso", "User") or "User").strip().capitalize()
    if nivel not in ("User", "Admin"):
        nivel = "User"

    novo = Usuario(
        nome=payload.nome,
        login=payload.login,
        email=payload.email,
        senha_hash=hash_senha(payload.senha),
        classe="E-Rank",
        titulo="O Mais Fraco",
        xp_total=0, xp_atual=0, nivel_atual=1, xp_proximo_nivel=100,
        moedas=50,
        nivel_acesso=nivel,
        ativo=True,
    )
    db.add(novo)
    db.flush()

    # 3. Queima o convite
    convite.usado_por_id = novo.id
    convite.usado_em = datetime.utcnow()

    # 4. Badges: "O Chamado" (sempre) + as presenteadas no convite
    codigos = ["chamado_arquiteto"]
    try:
        import json as _json
        codigos += _json.loads(convite.badges) if getattr(convite, "badges", None) else []
    except Exception:
        pass

    concedidas = []
    for q in db.query(Conquista).filter(Conquista.codigo.in_(codigos)).all():
        cu = ConquistaUsuario(usuario_id=novo.id, conquista_id=q.id,
                              desbloqueada_em=datetime.utcnow())
        # Pendente de cerimônia: o hunter será celebrado ao entrar,
        # em vez de encontrar as medalhas caladas no perfil.
        try:
            cu.celebrada = False
            cu.presenteada_por = convite.criado_por_id
        except Exception:
            pass
        db.add(cu)
        novo.xp_total = (novo.xp_total or 0) + (q.xp_bonus or 0)
        novo.xp_atual = (novo.xp_atual or 0) + (q.xp_bonus or 0)
        novo.moedas   = (novo.moedas or 0) + (q.moedas_bonus or 0)
        concedidas.append(q.titulo)

    # Nível derivado do XP das badges (passa pelo motor)
    try:
        from motors.gamificacao import recalcular_nivel
        recalcular_nivel(db, novo)
    except Exception:
        pass

    db.commit()
    db.refresh(novo)
    registrar_log(db, novo.login, "REGISTRO",
                  f"Novo hunter convocado: {novo.nome} · nível {nivel} · "
                  f"convite {convite.codigo} · badges: {', '.join(concedidas) or 'nenhuma'}")
    return {"ok": True, "msg": f"Hunter {novo.nome} convocado! Bem-vindo ao Sistema!",
            "badges": concedidas, "nivel_acesso": nivel}


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
