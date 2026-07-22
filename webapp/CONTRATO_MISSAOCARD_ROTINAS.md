# Contrato — MissaoCard em produção na página de Rotinas

Fonte única de verdade. O objetivo: tirar o `MissaoCard` (hoje só demo na
Forja de Testes) e usá-lo DE VERDADE na lista de Rotinas, no lugar do
`_buildCard` antigo.

## O que já existe (não reinventar)

- `js/missao-card.js` — `MissaoCard`. `MissaoCard.html(m)` monta o cartão;
  `MissaoCard.cachear(lista)` alimenta o timer de prazo; `MissaoCard.montar(
  container, opts)` liga a delegação de eventos e o timer único.
  **`_executar` JÁ chama os endpoints reais de Rotinas** (`/rotinas/{id}/iniciar`,
  `/pausar`, `/retomar`, `/cancelar`, `API.execucoes.concluirRotina`, e o
  `DELETE /rotinas/{id}?extinguir=true` do Arquiteto) e chama `opts.onMudou(resp,
  acao, id)` ao terminar. Modo `opts.demo:true` não toca a API (é a Forja).
- `js/pages/rotinas.js` — a página. Tem: filtros por tipo (`_tipoAtivo`,
  `carregarPorTipo`), ordenação (`_ordenarLista`), formulário (`abrirFormulario`
  para criar/editar), exclusão (`confirmarExcluir`), estado vazio.

## A rotina já traz os campos que o card lê (mapeamento ~1:1)

`status_hoje, titulo, categoria, prioridade, dificuldade, xp_recompensa,
moedas_recompensa, penalidade_xp, hora_inicio, hora_fim, id`. O card já
defaulta com elegância quando um campo falta (prioridade→MEDIA, dificuldade→
NORMAL). **Não é preciso adaptador de dados.**

## A lacuna a fechar

O `MissaoCard` cobre iniciar/pausar/retomar/cancelar/concluir/extinguir, mas a
página de Rotinas também oferece **editar** e **excluir** (normal, não o
extinguir do Arquiteto). Essas duas o card ainda NÃO tem.

## Interface acordada — `opts.onAcao`

`MissaoCard.montar(container, opts)` ganha `opts.onAcao(acao, id, m)`:
chamado para as ações que o card NÃO resolve sozinho — hoje só **'editar'** e
**'excluir'**. O card continua resolvendo internamente (API + onMudou) as de
ciclo de vida (iniciar/pausar/…/extinguir). `m` é o objeto do cache
(`MissaoCard._cache[id]`).

## Agente 1 — Componente (`missao-card.js` + `missao-card.css`)

1. Em `_acoes(status, id)`, acrescentar dois botões-ícone discretos, presentes
   em QUALQUER estado (como o card antigo de Rotinas tinha): **editar** (✏️) e
   **excluir** (🗑). Devem ser visualmente secundários (canto do card ou fim da
   barra de ações), não competir com Iniciar/Concluir.
2. Em `_executar`, quando a ação for `editar` ou `excluir`, NÃO chamar a API:
   chamar `this._onAcao && this._onAcao(acao, id, this._cache?.[id])` e retornar.
   Guardar `this._onAcao = opts.onAcao || null` no `montar`.
3. `excluir` aqui é a exclusão NORMAL (dona do próprio template) — diferente de
   `extinguir` (Arquiteto, apaga+estorna, que continua como está). Não confundir.
4. Nada mais muda: cor por prioridade, selo de rank, prazo, extinguir, timer,
   modo demo — tudo intacto. A Forja de Testes continua funcionando.
5. Armadilhas do projeto: SVG com max-width:none (se houver); nada de title=""
   como tooltip próprio (aqui `title` nativo em ícone é aceitável, é botão);
   timer já é único e limpo — não duplicar.

## Agente 2 — Página (`js/pages/rotinas.js`)

1. Reescrever `renderLista(lista)` para usar o `MissaoCard`:
   ```
   MissaoCard.cachear(lista);
   cont.innerHTML = '<div style="display:flex;flex-direction:column;gap:.9rem">'
     + lista.map(r => MissaoCard.html(r)).join('') + '</div>';
   MissaoCard.montar(cont, {
     onMudou: () => this.carregarPorTipo(this._tipoAtivo),
     onAcao:  (acao, id, m) => {
       if (acao === 'editar')  this.abrirFormulario(this._lista.find(x=>x.id===id) || m);
       if (acao === 'excluir') this.confirmarExcluir(this._lista.find(x=>x.id===id) || m);
     },
   });
   ```
   Manter o estado vazio como está.
2. REMOVER o que o MissaoCard substitui: `_buildCard`, `_bindCardActions`, e o
   timer próprio de contadores (`_iniciarContadores`) — o MissaoCard tem o seu.
   MAS: se `_iniciarContadores` faz auto-start / auto-fracasso (recarrega quando
   `hora_inicio` chega ou o prazo vence), preserve esse comportamento com um tick
   leve que só recarrega a lista, sem redesenhar card a card. Se for só exibição
   de contador, o MissaoCard já cobre — pode remover.
3. PRESERVAR intactos: os filtros por tipo (abas `_tipoAtivo`/`carregarPorTipo`),
   `_ordenarLista`, `abrirFormulario`, `confirmarExcluir`, o botão "+ Nova Rotina".
4. Conferir que a lista recarrega após cada ação (via onMudou) e que o formulário
   de edição abre com a rotina certa.

## Agente 3 — Verificação (só leitura)

Auditar ponta a ponta, SEM editar:
- O card renderiza com dados reais de rotina (cor por prioridade, selo de rank,
  prazo por hora_fim/hora_inicio, prêmio de XP).
- Cada ação chama o endpoint certo: iniciar→/rotinas/{id}/iniciar, concluir→
  concluirRotina, etc.; editar→abrirFormulario; excluir→confirmarExcluir;
  extinguir→DELETE ?extinguir=true (só Arquiteto).
- `onMudou` recarrega a lista após ação. Filtros e formulário intactos.
- Timers: um só, limpo quando não há prazos. Sem setInterval órfão.
- A Forja de Testes (demo) continua funcionando (modo demo não tocou a API).
- Rode `node --check` nos arquivos e um teste jsdom que renderiza a lista com
  rotinas de exemplo e dispara editar/excluir/iniciar confirmando os callbacks.

## Armadilhas gerais (valem para todos)

1. `img, svg { max-width:100% }` é global — SVG em contêiner sem largura colapsa.
2. Uma `animation` por elemento (girar+pulsar juntos se anulam).
3. `clip-path` recorta popover — ancore no body.
4. Todo setInterval limpo ao trocar de tela.
5. Nada de crase / fecha-comentário dentro de CSS-em-template-literal.
