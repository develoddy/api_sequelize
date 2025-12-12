import { sequelize } from '../database/database.js';
import { logger, sanitize } from '../utils/logger.js';
import { BackupsController } from './backups.controller.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export class DatabaseManagementController {
    
    constructor() {
        this.backupsController = new BackupsController();
    }

    /**
     * 🚨 OPERACIÓN DESTRUCTIVA: Reset completo de la base de datos
     * Incluye backup automático antes del reset
     */
    async resetDatabase(req, res) {
        try {
            const { 
                confirmReset, 
                confirmText, 
                createBackupFirst = true, 
                adminPassword,
                reason = 'Database reset from admin panel'
            } = req.body;

            // ====================================
            // 🔒 VALIDACIONES DE SEGURIDAD
            // ====================================

            // 1. Verificar confirmación
            if (!confirmReset) {
                return res.status(400).json({
                    success: false,
                    message: 'Confirmación de reset requerida'
                });
            }

            // 2. Verificar texto de confirmación exacto
            if (confirmText !== 'DELETE ALL DATA') {
                return res.status(400).json({
                    success: false,
                    message: 'Texto de confirmación incorrecto. Debe escribir exactamente: "DELETE ALL DATA"'
                });
            }

            // 3. Verificar variable de entorno de seguridad
            if (process.env.ALLOW_DB_MANAGEMENT !== 'true') {
                logger.error('Intento de reset de DB sin permiso de entorno', {
                    user: req.user?.email,
                    ip: req.ip
                });
                return res.status(403).json({
                    success: false,
                    message: 'Operación no permitida. Variable ALLOW_DB_MANAGEMENT no habilitada.'
                });
            }

            // 4. Solo permitir en desarrollo o con flag especial
            const isDev = process.env.NODE_ENV !== 'production';
            const allowInProd = process.env.ALLOW_PROD_DB_RESET === 'true';
            
            if (!isDev && !allowInProd) {
                return res.status(403).json({
                    success: false,
                    message: 'Operación no permitida en producción sin flag especial'
                });
            }

            logger.warn('🚨 INICIANDO RESET COMPLETO DE BASE DE DATOS', {
                user: req.user?.email || 'unknown',
                environment: process.env.NODE_ENV,
                reason: sanitize.string(reason),
                createBackupFirst,
                timestamp: new Date().toISOString(),
                ip: req.ip
            });

            let backupFilename = null;

            // ====================================
            // 📦 CREAR BACKUP AUTOMÁTICO
            // ====================================
            if (createBackupFirst) {
                try {
                    logger.info('Creando backup automático antes del reset...');
                    
                    // Crear backup usando el controller existente
                    const backupResult = await this.createAutomaticBackup(req.user);
                    
                    if (!backupResult.success) {
                        throw new Error(backupResult.message || 'Error creando backup automático');
                    }
                    
                    backupFilename = backupResult.filename;
                    logger.info('✅ Backup automático creado', { filename: backupFilename });

                } catch (backupError) {
                    logger.error('❌ Error creando backup automático', { 
                        error: backupError.message 
                    });
                    
                    return res.status(500).json({
                        success: false,
                        message: 'Error creando backup automático. Reset cancelado por seguridad.',
                        error: backupError.message
                    });
                }
            }

            // ====================================
            // 🔥 EJECUTAR RESET DE BASE DE DATOS
            // ====================================
            try {
                logger.warn('🔥 Ejecutando sequelize.sync({ force: true })...');
                
                // Esta es la operación destructiva que borra todo
                await sequelize.sync({ force: true });
                
                logger.warn('✅ Reset de base de datos completado');

            } catch (syncError) {
                logger.error('❌ Error durante el reset de base de datos', {
                    error: syncError.message,
                    stack: syncError.stack
                });

                return res.status(500).json({
                    success: false,
                    message: 'Error durante el reset de base de datos',
                    error: syncError.message,
                    backupCreated: backupFilename ? true : false,
                    backupFilename
                });
            }

            // ====================================
            // 🎯 RESPUESTA EXITOSA
            // ====================================
            const response = {
                success: true,
                message: 'Base de datos reseteada exitosamente',
                operation: 'DATABASE_RESET',
                executedAt: new Date().toISOString(),
                environment: process.env.NODE_ENV,
                user: req.user?.email || 'unknown',
                backupCreated: createBackupFirst,
                backupFilename,
                tablesRecreated: true,
                reason: sanitize.string(reason)
            };

            logger.warn('✅ RESET DE BASE DE DATOS COMPLETADO', response);

            return res.status(200).json(response);

        } catch (error) {
            logger.error('❌ Error general en reset de base de datos', {
                error: error.message,
                stack: error.stack,
                user: req.user?.email
            });

            return res.status(500).json({
                success: false,
                message: 'Error interno del servidor durante el reset',
                error: error.message
            });
        }
    }

    /**
     * 📦 Crear backup automático antes de operaciones destructivas
     */
    async createAutomaticBackup(user = null) {
        try {
            const scriptPath = path.join(process.cwd(), 'scripts', 'backup-database.sh');

            if (!fs.existsSync(scriptPath)) {
                throw new Error('Script de backup no encontrado');
            }

            logger.info('Creando backup automático', { 
                user: user?.email || 'system' 
            });

            // Ejecutar script de backup con timestamp específico
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                             new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
            
            const dbName = process.env.DB_NAME || 'ecommercedb';
            const filename = `${dbName}_AUTO_RESET_${timestamp}.sql.gz`;

            const envVars = {
                ...process.env,
                NODE_ENV: process.env.NODE_ENV || 'development',
                DB_NAME: process.env.DB_NAME,
                DB_USER: process.env.DB_USER,
                DB_PASSWORD: process.env.DB_PASSWORD,
                DB_HOST: process.env.DB_HOST,
                DB_PORT: process.env.DB_PORT || '3306',
                BACKUP_FILENAME: filename
            };

            const { stdout, stderr } = await execAsync('bash scripts/backup-database.sh', {
                env: envVars,
                cwd: process.cwd(),
                timeout: 300000 // 5 minutos
            });

            if (stderr && !stderr.includes('Warning')) {
                throw new Error(`Error en script de backup: ${stderr}`);
            }

            return {
                success: true,
                filename: filename,
                message: 'Backup automático creado exitosamente',
                output: stdout
            };

        } catch (error) {
            logger.error('Error creando backup automático', {
                error: error.message,
                user: user?.email || 'system'
            });

            return {
                success: false,
                message: error.message,
                error: error.message
            };
        }
    }

    /**
     * 🏃‍♂️ Ejecutar migraciones pendientes
     */
    async runMigrations(req, res) {
        try {
            const { confirmMigrations } = req.body;

            if (!confirmMigrations) {
                return res.status(400).json({
                    success: false,
                    message: 'Confirmación de migraciones requerida'
                });
            }

            logger.info('Ejecutando migraciones pendientes', {
                user: req.user?.email || 'unknown'
            });

            // Ejecutar migraciones con sequelize-cli
            const { stdout, stderr } = await execAsync('npx sequelize-cli db:migrate', {
                env: process.env,
                cwd: process.cwd(),
                timeout: 60000 // 1 minuto
            });

            logger.info('Migraciones ejecutadas', {
                stdout: stdout,
                stderr: stderr
            });

            return res.status(200).json({
                success: true,
                message: 'Migraciones ejecutadas exitosamente',
                output: stdout,
                warnings: stderr || null,
                executedAt: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Error ejecutando migraciones', {
                error: error.message,
                user: req.user?.email
            });

            return res.status(500).json({
                success: false,
                message: 'Error ejecutando migraciones',
                error: error.message
            });
        }
    }

    /**
     * ↩️ Rollback de última migración
     */
    async rollbackMigration(req, res) {
        try {
            const { confirmRollback } = req.body;

            if (!confirmRollback) {
                return res.status(400).json({
                    success: false,
                    message: 'Confirmación de rollback requerida'
                });
            }

            logger.warn('Ejecutando rollback de migración', {
                user: req.user?.email || 'unknown'
            });

            const { stdout, stderr } = await execAsync('npx sequelize-cli db:migrate:undo', {
                env: process.env,
                cwd: process.cwd(),
                timeout: 60000
            });

            return res.status(200).json({
                success: true,
                message: 'Rollback ejecutado exitosamente',
                output: stdout,
                warnings: stderr || null,
                executedAt: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Error ejecutando rollback', {
                error: error.message,
                user: req.user?.email
            });

            return res.status(500).json({
                success: false,
                message: 'Error ejecutando rollback',
                error: error.message
            });
        }
    }

    /**
     * 📊 Obtener estado general del sistema de base de datos
     */
    async getDatabaseStatus(req, res) {
        try {
            // Verificar conexión a la base de datos
            await sequelize.authenticate();
            
            // Obtener información de las tablas
            const [results] = await sequelize.query("SHOW TABLES");
            const tables = results.map(row => Object.values(row)[0]);

            // Verificar estado de migraciones
            let migrationStatus = null;
            try {
                const [migrationResults] = await sequelize.query(
                    "SELECT name FROM SequelizeMeta ORDER BY name DESC LIMIT 5"
                );
                migrationStatus = {
                    available: true,
                    lastMigrations: migrationResults.map(row => row.name)
                };
            } catch (migError) {
                migrationStatus = {
                    available: false,
                    error: 'Tabla SequelizeMeta no encontrada'
                };
            }

            const status = {
                success: true,
                database: {
                    connected: true,
                    name: process.env.DB_NAME,
                    host: process.env.DB_HOST,
                    dialect: process.env.DB_DIALECT || 'mysql',
                    environment: process.env.NODE_ENV
                },
                tables: {
                    count: tables.length,
                    list: tables.sort()
                },
                migrations: migrationStatus,
                permissions: {
                    canReset: process.env.ALLOW_DB_MANAGEMENT === 'true',
                    environment: process.env.NODE_ENV,
                    prodResetAllowed: process.env.ALLOW_PROD_DB_RESET === 'true'
                },
                checkedAt: new Date().toISOString()
            };

            return res.status(200).json(status);

        } catch (error) {
            logger.error('Error obteniendo estado de la base de datos', {
                error: error.message
            });

            return res.status(500).json({
                success: false,
                message: 'Error obteniendo estado de la base de datos',
                error: error.message
            });
        }
    }
}

// Exportar instancia del controller
export const databaseManagementController = new DatabaseManagementController();

// Métodos individuales para las rutas
export const resetDatabase = (req, res) => databaseManagementController.resetDatabase(req, res);
export const runMigrations = (req, res) => databaseManagementController.runMigrations(req, res);
export const rollbackMigration = (req, res) => databaseManagementController.rollbackMigration(req, res);
export const getDatabaseStatus = (req, res) => databaseManagementController.getDatabaseStatus(req, res);