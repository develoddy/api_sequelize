import { Sale } from '../../../../../models/Sale.js';

/**
 * =====================================================================================
 * HANDLER: handleOrderCreated
 * 
 * Este handler se ejecuta cuando Printful envía un evento webhook de tipo "order_created".
 * 
 * Qué hace actualmente:
 * 1️⃣ Recibe el evento desde Printful (req.body del webhook)
 * 2️⃣ Extrae el pedido: const order = event.data.order
 * 3️⃣ Imprime en consola el ID del pedido simulado: order.id
 * 4️⃣ Intenta actualizar un registro existente en la tabla `sales` en base al printfulOrderId
 *    usando Sequelize:
 *      Sale.update({ printfulUpdatedAt: new Date() }, { where: { printfulOrderId: order.id } })
 * 
 * Nota importante:
 * - En tu base de datos actualmente no hay registros de `Sale` con printfulOrderId = order.id,
 *   por lo que esta actualización no afecta nada. Esto es normal en pruebas con el Simulator.
 * 
 * Recomendaciones para pruebas más realistas:
 * 🔹 Crear un `Sale` de prueba en tu DB con printfulOrderId igual al ID simulado que genere
 *   el Simulator (ej. 44612). Esto permitirá que las actualizaciones futuras funcionen.
 * 🔹 Probar otros tipos de webhook (order_updated, package_shipped, order_failed, etc.)
 *   para verificar la creación y actualización de `Shipment` y cambios de estado en `Sale`.
 * 🔹 Recuerda que los webhooks siempre deben responder con HTTP 200 OK para que Printful
 *   considere el evento entregado correctamente.
 * 
 * Cómo funciona en conjunto con tu sistema:
 * - Tu web normalmente crea `Sale` cuando el cliente compra en tu eCommerce.
 * - Printful puede generar el evento `order_created` incluso si la venta no existe en tu DB
 *   (especialmente en pruebas). Por eso aquí solo hacemos update si existe.
 * - El objetivo principal es mantener sincronizado el estado de `Sale` y `Shipment` con Printful.
 * 
 * =====================================================================================
 */

export const handleOrderCreated = async (event) => {
  const order = event.data.order;

  console.log('------------------------------------------------------------------------------------------------');
  // 🔹 Log básico del evento
  console.log('📦 [HANDLE ORDER CREATED] Evento recibido. ID Printful:', order.id);

  // 🔹 Intentamos buscar en la base de datos para ver si es real
  const sale = await Sale.findOne({ where: { printfulOrderId: order.id } });

  if (!sale) {
    console.log('⚠️ Pedido NO encontrado en la base de datos. Probablemente es un payload de simulación.');
  } else {
    console.log('✅ Pedido encontrado en la base de datos. Este parece ser un pedido real.');
  }

  // 🔹 Actualizamos la fecha de actualización en Sale (si existe)
  await Sale.update(
    { printfulUpdatedAt: new Date() },
    { where: { printfulOrderId: order.id } }
  );

  if (sale) {
    await createAndEmitNotification({
      title: `Pedido #${sale.id} creado`,
      message: `Se ha recibido un nuevo pedido #${sale.id}`,
      color: 'success',
      type: 'order_created',
      saleId: sale.id
    });
  }

  console.log('📝 handleOrderCreated: proceso completado para ID Printful:', order.id);
  console.log('------------------------------------------------------------------------------------------------');
};
