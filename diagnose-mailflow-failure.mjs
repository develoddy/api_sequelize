/**
 * Script de diagnóstico crítico para MailFlow
 * 
 * Analiza por qué TODOS los emails están fallando y no hay reintentos
 * 
 * Revisa:
 * 1. Logs de errores exactos en mailflow_email_logs
 * 2. Configuración SMTP real
 * 3. Prueba de conexión SMTP directa
 * 4. Análisis de por qué los errores no son retriables
 */

import './src/config/env.js';
import './src/models/Associations.js';
import nodemailer from 'nodemailer';
import { MailflowEmailLog } from './src/models/MailflowEmailLog.js';
import { Op } from 'sequelize';

console.log('🔍 [DIAGNÓSTICO MAILFLOW] ========================================\n');

// ===== PASO 1: REVISAR LOGS DE ERRORES =====
console.log('📊 [PASO 1] Analizando logs de errores en base de datos...\n');

try {
  const failedLogs = await MailflowEmailLog.findAll({
    where: {
      status: { [Op.in]: ['failed', 'retry'] }
    },
    order: [['createdAt', 'DESC']],
    limit: 10
  });

  if (failedLogs.length === 0) {
    console.log('✅ No hay logs de errores en base de datos\n');
  } else {
    console.log(`❌ Encontrados ${failedLogs.length} logs de error. Detalle:\n`);
    
    failedLogs.forEach((log, index) => {
      console.log(`--- ERROR #${index + 1} ---`);
      console.log(`Email: ${log.email}`);
      console.log(`Status: ${log.status}`);
      console.log(`Error Code: ${log.errorCode}`);
      console.log(`Error Message: ${log.errorMessage}`);
      console.log(`SMTP Response: ${log.smtpResponse}`);
      console.log(`Attempt Number: ${log.attemptNumber}`);
      console.log(`Retry At: ${log.retryAt}`);
      
      // Analizar metadata si existe
      if (log.metadata) {
        const metadata = typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata;
        console.log(`Retriable: ${metadata.isRetriable}`);
        console.log(`Should Retry: ${metadata.shouldRetry}`);
        console.log(`Response Code: ${metadata.responseCode}`);
      }
      
      console.log('');
    });
  }

} catch (error) {
  console.error('❌ Error leyendo logs:', error.message);
}

// ===== PASO 2: VERIFICAR CONFIGURACIÓN SMTP =====
console.log('\n🔧 [PASO 2] Verificando configuración SMTP...\n');

const smtpConfig = {
  host: process.env.SMTP_HOST || 'NO CONFIGURADO',
  port: process.env.SMTP_PORT || 'NO CONFIGURADO',
  user: process.env.EMAIL_USER || 'NO CONFIGURADO',
  pass: process.env.EMAIL_PASS ? '***CONFIGURADO***' : 'NO CONFIGURADO',
  secure: process.env.SMTP_PORT === '465' ? 'true (SSL)' : 'false (TLS)'
};

console.log('SMTP Configuration:');
console.log(`  Host: ${smtpConfig.host}`);
console.log(`  Port: ${smtpConfig.port}`);
console.log(`  User: ${smtpConfig.user}`);
console.log(`  Pass: ${smtpConfig.pass}`);
console.log(`  Secure: ${smtpConfig.secure}`);

if (!process.env.SMTP_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.log('\n❌ CRÍTICO: Configuración SMTP incompleta en .env\n');
  process.exit(1);
}

// ===== PASO 3: PROBAR CONEXIÓN SMTP DIRECTA =====
console.log('\n🔌 [PASO 3] Probando conexión SMTP directa...\n');

try {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  console.log('Verificando conexión SMTP...');
  
  await transporter.verify();
  
  console.log('✅ Conexión SMTP exitosa - Credentials válidas\n');

} catch (error) {
  console.error('❌ ERROR DE CONEXIÓN SMTP:');
  console.error(`   Code: ${error.code}`);
  console.error(`   Message: ${error.message}`);
  console.error(`   Response Code: ${error.responseCode}`);
  console.error(`   Command: ${error.command}`);
  
  if (error.code === 'EAUTH') {
    console.error('\n🚨 DIAGNÓSTICO: Credenciales SMTP inválidas');
    console.error('   - Verifica EMAIL_USER y EMAIL_PASS en .env');
    console.error('   - Confirma que la contraseña es correcta');
  } else if (error.code === 'ECONNREFUSED') {
    console.error('\n🚨 DIAGNÓSTICO: Servidor SMTP rechaza conexiones');
    console.error('   - Verifica SMTP_HOST y SMTP_PORT');
    console.error('   - Confirma que el servidor está accesible');
  } else if (error.code === 'ETIMEDOUT') {
    console.error('\n🚨 DIAGNÓSTICO: Timeout conectando a SMTP');
    console.error('   - Verifica firewall o restricciones de red');
  }
  
  console.log('\n');
}

// ===== PASO 4: PROBAR ENVÍO DE EMAIL DE PRUEBA =====
console.log('📧 [PASO 4] Intentando envío de email de prueba...\n');

try {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  const testEmail = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER, // Enviar a sí mismo para prueba
    subject: '[MAILFLOW TEST] Email de diagnóstico',
    html: '<h1>Test de diagnóstico MailFlow</h1><p>Si recibes este email, la configuración SMTP funciona correctamente.</p>'
  };

  console.log(`Enviando email de prueba a: ${testEmail.to}...`);
  
  const result = await transporter.sendMail(testEmail);
  
  console.log('✅ EMAIL DE PRUEBA ENVIADO EXITOSAMENTE');
  console.log(`   Message ID: ${result.messageId}`);
  console.log(`   Response: ${result.response}`);
  console.log(`   Accepted: ${result.accepted}`);
  console.log(`   Rejected: ${result.rejected}`);

} catch (error) {
  console.error('❌ ERROR ENVIANDO EMAIL DE PRUEBA:');
  console.error(`   Code: ${error.code}`);
  console.error(`   Message: ${error.message}`);
  console.error(`   Response: ${error.response}`);
  
  // Analizar si el error sería retriable según lógica actual
  const RETRIABLE_CODES = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'ENOTFOUND', '421', '450', '451', '452'];
  const isRetriable = RETRIABLE_CODES.some(code => 
    (error.code || '').includes(code) || 
    (error.message || '').includes(code)
  );
  
  console.log(`\n🔍 ANÁLISIS: ¿Error es retriable según lógica actual? ${isRetriable ? 'SÍ' : 'NO'}`);
  
  if (!isRetriable) {
    console.log('🚨 DIAGNÓSTICO CRÍTICO: Error clasificado como NO RETRIABLE');
    console.log('   → Esto explica por qué status=failed y no status=retry');
    console.log('   → Por eso NO hay reintentos programados');
  }
}

console.log('\n🔍 [DIAGNÓSTICO MAILFLOW] Completado ========================================\n');

process.exit(0);
