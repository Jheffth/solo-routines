# Regras do Projeto (Solo Routines)

## Consistência de UI (Padrão S-Rank)
Sempre que criar ou refatorar componentes da UI (como badges e cards), mantenha estritamente a mesma estrutura HTML, classes CSS e identidade geométrica dos elementos já existentes (padrão S-Rank/Fable). Nunca crie layouts paralelos que quebrem a 'família visual' do projeto.

## Skills Instaladas (Fable Method)

As quatro skills do Fable Method estão instaladas em `.agents/skills/fable-method/skills/`.
Ative-as explicitamente quando precisar de execução estruturada e verificada:

- **fable-method** → `.agents/skills/fable-method/skills/fable-method/SKILL.md`
  Use quando: tarefas complexas multi-etapa, qualquer coisa não trivial.
- **fable-loop** → `.agents/skills/fable-method/skills/fable-loop/SKILL.md`
  Use quando: tarefas longas não supervisionadas, múltiplos subagentes.
- **fable-judge** → `.agents/skills/fable-method/skills/fable-judge/SKILL.md`
  Use quando: verificar se um trabalho foi realmente concluído com sucesso.
- **fable-domain** → `.agents/skills/fable-method/skills/fable-domain/SKILL.md`
  Use quando: gerar adaptadores de domínio (marketing, devops, pesquisa, etc.).

## Comandos do bot (Telegram/WhatsApp)

Comando novo ou alterado: siga o `BOT_COMANDOS.md` da raiz, todos os passos — código no
`motors/conversa.py`, `/ajuda`, linha no `webapp/backend/bot_manifesto.json`, `versao` nova,
testes (`test_solobot.py`, `test_bot_conversa.py`), commit e deploy só do Rotinas.
Skill: `.agents/skills/novo-comando-bot/SKILL.md`.
