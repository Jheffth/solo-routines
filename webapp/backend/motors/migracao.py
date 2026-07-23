# -*- coding: utf-8 -*-
"""
Migração automática AGNÓSTICA DE BANCO (SQLite e PostgreSQL).

Por que existe: as auto-migrações antigas usavam `PRAGMA table_info(...)`,
comando exclusivo do SQLite. Em produção (PostgreSQL) elas falhavam em
silêncio — as colunas novas nunca eram criadas e o app quebrava com erros
enganosos (ex.: login virava "Login ou senha incorretos" porque o SELECT
pedia uma coluna inexistente).

Regras:
  • usa o Inspector do SQLAlchemy (funciona em qualquer dialeto);
  • traduz os tipos por dialeto (BOOLEAN/DEFAULT diferem entre bancos);
  • nunca engole o erro sem avisar: registra no log de startup.
"""
from sqlalchemy import inspect, text

# (tabela, coluna, tipo_sqlite, tipo_postgres)
COLUNAS = [
    # Dungeons
    ("dungeon_sessoes",           "modo_teste",          "BOOLEAN NOT NULL DEFAULT 0",  "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("dungeons",                  "agenda_semanal",      "TEXT",                        "TEXT"),
    ("dungeons",                  "folgas",              "TEXT",                        "TEXT"),
    ("dungeon_missoes",           "dias_semana",         "TEXT",                        "TEXT"),
    ("dungeon_missoes",           "hora_inicio",         "VARCHAR(5)",                  "VARCHAR(5)"),
    ("dungeon_missoes",           "hora_limite",         "VARCHAR(5)",                  "VARCHAR(5)"),
    ("dungeon_missoes",           "penalidade_xp",       "INTEGER",                     "INTEGER"),
    ("dungeon_missao_execucoes",  "xp_perdido",          "INTEGER NOT NULL DEFAULT 0",  "INTEGER NOT NULL DEFAULT 0"),
    # Conquistas
    ("conquistas",                "exclusiva_arquiteto", "BOOLEAN NOT NULL DEFAULT 0",  "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("conquistas",                "visivel",             "BOOLEAN NOT NULL DEFAULT 1",  "BOOLEAN NOT NULL DEFAULT TRUE"),
    # Usuários e convites
    ("usuarios",                  "email",               "VARCHAR(200)",                "VARCHAR(200)"),
    ("convites",                  "nivel_acesso",        "VARCHAR(20) DEFAULT 'User'",  "VARCHAR(20) DEFAULT 'User'"),
    ("convites",                  "badges",              "TEXT",                        "TEXT"),
    # Cerimônia pendente e presentes
    ("conquistas_usuario",        "celebrada",           "BOOLEAN NOT NULL DEFAULT 1",  "BOOLEAN NOT NULL DEFAULT TRUE"),
    ("conquistas_usuario",        "presenteada_por",     "INTEGER",                     "INTEGER"),
    ("conquistas_usuario",        "mensagem",            "VARCHAR(300)",                "VARCHAR(300)"),
    # Emblemas colecionáveis
    ("conquistas",                "colecionavel",        "BOOLEAN NOT NULL DEFAULT 0",  "BOOLEAN NOT NULL DEFAULT FALSE"),
    # Sala de Poderes — a tabela registro_poderes nasce pelo criar_tabelas()
    # Casa de Trocas (Materiais)
    ("conquistas",                "transferivel",        "BOOLEAN NOT NULL DEFAULT 0",  "BOOLEAN NOT NULL DEFAULT FALSE"),
    # Altar de relíquias escolhidas pelo hunter
    ("usuarios",                  "reliquias_fixadas",   "TEXT",                        "TEXT"),
    # Aura cosmética presenteada pelo Arquiteto
    ("usuarios",                  "aura_id",             "VARCHAR(50)",                 "VARCHAR(50)"),
    # Social (amizades e mensagens) — as tabelas nascem via criar_tabelas().
    # Exclusão de mensagens (adicionadas depois da tabela existir):
    ("mensagens",                 "oculta_de",           "BOOLEAN NOT NULL DEFAULT 0",  "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("mensagens",                 "oculta_para",         "BOOLEAN NOT NULL DEFAULT 0",  "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("mensagens",                 "apagada_todos",       "BOOLEAN NOT NULL DEFAULT 0",  "BOOLEAN NOT NULL DEFAULT FALSE"),
]


def migrar(verbose: bool = True) -> dict:
    """
    Garante tabelas e colunas em qualquer banco suportado.
    Retorna {"criadas": [...], "erros": [...]} para o startup registrar.
    """
    from database import engine, criar_tabelas

    resultado = {"criadas": [], "erros": [], "dialeto": engine.dialect.name}

    # 1. Tabelas novas (create_all é seguro: não altera as existentes)
    try:
        criar_tabelas()
    except Exception as e:
        resultado["erros"].append(f"criar_tabelas: {e}")

    # 2. Colunas novas em tabelas já existentes
    postgres = engine.dialect.name.startswith("postgre")
    try:
        insp = inspect(engine)
        tabelas = set(insp.get_table_names())
    except Exception as e:
        resultado["erros"].append(f"inspector indisponível: {e}")
        return resultado

    for tabela, coluna, tipo_sqlite, tipo_pg in COLUNAS:
        if tabela not in tabelas:
            continue                      # tabela ainda não existe: create_all cuidou
        try:
            existentes = {c["name"] for c in insp.get_columns(tabela)}
        except Exception as e:
            resultado["erros"].append(f"{tabela}: {e}")
            continue
        if coluna in existentes:
            continue

        ddl = tipo_pg if postgres else tipo_sqlite
        try:
            with engine.begin() as conn:   # begin() garante COMMIT
                conn.execute(text(f'ALTER TABLE {tabela} ADD COLUMN {coluna} {ddl}'))
            resultado["criadas"].append(f"{tabela}.{coluna}")
        except Exception as e:
            resultado["erros"].append(f"{tabela}.{coluna}: {e}")

    if verbose:
        print(f"[MIGRACAO] Banco: {resultado['dialeto']}")
        if resultado["criadas"]:
            print(f"[MIGRACAO] ✅ Colunas criadas: {', '.join(resultado['criadas'])}")
        else:
            print("[MIGRACAO] ✅ Schema já estava atualizado.")
        for err in resultado["erros"]:
            print(f"[MIGRACAO] ⚠️  {err}")

    return resultado


def verificar_schema() -> list:
    """
    Confere se o banco tem tudo que os modelos esperam.
    Retorna a lista de pendências (vazia = tudo certo).
    Serve de alarme no startup: melhor gritar do que falhar em silêncio.
    """
    from database import engine
    pendencias = []
    try:
        insp = inspect(engine)
        tabelas = set(insp.get_table_names())
        for tabela, coluna, _s, _p in COLUNAS:
            if tabela in tabelas:
                cols = {c["name"] for c in insp.get_columns(tabela)}
                if coluna not in cols:
                    pendencias.append(f"{tabela}.{coluna}")
    except Exception as e:
        pendencias.append(f"(falha ao inspecionar: {e})")
    return pendencias
