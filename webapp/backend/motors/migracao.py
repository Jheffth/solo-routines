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
    # Loja: o item passou a ter TIPO, para poder entregar cosméticos.
    # 'externa' é o padrão e descreve o que a loja já vendia (recompensas da
    # vida real), então as linhas antigas continuam corretas sem tocar nelas.
    ("recompensas",               "tipo",                "VARCHAR(20) DEFAULT 'externa'", "VARCHAR(20) DEFAULT 'externa'"),
    ("recompensas",               "payload",             "VARCHAR(80)",                 "VARCHAR(80)"),
    # Cronômetro: a missão geral passou a registrar quando começou.
    ("tarefas_dia",               "iniciada_em",         "DATETIME",                    "TIMESTAMP"),
    # Prazo da missao (motors/economia.py calcula por prioridade x dificuldade)
    ("rotinas",     "prazo_minutos",       "INTEGER",                     "INTEGER"),
    ("rotinas",     "prazo_personalizado", "BOOLEAN NOT NULL DEFAULT 0",  "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("tarefas_dia", "prazo_minutos",       "INTEGER",                     "INTEGER"),
    ("tarefas_dia", "prazo_personalizado", "BOOLEAN NOT NULL DEFAULT 0",  "BOOLEAN NOT NULL DEFAULT FALSE"),
    # Reerguer: a segunda chance da rotina de janela, paga em Mana.
    # DEFAULT 0/FALSE importa: as instâncias que já existem nunca foram
    # reerguidas, e sem o default elas nasceriam NULL — que em Python é
    # falsy, mas em SQL não é comparável com `= false`.
    ("execucao_dia", "reerguida",          "BOOLEAN NOT NULL DEFAULT 0",  "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("execucao_dia", "reerguida_em",       "DATETIME",                    "TIMESTAMP"),
    ("execucao_dia", "mana_gasta",         "INTEGER NOT NULL DEFAULT 0",  "INTEGER NOT NULL DEFAULT 0"),
    # Missao passiva: o desfecho do prazo se inverte, e a confissao e o
    # unico jeito de o hunter registrar que quebrou o protocolo.
    # DEFAULT 'ATIVA' importa: toda rotina que ja existe e ativa, e sem o
    # default elas nasceriam NULL — que nao casa com `= 'ATIVA'` em SQL.
    ("rotinas",      "natureza",           "VARCHAR(20) NOT NULL DEFAULT 'ATIVA'",
                                            "VARCHAR(20) NOT NULL DEFAULT 'ATIVA'"),
    ("execucao_dia", "confessada_em",      "DATETIME",                    "TIMESTAMP"),

    # REPETICAO — a missao que conta em vez de concluir.
    #
    # A tabela `contadores` nao entra aqui: ela e NOVA, e o `create_all()`
    # do passo 1 da migracao cuida de tabela nova. Esta lista existe so
    # para coluna em tabela que JA EXISTE, que e o que o create_all nao faz.
    #
    # Todas nulas ou com default: rotina antiga nao vira missao de
    # repeticao por acidente, e `alvo_repeticoes` NULL numa rotina ATIVA
    # nao significa nada — a natureza e quem manda.
    ("rotinas",      "alvo_repeticoes",    "INTEGER",                     "INTEGER"),
    ("rotinas",      "contador_id",        "INTEGER",                     "INTEGER"),
    ("rotinas",      "xp_por_repeticao",   "INTEGER",                     "INTEGER"),
    ("rotinas",      "intervalo_min_seg",  "INTEGER",                     "INTEGER"),
    # DEFAULT 0, e nao NULL: o cartao soma e compara estes numeros. Um NULL
    # viraria `None + 1` em Python e `NULL > 0` em SQL — os dois erram em
    # silencio, cada um do seu jeito.
    ("execucao_dia", "repeticoes",         "INTEGER NOT NULL DEFAULT 0",  "INTEGER NOT NULL DEFAULT 0"),
    ("execucao_dia", "xp_repeticao_pago",  "INTEGER NOT NULL DEFAULT 0",  "INTEGER NOT NULL DEFAULT 0"),
    ("execucao_dia", "ultima_repeticao_em","DATETIME",                    "TIMESTAMP"),
]


# Índices ÚNICOS a garantir em tabelas que já existem.
# create_all() não altera tabela existente, então uma UniqueConstraint nova
# num modelo antigo precisa virar DDL aqui.
# (nome, tabela, colunas) — `CREATE UNIQUE INDEX IF NOT EXISTS` funciona
# igual em SQLite e PostgreSQL 9.5+.
INDICES_UNICOS = [
    ("uq_execucao_dia", "execucao_dia", ["rotina_id", "usuario_id", "data"]),
]


def _garantir_indices_unicos(engine, resultado: dict, tabelas: set) -> None:
    """
    Cria os índices únicos que faltam. Antes, remove duplicatas — um índice
    único não nasce sobre dados que já o violam, e falhar em silêncio aqui
    deixaria o banco aceitando missões duplicadas para sempre.
    """
    for nome, tabela, colunas in INDICES_UNICOS:
        if tabela not in tabelas:
            continue
        try:
            insp = inspect(engine)
            if any(ix.get("name") == nome for ix in insp.get_indexes(tabela)):
                continue
        except Exception as e:
            resultado["erros"].append(f"índices de {tabela}: {e}")
            continue

        cols = ", ".join(colunas)
        try:
            with engine.begin() as conn:
                # Mantém a linha de menor id em cada grupo repetido.
                conn.execute(text(
                    f"DELETE FROM {tabela} WHERE id NOT IN "
                    f"(SELECT MIN(id) FROM {tabela} GROUP BY {cols})"
                ))
                conn.execute(text(
                    f"CREATE UNIQUE INDEX IF NOT EXISTS {nome} ON {tabela} ({cols})"
                ))
            resultado["criadas"].append(f"{tabela}[{nome}]")
        except Exception as e:
            resultado["erros"].append(f"{tabela}[{nome}]: {e}")


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

    # 3. Índices únicos em tabelas antigas
    _garantir_indices_unicos(engine, resultado, tabelas)

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
