import cron from 'node-cron';
import { sendDailyReportToAdmin } from '../services/dailyReportService.js';

/**
 * ⏰ CRON JOBS - Sprint 6B Iteración 4
 * Tareas programadas para automatización de reportes
 */

/**
 * Inicializar todos los cron jobs
 */
export function initCronJobs() {
    console.log('⏰ [CRON] Inicializando cron jobs...');

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

    console.log('✅ [CRON] Cron jobs inicializados');
    console.log('   📊 Reporte Diario: 8:00 AM (Europe/Madrid)');
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

export default {
    initCronJobs,
    runDailyReportNow
};
