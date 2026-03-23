import cron from 'node-cron';
import * as VideoExpressService from '../services/videoExpress.service.js';

/**
 * CRON JOB: Video Express Polling
 * 
 * Responsabilidad: Consultar periódicamente el estado de los jobs en fal.ai
 * 
 * Frecuencia: Cada 30 segundos
 * 
 * Proceso:
 * 1. Buscar jobs con status='processing'
 * 2. Para cada job, consultar estado en fal.ai
 * 3. Si está completado → descargar video y actualizar DB
 * 4. Si falló → marcar como failed en DB
 * 5. Si sigue procesando → continuar esperando
 * 6. Si timeout (>5min) → marcar como failed
 * 
 * IMPORTANTE: Este cron job debe iniciarse en app.js o index.js
 */

let isRunning = false; // Flag para prevenir ejecuciones simultáneas

/**
 * Inicia el cron job de polling
 */
export function startVideoExpressPolling() {
    console.log('🚀 Iniciando cron job de Video Express Polling...');

    // Ejecutar cada 5 minutos (reducido temporalmente para debug de Stripe)
    // Sintaxis cron: "*/5 * * * *" = cada 5 minutos
    const cronSchedule = '*/5 * * * *';

    const job = cron.schedule(cronSchedule, async () => {
        // Prevenir ejecuciones simultáneas
        if (isRunning) {
            console.log('⏭️  Polling anterior aún en ejecución, saltando...');
            return;
        }

        try {
            isRunning = true;
            console.log('⏰ [Cron] Ejecutando polling de Video Express...');

            // Procesar jobs pendientes
            await VideoExpressService.processPendingJobs();

        } catch (error) {
            console.error('❌ [Cron] Error al ejecutar polling:', error);
        } finally {
            isRunning = false;
        }
    }, {
        scheduled: true,
        timezone: "Europe/Madrid" // Ajustar según tu timezone
    });

    job.start();
    console.log('✅ Cron job de Video Express iniciado (cada 10s - optimizado)');

    return job;
}

/**
 * Ejecuta el polling una sola vez (útil para testing)
 */
export async function runPollingOnce() {
    console.log('🔄 Ejecutando polling manual...');
    
    try {
        await VideoExpressService.processPendingJobs();
        console.log('✅ Polling manual completado');
    } catch (error) {
        console.error('❌ Error en polling manual:', error);
        throw error;
    }
}

export default {
    startVideoExpressPolling,
    runPollingOnce
};
