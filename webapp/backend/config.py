import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "solo-routines-secret-key-2026-change-in-production")
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
