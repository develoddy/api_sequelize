/**
 * Fix Inmediato: Reemplazar contactos con example.com por emails válidos
 * 
 * Problema: Los contactos de prueba usan @example.com que tiene nullMX
 * Solución: Reemplazar con emails válidos usando +addressing
 */

import './src/config/env.js';
import './src/models/Associations.js';
import { MailflowContact } from './src/models/MailflowContact.js';
import { MailflowEmailLog } from './src/models/MailflowEmailLog.js';
import { Op } from 'sequelize';

console.log('🔧 [FIX MAILFLOW] Limpiando contactos con emails inválidos...\n');

// Email base para testing (usando +addressing)
const BASE_EMAIL = process.env.EMAIL_USER || 'lujandev@lujandev.com';

// Generar email válido con +addressing
function generateValidTestEmail(originalEmail) {
  const prefix = originalEmail.split('@')[0].replace(/\./g, '_');
  const [baseUser, baseDomain] = BASE_EMAIL.split('@');
  return `${baseUser}+test_${prefix}@${baseDomain}`;
}

try {
  // Paso 1: Buscar contactos con example.com
  const invalidContacts = await MailflowContact.findAll({
    where: {
      email: { [Op.like]: '%@example.com' }
    }
  });

  if (invalidContacts.length === 0) {
    console.log('✅ No se encontraron contactos con emails inválidos\n');
    process.exit(0);
  }

  console.log(`❌ Encontrados ${invalidContacts.length} contactos con @example.com\n`);

  // Paso 2: Mostrar plan de reemplazo
  console.log('📋 Plan de reemplazo:\n');
  
  const replacements = invalidContacts.map(contact => ({
    original: contact.email,
    nuevo: generateValidTestEmail(contact.email),
    contactId: contact.id,
    sequenceId: contact.sequenceId
  }));

  replacements.forEach((r, index) => {
    console.log(`${index + 1}. ${r.original} → ${r.nuevo}`);
  });

  console.log('\n');

  // Paso 3: Limpiar logs de errores de estos contactos
  console.log('🗑️ Limpiando logs de errores anteriores...');
  
  const contactIds = invalidContacts.map(c => c.id);
  
  const deletedLogs = await MailflowEmailLog.destroy({
    where: {
      contactId: { [Op.in]: contactIds },
      status: 'failed'
    }
  });

  console.log(`   ✅ Eliminados ${deletedLogs} logs de errores\n`);

  // Paso 4: Actualizar emails de contactos
  console.log('✏️ Actualizando emails de contactos...\n');

  for (const replacement of replacements) {
    const contact = await MailflowContact.findByPk(replacement.contactId);
    
    if (!contact) continue;

    const oldEmail = contact.email;
    contact.email = replacement.nuevo;
    
    // Resetear estado para que pueda enviar de nuevo
    contact.status = 'active';
    contact.currentEmailIndex = 0;
    contact.nextEmailAt = new Date(); // Enviar inmediatamente
    
    // Resetear stats
    const stats = typeof contact.stats === 'string' ? JSON.parse(contact.stats) : (contact.stats || {});
    stats.sent = 0;
    stats.failed = 0;
    contact.stats = stats;

    await contact.save();

    console.log(`   ✅ ${oldEmail} → ${replacement.nuevo} (reseteado y listo)`);
  }

  console.log('\n✅ [FIX COMPLETADO] Contactos actualizados con emails válidos\n');
  
  console.log('📧 Próximos pasos:');
  console.log('   1. Esperar a que el cron job ejecute (cada 15 minutos)');
  console.log('   2. O ejecutar manualmente: node test-mailflow-send-now.mjs');
  console.log('   3. Verificar inbox de', BASE_EMAIL);
  console.log('   4. Todos los emails de prueba llegarán a tu inbox con prefijo +test_\n');

} catch (error) {
  console.error('❌ Error ejecutando fix:', error);
  process.exit(1);
}

process.exit(0);
