# -*- coding: utf-8 -*-
"""
O CIRCUITO — uma sessao com blocos.

Nasceu de um treino real do Arquiteto:

    06:00-06:45 · Mobilidade 5min · Cardio 25-30min ·
    Prancha 3x20-30s · Agachamento 3x10-12

POR QUE ISTO NAO SAO QUATRO ROTINAS

Quatro rotinas dariam quatro cartoes, quatro prazos, quatro chances de
fracasso — e, com o medidor de punicao, QUATRO BARRAS enchendo. Uma
manha perdida puniria em quadruplo. Mas o hunter nao falhou quatro
compromissos: ele perdeu um treino.

O circuito e uma missao so, com partes. Falhar enche UMA barra.

POR QUE ISTO NAO E UMA META DE TEMPO

Uma META de TEMPO com alvo 40 min funcionaria hoje, sem codigo — mas
nao sabe QUAIS blocos. Quarenta minutos so de caminhada fechariam a
missao como cumprida, e o treino existe justamente porque as partes sao
diferentes entre si.

A FAIXA E CIDADA DE PRIMEIRA CLASSE

`25 a 30 min`, `20 a 30 s`, `10 a 12 repeticoes`. A META tem um alvo
unico; aqui cada bloco tem PISO e TETO, porque a orientacao usa faixas
de proposito — quem esta adaptando o corpo nao performa, ajusta.

O PISO NAO REPROVA, MARCA (decisao do Arquiteto)

Fez 22 min numa faixa de 25-30? O bloco FECHA e a sessao fica PARCIAL:
sem fracasso, com XP reduzido. A alternativa — nao fechar abaixo do
piso — ensinaria a arredondar para cima na hora de lancar, e um sistema
que premia a mentira perde o unico dado que tinha.
"""
import json

# ── Os modos de bloco ────────────────────────────────────────────────
TEMPO       = "TEMPO"        # 25 a 30 min, um lancamento
SERIE_TEMPO = "SERIE_TEMPO"  # 3 series de 20 a 30 s
SERIE_REP   = "SERIE_REP"    # 3 series de 10 a 12 repeticoes
CHECK       = "CHECK"        # fez ou nao fez, sem numero

MODOS = {
    TEMPO:       {"rotulo": "Tempo",       "unidade": "min", "tem_serie": False},
    SERIE_TEMPO: {"rotulo": "Séries",      "unidade": "s",   "tem_serie": True},
    SERIE_REP:   {"rotulo": "Séries",      "unidade": "",    "tem_serie": True},
    CHECK:       {"rotulo": "Marcação",    "unidade": "",    "tem_serie": False},
}

MAX_ETAPAS = 12          # um circuito nao e uma lista de compras
MAX_SERIES = 20


# ── O desenho do circuito ────────────────────────────────────────────

def normalizar(payload) -> dict | None:
    """
    Le e valida o payload do circuito. Devolve None se nao for um.

    NUNCA EXPLODE. Um payload malformado faz a missao virar uma missao
    comum, e nao uma tela de erro — a mesma decisao de
    `_origem_condicional`. Missao sem os blocos ainda e uma missao.
    """
    if not payload:
        return None
    try:
        d = json.loads(payload) if isinstance(payload, str) else dict(payload)
    except Exception:
        return None
    etapas_cru = d.get("etapas")
    if not isinstance(etapas_cru, list) or not etapas_cru:
        return None

    etapas = []
    for i, e in enumerate(etapas_cru[:MAX_ETAPAS]):
        if not isinstance(e, dict):
            continue
        titulo = str(e.get("titulo") or "").strip()
        if not titulo:
            continue
        modo = str(e.get("modo") or CHECK).upper()
        if modo not in MODOS:
            modo = CHECK
        piso = _num(e.get("min"))
        teto = _num(e.get("max"))
        # Faixa invertida e erro de digitacao, nao intencao: 30 a 25
        # significa 25 a 30. Recusar seria correto e inutil.
        if piso is not None and teto is not None and piso > teto:
            piso, teto = teto, piso
        series = e.get("series")
        series = int(series) if isinstance(series, (int, float)) and series else None
        if MODOS[modo]["tem_serie"]:
            series = max(1, min(MAX_SERIES, series or 1))
        else:
            series = None
        etapas.append({
            "id":      str(e.get("id") or f"e{i}"),
            "titulo":  titulo[:120],
            "modo":    modo,
            "min":     piso,
            "max":     teto,
            "series":  series,
            "nota":    (str(e.get("nota"))[:200] if e.get("nota") else None),
            "unidade": e.get("unidade") or MODOS[modo]["unidade"],
        })
    if not etapas:
        return None
    return {"etapas": etapas}


def eh_circuito(regra) -> bool:
    return normalizar(getattr(regra, "circuito_payload", None)) is not None


def _num(v):
    try:
        if v is None or v == "":
            return None
        return float(v)
    except Exception:
        return None


# ── O progresso ──────────────────────────────────────────────────────

def ler_feito(bruto) -> dict:
    """O que ja foi registrado. Sempre um dict, nunca None."""
    if not bruto:
        return {}
    try:
        d = json.loads(bruto) if isinstance(bruto, str) else dict(bruto)
        return d if isinstance(d, dict) else {}
    except Exception:
        return {}


def _valores(reg) -> list:
    v = (reg or {}).get("valores")
    return [x for x in v if isinstance(x, (int, float))] if isinstance(v, list) else []


def bloco_completo(etapa: dict, reg: dict) -> bool:
    """
    O bloco foi entregue?

    Series: completo quando o numero de series lancadas alcanca o
    combinado. O VALOR de cada serie nao reprova — quem fez 3 series de
    18s numa faixa de 20-30 entregou as tres series; o que isso custa e
    a sessao virar PARCIAL, nao o bloco ficar aberto.
    """
    reg = reg or {}
    modo = etapa["modo"]
    if modo == CHECK:
        return bool(reg.get("feito"))
    if MODOS[modo]["tem_serie"]:
        return len(_valores(reg)) >= int(etapa.get("series") or 1)
    return reg.get("valor") is not None


def bloco_abaixo_do_piso(etapa: dict, reg: dict) -> bool:
    """
    Entregue, porem abaixo do combinado.

    So faz sentido em bloco COMPLETO: um bloco em aberto nao esta abaixo
    do piso, esta em aberto.
    """
    reg = reg or {}
    piso = etapa.get("min")
    if piso is None or not bloco_completo(etapa, reg):
        return False
    if MODOS[etapa["modo"]]["tem_serie"]:
        # Basta UMA serie curta para a sessao ser parcial. Media
        # esconderia a serie fraca atras das fortes.
        return any(float(v) < piso for v in _valores(reg))
    val = reg.get("valor")
    return val is not None and float(val) < piso


def progresso(desenho: dict, feito: dict) -> dict:
    """Quantos blocos fechados, quais faltam, e se a sessao esta parcial."""
    etapas = (desenho or {}).get("etapas") or []
    feito = feito or {}
    fechados = parciais = 0
    for e in etapas:
        reg = feito.get(e["id"]) or {}
        if bloco_completo(e, reg):
            fechados += 1
            if bloco_abaixo_do_piso(e, reg):
                parciais += 1
    total = len(etapas)
    return {
        "total": total,
        "fechados": fechados,
        "faltam": max(0, total - fechados),
        "parciais": parciais,
        "completo": total > 0 and fechados >= total,
        "parcial": parciais > 0,
        "pct": int(round((fechados / total) * 100)) if total else 0,
    }


def completo(regra, acum) -> bool:
    """Todos os blocos entregues? A trava do botao Concluir."""
    d = normalizar(getattr(regra, "circuito_payload", None))
    if not d:
        return True                     # nao e circuito: nao trava nada
    return progresso(d, ler_feito(getattr(acum, "circuito_feito", None)))["completo"]


# ── O registro ───────────────────────────────────────────────────────

def registrar(desenho: dict, feito: dict, etapa_id: str,
              valor=None) -> tuple[dict, dict]:
    """
    Grava um bloco (ou mais uma serie dele). Devolve (feito, etapa).

    Nao decide XP nem status — quem faz isso e o router. Aqui e so a
    aritmetica do que foi entregue.
    """
    etapa = next((e for e in (desenho.get("etapas") or []) if e["id"] == etapa_id), None)
    if not etapa:
        raise ValueError("Bloco não existe neste circuito")

    feito = dict(feito or {})
    reg = dict(feito.get(etapa_id) or {})
    modo = etapa["modo"]

    if modo == CHECK:
        reg["feito"] = True
    elif MODOS[modo]["tem_serie"]:
        v = _num(valor)
        if v is None:
            raise ValueError("Informe o valor da série")
        vals = _valores(reg)
        if len(vals) >= int(etapa.get("series") or 1):
            raise ValueError("As séries deste bloco já foram todas lançadas")
        vals.append(float(v))
        reg["valores"] = vals
    else:
        v = _num(valor)
        if v is None:
            raise ValueError("Informe o valor")
        reg["valor"] = float(v)

    feito[etapa_id] = reg
    return feito, etapa


def desfazer(desenho: dict, feito: dict, etapa_id: str) -> dict:
    """
    Volta um passo NAQUELE bloco: tira a ultima serie, ou abre o bloco.

    Desfazer o bloco inteiro de uma vez apagaria tres series por um erro
    de digitacao na terceira.
    """
    etapa = next((e for e in (desenho.get("etapas") or []) if e["id"] == etapa_id), None)
    if not etapa:
        raise ValueError("Bloco não existe neste circuito")
    feito = dict(feito or {})
    reg = dict(feito.get(etapa_id) or {})
    if MODOS[etapa["modo"]]["tem_serie"]:
        vals = _valores(reg)
        if vals:
            vals.pop()
        reg["valores"] = vals
        if not vals:
            feito.pop(etapa_id, None)
        else:
            feito[etapa_id] = reg
    else:
        feito.pop(etapa_id, None)
    return feito


def gravar(feito: dict) -> str:
    return json.dumps(feito or {}, ensure_ascii=False)


# ── A leitura que o cartao desenha ───────────────────────────────────

def para_json(regra, acum) -> dict | None:
    """
    O circuito inteiro, do jeito que o cartao le.

    Emite o conjunto COMPLETO ou None — nunca metade. A licao do
    `_repeticao` no extrato: chave ausente vira `undefined` no cliente,
    e `undefined` se comporta diferente de `null` em comparacao.
    """
    d = normalizar(getattr(regra, "circuito_payload", None))
    if not d:
        return None
    feito = ler_feito(getattr(acum, "circuito_feito", None))
    p = progresso(d, feito)

    blocos = []
    for e in d["etapas"]:
        reg = feito.get(e["id"]) or {}
        blocos.append({
            **e,
            "valores":  _valores(reg),
            "valor":    reg.get("valor"),
            "feito":    bloco_completo(e, reg),
            "abaixo":   bloco_abaixo_do_piso(e, reg),
            "restam_series": (max(0, int(e.get("series") or 0) - len(_valores(reg)))
                              if MODOS[e["modo"]]["tem_serie"] else None),
        })
    return {"blocos": blocos, **p}


def rotulo_faixa(etapa: dict) -> str:
    """"25 a 30 min", "3 x 20-30 s", "3 x 10-12" — o combinado, em texto."""
    u = etapa.get("unidade") or ""
    piso, teto = etapa.get("min"), etapa.get("max")
    if piso is None and teto is None:
        faixa = ""
    elif piso is not None and teto is not None and piso != teto:
        faixa = f"{_fmt(piso)}–{_fmt(teto)}"
    else:
        faixa = _fmt(piso if piso is not None else teto)
    s = etapa.get("series")
    if s:
        return f"{s} × {faixa}{(' ' + u) if u else ''}".strip()
    return f"{faixa}{(' ' + u) if u else ''}".strip()


def _fmt(v) -> str:
    if v is None:
        return ""
    f = float(v)
    return str(int(f)) if f == int(f) else f"{f:.1f}".replace(".", ",")
