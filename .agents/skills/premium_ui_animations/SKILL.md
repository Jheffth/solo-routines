---
name: "Fable5 Premium UI & Animations"
description: "Diretrizes e técnicas avançadas para replicar o padrão S-Rank (Fable5) de animações cinéticas, design SVG, efeitos de cerimônia e UX premium no sistema Solo Rotinas."
---

# Padrão de Qualidade Fable5 (S-Rank UI)

Sempre que a tarefa envolver criar ou reformular componentes visuais, emblemas, medalhas, notificações, cerimônias ou áreas nobres do *Solo Rotinas*, aplique **rigorosamente** as seguintes diretrizes para manter o nível técnico atingido pelo desenvolvedor Fable5.

## 1. Engenharia de Arte Vetorial (SVGs)
- **Zero Emojis:** Nunca utilize emojis para representar conquistas, ícones premium ou itens. Tudo deve ser desenhado via paths de SVG (curvas de Bézier limpas).
- **Sombras Nativas (feDropShadow):** Não confie no CSS `filter: drop-shadow` em caixas contenedoras HTML (pois clip-paths acidentais cortam as sombras, gerando fundos quadrados bizarros). Use `<filter id="shadow"> <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000" flood-opacity="0.9"/> </filter>` no grupo `<g>` raiz do SVG.
- **Lapidação de Gema (Reflexo Vidro):** Evite excesso de `feGaussianBlur` interno para "fazer brilhar". O aspecto premium vem de formas puras. Para fazer uma joia (rubi, safira, etc.), desenhe polígonos sobrepostos `fill="rgba(255,255,255,0.15)"` que cobrem metade da peça para simular o corte chanfrado do cristal.
- **Cinética Interna:** A medalha deve ter vida. Atrele as classes nativas de rotação (como `.cq-svg-star` ou `animation: cq-anel-girar 25s linear infinite`) diretamente aos grupos `<g>` internos do SVG para que coroas, anéis de runas ou estrelas de base rodem em sentidos opostos (horário e anti-horário).

## 2. O Palco e a Cerimônia
Qualquer pop-up de grande impacto (Level Up, Nova Masmorra, Conquista) não deve ser um simples card, mas sim um espetáculo em "3 Atos". Reutilize as mecânicas testadas:
- **O Contêiner Não Pode Cortar Raios:** Para ter o background épico rotativo (*Sunburst* feito em `conic-gradient`), ele **não pode** ficar contido em divs que tenham `clip-path` ou `overflow: hidden`. Insira-o no nível mais alto do overlay.
- **Camadas do Fable5:** Use a hierarquia nativa comprovada: `.cq-overlay` -> `.cq-flash` (clarão inicial branco) -> `.cq-palco` (contêiner flex central) -> `<div class="cq-raios">` ou sunburst solto -> `.cq-medalha` (sofre o pop-in elástico via `cq-forjar`) -> `.cq-textos`.

## 3. Tipografia Metálica (Shimmer Text)
Letreiros Premium usam o combo:
- **Títulos:** `font-family: var(--font-title); font-size: 2.8rem; text-shadow: 0 8px 25px rgba(0,0,0,0.8);`
- **Tons Dourados Animados:** 
  ```css
  background: linear-gradient(100deg, #fff7e0 20%, #fbbf24 40%, #fff7e0 60%, #fbbf24 80%);
  background-size: 220% auto; -webkit-background-clip: text; color: transparent;
  animation: cq-shimmer 2.4s linear infinite;
  ```
- **Rótulos Menores:** `font-family: var(--font-section); text-transform: uppercase; letter-spacing: 4px;`

## 4. O Grand Finale (Resolução)
Animações épicas não terminam sumindo abruptamente. Elas precisam se solidificar no sistema do usuário.
- **Notificação Toast (Selo):** A cerimônia deve injetar uma notificação lateral (no `#cq-pilha`) com classe `.cq-selo`. Esse selo leva a mini-medalha (`tamanho=40`) renderizada diretamente, com background gradiente rico e borda colorida. A classe `.cq-selo-out` cuida da saída elegante.
- **Carimbo no Dashboard (Quadro):** Simultaneamente, deve-se afixar permanentemente o card no topo de `#lista-conquistas-recentes`. O card recém-adicionado deve receber `.conquista-mini.cq-carimbo.c-entering.c-materializing` para ser ejetado no grid.
- **A Névoa e o Som:** Cards de alto rank no Dashboard ganham um `.cq-nevoa` (`radial-gradient` no fundo do card) e brilham internamente (`box-shadow: inset`). Assim que o card é fixado no DOM (~380ms), um trigger de áudio `SFX.play('carimbo')` deve ser disparado para concretizar a recompensa na mente do usuário.
