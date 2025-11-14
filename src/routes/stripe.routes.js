import { Router } from "express";
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

// 🔹 Nuevo endpoint para el webhook
// Nota: Stripe NO envía auth, por eso no usamos auth middleware
router.post("/webhook", stripeWebhook);

export default router;
