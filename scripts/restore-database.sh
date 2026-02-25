#!/bin/bash

################################################################################
# Restore MySQL Database Script - LujanDev E-commerce
# Descripción: Script para restaurar un backup de MySQL
# Autor: LujanDev Team
################################################################################

# Configuración
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-ecommercedb}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"
BACKUP_DIR="/Volumes/lujandev/dev/projects/ECOMMERCE/ECOMMERCE-MEAN/api/backups/mysql"

# Verificar si existe XAMPP MySQL
if command -v /Applications/XAMPP/xamppfiles/bin/mysql &> /dev/null; then
    MYSQL_CMD="/Applications/XAMPP/xamppfiles/bin/mysql"
    echo "✅ Usando MySQL de XAMPP"
else
    MYSQL_CMD="mysql"
    echo "✅ Usando MySQL del sistema"
fi

echo "🔄 ===== SCRIPT DE RESTAURACIÓN DE MYSQL ====="
echo "🗄️  Base de datos: $DB_NAME"
echo "🖥️  Servidor: $DB_HOST:$DB_PORT"
echo ""

# Listar backups disponibles
echo "📂 Backups disponibles:"
ls -lht "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -10

if [[ $? -ne 0 ]]; then
    echo "❌ No se encontraron backups en $BACKUP_DIR"
    exit 1
fi

echo ""
echo "⚠️  ADVERTENCIA: La restauración sobrescribirá la base de datos actual"
read -p "¿Deseas continuar? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "⏭️  Restauración cancelada"
    exit 0
fi

echo ""
read -p "📁 Ingresa el nombre del archivo de backup (ej: ecommercedb_backup_20251205_140101.sql.gz): " BACKUP_FILE

BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILE"

if [[ ! -f "$BACKUP_PATH" ]]; then
    echo "❌ Archivo de backup no encontrado: $BACKUP_PATH"
    exit 1
fi

echo ""
echo "🚀 Iniciando restauración..."
echo "📂 Archivo: $BACKUP_FILE"

# Crear base de datos si no existe
echo "🗄️  Creando base de datos si no existe..."
$MYSQL_CMD -h$DB_HOST -P$DB_PORT -u$DB_USER -e "CREATE DATABASE IF NOT EXISTS $DB_NAME;"

# Restaurar backup
echo "💾 Restaurando backup..."
if gunzip -c "$BACKUP_PATH" | $MYSQL_CMD -h$DB_HOST -P$DB_PORT -u$DB_USER "$DB_NAME"; then
    echo "✅ Backup restaurado exitosamente"
    
    # Verificar restauración
    echo "🔍 Verificando restauración..."
    TABLES_COUNT=$($MYSQL_CMD -h$DB_HOST -P$DB_PORT -u$DB_USER "$DB_NAME" -e "SHOW TABLES;" | wc -l)
    echo "📊 Tablas restauradas: $((TABLES_COUNT - 1))"
    
    echo "✅ ===== RESTAURACIÓN COMPLETADA ====="
else
    echo "❌ Error durante la restauración"
    exit 1
fi