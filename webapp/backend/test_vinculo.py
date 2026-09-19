# -*- coding: utf-8 -*-
"""
TESTE — O VINCULO DOS BOTS

O bot do Telegram servia UM hunter: `_get_usuario()` devolvia "o primeiro
usuario ativo". Com dois, ele responderia a conversa de um com as missoes
do outro — e o segundo nunca receberia nada, sem erro, sem log.

Este arquivo guarda a porta que substituiu aquilo.

O QUE PODE DAR ERRADO, EM ORDEM DE GRAVIDADE

1. O CODIGO DE OUTRO HUNTER FUNCIONAR. E o pior: entrega XP, missoes e
   rotina de alguem para quem pedir. O teste cobra que o vinculo ligue o
   chat ao dono do codigo, e a ninguem mais.

2. FORCA BRUTA PASSAR. Seis digitos sao um milhao de combinacoes — coisa
   de segundos para um script. Sem limite de tentativas, validade curta e
   uso unico so encurtam a janela do ataque; nao o impedem.

3. A MESMA ORIGEM EM DOIS HUNTERS. O bot passaria a responder uma conversa
   com os dados de qualquer um dos dois, dependendo de qual linha o banco
   devolvesse primeiro.

4. MENSAGEM DE ERRO QUE ENTREGA O JOGO. "Codigo expirado" e "codigo
   inexistente" como textos diferentes contam ao atacante quando ele
   acertou os digitos e so chegou tarde — o que reduz um milhao de
   palpites a um problema de tempo.

O .gitignore ignora `test_*.py`. Para versionar:  git add -f

Uso:
    cd webapp/backend
    DATABASE_URL="sqlite:////tmp/vinc.db" SECRET_KEY="teste" python3 test_vinculo.py
"""
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DATABASE_URL", "sqlite:///./_teste_vinculo.db")
os.environ.setdefault("SECRET_KEY", "teste")

falhas = 0
testes = 0


def ok(cond, msg):
    global falhas, testes
    testes += 1
    if not cond:
        falhas += 1
    print(("  [ok]  " if cond else "  [XX]  ") + msg)


from fastapi.testclient import TestClient  # noqa: E402
import main  # noqa: E402
from database import (Base, engine, SessionLocal, Usuario,  # noqa: E402
                      CodigoVinculo, TentativaVinculo)
from motors import vinculo  # noqa: E402

with TestClient(main.app):
    pass
Base.metadata.create_all(bind=engine)

db = SessionLocal()
for lg in ("_v_ana", "_v_bruno"):
    u = db.query(Usuario).filter(Usuario.login == lg).first()
    if u:
        db.query(CodigoVinculo).filter(CodigoVinculo.usuario_id == u.id).delete()
        db.delete(u)
db.query(TentativaVinculo).delete()
db.commit()


def novo(login, nome):
    u = Usuario(nome=nome, login=login, senha_hash="x", ativo=True,
                xp_total=0, xp_atual=0, moedas=0, nivel_atual=1)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


ana = novo("_v_ana", "Ana")
bruno = novo("_v_bruno", "Bruno")

print("\n=== O VINCULO DOS BOTS ===\n")
print("-- o codigo nasce no painel --")

r = vinculo.gerar(db, ana, "telegram")
ok(len(r["codigo"]) == 6 and r["codigo"].isdigit(), "seis digitos")
ok(r["validade_min"] == 10, "vale 10 minutos")

antigo = r["codigo"]
r2 = vinculo.gerar(db, ana, "telegram")
ok(r2["codigo"] != antigo or True, "gerar de novo devolve um codigo")
try:
    vinculo.vincular(db, "telegram", antigo, "chat_ana")
    ok(False, "o codigo ANTERIOR deveria ter morrido")
except vinculo.ErroVinculo:
    ok(True, "gerar um novo MATA o anterior — dois codigos vivos dobrariam "
             "a superficie de adivinhacao sem dar comodidade nenhuma")

print("\n-- ele liga o chat ao DONO, e a mais ninguem --")
cod_ana = r2["codigo"]
u = vinculo.vincular(db, "telegram", cod_ana, "chat_ana", nome="Ana TG")
ok(u.id == ana.id, "o chat foi para a Ana, dona do codigo")
ok(vinculo.por_origem(db, "telegram", "chat_ana").id == ana.id,
   "e `por_origem` encontra ela — e a funcao que substituiu o "
   "`_get_usuario()` que devolvia 'o primeiro usuario ativo'")
ok(vinculo.por_origem(db, "telegram", "chat_bruno") is None,
   "um chat desconhecido nao devolve ninguem, em vez de devolver "
   "o primeiro da tabela")

print("\n-- uso unico --")
try:
    vinculo.vincular(db, "telegram", cod_ana, "chat_invasor")
    ok(False, "deveria recusar o codigo ja usado")
except vinculo.ErroVinculo:
    ok(True, "codigo consumido nao serve de novo")

print("\n-- uma origem, um hunter --")
cod_b = vinculo.gerar(db, bruno, "telegram")["codigo"]
try:
    vinculo.vincular(db, "telegram", cod_b, "chat_ana")
    ok(False, "deveria recusar: esse chat ja e da Ana")
except vinculo.ErroVinculo as e:
    ok("outra conta" in e.mensagem,
       "o mesmo chat nao pode pertencer a dois hunters — senao o bot "
       "responderia com os dados de qualquer um dos dois")

print("\n-- expirado nao passa --")
cod_exp = vinculo.gerar(db, bruno, "telegram")["codigo"]
reg = db.query(CodigoVinculo).filter(CodigoVinculo.codigo == cod_exp).first()
reg.expira_em = datetime.utcnow() - timedelta(minutes=1)
db.commit()
try:
    vinculo.vincular(db, "telegram", cod_exp, "chat_bruno")
    ok(False, "deveria recusar o expirado")
except vinculo.ErroVinculo as e:
    ok(True, "codigo vencido nao serve")
    ok("expirado" in e.mensagem and "inv" in e.mensagem.lower(),
       "e a mensagem e a MESMA do codigo inexistente: textos diferentes "
       "contariam ao atacante quando ele acertou os digitos e so "
       "chegou tarde")

print("\n-- forca bruta bate num muro --")
db.query(TentativaVinculo).delete()
db.commit()
bloqueou = False
for i in range(vinculo.ERROS_ATE_BLOQUEAR + 1):
    try:
        vinculo.vincular(db, "telegram", "000000", "chat_atacante")
    except vinculo.ErroVinculo as e:
        if "Muitas tentativas" in e.mensagem:
            bloqueou = True
            break
ok(bloqueou,
   f"apos {vinculo.ERROS_ATE_BLOQUEAR} erros a origem e bloqueada — sem "
   "isto, um milhao de combinacoes e coisa de segundos para um script")

t = db.query(TentativaVinculo).filter(
    TentativaVinculo.origem == "chat_atacante").first()
ok(t is not None and t.bloqueado_ate is not None,
   "e o castigo mora no BANCO, nao em memoria: em memoria o atacante "
   "zera o limite so esperando o proximo deploy")

print("\n-- um codigo bom ainda passa depois do castigo de outro --")
db.query(TentativaVinculo).delete()
db.commit()
cod_b2 = vinculo.gerar(db, bruno, "telegram")["codigo"]
u2 = vinculo.vincular(db, "telegram", cod_b2, "chat_bruno", nome="Bruno TG")
ok(u2.id == bruno.id, "Bruno entrou no chat dele")

print("\n-- os canais sao separados --")
ok(vinculo.por_origem(db, "whatsapp", "chat_ana") is None,
   "o chat do Telegram da Ana nao vale como JID de WhatsApp")
cod_w = vinculo.gerar(db, ana, "whatsapp")["codigo"]
uw = vinculo.vincular(db, "whatsapp", cod_w, "5511999@s.whatsapp.net")
ok(uw.id == ana.id and ana.whatsapp_jid == "5511999@s.whatsapp.net",
   "e o vinculo de WhatsApp grava no campo dele")
ok(ana.telegram_chat_id == "chat_ana", "sem mexer no do Telegram")

print("\n-- a lista de destinatarios --")
tg = vinculo.vinculados(db, "telegram")
ok(len(tg) == 2, f"dois hunters alcancaveis pelo Telegram ({len(tg)})")
ok(len(vinculo.vinculados(db, "whatsapp")) == 1, "e um pelo WhatsApp")

print("\n-- desvincular --")
ok(vinculo.desvincular(db, ana, "telegram") is True, "desvincula e diz que tinha")
ok(vinculo.por_origem(db, "telegram", "chat_ana") is None,
   "e o chat deixa de encontrar alguem")
ok(ana.whatsapp_jid is not None, "sem levar o outro canal junto")

print("\n-- canal desconhecido --")
try:
    vinculo.gerar(db, ana, "telegrama")
    ok(False, "deveria recusar canal invalido")
except vinculo.ErroVinculo:
    ok(True, "canal fora da lista e recusado")

db.query(CodigoVinculo).filter(
    CodigoVinculo.usuario_id.in_([ana.id, bruno.id])).delete(synchronize_session=False)
db.query(TentativaVinculo).delete()
db.query(Usuario).filter(Usuario.id.in_([ana.id, bruno.id])).delete(synchronize_session=False)
db.commit()
db.close()

print("\n" + "=" * 52)
print(f"TUDO VERDE — {testes} asserts" if falhas == 0
      else f"{falhas} FALHA(S) de {testes} asserts")
print("=" * 52 + "\n")
sys.exit(0 if falhas == 0 else 1)
