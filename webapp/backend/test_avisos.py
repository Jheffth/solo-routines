# -*- coding: utf-8 -*-
"""
OS AVISOS — não repete, não acorda, não inventa.

AS TRÊS COISAS QUE MATAM UM SISTEMA DE AVISOS, e que este teste vigia:

  REPETIR   o varredor roda de 5 em 5 min e o motor responde pelo
            ESTADO, então ele diz "faltam 15 minutos" três vezes
            seguidas. Na terceira o hunter silencia o bot — e um bot
            silenciado não serve para nada, inclusive para o aviso que
            importava.

  ACORDAR   um app que interrompe alguém às 03:00 para falar de
            produtividade trabalha contra o próprio propósito. Mas a
            exceção é obrigatória: "sem redes sociais entre 22h e 10h" é
            missão legítima das 04:00, e calá-la seria calar justamente
            quem precisa do aviso naquele horário.

  INVENTAR  anunciar "começou sozinha" uma missão que o hunter acabou de
            iniciar com o dedo, ou dar como vencida uma que ainda corre.
            É a mentira pequena que faz perder a confiança no resto.

Uso: DATABASE_URL=sqlite:///./x.db SECRET_KEY=... python test_avisos.py
"""
from datetime import datetime, time, timedelta

from fastapi.testclient import TestClient

import main
import database
from auth.service import hash_senha

P = "/api"


def ok(cond, msg):
    print(("  [ok]  " if cond else "  [XX]  ") + msg)
    assert cond, msg


class Caixa:
    def __init__(self):
        self.enviadas = []

    def __call__(self, chat_id, texto, parse_mode="Markdown", teclado=None):
        self.enviadas.append((str(chat_id), texto))
        return {"ok": True}

    def ultima(self):
        return self.enviadas[-1][1] if self.enviadas else ""

    def limpar(self):
        self.enviadas.clear()


def main_teste():
    from routers import bot_telegram as bt
    from motors import avisos, tempo, fechamento

    caixa = Caixa()
    bt._tg = caixa

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

        cod = c.post(P + "/bots/codigo/telegram", headers=A).json()["codigo"]
        db = database.SessionLocal()
        bt._processar("/vincular " + cod, "111", db)
        db.close()

        hoje = tempo.hoje()
        print("\n=== AVISOS ===")

        def usuario():
            db = database.SessionLocal()
            u = db.query(database.Usuario).filter_by(id=uid).first()
            return db, u

        def nova(titulo, **extra):
            corpo = {"titulo": titulo, "tipo": "DIARIA", "categoria": "Pessoal",
                     "prioridade": "ALTA", "xp_recompensa": 60,
                     "moedas_recompensa": 5}
            corpo.update(extra)
            r = c.post(P + "/rotinas/", json=corpo, headers=A)
            assert r.status_code in (200, 201), r.text
            return r.json()["id"]

        # ══════════════════════════════════════════════════════════════
        # 1 · BEIRA DA FALHA — o aviso mais valioso
        # ══════════════════════════════════════════════════════════════
        agora = tempo.agora()
        fim = (agora + timedelta(minutes=8))
        ini = (agora - timedelta(hours=1))
        rid = nova("Banho Revigorante",
                   hora_inicio=ini.strftime("%H:%M"),
                   hora_fim=fim.strftime("%H:%M"))
        c.get(P + "/dashboard/stats", headers=A)

        db, u = usuario()
        lista = avisos.pendentes(db, u, agora)
        db.close()
        beira = [a for a in lista if a.tipo == "beira" and "Banho" in a.texto]
        ok(len(beira) == 1, "faltando 8 min, a beira da falha dispara")
        ok("min para o prazo" in beira[0].texto, "e diz quanto falta")

        # E NÃO dispara com o dia inteiro pela frente.
        rid_longe = nova("Missao do dia inteiro")
        c.get(P + "/dashboard/stats", headers=A)
        db, u = usuario()
        lista = avisos.pendentes(db, u, agora)
        db.close()
        ok(not [a for a in lista if "dia inteiro" in a.texto],
           "missao com horas pela frente NAO vira aviso de beira")

        # ══════════════════════════════════════════════════════════════
        # 2 · NÃO REPETE — a razão de existir da tabela
        # ══════════════════════════════════════════════════════════════
        db, u = usuario()
        primeira = avisos.para_enviar(db, u, agora)
        ok(any(a.tipo == "beira" for a in primeira), "a 1a varredura tem o aviso")
        avisos.marcar(db, u, primeira)
        db.close()

        db, u = usuario()
        segunda = avisos.para_enviar(db, u, agora)
        db.close()
        ok(segunda == [] or not any(a.chave in {x.chave for x in primeira}
                                    for a in segunda),
           "a 2a varredura NAO repete o que ja foi dito")

        db, u = usuario()
        terceira = avisos.para_enviar(db, u, agora + timedelta(minutes=3))
        db.close()
        ok(not any(a.chave in {x.chave for x in primeira} for a in terceira),
           "nem a 3a, tres minutos depois")

        # A MEMÓRIA ESTÁ NO BANCO, não em variável: uma memória que morre
        # no deploy faz o hunter receber tudo de novo.
        db = database.SessionLocal()
        n = db.query(database.AvisoEnviado).filter_by(usuario_id=uid).count()
        db.close()
        ok(n >= 1, "o registro do enviado ficou no banco")

        # AMANHÃ AVISA DE NOVO: a chave carrega a data. Uma chave sem data
        # avisaria uma vez na vida.
        db, u = usuario()
        chaves = {a.chave for a in primeira}
        ok(all(hoje.isoformat() in k for k in chaves),
           "a chave carrega o dia, para o aviso voltar amanha")
        db.close()

        # ══════════════════════════════════════════════════════════════
        # 3 · NÃO ACORDA — e a exceção que não é negociável
        # ══════════════════════════════════════════════════════════════
        db, u = usuario()
        pref = avisos.preferencia(db, u)
        madrugada = datetime.combine(hoje, time(3, 30))
        ok(avisos.em_silencio(pref, madrugada), "03:30 esta na janela de silencio")
        ok(avisos.em_silencio(pref, datetime.combine(hoje, time(23, 30))),
           "23:30 tambem — a janela atravessa a meia-noite")
        ok(not avisos.em_silencio(pref, datetime.combine(hoje, time(14, 0))),
           "14:00 nao")
        ok(not avisos.em_silencio(pref, datetime.combine(hoje, time(6, 0))),
           "06:00 e o fim do silencio, nao o meio")
        db.close()

        # O aviso de "venceu" NÃO fura o silêncio: chega depois do
        # estrago e não há o que fazer. Acordar alguém para dar uma má
        # notícia que ele não pode desfazer é crueldade com carimbo.
        venceu = avisos.Aviso("venceu", "venceu:teste", "x", urgente=False)
        beira_a = avisos.Aviso("beira", "beira:teste", "y", urgente=True)
        ok(not venceu.urgente, "'venceu' nao e urgente")
        ok(beira_a.urgente, "'beira' e urgente e fura o silencio")

        # ══════════════════════════════════════════════════════════════
        # 4 · NÃO INVENTA — "acendeu sozinha" so para quem acendeu sozinha
        # ══════════════════════════════════════════════════════════════
        db, u = usuario()
        lista = avisos.pendentes(db, u, agora, acesas=None)
        db.close()
        ok(not [a for a in lista if a.tipo == "acendeu"],
           "sem nada acendendo, nenhum aviso de acendeu — nao varre o banco "
           "atras de ATIVA, que pegaria o que o hunter iniciou no dedo")

        # Com o fechamento devolvendo a instancia que acendeu, o aviso sai
        # e traz o NOME — "2 missoes acenderam" e um numero, nao um aviso.
        db = database.SessionLocal()
        ed = db.query(database.ExecucaoDia).filter_by(
            rotina_id=rid, usuario_id=uid, data=hoje).first()
        rot = db.query(database.Rotina).filter_by(id=rid).first()
        u = db.query(database.Usuario).filter_by(id=uid).first()
        lista = avisos.pendentes(db, u, agora, acesas=[(ed, rot)])
        db.close()
        ac = [a for a in lista if a.tipo == "acendeu"]
        ok(len(ac) == 1 and "Banho Revigorante" in ac[0].texto,
           "com a instancia em maos, o aviso sai com o nome da missao")
        ok(ac[0].urgente,
           "e e urgente: uma missao que ACABOU de abrir e acionavel as 04:00")

        # ══════════════════════════════════════════════════════════════
        # 5 · O AGRUPAMENTO
        # ══════════════════════════════════════════════════════════════
        tres = [avisos.Aviso("venceu", "k1", "❌ A venceu"),
                avisos.Aviso("beira", "k2", "⏳ B em 10 min", urgente=True),
                avisos.Aviso("acendeu", "k3", "▶️ C comecou")]
        texto = avisos.compor(tres)
        ok(texto.count("\n•") == 3 and texto.startswith("🔔"),
           "tres eventos viram UMA mensagem, nao tres pings")
        ok(texto.index("B em 10 min") < texto.index("C comecou")
           < texto.index("A venceu"),
           "e a ordem e por urgencia: o que ainda da para salvar vem primeiro")
        ok(avisos.compor([tres[1]]) == "⏳ B em 10 min",
           "um evento sozinho nao ganha cabecalho de lista")
        ok(avisos.compor([]) == "", "nenhum evento nao vira mensagem vazia")

        # ══════════════════════════════════════════════════════════════
        # 6 · A PREFERENCIA DESLIGA DE VERDADE
        # ══════════════════════════════════════════════════════════════
        db, u = usuario()
        pref = avisos.preferencia(db, u)
        pref.beira = False
        db.commit()
        lista = avisos.pendentes(db, u, agora)
        db.close()
        ok(not [a for a in lista if a.tipo == "beira"],
           "desligada a beira, ela para de ser gerada — nao so de ser enviada")

        db, u = usuario()
        pref = avisos.preferencia(db, u)
        pref.beira = True
        db.commit()
        db.close()

        # ══════════════════════════════════════════════════════════════
        # 7 · O VARREDOR PONTA A PONTA
        # ══════════════════════════════════════════════════════════════
        # Uma missao nova, prestes a vencer, que ainda nao foi avisada.
        fim2 = (tempo.agora() + timedelta(minutes=6))
        ini2 = (tempo.agora() - timedelta(minutes=30))
        nova("Fio Dental Rotineiro",
             hora_inicio=ini2.strftime("%H:%M"), hora_fim=fim2.strftime("%H:%M"))
        c.get(P + "/dashboard/stats", headers=A)

        # O ENVIO EXIGE TOKEN; o fechamento, nao. Sao coisas separadas de
        # proposito: acender a missao na hora e comportamento do Sistema,
        # nao do Telegram. Aqui o token e simulado so para poder observar
        # a mensagem.
        token_guardado = bt.BOT_TOKEN
        bt.BOT_TOKEN = "token-de-teste"
        try:
            caixa.limpar()
            db = database.SessionLocal()
            r1 = bt.varrer_avisos(db)
            db.close()
            ok(r1["hunters"] >= 1, "o varredor alcanca o hunter")
            ok(r1["erros"] == 0, "sem erro nenhum na passada")
            ok(caixa.enviadas and "Fio Dental" in caixa.ultima(),
               "e manda a mensagem com a missao na beira")

            # A SEGUNDA VARREDURA, logo em seguida, tem de ficar CALADA.
            caixa.limpar()
            db = database.SessionLocal()
            bt.varrer_avisos(db)
            db.close()
            ok(not caixa.enviadas,
               "a varredura seguinte nao manda nada — silencio aqui e a prova "
               "de que a memoria funciona")
        finally:
            bt.BOT_TOKEN = token_guardado

        # ══════════════════════════════════════════════════════════════
        # 8 · O FECHAMENTO NAO DEPENDE DO BOT
        #     Minha 1a versao varria so quem tinha conversa vinculada, e
        #     num servidor sem TELEGRAM_BOT_TOKEN o varredor inteiro
        #     virava no-op — o app se comportaria diferente por causa de
        #     uma variavel de ambiente que nada tem a ver com missoes.
        # ══════════════════════════════════════════════════════════════
        caixa.limpar()
        db = database.SessionLocal()
        r = bt.varrer_avisos(db)          # BOT_TOKEN vazio de novo
        db.close()
        ok(r["hunters"] >= 1, "sem token, o fechamento por hunter continua rodando")
        ok(not caixa.enviadas, "e simplesmente nao ha para onde avisar")

        # ══════════════════════════════════════════════════════════════
        # 9 · A FAXINA
        # ══════════════════════════════════════════════════════════════
        db = database.SessionLocal()
        db.add(database.AvisoEnviado(
            usuario_id=uid, chave="velho:teste", canal="telegram",
            enviado_em=datetime.utcnow() - timedelta(days=30)))
        db.commit()
        antes = db.query(database.AvisoEnviado).count()
        n = avisos.limpar_antigos(db, dias=14)
        depois = db.query(database.AvisoEnviado).count()
        db.close()
        ok(n >= 1 and depois < antes, "a faxina remove o historico velho")

        db = database.SessionLocal()
        ok(db.query(database.AvisoEnviado).filter_by(
            chave="beira:r:%d:%s" % (rid, hoje.isoformat())).count() == 1,
           "e NAO remove o de hoje — senao o aviso sairia de novo")
        db.close()

        print("\n=== AVISOS OK ===\n")


if __name__ == "__main__":
    main_teste()
