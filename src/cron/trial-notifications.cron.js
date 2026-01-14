import cron from 'node-cron';
import { Op } from 'sequelize';
import { Tenant } from '../models/Tenant.js';
import { sendTrialExpiringEmail, sendTrialExpiredEmail } from '../controllers/saas-email.controller.js';

/**
 * 🕐 Cron Job: Trial Expiry Notifications
 * 
 * Ejecuta diariamente a las 9:00 AM (hora del servidor)
 * Envía emails de notificación a tenants cuyos trials están por expirar
 */

export const startTrialNotificationsCron = () => {
  
  // Ejecutar todos los días a las 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('⏰ [Cron] Ejecutando verificación de trials por expirar...');
    
    try {
      const now = new Date();
      
      // Calcular fecha de 3 días en el futuro
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      threeDaysFromNow.setHours(23, 59, 59, 999); // Fin del día +3
      
      const threeDaysStart = new Date();
      threeDaysStart.setDate(threeDaysStart.getDate() + 3);
      threeDaysStart.setHours(0, 0, 0, 0); // Inicio del día +3
      
      console.log('🔍 [Cron] Buscando trials que expiran en 3 días:', {
        desde: threeDaysStart.toISOString(),
        hasta: threeDaysFromNow.toISOString()
      });
      
      // Buscar tenants en trial que expiran en exactamente 3 días
      const expiringTrials = await Tenant.findAll({
        where: {
          status: 'trial',
          trial_ends_at: {
            [Op.between]: [threeDaysStart, threeDaysFromNow]
          }
        }
      });
      
      console.log(`📊 [Cron] Encontrados ${expiringTrials.length} trials expirando en 3 días`);
      
      // Enviar emails de advertencia
      for (const tenant of expiringTrials) {
        console.log(`📧 [Cron] Enviando email de advertencia a: ${tenant.email} (expira: ${tenant.trial_ends_at})`);
        
        try {
          await sendTrialExpiringEmail(tenant.id);
          console.log(`✅ [Cron] Email enviado a ${tenant.email}`);
        } catch (error) {
          console.error(`❌ [Cron] Error enviando email a ${tenant.email}:`, error.message);
        }
      }
      
      // ====================================================
      // PARTE 2: Detectar trials que expiraron HOY
      // ====================================================
      
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      
      console.log('🔍 [Cron] Buscando trials que expiraron hoy:', {
        desde: todayStart.toISOString(),
        hasta: todayEnd.toISOString()
      });
      
      // Buscar tenants en trial que expiraron hoy
      const expiredTrialsToday = await Tenant.findAll({
        where: {
          status: 'trial', // Aún en status trial
          trial_ends_at: {
            [Op.between]: [todayStart, todayEnd]
          }
        }
      });
      
      console.log(`📊 [Cron] Encontrados ${expiredTrialsToday.length} trials expirados hoy`);
      
      // Actualizar status y enviar emails
      for (const tenant of expiredTrialsToday) {
        console.log(`❌ [Cron] Trial expirado para: ${tenant.email}`);
        
        try {
          // Actualizar status a expired
          await tenant.update({ status: 'expired' });
          
          // Enviar email de trial expirado
          await sendTrialExpiredEmail(tenant.id);
          console.log(`✅ [Cron] Email de expiración enviado a ${tenant.email}`);
        } catch (error) {
          console.error(`❌ [Cron] Error procesando trial expirado para ${tenant.email}:`, error.message);
        }
      }
      
      console.log('✅ [Cron] Verificación de trials completada');
      
    } catch (error) {
      console.error('❌ [Cron] Error en verificación de trials:', error);
    }
  });
  
  console.log('✅ [Cron] Trial notifications scheduler iniciado - ejecutará diariamente a las 9:00 AM');
};

/**
 * 🕐 Cron Job Manual para Testing
 * Ejecuta inmediatamente la lógica de notificaciones
 */
export const runTrialNotificationsNow = async () => {
  console.log('🧪 [Cron TEST] Ejecutando verificación manual de trials...');
  
  try {
    const now = new Date();
    
    // Calcular fecha de 3 días en el futuro
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    threeDaysFromNow.setHours(23, 59, 59, 999);
    
    const threeDaysStart = new Date();
    threeDaysStart.setDate(threeDaysStart.getDate() + 3);
    threeDaysStart.setHours(0, 0, 0, 0);
    
    console.log('🔍 [Cron TEST] Rango de búsqueda (3 días):', {
      desde: threeDaysStart.toISOString(),
      hasta: threeDaysFromNow.toISOString()
    });
    
    const expiringTrials = await Tenant.findAll({
      where: {
        status: 'trial',
        trial_ends_at: {
          [Op.between]: [threeDaysStart, threeDaysFromNow]
        }
      }
    });
    
    console.log(`📊 [Cron TEST] Encontrados ${expiringTrials.length} trials expirando`);
    
    for (const tenant of expiringTrials) {
      console.log(`   - ${tenant.email}: expira ${tenant.trial_ends_at}`);
    }
    
    // Buscar trials expirados hoy
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    const expiredTrialsToday = await Tenant.findAll({
      where: {
        status: 'trial',
        trial_ends_at: {
          [Op.between]: [todayStart, todayEnd]
        }
      }
    });
    
    console.log(`📊 [Cron TEST] Encontrados ${expiredTrialsToday.length} trials expirados hoy`);
    
    for (const tenant of expiredTrialsToday) {
      console.log(`   - ${tenant.email}: expiró ${tenant.trial_ends_at}`);
    }
    
    return {
      expiringSoon: expiringTrials.length,
      expiredToday: expiredTrialsToday.length
    };
    
  } catch (error) {
    console.error('❌ [Cron TEST] Error:', error);
    throw error;
  }
};
