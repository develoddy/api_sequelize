import * as VideoExpressService from '../services/videoExpress.service.js';
import * as FalService from '../services/fal.service.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Para usar __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * CONTROLLER: Product Video Express
 * 
 * Endpoints:
 * - POST   /api/video-express/jobs          → Crear video job
 * - GET    /api/video-express/jobs          → Listar jobs (con filtros)
 * - GET    /api/video-express/jobs/:id      → Obtener job específico
 * - DELETE /api/video-express/jobs/:id      → Eliminar job
 * - GET    /api/video-express/stats         → Estadísticas del usuario
 */

/**
 * POST /api/video-express/jobs
 * Crea un nuevo job de generación de video
 * 
 * Body (multipart/form-data):
 * - product_image: File (imagen del producto)
 * - animation_style: string ('zoom_in' | 'parallax' | 'subtle_float')
 * 
 * Response:
 * {
 *   status: 201,
 *   message: 'Job creado exitosamente',
 *   data: { job }
 * }
 */
export const createJob = async (req, res) => {
    try {
        console.log('📥 POST /api/video-express/jobs');
        console.log('👤 Usuario autenticado:', req.user?.id, req.user?.email);
        console.log('📁 Archivo recibido:', req.file ? `${req.file.filename} (${req.file.size} bytes)` : 'NO FILE');
        console.log('🎨 Animation style:', req.body.animation_style);

        // Validar autenticación (asumimos que existe middleware de auth)
        // req.user debe existir después del middleware de autenticación
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                status: 401,
                message: 'Usuario no autenticado'
            });
        }

        const userId = req.user.id;

        // Validar que se subió una imagen
        // req.file viene de multer (middleware)
        if (!req.file) {
            return res.status(400).json({
                status: 400,
                message: 'La imagen del producto es requerida',
                hint: 'Envía el archivo con el campo "product_image"'
            });
        }

        const uploadedFile = req.file;
        const imagePath = uploadedFile.path;
        const imageFilename = uploadedFile.originalname;

        // La validación de formato ya se hace en el middleware de multer
        // Pero podemos hacer una validación adicional si queremos

        // Obtener estilo de animación (default: parallax)
        const { animation_style = 'parallax' } = req.body;

        // Validar estilo de animación
        const validStyles = ['zoom_in', 'parallax', 'subtle_float'];
        if (!validStyles.includes(animation_style)) {
            // Eliminar archivo
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
            return res.status(400).json({
                status: 400,
                message: 'Estilo de animación inválido',
                hint: `Valores permitidos: ${validStyles.join(', ')}`
            });
        }

        // Crear job
        console.log(`🎬 Creando video job para usuario ${userId}...`);
        const job = await VideoExpressService.createVideoJob(
            userId,
            imagePath,
            imageFilename,
            animation_style
        );

        console.log('✅ Job creado exitosamente');
        console.log('📊 Job ID:', job.id);
        console.log('📊 Estado final:', job.status);
        console.log('📊 Fal Request ID:', job.fal_request_id || 'PENDIENTE');
        
        if (job.error_message) {
            console.log('⚠️ Error asociado:', job.error_message);
        }

        return res.status(201).json({
            status: 201,
            message: 'Job de video creado exitosamente',
            data: {
                job: {
                    id: job.id,
                    status: job.status,
                    animation_style: job.animation_style,
                    product_image_filename: job.product_image_filename,
                    created_at: job.createdAt
                }
            }
        });

    } catch (error) {
        console.error('❌ Error al crear job:', error);
        console.error('❌ Stack trace:', error.stack);
        console.error('❌ Error completo:', JSON.stringify(error, null, 2));

        return res.status(500).json({
            status: 500,
            message: 'Error al crear el job de video',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor'
        });
    }
};

/**
 * GET /api/video-express/jobs
 * Lista los jobs del usuario autenticado
 * 
 * Query params:
 * - limit: number (default: 10)
 * - status: string (filter por estado)
 * 
 * Response:
 * {
 *   status: 200,
 *   data: { jobs: [...], total: 15 }
 * }
 */
export const listJobs = async (req, res) => {
    try {
        console.log('📥 GET /api/video-express/jobs');

        // Validar autenticación
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                status: 401,
                message: 'Usuario no autenticado'
            });
        }

        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 10;
        const statusFilter = req.query.status; // opcional

        // Obtener jobs
        let jobs = await VideoExpressService.getRecentJobs(userId, limit);

        // Filtrar por estado si se especifica
        if (statusFilter) {
            jobs = jobs.filter(job => job.status === statusFilter);
        }

        // Formatear respuesta
        const formattedJobs = jobs.map(job => ({
            id: job.id,
            status: job.status,
            animation_style: job.animation_style,
            product_image_filename: job.product_image_filename,
            output_video_url: job.output_video_url,
            output_video_filename: job.output_video_filename,
            duration_seconds: job.duration_seconds,
            error_message: job.error_message,
            processing_time_ms: job.processing_time_ms,
            created_at: job.createdAt,
            completed_at: job.completed_at
        }));

        return res.status(200).json({
            status: 200,
            data: {
                jobs: formattedJobs,
                total: formattedJobs.length
            }
        });

    } catch (error) {
        console.error('❌ Error al listar jobs:', error);

        return res.status(500).json({
            status: 500,
            message: 'Error al obtener los jobs',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor'
        });
    }
};

/**
 * GET /api/video-express/jobs/:id
 * Obtiene detalles de un job específico
 * 
 * Response:
 * {
 *   status: 200,
 *   data: { job }
 * }
 */
export const getJob = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📥 GET /api/video-express/jobs/${id}`);

        // Validar autenticación
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                status: 401,
                message: 'Usuario no autenticado'
            });
        }

        const userId = req.user.id;

        // Obtener job
        const job = await VideoExpressService.getJobById(id);

        if (!job) {
            return res.status(404).json({
                status: 404,
                message: 'Job no encontrado'
            });
        }

        // Verificar ownership
        if (job.user_id !== userId) {
            return res.status(403).json({
                status: 403,
                message: 'No tienes permiso para ver este job'
            });
        }

        // Formatear respuesta
        const formattedJob = {
            id: job.id,
            status: job.status,
            animation_style: job.animation_style,
            product_image_filename: job.product_image_filename,
            product_image_url: job.product_image_url,
            output_video_url: job.output_video_url,
            output_video_filename: job.output_video_filename,
            duration_seconds: job.duration_seconds,
            error_message: job.error_message,
            error_code: job.error_code,
            processing_time_ms: job.processing_time_ms,
            fal_processing_time_ms: job.fal_processing_time_ms,
            created_at: job.createdAt,
            updated_at: job.updatedAt,
            completed_at: job.completed_at
        };

        return res.status(200).json({
            status: 200,
            data: { job: formattedJob }
        });

    } catch (error) {
        console.error('❌ Error al obtener job:', error);

        return res.status(500).json({
            status: 500,
            message: 'Error al obtener el job',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor'
        });
    }
};

/**
 * DELETE /api/video-express/jobs/:id
 * Elimina un job (y sus archivos asociados)
 * 
 * Response:
 * {
 *   status: 200,
 *   message: 'Job eliminado exitosamente'
 * }
 */
export const deleteJob = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📥 DELETE /api/video-express/jobs/${id}`);

        // Validar autenticación
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                status: 401,
                message: 'Usuario no autenticado'
            });
        }

        const userId = req.user.id;

        // Eliminar job
        const deleted = await VideoExpressService.deleteJob(id, userId);

        if (!deleted) {
            return res.status(404).json({
                status: 404,
                message: 'Job no encontrado'
            });
        }

        return res.status(200).json({
            status: 200,
            message: 'Job eliminado exitosamente'
        });

    } catch (error) {
        console.error('❌ Error al eliminar job:', error);

        if (error.message.includes('permiso')) {
            return res.status(403).json({
                status: 403,
                message: error.message
            });
        }

        return res.status(500).json({
            status: 500,
            message: 'Error al eliminar el job',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor'
        });
    }
};

/**
 * GET /api/video-express/stats
 * Obtiene estadísticas de jobs del usuario
 * 
 * Response:
 * {
 *   status: 200,
 *   data: {
 *     total: 25,
 *     completed: 20,
 *     failed: 3,
 *     processing: 1,
 *     pending: 1
 *   }
 * }
 */
export const getStats = async (req, res) => {
    try {
        console.log('📥 GET /api/video-express/stats');

        // Validar autenticación
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                status: 401,
                message: 'Usuario no autenticado'
            });
        }

        const userId = req.user.id;

        // Obtener estadísticas
        const stats = await VideoExpressService.getUserStats(userId);

        return res.status(200).json({
            status: 200,
            data: stats
        });

    } catch (error) {
        console.error('❌ Error al obtener estadísticas:', error);

        return res.status(500).json({
            status: 500,
            message: 'Error al obtener estadísticas',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor'
        });
    }
};

/**
 * GET /api/video-express/download/:id
 * Descarga el video generado
 * 
 * Response: Binary file (MP4)
 */
export const downloadVideo = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📥 GET /api/video-express/download/${id}`);

        // Validar autenticación
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                status: 401,
                message: 'Usuario no autenticado'
            });
        }

        const userId = req.user.id;

        // Obtener job
        const job = await VideoExpressService.getJobById(id);

        if (!job) {
            return res.status(404).json({
                status: 404,
                message: 'Job no encontrado'
            });
        }

        // Verificar ownership
        if (job.user_id !== userId) {
            return res.status(403).json({
                status: 403,
                message: 'No tienes permiso para descargar este video'
            });
        }

        // Verificar que el job esté completado
        if (job.status !== 'completed') {
            return res.status(400).json({
                status: 400,
                message: 'El video aún no está disponible',
                hint: `Estado actual: ${job.status}`
            });
        }

        const videoUrl = job.output_video_url;

        // 🎭 MODO SIMULACIÓN: Si es URL externa, hacer redirect
        if (videoUrl && (videoUrl.startsWith('http://') || videoUrl.startsWith('https://'))) {
            console.log(`🎭 SIMULACIÓN: Redirigiendo a video externo: ${videoUrl}`);
            return res.redirect(videoUrl);
        }

        // Modo normal: servir archivo local
        if (!fs.existsSync(videoUrl)) {
            return res.status(404).json({
                status: 404,
                message: 'Archivo de video no encontrado en el servidor'
            });
        }

        // Enviar archivo
        const filename = job.output_video_filename || `video-${job.id}.mp4`;
        res.download(videoUrl, filename, (err) => {
            if (err) {
                console.error('❌ Error al enviar archivo:', err);
                if (!res.headersSent) {
                    res.status(500).json({
                        status: 500,
                        message: 'Error al descargar el video'
                    });
                }
            }
        });

    } catch (error) {
        console.error('❌ Error al descargar video:', error);

        return res.status(500).json({
            status: 500,
            message: 'Error al descargar el video',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor'
        });
    }
};

/**
 * GET /api/video-express/credit-status
 * Obtiene el estado actual del contador de créditos
 * 
 * Response:
 * {
 *   status: 200,
 *   data: {
 *     real_videos_generated: 5,
 *     limit: 25,
 *     remaining: 20,
 *     percentage_used: 20,
 *     can_generate: true,
 *     last_reset: "2026-02-12T10:30:00Z",
 *     history: [...]
 *   }
 * }
 */
export const getCreditStatus = async (req, res) => {
    try {
        console.log('📥 GET /api/video-express/credit-status');

        // Autenticación requerida
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                status: 401,
                message: 'Usuario no autenticado'
            });
        }

        const creditStatus = FalService.getCreditCounterStatus();

        return res.status(200).json({
            status: 200,
            data: creditStatus
        });

    } catch (error) {
        console.error('❌ Error al obtener estado de créditos:', error);

        return res.status(500).json({
            status: 500,
            message: 'Error al obtener estado de créditos',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor'
        });
    }
};

/**
 * POST /api/video-express/credit-reset
 * Resetea el contador de créditos (solo admin)
 * 
 * Response:
 * {
 *   status: 200,
 *   message: 'Contador de créditos reseteado exitosamente',
 *   data: { real_videos_generated: 0, limit: 25, ... }
 * }
 */
export const resetCreditCounter = async (req, res) => {
    try {
        console.log('📥 POST /api/video-express/credit-reset');

        // Autenticación requerida
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                status: 401,
                message: 'Usuario no autenticado'
            });
        }

        // Verificar que el usuario sea admin (ajusta según tu lógica de roles)
        // if (req.user.role !== 'admin') {
        //     return res.status(403).json({
        //         status: 403,
        //         message: 'No tienes permisos para resetear el contador'
        //     });
        // }

        const resetData = FalService.resetCreditCounter();

        console.log('✅ Contador de créditos reseteado por usuario:', req.user.email);

        return res.status(200).json({
            status: 200,
            message: 'Contador de créditos reseteado exitosamente',
            data: resetData
        });

    } catch (error) {
        console.error('❌ Error al resetear contador de créditos:', error);

        return res.status(500).json({
            status: 500,
            message: 'Error al resetear contador de créditos',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor'
        });
    }
};

export default {
    createJob,
    listJobs,
    getJob,
    deleteJob,
    getStats,
    downloadVideo,
    getCreditStatus,
    resetCreditCounter
};
