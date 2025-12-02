#!/bin/bash

# ==============================================================================
# 🔄 SCRIPT DE REINICIO Y VALIDACIÓN
# ==============================================================================
# Reinicia PM2 y valida que dashboard y métricas estén disponibles
# ==============================================================================

set -e

echo "🔄 Reiniciando sistema..."
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# ==============================================================================
# 1. REINICIAR PM2
# ==============================================================================
echo "1️⃣ Reiniciando PM2..."
pm2 restart api_sequelize
sleep 3
echo -e "${GREEN}✓ PM2 reiniciado${NC}"
echo ""

# ==============================================================================
# 2. GENERAR MÉTRICAS INICIALES
# ==============================================================================
echo "2️⃣ Generando métricas iniciales..."
bash scripts/checkProductionHealth.sh > /dev/null 2>&1
echo -e "${GREEN}✓ Métricas generadas${NC}"
echo ""

# ==============================================================================
# 3. VERIFICAR ENDPOINTS
# ==============================================================================
echo "3️⃣ Verificando endpoints..."
echo ""

# Health endpoint
echo -n "   Probando /api/health... "
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3500/api/health)
if [ "$HEALTH_CODE" = "200" ]; then
  echo -e "${GREEN}✓ OK${NC}"
else
  echo -e "${RED}✗ Error (HTTP $HEALTH_CODE)${NC}"
fi

# Dashboard
echo -n "   Probando /dashboard.html... "
DASHBOARD_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3500/dashboard.html)
if [ "$DASHBOARD_CODE" = "200" ]; then
  echo -e "${GREEN}✓ OK${NC}"
else
  echo -e "${RED}✗ Error (HTTP $DASHBOARD_CODE)${NC}"
fi

# Metrics JSON
echo -n "   Probando /metrics/latest.json... "
METRICS_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3500/metrics/latest.json)
if [ "$METRICS_CODE" = "200" ]; then
  echo -e "${GREEN}✓ OK${NC}"
else
  echo -e "${RED}✗ Error (HTTP $METRICS_CODE)${NC}"
fi

echo ""

# ==============================================================================
# 4. MOSTRAR URLs DE ACCESO
# ==============================================================================
echo "════════════════════════════════════════════════════════════════"
echo -e "${BLUE}📊 URLs de Acceso:${NC}"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "  🏥 Health Check:"
echo "     Local:      http://localhost:3500/api/health"
echo "     Producción: https://api.lujandev.com/api/health"
echo ""
echo "  📊 Dashboard:"
echo "     Local:      http://localhost:3500/dashboard.html"
echo "     Producción: https://api.lujandev.com/dashboard.html"
echo ""
echo "  📈 Métricas JSON:"
echo "     Local:      http://localhost:3500/metrics/latest.json"
echo "     Producción: https://api.lujandev.com/metrics/latest.json"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""

# ==============================================================================
# 5. PROBAR DESDE PRODUCCIÓN (si estamos en servidor)
# ==============================================================================
if [[ -f "/etc/nginx/nginx.conf" ]] || [[ -f "/etc/apache2/apache2.conf" ]]; then
  echo "5️⃣ Probando desde URLs de producción..."
  echo ""
  
  echo -n "   https://api.lujandev.com/api/health... "
  PROD_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://api.lujandev.com/api/health 2>/dev/null || echo "000")
  if [ "$PROD_HEALTH" = "200" ]; then
    echo -e "${GREEN}✓ OK${NC}"
  else
    echo -e "${YELLOW}⚠ HTTP $PROD_HEALTH${NC}"
  fi
  
  echo -n "   https://api.lujandev.com/dashboard.html... "
  PROD_DASH=$(curl -s -o /dev/null -w "%{http_code}" https://api.lujandev.com/dashboard.html 2>/dev/null || echo "000")
  if [ "$PROD_DASH" = "200" ]; then
    echo -e "${GREEN}✓ OK${NC}"
  else
    echo -e "${YELLOW}⚠ HTTP $PROD_DASH${NC}"
  fi
  
  echo ""
fi

# ==============================================================================
# 6. ESTADO DE PM2
# ==============================================================================
echo "6️⃣ Estado de PM2:"
echo ""
pm2 list
echo ""

# ==============================================================================
# RESUMEN
# ==============================================================================
echo "════════════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ Sistema reiniciado y validado${NC}"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Próximos pasos:"
echo ""
echo "1. Abrir dashboard en navegador:"
echo "   → http://localhost:3500/dashboard.html"
echo ""
echo "2. Probar alertas por email:"
echo "   bash scripts/test-alerts.sh"
echo ""
echo "3. Ver logs de PM2:"
echo "   pm2 logs api_sequelize"
echo ""
echo "4. Ejecutar health check con notificaciones:"
echo "   bash scripts/checkProductionHealth.sh --notify --verbose"
echo ""
