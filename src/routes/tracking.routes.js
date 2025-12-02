import { Router } from 'express';
import { getTrackingStatus } from '../controllers/tracking.controller.js';

const router = Router();

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
router.get('/:orderId/:token', getTrackingStatus);

export default router;
