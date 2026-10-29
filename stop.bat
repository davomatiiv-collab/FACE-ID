@echo off
chcp 65001 > nul
title LITSEY FACE ID - Serverni To'xtatish
color 0C

echo ==============================================================
echo           LITSEY FACE ID — SERVERNI TO'XTATISH               
echo ==============================================================
echo.

echo 3000-portda ishlayotgan jarayon qidirilmoqda...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    echo Jarayon topildi (PID: %%a). To'xtatilmoqda...
    taskkill /F /PID %%a >nul 2>nul
)

echo [✓] Litsey Face ID serveri muvaffaqiyatli to'xtatildi.
echo.
pause
