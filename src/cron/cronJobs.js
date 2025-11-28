import cron from 'node-cron';
import { sendDailyReportToAdmin } from '../services/dailyReportService.js';
import { processQueue } from '../services/retryQueue.service.js';
import { autoSyncOrderToPrintful } from '../services/autoSyncPrintful.service.js';

/**
 * ⏰ CRON JOBS
 * Sprint 6B Iteración 4: Automatización de reportes
 * Sprint 6D: Procesamiento automático de retry queue
 */

/**
 * Inicializar todos los cron jobs
 */
export function initCronJobs() {
    console.log('⏰ [CRON] Inicializando cron jobs...');

    // 📊 Reporte Diario - Cada día a las 8:00 AM
    // 📊 Reporte Diario - Cada día a las 8:00 AM
    cron.schedule('0 8 * * *', async () => {
        console.log('\n⏰ [CRON] Ejecutando reporte diario...');
        try {
            // Generar reporte del día anterior
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            await sendDailyReportToAdmin(yesterday);
            console.log('✅ [CRON] Reporte diario completado');
        } catch (error) {
            console.error('❌ [CRON] Error en reporte diario:', error);
        }
    }, {
        timezone: "Europe/Madrid"
    });

    // 🔄 Retry Queue Processor - Cada 5 minutos
    cron.schedule('*/5 * * * *', async () => {
        console.log('\n⏰ [CRON] Procesando retry queue...');
        try {
            // Función de procesamiento: intenta sync de cada job
            const processFn = async (job) => {
                console.log(`🔄 [CRON] Procesando Job #${job.id} (Sale #${job.saleId})`);
                
                try {
                    const result = await autoSyncOrderToPrintful(job.saleId);
                    
                    if (result.success) {
                        console.log(`✅ [CRON] Sale #${job.saleId} sincronizado exitosamente`);
                        return true; // Éxito - marcar job como resolved
                    } else {
                        console.log(`❌ [CRON] Sale #${job.saleId} falló: ${result.message}`);
                        return false; // Falló - reprogramar o marcar como failed
                    }
                } catch (syncError) {
                    console.error(`❌ [CRON] Error sincronizando Sale #${job.saleId}:`, syncError);
                    return false;
                }
            };

            const result = await processQueue(processFn);
            
            if (result.processed > 0) {
                console.log(`✅ [CRON] Retry queue procesado: ${result.succeeded} exitosos, ${result.failed} fallidos, ${result.maxReached} máximo alcanzado`);
            }
        } catch (error) {
            console.error('❌ [CRON] Error procesando retry queue:', error);
        }
    }, {
        timezone: "Europe/Madrid"
    });

    console.log('✅ [CRON] Cron jobs inicializados');
    console.log('   📊 Reporte Diario: 8:00 AM (Europe/Madrid)');
    console.log('   🔄 Retry Queue Processor: Cada 5 minutos');
}

/**
 * Ejecutar reporte inmediatamente (para testing)
 */
export async function runDailyReportNow() {
    console.log('🚀 [CRON] Ejecutando reporte diario manualmente...');
    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const result = await sendDailyReportToAdmin(yesterday);
        return result;
    } catch (error) {
        console.error('❌ [CRON] Error ejecutando reporte:', error);
        throw error;
    }
}

/**
 * Ejecutar retry queue processor inmediatamente (para testing)
 */
export async function runRetryQueueNow() {
    console.log('🚀 [CRON] Ejecutando retry queue processor manualmente...');
    try {
        const processFn = async (job) => {
            console.log(`🔄 [CRON] Procesando Job #${job.id} (Sale #${job.saleId})`);
            
            try {
                const result = await autoSyncOrderToPrintful(job.saleId);
                
                if (result.success) {
                    console.log(`✅ [CRON] Sale #${job.saleId} sincronizado exitosamente`);
                    return true;
                } else {
                    console.log(`❌ [CRON] Sale #${job.saleId} falló: ${result.message}`);
                    return false;
                }
            } catch (syncError) {
                console.error(`❌ [CRON] Error sincronizando Sale #${job.saleId}:`, syncError);
                return false;
            }
        };

        const result = await processQueue(processFn);
        return result;
    } catch (error) {
        console.error('❌ [CRON] Error ejecutando retry queue:', error);
        throw error;
    }
}

export default {
    initCronJobs,
    runDailyReportNow,
    runRetryQueueNow
};
