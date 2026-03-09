import { Router } from 'express';
import { createSetupRequest } from '../controllers/inboxZeroPrevention.controller.js';

const router = Router();

/**
 * 📬 Inbox Zero Prevention - Public Routes
 * Endpoints públicos (sin autenticación) para solicitudes de setup
 */

// POST /api/public/inbox-zero/setup-request
// Crear solicitud de setup desde el formulario público
router.post('/setup-request', createSetupRequest);

export default router;
