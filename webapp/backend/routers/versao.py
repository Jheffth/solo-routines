"""
O SELO DA VERSÃO — que commit está no ar, de verdade.

ESTE ENDPOINT MENTIA. Três vezes na mesma resposta:

  · `sha` sempre "unknown": rodava `git rev-parse` DENTRO do contêiner, onde
    não há `.git` nem o binário do git. E o `/root/app/` do Contabo nem
    sequer é um repositório git, então instalar o git não resolveria.

  · `versao` sempre "1.6.0": procurava o arquivo `VERSION` em `/VERSION`
    (quatro `parent` a partir de `/app/backend/routers/`), onde ele não
    está — nem poderia, porque o `VERSION` mora na RAIZ do repositório e o
    contexto de build é `webapp/`. Caía no fallback do config.py, que caía
    num literal cravado. O arquivo VERSION dizia 1.8.0; o rodapé, 1.6.0.

  · `ambiente` estava certo, mas o front traduzia "production" para
    "RENDER" — o nome do hospedeiro anterior. Corrigido em version.js.

O SEGUNDO ERRO ERA O PIOR, e a lição vale para além daqui: um fallback que
devolve um valor PLAUSÍVEL é pior do que um que explode. "unknown" e
"RENDER" saltavam aos olhos; "1.6.0" parecia certo e fazia o Arquiteto
jurar que tinha subido o que não tinha subido.

Por isso, aqui, nenhum caminho de erro inventa número. Se não houver selo,
a resposta diz que não há selo — em letras grandes, no rodapé.

A ORDEM DE LEITURA, da mais confiável para a menos:

  1. `build_info.json` — gravado por `scripts/selar_build.py` na máquina do
     Arquiteto, onde o git existe e o VERSION está ao alcance. Vive dentro
     de `backend/`, que o Dockerfile copia, e é versionado, porque o deploy
     move só o que está em `git ls-files`.
  2. Variáveis de ambiente `APP_VERSAO` / `APP_SHA` — a porta para um CI
     futuro passar os valores como build-arg, sem tocar em arquivo.
  3. O git local — só serve na máquina de desenvolvimento, e é exatamente
     por isso que o bug passou despercebido: aqui funcionava.
"""
from fastapi import APIRouter
from datetime import datetime, timezone
import json
import os
import pathlib
import subprocess

router = APIRouter(prefix="/api/versao", tags=["sistema"])

# `/app/backend/` no contêiner, `webapp/backend/` na máquina do Arquiteto.
_BACKEND = pathlib.Path(__file__).resolve().parent.parent
_SELO = _BACKEND / "build_info.json"

# Quando não se sabe, diz-se que não se sabe. Não se chuta um número redondo.
_SEM_VERSAO = "sem selo"
_SEM_SHA = "sem selo"


def _ler_selo() -> dict:
    try:
        dados = json.loads(_SELO.read_text(encoding="utf-8"))
        return dados if isinstance(dados, dict) else {}
    except Exception:
        return {}


def _git_sha_local() -> str:
    """Só responde na máquina de desenvolvimento. No servidor não há git."""
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            stderr=subprocess.DEVNULL,
            cwd=_BACKEND.parent.parent,
        ).decode().strip()
    except Exception:
        return ""


def _versao_do_arquivo() -> str:
    """O VERSION da raiz — existe em dev, não existe dentro da imagem."""
    try:
        arq = _BACKEND.parent.parent / "VERSION"
        if arq.exists():
            return arq.read_text(encoding="utf-8").strip()
    except Exception:
        pass
    return ""


@router.get("/", summary="Versão do servidor")
def versao():
    selo = _ler_selo()

    versao_txt = (
        selo.get("versao")
        or os.getenv("APP_VERSAO", "").strip()
        or _versao_do_arquivo()
        or _SEM_VERSAO
    )
    sha = (
        selo.get("sha")
        or os.getenv("APP_SHA", "").strip()
        or _git_sha_local()
        or _SEM_SHA
    )

    # "sem-selo" é o que o build_info.json de partida traz: o arquivo existe,
    # mas `selar_build.py` nunca rodou. Normalizado para a mesma frase do
    # ausente total, senão o rodapé mostraria "#sem-selo" como se fosse hash.
    if sha in ("sem-selo", "unknown", "sem-git"):
        sha = _SEM_SHA

    ambiente = os.getenv("AMBIENTE", "dev")

    return {
        "versao": versao_txt,
        "sha": sha,
        "selado": bool(selo.get("selado_em")),
        "sujo": bool(selo.get("sujo")),
        "ramo": selo.get("ramo") or "?",
        "ambiente": ambiente,
        # De onde o app está servindo. O `ambiente` diz o REGIME (produção ou
        # desenvolvimento); isto diz a CASA. Eram a mesma coisa quando só
        # existia um hospedeiro — e foi por confundir os dois que o rodapé
        # passou meses anunciando "RENDER" de dentro do Contabo.
        "hospedeiro": os.getenv("HOSPEDEIRO", "").strip(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
