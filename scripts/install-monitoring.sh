#!/bin/bash

# ==============================================================================
# 🚀 INSTALADOR AUTOMÁTICO DE MONITOREO DE PRODUCCIÓN
# ==============================================================================
# Este script configura automáticamente:
# - Cron jobs para ejecución periódica
# - Rotación de logs
# - Estructura de directorios
# - Permisos correctos
# - Validación de dependencias
# ==============================================================================

set -e  # Exit on error

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🚀 Instalador de Monitoreo de Producción Enterprise         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ==============================================================================
# 1. VALIDAR DEPENDENCIAS
# ==============================================================================
echo -e "${YELLOW}📦 Validando dependencias...${NC}"

MISSING_DEPS=()

command -v curl >/dev/null 2>&1 || MISSING_DEPS+=("curl")
command -v jq >/dev/null 2>&1 || MISSING_DEPS+=("jq")
command -v bc >/dev/null 2>&1 || MISSING_DEPS+=("bc")
command -v openssl >/dev/null 2>&1 || MISSING_DEPS+=("openssl")

if [ ${#MISSING_DEPS[@]} -ne 0 ]; then
  echo -e "${RED}❌ Dependencias faltantes: ${MISSING_DEPS[*]}${NC}"
  echo ""
  echo "Instalar en Ubuntu/Debian:"
  echo "  sudo apt-get update && sudo apt-get install -y ${MISSING_DEPS[*]}"
  echo ""
  echo "Instalar en macOS:"
  echo "  brew install ${MISSING_DEPS[*]}"
  exit 1
fi

echo -e "${GREEN}✓ Todas las dependencias instaladas${NC}"
echo ""

# ==============================================================================
# 2. OBTENER RUTA DEL PROYECTO
# ==============================================================================
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${YELLOW}📁 Directorio del proyecto: ${PROJECT_ROOT}${NC}"
echo ""

# ==============================================================================
# 3. CREAR ESTRUCTURA DE DIRECTORIOS
# ==============================================================================
echo -e "${YELLOW}📂 Creando estructura de directorios...${NC}"

mkdir -p "$PROJECT_ROOT/logs"
mkdir -p "$PROJECT_ROOT/metrics"
mkdir -p "$PROJECT_ROOT/scripts"

echo -e "${GREEN}✓ Directorios creados${NC}"
echo ""

# ==============================================================================
# 4. CONFIGURAR LOGROTATE
# ==============================================================================
echo -e "${YELLOW}🔄 Configurando rotación de logs...${NC}"

LOGROTATE_CONF="$PROJECT_ROOT/scripts/logrotate.conf"

cat > "$LOGROTATE_CONF" <<'EOF'
# Configuración de rotación de logs para Health Check
$PROJECT_ROOT/logs/health-check-*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 $USER $USER
    dateext
    dateformat -%Y%m%d
    maxsize 100M
}
EOF

# Reemplazar variables
sed -i.bak "s|\$PROJECT_ROOT|$PROJECT_ROOT|g" "$LOGROTATE_CONF"
sed -i.bak "s|\$USER|$(whoami)|g" "$LOGROTATE_CONF"
rm -f "$LOGROTATE_CONF.bak"

echo -e "${GREEN}✓ Logrotate configurado: $LOGROTATE_CONF${NC}"
echo ""

# ==============================================================================
# 5. CONFIGURAR CRON JOB
# ==============================================================================
echo -e "${YELLOW}⏰ Configurando cron job...${NC}"
echo ""

# Preguntar intervalo
echo "Selecciona el intervalo de ejecución:"
echo "  1) Cada hora (recomendado para producción)"
echo "  2) Cada 30 minutos"
echo "  3) Cada 15 minutos"
echo "  4) Cada 6 horas"
echo "  5) Una vez al día (medianoche)"
echo ""
read -p "Opción [1-5]: " INTERVAL_OPTION

case $INTERVAL_OPTION in
  1)
    CRON_SCHEDULE="0 * * * *"
    INTERVAL_DESC="cada hora"
    ;;
  2)
    CRON_SCHEDULE="*/30 * * * *"
    INTERVAL_DESC="cada 30 minutos"
    ;;
  3)
    CRON_SCHEDULE="*/15 * * * *"
    INTERVAL_DESC="cada 15 minutos"
    ;;
  4)
    CRON_SCHEDULE="0 */6 * * *"
    INTERVAL_DESC="cada 6 horas"
    ;;
  5)
    CRON_SCHEDULE="0 0 * * *"
    INTERVAL_DESC="diariamente a medianoche"
    ;;
  *)
    CRON_SCHEDULE="0 * * * *"
    INTERVAL_DESC="cada hora"
    ;;
esac

echo ""
echo -e "${BLUE}Cron programado: $INTERVAL_DESC${NC}"
echo ""

# Preguntar si activar notificaciones
read -p "¿Activar notificaciones automáticas? (y/N): " ENABLE_NOTIFICATIONS
NOTIFY_FLAG=""
if [[ "$ENABLE_NOTIFICATIONS" =~ ^[Yy]$ ]]; then
  NOTIFY_FLAG="--notify"
  echo -e "${YELLOW}Recuerda configurar .env.monitoring con tus credenciales${NC}"
fi

# Crear entrada de cron
HEALTH_SCRIPT="$PROJECT_ROOT/scripts/checkProductionHealth.sh"
CRON_COMMAND="cd $PROJECT_ROOT && bash $HEALTH_SCRIPT $NOTIFY_FLAG >> $PROJECT_ROOT/logs/cron.log 2>&1"

# Verificar si ya existe una entrada similar
EXISTING_CRON=$(crontab -l 2>/dev/null | grep -F "checkProductionHealth.sh" || true)

if [ -n "$EXISTING_CRON" ]; then
  echo -e "${YELLOW}⚠️  Ya existe una entrada de cron para health check:${NC}"
  echo "$EXISTING_CRON"
  echo ""
  read -p "¿Reemplazar? (y/N): " REPLACE_CRON
  
  if [[ "$REPLACE_CRON" =~ ^[Yy]$ ]]; then
    # Eliminar entrada antigua
    crontab -l 2>/dev/null | grep -v "checkProductionHealth.sh" | crontab -
    echo -e "${GREEN}✓ Entrada antigua eliminada${NC}"
  else
    echo -e "${YELLOW}⚠️  Instalación cancelada${NC}"
    exit 0
  fi
fi

# Añadir nueva entrada
(crontab -l 2>/dev/null; echo "$CRON_SCHEDULE $CRON_COMMAND") | crontab -

echo -e "${GREEN}✓ Cron job instalado correctamente${NC}"
echo ""

# ==============================================================================
# 6. PERMISOS
# ==============================================================================
echo -e "${YELLOW}🔒 Configurando permisos...${NC}"

chmod +x "$HEALTH_SCRIPT"
chmod 644 "$LOGROTATE_CONF"

echo -e "${GREEN}✓ Permisos configurados${NC}"
echo ""

# ==============================================================================
# 7. VALIDAR CONFIGURACIÓN
# ==============================================================================
echo -e "${YELLOW}✅ Validando configuración...${NC}"
echo ""

# Mostrar cron instalado
echo "Cron job instalado:"
crontab -l | grep "checkProductionHealth.sh"
echo ""

# Test del script
echo -e "${BLUE}Ejecutando test del script...${NC}"
bash "$HEALTH_SCRIPT" --verbose

# ==============================================================================
# RESUMEN
# ==============================================================================
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Instalación completada exitosamente                       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📊 Resumen de configuración:${NC}"
echo ""
echo "  📁 Logs:            $PROJECT_ROOT/logs/"
echo "  📈 Métricas JSON:   $PROJECT_ROOT/metrics/"
echo "  ⏰ Programación:    $INTERVAL_DESC"
echo "  📧 Notificaciones:  ${ENABLE_NOTIFICATIONS:-desactivadas}"
echo ""
echo -e "${BLUE}📝 Próximos pasos:${NC}"
echo ""
echo "  1. Configurar notificaciones:"
echo "     cp $PROJECT_ROOT/.env.monitoring.example $PROJECT_ROOT/.env.monitoring"
echo "     nano $PROJECT_ROOT/.env.monitoring"
echo ""
echo "  2. Ver logs en tiempo real:"
echo "     tail -f $PROJECT_ROOT/logs/cron.log"
echo ""
echo "  3. Ver métricas exportadas:"
echo "     cat $PROJECT_ROOT/metrics/latest.json | jq"
echo ""
echo "  4. Ejecutar manualmente:"
echo "     cd $PROJECT_ROOT && bash $HEALTH_SCRIPT --verbose --notify"
echo ""
echo "  5. Ver cron jobs instalados:"
echo "     crontab -l"
echo ""
echo -e "${GREEN}🚀 Sistema de monitoreo enterprise listo para producción${NC}"
echo ""
