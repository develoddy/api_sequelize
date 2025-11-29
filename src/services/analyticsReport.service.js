import { 
  getCachedMetrics,
  getProductAnalytics,
  getTopProducts
} from './analyticsCache.service.js';

import { 
  getPrintfulCostsFromWebhooks
} from './analyticsCost.service.js';

import { 
  getFailedJobs 
} from './retryQueue.service.js';

/**
 * Genera reporte completo de métricas para un período
 * @param {string} metricType - Tipo de métrica (daily, weekly, monthly)
 * @param {Date} startDate - Fecha inicio
 * @param {Date} endDate - Fecha fin
 * @returns {Object} Reporte estructurado
 */
export async function generateMetricsReport(metricType, startDate, endDate) {
  try {
    const metrics = await getCachedMetrics(metricType, startDate, endDate);

    if (!metrics || metrics.length === 0) {
      return {
        success: false,
        message: 'No hay datos disponibles para el período seleccionado',
        data: null
      };
    }

    // Calcular totales
    const totals = metrics.reduce((acc, m) => {
      acc.revenue += parseFloat(m.revenue) || 0;
      acc.costs += parseFloat(m.costs) || 0;
      acc.profit += parseFloat(m.profit) || 0;
      acc.orders += m.orderCount || 0;
      acc.synced += m.syncedCount || 0;
      acc.pending += m.pendingCount || 0;
      acc.shipped += m.shippedCount || 0;
      acc.delivered += m.deliveredCount || 0;
      acc.failed += m.failedCount || 0;
      return acc;
    }, {
      revenue: 0,
      costs: 0,
      profit: 0,
      orders: 0,
      synced: 0,
      pending: 0,
      shipped: 0,
      delivered: 0,
      failed: 0
    });

    // Calcular promedios
    const count = metrics.length;
    const avgMargin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;
    const avgSuccessRate = totals.orders > 0 ? 
      ((totals.synced + totals.shipped + totals.delivered) / totals.orders) * 100 : 0;
    const avgOrderValue = totals.orders > 0 ? totals.revenue / totals.orders : 0;

    return {
      success: true,
      data: {
        period: {
          type: metricType,
          startDate,
          endDate,
          daysIncluded: count
        },
        summary: {
          totalRevenue: parseFloat(totals.revenue.toFixed(2)),
          totalCosts: parseFloat(totals.costs.toFixed(2)),
          totalProfit: parseFloat(totals.profit.toFixed(2)),
          avgMargin: parseFloat(avgMargin.toFixed(2)),
          totalOrders: totals.orders,
          avgSuccessRate: parseFloat(avgSuccessRate.toFixed(2)),
          avgOrderValue: parseFloat(avgOrderValue.toFixed(2))
        },
        ordersByStatus: {
          synced: totals.synced,
          pending: totals.pending,
          shipped: totals.shipped,
          delivered: totals.delivered,
          failed: totals.failed
        },
        metrics,
        generatedAt: new Date()
      }
    };

  } catch (error) {
    console.error('Error generando reporte de métricas:', error);
    throw error;
  }
}

/**
 * Genera reporte de productos con mejor y peor performance
 * @param {Date} startDate - Fecha inicio
 * @param {Date} endDate - Fecha fin
 * @param {number} limit - Límite de productos
 * @returns {Object} Reporte de productos
 */
export async function generateProductsReport(startDate, endDate, limit = 50) {
  try {
    const products = await getProductAnalytics({
      startDate,
      endDate,
      limit
    });

    if (!products || products.length === 0) {
      return {
        success: false,
        message: 'No hay datos de productos para el período seleccionado',
        data: null
      };
    }

    // Agrupar por producto y sumar métricas
    const productMap = {};

    products.forEach(p => {
      const id = p.productId;
      if (!productMap[id]) {
        productMap[id] = {
          productId: id,
          productName: p.product?.titulo || 'Unknown',
          totalUnits: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0,
          totalOrders: 0
        };
      }

      productMap[id].totalUnits += p.unitsSold || 0;
      productMap[id].totalRevenue += parseFloat(p.revenue) || 0;
      productMap[id].totalCost += parseFloat(p.printfulCost) || 0;
      productMap[id].totalProfit += parseFloat(p.profit) || 0;
      productMap[id].totalOrders += p.orderCount || 0;
    });

    // Convertir a array y calcular métricas adicionales
    const productsArray = Object.values(productMap).map(p => ({
      ...p,
      avgMargin: p.totalRevenue > 0 ? (p.totalProfit / p.totalRevenue) * 100 : 0,
      avgPrice: p.totalUnits > 0 ? p.totalRevenue / p.totalUnits : 0,
      totalRevenue: parseFloat(p.totalRevenue.toFixed(2)),
      totalCost: parseFloat(p.totalCost.toFixed(2)),
      totalProfit: parseFloat(p.totalProfit.toFixed(2))
    }));

    // Ordenar por revenue
    productsArray.sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Top performers (mejores por revenue)
    const topPerformers = productsArray.slice(0, 10);

    // Low performers (peores por revenue)
    const lowPerformers = productsArray.slice(-10).reverse();

    // Mejor margen
    const bestMargin = [...productsArray].sort((a, b) => b.avgMargin - a.avgMargin).slice(0, 10);

    // Más vendidos (por unidades)
    const mostSold = [...productsArray].sort((a, b) => b.totalUnits - a.totalUnits).slice(0, 10);

    // Calcular totales
    const totals = productsArray.reduce((acc, p) => {
      acc.revenue += p.totalRevenue;
      acc.cost += p.totalCost;
      acc.profit += p.totalProfit;
      acc.units += p.totalUnits;
      acc.orders += p.totalOrders;
      return acc;
    }, { revenue: 0, cost: 0, profit: 0, units: 0, orders: 0 });

    return {
      success: true,
      data: {
        period: { startDate, endDate },
        summary: {
          totalProducts: productsArray.length,
          totalRevenue: parseFloat(totals.revenue.toFixed(2)),
          totalCost: parseFloat(totals.cost.toFixed(2)),
          totalProfit: parseFloat(totals.profit.toFixed(2)),
          totalUnits: totals.units,
          totalOrders: totals.orders,
          avgMargin: totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0
        },
        topPerformers,
        lowPerformers,
        bestMargin,
        mostSold,
        allProducts: productsArray,
        generatedAt: new Date()
      }
    };

  } catch (error) {
    console.error('Error generando reporte de productos:', error);
    throw error;
  }
}

/**
 * Genera reporte de costos detallado
 * @param {Date} startDate - Fecha inicio
 * @param {Date} endDate - Fecha fin
 * @returns {Object} Reporte de costos
 */
export async function generateCostsReport(startDate, endDate) {
  try {
    const costsData = await getPrintfulCostsFromWebhooks(startDate, endDate);

    if (!costsData || costsData.ordersProcessed === 0) {
      return {
        success: false,
        message: 'No hay datos de costos para el período seleccionado',
        data: null
      };
    }

    // Análisis de costos por producto
    const productCostsArray = Object.entries(costsData.productCosts || {})
      .map(([productId, cost]) => ({
        productId,
        totalCost: parseFloat(cost.toFixed(2))
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    // Análisis de costos por orden
    const orderCostsArray = Object.entries(costsData.orderCosts || {})
      .map(([orderId, data]) => ({
        orderId,
        totalCost: data.cost,
        shipping: data.shipping,
        tax: data.tax,
        items: data.items?.length || 0
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    // Promedios
    const avgOrderCost = costsData.ordersProcessed > 0 ? 
      costsData.totalCosts / costsData.ordersProcessed : 0;
    const avgShippingCost = costsData.ordersProcessed > 0 ? 
      costsData.totalShipping / costsData.ordersProcessed : 0;

    return {
      success: true,
      data: {
        period: { startDate, endDate },
        summary: {
          totalCosts: parseFloat(costsData.totalCosts.toFixed(2)),
          totalShipping: parseFloat(costsData.totalShipping.toFixed(2)),
          totalTax: parseFloat(costsData.totalTax.toFixed(2)),
          ordersProcessed: costsData.ordersProcessed,
          webhooksAnalyzed: costsData.webhooksAnalyzed,
          avgOrderCost: parseFloat(avgOrderCost.toFixed(2)),
          avgShippingCost: parseFloat(avgShippingCost.toFixed(2))
        },
        productCosts: productCostsArray,
        orderCosts: orderCostsArray,
        rawData: costsData,
        generatedAt: new Date()
      }
    };

  } catch (error) {
    console.error('Error generando reporte de costos:', error);
    throw error;
  }
}

/**
 * Genera reporte de fulfillment (tiempos, tasas de éxito, problemas)
 * @param {string} metricType - Tipo de métrica
 * @param {Date} startDate - Fecha inicio
 * @param {Date} endDate - Fecha fin
 * @returns {Object} Reporte de fulfillment
 */
export async function generateFulfillmentReport(metricType, startDate, endDate) {
  try {
    const metrics = await getCachedMetrics(metricType, startDate, endDate);

    if (!metrics || metrics.length === 0) {
      return {
        success: false,
        message: 'No hay datos de fulfillment para el período seleccionado',
        data: null
      };
    }

    // Análisis de tiempos de fulfillment
    const fulfillmentTimes = metrics
      .filter(m => m.avgFulfillmentTime > 0)
      .map(m => ({
        date: m.date,
        avgTime: m.avgFulfillmentTime,
        orderCount: m.orderCount
      }));

    const avgFulfillmentTime = fulfillmentTimes.length > 0 ?
      fulfillmentTimes.reduce((sum, m) => sum + m.avgTime, 0) / fulfillmentTimes.length : 0;

    // Análisis de tasas de éxito
    const successRates = metrics.map(m => ({
      date: m.date,
      successRate: m.successRate,
      orders: m.orderCount,
      successful: m.syncedCount + m.shippedCount + m.deliveredCount,
      failed: m.failedCount
    }));

    const avgSuccessRate = successRates.length > 0 ?
      successRates.reduce((sum, m) => sum + m.successRate, 0) / successRates.length : 0;

    // Totales por estado
    const totals = metrics.reduce((acc, m) => {
      acc.synced += m.syncedCount || 0;
      acc.pending += m.pendingCount || 0;
      acc.shipped += m.shippedCount || 0;
      acc.delivered += m.deliveredCount || 0;
      acc.failed += m.failedCount || 0;
      acc.total += m.orderCount || 0;
      return acc;
    }, { synced: 0, pending: 0, shipped: 0, delivered: 0, failed: 0, total: 0 });

    // Distribución porcentual
    const distribution = {
      synced: totals.total > 0 ? (totals.synced / totals.total) * 100 : 0,
      pending: totals.total > 0 ? (totals.pending / totals.total) * 100 : 0,
      shipped: totals.total > 0 ? (totals.shipped / totals.total) * 100 : 0,
      delivered: totals.total > 0 ? (totals.delivered / totals.total) * 100 : 0,
      failed: totals.total > 0 ? (totals.failed / totals.total) * 100 : 0
    };

    return {
      success: true,
      data: {
        period: { type: metricType, startDate, endDate },
        summary: {
          avgFulfillmentTime: parseFloat(avgFulfillmentTime.toFixed(2)),
          avgSuccessRate: parseFloat(avgSuccessRate.toFixed(2)),
          totalOrders: totals.total,
          successfulOrders: totals.synced + totals.shipped + totals.delivered,
          failedOrders: totals.failed
        },
        ordersByStatus: totals,
        statusDistribution: {
          synced: parseFloat(distribution.synced.toFixed(2)),
          pending: parseFloat(distribution.pending.toFixed(2)),
          shipped: parseFloat(distribution.shipped.toFixed(2)),
          delivered: parseFloat(distribution.delivered.toFixed(2)),
          failed: parseFloat(distribution.failed.toFixed(2))
        },
        fulfillmentTimes,
        successRates,
        generatedAt: new Date()
      }
    };

  } catch (error) {
    console.error('Error generando reporte de fulfillment:', error);
    throw error;
  }
}

/**
 * Genera reporte de órdenes fallidas con análisis de errores
 * @param {Object} filters - Filtros para órdenes fallidas
 * @returns {Object} Reporte de fallos
 */
export async function generateFailuresReport(filters = {}) {
  try {
    const failedOrders = await getFailedJobs(filters);

    if (!failedOrders || failedOrders.length === 0) {
      return {
        success: false,
        message: 'No hay órdenes fallidas para el período seleccionado',
        data: null
      };
    }

    // Análisis por tipo de error
    const errorTypes = {};
    const errorCodes = {};
    const statusCounts = {};

    failedOrders.forEach(order => {
      // Por tipo de error
      const type = order.errorType || 'unknown';
      errorTypes[type] = (errorTypes[type] || 0) + 1;

      // Por código de error
      const code = order.errorCode || 'unknown';
      errorCodes[code] = (errorCodes[code] || 0) + 1;

      // Por estado
      const status = order.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    // Análisis de intentos
    const attemptStats = failedOrders.reduce((acc, order) => {
      const attempts = order.attemptCount || 0;
      acc.total += attempts;
      acc.maxReached += attempts >= (order.maxAttempts || 3) ? 1 : 0;
      return acc;
    }, { total: 0, maxReached: 0 });

    // Errores más comunes
    const topErrors = Object.entries(errorCodes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code, count]) => ({ code, count }));

    return {
      success: true,
      data: {
        summary: {
          totalFailures: failedOrders.length,
          errorTypes: Object.keys(errorTypes).length,
          errorCodes: Object.keys(errorCodes).length,
          avgAttempts: failedOrders.length > 0 ? attemptStats.total / failedOrders.length : 0,
          maxAttemptsReached: attemptStats.maxReached
        },
        errorsByType: errorTypes,
        errorsByCode: errorCodes,
        ordersByStatus: statusCounts,
        topErrors,
        failedOrders: failedOrders.map(order => ({
          id: order.id,
          saleId: order.saleId,
          errorType: order.errorType,
          errorCode: order.errorCode,
          errorMessage: order.errorMessage,
          status: order.status,
          attemptCount: order.attemptCount,
          createdAt: order.createdAt,
          nextRetryAt: order.nextRetryAt
        })),
        generatedAt: new Date()
      }
    };

  } catch (error) {
    console.error('Error generando reporte de fallos:', error);
    throw error;
  }
}

/**
 * Genera reporte ejecutivo completo (resumen general)
 * @param {Date} startDate - Fecha inicio
 * @param {Date} endDate - Fecha fin
 * @returns {Object} Reporte ejecutivo
 */
export async function generateExecutiveReport(startDate, endDate) {
  try {
    const [
      metricsReport,
      productsReport,
      costsReport,
      fulfillmentReport
    ] = await Promise.all([
      generateMetricsReport('daily', startDate, endDate),
      generateProductsReport(startDate, endDate, 10),
      generateCostsReport(startDate, endDate),
      generateFulfillmentReport('daily', startDate, endDate)
    ]);

    return {
      success: true,
      data: {
        period: { startDate, endDate },
        metrics: metricsReport.data || null,
        products: productsReport.data || null,
        costs: costsReport.data || null,
        fulfillment: fulfillmentReport.data || null,
        generatedAt: new Date()
      }
    };

  } catch (error) {
    console.error('Error generando reporte ejecutivo:', error);
    throw error;
  }
}
