import axios from "axios";
import { Sale } from "../../../models/Sale.js";
import { SaleDetail } from "../../../models/SaleDetail.js";
import { SaleAddress } from "../../../models/SaleAddress.js";
import { Product } from "../../../models/Product.js";
import { User } from "../../../models/User.js";
import { Guest } from "../../../models/Guest.js";

const PRINTFUL_API_TOKEN = process.env.PRINTFUL_API_TOKEN;
const PRINTFUL_API_URL = 'https://api.printful.com';

const printfulApi = axios.create({
  baseURL: PRINTFUL_API_URL,
  headers: {
    'Authorization': `Bearer ${PRINTFUL_API_TOKEN}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

/**
 * ==================================================================================================
 * =                                  GET ALL PRINTFUL ORDERS                                      =
 * ==================================================================================================
 */
export const getOrders = async (req, res) => {
  try {
    console.log('📦 Fetching Printful orders...');

    const { status, limit = 100, offset = 0 } = req.query;

    // Build query parameters
    const params = {
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    if (status) {
      params.status = status;
    }

    // Fetch orders from Printful API
    const response = await printfulApi.get('/orders', { params });

    if (response.data && response.data.result) {
      const orders = response.data.result.map(order => ({
        ...order,
        items: Array.isArray(order.items) ? order.items.length : 0
      }));

      console.log(`✅ Fetched ${orders.length} orders from Printful`);

      return res.status(200).json({
        success: true,
        orders: orders,
        paging: response.data.paging || {}
      });
    }

    return res.status(200).json({
      success: true,
      orders: [],
      paging: {}
    });

  } catch (error) {
    console.error('❌ Error fetching Printful orders:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener las órdenes de Printful',
      error: error.response?.data?.error?.message || error.message
    });
  }
};

/**
 * ==================================================================================================
 * =                                  GET ORDER BY ID                                              =
 * ==================================================================================================
 */
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`📦 Fetching Printful order ID: ${id}`);

    // Fetch order from Printful API
    const response = await printfulApi.get(`/orders/${id}`);

    if (response.data && response.data.result) {
      const order = response.data.result;

      console.log(`✅ Order ${id} fetched successfully`);

      return res.status(200).json({
        success: true,
        order: order
      });
    }

    return res.status(404).json({
      success: false,
      message: 'Orden no encontrada'
    });

  } catch (error) {
    console.error(`❌ Error fetching order ${req.params.id}:`, error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error al obtener la orden',
      error: error.response?.data?.error?.message || error.message
    });
  }
};

/**
 * ==================================================================================================
 * =                                  SYNC ORDER STATUS                                            =
 * ==================================================================================================
 */
export const syncOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🔄 Syncing order ${id} status from Printful...`);

    // Fetch latest order data from Printful
    const response = await printfulApi.get(`/orders/${id}`);

    if (response.data && response.data.result) {
      const order = response.data.result;

      // TODO: Update local database with new status if needed
      // await Sale.update({ printful_status: order.status }, { where: { printful_order_id: id } });

      console.log(`✅ Order ${id} status synced: ${order.status}`);

      return res.status(200).json({
        success: true,
        message: 'Estado de orden sincronizado correctamente',
        order: order
      });
    }

    return res.status(404).json({
      success: false,
      message: 'Orden no encontrada'
    });

  } catch (error) {
    console.error(`❌ Error syncing order ${req.params.id}:`, error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Error al sincronizar el estado de la orden',
      error: error.response?.data?.error?.message || error.message
    });
  }
};

/**
 * ==================================================================================================
 * =                                  CANCEL ORDER                                                 =
 * ==================================================================================================
 */
export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`❌ Canceling Printful order ${id}...`);

    // Cancel order in Printful
    const response = await printfulApi.delete(`/orders/${id}`);

    if (response.data && response.data.result) {
      const order = response.data.result;

      // TODO: Update local database
      // await Sale.update({ printful_status: 'canceled' }, { where: { printful_order_id: id } });

      console.log(`✅ Order ${id} canceled successfully`);

      return res.status(200).json({
        success: true,
        message: 'Orden cancelada correctamente',
        order: order
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Orden cancelada'
    });

  } catch (error) {
    console.error(`❌ Error canceling order ${req.params.id}:`, error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error al cancelar la orden',
      error: error.response?.data?.error?.message || error.message
    });
  }
};

/**
 * ==================================================================================================
 * =                                  RETRY FAILED ORDER                                           =
 * ==================================================================================================
 */
export const retryOrder = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🔄 Retrying failed order ${id}...`);

    // First, get the order details
    const orderResponse = await printfulApi.get(`/orders/${id}`);
    
    if (!orderResponse.data || !orderResponse.data.result) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada'
      });
    }

    const order = orderResponse.data.result;

    // Check if order is in a retryable state
    if (order.status !== 'failed' && order.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden reintentar órdenes en estado "failed" o "draft"'
      });
    }

    // Confirm the order (move from draft to pending)
    const confirmResponse = await printfulApi.post(`/orders/${id}/confirm`);

    if (confirmResponse.data && confirmResponse.data.result) {
      const confirmedOrder = confirmResponse.data.result;

      console.log(`✅ Order ${id} retried successfully. New status: ${confirmedOrder.status}`);

      return res.status(200).json({
        success: true,
        message: 'Orden reenviada correctamente',
        order: confirmedOrder
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error al reintentar la orden'
    });

  } catch (error) {
    console.error(`❌ Error retrying order ${req.params.id}:`, error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error al reintentar la orden',
      error: error.response?.data?.error?.message || error.message
    });
  }
};

/**
 * ==================================================================================================
 * =                                  GET ORDER SHIPMENTS                                          =
 * ==================================================================================================
 */
export const getOrderShipments = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`📦 Fetching shipments for order ${id}...`);

    // Fetch order with shipments
    const response = await printfulApi.get(`/orders/${id}`);

    if (response.data && response.data.result) {
      const order = response.data.result;
      const shipments = order.shipments || [];

      console.log(`✅ Found ${shipments.length} shipments for order ${id}`);

      return res.status(200).json({
        success: true,
        shipments: shipments
      });
    }

    return res.status(404).json({
      success: false,
      message: 'Orden no encontrada'
    });

  } catch (error) {
    console.error(`❌ Error fetching shipments for order ${req.params.id}:`, error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener los envíos de la orden',
      error: error.response?.data?.error?.message || error.message
    });
  }
};

/**
 * ==================================================================================================
 * =                               ESTIMATE ORDER COSTS (BEFORE CREATING)                         =
 * ==================================================================================================
 */
export const estimateOrderCosts = async (req, res) => {
  try {
    const orderData = req.body;

    console.log('💰 Estimating order costs...');

    // Estimate costs using Printful API
    const response = await printfulApi.post('/orders/estimate-costs', orderData);

    if (response.data && response.data.result) {
      const costs = response.data.result;

      console.log('✅ Costs estimated successfully');

      return res.status(200).json({
        success: true,
        costs: costs
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error al estimar los costos'
    });

  } catch (error) {
    console.error('❌ Error estimating costs:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Error al estimar los costos de la orden',
      error: error.response?.data?.error?.message || error.message
    });
  }
};
