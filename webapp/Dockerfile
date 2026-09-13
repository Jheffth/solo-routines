FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/backend

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir psycopg2-binary

COPY backend/ ./backend/
COPY frontend/ ./frontend/

# O SELO DO BUILD.
#
# O `VERSION` da raiz do repositório NÃO pode ser copiado daqui: o contexto
# de build é `webapp/`, e ele está um nível acima. Foi essa a causa do rodapé
# mostrar 1.6.0 com o VERSION dizendo 1.8.0 — a busca falhava dentro da
# imagem e um literal cravado no config.py respondia no lugar.
#
# A resposta normal vem de `backend/build_info.json`, que o COPY acima já
# traz (gravado por `scripts/selar_build.py` antes do commit). Estes ARGs são
# a segunda porta: um CI pode passar `--build-arg APP_VERSAO=... APP_SHA=...`
# sem depender de arquivo nenhum. Vazios, não atrapalham — o endpoint só olha
# para eles se o selo não estiver lá.
ARG APP_VERSAO=""
ARG APP_SHA=""
ENV APP_VERSAO=$APP_VERSAO
ENV APP_SHA=$APP_SHA

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
