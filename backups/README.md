# Sistema de Backups MySQL - LujanDev E-commerce

## 📁 Estructura de Directorios

```
/api/backups/
├── mysql/           # Archivos de backup comprimidos (.sql.gz)
├── logs/            # Logs de ejecución y errores
└── README.md        # Esta documentación
```

## 🛠️ Scripts Disponibles

### `/api/scripts/backup-database.sh`
- **Propósito**: Backup automático completo de MySQL con compresión
- **Características**:
  - ✅ Backup completo con estructura y datos
  - ✅ Compresión gzip automática
  - ✅ Verificación de integridad (MD5 checksum)
  - ✅ Retención automática (30 días)
  - ✅ Logging detallado con timestamps
  - ✅ Compatible con XAMPP MySQL

### `/api/scripts/restore-database.sh`
- **Propósito**: Restauración interactiva de backups
- **Características**:
  - ✅ Interfaz interactiva para seleccionar backup
  - ✅ Verificación de restauración
  - ✅ Descompresión automática

### `/api/scripts/setup-backup-cron.sh`
- **Propósito**: Configuración de cron job para backups automáticos
- **Programación**: Diario a las 2:00 AM

## ⚙️ Configuración

### Variables de Entorno
```bash
DB_HOST=localhost
DB_PORT=3306  
DB_NAME=ecommercedb
DB_USER=root
DB_PASSWORD=
EMAIL_ENABLED=false
```

### Cron Job Configurado
```cron
0 2 * * * DB_HOST=localhost DB_PORT=3306 DB_NAME=ecommercedb DB_USER=root DB_PASSWORD= EMAIL_ENABLED=false /path/to/backup-database.sh >> /api/backups/logs/cron-backup.log 2>&1
```

## 📊 Información de Backups

- **Base de datos**: ecommercedb (21.3 MB)
- **Compresión**: ~95% (1.1 MB comprimido)
- **Tiempo promedio**: 1-2 segundos
- **Retención**: 30 días automático
- **Formato**: SQL comprimido con gzip

## 🔧 Uso Manual

### Crear Backup
```bash
cd /api
export DB_HOST="localhost" DB_PORT="3306" DB_NAME="ecommercedb" DB_USER="root" DB_PASSWORD=""
./scripts/backup-database.sh
```

### Restaurar Backup
```bash
cd /api
./scripts/restore-database.sh
```

### Ver Logs
```bash
# Logs de backup manual
tail -f /api/backups/logs/backup_*.log

# Logs de cron job
tail -f /api/backups/logs/cron-backup.log
```

## 📈 Monitoreo

### Verificar Backups Recientes
```bash
ls -lht /api/backups/mysql/ | head -5
```

### Verificar Cron Jobs
```bash
crontab -l | grep backup
```

### Espacio Usado
```bash
du -sh /api/backups/
```

## 🔒 Seguridad

- ✅ Backups almacenados dentro de `/api/` para mejor control de permisos
- ✅ Logs centralizados para auditoria
- ✅ Verificación de integridad con checksums MD5
- ✅ Compatible con XAMPP (rutas automáticas)

## 📝 Notas Importantes

1. **XAMPP Dependency**: El sistema detecta automáticamente si XAMPP está disponible
2. **Retención**: Los backups se eliminan automáticamente después de 30 días
3. **Logs**: Cada backup genera un log individual con timestamp
4. **Cron Job**: Requiere que XAMPP esté ejecutándose a las 2:00 AM

---
**Última actualización**: 5 de diciembre de 2025  
**Versión del script**: 2.0  
**Estado**: ✅ Funcionando correctamente