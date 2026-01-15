import express from 'express';
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
 * Rutas de MailFlow - Secuencias de Onboarding
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
