# Prompt para gerar sussurros do Sistema

Cole o bloco abaixo em qualquer modelo capaz de gerar em lote. Ele foi
escrito para produzir saída que **cai direto** em
`webapp/backend/motors/ecos.py`, sem edição manual.

No fim deste arquivo há um **validador** — rode-o antes de colar o lote
no projeto.

---

## O PROMPT

````
Você vai escrever falas para uma entidade chamada O SISTEMA, dentro de
um aplicativo de produtividade gamificado em português do Brasil.

## O CONTEXTO

O usuário se chama JOGADOR. Ele cadastra missões (hábitos, tarefas,
metas) e o Sistema registra tudo que ele faz e deixa de fazer.

Quando o Jogador falha, o Sistema TOMA A TELA INTEIRA: tudo escurece e
desfoca, um sussurro toca, e UMA FRASE aparece grande, em branco
gélido, no centro. Ela fica ~4 segundos e some. O cartão da missão
fracassada continua visível, borrado, atrás da frase.

Você está escrevendo essas frases.

## QUEM É O SISTEMA

O Sistema NÃO é um coach. NÃO é um amigo. NÃO é um vilão.

Ele é um ARQUIVISTA FRIO. Ele não quer que você melhore — ele apenas
registra, com precisão absoluta, o que aconteceu. A ameaça dele não
vem de raiva; vem de indiferença e de memória perfeita.

O tom certo é o de alguém que anotou algo sobre você num caderno e
fechou o caderno sem dizer o quê.

## AS CINCO INTENSIDADES

O Sistema muda de tom conforme a dívida do Jogador cresce.

1. SECA — a primeira falha
   Constatação. Sem julgamento, sem conselho, sem ameaça explícita.
   O Sistema apenas informa que anotou.
   Ex.: "O Sistema registra."
   Ex.: "Havia uma promessa aqui."

2. ENCARANDO — reincidência (2 a 3 dívidas)
   Agora ele fala COM o Jogador, não sobre ele. Direto, seco,
   levemente incômodo. Pode usar pergunta retórica.
   Ex.: "Você acha que o Sistema brinca, Jogador?"
   Ex.: "Não confunda paciência com permissão."

3. FRIA — acúmulo (4 ou mais)
   O Sistema parou de perguntar por quê. Frieza total, quase
   desinteresse. É a intensidade mais assustadora justamente porque
   ele deixou de se importar em cobrar.
   Ex.: "Continue. O Sistema tem mais tempo que você."
   Ex.: "O Sistema parou de contar. Resolva o que já existe."

4. VAZIO — o Jogador falhou, mas não cadastrou nenhuma punição
   O Sistema não tem com que cobrar. Ameaça e convite na mesma frase.
   Ex.: "O Sistema não tem com que cobrar. Ainda."

5. QUITADO — o Jogador PAGOU a dívida
   A ÚNICA intensidade que não pune. Reconhecimento seco, sem festa,
   sem elogio caloroso. O Sistema registra o acerto com o mesmo tom
   com que registrou o erro.
   Ex.: "Uma linha a menos."
   Ex.: "Pago. O Sistema não guarda rancor — guarda o registro."

## AS VARIÁVEIS

Você PODE usar estas, e só estas:

  {jogador}  como o Sistema o chama          → "Jogador"
  {missao}   o título da missão que falhou   → "Passar fio dental"
  {n}        quantas dívidas existem         → "3"
  {dias}     há quantos dias a mais antiga   → "5"

REGRAS DAS VARIÁVEIS:
· No máximo UMA variável por frase. Duas soam como formulário.
· {n} só faz sentido em ENCARANDO e FRIA (na SECA sempre vale 1).
· {dias} só em ENCARANDO e FRIA.
· {missao} funciona em qualquer uma, e é a mais poderosa: uma frase
  que sabe o nome do que você não fez é outra coisa.
· No máximo 25% do lote deve usar variável. Frase sem variável
  envelhece melhor.

## AS REGRAS DE ESCRITA

TAMANHO
· Entre 3 e 12 palavras. A frase aparece GRANDE na tela inteira.
· Nunca mais de uma sentença, exceto quando a segunda tem 4 palavras
  ou menos. ("Ainda." / "Por enquanto." / "O Sistema anotou.")

PROIBIDO — e cada proibição tem um motivo
· Exclamação. O Sistema não se exalta.
· Emoji, aspas, parênteses, reticências, hífen de travessão duplo.
· Gíria, regionalismo, informalidade ("cara", "mano", "tipo assim").
· Motivação positiva ("você consegue", "amanhã é um novo dia").
  O Sistema não encoraja.
· Insulto direto ("preguiçoso", "fracassado", "patético"). Ele não
  ofende — ofensa é emoção, e ele não tem.
· Referência a religião, culpa moral, peso, corpo, dieta, aparência.
· Ameaça de dano real ou linguagem que sugira autopunição física
  além do que o próprio Jogador cadastrou.
· Qualquer coisa que soe como diagnóstico ("você é procrastinador").
· Vocabulário de anime ou de qualquer obra específica: nada de
  "caçador", "monarca", "masmorra", "despertar", "rank S".

OBRIGATÓRIO
· Português do Brasil, ortografia impecável, acentuação correta.
· Se citar o Sistema, escreva "o Sistema" com S maiúsculo.
· Se dirigir-se ao usuário, use {jogador} ou "você" — nunca um nome.
· A frase precisa funcionar SOZINHA, sem contexto anterior.

O QUE FAZ UMA FRASE BOA
· Ela descreve, não aconselha.
· Ela é mais curta do que você quer que seja.
· Ela deixa uma implicação no ar em vez de completá-la.
· Lida em voz alta, ela soa como algo dito de costas.

TESTE RÁPIDO: se a frase caberia num pôster motivacional invertido,
ela está errada. Se ela caberia numa ficha de arquivo, está certa.

## RARIDADE

Cada frase recebe um peso:
  3 = comum      (aparece sempre; deve ser sólida e reutilizável)
  2 = ocasional  (mais específica ou mais dura)
  1 = rara       (a mais estranha, a mais memorável, a que o Jogador
                  vai lembrar de ter visto uma vez)

Distribua aproximadamente: 45% peso 3, 35% peso 2, 20% peso 1.
As de peso 1 são onde você deve arriscar.

## O FORMATO DA SAÍDA

APENAS linhas Python, nada mais. Sem cercas de código, sem cabeçalho,
sem comentário, sem numeração. Exatamente assim:

    (SECA, "O Sistema registra.", 3),
    (ENCARANDO, "Você acha que o Sistema brinca, {jogador}?", 3),
    (FRIA, "Continue. O Sistema tem mais tempo que você.", 3),

Use aspas duplas. Escape aspas internas com \\" (ou melhor: não use
aspas internas).

## A QUANTIDADE

Gere 1000 frases, distribuídas assim:

  SECA        300
  ENCARANDO   300
  FRIA        250
  VAZIO        75
  QUITADO      75

NENHUMA FRASE PODE SE REPETIR, e evite variações triviais da mesma
ideia ("O Sistema anotou." / "O Sistema anota." / "Anotado pelo
Sistema."). Prefira mil ideias a mil formas de dizer dez ideias.

Se precisar entregar em lotes, entregue 100 por vez e continue de onde
parou, sem repetir nenhuma anterior.
````

---

## Como usar o resultado

1. Abra `webapp/backend/motors/ecos.py`.
2. Cole as linhas geradas **dentro** de `CATALOGO = [ ... ]`, ao lado
   das que já existem. As de semente podem ficar — repetição entre
   lotes é filtrada pelo validador abaixo.
3. Rode o validador.
4. Rode `python test_punicao.py` — ele já confere que nenhuma variável
   vaza crua na tela.

Nada mais precisa mudar. O motor sorteia por intensidade e peso, e o
`evitar` impede repetir a última vista. **Mil frases não exigem uma
linha de código nova** — foi para isso que o formato é uma lista plana
em que cada item se descreve.

---

## O validador

Salve como `webapp/backend/validar_ecos.py` e rode antes de confiar no
lote:

```python
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
```

Rode assim:

```
cd webapp/backend
SECRET_KEY=t python validar_ecos.py
```

**Erro** barra o lote. **Aviso** é para o seu olho decidir — nem toda
frase de 15 palavras está errada, mas quase toda está.

---

## Uma nota sobre a quantidade

Mil frases é agressivo de propósito, e você tem razão no raciocínio: o
Eco só assusta enquanto for imprevisível. Mas repare no que o motor já
faz por você — ele **evita repetir a última vista** e **sorteia por
peso**, então as raras continuam raras mesmo num lote grande.

Com mil frases e as proporções do prompt, o Jogador veria uma repetição
aproximadamente a cada 200 falhas na mesma intensidade. Isso é bem mais
do que precisa — e é bom que seja: o custo é zero, e a alternativa
(descobrir que o Sistema só sabia dizer trinta coisas) é o tipo de
decepção que não se conserta depois.
