#!/bin/bash

################################################################################
# Configuración de Cron Job para Backups Automáticos de MySQL
# Script: setup-backup-cron.sh
# Descripción: Configura cron job para ejecutar backups diarios de MySQL
# Autor: LujanDev Team
################################################################################

echo "🚀 Configurando Cron Job para Backups Automáticos de MySQL..."

# Ruta absoluta al script de backup
BACKUP_SCRIPT="/Volumes/lujandev/dev/projects/ECOMMERCE/ECOMMERCE-MEAN/api/scripts/backup-database.sh"
LOG_FILE="/Volumes/lujandev/dev/projects/ECOMMERCE/ECOMMERCE-MEAN/api/backups/logs/cron-backup.log"

# Verificar que el script existe
if [[ ! -f "$BACKUP_SCRIPT" ]]; then
    echo "❌ Error: Script de backup no encontrado en $BACKUP_SCRIPT"
    exit 1
fi

# Crear directorio de logs si no existe
mkdir -p "$(dirname "$LOG_FILE")"

# Variables de entorno para el cron job
ENV_VARS="DB_HOST=localhost DB_PORT=3306 DB_NAME=ecommercedb DB_USER=root DB_PASSWORD= EMAIL_ENABLED=false"

# Entrada del cron job (ejecutar todos los días a las 2:00 AM)
CRON_ENTRY="0 2 * * * $ENV_VARS $BACKUP_SCRIPT >> $LOG_FILE 2>&1"

echo "📅 Programación: Todos los días a las 2:00 AM"
echo "📁 Script: $BACKUP_SCRIPT"
echo "📝 Log: $LOG_FILE"

# Mostrar crontab actual
echo ""
echo "🔍 Crontab actual:"
crontab -l 2>/dev/null || echo "   (Sin entradas de cron configuradas)"

echo ""
echo "➕ Nueva entrada de cron que se agregará:"
echo "   $CRON_ENTRY"

echo ""
read -p "¿Deseas agregar esta entrada al crontab? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Hacer backup del crontab actual
    crontab -l > /tmp/crontab_backup_$(date +%Y%m%d_%H%M%S) 2>/dev/null
    
    # Agregar nueva entrada al crontab
    (crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -
    
    if [[ $? -eq 0 ]]; then
        echo "✅ Cron job configurado exitosamente"
        echo ""
        echo "📋 Crontab actualizado:"
        crontab -l | grep -E "(backup|mysql)" --color=never
        
        echo ""
        echo "ℹ️  Para verificar el estado del cron job:"
        echo "   - Ver logs: tail -f $LOG_FILE"
        echo "   - Listar cron jobs: crontab -l"
        echo "   - Ejecutar backup manual: $BACKUP_SCRIPT"
        
        echo ""
        echo "⚠️  Nota: Asegúrate de que XAMPP esté ejecutándose cuando se ejecute el cron job"
        echo "   Si XAMPP no se inicia automáticamente, considera agregarlo al startup del sistema"
    else
        echo "❌ Error al configurar el cron job"
        exit 1
    fi
else
    echo "⏭️  Configuración de cron job cancelada"
    echo ""
    echo "💡 Para configurar manualmente:"
    echo "   1. Ejecuta: crontab -e"
    echo "   2. Agrega la línea: $CRON_ENTRY"
    echo "   3. Guarda y sal del editor"
fi