# O Dashboard — análise

> Nada foi implementado. Todos os números foram medidos no código.

---

## 1. O que está lá hoje

| Bloco | Fonte | Situação |
|---|---|---|
| Placa do Sistema (data, sussurro, chip de dungeon) | local + `/dungeons/` | ok |
| Banner V4 (peça) | `/auth/me` + relíquias | ok, recém-refeito |
| Extrato de Missões + 5 filtros | `/extrato/` + `/extrato/resumo` | **é o coração da página** |
| 3 placas: Missões Hoje · Total Concluídas · Rotinas Ativas | `/dashboard/stats` | **problema — §2** |
| Gráfico de XP, 7 dias | `/dashboard/stats` | incompleto — §3 |
| Conquistas recentes | `/conquistas/` | ok |

---

## 2. As três placas: o problema não é serem inúteis, é serem de OUTRA VERDADE

Respondendo à pergunta direta — **não, o placar de "Missões Hoje" não é
necessário como está.** Mas o motivo é pior do que redundância.

**A página inteira lê `ExecucaoDia` + `TarefaDia`. As três placas leem
`Execucao`** — a tabela legada, que é o *livro-caixa de XP*, escrita só
pelo `aplicar_xp`.

As consequências são todas verificáveis:

- **Missão fracassada não conta.** O fracasso não passa por `aplicar_xp`
  (ver `motors/fechamento.py:192`), então some da placa. Um dia em que
  você falhou em tudo mostra o mesmo número de um dia em que não havia
  nada marcado.
- **Clear de dungeon conta como "missão".** Chama `aplicar_xp` igual.
  O rótulo diz uma coisa e o número conta outra — e foi por aí que o
  seu "XP disparou no gráfico".
- **"Total Concluídas" cresce para sempre.** Só sobe, nunca informa.

E o mais caro: **duas fontes para a mesma pergunta.** É o padrão que este
projeto já pagou três vezes — auras duplicadas, dois relógios, duas
tabelas de recompensa. A correção foi sempre fonte única.

### O que já existe e ninguém mostra

`/extrato/resumo` **já calcula**, e melhor:

```
contagem: CONCLUIDA · FRACASSADA · PENDENTE · ATIVA · CANCELADA
xp_ganho · xp_perdido · taxa_sucesso
```

Ou seja: as placas são ao mesmo tempo **menos exatas** e **mais pobres**
que um dado que o servidor já devolve.

### Uma observação sobre "Missões Hoje" como métrica

Às 08:29 ela é **sempre zero**. Você abre o painel e a primeira coisa que
o Sistema diz é um zero vermelho. Isso não mede nada — mede a hora do
dia. Um painel diário deveria abrir dizendo o que **falta**, não o que
ainda não aconteceu.

**Sugestão:** trocar as três por três que respondem perguntas de hoje:

| Em vez de | Colocar | Por quê |
|---|---|---|
| Missões Hoje | **Hoje: 3 / 7** | progresso tem denominador; contagem não |
| Total Concluídas | **Taxa de acerto: 82%** | já calculada, e é a métrica honesta |
| Rotinas Ativas | **Streak: 13 · recorde 21** | `streak_max` existe no banco e **não aparece em lugar nenhum** do app, exceto no perfil público |

---

## 3. O gráfico de XP mente por omissão

Ele desenha só o **ganho**. O app pune — prazo vencido cobra
`penalidade_xp`, e o `/extrato/resumo` devolve `xp_perdido` — e nada
disso aparece.

Um sistema que tira XP e mostra um gráfico que só sobe está escondendo
metade da própria mecânica.

**Sugestão:** barras para cima (ganho) e para baixo (perdido), com a
linha do zero visível. No tema do projeto isso é dramático de graça: os
dias ruins *afundam*. E é a mesma chamada de API.

Segundo ponto: são **7 dias fixos**, enquanto o Extrato logo acima tem um
filtro de período com 5 opções. O gráfico deveria obedecer ao mesmo
filtro — hoje ele ignora a escolha que o hunter acabou de fazer.

---

## 4. O que falta, e o app JÁ SABE

Ordenado por valor sobre custo. Tudo abaixo usa dado que já existe no
banco ou já é calculado por algum endpoint.

### 4.1 "O que vem agora" — a maior lacuna

`motors/prazos.py` calcula, para cada missão: quando abre, quando vence,
quanto falta, se já venceu. **Nada disso vira uma resposta na tela.** Para
saber o que está prestes a vencer, você precisa varrer o extrato com o
olho.

Uma faixa com as próximas 3 janelas — *"Banho Revigorante abre em 2h14"*,
*"Ler 10 páginas vence em 40min"* — é a coisa mais acionável que um
painel diário pode ter, e o motor já está pronto.

### 4.2 Mapa de calor do ano

`/perfil/` já devolve `heatmap`: um ano de atividade, dia a dia. Está
enterrado no Perfil.

É o melhor visual de **constância** que existe, e é o único que dá
sentido visual ao streak — você vê o buraco onde parou.

### 4.3 Onde o XP nasce (categorias)

`Rotina.categoria` tem seis valores (Saúde, Trabalho, Estudo, Casa,
Pessoal, Combate) e o `radar_habilidades` do Perfil já os agrega.

No Dashboard, isso responde uma pergunta que nenhum outro número
responde: **"estou negligenciando alguma área?"**. Um anel ou barras
horizontais bastam.

Ressalva honesta: o radar de hoje conta **execuções**, não XP, e carrega
todas as execuções para a memória para filtrar em Python
(`routers/perfil.py:245`). Se virar peça do Dashboard, vale reescrever
como `GROUP BY`.

### 4.4 As mecânicas novas são invisíveis

Foram construídas e não têm nenhuma superfície no painel:

- **Reerguer** — `reerguida`, `reerguida_em`. Quantas vezes você pagou
  Mana para salvar uma missão? Ninguém sabe.
- **Confissão** — `confessada_em`. Idem.
- **Passivas** — `natureza = PASSIVA`. Uma missão que roda sozinha das
  16h às 05h não tem lugar no painel; ela se perde no meio do extrato.

A passiva é a mais gritante: ela é **premium** e é a que menos aparece.

### 4.5 Dificuldade e prioridade

`FACIL | NORMAL | DIFICIL | LENDARIO` e `CRITICA | ALTA | MEDIA | BAIXA`
existem em toda rotina e **não aparecem em nenhum agregado**. "Você só
cumpre as fáceis" é uma verdade que o banco sabe e o painel cala.

---

## 5. O que eu NÃO recomendo

- **Mais contadores acumulados.** "Total de tudo desde sempre" só sobe.
  Um número que nunca desce não informa — decora.
- **Gráfico de pizza de status.** O extrato já mostra status por cartão,
  com cor. Repetir em pizza é ocupar espaço para dizer o mesmo.
- **Ranking entre hunters no Dashboard.** Existe `hunter-publico` para
  isso. O painel é sobre você; comparação é outra tela e outra intenção.

---

## 6. A ordem que eu proporia

**Primeiro, sem nada de novo na tela:**

1. **Unificar a fonte.** As três placas passam a ler `/extrato/resumo`.
   Sem isso, cada gráfico novo dobra o risco de divergência — e o
   Dashboard já tem duas verdades brigando.

**Depois, do mais acionável para o mais bonito:**

2. "O que vem agora" (usa `motors/prazos.py`, já pronto)
3. Gráfico de XP com ganho **e** perda, obedecendo ao filtro de período
4. Streak com recorde (`streak_max`, hoje invisível)
5. Mapa de calor do ano (já calculado em `/perfil/`)
6. Categorias (revisar a consulta antes)
7. Visibilidade de reerguer / confissão / passivas

**O passo 1 é o que decide.** Se as placas passarem a bater com o extrato
sem contorção, a base está certa para o resto.

---

## 7. Ressalva

Não tenho navegador. Tudo aqui é leitura de código e aritmética — quanto
cada coisa **pesa na tela** é você quem julga. E há uma pergunta que a
análise não responde e só você pode: **o Dashboard é para revisar o
passado ou para agir no presente?** Quase tudo que sugiro acima empurra
para o segundo. Se a intenção for a primeira, a lista muda de ordem.
