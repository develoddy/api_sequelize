# 🧪 Guía de Testing - Product Video Express

## ✅ Verificación del Backend

### 1. Verificar que el servidor está corriendo

Deberías ver en los logs:
```
✅ DEV: DB conectada
🚀 Server running on port 3500
📡 WebSockets ready
⏰ Iniciando cron jobs...
🚀 Iniciando cron job de Video Express Polling...
✅ Cron job de Video Express iniciado (cada 30s)
```

Y cada 30 segundos:
```
⏰ [Cron] Ejecutando polling de Video Express...
🔄 Revisando jobs pendientes...
✅ No hay jobs pendientes
```

---

## 🔑 Tu Token de Admin

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sIjoiYWRtaW4iLCJlbWFpbCI6ImFkbWluQGFkbWluLmNvbSIsImlhdCI6MTc3MDM5MjU5MiwiZXhwIjoxNzcwNDc4OTkyfQ.zJyN9zjAjz38fRQk1qjnM1PMGSgMzzNBWv0FhDw4U9E
```

---

## 📊 Endpoints Disponibles

**Base URL:** `http://localhost:3500/api/video-express`

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/stats` | GET | Estadísticas del usuario |
| `/jobs` | GET | Listar todos los jobs |
| `/jobs` | POST | Crear nuevo job |
| `/jobs/:id` | GET | Ver detalles de un job |
| `/jobs/:id` | DELETE | Eliminar un job |
| `/download/:id` | GET | Descargar video completado |

---

---

## 🎯 Dos Formas de Probar

Elige la que prefieras:

**🚀 Opción A: Postman (Recomendado - Rápido)**
- Importa la collection lista → `postman-collection-video-express.json`
- Tests automáticos incluidos
- Variables configuradas
- ⏱️ 2 minutos para empezar

**💻 Opción B: cURL (Manual - Terminal)**
- Copia y pega comandos
- Perfecto para scripts
- Control total
- ⏱️ 5 minutos para empezar

**👉 Salta a:** [Postman](#-atajo-importar-collection-de-postman) | [cURL](#-opción-1-postman-recomendado)

---

## 🧪 Tests Paso a Paso

Puedes usar **cURL** (terminal) o **Postman** (interfaz gráfica). A continuación se muestran ambas opciones.

---

## 🎯 Opción 1: Postman (Recomendado)

### Configuración Inicial en Postman

1. **Abrir Postman** (descargar en https://www.postman.com si no lo tienes)
2. **Crear una Collection** nueva: `Product Video Express Tests`
3. **Añadir variable de entorno:**
   - Click en el ojo 👁️ (Environments) → Create New Environment
   - Nombre: `Video Express Local`
   - Variables:
     ```
     base_url = http://localhost:3500
     admin_token = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sIjoiYWRtaW4iLCJlbWFpbCI6ImFkbWluQGFkbWluLmNvbSIsImlhdCI6MTc3MDM5MjU5MiwiZXhwIjoxNzcwNDc4OTkyfQ.zJyN9zjAjz38fRQk1qjnM1PMGSgMzzNBWv0FhDw4U9E
     ```
   - Click **Save**
   - Seleccionar el environment en el dropdown superior derecho

---

### Test 1: Obtener Estadísticas (GET /stats)

**En Postman:**

1. **New Request** → Nombre: `Get Stats`
2. **Método:** `GET`
3. **URL:** `{{base_url}}/api/video-express/stats`
4. **Headers:**
   - Key: `token`
   - Value: `{{admin_token}}`
5. **Click en "Send"**

**Respuesta esperada (200 OK):**
```json
{
  "status": 200,
  "data": {
    "total": 0,
    "completed": 0,
    "failed": 0,
    "processing": 0,
    "pending": 0
  }
}
```

✅ **Test pasado:** El endpoint funciona correctamente

---

**Con cURL (alternativa):**

```bash
curl -X GET "http://localhost:3500/api/video-express/stats" \
  -H "token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sIjoiYWRtaW4iLCJlbWFpbCI6ImFkbWluQGFkbWluLmNvbSIsImlhdCI6MTc3MDM5MjU5MiwiZXhwIjoxNzcwNDc4OTkyfQ.zJyN9zjAjz38fRQk1qjnM1PMGSgMzzNBWv0FhDw4U9E"
```

**Respuesta esperada:**
```json
{
  "status": 200,
  "data": {
    "total": 0,
    "completed": 0,
    "failed": 0,
    "processing": 0,
    "pending": 0
  }
}
```

✅ **Test pasado:** El endpoint funciona correctamente

---

---

### Test 2: Listar Jobs (GET /jobs)

**En Postman:**

1. **New Request** → Nombre: `List Jobs`
2. **Método:** `GET`
3. **URL:** `{{base_url}}/api/video-express/jobs`
4. **Query Params:**
   - Key: `limit` | Value: `10`
5. **Headers:**
   - Key: `token`
   - Value: `{{admin_token}}`
6. **Click en "Send"**

**Con cURL (alternativa):**

```bash
curl -X GET "http://localhost:3500/api/video-express/jobs?limit=10" \
  -H "token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sIjoiYWRtaW4iLCJlbWFpbCI6ImFkbWluQGFkbWluLmNvbSIsImlhdCI6MTc3MDM5MjU5MiwiZXhwIjoxNzcwNDc4OTkyfQ.zJyN9zjAjz38fRQk1qjnM1PMGSgMzzNBWv0FhDw4U9E"
```
---

### Test 3: Crear un Job de Video ⭐ (POST /jobs)

**IMPORTANTE:** Necesitas una imagen de producto (JPG o PNG, máx 10MB).

#### Paso 1: Preparar una imagen

Opciones:
- Descarga una imagen de producto de internet (ej: zapatos, reloj, bolso)
- Usa una foto de tu teléfono
- Usa cualquier imagen JPG/PNG que tengas
- **Imágenes de prueba:** https://unsplash.com/s/photos/product

#### Paso 2: Crear el job en Postman

**En Postman:**

1. **New Request** → Nombre: `Create Video Job`
2. **Método:** `POST`
3. **URL:** `{{base_url}}/api/video-express/jobs`
4. **Headers:**
   - Key: `token`
   - Value: `{{admin_token}}`
5. **Body:**
   - Seleccionar **form-data**
   - Añadir campos:
     
     | Key | Type | Value |
     |-----|------|-------|
     | `product_image` | **File** | [Click "Select Files" y elige tu imagen] |
     | `animation_style` | Text | `parallax` |

6. **Click en "Send"**

**Estilos disponibles para `animation_style`:**
- `zoom_in` - Zoom cinematográfico hacia el producto
- `parallax` - Efecto de profundidad 2.5D **(recomendado)**
- `subtle_float` - Levitación suave

**Con cURL (alternativa):**de Video ⭐

**IMPORTANTE:** Necesitas una imagen de producto (JPG o PNG, máx 10MB).

#### Paso 1: Preparar una imagen

Opciones:
- Descarga una imagen de producto de internet
- Usa una foto de tu teléfono
- Usa cualquier imagen JPG/PNG que tengas

Guarda la ruta de la imagen, por ejemplo:
```
/Users/tu_usuario/Downloads/producto.jpg
```

#### Paso 2: Crear el job

```bash
curl -X POST "http://localhost:3500/api/video-express/jobs" \
  -H "token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sIjoiYWRtaW4iLCJlbWFpbCI6ImFkbWluQGFkbWluLmNvbSIsImlhdCI6MTc3MDM5MjU5MiwiZXhwIjoxNzcwNDc4OTkyfQ.zJyN9zjAjz38fRQk1qjnM1PMGSgMzzNBWv0FhDw4U9E" \
  -F "product_image=@/ruta/a/tu/imagen.jpg" \
  -F "animation_style=parallax"
``📝 IMPORTANTE: Copia el `id` del job**, lo necesitarás para los siguientes tests.

💡 **Tip Postman:** Guarda el `id` en una variable de entorno:
- Click derecho en el panel de respuesta
- "Set as variable" → "job_id"

---

### Test 4: Consultar Estado del Job (GET /jobs/:id)

**En Postman:**

1. **New Request** → Nombre: `Get Job Status`
2. **Método:** `GET`
3. **URL:** `{{base_url}}/api/video-express/jobs/{{job_id}}`
   - (O reemplaza `{{job_id}}` con el ID real)
4. **Headers:**
   - Key: `token`
   - Value: `{{admin_token}}`
5. **Click en "Send"** (puedes hacerlo cada 30 segundos para ver el progreso)

**Con cURL (alternativa):** 2.5D (recomendado)
- `subtle_float` - Levitación suave

**Respuesta esperada:**
```json
{
  "status": 201,
  "message": "Job de video creado exitosamente",
  "data": {
    "job": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "pending",
      "animation_style": "parallax",
      "product_image_filename": "producto.jpg",
      "created_at": "2026-02-06T16:45:00.000Z"
    }
  }
}
```

**Copia el `id` del job**, lo necesitarás para los siguientes tests.

---

### Test 4: Consultar Estado del Job

```bash
# Reemplaza JOB_ID con el id que obtuviste en el paso anterior
curl -X GET "http://localhost:3500/api/video-express/jobs/JOB_ID" \
  -H "token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sIjoiYWRtaW4iLCJlbWFpbCI6ImFkbWluQGFkbWluLmNvbSIsImlhdCI6MTc3MDM5MjU5MiwiZXhwIjoxNzcwNDc4OTkyfQ.zJyN9zjAjz38fRQk1qjnM1PMGSgMzzNBWv0FhDw4U9E"
```

**Estados posibles:**

1. **pending** - Recién creado, esperando envío a fal.ai
```json
{
  "status": 200,
  "data": {
    "job": {
      "id": "550e8400...",
      "status": "pending",
      "animation_style": "parallax",
      ...
    }
  }
}
```

2. **processing** - Enviado a fal.ai, generando video
```json
{
  "status": 200,
  "data": {
    "job": {
      "id": "550e8400...",
      "status": "processing",
      "fal_request_id": "abc123...",
**💡 Tip Postman:** Haz click en "Send" cada 20-30 segundos para ver el progreso en tiempo real.

---

### Test 5: Descargar el Video (GET /download/:id)

Una vez que el job esté `completed`:

**En Postman:**

1. **New Request** → Nombre: `Download Video`
2. **Método:** `GET`
3. **URL:** `{{base_url}}/api/video-express/download/{{job_id}}`
4. **Headers:**
   - Key: `token`
   - Value: `{{admin_token}}`
5. **Click en "Send"**
6. **En la respuesta:**
   - Click en "Save Response" → "Save to a file"
   - Guardar como: `mi_video.mp4`

**Reproducir el video:**
- Doble click en el archivo descargado
- O desde terminal: `open mi_video.mp4` (macOS)

**Con cURL (alternativa):**

```bash
curl -X GET "http://localhost:3500/api/video-express/download/JOB_ID" \
  -H "token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sIjoiYWRtaW4iLCJlbWFpbCI6ImFkbWluQGFkbWluLmNvbSIsImlhdCI6MTc3MDM5MjU5MiwiZXhwIjoxNzcwNDc4OTkyfQ.zJyN9zjAjz38fRQk1qjnM1PMGSgMzzNBWv0FhDw4U9E" \
  -o mi_video.mp4 && open mi_video.mp4
```

---

### Test 6: Eliminar un Job (DELETE /jobs/:id)

**En Postman:**
� Importar Collection a Postman

Para mayor rapidez, puedes importar una collection completa:

1. **Crear archivo** `video-express-postman.json`:

```json
{
  "info": {
    "name": "Product Video Express API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get Stats",
      "request": {
        "method": "GET",
        "header": [{"key": "token", "value": "{{admin_token}}"}],
        "url": {
          "raw": "{{base_url}}/api/video-express/stats",
          "host": ["{{base_url}}"],
          "path": ["api", "video-express", "stats"]
        }
      }
    },
    {
      "name": "List Jobs",
      "request": {
        "method": "GET",
        "header": [{"key": "token", "value": "{{admin_token}}"}],
        "url": {
          "raw": "{{base_url}}/api/video-express/jobs?limit=10",
          "host": ["{{base_url}}"],
          "path": ["api", "video-express", "jobs"],
          "query": [{"key": "limit", "value": "10"}]
        }
      }
    },
    {
      "name": "Create Video Job",
      "request": {
        "method": "POST",
        "header": [{"key": "token", "value": "{{admin_token}}"}],
        "body": {
          "mode": "formdata",
          "formdata": [
            {"key": "product_image", "type": "file", "src": ""},
            {"key": "animation_style", "value": "parallax", "type": "text"}
          ]
        },
        "url": {
          "raw": "{{base_url}}/api/video-express/jobs",
          "host": ["{{base_url}}"],
          "path": ["api", "video-express", "jobs"]
        }
      }
    },
    {
      "name": "Get Job Status",
      "request": {
        "method": "GET",
        "header": [{"key": "token", "value": "{{admin_token}}"}],
        "url": {
          "raw": "{{base_url}}/api/video-express/jobs/{{job_id}}",
          "host": ["{{base_url}}"],
          "path": ["api", "video-express", "jobs", "{{job_id}}"]
        }
      }
    },
    {
      "name": "Download Video",
      "request": {
        "method": "GET",
        "header": [{"key": "token", "value": "{{admin_token}}"}],
        "url": {
          "raw": "{{base_url}}/api/video-express/download/{{job_id}}",
          "host": ["{{base_url}}"],
          "path": ["api", "video-express", "download", "{{job_id}}"]
        }
      }
    },
    {
      "name": "Delete Job",
      "request": {
        "method": "DELETE",
        "header": [{"key": "token", "value": "{{admin_token}}"}],
        "url": {
          "raw": "{{base_url}}/api/video-express/jobs/{{job_id}}",
          "host": ["{{base_url}}"],
          "path": ["api", "video-express", "jobs", "{{job_id}}"]
        }
      }
    }
  ]
}
```

2. **En Postman:** Import → Upload Files → Seleccionar el JSON
3. **Configurar environment:**
   - `base_url` = `http://localhost:3500`
   - `admin_token` = tu token
   - `job_id` = (se llenará automáticamente)

---

## �
1. **New Request** → Nombre: `Delete Job`
2. **Método:** `DELETE`
3. **URL:** `{{base_url}}/api/video-express/jobs/{{job_id}}`
4. **Headers:**
   - Key: `token`
   - Value: `{{admin_token}}`
5. **Click en "Send"**

**Con cURL (alternativa):**
```

4. **failed** - Error en el procesamiento
```json
{
  "status": 200,
  "data": {
    "job": {
      "id": "550e8400...",
      "status": "failed",
      "error_message": "Error en fal.ai: ...",
      "error_code": "FAL_PROCESSING_ERROR"
    }
  }
}
```

**⏱️ Tiempo estimado:** 60-90 segundos

---

### Test 5: Descargar el Video

Una vez que el job esté `completed`:

```bash
curl -X GET "http://localhost:3500/api/video-express/download/JOB_ID" \
  -H "token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sIjoiYWRtaW4iLCJlbWFpbCI6ImFkbWluQGFkbWluLmNvbSIsImlhdCI6MTc3MDM5MjU5MiwiZXhwIjoxNzcwNDc4OTkyfQ.zJyN9zjAjz38fRQk1qjnM1PMGSgMzzNBWv0FhDw4U9E" \
  -o mi_video.mp4
```

Esto descargará el video como `mi_video.mp4` en tu directorio actual.

**Reproducir el video:**
```bash
open mi_video.mp4  # macOS
```

---

### Test 6: Eliminar un Job

```bash
curl -X DELETE "http://localhost:3500/api/video-express/jobs/JOB_ID" \
  -H "token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sIjoiYWRtaW4iLCJlbWFpbCI6ImFkbWluQGFkbWluLmNvbSIsImlhdCI6MTc3MDM5MjU5MiwiZXhwIjoxNzcwNDc4OTkyfQ.zJyN9zjAjz38fRQk1qjnM1PMGSgMzzNBWv0FhDw4U9E"
```

**Respuesta esperada:**
```json
{
  "status": 200,
  "message": "Job eliminado exitosamente"
}
```

---

## � ¡Atajo! Importar Collection de Postman

Para ahorrarte tiempo, ya hay una **collection completa lista para importar** con todos los requests configurados.

### Paso 1: Importar a Postman

1. **Abrir Postman**
2. **Click en "Import"** (esquina superior izquierda)
3. **Arrastrar y soltar** el archivo: `postman-collection-video-express.json`
   - O hacer click en "Upload Files" y seleccionar el archivo
   - Ruta: `/api/postman-collection-video-express.json`
4. **¡Listo!** Verás la collection "Product Video Express API" con 6 requests:
   - 1. Get Stats
   - 2. List Jobs
   - 3. Create Video Job ⭐
   - 4. Get Job Status
   - 5. Download Video
   - 6. Delete Job

### Paso 2: Verificar Variables

La collection ya incluye las variables configuradas:
- ✅ `base_url` = `http://localhost:3500`
- ✅ `admin_token` = Tu token actual
- ✅ `job_id` = Se guarda automáticamente al crear un job

**Para verificar/editar las variables:**
- Click en la collection → Tab "Variables"
- Editar si tu puerto es diferente a 3500
- El `admin_token` ya está configurado con tu token

### Paso 3: Usar la Collection

1. **Ejecutar en orden:**
   - Request 1 y 2: Para verificar que funciona
   - Request 3: Subir una imagen y crear job (¡guarda el job_id!)
   - Request 4: Consultar estado (repetir cada 30s)
   - Request 5: Descargar video cuando esté completado
   - Request 6: Eliminar job (opcional)

2. **Tests automáticos incluidos:**
   - Cada request valida la respuesta
   - Los errores se muestran en el tab "Test Results"
   - Los logs útiles aparecen en Console (View → Show Postman Console)

3. **Variables automáticas:**
   - Cuando creas un job (Request 3), el `job_id` se guarda automáticamente
   - Los siguientes requests usan `{{job_id}}` automáticamente

### Ventajas de usar la Collection

✅ **Tests automáticos** incluidos en cada request  
✅ **Variables** ya configuradas y se guardan automáticamente  
✅ **Logs útiles** en la consola de Postman  
✅ **Validaciones** de respuesta para detectar errores  
✅ **Documentación** incluida en cada request

---

## �🐛 Troubleshooting

### Error: "La imagen del producto es requerida"
**Causa:** No se está enviando el archivo correctamente  
**Solución:** Verificar que la ruta de la imagen sea correcta y usar `@` antes de la ruta

### Job se queda en "pending" indefinidamente
**Causa:** El cron job no está corriendo  
**Solución:** Verificar logs del servidor, debería aparecer cada 30s:
```
⏰ [Cron] Ejecutando polling de Video Express...
```

### Error: "FAL_API_KEY no está configurada"
**Causa:** La variable de entorno no está en el `.env`  
**Solución:** Verificar que `.env.development` tenga `FAL_API_KEY`

### Job falla con "Error en fal.ai"
**Causa:** Problema con la API key o la imagen  
**Solución:** 
1. Verificar que la `FAL_API_KEY` sea válida
2. Verificar que la imagen sea JPG/PNG
3. Verificar que la imagen no esté corrupta

---

## 📊 Verificar Estado del Sistema

```bash
# Ver jobs en la base de datos
mysql -u root -p -e "USE ecommercedb; SELECT id, status, animation_style, created_at FROM video_jobs ORDER BY created_at DESC LIMIT 5;"

# Ver archivos generados
ls -lh api/public/uploads/modules/video-express/

# Ver logs del servidor en tiempo real
# (en la terminal donde corre el servidor)
```

---

## ✅ Checklist Final

### Tests Completados
- [ ] ✅ Endpoint `/stats` funciona
- [ ] ✅ Endpoint `/jobs` (GET) funciona
- [ ] ⭐ Endpoint `/jobs` (POST) - crear job de prueba
- [ ] 🔄 Cron job está consultando el estado cada 30s
- [ ] 📊 Job pasa de `pending` → `processing` → `completed`
- [ ] 📥 Video se descarga correctamente
- [ ] 🎬 Video se reproduce sin problemas

### Herramientas Listas
- [ ] Collection de Postman importada
- [ ] Variables de entorno configuradas
- [ ] Imagen de prueba preparada

---

## 🎥 Demo: Flujo Completo

### Escenario de Prueba Real

**1. Preparación (1 min)**
```
✓ Postman abierto con collection importada
✓ Imagen de producto lista (ej: zapato, reloj, bolso)
✓ Servidor corriendo en otra terminal
```

**2. Crear Job (30 seg)**
```
✓ Request "3. Create Video Job"
✓ Subir imagen
✓ Seleccionar style: "parallax"
✓ Send → Copiar job_id
```

**3. Polling (60-90 seg)**
```
✓ Request "4. Get Job Status"
✓ Send cada 30s
✓ Observar: pending → processing → completed
✓ Logs del servidor muestran progreso
```

**4. Resultado (30 seg)**
```
✓ Request "5. Download Video"
✓ Save to file: "mi_video.mp4"
✓ Abrir y reproducir
✓ ¡Video de 5 segundos con animación cinematográfica! 🎬
```

**Tiempo total:** ~3 minutos ⏱️

---

## 🚀 Siguiente Paso

Una vez que hayas completado estos tests y todo funcione correctamente, podemos proceder con:

**Opción B: Crear el frontend Angular para el Admin Panel**

Componentes a crear:
- Formulario de subida de imagen
- Lista de jobs con estados en tiempo real
- Vista previa y descarga de videos
- Estadísticas visuales

**¿Listo para continuar con el frontend?**
