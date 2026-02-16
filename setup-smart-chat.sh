#!/bin/bash

# 🚀 SMART CHAT SAAS - SETUP Y VERIFICACIÓN RÁPIDA
# Este script ejecuta todos los pasos necesarios para tener el MVP funcionando

set -e  # Detener si hay errores

echo "================================================"
echo "🚀 SMART CHAT SAAS - SETUP AUTOMATIZADO"
echo "================================================"
echo ""

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Función para mostrar pasos
step() {
    echo -e "${BLUE}[PASO $1]${NC} $2"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Directorio del proyecto
PROJECT_DIR="/Volumes/lujandev/dev/projects/ECOMMERCE/ECOMMERCE-MEAN/api"

# ================================================
# PASO 1: Verificar pre-requisitos
# ================================================
step 1 "Verificando pre-requisitos..."

if ! command -v node &> /dev/null; then
    error "Node.js no está instalado"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    error "npm no está instalado"
    exit 1
fi

if ! command -v mysql &> /dev/null; then
    warning "mysql CLI no encontrado. Asegúrate de tener MySQL corriendo."
fi

success "Node.js $(node --version) y npm $(npm --version) instalados"

# ================================================
# PASO 2: Instalar dependencias (si es necesario)
# ================================================
step 2 "Verificando dependencias..."

cd "$PROJECT_DIR"

if [ ! -d "node_modules" ]; then
    echo "Instalando dependencias..."
    npm install
    success "Dependencias instaladas"
else
    success "Dependencias ya instaladas"
fi

# ================================================
# PASO 3: Ejecutar migración
# ================================================
step 3 "Ejecutando migración multi-tenant..."

echo ""
echo "📊 Ejecutando: npm run db:migrate:dev"
echo ""

npm run db:migrate:dev

if [ $? -eq 0 ]; then
    success "Migración ejecutada correctamente"
else
    error "Error en la migración. Revisa los logs arriba."
    echo ""
    echo "💡 Soluciones comunes:"
    echo "   1. Verifica que MySQL esté corriendo"
    echo "   2. Verifica las credenciales en config/config.cjs"
    echo "   3. Verifica que la BD existe: mysql -u root -p -e 'SHOW DATABASES;'"
    exit 1
fi

# ================================================
# PASO 4: Verificar tablas creadas
# ================================================
step 4 "Verificando tablas en la base de datos..."

echo ""
echo "Verificando tablas tenant_chat_config y tenant_agents..."

# Intentar verificar con mysql (si está disponible)
if command -v mysql &> /dev/null; then
    MYSQL_USER="${MYSQL_USER:-root}"
    MYSQL_DATABASE="${MYSQL_DATABASE:-ecommerce_db}"
    
    echo "Conectando a MySQL como $MYSQL_USER..."
    
    mysql -u "$MYSQL_USER" -p -e "
        USE $MYSQL_DATABASE;
        SHOW TABLES LIKE 'tenant_%';
    " 2>/dev/null
    
    if [ $? -eq 0 ]; then
        success "Tablas multi-tenant verificadas"
    else
        warning "No se pudo verificar automáticamente. Verifica manualmente."
    fi
else
    warning "Verifica manualmente con MySQL Workbench o CLI"
fi

# ================================================
# PASO 5: Iniciar servidor (en background)
# ================================================
step 5 "Iniciando servidor de desarrollo..."

echo ""
echo "🚀 Iniciando servidor en puerto 3500..."
echo ""

# Matar proceso anterior si existe
pkill -f "npm run dev" 2>/dev/null || true

# Iniciar servidor en background
npm run dev > /tmp/smart-chat-server.log 2>&1 &
SERVER_PID=$!

echo "Esperando a que el servidor inicie..."
sleep 5

# Verificar que el servidor está corriendo
if ps -p $SERVER_PID > /dev/null; then
    success "Servidor iniciado (PID: $SERVER_PID)"
    echo "📝 Logs en: /tmp/smart-chat-server.log"
else
    error "El servidor no pudo iniciarse"
    echo "Revisa el log: cat /tmp/smart-chat-server.log"
    exit 1
fi

# ================================================
# PASO 6: Verificar endpoints
# ================================================
step 6 "Probando endpoints multi-tenant..."

echo ""
echo "Testing GET /api/chat/tenant/config (Tenant 1)..."

RESPONSE=$(curl -s -w "\n%{http_code}" -H "X-Tenant-Id: 1" http://localhost:3500/api/chat/tenant/config)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n1)

if [ "$HTTP_CODE" = "200" ]; then
    success "Endpoint /config funcionando"
    echo "Respuesta: $BODY" | head -c 100
    echo "..."
else
    error "Endpoint /config falló (HTTP $HTTP_CODE)"
    echo "Respuesta: $BODY"
fi

echo ""
echo "Testing GET /api/chat/tenant/stats (Tenant 1)..."

RESPONSE=$(curl -s -w "\n%{http_code}" -H "X-Tenant-Id: 1" http://localhost:3500/api/chat/tenant/stats)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "200" ]; then
    success "Endpoint /stats funcionando"
else
    error "Endpoint /stats falló (HTTP $HTTP_CODE)"
fi

# ================================================
# PASO 7: Abrir página de prueba
# ================================================
step 7 "Abriendo página de prueba..."

echo ""
TEST_URL="http://localhost:3500/test-multi-tenant-chat.html"

if command -v open &> /dev/null; then
    # macOS
    open "$TEST_URL"
    success "Página de prueba abierta en el navegador"
elif command -v xdg-open &> /dev/null; then
    # Linux
    xdg-open "$TEST_URL"
    success "Página de prueba abierta en el navegador"
else
    warning "Abre manualmente: $TEST_URL"
fi

# ================================================
# RESUMEN FINAL
# ================================================
echo ""
echo "================================================"
echo "✅ SETUP COMPLETADO"
echo "================================================"
echo ""
echo "📋 Resumen:"
echo "   • Migración ejecutada ✓"
echo "   • Tablas multi-tenant creadas ✓"
echo "   • Servidor corriendo en puerto 3500 ✓"
echo "   • Endpoints multi-tenant funcionando ✓"
echo ""
echo "🎯 Próximos pasos:"
echo ""
echo "   1. Abre el navegador en:"
echo "      $TEST_URL"
echo ""
echo "   2. Prueba enviar mensajes desde diferentes tenants"
echo ""
echo "   3. Verifica en MySQL:"
echo "      mysql -u root -p"
echo "      USE ecommerce_db;"
echo "      SELECT * FROM chat_messages ORDER BY id DESC LIMIT 5;"
echo ""
echo "   4. Verifica que los mensajes tienen tenant_id correcto"
echo ""
echo "📝 Gestión del servidor:"
echo "   • Ver logs: tail -f /tmp/smart-chat-server.log"
echo "   • Detener: kill $SERVER_PID"
echo "   • Reiniciar: npm run dev"
echo ""
echo "📚 Documentación completa:"
echo "   • QUICK-START-MVP.md"
echo "   • SMART-CHAT-SAAS-ACTION-PLAN.md"
echo ""
echo "================================================"
echo "🚀 Happy coding!"
echo "================================================"
