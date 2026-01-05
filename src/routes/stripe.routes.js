import { Router } from "express";
import express from "express";
import auth from '../middlewares/auth.js';
import {
    createCheckoutSession,
    getCheckoutSession,
    stripeWebhook
} from "../controllers/stripe.controller.js";

const router = Router();
console.log('[Stripe Routes] Stripe routes module loaded — webhook route available at POST /api/stripe/webhook');

router.post("/create-checkout-session", auth.optionalAuth, createCheckoutSession);

// Endpoint para obtener detalles de una sesión de Stripe Checkout
router.get("/session/:sessionId", auth.optionalAuth, getCheckoutSession);

// 🔹 Webhook de Stripe - RAW body configurado en app.js
router.post("/webhook", stripeWebhook);

// Test endpoint para el frontend
router.get("/test", (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'Stripe', 
        timestamp: new Date().toISOString(),
        message: 'Stripe service is operational' 
    });
});

export default router;
