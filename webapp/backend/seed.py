from database import (
    SessionLocal, Usuario, Nivel, Conquista, Recompensa,
    ConfiguracaoApp, criar_tabelas
)
from auth.service import hash_senha
from datetime import datetime


# ── Conquistas de Dungeon (forjadas depois do seed original) ──────────────────
# Inseridas também em bancos JÁ populados, via _garantir_conquistas_extra.
CONQUISTAS_EXTRA = [
    ("primeira_travessia", "Primeira Travessia",  "Faça o primeiro clear de uma Dungeon",      "🌀", "#7c3aed", 100, 20,  "dungeon_clears",   1),
    ("perfeccionista",     "Perfeccionista",      "Conquiste um clear rank S numa Dungeon",    "⭐", "#fbbf24", 250, 60,  "dungeon_clear_s",  1),
    ("guardiao_portao",    "Guardião do Portão",  "Mantenha 7 dias de streak numa Dungeon",    "🚪", "#06b6d4", 300, 80,  "dungeon_streak",   7),
    ("cacador_eventos",    "Caçador de Eventos",  "Capture 10 eventos dentro de Dungeons",     "⚡", "#f59e0b", 200, 40,  "dungeon_eventos", 10),
    ("maratonista",        "Maratonista",         "Acumule 10 horas dentro de Dungeons",       "⏳", "#10b981", 350, 90,  "dungeon_tempo",  600),
    ("imparavel",          "Imparável",           "Some 30 clears de Dungeon",                 "🔥", "#ef4444", 800, 200, "dungeon_clears",  30),
]


# ── Comemorativas do Arquiteto ───────────────────────────────────────────────
# Marcos do desenvolvimento do Sistema. Só aparecem para o Arquiteto e são
# concedidas manualmente (condicao_tipo = "manual" — nunca desbloqueiam sozinhas).
CONQUISTAS_ARQUITETO = [
    ("dominio_habilidades", "Domínio das Habilidades",
     "Desenvolvimento integrado S-Rank (Caçador, Opus e Gemini)", "💻", "#38bdf8", 5000, 1000),
    ("dominio_forja",       "Domínio da Forja",
     "A Arte da Criação — forjou o próprio Sistema", "⚒", "#10b981", 3000, 600),
    ("arquiteto_supremo",   "Arquiteto Supremo",
     "Ergueu o Sistema do vazio à existência", "🌌", "#a855f7", 10000, 2000),
    # Insígnias pessoais — medalhas SVG próprias (ver MEDALHAS_CUSTOM no frontend)
    ("jh3ffth",             "JH3FFTH, o Arquiteto",
     "A insígnia de quem ativou a Forja da Criação", "🛡", "#ef4444", 7500, 1500),
    ("solo",                "SOLO",
     "O selo da empresa — sistema tático de produtividade S-Rank", "🌌", "#a855f7", 7500, 1500),
    # Marco da Rede Social — cristal glacial SVG (js/badges/nexus-social.js)
    ("nexus-social",        "Nexus Social",
     "Forjou a Rede Social, o Chat e o Sistema de Lista de Amigos", "🌐", "#38bdf8", 6000, 1200),
    # Femme Fatale — róseo acetinado, pétalas de rosa, coroa (js/badges/isabella.js)
    ("isabella",            "Isabella Costa · Femme Fatale",
     "A primeira modelo do Sistema — chegou com graça e ficou na memória", "🏵️", "#f48fb1", 6500, 1300),
]

# ── O Chamado do Arquiteto ───────────────────────────────────────────────────
# Concedida automaticamente a quem entra pelo convite do Arquiteto.
# Visível para o próprio hunter (não é exclusiva do Arquiteto).
CONQUISTA_CHAMADO = (
    "chamado_arquiteto", "O Chamado do Arquiteto",
    "Você foi convocado pessoalmente para o Sistema", "📜", "#38bdf8", 500, 100,
    "manual", 0,
)

# ── Badges presenteáveis ─────────────────────────────────────────────────────
# O Arquiteto pode anexar qualquer uma destas a um convite.
# Não desbloqueiam sozinhas (condicao_tipo = "manual").
CONQUISTAS_PRESENTE = [
    ("diana",        "O Mono Diana",
     "Presente do Arquiteto — maestria reconhecida", "🌙", "#bae6fd", 1000, 200),
    ("pioneiro",     "Pioneiro do Sistema",
     "Entrou quando o Sistema ainda era jovem", "🌱", "#34d399", 750, 150),
    ("aliado",       "Aliado de Confiança",
     "Convocado por laço pessoal do Arquiteto", "🤝", "#f59e0b", 600, 120),
    # Legado — insígnia com arte própria (js/badges/mono-evelynn.js)
    ("mono_evelynn", "Mono Evelynn",
     "Legado — o abraço da agonia", "💜", "#ff2e9a", 2500, 500),
]


# ── Materiais que circulam na Casa de Trocas ─────────────────────────────────
# Emblemas personalizados podem mudar de dono entre hunters. Conquistas de
# missão JAMAIS entram aqui — são prova de esforço próprio e não se negociam.
# O Arquiteto pode ligar/desligar qualquer um destes pelo catálogo.
# Ficam de fora de propósito: "dominio_habilidades" e "arquiteto_supremo" são
# marcos do desenvolvimento do Sistema, não colecionáveis. O Arquiteto pode
# liberá-los a qualquer momento pelo Catálogo, se mudar de ideia.
TRANSFERIVEIS = {
    "solo", "jh3ffth", "dominio_forja",
    "diana", "pioneiro", "aliado", "mono_evelynn",
    "nexus-social", "isabella",
}


def _sincronizar_transferiveis(db):
    """
    Garante o estado correto dos materiais que circulam. Roda sempre.

    ARMADILHA JÁ PAGA — não reintroduzir: a primeira versão desta função
    filtrava por `transferivel == False` para ser idempotente. O efeito
    colateral foi que, quando a regra "circular derruba a exclusividade"
    entrou depois, ela nunca alcançou os emblemas JÁ marcados como
    transferíveis — solo e jh3ffth continuaram exclusivos do Arquiteto e
    sumiam do perfil de quem os recebia.

    A lição: idempotência se faz comparando o estado desejado com o atual,
    campo a campo, e não pulando registros já tocados. Por isso aqui a
    função varre todos os alvos e reconcilia cada invariante.
    """
    try:
        mudou = 0

        # 1. O que está na lista e é manual deve circular
        for q in db.query(Conquista).filter(Conquista.codigo.in_(TRANSFERIVEIS)).all():
            if (q.condicao_tipo or "").lower() != "manual":
                continue                      # missão não circula, nem listada
            if not q.transferivel:
                q.transferivel = True
                mudou += 1

        # A sessão do projeto usa autoflush=False (database.py). Sem este
        # flush, a consulta do passo 2 leria o estado ANTERIOR e não veria
        # o que acabou de ser marcado aqui em cima.
        db.flush()

        # 2. INVARIANTE: o que circula não pode ser exclusivo do Arquiteto.
        #    Se o emblema muda de dono, quem recebe precisa enxergá-lo.
        #    Vale para qualquer transferível, inclusive os liberados à mão
        #    pelo Catálogo em versões antigas.
        for q in db.query(Conquista).filter(Conquista.transferivel == True).all():
            if getattr(q, "exclusiva_arquiteto", False):
                q.exclusiva_arquiteto = False
                mudou += 1

        if mudou:
            db.commit()
            print(f"[SEED] {mudou} ajuste(s) nos materiais da Casa de Trocas.")
    except Exception as e:
        db.rollback()
        print(f"[SEED] ⚠️ status de troca não aplicado: {e}")


def _garantir_conquistas_extra(db):
    """Upsert defensivo: forja as conquistas novas que ainda não existem no banco."""
    existentes = {c[0] for c in db.query(Conquista.codigo).all()}
    novas = 0
    for cod, tit, desc, ico, cor, xp_b, mc_b, cond_t, cond_v in CONQUISTAS_EXTRA:
        if cod not in existentes:
            db.add(Conquista(
                codigo=cod, titulo=tit, descricao=desc, icone=ico, cor=cor,
                xp_bonus=xp_b, moedas_bonus=mc_b,
                condicao_tipo=cond_t, condicao_valor=cond_v,
            ))
            novas += 1
    # O Chamado do Arquiteto (não é exclusiva — quem recebe, exibe)
    cod, tit, desc, ico, cor, xp_b, mc_b, cond_t, cond_v = CONQUISTA_CHAMADO
    if cod not in existentes:
        db.add(Conquista(
            codigo=cod, titulo=tit, descricao=desc, icone=ico, cor=cor,
            xp_bonus=xp_b, moedas_bonus=mc_b,
            condicao_tipo=cond_t, condicao_valor=cond_v,
        ))
        novas += 1

    # Badges presenteáveis (anexáveis a convites)
    for cod, tit, desc, ico, cor, xp_b, mc_b in CONQUISTAS_PRESENTE:
        if cod not in existentes:
            db.add(Conquista(
                codigo=cod, titulo=tit, descricao=desc, icone=ico, cor=cor,
                xp_bonus=xp_b, moedas_bonus=mc_b,
                condicao_tipo="manual", condicao_valor=0,
            ))
            novas += 1

    # Comemorativas do Arquiteto
    for cod, tit, desc, ico, cor, xp_b, mc_b in CONQUISTAS_ARQUITETO:
        if cod not in existentes:
            c = Conquista(
                codigo=cod, titulo=tit, descricao=desc, icone=ico, cor=cor,
                xp_bonus=xp_b, moedas_bonus=mc_b,
                condicao_tipo="manual", condicao_valor=0,
            )
            try:
                c.exclusiva_arquiteto = True
                c.visivel = True
            except Exception:
                pass
            db.add(c)
            novas += 1
    if novas:
        db.commit()
        print(f"[SEED] {novas} conquistas forjadas no banco existente.")

    _sincronizar_transferiveis(db)

    # ── Patch: garante email do Arquiteto (necessário para login via Google) ──
    arq = db.query(Usuario).filter(Usuario.nivel_acesso == "Arquiteto").first()
    if arq and not arq.email:
        arq.email = "jcs.costa.santos@gmail.com"   # lowercase para casar com OAuth
        db.commit()
        print("[SEED] Email do Arquiteto atualizado para Google OAuth.")


def popular_banco():
    criar_tabelas()
    db = SessionLocal()
    try:
        if db.query(Usuario).count() > 0:
            _garantir_conquistas_extra(db)
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
            email          = "jcs.costa.santos@gmail.com",
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
        _presentes = [(c[0], c[1], c[2], c[3], c[4], c[5], c[6], "manual", 0) for c in CONQUISTAS_PRESENTE]
        for cod, tit, desc, ico, cor, xp_b, mc_b, cond_t, cond_v in conquistas_data + CONQUISTAS_EXTRA + [CONQUISTA_CHAMADO] + _presentes:
            db.add(Conquista(
                codigo=cod, titulo=tit, descricao=desc, icone=ico, cor=cor,
                xp_bonus=xp_b, moedas_bonus=mc_b,
                condicao_tipo=cond_t, condicao_valor=cond_v
            ))
        for cod, tit, desc, ico, cor, xp_b, mc_b in CONQUISTAS_ARQUITETO:
            db.add(Conquista(
                codigo=cod, titulo=tit, descricao=desc, icone=ico, cor=cor,
                xp_bonus=xp_b, moedas_bonus=mc_b,
                condicao_tipo="manual", condicao_valor=0,
                exclusiva_arquiteto=True, visivel=True,
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
        _sincronizar_transferiveis(db)
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
