# 🏥 Ultra Pro Production Health Check v3.0 - ENTERPRISE EDITION

Sistema profesional de validación de salud para entornos de producción con monitoreo avanzado, **alertas automáticas**, **logs rotativos**, **dashboard HTML** y export a JSON.

## 🆕 Novedades en v3.0

- ✅ **Alertas automáticas por Email** (SMTP)
- ✅ **Notificaciones a Slack** (Webhooks)
- ✅ **Logs rotativos** con logrotate (mantiene histórico sin saturar disco)
- ✅ **Dashboard HTML** interactivo con auto-refresh
- ✅ **Export JSON automático** para integración con Grafana/Prometheus
- ✅ **Instalador automatizado** con configuración de cron jobs
- ✅ **Sistema de métricas históricas** para análisis de tendencias

## 🚀 Instalación Rápida (Recomendado)

```bash
# 1. Ejecutar instalador automático
bash scripts/install-monitoring.sh

# El instalador configurará:
# - Validación de dependencias
# - Estructura de directorios
# - Cron jobs automáticos
# - Rotación de logs
# - Permisos correctos
```

## 📖 Uso Manual

```bash
# Ejecución básica
bash scripts/checkProductionHealth.sh

# Con detalles completos
bash scripts/checkProductionHealth.sh --verbose

# Con notificaciones (Email + Slack)
bash scripts/checkProductionHealth.sh --notify

# Solo mostrar alertas (ideal para cron)
bash scripts/checkProductionHealth.sh --alert

# Exportar a JSON personalizado
bash scripts/checkProductionHealth.sh --json custom-output.json

# Combinación
bash scripts/checkProductionHealth.sh --verbose --notify --json report.json
```

## ✨ Características

### 📊 Monitoreo Completo
- **Recursos del Servidor**: CPU, RAM, Disco, Load Average, Uptime
- **Procesos PM2**: Estado, CPU, memoria, restarts de todos los procesos
- **Backend API**: HTTP status, latencia, tamaño respuesta, health data
- **Frontend Admin**: HTTP status, latencia, tamaño HTML, validación Angular
- **Frontend Ecommerce**: HTTP status, latencia, tamaño HTML, validación Angular
- **Certificados SSL**: Validación y días restantes antes de expiración

### ⚡ Performance
- Latencia medida en **milisegundos** para cada servicio
- Tamaño de respuestas en **bytes/KB/MB**
- **Health Score** automático (% de checks exitosos)

### 🎨 Visualización
- Colores profesionales para fácil lectura
- Símbolos claros: ✓ (OK), ⚠ (Warning), ✗ (Error)
- Headers y secciones bien organizadas
- Modo verbose con información extra

### 🔔 Alertas Inteligentes
Sistema de umbrales configurables:
- Latencia > 500ms → WARNING
- CPU > 70% → WARNING
- Memoria > 300MB → WARNING
- Disco > 80% → WARNING
- SSL < 30 días → WARNING
- HTTP ≠ 200 → CRITICAL

### 📝 Logging
- Logs automáticos con timestamp: `logs/health-check-YYYYMMDD-HHMMSS.log`
- Niveles: INFO, WARN, ERROR
- Persistencia de todas las ejecuciones

### 🔗 Integración
- Export a JSON para Grafana, Prometheus, etc.
- Exit codes para automatización (0 = OK, 1 = FAIL)
- Compatible con cron, systemd timers, Jenkins

## 📋 Requisitos

### Servidor de Producción (Linux)
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y bc jq openssl curl

# CentOS/RHEL
sudo yum install -y bc jq openssl curl
```

### Desarrollo Local (macOS)
```bash
brew install bc jq openssl curl
```

### PM2 (opcional pero recomendado)
```bash
npm install -g pm2
```

## ⚙️ Configuración de Alertas

### 1. Crear archivo de configuración
```bash
cd /var/www/api_sequelize  # O tu ruta de proyecto
cp .env.monitoring.example .env.monitoring
nano .env.monitoring
```

### 2. Configurar Email (Gmail)

```bash
# .env.monitoring
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-correo@gmail.com
SMTP_PASS=tu-app-password
ALERT_EMAIL=admin@lujandev.com
```

**Obtener contraseña de aplicación de Gmail:**
1. Activar autenticación de 2 factores: https://myaccount.google.com/security
2. Generar contraseña de aplicación: https://myaccount.google.com/apppasswords
3. Seleccionar "Correo" y "Otro dispositivo"
4. Copiar contraseña generada en `SMTP_PASS`

### 3. Configurar Slack

```bash
# .env.monitoring
SLACK_ENABLED=true
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

**Obtener Webhook de Slack:**
1. Ir a: https://api.slack.com/apps
2. Crear app o usar existente
3. Activar "Incoming Webhooks"
4. Añadir webhook para canal específico (#monitoring, #alerts, etc.)
5. Copiar URL y pegar en configuración

### 4. Probar notificaciones

```bash
# Ejecutar con notificaciones activadas
bash scripts/checkProductionHealth.sh --notify --verbose

# Si hay warnings o errores, se enviarán automáticamente
```

## 🎯 Ejemplos de Uso

### 1. Validación Rápida
```bash
bash scripts/checkProductionHealth.sh
```

**Output:**
```
╔═══════════════════════════════════════════════════════════════╗
║  🏥 ULTRA PRO PRODUCTION HEALTH CHECK v2.0.0    🚀 ...       ║
╚═══════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💻 RECURSOS DEL SERVIDOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ✓ Uso de CPU: 12%
   ✓ Memoria RAM: 2048MB / 4096MB (50%)
   ✓ Disco (/): 15G / 50G (30%)
   ✓ Load Average: 0.45, 0.38, 0.32
   ✓ Server Uptime: up 15 days

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚙️  PROCESOS PM2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ✓ Total de procesos: 1
   ✓   ├─ api_sequelize: ONLINE | CPU: 0% | RAM: 114MB | Restarts: 0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 BACKEND API (Node.js)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ✓ HTTP Status: 200 OK
   ✓ Latencia: 125ms
   ✓ Tamaño respuesta: 171B
   ✓ Health Status: ok
   ✓ Environment: production
   ✓ Stripe API Key: Configurado
   ✓ Certificado SSL: Válido por 86 días

[... más secciones ...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 RESUMEN DE VALIDACIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Total de checks:     28
   Checks exitosos:     28
   Warnings:            0
   Checks fallidos:     0

   Health Score:        100.00%

╔═══════════════════════════════════════════════════════════════╗
║  ✅ TODOS LOS SISTEMAS OPERATIVOS - SALUD ÓPTIMA             ║
╚═══════════════════════════════════════════════════════════════╝
```

### 2. Modo Verbose
```bash
bash scripts/checkProductionHealth.sh --verbose
```

Añade información extra:
- Uptime de PM2 en días
- JSON completo del endpoint /health
- Validación exhaustiva de Angular tags
- Verificación detallada de bundles

### 3. Modo Solo Alertas (Cron)
```bash
bash scripts/checkProductionHealth.sh --alert
```

Solo muestra problemas:
```
⚠️  ALERTAS DETECTADAS:
   • WARNING: Disco (/) - 42G / 50G (84%) (umbral: 80%)
   • CRITICAL: PM2 api_sequelize - 12 restarts
```

### 4. Export JSON
```bash
bash scripts/checkProductionHealth.sh --json metrics.json
cat metrics.json | jq '.'
```

```json
{
  "timestamp": "2025-12-02 13:41:22",
  "version": "2.0.0",
  "summary": {
    "total_checks": 28,
    "passed": 26,
    "warnings": 2,
    "failed": 0,
    "success_rate": 92.85
  },
  "api": {
    "http_code": "200",
    "latency_ms": 126,
    "size_bytes": 171,
    "ssl_days": "86"
  },
  "admin": {
    "http_code": "200",
    "latency_ms": 191,
    "size_bytes": 38503
  },
  "ecommerce": {
    "http_code": "200",
    "latency_ms": 131,
    "size_bytes": 9815
  },
  "alerts": [
    "WARNING: Disco (/) - 42G / 50G (84%)"
  ]
}
```

## ⚙️ Configuración

### Umbrales de Alerta

Edita el script y modifica estas variables:

```bash
# Umbrales de alerta
declare -r MAX_LATENCY_MS=500      # Latencia máxima (ms)
declare -r MAX_CPU_PERCENT=70      # CPU máximo (%)
declare -r MAX_MEMORY_MB=300       # Memoria máxima proceso (MB)
declare -r MAX_DISK_PERCENT=80     # Disco máximo (%)
declare -r MIN_SSL_DAYS=30         # Días mínimos SSL
```

### URLs de Producción

Modifica las URLs si tus dominios son diferentes:

```bash
declare -r API_URL="https://api.lujandev.com/api/health"
declare -r API_BASE="https://api.lujandev.com"
declare -r ADMIN_URL="https://admin.lujandev.com"
declare -r ECOMMERCE_URL="https://tienda.lujandev.com"
```

## 🤖 Automatización

### Instalación Automatizada (Recomendado)

El script `install-monitoring.sh` configura todo automáticamente:

```bash
bash scripts/install-monitoring.sh

# El instalador te preguntará:
# - Intervalo de ejecución (cada hora, 30min, 15min, etc.)
# - Activar notificaciones automáticas
# - Y configurará cron automáticamente
```

### Configuración Manual de Cron

#### 1. Monitoreo cada hora con alertas
```bash
crontab -e

# Ejecutar cada hora con notificaciones
0 * * * * cd /var/www/api_sequelize && bash scripts/checkProductionHealth.sh --notify >> logs/cron.log 2>&1
```

#### 2. Monitoreo intensivo (cada 15 minutos)
```bash
# Cada 15 minutos, con alertas solo en errores
*/15 * * * * cd /var/www/api_sequelize && bash scripts/checkProductionHealth.sh --alert --notify >> logs/cron.log 2>&1
```

#### 3. Export JSON para Grafana (cada 5 minutos)
```bash
# Cada 5 minutos, actualizar métricas para dashboard
*/5 * * * * cd /var/www/api_sequelize && bash scripts/checkProductionHealth.sh >> logs/cron.log 2>&1
# El JSON se exporta automáticamente a metrics/latest.json
```

#### 4. Verificar cron instalado
```bash
# Ver cron jobs actuales
crontab -l

# Ver logs de ejecución
tail -f /var/www/api_sequelize/logs/cron.log
```

### Systemd Timer (alternativa a cron)
```bash
# /etc/systemd/system/health-check.service
[Unit]
Description=Production Health Check
After=network.target

[Service]
Type=oneshot
User=www-data
WorkingDirectory=/var/www/api_sequelize
ExecStart=/bin/bash scripts/checkProductionHealth.sh --json /var/log/health-latest.json
StandardOutput=append:/var/log/health-checks.log
StandardError=append:/var/log/health-checks.log

# /etc/systemd/system/health-check.timer
[Unit]
Description=Run Health Check every 5 minutes
Requires=health-check.service

[Timer]
OnBootSec=5min
OnUnitActiveSec=5min
Unit=health-check.service

[Install]
WantedBy=timers.target

# Activar
systemctl daemon-reload
systemctl enable health-check.timer
systemctl start health-check.timer
```

## 🔗 Integraciones

### Slack Webhook
```bash
#!/bin/bash
OUTPUT=$(bash scripts/checkProductionHealth.sh --alert 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"⚠️ Production Health Alert\n\`\`\`$OUTPUT\`\`\`\"}"
fi
```

### Grafana SimpleJSON
```bash
# Generar JSON periódicamente
bash scripts/checkProductionHealth.sh --json /var/www/metrics/health.json

# En Grafana, configurar SimpleJSON datasource apuntando a:
# http://your-server/metrics/health.json
```

### Prometheus Node Exporter
```bash
#!/bin/bash
# Convertir JSON a formato Prometheus
bash scripts/checkProductionHealth.sh --json /tmp/health.json

API_LATENCY=$(jq -r '.api.latency_ms' /tmp/health.json)
HEALTH_SCORE=$(jq -r '.summary.success_rate' /tmp/health.json)

cat > /var/lib/node_exporter/health.prom <<EOF
# HELP api_latency_ms API response time in milliseconds
# TYPE api_latency_ms gauge
api_latency_ms $API_LATENCY

# HELP health_score_percent Overall health score percentage
# TYPE health_score_percent gauge
health_score_percent $HEALTH_SCORE
EOF
```

## 📊 Logs

### Ubicación
```bash
logs/health-check-YYYYMMDD-HHMMSS.log
```

### Formato
```
[YYYY-MM-DD HH:MM:SS] [LEVEL] Message
```

### Niveles
- `INFO`: Eventos normales
- `WARN`: Warnings por umbrales
- `ERROR`: Checks críticos fallidos

### Ver logs recientes
```bash
# Últimas 50 líneas
tail -50 logs/health-check-*.log

# Seguir en tiempo real
tail -f logs/health-check-*.log

# Buscar errores
grep ERROR logs/health-check-*.log

# Logs de hoy
ls logs/health-check-$(date +%Y%m%d)-*.log
```

## 🆘 Troubleshooting

### "jq: command not found"
```bash
# Ubuntu/Debian
apt install jq

# CentOS/RHEL
yum install jq

# macOS
brew install jq
```

### "bc: command not found"
```bash
# Ubuntu/Debian
apt install bc

# CentOS/RHEL
yum install bc

# macOS
brew install bc
```

### "PM2 no disponible"
```bash
# Instalar PM2 globalmente
npm install -g pm2

# O ejecutar el script sin PM2 (solo validará endpoints HTTP)
```

### SSL check falla
```bash
# Verificar OpenSSL instalado
openssl version

# Test manual
echo | openssl s_client -servername api.lujandev.com -connect api.lujandev.com:443 2>/dev/null | openssl x509 -noout -dates
```

### Latencia muy alta
- Verificar conexión a internet
- Comprobar firewall/reverse proxy
- Revisar logs del servidor (nginx/apache)
- Aumentar `MAX_LATENCY_MS` si es normal para tu caso

## 📚 Documentación Completa

Ver `deployment/PRODUCTION-HEALTH-CHECK.md` para guía detallada con:
- Checklist manual completo
- Comandos de troubleshooting
- Métricas clave de rendimiento
- Flujos de validación recomendados

## 🏆 Mejores Prácticas

1. **Ejecutar diariamente** como mínimo
2. **Automatizar con cron** para monitoreo continuo
3. **Configurar alertas** para respuesta rápida
4. **Revisar logs** semanalmente para detectar patrones
5. **Ajustar umbrales** según tu infraestructura
6. **Integrar con dashboard** (Grafana/Datadog/etc.)
7. **Documentar** cambios en umbrales y configuración

## 📈 Métricas Clave

### Backend API
- Latencia < 200ms (excelente), < 500ms (aceptable)
- Health Status: "ok"
- Memoria < 300MB
- Restarts PM2: 0

### Frontales Angular
- Latencia < 2s (primera carga)
- Tamaño HTML < 50KB
- Tags Angular presentes

### Servidor
- CPU < 70%
- Disco < 80%
- Load Average < Número de CPUs

### SSL
- Días restantes > 30

## 🔐 Seguridad

- No expone información sensible (passwords, tokens)
- Solo verifica presencia de claves (true/false)
- Logs no contienen credenciales
- JSON export solo métricas públicas

## 🔄 Sistema de Logs Rotativos

El sistema incluye rotación automática de logs para evitar saturación de disco:

### Configuración de Logrotate

```bash
# El archivo scripts/logrotate.conf está preconfigurado

# Para activar en sistema (requiere sudo):
sudo cp scripts/logrotate.conf /etc/logrotate.d/health-check

# O ejecutar manualmente:
logrotate -f scripts/logrotate.conf
```

### Características de Rotación
- **Frecuencia**: Diaria
- **Retención**: 30 días
- **Compresión**: Automática (gzip)
- **Tamaño máximo**: 100MB por archivo
- **Limpieza JSON**: Automática (métricas > 7 días)

### Ver logs históricos
```bash
# Logs actuales
ls -lh logs/

# Logs comprimidos
ls -lh logs/*.gz

# Ver log específico
cat logs/health-check-20251202-140530.log

# Ver log comprimido
zcat logs/health-check-20251201-120000.log.gz
```

## 📊 Dashboard HTML

El sistema incluye un dashboard interactivo para visualizar métricas en tiempo real.

### Acceso al Dashboard

```bash
# El dashboard está en: public/dashboard.html
# Acceder vía browser:
https://api.lujandev.com/dashboard.html
```

### Características del Dashboard
- 📈 **Visualización en tiempo real** de todas las métricas
- 🔄 **Auto-refresh** cada 30 segundos (configurable)
- 📊 **Health Score** con indicador visual
- 🖥️ **Recursos del servidor** (CPU, RAM, Disco)
- 🌐 **Estado de servicios** (API, Admin, Ecommerce)
- ⚠️ **Alertas activas** destacadas
- 📱 **Responsive design** (móvil y desktop)

### Configurar Endpoint en Backend

Añadir ruta en Express para servir métricas:

```javascript
// En routes/index.js o app.js
app.get('/metrics/latest.json', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  const metricsFile = path.join(__dirname, '../metrics/latest.json');
  
  if (fs.existsSync(metricsFile)) {
    const data = fs.readFileSync(metricsFile, 'utf8');
    res.json(JSON.parse(data));
  } else {
    res.status(404).json({ error: 'Metrics not found' });
  }
});
```

## 🔔 Guía de Alertas

### Tipos de Alertas

| Severidad | Condición | Acción |
|-----------|-----------|--------|
| 🟢 **OK** | Todos los checks exitosos | Ninguna |
| 🟡 **WARNING** | Umbrales excedidos | Email + Slack (si `--notify`) |
| 🔴 **CRITICAL** | Servicios caídos | Email + Slack + Log |

### Umbrales Configurables

Editar en `checkProductionHealth.sh`:

```bash
declare -r MAX_LATENCY_MS=500      # Latencia máxima
declare -r MAX_CPU_PERCENT=70      # CPU máximo
declare -r MAX_MEMORY_MB=300       # Memoria máxima del proceso
declare -r MAX_DISK_PERCENT=80     # Disco máximo
declare -r MIN_SSL_DAYS=30         # Días mínimos SSL
```

### Ejemplos de Notificaciones

**Email:**
```
Subject: 🚨 Production Health Alert - CRÍTICO

📊 Resumen:
   • Total checks: 28
   • Exitosos: 26
   • Warnings: 0
   • Fallos: 2
   • Health Score: 92.86%

⚠️ Alertas detectadas:
   • CRITICAL: HTTP Status - 500
   • CRITICAL: Backend API - No responde

🕐 Timestamp: 2025-12-02 15:30:45
```

**Slack:**
```
🚨 Production Health Alert - ADVERTENCIA

📊 Health Score: 89.29%
⚠️ 3 warnings detectados
🖥️ CPU: 75% (⚠️ umbral: 70%)
💾 Disco: 85% (⚠️ umbral: 80%)
```

## 🔗 Integración con Grafana/Prometheus

### Opción 1: SimpleJSON Plugin (Grafana)

```bash
# 1. Instalar plugin en Grafana
grafana-cli plugins install grafana-simple-json-datasource

# 2. Añadir datasource apuntando a:
https://api.lujandev.com/metrics/latest.json

# 3. Crear dashboard con queries JSON path:
$.summary.success_rate
$.server.cpu_percent
$.api.latency_ms
```

### Opción 2: Prometheus Exporter

Crear script `export-prometheus.sh`:

```bash
#!/bin/bash
cd /var/www/api_sequelize
bash scripts/checkProductionHealth.sh > /dev/null

# Convertir JSON a formato Prometheus
METRICS_FILE="metrics/latest.json"
PROM_FILE="/var/lib/node_exporter/textfile_collector/health.prom"

if [ -f "$METRICS_FILE" ]; then
  HEALTH_SCORE=$(jq -r '.summary.success_rate' "$METRICS_FILE")
  API_LATENCY=$(jq -r '.api.latency_ms' "$METRICS_FILE")
  CPU=$(jq -r '.server.cpu_percent' "$METRICS_FILE")
  MEMORY=$(jq -r '.server.memory_percent' "$METRICS_FILE")
  
  cat > "$PROM_FILE" <<EOF
# HELP health_score Overall health score percentage
# TYPE health_score gauge
health_score $HEALTH_SCORE

# HELP api_latency_milliseconds API latency in milliseconds
# TYPE api_latency_milliseconds gauge
api_latency_milliseconds $API_LATENCY

# HELP server_cpu_percent Server CPU usage percentage
# TYPE server_cpu_percent gauge
server_cpu_percent $CPU

# HELP server_memory_percent Server memory usage percentage
# TYPE server_memory_percent gauge
server_memory_percent $MEMORY
EOF
fi
```

Cron para actualizar cada 5 minutos:
```bash
*/5 * * * * /var/www/api_sequelize/scripts/export-prometheus.sh
```

## 📝 Changelog

### v3.0.0 (2025-12-02) - ENTERPRISE EDITION 🚀
- ✨ **Alertas automáticas por Email** (SMTP con curl)
- ✨ **Notificaciones a Slack** (Webhook integration)
- ✨ **Dashboard HTML** interactivo con auto-refresh
- ✨ **Logs rotativos** con logrotate (30 días retención)
- ✨ **Export JSON automático** a metrics/latest.json
- ✨ **Instalador automatizado** (install-monitoring.sh)
- ✨ **Configuración .env.monitoring** para credenciales
- ✨ **Métricas históricas** con limpieza automática
- 📖 **Documentación completa** de instalación enterprise

### v2.0.0 (2025-12-02)
- ✨ Medición de latencia en milisegundos
- ✨ Validación de certificados SSL
- ✨ Monitoreo de recursos del servidor
- ✨ Estado completo de procesos PM2
- ✨ Tamaño de respuestas HTTP
- ✨ Sistema de logs con timestamps
- ✨ Colores profesionales
- ✨ Sistema de alertas por umbrales
- ✨ Export a JSON
- ✨ Health Score calculado
- ✨ Modo --verbose y --alert
- 🐛 Compatible con macOS y Linux

### v1.0.0 (2025-11-30)
- 🎉 Versión inicial
- ✅ Validación básica de endpoints

## 📞 Soporte

Para issues, consultas o mejoras:
- GitHub Issues: [develoddy/api_sequelize]
- Email: admin@lujandev.com
- Documentación: `deployment/PRODUCTION-HEALTH-CHECK.md`

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Para cambios importantes:
1. Fork del repositorio
2. Crear feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

---

**Versión:** 3.0.0 - Enterprise Edition  
**Última actualización:** 2 de Diciembre de 2025  
**Licencia:** MIT  
**Autor:** Lujandev Development Team  
**Mantenedor:** @develoddy
