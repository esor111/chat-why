# Chat Backend Test Environment Startup Script

Write-Host "🚀 Starting Chat Backend Test Environment..." -ForegroundColor Green
Write-Host ""

# Start Mock kaha-main-v3 service
Write-Host "📡 Starting Mock kaha-main-v3 service..." -ForegroundColor Yellow
$mockService = Start-Process -FilePath "node" -ArgumentList "scripts/mock-kaha-service.js" -PassThru -WindowStyle Normal
Start-Sleep -Seconds 2

# Start UI Server
Write-Host "🌐 Starting UI Server..." -ForegroundColor Yellow
$uiServer = Start-Process -FilePath "node" -ArgumentList "scripts/start-ui-server.js" -PassThru -WindowStyle Normal
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Chat Backend Test Environment Ready!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Services running:" -ForegroundColor Cyan
Write-Host "  • Main Backend: http://localhost:3000" -ForegroundColor White
Write-Host "  • Mock Service: http://localhost:3001" -ForegroundColor White
Write-Host "  • Test UI:      http://localhost:3002" -ForegroundColor White
Write-Host ""
Write-Host "🌐 Open your browser and go to:" -ForegroundColor Yellow
Write-Host "   http://localhost:3002" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop all services..." -ForegroundColor Red

# Wait for user to stop
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host ""
    Write-Host "🛑 Stopping services..." -ForegroundColor Red
    
    if ($mockService -and !$mockService.HasExited) {
        Stop-Process -Id $mockService.Id -Force -ErrorAction SilentlyContinue
        Write-Host "✅ Mock service stopped" -ForegroundColor Green
    }
    
    if ($uiServer -and !$uiServer.HasExited) {
        Stop-Process -Id $uiServer.Id -Force -ErrorAction SilentlyContinue
        Write-Host "✅ UI server stopped" -ForegroundColor Green
    }
    
    Write-Host "👋 All services stopped." -ForegroundColor Green
}