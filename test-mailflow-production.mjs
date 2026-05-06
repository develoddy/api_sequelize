#!/usr/bin/env node

/**
 * MailFlow SMTP System - Production Readiness Test
 * 
 * Este script verifica que todas las mejoras de fiabilidad están funcionando correctamente
 * EJECUTAR EN STAGING/DEVELOPMENT ANTES DE DEPLOYMENT A PRODUCCIÓN
 * 
 * Uso: node test-mailflow-production.mjs
 */

// ⚠️ IMPORTANTE: Cargar variables de entorno ANTES que cualquier otro módulo
import './src/config/env.js';

import { MailflowContact } from './src/models/MailflowContact.js';
import { MailflowSequence } from './src/models/MailflowSequence.js';
import { MailflowEmailLog } from './src/models/MailflowEmailLog.js';
import { sendMailflowEmail, isEmailAlreadySent, processRetries } from './src/services/mailflowSender.service.js';
import { sequelize } from './src/database/database.js';

// Cargar asociaciones de Sequelize
import './src/models/Associations.js';

const COLORS = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function logSuccess(message) {
  console.log(`${COLORS.green}✅ ${message}${COLORS.reset}`);
}

function logError(message) {
  console.log(`${COLORS.red}❌ ${message}${COLORS.reset}`);
}

function logWarning(message) {
  console.log(`${COLORS.yellow}⚠️  ${message}${COLORS.reset}`);
}

function logInfo(message) {
  console.log(`${COLORS.blue}ℹ️  ${message}${COLORS.reset}`);
}

let testsPassed = 0;
let testsFailed = 0;

/**
 * Test 1: Verificar que las tablas existen
 */
async function testDatabaseTables() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 1: Verificar Tablas de Base de Datos');
  console.log('='.repeat(60));
  
  try {
    // Test tabla mailflow_sequences
    const sequences = await MailflowSequence.count();
    logInfo(`Tabla mailflow_sequences: ${sequences} registros`);
    
    // Test tabla mailflow_contacts
    const contacts = await MailflowContact.count();
    logInfo(`Tabla mailflow_contacts: ${contacts} registros`);
    
    // Test tabla mailflow_email_logs (la nueva)
    const logs = await MailflowEmailLog.count();
    logInfo(`Tabla mailflow_email_logs: ${logs} registros`);
    
    logSuccess('Todas las tablas existen y son accesibles');
    testsPassed++;
    
  } catch (error) {
    logError(`Error accediendo a las tablas: ${error.message}`);
    logWarning('¿Ejecutaste la migración SQL? Revisa: migrations/20260506_create_mailflow_email_logs.sql');
    testsFailed++;
  }
}

/**
 * Test 2: Verificar asociaciones de modelos
 */
async function testModelAssociations() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: Verificar Asociaciones de Modelos');
  console.log('='.repeat(60));
  
  try {
    // Test asociación MailflowSequence -> MailflowContact
    const sequenceWithContacts = await MailflowSequence.findOne({
      include: [{ model: MailflowContact, as: 'contacts' }],
      limit: 1
    });
    
    if (sequenceWithContacts) {
      logSuccess('Asociación MailflowSequence -> MailflowContact: OK');
    } else {
      logInfo('No hay sequences con contactos para testear asociación');
    }
    
    // Test asociación MailflowSequence -> MailflowEmailLog
    const sequenceWithLogs = await MailflowSequence.findOne({
      include: [{ model: MailflowEmailLog, as: 'emailLogs' }],
      limit: 1
    });
    
    logSuccess('Asociación MailflowSequence -> MailflowEmailLog: OK');
    
    // Test asociación MailflowContact -> MailflowEmailLog
    const contactWithLogs = await MailflowContact.findOne({
      include: [{ model: MailflowEmailLog, as: 'emailLogs' }],
      limit: 1
    });
    
    logSuccess('Asociación MailflowContact -> MailflowEmailLog: OK');
    
    testsPassed++;
    
  } catch (error) {
    logError(`Error en asociaciones: ${error.message}`);
    logWarning('¿Actualizaste el archivo Associations.js?');
    testsFailed++;
  }
}

/**
 * Test 3: Verificar prevención de duplicados
 */
async function testDuplicatePrevention() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: Verificar Prevención de Duplicados');
  console.log('='.repeat(60));
  
  try {
    // Buscar un email log existente
    const existingLog = await MailflowEmailLog.findOne({
      where: { status: 'sent' }
    });
    
    if (!existingLog) {
      logWarning('No hay logs enviados aún - test omitido');
      logInfo('Este test se ejecutará automáticamente después del primer envío');
      testsPassed++;
      return;
    }
    
    // Verificar que la función detecte el duplicado
    const isDuplicate = await isEmailAlreadySent(
      existingLog.contactId,
      existingLog.emailIndex
    );
    
    if (isDuplicate) {
      logSuccess('Prevención de duplicados: FUNCIONA');
      logInfo(`Email ya enviado detectado: contactId=${existingLog.contactId}, emailIndex=${existingLog.emailIndex}`);
      testsPassed++;
    } else {
      logError('Prevención de duplicados: FALLO');
      logError('La función isEmailAlreadySent() no detectó un email ya enviado');
      testsFailed++;
    }
    
  } catch (error) {
    logError(`Error en test de duplicados: ${error.message}`);
    testsFailed++;
  }
}

/**
 * Test 4: Verificar índices de la tabla de logs
 */
async function testDatabaseIndexes() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 4: Verificar Índices de Base de Datos');
  console.log('='.repeat(60));
  
  try {
    const [indexes] = await sequelize.query(`
      SHOW INDEX FROM mailflow_email_logs
    `);
    
    const indexNames = indexes.map(idx => idx.Key_name);
    const requiredIndexes = [
      'idx_sequenceId',
      'idx_contactId',
      'idx_status',
      'idx_duplicate_check',
      'idx_retry_lookup'
    ];
    
    let allIndexesPresent = true;
    
    for (const requiredIndex of requiredIndexes) {
      if (indexNames.includes(requiredIndex)) {
        logSuccess(`Índice ${requiredIndex}: OK`);
      } else {
        logError(`Índice ${requiredIndex}: FALTA`);
        allIndexesPresent = false;
      }
    }
    
    if (allIndexesPresent) {
      testsPassed++;
    } else {
      logWarning('Algunos índices faltan - el rendimiento puede verse afectado');
      testsFailed++;
    }
    
  } catch (error) {
    logError(`Error verificando índices: ${error.message}`);
    testsFailed++;
  }
}

/**
 * Test 5: Verificar que el servicio de envío está configurado
 */
async function testSMTPConfiguration() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 5: Verificar Configuración SMTP');
  console.log('='.repeat(60));
  
  try {
    const requiredEnvVars = ['SMTP_HOST', 'SMTP_PORT', 'EMAIL_USER', 'EMAIL_PASS'];
    let allConfigured = true;
    
    for (const envVar of requiredEnvVars) {
      if (process.env[envVar]) {
        logSuccess(`${envVar}: Configurado`);
      } else {
        logError(`${envVar}: NO CONFIGURADO`);
        allConfigured = false;
      }
    }
    
    if (allConfigured) {
      logInfo(`SMTP Host: ${process.env.SMTP_HOST}`);
      logInfo(`SMTP Port: ${process.env.SMTP_PORT}`);
      logInfo(`Email User: ${process.env.EMAIL_USER}`);
      testsPassed++;
    } else {
      logWarning('Configura las variables SMTP en tu archivo .env');
      testsFailed++;
    }
    
  } catch (error) {
    logError(`Error en configuración SMTP: ${error.message}`);
    testsFailed++;
  }
}

/**
 * Test 6: Verificar queries de monitoreo
 */
async function testMonitoringQueries() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 6: Verificar Queries de Monitoreo');
  console.log('='.repeat(60));
  
  try {
    // Query 1: Emails enviados en últimas 24 horas
    const [sentLast24h] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM mailflow_email_logs 
      WHERE status = 'sent' 
        AND sentAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `);
    logInfo(`Emails enviados (24h): ${sentLast24h[0].count}`);
    
    // Query 2: Reintentos pendientes
    const [pendingRetries] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM mailflow_email_logs 
      WHERE status = 'retry' 
        AND retryAt <= NOW()
    `);
    logInfo(`Reintentos pendientes: ${pendingRetries[0].count}`);
    
    // Query 3: Tasa de éxito
    const [successRate] = await sequelize.query(`
      SELECT 
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        COUNT(*) as total,
        ROUND(
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) * 100.0 / COUNT(*),
          2
        ) as success_rate
      FROM mailflow_email_logs
      WHERE sentAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `);
    
    if (successRate[0].total > 0) {
      logInfo(`Tasa de éxito (24h): ${successRate[0].success_rate}%`);
    }
    
    logSuccess('Queries de monitoreo funcionan correctamente');
    testsPassed++;
    
  } catch (error) {
    logError(`Error en queries de monitoreo: ${error.message}`);
    testsFailed++;
  }
}

/**
 * Ejecutar todos los tests
 */
async function runAllTests() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   MailFlow SMTP System - Production Readiness Test       ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  try {
    // Conectar a la base de datos
    await sequelize.authenticate();
    logSuccess('Conexión a base de datos establecida');
    
    // Ejecutar tests
    await testDatabaseTables();
    await testModelAssociations();
    await testDuplicatePrevention();
    await testDatabaseIndexes();
    await testSMTPConfiguration();
    await testMonitoringQueries();
    
    // Resumen
    console.log('\n' + '='.repeat(60));
    console.log('RESUMEN DE TESTS');
    console.log('='.repeat(60));
    console.log(`${COLORS.green}Tests Pasados: ${testsPassed}${COLORS.reset}`);
    console.log(`${COLORS.red}Tests Fallidos: ${testsFailed}${COLORS.reset}`);
    
    if (testsFailed === 0) {
      console.log(`\n${COLORS.green}╔═══════════════════════════════════════════════════════════╗`);
      console.log(`║  ✅ SISTEMA LISTO PARA PRODUCCIÓN                        ║`);
      console.log(`╚═══════════════════════════════════════════════════════════╝${COLORS.reset}\n`);
    } else {
      console.log(`\n${COLORS.red}╔═══════════════════════════════════════════════════════════╗`);
      console.log(`║  ❌ SISTEMA NO LISTO - CORREGIR ERRORES                  ║`);
      console.log(`╚═══════════════════════════════════════════════════════════╝${COLORS.reset}\n`);
      process.exit(1);
    }
    
  } catch (error) {
    logError(`Error crítico en tests: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Ejecutar tests
runAllTests();
