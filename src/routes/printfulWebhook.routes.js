import { Router } from 'express';
import { 
    handleWebhook
} from '../controllers/proveedor/printful/webhookPrintful.controller.js';

const router = Router();

// 🚨 No uses auth.verifyEcommerce aquí, Printful necesita acceso directo

// 🏢 Multi-tenant webhook endpoint (debe ir ANTES de la ruta genérica)
router.post('/webhook/:tenantId', handleWebhook);

// 🔄 Legacy webhook endpoint (backward compatibility para la tienda principal)
router.post('/webhook', handleWebhook);

export default router;
