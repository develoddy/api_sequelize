import express from 'express';
import { 
    subscribe, 
    confirmEmail,
    unsubscribe,
    getStats, 
    listSubscribers,
    getUserSubscription,
    createCampaign,
    sendTestCampaign,
    sendCampaign,
    getCampaigns,
    previewCampaign,
    exportSubscribers
} from '../controllers/newsletter.controller.js';
import auth from '../middlewares/auth.js';

const router = express.Router();

// ============================================
// RUTAS PÚBLICAS
// ============================================
router.post('/subscribe', subscribe);
router.get('/confirm', confirmEmail);
router.post('/unsubscribe', unsubscribe);
router.get('/unsubscribe', unsubscribe); // GET también para links en emails

// ============================================
// RUTAS PROTEGIDAS PARA USUARIOS AUTENTICADOS
// ============================================
router.get('/subscription', auth.verifyEcommerce, getUserSubscription);

// ============================================
// RUTAS ADMIN (protegidas con middleware)
// ============================================
router.get('/admin/stats', auth.verifyAdmin, getStats);
router.get('/admin/subscribers', auth.verifyAdmin, listSubscribers);
router.post('/admin/campaigns/create', auth.verifyAdmin, createCampaign);
router.post('/admin/campaigns/send-test', auth.verifyAdmin, sendTestCampaign);
router.post('/admin/campaigns/send', auth.verifyAdmin, sendCampaign);
router.get('/admin/campaigns', auth.verifyAdmin, getCampaigns);
router.post('/admin/campaigns/preview', auth.verifyAdmin, previewCampaign);
router.get('/admin/export', auth.verifyAdmin, exportSubscribers);

export default router;
