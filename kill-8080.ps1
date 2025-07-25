# kill-8080.ps1

$port = 8080
$maxAttempts = 5
$attempt = 1
$killed = $false

while ($attempt -le $maxAttempts -and -not $killed) {
    # Get process using port
    $result = netstat -ano | Select-String ":$port\s+.*LISTENING\s+(\d+)" | ForEach-Object {
        $matchResult = [regex]::Match($_, "^\s*(\S+)\s+.*LISTENING\s+(\d+)$")
        if ($matchResult.Success) {
            return $matchResult.Groups[2].Value
        }
    }

    if ($result) {
        $processId = [int]$result
        Write-Host "[INFO] Port $port is in use by PID $processId (Attempt ${attempt}/${maxAttempts})" -ForegroundColor Yellow

        try {
            Stop-Process -Id $processId -Force -ErrorAction Stop
            Write-Host "[SUCCESS] Process $processId using port $port has been killed." -ForegroundColor Green
            $killed = $true
        } catch {
            Write-Host "[ERROR] Failed to kill process $processId. Retrying in 1 second..." -ForegroundColor Red
            Start-Sleep -Seconds 1
        }
    } else {
        Write-Host "[INFO] Port $port is free." -ForegroundColor Cyan
        $killed = $true
    }

    $attempt++
}

if (-not $killed) {
    Write-Host "[WARNING] Could not free port $port after ${maxAttempts} attempts." -ForegroundColor Red
}
