import os
from dotenv import load_dotenv

load_dotenv()

# ── Chave de assinatura dos tokens ────────────────────────────────
# NUNCA usar valor fixo no código: quem vê o repositório forja tokens
# de qualquer usuário (inclusive o Arquiteto). Em produção é obrigatória.
SECRET_KEY = os.getenv("SECRET_KEY", "").strip()
if not SECRET_KEY:
    _AMBIENTE = os.getenv("AMBIENTE", "dev").lower()
    if _AMBIENTE in ("prod", "producao", "production"):
        raise RuntimeError(
            "SECRET_KEY não definida! Configure a variável de ambiente antes de subir em produção."
        )
    # Desenvolvimento: gera uma chave efêmera (derruba as sessões a cada boot — é o esperado)
    import secrets as _secrets
    SECRET_KEY = _secrets.token_urlsafe(48)
    print("[CONFIG] ⚠ SECRET_KEY ausente — usando chave temporária de desenvolvimento.")
    print("[CONFIG]   Defina SECRET_KEY no .env para manter as sessões entre reinícios.")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24h

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./solo_rotinas.db")
# Railway fornece postgres:// mas SQLAlchemy 2.x exige postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

APP_NAME = os.getenv("APP_NAME", "Solo Routines")
APP_VERSION = "1.0.0"

# ── Bot Telegram ──────────────────────────────────
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID   = os.getenv("TELEGRAM_CHAT_ID", "")
TELEGRAM_SECRET    = os.getenv("TELEGRAM_SECRET", "solorotinas-webhook-secret")
