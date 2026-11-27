import { Router } from 'express';
import { 
    handleWebhook
} from '../controllers/webhookPrintful.controller.js';

import {
    validatePrintfulV2Webhook,
    handleWebhookV2
} from '../controllers/webhookPrintfulV2.controller.js';

const router = Router();

router.post(
    '/v2/webhook',
    validatePrintfulV2Webhook,
    handleWebhookV2
);


// 🚨 No uses auth.verifyEcommerce aquí, Printful necesita acceso directo

// 🏢 Multi-tenant webhook endpoint (debe ir ANTES de la ruta genérica)
router.post('/webhook/:tenantId', handleWebhook);

// 🔄 Legacy webhook endpoint (backward compatibility para la tienda principal)
router.post('/webhook', handleWebhook);

export default router;
