import nodemailerPackage from 'nodemailer';

/**
 * 🚨 Alerting Service
 * 
 * Sistema de alertas para notificar al administrador sobre problemas críticos
 */

// Configurar transporter de email
const getTransporter = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('❌ SMTP Configuration Error: Missing required environment variables');
    throw new Error('SMTP credentials not configured');
  }

  return nodemailerPackage.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

/**
 * Enviar alerta por email al administrador
 */
const sendAlertEmail = async (subject, htmlContent, textContent) => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
  
  if (!adminEmail) {
    console.error('❌ [Alerting] No se configuró ADMIN_EMAIL');
    return false;
  }
  
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"Sistema de Alertas" <${process.env.SMTP_USER}>`,
      to: adminEmail,
      subject: `🚨 ALERTA: ${subject}`,
      text: textContent,
      html: htmlContent
    });
    
    console.log(`✅ [Alerting] Email de alerta enviado a ${adminEmail}: ${subject}`);
    return true;
  } catch (error) {
    console.error('❌ [Alerting] Error enviando email:', error.message);
    return false;
  }
};

/**
 * Alerta: Demasiados webhooks fallidos
 */
export const alertWebhookFailures = async (failedCount, details = {}) => {
  const subject = `${failedCount} Webhooks Fallidos Detectados`;
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #dc3545; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">🚨 Alerta de Webhooks Fallidos</h1>
      </div>
      
      <div style="padding: 20px; background: #f8f9fa;">
        <h2 style="color: #333;">Detalles del Problema</h2>
        <p style="font-size: 16px; color: #666;">
          Se han detectado <strong style="color: #dc3545;">${failedCount} webhooks fallidos</strong> 
          en las últimas 24 horas.
        </p>
        
        <div style="background: white; padding: 15px; border-left: 4px solid #dc3545; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Información Adicional</h3>
          <ul style="color: #666;">
            <li>Timestamp: ${new Date().toISOString()}</li>
            ${details.totalFailed ? `<li>Total de webhooks fallidos: ${details.totalFailed}</li>` : ''}
            ${details.recentFailed ? `<li>Fallidos en 24h: ${details.recentFailed}</li>` : ''}
          </ul>
        </div>
        
        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <strong style="color: #856404;">⚠️ Acción Requerida:</strong>
          <p style="margin: 5px 0 0 0; color: #856404;">
            Revisa el dashboard de webhooks y el health check del sistema para más detalles.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <a href="${process.env.URL_ADMIN || 'http://localhost:4200'}/saas-management" 
             style="background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Ver Dashboard Admin
          </a>
        </div>
      </div>
      
      <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
        <p>Este es un email automático del sistema de alertas.</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
      </div>
    </div>
  `;
  
  const textContent = `
🚨 ALERTA: ${failedCount} Webhooks Fallidos Detectados

Se han detectado ${failedCount} webhooks fallidos en las últimas 24 horas.

Información:
- Timestamp: ${new Date().toISOString()}
${details.totalFailed ? `- Total de webhooks fallidos: ${details.totalFailed}` : ''}
${details.recentFailed ? `- Fallidos en 24h: ${details.recentFailed}` : ''}

⚠️  Acción Requerida:
Revisa el dashboard de webhooks y el health check del sistema para más detalles.

Dashboard Admin: ${process.env.URL_ADMIN || 'http://localhost:4200'}/saas-management
  `;
  
  return await sendAlertEmail(subject, htmlContent, textContent);
};

/**
 * Alerta: Base de datos no disponible
 */
export const alertDatabaseDown = async (errorMessage) => {
  const subject = 'Base de Datos No Disponible';
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #dc3545; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">🚨 Alerta Crítica: Base de Datos</h1>
      </div>
      
      <div style="padding: 20px; background: #f8f9fa;">
        <h2 style="color: #333;">⚠️ Problema Crítico Detectado</h2>
        <p style="font-size: 16px; color: #666;">
          La base de datos no está respondiendo. El sistema no puede operar sin conexión a la base de datos.
        </p>
        
        <div style="background: white; padding: 15px; border-left: 4px solid #dc3545; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Error Reportado</h3>
          <code style="color: #dc3545; display: block; padding: 10px; background: #f8f9fa; border-radius: 4px;">
            ${errorMessage}
          </code>
        </div>
        
        <div style="background: #dc3545; color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <strong>🚨 ACCIÓN INMEDIATA REQUERIDA</strong>
          <p style="margin: 5px 0 0 0;">
            Verifica la conexión a la base de datos y reinicia el servicio si es necesario.
          </p>
        </div>
        
        <p style="color: #666;">
          <strong>Timestamp:</strong> ${new Date().toISOString()}
        </p>
      </div>
    </div>
  `;
  
  const textContent = `
🚨 ALERTA CRÍTICA: Base de Datos No Disponible

La base de datos no está respondiendo. El sistema no puede operar sin conexión a la base de datos.

Error Reportado:
${errorMessage}

🚨 ACCIÓN INMEDIATA REQUERIDA
Verifica la conexión a la base de datos y reinicia el servicio si es necesario.

Timestamp: ${new Date().toISOString()}
  `;
  
  return await sendAlertEmail(subject, htmlContent, textContent);
};

/**
 * Alerta: Cron job falló
 */
export const alertCronJobFailed = async (cronJobName, errorMessage) => {
  const subject = `Cron Job Falló: ${cronJobName}`;
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #ffc107; color: #333; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">⚠️ Alerta: Cron Job Fallido</h1>
      </div>
      
      <div style="padding: 20px; background: #f8f9fa;">
        <h2 style="color: #333;">Cron Job: ${cronJobName}</h2>
        <p style="font-size: 16px; color: #666;">
          El cron job <strong>${cronJobName}</strong> ha fallado durante su ejecución.
        </p>
        
        <div style="background: white; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Error Reportado</h3>
          <code style="color: #dc3545; display: block; padding: 10px; background: #f8f9fa; border-radius: 4px; font-size: 12px;">
            ${errorMessage}
          </code>
        </div>
        
        <p style="color: #666;">
          <strong>Timestamp:</strong> ${new Date().toISOString()}
        </p>
        
        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <strong style="color: #856404;">💡 Recomendación:</strong>
          <p style="margin: 5px 0 0 0; color: #856404;">
            Revisa los logs del servidor y verifica que todos los servicios estén operacionales.
          </p>
        </div>
      </div>
    </div>
  `;
  
  const textContent = `
⚠️  ALERTA: Cron Job Falló - ${cronJobName}

El cron job "${cronJobName}" ha fallado durante su ejecución.

Error Reportado:
${errorMessage}

Timestamp: ${new Date().toISOString()}

💡 Recomendación:
Revisa los logs del servidor y verifica que todos los servicios estén operacionales.
  `;
  
  return await sendAlertEmail(subject, htmlContent, textContent);
};

/**
 * Alerta: Sistema en estado degradado
 */
export const alertSystemDegraded = async (issues = []) => {
  const subject = 'Sistema en Estado Degradado';
  
  const issuesList = issues.map(issue => `<li>${issue}</li>`).join('');
  const issuesText = issues.map(issue => `- ${issue}`).join('\n');
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #ffc107; color: #333; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">⚠️ Sistema en Estado Degradado</h1>
      </div>
      
      <div style="padding: 20px; background: #f8f9fa;">
        <h2 style="color: #333;">Problemas Detectados</h2>
        <p style="font-size: 16px; color: #666;">
          El sistema está operacional pero con problemas:
        </p>
        
        <div style="background: white; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
          <ul style="color: #666;">
            ${issuesList}
          </ul>
        </div>
        
        <p style="color: #666;">
          <strong>Timestamp:</strong> ${new Date().toISOString()}
        </p>
        
        <div style="text-align: center; margin-top: 30px;">
          <a href="${process.env.URL_ADMIN || 'http://localhost:4200'}/api/health" 
             style="background: #ffc107; color: #333; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Ver Health Check
          </a>
        </div>
      </div>
    </div>
  `;
  
  const textContent = `
⚠️  ALERTA: Sistema en Estado Degradado

El sistema está operacional pero con los siguientes problemas:

${issuesText}

Timestamp: ${new Date().toISOString()}

Health Check: ${process.env.URL_ADMIN || 'http://localhost:4200'}/api/health
  `;
  
  return await sendAlertEmail(subject, htmlContent, textContent);
};

export default {
  alertWebhookFailures,
  alertDatabaseDown,
  alertCronJobFailed,
  alertSystemDegraded
};
