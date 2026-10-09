import express from 'express';
import { getHealthStatus, getSimpleHealth } from '../domains/platform/health/controllers/health.controller.js';

const router = express.Router();

/**
 * 🏥 Health Check Routes
 * 
 * Endpoints para monitoreo del sistema
 */

// Health check completo (con verificación de servicios)
router.get('/health', getHealthStatus);

// Health check simple (solo verifica si servidor responde)
router.get('/health/simple', getSimpleHealth);

export default router;
