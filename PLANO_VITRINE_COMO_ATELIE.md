# A Vitrine como Ateliê — do preview ao lugar definitivo

> Documento de arquitetura. **Nada foi implementado.**
> Todos os números foram medidos no código atual.

---

## 1. A pergunta

> "Há uma forma de, no lugar do hunter-card, criar um container vazio que
> suporte um projeto vindo da vitrine para compô-lo permanentemente? E que a
> vitrine seja onde criamos, aperfeiçoamos, testamos, aplicamos — e no fim
> seja o recipiente de todas as nossas criações."

**Sim, e o projeto já pede isso por outro motivo.** Mas há uma armadilha na
formulação, e ela é a parte importante da resposta.

---

## 2. O que o código diz hoje

| Medida | Valor |
|---|---|
| Lugares que tocam `#hunter-card` | **8** (dashboard, arquiteto-console, index) |
| IDs `dash-*` que o Dashboard lê dentro da janela | **14** |
| Linhas de `dashboard.js` que são desenho/animação da janela | **~310 de 1.231 (25%)** |
| Implementações do "cartão do hunter" no app | **2** |

Essa última linha é o argumento decisivo. `perfil.js` tem
`renderHeroCard()` desenhando **o mesmo cartão de novo**, com outro HTML,
outros ids (`perfil-hunter-card`) e outra formatação de XP.

É exatamente o padrão que este projeto já pagou caro três vezes: catálogo de
auras duplicado, dois relógios, duas tabelas de recompensa. A correção foi
sempre a mesma — **fonte única** (`motors/cosmeticos.py`, `motors/tempo.py`,
`motors/economia.py`). Aqui a fonte única ainda não existe.

Ou seja: o slot não é só para acomodar a V4. Ele resolve uma duplicação que
já está lá.

---

## 3. A armadilha da formulação

> "que a vitrine seja o recipiente de todas as nossas criações"

Se "recipiente" quiser dizer **onde o código mora**, a vitrine vira um segundo
aplicativo dentro do aplicativo — e nós já sabemos como isso termina, porque
está escrito no `PLANO_DUNGEONS_NIVELAMENTO.md`: 5.513 linhas fora da corrente
principal, zero teste, zero uso dos motores.

O sintoma já começou. Hoje `htmlV4` mora **dentro** de `estandarte.js`,
misturado com a moldura da própria vitrine: os botões de versão, o painel de
controles, o rodapé. São 1.285 linhas de JS e 1.477 de CSS num arquivo só,
com **23 seletores definidos mais de uma vez**.

**A correção da formulação:** a vitrine é um **HOSPEDEIRO**, não uma **CASA**.

```
    A PEÇA          mora em arquivo próprio, sabe se desenhar
       ↓
  ┌────┴────┐
VITRINE   DASHBOARD        dois hospedeiros, mesmo código
(ensaio)   (definitivo)
```

Com isso, "aplicar" deixa de ser copiar código de um lugar para outro — e vira
trocar uma linha de preferência. É a diferença entre um ateliê e um depósito.

---

## 4. O contrato

Uma peça é um objeto que responde quatro perguntas. Nada além disso.

```js
window.Pecas.registrar({
  id:      'banner-v4',
  nome:    'Portal V4',
  familia: 'banner',              // o tipo de slot que ela preenche
  precisa: ['hunter', 'reliquias', 'aura'],   // dados que quer receber

  montar(el, dados, host) { ... },  // desenha dentro de `el`
  destruir() { ... },               // solta timers e listeners
  opcoes: { campo: ['petroleo','abissal','brasa'] },  // o que a vitrine oferece
});
```

**`destruir()` não é opcional, e nós temos a prova.** O carrossel da V4 cria
um `setInterval` de 5s e o `fechar()` da vitrine não o limpa — ele segue
girando contra um `.pt-v4-grid` que já saiu do DOM. Uma peça que não sabe
morrer contamina o app que a hospeda. É a mesma disciplina do
`MissaoCard.pararTimer()`.

**`precisa` inverte a dependência, e isto resolve a colisão de IDs.** Hoje a
V4 usa `dash-btn-trocar-aura` e `dash-altar` — ids que o `dashboard.js` já
possui, e que ele *remove e recria* na linha 968. A peça está tendo que
conhecer o hospedeiro.

Com o contrato é o contrário: a peça **declara** o que quer, o hospedeiro
**entrega**. A peça nunca escreve um id do Dashboard.

```js
// dentro da peça — nada de getElementById('dash-...')
el.querySelector('[data-acao="trocar-aura"]').onclick = () => host.acao('trocar-aura');
```

---

## 5. O slot

No lugar da janela atual, um contêiner vazio:

```html
<div id="slot-banner" data-slot="banner" data-peca-padrao="hunter-card-classico"></div>
```

E um módulo pequeno que o preenche:

```js
Slots.montar('banner', { hunter, reliquias, aura });
```

**A regra que mantém tudo de pé:**

> **O SLOT é dono dos DADOS. A PEÇA é dona dos PIXELS.**

O `dashboard.js` continua buscando perfil, relíquias e aura — isso é trabalho
dele. O que ele para de fazer é **desenhar**. Os ~310 linhas de desenho saem
de lá e viram uma peça (`hunter-card-classico`), que é só mais uma no
registro. E o `perfil.js` passa a montar a mesma peça no slot dele, em vez de
redesenhar tudo.

---

## 6. Por que isto NÃO quebra o projeto

Cinco garantias, em ordem de importância:

**1. A peça padrão é a de hoje.** O primeiro passo é empacotar o hunter-card
atual como peça, sem mudar um pixel. Se o slot funcionar com ela, ele funciona
— e nada mudou na tela. Só depois a V4 entra como opção.

**2. Fallback obrigatório.** Se a peça escolhida não existir, falhar ao montar
ou lançar erro, o slot monta a padrão e registra no console. O hunter nunca vê
um retângulo vazio no lugar do próprio perfil.

**3. A troca é uma preferência, não um deploy.** `usuarios.banner_id` (ou
`localStorage`, na primeira versão). Voltar atrás é trocar um valor — não
reverter commit.

**4. A vitrine vira o teste.** Ela já monta as peças; passa a montá-las **pelo
mesmo caminho** que o Dashboard usa. Se quebrar, quebra no ensaio.

**5. Um teste de contrato, executável.** Para cada peça registrada: monta num
DOM, confere que desenhou, chama `destruir()`, e verifica que **zero timers
sobraram**. É o teste que teria pego o vazamento da V4 antes de você.

---

## 7. O caminho, em cinco passos

| # | Passo | Entrega | Risco |
|---|---|---|---|
| 1 | `js/pecas.js` — registro e contrato | ~120 linhas, nada muda na tela | nenhum |
| 2 | Empacotar o hunter-card ATUAL como peça | tela idêntica, código movido | baixo |
| 3 | Slot no Dashboard, montando a peça padrão | tela idêntica | baixo |
| 4 | V4 vira peça (Abissal por padrão) e entra como opção | você escolhe na vitrine | médio |
| 5 | `perfil.js` monta a mesma peça | some a segunda implementação | médio |

**O passo 2 é o que decide tudo.** Se o hunter-card atual couber no contrato
sem contorções, o contrato está certo. Se precisar de exceções, é porque o
contrato está errado — e é melhor descobrir ali, com uma peça que já funciona,
do que depois com três.

**Antes do passo 4**, corrigir os três achados da V4: o vazamento do
intervalo, a colisão de IDs (que o contrato resolve sozinha) e a epígrafe
posicionada fora da caixa — ela é `position: absolute; top: calc(100% + 85px)`
dentro de um banner com `overflow: hidden`, e o bloco de contenção **muda** no
mobile, porque uma media query torna o núcleo `position: static !important`.

---

## 8. O que isso destrava depois

O mesmo registro serve para tudo o que já está na fila:

- **cartões de missão** — o `MissaoCard` já é quase uma peça; falta o contrato
- **naturezas de dungeon** — `PADRAO`/`AGENDADA`/`RESISTENCIA` como peças, e as
  Aparições (`BEM_ESTAR`, `EVENTO_ALEATORIO`) como uma família própria
- **auras e insígnias** — já têm registro próprio; entram como famílias
- **temas de banner** — Petróleo, Abissal, Brasa viram opções da peça

A vitrine passa a listar tudo o que existe **sem catálogo escrito à mão** —
que é a lição que a Forja de Testes já aprendeu quando parou de manter a lista
de emblemas na unha.

---

## 9. Ressalva honesta

Não tenho navegador: a parte de layout é análise de código, não do renderizado.
E há um custo que vale dizer em voz alta — o passo 2 mexe em 25% do
`dashboard.js`, num arquivo sem teste automatizado. É o único ponto do plano em
que eu recomendaria escrever a verificação **antes** de mover o código.
