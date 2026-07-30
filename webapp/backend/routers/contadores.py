"""
Router de Contadores — os baldes onde as repetições se acumulam.

O QUE É UM CONTADOR

Uma rotina de repetições responde "quantas hoje". O contador responde
"quantas ao todo" — e é ele que faz o registro ser um registro em vez de
um placar que zera à meia-noite.

Três rotinas diferentes ("Questões de História", "Questões de Português",
"Simulado de fim de semana") podem alimentar o MESMO contador. O total é
a soma de todas, e sobrevive ao fim de qualquer uma delas.

O TOTAL NUNCA É ARMAZENADO

    SELECT SUM(ed.repeticoes) FROM execucao_dia ed
      JOIN rotinas r ON r.id = ed.rotina_id
     WHERE r.contador_id = :id

Uma coluna `total` criaria uma segunda verdade, e ela divergiria no
primeiro desfazer, na primeira exclusão, no primeiro ajuste do Arquiteto.
Este projeto já pagou por segunda-verdade cinco vezes.

A PORTA DA GUILDA

Toda consulta aqui filtra por `contador_id` e NADA MAIS — nunca
`AND usuario_id`. A posse é checada uma vez, na entrada, por
`_meu()`. Depois disso a soma é cega a quem fez.

Isso não é elegância: é o que permite um contador de guilda existir no
futuro sem reescrever nenhuma destas consultas. Bastará afrouxar o
`_meu()`. Se a soma filtrasse por usuário, cada hunter veria só a própria
parte de um total que deveria ser coletivo — e o bug seria invisível,
porque cada número, isolado, estaria certo.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
from datetime import date, timedelta

from database import get_db, Contador, Rotina, ExecucaoDia, Usuario
from auth.router import get_usuario_atual
from motors import tempo

router = APIRouter(prefix="/contadores", tags=["contadores"])


class ContadorIn(BaseModel):
    nome: str
    unidade: Optional[str] = None


def _meu(db: Session, usuario: Usuario, contador_id: int) -> Contador:
    """A ÚNICA checagem de posse. Tudo depois dela soma por contador."""
    c = db.query(Contador).filter(
        Contador.id == contador_id,
        Contador.usuario_id == usuario.id,
    ).first()
    if not c:
        raise HTTPException(404, "Contador não encontrado")
    return c


def total_de(db: Session, contador_id: int) -> int:
    """Sem `usuario_id`. Ver o cabeçalho — é a porta da guilda."""
    return int((db.query(func.sum(ExecucaoDia.repeticoes))
                  .join(Rotina, Rotina.id == ExecucaoDia.rotina_id)
                  .filter(Rotina.contador_id == contador_id)
                  .scalar()) or 0)


def _resumo(db: Session, c: Contador) -> dict:
    return {
        "id": c.id, "nome": c.nome, "unidade": c.unidade,
        "total": total_de(db, c.id),
        "arquivado": c.arquivado_em is not None,
        "criado_em": c.criado_em.isoformat() if c.criado_em else None,
    }


@router.get("")
def listar(incluir_arquivados: bool = False,
           db: Session = Depends(get_db),
           usuario: Usuario = Depends(get_usuario_atual)):
    q = db.query(Contador).filter(Contador.usuario_id == usuario.id)
    if not incluir_arquivados:
        q = q.filter(Contador.arquivado_em.is_(None))
    return [_resumo(db, c) for c in q.order_by(Contador.nome).all()]


@router.post("")
def criar(payload: ContadorIn, db: Session = Depends(get_db),
          usuario: Usuario = Depends(get_usuario_atual)):
    nome = (payload.nome or "").strip()
    if not nome:
        raise HTTPException(400, "O contador precisa de um nome.")

    # UM NOME, UM BALDE. Dois "Questões" seriam dois totais para a mesma
    # coisa — e o hunter escolheria o errado metade das vezes sem nunca
    # descobrir por quê.
    ja = db.query(Contador).filter(
        Contador.usuario_id == usuario.id,
        func.lower(Contador.nome) == nome.lower(),
        Contador.arquivado_em.is_(None),
    ).first()
    if ja:
        return _resumo(db, ja)

    c = Contador(usuario_id=usuario.id, nome=nome[:80],
                 unidade=(payload.unidade or "").strip()[:30] or None)
    db.add(c)
    db.commit()
    db.refresh(c)
    return _resumo(db, c)


@router.get("/{contador_id}")
def detalhe(contador_id: int, db: Session = Depends(get_db),
            usuario: Usuario = Depends(get_usuario_atual)):
    """
    A tela do contador (§7 do plano).

    A última seção é a que fecha o desenho: o contador mostra DE ONDE
    cada número veio. É isso que faz "412" ser um fato e não um placar.
    """
    c = _meu(db, usuario, contador_id)
    hoje = tempo.hoje()

    linhas = (db.query(ExecucaoDia.data, func.sum(ExecucaoDia.repeticoes))
                .join(Rotina, Rotina.id == ExecucaoDia.rotina_id)
                .filter(Rotina.contador_id == c.id,
                        ExecucaoDia.repeticoes > 0)
                .group_by(ExecucaoDia.data).all())
    por_dia = {d: int(n or 0) for d, n in linhas}

    total   = sum(por_dia.values())
    dias    = len(por_dia)
    melhor  = max(por_dia.values()) if por_dia else 0
    # MÉDIA POR DIA ATIVO, não por dia de calendário. Um contador criado
    # há um ano e usado em vinte dias tem média 4,6 — não 0,25. O número
    # que interessa é "quanto eu faço quando faço".
    media   = round(total / dias, 1) if dias else 0.0

    serie = [{"data": (hoje - timedelta(days=i)).isoformat(),
              "n": por_dia.get(hoje - timedelta(days=i), 0)}
             for i in range(29, -1, -1)]

    fontes = []
    for r in db.query(Rotina).filter(Rotina.contador_id == c.id).all():
        n = int((db.query(func.sum(ExecucaoDia.repeticoes))
                   .filter(ExecucaoDia.rotina_id == r.id).scalar()) or 0)
        fontes.append({
            "rotina_id": r.id, "titulo": r.titulo, "n": n,
            "modo": "META" if (r.alvo_repeticoes or 0) > 0 else "BONUS",
            "arquivada": not r.ativo,
        })
    fontes.sort(key=lambda f: -f["n"])

    return {**_resumo(db, c),
            "hoje": por_dia.get(hoje, 0),
            "melhor_dia": melhor, "media_dia": media,
            "dias_ativos": dias, "serie": serie, "fontes": fontes}


@router.patch("/{contador_id}")
def renomear(contador_id: int, payload: ContadorIn,
             db: Session = Depends(get_db),
             usuario: Usuario = Depends(get_usuario_atual)):
    c = _meu(db, usuario, contador_id)
    nome = (payload.nome or "").strip()
    if nome:
        c.nome = nome[:80]
    if payload.unidade is not None:
        c.unidade = (payload.unidade or "").strip()[:30] or None
    db.commit()
    return _resumo(db, c)


@router.delete("/{contador_id}")
def arquivar(contador_id: int, db: Session = Depends(get_db),
             usuario: Usuario = Depends(get_usuario_atual)):
    """
    ARQUIVAR, NÃO APAGAR.

    O total é derivado das execuções, então apagar um contador com 412
    questões apagaria as 412. Um registro de anos não pode sumir por um
    clique numa lixeira.

    Arquivar tira do lançador e da lista, e o número continua lá. Se o
    apagar de verdade um dia existir, ele terá que dizer o número na
    confirmação: "isto apaga 412 questões".
    """
    c = _meu(db, usuario, contador_id)
    from datetime import datetime
    c.arquivado_em = datetime.utcnow()
    db.commit()
    return {"ok": True, "id": c.id, "total_preservado": total_de(db, c.id)}


@router.post("/{contador_id}/restaurar")
def restaurar(contador_id: int, db: Session = Depends(get_db),
              usuario: Usuario = Depends(get_usuario_atual)):
    c = _meu(db, usuario, contador_id)
    c.arquivado_em = None
    db.commit()
    return _resumo(db, c)
