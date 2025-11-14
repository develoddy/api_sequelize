import { Router } from 'express';
import { 
    handleWebhook 
} from '../controllers/proveedor/printful/printfulWebhook.controller.js';

const router = Router();

// 🚨 No uses auth.verifyEcommerce aquí, Printful necesita acceso directo
router.post('/webhook', handleWebhook);

export default router;
