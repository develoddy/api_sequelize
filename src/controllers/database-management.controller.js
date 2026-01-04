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
     * 🔐 Verificar si el reset está permitido (lógica completa)
     * Considera tanto ALLOW_DB_MANAGEMENT como ALLOW_PROD_DB_RESET en producción
     */
    checkResetPermissions() {
        const dbManagementAllowed = process.env.ALLOW_DB_MANAGEMENT === 'true';
        const isProduction = process.env.NODE_ENV === 'production';
        const prodResetAllowed = process.env.ALLOW_PROD_DB_RESET === 'true';

        // En desarrollo, solo requiere ALLOW_DB_MANAGEMENT
        if (!isProduction) {
            return dbManagementAllowed;
        }

        // En producción, requiere AMBAS variables
        return dbManagementAllowed && prodResetAllowed;
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
                
                // 🔧 Desactivar foreign key checks temporalmente (MySQL)
                // Esto permite eliminar tablas sin importar el orden de las dependencias
                await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
                logger.info('✅ Foreign key checks desactivadas');
                
                try {
                    // Esta es la operación destructiva que borra todo
                    await sequelize.sync({ force: true });
                    logger.warn('✅ Reset de base de datos completado');
                } finally {
                    // 🔧 Reactivar foreign key checks SIEMPRE (incluso si hay error)
                    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
                    logger.info('✅ Foreign key checks reactivadas');
                }

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
     * 📋 Obtener migraciones pendientes
     */
    async getMigrationsStatus(req, res) {
        try {
            logger.info('Obteniendo estado de migraciones', {
                user: req.user?.email || 'unknown'
            });

            // Limpiar archivos basura de macOS
            await this.cleanupTrashFiles();

            // Obtener estado de migraciones
            const env = process.env.NODE_ENV === 'production' ? 'NODE_ENV=production' : '';
            const command = `${env} npx sequelize-cli db:migrate:status`;
            
            const { stdout, stderr } = await execAsync(command, {
                env: process.env,
                cwd: process.cwd(),
                timeout: 30000 // 30 segundos
            });

            // Parsear el output para extraer migraciones pendientes y ejecutadas
            const lines = stdout.split('\n').filter(line => line.trim());
            const pendingMigrations = [];
            const executedMigrations = [];

            for (const line of lines) {
                if (line.includes('down')) {
                    // Migración pendiente
                    const migrationName = line.replace(/.*down\s+/, '').trim();
                    if (migrationName) {
                        pendingMigrations.push({
                            name: migrationName,
                            status: 'pending'
                        });
                    }
                } else if (line.includes('up')) {
                    // Migración ejecutada
                    const migrationName = line.replace(/.*up\s+/, '').trim();
                    if (migrationName) {
                        executedMigrations.push({
                            name: migrationName,
                            status: 'executed'
                        });
                    }
                }
            }

            return res.status(200).json({
                success: true,
                pendingMigrations,
                executedMigrations,
                totalPending: pendingMigrations.length,
                totalExecuted: executedMigrations.length,
                environment: process.env.NODE_ENV || 'development',
                checkedAt: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Error obteniendo estado de migraciones', {
                error: error.message,
                user: req.user?.email
            });

            return res.status(500).json({
                success: false,
                message: 'Error obteniendo estado de migraciones',
                error: error.message
            });
        }
    }

    /**
     * 📋 Obtener seeders disponibles
     */
    async getSeedersStatus(req, res) {
        console.log('🚀 getSeedersStatus INICIADO');
        
        try {
            console.log('📝 Logging usuario:', req.user?.email || 'unknown');

            // Limpiar archivos basura de macOS
            await this.cleanupTrashFiles();
            console.log('🧹 Archivos limpiados');

            // Leer archivos de seeders
            const seedersDir = path.join(process.cwd(), 'seeders');
            console.log('📂 Directorio seeders:', seedersDir);
            
            if (!fs.existsSync(seedersDir)) {
                console.log('❌ Directorio seeders no existe');
                return res.status(200).json({
                    success: true,
                    availableSeeders: [],
                    executedSeeders: [],
                    totalSeeders: 0,
                    message: 'No se encontró directorio de seeders'
                });
            }

            // Leer archivos del directorio
            const seederFiles = fs.readdirSync(seedersDir)
                .filter(file => file.endsWith('.cjs') || file.endsWith('.js'))
                .map(file => ({
                    name: file,
                    path: path.join(seedersDir, file),
                    size: fs.statSync(path.join(seedersDir, file)).size,
                    modified: fs.statSync(path.join(seedersDir, file)).mtime
                }));

            console.log(`📁 Encontrados ${seederFiles.length} archivos de seeders`);

            // Verificar cuáles seeders ya fueron ejecutados
            let executedSeeders = [];
            let availableSeeders = [];

            console.log('🔍 INICIANDO DETECCIÓN DE SEEDERS EJECUTADOS...');
            
            try {
                const { sequelize } = await import('../database/database.js');
                console.log('📦 Sequelize importado exitosamente (ES Module)');
                
                // Prueba de conexión
                await sequelize.authenticate();
                console.log('✅ Conexión a DB confirmada');
                
                // Verificar estado actual de postal_codes
                try {
                    const [allCounts] = await sequelize.query('SELECT country, COUNT(*) as count FROM postal_codes GROUP BY country');
                    console.log('🗺️ Estado actual postal_codes:', JSON.stringify(allCounts));
                } catch (dbError) {
                    console.log('⚠️ Error accediendo postal_codes:', dbError.message);
                }
                
                // Analizar cada seeder
                for (const seeder of seederFiles) {
                    const seederName = seeder.name;
                    let isExecuted = false;
                    let detectionMethod = 'ninguno';
                    
                    console.log(`\n🔍 Analizando: ${seederName}`);
                    
                    // Detección por país
                    if (seederName.includes('postal-codes-ES')) {
                        try {
                            const [result] = await sequelize.query('SELECT COUNT(*) as count FROM postal_codes WHERE country = ?', {
                                replacements: ['ES']
                            });
                            const count = result[0].count;
                            console.log(`   📊 España: ${count} registros`);
                            isExecuted = count > 0;
                            detectionMethod = `España: ${count}`;
                        } catch (e) { 
                            console.log(`   ❌ Error España:`, e.message);
                            isExecuted = false; 
                        }
                    }
                    else if (seederName.includes('postal-codes-FR')) {
                        try {
                            const [result] = await sequelize.query('SELECT COUNT(*) as count FROM postal_codes WHERE country = ?', {
                                replacements: ['FR']
                            });
                            const count = result[0].count;
                            console.log(`   📊 Francia: ${count} registros`);
                            isExecuted = count > 0;
                            detectionMethod = `Francia: ${count}`;
                        } catch (e) { 
                            console.log(`   ❌ Error Francia:`, e.message);
                            isExecuted = false; 
                        }
                    }
                    else if (seederName.includes('postal-codes-IT')) {
                        try {
                            const [result] = await sequelize.query('SELECT COUNT(*) as count FROM postal_codes WHERE country = ?', {
                                replacements: ['IT']
                            });
                            const count = result[0].count;
                            console.log(`   📊 Italia: ${count} registros`);
                            isExecuted = count > 0;
                            detectionMethod = `Italia: ${count}`;
                        } catch (e) { 
                            console.log(`   ❌ Error Italia:`, e.message);
                            isExecuted = false; 
                        }
                    }
                    
                    // 2. Seeders de newsletter/campañas
                    else if (seederName.match(/newsletter|campaign/i)) {
                        try {
                            const [result] = await sequelize.query('SELECT COUNT(*) as count FROM newsletter_campaigns');
                            isExecuted = result[0].count > 0;
                            detectionMethod = `newsletter_campaigns (${result[0].count} registros)`;
                        } catch (e) { 
                            logger.warn(`Error verificando newsletter_campaigns:`, e.message);
                            isExecuted = false; 
                        }
                    }
                    
                    // 3. Seeders de usuarios/admins
                    else if (seederName.match(/user|admin|account/i)) {
                        try {
                            // Verificar si hay usuarios con indicadores de seeding
                            const [result] = await sequelize.query(
                                'SELECT COUNT(*) as count FROM users WHERE email LIKE ? OR email LIKE ? OR email LIKE ?',
                                { replacements: ['%seed%', '%demo%', '%test%'] }
                            );
                            isExecuted = result[0].count > 0;
                            detectionMethod = `users_seeded (${result[0].count} usuarios de prueba)`;
                        } catch (e) { 
                            logger.warn(`Error verificando users seeded:`, e.message);
                            isExecuted = false; 
                        }
                    }
                    
                    // 4. Seeders de modules (20250101000000-modules-initial-data.cjs)
                    else if (seederName.includes('modules-initial-data') || seederName.includes('module')) {
                        try {
                            const [result] = await sequelize.query('SELECT COUNT(*) as count FROM modules');
                            const count = result[0].count;
                            console.log(`   📊 Modules: ${count} registros`);
                            isExecuted = count > 0;
                            detectionMethod = `modules (${count} registros)`;
                        } catch (e) { 
                            console.log(`   ❌ Error verificando modules:`, e.message);
                            isExecuted = false; 
                        }
                    }
                    
                    // 5. DETECCIÓN GENÉRICA para otros seeders
                    else {
                        // Analizar el nombre del seeder para inferir la tabla objetivo
                        const possibleTables = [];
                        
                        // Mapeo de patrones comunes a tablas
                        const tablePatterns = {
                            'product': 'products',
                            'category': 'categories', 
                            'categorie': 'categories',
                            'brand': 'brands',
                            'order': 'orders',
                            'coupon': 'coupons',
                            'setting': 'settings',
                            'config': 'settings',
                            'shipping': 'shipping_methods',
                            'payment': 'payment_methods'
                        };
                        
                        // Detectar posibles tablas basado en el nombre del seeder
                        for (const [pattern, table] of Object.entries(tablePatterns)) {
                            if (seederName.toLowerCase().includes(pattern)) {
                                possibleTables.push(table);
                            }
                        }
                        
                        // Verificar cada tabla posible
                        for (const table of possibleTables) {
                            try {
                                const [result] = await sequelize.query(`SELECT COUNT(*) as count FROM ${table}`);
                                if (result[0].count > 0) {
                                    isExecuted = true;
                                    detectionMethod = `${table} (${result[0].count} registros)`;
                                    break;
                                }
                            } catch (e) {
                                // Tabla no existe, continuar con la siguiente
                                continue;
                            }
                        }
                        
                        // Si no se pudo detectar por patrones, intentar detección por timestamps
                        if (!isExecuted && possibleTables.length === 0) {
                            detectionMethod = 'no_pattern_detected';
                        }
                    }
                    
                    console.log(`   🏁 RESULTADO: ${isExecuted ? '✅ EJECUTADO' : '⏳ PENDIENTE'} - Método: ${detectionMethod}`);
                    
                    if (isExecuted) {
                        executedSeeders.push({
                            ...seeder,
                            status: 'executed',
                            executedAt: seeder.modified
                        });
                    } else {
                        availableSeeders.push({
                            ...seeder,
                            status: 'available'
                        });
                    }
                }

            } catch (error) {
                console.log('💥 ERROR EN DETECCIÓN:', error.message);
                console.log('📚 Stack:', error.stack);
                
                // Si hay error, marcar todos como disponibles
                availableSeeders = seederFiles.map(seeder => ({
                    ...seeder,
                    status: 'available'
                }));
            }

            console.log(`\n📋 RESUMEN FINAL:`);
            console.log(`   • Available seeders: ${availableSeeders.length}`);
            console.log(`   • Executed seeders: ${executedSeeders.length}`);
            console.log(`   • Total seeders: ${seederFiles.length}`);
            
            if (availableSeeders.length > 0) {
                console.log(`   📄 Available:`, availableSeeders.map(s => s.name));
            }
            if (executedSeeders.length > 0) {
                console.log(`   ✅ Executed:`, executedSeeders.map(s => s.name));
            }

            console.log('📤 Enviando respuesta al frontend...');

            return res.status(200).json({
                success: true,
                availableSeeders: availableSeeders,
                executedSeeders: executedSeeders,
                totalSeeders: seederFiles.length,
                seedersDirectory: seedersDir,
                environment: process.env.NODE_ENV || 'development',
                checkedAt: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Error obteniendo seeders', {
                error: error.message,
                user: req.user?.email
            });

            return res.status(500).json({
                success: false,
                message: 'Error obteniendo seeders disponibles',
                error: error.message
            });
        }
    }

    /**
     * 🧹 Limpiar archivos basura de macOS
     */
    async cleanupTrashFiles() {
        try {
            const directories = ['migrations', 'seeders'];
            
            for (const dir of directories) {
                const dirPath = path.join(process.cwd(), dir);
                if (fs.existsSync(dirPath)) {
                    const command = `find "${dirPath}" -name "._*" -type f -delete`;
                    await execAsync(command);
                    logger.info(`Archivos basura limpiados en ${dir}`);
                }
            }

            return { success: true, message: 'Archivos basura limpiados' };
        } catch (error) {
            logger.warn('Error limpiando archivos basura', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * 🏃‍♂️ Ejecutar migración específica
     */
    async runSingleMigration(req, res) {
        try {
            console.log('🔧 [DEBUG] Request recibida en runSingleMigration:', {
                body: req.body,
                user: req.user?.email,
                timestamp: new Date().toISOString()
            });
            
            const { migrationName, confirmMigration } = req.body;

            if (!confirmMigration) {
                console.log('🔧 [DEBUG] Error: confirmMigration no está presente');
                return res.status(400).json({
                    success: false,
                    message: 'Confirmación de migración requerida'
                });
            }

            if (!migrationName) {
                console.log('🔧 [DEBUG] Error: migrationName no está presente');
                return res.status(400).json({
                    success: false,
                    message: 'Nombre de migración requerido'
                });
            }

            logger.info('Ejecutando migración específica', {
                migration: migrationName,
                user: req.user?.email || 'unknown'
            });

            // Limpiar archivos basura
            await this.cleanupTrashFiles();

            // Ejecutar migración específica con sequelize-cli
            const env = process.env.NODE_ENV === 'production' ? 'NODE_ENV=production' : '';
            const command = `${env} npx sequelize-cli db:migrate --to ${migrationName}`;
            
            const { stdout, stderr } = await execAsync(command, {
                env: process.env,
                cwd: process.cwd(),
                timeout: 60000 // 1 minuto
            });

            logger.info('Migración específica ejecutada', {
                migration: migrationName,
                stdout: stdout,
                stderr: stderr
            });

            // Verificar si la migración ya estaba ejecutada
            const isAlreadyUpToDate = stdout.includes('No migrations were executed, database schema was already up to date');
            const wasExecuted = stdout.includes(`== ${migrationName}: migrated ==`) || stdout.includes('migrated (');
            
            let message;
            if (isAlreadyUpToDate) {
                message = `La migración ${migrationName} ya había sido ejecutada previamente. Base de datos actualizada.`;
            } else if (wasExecuted) {
                message = `Migración ${migrationName} ejecutada exitosamente`;
            } else {
                message = `Comando ejecutado para migración ${migrationName}`;
            }

            return res.status(200).json({
                success: true,
                message: message,
                migrationName,
                output: stdout,
                warnings: stderr || null,
                alreadyExecuted: isAlreadyUpToDate,
                executedAt: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Error ejecutando migración específica', {
                error: error.message,
                user: req.user?.email
            });

            return res.status(500).json({
                success: false,
                message: 'Error ejecutando migración específica',
                error: error.message
            });
        }
    }

    /**
     * ⏪ Rollback de migración específica
     */
    async rollbackSingleMigration(req, res) {
        try {
            console.log('🔧 [DEBUG] Request recibida en rollbackSingleMigration:', {
                body: req.body,
                user: req.user?.email,
                timestamp: new Date().toISOString()
            });
            
            const { migrationName, confirmRollback } = req.body;

            if (!confirmRollback) {
                console.log('🔧 [DEBUG] Error: confirmRollback no está presente');
                return res.status(400).json({
                    success: false,
                    message: 'Confirmación de rollback requerida'
                });
            }

            if (!migrationName) {
                console.log('🔧 [DEBUG] Error: migrationName no está presente');
                return res.status(400).json({
                    success: false,
                    message: 'Nombre de migración requerido'
                });
            }

            logger.info('Haciendo rollback de migración específica', {
                migration: migrationName,
                user: req.user?.email || 'unknown'
            });

            // Limpiar archivos basura
            await this.cleanupTrashFiles();

            // Hacer rollback de migración específica con sequelize-cli
            const env = process.env.NODE_ENV === 'production' ? 'NODE_ENV=production' : '';
            const command = `${env} npx sequelize-cli db:migrate:undo --name ${migrationName}`;
            
            const { stdout, stderr } = await execAsync(command, {
                env: process.env,
                cwd: process.cwd(),
                timeout: 60000 // 1 minuto
            });

            logger.info('Rollback de migración específica ejecutado', {
                migration: migrationName,
                stdout: stdout,
                stderr: stderr
            });

            // Verificar si el rollback fue exitoso
            const wasReverted = stdout.includes(`== ${migrationName}: reverting ==`) || stdout.includes('reverted (');
            
            let message;
            if (wasReverted) {
                message = `Rollback de migración ${migrationName} ejecutado exitosamente`;
            } else {
                message = `Rollback de migración ${migrationName} completado`;
            }

            return res.status(200).json({
                success: true,
                message: message,
                migrationName,
                output: stdout,
                warnings: stderr || null,
                executedAt: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Error haciendo rollback de migración específica', {
                error: error.message,
                user: req.user?.email
            });

            return res.status(500).json({
                success: false,
                message: 'Error haciendo rollback de migración específica',
                error: error.message
            });
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
                    canReset: this.checkResetPermissions(),
                    canManage: process.env.ALLOW_DB_MANAGEMENT === 'true',
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

    /**
     * 🌱 Ejecutar seeder específico
     */
    async runSingleSeeder(req, res) {
        try {
            const { seederName, confirmSeeder } = req.body;

            if (!confirmSeeder) {
                return res.status(400).json({
                    success: false,
                    message: 'Confirmación de seeder requerida'
                });
            }

            if (!seederName) {
                return res.status(400).json({
                    success: false,
                    message: 'Nombre de seeder requerido'
                });
            }

            logger.info('Ejecutando seeder específico', {
                seeder: seederName,
                user: req.user?.email || 'unknown'
            });

            // Limpiar archivos basura
            await this.cleanupTrashFiles();

            // Ejecutar seeder específico con sequelize-cli
            const env = process.env.NODE_ENV === 'production' ? 'NODE_ENV=production' : '';
            const command = `${env} npx sequelize-cli db:seed --seed ${seederName}`;
            
            const { stdout, stderr } = await execAsync(command, {
                env: process.env,
                cwd: process.cwd(),
                timeout: 120000, // 2 minutos
                maxBuffer: 10 * 1024 * 1024 // 10MB buffer para salida grande
            });

            logger.info('Seeder específico ejecutado', {
                seeder: seederName,
                stdout: stdout,
                stderr: stderr
            });

            return res.status(200).json({
                success: true,
                message: `Seeder ${seederName} ejecutado exitosamente`,
                seederName,
                output: stdout,
                warnings: stderr || null,
                executedAt: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Error ejecutando seeder específico', {
                error: error.message,
                user: req.user?.email
            });

            return res.status(500).json({
                success: false,
                message: 'Error ejecutando seeder específico',
                error: error.message
            });
        }
    }

    /**
     * 🌱 Ejecutar seeders
     */
    async runSeeders(req, res) {
        try {
            const { confirmSeeders } = req.body;

            if (!confirmSeeders) {
                return res.status(400).json({
                    success: false,
                    message: 'Confirmación de seeders requerida'
                });
            }

            logger.info('Ejecutando seeders', {
                user: req.user?.email || 'unknown'
            });

            // Limpiar archivos basura antes de ejecutar
            await this.cleanupTrashFiles();

            // Ejecutar seeders con sequelize-cli
            const env = process.env.NODE_ENV === 'production' ? 'NODE_ENV=production' : '';
            const command = `${env} npx sequelize-cli db:seed:all`;
            
            const { stdout, stderr } = await execAsync(command, {
                env: process.env,
                cwd: process.cwd(),
                timeout: 120000, // 2 minutos
                maxBuffer: 10 * 1024 * 1024 // 10MB buffer para salida grande
            });

            logger.info('Seeders ejecutados', {
                stdout: stdout,
                stderr: stderr
            });

            return res.status(200).json({
                success: true,
                message: 'Seeders ejecutados exitosamente',
                output: stdout,
                warnings: stderr || null,
                executedAt: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Error ejecutando seeders', {
                error: error.message,
                user: req.user?.email
            });

            return res.status(500).json({
                success: false,
                message: 'Error ejecutando seeders',
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
export const runSingleMigration = (req, res) => databaseManagementController.runSingleMigration(req, res);
export const rollbackMigration = (req, res) => databaseManagementController.rollbackMigration(req, res);
export const rollbackSingleMigration = (req, res) => databaseManagementController.rollbackSingleMigration(req, res);
export const getDatabaseStatus = (req, res) => databaseManagementController.getDatabaseStatus(req, res);
export const getMigrationsStatus = (req, res) => databaseManagementController.getMigrationsStatus(req, res);
export const getSeedersStatus = (req, res) => databaseManagementController.getSeedersStatus(req, res);
export const runSeeders = (req, res) => databaseManagementController.runSeeders(req, res);
export const runSingleSeeder = (req, res) => databaseManagementController.runSingleSeeder(req, res);