"""
SELAR O BUILD — grava no repositório o que o servidor não consegue descobrir.

POR QUE ISTO EXISTE

O rodapé prometia comparar "o que está na minha máquina" com "o que está no
servidor". Ele não cumpria nada disso, e por um motivo que só aparece quando
se olha o contêiner por dentro:

  1. `git rev-parse` rodava DENTRO do contêiner. Lá não existe a pasta `.git`
     (o Dockerfile copia só `backend/` e `frontend/`) nem o binário do git.
     Sempre caía no except: "unknown". E nem adiantaria instalar o git — o
     `/root/app/` do Contabo NÃO É um repositório git, está escrito no
     próprio SOLO_DEPLOY_CONFIG.md.

  2. O arquivo `VERSION` mora na raiz do repositório, que fica FORA do
     contexto de build (`build: .` aponta para `webapp/`). Nunca foi copiado
     para a imagem. A busca falhava, caía no fallback do config.py, e o
     fallback devolvia a string "1.6.0" cravada no código. O rodapé mostrava
     1.6.0 com o VERSION dizendo 1.8.0 — e mostraria 1.6.0 para sempre.

O erro nº 2 é o perigoso, porque ele não parece erro. "unknown" e "RENDER"
gritam; um número de versão plausível e errado passa despercebido e faz você
jurar que subiu o que não subiu.

A SOLUÇÃO: o que o servidor não sabe, a sua máquina escreve antes de enviar.

Este script grava `webapp/backend/build_info.json`. Esse caminho não é
acidental — é o único que satisfaz as duas restrições ao mesmo tempo:

  · está dentro de `backend/`, que o Dockerfile JÁ copia; e
  · é versionado, e o deploy usa `git ls-files` (está no .gitignore, linha 21),
    então só o que está no git viaja para o Contabo.

Um arquivo gerado e commitado incomoda um pouco no diff. É o preço de saber
com certeza qual commit está no ar — e é barato perto de uma semana
debugando um bug que já tinha sido corrigido e não tinha subido.

Uso:
    python scripts/selar_build.py

Rode antes do commit de deploy. Se esquecer, o selo fica velho e o rodapé
avisa — ele compara o SHA selado com o HEAD e mostra a diferença em vez de
fingir que está tudo em ordem.
"""
import json
import pathlib
import subprocess
import sys
from datetime import datetime, timezone

RAIZ = pathlib.Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "webapp" / "backend" / "build_info.json"


def _git(*args: str) -> str:
    """Um comando git na raiz do repositório, ou vazio se não der."""
    try:
        return subprocess.check_output(
            ["git", *args], cwd=RAIZ, stderr=subprocess.DEVNULL
        ).decode("utf-8", "replace").strip()
    except Exception:
        return ""


def _versao() -> str:
    arq = RAIZ / "VERSION"
    if not arq.exists():
        print("[SELO] ERRO: nao achei o arquivo VERSION na raiz.")
        sys.exit(1)
    v = arq.read_text(encoding="utf-8").strip()
    if not v:
        print("[SELO] ERRO: o arquivo VERSION esta vazio.")
        sys.exit(1)
    return v


def selar() -> dict:
    versao = _versao()
    sha = _git("rev-parse", "--short", "HEAD") or "sem-git"

    # Árvore suja = o que você está selando NÃO é o que está no commit.
    # Vale registrar: é a diferença entre "o servidor tem o commit abc123" e
    # "o servidor tem o commit abc123 mais coisas que ninguém viu".
    sujo = bool(_git("status", "--porcelain"))

    selo = {
        "versao": versao,
        "sha": sha,
        "ramo": _git("rev-parse", "--abbrev-ref", "HEAD") or "?",
        "sujo": sujo,
        "selado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text(
        json.dumps(selo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return selo


if __name__ == "__main__":
    s = selar()
    print(f"[SELO] v{s['versao']}  #{s['sha']}  ({s['ramo']})")
    if s["sujo"]:
        print("[SELO] AVISO: ha alteracoes nao commitadas. O SHA selado")
        print("[SELO] aponta para o commit anterior a elas.")
    print(f"[SELO] gravado em {DESTINO.relative_to(RAIZ)}")
    print("[SELO] Lembre de commitar este arquivo — o deploy usa git ls-files.")
