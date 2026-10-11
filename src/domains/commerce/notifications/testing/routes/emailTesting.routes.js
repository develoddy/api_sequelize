/**
 * 🧪 EMAIL TESTING ROUTES
 * Rutas para probar templates de email SIN afectar Printful
 * Solo para desarrollo y testing
 */

import { Router } from 'express';
import { 
    testOrderPrintingEmail, 
    testOrderShippedEmail, 
    testOrderDeliveredEmail,
    getTestableSales 
} from '../controllers/emailTesting.controller.js';

const router = Router();

// 🧪 Obtener ventas disponibles para testing
router.get('/sales', getTestableSales);

// 🎨 Probar email de orden en impresión
router.post('/email/printing', testOrderPrintingEmail);

// 📦 Probar email de envío
router.post('/email/shipped', testOrderShippedEmail);

// ✅ Probar email de entrega
router.post('/email/delivered', testOrderDeliveredEmail);

export default router;