import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import * as VideoExpressController from '../controllers/videoExpress.controller.js';
import * as VideoExpressService from '../services/videoExpress.service.js';
import { VideoJob } from '../../../models/VideoJob.js';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import * as FalService from '../services/fal.service.js';

/**
 * RUTAS PÚBLICAS: Video Express Preview
 * 
 * Endpoints públicos para el wizard de preview sin autenticación.
 * Integrado con la arquitectura de módulos.
 * 
 * Base path: /api/video-express/preview
 * 
 * Endpoints:
 * - POST   /upload          → Subir imagen temporal
 * - POST   /generate        → Generar video (inicia job)
 * - GET    /status/:jobId   → Verificar estado del job (polling)
 * - GET    /download/:jobId → Descargar video completado
 * - POST   /feedback        → Enviar feedback (opcional)
 */

const router = express.Router();

// ==========================================
// Configuración de multer para uploads
// ==========================================

// Almacenamiento temporal para pasar el imageId al callback
let currentImageId = null;

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './public/uploads/preview/video-express';
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generar imageId único y guardarlo temporalmente
        currentImageId = uuidv4();
        const ext = path.extname(file.originalname);
        // Usar el mismo ID en el filename para poder encontrarlo después
        cb(null, `preview-${currentImageId}${ext}`);
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

// ==========================================
// Rate Limiters
// ==========================================

// Upload: 10 uploads por hora por IP (100 en dev)
const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: process.env.NODE_ENV === 'production' ? 10 : 100, // 🔧 10 en prod, 100 en dev
    message: { 
        success: false, 
        error: 'Demasiadas subidas. Intenta en una hora.' 
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Generate: 5 generaciones por hora por IP (50 en dev)
const generateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 5 : 50, // 🔧 5 en prod, 50 en dev
    message: { 
        success: false, 
        error: 'Demasiadas generaciones. Intenta en una hora.' 
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// ==========================================
// ENDPOINTS
// ==========================================

/**
 * POST /api/video-express/preview/upload
 * Subir imagen temporal para preview
 */
router.post('/upload', uploadLimiter, upload.single('image'), async (req, res) => {
    try {
        const imageFile = req.file;
        
        if (!imageFile) {
            return res.status(400).json({
                success: false,
                error: 'No se proporcionó ninguna imagen'
            });
        }
        
        // Usar el imageId que se generó en el filename
        const imageId = currentImageId;
        
        // La imagen ya está guardada por multer con el formato: preview-${imageId}.ext
        // Devolver info al frontend
        res.json({
            success: true,
            imageId: imageId,
            previewUrl: `/uploads/preview/video-express/${imageFile.filename}`,
            message: 'Imagen subida correctamente'
        });
        
    } catch (error) {
        console.error('❌ Error uploading preview image:', error);
        res.status(500).json({
            success: false,
            error: 'Error al procesar la imagen'
        });
    }
});

/**
 * POST /api/video-express/preview/generate
 * Generar video desde preview (sin autenticación)
 */
router.post('/generate', generateLimiter, async (req, res) => {
    try {
        const { imageId, objective } = req.body;
        
        // Validar parámetros
        if (!imageId || !objective) {
            return res.status(400).json({
                success: false,
                error: 'Faltan parámetros requeridos (imageId, objective)'
            });
        }
        
        if (!['organic', 'ads'].includes(objective)) {
            return res.status(400).json({
                success: false,
                error: 'Objetivo inválido. Usa "organic" o "ads"'
            });
        }
        
        // Buscar la imagen subida (usando el filename que se guardó)
        const previewDir = './public/uploads/preview/video-express';
        const files = fs.readdirSync(previewDir);
        
        // 🔍 Filtrar archivos basura de macOS (._*, .DS_Store, etc)
        const validFiles = files.filter(f => {
            // Ignorar archivos que empiezan con ._ (archivos de recursos de macOS)
            if (f.startsWith('._')) return false;
            // Ignorar archivos ocultos
            if (f.startsWith('.')) return false;
            // Solo archivos que contienen el imageId
            return f.includes(imageId);
        });
        
        if (validFiles.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Imagen no encontrada. Por favor sube una nueva imagen.'
            });
        }
        
        // Usar el primer archivo válido encontrado
        const imageFile = validFiles[0];
        const imagePath = path.join(previewDir, imageFile);
        
        console.log(`📸 Imagen válida encontrada: ${imageFile}`);
        
        // Obtener animation_style desde el request (nuevo campo)
        // Si no viene, usar parallax por defecto según el objetivo
        const animationStyle = req.body.animationStyle || 
                              (objective === 'organic' ? 'parallax' : 'zoom_in');
        
        // Crear job en DB (sin user_id para preview)
        const jobId = uuidv4();
        const job = await VideoJob.create({
            id: jobId,
            product_image_url: imagePath,
            product_image_filename: imageFile,
            animation_style: animationStyle,
            status: 'pending',
            is_preview: true, // Flag importante
            preview_objective: objective,
            ip_address: req.ip || req.connection.remoteAddress
        });
        
        console.log(`✅ Preview job creado: ${jobId} (objective: ${objective})`);
        
        // Procesar job de forma asíncrona
        VideoExpressService.processJob(jobId).catch(error => {
            console.error(`❌ Error procesando preview job ${jobId}:`, error);
        });
        
        res.json({
            success: true,
            jobId: jobId,
            estimatedTime: 45, // segundos
            message: 'Video en proceso de generación'
        });
        
    } catch (error) {
        console.error('❌ Error generating preview video:', error);
        res.status(500).json({
            success: false,
            error: 'Error al iniciar la generación'
        });
    }
});

/**
 * GET /api/video-express/preview/status/:jobId
 * Verificar estado de generación (polling)
 */
router.get('/status/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        
        const job = await VideoJob.findOne({
            where: { 
                id: jobId,
                is_preview: true 
            }
        });
        
        if (!job) {
            console.log(`❌ Job no encontrado: ${jobId}`);
            return res.status(404).json({
                success: false,
                error: 'Job no encontrado'
            });
        }
        
        console.log(`📊 Status check job ${jobId}: status=${job.status}, fal_request_id=${job.fal_request_id}`);
        
        // Processing - Consultar progreso REAL de Fal.ai
        if (job.status === 'pending' || job.status === 'processing') {
            let realProgress = null;
            
            // Si tenemos fal_request_id, consultar progreso real
            if (job.fal_request_id && !job.fal_request_id.startsWith('sim-') && !job.fal_request_id.startsWith('limit-')) {
                try {
                    console.log(`🔍 Consultando progreso real de Fal.ai para: ${job.fal_request_id}`);
                    const falStatus = await FalService.checkJobStatus(job.fal_request_id);
                    
                    // Fal.ai puede devolver progress en el objeto status
                    if (falStatus.progress !== undefined && falStatus.progress !== null) {
                        realProgress = falStatus.progress;
                        console.log(`✅ Progreso real de Fal.ai: ${realProgress}%`);
                    } else {
                        console.log(`⚠️ Fal.ai no devolvió campo 'progress', usando estimación local`);
                    }
                } catch (error) {
                    console.error(`⚠️ Error consultando progreso de Fal.ai:`, error.message);
                    // Continuar con fallback temporal si falla la consulta
                }
            }
            
            // Fallback: estimar progreso basado en tiempo transcurrido solo si Fal.ai no dio progreso
            let progress = realProgress;
            if (progress === null) {
                const elapsed = Date.now() - new Date(job.created_at).getTime();
                const estimatedTotal = 45000; // 45 segundos estimados
                progress = Math.min(85, Math.round((elapsed / estimatedTotal) * 100));
                console.log(`📊 Usando progreso estimado por tiempo: ${progress}%`);
            }
            
            return res.json({
                success: true,
                status: 'processing',
                progress: progress,
                message: realProgress !== null ? 'Generating video...' : 'Generating video... (estimated progress)'
            });
        }
        
        // Completed
        if (job.status === 'completed') {
            console.log(`✅ Job completado`);
            console.log(`   - output_video_url: ${job.output_video_url}`);
            console.log(`   - is_simulated: ${job.is_simulated}`);
            console.log(`   - fal_request_id: ${job.fal_request_id}`);
            
            const protocol = req.protocol;
            const host = req.get('host');
            let videoUrl, downloadUrl;
            
            // 🎯 SOLUCIÓN MÓVILES: Para videos externos (CDN), usar URL directa
            // El navegador se conecta directamente al CDN sin redirects intermedios
            // Esto evita problemas de CORS y "Video format not supported" en móviles
            if (job.output_video_url.startsWith('http://') || job.output_video_url.startsWith('https://')) {
                console.log(`📡 Video externo (CDN): Usando URL directa para reproducción`);
                videoUrl = job.output_video_url; // URL directa del CDN
                downloadUrl = `${protocol}://${host}/api/video-express/preview/download/${jobId}`; // Endpoint para descarga
            } else {
                // Para videos locales, usar endpoint de streaming
                console.log(`📂 Video local: Usando endpoint de streaming`);
                videoUrl = `${protocol}://${host}/api/video-express/preview/download/${jobId}`;
                downloadUrl = videoUrl;
            }
            
            console.log(`🎬 Video URL (para reproducción): ${videoUrl}`);
            console.log(`📦 Download URL (para descarga): ${downloadUrl}`);
            
            return res.json({
                success: true,
                status: 'completed',
                progress: 100, // 🎯 Siempre 100% cuando está completado
                videoUrl: videoUrl,
                thumbnailUrl: null,
                duration: job.duration_seconds || 5,
                fileSize: 0,
                downloadUrl: downloadUrl,
                isSimulated: job.is_simulated || false, // Indica si es video placeholder
                limitReached: job.fal_request_id?.startsWith('limit-') || false
            });
        }
        
        // Failed
        if (job.status === 'failed') {
            console.log(`❌ Job falló: ${job.error_message}`);
            return res.json({
                success: false,
                status: 'failed',
                error: job.error_message || 'Error al generar el video'
            });
        }
        
    } catch (error) {
        console.error('❌ Error checking preview status:', error);
        res.status(500).json({
            success: false,
            error: 'Error al verificar el estado'
        });
    }
});

/**
 * OPTIONS /api/video-express/preview/download/:jobId
 * CORS preflight para video streaming (requerido por móviles)
 */
router.options('/download/:jobId', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    res.sendStatus(204);
});

/**
 * HEAD /api/video-express/preview/download/:jobId
 * Validación de video (iOS Safari requiere esto antes de GET)
 * 🎯 OPTIMIZADO: Para URLs externas, redirect directo (mismo comportamiento que GET)
 */
router.head('/download/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        
        const job = await VideoJob.findOne({
            where: { 
                id: jobId,
                is_preview: true,
                status: 'completed'
            }
        });
        
        if (!job || !job.output_video_url) {
            return res.sendStatus(404);
        }
        
        // 🎯 Para URLs externas, redirect directo (consistente con GET)
        if (job.output_video_url.startsWith('http://') || job.output_video_url.startsWith('https://')) {
            console.log(`🔄 HEAD redirect a URL externa: ${job.output_video_url}`);
            return res.redirect(302, job.output_video_url);
        }
        
        // Si es archivo local
        let videoPath;
        if (job.output_video_url.startsWith('/')) {
            videoPath = path.join('./public', job.output_video_url);
        } else {
            videoPath = job.output_video_url;
        }
        
        if (!fs.existsSync(videoPath)) {
            return res.sendStatus(404);
        }
        
        const stat = fs.statSync(videoPath);
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges, Content-Type');
        res.sendStatus(200);
        
    } catch (error) {
        console.error('❌ Error HEAD request:', error);
        res.sendStatus(500);
    }
});

/**
 * GET /api/video-express/preview/download/:jobId
 * Descargar video generado (con soporte Range para móviles)
 */
router.get('/download/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        console.log(`📥 Petición de descarga para job: ${jobId}`);
        
        const job = await VideoJob.findOne({
            where: { 
                id: jobId,
                is_preview: true,
                status: 'completed'
            }
        });
        
        if (!job) {
            console.log(`❌ Job no encontrado o no completado. JobId: ${jobId}`);
            // Intentar buscar sin filtrar por status para debug
            const jobAny = await VideoJob.findOne({ where: { id: jobId } });
            if (jobAny) {
                console.log(`🔍 Debug: Job existe pero status=${jobAny.status}, is_preview=${jobAny.is_preview}`);
            } else {
                console.log(`🔍 Debug: Job con ID ${jobId} no existe en la DB`);
            }
            
            return res.status(404).json({
                success: false,
                error: 'Video no encontrado o aún no completado'
            });
        }
        
        console.log(`✅ Job encontrado: output_video_url=${job.output_video_url}`);
        
        if (!job.output_video_url) {
            console.log(`❌ Job sin output_video_url`);
            return res.status(404).json({
                success: false,
                error: 'Video no disponible'
            });
        }
        
        // 🎯 SOLUCIÓN MÓVILES: Para URLs externas, redirect directo (sin proxy)
        // Los CDNs externos (fal.ai, etc.) ya manejan Range requests correctamente
        // Evita problemas de chunked encoding y es más eficiente
        if (job.output_video_url.startsWith('http://') || job.output_video_url.startsWith('https://')) {
            console.log(`🔄 Redirigiendo a URL externa (optimizado para móviles): ${job.output_video_url}`);
            
            // Redirect 302 temporal (para poder cambiar la URL si cambia el CDN)
            return res.redirect(302, job.output_video_url);
        }
        
        // Si es un path local, servir el archivo
        let videoPath;
        if (job.output_video_url.startsWith('/')) {
            // Path relativo desde public
            videoPath = path.join('./public', job.output_video_url);
        } else {
            videoPath = job.output_video_url;
        }
        
        console.log(`📂 Buscando archivo en: ${videoPath}`);
        
        if (!fs.existsSync(videoPath)) {
            console.error(`❌ Archivo no encontrado: ${videoPath}`);
            return res.status(404).json({
                success: false,
                error: 'Archivo de video no encontrado en el servidor'
            });
        }
        
        const filename = `product-video-${Date.now()}.mp4`;
        const stat = fs.statSync(videoPath);
        const fileSize = stat.size;
        const range = req.headers.range;
        
        console.log(`📤 Sirviendo archivo: ${filename} (${fileSize} bytes)`);
        
        // 🎯 CRÍTICO: Manejo de Range requests para reproducción en iOS/móviles
        if (range) {
            console.log(`📱 Range request detectado: ${range}`);
            
            // Parsear range header (formato: "bytes=start-end")
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            
            console.log(`📊 Enviando bytes ${start}-${end}/${fileSize}`);
            
            // Headers para Partial Content (206)
            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Content-Length', chunksize);
            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
            res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges, Content-Type');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
            
            // Stream del chunk específico
            const stream = fs.createReadStream(videoPath, { start, end });
            stream.pipe(res);
        } else {
            // Request completo (sin Range) - para descarga o navegadores desktop
            console.log(`💻 Request completo (sin Range)`);
            
            res.status(200);
            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Content-Length', fileSize);
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
            res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges, Content-Type');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
            
            const stream = fs.createReadStream(videoPath);
            stream.pipe(res);
        }
        
    } catch (error) {
        console.error('❌ Error downloading preview video:', error);
        res.status(500).json({
            success: false,
            error: 'Error al descargar el video'
        });
    }
});

/**
 * POST /api/video-express/preview/feedback
 * Enviar feedback sobre el video (opcional)
 */
router.post('/feedback', async (req, res) => {
    try {
        const { jobId, helpful } = req.body;
        
        if (!jobId || typeof helpful !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'Parámetros inválidos'
            });
        }
        
        // Actualizar job con feedback
        await VideoJob.update(
            { 
                preview_feedback: helpful,
                preview_feedback_at: new Date()
            },
            { 
                where: { 
                    id: jobId,
                    is_preview: true
                }
            }
        );
        
        console.log(`📊 Feedback recibido para job ${jobId}: ${helpful ? 'Positivo' : 'Negativo'}`);
        
        res.json({
            success: true,
            message: 'Gracias por tu feedback'
        });
        
    } catch (error) {
        console.error('❌ Error saving feedback:', error);
        // No mostrar error, es opcional
        res.json({
            success: true,
            message: 'Gracias por tu feedback'
        });
    }
});

export default router;
