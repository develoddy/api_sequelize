# 🧪 Guía de Testing - Upload de Screenshots

## ✅ Verificación Completada

### 1. Backend Files Saved ✓
Las imágenes **SÍ se están guardando correctamente** en:
```
/api/public/uploads/modules/seo-automation-dashboard/
└── screenshot-1767294202798-499008004.png (161KB)
```

### 2. Sistema Implementado

#### **Backend:**
- ✅ Multer configurado con diskStorage
- ✅ Ruta POST `/modules/:moduleKey/screenshots` con auth
- ✅ Logging agregado para debugging
- ✅ Archivos guardados con nombre único: `screenshot-{timestamp}-{random}.{ext}`
- ✅ URLs generadas: `http://127.0.0.1:3500/uploads/modules/{moduleKey}/{filename}`

#### **Frontend:**
- ✅ Drag & Drop implementado
- ✅ Click para seleccionar archivos
- ✅ Preview de imágenes subidas
- ✅ Loading spinner con estado mejorado
- ✅ Validaciones de formato y tamaño

## 🔍 Testing Manual

### Test 1: Upload desde Admin
1. Ir a Admin → Modules Management → Create Module
2. Ingresar un "key" (ej: `test-module`)
3. **Opción A:** Hacer clic en la zona de drag & drop
4. **Opción B:** Arrastrar imágenes directamente
5. Verificar que aparece "Subiendo imágenes..."
6. Verificar que aparece el toast de éxito
7. Verificar que las imágenes aparecen en el preview

### Test 2: Verificar Backend
```bash
# Ver archivos guardados
ls -la /api/public/uploads/modules/{moduleKey}/

# Ver logs del backend (debe mostrar):
# 📸 Upload request received
# ✅ Saved: screenshot-XXX.png
# ✅ Upload completed successfully
```

### Test 3: Verificar URLs Accesibles
```bash
# Probar URL directamente
curl -I http://127.0.0.1:3500/uploads/modules/seo-automation-dashboard/screenshot-1767294202798-499008004.png

# Debe devolver: HTTP/1.1 200 OK
```

### Test 4: Landing Page
1. Guardar el módulo con screenshots
2. Ir a `http://localhost:4200/seo-automation-dashboard`
3. Verificar que las imágenes se muestran en la galería
4. Hacer clic en una imagen para ampliar

## 🐛 Debugging

### Si el loading no se detiene:

1. **Verificar Console del Admin:**
   ```javascript
   // Debe aparecer en browser console:
   "✅ Upload successful: {ok: true, screenshots: [...]}"
   ```

2. **Verificar Backend Logs:**
   ```bash
   # En la terminal del backend debe aparecer:
   📸 Upload request received
   Module Key: seo-automation-dashboard
   Files count: 1
   ✅ Saved: screenshot-XXX.png
   ✅ Upload completed successfully
   ```

3. **Verificar Network Tab:**
   - Abrir DevTools → Network
   - Filtrar por "screenshots"
   - Verificar que POST devuelve `200 OK`
   - Ver response body: `{ok: true, screenshots: [...]}`

### Si no aparece en Backend Logs:

1. **Verificar que backend está corriendo:**
   ```bash
   ps aux | grep node
   ```

2. **Verificar puerto 3500:**
   ```bash
   lsof -i :3500
   ```

3. **Reiniciar backend:**
   ```bash
   cd /api
   npm run dev
   ```

### Si hay error de CORS:

Verificar que en `/api/src/app.js` está configurado:
```javascript
app.use(cors({
  origin: ['http://localhost:4200', 'http://localhost:4202'],
  credentials: true
}));
```

### Si aparece error 401 (Unauthorized):

Verificar que el admin está logueado y el token es válido:
```javascript
// En browser console:
localStorage.getItem('token')
```

## 📊 Resultado Esperado

### Response del Backend:
```json
{
  "ok": true,
  "message": "1 imagen(es) subida(s) correctamente",
  "screenshots": [
    "http://127.0.0.1:3500/uploads/modules/seo-automation-dashboard/screenshot-1767294202798-499008004.png"
  ],
  "files": [
    {
      "filename": "screenshot-1767294202798-499008004.png",
      "size": 161001,
      "url": "http://127.0.0.1:3500/uploads/modules/seo-automation-dashboard/screenshot-1767294202798-499008004.png"
    }
  ]
}
```

### Frontend State después de Upload:
```typescript
this.uploadingScreenshot = false; // Loading OFF
this.screenshots = [
  "http://127.0.0.1:3500/uploads/modules/seo-automation-dashboard/screenshot-1767294202798-499008004.png"
];
this.selectedFiles = []; // Limpio
```

## 🎯 Mejoras Implementadas

1. ✅ **Drag & Drop:** Zona de arrastre con feedback visual
2. ✅ **Click to Upload:** Input file oculto pero funcional
3. ✅ **Loading Mejorado:** Spinner con mensaje descriptivo
4. ✅ **Logging Detallado:** Console logs en frontend y backend
5. ✅ **Hover Effects:** Zona cambia de color al pasar el mouse
6. ✅ **Preview Grid:** Imágenes en cards con botón de eliminar
7. ✅ **Validaciones:** Formato y tamaño validados por multer

## 🚀 Próximos Pasos

1. **Testing Completo:** Probar con múltiples imágenes (2-5 archivos)
2. **Error Handling:** Probar con archivos muy grandes (>5MB)
3. **Formato Inválido:** Probar con PDF o .txt para ver error
4. **Eliminación:** Probar botón de eliminar screenshot
5. **Landing Page:** Verificar galería en frontend público
