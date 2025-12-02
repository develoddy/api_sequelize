# 🚀 GUÍA RÁPIDA DE DESPLIEGUE - ENTERPRISE MONITORING

## Instalación en 5 Minutos

### 1️⃣ Subir Archivos al Servidor

```bash
# Desde tu máquina local
cd /Volumes/lujandev/dev/projects/ECOMMERCE/ECOMMERCE-MEAN/api

# Subir scripts al servidor
scp scripts/checkProductionHealth.sh root@your-server:/var/www/api_sequelize/scripts/
scp scripts/install-monitoring.sh root@your-server:/var/www/api_sequelize/scripts/
scp scripts/logrotate.conf root@your-server:/var/www/api_sequelize/scripts/
scp .env.monitoring.example root@your-server:/var/www/api_sequelize/

# Subir dashboard
scp public/dashboard.html root@your-server:/var/www/api_sequelize/public/
```

### 2️⃣ Ejecutar Instalador Automático

```bash
# Conectar al servidor
ssh root@your-server

# Navegar al proyecto
cd /var/www/api_sequelize

# Dar permisos de ejecución
chmod +x scripts/*.sh

# Ejecutar instalador
bash scripts/install-monitoring.sh

# El instalador te preguntará:
# - Intervalo de ejecución (recomendado: cada hora)
# - ¿Activar notificaciones? (recomendado: Sí)
```

### 3️⃣ Configurar Alertas (Opcional pero Recomendado)

```bash
# Copiar archivo de ejemplo
cp .env.monitoring.example .env.monitoring

# Editar configuración
nano .env.monitoring
```

**Para Gmail:**
```bash
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-correo@gmail.com
SMTP_PASS=abcd1234efgh5678  # Contraseña de aplicación
ALERT_EMAIL=admin@lujandev.com
```

**Para Slack:**
```bash
SLACK_ENABLED=true
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 4️⃣ Configurar Dashboard (Opcional)

```bash
# Editar routes para servir JSON
nano src/routes/index.js
```

Añadir esta ruta:

```javascript
// Health Metrics para Dashboard
app.get('/metrics/latest.json', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const metricsFile = path.join(__dirname, '../../metrics/latest.json');
  
  if (fs.existsSync(metricsFile)) {
    const data = fs.readFileSync(metricsFile, 'utf8');
    res.json(JSON.parse(data));
  } else {
    res.status(404).json({ error: 'Metrics not found' });
  }
});
```

Reiniciar PM2:
```bash
pm2 restart api_sequelize
```

Acceder al dashboard:
```
https://api.lujandev.com/dashboard.html
```

### 5️⃣ Verificar Instalación

```bash
# Ejecutar manualmente con notificaciones
bash scripts/checkProductionHealth.sh --verbose --notify

# Ver cron instalado
crontab -l

# Ver logs
tail -f logs/cron.log

# Ver métricas JSON
cat metrics/latest.json | jq
```

## ✅ Checklist de Validación

- [ ] Script ejecuta correctamente
- [ ] Cron job instalado (`crontab -l`)
- [ ] Logs se generan en `logs/`
- [ ] Métricas JSON se exportan a `metrics/latest.json`
- [ ] Dashboard accesible (si configurado)
- [ ] Notificaciones funcionan (si activadas)
- [ ] Logrotate configurado

## 🎯 Casos de Uso

### Desarrollo/Testing
```bash
# Ejecutar localmente sin notificaciones
bash scripts/checkProductionHealth.sh --verbose
```

### Staging
```bash
# Cron cada 30 minutos sin alertas
*/30 * * * * cd /var/www/api_sequelize && bash scripts/checkProductionHealth.sh >> logs/cron.log 2>&1
```

### Producción
```bash
# Cron cada hora con alertas automáticas
0 * * * * cd /var/www/api_sequelize && bash scripts/checkProductionHealth.sh --notify >> logs/cron.log 2>&1
```

## 🆘 Solución de Problemas

### ❌ "Dependencias faltantes"
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y bc jq openssl curl

# CentOS/RHEL
sudo yum install -y bc jq openssl curl
```

### ❌ "Permission denied"
```bash
chmod +x scripts/checkProductionHealth.sh
chmod +x scripts/install-monitoring.sh
```

### ❌ "Cron no ejecuta"
```bash
# Ver logs del sistema
sudo tail -f /var/log/syslog | grep CRON

# Verificar cron instalado
crontab -l

# Probar manualmente
cd /var/www/api_sequelize && bash scripts/checkProductionHealth.sh
```

### ❌ "Email no se envía"
```bash
# Verificar configuración
cat .env.monitoring

# Probar curl SMTP
curl --url "smtp://smtp.gmail.com:587" \
  --mail-from "tu-correo@gmail.com" \
  --mail-rcpt "destino@gmail.com" \
  --user "tu-correo@gmail.com:contraseña-app" \
  --upload-file test.txt \
  --ssl-reqd

# Verificar que Gmail permite "Aplicaciones menos seguras"
# O usa contraseña de aplicación:
# https://myaccount.google.com/apppasswords
```

### ❌ "Dashboard no muestra datos"
```bash
# Verificar que existe el JSON
ls -lh metrics/latest.json

# Verificar contenido
cat metrics/latest.json | jq

# Verificar ruta en Express
curl https://api.lujandev.com/metrics/latest.json
```

## 📊 Monitoreo de Logs

```bash
# Ver logs en tiempo real
tail -f logs/cron.log

# Ver últimos 50 logs
tail -50 logs/cron.log

# Buscar errores
grep ERROR logs/*.log

# Buscar warnings
grep WARN logs/*.log

# Ver métricas históricas
ls -lh metrics/
```

## 🔄 Actualizar Sistema

```bash
# Detener cron temporalmente
crontab -r  # O comentar línea específica

# Subir nueva versión del script
scp scripts/checkProductionHealth.sh root@your-server:/var/www/api_sequelize/scripts/

# Reinstalar
bash scripts/install-monitoring.sh

# El instalador detectará cron existente y preguntará si reemplazar
```

## 📈 Métricas a Monitorear

| Métrica | Umbral Normal | Umbral Crítico | Acción |
|---------|---------------|----------------|--------|
| Health Score | > 95% | < 80% | Investigar servicios caídos |
| API Latency | < 200ms | > 1000ms | Revisar base de datos, logs |
| CPU | < 50% | > 80% | Escalar servidor, optimizar código |
| RAM | < 70% | > 90% | Buscar memory leaks |
| Disco | < 70% | > 85% | Limpiar logs, imágenes |
| SSL | > 30 días | < 7 días | Renovar certificado |
| PM2 Restarts | 0 | > 10 | Revisar logs de errores |

## 🎯 Próximos Pasos

1. **Configurar alertas** en canal de Slack del equipo
2. **Crear dashboard Grafana** para visualización avanzada
3. **Configurar backup** de métricas históricas
4. **Documentar umbrales** específicos de tu aplicación
5. **Entrenar equipo** en uso del sistema

---

**¿Necesitas ayuda?**
- 📖 Documentación completa: `scripts/README.md`
- 📧 Email: admin@lujandev.com
- 🐛 Issues: GitHub Repository

**Sistema listo para producción enterprise** ✅
