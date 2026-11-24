@echo off
chcp 65001 >nul
title ClipaCortes Studio AI - Servidor Local (Backend FFmpeg + Frontend Vite)
echo ===============================================================================
echo   Iniciando ClipaCortes Studio AI (Baseado na Arquitetura Opus Clip + Gemini)
echo   - Interface Studio Web:         http://localhost:5173
echo   - Backend API + FFmpeg/FFprobe: http://localhost:3001
echo   A janela do navegador sera aberta automaticamente em instantes...
echo ===============================================================================
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5173"
npm run dev
pause
