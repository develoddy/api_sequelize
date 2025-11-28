/**
 * Admin Retry Controller
 * 
 * Controlador para el admin panel que permite:
 * - Ver lista de órdenes fallidas
 * - Retry manual de órdenes
 * - Ver historial de intentos
 * - Editar datos y re-sync
 * - Cancelar jobs en queue
 * 
 * @file src/controllers/proveedor/adminRetry.controller.js
 * @module AdminRetryController
 * @version 1.0.0
 * @sprint Sprint 6D - Intelligent Error Handling & Recovery
 */

import { Sale } from '../../models/Sale.js';
import { SaleDetail } from '../../models/SaleDetail.js';
import { SaleAddress } from '../../models/SaleAddress.js';
import { User } from '../../models/User.js';
import { Guest } from '../../models/Guest.js';
import { Product } from '../../models/Product.js';
import { Variedad } from '../../models/Variedad.js';
import RetryQueue from '../../models/RetryQueue.js';
import {
  getFailedJobs,
  getJobHistory,
  resetJobForRetry,
  cancelJob,
  markAsResolved
} from '../../services/retryQueue.service.js';
import { autoSyncOrderToPrintful } from '../../services/autoSyncPrintful.service.js';

/**
 * GET /api/printful/admin/failed-orders
 * Lista todas las órdenes fallidas y pendientes de retry
 */
export const getFailedOrders = async (req, res) => {
  try {
    console.log('📋 [ADMIN] Obteniendo lista de órdenes fallidas...');

    const { errorType, status, limit = 50 } = req.query;

    // Filtros opcionales
    const filters = {};
    if (errorType) filters.errorType = errorType;

    const jobs = await getFailedJobs(filters);

    // Aplicar filtro de status si se especifica
    let filteredJobs = jobs;
    if (status) {
      filteredJobs = jobs.filter(job => job.status === status);
    }

    // Limitar resultados
    const limitedJobs = filteredJobs.slice(0, parseInt(limit));

    // Formatear respuesta
    const formattedJobs = limitedJobs.map(job => ({
      jobId: job.id,
      saleId: job.saleId,
      status: job.status,
      errorType: job.errorType,
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
      attemptCount: job.attemptCount,
      maxAttempts: job.maxAttempts,
      nextRetryAt: job.nextRetryAt,
      customer: job.metadata?.customerName || 'Unknown',
      customerEmail: job.metadata?.customerEmail,
      amount: job.metadata?.amount,
      currency: job.metadata?.currency,
      transactionId: job.metadata?.transactionId,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      sale: job.Sale ? {
        id: job.Sale.id,
        n_transaction: job.Sale.n_transaction,
        total: job.Sale.total,
        syncStatus: job.Sale.syncStatus,
        printfulOrderId: job.Sale.printfulOrderId
      } : null
    }));

    console.log(`✅ [ADMIN] ${formattedJobs.length} órdenes fallidas encontradas`);

    res.status(200).json({
      success: true,
      count: formattedJobs.length,
      total: filteredJobs.length,
      jobs: formattedJobs
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error obteniendo órdenes fallidas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener órdenes fallidas',
      error: error.message
    });
  }
};

/**
 * GET /api/printful/admin/retry-logs/:jobId
 * Obtiene el historial detallado de intentos de un job específico
 */
export const getRetryLogs = async (req, res) => {
  try {
    const { jobId } = req.params;

    console.log(`📋 [ADMIN] Obteniendo logs de Job #${jobId}...`);

    const job = await getJobHistory(jobId);

    const formattedJob = {
      jobId: job.id,
      saleId: job.saleId,
      status: job.status,
      errorType: job.errorType,
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
      lastError: job.lastError,
      attemptCount: job.attemptCount,
      maxAttempts: job.maxAttempts,
      nextRetryAt: job.nextRetryAt,
      retryHistory: job.retryHistory || [],
      errorData: job.errorData,
      metadata: job.metadata,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      resolvedAt: job.resolvedAt,
      cancelledAt: job.cancelledAt,
      cancelledBy: job.cancelledBy,
      cancelReason: job.cancelReason,
      sale: job.Sale ? {
        id: job.Sale.id,
        n_transaction: job.Sale.n_transaction,
        total: job.Sale.total,
        syncStatus: job.Sale.syncStatus,
        printfulOrderId: job.Sale.printfulOrderId,
        errorMessage: job.Sale.errorMessage,
        customer: job.Sale.User || job.Sale.Guest
      } : null
    };

    console.log(`✅ [ADMIN] Logs de Job #${jobId} obtenidos (${formattedJob.retryHistory.length} intentos)`);

    res.status(200).json({
      success: true,
      job: formattedJob
    });

  } catch (error) {
    console.error(`❌ [ADMIN] Error obteniendo logs de Job #${req.params.jobId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener logs del job',
      error: error.message
    });
  }
};

/**
 * POST /api/printful/admin/retry/:saleId
 * Retry manual de una orden fallida
 */
export const retryFailedOrder = async (req, res) => {
  try {
    const { saleId } = req.params;

    console.log(`🔄 [ADMIN] Iniciando retry manual para Sale #${saleId}...`);

    // Verificar que la venta existe
    const sale = await Sale.findByPk(saleId);
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: `Sale #${saleId} no encontrada`
      });
    }

    // Buscar job existente en queue
    const existingJob = await RetryQueue.findOne({
      where: {
        saleId,
        status: ['pending', 'processing', 'failed']
      }
    });

    // Si existe un job, resetearlo
    if (existingJob) {
      console.log(`🔄 [ADMIN] Reseteando Job #${existingJob.id} existente...`);
      await resetJobForRetry(existingJob.id);
    }

    // Ejecutar sync inmediatamente
    console.log(`📤 [ADMIN] Ejecutando sync de Sale #${saleId}...`);
    const syncResult = await autoSyncOrderToPrintful(saleId);

    if (syncResult.success) {
      // Si el job existía, marcarlo como resuelto
      if (existingJob) {
        await markAsResolved(existingJob.id);
      }

      console.log(`✅ [ADMIN] Sale #${saleId} sincronizado exitosamente`);

      res.status(200).json({
        success: true,
        message: 'Orden sincronizada exitosamente',
        saleId,
        printfulOrderId: syncResult.printfulOrderId,
        result: syncResult
      });

    } else {
      console.log(`❌ [ADMIN] Sale #${saleId} falló en retry: ${syncResult.message}`);

      res.status(200).json({
        success: false,
        message: 'Retry falló',
        saleId,
        errorType: syncResult.errorType,
        errorMessage: syncResult.message,
        retryable: syncResult.retryable,
        recommendedAction: syncResult.recommendedAction,
        result: syncResult
      });
    }

  } catch (error) {
    console.error(`❌ [ADMIN] Error en retry manual de Sale #${req.params.saleId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error al ejecutar retry',
      error: error.message
    });
  }
};

/**
 * POST /api/printful/admin/cancel-job/:jobId
 * Cancela un job en la queue
 */
export const cancelRetryJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { reason, cancelledBy } = req.body;

    console.log(`🚫 [ADMIN] Cancelando Job #${jobId}...`);

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere "reason" para cancelar el job'
      });
    }

    const job = await cancelJob(
      jobId,
      reason,
      cancelledBy || 'Admin'
    );

    console.log(`✅ [ADMIN] Job #${jobId} cancelado exitosamente`);

    res.status(200).json({
      success: true,
      message: 'Job cancelado exitosamente',
      job: {
        id: job.id,
        saleId: job.saleId,
        status: job.status,
        cancelledAt: job.cancelledAt,
        cancelledBy: job.cancelledBy,
        cancelReason: job.cancelReason
      }
    });

  } catch (error) {
    console.error(`❌ [ADMIN] Error cancelando Job #${req.params.jobId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error al cancelar job',
      error: error.message
    });
  }
};

/**
 * PATCH /api/printful/admin/edit-and-retry/:saleId
 * Edita datos de una venta (dirección, productos) y ejecuta retry
 */
export const editAndRetry = async (req, res) => {
  try {
    const { saleId } = req.params;
    const { address, products } = req.body;

    console.log(`✏️ [ADMIN] Editando y reintentando Sale #${saleId}...`);

    // Verificar que la venta existe
    const sale = await Sale.findByPk(saleId, {
      include: [SaleDetail, SaleAddress]
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: `Sale #${saleId} no encontrada`
      });
    }

    // Actualizar dirección si se proporciona
    if (address) {
      console.log(`📝 [ADMIN] Actualizando dirección de Sale #${saleId}...`);
      
      const saleAddress = await SaleAddress.findOne({ where: { saleId } });
      
      if (saleAddress) {
        await saleAddress.update({
          name: address.name || saleAddress.name,
          address: address.address || saleAddress.address,
          ciudad: address.ciudad || saleAddress.ciudad,
          provincia: address.provincia || saleAddress.provincia,
          pais: address.pais || saleAddress.pais,
          zipcode: address.zipcode || saleAddress.zipcode,
          telefono: address.telefono || saleAddress.telefono,
          email: address.email || saleAddress.email
        });
        console.log(`✅ [ADMIN] Dirección actualizada`);
      } else {
        console.warn(`⚠️ [ADMIN] No se encontró SaleAddress para Sale #${saleId}`);
      }
    }

    // Actualizar productos si se proporciona
    if (products && Array.isArray(products)) {
      console.log(`📝 [ADMIN] Actualizando ${products.length} productos...`);
      
      for (const productUpdate of products) {
        const saleDetail = await SaleDetail.findOne({
          where: {
            saleId,
            id: productUpdate.detailId
          }
        });

        if (saleDetail) {
          await saleDetail.update({
            productId: productUpdate.productId || saleDetail.productId,
            variedadId: productUpdate.variedadId || saleDetail.variedadId,
            cantidad: productUpdate.cantidad || saleDetail.cantidad,
            price_unitario: productUpdate.price_unitario || saleDetail.price_unitario
          });
          console.log(`✅ [ADMIN] SaleDetail #${saleDetail.id} actualizado`);
        }
      }
    }

    // Limpiar error message de Sale
    await sale.update({
      errorMessage: null,
      syncStatus: 'pending' // Resetear a pending para retry
    });

    // Buscar y resetear job existente
    const existingJob = await RetryQueue.findOne({
      where: {
        saleId,
        status: ['pending', 'processing', 'failed']
      }
    });

    if (existingJob) {
      await resetJobForRetry(existingJob.id);
    }

    // Ejecutar sync
    console.log(`📤 [ADMIN] Ejecutando sync después de editar...`);
    const syncResult = await autoSyncOrderToPrintful(saleId);

    if (syncResult.success) {
      if (existingJob) {
        await markAsResolved(existingJob.id);
      }

      console.log(`✅ [ADMIN] Sale #${saleId} editado y sincronizado exitosamente`);

      res.status(200).json({
        success: true,
        message: 'Orden editada y sincronizada exitosamente',
        saleId,
        printfulOrderId: syncResult.printfulOrderId,
        updated: {
          address: !!address,
          products: !!products
        },
        result: syncResult
      });

    } else {
      console.log(`❌ [ADMIN] Sale #${saleId} falló después de editar: ${syncResult.message}`);

      res.status(200).json({
        success: false,
        message: 'Edición exitosa pero sync falló',
        saleId,
        updated: {
          address: !!address,
          products: !!products
        },
        errorType: syncResult.errorType,
        errorMessage: syncResult.message,
        result: syncResult
      });
    }

  } catch (error) {
    console.error(`❌ [ADMIN] Error en edit-and-retry de Sale #${req.params.saleId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error al editar y reintentar',
      error: error.message
    });
  }
};

/**
 * GET /api/printful/admin/retry-stats
 * Obtiene estadísticas de la retry queue
 */
export const getRetryStats = async (req, res) => {
  try {
    console.log('📊 [ADMIN] Obteniendo estadísticas de retry queue...');

    const stats = await RetryQueue.findAll({
      attributes: [
        'status',
        'errorType',
        [RetryQueue.sequelize.fn('COUNT', RetryQueue.sequelize.col('id')), 'count']
      ],
      group: ['status', 'errorType']
    });

    const formattedStats = {
      byStatus: {},
      byErrorType: {},
      total: 0
    };

    for (const stat of stats) {
      const status = stat.status;
      const errorType = stat.errorType;
      const count = parseInt(stat.get('count'));

      formattedStats.byStatus[status] = (formattedStats.byStatus[status] || 0) + count;
      formattedStats.byErrorType[errorType] = (formattedStats.byErrorType[errorType] || 0) + count;
      formattedStats.total += count;
    }

    console.log(`✅ [ADMIN] Estadísticas obtenidas: ${formattedStats.total} jobs totales`);

    res.status(200).json({
      success: true,
      stats: formattedStats
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
};

export default {
  getFailedOrders,
  getRetryLogs,
  retryFailedOrder,
  cancelRetryJob,
  editAndRetry,
  getRetryStats
};
