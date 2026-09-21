# -*- coding: utf-8 -*-
"""
O BOT CONCLUI PELO MESMO CAMINHO QUE O APP — e o limbo nunca mais.

O DEFEITO QUE ORIGINOU ESTE ARQUIVO, nas palavras do Arquiteto:

    "eu conclui uma tarefa no Telegram, mas a mesma tarefa sequer foi
     iniciada no servidor."

E a captura mostrava as duas telas discordando: no chat, "✅ Rotina
concluída! +66 XP"; no app, o mesmo "Colocar o Dolphin para carregar"
com o botão INICIAR MISSÃO intacto e o prazo ainda correndo.

O QUE ESTAVA ACONTECENDO

O `/ok` do bot fazia a sua própria conclusão: carimbava
`rotina.ultima_execucao` e chamava `aplicar_xp`. Nenhuma das duas coisas
é a conclusão. A tela lê a `ExecucaoDia` — que continuava PENDENTE.

E o `aplicar_xp` grava uma linha em `Execucao`, que é justamente o que o
`/execucoes/rotina` usa para barrar conclusão dupla. A missão ficava num
LIMBO: impossível de concluir pelo app ("já foi concluída hoje") e ainda
PENDENTE para o fechamento — que às 00h05 a marcaria FRACASSADA, com
punição. O hunter cumpria a missão e era castigado por ela.

O QUE ESTE TESTE VIGIA, então:

  1. concluir pelo bot muda a ExecucaoDia, e não só o XP;
  2. o XP vem da Balança e do prazo, não do número cru da rotina;
  3. as travas de meta e circuito valem no chat como valem na tela;
  4. o fechamento NUNCA fracassa um dia que tem execução registrada —
     a rede de segurança que conserta o estrago já feito.

Uso: DATABASE_URL=sqlite:///./x.db SECRET_KEY=... python test_bot_conclusao.py
"""
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
    from motors import tempo, fechamento

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

        # vincula o chat 111 ao Arquiteto
        cod = c.post(P + "/bots/codigo/telegram", headers=A).json()["codigo"]
        db = database.SessionLocal()
        bt._processar("/vincular " + cod, "111", db)
        db.close()

        hoje = tempo.hoje()
        print("\n=== BOT: CONCLUSAO PELO CAMINHO REAL ===")

        def nova_rotina(titulo, **extra):
            corpo = {"titulo": titulo, "tipo": "DIARIA", "categoria": "Pessoal",
                     "prioridade": "ALTA", "xp_recompensa": 60,
                     "moedas_recompensa": 5}
            corpo.update(extra)
            r = c.post(P + "/rotinas/", json=corpo, headers=A)
            assert r.status_code in (200, 201), r.text
            return r.json()["id"]

        def ed_de(rid, dia=None):
            db = database.SessionLocal()
            e = db.query(database.ExecucaoDia).filter_by(
                rotina_id=rid, usuario_id=uid, data=dia or hoje).first()
            st = (e.status if e else None)
            db.close()
            return st

        # ══════════════════════════════════════════════════════════════
        # 1 · O DEFEITO DO ARQUITETO, refeito
        # ══════════════════════════════════════════════════════════════
        rid = nova_rotina("Colocar o Dolphin para carregar")
        c.get(P + "/dashboard/stats", headers=A)      # materializa o dia
        ok(ed_de(rid) == "PENDENTE", "a instancia do dia nasce PENDENTE")

        caixa.limpar()
        db = database.SessionLocal()
        bt._processar("/ok Colocar o Dolphin", "111", db)
        db.close()
        ok("concluída" in caixa.ultima("111").lower(),
           "o bot responde que concluiu")

        # ESTA e a linha que o defeito quebrava. O bot dizia concluida e
        # a instancia ficava PENDENTE — as duas telas discordando.
        ok(ed_de(rid) == "CONCLUIDA",
           "e a ExecucaoDia REALMENTE virou CONCLUIDA (era o defeito)")

        db = database.SessionLocal()
        e = db.query(database.ExecucaoDia).filter_by(
            rotina_id=rid, usuario_id=uid, data=hoje).first()
        ok(e.concluida_em is not None, "com hora de conclusao, como no app")
        ok((e.xp_ganho or 0) > 0, "e o XP do dia registrado na instancia")
        db.close()

        # ══════════════════════════════════════════════════════════════
        # 2 · O LIMBO NAO EXISTE MAIS
        #     Antes: app recusava ("ja concluida hoje") e a instancia
        #     seguia PENDENTE. Missao impossivel de fechar.
        # ══════════════════════════════════════════════════════════════
        r = c.post(P + "/execucoes/rotina", json={"rotina_id": rid}, headers=A)
        ok(r.status_code == 400, "o app recusa concluir de novo")
        ok(ed_de(rid) == "CONCLUIDA",
           "mas a missao esta FECHADA, nao presa entre os dois")

        caixa.limpar()
        db = database.SessionLocal()
        bt._processar("/ok Colocar o Dolphin", "111", db)
        db.close()
        ok("já foi concluída" in caixa.ultima("111"),
           "e o bot repassa a recusa em portugues, sem carimbar nada")

        # ══════════════════════════════════════════════════════════════
        # 3 · O /hoje LE A ExecucaoDia, nao o `ultima_execucao`
        # ══════════════════════════════════════════════════════════════
        caixa.limpar()
        db = database.SessionLocal()
        bt._processar("/hoje", "111", db)
        db.close()
        linha = [l for l in caixa.ultima("111").split("\n")
                 if "Dolphin" in l]
        ok(linha and "✅" in linha[0], "/hoje mostra a rotina como concluida")

        # Uma rotina so iniciada tem de aparecer DIFERENTE de uma parada.
        rid2 = nova_rotina("Ler 05 paginas")
        c.get(P + "/dashboard/stats", headers=A)
        c.post(P + f"/rotinas/{rid2}/iniciar", headers=A)
        ok(ed_de(rid2) == "ATIVA", "a rotina iniciada fica ATIVA")

        caixa.limpar()
        db = database.SessionLocal()
        bt._processar("/hoje", "111", db)
        db.close()
        l2 = [l for l in caixa.ultima("111").split("\n") if "Ler 05" in l]
        ok(l2 and "▶️" in l2[0],
           "missao em curso aparece como em curso, nao como parada")

        # ══════════════════════════════════════════════════════════════
        # 4 · A TRAVA DA META VALE NO CHAT
        #     Pelo caminho antigo dava para "concluir" uma meta em zero.
        # ══════════════════════════════════════════════════════════════
        # `natureza: META` é obrigatório — o router só lê `meta_alvo`
        # dentro desse ramo. Minha primeira versão passou só o alvo, a
        # rotina nasceu comum, e o teste acusou o bot de um defeito que
        # era do teste.
        rid3 = nova_rotina("Conseguir R$100 no turno da manha",
                           natureza="META", meta_alvo=100,
                           meta_modo="SOMA", meta_especie="DINHEIRO")
        db = database.SessionLocal()
        from motors import meta as _mt
        _r3 = db.query(database.Rotina).filter_by(id=rid3).first()
        ok(_mt.eh_meta_valida(_r3), "a rotina de meta nasceu como meta de verdade")
        db.close()

        c.get(P + "/dashboard/stats", headers=A)
        ok(ed_de(rid3) == "PENDENTE", "e a instancia dela esta em aberto")

        caixa.limpar()
        db = database.SessionLocal()
        bt._processar("/ok Conseguir R$100", "111", db)
        db.close()
        ok("meta" in caixa.ultima("111").lower(),
           "o bot recusa fechar meta nao alcancada, com a msg do app")
        ok(ed_de(rid3) == "PENDENTE", "e nao mexe na instancia")

        # ══════════════════════════════════════════════════════════════
        # 5 · A REDE DE SEGURANCA DO FECHAMENTO
        #
        #     Mesmo com o bot corrigido, a trava fica: o custo de um
        #     falso fracasso (XP perdido, corrente quebrada, penitencia)
        #     e alto demais para depender de todo caminho futuro lembrar
        #     da regra.
        # ══════════════════════════════════════════════════════════════
        rid4 = nova_rotina("Missao de ontem")
        ontem = hoje - timedelta(days=1)

        db = database.SessionLocal()
        # o estrago EXATO que o bot antigo produzia, montado a mao:
        # instancia PENDENTE de um dia vencido + execucao registrada.
        db.add(database.ExecucaoDia(rotina_id=rid4, usuario_id=uid,
                                    data=ontem, status="PENDENTE"))
        db.add(database.Execucao(usuario_id=uid, rotina_id=rid4,
                                 data_execucao=ontem, xp_ganho=66,
                                 moedas_ganhas=5,
                                 observacao="Bot: Missao de ontem"))
        u = db.query(database.Usuario).filter_by(id=uid).first()
        xp_antes = u.xp_total
        db.commit()
        db.close()

        db = database.SessionLocal()
        u = db.query(database.Usuario).filter_by(id=uid).first()
        resumo = fechamento.fechar_vencidas(db, u)
        db.commit()
        db.close()

        ok(ed_de(rid4, ontem) == "CONCLUIDA",
           "o fechamento NAO fracassa um dia que tem execucao registrada")
        ok(resumo.get("reparadas", 0) >= 1, "e conta o reparo no resumo do job")

        db = database.SessionLocal()
        u = db.query(database.Usuario).filter_by(id=uid).first()
        ok(u.xp_total == xp_antes,
           "o reparo NAO paga de novo — o XP daquele dia ja tinha sido pago")
        db.close()

        # E o contraste: sem execucao registrada, fracassa como sempre.
        rid5 = nova_rotina("Missao de ontem sem prova")
        db = database.SessionLocal()
        db.add(database.ExecucaoDia(rotina_id=rid5, usuario_id=uid,
                                    data=ontem, status="PENDENTE"))
        db.commit()
        db.close()

        db = database.SessionLocal()
        u = db.query(database.Usuario).filter_by(id=uid).first()
        fechamento.fechar_vencidas(db, u)
        db.commit()
        db.close()
        ok(ed_de(rid5, ontem) == "FRACASSADA",
           "sem prova de execucao, o dia vencido fracassa como antes")

        # ══════════════════════════════════════════════════════════════
        # 6 · A REGRA DE RECORRENCIA E UMA SO
        # ══════════════════════════════════════════════════════════════
        db = database.SessionLocal()
        rot = db.query(database.Rotina).filter_by(id=rid).first()
        iguais = all(
            bt._rotina_de_hoje(rot, hoje + timedelta(days=n))
            == fechamento.rotina_devida_em(rot, hoje + timedelta(days=n))
            for n in range(0, 40)
        )
        db.close()
        ok(iguais, "o bot e o fechamento concordam em 40 dias seguidos")

        print("\n=== CONCLUSAO PELO BOT OK ===\n")


if __name__ == "__main__":
    main_teste()
