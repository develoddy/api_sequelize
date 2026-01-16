import express from 'express';
import * as modulesController from '../controllers/modules.controller.js';
import * as uploadController from '../controllers/modules.upload.controller.js';
import auth from '../middlewares/auth.js';

/**
 * Routes: Modules
 * Sistema multi-módulo para validar ideas (Levels-style)
 */

const router = express.Router();

// 🌐 Rutas públicas (para frontend ecommerce)
// Listar módulos activos (solo status=live y is_active=true)
router.get('/modules/public', modulesController.listPublicModules);

// Obtener módulo público por key (solo si está activo y live)
router.get('/modules/public/:key', modulesController.getPublicModuleByKey);

// 🆕 Obtener módulo público por ID (para checkout)
router.get('/modules/:id(\\d+)', modulesController.getPublicModuleById);

// 🔒 Rutas protegidas (admin)
// Listar todos los módulos
router.get('/modules', auth.verifyAdmin, modulesController.listModules);

// Resumen general
router.get('/modules/stats/summary', auth.verifyAdmin, modulesController.getModulesSummary);

// Crear nuevo módulo
router.post('/modules', auth.verifyAdmin, modulesController.createModule);

// 📸 Upload de screenshots
router.post('/modules/:moduleKey/screenshots', 
  auth.verifyAdmin, 
  uploadController.upload.array('screenshots', 10), 
  uploadController.uploadModuleScreenshots
);

// Eliminar screenshot específico
router.delete('/modules/:moduleKey/screenshots/:filename', 
  auth.verifyAdmin, 
  uploadController.deleteModuleScreenshot
);

// Limpiar todos los screenshots de un módulo
router.delete('/modules/:moduleKey/screenshots', 
  auth.verifyAdmin, 
  uploadController.cleanModuleScreenshots
);

// 📦 Upload de archivo ZIP para productos digitales
router.post('/modules/:moduleKey/upload-zip', 
  auth.verifyAdmin, 
  uploadController.uploadZip.single('zip'), 
  uploadController.uploadModuleZip
);

// Eliminar archivo ZIP
router.delete('/modules/:moduleKey/zip', 
  auth.verifyAdmin, 
  uploadController.deleteModuleZip
);

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

// 🎬 Configurar preview mode
router.post('/modules/:key/configure-preview', auth.verifyAdmin, modulesController.configurePreview);

export default router;
