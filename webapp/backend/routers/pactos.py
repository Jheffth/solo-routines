"""
Router do PACTO — o cardápio de penitências.

O hunter escreve o que deve ao Sistema quando falhar. **Ele não escolhe
qual cai** — essa parte é do Sistema, e é dela que vem o peso: saber que
há uma dívida e não saber qual pesa mais que qualquer número.

DUAS CAMADAS (ver motors/pactos.py)

    CAMADA 1  quatro TIPOS de card — a mecânica
    CAMADA 2  o CATÁLOGO de prontos — o conteúdo, adotado num toque

O catálogo é o que fecha a lacuna do pacto vazio: sem ele, um hunter
que nunca parou para inventar punições nunca conheceria o recurso.
Adotar é um toque; escrever do zero é trabalho.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db, Pacto, Usuario
from auth.router import get_usuario_atual
from motors import pactos as cat, penitencia

router = APIRouter(prefix="/pactos", tags=["pactos"])


class PactoIn(BaseModel):
    titulo: str
    tipo: Optional[str] = None
    base: Optional[int] = None
    teto: Optional[int] = None
    unidade: Optional[str] = None


class AdotarIn(BaseModel):
    chaves: list[str]


def _serial(p: Pacto) -> dict:
    return {
        "id": p.id,
        "titulo": p.titulo,
        "tipo": p.tipo,
        "unidade": p.unidade,
        "base": p.base,
        "teto": p.teto,
        "valor_atual": p.valor_atual,
        # O texto com o número já resolvido — o cliente não precisa
        # conhecer o `{n}`, que é sintaxe do lançador.
        "exemplo": (p.titulo or "").replace("{n}", str(p.valor_atual)),
        "vezes_caiu": p.vezes_caiu or 0,
        "ultima_queda": p.ultima_queda.isoformat() if p.ultima_queda else None,
        "ativo": bool(p.ativo),
        "origem_chave": p.origem_chave,
    }


def _meu(db: Session, usuario: Usuario, pacto_id: int) -> Pacto:
    p = db.query(Pacto).filter(Pacto.id == pacto_id,
                               Pacto.usuario_id == usuario.id).first()
    if not p:
        raise HTTPException(404, "Pacto não encontrado")
    return p


@router.get("/catalogo")
def ver_catalogo():
    """
    Os pactos prontos. Aberto: é conteúdo, não dado de ninguém.

    Cresce sem código — cem itens são cem linhas de dados, e é por isso
    que as duas camadas foram separadas.

    `tipos` era `list(cat.TIPOS)` — só os nomes. Virou uma lista de
    dicionários porque o lançador precisa desenhar a ESCADA de escalação
    ao vivo (1 → 2 → 4 → 8 … até o teto) enquanto o hunter escreve, e
    para isso ele precisa do fator.

    Copiar `ESCALA_DO_TIPO` para dentro do JavaScript teria sido mais
    rápido e teria criado a segunda verdade que já custou caro neste
    projeto: no dia em que a temporal deixasse de subir 1,5×, a prévia
    continuaria prometendo a escada antiga. O fator viaja; o cliente
    apenas desenha.

    ESCREVI AQUI que ninguém consumia o `tipos` antigo, "verificado antes
    de mudar". Estava errado: grepei o frontend e não os testes, e
    `test_punicao.py` fazia `set(c["tipos"])` — que estourou com
    `unhashable type: dict` no primeiro run. O teste foi atualizado.

    Fica registrado porque o erro não foi a mudança, foi a verificação:
    "ninguém usa" é uma afirmação sobre o repositório INTEIRO, e eu
    tinha olhado uma pasta.
    """
    # `fator_efetivo` MEDE o que escalar() faz, em vez de ler o que a
    # tabela declara — as duas divergem hoje na RESTRITIVA (ver o
    # docstring da função). A escada desenhada no lançador precisa do
    # comportamento real, senão ela promete o que o Sistema não cumpre.
    tipos = [{"id": t,
              "escala":   cat.fator_efetivo(t),
              "declarada": cat.ESCALA_DO_TIPO.get(t),
              "natureza": cat.NATUREZA_DO_TIPO.get(t)} for t in cat.TIPOS]
    return {"grupos": cat.grupos(), "itens": cat.catalogo(), "tipos": tipos}


@router.get("")
def listar(db: Session = Depends(get_db),
           usuario: Usuario = Depends(get_usuario_atual)):
    itens = (db.query(Pacto)
               .filter(Pacto.usuario_id == usuario.id, Pacto.ativo == True)
               .order_by(Pacto.id).all())
    return {
        "itens": [_serial(p) for p in itens],
        "pendentes": penitencia.contar(db, usuario.id),
    }


# SEM `/pactos/penitencias`.
#
# Este endpoint existiu por um commit. Ele devolvia as dividas em
# aberto e as quitadas para a pagina do Pacto listar — e a pagina nao
# devia listar nem uma coisa nem outra.
#
# O Arquiteto corrigiu a arquitetura: PACTO e a REGRA e vive na aba;
# PENITENCIA e a OCORRENCIA e vive no Dashboard, exatamente como
# ROTINA x ExecucaoDia. Com a pagina enxuta, o endpoint ficou sem
# consumidor.
#
# Removido em vez de mantido "por precisar depois": endpoint sem
# chamador e superficie de API que ninguem testa e que envelhece
# sozinha. O `/pactos` ja devolve `pendentes`, que e tudo o que a
# pagina tem o direito de saber.


@router.post("/adotar")
def adotar(payload: AdotarIn, db: Session = Depends(get_db),
           usuario: Usuario = Depends(get_usuario_atual)):
    """
    Adota itens do catálogo. É o caminho de UM TOQUE.

    Ignora o que já foi adotado em vez de recusar o lote: o hunter que
    marca três e já tinha uma delas não quer um erro — quer as outras
    duas.
    """
    ja = {p.origem_chave for p in
          db.query(Pacto).filter(Pacto.usuario_id == usuario.id,
                                 Pacto.ativo == True).all()}
    criados = []
    for chave in (payload.chaves or []):
        if chave in ja:
            continue
        item = cat.do_catalogo(chave)
        if not item:
            continue
        p = Pacto(usuario_id=usuario.id, titulo=item["titulo"],
                  tipo=item["tipo"], unidade=item["unidade"],
                  base=item["base"], teto=item["teto"],
                  valor_atual=item["base"], origem_chave=chave, ativo=True)
        db.add(p)
        criados.append(p)
    db.commit()
    for p in criados:
        db.refresh(p)
    return {"adotados": [_serial(p) for p in criados]}


@router.post("")
def criar(payload: PactoIn, db: Session = Depends(get_db),
          usuario: Usuario = Depends(get_usuario_atual)):
    """Uma penitência escrita à mão."""
    titulo = (payload.titulo or "").strip()
    if not titulo:
        raise HTTPException(400, "A penitência precisa de um texto.")

    tipo = (payload.tipo or cat.QUANTITATIVA).upper()
    if tipo not in cat.TIPOS:
        tipo = cat.QUANTITATIVA

    base = max(1, int(payload.base or 1))
    # O TETO NUNCA FICA ABAIXO DA BASE. Sem esta linha, base 20 com teto
    # 5 daria uma penitência que nasce acima do próprio limite e decai
    # para um valor que ela nunca deveria ter tido.
    teto = max(base, int(payload.teto or base * 8))

    p = Pacto(usuario_id=usuario.id, titulo=titulo[:160], tipo=tipo,
              unidade=(payload.unidade or "").strip()[:30] or None,
              base=base, teto=teto, valor_atual=base, ativo=True)
    db.add(p)
    db.commit()
    db.refresh(p)
    return _serial(p)


@router.patch("/{pacto_id}")
def editar(pacto_id: int, payload: PactoIn, db: Session = Depends(get_db),
           usuario: Usuario = Depends(get_usuario_atual)):
    p = _meu(db, usuario, pacto_id)
    if payload.titulo and payload.titulo.strip():
        p.titulo = payload.titulo.strip()[:160]
    if payload.tipo and payload.tipo.upper() in cat.TIPOS:
        p.tipo = payload.tipo.upper()
    if payload.base is not None:
        p.base = max(1, int(payload.base))
    if payload.teto is not None:
        p.teto = max(p.base, int(payload.teto))
    if payload.unidade is not None:
        p.unidade = (payload.unidade or "").strip()[:30] or None
    p.valor_atual = min(max(p.valor_atual, p.base), p.teto)
    db.commit()
    return _serial(p)


@router.delete("/{pacto_id}")
def remover(pacto_id: int, db: Session = Depends(get_db),
            usuario: Usuario = Depends(get_usuario_atual)):
    """
    Tira do cardápio. **Não apaga as penitências que já foram cobradas.**

    A penitência criada guarda uma CÓPIA do texto, não uma referência —
    senão bastaria esvaziar o pacto para zerar o passado, e a dívida
    deixaria de ser dívida.
    """
    p = _meu(db, usuario, pacto_id)
    p.ativo = False
    db.commit()
    return {"ok": True, "id": p.id,
            "pendentes_preservadas": penitencia.contar(db, usuario.id)}
