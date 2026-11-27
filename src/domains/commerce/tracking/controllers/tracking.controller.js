import {
  resolveCommerceScope
} from '../../storefront/services/commerceScope.service.js';

import {
  isPrintfulV2ScopedSale
} from '../../integrations/printful/services/printfulV2Scope.service.js';

import axios from "axios";
import {
  hasVerifiedPayment
} from '../services/paymentEvidence.service.js';
import {
  fetchPrintfulLogistics
} from '../../integrations/printful/services/printfulLogistics.service.js';
import {
  resolveShipmentCoverage
} from '../services/shipmentCoverage.service.js';
import { Shipment } from '../../../../models/Shipment.js';

import {
  resolveOrderLifecycle,
  normalizeLifecycleDate as normalizeTrackingDate
} from '../services/orderLifecycle.service.js';
import { Op } from 'sequelize';
import { Sale } from "../../../../models/Sale.js";
import { SaleDetail } from "../../../../models/SaleDetail.js";
import { Product } from "../../../../models/Product.js";
import { Variedad } from "../../../../models/Variedad.js";
import { File } from "../../../../models/File.js";
import { Tenant } from "../../../platform/models/Tenant.js";

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
export const getTrackingStatus = (req, res) =>
  resolveTrackingStatus(req, res, false);

export const getAuthenticatedTrackingStatus = (req, res) =>
  resolveTrackingStatus(req, res, true);

async function resolveTrackingStatus(req, res, authenticated) {
  try {
    let { orderId, token } = req.params;
    let where;

    if (authenticated) {
      const userId = Number(req.user?.id);

      if (!Number.isSafeInteger(userId) || userId <= 0) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const scope = resolveCommerceScope();

      if (!scope) {
        return res.status(503).json({
          success: false,
          message: 'Service temporarily unavailable'
        });
      }

      if (
        typeof orderId !== 'string' ||
        !/^[1-9][0-9]{0,9}$/.test(orderId) ||
        Number(orderId) > 2147483647
      ) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      where = {
        id: Number(orderId),
        userId,
        ...scope,
        module_id: null
      };

    } else {
      orderId = orderId.trim().replace(/^#?PF/i, '');

      if (
        !/^[0-9]{1,20}$/.test(orderId) ||
        !/^[a-fA-F0-9]{32}$/.test(token)
      ) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado o token de acceso inválido'
        });
      }

      where = {
        [Op.or]: [
          { printfulOrderId: orderId },
          ...(Number(orderId) <= 2147483647
            ? [{ id: Number(orderId) }]
            : [])
        ],
        trackingToken: token
      };
    }

    let sale = await Sale.findOne({
      where,
      include: [
        {
          model: SaleDetail,
          include: [
            { model: Product },
            { model: Variedad, include: { model: File } }
          ]
        },
        {
          model: Tenant,
          as: 'tenant',
          attributes: ['id', 'name', 'settings']
        }
      ]
    });

    if (!sale) {
      if (authenticated) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      console.warn('[TRACKING] Acceso no válido');
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado o token de acceso inválido'
      });
    }

    console.log(`✅ [TRACKING] Orden encontrada: Sale ID ${sale.id} | Printful ID ${sale.printfulOrderId || 'N/A'}`);
    console.log(`📊 [TRACKING] Items encontrados: ${sale.sale_details?.length || 0} items`);
    
    // DEBUG: Mostrar estructura de sale_details
    if (sale.sale_details && sale.sale_details.length > 0) {
      console.log(`📦 [TRACKING] Primer item:`, JSON.stringify({
        id: sale.sale_details[0].id,
        cantidad: sale.sale_details[0].cantidad,
        code_discount: sale.sale_details[0].code_discount,
        productId: sale.sale_details[0].productId,
        hasProduct: !!sale.sale_details[0].product
      }, null, 2));
    }

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
        console.warn('[TRACKING] Printful no disponible');
        // No fallar - continuar con datos de BD
      }
    }

    // 3️⃣ Combinar datos de Printful + BD local
    // ⚡ PRIORIDAD: Printful > BD (Printful es la fuente de verdad)
    const finalStatus = printfulOrder?.status || sale.printfulStatus || sale.syncStatus || 'pending';
    
    const verifiedShipments = await Shipment.findAll({
      where: {
        saleId: sale.id,
        evidenceSource: ['printful_v2', 'printful_v2_api']
      },
      attributes: [
        'evidenceSource', 'printfulShipmentId',
        'status',
        'shippedAt',
        'deliveredAt',
        'returnedAt'
      ],
      raw: true
    });

    let shipmentCoverageVerified = false;

    if (
      printfulOrder?.status === 'fulfilled' &&
      sale.printfulOrderId &&
      isPrintfulV2ScopedSale(sale) &&
      verifiedShipments.length > 0
    ) {
      try {
        const logistics = await fetchPrintfulLogistics({
          orderId: sale.printfulOrderId,
          storeId: process.env.PRINTFUL_V2_STORE_ID,
          apiToken: process.env.PRINTFUL_API_TOKEN
        });

        const coverage = resolveShipmentCoverage({
          ...logistics,
          verifiedShipments
        });

        shipmentCoverageVerified = coverage.coverageVerified;

      } catch (error) {
        console.warn(
          '[Tracking] Shipment coverage unavailable',
          {
            saleId: sale.id,
            errorType: error.name,
            httpStatus: error.response?.status ?? null
          }
        );
      }
    }

    const commerciallyConfirmed = await hasVerifiedPayment(sale);

    const lifecycle = resolveOrderLifecycle({
      providerStatus: printfulOrder?.status || null,
      localStatus: sale.printfulStatus || sale.syncStatus,
      commerciallyConfirmed,
      verifiedShipments,
      shipmentCoverageVerified
    });

    const trackingData = {
      // Identificadores
      orderId: printfulOrder?.id || sale.printfulOrderId || sale.id.toString(),
      externalId: sale.id.toString(),
      
      // Estado (priorizar Printful como fuente de verdad)
      status: finalStatus,
      commercialStatus: lifecycle.commercialStatus,
      exceptions: lifecycle.exceptions,
      progress: lifecycle.progress,
      
      // Items (desde Printful si existe, sino desde BD)
      items: (
        Array.isArray(printfulOrder?.items) && printfulOrder.items.length
          ? printfulOrder.items
          : formatLocalItems(sale.sale_details)
      ).map(formatPublicTrackingItem),
      
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
        shipped: lifecycle.shippedAt,
        delivered: lifecycle.deliveredAt
      },
      
      // Estado de Printful (raw)
      printfulStatus: printfulOrder?.status || sale.printfulStatus,
      
      // Timeline de eventos
      timeline: generateTimeline(finalStatus, sale, lifecycle),
      
      // 🏢 Información del Tenant (multi-tenant branding)
      tenant: sale.tenant ? {
        id: sale.tenant.id,
        name: sale.tenant.name,
        slug: sale.tenant.slug,
        storeName: sale.tenant.settings?.store_name || sale.tenant.name
      } : null
    };

    console.log(`✅ [TRACKING] Respuesta generada para orden ${orderId}`);

    return res.status(200).json({
      success: true,
      message: 'Tracking obtenido correctamente',
      data: trackingData
    });

  } catch (error) {
    console.error('[TRACKING] Error interno consultando pedido');
    return res.status(500).json({
      success: false,
      message: 'Error al consultar el tracking'
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
function formatPublicTrackingFiles(files) {
  if (!Array.isArray(files)) return [];

  return files
    .filter(file => file && (
      file.preview_url || file.thumbnail_url
    ))
    .map(file => ({
      type: file.type || null,
      preview_url: file.preview_url || null,
      thumbnail_url: file.thumbnail_url || null
    }));
}

function formatPublicTrackingItem(item) {
  const product = item.product;

  return {
    id: item.id,
    external_id: item.external_id || null,
    variant_id: item.variant_id || null,
    sync_variant_id: item.sync_variant_id || null,
    quantity: item.quantity,
    name: item.name,
    retail_price: item.retail_price,
    sku: item.sku || null,
    files: formatPublicTrackingFiles(item.files),
    product: product ? {
      name: product.name || item.name,
      image: product.image || null,
      portada: product.portada || product.image || null,
      imagen: product.imagen || product.image || null
    } : null,
    variedade: item.variedade ? {
      files: formatPublicTrackingFiles(item.variedade.files)
    } : null
  };
}

function formatLocalItems(saleDetails) {
  if (!saleDetails || saleDetails.length === 0) return [];
  
  return saleDetails.map(detail => ({
    id: detail.id,
    external_id: detail.id.toString(),
    variant_id: detail.variedadId,
    sync_variant_id: detail.variedadId,
    quantity: detail.cantidad,
    name: detail.product?.title || detail.code_discount || 'Producto',
    retail_price: detail.price_unitario?.toString() || '0',
    // ✅ Incluir archivos de la variedad (mockups con diseño aplicado)
    files: detail.variedad?.files || [],
    options: [],
    sku: detail.product?.sku || null,
    // ✅ Campo para productos externos (cuando productId es null)
    code_discount: detail.code_discount || null,
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
function generateTimeline(status, sale, lifecycle) {
  const productionCompleted = lifecycle.fullyShipped;

  return [
    {
      type: 'order_received',
      status: lifecycle.confirmed
        ? 'completed'
        : 'processing',
      title: 'Pedido recibido',
      description: 'Hemos recibido tu pedido',
      date: normalizeTrackingDate(sale.createdAt),
      completed: lifecycle.confirmed
    },
    {
      type: 'processing',
      status: lifecycle.productionStarted ? 'completed' :
        status === 'pending' ? 'processing' : 'pending',
      title: 'Preparando pedido',
      description: 'Preparación de tu pedido',
      date: null,
      completed: lifecycle.productionStarted
    },
    {
      type: 'manufacturing',
      status: productionCompleted ? 'completed' :
        lifecycle.productionStarted ? 'processing' : 'pending',
      title: 'En producción',
      description: 'Fabricación de tus artículos',
      date: null,
      completed: productionCompleted
    },
    {
      type: 'shipped',
      status: lifecycle.fullyShipped ? 'completed' :
        lifecycle.partiallyShipped ? 'processing' : 'pending',
      title: 'Enviado',
      description: lifecycle.fullyShipped
        ? 'Tu pedido está en camino'
        : lifecycle.partiallyShipped
          ? 'Parte de tu pedido ha sido enviada'
          : 'Pendiente de envío',
      date: lifecycle.fullyShipped
        ? lifecycle.shippedAt
        : null,
      completed: lifecycle.fullyShipped
    },
    {
      type: 'delivered',
      status: lifecycle.fullyDelivered
        ? 'completed'
        : 'pending',
      title: 'Entregado',
      description: lifecycle.fullyDelivered
        ? 'Tu pedido ha sido entregado'
        : 'Pendiente de entrega',
      date: lifecycle.deliveredAt,
      completed: lifecycle.fullyDelivered
    }
  ];
}
