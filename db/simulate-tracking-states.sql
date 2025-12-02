-- ════════════════════════════════════════════════════════════════
-- 🧪 SCRIPT PARA SIMULAR DIFERENTES ESTADOS DE TRACKING
-- ════════════════════════════════════════════════════════════════
-- Este script te permite probar el módulo tracking con diferentes
-- estados de órdenes: pending, inprocess, shipped, fulfilled
-- ════════════════════════════════════════════════════════════════

-- 📝 NOTAS IMPORTANTES:
-- 1. Reemplaza [ID_ORDEN] con el ID real de tu orden
-- 2. Ejecuta UN SOLO bloque a la vez
-- 3. Espera 1-2 segundos entre updates para ver cambios
-- 4. Refresca el navegador después de cada update

-- ════════════════════════════════════════════════════════════════
-- 🔍 PASO 0: Ver órdenes disponibles
-- ════════════════════════════════════════════════════════════════

SELECT 
  id,
  n_transaction,
  syncStatus,
  trackingNumber,
  carrier,
  total,
  createdAt
FROM sales
ORDER BY createdAt DESC
LIMIT 10;

-- ════════════════════════════════════════════════════════════════
-- 📦 ESTADO 1: PENDING (Pedido Recibido - 10% progreso)
-- ════════════════════════════════════════════════════════════════
-- Simula una orden recién creada que aún no ha sido procesada

UPDATE sales
SET 
  syncStatus = 'pending',
  printfulStatus = 'draft',
  trackingNumber = NULL,
  trackingUrl = NULL,
  carrier = NULL,
  shippedAt = NULL,
  completedAt = NULL,
  errorMessage = NULL,
  printfulUpdatedAt = NOW()
WHERE id = 1;  -- Cambia '1' por tu ID de orden

-- Verificar:
-- URL: http://localhost:5000/es/es/tracking/1
-- Esperado:
-- - Badge naranja "Procesando"
-- - Progreso: 10%
-- - Timeline: Solo "Pedido Recibido" completado (verde)

-- ════════════════════════════════════════════════════════════════
-- ⚙️ ESTADO 2: INPROCESS (Fabricando - 50% progreso)
-- ════════════════════════════════════════════════════════════════
-- Simula una orden que está siendo fabricada por Printful

UPDATE sales
SET 
  syncStatus = 'pending',
  printfulStatus = 'inprocess',
  trackingNumber = NULL,
  trackingUrl = NULL,
  carrier = NULL,
  shippedAt = NULL,
  completedAt = NULL,
  errorMessage = NULL,
  printfulUpdatedAt = NOW()
WHERE id = 1;  -- Cambia '1' por tu ID de orden

-- Verificar:
-- URL: http://localhost:5000/es/es/tracking/1
-- Esperado:
-- - Badge azul "En Fabricación"
-- - Progreso: 50%
-- - Timeline: 3 primeros pasos completados
--   ✅ Pedido Recibido (verde)
--   ✅ Procesando (verde)
--   🔵 Fabricando (azul - en progreso)
--   ⏸️ Enviado (gris)
--   ⏸️ Entregado (gris)

-- ════════════════════════════════════════════════════════════════
-- 🚚 ESTADO 3: SHIPPED (Enviado - 75% progreso)
-- ════════════════════════════════════════════════════════════════
-- Simula una orden que ya fue enviada con tracking

UPDATE sales
SET 
  syncStatus = 'shipped',
  printfulStatus = 'shipped',
  trackingNumber = '1Z999AA10123456784',  -- Tracking de ejemplo (UPS)
  trackingUrl = 'https://www.ups.com/track?tracknum=1Z999AA10123456784',
  carrier = 'UPS',
  shippedAt = NOW(),
  completedAt = NULL,
  errorMessage = NULL,
  printfulUpdatedAt = NOW()
WHERE id = 1;  -- Cambia '1' por tu ID de orden

-- Verificar:
-- URL: http://localhost:5000/es/es/tracking/1
-- Esperado:
-- - Badge azul "Enviado"
-- - Progreso: 75%
-- - Tracking Number visible: "1Z999AA10123456784"
-- - Carrier visible: "UPS"
-- - Botón "Rastrear en UPS" visible
-- - Timeline: 4 primeros pasos completados
--   ✅ Pedido Recibido (verde)
--   ✅ Procesando (verde)
--   ✅ Fabricando (verde)
--   🔵 Enviado (azul - en progreso)
--   ⏸️ Entregado (gris)

-- ════════════════════════════════════════════════════════════════
-- ✅ ESTADO 4: FULFILLED (Entregado - 100% progreso)
-- ════════════════════════════════════════════════════════════════
-- Simula una orden completamente entregada al cliente

UPDATE sales
SET 
  syncStatus = 'fulfilled',
  printfulStatus = 'fulfilled',
  trackingNumber = '1Z999AA10123456784',
  trackingUrl = 'https://www.ups.com/track?tracknum=1Z999AA10123456784',
  carrier = 'UPS',
  shippedAt = DATE_SUB(NOW(), INTERVAL 5 DAY),  -- Enviado hace 5 días
  completedAt = NOW(),  -- Entregado hoy
  errorMessage = NULL,
  printfulUpdatedAt = NOW()
WHERE id = 1;  -- Cambia '1' por tu ID de orden

-- Verificar:
-- URL: http://localhost:5000/es/es/tracking/1
-- Esperado:
-- - Badge verde "Entregado"
-- - Progreso: 100%
-- - Tracking Number visible: "1Z999AA10123456784"
-- - Carrier visible: "UPS"
-- - Botón "Rastrear en UPS" visible
-- - Timeline: TODOS los pasos completados (verde)
--   ✅ Pedido Recibido
--   ✅ Procesando
--   ✅ Fabricando
--   ✅ Enviado
--   ✅ Entregado

-- ════════════════════════════════════════════════════════════════
-- ❌ ESTADO 5: CANCELED (Cancelado)
-- ════════════════════════════════════════════════════════════════
-- Simula una orden cancelada

UPDATE sales
SET 
  syncStatus = 'canceled',
  printfulStatus = 'canceled',
  trackingNumber = NULL,
  trackingUrl = NULL,
  carrier = NULL,
  shippedAt = NULL,
  completedAt = NOW(),
  errorMessage = 'Orden cancelada por el cliente',
  printfulUpdatedAt = NOW()
WHERE id = 1;  -- Cambia '1' por tu ID de orden

-- Verificar:
-- URL: http://localhost:5000/es/es/tracking/1
-- Esperado:
-- - Badge rojo "Cancelado"
-- - Mensaje de error visible
-- - Progreso: 0%

-- ════════════════════════════════════════════════════════════════
-- 🎭 SIMULAR MÚLTIPLES ÓRDENES CON DIFERENTES ESTADOS
-- ════════════════════════════════════════════════════════════════
-- Si tienes varias órdenes, puedes configurarlas todas de una vez:

-- Orden 1: PENDING
UPDATE sales SET 
  syncStatus = 'pending', 
  printfulStatus = 'draft',
  trackingNumber = NULL,
  carrier = NULL,
  shippedAt = NULL,
  completedAt = NULL
WHERE id = 1;

-- Orden 2: INPROCESS
UPDATE sales SET 
  syncStatus = 'pending', 
  printfulStatus = 'inprocess',
  trackingNumber = NULL,
  carrier = NULL,
  shippedAt = NULL,
  completedAt = NULL
WHERE id = 2;

-- Orden 3: SHIPPED
UPDATE sales SET 
  syncStatus = 'shipped', 
  printfulStatus = 'shipped',
  trackingNumber = '1Z999AA10123456784',
  trackingUrl = 'https://www.ups.com/track?tracknum=1Z999AA10123456784',
  carrier = 'UPS',
  shippedAt = NOW(),
  completedAt = NULL
WHERE id = 3;

-- Orden 4: FULFILLED
UPDATE sales SET 
  syncStatus = 'fulfilled', 
  printfulStatus = 'fulfilled',
  trackingNumber = '1Z999AA10987654321',
  trackingUrl = 'https://www.fedex.com/track?tracknum=1Z999AA10987654321',
  carrier = 'FedEx',
  shippedAt = DATE_SUB(NOW(), INTERVAL 7 DAY),
  completedAt = NOW()
WHERE id = 4;

-- Orden 5: CANCELED
UPDATE sales SET 
  syncStatus = 'canceled', 
  printfulStatus = 'canceled',
  trackingNumber = NULL,
  carrier = NULL,
  errorMessage = 'Pago rechazado',
  completedAt = NOW()
WHERE id = 5;

-- ════════════════════════════════════════════════════════════════
-- 🧪 VERIFICAR TODOS LOS ESTADOS
-- ════════════════════════════════════════════════════════════════

SELECT 
  id,
  syncStatus,
  printfulStatus,
  trackingNumber,
  carrier,
  shippedAt,
  completedAt,
  CASE 
    WHEN syncStatus = 'pending' AND (printfulStatus IS NULL OR printfulStatus = 'draft') THEN '10% - Pedido Recibido'
    WHEN syncStatus = 'pending' AND printfulStatus = 'inprocess' THEN '50% - Fabricando'
    WHEN syncStatus = 'shipped' THEN '75% - Enviado'
    WHEN syncStatus = 'fulfilled' THEN '100% - Entregado'
    WHEN syncStatus = 'canceled' THEN '0% - Cancelado'
    ELSE 'Desconocido'
  END as estado_visual
FROM sales
WHERE id IN (1, 2, 3, 4, 5)
ORDER BY id;

-- ════════════════════════════════════════════════════════════════
-- 🔄 RESETEAR ORDEN A ESTADO INICIAL
-- ════════════════════════════════════════════════════════════════

UPDATE sales
SET 
  syncStatus = 'pending',
  printfulStatus = NULL,
  trackingNumber = NULL,
  trackingUrl = NULL,
  carrier = NULL,
  shippedAt = NULL,
  completedAt = NULL,
  errorMessage = NULL,
  printfulUpdatedAt = NULL
WHERE id = 1;  -- Cambia '1' por tu ID de orden

-- ════════════════════════════════════════════════════════════════
-- 📋 EJEMPLOS DE TRACKING NUMBERS REALES
-- ════════════════════════════════════════════════════════════════
-- Puedes usar estos para simular diferentes carriers:

-- UPS: 1Z999AA10123456784
-- FedEx: 123456789012
-- USPS: 9400111899562941538728
-- DHL: 1234567890
-- Correos (España): PQ123456789ES

-- ════════════════════════════════════════════════════════════════
-- ✅ CHECKLIST DE PRUEBAS
-- ════════════════════════════════════════════════════════════════
-- 
-- [ ] PENDING: Badge naranja, 10%, solo primer paso verde
-- [ ] INPROCESS: Badge azul, 50%, 3 pasos verdes
-- [ ] SHIPPED: Badge azul, 75%, tracking visible, 4 pasos verdes
-- [ ] FULFILLED: Badge verde, 100%, todos los pasos verdes
-- [ ] CANCELED: Badge rojo, mensaje error
-- [ ] Responsive funciona en mobile
-- [ ] Botón "Rastrear en [Carrier]" abre URL correcta
-- [ ] Fechas se muestran correctamente
-- [ ] Botón "Volver" funciona
-- [ ] Botón "Refrescar" actualiza datos
-- 
-- ════════════════════════════════════════════════════════════════

-- 🎯 RECOMENDACIÓN:
-- 1. Empieza con PENDING
-- 2. Prueba en http://localhost:5000/es/es/tracking/1
-- 3. Luego UPDATE a INPROCESS
-- 4. Refresca navegador (F5)
-- 5. Continúa con SHIPPED
-- 6. Finalmente FULFILLED
-- 
-- Esto simula el ciclo de vida completo de una orden!
