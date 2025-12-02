# 🏥 Ultra Pro Production Health Check v2.0

Sistema profesional de validación de salud para entornos de producción con monitoreo avanzado, alertas inteligentes y export a JSON.

## 🚀 Inicio Rápido

```bash
# Instalaciones básicas
bash scripts/checkProductionHealth.sh

# Con detalles completos
bash scripts/checkProductionHealth.sh --verbose

# Solo mostrar alertas (ideal para cron)
bash scripts/checkProductionHealth.sh --alert

# Exportar a JSON
bash scripts/checkProductionHealth.sh --json output.json
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
apt install bc jq openssl curl

# CentOS/RHEL
yum install bc jq openssl curl
```

### Desarrollo Local (macOS)
```bash
brew install bc jq
```

### PM2 (opcional pero recomendado)
```bash
npm install -g pm2
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

### Cron Job - Monitoreo cada hora
```bash
crontab -e

# Ejecutar cada hora
0 * * * * cd /var/www/api_sequelize && bash scripts/checkProductionHealth.sh >> /var/log/health-checks.log 2>&1
```

### Cron Job - Alertas por email
```bash
# Cada 15 min, enviar email solo si falla
*/15 * * * * cd /var/www/api_sequelize && bash scripts/checkProductionHealth.sh --alert || echo "Health check failed" | mail -s "⚠️ Alerta" admin@domain.com
```

### Cron Job - Export JSON para Grafana
```bash
# Cada 5 min, generar JSON
*/5 * * * * cd /var/www/api_sequelize && bash scripts/checkProductionHealth.sh --json /var/www/monitoring/health.json
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

## 📝 Changelog

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
- GitHub Issues: [tu-repo/issues]
- Email: admin@lujandev.com
- Documentación: `deployment/PRODUCTION-HEALTH-CHECK.md`

---

**Versión:** 2.0.0  
**Última actualización:** 2 de Diciembre de 2025  
**Licencia:** MIT  
**Autor:** Lujandev Team
