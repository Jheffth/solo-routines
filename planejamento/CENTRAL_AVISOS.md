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

Regras e tentativas ficam no banco. O varredor existente de cinco em cinco
minutos processa a central após confirmar o fechamento. A tentativa é reservada
com atualização condicional antes da rede para impedir envio duplicado por dois
varredores. Não despeja intervalos perdidos após reiniciar. Timeout ambíguo não
provoca repetição imediata; a próxima oportunidade segue a frequência da regra.

Cada aviso tem validade até o próximo intervalo ou prazo do evento, o que vier
primeiro. Isso evita liberar mensagens velhas após o silêncio do Solo Bot.
Aviso já aceito/enfileirado pelo Bot não pode ser cancelado pelo Rotinas no
contrato atual; cancelamento de fila por alvo é uma evolução planejada.

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
   perto do prazo; quantidades vêm dos motores de meta/circuito/progressivas.
3. Resumos: manhã com agenda, fechamento do dia, revisão semanal, atraso por
   categoria. Um resumo agrupado ajuda quem quer poucos avisos.
4. Penitências: lembretes escolhidos pelo hunter sem duplicar os sussurros.
5. Habilidades: meta de maestria atingida, convite para conversão e trajetória.
6. Canal específico, teto diário, agrupamento de lembretes simultâneos e botão
   “adiar 1h”. Hoje os canais/silêncio são os escolhidos na Conta Solo.
7. Cancelamento dos avisos enfileirados ao concluir ou editar o alvo, usando
   chave de alvo e revisão no contrato entre Rotinas e Solo Bot.

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
reservada. Validade nunca ultrapassa o prazo do card/sessão. A varredura segue
em passos de 5 minutos: eventos muito curtos podem terminar entre dois passos;
o disparo das missões de saúde segue dependendo do heartbeat existente da
dungeon. Cancelar avisos já na fila do Solo Bot permanece como evolução.

Sem mudança de esquema ou do contrato do Bot nesta etapa. Publicar apenas
o Rotinas após a extensão de formatos da primeira entrega estar no Solo Bot.
