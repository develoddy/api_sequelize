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
// ✅ Usando Queue API (recomendado por fal.ai) - asíncrono y confiable
const FAL_API_BASE_URL = 'https://queue.fal.run';

// Modelo para image-to-video (Stable Video Diffusion es el más estable)
// Alternativas: 'fal-ai/fast-svd', 'fal-ai/stable-video', 'fal-ai/animatediff'
const FAL_MODEL = process.env.FAL_MODEL || 'fal-ai/fast-svd';

// 🎭 Modo simulación (para testing sin gastar créditos)
const SIMULATION_MODE = process.env.FAL_SIMULATION_MODE === 'true';

if (SIMULATION_MODE) {
    console.log('🎭 FAL.AI MODO SIMULACIÓN ACTIVADO - No se consumirán créditos');
}

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

    // 🎭 MODO SIMULACIÓN - No consume créditos
    if (SIMULATION_MODE) {
        console.log('🎭 SIMULACIÓN: Generando video fake (no se envía a fal.ai)...');
        const fakeRequestId = `sim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        console.log('✅ Job simulado creado con ID:', fakeRequestId);
        
        return {
            requestId: fakeRequestId,
            status: 'IN_QUEUE',
            message: 'Job simulado - proceso instantáneo (sin usar créditos reales)'
        };
    }

    // Validar que el estilo de animación sea válido
    if (!ANIMATION_PROMPTS[animationStyle]) {
        throw new Error(`Estilo de animación inválido: ${animationStyle}`);
    }

    const styleConfig = ANIMATION_PROMPTS[animationStyle];

    try {
        // Payload para fal-ai/fast-svd (Stable Video Diffusion)
        const payload = {
            // Imagen de entrada (debe ser URL accesible públicamente)
            image_url: imageUrl,
            
            // Parámetros para Stable Video Diffusion
            motion_bucket_id: 127,    // Controla la cantidad de movimiento (1-255, default 127)
            fps: 6,                   // Frame rate (default 6)
            cond_aug: 0.02            // Augmentation condicional (default 0.02)
        };

        console.log(`📤 Enviando job a fal.ai (${animationStyle})...`);
        console.log(`📍 Endpoint: ${FAL_API_BASE_URL}/${FAL_MODEL}`);
        console.log(`📦 Payload:`, JSON.stringify(payload, null, 2));
        console.log(`📍 Endpoint: ${FAL_API_BASE_URL}/${FAL_MODEL}`);

        // POST al endpoint de fal.ai Queue API
        const response = await falClient.post(`/${FAL_MODEL}`, payload);

        console.log('✅ Respuesta de fal.ai:', JSON.stringify(response.data, null, 2));

        // Queue API retorna request_id (o puede ser solo 'id')
        const requestId = response.data.request_id || response.data.id;
        
        if (!requestId) {
            throw new Error('fal.ai no retornó request_id en la respuesta');
        }

        console.log('✅ Job enviado a fal.ai con request_id:', requestId);

        return {
            requestId,
            status: response.data.status || 'IN_QUEUE',
            message: 'Job enviado exitosamente a fal.ai'
        };

    } catch (error) {
        console.error('❌ Error al enviar job a fal.ai:', error.message);
        console.error('❌ Error completo:', error.response?.data || error);

        // Manejo de errores específicos
        if (error.response) {
            // Error de la API (4xx, 5xx)
            const status = error.response.status;
            const errorData = error.response.data;

            console.error(`❌ Status HTTP: ${status}`);
            console.error(`❌ Response data:`, errorData);

            if (status === 401) {
                throw new Error('FAL_API_KEY inválida o no autorizada');
            } else if (status === 403) {
                // Error 403 específico de balance agotado
                if (errorData.detail && errorData.detail.includes('Exhausted balance')) {
                    throw new Error('🚨 SIN SALDO: Tu cuenta de fal.ai no tiene créditos. Recarga en https://fal.ai/dashboard/billing');
                }
                throw new Error('Acceso denegado por fal.ai. Verifica tu cuenta.');
            } else if (status === 429) {
                throw new Error('Límite de requests de fal.ai alcanzado. Intenta en unos minutos.');
            } else if (status === 400) {
                throw new Error(`Imagen inválida o parámetros incorrectos: ${JSON.stringify(errorData)}`);
            } else if (status === 404) {
                throw new Error(`Modelo no encontrado: ${FAL_MODEL}. Verifica FAL_MODEL en .env`);
            } else {
                throw new Error(`Error de fal.ai (${status}): ${JSON.stringify(errorData)}`);
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

    // 🎭 MODO SIMULACIÓN - Simula completación instantánea
    if (SIMULATION_MODE && requestId.startsWith('sim-')) {
        console.log('🎭 SIMULACIÓN: Job completado instantáneamente');
        
        // URL de video de ejemplo (puedes usar cualquier video MP4 público)
        const exampleVideoUrl = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
        
        return {
            status: 'completed',
            output: {
                video: exampleVideoUrl
            },
            error: null,
            progress: 100,
            processingTimeMs: 1500
        };
    }

    try {
        console.log(`🔍 Consultando estado del job: ${requestId}...`);

        // GET al endpoint de status
        const statusResponse = await falClient.get(`/${FAL_MODEL}/requests/${requestId}/status`);
        const statusData = statusResponse.data;

        // Mapear estados de fal.ai a estados internos
        let status = 'processing';
        if (statusData.status === 'COMPLETED' || statusData.status === 'SUCCESS') {
            status = 'completed';
        } else if (statusData.status === 'FAILED' || statusData.status === 'ERROR') {
            status = 'failed';
        } else if (statusData.status === 'IN_QUEUE' || statusData.status === 'IN_PROGRESS') {
            status = 'processing';
        }

        console.log(`📊 Estado del job ${requestId}: ${status}`);

        // 🔍 Queue API: Si completó, obtener resultado del response_url
        if (status === 'completed' && statusData.response_url) {
            console.log('📥 Obteniendo resultado final de:', statusData.response_url);
            
            try {
                // Hacer request COMPLETO a la URL (no usar baseURL)
                const resultResponse = await axios.get(statusData.response_url, {
                    headers: {
                        'Authorization': `Key ${FAL_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                });
                const resultData = resultResponse.data;
                
                console.log('📦 Respuesta completa con output:', JSON.stringify(resultData, null, 2));
                
                return {
                    status,
                    output: resultData.data || resultData.output || resultData,  // Output con video
                    error: resultData.error || null,
                    progress: 100,
                    processingTimeMs: statusData.metrics?.inference_time || null
                };
            } catch (fetchError) {
                console.error('❌ Error al obtener resultado:', fetchError.message);
                if (fetchError.response) {
                    console.error('❌ Status:', fetchError.response.status);
                    console.error('❌ Data:', fetchError.response.data);
                }
                // Fallback: intentar con output del status (por si acaso)
                return {
                    status,
                    output: statusData.output || null,
                    error: statusData.error || null,
                    progress: statusData.progress || null,
                    processingTimeMs: statusData.metrics?.inference_time || null
                };
            }
        }

        // Si aún procesando o hay output en status
        return {
            status,
            output: statusData.output || null,
            error: statusData.error || null,
            progress: statusData.progress || null,
            processingTimeMs: statusData.metrics?.inference_time || null
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
