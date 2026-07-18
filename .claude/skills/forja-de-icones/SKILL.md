---
name: forja-de-icones
description: Forja ícones, favicons e .ico multi-resolução com qualidade de identidade visual e transparência real. Use quando o usuário pedir ícone, favicon, logo, emblema, ícone de atalho da área de trabalho, .ico, apple-touch-icon, ou quiser transformar um SVG/emblema existente do projeto em ícone. Cobre desenho vetorial paramétrico, aura/glow em pós-processamento e exportação em todos os formatos.
---

# ⚒ Forja de Ícones — padrão Solo Routines

Guia operacional para produzir ícones no nível da identidade deste projeto:
vetor nítido, **transparência real**, aura viva, e exportação completa
(favicon web + `.ico` multi-resolução para atalho do Windows).

Vale para qualquer IA no projeto (Claude, Gemini/Antigravity).

---

## 1. Regra zero: reaproveite a arte que já existe

Antes de desenhar qualquer coisa, procure um emblema já feito no projeto:

```bash
grep -n "<svg" webapp/frontend/index.html webapp/frontend/js/*.js
```

O emblema da SOLO nasceu do `<footer>` do `index.html`. **Ícone de empresa
tem que ser o MESMO símbolo que o app exibe** — nunca invente um paralelo.
Se existir, extraia e converta (Fluxo A). Só desenhe do zero se não houver
nada (Fluxo B).

---

## 2. Fluxo A — converter um SVG existente em ícone

O renderizador (`cairosvg`) **ignora ou estraga filtros SVG** (`feGaussianBlur`,
`feDropShadow`) e não executa animações CSS. Por isso: limpe o SVG, renderize
a arte crua, e **recrie o glow em pós-processamento com PIL**. Esse é o segredo
do acabamento.

```bash
pip install --break-system-packages cairosvg pillow
python3 .claude/skills/forja-de-icones/forjar_icone.py --html webapp/frontend/index.html
```

O script (nesta mesma pasta) faz o pipeline inteiro. Passos que ele executa,
para você entender e adaptar:

1. **Extrai** o `<svg>` do arquivo-fonte.
2. **Limpa**: remove `class="..."` de animação, converte `style="animation:..."`
   numa `transform="rotate(...)"` estática elegante, apaga arcos de
   `stroke-dasharray` (viram riscos soltos sem animação) e remove
   `filter="url(#...)"`.
3. **Renderiza** em ~86% do canvas (deixa margem para a aura não ser cortada).
4. **Pós-processa** (a parte que dá vida):
   - aura externa: desfoque forte do canal alfa, pintado na cor da marca;
   - glow interno: cópia desfocada da arte por baixo dela mesma;
   - composição: `aura → glow → arte nítida`.
5. **Exporta** todos os formatos.

---

## 3. Fluxo B — desenhar do zero (SVG paramétrico)

Nunca desenhe emoji num círculo. Construa geometria por código:

```javascript
// pontas de estrela por trigonometria — nunca hardcode
const pontas = [];
for (let i = 0; i < 12; i++) {
  const a = (Math.PI / 6) * i - Math.PI / 2;
  const r = i % 2 === 0 ? 128 : 98;          // alterna longa/curta
  pontas.push(`M ${cx + 88*Math.cos(a - Math.PI/12)} ...`);
}
```

Camadas de um emblema que funciona (de trás para frente):

| Camada | Função |
|---|---|
| Estrela/raios | Silhueta reconhecível em 16px |
| Corpo metálico | `radialGradient` 4 stops, centro em `cx=38% cy=30%` (luz direcional) |
| Runas/entalhes | Loop de linhas curtas — dá "artesanal" |
| Gema/núcleo | Polígono com gradiente + facetas brancas translúcidas por cima |
| Ornamentos | Coroa, louros, asas — assimetria proposital cria caráter |
| Símbolo | Lua, diamante, lâmina — a "assinatura" da marca |

Gradientes de metal (4 stops, sempre): `claro → cor → escuro → sombra`.
Ex. ametista: `#d8b4fe → #a855f7 → #581c87 → #2e1065`.

---

## 4. Formatos obrigatórios (exporte todos)

| Arquivo | Tamanho | Onde vai |
|---|---|---|
| `webapp/frontend/favicon.png` | 512×512 | aba do navegador |
| `webapp/frontend/apple-touch-icon.png` | 180×180 | atalho iOS/Android |
| `<nome>.ico` (raiz) | 256,128,64,48,32,16 | **atalho do Windows** |
| `<nome>_1024.png` | 1024×1024 | logo master (papelaria, redes) |

`.ico` **precisa** das 6 resoluções embutidas — o Windows escolhe conforme o
contexto; só 256px fica borrado na barra de tarefas:

```python
img.resize((256,256), Image.LANCZOS).save('marca.ico', format='ICO',
    sizes=[(256,256),(128,128),(64,64),(48,48),(32,32),(16,16)])
```

Registre o favicon no `<head>` e sirva no backend:

```html
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```
(rota `/favicon.png` e `/apple-touch-icon.png` no `main.py` — já existem aqui)

Instrução ao usuário para o atalho: *Propriedades → Alterar Ícone → Procurar →
selecione o `.ico`*.

---

## 5. Transparência — erros que arruínam o resultado

- Sempre `Image.new('RGBA', (S,S), (0,0,0,0))` — nunca fundo sólido.
- No `cairosvg`, **não** passe `background_color` (isso mata o alfa).
- Nada de "fundo escuro porque o app é escuro": o ícone aparece sobre o
  papel de parede do usuário e sobre abas claras.
- Aura vazando pela borda? Renderize a arte a 86% e centralize com margem.
- Para recortar bordas duras, multiplique o alfa por uma máscara circular
  levemente desfocada (`ImageChops.multiply`).

---

## 6. ⚠️ VEJA antes de entregar (não negociável)

Renderize e **olhe a imagem** com a ferramenta de leitura de imagem antes de
declarar pronto. Neste projeto, a primeira versão de um ícone saiu com o miolo
lavado e outra com um risco solto na lateral — ambos só foram pegos porque
foram inspecionados visualmente. Cheque:

- [ ] Reconhecível a **16px** (reduza e olhe — se virar borrão, simplifique)
- [ ] Fundo realmente transparente (abra sobre claro e escuro mentalmente)
- [ ] Sem elementos cortados nas bordas
- [ ] Sem traços soltos (restos de animação removida)
- [ ] Contraste do símbolo central contra o corpo
- [ ] Coerente com a paleta da marca

Depois de instalar: apague ícones antigos obsoletos da raiz (evita o usuário
escolher o errado) e diga onde cada arquivo foi parar.

---

## 7. Paleta da marca SOLO (use, não invente)

- Ametista: `#d8b4fe` · `#a855f7` · `#581c87` · `#2e1065`
- Metal escuro: `#1e1b4b` · `#020617` · `#000000`
- Borda/realce: `#c084fc` · `#7e22ce`
- Acento ouro (conquistas): `#fbbf24` · `#b45309`
