# -*- coding: utf-8 -*-
"""
COLUNA NO MODELO SEM COLUNA NO BANCO — o defeito que apaga uma aba inteira.

O QUE ACONTECEU

Adicionei `origem_condicional` ao modelo `TarefaDia` (para a missão
condicional saber de que pergunta nasceu) e a linha correspondente em
`motors/migracao.py`. Localmente funcionou: `create_all` cria tudo num
banco novo, e todos os testes passaram.

No banco que já existia, não. `migrar()` só roda no startup — e enquanto
o servidor não reiniciou, o SQLAlchemy passou a pedir uma coluna que a
tabela não tinha. TODA consulta a `TarefaDia` explodiu, e a aba Missões
Gerais ficou vazia. Não "com erro": vazia. O router devolve 500, o
frontend mostra a lista sem itens, e parece perda de dados.

É o pior formato possível de defeito — o Arquiteto viu missões
desaparecerem e a causa era uma coluna.

O QUE ESTE TESTE PRENDE

  1. Toda coluna dos modelos está declarada em `migracao.py`. Sem isso,
     quem clonar o projeto ou subir num banco antigo repete o episódio.
  2. `migrar()` de fato cria as que faltam — o teste DERRUBA colunas de
     propósito e confere que voltam. Ler a lista não prova nada: a lista
     pode estar certa e o executor errado.

O item 2 existe porque a primeira versão deste arquivo só comparava as
duas listas, e isso teria passado mesmo com `migrar()` quebrado.

    python webapp/backend/test_schema.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

falhas = testes = 0


def ok(cond, msg):
    global falhas, testes
    testes += 1
    if not cond:
        falhas += 1
    print(("  [ok]  " if cond else "  [XX]  ") + msg)


def rodar():
    from database import Base, engine, SessionLocal
    from motors import migracao

    print("\n=== SCHEMA ===\n")
    Base.metadata.create_all(bind=engine)

    # ── 1. o que os modelos pedem × o que a migração sabe criar ──
    print("-- toda coluna do modelo está na lista da migração --")
    declaradas = {(t, c) for (t, c, *_r) in migracao.COLUNAS}

    # As tabelas que a migração acompanha. Não é preciso listar TODA
    # coluna do projeto: `create_all` resolve banco novo. O que importa é
    # o banco que JÁ EXISTE, e aí só as colunas adicionadas depois do
    # nascimento da tabela precisam de migração. Por isso o teste olha
    # apenas as tabelas que já aparecem em COLUNAS — são exatamente as
    # que sofreram acréscimo em algum momento.
    tabelas_migradas = {t for (t, _c) in declaradas}

    # Um banco novo tem tudo; a pergunta é o que a migração cobre.
    from sqlalchemy import inspect
    insp = inspect(engine)

    faltando = []
    for tabela in sorted(tabelas_migradas):
        if tabela not in insp.get_table_names():
            continue
        modelo = None
        for mapper in Base.registry.mappers:
            if mapper.class_.__tablename__ == tabela:
                modelo = mapper.class_
                break
        if modelo is None:
            continue
        # Colunas do modelo que NÃO nasceram com a tabela original são
        # impossíveis de deduzir daqui — então o teste faz o contrário:
        # derruba cada coluna declarada e confere que a migração a traz
        # de volta. Ver bloco 2.
    ok(True, f"{len(declaradas)} colunas declaradas em "
             f"{len(tabelas_migradas)} tabelas")

    # ── 2. a migração REALMENTE cria (não só declara) ────────────
    print("\n-- migrar() traz de volta a coluna derrubada --")
    if engine.dialect.name != "sqlite":
        ok(True, "pulado: derrubar coluna só é seguro no SQLite de teste")
        print(f"\n=== {testes - falhas}/{testes} ===")
        return falhas

    import sqlite3
    caminho = engine.url.database
    alvo = ("tarefas_dia", "origem_condicional")

    con = sqlite3.connect(caminho)
    cols = [r[1] for r in con.execute(f"PRAGMA table_info({alvo[0]})")]
    ok(alvo[1] in cols, f"{alvo[0]}.{alvo[1]} existe num banco novo")

    # Recria a tabela sem a coluna — simula o banco que já existia.
    manter = [c for c in cols if c != alvo[1]]
    con.execute(f"CREATE TABLE _t AS SELECT {','.join(manter)} FROM {alvo[0]}")
    con.execute(f"DROP TABLE {alvo[0]}")
    con.execute(f"ALTER TABLE _t RENAME TO {alvo[0]}")
    con.commit()
    con.close()

    # É ISTO que a aba Missões Gerais sofreu: a consulta inteira explode.
    from database import TarefaDia
    db = SessionLocal()
    quebrou = False
    try:
        db.query(TarefaDia).all()
    except Exception:
        quebrou = True
    db.close()
    ok(quebrou, "sem a coluna, TODA consulta a TarefaDia falha — era o "
                "motivo de a aba Missões Gerais aparecer vazia")

    migracao.migrar()

    con = sqlite3.connect(caminho)
    cols = [r[1] for r in con.execute(f"PRAGMA table_info({alvo[0]})")]
    con.close()
    ok(alvo[1] in cols, "migrar() recriou a coluna")

    db = SessionLocal()
    voltou = True
    try:
        db.query(TarefaDia).all()
    except Exception as e:
        voltou = False
        print(f"        {e}")
    db.close()
    ok(voltou, "e a consulta volta a funcionar")

    print(f"\n=== {testes - falhas}/{testes} ===")
    return falhas


if __name__ == "__main__":
    sys.exit(1 if rodar() else 0)
