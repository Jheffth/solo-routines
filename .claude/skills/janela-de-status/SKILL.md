---
name: janela-de-status
description: Cria painéis e cabeçalhos de página no padrão "Janela de Status" do Solo Routines — placa de aquisição com glifo e shimmer, painel com cantos chanfrados, avatar em hexágono de rank, barra de XP viva, cristais de status com contagem animada e partículas de fundo reativas ao rank. Use quando o usuário pedir para modernizar um dashboard, header, hero card, painel de perfil, card de usuário, banner, HUD ou disser que uma área do app ficou "obsoleta/simples/infantil".
---

# 🪟 Janela de Status — modelação de painéis e cabeçalhos

Padrão visual dos topos de página do Solo Routines (dashboard e perfil).
Substitui cabeçalhos genéricos ("emoji + título + card retangular") por uma
**interface diegética**: parece o sistema de status de um RPG, não um admin panel.

Referência viva no projeto:
- `webapp/frontend/css/status-window.css` — **todo o CSS deste padrão**
- `webapp/frontend/index.html` — busque `sys-plate` e `hunter-window`
- `webapp/frontend/js/pages/dashboard.js` — `renderPersonagem`, `_contar`, `_initFxJanela`
- `webapp/frontend/js/pages/perfil.js` — mesma linguagem reaproveitada

---

## 1. Os dois componentes

### A) Placa de Aquisição (`.sys-plate`) — substitui o `.page-header`

```
[glifo hexagonal]  TÍTULO EM SHIMMER
                   data · sussurro rotativo do Sistema
                   ───────── linha de energia varrendo
                                              [chip contextual] [botão de ação]
```

- **Sem emoji no título.** Um glifo SVG (hexágono com núcleo pulsante) flutua ao lado.
- Título em `Cinzel` com `letter-spacing: .22em` e shimmer prata→violeta→ciano.
- Cantos chanfrados por `clip-path` (a "janela do Sistema"), borda-esquerda acesa.
- Linha de energia com um `::after` branco varrendo em loop.
- **Chip contextual**: aparece só quando há algo acontecendo (ex.: "🌀 2 portões
  abertos") e é clicável, levando à ação.

### B) Janela do Hunter (`.hunter-window`) — o painel principal

Três colunas: **identidade visual | dados | métricas**.

1. **Hexágono de rank** (nunca círculo): avatar com `clip-path` hexagonal, anel
   `conic-gradient` girando na cor do rank, selo com a letra do rank cravado no
   canto, e — se for o Arquiteto — a aura de chamas por fora.
2. **Identidade**: nome em Cinzel com glow, título em itálico dourado, badges de
   rank/nível, e a **barra de XP viva**.
3. **Cristais** em losango (`clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)`),
   número em Orbitron com contagem animada e rótulo em maiúsculas espaçadas.

---

## 2. As cinco técnicas que fazem a diferença

### 2.1 A cor do rank comanda o painel inteiro
Uma variável CSS define borda, anel, selo, partículas e vinheta de uma vez:

```javascript
const RANK_CORES = { E:'#94a3b8', D:'#22d3ee', C:'#10b981',
                     B:'#3b82f6', A:'#a855f7', S:'#fbbf24', N:'#fb7185' };
janela.style.setProperty('--rank-cor', cor);
janela.style.setProperty('--rank-aura', cor + '26');  // 26 = ~15% alpha
```
```css
.hunter-window::after { background: radial-gradient(90% 120% at 12% 30%, var(--rank-aura), transparent 62%); }
.hunter-hex-rank { color: var(--rank-cor); border-color: var(--rank-cor); }
```
Progredir de rank **muda o clima do painel** — recompensa visual gratuita.

### 2.2 Contagem animada (números nunca "aparecem")
```javascript
_contar(el, alvo, dur = 900) {
  const t0 = performance.now();
  const passo = t => {
    const p = Math.min(1, (t - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);           // easeOutCubic
    el.textContent = Math.round(alvo * eased).toLocaleString('pt-BR');
    if (p < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}
```
Use `font-variant-numeric: tabular-nums` para os dígitos não dançarem.

### 2.3 Barra de progresso que reage ao estado
- Fluxo de luz percorrendo o preenchimento (`::after` + `translateX`)
- Marcações de 10% em `repeating-linear-gradient`
- **Estado de iminência**: ao passar de 85%, troca para gradiente dourado e pulsa
  (`.quase`) — o usuário *sente* que vai subir de nível

### 2.4 Cantos chanfrados = linguagem de HUD
```css
clip-path: polygon(0 0, calc(100% - 20px) 0, 100% 20px,
                   100% 100%, 20px 100%, 0 calc(100% - 20px));
```
Aplique na placa (14px) e no painel (20px). Detalhe pequeno, leitura imediata
de "interface de sistema".

### 2.5 Partículas locais reativas
Um `<canvas>` dentro do painel com ~26 partículas subindo devagar, pintadas com
a `--rank-cor` lida em tempo real. Custa quase nada e dá vida ao fundo.
Sempre cheque `canvas.isConnected` no loop para não vazar memória.

---

## 3. Enriquecimentos contextuais (o que eleva de bonito para vivo)

- **Relicário**: as últimas conquistas em medalha miniatura dentro do painel,
  clicáveis (reaproveite `ConquistaFX.miniMedalha(c, 34)`).
- **Sussurros rotativos**: frases do Sistema trocando a cada ~9s com fade,
  no lugar de um subtítulo estático.
- **Chip de estado**: só existe quando há algo agora (dungeon aberta, prazo
  correndo). Nada de espaço ocupado sem informação.
- **Estados apagados**: streak zerado = chama sem animação, `opacity:.45`,
  `grayscale(.7)`. O vazio também comunica.

---

## 4. Coerência entre páginas (regra)

Toda página que tiver um "hero" usa **as mesmas classes**: `sys-plate` e
`hunter-window`. Não recrie o estilo com CSS inline por página — foi assim que
o perfil ficou obsoleto enquanto o dashboard evoluía.

Ao criar uma página nova:
1. copie a estrutura da placa (troque título e sussurro);
2. reaproveite `.hunter-window` se houver dados de usuário;
3. só adicione CSS novo em `status-window.css`, nunca inline.

---

## 5. ⚠️ Armadilhas

1. **`<defs>` de SVG dentro de página escondida**: gradientes referenciados por
   `url(#id)` podem não resolver se o container estiver `display:none`.
   **Coloque os `<defs>` num SVG global no topo do `<body>`** e reutilize.
2. **IDs duplicados de gradiente** quebram o segundo uso — um `id` por documento.
3. **Foto circular dentro de hexágono**: remova `border-radius:50%` do `<img>`
   quando trocar a moldura, senão sobram cantos vazios.
4. **`overflow:hidden` no painel** corta a aura de chamas do avatar (pseudo-elemento
   com `inset` negativo). Use `overflow: visible` no wrapper do hexágono.
5. **Ações destrutivas no cabeçalho** (ex.: "Resetar progresso") — mova para um
   console de Arquiteto. Cabeçalho é navegação, não zona de perigo.
6. **`canvas` sem `isConnected`** no loop de animação = vazamento ao trocar de página.

---

## 6. Checklist

- [ ] Nenhum emoji como ícone principal de título (use glifo SVG)
- [ ] `--rank-cor` propagando para borda, anel, selo, partículas e vinheta
- [ ] Números com contagem animada + `tabular-nums`
- [ ] Barra com fluxo de luz, marcações e estado de iminência
- [ ] Cantos chanfrados por `clip-path`
- [ ] Chip contextual só quando há informação
- [ ] Mesmas classes reaproveitadas nas demais páginas
- [ ] `prefers-reduced-motion` desativando as animações perpétuas
- [ ] `node --check` nos JS · F5 testado · HTML balanceado
