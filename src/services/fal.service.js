import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Para usar __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
 * 
 * PROTECCIÓN DE CRÉDITOS:
 * - VIDEO_REAL_LIMIT: Límite de videos reales generados
 * - Contador persistente en: api/data/video-credit-counter.json
 * - Si se alcanza el límite → forzar modo simulación aunque FAL_SIMULATION_MODE=false
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

// 💰 Límite de videos reales (protección de créditos)
const VIDEO_REAL_LIMIT = parseInt(process.env.VIDEO_REAL_LIMIT) || 25;
const CREDIT_COUNTER_PATH = path.join(__dirname, '../../data/video-credit-counter.json');

if (SIMULATION_MODE) {
    console.log('🎭 FAL.AI MODO SIMULACIÓN ACTIVADO - No se consumirán créditos');
}

console.log(`💰 Límite de videos reales configurado: ${VIDEO_REAL_LIMIT}`);


// Timeout para requests (30 segundos)
const REQUEST_TIMEOUT = 30000;

/**
 * GESTIÓN DE CONTADOR DE CRÉDITOS
 * Protege los $10 de créditos de fal.ai limitando videos reales generados
 */

/**
 * Lee el contador actual desde el archivo JSON
 * @returns {Object} - { real_videos_generated, limit, last_reset, history }
 */
function readCreditCounter() {
    try {
        // Si no existe el archivo, crearlo con valores iniciales
        if (!fs.existsSync(CREDIT_COUNTER_PATH)) {
            const initialData = {
                real_videos_generated: 0,
                limit: VIDEO_REAL_LIMIT,
                last_reset: null,
                history: []
            };
            fs.writeFileSync(CREDIT_COUNTER_PATH, JSON.stringify(initialData, null, 2));
            return initialData;
        }

        const data = fs.readFileSync(CREDIT_COUNTER_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('❌ Error leyendo contador de créditos:', error.message);
        // Fallback a valores seguros
        return {
            real_videos_generated: VIDEO_REAL_LIMIT, // Máximo para forzar simulación
            limit: VIDEO_REAL_LIMIT,
            last_reset: null,
            history: []
        };
    }
}

/**
 * Incrementa el contador de videos reales generados
 * @param {string} requestId - ID del video generado
 */
function incrementCreditCounter(requestId) {
    try {
        const counter = readCreditCounter();
        counter.real_videos_generated += 1;
        counter.history.push({
            requestId,
            timestamp: new Date().toISOString(),
            count: counter.real_videos_generated
        });

        // Mantener solo últimos 50 registros en el historial
        if (counter.history.length > 50) {
            counter.history = counter.history.slice(-50);
        }

        fs.writeFileSync(CREDIT_COUNTER_PATH, JSON.stringify(counter, null, 2));
        
        console.log(`💰 Contador actualizado: ${counter.real_videos_generated}/${counter.limit}`);
        
        // Advertencia si se acerca al límite
        if (counter.real_videos_generated >= counter.limit * 0.8) {
            console.warn(`⚠️ ADVERTENCIA: Se ha usado el ${Math.round((counter.real_videos_generated / counter.limit) * 100)}% del límite de créditos`);
        }
    } catch (error) {
        console.error('❌ Error incrementando contador de créditos:', error.message);
    }
}

/**
 * Verifica si se puede generar un video real o se debe usar simulación
 * @returns {boolean} - true si se puede generar video real, false si se alcanzó el límite
 */
function canGenerateRealVideo() {
    const counter = readCreditCounter();
    const canGenerate = counter.real_videos_generated < counter.limit;
    
    if (!canGenerate) {
        console.warn(`🚫 LÍMITE ALCANZADO: ${counter.real_videos_generated}/${counter.limit} videos reales generados`);
        console.warn(`💡 Forzando modo simulación para proteger créditos`);
    }
    
    return canGenerate;
}

/**
 * Resetea el contador de créditos (uso manual o administrativo)
 * @returns {Object} - Contador reseteado
 */
export function resetCreditCounter() {
    try {
        const resetData = {
            real_videos_generated: 0,
            limit: VIDEO_REAL_LIMIT,
            last_reset: new Date().toISOString(),
            history: []
        };
        fs.writeFileSync(CREDIT_COUNTER_PATH, JSON.stringify(resetData, null, 2));
        console.log('✅ Contador de créditos reseteado');
        return resetData;
    } catch (error) {
        console.error('❌ Error reseteando contador:', error.message);
        throw error;
    }
}

/**
 * Obtiene el estado actual del contador (para dashboard/monitoreo)
 * @returns {Object} - Estado del contador
 */
export function getCreditCounterStatus() {
    const counter = readCreditCounter();
    return {
        ...counter,
        remaining: counter.limit - counter.real_videos_generated,
        percentage_used: Math.round((counter.real_videos_generated / counter.limit) * 100),
        can_generate: counter.real_videos_generated < counter.limit
    };
}

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
 * @returns {Promise<Object>} - { requestId, status, isSimulated }
 */
export async function submitJob(imageUrl, animationStyle = 'parallax') {
    validateApiKey();

    // 🎭 MODO SIMULACIÓN EXPLÍCITO - No consume créditos
    if (SIMULATION_MODE) {
        console.log('🎭 SIMULACIÓN: Generando video fake (FAL_SIMULATION_MODE=true)...');
        const fakeRequestId = `sim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        console.log('✅ Job simulado creado con ID:', fakeRequestId);
        
        return {
            requestId: fakeRequestId,
            status: 'IN_QUEUE',
            message: 'Job simulado - proceso instantáneo (sin usar créditos reales)',
            isSimulated: true
        };
    }

    // 💰 PROTECCIÓN DE CRÉDITOS - Verificar límite aunque SIMULATION_MODE=false
    if (!canGenerateRealVideo()) {
        console.log('💰 LÍMITE ALCANZADO: Forzando modo simulación para proteger créditos...');
        const fakeRequestId = `limit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        console.log('✅ Job simulado creado con ID (límite alcanzado):', fakeRequestId);
        
        return {
            requestId: fakeRequestId,
            status: 'IN_QUEUE',
            message: 'Límite de créditos alcanzado - usando video placeholder',
            isSimulated: true,
            limitReached: true
        };
    }

    // ✅ GENERAR VIDEO REAL - Todavía hay créditos disponibles
    console.log('💎 Generando video REAL con fal.ai (consumirá créditos)...');

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

        // 💰 Incrementar contador de créditos (video real generado)
        incrementCreditCounter(requestId);

        return {
            requestId,
            status: response.data.status || 'IN_QUEUE',
            message: 'Job enviado exitosamente a fal.ai',
            isSimulated: false
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
 * @returns {Promise<Object>} - { status, output, error, isSimulated }
 */
export async function checkJobStatus(requestId) {
    validateApiKey();

    if (!requestId) {
        throw new Error('requestId es requerido para checkJobStatus');
    }

    // 🎭 MODO SIMULACIÓN - Simula completación instantánea
    // Detecta IDs simulados (sim-*) o límite alcanzado (limit-*)
    const isSimulated = requestId.startsWith('sim-') || requestId.startsWith('limit-');
    
    if (isSimulated) {
        console.log('🎭 SIMULACIÓN: Job completado instantáneamente');
        
        if (requestId.startsWith('limit-')) {
            console.log('💰 Video generado con placeholder (límite de créditos alcanzado)');
        }
        
        // 🎯 Video placeholder confiable (Google Cloud Storage - público)
        // Big Buck Bunny - Compatible con todos los navegadores y permite CORS
        const placeholderVideoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
        
        return {
            status: 'completed',
            output: {
                video: placeholderVideoUrl
            },
            error: null,
            progress: 100,
            processingTimeMs: 1500,
            isSimulated: true
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
