# O SOLO NO GOOGLE CALENDAR — planejamento

> **Escopo decidido pelo Arquiteto:** mão única. O Solo alimenta o Calendar
> para que ele enxergue melhor a semana e receba os avisos no celular. O
> Calendar nunca escreve de volta. Vão para a agenda portões, rotinas com
> horário, missões gerais com prazo e os prazos longos dos pactos. Qualquer
> hunter que quiser pode conectar a sua.

---

## 1. VOCÊ JÁ TEM METADE DISSO PRONTO

`auth/oauth.py` é um fluxo OAuth2 Authorization Code completo e bem feito:
catálogo de provedores num mapa só, `state` anti-CSRF com TTL, troca de
`code` por token no servidor, tratamento separado para "o provedor recusou"
e "a rede caiu", e a tabela `IdentidadeOAuth` já ligando conta Google a
hunter.

Acrescentar Calendar não é começar do zero. É estender o que existe — e o
comentário no topo daquele arquivo já previu isso: *"acrescentar um terceiro
(GitHub, etc.) seja só mais uma entrada neste mapa."*

**Mas há três diferenças entre "entrar com o Google" e "escrever no Calendar
do hunter", e as três são bloqueantes.** Elas são a parte honesta deste
plano, e por isso vêm antes da arquitetura.

---

## 2. AS TRÊS PEDRAS NO CAMINHO

### 2.1 Hoje você não guarda token nenhum — e nem poderia

`auth/oauth.py`, linha 164:

```python
if provedor == "google":
    params["access_type"] = "online"
```

`online` significa: *me dê um token de uma hora e nunca mais*. É a escolha
certa para login — o Solo só precisava ler o e-mail uma vez. Para escrever
na agenda dias depois, é preciso `access_type="offline"` + `prompt="consent"`,
que é o que faz o Google devolver um **refresh token**.

Isso implica guardar segredo de longo prazo por hunter. Hoje `IdentidadeOAuth`
guarda só `(provedor, provedor_id, email)` — nenhum token. **Vai precisar de
tabela nova**, e de cifrar o refresh token em repouso.

### 2.2 O token de teste morre em 7 dias

Esta é a que pega quase todo mundo de surpresa. Enquanto a tela de
consentimento estiver com publishing status **"Testing"** no Google Cloud
Console, o refresh token expira em **7 dias** e passa a devolver
`invalid_grant`. Você conectaria a agenda na segunda e ela pararia sozinha
no domingo seguinte, sem erro visível no app.

A saída é publicar o app (**"In production"**), o que se pode fazer *antes*
de ser verificado. Aí o refresh token passa a ser de duração indefinida.

### 2.3 O escopo — e a pedra que NÃO existe

> **Esta seção foi reescrita depois de verificar no console.** Eu previa aqui
> o pior cenário: escopo sensível, tela de "app não verificado", teto de 100
> usuários e um processo de verificação de meses com política de privacidade,
> Search Console e vídeo. **Nada disso se aplica** — e quem desmentiu foi o
> próprio Google, na Central de verificação do projeto. A previsão pessimista
> fica registrada porque ela era a razão de a Fase 0 ser o caminho crítico, e
> deixou de ser.

O escopo óbvio seria `calendar.events` — *"ver e editar eventos em todas as
suas agendas"*. Largo, assustador na tela de consentimento, e **sensível**:
esse sim arrastaria a verificação inteira.

O escolhido é outro:

```
https://www.googleapis.com/auth/calendar.app.created
```

> *"Criar agendas secundárias do Google e ver, criar, mudar e excluir eventos
> nelas"* — a descrição que o próprio console exibe.

**O app cria uma agenda própria e só enxerga o que ele mesmo criou.** O Solo
é tecnicamente incapaz de ler a consulta médica ou a reunião de trabalho do
hunter.

E é exatamente por isso que ele **não é sensível**. Ao ser declarado, o
console o colocou na tabela **"Escopos não confidenciais"** — as tabelas de
sensíveis e restritos seguem vazias. A Central de verificação diz, com todas
as letras:

> *"A verificação não é necessária porque seu app não está solicitando
> escopos sensíveis ou restritos."*

**O que isso elimina, em bloco:** tela de "app não verificado", teto de 100
usuários, política de privacidade obrigatória, verificação de domínio no
Search Console, vídeo demonstrativo e a espera de meses.

A lição é que a escolha do escopo mais estreito não foi só higiene de
privacidade — **foi a decisão que apagou uma fase inteira do projeto.** Vale
lembrar disso na próxima integração.

---

## 3. A ARQUITETURA

### 3.1 Uma agenda dedicada por hunter

O app cria, na primeira conexão, um calendário secundário chamado
**"Solo Routines"** e escreve só nele.

Isso não é organização — é arquitetura, e resolve quatro problemas de uma vez:

| Problema | Como a agenda dedicada resolve |
|---|---|
| Poluir a agenda principal | O hunter desliga a camada inteira com um clique no app do Google, sem desconectar nada no Solo |
| "E se eu apagar sem querer?" | Apagar a agenda não apaga nada do Solo — é um espelho, não a fonte |
| Privacidade | Com `calendar.app.created`, o Solo é tecnicamente incapaz de ler os outros compromissos |
| Guilda, no futuro | Um calendário separado é compartilhável via ACL. A agenda principal, não. *(Exige o escopo `calendar.acls`, que é outro pedido — mas o desenho já deixa a porta aberta)* |

### 3.2 Tabela nova: `ContaCalendario`

```
usuario_id          FK, único por (usuario, provedor)
provedor            'google'
calendario_id       o id da agenda criada pelo app
refresh_token_cif   CIFRADO — nunca em texto puro
access_token_cif    cache do token curto, dispensável
expira_em           quando o access token morre
escopos             o que o hunter autorizou de fato
conectado_em / ultima_sync / ultimo_erro
ativo               o desligar do hunter, sem apagar o histórico
```

**`refresh_token_cif` cifrado não é preciosismo.** Esse token é acesso
contínuo à agenda de outra pessoa. O projeto já tem uma dívida exatamente
desse tipo (senha root e `SECRET_KEY` versionadas); não vale abrir outra.
Chave de cifra em variável de ambiente, `Fernet` do `cryptography`.

### 3.3 O vínculo evento ↔ missão: os dois, de propósito

```
EventoCalendario
  conta_id, origem ('rotina'|'tarefa'|'dungeon'|'pacto'), origem_id
  evento_id       o id no Google
  revisao         hash do que gerou o evento
```

E, **no próprio evento do Google**, `extendedProperties.private`:

```json
{ "solo_origem": "rotina", "solo_id": "12", "solo_rev": "a91f…" }
```

Parece redundância e não é. A tabela local é a via rápida — sem ela, toda
sincronia começa listando a agenda inteira. As propriedades estendidas são a
**rede de reconciliação**: se o banco local perder o vínculo (restauração de
backup, hunter reconectando a conta), dá para varrer a agenda e reencontrar
cada evento pelo `solo_id` em vez de duplicar tudo.

Duplicar evento é o defeito clássico dessas integrações, e é o pior possível:
ninguém percebe até a agenda estar com três cópias de cada rotina.

O `solo_rev` é o que evita escrita à toa. Se o hash do que gerou o evento não
mudou, não há PATCH a fazer — e a quota do Calendar agradece.

### 3.4 O motor: `motors/calendario.py`

Segue a forma que o projeto já usa (`meta.py`, `circuito.py`, `medidor.py`):
**as regras num módulo puro, o router só orquestra.** Funções previstas:

- `evento_de_rotina(rotina)` → dict pronto para a API
- `evento_de_dungeon(d)`, `evento_de_tarefa(t)`, `evento_de_pacto(p)`
- `rrule_de(regra)` → a regra de recorrência
- `revisao(evento)` → o hash que decide se vale escrever

Puro significa testável sem rede e sem banco — que é como `test_meta_superacao.py`
consegue provar as regras da meta sem subir nada.

---

## 4. A TRADUÇÃO, CASO A CASO

### 4.1 Portões (dungeons) — os mais fáceis e os mais valiosos

Um portão **já é** um compromisso de agenda: tem `hora_entrada`, `hora_saida`,
`agenda_semanal` e `folgas`. É tradução quase direta.

```
summary:     ⛩ Libanus Restaurante  (rank A)
start/end:   hora_entrada / hora_saida, em America/Sao_Paulo
recurrence:  RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR
             EXDATE para cada folga programada
description: as missões do portão, o XP de entrada, o de clear
```

- **`sempre_aberta`** não vira evento com horário — ou não vai, ou vai como
  dia inteiro. Um portão que não fecha não tem bloco de tempo.
- **`duracao_max_min`** entra na descrição, não na duração: ela conta da
  primeira travessia, não da hora do relógio.

### 4.2 Rotinas com `hora_inicio` / `hora_fim`

`tipo_recorrencia` (DIARIA/SEMANAL/MENSAL/ANUAL) + `dias_semana` mapeiam
quase um-para-um em RRULE:

| Solo | RRULE |
|---|---|
| DIARIA | `FREQ=DAILY` |
| SEMANAL + `dias_semana` | `FREQ=WEEKLY;BYDAY=…` |
| MENSAL + `dia_mes` | `FREQ=MONTHLY;BYMONTHDAY=n` |
| ANUAL + `mes_dia` | `FREQ=YEARLY;BYMONTH=m;BYMONTHDAY=d` |
| `data_fim` (temporária) | `UNTIL=…` |

**Rotina sem horário não vai para a agenda.** Uma rotina sem `hora_inicio` é
"em algum momento do dia" — e virar evento de dia inteiro encheria o topo da
agenda de faixas cinzas todo dia, que é como o hunter aprende a ignorar a
integração inteira.

### 4.3 Missões gerais (`TarefaDia`)

Evento pontual em `data_prevista`, terminando em `hora_limite`. Sem prazo,
fica fora — mesmo argumento do item anterior.

### 4.4 Pactos e prazos longos

Evento de **dia inteiro** na data do marco. São poucos, são importantes, e
dia inteiro é exatamente a forma certa: não ocupam horário, aparecem no topo.

---

## 5. OS AVISOS — que é o motivo de tudo isto

Foi o que você pediu: *"conseguir enxergar melhor e ter avisos no meu celular"*.
O Calendar já tem a máquina de notificação; nós só precisamos pedi-la por
evento, em vez de herdar o padrão da conta:

```json
"reminders": {
  "useDefault": false,
  "overrides": [
    { "method": "popup", "minutes": 30 },
    { "method": "popup", "minutes": 5 }
  ]
}
```

Três observações que evitam frustração:

1. **Limite de 5 lembretes por evento.** Suficiente, mas é teto real.
2. **O aviso depende do app do Google Calendar instalado e com notificação
   ligada no celular.** Nós entregamos o evento; quem toca o alarme é o
   Google. Vale dizer isso na tela de conexão — senão "não chegou aviso"
   vira bug do Solo.
3. **Quantos minutos antes deve ser escolha do hunter**, por tipo. Portão
   com 30 min faz sentido; pacto de dia inteiro, um dia antes.

---

## 6. QUANDO SINCRONIZAR

Aqui está a economia inteira do plano, e ela sai de graça da sua decisão de
fazer mão única:

> **Sincroniza-se a REGRA, não o dia.**

Uma rotina diária vira **um** evento recorrente, não trinta eventos. O
Calendar expande a recorrência sozinho. Isso significa que o Solo escreve na
agenda quando a regra muda — não todo dia, não a cada conclusão.

**Gatilhos de escrita:**

- criar / editar / arquivar uma rotina, portão, missão geral ou pacto
- o hunter conectar a agenda (carga inicial)
- uma reconciliação noturna, para consertar deriva

**E o que NÃO dispara escrita:** concluir uma missão. Porque a agenda não
mostra conclusão — ela mostra *compromisso*. Você escolheu mão única
exatamente por isso, e é a escolha certa: refletir conclusão exigiria
reescrever a ocorrência do dia, uma chamada por missão por dia, e traria
junto todo o problema de conflito de escrita que a mão dupla carrega.

---

## 7. ORDEM DE IMPLEMENTAÇÃO

### Fase 0 — Google Cloud Console ✅ **CONCLUÍDA em 13/09/2026**

> Executada pela extensão do Claude no Chrome, no projeto `solo-routines`.
> Estado real encontrado e deixado, passo a passo, abaixo.

| Passo | Estado |
|---|---|
| 1. Ativar a Google Calendar API | ✅ **feito agora** — estava desativada |
| 2. Declarar `calendar.app.created` | ✅ **feito agora** — e saiu **não confidencial** |
| 3. Publicar em "In production" | ✅ **já estava** — sem o problema dos 7 dias |
| 4. Redirect URI de produção | ✅ **já existia** |
| 5. Política de privacidade, Search Console, vídeo | ❌ **desnecessários** |
| 6. Submeter verificação | ❌ **desnecessário** |

**Nada bloqueia a Fase 1.** Não há espera pelo Google.

O que o console mostrou, e que vale guardar:

- **Cliente OAuth:** `Solo Routines Web Client`, criado em 23/07/2026.
- **Redirect URIs cadastrados:** produção
  (`soloroutines.duckdns.org/api/auth/oauth/google/callback`), local
  (`localhost:8000`) e o **Render antigo**, que é sobra e pode sair.
- **Público:** Externo, Em produção, 3 usuários de um teto de 100 — teto que
  não morde, porque ele só se aplica a escopos sensíveis não aprovados.

**Duas pendências que apareceram de brinde** (nenhuma bloqueia nada):

1. **Duas chaves secretas do cliente ativas** (`****tKgO` de 07:44 e
   `****J6G1` de 07:58, ambas de 23/07). O console avisa que mais de uma
   aumenta o risco. Não dá para saber daqui qual o servidor usa, e desativar
   a errada derruba o login — então isso é conferência manual no `.env` antes
   de mexer.
2. **Branding não preenchido** — *"Sua marca não está aparecendo para os
   usuários"*. Cosmético: a tela de consentimento fica sem logo e sem link
   para o site.

---

### O que a Fase 0 deixou decidido para a Fase 1

Como o redirect URI de produção **já serve**, a implementação não precisa de
um provedor novo no mapa do `auth/oauth.py`. O `state` já carrega `modo`
(`login` / `registro`); basta um terceiro — `calendario` — e o mesmo callback
resolve os dois caminhos. **Zero mudança no console para a Fase 1.**

**Passo 1 — Ligar a Calendar API**
Console → *APIs e serviços* → *Biblioteca* → "Google Calendar API" → **Ativar**.
Sem isso, toda chamada volta 403 dizendo que a API está desabilitada.

**Passo 2 — Declarar o escopo**
[Data Access](https://console.developers.google.com/auth/scopes) →
*Add or Remove Scopes* → acrescentar:

```
https://www.googleapis.com/auth/calendar.app.created
```

Ele vai aparecer na seção **"Your sensitive scopes"**. É esperado — e é o
preço de qualquer escopo de Calendar. O que importa é que ele **não** cai em
"restricted": escopo sensível exige verificação, mas **não** exige a
avaliação de segurança por terceiros (aquela que custa caro e demora). Essa
distinção é a diferença entre um processo de semanas e um de meses com
fatura.

> Os escopos declarados AQUI têm de bater exatamente com os que o código
> pede. Divergência entre os dois é uma das causas listadas pelo Google para
> a tela de "app não verificado" aparecer mesmo com tudo certo.

**Passo 3 — Publicar em produção**
[Audience](https://console.developers.google.com/auth/audience) → *Publishing
status* → **In production**.

É o passo que mata o refresh token de 7 dias, e o mais fácil de esquecer
porque nada quebra na hora — quebra uma semana depois. Publicar não é o mesmo
que estar verificado: o app fica publicado *e* não verificado, com a tela de
aviso e o teto de 100 usuários, até a verificação sair.

**Passo 4 — Conferir o redirect URI**
[Clients](https://console.developers.google.com/auth/clients) → o cliente
OAuth que já existe. O `auth/oauth.py` monta o retorno assim:

```python
f"{config.OAUTH_REDIRECT_BASE}/api/auth/oauth/{provedor}/callback"
```

Se o fluxo do Calendar for um provedor novo no mapa (ex.: `google_calendar`),
o URI muda junto e precisa ser cadastrado. `redirect_uri_mismatch` é o erro
mais comum e o mais chato de diagnosticar — e o `print` que já existe no
router justamente o imprime.

**Passo 5 — O que a verificação vai cobrar**
Isto não é burocracia solta: sem os três, o pedido nem é analisado.

1. **Política de privacidade publicada**, com URL própria e acessível. Não
   existe hoje no projeto e **precisa ser escrita**.
2. **Propriedade do domínio verificada no Search Console**, com a MESMA conta
   Google que é dona do projeto no Cloud. `soloroutines.duckdns.org` serve.
3. **Vídeo** mostrando o fluxo inteiro: de onde o hunter clica em "conectar
   agenda", a tela de consentimento, e o que o app faz com o acesso depois.

Mais a justificativa escrita de por que o app precisa do escopo — e aqui a
escolha do `calendar.app.created` paga de novo: a resposta é curta e
verdadeira, *"criamos uma agenda própria e só escrevemos nela"*, em vez de
ter de explicar por que um app de rotinas quer ler a agenda inteira de
alguém.

**Passo 6 — Submeter e tocar a vida**
A análise corre no tempo do Google. As Fases 1 a 4 não dependem dela: com o
app publicado, você e os primeiros hunters já conectam (passando pela tela de
aviso) dentro do teto de 100.

### Fase 1 — O elo ✅ **ESCRITA em 13/09/2026** (falta rodar os testes)

**Arquivos novos**

| Arquivo | Papel |
|---|---|
| `motors/cofre.py` | cifra Fernet do refresh token; recusa se não houver chave |
| `motors/calendario.py` | consentimento, troca de código, refresh, revogação, agenda dedicada |
| `routers/calendario.py` | status, conectar, desconectar, preferências, testar |
| `frontend/js/pages/agenda.js` | o cartão no Perfil |
| `frontend/css/agenda.css` | o desenho dele |
| `backend/test_calendario_elo.py` | o teste, sem tocar a rede |

**Arquivos tocados:** `database.py` (`ContaCalendario`, `EventoCalendario`),
`auth/oauth.py` (o desvio da agenda no callback), `main.py`, `index.html`,
`perfil.js`, `requirements.txt`, `docker-compose.yml`, `.env.example`.

**Decisões que valem registro:**

- **Callback compartilhado.** O fluxo da agenda reaproveita
  `/api/auth/oauth/google/callback`. Um URI novo exigiria mexer no Google
  Cloud e esperar propagar, por zero ganho. Quem separa os dois fluxos é o
  dono do `state` — e a consulta ao estado do calendário vem **antes** do
  `pop` do login, senão um `state` de agenda viraria "sessão expirada".
- **`prompt=consent` é obrigatório, não cosmético.** Sem ele, quem
  desconecta e reconecta recebe `refresh_token: null` e o app guardaria
  silêncio no lugar do segredo.
- **Falhar ao criar a agenda não desfaz a conexão.** O caro já aconteceu (o
  hunter passou pela tela do Google). O erro fica registrado e o botão
  "Testar conexão" refaz só essa parte.
- **Desconectar revoga ANTES de apagar.** Ao contrário, uma revogação
  falha deixaria a permissão viva no Google sem token aqui para retirá-la.

**Antes de subir:** gerar a `CALENDARIO_CHAVE` e pôr no `.env` do servidor.
Sem ela o cartão simplesmente não aparece — e essa é a resposta certa, não
um bug.

```
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

*Prova de que funcionou: conectar, esperar mais de uma hora, clicar em
"Testar conexão" e ainda funcionar. É o único caminho que exercita o
refresh — o que separa uma conexão de verdade de um token de uma hora que
vai morrer calado.*

### Fases 2 e 3 — A tradução e a sincronia ✅ **ESCRITAS em 13/09/2026**

Feitas juntas: separá-las obrigaria a escrever duas vezes o motor que
decide criar/atualizar/apagar.

| Arquivo | Papel |
|---|---|
| `motors/calendario_eventos.py` | missão → evento. Puro: sem rede, sem banco, sem relógio implícito |
| `motors/calendario_sinc.py` | o que criar, atualizar, apagar ou deixar quieto |
| `backend/test_calendario_eventos.py` | 40+ asserts na tradução |

**As decisões que valem registro:**

- **A âncora satisfaz a própria regra.** Num `BYDAY=TU,TH` cujo `DTSTART`
  cai numa segunda, o Google expande a partir da segunda e cria uma
  ocorrência que a regra não pede. `ancora()` procura o primeiro dia que
  a regra aceita.
- **`useDefault: false` nos lembretes.** Herdar o padrão da conta
  significaria, em agenda secundária, **nenhum** lembrete — falhando no
  único motivo pelo qual esta integração existe.
- **Meia-noite.** Portão 22:00→06:00 tem duração negativa numa conta
  ingênua, e o Google recusa o evento inteiro. O turno da noite é
  justamente quem mais precisa do alarme.
- **Dupla defesa contra duplicata:** a tabela `EventoCalendario` (rápida) e
  o `solo_id` gravado dentro do evento (a rede que reencontra tudo quando
  o banco local perde o elo).
- **Varredura diária em vez de gatilhos.** Marcar cada alteração exigiria
  um gancho em dezenas de lugares, e o gancho esquecido produz agenda
  errada em silêncio. A varredura no fechamento é ignorante e não esquece
  — e é barata, porque `solo_rev` igual significa zero escritas.
- **Sincronia inicial ao conectar.** Agenda vazia depois de todo o
  consentimento parece que não funcionou.

**Pactos saíram do escopo, e a ausência é deliberada.** A tabela `pactos`
não tem data nenhuma — é um cardápio de penitências que o Sistema serve
quando o hunter falha, não uma agenda de vencimentos. O interruptor foi
removido da tela: um botão que não sincroniza nada é só mais uma mentira
de interface.

### Fase 4 — A tela
Em Configurações: conectar, escolher o que sincroniza, minutos de
antecedência por tipo, "sincronizar agora", desconectar. E o estado honesto —
`ultimo_erro` visível, porque integração que falha calada é pior que
integração que não existe.

---

## 8. O QUE PODE DAR ERRADO

| Risco | Peso | O que fazer |
|---|---|---|
| ~~Token morrendo em 7 dias~~ | — | **Resolvido:** o app já está em produção |
| Eventos duplicados | **Alto** — destrói a confiança | `extendedProperties` + reconciliação; nunca criar sem procurar antes |
| ~~Verificação demorar meses~~ | — | **Não existe:** o escopo é não confidencial |
| Fuso errado por 1 hora | Médio | `motors/tempo.py` usa **offset fixo −3**, não fuso IANA. A Calendar API quer `"America/Sao_Paulo"`. Enquanto o Brasil não tiver horário de verão dá no mesmo; no dia em que voltar, o offset fixo erra e a agenda erra junto |
| Quota da Calendar API | Baixo | Sincronizar a regra, não o dia, já mantém o volume baixo; `batch` se precisar |
| Hunter apagar a agenda | Baixo | Recriar na próxima sincronia; nada do Solo se perde |

---

## 9. O QUE ESTE PLANO NÃO RESOLVE

Para não passar por completo sem ser:

- **Mão dupla.** Nada aqui lê a agenda. Marcar algo no Google não vira missão.
- **Conclusão refletida.** O evento não muda de cara quando a missão é cumprida.
- **Outros provedores.** Apple e Outlook usam CalDAV/Graph — outro trabalho,
  ainda que a tabela `ContaCalendario` já nasça com `provedor` para isso.
- **Guilda.** O desenho deixa a porta aberta (calendário separado é
  compartilhável), mas compartilhar exige o escopo `calendar.acls`, que é
  outro pedido de permissão e outra rodada de verificação.

---

## 10. ONDE ISTO ESTÁ AGORA

A Fase 0 acabou, e acabou melhor do que este plano previa. Eu a tinha
marcado como caminho crítico porque a verificação do Google correria no tempo
do Google — e a escolha do escopo mais estreito fez a verificação deixar de
existir. **Não há nada esperando por terceiros.**

O próximo passo é a **Fase 1**, e ela é toda código:

1. `access_type="offline"` + `prompt="consent"` no fluxo do Google, por um
   `modo="calendario"` no `state` que já existe
2. tabela `ContaCalendario` com o refresh token **cifrado**
3. renovação automática do access token
4. desconectar de verdade — revogar no Google, não só apagar a linha

A prova de que a Fase 1 funcionou é simples e implacável: conectar, esperar
**mais de uma hora**, e ainda conseguir escrever. É o que separa um token de
acesso que expirou de um refresh que realmente funciona.

---

## FONTES

- [Choose Google Calendar API scopes](https://developers.google.com/workspace/calendar/api/auth) — a tabela de escopos, incluindo `calendar.app.created`
- [Unverified apps](https://support.google.com/cloud/answer/7454865) — a tela de aviso e o teto de 100 novos usuários
- [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) — o que a verificação exige
- [Manage App Audience](https://support.google.com/cloud/answer/15549945) — Testing vs. In production
- [Using OAuth 2.0 to Access Google APIs](https://developers.google.com/identity/protocols/oauth2) — `access_type=offline` e o ciclo do refresh token
