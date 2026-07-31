# -*- coding: utf-8 -*-
"""Confere um lote de sussurros ANTES de ele virar produção."""
import re
from collections import Counter
from motors import ecos

VARS_OK = {"jogador", "missao", "n", "dias"}
PROIBIDO = re.compile(r"[!¡😀-🿿]|\.\.\.|--|\bcara\b|\bmano\b|"
                      r"você consegue|amanhã é um novo dia|"
                      r"preguiçoso|fracassado|patético|"
                      r"caçador|monarca|masmorra|rank\s*[SABCDE]\b", re.I)

erros, avisos = [], []
textos = Counter()
por_int = Counter()
pesos = Counter()

for i, (intens, texto, peso) in enumerate(ecos.CATALOGO):
    onde = f"#{i} [{intens}] {texto[:48]}"
    if intens not in ecos.INTENSIDADES:
        erros.append(f"{onde}: intensidade desconhecida")
    if peso not in (1, 2, 3):
        erros.append(f"{onde}: peso {peso} fora de 1..3")
    textos[texto.strip().lower()] += 1
    por_int[intens] += 1
    pesos[peso] += 1

    # variáveis
    achadas = set(re.findall(r"\{(\w+)\}", texto))
    if achadas - VARS_OK:
        erros.append(f"{onde}: variável inválida {achadas - VARS_OK}")
    if len(achadas) > 1:
        avisos.append(f"{onde}: {len(achadas)} variáveis — soa como formulário")
    if "n" in achadas and intens in (ecos.SECA, ecos.VAZIO, ecos.QUITADO):
        avisos.append(f"{onde}: {{n}} não faz sentido em {intens}")

    # forma
    palavras = len(texto.split())
    if palavras < 3:
        avisos.append(f"{onde}: {palavras} palavras — curta demais")
    if palavras > 14:
        avisos.append(f"{onde}: {palavras} palavras — não cabe na tela")
    if PROIBIDO.search(texto):
        erros.append(f"{onde}: contém termo proibido")
    if texto != texto.strip():
        erros.append(f"{onde}: espaço sobrando nas pontas")
    if "Sistema" in texto and "o sistema" in texto:
        avisos.append(f"{onde}: 'Sistema' com caixa inconsistente")

for t, n in textos.items():
    if n > 1:
        erros.append(f"REPETIDA {n}x: {t[:60]}")

print(f"\n  total            : {len(ecos.CATALOGO)}")
print(f"  por intensidade  : {dict(por_int)}")
print(f"  por peso         : {dict(sorted(pesos.items()))}")
com_var = sum(1 for _i, t, _p in ecos.CATALOGO if "{" in t)
print(f"  com variável     : {com_var} ({100*com_var//max(1,len(ecos.CATALOGO))}%)"
      f"  {'OK' if com_var <= len(ecos.CATALOGO)*0.3 else '← acima de 30%'}")
print(f"\n  ERROS  : {len(erros)}")
for e in erros[:25]:
    print("    ·", e)
print(f"  AVISOS : {len(avisos)}")
for a in avisos[:15]:
    print("    ·", a)
raise SystemExit(1 if erros else 0)
