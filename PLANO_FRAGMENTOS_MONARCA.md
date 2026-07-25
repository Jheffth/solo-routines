# Plano — Fragmentos do Monarca (moeda paga via Stripe)

> Documento de planejamento. **Nada foi implementado.** Aguarda aprovação.
> Fontes: documentação atual do Stripe (Checkout e Fulfillment), consultada
> em 25/07/2026, e o código atual do Solo Routines.

---

## 1. A moeda: identidade

**Nome:** Fragmento do Monarca — no uso curto, **Fragmentos**.
Os Monarcas são o ápice do universo Solo Leveling; a moeda que se compra com
dinheiro real fica associada ao topo, não ao esforço diário.

A separação das duas moedas precisa ser **óbvia à primeira vista**, porque é
ela que sustenta a promessa do produto:

| | Mana Coins | Fragmentos do Monarca |
|---|---|---|
| Como se obtém | cumprindo missões | comprando |
| Significado | esforço | apoio ao projeto |
| Cor | ouro (`--gold-xp` #f59e0b) | violeta-magenta (#a855f7 → #d946ef) |
| Forma | disco/moeda | estilhaço de cristal facetado |
| Fonte do número | `--font-digits` (Orbitron) | a mesma, para pertencer à família |

**Por que cores e formas diferentes:** se as duas parecerem a mesma coisa, o
hunter vai gastar uma achando que é a outra — e uma delas custou dinheiro.
Confusão entre moeda ganha e moeda paga é reclamação e estorno.

### Como aparece na tela

- **Carteira dupla no topo da Loja.** As Mana Coins como hoje; ao lado, os
  Fragmentos num selo violeta com o cristal em SVG animado (brilho lento,
  nunca piscando). Mesma altura, mesmo raio de borda, para lerem como par.
- **Cristal em SVG**, não emoji: facetado, com um brilho interno que percorre
  as faces devagar. Segue a linguagem das auras (SVG autossuficiente, com a
  animação embutida — a lição do bug em que o CSS não chegou e a aura sumiu).
- **Preço em Fragmentos** nos cards da loja usa o mesmo componente de preço,
  trocando o glifo e a cor via `--lj-cor`. O card já suporta isso.
- **Extrato de Fragmentos**: uma aba própria mostrando cada compra e cada
  gasto, com data e origem. Quem paga tem direito de ver para onde foi.
- **Vitrine de pacotes**: cards maiores, com o "mais popular" destacado. Sem
  contador regressivo, sem escassez artificial. O app é sobre disciplina;
  pressionar compra por urgência contradiz o produto.

---

## 2. A decisão que sustenta o resto

Você indicou: **cosméticos e assinaturas**, e possivelmente **equipamentos**
antes do lançamento.

Cosméticos e assinaturas são seguros. Sobre equipamentos, um alerta que
prefiro registrar agora, enquanto é barato mudar: se um equipamento comprado
com dinheiro der **mais XP, mais moedas ou vantagem de progresso**, o XP deixa
de significar esforço — e o produto que você vende é justamente a prova do
próprio esforço. Um equipamento que muda a **aparência** do hunter, ou que dá
conveniência neutra, não tem esse problema.

Sugestão: equipamento com **atributo estético e narrativo**, não numérico. Se
houver número, que ele seja obtido jogando, e só a **skin** seja comprável.
Fica seu, mas a arquitetura deste plano deixa a porta fechada por padrão: o
motor de entrega **recusa** qualquer efeito que altere XP ou nível, e abrir
isso exigirá uma mudança explícita e visível no código.

---

## 3. Arquitetura: livro-razão, não contador

O erro clássico é guardar `usuario.fragmentos = 500` e somar/subtrair. Com
dinheiro real isso é inaceitável: um número solto não responde "de onde veio",
não sobrevive a uma disputa com o cliente, e qualquer bug vira dinheiro
perdido sem rastro.

**Toda movimentação é uma linha imutável.** O saldo é consequência, não fonte.

### Tabelas novas

**`fragmentos_ledger`** — o livro-razão. Append-only; nada é editado ou
apagado, jamais.

| coluna | papel |
|---|---|
| `id` | |
| `usuario_id` | de quem |
| `delta` | + entrada, − saída (inteiro; nunca float em dinheiro) |
| `saldo_depois` | fotografia do saldo após esta linha (permite auditar a cadeia) |
| `motivo` | `compra`, `gasto`, `estorno`, `ajuste_arquiteto`, `bonus` |
| `referencia` | id da sessão Stripe, id do item comprado, etc. |
| `autor_id` | quem originou (nulo quando foi o Stripe) |
| `criado_em` | |

**`fragmentos_carteira`** — saldo materializado, para não somar o histórico a
cada leitura.

| coluna | papel |
|---|---|
| `usuario_id` | chave única |
| `saldo` | inteiro, **nunca negativo** |
| `total_comprado` | métrica de vida |
| `atualizado_em` | |

**`pagamentos`** — uma linha por tentativa de compra.

| coluna | papel |
|---|---|
| `id` | |
| `usuario_id` | |
| `pacote_id` | qual pacote |
| `stripe_session_id` | **UNIQUE** — a trava de idempotência |
| `stripe_payment_intent` | para conciliar estorno |
| `valor_centavos`, `moeda` | o que foi cobrado, como o Stripe informou |
| `fragmentos` | quanto foi creditado |
| `status` | `criado`, `pago`, `entregue`, `falhou`, `estornado` |
| `criado_em`, `entregue_em` | |

**`stripe_eventos`** — todo evento recebido, com `event_id` **UNIQUE**.
É o que impede o webhook de creditar duas vezes quando o Stripe reenvia.

**`assinaturas`** (fase 2) — `stripe_subscription_id` único, status, período
atual, plano.

---

## 4. Segurança

Você pediu reforço contra fraude. Abaixo, cada vetor e a defesa. Esta seção é
o coração do plano.

### 4.1 O cliente nunca credita saldo

**Não existirá nenhum endpoint que aceite "some X fragmentos".** Nem para
admin. Crédito só nasce de duas origens: um webhook Stripe verificado, ou um
ajuste do Arquiteto que grava `autor_id` no livro-razão. Se o endpoint não
existe, não há o que forjar.

### 4.2 Preço mora no servidor

O cliente manda apenas o **id do pacote** (`"pacote_medio"`). Preço, quantidade
de fragmentos e `price_id` do Stripe vivem num catálogo no servidor. É a
recomendação explícita do Stripe: *"Always keep sensitive information about
your product inventory, such as price and availability, on your server to
prevent customer manipulation from the client."*

Assim, adulterar a requisição não muda o valor: quem monta a sessão é o
servidor.

### 4.3 Assinatura do webhook

O endpoint de webhook é público (o Stripe precisa alcançá-lo), então a
autenticação é a **assinatura criptográfica**:

- ler o **corpo cru** da requisição — em FastAPI, `await request.body()`.
  **Armadilha real:** se o corpo for lido como JSON já parseado e depois
  re-serializado, a assinatura não confere e todo pagamento falha em silêncio;
- validar com `stripe.Webhook.construct_event(payload, sig_header, whsec)`;
- assinatura inválida → **400**, sem processar nada, sem vazar o motivo.

### 4.4 Idempotência (o ponto mais crítico)

A documentação do Stripe é explícita: a função de entrega *"might be called
multiple times, possibly concurrently, for the same Checkout Session"*.

Três camadas:

1. `stripe_eventos.event_id` **UNIQUE** — evento repetido bate na constraint
   e é descartado;
2. `pagamentos.stripe_session_id` **UNIQUE** — a mesma sessão nunca gera dois
   créditos;
3. o crédito só ocorre se `status != 'entregue'`, dentro de transação com
   **`SELECT ... FOR UPDATE`** na linha do pagamento.

Sem isso, um reenvio do Stripe (que acontece de rotina) dobraria o saldo.

### 4.5 Confirmar com o Stripe, não com o recado

O webhook diz apenas *qual* sessão. O servidor então **busca a sessão na API
do Stripe** e confere `payment_status != 'unpaid'`. Nunca confiamos em valores
que vieram no corpo da mensagem — mesmo assinado, é mais barato reconsultar do
que raciocinar sobre o que poderia ser adulterado.

### 4.6 Entrega dupla, crédito único

Seguimos a recomendação do Stripe: creditar **pelo webhook** (obrigatório) e
**também** na página de retorno, usando o `session_id` da URL. As duas chamam
a mesma função idempotente. Se o hunter perder a conexão após pagar, o webhook
resolve; se o webhook atrasar, a página resolve. Nunca as duas vezes.

### 4.7 Gasto sem corrida

Debitar usa atualização condicional atômica:

```sql
UPDATE fragmentos_carteira
   SET saldo = saldo - :custo
 WHERE usuario_id = :uid AND saldo >= :custo
```

Se afetou 0 linhas, não havia saldo. Duas abas abertas comprando o mesmo item
caro ao mesmo tempo não conseguem gastar o mesmo fragmento duas vezes.

### 4.8 Estorno e chargeback

Ouvir `charge.refunded` e `charge.dispute.created`. Ao receber:

- lançar `delta` negativo no livro-razão com motivo `estorno`;
- se o hunter já gastou, o saldo iria a negativo — **política necessária, e é
  decisão sua**: (a) permitir saldo negativo até quitar; (b) zerar o saldo e
  recolher os cosméticos entregues; (c) zerar e manter os cosméticos, aceitando
  a perda. Recomendo **(b)** para itens ainda não usados e **(c)** abaixo de um
  valor pequeno, porque cobrar de volta um item barato custa mais em suporte do
  que o item vale.

### 4.9 Segredos e superfície

- `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` **só** no ambiente do servidor;
- nunca no frontend, nunca no repositório, nunca em log;
- com **Checkout hospedado**, nenhum dado de cartão toca nosso servidor — o
  enquadramento PCI fica no nível mais leve (SAQ-A). É o motivo principal de eu
  recomendar o Checkout hospedado em vez de formulário próprio;
- HTTPS obrigatório; webhook fora da autenticação normal, protegido pela
  assinatura;
- **limite de taxa** na criação de sessões (ex.: 10/min por hunter), para não
  virar torneira de sessões;
- logs sem corpo completo e sem dado pessoal.

### 4.10 Auditoria

Nenhum fragmento aparece sem linha no livro-razão. Um ajuste manual do
Arquiteto grava quem fez. Uma tela de conciliação compara, por período, o total
creditado com o total pago no Stripe — divergência é alarme.

---

## 5. O fluxo, concretamente

```
1. Hunter escolhe um pacote na loja.
2. Front chama  POST /api/fragmentos/checkout  { pacote_id }
3. Servidor:
     valida hunter e pacote (preço vem do catálogo interno)
     cria Checkout Session (mode: 'payment')
       metadata: { usuario_id, pacote_id }
       success_url: .../loja?compra={CHECKOUT_SESSION_ID}
       cancel_url:  .../loja?cancelado=1
     grava `pagamentos` (status='criado')
     devolve session.url
4. Front redireciona para a URL do Stripe. (Nós não vemos o cartão.)
5. Hunter paga.
6a. Stripe → POST /api/fragmentos/webhook
      valida assinatura → registra event_id → entregar(session_id)
6b. Hunter volta em success_url → front chama
      POST /api/fragmentos/confirmar { session_id }  → entregar(session_id)
      (mesma função; a segunda chamada não faz nada)
7. entregar(session_id):
      busca a sessão no Stripe, confere payment_status
      trava a linha de pagamentos (FOR UPDATE)
      se já 'entregue' → sai
      credita: 1 linha no ledger + saldo atômico
      marca 'entregue'
8. Front recarrega a carteira; cerimônia de recebimento (sr_eventos).
```

Eventos a ouvir: `checkout.session.completed`,
`checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
`charge.refunded`, `charge.dispute.created`.

Os dois `async_*` importam porque métodos como Pix e boleto **não são
instantâneos** — o pagamento confirma depois, e sem esses eventos o hunter
pagaria e não receberia.

---

## 6. Pacotes

Proposta inicial (valores a ajustar por você, com bônus crescente para premiar
o pacote maior sem punir o menor):

| Pacote | Fragmentos | Bônus | Preço sugerido |
|---|---|---|---|
| Lasca | 100 | — | R$ 9,90 |
| Estilhaço | 550 | +10% | R$ 44,90 |
| Núcleo | 1.200 | +20% | R$ 89,90 |
| Coroa | 3.000 | +25% | R$ 199,90 |

O catálogo vive no servidor, cada pacote amarrado a um `price_id` criado no
painel do Stripe. Preço é definido lá, não no código — mudar valor não exige
deploy.

---

## 7. Assinaturas (fase 2)

Você pediu. É o mesmo Checkout com `mode: 'subscription'`, e acrescenta:

- eventos `customer.subscription.created/updated/deleted` e
  `invoice.paid` / `invoice.payment_failed`;
- tabela `assinaturas` com o status vindo do Stripe — **nunca inferido**;
- benefício recorrente (ex.: X Fragmentos por mês) creditado em `invoice.paid`,
  também idempotente por `invoice.id`;
- portal do cliente do Stripe para o hunter cancelar sozinho. Cancelamento
  fácil é exigência de consumidor e reduz disputa.

Recomendo **não** lançar assinatura junto com a moeda: uma coisa de cada vez,
porque cada uma tem seu conjunto de falhas.

---

## 8. Fases e verificação

| # | Entrega | Como verifico |
|---|---|---|
| 1 | Ledger, carteira, saldo | teste: crédito, gasto, saldo nunca negativo, gasto concorrente não duplica |
| 2 | Catálogo de pacotes + endpoint de checkout | teste: preço não vem do cliente; pacote inválido recusado |
| 3 | Webhook + entrega idempotente | teste: assinatura inválida → 400; **mesmo evento 3× credita 1×**; sessão não paga não credita |
| 4 | Loja: carteira dupla, pacotes, cristal SVG | você olha na tela (não tenho navegador) |
| 5 | Compra de cosmético com Fragmentos | teste: entrega + débito atômicos; falha na entrega não cobra |
| 6 | Estorno e disputa | teste: estorno lança negativo e aplica a política escolhida |
| 7 | Conciliação e extrato | teste: soma do ledger = saldo, sempre |

Os testes com Stripe usarão as chaves de **teste** e os cartões oficiais:
`4242 4242 4242 4242` (aprova), `4000 0025 0000 3155` (pede 3DS),
`4000 0000 0000 9995` (recusa). Localmente, `stripe listen --forward-to`.

---

## 9. O que depende de você

1. **Conta Stripe** ativada para receber, com dados da empresa/CPF-CNPJ.
2. **Chaves**: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`,
   `STRIPE_WEBHOOK_SECRET` (esta nasce ao criar o endpoint no painel).
3. **Produtos e preços** criados no painel; me passar os `price_id`.
4. **Endpoint de webhook** cadastrado apontando para
   `https://SEU_DOMINIO/api/fragmentos/webhook`.
5. **Decisões**: valores dos pacotes, e a política de estorno da seção 4.8.

### O que eu não posso decidir por você

Isto não é conselho jurídico nem contábil, e eu não sou qualificado para dá-lo:
venda de bem digital no Brasil envolve **direito de arrependimento** (o CDC
prevê 7 dias para compra fora do estabelecimento), **emissão fiscal** e
**tributos** sobre a receita. Vale confirmar com um contador antes de vender ao
primeiro cliente. Vale também verificar com o Stripe quais **métodos de
pagamento** estão disponíveis para a sua conta — no Brasil o **Pix** costuma
pesar mais que cartão, e ele é assíncrono, o que torna os eventos
`async_payment_*` da seção 5 obrigatórios, não opcionais.

---

## 10. Alternativas que considerei

- **Formulário de cartão próprio (Elements):** dá mais controle visual, mas
  traz dado de cartão para perto do nosso servidor e sobe o nível de exigência
  de PCI. Não compensa neste estágio.
- **Guardar só um contador `usuario.fragmentos`:** mais simples, e errado.
  Sem livro-razão não há como auditar nem responder a uma disputa.
- **Creditar direto no retorno do navegador, sem webhook:** é o atalho que
  parece funcionar e falha em produção — o Stripe avisa explicitamente que o
  cliente pode fechar o navegador antes de voltar.
- **Uma moeda só (Mana Coins compráveis):** destruiria o significado da moeda
  ganha. É o cerne da separação proposta.
