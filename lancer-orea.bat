@echo off
chcp 65001 >nul
title Orea - lancement
cd /d "%~dp0"

echo.
echo   ===============================================
echo     Orea : demarrage de l'API et du site
echo   ===============================================
echo.

rem --- API (FastAPI) dans sa propre fenetre ---
start "Orea - API (port 8000)" cmd /k "cd /d "%~dp0backend" && .venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000"

rem --- Site (Next.js) dans sa propre fenetre ---
start "Orea - Site (port 3000)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo   Patiente une vingtaine de secondes, le site va s'ouvrir...
timeout /t 20 /nobreak >nul
start "" http://localhost:3000

echo.
echo   Site      : http://localhost:3000
echo   API       : http://127.0.0.1:8000/docs
echo   Comptes   : aya@orea.ci, koffi@orea.ci, relais.cocody@orea.ci, admin@orea.ci
echo   Mot de passe : Orea2026!
echo.
echo   Pour tout arreter : ferme les deux fenetres "Orea - API" et "Orea - Site".
echo.
pause
