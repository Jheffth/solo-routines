# -*- coding: utf-8 -*-
"""
Economia das missões — quem precifica e cronometra é o SERVIDOR.

O BURACO QUE ISTO FECHOU

`TarefaCreate` e `RotinaCreate` recebiam `xp_recompensa` do cliente e usavam
o número sem teto. Verificado executando: pedi uma missão de 999.999 XP, ela
foi aceita, e o hunter saltou 1.052.298 XP e foi ao nível 100 numa requisição.

A REGRA

    O cliente diz o que a missão É.     (tipo, prioridade, dificuldade, categoria)
    O servidor diz quanto ela VALE.     (xp, moedas, penalidade)
    O servidor diz quanto tempo ela TEM. (prazo em minutos)

AS TABELAS VIVEM NO BANCO

Ficam em `parametros_economia` para o Arquiteto ajustar sem deploy. Os
valores abaixo são a SEMENTE: entram no banco na primeira vez e passam a ser
apenas rede de segurança — se a consulta falhar, o Sistema continua de pé com
eles em vez de precificar tudo como zero.

O cache existe porque isto é chamado a cada criação e a cada prévia; ir ao
banco toda vez seria desperdício. Salvar pelos endpoints do Arquiteto invalida
o cache na hora, então a mudança aparece no próximo cálculo.
"""
import time

# ── SEMENTE ──────────────────────────────────────────────────────────
# (grupo, chave, valor, rótulo, ordem)
SEMENTE = [
    # XP base da missão AVULSA, pela urgência
    ("xp_prioridade", "CRITICA", 120, "Crítica", 1),
    ("xp_prioridade", "ALTA",     90, "Alta",    2),
    ("xp_prioridade", "MEDIA",    60, "Média",   3),
    ("xp_prioridade", "BAIXA",    35, "Baixa",   4),
    ("mc_prioridade", "CRITICA",  20, "Crítica", 1),
    ("mc_prioridade", "ALTA",     15, "Alta",    2),
    ("mc_prioridade", "MEDIA",    10, "Média",   3),
    ("mc_prioridade", "BAIXA",     5, "Baixa",   4),

    # XP base da ROTINA, pela raridade da frequência
    ("xp_tipo", "DIARIA",    50, "Diária",  1),
    ("xp_tipo", "SEMANAL",  200, "Semanal", 2),
    ("xp_tipo", "MENSAL",   500, "Mensal",  3),
    ("xp_tipo", "ANUAL",   2000, "Anual",   4),
    ("mc_tipo", "DIARIA",     5, "Diária",  1),
    ("mc_tipo", "SEMANAL",   25, "Semanal", 2),
    ("mc_tipo", "MENSAL",    60, "Mensal",  3),
    ("mc_tipo", "ANUAL",    250, "Anual",   4),

    # Multiplicadores
    ("mult_dificuldade", "FACIL",    0.5, "Fácil",    1),
    ("mult_dificuldade", "NORMAL",   1.0, "Normal",   2),
    ("mult_dificuldade", "DIFICIL",  1.5, "Difícil",  3),
    ("mult_dificuldade", "LENDARIO", 2.5, "Lendário", 4),
    ("mult_prioridade",  "CRITICA",  1.5, "Crítica",  1),
    ("mult_prioridade",  "ALTA",     1.2, "Alta",     2),
    ("mult_prioridade",  "MEDIA",    1.0, "Média",    3),
    ("mult_prioridade",  "BAIXA",    0.7, "Baixa",    4),

    # Tempero por natureza da missão. Neutro (1.0) por padrão — existe para
    # o Arquiteto diferenciar depois, sem precisar de código novo.
    ("bonus_categoria", "Saúde",    1.0, "Saúde",    1),
    ("bonus_categoria", "Trabalho", 1.0, "Trabalho", 2),
    ("bonus_categoria", "Estudo",   1.0, "Estudo",   3),
    ("bonus_categoria", "Casa",     1.0, "Casa",     4),
    ("bonus_categoria", "Pessoal",  1.0, "Pessoal",  5),
    ("bonus_categoria", "Combate",  1.0, "Combate",  6),

    # Fração do XP perdida ao falhar. Baixa não pune: cobrar por não fazer o
    # que era opcional só ensina a não cadastrar.
    ("penal_prioridade", "CRITICA", 0.5,  "Crítica", 1),
    ("penal_prioridade", "ALTA",    0.3,  "Alta",    2),
    ("penal_prioridade", "MEDIA",   0.15, "Média",   3),
    ("penal_prioridade", "BAIXA",   0.0,  "Baixa",   4),

    # REERGUER — o preço em Mana de reabrir uma rotina de janela que fechou.
    # É preço de desconforto, não de mercado: alto o bastante para doer,
    # baixo o bastante para não fazer o hunter desistir do banho.
    ("custo_reerguer", "PADRAO", 25, "Custo fixo em Mana", 1),

    # PRAZO base em MINUTOS, pela urgência. A dificuldade multiplica: uma
    # tarefa lendária precisa de mais fôlego que uma fácil.
    #   Crítica  30min · Alta 2h · Média 8h · Baixa 2 dias
    ("prazo_prioridade", "CRITICA",   30,   "Crítica", 1),
    ("prazo_prioridade", "ALTA",     120,   "Alta",    2),
    ("prazo_prioridade", "MEDIA",    480,   "Média",   3),
    ("prazo_prioridade", "BAIXA",   2880,   "Baixa",   4),
]

# Rótulos amigáveis dos grupos, para a tela do Arquiteto.
GRUPOS = {
    "xp_prioridade":    "XP base — missão avulsa (por prioridade)",
    "mc_prioridade":    "Mana base — missão avulsa (por prioridade)",
    "xp_tipo":          "XP base — rotina (por frequência)",
    "mc_tipo":          "Mana base — rotina (por frequência)",
    "mult_dificuldade": "Multiplicador de dificuldade (XP e prazo)",
    "mult_prioridade":  "Multiplicador de prioridade (XP)",
    "bonus_categoria":  "Tempero por categoria",
    "penal_prioridade": "Penalidade ao falhar (fração do XP)",
    "prazo_prioridade": "Prazo base em MINUTOS (por prioridade)",
    "custo_reerguer":   "Reerguer missão fechada (custo em Mana)",
}

# Teto duro. Nenhuma combinação legítima chega perto; existe como última
# linha de defesa caso alguém acrescente um multiplicador distraído.
TETO_XP      = 10_000
TETO_MOEDAS  = 1_000
TETO_MINUTOS = 60 * 24 * 365      # um ano

# ── Cache ────────────────────────────────────────────────────────────
_cache = None
_cache_em = 0
_TTL = 300     # 5 min; salvar pelos endpoints invalida na hora


def invalidar_cache():
    """Chamado ao salvar. A mudança do Arquiteto vale no próximo cálculo."""
    global _cache, _cache_em
    _cache = None
    _cache_em = 0


def _semente_dict():
    d = {}
    for grupo, chave, valor, _rot, _ord in SEMENTE:
        d.setdefault(grupo, {})[chave] = float(valor)
    return d


def tabelas(db=None) -> dict:
    """
    As tabelas vigentes: {grupo: {chave: valor}}.

    Lê do banco e cai na semente para o que faltar — assim uma linha apagada
    por engano não zera a recompensa de ninguém, só volta ao padrão.
    """
    global _cache, _cache_em
    agora = time.time()
    if _cache is not None and (agora - _cache_em) < _TTL:
        return _cache

    dados = _semente_dict()
    if db is not None:
        try:
            from database import ParametroEconomia
            for p in db.query(ParametroEconomia).all():
                dados.setdefault(p.grupo, {})[p.chave] = float(p.valor)
        except Exception as e:
            print(f"[ECONOMIA] ⚠ lendo do banco: {e} — usando a semente")

    _cache, _cache_em = dados, agora
    return dados


def semear(db) -> int:
    """Põe a semente no banco na primeira vez. Não sobrescreve o que o
       Arquiteto já ajustou — só acrescenta o que não existe."""
    from database import ParametroEconomia
    existentes = {(p.grupo, p.chave) for p in db.query(
        ParametroEconomia.grupo, ParametroEconomia.chave).all()}
    novos = 0
    for grupo, chave, valor, rotulo, ordem in SEMENTE:
        if (grupo, chave) in existentes:
            continue
        db.add(ParametroEconomia(grupo=grupo, chave=chave, valor=float(valor),
                                 rotulo=rotulo, ordem=ordem))
        novos += 1
    if novos:
        db.commit()
        invalidar_cache()
    return novos


def _v(t, grupo, chave, padrao):
    try:
        return float(t.get(grupo, {}).get(str(chave).upper() if grupo != "bonus_categoria"
                                          else str(chave), padrao))
    except Exception:
        return padrao


def _norm(v, padrao):
    return (v or padrao).strip().upper() if isinstance(v, str) else padrao


# ── Cálculo ──────────────────────────────────────────────────────────
def prazo_minutos(prioridade: str, dificuldade: str, db=None) -> int:
    """Quanto tempo a missão tem, do play ao fim.

    Urgência define a base; dificuldade multiplica. Uma crítica fácil tem
    15 min; uma baixa lendária tem 5 dias."""
    t = tabelas(db)
    prio  = _norm(prioridade, "MEDIA")
    dific = _norm(dificuldade, "NORMAL")
    base = _v(t, "prazo_prioridade", prio, 480)
    mult = _v(t, "mult_dificuldade", dific, 1.0)
    return int(min(TETO_MINUTOS, max(5, base * mult)))


def recompensa_rotina(tipo, prioridade, dificuldade, categoria=None, db=None) -> dict:
    t = tabelas(db)
    tp    = _norm(tipo, "DIARIA")
    prio  = _norm(prioridade, "MEDIA")
    dific = _norm(dificuldade, "NORMAL")

    md  = _v(t, "mult_dificuldade", dific, 1.0)
    mp  = _v(t, "mult_prioridade",  prio, 1.0)
    cat = _v(t, "bonus_categoria", categoria or "Pessoal", 1.0)

    xp = min(TETO_XP,     max(10, int(_v(t, "xp_tipo", tp, 50) * md * mp * cat)))
    mc = min(TETO_MOEDAS, max(1,  int(_v(t, "mc_tipo", tp, 5)  * md * cat)))
    return {
        "xp_recompensa": xp,
        "moedas_recompensa": mc,
        "penalidade_xp": int(xp * _v(t, "penal_prioridade", prio, 0.0)),
        "prazo_minutos": prazo_minutos(prio, dific, db),
    }


def recompensa_tarefa(prioridade, dificuldade, categoria=None, db=None) -> dict:
    t = tabelas(db)
    prio  = _norm(prioridade, "MEDIA")
    dific = _norm(dificuldade, "NORMAL")

    md  = _v(t, "mult_dificuldade", dific, 1.0)
    cat = _v(t, "bonus_categoria", categoria or "Pessoal", 1.0)

    xp = min(TETO_XP,     max(10, int(_v(t, "xp_prioridade", prio, 60) * md * cat)))
    mc = min(TETO_MOEDAS, max(1,  int(_v(t, "mc_prioridade", prio, 10) * md * cat)))
    return {
        "xp_recompensa": xp,
        "moedas_recompensa": mc,
        "penalidade_xp": int(xp * _v(t, "penal_prioridade", prio, 0.0)),
        "prazo_minutos": prazo_minutos(prio, dific, db),
    }


def custo_reerguer(db=None) -> int:
    """Mana cobrada para reabrir uma missão de janela que já fechou."""
    t = tabelas(db)
    return max(0, int(_v(t, "custo_reerguer", "PADRAO", 25)))


def confissao(alvo) -> dict:
    """
    O preço de admitir que quebrou o protocolo.

    A missão passiva é um sistema de honra: ninguém consegue verificar se o
    hunter tomou café às 22h. Isso cria um problema que não é técnico, é de
    incentivo — se confessar custasse o mesmo que ficar calado, o silêncio
    seria a jogada racional, e o registro (a única coisa que a missão passiva
    produz) viraria ficção.

    Por isso a confissão custa METADE. E, mais importante que o desconto:
    ela NÃO passa por `aplicar_xp`, então o streak fica intacto — quem
    confessa não perde a sequência que construiu. A honestidade sai barata de
    propósito, porque é ela que mantém o extrato valendo alguma coisa.
    """
    cheia = max(0, int(getattr(alvo, "penalidade_xp", 0) or 0))
    return {"xp": 0, "moedas": 0, "penalidade": cheia // 2, "motivo": "confessada"}


def liquidacao(alvo, vencida: bool, reerguida: bool = False) -> dict:
    """
    QUANTO vale concluir esta missão AGORA. Ponto único da decisão.

    Três desfechos, e a diferença entre eles é a razão de esta função existir
    em vez de um `if` solto em cada router:

      no prazo   → recompensa cheia, sem punição.
      atrasada   → ZERO recompensa e a punição declarada. O hunter ainda pode
                   (e deve) concluir: o hábito vale mais que o placar, mas o
                   placar precisa ser honesto sobre o atraso.
      reerguida  → zero de tudo. Ele já pagou Mana pela segunda chance e já
                   levou a punição quando a janela fechou. Cobrar de novo
                   seria punir duas vezes; pagar XP transformaria Mana em XP,
                   e é exatamente esse tipo de torneira que furou a economia
                   da última vez.

    Devolve também `motivo`, que o frontend usa para explicar ao hunter por
    que o número apareceu — número sem explicação vira reclamação.
    """
    if reerguida:
        return {"xp": 0, "moedas": 0, "penalidade": 0, "motivo": "reerguida"}
    if vencida:
        return {
            "xp": 0, "moedas": 0,
            "penalidade": max(0, int(getattr(alvo, "penalidade_xp", 0) or 0)),
            "motivo": "atrasada",
        }
    return {
        "xp": max(0, int(getattr(alvo, "xp_recompensa", 0) or 0)),
        "moedas": max(0, int(getattr(alvo, "moedas_recompensa", 0) or 0)),
        "penalidade": 0,
        "motivo": "no_prazo",
    }


def aplicar(alvo, valores: dict) -> None:
    """Carimba o calculado no objeto, ignorando o que veio do cliente.

    O prazo só é sobrescrito quando o alvo tem a coluna E não foi definido
    à mão — a modalidade Personalizada guarda o prazo escolhido pelo hunter,
    e recalcular por cima apagaria a escolha dele."""
    alvo.xp_recompensa     = valores["xp_recompensa"]
    alvo.moedas_recompensa = valores["moedas_recompensa"]
    alvo.penalidade_xp     = valores["penalidade_xp"]
    if hasattr(alvo, "prazo_minutos") and not getattr(alvo, "prazo_personalizado", False):
        alvo.prazo_minutos = valores["prazo_minutos"]
