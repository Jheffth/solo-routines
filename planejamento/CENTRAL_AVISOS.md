# Central de avisos gerais

## Objetivo e primeira entrega

O hunter escolhe um alvo, o formato, a frequência e os estados em que deseja
ser lembrado. O servidor consulta o estado real em cada envio e para quando a
missão termina. A central será uma guia própria com prévia, próximo horário,
pausa/retomada e remoção de regras. Nada vem ligado automaticamente.

Primeira entrega:
- Missões gerais: lembrete repetido de pendência, andamento, pausa ou atraso.
- Rotinas: lembrete por ocorrência prevista, respeitando folgas e janela.
- Dungeons: portão prestes a abrir, prestes a fechar e acompanhamento da sessão.
- Texto, áudio ou ambos; preferência da Conta Solo prevalece sobre voz.
- Intervalo de 5 minutos a 24 horas; 60 minutos como sugestão inicial.
- Janela configurável por regra, inicialmente das 08h às 22h, em Brasília.
- Portões: antecedência de 5 a 180 minutos; um aviso por evento/ocorrência.

Exemplo: comprar fio dental, a cada 60 minutos. Pendente: “A missão … ainda
não foi iniciada. O prazo é até …”. Ativa: “A missão … está em andamento.
Você está prestes a concluir?”. Ao vencer: mensagem informa que o prazo venceu,
se o hunter escolheu receber sobre atrasos. Concluída/cancelada: nenhum novo envio.

## Regras técnicas de entrega

Regras e tentativas ficam no banco. A Central tem um ciclo próprio de 30
segundos; fechamento e avisos legados continuam a cada 5 minutos. A tentativa é reservada
com atualização condicional antes da rede para impedir envio duplicado por dois
varredores. Não despeja intervalos perdidos após reiniciar. Timeout ambíguo não
provoca repetição imediata; a próxima oportunidade segue a frequência da regra.

Avisos repetidos e antecipados têm validade até o próximo intervalo ou prazo
do evento, o que vier primeiro. O aviso único de aparecimento tem a validade
do próprio card. Isso evita liberar mensagens velhas após o silêncio do Solo Bot.
Avisos novos da Central têm referência e são revalidados na fila pelo Rotinas
(terceira entrega abaixo). Avisos antigos sem referência continuam sujeitos
apenas à validade original.

Só o dono pode selecionar alvo ou administrar regras. Portão sempre aberto não
oferece alerta de abertura/fechamento. Sessões de teste não geram lembretes.
Mensagens usam estado/prazos existentes; a central não inicia ou conclui missões.

Áudio exclusivo requer extensão opcional `formato` no contrato do Solo Bot.
O formato acompanha a fila de silêncio; se a síntese falhar ou a Conta Solo
proibir voz, a cópia escrita preserva o aviso. Contrato antigo continua funcionando.
Publicar a extensão do Bot antes de ativar áudio exclusivo no Rotinas.

## Próximas extensões avaliadas

1. Missões internas da dungeon: agendadas prestes a ativar/expirar, saúde com
   próxima ocorrência, prazo da sessão contado da primeira entrada; usar as
   ocorrências reais para evitar lembrar um card que já foi concluído.
2. Progresso: metas perto do alvo, circuitos interrompidos, desafios progressivos
   perto do prazo; missões gerais e rotinas implementadas na sexta entrega.
   Quantidades vêm dos motores existentes. Metas/circuitos internos da dungeon
   exigem uma extensão própria, com valores por execução real.
3. Resumos: manhã com agenda, fechamento do dia, revisão semanal, atraso por
   categoria. Agenda e balanço diários implementados na sétima entrega;
   revisão semanal e detalhamento por categoria ficam para uma extensão.
4. Penitências: lembretes escolhidos pelo hunter sem duplicar os sussurros.
5. Habilidades: meta de maestria atingida, convite para conversão e trajetória.
6. Teto diário, agrupamento de lembretes simultâneos e botão “adiar 1h”
   implementados na quinta entrega. Canal específico e adiamento direto pelo
   bot ficam para uma extensão futura; hoje os canais são os da Conta Solo.
7. Cancelamento dos avisos enfileirados: implementado pela revalidação da
   terceira entrega. Uma futura limpeza imediata por evento pode reduzir a
   espera até o próximo passo de um minuto do Solo Bot.

Push/publicação ficam com o Antigravity. Commit nomeado após os testes.

## Implementação em 01/10/2026

Primeira entrega implementada na guia **Avisos**, nas rotas autenticadas
`/api/avisos-gerais` e no motor `motors/avisos_gerais.py`. As duas tabelas
novas são criadas pelo mecanismo já existente de inicialização do banco.
A ponte foi sincronizada no Rotinas, no modelo de integração do Solo Bot e
no Finances; não é necessário alterar as chamadas existentes do Finances.

Validação: testes isolados do motor e das rotas, fluxo do formulário em DOM,
navegação e sintaxe do frontend; suíte completa do Solo Bot e testes de
integração da ponte do Finances. Transportes simulados, sem envio ao hunter.
Publicação e conferência visual no site ainda dependem do Antigravity.

## Segunda entrega — missões internas e prazo da sessão

Implementada a origem **Missão interna da dungeon** na Central. A regra
escolhida acompanha as ocorrências futuras da mesma missão, sem habilitar
avisos automaticamente. Eventos disponíveis conforme a natureza:

- Status de um card real: pendente, em progresso ou pausado; termina ao
  concluir, cancelar, expirar ou vencer o prazo efetivo.
- Agendadas: antecedência antes de ficar disponível ou antes de vencer.
- Saúde (`BEM_ESTAR`): próxima ocorrência calculada pela própria agenda da
  sessão, mais aviso de vencimento do card já disparado; cada card tem chave
  distinta. A sugestão de intervalo de acompanhamento é de 5 minutos.
- Aleatórias: informa o começo da janela possível, sem prometer a hora exata;
  o vencimento usa a ocorrência realmente disparada.
- Dungeon: **Tempo da sessão prestes a acabar**, com o prazo existente que
  considera a primeira entrada e continua correndo durante a suspensão.

Só sessões reais iniciadas participam. Folgas, missões desativadas, dungeons
arquivadas e sessões de teste são ignoradas. Passivas automáticas e falas
decorativas não oferecem acompanhamento de cards. O motor apenas lê a agenda:
não gera, inicia, expira nem conclui execução e não aplica XP.

Os avisos antecipados são únicos por ocorrência/evento. Uma nova confirmação
do estado antes da entrega também exige que ainda seja a mesma ocorrência
reservada. Validade nunca ultrapassa o prazo do card/sessão. Na segunda entrega,
a varredura tinha passos de 5 minutos (reduzidos na quarta entrega abaixo);
o disparo das missões de saúde segue dependendo do heartbeat existente da
dungeon. A terceira entrega permite revogar os avisos novos ainda na fila.

Sem mudança de esquema ou do contrato do Bot nesta etapa. Publicar apenas
o Rotinas após a extensão de formatos da primeira entrega estar no Solo Bot.

## Terceira entrega — fila revalidada

A Central envia `referencia` opaca, com carimbo de configuração, tentativa e
ocorrência. O Solo Bot preserva esse campo no JSON já existente da fila. A cada
passo de um minuto, mesmo no silêncio, consulta o sistema de origem pela rota
autenticada `POST /interno/bot/validar-aviso`. O endereço vem do registro interno
do Bot, nunca da mensagem. O hunter vem do vínculo atual da Conta Solo.

O Rotinas rejeita missão concluída, cancelada, vencida quando terminal, removida,
regra pausada/removida/editada, usuário inativo ou outra ocorrência de rotina,
sessão ou saúde. Status e progresso podem mudar: quando ainda válido, o texto
atual substitui a mensagem guardada e o áudio é sintetizado com esse texto.
Regras de atraso de missões gerais continuam válidas se configuradas assim.

Resposta `valido=false` remove o aviso. Falha de rede, resposta inválida ou
endpoint indisponível conserva a fila para nova tentativa, sem entregar; a
validade original nunca é estendida. Referências iguais nos dois canais
compartilham uma consulta por passo. Vínculo/canal removido ou desabilitado
também descarta o aviso identificado. Avisos sem referência preservam o contrato
legado; não é possível identificar e revogar retroativamente os antigos.

Sem migração de banco nesta etapa. Publicar primeiro Rotinas (endpoint) e depois
Solo Bot (revalidação) é compatível: o Bot antigo ignora o campo novo. A proteção
fica ativa após os dois estarem atualizados. Ponte compartilhada sincronizada
também no Finances, cujas chamadas antigas não mudam.

Limite: isso protege avisos ainda na fila; não desfaz mensagens já entregues e
não bloqueia a conclusão durante os instantes entre a última confirmação e o
envio ao aplicativo. Conferência visual e envio real ficam para a publicação
pelo Antigravity. Testes locais usam serviços e transportes simulados.

## Quarta entrega — avisos de saúde com resolução de 30 segundos

A Central agora tem um job próprio a cada 30 segundos, sem executar fechamento,
XP, disparo de eventos ou qualquer mudança no ciclo de vida das missões. O job
de 5 minutos conserva os avisos legados e o fechamento. Só hunters ativos com
regras ativas participam do ciclo rápido; falha de um hunter não impede os demais.
Regras de status ainda obedecem à frequência configurada, e são descartadas da
checagem antes de consultar o alvo se o próximo intervalo não chegou.

Nova opção **Quando o card aparecer**, para Saúde e eventos aleatórios:
envia uma vez por execução real, sem esperar o intervalo de acompanhamento.
O aviso só participa enquanto o card ainda está aberto e dentro do prazo; não
envia retroativamente cards vencidos. Concluir ou expirar a ocorrência encerra
os avisos dela, e um novo card tem uma nova oportunidade. O usuário precisa
selecionar essa opção; nenhuma regra existente muda automaticamente.

O formulário esconde os campos de repetição e antecedência para essa opção e
mostra “uma vez por ocorrência” no card da regra. Nesse aviso, a validade termina
no prazo do card, sem depender do intervalo oculto. A revalidação da fila do
Solo Bot permanece ativa e descarta o aviso caso o card seja concluído.

Cadência de 30 segundos reduz atrasos, sem garantir entrega nesse tempo: fila
de silêncio, síntese, rede, carga e indisponibilidade podem adiar. Eventos mais
curtos que a cadência podem passar entre checagens. O heartbeat da dungeon
continua responsável por criar as ocorrências; o sistema de avisos não inventa
cards quando a dungeon está sem heartbeat. Não acumula ciclos perdidos ao
reiniciar e não sobrepõe jobs na mesma instância.

Testes: card de um minuto detectado após 20 segundos; nenhum reenvio no mesmo
card, nenhuma entrega após o prazo e aviso próprio para o card seguinte;
agendamento real de 30 segundos, isolamento de hunters e formulário atualizado.
Sem alteração de banco ou do Solo Bot nesta etapa. Publicação do Rotinas fica
com o Antigravity, após as extensões anteriores da fila estarem publicadas.

## Quinta entrega — menos interrupções

Na Central, cada regra ganhou **Adiar 1 hora**. Silencia a regra até o horário
indicado, persiste após reinício e invalida suas referências que ainda estejam
na fila. Não muda o prazo da missão nem repete avisos únicos já enviados; um
card pode vencer durante o adiamento. Frequências maiores que uma hora mantêm
o próximo intervalo original. Não há comando ou botão novo nos bots nesta etapa.

O painel **Limite e agrupamento** configura um teto de 0 a 100 tentativas por
dia/hunter (0 = ilimitado), com virada à meia-noite de Brasília. O teto abrange
somente a Central: avisos legados, resumos fixos e sussurros continuam separados.
Um envio aos dois canais consome uma tentativa. Falha/timeout também consome,
pois não é possível saber se uma resposta perdida já resultou em entrega.
Atualização condicional da cota impede duas entregas de tomar a última vaga.

Agrupamento é opcional e vem desligado. Reúne avisos do mesmo formato e hunter
prontos na mesma checagem, até quatro e com um orçamento de texto para áudio;
não espera formar grupos nem mistura texto, áudio e ambos. O grupo consome uma
tentativa; cada missão mantém seu registro próprio. Se o teto impedir um envio,
as reservas sem entrega são devolvidas, conservando a próxima oportunidade;
não gera uma fila de intervalos passados.

Um grupo na fila tem validade igual ao prazo mais curto de seus membros. A
referência do grupo é revalidada pelo endpoint já existente: concluir, pausar,
remover ou adiar um membro o retira do texto atualizado, preservando os outros.
Quando nenhum membro ainda vale, o Bot descarta o grupo. Grupos grandes são
divididos para respeitar o espaço do roteiro de áudio; a contagem é por envio,
não por número de regras reunidas.

Persistência em três tabelas novas (preferências/cota, adiamentos e grupos),
criadas no startup existente, sem alterar colunas antigas. Não muda o contrato
do Solo Bot: exige a revalidação da terceira entrega já publicada. Publicação
do Rotinas continua com o Antigravity. Testes usam transporte simulado e
incluem concorrência na última vaga, limite/virada, isolamento de hunters,
adiamento, divisão por formato e remoção parcial de grupo na fila.

## Sexta entrega — progresso e prazo de missões gerais/rotinas

O acompanhamento de status agora inclui os valores registrados: leitura/alvo
e quanto falta na meta, blocos entregues/restantes no circuito e dias cumpridos
no desafio progressivo. Circuitos pausados preservam o estado e mostram os
blocos já feitos. O motor de meta fornece o progresso de acúmulo e medição;
uma meta de peso decrescente mede o caminho entre o valor inicial e o alvo,
sem somar pesagens. Quando houver circuito ou meta na rotina progressiva, o
detalhe acompanha o objetivo do card (circuito tem precedência sobre meta).

Duas opções novas no catálogo de missões gerais/rotinas:
- **Ao atingir 80% do objetivo**: uma tentativa enquanto o progresso está de
  80% a menos de 100%, antes do prazo. Metas e circuitos usam uma chave por
  ocorrência; um desafio progressivo sem meta/circuito usa uma chave para o
  desafio inteiro, sem repetir a cada dia. Uma regra criada com o objetivo
  já nessa faixa pode avisar na próxima checagem. Objetivos completos não
  recebem o marco. O percentual é fixo nesta entrega e não é um novo campo.
- **Prazo prestes a acabar**: uma tentativa por ocorrência e prazo real,
  dentro da antecedência configurada. Usa os prazos existentes, incluindo
  duração da intenção, janela noturna e reerguimento; penitências não oferecem
  a opção, pois sua dívida não tem prazo. Não envia depois de vencer.

Nenhuma opção nova é habilitada automaticamente. Janela de recebimento,
folgas, pausa, adiamento, teto diário, agrupamento e revalidação da fila
continuam valendo. No marco e no aviso antecipado, os estados escolhidos do
acompanhamento não se aplicam; conclusão/cancelamento continuam encerrando
o aviso. O texto enfileirado consulta o progresso atual e é descartado se
o hunter concluir ou deixar a faixa do marco. Não cria execuções, aportes,
XP nem mudança de estado.

Os avisos existentes sobre missões internas da dungeon permanecem disponíveis;
esta entrega não usa os acumulados da definição para inventar progresso de
um card interno. Sem migração de banco e sem mudança no Solo Bot. Testes
locais com transporte simulado cobrem marcos, atualização de fila, medição
decrescente, circuito pausado, desafio entre dias, folgas, conclusão e prazo
noturno. Push e publicação permanecem com o Antigravity.

## Sétima entrega — agenda e balanço diários

Nova origem **Resumo diário** na Central, com **Agenda do dia** e **Balanço
do dia**, independentes e opcionais. Cada regra escolhe o horário de Brasília
e texto, áudio ou ambos. O horário fica em `janela_de`; o servidor deriva
`janela_ate` como uma hora depois. Não há nova tabela ou coluna. A chave
diária de cada evento usa a mesma reserva persistente das demais regras,
inclusive cota, adiamento, pausa, formato e revalidação da fila.

O retrato consulta missões gerais do dia sem teste, rotinas ativas devidas
na data respeitando folgas, execuções existentes e sessões/cards internos
reais de dungeon sem modo de teste. Rotina prevista sem execução aparece
como pendente, sem materializar derrota. Informa concluídas, abertas, falhas
registradas, canceladas, missões antigas em aberto (sem penitências),
dungeons previstas, sessões e cards registrados. Lista até três próximos
prazos de missões/rotinas e até dois portões que ainda vão abrir, dentro do
orçamento de áudio. Não inclui toda a lista de títulos; é um resumo compacto.
O balanço é a situação **até o horário da consulta**, não um fechamento que
altera missões, XP ou streak. As duas opções mostram o retrato atual do dia.

Uma oportunidade de envio por dia/evento durante a hora seguinte ao horário
escolhido, limitada à meia-noite. Se houver interrupção, silêncio, cota cheia
ou adiamento até depois dessa janela, o resumo daquele dia é descartado.
Não recupera dias perdidos e não atravessa a madrugada. Falha/timeout consome
a tentativa como nas demais regras; não há repetição imediata. Adiar 1 hora
durante a janela normalmente pula o resumo de hoje. A prévia pode ser vista
fora do horário sem enviar: mostra os dados atuais, não prevê resultados.

Enquanto estiver na fila, o resumo atualiza seus números e próximos prazos;
concluir uma missão não invalida o resumo inteiro, apenas atualiza o retrato.
Pausar/remover/editar/adiar a regra, trocar de hunter ou chegar ao vencimento
invalida a mensagem. A voz continua sujeita às preferências da Conta Solo.
Sem comandos novos e sem alteração do contrato do Bot. Publicação permanece
com o Antigravity. Testes usam transporte simulado e verificam horário,
unicidade/reinício, virada/atraso, dados atuais na fila, isolamento, folgas,
ausência de execuções fictícias, cards de teste excluídos, limites e formulário.
