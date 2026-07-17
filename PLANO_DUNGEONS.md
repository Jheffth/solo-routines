# 🏰 Plano de Implementação — Sistema de Dungeons

Referência técnica para implementar a aba **Dungeons** no Solo Routines.

> **v2** — revisado a pedido do usuário: Dungeon agora é um ambiente próprio e isolado (layout imersivo dedicado + missões exclusivas dela), não um agrupador de Rotinas/Tarefas existentes. Ver §2 para o que mudou da v1.

---

## 1. Conceito

Uma **Dungeon** é um ambiente fechado, com identidade visual e regras próprias, onde o hunter "entra" durante uma janela de tempo. Dentro dela existem **missões exclusivas daquela Dungeon** — nunca as Rotinas/Tarefas do mundo normal. Exemplo do usuário: Dungeon "Trabalho CLT", permanente, recorrente de segunda a sexta, `hora_entrada = 10:30`, `hora_saida = 18:30`. Se o hunter não fizer check-in até 10:30, sofre penalidade. Uma vez dentro, ele vê um layout dedicado — não a lista genérica de rotinas — com o quadro de missões daquela Dungeon.

**Regra de ouro (isolamento):** tudo que acontece dentro de uma Dungeon (entrar, cumprir missão, fracassar, sair) só pode alterar o **perfil do hunter** (XP, moedas, nível/rank, streak da própria Dungeon, conquistas). Nunca cria, edita, conclui ou fracassa uma Rotina/Tarefa do mundo externo, e o inverso também: nada fora da Dungeon interfere no que está dentro dela. São dois sistemas com o mesmo motor de XP por baixo, mas dados 100% separados.

Dois tipos de Dungeon:

| Tipo | Comportamento |
|---|---|
| **Permanente** | Recorrente (diária/semanal/mensal/anual) — mesma lógica de recorrência que `Rotina` já usa. Gera uma sessão nova todo dia em que é devida, para sempre. |
| **Temporária** | Ocorre uma vez, num intervalo `data_inicio` → `data_fim`. Depois disso é arquivada automaticamente. Ex.: "Viagem a trabalho", "Sprint de estudos de 3 dias". |

Ciclo de vida de uma sessão diária (mesmo princípio de máquina de estados que já existe em `ExecucaoDia`, aplicado à Dungeon inteira):

```
PENDENTE ──(entrar até hora_entrada)──> ATIVA ──(sair)──> CONCLUIDA
   │                                       │
   └──(prazo de entrada vence)──> FRACASSADA
                                          │
                              (usuário cancela) ──> CANCELADA
```

---

## 2. O que reaproveitar do projeto atual (motor e padrões, não os dados)

Analisei `webapp/backend` e `webapp/frontend`. **Mudança em relação à v1 deste plano:** antes eu recomendava dar às Rotinas/Tarefas um `dungeon_id` opcional para "morarem dentro" de uma Dungeon. Isso foi descartado — o usuário quer isolamento total. A Dungeon terá sua própria entidade de missão, sem tocar em `Rotina`/`TarefaDia`/`Execucao`/`ExecucaoDia`.

O que continua sendo reaproveitado, porque já está resolvido no projeto:

- **Padrão de máquina de estados** de `routers/rotinas.py` (`_obter_ou_criar_exec_dia`, `/iniciar`, `/fracassar`, `/cancelar`) — mesma lógica, aplicada a uma tabela nova.
- **`motors/gamificacao.py::aplicar_xp`** — motor único que credita XP/moedas/streak/level-up no `Usuario`. Toda recompensa de Dungeon passa por aqui, é o único ponto de contato entre a Dungeon e o perfil do hunter.
- **Sistema de janelas arrastáveis** (`windows.css` + `drag-windows.js`) e o **Lançador** (`lancador.js`) como base de formulário, estendido com um novo tipo.
- **Canvas de partículas** (`app.js::_initParticulas`) e os tokens de tema (`design-system.css`) como base para a ambientação visual da Dungeon — mas com paleta própria por Dungeon (ver §6).

---

## 3. Modelo de dados (isolado)

### 3.1 `dungeons` — o template da Dungeon

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | PK | — |
| `titulo` | String(200) | Ex.: "Trabalho CLT" |
| `descricao` | Text | Opcional — vira o "lore" mostrado no layout interno |
| `tipo_permanencia` | String(20) | `PERMANENTE` \| `TEMPORARIA` |
| `tipo_recorrencia` | String(20) | `DIARIA`\|`SEMANAL`\|`MENSAL`\|`ANUAL` (só PERMANENTE) |
| `dias_semana` / `dia_mes` / `mes_dia` | Text(JSON) / Integer / String(5) | Mesma convenção de `Rotina` |
| `data_inicio` / `data_fim` | Date | Só TEMPORARIA |
| `hora_entrada` / `hora_saida` | String(5) | "HH:MM" |
| `tolerancia_min` | Integer | Minutos de graça antes da penalidade |
| `categoria` | String(50) | Trabalho, Saúde, Estudo, Casa, Pessoal, Combate — define o tema visual |
| `rank` | String(2) | E\|D\|C\|B\|A\|S — cosmético + multiplicador de recompensa, também define paleta/intensidade visual |
| `dificuldade` | String(20) | FACIL\|NORMAL\|DIFICIL\|LENDARIO |
| `icone` / `cor` | String | Visual do card na aba Dungeons |
| `tema_ambiente` | String(30) | Preset visual do interior (ver §6) — auto-sugerido pela categoria, editável |
| `xp_entrada` / `xp_clear` / `moedas_clear` | Integer | Recompensas base |
| `penalidade_entrada_xp` / `penalidade_atraso_xp` | Integer | Penalidades |
| `streak_atual` / `streak_max` | Integer | Streak **próprio** da Dungeon, independente do streak global |
| `status` | String(20) | `ATIVA`\|`PAUSADA`\|`ARQUIVADA` (do template) |
| `usuario_id` | FK → usuarios | — |
| `criado_em` | DateTime | — |

### 3.2 `dungeon_sessoes` — a instância do dia (equivalente ao `ExecucaoDia`, renomeado para deixar clara a diferença de escopo)

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | PK | — |
| `dungeon_id` | FK → dungeons | — |
| `usuario_id` | FK → usuarios | — |
| `data` | Date | Dia da sessão |
| `status` | String(20) | PENDENTE→ATIVA→CONCLUIDA\|FRACASSADA\|CANCELADA |
| `entrada_em` / `saida_em` / `fracassada_em` | DateTime | — |
| `atraso_minutos` | Integer | Calculado na entrada |
| `tempo_total_min` | Integer | Acumulado via heartbeat enquanto ATIVA (tempo real dentro da Dungeon) |
| `ultimo_heartbeat_em` | DateTime | Controle de sessão viva |
| `pct_missoes_concluidas` | Float | Snapshot na saída |
| `rank_obtido` | String(2) | S\|A\|B\|C\|D\|F — calculado na saída (pontualidade + missões cumpridas) |
| `xp_ganho` / `xp_perdido` / `moedas_ganhas` | Integer | Totais da sessão — únicos valores que tocam `Usuario` |
| `criado_em` | DateTime | — |

### 3.3 `dungeon_missoes` — missões exclusivas de uma Dungeon (o "quadro de missões" interno)

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | PK | — |
| `dungeon_id` | FK → dungeons | Vive só dentro dessa Dungeon |
| `titulo` / `descricao` / `icone` | String/Text | — |
| `tipo` | String(20) | `ATIVA` (ação manual, botão "Cumprir") \| `PASSIVA` (progride sozinha) |
| `natureza` | String(20) | `PADRAO` \| `RESISTENCIA` \| `EVENTO_ALEATORIO` \| `BEM_ESTAR` \| `FLAVOR` — ver §5 |
| `xp_recompensa` / `moedas_recompensa` | Integer | 0 para `FLAVOR` |
| `intervalo_min` | Integer | Para PASSIVA: a cada quantos minutos tickra/dispara |
| `meta_minutos` | Integer | Para `RESISTENCIA`: minutos totais até completar a barra |
| `janela_disparo_min` / `janela_disparo_max` | Integer | Para `EVENTO_ALEATORIO`: intervalo aleatório entre disparos |
| `expira_em_min` | Integer | Quanto tempo o evento fica disponível antes de sumir (sem punição) |
| `ativo` | Boolean | — |
| `criado_em` | DateTime | — |

### 3.4 `dungeon_missao_execucoes` — instância de uma missão dentro de uma sessão

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | PK | — |
| `dungeon_missao_id` | FK → dungeon_missoes | — |
| `dungeon_sessao_id` | FK → dungeon_sessoes | — |
| `status` | String(20) | `PENDENTE`\|`EM_PROGRESSO`\|`CONCLUIDA`\|`EXPIRADA` |
| `progresso_pct` | Float | Para missões de resistência |
| `disparada_em` | DateTime | Quando um evento aleatório surgiu |
| `concluida_em` | DateTime | — |
| `xp_ganho` / `moedas_ganhas` | Integer | — |
| `criado_em` | DateTime | — |

### 3.5 Migração

`migrar_dungeons.py` (mesmo padrão defensivo de `migrar_inviolavel.py`) cria as 4 tabelas novas via `criar_tabelas()`. **Nenhuma alteração em `rotinas`/`tarefas_dia`** — é o ponto central da v2: zero acoplamento com as tabelas existentes.

---

## 4. Regras de gamificação e isolamento

| Evento | Efeito no perfil (`Usuario`) | Efeito fora da Dungeon |
|---|---|---|
| Check-in pontual | `+xp_entrada`, `streak_atual` da Dungeon +1 | Nenhum |
| Check-in atrasado (dentro da tolerância) | XP reduzido, `-penalidade_atraso_xp` | Nenhum |
| Não fez check-in a tempo | `-penalidade_entrada_xp`, `streak_atual` da Dungeon zera | Nenhum |
| Missão ativa cumprida | `+xp_recompensa`/`+moedas_recompensa` da missão | Nenhum |
| Missão de resistência completa 100% | Bônus de XP no marco final | Nenhum |
| Evento aleatório capturado a tempo | XP pequeno (recompensa de "sorte") | Nenhum |
| Evento aleatório ignorado/expirado | Nada — sem punição, é opcional por design | Nenhum |
| Saída (check-out) | Calcula `rank_obtido` (pontualidade + `pct_missoes_concluidas`), credita `xp_clear`/`moedas_clear` proporcional ao rank | Nenhum |
| Qualquer XP/moeda creditado | Sempre via `aplicar_xp()` — único canal de saída da Dungeon para o resto do sistema | — |

Faixas de rank de clear sugeridas (ajustável): ≥90% das missões = **S**, ≥70% = **A**, ≥50% = **B**, ≥30% = **C**, abaixo disso = **D**; se fracassou a entrada, sessão fecha direto em **F** sem cálculo de missões.

---

## 5. Missões passivas e criativas — o que torna a Dungeon viva

Este é o diferencial pedido: a Dungeon não pode ser só uma lista de checkboxes. Proposta de "naturezas" de missão:

- **`RESISTENCIA` (passiva contínua):** uma barra que enche sozinha enquanto o hunter está com check-in ativo, alimentada pelo heartbeat (ex.: "Fluxo Contínuo" — cada 30 min dentro da Dungeon acrescenta XP; ao completar `meta_minutos`, dá um bônus final). Simula "XP por presença", sem exigir nenhuma ação.
- **`EVENTO_ALEATORIO` (passiva de surpresa):** em intervalos aleatórios (`janela_disparo_min`/`max`), surge um evento temático — "⚡ Um Slime de Procrastinação apareceu! Resistiu?", "🌪️ Rajada de foco: complete algo nos próximos 5 min" — que aparece como toast dentro do layout, vale XP pequeno se capturado, some sem punição se ignorado (`expira_em_min`). Dá imprevisibilidade e leveza, sem estresse extra.
- **`BEM_ESTAR` (passiva/gatilho):** lembretes ambientados que aparecem periodicamente e valem um "reconhecimento" de um clique — beber água, alongar, respirar fundo, piscar/descansar a vista. Pensado especificamente para Dungeons tipo "Trabalho", onde o usuário passa horas seguidas.
- **`FLAVOR` (sem XP, pura imersão):** "sussurros do sistema" — mensagens estilo Solo Leveling que aparecem de vez em quando ("Você sente a pressão da masmorra ao seu redor...", "A entidade observa seu progresso.") só para ambientação, reforçando que aquele espaço é diferente do resto do app.
- **`PADRAO` (ativa):** a missão "comum" — título, XP, botão "Cumprir" — para quem quer só listar tarefas do contexto sem toda a camada passiva.

O usuário pode misturar os tipos livremente numa mesma Dungeon: ex. "Trabalho CLT" com 3 missões PADRAO (entregar relatório, reunião, revisar e-mails), 1 RESISTENCIA (XP por hora de foco), 2 BEM_ESTAR (água, alongamento) e eventos aleatórios ligados.

---

## 6. A Dungeon Interior — layout próprio e imersivo

Ao clicar **Entrar** num card da aba Dungeons, o app não abre "mais uma página" do padrão atual — ele transiciona para um **modo dedicado de tela cheia**, com identidade visual própria por Dungeon.

**Arquivos novos:** `js/pages/dungeon-interior.js` + `css/dungeon.css` (não reaproveita `pages.css` genérico — merece sua própria folha de estilo).

**Transição de entrada:** animação de "portal" — um anel de energia se expande a partir do card clicado, a tela escurece com um brilho na cor do rank, fade para o layout interno (CSS keyframes puros, sem lib externa).

**Tema visual dinâmico**, combinando `categoria` + `rank`:

| Categoria | Paleta sugerida | Sensação |
|---|---|---|
| Trabalho | Azul elétrico + cinza-grafite | Ambiente "corporativo cyberpunk" |
| Saúde | Verde-vital + vermelho pulsante | Ambiente "regeneração/combate" |
| Estudo | Roxo arcano + dourado sutil | Ambiente "biblioteca mágica" |
| Casa | Âmbar quente + marrom suave | Ambiente aconchegante |
| Pessoal | Ciano + branco | Ambiente clean |
| Combate | Vermelho + preto | Ambiente intenso |

O `rank` (E→S) controla intensidade do brilho/partículas: E é opaco e quase sem efeito, S é dourado/vermelho vibrante com partículas densas — reaproveitando `_initParticulas`, mas instanciado com paleta própria da Dungeon corrente.

**HUD fixo no topo:**
- Nome + ícone + badge de rank da Dungeon
- Cronômetro de sessão (tempo decorrido, fonte monoespaçada estilo "núcleo de reator")
- Contagem regressiva até `hora_saida` (ou até o fim do prazo, se ainda não entrou)
- Contadores animados de XP e moedas ganhos **nesta sessão**
- Botão "Sair da Dungeon" estilizado como portal de saída

**Quadro de missões**, dividido em três colunas/grupos: **Ativas** (cards com botão "Cumprir"), **Passivas** (barras de progresso circulares que enchem sozinhas), e um canto reservado para **eventos/flavor** que aparecem como notificações pop-in temporárias.

**Saída da Dungeon:** ao clicar "Sair", roda a resolução da sessão e mostra uma tela de **Relatório de Clear** (rank obtido, XP total da sessão, missões cumpridas) antes de fechar a transição de volta para o app normal — o mesmo tipo de "recompensa visual" de fechar uma dungeon num RPG.

**Toques modernos opcionais (baixo custo, alto impacto):**
- Botão de tela cheia real (Fullscreen API) para máxima imersão
- Som ambiente em loop por categoria, mudo por padrão, toggle no HUD (Web Audio API, sem dependência externa)
- Leve parallax do fundo de partículas ao mover o mouse
- Atalho `ESC` para sair, com confirmação se houver missões p