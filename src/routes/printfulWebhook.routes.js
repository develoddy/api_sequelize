import { Router } from 'express';
import { 
    handleWebhook
} from '../controllers/proveedor/printful/webhookPrintful.controller.js';

const router = Router();

// 🚨 No uses auth.verifyEcommerce aquí, Printful necesita acceso directo
router.post('/webhook', handleWebhook);

export default router;
