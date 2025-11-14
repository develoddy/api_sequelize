import { handleOrderCreated } from './handlers/orderCreated.js';
import { handleOrderUpdated } from './handlers/orderUpdated.js';
import { handlePackageShipped } from './handlers/packageShipped.js';
import { handlePackageReturned } from './handlers/packageReturned.js';
import { handleOrderFailed } from './handlers/orderFailed.js';
import { handleOrderCanceled } from './handlers/orderCanceled.js';
import crypto from 'crypto';

const SECRET = process.env.PRINTFUL_WEBHOOK_SECRET;

/**
 * Verifica la firma del webhook de Printful
 */
function verifySignature(req) {
  const signature = req.headers['x-printful-signature'];
  const payload = req.rawBody; // ✅ usar rawBody

  if (!signature || !payload) return false;

  const hash = createHmac('sha256', SECRET)
    .update(payload)
    .digest('hex');

  return hash === signature;
}

/**
 * Manejador principal del webhook de Printful
 */
export const handleWebhook = async (req, res) => {
  try {
    const isLocal = process.env.NODE_ENV !== 'production';

    // Verificamos la firma solo si NO estamos en local
    if ( isLocal || verifySignature(req)) {
      const event = req.body; // JSON parseado, listo para handlers
      console.log('------------------------------------------------------------------------------------------------');
      console.log(`📦 [PRINTFUL WEBHOOK] Tipo: ${event.type}`);

      switch(event.type) {
        case 'order_created':
          await handleOrderCreated(event);
          break;
        case 'order_updated':
          await handleOrderUpdated(event);
          break;
        case 'package_shipped':
          await handlePackageShipped(event);
          break;
        case 'package_returned':
          await handlePackageReturned(event);
          break;
        case 'order_failed':
          await handleOrderFailed(event);
          break;
        case 'order_canceled':
          await handleOrderCanceled(event);
          break;
        default:
          console.log('ℹ️ Evento no manejado:', event.type);
      }

      res.sendStatus(200); // Todo OK

    } else {
      console.log('❌ Firma inválida en webhook');
      return res.sendStatus(401); // No autorizado
    }
  } catch (error) {
    console.error('❌ Error procesando webhook:', error);
    res.sendStatus(500);
  }
};
