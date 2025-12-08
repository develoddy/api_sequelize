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
    resendVerification,
    getPrelaunchConfig,
    updatePrelaunchConfig,
    getPrelaunchStatus
} from '../controllers/prelaunch.controller.js';
import auth from '../middlewares/auth.js';

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

// ============================================================================
//                    RUTAS DE CONFIGURACIÓN PRE-LAUNCH MODE
// ============================================================================

// Ruta pública para obtener estado (para frontend ecommerce)
router.get('/status', getPrelaunchStatus);

// Rutas administrativas para configuración
router.get('/config', auth.verifyAdmin, getPrelaunchConfig);
router.put('/config', auth.verifyAdmin, updatePrelaunchConfig);

export default router;