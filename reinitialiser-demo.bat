@echo off
chcp 65001 >nul
title Orea - remise a zero de la demo
cd /d "%~dp0backend"
echo.
echo   Remise a zero des donnees de demonstration...
.venv\Scripts\python -m scripts.seed --reset
if exist outbox rmdir /s /q outbox
echo.
echo   C'est pret : les comptes et les donnees de demo sont comme neufs.
echo.
pause
