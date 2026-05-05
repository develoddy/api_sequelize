import express from 'express';
import { requireTenant } from '../middlewares/tenant-auth.middleware.js';
import {
    generateOnboardingSequence,
    activateSequence,
    pauseSequence,
    updateSequenceEmail,
    getSequenceStatus,
    getSequence,
    listSequences
} from '../controllers/mailflow.controller.js';

const router = express.Router();

/**
 * ============================================================================
 * MAILFLOW ROUTES - MVP MODE (PUBLIC VALIDATION)
 * ============================================================================
 * 
 * ⚠️ DO NOT REVERT YET - VALIDATION PHASE ACTIVE
 * 
 * CURRENT STATE:
 * - No authentication required (intentional for MVP)
 * - No requireTenant middleware applied
 * - localStorage-based user identity (frontend)
 * - Single-user session model
 * 
 * WHY:
 * - Public landing validation
 * - Early adopter acquisition without login friction
 * - Real conversion measurement
 * - Pricing validation ($19/mo)
 * 
 * FUTURE (AFTER VALIDATION):
 * - Restore requireTenant on all routes
 * - Add real auth (JWT / Clerk / Auth0)
 * - Multi-tenant isolation
 * - Workspace model
 * - RBAC permissions
 * 
 * VALIDATION GOALS:
 * - 10-50 real users testing
 * - Conversion metrics
 * - Payment intent signals
 * 
 * TIMELINE:
 * - Phase 1 (NOW): Public MVP validation
 * - Phase 2 (AFTER): Production SaaS with auth
 * 
 * @date 2026-05-05
 * ============================================================================
 */

// Generar nueva secuencia
router.post('/sequences/generate', generateOnboardingSequence);

// Listar secuencias
router.get('/sequences', listSequences);

// Obtener secuencia específica
router.get('/sequences/:sequenceId', getSequence);

// Obtener estado/estadísticas de secuencia
router.get('/sequences/:sequenceId/status', getSequenceStatus);

// Activar secuencia
router.post('/sequences/:sequenceId/activate', activateSequence);

// Pausar secuencia
router.post('/sequences/:sequenceId/pause', pauseSequence);

// Actualizar email de secuencia
router.patch('/sequences/:sequenceId/emails/:emailOrder', updateSequenceEmail);

export default router;
