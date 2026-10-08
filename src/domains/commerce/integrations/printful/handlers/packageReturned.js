import { Sale } from '../../../../../models/Sale.js';
import { Shipment } from '../../../../../models/Shipment.js';

/**
 * =====================================================================================
 * HANDLER: handlePackageReturned
 * 
 * Este handler se ejecuta cuando Printful envía un evento webhook de tipo "package_returned".
 * 
 * Qué hace:
 * 1️⃣ Extrae la información del envío devuelto
 * 2️⃣ Imprime en consola el número de seguimiento del envío
 * 3️⃣ Busca la venta correspondiente en `Sale` usando printfulOrderId
 * 4️⃣ Actualiza el registro en `Shipment`:
 *      - status = 'returned'
 *      - returnedAt = fecha actual
 * 
 * Nota:
 * - Solo actualiza si la venta existe en tu DB.
 * - Permite llevar control de envíos devueltos.
 * =====================================================================================
 */

export const handlePackageReturned = async (event) => {
  const shipmentData = event.data.shipment;

  console.log('------------------------------------------------------------------------------------------------');
  console.log(`↩️ [HANDLE PACKAGE RETURNED] Evento recibido. Tracking: ${shipmentData.tracking_number}`);

  // ⚠️ Verificar si es simulación (payload sin order_id)
  if (!shipmentData.order_id) {
    console.warn('⚠️ package_returned: shipmentData.order_id está vacío. Probablemente es un payload de simulación.');
    return;
  }

  // 🔹 Buscar la venta relacionada
  const sale = await Sale.findOne({ where: { printfulOrderId: shipmentData.order_id } });
  if (!sale) {
    console.warn('⚠️ package_returned: no se encontró ninguna venta para este shipment. printfulOrderId:', shipmentData.order_id);
    return;
  }

  // 🔹 Actualizar el estado del envío
  const [updatedCount] = await Shipment.update(
    { status: 'returned', returnedAt: new Date() },
    { where: { printfulShipmentId: shipmentData.id } }
  );

  if (updatedCount > 0) {
    await createAndEmitNotification({
      title: `Pedido #${sale.id} devuelto`,
      message: `El pedido #${sale.id} fue devuelto ↩️`,
      color: 'warning',
      type: 'package_returned',
      saleId: sale.id,
      shipmentId: shipmentData.id,
      meta: { trackingNumber: shipmentData.tracking_number }
    });
  }

  if (updatedCount === 0) {
    console.warn('⚠️ package_returned: no se encontró ningún shipment con printfulShipmentId:', shipmentData.id);
  } else {
    console.log('✅ package_returned: Shipment actualizado correctamente. printfulShipmentId:', shipmentData.id);
  }
  console.log('------------------------------------------------------------------------------------------------');
};