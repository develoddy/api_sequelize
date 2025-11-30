import { PrintfulWebhookLog } from '../models/PrintfulWebhookLog.js';
import { Sale } from '../models/Sale.js';
import { SaleDetail } from '../models/SaleDetail.js';
import { Op } from 'sequelize';
import axios from 'axios';

/**
 * Obtiene costos detallados de Printful para órdenes en un rango de fechas
 * @param {Date} startDate - Fecha inicio
 * @param {Date} endDate - Fecha fin
 * @returns {Object} Costos detallados
 */
export async function getPrintfulCostsFromWebhooks(startDate, endDate) {
  try {
    const webhookLogs = await PrintfulWebhookLog.findAll({
      where: {
        received_at: {
          [Op.between]: [startDate, endDate]
        },
        event_type: {
          [Op.in]: ['package_shipped', 'order_created', 'order_updated', 'order_failed']
        },
        processed: true
      },
      order: [['received_at', 'DESC']]
    });

    let totalCosts = 0;
    let totalShipping = 0;
    let totalTax = 0;
    const orderCosts = {}; // { printfulOrderId: { cost, shipping, tax, items } }
    const productCosts = {}; // { productId: totalCost }

    for (const log of webhookLogs) {
      const eventData = log.event_data;

      if (!eventData || !eventData.order) continue;

      const order = eventData.order;
      const printfulOrderId = order.id || log.order_id;

      // Extraer costos de la orden
      if (order.costs) {
        const costs = order.costs;
        const orderTotal = parseFloat(costs.total || 0);
        const shipping = parseFloat(costs.shipping || 0);
        const tax = parseFloat(costs.tax || 0);

        // Evitar duplicados - solo tomar el último evento por orden
        if (!orderCosts[printfulOrderId] || log.received_at > orderCosts[printfulOrderId].receivedAt) {
          orderCosts[printfulOrderId] = {
            cost: orderTotal,
            shipping,
            tax,
            currency: costs.currency || 'EUR',
            items: [],
            receivedAt: log.received_at
          };

          totalCosts += orderTotal;
          totalShipping += shipping;
          totalTax += tax;
        }

        // Extraer costos por producto/item
        if (order.items && Array.isArray(order.items)) {
          for (const item of order.items) {
            const productId = item.external_id || item.external_variant_id;
            const itemCost = parseFloat(item.retail_price || item.price || 0);
            const quantity = parseInt(item.quantity || 1);

            if (productId) {
              productCosts[productId] = (productCosts[productId] || 0) + (itemCost * quantity);
              
              orderCosts[printfulOrderId].items.push({
                productId,
                name: item.name,
                quantity,
                unitCost: itemCost,
                totalCost: itemCost * quantity
              });
            }
          }
        }
      }
    }

    return {
      totalCosts,
      totalShipping,
      totalTax,
      orderCosts,
      productCosts,
      ordersProcessed: Object.keys(orderCosts).length,
      webhooksAnalyzed: webhookLogs.length
    };

  } catch (error) {
    console.error('Error al obtener costos de webhooks:', error);
    throw error;
  }
}

/**
 * Obtiene costos directamente desde la API de Printful para una orden específica
 * @param {string} printfulOrderId - ID de la orden en Printful
 * @returns {Object} Costos de la orden
 */
export async function getPrintfulCostFromAPI(printfulOrderId) {
  try {
    const apiKey = process.env.PRINTFUL_API_KEY;
    
    if (!apiKey) {
      throw new Error('PRINTFUL_API_KEY no está configurada');
    }

    const response = await axios.get(
      `https://api.printful.com/orders/${printfulOrderId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data && response.data.result) {
      const order = response.data.result;
      const costs = order.costs || {};

      return {
        printfulOrderId: order.id,
        total: parseFloat(costs.total || 0),
        shipping: parseFloat(costs.shipping || 0),
        tax: parseFloat(costs.tax || 0),
        currency: costs.currency || 'USD',
        items: order.items ? order.items.map(item => ({
          productId: item.external_id,
          name: item.name,
          quantity: item.quantity,
          unitCost: parseFloat(item.retail_price || 0),
          totalCost: parseFloat(item.retail_price || 0) * item.quantity
        })) : []
      };
    }

    return null;

  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.warn(`Orden ${printfulOrderId} no encontrada en Printful`);
      return null;
    }
    console.error(`Error al obtener costos de Printful API para orden ${printfulOrderId}:`, error.message);
    throw error;
  }
}

/**
 * Calcula costos totales para una venta específica
 * @param {number} saleId - ID de la venta
 * @returns {Object} Costos de la venta
 */
export async function calculateSaleCosts(saleId) {
  try {
    const sale = await Sale.findByPk(saleId, {
      include: [
        {
          model: SaleDetail,
          as: 'sale_details'
        }
      ]
    });

    if (!sale) {
      throw new Error(`Venta ${saleId} no encontrada`);
    }

    // Si la venta tiene printfulOrderId, intentar obtener costos
    let printfulCost = 0;
    let shippingCost = 0;
    let tax = 0;

    if (sale.printfulOrderId) {
      // Primero intentar desde webhooks
      const webhookLog = await PrintfulWebhookLog.findOne({
        where: {
          order_id: sale.printfulOrderId
        },
        order: [['received_at', 'DESC']]
      });

      if (webhookLog && webhookLog.event_data && webhookLog.event_data.order) {
        const costs = webhookLog.event_data.order.costs;
        if (costs) {
          printfulCost = parseFloat(costs.total || 0);
          shippingCost = parseFloat(costs.shipping || 0);
          tax = parseFloat(costs.tax || 0);
        }
      }

      // Si no hay datos en webhooks, consultar API (opcional)
      if (printfulCost === 0) {
        try {
          const apiCosts = await getPrintfulCostFromAPI(sale.printfulOrderId);
          if (apiCosts) {
            printfulCost = apiCosts.total;
            shippingCost = apiCosts.shipping;
            tax = apiCosts.tax;
          }
        } catch (error) {
          console.warn('No se pudieron obtener costos desde API de Printful');
        }
      }
    }

    // Calcular profit
    const revenue = parseFloat(sale.total || 0);
    const totalCost = printfulCost;
    const profit = revenue - totalCost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    return {
      saleId: sale.id,
      revenue,
      printfulCost,
      shippingCost,
      tax,
      totalCost,
      profit,
      margin: parseFloat(margin.toFixed(2)),
      currency: sale.curreny_total || 'EUR',
      itemCount: sale.sale_details ? sale.sale_details.length : 0
    };

  } catch (error) {
    console.error(`Error al calcular costos de venta ${saleId}:`, error);
    throw error;
  }
}

/**
 * Calcula el costo promedio por producto desde histórico de webhooks
 * @param {number} productId - ID del producto
 * @param {number} days - Días de histórico (default 30)
 * @returns {Object} Costo promedio y estadísticas
 */
export async function getProductAverageCost(productId, days = 30) {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    const webhookLogs = await PrintfulWebhookLog.findAll({
      where: {
        received_at: {
          [Op.between]: [startDate, endDate]
        },
        processed: true
      }
    });

    let totalCost = 0;
    let totalQuantity = 0;
    const costs = [];

    for (const log of webhookLogs) {
      const eventData = log.event_data;
      if (!eventData || !eventData.order || !eventData.order.items) continue;

      for (const item of eventData.order.items) {
        const itemProductId = item.external_id || item.external_variant_id;
        
        if (itemProductId == productId) {
          const itemCost = parseFloat(item.retail_price || item.price || 0);
          const quantity = parseInt(item.quantity || 1);
          
          totalCost += itemCost * quantity;
          totalQuantity += quantity;
          costs.push(itemCost);
        }
      }
    }

    if (totalQuantity === 0) {
      return {
        productId,
        avgCost: 0,
        minCost: 0,
        maxCost: 0,
        totalOrders: 0,
        totalQuantity: 0
      };
    }

    const avgCost = totalCost / totalQuantity;
    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);

    return {
      productId,
      avgCost: parseFloat(avgCost.toFixed(2)),
      minCost: parseFloat(minCost.toFixed(2)),
      maxCost: parseFloat(maxCost.toFixed(2)),
      totalOrders: costs.length,
      totalQuantity,
      daysAnalyzed: days
    };

  } catch (error) {
    console.error(`Error al calcular costo promedio del producto ${productId}:`, error);
    throw error;
  }
}

/**
 * Sincroniza costos de órdenes desde Printful API para ventas sin datos de costo
 * @param {number} limit - Límite de órdenes a sincronizar
 * @returns {Object} Resultado de sincronización
 */
export async function syncMissingCosts(limit = 50) {
  try {
    // Buscar ventas con printfulOrderId pero sin datos de costo en webhooks
    const salesWithoutCosts = await Sale.findAll({
      where: {
        printfulOrderId: {
          [Op.ne]: null
        },
        syncStatus: {
          [Op.in]: ['shipped', 'fulfilled']
        }
      },
      limit,
      order: [['createdAt', 'DESC']]
    });

    let synced = 0;
    let failed = 0;
    const errors = [];

    for (const sale of salesWithoutCosts) {
      try {
        // Verificar si ya existe webhook log con costos
        const existingLog = await PrintfulWebhookLog.findOne({
          where: { order_id: sale.printfulOrderId }
        });

        if (existingLog && existingLog.event_data && existingLog.event_data.order && existingLog.event_data.order.costs) {
          // Ya tiene costos
          continue;
        }

        // Obtener costos desde API
        const costs = await getPrintfulCostFromAPI(sale.printfulOrderId);

        if (costs) {
          // Crear webhook log con los datos obtenidos
          await PrintfulWebhookLog.create({
            event_type: 'cost_sync',
            order_id: sale.printfulOrderId,
            event_data: {
              order: {
                id: costs.printfulOrderId,
                costs: {
                  total: costs.total,
                  shipping: costs.shipping,
                  tax: costs.tax,
                  currency: costs.currency
                },
                items: costs.items
              }
            },
            processed: true,
            received_at: new Date()
          });

          synced++;
        }

      } catch (error) {
        failed++;
        errors.push({
          saleId: sale.id,
          printfulOrderId: sale.printfulOrderId,
          error: error.message
        });
      }
    }

    return {
      success: true,
      synced,
      failed,
      total: salesWithoutCosts.length,
      errors: errors.slice(0, 10) // Solo primeros 10 errores
    };

  } catch (error) {
    console.error('Error al sincronizar costos faltantes:', error);
    throw error;
  }
}
