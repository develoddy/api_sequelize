import { Router } from 'express';
import auth from '../../../middlewares/auth.js';
import { create, getList, getById, update, getByUser } from '../controllers/inbox.controller.js';

const router = Router();

// 📬 CRUD básico
router.post('/', auth.verifyAdmin, create);
router.get('/', auth.verifyAdmin, getList);
router.get('/:id', auth.verifyAdmin, getById);
router.patch('/:id', auth.verifyAdmin, update);

// 📬 Mensajes de un usuario
router.get('/user/:userId', auth.verifyAdmin, getByUser);

export default router;
