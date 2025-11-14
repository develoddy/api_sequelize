import { Router } from 'express';
import auth from '../middlewares/auth.js';
import {
  getList,
  getById,
  create,
  update,
  getBySale,
  generatePdf
} from '../controllers/receipt.controller.js';

const router = Router();

// 📦 CRUD básico
router.post('/', auth.verifyAdmin, create);
router.get('/', auth.verifyAdmin, getList);

// ⚡ Rutas específicas primero
router.get('/by-sale/:saleId', auth.verifyAdmin, getBySale);

// ⚡ Ruta dinámica al final
router.get('/:id', auth.verifyAdmin, getById);
router.patch('/:id', auth.verifyAdmin, update);

router.get('/:id/pdf', auth.verifyAdmin, generatePdf);

export default router;
