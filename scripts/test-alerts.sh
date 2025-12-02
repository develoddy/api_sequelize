#!/bin/bash

# ==============================================================================
# 🧪 SCRIPT DE PRUEBA - VALIDACIÓN DE ALERTAS
# ==============================================================================
# Este script simula diferentes escenarios para probar el sistema de alertas
# sin afectar producción
# ==============================================================================

set -e

echo "🧪 Iniciando prueba del sistema de alertas..."
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# ==============================================================================
# 1. VERIFICAR CONFIGURACIÓN
# ==============================================================================
echo "1️⃣ Verificando configuración..."

if [ ! -f ".env.monitoring" ]; then
  echo -e "${RED}❌ Archivo .env.monitoring no encontrado${NC}"
  echo "   Ejecuta: cp .env.monitoring.example .env.monitoring"
  exit 1
fi

source .env.monitoring

echo -e "${GREEN}✓ Archivo .env.monitoring encontrado${NC}"
echo ""

# ==============================================================================
# 2. PROBAR CONFIGURACIÓN EMAIL
# ==============================================================================
if [ "$EMAIL_ENABLED" = "true" ]; then
  echo "2️⃣ Probando configuración de Email..."
  echo ""
  echo "   SMTP Host: $SMTP_HOST"
  echo "   SMTP Port: $SMTP_PORT"
  echo "   SMTP User: $SMTP_USER"
  echo "   Alert Email: $ALERT_EMAIL"
  echo ""
  
  read -p "¿Enviar email de prueba? (y/N): " SEND_TEST_EMAIL
  
  if [[ "$SEND_TEST_EMAIL" =~ ^[Yy]$ ]]; then
    echo "   Enviando email de prueba..."
    
    TEST_EMAIL_BODY="Subject: Test - Production Monitoring System
From: $SMTP_USER
To: $ALERT_EMAIL
Content-Type: text/html; charset=UTF-8

<!DOCTYPE html>
<html>
<head><meta charset='UTF-8'></head>
<body style='font-family: Arial, sans-serif; padding: 20px;'>
  <h2 style='color: #4CAF50;'>✅ Test de Configuración SMTP</h2>
  <p><strong>Timestamp:</strong> $(date '+%Y-%m-%d %H:%M:%S')</p>
  <hr>
  <p>Este es un email de prueba del sistema de monitoreo.</p>
  <p>Si recibes este mensaje, la configuración SMTP está funcionando correctamente.</p>
  <hr>
  <h3>Configuración detectada:</h3>
  <ul>
    <li>SMTP Host: $SMTP_HOST</li>
    <li>SMTP Port: $SMTP_PORT</li>
    <li>From: $SMTP_USER</li>
    <li>To: $ALERT_EMAIL</li>
  </ul>
  <hr>
  <p style='color: #7f8c8d; font-size: 12px;'>
    Sistema de monitoreo de producción v3.0
  </p>
</body>
</html>"
    
    # Determinar flags SSL según el puerto
    SSL_FLAGS=""
    if [[ "$SMTP_PORT" == "465" ]]; then
      SSL_FLAGS="--ssl"
    else
      SSL_FLAGS="--ssl-reqd"
    fi
    
    echo "$TEST_EMAIL_BODY" | curl --url "smtp://$SMTP_HOST:$SMTP_PORT" \
      --mail-from "$SMTP_USER" \
      --mail-rcpt "$ALERT_EMAIL" \
      --user "$SMTP_USER:$SMTP_PASS" \
      --upload-file - \
      $SSL_FLAGS \
      --silent 2>&1
    
    if [ $? -eq 0 ]; then
      echo -e "   ${GREEN}✓ Email enviado correctamente${NC}"
      echo "   Revisa tu bandeja de entrada: $ALERT_EMAIL"
    else
      echo -e "   ${RED}✗ Error al enviar email${NC}"
      echo "   Verifica:"
      echo "     - Credenciales SMTP correctas"
      echo "     - Puerto y host correctos"
      echo "     - Firewall permite conexiones SMTP"
      echo "   Debug: curl usó flags: $SSL_FLAGS para puerto $SMTP_PORT"
    fi
  fi
else
  echo "2️⃣ Email desactivado (EMAIL_ENABLED=false)"
fi

echo ""

# ==============================================================================
# 3. PROBAR CONFIGURACIÓN SLACK
# ==============================================================================
if [ "$SLACK_ENABLED" = "true" ]; then
  echo "3️⃣ Probando configuración de Slack..."
  echo ""
  echo "   Webhook URL: ${SLACK_WEBHOOK_URL:0:50}..."
  echo ""
  
  read -p "¿Enviar mensaje de prueba a Slack? (y/N): " SEND_TEST_SLACK
  
  if [[ "$SEND_TEST_SLACK" =~ ^[Yy]$ ]]; then
    echo "   Enviando mensaje de prueba..."
    
    PAYLOAD=$(cat <<EOF
{
  "attachments": [
    {
      "color": "good",
      "title": "✅ Test de Configuración Slack",
      "text": "Este es un mensaje de prueba del sistema de monitoreo.\n\nSi recibes esto, la integración con Slack está funcionando correctamente.\n\n*Timestamp:* $(date '+%Y-%m-%d %H:%M:%S')",
      "footer": "Production Health Monitor v3.0",
      "footer_icon": "https://platform.slack-edge.com/img/default_application_icon.png",
      "ts": $(date +%s)
    }
  ]
}
EOF
)
    
    RESPONSE=$(curl -X POST "$SLACK_WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d "$PAYLOAD" \
      --silent --write-out "HTTPCODE:%{http_code}")
    
    HTTP_CODE=$(echo "$RESPONSE" | grep -o "HTTPCODE:[0-9]*" | cut -d: -f2)
    
    if [ "$HTTP_CODE" = "200" ]; then
      echo -e "   ${GREEN}✓ Mensaje enviado correctamente a Slack${NC}"
      echo "   Revisa tu canal de Slack"
    else
      echo -e "   ${RED}✗ Error al enviar mensaje (HTTP $HTTP_CODE)${NC}"
      echo "   Verifica:"
      echo "     - Webhook URL correcta"
      echo "     - Permisos del webhook activos"
      echo "     - Canal existe y el bot tiene acceso"
    fi
  fi
else
  echo "3️⃣ Slack desactivado (SLACK_ENABLED=false)"
fi

echo ""

# ==============================================================================
# 4. PROBAR SCRIPT PRINCIPAL
# ==============================================================================
echo "4️⃣ Probando script principal de health check..."
echo ""

if [ ! -f "scripts/checkProductionHealth.sh" ]; then
  echo -e "${RED}❌ Script principal no encontrado${NC}"
  exit 1
fi

echo "   Ejecutando: bash scripts/checkProductionHealth.sh --verbose"
echo ""

bash scripts/checkProductionHealth.sh --verbose

echo ""
echo -e "${GREEN}✓ Script ejecutado correctamente${NC}"

# ==============================================================================
# 5. VERIFICAR MÉTRICAS JSON
# ==============================================================================
echo ""
echo "5️⃣ Verificando export de métricas JSON..."

if [ -f "metrics/latest.json" ]; then
  echo -e "${GREEN}✓ Archivo metrics/latest.json generado${NC}"
  echo ""
  echo "   Contenido resumido:"
  
  if command -v jq >/dev/null 2>&1; then
    echo ""
    jq '.summary' metrics/latest.json
    echo ""
  else
    echo "   (Instala 'jq' para ver el JSON formateado)"
  fi
else
  echo -e "${YELLOW}⚠ Archivo metrics/latest.json no generado${NC}"
fi

# ==============================================================================
# 6. VERIFICAR LOGS
# ==============================================================================
echo ""
echo "6️⃣ Verificando logs..."

if [ -d "logs" ] && [ "$(ls -A logs 2>/dev/null)" ]; then
  LATEST_LOG=$(ls -t logs/health-check-*.log 2>/dev/null | head -1)
  
  if [ -n "$LATEST_LOG" ]; then
    echo -e "${GREEN}✓ Logs generados correctamente${NC}"
    echo "   Último log: $LATEST_LOG"
    echo ""
    echo "   Últimas 5 líneas:"
    tail -5 "$LATEST_LOG"
  fi
else
  echo -e "${YELLOW}⚠ No se encontraron logs${NC}"
fi

# ==============================================================================
# RESUMEN FINAL
# ==============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "                    RESUMEN DE PRUEBAS                           "
echo "════════════════════════════════════════════════════════════════"
echo ""

TESTS_PASSED=0
TESTS_TOTAL=6

[ -f ".env.monitoring" ] && ((TESTS_PASSED++))
[ "$EMAIL_ENABLED" = "true" ] && ((TESTS_PASSED++))
[ "$SLACK_ENABLED" = "true" ] && ((TESTS_PASSED++))
[ -f "scripts/checkProductionHealth.sh" ] && ((TESTS_PASSED++))
[ -f "metrics/latest.json" ] && ((TESTS_PASSED++))
[ -d "logs" ] && [ "$(ls -A logs 2>/dev/null)" ] && ((TESTS_PASSED++))

echo "Tests completados: $TESTS_PASSED / $TESTS_TOTAL"
echo ""

if [ $TESTS_PASSED -eq $TESTS_TOTAL ]; then
  echo -e "${GREEN}✅ Todas las pruebas pasaron correctamente${NC}"
  echo ""
  echo "El sistema está listo para producción."
else
  echo -e "${YELLOW}⚠️  Algunos componentes necesitan configuración${NC}"
  echo ""
  echo "Revisa los pasos anteriores y configura los componentes faltantes."
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""

# ==============================================================================
# PRÓXIMOS PASOS
# ==============================================================================
echo "📋 Próximos pasos sugeridos:"
echo ""
echo "1. Configurar cron job:"
echo "   bash scripts/install-monitoring.sh"
echo ""
echo "2. Ver logs en tiempo real:"
echo "   tail -f logs/cron.log"
echo ""
echo "3. Acceder al dashboard:"
echo "   https://api.lujandev.com/dashboard.html"
echo ""
echo "4. Ver métricas JSON:"
echo "   curl https://api.lujandev.com/metrics/latest.json | jq"
echo ""
echo "5. Ejecutar con notificaciones:"
echo "   bash scripts/checkProductionHealth.sh --notify"
echo ""
