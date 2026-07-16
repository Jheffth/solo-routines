from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import Usuario, LogAuditoria
from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_senha(senha: str) -> str:
    return pwd_context.hash(senha)


def verificar_senha(senha: str, hash: str) -> bool:
    return pwd_context.verify(senha, hash)


def autenticar_usuario(db: Session, login: str, senha: str):
    usuario = db.query(Usuario).filter(
        Usuario.login == login, Usuario.ativo == True
    ).first()
    if not usuario:
        return None
    if not verificar_senha(senha, usuario.senha_hash):
        return None
    usuario.ultimo_acesso = datetime.utcnow()
    db.commit()
    return usuario


def criar_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decodificar_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


def registrar_log(db: Session, usuario: str, acao: str, detalhes: str = None, ip: str = None):
    log = LogAuditoria(usuario=usuario, acao=acao, detalhes=detalhes, ip=ip)
    db.add(log)
    db.commit()
