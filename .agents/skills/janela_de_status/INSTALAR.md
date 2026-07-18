# 📦 Como instalar esta skill

## No Antigravity (Gemini Pro / Sonnet)

A pasta `.claude/skills/` da raiz do projeto é lida automaticamente. Para forçar,
cole nas regras/contexto do projeto:

```
Ao modernizar qualquer cabeçalho, hero card, painel de usuário ou dashboard
deste projeto, leia e siga:
  .claude/skills/janela-de-status/SKILL.md
e reaproveite as classes de:
  .claude/skills/janela-de-status/referencia/status-window.css
Nunca recrie o estilo com CSS inline por página — as páginas devem
compartilhar .sys-plate e .hunter-window.
```

## No Claude (app / Cowork)
Configurações → Capacidades → adicionar skill apontando para esta pasta.

## Teste de aceitação
Peça: *"modernize o cabeçalho da página X"*. O modelo deve:
1. reaproveitar `.sys-plate` / `.hunter-window` (não criar CSS inline novo);
2. propagar `--rank-cor` para borda, anel, selo e partículas;
3. usar contagem animada nos números;
4. mover ações destrutivas para fora do cabeçalho;
5. rodar `node --check` e conferir o HTML balanceado.

## Conteúdo
```
janela-de-status/
├── SKILL.md                       doutrina, técnicas, armadilhas, checklist
├── INSTALAR.md                    este arquivo
└── referencia/
    ├── status-window.css          CSS completo do padrão
    ├── status-window.js           comportamentos (rank, contagem, XP, partículas, chip)
    └── template.html              HTML pronto dos dois componentes + defs globais
```
