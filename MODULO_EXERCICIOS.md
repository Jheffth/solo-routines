# Corrida e exercícios

Nova guia e menu próprios. Os dados pertencem ao usuário autenticado; não alteram missões, XP ou punições.

## Uso

1. Abra **Corrida e exercícios** e escolha **Registrar exercício**.
2. Envie o print do Strava (JPG, PNG ou WebP, até 8 MB / 16 megapixels) ou preencha manualmente.
3. Confira os campos, escolha corrida, caminhada, ciclismo ou exercício e informe a data real. Prints com “Hoje” ou “Ontem” não determinam a data: o envio pode acontecer depois da captura.
4. Salve. Consulte qualquer dia, semana, mês ou ano pelo seletor de referência e filtre a modalidade.
5. Crie metas recorrentes por dia, semana, mês ou ano: km acumulados, minutos acumulados ou uma distância mínima em um treino com duração máxima. Metas podem ser editadas e excluídas.

A tela mostra distância, duração, passos, elevação, velocidade máxima registrada, dias ativos, médias por treino e por dia, velocidade ponderada, ritmo ponderado, evolução diária e histórico paginado. Exercícios sem deslocamento aceitam zero km. Eles contam no tempo total do filtro; selecione corrida para analisar somente suas corridas.

## Regras de cálculo

- Semana civil: segunda a domingo. Meses e anos seguem o calendário, incluindo fevereiro bissexto.
- Média por dia inclui dias sem treino; no período em curso, o denominador vai do começo até hoje, no fuso do aplicativo. Períodos anteriores usam todos os dias.
- Velocidade = soma dos km / soma das horas. Ritmo = soma dos segundos / soma dos km. Não se faz média aritmética de ritmos.
- Meta de km em X minutos: precisa de UM treino com distância >= alvo e duração <= limite. Não soma treinos nem presume parciais não informadas pelo Strava.
- Cada meta usa seu próprio período na data de referência e sua própria modalidade. O filtro do histórico não muda a definição da meta. Percentuais podem ultrapassar 100%; apenas a barra visual para em 100%.
- Edições e exclusões recalculam os resultados. Hash do arquivo impede importar o mesmo print novamente na mesma conta. Imagens diferentes da mesma atividade ainda exigem revisão para evitar duplicidade.

## Leitura dos prints

OCR local via Tesseract, sem envio a terceiros ou chave de IA. A imagem é validada e processada em diretório temporário, apagado ao final. O banco guarda os números e o hash, não o print nem o mapa de localização. Valores não encontrados ficam vazios para preenchimento. Título é sugerido quando reconhecido; modalidade e todos os valores são revisados pelo usuário. Na importação manual pela guia web, datas relativas não são convertidas automaticamente.

A imagem Docker instala `tesseract-ocr`, `tesseract-ocr-por` e `tesseract-ocr-eng`. Em execução local, instale Tesseract com português e inglês e coloque o executável no PATH ou defina `TESSERACT_CMD` no ambiente. A interface informa quando a leitura não está disponível. A dependência Pillow valida e prepara as imagens.

As tabelas `atividades_fisicas` e `metas_exercicios` são criadas pelo mecanismo existente de inicialização (`create_all`), tanto em SQLite quanto em PostgreSQL. Todas as consultas e alterações exigem sessão autenticada e filtram o dono; administrador não ganha acesso aos treinos de outras contas.

## Validação

Execute `python -m pytest test_treinos.py` em `webapp/backend` e `node webapp/frontend/tests/teste_treinos.js` na raiz. Os testes usam banco SQLite temporário e não acessam dados reais. Recrie a imagem no próximo deploy para habilitar o Tesseract no servidor.

### Resultado desta entrega

- 41 testes do módulo aprovados; fluxos da interface, navegação (53 verificações) e sintaxe dos 70 arquivos JavaScript aprovados.
- Print de referência validado com Tesseract real: Trilha matinal, 1,91 km, 1.070 segundos, 2.150 passos, 15 m e 18,3 km/h de velocidade máxima.
- Testes existentes de fuso, projeção do calendário (23 verificações) e esquema (5 verificações) aprovados em bancos temporários.
- A coleta geral por pytest é interrompida por `sys.exit(0)` no teste legado `test_calendario_elo.py`. O teste legado `test_selo_versao.py`, executado separadamente, retornou uma falha em 18 verificações. Esses testes não foram alterados.
- A imagem Docker não foi construída neste ambiente. Para disponibilizar a leitura em produção, a imagem precisa ser reconstruída no deploy.


## Registro automático por WhatsApp, Telegram e Bella.exe (1.10.1)

O Solo Bot identifica prints do Strava antes de guardá-los como referências para prompts e encaminha as imagens ao endpoint autenticado `/interno/bot/imagem`. O usuário remoto vem do vínculo da Conta Solo; sem vínculo não há gravação. Nenhum cadastro é feito no Solo Models.

Prints como o exemplo enviado registram automaticamente a corrida do dia com distância, duração, passos, elevação e velocidade máxima. Corrida é a modalidade padrão escolhida pelo Arquiteto. A legenda pode informar caminhada, ciclismo ou exercício geral. `/treino` explica o envio; o manifesto usa a versão 2026.11.02, sem anúncio automático.

Hoje/Ontem no print usam o dia de envio no fuso do aplicativo, mesmo se o processamento atrasar. Uma data explícita na legenda (`/rot treino DD/MM/AAAA`) prevalece. Sem data reconhecível ou métricas essenciais legíveis, o bot pede correção e não transforma o anexo em referência de prompt.

A nova tabela `importacoes_treino` permite deduplicar por usuário, data, distância e duração inclusive quando outro canal recomprime a imagem. As validações e a transação são compartilhadas com o cadastro web. Treinos distintos com exatamente os mesmos números e dia podem ser cadastrados manualmente. Editar não libera a reimportação original; excluir remove a assinatura. Nenhuma coluna existente precisa ser migrada.

O hub registra somente “print de treino” em seu histórico operacional, sem números, imagem ou localização. O print não entra no acervo de prompts nem na memória pessoal da Bella. Publique Rotinas e Solo Bot para ativar o fluxo; o Rotinas precisa da imagem com Tesseract português/inglês.


Validação da integração 1.10.1: 63 testes de métricas/importação aprovados, testes obrigatórios de comandos e manifesto aprovados e criação de tabelas validada. O endpoint foi testado com o print real recomprimido em três qualidades JPEG: uma corrida registrada e duas duplicatas recusadas, preservando 1,91 km, 1.070 segundos, 2.150 passos, 15 m e 18,3 km/h. Nenhum treino de teste foi salvo nas contas reais.
