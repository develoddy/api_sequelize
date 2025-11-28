import { Sale } from '../models/Sale.js';
import { User } from '../models/User.js';
import { Guest } from '../models/Guest.js';
import { Op } from 'sequelize';
import { sendAdminDailyReport } from './emailNotification.service.js';

/**
 * 📊 DAILY REPORT SERVICE
 * Genera y envía el reporte diario de órdenes Printful
 * Sprint 6B - Iteración 4
 */

/**
 * Generar estadísticas del día
 */
export async function generateDailyStats(targetDate = new Date()) {
    try {
        console.log(`📊 [DAILY-REPORT] Generando estadísticas para: ${targetDate.toISOString().split('T')[0]}`);

        // Fechas para el día target y el día anterior
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        const startOfYesterday = new Date(startOfDay);
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);

        const endOfYesterday = new Date(endOfDay);
        endOfYesterday.setDate(endOfYesterday.getDate() - 1);

        // 1️⃣ Obtener órdenes del día
        const todayOrders = await Sale.findAll({
            where: {
                createdAt: {
                    [Op.between]: [startOfDay, endOfDay]
                },
                printfulOrderId: {
                    [Op.ne]: null
                }
            }
        });

        // 2️⃣ Obtener órdenes de ayer (para comparación)
        const yesterdayOrders = await Sale.findAll({
            where: {
                createdAt: {
                    [Op.between]: [startOfYesterday, endOfYesterday]
                },
                printfulOrderId: {
                    [Op.ne]: null
                }
            }
        });

        // 3️⃣ Calcular estadísticas por estado
        const todaySynced = todayOrders.filter(s => s.syncStatus === 'pending' || s.syncStatus === 'shipped' || s.syncStatus === 'delivered').length;
        const todayPending = todayOrders.filter(s => s.syncStatus === 'pending' && !s.printfulStatus).length;
        const todayFailed = todayOrders.filter(s => s.syncStatus === 'failed').length;

        const yesterdaySynced = yesterdayOrders.filter(s => s.syncStatus === 'pending' || s.syncStatus === 'shipped' || s.syncStatus === 'delivered').length;
        const yesterdayPending = yesterdayOrders.filter(s => s.syncStatus === 'pending' && !s.printfulStatus).length;
        const yesterdayFailed = yesterdayOrders.filter(s => s.syncStatus === 'failed').length;

        // 4️⃣ Calcular ingresos
        const todayRevenue = todayOrders.reduce((sum, s) => sum + parseFloat(s.total || 0), 0);
        const yesterdayRevenue = yesterdayOrders.reduce((sum, s) => sum + parseFloat(s.total || 0), 0);

        // 5️⃣ Obtener órdenes fallidas con detalles
        const failedOrders = await Sale.findAll({
            where: {
                syncStatus: 'failed',
                createdAt: {
                    [Op.between]: [startOfDay, endOfDay]
                }
            },
            include: [
                {
                    model: User,
                    attributes: ['name', 'surname', 'email']
                },
                {
                    model: Guest,
                    attributes: ['name', 'email']
                }
            ],
            limit: 10
        });

        const failedOrdersData = failedOrders.map(sale => ({
            id: sale.id,
            customer: sale.user 
                ? `${sale.user.name} ${sale.user.surname || ''}`.trim()
                : sale.guest?.name || 'N/A',
            total: sale.total,
            error: sale.errorMessage || 'Error desconocido'
        }));

        // 6️⃣ Obtener órdenes recientes
        const recentOrders = await Sale.findAll({
            where: {
                createdAt: {
                    [Op.between]: [startOfDay, endOfDay]
                },
                printfulOrderId: {
                    [Op.ne]: null
                }
            },
            include: [
                {
                    model: User,
                    attributes: ['name', 'surname']
                },
                {
                    model: Guest,
                    attributes: ['name']
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: 15
        });

        const recentOrdersData = recentOrders.map(sale => ({
            id: sale.id,
            customer: sale.user 
                ? `${sale.user.name} ${sale.user.surname || ''}`.trim()
                : sale.guest?.name || 'N/A',
            total: sale.total,
            date: sale.createdAt,
            status: sale.syncStatus === 'failed' ? 'failed' : sale.syncStatus === 'pending' ? 'pending' : 'synced'
        }));

        // 7️⃣ Calcular métricas de rendimiento
        const totalOrders = todayOrders.length;
        const successRate = totalOrders > 0 
            ? Math.round((todaySynced / totalOrders) * 100)
            : 0;

        // 8️⃣ Generar insights
        const insights = [];
        if (todaySynced > yesterdaySynced) {
            insights.push(`✅ ${todaySynced - yesterdaySynced} más órdenes sincronizadas que ayer`);
        }
        if (todayFailed > 0) {
            insights.push(`⚠️ ${todayFailed} órdenes requieren atención inmediata`);
        }
        if (todayRevenue > yesterdayRevenue) {
            const increase = ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100).toFixed(1);
            insights.push(`📈 Ingresos aumentaron ${increase}% respecto a ayer`);
        }
        if (successRate >= 95) {
            insights.push(`🎉 Excelente tasa de éxito: ${successRate}%`);
        }

        // 9️⃣ Generar alertas
        const alerts = [];
        if (todayFailed > 3) {
            alerts.push({
                title: 'Alto número de órdenes fallidas',
                description: `${todayFailed} órdenes fallaron hoy. Revisa los errores y toma acción.`
            });
        }
        if (todayPending > 5) {
            alerts.push({
                title: 'Órdenes pendientes acumuladas',
                description: `${todayPending} órdenes están pendientes de sincronización.`
            });
        }
        if (successRate < 80 && totalOrders > 0) {
            alerts.push({
                title: 'Baja tasa de éxito',
                description: `La tasa de éxito es solo ${successRate}%. Investiga posibles problemas.`
            });
        }

        // 🔟 Construir objeto de estadísticas
        const stats = {
            date: targetDate,
            synced: {
                today: todaySynced,
                yesterday: yesterdaySynced,
                change: todaySynced - yesterdaySynced
            },
            pending: {
                today: todayPending,
                yesterday: yesterdayPending,
                change: todayPending - yesterdayPending
            },
            failed: {
                today: todayFailed,
                yesterday: yesterdayFailed,
                change: todayFailed - yesterdayFailed
            },
            revenue: {
                today: todayRevenue.toFixed(2),
                yesterday: yesterdayRevenue.toFixed(2),
                change: (todayRevenue - yesterdayRevenue)
            },
            performance: {
                successRate: successRate,
                avgProcessingTime: '< 2 min',
                totalOrders: totalOrders
            },
            failedOrders: failedOrdersData,
            recentOrders: recentOrdersData,
            insights: insights,
            alerts: alerts
        };

        console.log(`✅ [DAILY-REPORT] Estadísticas generadas exitosamente`);
        console.log(`   📊 Total: ${totalOrders} | Synced: ${todaySynced} | Failed: ${todayFailed}`);

        return stats;

    } catch (error) {
        console.error('❌ [DAILY-REPORT] Error generando estadísticas:', error);
        throw error;
    }
}

/**
 * Enviar reporte diario al admin
 */
export async function sendDailyReportToAdmin(targetDate = new Date()) {
    try {
        console.log('📧 [DAILY-REPORT] Iniciando envío de reporte diario...');

        // Generar estadísticas
        const stats = await generateDailyStats(targetDate);

        // Enviar email
        const result = await sendAdminDailyReport(stats);

        if (result.success) {
            console.log('✅ [DAILY-REPORT] Reporte enviado exitosamente');
        } else {
            console.error('❌ [DAILY-REPORT] Error enviando reporte:', result.error);
        }

        return result;

    } catch (error) {
        console.error('❌ [DAILY-REPORT] Error en sendDailyReportToAdmin:', error);
        return { success: false, error: error.message };
    }
}

export default {
    generateDailyStats,
    sendDailyReportToAdmin
};
