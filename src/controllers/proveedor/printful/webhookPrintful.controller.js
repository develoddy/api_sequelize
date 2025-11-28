import crypto from 'crypto';
import { PrintfulWebhookLog } from "../../../models/PrintfulWebhookLog.js";
import { Sale } from "../../../models/Sale.js";

/**
 * 🔔 Recibir y procesar webhooks de Printful
 * Endpoint público: POST /api/printful/webhook
 */
export const handleWebhook = async (req, res) => {
  try {
    console.log('🔔 [WEBHOOK] Recibido webhook de Printful');
    
    const webhookData = req.body;
    const signature = req.headers['x-printful-signature'];
    
    // 1️⃣ Verificar firma (opcional pero recomendado en producción)
    // if (!verifyWebhookSignature(webhookData, signature)) {
    //   console.error('❌ [WEBHOOK] Firma inválida');
    //   return res.status(401).json({ error: 'Invalid signature' });
    // }

    // 2️⃣ Extraer información del evento
    const eventType = webhookData.type;
    const orderId = webhookData.data?.order?.id || webhookData.data?.id;
    
    console.log(`📦 [WEBHOOK] Evento: ${eventType} | Order ID: ${orderId}`);

    // 3️⃣ Guardar log del webhook
    const webhookLog = await PrintfulWebhookLog.create({
      event_type: eventType,
      order_id: orderId,
      event_data: webhookData,
      received_at: new Date()
    });

    // 4️⃣ Procesar el evento según su tipo
    let processed = false;
    let error = null;

    try {
      switch (eventType) {
        case 'package_shipped':
          await handlePackageShipped(webhookData);
          processed = true;
          break;

        case 'order_failed':
          await handleOrderFailed(webhookData);
          processed = true;
          break;

        case 'order_updated':
          await handleOrderUpdated(webhookData);
          processed = true;
          break;

        case 'product_synced':
          await handleProductSynced(webhookData);
          processed = true;
          break;

        case 'order_created':
          await handleOrderCreated(webhookData);
          processed = true;
          break;

        default:
          console.log(`ℹ️ [WEBHOOK] Evento no manejado: ${eventType}`);
          processed = true; // Marcar como procesado para no repetir
      }
    } catch (processingError) {
      console.error('❌ [WEBHOOK] Error procesando evento:', processingError);
      error = processingError.message;
    }

    // 5️⃣ Actualizar estado del log
    await webhookLog.update({
      processed,
      processing_error: error
    });

    // 6️⃣ Responder a Printful (debe ser 200 OK)
    return res.status(200).json({
      success: true,
      message: 'Webhook received and processed',
      event_type: eventType,
      webhook_id: webhookLog.id
    });

  } catch (error) {
    console.error('❌ [WEBHOOK] Error general:', error);
    
    // Importante: Responder 200 para que Printful no reintente
    return res.status(200).json({
      success: false,
      error: 'Internal processing error',
      message: error.message
    });
  }
};

/**
 * 📦 Paquete enviado
 */
async function handlePackageShipped(data) {
  console.log('🚚 [WEBHOOK] Procesando package_shipped...');
  
  const orderId = data.data.order.id;
  const trackingNumber = data.data.shipment.tracking_number;
  const trackingUrl = data.data.shipment.tracking_url;
  const carrier = data.data.shipment.carrier;

  // Actualizar venta en la DB
  const sale = await Sale.findOne({
    where: { printfulOrderId: orderId }
  });

  if (sale) {
    await sale.update({
      printfulStatus: 'shipped',
      printfulUpdatedAt: new Date()
    });
    
    console.log(`✅ [WEBHOOK] Orden ${orderId} marcada como enviada`);
    
    // TODO: Enviar email al cliente con tracking
  } else {
    console.warn(`⚠️ [WEBHOOK] Orden ${orderId} no encontrada en DB`);
  }
}

/**
 * ❌ Orden fallida
 */
async function handleOrderFailed(data) {
  console.log('❌ [WEBHOOK] Procesando order_failed...');
  
  const orderId = data.data.order.id;
  const reason = data.data.reason || 'Unknown error';

  const sale = await Sale.findOne({
    where: { printfulOrderId: orderId }
  });

  if (sale) {
    await sale.update({
      printfulStatus: 'failed',
      printfulUpdatedAt: new Date()
    });
    
    console.log(`❌ [WEBHOOK] Orden ${orderId} marcada como fallida: ${reason}`);
    
    // TODO: Notificar administrador
  }
}

/**
 * 🔄 Orden actualizada
 */
async function handleOrderUpdated(data) {
  console.log('🔄 [WEBHOOK] Procesando order_updated...');
  
  const orderId = data.data.order.id;
  const status = data.data.order.status;

  const sale = await Sale.findOne({
    where: { printfulOrderId: orderId }
  });

  if (sale) {
    await sale.update({
      printfulStatus: status,
      printfulUpdatedAt: new Date()
    });
    
    console.log(`✅ [WEBHOOK] Orden ${orderId} actualizada a: ${status}`);
  }
}

/**
 * 🆕 Orden creada
 */
async function handleOrderCreated(data) {
  console.log('🆕 [WEBHOOK] Procesando order_created...');
  
  const orderId = data.data.order.id;
  console.log(`✅ [WEBHOOK] Nueva orden creada: ${orderId}`);
  
  // En tu caso, las órdenes se crean desde el ecommerce
  // Este evento puede servir para confirmar que Printful recibió la orden
}

/**
 * 📦 Producto sincronizado
 */
async function handleProductSynced(data) {
  console.log('📦 [WEBHOOK] Procesando product_synced...');
  
  const productId = data.data.sync_product.id;
  console.log(`✅ [WEBHOOK] Producto ${productId} sincronizado`);
  
  // TODO: Actualizar información del producto en DB si es necesario
}

/**
 * 🔐 Verificar firma del webhook (seguridad)
 */
function verifyWebhookSignature(data, signature) {
  const WEBHOOK_SECRET = process.env.PRINTFUL_WEBHOOK_SECRET;
  
  if (!WEBHOOK_SECRET || !signature) {
    return true; // Skip verification si no está configurado
  }

  const payload = JSON.stringify(data);
  const hash = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return hash === signature;
}

/**
 * 📊 Obtener logs de webhooks
 */
export const getWebhookLogs = async (req, res) => {
  try {
    const { limit = 50, event_type, processed } = req.query;

    const where = {};
    if (event_type) where.event_type = event_type;
    if (processed !== undefined) where.processed = processed === 'true';

    const logs = await PrintfulWebhookLog.findAll({
      where,
      limit: parseInt(limit),
      order: [['received_at', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      count: logs.length,
      logs
    });

  } catch (error) {
    console.error('❌ Error fetching webhook logs:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener logs de webhooks',
      error: error.message
    });
  }
};

/**
 * 📊 Estadísticas de webhooks
 */
export const getWebhookStats = async (req, res) => {
  try {
    const { Sequelize } = await import('sequelize');
    
    const rawStats = await PrintfulWebhookLog.findAll({
      attributes: [
        'event_type',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'total'],
        [Sequelize.fn('SUM', Sequelize.literal('CASE WHEN processed = 1 THEN 1 ELSE 0 END')), 'processed'],
        [Sequelize.fn('SUM', Sequelize.literal('CASE WHEN processed = 0 THEN 1 ELSE 0 END')), 'failed']
      ],
      group: ['event_type'],
      raw: true
    });

    // Transformar para que el frontend lo entienda correctamente
    const stats = rawStats.map(stat => ({
      event_type: stat.event_type,
      total: parseInt(stat.total) || 0,
      processed: parseInt(stat.processed) || 0,
      failed: parseInt(stat.failed) || 0
    }));

    const totalCount = await PrintfulWebhookLog.count();

    return res.status(200).json({
      success: true,
      total: totalCount,
      stats: stats
    });

  } catch (error) {
    console.error('❌ Error fetching webhook stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
};
