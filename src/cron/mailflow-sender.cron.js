import cron from 'node-cron';
import { Op } from 'sequelize';
import { MailflowContact } from '../models/MailflowContact.js';
import { MailflowSequence } from '../models/MailflowSequence.js';
import emailService from '../services/emailNotification.service.js';

/**
 * MailFlow Sender Cron Job
 * 
 * Envía emails de sequences automáticamente cada 15 minutos
 * Procesa contactos que tienen nextEmailAt <= NOW
 * 
 * CRÍTICO: Este es el corazón del MVP - sin esto, MailFlow no funciona
 */

/**
 * Enviar el próximo email de una sequence a un contacto
 */
async function sendNextEmail(contact) {
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
      return;
    }

    // Reemplazar variables en subject y body
    const name = contact.name || 'there';
    const subject = (emailConfig.subject || '').replace(/\{\{name\}\}/g, name);
    const bodyHtml = (emailConfig.bodyHtml || emailConfig.bodyText || '').replace(/\{\{name\}\}/g, name);

    console.log(`📧 [MAILFLOW] Enviando email ${contact.currentEmailIndex + 1} a ${contact.email}`);
    console.log(`   Subject: ${subject}`);

    // Enviar email usando el servicio existente
    await emailService.sendEmail(
      contact.email,
      subject,
      bodyHtml
    );

    // Actualizar contacto
    contact.currentEmailIndex++;
    contact.lastEmailSentAt = new Date();
    
    // Parsear stats si es string (Sequelize puede devolverlo como string)
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
      contact.nextEmailAt = null; // No hay próximo email
      console.log(`   ✅ Era el último email - contacto completado`);
    }
    
    await contact.save();

    // Actualizar stats de la sequence
    const sequenceStats = typeof sequence.stats === 'string' ? JSON.parse(sequence.stats) : (sequence.stats || {});
    sequenceStats.sent = (sequenceStats.sent || 0) + 1;
    sequence.stats = sequenceStats;
    await sequence.save();

    console.log(`✅ [MAILFLOW] Email enviado exitosamente a ${contact.email}`);

  } catch (error) {
    console.error(`❌ [MAILFLOW] Error enviando email a ${contact.email}:`, error);
    
    // Marcar como failed solo si es un error crítico
    contact.status = 'failed';
    contact.nextEmailAt = null; // Clear invalid date
    await contact.save();
    
    // Actualizar stats de failed en sequence
    const sequence = contact.MailflowSequence;
    const emails = typeof sequence.emails === 'string' ? JSON.parse(sequence.emails) : (sequence.emails || []);
    const sequenceStats = typeof sequence.stats === 'string' ? JSON.parse(sequence.stats) : (sequence.stats || {});
    sequenceStats.failed = (sequenceStats.failed || 0) + 1;
    sequence.stats = sequenceStats;
    await sequence.save();
  }
}

/**
 * Iniciar cron job de MailFlow
 * Ejecuta cada 15 minutos
 */
export function startMailflowSenderCron() {
  console.log('📧 [MAILFLOW CRON] Iniciando MailFlow Sender Cron Job...');
  
  // Ejecutar cada 15 minutos: */15 * * * *
  cron.schedule('*/15 * * * *', async () => {
    console.log('\n📧 [MAILFLOW CRON] ========================================');
    console.log('📧 [MAILFLOW CRON] Ejecutando envío automático de emails');
    console.log('📧 [MAILFLOW CRON] Timestamp:', new Date().toISOString());
    console.log('📧 [MAILFLOW CRON] ========================================\n');
    
    try {
      // Buscar contactos que necesitan recibir email AHORA
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
        return;
      }

      console.log(`📧 [MAILFLOW CRON] Encontrados ${dueContacts.length} emails pendientes`);

      // Enviar emails uno por uno
      for (const contact of dueContacts) {
        await sendNextEmail(contact);
        
        // Pequeño delay entre emails para no saturar SMTP (500ms)
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log(`\n✅ [MAILFLOW CRON] Procesamiento completado: ${dueContacts.length} emails enviados\n`);
      
    } catch (error) {
      console.error('❌ [MAILFLOW CRON] Error crítico en cron job:', error);
    }
  }, {
    timezone: "Europe/Madrid"
  });

  console.log('✅ [MAILFLOW CRON] Cron job configurado');
  console.log('   📅 Frecuencia: Cada 15 minutos');
  console.log('   🌍 Timezone: Europe/Madrid');
  console.log('   📧 Límite por ejecución: 50 emails');
}

/**
 * Ejecutar envío manual (para testing)
 * Útil para probar sin esperar 15 minutos
 */
export async function runMailflowSendNow() {
  console.log('🚀 [MAILFLOW TEST] Ejecutando envío manual...');
  
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
      await sendNextEmail(contact);
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
