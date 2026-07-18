# ⚡ GUIA DE ANIMAÇÕES DO SISTEMA — Solo Routines

> **Para quem é este documento:** qualquer IA que trabalhe neste projeto
> (Antigravity com Gemini Pro, Sonnet 4.6, ou quem vier). Ele ensina a criar
> efeitos no padrão de qualidade da Cerimônia de Conquista, e — tão importante
> quanto — lista as armadilhas em que IAs anteriores caíram neste código.
> Leia ANTES de criar qualquer animação nova.

---

## 1. Filosofia: cerimônia, não notificação

Um efeito deste projeto nunca é "um toast". Eventos raros merecem **cerimônia
em atos**, com clímax e resolução. O padrão de referência (Cerimônia de
Conquista, em `frontend/js/animations.js` → `ConquistaFX`) tem três atos:

```
ATO I    Impacto      → flash de tela + explosão de partículas + som
ATO II   Clímax       → objeto central "se forja" (rotação+escala+blur→nítido),
                        camadas orbitais em movimento perpétuo, texto com shimmer
ATO III  Resolução    → recolhe para um artefato compacto e persistente
                        (selo no canto + carimbo permanente no quadro)
```

Regras de ouro:

- **Hierarquia de raridade.** Missão comum = sparks + XP float. Level-up =
  overlay de 3s. Conquista = cerimônia completa. Nunca gaste a cerimônia em
  eventos frequentes — inflação visual mata o impacto.
- **Nada estático, nada opaco.** Todo efeito tem transparência, glow e pelo
  menos uma camada em movimento perpétuo (anel girando, brilho varrendo,
  pulso respirando). Um PNG parado é derrota.
- **O clímax nunca é um emoji num círculo.** Emoji serve como *incrustação*
  dentro de arte vetorial (ex.: o ícone da conquista dentro da gema da
  medalha SVG), nunca como a arte principal.
- **Interrompível.** Cerimônias aceitam clique para pular. Respeite
  `prefers-reduced-motion` com uma versão calma (veja `ConquistaFX._versaoCalma`).

---

## 2. Arquitetura — onde cada coisa vive

| Peça | Arquivo | Papel |
|---|---|---|
| `ConquistaFX` | `frontend/js/animations.js` | Cerimônia + fila + dedup + selo + carimbo |
| `LevelUp`, `Particles`, `XPFloat`, `createSparks` | `frontend/js/animations.js` | Efeitos de suporte |
| `SFX` | `frontend/js/sfx.js` | Som: arquivo em `/sounds/` com fallback sintetizado |
| CSS da cerimônia (`cq-*`) | `frontend/css/animations.css` | Keyframes e camadas |
| Interceptador global | `frontend/js/api.js` (dentro de `request`) | **Canal ÚNICO** de disparo de conquistas |
| Aura do Arquiteto (`chamas-arquiteto`) | `frontend/css/pages.css` + filtro SVG no `index.html` | Exemplo de fogo procedural |

### O canal único (regra inegociável)

Toda conquista do app inteiro dispara em UM lugar: o interceptador no
`API.request` do `api.js`, que detecta `resultado.conquistas`,
`novas_conquistas` e `eventos_xp.conquistas` nas respostas e chama
`ConquistaFX.show(c)`. O `ConquistaFX` tem **fila** (cerimônias em sequência,
nunca sobrepostas) e **dedup** (mesma conquista não repete em 15s).

> ⚠️ **NUNCA crie um segundo sistema para o mesmo evento.** Antes de criar
> qualquer efeito, rode `grep -rn "NomeDoEvento\|ConquistaFX\|LevelUp" js/`
> e reuse o que existe. Já tivemos TRÊS sistemas de conquista concorrentes
> neste projeto ao mesmo tempo — dois deles invisíveis por bugs. Se o seu
> visual é melhor, SUBSTITUA o existente por dentro (mantendo a interface,
> como `ConquistasAnim.showUnlockModal` que hoje delega para `ConquistaFX`),
> não crie um paralelo.

---

## 3. Caixa de ferramentas (técnicas com exemplo real no código)

### 3.1 Camadas CSS empilhadas = aura viva
Pseudo-elementos `::before`/`::after` com `conic-gradient`/`radial-gradient`
+ `blur` + animações em velocidades diferentes. Exemplo: `.chamas-arquiteto`
(pages.css) — uma camada de labareda + um anel cônico girando.

### 3.2 Turbulência SVG = movimento orgânico (fogo, névoa, energia)
CSS puro faz formas rígidas. Para bordas que *serpenteiam*, use filtro SVG:

```html
<filter id="fx-chamas">
  <feTurbulence type="fractalNoise" baseFrequency="0.013 0.055" numOctaves="3">
    <animate attributeName="baseFrequency" dur="7s"
      values="0.013 0.055;0.018 0.075;0.011 0.05;..." repeatCount="indefinite"/>
  </feTurbulence>
  <feDisplacementMap in="SourceGraphic" scale="42"/>
</filter>
```
e no CSS: `filter: url(#fx-chamas) blur(1.5px);`. O ruído é vivo — nunca
repete um loop. Definição real no topo do `index.html`.

### 3.3 SVG paramétrico = arte de clímax
A medalha (`ConquistaFX._svgMedalha`) é gerada por template literal com
loops para as 12 pontas da estrela e as 24 runas do anel. Receita:

- `radialGradient` com 4 stops para metal (claro→ouro→bronze→sombra),
  centro deslocado (`cx=38% cy=30%`) para simular luz direcional;
- `<filter feGaussianBlur + feMerge>` para glow embutido no vetor;
- geometria por código (loops de `Math.cos/sin`) — nunca hardcode 24 linhas;
- facetas de gema = polígono translúcido branco por cima;
- o **ícone do evento entra incrustado** por cima (div absoluta), a arte é a moldura.
- parametrize o tamanho (a mesma função gera a medalha de 240px da cerimônia
  e a de 52px do relicário permanente — `miniMedalha`).

### 3.4 Canvas de partículas
`Particles.burst(x, y, quantidade, 'rgba(251,191,36,')` — já existe, reuse.
Para explosões em camadas, dispare 2–3 bursts com `setTimeout` de ~180ms
entre cores diferentes.

### 3.5 Timing que dá peso
- Entrada com impacto: `cubic-bezier(.34,1.56,.64,1)` (overshoot — a "forja").
- Forja completa: `scale(0) rotate(-540deg) blur(12px) brightness(3)` →
  overshoot `scale(1.14)` → assenta em `scale(1)`. Veja `@keyframes cq-forjar`.
- Stagger de listas: `animation-delay: var(--c-delay)` setado por JS por item.
- `backwards`/`forwards` fills SEMPRE que houver delay — sem isso o elemento
  pisca no estado final antes da animação começar.

### 3.6 Som
`SFX.play('nome')` procura `/sounds/nome.(mp3|ogg|wav)`; se não existir,
sintetiza via Web Audio (veja `_synth` em sfx.js — fanfarra por arpejo de
senos com harmônicos, impacto por seno grave 150→48Hz + ruído lowpass).
Novos sons: adicione um case no `_synth` E documente o slot no
`sounds/LEIA-ME.txt`. Som SEMPRE sincronizado com o momento visual exato
(ex.: o `carimbo` toca 380ms depois do prepend, quando o card "bate").

---

## 4. ⚠️ ARMADILHAS — bugs reais que já aconteceram AQUI

Cada item abaixo foi um bug real deste projeto, causado por uma IA. Não repita.

1. **Duas classes de animação no mesmo elemento se atropelam.** CSS só aceita
   UMA declaração `animation` — a última regra vence e cancela a outra. Foi
   assim que os cards de conquista ficaram PRESOS em `opacity:0` para sempre
   (a classe de pulso sobrescrevia a de entrada, que nunca rodava). Solução:
   regra específica para a combinação, com lista separada por vírgula:
   ```css
   .card.entrada.pulso {
     animation: entrar .55s var(--d) forwards,
                pulsar 2.8s calc(var(--d) + 800ms) infinite;
   }
   ```
2. **Container criado com `.hidden` e nunca revelado.** O toast de conquista
   original injetava itens num container `display:none` — 100% invisível,
   por meses. Se criar container dinâmico, crie-o SEM classes de escondimento.
3. **Stacking/z-index:** o modal de confirmação (z 1000) ficava ATRÁS do
   interior da dungeon (z 1000, criado depois no DOM) — tela embaçada e
   travada. Overlays de cerimônia usam z-index 9000+; consulte a tabela de
   camadas em `design-system.css` e o `dungeon.css` antes de escolher.
4. **`overflow:hidden` decapita pseudo-elementos.** Auras (`inset` negativo)
   precisam de `overflow: visible` no host — os avatares tinham
   `overflow:hidden` inline e a classe da aura precisa sobrescrever com
   `!important`.
5. **Import seco de dependência opcional derruba o servidor inteiro**
   (`import cloudinary` sem try/except matou o boot). Frontend análogo:
   sempre `typeof X !== 'undefined'` antes de chamar módulos de efeito.
6. **Objeto global errado:** `Animations.levelUp()` não existia (o export é
   `LevelUp.show`). Cheque `window.*` exports reais no fim do animations.js.
7. **Ícone = emoji cru.** Proibido como arte principal (ver Filosofia).
8. **Abrir portas antes da hora / regras de negócio no visual:** animação
   nunca altera regra (o "abre 15 min antes" quebrou a regra do portão).
   Efeito decora o estado; quem decide estado é o backend.

---

## 5. Processo obrigatório (siga na ordem)

1. **Reconheça o terreno:** `grep` por sistemas existentes do evento
   (`ConquistaFX`, `LevelUp`, `SFX`, classes `cq-`). Reuse ou substitua por
   dentro — nunca duplique.
2. **Desenhe os atos** (impacto → clímax → resolução) e a raridade do evento.
3. **Implemente por camadas:** estrutura DOM mínima, depois CSS de camadas,
   depois timing, depois som, depois versão reduced-motion.
4. **Valide sintaxe SEMPRE:** `node --check arquivo.js` para cada JS tocado.
5. **VEJA antes de entregar:** SVG novo? Renderize (ex.: `cairosvg` em Python)
   e olhe o resultado. A primeira versão da medalha tinha o miolo lavado —
   só foi percebido porque foi renderizada antes da entrega.
6. **Teste o canal:** dispare o evento real (ou simule a resposta da API) e
   confirme: cerimônia → som → resolução → persistência após F5.
7. **F5 é parte do teste.** O que o efeito deixa para trás (selo, card,
   registro) precisa sobreviver a recarregar a página.

---

## 6. Paleta e tipografia do Sistema (use os tokens, não invente cores)

- Ouro/conquista: `#fbbf24` (`--gold-bright`), `#f59e0b` (`--gold-xp`), sombra `#78350f`
- Roxo/arcano: `#7c3aed` (`--purple-main`), `#a855f7` (`--purple-glow`)
- Ciano/energia: `#22d3ee` (`--cyan-glow`) · Perigo: `#ef4444` (`--red-crit`)
- Título cerimonial: `var(--font-title)` (Cinzel Decorative)
- HUD/números: `'Orbitron', monospace` com `font-variant-numeric: tabular-nums`
- Rótulos: `var(--font-section)` (Rajdhani) com `letter-spacing` largo e uppercase

Texto dourado "líquido" (shimmer):
```css
background: linear-gradient(100deg,#fff7e0 20%,#fbbf24 40%,#fff7e0 60%,#fbbf24 80%);
background-size: 220% auto;
-webkit-background-clip: text; background-clip: text; color: transparent;
animation: cq-shimmer 2.4s linear infinite;   /* to { background-position:-220% center } */
```

---

## 7. Checklist final antes de entregar

- [ ] Reusei/substituí o sistema existente (não criei um paralelo)
- [ ] Três atos com clímax vetorial (nada de emoji cru como arte)
- [ ] Pelo menos uma camada em movimento perpétuo
- [ ] Som sincronizado (slot em `/sounds/` + fallback sintetizado)
- [ ] Fila + dedup se o evento pode disparar múltiplas vezes
- [ ] `prefers-reduced-motion` tratado
- [ ] Sem colisão de `animation` entre classes combinadas
- [ ] z-index consciente; `overflow` conferido; guards `typeof`
- [ ] `node --check` em todo JS tocado
- [ ] SVG renderizado e VISTO antes da entrega
- [ ] Estado persiste após F5

*Forjado pelo Arquiteto e seu Sistema. Mantenha o nível.*
