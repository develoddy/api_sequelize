/**
 * Script para enviar emails de MailFlow inmediatamente (sin esperar cron)
 * 
 * Útil para:
 * - Testing inmediato después de fix
 * - Debugging de envío SMTP
 * - Verificar que la solución funciona
 */

import './src/config/env.js';
import './src/models/Associations.js';
import { Op } from 'sequelize';
import { MailflowContact } from './src/models/MailflowContact.js';
import { MailflowSequence } from './src/models/MailflowSequence.js';
import { sendMailflowEmail } from './src/services/mailflowSender.service.js';

console.log('🚀 [MAILFLOW SEND NOW] Enviando emails pendientes inmediatamente...\n');

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

    console.log(`📧 Enviando email #${contact.currentEmailIndex + 1} a ${contact.email}`);
    console.log(`   Subject: ${subject}`);

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
      console.log(`   ✅ Email enviado exitosamente\n`);
      return { success: true, sent: true };
    } else {
      console.error(`   ❌ Error: ${result.error}\n`);
      return { success: false, error: result.error };
    }

  } catch (error) {
    console.error(`❌ Error procesando ${contact.email}:`, error);
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
    limit: 50
  });

  if (dueContacts.length === 0) {
    console.log('📧 No hay emails pendientes para enviar ahora');
    console.log('   - Verifica que haya sequences activas');
    console.log('   - Verifica que los contactos tengan nextEmailAt <= NOW\n');
    process.exit(0);
  }

  console.log(`📧 Encontrados ${dueContacts.length} emails pendientes\n`);
  console.log('========================================\n');

  let sent = 0;
  let failed = 0;
  let completed = 0;

  for (const contact of dueContacts) {
    const result = await sendNextEmail(contact);
    
    if (result.completed) completed++;
    else if (result.sent) sent++;
    else failed++;
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('========================================');
  console.log('\n✅ [ENVÍO COMPLETADO]\n');
  console.log(`   ✅ Enviados: ${sent}`);
  console.log(`   ✅ Completados: ${completed}`);
  console.log(`   ❌ Fallidos: ${failed}`);
  console.log('');

} catch (error) {
  console.error('❌ Error ejecutando envío:', error);
  process.exit(1);
}

process.exit(0);
