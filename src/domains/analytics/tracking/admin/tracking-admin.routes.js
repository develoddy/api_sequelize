import express from 'express';
import * as trackingAdminController from './tracking-admin.controller.js';
import { authenticateAdmin, logAdminAction } from '../../../../middlewares/auth.middleware.js';

const router = express.Router();

// 🔒 Aplicar autenticación de admin a todas las rutas
router.use(authenticateAdmin);

// Tracking Events Management
router.get('/', trackingAdminController.getTrackingEvents);
router.get('/modules', trackingAdminController.getUniqueModules);
router.get('/event-types', trackingAdminController.getUniqueEvents);
router.get('/export', trackingAdminController.exportTrackingEventsToCSV);
router.delete('/by-source/:source', logAdminAction('DELETE_EVENTS_BY_SOURCE'), trackingAdminController.deleteEventsBySource);
router.delete('/internal-access', logAdminAction('DELETE_INTERNAL_ACCESS_EVENTS'), trackingAdminController.deleteInternalAccessEvents);

export default router;
