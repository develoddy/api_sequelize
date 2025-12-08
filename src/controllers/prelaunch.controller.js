import { Op } from 'sequelize';
import { PrelaunchSubscriber } from '../models/PrelaunchSubscriber.js';
import { PrelaunchConfig } from '../models/PrelaunchConfig.js';
import { sequelize } from '../database/database.js';
import crypto from 'crypto';
import { sendWelcomeEmail, sendLaunchEmails, verifyEmail as verifyEmailService, unsubscribeEmail } from '../services/prelaunchEmailService.js';
import ejs from 'ejs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger, sanitize } from '../utils/logger.js';

// Para usar __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Suscribir email al pre-launch
 */
export const subscribe = async (req, res) => {
    try {
        const { email, source = 'main_form' } = req.body;

        // Validación básica
        if (!email) {
            return res.status(400).json({
                status: 400,
                message: 'El email es requerido'
            });
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                status: 400,
                message: 'El formato del email no es válido'
            });
        }

        // Verificar si ya existe
        const existingSubscriber = await PrelaunchSubscriber.findOne({
            where: { email: email.toLowerCase() }
        });

        if (existingSubscriber) {
            // Si ya existe pero está unsubscribed, lo reactivamos
            if (existingSubscriber.status === 'unsubscribed') {
                await existingSubscriber.update({
                    status: 'subscribed',
                    source: source // Actualizamos la fuente si se suscribe desde otro formulario
                });

                return res.status(200).json({
                    status: 200,
                    message: 'Te has vuelto a suscribir correctamente',
                    data: {
                        email: existingSubscriber.email,
                        resubscribed: true
                    }
                });
            }

            return res.status(200).json({
                status: 200,
                message: 'Ya estás suscrito a nuestras notificaciones',
                data: {
                    email: existingSubscriber.email,
                    already_subscribed: true
                }
            });
        }

        // Capturar información adicional de la request
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');
        const referrer = req.get('Referer');
        
        // Capturar UTM parameters si existen
        const { utm_source, utm_medium, utm_campaign } = req.query;

        // Generar token de verificación
        const verificationToken = crypto.randomBytes(32).toString('hex');

        // Crear nueva suscripción
        const newSubscriber = await PrelaunchSubscriber.create({
            email: email.toLowerCase(),
            source,
            ip_address: ipAddress,
            user_agent: userAgent,
            referrer,
            utm_source,
            utm_medium,
            utm_campaign,
            verification_token: verificationToken,
            session_id: req.body.session_id || null
        });

        // Enviar email de bienvenida inmediato
        try {
            await sendWelcomeEmail(newSubscriber.id);
            logger.debug('Welcome email sent to:', sanitize.email(newSubscriber.email));
        } catch (emailError) {
            logger.error('Error sending welcome email:', emailError.message);
            // No fallar la respuesta por error de email
        }

        res.status(201).json({
            status: 201,
            message: '¡Genial! Ya estás pre-registrado. Te notificaremos cuando estemos listos.',
            data: {
                email: newSubscriber.email,
                source: newSubscriber.source,
                subscribed_at: newSubscriber.createdAt
            }
        });

    } catch (error) {
        console.error('Error al suscribir email:', error);

        // Si es error de duplicado (por si acaso)
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(200).json({
                status: 200,
                message: 'Ya estás suscrito a nuestras notificaciones'
            });
        }

        res.status(500).json({
            status: 500,
            message: 'Ocurrió un problema al procesar tu suscripción. Intenta nuevamente.'
        });
    }
};

/**
 * Obtener estadísticas de suscriptores (para admin)
 */
export const getStats = async (req, res) => {
    try {
        // Obtener todas las estadísticas en paralelo para mayor velocidad
        const [
            total,
            verified,
            pending,
            unsubscribed,
            notified,
            bySource,
            byDate
        ] = await Promise.all([
            // Total de suscriptores
            PrelaunchSubscriber.count(),

            // Verificados
            PrelaunchSubscriber.count({
                where: { 
                    email_verified: true,
                    status: 'subscribed'
                }
            }),

            // Pendientes de verificación
            PrelaunchSubscriber.count({
                where: { 
                    email_verified: false,
                    status: 'pending'
                }
            }),

            // Desuscritos
            PrelaunchSubscriber.count({
                where: { status: 'unsubscribed' }
            }),

            // Notificados con campaña de lanzamiento
            PrelaunchSubscriber.count({
                where: { notified_launch: true }
            }),

            // Por fuente
            PrelaunchSubscriber.findAll({
                attributes: [
                    'source',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                group: ['source'],
                raw: true
            }),

            // Por fecha (últimos 7 días)
            PrelaunchSubscriber.findAll({
                attributes: [
                    [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                where: {
                    createdAt: {
                        [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    }
                },
                group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
                order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'DESC']],
                raw: true
            })
        ]);

        // Formatear by_source para el frontend
        const bySourceFormatted = {};
        bySource.forEach(item => {
            bySourceFormatted[item.source || 'unknown'] = parseInt(item.count);
        });

        // Formatear by_date para el frontend
        const byDateFormatted = {};
        byDate.forEach(item => {
            byDateFormatted[item.date] = parseInt(item.count);
        });

        // Calcular tasa de conversión
        const conversion_rate = total > 0 ? ((verified / total) * 100).toFixed(1) : 0;

        res.status(200).json({
            status: 200,
            data: {
                total,
                verified,
                pending,
                unsubscribed,
                notified,
                by_source: bySourceFormatted,
                by_date: byDateFormatted,
                conversion_rate: parseFloat(conversion_rate)
            }
        });

    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({
            status: 500,
            message: 'Error al obtener estadísticas',
            error: error.message
        });
    }
};

/**
 * Listar todos los suscriptores (para admin)
 */
export const listSubscribers = async (req, res) => {
    try {
        const { page = 1, limit = 50, status = 'subscribed', search } = req.query;
        const offset = (page - 1) * limit;

        let whereCondition = {};

        // Filtrar por estado
        if (status && status !== 'all') {
            whereCondition.status = status;
        }

        // Búsqueda por email
        if (search && search.trim() !== '') {
            whereCondition.email = {
                [Op.like]: `%${search.trim()}%`
            };
        }

        const subscribers = await PrelaunchSubscriber.findAndCountAll({
            where: whereCondition,
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset),
            attributes: [
                'id', 'email', 'source', 'status', 'email_verified',
                'notified_launch', 'coupon_sent', 'createdAt'
            ]
        });

        res.status(200).json({
            status: 200,
            data: {
                subscribers: subscribers.rows,
                pagination: {
                    total: subscribers.count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(subscribers.count / limit)
                }
            }
        });

    } catch (error) {
        console.error('Error al listar suscriptores:', error);
        res.status(500).json({
            status: 500,
            message: 'Error al obtener la lista de suscriptores'
        });
    }
};

/**
 * Desuscribir email
 */
export const unsubscribe = async (req, res) => {
    try {
        const { email, token } = req.query;

        if (!email) {
            return res.status(400).json({
                status: 400,
                message: 'Email es requerido'
            });
        }

        const subscriber = await PrelaunchSubscriber.findOne({
            where: { 
                email: email.toLowerCase(),
                ...(token && { verification_token: token })
            }
        });

        if (!subscriber) {
            return res.status(404).json({
                status: 404,
                message: 'Suscripción no encontrada'
            });
        }

        await subscriber.update({ status: 'unsubscribed' });

        res.status(200).json({
            status: 200,
            message: 'Te has desuscrito correctamente'
        });

    } catch (error) {
        console.error('Error al desuscribir:', error);
        res.status(500).json({
            status: 500,
            message: 'Error al procesar la desuscripción'
        });
    }
};

/**
 * Verificar email (si implementas verificación)
 */
export const verifyEmail = async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error - LujanDev Store</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #fdcb6e 0%, #e17055 100%);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 500px;
            width: 100%;
        }
        .warning-icon {
            font-size: 80px;
            color: #fdcb6e;
            margin-bottom: 20px;
        }
        h1 {
            color: #2d3436;
            margin-bottom: 15px;
            font-size: 28px;
        }
        p {
            color: #636e72;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 30px;
        }
        .btn {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 25px;
            font-weight: 600;
            transition: transform 0.2s;
        }
        .btn:hover {
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="warning-icon">⚠️</div>
        <h1>Token requerido</h1>
        <p>Falta el token de verificación en la URL.</p>
        <p>Usa el enlace que recibiste en tu email para verificar tu cuenta.</p>
        <a href="${process.env.URL_FRONTEND}" class="btn">Volver a la tienda</a>
    </div>
</body>
</html>
            `);
        }

        const subscriber = await PrelaunchSubscriber.findOne({
            where: { verification_token: token }
        });

        if (!subscriber) {
            return res.status(404).send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error de Verificación - LujanDev Store</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #ff7675 0%, #fd79a8 100%);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 500px;
            width: 100%;
        }
        .error-icon {
            font-size: 80px;
            color: #ff7675;
            margin-bottom: 20px;
        }
        h1 {
            color: #2d3436;
            margin-bottom: 15px;
            font-size: 28px;
        }
        p {
            color: #636e72;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 30px;
        }
        .btn {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 25px;
            font-weight: 600;
            transition: transform 0.2s;
        }
        .btn:hover {
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="error-icon">❌</div>
        <h1>Token inválido</h1>
        <p>El enlace de verificación no es válido o ya ha expirado.</p>
        <p>Si necesitas ayuda, contáctanos en <strong>lujandev@lujandev.com</strong></p>
        <a href="${process.env.URL_FRONTEND}" class="btn">Volver a la tienda</a>
    </div>
</body>
</html>
            `);
        }

        await subscriber.update({ 
            email_verified: true,
            verification_token: null // Limpiar token después de usar
        });

        // Devolver página HTML bonita en lugar de JSON
        res.status(200).send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verificado - LujanDev Store</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 500px;
            width: 100%;
        }
        .success-icon {
            font-size: 80px;
            color: #48bb78;
            margin-bottom: 20px;
        }
        h1 {
            color: #2d3436;
            margin-bottom: 15px;
            font-size: 28px;
        }
        p {
            color: #636e72;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 30px;
        }
        .btn {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 25px;
            font-weight: 600;
            transition: transform 0.2s;
        }
        .btn:hover {
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">✅</div>
        <h1>¡Email Verificado!</h1>
        <p>Tu email <strong>${subscriber.email}</strong> ha sido verificado correctamente.</p>
        <p>Ahora recibirás todas las notificaciones VIP del lanzamiento de LujanDev Store.</p>
        <a href="${process.env.URL_FRONTEND}" class="btn">Volver a la tienda</a>
    </div>
</body>
</html>
        `);

    } catch (error) {
        console.error('Error al verificar email:', error);
        res.status(500).json({
            status: 500,
            message: 'Error al verificar el email'
        });
    }
};

// Enviar emails de lanzamiento masivo (solo admin)
export const sendLaunchEmailsCampaign = async (req, res) => {
    try {
        const launchData = req.body;

        // Validaciones básicas
        const requiredFields = ['coupon_discount', 'coupon_expiry_days'];
        for (const field of requiredFields) {
            if (!launchData[field]) {
                return res.status(400).json({
                    status: 400,
                    message: `Campo requerido: ${field}`
                });
            }
        }

        // Datos por defecto
        const emailData = {
            coupon_discount: launchData.coupon_discount,
            coupon_expiry_days: launchData.coupon_expiry_days,
            launch_date: launchData.launch_date || new Date().toLocaleDateString('es-ES'),
            featured_products: launchData.featured_products || []
        };

        logger.debug('Starting launch email campaign with data:', emailData);
        
        const result = await sendLaunchEmails(emailData);
        
        // Si no hay suscriptores, devolver 200 con los datos en lugar de error 500
        if (result.success || result.total === 0) {
            res.status(200).json({
                status: 200,
                message: result.message,
                data: {
                    sent: result.sent || 0,
                    errors: result.errors || 0,
                    total: result.total || 0
                },
                warning: result.total === 0 ? 'No hay suscriptores pendientes' : null
            });
        } else {
            res.status(500).json({
                status: 500,
                message: result.message,
                data: {
                    sent: result.sent || 0,
                    errors: result.errors || 0,
                    total: result.total || 0
                },
                error: result.error
            });
        }

    } catch (error) {
        console.error('Error sending launch emails:', error);
        res.status(500).json({ 
            status: 500, 
            message: 'Error interno del servidor' 
        });
    }
};

/**
 * ADMIN ENDPOINTS
 * Endpoints específicos para el panel de administración
 */

/**
 * Obtener lista de todos los suscriptores (ADMIN)
 */
export const getAllSubscribers = async (req, res) => {
    try {
        const { status, verified, notified, source } = req.query;
        
        const whereClause = {};
        
        if (status) whereClause.status = status;
        if (verified !== undefined) whereClause.email_verified = verified === 'true';
        if (notified !== undefined) whereClause.notified_launch = notified === 'true';
        if (source) whereClause.source = source;

        const subscribers = await PrelaunchSubscriber.findAll({
            where: whereClause,
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            status: 200,
            data: subscribers
        });

    } catch (error) {
        console.error('Error getting subscribers:', error);
        res.status(500).json({ 
            status: 500, 
            message: 'Error al obtener suscriptores' 
        });
    }
};

/**
 * Obtener suscriptor por ID (ADMIN)
 */
export const getSubscriberById = async (req, res) => {
    try {
        const { id } = req.params;

        const subscriber = await PrelaunchSubscriber.findByPk(id);

        if (!subscriber) {
            return res.status(404).json({
                status: 404,
                message: 'Suscriptor no encontrado'
            });
        }

        res.status(200).json({
            status: 200,
            data: subscriber
        });

    } catch (error) {
        console.error('Error getting subscriber:', error);
        res.status(500).json({ 
            status: 500, 
            message: 'Error al obtener suscriptor' 
        });
    }
};

/**
 * Preview del email de lanzamiento (ADMIN)
 */
export const previewLaunchEmail = async (req, res) => {
    try {
        
        const { coupon_discount, coupon_expiry_days, featured_products } = req.body;

        // Generar HTML del email para preview
        const previewData = {
            user_name: 'Usuario Ejemplo',
            coupon_code: 'PREVIEW123',
            coupon_discount,
            coupon_expiry_days,
            launch_date: new Date().toLocaleDateString('es-ES'),
            featured_products: featured_products || [],
            store_url: process.env.URL_FRONTEND || 'http://localhost:4200'
        };

        // Cargar y compilar template con EJS
        const templatePath = path.join(process.cwd(), 'src/mails/email_prelaunch_launch.html');
        
        // Renderizar con EJS
        const html = await ejs.renderFile(templatePath, {
            email: 'ejemplo@email.com',
            brand_name: process.env.BRAND_NAME || 'Tu Tienda',
            support_email: process.env.SUPPORT_EMAIL || 'soporte@tutienda.com',
            unsubscribe_url: `${process.env.URL_BACKEND || 'http://localhost:3500'}/api/prelaunch/unsubscribe/PREVIEW`,
            ...previewData
        });

        res.status(200).json({
            status: 200,
            html
        });

    } catch (error) {
        console.error('❌ Error generating preview:', error);
        res.status(500).json({ 
            status: 500, 
            message: 'Error al generar preview',
            error: error.message
        });
    }
};

/**
 * Exportar suscriptores a CSV (ADMIN)
 */
export const exportSubscribers = async (req, res) => {
    try {
        const subscribers = await PrelaunchSubscriber.findAll({
            order: [['createdAt', 'DESC']]
        });

        // Generar CSV
        const csvHeaders = 'Email,Source,Status,Verified,Notified,Created At,UTM Source,UTM Medium,UTM Campaign\n';
        const csvRows = subscribers.map(sub => 
            `${sub.email},${sub.source},${sub.status},${sub.email_verified},${sub.notified_launch},${sub.createdAt},${sub.utm_source || ''},${sub.utm_medium || ''},${sub.utm_campaign || ''}`
        ).join('\n');

        const csv = csvHeaders + csvRows;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=prelaunch_subscribers.csv');
        res.status(200).send(csv);

    } catch (error) {
        console.error('Error exporting subscribers:', error);
        res.status(500).json({ 
            status: 500, 
            message: 'Error al exportar datos' 
        });
    }
};

/**
 * Reenviar email de verificación (ADMIN)
 */
export const resendVerification = async (req, res) => {
    try {
        const { email } = req.body;

        const subscriber = await PrelaunchSubscriber.findOne({
            where: { email: email.toLowerCase() }
        });

        if (!subscriber) {
            return res.status(404).json({
                status: 404,
                message: 'Suscriptor no encontrado'
            });
        }

        if (subscriber.email_verified) {
            return res.status(400).json({
                status: 400,
                message: 'Este email ya está verificado'
            });
        }

        // Generar nuevo token si no existe
        if (!subscriber.verification_token) {
            const verificationToken = crypto.randomBytes(32).toString('hex');
            await subscriber.update({ verification_token: verificationToken });
        }

        // Reenviar email de bienvenida con verificación
        await sendWelcomeEmail({
            email: subscriber.email,
            verification_token: subscriber.verification_token
        });

        res.status(200).json({
            status: 200,
            message: 'Email de verificación reenviado correctamente'
        });

    } catch (error) {
        console.error('Error resending verification:', error);
        res.status(500).json({ 
            status: 500, 
            message: 'Error al reenviar verificación' 
        });
    }
}

/**
 * ============================================================================
 *                    CONFIGURACIÓN DE PRE-LAUNCH MODE
 * ============================================================================
 */

/**
 * Obtener configuración actual del pre-launch mode
 */
export const getPrelaunchConfig = async (req, res) => {
    try {
        const config = await PrelaunchConfig.getInstance();
        
        res.status(200).json({
            status: 200,
            message: 'Configuración obtenida correctamente',
            data: {
                enabled: config.enabled,
                updated_at: config.updated_at,
                updated_by: config.updated_by
            }
        });

    } catch (error) {
        console.error('Error getting prelaunch config:', error);
        logger.error('Error obteniendo configuración de pre-launch', { error: error.message });
        
        res.status(500).json({
            status: 500,
            message: 'Error al obtener la configuración'
        });
    }
};

/**
 * Actualizar configuración del pre-launch mode
 */
export const updatePrelaunchConfig = async (req, res) => {
    try {
        const { enabled } = req.body;
        const adminId = req.user?.id || null; // Obtener ID del admin autenticado
        
        // Validación
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({
                status: 400,
                message: 'El campo "enabled" debe ser true o false'
            });
        }

        // Actualizar configuración
        const config = await PrelaunchConfig.updateConfig(enabled, adminId);
        
        logger.info('Configuración de pre-launch actualizada', {
            enabled,
            admin_id: adminId,
            previous_state: !enabled
        });

        res.status(200).json({
            status: 200,
            message: `Modo pre-launch ${enabled ? 'activado' : 'desactivado'} correctamente`,
            data: {
                enabled: config.enabled,
                updated_at: config.updated_at,
                updated_by: config.updated_by
            }
        });

    } catch (error) {
        console.error('Error updating prelaunch config:', error);
        logger.error('Error actualizando configuración de pre-launch', { 
            error: error.message,
            admin_id: req.user?.id 
        });
        
        res.status(500).json({
            status: 500,
            message: 'Error al actualizar la configuración'
        });
    }
};

/**
 * Obtener estado del pre-launch mode (endpoint público para frontend)
 */
export const getPrelaunchStatus = async (req, res) => {
    try {
        const enabled = await PrelaunchConfig.isEnabled();
        
        res.status(200).json({
            status: 200,
            enabled
        });

    } catch (error) {
        console.error('Error getting prelaunch status:', error);
        
        // En caso de error, devolver false por seguridad
        res.status(200).json({
            status: 200,
            enabled: false,
            error: 'Error al verificar estado'
        });
    }
};;