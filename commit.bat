@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   Mia Game - commit and push to GitHub
echo ========================================
echo.

REM Show what changed
git status --short

REM Commit message: argument or auto timestamp
set "MSG=%~1"
if "%MSG%"=="" set "MSG=Update %date% %time%"

git add -A
git commit -m "%MSG%"
if errorlevel 1 (
    echo.
    echo Nothing to commit.
)

git push origin HEAD
if errorlevel 1 (
    echo.
    echo PUSH FAILED. Check internet / GitHub login.
    pause
    exit /b 1
)

echo.
echo Done! Pushed to https://github.com/skhvisual/mia-game
pause
