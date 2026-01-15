#!/bin/bash

# 🧪 Script para verificar que el tracking está funcionando correctamente

echo "🧪 Verificando sistema de tracking..."

API_URL="http://localhost:3500"

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Verificar que la tabla existe
echo ""
echo "1️⃣ Verificando tabla tracking_events..."
mysql -u admin -pNpqMQgVuTa8S ecommercedb -e "DESCRIBE tracking_events;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Tabla tracking_events existe${NC}"
else
  echo -e "${RED}❌ Tabla tracking_events NO existe${NC}"
  exit 1
fi

# 2. Test: Enviar evento de tracking
echo ""
echo "2️⃣ Enviando evento de prueba..."
SESSION_ID="test_sess_$(date +%s)"
RESPONSE=$(curl -s -X POST $API_URL/api/tracking/events \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"test_event\",
    \"properties\": {
      \"test\": true
    },
    \"sessionId\": \"$SESSION_ID\",
    \"module\": \"mailflow\",
    \"source\": \"test\"
  }")

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ Evento enviado correctamente${NC}"
  echo "$RESPONSE" | jq '.'
else
  echo -e "${RED}❌ Error al enviar evento${NC}"
  echo "$RESPONSE"
  exit 1
fi

# 3. Verificar que el evento se guardó
echo ""
echo "3️⃣ Verificando evento en BD..."
COUNT=$(mysql -u admin -pNpqMQgVuTa8S ecommercedb -Nse "SELECT COUNT(*) FROM tracking_events WHERE session_id='$SESSION_ID';")
if [ "$COUNT" -gt 0 ]; then
  echo -e "${GREEN}✅ Evento guardado en BD ($COUNT registros)${NC}"
else
  echo -e "${RED}❌ Evento NO se guardó en BD${NC}"
  exit 1
fi

# 4. Simular funnel completo
echo ""
echo "4️⃣ Simulando funnel completo..."

EVENTS=(
  '{"event":"page_view","sessionId":"'$SESSION_ID'","module":"mailflow","source":"preview","properties":{"page":"preview_wizard"}}'
  '{"event":"wizard_step_completed","sessionId":"'$SESSION_ID'","module":"mailflow","source":"preview","properties":{"step":1}}'
  '{"event":"wizard_step_completed","sessionId":"'$SESSION_ID'","module":"mailflow","source":"preview","properties":{"step":2}}'
  '{"event":"wizard_step_completed","sessionId":"'$SESSION_ID'","module":"mailflow","source":"preview","properties":{"step":3}}'
  '{"event":"preview_generated","sessionId":"'$SESSION_ID'","module":"mailflow","source":"preview","properties":{"industry":"ecommerce"}}'
  '{"event":"conversion_started","sessionId":"'$SESSION_ID'","module":"mailflow","source":"preview"}'
  '{"event":"registration_completed","sessionId":"'$SESSION_ID'","module":"mailflow","tenantId":999}'
  '{"event":"module_activated","sessionId":"'$SESSION_ID'","module":"mailflow","tenantId":999}'
)

for EVENT in "${EVENTS[@]}"; do
  curl -s -X POST $API_URL/api/tracking/events \
    -H "Content-Type: application/json" \
    -d "$EVENT" > /dev/null
  echo -n "."
done

echo ""
TOTAL_EVENTS=$(mysql -u admin -pNpqMQgVuTa8S ecommercedb -Nse "SELECT COUNT(*) FROM tracking_events WHERE session_id='$SESSION_ID';")
echo -e "${GREEN}✅ Funnel simulado: $TOTAL_EVENTS eventos guardados${NC}"

# 5. Verificar eventos por tipo
echo ""
echo "5️⃣ Verificando eventos por tipo..."
echo "📊 Eventos guardados:"
mysql -u admin -pNpqMQgVuTa8S ecommercedb -e "
  SELECT event, COUNT(*) as count 
  FROM tracking_events 
  WHERE session_id='$SESSION_ID' 
  GROUP BY event;
"

# 6. Resumen
echo ""
echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ VERIFICACIÓN COMPLETA${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📊 Estadísticas del sistema:"
mysql -u admin -pNpqMQgVuTa8S ecommercedb -e "
  SELECT 
    COUNT(*) as total_eventos,
    COUNT(DISTINCT session_id) as sesiones_unicas,
    COUNT(DISTINCT module) as modulos,
    MIN(timestamp) as primer_evento,
    MAX(timestamp) as ultimo_evento
  FROM tracking_events;
"

echo ""
echo "🎯 Eventos más comunes:"
mysql -u admin -pNpqMQgVuTa8S ecommercedb -e "
  SELECT event, COUNT(*) as count 
  FROM tracking_events 
  GROUP BY event 
  ORDER BY count DESC 
  LIMIT 10;
"

echo ""
echo -e "${YELLOW}📝 Para consultar métricas del funnel (requiere auth admin):${NC}"
echo "   curl -H 'Authorization: Bearer ADMIN_TOKEN' $API_URL/api/tracking/funnel/mailflow"
echo ""
echo -e "${YELLOW}📝 Para ver eventos de esta sesión de prueba:${NC}"
echo "   mysql -u admin -pNpqMQgVuTa8S ecommercedb -e \"SELECT * FROM tracking_events WHERE session_id='$SESSION_ID';\""
echo ""
echo -e "${GREEN}✅ Todo funcionando correctamente!${NC}"
