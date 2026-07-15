# ===================== DEPLOY API - WINDOWS VERSION =====================
# Version PowerShell del script deploy.sh para Windows
# ========================================================================

# Colores para PowerShell
$Magenta = "Magenta"
$Yellow = "Yellow"
$Green = "Green"
$Red = "Red"
$Cyan = "Cyan"
$Blue = "Blue"

$divider = "========================================================="

# ===================== BANNER =====================
Write-Host $divider -ForegroundColor $Magenta
Write-Host "##                                                 ##" -ForegroundColor $Magenta
Write-Host "##       DEPLOY API                                ##" -ForegroundColor $Magenta
Write-Host "##                                                 ##" -ForegroundColor $Magenta
Write-Host $divider -ForegroundColor $Magenta
Write-Host "Iniciando proceso de Deploy de API" -ForegroundColor $Yellow
Write-Host $divider -ForegroundColor $Blue

# ===================== PASO 1 =====================
Write-Host "`nPASO 1: Guardar cambios en el repo local de API" -ForegroundColor $Cyan

git add .
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
git commit -m "Pre-Deploy API $timestamp" 2>&1 | Out-Null
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "Cambios guardados y enviados a GitHub correctamente" -ForegroundColor $Green
} else {
    Write-Host "Error al guardar/enviar cambios a GitHub" -ForegroundColor $Red
    exit 1
}

# ===================== PASO 2 =====================
Write-Host "`nPASO 2: Actualizar en el servidor remoto" -ForegroundColor $Cyan

# Ruta de la clave SSH en Windows
$sshKey = "$env:USERPROFILE\.ssh\id_droplet"

$sshCommand = "cd /var/www/api_sequelize && git stash push -m 'auto-stash' -- backups/** logs/** metrics/** 2>/dev/null || true && git pull --rebase origin main || git reset --hard origin/main && git stash pop 2>/dev/null || true && echo 'Actualizacion completada'"

ssh -i $sshKey root@64.226.123.91 $sshCommand

if ($LASTEXITCODE -eq 0) {
    Write-Host "Servidor remoto actualizado correctamente" -ForegroundColor $Green
} else {
    Write-Host "Error al actualizar API en el servidor" -ForegroundColor $Red
    exit 1
}

# ===================== PASO 3 =====================
Write-Host "`nPASO 3: Reiniciar PM2 y validar" -ForegroundColor $Cyan

$pm2Command = "export NVM_DIR=`$HOME/.nvm && [ -s `$NVM_DIR/nvm.sh ] && . `$NVM_DIR/nvm.sh && cd /var/www/api_sequelize && chmod +x scripts/*.sh && pm2 restart api_sequelize && sleep 3 && pm2 list | grep api_sequelize"

ssh -i $sshKey root@64.226.123.91 $pm2Command

if ($LASTEXITCODE -eq 0) {
    Write-Host "PM2 reiniciado correctamente" -ForegroundColor $Green
} else {
    Write-Host "PM2 podria tener problemas, verifica manualmente" -ForegroundColor $Yellow
}

# ===================== PASO 4 =====================
Write-Host "`nPASO 4: Validar endpoints" -ForegroundColor $Cyan
Write-Host "Esperando que el servidor este listo..." -ForegroundColor $Yellow
Start-Sleep -Seconds 5

# Verificar health endpoint
try {
    $healthResponse = Invoke-WebRequest -Uri "https://api.lujandev.com/health" -UseBasicParsing -TimeoutSec 10
    if ($healthResponse.StatusCode -eq 200) {
        Write-Host "/health - OK (200)" -ForegroundColor $Green
    }
} catch {
    Write-Host "/health - Error" -ForegroundColor $Red
}

# Verificar dashboard
try {
    $dashboardResponse = Invoke-WebRequest -Uri "https://api.lujandev.com/dashboard.html" -UseBasicParsing -TimeoutSec 10
    if ($dashboardResponse.StatusCode -eq 200) {
        Write-Host "/dashboard.html - OK (200)" -ForegroundColor $Green
    }
} catch {
    Write-Host "/dashboard.html - Error" -ForegroundColor $Yellow
}

# Verificar metricas
try {
    $metricsResponse = Invoke-WebRequest -Uri "https://api.lujandev.com/metrics/latest.json" -UseBasicParsing -TimeoutSec 10
    if ($metricsResponse.StatusCode -eq 200) {
        Write-Host "/metrics/latest.json - OK (200)" -ForegroundColor $Green
    }
} catch {
    Write-Host "/metrics/latest.json - Error" -ForegroundColor $Yellow
}

# ================= FIN =================
Write-Host "`n$divider" -ForegroundColor $Magenta
Write-Host "##    DEPLOY API COMPLETADO                        ##" -ForegroundColor $Magenta
Write-Host "##    API actualizada y en produccion              ##" -ForegroundColor $Magenta
Write-Host $divider -ForegroundColor $Magenta

Write-Host "`nURLs Disponibles:" -ForegroundColor $Cyan
Write-Host "   https://api.lujandev.com/health" -ForegroundColor $Blue
Write-Host "   https://api.lujandev.com/dashboard.html" -ForegroundColor $Blue
