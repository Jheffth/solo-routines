# Avaliação — Missões Especiais (booleanas, em cadeia, destravadas por relíquia)

**Pergunta do Arquiteto:** "não sei se já vale a pena deixar algo planejado e
pré-construído para receber missões especiais. Avalie e me diga."

**Resposta curta:** vale planejar, **não** vale pré-construir. Mas existe **uma**
decisão que precisa ser tomada agora, antes do próximo lançador, porque tomá-la
depois custa dez vezes mais. Ela está na seção 3.

---

## 1. As duas ideias são a mesma coisa

O Caldeirão do Alquimista e a Missão em Cadeia parecem features diferentes. Não são.

**Booleana:**
`Verificar estoque de mamão` → Sim → nasce `Comer mamão (+15 XP)`
                             → Não → nasce `Abastecer mercearia (+25 XP)`

**Cadeia:**
`Missões pós-trabalho` → `Jantar` → `Escovar os dentes` → `Tomar banho`

Nos dois casos a regra é idêntica: **uma missão, ao ser concluída de um certo
jeito, faz outra missão nascer.** A cadeia é o caso com uma saída só; a booleana
é o caso com duas saídas. O que muda é o número de arestas, não a natureza.

Isso é importante porque significa que **não são duas features para construir, é
uma.** E uma feature bem menor do que parece: não é "tipo de missão", é
**relação entre missões**.

O card principal que fica visível até a cadeia acabar também sai de graça daí:
"visível" é o pai que ainda tem filhos pendentes.

## 2. O risco real não é a feature — é onde ela vai morar

Hoje o projeto tem **três tabelas paralelas de missão**:

| Tabela | Origem | O que é |
|---|---|---|
| `Rotina` + `ExecucaoDia` | `origem="rotina"` | a regra que repete, e a ocorrência do dia |
| `TarefaDia` | `origem="geral"` | missão avulsa, de uso único |
| `DungeonMissao` + `DungeonMissaoExecucao` | dungeon | missão dentro da instância |

Você disse que as especiais existirão "tanto no projeto normal quanto nas
dungeons". Se elas forem implementadas como **um novo tipo de missão**, elas
precisam ser implementadas **três vezes** — e depois mantidas em sincronia três
vezes, para sempre.

Esse é exatamente o padrão que já nos custou caro neste projeto: o catálogo de
auras duplicado, o relógio duplicado, a tabela de recompensa duplicada. Cada um
desses foi resolvido criando uma fonte única (`motors/cosmeticos.py`,
`motors/tempo.py`, `motors/economia.py`). O erro sempre foi o mesmo: deixar a
mesma verdade morar em dois lugares.

**E já temos a prova dentro de casa.** `DungeonMissao` tem uma coluna `natureza`
com seis valores (`PADRAO | AGENDADA | RESISTENCIA | EVENTO_ALEATORIO |
BEM_ESTAR | FLAVOR`) e, junto, seis colunas anuláveis que só servem a uma
natureza cada: `intervalo_min` (só PASSIVA), `meta_minutos` (só RESISTENCIA),
`janela_disparo_min`/`max` e `expira_em_min` (só EVENTO_ALEATORIO). Ou seja: a
estratégia "cada missão especial ganha suas colunas" já foi tentada uma vez
neste código. O resultado é uma tabela larga onde a maioria das colunas está
nula na maioria das linhas, e onde adicionar a sétima natureza significa
adicionar mais três colunas mortas para todas as outras seis.

Repetir isso para booleanas e cadeias custaria, no mínimo: `pai_id`,
`condicao`, `ordem`, `oculta_ate`, `ramo` — cinco colunas nulas em ~99% das
linhas, **em três tabelas diferentes**.

## 3. A única decisão que precisa ser tomada agora

> **Missão especial não é um quarto tipo de missão. É uma ARESTA entre missões
> que já existem.**

Concretamente: uma tabela nova, pequena, que não pertence a nenhuma das três —
ela apenas aponta para elas, do mesmo jeito que o extrato já faz com `uid`.

```
vinculo_missao
--------------
id
usuario_id
pai_uid       "r123" | "g45" | "d78"    ← o mesmo formato que o extrato já usa
filho_uid     idem, OU um molde a materializar
condicao      "SEMPRE" | "SIM" | "NAO"  ← booleana usa SIM/NAO; cadeia usa SEMPRE
ordem         posição na cadeia
```

Por que isso é a decisão certa e barata:

- **Não toca nenhuma das três tabelas.** Zero migração destrutiva, zero coluna
  nula, zero risco de divergência entre rotina/geral/dungeon.
- **Funciona nos três mundos de imediato**, porque `uid` já é o endereço
  universal de missão neste sistema — `routers/extrato.py` foi construído
  justamente assim ("como os dois IDs vêm de sequências diferentes, um `uid` dá
  ao frontend uma chave estável"). Basta ele aceitar um terceiro prefixo.
- **Uma missão pode ser especial sem nascer especial.** Você pode encadear duas
  missões que já existem, sem convertê-las em nada.
- **Se você desistir da ideia, apaga uma tabela.** Nenhum código de missão
  normal terá sido contaminado.

Isso é uma decisão de arquitetura, não uma implementação. Custo hoje: zero linha
de código. Custo se a decisão vier depois de o lançador aprender a criar
"missões booleanas": refazer o lançador, o card e o extrato.

## 4. O que NÃO vale pré-construir agora

Sou contra criar a tabela agora, e a razão é a que já nos mordeu neste projeto:
**estrutura construída sem uso concreto é estrutura não verificada.** O backfill
de 30 dias que inventou fracassos e o cronômetro fantasma foram os dois casos —
código escrito para um cenário imaginado, que só mostrou o defeito quando
encontrou a realidade.

Especificamente, ficam de fora por enquanto:

- **A tabela `vinculo_missao`.** Criar sem ninguém escrever nela é migração
  parada num banco de produção.
- **O Altar como loadout de 3 slots.** Atenção a isto: hoje o Altar é uma
  **vitrine** — `altar-reliquias.js` só escolhe 5 relíquias para *exibir* no
  perfil. Transformá-lo em equipamento que *concede poder* muda a natureza dele
  e cria uma pergunta de economia que ainda não tem resposta: se a Lâmina do
  Espartano destrava missões que dão XP, então **equipar vira fonte de renda**,
  e o teto de XP que acabamos de proteger contra o exploit passa a depender de
  quantas relíquias o hunter tem. Isso precisa ser decidido antes de existir, não
  depois.
- **O motor de condição.** "Sim/Não" hoje, mas seu próprio exemplo já sugere
  mais ("adiciona à Lista de Compras" é um efeito colateral, não uma resposta).
  Desenhar a linguagem de condição antes de ter três exemplos reais é como
  desenhar a tabela de economia antes de saber quais missões existem — nós
  tentamos, e ela precisou ir para o banco para poder ser corrigida.

## 5. Ordem que eu recomendo — o caminho concreto

Isto entrega o Épico 1 do seu COO. A única diferença é que ele ganha um ponto de
verificação no meio, em vez de ser um bloco só.

1. **Agora (custo zero):** ficar com a decisão da seção 3 registrada — especial é
   aresta, não tipo. Nada é construído.
2. **No próximo lançador:** ao criar a modalidade Personalizada, deixar o
   `uid` como o identificador que o lançador manuseia. Ele já vai precisar disso.
3. **Quando a primeira cadeia real for pedida** (provavelmente "Missões
   pós-trabalho", que é concreta e você já descreveu): criar `vinculo_missao`
   com `condicao="SEMPRE"` apenas. Cadeia linear, sem ramo. Uma semana de
   trabalho, verificável por execução.
4. **Só então, a booleana:** ela é a mesma tabela com `condicao` em `SIM`/`NAO`.
   Se o passo 3 estiver certo, o 4 é quase de graça.
5. **Por último, o Altar como loadout** — depois de responder à pergunta de
   economia, e depois que existirem missões especiais para as relíquias
   destravarem. Destravar o vazio não tem graça.

## 6. Sobre o veredito do COO — concordo, com uma correção

O faseamento está certo: Casa de Trocas na Fase 2, foco no Épico 1. E "badge
comprada libera conteúdo, nunca multiplicador de XP" é a regra certa. **Só que
ela não fecha a porta que pretende fechar.**

Medido no código: `TETO_XP = 10_000` em `motors/economia.py` é teto **por
missão**, não por dia. **Não existe orçamento diário de XP neste sistema.**

Então: se o Caldeirão do Alquimista destrava missões que pagam 15 e 25 XP, quem
tem a relíquia ganha mais XP por dia do que quem não tem. Isso é um
multiplicador — só que indireto. A regra "libera conteúdo, não multiplica"
funciona em jogos que têm teto diário; aqui, conteúdo *é* multiplicador.

Duas formas de fechar de verdade (a segunda é melhor):

1. **Missão especial não paga XP.** Paga em Mana, item, ou avanço de cadeia.
   Barato, imediato, e mantém a promessa ao pé da letra.
2. **Teto diário de XP.** Aí conteúdo extra passa a *competir* pelo mesmo
   orçamento em vez de somar, e a promessa vira verdade estrutural.

Recomendo a **2 de qualquer jeito, independentemente das missões especiais** —
porque hoje nada impede um hunter de criar cinquenta missões triviais e subir de
nível com elas. Fechamos quatro portas do exploit (criar e editar × rotina e
tarefa); **esta é a quinta**, e é a única que sobrou aberta. Com Fragmentos do
Monarca à venda, um sistema sem teto diário é uma torneira.

**Sobre drop:** verifiquei — não existe sistema de drop nas dungeons ainda. O que
há em `routers/dungeons.py` é disparo de evento aleatório e frases de ambiente,
nada que caia no inventário. Quando existir, equipamento que aumenta *chance de
drop* é a forma **mais segura** de poder pago que já apareceu nesta conversa,
desde que o drop seja cosmético ou item — porque mexe na sorte, não no ganho, e
sorte não vira nível. Se o drop for XP ou Mana, é a mais perigosa de todas.
Concordo em deixar para depois; só registro que a escolha "o que cai" precisa
vir antes de "o que aumenta a chance".

## 7. Ressalva honesta

Não tenho navegador: nada aqui foi verificado visualmente, e esta avaliação é
sobre estrutura de dados e custo de manutenção, não sobre como a cadeia vai
*parecer* na tela. A pergunta de UX — como um card pai mostra três filhos
ocultos sem virar bagunça — continua aberta e é melhor respondida com um
protótipo na Forja de Testes do que com texto.
