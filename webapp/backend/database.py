from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Date, DateTime,
    Boolean, Text, ForeignKey, JSON, text, UniqueConstraint
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
    bio             = Column(String(100), nullable=True)     # Frase/Epígrafe
    xp_total        = Column(Integer, default=0)             # XP acumulado total
    xp_atual        = Column(Integer, default=0)             # XP no nível atual
    nivel_atual     = Column(Integer, default=1)
    xp_proximo_nivel = Column(Integer, default=100)          # XP necessário para o próximo nível

    # Moeda in-game
    moedas          = Column(Integer, default=0)             # Mana Coins

    # Moeda premium (comprada com R$)
    fragmentos      = Column(Integer, default=0)             # Fragmentos do Monarca 🔮
    assinante       = Column(Boolean, default=False)         # flag rápida: tem assinatura ativa?

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
    # Relíquias do altar: JSON com os códigos que o hunter escolheu exibir
    # na Janela de Status e no topo da vitrine. Vazio = as mais recentes.
    reliquias_fixadas = Column(Text, nullable=True)
    # Aura cosmética presenteada pelo Arquiteto (independente do cargo)
    # None = usa a aura de cargo padrão; string = ID de aura registrada em Auras
    aura_id           = Column(String(50), nullable=True)

    # Relacionamentos
    rotinas         = relationship("Rotina", back_populates="usuario", lazy="dynamic")
    tarefas         = relationship("TarefaDia", back_populates="usuario", lazy="dynamic")
    execucoes       = relationship("Execucao", back_populates="usuario", lazy="dynamic")
    # foreign_keys explícito: ConquistaUsuario tem 2 FKs para usuarios
    # (o dono da conquista e quem a presenteou)
    conquistas      = relationship("ConquistaUsuario", back_populates="usuario",
                                   lazy="dynamic",
                                   foreign_keys="ConquistaUsuario.usuario_id")
    recompensas_res = relationship("RecompensaUsuario", back_populates="usuario", lazy="dynamic")
    assinatura      = relationship("Assinatura", back_populates="usuario",
                                   uselist=False, primaryjoin="and_(Assinatura.usuario_id==Usuario.id, Assinatura.status=='ATIVA')")


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

    # NATUREZA — a inversão que cria a missão passiva.
    #
    #   ATIVA   (padrão): o estado natural é o FRACASSO. O hunter age para
    #                     VENCER. É toda missão que o app teve até aqui.
    #   PASSIVA         : o estado natural é o SUCESSO. O hunter age para
    #                     PERDER. "Sem cafeína após as 16h" corre das 16:00
    #                     às 05:00 e se conclui sozinha — a menos que ele
    #                     mesmo vá até o cartão e confesse que quebrou.
    #
    # Não é um quarto tipo de missão: é um ADJETIVO da rotina. A passiva
    # continua sendo DIARIA/SEMANAL/MENSAL/ANUAL, continua vivendo em
    # ExecucaoDia e continua aparecendo no extrato como qualquer outra.
    # Só o desfecho do prazo muda de lado (motors/fechamento.py).
    natureza         = Column(String(20), default="ATIVA")   # ATIVA | PASSIVA | REPETICAO | CONDICIONAL

    # ── PROGRESSIVA — o desafio de dias consecutivos ────────────────────
    #
    # ATIVA: o hunter cumpre X dias SEM FALHAR. Qualquer fracasso encerra
    # a missão como FRACASSADA_FATAL — sem reerguer, sem segunda chance.
    #
    # PASSIVA: como "Sem gastos banais durante 30 dias" — o hunter só age
    # para CONFESSAR. Cada dia que passa sem confissão conta como mantido.
    # Confessou → FRACASSADA_FATAL e missão encerrada.
    #
    # Não é uma natureza — é um ADJETIVO. Uma progressiva pode ser ATIVA
    # ou PASSIVA, DIARIA ou SEMANAL. O que muda é apenas a régua de derrota:
    # em vez de "não cumpriu hoje", é "não cumpriu e a corrente acabou".
    #
    # `dias_progressivos_ok` rastreia os dias já cumpridos e cresce no
    # `concluir` de cada instância. É gravado na ROTINA (não na instância)
    # porque o progresso pertence ao desafio inteiro, não ao dia.
    eh_progressiva          = Column(Boolean, default=False, nullable=False, server_default="0")
    dias_progressivos_alvo  = Column(Integer, nullable=True)   # meta (ex: 30 dias)
    dias_progressivos_ok    = Column(Integer, default=0, server_default="0")  # cumpridos

    # ── CONDICIONAL — a bifurcação ───────────────────────────────────────
    #
    # JSON com a estrutura do desvio:
    #   { "pergunta": "Conseguiu evitar açúcar?",
    #     "opcao_a":  { "txt": "Sim", "xp_bonus": 0, "titulo_vitoria": "" },
    #     "opcao_b":  { "txt": "Não (confissão)", "xp_bonus": -50, "titulo_vitoria": "" } }
    #
    # A missão é concluída de qualquer forma — o que muda é qual ramo de XP
    # e qual mensagem o hunter recebe. Não há punição automática: o design
    # explícito é "honestidade sem punição dupla" (a passiva já pune).
    condicional_payload     = Column(Text, nullable=True)  # JSON ou None

    # Controle
    ativo            = Column(Boolean, default=True)
    status           = Column(String(20), default="ATIVA")    # ATIVA | PAUSADA | CANCELADA | CONCLUIDA
    usuario_id       = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    # PRAZO da missão, em minutos, do play ao fim. Calculado por
    # prioridade x dificuldade (motors/economia.py). `prazo_personalizado`
    # marca quando o hunter escolheu o tempo à mão — aí o recálculo respeita
    # a escolha dele em vez de sobrescrever.
    prazo_minutos       = Column(Integer, nullable=True)
    prazo_personalizado = Column(Boolean, default=False)

    # ── REPETIÇÃO (natureza = REPETICAO) ────────────────────────────────
    # UM campo separa os dois modos, e é a ausência dele que decide:
    #   alvo_repeticoes = 5     META  — barra com fim, fracassa, pune, streak
    #   alvo_repeticoes = None  BÔNUS — o placar é o resultado; não fracassa
    #
    # Duas naturezas separadas dariam duas máquinas de estado e dois lugares
    # para o fechamento decidir o mesmo. Uma coluna nula resolve.
    alvo_repeticoes  = Column(Integer, nullable=True)
    contador_id      = Column(Integer, ForeignKey("contadores.id"), nullable=True, index=True)
    # Só no BÔNUS. O que a rotina DECLARA por clique — o quanto ela paga de
    # verdade passa pelos tetos da Balança (motors/economia.py), porque sem
    # eles isto seria um campo de texto virando XP.
    # SEM `xp_por_repeticao`. Ele existiu por cinco commits e nunca
    # deveria ter existido: guardava, por missao, um preco que so a
    # Balanca pode dizer. Coluna que ninguem le e palpite gravado no
    # esquema — a mesma regra que me fez tirar `escopo` e `congelado_em`
    # no primeiro dia deste recurso, e que eu quebrei aqui sem notar.
    # Atrito opcional: "beber água 5 vezes" clicado cinco vezes seguidas não
    # é hidratação, é um botão. Não é antifraude — quem quer se enganar
    # consegue —, é atrito onde o hábito precisa dele. Opcional porque
    # "entregar cerveja no balcão" não quer nenhum.
    intervalo_min_seg = Column(Integer, nullable=True)
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

    # REERGUER — a segunda chance que custa Mana.
    # Uma rotina de janela (Banho Revigorante, 20:00–22:00) é uma corrida
    # contra o tempo: às 22:00 ela fecha e acabou. Mas o hábito importa mais
    # que o placar — não faz sentido dormir sem tomar banho porque o relógio
    # passou. Então o hunter pode reerguê-la pagando Mana: ela volta a ser
    # jogável até as 23:59 daquele dia (à meia-noite nasce a de amanhã).
    #
    # O preço é o desconforto; a missão reerguida NÃO paga XP nem Mana ao ser
    # concluída. Sem esta marca, reerguer viraria uma forma de transformar
    # Mana em XP — e a economia já foi furada uma vez por menos que isso.
    reerguida     = Column(Boolean, default=False)
    reerguida_em  = Column(DateTime, nullable=True)
    mana_gasta    = Column(Integer, default=0)         # quanto custou reerguer

    # CONFISSÃO — o desfecho exclusivo da missão passiva.
    #
    # Ninguém consegue verificar se o hunter tomou café às 22h. Se confessar
    # custasse o mesmo que ficar calado, o silêncio seria a jogada racional —
    # e o registro, do qual o app inteiro depende, viraria ficção.
    # Por isso confessar custa METADE da punição e NÃO quebra o streak.
    #
    # Ela merece campo próprio porque não é fracasso nem conclusão: é a
    # terceira coisa, e o extrato precisa saber diferenciar as três.
    confessada_em = Column(DateTime, nullable=True)

    # ── CONDICIONAL — qual ramo o hunter escolheu ────────────────────────
    # "A" = cumpriu a condição / "B" = não cumpriu (confissão leve).
    # None = missão não é condicional, ou ainda não respondida.
    resposta_condicional = Column(String(1), nullable=True)  # "A" | "B" | None
    condicional_vitoria  = Column(Boolean, nullable=True)    # True=ramo A, False=ramo B

    # ── REPETIÇÃO — a contagem DESTE DIA ────────────────────────────────
    # `repeticoes` é o registro, e ele NÃO tem teto: limitar o registro
    # seria mentir sobre o que a pessoa fez.
    #
    # `xp_repeticao_pago` é a recompensa, e ela TEM teto. Guardar quanto já
    # foi pago hoje é o que permite parar de pagar sem parar de contar — e
    # é a diferença entre "não contou" e "contou e não pagou", que o cartão
    # precisa saber para não parecer quebrado.
    #
    # `server_default` ALEM do `default`, e os dois sao necessarios por
    # motivos diferentes — descoberto conferindo os dois caminhos de
    # criacao lado a lado:
    #
    #   default=0         vale quando o Python cria a linha
    #   server_default    vale no DDL, e e o que a MIGRACAO escreve
    #
    # Sem o server_default, um banco criado do zero (`create_all`) ficava
    # sem DEFAULT no esquema enquanto um banco migrado ficava com ele —
    # dois esquemas diferentes para o mesmo codigo, e a divergencia so
    # apareceria num INSERT que nao passasse pelo ORM.
    repeticoes          = Column(Integer, nullable=False, default=0, server_default="0")
    xp_repeticao_pago   = Column(Integer, nullable=False, default=0, server_default="0")
    ultima_repeticao_em = Column(DateTime, nullable=True)

    # Uma rotina só pode ter UMA instância por dia. Sem isto, duas requisições
    # simultâneas (ou o job + o app abrindo junto) criavam missões duplicadas
    # para o mesmo dia — e o extrato mostraria "Carregar Dolphin" duas vezes
    # no mesmo 14/07. A migração cria o índice único correspondente.
    __table_args__ = (
        UniqueConstraint("rotina_id", "usuario_id", "data", name="uq_execucao_dia"),
    )

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
    # Quando o hunter apertou "iniciar". Sem isto não há como dizer QUANTO
    # a missão durou — só que ela foi concluída. A instância diária de uma
    # rotina (ExecucaoDia) já registrava; a missão geral não, e por isso o
    # cronômetro era impossível deste lado.
    # PRAZO da missão, em minutos, do play ao fim. Calculado por
    # prioridade x dificuldade (motors/economia.py). `prazo_personalizado`
    # marca quando o hunter escolheu o tempo à mão — aí o recálculo respeita
    # a escolha dele em vez de sobrescrever.
    prazo_minutos       = Column(Integer, nullable=True)
    prazo_personalizado = Column(Boolean, default=False)
    iniciada_em      = Column(DateTime, nullable=True)
    concluida_em     = Column(DateTime, nullable=True)

    # ══ NATUREZAS NA MISSAO GERAL ═══════════════════════════════════
    #
    # A passiva e a repeticao existiam so em ROTINA. Eu tinha escrito
    # no codigo que "um protocolo que vale uma vez so nao e protocolo"
    # — e o Arquiteto mostrou o contra-exemplo em uma frase: um
    # protocolo para UM dia especifico (a vespera de uma prova, uma
    # viagem) e um contador que se usa "vez ou outra" sao missoes
    # gerais, nao rotinas.
    #
    # A regra que eu tinha inventado confundia RECORRENCIA com
    # NATUREZA. Sao eixos independentes: com que frequencia a missao
    # aparece, e de que jeito ela se cumpre.
    #
    # Por que a contagem mora AQUI e nao numa ExecucaoDia:
    # a missao geral acontece uma vez, entao ela nao tem instancia
    # diaria. O numero e dela mesma — e isso simplifica, nao complica.
    natureza            = Column(String(20), default="ATIVA")
    hora_inicio         = Column(String(5), nullable=True)   # janela da passiva
    alvo_repeticoes     = Column(Integer, nullable=True)
    contador_id         = Column(Integer, ForeignKey("contadores.id"), nullable=True, index=True)
    # SEM `xp_por_repeticao`. Ele existiu por cinco commits e nunca
    # deveria ter existido: guardava, por missao, um preco que so a
    # Balanca pode dizer. Coluna que ninguem le e palpite gravado no
    # esquema — a mesma regra que me fez tirar `escopo` e `congelado_em`
    # no primeiro dia deste recurso, e que eu quebrei aqui sem notar.
    intervalo_min_seg   = Column(Integer, nullable=True)
    repeticoes          = Column(Integer, nullable=False, default=0, server_default="0")
    xp_repeticao_pago   = Column(Integer, nullable=False, default=0, server_default="0")
    ultima_repeticao_em = Column(DateTime, nullable=True)
    confessada_em       = Column(DateTime, nullable=True)    # "quebrei o protocolo"

    # ══ PENITENCIA ══════════════════════════════════════════════════
    # Nasce do fechamento do dia, nao do lancador. `pacto_id` diz de
    # qual penitencia do pacto ela veio; `origem_titulo` guarda o texto
    # da missao que falhou — COPIA, nao referencia, porque a missao
    # original pode ser apagada e a divida nao pode sumir com ela.
    pacto_id            = Column(Integer, ForeignKey("pactos.id"), nullable=True, index=True)
    origem_titulo       = Column(String(200), nullable=True)
    origem_data         = Column(Date, nullable=True)
    xp_a_reparar        = Column(Integer, nullable=False, default=0, server_default="0")
    # ── NASCIDA DE UMA PERGUNTA ──────────────────────────────────────────
    # JSON: {"pergunta": "...", "resposta": "Sim", "ramo": "A"}
    #
    # UMA coluna e nao tres. Os tres valores nascem juntos, morrem juntos e
    # nunca sao consultados separadamente — sao um fato so ("esta missao
    # veio daquela pergunta, por este caminho"). Tres colunas seriam tres
    # migracoes e tres chances de uma delas ficar para tras.
    #
    # O serializador as devolve achatadas (origem_pergunta/resposta/ramo)
    # porque e assim que o cartao le, e o cartao nao tem por que saber que
    # do outro lado e um JSON.
    origem_condicional  = Column(Text, nullable=True)

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
    # Colecionável: emblema presenteável (nunca conquistado por missão)
    colecionavel        = Column(Boolean, default=False)
    # Transferível: circula entre hunters na Casa de Trocas (Materiais).
    # Quem envia PERDE o emblema — é uma transferência real, não uma cópia.
    transferivel        = Column(Boolean, default=False)

    usuarios         = relationship("ConquistaUsuario", back_populates="conquista", lazy="dynamic")


class ConquistaUsuario(Base):
    __tablename__ = "conquistas_usuario"

    id               = Column(Integer, primary_key=True, index=True)
    usuario_id       = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    conquista_id     = Column(Integer, ForeignKey("conquistas.id"), nullable=False, index=True)
    desbloqueada_em  = Column(DateTime, default=datetime.utcnow)
    # Cerimônia: badges concedidas fora da sessão (registro/presente) ficam
    # pendentes até o hunter entrar e ser celebrado com a devida pompa.
    celebrada        = Column(Boolean, default=True)
    presenteada_por  = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    mensagem         = Column(String(300), nullable=True)   # bilhete do remetente

    usuario          = relationship("Usuario", back_populates="conquistas", foreign_keys=[usuario_id])
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
    custo_fragmentos = Column(Integer, default=0)            # custo em Fragmentos do Monarca (0 = não aceita)
    custo_xp         = Column(Integer, default=0)            # XP mínimo para resgatar
    nivel_minimo     = Column(Integer, default=1)
    estoque          = Column(Integer, default=-1)           # -1 = ilimitado
    ativo            = Column(Boolean, default=True)

    # O QUE o item é, e não só quanto custa.
    #   tipo="externa" → recompensa da vida real (um lanche, um dia de folga).
    #                    O Sistema não tem como entregá-la; ela vale como
    #                    promessa que o hunter faz a si mesmo. É o padrão,
    #                    então tudo que já existe continua sendo isso.
    #   tipo="aura"    → payload guarda o id da aura   (ex.: "bella-rosa")
    #   tipo="emblema" → payload guarda o código do emblema
    # Quem sabe ENTREGAR cada tipo é motors/loja_efeitos.py.
    tipo             = Column(String(20), default="externa", index=True)
    payload          = Column(String(80), nullable=True)

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
    nivel_acesso      = Column(String(20), default="User")   # User | Suporte | Moderador | Admin | Criador
    badges            = Column(Text, nullable=True)          # JSON: ["diana","solo"] — presentes anexados
    # Presentes premium entregues no cadastro
    assinatura_tipo   = Column(String(20), nullable=True)    # "MENSAL"|"SEMESTRAL"|"VITALICIO" — null = sem assinatura
    aura_id           = Column(String(50), nullable=True)    # aura presenteada ao novo hunter
    fragmentos_bonus  = Column(Integer, default=0)           # 🔮 creditados na conta no momento do registro
    usado_por_id      = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    usado_em          = Column(DateTime, nullable=True)
    expira_em         = Column(DateTime, nullable=True)      # null = não expira
    revogado          = Column(Boolean, default=False)
    criado_em         = Column(DateTime, default=datetime.utcnow)


# ==============================================================================
# CASA DE TROCAS — registro permanente de materiais que mudaram de mãos
# ==============================================================================
# Por que existe: a transferência apaga a posse do remetente e cria a do
# destinatário. Sem este livro, a história do emblema se perderia a cada troca.
# Aqui fica a procedência — de quem veio, para quem foi, quando e com que recado.
class TransferenciaMaterial(Base):
    __tablename__ = "transferencias_material"

    id             = Column(Integer, primary_key=True, index=True)
    conquista_id   = Column(Integer, ForeignKey("conquistas.id"), nullable=False, index=True)
    codigo         = Column(String(50), nullable=False)      # redundante de prop\u00f3sito
    de_usuario_id  = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    para_usuario_id= Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    mensagem       = Column(String(300), nullable=True)
    criado_em      = Column(DateTime, default=datetime.utcnow, index=True)


# ==============================================================================
# INVENTÁRIO DE AURAS COSMÉTICAS
# ==============================================================================
# Espelho de ConquistaUsuario mas para auras: cada linha é uma aura possuída
# por um hunter. Quando o Arquiteto envia, a linha sai de um e nasce em outro.
# celebrada=False sinaliza cerim\u00f4nia pendente — a aura "aparece" no próximo login.
class AuraUsuario(Base):
    __tablename__ = "auras_usuario"

    id              = Column(Integer, primary_key=True, index=True)
    usuario_id      = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    aura_id         = Column(String(50), nullable=False)         # ex: "bella-rosa"
    obtida_em       = Column(DateTime, default=datetime.utcnow)
    presenteada_por = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    mensagem        = Column(String(300), nullable=True)         # bilhete do remetente
    celebrada       = Column(Boolean, default=False)             # False = cerim\u00f4nia pendente



# ==============================================================================
# CONTADORES — o recipiente que atravessa as missões
# ==============================================================================
# Uma missão vive um dia. "Responder 5 questões" nasce hoje, morre hoje, e
# amanhã nasce outra. Isso responde "cumpri hoje?" e nunca responde a
# pergunta que o hunter faz depois de três meses: QUANTAS EU FIZ?
#
# O contador é onde essa resposta mora. Várias rotinas apontam para ele —
# a meta diária de história e a contagem livre de português somam no mesmo
# lugar — e ele acumula enquanto o hunter existir.
#
# O TOTAL NÃO FICA AQUI, e é a decisão mais importante desta tabela.
# Ele é somado das execuções, sempre:
#
#     SELECT SUM(ed.repeticoes) FROM execucao_dia ed
#       JOIN rotinas r ON r.id = ed.rotina_id
#      WHERE r.contador_id = :id
#
# Guardar um `total` aqui criaria uma segunda verdade, que diverge no
# primeiro desfazer e na primeira exclusão. Este projeto pagou por segunda
# verdade cinco vezes; a última foram as placas do Dashboard somando de uma
# tabela que o resto do app tinha abandonado.
#
# A CONSULTA SOMA POR `contador_id` E NADA MAIS — nunca `AND usuario_id`.
# Não é estilo: é o que deixa a porta da guilda aberta. No dia em que um
# contador for de vários hunters, a soma já estará pronta.
class Contador(Base):
    __tablename__ = "contadores"

    id           = Column(Integer, primary_key=True, index=True)
    usuario_id   = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    nome         = Column(String(80), nullable=False)      # "Fazer questões"
    unidade      = Column(String(30), nullable=True)       # "questões" — para o texto
    criado_em    = Column(DateTime, default=datetime.utcnow)
    # Arquivar não é apagar: o contador some das listas e continua somando o
    # que já foi feito. Apagar de verdade destrói história de anos, e por
    # isso pede confirmação que diga o número.
    arquivado_em = Column(DateTime, nullable=True)


# ==============================================================================
# LIVRO DE DECRETOS — auditoria de todo poder exercido pelo Arquiteto
# ==============================================================================
# Por que existe: revogar cargo, badge ou acesso apaga um estado do Sistema.
# Sem registro, ninguém — nem o próprio Arquiteto meses depois — saberia o que
# foi tirado de quem, quando e por quê. Poder sem rastro é poder que se perde.
class Pacto(Base):
    """
    Uma penitencia que o hunter deve ao Sistema quando falhar.

    E um CARDAPIO, nao uma divida: o hunter escreve com calma, e o
    Sistema escolhe qual servir. A assimetria e o ponto — ele decide o
    que pode custar num momento lucido, e e cobrado num momento em que
    nao escreveria nada.

    `valor_atual` sobe a cada vez que esta penitencia cai (escalonamento)
    e recua a cada semana limpa (decaimento). `base` e `teto` sao os
    limites desse movimento.

    `ultima_queda` alimenta as duas contas: o decaimento mede a distancia
    ate hoje, e o sorteio sem reposicao usa `ciclo` para nao repetir
    antes de percorrer o pacto inteiro.
    """
    __tablename__ = "pactos"

    id            = Column(Integer, primary_key=True, index=True)
    usuario_id    = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    titulo        = Column(String(160), nullable=False)
    tipo          = Column(String(20), nullable=False, default="QUANTITATIVA")
    unidade       = Column(String(30), nullable=True)
    base          = Column(Integer, nullable=False, default=1)
    teto          = Column(Integer, nullable=False, default=32)
    valor_atual   = Column(Integer, nullable=False, default=1)
    origem_chave  = Column(String(40), nullable=True)   # veio do catalogo?
    ativo         = Column(Boolean, default=True)
    ultima_queda  = Column(Date, nullable=True)
    vezes_caiu    = Column(Integer, nullable=False, default=0, server_default="0")
    ciclo         = Column(Integer, nullable=False, default=0, server_default="0")
    criado_em     = Column(DateTime, default=datetime.utcnow)


class RegistroPoder(Base):
    __tablename__ = "registro_poderes"

    id            = Column(Integer, primary_key=True, index=True)
    poder         = Column(String(50), nullable=False, index=True)  # ex: "revogar_cargo"
    arquiteto_id  = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    arquiteto_nome= Column(String(100), nullable=True)   # preservado se a conta sumir
    alvo_id       = Column(Integer, ForeignKey("usuarios.id"), nullable=True, index=True)
    alvo_nome     = Column(String(100), nullable=True)
    detalhe       = Column(String(300), nullable=True)   # o que exatamente mudou
    antes         = Column(String(200), nullable=True)   # estado anterior (reversão manual)
    motivo        = Column(String(300), nullable=True)
    criado_em     = Column(DateTime, default=datetime.utcnow, index=True)


# ==============================================================================
# SOCIAL — BuddyList (amizades) e Chat (mensagens 1-a-1)
# ==============================================================================
# Amizade com pedido + aceite: uma linha por relação, do solicitante para o
# alvo. Guardamos SEMPRE o par ordenado (menor_id, maior_id) para que
# (A→B) e (B→A) nunca virem duas linhas — a relação é única, indiferente de
# quem pediu. O campo `solicitante_id` lembra quem enviou, para o outro lado
# ver "fulano quer ser seu amigo".
class Amizade(Base):
    __tablename__ = "amizades"

    id             = Column(Integer, primary_key=True, index=True)
    # Par ordenado: usuario_a < usuario_b sempre. Garante unicidade da relação.
    usuario_a_id   = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    usuario_b_id   = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    solicitante_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    # pendente → aceita | recusada. Recusada fica no banco para bloquear
    # reenvio imediato de spam; pode ser limpa depois.
    status         = Column(String(20), default="pendente", index=True)
    criado_em      = Column(DateTime, default=datetime.utcnow)
    respondido_em  = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("usuario_a_id", "usuario_b_id", name="uq_amizade_par"),
    )


# Mensagem de chat 1-a-1. `lida_em` nulo = ainda não lida (alimenta o
# contador de não-lidas na BuddyList e no menu).
class Mensagem(Base):
    __tablename__ = "mensagens"

    id            = Column(Integer, primary_key=True, index=True)
    de_id         = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    para_id       = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    corpo         = Column(String(2000), nullable=False)
    criado_em     = Column(DateTime, default=datetime.utcnow, index=True)
    lida_em       = Column(DateTime, nullable=True)
    # Exclusão. Cada lado esconde por si:
    #   oculta_de   → o remetente apagou da SUA vista (ou limpou o chat).
    #   oculta_para → o destinatário apagou da vista dele.
    # apagada_todos → o remetente apagou PARA OS DOIS; vira lápide "apagada".
    oculta_de     = Column(Boolean, default=False)
    oculta_para   = Column(Boolean, default=False)
    apagada_todos = Column(Boolean, default=False)


# ==============================================================================
# IDENTIDADE OAUTH — login/registro via Google e Discord
# ==============================================================================
# Uma linha por vínculo (usuário ↔ provedor). Um hunter pode ter mais de uma
# (entrou com Google, depois vinculou o Discord). A chave de busca é
# (provedor, provedor_id): o id ESTÁVEL que o provedor dá para a conta —
# nunca o e-mail, que pode mudar.
class IdentidadeOAuth(Base):
    __tablename__ = "identidades_oauth"

    id            = Column(Integer, primary_key=True, index=True)
    usuario_id    = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    provedor      = Column(String(20), nullable=False, index=True)   # google | discord
    provedor_id   = Column(String(64), nullable=False, index=True)   # id estável no provedor
    email         = Column(String(200), nullable=True)
    criado_em     = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("provedor", "provedor_id", name="uq_oauth_provedor_id"),
    )


# ==============================================================================
# CONFIGURAÇÕES DO APP (Logo, Fontes, Tema)
# ==============================================================================
class ParametroEconomia(Base):
    """
    As tabelas que precificam e cronometram uma missão — no banco, para o
    Arquiteto ajustar sem esperar um deploy.

    Formato deliberadamente simples: uma linha por (grupo, chave) com um
    número. Não é a modelagem mais "elegante", é a mais EDITÁVEL — vira uma
    grade na tela sem tradução nenhuma, e acrescentar uma dimensão nova não
    exige migração, só linhas novas.

    Grupos usados hoje:
      xp_prioridade      CRITICA|ALTA|MEDIA|BAIXA  → XP base da missão avulsa
      mc_prioridade      idem                      → Mana base
      xp_tipo            DIARIA|SEMANAL|...        → XP base da rotina
      mc_tipo            idem                      → Mana base
      mult_dificuldade   FACIL|NORMAL|...          → multiplica XP e prazo
      mult_prioridade    CRITICA|...               → multiplica XP
      bonus_categoria    Saude|Trabalho|...        → tempero por natureza
      penal_prioridade   CRITICA|...               → fração do XP perdida ao falhar
      prazo_prioridade   CRITICA|...               → MINUTOS de prazo base
    """
    __tablename__ = "parametros_economia"

    id        = Column(Integer, primary_key=True, index=True)
    grupo     = Column(String(40), nullable=False, index=True)
    chave     = Column(String(40), nullable=False)
    valor     = Column(Float, nullable=False)
    rotulo    = Column(String(80), nullable=True)   # texto amigável na tela
    ordem     = Column(Integer, default=0)          # ordem de exibição
    editado_em = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("grupo", "chave", name="uq_parametro_economia"),
    )


class ConfiguracaoApp(Base):
    __tablename__ = "configuracoes_app"

    chave            = Column(String(100), primary_key=True)
    valor            = Column(Text, nullable=True)
    atualizado_em    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ==============================================================================
# FRAGMENTOS DO MONARCA — Moeda Premium (comprada com R$)
# ==============================================================================

class Plano(Base):
    """Catálogo de planos de assinatura disponíveis na plataforma."""
    __tablename__ = "planos"

    id                      = Column(Integer, primary_key=True, index=True)
    nome                    = Column(String(50), nullable=False)   # "Mensal", "Semestral", "Vitalicio"
    descricao               = Column(Text, nullable=True)
    preco_brl               = Column(Float, nullable=False)
    ciclo                   = Column(String(20), nullable=False)   # "MENSAL" | "SEMESTRAL" | "VITALICIO"
    fragmentos_bonus_mensal = Column(Integer, default=0)           # 🔮 creditados a cada mês ativo
    destaque                = Column(Boolean, default=False)       # exibido em destaque na vitrine
    ativo                   = Column(Boolean, default=True)
    ordem                   = Column(Integer, default=0)

    assinaturas = relationship("Assinatura", back_populates="plano", lazy="dynamic")


class Assinatura(Base):
    """
    Assinatura ativa de um usuário. Um usuário tem no máximo 1 assinatura ATIVA.
    Ao renovar/upgrade, a anterior é marcada EXPIRADA e uma nova é criada.
    Assinaturas geradas por convite do Arquiteto não têm mp_preapproval_id.
    """
    __tablename__ = "assinaturas"

    id                = Column(Integer, primary_key=True, index=True)
    usuario_id        = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    plano_id          = Column(Integer, ForeignKey("planos.id"), nullable=False)
    status            = Column(String(20), default="ATIVA")        # ATIVA | PAUSADA | CANCELADA | EXPIRADA
    origem            = Column(String(20), default="pagamento")    # "pagamento" | "convite" | "arquiteto"
    mp_preapproval_id = Column(String(100), nullable=True)         # ID do Preapproval (mensais recorrentes)
    vitalicia         = Column(Boolean, default=False)             # True = nunca expira
    inicio_em         = Column(DateTime, default=datetime.utcnow)
    expira_em         = Column(DateTime, nullable=True)            # null = vitalícia
    proximo_ciclo_em  = Column(DateTime, nullable=True)            # próxima cobrança (mensais)
    cancelada_em      = Column(DateTime, nullable=True)
    criado_em         = Column(DateTime, default=datetime.utcnow)

    usuario = relationship("Usuario", back_populates="assinatura",
                           primaryjoin="and_(Assinatura.usuario_id==Usuario.id, Assinatura.status=='ATIVA')")
    plano   = relationship("Plano", back_populates="assinaturas")


class PacoteFragmentos(Base):
    """Catálogo de pacotes de Fragmentos disponíveis para compra."""
    __tablename__ = "pacotes_fragmentos"

    id                   = Column(Integer, primary_key=True, index=True)
    nome                 = Column(String(100), nullable=False)
    descricao            = Column(Text, nullable=True)
    icone                = Column(String(10), default="🔮")
    fragmentos_entregues = Column(Integer, nullable=False)
    preco_brl            = Column(Float, nullable=False)
    bonus_pct            = Column(Float, default=0.0)             # % de bônus (0.25 = +25%)
    destaque             = Column(Boolean, default=False)
    ativo                = Column(Boolean, default=True)
    ordem                = Column(Integer, default=0)


class Pagamento(Base):
    """
    Registro IMUTÁVEL de cada transação financeira com o Mercado Pago.
    Linhas nunca são deletadas. mp_payment_id é UNIQUE para garantir idempotência.
    """
    __tablename__ = "pagamentos"
    __table_args__ = (UniqueConstraint("mp_payment_id", name="uq_pagamento_mp_id"),)

    id                    = Column(Integer, primary_key=True, index=True)
    usuario_id            = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    tipo                  = Column(String(20), nullable=False)    # "FRAGMENTOS" | "ASSINATURA"
    referencia_id         = Column(Integer, nullable=True)        # pacote_id ou plano_id
    mp_payment_id         = Column(String(100), nullable=True, index=True)  # ID do pagamento no MP
    mp_status             = Column(String(50), nullable=True)     # approved | pending | rejected
    valor_brl             = Column(Float, nullable=False)
    fragmentos_creditados = Column(Integer, default=0)
    webhook_recebido_em   = Column(DateTime, nullable=True)
    criado_em             = Column(DateTime, default=datetime.utcnow)
    processado_em         = Column(DateTime, nullable=True)       # null = pendente


class FragmentosLedger(Base):
    """
    Ledger imutável de todos os movimentos de Fragmentos do Monarca.
    Nenhum código modifica usuario.fragmentos sem criar uma entrada aqui.
    delta > 0 = crédito, delta < 0 = débito.
    """
    __tablename__ = "fragmentos_ledger"

    id           = Column(Integer, primary_key=True, index=True)
    usuario_id   = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    delta        = Column(Integer, nullable=False)               # positivo = ganhou, negativo = gastou
    saldo_apos   = Column(Integer, nullable=False)               # snapshot do saldo após a operação
    motivo       = Column(String(50), nullable=False)            # ver MOTIVOS abaixo
    # MOTIVOS válidos: compra_pacote | assinatura | gasto_loja | bonus_mensal |
    #                  convite | bonus_arquiteto | indicacao | correcao
    referencia_id = Column(Integer, nullable=True)              # pagamento.id, recompensa_usuario.id, etc.
    observacao    = Column(String(200), nullable=True)
    criado_em     = Column(DateTime, default=datetime.utcnow)


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
            conn.execute(text("ALTER TABLE conquistas ADD COLUMN exclusiva_arquiteto BOOLEAN DEFAULT false"))
    except Exception as e:
        if "already exists" not in str(e).lower() and "duplicate column" not in str(e).lower():
            print(f"[DB MIGRATE WARNING] exclusiva_arquiteto: {e}")
            
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE conquistas ADD COLUMN visivel BOOLEAN DEFAULT true"))
    except Exception as e:
        if "already exists" not in str(e).lower() and "duplicate column" not in str(e).lower():
            print(f"[DB MIGRATE WARNING] visivel: {e}")

    # Missões progressivas (adjetivo ortogonal — vale para ATIVA e PASSIVA)
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE rotinas ADD COLUMN eh_progressiva BOOLEAN DEFAULT false"))
    except Exception as e:
        if "already exists" not in str(e).lower() and "duplicate column" not in str(e).lower():
            print(f"[DB MIGRATE WARNING] eh_progressiva: {e}")

    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE rotinas ADD COLUMN dias_progressivos_alvo INTEGER"))
    except Exception as e:
        if "already exists" not in str(e).lower() and "duplicate column" not in str(e).lower():
            print(f"[DB MIGRATE WARNING] dias_progressivos_alvo: {e}")

    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE rotinas ADD COLUMN dias_progressivos_ok INTEGER DEFAULT 0"))
    except Exception as e:
        if "already exists" not in str(e).lower() and "duplicate column" not in str(e).lower():
            print(f"[DB MIGRATE WARNING] dias_progressivos_ok: {e}")

    # Missão condicional — payload JSON da bifurcação
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE rotinas ADD COLUMN condicional_payload TEXT"))
    except Exception as e:
        if "already exists" not in str(e).lower() and "duplicate column" not in str(e).lower():
            print(f"[DB MIGRATE WARNING] condicional_payload: {e}")
