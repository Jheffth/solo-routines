# -*- coding: utf-8 -*-
"""
SAÍDA — escreve os arquivos, e só depois de provar que eles funcionam.

O DEFEITO QUE ESTE MÓDULO EXISTE PARA NÃO REPETIR

O motor anterior imprimia:

    [Forja S-Rank] Insígnia 'Pena do Punidor' gerada com sucesso

e escrevia um JavaScript que não compilava. O template usava crase
ESCAPADA (`\\``) dentro de código de topo — `SyntaxError: Invalid or
unexpected token`. O arquivo foi para o repositório, e o `PenaPunidorFX`
inteiro morria no navegador. Ninguém percebeu porque a mensagem dizia
que tinha dado certo.

A lição não é "faltou um teste". É que uma função chamada `exportar` que
imprime "sucesso" sem ter aberto o resultado está declarando algo que
não verificou. Aqui, `escrever()` só imprime depois de:

  1. rodar `node --check` no arquivo gerado (se houver node)
  2. conferir que o namespace existe no texto
  3. conferir que a arte foi registrada no ConquistaFX

Sem node disponível, ele DIZ que não conseguiu validar em vez de fingir
que validou.
"""
from __future__ import annotations
import os
import re
import shutil
import subprocess
import tempfile

from .compositor import Composicao, ForjaErro


# ── o gabarito do badge ──────────────────────────────────────────────
#
# Escrito como f-string comum e não como template Jinja de propósito: o
# arquivo tem UMA template literal de JS, e a crase é o caractere mais
# perigoso deste projeto (já fechou template literal no meio três
# vezes). Menos camadas entre o Python e o `.js`, menos chance de uma
# crase virar escape.

_BADGE = """/* ══════════════════════════════════════════════════════════════
   {titulo} — insígnia
   GERADO POR motors/forja. Não edite à mão: o próximo build sobrescreve.
   Fonte: {fonte}
   ══════════════════════════════════════════════════════════════ */

const {ns} = {{
  _seq: 0,

  /* Cada chamada ganha um sufixo próprio para os ids internos.

     A Forja mostra a MESMA insígnia em três tamanhos no mesmo
     documento. Com ids fixos (era o caso do motor antigo: id="shadow",
     id="glow"), os três SVGs declaram o mesmo id, o primeiro vence e os
     outros dois herdam o filtro errado — em silêncio. */
  _svg(tam) {{
    const u = 'i' + (++this._seq);
    return {corpo};
  }},

  /* A cerimônia delega ao renderizador único do projeto. Montar HTML
     próprio aqui seria uma segunda cerimônia para manter. */
  celebrar() {{
    if (typeof ConquistaFX === 'undefined') return;
    ConquistaFX.show({{
      codigo: '{codigo}', titulo: '{titulo}',
      descricao: '{descricao}',
      icone: '{icone}', cor: '{cor}',
      xp_bonus: {xp}, moedas_bonus: {moedas},
    }});
  }},
}};

window.{ns} = {ns};

/* Optional chaining nos DOIS pontos: este arquivo pode carregar antes
   do conquista-fx.js, e um erro aqui derrubaria o resto do script. */
window.ConquistaFX?.registrarInsignia?.('{codigo}', tam => {ns}._svg(tam));
"""


_AURA = """/* ══════════════════════════════════════════════════════════════
   {titulo} — aura
   GERADO POR motors/forja. Não edite à mão.
   Fonte: {fonte}
   ══════════════════════════════════════════════════════════════ */
Auras.registrar('{aura_id}', function (tam) {{
  const u = 'a' + (++Auras._seq);
  return {corpo};
}});
"""


def _js_template_literal(svg: str, tam_var: str = "tam") -> str:
    """
    Converte o SVG num literal de template JS, com os buracos preenchidos.

    A CRASE É VERIFICADA AQUI, e não no fim: uma crase dentro do SVG
    fecharia o literal no meio e produziria exatamente o erro que
    derrubou a versão anterior. Melhor explodir no build.
    """
    if "`" in svg:
        raise ForjaErro("o SVG contém uma crase — ela fecharia o template "
                        "literal do JS no meio. Troque por aspas.")
    corpo = svg.replace("{U}", "${u}").replace("{TAM}", "${" + tam_var + "}")
    return "`" + corpo + "`"


def _validar_js(caminho: str) -> str:
    """
    Roda `node --check`. Devolve '' se passou, ou a mensagem do erro.

    Quando não há node, devolve um aviso EXPLÍCITO em vez de silêncio —
    "não consegui verificar" e "está certo" não podem ser a mesma saída.
    """
    node = shutil.which("node")
    if not node:
        return "SEM_NODE"
    r = subprocess.run([node, "--check", caminho],
                       capture_output=True, text=True)
    return "" if r.returncode == 0 else (r.stderr or r.stdout).strip()[:600]


def escrever_badge(comp: Composicao, destino: str, *, ns: str, codigo: str,
                   titulo: str, descricao: str, icone: str, cor: str,
                   xp: int, moedas: int, fonte: str) -> None:
    js = _BADGE.format(
        ns=ns, codigo=codigo, titulo=titulo, descricao=descricao,
        icone=icone, cor=cor, xp=xp, moedas=moedas, fonte=fonte,
        corpo=_js_template_literal(comp.montar(classe_raiz="conquista-svg")))
    _gravar(js, destino, exigir=[ns, "registrarInsignia", codigo],
            rotulo=f"insígnia {titulo}")


def escrever_aura(comp: Composicao, destino: str, *, aura_id: str,
                  titulo: str, fonte: str) -> None:
    js = _AURA.format(aura_id=aura_id, titulo=titulo, fonte=fonte,
                      corpo=_js_template_literal(comp.montar(classe_raiz="aura-svg")))
    _gravar(js, destino, exigir=["Auras.registrar", aura_id],
            rotulo=f"aura {titulo}")


def _gravar(js: str, destino: str, exigir: list[str], rotulo: str) -> None:
    """
    Escreve num TEMPORÁRIO, valida, e só então move para o destino.

    Se validasse depois de gravar no lugar certo, um build quebrado já
    teria substituído a versão boa — foi assim que a insígnia quebrada
    entrou no repositório e derrubou o arquivo que funcionava.
    """
    tmp = tempfile.NamedTemporaryFile("w", suffix=".js", delete=False,
                                      encoding="utf-8")
    tmp.write(js)
    tmp.close()
    try:
        erro = _validar_js(tmp.name)
        if erro == "SEM_NODE":
            print(f"  [forja] AVISO: node ausente — {rotulo} NÃO foi "
                  f"verificada sintaticamente.")
        elif erro:
            raise ForjaErro(f"{rotulo}: o JavaScript gerado não compila.\n{erro}")

        faltando = [t for t in exigir if t not in js]
        if faltando:
            raise ForjaErro(f"{rotulo}: o arquivo não contém {faltando} — "
                            f"seria arte órfã, invisível para a Forja.")

        os.makedirs(os.path.dirname(destino), exist_ok=True)
        shutil.move(tmp.name, destino)
        n = len(js.splitlines())
        print(f"  [forja] {rotulo}: {n} linhas, sintaxe conferida → {destino}")
    finally:
        if os.path.exists(tmp.name):
            os.unlink(tmp.name)


def substituir_aura_em(arquivo_auras: str, aura_id: str, bloco: str) -> None:
    """
    Troca UMA aura dentro de js/auras.js, preservando todas as outras.

    Reescrever o arquivo inteiro seria mais simples e apagaria as auras
    escritas à mão (arquiteto, admin, bella-rosa...). O recorte é feito
    por marcadores explícitos, e a função RECUSA agir se não encontrar
    exatamente um bloco — melhor não mexer do que mexer no lugar errado.
    """
    with open(arquivo_auras, encoding="utf-8") as f:
        txt = f.read()

    ini = f"/* FORJA:INICIO {aura_id} */"
    fim = f"/* FORJA:FIM {aura_id} */"
    novo = f"{ini}\n{bloco}\n{fim}"

    if ini in txt and fim in txt:
        a, b = txt.index(ini), txt.index(fim) + len(fim)
        txt = txt[:a] + novo + txt[b:]
    else:
        # Primeira vez: substitui o registro manual, se houver.
        alvo = re.search(
            r"Auras\.registrar\(\s*'" + re.escape(aura_id) + r"'[\s\S]*?\n\}\);",
            txt)
        if not alvo:
            raise ForjaErro(
                f"não achei onde encaixar a aura '{aura_id}' em {arquivo_auras}. "
                f"Nada foi alterado.")
        txt = txt[:alvo.start()] + novo + txt[alvo.end():]

    with open(arquivo_auras, "w", encoding="utf-8") as f:
        f.write(txt)

    erro = _validar_js(arquivo_auras)
    if erro and erro != "SEM_NODE":
        raise ForjaErro(f"auras.js ficou inválido depois de inserir "
                        f"'{aura_id}':\n{erro}")
    print(f"  [forja] aura '{aura_id}' inserida em {arquivo_auras}")
