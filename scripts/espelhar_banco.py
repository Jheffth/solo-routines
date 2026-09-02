# -*- coding: utf-8 -*-
"""
ESPELHAR — copia o banco de produção para um SQLite local.

    python scripts/espelhar_banco.py

POR QUE ISTO EXISTE

O servidor local conversa com o Postgres do Contabo pela internet. Aquele
servidor está em fuso `Europe/Berlin`; do Brasil, cada consulta é uma
viagem de ida e volta ao outro lado do Atlântico — algo como 200 ms. Uma
tela que faz trinta consultas leva SEIS SEGUNDOS só em latência, e nenhum
ajuste de código conserta isso, porque o gargalo não está no código.

Com um SQLite no disco, as mesmas trinta consultas custam milissegundos.

E há um motivo além da velocidade: hoje o desenvolvimento e a produção
compartilham o MESMO banco. Um teste que crie uma missão a cria na sua
conta de verdade; um script que apague algo apaga de verdade. Separar os
dois é higiene básica, e a lentidão só tornou isso visível.

O QUE ESTE SCRIPT FAZ — E O QUE ELE NÃO FAZ

  · LÊ a produção. Só SELECT. Nenhuma escrita, em nenhuma hipótese.
  · ESCREVE num arquivo novo, local, que você pode apagar sem dó.
  · NÃO toca no seu `.env`. A troca de banco é feita pelo `.bat`, com
    variável de ambiente — `load_dotenv()` não sobrescreve o que já
    existe no ambiente, então quem manda é quem sobe o servidor.

A ordem das tabelas é a de dependência (`sorted_tables`), senão uma
linha filha chegaria antes da mãe e a chave estrangeira recusaria.
"""
import os
import sys

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACK = os.path.join(RAIZ, "webapp", "backend")
sys.path.insert(0, BACK)
os.chdir(BACK)                       # o .env mora aqui

DESTINO = os.path.join(BACK, "solo_local.db")


def espelhar():
    from sqlalchemy import create_engine, inspect, select
    from database import Base, engine as origem      # noqa: E402

    print("\n" + "=" * 64)
    print("  ESPELHAR — producao  →  SQLite local (somente leitura na origem)")
    print("=" * 64)

    # ── A GUARDA QUE IMPEDE O ABSURDO ────────────────────────────
    # Apontar a origem para o proprio destino apagaria o espelho com o
    # conteudo dele mesmo, e o script diria "concluido".
    if origem.dialect.name == "sqlite":
        print("\n[PARADO] A origem ja e um SQLite.")
        print("         Seu .env aponta para um banco local, nao para a producao.")
        print("         Se a intencao era espelhar o Contabo, restaure o")
        print("         DATABASE_URL do .env antes de rodar.")
        return 1

    print(f"\n  origem : {origem.dialect.name} (do .env)")
    print(f"  destino: {DESTINO}")

    if os.path.exists(DESTINO):
        resp = input("\n  O espelho ja existe. Refazer do zero? [s/N] ").strip().lower()
        if resp != "s":
            print("  Cancelado. Nada foi alterado.")
            return 0
        os.remove(DESTINO)
        print("  Espelho anterior removido.")

    destino = create_engine(f"sqlite:///{DESTINO}")
    Base.metadata.create_all(bind=destino)
    print("  Esquema criado no espelho.")

    insp = inspect(origem)
    tabelas_origem = set(insp.get_table_names())

    total_linhas = 0
    puladas = []

    print("\n  copiando:")
    with origem.connect() as con_o, destino.begin() as con_d:
        for tabela in Base.metadata.sorted_tables:
            if tabela.name not in tabelas_origem:
                puladas.append(tabela.name)
                continue

            # Só as colunas que existem NOS DOIS lados. A produção pode
            # estar num commit anterior ao seu, e uma coluna a mais no
            # modelo derrubaria o SELECT inteiro — que foi exatamente o
            # defeito da `origem_condicional` que esvaziou uma aba.
            cols_o = {c["name"] for c in insp.get_columns(tabela.name)}
            cols = [c for c in tabela.columns if c.name in cols_o]
            if not cols:
                puladas.append(tabela.name)
                continue

            linhas = con_o.execute(select(*cols)).mappings().all()
            if linhas:
                # Em lotes: uma tabela de dez mil linhas num INSERT só
                # estoura o limite de variáveis do SQLite.
                for i in range(0, len(linhas), 500):
                    con_d.execute(tabela.insert(), [dict(r) for r in linhas[i:i + 500]])
            total_linhas += len(linhas)
            faltando = len(tabela.columns) - len(cols)
            extra = f"  ({faltando} coluna(s) ausente(s) na origem)" if faltando else ""
            print(f"    {tabela.name:<28} {len(linhas):>6} linha(s){extra}")

    if puladas:
        print(f"\n  tabelas sem correspondente na origem: {', '.join(puladas)}")

    tam = os.path.getsize(DESTINO) / 1024 / 1024
    print(f"\n  {total_linhas} linha(s) copiada(s) — {tam:.1f} MB")
    print("\n" + "=" * 64)
    print("  Pronto. Para subir o servidor usando o espelho:")
    print("      _servidor_local.bat")
    print("  A producao continua intocada, e o .env nao foi alterado.")
    print("=" * 64 + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(espelhar())
