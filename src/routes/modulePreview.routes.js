/**
 * Module Preview Routes
 * 
 * Rutas públicas y protegidas para el sistema genérico de Preview Mode.
 * 
 * Endpoints públicos (sin auth):
 * - GET    /api/modules/preview/available      - Lista de módulos con preview
 * - GET    /api/modules/:module_key/preview/config - Configuración de preview
 * - POST   /api/modules/:module_key/preview/generate - Generar preview (rate limited)
 * - POST   /api/modules/:module_key/preview/validate - Validar preview data
 * 
 * Endpoints protegidos (con auth):
 * - POST   /api/modules/:module_key/preview/convert - Convertir preview en BD real
 * 
 * @module routes/modulePreview
 */

import express from 'express';
import modulePreviewController from '../controllers/modulePreviewController.js';
import { authenticateTenant } from '../middleware/tenantAuth.js';

const router = express.Router();

// ========================================
// ENDPOINTS PÚBLICOS (sin autenticación)
// ========================================

/**
 * GET /api/modules/preview/available
 * Obtener módulos con preview habilitado
 */
router.get(
  '/preview/available',
  modulePreviewController.getAvailablePreviews
);

/**
 * GET /api/modules/:module_key/preview/config
 * Obtener configuración de preview de un módulo
 */
router.get(
  '/:module_key/preview/config',
  modulePreviewController.getModulePreviewConfig
);

/**
 * POST /api/modules/:module_key/preview/generate
 * Generar preview con rate limiting
 */
router.post(
  '/:module_key/preview/generate',
  modulePreviewController.previewRateLimiter,
  modulePreviewController.generateModulePreview
);

/**
 * POST /api/modules/:module_key/preview/validate
 * Validar datos de preview
 */
router.post(
  '/:module_key/preview/validate',
  modulePreviewController.validatePreview
);

// ========================================
// ENDPOINTS PROTEGIDOS (con autenticación)
// ========================================

/**
 * POST /api/modules/:module_key/preview/convert
 * Convertir preview en configuración real
 * Requiere autenticación con authenticateTenant middleware
 */
router.post(
  '/:module_key/preview/convert',
  authenticateTenant,
  modulePreviewController.convertPreviewToReal
);

export default router;
