import { Router } from "express";
import fs from 'fs';
import auth from '../middlewares/auth.js';
import multer from 'multer';

import { 
    register,
    registerGuest,
    getSaleBySession
} from "../controllers/sale.controller.js";

const router = Router();

router.post("/register", auth.verifyEcommerce, register);
router.post("/register-guest", registerGuest);
// Recuperar venta existente según sesión de Stripe
router.get("/by-session/:sessionId", auth.optionalAuth, getSaleBySession);


export default router;