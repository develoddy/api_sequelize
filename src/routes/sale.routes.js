import { Router } from "express";
import fs from 'fs';
import auth from '../middlewares/auth.js';
import multer from 'multer';

import { 
    register,
    registerGuest,
    getSaleBySession,
    list,
    show,
    address,
    createAdminSale,
    adminCorrectSale
} from "../controllers/sale.controller.js";
import { refreshPrintfulStatus } from "../controllers/admin/sales.controller.js";

const router = Router();

router.post("/register", auth.verifyEcommerce, register);
router.post("/register-guest", registerGuest);
// Recuperar venta existente según sesión de Stripe
router.get("/by-session/:sessionId", auth.optionalAuth, getSaleBySession);

// Listado de ventas para panel admin
router.get('/list', auth.verifyAdmin, list);
router.get('/show/:id', auth.verifyAdmin, show);
// Obtener dirección de una venta (para admin)
router.get('/address/:id', auth.verifyAdmin, address);
// Admin create sale (creates sale only if Printful accepts)
router.post('/admin/create', auth.verifyAdmin, createAdminSale);
// Admin correct sale (create replacement/correction order linked to original)
router.post('/admin/:id/correct', auth.verifyAdmin, adminCorrectSale);

// Admin: refresh Printful order status for a sale
router.get('/admin/printful/refresh/:id', auth.verifyAdmin, refreshPrintfulStatus);


export default router;