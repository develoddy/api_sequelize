#!/bin/bash

# 🧪 SMART CHAT SAAS - TEST DE ENDPOINTS
# Script para probar todos los endpoints REST multi-tenant

set -e

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="http://localhost:3500"
TENANT_ID="1"

echo "================================================"
echo "🧪 SMART CHAT SAAS - TEST DE ENDPOINTS"
echo "================================================"
echo ""
echo "Base URL: $BASE_URL"
echo "Tenant ID: $TENANT_ID"
echo ""

# Función para probar endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local data=$4
    
    echo -e "${BLUE}[TEST]${NC} $description"
    echo "   $method $endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -H "X-Tenant-Id: $TENANT_ID" "$BASE_URL$endpoint")
    elif [ "$method" = "PUT" ]; then
        response=$(curl -s -w "\n%{http_code}" -X PUT -H "X-Tenant-Id: $TENANT_ID" -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST -H "X-Tenant-Id: $TENANT_ID" -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "   ${GREEN}✅ OK (HTTP $http_code)${NC}"
        
        # Mostrar primeras líneas del response
        echo "$body" | jq '.' 2>/dev/null | head -n 10 || echo "$body" | head -c 200
        
        if [ ${#body} -gt 200 ]; then
            echo "   ..."
        fi
    else
        echo -e "   ${RED}❌ FAIL (HTTP $http_code)${NC}"
        echo "   Response: $body"
        return 1
    fi
    
    echo ""
    return 0
}

# Contador de tests
total=0
passed=0
failed=0

# ================================================
# TEST 1: GET Tenant Config
# ================================================
total=$((total + 1))
if test_endpoint "GET" "/api/chat/tenant/config" "Obtener configuración del tenant"; then
    passed=$((passed + 1))
else
    failed=$((failed + 1))
fi

# ================================================
# TEST 2: GET Tenant Stats
# ================================================
total=$((total + 1))
if test_endpoint "GET" "/api/chat/tenant/stats" "Obtener estadísticas del tenant"; then
    passed=$((passed + 1))
else
    failed=$((failed + 1))
fi

# ================================================
# TEST 3: GET Tenant Conversations
# ================================================
total=$((total + 1))
if test_endpoint "GET" "/api/chat/tenant/conversations" "Listar conversaciones del tenant"; then
    passed=$((passed + 1))
else
    failed=$((failed + 1))
fi

# ================================================
# TEST 4: GET Tenant Conversations with Pagination
# ================================================
total=$((total + 1))
if test_endpoint "GET" "/api/chat/tenant/conversations?page=1&limit=10" "Listar conversaciones con paginación"; then
    passed=$((passed + 1))
else
    failed=$((failed + 1))
fi

# ================================================
# TEST 5: GET Tenant Agents
# ================================================
total=$((total + 1))
if test_endpoint "GET" "/api/chat/tenant/agents" "Listar agentes del tenant"; then
    passed=$((passed + 1))
else
    failed=$((failed + 1))
fi

# ================================================
# TEST 6: UPDATE Tenant Config
# ================================================
total=$((total + 1))
config_update='{
  "widget_color": "#FF6B6B",
  "welcome_message": "¡Hola! Test de actualización"
}'

if test_endpoint "PUT" "/api/chat/tenant/config" "Actualizar configuración del tenant" "$config_update"; then
    passed=$((passed + 1))
else
    failed=$((failed + 1))
fi

# ================================================
# TEST 7: INVITE Agent
# ================================================
total=$((total + 1))
invite_data='{
  "agent_email": "test-agent@example.com",
  "agent_name": "Test Agent",
  "role": "agent"
}'

if test_endpoint "POST" "/api/chat/tenant/agents" "Invitar nuevo agente" "$invite_data"; then
    passed=$((passed + 1))
else
    failed=$((failed + 1))
fi

# ================================================
# TEST 8: Verificar Config Actualizado
# ================================================
total=$((total + 1))
if test_endpoint "GET" "/api/chat/tenant/config" "Verificar configuración actualizada"; then
    passed=$((passed + 1))
else
    failed=$((failed + 1))
fi

# ================================================
# RESUMEN
# ================================================
echo "================================================"
echo "📊 RESUMEN DE TESTS"
echo "================================================"
echo ""
echo "Total:  $total"
echo -e "${GREEN}Passed: $passed${NC}"

if [ $failed -gt 0 ]; then
    echo -e "${RED}Failed: $failed${NC}"
fi

echo ""

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✅ TODOS LOS TESTS PASARON${NC}"
    echo ""
    echo "🎉 El backend multi-tenant está funcionando correctamente"
    echo ""
    echo "Próximos pasos:"
    echo "   1. Probar Socket.IO en: http://localhost:5000/test-multi-tenant-chat.html"
    echo "   2. Verificar datos en MySQL"
    echo "   3. Empezar con el frontend en app-saas"
    exit 0
else
    echo -e "${RED}❌ ALGUNOS TESTS FALLARON${NC}"
    echo ""
    echo "Revisa:"
    echo "   1. ¿Está el servidor corriendo? ps aux | grep node"
    echo "   2. ¿Se ejecutó la migración? npm run db:migrate:status"
    echo "   3. ¿Hay errores en el log? tail -f /tmp/smart-chat-server.log"
    exit 1
fi
