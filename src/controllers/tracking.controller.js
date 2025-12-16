import axios from "axios";
import { Op } from 'sequelize';
import { Sale } from "../models/Sale.js";
import { SaleDetail } from "../models/SaleDetail.js";
import { Product } from "../models/Product.js";
import { Variedad } from "../models/Variedad.js";
import { File } from "../models/File.js";

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
 * =                            TRACKING PÚBLICO - CONSULTA HÍBRIDA                                =
 * ==================================================================================================
 * 
 * 🔍 GET /api/orders/tracking/:orderId/:token
 * 
 * Endpoint PÚBLICO con validación de token
 * Consulta Printful directamente + datos locales de BD
 * Arquitectura idéntica al módulo Printful
 * 
 * Flujo:
 * 1. Busca Sale en BD local por orderId + trackingToken (seguridad)
 * 2. Consulta Printful API con el printfulOrderId
 * 3. Combina datos de ambas fuentes
 * 4. Retorna respuesta unificada (sin datos sensibles)
 */
export const getTrackingStatus = async (req, res) => {
  try {
    let { orderId, token } = req.params;

    // 🧹 Limpiar orderId: remover #PF si viene en el formato #PF135327909
    orderId = orderId.replace(/^#?PF/i, '').trim();


    // 1️⃣ Buscar en BD local con validación de token (SEGURIDAD)
    // Prioridad: printfulOrderId → sale.id (fallback)
    let sale = await Sale.findOne({
      where: {
        [Op.or]: [
          { printfulOrderId: orderId },  // 🎯 Prioridad 1: ID de Printful
          { id: orderId }                 // 🔄 Fallback: ID interno
        ],
        trackingToken: token  // 🔒 Validación de seguridad
      },
      include: [
        {
          model: SaleDetail,
          include: [
            { model: Product },
            { model: Variedad, include: { model: File } }
          ]
        }
      ]
    });

    if (!sale) {
      console.log(`❌ [TRACKING] Orden no encontrada o token inválido: ${orderId}`);
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado o token de acceso inválido'
      });
    }

    console.log(`✅ [TRACKING] Orden encontrada: Sale ID ${sale.id} | Printful ID ${sale.printfulOrderId || 'N/A'}`);

    // 2️⃣ Consultar Printful API directamente (igual que módulo Printful)
    let printfulOrder = null;
    let printfulError = null;

    if (sale.printfulOrderId) {
      try {
        console.log(`📞 [TRACKING] Consultando Printful API: ${sale.printfulOrderId}`);
        
        const response = await printfulApi.get(`/orders/${sale.printfulOrderId}`);
        
        if (response.data && response.data.result) {
          printfulOrder = response.data.result;
          console.log(`✅ [TRACKING] Datos de Printful obtenidos - Estado: ${printfulOrder.status}`);
        }
      } catch (error) {
        printfulError = error.response?.data?.error?.message || error.message;
        console.error(`⚠️ [TRACKING] Error consultando Printful:`, printfulError);
        // No fallar - continuar con datos de BD
      }
    }

    // 3️⃣ Combinar datos de Printful + BD local
    // ⚡ PRIORIDAD: Printful > BD (Printful es la fuente de verdad)
    const finalStatus = printfulOrder?.status || sale.printfulStatus || sale.syncStatus || 'pending';
    
    const trackingData = {
      // Identificadores
      orderId: printfulOrder?.id || sale.printfulOrderId || sale.id.toString(),
      externalId: sale.id.toString(),
      
      // Estado (priorizar Printful como fuente de verdad)
      status: finalStatus,
      progress: calculateProgress(finalStatus),
      
      // Items (desde Printful si existe, sino desde BD)
      items: printfulOrder?.items || formatLocalItems(sale.saleDetails),
      
      // Información de envío (combinar ambas fuentes)
      trackingNumber: printfulOrder?.shipments?.[0]?.tracking_number || sale.trackingNumber,
      trackingUrl: printfulOrder?.shipments?.[0]?.tracking_url || sale.trackingUrl,
      carrier: printfulOrder?.shipments?.[0]?.carrier || sale.carrier,
      
      // Fechas estimadas (desde BD local)
      estimated: {
        min: sale.minDeliveryDate || null,
        max: sale.maxDeliveryDate || null
      },
      
      // Fechas reales (combinar fuentes, convertir timestamps Unix a Date)
      dates: {
        created: printfulOrder?.created ? new Date(printfulOrder.created * 1000) : sale.createdAt,
        updated: printfulOrder?.updated ? new Date(printfulOrder.updated * 1000) : (sale.printfulUpdatedAt || sale.updatedAt),
        shipped: printfulOrder?.shipments?.[0]?.shipped_at || sale.shippedAt,
        delivered: printfulOrder?.shipments?.[0]?.delivered_at || sale.completedAt
      },
      
      // Estado de Printful (raw)
      printfulStatus: printfulOrder?.status || sale.printfulStatus,
      printfulRaw: printfulOrder || null,
      
      // Timeline de eventos
      timeline: generateTimeline(finalStatus, sale, printfulOrder)
    };

    console.log(`✅ [TRACKING] Respuesta generada para orden ${orderId}`);

    return res.status(200).json({
      success: true,
      message: 'Tracking obtenido correctamente',
      data: trackingData
    });

  } catch (error) {
    console.error('❌ [TRACKING] Error en getTrackingStatus:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al consultar el tracking',
      error: error.message
    });
  }
};

/**
 * ==================================================================================================
 * =                                   FUNCIONES AUXILIARES                                        =
 * ==================================================================================================
 */

/**
 * 📊 Calcular progreso visual (0-100) basado en estado
 */
function calculateProgress(status) {
  const progressMap = {
    'draft': 0,
    'pending': 10,
    'failed': 0,
    'canceled': 0,
    'onhold': 20,
    'inprocess': 50,
    'partial': 75,
    'fulfilled': 100,
    'archived': 100
  };
  
  return progressMap[status?.toLowerCase()] || 0;
}

/**
 * 🔄 Formatear items locales cuando Printful no está disponible
 */
function formatLocalItems(saleDetails) {
  if (!saleDetails || saleDetails.length === 0) return [];
  
  return saleDetails.map(detail => ({
    id: detail.id,
    external_id: detail.id.toString(),
    variant_id: detail.variedadId,
    sync_variant_id: detail.variedadId,
    quantity: detail.cantidad,
    name: detail.product?.title || 'Producto',
    retail_price: detail.precioUnitario?.toString() || '0',
    // ✅ Incluir archivos de la variedad (mockups con diseño aplicado)
    files: detail.variedad?.files || [],
    options: [],
    sku: detail.product?.sku || null,
    // ✅ Incluir datos del producto real para consistencia
    product: detail.product ? {
      id: detail.product.id,
      name: detail.product.title,
      image: detail.product.portada || detail.product.imagen,
      portada: detail.product.portada,
      imagen: detail.product.imagen,
      sku: detail.product.sku
    } : null,
    // ✅ Incluir variedad completa con archivos
    variedade: detail.variedad || null
  }));
}

/**
 * 📅 Generar timeline de eventos
 */
function generateTimeline(status, sale, printfulOrder) {
  const trackingNumber = printfulOrder?.shipments?.[0]?.tracking_number || sale.trackingNumber;
  const carrier = printfulOrder?.shipments?.[0]?.carrier || sale.carrier;
  
  return [
    {
      type: 'order_received',
      status: 'completed',
      title: 'Pedido Recibido',
      description: 'Tu pedido ha sido recibido y confirmado',
      date: printfulOrder?.created ? new Date(printfulOrder.created * 1000) : sale.createdAt,
      completed: true
    },
    {
      type: 'processing',
      status: ['inprocess', 'partial', 'fulfilled'].includes(status) ? 'completed' : 
              status === 'pending' ? 'processing' : 'pending',
      title: 'Procesando',
      description: 'Validando pago y preparando orden',
      date: printfulOrder?.created ? new Date(printfulOrder.created * 1000) : sale.createdAt,
      completed: ['inprocess', 'partial', 'fulfilled'].includes(status)
    },
    {
      type: 'manufacturing',
      status: ['partial', 'fulfilled'].includes(status) ? 'completed' : 
              status === 'inprocess' ? 'processing' : 'pending',
      title: 'Fabricando',
      description: 'Tu producto está siendo fabricado',
      date: printfulOrder?.updated ? new Date(printfulOrder.updated * 1000) : sale.updatedAt,
      completed: ['partial', 'fulfilled'].includes(status)
    },
    {
      type: 'shipped',
      status: (status === 'fulfilled' || status === 'shipped' || trackingNumber) ? 'completed' : 'pending',
      title: 'Enviado',
      description: trackingNumber 
        ? `En tránsito - ${carrier || 'Carrier'}: ${trackingNumber}`
        : 'Tu pedido está en camino',
      date: printfulOrder?.shipments?.[0]?.shipped_at || sale.shippedAt,
      completed: status === 'fulfilled' || status === 'shipped' || !!trackingNumber
    },
    {
      type: 'delivered',
      status: (status === 'fulfilled' || printfulOrder?.shipments?.[0]?.delivered_at || sale.completedAt) ? 'completed' : 'pending',
      title: 'Entregado',
      description: (status === 'fulfilled' || printfulOrder?.shipments?.[0]?.delivered_at || sale.completedAt)
        ? 'Tu pedido ha sido entregado'
        : 'Esperando entrega',
      date: printfulOrder?.shipments?.[0]?.delivered_at || sale.completedAt || sale.maxDeliveryDate,
      completed: status === 'fulfilled' || !!printfulOrder?.shipments?.[0]?.delivered_at || !!sale.completedAt
    }
  ];
}
