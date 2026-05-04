#!/bin/bash

# 🔴 MONITOR DE EMAILS DUPLICADOS - TIEMPO REAL

echo "=================================================="
echo "🔴 MONITOR DE EMAILS DUPLICADOS - TIEMPO REAL"
echo "=================================================="
echo ""
echo "📌 Esperando compra test..."
echo "📌 Presiona Ctrl+C para salir"
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Contador
EMAIL_COUNT=0
DUPLICATE_COUNT=0

# Monitorear logs en tiempo real
pm2 logs api --lines 0 --raw 2>/dev/null | while read line; do
    
    # Detectar UNIQUE EMAIL SEND
    if echo "$line" | grep -q "UNIQUE EMAIL SEND"; then
        EMAIL_COUNT=$((EMAIL_COUNT + 1))
        echo ""
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}📧 EMAIL #$EMAIL_COUNT DETECTED${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo "$line"
        continue
    fi
    
    # Detectar EMAIL DUPLICADO BLOQUEADO
    if echo "$line" | grep -q "EMAIL DUPLICADO BLOQUEADO"; then
        DUPLICATE_COUNT=$((DUPLICATE_COUNT + 1))
        echo ""
        echo -e "${RED}⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️${NC}"
        echo -e "${RED}🚨 DUPLICADO #$DUPLICATE_COUNT BLOQUEADO 🚨${NC}"
        echo -e "${RED}⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️${NC}"
        echo "$line"
        continue
    fi
    
    # Detectar EMAIL EN PROGRESO
    if echo "$line" | grep -q "EMAIL EN PROGRESO"; then
        echo ""
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${YELLOW}⏳ EMAIL EN PROGRESO - BLOQUEANDO${NC}"
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo "$line"
        continue
    fi
    
    # Detectar Guard Stats
    if echo "$line" | grep -q "Guard Stats"; then
        echo ""
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BLUE}📊 ESTADÍSTICAS DEL GUARD${NC}"
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo "$line"
        continue
    fi
    
    # Detectar EMAIL ENVIADO EXITOSAMENTE
    if echo "$line" | grep -q "EMAIL ENVIADO EXITOSAMENTE"; then
        echo ""
        echo -e "${GREEN}✅ EMAIL SENT SUCCESSFULLY${NC}"
        continue
    fi
    
    # Detectar MessageId
    if echo "$line" | grep -q "MessageId:"; then
        echo -e "${MAGENTA}$line${NC}"
        continue
    fi
    
    # Detectar Transporter creado
    if echo "$line" | grep -q "Transporter.*Creado sin pool"; then
        echo ""
        echo -e "${BLUE}🔧 $line${NC}"
        continue
    fi
    
    # Detectar conexiones SMTP
    if echo "$line" | grep -qE "Secure connection established|Connection closed"; then
        echo -e "${BLUE}🔌 $line${NC}"
        continue
    fi
    
done
