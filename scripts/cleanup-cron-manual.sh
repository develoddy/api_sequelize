#!/bin/bash

# Script de limpieza manual de duplicados en cron
echo "=== LIMPIEZA MANUAL DE CRON DUPLICADOS ==="

echo "Entradas actuales:"
crontab -l | grep backup-database | wc -l

echo "Creando backup del crontab actual..."
crontab -l > /tmp/crontab_backup_$(date +%Y%m%d_%H%M%S).txt

echo "Limpiando duplicados..."
(crontab -l | grep -v backup-database; crontab -l | grep backup-database | head -1) | crontab -

echo "Verificando resultado:"
echo "Entradas después de limpieza:"
crontab -l | grep backup-database | wc -l

echo "Contenido:"
crontab -l | grep backup-database

echo "=== LIMPIEZA COMPLETADA ==="