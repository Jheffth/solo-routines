"""
Router de Recompensas — catálogo da loja e resgate de itens.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from database import get_db, Recompensa, RecompensaUsuario, Usuario
from auth.router import get_usuario_atual
from motors import loja_efeitos, cosmeticos
from motors.celebracao import anexar
from motors import fragmentos

router = APIRouter(prefix="/recompensas", tags=["recompensas"])


# ── Quem pode FORJAR itens para a prateleira ──────────────────────────
#
# ESTA TUPLA É O ÚNICO LUGAR A MUDAR. Para abrir a forja a Admin e Suporte
# (cargos que a hierarquia já prevê), escreva:
#
#     FORJADORES = ("Arquiteto", "Admin", "Suporte")
#
# Nada mais precisa ser tocado: os endpoints de escrita, e também a tela,
# perguntam daqui. A tela nunca aprende a lista de cargos — ela pergunta ao
# servidor se pode forjar, então nunca mostra um botão que seria recusado.
#
# Antes isto usava `get_admin`, que já inclui Suporte, Moderador, Admin e
# Criador — largo demais para quem decide o que a loja vende e por quanto.
FORJADORES = ("Arquiteto",)


def pode_forjar(usuario: Usuario) -> bool:
    return (usuario.nivel_acesso or "") in FORJADORES


def get_forjador(usuario: Usuario = Depends(get_usuario_atual)) -> Usuario:
    if not pode_forjar(usuario):
        raise HTTPException(403, "Apenas o Arquiteto pode forjar itens da loja")
    return usuario


class RecompensaCreate(BaseModel):
    titulo: str
    descricao: Optional[str] = None
    icone: str = "🎁"
    categoria: str = "Lazer"
    custo_moedas: int = 100
    custo_fragmentos: int = 0
    custo_xp: int = 0
    nivel_minimo: int = 1
    estoque: int = -1
    tipo: str = "externa"                 # externa | aura | emblema
    payload: Optional[str] = None         # id do cosmético, quando houver


class RecompensaUpdate(BaseModel):
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    icone: Optional[str] = None
    categoria: Optional[str] = None
    custo_moedas: Optional[int] = None
    custo_fragmentos: Optional[int] = None
    nivel_minimo: Optional[int] = None
    estoque: Optional[int] = None
    ativo: Optional[bool] = None
    tipo: Optional[str] = None
    payload: Optional[str] = None


def _recompensa_to_dict(r: Recompensa, usuario: Usuario = None, db: Session = None) -> dict:
    """
    A vitrine precisa saber, ANTES do clique, tudo que pode impedir a compra.
    Antes ela só recebia o preço, então o card convidava a resgatar e o
    backend recusava depois — o hunter descobria o bloqueio errando.
    """
    tipo = (getattr(r, "tipo", None) or "externa").lower()
    payload = getattr(r, "payload", None)

    resgatada = possui = False
    pode_pagar = tem_nivel = True
    if usuario is not None and db is not None:
        resgatada = db.query(RecompensaUsuario).filter(
            RecompensaUsuario.usuario_id == usuario.id,
            RecompensaUsuario.recompensa_id == r.id,
        ).first() is not None
        possui     = loja_efeitos.ja_possui(db, usuario.id, r)
        
        saldo_moedas = usuario.moedas or 0
        saldo_frag = fragmentos.saldo(db, usuario.id) if (r.custo_fragmentos and r.custo_fragmentos > 0) else 0
        pode_pagar = True
        if r.custo_moedas and r.custo_moedas > 0 and saldo_moedas < r.custo_moedas:
            pode_pagar = False
        if r.custo_fragmentos and r.custo_fragmentos > 0 and saldo_frag < r.custo_fragmentos:
            pode_pagar = False
            
        tem_nivel  = (usuario.nivel_atual or 1) >= (r.nivel_minimo or 0)

    # -1 significa ILIMITADO (é o padrão do modelo). A vitrine antiga tratava
    # qualquer valor <= 0 como esgotado, então todo item permanente nascia
    # impossível de comprar. Quem decide isto agora é o backend, uma vez só.
    ilimitado = r.estoque is None or r.estoque < 0
    esgotado  = (not ilimitado) and r.estoque <= 0

    d = {
        "id":           r.id,
        "titulo":       r.titulo,
        "descricao":    r.descricao,
        "icone":        r.icone,
        "categoria":    r.categoria,
        "custo_moedas": r.custo_moedas,
        "custo_fragmentos": r.custo_fragmentos,
        "custo_xp":     r.custo_xp,
        "nivel_minimo": r.nivel_minimo,
        "estoque":      r.estoque,
        "ilimitado":    ilimitado,
        "esgotado":     esgotado,
        "ativo":        r.ativo,
        "resgatada":    resgatada,

        # Identidade do item
        "tipo":         tipo,
        "payload":      payload,
        "unico":        loja_efeitos.eh_unico(tipo),
        "possui":       possui,

        # Veredito pronto: a vitrine não precisa reimplementar a regra.
        "pode_pagar":   pode_pagar,
        "tem_nivel":    tem_nivel,
        "disponivel":   bool(pode_pagar and tem_nivel and not esgotado and not possui),
    }

    # Dados do cosmético para o card desenhá-lo de verdade, em vez de emoji.
    if tipo == "aura" and payload:
        cat = cosmeticos.aura(payload)
        d["cosmetico"] = {"tipo": "aura", "id": payload,
                          "nome": cat["nome"], "cor": cat["cor"]}
    elif tipo == "emblema" and payload:
        d["cosmetico"] = {"tipo": "emblema", "id": payload,
                          "nome": r.titulo, "cor": None}
    return d


@router.get("/")
def listar_recompensas(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    recompensas = db.query(Recompensa).filter(Recompensa.ativo == True).all()
    return [_recompensa_to_dict(r, usuario, db) for r in recompensas]


@router.get("/forja/permissao")
def permissao_forja(usuario: Usuario = Depends(get_usuario_atual)):
    """
    A vitrine pergunta ao servidor se deve desenhar a Forja, em vez de
    decidir pelo cargo que tem em mãos. Assim, quando a forja for aberta a
    Admin e Suporte, basta mudar `get_forjador` — nenhuma tela precisa saber
    a lista de cargos, e nenhuma delas fica mostrando um botão que o servidor
    vai recusar.
    """
    return {"pode_forjar": pode_forjar(usuario)}


@router.get("/catalogo-cosmeticos")
def catalogo_cosmeticos(
    db: Session = Depends(get_db),
    forjador: Usuario = Depends(get_forjador),
):
    """O que existe para ser posto à venda — alimenta o cadastro de itens."""
    from database import Conquista
    emblemas = db.query(Conquista).filter(Conquista.ativo == True).all() \
        if hasattr(Conquista, "ativo") else db.query(Conquista).all()
    return {
        "tipos": loja_efeitos.tipos_disponiveis(),
        "auras": list(cosmeticos.AURAS.values()),
        "emblemas": [{"codigo": q.codigo, "titulo": q.titulo, "icone": q.icone}
                     for q in emblemas],
    }


@router.post("/{recompensa_id}/resgatar")
def resgatar_recompensa(
    recompensa_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    r = db.query(Recompensa).filter(
        Recompensa.id == recompensa_id, Recompensa.ativo == True
    ).first()
    if not r:
        raise HTTPException(404, "Recompensa não encontrada")

    if usuario.nivel_atual < r.nivel_minimo:
        raise HTTPException(400, f"Você precisa ser nível {r.nivel_minimo} para resgatar isto")

    if usuario.xp_total < r.custo_xp:
        raise HTTPException(400, f"XP insuficiente. Necessário: {r.custo_xp} XP")

    if r.custo_moedas and r.custo_moedas > 0:
        if usuario.moedas < r.custo_moedas:
            raise HTTPException(400, f"Mana Coins insuficientes. Necessário: {r.custo_moedas} 💰")

    if r.custo_fragmentos and r.custo_fragmentos > 0:
        saldo_frag = fragmentos.saldo(db, usuario.id)
        if saldo_frag < r.custo_fragmentos:
            raise HTTPException(400, f"Fragmentos insuficientes. Necessário: {r.custo_fragmentos} 💎")

    # -1 = ilimitado; só 0 é esgotado de verdade.
    if r.estoque is not None and r.estoque == 0:
        raise HTTPException(400, "Esta recompensa está esgotada")

    # ENTREGA PRIMEIRO, COBRA DEPOIS.
    # A ordem é o ponto: se a entrega falhar (aura já possuída, cosmético
    # removido do catálogo), o hunter não pode sair mais pobre por nada.
    # O efeito levanta ValueError e nada foi debitado ainda.
    try:
        eventos = loja_efeitos.entregar(db, usuario, r)
    except ValueError as e:
        db.rollback()
        raise HTTPException(400, str(e))

    if r.custo_moedas and r.custo_moedas > 0:
        usuario.moedas -= r.custo_moedas

    if r.custo_fragmentos and r.custo_fragmentos > 0:
        fragmentos.debitar(db, usuario, r.custo_fragmentos, motivo="gasto_loja", referencia_id=r.id)
    if r.estoque is not None and r.estoque > 0:
        r.estoque -= 1

    db.add(RecompensaUsuario(usuario_id=usuario.id, recompensa_id=r.id))
    db.commit()

    resp = {
        "ok": True,
        "msg": f"🎉 '{r.titulo}' resgatado!",
        "moedas_restantes": usuario.moedas,
        "fragmentos_restantes": fragmentos.saldo(db, usuario.id),
        "tipo": (getattr(r, "tipo", None) or "externa"),
    }
    # Cosmético comprado merece a mesma cerimônia de um presenteado: comprar
    # não pode ser mais sem graça do que ganhar. O envelope `sr_eventos` é o
    # canal único de celebração do app.
    if eventos:
        resp = anexar(resp, None, **eventos)
    return resp


# ── Admin ──────────────────────────────────────────────────────
@router.post("/", status_code=201)
def criar_recompensa(
    payload: RecompensaCreate,
    db: Session = Depends(get_db),
    forjador: Usuario = Depends(get_forjador),
):
    r = Recompensa(**payload.dict())
    db.add(r)
    db.commit()
    db.refresh(r)
    return _recompensa_to_dict(r)


@router.put("/{recompensa_id}")
def atualizar_recompensa(
    recompensa_id: int,
    payload: RecompensaUpdate,
    db: Session = Depends(get_db),
    forjador: Usuario = Depends(get_forjador),
):
    r = db.query(Recompensa).filter(Recompensa.id == recompensa_id).first()
    if not r:
        raise HTTPException(404, "Recompensa não encontrada")

    for field, value in payload.dict(exclude_none=True).items():
        setattr(r, field, value)
    db.commit()
    db.refresh(r)
    return _recompensa_to_dict(r)


@router.delete("/{recompensa_id}")
def deletar_recompensa(
    recompensa_id: int,
    db: Session = Depends(get_db),
    forjador: Usuario = Depends(get_forjador),
):
    r = db.query(Recompensa).filter(Recompensa.id == recompensa_id).first()
    if not r:
        raise HTTPException(404, "Recompensa não encontrada")
    r.ativo = False
    db.commit()
    return {"ok": True}
