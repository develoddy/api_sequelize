import cron from 'node-cron';
import { Op } from 'sequelize';
import { MailflowContact } from '../models/MailflowContact.js';
import { MailflowSequence } from '../models/MailflowSequence.js';
import { sendMailflowEmail, processRetries } from '../services/mailflowSender.service.js';

/**
 * MailFlow Sender Cron Job - PRODUCTION READY
 * 
 * Envía emails de sequences automáticamente cada 15 minutos
 * Procesa contactos que tienen nextEmailAt <= NOW
 * 
 * MEJORAS IMPLEMENTADAS:
 * - Lock para evitar ejecuciones concurrentes
 * - Logging completo de envíos (tabla mailflow_email_logs)
 * - Prevención de duplicados (idempotencia garantizada)
 * - Sistema de reintentos automáticos con exponential backoff
 * - Manejo granular de errores SMTP
 * - Auditoría completa para debugging
 * 
 * CRÍTICO: Este es el corazón del MVP - sin esto, MailFlow no funciona
 */

// ===== LOCK SYSTEM =====
// Previene ejecuciones concurrentes del cron job
let isRunning = false;
let lastExecutionTime = null;
let executionCount = 0;

/**
 * Enviar el próximo email de una sequence a un contacto
 * NUEVA VERSIÓN CON EXACTLY-ONCE DELIVERY
 * 
 * @param {Object} contact - Contacto con sequence incluida
 * @param {string} executionId - ID único de esta ejecución del cron para tracking
 */
async function sendNextEmail(contact, executionId = null) {
  try {
    const sequence = contact.MailflowSequence;
    
    // Parsear emails si viene como string desde DB
    const emails = typeof sequence.emails === 'string' ? JSON.parse(sequence.emails) : (sequence.emails || []);
    const emailConfig = emails[contact.currentEmailIndex];
    
    if (!emailConfig) {
      // No hay más emails en la sequence, marcar como completed
      contact.status = 'completed';
      await contact.save();
      console.log(`✅ [MAILFLOW] Sequence completed for ${contact.email}`);
      return { success: true, completed: true };
    }

    // Reemplazar variables en subject y body
    const name = contact.name || 'there';
    const subject = (emailConfig.subject || '').replace(/\{\{name\}\}/g, name);
    const bodyHtml = (emailConfig.bodyHtml || emailConfig.bodyText || '').replace(/\{\{name\}\}/g, name);

    console.log(`📧 [MAILFLOW] Enviando email ${contact.currentEmailIndex + 1} a ${contact.email}`);
    console.log(`   Subject: ${subject}`);

    // ===== ENVIAR EMAIL CON SERVICIO ROBUSTO (EXACTLY-ONCE DELIVERY) =====
    const result = await sendMailflowEmail(
      contact,
      contact.currentEmailIndex,
      subject,
      bodyHtml,
      1, // attemptNumber inicial
      executionId // Tracking de ejecución
    );

    // ===== PROCESAR RESULTADO =====
    if (result.success) {
      // Email enviado exitosamente
      contact.currentEmailIndex++;
      contact.lastEmailSentAt = new Date();
      
      // Actualizar stats del contacto
      const contactStats = typeof contact.stats === 'string' ? JSON.parse(contact.stats) : (contact.stats || {});
      contactStats.sent = (contactStats.sent || 0) + 1;
      contact.stats = contactStats;
      
      // Calcular próximo email (si existe)
      if (contact.currentEmailIndex < emails.length) {
        const nextEmail = emails[contact.currentEmailIndex];
        const delayHours = nextEmail.delayHours || 0;
        const delayMs = delayHours * 3600000; // horas a milisegundos
        contact.nextEmailAt = new Date(Date.now() + delayMs);
        console.log(`   ⏰ Próximo email programado para: ${contact.nextEmailAt}`);
      } else {
        // Era el último email
        contact.status = 'completed';
        contact.nextEmailAt = null;
        console.log(`   ✅ Era el último email - contacto completado`);
      }
      
      await contact.save();

      // Actualizar stats de la sequence
      const sequenceStats = typeof sequence.stats === 'string' ? JSON.parse(sequence.stats) : (sequence.stats || {});
      sequenceStats.sent = (sequenceStats.sent || 0) + 1;
      sequence.stats = sequenceStats;
      await sequence.save();

      console.log(`✅ [MAILFLOW] Email enviado exitosamente a ${contact.email}`);
      return { success: true, sent: true };

    } else if (result.isDuplicate) {
      // Email duplicado bloqueado - avanzar índice pero no enviar
      console.warn(`⚠️ [MAILFLOW] Duplicado bloqueado para ${contact.email} - avanzando índice`);
      
      contact.currentEmailIndex++;
      
      // Calcular próximo email
      if (contact.currentEmailIndex < emails.length) {
        const nextEmail = emails[contact.currentEmailIndex];
        const delayHours = nextEmail.delayHours || 0;
        const delayMs = delayHours * 3600000;
        contact.nextEmailAt = new Date(Date.now() + delayMs);
      } else {
        contact.status = 'completed';
        contact.nextEmailAt = null;
      }
      
      await contact.save();
      return { success: true, duplicate: true };

    } else if (result.shouldRetry) {
      // Error temporal - programar reintento
      console.warn(`⚠️ [MAILFLOW] Error temporal enviando a ${contact.email} - reintento programado`);
      
      // NO actualizar currentEmailIndex (se reintentará el mismo email)
      // NO actualizar nextEmailAt (el reintento se maneja en mailflow_email_logs)
      // El sistema de reintentos manejará este email automáticamente
      
      return { success: true, retry: true };

    } else {
      // Error permanente - marcar como failed
      console.error(`❌ [MAILFLOW] Error permanente enviando a ${contact.email}`);
      
      contact.status = 'failed';
      contact.nextEmailAt = null;
      await contact.save();
      
      // Actualizar stats de failed en sequence
      const sequenceStats = typeof sequence.stats === 'string' ? JSON.parse(sequence.stats) : (sequence.stats || {});
      sequenceStats.failed = (sequenceStats.failed || 0) + 1;
      sequence.stats = sequenceStats;
      await sequence.save();

      return { success: false, error: result.error };
    }

  } catch (error) {
    console.error(`❌ [MAILFLOW] Error crítico procesando ${contact.email}:`, error);
    
    // En caso de error no manejado, marcar como failed
    contact.status = 'failed';
    contact.nextEmailAt = null;
    await contact.save();
    
    return { success: false, error: error.message };
  }
}

/**
 * Iniciar cron job de MailFlow - PRODUCTION READY
 * Ejecuta cada 15 minutos con sistema de lock
 */
export function startMailflowSenderCron() {
  console.log('📧 [MAILFLOW CRON] Iniciando MailFlow Sender Cron Job (PRODUCTION MODE)...');
  console.log('   🔒 Lock system: ENABLED');
  console.log('   🔄 Retry system: ENABLED');
  console.log('   📝 Logging: ENABLED (mailflow_email_logs table)');
  console.log('   🛡️ Duplicate prevention: ENABLED');
  
  // Ejecutar cada 15 minutos: */15 * * * *
  cron.schedule('*/15 * * * *', async () => {
    const executionStartTime = Date.now();
    executionCount++;
    
    // ===== GENERAR EXECUTION ID ÚNICO =====
    const executionId = `cron-${Date.now()}-${executionCount}`;
    
    console.log('\n📧 [MAILFLOW CRON] ========================================');
    console.log(`📧 [MAILFLOW CRON] Ejecutando envío automático #${executionCount}`);
    console.log(`📧 [MAILFLOW CRON] Execution ID: ${executionId}`);
    console.log('📧 [MAILFLOW CRON] Timestamp:', new Date().toISOString());
    console.log('📧 [MAILFLOW CRON] ========================================\n');
    
    // ===== CHECK LOCK =====
    if (isRunning) {
      console.warn('⚠️ [MAILFLOW CRON] EJECUCIÓN YA EN PROGRESO - BLOQUEANDO');
      console.warn('⚠️ [MAILFLOW CRON] La ejecución anterior aún no ha terminado');
      if (lastExecutionTime) {
        const timeSinceLastExecution = Date.now() - lastExecutionTime;
        console.warn(`⚠️ [MAILFLOW CRON] Tiempo desde última ejecución: ${timeSinceLastExecution}ms`);
      }
      return; // BLOQUEAR EJECUCIÓN CONCURRENTE
    }
    
    // ===== ACQUIRE LOCK =====
    isRunning = true;
    lastExecutionTime = Date.now();
    
    try {
      // ===== PASO 1: PROCESAR REINTENTOS PENDIENTES =====
      console.log('🔄 [MAILFLOW CRON] PASO 1: Procesando reintentos...');
      const retryResults = await processRetries();
      console.log(`🔄 [MAILFLOW CRON] Reintentos procesados: ${retryResults.processed} (${retryResults.succeeded} exitosos, ${retryResults.failed} fallidos)`);
      
      // ===== PASO 2: BUSCAR EMAILS PENDIENTES =====
      console.log('\n📧 [MAILFLOW CRON] PASO 2: Buscando emails pendientes...');
      const dueContacts = await MailflowContact.findAll({
        where: {
          status: 'active',
          nextEmailAt: { [Op.lte]: new Date() }
        },
        include: [{
          model: MailflowSequence,
          as: 'MailflowSequence',
          required: true,
          where: { status: 'active' }
        }],
        limit: 50 // Procesar máximo 50 emails por ejecución (rate limiting)
      });

      if (dueContacts.length === 0) {
        console.log('📧 [MAILFLOW CRON] No hay emails pendientes para enviar');
      } else {
        console.log(`📧 [MAILFLOW CRON] Encontrados ${dueContacts.length} emails pendientes\n`);

        // ===== PASO 3: ENVIAR EMAILS =====
        let sent = 0;
        let duplicates = 0;
        let retries = 0;
        let failed = 0;

        for (const contact of dueContacts) {
          const result = await sendNextEmail(contact, executionId); // Pasar executionId
          
          if (result.sent) sent++;
          else if (result.duplicate) duplicates++;
          else if (result.retry) retries++;
          else failed++;
          
          // Pequeño delay entre emails para no saturar SMTP (500ms)
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log(`\n✅ [MAILFLOW CRON] Procesamiento completado:`);
        console.log(`   ✅ Enviados: ${sent}`);
        console.log(`   ⚠️ Duplicados bloqueados: ${duplicates}`);
        console.log(`   🔄 Programados para reintento: ${retries}`);
        console.log(`   ❌ Fallidos permanentemente: ${failed}`);
      }

      // ===== RESUMEN DE EJECUCIÓN =====
      const executionDuration = Date.now() - executionStartTime;
      console.log(`\n📊 [MAILFLOW CRON] Ejecución #${executionCount} completada en ${executionDuration}ms`);
      
    } catch (error) {
      console.error('❌ [MAILFLOW CRON] Error crítico en cron job:', error);
      console.error('Stack:', error.stack);
    } finally {
      // ===== RELEASE LOCK =====
      isRunning = false;
      console.log('🔓 [MAILFLOW CRON] Lock liberado\n');
    }
  }, {
    timezone: "Europe/Madrid"
  });

  console.log('✅ [MAILFLOW CRON] Cron job configurado');
  console.log('   📅 Frecuencia: Cada 15 minutos');
  console.log('   🌍 Timezone: Europe/Madrid');
  console.log('   📧 Límite por ejecución: 50 emails nuevos');
  console.log('   🔄 Reintentos: Máximo 20 por ejecución');
  console.log('   🔒 Protección: Lock contra ejecuciones concurrentes\n');
}

/**
 * Ejecutar envío manual (para testing)
 * Útil para probar sin esperar 15 minutos
 */
export async function runMailflowSendNow() {
  console.log('🚀 [MAILFLOW TEST] Ejecutando envío manual...');
  
  const executionId = `manual-${Date.now()}`;
  console.log(`🚀 [MAILFLOW TEST] Execution ID: ${executionId}`);
  
  try {
    const dueContacts = await MailflowContact.findAll({
      where: {
        status: 'active',
        nextEmailAt: { [Op.lte]: new Date() }
      },
      include: [{
        model: MailflowSequence,
        as: 'MailflowSequence',
        required: true,
        where: { status: 'active' }
      }],
      limit: 50
    });

    console.log(`📧 [MAILFLOW TEST] Encontrados ${dueContacts.length} emails pendientes`);

    for (const contact of dueContacts) {
      await sendNextEmail(contact, executionId);
    }
    
    return {
      success: true,
      processed: dueContacts.length,
      message: `${dueContacts.length} emails enviados`
    };
    
  } catch (error) {
    console.error('❌ [MAILFLOW TEST] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
