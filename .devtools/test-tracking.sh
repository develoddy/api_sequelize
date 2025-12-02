#!/bin/bash

# ============================================================================
# SCRIPT DE PRUEBAS DEL MÓDULO TRACKING
# ============================================================================

echo "🧪 INICIANDO PRUEBAS DEL MÓDULO TRACKING"
echo "========================================"
echo ""

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_URL="http://localhost:3500"
FRONTEND_URL="http://localhost:5000"

# ============================================================================
# PASO 1: Verificar que los servicios estén corriendo
# ============================================================================

echo -e "${BLUE}📡 PASO 1: Verificando servicios...${NC}"
echo ""

# Verificar Backend
if curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/products" | grep -q "200\|404"; then
    echo -e "${GREEN}✅ Backend está corriendo en $API_URL${NC}"
else
    echo -e "${RED}❌ Backend NO está corriendo. Inicia el servidor backend primero.${NC}"
    exit 1
fi

# Verificar Frontend
if curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" | grep -q "200"; then
    echo -e "${GREEN}✅ Frontend está corriendo en $FRONTEND_URL${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend NO está corriendo. Algunas pruebas no funcionarán.${NC}"
fi

echo ""
echo "========================================"
echo ""

# ============================================================================
# PASO 2: Probar endpoint de tracking con ID de ejemplo
# ============================================================================

echo -e "${BLUE}📦 PASO 2: Probando endpoint de tracking...${NC}"
echo ""

# Prueba 1: Orden que NO existe (debe dar 404)
echo -e "${YELLOW}Test 1: Orden inexistente (debe dar 404)${NC}"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$API_URL/api/orders/tracking/999999")
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "404" ]; then
    echo -e "${GREEN}✅ Respuesta correcta: 404 Not Found${NC}"
    echo "Body: $BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}❌ Error: Esperaba 404, obtuvo $HTTP_CODE${NC}"
fi

echo ""
echo "----------------------------------------"
echo ""

# Prueba 2: Orden con ID 1 (tu primera orden probablemente)
echo -e "${YELLOW}Test 2: Probando con Order ID = 1${NC}"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$API_URL/api/orders/tracking/1")
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d')

echo "HTTP Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Orden encontrada!${NC}"
    echo ""
    echo "Datos principales:"
    echo "$BODY" | jq '{
        orderId: .data.orderId,
        externalId: .data.externalId,
        status: .data.status,
        progress: .data.progress,
        trackingNumber: .data.trackingNumber,
        carrier: .data.carrier,
        itemsCount: (.data.items | length)
    }' 2>/dev/null
elif [ "$HTTP_CODE" = "404" ]; then
    echo -e "${YELLOW}⚠️  Orden no encontrada. Prueba con otro ID.${NC}"
else
    echo -e "${RED}❌ Error: $HTTP_CODE${NC}"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
fi

echo ""
echo "========================================"
echo ""

# ============================================================================
# PASO 3: Listar IDs de órdenes disponibles
# ============================================================================

echo -e "${BLUE}📋 PASO 3: Buscando órdenes disponibles en el sistema...${NC}"
echo ""
echo "Para obtener IDs de órdenes reales, ejecuta este query en tu BD:"
echo ""
echo -e "${YELLOW}SELECT id, printfulOrderId, syncStatus, trackingNumber, createdAt FROM sales ORDER BY createdAt DESC LIMIT 5;${NC}"
echo ""
echo "========================================"
echo ""

# ============================================================================
# PASO 4: Test de validación de inputs
# ============================================================================

echo -e "${BLUE}🔍 PASO 4: Probando validación de inputs...${NC}"
echo ""

# Input vacío
echo -e "${YELLOW}Test: Input vacío${NC}"
curl -s "$API_URL/api/orders/tracking/" | jq '.' 2>/dev/null
echo ""

# Input con caracteres especiales
echo -e "${YELLOW}Test: Caracteres especiales${NC}"
curl -s "$API_URL/api/orders/tracking/<script>" | jq '.' 2>/dev/null
echo ""

echo "========================================"
echo ""

# ============================================================================
# RESUMEN Y SIGUIENTES PASOS
# ============================================================================

echo -e "${GREEN}✨ PRUEBAS COMPLETADAS${NC}"
echo ""
echo "📝 Siguientes pasos:"
echo ""
echo "1. Abre Postman y crea una nueva request:"
echo "   - Method: GET"
echo "   - URL: $API_URL/api/orders/tracking/1"
echo "   - NO agregues headers de autenticación"
echo ""
echo "2. Abre el navegador:"
echo "   - Búsqueda: $FRONTEND_URL/es/es/tracking"
echo "   - Estado: $FRONTEND_URL/es/es/tracking/1"
echo ""
echo "3. Prueba con IDs reales de tu base de datos"
echo ""
echo "========================================"
