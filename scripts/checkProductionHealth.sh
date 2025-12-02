#!/bin/bash

# ==============================================================================
# 🏥 SCRIPT DE VALIDACIÓN DE SALUD - PRODUCCIÓN
# ==============================================================================
# Valida que los 3 entornos de la plataforma estén operativos:
# - API Backend (Node.js + PM2)
# - Admin Panel (Angular)
# - Ecommerce Frontend (Angular)
#
# Uso:
#   bash scripts/checkProductionHealth.sh
#   bash scripts/checkProductionHealth.sh --verbose
# ==============================================================================

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

VERBOSE=false
if [[ "$1" == "--verbose" ]]; then
  VERBOSE=true
fi

# URLs de producción
API_URL="https://api.lujandev.com/api/health"
ADMIN_URL="https://admin.lujandev.com"
ECOMMERCE_URL="https://tienda.lujandev.com"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         🏥 VALIDACIÓN DE SALUD - PRODUCCIÓN                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ==============================================================================
# 1. CHECK BACKEND API
# ==============================================================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔧 1. BACKEND API (Node.js + PM2)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check PM2 status (solo si estamos en el servidor)
if command -v pm2 &> /dev/null; then
  echo -e "📊 Estado de PM2:"
  PM2_STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="api_sequelize") | .pm2_env.status')
  PM2_CPU=$(pm2 jlist | jq -r '.[] | select(.name=="api_sequelize") | .monit.cpu')
  PM2_MEMORY=$(pm2 jlist | jq -r '.[] | select(.name=="api_sequelize") | .monit.memory')
  PM2_UPTIME=$(pm2 jlist | jq -r '.[] | select(.name=="api_sequelize") | .pm2_env.pm_uptime')
  
  if [[ "$PM2_STATUS" == "online" ]]; then
    echo -e "   ✅ Estado: ${GREEN}ONLINE${NC}"
    echo -e "   🧠 CPU: ${PM2_CPU}%"
    echo -e "   💾 Memoria: $(echo "scale=2; $PM2_MEMORY/1048576" | bc) MB"
    
    if [[ "$VERBOSE" == true ]]; then
      UPTIME_SECONDS=$(( ($(date +%s) - PM2_UPTIME/1000) ))
      UPTIME_DAYS=$(( UPTIME_SECONDS / 86400 ))
      echo -e "   ⏰ Uptime: ${UPTIME_DAYS} días"
    fi
  else
    echo -e "   ❌ Estado: ${RED}$PM2_STATUS${NC}"
  fi
else
  echo -e "   ⚠️  PM2 no disponible (ejecutar en servidor)"
fi

echo ""
echo -e "🌐 Comprobando endpoint /health..."
API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL" --connect-timeout 10)

if [[ "$API_RESPONSE" == "200" ]]; then
  echo -e "   ✅ Respuesta: ${GREEN}200 OK${NC}"
  
  if [[ "$VERBOSE" == true ]]; then
    HEALTH_DATA=$(curl -s "$API_URL")
    echo -e "   📋 Detalles:"
    echo "$HEALTH_DATA" | jq '.'
  else
    HEALTH_STATUS=$(curl -s "$API_URL" | jq -r '.status')
    HEALTH_ENV=$(curl -s "$API_URL" | jq -r '.environment')
    echo -e "   📊 Status: $HEALTH_STATUS"
    echo -e "   🌍 Environment: $HEALTH_ENV"
  fi
else
  echo -e "   ❌ Error: ${RED}HTTP $API_RESPONSE${NC}"
fi

# ==============================================================================
# 2. CHECK ADMIN PANEL
# ==============================================================================
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}👨‍💼 2. ADMIN PANEL (Angular)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

ADMIN_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$ADMIN_URL" --connect-timeout 10)

if [[ "$ADMIN_RESPONSE" == "200" ]]; then
  echo -e "   ✅ Respuesta: ${GREEN}200 OK${NC}"
  
  if [[ "$VERBOSE" == true ]]; then
    ADMIN_HTML=$(curl -s "$ADMIN_URL")
    if echo "$ADMIN_HTML" | grep -q "<app-root"; then
      echo -e "   ✅ Tag <app-root> encontrado"
    fi
    if echo "$ADMIN_HTML" | grep -q "runtime"; then
      echo -e "   ✅ Bundles de Angular cargados"
    fi
  fi
else
  echo -e "   ❌ Error: ${RED}HTTP $ADMIN_RESPONSE${NC}"
fi

# ==============================================================================
# 3. CHECK ECOMMERCE FRONTEND
# ==============================================================================
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🛒 3. ECOMMERCE FRONTEND (Angular)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

ECOMMERCE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$ECOMMERCE_URL" --connect-timeout 10)

if [[ "$ECOMMERCE_RESPONSE" == "200" ]]; then
  echo -e "   ✅ Respuesta: ${GREEN}200 OK${NC}"
  
  if [[ "$VERBOSE" == true ]]; then
    ECOMMERCE_HTML=$(curl -s "$ECOMMERCE_URL")
    if echo "$ECOMMERCE_HTML" | grep -q "<app-root"; then
      echo -e "   ✅ Tag <app-root> encontrado"
    fi
    if echo "$ECOMMERCE_HTML" | grep -q "runtime"; then
      echo -e "   ✅ Bundles de Angular cargados"
    fi
  fi
else
  echo -e "   ❌ Error: ${RED}HTTP $ECOMMERCE_RESPONSE${NC}"
fi

# ==============================================================================
# RESUMEN FINAL
# ==============================================================================
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 RESUMEN${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

ALL_OK=true

if [[ "$API_RESPONSE" == "200" ]]; then
  echo -e "   API Backend:   ${GREEN}✅ OPERATIVO${NC}"
else
  echo -e "   API Backend:   ${RED}❌ CAÍDO${NC}"
  ALL_OK=false
fi

if [[ "$ADMIN_RESPONSE" == "200" ]]; then
  echo -e "   Admin Panel:   ${GREEN}✅ OPERATIVO${NC}"
else
  echo -e "   Admin Panel:   ${RED}❌ CAÍDO${NC}"
  ALL_OK=false
fi

if [[ "$ECOMMERCE_RESPONSE" == "200" ]]; then
  echo -e "   Ecommerce:     ${GREEN}✅ OPERATIVO${NC}"
else
  echo -e "   Ecommerce:     ${RED}❌ CAÍDO${NC}"
  ALL_OK=false
fi

echo ""
if [[ "$ALL_OK" == true ]]; then
  echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  ✅ TODOS LOS SERVICIOS OPERATIVOS                             ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
  exit 0
else
  echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║  ⚠️  ALGUNOS SERVICIOS NO ESTÁN OPERATIVOS                     ║${NC}"
  echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
  exit 1
fi
