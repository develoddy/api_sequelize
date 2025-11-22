import express from 'express';
import { 
    subscribe, 
    getStats, 
    listSubscribers, 
    unsubscribe, 
    verifyEmail,
    sendLaunchEmailsCampaign
} from '../controllers/prelaunch.controller.js';

const router = express.Router();

// Rutas públicas
router.post('/subscribe', subscribe);
router.get('/unsubscribe', unsubscribe);
router.get('/verify', verifyEmail);

// Rutas administrativas (puedes agregar middleware de autenticación aquí)
router.get('/stats', getStats);
router.get('/subscribers', listSubscribers);
router.post('/send-launch-emails', sendLaunchEmailsCampaign);

export default router;