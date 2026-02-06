# 🚀 Quick Start - Product Video Express

## 1️⃣ Importar a Postman (30 seg)

1. Abrir Postman
2. Click "Import" → Seleccionar `postman-collection-video-express.json`
3. ✅ Listo - 6 requests configurados

## 2️⃣ Crear tu Primer Video (3 min)

### Request 1 & 2: Verificar que funciona
```
→ "1. Get Stats" → Send
→ "2. List Jobs" → Send
```
✅ Ambos deberían devolver 200 OK

### Request 3: Subir imagen ⭐
```
→ "3. Create Video Job"
→ Body → product_image → Select Files → [tu imagen]
→ animation_style = parallax
→ Send
```
✅ Devuelve job_id (se guarda automáticamente)

### Request 4: Ver progreso 🔄
```
→ "4. Get Job Status"
→ Send (repetir cada 30 segundos)
→ Esperar status = "completed"
```
⏱️ Toma 60-90 segundos

### Request 5: Descargar video 📥
```
→ "5. Download Video"
→ Send
→ Save Response → Save to a file
→ Guardar como: mi_video.mp4
```
🎬 ¡Abre el video y disfruta!

---

## 🔑 Variables Incluidas

Ya configuradas en la collection:
- `base_url` = http://localhost:3500
- `admin_token` = tu token actual
- `job_id` = se guarda automáticamente

---

## 🎨 Estilos de Animación

Edita `animation_style` en Request 3:

| Valor | Efecto |
|-------|--------|
| `parallax` | Profundidad 2.5D (recomendado) |
| `zoom_in` | Zoom cinematográfico |
| `subtle_float` | Levitación suave |

---

## 🐛 Problemas Comunes

**"Cannot GET /video-express/..."**  
→ Verifica que el servidor esté corriendo

**Job en "pending" indefinidamente**  
→ Revisa logs: debería aparecer cada 30s el polling

**"La imagen del producto es requerida"**  
→ Selecciona una imagen en Body → product_image

---

## ✅ Checklist Express

- [ ] Postman abierto con collection
- [ ] Imagen de producto lista
- [ ] Servidor corriendo (`npm run dev`)
- [ ] Request 3 ejecutado con éxito
- [ ] Video descargado y reproducido

---

**¿Listo?** Abre Postman y empieza en 30 segundos 🚀

**Documentación completa:** [TEST-VIDEO-EXPRESS.md](./TEST-VIDEO-EXPRESS.md)
