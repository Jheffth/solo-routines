from database import (
    SessionLocal, Usuario, Nivel, Conquista, Recompensa,
    ConfiguracaoApp, criar_tabelas
)
from auth.service import hash_senha
from datetime import datetime


def popular_banco():
    criar_tabelas()
    db = SessionLocal()
    try:
        if db.query(Usuario).count() > 0:
            print("[SEED] Banco de dados já populado. Pulando.")
            return

        print("[SEED] Criando dados iniciais do Solo Routines...")

        # ── Usuário Arquiteto (criado antes do admin, inviolável) ──
        arquiteto = Usuario(
            nome           = "Jefferson",
            login          = "Jh3ffth",
            senha_hash     = hash_senha("1601Jcs33@2503"),
            classe         = "National Level",
            titulo         = "O Arquiteto do Sistema",
            xp_total       = 999999,
            xp_atual       = 999999,
            nivel_atual    = 100,
            xp_proximo_nivel = 9999999,
            moedas         = 999999,
            streak_atual   = 0,
            streak_max     = 0,
            nivel_acesso   = "Arquiteto",
            inviolavel     = True,
            ativo          = True,
            criado_em      = datetime.utcnow(),
        )
        db.add(arquiteto)

        # ── Usuário admin ──────────────────────────────────────
        admin = Usuario(
            nome="Administrador",
            login="admin",
            senha_hash=hash_senha("admin123"),
            classe="S-Rank",
            titulo="Monarca das Sombras",
            xp_total=0,
            xp_atual=0,
            nivel_atual=1,
            xp_proximo_nivel=100,
            moedas=500,
            nivel_acesso="Criador",
            ativo=True,
        )
        db.add(admin)

        # ── Tabela de Níveis ───────────────────────────────────
        niveis_data = [
            # nivel, rank,              titulo,                    xp_total,   xp_para_prox, moedas_bonus
            (1,  "E-Rank", "O Mais Fraco",                              0,         1000,   20),
            (2,  "E-Rank", "Caçador Iniciante",                      1000,         1500,   25),
            (3,  "E-Rank", "Sobrevivente",                           2500,         2000,   25),
            (4,  "E-Rank", "Aspirante",                              4500,         2500,   30),
            (5,  "E-Rank", "Guerreiro Relutante",                    7000,         3000,   30),
            (6,  "D-Rank", "Caçador Treinado",                      10000,         4000,   50),
            (7,  "D-Rank", "Espadachim das Sombras",                14000,         5000,   55),
            (8,  "D-Rank", "Guardião",                              19000,         6000,   60),
            (9,  "D-Rank", "Vigilante",                             25000,         7000,   65),
            (10, "D-Rank", "Sentinela",                             32000,         8000,   70),
            (11, "C-Rank", "Guerreiro das Sombras",                 40000,        10000,   80),
            (12, "C-Rank", "Caçador Veterano",                      50000,        12000,   90),
            (13, "C-Rank", "Comandante",                            62000,        14000,   95),
            (14, "C-Rank", "Destruidor",                            76000,        16000,  100),
            (15, "C-Rank", "Lâmina das Trevas",                     92000,        18000,  105),
            (16, "C-Rank", "Devastador",                           110000,        20000,  110),
            (17, "C-Rank", "Conquistador",                         130000,        22000,  115),
            (18, "C-Rank", "Ceifador",                             152000,        24000,  120),
            (19, "C-Rank", "Sombra Viva",                          176000,        26000,  125),
            (20, "C-Rank", "Mestre das Sombras Jr.",               202000,        28000,  130),
            (21, "B-Rank", "Cavaleiro das Trevas",                 230000,        35000,  175),
            (22, "B-Rank", "Paladino Sombrio",                     265000,        40000,  190),
            (23, "B-Rank", "Guardião de Elite",                    305000,        45000,  205),
            (24, "B-Rank", "Lorde das Sombras",                    350000,        50000,  220),
            (25, "B-Rank", "Senhor dos Abismos",                   400000,        55000,  235),
            (26, "B-Rank", "Comandante de Elites",                 455000,        60000,  250),
            (27, "B-Rank", "Destruidor de Dungeons",               515000,        65000,  265),
            (28, "B-Rank", "Arrasador",                            580000,        70000,  280),
            (29, "B-Rank", "Monarca Menor",                        650000,        75000,  295),
            (30, "B-Rank", "Cavaleiro Supremo",                    725000,        80000,  320),
            (31, "A-Rank", "Mestre das Sombras",                   805000,       100000,  400),
            (32, "A-Rank", "Lorde Supremo",                        905000,       110000,  420),
            (33, "A-Rank", "Ceifador Lendário",                   1015000,       120000,  440),
            (34, "A-Rank", "Tirano das Trevas",                   1135000,       130000,  460),
            (35, "A-Rank", "Arrasador Lendário",                  1265000,       140000,  480),
            (36, "A-Rank", "Destruidor de Reinos",                1405000,       150000,  500),
            (37, "A-Rank", "Monarca da Penumbra",                 1555000,       160000,  520),
            (38, "A-Rank", "Senhor das Sombras",                  1715000,       170000,  540),
            (39, "A-Rank", "Caçador Supremo",                     1885000,       180000,  560),
            (40, "A-Rank", "Lâmina do Abismo",                    2065000,       200000,  600),
            (41, "S-Rank", "Caçador de Elite",                    2265000,       250000,  800),
            (42, "S-Rank", "Destruidor de Monarcas",              2515000,       270000,  850),
            (43, "S-Rank", "Guardião do Mundo",                   2785000,       290000,  900),
            (44, "S-Rank", "Tirano Absoluto",                     3075000,       310000,  950),
            (45, "S-Rank", "Senhor dos Monarcas",                 3385000,       330000, 1000),
            (46, "S-Rank", "Destruidor de Deuses",                3715000,       350000, 1050),
            (47, "S-Rank", "Lorde do Caos",                       4065000,       370000, 1100),
            (48, "S-Rank", "Monarca Supremo",                     4435000,       390000, 1150),
            (49, "S-Rank", "O Mais Forte",                        4825000,       420000, 1200),
            (50, "National-Level", "Monarca das Sombras",         5245000,            0, 5000),
        ]
        for n, rank, titulo, xp_total, xp_prox, moedas_b in niveis_data:
            db.add(Nivel(
                nivel=n, rank=rank, titulo=titulo,
                xp_necessario=xp_total, xp_para_proximo=xp_prox,
                moedas_bonus=moedas_b,
                icone_rank="⭐" if n == 50 else ("🟣" if "S-Rank" in rank else
                            "🔵" if "A-Rank" in rank else
                            "🟢" if "B-Rank" in rank else
                            "🟡" if "C-Rank" in rank else
                            "🟠" if "D-Rank" in rank else "⚪")
            ))

        # ── Conquistas ─────────────────────────────────────────
        conquistas_data = [
            ("primeiro_despertar",   "Primeiro Despertar",     "Conclua sua 1ª missão",              "🔵", "#3b82f6", 50,  10, "execucoes_total", 1),
            ("sete_dias",            "7 Dias de Treinamento",  "Mantenha um streak de 7 dias",       "🟣", "#7c3aed", 150, 30, "streak", 7),
            ("mes_cacador",          "Mês do Caçador",         "Mantenha um streak de 30 dias",      "🟠", "#f59e0b", 500, 100,"streak", 30),
            ("frenesi",              "Frenesi de Batalha",     "Conclua 5 missões em 1 dia",         "⚔️", "#ef4444", 200, 50, "execucoes_dia", 5),
            ("dungeon_cleared",      "Dungeon Cleared",        "100% das rotinas em 1 semana",       "🎯", "#10b981", 300, 75, "rotinas_semana_perfeita", 1),
            ("centuriao",            "Centurião",              "Conclua 100 missões",                "👥", "#06b6d4", 500, 150,"execucoes_total", 100),
            ("lendario",             "Lendário",               "Alcance o nível 50",                 "🌑", "#a855f7", 2000,500,"nivel", 50),
            ("mestre_rotinas",       "Mestre das Rotinas",     "Conclua 50 rotinas recorrentes",     "📅", "#8b5cf6", 400, 80, "rotinas_total", 50),
            ("despertar_semana",     "Despertar Semanal",      "Complete todas rotinas por 4 semanas","💪", "#ec4899", 600, 120,"semanas_perfeitas", 4),
            ("colecao_moedas",       "Tesoureiro de Mana",     "Acumule 1000 Mana Coins",            "💰", "#f59e0b", 250, 50, "moedas_acumuladas", 1000),
        ]
        for cod, tit, desc, ico, cor, xp_b, mc_b, cond_t, cond_v in conquistas_data:
            db.add(Conquista(
                codigo=cod, titulo=tit, descricao=desc, icone=ico, cor=cor,
                xp_bonus=xp_b, moedas_bonus=mc_b,
                condicao_tipo=cond_t, condicao_valor=cond_v
            ))

        # ── Recompensas padrão ─────────────────────────────────
        recompensas_data = [
            ("Episódio de Anime",    "Assista um episódio do seu anime favorito",    "📺", "Lazer",    50,  0, 1),
            ("Lanche Especial",      "Coma algo especial que você gosta",            "🍕", "Alimentação", 100, 0, 1),
            ("Dia de Jogo",          "Dedique algumas horas ao seu jogo favorito",   "🎮", "Lazer",    150, 0, 1),
            ("Série/Filme",          "Assista a um filme ou episódios de série",     "🎬", "Lazer",    120, 0, 1),
            ("Passeio Livre",        "Dê um passeio sem objetivos",                  "🚶", "Pessoal",  80,  0, 1),
            ("Compra Pequena",       "Permita uma compra pequena que você quer",     "🛒", "Pessoal",  300, 5, 3),
            ("Descanso Total",       "Um dia sem obrigações extras",                 "😴", "Saúde",    200, 3, 1),
            ("Restaurante",          "Jante em um restaurante especial",             "🍽️", "Alimentação", 500, 10, 2),
            ("Upgrade de Equip.",    "Compre um item para sua configuração",         "💻", "Trabalho", 1000, 20, 3),
            ("Férias Mini",          "Uma tarde/manhã completamente livre",          "🏖️", "Pessoal",  800, 15, 2),
        ]
        for tit, desc, ico, cat, custo_mc, nivel_min, estoque in recompensas_data:
            db.add(Recompensa(
                titulo=tit, descricao=desc, icone=ico,
                categoria=cat, custo_moedas=custo_mc,
                nivel_minimo=nivel_min, estoque=estoque
            ))

        # ── Configurações padrão do App ────────────────────────
        configs_padrao = [
            ("app_nome",             "Solo Routines"),
            ("logo_url",             ""),
            ("fonte_titulo",         "Cinzel Decorative"),
            ("fonte_secao",          "Rajdhani"),
            ("fonte_body",           "Inter"),
            ("cor_destaque",         "#7c3aed"),
            ("notif_manha",          "07:00"),
            ("notif_tarde",          "14:00"),
            ("notif_noite",          "21:00"),
        ]
        for chave, valor in configs_padrao:
            db.add(ConfiguracaoApp(chave=chave, valor=valor))

        db.commit()
        print("[SEED] ✅ Dados iniciais criados com sucesso!")
        print("[SEED] Login: admin | Senha: admin123")
    except Exception as e:
        db.rollback()
        print(f"[SEED] ❌ Erro: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    popular_banco()
