import { Router } from 'express';
import auth from '../middlewares/auth.js';
import {
    getList,
    getById,
    create,
    update,
    getBySale,
    hasReturns
} from '../controllers/return.controller.js';

const router = Router();

// 📦 CRUD básico
router.post('/', auth.verifyAdmin, create);
router.get('/', auth.verifyAdmin, getList);

// ⚡ Rutas específicas primero
router.get('/by-sale/:saleId', auth.verifyAdmin, getBySale);
router.get('/has', auth.verifyAdmin, hasReturns);

// ⚡ Ruta dinámica al final
router.get('/:id', auth.verifyAdmin, getById);
router.patch('/:id', auth.verifyAdmin, update);

export default router;



