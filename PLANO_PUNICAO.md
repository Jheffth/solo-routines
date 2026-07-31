# A Missão de Punição e o Eco do Sistema

> "Você acha que o Sistema brinca, Jogador?"

Decisões do Arquiteto que este plano executa:

- é **missão**, não portal — o portal fica para a reescrita da Dungeon;
- **não trava nada**. O cartão fica no topo do Extrato, sempre, e é
  **acumulativo**;
- o gatilho é **falha repetida ou crítica**, não qualquer deslize;
- o hunter **escreve a própria punição** no lançador;
- e o momento do fracasso precisa ser **lindo**: esmaecer, branco
  gélido, sussurro, frase de impacto.

---

## 1. Duas descobertas antes do desenho

### O efeito que você amou foi um acidente

Você lembrou de frases de impacto tomando a tela do celular, e de nunca
ter visto no computador. Achei o motivo em `css/dungeon.css:607`:

```css
@media (max-width: 1100px) { .dg-col-feed { grid-column: 1 / -1; } }
```

Os "Ecos da Masmorra" são uma das três colunas no monitor. Abaixo de
1100px viram a largura inteira. **Nunca foi um momento desenhado — foi
o grid se reorganizando.**

Isso é uma boa notícia: significa que a peça que você quer ainda não
existe, e nasce agora sem ter que respeitar nada.

### "Jogador" é a chave do reskin

Você notou de passagem e é o achado mais valioso desta conversa.
"Jogador" resolve o `agente` do PLANO_LEXICO: é vocabulário de Sistema,
não de Solo Leveling, e soa **mais** ameaçador que "Hunter" na boca de
quem está te punindo. As frases do Eco já nascem com ele.

---

## 2. A cor: gélido, não vermelho

A punição **não pode ser vermelha**. Crítica já é `#e11d48`, e vermelho
neste app significa *urgência* — algo que ainda dá para salvar.

A punição não é urgente. Ela é **consequência**, e já aconteceu.

```
  --pun-fundo:  #060910      quase preto, azulado
  --pun-borda:  #93c5fd      azul-gelo, 22% de opacidade
  --pun-texto:  #dbeafe      branco gélido — o da sua descrição
  --pun-brilho: #bfdbfe      o halo do Eco
```

Frio lê como "o Sistema não está com raiva; ele está registrando". É
mais assustador que raiva, e — o ganho prático — **um cartão de punição
nunca vai ser confundido com uma missão crítica na lista.**

---

## 3. O ECO — a peça nova

Um componente próprio, `js/eco.js`, porque ele vai servir três donos: a
punição agora, a Dungeon na reescrita, e qualquer momento futuro em que
o Sistema precise falar alto.

### A coreografia, em quatro tempos

```
  0,0s   a tela ESMAECE            blur(3px) + brightness(.35), 700ms
  0,4s   o sussurro entra          áudio, volume baixo, sem eco de sala
  0,6s   a frase SURGE do centro   opacity 0→1, scale 1.06→1, letter-spacing
                                   .4em→.12em  (a frase "se assenta")
  2,8s   a frase RESPIRA           uma pulsação lenta de brilho
  4,5s   tudo se desfaz            e o cartão fracassado fica visível atrás
```

**O detalhe que faz funcionar:** a tela não fica preta. Ela fica
**embaçada e escura, com o cartão fracassado ainda legível por trás**.
O Sistema não te tira do lugar — ele te faz olhar.

### Regras que o componente carrega

- **Fila, nunca sobreposição.** Dois ecos ao mesmo tempo viram ruído.
  Um espera o outro, como as cerimônias já fazem.
- **`prefers-reduced-motion`** corta o movimento e mantém a frase.
- **Esc fecha.** Um efeito bonito que prende o hunter deixa de ser
  bonito na terceira vez.
- **Mesmo desenho no celular e no monitor** — foi a falta disso que
  escondeu o efeito de você.
- **O som pode ser recusado.** Autoplay de áudio é bloqueado por padrão
  em navegador; o eco funciona mudo e o som é um bônus, nunca a peça.

### As frases

Três intensidades. O Sistema **muda de tom conforme a dívida cresce** —
é isso que cria pavor sem precisar travar nada.

**Primeira falha — constatação seca**

> O Sistema registra.
> Você não cumpriu. Isso ficou anotado.
> Uma dívida foi aberta em seu nome, Jogador.

**Reincidência (2 a 3 pendentes) — o Sistema te encara**

> Você acha que o Sistema brinca, Jogador?
> Duas dívidas. O Sistema está contando.
> Não confunda paciência com permissão.
> Você prometeu. O Sistema apenas escutou.

**Acúmulo (4 ou mais) — frio total**

> Quatro. O Sistema parou de perguntar por quê.
> Não há punição maior que carregar o próprio registro.
> Continue. O Sistema tem mais tempo que você.

> **Lacuna preenchida:** as frases vivem em `motors/ecos.py` e viajam
> pela API. No cliente, elas seriam texto que o Arquiteto não consegue
> ajustar sem deploy — e este projeto já decidiu essa questão na
> Balança.

---

## 4. O PACTO — onde as penitências moram

### O lançador NÃO ganha campo nenhum

Minha primeira versão punha um campo de punição em cada missão, com uma
"sugestão do dobro". O Arquiteto derrubou por dois motivos, e o segundo
é mais grave que o primeiro:

1. **Vira burocracia.** Se preencher a missão fica mais trabalhoso que
   fazê-la, o hunter para de cadastrar. O lançador já tem 17 blocos.

2. **"O dobro" só existe para missão quantitativa.** "Ler 5 páginas"
   dobra. **"Passar fio dental" não dobra.** Eu desenhei uma sugestão
   que funcionava nos meus três exemplos e travava no quarto — e travava
   exatamente no instante em que a pessoa está preenchendo.

A saída do Arquiteto resolve os dois de uma vez: **desacoplar a
penitência da missão que falhou.**

> Não é preciso saber o que pune "fio dental". A penitência é um
> **preço**, não um refazer.

### Como funciona

O hunter cadastra, UMA VEZ, quantas penitências quiser:

```
  ┌─── O PACTO ────────────────────────────────────────────┐
  │  O que você deve ao Sistema quando falhar.             │
  │  Ele escolhe qual cobrar. Você não.                    │
  │                                                        │
  │   ⚖  Fazer 30 abdominais                        ✎  ✕  │
  │   ⚖  10 flexões                                 ✎  ✕  │
  │   ⚖  20 minutos de leitura em pé                ✎  ✕  │
  │                                                        │
  │   [ + acrescentar ao pacto ]                           │
  └────────────────────────────────────────────────────────┘
```

Ao falhar, **o Sistema sorteia.** O hunter escreve o cardápio; quem
serve é o Sistema.

E é aí que está a força da ideia, que meu desenho não tinha: **a
imprevisibilidade é a punição.** Saber que existe uma dívida e não saber
qual dela vai cair é mais pesado que qualquer número que eu escolhesse.

### O nome

**"O Pacto"**, e não "Arsenal" ou "Lista de Punições". Um pacto se faz
com calma e se paga depois — que é exatamente a assimetria útil aqui: o
hunter escreve num momento lúcido e é cobrado num momento em que não
escreveria nada.

### Lacunas que este desenho abre, e como fecho cada uma

**O pacto vazio — resolvido pelo catálogo.** Era a lacuna mais séria
deste desenho: um pacto vazio não gera penitência, e um hunter que
nunca parou para inventar punições nunca conhece o recurso.

A CAMADA 2 fecha isso — ele adota três do catálogo num toque. E o Eco
da primeira falha sem pacto continua servindo, agora como convite em
vez de beco:

> *"O Sistema não tem com que cobrar. Ainda."*

**O sorteio que repete.** Aleatório puro tira "30 abdominais" cinco
vezes seguidas e a mecânica vira piada. Então: **sorteio sem reposição**
— o Sistema percorre o pacto inteiro antes de repetir qualquer uma. Com
três penitências cadastradas, as três caem antes de a primeira voltar.

**Severidade sem burocracia nova.** Uma falha crítica deveria doer mais
que uma comum — mas marcar peso em cada penitência é a burocracia
voltando pela janela. A saída: o Sistema **sorteia DUAS** em vez de uma.
Nenhum campo novo, e a escala é sentida na hora.

**Apagar do pacto não apaga a dívida.** A penitência criada é uma
**cópia do texto**, não uma referência. Tirar "10 flexões" do pacto não
faz sumir a que já foi cobrada — senão bastaria esvaziar o pacto para
zerar o passado, e a dívida deixaria de ser dívida.

**O pacto é livre.** Acrescentar, editar e remover, a qualquer hora,
sem custo. Ele é um cardápio, não um contrato assinado com sangue — o
peso está em ser cobrado, não em ser imutável.

### Onde o Pacto mora: DENTRO do lançador

O Arquiteto: *"o pacto pode aparecer no lançador, e lá o user preenche
calmamente"*.

O lançador ganha um **modo**, não um campo. Ele já sabe alternar entre
Rotina e Tarefa; passa a alternar entre **Missão** e **Pacto**. Nenhuma
tela nova, nenhum bloco a mais na criação de missão, e o hunter escreve
a penitência num momento em que está pensando nisso — não no meio de
cadastrar outra coisa.

---

### DUAS CAMADAS, e eu tinha misturado as duas

Listei seis "tipos". O Arquiteto reparou que eles não eram a mesma
coisa — e não eram mesmo:

> *"as sugestões me parecem Pactos pré-programados e não tipo de card"*

Ele está certo. Havia duas camadas na mesma lista:

```
  CAMADA 1   TIPO DE CARD          a MECÂNICA
             ─────────────         como o Sistema sabe que foi pago

  CAMADA 2   PACTO PRONTO          o CONTEÚDO
             ────────────          um item de catálogo, adotado num
                                   toque, que É uma instância de um
                                   dos tipos da camada 1
```

Olhando a minha lista com essa lente, "Antecipação" e "Registro" **não
são mecânica nenhuma**. "Acordar 30 minutos mais cedo" é uma missão
comum com uma data; "escrever três linhas" é uma missão comum com um
título. Listei as duas como tipos porque SOAVAM diferentes — mas a
diferença estava no texto, não no comportamento.

**Por que a separação importa:**

- o catálogo cresce **sem código** — cem pactos prontos são cem linhas
  de dados, não cem features;
- quatro mecânicas é o **teto**, porque só há quatro formas de o
  Sistema saber que a dívida foi paga;
- e resolve a lacuna do **pacto vazio**: o hunter não precisa inventar
  punição no primeiro dia. Adota do catálogo e edita depois.

Este último ponto é a resposta à objeção original do Arquiteto sobre
burocracia: **adotar é um toque; escrever do zero é trabalho.**

---

### CAMADA 1 — os quatro tipos de card

Três já existem no app. Ao procurar o que o Arquiteto descreveu, os
dois primeiros já estavam construídos — sinal de que a forma está
certa.

| # | tipo | o verbo | mecânica | existe? |
|---|---|---|---|---|
| 1 | **QUANTITATIVA** | contar | `REPETICAO/META` — barra segmentada, `+` | sim |
| 2 | **RESTRITIVA** | aguentar | `PASSIVA` — janela e Confessar | sim |
| 3 | **TEMPORAL** | cronometrar | `ATIVA` com prazo — o cronômetro | sim |
| 4 | **TRIBUTO** | pagar | o Sistema debita Mana sozinho | **novo** |

#### 1. QUANTITATIVA — `REPETICAO/META`

Cai como missão de repetição com alvo. Escala **×2**: 1 → 2 → 4 → 8 →
16 → 32.

#### 2. RESTRITIVA — `PASSIVA`

A passiva já é isto: uma janela que se cumpre sozinha se você não
quebrar, e um botão Confessar para quando quebrou.

**A inversão:** na missão passiva, confessar CUSTA MENOS que fracassar
— o app premiando honestidade. Na penitência, confessar **aumenta em 1
hora e zera o relógio**. Mesma mecânica, consequência invertida — e é
essa inversão que faz a penitência ser penitência.

#### 3. TEMPORAL — `ATIVA` com prazo

Para o que não se conta em unidades. Escala **×1,5**, mais devagar que
a quantitativa: dobrar minutos chega ao absurdo rápido demais.

#### 4. TRIBUTO — o único que se executa sozinho

O Sistema **cobra**. Não há botão nem cartão para cumprir: o saldo cai
e o Eco avisa. Escala ×2 até um teto.

Este tipo resolve um problema que os outros três têm: **o cartão que
apodrece.** Uma penitência de flexões que a pessoa nunca vai fazer fica
no topo do Extrato para sempre, e o acúmulo vira paisagem — que é
justamente o que se quer evitar. O tributo é imediato e irrecusável, e
dói de verdade: Mana compra Reerguer.

---

### CAMADA 2 — o catálogo de pactos prontos

Dados, não código. Cada linha é um título, um tipo, um valor inicial e
um teto. O hunter adota num toque e edita à vontade.

**Corpo** — `QUANTITATIVA`

```
   Fazer {N} flexões                    1 → ×2 → teto 32
   Fazer {N} abdominais                 5 → ×2 → teto 100
   Fazer {N} agachamentos               5 → ×2 → teto 100
   Subir {N} lances de escada           2 → ×2 → teto 20
   {N} minutos de prancha               1 → ×2 → teto 8
```

**Restrição** — `RESTRITIVA`

```
   {N} horas sem redes sociais         12 → +1h por confissão → teto 48
   {N} horas sem doce                  24 → +1h                → teto 72
   {N} horas sem jogos                 12 → +1h                → teto 48
   Um dia sem delivery                  1 dia                   → teto 3
```

**Tempo** — `TEMPORAL`

```
   {N} minutos de leitura em pé        20 → ×1,5 → teto 120
   {N} minutos de estudo extra         30 → ×1,5 → teto 180
   {N} minutos de faxina               15 → ×1,5 → teto 90
```

**Tributo** — `TRIBUTO`

```
   {N} de Mana ao Sistema              50 → ×2 → teto 400
```

**Reflexão** — `TEMPORAL` ou `ATIVA` simples

```
   Escrever três linhas sobre a falha
   Reler suas metas do mês
   Planejar o dia de amanhã por escrito
```

> A "Reflexão" era o que eu havia chamado de tipo REGISTRO. Não é
> mecânica: é conteúdo. E vale registrar por que ela fica no catálogo
> mesmo sendo a mais leve fisicamente — **escrever por que falhou é
> mais desconfortável que trinta abdominais, e é o único item com
> chance de mudar alguma coisa.**

**Antecipação** — `ATIVA` com data de amanhã

```
   Amanhã você acorda 30 minutos mais cedo
```

> Também não era tipo. É uma missão comum nascida para amanhã com
> `hora_inicio` — usando exatamente o campo que o Arquiteto acabou de
> mandar consertar.

### Onde o catálogo vive

Em `motors/pactos.py`, junto com os Ecos. Pelo mesmo motivo de sempre
neste projeto: no cliente, seria conteúdo que o Arquiteto não consegue
ajustar sem deploy.

### O ESCALONAMENTO, e a lacuna que ele abre

A ideia do Arquiteto — dobrar a cada vez que a mesma penitência cai —
é a mais forte deste desenho. Ela resolve o que o "sorteio sem
reposição" só remendava: **cair de novo na mesma não é repetição, é
agravamento.** E um pacto de três itens já assusta.

**A lacuna: quando o escalonamento volta atrás?**

Sem reset, o hunter chega ao teto e mora lá — e o escalonamento morre
como mecânica, porque deixa de haver diferença entre a primeira falha e
a centésima.

**A proposta: DECAIMENTO.**

> A cada semana limpa — sem aquela penitência ser cobrada — ela **recua
> um degrau**.

Espelha o streak, que este app já entende, e faz o bom comportamento
desfazer o estrago de forma visível. 16 flexões viram 8 depois de uma
semana boa, 4 depois de duas.

**O teto é obrigatório, e não é só por segurança.** Se alguém quebra a
mesma restrição toda vez, aumentar de 24h para 25h é punir por uma
estratégia que não está funcionando — e mais do mesmo não vai passar a
funcionar. Melhor travar no limite e deixar o **acúmulo** falar, que é
o mecanismo que o Arquiteto escolheu desde o início.

Todos os tetos e fatores vão para a Balança, grupo `punicao`.

### O gatilho

Não é qualquer falha. Punição frequente vira paisagem, e paisagem não
assusta — foi o que a obra ensinou: o Jinwoo entra na zona de punição
**uma vez**, e o resto da história é o medo dela.

```
  dispara quando, no fechamento do dia:
    · uma missão CRÍTICA falhou            → penitência imediata
    · OU todas as diárias do dia falharam  → penitência do dia
    · OU 3 dias seguidos com falha         → penitência de reincidência
```

Tudo isso vai para a **Balança** — grupo `punicao` — porque calibrar
severidade sem deploy é a mesma necessidade que criou a Balança.

### O que ela é, tecnicamente

Uma `TarefaDia` com `natureza = "PUNICAO"`, nascida do fechamento, com
`origem_missao_id` apontando para quem a gerou.

Nasce assim:

```
  data_prevista     hoje (aparece já)
  prioridade        herda da missão que falhou
  xp_recompensa     0        ← não paga por cumprir
  penalidade_xp     0        ← e não pune por falhar (ver §5)
  editavel          false    ← o hunter não reescreve a própria pena
  excluivel         false    ← nem apaga
```

**Não paga XP**, e isso é deliberado: cumprir a penitência **quita a
dívida**, não é uma nova fonte de progresso. Se pagasse, falhar de
propósito viraria estratégia.

> **Ideia para preencher a lacuna do "e o que eu ganho?":** ao quitar,
> o Sistema **devolve metade do XP que tomou** na falha original. Não é
> lucro — é reparação parcial. E dá ao ato de cumprir um retorno
> concreto, sem criar exploit: devolver mais que o perdido seria pagar
> por falhar.

---

## 5. As três lacunas perigosas

### A punição da punição — a recursão

**Falhar uma penitência NÃO gera outra penitência.** Sem esta regra, um
dia ruim vira uma espiral infinita, e o app deixa de ser recuperável.

A penitência que não é cumprida simplesmente **não sai da lista**. Ela
não fracassa, não pune, não expira: ela fica. E ficar é a punição —
como você desenhou.

### O teto do acúmulo

Acumulativo sem teto vira 40 cartões e o hunter desinstala. Então:

```
  até 3 pendentes    o Eco endurece o tom a cada uma
  na 4ª              o Sistema PARA DE CRIAR e diz:

     "O Sistema parou de contar. Resolva o que já existe."
```

Parar de contar é mais ameaçador que continuar — e é o que impede a
mecânica de virar uma bola de neve que ninguém encara.

### O desfazer

Duas portas que já existem no app não podem ser ignoradas:

- **Reerguer** desfaz o fracasso. Então **revoga a penitência** que ele
  gerou. Pagar Mana para reabrir e ainda carregar a dívida seria cobrar
  duas vezes pela mesma falha.
- **Confessar** (passiva) é honestidade, e este app já premia isso com
  metade da punição. **Confissão não gera penitência.** Punir quem
  admitiu ensina a não admitir.

---

## 6. O cartão, e o topo do Extrato

```
  ╔═══════════════════════════════════════════════════════╗
  ║ ⚖  PENITÊNCIA                              há 2 dias  ║
  ║                                                       ║
  ║    Fazer 30 abdominais                                ║
  ║    ↳ o Sistema cobrou por "Passar fio dental", 29/07  ║
  ║                                                       ║
  ║    [ Cumprir a penitência ]                           ║
  ╚═══════════════════════════════════════════════════════╝

O cartão diz **as duas coisas**: o que o Sistema sorteou, e por qual
falha. Sem a segunda linha a penitência parece arbitrária; sem a
primeira, ela não é executável. E a distância entre as duas — fio
dental cobrado em abdominais — é justamente o que faz o Sistema parecer
uma entidade, e não uma planilha.
```

- **borda gélida, sem animação de urgência.** A missão crítica pulsa
  porque o tempo corre. A penitência não tem pressa — ela tem
  permanência. A ausência de movimento é o que a torna pesada.
- **"há 2 dias" cresce.** É o único número que sobe, e sozinho ele já
  incomoda.
- **diz de onde veio.** Uma punição anônima é arbitrária; nomear a
  falha a torna justa.
- **sempre no topo**, antes de qualquer ordenação. Ela não rola para
  fora da tela.

---

## 7. Ordem de trabalho

| # | passo | por que nesta ordem |
|---|---|---|
| 1 | `motors/ecos.py` + Balança (`punicao`) | os números antes da regra, como sempre |
| 2 | `js/eco.js` + CSS, com amostra na Forja | dá para julgar o efeito **antes** de existir punição |
| 3 | `natureza = PUNICAO` + colunas | a fundação |
| 4 | O gatilho no `fechamento.py` | onde a dívida nasce |
| 5 | O cartão gélido, fixo no topo | onde ela incomoda |
| 6 | O **catálogo** (dados) + o modo Pacto no lançador | adotar num toque vem antes de escrever do zero |
| 7 | Sorteio sem reposição, escalonamento e decaimento | a parte que dá pavor |
| 8 | Revogar no Reerguer, isentar na Confissão | as duas portas |

O passo 2 antes do 3 é de propósito: o Eco é a parte que precisa do seu
olho, e ele fica pronto na Forja **antes** de qualquer missão poder
falhar de verdade.

---

## 8. Uma nota para quando o app for público

O Pacto é texto escrito pelo hunter, para o próprio hunter — o que o
torna auto-limitante por desenho: ninguém escreve para si uma pena que
não pretende pagar.

Isso vale enquanto o app é seu. Num lançamento aberto, vale pensar em
um limite — porque "penitência" mais "aparece todo dia até você
cumprir" é uma combinação que, na mão de alguém em um momento ruim,
pode virar outra coisa. Não é decisão de agora; é decisão de antes do
primeiro usuário que não seja você.

---

## 9. O que eu não consigo verificar

O Eco é a primeira coisa deste projeto cuja qualidade **não é
mensurável por teste**. Posso provar que ele aparece, que enfileira,
que fecha no Esc e que respeita `reduced-motion`. Não posso provar que
ele é bonito, nem que a frase dá o arrepio certo.

Essa parte é sua, e é por isso que ela vai para a Forja primeiro.
