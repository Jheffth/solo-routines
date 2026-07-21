# -*- coding: utf-8 -*-
"""
Router de Hunters — busca e perfil público.

Diferente de /emblemas/hunters (painel administrativo, devolve tudo sobre
todo mundo), aqui é a vitrine: qualquer hunter logado pode procurar outro
e ver o que ele conquistou.

Três decisões que sustentam isso:

  1. LEVE POR CONSTRUÇÃO. A busca é por PREFIXO (usa índice), pede só as
     colunas que a lista mostra e tem LIMIT fixo. Custa ~1ms e menos de
     1 KB, então pode rodar a cada tecla digitada sem pesar.

  2. NADA DE DADO SENSÍVEL. O perfil público não devolve e-mail, nem
     moedas, nem o nível de acesso de administradores. Quem é Arquiteto
     aparece como tal porque isso é parte do jogo; quem é Admin, não —
     saber quem tem poder no Sistema não é informação de vitrine.

  3. CONTA SUSPENSA NÃO APARECE. Nem na busca, nem por link direto.
"""
import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from database import get_db, Usuario, Conquista, ConquistaUsuario, Execucao
from auth.router import get_usuario_atual

router = APIRouter(prefix="/hunters", tags=["hunters"])

LIMITE_BUSCA = 8
MIN_TERMO    = 2


def _ler_altar(u: Usuario) -> list:
    """Relíquias que o hunter fixou. JSON corrompido nunca derruba a vitrine."""
    try:
        dados = json.loads(getattr(u, "reliquias_fixadas", None) or "[]")
        return [c for c in dados if isinstance(c, str)][:5]
    except Exception:
        return []


def _presenca(ultimo_acesso) -> str:
    """
    Faixa de presença, não o carimbo exato.

    Devolvemos 'online' | 'recente' | 'hoje' | 'ausente' | 'sumido' e deixamos
    o texto para o frontend. Assim a vitrine mostra que o hunter está vivo sem
    publicar o horário exato em que cada um abre o app — que é dado de rotina
    pessoal, não de vitrine.
    """
    if not ultimo_acesso:
        return "sumido"
    minutos = (datetime.utcnow() - ultimo_acesso).total_seconds() / 60
    if minutos < 5:      return "online"
    if minutos < 60:     return "recente"
    if minutos < 60 * 24:  return "hoje"
    if minutos < 60 * 24 * 7: return "ausente"
    return "sumido"


def _raridade(xp_bonus: int) -> str:
    """
    Mesmos cortes usados no perfil privado (perfil.js::_raridade), para que
    uma Lendária seja Lendária nas duas telas.

    Devolvemos a FAIXA, não o XP: a vitrine precisa da linguagem de prestígio
    ('lendaria' pinta a moldura de dourado) sem revelar o número exato que
    cada emblema concede.
    """
    xp = xp_bonus or 0
    if xp >= 2000: return "lendaria"
    if xp >= 500:  return "epica"
    if xp >= 200:  return "rara"
    return "comum"


@router.get("/buscar")
def buscar(
    q: str = Query("", description="Nick ou nome do hunter"),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """
    Busca por prefixo. Devolve no máximo 8 resultados enxutos — o bastante
    para uma lista de sugestões, leve o bastante para rodar enquanto digita.
    """
    termo = (q or "").strip()
    if len(termo) < MIN_TERMO:
        return {"resultados": [], "termo": termo}

    # O próprio hunter APARECE nos resultados. Ele estava excluído aqui, e o
    # efeito colateral foi tirar dele o único caminho para a própria vitrine:
    # não dava para ver como os outros o veem.
    padrao = f"{termo}%"
    linhas = (db.query(Usuario.id, Usuario.nome, Usuario.login, Usuario.avatar_url,
                       Usuario.classe, Usuario.titulo, Usuario.nivel_atual,
                       Usuario.ultimo_acesso)
                .filter(Usuario.ativo == True,
                        or_(Usuario.login.ilike(padrao), Usuario.nome.ilike(padrao)))
                .order_by(Usuario.nome.asc())
                .limit(LIMITE_BUSCA).all())

    return {"termo": termo, "resultados": [{
        "id": r.id, "nome": r.nome, "login": r.login,
        "avatar_url": r.avatar_url, "classe": r.classe,
        "titulo": r.titulo, "nivel_atual": r.nivel_atual,
        "presenca": _presenca(r.ultimo_acesso),
        "eu_mesmo": r.id == usuario.id,
    } for r in linhas]}


@router.get("/{login}")
def perfil_publico(
    login: str,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """A vitrine de um hunter: o que ele é e o que já conquistou."""
    h = (db.query(Usuario)
           .filter(Usuario.login.ilike((login or "").strip()),
                   Usuario.ativo == True).first())
    if not h:
        raise HTTPException(404, "Nenhum hunter com esse nick no Sistema")

    # Uma consulta só para todas as relíquias dele
    posses = (db.query(ConquistaUsuario, Conquista)
                .join(Conquista, Conquista.id == ConquistaUsuario.conquista_id)
                .filter(ConquistaUsuario.usuario_id == h.id)
                .order_by(ConquistaUsuario.desbloqueada_em.desc()).all())

    reliquias, conquistadas, presenteadas = [], 0, 0
    for cu, cq in posses:
        exclusiva = bool(getattr(cq, "exclusiva_arquiteto", False))
        # comemorativa que o dono escolheu ocultar não vai para a vitrine
        if exclusiva and not bool(getattr(cq, "visivel", True)):
            continue
        de_missao = (cq.condicao_tipo or "").lower() != "manual"
        if de_missao:
            conquistadas += 1
        else:
            presenteadas += 1
        reliquias.append({
            "codigo": cq.codigo, "titulo": cq.titulo,
            "descricao": cq.descricao, "icone": cq.icone, "cor": cq.cor,
            "de_missao": de_missao,
            "raridade": _raridade(cq.xp_bonus),
            "em": cu.desbloqueada_em.isoformat() if cu.desbloqueada_em else None,
        })

    dias = None
    if h.criado_em:
        dias = max(0, (datetime.utcnow() - h.criado_em).days)

    # ── Feitos do Sistema ────────────────────────────────────────────────
    # Nível e XP são abstrações do trabalho; aqui mostramos o trabalho.
    # Duas consultas agregadas — nada de contar linha por linha em Python.
    # Os quatro números saem de UMA varredura só — inclusive a contagem de
    # dias distintos, que cabe no mesmo SELECT.
    tot, rot, mis, dias_ativos = (db.query(
        func.count(Execucao.id),
        func.count(Execucao.rotina_id),
        func.count(Execucao.tarefa_id),
        func.count(func.distinct(Execucao.data_execucao)),
    ).filter(Execucao.usuario_id == h.id).one())
    dias_ativos = dias_ativos or 0

    # Consistência: dias com atividade sobre dias de casa. O +1 conta o dia
    # de hoje — sem ele, quem entrou hoje teria divisão por zero.
    janela = (dias or 0) + 1
    consistencia = round(min(100, (dias_ativos / janela) * 100)) if janela else 0

    feitos = {
        "execucoes_total": tot or 0,
        "rotinas":         rot or 0,
        "missoes":         mis or 0,
        "dias_ativos":     dias_ativos,
        "consistencia":    consistencia,
        "streak_max":      h.streak_max or 0,
        "streak_atual":    h.streak_atual or 0,
    }

    return {
        "hunter": {
            "id": h.id, "nome": h.nome, "login": h.login,
            "avatar_url": h.avatar_url,
            "classe": h.classe, "titulo": h.titulo,
            "nivel_atual": h.nivel_atual,
            "xp_total": h.xp_total,
            "xp_atual": h.xp_atual, "xp_proximo_nivel": h.xp_proximo_nivel,
            "streak_atual": h.streak_atual, "streak_max": h.streak_max,
            # O Arquiteto é figura pública do Sistema. Já quem é Admin,
            # não: privilégio não é informação de vitrine.
            "arquiteto": h.nivel_acesso == "Arquiteto",
            "desde": h.criado_em.isoformat() if h.criado_em else None,
            "dias_no_sistema": dias,
            "eu_mesmo": h.id == usuario.id,
            # Presença: a faixa e os minutos decorridos. Mandamos minutos, e
            # não o carimbo, para o texto não depender do relógio do visitante
            # nem do fuso do navegador.
            "presenca": _presenca(h.ultimo_acesso),
            "visto_ha_min": (
                int((datetime.utcnow() - h.ultimo_acesso).total_seconds() // 60)
                if h.ultimo_acesso else None),
        },
        "feitos": feitos,
        # O altar que ELE escolheu — a vitrine respeita a decisão do dono.
        "fixadas": [c for c in _ler_altar(h)
                    if any(r["codigo"] == c for r in reliquias)],
        "reliquias": reliquias,
        "resumo": {
            "total": len(reliquias),
            "conquistadas": conquistadas,
            "presenteadas": presenteadas,
        },
    }
