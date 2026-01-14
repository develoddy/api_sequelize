import express from 'express';
import * as saasAdminController from '../controllers/saas-admin.controller.js';
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

export default router;
