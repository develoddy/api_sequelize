import { Router } from 'express';
import auth from '../middlewares/auth.js';
import {
    resetDatabase,
    runMigrations,
    rollbackMigration,
    getDatabaseStatus
} from '../controllers/database-management.controller.js';

const router = Router();

/**
 * ================================================================
 * 🚨 DATABASE MANAGEMENT ROUTES - SUPER ADMIN ONLY
 * ================================================================
 * 
 * Estas rutas manejan operaciones críticas de base de datos:
 * - Reset completo (destructivo)
 * - Ejecución de migraciones
 * - Rollback de migraciones
 * - Estado del sistema
 * 
 * ⚠️ SEGURIDAD:
 * - Solo usuarios con rol SUPER_ADMIN
 * - Múltiples confirmaciones requeridas
 * - Logging detallado de todas las operaciones
 * - Variables de entorno como salvaguardas
 */

// ====================================
// 🔒 MIDDLEWARE DE SUPER ADMIN
// ====================================

/**
 * Verificar que el usuario sea SUPER_ADMIN
 * Middleware adicional específico para operaciones de base de datos
 */
const verifySuperAdmin = (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado'
            });
        }

        // Verificar rol de SUPER_ADMIN (ajustar según tu sistema de roles)
        const isSuperAdmin = req.user.role === 'super_admin' || 
                           req.user.role === 'SUPER_ADMIN' ||
                           req.user.is_super_admin === true ||
                           req.user.roles?.includes('SUPER_ADMIN');

        if (!isSuperAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Acceso denegado. Solo super administradores pueden realizar operaciones de base de datos.'
            });
        }

        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error verificando permisos de super admin',
            error: error.message
        });
    }
};

// ====================================
// 📊 RUTAS DE INFORMACIÓN (GET)
// ====================================

/**
 * GET /database-management/status
 * Obtener estado general del sistema de base de datos
 */
router.get('/status', auth.verifySuperAdmin, getDatabaseStatus);

// ====================================
// 🛠️ RUTAS DE OPERACIONES (POST)
// ====================================

/**
 * POST /database-management/reset
 * 🚨 OPERACIÓN DESTRUCTIVA: Reset completo de la base de datos
 * 
 * Body requerido:
 * {
 *   "confirmReset": true,
 *   "confirmText": "DELETE ALL DATA",
 *   "createBackupFirst": true,
 *   "reason": "Motivo del reset",
 *   "adminPassword": "password_adicional" // opcional
 * }
 */
router.post('/reset', auth.verifySuperAdmin, resetDatabase);

/**
 * POST /database-management/migrate
 * Ejecutar migraciones pendientes
 * 
 * Body requerido:
 * {
 *   "confirmMigrations": true
 * }
 */
router.post('/migrate', auth.verifySuperAdmin, runMigrations);

/**
 * POST /database-management/rollback
 * Rollback de la última migración
 * 
 * Body requerido:
 * {
 *   "confirmRollback": true
 * }
 */
router.post('/rollback', auth.verifySuperAdmin, rollbackMigration);

// ====================================
// 🔗 INTEGRACIÓN CON BACKUPS
// ====================================

/**
 * Nota: Las operaciones de backup están disponibles a través del módulo
 * existente /backups. Este módulo se integra con ese sistema para
 * crear backups automáticos antes de operaciones destructivas.
 * 
 * Rutas de backups (ya existentes):
 * - GET /backups - Listar backups
 * - POST /backups/create - Crear backup manual  
 * - POST /backups/restore - Restaurar backup
 * - DELETE /backups/:filename - Eliminar backup
 */

export default router;