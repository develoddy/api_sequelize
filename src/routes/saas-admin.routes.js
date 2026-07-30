import express from 'express';
import * as microSaasAnalyticsController from '../controllers/microSaasAnalytics.controller.js';
import { authenticateAdmin, logAdminAction } from '../middlewares/auth.middleware.js';

const router = express.Router();

// 🔒 Aplicar autenticación de admin a todas las rutas
router.use(authenticateAdmin);

// 🧠 Micro-SaaS Analytics & Decision Engine
router.get('/micro-saas/analytics', microSaasAnalyticsController.getAllMicroSaasAnalytics);
router.get('/micro-saas/analytics/:moduleKey', microSaasAnalyticsController.getMicroSaasAnalytics);
router.get('/micro-saas/trending', microSaasAnalyticsController.getTrendingMVPs);
router.post('/micro-saas/:moduleKey/create-module', logAdminAction('CREATE_MODULE_FROM_MVP'), microSaasAnalyticsController.createModuleFromMVP);
router.post('/micro-saas/:moduleKey/decision', logAdminAction('EXECUTE_MVP_DECISION'), microSaasAnalyticsController.executeMVPDecision);

export default router;
