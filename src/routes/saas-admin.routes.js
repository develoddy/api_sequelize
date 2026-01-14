import express from 'express';
import * as saasAdminController from '../controllers/saas-admin.controller.js';

const router = express.Router();

// Tenants management routes
router.get('/tenants', saasAdminController.getAllTenants);
router.get('/tenants/:id', saasAdminController.getTenantById);
router.get('/tenants/:id/notes', saasAdminController.getTenantNotes);
router.post('/tenants/:id/extend-trial', saasAdminController.extendTrial);
router.post('/tenants/:id/cancel-subscription', saasAdminController.cancelSubscription);
router.post('/tenants/:id/suspend', saasAdminController.suspendTenant);
router.post('/tenants/:id/reactivate', saasAdminController.reactivateTenant);
router.post('/tenants/:id/change-plan', saasAdminController.changePlan);
router.post('/tenants/:id/notes', saasAdminController.addNote);
router.delete('/tenants/:id', saasAdminController.deleteTenant);

export default router;
