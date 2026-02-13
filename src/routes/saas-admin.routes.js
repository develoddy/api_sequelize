import express from 'express';
import * as saasAdminController from '../controllers/saas-admin.controller.js';
import * as microSaasAnalyticsController from '../controllers/microSaasAnalytics.controller.js';
import { authenticateAdmin, logAdminAction } from '../middlewares/auth.middleware.js';

const router = express.Router();

// 🔒 Aplicar autenticación de admin a todas las rutas
router.use(authenticateAdmin);

// Tenants management routes
router.get('/tenants', saasAdminController.getAllTenants);
router.get('/tenants/:id', saasAdminController.getTenantById);
router.get('/tenants/:id/notes', saasAdminController.getTenantNotes);
router.post('/tenants/:id/extend-trial', logAdminAction('EXTEND_TRIAL'), saasAdminController.extendTrial);
router.post('/tenants/:id/cancel-subscription', logAdminAction('CANCEL_SUBSCRIPTION'), saasAdminController.cancelSubscription);
router.post('/tenants/:id/suspend', logAdminAction('SUSPEND_TENANT'), saasAdminController.suspendTenant);
router.post('/tenants/:id/reactivate', logAdminAction('REACTIVATE_TENANT'), saasAdminController.reactivateTenant);
router.post('/tenants/:id/change-plan', logAdminAction('CHANGE_PLAN'), saasAdminController.changePlan);
router.post('/tenants/:id/notes', saasAdminController.addNote);
router.delete('/tenants/:id', logAdminAction('DELETE_TENANT'), saasAdminController.deleteTenant);

// Tracking Events Management
router.get('/tracking-events', saasAdminController.getTrackingEvents);
router.get('/tracking-events/modules', saasAdminController.getUniqueModules);
router.get('/tracking-events/event-types', saasAdminController.getUniqueEvents);
router.get('/tracking-events/export', saasAdminController.exportTrackingEventsToCSV);
// ⚠️ Delete events by source (dev only - para limpiar tests internos)
router.delete('/tracking-events/by-source/:source', logAdminAction('DELETE_EVENTS_BY_SOURCE'), saasAdminController.deleteEventsBySource);

// 🧠 Micro-SaaS Analytics & Decision Engine
router.get('/micro-saas/analytics', microSaasAnalyticsController.getAllMicroSaasAnalytics);
router.get('/micro-saas/analytics/:moduleKey', microSaasAnalyticsController.getMicroSaasAnalytics);
router.get('/micro-saas/trending', microSaasAnalyticsController.getTrendingMVPs);
router.post('/micro-saas/:moduleKey/create-module', logAdminAction('CREATE_MODULE_FROM_MVP'), microSaasAnalyticsController.createModuleFromMVP);
router.post('/micro-saas/:moduleKey/decision', logAdminAction('EXECUTE_MVP_DECISION'), microSaasAnalyticsController.executeMVPDecision);

export default router;
