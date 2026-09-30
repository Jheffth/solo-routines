# -*- coding: utf-8 -*-
"""
O MODO DE AVISO DE CADA MISSÃO — texto, voz ou nenhum.

O Arquiteto marca, na Forja, como cada missão o avisa. O QUANDO continua
global (começou, falta pouco, venceu); o COMO é da missão.

O que este teste vigia:

  · o campo atravessa a API — cria, edita, volta na leitura — nas rotinas
    e nas missões gerais;
  · "nenhum" cala a missão de verdade, nos três momentos;
  · "voz" chega ao Solo Bot com `voz=True` e um `falado` escrito para o
    ouvido (sem emoji, sem asterisco);
  · numa varredura MISTA a mensagem escrita leva todas, e a fala só as de
    voz — falar as outras desrespeitaria a escolha feita na Forja;
  · missões gerais que vencem no mesmo dia não dividem mais a mesma chave
    de "já avisado" (antes só a primeira era anunciada).

Uso: DATABASE_URL=sqlite:///./x.db SECRET_KEY=... python test_aviso_modo.py
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


def main_teste():
    from motors import avisos, tempo
    from routers import bot_telegram as bt
    import solobot_ponte

    with TestClient(main.app) as c:
        db = database.SessionLocal()
        arq = db.query(database.Usuario).filter_by(nivel_acesso="Arquiteto").first()
        arq.senha_hash = hash_senha("admin123")
        login, uid = arq.login, arq.id
        db.commit()
        db.close()
        A = {"Authorization": "Bearer " + c.post(
            P + "/auth/login", data={"username": login, "password": "admin123"}
        ).json()["access_token"]}

        agora = tempo.agora()
        hoje = agora.date()
        print("\n=== MODO DE AVISO POR MISSAO ===")

        def rotina(titulo, modo=None, fim_em_min=8):
            fim = agora + timedelta(minutes=fim_em_min)
            ini = agora - timedelta(hours=1)
            corpo = {"titulo": titulo, "tipo": "DIARIA", "categoria": "Pessoal",
                     "prioridade": "ALTA",
                     "hora_inicio": ini.strftime("%H:%M"),
                     "hora_fim": fim.strftime("%H:%M")}
            if modo is not None:
                corpo["aviso_modo"] = modo
            r = c.post(P + "/rotinas/", json=corpo, headers=A)
            assert r.status_code in (200, 201), r.text
            return r.json()["id"]

        def ler_rotina(rid):
            for r in c.get(P + "/rotinas/", headers=A).json():
                if r["id"] == rid:
                    return r
            return None

        # ── 1 · A API ─────────────────────────────────────────────────
        r_padrao = rotina("Fio Dental")
        r_voz    = rotina("Acordar as 06:00", "voz")
        r_mudo   = rotina("Colocar o Dolphin", "nenhum")
        r_lixo   = rotina("Modo inventado", "gritar")

        ok(ler_rotina(r_padrao)["aviso_modo"] == "texto",
           "sem escolha, a missao avisa por texto")
        ok(ler_rotina(r_voz)["aviso_modo"] == "voz", "'voz' atravessa a criacao")
        ok(ler_rotina(r_mudo)["aviso_modo"] == "nenhum", "'nenhum' atravessa a criacao")
        ok(ler_rotina(r_lixo)["aviso_modo"] == "texto",
           "modo desconhecido vira o padrao — nao cala nem faz falar ninguem")

        db = database.SessionLocal()
        cru = db.query(database.Rotina).filter_by(id=r_padrao).first().aviso_modo
        db.close()
        ok(cru is None, "o padrao e guardado como NULL, nao como 'texto' explicito")

        c.put(P + f"/rotinas/{r_padrao}", json={"aviso_modo": "voz"}, headers=A)
        ok(ler_rotina(r_padrao)["aviso_modo"] == "voz", "a edicao troca o modo")
        c.put(P + f"/rotinas/{r_padrao}", json={"titulo": "Fio Dental Rotineiro"}, headers=A)
        ok(ler_rotina(r_padrao)["aviso_modo"] == "voz",
           "editar outro campo NAO mexe no modo")
        c.put(P + f"/rotinas/{r_padrao}", json={"aviso_modo": "texto"}, headers=A)
        ok(ler_rotina(r_padrao)["aviso_modo"] == "texto", "e volta para texto")

        # missao geral
        t = c.post(P + "/tarefas/", json={
            "titulo": "Pagar a conta", "data_prevista": hoje.isoformat(),
            "aviso_modo": "voz"}, headers=A)
        ok(t.status_code in (200, 201), "missao geral aceita o campo")
        tid = t.json()["id"]
        ok(t.json().get("aviso_modo") == "voz", "e devolve o modo")
        t2 = c.put(P + f"/tarefas/{tid}", json={"aviso_modo": "nenhum"}, headers=A)
        ok(t2.json().get("aviso_modo") == "nenhum", "e a edicao da geral tambem troca")

        # ── 2 · O MOTOR ───────────────────────────────────────────────
        c.get(P + "/dashboard/stats", headers=A)     # materializa o dia
        db = database.SessionLocal()
        u = db.query(database.Usuario).filter_by(id=uid).first()
        lista = avisos.pendentes(db, u, agora)
        db.close()
        beira = {a.chave: a for a in lista if a.tipo == "beira"}

        k_voz = f"beira:r:{r_voz}:{hoje.isoformat()}"
        k_txt = f"beira:r:{r_padrao}:{hoje.isoformat()}"
        k_mudo = f"beira:r:{r_mudo}:{hoje.isoformat()}"
        ok(k_voz in beira and beira[k_voz].voz, "missao 'voz' gera aviso pedindo voz")
        ok(k_txt in beira and not beira[k_txt].voz, "missao 'texto' gera aviso sem voz")
        ok(k_mudo not in beira, "missao 'nenhum' nao gera aviso nenhum")

        fal = beira[k_voz].falado or ""
        ok("Faltam" in fal and "Acordar as 06:00" in fal, "o falado diz o que falta e de quem")
        ok("*" not in fal and "⏳" not in fal, "sem asterisco nem emoji — e para o ouvido")

        # ── 3 · A VARREDURA MISTA ─────────────────────────────────────
        mista = [beira[k_voz], beira[k_txt]]
        escrito = avisos.compor(mista)
        falado = avisos.compor_falado(mista)
        ok("Acordar" in escrito and "Fio Dental" in escrito,
           "a mensagem escrita leva as duas")
        ok("Acordar" in falado and "Fio Dental" not in falado,
           "a fala leva so a que pediu voz")
        ok(avisos.compor_falado([beira[k_txt]]) is None,
           "ninguem pediu voz -> nao ha roteiro de fala")

        # ── 4 · CHEGA AO SOLO BOT ─────────────────────────────────────
        chamadas = []
        guard = (solobot_ponte.token, solobot_ponte.situacao, solobot_ponte.avisar)
        solobot_ponte.token = lambda: "tok"
        solobot_ponte.situacao = lambda _uid: {"conectado": True}

        def _avisar(uid_, texto, opcoes=None, falado=None, voz=None, valido_ate=None):
            chamadas.append({"texto": texto, "falado": falado, "voz": voz,
                             "valido_ate": valido_ate})
            return True
        solobot_ponte.avisar = _avisar
        try:
            db = database.SessionLocal()
            bt.varrer_avisos(db)
            db.close()
        finally:
            solobot_ponte.token, solobot_ponte.situacao, solobot_ponte.avisar = guard

        ok(len(chamadas) == 1, "uma varredura, uma mensagem ao Solo Bot")
        ch = chamadas[0]
        ok(ch["voz"] is True, "com missao de voz na varredura, pede voz=True")
        ok(ch["falado"] and "Acordar" in ch["falado"], "e manda o roteiro falado")
        ok("Fio Dental" in ch["texto"] and "Dolphin" not in ch["texto"],
           "o texto leva a de texto e deixa de fora a silenciada")

        # ── 4b · A VALIDADE ───────────────────────────────────────────
        va = ch["valido_ate"]
        ok(va is not None and va.tzinfo is not None,
           "o aviso de prazo vai com valido_ate, e COM fuso")
        ok(abs((va.replace(tzinfo=None) - (agora + timedelta(minutes=8))).total_seconds()) <= 60,
           "valendo ate o fim da janela da missao")

        # ── 5 · SEM VOZ, voz=None (a Conta Solo decide) ────────────────
        chamadas.clear()
        db = database.SessionLocal()
        u = db.query(database.Usuario).filter_by(id=uid).first()
        so_texto = [a for a in avisos.pendentes(db, u, agora) if not a.voz]
        db.close()
        canais = None
        solobot_ponte.token = lambda: "tok"
        solobot_ponte.situacao = lambda _uid: {"conectado": True}
        solobot_ponte.avisar = _avisar
        try:
            db = database.SessionLocal()
            u = db.query(database.Usuario).filter_by(id=uid).first()
            canais = bt._canais_de_aviso(db, u)
            db.close()
            _, entregar = canais[0]
            entregar(avisos.compor(so_texto), falado=avisos.compor_falado(so_texto))
        finally:
            solobot_ponte.token, solobot_ponte.situacao, solobot_ponte.avisar = guard
        ok(chamadas and chamadas[0]["voz"] is None and chamadas[0]["falado"] is None,
           "sem missao de voz, vai voz=None — o Rotinas nao pede fala sem motivo")

        # ── 6 · VENCEU respeita o modo, e cada geral tem a propria chave ──
        falhas = [
            {"titulo": "Geral A", "data": hoje, "xp": 10, "rotina_id": None, "tarefa_id": 901},
            {"titulo": "Geral B", "data": hoje, "xp": 10, "rotina_id": None, "tarefa_id": 902},
            {"titulo": "Colocar o Dolphin", "data": hoje, "xp": 5, "rotina_id": r_mudo},
            {"titulo": "Acordar as 06:00", "data": hoje, "xp": 5, "rotina_id": r_voz},
        ]
        db = database.SessionLocal()
        u = db.query(database.Usuario).filter_by(id=uid).first()
        venc = [a for a in avisos.pendentes(db, u, agora, falhas=falhas) if a.tipo == "venceu"]
        db.close()
        chaves = {a.chave for a in venc}
        ok(f"venceu:t:901:{hoje}" in chaves and f"venceu:t:902:{hoje}" in chaves,
           "duas gerais vencidas no mesmo dia tem chaves diferentes")
        ok(not any("Dolphin" in a.texto for a in venc),
           "a rotina silenciada nao anuncia o proprio fracasso")
        v_voz = [a for a in venc if "Acordar" in a.texto]
        ok(v_voz and v_voz[0].voz and "venceu" in (v_voz[0].falado or ""),
           "a de voz anuncia o vencimento falando")
        ok(all(a.valido_ate is None for a in venc),
           "'venceu' nao vence — e noticia, vale de manha tambem")

        # ── 7 · OS LOTES ──────────────────────────────────────────────
        cedo = avisos.Aviso("beira", "k1", "a", valido_ate=agora + timedelta(minutes=5))
        tarde = avisos.Aviso("acendeu", "k2", "b", valido_ate=agora + timedelta(hours=2))
        noticia = avisos.Aviso("venceu", "k3", "c")
        lts = avisos.lotes([tarde, noticia, cedo])
        ok(len(lts) == 2, "prazo e noticia saem em lotes separados")
        itens_p, val_p = lts[0]
        ok({a.chave for a in itens_p} == {"k1", "k2"} and val_p == cedo.valido_ate,
           "o lote de prazo vale ate o que vence PRIMEIRO — nunca entrega contagem velha")
        ok(lts[1][1] is None and lts[1][0][0].chave == "k3",
           "e a noticia vai sem validade, para nao ser descartada junto")
        ok(len(avisos.lotes([cedo])) == 1 and len(avisos.lotes([noticia])) == 1,
           "com um tipo so, continua sendo uma mensagem so")

        # ── 8 · A PONTE: descartado conta como tratado ────────────────
        guard_post, guard_tok = solobot_ponte._post, solobot_ponte.token
        enviados = []
        solobot_ponte.token = lambda: "tok"
        solobot_ponte._post = lambda cam, corpo: (enviados.append(corpo) or {"descartados": 1})
        try:
            from datetime import datetime as _dt
            r = solobot_ponte.avisar(uid, "x", valido_ate=_dt(2026, 10, 1, 14, 30,
                                                            tzinfo=tempo.FUSO))
        finally:
            solobot_ponte._post, solobot_ponte.token = guard_post, guard_tok
        ok(r is True, "aviso descartado por vencido devolve True — nao cai para outro canal")
        ok(enviados and enviados[0].get("valido_ate", "").endswith("-03:00"),
           "e a validade viaja em ISO com o fuso")

        print("\n=== MODO DE AVISO OK ===\n")


if __name__ == "__main__":
    main_teste()
