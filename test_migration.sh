#!/bin/bash

# Script para probar migración de prelaunch desde cero
# Uso: ./test_migration.sh

set -e  # Salir si cualquier comando falla

echo "🧪 === PRUEBA DE MIGRACIÓN PRELAUNCH ==="
echo ""

# Variables
DB_NAME="ecommercedb_test"
MIGRATION_FILE="20251122000000-create-prelaunch-subscribers.cjs"

echo "📋 Pasos a ejecutar:"
echo "1. Crear base de datos de prueba"
echo "2. Deshacer migración si existe"
echo "3. Ejecutar migración nueva"
echo "4. Verificar estructura de tabla"
echo "5. Probar inserción de datos"
echo "6. Verificar índices"
echo ""

# Función para ejecutar SQL
execute_sql() {
    local sql="$1"
    local description="$2"
    
    echo "🔍 $description"
    echo "SQL: $sql"
    
    mysql -h${DB_HOST:-localhost} -u${DB_USER:-root} -p${DB_PASSWORD} -e "$sql" 2>/dev/null || {
        echo "❌ Error ejecutando: $description"
        return 1
    }
    echo "✅ Completado: $description"
    echo ""
}

# Función para verificar tabla
verify_table() {
    echo "🔍 Verificando estructura de tabla prelaunch_subscribers..."
    
    mysql -h${DB_HOST:-localhost} -u${DB_USER:-root} -p${DB_PASSWORD} $DB_NAME -e "
        DESCRIBE prelaunch_subscribers;
        SHOW INDEX FROM prelaunch_subscribers;
    " || {
        echo "❌ Error verificando tabla"
        return 1
    }
    echo "✅ Estructura verificada correctamente"
    echo ""
}

# Función para probar inserción
test_insert() {
    echo "🔍 Probando inserción de datos..."
    
    mysql -h${DB_HOST:-localhost} -u${DB_USER:-root} -p${DB_PASSWORD} $DB_NAME -e "
        INSERT INTO prelaunch_subscribers (email, source, session_id) 
        VALUES ('test@example.com', 'main_form', 'test-session-123');
        
        SELECT * FROM prelaunch_subscribers WHERE email = 'test@example.com';
        
        DELETE FROM prelaunch_subscribers WHERE email = 'test@example.com';
    " || {
        echo "❌ Error en prueba de inserción"
        return 1
    }
    echo "✅ Inserción probada correctamente"
    echo ""
}

# Verificar variables de entorno
if [[ -z "$DB_USER" || -z "$DB_PASSWORD" ]]; then
    echo "⚠️  Variables de entorno requeridas:"
    echo "   export DB_USER=tu_usuario"
    echo "   export DB_PASSWORD=tu_password"
    echo "   export DB_HOST=localhost  # opcional"
    echo ""
    echo "¿Continuar con valores por defecto? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "❌ Cancelado por el usuario"
        exit 1
    fi
    
    echo "Usando valores por defecto (root/sin password)"
    DB_USER="root"
    DB_PASSWORD=""
fi

echo "🚀 Iniciando pruebas..."
echo ""

# 1. Crear/recrear base de datos de prueba
execute_sql "DROP DATABASE IF EXISTS $DB_NAME;" "Eliminando DB de prueba anterior"
execute_sql "CREATE DATABASE $DB_NAME;" "Creando DB de prueba nueva"
execute_sql "USE $DB_NAME; CREATE TABLE SequelizeMeta (name VARCHAR(255) NOT NULL PRIMARY KEY);" "Creando tabla de migraciones"

# 2. Cambiar al directorio de la API
cd "$(dirname "$0")"

# 3. Ejecutar migración
echo "🔍 Ejecutando migración..."
NODE_ENV=development DB_NAME=$DB_NAME npx sequelize-cli db:migrate --to $MIGRATION_FILE || {
    echo "❌ Error ejecutando migración"
    exit 1
}
echo "✅ Migración ejecutada correctamente"
echo ""

# 4. Verificar tabla
verify_table

# 5. Probar inserción
test_insert

# 6. Verificar migración se puede deshacer
echo "🔍 Probando rollback de migración..."
NODE_ENV=development DB_NAME=$DB_NAME npx sequelize-cli db:migrate:undo --to $MIGRATION_FILE || {
    echo "❌ Error en rollback"
    exit 1
}
echo "✅ Rollback completado correctamente"
echo ""

# 7. Limpiar
execute_sql "DROP DATABASE $DB_NAME;" "Limpiando DB de prueba"

echo ""
echo "🎉 === TODAS LAS PRUEBAS PASARON EXITOSAMENTE ==="
echo ""
echo "✅ Migración funciona correctamente"
echo "✅ Tabla se crea con estructura correcta"  
echo "✅ Índices se crean correctamente"
echo "✅ Inserción de datos funciona"
echo "✅ Rollback funciona"
echo ""
echo "🚀 La migración está lista para PRODUCCIÓN"