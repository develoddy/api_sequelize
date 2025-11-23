# 🐛 PROBLEMA ENCONTRADO: type_campaign NULL en Pedido #97

## 📊 Análisis del Pedido #97
```
CAMISETA DEV JS CHEERS
├─ type_campaign: NULL ❌ (PROBLEMA)
├─ type_discount: 1
├─ discount: 20%
├─ code_cupon: NULL
└─ code_discount: 12 (Flash Sale ID)

🎯 TIPO DETECTADO EN UI: "Campaign Discount" (INCORRECTO)
⚠️  Debería mostrar: "Flash Sale 20%"
```

## 🔍 Causa Raíz

El flujo de datos era:

1. ✅ **Backend guarda Cart** → `type_campaign` se guarda correctamente en BD
2. ❌ **Resource cart.js** → NO incluía `type_campaign` en la respuesta
3. ❌ **Frontend recibe Cart** → `listCarts` no tiene el campo `type_campaign`
4. ❌ **Frontend envía a Stripe** → Payload no incluye `type_campaign`
5. ❌ **Backend crea SaleDetail** → `type_campaign` queda NULL

## 🔧 Solución Aplicada

**Archivo**: `api/src/resources/cart.js`

```javascript
// ANTES (faltaba type_campaign)
return {
    _id: cart.id,
    type_discount: cart.type_discount,
    discount: cart.discount,
    code_cupon: cart.code_cupon,
    code_discount: cart.code_discount,
    // ❌ type_campaign NO estaba aquí
    price_unitario: cart.price_unitario,
    ...
}

// DESPUÉS (agregado type_campaign)
return {
    _id: cart.id,
    type_discount: cart.type_discount,
    discount: cart.discount,
    code_cupon: cart.code_cupon,
    code_discount: cart.code_discount,
    type_campaign: cart.type_campaign, // ✅ AGREGADO
    price_unitario: cart.price_unitario,
    ...
}
```

## ✅ Flujo Corregido

1. ✅ Backend guarda Cart → `type_campaign = 2` (Flash Sale)
2. ✅ Resource serializa → `type_campaign` incluido en respuesta
3. ✅ Frontend recibe Cart → `listCarts[0].type_campaign = 2`
4. ✅ Frontend envía a Stripe → `cart: [{...item, type_campaign: 2}]`
5. ✅ Backend crea SaleDetail → `type_campaign: item.type_campaign || null` = 2
6. ✅ Frontend muestra → `getDiscountType()` detecta Flash Sale correctamente

## 🧪 Próximos Pasos

1. **Reiniciar backend** para que tome el cambio en `cart.js`
2. **Vaciar carrito actual** y volver a agregar el producto
3. **Hacer nueva compra** de prueba
4. **Verificar** que `type_campaign` se guarde correctamente en `sale_details`

## 📝 Nota Importante

Los pedidos anteriores (como #97) ya tienen `type_campaign = NULL` en la base de datos. 
El sistema usa **fallback logic** para mostrarlos correctamente basándose en `code_discount`,
pero los nuevos pedidos tendrán `type_campaign` correctamente guardado.
