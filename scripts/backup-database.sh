#!/bin/bash

################################################################################
# MySQL Database Backup Script - LujanDev E-commerce
# Descripción: Script automatizado para backup completo de MySQL con compresión,
#             retención de archivos, notificaciones email y logging detallado
# Autor: LujanDev Team
# Fecha: $(date '+%Y-%m-%d')
# Versión: 2.0
################################################################################

# ============================== CONFIGURACIÓN ==============================

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

# Cargar variables de entorno al inicio
if ! detect_and_load_env; then
    echo "❌ Error crítico: No se pudieron cargar las variables de entorno"
    exit 1
fi

# Configuración de base de datos (usando variables de entorno cargadas o valores por defecto)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-ecommercedb}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"

# Directorios (detectar automáticamente la ubicación del proyecto)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$API_DIR/backups/mysql"
LOG_DIR="$API_DIR/backups/logs"

echo "📂 Directorio de la API: $API_DIR"
echo "💾 Directorio de backups: $BACKUP_DIR"
echo "📋 Directorio de logs: $LOG_DIR"

# Configuración de archivos
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="${DB_NAME}_backup_${TIMESTAMP}.sql"
BACKUP_FILE_COMPRESSED="${BACKUP_FILE}.gz"
LOG_FILE="${LOG_DIR}/backup_${TIMESTAMP}.log"
ERROR_LOG="${LOG_DIR}/backup_errors.log"

# Configuración de retención (días)
RETENTION_DAYS=30

# Configuración de email (opcional)
EMAIL_ENABLED="${EMAIL_ENABLED:-false}"
EMAIL_TO="${EMAIL_TO:-admin@lujandev.com}"
EMAIL_FROM="${EMAIL_FROM:-backup@lujandev.com}"
EMAIL_SUBJECT_SUCCESS="✅ Backup MySQL exitoso - ${DB_NAME}"
EMAIL_SUBJECT_ERROR="❌ Error en backup MySQL - ${DB_NAME}"

# Configuración de alertas
MAX_BACKUP_SIZE_MB=500
MIN_BACKUP_SIZE_KB=100

# ============================== FUNCIONES ==============================

log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
    
    if [[ "$level" == "ERROR" ]]; then
        echo "[$timestamp] [$level] $message" >> "$ERROR_LOG"
    fi
}

check_dependencies() {
    log_message "INFO" "🔍 Verificando dependencias del sistema..."
    
    # Verificar MySQL client (preferir XAMPP si está disponible)
    if command -v /Applications/XAMPP/xamppfiles/bin/mysqldump &> /dev/null; then
        MYSQLDUMP_CMD="/Applications/XAMPP/xamppfiles/bin/mysqldump"
        MYSQL_CMD="/Applications/XAMPP/xamppfiles/bin/mysql"
        log_message "INFO" "✅ Usando MySQL de XAMPP"
    elif command -v mysqldump &> /dev/null; then
        MYSQLDUMP_CMD="mysqldump"
        MYSQL_CMD="mysql"
        log_message "INFO" "✅ Usando MySQL del sistema"
    else
        log_message "ERROR" "mysqldump no está instalado o no está en el PATH"
        return 1
    fi
    
    # Verificar gzip
    if ! command -v gzip &> /dev/null; then
        log_message "ERROR" "gzip no está disponible para compresión"
        return 1
    fi
    
    # Verificar mail (opcional)
    if [[ "$EMAIL_ENABLED" == "true" ]] && ! command -v mail &> /dev/null; then
        log_message "WARN" "Comando 'mail' no disponible - emails desactivados"
        EMAIL_ENABLED="false"
    fi
    
    log_message "INFO" "✅ Todas las dependencias verificadas correctamente"
    return 0
}

create_directories() {
    log_message "INFO" "📁 Creando directorios necesarios..."
    
    # Crear directorio de backups
    if [[ ! -d "$BACKUP_DIR" ]]; then
        mkdir -p "$BACKUP_DIR"
        if [[ $? -eq 0 ]]; then
            log_message "INFO" "✅ Directorio de backups creado: $BACKUP_DIR"
        else
            log_message "ERROR" "❌ No se pudo crear directorio de backups: $BACKUP_DIR"
            return 1
        fi
    fi
    
    # Crear directorio de logs
    if [[ ! -d "$LOG_DIR" ]]; then
        mkdir -p "$LOG_DIR"
        if [[ $? -eq 0 ]]; then
            log_message "INFO" "✅ Directorio de logs creado: $LOG_DIR"
        else
            log_message "ERROR" "❌ No se pudo crear directorio de logs: $LOG_DIR"
            return 1
        fi
    fi
    
    return 0
}

test_database_connection() {
    log_message "INFO" "🔌 Probando conexión a la base de datos..."
    
    local mysql_cmd="$MYSQL_CMD -h$DB_HOST -P$DB_PORT -u$DB_USER"
    if [[ -n "$DB_PASSWORD" ]]; then
        mysql_cmd="$mysql_cmd -p$DB_PASSWORD"
    fi
    
    # Test de conexión
    if echo "SELECT 1;" | $mysql_cmd "$DB_NAME" &>/dev/null; then
        log_message "INFO" "✅ Conexión a MySQL exitosa"
        return 0
    else
        log_message "ERROR" "❌ No se pudo conectar a MySQL"
        log_message "ERROR" "   Host: $DB_HOST:$DB_PORT"
        log_message "ERROR" "   Database: $DB_NAME"
        log_message "ERROR" "   User: $DB_USER"
        return 1
    fi
}

get_database_size() {
    local mysql_cmd="$MYSQL_CMD -h$DB_HOST -P$DB_PORT -u$DB_USER"
    if [[ -n "$DB_PASSWORD" ]]; then
        mysql_cmd="$mysql_cmd -p$DB_PASSWORD"
    fi
    
    local size_query="SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 1) AS 'DB Size (MB)' 
                     FROM information_schema.tables 
                     WHERE table_schema='$DB_NAME';"
    
    echo "$size_query" | $mysql_cmd -N 2>/dev/null || echo "Unknown"
}

create_backup() {
    log_message "INFO" "🚀 Iniciando backup de la base de datos..."
    
    # Obtener tamaño de la base de datos
    local db_size=$(get_database_size)
    log_message "INFO" "📊 Tamaño actual de la base de datos: ${db_size} MB"
    
    # Construir comando mysqldump
    local dump_cmd="$MYSQLDUMP_CMD -h$DB_HOST -P$DB_PORT -u$DB_USER"
    if [[ -n "$DB_PASSWORD" ]]; then
        dump_cmd="$dump_cmd -p$DB_PASSWORD"
    fi
    
    # Opciones adicionales para backup completo
    dump_cmd="$dump_cmd --single-transaction --routines --triggers --events --add-drop-database --create-options"
    
    # Ruta completa del archivo de backup
    local backup_path="$BACKUP_DIR/$BACKUP_FILE"
    local backup_path_compressed="$BACKUP_DIR/$BACKUP_FILE_COMPRESSED"
    
    log_message "INFO" "💾 Ejecutando mysqldump..."
    log_message "INFO" "📂 Archivo destino: $backup_path_compressed"
    
    # Ejecutar backup con compresión en tiempo real
    if $dump_cmd "$DB_NAME" | gzip > "$backup_path_compressed"; then
        # Verificar que el archivo se creó y no está vacío
        if [[ -f "$backup_path_compressed" && -s "$backup_path_compressed" ]]; then
            local backup_size=$(du -k "$backup_path_compressed" | cut -f1)
            local backup_size_mb=$((backup_size / 1024))
            
            log_message "INFO" "✅ Backup creado exitosamente"
            log_message "INFO" "📁 Archivo: $backup_path_compressed"
            log_message "INFO" "📊 Tamaño comprimido: ${backup_size_mb} MB (${backup_size} KB)"
            
            # Verificar tamaños mínimos y máximos
            if [[ $backup_size -lt $MIN_BACKUP_SIZE_KB ]]; then
                log_message "WARN" "⚠️  Backup muy pequeño (< ${MIN_BACKUP_SIZE_KB}KB) - podría estar incompleto"
            fi
            
            if [[ $backup_size_mb -gt $MAX_BACKUP_SIZE_MB ]]; then
                log_message "WARN" "⚠️  Backup muy grande (> ${MAX_BACKUP_SIZE_MB}MB) - verificar espacio en disco"
            fi
            
            # Generar checksum MD5
            local checksum=$(md5 -q "$backup_path_compressed" 2>/dev/null || md5sum "$backup_path_compressed" 2>/dev/null | cut -d' ' -f1)
            log_message "INFO" "🔐 Checksum MD5: $checksum"
            
            return 0
        else
            log_message "ERROR" "❌ El archivo de backup está vacío o no se creó correctamente"
            return 1
        fi
    else
        log_message "ERROR" "❌ Error durante la ejecución de mysqldump"
        return 1
    fi
}

cleanup_old_backups() {
    log_message "INFO" "🧹 Limpiando backups antiguos (retención: ${RETENTION_DAYS} días)..."
    
    local deleted_count=0
    local total_size_freed=0
    
    # Buscar y eliminar archivos antiguos
    while IFS= read -r -d '' file; do
        local file_size=$(du -k "$file" | cut -f1)
        total_size_freed=$((total_size_freed + file_size))
        
        if rm "$file"; then
            deleted_count=$((deleted_count + 1))
            log_message "INFO" "🗑️  Eliminado: $(basename "$file")"
        else
            log_message "WARN" "⚠️  No se pudo eliminar: $file"
        fi
    done < <(find "$BACKUP_DIR" -name "${DB_NAME}_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -print0)
    
    if [[ $deleted_count -gt 0 ]]; then
        local freed_mb=$((total_size_freed / 1024))
        log_message "INFO" "✅ Limpieza completada: $deleted_count archivos eliminados"
        log_message "INFO" "💾 Espacio liberado: ${freed_mb} MB"
    else
        log_message "INFO" "✅ No hay backups antiguos para eliminar"
    fi
}

send_notification() {
    local status="$1"
    local message="$2"
    
    if [[ "$EMAIL_ENABLED" != "true" ]]; then
        log_message "INFO" "📧 Notificaciones email desactivadas"
        return 0
    fi
    
    local subject
    local body
    
    if [[ "$status" == "success" ]]; then
        subject="$EMAIL_SUBJECT_SUCCESS"
        body="Backup de MySQL completado exitosamente

📊 Detalles del backup:
• Base de datos: $DB_NAME
• Servidor: $DB_HOST:$DB_PORT
• Fecha y hora: $(date '+%Y-%m-%d %H:%M:%S')
• Archivo: $BACKUP_FILE_COMPRESSED
• Ubicación: $BACKUP_DIR

$message

✅ Estado: Backup completado sin errores
🔧 Sistema: $(hostname)
📧 Este es un mensaje automático del sistema de backups"
    else
        subject="$EMAIL_SUBJECT_ERROR"
        body="Error durante el backup de MySQL

❌ Detalles del error:
• Base de datos: $DB_NAME
• Servidor: $DB_HOST:$DB_PORT
• Fecha y hora: $(date '+%Y-%m-%d %H:%M:%S')

$message

🔧 Sistema: $(hostname)
📧 Este es un mensaje automático del sistema de backups"
    fi
    
    if echo "$body" | mail -s "$subject" "$EMAIL_TO" 2>>"$ERROR_LOG"; then
        log_message "INFO" "📧 Notificación enviada a: $EMAIL_TO"
    else
        log_message "WARN" "⚠️  No se pudo enviar notificación email"
    fi
}

show_backup_summary() {
    log_message "INFO" "📋 ===== RESUMEN DEL BACKUP ====="
    log_message "INFO" "🕒 Fecha: $(date '+%Y-%m-%d %H:%M:%S')"
    log_message "INFO" "🗄️  Base de datos: $DB_NAME"
    log_message "INFO" "🖥️  Servidor: $DB_HOST:$DB_PORT"
    log_message "INFO" "📁 Directorio: $BACKUP_DIR"
    
    # Mostrar archivos de backup recientes
    log_message "INFO" "📂 Backups recientes:"
    ls -lh "$BACKUP_DIR"/${DB_NAME}_backup_*.sql.gz 2>/dev/null | tail -5 | while read -r line; do
        log_message "INFO" "   $line"
    done
    
    # Mostrar espacio usado
    local total_size=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
    log_message "INFO" "💾 Espacio total usado por backups: $total_size"
    
    log_message "INFO" "================================="
}

# ============================== FUNCIÓN PRINCIPAL ==============================

main() {
    local start_time=$(date +%s)
    
    log_message "INFO" "🚀 ===== INICIANDO BACKUP DE MYSQL ====="
    log_message "INFO" "📅 Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
    log_message "INFO" "🌍 NODE_ENV: ${NODE_ENV:-'no definido'}"
    log_message "INFO" "🗄️  Base de datos: $DB_NAME"
    log_message "INFO" "🖥️  Servidor: $DB_HOST:$DB_PORT"
    log_message "INFO" "👤 Usuario: $DB_USER"
    log_message "INFO" "🔑 Password: $(if [[ -n "$DB_PASSWORD" ]]; then echo "***definido***"; else echo "NO DEFINIDO"; fi)"
    
    # Paso 1: Verificar dependencias
    if ! check_dependencies; then
        send_notification "error" "Error al verificar dependencias del sistema"
        exit 1
    fi
    
    # Paso 2: Crear directorios necesarios
    if ! create_directories; then
        send_notification "error" "Error al crear directorios necesarios"
        exit 1
    fi
    
    # Paso 3: Probar conexión a la base de datos
    if ! test_database_connection; then
        send_notification "error" "Error de conexión a la base de datos MySQL"
        exit 1
    fi
    
    # Paso 4: Crear backup
    if ! create_backup; then
        send_notification "error" "Error durante la creación del backup"
        exit 1
    fi
    
    # Paso 5: Limpiar backups antiguos
    cleanup_old_backups
    
    # Calcular tiempo total
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local duration_formatted=$(printf "%02d:%02d:%02d" $((duration/3600)) $((duration%3600/60)) $((duration%60)))
    
    log_message "INFO" "⏱️  Tiempo total: $duration_formatted"
    
    # Mostrar resumen
    show_backup_summary
    
    # Enviar notificación de éxito
    send_notification "success" "Backup completado en $duration_formatted segundos"
    
    log_message "INFO" "✅ ===== BACKUP COMPLETADO EXITOSAMENTE ====="
    
    return 0
}

# ============================== MANEJO DE ERRORES ==============================

# Trap para manejar interrupciones
trap 'log_message "WARN" "⚠️  Backup interrumpido por el usuario"; exit 130' INT TERM

# Ejecutar función principal si el script se ejecuta directamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi