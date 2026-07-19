from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Date, DateTime,
    Boolean, Text, ForeignKey, JSON, text
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from config import DATABASE_URL

_is_sqlite = DATABASE_URL.startswith("sqlite")
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ==============================================================================
# USUÁRIO / PERSONAGEM (Hunter)
# ==============================================================================
class Usuario(Base):
    __tablename__ = "usuarios"

    id              = Column(Integer, primary_key=True, index=True)
    nome            = Column(String(100), nullable=False)
    login           = Column(String(50), unique=True, nullable=False, index=True)
    email           = Column(String(200), nullable=True, index=True)  # recuperação de senha
    senha_hash      = Column(String(200), nullable=False)
    avatar_url      = Column(String(500), nullable=True)   # foto de perfil ou URL

    # Personagem RPG
    classe          = Column(String(50), default="E-Rank")   # E → D → C → B → A → S → National
    titulo          = Column(String(100), default="O Mais Fraco")
    xp_total        = Column(Integer, default=0)             # XP acumulado total
    xp_atual        = Column(Integer, default=0)             # XP no nível atual
    nivel_atual     = Column(Integer, default=1)
    xp_proximo_nivel = Column(Integer, default=100)          # XP necessário para o próximo nível

    # Moeda in-game
    moedas          = Column(Integer, default=0)             # Mana Coins

    # Streaks
    streak_atual    = Column(Integer, default=0)
    streak_max      = Column(Integer, default=0)
    ultima_atividade = Column(Date, nullable=True)           # último dia com atividade

    # Sistema
    nivel_acesso    = Column(String(20), default="User")     # Arquiteto | Criador | Admin | User
    inviolavel      = Column(Boolean, default=False)         # Arquiteto: não pode ser excluído/modificado
    ativo           = Column(Boolean, default=True)
    criado_em       = Column(DateTime, default=datetime.utcnow)
    ultimo_acesso   = Column(DateTime, nullable=True)

    # Relacionamentos
    rotinas         = relationship("Rotina", back_populates="usuario", lazy="dynamic")
    tarefas         = relationship("TarefaDia", back_populates="usuario", lazy="dynamic")
    execucoes       = relationship("Execucao", back_populates="usuario", lazy="dynamic")
    conquistas      = relationship("ConquistaUsuario", back_populates="usuario", lazy="dynamic")
    recompensas_res = relationship("RecompensaUsuario", back_populates="usuario", lazy="dynamic")


# ==============================================================================
# ROTINAS (Missões Recorrentes)
# ==============================================================================
class Rotina(Base):
    __tablename__ = "rotinas"

    id               = Column(Integer, primary_key=True, index=True)
    titulo           = Column(String(200), nullable=False)
    descricao        = Column(Text, nullable=True)
    tipo             = Column(String(20), nullable=False)    # DIARIA | SEMANAL | MENSAL | ANUAL
    dias_semana      = Column(Text, nullable=True)           # JSON: "[0,1,2,3,4]" (0=seg, 6=dom)
    dia_mes          = Column(Integer, nullable=True)        # para MENSAL (1-31)
    mes_dia          = Column(String(5), nullable=True)      # para ANUAL "MM-DD"
    categoria        = Column(String(50), default="Pessoal") # Saúde|Trabalho|Estudo|Casa|Pessoal|Combate
    prioridade       = Column(String(20), default="MEDIA")   # CRITICA | ALTA | MEDIA | BAIXA
    icone            = Column(String(10), default="⚔️")
    cor              = Column(String(7), default="#7c3aed")

    # Recompensas
    xp_recompensa    = Column(Integer, default=50)
    moedas_recompensa = Column(Integer, default=5)
    penalidade_xp    = Column(Integer, default=0)   # XP perdido se não completar
    hora_inicio      = Column(String(5), nullable=True)      # "HH:MM"
    hora_fim         = Column(String(5), nullable=True)      # "HH:MM"
    dificuldade      = Column(String(20), default="NORMAL")  # FACIL | NORMAL | DIFICIL | LENDARIO

    # Controle
    ativo            = Column(Boolean, default=True)
    status           = Column(String(20), default="ATIVA")    # ATIVA | PAUSADA | CANCELADA | CONCLUIDA
    usuario_id       = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    ultima_execucao  = Column(Date, nullable=True)
    concluida_em     = Column(DateTime, nullable=True)
    cancelada_em     = Column(DateTime, nullable=True)
    criado_em        = Column(DateTime, default=datetime.utcnow)

    usuario          = relationship("Usuario", back_populates="rotinas")
    execucoes        = relationship("Execucao", back_populates="rotina", lazy="dynamic")
    exec_dias        = relationship("ExecucaoDia", back_populates="rotina", lazy="dynamic")


# ==============================================================================
# EXECUÇÃO DIÁRIA (Instância diária de uma rotina recorrente)
# Cada dia cria um registro separado: PENDENTE → ATIVA → CONCLUIDA/FRACASSADA
# ==============================================================================
class ExecucaoDia(Base):
    __tablename__ = "execucao_dia"

    id            = Column(Integer, primary_key=True, index=True)
    rotina_id     = Column(Integer, ForeignKey("rotinas.id"), nullable=False, index=True)
    usuario_id    = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    data          = Column(Date, nullable=False, index=True)   # dia desta instância

    # Ciclo de vida: PENDENTE → ATIVA → CONCLUIDA | FRACASSADA | CANCELADA
    status        = Column(String(20), default="PENDENTE")

    iniciada_em   = Column(DateTime, nullable=True)    # quando user clicou Iniciar
    concluida_em  = Column(DateTime, nullable=True)    # quando concluiu
    fracassada_em = Column(DateTime, nullable=True)    # quando o prazo venceu
    cancelada_em  = Column(DateTime, nullable=True)    # quando cancelou

    xp_ganho      = Column(Integer, default=0)
    xp_perdido    = Column(Integer, default=0)         # penalidade aplicada
    moedas_ganhas = Column(Integer, default=0)
    criado_em     = Column(DateTime, default=datetime.utcnow)

    rotina        = relationship("Rotina", back_populates="exec_dias")


# ==============================================================================
# TAREFAS DO DIA (Missões Avulsas)
# ==============================================================================
class TarefaDia(Base):
    __tablename__ = "tarefas_dia"

    id               = Column(Integer, primary_key=True, index=True)
    titulo           = Column(String(200), nullable=False)
    descricao        = Column(Text, nullable=True)
    data_prevista    = Column(Date, nullable=False, index=True)
    hora_limite      = Column(String(5), nullable=True)      # "HH:MM"
    prioridade       = Column(String(20), default="MEDIA")   # CRITICA | ALTA | MEDIA | BAIXA
    categoria        = Column(String(50), default="Pessoal")
    status           = Column(String(20), default="PENDENTE") # PENDENTE | CONCLUIDA | ATRASADA | CANCELADA

    # Recompensas e penalidades
    xp_recompensa    = Column(Integer, default=60)
    moedas_recompensa = Column(Integer, default=10)
    penalidade_xp    = Column(Integer, default=0)

    # Controle
    usuario_id       = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    criado_em        = Column(DateTime, default=datetime.utcnow)
    concluida_em     = Column(DateTime, nullable=True)

    usuario          = relationship("Usuario", back_populates="tarefas")
    execucoes        = relationship("Execucao", back_populates="tarefa", lazy="dynamic")


# ==============================================================================
# EXECUÇÕES (Histórico de Completudes)
# ==============================================================================
class Execucao(Base):
    __tablename__ = "execucoes"

    id               = Column(Integer, primary_key=True, index=True)
    usuario_id       = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    rotina_id        = Column(Integer, ForeignKey("rotinas.id"), nullable=True, index=True)
    tarefa_id        = Column(Integer, ForeignKey("tarefas_dia.id"), nullable=True, index=True)
    data_execucao    = Column(Date, nullable=False, index=True)
    xp_ganho         = Column(Integer, default=0)
    moedas_ganhas    = Column(Integer, default=0)
    streak_na_hora   = Column(Integer, default=0)
    bonus_streak     = Column(Integer, default=0)        # XP extra por streak
    observacao       = Column(Text, nullable=True)
    criado_em        = Column(DateTime, default=datetime.utcnow)

    usuario          = relationship("Usuario", back_populates="execucoes")
    rotina           = relationship("Rotina", back_populates="execucoes")
    tarefa           = relationship("TarefaDia", back_populates="execucoes")


# ==============================================================================
# TABELA DE NÍVEIS
# ==============================================================================
class Nivel(Base):
    __tablename__ = "niveis"

    nivel            = Column(Integer, primary_key=True)
    rank             = Column(String(30), nullable=False)     # E-Rank, D-Rank, etc.
    titulo           = Column(String(100), nullable=False)    # "O Mais Fraco", etc.
    xp_necessario    = Column(Integer, nullable=False)        # XP total para atingir este nível
    xp_para_proximo  = Column(Integer, nullable=False)        # XP dentro do nível para subir
    moedas_bonus     = Column(Integer, default=0)            # Mana Coins bônus ao subir
    icone_rank       = Column(String(10), default="⚔️")


# ==============================================================================
# CONQUISTAS (Achievements / Badges)
# ==============================================================================
class Conquista(Base):
    __tablename__ = "conquistas"

    id               = Column(Integer, primary_key=True, index=True)
    codigo           = Column(String(50), unique=True, nullable=False)  # ex: "primeiro_despertar"
    titulo           = Column(String(100), nullable=False)
    descricao        = Column(String(300), nullable=False)
    icone            = Column(String(10), default="🏆")
    cor              = Column(String(7), default="#f59e0b")
    xp_bonus         = Column(Integer, default=0)
    moedas_bonus     = Column(Integer, default=0)
    # Condição de unlock (tipo + valor)
    condicao_tipo    = Column(String(50), nullable=False)    # ex: "execucoes_total", "streak", "nivel"
    condicao_valor   = Column(Integer, nullable=False)
    ativo            = Column(Boolean, default=True)
    # Comemorativas: exclusivas do Arquiteto (marcos do desenvolvimento)
    exclusiva_arquiteto = Column(Boolean, default=False)
    visivel             = Column(Boolean, default=True)   # o Arquiteto pode ocultá-las

    usuarios         = relationship("ConquistaUsuario", back_populates="conquista", lazy="dynamic")


class ConquistaUsuario(Base):
    __tablename__ = "conquistas_usuario"

    id               = Column(Integer, primary_key=True, index=True)
    usuario_id       = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    conquista_id     = Column(Integer, ForeignKey("conquistas.id"), nullable=False, index=True)
    desbloqueada_em  = Column(DateTime, default=datetime.utcnow)

    usuario          = relationship("Usuario", back_populates="conquistas")
    conquista        = relationship("Conquista", back_populates="usuarios")


# ==============================================================================
# RECOMPENSAS (Loja do Hunter)
# ==============================================================================
class Recompensa(Base):
    __tablename__ = "recompensas"

    id               = Column(Integer, primary_key=True, index=True)
    titulo           = Column(String(200), nullable=False)
    descricao        = Column(Text, nullable=True)
    icone            = Column(String(10), default="🎁")
    categoria        = Column(String(50), default="Lazer")
    custo_moedas     = Column(Integer, default=100)
    custo_xp         = Column(Integer, default=0)            # XP mínimo para resgatar
    nivel_minimo     = Column(Integer, default=1)
    estoque          = Column(Integer, default=-1)           # -1 = ilimitado
    ativo            = Column(Boolean, default=True)
    criado_em        = Column(DateTime, default=datetime.utcnow)

    resgates         = relationship("RecompensaUsuario", back_populates="recompensa", lazy="dynamic")


class RecompensaUsuario(Base):
    __tablename__ = "recompensas_usuario"

    id               = Column(Integer, primary_key=True, index=True)
    usuario_id       = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    recompensa_id    = Column(Integer, ForeignKey("recompensas.id"), nullable=False, index=True)
    resgatada_em     = Column(DateTime, default=datetime.utcnow)
    observacao       = Column(String(300), nullable=True)

    usuario          = relationship("Usuario", back_populates="recompensas_res")
    recompensa       = relationship("Recompensa", back_populates="resgates")


# ==============================================================================
# DUNGEONS — Ambientes isolados com missões próprias
# Regra de ouro: nada aqui toca Rotina/TarefaDia/Execucao/ExecucaoDia.
# Único ponto de contato com o mundo externo é o perfil (Usuario) via aplicar_xp.
# ==============================================================================
class Dungeon(Base):
    __tablename__ = "dungeons"

    id                     = Column(Integer, primary_key=True, index=True)
    titulo                 = Column(String(200), nullable=False)
    descricao              = Column(Text, nullable=True)              # "lore" da dungeon

    # Permanência / recorrência
    tipo_permanencia       = Column(String(20), default="PERMANENTE") # PERMANENTE | TEMPORARIA
    tipo_recorrencia       = Column(String(20), default="DIARIA")    # DIARIA|SEMANAL|MENSAL|ANUAL
    dias_semana            = Column(Text, nullable=True)              # JSON "[0,1,2,3,4]"
    dia_mes                = Column(Integer, nullable=True)
    mes_dia                = Column(String(5), nullable=True)         # "MM-DD"
    data_inicio            = Column(Date, nullable=True)              # só TEMPORARIA
    data_fim               = Column(Date, nullable=True)              # só TEMPORARIA

    # Janela de tempo
    hora_entrada           = Column(String(5), nullable=True)         # "HH:MM" (padrão)
    hora_saida             = Column(String(5), nullable=True)         # "HH:MM" (padrão)
    tolerancia_min         = Column(Integer, default=10)

    # Agenda avançada
    # agenda_semanal: JSON {"0":{"aberto":true,"entrada":"08:00","saida":"17:30"},"2":{"aberto":false}}
    #   chave = weekday (0=seg..6=dom); dia ausente usa o padrão acima
    agenda_semanal         = Column(Text, nullable=True)
    # folgas: JSON ["2026-07-22","2026-08-02"] — datas em que a dungeon NÃO abre
    folgas                 = Column(Text, nullable=True)

    # Identidade
    categoria              = Column(String(50), default="Pessoal")    # Trabalho|Saúde|Estudo|Casa|Pessoal|Combate
    rank                   = Column(String(2), default="E")           # E|D|C|B|A|S
    dificuldade            = Column(String(20), default="NORMAL")     # FACIL|NORMAL|DIFICIL|LENDARIO
    icone                  = Column(String(10), default="🌀")
    cor                    = Column(String(7), default="#7c3aed")
    tema_ambiente          = Column(String(30), nullable=True)        # preset visual do interior

    # Recompensas / penalidades
    xp_entrada             = Column(Integer, default=25)
    xp_clear               = Column(Integer, default=100)
    moedas_clear           = Column(Integer, default=10)
    penalidade_entrada_xp  = Column(Integer, default=50)
    penalidade_atraso_xp   = Column(Integer, default=15)

    # Streak próprio da Dungeon (independente do global)
    streak_atual           = Column(Integer, default=0)
    streak_max             = Column(Integer, default=0)

    # Controle
    status                 = Column(String(20), default="ATIVA")      # ATIVA|PAUSADA|ARQUIVADA
    usuario_id             = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    criado_em              = Column(DateTime, default=datetime.utcnow)

    sessoes                = relationship("DungeonSessao", back_populates="dungeon", lazy="dynamic")
    missoes                = relationship("DungeonMissao", back_populates="dungeon", lazy="dynamic")


class DungeonSessao(Base):
    __tablename__ = "dungeon_sessoes"

    id                     = Column(Integer, primary_key=True, index=True)
    dungeon_id             = Column(Integer, ForeignKey("dungeons.id"), nullable=False, index=True)
    usuario_id             = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    data                   = Column(Date, nullable=False, index=True)

    # PENDENTE → ATIVA → CONCLUIDA | FRACASSADA | CANCELADA
    status                 = Column(String(20), default="PENDENTE")

    # Modo teste do Arquiteto: sessão paralela que NUNCA credita XP/streak
    modo_teste             = Column(Boolean, default=False)

    entrada_em             = Column(DateTime, nullable=True)
    saida_em               = Column(DateTime, nullable=True)
    fracassada_em          = Column(DateTime, nullable=True)
    atraso_minutos         = Column(Integer, default=0)

    tempo_total_min        = Column(Integer, default=0)               # acumulado via heartbeat
    ultimo_heartbeat_em    = Column(DateTime, nullable=True)

    pct_missoes_concluidas = Column(Float, default=0.0)               # snapshot na saída
    rank_obtido            = Column(String(2), nullable=True)         # S|A|B|C|D|F

    xp_ganho               = Column(Integer, default=0)
    xp_perdido             = Column(Integer, default=0)
    moedas_ganhas          = Column(Integer, default=0)
    criado_em              = Column(DateTime, default=datetime.utcnow)

    dungeon                = relationship("Dungeon", back_populates="sessoes")
    missao_execucoes       = relationship("DungeonMissaoExecucao", back_populates="sessao", lazy="dynamic")


class DungeonMissao(Base):
    __tablename__ = "dungeon_missoes"

    id                     = Column(Integer, primary_key=True, index=True)
    dungeon_id             = Column(Integer, ForeignKey("dungeons.id"), nullable=False, index=True)
    titulo                 = Column(String(200), nullable=False)
    descricao              = Column(Text, nullable=True)
    icone                  = Column(String(10), default="⚔️")

    tipo                   = Column(String(20), default="ATIVA")      # ATIVA | PASSIVA
    natureza               = Column(String(20), default="PADRAO")     # PADRAO|AGENDADA|RESISTENCIA|EVENTO_ALEATORIO|BEM_ESTAR|FLAVOR

    xp_recompensa          = Column(Integer, default=30)
    moedas_recompensa      = Column(Integer, default=3)
    penalidade_xp          = Column(Integer, nullable=True)           # null = auto (50% da recompensa); 0 = sem punição

    # Agenda da missão
    dias_semana            = Column(Text, nullable=True)              # JSON "[0,4,6]" — só aparece nesses dias (null = todos)
    hora_inicio            = Column(String(5), nullable=True)         # AGENDADA: abre neste horário
    hora_limite            = Column(String(5), nullable=True)         # AGENDADA: expira neste horário

    intervalo_min          = Column(Integer, nullable=True)           # PASSIVA: tick a cada N min
    meta_minutos           = Column(Integer, nullable=True)           # RESISTENCIA: minutos até 100%
    janela_disparo_min     = Column(Integer, nullable=True)           # EVENTO_ALEATORIO
    janela_disparo_max     = Column(Integer, nullable=True)
    expira_em_min          = Column(Integer, default=5)               # evento some depois disso

    ativo                  = Column(Boolean, default=True)
    criado_em              = Column(DateTime, default=datetime.utcnow)

    dungeon                = relationship("Dungeon", back_populates="missoes")
    execucoes              = relationship("DungeonMissaoExecucao", back_populates="missao", lazy="dynamic")


class DungeonMissaoExecucao(Base):
    __tablename__ = "dungeon_missao_execucoes"

    id                     = Column(Integer, primary_key=True, index=True)
    dungeon_missao_id      = Column(Integer, ForeignKey("dungeon_missoes.id"), nullable=False, index=True)
    dungeon_sessao_id      = Column(Integer, ForeignKey("dungeon_sessoes.id"), nullable=False, index=True)

    status                 = Column(String(20), default="PENDENTE")   # PENDENTE|EM_PROGRESSO|CONCLUIDA|EXPIRADA
    progresso_pct          = Column(Float, default=0.0)
    disparada_em           = Column(DateTime, nullable=True)          # quando o evento surgiu
    concluida_em           = Column(DateTime, nullable=True)

    xp_ganho               = Column(Integer, default=0)
    xp_perdido             = Column(Integer, default=0)               # penalidade aplicada (cancelada/expirada)
    moedas_ganhas          = Column(Integer, default=0)
    criado_em              = Column(DateTime, default=datetime.utcnow)

    missao                 = relationship("DungeonMissao", back_populates="execucoes")
    sessao                 = relationship("DungeonSessao", back_populates="missao_execucoes")


# ==============================================================================
# CONVITES — o Chamado do Arquiteto
# Cadastro é fechado: só entra quem tem um código válido.
# ==============================================================================
class Convite(Base):
    __tablename__ = "convites"

    id             = Column(Integer, primary_key=True, index=True)
    codigo         = Column(String(20), unique=True, nullable=False, index=True)
    criado_por_id  = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    nota           = Column(String(200), nullable=True)   # "para o João", etc.
    nivel_acesso   = Column(String(20), default="User")   # User | Admin (a conta nasce assim)
    badges         = Column(Text, nullable=True)          # JSON: ["diana","solo"] — presentes anexados
    usado_por_id   = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    usado_em       = Column(DateTime, nullable=True)
    expira_em      = Column(DateTime, nullable=True)      # null = não expira
    revogado       = Column(Boolean, default=False)
    criado_em      = Column(DateTime, default=datetime.utcnow)


# ==============================================================================
# CONFIGURAÇÕES DO APP (Logo, Fontes, Tema)
# ==============================================================================
class ConfiguracaoApp(Base):
    __tablename__ = "configuracoes_app"

    chave            = Column(String(100), primary_key=True)
    valor            = Column(Text, nullable=True)
    atualizado_em    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ==============================================================================
# LOGS DE AUDITORIA
# ==============================================================================
class LogAuditoria(Base):
    __tablename__ = "logs_auditoria"

    id               = Column(Integer, primary_key=True, index=True)
    data_hora        = Column(DateTime, default=datetime.utcnow, index=True)
    usuario          = Column(String(100), nullable=False)
    acao             = Column(String(100), nullable=False)
    detalhes         = Column(Text, nullable=True)
    ip               = Column(String(50), nullable=True)


# ==============================================================================
# HELPERS
# ==============================================================================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def criar_tabelas():
    Base.metadata.create_all(bind=engine)
    
    # Migracoes automaticas seguras para persistencia (Render com SQLite ou Postgres)
    try:
        with engine.begin() as conn:
            try:
                conn.execute(text("ALTER TABLE conquistas ADD COLUMN exclusiva_arquiteto BOOLEAN DEFAULT false"))
            except Exception as e:
                if "already exists" not in str(e).lower() and "duplicate column" not in str(e).lower():
                    print(f"[DB MIGRATE WARNING] exclusiva_arquiteto: {e}")
            try:
                conn.execute(text("ALTER TABLE conquistas ADD COLUMN visivel BOOLEAN DEFAULT true"))
            except Exception as e:
                if "already exists" not in str(e).lower() and "duplicate column" not in str(e).lower():
                    print(f"[DB MIGRATE WARNING] visivel: {e}")
    except Exception as e:
        print(f"[DB] Erro no bloco de migracoes: {e}")
