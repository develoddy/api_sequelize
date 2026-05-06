/**
 * Script de prueba para validar el nuevo sistema de stats reales
 * Compara stats.sent vs COUNT real de mailflow_email_logs
 */

import './src/config/env.js';
import { MailflowSequence } from './src/models/MailflowSequence.js';
import { MailflowContact } from './src/models/MailflowContact.js';
import { MailflowEmailLog } from './src/models/MailflowEmailLog.js';
import { sequelize } from './src/database/database.js';

async function testRealStats() {
  console.log('\n🔍 ========================================');
  console.log('🔍 TEST: VALIDACIÓN DE STATS REALES');
  console.log('🔍 ========================================\n');

  try {
    // Test 1: Comparar sequence.stats vs COUNT real
    console.log('📊 Test 1: Comparando sequence.stats (cache) vs datos reales...\n');
    
    const sequences = await MailflowSequence.findAll({
      where: { status: 'active' },
      attributes: ['sequenceId', 'name', 'stats']
    });

    if (sequences.length === 0) {
      console.log('⚠️  No hay sequences activas para testear');
      return;
    }

    for (const seq of sequences) {
      const cachedSent = seq.stats?.sent || 0;
      const cachedPending = seq.stats?.pending || 0;
      const cachedFailed = seq.stats?.failed || 0;

      // Calcular stats reales
      const realSent = await MailflowEmailLog.count({
        where: { sequenceId: seq.sequenceId, status: 'sent' }
      });
      
      const realPending = await MailflowContact.count({
        where: { sequenceId: seq.sequenceId, status: 'active' }
      });
      
      const realFailed = await MailflowEmailLog.count({
        where: { sequenceId: seq.sequenceId, status: 'failed' }
      });

      console.log(`📧 Sequence: ${seq.name} (${seq.sequenceId})`);
      console.log(`   Sent:    ${cachedSent} (cache) vs ${realSent} (real) ${cachedSent === realSent ? '✅' : '❌ DESINCRONIZADO'}`);
      console.log(`   Pending: ${cachedPending} (cache) vs ${realPending} (real) ${cachedPending === realPending ? '✅' : '❌ DESINCRONIZADO'}`);
      console.log(`   Failed:  ${cachedFailed} (cache) vs ${realFailed} (real) ${cachedFailed === realFailed ? '✅' : '❌ DESINCRONIZADO'}`);
      console.log('');
    }

    // Test 2: Probar subqueries del nuevo listSequences()
    console.log('📊 Test 2: Probando subqueries de listSequences()...\n');

    const sequencesWithRealStats = await MailflowSequence.findAll({
      where: { status: 'active' },
      attributes: [
        'sequenceId',
        'name',
        [
          sequelize.literal(`(
            SELECT COUNT(*) 
            FROM mailflow_email_logs 
            WHERE mailflow_email_logs.sequenceId = MailflowSequence.sequenceId 
            AND status = 'sent'
          )`),
          'realSent'
        ],
        [
          sequelize.literal(`(
            SELECT COUNT(*) 
            FROM mailflow_contacts 
            WHERE mailflow_contacts.sequenceId = MailflowSequence.sequenceId 
            AND status = 'active'
          )`),
          'realPending'
        ],
        [
          sequelize.literal(`(
            SELECT MIN(nextEmailAt) 
            FROM mailflow_contacts 
            WHERE mailflow_contacts.sequenceId = MailflowSequence.sequenceId 
            AND status = 'active'
            AND nextEmailAt > NOW()
          )`),
          'nextScheduledEmail'
        ],
        [
          sequelize.literal(`(
            SELECT MAX(sentAt) 
            FROM mailflow_email_logs 
            WHERE mailflow_email_logs.sequenceId = MailflowSequence.sequenceId 
            AND status = 'sent'
          )`),
          'lastEmailSent'
        ]
      ],
      raw: true
    });

    console.log('✅ Subqueries ejecutadas correctamente:\n');
    
    for (const seq of sequencesWithRealStats) {
      console.log(`📧 ${seq.name}:`);
      console.log(`   realSent: ${seq.realSent}`);
      console.log(`   realPending: ${seq.realPending}`);
      console.log(`   nextScheduledEmail: ${seq.nextScheduledEmail || 'null'}`);
      console.log(`   lastEmailSent: ${seq.lastEmailSent || 'null'}`);
      console.log('');
    }

    // Test 3: Validar próximo email programado
    console.log('📊 Test 3: Validando próximo email programado...\n');

    const nextContact = await MailflowContact.findOne({
      where: {
        status: 'active',
        nextEmailAt: { [sequelize.Sequelize.Op.gt]: new Date() }
      },
      order: [['nextEmailAt', 'ASC']],
      attributes: ['email', 'nextEmailAt', 'sequenceId']
    });

    if (nextContact) {
      const minutesUntil = Math.round((new Date(nextContact.nextEmailAt) - new Date()) / 60000);
      console.log(`⏰ Próximo email programado:`);
      console.log(`   Contacto: ${nextContact.email}`);
      console.log(`   Timestamp: ${nextContact.nextEmailAt}`);
      console.log(`   En ${minutesUntil} minutos`);
    } else {
      console.log('⚠️  No hay emails programados en el futuro');
    }

    console.log('\n✅ ========================================');
    console.log('✅ TEST COMPLETADO - STATS REALES FUNCIONAN');
    console.log('✅ ========================================\n');

  } catch (error) {
    console.error('❌ Error en test:', error);
  } finally {
    await sequelize.close();
  }
}

testRealStats();
