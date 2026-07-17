import sys
from database import SessionLocal, Dungeon, DungeonMissao, Usuario

db = SessionLocal()
usuario = db.query(Usuario).filter(Usuario.username.ilike('%Jh3ffth%')).first()
if not usuario:
    usuario = db.query(Usuario).first()
    
dungeon = Dungeon(
    usuario_id=usuario.id,
    titulo="O Núcleo (Deep Work)",
    descricao="Seu escritório, sua masmorra. Foco absoluto no código, silêncio no ambiente e café na mesa. Somente saia quando o objetivo for atingido.",
    tipo_permanencia="PERMANENTE",
    tipo_recorrencia="DIARIA",
    dias_semana="[0,1,2,3,4]",
    hora_entrada="09:00",
    hora_saida="18:00",
    tolerancia_min=15,
    categoria="Trabalho",
    rank="A",
    dificuldade="DIFICIL",
    icone="??",
    cor="#3b82f6",
    tema_ambiente="Trabalho",
    xp_entrada=20,
    xp_clear=100,
    moedas_clear=15,
    penalidade_entrada_xp=30,
    penalidade_atraso_xp=10,
    status="ATIVA"
)
db.add(dungeon)
db.commit()
db.refresh(dungeon)

missoes = [
    DungeonMissao(dungeon_id=dungeon.id, titulo="Fluxo de Código Contínuo", descricao="XP passivo gerado apenas por permanecer focado no código por longo tempo.", icone="?", tipo="PASSIVA", natureza="RESISTENCIA", xp_recompensa=150, moedas_recompensa=10, meta_minutos=120, ativo=True),
    DungeonMissao(dungeon_id=dungeon.id, titulo="Hidratação do Sistema", descricao="Mantenha o corpo hidratado enquanto o cérebro queima.", icone="??", tipo="PASSIVA", natureza="BEM_ESTAR", xp_recompensa=10, moedas_recompensa=1, intervalo_min=45, ativo=True),
    DungeonMissao(dungeon_id=dungeon.id, titulo="Alongar a Armadura", descricao="Evite debuffs permanentes de postura.", icone="??", tipo="PASSIVA", natureza="BEM_ESTAR", xp_recompensa=15, moedas_recompensa=2, intervalo_min=90, ativo=True),
    DungeonMissao(dungeon_id=dungeon.id, titulo="Commit Limpo", descricao="Concluiu uma feature ou resolveu um bug difícil? Registre a vitória.", icone="?", tipo="ATIVA", natureza="PADRAO", xp_recompensa=50, moedas_recompensa=5, ativo=True),
    DungeonMissao(dungeon_id=dungeon.id, titulo="Limpar Débito Técnico", descricao="Você notou um código feio e o refatorou.", icone="??", tipo="ATIVA", natureza="PADRAO", xp_recompensa=30, moedas_recompensa=2, ativo=True),
    DungeonMissao(dungeon_id=dungeon.id, titulo="Epifania do Desenvolvedor!", descricao="De repente, a solução para um problema complexo aparece.", icone="??", tipo="PASSIVA", natureza="EVENTO_ALEATORIO", xp_recompensa=25, moedas_recompensa=5, janela_disparo_min=120, janela_disparo_max=240, expira_em_min=10, ativo=True),
    DungeonMissao(dungeon_id=dungeon.id, titulo="Ataque de Procrastinação", descricao="Vontade de olhar redes sociais... Resista e mantenha o foco!", icone="???", tipo="PASSIVA", natureza="EVENTO_ALEATORIO", xp_recompensa=15, moedas_recompensa=0, janela_disparo_min=60, janela_disparo_max=180, expira_em_min=5, ativo=True),
    DungeonMissao(dungeon_id=dungeon.id, titulo="", descricao="O som do teclado mecânico ressoa pela masmorra...", icone="??", tipo="PASSIVA", natureza="FLAVOR", xp_recompensa=0, moedas_recompensa=0, janela_disparo_min=30, janela_disparo_max=90, expira_em_min=2, ativo=True),
    DungeonMissao(dungeon_id=dungeon.id, titulo="", descricao="Seus olhos queimam, mas a lógica começa a fazer sentido. Continue.", icone="??", tipo="PASSIVA", natureza="FLAVOR", xp_recompensa=0, moedas_recompensa=0, janela_disparo_min=45, janela_disparo_max=120, expira_em_min=2, ativo=True)
]

db.add_all(missoes)
db.commit()
print('Dungeon criada com sucesso! ID:', dungeon.id)
