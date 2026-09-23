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

## Testes backend

Arquivos `test_*.py` são bloqueados pelo `.gitignore` de propósito; os que
devem ir para o repositório entram com `git add -f` **nomeado, um por um**
— nunca `git add -f .` ou `git add -A -f`.
