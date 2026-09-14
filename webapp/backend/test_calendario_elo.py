# -*- coding: utf-8 -*-
"""
TESTE — O ELO COM O GOOGLE CALENDAR (Fase 1)

Esta fase nao desenha evento nenhum. Ela resolve uma coisa so, e e a
coisa que, se estiver errada, faz TUDO parar de funcionar uma hora depois
sem nenhum erro visivel: manter acesso valido a agenda do hunter.

O QUE PODE DAR ERRADO AQUI, EM ORDEM DE GRAVIDADE

1. O REFRESH TOKEN FICAR EM CLARO NO BANCO.
   Ele e acesso CONTINUO a conta de outra pessoa. Este projeto ja pagou
   por guardar segredo em lugar errado: a senha root ficou versionada em
   `scripts/deploy_contabo.py` desde `8b1f269`, e o conserto nao foi
   apagar a linha — foi ter de ROTACIONAR a senha. Aqui a cifra e testada
   pelo que importa: que o texto guardado NAO CONTENHA o segredo.

2. PEDIR AUTORIZACAO SEM `access_type=offline` E `prompt=consent`.
   Sem `offline` nao vem refresh token. Sem `prompt=consent`, quem
   reconecta depois de desconectar recebe `refresh_token: null` — e o app
   guarda silencio no lugar do segredo. Reconexao que parece funcionar e
   nao funciona e o pior defeito possivel.

3. A MARGEM DO VENCIMENTO.
   Um token que expira "em 3 segundos" passa num teste ingenuo, viaja
   pela rede e chega expirado. O 401 que volta parece erro de escopo e
   manda a investigacao para o lado errado.

4. O ESCOPO ALARGAR SEM NINGUEM NOTAR.
   `calendar.app.created` e o que faz o Google classificar o app como NAO
   CONFIDENCIAL — sem verificacao, sem teto de 100 usuarios. Trocar por
   `calendar.events` reabre tudo isso, e reabre calado.

Nao toca a rede: o que fala com o Google e substituido.

O .gitignore ignora `test_*.py`. Para versionar:  git add -f

Uso:
    cd webapp/backend
    DATABASE_URL="sqlite:////tmp/cal.db" SECRET_KEY="teste" python test_calendario_elo.py
"""
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault("DATABASE_URL", "sqlite:///./_teste_calendario.db")
os.environ.setdefault("SECRET_KEY", "teste")

falhas = 0
testes = 0


def ok(cond, msg):
    global falhas, testes
    testes += 1
    if not cond:
        falhas += 1
    print(("  [ok]  " if cond else "  [XX]  ") + msg)


# ══════════════════════════════════════════════════════════════════
print("\n=== O ELO COM O GOOGLE CALENDAR ===\n")
print("-- o cofre: o segredo nao fica legivel --")

from cryptography.fernet import Fernet  # noqa: E402

os.environ["CALENDARIO_CHAVE"] = Fernet.generate_key().decode()

from motors import cofre  # noqa: E402

SEGREDO = "1//0gFAKE-refresh-token-do-google-ABC123"

ok(cofre.disponivel(), "com a chave no ambiente, o cofre funciona")

guardado = cofre.guardar(SEGREDO)
ok(guardado is not None and guardado != SEGREDO, "guardar devolve outra coisa")
ok(SEGREDO not in guardado,
   "e o texto guardado NAO CONTEM o segredo — este e o assert que importa")
ok(cofre.abrir(guardado) == SEGREDO, "abrir devolve o original")

print("\n-- sem chave, o cofre RECUSA em vez de improvisar --")
os.environ.pop("CALENDARIO_CHAVE")
ok(not cofre.disponivel(), "o cofre se declara indisponivel")
try:
    cofre.guardar("qualquer coisa")
    ok(False, "guardar deveria ter levantado CofreIndisponivel")
except cofre.CofreIndisponivel:
    ok(True, "guardar levanta em vez de gravar em claro — "
             "cofre que aceita chave padrao e cadeado com a chave pendurada")

print("\n-- chave trocada: degrada, nao explode --")
os.environ["CALENDARIO_CHAVE"] = Fernet.generate_key().decode()
ok(cofre.abrir(guardado) is None,
   "abrir com a chave errada devolve None (o hunter reconecta; o app nao cai)")
ok(cofre.abrir(None) is None, "e None entra e None sai")

# ══════════════════════════════════════════════════════════════════
print("\n-- a autorizacao pede o que precisa --")
from motors import calendario as motor  # noqa: E402

url = motor.url_de_consentimento("abc123", "https://exemplo/cb")

ok("access_type=offline" in url,
   "access_type=offline — sem isto NAO VEM refresh token")
ok("prompt=consent" in url,
   "prompt=consent — sem isto, reconectar volta sem refresh token")
ok("include_granted_scopes=true" in url,
   "include_granted_scopes — nao derruba o consentimento do login")
ok("calendar.app.created" in url, "o escopo estreito viaja")
ok("state=abc123" in url, "e o state anti-CSRF junto")

print("\n-- o escopo NAO pode alargar --")
ok(motor.ESCOPO.endswith("/calendar.app.created"),
   "o escopo e exatamente calendar.app.created")
ok("auth/calendar.events" not in motor.ESCOPO and
   not motor.ESCOPO.endswith("/calendar"),
   "e NAO e calendar nem calendar.events — seria escopo sensivel, e "
   "traria de volta verificacao e teto de 100 usuarios")
ok(motor.FUSO == "America/Sao_Paulo",
   "o fuso e nome IANA, nao offset fixo: horario de verao nao quebra")

# ══════════════════════════════════════════════════════════════════
print("\n-- o acesso vivo: renova quando precisa, e so quando precisa --")

from database import Base, engine, SessionLocal, ContaCalendario  # noqa: E402

Base.metadata.create_all(bind=engine)
db = SessionLocal()
db.query(ContaCalendario).delete()
db.commit()

chamadas = {"renovar": 0}


def falso_renovar(refresh):
    chamadas["renovar"] += 1
    return {"access_token": "novo-acesso-" + str(chamadas["renovar"]),
            "expires_in": 3600}


motor.renovar = falso_renovar

conta = ContaCalendario(
    usuario_id=1, provedor="google", ativo=True,
    refresh_cif=cofre.guardar("refresh-valido"),
    access_cif=cofre.guardar("acesso-ainda-bom"),
    expira_em=datetime.utcnow() + timedelta(minutes=30),
)
db.add(conta)
db.commit()

ok(motor.acesso_valido(db, conta) == "acesso-ainda-bom",
   "token com 30 min de vida e reaproveitado")
ok(chamadas["renovar"] == 0, "sem ida ao Google — renovar a toa custa latencia")

# A MARGEM. 3 segundos de vida "passam" num teste ingenuo e chegam
# expirados do outro lado da rede.
conta.expira_em = datetime.utcnow() + timedelta(seconds=3)
db.commit()
ok(motor.acesso_valido(db, conta) == "novo-acesso-1",
   "token expirando em 3s e renovado ANTES de viajar")
ok(chamadas["renovar"] == 1, "uma renovacao, nao duas")
ok(cofre.abrir(conta.access_cif) == "novo-acesso-1",
   "o token novo fica guardado, e guardado CIFRADO")
ok(conta.expira_em > datetime.utcnow() + timedelta(minutes=50),
   "com o vencimento novo anotado")

print("\n-- sem refresh legivel, manda reconectar --")
conta.access_cif = None
conta.expira_em = None
conta.refresh_cif = "lixo-que-nao-abre"
db.commit()
try:
    motor.acesso_valido(db, conta)
    ok(False, "deveria ter recusado")
except motor.ErroCalendario as e:
    ok("econect" in str(e), f"erro diz para reconectar: {e}")

print("\n-- conta desligada nao renova --")
conta.ativo = False
conta.refresh_cif = cofre.guardar("refresh-valido")
db.commit()
try:
    motor.acesso_valido(db, conta)
    ok(False, "deveria ter recusado")
except motor.ErroCalendario:
    ok(True, "conta desconectada recusa antes de tocar a rede")

# ══════════════════════════════════════════════════════════════════
print("\n-- trocar codigo por token exige o de longo prazo --")


class _Resp:
    def __init__(self, status, dados):
        self.status_code = status
        self._d = dados
        self.text = str(dados)

    def json(self):
        return self._d


class _Cli:
    def __init__(self, resp):
        self._r = resp

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def post(self, *a, **k):
        return self._r


import httpx  # noqa: E402

httpx.Client = lambda *a, **k: _Cli(_Resp(200, {"access_token": "a", "expires_in": 3600}))
try:
    motor.trocar_codigo("cod", "https://exemplo/cb")
    ok(False, "deveria recusar resposta sem refresh_token")
except motor.ErroCalendario as e:
    ok("longo prazo" in str(e),
       "resposta SEM refresh_token e recusada na hora — guardar so o acesso "
       "de 1h seria uma conexao que morre calada")

httpx.Client = lambda *a, **k: _Cli(_Resp(
    200, {"access_token": "a", "refresh_token": "r", "expires_in": 3600}))
d = motor.trocar_codigo("cod", "https://exemplo/cb")
ok(d.get("refresh_token") == "r", "com refresh_token, passa")

# ══════════════════════════════════════════════════════════════════
print("\n-- o router nao oferece o que nao pode cumprir --")
os.environ.pop("CALENDARIO_CHAVE", None)
ok(not cofre.disponivel(),
   "sem chave no servidor o status responde indisponivel — melhor recusar "
   "na porta do que receber o token e nao ter onde guarda-lo")

db.close()
try:
    os.remove("_teste_calendario.db")
except OSError:
    pass

print("\n" + "=" * 52)
print(f"TUDO VERDE — {testes} asserts" if falhas == 0
      else f"{falhas} FALHA(S) de {testes} asserts")
print("=" * 52 + "\n")
sys.exit(0 if falhas == 0 else 1)
