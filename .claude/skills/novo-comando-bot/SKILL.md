---
name: novo-comando-bot
description: Criar ou alterar um comando do bot do Solo Rotinas (Telegram/WhatsApp via Solo Bot). Use SEMPRE que pedirem "comando novo no bot", "/algo no bot", "o bot devia responder X", ou mudança em comando existente.
---

# Novo comando do bot — Solo Rotinas

Siga o `BOT_COMANDOS.md` da raiz do repositório. Todos os passos, na ordem:

1. Código em `webapp/backend/motors/conversa.py`, em `_processar()`; responder com `canal.enviar(texto, opcoes)`.
   Botões no formato neutro; ação nova tratada em `agir()`, sempre conferindo o alvo contra o `usuario_id`.
2. Linha no bloco `/ajuda` de `_processar()`.
3. Linha em `webapp/backend/bot_manifesto.json` → `"comandos"`:
   `{"comando": "/nome", "descricao": "...", "exemplo": "/rot nome"}` (`"oculto": true` se não servir pelo Solo Bot).
4. `versao` do manifesto = data do dia `AAAA.MM.DD` (mesmo dia: `.2`). `novidades`: pergunte ao Arquiteto; sem resposta, `[]`.
5. `DATABASE_URL=sqlite:///./x.db SECRET_KEY=teste python test_solobot.py` e `... python test_bot_conversa.py`
   (+ asserts do comando novo; teste novo entra com `git add -f` nomeado).
6. Commit com `git add` nomeado (nunca `.env` nem `_cofre/`).
7. Deploy só do Rotinas (`SUBIR.bat`). Não mexa no repositório do Solo Bot: ele lê o manifesto sozinho.
