import express from 'express';
import * as saasAdminController from '../controllers/saas-admin.controller.js';
import * as microSaasAnalyticsController from '../controllers/microSaasAnalytics.controller.js';
import { authenticateAdmin, logAdminAction } from '../middlewares/auth.middleware.js';

const router = express.Router();

// 🔒 Aplicar autenticación de admin a todas las rutas
router.use(authenticateAdmin);

// Tracking Events Management
router.get('/tracking-events', saasAdminController.getTrackingEvents);
router.get('/tracking-events/modules', saasAdminController.getUniqueModules);
router.get('/tracking-events/event-types', saasAdminController.getUniqueEvents);
router.get('/tracking-events/export', saasAdminController.exportTrackingEventsToCSV);
// ⚠️ Delete events by source (LEGACY - mantener para compatibilidad)
router.delete('/tracking-events/by-source/:source', logAdminAction('DELETE_EVENTS_BY_SOURCE'), saasAdminController.deleteEventsBySource);
// 🆕 Delete internal access events (UTM tracking system)
router.delete('/tracking-events/internal-access', logAdminAction('DELETE_INTERNAL_ACCESS_EVENTS'), saasAdminController.deleteInternalAccessEvents);

// 🧠 Micro-SaaS Analytics & Decision Engine
router.get('/micro-saas/analytics', microSaasAnalyticsController.getAllMicroSaasAnalytics);
router.get('/micro-saas/analytics/:moduleKey', microSaasAnalyticsController.getMicroSaasAnalytics);
router.get('/micro-saas/trending', microSaasAnalyticsController.getTrendingMVPs);
router.post('/micro-saas/:moduleKey/create-module', logAdminAction('CREATE_MODULE_FROM_MVP'), microSaasAnalyticsController.createModuleFromMVP);
router.post('/micro-saas/:moduleKey/decision', logAdminAction('EXECUTE_MVP_DECISION'), microSaasAnalyticsController.executeMVPDecision);

export default router;
