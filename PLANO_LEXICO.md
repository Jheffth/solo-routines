# O Léxico — plano de reskin mínimo defensável

Escopo aprovado pelo Arquiteto: **Fase 0 + Fase 1**. A Dungeon fica
como está (será reescrita). A identidade visual fica para depois.

---

## 1. A correção que precisa vir antes do plano

Na avaliação eu disse "978 ocorrências de Hunter" como se fosse a
medida do risco. Não é. Contagem não é risco — **distintividade** é.

Medindo de verdade, os 978 se dividem assim:

| onde | quanto | risco |
|---|---|---|
| comentários no código | 250 linhas | zero |
| nomes de variável e função | 670 | zero — ninguém vê |
| texto visível na tela | ~37 | **é aqui** |
| dungeon (será reescrita) | 8 arquivos | fora do escopo |

E o que é de fato reconhecível de *Solo Leveling* é pouco e específico:

- `'S': 'Monarch'` — os Monarcas são centrais na obra;
- `'E': 'O Mais Fraco'` — tradução direta da premissa ("o caçador mais
  fraco do mundo");
- "O Sistema" como narrador que fala com o hunter;
- a identidade visual — painéis com brilho roxo/azul (Fase 2, adiada).

**O que NÃO é risco, e eu quase tratei como se fosse:**

- **"Dungeon"** é genérico desde 1974. Não há o que proteger.
- **Ranks E→S** aparecem em dezenas de obras japonesas.
- **"Arquiteto"** é invenção do Jefferson. Não tem nada de Solo
  Leveling, e mexer nele é risco de autorização (são 47 checagens de
  permissão com a string crua) por zero ganho.

Não sou advogado. O objetivo aqui é **reduzir risco óbvio** numa due
diligence, não obter certeza jurídica.

---

## 2. A descoberta que muda o plano

A tabela de títulos de rank existe em **SETE cópias**:

```
backend/auth/registro_core.py      backend/database.py
backend/migrar_niveis_xp.py        backend/routers/gerencial.py
backend/seed.py                    frontend/js/pages/perfil.js
frontend/js/pecas/hunter-card-classico.js
```

Isto já mordeu uma vez neste projeto: no passo do cartão de peças eu
inventei títulos ("Aprendiz de Caçador") porque copiei de uma cópia
desatualizada, e só o teste de integração pegou.

**Um reskin sem o léxico teria que achar as sete e acertar as sete.** E
a oitava, quando alguém a criasse, nasceria com o texto velho.

Este é o argumento real para a Fase 0 — não é elegância, é que sem ela
o reskin é um trabalho que se refaz.

---

## 3. Fase 0 — o léxico (2 dias)

Um dicionário, duas faces, mesmo conteúdo:

```
webapp/backend/motors/lexico.py     ← a fonte
webapp/frontend/js/lexico.js        ← espelho, gerado e verificado
```

### O que entra

Só o que o **usuário lê**. Nome de variável não entra: renomear 670
identificadores é risco puro com ganho zero.

```python
LEXICO = {
    # a pessoa
    "agente":        "Hunter",        # ← Fase 1 troca aqui
    "agente_plural": "Hunters",

    # os graus
    "rank_E": "O Mais Fraco",         # ← Fase 1
    "rank_D": "Iniciante",
    "rank_C": "Promissor",
    "rank_B": "Experiente",
    "rank_A": "Elite",
    "rank_S": "Monarch",              # ← Fase 1

    # a voz
    "sistema":   "O Sistema",         # ← Fase 1
    "cargo_max": "Arquiteto",         # NÃO muda: é valor de permissão
}
```

### A regra que faz o léxico valer

> Nenhuma outra fonte pode conter estas palavras em texto de tela.

O teste varre `index.html` e os `js/pages/` procurando os termos fora
do léxico, e falha se achar. Sem esse teste o léxico vira sugestão, e a
próxima tela nasce com string solta — que é exatamente como as sete
cópias apareceram.

### Ordem de trabalho

1. `lexico.py` com o dicionário e `termo(chave)`.
2. `lexico.js` espelho + teste que compara as duas listas de chaves
   (divergir em silêncio seria o pior desfecho).
3. As sete cópias de título passam a ler do léxico. **Uma de cada vez,
   com a suíte rodando entre elas** — `registro_core` e `seed` gravam
   no banco, então erro ali nasce em dado, não em tela.
4. O teste do varredor.

---

## 4. Fase 1 — as trocas (1 dia)

Com o léxico de pé, isto é uma edição de arquivo.

| chave | de | para |
|---|---|---|
| `rank_E` | O Mais Fraco | *a definir* |
| `rank_S` | Monarch | *a definir* |
| `sistema` | O Sistema | *a definir* |

`agente` (Hunter) **fica** neste escopo — é vocabulário comum de RPG, e
o mínimo defensável tira a citação direta, não o gênero.

### O que precisa do Arquiteto

As três palavras novas. Não invento nome de produto do outro; e um nome
escolhido por mim seria a primeira coisa que você trocaria.

### Um cuidado com o banco

`seed.py:212` grava `titulo = "O Arquiteto do Sistema"` na conta do
Arquiteto. Trocar o léxico não reescreve o que já foi gravado — a
migração é uma linha, mas precisa existir, senão o texto velho sobrevive
no seu próprio perfil e ninguém percebe.

---

## 5. Verificação

- suíte completa entre cada uma das sete substituições;
- o varredor: zero termo de tela fora do léxico;
- espelho: as chaves de `lexico.py` e `lexico.js` são idênticas;
- e o que nenhum teste pega — **abrir as 14 páginas e ler**. Eu não
  tenho navegador; esta parte é sua.

---

## 6. O que fica pendente, e por quê

**A Dungeon** mantém o vocabulário antigo até a reescrita. Com zero
usuários não há exposição — mas isto **não pode ir ao ar público
assim**. Anotado como bloqueio de lançamento, não como dívida técnica.

**A Fase 2 (identidade visual)** é o item de maior risco e o único que
eu não consigo julgar sozinho. Fica para quando você quiser: com o
léxico pronto, ela é independente.

**Os 670 identificadores e os 250 comentários** ficam como estão. Se um
dia incomodarem, são um `sed` — e nenhum deles é visível para ninguém
de fora.
