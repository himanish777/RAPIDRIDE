# RapidRide Server Restart Script
Write-Host "🔍 Checking for processes on port 5500..." -ForegroundColor Cyan

# Find and kill processes using port 5500
$connections = Get-NetTCPConnection -LocalPort 5500 -ErrorAction SilentlyContinue

if ($connections) {
    Write-Host "⚠️  Found processes using port 5500. Stopping them..." -ForegroundColor Yellow
    $connections | ForEach-Object {
        $processId = $_.OwningProcess
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "   Stopping process: $($process.Name) (PID: $processId)" -ForegroundColor Red
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
    }
    Write-Host "✅ All processes stopped" -ForegroundColor Green
    Start-Sleep -Seconds 2
} else {
    Write-Host "✅ Port 5500 is free" -ForegroundColor Green
}

# Start the server
Write-Host ""
Write-Host "🚀 Starting RapidRide server..." -ForegroundColor Cyan
Write-Host ""
npm start
