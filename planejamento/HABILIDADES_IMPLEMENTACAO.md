# Habilidades — implementação pronta para revisão e publicação

Solicitação: transformar uma rotina dominada em habilidade permanente, com nome
escolhido pelo hunter, destaque no dashboard e guia própria com sua trajetória.

## Regra aprovada e escala implementada

O Arquiteto pediu no mínimo 90 execuções na dificuldade e prioridade máximas,
com metas maiores nas combinações mais fáceis. Escala: 90 + 30 por degrau abaixo
de Lendária ou Crítica.

| Dificuldade / prioridade | Crítica | Alta | Média | Baixa |
|---|---:|---:|---:|---:|
| Lendária | 90 | 120 | 150 | 180 |
| Difícil | 120 | 150 | 180 | 210 |
| Normal | 150 | 180 | 210 | 240 |
| Fácil | 180 | 210 | 240 | 270 |

Só conta CONCLUIDA sem confissão, falha, cancelamento, reerguimento, XP perdido
ou resposta condicional negativa. No máximo uma execução por data. Dias fora
da programação não quebram a sequência; ausência em dia previsto já vencido
quebra. Janela em andamento, inclusive atravessando meia-noite, aguarda desfecho.
É uma contagem independente do streak comum, que pode tolerar confissão.

Histórico legado não tem versões da programação/dificuldade: usa a configuração
atual da rotina. Essa limitação aparece na interface e na evidência permanente.
Não se presumem sucessos em datas sem registro de execução.

## Comportamento

- Guia Habilidades no menu; destaque logo abaixo do personagem no dashboard.
- Meta/progresso nos cards de regras da guia Rotinas e na guia Habilidades.
- Ao atingir a meta, botão Virar habilidade abre diálogo de nome, com aviso de
  encerramento da rotina e das ocorrências abertas sem penalidade.
- Conversão revalida tudo no servidor; arquiva a origem e preserva as vitórias.
- Evidência guarda título, descrição, natureza, categoria, programação,
  dificuldade/prioridade, meta, sequência, período e IDs das execuções.
- Rotina convertida protegida contra edição, reativação, exclusão e ações de
  execução. Habilidade única por origem; transação com rollback em conflito.
- Não concede XP/moedas nem dispara conquistas existentes por engano.
- Cards translúcidos, cor por dificuldade, glifo SVG e animação discreta com
  respeito a movimento reduzido. Modal nativo com foco e conteúdo escapado.

## Arquivos para o Antigravity

Novos:
- `webapp/backend/motors/habilidades.py`
- `webapp/backend/routers/habilidades.py`
- `webapp/backend/teste_habilidades.py`
- `webapp/frontend/js/pages/habilidades.js`
- `webapp/frontend/css/habilidades.css`
- `webapp/frontend/tests/teste_habilidades.js`
- Este documento.

Alterados:
- `webapp/backend/database.py` — tabela habilidades.
- `webapp/backend/main.py` — registro do router.
- `webapp/backend/routers/rotinas.py` e `execucoes.py` — proteção da origem.
- `webapp/frontend/index.html`, `js/app.js`, `js/pages/dashboard.js` e
  `js/pages/rotinas.js` — navegação, carregamento e pontos de exibição.

A tabela nova é criada pelo `Base.metadata.create_all` já chamado na
inicialização. Não exige alteração de colunas existentes. Publicar backend e
frontend juntos e reiniciar o backend pelo processo habitual do projeto.
O commit é feito pelo Codex conforme a regra atualizada do Arquiteto.
Push e deploy ficam com o Antigravity.
Há vários arquivos não rastreados anteriores: não incluí-los neste trabalho.

## Validação realizada

- `python -m unittest teste_habilidades -q` no backend: 10 testes passam,
  banco SQLite isolado (perfeição, folgas, janela noturna, duplicação de datas,
  escala, propriedade/autenticação, HTTP, persistência, encerramento, bloqueios,
  rollback e regressão das ações de rotina comum).
- `node webapp/frontend/tests/teste_habilidades.js`: fluxo DOM passa, incluindo
  duplo envio, foco, detalhes, reload, dashboard, progresso, HTML escapado e erro.
- `node webapp/frontend/tests/teste_navegacao_paginas.js`: 47/47.
- Sintaxe completa do frontend: 68 arquivos válidos; rechecados os JS tocados
  após os ajustes finais. `git diff --check` sem erros.
- Glifo SVG renderizado e inspecionado em fundo escuro.

Pendências de validação: conferir a página real em desktop/celular e a
concorrência no banco de produção (testes locais usam SQLite). Uma tentativa de
agrupar testes legados foi interrompida pelo script `test_rotinas_status`, que
tenta login em banco já preparado; isso não é aprovação daquela suíte.
Não houve validação visual completa em navegador nem publicação nesta sessão.
