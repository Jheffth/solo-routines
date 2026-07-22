# Contrato — BuddyList + Chat (Solo Routines)

Fonte única de verdade para todos que trabalham nesta feature. Não desviar
sem atualizar este arquivo primeiro.

## Decisões

- **Amizade**: pedido + aceite. Relação única por par (nunca duas linhas A→B e B→A).
- **Tempo real**: polling. Nada de WebSocket.
- **Escopo v1**: BuddyList com presença, chat 1-a-1, contador de não-lidas. Sem grupos.

## Modelos (já existem em `database.py`)

```
Amizade:  id, usuario_a_id, usuario_b_id (par ordenado a<b),
          solicitante_id, status ('pendente'|'aceita'|'recusada'),
          criado_em, respondido_em
Mensagem: id, de_id, para_id, corpo (<=2000), criado_em, lida_em (null=nao lida)
```

## Regras de negócio (backend — Subagente 1)

1. **Só se conversa com amigo aceito.** Enviar mensagem a quem não é amigo → 403.
2. **Não se manda pedido para si mesmo, nem para conta inativa, nem para o inviolável do sistema sem querer** — inativo/inexistente → 404, si mesmo → 400.
3. **Pedido duplicado**: se já existe relação aceita → 400 "já são amigos"; se já há pedido pendente → devolve o pendente sem criar outro.
4. **Aceitar/recusar** só quem RECEBEU o pedido (não o solicitante).
5. **Presença** reaproveita o padrão de `routers/hunters.py::_presenca` (online/recente/hoje/ausente/sumido) e `_marcar_presenca` já roda no `get_usuario_atual`.
6. **Não vazar dados sensíveis**: a BuddyList devolve nome, login, avatar, classe, nivel, presença e a aura de cargo (`_aura_cargo`). Nunca e-mail, moedas, nivel_acesso cru.
7. **Marcar como lida**: abrir uma conversa marca as mensagens daquele remetente como lidas (lida_em = agora).
8. **Performance**: nada de N+1. Contadores de não-lidas por conversa saem em uma query agregada (group by de_id).

## Endpoints (prefixo /api, router `routers/social.py`)

Todos exigem `get_usuario_atual`.

```
GET    /social/amigos
   -> { amigos:[{id,login,nome,avatar_url,classe,nivel_atual,presenca,
                 visto_ha_min,aura,nao_lidas:int}],
        pendentes_recebidos:[{...,amizade_id}],
        pendentes_enviados:[{...,amizade_id}], total_nao_lidas:int }
   (visto_ha_min = minutos desde o último acesso, para "visto há X" exato;
    também vai no objeto `com` da conversa.)
   amigos ordenados: online primeiro, depois por nome.

POST   /social/pedir            body {login:str}   -> {ok, status, amizade_id}
POST   /social/responder        body {amizade_id:int, aceitar:bool} -> {ok, status}
DELETE /social/amigo/{login}    -> {ok}   (desfaz amizade ou cancela pedido enviado)

GET    /social/conversa/{login}?antes_de=<iso opcional>&limite=40
   -> { com:{id,login,nome,avatar_url,presenca,aura},
        mensagens:[{id,de_mim:bool,corpo,quando,lida:bool}],  # ordem cronológica
        ha_mais:bool }
   Abrir a conversa marca como lidas as mensagens recebidas desse hunter.

POST   /social/enviar   body {login:str, corpo:str}
   -> {ok, mensagem:{id,de_mim:true,corpo,quando,lida:false}}
   403 se não forem amigos. corpo vazio/>2000 -> 422.

GET    /social/novidades   (polling leve — chamado a cada ~5s)
   -> { total_nao_lidas:int, por_hunter:{login:count},
        pedidos_recebidos:int }

POST   /social/digitando   body {login:str}   -> {ok}
   Heartbeat: "estou digitando para <login>". Guardado EM MEMÓRIA no
   servidor (dict {(de,para): timestamp}), janela de 6s, sem tocar o banco.
   O outro lado descobre pelo campo `com.digitando` na resposta de
   /social/conversa (true se o interlocutor mandou heartbeat nos últimos 6s).
```

## Adições v1.1 (digitando + som)

- **Indicador "digitando…"**: o chat, ao detectar input, chama
  `API.social.digitando(login)` no máximo uma vez a cada ~2s (throttle). O
  `/social/conversa` passa a devolver `com.digitando:bool`. O chat mostra/
  esconde a frase "digitando…" com base nesse campo. Latência de até 4s (a
  cadência do poll) é aceitável.
- **Som de mensagem nova**: `SFX.play('mensagem')` — chime sintetizado,
  original. QUEM toca é o polling GLOBAL do menu (app.js `_bindAmigos`),
  quando `total_nao_lidas` AUMENTA. Assim toca com o chat fechado (é quando
  importa) e NÃO toca com o chat aberto (a leitura marca como lida, o total
  não sobe). O chat.js NÃO toca som — evita toque duplo.
- **Bug "precisei atualizar"**: com tudo fechado, só o badge global avisava,
  e a 15s. O poll global do menu cai para ~8s. O chat aberto já anexa via
  poll de 4s (confirmar com teste). `API.social.digitando` em api.js.

## Frontend — contrato de consumo

`API.social` em `api.js` (o orquestrador adiciona):
```
API.social.amigos()            GET  /social/amigos
API.social.pedir(login)        POST /social/pedir {login}
API.social.responder(id,ok)    POST /social/responder {amizade_id:id, aceitar:ok}
API.social.remover(login)      DELETE /social/amigo/{login}
API.social.conversa(login,antesDe) GET /social/conversa/{login}?antes_de=
API.social.enviar(login,corpo) POST /social/enviar {login, corpo}
API.social.novidades()         GET  /social/novidades
```

## BuddyList (Subagente 2) — `js/buddylist.js` + `css/buddylist.css`

- Objeto global `BuddyList`. Painel/drawer lateral aberto por um botão que o
  orquestrador coloca no menu.
- Seções: **Pedidos recebidos** (com aceitar/recusar), amigos **online**,
  amigos **offline** (visto há X). Cada amigo mostra avatar, nome, presença e
  badge de não-lidas.
- Campo "adicionar amigo" reaproveita a busca: usa `API.hunters.buscar` e
  `API.social.pedir(login)`. (O componente de busca `BuddyList` NÃO reimplementa
  busca do zero — chama o endpoint.)
- Clicar num amigo abre o chat: `window.Chat?.abrir(login)`.
- Presença: mesmas cores/classe `pr-online|pr-recente|pr-hoje|pr-ausente|pr-sumido`
  já definidas em `css/hunter-publico.css` (reusar, não redefinir).
- Medalha/aura NÃO precisam aqui; só o pontinho de presença.
- Polling do contador via `API.social.novidades()` a cada 5s enquanto a
  BuddyList estiver aberta; parar quando fechar (nada de timer vazando).

## Chat (Subagente 3) — `js/chat.js` + `css/chat.css`

- Objeto global `Chat`. `Chat.abrir(login)` abre uma janela de conversa
  (flutuante ou drawer) com o histórico.
- Bolhas: minhas à direita, do outro à esquerda. Campo de texto + enviar
  (Enter envia, Shift+Enter quebra linha).
- Carrega histórico com `API.social.conversa(login)`; "carregar mais antigas"
  usa `antes_de` com o `quando` da mensagem mais velha visível.
- Envia com `API.social.enviar`; otimista: mostra a bolha na hora, confirma
  com a resposta.
- Enquanto a janela está aberta, faz polling de `API.social.conversa` (ou
  `novidades`) a cada ~4s para trazer mensagens novas. Parar ao fechar.
- Cabeçalho com avatar, nome e presença do interlocutor.

## Armadilhas conhecidas deste projeto (valem para os agentes)

1. **`img, svg { max-width: 100% }` é global** (design-system.css). Qualquer SVG
   em contêiner sem largura fixa colapsa. Se usar medalha/avatar SVG, force
   `max-width:none` + largura explícita.
2. **Uma única regra `animation` por elemento**: girar e pulsar juntos no
   mesmo `transform` — o segundo anula o primeiro. Aninhe grupos.
3. **`clip-path` recorta filhos**: menus/popovers que passam da borda devem
   ser ancorados no `<body>`, não dentro de contêiner com clip-path.
4. **Timers**: todo `setInterval` de polling precisa ser limpo ao fechar o
   componente, senão vaza e multiplica requisições.
5. **Sem N+1**: no backend, agregue com uma query, nunca consulte dentro de laço.
6. **Nada de `title=""` para tooltip** — o projeto usa cards próprios.
7. **CSS embutido em template literal**: nada de crase nem `*/` dentro de
   comentário de bloco no meio de uma string de template.
