# -*- coding: utf-8 -*-
"""
TESTE — O SELO DA VERSAO E OS SEGREDOS NO REPOSITORIO

Duas familias de assert, unidas pela mesma causa: coisa que deveria vir de
fora estava cravada dentro do codigo.

PARTE 1 — O SELO

O endpoint /api/versao devolvia "1.6.0" com o arquivo VERSION marcando
1.8.0, e "unknown" como commit. Nenhum dos dois quebrava nada; so faziam o
Arquiteto acreditar que tinha subido o que nao tinha. O assert central aqui
e o que proibe FALLBACK PLAUSIVEL: sem selo, a resposta tem de dizer que
nao sabe, com todas as letras. Numero redondo e pior do que erro.

PARTE 2 — OS SEGREDOS

A senha root do Contabo estava copiada em SEIS arquivos versionados; a senha
pessoal do Arquiteto e um `admin`/`admin123` nivel Criador estavam no
seed.py. Seis copias e o motivo pelo qual ninguem troca a senha: trocar vira
uma cacada e alguma copia sempre escapa.

A varredura procura o FORMATO do descuido, nao os valores — um detector que
carrega os segredos so os muda de lugar, e uma lista literal envelhece no
dia em que alguem cravar uma senha nova.

  ATENCAO: tirar do arquivo NAO tira do historico do git. Estes asserts
  protegem o futuro; o passado so se conserta ROTACIONANDO as senhas.

O .gitignore ignora `test_*.py`. Para versionar:  git add -f

Uso:
    cd webapp/backend
    DATABASE_URL="sqlite:////tmp/selo.db" SECRET_KEY="teste" python test_selo_versao.py
"""
import json
import os
import pathlib
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

falhas = 0
testes = 0


def ok(cond, msg):
    global falhas, testes
    testes += 1
    if not cond:
        falhas += 1
    print(("  [ok]  " if cond else "  [XX]  ") + msg)


BACKEND = pathlib.Path(__file__).resolve().parent
RAIZ = BACKEND.parent.parent

# ══════════════════════════════════════════════════════════════════
print("\n=== O SELO DA VERSAO ===\n")
print("-- o endpoint le o selo gravado no deploy --")

import routers.versao as mod  # noqa: E402

selo_real = BACKEND / "build_info.json"
guardado = selo_real.read_text(encoding="utf-8") if selo_real.exists() else None

try:
    selo_real.write_text(json.dumps({
        "versao": "9.9.9", "sha": "abc1234", "ramo": "main",
        "sujo": False, "selado_em": "2026-09-13T00:00:00+00:00",
    }), encoding="utf-8")

    r = mod.versao()
    ok(r["versao"] == "9.9.9", "a versao vem do build_info.json, nao de literal")
    ok(r["sha"] == "abc1234", "o commit tambem — o git nao existe no conteiner")
    ok(r["selado"] is True, "e a resposta declara que ESTA selada")

    # ── O caso que criou o bug ────────────────────────────────────
    print("\n-- sem selo, o endpoint admite que nao sabe --")
    selo_real.unlink()
    for v in ("APP_VERSAO", "APP_SHA"):
        os.environ.pop(v, None)

    # Na maquina do Arquiteto o VERSION da raiz existe e responde — e foi
    # exatamente por isso que o bug passou: aqui funcionava. Dentro da
    # imagem nao ha VERSION nenhum, e e esse caso que precisa ser honesto.
    real = mod._versao_do_arquivo
    real_git = mod._git_sha_local
    mod._versao_do_arquivo = lambda: ""
    mod._git_sha_local = lambda: ""
    try:
        r = mod.versao()
        ok(r["versao"] == "sem selo",
           "sem nenhuma fonte, a versao e 'sem selo'")
        ok(not re.match(r"^\d+\.\d+\.\d+$", r["versao"]),
           "e NAO um numero plausivel — era esse o defeito do 1.6.0")
        ok(r["sha"] == "sem selo", "o commit idem, sem 'unknown' disfarcado")
        ok(r["selado"] is False, "e a resposta avisa que nao ha selo")
    finally:
        mod._versao_do_arquivo = real
        mod._git_sha_local = real_git

    # ── A porta do CI ─────────────────────────────────────────────
    print("\n-- variaveis de ambiente como segunda fonte --")
    os.environ["APP_VERSAO"] = "2.0.0"
    os.environ["APP_SHA"] = "deadbee"
    mod._versao_do_arquivo = lambda: ""
    try:
        r = mod.versao()
        ok(r["versao"] == "2.0.0", "APP_VERSAO responde quando nao ha selo")
        ok(r["sha"] == "deadbee", "APP_SHA tambem")
    finally:
        mod._versao_do_arquivo = real
        os.environ.pop("APP_VERSAO", None)
        os.environ.pop("APP_SHA", None)

    # ── A casa, separada do regime ────────────────────────────────
    print("\n-- o hospedeiro e campo proprio --")
    os.environ["AMBIENTE"] = "production"
    os.environ["HOSPEDEIRO"] = "Contabo"
    r = mod.versao()
    ok(r["ambiente"] == "production", "o regime continua sendo 'production'")
    ok(r["hospedeiro"] == "Contabo",
       "e a casa viaja separada — confundir os dois gerou o 'RENDER'")
finally:
    if guardado is not None:
        selo_real.write_text(guardado, encoding="utf-8")

# ══════════════════════════════════════════════════════════════════
print("\n-- o literal cravado saiu do config.py --")
cfg_txt = (BACKEND / "config.py").read_text(encoding="utf-8")
# Procura um RETURN de verdade, nao a substring. O docstring de
# `_ler_versao_arquivo` cita `return "1.6.0"` entre crases para narrar o
# bug antigo — uma busca por substring pega a propria explicacao do
# conserto e acusa o arquivo que a corrigiu.
ok(not re.search(r'(?m)^\s*return\s+["\']1\.6\.0["\']\s*$', cfg_txt),
   "o `return \"1.6.0\"` que alimentava o rodape nao existe mais")

# ══════════════════════════════════════════════════════════════════
print("\n=== SEGREDOS NO REPOSITORIO ===\n")

# PROCURA A FORMA, NAO O VALOR.
#
# A tentacao era listar as quatro senhas aqui e buscar cada uma. Mas este
# arquivo tambem e versionado: um detector de segredos que CARREGA os
# segredos apenas os move de lugar. Alem disso, uma lista literal so acha
# as senhas de hoje — no dia em que alguem cravar uma nova, o teste passa
# tranquilo.
#
# Entao o que se procura e o FORMATO do descuido: uma senha entre aspas
# passada a uma conexao, um segredo escrito direto no compose, uma
# credencial embutida numa URL de banco.

PADROES = [
    (".py", r"password\s*=\s*[\"'][^\"'\s]{4,}[\"']",
     "senha entre aspas num script Python"),
    (".py", r"hash_senha\(\s*[\"'][^\"']+[\"']\s*\)",
     "senha de usuario cravada no seed"),
    (".yml", r"(?m)^\s*-?\s*SECRET_KEY\s*=\s*(?!\$\{)\S",
     "SECRET_KEY literal no compose"),
    (".yml", r"postgresql://[^$\s:]+:(?!\$\{)[^@\s]+@",
     "credencial embutida na URL do Postgres"),
]

IGNORAR = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist"}
AUTO = pathlib.Path(__file__).resolve()

arquivos = []
for p in RAIZ.rglob("*"):
    if not p.is_file() or p.suffix.lower() not in (".py", ".yml", ".yaml"):
        continue
    if any(parte in IGNORAR for parte in p.parts):
        continue
    if p.resolve() == AUTO:
        continue  # este arquivo descreve os padroes; nao os pratica
    if p.suffix.lower() == ".py" and p.name.startswith("test_"):
        # O proprio .gitignore barra `test_*.py` (linha 46): sem `git add
        # -f`, nunca chegam ao repositorio. E as senhas que semeiam sao de
        # bancada — um sqlite efemero para logar durante o teste, nao a
        # conta real que o seed.py cria em producao. Varrer o disco (nao o
        # git) pegaria esse andaime local em toda maquina, sempre.
        continue
    arquivos.append(p)

for ext, padrao, descricao in PADROES:
    rx = re.compile(padrao)
    achados = []
    for p in arquivos:
        if ext == ".yml" and p.suffix.lower() not in (".yml", ".yaml"):
            continue
        if ext == ".py" and p.suffix.lower() != ".py":
            continue
        try:
            if rx.search(p.read_text(encoding="utf-8", errors="ignore")):
                achados.append(str(p.relative_to(RAIZ)))
        except Exception:
            pass
    ok(not achados,
       f"{descricao}: nenhuma ocorrencia" if not achados
       else f"{descricao} EM: {', '.join(achados[:6])}")

# O molde tem de existir, senao o deploy quebra sem dizer por que.
ok((RAIZ / "webapp" / ".env.example").exists(),
   "webapp/.env.example existe para guiar a criacao do .env")
ok(not (RAIZ / "webapp" / ".env").exists()
   or ".env" in (RAIZ / ".gitignore").read_text(encoding="utf-8"),
   "e o .env de verdade esta barrado pelo .gitignore")

print(f"  ({len(arquivos)} arquivos varridos)")

print("\n  LEMBRETE: isto so protege o futuro. As senhas que estavam")
print("  cravadas continuam no HISTORICO do git e seguem comprometidas")
print("  ate serem TROCADAS no Contabo, no Postgres e no seu perfil.")

# ══════════════════════════════════════════════════════════════════
print("\n" + "=" * 46)
print(f"TUDO VERDE — {testes} asserts" if falhas == 0
      else f"{falhas} FALHA(S) de {testes} asserts")
print("=" * 46 + "\n")
sys.exit(0 if falhas == 0 else 1)
