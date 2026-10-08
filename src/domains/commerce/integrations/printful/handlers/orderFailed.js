import { Sale } from '../../../../../models/Sale.js';

/**
 * =====================================================================================
 * HANDLER: handleOrderFailed
 * 
 * Este handler se ejecuta cuando Printful envía un evento webhook de tipo "order_failed".
 * 
 * Qué hace:
 * 1️⃣ Recibe el evento desde Printful
 * 2️⃣ Imprime en consola un mensaje indicando que el pedido falló
 * 3️⃣ Actualiza el registro correspondiente en `Sale`:
 *      - printfulStatus = 'failed'
 *      - printfulUpdatedAt = fecha actual
 * 
 * Nota:
 * - Es útil para detectar problemas de procesamiento de pedidos.
 * - Si el pedido no existe en tu DB, la actualización no tiene efecto.
 * =====================================================================================
 */

export const handleOrderFailed = async (event) => {
  const order = event.data.order;
  const reason = event.data.reason || '';

  console.log('------------------------------------------------------------------------------------------------');

  console.log('⚠️ [HANDLE ORDER FAILED] Evento recibido. Order ID:', order?.id, 'Reason:', reason);

  if (!order?.id) {
    console.warn('⚠️ order_failed: order.id está vacío. Probablemente es un payload de simulación.');
    return;
  }

  // 🔹 Actualizar estado de la venta en la base de datos
  const [updatedCount] = await Sale.update(
    { printfulStatus: 'failed', printfulUpdatedAt: new Date() },
    { where: { printfulOrderId: order.id } }
  );

  if (updatedCount > 0) {
    await createAndEmitNotification({
      title: `Pedido #${order.id} fallido`,
      message: `El pedido #${order.id} falló. Motivo: ${reason}`,
      color: 'danger',
      type: 'order_failed',
      saleId: order.id,
      meta: { reason }
    });
  }

  if (updatedCount === 0) {
    console.warn('⚠️ order_failed: no se encontró ninguna venta con printfulOrderId:', order.id);
    console.log('ℹ️ Esto puede ser un evento de simulación o la venta aún no fue registrada en la BD.');
  } else {
    console.log('✅ order_failed: Sale actualizado correctamente. printfulOrderId:', order.id);
  }
  console.log('------------------------------------------------------------------------------------------------');
};
