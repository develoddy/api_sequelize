import cron from 'node-cron';
import { sendDailyReportToAdmin } from '../services/dailyReportService.js';
import { processQueue } from '../services/retryQueue.service.js';
import { autoSyncOrderToPrintful } from '../services/autoSyncPrintful.service.js';
import { 
    calculateDailyMetrics, 
    aggregateWeeklyMetrics, 
    aggregateMonthlyMetrics 
} from '../services/analyticsCalculation.service.js';
import { startWebhookRetryCron } from './retry-webhooks.cron.js';
import { startMailflowSenderCron } from './mailflow-sender.cron.js';

/**
 * ⏰ CRON JOBS
 * Sprint 6B Iteración 4: Automatización de reportes
 * Sprint 6D: Procesamiento automático de retry queue
 * Sprint 6E: Cálculo automático de analytics
 * SaaS Management: Retry de webhooks fallidos
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

    // 📊 Analytics: Métricas Diarias - Cada día a las 2:00 AM
    cron.schedule('0 2 * * *', async () => {
        console.log('\n⏰ [CRON] Calculando métricas diarias...');
        try {
            // Calcular métricas del día anterior
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            const metrics = await calculateDailyMetrics(yesterday);
            
            if (metrics) {
                console.log(`✅ [CRON] Métricas diarias calculadas - Revenue: ${metrics.revenue}, Profit: ${metrics.profit}, Orders: ${metrics.orderCount}`);
            } else {
                console.log('ℹ️  [CRON] No hay datos para calcular métricas diarias');
            }
        } catch (error) {
            console.error('❌ [CRON] Error calculando métricas diarias:', error);
        }
    }, {
        timezone: "Europe/Madrid"
    });

    // 📊 Analytics: Métricas Semanales - Cada lunes a las 3:00 AM
    cron.schedule('0 3 * * 1', async () => {
        console.log('\n⏰ [CRON] Agregando métricas semanales...');
        try {
            const metrics = await aggregateWeeklyMetrics();
            
            if (metrics) {
                console.log(`✅ [CRON] Métricas semanales agregadas - Revenue: ${metrics.revenue}, Profit: ${metrics.profit}`);
            } else {
                console.log('ℹ️  [CRON] No hay datos para agregar métricas semanales');
            }
        } catch (error) {
            console.error('❌ [CRON] Error agregando métricas semanales:', error);
        }
    }, {
        timezone: "Europe/Madrid"
    });

    // 📊 Analytics: Métricas Mensuales - Primer día del mes a las 4:00 AM
    cron.schedule('0 4 1 * *', async () => {
        console.log('\n⏰ [CRON] Agregando métricas mensuales...');
        try {
            const metrics = await aggregateMonthlyMetrics();
            
            if (metrics) {
                console.log(`✅ [CRON] Métricas mensuales agregadas - Revenue: ${metrics.revenue}, Profit: ${metrics.profit}`);
            } else {
                console.log('ℹ️  [CRON] No hay datos para agregar métricas mensuales');
            }
        } catch (error) {
            console.error('❌ [CRON] Error agregando métricas mensuales:', error);
        }
    }, {
        timezone: "Europe/Madrid"
    });

    console.log('✅ [CRON] Cron jobs inicializados');
    console.log('   📊 Reporte Diario: 8:00 AM (Europe/Madrid)');
    console.log('   🔄 Retry Queue Processor: Cada 5 minutos');
    console.log('   📊 Analytics Diarias: 2:00 AM (Europe/Madrid)');
    console.log('   📊 Analytics Semanales: Lunes 3:00 AM (Europe/Madrid)');
    console.log('   📊 Analytics Mensuales: Día 1 del mes 4:00 AM (Europe/Madrid)');
    
    // 🔄 Iniciar cron de retry de webhooks (SaaS Management)
    startWebhookRetryCron();
    
    // 📧 Iniciar cron de MailFlow (Email Sequences)
    startMailflowSenderCron();
    console.log('   📧 MailFlow Sender: Cada 15 minutos (Europe/Madrid)');
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

/**
 * Ejecutar cálculo de analytics inmediatamente (para testing)
 */
export async function runAnalyticsNow(type = 'daily', date = null) {
    console.log(`🚀 [CRON] Ejecutando analytics ${type} manualmente...`);
    try {
        let result;

        switch (type) {
            case 'daily':
                const targetDate = date ? new Date(date) : null;
                result = await calculateDailyMetrics(targetDate);
                break;
            case 'weekly':
                result = await aggregateWeeklyMetrics();
                break;
            case 'monthly':
                result = await aggregateMonthlyMetrics();
                break;
            default:
                throw new Error(`Tipo de analytics no válido: ${type}`);
        }

        if (result) {
            console.log(`✅ [CRON] Analytics ${type} ejecutado - Revenue: ${result.revenue}, Profit: ${result.profit}`);
        }

        return result;
    } catch (error) {
        console.error(`❌ [CRON] Error ejecutando analytics ${type}:`, error);
        throw error;
    }
}

export default {
    initCronJobs,
    runDailyReportNow,
    runRetryQueueNow,
    runAnalyticsNow
};
