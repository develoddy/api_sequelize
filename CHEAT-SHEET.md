# 📚 COMANDOS RÁPIDOS - SISTEMA DE MONITOREO ENTERPRISE

## 🚀 Instalación y Setup

```bash
# Instalación completa automática
bash scripts/install-monitoring.sh

# Configurar alertas
cp .env.monitoring.example .env.monitoring
nano .env.monitoring

# Probar sistema completo
bash scripts/test-alerts.sh
```

## 🔧 Ejecución Manual

```bash
# Básico
bash scripts/checkProductionHealth.sh

# Verbose (más detalles)
bash scripts/checkProductionHealth.sh --verbose

# Con notificaciones (Email + Slack)
bash scripts/checkProductionHealth.sh --notify

# Solo alertas (sin output normal)
bash scripts/checkProductionHealth.sh --alert

# Export JSON personalizado
bash scripts/checkProductionHealth.sh --json custom-report.json

# Combinación completa
bash scripts/checkProductionHealth.sh --verbose --notify --json report.json
```

## ⏰ Cron Jobs

```bash
# Ver cron jobs instalados
crontab -l

# Editar cron jobs
crontab -e

# Eliminar todos los cron jobs
crontab -r

# Ejemplos de configuración:

# Cada hora
0 * * * * cd /var/www/api_sequelize && bash scripts/checkProductionHealth.sh --notify >> logs/cron.log 2>&1

# Cada 30 minutos
*/30 * * * * cd /var/www/api_sequelize && bash scripts/checkProductionHealth.sh >> logs/cron.log 2>&1

# Cada 15 minutos
*/15 * * * * cd /var/www/api_sequelize && bash scripts/checkProductionHealth.sh --alert --notify >> logs/cron.log 2>&1

# Cada 6 horas
0 */6 * * * cd /var/www/api_sequelize && bash scripts/checkProductionHealth.sh --verbose >> logs/cron.log 2>&1

# Diario a medianoche
0 0 * * * cd /var/www/api_sequelize && bash scripts/checkProductionHealth.sh --notify >> logs/cron.log 2>&1
```

## 📊 Ver Logs

```bash
# Ver log más reciente
ls -t logs/health-check-*.log | head -1 | xargs cat

# Ver últimas 50 líneas del último log
ls -t logs/health-check-*.log | head -1 | xargs tail -50

# Ver logs del cron en tiempo real
tail -f logs/cron.log

# Ver todos los logs
ls -lh logs/

# Ver log comprimido
zcat logs/health-check-20251201-120000.log.gz

# Buscar errores
grep ERROR logs/*.log

# Buscar warnings
grep WARN logs/*.log

# Buscar por fecha específica
grep "2025-12-02" logs/*.log
```

## 📈 Ver Métricas JSON

```bash
# Ver último JSON
cat metrics/latest.json | jq

# Ver summary
cat metrics/latest.json | jq '.summary'

# Ver health score
cat metrics/latest.json | jq '.summary.success_rate'

# Ver latencias
cat metrics/latest.json | jq '.api.latency_ms, .admin.latency_ms, .ecommerce.latency_ms'

# Ver recursos del servidor
cat metrics/latest.json | jq '.server'

# Ver alertas
cat metrics/latest.json | jq '.alerts'

# Listar todas las métricas históricas
ls -lh metrics/

# Ver métricas de fecha específica
cat metrics/health-20251202-140000.json | jq
```

## 🔄 Logrotate

```bash
# Rotar logs manualmente
logrotate -f scripts/logrotate.conf

# Instalar en sistema (requiere sudo)
sudo cp scripts/logrotate.conf /etc/logrotate.d/health-check

# Ver configuración actual
cat scripts/logrotate.conf

# Forzar rotación de todos los logs
sudo logrotate -f /etc/logrotate.conf

# Ver estado de logrotate
sudo cat /var/lib/logrotate/status | grep health
```

## 🧪 Testing y Validación

```bash
# Probar configuración completa
bash scripts/test-alerts.sh

# Probar solo script principal
bash scripts/checkProductionHealth.sh --verbose

# Validar JSON generado
cat metrics/latest.json | jq . > /dev/null && echo "✅ JSON válido" || echo "❌ JSON inválido"

# Probar email manualmente (editar con tus datos)
echo "Subject: Test" | curl --url "smtp://smtp.gmail.com:587" \
  --mail-from "tu-correo@gmail.com" \
  --mail-rcpt "destino@gmail.com" \
  --user "tu-correo@gmail.com:password" \
  --upload-file - \
  --ssl-reqd

# Probar Slack webhook
curl -X POST "https://hooks.slack.com/services/YOUR/WEBHOOK/URL" \
  -H "Content-Type: application/json" \
  -d '{"text":"Test desde curl"}'
```

## 📱 Dashboard

```bash
# Acceder al dashboard
open https://api.lujandev.com/dashboard.html

# Ver código fuente
cat public/dashboard.html

# Servir localmente para testing
cd public && python3 -m http.server 8000
# Acceder: http://localhost:8000/dashboard.html
```

## 🔐 PM2

```bash
# Ver procesos PM2
pm2 list

# Ver logs de PM2
pm2 logs api_sequelize

# Ver info detallada
pm2 show api_sequelize

# Resetear contador de restarts
pm2 reset api_sequelize

# Reiniciar proceso
pm2 restart api_sequelize

# Ver monitoreo en tiempo real
pm2 monit
```

## 🗑️ Limpieza y Mantenimiento

```bash
# Limpiar logs antiguos (> 30 días)
find logs/ -name "*.log" -mtime +30 -delete

# Limpiar logs comprimidos (> 30 días)
find logs/ -name "*.log.gz" -mtime +30 -delete

# Limpiar métricas JSON antiguas (> 7 días)
find metrics/ -name "health-*.json" -mtime +7 -delete

# Ver espacio ocupado por logs
du -sh logs/

# Ver espacio ocupado por métricas
du -sh metrics/

# Limpiar todo (CUIDADO)
rm -rf logs/*.log logs/*.gz metrics/health-*.json
```

## 🔧 Troubleshooting

```bash
# Validar dependencias instaladas
command -v curl && echo "✅ curl" || echo "❌ curl"
command -v jq && echo "✅ jq" || echo "❌ jq"
command -v bc && echo "✅ bc" || echo "❌ bc"
command -v openssl && echo "✅ openssl" || echo "❌ openssl"

# Verificar conectividad a servicios
curl -I https://api.lujandev.com
curl -I https://admin.lujandev.com
curl -I https://tienda.lujandev.com

# Verificar endpoint de health
curl https://api.lujandev.com/api/health | jq

# Verificar SSL
echo | openssl s_client -servername api.lujandev.com -connect api.lujandev.com:443 2>/dev/null | openssl x509 -noout -dates

# Ver variables de entorno de PM2
pm2 env 0

# Verificar permisos
ls -lh scripts/*.sh
```

## 📦 Backup y Restore

```bash
# Backup de configuración
tar -czf monitoring-backup-$(date +%Y%m%d).tar.gz \
  scripts/ \
  logs/ \
  metrics/ \
  .env.monitoring \
  public/dashboard.html

# Backup solo configuración y scripts
tar -czf monitoring-config-$(date +%Y%m%d).tar.gz \
  scripts/*.sh \
  scripts/*.conf \
  .env.monitoring

# Restore
tar -xzf monitoring-backup-20251202.tar.gz

# Listar backups
ls -lh monitoring-backup-*.tar.gz
```

## 🚀 Deployment a Producción

```bash
# 1. Subir archivos al servidor
scp -r scripts/ .env.monitoring.example public/dashboard.html root@your-server:/var/www/api_sequelize/

# 2. Conectar al servidor
ssh root@your-server

# 3. Navegar al proyecto
cd /var/www/api_sequelize

# 4. Ejecutar instalador
bash scripts/install-monitoring.sh

# 5. Configurar alertas
cp .env.monitoring.example .env.monitoring
nano .env.monitoring

# 6. Probar
bash scripts/test-alerts.sh

# 7. Verificar cron
crontab -l
```

## 🔗 URLs Importantes

```bash
# Dashboard
https://api.lujandev.com/dashboard.html

# Métricas JSON
https://api.lujandev.com/metrics/latest.json

# Health endpoint
https://api.lujandev.com/api/health

# Documentación
cat scripts/README.md
cat QUICK-START-MONITORING.md
cat ENTERPRISE-MONITORING-SUMMARY.md
```

## 💡 Tips y Trucos

```bash
# Alias útiles (añadir a ~/.bashrc o ~/.zshrc)
alias health="cd /var/www/api_sequelize && bash scripts/checkProductionHealth.sh"
alias health-verbose="cd /var/www/api_sequelize && bash scripts/checkProductionHealth.sh --verbose"
alias health-notify="cd /var/www/api_sequelize && bash scripts/checkProductionHealth.sh --notify"
alias health-logs="tail -f /var/www/api_sequelize/logs/cron.log"
alias health-metrics="cat /var/www/api_sequelize/metrics/latest.json | jq"

# Ver health score rápido
cat metrics/latest.json | jq -r '.summary.success_rate + "% - " + (.summary.failed > 0 | if . then "❌ FAILED" elif (.summary.warnings > 0) then "⚠️  WARNINGS" else "✅ OK" end)'

# Crear función para alertas personalizadas
alert_if_unhealthy() {
  SCORE=$(cat metrics/latest.json | jq -r '.summary.success_rate')
  if (( $(echo "$SCORE < 95" | bc -l) )); then
    echo "⚠️  Health Score bajo: $SCORE%"
    # Enviar alerta personalizada aquí
  fi
}

# Monitoreo continuo
watch -n 30 'bash scripts/checkProductionHealth.sh --alert'
```

---

**Última actualización:** 2 de Diciembre de 2025  
**Versión:** 3.0.0 - Enterprise Edition
