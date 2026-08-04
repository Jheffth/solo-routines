# -*- coding: utf-8 -*-
"""
Seed — Fragmentos do Monarca 🔮

Popula o banco com os planos de assinatura e pacotes de Fragmentos
definidos pela estratégia de monetização do Solo Routines.

Chamado automaticamente no startup via main.py.
Idempotente: verifica se os dados já existem antes de inserir.

──────────────────────────────────────────────────────────────────
PLANOS DE ASSINATURA:
  Mensal    R$  4,99 → 50  🔮/mês
  Semestral R$ 19,99 → 75  🔮/mês  (+20 de bônus/mês vs 6x mensal)
  Vitalícia R$ 44,99 → 100 🔮/mês  (crédito único de entrada)

PACOTES DE FRAGMENTOS:
  Starter  100  🔮  R$  4,99  (sem bônus)
  Aventureiro 300 🔮 R$ 12,99 (+20% bônus → 360 🔮)
  Monarca  700  🔮  R$ 24,99  (+40% bônus → 980 🔮)  ★ destaque
──────────────────────────────────────────────────────────────────
"""
from sqlalchemy.orm import Session
from database import Plano, PacoteFragmentos


_PLANOS = [
    {
        "nome":                    "Mensal",
        "descricao":               "Acesso premium renovado mensalmente. Inclui 50 Fragmentos do Monarca todo mês.",
        "preco_brl":               4.99,
        "ciclo":                   "MENSAL",
        "fragmentos_bonus_mensal": 50,
        "destaque":                False,
        "ativo":                   True,
        "ordem":                   1,
    },
    {
        "nome":                    "Semestral",
        "descricao":               "6 meses de acesso premium com desconto. Inclui 75 Fragmentos por mês — mais econômico que o Mensal.",
        "preco_brl":               19.99,
        "ciclo":                   "SEMESTRAL",
        "fragmentos_bonus_mensal": 75,
        "destaque":                True,     # plano recomendado
        "ativo":                   True,
        "ordem":                   2,
    },
    {
        "nome":                    "Vitalícia",
        "descricao":               "Acesso premium para sempre, sem renovações. Inclui 100 Fragmentos mensais e todos os benefícios futuros.",
        "preco_brl":               44.99,
        "ciclo":                   "VITALICIO",
        "fragmentos_bonus_mensal": 100,
        "destaque":                False,
        "ativo":                   True,
        "ordem":                   3,
    },
]

_PACOTES = [
    {
        "nome":                 "Pacote Starter",
        "descricao":            "O começo da jornada. Ideal para experimentar a loja premium.",
        "icone":                "🔮",
        "fragmentos_entregues": 100,
        "preco_brl":            4.99,
        "bonus_pct":            0.0,
        "destaque":             False,
        "ativo":                True,
        "ordem":                1,
    },
    {
        "nome":                 "Pacote Aventureiro",
        "descricao":            "Para o hunter que quer avançar mais rápido. Bônus de +20% incluído.",
        "icone":                "🔮",
        "fragmentos_entregues": 360,    # 300 + 20% bônus
        "preco_brl":            12.99,
        "bonus_pct":            0.20,
        "destaque":             False,
        "ativo":                True,
        "ordem":                2,
    },
    {
        "nome":                 "Pacote Monarca",
        "descricao":            "O kit do verdadeiro Monarca. Maior bônus, melhor custo-benefício.",
        "icone":                "🔮",
        "fragmentos_entregues": 980,    # 700 + 40% bônus
        "preco_brl":            24.99,
        "bonus_pct":            0.40,
        "destaque":             True,   # destaque na vitrine
        "ativo":                True,
        "ordem":                3,
    },
]


def semear_fragmentos(db: Session) -> None:
    """
    Insere planos e pacotes se ainda não existirem.
    Seguro para chamar múltiplas vezes (idempotente por ciclo/nome).
    """
    # ── Planos ────────────────────────────────────────────────────────────────
    planos_existentes = {p.ciclo for p in db.query(Plano).all()}
    novos_planos = 0
    for dados in _PLANOS:
        if dados["ciclo"] not in planos_existentes:
            db.add(Plano(**dados))
            novos_planos += 1

    # ── Pacotes de Fragmentos ─────────────────────────────────────────────────
    pacotes_existentes = {p.nome for p in db.query(PacoteFragmentos).all()}
    novos_pacotes = 0
    for dados in _PACOTES:
        if dados["nome"] not in pacotes_existentes:
            db.add(PacoteFragmentos(**dados))
            novos_pacotes += 1

    if novos_planos or novos_pacotes:
        db.commit()
        print(
            f"[SEED FRAGMENTOS] [OK] "
            f"{novos_planos} plano(s) e {novos_pacotes} pacote(s) inseridos."
        )
    else:
        print("[SEED FRAGMENTOS] [OK] Catalogo ja estava populado.")
