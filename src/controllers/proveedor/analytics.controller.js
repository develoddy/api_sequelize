import { 
  calculateDailyMetrics, 
  aggregateWeeklyMetrics, 
  aggregateMonthlyMetrics,
  recalculateMetrics 
} from '../../services/analyticsCalculation.service.js';

import { 
  getPrintfulCostsFromWebhooks,
  calculateSaleCosts,
  getProductAverageCost,
  syncMissingCosts
} from '../../services/analyticsCost.service.js';

import { 
  getCachedMetrics, 
  getLatestMetric,
  getDashboardSummary,
  getProductAnalytics,
  getTopProducts,
  invalidateCache,
  cleanOldCache,
  compareMetrics
} from '../../services/analyticsCache.service.js';

import {
  generateMetricsReport,
  generateProductsReport,
  generateCostsReport,
  generateFulfillmentReport,
  generateFailuresReport,
  generateExecutiveReport
} from '../../services/analyticsReport.service.js';

import {
  exportMetricsToCSV,
  exportMetricsToExcel,
  exportProductsToCSV,
  exportProductsToExcel,
  exportCostsReport,
  exportFailedOrdersReport,
  cleanOldExports
} from '../../services/analyticsExport.service.js';

/**
 * Obtiene resumen general del dashboard
 * GET /api/analytics/dashboard
 */
export const getDashboard = async (req, res) => {
  try {
    const summary = await getDashboardSummary();

    res.status(200).json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Error en getDashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener resumen del dashboard',
      error: error.message
    });
  }
};

/**
 * Obtiene métricas por tipo y rango de fechas
 * GET /api/analytics/metrics?type=daily&startDate=2024-01-01&endDate=2024-01-31
 */
export const getMetrics = async (req, res) => {
  try {
    const { type = 'daily', startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const metrics = await getCachedMetrics(type, start, end);

    res.status(200).json({
      success: true,
      data: metrics,
      count: metrics.length
    });

  } catch (error) {
    console.error('Error en getMetrics:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener métricas',
      error: error.message
    });
  }
};

/**
 * Obtiene la métrica más reciente de un tipo
 * GET /api/analytics/latest/:type
 */
export const getLatest = async (req, res) => {
  try {
    const { type } = req.params;

    const metric = await getLatestMetric(type);

    if (!metric) {
      return res.status(404).json({
        success: false,
        message: `No se encontraron métricas de tipo ${type}`
      });
    }

    res.status(200).json({
      success: true,
      data: metric
    });

  } catch (error) {
    console.error('Error en getLatest:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener métrica más reciente',
      error: error.message
    });
  }
};

/**
 * Calcula métricas manualmente
 * POST /api/analytics/calculate
 * Body: { type: 'daily', date: '2024-01-01' }
 */
export const calculateMetrics = async (req, res) => {
  try {
    const { type = 'daily', date } = req.body;

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
        return res.status(400).json({
          success: false,
          message: 'Tipo de métrica no válido. Use: daily, weekly, monthly'
        });
    }

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron datos para calcular métricas'
      });
    }

    res.status(200).json({
      success: true,
      message: `Métricas ${type} calculadas correctamente`,
      data: result
    });

  } catch (error) {
    console.error('Error en calculateMetrics:', error);
    res.status(500).json({
      success: false,
      message: 'Error al calcular métricas',
      error: error.message
    });
  }
};

/**
 * Recalcula métricas para un rango de fechas
 * POST /api/analytics/recalculate
 * Body: { startDate: '2024-01-01', endDate: '2024-01-31' }
 */
export const recalculate = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren startDate y endDate'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const results = await recalculateMetrics(start, end);

    res.status(200).json({
      success: true,
      message: `Recalculadas ${results.length} métricas`,
      data: results
    });

  } catch (error) {
    console.error('Error en recalculate:', error);
    res.status(500).json({
      success: false,
      message: 'Error al recalcular métricas',
      error: error.message
    });
  }
};

/**
 * Obtiene analytics de productos
 * GET /api/analytics/products?productId=123&startDate=2024-01-01&limit=50
 */
export const getProducts = async (req, res) => {
  try {
    const { productId, startDate, endDate, limit } = req.query;

    const filters = {
      productId: productId ? parseInt(productId) : null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      limit: limit ? parseInt(limit) : 100
    };

    const analytics = await getProductAnalytics(filters);

    res.status(200).json({
      success: true,
      data: analytics,
      count: analytics.length
    });

  } catch (error) {
    console.error('Error en getProducts:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener analytics de productos',
      error: error.message
    });
  }
};

/**
 * Obtiene top productos por revenue
 * GET /api/analytics/top-products?startDate=2024-01-01&endDate=2024-01-31&limit=10
 */
export const getTopProductsList = async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren startDate y endDate'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const topProducts = await getTopProducts(start, end, parseInt(limit));

    res.status(200).json({
      success: true,
      data: topProducts,
      count: topProducts.length
    });

  } catch (error) {
    console.error('Error en getTopProductsList:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener top productos',
      error: error.message
    });
  }
};

/**
 * Obtiene costos de Printful desde webhooks
 * GET /api/analytics/costs?startDate=2024-01-01&endDate=2024-01-31
 */
export const getCosts = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren startDate y endDate'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const costs = await getPrintfulCostsFromWebhooks(start, end);

    res.status(200).json({
      success: true,
      data: costs
    });

  } catch (error) {
    console.error('Error en getCosts:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener costos',
      error: error.message
    });
  }
};

/**
 * Obtiene costos de una venta específica
 * GET /api/analytics/sale-costs/:saleId
 */
export const getSaleCosts = async (req, res) => {
  try {
    const { saleId } = req.params;

    const costs = await calculateSaleCosts(parseInt(saleId));

    res.status(200).json({
      success: true,
      data: costs
    });

  } catch (error) {
    console.error('Error en getSaleCosts:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener costos de la venta',
      error: error.message
    });
  }
};

/**
 * Obtiene costo promedio de un producto
 * GET /api/analytics/product-cost/:productId?days=30
 */
export const getProductCost = async (req, res) => {
  try {
    const { productId } = req.params;
    const { days = 30 } = req.query;

    const costData = await getProductAverageCost(parseInt(productId), parseInt(days));

    res.status(200).json({
      success: true,
      data: costData
    });

  } catch (error) {
    console.error('Error en getProductCost:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener costo del producto',
      error: error.message
    });
  }
};

/**
 * Sincroniza costos faltantes desde Printful API
 * POST /api/analytics/sync-costs
 * Body: { limit: 50 }
 */
export const syncCosts = async (req, res) => {
  try {
    const { limit = 50 } = req.body;

    const result = await syncMissingCosts(parseInt(limit));

    res.status(200).json({
      success: true,
      message: `Sincronizados ${result.synced} costos`,
      data: result
    });

  } catch (error) {
    console.error('Error en syncCosts:', error);
    res.status(500).json({
      success: false,
      message: 'Error al sincronizar costos',
      error: error.message
    });
  }
};

/**
 * Compara métricas entre dos períodos
 * POST /api/analytics/compare
 * Body: { type, currentStart, currentEnd, previousStart, previousEnd }
 */
export const compare = async (req, res) => {
  try {
    const { type = 'daily', currentStart, currentEnd, previousStart, previousEnd } = req.body;

    if (!currentStart || !currentEnd || !previousStart || !previousEnd) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren todas las fechas: currentStart, currentEnd, previousStart, previousEnd'
      });
    }

    const comparison = await compareMetrics(
      type,
      new Date(currentStart),
      new Date(currentEnd),
      new Date(previousStart),
      new Date(previousEnd)
    );

    res.status(200).json({
      success: true,
      data: comparison
    });

  } catch (error) {
    console.error('Error en compare:', error);
    res.status(500).json({
      success: false,
      message: 'Error al comparar métricas',
      error: error.message
    });
  }
};

/**
 * Invalida cache de métricas
 * DELETE /api/analytics/cache?type=daily&startDate=2024-01-01
 */
export const invalidateCacheEndpoint = async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const deleted = await invalidateCache(type, start, end);

    res.status(200).json({
      success: true,
      message: `Invalidadas ${deleted} métricas`,
      deleted
    });

  } catch (error) {
    console.error('Error en invalidateCacheEndpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Error al invalidar cache',
      error: error.message
    });
  }
};

/**
 * Limpia cache antiguo
 * POST /api/analytics/clean-cache
 * Body: { daysToKeep: 90 }
 */
export const cleanCache = async (req, res) => {
  try {
    const { daysToKeep = 90 } = req.body;

    const deleted = await cleanOldCache(parseInt(daysToKeep));

    res.status(200).json({
      success: true,
      message: `Limpiadas ${deleted} métricas antiguas`,
      deleted
    });

  } catch (error) {
    console.error('Error en cleanCache:', error);
    res.status(500).json({
      success: false,
      message: 'Error al limpiar cache',
      error: error.message
    });
  }
};

/**
 * EXPORT ENDPOINTS
 */

/**
 * Exporta métricas a CSV o Excel
 * POST /api/analytics/export/metrics
 * Body: { type: 'daily', startDate, endDate, format: 'csv'|'excel' }
 */
export const exportMetrics = async (req, res) => {
  try {
    const { type = 'daily', startDate, endDate, format = 'csv' } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren startDate y endDate'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const metrics = await getCachedMetrics(type, start, end);

    if (!metrics || metrics.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No hay datos para exportar'
      });
    }

    const filename = `metrics_${type}_${startDate}_${endDate}.${format === 'excel' ? 'xlsx' : 'csv'}`;
    let filepath;

    if (format === 'excel') {
      filepath = await exportMetricsToExcel(metrics, filename);
    } else {
      filepath = await exportMetricsToCSV(metrics, filename);
    }

    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Error enviando archivo:', err);
        res.status(500).json({
          success: false,
          message: 'Error al descargar archivo',
          error: err.message
        });
      }
    });

  } catch (error) {
    console.error('Error en exportMetrics:', error);
    res.status(500).json({
      success: false,
      message: 'Error al exportar métricas',
      error: error.message
    });
  }
};

/**
 * Exporta analytics de productos
 * POST /api/analytics/export/products
 * Body: { startDate, endDate, limit, format: 'csv'|'excel' }
 */
export const exportProducts = async (req, res) => {
  try {
    const { startDate, endDate, limit = 100, format = 'csv' } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren startDate y endDate'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const products = await getProductAnalytics({
      startDate: start,
      endDate: end,
      limit: parseInt(limit)
    });

    if (!products || products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No hay datos de productos para exportar'
      });
    }

    const filename = `products_${startDate}_${endDate}.${format === 'excel' ? 'xlsx' : 'csv'}`;
    let filepath;

    if (format === 'excel') {
      filepath = await exportProductsToExcel(products, filename);
    } else {
      filepath = await exportProductsToCSV(products, filename);
    }

    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Error enviando archivo:', err);
        res.status(500).json({
          success: false,
          message: 'Error al descargar archivo',
          error: err.message
        });
      }
    });

  } catch (error) {
    console.error('Error en exportProducts:', error);
    res.status(500).json({
      success: false,
      message: 'Error al exportar productos',
      error: error.message
    });
  }
};

/**
 * Exporta reporte de costos
 * POST /api/analytics/export/costs
 * Body: { startDate, endDate }
 */
export const exportCosts = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren startDate y endDate'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const costsData = await getPrintfulCostsFromWebhooks(start, end);

    if (!costsData || costsData.ordersProcessed === 0) {
      return res.status(404).json({
        success: false,
        message: 'No hay datos de costos para exportar'
      });
    }

    const filename = `costs_${startDate}_${endDate}.xlsx`;
    const filepath = await exportCostsReport(costsData, filename);

    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Error enviando archivo:', err);
        res.status(500).json({
          success: false,
          message: 'Error al descargar archivo',
          error: err.message
        });
      }
    });

  } catch (error) {
    console.error('Error en exportCosts:', error);
    res.status(500).json({
      success: false,
      message: 'Error al exportar costos',
      error: error.message
    });
  }
};

/**
 * Exporta reporte de fulfillment
 * POST /api/analytics/export/fulfillment
 * Body: { type, startDate, endDate, format }
 */
export const exportFulfillment = async (req, res) => {
  try {
    const { type = 'daily', startDate, endDate, format = 'excel' } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren startDate y endDate'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const report = await generateFulfillmentReport(type, start, end);

    if (!report.success) {
      return res.status(404).json(report);
    }

    // Convertir reporte a formato exportable
    const metrics = report.data.successRates.map(sr => ({
      date: sr.date,
      metricType: type,
      revenue: 0,
      costs: 0,
      profit: 0,
      margin: 0,
      orderCount: sr.orders,
      syncedCount: sr.successful,
      pendingCount: 0,
      shippedCount: 0,
      deliveredCount: 0,
      failedCount: sr.failed,
      successRate: sr.successRate,
      avgFulfillmentTime: report.data.summary.avgFulfillmentTime,
      avgOrderValue: 0
    }));

    const filename = `fulfillment_${type}_${startDate}_${endDate}.${format === 'excel' ? 'xlsx' : 'csv'}`;
    let filepath;

    if (format === 'excel') {
      filepath = await exportMetricsToExcel(metrics, filename);
    } else {
      filepath = await exportMetricsToCSV(metrics, filename);
    }

    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Error enviando archivo:', err);
        res.status(500).json({
          success: false,
          message: 'Error al descargar archivo',
          error: err.message
        });
      }
    });

  } catch (error) {
    console.error('Error en exportFulfillment:', error);
    res.status(500).json({
      success: false,
      message: 'Error al exportar fulfillment',
      error: error.message
    });
  }
};

/**
 * Exporta reporte de órdenes fallidas
 * POST /api/analytics/export/failures
 * Body: { errorType, status, limit }
 */
export const exportFailures = async (req, res) => {
  try {
    const { errorType, status, limit = 500 } = req.body;

    const filters = {
      errorType: errorType || null,
      status: status || null,
      limit: parseInt(limit)
    };

    const report = await generateFailuresReport(filters);

    if (!report.success) {
      return res.status(404).json(report);
    }

    const filename = `failed_orders_${new Date().toISOString().split('T')[0]}.xlsx`;
    const filepath = await exportFailedOrdersReport(report.data.failedOrders, filename);

    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Error enviando archivo:', err);
        res.status(500).json({
          success: false,
          message: 'Error al descargar archivo',
          error: err.message
        });
      }
    });

  } catch (error) {
    console.error('Error en exportFailures:', error);
    res.status(500).json({
      success: false,
      message: 'Error al exportar fallos',
      error: error.message
    });
  }
};

/**
 * Obtiene reporte ejecutivo (para vista previa, no descarga)
 * POST /api/analytics/reports/executive
 * Body: { startDate, endDate }
 */
export const getExecutiveReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren startDate y endDate'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const report = await generateExecutiveReport(start, end);

    res.status(200).json(report);

  } catch (error) {
    console.error('Error en getExecutiveReport:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar reporte ejecutivo',
      error: error.message
    });
  }
};

/**
 * Limpia archivos de exportación antiguos
 * POST /api/analytics/export/clean
 * Body: { days: 7 }
 */
export const cleanExports = async (req, res) => {
  try {
    const { days = 7 } = req.body;

    const deleted = await cleanOldExports(parseInt(days));

    res.status(200).json({
      success: true,
      message: `Limpiados ${deleted} archivos de exportación`,
      deleted
    });

  } catch (error) {
    console.error('Error en cleanExports:', error);
    res.status(500).json({
      success: false,
      message: 'Error al limpiar exportaciones',
      error: error.message
    });
  }
};
