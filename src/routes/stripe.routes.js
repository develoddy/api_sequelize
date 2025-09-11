import { Router } from "express";
import auth from '../middlewares/auth.js';
import {
    createCheckoutSession,
    getCheckoutSession,
} from "../controllers/stripe.controller.js";

const router = Router();

router.post("/create-checkout-session", auth.optionalAuth, createCheckoutSession);
// Endpoint para obtener detalles de una sesión de Stripe Checkout
router.get("/session/:sessionId", auth.optionalAuth, getCheckoutSession);

export default router;
