import { Sale } from '../../../../models/Sale.js';

/**
 * =====================================================================================
 * HANDLER: handleOrderCanceled
 * 
 * Este handler se ejecuta cuando Printful envía un evento webhook de tipo "order_canceled".
 * 
 * Qué hace:
 * 1️⃣ Recibe el evento desde Printful
 * 2️⃣ Imprime en consola un mensaje indicando que el pedido fue cancelado
 * 3️⃣ Actualiza el registro correspondiente en `Sale`:
 *      - printfulStatus = 'canceled'
 *      - printfulUpdatedAt = fecha actual
 * 4️⃣ Solo actualiza si existe una venta con printfulOrderId igual al ID del pedido
 * 
 * Nota:
 * - En pruebas con el Simulator, si no tienes la venta en tu DB, no afectará nada.
 * - Este handler permite mantener sincronizado el estado del pedido en tu eCommerce.
 * =====================================================================================
 */

export const handleOrderCanceled = async (event) => {
  const order = event.data.order;
  const reason = event.data.reason || '';
  
  console.log('------------------------------------------------------------------------------------------------');
  console.log('❌ [HANDLE ORDER CANCELED] Evento recibido. Order ID:', order?.id, 'Reason:', reason);

  if (!order?.id) {
    console.warn('⚠️ order_canceled: order.id está vacío. Probablemente es un payload de simulación.');
    return;
  }

  // 🔹 Actualizar estado de la venta en la base de datos
  const [updatedCount] = await Sale.update(
    { printfulStatus: 'canceled', printfulUpdatedAt: new Date() },
    { where: { printfulOrderId: order.id } }
  );

  if (updatedCount > 0) {
    await createAndEmitNotification({
      title: `Pedido #${order.id} cancelado`,
      message: `El pedido #${order.id} fue cancelado. Motivo: ${reason}`,
      color: 'warning',
      type: 'order_canceled',
      saleId: order.id,
      meta: { reason }
    });
  }

  if (updatedCount === 0) {
    console.warn('⚠️ order_canceled: no se encontró ninguna venta con printfulOrderId:', order.id);
    console.log('ℹ️ Esto puede ser un evento de simulación o la venta aún no fue registrada en la BD.');
  } else {
    console.log('✅ order_canceled: Sale actualizado correctamente. printfulOrderId:', order.id);
  }
  console.log('------------------------------------------------------------------------------------------------');
};