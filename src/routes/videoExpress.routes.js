import express from 'express';
import multer from 'multer';
import fs from 'fs';
import * as VideoExpressController from '../controllers/videoExpress.controller.js';
import auth from '../middlewares/auth.js';

/**
 * RUTAS: Product Video Express
 * 
 * Base path: /api/video-express
 * 
 * Endpoints públicos (autenticados):
 * - POST   /jobs             → Crear nuevo job
 * - GET    /jobs             → Listar jobs del usuario
 * - GET    /jobs/:id         → Obtener job específico
 * - DELETE /jobs/:id         → Eliminar job
 * - GET    /stats            → Estadísticas del usuario
 * - GET    /download/:id     → Descargar video
 */

const router = express.Router();

// Configurar multer para uploads de imágenes
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './uploads/video-express';
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'product-' + uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes JPG y PNG'));
        }
    }
});

/**
 * POST /api/video-express/jobs
 * Crear un nuevo job de generación de video
 * 
 * Requiere:
 * - Autenticación (verifyAdmin)
 * - Middleware de upload (multer)
 * 
 * Body (form-data):
 * - product_image: File
 * - animation_style: string
 */
router.post('/jobs', auth.verifyAdmin, upload.single('product_image'), VideoExpressController.createJob);

/**
 * GET /api/video-express/jobs
 * Listar jobs del usuario autenticado
 * 
 * Requiere: Autenticación
 * 
 * Query params:
 * - limit: number (default: 10)
 * - status: string (filter)
 */
router.get('/jobs', auth.verifyAdmin, VideoExpressController.listJobs);

/**
 * GET /api/video-express/jobs/:id
 * Obtener detalles de un job específico
 * 
 * Requiere: Autenticación
 */
router.get('/jobs/:id', auth.verifyAdmin, VideoExpressController.getJob);

/**
 * DELETE /api/video-express/jobs/:id
 * Eliminar un job y sus archivos asociados
 * 
 * Requiere: Autenticación
 */
router.delete('/jobs/:id', auth.verifyAdmin, VideoExpressController.deleteJob);

/**
 * GET /api/video-express/stats
 * Obtener estadísticas de jobs del usuario
 * 
 * Requiere: Autenticación
 */
router.get('/stats', auth.verifyAdmin, VideoExpressController.getStats);

/**
 * GET /api/video-express/download/:id
 * Descargar el video generado
 * 
 * Requiere: Autenticación
 * 
 * Response: Binary file (MP4)
 */
router.get('/download/:id', auth.verifyAdmin, VideoExpressController.downloadVideo);

export default router;
