@echo off
chcp 65001 > nul
title LITSEY FACE ID - Avtomatlashtirilgan Davomat Tizimi
color 0A

echo ==============================================================
echo           LITSEY FACE ID — LOKAL SERVERNI ISHGA TUSHIRISH     
echo ==============================================================
echo.

:: Node.js o'rnatilganligini tekshirish
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [XATOLIK] Node.js kompyuteringizda topilmadi!
    echo Iltimos, https://nodejs.org saytidan Node.js ni o'rnating.
    pause
    exit /b
)

:: Bog'liqliklar mavjudligini tekshirish
if not exist node_modules (
    echo [MA'LUMOT] Kerakli kutubxonalar o'rnatilmoqda (npm install)...
    call npm install
    if %errorlevel% neq 0 (
        echo [XATOLIK] Kutubxonalarni o'rnatishda xatolik yuz berdi.
        pause
        exit /b
    )
)

echo [✓] Tizim tayyorlanmoqda...
echo [✓] Lokal SQLite ma'lumotlar bazasi tekshirilmoqda...
echo [✓] Port: 3000
echo.
echo Server ishga tushirilmoqda. Brauzer avtomatik ochiladi...
echo To'xtatish uchun: stop.bat faylini ishlating yoki Ctrl+C bosing.
echo.

start "" "http://localhost:3000"
npm run dev

pause
