# Regras para agentes neste repositório

Vale para qualquer assistente que trabalhe aqui: Claude, Codex, Antigravity.

## O cofre

Senhas, tokens, chaves e cópias de `.env` moram em **`_cofre/`**, na raiz.
A pasta inteira está no `.gitignore` e **nunca** vai para o git.

1. **Nunca use `git add -f` em `_cofre/`** nem em qualquer arquivo que o
   `.gitignore` bloqueia por conter segredo. O `-f` é o único jeito de
   furar o bloqueio, e existe um motivo para cada linha dele.
2. **Nunca escreva um segredo dentro de um script.** Scripts que precisam
   de senha leem de `_cofre/` (ou de variável de ambiente) na hora de
   rodar. Em 23/09/2026 havia 42 scripts na raiz com a senha root do
   servidor escrita no código.
3. **Não abra os arquivos do cofre para ler o valor.** O que um assistente
   lê entra na conversa dele. Para saber *quais* variáveis existem, leia
   `webapp/.env.example` — ele tem os nomes, nunca os valores.
4. **Nunca cole um segredo em mensagem, commit, comentário ou log.**
5. Antes de qualquer commit, confira `git status`: se aparecer arquivo de
   senha como novo, pare e avise o Arquiteto em vez de commitar.

## Commits, push e deploy

**Todo agente deve fazer commit ao concluir uma alteração pronta e testada.**
Esta é a regra atual do Arquiteto: não é necessário pedir autorização de
commit a cada entrega. Incluir somente os arquivos da alteração, preservando
trabalho alheio e respeitando as regras do cofre.

**Push e deploy continuam com o Antigravity**, salvo instrução explícita do
Arquiteto. Ele não usa o `SUBIR.bat`. Esta regra vale por cima de qualquer
passo de deploy escrito em outro arquivo (inclusive o `BOT_COMANDOS.md`).

## Testes backend

Arquivos `test_*.py` são bloqueados pelo `.gitignore` de propósito; os que
devem ir para o repositório entram com `git add -f` **nomeado, um por um**
— nunca `git add -f .` ou `git add -A -f`.

## Comandos do bot (Telegram / WhatsApp)

**Sempre que pedirem um comando novo de bot — ou mudança num comando existente —
siga o [BOT_COMANDOS.md](BOT_COMANDOS.md) inteiro.** Em resumo:

1. Escrever o comando em `webapp/backend/motors/conversa.py` (`_processar()`; botões no formato neutro, ações em `agir()`).
2. Colocar no bloco `/ajuda`.
3. Acrescentar a linha em `webapp/backend/bot_manifesto.json`.
4. Trocar a `versao` do manifesto para a data do dia (`AAAA.MM.DD`); `novidades` só se o Arquiteto quiser anunciar.
5. Rodar `test_solobot.py` (falha se manifesto e bot se desencontrarem) e `test_bot_conversa.py`.
6. Commit nomeado; deploy só do Rotinas. O Solo Bot não muda nem precisa de deploy.
