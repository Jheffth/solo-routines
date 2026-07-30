# A Missão de Repetição — projeto

> **Nada foi implementado.** Nomes de campo e contagens medidos no código.
>
> **O PREMIUM NÃO ENTRA AGORA.** O Arquiteto o mencionou para dar
> contexto, e eu tratei como requisito — construí regra de
> cancelamento, congelamento de histórico e trava de lançador para uma
> cobrança que ainda não existe.
>
> Corrigido: **o contador é de todos**, e tudo o que dependia de
> assinatura foi para o Apêndice A, fora do caminho crítico.
>
> Apliquei aqui a regra que este mesmo documento escreveu sobre
> guilda: *preparar é não fechar a porta; antecipar é construir a casa
> do outro lado dela.* Eu tinha construído a casa.

---

## 1. O que mudou na revisão, e o que isso custa

| Antes | Agora |
|---|---|
| CONTADOR era um tipo de missão | O **CONTADOR é um recipiente**, e as missões o alimentam |
| CONTADOR não pagava XP | **Paga**, pouco, por repetição |
| Premium travava alguma coisa | **Nada é travado.** Premium fica para depois (Apêndice A) |

A segunda linha é a que importa: **o vazamento de XP voltou.**

Eu havia escrito em vermelho que um contador que paga por clique é uma
impressora. A decisão de não pagar apagou o risco; a revisão o traz de
volta, e agora com razão de produto — *"+1 XP me motivaria a ir
respondendo questões"* é um argumento bom.

Então a resposta não é "não". É **separar duas coisas que estavam
juntas**, e essa separação é a espinha de todo o resto deste documento:

```
   87 questões hoje        ← o REGISTRO. Sem teto. É a verdade.
   +30 XP por elas         ← a RECOMPENSA. Com teto diário.
```

O registro nunca é limitado — limitar o registro seria mentir sobre o
que a pessoa fez. A recompensa é. E o cartão **mostra as duas**, com o
teto visível: um Sistema que para de pagar e avisa é justo; um que para
de pagar em silêncio parece quebrado.

Isto exige dois parâmetros novos na Balança (que hoje tem 39 em 10
grupos):

```
xp_por_repeticao_max     teto do que uma rotina pode declarar por clique
xp_repeticao_teto_dia    teto de XP por CONTADOR, por dia
```

**Não há teto diário de XP no projeto hoje** — conferi.

**O teto é por contador, e o Arquiteto deu a razão certa: as missões
são de categorias diferentes.** Um teto global faria "questões de
português" competir com "flexões" pelo mesmo orçamento de XP — duas
coisas que não têm nada a ver uma com a outra disputando um número.
Pior: o hunter que estuda de manhã chegaria à academia com o teto
gasto, e o Sistema puniria a diversidade.

Por contador, cada hábito tem o seu limite e nenhum consome o do
outro. O custo é aritmético e vale dizer: três contadores a 30 XP/dia
dão 90 XP/dia de cliques. É um número a acompanhar, não um defeito —
e o valor por contador está na Balança, ajustável sem deploy.

---

## 2. As três peças, e o que cada uma é

O exemplo do Arquiteto deixou a arquitetura clara:

> *"Responder 5 questões do tema que estou estudando"* — é meta e é missão.
> *"Questões de português"* — é contagem livre.
> **As duas alimentam o mesmo recipiente: "Fazer questões".**

```
      CONTADOR  "Fazer questões"          ← o recipiente.
         ▲              ▲                    acumula para sempre
         │              │
    ┌────┴────┐   ┌─────┴─────┐
    │  META   │   │   LIVRE   │            ← as missões. Alimentam.
    │  5 de 5 │   │  87 hoje  │
    └─────────┘   └───────────┘
```

**Uma natureza (`REPETICAO`), dois modos, um recipiente opcional.**

| | META | LIVRE (Bônus) |
|---|---|---|
| alvo | tem | não tem |
| paga | ao atingir o alvo, como qualquer ATIVA | por repetição, com teto diário |
| fracassa | sim, no prazo | não |
| pune | **sim** | não |
| conta para o STREAK | **sim** | **não** |
| prazo | obrigatório | opcional |

**O LIVRE é uma missão BÔNUS**, e o nome do Arquiteto resolveu a
dúvida que eu tinha deixado em aberto. Streak é a moeda da constância,
e constância se mede contra um COMPROMISSO. O META tem meta, então tem
promessa, então pode quebrar promessa — e por isso conta e pune.

O LIVRE não promete nada. Deixá-lo alimentar streak faria a corrente
mais fácil de manter clicando `+` uma vez do que cumprindo qualquer
missão de verdade — e o streak deixaria de significar o que significa.

"Bônus" também resolve a expectativa: quem lê "bônus" não espera
punição nem cobrança. O nome faz o trabalho que uma tela de ajuda
faria.

**Nada aqui é travado.** As duas modalidades e o contador são de
todos os hunters.

Isso simplifica mais do que parece: **`especiais.py` não ganha porta
nenhuma.** `REPETICAO` entra só no catálogo de naturezas conhecidas,
para o `normalizar()` não a rebaixar a ATIVA. Zero permissão, zero
"quatro portas", zero teste de acesso.

Quando o premium existir, o candidato natural é o **acúmulo através
do tempo** — "412 questões desde março". O Apêndice A registra por
quê, e o que isso custaria. Mas é conversa para quando houver
cobrança.

---

## 3. O que o Arquiteto chamou de "contador inteligente"

O recipiente precisa se **encontrar sozinho**. Se o hunter cria
"Questões de história" e já tem um contador "Fazer questões", o
lançador tem que perguntar — não obrigar a lembrar.

**Três níveis de esperteza, do barato ao caro:**

1. **Sugerir pelo nome.** Ao digitar o título, o lançador procura
   contadores com palavras em comum e oferece: *"Somar a **Fazer
   questões** (412)?"*. Um botão para aceitar, um para criar novo.

2. **Herdar da rotina-mãe.** Rotina diária que já aponta para um
   contador — toda instância do dia soma no mesmo lugar, sem
   perguntar de novo. É o caso do Arquiteto: a mesma rotina todo dia.

3. **Fundir depois.** Dois contadores que deveriam ser um só
   (*"Questões"* e *"Fazer questões"*): um botão de fundir na tela do
   contador, que reaponta as rotinas e soma. Sem isto o hunter
   convive para sempre com o erro do primeiro dia.

O item 3 não é luxo: **contador é dado de anos.** Um erro de nome no
primeiro mês fica visível pelo resto da vida do produto.

---

## 4. Como o dado é salvo

### 4.1 As tabelas

```
contadores                                     TABELA NOVA
  id
  usuario_id      FK
  nome            "Fazer questões"
  unidade         "questões"          para o texto: "412 questões"
  criado_em
  arquivado_em    null                arquivar ≠ apagar (§4.3)

rotinas                                        COLUNAS NOVAS
  natureza              já existe → aceita "REPETICAO"
  alvo_repeticoes       int  null    null = LIVRE
  contador_id           FK   null    a qual recipiente esta rotina soma
  xp_por_repeticao      int  null    só no LIVRE; limitado pela Balança
  intervalo_min_seg     int  null    opcional (§5.3)

execucao_dia                                   COLUNAS NOVAS
  repeticoes            int  0       a contagem DAQUELE DIA
  xp_repeticao_pago     int  0       quanto já pagou hoje (para o teto)
  ultima_repeticao_em   datetime
```

**Uma tabela nova e sete colunas.** Nada mais.

**Duas colunas que eu tinha proposto saíram:** `escopo` (guilda) e
`congelado_em` (premium). As duas eram reserva para coisas que não
existem, e nenhuma tinha regra atrás de si.

Tirei pela minha própria regra: coluna sem lógica é palpite gravado
no esquema. E o custo de adicionar depois é baixo neste projeto — o
`motors/migracao.py` é agnóstico de banco e já fez isso oito vezes.

**O que FICA de graça, e é o que realmente importa, é a disciplina de
consulta** (Apêndice B): somar sempre por `contador_id` e nada mais.
Isso não é uma coluna, é um hábito — e é ele que deixa a porta da
guilda aberta.

### 4.2 O total NÃO é armazenado

```sql
SELECT SUM(ed.repeticoes)
  FROM execucao_dia ed
  JOIN rotinas r ON r.id = ed.rotina_id
 WHERE r.contador_id = :id
```

O total do contador é **derivado**, sempre. Guardar um `total` na
tabela criaria uma segunda verdade que diverge no primeiro desfazer,
na primeira exclusão, no primeiro ajuste do Arquiteto. Este projeto já
pagou por segunda verdade cinco vezes — a última foi há três dias, nas
três placas do Dashboard lendo a tabela errada.

`SUM` com índice em `contador_id` custa nada. Se um dia custar, aí se
cacheia — com o cálculo continuando a ser a verdade.

### 4.3 Apagar a rotina apaga a história?

Se o total é derivado das execuções, excluir a rotina zera o contador.
**Isso está errado**, e é o único ponto onde eu abriria exceção.

**Proposta:** a rotina de repetição não é excluída, é **arquivada**
(`ativo = false`, que já existe). O contador continua somando o que
ela produziu. A exclusão de verdade, com perda do histórico, pede
confirmação que diga o número: *"isto apaga 412 questões do contador
Fazer questões"*.

### 4.4 Por que NÃO uma tabela de log

Considerei `repeticoes` com carimbo por clique — daria "a que horas
você respondeu". Não proponho:

- a granularidade de **dia** já responde tudo que a tela precisa: hoje,
  melhor dia, total, gráfico semanal;
- `ultima_repeticao_em` cobre o intervalo mínimo;
- uma linha por clique num contador de anos é a única tabela deste
  projeto que cresceria sem limite.

Se um dia o gráfico pedir a hora, a tabela nasce então — e o `SUM`
continua funcionando enquanto isso.

---

## 5. Como os cartões vão ser

### 5.1 A BARRA SEGMENTADA — e o problema dos 100 pulinhos

O Arquiteto aprovou a ideia e já apontou o caso difícil: *"se eu
precisar das 100 pulinhos eu posso ter uma barra dividida em 100
barrinhas"*.

Pode — e é aí que ela quebra. A conta:

| alvo | segmento numa barra de 300px | leitura |
|---|---|---|
| 5 | 56px | ótima |
| 12 | 22px | boa |
| 20 | 13px | no limite |
| 50 | 4px | ruído |
| 100 | 1px | uma linha pontilhada |

**Regra que proponho, em três faixas:**

```
alvo ≤ 20     uma barrinha por repetição
alvo > 20     agrupa em DEZENAS: 100 vira 10 blocos de 10,
              e cada bloco enche por dentro conforme avança
alvo > 200    barra contínua e o número — segmentar deixou
              de informar
```

O agrupamento em dezenas é o que salva os 100 pulinhos: dez blocos
legíveis, o sétimo enchendo pela metade, e a leitura *"estou no
setenta e poucos"* sem contar nada. É como a mente já conta coisas
grandes.

A máquina é a mesma da moldura do protocolo — `pathLength="100"` com
`stroke-dasharray` —, então segmentar em 5, em 10 ou em 20 é o mesmo
código com um número diferente. E funciona em qualquer largura de
cartão, que era o motivo de existir do `pathLength`.

**A borda** continua sendo a do protocolo: no META ela acompanha a
barra (mesmo número de arcos), e no LIVRE ela é contínua com um pulso
a cada clique — não há fim, há atividade.

### 5.2 O corpo

**META** — *"Responder {n} questões de História"*

```
┌─ ▰▰▰▱▱ ──────────────────────── borda em 5 arcos, 3 acesos
│  Responder 5 questões de História
│  [ALTA] [B-Rank] [ESTUDO]  ⧗ Prazo 4h12m
│  ███████████░░░░░░░  3 / 5
│                          [ − ]  [ + ]  [editar] [excluir]
└─
```

A barra é a `.mc-prot` que já existe — calha, aura vazando, cabeça de
luz, lustro. Muda só o que a preenche: tempo lá, contagem aqui.

**LIVRE (Bônus)** — *"Questões de Português"*

```
┌─ ~~~~~~ ────────────────────── borda contínua, pulsa a cada clique
│  Questões de Português                          ⟲ BÔNUS
│  [MEDIA] [ESTUDO]  ⧗ até 23:59
│
│      ╭───────────────╮
│      │      87       │        a CAIXA. O número, e nada mais.
│      │   questões    │
│      ╰───────────────╯
│                        [ − ]  [ + ]  [Concluir]
└─
```

**A barra saiu, e o Arquiteto está certo.** Eu havia proposto uma
barra medindo o teto de XP do dia. Achei elegante; é confusa.

O motivo, agora que eu penso nele com cuidado: **numa barra, o hunter
lê "progresso da tarefa".** Toda outra barra do app significa isso —
o prazo do cartão comum, a vigília do protocolo, o XP do banner. Uma
barra que de repente mede *quanto do teto de recompensa já foi pago*
usa a mesma forma para dizer outra coisa. Isso não é uma barra
diferente, é uma **mentira de vocabulário** — e o hunter não tem como
adivinhar qual das duas está olhando.

E há o pior: uma barra cheia lê como *"terminei"*. Num contador que
não termina, ela diria exatamente o oposto do que é verdade.

**No lugar dela, a caixa.** O número grande, com a unidade embaixo
("87 · questões"). Sem barra, sem meta implícita, sem fim sugerido. O
número é a recompensa — a tela precisa dizer só isso, e dizer bonito.

**E o teto de XP?** Vira uma nota discreta, não uma forma:
*"+30 XP hoje · teto atingido"* em texto pequeno sob a caixa, e só
quando o teto é atingido. Antes disso, `+30 XP` e ponto. O aviso
aparece no momento em que ele passa a importar, e some do resto do
tempo.

### 5.3 O botão

O `+` é a ação frequente; tudo o mais é raro. Então **o `+` é o botão
principal**, grande, com o número dentro. O `−` fica menor ao lado,
sem confirmação — desfazer tem que ser mais barato que errar.

Com `intervalo_min_seg`, o `+` fica visível e desabilitado com o tempo
que falta: *"+ (2m14s)"*. Não é antifraude, é atrito onde o hábito
pede atrito, e é opcional porque "entregar cerveja no balcão" não quer
nenhum.

### 5.4 No compacto (o Extrato)

A coluna de ações do cartão compacto é estreita — hoje leva Iniciar +
editar + excluir. **Só o `+` com o número entra.** O `−` e o
`Concluir` ficam no cartão expandido. É a mesma lição da barra do
protocolo: o compacto mostra o que se faz todo dia, não o que se faz
uma vez.

### 5.5 Ao fracassar

O cartão FRACASSADA mostra **"3 de 5"**. O hunter fez três; apagar
isso é mentir por omissão. E os três arcos acesos ficam — apagados de
cor, acesos de forma.

---

## 6. Como entra no lançador

O lançador tem 16 blocos hoje e já esconde/mostra por natureza (o
bloco `fm-bloco-natureza` só aparece para quem pode criar passivas).

**Um bloco novo, `fm-bloco-repeticao`, visível só quando a natureza é
REPETICAO:**

```
  MODO      ( • Meta )  ( ○ Livre )        dois cartões, como as naturezas

  ── se META ──────────────────────────────────
  Quantas vezes?   [  5  ]
  Título           Responder {n} questões de História
                   ↳ prévia: "Responder 5 questões de História"

  ── se LIVRE ─────────────────────────────────
  XP por repetição [  1  ]   máx 3 (Balança)
                   ↳ até 30 XP por dia neste contador

  ── ambos ────────────────────────────────────
  Contador    ( Fazer questões · 412 )  ▾     ← §3 sugere sozinho
              ( + criar novo )
              ( — nenhum )
```

**Três decisões de lançador que eu tomaria:**

**A prévia do título resolvido é obrigatória.** O `{n}` é a primeira
sintaxe que este app pede ao hunter. Sem ver o resultado, ele não
confia — e com razão. A prévia atualiza a cada tecla.

**O `{n}` é opcional.** Quem não usar escreve o número na mão e o
Sistema não reclama. A variável é um ganho para quem muda o alvo
depois, não um imposto para quem nunca vai mudar.

**A sugestão de contador vem ANTES da lista.** Se o lançador achou
"Fazer questões" pelo título, ele aparece já escolhido, com um "não, é
outro" ao lado. Escolher de uma lista de trinta contadores é trabalho;
confirmar uma sugestão é um olhar.

---

## 7. A tela do contador

O contador acumula para sempre — e um número que só existe no banco
não vale nada. Esta tela é o que faz o registro ser um registro:

```
   FAZER QUESTÕES                    ╭─────────────╮
                                     │     412     │
                                     │  questões   │
                                     ╰─────────────╯

   hoje          7          ▁▃▂▅█▃▁ (últimos 30 dias)
   melhor dia   23
   média/dia   4,6
   desde     12/03/2026

   alimentado por 3 rotinas:
     · Responder 5 questões de História      meta ·  180
     · Questões de Português                 livre ·  198
     · Simulado de fim de semana (arquivada) meta ·   34
```

A última seção é o que fecha o desenho: **o contador mostra de onde
cada número veio.** É isso que faz "412" ser um fato e não um placar
de videogame.

E é aqui que a resposta a *"quantas eu realmente fiz?"* — a pergunta
que originou tudo isto — finalmente cabe na tela.

---

## 8. Ordem de trabalho

| # | Passo | Por quê aqui |
|---|---|---|
| 1 | Balança: `xp_por_repeticao_max`, `xp_repeticao_teto_dia` | **antes de qualquer XP correr** (§1) |
| 2 | `especiais.py`: `REPETICAO` no catálogo | só o `normalizar()`; **sem porta de permissão** |
| 3 | Tabela `contadores` + 6 colunas + migração | `motors/migracao.py`, agnóstico de banco |
| 4 | `POST /execucoes/repetir` · `/desfazer` | o teto e o intervalo moram aqui, não no cliente |
| 5 | Cartão: barra segmentada, caixa do bônus, botões | reaproveita `.mc-vigia` e `.mc-prot` |
| 6 | Lançador: modo, alvo, `{n}`, contador | §6 |
| 7 | Tela do contador | §7 |
| 8 | Forja: quatro amostras | meta 0/5, meta 3/5, meta cumprida, bônus em 87 |

Sem o premium, o passo 2 encolheu de "quatro portas de permissão"
para uma linha no catálogo, e o passo 7 deixou de ser requisito de
negócio para ser o que sempre foi: a tela que dá sentido ao contador.

O passo 1 continua antes de tudo, e **isso não mudou com a saída do
premium**: o vazamento de XP é do mecanismo, não da cobrança. Sem os
dois tetos, o primeiro teste do passo 4 já cria XP de verdade num
contador sem limite.

---

## 9. As perguntas, respondidas

**O teto é por contador.** Global faria categorias diferentes
disputarem o mesmo orçamento (§1).

**META conta para o streak e pune; BÔNUS não** (§2).

**Contador é por hunter** — e o código não assume isso, por
disciplina de consulta, não por coluna (Apêndice B).

**Premium fica para depois** (Apêndice A).

Nenhuma pergunta em aberto no caminho crítico.

---

## 10. Ressalva

Sem navegador: a parte visual é raciocínio sobre o CSS que já existe,
não sobre o renderizado. E a borda segmentada de §5.1 é a única peça
deste plano que eu não consigo avaliar sem ver — cinco arcos podem
ficar elegantes ou parecer uma linha pontilhada quebrada. É o primeiro
lugar onde eu pediria seu olho.


---

# Apêndice A — quando existir cobrança

> **Fora do caminho crítico.** Registrado para não se perder, não
> para ser construído agora.

O candidato natural a premium é o **acúmulo através do tempo** — a
soma histórica do contador. É o que nenhum concorrente entrega, e é
a única parte que não faz falta no dia a dia: a contagem do dia, o
`+`, o XP e a missão continuam funcionando sem ela.

Se um dia for por aí, três coisas precisam de resposta, e a segunda
é uma armadilha que este projeto já pisou:

**1. O que congela.** Só a soma histórica. Uma coluna
`congelado_em` no contador e uma condição na consulta —
`ed.data < c.congelado_em`. Filtra na leitura, não apaga na
escrita.

**2. Editar missão que aponta para um contador travado.** O
lançador abre, o campo não tem mais aquele valor na lista, o hunter
salva, e **a rotina é silenciosamente desligada do contador**.
Ninguém clicou em nada. É o mesmo mecanismo do `pode_balancear`:
um valor ausente lido como decisão.

A regra, e ela vale para o app inteiro mesmo sem premium: **o
lançador nunca pode perder um vínculo que ele não conseguiu
mostrar.**

**3. A volta.** Como o congelamento filtra na leitura, as execuções
continuam sendo gravadas — o cartão precisa da contagem do dia de
qualquer jeito. Quando o hunter voltasse, a soma recuperaria tudo,
inclusive o período fora:

> *"Bem-vindo de volta. Enquanto você esteve fora, anotei mais 340
> questões."*

Custa o mesmo que a alternativa punitiva. O princípio: **o dado é do
hunter, não do plano** — a assinatura compraria a soma, não o
registro.

---

# Apêndice B — a porta da guilda, que custa zero

> **Fora do caminho crítico.** O Arquiteto disse que guilda virá.
> Não construo agora; só não fecho a porta.

**Uma disciplina, nenhuma coluna:** somar sempre por `contador_id`
e nada mais.

```sql
-- assim, e o dia da guilda é só deixar mais rotinas apontarem
WHERE contador_id = :id

-- assim NÃO: amarra o total a uma pessoa para sempre
WHERE contador_id = :id AND usuario_id = :eu
```

Se toda consulta somar assim, um contador de guilda funciona **sem
uma linha de mudança na soma**: basta rotinas de vários hunters
apontarem para ele. A query já estaria pronta; faltaria só quem pode
apontar.

Eu havia proposto uma coluna `escopo` de reserva. **Tirei** — coluna
sem lógica atrás é palpite gravado no esquema, e adicionar depois
custa pouco neste projeto.

O que eu NÃO faria nem então, de saída: tabela de guilda,
permissões, o que acontece quando alguém sai. Cada uma é decisão de
produto que ainda não existe.

**A pergunta que a guilda vai fazer primeiro**, anotada: um contador
de guilda paga 30 XP/dia **para o contador** ou **para cada
membro**? É decisão de economia inteira, não detalhe.
