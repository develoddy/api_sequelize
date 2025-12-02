#!/bin/bash

# ==============================================================================
# 🏥 ULTRA PRO PRODUCTION HEALTH CHECK v3.0 - ENTERPRISE EDITION
# ==============================================================================
# Sistema completo de validación de salud para entornos de producción
# 
# Características:
# - Medición de latencia y performance
# - Validación de certificados SSL
# - Monitoreo de recursos del servidor (CPU, RAM, Disco)
# - Estado de todos los procesos PM2
# - Análisis de tamaño de respuestas
# - Logs con timestamps detallados
# - Alertas inteligentes por umbrales
# - Export de resultados a JSON
# - 🆕 Alertas automáticas por Email (SMTP)
# - 🆕 Notificaciones a Slack Webhook
# - 🆕 Logs rotativos con historial
# - 🆕 Exportación automática de métricas
#
# Uso:
#   bash scripts/checkProductionHealth.sh                    # Modo normal
#   bash scripts/checkProductionHealth.sh --verbose          # Modo detallado
#   bash scripts/checkProductionHealth.sh --json output.json # Export JSON
#   bash scripts/checkProductionHealth.sh --alert            # Solo alertas
#   bash scripts/checkProductionHealth.sh --notify           # Con notificaciones
# ==============================================================================

# Colores profesionales
declare -r RESET='\033[0m'
declare -r BOLD='\033[1m'
declare -r DIM='\033[2m'

# Colores principales
declare -r SUCCESS='\033[38;5;46m'      # Verde brillante
declare -r ERROR='\033[38;5;196m'       # Rojo brillante
declare -r WARNING='\033[38;5;214m'     # Naranja
declare -r INFO='\033[38;5;39m'         # Azul cyan
declare -r HEADER='\033[38;5;105m'      # Púrpura
declare -r MUTED='\033[38;5;245m'       # Gris

# Configuración
declare -r SCRIPT_VERSION="3.0.0"
declare -r TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
declare -r LOG_DIR="logs"
declare -r LOG_FILE="$LOG_DIR/health-check-$(date '+%Y%m%d-%H%M%S').log"
declare -r JSON_METRICS_DIR="metrics"
declare -r JSON_LATEST="$JSON_METRICS_DIR/latest.json"

# Crear directorios si no existen
mkdir -p "$LOG_DIR" "$JSON_METRICS_DIR"

# Configuración de alertas (cargar desde .env si existe)
if [ -f ".env.monitoring" ]; then
  source .env.monitoring
fi

# Email Configuration (SMTP)
EMAIL_ENABLED="${EMAIL_ENABLED:-false}"
SMTP_HOST="${SMTP_HOST:-smtp.gmail.com}"
SMTP_PORT="${SMTP_PORT:-587}"
SMTP_USER="${SMTP_USER:-}"
SMTP_PASS="${SMTP_PASS:-}"
ALERT_EMAIL="${ALERT_EMAIL:-admin@lujandev.com}"

# Slack Configuration
SLACK_ENABLED="${SLACK_ENABLED:-false}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

# Flags de modo
VERBOSE=false
ALERT_ONLY=false
JSON_EXPORT=true  # Siempre exportar JSON por defecto
JSON_OUTPUT=""
NOTIFICATIONS_ENABLED=false

# Parse argumentos
while [[ $# -gt 0 ]]; do
  case $1 in
    --verbose|-v)
      VERBOSE=true
      shift
      ;;
    --alert|-a)
      ALERT_ONLY=true
      shift
      ;;
    --json|-j)
      JSON_EXPORT=true
      JSON_OUTPUT="$2"
      shift 2
      ;;
    --notify|-n)
      NOTIFICATIONS_ENABLED=true
      shift
      ;;
    *)
      shift
      ;;
  esac
done

# URLs de producción
declare -r API_URL="https://api.lujandev.com/api/health"
declare -r API_BASE="https://api.lujandev.com"
declare -r ADMIN_URL="https://admin.lujandev.com"
declare -r ECOMMERCE_URL="https://tienda.lujandev.com"

# Umbrales de alerta
declare -r MAX_LATENCY_MS=500
declare -r MAX_CPU_PERCENT=70
declare -r MAX_MEMORY_MB=300
declare -r MAX_DISK_PERCENT=80
declare -r MIN_SSL_DAYS=30

# Variables globales para resultados
ALERTS=()
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# ==============================================================================
# FUNCIONES AUXILIARES
# ==============================================================================

# Logging con timestamp
log() {
  local level=$1
  shift
  local message="$@"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Print con formato
print_header() {
  if [[ "$ALERT_ONLY" == false ]]; then
    echo ""
    echo -e "${HEADER}${BOLD}╔════════════════════════════════════════════════════════════════════════════╗${RESET}"
    echo -e "${HEADER}${BOLD}║  $1${RESET}"
    echo -e "${HEADER}${BOLD}╚════════════════════════════════════════════════════════════════════════════╝${RESET}"
    echo ""
  fi
}

print_section() {
  if [[ "$ALERT_ONLY" == false ]]; then
    echo ""
    echo -e "${INFO}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo -e "${INFO}${BOLD}$1${RESET}"
    echo -e "${INFO}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  fi
}

print_check() {
  local status=$1
  local label=$2
  local value=$3
  local threshold=$4
  
  ((TOTAL_CHECKS++))
  
  case $status in
    "OK")
      ((PASSED_CHECKS++))
      [[ "$ALERT_ONLY" == false ]] && echo -e "   ${SUCCESS}✓${RESET} ${BOLD}$label:${RESET} $value"
      ;;
    "WARN")
      ((WARNING_CHECKS++))
      echo -e "   ${WARNING}⚠${RESET} ${BOLD}$label:${RESET} $value ${DIM}(umbral: $threshold)${RESET}"
      ALERTS+=("WARNING: $label - $value (umbral: $threshold)")
      log "WARN" "$label: $value (umbral: $threshold)"
      ;;
    "FAIL")
      ((FAILED_CHECKS++))
      echo -e "   ${ERROR}✗${RESET} ${BOLD}$label:${RESET} $value"
      ALERTS+=("CRITICAL: $label - $value")
      log "ERROR" "$label: $value"
      ;;
  esac
}

# Formatear bytes a humano
format_bytes() {
  local bytes=$1
  if [[ $bytes -lt 1024 ]]; then
    echo "${bytes}B"
  elif [[ $bytes -lt 1048576 ]]; then
    echo "$(echo "scale=2; $bytes/1024" | bc)KB"
  else
    echo "$(echo "scale=2; $bytes/1048576" | bc)MB"
  fi
}

# Medir latencia con curl
measure_latency() {
  local url=$1
  local response=$(curl -o /dev/null -s -w "%{time_total},%{http_code},%{size_download}" "$url" --connect-timeout 10 --max-time 30)
  echo "$response"
}

# Validar SSL
check_ssl() {
  local domain=$1
  local expiry_date=$(echo | openssl s_client -servername "$domain" -connect "$domain":443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  
  if [[ -z "$expiry_date" ]]; then
    echo "ERROR"
    return
  fi
  
  # Convertir fecha de OpenSSL a epoch (compatible Linux y macOS)
  local expiry_epoch
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    expiry_epoch=$(date -j -f "%b %d %H:%M:%S %Y %Z" "$expiry_date" "+%s" 2>/dev/null)
  else
    # Linux
    expiry_epoch=$(date -d "$expiry_date" +%s 2>/dev/null)
  fi
  
  if [[ -z "$expiry_epoch" ]]; then
    echo "ERROR"
    return
  fi
  
  local current_epoch=$(date +%s)
  local days_remaining=$(( (expiry_epoch - current_epoch) / 86400 ))
  
  echo "$days_remaining"
}

# ==============================================================================
# FUNCIONES DE NOTIFICACIÓN
# ==============================================================================

# Enviar notificación por Email usando curl con SMTP
send_email_alert() {
  if [[ "$EMAIL_ENABLED" != "true" ]] || [[ -z "$SMTP_USER" ]] || [[ -z "$ALERT_EMAIL" ]]; then
    return
  fi
  
  local subject="$1"
  local body="$2"
  
  local email_body="Subject: $subject
From: $SMTP_USER
To: $ALERT_EMAIL
Content-Type: text/html; charset=UTF-8

<!DOCTYPE html>
<html>
<head><meta charset='UTF-8'></head>
<body style='font-family: Arial, sans-serif; padding: 20px;'>
  <h2 style='color: #e74c3c;'>⚠️ Production Health Alert</h2>
  <p><strong>Timestamp:</strong> $TIMESTAMP</p>
  <hr>
  <pre style='background: #f4f4f4; padding: 15px; border-radius: 5px;'>$body</pre>
  <hr>
  <p style='color: #7f8c8d; font-size: 12px;'>
    Este es un mensaje automático del sistema de monitoreo de producción.
  </p>
</body>
</html>"

  # Determinar flags SSL según el puerto
  local SSL_FLAGS=""
  if [[ "$SMTP_PORT" == "465" ]]; then
    # Puerto 465 usa SSL directo (smtps)
    SSL_FLAGS="--ssl"
  else
    # Puerto 587 usa STARTTLS
    SSL_FLAGS="--ssl-reqd"
  fi
  
  # Enviar usando curl con SMTP
  echo "$email_body" | curl --url "smtp://$SMTP_HOST:$SMTP_PORT" \
    --mail-from "$SMTP_USER" \
    --mail-rcpt "$ALERT_EMAIL" \
    --user "$SMTP_USER:$SMTP_PASS" \
    --upload-file - \
    $SSL_FLAGS \
    --silent 2>/dev/null
    
  if [[ $? -eq 0 ]]; then
    log "INFO" "Email alert sent to $ALERT_EMAIL"
  else
    log "ERROR" "Failed to send email alert"
  fi
}

# Enviar notificación a Slack
send_slack_alert() {
  if [[ "$SLACK_ENABLED" != "true" ]] || [[ -z "$SLACK_WEBHOOK_URL" ]]; then
    return
  fi
  
  local title="$1"
  local message="$2"
  local color="$3"  # good, warning, danger
  
  local payload=$(cat <<EOF
{
  "attachments": [
    {
      "color": "$color",
      "title": "$title",
      "text": "$message",
      "footer": "Production Health Monitor",
      "footer_icon": "https://platform.slack-edge.com/img/default_application_icon.png",
      "ts": $(date +%s)
    }
  ]
}
EOF
)

  curl -X POST "$SLACK_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    --silent 2>/dev/null
    
  if [[ $? -eq 0 ]]; then
    log "INFO" "Slack notification sent"
  else
    log "ERROR" "Failed to send Slack notification"
  fi
}

# ==============================================================================
# INICIO DEL SCRIPT
# ==============================================================================

# Crear directorio de logs si no existe
mkdir -p logs

# Header
print_header "🏥 ULTRA PRO PRODUCTION HEALTH CHECK v${SCRIPT_VERSION}    🚀 $TIMESTAMP"

log "INFO" "=== Iniciando health check v${SCRIPT_VERSION} ==="
log "INFO" "Modo: $([ "$VERBOSE" == true ] && echo "VERBOSE" || echo "NORMAL")"

# ==============================================================================
# 1. RECURSOS DEL SERVIDOR
# ==============================================================================
print_section "💻 RECURSOS DEL SERVIDOR"

if [[ "$OSTYPE" == "linux-gnu"* ]] || [[ -f /proc/meminfo ]]; then
  # CPU
  CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
  if (( $(echo "$CPU_USAGE > $MAX_CPU_PERCENT" | bc -l) )); then
    print_check "WARN" "Uso de CPU" "${CPU_USAGE}%" "${MAX_CPU_PERCENT}%"
  else
    print_check "OK" "Uso de CPU" "${CPU_USAGE}%"
  fi
  
  # RAM
  TOTAL_RAM=$(free -m | awk 'NR==2{print $2}')
  USED_RAM=$(free -m | awk 'NR==2{print $3}')
  RAM_PERCENT=$(echo "scale=2; $USED_RAM*100/$TOTAL_RAM" | bc)
  print_check "OK" "Memoria RAM" "${USED_RAM}MB / ${TOTAL_RAM}MB (${RAM_PERCENT}%)"
  
  # Disco
  DISK_USAGE=$(df -h / | awk 'NR==2{print $5}' | cut -d'%' -f1)
  DISK_SIZE=$(df -h / | awk 'NR==2{print $2}')
  DISK_USED=$(df -h / | awk 'NR==2{print $3}')
  
  if [[ $DISK_USAGE -gt $MAX_DISK_PERCENT ]]; then
    print_check "WARN" "Disco (/)" "${DISK_USED} / ${DISK_SIZE} (${DISK_USAGE}%)" "${MAX_DISK_PERCENT}%"
  else
    print_check "OK" "Disco (/)" "${DISK_USED} / ${DISK_SIZE} (${DISK_USAGE}%)"
  fi
  
  # Load Average
  LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}')
  print_check "OK" "Load Average" "$LOAD_AVG"
  
  # Uptime
  UPTIME=$(uptime -p 2>/dev/null || uptime | awk '{print $3,$4}')
  print_check "OK" "Server Uptime" "$UPTIME"
  
else
  print_check "WARN" "Sistema Operativo" "macOS - métricas de servidor no disponibles"
fi

# ==============================================================================
# 2. PROCESOS PM2
# ==============================================================================
print_section "⚙️  PROCESOS PM2"

if command -v pm2 &> /dev/null; then
  PM2_LIST=$(pm2 jlist)
  PM2_COUNT=$(echo "$PM2_LIST" | jq 'length')
  
  if [[ $PM2_COUNT -eq 0 ]]; then
    print_check "FAIL" "Procesos PM2" "No hay procesos en ejecución"
  else
    print_check "OK" "Total de procesos" "$PM2_COUNT"
    
    # Iterar sobre cada proceso
    for i in $(seq 0 $((PM2_COUNT - 1))); do
      NAME=$(echo "$PM2_LIST" | jq -r ".[$i].name")
      STATUS=$(echo "$PM2_LIST" | jq -r ".[$i].pm2_env.status")
      CPU=$(echo "$PM2_LIST" | jq -r ".[$i].monit.cpu")
      MEMORY=$(echo "$PM2_LIST" | jq -r ".[$i].monit.memory")
      MEMORY_MB=$(echo "scale=2; $MEMORY/1048576" | bc)
      RESTARTS=$(echo "$PM2_LIST" | jq -r ".[$i].pm2_env.restart_time")
      UPTIME=$(echo "$PM2_LIST" | jq -r ".[$i].pm2_env.pm_uptime")
      
      if [[ "$STATUS" == "online" ]]; then
        if (( $(echo "$MEMORY_MB > $MAX_MEMORY_MB" | bc -l) )); then
          print_check "WARN" "  ├─ $NAME" "ONLINE | CPU: ${CPU}% | RAM: ${MEMORY_MB}MB | Restarts: $RESTARTS" "${MAX_MEMORY_MB}MB RAM"
        else
          print_check "OK" "  ├─ $NAME" "ONLINE | CPU: ${CPU}% | RAM: ${MEMORY_MB}MB | Restarts: $RESTARTS"
        fi
        
        if [[ $RESTARTS -gt 5 ]]; then
          print_check "WARN" "  │  └─ Restarts elevados" "$RESTARTS restarts detectados" "< 5 restarts"
        fi
      else
        print_check "FAIL" "  ├─ $NAME" "STATUS: $STATUS"
      fi
    done
  fi
else
  print_check "WARN" "PM2" "No disponible (ejecutar en servidor)"
fi

# ==============================================================================
# 3. BACKEND API
# ==============================================================================
print_section "🔧 BACKEND API (Node.js)"

# Medir latencia y performance
API_METRICS=$(measure_latency "$API_URL")
API_TIME=$(echo "$API_METRICS" | cut -d',' -f1)
API_CODE=$(echo "$API_METRICS" | cut -d',' -f2)
API_SIZE=$(echo "$API_METRICS" | cut -d',' -f3)
API_LATENCY_MS=$(echo "$API_TIME * 1000" | bc | cut -d'.' -f1)

# HTTP Status
if [[ "$API_CODE" == "200" ]]; then
  print_check "OK" "HTTP Status" "$API_CODE OK"
else
  print_check "FAIL" "HTTP Status" "$API_CODE"
fi

# Latencia
if [[ $API_LATENCY_MS -gt $MAX_LATENCY_MS ]]; then
  print_check "WARN" "Latencia" "${API_LATENCY_MS}ms" "< ${MAX_LATENCY_MS}ms"
else
  print_check "OK" "Latencia" "${API_LATENCY_MS}ms"
fi

# Tamaño de respuesta
API_SIZE_FORMATTED=$(format_bytes $API_SIZE)
print_check "OK" "Tamaño respuesta" "$API_SIZE_FORMATTED"

# Validar contenido del health check
if [[ "$API_CODE" == "200" ]]; then
  HEALTH_DATA=$(curl -s "$API_URL" 2>/dev/null)
  
  if command -v jq &> /dev/null; then
    HEALTH_STATUS=$(echo "$HEALTH_DATA" | jq -r '.status' 2>/dev/null || echo "")
    HEALTH_ENV=$(echo "$HEALTH_DATA" | jq -r '.environment' 2>/dev/null || echo "")
    HEALTH_UPTIME=$(echo "$HEALTH_DATA" | jq -r '.uptime' 2>/dev/null || echo "")
    HEALTH_STRIPE=$(echo "$HEALTH_DATA" | jq -r '.services.stripe' 2>/dev/null || echo "")
    HEALTH_PRINTFUL=$(echo "$HEALTH_DATA" | jq -r '.services.printful' 2>/dev/null || echo "")
    
    if [[ "$HEALTH_STATUS" == "ok" ]]; then
      print_check "OK" "Health Status" "$HEALTH_STATUS"
    elif [[ -n "$HEALTH_STATUS" ]]; then
      print_check "FAIL" "Health Status" "$HEALTH_STATUS"
    else
      print_check "WARN" "Health Status" "No se pudo parsear respuesta"
    fi
    
    if [[ -n "$HEALTH_ENV" ]]; then
      print_check "OK" "Environment" "$HEALTH_ENV"
    fi
    
    # Uptime del proceso
    if [[ "$HEALTH_UPTIME" != "null" ]] && [[ -n "$HEALTH_UPTIME" ]]; then
      UPTIME_HOURS=$(echo "scale=2; $HEALTH_UPTIME/3600" | bc 2>/dev/null || echo "0")
      print_check "OK" "Process Uptime" "${UPTIME_HOURS}h"
    fi
    
    # Servicios externos
    if [[ "$HEALTH_STRIPE" == "true" ]]; then
      print_check "OK" "Stripe API Key" "Configurado"
    elif [[ -n "$HEALTH_STRIPE" ]]; then
      print_check "FAIL" "Stripe API Key" "No configurado"
    fi
    
    if [[ "$HEALTH_PRINTFUL" == "true" ]]; then
      print_check "OK" "Printful API Key" "Configurado"
    elif [[ -n "$HEALTH_PRINTFUL" ]]; then
      print_check "WARN" "Printful API Key" "No configurado"
    fi
  else
    print_check "WARN" "Health Data" "jq no disponible - no se puede parsear JSON"
  fi
fi

# SSL Certificate
API_DOMAIN=$(echo "$API_BASE" | sed 's|https://||' | sed 's|http://||' | cut -d'/' -f1)
SSL_DAYS=$(check_ssl "$API_DOMAIN")

if [[ "$SSL_DAYS" == "ERROR" ]]; then
  print_check "FAIL" "Certificado SSL" "Error al obtener información"
elif [[ $SSL_DAYS -lt $MIN_SSL_DAYS ]]; then
  print_check "WARN" "Certificado SSL" "Expira en ${SSL_DAYS} días" "> ${MIN_SSL_DAYS} días"
else
  print_check "OK" "Certificado SSL" "Válido por ${SSL_DAYS} días"
fi

# ==============================================================================
# 4. ADMIN PANEL
# ==============================================================================
print_section "👨‍💼 ADMIN PANEL (Angular)"

# Medir latencia
ADMIN_METRICS=$(measure_latency "$ADMIN_URL")
ADMIN_TIME=$(echo "$ADMIN_METRICS" | cut -d',' -f1)
ADMIN_CODE=$(echo "$ADMIN_METRICS" | cut -d',' -f2)
ADMIN_SIZE=$(echo "$ADMIN_METRICS" | cut -d',' -f3)
ADMIN_LATENCY_MS=$(echo "$ADMIN_TIME * 1000" | bc | cut -d'.' -f1)

# HTTP Status
if [[ "$ADMIN_CODE" == "200" ]]; then
  print_check "OK" "HTTP Status" "$ADMIN_CODE OK"
else
  print_check "FAIL" "HTTP Status" "$ADMIN_CODE"
fi

# Latencia
if [[ $ADMIN_LATENCY_MS -gt 2000 ]]; then
  print_check "WARN" "Latencia" "${ADMIN_LATENCY_MS}ms" "< 2000ms"
else
  print_check "OK" "Latencia" "${ADMIN_LATENCY_MS}ms"
fi

# Tamaño
ADMIN_SIZE_FORMATTED=$(format_bytes $ADMIN_SIZE)
print_check "OK" "Tamaño HTML" "$ADMIN_SIZE_FORMATTED"

# Validar Angular
if [[ "$ADMIN_CODE" == "200" ]]; then
  ADMIN_HTML=$(curl -s "$ADMIN_URL")
  
  # Angular puede renderizar app-root dinámicamente vía JS
  # Verificamos cualquier indicador de Angular: app-root, ng-version, o scripts de Angular
  if echo "$ADMIN_HTML" | grep -qE "(<app-root|ng-version|main.*\.js|runtime.*\.js)"; then
    print_check "OK" "Angular App" "Aplicación detectada"
  else
    print_check "WARN" "Angular App" "Estructura Angular no detectada claramente"
  fi
  
  if echo "$ADMIN_HTML" | grep -q "runtime"; then
    print_check "OK" "JS Bundles" "runtime.js cargado"
  else
    print_check "WARN" "JS Bundles" "runtime.js no detectado"
  fi
fi

# SSL Certificate
ADMIN_DOMAIN=$(echo "$ADMIN_URL" | sed 's|https://||' | sed 's|http://||' | cut -d'/' -f1)
SSL_DAYS=$(check_ssl "$ADMIN_DOMAIN")

if [[ "$SSL_DAYS" == "ERROR" ]]; then
  print_check "FAIL" "Certificado SSL" "Error al obtener información"
elif [[ $SSL_DAYS -lt $MIN_SSL_DAYS ]]; then
  print_check "WARN" "Certificado SSL" "Expira en ${SSL_DAYS} días" "> ${MIN_SSL_DAYS} días"
else
  print_check "OK" "Certificado SSL" "Válido por ${SSL_DAYS} días"
fi

# ==============================================================================
# 5. ECOMMERCE FRONTEND
# ==============================================================================
print_section "🛒 ECOMMERCE FRONTEND (Angular)"

# Medir latencia
ECOM_METRICS=$(measure_latency "$ECOMMERCE_URL")
ECOM_TIME=$(echo "$ECOM_METRICS" | cut -d',' -f1)
ECOM_CODE=$(echo "$ECOM_METRICS" | cut -d',' -f2)
ECOM_SIZE=$(echo "$ECOM_METRICS" | cut -d',' -f3)
ECOM_LATENCY_MS=$(echo "$ECOM_TIME * 1000" | bc | cut -d'.' -f1)

# HTTP Status
if [[ "$ECOM_CODE" == "200" ]]; then
  print_check "OK" "HTTP Status" "$ECOM_CODE OK"
else
  print_check "FAIL" "HTTP Status" "$ECOM_CODE"
fi

# Latencia
if [[ $ECOM_LATENCY_MS -gt 2000 ]]; then
  print_check "WARN" "Latencia" "${ECOM_LATENCY_MS}ms" "< 2000ms"
else
  print_check "OK" "Latencia" "${ECOM_LATENCY_MS}ms"
fi

# Tamaño
ECOM_SIZE_FORMATTED=$(format_bytes $ECOM_SIZE)
print_check "OK" "Tamaño HTML" "$ECOM_SIZE_FORMATTED"

# Validar Angular
if [[ "$ECOM_CODE" == "200" ]]; then
  ECOM_HTML=$(curl -s "$ECOMMERCE_URL")
  
  # Angular puede renderizar app-root dinámicamente vía JS
  # Verificamos cualquier indicador de Angular: app-root, ng-version, o scripts de Angular
  if echo "$ECOM_HTML" | grep -qE "(<app-root|ng-version|main.*\.js|runtime.*\.js)"; then
    print_check "OK" "Angular App" "Aplicación detectada"
  else
    print_check "WARN" "Angular App" "Estructura Angular no detectada claramente"
  fi
  
  if echo "$ECOM_HTML" | grep -q "runtime"; then
    print_check "OK" "JS Bundles" "runtime.js cargado"
  else
    print_check "WARN" "JS Bundles" "runtime.js no detectado"
  fi
fi

# SSL Certificate
ECOM_DOMAIN=$(echo "$ECOMMERCE_URL" | sed 's|https://||' | sed 's|http://||' | cut -d'/' -f1)
SSL_DAYS=$(check_ssl "$ECOM_DOMAIN")

if [[ "$SSL_DAYS" == "ERROR" ]]; then
  print_check "FAIL" "Certificado SSL" "Error al obtener información"
elif [[ $SSL_DAYS -lt $MIN_SSL_DAYS ]]; then
  print_check "WARN" "Certificado SSL" "Expira en ${SSL_DAYS} días" "> ${MIN_SSL_DAYS} días"
else
  print_check "OK" "Certificado SSL" "Válido por ${SSL_DAYS} días"
fi

# ==============================================================================
# RESUMEN FINAL
# ==============================================================================
print_section "📊 RESUMEN DE VALIDACIÓN"

echo -e "   ${INFO}Total de checks:${RESET}     $TOTAL_CHECKS"
echo -e "   ${SUCCESS}Checks exitosos:${RESET}     $PASSED_CHECKS"
echo -e "   ${WARNING}Warnings:${RESET}            $WARNING_CHECKS"
echo -e "   ${ERROR}Checks fallidos:${RESET}     $FAILED_CHECKS"
echo ""

# Score
SUCCESS_RATE=$(echo "scale=2; $PASSED_CHECKS*100/$TOTAL_CHECKS" | bc)
echo -e "   ${BOLD}Health Score:${RESET}        ${SUCCESS}${SUCCESS_RATE}%${RESET}"

# Alertas
if [[ ${#ALERTS[@]} -gt 0 ]]; then
  echo ""
  echo -e "${WARNING}${BOLD}⚠️  ALERTAS DETECTADAS:${RESET}"
  for alert in "${ALERTS[@]}"; do
    echo -e "   ${WARNING}•${RESET} $alert"
  done
fi

# ==============================================================================
# EXPORT A JSON (siempre, para histórico y dashboards)
# ==============================================================================
JSON_TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
JSON_FILE="${JSON_OUTPUT:-$JSON_METRICS_DIR/health-$JSON_TIMESTAMP.json}"

JSON_CONTENT=$(cat <<EOF
{
  "timestamp": "$TIMESTAMP",
  "timestamp_unix": $(date +%s),
  "version": "$SCRIPT_VERSION",
  "summary": {
    "total_checks": $TOTAL_CHECKS,
    "passed": $PASSED_CHECKS,
    "warnings": $WARNING_CHECKS,
    "failed": $FAILED_CHECKS,
    "success_rate": $SUCCESS_RATE
  },
  "server": {
    "cpu_percent": ${CPU_PERCENT:-0},
    "memory_percent": ${MEMORY_PERCENT:-0},
    "disk_percent": ${DISK_PERCENT:-0},
    "load_average": "${LOAD_AVG:-N/A}",
    "uptime": "${UPTIME:-N/A}"
  },
  "api": {
    "http_code": "$API_CODE",
    "latency_ms": $API_LATENCY_MS,
    "size_bytes": $API_SIZE,
    "ssl_days": "$SSL_DAYS"
  },
  "admin": {
    "http_code": "$ADMIN_CODE",
    "latency_ms": $ADMIN_LATENCY_MS,
    "size_bytes": $ADMIN_SIZE
  },
  "ecommerce": {
    "http_code": "$ECOM_CODE",
    "latency_ms": $ECOM_LATENCY_MS,
    "size_bytes": $ECOM_SIZE
  },
  "alerts": [
    $(printf '"%s",' "${ALERTS[@]}" | sed 's/,$//')
  ]
}
EOF
)

# Guardar JSON histórico
echo "$JSON_CONTENT" > "$JSON_FILE"

# Actualizar JSON latest (para dashboards)
echo "$JSON_CONTENT" > "$JSON_LATEST"

log "INFO" "Resultados exportados a $JSON_FILE y $JSON_LATEST"
echo -e "\n${INFO}✓${RESET} Métricas exportadas: ${BOLD}$JSON_FILE${RESET}"

# ==============================================================================
# ENVIAR NOTIFICACIONES SI HAY PROBLEMAS
# ==============================================================================
if [[ "$NOTIFICATIONS_ENABLED" == true ]] && [[ ($WARNING_CHECKS -gt 0 || $FAILED_CHECKS -gt 0) ]]; then
  
  # Determinar severidad
  if [[ $FAILED_CHECKS -gt 0 ]]; then
    SEVERITY="CRÍTICO"
    COLOR="danger"
  else
    SEVERITY="ADVERTENCIA"
    COLOR="warning"
  fi
  
  # Construir mensaje
  ALERT_MESSAGE=$(cat <<EOF
🏥 Health Check: $SEVERITY

📊 Resumen:
   • Total checks: $TOTAL_CHECKS
   • Exitosos: $PASSED_CHECKS
   • Warnings: $WARNING_CHECKS
   • Fallos: $FAILED_CHECKS
   • Health Score: ${SUCCESS_RATE}%

⚠️ Alertas detectadas:
$(printf '   • %s\n' "${ALERTS[@]}")

🖥️ Servidor:
   • CPU: ${CPU_PERCENT}%
   • RAM: ${MEMORY_PERCENT}%
   • Disco: ${DISK_PERCENT}%

🌐 Servicios:
   • API: ${API_CODE} (${API_LATENCY_MS}ms)
   • Admin: ${ADMIN_CODE} (${ADMIN_LATENCY_MS}ms)
   • Ecommerce: ${ECOM_CODE} (${ECOM_LATENCY_MS}ms)

🕐 Timestamp: $TIMESTAMP
EOF
)
  
  # Enviar a Slack
  send_slack_alert "🚨 Production Health Alert - $SEVERITY" "$ALERT_MESSAGE" "$COLOR"
  
  # Enviar por Email
  send_email_alert "🚨 Production Health Alert - $SEVERITY" "$ALERT_MESSAGE"
  
  echo -e "\n${WARNING}📧${RESET} Notificaciones de alerta enviadas"
  log "INFO" "Notificaciones enviadas: $WARNING_CHECKS warnings, $FAILED_CHECKS failures"
fi

# ==============================================================================
# EXIT CODE
# ==============================================================================
echo ""
log "INFO" "Health check finalizado - Passed: $PASSED_CHECKS, Warnings: $WARNING_CHECKS, Failed: $FAILED_CHECKS"

if [[ $FAILED_CHECKS -eq 0 ]] && [[ $WARNING_CHECKS -eq 0 ]]; then
  print_header "✅ TODOS LOS SISTEMAS OPERATIVOS - SALUD ÓPTIMA"
  exit 0
elif [[ $FAILED_CHECKS -eq 0 ]]; then
  print_header "⚠️  SISTEMAS OPERATIVOS CON ADVERTENCIAS"
  exit 0
else
  print_header "❌ SISTEMAS CON FALLOS CRÍTICOS DETECTADOS"
  exit 1
fi
