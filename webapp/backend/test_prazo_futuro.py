# -*- coding: utf-8 -*-
"""
A missao marcada para amanha — dois bugs que o Arquiteto encontrou.

BUG 1: A JANELA ABRIA A MEIA-NOITE

Uma missao CRITICA marcada para amanha abria as 00:00 e morria as
00:30. Uma ALTA morria as 02:00. O hunter cadastrava a noite, ia
dormir, e acordava com a missao fracassada sem nunca ter tido chance.

O `max(criada, meia-noite)` protegia contra "nascer vencida" e criava
um problema pior: nascer com a janela inteira gasta no sono.

O erro de raciocinio foi tratar "o dia" como intervalo de calendario.
Para quem usa o app, o dia comeca quando a pessoa acorda.

BUG 2: A MISSAO FUTURA SUMIA DA TELA

O extrato ia de `hoje - 30` ate `hoje`. Missao agendada para amanha
nao aparecia em lugar nenhum — o hunter criava e ela sumia. O cartao
JA sabia desenhar missao futura (selo "Agendada", `editavel=False`); a
consulta e que nao ia buscar.

Uso: DATABASE_URL=sqlite:///./x.db SECRET_KEY=... python test_prazo_futuro.py
"""
from fastapi.testclient import TestClient
from datetime import timedelta, datetime

import main
from database import SessionLocal, Usuario, TarefaDia
from auth.service import hash_senha
from motors import tempo, prazos

falhas = 0


def ok(cond, msg):
    global falhas
    if not cond:
        falhas += 1
    print(("  [ok]  " if cond else "  [XX]  ") + msg)


def rodar():
    print("\n=== A MISSAO MARCADA PARA AMANHA ===\n")
    cli = TestClient(main.app)
    with cli:
        pass
    db = SessionLocal()
    u = db.query(Usuario).filter_by(nivel_acesso="Arquiteto").first()
    db.query(TarefaDia).filter_by(usuario_id=u.id).delete()
    u.senha_hash = hash_senha("teste123")
    db.commit()
    tok = cli.post("/api/auth/login",
                   data={"username": u.login, "password": "teste123"})
    H = {"Authorization": "Bearer " + tok.json()["access_token"]}

    hoje = tempo.hoje()
    amanha = hoje + timedelta(days=1)
    agora = tempo.agora()

    def cria(**kw):
        base = dict(titulo="X", prioridade="CRITICA", categoria="Estudo",
                    dificuldade="NORMAL")
        r = cli.post("/api/tarefas/", headers=H, json={**base, **kw}).json()
        return r, prazos.da_tarefa(db.query(TarefaDia).get(r["id"]))

    # ══ 1. A JANELA NAO ABRE MAIS DORMINDO ═══════════════════════
    print("-- a janela nao abre mais a meia-noite --")
    _, p = cria(titulo="Critica sem hora", data_prevista=amanha.isoformat())
    ok(not (p["inicio"].hour == 0 and p["fim"].hour == 0),
       f"critica para amanha NAO abre 00:00-00:30 ({p['inicio']:%H:%M}-{p['fim']:%H:%M})")
    ok(p["fim"].hour == 23,
       "sem hora, ela vale o DIA INTEIRO — o Sistema nao adivinha o horario")
    ok(p["minutos"] > 1000,
       f"e a janela e do tamanho de um dia ({p['minutos']}min), nao de 30")

    # A prova para as quatro prioridades: nenhuma pode morrer de madrugada.
    for pr in ("CRITICA", "ALTA", "MEDIA", "BAIXA"):
        _, pp = cria(titulo=f"P {pr}", data_prevista=amanha.isoformat(),
                     prioridade=pr)
        morre_dormindo = pp["fim"].date() == amanha and pp["fim"].hour < 7
        ok(not morre_dormindo,
           f"  {pr}: morre {pp['fim']:%d/%m %H:%M} — nao de madrugada")

    # ══ 2. COM HORA, CONTA DALI ══════════════════════════════════
    print("\n-- com hora, o prazo espera --")
    r, p = cria(titulo="Critica as 14h", data_prevista=amanha.isoformat(),
                hora_inicio="14:00")
    ok(p["inicio"] == datetime.combine(amanha, datetime.min.time().replace(hour=14)),
       f"comeca as 14:00 do dia marcado ({p['inicio']:%d/%m %H:%M})")
    ok(p["minutos"] == 30,
       "e AI SIM a janela curta da critica vale — 30min a partir das 14h")
    ok(p["fim"].hour == 14 and p["fim"].minute == 30,
       f"morrendo as 14:30 ({p['fim']:%H:%M}), quando o hunter esta acordado")
    ok(not prazos.venceu(p), "e ela nao nasce vencida")
    ok(r.get("hora_inicio") == "14:00",
       "a hora volta na resposta — sem isso, editar perderia a escolha")

    # ══ 3. HOJE NAO MUDOU ════════════════════════════════════════
    print("\n-- a missao de hoje segue igual --")
    _, p = cria(titulo="Critica de hoje", data_prevista=hoje.isoformat())
    ok(abs((p["inicio"] - agora).total_seconds()) < 120,
       "para HOJE o prazo comeca AGORA, na criacao — 'vou fazer agora'")
    ok(p["minutos"] == 30, "  com a janela curta da critica valendo")

    # A hora ja passada nao pode empurrar o inicio para tras.
    _, p = cria(titulo="Hoje as 01h", data_prevista=hoje.isoformat(),
                hora_inicio="01:00")
    ok(p["inicio"] >= agora - timedelta(minutes=2),
       "hora ja passada hoje nao ressuscita o passado: comeca agora")

    # ══ 4. A MISSAO FUTURA APARECE NA TELA ═══════════════════════
    print("\n-- e ela aparece no extrato --")
    ex = cli.get("/api/extrato/", headers=H).json()
    linhas = ex if isinstance(ex, list) else ex.get("missoes", ex.get("itens", []))
    por_titulo = {x["titulo"]: x for x in linhas}
    ok("Critica as 14h" in por_titulo,
       "a missao de amanha APARECE — antes ela sumia ate o dia chegar")

    m = por_titulo["Critica as 14h"]
    ok(m["editavel"] is False,
       "  e vem como nao-executavel: ninguem conclui amanha hoje")
    ok(m["gerenciavel"] is True,
       "  mas gerenciavel: da para corrigir a missao que ainda vai acontecer")
    ok(m["status"] == "PENDENTE", "  status pendente, nao fracassada")
    ok((m.get("prazo_ate_abrir") or 0) > 0,
       f"  e o cartao sabe que ela ainda vai abrir ({m.get('prazo_ate_abrir')}s)")

    # ══ 5. A MISSAO DE ONTEM NAO SUMIU ═══════════════════════════
    print("\n-- e o passado continua la --")
    ontem = hoje - timedelta(days=1)
    t = TarefaDia(titulo="Missao de ontem", data_prevista=ontem,
                  prioridade="MEDIA", categoria="Casa", usuario_id=u.id,
                  status="CONCLUIDA")
    db.add(t)
    db.commit()
    ex = cli.get("/api/extrato/", headers=H).json()
    linhas = ex if isinstance(ex, list) else ex.get("missoes", ex.get("itens", []))
    ok(any(x["titulo"] == "Missao de ontem" for x in linhas),
       "abrir o horizonte para a frente nao fechou o de tras")

    # ══ 6. O HORIZONTE TEM FIM ═══════════════════════════════════
    print("\n-- o horizonte nao e infinito --")
    daqui_um_ano = hoje + timedelta(days=365)
    cli.post("/api/tarefas/", headers=H, json={
        "titulo": "Daqui um ano", "data_prevista": daqui_um_ano.isoformat(),
        "prioridade": "BAIXA", "categoria": "Casa", "dificuldade": "NORMAL"})
    ex = cli.get("/api/extrato/", headers=H).json()
    linhas = ex if isinstance(ex, list) else ex.get("missoes", ex.get("itens", []))
    ok(not any(x["titulo"] == "Daqui um ano" for x in linhas),
       "missao de daqui a um ano NAO entra: o extrato acompanha, nao e agenda")

    # Mas quem pedir explicitamente, recebe.
    ex = cli.get(f"/api/extrato/?fim={daqui_um_ano.isoformat()}", headers=H).json()
    linhas = ex if isinstance(ex, list) else ex.get("missoes", ex.get("itens", []))
    ok(any(x["titulo"] == "Daqui um ano" for x in linhas),
       "  mas quem pede o intervalo explicitamente recebe")

    db.close()
    print(f"\n=== {'TUDO PASSOU' if not falhas else str(falhas) + ' FALHA(S)'} ===")
    return 1 if falhas else 0


if __name__ == "__main__":
    raise SystemExit(rodar())
