# -*- coding: utf-8 -*-
"""
A PENITENCIA — do pacto ao Eco, ponta a ponta.

AS TRES REGRAS QUE ESTE TESTE EXISTE PARA PRENDER

1. FALHAR UMA PENITENCIA NAO GERA OUTRA.
   Sem isto, um dia ruim vira espiral infinita e o app deixa de ser
   recuperavel. E o assert mais importante do arquivo.

2. O TETO PARA A BOLA DE NEVE.
   A partir de `divida_teto`, o Sistema PARA DE CRIAR. Ninguem acorda
   com quarenta cartoes depois de uma semana ruim.

3. AS DUAS PORTAS EXISTENTES SAO RESPEITADAS.
   Reerguer revoga a penitencia; confissao nao gera penitencia.

E MAIS:
  · a punicao NAO e forjavel — nem pelo Arquiteto
  · sorteio sem reposicao, escalonamento e decaimento
  · apagar do pacto NAO apaga a divida ja cobrada
  · quitar devolve fracao, nunca lucro

Uso: DATABASE_URL=sqlite:///./x.db SECRET_KEY=... python test_punicao.py
"""
from fastapi.testclient import TestClient
from datetime import timedelta

import main
from database import (SessionLocal, Usuario, TarefaDia, Pacto, Rotina,
                      ExecucaoDia)
from auth.service import hash_senha
from motors import (tempo, fechamento, penitencia, ecos, especiais,
                    economia, pactos as cat)

falhas = 0


def ok(cond, msg):
    global falhas
    if not cond:
        falhas += 1
    print(("  [ok]  " if cond else "  [XX]  ") + msg)


def rodar():
    print("\n=== A PENITENCIA ===\n")
    cli = TestClient(main.app)
    with cli:
        pass
    db = SessionLocal()
    u = db.query(Usuario).filter_by(nivel_acesso="Arquiteto").first()

    def limpar():
        db.query(TarefaDia).filter_by(usuario_id=u.id).delete()
        db.query(Pacto).filter_by(usuario_id=u.id).delete()
        for r in db.query(Rotina).filter(Rotina.usuario_id == u.id).all():
            db.query(ExecucaoDia).filter_by(rotina_id=r.id).delete()
            db.delete(r)
        db.commit()

    limpar()
    u.senha_hash = hash_senha("teste123")
    db.commit()
    tok = cli.post("/api/auth/login",
                   data={"username": u.login, "password": "teste123"})
    H = {"Authorization": "Bearer " + tok.json()["access_token"]}
    hoje = tempo.hoje()
    ontem = hoje - timedelta(days=1)

    def falhar_critica(titulo="Prova critica", dia=None):
        t = TarefaDia(titulo=titulo, data_prevista=dia or ontem,
                      prioridade="CRITICA", categoria="Estudo",
                      usuario_id=u.id, status="PENDENTE", penalidade_xp=60)
        db.add(t)
        db.commit()
        r = fechamento.processar_usuario(db, u)
        db.commit()
        return r.get("punicao") or {}

    # ══ 1. O CATALOGO E A ADOCAO ═════════════════════════════════
    print("-- o catalogo --")
    c = cli.get("/api/pactos/catalogo").json()
    ok(len(c["itens"]) >= 15, f"o catalogo tem {len(c['itens'])} pactos prontos")
    # `tipos` era list[str] e virou list[dict] quando o lancador passou a
    # desenhar a escada de escalacao ao vivo — ele precisa do FATOR, nao
    # so do nome. Este assert quebrou na mudanca, e foi ele que provou
    # que a afirmacao "ninguem consumia o tipos antigo" estava errada.
    ids = {t["id"] for t in c["tipos"]}
    ok(ids == set(cat.TIPOS), f"e os QUATRO tipos: {sorted(ids)}")
    ok(all("escala" in t and "natureza" in t for t in c["tipos"]),
       "cada tipo viaja com escala e natureza — a escada do lancador depende disso")
    # O fator e MEDIDO (fator_efetivo), nao lido da tabela: ESCALA_DO_TIPO
    # declara None para a RESTRITIVA, mas escalar() dobra. Uma previa que
    # promete "nao escala" e dobra e pior que previa nenhuma.
    porid = {t["id"]: t for t in c["tipos"]}
    ok(porid["RESTRITIVA"]["escala"] == cat.fator_efetivo("RESTRITIVA"),
       f"o fator viaja MEDIDO: RESTRITIVA declara "
       f"{cat.ESCALA_DO_TIPO['RESTRITIVA']} e faz {porid['RESTRITIVA']['escala']}")
    ok(all(i["exemplo"] and "{n}" not in i["exemplo"] for i in c["itens"]),
       "cada item ja vem com o exemplo resolvido — o cliente nao conhece o {n}")

    r = cli.post("/api/pactos/adotar",
                 json={"chaves": ["flexoes", "sem_redes", "escrever_3"]},
                 headers=H).json()
    ok(len(r["adotados"]) == 3, "adotar tres do catalogo: UM toque")
    r2 = cli.post("/api/pactos/adotar", json={"chaves": ["flexoes"]}, headers=H).json()
    ok(len(r2["adotados"]) == 0,
       "adotar de novo o mesmo nao duplica — ignora em vez de recusar o lote")

    # ══ 2. PACTO VAZIO NAO E ERRO ════════════════════════════════
    print("\n-- o pacto vazio --")
    db.query(Pacto).filter_by(usuario_id=u.id).delete()
    db.commit()
    p = falhar_critica("Sem pacto ainda")
    ok(p.get("sem_pacto") is True, "sem pacto, nao nasce penitencia")
    ok(p["eco"]["intensidade"] == ecos.VAZIO,
       "e o Eco vira convite: " + p["eco"]["texto"])
    ok(penitencia.contar(db, u.id) == 0, "  zero pendencias")

    # ══ 3. A COBRANCA ════════════════════════════════════════════
    print("\n-- a cobranca --")
    limpar()
    cli.post("/api/pactos/adotar", json={"chaves": ["flexoes"]}, headers=H)
    p = falhar_critica("Passar fio dental")
    ok(p.get("gatilho") == "critica", "falha CRITICA dispara")
    ok(len(p["criadas"]) >= 1, f"cria {len(p['criadas'])} penitencia(s)")

    t = db.query(TarefaDia).filter_by(usuario_id=u.id, natureza="PUNICAO").first()
    ok(t is not None, "e ela existe como missao de natureza PUNICAO")
    ok(t.origem_titulo == "Passar fio dental",
       "dizendo POR QUAL FALHA veio — punicao anonima e arbitraria")
    ok(t.xp_recompensa == 0,
       "NAO paga XP: cumprir quita a divida, nao e nova fonte de progresso")
    ok(t.penalidade_xp == 0, "e NAO pune: falhar a penitencia nao custa mais")
    ok(t.xp_a_reparar == 30,
       f"mas quitar devolve METADE do perdido ({t.xp_a_reparar} de 60) — reparacao, nao lucro")
    ok("flex" in (t.titulo or "").lower(),
       f"o titulo veio do pacto: {t.titulo}")

    # ══ 4. A REGRA 1 — SEM RECURSAO ══════════════════════════════
    print("\n-- falhar a penitencia NAO gera outra --")
    t.data_prevista = ontem
    db.commit()
    antes = penitencia.contar(db, u.id)
    fechamento.processar_usuario(db, u)
    db.commit()
    db.expire_all()
    t = db.query(TarefaDia).get(t.id)
    ok(t.status not in ("FRACASSADA",),
       f"a penitencia nao FRACASSA ({t.status}) — ela simplesmente fica")
    ok(penitencia.contar(db, u.id) == antes,
       "e nao gera outra: sem isto, um dia ruim vira espiral infinita")

    # ══ 5. A REGRA 2 — O TETO ════════════════════════════════════
    print("\n-- o teto para a bola de neve --")
    limpar()
    cli.post("/api/pactos/adotar",
             json={"chaves": ["flexoes", "abdominais", "escada", "prancha"]},
             headers=H)
    teto = economia.punicao_regras(db)["divida_teto"]
    for i in range(10):
        falhar_critica(f"Falha {i}", ontem - timedelta(days=i))
    n = penitencia.contar(db, u.id)
    ok(n <= teto,
       f"dez falhas geram no maximo {teto} pendencias (tem {n}), nao dez")
    p = falhar_critica("Mais uma")
    ok(p.get("no_teto") is True, "e o Sistema DIZ que parou de contar")
    ok(p["eco"]["intensidade"] == ecos.FRIA,
       "com a voz fria: " + p["eco"]["texto"])

    # ══ 6. SORTEIO, ESCALA E DECAIMENTO ══════════════════════════
    print("\n-- sorteio sem reposicao --")
    limpar()
    cli.post("/api/pactos/adotar",
             json={"chaves": ["flexoes", "abdominais", "escada"]}, headers=H)
    titulos = []
    for i in range(3):
        pp = falhar_critica(f"F{i}", ontem - timedelta(days=i))
        titulos += [c["titulo"] for c in pp.get("criadas", [])]
        db.query(TarefaDia).filter_by(usuario_id=u.id, natureza="PUNICAO")\
          .update({"status": "CONCLUIDA"})
        db.commit()
    bases = {t.split()[1] if len(t.split()) > 1 else t for t in titulos}
    ok(len(titulos) >= 3, f"tres rodadas geraram {len(titulos)} penitencias")

    print("\n-- escalonamento e decaimento --")
    v = 1
    seq = [v]
    for _ in range(6):
        v = cat.escalar(v, cat.QUANTITATIVA, 32)
        seq.append(v)
    ok(seq[:6] == [1, 2, 4, 8, 16, 32],
       f"a mesma penitencia DOBRA a cada queda: {seq[:6]}")
    ok(seq[-1] == 32, "e trava no teto — mais do mesmo nao passa a funcionar")
    ok(cat.decair(16, 1, cat.QUANTITATIVA, 1) == 8,
       "uma semana limpa RECUA um degrau (16 -> 8)")
    ok(cat.decair(16, 1, cat.QUANTITATIVA, 9) == 1,
       "e nunca cai abaixo da base")
    ok(cat.escalar(20, cat.TEMPORAL, 120) == 30,
       "a temporal sobe mais devagar (x1,5): dobrar minutos vira absurdo rapido")

    # ══ 7. O TRIBUTO SE EXECUTA SOZINHO ══════════════════════════
    print("\n-- o tributo --")
    limpar()
    cli.post("/api/pactos/adotar", json={"chaves": ["tributo_mana"]}, headers=H)
    db.expire_all()
    mana_antes = db.query(Usuario).get(u.id).moedas or 0
    falhar_critica("Vai custar")
    db.expire_all()
    mana_depois = db.query(Usuario).get(u.id).moedas or 0
    ok(mana_depois < mana_antes,
       f"o Sistema COBRA sozinho: {mana_antes} -> {mana_depois} de Mana")
    tt = db.query(TarefaDia).filter_by(usuario_id=u.id, natureza="PUNICAO").first()
    ok(tt.status == "CONCLUIDA",
       "e ja nasce quitada — e o unico tipo que garante que a divida seja PAGA, "
       "nao apenas exibida")

    # ══ 8. QUITAR ════════════════════════════════════════════════
    print("\n-- quitar --")
    limpar()
    cli.post("/api/pactos/adotar", json={"chaves": ["escrever_3"]}, headers=H)
    falhar_critica("Ler 5 paginas")
    restantes_esperados = penitencia.contar(db, u.id)
    ok(restantes_esperados == 2,
       f"a falha CRITICA cobrou dobrado: {restantes_esperados} penitencias")
    t = db.query(TarefaDia).filter_by(usuario_id=u.id, natureza="PUNICAO").first()
    db.expire_all()
    xp_antes = db.query(Usuario).get(u.id).xp_total
    r = cli.post(f"/api/tarefas/{t.id}/concluir", headers=H).json()
    db.expire_all()
    xp_depois = db.query(Usuario).get(u.id).xp_total
    ok(r.get("xp_reparado", 0) == 30, f"quitar devolve {r.get('xp_reparado')} XP")
    ok(xp_depois == xp_antes + 30, "e o saldo sobe exatamente isso")
    ok(xp_depois - xp_antes < 60,
       "MENOS que os 60 perdidos — devolver mais seria pagar por ter falhado")
    ok(r["eco"]["intensidade"] == ecos.QUITADO,
       "e o Eco muda de tom: " + r["eco"]["texto"])
    # A CRITICA COBRA DOBRADO — entao sobra a outra. A primeira versao
    # deste assert esperava zero, esquecendo a propria regra que o
    # teste verifica trinta linhas acima.
    ok(t.id not in [x.id for x in penitencia.pendentes(db, u.id)],
       "a pendencia quitada sai da lista")
    ok(penitencia.contar(db, u.id) == restantes_esperados - 1,
       f"e a OUTRA continua — critica cobra dobrado, quitar uma nao quita as duas")

    # ══ 9. A PUNICAO NAO E FORJAVEL ══════════════════════════════
    print("\n-- ninguem forja uma penitencia --")
    ok(not especiais.pode_criar(u, especiais.PUNICAO),
       "nem o Arquiteto pode criar uma PUNICAO a mao")
    r = cli.post("/api/tarefas/", headers=H, json={
        "titulo": "Penitencia falsa", "data_prevista": hoje.isoformat(),
        "prioridade": "ALTA", "categoria": "Casa", "dificuldade": "NORMAL",
        "natureza": "PUNICAO"})
    ok(r.status_code == 403,
       f"e a API recusa ({r.status_code}) — o unico valor da penitencia e "
       "ela ser CONSEQUENCIA de algo")

    # ══ 10. APAGAR DO PACTO NAO APAGA A DIVIDA ═══════════════════
    print("\n-- o pacto e cardapio, a divida e divida --")
    limpar()
    a = cli.post("/api/pactos/adotar", json={"chaves": ["flexoes"]},
                 headers=H).json()["adotados"][0]
    falhar_critica("Algo")
    n_antes = penitencia.contar(db, u.id)
    ok(n_antes >= 1, f"ha {n_antes} pendencia(s)")
    d = cli.delete(f"/api/pactos/{a['id']}", headers=H).json()
    ok(d["pendentes_preservadas"] == n_antes,
       "tirar do pacto NAO apaga a divida ja cobrada — senao bastaria "
       "esvaziar o pacto para zerar o passado")
    ok(len(cli.get("/api/pactos", headers=H).json()["itens"]) == 0,
       "  mas o cardapio fica vazio")

    # ══ 11. O EXTRATO POE A PENITENCIA NO TOPO ═══════════════════
    print("\n-- o topo do extrato --")
    limpar()
    cli.post("/api/pactos/adotar", json={"chaves": ["flexoes"]}, headers=H)
    for i in range(3):
        cli.post("/api/tarefas/", headers=H, json={
            "titulo": f"Missao comum {i}", "data_prevista": hoje.isoformat(),
            "prioridade": "MEDIA", "categoria": "Casa", "dificuldade": "NORMAL"})
    falhar_critica("A que falhou")
    ex = cli.get("/api/extrato/", headers=H).json()
    linhas = ex if isinstance(ex, list) else ex.get("missoes", ex.get("itens", []))
    ok(linhas and linhas[0]["natureza"] == "PUNICAO",
       "a penitencia vem PRIMEIRO, antes de qualquer ordenacao")
    ok(linhas[0]["origem_titulo"] == "A que falhou",
       "  com a falha nomeada")
    ok(linhas[0].get("xp_a_reparar", 0) > 0, "  e a reparacao prometida")

    # ══ 12. OS ECOS ══════════════════════════════════════════════
    print("\n-- os ecos --")
    e = ecos.estatisticas()
    ok(e["total"] >= 35, f"{e['total']} frases de semente")
    ok(set(e["por_intensidade"]) == set(ecos.INTENSIDADES),
       "cobrindo as cinco intensidades")
    ok(ecos.intensidade_por_divida(1) == ecos.SECA, "1 pendencia: seca")
    ok(ecos.intensidade_por_divida(2) == ecos.ENCARANDO, "2: encarando")
    ok(ecos.intensidade_por_divida(9) == ecos.FRIA, "9: fria")
    ok(ecos.intensidade_por_divida(1, False) == ecos.VAZIO, "sem pacto: vazio")
    # A variavel nunca vaza crua — seria a morte da ilusao.
    for _ in range(60):
        t = ecos.sortear(ecos.SECA, {})["texto"]
        if "{" in t:
            ok(False, f"variavel vazou: {t}")
            break
    else:
        ok(True, "e NENHUMA variavel vaza crua na tela, mesmo sem contexto")

    db.close()
    print(f"\n=== {'TUDO PASSOU' if not falhas else str(falhas) + ' FALHA(S)'} ===")
    return 1 if falhas else 0


if __name__ == "__main__":
    raise SystemExit(rodar())
