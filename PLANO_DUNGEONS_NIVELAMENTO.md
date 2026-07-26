# Plano — Nivelar as Dungeons ao resto do projeto

> Documento de planejamento. **Nada foi implementado.**
> Todos os números abaixo foram medidos no código atual, não estimados.
> A porta de entrada (Dashboard, Extrato, Lançador) vem primeiro; isto é o
> mapa do que fazer quando chegar a vez das dungeons.

---

## 1. O diagnóstico em uma frase

**As dungeons são um segundo aplicativo dentro do aplicativo.**

Elas foram construídas antes de todos os motores que hoje sustentam o resto —
`tempo`, `prazos`, `economia`, `celebracao`, `especiais` — e não voltaram para
buscá-los. O resultado, medido:

| Motor | Rotinas e Missões | Dungeons |
|---|---|---|
| `motors/tempo` (fuso de Brasília) | ✅ | ✅ 15 usos |
| `motors/prazos` (janela, vencimento) | ✅ | ❌ **0** |
| `motors/economia` (tabela, teto, Balança) | ✅ | ❌ **0** |
| `motors/celebracao` (envelope `sr_eventos`) | ✅ | ❌ **0** |
| `motors/especiais` (permissão premium) | ✅ | ❌ **0** |
| `motors/fechamento` (materializar/fechar) | ✅ | ❌ **0** |

E no frontend:

| Componente | Resto do app | Dungeons |
|---|---|---|
| `MissaoCard` (o cartão único) | ✅ | ❌ **0 usos** — desenha cartão próprio |
| `Glifos` (o alfabeto SVG) | ✅ | ❌ **0 usos** |
| Emojis na interface | 0 | **~230 distintos** em `dungeons.js` |
| Aparece no Extrato | ✅ | ❌ **0** |

São **5.513 linhas** (1.603 no router + 3.910 no frontend) fora da corrente
principal, e **nenhum teste** — dos 21 arquivos `test_*.py`, nenhum cobre
dungeon (o `test_celebracao` só a cita de passagem).

Isto não é crítica ao que foi feito: as dungeons vieram primeiro e foram o
laboratório onde muita coisa boa nasceu. É a descrição do trabalho de trazê-las
para dentro.

---

## 2. MECÂNICA — o que mais importa

### 2.1 A economia solta (o que apareceu hoje)

Medido: `routers/dungeons.py` chama `motors/economia.py` **zero vezes**. Tem
tabela própria de multiplicadores, `xp_clear` digitado à mão por portão e
**nenhum teto**.

```
Sua rotina mais cara (Crítica + Lendária, topo da tabela) ......   188 XP
Um clear rank S no "Escritório de Programação" .................  2.500 XP
```

`500 (xp_clear) × 2.0 (rank S) × 2.5 (lendária) × 1.0 (clear S) = 2.500`

Treze rotinas do topo para igualar um clear. E a Balança que o Arquiteto edita
não alcança nada disso.

**O que fazer:** `xp_clear` e `moedas_clear` passam a sair de
`motors/economia.py`, com os multiplicadores virando parâmetros da Balança
(`mult_rank_dungeon`, `mult_clear_dungeon`). O `TETO_XP` passa a valer.
O Arquiteto edita numa tela só.

**Ponto de atenção:** isso muda o valor de dungeons que já existem. Precisa de
uma decisão consciente sobre o histórico — sugiro **não** reescrever o passado
(o mesmo princípio de "missão já criada mantém o que valia").

### 2.2 A natureza com colunas mortas

`DungeonMissao` tem `natureza` com 6 valores e **9 colunas anuláveis**, cada
uma servindo a uma natureza só:

```
dias_semana, hora_inicio, hora_limite  → só AGENDADA
intervalo_min                          → só PASSIVA
meta_minutos                           → só RESISTENCIA
janela_disparo_min/max, expira_em_min  → só EVENTO_ALEATORIO
```

A sétima natureza custaria mais três colunas mortas para as outras seis. É o
padrão que o `CONTRATO_MISSOES_ESPECIAIS` proíbe — e a prova de que ele estava
certo já estava aqui dentro.

**O que fazer:** um campo `config` em JSON com o que é específico da natureza,
e um registro em Python que sabe ler cada uma (`motors/dungeon_naturezas.py`),
igual ao `motors/loja_efeitos.py`. Natureza nova = uma entrada no registro,
zero coluna.

### 2.3 A janela de horário reimplementada

`DungeonMissao.hora_inicio` / `hora_limite` fazem exatamente o que
`motors/prazos.py` já resolve — inclusive a janela que atravessa a meia-noite,
que aqui provavelmente não funciona (não achei tratamento para isso).

**O que fazer:** `prazos.da_rotina` generalizado para aceitar qualquer objeto
com `hora_inicio`/`hora_fim`. Uma missão de dungeon agendada das 22:00 à 01:00
passa a funcionar de graça, e o cronômetro regressivo vem junto.

### 2.4 A celebração que não fala a língua do app

Zero usos de `motors/celebracao`. Ou seja: quando uma dungeon paga XP, o
frontend precisa adivinhar o que aconteceu olhando os campos da resposta.
**Foi exatamente esse "adivinhar" que causou o loop infinito de APIs** que
consertamos — a correção criou o envelope `sr_eventos` justamente para o
frontend nunca mais deduzir.

As dungeons ficaram de fora da correção. É um loop esperando para acontecer.

**O que fazer:** as 7 chamadas a `aplicar_xp` em `dungeons.py` passam por
`celebracao.anexar`, como todas as outras.

### 2.5 O modo teste é frágil por design

Verifiquei: `modo_teste` **funciona** — sessão em teste não credita. Mas é um
booleano na sessão, e nada impede o Arquiteto de fazer um clear real achando
que era ensaio. Foi o que aconteceu hoje.

**O que fazer:** o modo teste precisa ser **visível o tempo inteiro** dentro da
dungeon (faixa fixa, não um chip), e o relatório de saída deve dizer, em
destaque, "ENSAIO — nada foi creditado". Barato e evita a dúvida.

### 2.6 Sem rede: nenhum teste

21 arquivos de teste no projeto, **nenhum de dungeon**. É a área com a
mecânica mais complexa (ticks passivos, eventos aleatórios com janela, cálculo
de rank, penalidade de atraso) e a única sem verificação por execução.

**O que fazer:** um `test_dungeon.py` no mesmo formato dos outros — relógio na
mão, uma sessão inteira do check-in ao clear, com cada natureza de missão.
Isto vem **antes** de qualquer refatoração, não depois: sem ele, mexer nas
5.513 linhas é apostar.

---

## 3. VISUAL — trazer para a linguagem atual

### 3.1 O cartão — CORRIGIDO

> **Correção do Arquiteto (26/07).** Eu havia escrito aqui "a missão de dungeon
> vira um modo do MissaoCard". Fui olhar as 16 missões que existem hoje e a
> recomendação estava errada — pela metade. Metade delas **não é missão**.

**As seis naturezas, e o que cada uma pede da tela.** Exemplos reais do banco:

| Natureza | Exemplo real | O que ela é |
|---|---|---|
| `PADRAO` | ✅ Commit Limpo · 50xp | Missão comum. Você faz e marca. |
| `AGENDADA` | ⚔️ Pedido do hortifruti · janela 15:00–16:00 | Missão com janela — **é o Banho Revigorante dentro da dungeon** |
| `RESISTENCIA` | ⏳ Fluxo de Código Contínuo · meta 120min | Enche **sozinha, por presença**. Não tem botão. |
| `BEM_ESTAR` | 💧 Hidratação do Sistema · tick 45min | **Aparece** a cada 45min e precisa ser capturada |
| `EVENTO_ALEATORIO` | 💡 Epifania do Desenvolvedor · dispara 120–240min, **expira em 10** | **Surge** sem aviso e some se ignorada |
| `FLAVOR` | 👁 Sussurro do Sistema · **0xp**, expira em 2min | Ambiente puro. Não dá nada, não pede nada. |

**A linha que separa as duas famílias:**

> **Missão** — você é dona dela, ela espera por você.
> **Evento** — ele aparece, tem relógio curto e vai embora.

Isso muda a recomendação em três partes:

**(a) As três primeiras viram modos do `MissaoCard`** — e aí ganham de graça
tudo o que já construímos: cronômetro com segundos, prazo regressivo em
vermelho, corrente de energia, reconciliação sem piscar, responsivo por
container. A `AGENDADA` é o caso mais direto: `motors/prazos.py` já sabe
resolver janela de horário, inclusive a que cruza a meia-noite.

**(b) `BEM_ESTAR` e `EVENTO_ALEATORIO` NÃO são cartões de lista.** Um cartão
numa lista é algo que está lá, parado, esperando. Estes dois **irrompem** e
têm morte marcada — a Epifania vive 10 minutos, o Ataque de Procrastinação
vive 5. Enfileirá-los junto das missões comuns mata o que eles têm de bom: o
susto e a urgência.

O parentesco deles é com a **cerimônia de conquista** (`ConquistaFX`), não com
o cartão. Merecem uma camada própria — proposta: uma **Aparição**, que entra
por cima do interior, traz o próprio contador de expiração bem visível e some
sozinha. Se o hunter capturar, vira registro; se ignorar, o cartão **nunca
existiu numa lista**, só o histórico da sessão sabe que passou.

**(c) `FLAVOR` não deve ser cartão de jeito nenhum.** 0 XP, 2 minutos de vida,
nada a fazer. Transformar um sussurro em cartão com botão é erro de categoria.
Ele já tem o lugar certo no backend (`sussurro`, ~12% dos pulsos) e precisa só
de um lugar na tela — uma linha que aparece e se dissolve.

**O parentesco que vale registrar:** `RESISTENCIA` é a versão de dungeon da
**missão passiva** que acabamos de construir. Nas duas, o hunter vence
*permanecendo*, não agindo, e nas duas o cartão não tem botão de concluir. A
diferença é o sinal: a passiva vence se você **não quebrar**; a resistência
vence se você **acumular presença**. Quando as duas existirem, elas devem
parecer irmãs na tela — e provavelmente compartilhar o mesmo tratamento
visual de "vigília" (índigo, trama estática, sem corrente de energia).

**Consequência para o §4:** a fase "missão de dungeon vira modo do MissaoCard"
cobre só três naturezas. As outras três viram uma fase própria — a camada de
Aparições — que é trabalho de interface novo, não de reaproveitamento.

### 3.2 Os ~230 emojis

`dungeons.js` tem cerca de 230 emojis distintos — de 🍅 a 🧿. O resto do app
tem zero: usa o alfabeto de glifos SVG.

Aqui há uma nuance que muda a recomendação. A maior parte desses emojis é
**conteúdo**, não interface: são ícones que o Arquiteto escolhe para cada
dungeon e cada missão ("🍳 fritar", "🧹 limpar"). Substituir 230 por glifos
desenhados à mão é trabalho de meses e provavelmente perda — a variedade é o
que faz a dungeon parecer um lugar.

**O que fazer:** separar os dois usos.
- **Interface** (botões, estados, avisos, selos): vira glifo, sem exceção.
  São poucos e são os que destoam.
- **Conteúdo** (o ícone que identifica a dungeon e cada missão dela): continua
  emoji, mas dentro de uma moldura desenhada — como o sigilo do `MissaoCard`
  faz com a categoria. A moldura é do Sistema; o símbolo é do Arquiteto.

### 3.3 O interior

O interior é a tela mais "jogo" do app e a que menos se parece com ele.
Sugestões, em ordem de impacto por esforço:

1. **A barra de progresso vira o portal.** Hoje é uma barra; poderia ser o
   anel de runas que o `MissaoCard` já usa no sigilo, crescendo com o % de
   clear. Reaproveita o SVG que existe.
2. **O rank de saída merece cerimônia.** Um clear rank S usa a mesma
   transição de um rank D. O projeto já tem `ConquistaFX` e a cerimônia de
   insígnia — o clear S deveria pesar.
3. **Sussurros já existem e ninguém vê.** Há frases de ambiente no backend
   (`random.choice(frases)`, 12% de chance). Merecem lugar próprio na tela.
4. **Os dois `setInterval` do interior** já são limpos no `destruir()` —
   isto está certo, e é bom registrar que está.

### 3.4 A dungeon fora do Extrato

`routers/extrato.py` menciona dungeon **zero vezes**. Você acabou de dizer que
quer tudo no extrato para poder pesquisar — e a dungeon é hoje o maior gerador
de XP do sistema, invisível ali.

**O que fazer:** a sessão de dungeon vira uma linha do extrato com `uid`
`"d123"` — o formato já foi desenhado para receber uma terceira origem
(`CONTRATO_MISSOES_ESPECIAIS`, §3). As missões internas ficam de fora, ou o
extrato vira ruído; o que entra é a **sessão**: "Escritório de Programação —
clear rank B, 1.500 XP".

---

## 4. Ordem sugerida

| # | Fase | Por que nesta posição |
|---|---|---|
| 1 | **`test_dungeon.py`** | Rede antes de mexer em 5.513 linhas sem cobertura |
| 2 | **Envelope de celebração** | Fecha o risco de loop infinito que já nos mordeu |
| 3 | **Modo teste visível** | Barato, e evita repetir o susto de hoje |
| 4 | **Dungeon no Extrato** | Atende o pedido de "tudo no extrato"; usa `uid` que já existe |
| 5 | **Economia sob a Balança** | Corrige a desproporção 188 × 2.500 |
| 6 | **PADRAO / AGENDADA / RESISTENCIA viram modos do MissaoCard** | Herdam cronômetro, prazo, responsivo, tudo |
| 7 | **Camada de Aparições** (BEM_ESTAR, EVENTO_ALEATORIO) | Interface nova — não é reaproveitamento |
| 8 | **Sussurro ganha lugar próprio** (FLAVOR) | Uma linha que aparece e se dissolve |
| 9 | **Glifos na interface, moldura no conteúdo** | Fecha a identidade visual |
| 10 | **`natureza` → registro + JSON** | Refatoração estrutural, com teste já de pé |
| 11 | **Cerimônia do clear, portal** | O prazer, depois da fundação |

A fase 1 vem primeiro por um motivo que este projeto já ensinou várias vezes:
todo defeito sério que encontramos apareceu **executando**, não lendo. O
backfill que inventava derrotas, o cronômetro fantasma, os números congelados
do lançador, a tela da Balança inalcançável — nenhum foi visto na revisão.

---

## 5. O que NÃO fazer

- **Não reescrever `dungeons.py` do zero.** 1.603 linhas com mecânica sutil
  (ticks, eventos com janela, rank por percentual) e zero teste. Reescrita sem
  rede perde comportamento que ninguém lembra que existia.
- **Não trocar os 230 emojis de conteúdo por glifos.** Meses de trabalho para
  perder variedade. A moldura resolve com um centésimo do esforço.
- **Não mexer na economia antes da fase 1.** Mudar quanto uma dungeon paga sem
  teste é mudar o placar de todos os hunters no escuro.

---

## 6. Ressalva honesta

Não tenho navegador: a parte visual é análise de código e das capturas que
você enviou, não do resultado renderizado. As sugestões do §3.3 (portal,
cerimônia, sussurros) são propostas de produto — valem um protótipo na Forja
de Testes antes de virarem tarefa.
