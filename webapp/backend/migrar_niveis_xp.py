"""
Migração: Atualiza a tabela de Níveis com a nova escala de XP (~10x mais lenta)
e recalcula o nível/rank de todos os usuários com base no xp_total atual.

Uso: python migrar_niveis_xp.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal, Nivel, Usuario, get_db

# ── Nova tabela de XP ────────────────────────────────────────────
NIVEIS = [
    (1,  "E-Rank", "O Mais Fraco",                    0,       1000,   20),
    (2,  "E-Rank", "Caçador Iniciante",             1000,       1500,   25),
    (3,  "E-Rank", "Sobrevivente",                  2500,       2000,   25),
    (4,  "E-Rank", "Aspirante",                     4500,       2500,   30),
    (5,  "E-Rank", "Guerreiro Relutante",            7000,       3000,   30),
    (6,  "D-Rank", "Caçador Treinado",             10000,       4000,   50),
    (7,  "D-Rank", "Espadachim das Sombras",       14000,       5000,   55),
    (8,  "D-Rank", "Guardião",                     19000,       6000,   60),
    (9,  "D-Rank", "Vigilante",                    25000,       7000,   65),
    (10, "D-Rank", "Sentinela",                    32000,       8000,   70),
    (11, "C-Rank", "Guerreiro das Sombras",        40000,      10000,   80),
    (12, "C-Rank", "Caçador Veterano",             50000,      12000,   90),
    (13, "C-Rank", "Comandante",                   62000,      14000,   95),
    (14, "C-Rank", "Destruidor",                   76000,      16000,  100),
    (15, "C-Rank", "Lâmina das Trevas",            92000,      18000,  105),
    (16, "C-Rank", "Devastador",                  110000,      20000,  110),
    (17, "C-Rank", "Conquistador",                130000,      22000,  115),
    (18, "C-Rank", "Ceifador",                    152000,      24000,  120),
    (19, "C-Rank", "Sombra Viva",                 176000,      26000,  125),
    (20, "C-Rank", "Mestre das Sombras Jr.",       202000,      28000,  130),
    (21, "B-Rank", "Cavaleiro das Trevas",         230000,      35000,  175),
    (22, "B-Rank", "Paladino Sombrio",             265000,      40000,  190),
    (23, "B-Rank", "Guardião de Elite",            305000,      45000,  205),
    (24, "B-Rank", "Lorde das Sombras",            350000,      50000,  220),
    (25, "B-Rank", "Senhor dos Abismos",           400000,      55000,  235),
    (26, "B-Rank", "Comandante de Elites",         455000,      60000,  250),
    (27, "B-Rank", "Destruidor de Dungeons",       515000,      65000,  265),
    (28, "B-Rank", "Arrasador",                    580000,      70000,  280),
    (29, "B-Rank", "Monarca Menor",                650000,      75000,  295),
    (30, "B-Rank", "Cavaleiro Supremo",            725000,      80000,  320),
    (31, "A-Rank", "Mestre das Sombras",           805000,     100000,  400),
    (32, "A-Rank", "Lorde Supremo",                905000,     110000,  420),
    (33, "A-Rank", "Ceifador Lendário",           1015000,     120000,  440),
    (34, "A-Rank", "Tirano das Trevas",           1135000,     130000,  460),
    (35, "A-Rank", "Arrasador Lendário",          1265000,     140000,  480),
    (36, "A-Rank", "Destruidor de Reinos",        1405000,     150000,  500),
    (37, "A-Rank", "Monarca da Penumbra",         1555000,     160000,  520),
    (38, "A-Rank", "Senhor das Sombras",          1715000,     170000,  540),
    (39, "A-Rank", "Caçador Supremo",             1885000,     180000,  560),
    (40, "A-Rank", "Lâmina do Abismo",            2065000,     200000,  600),
    (41, "S-Rank", "Caçador de Elite",            2265000,     250000,  800),
    (42, "S-Rank", "Destruidor de Monarcas",      2515000,     270000,  850),
    (43, "S-Rank", "Guardião do Mundo",           2785000,     290000,  900),
    (44, "S-Rank", "Tirano Absoluto",             3075000,     310000,  950),
    (45, "S-Rank", "Senhor dos Monarcas",         3385000,     330000, 1000),
    (46, "S-Rank", "Destruidor de Deuses",        3715000,     350000, 1050),
    (47, "S-Rank", "Lorde do Caos",               4065000,     370000, 1100),
    (48, "S-Rank", "Monarca Supremo",             4435000,     390000, 1150),
    (49, "S-Rank", "O Mais Forte",                4825000,     420000, 1200),
    (50, "National-Level", "Monarca das Sombras", 5245000,          0, 5000),
]


def migrar():
    db = SessionLocal()
    try:
        print("[MIGRAÇÃO] Atualizando tabela de Níveis...")

        # Atualiza cada linha da tabela Nivel
        for n, rank, titulo, xp_tot, xp_prox, moedas_b in NIVEIS:
            nivel_row = db.query(Nivel).filter(Nivel.nivel == n).first()
            if nivel_row:
                nivel_row.rank           = rank
                nivel_row.titulo         = titulo
                nivel_row.xp_necessario  = xp_tot
                nivel_row.xp_para_proximo = xp_prox
                nivel_row.moedas_bonus   = moedas_b
                print(f"  ✓ Nível {n:>2} ({rank}) — {xp_prox:>7} XP para próximo")
            else:
                # Cria se não existir
                from database import Nivel as NivelModel
                db.add(NivelModel(
                    nivel=n, rank=rank, titulo=titulo,
                    xp_necessario=xp_tot, xp_para_proximo=xp_prox,
                    moedas_bonus=moedas_b,
                    icone_rank=("⭐" if n == 50 else
                                "🟣" if "S-Rank" in rank else
                                "🔵" if "A-Rank" in rank else
                                "🟢" if "B-Rank" in rank else
                                "🟡" if "C-Rank" in rank else
                                "🟠" if "D-Rank" in rank else "⚪")
                ))
                print(f"  + Nível {n:>2} ({rank}) criado")

        db.flush()

        # Reconstrói mapa de níveis
        nivel_map = {row.nivel: row for row in db.query(Nivel).all()}

        # Recalcula level/rank para todos os usuários não-invioláveis
        print("\n[MIGRAÇÃO] Recalculando nível dos usuários...")
        usuarios = db.query(Usuario).filter(
            Usuario.ativo == True,
            Usuario.inviolavel == False,
        ).all()

        for u in usuarios:
            xp_total = u.xp_total or 0

            # Encontra o nivel correto pelo xp_total acumulado
            nivel_correto = 1
            for n, _, _, xp_necessar, _, _ in NIVEIS:
                if xp_total >= xp_necessar:
                    nivel_correto = n

            row_atual  = nivel_map.get(nivel_correto)
            row_prox   = nivel_map.get(nivel_correto + 1)

            xp_inicio_nivel = row_atual.xp_necessario if row_atual else 0
            xp_atual_no_nivel = xp_total - xp_inicio_nivel
            xp_proximo = row_prox.xp_para_proximo if row_prox else 0

            u.nivel_atual      = nivel_correto
            u.xp_atual         = xp_atual_no_nivel
            u.xp_proximo_nivel = xp_proximo
            u.classe           = row_atual.rank   if row_atual else "E-Rank"
            u.titulo           = row_atual.titulo if row_atual else "O Mais Fraco"

            print(f"  ✓ {u.nome:20} → Nv.{nivel_correto:>2} ({u.classe}) "
                  f"xp_atual={xp_atual_no_nivel}/{xp_proximo}")

        db.commit()
        print("\n[MIGRAÇÃO] ✅ Concluída com sucesso!")

    except Exception as e:
        db.rollback()
        print(f"[MIGRAÇÃO] ❌ Erro: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrar()
