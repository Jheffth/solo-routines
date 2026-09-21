# -*- coding: utf-8 -*-
"""
TODA COLUNA DO MODELO EXISTE NUM BANCO QUE JÁ EXISTIA.

O DEFEITO QUE ORIGINOU ESTE ARQUIVO

`preferencias_aviso` nasceu como tabela nova, e o `create_all` a criou.
Um deploy depois eu acrescentei `canal_avisos` ao modelo — e não à lista
de `motors/migracao.py`.

`create_all` NÃO ALTERA TABELA EXISTENTE. Está escrito em letras
maiúsculas três vezes naquele arquivo, inclusive num comentário que eu
li antes de errar.

O QUE ISSO CUSTOU, e por que demorou a aparecer

Todo acesso a `PreferenciaAviso` passou a levantar — e o primeiro deles
está em `avisos.preferencia()`, logo no começo de `pendentes()`. O
varredor engole a falha por hunter de propósito (um hunter com problema
não pode calar os outros), e essa decisão, que está certa, transformou
um erro de schema em SILÊNCIO ABSOLUTO.

O fechamento continuou impecável: as missões acendiam às 20:00 e
fracassavam às 22:31, no minuto. E nenhum aviso saía. O sintoma que
chegou ao Arquiteto foi "o bot mandou duas notificações e nunca mais".

COMO ESTE TESTE PEGA

Ele simula o caso real — um banco criado com o schema ANTIGO, que
depois recebe a migração — e então confere, tabela por tabela, que toda
coluna que o modelo declara existe de verdade. Comparar o modelo com um
banco recém-criado não pegaria nada: aí o `create_all` acerta sempre.

Uso: DATABASE_URL=sqlite:///./x.db SECRET_KEY=... python test_migracao_colunas.py
"""
import os

from sqlalchemy import create_engine, inspect, text


def ok(cond, msg):
    print(("  [ok]  " if cond else "  [XX]  ") + msg)
    assert cond, msg


def main_teste():
    import database
    from motors import migracao

    url = os.environ["DATABASE_URL"]
    engine = create_engine(url)

    print("\n=== MIGRACAO: O MODELO CABE NO BANCO ===")

    # ── 1 · o caso real: a coluna chega DEPOIS da tabela ─────────────
    #
    # Cria a tabela sem a coluna nova, como o servidor a tinha, e deixa a
    # migração consertar. Se `canal_avisos` não estiver na lista de
    # COLUNAS, ela continua faltando — e é exatamente o defeito.
    with engine.begin() as cx:
        cx.execute(text("DROP TABLE IF EXISTS preferencias_aviso"))
        cx.execute(text("""
            CREATE TABLE preferencias_aviso (
                id INTEGER PRIMARY KEY,
                usuario_id INTEGER NOT NULL,
                acendeu BOOLEAN, beira BOOLEAN,
                venceu BOOLEAN, portao BOOLEAN,
                minutos_beira INTEGER, minutos_portao INTEGER,
                silencio_de VARCHAR(5), silencio_ate VARCHAR(5),
                atualizado_em DATETIME
            )"""))

    cols = {c["name"] for c in inspect(engine).get_columns("preferencias_aviso")}
    ok("canal_avisos" not in cols,
       "o banco 'antigo' realmente nao tem a coluna (o cenario e o certo)")

    migracao.migrar()

    cols = {c["name"] for c in inspect(engine).get_columns("preferencias_aviso")}
    ok("canal_avisos" in cols,
       "e a migracao a acrescenta — era ISTO que faltava")

    # ── 2 · e o motor volta a funcionar ──────────────────────────────
    #
    # Conferir a coluna no `inspect` prova o DDL. Só uma leitura de
    # verdade prova que o ORM atravessa — e era o ORM que levantava.
    from motors import avisos
    db = database.SessionLocal()
    try:
        u = db.query(database.Usuario).filter_by(ativo=True).first()
        p = avisos.preferencia(db, u)
        db.commit()
        ok(p is not None, "ler a preferencia do hunter nao levanta mais")
        ok((p.canal_avisos or "telegram") in ("telegram", "whatsapp", "ambos"),
           "e o canal tem um valor utilizavel mesmo vindo NULL do banco")
    finally:
        db.close()

    # ── 3 · A REGRA GERAL, para nao ser o meu ultimo esquecimento ────
    #
    # Toda coluna de todo modelo tem de existir no banco. Num banco
    # recem-criado isso e trivial — o `create_all` acerta. O valor deste
    # laco e rodar DEPOIS do cenario acima, com uma tabela que ja
    # existia: e assim que o servidor de verdade e.
    insp = inspect(engine)
    tabelas_no_banco = set(insp.get_table_names())
    faltando = []
    for nome, tabela in database.Base.metadata.tables.items():
        if nome not in tabelas_no_banco:
            continue
        reais = {c["name"] for c in insp.get_columns(nome)}
        for coluna in tabela.columns:
            if coluna.name not in reais:
                faltando.append(f"{nome}.{coluna.name}")

    ok(not faltando,
       "toda coluna de todo modelo existe no banco" +
       (f" — FALTAM: {', '.join(faltando)}" if faltando else ""))

    # ── 4 · a migracao e idempotente ─────────────────────────────────
    # Ela roda em TODO start. Se a segunda passada falhasse, o segundo
    # deploy do dia derrubaria o app.
    migracao.migrar()
    migracao.migrar()
    ok(True, "rodar a migracao tres vezes seguidas nao quebra")

    print("\n=== MIGRACAO OK ===\n")


if __name__ == "__main__":
    # A app precisa subir uma vez para criar o schema e semear.
    from fastapi.testclient import TestClient
    import main
    with TestClient(main.app):
        pass
    main_teste()
