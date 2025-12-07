import express from 'express';
import backupsController from '../controllers/backups.controller.js';
import auth from "../middlewares/auth.js";

const router = express.Router();

/**
 * @route   GET /api/backups
 * @desc    Obtener lista de todos los backups disponibles
 * @access  Private (Admin)
 */
router.get('/', auth.verifyAdmin, backupsController.listBackups.bind(backupsController));

/**
 * @route   GET /api/backups/status
 * @desc    Obtener estado del sistema de backups
 * @access  Private (Admin)
 */
router.get('/status', auth.verifyAdmin, backupsController.getBackupStatus.bind(backupsController));

/**
 * @route   GET /api/backups/download/:filename
 * @desc    Descargar un backup específico
 * @access  Private (Admin)
 */
router.get('/download/:filename', auth.verifyAdmin, backupsController.downloadBackup.bind(backupsController));

/**
 * @route   POST /api/backups/create
 * @desc    Crear un backup manual
 * @access  Private (Admin)
 */
router.post('/create', auth.verifyAdmin, backupsController.createManualBackup.bind(backupsController));

/**
 * @route   POST /api/backups/restore
 * @desc    Restaurar un backup específico
 * @access  Private (Admin)
 */
router.post('/restore', auth.verifyAdmin, backupsController.restoreBackup.bind(backupsController));

/**
 * @route   DELETE /api/backups/:filename
 * @desc    Eliminar un backup específico
 * @access  Private (Admin)
 */
router.delete('/:filename', auth.verifyAdmin, backupsController.deleteBackup.bind(backupsController));

/**
 * @route   POST /api/backups/setup-automatic
 * @desc    Configurar backups automáticos (cron job)
 * @access  Private (Admin)
 */
router.post('/setup-automatic', auth.verifyAdmin, backupsController.setupAutomaticBackups.bind(backupsController));

/**
 * @route   GET /api/backups/logs
 * @desc    Obtener logs de backups automáticos
 * @access  Private (Admin)
 */
router.get('/logs', auth.verifyAdmin, backupsController.getBackupLogs.bind(backupsController));

/**
 * @route   POST /api/backups/cleanup-cron
 * @desc    Limpiar entradas duplicadas del cron
 * @access  Private (Admin)
 */
router.post('/cleanup-cron', auth.verifyAdmin, backupsController.cleanupCronDuplicates.bind(backupsController));

export default router;