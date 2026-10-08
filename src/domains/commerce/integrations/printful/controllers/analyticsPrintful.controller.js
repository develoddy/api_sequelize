import axios from 'axios';
import { Op } from 'sequelize';

// Configuración de Printful API
const PRINTFUL_API_TOKEN = process.env.PRINTFUL_API_TOKEN;

const printfulApi = axios.create({
  baseURL: 'https://api.printful.com',
  headers: {
    'Authorization': `Bearer ${PRINTFUL_API_TOKEN}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

/**
 * GET /api/printful/analytics/financial
 * Obtiene estadísticas financieras de órdenes Printful
 */
export const getFinancialStats = async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;

    console.log('📊 Fetching financial analytics from Printful...');

    // Parámetros para filtrar órdenes
    const params = {
      limit: 100,
      offset: 0
    };

    if (status) params.status = status;

    // Obtener todas las órdenes de Printful
    const response = await printfulApi.get('/orders', { params });

    if (!response.data || !response.data.result) {
      return res.status(200).json({
        success: true,
        stats: getEmptyStats()
      });
    }

    const orders = response.data.result;

    // Filtrar por fechas si se proporcionan
    let filteredOrders = orders;
    if (startDate || endDate) {
      filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.created * 1000);
        const start = startDate ? new Date(startDate) : new Date(0);
        const end = endDate ? new Date(endDate) : new Date();
        return orderDate >= start && orderDate <= end;
      });
    }

    // Calcular estadísticas
    const stats = calculateFinancialStats(filteredOrders);

    console.log('✅ Financial analytics calculated:', stats);

    return res.status(200).json({
      success: true,
      stats: stats
    });

  } catch (error) {
    console.error('❌ Error fetching financial analytics:', error.response?.data || error.message);
    
    return res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas financieras',
      error: error.response?.data?.error?.message || error.message,
      stats: getEmptyStats()
    });
  }
};

/**
 * GET /api/printful/analytics/products
 * Obtiene ranking de productos por rentabilidad
 */
export const getProductsRanking = async (req, res) => {
  try {
    const { limit = 10, sortBy = 'profit' } = req.query;

    console.log('📊 Fetching products ranking...');

    // Obtener todas las órdenes
    const ordersResponse = await printfulApi.get('/orders', { 
      params: { limit: 100, offset: 0, status: 'fulfilled' } 
    });

    if (!ordersResponse.data || !ordersResponse.data.result) {
      return res.status(200).json({
        success: true,
        ranking: []
      });
    }

    const orders = ordersResponse.data.result;
    const productsMap = new Map();

    // Procesar cada orden para calcular rentabilidad por producto
    for (const order of orders) {
      if (!order.items || order.items.length === 0) continue;

      for (const item of order.items) {
        const key = `${item.variant_id}_${item.name}`;
        
        if (!productsMap.has(key)) {
          productsMap.set(key, {
            variant_id: item.variant_id,
            name: item.name,
            image: item.product?.image || '',
            totalOrders: 0,
            totalQuantity: 0,
            totalRevenue: 0,
            totalCost: 0,
            totalProfit: 0,
            averageMargin: 0
          });
        }

        const product = productsMap.get(key);
        const quantity = parseInt(item.quantity) || 0;
        const retailPrice = parseFloat(item.retail_price) || 0;
        const cost = parseFloat(item.price) || 0;

        product.totalOrders++;
        product.totalQuantity += quantity;
        product.totalRevenue += retailPrice * quantity;
        product.totalCost += cost * quantity;
        product.totalProfit = product.totalRevenue - product.totalCost;
        product.averageMargin = product.totalRevenue > 0 
          ? ((product.totalProfit / product.totalRevenue) * 100).toFixed(2)
          : 0;
      }
    }

    // Convertir a array y ordenar
    let ranking = Array.from(productsMap.values());

    if (sortBy === 'profit') {
      ranking.sort((a, b) => b.totalProfit - a.totalProfit);
    } else if (sortBy === 'margin') {
      ranking.sort((a, b) => parseFloat(b.averageMargin) - parseFloat(a.averageMargin));
    } else if (sortBy === 'revenue') {
      ranking.sort((a, b) => b.totalRevenue - a.totalRevenue);
    } else if (sortBy === 'quantity') {
      ranking.sort((a, b) => b.totalQuantity - a.totalQuantity);
    }

    // Limitar resultados
    ranking = ranking.slice(0, parseInt(limit));

    console.log(`✅ Products ranking calculated: ${ranking.length} products`);

    return res.status(200).json({
      success: true,
      ranking: ranking
    });

  } catch (error) {
    console.error('❌ Error fetching products ranking:', error.response?.data || error.message);
    
    return res.status(500).json({
      success: false,
      message: 'Error al obtener ranking de productos',
      error: error.response?.data?.error?.message || error.message,
      ranking: []
    });
  }
};

/**
 * GET /api/printful/analytics/timeline
 * Obtiene datos de ingresos y costes por periodo de tiempo
 */
export const getTimeline = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    console.log(`📊 Fetching timeline for last ${days} days...`);

    // Obtener órdenes fulfilled
    const ordersResponse = await printfulApi.get('/orders', { 
      params: { limit: 100, offset: 0, status: 'fulfilled' } 
    });

    if (!ordersResponse.data || !ordersResponse.data.result) {
      return res.status(200).json({
        success: true,
        timeline: []
      });
    }

    const orders = ordersResponse.data.result;
    const daysInt = parseInt(days);
    const now = new Date();
    const startDate = new Date(now.getTime() - (daysInt * 24 * 60 * 60 * 1000));

    // Filtrar órdenes del periodo
    const filteredOrders = orders.filter(order => {
      const orderDate = new Date(order.created * 1000);
      return orderDate >= startDate && orderDate <= now;
    });

    // Agrupar por día
    const timelineMap = new Map();

    for (const order of filteredOrders) {
      const orderDate = new Date(order.created * 1000);
      const dateKey = orderDate.toISOString().split('T')[0]; // YYYY-MM-DD

      if (!timelineMap.has(dateKey)) {
        timelineMap.set(dateKey, {
          date: dateKey,
          revenue: 0,
          cost: 0,
          profit: 0,
          orders: 0
        });
      }

      const day = timelineMap.get(dateKey);
      day.revenue += parseFloat(order.retail_costs?.total || 0);
      day.cost += parseFloat(order.costs?.total || 0);
      day.profit = day.revenue - day.cost;
      day.orders++;
    }

    // Convertir a array y ordenar por fecha
    const timeline = Array.from(timelineMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    console.log(`✅ Timeline calculated: ${timeline.length} days`);

    return res.status(200).json({
      success: true,
      timeline: timeline
    });

  } catch (error) {
    console.error('❌ Error fetching timeline:', error.response?.data || error.message);
    
    return res.status(500).json({
      success: false,
      message: 'Error al obtener timeline',
      error: error.response?.data?.error?.message || error.message,
      timeline: []
    });
  }
};

/**
 * Helper: Calcular estadísticas financieras
 */
function calculateFinancialStats(orders) {
  const stats = {
    totalOrders: orders.length,
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    averageMargin: 0,
    byStatus: {
      draft: 0,
      pending: 0,
      fulfilled: 0,
      canceled: 0,
      failed: 0
    },
    totalShippingRevenue: 0,
    totalShippingCost: 0,
    totalProductRevenue: 0,
    totalProductCost: 0
  };

  for (const order of orders) {
    // Contar por estado
    if (order.status && stats.byStatus.hasOwnProperty(order.status)) {
      stats.byStatus[order.status]++;
    }

    // Solo calcular financieros para órdenes fulfilled
    if (order.status === 'fulfilled' || order.status === 'pending') {
      const retailTotal = parseFloat(order.retail_costs?.total || 0);
      const costTotal = parseFloat(order.costs?.total || 0);
      const retailShipping = parseFloat(order.retail_costs?.shipping || 0);
      const costShipping = parseFloat(order.costs?.shipping || 0);

      stats.totalRevenue += retailTotal;
      stats.totalCost += costTotal;
      stats.totalShippingRevenue += retailShipping;
      stats.totalShippingCost += costShipping;
      stats.totalProductRevenue += (retailTotal - retailShipping);
      stats.totalProductCost += (costTotal - costShipping);
    }
  }

  stats.totalProfit = stats.totalRevenue - stats.totalCost;
  stats.averageMargin = stats.totalRevenue > 0 
    ? ((stats.totalProfit / stats.totalRevenue) * 100).toFixed(2)
    : 0;

  return stats;
}

/**
 * Helper: Estadísticas vacías
 */
function getEmptyStats() {
  return {
    totalOrders: 0,
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    averageMargin: 0,
    byStatus: {
      draft: 0,
      pending: 0,
      fulfilled: 0,
      canceled: 0,
      failed: 0
    },
    totalShippingRevenue: 0,
    totalShippingCost: 0,
    totalProductRevenue: 0,
    totalProductCost: 0
  };
}
