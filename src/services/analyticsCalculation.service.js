import { Sale } from '../models/Sale.js';
import { SaleDetail } from '../models/SaleDetail.js';
import { Product } from '../models/Product.js';
import AnalyticsCache from '../models/AnalyticsCache.js';
import ProductAnalytics from '../models/ProductAnalytics.js';
import { PrintfulWebhookLog } from '../models/PrintfulWebhookLog.js';
import { sequelize } from '../database/database.js';
import { Op } from 'sequelize';

/**
 * Calcula métricas diarias para una fecha específica
 * @param {Date} date - Fecha para calcular métricas (por defecto: ayer)
 * @returns {Object} Métricas calculadas
 */
export async function calculateDailyMetrics(date = null) {
  try {
    // Si no se proporciona fecha, usar ayer
    const targetDate = date || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    // Consultar todas las ventas del día
    const sales = await Sale.findAll({
      where: {
        createdAt: {
          [Op.between]: [startOfDay, endOfDay]
        }
      },
      include: [
        {
          model: SaleDetail,
          as: 'sale_details',
          include: [{ model: Product, as: 'product' }]
        }
      ]
    });

    if (!sales || sales.length === 0) {
      console.log(`No hay ventas para la fecha ${startOfDay.toISOString().split('T')[0]}`);
      return null;
    }

    // Inicializar contadores
    let totalRevenue = 0;
    let totalCosts = 0;
    let orderCount = sales.length;
    let syncedCount = 0;
    let pendingCount = 0;
    let shippedCount = 0;
    let deliveredCount = 0;
    let failedCount = 0;
    let totalFulfillmentTime = 0;
    let fulfillmentCount = 0;

    const productMetrics = {}; // { productId: { unitsSold, revenue, cost, orders } }
    const paymentMethods = {};
    const topProducts = [];

    // Procesar cada venta
    for (const sale of sales) {
      totalRevenue += parseFloat(sale.total) || 0;

      // Contar por estado de sincronización
      switch (sale.syncStatus) {
        case 'pending':
          pendingCount++;
          break;
        case 'shipped':
          shippedCount++;
          syncedCount++;
          break;
        case 'fulfilled':
          deliveredCount++;
          syncedCount++;
          break;
        case 'failed':
        case 'canceled':
          failedCount++;
          break;
        default:
          if (sale.printfulOrderId) {
            syncedCount++;
          }
      }

      // Calcular tiempo de fulfillment (desde createdAt hasta shippedAt)
      if (sale.shippedAt) {
        const fulfillmentTime = (new Date(sale.shippedAt) - new Date(sale.createdAt)) / (1000 * 60 * 60); // en horas
        totalFulfillmentTime += fulfillmentTime;
        fulfillmentCount++;
      }

      // Contar métodos de pago
      const method = sale.method_payment || 'unknown';
      paymentMethods[method] = (paymentMethods[method] || 0) + 1;

      // Procesar detalles de venta (productos)
      if (sale.sale_details) {
        for (const detail of sale.sale_details) {
          const productId = detail.productId;
          const quantity = detail.cantidad || 0;
          const subtotal = parseFloat(detail.total) || 0;

          if (!productMetrics[productId]) {
            productMetrics[productId] = {
              productId,
              unitsSold: 0,
              revenue: 0,
              cost: 0,
              orders: 0,
              productTitle: detail.product?.titulo || 'Unknown'
            };
          }

          productMetrics[productId].unitsSold += quantity;
          productMetrics[productId].revenue += subtotal;
          productMetrics[productId].orders++;
        }
      }
    }

    // Obtener costos de Printful desde webhooks
    const costs = await calculatePrintfulCosts(startOfDay, endOfDay);
    totalCosts = costs.totalCosts;

    // Asignar costos a productos (si están disponibles en los webhooks)
    for (const productId in productMetrics) {
      if (costs.productCosts[productId]) {
        productMetrics[productId].cost = costs.productCosts[productId];
      }
    }

    // Calcular métricas agregadas
    const profit = totalRevenue - totalCosts;
    const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
    const successRate = orderCount > 0 ? ((syncedCount + shippedCount + deliveredCount) / orderCount) * 100 : 0;
    const avgFulfillmentTime = fulfillmentCount > 0 ? totalFulfillmentTime / fulfillmentCount : 0;
    const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    // Top productos (ordenar por revenue)
    const sortedProducts = Object.values(productMetrics).sort((a, b) => b.revenue - a.revenue);
    const top10Products = sortedProducts.slice(0, 10).map(p => ({
      productId: p.productId,
      title: p.productTitle,
      units: p.unitsSold,
      revenue: parseFloat(p.revenue.toFixed(2))
    }));

    // Crear/actualizar registro en AnalyticsCache
    const metricsData = {
      metricType: 'daily',
      date: startOfDay,
      revenue: parseFloat(totalRevenue.toFixed(2)),
      costs: parseFloat(totalCosts.toFixed(2)),
      profit: parseFloat(profit.toFixed(2)),
      margin: parseFloat(margin.toFixed(2)),
      orderCount,
      syncedCount,
      pendingCount,
      shippedCount,
      deliveredCount,
      failedCount,
      successRate: parseFloat(successRate.toFixed(2)),
      avgFulfillmentTime: parseFloat(avgFulfillmentTime.toFixed(2)),
      avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
      productCosts: costs.productCosts,
      paymentMethods,
      topProducts: top10Products,
      metadata: {
        calculatedAt: new Date(),
        salesProcessed: orderCount
      }
    };

    // Upsert en AnalyticsCache
    await AnalyticsCache.upsert(metricsData);

    // Guardar métricas por producto en ProductAnalytics
    await saveProductAnalytics(productMetrics, startOfDay);

    console.log(`✅ Métricas diarias calculadas para ${startOfDay.toISOString().split('T')[0]}`);
    return metricsData;

  } catch (error) {
    console.error('Error al calcular métricas diarias:', error);
    throw error;
  }
}

/**
 * Calcula costos de Printful desde webhooks y logs
 * @param {Date} startDate - Fecha inicio
 * @param {Date} endDate - Fecha fin
 * @returns {Object} { totalCosts, productCosts, shippingCosts }
 */
async function calculatePrintfulCosts(startDate, endDate) {
  try {
    const webhookLogs = await PrintfulWebhookLog.findAll({
      where: {
        received_at: {
          [Op.between]: [startDate, endDate]
        },
        event_type: {
          [Op.in]: ['package_shipped', 'order_created', 'order_updated']
        }
      }
    });

    let totalCosts = 0;
    const productCosts = {};
    let shippingCosts = 0;

    for (const log of webhookLogs) {
      const eventData = log.event_data;
      
      // Extraer costos del event_data (estructura puede variar según el webhook)
      if (eventData.order && eventData.order.costs) {
        const costs = eventData.order.costs;
        totalCosts += parseFloat(costs.total || 0);
        shippingCosts += parseFloat(costs.shipping || 0);

        // Costos por producto
        if (costs.items && Array.isArray(costs.items)) {
          for (const item of costs.items) {
            const productId = item.external_id || item.product_id;
            const itemCost = parseFloat(item.cost || 0);
            productCosts[productId] = (productCosts[productId] || 0) + itemCost;
          }
        }
      }
    }

    return { totalCosts, productCosts, shippingCosts };

  } catch (error) {
    console.error('Error al calcular costos de Printful:', error);
    // Retornar valores por defecto si hay error
    return { totalCosts: 0, productCosts: {}, shippingCosts: 0 };
  }
}

/**
 * Guarda métricas por producto en ProductAnalytics
 * @param {Object} productMetrics - Métricas agrupadas por productId
 * @param {Date} date - Fecha de las métricas
 */
async function saveProductAnalytics(productMetrics, date) {
  try {
    const analyticsPromises = [];

    for (const productId in productMetrics) {
      const metrics = productMetrics[productId];
      const profit = metrics.revenue - metrics.cost;
      const margin = metrics.revenue > 0 ? (profit / metrics.revenue) * 100 : 0;
      const avgPrice = metrics.unitsSold > 0 ? metrics.revenue / metrics.unitsSold : 0;

      const analyticsData = {
        productId: parseInt(productId),
        date,
        unitsSold: metrics.unitsSold,
        revenue: parseFloat(metrics.revenue.toFixed(2)),
        printfulCost: parseFloat(metrics.cost.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        margin: parseFloat(margin.toFixed(2)),
        orderCount: metrics.orders,
        avgPrice: parseFloat(avgPrice.toFixed(2)),
        metadata: {
          calculatedAt: new Date()
        }
      };

      analyticsPromises.push(ProductAnalytics.upsert(analyticsData));
    }

    await Promise.all(analyticsPromises);
    console.log(`✅ ${analyticsPromises.length} productos guardados en ProductAnalytics`);

  } catch (error) {
    console.error('Error al guardar ProductAnalytics:', error);
    throw error;
  }
}

/**
 * Agrega métricas semanales (últimos 7 días)
 * @returns {Object} Métricas agregadas
 */
export async function aggregateWeeklyMetrics() {
  try {
    const endDate = new Date();
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Consultar métricas diarias de los últimos 7 días
    const dailyMetrics = await AnalyticsCache.findAll({
      where: {
        metricType: 'daily',
        date: {
          [Op.between]: [startDate, endDate]
        }
      }
    });

    if (!dailyMetrics || dailyMetrics.length === 0) {
      console.log('No hay métricas diarias para agregar en weekly');
      return null;
    }

    // Agregar métricas
    const aggregated = {
      metricType: 'weekly',
      date: startDate,
      revenue: 0,
      costs: 0,
      profit: 0,
      orderCount: 0,
      syncedCount: 0,
      pendingCount: 0,
      shippedCount: 0,
      deliveredCount: 0,
      failedCount: 0,
      avgFulfillmentTime: 0,
      avgOrderValue: 0
    };

    let totalFulfillmentTime = 0;
    let fulfillmentDays = 0;

    for (const daily of dailyMetrics) {
      aggregated.revenue += parseFloat(daily.revenue) || 0;
      aggregated.costs += parseFloat(daily.costs) || 0;
      aggregated.profit += parseFloat(daily.profit) || 0;
      aggregated.orderCount += daily.orderCount || 0;
      aggregated.syncedCount += daily.syncedCount || 0;
      aggregated.pendingCount += daily.pendingCount || 0;
      aggregated.shippedCount += daily.shippedCount || 0;
      aggregated.deliveredCount += daily.deliveredCount || 0;
      aggregated.failedCount += daily.failedCount || 0;

      if (daily.avgFulfillmentTime > 0) {
        totalFulfillmentTime += daily.avgFulfillmentTime;
        fulfillmentDays++;
      }
    }

    // Calcular promedios
    aggregated.margin = aggregated.revenue > 0 ? (aggregated.profit / aggregated.revenue) * 100 : 0;
    aggregated.successRate = aggregated.orderCount > 0 ? 
      ((aggregated.syncedCount + aggregated.shippedCount + aggregated.deliveredCount) / aggregated.orderCount) * 100 : 0;
    aggregated.avgFulfillmentTime = fulfillmentDays > 0 ? totalFulfillmentTime / fulfillmentDays : 0;
    aggregated.avgOrderValue = aggregated.orderCount > 0 ? aggregated.revenue / aggregated.orderCount : 0;

    // Formatear valores
    aggregated.revenue = parseFloat(aggregated.revenue.toFixed(2));
    aggregated.costs = parseFloat(aggregated.costs.toFixed(2));
    aggregated.profit = parseFloat(aggregated.profit.toFixed(2));
    aggregated.margin = parseFloat(aggregated.margin.toFixed(2));
    aggregated.successRate = parseFloat(aggregated.successRate.toFixed(2));
    aggregated.avgFulfillmentTime = parseFloat(aggregated.avgFulfillmentTime.toFixed(2));
    aggregated.avgOrderValue = parseFloat(aggregated.avgOrderValue.toFixed(2));

    aggregated.metadata = {
      calculatedAt: new Date(),
      daysAggregated: dailyMetrics.length
    };

    // Upsert en AnalyticsCache
    await AnalyticsCache.upsert(aggregated);

    console.log(`✅ Métricas semanales agregadas (${dailyMetrics.length} días)`);
    return aggregated;

  } catch (error) {
    console.error('Error al agregar métricas semanales:', error);
    throw error;
  }
}

/**
 * Agrega métricas mensuales (últimos 30 días)
 * @returns {Object} Métricas agregadas
 */
export async function aggregateMonthlyMetrics() {
  try {
    const endDate = new Date();
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Consultar métricas diarias de los últimos 30 días
    const dailyMetrics = await AnalyticsCache.findAll({
      where: {
        metricType: 'daily',
        date: {
          [Op.between]: [startDate, endDate]
        }
      }
    });

    if (!dailyMetrics || dailyMetrics.length === 0) {
      console.log('No hay métricas diarias para agregar en monthly');
      return null;
    }

    // Agregar métricas (similar a weekly)
    const aggregated = {
      metricType: 'monthly',
      date: startDate,
      revenue: 0,
      costs: 0,
      profit: 0,
      orderCount: 0,
      syncedCount: 0,
      pendingCount: 0,
      shippedCount: 0,
      deliveredCount: 0,
      failedCount: 0,
      avgFulfillmentTime: 0,
      avgOrderValue: 0
    };

    let totalFulfillmentTime = 0;
    let fulfillmentDays = 0;

    for (const daily of dailyMetrics) {
      aggregated.revenue += parseFloat(daily.revenue) || 0;
      aggregated.costs += parseFloat(daily.costs) || 0;
      aggregated.profit += parseFloat(daily.profit) || 0;
      aggregated.orderCount += daily.orderCount || 0;
      aggregated.syncedCount += daily.syncedCount || 0;
      aggregated.pendingCount += daily.pendingCount || 0;
      aggregated.shippedCount += daily.shippedCount || 0;
      aggregated.deliveredCount += daily.deliveredCount || 0;
      aggregated.failedCount += daily.failedCount || 0;

      if (daily.avgFulfillmentTime > 0) {
        totalFulfillmentTime += daily.avgFulfillmentTime;
        fulfillmentDays++;
      }
    }

    // Calcular promedios
    aggregated.margin = aggregated.revenue > 0 ? (aggregated.profit / aggregated.revenue) * 100 : 0;
    aggregated.successRate = aggregated.orderCount > 0 ? 
      ((aggregated.syncedCount + aggregated.shippedCount + aggregated.deliveredCount) / aggregated.orderCount) * 100 : 0;
    aggregated.avgFulfillmentTime = fulfillmentDays > 0 ? totalFulfillmentTime / fulfillmentDays : 0;
    aggregated.avgOrderValue = aggregated.orderCount > 0 ? aggregated.revenue / aggregated.orderCount : 0;

    // Formatear valores
    aggregated.revenue = parseFloat(aggregated.revenue.toFixed(2));
    aggregated.costs = parseFloat(aggregated.costs.toFixed(2));
    aggregated.profit = parseFloat(aggregated.profit.toFixed(2));
    aggregated.margin = parseFloat(aggregated.margin.toFixed(2));
    aggregated.successRate = parseFloat(aggregated.successRate.toFixed(2));
    aggregated.avgFulfillmentTime = parseFloat(aggregated.avgFulfillmentTime.toFixed(2));
    aggregated.avgOrderValue = parseFloat(aggregated.avgOrderValue.toFixed(2));

    aggregated.metadata = {
      calculatedAt: new Date(),
      daysAggregated: dailyMetrics.length
    };

    // Upsert en AnalyticsCache
    await AnalyticsCache.upsert(aggregated);

    console.log(`✅ Métricas mensuales agregadas (${dailyMetrics.length} días)`);
    return aggregated;

  } catch (error) {
    console.error('Error al agregar métricas mensuales:', error);
    throw error;
  }
}

/**
 * Recalcula métricas para un rango de fechas específico
 * @param {Date} startDate - Fecha inicio
 * @param {Date} endDate - Fecha fin
 * @returns {Array} Resultados de cálculos
 */
export async function recalculateMetrics(startDate, endDate) {
  try {
    const results = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const metrics = await calculateDailyMetrics(new Date(currentDate));
      if (metrics) {
        results.push(metrics);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`✅ Recalculadas ${results.length} métricas diarias`);
    return results;

  } catch (error) {
    console.error('Error al recalcular métricas:', error);
    throw error;
  }
}
