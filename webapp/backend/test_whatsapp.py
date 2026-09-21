# -*- coding: utf-8 -*-
"""
O WHATSAPP — e a PROVA de que os dois canais são o mesmo bot.

O PEDIDO FOI "REPLICAR 100%". Este arquivo é o que impede isso de virar
uma promessa: a bateria de comandos roda DUAS VEZES, uma em cada canal,
e falha se um comando existir só num deles.

Sem um teste assim, "100%" dura até o próximo comando novo — alguém
acrescenta no Telegram, esquece do WhatsApp, e a divergência aparece
meses depois como "o bot do WhatsApp não entende isso".

O QUE NÃO É IGUAL, E POR QUÊ

Botões. A Evolution fala WhatsApp por Baileys, e os interativos pararam
de renderizar em conta não-oficial. O SoloCMV, mesmo stack em produção,
não usa um botão em 1057 linhas. Aqui o menu vira lista numerada — e o
teste cobra que a lista exista e que o número funcione.

E O QUE O SOLOCMV ME ENSINOU A TESTAR:
  · a Evolution REENTREGA a mesma mensagem (`key.id`)
  · o eco `fromMe` do aparelho pareado
  · grupo não é conversa de hunter

Uso: DATABASE_URL=sqlite:///./x.db SECRET_KEY=... python test_whatsapp.py
"""
from fastapi.testclient import TestClient

import main
import database
from auth.service import hash_senha

P = "/api"


def ok(cond, msg):
    print(("  [ok]  " if cond else "  [XX]  ") + msg)
    assert cond, msg


class CaixaWhats:
    def __init__(self):
        self.enviadas = []

    def __call__(self, jid, texto):
        self.enviadas.append((str(jid), texto))
        return True

    def ultima(self):
        return self.enviadas[-1][1] if self.enviadas else ""

    def limpar(self):
        self.enviadas.clear()


class CaixaTg:
    def __init__(self):
        self.enviadas = []

    def __call__(self, chat_id, texto, parse_mode="Markdown", teclado=None):
        self.enviadas.append((str(chat_id), texto, teclado or []))
        return {"ok": True}

    def ultima(self):
        return self.enviadas[-1][1] if self.enviadas else ""

    def teclado(self):
        return self.enviadas[-1][2] if self.enviadas else []

    def limpar(self):
        self.enviadas.clear()


def main_teste():
    from routers import bot_telegram as bt, bot_whatsapp as bw
    from motors import conversa, tempo, vinculo

    cx_tg, cx_wa = CaixaTg(), CaixaWhats()
    bt._tg = cx_tg
    bw._enviar = cx_wa

    JID = "5511999998888@s.whatsapp.net"

    with TestClient(main.app) as c:
        db = database.SessionLocal()
        arq = db.query(database.Usuario).filter_by(nivel_acesso="Arquiteto").first()
        arq.senha_hash = hash_senha("admin123")
        login_arq, uid = arq.login, arq.id
        db.commit()
        db.close()

        A = {"Authorization": "Bearer " + c.post(
            P + "/auth/login", data={"username": login_arq, "password": "admin123"}
        ).json()["access_token"]}

        hoje = tempo.hoje()
        print("\n=== O BOT DO WHATSAPP ===")

        def evento(texto, jid=JID, mid=None, from_me=False, nome="Jefferson"):
            import uuid
            return {"key": {"remoteJid": jid, "fromMe": from_me,
                            "id": mid or uuid.uuid4().hex},
                    "pushName": nome,
                    "message": {"conversation": texto}}

        def fala_wa(texto, **kw):
            db = database.SessionLocal()
            bw.processar_evento(db, evento(texto, **kw))
            db.close()

        def fala_tg(texto, chat="111"):
            db = database.SessionLocal()
            bt._processar(texto, chat, db)
            db.close()

        def nova(titulo, **extra):
            corpo = {"titulo": titulo, "tipo": "DIARIA", "categoria": "Pessoal",
                     "prioridade": "ALTA", "xp_recompensa": 60,
                     "moedas_recompensa": 5}
            corpo.update(extra)
            r = c.post(P + "/rotinas/", json=corpo, headers=A)
            assert r.status_code in (200, 201), r.text
            return r.json()["id"]

        def estado(rid):
            db = database.SessionLocal()
            e = db.query(database.ExecucaoDia).filter_by(
                rotina_id=rid, usuario_id=uid, data=hoje).first()
            st = e.status if e else None
            db.close()
            return st

        # ══════════════════════════════════════════════════════════════
        # 1 · A PORTA, E O VÍNCULO PELO MESMO CÓDIGO
        # ══════════════════════════════════════════════════════════════
        cx_wa.limpar()
        fala_wa("/hoje")
        ok("não está vinculada" in cx_wa.ultima(),
           "conversa de WhatsApp desconhecida nao recebe missao nenhuma")

        cod = c.post(P + "/bots/codigo/whatsapp", headers=A).json()["codigo"]
        cx_wa.limpar()
        fala_wa("/vincular " + cod)
        ok("vinculada" in cx_wa.ultima() and "❌" not in cx_wa.ultima(),
           "o MESMO codigo de seis digitos vincula o WhatsApp")

        db = database.SessionLocal()
        u = vinculo.por_origem(db, "whatsapp", JID)
        ok(u is not None and u.id == uid, "e o JID passa a ser do Arquiteto")
        db.close()

        # o Telegram do mesmo hunter, para a comparacao lado a lado
        cod_tg = c.post(P + "/bots/codigo/telegram", headers=A).json()["codigo"]
        fala_tg("/vincular " + cod_tg)

        # ══════════════════════════════════════════════════════════════
        # 2 · A PARIDADE — a bateria roda nos DOIS
        # ══════════════════════════════════════════════════════════════
        rid = nova("Banho Revigorante")
        c.get(P + "/dashboard/stats", headers=A)

        # `marca` e um pedaco que tem de aparecer na resposta dos dois.
        BATERIA = [
            ("/ajuda",      "Solo Routines"),
            ("/hoje",       "Banho Revigorante"),
            ("/pendentes",  "Banho Revigorante"),
            ("/status",     "XP"),
            ("/agora",      "curso"),
            ("/extrato",    "🧾"),
            ("/penitencia", "⛓️"),
            ("/portoes",    "🚪"),
            ("/rotinas",    "Banho Revigorante"),
            ("/conquistas", "onquista"),
        ]
        for cmd, marca in BATERIA:
            cx_tg.limpar(); cx_wa.limpar()
            fala_tg(cmd)
            fala_wa(cmd)
            tem_tg = marca.lower() in cx_tg.ultima().lower()
            tem_wa = marca.lower() in cx_wa.ultima().lower()
            ok(tem_tg and tem_wa,
               f"{cmd} responde igual nos dois canais")

        # E O COMANDO DESCONHECIDO TAMBEM TEM DE SER IGUAL: um canal que
        # ignora calado e outro que explica sao dois bots diferentes.
        cx_tg.limpar(); cx_wa.limpar()
        fala_tg("/inventado"); fala_wa("/inventado")
        ok("não reconhecido" in cx_tg.ultima() and "não reconhecido" in cx_wa.ultima(),
           "comando inexistente explica nos dois, em vez de sumir")

        # ══════════════════════════════════════════════════════════════
        # 3 · SEM BOTÃO, LISTA NUMERADA
        # ══════════════════════════════════════════════════════════════
        rid_b = nova("Banho de sol")           # prefixo compartilhado
        c.get(P + "/dashboard/stats", headers=A)

        cx_tg.limpar(); cx_wa.limpar()
        fala_tg("/ok Banho"); fala_wa("/ok Banho")

        ok(cx_tg.teclado(), "no Telegram a ambiguidade vira BOTAO")
        ok("Qual delas" in cx_wa.ultima(), "no WhatsApp ela tambem pergunta")
        ok("*1.*" in cx_wa.ultima() and "*2.*" in cx_wa.ultima(),
           "e as opcoes vem NUMERADAS, porque nao ha botao")
        ok("Responda com o número" in cx_wa.ultima(),
           "dizendo como responder — sem isso a lista e um beco")
        ok(estado(rid) == "PENDENTE" and estado(rid_b) == "PENDENTE",
           "e NENHUMA das duas foi concluida enquanto nao se escolhe")

        # O numero escolhe de verdade.
        cx_wa.limpar()
        fala_wa("1")
        ok(estado(rid) == "CONCLUIDA" or estado(rid_b) == "CONCLUIDA",
           "responder o numero executa a acao escolhida")

        # UMA ESCOLHA SE USA UMA VEZ. Repetir "1" nao pode repetir a acao.
        cx_wa.limpar()
        fala_wa("1")
        ok("não reconhecido" in cx_wa.ultima() or "❌" in cx_wa.ultima()
           or "⚠️" in cx_wa.ultima(),
           "responder o mesmo numero de novo nao repete a acao")

        # Numero fora da faixa nao estoura nem escolhe nada.
        cx_wa.limpar()
        fala_wa("/ok Banho")
        fala_wa("99")
        ok(cx_wa.enviadas, "numero fora da faixa responde algo, sem quebrar")

        # ══════════════════════════════════════════════════════════════
        # 4 · A EVOLUTION REENTREGA — e o /ok nao pode pagar duas vezes
        # ══════════════════════════════════════════════════════════════
        rid_c = nova("Fio Dental Rotineiro")
        c.get(P + "/dashboard/stats", headers=A)

        db = database.SessionLocal()
        antes = db.query(database.Usuario).filter_by(id=uid).first().xp_total
        db.close()

        MID = "mensagem-repetida-3x"
        cx_wa.limpar()
        for _ in range(3):
            fala_wa("/ok Fio Dental", mid=MID)

        ok(estado(rid_c) == "CONCLUIDA", "a missao foi concluida")
        db = database.SessionLocal()
        depois = db.query(database.Usuario).filter_by(id=uid).first().xp_total
        n = db.query(database.Execucao).filter_by(
            usuario_id=uid, rotina_id=rid_c, data_execucao=hoje).count()
        db.close()
        ok(n == 1, "e UMA vez so — tres entregas do mesmo key.id, um lancamento")
        ok(len(cx_wa.enviadas) == 1,
           "o bot tambem responde uma vez so, em vez de tres")
        ok(depois > antes, "o XP entrou (e entrou uma vez)")

        # ══════════════════════════════════════════════════════════════
        # 5 · O ECO DO PRÓPRIO APARELHO
        # ══════════════════════════════════════════════════════════════
        cx_wa.limpar()
        fala_wa("oi amor, compra pão na volta", from_me=True)
        ok(not cx_wa.enviadas,
           "conversa do hunter com OUTRA pessoa nao vira comando")

        cx_wa.limpar()
        fala_wa("/status", from_me=True)
        ok(cx_wa.enviadas and "XP" in cx_wa.ultima(),
           "mas um comando de verdade passa, mesmo marcado fromMe")

        # ══════════════════════════════════════════════════════════════
        # 6 · GRUPO NÃO É CONVERSA DE HUNTER
        # ══════════════════════════════════════════════════════════════
        cx_wa.limpar()
        fala_wa("/status", jid="1203630@g.us")
        ok(not cx_wa.enviadas,
           "o /status despeja XP, nivel e corrente — isso nao vai para grupo")

        # ══════════════════════════════════════════════════════════════
        # 7 · O CANAL PREFERIDO DOS AVISOS
        # ══════════════════════════════════════════════════════════════
        from motors import avisos, evolution

        db = database.SessionLocal()
        u = db.query(database.Usuario).filter_by(id=uid).first()
        pref = avisos.preferencia(db, u)
        pref.canal_avisos = "telegram"
        db.commit()
        db.close()

        guardado_tk, guardado_cfg = bt.BOT_TOKEN, evolution.configurado
        bt.BOT_TOKEN = "token-de-teste"
        evolution.configurado = lambda: True
        try:
            db = database.SessionLocal()
            u = db.query(database.Usuario).filter_by(id=uid).first()
            canais = [n for n, _ in bt._canais_de_aviso(db, u)]
            db.close()
            ok(canais == ["telegram"],
               "com os dois vinculados, o aviso sai SO pelo preferido")

            db = database.SessionLocal()
            u = db.query(database.Usuario).filter_by(id=uid).first()
            avisos.preferencia(db, u).canal_avisos = "whatsapp"
            db.commit()
            canais = [n for n, _ in bt._canais_de_aviso(db, u)]
            db.close()
            ok(canais == ["whatsapp"], "trocar a preferencia troca o canal")

            db = database.SessionLocal()
            u = db.query(database.Usuario).filter_by(id=uid).first()
            avisos.preferencia(db, u).canal_avisos = "ambos"
            db.commit()
            canais = sorted(n for n, _ in bt._canais_de_aviso(db, u))
            db.close()
            ok(canais == ["telegram", "whatsapp"], "'ambos' manda nos dois")

            # A PREFERENCIA NAO VALE CONTRA A REALIDADE: escolher um canal
            # que nao existe nao pode resultar em silencio total.
            db = database.SessionLocal()
            u = db.query(database.Usuario).filter_by(id=uid).first()
            avisos.preferencia(db, u).canal_avisos = "whatsapp"
            jid_guardado = u.whatsapp_jid
            u.whatsapp_jid = None
            db.commit()
            canais = [n for n, _ in bt._canais_de_aviso(db, u)]
            u.whatsapp_jid = jid_guardado
            db.commit()
            db.close()
            ok(canais == ["telegram"],
               "preferir um canal inexistente cai no que existe, "
               "em vez de calar o Sistema")
        finally:
            bt.BOT_TOKEN = guardado_tk
            evolution.configurado = guardado_cfg

        # ══════════════════════════════════════════════════════════════
        # 8 · DESVINCULAR FECHA A PORTA
        # ══════════════════════════════════════════════════════════════
        cx_wa.limpar()
        fala_wa("/desvincular")
        ok("desvinculada" in cx_wa.ultima().lower(), "/desvincular responde")

        cx_wa.limpar()
        fala_wa("/hoje")
        ok("não está vinculada" in cx_wa.ultima(),
           "e a conversa volta a ser tratada como desconhecida")

        print("\n=== WHATSAPP OK ===\n")


if __name__ == "__main__":
    main_teste()
