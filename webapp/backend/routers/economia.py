# -*- coding: utf-8 -*-
"""
Balança do Sistema — as tabelas que precificam e cronometram as missões.

Só o Arquiteto lê e edita. É daqui que saem o XP, a Mana, a penalidade e o
prazo de toda missão do app; mexer nestes números reequilibra o jogo inteiro,
então a porta é a mais estreita que existe.

Por que os valores moram no banco e não no código: para o Arquiteto ajustar
o equilíbrio sem esperar um deploy. O código guarda a semente — se uma linha
sumir, o Sistema volta ao padrão em vez de precificar como zero.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, Usuario, ParametroEconomia
from auth.router import get_usuario_atual
from motors import economia, tempo

router = APIRouter(prefix="/economia", tags=["economia"])


# ── Quem pode mexer na balança ────────────────────────────────────────
# Deliberadamente mais estreito que a Forja da Loja: lá se define o preço
# de um item; aqui se define quanto vale o esforço do hunter.
BALANCEADORES = ("Arquiteto",)


def pode_balancear(usuario: Usuario) -> bool:
    return (usuario.nivel_acesso or "") in BALANCEADORES


def get_balanceador(usuario: Usuario = Depends(get_usuario_atual)) -> Usuario:
    if not pode_balancear(usuario):
        raise HTTPException(403, "Apenas o Arquiteto ajusta a balança do Sistema")
    return usuario


class ParametroIn(BaseModel):
    grupo: str
    chave: str
    valor: float


class SalvarLote(BaseModel):
    itens: List[ParametroIn]


@router.get("/permissao")
def permissao(usuario: Usuario = Depends(get_usuario_atual)):
    """A tela pergunta ao servidor em vez de decidir pelo cargo que tem em mãos."""
    return {"pode_balancear": pode_balancear(usuario)}


@router.get("/tabelas")
def listar(db: Session = Depends(get_db),
           _: Usuario = Depends(get_balanceador)):
    """
    As tabelas prontas para virar grade na tela: agrupadas, ordenadas e com
    rótulo legível. Semeia na primeira leitura, então a tela nunca abre vazia.
    """
    economia.semear(db)

    linhas = (db.query(ParametroEconomia)
                .order_by(ParametroEconomia.grupo, ParametroEconomia.ordem,
                          ParametroEconomia.chave).all())
    grupos = {}
    for p in linhas:
        grupos.setdefault(p.grupo, {
            "grupo": p.grupo,
            "titulo": economia.GRUPOS.get(p.grupo, p.grupo),
            "itens": [],
        })["itens"].append({
            "chave": p.chave,
            "rotulo": p.rotulo or p.chave,
            "valor": p.valor,
        })
    return {"grupos": list(grupos.values())}


@router.put("/tabelas")
def salvar(payload: SalvarLote,
           db: Session = Depends(get_db),
           arq: Usuario = Depends(get_balanceador)):
    """
    Salva em LOTE e invalida o cache na hora — a mudança vale no próximo
    cálculo, sem reiniciar nada.

    Nada é criado aqui: só se altera parâmetro que já existe. Assim um erro
    de digitação no nome do grupo não cria uma linha órfã que ninguém lê.
    """
    alterados = 0
    for item in payload.itens:
        p = db.query(ParametroEconomia).filter(
            ParametroEconomia.grupo == item.grupo,
            ParametroEconomia.chave == item.chave,
        ).first()
        if not p:
            continue
        if p.valor == item.valor:
            continue
        p.valor = float(item.valor)
        p.editado_em = tempo.agora()
        alterados += 1

    if alterados:
        db.commit()
        economia.invalidar_cache()
    return {"ok": True, "alterados": alterados}


@router.post("/restaurar")
def restaurar(grupo: Optional[str] = None,
              db: Session = Depends(get_db),
              arq: Usuario = Depends(get_balanceador)):
    """
    Devolve os valores de fábrica. Sem `grupo`, restaura tudo.

    Existe porque experimentar equilíbrio sem um caminho de volta é o tipo de
    coisa que faz ninguém experimentar.
    """
    restaurados = 0
    for g, chave, valor, rotulo, ordem in economia.SEMENTE:
        if grupo and g != grupo:
            continue
        p = db.query(ParametroEconomia).filter(
            ParametroEconomia.grupo == g, ParametroEconomia.chave == chave).first()
        if p and p.valor != float(valor):
            p.valor = float(valor)
            p.editado_em = tempo.agora()
            restaurados += 1
    if restaurados:
        db.commit()
        economia.invalidar_cache()
    return {"ok": True, "restaurados": restaurados}


@router.get("/simular")
def simular(tipo: str = "DIARIA", prioridade: str = "MEDIA",
            dificuldade: str = "NORMAL", categoria: str = "Pessoal",
            avulsa: bool = False,
            db: Session = Depends(get_db),
            usuario: Usuario = Depends(get_usuario_atual)):
    """
    Quanto vale e quanto tempo tem uma missão com estas características.

    É o que faz a prévia do lançador parar de mentir: em vez de o cliente
    recalcular por conta própria (e divergir do servidor na primeira mudança
    de tabela), ele PERGUNTA. Aberto a qualquer hunter — é a informação que
    ele precisa para escolher, não um poder.
    """
    v = (economia.recompensa_tarefa(prioridade, dificuldade, categoria, db)
         if avulsa else
         economia.recompensa_rotina(tipo, prioridade, dificuldade, categoria, db))
    return v
