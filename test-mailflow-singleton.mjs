/**
 * Test optimizado de envío con singleton transporter
 * 
 * Este script prueba:
 * 1. Singleton transporter (reutilizar conexión)
 * 2. Rate limiting interno de nodemailer (1 email/segundo)
 * 3. Envío en batch pequeño (5 emails) para evitar rate limiting del servidor
 */

import './src/config/env.js';
import './src/models/Associations.js';
import { Op } from 'sequelize';
import { MailflowContact } from './src/models/MailflowContact.js';
import { MailflowSequence } from './src/models/MailflowSequence.js';
import { sendMailflowEmail } from './src/services/mailflowSender.service.js';

console.log('🚀 [MAILFLOW TEST] Test optimizado con singleton transporter\n');
console.log('⚙️  Configuración:');
console.log('   - Rate limiting: 1 email/segundo (nodemailer)');
console.log('   - Pool de conexiones: REUTILIZADO');
console.log('   - Batch size: 5 emails (testing)');
console.log('');

async function sendNextEmail(contact) {
  try {
    const sequence = contact.MailflowSequence;
    
    const emails = typeof sequence.emails === 'string' ? JSON.parse(sequence.emails) : (sequence.emails || []);
    const emailConfig = emails[contact.currentEmailIndex];
    
    if (!emailConfig) {
      console.log(`⏭️ No hay más emails para ${contact.email} (completed)`);
      contact.status = 'completed';
      await contact.save();
      return { success: true, completed: true };
    }

    const name = contact.name || 'there';
    const subject = (emailConfig.subject || '').replace(/\{\{name\}\}/g, name);
    const bodyHtml = (emailConfig.bodyHtml || emailConfig.bodyText || '').replace(/\{\{name\}\}/g, name);

    console.log(`📧 Enviando a ${contact.email.substring(0, 30)}...`);

    const result = await sendMailflowEmail(
      contact,
      contact.currentEmailIndex,
      subject,
      bodyHtml,
      1
    );

    if (result.success) {
      contact.currentEmailIndex++;
      contact.lastEmailSentAt = new Date();
      
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
      console.log(`   ✅ Enviado exitosamente\n`);
      return { success: true, sent: true };
    } else if (result.shouldRetry) {
      console.log(`   ⏳ Reintento programado para: ${result.retryAt?.toISOString()}\n`);
      return { success: true, retry: true };
    } else {
      console.log(`   ❌ Error: ${result.error}\n`);
      contact.status = 'failed';
      await contact.save();
      return { success: false, error: result.error };
    }

  } catch (error) {
    console.error(`❌ Error procesando ${contact.email}:`, error.message);
    return { success: false, error: error.message };
  }
}

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
    limit: 5 // SOLO 5 EMAILS PARA TEST
  });

  if (dueContacts.length === 0) {
    console.log('📧 No hay emails pendientes para enviar ahora\n');
    process.exit(0);
  }

  console.log(`📧 Encontrados ${dueContacts.length} emails pendientes\n`);
  console.log('========================================\n');

  let sent = 0;
  let retries = 0;
  let failed = 0;
  let completed = 0;

  for (const contact of dueContacts) {
    const result = await sendNextEmail(contact);
    
    if (result.completed) completed++;
    else if (result.sent) sent++;
    else if (result.retry) retries++;
    else failed++;
    
    // NO delay manual - nodemailer lo maneja internamente con rateDelta/rateLimit
  }
  
  console.log('========================================');
  console.log('\n✅ [TEST COMPLETADO]\n');
  console.log(`   ✅ Enviados: ${sent}`);
  console.log(`   ⏳ Reintentos: ${retries}`);
  console.log(`   ✅ Completados: ${completed}`);
  console.log(`   ❌ Fallidos: ${failed}`);
  console.log('');
  console.log('💡 Verifica tu inbox: lujandev@lujandev.com');
  console.log('   Busca emails con prefijo: +test_');
  console.log('');

} catch (error) {
  console.error('❌ Error ejecutando test:', error);
  process.exit(1);
}

process.exit(0);
