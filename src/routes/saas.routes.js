import express from 'express';
import * as saasController from '../controllers/saas.controller.js';
import { authenticateTenant, optionalTenantAuth } from '../middleware/tenantAuth.js';

const router = express.Router();

/**
 * Routes: SaaS
 * Gestión de trials, subscripciones y tenants
 */

// ✅ Públicas (sin autenticación)
router.post('/saas/trial/start', saasController.startTrial);
router.post('/saas/login', saasController.loginTenant);

// 🔒 Protegidas (requieren autenticación de tenant)
router.get('/saas/check-access', authenticateTenant, saasController.checkAccess);
router.get('/saas/me', authenticateTenant, saasController.getTenantProfile);
router.post('/saas/subscribe', authenticateTenant, saasController.subscribeToModule);
router.post('/saas/cancel', authenticateTenant, saasController.cancelSubscription);

export default router;
