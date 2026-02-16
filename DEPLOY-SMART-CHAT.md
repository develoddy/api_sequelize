# 🚀 DEPLOY SMART CHAT MULTI-TENANT - PRODUCCIÓN

## 📋 Pre-requisitos
- Git actualizado en servidor producción
- PM2 corriendo
- MySQL con migraciones aplicadas

---

## 🔄 PASOS PARA DEPLOY

### 1️⃣ Subir cambios a Git (Local)
```bash
cd /Volumes/lujandev/dev/projects/ECOMMERCE/ECOMMERCE-MEAN/api

# Verificar cambios
git status

# Agregar archivos
git add .

# Commit
git commit -m "feat: Smart Chat multi-tenant backend (Sprint 1)"

# Push
git push origin main
```

---

### 2️⃣ Actualizar código en producción
```bash
# Conectar a servidor producción
ssh tu_usuario@tu_servidor

# Ir a directorio del proyecto
cd /var/www/api_sequelize

# Pull de cambios
git pull origin main

# Limpiar archivos basura de macOS
find . -name '._*' -delete
```

---

### 3️⃣ Instalar nuevas dependencias
```bash
# En servidor producción
cd /var/www/api_sequelize

# Instalar dependencias nuevas (moment-timezone, etc.)
npm install

# Verificar que moment-timezone se instaló
npm list moment-timezone
```

---

### 4️⃣ Ejecutar migraciones
```bash
# En servidor producción
cd /var/www/api_sequelize

# Ver estado de migraciones
NODE_ENV=production npx sequelize-cli db:migrate:status

# Aplicar migraciones pendientes
NODE_ENV=production npx sequelize-cli db:migrate

# Deberías ver:
# ✅ 20260216000000-add-chat-multi-tenant.cjs - migrated
# ✅ 20260216000001-fix-guest-id-type.cjs - migrated
```

---

### 5️⃣ Crear configuración inicial para Tenant 1
```bash
# En servidor producción, conectar a MySQL
mysql -u usuario -p nombre_base_datos

# Insertar config para Tenant 1
INSERT INTO tenant_chat_config (
  tenant_id, widget_color, widget_position, welcome_message, 
  integration_type, is_active, created_at, updated_at
) VALUES (
  1, '#4F46E5', 'bottom-right', '👋 ¡Hola! ¿En qué podemos ayudarte?',
  'native', 1, NOW(), NOW()
);

# Verificar
SELECT id, tenant_id, is_active, integration_type FROM tenant_chat_config;

# Salir
exit;
```

---

### 6️⃣ Reiniciar PM2
```bash
# En servidor producción
pm2 restart api_sequelize

# Verificar que arrancó sin errores
pm2 logs api_sequelize --lines 50

# Verificar estado
pm2 status
```

---

### 7️⃣ Verificar funcionamiento
```bash
# Test de endpoints REST
curl -X GET https://api.lujandev.com/api/chat/tenant/config \
  -H "X-Tenant-Id: 1"

# Debería devolver el config del tenant 1
```

---

### 8️⃣ Probar en navegador
```
1. Abrir: https://api.lujandev.com/test-multi-tenant-chat.html
2. Seleccionar: Tenant 1
3. Click: Conectar
4. Escribir mensaje: "Hola desde producción"
5. Enviar

Debería:
✅ Conectarse vía Socket.IO
✅ Mostrar "Conectado a Tenant 1"
✅ Enviar mensaje correctamente
✅ Ver mensaje en chat
```

---

## 🔍 TROUBLESHOOTING

### Error: ERR_MODULE_NOT_FOUND
```bash
# Instalar todas las dependencias
cd /var/www/api_sequelize
npm install
pm2 restart api_sequelize
```

### Error: Migration not found
```bash
# Verificar que los archivos de migración existen
ls -la migrations/ | grep 20260216

# Limpiar archivos basura
find migrations/ -name '._*' -delete

# Reintenta migración
NODE_ENV=production npx sequelize-cli db:migrate
```

### Error: Socket.IO connection failed
```bash
# Verificar que el servidor está corriendo
pm2 status

# Ver logs en tiempo real
pm2 logs api_sequelize

# Verificar puerto
netstat -tuln | grep 3500
```

### Error: CORS policy
- ✅ Ya corregido en test-multi-tenant-chat.html (detecta automáticamente el servidor)
- Asegúrate de que el archivo actualizado esté en producción

---

## 📦 DEPENDENCIAS NUEVAS INSTALADAS

```json
{
  "moment-timezone": "^0.5.43"
}
```

---

## 🗂️ ARCHIVOS NUEVOS/MODIFICADOS

### Nuevos:
- `migrations/20260216000000-add-chat-multi-tenant.cjs`
- `migrations/20260216000001-fix-guest-id-type.cjs`
- `src/models/chat/TenantChatConfig.js`
- `src/models/chat/TenantAgent.js`
- `src/middlewares/tenant-auth.middleware.js`
- `src/controllers/chat/chat-tenant.controller.js`
- `src/controllers/chat/socket-tenant.controller.js`
- `src/routes/chat-tenant.routes.js`
- `src/services/chat/chat.service.js`
- `public/test-multi-tenant-chat.html`
- `README-SMART-CHAT.md`
- `STRUCTURE.md`
- `setup-smart-chat.sh`
- `test-endpoints.sh`

### Modificados:
- `src/models/chat/ChatConversation.js` (agregado tenant_id)
- `src/models/chat/ChatMessage.js` (agregado tenant_id)
- `server.js` (rutas y Socket.IO multi-tenant)

---

## ✅ CHECKLIST DE DEPLOY

- [ ] Código subido a Git
- [ ] Git pull en producción
- [ ] `npm install` ejecutado
- [ ] Migraciones aplicadas
- [ ] Config Tenant 1 insertado en DB
- [ ] PM2 reiniciado sin errores
- [ ] Endpoint REST respondiendo
- [ ] Socket.IO conectando correctamente
- [ ] Mensajes enviándose y guardándose en DB

---

## 📞 COMANDOS RÁPIDOS

```bash
# Deploy completo (desde servidor producción)
cd /var/www/api_sequelize && \
git pull origin main && \
find . -name '._*' -delete && \
npm install && \
NODE_ENV=production npx sequelize-cli db:migrate && \
pm2 restart api_sequelize && \
pm2 logs api_sequelize --lines 20
```

---

**Última actualización**: 16 de Febrero 2026  
**Sprint**: 1 - Backend Multi-tenant  
**Estado**: ✅ Listo para producción
