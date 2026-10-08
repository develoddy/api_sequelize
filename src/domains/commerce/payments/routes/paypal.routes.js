import { Router } from "express";
import {
    paypalWebhook,
    verifyOrCreateSale
} from "../controllers/paypal.controller.js";

const router = Router();
console.log('[PayPal Routes] PayPal routes module loaded — webhook route available at POST /api/paypal/webhook');

// Webhook de PayPal (sin auth, PayPal lo llama directamente)
router.post("/webhook", paypalWebhook);

// Endpoint para verificar/crear venta (llamado desde frontend)
router.post("/verify-or-create-sale", verifyOrCreateSale);

// Test endpoint
router.get("/test", (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'PayPal', 
        timestamp: new Date().toISOString(),
        message: 'PayPal service is operational' 
    });
});

export default router;
