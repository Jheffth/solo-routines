@echo off
chcp 65001 >nul
title Solo Routines — Sistema de Missões

echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║         SOLO ROUTINES — v1.0.0                      ║
echo ║         Sistema Gamificado de Rotinas                ║
echo ║         Baseado em: Solo Leveling                    ║
echo ╚══════════════════════════════════════════════════════╝
echo.

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Python nao encontrado. Instale Python 3.11+
    pause & exit /b 1
)

cd /d "%~dp0backend"

if not exist ".deps_ok" (
    echo [1/3] Instalando dependencias Python...
    pip install -r requirements.txt -q
    if %errorlevel% equ 0 (
        echo . > .deps_ok
        echo [OK] Dependencias instaladas!
    ) else (
        echo [ERRO] Falha ao instalar dependencias.
        pause & exit /b 1
    )
) else (
    echo [OK] Dependencias ja instaladas.
)

echo [2/3] Inicializando banco de dados...
python seed.py

echo [3/3] Abrindo navegador...
timeout /t 2 /nobreak >nul
start http://localhost:8000

echo.
echo ════════════════════════════════════════════════════════
echo  Sistema iniciado! Acesse: http://localhost:8000
echo  Login: admin  ^|  Senha: admin123
echo  Para encerrar: Ctrl+C
echo ════════════════════════════════════════════════════════
echo.

python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
