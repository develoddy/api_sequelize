#!/bin/bash

# ========================================
# 🧪 TEST SCRIPT - Product Video Express
# ========================================
# Este script prueba todos los endpoints del módulo

# Configuración
API_URL="http://localhost:3500"
API_PREFIX="/api"
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sIjoiYWRtaW4iLCJlbWFpbCI6ImFkbWluQGFkbWluLmNvbSIsImlhdCI6MTc3MDM5MjU5MiwiZXhwIjoxNzcwNDc4OTkyfQ.zJyN9zjAjz38fRQk1qjnM1PMGSgMzzNBWv0FhDw4U9E"
VIDEO_EXPRESS_URL="${API_URL}${API_PREFIX}/video-express"

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🎬 Testing Product Video Express${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Test 1: Health Check
echo -e "${BLUE}📊 Test 1: Health Check${NC}"
curl -s "${API_URL}/api/health" | jq '.'
echo -e "\n"

# Test 2: Obtener estadísticas (inicialmente 0)
echo -e "${BLUE}📊 Test 2: Obtener estadísticas del usuario${NC}"
curl -s -X GET "${VIDEO_EXPRESS_URL}/stats" \
  -H "token: ${TOKEN}" | jq '.' || echo "Error: jq no está instalado. Instala con: brew install jq"
echo -e "\n"

# Test 3: Listar jobs (inicialmente vacío)
echo -e "${BLUE}📊 Test 3: Listar jobs del usuario${NC}"
curl -s -X GET "${VIDEO_EXPRESS_URL}/jobs?limit=10" \
  -H "token: ${TOKEN}" | jq '.' || curl -s -X GET "${VIDEO_EXPRESS_URL}/jobs?limit=10" -H "token: ${TOKEN}"
echo -e "\n"

# Test 4: Crear un job (necesitas una imagen)
echo -e "${BLUE}📊 Test 4: Crear un nuevo job de video${NC}"
echo -e "${RED}⚠️  Para este test necesitas proporcionar una imagen${NC}"
echo -e "${GREEN}Ejemplo de comando:${NC}"
echo -e ""
echo -e "curl -X POST ${VIDEO_EXPRESS_URL}/jobs \\"
echo -e "  -H \"token: ${TOKEN}\" \\"
echo -e "  -F \"product_image=@/ruta/a/tu/imagen.jpg\" \\"
echo -e "  -F \"animation_style=parallax\""
echo -e ""
echo -e "${BLUE}Estilos disponibles:${NC} zoom_in | parallax | subtle_float"
echo -e "\n"

# Test 5: Verificar que el cron job está corriendo
echo -e "${BLUE}📊 Test 5: Verificar logs del servidor${NC}"
echo -e "${GREEN}Revisa los logs del servidor, deberías ver:${NC}"
echo -e "  ⏰ [Cron] Ejecutando polling de Video Express..."
echo -e "  🔄 Revisando jobs pendientes..."
echo -e "\n"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Tests básicos completados${NC}"
echo -e "${GREEN}========================================${NC}"
