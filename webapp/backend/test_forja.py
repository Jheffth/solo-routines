# -*- coding: utf-8 -*-
"""
O MOTOR DA FORJA — os contratos que impedem a volta dos defeitos.

Cada bloco aqui corresponde a um defeito MEDIDO no motor anterior, não a
uma preocupação hipotética. O critério para um assert existir neste
arquivo é: isso já aconteceu, custou tempo, e não quebrou nada quando
aconteceu — que é o que o torna capaz de voltar.

    python webapp/backend/test_forja.py
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from motors.forja import geometria as G          # noqa: E402
from motors.forja import pincel as P             # noqa: E402
from motors.forja.compositor import (            # noqa: E402
    Composicao, ForjaErro, gradiente_radial)
from motors.forja import saida                   # noqa: E402
from motors.forja.pecas import pena_punidor      # noqa: E402

falhas = testes = 0


def ok(cond, msg):
    global falhas, testes
    testes += 1
    if not cond:
        falhas += 1
    print(("  [ok]  " if cond else "  [XX]  ") + msg)


def explode(fn, trecho, msg):
    """O motor tem de RECUSAR — não avisar e seguir."""
    try:
        fn()
        ok(False, msg + "  (NÃO recusou)")
    except ForjaErro as e:
        ok(trecho.lower() in str(e).lower(),
           msg + f"  (recusou: {str(e)[:60]}…)")


# ══ 1. A PRIMITIVA QUE FALTAVA ══════════════════════════════════════
print("\n-- traço curvo com espessura variável --")
eixo = [(50, 250), (70, 160), (150, 110), (250, 60)]

d = G.contorno(eixo, 20, G.perfil_folha)
ok(d.startswith("M ") and d.endswith(" Z"), "contorno devolve path fechado")
ok(d.count("L") > 40, "e é uma curva amostrada, não quatro pontos")

# O ponto todo: perfis DIFERENTES sobre o MESMO eixo dão formas
# diferentes. Era isso que o motor antigo não conseguia fazer.
formas = {n: G.contorno(eixo, 20, f)
          for n, f in (("folha", G.perfil_folha), ("lamina", G.perfil_lamina),
                       ("gota", G.perfil_gota), ("calig", G.perfil_caligrafico))}
ok(len(set(formas.values())) == 4,
   "quatro perfis sobre o mesmo eixo dão quatro formas distintas")
ok(G.perfil_lamina(0) > G.perfil_lamina(1),
   "lâmina: grossa na base, fina na ponta")
ok(G.perfil_gota(1) > G.perfil_gota(0), "gota: o inverso")
ok(abs(G.perfil_folha(.5) - 1) < .05, "folha: máxima no meio")

# Tangente em t=0 com p0==p1 daria vetor nulo e espessura zero na base.
degenerado = [(10, 10), (10, 10), (60, 40), (90, 90)]
tx, ty = G.tangente(*degenerado, 0.0)
ok(abs(tx) + abs(ty) > .5, "tangente não colapsa quando p0 == p1")


# ══ 2. O SUJEITO NASCE NO MOTOR ═════════════════════════════════════
print("\n-- o motor desenha o ASSUNTO, não só a moldura --")
sem = P.Semente(1)
barbas = P.plumagem(eixo, sem, n=30, escala=60)
ok(len(barbas) >= 28, f"plumagem devolve {len(barbas)} barbas")

# O BUG QUE ISTO PEGA: `comprimento(t)` devolve fração (0..1) e `escala`
# dá o tamanho em px. Sem `escala`, cada barba nascia com ~1px e a pena
# renderizava sem nenhuma barba visível — sem erro, porque 1px é válido.
# ARMADILHA JÁ PAGA: a primeira versão media a caixa de TODAS as barbas
# juntas. O vão do eixo (200px) domina a soma, então escala 30 dava 230 e
# escala 120 dava 320 — a diferença real ficava diluída e o assert
# reprovava código correto. Mede-se a barba, não o conjunto.
def _maior_barba(lista):
    return max(max(l[2] - l[0], l[3] - l[1]) for l in map(G.limites, lista))

grande = _maior_barba(P.plumagem(eixo, P.Semente(3), n=30, escala=120))
pequena = _maior_barba(P.plumagem(eixo, P.Semente(3), n=30, escala=30))
ok(grande > pequena * 3,
   f"escala maior ⇒ barba maior ({pequena:.0f}px → {grande:.0f}px); "
   f"a fração não é o tamanho")

# Barbas iguais leem como pente. A irregularidade é intencional.
comp = [G.limites(b) for b in barbas]
larguras = sorted({round(c[2] - c[0], 1) for c in comp})
ok(len(larguras) > 12, "as barbas não são idênticas entre si")

ok(len(P.anel_tracejado((150, 150), 100, 24)) == 24, "anel radial ainda existe")
ok("M" in P.raquis(eixo) and "M" in P.floreio(
    [(10, 10), (40, 40), (80, 20), (120, 50)]), "ráquis e floreio desenham")

b = P.bico(eixo, 30)
ok(all(k in b for k in ("corpo", "fenda", "respiro", "ponta")),
   "o bico vem em partes, para materiais diferentes")


# ══ 3. O COMPOSITOR RECUSA ARTE QUEBRADA ════════════════════════════
print("\n-- o compositor recusa em vez de entregar --")

def _orfa():
    c = Composicao("t", 300)
    c.camada("x").add('<circle cx="10" cy="10" r="5" fill="url(#nao-existe)"/>')
    return c.montar()
explode(_orfa, "órf", "referência url(#x) sem o #x definido")

def _id_cru():
    c = Composicao("t", 300)
    c.defs('<radialGradient id="shadow"><stop offset="0"/></radialGradient>')
    c.camada("x").add('<circle cx="10" cy="10" r="5" fill="url(#shadow)"/>')
    return c.montar()
explode(_id_cru, "namespace", "id global (colide na vitrine de 3 tamanhos)")

def _fora():
    c = Composicao("t", 300)
    c.camada("x").add('<path d="M 10 10 L 10 -25 L 40 40 Z" fill="#fff"/>')
    return c.montar()
explode(_fora, "viewbox", "coordenada fora do viewBox (era y=-25 no motor antigo)")

def _sem_a11y():
    c = Composicao("t", 300)
    c.css("@keyframes gira { to { opacity: 0 } }")
    c.camada("x").add('<circle cx="10" cy="10" r="5"/>')
    return c.montar()
explode(_sem_a11y, "reduced-motion", "animação sem saída para reduced-motion")

# E o caminho feliz precisa passar, senão os asserts acima só provam
# que a função sabe explodir.
def _boa():
    c = Composicao("t", 300)
    g = c.id("g")
    c.defs(gradiente_radial(g, [(0, "#f00", 1), (1, "#000", 0)]))
    c.camada("x").add(f'<circle cx="150" cy="150" r="40" fill="url(#{g})"/>')
    c.css("@keyframes p { to { opacity:.5 } }"
          "@media (prefers-reduced-motion: reduce) { * { animation: none } }")
    return c.montar()
try:
    svg = _boa()
    ok("<svg" in svg and "{U}" in svg, "arte correta passa e mantém o {U}")
except ForjaErro as e:
    ok(False, f"arte correta foi recusada: {e}")


# ══ 4. A SAÍDA NÃO MENTE ════════════════════════════════════════════
print("\n-- a exportação valida antes de dizer 'sucesso' --")

# O defeito original: crase escapada no template gerava JS que não
# compilava, e a função imprimia "gerada com sucesso".
try:
    saida._js_template_literal("<svg>`</svg>")
    ok(False, "crase no SVG passou batido")
except ForjaErro as e:
    ok("crase" in str(e).lower(), "crase no SVG é recusada na hora")

lit = saida._js_template_literal('<svg width="{TAM}"><g id="a-{U}"/></svg>')
ok(lit.startswith("`") and lit.endswith("`"), "vira template literal")
ok("${u}" in lit and "${tam}" in lit, "os buracos {U}/{TAM} viram interpolação")

# COMPORTAMENTO, não docstring. A primeira versão deste assert lia o
# docstring de `_validar_js` — o que prova apenas que alguém escreveu um
# comentário, e é exatamente o tipo de verificação que deixou passar um
# motor que dizia "sucesso" sem olhar o resultado.
import shutil as _sh
_orig_which = _sh.which
try:
    _sh.which = lambda _n: None
    ok(saida._validar_js("/tmp/qualquer.js") == "SEM_NODE",
       "sem node, a saída DEVOLVE 'SEM_NODE' (não finge que validou)")
finally:
    _sh.which = _orig_which

_quebrado = "/tmp/forja_quebrado.js"
open(_quebrado, "w").write("const x = `nao fecha;")
ok(saida._validar_js(_quebrado) not in ("", "SEM_NODE"),
   "e com node presente, JS inválido é REPROVADO (era o defeito original)")
_bom = "/tmp/forja_bom.js"
open(_bom, "w").write("const x = 1;\n")
ok(saida._validar_js(_bom) == "", "JS válido passa")


# ══ 5. A PEÇA REAL ══════════════════════════════════════════════════
print("\n-- a Pena do Punidor, forjada pelo motor --")
ins = pena_punidor.insignia(300).montar(classe_raiz="conquista-svg")
aur = pena_punidor.aura(300).montar(classe_raiz="aura-svg")

ok('class="conquista-svg"' in ins, "insígnia usa a classe das insígnias")
ok('class="aura-svg"' in aur, "aura usa a classe das auras (as outras 5 usam)")
ok(ins.count("<path") > 80, f"a insígnia tem {ins.count('<path')} traços desenhados")

# A DIFERENÇA PARA AS DUAS TENTATIVAS ANTERIORES.
sem_com = re.sub(r"/\*[\s\S]*?\*/", "", aur)
ok("aura-girar" not in sem_com,
   "a aura NÃO usa aura-girar — o keyframe global que arquiteto, admin, "
   "pink-spirit e fênix compartilham")
ok("prefers-reduced-motion" in aur and "prefers-reduced-motion" in ins,
   "as duas honram reduced-motion")
ok(ins.count("{U}") > 5 and aur.count("{U}") > 5,
   "todos os ids são namespaced por instância")

# Determinismo: build duas vezes tem de dar o mesmo arquivo, senão não
# dá para dizer se uma mudança melhorou ou só embaralhou.
ok(pena_punidor.insignia(300).montar() == pena_punidor.insignia(300).montar(),
   "dois builds da mesma peça dão bytes idênticos")

# Escala: a Forja mostra em 140, 92 e 30px.
for tam in (30, 92, 140, 300):
    try:
        pena_punidor.insignia(tam).montar()
        ok(True, f"monta em {tam}px sem sair do viewBox")
    except ForjaErro as e:
        ok(False, f"{tam}px: {e}")


# ══ 6. O SCRIPT NÃO DESENHA ═════════════════════════════════════════
print("\n-- o script de build não contém arte --")
cli = open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "..", "..", "scripts", "forjar_insignia.py"),
           encoding="utf-8").read()
cli_codigo = re.sub(r'"""[\s\S]*?"""', "", cli)
cli_codigo = re.sub(r"^\s*#.*$", "", cli_codigo, flags=re.M)
ok("<path" not in cli_codigo and "<polygon" not in cli_codigo,
   "nenhum SVG cru no script — no motor antigo a pena morava aqui")
ok("points=" not in cli_codigo, "nenhuma coordenada escrita à mão")

print(f"\n=== {testes - falhas}/{testes} ===")
sys.exit(1 if falhas else 0)
