# Plano — Poderes em Insígnias e a Missão Passiva

> Documento de planejamento. **Nada foi implementado.**
> Baseado no código atual do Solo Routines, com as medições indicadas.
> Decisões do Arquiteto já tomadas estão marcadas com ✅.

---

## 1. A descoberta que muda o tamanho do trabalho

A missão passiva parece um tipo novo de missão. **Não é.** É a inversão de
uma regra que já existe.

| | Missão comum | Missão passiva |
|---|---|---|
| Estado natural | fracasso | **sucesso** |
| O hunter age para… | vencer | **perder** |
| Ao chegar no prazo | FRACASSADA | **CONCLUIDA** |

Tudo o mais é idêntico — mesma janela, mesmo auto-início, mesmo cronômetro,
mesma economia. Concretamente, `motors/fechamento.py` tem **uma linha**
(`ed.status = "FRACASSADA"`, linha 169) que precisa consultar a natureza da
rotina antes de decidir. O resto do motor não muda.

**E a janela noturna já funciona hoje.** Medido, sem escrever código novo:

```
hora_inicio 16:00 · hora_fim 05:00
→ início 25/07 16:00 · fim 26/07 05:00 · 780 min · auto_inicia True
```

`motors/prazos.py` já trata a janela que atravessa a meia-noite (foi escrita
para o caso "22:00 → 01:00"). O "Sem cafeína após as 16h" nasce funcionando.

**Consequência prática:** a missão passiva é o tipo especial mais barato de
todos. É por ela que vale começar — não pela booleana, não pela cadeia.

---

## 2. A missão passiva

### 2.1 Como ela vive um dia

```
16:00  auto-inicia (o motor já faz isso)          → EM CURSO
        cartão mostra: "Protocolo em curso · 13h 00m 00s"
        contador regressivo até 05:00
22:30  o hunter tomou café. Ele abre o cartão e clica CONFESSAR.
        → CONFESSADA. Meia punição. Streak preservado.
05:00  se ninguém confessou: CONCLUIDA automaticamente, recompensa cheia.
```

### 2.2 A confissão — e por que ela é o coração disto ✅

Ninguém consegue verificar se você tomou café às 22h. Se confessar custasse o
mesmo que ficar calado, o movimento racional seria o silêncio — e o app
viraria uma máquina de autoengano. Um registro em que o próprio dono não
confia não vale nada, e a missão passiva **inteira** depende dessa confiança.

**Decisão:** confessar custa **metade** da punição e **não quebra o streak**.
O extrato marca **"Confessada"**, não "Fracassada".

Assim a honestidade é a jogada mais barata, e o incentivo aponta para o lado
certo sem precisar de vigilância que não existe.

**Confissão tardia.** O hunter quebrou o protocolo às 04:00, dormiu, e às
09:00 a missão já constava CONCLUIDA. Ele ainda precisa poder confessar. A
janela de arrependimento vai até o fim do dia seguinte (23:59), e nesse caso
a recompensa já paga é **estornada** além da meia punição. Sem isso, a
confissão só funcionaria para quem está acordado — e o protocolo é de sono.

### 2.3 O que muda no banco

Uma coluna em `Rotina`, e nada mais:

```python
natureza = Column(String(20), default="ATIVA")   # ATIVA | PASSIVA
```

**Não** criamos `RotinaPassiva`, nem tabela nova. O `CONTRATO_MISSOES_ESPECIAIS`
proíbe o quarto tipo de missão, e aqui a proibição nem aperta: passiva é um
adjetivo da rotina, não outra coisa.

Em `ExecucaoDia`, o desfecho da confissão precisa de marca própria — ela não é
fracasso nem conclusão:

```python
confessada_em = Column(DateTime, nullable=True)
```

O `status` recebe o valor novo `CONFESSADA`. O cartão já lê `STATUS[...]`, então
basta uma entrada no mapa e um glifo no alfabeto.

### 2.4 O que muda no motor

| Arquivo | Mudança |
|---|---|
| `motors/fechamento.py` | `fechar_vencidas`: se `natureza == PASSIVA`, o vencimento **conclui** em vez de fracassar |
| `motors/economia.py` | `liquidacao` ganha o desfecho `confessada`: metade da punição, zero recompensa |
| `motors/gamificacao.py` | `atualizar_streak` passa a ignorar a confissão (não quebra a sequência) |
| `routers/execucoes.py` | `POST /execucoes/confessar` |
| `js/missao-card.js` | botão Confessar no cartão passivo em curso; selo "Confessada" |
| `js/forja-missao.js` | modalidade Passiva no lançador (só com VIP — ver §3) |

### 2.5 Riscos identificados

**O cronômetro fica 13 horas na tela.** Um contador que corre a noite toda é
diferente de um que corre 2 horas: precisa ser sóbrio, não pulsante. Sugiro
que o cartão passivo em curso use o tom neutro e só fique urgente na última
hora — o oposto da missão comum, onde a urgência cresce.

**Auto-conclusão às 05:00 sem ninguém olhando.** O auto-início é calculado na
leitura (decisão anterior, para não exigir worker acordado). A auto-conclusão
tem o mesmo desenho, e aqui isso é *melhor*: o hunter abre o app às 07:00 e
encontra a missão já cumprida, com a hora correta (05:00), não a hora em que
ele abriu. É o mesmo cuidado que já tomamos com `iniciada_em`.

**Protocolo que atravessa dois dias.** A instância nasce no dia 25 e termina
no 26. O `ExecucaoDia.data` é 25 — a data de *nascimento*. Isso já é assim
para a janela 22:00→01:00 e o extrato agrupa por esse dia. Não muda; só
precisa estar claro na tela ("iniciada ontem às 16:00").

---

## 3. Poderes em insígnias — a Insígnia VIP

### 3.1 A separação que evita a bagunça

Uma insígnia é **arte e reconhecimento**. Um poder é **uma permissão com
prazo**. Amarrar os dois no mesmo registro parece economia e vira problema no
primeiro caso divergente: o Arquiteto quer dar 7 dias de acesso a um hunter
sem lhe dar a medalha; ou o hunter cancela a assinatura e **mantém a medalha**
como troféu de quem já foi VIP, sem manter o acesso.

Por isso:

```
Conquista/ConquistaUsuario  →  a MEDALHA. Permanente. Já existe, não muda.
outorga                     →  a PERMISSÃO. Tem validade. Tabela nova.
```

```python
class Outorga(Base):                     # o poder, com prazo
    __tablename__ = "outorgas"
    id          = Integer
    usuario_id  = FK(usuarios)
    poder       = String(40)             # "missoes_especiais"
    origem      = String(30)             # "assinatura" | "arquiteto" | "promo"
    concedida_em = DateTime
    expira_em   = DateTime(nullable=True)   # null = não expira
    revogada_em = DateTime(nullable=True)
    referencia  = String(80)             # id da assinatura no Stripe
```

**Um poder, muitas fontes.** A mesma permissão pode vir da assinatura, da mão
do Arquiteto ou de uma promoção — e quem consome não precisa saber de onde
veio. É o mesmo padrão de `motors/cosmeticos.py` e `motors/economia.py`: uma
fonte única que responde a pergunta, em vez de cada router decidir sozinho.

```python
# motors/poderes.py — a fonte única
def tem(db, usuario, poder) -> bool
def expira_em(db, usuario, poder) -> datetime | None
def conceder(db, usuario, poder, dias=None, origem="arquiteto", referencia=None)
def revogar(db, usuario, poder, motivo)
```

### 3.2 Os poderes previstos

| Poder | O que destrava |
|---|---|
| `missoes_especiais` | criar missões passivas (e, depois, booleanas e em cadeia) |
| `altar_loadout` | equipar relíquias no Altar (quando existir) |
| `cosmeticos_vip` | auras e molduras exclusivas |

Começar com **um só**: `missoes_especiais`. Os outros entram quando existirem.

### 3.3 A regra que não pode ser quebrada

> **Poder destrava CONTEÚDO, nunca multiplica GANHO.**

Nenhuma outorga concede bônus de XP, multiplicador ou desconto de punição.
Isso é o que separa "assinar dá acesso" de "assinar compra nível".

E — ponto importante — essa promessa **só é verdade com o teto diário**.
Ver §4.

### 3.4 Assinatura VIP ✅

**Decisão:** assinatura recorrente via Stripe (Stripe Subscriptions), não item
avulso. Renova sozinha; cancelar interrompe na virada do ciclo.

Fluxo:

```
Checkout (Stripe)
   → webhook customer.subscription.created   → outorga(dias=31)
   → webhook invoice.paid                    → estende +31 dias
   → webhook customer.subscription.deleted   → deixa expirar (NÃO revoga na hora)
   → webhook invoice.payment_failed          → carência de 3 dias, depois expira
```

Três cuidados que a documentação do Stripe cobra e que costumam ser esquecidos:

1. **O webhook é a verdade, não o retorno do navegador.** O hunter pode fechar
   a aba antes do redirecionamento; a outorga precisa nascer do webhook.
2. **Idempotência.** O Stripe reenvia eventos. Guardar `event.id` processado
   evita conceder 31 dias três vezes pelo mesmo pagamento — o mesmo princípio
   de "ledger, não contador" do plano de Fragmentos.
3. **Assinar com folga.** A outorga expira 31 dias depois, não 30: se a
   renovação atrasar algumas horas, o hunter não perde acesso no meio da noite.

**Cancelamento mantém a medalha.** A Insígnia VIP fica no altar dele como
registro de que já foi — só o poder expira. É por isso que os dois são
separados.

### 3.5 O que acontece quando o poder expira

A pergunta que decide o desenho: **o que acontece com as missões passivas que
o hunter já criou?**

Recomendação: elas **continuam funcionando**. O poder é para *criar*, não para
*manter*. Tirar do hunter um protocolo de sono que ele mantém há 40 dias
porque o cartão de crédito venceu é punir o hábito — exatamente o contrário
do que o app existe para fazer. Ao expirar, ele perde a capacidade de criar
novas e de editar as existentes, mas o que está de pé segue de pé.

---

## 4. O teto diário de XP — agora não dá mais para adiar ✅

Medido: `TETO_XP = 10.000` em `motors/economia.py` é teto **por missão**. Não
existe orçamento diário.

Sem teto diário, "VIP destrava conteúdo, não multiplica XP" é **falso**: o
hunter VIP tem mais missões pagando XP por dia, logo sobe mais rápido. Com
assinatura paga por dinheiro real, isso é literalmente dinheiro comprando
nível.

**Decisão:** a passiva paga XP **e o teto diário entra no mesmo lote.**

```
teto_diario_xp  → novo parâmetro na Balança, editável pelo Arquiteto
```

Com ele, conteúdo extra **compete** pelo mesmo orçamento em vez de somar — e a
promessa vira estrutura, não texto de marketing. Como efeito colateral bom,
fecha também a quinta porta do exploit antigo: cadastrar cinquenta missões
triviais e subir de nível com elas.

Detalhe de desenho: ao bater o teto, a missão **ainda conclui** e ainda paga
Mana. Só o XP para. O extrato mostra "teto diário atingido" para o hunter não
achar que é bug — número que some sem explicação vira reclamação.

---

## 5. Ordem de execução

Cada fase entrega algo verificável sozinho.

| # | Fase | Entrega | Depende de |
|---|---|---|---|
| 1 | **Teto diário de XP** | parâmetro na Balança + corte no `aplicar_xp` + aviso no extrato | — |
| 2 | **Motor de poderes** | `Outorga`, `motors/poderes.py`, concessão pelo Arquiteto | — |
| 3 | **Missão passiva** | `natureza`, desfecho invertido, Confessar, cartão | 1, 2 |
| 4 | **Assinatura VIP** | Stripe Subscriptions, webhooks, insígnia + outorga | 2, 3 |
| 5 | *(depois)* | booleanas e cadeias, sobre `vinculo_missao` | 3 |

**A fase 1 vem primeiro de propósito.** É a única que, se ficar para depois,
obriga a refazer as outras: uma vez que hunters pagantes estiverem ganhando XP
sem teto, impor o teto vira mudança retroativa de regra em cima de gente que
pagou.

**A fase 2 antes da 3** porque a passiva já nasce trancada atrás do poder — e
uma trava colocada depois sempre esquece uma porta. A do lançador, a da API, a
da edição. São quatro portas, e nós já contamos essa história uma vez.

---

## 6. Verificação planejada

O que cada fase precisa provar, por execução:

**Teto diário** — um hunter que conclui 30 missões triviais num dia não passa
do teto; a missão 31 conclui, paga Mana e zero XP; o teto reinicia à
meia-noite de Brasília (não UTC).

**Poderes** — hunter sem outorga recebe 403 ao criar passiva, pela API direta,
não só pela tela; outorga expirada não vale; outorga do Arquiteto e da
assinatura são indistinguíveis para quem consome; revogar não apaga a medalha.

**Passiva** — o dia inteiro com relógio na mão, como o teste do Banho
Revigorante: 15:59 pendente, 16:00 em curso, 22:30 confissão (meia punição,
streak intacto), e num segundo cenário 05:00 conclusão automática com
recompensa cheia e `concluida_em` marcando 05:00, não a hora em que o hunter
abriu o app.

**Assinatura** — webhook duplicado não concede 62 dias; falha de pagamento
respeita a carência; cancelamento mantém a insígnia e deixa expirar o poder;
missão passiva criada antes segue funcionando depois do vencimento.

---

## 7. Ressalvas honestas

Não tenho navegador: nada aqui foi verificado visualmente, e a parte do
Stripe é planejamento sobre documentação, não sobre integração rodando.

E uma dúvida de produto que eu não sei responder e você sabe: um protocolo de
13 horas ocupando o cartão a tarde e a noite inteiras pode cansar a tela do
Dashboard. Talvez missões passivas mereçam uma faixa própria — "Protocolos em
vigor" — em vez de disputar espaço com as missões que pedem ação. Vale um
protótipo na Forja de Testes antes de decidir.
