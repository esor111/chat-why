@echo off
echo Starting Chat Backend Test Environment...
echo.

echo Starting Mock kaha-main-v3 service...
start "Mock Service" cmd /k "node scripts/mock-kaha-service.js"

timeout /t 2 /nobreak >nul

echo Starting UI Server...
start "UI Server" cmd /k "node scripts/start-ui-server.js"

timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo   Chat Backend Test Environment Ready!
echo ========================================
echo.
echo Services running:
echo   • Main Backend: http://localhost:3000
echo   • Mock Service: http://localhost:3001  
echo   • Test UI:      http://localhost:3002
echo.
echo Open your browser and go to:
echo   http://localhost:3002
echo.
echo Press any key to stop all services...
pause >nul

echo Stopping services...
taskkill /f /im node.exe /fi "WINDOWTITLE eq Mock Service*" 2>nul
taskkill /f /im node.exe /fi "WINDOWTITLE eq UI Server*" 2>nul
echo Services stopped.