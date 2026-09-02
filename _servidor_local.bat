@echo off
title Solo Routines - BANCO LOCAL
color 0B
cd /d "C:\JEFFERSON\PROJETOS\01 - SOLO ROTINAS\webapp\backend"

:: ==========================================================
::  SERVIDOR DE DESENVOLVIMENTO — banco LOCAL, nao a producao
:: ==========================================================
::
::  O `_servidor.bat` normal usa o DATABASE_URL do .env, que aponta
::  para o Postgres do Contabo. Do Brasil, cada consulta e uma viagem
::  ao outro lado do Atlantico: uma tela com trinta consultas leva
::  segundos so em latencia.
::
::  Aqui a variavel de ambiente e definida ANTES do Python subir. O
::  `load_dotenv()` do config.py NAO sobrescreve variavel que ja
::  existe no ambiente, entao esta linha vence o .env sem alterar uma
::  virgula dele. Fechou esta janela, acabou o efeito.
::
::  ATENCAO: o que voce fizer aqui NAO acontece na sua conta de
::  verdade. E o objetivo -- ate agora desenvolvimento e producao
::  compartilhavam o mesmo banco, e um teste criava missao na sua
::  conta real.

if not exist "solo_local.db" (
    echo.
    echo  [ERRO] O espelho local nao existe.
    echo.
    echo  Rode antes, uma vez:
    echo      python scripts\espelhar_banco.py
    echo.
    echo  Ele copia a producao para um SQLite local, so lendo.
    echo.
    pause
    exit /b 1
)

set "DATABASE_URL=sqlite:///./solo_local.db"

:: Chave fixa so para o ambiente local: sem ela o config gera uma nova
:: a cada boot e voce e deslogado a cada reinicio do uvicorn --reload.
:: NAO use este valor em producao.
set "SECRET_KEY=dev-local-nao-usar-em-producao-0000000000"

echo.
echo  ==========================================
echo   BANCO LOCAL  (solo_local.db)
echo   A producao NAO sera tocada.
echo  ==========================================
echo.

"C:\ProgramData\miniconda3\python.exe" -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
