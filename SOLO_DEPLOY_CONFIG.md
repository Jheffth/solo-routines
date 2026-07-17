# 📦 Solo Projects — Configuração de Deploy

Referência completa para criar e configurar novos projetos no stack Solo.

---

## 🏗️ Arquitetura Padrão

```
GitHub (código)
    ↓  push automático
Render (servidor)  →  conecta  →  Neon (banco PostgreSQL)
  grátis                            grátis / persistente
```

---

## 🛠️ Stack Tecnológico

| Camada | Tecnologia | Versão |
|---|---|---|
| **Backend** | FastAPI | 0.111.0 |
| **Servidor** | Uvicorn | 0.29.0 |
| **ORM** | SQLAlchemy | 2.0.30 |
| **Banco (prod)** | PostgreSQL (Neon) | 18 |
| **Banco (local)** | SQLite | — |
| **Auth** | JWT (python-jose) | 3.3.0 |
| **Hash senha** | passlib + bcrypt | 1.7.4 |
| **Scheduler** | APScheduler | 3.10.4 |
| **Frontend** | HTML/CSS/JS puro | — |
| **Python** | 3.12 (pinado) | 3.12.0 |

---

## 🌐 Serviços Utilizados (todos grátis)

| Serviço | Função | URL | Plano |
|---|---|---|---|
| **GitHub** | Repositório de código | github.com/Jheffth | Free |
| **Render** | Hospedagem do app | render.com | Free (Web Service) |
| **Neon** | Banco PostgreSQL | neon.tech | Free (0.5 GB) |

---

## 🚀 Como criar um novo projeto

### 1. Repositório (GitHub)
- Criar repo em github.com/Jheffth
- Push inicial com `.gitignore` configurado

### 2. Banco de Dados (Neon)
1. Acessar [neon.tech](https://neon.tech) → Login com GitHub
2. **New Project** → nome do projeto
3. Region: `AWS US East 1 (N. Virginia)`
4. Postgres version: `18`
5. Neon Auth: **desligado**
6. Copiar a **Connection String** (clicar em "Show password")
7. Formato: `postgresql://user:senha@host/dbname?sslmode=require`

### 3. Servidor (Render)
1. Acessar [render.com](https://render.com) → Login com GitHub
2. **New → Web Service**
3. Conectar repositório GitHub
4. Configurar:
   - **Language:** `Python`
   - **Branch:** `master`
   - **Root Directory:** `webapp/backend` *(se usar estrutura monorepo)*
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `python entrypoint.py`
   - **Instance Type:** `Free`
5. Adicionar **Environment Variables:**

| Variável | Valor |
|---|---|
| `SECRET_KEY` | *(string aleatória segura)* |
| `DATABASE_URL` | *(connection string do Neon)* |
| `PYTHON_VERSION` | `3.12.0` |

---

## 📁 Arquivos obrigatórios no backend

| Arquivo | Função |
|---|---|
| `requirements.txt` | Dependências Python |
| `entrypoint.py` | Lê `PORT` do ambiente e inicia uvicorn |
| `config.py` | Lê variáveis de ambiente (`DATABASE_URL`, `SECRET_KEY`) |
| `database.py` | Suporte a SQLite (local) e PostgreSQL (prod) |
| `seed.py` | Cria usuários e dados iniciais automaticamente |
| `.python-version` | Pina Python 3.12 para o Render |
| `runtime.txt` | Backup do pin de versão Python |
| `.gitignore` | Protege `.env`, `.db`, `__pycache__`, etc. |

---

## ⚙️ config.py padrão

```python
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24h

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
# Neon/Railway usam postgres://, SQLAlchemy 2.x exige postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
```

---

## 📋 entrypoint.py padrão

```python
import os
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
```

---

## 🔄 Fluxo de manutenção

```
Editar código localmente
    ↓
git add . && git commit -m "descrição"
    ↓
git push origin master
    ↓
Render detecta e deploya automaticamente (~2 min)
    ↓
Banco Neon não é afetado (dados persistem sempre)
```

---

## ⚠️ Limitações do plano gratuito

| Serviço | Limitação |
|---|---|
| **Render** | App hiberna após 50s de inatividade (acorda em ~30s) |
| **Render** | 750h de compute/mês |
| **Neon** | 0.5 GB de armazenamento |
| **Neon** | Banco hiberna após inatividade (reconecta automaticamente) |

> **Dica:** Bot Telegram em modo **polling** mantém o Render ativo 24/7, eliminando a hibernação.

---

## 🔑 Projetos ativos

| Projeto | GitHub | Render | Neon |
|---|---|---|---|
| **Solo Finances** | Jheffth/solo-finances | solo-finances.onrender.com | — |
| **Solo Routines** | Jheffth/solo-routines | solo-routines.onrender.com | ep-broad-hat-at3qi4mu |

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

- Dark mode obrigatório
- Glassmorphism nos cards
- Animações suaves (CSS transitions)
- Fonte: Inter ou Outfit (Google Fonts)
