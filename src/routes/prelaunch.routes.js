import express from 'express';
import { 
    subscribe, 
    getStats, 
    listSubscribers, 
    unsubscribe, 
    verifyEmail,
    sendLaunchEmailsCampaign,
    getAllSubscribers,
    getSubscriberById,
    previewLaunchEmail,
    exportSubscribers,
    resendVerification
} from '../controllers/prelaunch.controller.js';

const router = express.Router();

// Rutas públicas
router.post('/subscribe', subscribe);
router.get('/unsubscribe', unsubscribe);
router.get('/verify', verifyEmail);

// Rutas administrativas básicas
router.get('/stats', getStats);
router.get('/subscribers', listSubscribers);
router.post('/send-launch-emails', sendLaunchEmailsCampaign);

// Rutas ADMIN específicas (agregar middleware de autenticación si es necesario)
router.get('/admin/subscribers', getAllSubscribers); // Lista completa con filtros
router.get('/admin/subscribers/:id', getSubscriberById); // Detalle de suscriptor
router.post('/admin/campaigns/launch', sendLaunchEmailsCampaign); // Enviar campaña
router.post('/admin/campaigns/preview', previewLaunchEmail); // Preview del email
router.get('/admin/export', exportSubscribers); // Exportar CSV
router.post('/admin/resend-verification', resendVerification); // Reenviar verificación

export default router;