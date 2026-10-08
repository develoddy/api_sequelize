import { getIO } from '../../../../../socket.js';
import { Sale } from '../../../../../models/Sale.js';
import { Shipment } from '../../../../../models/Shipment.js';
import { createAndEmitNotification } from '../services/notificationService.js';

/**
 * =====================================================================================
 * HANDLER: handlePackageShipped
 * 
 * Este handler se ejecuta cuando Printful envía un evento webhook de tipo "package_shipped".
 * 
 * Qué hace:
 * 1️⃣ Extrae la información del envío
 * 2️⃣ Imprime en consola el número de seguimiento
 * 3️⃣ Busca la venta correspondiente en `Sale` usando printfulOrderId
 * 4️⃣ Verifica que no exista un envío duplicado
 * 5️⃣ Crea un nuevo registro en `Shipment`:
 *      - saleId = ID de la venta
 *      - printfulShipmentId = ID del envío de Printful
 *      - carrier, service, trackingNumber, trackingUrl
 *      - status = 'shipped'
 *      - shippedAt = fecha de envío (si disponible)
 * 
 * Nota:
 * - Permite llevar control de envíos realizados y sincronizados con Printful.
 * - Si la venta no existe, no hace nada.
 * =====================================================================================
 */

export const handlePackageShipped = async (event) => {
  const io = getIO(); // Obtener instancia viva
  const shipmentData = event.data.shipment;

  console.log('------------------------------------------------------------------------------------------------');
  console.log('🚚 [HANDLE PACKAGE SHIPPED] Evento recibido. Tracking:', shipmentData.tracking_number, 'ID Shipment:', shipmentData.id);

  // 🔹 Verificar si viene con order_id
  if (!shipmentData.order_id) {
    console.warn('⚠️ package_shipped: shipmentData.order_id está vacío. Probablemente es un payload de simulación.');
    return;
  }

  // 🔹 Buscar la venta asociada
  const sale = await Sale.findOne({ where: { printfulOrderId: shipmentData.order_id } });

  if (!sale) {
    console.warn('⚠️ package_shipped: no se encontró la venta en la base de datos para order_id:', shipmentData.order_id);
    console.log('ℹ️ Esto puede indicar que es un evento de simulación o que la venta aún no fue creada.');
    return;
  } else {
    console.log('✅ package_shipped: venta encontrada en BD. ID Sale:', sale.id);
  }

  // 🔹 Evitar duplicados en Shipment
  const existingShipment = await Shipment.findOne({ where: { printfulShipmentId: shipmentData.id } });
  if (existingShipment) {
    console.log('ℹ️ package_shipped: shipment ya existe, se evita duplicado. ID Shipment:', shipmentData.id);
    return;
  }

  // 🔹 Crear el registro en Shipment
  const shipment = await Shipment.create({
    saleId: sale.id,
    printfulShipmentId: shipmentData.id,
    carrier: shipmentData.carrier,
    service: shipmentData.service,
    trackingNumber: shipmentData.tracking_number,
    trackingUrl: shipmentData.tracking_url,
    status: 'shipped',
    shippedAt: shipmentData.ship_date ? new Date(shipmentData.ship_date * 1000) : null
  });

  // Crear y emitir notificación al usuario
  await createAndEmitNotification({
    title: `Pedido #${sale.id} enviado`,
    message: `El pedido #${sale.id} ha sido enviado con éxito 🚚`,
    color: 'success',
    type: 'package_shipped',
    saleId: sale.id,
    shipmentId: shipment.id,
    meta: {
      saleId: sale.id,
      shipmentId: shipment.id,
      trackingNumber: shipmentData.tracking_number,
      carrier: shipmentData.carrier,
      service: shipmentData.service,
      trackingUrl: shipmentData.tracking_url
    }
  });

  console.log('✅ package_shipped: Shipment creado correctamente para Sale ID:', sale.id, 'Shipment ID:', shipmentData.id);
  console.log('------------------------------------------------------------------------------------------------');
};
