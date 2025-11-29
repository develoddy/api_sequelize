import AnalyticsCache from '../models/AnalyticsCache.js';
import ProductAnalytics from '../models/ProductAnalytics.js';
import { Product } from '../models/Product.js';
import { Op } from 'sequelize';

/**
 * Obtiene métricas cacheadas por tipo y rango de fechas
 * @param {string} metricType - Tipo de métrica: 'daily', 'weekly', 'monthly', 'yearly'
 * @param {Date} startDate - Fecha inicio (opcional)
 * @param {Date} endDate - Fecha fin (opcional)
 * @returns {Array} Métricas cacheadas
 */
export async function getCachedMetrics(metricType, startDate = null, endDate = null) {
  try {
    const whereClause = { metricType };

    // Si se proporcionan fechas, filtrar por rango
    if (startDate && endDate) {
      whereClause.date = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      whereClause.date = {
        [Op.gte]: startDate
      };
    } else if (endDate) {
      whereClause.date = {
        [Op.lte]: endDate
      };
    }

    const metrics = await AnalyticsCache.findAll({
      where: whereClause,
      order: [['date', 'DESC']]
    });

    return metrics;

  } catch (error) {
    console.error('Error al obtener métricas cacheadas:', error);
    throw error;
  }
}

/**
 * Obtiene la métrica más reciente de un tipo específico
 * @param {string} metricType - Tipo de métrica
 * @returns {Object|null} Métrica más reciente
 */
export async function getLatestMetric(metricType) {
  try {
    const metric = await AnalyticsCache.findOne({
      where: { metricType },
      order: [['date', 'DESC']]
    });

    return metric;

  } catch (error) {
    console.error('Error al obtener métrica más reciente:', error);
    throw error;
  }
}

/**
 * Obtiene métricas para un dashboard resumen
 * @returns {Object} Resumen de métricas (daily, weekly, monthly)
 */
export async function getDashboardSummary() {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Obtener métricas más recientes de cada tipo
    const [daily, weekly, monthly] = await Promise.all([
      getLatestMetric('daily'),
      getLatestMetric('weekly'),
      getLatestMetric('monthly')
    ]);

    // Top productos del último período mensual
    const topProducts = monthly?.topProducts || [];

    // Comparar con período anterior para calcular tendencias
    const previousMonth = new Date(today);
    previousMonth.setMonth(previousMonth.getMonth() - 1);

    const previousMonthlyMetric = await AnalyticsCache.findOne({
      where: {
        metricType: 'monthly',
        date: {
          [Op.lt]: monthly?.date || today
        }
      },
      order: [['date', 'DESC']]
    });

    // Calcular tendencias (% cambio)
    const trends = {
      revenue: calculateTrend(monthly?.revenue, previousMonthlyMetric?.revenue),
      profit: calculateTrend(monthly?.profit, previousMonthlyMetric?.profit),
      orders: calculateTrend(monthly?.orderCount, previousMonthlyMetric?.orderCount),
      successRate: calculateTrend(monthly?.successRate, previousMonthlyMetric?.successRate)
    };

    return {
      current: {
        daily: daily ? formatMetric(daily) : null,
        weekly: weekly ? formatMetric(weekly) : null,
        monthly: monthly ? formatMetric(monthly) : null
      },
      trends,
      topProducts,
      lastUpdated: new Date()
    };

  } catch (error) {
    console.error('Error al obtener resumen de dashboard:', error);
    throw error;
  }
}

/**
 * Calcula tendencia porcentual entre dos valores
 * @param {number} current - Valor actual
 * @param {number} previous - Valor anterior
 * @returns {number} Porcentaje de cambio
 */
function calculateTrend(current, previous) {
  if (!previous || previous === 0) return 0;
  const change = ((current - previous) / previous) * 100;
  return parseFloat(change.toFixed(2));
}

/**
 * Formatea una métrica para respuesta API
 * @param {Object} metric - Objeto de métrica
 * @returns {Object} Métrica formateada
 */
function formatMetric(metric) {
  return {
    date: metric.date,
    revenue: metric.revenue,
    costs: metric.costs,
    profit: metric.profit,
    margin: metric.margin,
    orders: metric.orderCount,
    successRate: metric.successRate,
    avgOrderValue: metric.avgOrderValue,
    avgFulfillmentTime: metric.avgFulfillmentTime
  };
}

/**
 * Obtiene analytics por producto con filtros
 * @param {Object} filters - Filtros: productId, startDate, endDate, limit
 * @returns {Array} Analytics de productos
 */
export async function getProductAnalytics(filters = {}) {
  try {
    const whereClause = {};

    if (filters.productId) {
      whereClause.productId = filters.productId;
    }

    if (filters.startDate && filters.endDate) {
      whereClause.date = {
        [Op.between]: [filters.startDate, filters.endDate]
      };
    } else if (filters.startDate) {
      whereClause.date = {
        [Op.gte]: filters.startDate
      };
    }

    const analytics = await ProductAnalytics.findAll({
      where: whereClause,
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'titulo', 'slug', 'imagen']
        }
      ],
      order: [['date', 'DESC']],
      limit: filters.limit || 100
    });

    return analytics;

  } catch (error) {
    console.error('Error al obtener analytics de productos:', error);
    throw error;
  }
}

/**
 * Obtiene top productos por revenue en un período
 * @param {Date} startDate - Fecha inicio
 * @param {Date} endDate - Fecha fin
 * @param {number} limit - Número de productos (default 10)
 * @returns {Array} Top productos
 */
export async function getTopProducts(startDate, endDate, limit = 10) {
  try {
    const { sequelize } = ProductAnalytics;

    const topProducts = await ProductAnalytics.findAll({
      attributes: [
        'productId',
        [sequelize.fn('SUM', sequelize.col('unitsSold')), 'totalUnits'],
        [sequelize.fn('SUM', sequelize.col('revenue')), 'totalRevenue'],
        [sequelize.fn('SUM', sequelize.col('profit')), 'totalProfit'],
        [sequelize.fn('AVG', sequelize.col('margin')), 'avgMargin']
      ],
      where: {
        date: {
          [Op.between]: [startDate, endDate]
        }
      },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'titulo', 'slug', 'imagen', 'categoria']
        }
      ],
      group: ['productId'],
      order: [[sequelize.fn('SUM', sequelize.col('revenue')), 'DESC']],
      limit,
      raw: false,
      subQuery: false
    });

    return topProducts.map(p => ({
      productId: p.productId,
      product: p.product,
      totalUnits: parseInt(p.dataValues.totalUnits) || 0,
      totalRevenue: parseFloat(parseFloat(p.dataValues.totalRevenue).toFixed(2)),
      totalProfit: parseFloat(parseFloat(p.dataValues.totalProfit).toFixed(2)),
      avgMargin: parseFloat(parseFloat(p.dataValues.avgMargin).toFixed(2))
    }));

  } catch (error) {
    console.error('Error al obtener top productos:', error);
    throw error;
  }
}

/**
 * Actualiza o crea una entrada de cache
 * @param {Object} metricData - Datos de la métrica
 * @returns {Object} Métrica actualizada
 */
export async function updateCache(metricData) {
  try {
    const [metric, created] = await AnalyticsCache.upsert(metricData, {
      returning: true
    });

    console.log(`${created ? 'Creada' : 'Actualizada'} métrica ${metricData.metricType} para ${metricData.date}`);
    return metric;

  } catch (error) {
    console.error('Error al actualizar cache:', error);
    throw error;
  }
}

/**
 * Invalida (elimina) métricas cacheadas por tipo y rango de fechas
 * @param {string} metricType - Tipo de métrica
 * @param {Date} startDate - Fecha inicio (opcional)
 * @param {Date} endDate - Fecha fin (opcional)
 * @returns {number} Número de registros eliminados
 */
export async function invalidateCache(metricType, startDate = null, endDate = null) {
  try {
    const whereClause = {};

    if (metricType) {
      whereClause.metricType = metricType;
    }

    if (startDate && endDate) {
      whereClause.date = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      whereClause.date = {
        [Op.gte]: startDate
      };
    }

    const deleted = await AnalyticsCache.destroy({
      where: whereClause
    });

    console.log(`🗑️  Invalidadas ${deleted} métricas de cache`);
    return deleted;

  } catch (error) {
    console.error('Error al invalidar cache:', error);
    throw error;
  }
}

/**
 * Limpia métricas cacheadas antiguas (más de X días)
 * @param {number} daysToKeep - Días de retención (default 90)
 * @returns {number} Registros eliminados
 */
export async function cleanOldCache(daysToKeep = 90) {
  try {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    const deleted = await AnalyticsCache.destroy({
      where: {
        date: {
          [Op.lt]: cutoffDate
        },
        metricType: 'daily' // Solo eliminar métricas diarias antiguas
      }
    });

    console.log(`🗑️  Limpiadas ${deleted} métricas antiguas (>${daysToKeep} días)`);
    return deleted;

  } catch (error) {
    console.error('Error al limpiar cache antiguo:', error);
    throw error;
  }
}

/**
 * Obtiene comparación entre dos períodos
 * @param {string} metricType - Tipo de métrica
 * @param {Date} currentStart - Inicio período actual
 * @param {Date} currentEnd - Fin período actual
 * @param {Date} previousStart - Inicio período anterior
 * @param {Date} previousEnd - Fin período anterior
 * @returns {Object} Comparación de períodos
 */
export async function compareMetrics(metricType, currentStart, currentEnd, previousStart, previousEnd) {
  try {
    const [currentMetrics, previousMetrics] = await Promise.all([
      getCachedMetrics(metricType, currentStart, currentEnd),
      getCachedMetrics(metricType, previousStart, previousEnd)
    ]);

    // Agregar métricas de cada período
    const current = aggregateMetrics(currentMetrics);
    const previous = aggregateMetrics(previousMetrics);

    // Calcular cambios
    const comparison = {
      current,
      previous,
      changes: {
        revenue: calculateTrend(current.revenue, previous.revenue),
        profit: calculateTrend(current.profit, previous.profit),
        orders: calculateTrend(current.orderCount, previous.orderCount),
        successRate: calculateTrend(current.successRate, previous.successRate),
        avgOrderValue: calculateTrend(current.avgOrderValue, previous.avgOrderValue)
      }
    };

    return comparison;

  } catch (error) {
    console.error('Error al comparar métricas:', error);
    throw error;
  }
}

/**
 * Agrega múltiples métricas en una sola
 * @param {Array} metrics - Array de métricas
 * @returns {Object} Métrica agregada
 */
function aggregateMetrics(metrics) {
  if (!metrics || metrics.length === 0) {
    return {
      revenue: 0,
      costs: 0,
      profit: 0,
      margin: 0,
      orderCount: 0,
      successRate: 0,
      avgOrderValue: 0
    };
  }

  const aggregated = metrics.reduce((acc, metric) => {
    acc.revenue += parseFloat(metric.revenue) || 0;
    acc.costs += parseFloat(metric.costs) || 0;
    acc.profit += parseFloat(metric.profit) || 0;
    acc.orderCount += metric.orderCount || 0;
    acc.syncedCount += metric.syncedCount || 0;
    acc.shippedCount += metric.shippedCount || 0;
    acc.deliveredCount += metric.deliveredCount || 0;
    return acc;
  }, {
    revenue: 0,
    costs: 0,
    profit: 0,
    orderCount: 0,
    syncedCount: 0,
    shippedCount: 0,
    deliveredCount: 0
  });

  aggregated.margin = aggregated.revenue > 0 ? (aggregated.profit / aggregated.revenue) * 100 : 0;
  aggregated.successRate = aggregated.orderCount > 0 ?
    ((aggregated.syncedCount + aggregated.shippedCount + aggregated.deliveredCount) / aggregated.orderCount) * 100 : 0;
  aggregated.avgOrderValue = aggregated.orderCount > 0 ? aggregated.revenue / aggregated.orderCount : 0;

  // Formatear valores
  aggregated.revenue = parseFloat(aggregated.revenue.toFixed(2));
  aggregated.costs = parseFloat(aggregated.costs.toFixed(2));
  aggregated.profit = parseFloat(aggregated.profit.toFixed(2));
  aggregated.margin = parseFloat(aggregated.margin.toFixed(2));
  aggregated.successRate = parseFloat(aggregated.successRate.toFixed(2));
  aggregated.avgOrderValue = parseFloat(aggregated.avgOrderValue.toFixed(2));

  return aggregated;
}

/**
 * Verifica si el cache necesita actualización
 * @param {string} metricType - Tipo de métrica
 * @returns {boolean} True si necesita actualización
 */
export async function needsCacheUpdate(metricType) {
  try {
    const latestMetric = await getLatestMetric(metricType);

    if (!latestMetric) {
      return true; // No hay cache, necesita actualización
    }

    // Verificar antigüedad según tipo de métrica
    const now = new Date();
    const metricDate = new Date(latestMetric.date);
    const hoursSinceLastUpdate = (now - metricDate) / (1000 * 60 * 60);

    switch (metricType) {
      case 'daily':
        return hoursSinceLastUpdate > 24; // Actualizar si tiene más de 24 horas
      case 'weekly':
        return hoursSinceLastUpdate > 168; // Actualizar si tiene más de 7 días
      case 'monthly':
        return hoursSinceLastUpdate > 720; // Actualizar si tiene más de 30 días
      default:
        return true;
    }

  } catch (error) {
    console.error('Error al verificar actualización de cache:', error);
    return true; // En caso de error, asumir que necesita actualización
  }
}
