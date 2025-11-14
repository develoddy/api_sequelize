import express from 'express';
import auth from '../middlewares/auth.js';
import { 
    sendTestNotification, 
    getNotifications,
    markNotificationAsRead 
} from '../controllers/notifications/notifications.controller.js';

const router = express.Router();

// Ruta temporal de prueba
//router.get('/emit-test', sendTestNotification);
router.post('/emit-test', sendTestNotification);

router.get('/', auth.verifyAdmin, getNotifications);
router.patch('/:id/read', auth.verifyAdmin, markNotificationAsRead);

export default router;
