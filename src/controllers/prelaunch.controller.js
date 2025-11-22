import { Op } from 'sequelize';
import { PrelaunchSubscriber } from '../models/PrelaunchSubscriber.js';
import crypto from 'crypto';
import { sendWelcomeEmail, sendLaunchEmails, verifyEmail as verifyEmailService, unsubscribeEmail } from '../services/prelaunchEmailService.js';

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
            console.log('✅ Welcome email sent to:', newSubscriber.email);
        } catch (emailError) {
            console.error('❌ Error sending welcome email:', emailError);
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
        const totalSubscribers = await PrelaunchSubscriber.count({
            where: { status: 'subscribed' }
        });

        const subscribersBySource = await PrelaunchSubscriber.findAll({
            attributes: [
                'source',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            where: { status: 'subscribed' },
            group: ['source'],
            raw: true
        });

        const recentSubscribers = await PrelaunchSubscriber.count({
            where: {
                status: 'subscribed',
                createdAt: {
                    [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24 horas
                }
            }
        });

        res.status(200).json({
            status: 200,
            data: {
                total_subscribers: totalSubscribers,
                recent_subscribers_24h: recentSubscribers,
                subscribers_by_source: subscribersBySource,
                generated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({
            status: 500,
            message: 'Error al obtener estadísticas'
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

        console.log('🚀 Starting launch email campaign with data:', emailData);
        
        const result = await sendLaunchEmails(emailData);
        
        if (result.success) {
            res.status(200).json({
                status: 200,
                message: result.message,
                data: {
                    sent: result.sent,
                    errors: result.errors,
                    total: result.total
                }
            });
        } else {
            res.status(500).json({
                status: 500,
                message: result.message,
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