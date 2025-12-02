#!/bin/bash

# 🔍 Script de Verificación - Implementación Token de Tracking
# ============================================================

echo "🔍 Verificando implementación de Token de Tracking..."
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contador de checks
CHECKS_PASSED=0
TOTAL_CHECKS=0

# Función para verificar archivo
check_file() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅${NC} Archivo encontrado: $1"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        echo -e "${RED}❌${NC} Archivo NO encontrado: $1"
    fi
}

# Función para verificar contenido en archivo
check_content() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    if grep -q "$2" "$1" 2>/dev/null; then
        echo -e "${GREEN}✅${NC} Contenido verificado en $1: $3"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        echo -e "${RED}❌${NC} Contenido NO encontrado en $1: $3"
    fi
}

echo "📋 VERIFICANDO BACKEND..."
echo "========================"
echo ""

# 1. Modelo Sale.js
check_file "api/src/models/Sale.js"
check_content "api/src/models/Sale.js" "trackingToken" "Campo trackingToken definido"

# 2. Migración Sequelize
check_file "api/migrations/20251201000000-add-tracking-token-to-sales.cjs"
check_content "api/migrations/20251201000000-add-tracking-token-to-sales.cjs" "trackingToken" "Migración Sequelize"

# 3. Sale Controller
check_file "api/src/controllers/sale.controller.js"
check_content "api/src/controllers/sale.controller.js" "import crypto" "Import crypto"
check_content "api/src/controllers/sale.controller.js" "trackingToken = crypto.randomBytes" "Generación de token"

# 4. Tracking Controller
check_file "api/src/controllers/tracking.controller.js"
check_content "api/src/controllers/tracking.controller.js" "orderId, token" "Parámetros orderId y token"
check_content "api/src/controllers/tracking.controller.js" "trackingToken: token" "Validación de token"

# 5. Tracking Routes
check_file "api/src/routes/tracking.routes.js"
check_content "api/src/routes/tracking.routes.js" ":orderId/:token" "Ruta con token"

# 6. Email Template
check_file "api/src/mails/email_sale.html"
check_content "api/src/mails/email_sale.html" "order.trackingToken" "Token en email"
check_content "api/src/mails/email_sale.html" "Rastrea tu pedido" "Sección de tracking"

echo ""
echo "📋 VERIFICANDO FRONTEND..."
echo "=========================="
echo ""

# 7. Tracking Service
check_file "ecommerce/src/app/modules/tracking/services/tracking.service.ts"
check_content "ecommerce/src/app/modules/tracking/services/tracking.service.ts" "orderId: string, token: string" "Parámetros en servicio"

# 8. Tracking Routing Module
check_file "ecommerce/src/app/modules/tracking/tracking-routing.module.ts"
check_content "ecommerce/src/app/modules/tracking/tracking-routing.module.ts" ":orderId/:token" "Ruta con token"

# 9. Tracking Search Component TS
check_file "ecommerce/src/app/modules/tracking/pages/tracking-search/tracking-search.component.ts"
check_content "ecommerce/src/app/modules/tracking/pages/tracking-search/tracking-search.component.ts" "trackingToken: string" "Variable trackingToken"

# 10. Tracking Search Component HTML
check_file "ecommerce/src/app/modules/tracking/pages/tracking-search/tracking-search.component.html"
check_content "ecommerce/src/app/modules/tracking/pages/tracking-search/tracking-search.component.html" "trackingTokenInput" "Input de token"

# 11. Tracking Status Component
check_file "ecommerce/src/app/modules/tracking/pages/tracking-status/tracking-status.component.ts"
check_content "ecommerce/src/app/modules/tracking/pages/tracking-status/tracking-status.component.ts" "token: string" "Variable token"
check_content "ecommerce/src/app/modules/tracking/pages/tracking-status/tracking-status.component.ts" "this.orderId, this.token" "Llamada con token"

echo ""
echo "📊 RESUMEN"
echo "=========="
echo ""

PERCENTAGE=$((CHECKS_PASSED * 100 / TOTAL_CHECKS))

if [ $CHECKS_PASSED -eq $TOTAL_CHECKS ]; then
    echo -e "${GREEN}✅ TODOS LOS CHECKS PASADOS: $CHECKS_PASSED/$TOTAL_CHECKS ($PERCENTAGE%)${NC}"
    echo ""
    echo -e "${GREEN}🎉 Implementación completa y lista!${NC}"
    echo ""
    echo "📝 PRÓXIMOS PASOS:"
    echo "1. Ejecutar migración Sequelize: cd api && npx sequelize-cli db:migrate"
    echo "2. Reiniciar backend: cd api && pm2 restart ecommerce-api"
    echo "3. Compilar frontend: cd ecommerce && npm run build:ssr"
    echo "4. Cambiar 'tudominio.com' por tu dominio real en email_sale.html"
    echo "5. Probar con una venta real"
    exit 0
else
    echo -e "${RED}⚠️  CHECKS FALLIDOS: $((TOTAL_CHECKS - CHECKS_PASSED))/$TOTAL_CHECKS${NC}"
    echo -e "${YELLOW}Por favor revisa los archivos marcados con ❌${NC}"
    exit 1
fi
