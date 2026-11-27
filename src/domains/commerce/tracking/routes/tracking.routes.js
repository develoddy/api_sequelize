import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getTrackingStatus } from '../controllers/tracking.controller.js';

const router = Router();

const trackingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiadas consultas. Inténtalo más tarde.'
  }
});

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  next();
});

/**
 * ==================================================================================================
 * =                                    RUTAS DE TRACKING                                          =
 * ==================================================================================================
 * 
 * ✅ Rutas PÚBLICAS - No requieren autenticación
 * Igual que el módulo Printful, actúan como proxy a la API de Printful
 * Combinan datos de Printful + BD local
 */

/**
 * @route   GET /api/orders/tracking/:orderId/:token
 * @desc    Obtener estado de tracking de una orden (con validación de token)
 * @access  Public (requiere token válido)
 * @param   {string} orderId - ID de la venta (Sale.id)
 * @param   {string} token - Token de seguridad (trackingToken)
 * @returns {TrackingStatus} - Estado completo del tracking
 */
router.get(
  '/:orderId/:token',
  trackingLimiter,
  getTrackingStatus
);

export default router;
