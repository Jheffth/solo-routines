@echo off
title Solo Routines - Backend Server
cd /d "C:\JEFFERSON\PROJETOS\01 - SOLO ROTINAS\webapp\backend"
echo ========================================
echo   Solo Routines Backend
echo   http://localhost:8000
echo   Pressione Ctrl+C para parar
echo ========================================
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
