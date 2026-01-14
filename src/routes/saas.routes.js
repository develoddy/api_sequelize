import express from 'express';
import * as saasController from '../controllers/saas.controller.js';
import { authenticateTenant, authenticateTenantOnly, optionalTenantAuth } from '../middleware/tenantAuth.js';
import { registerLimiter, loginLimiter } from '../middlewares/rate-limit.middleware.js';

const router = express.Router();

/**
 * Routes: SaaS
 * Gestión de trials, subscripciones y tenants
 */

// ✅ Públicas (sin autenticación, CON rate limiting)
router.post('/saas/trial/start', registerLimiter, saasController.startTrial);
router.post('/saas/login', loginLimiter, saasController.loginTenant);

// 🔒 Protegidas (requieren autenticación de tenant)
router.get('/saas/check-access', authenticateTenant, saasController.checkAccess);
router.get('/saas/me', authenticateTenantOnly, saasController.getTenantProfile); // 🆕 Permitir acceso con trial expirado
router.post('/saas/subscribe', authenticateTenant, saasController.subscribeToModule);
router.post('/saas/cancel', authenticateTenant, saasController.cancelSubscription);

export default router;
