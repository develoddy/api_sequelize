/**
 * Tracking Events Routes
 * 
 * Rutas para tracking de eventos y métricas del funnel.
 * 
 * @module routes/trackingEvents
 */

import { Router } from 'express';
import analyticsController from '../controllers/analytics.controller.js';
import auth from '../middlewares/auth.js';

const router = Router();

/**
 * POST /api/tracking/events
 * Recibir evento de tracking (público)
 */
router.post('/events', analyticsController.trackEvent);

/**
 * GET /api/tracking/funnel/:module
 * Obtener métricas del funnel (requiere autenticación admin)
 */
router.get('/funnel/:module', auth.verifyAdmin, analyticsController.getFunnelMetrics);

/**
 * GET /api/tracking/session/:sessionId
 * Obtener eventos de una sesión (requiere autenticación admin)
 */
router.get('/session/:sessionId', auth.verifyAdmin, analyticsController.getSessionEvents);

/**
 * GET /api/tracking/conversion-rate/:module
 * Obtener tasa de conversión (requiere autenticación admin)
 */
router.get('/conversion-rate/:module', auth.verifyAdmin, analyticsController.getConversionRate);

export default router;
