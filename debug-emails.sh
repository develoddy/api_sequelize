#!/bin/bash

# 🔍 DEBUG EMAIL DUPLICATES SCRIPT
# Monitorea logs de PM2 para identificar emails duplicados

echo "=================================================="
echo "🔍 EMAIL DUPLICATES DEBUG TOOL"
echo "=================================================="
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para mostrar sección
section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# 1. EMAIL TRIGGERS
section "1️⃣ EMAIL TRIGGERS (últimos 20)"
echo -e "${YELLOW}Buscando logs de 'EMAIL TRIGGERED FROM'...${NC}"
echo ""

TRIGGERS=$(pm2 logs api --lines 300 --nostream 2>/dev/null | grep "EMAIL TRIGGERED FROM" | tail -20)

if [ -z "$TRIGGERS" ]; then
    echo -e "${RED}❌ No se encontraron logs de EMAIL TRIGGERED FROM${NC}"
    echo -e "${YELLOW}💡 Sugerencia: Realiza una compra test primero${NC}"
else
    echo "$TRIGGERS"
    
    # Contar triggers
    COUNT=$(echo "$TRIGGERS" | wc -l | tr -d ' ')
    echo ""
    echo -e "${GREEN}📊 Total de triggers encontrados: $COUNT${NC}"
fi

# 2. WEBHOOKS PRINTFUL
section "2️⃣ WEBHOOKS PRINTFUL (últimos 10)"
echo -e "${YELLOW}Buscando logs de webhooks Printful...${NC}"
echo ""

PRINTFUL=$(pm2 logs api --lines 300 --nostream 2>/dev/null | grep -E "(WEBHOOK Printful|Order Printing|handleOrderCreated)" | tail -10)

if [ -z "$PRINTFUL" ]; then
    echo -e "${GREEN}✅ No se encontraron logs de webhooks Printful${NC}"
else
    echo "$PRINTFUL"
fi

# 3. EMAILS ENVIADOS
section "3️⃣ EMAILS ENVIADOS (últimos 10)"
echo -e "${YELLOW}Buscando confirmaciones de envío...${NC}"
echo ""

SENT=$(pm2 logs api --lines 300 --nostream 2>/dev/null | grep -E "(Email sent|Confirmation email|email enviado)" | tail -10)

if [ -z "$SENT" ]; then
    echo -e "${RED}❌ No se encontraron confirmaciones de envío${NC}"
else
    echo "$SENT"
fi

# 4. ANÁLISIS
section "4️⃣ ANÁLISIS"

echo -e "${YELLOW}Analizando duplicados...${NC}"
echo ""

# Buscar pares de triggers cercanos en tiempo
RECENT_TRIGGERS=$(pm2 logs api --lines 100 --nostream 2>/dev/null | grep "EMAIL TRIGGERED FROM")

if [ -z "$RECENT_TRIGGERS" ]; then
    echo -e "${RED}❌ No hay datos para analizar${NC}"
    echo -e "${YELLOW}💡 Realiza una compra test y vuelve a ejecutar este script${NC}"
else
    # Contar triggers únicos
    UNIQUE_FILES=$(echo "$RECENT_TRIGGERS" | grep -oE "(stripe|paypal|email\.service|emailNotification)" | sort | uniq -c)
    
    echo -e "${GREEN}📊 Archivos que enviaron emails:${NC}"
    echo "$UNIQUE_FILES"
    echo ""
    
    # Detectar duplicados
    STRIPE_COUNT=$(echo "$UNIQUE_FILES" | grep "stripe" | awk '{print $1}')
    PAYPAL_COUNT=$(echo "$UNIQUE_FILES" | grep "paypal" | awk '{print $1}')
    EMAIL_SERVICE_COUNT=$(echo "$UNIQUE_FILES" | grep "email.service" | awk '{print $1}')
    NOTIFICATION_COUNT=$(echo "$UNIQUE_FILES" | grep "emailNotification" | awk '{print $1}')
    
    if [ ! -z "$NOTIFICATION_COUNT" ] && [ "$NOTIFICATION_COUNT" -gt 0 ]; then
        echo -e "${RED}⚠️ ALERTA: emailNotification.service.js está enviando emails!${NC}"
        echo -e "${YELLOW}   Esto podría ser el email de 'Order Printing' duplicado${NC}"
    fi
fi

# 5. RESUMEN
section "5️⃣ RESUMEN"

echo -e "${YELLOW}Estado del sistema:${NC}"
echo ""

if [ -z "$TRIGGERS" ]; then
    echo -e "${RED}❌ No hay logs de emails recientes${NC}"
    echo -e "${YELLOW}💡 Acción: Realiza una compra test${NC}"
elif [ ! -z "$NOTIFICATION_COUNT" ] && [ "$NOTIFICATION_COUNT" -gt 0 ]; then
    echo -e "${RED}❌ PROBLEMA DETECTADO: Emails duplicados${NC}"
    echo -e "${YELLOW}📁 Culpable: emailNotification.service.js${NC}"
    echo -e "${YELLOW}🔧 Acción: Verificar llamadas a sendOrderPrintingEmail()${NC}"
else
    echo -e "${GREEN}✅ Sistema parece estar enviando 1 solo email${NC}"
    echo -e "${GREEN}📧 Verifica tu bandeja de entrada para confirmar${NC}"
fi

echo ""
section "🎯 SIGUIENTE PASO"

echo ""
echo -e "${BLUE}1.${NC} Revisa los logs arriba"
echo -e "${BLUE}2.${NC} Si ves 2 'EMAIL TRIGGERED FROM' para la misma compra → hay duplicado"
echo -e "${BLUE}3.${NC} Identifica qué archivo envía el segundo email"
echo -e "${BLUE}4.${NC} Lee DEBUG-EMAIL-DUPLICATES.md para la solución"
echo ""

echo "=================================================="
echo "✅ Análisis completado"
echo "=================================================="
