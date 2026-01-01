# 📸 Sistema de Upload de Screenshots para Módulos

## ✅ Implementación Completada

El sistema ahora permite subir imágenes **desde el ordenador local** en lugar de depender de URLs externas.

### 🎯 Características

- ✅ Upload múltiple de imágenes (hasta 10 simultáneas)
- ✅ Validación de formatos: JPG, PNG, GIF, WebP
- ✅ Límite de 5MB por imagen
- ✅ Almacenamiento en: `/api/public/uploads/modules/{moduleKey}/`
- ✅ URLs generadas automáticamente
- ✅ Preview en tiempo real en el admin
- ✅ Opción alternativa: agregar URLs manuales
- ✅ Landing page lista para mostrar screenshots

### 📁 Estructura de Archivos

```
api/
├── src/
│   └── controllers/
│       └── modules.upload.controller.js  ← Nuevo controller de upload
│   └── routes/
│       └── modules.routes.js            ← Actualizado con rutas de upload
├── public/
    └── uploads/
        └── modules/
            ├── .gitkeep                  ← Mantiene el directorio en git
            └── {moduleKey}/              ← Carpetas por módulo
                ├── screenshot-1234567890.jpg
                ├── screenshot-9876543210.png
                └── ...

admin/
└── src/
    └── app/
        ├── services/
        │   └── modules.service.ts       ← Nuevo método uploadModuleScreenshots()
        └── modules/
            └── modules-management/
                └── module-form/
                    ├── module-form.component.ts   ← Métodos de upload
                    └── module-form.component.html ← File input + preview

ecommerce/
└── src/
    └── app/
        └── components/
            └── module-landing/
                └── module-landing.component.html  ← Ya muestra screenshots
```

### 🚀 Cómo Usar (Admin Panel)

1. **Ve al formulario de módulos**: `/modules-management/create` o `/modules-management/edit/:key`

2. **Ingresa primero el "key" del módulo** (requerido para crear la carpeta)

3. **Sección "Screenshots"**:
   - **Opción A (Recomendado)**: Click en "Subir Imágenes desde PC"
     - Selecciona 1-10 imágenes
     - Se suben automáticamente
     - Las URLs se agregan al módulo
   
   - **Opción B (Manual)**: Pega una URL y click "Agregar URL"

4. **Preview**: Ver thumbnails de todas las imágenes agregadas

5. **Guardar**: Las URLs se guardan en el campo `screenshots` del módulo

### 📡 API Endpoints

```
POST   /api/modules/:moduleKey/screenshots          # Subir imágenes
DELETE /api/modules/:moduleKey/screenshots/:filename # Eliminar una imagen
DELETE /api/modules/:moduleKey/screenshots          # Limpiar todas las imágenes
```

### 🔒 Seguridad

- ✅ Solo admins autenticados pueden subir
- ✅ Validación de tipos MIME
- ✅ Límite de tamaño (5MB por imagen)
- ✅ Nombres únicos (timestamp + random)
- ✅ Imágenes NO se versionan en git

### 🌐 URLs Generadas

**Desarrollo:**
```
http://127.0.0.1:3500/uploads/modules/seo-automation-dashboard/screenshot-1735747200000-123456789.jpg
```

**Producción:**
```
https://api.lujandev.com/uploads/modules/seo-automation-dashboard/screenshot-1735747200000-123456789.jpg
```

### 📦 Almacenamiento en Git

Las imágenes **NO se versionan** pero la estructura **SÍ**:

```gitignore
# .gitignore
public/uploads/**/*
!public/uploads/**/.gitkeep
!public/uploads/modules/.gitkeep
```

### 🎨 Frontend (Ecommerce)

La landing page automáticamente muestra los screenshots en galería:

```html
<!-- module-landing.component.html -->
<div class="row mb-5" *ngIf="module.screenshots && module.screenshots.length > 0">
  <div class="col-lg-10 mx-auto">
    <h3 class="text-center mb-4">Vista previa</h3>
    <div class="row g-3">
      <div class="col-md-6" *ngFor="let screenshot of module.screenshots">
        <div class="card shadow-sm">
          <img [src]="screenshot" class="card-img-top" style="height: 300px; object-fit: cover;">
        </div>
      </div>
    </div>
  </div>
</div>
```

### 🧪 Ejemplo de Uso

1. **Crear módulo "SEO Automation Dashboard"**:
   - Key: `seo-automation-dashboard`
   - Name: "SEO Automation Dashboard"
   - Tagline: "Automatiza sitemap.xml y robots.txt desde tu admin"

2. **Subir 4 screenshots**:
   - Dashboard principal
   - Configuración de sitemap
   - Listado de URLs
   - Robots.txt editor

3. **Resultado**:
   - Landing page en: `/seo-automation-dashboard`
   - Galería con 4 screenshots
   - URLs almacenadas en DB
   - Imágenes servidas desde `/public/uploads/modules/`

### ⚡ Ventajas del Sistema

1. ✅ **Sin hosting externo**: No necesitas Cloudinary, AWS S3, etc.
2. ✅ **UX mejorada**: Upload drag & drop desde el admin
3. ✅ **URLs persistentes**: Las imágenes se quedan en el servidor
4. ✅ **Backup incluido**: Las imágenes están en el servidor (backupearlas con el resto)
5. ✅ **SEO-friendly**: URLs limpias y directas
6. ✅ **Sin costos extra**: Almacenamiento local gratuito

### 🚨 Consideraciones de Producción

1. **Backups**: Incluir `/public/uploads/` en tu estrategia de backup
2. **CDN (opcional)**: Puedes agregar Cloudflare para cachear las imágenes
3. **Límites**: Configurar limits de storage en el servidor
4. **Limpieza**: Implementar job para limpiar imágenes huérfanas

### 📝 TODO Futuro (Opcional)

- [ ] Drag & drop para reordenar screenshots
- [ ] Resize automático al subir (generar thumbnails)
- [ ] Compresión automática (sharp/imagemagick)
- [ ] CDN integration (Cloudflare R2)
- [ ] Watermark automático
- [ ] Lightbox en frontend para zoom

---

## ✅ Sistema Listo para Vender Módulos

Ahora puedes crear módulos completamente vendibles con:
- ✅ Screenshots profesionales
- ✅ Descripciones detalladas
- ✅ Features listadas
- ✅ Tech stack visible
- ✅ Landing pages atractivas

**Todo sin depender de hosting externo de imágenes.**
