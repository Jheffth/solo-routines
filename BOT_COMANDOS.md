# Como criar um comando novo no bot do Solo Rotinas

> Vale para qualquer agente (Claude, Codex, Antigravity) e para humanos.
> Sempre que o Arquiteto pedir um **comando novo de bot** (ou mudar um existente),
> siga TODOS os passos abaixo, na ordem. Não pule o manifesto.

## Onde o bot mora

O bot do Rotinas fala com os hunters pelo **Solo Bot**, o bot único de Telegram e
WhatsApp de todos os sistemas Solo (repo `SOLO-BOT`, pasta `C:\JEFFERSON\PROJETOS\SOLO BOT`).

- A **lógica** do comando mora AQUI, no `motors/conversa.py` — a mesma conversa para
  todos os canais. O Solo Bot só entrega a mensagem e desenha a resposta.
  **Não altere o repositório do Solo Bot para criar comando do Rotinas.**
- O Solo Bot descobre os comandos pelo `webapp/backend/bot_manifesto.json`. É esse
  arquivo que faz o comando aparecer no `/ajuda`, no painel do Solo Bot e no anúncio
  de "✨ Novidades" para os hunters.
- No chat o hunter digita `/rot <comando>` (ou só `<comando>` já dentro do modo Rotinas).
- Voz: o Solo Bot transcreve o áudio e manda como TEXTO. Um comando novo já funciona
  falado, sem nada a mais aqui.

## Os passos (todos obrigatórios)

1. **Escreva o comando** em `webapp/backend/motors/conversa.py`, dentro de `_processar()`,
   junto dos outros (`if txt.lower().startswith("/nome"): ...`), e responda com
   `canal.enviar(texto, opcoes)`.
   - **Botões**: use o formato neutro que o motor já usa —
     `[{"titulo": "Banho", "acoes": [{"rotulo": "✅ Concluir", "dados": "ok|r|12"}]}]`.
     O Solo Bot vira botão no Telegram e lista numerada no WhatsApp. O toque volta por
     `agir()`: se criar uma ação nova (`dados`), trate-a lá e **sempre** confira o alvo
     contra o `usuario_id` (`_por_chave`) — `dados` vem do cliente e não é confiável.
   - Não escreva nada específico de Telegram ou WhatsApp no motor.

2. **Coloque o comando na ajuda**: o bloco de `/ajuda` em `_processar()` (seção que combina).

3. **Acrescente uma linha no manifesto** `webapp/backend/bot_manifesto.json`, em `"comandos"`:
   ```json
   {"comando": "/meta", "descricao": "Progresso das metas", "exemplo": "/rot meta"}
   ```
   - `comando`: minúsculas, sem espaço, sem acento, começando com `/`.
   - `descricao`: curta, o que o hunter ganha.
   - `exemplo`: sempre com o prefixo `/rot`.
   - Se o comando existe mas NÃO faz sentido pelo Solo Bot, use `"oculto": true`.

4. **Troque a `versao`** do manifesto para a data do dia: `AAAA.MM.DD`
   (ex.: `2026.10.05`; segundo ajuste no mesmo dia: `2026.10.05.2`).
   - `novidades`: o texto que os hunters vão receber no chat ("✨ Novidades no Rotinas").
     **Pergunte ao Arquiteto se ele quer anunciar.** Sem resposta, deixe `[]`.
     Se for anunciar, uma frase curta, na voz do Sistema
     (ex.: `"Novo: /rot meta mostra o quanto falta para cada meta."`).
   - Versão nova sem `novidades` e sem comando novo = atualização silenciosa.

5. **Rode os testes** em `webapp/backend` (padrão deste repo: banco SQLite temporário):
   ```
   DATABASE_URL=sqlite:///./x.db SECRET_KEY=teste python test_solobot.py
   DATABASE_URL=sqlite:///./x.db SECRET_KEY=teste python test_bot_conversa.py
   ```
   O `test_solobot.py` FALHA se o manifesto e o bot se desencontrarem: comando no
   manifesto que cai em "Comando não reconhecido", ou comando da ajuda que falta no
   manifesto. Acrescente asserts do comando novo no `test_bot_conversa.py`.
   Lembre: `test_*.py` é ignorado pelo `.gitignore`; teste novo entra com `git add -f` nomeado.

6. **Commit** só com os arquivos da tarefa (`git add` nomeado, nunca `.env` nem `_cofre/`),
   ex.: `feat(bots): comando /meta (progresso das metas)`.

7. **Deploy só do Rotinas** (`SUBIR.bat`: push + deploy pela chave SSH). O Solo Bot
   **não** precisa de deploy: ele busca o manifesto sozinho (ao subir o Rotinas e a
   cada 10 minutos). Se você não tiver credencial de push/deploy, pare aqui e avise o Arquiteto.

## Conferir que chegou

No painel do Solo Bot → **Administração** → "Sistemas registrados": a coluna
**Manifesto** mostra a versão nova (botão **Buscar manifestos** força na hora).
No chat: `/ajuda` lista o comando novo.

## Quando o Solo Bot muda (e aí NÃO é aqui)

Só para o que não pertence a nenhum sistema: sistema novo, comando que junta sistemas
(ex.: `/resumo` com saldo + missões), recurso de canal (voz, novo aplicativo) ou o jeito
de conversar do hub (`/menu`, `/sair`, modo ativo). Isso é no repositório `SOLO-BOT`.

## Atenção: WhatsApp

O número do WhatsApp agora é do Solo Bot. **Não use o "Conectar com QR" da aba Bots do
Rotinas** — ele aponta a Evolution de volta para cá e tira o WhatsApp do Solo Bot. O QR
é só em Solo Bot → Administração → WhatsApp.
