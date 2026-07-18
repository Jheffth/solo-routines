# -*- coding: utf-8 -*-
"""
motor_recompensa.py — REFERÊNCIA da REGRA DO MOTOR

NUNCA credite XP/moedas escrevendo direto no modelo do usuário:

    usuario.xp_total += bonus      # ERRADO: nível nunca sobe
    db.commit()

Use sempre as funções abaixo. Elas processam os level-ups e devolvem
os eventos que a animação de Ascensão consome.

Requer no módulo: processar_level_up(db, usuario) e o model Nivel com
  (nivel, rank, titulo, xp_necessario, xp_para_proximo, moedas_bonus)
"""

def recalcular_nivel(db: Session, usuario: Usuario) -> dict:
    """
    Deriva nível, rank, título e xp_atual a partir do xp_total (fonte da verdade).
    Usado após estornos/ajustes — mantém o perfil sempre coerente, sem
    ficar com nível alto e XP baixo (ou o contrário).
    """
    xp_total = max(0, usuario.xp_total or 0)
    alvo = (
        db.query(Nivel)
        .filter(Nivel.xp_necessario <= xp_total)
        .order_by(Nivel.nivel.desc())
        .first()
    )
    if not alvo:
        alvo = db.query(Nivel).order_by(Nivel.nivel.asc()).first()
    if not alvo:
        return {"nivel": usuario.nivel_atual}

    prox = db.query(Nivel).filter(Nivel.nivel == alvo.nivel + 1).first()
    usuario.nivel_atual      = alvo.nivel
    usuario.classe           = alvo.rank
    usuario.titulo           = alvo.titulo
    usuario.xp_atual         = max(0, xp_total - (alvo.xp_necessario or 0))
    usuario.xp_proximo_nivel = prox.xp_para_proximo if prox else 0
    return {
        "nivel": usuario.nivel_atual,
        "rank": usuario.classe,
        "titulo": usuario.titulo,
        "xp_atual": usuario.xp_atual,
        "xp_proximo": usuario.xp_proximo_nivel,
    }


def creditar_bonus(db: Session, usuario: Usuario, xp: int, moedas: int) -> list[dict]:
    """
    Credita XP/moedas avulsos (ex.: bônus de conquista) PASSANDO PELO MOTOR:
    aplica o ganho e processa os level-ups decorrentes.
    Retorna a lista de level-ups para a animação de Ascensão.
    """
    usuario.xp_total = (usuario.xp_total or 0) + (xp or 0)
    usuario.xp_atual = (usuario.xp_atual or 0) + (xp or 0)
    usuario.moedas   = (usuario.moedas or 0) + (moedas or 0)
    eventos = processar_level_up(db, usuario)
    db.flush()
    return eventos


# ══════════════════════════════════════════════════════════════
# COMO USAR NO ENDPOINT
# ══════════════════════════════════════════════════════════════
#
# CONCEDER (credita e celebra):
#     level_ups = creditar_bonus(db, usuario, c.xp_bonus, c.moedas_bonus)
#     db.commit()
#     return {
#         "level_ups": level_ups,                    # -> Ascensao.mostrar()
#         "novas_conquistas": [{                     # -> ConquistaFX.show()
#             "id": c.id, "codigo": c.codigo,        # 'codigo' = insígnia própria
#             "titulo": c.titulo, "descricao": c.descricao,
#             "icone": c.icone, "xp_bonus": c.xp_bonus,
#         }],
#     }
#
# REVOGAR/ESTORNAR (recalcula, não subtrai):
#     usuario.xp_total = max(0, usuario.xp_total - c.xp_bonus)
#     usuario.moedas   = max(0, usuario.moedas   - c.moedas_bonus)
#     estado = recalcular_nivel(db, usuario)   # deriva nível/rank/título/xp_atual
#     db.commit()
#
# REPARAR perfis afetados por escritas antigas fora do motor:
#     @router.post("/sincronizar-nivel")
#     def sincronizar_nivel(...):
#         antes = usuario.nivel_atual
#         estado = recalcular_nivel(db, usuario)
#         db.commit()
#         ganhou = estado["nivel"] - antes
#         level_ups = [{"nivel": estado["nivel"], "rank": estado["rank"],
#                       "titulo": estado["titulo"], "moedas_bonus": 0,
#                       "niveis_ganhos": ganhou, "nivel_anterior": antes}] if ganhou > 0 else []
#         return {"ok": True, "level_ups": level_ups}
