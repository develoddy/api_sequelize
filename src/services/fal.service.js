import axios from 'axios';

/**
 * SERVICIO: Integración con fal.ai
 * 
 * Responsabilidad: Comunicación directa con la API de fal.ai
 * 
 * Métodos:
 * - submitJob(): Envía imagen a fal.ai para generar video
 * - checkJobStatus(): Consulta estado del job (para polling)
 * - cancelJob(): Cancela un job en progreso (opcional)
 * 
 * IMPORTANTE: Este servicio NO conoce el modelo VideoJob ni la DB.
 * Solo habla con fal.ai y devuelve respuestas.
 */

// Configuración de la API
const FAL_API_KEY = process.env.FAL_API_KEY;
const FAL_API_BASE_URL = 'https://fal.run';

// Modelo recomendado para image-to-video estable
// Alternativas: 'fal-ai/stable-video-diffusion', 'fal-ai/fast-animatediff-turbo'
const FAL_MODEL = process.env.FAL_MODEL || 'fal-ai/fast-animatediff-turbo';

// Timeout para requests (30 segundos)
const REQUEST_TIMEOUT = 30000;

/**
 * Prompts dinámicos según el estilo de animación
 */
const ANIMATION_PROMPTS = {
    zoom_in: {
        prompt: `Cinematic product video. Slow dolly zoom towards product. 
        Cinema lens effect. Product stays perfectly centered and still. 
        Luxury e-commerce aesthetic. Soft studio lighting. 
        No deformation, no morphing, no added objects. Clean background.`,
        motion_strength: 0.35
    },
    parallax: {
        prompt: `Cinematic product video. 2.5D parallax effect. 
        Layers separate softly creating depth illusion. 
        Product stays centered and perfectly still. 
        Luxury e-commerce aesthetic. Soft studio lighting. 
        No deformation, no morphing, no added objects. Clean background.`,
        motion_strength: 0.40
    },
    subtle_float: {
        prompt: `Cinematic product video. Product gently levitates. 
        Soft breathing motion. Zero gravity effect. 
        Product stays perfectly still without deformation. 
        Luxury e-commerce aesthetic. Soft studio lighting. 
        No morphing, no added objects. Clean background.`,
        motion_strength: 0.30
    }
};

/**
 * Negative prompt universal (evita deformaciones)
 */
const NEGATIVE_PROMPT = `Deformation, warping, distortion, morphing, hallucination, 
artifacts, blurry, low quality, extra objects, text, watermark, 
animation that changes product shape, product moving or rotating unnaturally, 
multiple products, duplicate items`;

/**
 * Cliente axios configurado para fal.ai
 */
const falClient = axios.create({
    baseURL: FAL_API_BASE_URL,
    timeout: REQUEST_TIMEOUT,
    headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json'
    }
});

/**
 * Verifica que la API key esté configurada
 */
function validateApiKey() {
    if (!FAL_API_KEY) {
        throw new Error('FAL_API_KEY no está configurada en las variables de entorno');
    }
}

/**
 * Envía un job a fal.ai para generar video desde imagen
 * 
 * @param {string} imageUrl - URL pública de la imagen del producto
 * @param {string} animationStyle - 'zoom_in' | 'parallax' | 'subtle_float'
 * @returns {Promise<Object>} - { requestId, status }
 */
export async function submitJob(imageUrl, animationStyle = 'parallax') {
    validateApiKey();

    // Validar que el estilo de animación sea válido
    if (!ANIMATION_PROMPTS[animationStyle]) {
        throw new Error(`Estilo de animación inválido: ${animationStyle}`);
    }

    const styleConfig = ANIMATION_PROMPTS[animationStyle];

    try {
        // Payload para fal.ai
        const payload = {
            // Imagen de entrada
            image_url: imageUrl,

            // Prompt dinámico según estilo
            prompt: styleConfig.prompt,
            negative_prompt: NEGATIVE_PROMPT,

            // Parámetros de generación (críticos para estabilidad)
            motion_strength: styleConfig.motion_strength, // 0.3-0.4 = movimiento sutil
            num_frames: 30,           // 5 segundos @ 6fps
            fps: 6,                   // frame rate (óptimo para redes sociales)
            guidance_scale: 15,       // adherencia fuerte a imagen original
            num_inference_steps: 20,  // balance velocidad/calidad

            // Output
            output_format: 'mp4',
            output_quality: 'high',

            // Semilla aleatoria para variabilidad
            seed: Math.floor(Math.random() * 1000000)
        };

        console.log(`📤 Enviando job a fal.ai (${animationStyle})...`);

        // POST al endpoint de fal.ai
        const response = await falClient.post(`/${FAL_MODEL}`, payload);

        console.log('✅ Job enviado a fal.ai:', response.data.request_id);

        return {
            requestId: response.data.request_id,
            status: response.data.status || 'IN_QUEUE',
            message: 'Job enviado exitosamente a fal.ai'
        };

    } catch (error) {
        console.error('❌ Error al enviar job a fal.ai:', error.message);

        // Manejo de errores específicos
        if (error.response) {
            // Error de la API (4xx, 5xx)
            const status = error.response.status;
            const errorData = error.response.data;

            if (status === 401) {
                throw new Error('FAL_API_KEY inválida o expirada');
            } else if (status === 429) {
                throw new Error('Límite de requests de fal.ai alcanzado. Intenta en unos minutos.');
            } else if (status === 400) {
                throw new Error(`Imagen inválida o parámetros incorrectos: ${errorData.error || 'unknown'}`);
            } else {
                throw new Error(`Error de fal.ai (${status}): ${errorData.error || error.message}`);
            }
        } else if (error.code === 'ECONNABORTED') {
            throw new Error('Timeout al conectar con fal.ai. Intenta nuevamente.');
        } else {
            throw new Error(`Error de red al comunicar con fal.ai: ${error.message}`);
        }
    }
}

/**
 * Consulta el estado de un job en fal.ai (para polling)
 * 
 * @param {string} requestId - ID del request devuelto por submitJob()
 * @returns {Promise<Object>} - { status, output, error }
 */
export async function checkJobStatus(requestId) {
    validateApiKey();

    if (!requestId) {
        throw new Error('requestId es requerido para checkJobStatus');
    }

    try {
        console.log(`🔍 Consultando estado del job: ${requestId}...`);

        // GET al endpoint de status
        const response = await falClient.get(`/${FAL_MODEL}/requests/${requestId}/status`);

        const data = response.data;

        // Mapear estados de fal.ai a estados internos
        let status = 'processing';
        if (data.status === 'COMPLETED' || data.status === 'SUCCESS') {
            status = 'completed';
        } else if (data.status === 'FAILED' || data.status === 'ERROR') {
            status = 'failed';
        } else if (data.status === 'IN_QUEUE' || data.status === 'IN_PROGRESS') {
            status = 'processing';
        }

        console.log(`📊 Estado del job ${requestId}: ${status}`);

        return {
            status,
            output: data.output || null,           // URL del video si está completo
            error: data.error || null,             // Mensaje de error si falló
            progress: data.progress || null,       // Porcentaje de progreso (si disponible)
            processingTimeMs: data.processing_time_ms || null
        };

    } catch (error) {
        console.error('❌ Error al consultar estado del job:', error.message);

        if (error.response?.status === 404) {
            throw new Error(`Job no encontrado en fal.ai: ${requestId}`);
        } else if (error.response?.status === 401) {
            throw new Error('FAL_API_KEY inválida o expirada');
        } else {
            throw new Error(`Error al consultar fal.ai: ${error.message}`);
        }
    }
}

/**
 * Cancela un job en fal.ai (opcional, por si el usuario cancela)
 * 
 * @param {string} requestId - ID del request
 * @returns {Promise<boolean>} - true si se canceló exitosamente
 */
export async function cancelJob(requestId) {
    validateApiKey();

    if (!requestId) {
        throw new Error('requestId es requerido para cancelJob');
    }

    try {
        console.log(`🛑 Cancelando job: ${requestId}...`);

        await falClient.post(`/${FAL_MODEL}/requests/${requestId}/cancel`);

        console.log(`✅ Job ${requestId} cancelado`);
        return true;

    } catch (error) {
        console.error('❌ Error al cancelar job:', error.message);
        
        // No es crítico si falla la cancelación
        return false;
    }
}

/**
 * Health check de la API de fal.ai
 * 
 * @returns {Promise<boolean>} - true si la API está disponible
 */
export async function healthCheck() {
    try {
        validateApiKey();
        
        // Endpoint de health check de fal.ai (si existe)
        // Si no existe, podemos hacer un request simple para validar la key
        const response = await falClient.get('/health', { timeout: 5000 });
        
        return response.status === 200;
    } catch (error) {
        console.error('❌ fal.ai health check falló:', error.message);
        return false;
    }
}

export default {
    submitJob,
    checkJobStatus,
    cancelJob,
    healthCheck
};
