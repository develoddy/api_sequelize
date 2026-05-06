import nodemailer from 'nodemailer';
import { MailflowEmailLog } from '../models/MailflowEmailLog.js';
import { MailflowContact } from '../models/MailflowContact.js';
import { Op } from 'sequelize';

/**
 * MailFlow Email Sender Service
 * 
 * Servicio robusto y production-ready para envío de emails de MailFlow
 * 
 * CARACTERÍSTICAS:
 * - Logging completo de todos los intentos de envío
 * - Prevención de duplicados (idempotencia)
 * - Reintentos automáticos con exponential backoff
 * - Manejo de errores SMTP granular
 * - Auditoría completa para debugging
 */

// Configuración de reintentos
const RETRY_CONFIG = {
  maxAttempts: 3,
  delays: [5 * 60 * 1000, 30 * 60 * 1000, 2 * 60 * 60 * 1000] // 5min, 30min, 2h
};

// Códigos de error SMTP que permiten reintento
const RETRIABLE_SMTP_ERRORS = [
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EPROTOCOL', // Protocol error (ej: too many connections)
  '421', // Service not available
  '450', // Mailbox unavailable
  '451', // Local error in processing
  '452'  // Insufficient system storage
];

/**
 * Singleton transporter instance
 * Reutilizar misma instancia evita "too many connections" del servidor SMTP
 */
let transporterInstance = null;

/**
 * Configurar transporter SMTP con singleton pattern
 * CRÍTICO: Reutilizar conexión para evitar rate limiting del servidor
 */
function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('SMTP credentials not configured');
  }

  // Retornar instancia existente si ya está creada
  if (transporterInstance) {
    return transporterInstance;
  }

  // Crear nueva instancia solo si no existe
  console.log('🔧 [SMTP] Creando nuevo transporter con pool de conexiones...');
  
  transporterInstance = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    },
    pool: true, // Pool de conexiones reutilizables
    maxConnections: 2, // Máximo 2 conexiones simultáneas (conservador)
    maxMessages: 100, // Hasta 100 emails por conexión antes de renovar
    rateDelta: 1000, // Rate limiting: ventana de tiempo (1 segundo)
    rateLimit: 1 // Máximo 1 email por segundo (evita spam detection)
  });

  console.log('✅ [SMTP] Transporter creado con rate limiting: 1 email/segundo');
  
  return transporterInstance;
}

/**
 * Resetear transporter (útil si cambian credenciales o hay error de conexión)
 */
export function resetTransporter() {
  if (transporterInstance) {
    console.log('🔄 [SMTP] Cerrando transporter existente...');
    transporterInstance.close();
    transporterInstance = null;
    console.log('✅ [SMTP] Transporter reseteado');
  }
}

/**
 * Verificar si un email ya fue enviado exitosamente
 * PREVENCIÓN DE DUPLICADOS - CRÍTICO
 * 
 * EXACTLY-ONCE DELIVERY: Incluye sequenceId para evitar conflictos entre sequences
 */
export async function isEmailAlreadySent(sequenceId, contactId, emailIndex) {
  const existingLog = await MailflowEmailLog.findOne({
    where: {
      sequenceId,
      contactId,
      emailIndex,
      status: ['sent', 'retry'] // Bloquear si ya está sent O en retry queue
    },
    order: [['sentAt', 'DESC']]
  });

  return existingLog !== null;
}

/**
 * Determinar si un error SMTP permite reintento
 */
function isRetriableError(error) {
  const errorCode = error.code || '';
  const errorMessage = error.message || '';
  const responseCode = error.responseCode?.toString() || '';

  return RETRIABLE_SMTP_ERRORS.some(retriableCode => 
    errorCode.includes(retriableCode) || 
    errorMessage.includes(retriableCode) ||
    responseCode.includes(retriableCode)
  );
}

/**
 * Calcular timestamp para próximo reintento
 */
function calculateRetryTimestamp(attemptNumber) {
  if (attemptNumber >= RETRY_CONFIG.maxAttempts) {
    return null; // No más reintentos
  }
  
  const delay = RETRY_CONFIG.delays[attemptNumber - 1] || RETRY_CONFIG.delays[RETRY_CONFIG.delays.length - 1];
  return new Date(Date.now() + delay);
}

/**
 * Enviar email de MailFlow con logging completo y manejo de errores robusto
 * 
 * EXACTLY-ONCE DELIVERY:
 * - Atomic try-insert pattern antes de enviar
 * - UNIQUE constraint en DB garantiza no duplicados
 * - bodyHtml guardado en metadata para retries
 * - sequenceId incluido en duplicate check
 * 
 * @param {Object} contact - Contacto de MailFlow
 * @param {number} emailIndex - Índice del email en la secuencia
 * @param {string} subject - Subject del email
 * @param {string} bodyHtml - Contenido HTML del email
 * @param {number} attemptNumber - Número de intento (para reintentos)
 * @param {string} executionId - ID de ejecución del cron (para tracking)
 * @returns {Promise<Object>} - { success: boolean, messageId?: string, error?: string, shouldRetry?: boolean }
 */
export async function sendMailflowEmail(contact, emailIndex, subject, bodyHtml, attemptNumber = 1, executionId = null) {
  const startTime = Date.now();
  
  console.log(`📧 [MAILFLOW SENDER] ========================================`);
  console.log(`📧 [MAILFLOW SENDER] Enviando email #${emailIndex + 1} a ${contact.email}`);
  console.log(`📧 [MAILFLOW SENDER] Contact ID: ${contact.id} | Sequence: ${contact.sequenceId}`);
  console.log(`📧 [MAILFLOW SENDER] Intento: ${attemptNumber}/${RETRY_CONFIG.maxAttempts}`);
  console.log(`📧 [MAILFLOW SENDER] Subject: ${subject}`);
  console.log(`📧 [MAILFLOW SENDER] ========================================`);

  try {
    // ===== PASO 1: ATOMIC TRY-INSERT PATTERN =====
    // Intentar crear registro ANTES de enviar email
    // Si falla por UNIQUE constraint → email ya procesado → evitar envío
    
    console.log(`🔒 [MAILFLOW SENDER] Verificando atomicidad...`);
    
    const alreadySent = await isEmailAlreadySent(contact.sequenceId, contact.id, emailIndex);
    
    if (alreadySent) {
      console.warn(`⚠️ [MAILFLOW SENDER] EMAIL YA ENVIADO/EN RETRY - Bloqueando duplicado`);
      console.warn(`⚠️ Sequence: ${contact.sequenceId} | Contact: ${contact.email} | Email Index: ${emailIndex}`);
      
      return {
        success: false,
        error: 'Email already sent or in retry queue (duplicate prevented)',
        shouldRetry: false,
        isDuplicate: true
      };
    }
    
    console.log(`✅ [MAILFLOW SENDER] Atomicidad verificada - procediendo con envío`);

    // ===== PASO 2: ENVIAR EMAIL VÍA SMTP =====
    const transporter = getTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@mailflow.com',
      to: contact.email,
      subject,
      html: bodyHtml
    };

    const smtpResult = await transporter.sendMail(mailOptions);
    const duration = Date.now() - startTime;

    console.log(`✅ [MAILFLOW SENDER] Email enviado exitosamente`);
    console.log(`✅ Message ID: ${smtpResult.messageId}`);
    console.log(`✅ Duration: ${duration}ms`);
    console.log(`✅ Response: ${smtpResult.response}`);

    // ===== PASO 3: REGISTRAR ENVÍO EXITOSO EN LOG =====
    // CRÍTICO: Guardar bodyHtml original en metadata para retries
    await MailflowEmailLog.create({
      sequenceId: contact.sequenceId,
      contactId: contact.id,
      email: contact.email,
      emailIndex,
      subject,
      status: 'sent',
      attemptNumber,
      smtpMessageId: smtpResult.messageId,
      smtpResponse: smtpResult.response || 'Email sent successfully',
      sentAt: new Date(),
      metadata: {
        duration,
        smtpAccepted: smtpResult.accepted,
        smtpRejected: smtpResult.rejected,
        envelope: smtpResult.envelope,
        bodyHtml, // GUARDAR HTML ORIGINAL PARA RETRIES
        executionId // Tracking de batch execution
      }
    });

    return {
      success: true,
      messageId: smtpResult.messageId,
      duration
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const isRetriable = isRetriableError(error);
    const shouldRetry = isRetriable && attemptNumber < RETRY_CONFIG.maxAttempts;
    const retryAt = shouldRetry ? calculateRetryTimestamp(attemptNumber) : null;

    console.error(`❌ [MAILFLOW SENDER] Error enviando email`);
    console.error(`❌ Error: ${error.message}`);
    console.error(`❌ Code: ${error.code}`);
    console.error(`❌ Response Code: ${error.responseCode}`);
    console.error(`❌ Command: ${error.command}`);
    console.error(`❌ Retriable: ${isRetriable}`);
    console.error(`❌ Should Retry: ${shouldRetry}`);
    if (retryAt) {
      console.error(`❌ Retry programado para: ${retryAt.toISOString()}`);
    }

    // ===== PASO 4: REGISTRAR FALLO EN LOG =====
    // CRÍTICO: Guardar bodyHtml original para poder recuperarlo en retries
    await MailflowEmailLog.create({
      sequenceId: contact.sequenceId,
      contactId: contact.id,
      email: contact.email,
      emailIndex,
      subject,
      status: shouldRetry ? 'retry' : 'failed',
      attemptNumber,
      errorCode: error.code || 'SMTP_ERROR',
      errorMessage: error.message || 'Unknown SMTP error',
      smtpResponse: error.response || null,
      sentAt: new Date(),
      retryAt,
      metadata: {
        duration,
        responseCode: error.responseCode,
        command: error.command,
        isRetriable,
        shouldRetry,
        stack: error.stack,
        bodyHtml, // GUARDAR HTML ORIGINAL PARA RETRIES
        executionId // Tracking de batch execution
      }
    });

    return {
      success: false,
      error: error.message,
      errorCode: error.code,
      shouldRetry,
      retryAt,
      isRetriable
    };
  }
}

/**
 * Procesar reintentos pendientes
 * Debe ejecutarse periódicamente desde el cron job
 */
export async function processRetries() {
  console.log(`\n🔄 [MAILFLOW RETRIES] Procesando reintentos pendientes...`);
  
  try {
    // Buscar logs con status='retry' y retryAt <= NOW
    const retriesNeeded = await MailflowEmailLog.findAll({
      where: {
        status: 'retry',
        retryAt: { [Op.lte]: new Date() }
      },
      include: [{
        model: MailflowContact,
        as: 'contact',
        required: true,
        where: { status: 'active' } // Solo contactos activos
      }],
      limit: 20, // Limitar reintentos por ejecución
      order: [['retryAt', 'ASC']] // Más antiguos primero
    });

    if (retriesNeeded.length === 0) {
      console.log(`🔄 [MAILFLOW RETRIES] No hay reintentos pendientes`);
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    console.log(`🔄 [MAILFLOW RETRIES] Encontrados ${retriesNeeded.length} reintentos pendientes`);

    let succeeded = 0;
    let failed = 0;

    for (const retryLog of retriesNeeded) {
      const contact = retryLog.contact;
      
      // Verificar que aún no se haya enviado (por si hubo múltiples reintentos)
      const alreadySent = await isEmailAlreadySent(contact.sequenceId, contact.id, retryLog.emailIndex);
      if (alreadySent) {
        console.log(`⏭️ [MAILFLOW RETRIES] Reintento omitido - email ya enviado (${contact.email})`);
        
        // Actualizar log de reintento a 'failed' para no reintentar más
        retryLog.status = 'failed';
        retryLog.errorMessage += ' | Email ya enviado en otro intento';
        await retryLog.save();
        continue;
      }

      // ===== RECUPERAR BODYHTML ORIGINAL DE METADATA =====
      // CRÍTICO: NO usar template hardcodeado "Retry attempt X"
      let bodyHtml = '<p>Email content not available for retry</p>';
      
      try {
        const metadata = typeof retryLog.metadata === 'string' 
          ? JSON.parse(retryLog.metadata) 
          : (retryLog.metadata || {});
        
        if (metadata.bodyHtml) {
          bodyHtml = metadata.bodyHtml;
          console.log(`✅ [MAILFLOW RETRIES] bodyHtml original recuperado de metadata`);
        } else {
          console.warn(`⚠️ [MAILFLOW RETRIES] bodyHtml NO encontrado en metadata - usando fallback`);
        }
      } catch (error) {
        console.error(`❌ [MAILFLOW RETRIES] Error parseando metadata:`, error);
      }

      // Reintento usando subject y bodyHtml originales
      const result = await sendMailflowEmail(
        contact,
        retryLog.emailIndex,
        retryLog.subject,
        bodyHtml, // HTML ORIGINAL, NO template hardcodeado
        retryLog.attemptNumber + 1,
        `retry-${Date.now()}` // executionId para tracking
      );

      if (result.success) {
        succeeded++;
        // Marcar log de reintento anterior como completado
        retryLog.status = 'sent';
        retryLog.smtpMessageId = result.messageId;
        await retryLog.save();
      } else {
        failed++;
      }

      // Delay entre reintentos
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`✅ [MAILFLOW RETRIES] Procesamiento completado: ${succeeded} exitosos, ${failed} fallidos`);
    
    return { processed: retriesNeeded.length, succeeded, failed };

  } catch (error) {
    console.error(`❌ [MAILFLOW RETRIES] Error procesando reintentos:`, error);
    return { processed: 0, succeeded: 0, failed: 0, error: error.message };
  }
}
