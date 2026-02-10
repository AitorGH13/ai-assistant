# Script para limpiar puertos 3001 y 5173
Write-Host "Limpiando puertos 3001 y 5173..." -ForegroundColor Cyan

$ports = @(3001, 5173)
$killed = $false

foreach ($port in $ports) {
    $result = netstat -ano | Select-String ":$port\s" | Select-String "LISTENING"
    foreach ($line in $result) {
        if ($line -match '\s+(\d+)\s*$') {
            $processId = $matches[1]
            if ($processId -ne "0") {
                Write-Host "Matando proceso $processId en puerto $port" -ForegroundColor Yellow
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                $killed = $true
            }
        }
    }
}

if ($killed) {
    Start-Sleep -Milliseconds 500
    Write-Host "Procesos eliminados!" -ForegroundColor Green
} else {
    Write-Host "No hay procesos usando los puertos" -ForegroundColor Green
}
