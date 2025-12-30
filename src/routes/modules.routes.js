import express from 'express';
import * as modulesController from '../controllers/modules.controller.js';
import auth from '../middlewares/auth.js';

/**
 * Routes: Modules
 * Sistema multi-módulo para validar ideas (Levels-style)
 */

const router = express.Router();

// Listar todos los módulos
router.get('/modules', auth.verifyAdmin, modulesController.listModules);

// Resumen general
router.get('/modules/stats/summary', auth.verifyAdmin, modulesController.getModulesSummary);

// Crear nuevo módulo
router.post('/modules', auth.verifyAdmin, modulesController.createModule);

// Obtener módulo específico
router.get('/modules/:key', auth.verifyAdmin, modulesController.getModuleByKey);

// Actualizar módulo
router.put('/modules/:key', auth.verifyAdmin, modulesController.updateModule);

// Estado de validación
router.get('/modules/:key/validation-status', auth.verifyAdmin, modulesController.getValidationStatus);

// Toggle activar/desactivar
router.patch('/modules/:key/toggle', auth.verifyAdmin, modulesController.toggleModule);

// Archivar módulo
router.post('/modules/:key/archive', auth.verifyAdmin, modulesController.archiveModule);

// Marcar como validado
router.patch('/modules/:key/validate', auth.verifyAdmin, modulesController.markAsValidated);

export default router;
