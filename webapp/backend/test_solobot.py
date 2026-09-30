# -*- coding: utf-8 -*-
"""
A PONTE COM O SOLO BOT — conectar, resgatar, conversar, agir e avisar.

O Solo Bot é o bot único de todos os sistemas Solo. Aqui se prova que:
  · o código de conexão nasce só de sessão autenticada, vale UMA vez, e
    ninguém sem o token de serviço consegue trocá-lo;
  · a conversa que chega pelo Solo Bot é a MESMA do Telegram (conversa.py),
    com o hunter fixo — e o botão forjado para a missão de outro hunter
    continua batendo numa recusa;
  · aviso que o Solo Bot entrega não sai de novo pelo chat antigo.

Uso: DATABASE_URL=sqlite:///./x.db SECRET_KEY=... python test_solobot.py
"""
import os
from urllib.parse import parse_qs, urlparse

os.environ["BOT_SERVICE_TOKEN"] = "servico-teste"
os.environ["SOLO_BOT_URL"] = "https://solobot.teste"
os.environ["SOLO_BOT_APP"] = "rot"

from fastapi.testclient import TestClient  # noqa: E402

import database  # noqa: E402
import main  # noqa: E402
import solobot_ponte  # noqa: E402
from auth.service import hash_senha  # noqa: E402

P = "/api"
H = {"X-Solo-Token": "servico-teste"}


def ok(cond, msg):
    print(("  [ok]  " if cond else "  [XX]  ") + msg)
    assert cond, msg


def main_teste():
    from motors import tempo
    from routers import bot_telegram as bt

    with TestClient(main.app) as c:
        db = database.SessionLocal()
        arq = db.query(database.Usuario).filter_by(nivel_acesso="Arquiteto").first()
        arq.senha_hash = hash_senha("admin123")
        login_arq, uid = arq.login, arq.id
        db.commit()
        db.close()

        def tok(l, s):
            return {"Authorization": "Bearer " + c.post(
                P + "/auth/login", data={"username": l, "password": s}).json()["access_token"]}

        A = tok(login_arq, "admin123")
        cod = c.post(P + "/convites/", json={"nivel_acesso": "User", "badges": []},
                     headers=A).json()["convites"][0]["codigo"]
        c.post(P + "/auth/registro", json={"nome": "Kaio", "login": "kaio", "senha": "senha123",
                                           "email": "k@x.com", "codigo": cod})
        K = tok("kaio", "senha123")

        print("\n=== A PONTE COM O SOLO BOT ===")

        # ── 1 · conectar e resgatar ────────────────────────────────────
        ok(c.post(P + "/solobot/conectar").status_code == 401, "conectar exige sessao")
        url = c.post(P + "/solobot/conectar", headers=A).json()["url"]
        ok(url.startswith("https://solobot.teste/conectar?app=rot&codigo="), "a URL leva ao Solo Bot")
        codigo = parse_qs(urlparse(url).query)["codigo"][0]

        ok(c.post("/interno/bot/resgatar", json={"codigo": codigo}).status_code == 403,
           "sem token de servico: 403")
        r = c.post("/interno/bot/resgatar", headers=H, json={"codigo": codigo})
        ok(r.status_code == 200 and r.json()["usuario_id"] == str(uid), "com token: devolve o hunter")
        ok(c.post("/interno/bot/resgatar", headers=H, json={"codigo": codigo}).status_code == 404,
           "o mesmo codigo nao vale duas vezes")

        kaio_id = int(parse_qs(urlparse(c.post(P + "/solobot/conectar", headers=K).json()["url"])
                               .query)["codigo"][0].split(".")[0])
        falso = f"{kaio_id}.{codigo.split('.', 1)[1]}"
        ok(c.post("/interno/bot/resgatar", headers=H, json={"codigo": falso}).status_code == 404,
           "trocar o usuario no codigo quebra a assinatura")

        # ── 2 · a conversa real, com o hunter fixo ─────────────────────
        def nova(titulo, headers):
            r = c.post(P + "/rotinas/", json={"titulo": titulo, "tipo": "DIARIA", "categoria": "Pessoal",
                                              "prioridade": "ALTA", "xp_recompensa": 60,
                                              "moedas_recompensa": 5}, headers=headers)
            assert r.status_code in (200, 201), r.text
            return r.json()["id"]

        rid = nova("Leitura do Monarca", A)
        rid_kaio = nova("Treino do Kaio", K)

        def estado(r_id, dono):
            db = database.SessionLocal()
            e = db.query(database.ExecucaoDia).filter_by(rotina_id=r_id, usuario_id=dono,
                                                         data=tempo.hoje()).first()
            st = e.status if e else None
            db.close()
            return st

        corpo = {"usuario_id": str(uid), "canal": "whatsapp", "origem": "solo:1:whatsapp"}
        r = c.post("/interno/bot/mensagem", headers=H, json={**corpo, "texto": "/hoje"}).json()
        dados = [a["dados"] for m in r["mensagens"] for g in m["opcoes"] for a in g["acoes"]]
        ok(any(d == f"ok|r|{rid}" for d in dados), "/hoje traz o botao de concluir da missao")
        ok(not any(d.endswith(f"|r|{rid_kaio}") for d in dados), "e nenhuma missao do Kaio")

        r = c.post("/interno/bot/acao", headers=H, json={**corpo, "dados": f"ok|r|{rid_kaio}"}).json()
        ok(r["mensagens"][0]["texto"].startswith("⚠️"), "botao forjado para a missao do Kaio: recusa")
        ok(estado(rid_kaio, kaio_id) != "CONCLUIDA", "e a missao dele continua intacta")

        r = c.post("/interno/bot/acao", headers=H, json={**corpo, "dados": f"ok|r|{rid}"}).json()
        ok(estado(rid, uid) == "CONCLUIDA", "o toque pelo Solo Bot conclui de verdade")
        ok(bool(r.get("curta")), "e devolve a frase curta para o toast do Telegram")

        r = c.post("/interno/bot/mensagem", headers=H, json={**corpo, "texto": "/desvincular"}).json()
        ok("painel do Solo Bot" in r["mensagens"][0]["texto"], "/desvincular aponta para o painel")

        db = database.SessionLocal()
        u = db.get(database.Usuario, kaio_id)
        u.ativo = False
        db.commit()
        db.close()
        r = c.post("/interno/bot/mensagem", headers=H,
                   json={"usuario_id": str(kaio_id), "texto": "/hoje"}).json()
        ok(r.get("desvinculado") is True, "hunter inativo: o Solo Bot desfaz o vinculo")

        # ── 3 · o manifesto e o bot não se desencontram ──────────────
        import json
        import re
        from motors import conversa
        with open(solobot_ponte.MANIFESTO, encoding="utf-8") as f:
            man = json.load(f)
        ok(re.fullmatch(r"\d{4}\.\d{2}\.\d{2}(\.\d+)?", man["versao"]) is not None,
           "versao do manifesto no formato AAAA.MM.DD")
        nomes = [cmd["comando"] for cmd in man["comandos"]]
        ok(len(nomes) == len(set(nomes)), "nenhum comando repetido no manifesto")

        mortos = []
        for nome in nomes:
            r = c.post("/interno/bot/mensagem", headers=H, json={**corpo, "texto": nome}).json()
            if any("não reconhecido" in m["texto"] for m in r["mensagens"]):
                mortos.append(nome)
        ok(not mortos, f"todo comando do manifesto existe no bot (mortos: {mortos})")

        ajuda = c.post("/interno/bot/mensagem", headers=H,
                       json={**corpo, "texto": "/ajuda"}).json()["mensagens"][0]["texto"]
        na_ajuda = set(re.findall(r"(?<![\w/])/[a-z]+", ajuda))
        faltam = sorted(na_ajuda - set(nomes))
        ok(not faltam, f"todo comando da ajuda esta no manifesto (faltam: {faltam})")

        ok(c.get("/interno/bot/manifesto").status_code == 403, "manifesto exige token")
        m = c.get("/interno/bot/manifesto", headers=H).json()
        ok(m["app"] == "rot" and "_leia" not in m, "a rota entrega o manifesto limpo")

        # ── 3 · avisos: sem duplicar ──────────────────────────────────
        enviados, original_tg, original_av = [], bt._tg, solobot_ponte.avisar
        bt._tg = lambda chat, texto, **k: enviados.append((chat, texto))
        try:
            db = database.SessionLocal()
            arq = db.get(database.Usuario, uid)
            solobot_ponte.avisar = lambda u_id, texto, opcoes=None: True
            bt._avisar(arq, "111", "bom dia")
            ok(enviados == [], "entregue pelo Solo Bot: o chat antigo nao recebe")
            solobot_ponte.avisar = lambda u_id, texto, opcoes=None: False
            bt._avisar(arq, "111", "bom dia")
            ok(enviados == [("111", "bom dia")], "sem Solo Bot: cai no chat antigo")
            db.close()
        finally:
            bt._tg, solobot_ponte.avisar = original_tg, original_av

        print("\n=== A PONTE OK ===\n")


def test_solobot():
    main_teste()


if __name__ == "__main__":
    main_teste()
