#!/bin/bash

# Test rápido para verificar variables de entorno del backup

echo "🧪 PRUEBA DE VARIABLES DE ENTORNO PARA BACKUP"
echo "============================================="

# Función para detectar y cargar archivo de entorno
detect_and_load_env() {
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local api_dir="$(dirname "$script_dir")"
    local env_file=""
    
    # Detectar archivo de entorno basado en NODE_ENV y disponibilidad
    if [[ "$NODE_ENV" == "production" && -f "$api_dir/.env.production" ]]; then
        env_file="$api_dir/.env.production"
        echo "🌐 Entorno detectado: PRODUCCIÓN"
    elif [[ "$NODE_ENV" == "development" && -f "$api_dir/.env.development" ]]; then
        env_file="$api_dir/.env.development"
        echo "🔧 Entorno detectado: DESARROLLO"
    elif [[ -f "$api_dir/.env" ]]; then
        env_file="$api_dir/.env"
        echo "📋 Entorno detectado: POR DEFECTO"
    else
        echo "❌ ERROR: No se encontró ningún archivo de entorno (.env.production, .env.development, .env)"
        return 1
    fi
    
    echo "📄 Cargando variables desde: $env_file"
    
    # Cargar variables de entorno
    set -a  # Activar auto-export de variables
    source "$env_file"
    set +a  # Desactivar auto-export
    
    echo "✅ Variables de entorno cargadas correctamente"
    return 0
}

# Cargar variables de entorno
if ! detect_and_load_env; then
    echo "❌ Error crítico: No se pudieron cargar las variables de entorno"
    exit 1
fi

echo ""
echo "🔍 VARIABLES DE BASE DE DATOS CARGADAS:"
echo "NODE_ENV: ${NODE_ENV:-'no definido'}"
echo "DB_HOST: ${DB_HOST:-'no definido'}"
echo "DB_PORT: ${DB_PORT:-'no definido'}"
echo "DB_NAME: ${DB_NAME:-'no definido'}"
echo "DB_USER: ${DB_USER:-'no definido'}"
echo "DB_PASSWORD: $(if [[ -n "$DB_PASSWORD" ]]; then echo "***definido*** (${#DB_PASSWORD} caracteres)"; else echo "NO DEFINIDO"; fi)"

echo ""
echo "🔌 PROBANDO CONEXIÓN A MYSQL..."

# Verificar si mysql está disponible
if command -v mysql &> /dev/null; then
    echo "✅ MySQL client encontrado"
    
    # Mostrar el comando que se va a ejecutar (sin mostrar la contraseña)
    echo "🔍 Comando a ejecutar: mysql -h$DB_HOST -P$DB_PORT -u$DB_USER -p[PASSWORD_HIDDEN] $DB_NAME"
    
    # Probar conexión con más detalle de errores
    echo ""
    echo "📋 PROBANDO CONEXIÓN PASO A PASO:"
    
    # Paso 1: Probar conectividad de red
    echo "1️⃣ Probando conectividad de red..."
    if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
        echo "   ✅ Puerto $DB_PORT accesible en $DB_HOST"
    else
        echo "   ❌ No se puede conectar al puerto $DB_PORT en $DB_HOST"
        echo "   💡 Verificar firewall y conectividad de red"
    fi
    
    # Paso 2: Probar autenticación MySQL
    echo ""
    echo "2️⃣ Probando autenticación MySQL..."
    
    # Construir comando con espacios correctos y SSL
    mysql_cmd="mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD --ssl-mode=REQUIRED"
    
    # Ejecutar con captura de errores
    if echo "SELECT 1 AS test;" | $mysql_cmd "$DB_NAME" 2>/tmp/mysql_error.log; then
        echo "   ✅ Conexión a base de datos exitosa!"
        
        # Obtener información adicional
        echo ""
        echo "📊 INFORMACIÓN DE LA BASE DE DATOS:"
        echo "SELECT COUNT(*) AS total_tables FROM information_schema.tables WHERE table_schema = '$DB_NAME';" | $mysql_cmd "$DB_NAME" 2>/dev/null
        
    else
        echo "   ❌ Error: No se puede conectar a la base de datos"
        echo ""
        echo "🚨 DETALLES DEL ERROR:"
        if [[ -f /tmp/mysql_error.log ]]; then
            cat /tmp/mysql_error.log
            rm -f /tmp/mysql_error.log
        fi
        
        echo ""
        echo "🔧 INFORMACIÓN DE DEBUG:"
        echo "   Host: $DB_HOST"
        echo "   Puerto: $DB_PORT" 
        echo "   Database: $DB_NAME"
        echo "   User: $DB_USER"
        echo "   Password length: ${#DB_PASSWORD} caracteres"
        echo "   Password starts with: ${DB_PASSWORD:0:2}..."
        
        exit 1
    fi
else
    echo "❌ MySQL client no está instalado"
    exit 1
fi

echo ""
echo "✅ Todas las pruebas completadas exitosamente!"