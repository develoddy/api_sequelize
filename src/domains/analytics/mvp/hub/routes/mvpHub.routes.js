import express from 'express';
import * as mvpHubController from '../controllers/mvpHub.controller.js';

const router = express.Router();

/**
 * Routes: MVP Hub
 * 
 * Endpoints para el hub de MVPs
 * Basados en métricas reales, no en flags técnicos
 */

// Obtener MVPs activos con señales reales
router.get('/mvp-hub/modules', mvpHubController.getMvpHubModules);

// Obtener detalles de un MVP específico
router.get('/mvp-hub/modules/:key', mvpHubController.getMvpHubModuleDetails);

// Obtener candidatos a promoción (interno/admin)
router.get('/mvp-hub/promotion-candidates', mvpHubController.getPromotionCandidates);

export default router;
