from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Date, DateTime,
    Boolean, Text, ForeignKey, JSON
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
