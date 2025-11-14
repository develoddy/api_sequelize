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
    adminCorrectSale,
    hasSales,
    getLastSale
} from "../controllers/sale.controller.js";
import { refreshPrintfulStatus } from "../controllers/admin/sales.controller.js";

const router = Router();

// 🛒 Registro de ventas (público/ecommerce)
router.post("/register", auth.verifyEcommerce, register);
router.post("/register-guest", registerGuest);

// 🧾 Recuperar venta por sesión de Stripe
router.get("/by-session/:sessionId", auth.optionalAuth, getSaleBySession);

// 📦 Listado y detalle de ventas (panel admin)
router.get('/list', auth.verifyAdmin, list);
router.get('/show/:id', auth.verifyAdmin, show);
// Obtener dirección de una venta (para admin)
router.get('/address/:id', auth.verifyAdmin, address);

// ✅ Nuevo endpoint: comprobar si un usuario/guest tiene ventas
router.get('/has', auth.verifyAdmin, hasSales);
// ✅ Obtener la última venta por email o id
router.get('/last/:identifier', auth.verifyAdmin, getLastSale);

// ⚙️ Funciones administrativas
router.post('/admin/create', auth.verifyAdmin, createAdminSale);
// Admin correct sale (create replacement/correction order linked to original)
router.post('/admin/:id/correct', auth.verifyAdmin, adminCorrectSale);

// 🔄 Actualizar estado Printful de una venta
router.get('/admin/printful/refresh/:id', auth.verifyAdmin, refreshPrintfulStatus);


export default router;