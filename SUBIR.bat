@echo off
REM ══════════════════════════════════════════════════════════════════
REM  SUBIR — GitHub e Contabo, nesta ordem.
REM
REM  Sem senha nenhuma aqui dentro, e isso é o ponto:
REM    · o `git push` usa o login do GitHub guardado neste Windows;
REM    · o deploy entra no servidor pela chave ~/.ssh/id_ed25519
REM      (scripts/ssh_contabo.py tenta a chave primeiro).
REM
REM  SE A JANELA PEDIR A SENHA DO ROOT, a chave não foi aceita. Não é
REM  normal — feche e investigue a chave, em vez de digitar a senha.
REM ══════════════════════════════════════════════════════════════════
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ===== 1/2  GitHub =====
git push
if errorlevel 1 (
  echo.
  echo [ERRO] O push para o GitHub falhou. O deploy NAO foi feito.
  goto fim
)

echo.
echo ===== 2/2  Contabo =====
python scripts\deploy_full.py

:fim
echo.
pause
