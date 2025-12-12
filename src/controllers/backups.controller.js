import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger, sanitize } from '../utils/logger.js';

const execAsync = promisify(exec);

export class BackupsController {
    
    /**
     * Obtiene la lista de todos los backups disponibles
     */
    async listBackups(req, res) {
        try {
            const backupsDir = path.join(process.cwd(), 'backups', 'mysql');
            
            // Verificar que el directorio existe
            if (!fs.existsSync(backupsDir)) {
                logger.warn('Directorio de backups no existe', { dir: backupsDir });
                return res.status(200).json({
                    success: true,
                    message: 'Directorio de backups no encontrado',
                    backups: []
                });
            }

            // Leer archivos del directorio
            const files = fs.readdirSync(backupsDir);
            
            // Filtrar solo archivos .sql.gz y excluir archivos basura de macOS
            const backups = files
                .filter(file => file.endsWith('.sql.gz') && !file.startsWith('._'))
                .map(file => {
                    const filePath = path.join(backupsDir, file);
                    const stats = fs.statSync(filePath);
                    
                    // Extraer fecha del nombre del archivo (formato: ecommercedb_backup_YYYY-MM-DD_HH-MM-SS.sql.gz)
                    const dateMatch = file.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/);
                    const backupDate = dateMatch ? dateMatch[1] : null;
                    
                    return {
                        filename: file,
                        size: stats.size,
                        sizeFormatted: this.formatFileSize(stats.size),
                        createdAt: stats.birthtime,
                        modifiedAt: stats.mtime,
                        backupDate: backupDate,
                        path: filePath
                    };
                })
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Ordenar por fecha descendente

            logger.info(`Listando ${backups.length} backups disponibles`);

            return res.status(200).json({
                success: true,
                message: `${backups.length} backups encontrados`,
                backups: backups,
                totalBackups: backups.length,
                totalSize: backups.reduce((acc, backup) => acc + backup.size, 0),
                directory: backupsDir
            });

        } catch (error) {
            logger.error('Error al listar backups', { 
                error: error.message,
                stack: error.stack 
            });
            
            return res.status(500).json({
                success: false,
                message: 'Error interno del servidor al listar backups',
                error: error.message
            });
        }
    }

    /**
     * Descarga un backup específico
     */
    async downloadBackup(req, res) {
        try {
            const { filename } = req.params;
            
            // Validar el nombre del archivo por seguridad
            if (!filename || !filename.endsWith('.sql.gz')) {
                return res.status(400).json({
                    success: false,
                    message: 'Nombre de archivo inválido'
                });
            }

            // Construir ruta del archivo
            const backupsDir = path.join(process.cwd(), 'backups', 'mysql');
            const filePath = path.join(backupsDir, filename);

            // Verificar que el archivo existe
            if (!fs.existsSync(filePath)) {
                logger.warn('Archivo de backup no encontrado', { filename, path: filePath });
                return res.status(404).json({
                    success: false,
                    message: 'Archivo de backup no encontrado'
                });
            }

            // Obtener estadísticas del archivo
            const stats = fs.statSync(filePath);

            logger.info('Descargando backup', { 
                filename, 
                size: stats.size,
                user: req.user?.email || 'unknown' 
            });

            // Configurar headers para descarga
            res.setHeader('Content-Type', 'application/gzip');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', stats.size);

            // Stream del archivo
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);

            fileStream.on('error', (error) => {
                logger.error('Error al transmitir archivo', { error: error.message, filename });
                if (!res.headersSent) {
                    res.status(500).json({
                        success: false,
                        message: 'Error al descargar el archivo'
                    });
                }
            });

        } catch (error) {
            logger.error('Error al descargar backup', { 
                error: error.message,
                filename: req.params.filename 
            });
            
            if (!res.headersSent) {
                return res.status(500).json({
                    success: false,
                    message: 'Error interno del servidor al descargar backup',
                    error: error.message
                });
            }
        }
    }

    /**
     * Restaura un backup específico
     */
    async restoreBackup(req, res) {
        try {
            const { filename, confirmRestore } = req.body;

            // Validación de confirmación
            if (!confirmRestore) {
                return res.status(400).json({
                    success: false,
                    message: 'Confirmación de restauración requerida'
                });
            }

            // Validar el nombre del archivo
            if (!filename || !filename.endsWith('.sql.gz')) {
                return res.status(400).json({
                    success: false,
                    message: 'Nombre de archivo inválido'
                });
            }

            // Verificar que el archivo existe
            const backupsDir = path.join(process.cwd(), 'backups', 'mysql');
            const filePath = path.join(backupsDir, filename);

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({
                    success: false,
                    message: 'Archivo de backup no encontrado'
                });
            }

            // Configuración de la base de datos desde variables de entorno
            const dbConfig = {
                host: process.env.DB_HOST || 'localhost',
                port: process.env.DB_PORT || '3306',
                database: process.env.DB_NAME || 'ecommercedb',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || ''
            };

            // Forzar TCP/IP en lugar de socket local para MySQL
            if (dbConfig.host === 'localhost') {
                dbConfig.host = '127.0.0.1';
                logger.info('Cambiando localhost por 127.0.0.1 para forzar TCP/IP');
            }

            // Para XAMPP, verificar si está usando puerto estándar
            if (process.env.NODE_ENV === 'development' && fs.existsSync('/Applications/XAMPP/xamppfiles/bin/mysql')) {
                // XAMPP a veces usa puerto 3306 o 3307
                logger.info('Detectado entorno XAMPP, usando configuración optimizada');
                
                // Si el puerto es 3306 pero XAMPP no responde, intentar puerto alternativo
                if (dbConfig.port === '3306') {
                    logger.info('Intentando conexión XAMPP en puerto 3306');
                }
            }

            logger.info('Iniciando restauración de backup', { 
                filename, 
                database: dbConfig.database,
                user: req.user?.email || 'unknown' 
            });

            // Detectar MySQL de XAMPP o sistema
            let mysqlPath = 'mysql';
            if (fs.existsSync('/Applications/XAMPP/xamppfiles/bin/mysql')) {
                mysqlPath = '/Applications/XAMPP/xamppfiles/bin/mysql';
                logger.info('Detectado MySQL de XAMPP');
            } else {
                logger.info('Usando MySQL del sistema');
            }
            
            // Construir comando MySQL para restauración
            let mysqlCommand = `${mysqlPath} --protocol=TCP -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.user}`;
            
            // Solo agregar contraseña si existe y no está vacía
            if (dbConfig.password && dbConfig.password.trim() !== '') {
                mysqlCommand += ` -p${dbConfig.password}`;
                logger.info('Usando autenticación con contraseña para restauración');
            } else {
                logger.info('Usando autenticación sin contraseña para restauración');
            }
            
            mysqlCommand += ` ${dbConfig.database}`;
            
            logger.info('Ejecutando comando de restauración', { 
                host: dbConfig.host,
                port: dbConfig.port,
                database: dbConfig.database,
                user: dbConfig.user,
                hasPassword: !!dbConfig.password,
                mysqlPath: mysqlPath
            });

            // Método alternativo: descomprimir primero, luego restaurar
            const tempSqlFile = filePath.replace('.gz', '.temp');
            
            try {
                // Paso 1: Descomprimir archivo
                logger.info('Descomprimiendo archivo de backup...');
                await execAsync(`gunzip -c "${filePath}" > "${tempSqlFile}"`, {
                    timeout: 60000
                });

                // Paso 2: Verificar que el archivo temporal se creó
                if (!fs.existsSync(tempSqlFile)) {
                    throw new Error('No se pudo descomprimir el archivo de backup');
                }

                // Paso 3: Restaurar desde archivo temporal
                logger.info('Ejecutando restauración desde archivo temporal...');
                const { stdout, stderr } = await execAsync(`${mysqlCommand} < "${tempSqlFile}"`, {
                    timeout: 300000, // 5 minutos de timeout
                    env: { ...process.env }
                });

                // Verificar errores de la restauración
                if (stderr && !stderr.includes('Warning')) {
                    // En desarrollo, ignorar ciertos errores conocidos de compatibilidad
                    const isDevelopment = process.env.NODE_ENV === 'development';
                    const isCompatibilityError = stderr.includes('mysql_upgrade') || 
                                               stderr.includes('Column count') || 
                                               stderr.includes('MariaDB');
                    
                    if (isDevelopment && isCompatibilityError) {
                        logger.warn('Error de compatibilidad MySQL/MariaDB ignorado en desarrollo durante restauración', { 
                            stderr,
                            filename,
                            user: req.user?.email || 'unknown' 
                        });
                    } else {
                        throw new Error(`Error en restauración: ${stderr}`);
                    }
                }

                // Limpiar archivo temporal
                if (fs.existsSync(tempSqlFile)) {
                    fs.unlinkSync(tempSqlFile);
                    logger.info('Archivo temporal eliminado');
                }

                logger.info('Backup restaurado exitosamente', { 
                    filename, 
                    database: dbConfig.database,
                    output: stdout || 'Restauración completada' 
                });

            } catch (tempError) {
                // Limpiar archivo temporal en caso de error
                if (fs.existsSync(tempSqlFile)) {
                    fs.unlinkSync(tempSqlFile);
                    logger.info('Archivo temporal eliminado después de error');
                }
                throw tempError;
            }

            return res.status(200).json({
                success: true,
                message: `Backup ${filename} restaurado exitosamente`,
                filename,
                database: dbConfig.database,
                restoredAt: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Error al restaurar backup', { 
                error: error.message,
                filename: req.body.filename,
                stack: error.stack 
            });
            
            return res.status(500).json({
                success: false,
                message: 'Error interno del servidor al restaurar backup',
                error: error.message,
                details: 'Verifique las credenciales de la base de datos y la integridad del archivo'
            });
        }
    }

    /**
     * Obtiene el estado del sistema de backups
     */
    async getBackupStatus(req, res) {
        try {
            const backupsDir = path.join(process.cwd(), 'backups', 'mysql');
            const scriptPath = path.join(process.cwd(), 'scripts', 'backup-database.sh');

            // Verificar directorio de backups
            const dirExists = fs.existsSync(backupsDir);
            
            // Verificar script de backup
            const scriptExists = fs.existsSync(scriptPath);

            // Obtener último backup
            let lastBackup = null;
            if (dirExists) {
                const files = fs.readdirSync(backupsDir)
                    .filter(file => file.endsWith('.sql.gz') && !file.startsWith('._'))
                    .map(file => {
                        const filePath = path.join(backupsDir, file);
                        const stats = fs.statSync(filePath);
                        return { filename: file, createdAt: stats.birthtime };
                    })
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                lastBackup = files.length > 0 ? files[0] : null;
            }

            // Verificar si el cron está configurado y obtener detalles
            let cronConfigured = false;
            let cronSchedule = null;
            let nextExecution = null;
            let cronEntriesCount = 0;
            let hasDuplicates = false;
            
            try {
                const { stdout } = await execAsync('crontab -l 2>/dev/null | grep backup-database');
                if (stdout && stdout.trim()) {
                    const cronLines = stdout.trim().split('\n').filter(line => line.trim());
                    cronEntriesCount = cronLines.length;
                    
                    if (cronEntriesCount > 0) {
                        cronConfigured = true;
                        hasDuplicates = cronEntriesCount > 1;
                        
                        // Usar la primera línea para extraer información
                        const fullCronLine = cronLines[0];
                        
                        // Extraer solo la parte del horario del cron (primeras 5 partes)
                        const cronParts = fullCronLine.split(' ');
                        if (cronParts.length >= 5) {
                            const minute = cronParts[0];
                            const hour = cronParts[1];
                            const day = cronParts[2];
                            const month = cronParts[3];
                            const dayOfWeek = cronParts[4];
                            
                            // Mostrar solo la expresión cron limpia, no el comando completo
                            cronSchedule = `${minute} ${hour} ${day} ${month} ${dayOfWeek}`;
                            
                            if (day === '*' && month === '*' && dayOfWeek === '*') {
                                nextExecution = `Diario a las ${hour}:${minute.padStart(2, '0')}`;
                            } else {
                                nextExecution = `Según horario: ${minute} ${hour} ${day} ${month} ${dayOfWeek}`;
                            }
                        }
                    }
                }
            } catch (error) {
                cronConfigured = false;
                logger.warning('Error verificando cron job', { error: error.message });
            }

            return res.status(200).json({
                success: true,
                status: {
                    backupsDirectoryExists: dirExists,
                    backupScriptExists: scriptExists,
                    cronConfigured: cronConfigured,
                    cronSchedule: cronSchedule,
                    nextExecution: nextExecution,
                    lastBackup: lastBackup,
                    backupsDirectory: backupsDir,
                    scriptPath: scriptPath,
                    cronEntriesCount: cronEntriesCount,
                    hasDuplicates: hasDuplicates,
                    needsCleanup: hasDuplicates
                }
            });

        } catch (error) {
            logger.error('Error al obtener estado de backups', { error: error.message });
            
            return res.status(500).json({
                success: false,
                message: 'Error al obtener estado del sistema de backups',
                error: error.message
            });
        }
    }

    /**
     * Crear un backup manual
     */
    async createManualBackup(req, res) {
        try {
            const scriptPath = path.join(process.cwd(), 'scripts', 'backup-database.sh');

            // Verificar que el script existe
            if (!fs.existsSync(scriptPath)) {
                return res.status(404).json({
                    success: false,
                    message: 'Script de backup no encontrado'
                });
            }

            logger.info('Iniciando backup manual', { 
                user: req.user?.email || 'unknown' 
            });

            // Ejecutar script de backup con variables de entorno correctas
            const nodeEnv = process.env.NODE_ENV || 'development';
            
            // Construir comando con todas las variables necesarias
            const envVars = {
                ...process.env,
                NODE_ENV: nodeEnv,
                DB_NAME: process.env.DB_NAME,
                DB_USER: process.env.DB_USER,
                DB_PASSWORD: process.env.DB_PASSWORD,
                DB_HOST: process.env.DB_HOST,
                DB_PORT: process.env.DB_PORT || '3306',
                DB_DIALECT: process.env.DB_DIALECT || 'mysql'
            };
            
            logger.info('Ejecutando script de backup', {
                nodeEnv,
                dbHost: process.env.DB_HOST,
                dbName: process.env.DB_NAME,
                dbUser: process.env.DB_USER,
                hasPassword: !!process.env.DB_PASSWORD
            });
            
            const { stdout, stderr } = await execAsync(`bash "${scriptPath}"`, {
                timeout: 300000, // 5 minutos de timeout
                env: envVars,
                cwd: process.cwd()
            });

            if (stderr && !stderr.includes('Warning')) {
                // En desarrollo, ignorar ciertos errores conocidos de compatibilidad
                const isDevelopment = process.env.NODE_ENV === 'development';
                const isCompatibilityError = stderr.includes('mysql_upgrade') || 
                                           stderr.includes('Column count') || 
                                           stderr.includes('MariaDB');
                
                if (isDevelopment && isCompatibilityError) {
                    logger.warn('Error de compatibilidad MySQL/MariaDB ignorado en desarrollo', { 
                        stderr,
                        user: req.user?.email || 'unknown' 
                    });
                } else {
                    throw new Error(`Error en backup: ${stderr}`);
                }
            }

            logger.info('Backup manual completado', { output: stdout });

            return res.status(200).json({
                success: true,
                message: 'Backup manual creado exitosamente',
                output: stdout,
                createdAt: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Error al crear backup manual', { 
                error: error.message,
                stack: error.stack 
            });
            
            return res.status(500).json({
                success: false,
                message: 'Error al crear backup manual',
                error: error.message
            });
        }
    }

    /**
     * Configurar backups automáticos (cron job)
     */
    async setupAutomaticBackups(req, res) {
        try {
            logger.info('Iniciando configuración de backups automáticos', { 
                user: req.user?.email || 'unknown' 
            });

            const backupScriptPath = path.join(process.cwd(), 'scripts', 'backup-database.sh');
            const logsDir = path.join(process.cwd(), 'backups', 'logs');
            const cronLogFile = path.join(logsDir, 'cron-backup.log');

            // Verificar que el script de backup existe
            if (!fs.existsSync(backupScriptPath)) {
                return res.status(404).json({
                    success: false,
                    message: 'Script de backup no encontrado',
                    path: backupScriptPath,
                    details: 'Ejecute primero la configuración inicial del sistema'
                });
            }

            // Crear directorios necesarios si no existen
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir, { recursive: true });
                logger.info('Directorio de logs creado', { path: logsDir });
            }

            // Verificar si ya existe una configuración de cron para este proyecto
            let currentCron = '';
            try {
                const { stdout } = await execAsync('crontab -l 2>/dev/null || echo ""');
                currentCron = stdout;
            } catch (error) {
                // Si no hay crontab, es normal, continuamos
                logger.info('No existe crontab previo, creando nuevo');
            }

            // Buscar y eliminar entradas duplicadas existentes
            const cronLines = currentCron.split('\n').filter(line => line.trim());
            const cleanedLines = cronLines.filter(line => 
                !line.includes('backup-database.sh') && 
                !line.includes(backupScriptPath) &&
                line.trim() !== ''
            );

            // Crear nueva entrada de cron con variables de entorno
            const cronSchedule = '0 2 * * *'; // Diario a las 2:00 AM
            const nodeEnv = process.env.NODE_ENV || 'production';
            const cronEntry = `${cronSchedule} cd "${process.cwd()}" && NODE_ENV=${nodeEnv} /bin/bash "${backupScriptPath}" >> "${cronLogFile}" 2>&1`;
            
            // Agregar la nueva entrada
            cleanedLines.push(cronEntry);

            // Escribir el crontab limpio con la nueva configuración
            const newCronContent = cleanedLines.join('\n') + '\n';
            
            // Escribir archivo temporal y aplicarlo
            const tempCronFile = '/tmp/backup_crontab_temp';
            fs.writeFileSync(tempCronFile, newCronContent);
            
            await execAsync(`crontab "${tempCronFile}"`);
            fs.unlinkSync(tempCronFile);

            // Verificar que se aplicó correctamente
            const { stdout: verifyOutput } = await execAsync('crontab -l 2>/dev/null | grep "backup-database.sh" | wc -l');
            const cronCount = parseInt(verifyOutput.trim());

            if (cronCount !== 1) {
                logger.warning(`Se detectaron ${cronCount} entradas de cron para backup-database.sh`);
            }

            // Crear archivo de log inicial si no existe
            if (!fs.existsSync(cronLogFile)) {
                const initialLogContent = `[${new Date().toISOString()}] [INFO] Sistema de backups configurado desde Admin Dashboard\n`;
                fs.writeFileSync(cronLogFile, initialLogContent);
            }

            logger.info('Backups automáticos configurados exitosamente', { 
                cronSchedule,
                cronCount,
                user: req.user?.email || 'unknown' 
            });

            return res.status(200).json({
                success: true,
                message: 'Backups automáticos configurados exitosamente',
                details: {
                    schedule: 'Diario a las 2:00 AM',
                    cronExpression: cronSchedule,
                    logFile: cronLogFile,
                    cronEntriesCount: cronCount,
                    cleanupPerformed: cronCount === 1
                },
                configuredAt: new Date().toISOString(),
                nextExecution: this.calculateNextExecution(cronSchedule)
            });

        } catch (error) {
            logger.error('Error al configurar backups automáticos', { 
                error: error.message,
                stack: error.stack,
                user: req.user?.email || 'unknown' 
            });
            
            return res.status(500).json({
                success: false,
                message: 'Error al configurar backups automáticos',
                error: error.message,
                details: 'Verifique que el sistema tenga permisos para configurar cron jobs'
            });
        }
    }

    /**
     * Calcular próxima ejecución del cron
     */
    calculateNextExecution(cronExpression) {
        try {
            // Para "0 2 * * *" (diario a las 2:00 AM)
            const now = new Date();
            const nextExecution = new Date();
            
            nextExecution.setHours(2, 0, 0, 0);
            
            // Si ya pasaron las 2:00 AM hoy, programar para mañana
            if (now.getHours() >= 2) {
                nextExecution.setDate(nextExecution.getDate() + 1);
            }
            
            return nextExecution.toISOString();
        } catch (error) {
            return null;
        }
    }

    /**
     * Limpiar entradas duplicadas del cron
     */
    async cleanupCronDuplicates(req, res) {
        try {
            logger.info('Iniciando limpieza de cron duplicados', { 
                user: req.user?.email || 'unknown' 
            });

            // Obtener configuración actual del cron
            let currentCron = '';
            let cronEntriesCount = 0;
            
            try {
                const { stdout } = await execAsync('crontab -l 2>/dev/null || echo ""');
                currentCron = stdout;
                
                // Contar entradas relacionadas con backup
                const { stdout: backupEntries } = await execAsync('crontab -l 2>/dev/null | grep backup-database || echo ""');
                if (backupEntries.trim()) {
                    cronEntriesCount = backupEntries.trim().split('\n').filter(line => line.trim()).length;
                }
            } catch (error) {
                logger.info('No existe crontab previo');
            }

            if (cronEntriesCount <= 1) {
                return res.status(200).json({
                    success: true,
                    message: 'No hay duplicados para limpiar',
                    details: {
                        entriesFound: cronEntriesCount,
                        action: 'none_needed'
                    }
                });
            }

            // Limpiar duplicados
            const cronLines = currentCron.split('\n').filter(line => line.trim());
            const cleanedLines = [];
            let backupEntryFound = false;

            // Filtrar líneas, manteniendo solo una entrada de backup
            for (const line of cronLines) {
                if (line.includes('backup-database.sh')) {
                    if (!backupEntryFound) {
                        cleanedLines.push(line);
                        backupEntryFound = true;
                    }
                    // Ignorar entradas duplicadas
                } else if (line.trim()) {
                    cleanedLines.push(line);
                }
            }

            // Escribir crontab limpio
            const newCronContent = cleanedLines.join('\n') + (cleanedLines.length > 0 ? '\n' : '');
            
            const tempCronFile = '/tmp/backup_crontab_cleanup';
            fs.writeFileSync(tempCronFile, newCronContent);
            
            await execAsync(`crontab "${tempCronFile}"`);
            fs.unlinkSync(tempCronFile);

            // Verificar resultado
            const { stdout: verifyOutput } = await execAsync('crontab -l 2>/dev/null | grep "backup-database.sh" | wc -l');
            const finalCount = parseInt(verifyOutput.trim());

            logger.info('Limpieza de cron completada', { 
                entriesBefore: cronEntriesCount,
                entriesAfter: finalCount,
                user: req.user?.email || 'unknown' 
            });

            return res.status(200).json({
                success: true,
                message: 'Duplicados eliminados exitosamente',
                details: {
                    entriesBefore: cronEntriesCount,
                    entriesAfter: finalCount,
                    duplicatesRemoved: cronEntriesCount - finalCount,
                    action: 'cleanup_completed'
                },
                cleanedAt: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Error al limpiar duplicados de cron', { 
                error: error.message,
                stack: error.stack,
                user: req.user?.email || 'unknown' 
            });
            
            return res.status(500).json({
                success: false,
                message: 'Error al limpiar duplicados de cron',
                error: error.message
            });
        }
    }

    /**
     * Verificar logs de backups automáticos
     */
    async getBackupLogs(req, res) {
        try {
            const { lines = 50 } = req.query;
            const logsDir = path.join(process.cwd(), 'backups', 'logs');
            const logFile = path.join(logsDir, 'cron-backup.log');

            if (!fs.existsSync(logFile)) {
                return res.status(200).json({
                    success: true,
                    message: 'Archivo de logs no encontrado (aún no se han ejecutado backups automáticos)',
                    logs: [],
                    logFile: logFile
                });
            }

            // Leer las últimas líneas del log
            const command = `tail -n ${lines} "${logFile}"`;
            const { stdout } = await execAsync(command);

            const logLines = stdout.split('\n').filter(line => line.trim());

            return res.status(200).json({
                success: true,
                message: `Últimas ${logLines.length} líneas del log de backups`,
                logs: logLines,
                logFile: logFile,
                totalLines: logLines.length
            });

        } catch (error) {
            logger.error('Error al obtener logs de backup', { 
                error: error.message 
            });
            
            return res.status(500).json({
                success: false,
                message: 'Error al obtener logs de backup',
                error: error.message
            });
        }
    }

    /**
     * Eliminar un backup específico
     */
    async deleteBackup(req, res) {
        try {
            const { filename } = req.params;
            const { confirmDelete } = req.body;

            // Validación de confirmación
            if (!confirmDelete) {
                return res.status(400).json({
                    success: false,
                    message: 'Confirmación de eliminación requerida'
                });
            }

            // Validar el nombre del archivo
            if (!filename || !filename.endsWith('.sql.gz')) {
                return res.status(400).json({
                    success: false,
                    message: 'Nombre de archivo inválido'
                });
            }

            const backupsDir = path.join(process.cwd(), 'backups', 'mysql');
            const filePath = path.join(backupsDir, filename);

            // Verificar que el archivo existe
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({
                    success: false,
                    message: 'Archivo de backup no encontrado'
                });
            }

            // Eliminar archivo
            fs.unlinkSync(filePath);

            logger.info('Backup eliminado', { 
                filename, 
                user: req.user?.email || 'unknown' 
            });

            return res.status(200).json({
                success: true,
                message: `Backup ${filename} eliminado exitosamente`,
                filename,
                deletedAt: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Error al eliminar backup', { 
                error: error.message,
                filename: req.params.filename 
            });
            
            return res.status(500).json({
                success: false,
                message: 'Error al eliminar backup',
                error: error.message
            });
        }
    }

    /**
     * Formatea el tamaño del archivo en formato legible
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Crear instancia del controlador
const backupsController = new BackupsController();

export default backupsController;