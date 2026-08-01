# -*- coding: utf-8 -*-
"""
ENTREGA — escreve os arquivos com Jinja2, e só depois de prová-los.

SUBSTITUI O `saida.py`, que montava os mesmos gabaritos com f-strings.

Minha justificativa na época foi que "a crase é o caractere mais
perigoso deste projeto, e menos camadas entre o Python e o .js significa
menos chance de uma crase virar escape". Era um raciocínio errado: o bug
da crase estava no CONTEÚDO do template antigo, não no motor de
template. O Jinja2 já estava instalado no projeto enquanto eu escrevia
f-strings à mão.

O que o Jinja2 traz que a f-string não tinha:
  · o gabarito vira ARQUIVO, editável sem tocar em Python
  · `{{ }}` não colide com as chaves do CSS, então acabou o `{{` duplo
  · filtros (|lower, |replace) sem lógica no meio do texto

O QUE NÃO MUDOU, e é o que importa: nada é declarado "pronto" sem ter
sido aberto. O motor anterior imprimia "gerada com sucesso" e escrevia
um JavaScript que não compilava; o arquivo foi para o repositório assim
e derrubou o `PenaPunidorFX` inteiro no navegador.
"""
from __future__ import annotations
import os
import re
import shutil
import subprocess
import tempfile

from jinja2 import Environment, FileSystemLoader, StrictUndefined

from .tela import ForjaErro

_GABARITOS = os.path.join(os.path.dirname(__file__), "gabaritos")

# StrictUndefined: uma variável esquecida no gabarito EXPLODE em vez de
# renderizar vazio. Sem isso, `{{ codigo }}` faltando geraria
# `registrarInsignia('')` — arte órfã, silenciosa, exatamente o defeito
# que já custou uma sessão para achar.
_env = Environment(loader=FileSystemLoader(_GABARITOS),
                   undefined=StrictUndefined,
                   keep_trailing_newline=True)


def _literal(svg: str) -> str:
    """
    O SVG vira template literal de JS, com `{U}`/`{TAM}` interpolados.

    A crase já foi barrada em `Tela.montar`; a checagem se repete aqui
    porque esta função é pública e alguém pode chamá-la com SVG que não
    passou pela Tela.
    """
    if "`" in svg:
        raise ForjaErro("o SVG contém uma crase — ela fecharia o template "
                        "literal do JavaScript no meio.")
    corpo = svg.replace("{U}", "${u}").replace("{TAM}", "${tam}")
    return "`" + corpo + "`"


def _node_confere(caminho: str) -> str:
    """
    `node --check`. Devolve '' se passou, a mensagem se falhou, ou
    'SEM_NODE' quando não há node.

    "não consegui verificar" e "está certo" não podem ser a mesma saída.
    """
    node = shutil.which("node")
    if not node:
        return "SEM_NODE"
    r = subprocess.run([node, "--check", caminho], capture_output=True,
                       text=True)
    return "" if r.returncode == 0 else (r.stderr or r.stdout).strip()[:600]


def _gravar(js: str, destino: str, exigir: list[str], rotulo: str) -> None:
    """
    Escreve num TEMPORÁRIO, valida, e só então move.

    Validar depois de gravar no destino já teria substituído a versão
    boa por uma quebrada — foi assim que a insígnia sem sintaxe entrou
    no repositório e derrubou a que funcionava.
    """
    tmp = tempfile.NamedTemporaryFile("w", suffix=".js", delete=False,
                                      encoding="utf-8")
    tmp.write(js)
    tmp.close()
    try:
        erro = _node_confere(tmp.name)
        if erro == "SEM_NODE":
            print(f"  [forja] AVISO: node ausente — {rotulo} NAO foi "
                  f"verificada sintaticamente.")
        elif erro:
            raise ForjaErro(f"{rotulo}: o JavaScript gerado não compila.\n{erro}")

        faltando = [t for t in exigir if t not in js]
        if faltando:
            raise ForjaErro(f"{rotulo}: falta {faltando} no arquivo — "
                            f"seria arte órfã, invisível para a Forja.")

        os.makedirs(os.path.dirname(destino), exist_ok=True)
        shutil.move(tmp.name, destino)
        print(f"  [forja] {rotulo}: {len(js.splitlines())} linhas, "
              f"sintaxe conferida -> {os.path.basename(destino)}")
    finally:
        if os.path.exists(tmp.name):
            os.unlink(tmp.name)


def escrever_insignia(svg: str, destino: str, **ctx) -> None:
    js = _env.get_template("insignia.js.j2").render(corpo=_literal(svg), **ctx)
    _gravar(js, destino,
            exigir=[ctx["ns"], "registrarInsignia", ctx["codigo"]],
            rotulo=f"insígnia {ctx['titulo']}")


def bloco_aura(svg: str, **ctx) -> str:
    return _env.get_template("aura.js.j2").render(corpo=_literal(svg), **ctx)


def encaixar_aura(arquivo_auras: str, aura_id: str, bloco: str) -> None:
    """
    Insere ou troca UMA aura dentro de js/auras.js.

    Reescrever o arquivo apagaria as auras escritas à mão (arquiteto,
    admin, bella-rosa...). O recorte usa marcadores explícitos, e a
    função RECUSA agir se não souber onde encaixar — melhor não mexer do
    que mexer no lugar errado.
    """
    with open(arquivo_auras, encoding="utf-8") as f:
        txt = f.read()

    ini, fim = f"/* FORJA:INICIO {aura_id} */", f"/* FORJA:FIM {aura_id} */"
    novo = f"{ini}\n{bloco}\n{fim}"

    if ini in txt and fim in txt:
        a, b = txt.index(ini), txt.index(fim) + len(fim)
        txt = txt[:a] + novo + txt[b:]
    else:
        manual = re.search(
            r"Auras\.registrar\(\s*'" + re.escape(aura_id) + r"'[\s\S]*?\n\}\);",
            txt)
        if manual:
            txt = txt[:manual.start()] + novo + txt[manual.end():]
        else:
            # Aura NOVA. O ponto de inserção é antes da exportação, que é
            # a única âncora estável do arquivo — anexar no fim colocaria
            # o registro depois de `window.Auras = Auras`.
            ancora = "window.Auras = Auras;"
            if ancora not in txt:
                raise ForjaErro(
                    f"a aura '{aura_id}' é nova e não achei '{ancora}' em "
                    f"{arquivo_auras}. Nada foi alterado.")
            txt = txt.replace(ancora, novo + "\n\n" + ancora, 1)

    with open(arquivo_auras, "w", encoding="utf-8") as f:
        f.write(txt)

    erro = _node_confere(arquivo_auras)
    if erro and erro != "SEM_NODE":
        raise ForjaErro(f"auras.js ficou inválido depois de inserir "
                        f"'{aura_id}':\n{erro}")
    print(f"  [forja] aura '{aura_id}' encaixada em auras.js")


def amostra_png(svg: str, caminho: str, tam: int = 520,
                fundo: str = "#0a0714") -> str | None:
    """
    Rasteriza para o olho humano julgar.

    Existe porque QUATRO versões de arte deste projeto passaram por
    medição — contagem de elementos, ausência de rotação, bounds — e
    foram reprovadas pelo Arquiteto no segundo em que ele olhou. Nenhum
    assert responde "está bonito".
    """
    try:
        import cairosvg
    except ImportError:
        print("  [forja] cairosvg ausente: sem amostra PNG "
              "(pip install cairosvg)")
        return None
    pronto = svg.replace("{U}", "amostra").replace("{TAM}", str(tam))
    cairosvg.svg2png(bytestring=pronto.encode(), write_to=caminho,
                     output_width=tam, output_height=tam,
                     background_color=fundo)
    return caminho
