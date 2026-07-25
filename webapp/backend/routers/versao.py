"""
Endpoint de versão — retorna versão semântica, git SHA, ambiente e timestamp de build.
Usado pelo frontend para exibir no footer e comparar local vs Render.
"""
from fastapi import APIRouter
from datetime import datetime, timezone
import subprocess, os, pathlib

router = APIRouter(prefix="/api/versao", tags=["sistema"])

def _git_sha() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            stderr=subprocess.DEVNULL,
            cwd=pathlib.Path(__file__).parent.parent.parent.parent
        ).decode().strip()
    except Exception:
        return "unknown"

def _ler_versao() -> str:
    """Lê o arquivo VERSION na raiz do repositório."""
    raiz = pathlib.Path(__file__).parent.parent.parent.parent
    arq = raiz / "VERSION"
    if arq.exists():
        return arq.read_text(encoding="utf-8").strip()
    # fallback: config.py
    try:
        from config import APP_VERSION
        return APP_VERSION
    except Exception:
        return "0.0.0"

@router.get("/", summary="Versão do servidor")
def versao():
    """Retorna versão semântica, git SHA, ambiente e horário UTC da resposta."""
    return {
        "versao":    _ler_versao(),
        "sha":       _git_sha(),
        "ambiente":  os.getenv("AMBIENTE", "dev"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
