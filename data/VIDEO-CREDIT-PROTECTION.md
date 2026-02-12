# Sistema de Protección de Créditos - Video Express

## 📋 Resumen

Sistema inteligente que protege los $10 USD de créditos de fal.ai limitando la cantidad de videos reales generados.

## 🛡️ Funcionamiento

### Variables de Entorno

```env
# Modo simulación (true = no usa créditos, videos fake)
FAL_SIMULATION_MODE=true

# Límite de videos reales (protección de créditos)
VIDEO_REAL_LIMIT=25
```

### Lógica de Decisión

El sistema decide automáticamente si generar video real o usar placeholder:

1. **Si `FAL_SIMULATION_MODE=true`** → Siempre usa video fake (no consume créditos)
2. **Si `FAL_SIMULATION_MODE=false`**:
   - **Si contador < límite** → Genera video REAL con fal.ai (consume créditos)
   - **Si contador >= límite** → Fuerza modo simulación (protege créditos)

### Contador Persistente

El contador se guarda en: `api/data/video-credit-counter.json`

```json
{
  "real_videos_generated": 5,
  "limit": 25,
  "last_reset": "2026-02-12T10:30:00Z",
  "history": [
    {
      "requestId": "abc123",
      "timestamp": "2026-02-12T10:30:00Z",
      "count": 1
    }
  ]
}
```

## 🔍 Monitoreo

### API Endpoints

**Obtener estado del contador:**
```bash
GET /api/video-express/credit-status
Authorization: Bearer <token>

Response:
{
  "status": 200,
  "data": {
    "real_videos_generated": 5,
    "limit": 25,
    "remaining": 20,
    "percentage_used": 20,
    "can_generate": true,
    "last_reset": "2026-02-12T10:30:00Z",
    "history": [...]
  }
}
```

**Resetear contador (solo admin):**
```bash
POST /api/video-express/credit-reset
Authorization: Bearer <token>

Response:
{
  "status": 200,
  "message": "Contador de créditos reseteado exitosamente",
  "data": {
    "real_videos_generated": 0,
    "limit": 25,
    "last_reset": "2026-02-12T12:00:00Z"
  }
}
```

## 🎯 Casos de Uso

### Desarrollo Local (Testing)
```env
FAL_SIMULATION_MODE=true
VIDEO_REAL_LIMIT=25
```
→ Todos los videos son fake, contador no se incrementa

### Producción (Primera Fase)
```env
FAL_SIMULATION_MODE=false
VIDEO_REAL_LIMIT=25
```
→ Primeros 25 videos son REALES, después usa placeholders automáticamente

### Producción (Con Créditos Ilimitados)
```env
FAL_SIMULATION_MODE=false
VIDEO_REAL_LIMIT=999999
```
→ Todos los videos son REALES (asegúrate de tener créditos)

## 📊 Alertas del Sistema

El sistema muestra advertencias en los logs:

- **80% del límite alcanzado:**
  ```
  ⚠️ ADVERTENCIA: Se ha usado el 80% del límite de créditos
  ```

- **Límite alcanzado:**
  ```
  🚫 LÍMITE ALCANZADO: 25/25 videos reales generados
  💡 Forzando modo simulación para proteger créditos
  ```

- **Video generado:**
  ```
  💰 Contador actualizado: 5/25
  💎 Generando video REAL con fal.ai (consumirá créditos)...
  ```

## 🔧 Resetear Manualmente el Contador

### Opción 1: Editar archivo JSON
```bash
cd api/data
nano video-credit-counter.json
# Cambiar "real_videos_generated" a 0
```

### Opción 2: Eliminar archivo (se recrea automáticamente)
```bash
rm api/data/video-credit-counter.json
```

### Opción 3: Usar endpoint API
```bash
curl -X POST http://localhost:3500/api/video-express/credit-reset \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 💡 Recomendaciones

1. **Desarrollo**: Siempre usa `FAL_SIMULATION_MODE=true`
2. **Testing de producción**: Usa `VIDEO_REAL_LIMIT=5` para probar el límite
3. **Producción**: Ajusta `VIDEO_REAL_LIMIT` según tu presupuesto
4. **Monitoreo**: Revisa los logs regularmente para ver el uso de créditos

## 📈 Estimación de Costos

- **$10 USD** = ~25-50 videos (depende del modelo y configuración)
- **VIDEO_REAL_LIMIT=25**: Equivale aproximadamente a $10 USD
- Si necesitas más, recarga créditos en: https://fal.ai/dashboard/billing

## 🔒 Seguridad

- El contador persiste entre reinicios del servidor
- Solo usuarios autenticados pueden ver el estado
- Solo administradores pueden resetear el contador
- El sistema fuerza modo simulación automáticamente al alcanzar el límite

---

**Última actualización:** 12 de febrero de 2026  
**Versión:** 1.0.0
