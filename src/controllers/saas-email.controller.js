import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import ejs from 'ejs';
import nodemailer from 'nodemailer';
import { Tenant } from '../models/Tenant.js';
import { Module } from '../models/Module.js';

/**
 * 📧 SaaS Email Controller
 * Maneja el envío de emails transaccionales del sistema de suscripciones
 */

// Helper para leer archivos HTML
const readHTMLFile = (filePath, callback) => {
    fs.readFile(filePath, { encoding: 'utf-8' }, (err, html) => {
        if (err) {
            return callback(err);
        }
        callback(null, html);
    });
};

// Configurar transporter SMTP (reutilizable)
const getTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        tls: {
            rejectUnauthorized: false
        }
    });
};

// Validar formato de email
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidDomains = ['example.com', 'test.com', 'localhost', 'fake.com'];
    
    if (!emailRegex.test(email)) return false;
    
    const domain = email.split('@')[1]?.toLowerCase();
    return domain && !invalidDomains.includes(domain);
};

// Generar URL del dashboard (desarrollo vs producción)
// Dashboard específico del módulo: http://localhost:4202/mailflow
// Upgrade global (sin módulo): http://localhost:4202/upgrade
const getDashboardUrl = (tenant, path = '') => {
    const baseUrl = process.env.URL_APP_SAAS || 'http://localhost:4202';
    
    // Si el path es /upgrade, no incluir el moduleKey (ruta global)
    if (path === '/upgrade') {
        return `${baseUrl}${path}`;
    }
    
    // Para otras rutas, incluir el moduleKey
    const moduleRoute = `/${tenant.module_key}`;
    return `${baseUrl}${moduleRoute}${path}`;
};

// Formatear fecha para mostrar en emails
const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return d.toLocaleDateString('es-ES', options);
};

// Calcular días restantes hasta una fecha
const getDaysUntil = (targetDate) => {
    if (!targetDate) return 0;
    const now = new Date();
    const target = new Date(targetDate);
    const diffTime = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
};

/**
 * 1️⃣ Email de Bienvenida - Trial Welcome
 * Se envía inmediatamente después de registrarse
 */
export const sendTrialWelcomeEmail = async (tenantId) => {
    console.log('📧 [SaaS Email] Enviando trial welcome email para tenant:', tenantId);
    
    try {
        const tenant = await Tenant.findByPk(tenantId, {
            include: [{ model: Module, as: 'module' }]
        });
        
        if (!tenant) {
            console.error('❌ [SaaS Email] Tenant no encontrado:', tenantId);
            return;
        }
        
        if (!isValidEmail(tenant.email)) {
            console.warn('⚠️ [SaaS Email] Email inválido:', tenant.email);
            return;
        }
        
        const module = tenant.module || await Module.findByPk(tenant.module_key);
        const dashboardUrl = getDashboardUrl(tenant);
        
        readHTMLFile(`${process.cwd()}/src/mails/email_saas_trial_welcome.html`, (err, html) => {
            if (err) {
                console.error('❌ [SaaS Email] Error leyendo template:', err);
                return;
            }
            
            // Reemplazar placeholders
            let htmlContent = html
                .replace(/{MODULE_NAME}/g, module.name)
                .replace(/{TENANT_NAME}/g, tenant.name || tenant.subdomain)
                .replace(/{TRIAL_START_DATE}/g, formatDate(tenant.trial_starts_at))
                .replace(/{TRIAL_END_DATE}/g, formatDate(tenant.trial_ends_at))
                .replace(/{DASHBOARD_URL}/g, dashboardUrl)
                .replace(/{TENANT_EMAIL}/g, tenant.email);
            
            const transporter = getTransporter();
            
            const mailOptions = {
                from: `"LujanDev SaaS" <${process.env.EMAIL_USER}>`,
                to: tenant.email,
                subject: `🎉 Bienvenido a ${module.name} - Tu prueba gratuita ha comenzado`,
                html: htmlContent
            };
            
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('❌ [SaaS Email] Error enviando welcome email:', error.message);
                } else {
                    console.log('✅ [SaaS Email] Welcome email enviado a:', tenant.email);
                    console.log('✅ [SaaS Email] MessageId:', info.messageId);
                }
            });
        });
        
    } catch (error) {
        console.error('❌ [SaaS Email] Error en sendTrialWelcomeEmail:', error);
    }
};

/**
 * 2️⃣ Email de Trial Expirando Pronto
 * Se envía 3 días antes de que expire el trial
 */
export const sendTrialExpiringEmail = async (tenantId) => {
    console.log('📧 [SaaS Email] Enviando trial expiring email para tenant:', tenantId);
    
    try {
        const tenant = await Tenant.findByPk(tenantId, {
            include: [{ model: Module, as: 'module' }]
        });
        
        if (!tenant || !isValidEmail(tenant.email)) {
            console.warn('⚠️ [SaaS Email] Tenant inválido o email inválido');
            return;
        }
        
        const module = tenant.module || await Module.findByPk(tenant.module_key);
        const dashboardUrl = getDashboardUrl(tenant);
        const upgradeUrl = getDashboardUrl(tenant, '/upgrade') + `?email=${encodeURIComponent(tenant.email)}&module=${tenant.module_key}`;
        const daysLeft = getDaysUntil(tenant.trial_ends_at);
        
        readHTMLFile(`${process.cwd()}/src/mails/email_saas_trial_expiring_soon.html`, (err, html) => {
            if (err) {
                console.error('❌ [SaaS Email] Error leyendo template:', err);
                return;
            }
            
            let htmlContent = html
                .replace(/{MODULE_NAME}/g, module.name)
                .replace(/{TENANT_NAME}/g, tenant.name || tenant.subdomain)
                .replace(/{DAYS_LEFT}/g, daysLeft.toString())
                .replace(/{TRIAL_END_DATE}/g, formatDate(tenant.trial_ends_at))
                .replace(/{DASHBOARD_URL}/g, dashboardUrl)
                .replace(/{UPGRADE_URL}/g, upgradeUrl)
                .replace(/{TENANT_EMAIL}/g, tenant.email);
            
            const transporter = getTransporter();
            
            const mailOptions = {
                from: `"LujanDev SaaS" <${process.env.EMAIL_USER}>`,
                to: tenant.email,
                subject: `⏰ Tu prueba de ${module.name} termina en ${daysLeft} días`,
                html: htmlContent
            };
            
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('❌ [SaaS Email] Error enviando expiring email:', error.message);
                } else {
                    console.log('✅ [SaaS Email] Expiring email enviado a:', tenant.email);
                }
            });
        });
        
    } catch (error) {
        console.error('❌ [SaaS Email] Error en sendTrialExpiringEmail:', error);
    }
};

/**
 * 3️⃣ Email de Trial Expirado
 * Se envía cuando el trial expira sin suscripción
 */
export const sendTrialExpiredEmail = async (tenantId) => {
    console.log('📧 [SaaS Email] Enviando trial expired email para tenant:', tenantId);
    
    try {
        const tenant = await Tenant.findByPk(tenantId, {
            include: [{ model: Module, as: 'module' }]
        });
        
        if (!tenant || !isValidEmail(tenant.email)) {
            console.warn('⚠️ [SaaS Email] Tenant inválido o email inválido');
            return;
        }
        
        const module = tenant.module || await Module.findByPk(tenant.module_key);
        const upgradeUrl = getDashboardUrl(tenant, '/upgrade') + `?email=${encodeURIComponent(tenant.email)}&module=${tenant.module_key}`;
        
        readHTMLFile(`${process.cwd()}/src/mails/email_saas_trial_expired.html`, (err, html) => {
            if (err) {
                console.error('❌ [SaaS Email] Error leyendo template:', err);
                return;
            }
            
            let htmlContent = html
                .replace(/{MODULE_NAME}/g, module.name)
                .replace(/{TENANT_NAME}/g, tenant.name || tenant.subdomain)
                .replace(/{TRIAL_END_DATE}/g, formatDate(tenant.trial_ends_at))
                .replace(/{UPGRADE_URL}/g, upgradeUrl)
                .replace(/{TENANT_EMAIL}/g, tenant.email);
            
            const transporter = getTransporter();
            
            const mailOptions = {
                from: `"LujanDev SaaS" <${process.env.EMAIL_USER}>`,
                to: tenant.email,
                subject: `Tu prueba de ${module.name} ha finalizado - Oferta especial 20% OFF`,
                html: htmlContent
            };
            
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('❌ [SaaS Email] Error enviando expired email:', error.message);
                } else {
                    console.log('✅ [SaaS Email] Expired email enviado a:', tenant.email);
                }
            });
        });
        
    } catch (error) {
        console.error('❌ [SaaS Email] Error en sendTrialExpiredEmail:', error);
    }
};

/**
 * 4️⃣ Email de Pago Exitoso
 * Se envía cuando se procesa un pago de suscripción
 */
export const sendPaymentSuccessEmail = async (tenantId, subscriptionDetails = {}) => {
    console.log('📧 [SaaS Email] Enviando payment success email para tenant:', tenantId);
    
    try {
        const tenant = await Tenant.findByPk(tenantId, {
            include: [{ model: Module, as: 'module' }]
        });
        
        if (!tenant || !isValidEmail(tenant.email)) {
            console.warn('⚠️ [SaaS Email] Tenant inválido o email inválido');
            return;
        }
        
        const module = tenant.module || await Module.findByPk(tenant.module_key);
        const dashboardUrl = getDashboardUrl(tenant);
        
        // Mapeo de planes
        const planNames = {
            'starter': 'Starter',
            'professional': 'Professional',
            'business': 'Business'
        };
        
        const planName = planNames[tenant.subscription_plan] || tenant.subscription_plan || 'Starter';
        const amount = subscriptionDetails.amount || '9.99';
        
        // Calcular próxima renovación (30 días desde ahora)
        const nextBilling = new Date();
        nextBilling.setDate(nextBilling.getDate() + 30);
        
        readHTMLFile(`${process.cwd()}/src/mails/email_saas_payment_success.html`, (err, html) => {
            if (err) {
                console.error('❌ [SaaS Email] Error leyendo template:', err);
                return;
            }
            
            let htmlContent = html
                .replace(/{MODULE_NAME}/g, module.name)
                .replace(/{TENANT_NAME}/g, tenant.name || tenant.subdomain)
                .replace(/{PLAN_NAME}/g, planName)
                .replace(/{START_DATE}/g, formatDate(new Date()))
                .replace(/{NEXT_BILLING_DATE}/g, formatDate(nextBilling))
                .replace(/{AMOUNT}/g, amount)
                .replace(/{DASHBOARD_URL}/g, dashboardUrl)
                .replace(/{TENANT_EMAIL}/g, tenant.email);
            
            const transporter = getTransporter();
            
            const mailOptions = {
                from: `"LujanDev SaaS" <${process.env.EMAIL_USER}>`,
                to: tenant.email,
                subject: `✅ Pago confirmado - ${module.name} Plan ${planName}`,
                html: htmlContent
            };
            
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('❌ [SaaS Email] Error enviando payment success email:', error.message);
                } else {
                    console.log('✅ [SaaS Email] Payment success email enviado a:', tenant.email);
                }
            });
        });
        
    } catch (error) {
        console.error('❌ [SaaS Email] Error en sendPaymentSuccessEmail:', error);
    }
};

/**
 * 5️⃣ Email de Suscripción Cancelada
 * Se envía cuando el usuario cancela su suscripción
 */
export const sendSubscriptionCancelledEmail = async (tenantId) => {
    console.log('📧 [SaaS Email] Enviando subscription cancelled email para tenant:', tenantId);
    
    try {
        const tenant = await Tenant.findByPk(tenantId, {
            include: [{ model: Module, as: 'module' }]
        });
        
        if (!tenant || !isValidEmail(tenant.email)) {
            console.warn('⚠️ [SaaS Email] Tenant inválido o email inválido');
            return;
        }
        
        const module = tenant.module || await Module.findByPk(tenant.module_key);
        const dashboardUrl = getDashboardUrl(tenant);
        
        // Fecha hasta cuando tiene acceso (subscription_ends_at)
        const accessUntilDate = tenant.subscription_ends_at 
            ? formatDate(tenant.subscription_ends_at)
            : formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)); // +30 días por defecto
        
        readHTMLFile(`${process.cwd()}/src/mails/email_saas_subscription_cancelled.html`, (err, html) => {
            if (err) {
                console.error('❌ [SaaS Email] Error leyendo template:', err);
                return;
            }
            
            let htmlContent = html
                .replace(/{MODULE_NAME}/g, module.name)
                .replace(/{TENANT_NAME}/g, tenant.name || tenant.subdomain)
                .replace(/{ACCESS_UNTIL_DATE}/g, accessUntilDate)
                .replace(/{DASHBOARD_URL}/g, dashboardUrl)
                .replace(/{TENANT_EMAIL}/g, tenant.email);
            
            const transporter = getTransporter();
            
            const mailOptions = {
                from: `"LujanDev SaaS" <${process.env.EMAIL_USER}>`,
                to: tenant.email,
                subject: `Suscripción cancelada - ${module.name}`,
                html: htmlContent
            };
            
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('❌ [SaaS Email] Error enviando cancelled email:', error.message);
                } else {
                    console.log('✅ [SaaS Email] Cancelled email enviado a:', tenant.email);
                }
            });
        });
        
    } catch (error) {
        console.error('❌ [SaaS Email] Error en sendSubscriptionCancelledEmail:', error);
    }
};

/**
 * 6️⃣ Email de Acceso Perdido
 * Se envía cuando se elimina la suscripción (subscription.deleted webhook)
 */
export const sendAccessLostEmail = async (tenantId) => {
    console.log('📧 [SaaS Email] Enviando access lost email para tenant:', tenantId);
    
    try {
        const tenant = await Tenant.findByPk(tenantId, {
            include: [{ model: Module, as: 'module' }]
        });
        
        if (!tenant || !isValidEmail(tenant.email)) {
            console.warn('⚠️ [SaaS Email] Tenant inválido o email inválido');
            return;
        }
        
        const module = tenant.module || await Module.findByPk(tenant.module_key);
        const renewUrl = getDashboardUrl(tenant, '/upgrade') + `?email=${encodeURIComponent(tenant.email)}&module=${tenant.module_key}`;
        
        readHTMLFile(`${process.cwd()}/src/mails/email_saas_access_lost.html`, (err, html) => {
            if (err) {
                console.error('❌ [SaaS Email] Error leyendo template:', err);
                return;
            }
            
            let htmlContent = html
                .replace(/{MODULE_NAME}/g, module.name)
                .replace(/{TENANT_NAME}/g, tenant.name || tenant.subdomain)
                .replace(/{SUBSCRIPTION_END_DATE}/g, formatDate(tenant.subscription_ends_at || new Date()))
                .replace(/{RENEW_URL}/g, renewUrl)
                .replace(/{TENANT_EMAIL}/g, tenant.email);
            
            const transporter = getTransporter();
            
            const mailOptions = {
                from: `"LujanDev SaaS" <${process.env.EMAIL_USER}>`,
                to: tenant.email,
                subject: `Acceso suspendido - ${module.name}`,
                html: htmlContent
            };
            
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('❌ [SaaS Email] Error enviando access lost email:', error.message);
                } else {
                    console.log('✅ [SaaS Email] Access lost email enviado a:', tenant.email);
                }
            });
        });
        
    } catch (error) {
        console.error('❌ [SaaS Email] Error en sendAccessLostEmail:', error);
    }
};

/**
 * 🔍 Función helper para testing
 * Verifica la configuración SMTP
 */
export const testEmailConfiguration = async () => {
    try {
        const transporter = getTransporter();
        const verified = await transporter.verify();
        
        if (verified) {
            console.log('✅ SMTP configurado correctamente');
            return { success: true, message: 'SMTP configurado correctamente' };
        }
    } catch (error) {
        console.error('❌ Error en configuración SMTP:', error);
        return { success: false, error: error.message };
    }
};
