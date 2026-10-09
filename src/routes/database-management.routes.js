import { Router } from 'express';
import auth from '../middlewares/auth.js';
import {
    resetDatabase,
    runMigrations,
    runSingleMigration,
    rollbackMigration,
    rollbackSingleMigration,
    getDatabaseStatus,
    getMigrationsStatus,
    getSeedersStatus,
    runSeeders,
    runSingleSeeder
} from '../domains/platform/database-management/controllers/database-management.controller.js';

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
 * POST /database-management/migrate/single
 * Ejecutar migración específica
 * 
 * Body requerido:
 * {
 *   "migrationName": "20241212120000-migration-name.cjs",
 *   "confirmMigration": true
 * }
 */
router.post('/migrate/single', auth.verifySuperAdmin, runSingleMigration);

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

/**
 * POST /database-management/rollback/single
 * Rollback de migración específica
 * 
 * Body requerido:
 * {
 *   "migrationName": "20241212120000-migration-name.cjs",
 *   "confirmRollback": true
 * }
 */
router.post('/rollback/single', auth.verifySuperAdmin, rollbackSingleMigration);

/**
 * GET /database-management/migrations/status
 * Obtener estado de migraciones (pendientes y ejecutadas)
 */
router.get('/migrations/status', auth.verifySuperAdmin, getMigrationsStatus);

/**
 * GET /database-management/seeders/status
 * Obtener seeders disponibles
 */
router.get('/seeders/status', auth.verifySuperAdmin, getSeedersStatus);

/**
 * POST /database-management/seeders/run
 * Ejecutar todos los seeders
 * 
 * Body requerido:
 * {
 *   "confirmSeeders": true
 * }
 */
router.post('/seeders/run', auth.verifySuperAdmin, runSeeders);

/**
 * POST /database-management/seeders/single
 * Ejecutar seeder específico
 * 
 * Body requerido:
 * {
 *   "seederName": "20241212120000-seeder-name.cjs",
 *   "confirmSeeder": true
 * }
 */
router.post('/seeders/single', auth.verifySuperAdmin, runSingleSeeder);

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