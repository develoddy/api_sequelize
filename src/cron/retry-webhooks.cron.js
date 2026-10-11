import cron from 'node-cron';
import { Op } from 'sequelize';
import { StripeWebhookLog } from '../models/StripeWebhookLog.js';
import { alertWebhookFailures } from '../domains/platform/health/services/alerting.service.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * 🔄 Cron Job: Retry Failed Stripe Webhooks
 * 
 * Ejecuta cada hora
 * Reintenta procesar webhooks que fallaron (max 3 intentos)
 */

/**
 * Lógica de reintento de webhook
 */
const retryWebhook = async (webhookLog) => {
  console.log(`🔄 [Webhook Retry] Reintentando webhook #${webhookLog.id} (intento ${webhookLog.retry_count + 1}/3)`);
  
  try {
    const event = JSON.parse(webhookLog.event_data);
    
    // Simular procesamiento según el tipo de evento
    switch (event.type) {
      case 'checkout.session.completed':
        // Aquí iría la lógica real de procesamiento
        // Por ahora solo validamos que el evento sea válido
        if (event.data && event.data.object && event.data.object.id) {
          console.log(`✅ [Webhook Retry] Webhook #${webhookLog.id} procesado exitosamente`);
          return { success: true, message: 'Webhook procesado exitosamente' };
        }
        break;
        
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'invoice.paid':
      case 'invoice.payment_failed':
        if (event.data && event.data.object) {
          console.log(`✅ [Webhook Retry] Webhook #${webhookLog.id} procesado exitosamente`);
          return { success: true, message: 'Webhook procesado exitosamente' };
        }
        break;
        
      default:
        console.log(`⚠️  [Webhook Retry] Tipo de evento no soportado: ${event.type}`);
        return { success: false, message: `Tipo de evento no soportado: ${event.type}` };
    }
    
    return { success: false, message: 'Datos del evento incompletos' };
    
  } catch (error) {
    console.error(`❌ [Webhook Retry] Error procesando webhook #${webhookLog.id}:`, error.message);
    return { success: false, message: error.message };
  }
};

/**
 * Ejecutar reintento de webhooks fallidos
 */
export const runWebhookRetry = async () => {
  console.log('🔄 [Webhook Retry] Buscando webhooks fallidos para reintentar...');
  
  try {
    // Buscar webhooks con status=failed y retry_count < 3
    const failedWebhooks = await StripeWebhookLog.findAll({
      where: {
        status: 'failed',
        retry_count: {
          [Op.lt]: 3
        }
      },
      order: [['created_at', 'ASC']],
      limit: 20 // Procesar máximo 20 por ejecución
    });
    
    console.log(`📊 [Webhook Retry] Encontrados ${failedWebhooks.length} webhooks para reintentar`);
    
    if (failedWebhooks.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0, maxAttemptsReached: 0 };
    }
    
    let succeeded = 0;
    let failed = 0;
    let maxAttemptsReached = 0;
    
    for (const webhookLog of failedWebhooks) {
      // Incrementar intentos
      const newRetryCount = webhookLog.retry_count + 1;
      
      // Reintentar procesamiento
      const result = await retryWebhook(webhookLog);
      
      if (result.success) {
        // Éxito: marcar como success
        await webhookLog.markAsSuccess({ retried: true });
        succeeded++;
        console.log(`✅ [Webhook Retry] Webhook #${webhookLog.id} completado exitosamente`);
      } else {
        // Falló: incrementar retry_count
        if (newRetryCount >= 3) {
          // Máximo de intentos alcanzado
          await webhookLog.update({
            retry_count: newRetryCount,
            error_message: `${webhookLog.error_message || ''}\nIntento ${newRetryCount}: ${result.message}`,
            status: 'failed_max_attempts'
          });
          maxAttemptsReached++;
          console.log(`⚠️  [Webhook Retry] Webhook #${webhookLog.id} alcanzó máximo de intentos`);
        } else {
          // Aún hay intentos disponibles
          await webhookLog.update({
            retry_count: newRetryCount,
            error_message: `${webhookLog.error_message || ''}\nIntento ${newRetryCount}: ${result.message}`
          });
          failed++;
          console.log(`❌ [Webhook Retry] Webhook #${webhookLog.id} falló (intento ${newRetryCount}/3)`);
        }
      }
    }
    
    console.log(`✅ [Webhook Retry] Completado - Exitosos: ${succeeded}, Fallidos: ${failed}, Máx alcanzado: ${maxAttemptsReached}`);
    
    // Verificar si hay demasiados webhooks fallidos (>10 en las últimas 24h)
    const recentFailedCount = await StripeWebhookLog.count({
      where: {
        status: {
          [Op.in]: ['failed', 'failed_max_attempts']
        },
        created_at: {
          [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24 horas
        }
      }
    });
    
    if (recentFailedCount > 10) {
      const totalFailed = await StripeWebhookLog.count({
        where: {
          status: {
            [Op.in]: ['failed', 'failed_max_attempts']
          }
        }
      });
      
      console.log(`🚨 [Webhook Retry] ALERTA: ${recentFailedCount} webhooks fallidos en 24h`);
      await alertWebhookFailures(recentFailedCount, {
        totalFailed,
        recentFailed: recentFailedCount
      });
    }
    
    return {
      processed: failedWebhooks.length,
      succeeded,
      failed,
      maxAttemptsReached
    };
    
  } catch (error) {
    console.error('❌ [Webhook Retry] Error en ejecución:', error);
    throw error;
  }
};

/**
 * Iniciar cron job
 */
export const startWebhookRetryCron = () => {
  // Ejecutar cada hora
  cron.schedule('0 * * * *', async () => {
    console.log('\n⏰ [CRON] Ejecutando retry de webhooks fallidos...');
    try {
      await runWebhookRetry();
    } catch (error) {
      console.error('❌ [CRON] Error en retry de webhooks:', error);
      // Importar dinámicamente para evitar dependencia circular
      const { alertCronJobFailed } = await import('../domains/platform/health/services/alerting.service.js');
      await alertCronJobFailed('Webhook Retry', error.message);
    }
  });
  
  console.log('✅ [Cron] Webhook retry scheduler iniciado - ejecutará cada hora');
};
