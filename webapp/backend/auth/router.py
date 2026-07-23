import re
from datetime import datetime, timedelta
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
    _marcar_presenca(db, usuario)
    return usuario


# Quanto tempo esperar antes de regravar a presença. Sem esta folga
# escreveríamos no banco a CADA requisição autenticada — dezenas de writes
# por minuto por hunter, só para mover um relógio alguns segundos.
JANELA_PRESENCA = timedelta(minutes=3)


def _marcar_presenca(db: Session, usuario: Usuario) -> None:
    """
    Mantém `ultimo_acesso` fiel à realidade.

    Antes ele só era gravado no login. Como o token dura horas, quem passava
    o dia dentro do app aparecia como "visto há 8 horas" enquanto estava
    online naquele instante — o recurso mentiria justamente sobre quem mais
    usa o Sistema.

    Nunca deixa a requisição quebrar por causa disto: presença é cortesia,
    não pode derrubar uma chamada legítima.
    """
    agora = datetime.utcnow()
    anterior = usuario.ultimo_acesso
    if anterior and (agora - anterior) < JANELA_PRESENCA:
        return
    try:
        usuario.ultimo_acesso = agora
        db.commit()
    except Exception:
        db.rollback()


# Hierarquia: Arquiteto > Criador > Admin > Moderador > Suporte > User
# Todos os níveis acima de User têm acesso mínimo ao painel gerencial.
NIVEIS_ADMIN    = ("Suporte", "Moderador", "Admin", "Criador", "Arquiteto")
NIVEIS_MODERACAO = ("Moderador", "Admin", "Criador", "Arquiteto")   # moderam conteúdo social
NIVEIS_GESTAO   = ("Admin", "Criador", "Arquiteto")                 # painel completo
NIVEL_ARQUITETO = "Arquiteto"


def get_admin(usuario: Usuario = Depends(get_usuario_atual)) -> Usuario:
    """Suporte, Moderador, Admin, Criador e Arquiteto têm acesso ao painel."""
    if usuario.nivel_acesso not in NIVEIS_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a administradores")
    return usuario


def get_moderador(usuario: Usuario = Depends(get_usuario_atual)) -> Usuario:
    """Moderador ou acima — moderam chat, amizades e reportes."""
    if usuario.nivel_acesso not in NIVEIS_MODERACAO:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a moderadores")
    return usuario


def get_gestor(usuario: Usuario = Depends(get_usuario_atual)) -> Usuario:
    """Admin, Criador ou Arquiteto — gestão plena de missões e dungeons."""
    if usuario.nivel_acesso not in NIVEIS_GESTAO:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a gestores")
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
    """Cadastro fechado por SENHA: exige um convite válido do Arquiteto.
       A regra de convite/badges mora em registro_core (compartilhada com o
       registro via Google/Discord)."""
    from auth.registro_core import validar_convite, criar_conta

    convite = validar_convite(db, payload.codigo)

    # Unicidade (o login vem do formulário; no OAuth ele é derivado do perfil)
    if db.query(Usuario).filter(Usuario.login == payload.login).first():
        raise HTTPException(400, "Login já está em uso")
    if payload.email and db.query(Usuario).filter(Usuario.email == payload.email).first():
        raise HTTPException(400, "E-mail já cadastrado")

    novo, concedidas = criar_conta(
        db, nome=payload.nome, login=payload.login, email=payload.email,
        convite=convite, senha=payload.senha, origem="senha",
    )
    db.commit()
    db.refresh(novo)
    return {"ok": True, "msg": f"Hunter {novo.nome} convocado! Bem-vindo ao Sistema!",
            "badges": concedidas, "nivel_acesso": novo.nivel_acesso}


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
        "aura_id": getattr(usuario, "aura_id", None),
    }
