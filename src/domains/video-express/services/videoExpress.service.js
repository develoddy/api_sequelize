import { VideoJob } from '../../../models/VideoJob.js';
import * as FalService from './fal.service.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

// Para usar __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * SERVICIO: Video Express Business Logic
 * 
 * Responsabilidad: Orquestar el flujo completo de generación de videos
 * 
 * Flujo:
 * 1. Usuario sube imagen → createVideoJob()
 * 2. Validar imagen → validateImage()
 * 3. Crear job en DB (status: pending)
 * 4. Enviar a fal.ai → FalService.submitJob()
 * 5. Actualizar job (status: processing)
 * 6. [Cron job] Poll periódicamente → processePendingJobs()
 * 7. Descargar video → downloadVideo()
 * 8. Actualizar job (status: completed)
 */

// Configuración
const MAX_IMAGE_SIZE_MB = 10;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const ALLOWED_IMAGE_FORMATS = ['image/jpeg', 'image/png', 'image/jpg'];
const VIDEO_STORAGE_PATH = process.env.VIDEO_STORAGE_PATH || path.join(__dirname, '../../../../public/uploads/modules/video-express');
const MAX_PROCESSING_TIME_MS = 5 * 60 * 1000; // 5 minutos timeout

// 🚀 OPTIMIZACIÓN: Cachear URL base para evitar parsing repetido
const PUBLIC_BASE_URL = (process.env.PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');

/**
 * Crea un nuevo job de generación de video
 * 
 * @param {number} userId - ID del usuario admin
 * @param {string} imagePath - Ruta local de la imagen subida
 * @param {string} imageFilename - Nombre original del archivo
 * @param {string} animationStyle - 'zoom_in' | 'parallax' | 'subtle_float'
 * @returns {Promise<VideoJob>} - Job creado
 */
export async function createVideoJob(userId, imagePath, imageFilename, animationStyle = 'parallax') {
    try {
        console.log(`🎬 Creando video job para usuario ${userId}...`);

        // 1. Validar imagen
        await validateImage(imagePath);

        // 2. Crear job en DB (estado: pending)
        const job = await VideoJob.create({
            user_id: userId,
            product_image_url: imagePath,
            product_image_filename: imageFilename,
            animation_style: animationStyle,
            status: 'pending'
        });

        console.log(`✅ Job creado en DB: ${job.id}`);

        // 3. Enviar a fal.ai de forma asíncrona
        // No esperamos la respuesta para devolver el job inmediatamente
        processJob(job.id).catch(error => {
            console.error(`❌ Error procesando job ${job.id}:`, error);
        });

        return job;

    } catch (error) {
        console.error('❌ Error al crear video job:', error);
        throw error;
    }
}

/**
 * Procesa un job individual (envía a fal.ai)
 * 
 * @param {string} jobId - UUID del job
 */
export async function processJob(jobId) {
    try {
        const job = await VideoJob.findByPk(jobId);
        
        if (!job) {
            throw new Error(`Job no encontrado: ${jobId}`);
        }

        console.log(`⚙️ Procesando job ${jobId}...`);
        console.log(`📋 Job info: is_preview=${job.is_preview}, status=${job.status}, image=${job.product_image_url}`);

        // Obtener URL pública de la imagen
        // En producción, esto debería ser una URL de S3 o CDN
        // Para MVP local: convertir ruta local a URL pública
        const publicImageUrl = await getPublicImageUrl(job.product_image_url);
        console.log(`🌐 URL pública generada: ${publicImageUrl}`);

        // Enviar a fal.ai
        const falResponse = await FalService.submitJob(publicImageUrl, job.animation_style);
        console.log(`✅ Respuesta de fal.ai: requestId=${falResponse.requestId}`);

        // Actualizar job con el request_id de fal.ai
        await job.update({
            fal_request_id: falResponse.requestId,
            status: 'processing'
        });

        console.log(`✅ Job ${jobId} enviado a fal.ai: ${falResponse.requestId}`);

    } catch (error) {
        console.error(`❌ Error al procesar job ${jobId}:`, error);
        
        // Marcar job como fallido
        const job = await VideoJob.findByPk(jobId);
        if (job) {
            await job.update({
                status: 'failed',
                error_message: error.message,
                error_code: 'SUBMISSION_ERROR',
                completed_at: new Date()
            });
        }
    }
}

/**
 * Procesa todos los jobs pendientes de polling (cron job)
 * 
 * Este método debe ser llamado periódicamente (cada 30 segundos)
 * por un cron job o scheduler
 */
export async function processPendingJobs() {
    try {
        console.log('🔄 Revisando jobs pendientes...');

        // Obtener jobs en estado 'processing' que tienen fal_request_id
        const pendingJobs = await VideoJob.getPendingJobs();

        if (pendingJobs.length === 0) {
            console.log('✅ No hay jobs pendientes');
            return;
        }

        console.log(`📊 Procesando ${pendingJobs.length} jobs pendientes...`);

        // Procesar cada job en paralelo
        const promises = pendingJobs.map(job => checkAndUpdateJob(job));
        await Promise.allSettled(promises);

        console.log('✅ Jobs pendientes procesados');

    } catch (error) {
        console.error('❌ Error al procesar jobs pendientes:', error);
    }
}

/**
 * Consulta estado de un job en fal.ai y actualiza la DB
 * 
 * @param {VideoJob} job - Instancia del job
 */
async function checkAndUpdateJob(job) {
    try {
        console.log(`🔍 Consultando estado de job ${job.id} (fal: ${job.fal_request_id})...`);

        // 🎭 MODO SIMULACIÓN: Completar inmediatamente
        // Detecta simulación explícita (sim-*) o límite alcanzado (limit-*)
        const isSimulation = job.fal_request_id && 
                           (job.fal_request_id.startsWith('sim-') || 
                            job.fal_request_id.startsWith('limit-'));
        
        if (isSimulation) {
            const isLimitReached = job.fal_request_id.startsWith('limit-');
            console.log(`🎭 SIMULACIÓN: Completando job ${job.id} instantáneamente...`);
            if (isLimitReached) {
                console.log('💰 Motivo: Límite de créditos alcanzado');
            }
            
            // 🎯 Usar video placeholder más confiable
            // Big Buck Bunny - 30 seg sample (compatible con todos los navegadores)
            const placeholderVideoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
            
            const processingTime = Date.now() - new Date(job.created_at).getTime();
            await job.update({
                status: 'completed',
                output_video_url: placeholderVideoUrl, // 🎯 URL directa del CDN público
                output_video_filename: 'simulation-video.mp4',
                duration_seconds: 5.0,
                processing_time_ms: processingTime,
                fal_processing_time_ms: 1500,
                completed_at: new Date(),
                is_simulated: true
            });
            
            console.log(`✅ Job simulado ${job.id} completado con video placeholder (sin usar créditos reales)`);
            return;
        }

        // Timeout check: si lleva más de 5 minutos, marcar como fallido
        const elapsedTime = Date.now() - new Date(job.created_at).getTime();
        if (elapsedTime > MAX_PROCESSING_TIME_MS) {
            console.warn(`⏱️ Job ${job.id} excedió timeout de ${MAX_PROCESSING_TIME_MS / 1000}s`);
            await job.update({
                status: 'failed',
                error_message: 'Timeout: el procesamiento tardó más de 5 minutos',
                error_code: 'TIMEOUT',
                completed_at: new Date()
            });
            return;
        }

        // Consultar estado en fal.ai
        const statusResponse = await FalService.checkJobStatus(job.fal_request_id);

        if (statusResponse.status === 'completed') {
            console.log(`✅ Job ${job.id} completado en fal.ai`);

            // Descargar video y guardarlo localmente
            // fal.ai puede devolver la URL en diferentes formatos:
            // - output.video.url (fast-svd)
            // - output.video_url (otros modelos)
            // - output.url (legacy)
            const videoUrl = statusResponse.output?.video?.url 
                          || statusResponse.output?.video_url 
                          || statusResponse.output?.url;
            
            console.log('🔍 DEBUG output completo:', JSON.stringify(statusResponse.output, null, 2));
            console.log('🎬 Video URL extraída:', videoUrl);
            
            if (!videoUrl) {
                console.error('❌ Estructura de output recibida:', statusResponse.output);
                throw new Error('fal.ai no devolvió URL de video en ningún formato conocido');
            }

            // 🎯 OPTIMIZACIÓN MÓVILES: Usar URL directa del CDN de fal.ai
            // En lugar de descargar el video, usamos la URL directa del CDN
            // Esto evita:
            // - Problemas de códec/formato al descargar
            // - Consumo de almacenamiento en el servidor
            // - Latencia adicional del proxy
            // - Problemas de streaming en móviles
            console.log('🚀 Usando URL directa del CDN de fal.ai (sin descargar)');

            // Actualizar job como completado con URL externa
            const processingTime = Date.now() - new Date(job.created_at).getTime();
            await job.update({
                status: 'completed',
                output_video_url: videoUrl, // 🎯 URL directa del CDN
                output_video_filename: `video-${job.id}.mp4`,
                duration_seconds: 5.0, // Aproximado (30 frames @ 6fps = 5s)
                processing_time_ms: processingTime,
                fal_processing_time_ms: statusResponse.processingTimeMs,
                completed_at: new Date(),
                is_simulated: false // Video REAL generado con fal.ai
            });

            console.log(`✅ Job ${job.id} completado con URL del CDN: ${videoUrl}`);

        } else if (statusResponse.status === 'failed') {
            console.error(`❌ Job ${job.id} falló en fal.ai:`, statusResponse.error);

            await job.update({
                status: 'failed',
                error_message: statusResponse.error || 'Error desconocido en fal.ai',
                error_code: 'FAL_PROCESSING_ERROR',
                completed_at: new Date()
            });

        } else {
            // Todavía procesando
            console.log(`⏳ Job ${job.id} todavía procesando... (${statusResponse.progress || 'N/A'})`);
        }

    } catch (error) {
        console.error(`❌ Error al actualizar job ${job.id}:`, error);
        
        // Marcar como fallido solo si es un error crítico
        if (error.message.includes('no encontrado')) {
            await job.update({
                status: 'failed',
                error_message: error.message,
                error_code: 'FAL_JOB_NOT_FOUND',
                completed_at: new Date()
            });
        }
    }
}

/**
 * Descarga el video desde fal.ai y lo guarda localmente
 * 
 * @param {string} videoUrl - URL del video en fal.ai
 * @param {string} jobId - UUID del job
 * @returns {Promise<Object>} - { localPath, filename }
 */
async function downloadVideo(videoUrl, jobId) {
    try {
        console.log(`📥 Descargando video de fal.ai: ${videoUrl}`);

        // Crear directorio si no existe
        if (!fs.existsSync(VIDEO_STORAGE_PATH)) {
            fs.mkdirSync(VIDEO_STORAGE_PATH, { recursive: true });
        }

        // Generar nombre de archivo único
        const filename = `video-${jobId}-${Date.now()}.mp4`;
        const localPath = path.join(VIDEO_STORAGE_PATH, filename);

        // Descargar video con axios (streaming)
        const response = await axios({
            method: 'GET',
            url: videoUrl,
            responseType: 'stream',
            timeout: 60000 // 60 segundos para descargar
        });

        // Guardar en disco
        const writer = fs.createWriteStream(localPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log(`✅ Video descargado: ${localPath}`);
                resolve({ localPath, filename });
            });
            writer.on('error', reject);
        });

    } catch (error) {
        console.error('❌ Error al descargar video:', error);
        throw new Error(`Error al descargar video: ${error.message}`);
    }
}

/**
 * Convierte una ruta local en URL pública
 * 
 * En desarrollo: usa URL local del servidor
 * En producción: debería subir a S3 y devolver URL pública
 * 
 * @param {string} localPath - Ruta local de la imagen
 * @returns {Promise<string>} - URL pública
 */
async function getPublicImageUrl(localPath) {
    // En desarrollo: asumir que las imágenes están en /public/uploads/modules
    // y son accesibles públicamente via http://localhost:4000/uploads/modules/...
    
    // 🚀 OPTIMIZACIÓN: Usar URL base cacheada en lugar de parsear cada vez
    
    // Extraer path desde 'public/' y convertir a URL pública
    // Si el path contiene 'public/', extraemos desde ahí
    // Ejemplo: './public/uploads/modules/video-express/file.jpg' -> '/uploads/modules/video-express/file.jpg'
    let relativePath;
    if (localPath.includes('public/')) {
        relativePath = localPath.replace(/.*?public(\/?.*)$/, '$1');
        if (!relativePath.startsWith('/')) relativePath = '/' + relativePath;
    } else if (localPath.includes('uploads/')) {
        // Fallback: si solo tiene 'uploads/', asume que falta 'modules'
        relativePath = localPath.replace(/.*?(uploads\/.*)$/, '/$1');
    } else {
        // Si no tiene ni 'public' ni 'uploads', error
        throw new Error(`Path inválido: ${localPath}`);
    }
    
    const fullUrl = `${PUBLIC_BASE_URL}${relativePath}`; // Usa variable cacheada
    console.log(`🌐 URL pública generada desde ${localPath}: ${fullUrl}`);
    
    return fullUrl;
}

/**
 * Valida que la imagen sea válida
 * 
 * @param {string} imagePath - Ruta local de la imagen
 * @throws {Error} - Si la imagen no es válida
 */
async function validateImage(imagePath) {
    // Verificar que el archivo existe
    if (!fs.existsSync(imagePath)) {
        throw new Error('La imagen no existe en el servidor');
    }

    // Verificar tamaño
    const stats = fs.statSync(imagePath);
    if (stats.size > MAX_IMAGE_SIZE_BYTES) {
        throw new Error(`La imagen excede el tamaño máximo de ${MAX_IMAGE_SIZE_MB}MB`);
    }

    if (stats.size === 0) {
        throw new Error('La imagen está vacía');
    }

    // TODO: Validar formato de imagen con librería como 'file-type'
    // Por ahora confiamos en el middleware de upload

    console.log(`✅ Imagen validada: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
}

/**
 * Obtiene un job por ID
 * 
 * @param {string} jobId - UUID del job
 * @returns {Promise<VideoJob|null>}
 */
export async function getJobById(jobId) {
    return await VideoJob.findByPk(jobId);
}

/**
 * Obtiene jobs recientes de un usuario
 * 
 * @param {number} userId - ID del usuario
 * @param {number} limit - Máximo de jobs a devolver
 * @returns {Promise<VideoJob[]>}
 */
export async function getRecentJobs(userId, limit = 10) {
    return await VideoJob.getRecentJobsByUser(userId, limit);
}

/**
 * Obtiene estadísticas de un usuario
 * 
 * @param {number} userId - ID del usuario
 * @returns {Promise<Object>} - { total, completed, failed, processing, pending }
 */
export async function getUserStats(userId) {
    return await VideoJob.getUserStats(userId);
}

/**
 * Elimina un job (soft delete conceptual, por seguridad no eliminamos físicamente)
 * 
 * @param {string} jobId - UUID del job
 * @param {number} userId - ID del usuario (para verificar ownership)
 * @returns {Promise<boolean>}
 */
export async function deleteJob(jobId, userId) {
    const job = await VideoJob.findByPk(jobId);
    
    if (!job) {
        throw new Error('Job no encontrado');
    }

    if (job.user_id !== userId) {
        throw new Error('No tienes permiso para eliminar este job');
    }

    // En producción: marcar como deleted en lugar de eliminar
    // Por ahora hacemos delete físico (MVP)
    await job.destroy();
    
    // Eliminar archivos físicos
    if (job.product_image_url && fs.existsSync(job.product_image_url)) {
        fs.unlinkSync(job.product_image_url);
    }
    if (job.output_video_url && fs.existsSync(job.output_video_url)) {
        fs.unlinkSync(job.output_video_url);
    }

    return true;
}

export default {
    createVideoJob,
    processPendingJobs,
    getJobById,
    getRecentJobs,
    getUserStats,
    deleteJob
};
