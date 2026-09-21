# -*- coding: utf-8 -*-
"""
A CONVERSA INTEIRA — botões, ciclo do dia, especiais e leitura.

O QUE MUDA COM OS BOTÕES, e por que isso é uma questão de segurança

Digitar um título é inseguro por ambiguidade: o `/ok` antigo pegava o
PRIMEIRO que casasse e podia concluir a missão errada. Tocar num botão é
inseguro por outro motivo, mais sério: o `callback_data` viaja no
cliente e volta como o cliente quiser. Nada impede alguém de responder
`ok|r|999` e tentar concluir a rotina de outro hunter.

Por isso o teste tem duas colunas de preocupação:

  · a ambiguidade nunca escolhe sozinha (o bot lista e pergunta);
  · todo alvo é reconferido contra `usuario_id`, e o botão forjado ou o
    botão velho de ontem batem numa recusa, nunca num segundo crédito.

Uso: DATABASE_URL=sqlite:///./x.db SECRET_KEY=... python test_bot_conversa.py
"""
from datetime import timedelta

from fastapi.testclient import TestClient

import main
import database
from auth.service import hash_senha

P = "/api"


def ok(cond, msg):
    print(("  [ok]  " if cond else "  [XX]  ") + msg)
    assert cond, msg


class Caixa:
    """O Telegram falso — guarda texto, teclado e o que foi respondido."""

    def __init__(self):
        self.enviadas, self.teclados = [], []
        self.toques, self.edicoes = [], []

    def enviar(self, chat_id, texto, parse_mode="Markdown", teclado=None):
        self.enviadas.append((str(chat_id), texto))
        self.teclados.append(teclado or [])

    def editar(self, chat_id, message_id, texto, teclado=None):
        self.edicoes.append((str(chat_id), message_id, texto, teclado or []))

    def responder(self, cb_id, texto="", alerta=False):
        self.toques.append((texto, bool(alerta)))

    # ── leitura ──
    def ultima(self, chat=None):
        for c, t in reversed(self.enviadas):
            if chat is None or c == str(chat):
                return t
        return ""

    def teclado(self):
        return self.teclados[-1] if self.teclados else []

    def dados_dos_botoes(self):
        return [b.get("callback_data") for linha in self.teclado() for b in linha]

    def ultimo_toque(self):
        return self.toques[-1] if self.toques else ("", False)

    def limpar(self):
        for l in (self.enviadas, self.teclados, self.toques, self.edicoes):
            l.clear()


def main_teste():
    from routers import bot_telegram as bt
    from motors import tempo

    caixa = Caixa()
    bt._tg = caixa.enviar
    bt._editar = caixa.editar
    bt._responder_toque = caixa.responder

    with TestClient(main.app) as c:
        db = database.SessionLocal()
        arq = db.query(database.Usuario).filter_by(nivel_acesso="Arquiteto").first()
        arq.senha_hash = hash_senha("admin123")
        login_arq, uid = arq.login, arq.id
        db.commit()
        db.close()

        def tok(l, s):
            return {"Authorization": "Bearer " + c.post(
                P + "/auth/login", data={"username": l, "password": s}
            ).json()["access_token"]}

        A = tok(login_arq, "admin123")
        cod = c.post(P + "/convites/", json={"nivel_acesso": "User", "badges": []},
                     headers=A).json()["convites"][0]["codigo"]
        c.post(P + "/auth/registro", json={"nome": "Kaio", "login": "kaio",
               "senha": "senha123", "email": "k@x.com", "codigo": cod})
        K = tok("kaio", "senha123")

        def vincular(headers, chat):
            cd = c.post(P + "/bots/codigo/telegram", headers=headers).json()["codigo"]
            db = database.SessionLocal()
            bt._processar("/vincular " + cd, chat, db)
            db.close()

        vincular(A, "111")          # Arquiteto
        vincular(K, "222")          # Kaio

        hoje = tempo.hoje()
        print("\n=== A CONVERSA DO BOT ===")

        def nova(titulo, headers=A, **extra):
            corpo = {"titulo": titulo, "tipo": "DIARIA", "categoria": "Pessoal",
                     "prioridade": "ALTA", "xp_recompensa": 60,
                     "moedas_recompensa": 5}
            corpo.update(extra)
            r = c.post(P + "/rotinas/", json=corpo, headers=headers)
            assert r.status_code in (200, 201), r.text
            return r.json()["id"]

        def estado(rid, dono=None):
            db = database.SessionLocal()
            e = db.query(database.ExecucaoDia).filter_by(
                rotina_id=rid, usuario_id=dono or uid, data=hoje).first()
            st = e.status if e else None
            db.close()
            return st

        def fala(texto, chat="111"):
            db = database.SessionLocal()
            bt._processar(texto, chat, db)
            db.close()

        def toca(dados, chat="111", message_id=7):
            db = database.SessionLocal()
            bt._tocou({"id": "cb1", "data": dados,
                       "message": {"message_id": message_id,
                                   "chat": {"id": chat}}}, db)
            db.close()

        rid_a = nova("Acordar as 06:00")
        rid_b = nova("Acordar bem disposto")     # prefixo igual de proposito
        c.get(P + "/dashboard/stats", headers=A)

        # ══════════════════════════════════════════════════════════════
        # 1 · A LISTA VEM COM BOTÕES
        # ══════════════════════════════════════════════════════════════
        caixa.limpar()
        fala("/hoje")
        dados = caixa.dados_dos_botoes()
        ok(any(d.startswith("ini|r|") for d in dados), "/hoje traz botao de iniciar")
        ok(any(d.startswith("ok|r|") for d in dados), "e botao de concluir")
        ok("nada" in dados,
           "com o rotulo da missao numa linha propria, para nao confundir alvos")
        ok(not any(d.startswith("reer|") for d in dados),
           "e NAO traz reerguer numa missao que nem fracassou")

        # ══════════════════════════════════════════════════════════════
        # 2 · A AMBIGUIDADE NUNCA ESCOLHE SOZINHA
        #     Era assim que o /ok antigo concluia a missao errada.
        # ══════════════════════════════════════════════════════════════
        caixa.limpar()
        fala("/ok Acordar")
        ok("Qual delas" in caixa.ultima("111"), "duas casaram: o bot pergunta")
        ok(estado(rid_a) == "PENDENTE" and estado(rid_b) == "PENDENTE",
           "e NAO concluiu nenhuma das duas enquanto nao se escolhe")
        escolhas = caixa.dados_dos_botoes()
        ok(len(escolhas) == 2 and all(d.startswith("ok|r|") for d in escolhas),
           "o menu oferece as duas, ja com a acao certa")

        # Titulo exato vence o prefixo: quem digitou o nome inteiro nao
        # merece um menu.
        caixa.limpar()
        fala("/iniciar Acordar as 06:00")
        ok(estado(rid_a) == "ATIVA", "titulo exato age direto, sem menu")
        ok(estado(rid_b) == "PENDENTE", "e nao encosta na irma de prefixo")

        # ══════════════════════════════════════════════════════════════
        # 3 · O CICLO DO DIA
        # ══════════════════════════════════════════════════════════════
        caixa.limpar()
        fala("/agora")
        ok("Acordar as 06:00" in caixa.ultima("111"), "/agora mostra o que esta em curso")

        fala("/pausar Acordar as 06:00")
        ok(estado(rid_a) == "PAUSADA", "/pausar para o cronometro")

        caixa.limpar()
        fala("/hoje")
        ok(any(d.startswith("ret|r|") for d in caixa.dados_dos_botoes()),
           "pausada oferece RETOMAR, nao INICIAR")

        fala("/retomar Acordar as 06:00")
        ok(estado(rid_a) == "ATIVA", "/retomar volta a correr")

        caixa.limpar()
        toca(f"ok|r|{rid_a}")
        ok(estado(rid_a) == "CONCLUIDA", "o toque no botao conclui de verdade")
        ok("XP" in caixa.ultimo_toque()[0], "e o aviso do topo diz o que rendeu")
        ok(caixa.edicoes, "a lista se redesenha no lugar, em vez de empilhar")

        # ══════════════════════════════════════════════════════════════
        # 4 · O BOTÃO FORJADO — a ameaça real do teclado
        # ══════════════════════════════════════════════════════════════
        rid_k = nova("Missao do Kaio", headers=K)
        c.get(P + "/dashboard/stats", headers=K)
        db = database.SessionLocal()
        kaio = db.query(database.Usuario).filter_by(login="kaio").first()
        kid = kaio.id
        db.close()
        ok(estado(rid_k, kid) == "PENDENTE", "o Kaio tem a missao dele em aberto")

        caixa.limpar()
        toca(f"ok|r|{rid_k}", chat="111")        # o Arquiteto tocando na do Kaio
        ok(estado(rid_k, kid) == "PENDENTE",
           "callback_data forjado NAO alcanca a missao de outro hunter")
        texto, alerta = caixa.ultimo_toque()
        ok(alerta, "e o toque recebe uma recusa visivel")
        ok("não está mais disponível" in texto,
           "sem confirmar que o id existe — nao e 'nao e sua', e 'nao ha'")

        # Botão de uma conversa não vinculada.
        caixa.limpar()
        toca(f"ok|r|{rid_a}", chat="999")
        ok("não está vinculada" in caixa.ultimo_toque()[0],
           "conversa desconhecida nao age por botao tampouco")

        # Botão velho, de missão já concluída: avisa, não credita de novo.
        caixa.limpar()
        db = database.SessionLocal()
        u = db.query(database.Usuario).filter_by(id=uid).first()
        xp_antes = u.xp_total
        db.close()
        toca(f"ok|r|{rid_a}")
        db = database.SessionLocal()
        u = db.query(database.Usuario).filter_by(id=uid).first()
        ok(u.xp_total == xp_antes, "botao velho NAO paga a missao duas vezes")
        db.close()
        ok(caixa.ultimo_toque()[1], "e o hunter e avisado, em vez de ficar no escuro")

        # O rotulo nao faz nada, mas RESPONDE — senao a ampulheta gira.
        caixa.limpar()
        toca("nada")
        ok(len(caixa.toques) == 1 and caixa.ultimo_toque()[0] == "",
           "o rotulo responde ao Telegram sem fazer nada")

        # ══════════════════════════════════════════════════════════════
        # 5 · /pendentes é o recorte do que ainda cobra
        # ══════════════════════════════════════════════════════════════
        caixa.limpar()
        fala("/pendentes")
        ok("Acordar as 06:00" not in caixa.ultima("111"),
           "a concluida sai de /pendentes")
        ok("Acordar bem disposto" in caixa.ultima("111"),
           "e a que falta continua")

        # ══════════════════════════════════════════════════════════════
        # 6 · A META PELO CHAT
        # ══════════════════════════════════════════════════════════════
        rid_m = nova("Conseguir no turno", natureza="META", meta_alvo=100,
                     meta_modo="SOMA", meta_especie="DINHEIRO")
        c.get(P + "/dashboard/stats", headers=A)

        caixa.limpar()
        fala("/somar Conseguir no turno 40")
        db = database.SessionLocal()
        e = db.query(database.ExecucaoDia).filter_by(
            rotina_id=rid_m, usuario_id=uid, data=hoje).first()
        atual = float(getattr(e, "meta_atual", 0) or 0)
        db.close()
        ok(atual == 40, "/somar registra o valor na meta do dia")
        ok(estado(rid_m) == "PENDENTE", "e 40 de 100 nao fecha a missao")

        # Virgula decimal: e como se escreve em portugues.
        fala("/somar Conseguir no turno 12,50")
        db = database.SessionLocal()
        e = db.query(database.ExecucaoDia).filter_by(
            rotina_id=rid_m, usuario_id=uid, data=hoje).first()
        atual = float(getattr(e, "meta_atual", 0) or 0)
        db.close()
        ok(abs(atual - 52.5) < 0.01, "aceita 12,50 com virgula")

        caixa.limpar()
        fala("/somar Conseguir no turno abc")
        ok("não entendi" in caixa.ultima("111").lower(),
           "e recusa o que nao e numero, em vez de somar zero")

        # Bater o alvo fecha a missao — mas quem fecha e o motor, nao o bot.
        fala("/somar Conseguir no turno 50")
        ok(estado(rid_m) == "CONCLUIDA", "alcancar o alvo conclui a missao")

        # ══════════════════════════════════════════════════════════════
        # 7 · A LEITURA NÃO MEXE EM NADA
        # ══════════════════════════════════════════════════════════════
        # O marcador é o emoji, e não a palavra: o texto muda conforme o
        # estado ("Nenhum portão abre hoje" no singular, a lista no
        # plural), e casar pela palavra faria o teste depender da redação.
        for cmd, esperado in (("/extrato", "🧾"),
                              ("/penitencia", "⛓️"),
                              ("/portoes", "🚪")):
            caixa.limpar()
            fala(cmd)
            ok(esperado.lower() in caixa.ultima("111").lower(),
               f"{cmd} responde")
            ok(not caixa.edicoes, f"{cmd} nao altera nada")

        # ══════════════════════════════════════════════════════════════
        # 8 · /desfazer
        # ══════════════════════════════════════════════════════════════
        rid_d = nova("Missao para desfazer")
        c.get(P + "/dashboard/stats", headers=A)
        fala("/iniciar Missao para desfazer")
        ok(estado(rid_d) == "ATIVA", "iniciada")

        # A LARGADA NAO SE DESFAZ — e o bot nao finge que desfez.
        # O Sistema recusa desistencia de rotina ("uma missao termina
        # cumprida, vencida pelo tempo, ou extinta pelo Arquiteto"), e o
        # `/desfazer` respeita isso: pausa e diz o que realmente fez.
        caixa.limpar()
        fala("/desfazer")
        ok(estado(rid_d) == "PAUSADA", "/desfazer da largada pausa a missao")
        texto = caixa.ultima("111")
        ok("pausada" in texto.lower(), "e diz que pausou")
        ok("desistência" in texto, "explicando por que a largada em si fica")

        # Pausar, esse sim, se desfaz.
        caixa.limpar()
        fala("/retomar Missao para desfazer")
        fala("/pausar Missao para desfazer")
        fala("/desfazer")
        ok(estado(rid_d) == "ATIVA", "/desfazer de uma pausa devolve o cronometro")

        # Conclusao NAO se desfaz por aqui, e o bot explica por que.
        caixa.limpar()
        fala("/ok Acordar bem disposto")
        fala("/desfazer")
        texto = caixa.ultima("111")
        ok("Extrato" in texto,
           "desfazer conclusao explica que o lancamento ja existe")
        ok("XP" in texto, "dizendo quanto rendeu, para a decisao ser informada")
        ok(estado(rid_b) == "CONCLUIDA",
           "e NAO reabre por fora — nada de setima verdade sobre a economia")

        # ══════════════════════════════════════════════════════════════
        # 9 · A AJUDA LEVA AO CAMINHO SEGURO
        # ══════════════════════════════════════════════════════════════
        caixa.limpar()
        fala("/ajuda")
        aj = caixa.ultima("111")
        ok("toque nos botões" in aj, "a ajuda empurra para os botoes primeiro")
        for cmd in ("/iniciar", "/agora", "/pendentes", "/somar", "/confessar",
                    "/reerguer", "/desfazer", "/extrato", "/portoes"):
            ok(cmd in aj, f"{cmd} esta documentado")

        print("\n=== A CONVERSA OK ===\n")


if __name__ == "__main__":
    main_teste()
