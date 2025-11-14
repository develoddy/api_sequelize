import { Router } from 'express';
import auth from '../middlewares/auth.js';
import {
    getList,
    getById,
    getBySale,
    update
} from '../controllers/shipping.controller.js';

const router = Router();

// 📦 CRUD básico
router.get('/', auth.verifyAdmin, getList);

// ⚡ Rutas específicas primero
router.get('/by-sale/:saleId', auth.verifyAdmin, getBySale);

// ⚡ Ruta dinámica al final
router.get('/:id', auth.verifyAdmin, getById);
router.patch('/:id', auth.verifyAdmin, update);

export default router;
