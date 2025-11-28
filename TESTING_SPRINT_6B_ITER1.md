# 🧪 GUÍA DE TESTING - SPRINT 6B ITERACIÓN 1
## Email "Order Shipped" + Tracking

---

## ✅ RESUMEN DE IMPLEMENTACIÓN

### **Archivos Creados:**
1. ✅ `api/src/services/emailNotification.service.js` - Servicio unificado de emails
2. ✅ `api/src/mails/email_order_shipped.html` - Template profesional
3. ✅ `api/src/controllers/helpers/testEmailNotifications.controller.js` - Endpoints de testing

### **Archivos Modificados:**
1. ✅ `api/src/controllers/proveedor/printful/webhookPrintful.controller.js` - Integración con webhook
2. ✅ `api/src/routes/productsPrintful.routes.js` - Nuevas rutas de testing

---

## 🚀 CÓMO PROBAR

### **OPCIÓN 1: Test Directo de Email (Sin Webhook)**

Envía un email de prueba directamente a partir de una Sale existente:

```bash
curl -X POST http://localhost:3500/api/printful/test/send-shipped-email \
  -H "Content-Type: application/json" \
  -d '{
    "saleId": 103
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Email enviado exitosamente",
  "recipient": "cliente@email.com",
  "messageId": "...",
  "data": {
    "saleId": 103,
    "printfulOrderId": "134812999",
    "trackingNumber": "TEST123456789ES",
    "products": 2
  }
}
```

**✅ Verificar:**
- Email recibido en la bandeja del cliente
- Diseño responsive y profesional
- Tracking number visible
- Botón "Rastrear Pedido" funcional
- Productos mostrados correctamente
- Fecha estimada de entrega visible

---

### **OPCIÓN 2: Simulación Completa de Webhook**

Simula el webhook completo de Printful (actualiza DB + envía email):

```bash
curl -X POST http://localhost:3500/api/printful/test/simulate-package-shipped \
  -H "Content-Type: application/json" \
  -d '{
    "saleId": 103,
    "trackingNumber": "DHL12345678ES",
    "carrier": "DHL Express"
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Webhook package_shipped simulado exitosamente",
  "webhookPayload": { ... },
  "note": "Revisa los logs del servidor para ver el resultado del webhook"
}
```

**✅ Verificar:**
1. Base de datos actualizada:
   - `Sale.printfulStatus = 'shipped'`
   - `Sale.syncStatus = 'shipped'`
   - `Sale.trackingNumber` actualizado
   - `Sale.trackingUrl` actualizado
   - `Sale.carrier` actualizado
   - `Sale.shippedAt` actualizado

2. Email enviado al cliente

3. Logs del servidor:
   ```
   🚚 [WEBHOOK] Procesando package_shipped...
   📦 External ID: 103 | Printful ID: 134812999
   ✅ [WEBHOOK] Orden #103 marcada como enviada
   📍 Tracking: DHL12345678ES
   🚚 Carrier: DHL Express
   📧 [WEBHOOK] Email enviado a cliente@email.com
   ```

---

### **OPCIÓN 3: Testing con Webhook Real de Printful**

1. **Configurar webhook en Printful Dashboard:**
   - URL: `https://tu-dominio.com/api/printful/webhook`
   - Events: Selecciona `package_shipped`

2. **Usar ngrok para desarrollo local:**
   ```bash
   ngrok http 3500
   ```
   
   Copiar la URL de ngrok (ej: `https://abc123.ngrok.io`) y configurarla en Printful.

3. **Verificar en Dashboard de Printful:**
   - Ir a Webhooks
   - Ver logs de webhooks enviados
   - Status: 200 OK

---

## 📧 VERIFICACIÓN DEL EMAIL

### **Elementos a Verificar en el Email:**

#### **Header:**
- ✅ Título: "📦 ¡Tu Pedido Está en Camino!"
- ✅ Printful Order ID visible: `#PF134812999`
- ✅ Gradiente verde (success)

#### **Tracking Section:**
- ✅ Número de seguimiento destacado
- ✅ Botón "🔍 Rastrear Pedido" con link funcional
- ✅ Fondo verde con contraste

#### **Fecha de Entrega:**
- ✅ Estimación visible (ej: "viernes, 05 de diciembre de 2025")
- ✅ Warning box amarillo

#### **Información de Envío:**
- ✅ Transportista: DHL Express
- ✅ Servicio: Standard International
- ✅ Fecha de envío
- ✅ Dirección de entrega

#### **Timeline Visual:**
- ✅ 5 pasos mostrados
- ✅ Primeros 3 con checkmark verde
- ✅ Últimos 2 pendientes (gris)

#### **Productos:**
- ✅ Imágenes cargadas correctamente
- ✅ Nombre del producto
- ✅ Cantidad
- ✅ Talla (si aplica)

#### **Footer:**
- ✅ Iconos sociales
- ✅ Copyright con año actual
- ✅ Links funcionales

---

## 🐛 TROUBLESHOOTING

### **Email no se envía:**

1. Verificar variables de entorno:
   ```bash
   echo $SMTP_HOST
   echo $SMTP_PORT
   echo $EMAIL_USER
   echo $EMAIL_PASS
   ```

2. Revisar logs del servidor:
   ```
   ❌ SMTP Configuration Error: Missing required environment variables
   ```

3. Verificar conexión SMTP:
   ```bash
   telnet smtp.gmail.com 465
   ```

### **Email se envía pero no llega:**

1. Revisar carpeta de spam
2. Verificar que el dominio del remitente está autorizado
3. Revisar logs del servidor para `messageId`

### **Tracking URL no funciona:**

1. Verificar formato del tracking number
2. Verificar que el carrier está correctamente mapeado
3. Testear URL manualmente en navegador

### **Sale no se encuentra:**

```json
{
  "success": false,
  "message": "Sale con ID 103 no encontrada"
}
```

**Solución:** Verificar que el `saleId` existe en la base de datos.

### **No se encontró email del cliente:**

```json
{
  "success": false,
  "message": "No se encontró email del cliente"
}
```

**Solución:** Verificar que la Sale tiene asociado un User o Guest con email válido.

---

## 📊 CASOS DE PRUEBA RECOMENDADOS

### **Caso 1: Sale con User registrado**
```bash
curl -X POST http://localhost:3500/api/printful/test/send-shipped-email \
  -H "Content-Type: application/json" \
  -d '{"saleId": 103}'
```
**Expectativa:** Email enviado al User.email

---

### **Caso 2: Sale con Guest**
```bash
curl -X POST http://localhost:3500/api/printful/test/send-shipped-email \
  -H "Content-Type: application/json" \
  -d '{"saleId": 104}'
```
**Expectativa:** Email enviado al Guest.email

---

### **Caso 3: Sale con múltiples productos**
```bash
curl -X POST http://localhost:3500/api/printful/test/send-shipped-email \
  -H "Content-Type: application/json" \
  -d '{"saleId": 105}'
```
**Expectativa:** Todos los productos mostrados en el email

---

### **Caso 4: Sale con producto sin variante**
**Expectativa:** Email sin mostrar "Talla"

---

### **Caso 5: Simulación completa de webhook**
```bash
curl -X POST http://localhost:3500/api/printful/test/simulate-package-shipped \
  -H "Content-Type: application/json" \
  -d '{
    "saleId": 103,
    "trackingNumber": "UPS1Z9999W9999999999",
    "carrier": "UPS"
  }'
```
**Expectativa:** 
- DB actualizada con tracking UPS
- Email enviado con tracking UPS

---

## ✅ CHECKLIST FINAL

Antes de considerar la iteración completa, verificar:

- [ ] Email se envía correctamente desde el test endpoint
- [ ] Email tiene diseño profesional y responsive
- [ ] Tracking button funciona y redirige correctamente
- [ ] Productos se muestran con imágenes correctas
- [ ] Fecha estimada se calcula bien
- [ ] Timeline visual se muestra correctamente
- [ ] Footer con año actual dinámico
- [ ] Webhook `package_shipped` actualiza DB correctamente
- [ ] Webhook `package_shipped` envía email automáticamente
- [ ] Logs del servidor son claros y descriptivos
- [ ] No hay errores en consola
- [ ] Email llega a bandeja (no spam)
- [ ] Links del email funcionan correctamente
- [ ] Email es compatible con clientes populares (Gmail, Outlook, Apple Mail)

---

## 🎯 PRÓXIMOS PASOS

Una vez validada esta iteración:

1. **Iteración 2:** Email "Order Printing" (order_created)
2. **Iteración 3:** Admin Failed Alert
3. **Iteración 4:** Daily Report + Delivered email

---

## 📝 NOTAS IMPORTANTES

- Los endpoints de test son **temporales** y deben eliminarse en producción
- El servicio de email maneja errores sin romper el flujo del webhook
- Si el email falla, el webhook se marca como procesado exitosamente (para no reintentar)
- Los logs son verbosos para facilitar debugging

---

## 🚀 DEPLOYMENT

Para producción:

1. Configurar variables de entorno:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   EMAIL_USER=noreply@tudominio.com
   EMAIL_PASS=tu_password_segura
   ADMIN_EMAIL=admin@tudominio.com
   URL_FRONTEND=https://tudominio.com
   URL_BACKEND=https://api.tudominio.com
   ```

2. Eliminar endpoints de test en `productsPrintful.routes.js`

3. Configurar webhook en Printful con URL pública

4. Monitorear logs de webhooks en admin dashboard

---

**Desarrollado por:** Claude (Sprint 6B - Iteración 1)  
**Fecha:** 28 de noviembre de 2025  
**Status:** ✅ Listo para testing
