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

## 🚀 Como fazer o Deploy no Contabo

Não estamos mais usando o Render. O deploy não é mais automático apenas dando `git push`. 

**Para aplicar mudanças na produção:**

> ### ⚠️ A senha root estava escrita aqui
>
> Esta seção trazia a senha de root em texto puro, e este arquivo é
> versionado. Ela foi removida do texto — mas **continua no histórico do
> git** e, portanto, **continua comprometida até ser trocada no painel do
> Contabo**. Apagar a linha não desfaz o vazamento; trocar a senha desfaz.
>
> Depois de trocar, o melhor passo é não precisar mais dela: instale sua
> chave pública (`ssh-copy-id root@<ip>`) e desligue o login por senha
> (`PasswordAuthentication no` em `/etc/ssh/sshd_config`). Aí nenhum script
> nem documento precisa guardar segredo nenhum.

### Antes de qualquer deploy

```bash
python scripts/selar_build.py    # grava VERSION + commit em backend/build_info.json
```

Sem isso o rodapé sobe marcado como **"sem selo"** — de propósito. O servidor
não consegue descobrir o commit sozinho (o `/root/app/` não é repositório
git), então quem sela é a sua máquina. O selo precisa ir junto no commit: o
deploy move só o que está em `git ls-files`.

### Opção 1: Script Automático via Python
1. Rode o script local `python scripts/deploy_contabo.py`.
2. O script conecta em `169.58.116.61` como `root`, preferindo **chave SSH**.
   Se não houver chave, ele pede a senha no terminal (ou lê de
   `SOLO_DEPLOY_SENHA`). Nada de credencial gravada em arquivo.
3. Ele reconstrói a imagem Docker. **A sincronia dos arquivos é por SFTP e
   acontece antes** — o script não a faz.

### Opção 2: Manual via SSH
1. **Transferir os arquivos modificados:**
   Use SCP ou um cliente FTP (como FileZilla/Termius) para enviar os arquivos da sua máquina para o diretório `/root/app/` no Contabo.
2. **Acessar o servidor:**
   `ssh root@169.58.116.61`
3. **Reiniciar os contêineres:**
   ```bash
   cd /root/app/webapp
   docker compose build api
   docker compose up -d
   ```

*(Nota: Como o diretório /root/app/ no Contabo não é um repositório git, um simples git pull não funcionará lá).*

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
