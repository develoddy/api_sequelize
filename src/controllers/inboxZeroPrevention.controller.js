import crypto from 'crypto';
import { Tenant } from '../models/Tenant.js';
import { Module } from '../models/Module.js';
import emailService from '../services/emailNotification.service.js';

/**
 * 📬 Inbox Zero Prevention - Setup Request Controller
 * Maneja solicitudes públicas de setup para el módulo SaaS
 */

/**
 * Validar email con formato básico
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Normalizar URL - Agregar https:// si falta el protocolo
 */
const normalizeUrl = (url) => {
  // Si ya tiene protocolo, retornar como está
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // Agregar https:// por defecto
  return `https://${url}`;
};

/**
 * Validar formato de URL
 */
const isValidUrl = (url) => {
  try {
    const normalizedUrl = normalizeUrl(url);
    const urlObj = new URL(normalizedUrl);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
};

/**
 * Generar password aleatorio seguro
 */
const generateRandomPassword = () => {
  return crypto.randomBytes(16).toString('hex');
};

/**
 * POST /api/public/inbox-zero/setup-request
 * Crear solicitud de setup para nuevo tenant
 */
export const createSetupRequest = async (req, res) => {
  try {
    const { email, storeUrl, printfulApiKey, platform } = req.body;
    
    // 1️⃣ Validaciones (solo email es obligatorio)
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }
    
    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }
    
    // Validar URL solo si viene
    if (storeUrl && !isValidUrl(storeUrl)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }
    
    // Normalizar URL antes de guardar (agregar https:// si falta)
    const normalizedStoreUrl = storeUrl ? normalizeUrl(storeUrl) : null;
    
    const moduleKey = 'inbox-zero-prevention';
    
    // 2️⃣ Verificar si ya existe tenant con este email y módulo
    const existingTenant = await Tenant.findOne({
      where: { email, module_key: moduleKey }
    });
    
    if (existingTenant) {
      return res.status(409).json({
        success: false,
        error: 'A request already exists with this email'
      });
    }
    
    // 3️⃣ Generar password aleatorio (requerido por el modelo)
    const randomPassword = generateRandomPassword();
    
    // 4️⃣ Extraer nombre de dominio para el campo name (o usar email si no hay store URL)
    const storeName = normalizedStoreUrl ? new URL(normalizedStoreUrl).hostname.replace('www.', '') : email.split('@')[0];
    
    // 5️⃣ Crear tenant en la base de datos
    const tenant = await Tenant.create({
      name: storeName,
      email: email,
      password: randomPassword, // Se auto-hashea con bcrypt en beforeCreate hook
      module_key: moduleKey,
      plan: 'trial',
      status: 'pending_setup', // Requiere configuración manual de credenciales Printful
      metadata: {
        storeUrl: normalizedStoreUrl || null,
        printfulApiKey: printfulApiKey || null,
        platform: platform || null,
        submittedAt: new Date().toISOString(),
        source: 'landing-page-form'
      }
      // trial_ends_at se configura manualmente cuando se activa el tenant
    });
    
    console.log('✅ [Inbox Zero Prevention] Tenant creado:', {
      id: tenant.id,
      email: tenant.email,
      storeUrl: normalizedStoreUrl,
      platform: platform
    });
    
    // 6️⃣ Enviar email de notificación al admin
    const adminEmail = process.env.ADMIN_EMAIL;
    
    if (adminEmail) {
      try {
        const emailSubject = '🚀 Nuevo Setup Request - Inbox Zero Prevention';
        
        const emailBody = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
              .info-box { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 4px; }
              .info-row { margin: 10px 0; }
              .label { font-weight: bold; color: #667eea; }
              .value { color: #333; margin-left: 10px; }
              .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🚀 Nueva Solicitud de Setup</h1>
                <p style="margin: 0;">Inbox Zero Prevention</p>
              </div>
              
              <div class="content">
                <p>Has recibido una nueva solicitud de configuración para <strong>Inbox Zero Prevention</strong>.</p>
                
                <div class="info-box">
                  <h3 style="margin-top: 0; color: #667eea;">📋 Datos del Cliente</h3>
                  <div class="info-row">
                    <span class="label">📧 Email:</span>
                    <span class="value">${email}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">🏪 Store URL:</span>
                    <span class="value">${normalizedStoreUrl || '<strong>Pending</strong>'}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">🛠️ Platform:</span>
                    <span class="value">${platform || '<strong>Pending</strong>'}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">🔑 API Key:</span>
                    <span class="value">${printfulApiKey ? printfulApiKey.substring(0, 10) + '...' : '<strong>Pending — request via email</strong>'}</span>
                  </div>
                </div>
                
                <div class="info-box">
                  <h3 style="margin-top: 0; color: #667eea;">🆔 Información del Tenant</h3>
                  <div class="info-row">
                    <span class="label">Tenant ID:</span>
                    <span class="value">${tenant.id}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">Status:</span>
                    <span class="value">${tenant.status}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">Trial termina:</span>
                    <span class="value">${new Date(tenant.trial_ends_at).toLocaleDateString('es-ES')}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">Fecha de solicitud:</span>
                    <span class="value">${new Date().toLocaleString('es-ES')}</span>
                  </div>
                </div>
                
                <div style="text-align: center;">
                  <a href="${process.env.URL_ADMIN || 'http://localhost:4201'}/saas-management" class="button">
                    Ver en Dashboard Admin
                  </a>
                </div>
                
                <div class="footer">
                  <p>Este es un email automático del sistema Inbox Zero Prevention.</p>
                  <p>Tenant creado automáticamente con trial de ${process.env.TRIAL_DAYS || 14} días.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;
        
        await emailService.sendEmail(adminEmail, emailSubject, emailBody);
        console.log('✅ [Inbox Zero Prevention] Email enviado a:', adminEmail);
        
      } catch (emailError) {
        console.error('❌ [Inbox Zero Prevention] Error enviando email:', emailError.message);
        // No fallar la request aunque el email falle
      }
    } else {
      console.warn('⚠️ [Inbox Zero Prevention] ADMIN_EMAIL no configurado, email no enviado');
    }
    
    // 7️⃣ Responder al cliente
    res.status(201).json({
      success: true,
      tenantId: tenant.id,
      message: 'Setup request received successfully'
    });
    
  } catch (error) {
    console.error('❌ [Inbox Zero Prevention] Error en createSetupRequest:', error);
    
    res.status(500).json({
      success: false,
      error: 'Error processing request. Please try again.'
    });
  }
};

export default {
  createSetupRequest
};
