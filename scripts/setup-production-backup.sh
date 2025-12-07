#!/bin/bash

# =================================================================
# Script de Configuración de Backups para Producción v2.0
# =================================================================
# Este script configura automáticamente los backups de MySQL
# tanto para desarrollo local como para producción.
# 
# Uso:
#   bash setup-production-backup.sh
#
# Características:
#   - Detecta automáticamente el archivo de entorno (.env.production, .env.development, .env)
#   - Configura variables de entorno apropiadas
#   - Instala dependencias necesarias
#   - Configura cron jobs con horarios optimizados
#   - Previene duplicados en cron automáticamente
#   - Crea estructura de directorios y logs
# =================================================================

set -e  # Salir en caso de error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUPS_DIR="$PROJECT_DIR/backups"
MYSQL_BACKUPS_DIR="$BACKUPS_DIR/mysql"
LOGS_DIR="$BACKUPS_DIR/logs"
ENV_FILE=""

# Funciones de utilidad
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Detectar el entorno
detect_environment() {
    if [[ "$NODE_ENV" == "production" ]] || [[ "$NODE_ENV" == "prod" ]]; then
        echo "production"
    elif [[ -n "$PM2_HOME" ]] || [[ -n "$PRODUCTION" ]]; then
        echo "production"
    elif [[ "$USER" == "root" ]] || [[ "$USER" == "ubuntu" ]] || [[ "$USER" == "ec2-user" ]]; then
        echo "production"
    elif [[ "$HOSTNAME" == *"prod"* ]] || [[ "$HOSTNAME" == *"server"* ]]; then
        echo "production"
    else
        echo "development"
    fi
}

# Verificar dependencias del sistema
check_system_dependencies() {
    log_info "Verificando dependencias del sistema..."
    
    # Verificar MySQL/MariaDB
    if ! command -v mysql &> /dev/null && ! command -v mariadb &> /dev/null; then
        log_error "MySQL o MariaDB no está instalado"
        return 1
    fi
    
    # Verificar mysqldump
    if ! command -v mysqldump &> /dev/null; then
        log_error "mysqldump no está disponible"
        return 1
    fi
    
    # Verificar cron
    if ! command -v crontab &> /dev/null; then
        log_error "cron no está instalado"
        return 1
    fi
    
    # Verificar gzip
    if ! command -v gzip &> /dev/null; then
        log_error "gzip no está instalado"
        return 1
    fi
    
    log_success "Todas las dependencias están disponibles"
    return 0
}

# Detectar y seleccionar archivo de entorno
detect_env_file() {
    log_info "Detectando archivo de entorno..."
    
    # Orden de prioridad para archivos de entorno
    local env_files=(
        "$PROJECT_DIR/.env.production"
        "$PROJECT_DIR/.env.development" 
        "$PROJECT_DIR/.env"
    )
    
    for file in "${env_files[@]}"; do
        if [[ -f "$file" ]]; then
            ENV_FILE="$file"
            log_success "Archivo de entorno detectado: $(basename "$file")"
            return 0
        fi
    done
    
    log_error "No se encontró ningún archivo de entorno"
    log_error "Se buscaron: .env.production, .env.development, .env"
    return 1
}

# Leer configuración de la base de datos
read_database_config() {
    log_info "Leyendo configuración de la base de datos..."
    
    if [[ ! -f "$ENV_FILE" ]]; then
        log_error "Archivo de entorno no encontrado en: $ENV_FILE"
        return 1
    fi
    
    # Leer variables del archivo .env
    source "$ENV_FILE"
    
    # Verificar variables necesarias
    if [[ -z "$DB_HOST" ]] || [[ -z "$DB_NAME" ]] || [[ -z "$DB_USER" ]]; then
        log_error "Variables de base de datos no configuradas correctamente"
        log_error "Requeridas: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD"
        log_error "Archivo usado: $ENV_FILE"
        return 1
    fi
    
    log_success "Configuración de base de datos leída correctamente"
    log_info "Base de datos: $DB_NAME en $DB_HOST"
    log_info "Usuario: $DB_USER"
    log_info "Archivo: $(basename "$ENV_FILE")"
    return 0
}

# Crear estructura de directorios
create_directory_structure() {
    log_info "Creando estructura de directorios..."
    
    directories=(
        "$BACKUPS_DIR"
        "$MYSQL_BACKUPS_DIR"
        "$LOGS_DIR"
    )
    
    for dir in "${directories[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            log_success "Creado: $dir"
        else
            log_info "Existe: $dir"
        fi
    done
    
    # Establecer permisos apropiados
    chmod 755 "$BACKUPS_DIR"
    chmod 750 "$MYSQL_BACKUPS_DIR"  # Más restrictivo para backups
    chmod 755 "$LOGS_DIR"
    
    log_success "Estructura de directorios configurada"
}

# Crear script de backup optimizado para producción
create_backup_script() {
    local env_type="$1"
    log_info "Creando script de backup para entorno: $env_type"
    
    local backup_script="$SCRIPT_DIR/backup-database.sh"
    
    cat > "$backup_script" << 'EOF'
#!/bin/bash

# =================================================================
# Script de Backup Automático de MySQL - Versión Producción
# =================================================================

set -euo pipefail  # Modo estricto

# Configuración
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUPS_DIR="$PROJECT_DIR/backups/mysql"
LOGS_DIR="$PROJECT_DIR/backups/logs"
LOG_FILE="$LOGS_DIR/cron-backup.log"

# Detectar y cargar variables de entorno
ENV_FILE=""
ENV_FILES=(
    "$PROJECT_DIR/.env.production"
    "$PROJECT_DIR/.env.development" 
    "$PROJECT_DIR/.env"
)

for file in "${ENV_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        ENV_FILE="$file"
        source "$ENV_FILE"
        break
    fi
done

if [[ -z "$ENV_FILE" ]]; then
    log_message "ERROR" "No se encontró archivo de entorno (.env.production, .env.development, .env)"
    exit 1
fi

# Función de logging con timestamp
log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    # También mostrar en consola si se ejecuta manualmente
    if [[ -t 1 ]]; then
        echo "[$timestamp] [$level] $message"
    fi
}

# Función principal de backup
perform_backup() {
    local start_time=$(date '+%Y-%m-%d %H:%M:%S')
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local filename="backup_${DB_NAME}_${timestamp}.sql.gz"
    local filepath="$BACKUPS_DIR/$filename"
    
    log_message "INFO" "=== INICIANDO BACKUP AUTOMÁTICO ==="
    log_message "INFO" "Base de datos: $DB_NAME"
    log_message "INFO" "Archivo destino: $filename"
    
    # Verificar conexión a la base de datos
    if ! mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" "$DB_NAME" &>/dev/null; then
        log_message "ERROR" "No se puede conectar a la base de datos"
        return 1
    fi
    
    # Realizar backup con mysqldump optimizado
    log_message "INFO" "Ejecutando mysqldump..."
    if mysqldump \
        --host="$DB_HOST" \
        --user="$DB_USER" \
        --password="$DB_PASSWORD" \
        --single-transaction \
        --routines \
        --triggers \
        --events \
        --add-drop-database \
        --create-options \
        --disable-keys \
        --extended-insert \
        --quick \
        --lock-tables=false \
        "$DB_NAME" | gzip > "$filepath"; then
        
        local file_size=$(du -h "$filepath" | cut -f1)
        log_message "SUCCESS" "Backup completado exitosamente"
        log_message "INFO" "Tamaño del archivo: $file_size"
        log_message "INFO" "Ubicación: $filepath"
    else
        log_message "ERROR" "Falló la creación del backup"
        # Limpiar archivo parcial si existe
        [[ -f "$filepath" ]] && rm -f "$filepath"
        return 1
    fi
    
    # Limpiar backups antiguos (mantener últimos 7 días)
    log_message "INFO" "Limpiando backups antiguos..."
    local deleted_count=0
    while IFS= read -r -d '' old_backup; do
        rm -f "$old_backup"
        ((deleted_count++))
        log_message "INFO" "Eliminado backup antiguo: $(basename "$old_backup")"
    done < <(find "$BACKUPS_DIR" -name "backup_*.sql.gz" -type f -mtime +7 -print0)
    
    if [[ $deleted_count -gt 0 ]]; then
        log_message "INFO" "Se eliminaron $deleted_count backups antiguos"
    else
        log_message "INFO" "No hay backups antiguos para eliminar"
    fi
    
    local end_time=$(date '+%Y-%m-%d %H:%M:%S')
    log_message "INFO" "Backup completado en: $start_time - $end_time"
    log_message "INFO" "=== BACKUP AUTOMÁTICO FINALIZADO ==="
    
    return 0
}

# Función principal
main() {
    # Verificar que el directorio de logs existe
    mkdir -p "$LOGS_DIR"
    
    # Verificar variables de entorno necesarias
    if [[ -z "${DB_HOST:-}" ]] || [[ -z "${DB_NAME:-}" ]] || [[ -z "${DB_USER:-}" ]] || [[ -z "${DB_PASSWORD:-}" ]]; then
        log_message "ERROR" "Variables de base de datos no configuradas"
        log_message "ERROR" "Requeridas: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD"
        exit 1
    fi
    
    # Verificar que el directorio de backups existe
    mkdir -p "$BACKUPS_DIR"
    
    # Ejecutar backup
    if perform_backup; then
        log_message "SUCCESS" "Proceso de backup completado exitosamente"
        exit 0
    else
        log_message "ERROR" "Proceso de backup falló"
        exit 1
    fi
}

# Ejecutar función principal
main "$@"
EOF

    chmod +x "$backup_script"
    log_success "Script de backup creado: $backup_script"
}

# Limpiar duplicados en el cron
cleanup_cron_duplicates() {
    log_info "Verificando y limpiando duplicados en cron..."
    
    local backup_pattern="backup-database.sh"
    local temp_cron=$(mktemp)
    
    # Obtener cron actual
    if ! crontab -l 2>/dev/null > "$temp_cron"; then
        log_info "No hay cron jobs existentes"
        rm -f "$temp_cron"
        return 0
    fi
    
    # Contar entradas de backup existentes
    local duplicate_count=$(grep -c "$backup_pattern" "$temp_cron" 2>/dev/null || echo "0")
    
    if [[ $duplicate_count -gt 1 ]]; then
        log_warning "Se encontraron $duplicate_count entradas duplicadas de backup"
        
        # Crear nuevo cron sin las entradas de backup
        local clean_cron=$(mktemp)
        grep -v "$backup_pattern" "$temp_cron" > "$clean_cron"
        
        # Instalar el cron limpio
        crontab "$clean_cron"
        
        log_success "Se eliminaron $((duplicate_count)) entradas duplicadas"
        
        rm -f "$clean_cron"
    elif [[ $duplicate_count -eq 1 ]]; then
        log_info "Se encontró 1 entrada de backup existente (será reemplazada)"
        
        # Eliminar la entrada existente
        grep -v "$backup_pattern" "$temp_cron" | crontab -
    else
        log_info "No se encontraron entradas de backup en cron"
    fi
    
    rm -f "$temp_cron"
}

# Configurar cron job según el entorno
configure_cron_job() {
    local env_type="$1"
    log_info "Configurando cron job para entorno: $env_type"
    
    local backup_script="$SCRIPT_DIR/backup-database.sh"
    local cron_schedule="0 2 * * *"  # Siempre a las 2:00 AM
    
    log_info "Horario configurado: Diario a las 2:00 AM"
    
    # Limpiar duplicados primero
    cleanup_cron_duplicates
    
    # Crear entrada de cron con variables de entorno
    local cron_entry="$cron_schedule cd \"$PROJECT_DIR\" && /bin/bash \"$backup_script\" >> \"$LOGS_DIR/cron-backup.log\" 2>&1"
    
    # Agregar nueva entrada
    (crontab -l 2>/dev/null; echo "$cron_entry") | crontab -
    
    log_success "Cron job configurado exitosamente"
    log_info "Programa: $cron_schedule (2:00 AM diario)"
    log_info "Script: $backup_script"
    log_info "Logs: $LOGS_DIR/cron-backup.log"
}

# Función principal
main() {
    echo ""
    log_info "=== CONFIGURADOR DE BACKUPS PARA PRODUCCIÓN v2.0 ==="
    echo ""
    
    # Detectar archivo de entorno
    if ! detect_env_file; then
        log_error "No se pudo detectar archivo de entorno"
        exit 1
    fi
    
    # Detectar entorno
    local environment=$(detect_environment)
    log_info "Entorno detectado: $environment"
    
    # Verificar dependencias
    if ! check_system_dependencies; then
        log_error "Dependencias del sistema faltantes. Por favor instálalas e intenta nuevamente."
        exit 1
    fi
    
    # Leer configuración de base de datos
    if ! read_database_config; then
        log_error "No se pudo leer la configuración de la base de datos"
        exit 1
    fi
    
    # Crear estructura de directorios
    create_directory_structure
    
    # Crear script de backup
    create_backup_script "$environment"
    
    # Configurar cron job
    configure_cron_job "$environment"
    
    # Crear archivo de log inicial
    touch "$LOGS_DIR/cron-backup.log"
    chmod 644 "$LOGS_DIR/cron-backup.log"
    
    # Resumen final
    echo ""
    log_success "=== CONFIGURACIÓN COMPLETADA ==="
    log_success "✅ Backups automáticos configurados correctamente"
    log_info "🗂️  Archivo de entorno: $(basename "$ENV_FILE")"
    log_info "🗄️  Base de datos: $DB_NAME en $DB_HOST"
    log_info "📁 Directorio de backups: $MYSQL_BACKUPS_DIR"
    log_info "📋 Archivo de logs: $LOGS_DIR/cron-backup.log"
    log_info "⏰ Horario: Diario a las 2:00 AM"
    log_info "🗑️  Retención: 7 días automática"
    log_info "🧹 Duplicados en cron: Prevenidos automáticamente"
    
    echo ""
    log_info "Comandos útiles:"
    echo ""
    log_info "📊 Verificar cron job:"
    echo "  crontab -l | grep backup-database"
    echo ""
    log_info "📋 Ver logs en tiempo real:"
    echo "  tail -f $LOGS_DIR/cron-backup.log"
    echo ""
    log_info "🚀 Ejecutar backup manual:"
    echo "  bash $SCRIPT_DIR/backup-database.sh"
    echo ""
    log_info "📂 Ver backups creados:"
    echo "  ls -la $MYSQL_BACKUPS_DIR/"
    echo ""
}

# Ejecutar función principal
main "$@"