---
name: cerimonia-de-conquista
description: Cria animações de conquista/badge no padrão Solo Routines — cerimônia em três atos com medalha SVG forjada, som sincronizado, card lateral (selo) e carimbo permanente no quadro de conquistas. Use quando o usuário pedir animação de conquista, badge, achievement, troféu, medalha, efeito de desbloqueio, level up, som de conquista, carimbo/selo, ou quiser melhorar um efeito de recompensa existente.
---

# 🏅 Cerimônia de Conquista — padrão Solo Routines

Este documento ensina a construir o efeito completo de desbloqueio de conquista:
**cerimônia central → som → card lateral → carimbo permanente**.

Arquivos de referência (copie e adapte, não reinvente):

| Arquivo | O que contém |
|---|---|
| `referencia/cerimonia.js` | `ConquistaFX` completo: fila, dedup, medalha SVG, 3 atos, selo, carimbo |
| `referencia/cerimonia.css` | Todos os keyframes e camadas |
| `referencia/sfx.js` | Motor de som com fallback sintetizado (Web Audio) |

> ⚠️ **Antes de escrever qualquer código, leia a seção 6 (Armadilhas).**
> Cada item ali é um bug que já aconteceu neste projeto e custou horas.

---

## 1. Anatomia: os três atos

Conquista é o evento mais raro do app. Não é um toast — é uma **cerimônia**.

```
ATO I  (0.0s)  IMPACTO
   flash dourado em tela cheia (0.7s, fade-out)
   3 bursts de partículas em cores diferentes (ouro / roxo / ciano, ~180ms entre si)
   som 'conquista' dispara AQUI (junto do flash, não depois)

ATO II (0.3s)  CLÍMAX
   medalha SVG "se forja": scale(0) rotate(-540deg) blur(12px) brightness(3)
                        → overshoot scale(1.14) → assenta em scale(1)
   camadas perpétuas: estrela girando 26s, brilho varrendo a borda 3.2s,
                      anel de runas em sentido inverso 18s
   texto sobe com delay 0.35s; nome em shimmer dourado líquido; +XP com delay 0.7s

ATO III (3.0s)  RESOLUÇÃO
   overlay recolhe (fade + scale 1.05)
   card lateral (selo) entra deslizando da direita — vive 6s
   carimbo bate no quadro permanente + som 'carimbo' aos 380ms + névoa dourada
```

Clique em qualquer momento **pula** para o Ato III.

---

## 2. Canal único (regra inegociável)

Todo o app dispara conquista em **um só lugar** — o interceptador da camada de
API. Nunca crie um segundo sistema.

```javascript
// dentro do wrapper de fetch/request, após obter `data`:
let novas = [];
if (data?.resultado?.conquistas?.length)       novas = data.resultado.conquistas;
else if (data?.novas_conquistas?.length)       novas = data.novas_conquistas;
else if (data?.eventos_xp?.conquistas?.length) novas = data.eventos_xp.conquistas;
if (novas.length && window.ConquistaFX) novas.forEach(c => ConquistaFX.show(c));
```

`ConquistaFX.show()` já resolve **fila** (uma cerimônia por vez) e **dedup**
(mesma conquista não repete em 15s, mesmo que dois endpoints a reportem).

Antes de criar qualquer coisa:
```bash
grep -rn "ConquistaFX\|showUnlockModal\|conquista" js/ | head -20
```
Se já existir um sistema, **substitua por dentro** (mantenha a interface antiga
delegando para a nova) — nunca rode dois em paralelo.

---

## 3. A medalha (o clímax não pode ser um emoji num círculo)

Gere SVG por código, com geometria calculada. Camadas de trás para frente:

1. **Estrela de 12 pontas** (loop trigonométrico, raio alternando 128/98) — gira lenta
2. **Corpo metálico**: `radialGradient` 4 stops, centro deslocado `cx=38% cy=30%`
3. **24 runas** gravadas no anel (loop de linhas curtas)
4. **Gema hexagonal** central com facetas brancas translúcidas
5. **Louros** laterais + **coroa** no topo
6. **Filete de brilho** varrendo a borda (`stroke-dasharray` + rotação infinita)
7. **O ícone da conquista entra incrustado na gema** — a arte é a moldura

```javascript
const pontas = [];
for (let i = 0; i < 12; i++) {
  const a = (Math.PI/6)*i - Math.PI/2;
  const rExt = i % 2 === 0 ? 128 : 98;
  pontas.push(`M ${130+88*Math.cos(a-Math.PI/12)} ${130+88*Math.sin(a-Math.PI/12)}
               L ${130+rExt*Math.cos(a)} ${130+rExt*Math.sin(a)}
               L ${130+88*Math.cos(a+Math.PI/12)} ${130+88*Math.sin(a+Math.PI/12)} Z`);
}
```

**Parametrize o tamanho.** A mesma função gera a medalha de 240px da cerimônia
e a de 34–52px do card lateral e do quadro permanente (`miniMedalha`).
Uma família visual só — é isso que faz parecer profissional.

---

## 4. Som

- `SFX.play('conquista')` no Ato I; `SFX.play('carimbo')` 380ms após o prepend do card.
- Procura `/sounds/nome.(mp3|ogg|wav)`; **se não existir, sintetiza** — o efeito
  nunca fica mudo enquanto o usuário não escolhe os arquivos.
- Receitas do fallback (em `referencia/sfx.js`):
  - *conquista*: arpejo E5→G#5→B5→E6 em senos + harmônico + shimmer detunado
  - *carimbo*: seno 150→48Hz em 0.18s + ruído branco filtrado (lowpass 900Hz)
  - *levelup*: arpejo maior ascendente + ruído suave no final
- Crie a pasta `sounds/` com um `LEIA-ME.txt` listando os slots e sirva-a no backend.

---

## 5. Card lateral (selo) e carimbo permanente

**Selo lateral** — entra com `translateX(120%) scale(.9)` + overshoot, empilha em
`flex-direction: column-reverse`, sai deslizando após 6s. Contém a medalha
miniatura, rótulo, nome e o +XP.

**Carimbo no quadro** — o card é adicionado com `prepend` e recebe:
```css
@keyframes cq-slam {
  0%   { transform: scale(2.1) rotate(-7deg); opacity: 0; filter: blur(5px); }
  55%  { transform: scale(.94) rotate(1.5deg); opacity: 1; filter: blur(0); }
  75%  { transform: scale(1.04) rotate(-.5deg); }
  100% { transform: scale(1) rotate(0); }
}
```
mais uma `<div>` de **névoa** dourada que expande e se dissolve por cima
(`radial-gradient` + `blur(10px)`, 2 animações encadeadas).

O card permanente **não pode ser feio**: fundo bronze-escuro, **borda de ouro
via `border-box` gradient**, nome em texto dourado metálico, lampejo varrendo
no hover e a medalha miniatura girando devagar. Ver `.conquista-mini` no CSS.

---

## 6. ⚠️ ARMADILHAS (bugs reais deste projeto)

1. **Duas classes de `animation` no mesmo elemento se atropelam.** CSS aceita só
   UMA declaração — a última regra vence e **cancela** a outra. Foi assim que os
   cards ficaram presos em `opacity:0` invisíveis. Solução: regra combinada.
   ```css
   .card.entrada.pulso {
     animation: entrar .55s var(--d) forwards,
                pulsar 2.8s calc(var(--d) + 800ms) infinite;
   }
   ```
2. **Container criado com `.hidden`/`display:none` e nunca revelado** — o toast
   original injetava itens num container invisível. Ninguém viu por meses.
3. **Sistemas concorrentes**: já houve TRÊS efeitos de conquista simultâneos aqui,
   dois deles quebrados. Sempre `grep` antes.
4. **z-index e stacking**: overlays de cerimônia usam 9000+. Um modal em z-1000
   ficou atrás de um painel criado depois no DOM → tela travada e embaçada.
5. **`overflow:hidden` no host decapita auras** de pseudo-elementos com `inset` negativo.
6. **Objeto global errado** (`Animations.levelUp` não existia; era `LevelUp.show`).
   Confira os `window.*` no fim do arquivo antes de chamar.
7. **Assinatura parcial**: `show(nivel)` sem rank/título imprimia "undefined" na tela.
   Sempre trate parâmetros opcionais.
8. **Emoji cru como arte principal** — proibido. Emoji só incrustado em vetor.

---

## 7. Processo obrigatório

1. `grep` por sistemas existentes → reusar/substituir por dentro
2. Implementar: DOM mínimo → camadas CSS → timing → som → versão reduced-motion
3. `node --check arquivo.js` em **todo** JS tocado
4. Renderizar o SVG e **olhar a imagem** antes de entregar (já entregamos medalha
   com miolo lavado e traço solto por pular esta etapa)
5. Disparar o evento real e conferir a cadeia completa
6. **Dar F5**: o que a cerimônia deixa (card no quadro) precisa sobreviver

### Console de testes (recomendado)
Crie um painel secreto (ex.: `Ctrl+Alt+A`) que dispare cada efeito na hora, sem
esperar o evento real e sem gravar nada: cerimônia, fila de 3, level-up,
explosão, selo isolado e cada som. Economiza horas de teste.

---

## 8. Paleta e tipografia

- Ouro: `#fbbf24` · `#f59e0b` · sombra `#78350f` · claro `#fff6d8`
- Arcano: `#7c3aed` · `#a855f7` · `#d8b4fe` · Ciano: `#22d3ee`
- Título cerimonial: `'Cinzel Decorative', serif`
- Números/HUD: `'Orbitron', monospace` + `font-variant-numeric: tabular-nums`
- Rótulos: `'Rajdhani', sans-serif`, uppercase, `letter-spacing: .2em+`

Shimmer dourado (nome da conquista):
```css
background: linear-gradient(100deg,#fff7e0 20%,#fbbf24 40%,#fff7e0 60%,#fbbf24 80%);
background-size: 220% auto;
-webkit-background-clip: text; background-clip: text; color: transparent;
animation: cq-shimmer 2.4s linear infinite;   /* to { background-position: -220% center } */
```

## 9. Checklist final

- [ ] Canal único (sem sistema paralelo)
- [ ] Três atos, com clímax vetorial parametrizado
- [ ] Fila + dedup
- [ ] Som nos dois momentos, com fallback sintetizado
- [ ] Selo lateral + carimbo permanente bonito (mesma família visual)
- [ ] Sem colisão de `animation`; z-index e `overflow` conferidos
- [ ] `node --check` limpo · SVG visto · F5 testado
- [ ] `prefers-reduced-motion` com versão calma
