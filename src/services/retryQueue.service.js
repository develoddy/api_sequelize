/**
 * Retry Queue Service
 * 
 * Gestiona la cola de reintentos para órdenes fallidas con backoff exponencial.
 * Procesa errores temporales y recuperables automáticamente.
 * 
 * @file src/services/retryQueue.service.js
 * @module RetryQueueService
 * @version 1.0.0
 * @sprint Sprint 6D - Intelligent Error Handling & Recovery
 */

import RetryQueue from '../models/RetryQueue.js';
import { Sale } from '../models/Sale.js';
import { User } from '../models/User.js';
import { Guest } from '../models/Guest.js';
import { Op } from 'sequelize';
import { classifyError, isRetryable, getErrorType } from './errorClassification.service.js';

/**
 * Configuración de backoff exponencial (en minutos)
 */
const BACKOFF_SCHEDULE = {
  1: 5,    // Primer intento: 5 minutos
  2: 15,   // Segundo intento: 15 minutos
  3: 60    // Tercer intento: 1 hora
};

const MAX_ATTEMPTS = 3;

/**
 * Agrega una orden fallida a la cola de reintentos
 * 
 * @param {number} saleId - ID de la venta
 * @param {Object} error - Objeto de error
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Object>} Job creado en la queue
 */
export async function addToQueue(saleId, error, options = {}) {
  try {
    console.log(`📝 [RETRY QUEUE] Agregando Sale #${saleId} a la cola...`);

    // Clasificar el error
    const errorClassification = classifyError(error);
    
    console.log(`🔍 [RETRY QUEUE] Error clasificado como: ${errorClassification.errorType} (${errorClassification.errorCode})`);
    console.log(`🔍 [RETRY QUEUE] Retryable: ${errorClassification.retryable}`);

    // Si no es retryable, no agregar a queue
    if (!errorClassification.retryable) {
      console.log(`⚠️ [RETRY QUEUE] Error tipo '${errorClassification.errorType}' no es retryable. No se agrega a queue.`);
      return null;
    }

    // Verificar si ya existe un job pendiente para esta venta
    const existingJob = await RetryQueue.findOne({
      where: {
        saleId,
        status: {
          [Op.in]: ['pending', 'processing']
        }
      }
    });

    if (existingJob) {
      console.log(`⚠️ [RETRY QUEUE] Ya existe job pendiente para Sale #${saleId} (Job #${existingJob.id})`);
      return existingJob;
    }

    // Obtener metadata de la venta
    const sale = await Sale.findByPk(saleId, {
      include: [
        { model: User, attributes: ['id', 'name', 'surname', 'email'] },
        { model: Guest, attributes: ['id', 'name', 'email'] }
      ]
    });

    if (!sale) {
      console.error(`❌ [RETRY QUEUE] Sale #${saleId} no encontrada`);
      throw new Error(`Sale #${saleId} no encontrada`);
    }

    const customer = sale.User || sale.Guest;
    const metadata = {
      customerName: customer ? (customer.name + (customer.surname ? ` ${customer.surname}` : '')) : 'Unknown',
      customerEmail: customer?.email || 'unknown@example.com',
      amount: sale.total || 0,
      currency: sale.currency_total || 'EUR',
      transactionId: sale.n_transaction || null
    };

    // Calcular nextRetryAt para el primer intento
    const nextRetryAt = calculateNextRetry(1);

    // Crear job en la queue
    const retryJob = await RetryQueue.create({
      saleId,
      attemptCount: 0,
      maxAttempts: options.maxAttempts || MAX_ATTEMPTS,
      nextRetryAt,
      status: 'pending',
      errorType: errorClassification.errorType,
      errorCode: errorClassification.errorCode,
      errorMessage: errorClassification.description,
      errorData: {
        originalError: errorClassification.originalError,
        classification: errorClassification,
        timestamp: new Date()
      },
      lastError: error.message || JSON.stringify(error),
      retryHistory: [],
      priority: options.priority || 0,
      metadata
    });

    console.log(`✅ [RETRY QUEUE] Job #${retryJob.id} creado para Sale #${saleId}`);
    console.log(`⏰ [RETRY QUEUE] Próximo intento programado para: ${nextRetryAt.toLocaleString('es-ES')}`);

    return retryJob;

  } catch (error) {
    console.error('❌ [RETRY QUEUE] Error agregando a queue:', error);
    throw error;
  }
}

/**
 * Procesa todos los jobs pendientes en la cola
 * 
 * @param {Function} processFn - Función para procesar cada job (debe retornar Promise<boolean>)
 * @returns {Promise<Object>} Resultados del procesamiento
 */
export async function processQueue(processFn) {
  try {
    console.log('🔄 [RETRY QUEUE] Iniciando procesamiento de cola...');

    const now = new Date();

    // Buscar jobs listos para procesar
    const jobsToProcess = await RetryQueue.findAll({
      where: {
        status: 'pending',
        nextRetryAt: {
          [Op.lte]: now
        },
        attemptCount: {
          [Op.lt]: MAX_ATTEMPTS
        }
      },
      order: [
        ['priority', 'DESC'],
        ['nextRetryAt', 'ASC']
      ],
      limit: 10 // Procesar máximo 10 a la vez
    });

    if (jobsToProcess.length === 0) {
      console.log('✅ [RETRY QUEUE] No hay jobs pendientes para procesar');
      return {
        success: true,
        processed: 0,
        succeeded: 0,
        failed: 0,
        maxReached: 0
      };
    }

    console.log(`📦 [RETRY QUEUE] Procesando ${jobsToProcess.length} jobs...`);

    let succeeded = 0;
    let failed = 0;
    let maxReached = 0;

    // Procesar cada job
    for (const job of jobsToProcess) {
      try {
        // Marcar como procesando
        await job.update({ status: 'processing' });

        console.log(`\n🔄 [RETRY QUEUE] Procesando Job #${job.id} (Sale #${job.saleId}) - Intento ${job.attemptCount + 1}/${job.maxAttempts}`);

        // Ejecutar función de procesamiento
        const success = await processFn(job);

        if (success) {
          // Éxito - marcar como resuelto
          await markAsResolved(job.id);
          succeeded++;
          console.log(`✅ [RETRY QUEUE] Job #${job.id} procesado exitosamente`);
        } else {
          // Falló - incrementar contador y reprogramar
          const newAttemptCount = job.attemptCount + 1;

          if (newAttemptCount >= job.maxAttempts) {
            // Máximo de intentos alcanzado
            await job.update({
              status: 'failed',
              attemptCount: newAttemptCount,
              lastError: 'Máximo de intentos alcanzado',
              retryHistory: [
                ...job.retryHistory,
                {
                  attempt: newAttemptCount,
                  timestamp: new Date(),
                  success: false,
                  error: 'Max attempts reached'
                }
              ]
            });
            maxReached++;
            console.log(`❌ [RETRY QUEUE] Job #${job.id} alcanzó máximo de intentos (${job.maxAttempts})`);
          } else {
            // Reprogramar siguiente intento
            const nextRetryAt = calculateNextRetry(newAttemptCount + 1);
            await job.update({
              status: 'pending',
              attemptCount: newAttemptCount,
              nextRetryAt,
              retryHistory: [
                ...job.retryHistory,
                {
                  attempt: newAttemptCount,
                  timestamp: new Date(),
                  success: false,
                  error: 'Processing failed'
                }
              ]
            });
            failed++;
            console.log(`⏰ [RETRY QUEUE] Job #${job.id} reprogramado para: ${nextRetryAt.toLocaleString('es-ES')}`);
          }
        }

      } catch (jobError) {
        console.error(`❌ [RETRY QUEUE] Error procesando Job #${job.id}:`, jobError);
        
        // Reprogramar con el siguiente backoff
        const newAttemptCount = job.attemptCount + 1;
        if (newAttemptCount >= job.maxAttempts) {
          await job.update({
            status: 'failed',
            attemptCount: newAttemptCount,
            lastError: jobError.message,
            retryHistory: [
              ...job.retryHistory,
              {
                attempt: newAttemptCount,
                timestamp: new Date(),
                success: false,
                error: jobError.message
              }
            ]
          });
          maxReached++;
        } else {
          const nextRetryAt = calculateNextRetry(newAttemptCount + 1);
          await job.update({
            status: 'pending',
            attemptCount: newAttemptCount,
            nextRetryAt,
            lastError: jobError.message,
            retryHistory: [
              ...job.retryHistory,
              {
                attempt: newAttemptCount,
                timestamp: new Date(),
                success: false,
                error: jobError.message
              }
            ]
          });
          failed++;
        }
      }
    }

    console.log(`\n✅ [RETRY QUEUE] Procesamiento completado:`);
    console.log(`   - Total procesados: ${jobsToProcess.length}`);
    console.log(`   - Exitosos: ${succeeded}`);
    console.log(`   - Fallidos (reprogramados): ${failed}`);
    console.log(`   - Máximo alcanzado: ${maxReached}`);

    return {
      success: true,
      processed: jobsToProcess.length,
      succeeded,
      failed,
      maxReached
    };

  } catch (error) {
    console.error('❌ [RETRY QUEUE] Error en processQueue:', error);
    throw error;
  }
}

/**
 * Calcula la próxima fecha de reintento con backoff exponencial
 * 
 * @param {number} attemptNumber - Número de intento (1, 2, 3)
 * @returns {Date} Fecha del próximo intento
 */
export function calculateNextRetry(attemptNumber) {
  const delayMinutes = BACKOFF_SCHEDULE[attemptNumber] || BACKOFF_SCHEDULE[MAX_ATTEMPTS];
  const nextRetry = new Date();
  nextRetry.setMinutes(nextRetry.getMinutes() + delayMinutes);
  return nextRetry;
}

/**
 * Marca un job como resuelto exitosamente
 * 
 * @param {number} jobId - ID del job
 * @returns {Promise<Object>} Job actualizado
 */
export async function markAsResolved(jobId) {
  try {
    const job = await RetryQueue.findByPk(jobId);
    if (!job) {
      throw new Error(`Job #${jobId} no encontrado`);
    }

    await job.update({
      status: 'resolved',
      resolvedAt: new Date(),
      retryHistory: [
        ...job.retryHistory,
        {
          attempt: job.attemptCount + 1,
          timestamp: new Date(),
          success: true
        }
      ]
    });

    console.log(`✅ [RETRY QUEUE] Job #${jobId} marcado como resuelto`);
    return job;

  } catch (error) {
    console.error(`❌ [RETRY QUEUE] Error marcando job como resuelto:`, error);
    throw error;
  }
}

/**
 * Marca un job como fallido permanentemente
 * 
 * @param {number} jobId - ID del job
 * @param {string} reason - Razón del fallo
 * @returns {Promise<Object>} Job actualizado
 */
export async function markAsFailed(jobId, reason) {
  try {
    const job = await RetryQueue.findByPk(jobId);
    if (!job) {
      throw new Error(`Job #${jobId} no encontrado`);
    }

    await job.update({
      status: 'failed',
      lastError: reason,
      retryHistory: [
        ...job.retryHistory,
        {
          attempt: job.attemptCount + 1,
          timestamp: new Date(),
          success: false,
          error: reason
        }
      ]
    });

    console.log(`❌ [RETRY QUEUE] Job #${jobId} marcado como fallido: ${reason}`);
    return job;

  } catch (error) {
    console.error(`❌ [RETRY QUEUE] Error marcando job como fallido:`, error);
    throw error;
  }
}

/**
 * Cancela un job manualmente
 * 
 * @param {number} jobId - ID del job
 * @param {string} reason - Razón de cancelación
 * @param {string} cancelledBy - Usuario que cancela
 * @returns {Promise<Object>} Job actualizado
 */
export async function cancelJob(jobId, reason, cancelledBy) {
  try {
    const job = await RetryQueue.findByPk(jobId);
    if (!job) {
      throw new Error(`Job #${jobId} no encontrado`);
    }

    await job.update({
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledBy,
      cancelReason: reason
    });

    console.log(`🚫 [RETRY QUEUE] Job #${jobId} cancelado por ${cancelledBy}: ${reason}`);
    return job;

  } catch (error) {
    console.error(`❌ [RETRY QUEUE] Error cancelando job:`, error);
    throw error;
  }
}

/**
 * Obtiene todos los jobs fallidos para el admin panel
 * 
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de jobs fallidos
 */
export async function getFailedJobs(filters = {}) {
  try {
    const where = {
      status: {
        [Op.in]: ['failed', 'pending']
      }
    };

    // Aplicar filtros adicionales
    if (filters.errorType) {
      where.errorType = filters.errorType;
    }

    if (filters.saleId) {
      where.saleId = filters.saleId;
    }

    const jobs = await RetryQueue.findAll({
      where,
      include: [
        {
          model: Sale,
          include: [
            { model: User, attributes: ['id', 'name', 'surname', 'email'] },
            { model: Guest, attributes: ['id', 'name', 'email'] }
          ]
        }
      ],
      order: [
        ['priority', 'DESC'],
        ['createdAt', 'DESC']
      ]
    });

    return jobs;

  } catch (error) {
    console.error('❌ [RETRY QUEUE] Error obteniendo jobs fallidos:', error);
    throw error;
  }
}

/**
 * Obtiene el historial de intentos de un job específico
 * 
 * @param {number} jobId - ID del job
 * @returns {Promise<Object>} Job con historial
 */
export async function getJobHistory(jobId) {
  try {
    const job = await RetryQueue.findByPk(jobId, {
      include: [
        {
          model: Sale,
          include: [
            { model: User, attributes: ['id', 'name', 'surname', 'email'] },
            { model: Guest, attributes: ['id', 'name', 'email'] }
          ]
        }
      ]
    });

    if (!job) {
      throw new Error(`Job #${jobId} no encontrado`);
    }

    return job;

  } catch (error) {
    console.error('❌ [RETRY QUEUE] Error obteniendo historial:', error);
    throw error;
  }
}

/**
 * Reinicia un job para retry manual
 * 
 * @param {number} jobId - ID del job
 * @returns {Promise<Object>} Job actualizado
 */
export async function resetJobForRetry(jobId) {
  try {
    const job = await RetryQueue.findByPk(jobId);
    if (!job) {
      throw new Error(`Job #${jobId} no encontrado`);
    }

    // Resetear contador y programar inmediatamente
    await job.update({
      status: 'pending',
      attemptCount: 0,
      nextRetryAt: new Date(), // Inmediato
      retryHistory: [
        ...job.retryHistory,
        {
          timestamp: new Date(),
          action: 'manual_reset',
          note: 'Job reseteado manualmente por admin'
        }
      ]
    });

    console.log(`🔄 [RETRY QUEUE] Job #${jobId} reseteado para retry manual`);
    return job;

  } catch (error) {
    console.error('❌ [RETRY QUEUE] Error reseteando job:', error);
    throw error;
  }
}

export default {
  addToQueue,
  processQueue,
  calculateNextRetry,
  markAsResolved,
  markAsFailed,
  cancelJob,
  getFailedJobs,
  getJobHistory,
  resetJobForRetry,
  BACKOFF_SCHEDULE,
  MAX_ATTEMPTS
};
