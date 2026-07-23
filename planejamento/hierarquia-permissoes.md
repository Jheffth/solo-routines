# Hierarquia de Permissões — Solo Routines
# Criado: 2026-07-23
# Atualizar conforme funcionalidades forem implementadas.

## Status por nível

| Símbolo | Significado |
|---|---|
| ✅ | Implementado e funcionando |
| 🔨 | A implementar |
| ❌ | Bloqueado / Sem acesso |

---

## Tabela Completa de Permissões

| Funcionalidade | 👤 Hunter | 🎧 Suporte | 🛡 Moderador | ⚙️ Admin | ⚒ Criador | 🛡 Arquiteto |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Missões/Rotinas próprias** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Dungeons próprias** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Ver perfil de outros hunters** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Chat e sistema social** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Ver lista de todos os hunters** | ❌ | 🔨 | 🔨 | ✅ | ✅ | ✅ |
| **Ver logs de acesso/atividade** | ❌ | 🔨 | 🔨 | ✅ | ✅ | ✅ |
| **Moderar chat (apagar msg, banir)** | ❌ | ❌ | 🔨 | 🔨 | 🔨 | ✅ |
| **Moderar amizades (reportes)** | ❌ | ❌ | 🔨 | 🔨 | 🔨 | ✅ |
| **Gerenciar hunters (banir/reativar)** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Conceder badges a hunters** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Configurações do sistema** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Criar dungeons globais** | ❌ | ❌ | ❌ | ❌ | 🔨 | ✅ |
| **Criar missões/rotinas globais** | ❌ | ❌ | ❌ | ❌ | 🔨 | ✅ |
| **Gerar convites** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Alterar cargo de qualquer hunter** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Bot Telegram** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Rotas do Backend por Nível de Acesso

### get_usuario_atual (qualquer autenticado)
- `GET /rotinas` — listar rotinas próprias
- `POST /rotinas` — criar rotina
- `GET /tarefas` — listar tarefas
- `GET /dashboard` — dados do dashboard
- `GET /perfil/me` — dados do próprio perfil
- `GET /dungeons` — listar dungeons disponíveis
- `GET /social/*` — chat, amizades, feed

### get_admin (Suporte → Admin → Criador → Arquiteto)
- `GET /gerencial/hunters` — lista de todos os hunters ✅
- `GET /gerencial/logs` — logs de atividade ✅
- `POST /gerencial/hunter/{id}/banir` — banir hunter ✅
- `POST /gerencial/hunter/{id}/reativar` — reativar hunter ✅
- `POST /recompensas/conceder` — conceder badge a hunter ✅
- `GET/PUT /configuracoes` — configurações do sistema ✅

### get_gestor (Admin → Criador → Arquiteto)
- `POST /dungeons/global` — criar dungeon global 🔨
- `POST /rotinas/global` — criar missão global 🔨

### get_arquiteto (somente Arquiteto)
- `POST /convites` — gerar convites ✅
- `POST /arquiteto/conceder/cargo` — alterar cargo ✅
- `POST /arquiteto/conceder/conquista` — conceder insígnia ✅
- `GET /arquiteto/poderes` — painel de poderes ✅
- `GET /bot_telegram/*` — controle do bot ✅
- `POST /dungeons/entrada-arquiteto` — dungeon exclusiva ✅

---

## Progresso de Implementação

### ✅ Concluído (2026-07-23)
- [x] Criação dos 6 níveis no backend (`NIVEIS`, `NIVEIS_PERMITIDOS`, `NIVEIS_ADMIN`)
- [x] Funções de guarda: `get_admin`, `get_moderador`, `get_gestor`, `get_arquiteto`
- [x] Modal de convites: 5 botões de nível com cores próprias
- [x] Lista de convites: badge colorida por nível no histórico
- [x] `_aura_cargo`: auras visuais para Moderador e Suporte
- [x] `auth.js`: helpers `isModerador()`, `isSuporte()`, `isCriador()`, `isGestor()`
- [x] Admins têm acesso pleno a: gerencial, recompensas, configurações

### 🔨 A Implementar
- [ ] Suporte e Moderador: acesso read-only ao painel gerencial (lista de hunters + logs)
- [ ] Moderador: moderar chat (apagar mensagens, silenciar)
- [ ] Moderador: sistema de reportes (aceitar/rejeitar denúncias)
- [ ] Criador: criar dungeons e missões globais
- [ ] Frontend: nav-gerencial visível para Suporte/Moderador (só leitura)
- [ ] Frontend: badge/tag de cargo nos perfis públicos e no chat
