# 📦 Como instalar esta skill

## No Antigravity (Gemini Pro / Sonnet)

A pasta `.claude/skills/` na raiz do projeto é lida automaticamente pelas
ferramentas que seguem a convenção de skills. Se o Antigravity estiver
apontando para este projeto, ele já enxerga esta skill.

Se precisar forçar o carregamento, cole isto nas **regras/contexto do projeto**
(ou no início da conversa):

```
Antes de criar qualquer animação de conquista, badge, medalha, som de
recompensa ou efeito de desbloqueio neste projeto, leia e siga:
  .claude/skills/cerimonia-de-conquista/SKILL.md
e use como base os arquivos em:
  .claude/skills/cerimonia-de-conquista/referencia/
Não crie um sistema paralelo: o canal único é ConquistaFX.
```

## No Claude (app / Cowork)

Configurações → Capacidades → adicionar skill, apontando para a pasta
`.claude/skills/cerimonia-de-conquista/`.

## Teste rápido depois de instalar

Peça ao modelo: *"crie a animação de conquista deste projeto"*.
Ele deve, antes de escrever código:

1. rodar `grep` procurando `ConquistaFX` / sistemas existentes;
2. citar os três atos (impacto → clímax → resolução);
3. usar a medalha SVG parametrizada (não emoji cru);
4. tocar som nos dois momentos (cerimônia e carimbo);
5. rodar `node --check` no final.

Se ele pular qualquer um desses passos, a skill não foi carregada.

## Conteúdo do pacote

```
cerimonia-de-conquista/
├── SKILL.md                    doutrina + armadilhas + checklist
├── INSTALAR.md                 este arquivo
└── referencia/
    ├── cerimonia.js            ConquistaFX completo (fila, dedup, medalha, 3 atos)
    ├── cerimonia.css           keyframes: forja, shimmer, slam, névoa, selo
    └── sfx.js                  motor de som com fallback sintetizado
```
