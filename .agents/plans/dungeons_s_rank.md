# Atualização Completa das Dungeons & Sistema de Equipamentos (Padrão S-Rank)

A sua visão de integrar a silhueta, os equipamentos e a barra de XP dentro da Dungeon é o que separa um "gerenciador de tarefas gamificado" de um **RPG de verdade**. E com a adição de **Raids Multijogador** e **Eventos Globais**, o Solo Routines se transforma num MMO de Produtividade.

Entrar na masmorra de "peito vazio" não combina com o Monarca das Sombras, e lutar sozinho quando há ameaças nível Nacional também não.

Aqui está o plano definitivo para transformar a Dungeon no coração do jogo:

## ⚠️ User Review Required
> [!IMPORTANT]
> **Sistema de Equipamentos (Paper-Doll):** Qual será o propósito dos equipamentos inicialmente?
> 1. **Puramente Cosméticos:** Eles mudam o visual da silhueta para ostentação.
> 2. **Com Status Reais:** Eles dão bônus passivos (ex: *Espada Longa* dá +10% XP; *Anel do Foco* dá mais prazo).
> *Recomendação:* Começar Cosmético, e adicionar "Stats" depois.
> 
> **Dungeons Compartilhadas:** Como o XP é dividido na Raid? Todos ganham igual, ou o "MVP" (quem fez mais missões) leva uma fatia maior de Mana Coins no final?

## 🛠️ Proposed Changes

### 1. Atualização Visual Completa: Do Portal ao Interior
#### [MODIFY] `webapp/frontend/js/pages/dungeons.js` (Grid de Entrada)
#### [MODIFY] `webapp/frontend/js/pages/dungeon-interior.js` (O Interior)
- Faremos uma **atualização visual completa desde as entradas dos portais até dentro deles**. O painel onde os portões ficam listados será refeito com efeitos de magia, e o ato de "Entrar" disparará uma animação de portal majestosa baseada no Rank.
- O Interior (HUD) será redesenhado do zero: elementos de vidro fosco, cristais pulsantes, partículas de aura flutuantes, sons imersivos e barras de progresso colossais.

### 2. Sistema de Equipamentos & Inventário (Backend e Paper-Doll)
#### [NEW] `webapp/backend/models/equipamentos.py`
- Criar a tabela `EquipamentoCatalogo` (O que vende na Loja).
- Criar a tabela `Inventario` (O que o Hunter possui e se está equipado nos 6 slots: Cabeça, Peito, Calças, Botas, Arma, Artefato).
#### [NEW] `webapp/frontend/css/paperdoll.css`
- **A Silhueta do Hunter (Acesso Restrito à Masmorra):** Para criar um senso de imersão de que o Hunter "veste sua armadura para a batalha", **a Silhueta e o gerenciamento do Inventário só poderão ser acessados DENTRO da Dungeon**. No "mundo real" (Painel comum) isso fica oculto. Conforme o Hunter compra equipamentos, eles são "vestidos" sobre a silhueta em tempo real na HUD da Masmorra.

### 3. Dungeons Compartilhadas (Raids de Guilda)
#### [NEW] Modelos de Banco de Dados (`DungeonMembro`)
- A Dungeon deixará de ter apenas um dono. Caçadores da *Buddy List* poderão ser convidados.
- **HUD Multijogador:** Dentro da Dungeon, o Hunter verá não só a própria Silhueta, mas a "Party" (avatares dos amigos) e a barra de progresso conjunta.
- Notificações de ação em tempo real: *"Hunter X causou dano ao Chefe (cumpriu missão)."*

### 4. Dungeons de Evento (Calamidades do Arquiteto)
#### [MODIFY] `webapp/backend/routers/dungeons.py`
- O Arquiteto ganha o poder de abrir um "Red Gate" (Portal Vermelho) Global.
- Aparecerá um banner de alerta na tela de todos do servidor. Qualquer membro pode "Entrar na Raid".

### 5. Sistema de Loot (Drops de Masmorra)
#### [NEW] Modelos de Banco de Dados (`LootTable`)
- Derrotar a Masmorra (Clear) revelará uma tela de espólios.
- **Drops:** Emblemas raros, Equipamentos direto pro Inventário, Auras Cósmicas, Mana Coins e **Cristais de Sombra** (moeda premium).

### 6. Cerimônia de Clear (O Desfecho)
#### [MODIFY] `webapp/frontend/js/pages/dungeon-score.js`
- Uma **Cerimônia de Conquista** estilo Level Up com estampas sonoras na tela (Rank S, A, B...).
- Abertura de baús (Loot) após a vitória.

## 🧪 Verification Plan
- Implementar as tabelas (Equipamentos, Inventário, Membros de Dungeon e Loot Tables).
- Aplicar o banho de loja visual na entrada e interior das Dungeons.
- Criar a Silhueta vazia acessível apenas dentro da Masmorra, com itens de teste na Loja.
- Entrar na Dungeon e validar: Silhueta, Party, Cerimônia de Clear, Drops e Cards S-Rank.
