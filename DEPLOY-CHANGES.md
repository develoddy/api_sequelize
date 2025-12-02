# 🔧 APLICAR CAMBIOS EN PRODUCCIÓN

## Cambios Realizados

### 1. ✅ Configuración de Rutas en Express (`src/routes/index.js`)

Se añadieron 3 nuevas rutas:

```javascript
// Dashboard HTML
GET /dashboard.html
→ Sirve el archivo public/dashboard.html

// Métricas JSON
GET /metrics/latest.json
→ Retorna las métricas en formato JSON

// Health Check (ya existía)
GET /api/health
→ Health check del sistema
```

### 2. ✅ Soporte SMTP Puerto 465 (SSL directo)

Actualizado `checkProductionHealth.sh` y `test-alerts.sh`:
- Puerto 465: usa `--ssl` (SSL directo)
- Puerto 587: usa `--ssl-reqd` (STARTTLS)

### 3. ✅ Fix JSON Export

Corregido manejo de variables vacías en servidor (macOS compatibility).

### 4. ✅ Script de Reinicio y Verificación

Nuevo: `scripts/restart-and-verify.sh`
- Reinicia PM2
- Genera métricas
- Valida endpoints
- Muestra URLs de acceso

---

## 📦 Comandos para Aplicar en Producción

### Paso 1: Subir Archivos Modificados

```bash
# Desde tu máquina local (macOS)
cd /Volumes/lujandev/dev/projects/ECOMMERCE/ECOMMERCE-MEAN/api

# Subir archivos modificados
scp src/routes/index.js root@your-server:/var/www/api_sequelize/src/routes/
scp scripts/checkProductionHealth.sh root@your-server:/var/www/api_sequelize/scripts/
scp scripts/test-alerts.sh root@your-server:/var/www/api_sequelize/scripts/
scp scripts/restart-and-verify.sh root@your-server:/var/www/api_sequelize/scripts/
```

### Paso 2: Conectar al Servidor y Reiniciar

```bash
# Conectar al servidor
ssh root@your-server

# Navegar al proyecto
cd /var/www/api_sequelize

# Dar permisos de ejecución
chmod +x scripts/*.sh

# Ejecutar script de reinicio y verificación
bash scripts/restart-and-verify.sh
```

El script automáticamente:
1. Reiniciará PM2
2. Generará métricas iniciales
3. Validará que todos los endpoints funcionen
4. Mostrará las URLs de acceso

### Paso 3: Verificar Dashboard

```bash
# En el servidor, verificar endpoints localmente:
curl http://localhost:3500/api/health
curl http://localhost:3500/dashboard.html | head
curl http://localhost:3500/metrics/latest.json | jq '.summary'

# Desde navegador (producción):
https://api.lujandev.com/dashboard.html
https://api.lujandev.com/metrics/latest.json
```

### Paso 4: Probar Alertas por Email

```bash
# En el servidor
bash scripts/test-alerts.sh

# Esto enviará un email de prueba a: lujandev@lujandev.com
# Configuración SMTP:
#   Host: lujandev-com.correoseguro.dinaserver.com
#   Port: 465 (SSL directo)
#   User: lujandev@lujandev.com
```

---

## ✅ Checklist de Validación

- [ ] PM2 reiniciado correctamente
- [ ] `/api/health` responde 200 OK
- [ ] `/dashboard.html` se carga correctamente
- [ ] `/metrics/latest.json` retorna JSON válido
- [ ] Dashboard muestra métricas en tiempo real
- [ ] Auto-refresh funciona (cada 30 segundos)
- [ ] Email de prueba recibido
- [ ] Cron job ejecutándose cada hora

---

## 🐛 Troubleshooting

### ❌ "Cannot GET /dashboard.html"

**Causa:** Rutas no configuradas en Express o PM2 no reiniciado.

**Solución:**
```bash
# Verificar que los cambios están en el servidor
cat src/routes/index.js | grep dashboard

# Reiniciar PM2
pm2 restart api_sequelize

# Verificar logs
pm2 logs api_sequelize --lines 50
```

### ❌ "Metrics not found"

**Causa:** No se han generado métricas aún.

**Solución:**
```bash
# Generar métricas manualmente
bash scripts/checkProductionHealth.sh

# Verificar que existe
ls -lh metrics/latest.json
cat metrics/latest.json | jq
```

### ❌ Email no llega

**Causa:** Puerto SMTP incorrecto o credenciales erróneas.

**Solución:**
```bash
# Verificar configuración
cat .env.monitoring | grep SMTP

# Probar manualmente con curl
echo "Subject: Test" | curl --url "smtp://lujandev-com.correoseguro.dinaserver.com:465" \
  --mail-from "lujandev@lujandev.com" \
  --mail-rcpt "lujandev@lujandev.com" \
  --user "lujandev@lujandev.com:$$Sistemas201290" \
  --upload-file - \
  --ssl

# Revisar logs del servidor SMTP
# Puede tardar algunos minutos en llegar
```

### ❌ Dashboard carga pero sin datos

**Causa:** Ruta `/metrics/latest.json` no responde o CORS bloqueado.

**Solución:**
```bash
# Verificar que el endpoint funciona
curl http://localhost:3500/metrics/latest.json

# Si es problema de CORS, verificar en navegador:
# F12 → Console → Ver errores

# El dashboard está en el mismo dominio, no debería haber CORS
```

---

## 📊 Resultados Esperados

### Health Check
```
Health Score: 100.00%
Total checks: 28
Passed: 28
Warnings: 0
Failed: 0
```

### Dashboard
- Health Score visual (círculo verde)
- Métricas actualizadas cada 30 segundos
- Alertas visibles (si hay)
- Recursos del servidor en tiempo real

### Email Alert (ejemplo)
```
Subject: 🚨 Production Health Alert - ADVERTENCIA

📊 Resumen:
   • Total checks: 28
   • Exitosos: 26
   • Warnings: 2
   • Fallos: 0
   • Health Score: 92.86%

⚠️ Alertas detectadas:
   • WARNING: Disco (/) - 42G / 50G (84%)
   • WARNING: CPU - 75%

🕐 Timestamp: 2025-12-02 16:00:00
```

---

## 🚀 Comandos Útiles Post-Deployment

```bash
# Ver estado actual
bash scripts/checkProductionHealth.sh --verbose

# Forzar ejecución con notificaciones
bash scripts/checkProductionHealth.sh --notify

# Ver logs del cron
tail -f logs/cron.log

# Ver logs de PM2
pm2 logs api_sequelize

# Ver métricas en tiempo real
watch -n 5 'curl -s http://localhost:3500/metrics/latest.json | jq ".summary"'

# Resetear PM2 restarts
pm2 reset api_sequelize

# Ver cron instalado
crontab -l
```

---

**Última actualización:** 2 de Diciembre de 2025  
**Versión:** 3.0.0 - Enterprise Edition  
**Estado:** ✅ Listo para aplicar en producción
