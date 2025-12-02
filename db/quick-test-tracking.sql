-- ════════════════════════════════════════════════════════════════
-- 🚀 SCRIPT RÁPIDO - PRUEBA LOS 3 ESTADOS PRINCIPALES
-- ════════════════════════════════════════════════════════════════

-- ⚠️ IMPORTANTE: Cambia 'id = 1' por tu Order ID real

-- ════════════════════════════════════════════════════════════════
-- 📋 PASO 0: Verificar tu orden actual
-- ════════════════════════════════════════════════════════════════

SELECT 
  id,
  syncStatus,
  printfulStatus,
  trackingNumber,
  carrier,
  shippedAt,
  completedAt,
  createdAt
FROM sales 
WHERE id = 1;

-- ════════════════════════════════════════════════════════════════
-- 🟠 PASO 1: PENDING (10% - Pedido Recibido)
-- ════════════════════════════════════════════════════════════════

UPDATE sales 
SET 
  syncStatus = 'pending',
  printfulStatus = 'draft',
  trackingNumber = NULL,
  trackingUrl = NULL,
  carrier = NULL,
  shippedAt = NULL,
  completedAt = NULL,
  printfulUpdatedAt = NOW()
WHERE id = 1;

-- 🌐 Abre: http://localhost:5000/es/es/tracking/1
-- ✅ Esperas ver:
--    - Badge naranja "Procesando"
--    - Progreso: 10%
--    - Timeline: Solo primer paso verde

-- ════════════════════════════════════════════════════════════════
-- 🔵 PASO 2: SHIPPED (75% - Enviado)
-- ════════════════════════════════════════════════════════════════

UPDATE sales 
SET 
  syncStatus = 'shipped',
  printfulStatus = 'shipped',
  trackingNumber = '1Z999AA10123456784',
  trackingUrl = 'https://www.ups.com/track?tracknum=1Z999AA10123456784',
  carrier = 'UPS',
  shippedAt = NOW(),
  completedAt = NULL,  -- AÚN NO ENTREGADO
  printfulUpdatedAt = NOW()
WHERE id = 1;

-- 🔄 Refresca navegador (F5)
-- ✅ Esperas ver:
--    - Badge azul "Enviado"
--    - Progreso: 75%
--    - Tracking Number: 1Z999AA10123456784
--    - Carrier: UPS
--    - Botón "Rastrear en UPS"
--    - Timeline: 4 pasos verdes, último gris

-- ════════════════════════════════════════════════════════════════
-- 🟢 PASO 3: FULFILLED (100% - Entregado) ⭐
-- ════════════════════════════════════════════════════════════════
-- ⚠️ CLAVE: Debes mantener el tracking number del paso anterior

UPDATE sales 
SET 
  syncStatus = 'fulfilled',
  printfulStatus = 'fulfilled',
  -- ⚡ NO BORRES estos campos, deben mantenerse:
  trackingNumber = '1Z999AA10123456784',
  trackingUrl = 'https://www.ups.com/track?tracknum=1Z999AA10123456784',
  carrier = 'UPS',
  shippedAt = DATE_SUB(NOW(), INTERVAL 5 DAY),  -- Enviado hace 5 días
  completedAt = NOW(),  -- ⭐ Entregado HOY
  printfulUpdatedAt = NOW()
WHERE id = 1;

-- 🔄 Refresca navegador (F5)
-- ✅ Esperas ver:
--    - Badge VERDE "Entregado" ⭐⭐⭐
--    - Progreso: 100% (barra completa)
--    - Tracking Number: 1Z999AA10123456784
--    - Carrier: UPS
--    - Timeline: TODOS los pasos verdes
--    - Fecha de entrega visible

-- ════════════════════════════════════════════════════════════════
-- 🔍 VERIFICAR RESULTADO
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
    WHEN syncStatus = 'pending' THEN '🟠 10% - Pending'
    WHEN syncStatus = 'shipped' THEN '🔵 75% - Shipped'
    WHEN syncStatus = 'fulfilled' THEN '🟢 100% - Fulfilled ⭐'
    ELSE '❓ Desconocido'
  END as estado_esperado
FROM sales 
WHERE id = 1;

-- ════════════════════════════════════════════════════════════════
-- 🔄 RESETEAR A ESTADO INICIAL (OPCIONAL)
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
  printfulUpdatedAt = NULL
WHERE id = 1;

-- ════════════════════════════════════════════════════════════════
-- ✅ CHECKLIST DE VERIFICACIÓN
-- ════════════════════════════════════════════════════════════════
-- 
-- PENDING (10%):
-- [ ] Badge naranja
-- [ ] Progress bar: 10%
-- [ ] Solo "Pedido Recibido" en verde
-- [ ] NO hay tracking number visible
--
-- SHIPPED (75%):
-- [ ] Badge azul
-- [ ] Progress bar: 75%
-- [ ] 4 pasos en verde, último en gris
-- [ ] Tracking number visible: 1Z999AA10123456784
-- [ ] Botón "Rastrear en UPS" presente
-- [ ] Click en botón abre UPS.com
--
-- FULFILLED (100%):
-- [ ] Badge VERDE ⭐
-- [ ] Progress bar: 100% (completa)
-- [ ] TODOS los 5 pasos en verde
-- [ ] Tracking number visible: 1Z999AA10123456784
-- [ ] Botón "Rastrear en UPS" presente
-- [ ] Fecha de entrega visible
-- 
-- ════════════════════════════════════════════════════════════════

-- 💡 TIPS:
-- 1. Ejecuta cada UPDATE uno por uno
-- 2. Espera 2-3 segundos entre cada uno
-- 3. Refresca el navegador con F5 (no Ctrl+R)
-- 4. Si no ves cambios, haz hard refresh: Ctrl+Shift+R
-- 5. Verifica en DevTools → Network que haga request al backend
