import { Router } from "express";
import auth from '../middlewares/auth.js';
import {
    createCheckoutSession,
} from "../controllers/stripe.controller.js";

const router = Router();

router.post("/create-checkout-session", auth.optionalAuth, createCheckoutSession);

export default router;
