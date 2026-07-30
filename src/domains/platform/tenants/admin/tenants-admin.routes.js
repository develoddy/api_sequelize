import express from 'express';
import * as tenantsAdminController from './tenants-admin.controller.js';
import { authenticateAdmin, logAdminAction } from '../../../../middlewares/auth.middleware.js';

const router = express.Router();

// 🔒 Aplicar autenticación de admin a todas las rutas
router.use(authenticateAdmin);

// Tenants management routes (relativas al mount path /admin/saas/tenants)
router.get('/', tenantsAdminController.getAllTenants);
router.get('/:id', tenantsAdminController.getTenantById);
router.get('/:id/notes', tenantsAdminController.getTenantNotes);
router.post('/:id/extend-trial', logAdminAction('EXTEND_TRIAL'), tenantsAdminController.extendTrial);
router.post('/:id/cancel-subscription', logAdminAction('CANCEL_SUBSCRIPTION'), tenantsAdminController.cancelSubscription);
router.post('/:id/suspend', logAdminAction('SUSPEND_TENANT'), tenantsAdminController.suspendTenant);
router.post('/:id/reactivate', logAdminAction('REACTIVATE_TENANT'), tenantsAdminController.reactivateTenant);
router.post('/:id/change-plan', logAdminAction('CHANGE_PLAN'), tenantsAdminController.changePlan);
router.post('/:id/notes', tenantsAdminController.addNote);
router.delete('/:id', logAdminAction('DELETE_TENANT'), tenantsAdminController.deleteTenant);

export default router;
