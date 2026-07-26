# CONTRATO — Missões Especiais (booleanas e em cadeia)

**Status:** decisão tomada, nada construído.
**Vale para:** todo trabalho daqui até a primeira cadeia real — lançador,
cronômetro regressivo, tela de economia do Arquiteto, dungeons.

---

## Por que este arquivo existe

Missões especiais não serão construídas agora (ver
`AVALIACAO_MISSOES_ESPECIAIS.md`). Mas o que for construído *no meio-tempo* pode
fechar a porta para elas sem ninguém perceber. Este contrato lista as três
coisas que **não podem ser quebradas** — e a boa notícia é que as três já estão
certas hoje. O trabalho não é construir; é **não estragar**.

## O que já está pronto (medido, não suposto)

| Peça necessária | Onde já existe | Estado |
|---|---|---|
| Gancho "ao concluir, faça algo mais" | `motors/gamificacao.py::aplicar_xp` | ✅ funil único |
| Endereço universal de missão | `uid` (`"r123"`/`"g45"`) em `routers/extrato.py` | ✅ em uso |
| Tradução origem → rota da API | `MissaoCard._rota()` | ✅ ponto único |

**`aplicar_xp` é o achado importante.** Todos os 11 lugares que concluem missão
passam por ele — rotina, tarefa, dungeon e até o bot do Telegram. Verifiquei:
nenhum caminho credita XP por fora (`xp_total +=` só existe dentro do motor; o
que há fora são *subtrações* — penalidade e revogação do Arquiteto).
`routers/dungeons.py` chega a documentar isso no topo: "o único canal de saída
para o resto do sistema é motors.gamificacao.aplicar_xp".

Ou seja: **o lugar onde "concluir uma missão faz outra nascer" vai morar já
existe e já é único.** Não há o que pré-construir. Há o que preservar.

---

## As três regras

### 1. Missão especial é ARESTA, não tipo

Não existirá uma quarta tabela de missão. Booleana e cadeia são a mesma coisa —
"concluir A faz B nascer" — e vivem numa tabela de vínculo que só aponta para as
missões existentes por `uid`:

```
vinculo_missao: pai_uid | filho_uid | condicao (SEMPRE|SIM|NAO) | ordem
```

*Por que isso importa agora:* se o lançador aprender a criar "missão booleana"
como um tipo próprio, ele terá que ser refeito. Ele deve continuar criando
missões comuns — o vínculo é aplicado por fora.

**Precedente:** `DungeonMissao` já tentou o caminho oposto. Tem `natureza` com 6
valores e 6 colunas anuláveis que só servem a uma natureza cada
(`intervalo_min`, `meta_minutos`, `janela_disparo_min/max`, `expira_em_min`).
A sétima natureza custaria mais três colunas mortas para as outras seis.

### 2. Nada conclui missão por fora de `aplicar_xp`

Qualquer código novo que marque missão como concluída — no lançador, no
cronômetro regressivo, no fechamento noturno, em dungeon — **chama
`aplicar_xp`**. Sem atalho, sem `usuario.xp_total +=` local, sem "só desta vez
porque é diferente".

*Por que isso importa agora:* é ali, e só ali, que a cadeia vai consultar
`vinculo_missao` e materializar o próximo card. Um bypass criado hoje vira uma
missão que conclui sem destravar o filho — e o hunter fica preso na cadeia.

**Ponto de atenção conhecido:** a assinatura é
`aplicar_xp(..., rotina_id=None, tarefa_id=None, ...)` — um parâmetro por tipo
de missão. Não é bloqueante (um terceiro parâmetro é barato), mas é a semente da
divergência. Quando a cadeia chegar, o certo é ele passar a receber `uid`.

### 3. O frontend fala `uid`; `_rota()` continua sendo o único tradutor

`MissaoCard._rota()` é hoje o único lugar do frontend que decide a URL a partir
da origem (2 ocorrências, ambas nesse método). Ele fica sendo o único.

*Por que isso importa agora:* uma terceira origem custa duas linhas ali. Se
outras telas começarem a montar `/rotinas/` ou `/tarefas/` na mão, custa uma
caçada.

---

## O que fica pendente, e é decisão, não código

- **Teto diário de XP.** Não existe (`TETO_XP` é por missão, não por dia). Sem
  ele, "relíquia libera conteúdo, não multiplica XP" é falso — conteúdo extra
  *é* XP extra. Precisa existir **antes** de qualquer relíquia destravar missão.
- **Missão oculta.** Filho de cadeia precisa não aparecer antes da hora. Não
  existe hoje em lugar nenhum; quando existir, é uma cláusula de filtro em cada
  listagem (`/rotinas/hoje`, `/tarefas/hoje`, `/extrato/`). Três lugares, não
  três reescritas.
- **Altar como loadout.** Hoje é vitrine (`altar-reliquias.js` só escolhe 5
  relíquias para exibir). Vira equipamento só depois do teto diário.

---

## Como saber se este contrato foi quebrado

```bash
# 1. Nenhuma tabela nova de missão
grep -n "__tablename__" backend/database.py | grep -i "missao\|tarefa\|rotina"

# 2. Nenhum crédito de XP fora do motor
grep -rn "xp_total +=\|xp_atual +=" backend/routers/    # deve voltar vazio

# 3. Um único tradutor de rota no frontend
grep -rn "origem === 'geral'\|origem === 'rotina'" frontend/js/   # só missao-card.js
```
