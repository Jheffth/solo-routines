# CONTRATO — Rotinas (regra) × Missões (ocorrência)

Backend **pronto e testado** (`test_extrato.py`, 26 asserções). Este documento é
a fonte da verdade para o frontend. Não altere o backend.

## O conceito

    ROTINA  = a REGRA      "carregar Dolphin toda terça"     → guia Rotinas
    MISSÃO  = a OCORRÊNCIA "carregar Dolphin em 14/07"       → Dashboard/Extrato

Uma rotina gera N missões. Cada missão tem **identidade própria**: a de ontem
pode ter fracassado enquanto a de hoje está em curso.

## Endpoint

`GET /api/extrato/?inicio=&fim=&origem=&status=&categoria=&tipo=&limite=`

- `inicio`/`fim`: `YYYY-MM-DD` (padrão: últimos 30 dias)
- `origem`: `rotina` | `geral` (vazio = ambas)
- `status`: `PENDENTE|ATIVA|PAUSADA|CONCLUIDA|FRACASSADA|CANCELADA`
- `tipo`: `DIARIA|SEMANAL|MENSAL|ANUAL|AVULSA`

Resposta:
```json
{ "inicio":"2026-06-24","fim":"2026-07-24","total":42,"exibidas":42,"missoes":[ ... ] }
```

`GET /api/extrato/resumo?dias=30` → `{contagem:{...}, xp_ganho, xp_perdido, taxa_sucesso}`

## A forma canônica da missão

**As duas origens têm exatamente as mesmas chaves** (o teste garante), então um
único card serve as duas.

```js
{
  uid: "r123",            // CHAVE ÚNICA — use SEMPRE esta para cache/DOM
  id: 123,                // id da OCORRÊNCIA (ExecucaoDia.id ou TarefaDia.id)
  origem: "rotina",       // "rotina" | "geral"
  rotina_id: 45,          // id da REGRA (null quando origem="geral")
  data: "2026-07-24",     // o dia desta missão

  titulo, descricao, categoria, prioridade, dificuldade, icone, cor,
  tipo,                   // DIARIA|SEMANAL|MENSAL|ANUAL|AVULSA
  status,                 // vocabulário único nas duas origens
  hora_inicio, hora_fim,

  xp_recompensa, moedas_recompensa, penalidade_xp,   // prometido
  xp_ganho, moedas_ganhas, xp_perdido,               // realizado

  iniciada_em, concluida_em, fracassada_em, cancelada_em,

  editavel: true,         // EXECUTAR (iniciar/concluir) — só no dia corrente
  gerenciavel: true       // EDITAR/EXCLUIR — de hoje em diante
}
```

`editavel` e `gerenciavel` são permissões diferentes de propósito: uma missão
de amanhã não pode ser concluída, mas precisa continuar corrigível; uma de
ontem é histórico e não se reescreve.

## ⚠️ ARMADILHAS — leia antes de codar

**1. `m.id` mudou de significado.** Antes era o id da rotina; agora é o da
ocorrência. As ações da API continuam indo pela REGRA. Roteie assim:

```js
// origem === "rotina":
POST /rotinas/{m.rotina_id}/iniciar|pausar|retomar|cancelar
API.execucoes.concluirRotina(m.rotina_id)
// origem === "geral":
POST /tarefas/{m.id}/iniciar|pausar|retomar|cancelar|concluir
```
Usar `m.id` numa rota `/rotinas/` vai agir na rotina errada. É o erro mais fácil
de cometer aqui.

**2. Cache por `uid`, nunca por `id`.** `ExecucaoDia.id=5` e `TarefaDia.id=5`
coexistem. `cachear()` e `data-mc-card` devem usar `uid`.

**3. Só `editavel:true` aceita ação.** O passado é somente leitura — não
renderize Iniciar/Concluir quando `editavel === false`; mostre o selo do
status final.

**4. Não existe backfill.** Dias anteriores a esta mudança não têm registro.
Extrato vazio no começo é o esperado, não é bug.

**5. Regra de crase (já quebrou 3 arquivos):** nunca use crase nem `*/` dentro
de comentário em template literal de CSS-in-JS.

## API do card

```js
MissaoCard.html(m, { modo: 'missao' })   // ocorrência: status, prazo, ações
MissaoCard.html(r, { modo: 'agenda'  })  // regra: frequência, próxima ocorrência
MissaoCard.html(m, { modo: 'missao', compacto: true })  // faixa fina (extrato)
MissaoCard.cachear(lista)                // indexa por uid (agenda: por "a"+id)
MissaoCard.montar(container, { onMudou, onAcao })
MissaoCard.pararTimer()
```

`modo` padrão = `'missao'` (retrocompatível). No `modo:'agenda'` o card recebe
uma ROTINA crua de `/rotinas/` (tem `id`, `tipo`, `dias_semana`, `ativo`), NÃO
a forma canônica acima.
