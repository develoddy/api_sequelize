import { Sale } from '../../../../../models/Sale.js';

/**
 * =====================================================================================
 * HANDLER: handleOrderUpdated
 * 
 * Este handler se ejecuta cuando Printful envía un evento webhook de tipo "order_updated".
 * 
 * Qué hace:
 * 1️⃣ Extrae la información del pedido del evento
 * 2️⃣ Imprime en consola el ID del pedido y su nuevo estado
 * 3️⃣ Actualiza en `Sale`:
 *      - printfulStatus = estado actual del pedido
 *      - printfulUpdatedAt = fecha actual
 * 
 * Nota:
 * - Mantiene sincronizado el estado del pedido entre Printful y tu DB.
 * - En pruebas con Simulator, si la venta no existe, no afectará nada.
 * =====================================================================================
 */

export const handleOrderUpdated = async (event) => {
  const order = event.data.order;
  const status = order?.status || '';

  console.log('------------------------------------------------------------------------------------------------');
  console.log(`🔁 [HANDLE ORDER UPDATED] Evento recibido. Order ID: ${order?.id}, Status: ${status}`);

  if (!order?.id) {
    console.warn('⚠️ order_updated: order.id está vacío. Probablemente es un payload de simulación.');
    return;
  }

  // 🔹 Actualizar estado de la venta en la base de datos
  const [updatedCount] = await Sale.update(
    { 
      printfulStatus: status,
      printfulUpdatedAt: new Date()
    },
    { where: { printfulOrderId: order.id } }
  );

  if (updatedCount > 0) {
    await createAndEmitNotification({
      title: `Pedido #${order.id} actualizado`,
      message: `El pedido #${order.id} ahora tiene estado: ${status}`,
      color: 'info',
      type: 'order_updated',
      saleId: order.id,
      meta: { status }
    });
  }

  if (updatedCount === 0) {
    console.warn('⚠️ order_updated: no se encontró ninguna venta con printfulOrderId:', order.id);
    console.log('ℹ️ Esto puede ser un evento de simulación o la venta aún no fue registrada en la BD.');
  } else {
    console.log('✅ order_updated: Sale actualizado correctamente. printfulOrderId:', order.id);
  }
  console.log('------------------------------------------------------------------------------------------------');
};