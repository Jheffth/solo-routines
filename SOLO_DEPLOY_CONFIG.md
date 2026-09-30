# 📦 Solo Projects — Configuração de Deploy

Referência completa para criar e configurar projetos no stack Solo, agora focado no ambiente da VPS Contabo.

---

## 🏗️ Arquitetura Padrão

```
GitHub (código para controle de versão e histórico)
    ↓
Máquina Local (modificações) → Envia via SFTP / SCP → VPS Contabo (169.58.116.61)
                                                          ↓
                                                    Docker Compose
                                                    (Servidor Uvicorn + Banco PostgreSQL no Neon)
```

---

## 🛠️ Stack Tecnológico

| Camada | Tecnologia | Versão |
|---|---|---|
| **Backend** | FastAPI | 0.111.0 |
| **Servidor** | Uvicorn | 0.29.0 |
| **ORM** | SQLAlchemy | 2.0.30 |
| **Banco (prod)** | PostgreSQL (Neon ou Local) | 18 |
| **Banco (local)** | SQLite | — |
| **Auth** | JWT (python-jose) | 3.3.0 |
| **Frontend** | HTML/CSS/JS puro | — |
| **VPS** | Contabo | Ubuntu / Linux |

---

## 🌐 Serviços Utilizados

| Serviço | Função | URL | Plano |
|---|---|---|---|
| **GitHub** | Repositório de código (histórico) | github.com/Jheffth | Free |
| **Contabo**| Hospedagem do app (VPS) | soloroutines.duckdns.org | Pago |
| **Neon** | Banco PostgreSQL | neon.tech | Free |

---

## 🚀 Como funciona o Deploy Automático (Git Hooks)

O deploy voltou a ser **automático**, mas de forma independente e mais rápida que o antigo Render!

Nós configuramos o repositório local (na sua máquina) para possuir **duas URLs de push** para o `origin`.
Sempre que você rodar um `git push origin master`, o Git fará duas coisas:
1. Envia o código para o **GitHub** (backup e histórico).
2. Envia o código diretamente para o repositório oculto na **VPS Contabo**.

No servidor Contabo, configuramos um **Git Hook** (`post-receive`). Assim que o servidor recebe o seu push, ele automaticamente copia os arquivos para `/root/app/`, reconstrói a imagem Docker (`docker compose build api`) e sobe os contêineres atualizados.

### Como fazer um deploy na prática:

1. **Selar o build localmente:**
   ```bash
   python scripts/selar_build.py
   git add webapp/backend/build_info.json
   git commit -m "chore(build): atualiza build_info"
   ```

2. **Enviar para produção:**
   ```bash
   git push origin master
   ```
   *Pronto! O próprio terminal mostrará o log de build do Docker acontecendo remotamente lá no Contabo. Quando o comando terminar, o site já estará no ar atualizado.*

*(Nota: O antigo script `scripts/deploy_contabo.py` se tornou obsoleto com essa nova arquitetura).*

---

## 📁 Arquivos obrigatórios no backend

| Arquivo | Função |
|---|---|
| `requirements.txt` | Dependências Python |
| `config.py` | Lê variáveis de ambiente |
| `database.py` | Suporte a SQLite e PostgreSQL |
| `Dockerfile` | Constrói a imagem da API FastAPI |
| `docker-compose.yml`| Orquestra API, Banco (opcional) e Caddy/Proxy |

---

## 🔄 Fluxo de manutenção atualizado

```text
1. Editar código localmente e testar (localhost:8000).
2. Commit e Push pro GitHub (Para garantir o backup e histórico do código):
   git add . && git commit -m "..." && git push origin master
3. Enviar as alterações para o Contabo (SFTP/SCP) para a pasta /root/app/.
4. No servidor, rodar:
   cd /root/app/webapp && docker compose build api && docker compose up -d
5. (Se alterou JS/CSS) Dar Ctrl+F5 no navegador em soloroutines.duckdns.org
```

---

## ⚠️ Sobre o Cache do Frontend (Auras e Insígnias SVG)

Muitas artes do sistema, como **Auras** e **Insígnias S-Rank** (ex: *Monarca das Sombras*, *Fênix*, etc.), são construídas via código no Frontend (Javascript + SVG gerado dinamicamente).
Elas **não** ficam salvas no banco de dados.

Sempre que um agente criar um desses elementos:
- Eles não aparecerão sozinhos após o envio.
- Você precisará dar **Ctrl + F5** (Hard Refresh) no site (`soloroutines.duckdns.org`) para o seu navegador limpar o cache e carregar os novos `.js`.

---

## 🔑 Acesso ao Servidor (Contabo)

| Parâmetro | Valor |
|---|---|
| **IP / Host** | `169.58.116.61` |
| **Domínio** | `soloroutines.duckdns.org` |
| **Usuário SSH** | `root` |
| **Senha SSH** | *fora do repositório* — chave SSH, ou `SOLO_DEPLOY_SENHA` |
| **Diretório App** | `/root/app/` |
| **Diretório Docker**| `/root/app/webapp/` |

A senha não mora mais em arquivo nenhum do projeto. Os scripts pedem a
conexão a `scripts/ssh_contabo.py`, que tenta chave SSH primeiro e só
pergunta no terminal se não houver. Se você instalar sua chave pública no
servidor, nada mais precisa ser digitado — nem existir.

---

## 🎨 Padrão de Design (Solo Leveling)

```css
--bg-deep: #050508
--bg-card: #0d0d1a
--purple-main: #7c3aed
--purple-glow: #a855f7
--gold-xp: #f59e0b
--text-primary: #e2e8f0
```

- Dark mode obrigatório, Glassmorphism nos cards, Animações S-Rank (CSS).
