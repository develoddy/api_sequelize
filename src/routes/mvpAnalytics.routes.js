import express from 'express';
import { getAllMvps, getMvpDetail } from '../controllers/mvpAnalytics.controller.js';

const router = express.Router();

/**
 * MVP Analytics Routes
 * 
 * Endpoints para análisis dinámicos de MVPs basados en tracking_events
 * 
 * @routes
 *   GET /api/mvp-analytics/all       → Listado de todos los MVPs con resumen
 *   GET /api/mvp-analytics/:moduleKey → Análisis detallado de un MVP
 */

// Obtener todos los MVPs con analytics resumidos
router.get('/all', getAllMvps);

// Obtener analytics detallados de un MVP específico
router.get('/:moduleKey', getMvpDetail);

export default router;
