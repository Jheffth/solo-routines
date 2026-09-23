# -*- coding: utf-8 -*-
"""
O BOT DO TELEGRAM, ponta a ponta — sem tocar no Telegram.

POR QUE ESTE TESTE EXISTE

O bot é o único caminho do Sistema que roda sem ninguém olhando. Um erro
no `/hoje` aparece numa tela; um erro no vínculo aparece como "o bot não
respondeu", dias depois, sem log nenhum. E o que está em jogo não é
cosmético: quem passa pelo vínculo conclui missões, ganha XP e lê a
rotina de um hunter.

COMO SE TESTA UM BOT SEM REDE

Trocando `_tg` por uma função que guarda o que seria enviado. O que
importa aqui nunca foi o HTTP — é a DECISÃO: para qual hunter aquela
mensagem foi atribuída, e se a conversa tinha direito de ser atendida.

Uso: DATABASE_URL=sqlite:///./x.db SECRET_KEY=... python test_bot_telegram.py
"""
import os
from datetime import datetime, timedelta

from fastapi.testclient import TestClient

import main
import database
from auth.service import hash_senha

P = "/api"


def ok(cond, msg):
    print(("  [ok]  " if cond else "  [XX]  ") + msg)
    assert cond, msg


class Caixa:
    """O Telegram falso: guarda (chat, texto) em vez de mandar."""

    def __init__(self):
        self.enviadas = []
        self.teclados = []

    def __call__(self, chat_id, texto, parse_mode="Markdown", teclado=None):
        self.enviadas.append((str(chat_id), texto))
        self.teclados.append(teclado or [])

    def ultima(self, chat=None):
        for c, t in reversed(self.enviadas):
            if chat is None or c == str(chat):
                return t
        return ""

    def ultimo_teclado(self):
        return self.teclados[-1] if self.teclados else []

    def limpar(self):
        self.enviadas.clear()
        self.teclados.clear()


def main_teste():
    from routers import bot_telegram as bt
    from motors import vinculo

    caixa = Caixa()
    bt._tg = caixa

    with TestClient(main.app) as c:
        db = database.SessionLocal()
        arq = db.query(database.Usuario).filter_by(nivel_acesso="Arquiteto").first()
        arq.senha_hash = hash_senha("admin123")
        login_arq = arq.login
        db.commit()
        db.close()

        def tok(l, s):
            return {"Authorization": "Bearer " + c.post(
                P + "/auth/login", data={"username": l, "password": s}
            ).json()["access_token"]}

        A = tok(login_arq, "admin123")

        # ── um segundo hunter: é ele que prova que o bot separa gente ──
        cod = c.post(P + "/convites/", json={"nivel_acesso": "User", "badges": []},
                     headers=A).json()["convites"][0]["codigo"]
        c.post(P + "/auth/registro", json={"nome": "Kaio", "login": "kaio",
               "senha": "senha123", "email": "k@x.com", "codigo": cod})
        K = tok("kaio", "senha123")

        print("\n=== BOT TELEGRAM ===")

        # ══════════════════════════════════════════════════════════════
        # 1 · A PORTA FECHADA
        # ══════════════════════════════════════════════════════════════
        db = database.SessionLocal()
        bt._processar("/hoje", "111", db)
        ok("não está vinculada" in caixa.ultima("111"),
           "conversa desconhecida nao recebe missao nenhuma")

        bt._processar("/status", "111", db)
        ok("não está vinculada" in caixa.ultima("111"),
           "/status tambem barra antes de olhar o banco")
        db.close()

        # ══════════════════════════════════════════════════════════════
        # 2 · O CÓDIGO NASCE NO PAINEL
        # ══════════════════════════════════════════════════════════════
        r = c.post(P + "/bots/codigo/telegram", headers=A)
        ok(r.status_code == 200, "arquiteto gera codigo")
        cod_arq = r.json()["codigo"]
        ok(len(cod_arq) == 6 and cod_arq.isdigit(), "seis digitos")

        # O PRAZO SAI COM FUSO. Sem ele o navegador le UTC como hora local
        # e, em Sao Paulo, o contador de 10 minutos mostrava 3h10.
        exp = r.json()["expira_em"]
        ok(exp.endswith("+00:00") or exp.endswith("Z"),
           "expira_em carrega o fuso — a tela nao precisa adivinhar")

        cod_kaio = c.post(P + "/bots/codigo/telegram", headers=K).json()["codigo"]
        ok(cod_kaio != cod_arq, "cada hunter recebe o seu")

        # Gerar de novo mata o anterior — dois codigos vivos dobrariam a
        # superficie de adivinhacao sem dar comodidade nenhuma.
        cod_novo = c.post(P + "/bots/codigo/telegram", headers=A).json()["codigo"]
        db = database.SessionLocal()
        bt._processar("/vincular " + cod_arq, "111", db)
        ok("❌" in caixa.ultima("111"), "codigo antigo morre ao gerar outro")
        db.close()

        # ══════════════════════════════════════════════════════════════
        # 3 · O VÍNCULO
        # ══════════════════════════════════════════════════════════════
        db = database.SessionLocal()
        bt._processar("/vincular " + cod_novo, "111", db)
        ok("vinculada" in caixa.ultima("111") and "❌" not in caixa.ultima("111"),
           "codigo valido vincula a conversa")
        db.close()

        db = database.SessionLocal()
        u = vinculo.por_origem(db, "telegram", "111")
        ok(u is not None and u.login == login_arq, "o chat 111 e do Arquiteto")
        db.close()

        # USO ÚNICO: o mesmo codigo, noutro chat, nao entra.
        db = database.SessionLocal()
        bt._processar("/vincular " + cod_novo, "222", db)
        ok("❌" in caixa.ultima("222"), "codigo usado nao serve de novo")
        db.close()

        # ══════════════════════════════════════════════════════════════
        # 4 · DOIS HUNTERS, DUAS CONVERSAS
        #     É o defeito que originou tudo isto: o bot respondia a
        #     conversa de um com as missoes do outro.
        # ══════════════════════════════════════════════════════════════
        db = database.SessionLocal()
        bt._processar("/vincular " + cod_kaio, "222", db)
        db.close()

        db = database.SessionLocal()
        uk = vinculo.por_origem(db, "telegram", "222")
        ok(uk is not None and uk.login == "kaio", "o chat 222 e do Kaio")
        ok(vinculo.por_origem(db, "telegram", "111").login == login_arq,
           "e o 111 continua sendo do Arquiteto")
        db.close()

        caixa.limpar()
        db = database.SessionLocal()
        bt._processar("/status", "111", db)
        bt._processar("/status", "222", db)
        db.close()
        ok("Kaio" in caixa.ultima("222"), "o /status do 222 fala do Kaio")
        ok("Kaio" not in caixa.ultima("111"), "e o do 111 nao vaza o Kaio")

        # ══════════════════════════════════════════════════════════════
        # 5 · O LIMITE DE ERROS — a defesa que faz as outras valerem
        # ══════════════════════════════════════════════════════════════
        db = database.SessionLocal()
        for _ in range(vinculo.ERROS_ATE_BLOQUEAR):
            bt._processar("/vincular 000000", "333", db)
        antes = caixa.ultima("333")
        bt._processar("/vincular 000000", "333", db)
        depois = caixa.ultima("333")
        ok("muitas tentativas" in depois.lower() or "aguarde" in depois.lower()
           or depois != antes,
           "apos %d erros a origem e bloqueada" % vinculo.ERROS_ATE_BLOQUEAR)
        db.close()

        # O BLOQUEIO MORA NO BANCO, nao em memoria: um deploy reinicia o
        # processo, e um limite que zera no deploy e um limite que o
        # atacante zera sozinho — basta esperar.
        #
        # Confere-se `bloqueado_ate`, NAO `erros`: ao bater o limite o
        # motor zera o contador e passa a contar o castigo. Minha primeira
        # versao deste teste exigia `erros >= 5` e falhou — o codigo
        # estava certo, a expectativa e que era.
        db = database.SessionLocal()
        t = db.query(database.TentativaVinculo).filter_by(
            canal="telegram", origem="333").first()
        ok(t is not None, "a tentativa ficou gravada no banco, nao em memoria")
        ok(t.bloqueado_ate is not None and t.bloqueado_ate > datetime.utcnow(),
           "o castigo tem prazo e sobrevive a um reinicio do processo")

        # E o bloqueio e POR ORIGEM: um chat castigado nao trava os outros.
        t.bloqueado_ate = None
        db.commit()
        db.close()

        # ══════════════════════════════════════════════════════════════
        # 6 · A VALIDADE
        # ══════════════════════════════════════════════════════════════
        cod_velho = c.post(P + "/bots/codigo/telegram", headers=K).json()["codigo"]
        db = database.SessionLocal()
        alvo = db.query(database.CodigoVinculo).filter_by(
            codigo=cod_velho, usado_em=None).first()
        alvo.expira_em = datetime.utcnow() - timedelta(minutes=1)
        db.commit()
        db.close()

        db = database.SessionLocal()
        bt._processar("/vincular " + cod_velho, "444", db)
        ok("❌" in caixa.ultima("444"), "codigo expirado nao vincula")
        db.close()

        # ══════════════════════════════════════════════════════════════
        # 7 · OS COMANDOS, já com dono
        # ══════════════════════════════════════════════════════════════
        caixa.limpar()
        db = database.SessionLocal()
        bt._processar("/add Beber agua no turno", "111", db)
        db.close()
        ok("adicionada" in caixa.ultima("111"), "/add cria a tarefa do dia")

        db = database.SessionLocal()
        dono = vinculo.por_origem(db, "telegram", "111")
        tarefa = db.query(database.TarefaDia).filter_by(
            usuario_id=dono.id, titulo="Beber agua no turno").first()
        ok(tarefa is not None, "a tarefa nasceu no hunter certo")
        db.close()

        caixa.limpar()
        db = database.SessionLocal()
        bt._processar("/hoje", "111", db)
        db.close()
        ok("Beber agua no turno" in caixa.ultima("111"), "/hoje mostra a tarefa")

        caixa.limpar()
        db = database.SessionLocal()
        bt._processar("/ok Beber agua", "111", db)
        db.close()
        ok("concluída" in caixa.ultima("111").lower(),
           "/ok conclui pelo titulo parcial")

        # A CONCLUSÃO TEM DE SOBREVIVER AO FIM DA SESSÃO. O caminho da
        # tarefa so fazia `flush`; se o commit nao acontecesse, o bot
        # responderia "concluida" e o app mostraria pendente — o pior
        # tipo de discordancia, porque o hunter confia na primeira.
        db = database.SessionLocal()
        t2 = db.query(database.TarefaDia).filter_by(id=tarefa.id).first()
        ok(t2.status == "CONCLUIDA", "a conclusao ficou gravada no banco")
        db.close()

        # O Kaio nao alcanca a tarefa do Arquiteto nem sabendo o titulo.
        caixa.limpar()
        db = database.SessionLocal()
        bt._processar("/ok Beber agua", "222", db)
        db.close()
        ok("não achei" in caixa.ultima("222").lower(),
           "um hunter nao conclui a missao do outro pelo bot")

        # ══════════════════════════════════════════════════════════════
        # 8 · DESVINCULAR fecha a porta de volta
        # ══════════════════════════════════════════════════════════════
        db = database.SessionLocal()
        bt._processar("/desvincular", "222", db)
        ok("desvinculada" in caixa.ultima("222").lower(), "/desvincular responde")
        db.close()

        db = database.SessionLocal()
        ok(vinculo.por_origem(db, "telegram", "222") is None,
           "o chat 222 perdeu o dono")
        db.close()

        caixa.limpar()
        db = database.SessionLocal()
        bt._processar("/hoje", "222", db)
        db.close()
        ok("não está vinculada" in caixa.ultima("222"),
           "e volta a ser tratado como desconhecido")

        # ══════════════════════════════════════════════════════════════
        # 9 · OS AVISOS SÓ ALCANÇAM QUEM PROVOU SER DONO
        # ══════════════════════════════════════════════════════════════
        db = database.SessionLocal()
        alcancaveis = [u.login for u in bt._destinatarios(db)]
        db.close()
        if bt.BOT_TOKEN:
            ok("kaio" not in alcancaveis,
               "hunter desvinculado sai da lista de avisos")
        else:
            ok(alcancaveis == [],
               "sem TELEGRAM_BOT_TOKEN nao ha destinatario (nao inventa lista)")

        # ══════════════════════════════════════════════════════════════
        # 10 · O WEBHOOK RECUSA SEM SEGREDO
        #      Antes, `if WEBHOOK_SECRET and ...` fazia a condicao inteira
        #      virar falsa quando o segredo faltava — e o endpoint aceitava
        #      QUALQUER corpo. O sintoma era "o bot funciona".
        # ══════════════════════════════════════════════════════════════
        guardado = bt.WEBHOOK_SECRET
        try:
            bt.WEBHOOK_SECRET = ""
            r = c.post(P + "/bot/webhook", json={"message": {
                "chat": {"id": "111"}, "text": "/status"}})
            ok(r.status_code == 503, "sem segredo o webhook recusa (503)")

            bt.WEBHOOK_SECRET = "um-segredo-de-verdade"
            r = c.post(P + "/bot/webhook", json={"message": {
                "chat": {"id": "111"}, "text": "/status"}})
            ok(r.status_code == 403, "segredo errado no cabecalho e 403")

            caixa.limpar()
            r = c.post(P + "/bot/webhook",
                       json={"message": {"chat": {"id": "111"}, "text": "/status"}},
                       headers={"X-Telegram-Bot-Api-Secret-Token":
                                "um-segredo-de-verdade"})
            ok(r.status_code == 200, "segredo certo passa")
            ok(caixa.ultima("111") != "", "e a mensagem chega ao processador")
        finally:
            bt.WEBHOOK_SECRET = guardado

        ok(bt.segredo_fraco.__call__ is not None, "existe a checagem de segredo fraco")
        for fraco in ("solorotinas", "troque-este-segredo", "123456"):
            bt.WEBHOOK_SECRET = fraco
            ok(bt.segredo_fraco(), "'%s' e reconhecido como fraco" % fraco)
        bt.WEBHOOK_SECRET = guardado

        # ══════════════════════════════════════════════════════════════
        # 11 · O DIAGNÓSTICO NÃO INVENTA ESTADO
        # ══════════════════════════════════════════════════════════════
        d = bt.diagnostico()
        ok(d["token_configurado"] == bool(bt.BOT_TOKEN),
           "o diagnostico reflete o token de verdade")
        if not bt.BOT_TOKEN:
            ok(d["pronto"] is False and d["webhook_registrado"] is False,
               "sem token nao se declara pronto")
            ok(d["erro_consulta"] is None,
               "sem token nem chega a perguntar — nao inventa erro")

        r = c.get(P + "/bot/status", headers=K)
        ok(r.status_code == 403, "o diagnostico e so do Arquiteto")
        ok(c.get(P + "/bot/status", headers=A).status_code == 200,
           "e o Arquiteto ve")

        # A aba Bots recebe tudo numa chamada — e o hunter comum nao
        # recebe o endereco do webhook nem o erro cru do Telegram.
        sk = c.get(P + "/bots/status", headers=K).json()
        ok(sk["telegram"]["servidor"] is None,
           "hunter comum nao ve o diagnostico do servidor")
        sa = c.get(P + "/bots/status", headers=A).json()
        ok(isinstance(sa["telegram"]["servidor"], dict),
           "o Arquiteto ve o diagnostico junto do /bots/status")

        print("\n=== BOT TELEGRAM OK ===\n")


if __name__ == "__main__":
    main_teste()
