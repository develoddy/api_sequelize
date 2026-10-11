# 🧪 Email Testing API

**Sistema para probar templates de email SIN afectar el módulo de Printful existente.**

## 📋 Endpoints disponibles:

### 1. **GET** `/api/email-testing/sales`
**Obtener ventas disponibles para testing**
```bash
curl http://localhost:3000/api/email-testing/sales
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Ventas disponibles para testing",
  "sales": [
    {
      "saleId": 123,
      "transaction": "sale_123_1734567890",
      "total": "29.99",
      "country": "fr",
      "locale": "fr",
      "customer": "Cliente Francés",
      "email": "cliente@example.com",
      "createdAt": "2024-12-18T...",
      "printfulId": 456789
    }
  ]
}
```

---

### 2. **POST** `/api/email-testing/email/printing`
**Probar email de orden en impresión**
```bash
curl -X POST http://localhost:3000/api/email-testing/email/printing \
  -H "Content-Type: application/json" \
  -d '{
    "saleId": 123,
    "testEmail": "test@tudominio.com"
  }'
```

---

### 3. **POST** `/api/email-testing/email/shipped`
**Probar email de envío**
```bash
curl -X POST http://localhost:3000/api/email-testing/email/shipped \
  -H "Content-Type: application/json" \
  -d '{
    "saleId": 123,
    "testEmail": "test@tudominio.com"
  }'
```

---

### 4. **POST** `/api/email-testing/email/delivered`
**Probar email de entrega**
```bash
curl -X POST http://localhost:3000/api/email-testing/email/delivered \
  -H "Content-Type: application/json" \
  -d '{
    "saleId": 123,
    "testEmail": "test@tudominio.com"
  }'
```

---

## 🔧 Uso desde Admin Panel:

### Paso 1: Obtener ventas
```javascript
// En tu admin, hacer petición GET
fetch('/api/email-testing/sales')
  .then(res => res.json())
  .then(data => {
    console.log('Ventas disponibles:', data.sales);
    // Mostrar en interfaz para seleccionar
  });
```

### Paso 2: Enviar email de prueba
```javascript
// Seleccionar venta y enviar email
const testEmail = (saleId, emailType) => {
  fetch(`/api/email-testing/email/${emailType}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      saleId: saleId,
      testEmail: 'tu-email-de-prueba@gmail.com'
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      alert(`✅ Email ${emailType} enviado correctamente`);
      console.log(`País: ${data.country}, Idioma: ${data.locale}`);
    } else {
      alert(`❌ Error: ${data.message}`);
    }
  });
};

// Ejemplos de uso:
testEmail(123, 'printing');  // Email de impresión
testEmail(123, 'shipped');   // Email de envío
testEmail(123, 'delivered'); // Email de entrega
```

---

## 🎯 Qué verifica cada test:

### **Email de impresión** (`email_order_printing.html`)
- ✅ URL correcta: `/{country}/{locale}/account/mypurchases`
- ✅ Datos del cliente y pedido
- ✅ Lista de productos

### **Email de envío** (`email_order_shipped.html`) 
- ✅ URL correcta: `/{country}/{locale}/account/mypurchases`
- ✅ Número de tracking simulado
- ✅ Datos de transportista

### **Email de entrega** (`email_order_delivered.html`)
- ✅ Confirmación de entrega
- ✅ Fecha de entrega simulada
- ✅ URLs dinámicas si las tiene

---

## 🔒 Seguridad:

- ❌ **NO afecta el módulo de Printful real**
- ❌ **NO modifica órdenes existentes**
- ❌ **NO interfiere con webhooks de Printful**
- ✅ **Solo simula emails para testing**
- ✅ **Usa datos reales de ventas pero con datos simulados de Printful**

---

## 📧 Ejemplos de testing por país:

```bash
# Probar email francés
curl -X POST http://localhost:3000/api/email-testing/email/shipped \
  -d '{"saleId": 123, "testEmail": "test@example.com"}'
# Resultado: URLs con /fr/fr/account/mypurchases

# Probar email alemán  
curl -X POST http://localhost:3000/api/email-testing/email/printing \
  -d '{"saleId": 456, "testEmail": "test@example.com"}'
# Resultado: URLs con /de/de/account/mypurchases
```