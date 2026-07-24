"""
Router de Perfil — dados detalhados para gráficos e histórico.
"""
import os
import uuid
import io
import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import date, timedelta
from collections import defaultdict
from pydantic import BaseModel, field_validator
from typing import Optional, List

from database import (
    get_db, Usuario, Execucao, Rotina, TarefaDia,
    Conquista, ConquistaUsuario, Recompensa, RecompensaUsuario, AuraUsuario
)
from auth.router import get_usuario_atual

router = APIRouter(prefix="/perfil", tags=["perfil"])

# ── Cloudinary — armazenamento permanente de avatares (opcional) ─────────────
# A CLOUDINARY_URL no formato cloudinary://key:secret@cloud_name
# é lida automaticamente pelo SDK quando está no ambiente.
# Import blindado: sem o pacote instalado, cai no armazenamento local
# em vez de derrubar o servidor inteiro.
_CLOUDINARY_OK = False
try:
    import cloudinary
    import cloudinary.uploader
    _CLOUDINARY_URL = os.getenv("CLOUDINARY_URL", "")
    if _CLOUDINARY_URL:
        cloudinary.config(cloudinary_url=_CLOUDINARY_URL)
        _CLOUDINARY_OK = True
except ImportError:
    print("[PERFIL] cloudinary não instalado — avatares em disco local (ok para dev)")

# Fallback local (usado apenas no desenvolvimento sem Cloudinary configurado)
AVATAR_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads", "avatars")
_EXT_PERMITIDAS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
_TAMANHO_MAX = 5 * 1024 * 1024  # 5 MB


@router.post("/avatar")
async def upload_avatar(
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Recebe a foto de perfil e envia para o Cloudinary (produção) ou disco local (dev)."""
    ext = os.path.splitext(arquivo.filename or "")[1].lower() or ".png"
    if ext not in _EXT_PERMITIDAS:
        raise HTTPException(400, "Formato inválido — use PNG, JPG, GIF ou WEBP")

    conteudo = await arquivo.read()
    if len(conteudo) > _TAMANHO_MAX:
        raise HTTPException(400, "Imagem muito grande — máximo 5 MB")
    if not conteudo:
        raise HTTPException(400, "Arquivo vazio")

    # ── Cloudinary (produção) ────────────────────────────────────────────────
    if _CLOUDINARY_OK:
        # Remove avatar antigo do Cloudinary
        if usuario.avatar_url and usuario.avatar_url.startswith("https://res.cloudinary.com"):
            try:
                public_id = f"solo-routines/avatars/u{usuario.id}"
                cloudinary.uploader.destroy(public_id)
            except Exception:
                pass

        public_id = f"solo-routines/avatars/u{usuario.id}"
        result = cloudinary.uploader.upload(
            io.BytesIO(conteudo),
            public_id=public_id,
            overwrite=True,
            resource_type="image",
            transformation=[{"width": 400, "height": 400, "crop": "fill", "gravity": "face"}],
        )
        url = result.get("secure_url", "")
        if not url:
            raise HTTPException(500, "Falha no upload para o Cloudinary")

        usuario.avatar_url = url
        db.commit()
        return {"ok": True, "avatar_url": usuario.avatar_url}

    # ── Fallback local (desenvolvimento sem Cloudinary) ──────────────────────
    if usuario.avatar_url and usuario.avatar_url.startswith("/api/perfil/avatar/"):
        antigo = os.path.join(AVATAR_DIR, os.path.basename(usuario.avatar_url))
        try:
            if os.path.isfile(antigo):
                os.remove(antigo)
        except Exception:
            pass

    os.makedirs(AVATAR_DIR, exist_ok=True)
    nome = f"u{usuario.id}_{uuid.uuid4().hex[:10]}{ext}"
    with open(os.path.join(AVATAR_DIR, nome), "wb") as f:
        f.write(conteudo)

    usuario.avatar_url = f"/api/perfil/avatar/{nome}"
    db.commit()
    return {"ok": True, "avatar_url": usuario.avatar_url}


@router.delete("/avatar")
def remover_avatar(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Remove a foto de perfil (Cloudinary ou disco local)."""
    if usuario.avatar_url:
        if _CLOUDINARY_OK and usuario.avatar_url.startswith("https://res.cloudinary.com"):
            try:
                public_id = f"solo-routines/avatars/u{usuario.id}"
                cloudinary.uploader.destroy(public_id)
            except Exception:
                pass
        elif usuario.avatar_url.startswith("/api/perfil/avatar/"):
            antigo = os.path.join(AVATAR_DIR, os.path.basename(usuario.avatar_url))
            try:
                if os.path.isfile(antigo):
                    os.remove(antigo)
            except Exception:
                pass
    usuario.avatar_url = None
    db.commit()
    return {"ok": True}


@router.get("/avatar/{nome}")
def servir_avatar(nome: str):
    """Serve avatar do disco local (fallback para uploads antigos ou ambiente dev)."""
    nome = os.path.basename(nome)  # anti path-traversal
    caminho = os.path.join(AVATAR_DIR, nome)
    if not os.path.isfile(caminho):
        raise HTTPException(404, "Avatar não encontrado")
    return FileResponse(caminho)


# ── Schema de auto-edição: qualquer usuário ──────────────
class PerfilEdit(BaseModel):
    nome:       Optional[str] = None
    titulo:     Optional[str] = None
    avatar_url: Optional[str] = None
    classe:     Optional[str] = None


# ── Schema de auto-edição: exclusivo Arquiteto ──────────
class ArquitetoEdit(BaseModel):
    nome:        Optional[str] = None
    titulo:      Optional[str] = None
    avatar_url:  Optional[str] = None
    classe:      Optional[str] = None
    nivel_atual: Optional[int] = None
    moedas:      Optional[int] = None
    xp_total:    Optional[int] = None


@router.put("/")
def editar_perfil(
    payload: PerfilEdit,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Qualquer usuário pode atualizar nome, título e avatar."""
    if payload.nome       is not None: usuario.nome       = payload.nome
    if payload.titulo     is not None: usuario.titulo     = payload.titulo
    if payload.avatar_url is not None: usuario.avatar_url = payload.avatar_url
    if payload.classe     is not None: usuario.classe     = payload.classe
    db.commit()
    db.refresh(usuario)
    return {"ok": True, "nome": usuario.nome, "titulo": usuario.titulo, "avatar_url": usuario.avatar_url}


@router.put("/arquiteto")
def editar_arquiteto(
    payload: ArquitetoEdit,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Permite que o Arquiteto edite livremente todos os seus atributos."""
    if usuario.nivel_acesso != "Arquiteto":
        raise HTTPException(403, "Apenas o Arquiteto pode usar este endpoint")

    if payload.nome        is not None: usuario.nome        = payload.nome
    if payload.titulo      is not None: usuario.titulo      = payload.titulo
    if payload.avatar_url  is not None: usuario.avatar_url  = payload.avatar_url
    if payload.classe      is not None: usuario.classe      = payload.classe
    if payload.nivel_atual is not None: usuario.nivel_atual  = payload.nivel_atual
    if payload.moedas      is not None: usuario.moedas       = payload.moedas
    if payload.xp_total    is not None:
        usuario.xp_total  = payload.xp_total
        usuario.xp_atual  = payload.xp_total

    db.commit()
    db.refresh(usuario)
    return {
        "ok":          True,
        "nome":        usuario.nome,
        "titulo":      usuario.titulo,
        "avatar_url":  usuario.avatar_url,
        "nivel_atual": usuario.nivel_atual,
        "moedas":      usuario.moedas,
        "xp_total":    usuario.xp_total,
    }


@router.get("/")
def perfil_completo(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    hoje = date.today()
    um_ano_atras = hoje - timedelta(days=365)

    # ── Radar de habilidades por categoria ───────────────
    categorias = ["Saúde", "Trabalho", "Estudo", "Casa", "Pessoal", "Combate"]
    radar = {}
    for cat in categorias:
        execs_cat = db.query(Execucao).join(
            Rotina, Rotina.id == Execucao.rotina_id, isouter=True
        ).join(
            TarefaDia, TarefaDia.id == Execucao.tarefa_id, isouter=True
        ).filter(
            Execucao.usuario_id == usuario.id,
        ).all()
        total_cat = 0
        for e in execs_cat:
            if e.rotina and e.rotina.categoria == cat:
                total_cat += 1
            elif e.tarefa and e.tarefa.categoria == cat:
                total_cat += 1
        radar[cat] = total_cat

    # ── XP por mês (últimos 12) ───────────────────────────
    xp_mensal = []
    for m in range(11, -1, -1):
        ref = hoje.replace(day=1) - timedelta(days=m * 30)
        inicio = ref.replace(day=1)
        if ref.month == 12:
            fim = ref.replace(year=ref.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            fim = ref.replace(month=ref.month + 1, day=1) - timedelta(days=1)
        xp_m = sum(
            e.xp_ganho for e in
            db.query(Execucao).filter(
                Execucao.usuario_id == usuario.id,
                Execucao.data_execucao >= inicio,
                Execucao.data_execucao <= fim,
            ).all()
        )
        xp_mensal.append({
            "mes": inicio.strftime("%b/%Y"),
            "xp":  xp_m,
        })

    # ── Heatmap anual ─────────────────────────────────────
    execs_ano = db.query(Execucao.data_execucao).filter(
        Execucao.usuario_id == usuario.id,
        Execucao.data_execucao >= um_ano_atras,
    ).all()
    heatmap: dict[str, int] = defaultdict(int)
    for (d,) in execs_ano:
        heatmap[d.isoformat()] += 1

    # ── Todas as conquistas ─────────────────────────────────
    todas_cq = db.query(Conquista).filter(Conquista.ativo == True).all()
    desbloqueadas_map = {
        cu.conquista_id: cu.desbloqueada_em
        for cu in
        db.query(ConquistaUsuario).filter(ConquistaUsuario.usuario_id == usuario.id).all()
    }
    conquistas_lista = [
        {
            "id":             c.id,
            "titulo":         c.titulo,
            "descricao":      c.descricao,
            "icone":          c.icone,
            "cor":            c.cor,
            "xp_bonus":       c.xp_bonus,
            "desbloqueada":   c.id in desbloqueadas_map,
            "desbloqueada_em": desbloqueadas_map[c.id].isoformat() if c.id in desbloqueadas_map and desbloqueadas_map[c.id] else None,
        }
        for c in todas_cq
    ]

    # ── Histórico de recompensas ──────────────────────────
    resgates = db.query(RecompensaUsuario).filter(
        RecompensaUsuario.usuario_id == usuario.id
    ).order_by(RecompensaUsuario.resgatada_em.desc()).limit(20).all()
    resgates_lista = []
    for rs in resgates:
        r = db.query(Recompensa).filter(Recompensa.id == rs.recompensa_id).first()
        if r:
            resgates_lista.append({
                "titulo":       r.titulo,
                "icone":        r.icone,
                "resgatada_em": rs.resgatada_em.isoformat(),
            })

    return {
        "usuario": {
            "id":               usuario.id,
            "nome":             usuario.nome,
            "login":            usuario.login,
            "avatar_url":       usuario.avatar_url,
            "classe":           usuario.classe,
            "titulo":           usuario.titulo,
            "nivel_atual":      usuario.nivel_atual,
            "xp_total":         usuario.xp_total,
            "xp_atual":         usuario.xp_atual,
            "xp_proximo_nivel": usuario.xp_proximo_nivel,
            "moedas":           usuario.moedas,
            "streak_max":       usuario.streak_max,
            "streak_atual":     usuario.streak_atual,
            "nivel_acesso":     usuario.nivel_acesso,
            "criado_em":        usuario.criado_em.isoformat(),
        },
        "radar_habilidades": radar,
        "xp_mensal":         xp_mensal,
        "heatmap":           dict(heatmap),
        "conquistas":        conquistas_lista,
        "resgates_recentes": resgates_lista,
    }


# ══════════════════════════════════════════════════════════════════════════════
# ALTAR DE RELÍQUIAS — o hunter escolhe quais 5 aparecem
# ══════════════════════════════════════════════════════════════════════════════
# Antes, a Janela de Status mostrava as mais recentes e quebrava a linha quando
# passavam de cinco. Além de feio, tirava do hunter a decisão sobre o que exibir
# — e numa vitrine o que se mostra importa tanto quanto o que se tem.
LIMITE_ALTAR = 5


class AltarPayload(BaseModel):
    codigos: List[str]

    @field_validator("codigos")
    @classmethod
    def _limite(cls, v):
        v = [c for c in (v or []) if c]
        if len(v) > LIMITE_ALTAR:
            raise ValueError(f"O altar comporta no máximo {LIMITE_ALTAR} relíquias")
        if len(set(v)) != len(v):
            raise ValueError("Relíquia repetida no altar")
        return v


def ler_altar(usuario: Usuario) -> List[str]:
    """Lê a lista salva. Nunca explode por JSON corrompido."""
    try:
        dados = json.loads(usuario.reliquias_fixadas or "[]")
        return [c for c in dados if isinstance(c, str)][:LIMITE_ALTAR]
    except Exception:
        return []


@router.get("/reliquias")
def reliquias(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Tudo que o hunter possui + o que ele escolheu fixar."""
    posses = (db.query(ConquistaUsuario, Conquista)
                .join(Conquista, Conquista.id == ConquistaUsuario.conquista_id)
                .filter(ConquistaUsuario.usuario_id == usuario.id)
                .order_by(ConquistaUsuario.desbloqueada_em.desc()).all())

    acervo = [{
        "codigo": q.codigo, "titulo": q.titulo, "descricao": q.descricao,
        "icone": q.icone, "cor": q.cor,
        "xp_bonus": q.xp_bonus or 0, "moedas_bonus": q.moedas_bonus or 0,
        "de_missao": (q.condicao_tipo or "").lower() != "manual",
        "desbloqueada_em": cu.desbloqueada_em.isoformat() if cu.desbloqueada_em else None,
    } for cu, q in posses]

    fixadas = [c for c in ler_altar(usuario) if any(a["codigo"] == c for a in acervo)]
    return {"acervo": acervo, "fixadas": fixadas, "limite": LIMITE_ALTAR}


@router.put("/reliquias")
def definir_reliquias(
    payload: AltarPayload,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Só entra no altar o que o hunter realmente possui."""
    if payload.codigos:
        possui = {q.codigo for q in (
            db.query(Conquista)
              .join(ConquistaUsuario, ConquistaUsuario.conquista_id == Conquista.id)
              .filter(ConquistaUsuario.usuario_id == usuario.id).all())}
        faltando = [c for c in payload.codigos if c not in possui]
        if faltando:
            raise HTTPException(400, f"Você não possui: {', '.join(faltando)}")

    usuario.reliquias_fixadas = json.dumps(payload.codigos)
    db.commit()
    return {"ok": True, "fixadas": payload.codigos}


# ══════════════════════════════════════════════════════════════════════════════
# AURAS COSMÉTICAS — inventário virtual e troca
# ══════════════════════════════════════════════════════════════════════════════

# IDs de aura que são de cargo (automaticamente atribuídas pelo sistema)
# Não podem ser trocadas pelo próprio usuário nem enviadas como presente.
AURAS_DE_CARGO = {"arquiteto", "admin", "moderador", "suporte"}

# IDs de aura cosméticas disponíveis para presentear/forjar/trocar
AURAS_COSMETICAS = {
    "bella-rosa": {
        "id": "bella-rosa",
        "nome": "Bella Rosa — Femme Fatale",
        "descricao": "Aura exclusiva de 16 pétalas em espiral, halos rosa e branco, shimmer suave.",
        "cor": "#f48fb1",
        "enviavel": True,
    },
}


class AuraTrocaPayload(BaseModel):
    aura_id: Optional[str]   # None = remover aura cosmética (volta ao padrão de cargo)


@router.get("/auras-inventario")
def inventario_auras(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Auras que o usuário possui (forjadas ou recebidas) + aura ativa.
    Lê a tabela AuraUsuario real. A aura de cargo sempre aparece.
    """
    aura_ativa = getattr(usuario, "aura_id", None)

    # --- Auras cosméticas: lê do inventário real (AuraUsuario) ---
    inventario = []
    minhas = (db.query(AuraUsuario)
                .filter(AuraUsuario.usuario_id == usuario.id)
                .order_by(AuraUsuario.obtida_em.desc()).all())
    for au in minhas:
        cat = AURAS_COSMETICAS.get(au.aura_id)
        if not cat:
            continue
        de_nome = None
        if au.presenteada_por:
            rem = db.query(Usuario).filter(Usuario.id == au.presenteada_por).first()
            de_nome = rem.nome if rem else None
        inventario.append({
            **cat,
            "ativa":       aura_ativa == au.aura_id,
            "de":          de_nome,
            "obtida_em":   au.obtida_em.isoformat() if au.obtida_em else None,
        })

    # --- Aura de cargo (sempre disponível, não enviável) ---
    from routers.hunters import _aura_cargo
    cargo_id = _aura_cargo(usuario.nivel_acesso)
    if cargo_id:
        inventario.append({
            "id":        cargo_id,
            "nome":      f"Aura de Cargo ({usuario.nivel_acesso})",
            "descricao": "Concedida automaticamente pelo seu cargo. Não pode ser enviada.",
            "cor":       "#fbbf24" if cargo_id == "arquiteto" else "#38bdf8",
            "enviavel":  False,
            "ativa":     aura_ativa is None,
            "de_cargo":  True,
        })

    return {
        "aura_ativa":       aura_ativa,
        "inventario":       inventario,
        "auras_disponiveis": list(AURAS_COSMETICAS.values()),
    }


@router.put("/aura")
def trocar_aura(
    payload: AuraTrocaPayload,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Troca a aura cosmética ativa do usuário."""
    nova = payload.aura_id

    if nova is not None:
        # Valida que não é uma aura de cargo tentando ser atribuída manualmente
        if nova in AURAS_DE_CARGO:
            raise HTTPException(400,
                "Auras de cargo são atribuídas automaticamente — não podem ser selecionadas.")

        # Valida que é uma aura reconhecida
        if nova not in AURAS_COSMETICAS:
            raise HTTPException(400, f"Aura '{nova}' não reconhecida.")

        # Valida que o usuário possui essa aura na tabela AuraUsuario
        posse = db.query(AuraUsuario).filter(
            AuraUsuario.usuario_id == usuario.id,
            AuraUsuario.aura_id    == nova,
        ).first()
        if not posse:
            raise HTTPException(403,
                "Você não possui essa aura no inventário. Forje-a ou peça ao Arquiteto.")

    # None = remover cosmética → volta à aura de cargo
    usuario.aura_id = nova
    db.commit()
    return {
        "ok": True,
        "aura_id": usuario.aura_id,
        "detalhe": f"Aura trocada para '{nova}'" if nova else "Aura cosmética removida",
    }
