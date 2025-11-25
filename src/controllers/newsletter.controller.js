import { Op } from 'sequelize';
import { NewsletterSubscriber } from '../models/NewsletterSubscriber.js';
import { NewsletterCampaign } from '../models/NewsletterCampaign.js';
import { sequelize } from '../database/database.js';
import crypto from 'crypto';
import { 
    sendNewsletterWelcomeEmail, 
    sendNewsletterCampaign 
} from '../services/newsletterEmailService.js';

// Rate limiting simple (en producción usar Redis)
const subscriptionAttempts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minuto
const MAX_ATTEMPTS = 5;

/**
 * Rate limiter simple por IP
 */
const checkRateLimit = (ip) => {
    const now = Date.now();
    const attempts = subscriptionAttempts.get(ip) || [];
    
    // Limpiar intentos antiguos
    const recentAttempts = attempts.filter(time => now - time < RATE_LIMIT_WINDOW);
    
    if (recentAttempts.length >= MAX_ATTEMPTS) {
        return false;
    }
    
    recentAttempts.push(now);
    subscriptionAttempts.set(ip, recentAttempts);
    return true;
};

/**
 * Suscribir email al newsletter
 */
export const subscribe = async (req, res) => {
    try {
        const { email, source = 'home', userId } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress;

        // Rate limiting
        if (!checkRateLimit(ipAddress)) {
            return res.status(429).json({
                status: 429,
                message: 'Demasiados intentos. Por favor, espera un momento.'
            });
        }

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

        // Validar source permitido
        const allowedSources = ['home', 'footer', 'checkout', 'campaign_import', 'admin'];
        if (!allowedSources.includes(source)) {
            return res.status(400).json({
                status: 400,
                message: 'Fuente de suscripción no válida'
            });
        }

        // Buscar suscriptor existente: primero por userId (si existe), luego por email
        let whereClause = { email: email.toLowerCase() };
        if (userId) {
            whereClause = {
                [Op.or]: [
                    { userId: userId },
                    { email: email.toLowerCase() }
                ]
            };
        }

        const existingSubscriber = await NewsletterSubscriber.findOne({
            where: whereClause
        });

        if (existingSubscriber) {
            // Si existe un registro guest (sin userId) y ahora el usuario está autenticado,
            // actualizar el registro con el userId
            if (!existingSubscriber.userId && userId) {
                await existingSubscriber.update({
                    userId: userId,
                    status: 'subscribed',
                    source: source
                });

                return res.status(200).json({
                    status: 200,
                    message: 'Tu suscripción ha sido vinculada a tu cuenta',
                    data: {
                        email: existingSubscriber.email,
                        userId: userId,
                        linked: true
                    }
                });
            }

            // Si ya existe pero está unsubscribed, lo reactivamos
            if (existingSubscriber.status === 'unsubscribed') {
                await existingSubscriber.update({
                    status: 'subscribed',
                    source: source,
                    userId: userId || existingSubscriber.userId
                });

                return res.status(200).json({
                    status: 200,
                    message: 'Te has vuelto a suscribir correctamente',
                    data: {
                        email: existingSubscriber.email,
                        userId: existingSubscriber.userId,
                        resubscribed: true
                    }
                });
            }

            return res.status(200).json({
                status: 200,
                message: 'Ya estás suscrito a nuestro newsletter',
                data: {
                    email: existingSubscriber.email,
                    userId: existingSubscriber.userId,
                    already_subscribed: true
                }
            });
        }

        // Capturar información adicional
        const userAgent = req.get('User-Agent');
        const referrer = req.get('Referer');
        const { utm_source, utm_medium, utm_campaign } = req.query;

        // Generar token de verificación
        const verificationToken = crypto.randomBytes(32).toString('hex');

        // Crear nueva suscripción
        const newSubscriber = await NewsletterSubscriber.create({
            email: email.toLowerCase(),
            userId: userId || null,
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

        // Enviar email de bienvenida
        try {
            await sendNewsletterWelcomeEmail(newSubscriber);
            console.log('✅ Newsletter welcome email sent to:', newSubscriber.email);
        } catch (emailError) {
            console.error('❌ Error sending welcome email:', emailError);
        }

        res.status(201).json({
            status: 201,
            message: '¡Genial! Te has suscrito a nuestro newsletter.',
            data: {
                email: newSubscriber.email,
                source: newSubscriber.source,
                subscribed_at: newSubscriber.createdAt
            }
        });

    } catch (error) {
        console.error('Error al suscribir email:', error);

        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(200).json({
                status: 200,
                message: 'Ya estás suscrito a nuestro newsletter'
            });
        }

        res.status(500).json({
            status: 500,
            message: 'Ocurrió un problema al procesar tu suscripción. Intenta nuevamente.'
        });
    }
};

/**
 * Verificar email
 */
export const confirmEmail = async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Token requerido - LujanDev Store</title>
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
        }
        .warning-icon { font-size: 80px; color: #fdcb6e; margin-bottom: 20px; }
        h1 { color: #2d3436; margin-bottom: 15px; font-size: 28px; }
        p { color: #636e72; font-size: 16px; line-height: 1.6; margin-bottom: 30px; }
        .btn {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 25px;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="warning-icon">⚠️</div>
        <h1>Token requerido</h1>
        <p>Usa el enlace que recibiste en tu email para verificar tu cuenta.</p>
        <a href="${process.env.URL_FRONTEND}" class="btn">Volver a la tienda</a>
    </div>
</body>
</html>
            `);
        }

        const subscriber = await NewsletterSubscriber.findOne({
            where: { verification_token: token }
        });

        if (!subscriber) {
            return res.status(404).send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Token inválido - LujanDev Store</title>
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
        }
        .error-icon { font-size: 80px; color: #ff7675; margin-bottom: 20px; }
        h1 { color: #2d3436; margin-bottom: 15px; font-size: 28px; }
        p { color: #636e72; font-size: 16px; line-height: 1.6; margin-bottom: 30px; }
        .btn {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 25px;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="error-icon">❌</div>
        <h1>Token inválido</h1>
        <p>El enlace de verificación no es válido o ya ha expirado.</p>
        <a href="${process.env.URL_FRONTEND}" class="btn">Volver a la tienda</a>
    </div>
</body>
</html>
            `);
        }

        await subscriber.update({ 
            email_verified: true,
            verification_token: null
        });

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
        }
        .success-icon { font-size: 80px; color: #48bb78; margin-bottom: 20px; }
        h1 { color: #2d3436; margin-bottom: 15px; font-size: 28px; }
        p { color: #636e72; font-size: 16px; line-height: 1.6; margin-bottom: 30px; }
        .btn {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 25px;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">✅</div>
        <h1>¡Email Verificado!</h1>
        <p>Tu email <strong>${subscriber.email}</strong> ha sido verificado correctamente.</p>
        <p>Ahora recibirás todas las novedades de LujanDev Store.</p>
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

/**
 * Desuscribirse
 */
export const unsubscribe = async (req, res) => {
    try {
        // Aceptar email desde query (GET desde links email) o body (POST desde frontend)
        const email = req.query.email || req.body.email;
        const token = req.query.token || req.body.token;

        if (!email) {
            return res.status(400).json({
                status: 400,
                message: 'Email es requerido'
            });
        }

        const subscriber = await NewsletterSubscriber.findOne({
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
 * Obtener estadísticas (ADMIN)
 */
export const getStats = async (req, res) => {
    try {
        const [
            total,
            verified,
            unsubscribed,
            bounced,
            bySource,
            byDate,
            recentCampaigns
        ] = await Promise.all([
            NewsletterSubscriber.count({ where: { status: 'subscribed' } }),
            NewsletterSubscriber.count({ where: { email_verified: true, status: 'subscribed' } }),
            NewsletterSubscriber.count({ where: { status: 'unsubscribed' } }),
            NewsletterSubscriber.count({ where: { status: 'bounced' } }),
            
            // Por fuente
            NewsletterSubscriber.findAll({
                attributes: [
                    'source',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                where: { status: 'subscribed' },
                group: ['source'],
                raw: true
            }),
            
            // Por fecha (últimos 30 días)
            NewsletterSubscriber.findAll({
                attributes: [
                    [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                where: {
                    createdAt: {
                        [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    },
                    status: 'subscribed'
                },
                group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
                order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'DESC']],
                raw: true
            }),
            
            // Últimas 5 campañas
            NewsletterCampaign.findAll({
                limit: 5,
                order: [['createdAt', 'DESC']],
                attributes: ['id', 'name', 'subject', 'status', 'sent_count', 'delivered_count', 'failed_count', 'createdAt']
            })
        ]);

        const bySourceFormatted = {};
        bySource.forEach(item => {
            bySourceFormatted[item.source || 'unknown'] = parseInt(item.count);
        });

        const byDateFormatted = {};
        byDate.forEach(item => {
            byDateFormatted[item.date] = parseInt(item.count);
        });

        const conversionRate = total > 0 ? ((verified / total) * 100).toFixed(1) : 0;

        res.status(200).json({
            status: 200,
            data: {
                total,
                verified,
                unsubscribed,
                bounced,
                by_source: bySourceFormatted,
                by_date: byDateFormatted,
                conversion_rate: parseFloat(conversionRate),
                recent_campaigns: recentCampaigns
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
 * Listar suscriptores (ADMIN)
 */
export const listSubscribers = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 50, 
            status = 'subscribed', 
            source,
            verified,
            search,
            userId 
        } = req.query;
        
        const offset = (page - 1) * limit;
        let whereCondition = {};

        if (status && status !== 'all') {
            whereCondition.status = status;
        }

        if (source) {
            whereCondition.source = source;
        }

        if (verified !== undefined) {
            whereCondition.email_verified = verified === 'true';
        }

        // Buscar por userId primero, con fallback a email
        if (userId) {
            whereCondition[Op.or] = [
                { userId: userId },
                { email: { [Op.like]: `%${search || ''}%` } }
            ];
        } else if (search && search.trim() !== '') {
            whereCondition.email = {
                [Op.like]: `%${search.trim()}%`
            };
        }

        const subscribers = await NewsletterSubscriber.findAndCountAll({
            where: whereCondition,
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
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
 * Obtener suscripción del usuario autenticado
 * Endpoint protegido para usuarios normales (no requiere admin)
 */
export const getUserSubscription = async (req, res) => {
    try {
        // El userId viene del token JWT verificado por auth.verifyEcommerce
        const userId = req.user.id; // El token tiene { id, rol, email }

        if (!userId) {
            return res.status(400).json({
                status: 400,
                message: 'Usuario no identificado'
            });
        }

        // Buscar suscripción por userId
        const subscriber = await NewsletterSubscriber.findOne({
            where: { 
                userId: userId,
                status: 'subscribed'
            },
            attributes: [
                'id', 
                'email', 
                'userId', 
                'status', 
                'source', 
                'email_verified',
                'createdAt',
                'updatedAt'
            ]
        });

        if (!subscriber) {
            return res.status(200).json({
                status: 200,
                subscribed: false,
                message: 'No estás suscrito al newsletter',
                data: null
            });
        }

        res.status(200).json({
            status: 200,
            subscribed: true,
            message: 'Suscripción encontrada',
            data: {
                subscriber: subscriber
            }
        });

    } catch (error) {
        console.error('Error al obtener suscripción del usuario:', error);
        res.status(500).json({
            status: 500,
            message: 'Error al obtener tu suscripción'
        });
    }
};

/**
 * Enviar campaña (ADMIN)
 */
export const sendCampaign = async (req, res) => {
    try {
        const { 
            name,
            subject, 
            htmlBody, 
            filters = {},
            testEmails = [],
            scheduleAt 
        } = req.body;

        // Validaciones
        if (!name || !subject || !htmlBody) {
            return res.status(400).json({
                status: 400,
                message: 'Nombre, asunto y contenido son requeridos'
            });
        }

        // Si son test emails, enviar solo a esas direcciones
        if (testEmails.length > 0) {
            try {
                for (const testEmail of testEmails) {
                    await sendNewsletterCampaign({
                        email: testEmail,
                        subject,
                        htmlBody
                    });
                }

                return res.status(200).json({
                    status: 200,
                    message: `Emails de prueba enviados a ${testEmails.length} destinatarios`,
                    data: { test: true, count: testEmails.length }
                });
            } catch (error) {
                console.error('Error sending test emails:', error);
                return res.status(500).json({
                    status: 500,
                    message: 'Error al enviar emails de prueba'
                });
            }
        }

        // Construir query para obtener destinatarios
        let whereCondition = { status: 'subscribed' };
        
        if (filters.source) whereCondition.source = filters.source;
        if (filters.verified) whereCondition.email_verified = true;
        if (filters.dateFrom) {
            whereCondition.createdAt = {
                [Op.gte]: new Date(filters.dateFrom)
            };
        }

        // Obtener destinatarios
        const recipients = await NewsletterSubscriber.findAll({
            where: whereCondition,
            attributes: ['email', 'id']
        });

        // Crear registro de campaña
        const campaign = await NewsletterCampaign.create({
            name,
            subject,
            html_body: htmlBody,
            filters,
            status: scheduleAt ? 'scheduled' : 'sending',
            scheduled_at: scheduleAt || null,
            total_recipients: recipients.length,
            created_by: req.user?.id || null
        });

        // Si está programada, no enviar ahora
        if (scheduleAt) {
            return res.status(200).json({
                status: 200,
                message: 'Campaña programada exitosamente',
                data: campaign
            });
        }

        // Enviar emails en background (batch processing)
        let sentCount = 0;
        let failedCount = 0;

        // Process in batches of 50
        const batchSize = 50;
        for (let i = 0; i < recipients.length; i += batchSize) {
            const batch = recipients.slice(i, i + batchSize);
            
            await Promise.all(batch.map(async (recipient) => {
                try {
                    await sendNewsletterCampaign({
                        email: recipient.email,
                        subject,
                        htmlBody
                    });
                    sentCount++;
                } catch (error) {
                    console.error(`Error sending to ${recipient.email}:`, error);
                    failedCount++;
                }
            }));

            // Update campaign progress
            await campaign.update({
                sent_count: sentCount,
                failed_count: failedCount
            });

            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Marcar campaña como completada
        await campaign.update({
            status: 'completed',
            sent_at: new Date(),
            delivered_count: sentCount,
            sent_count: sentCount,
            failed_count: failedCount
        });

        res.status(200).json({
            status: 200,
            message: 'Campaña enviada exitosamente',
            data: {
                campaign_id: campaign.id,
                sent: sentCount,
                failed: failedCount,
                total: recipients.length
            }
        });

    } catch (error) {
        console.error('Error al enviar campaña:', error);
        res.status(500).json({
            status: 500,
            message: 'Error al enviar la campaña'
        });
    }
};

/**
 * Obtener campañas (ADMIN)
 */
export const getCampaigns = async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const offset = (page - 1) * limit;
        
        let whereCondition = {};
        if (status) whereCondition.status = status;

        const campaigns = await NewsletterCampaign.findAndCountAll({
            where: whereCondition,
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.status(200).json({
            status: 200,
            data: {
                campaigns: campaigns.rows,
                pagination: {
                    total: campaigns.count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(campaigns.count / limit)
                }
            }
        });

    } catch (error) {
        console.error('Error al obtener campañas:', error);
        res.status(500).json({
            status: 500,
            message: 'Error al obtener campañas'
        });
    }
};

/**
 * Preview de campaña (ADMIN)
 */
export const previewCampaign = async (req, res) => {
    try {
        const { htmlBody } = req.body;

        if (!htmlBody) {
            return res.status(400).json({
                status: 400,
                message: 'El contenido HTML es requerido'
            });
        }

        res.status(200).json({
            status: 200,
            html: htmlBody
        });

    } catch (error) {
        console.error('Error al generar preview:', error);
        res.status(500).json({
            status: 500,
            message: 'Error al generar preview'
        });
    }
};

/**
 * Crear campaña sin enviar (ADMIN)
 */
export const createCampaign = async (req, res) => {
    try {
        const {
            name,
            subject,
            htmlBody,
            filters = {}
        } = req.body;

        // Validaciones
        if (!name || !subject || !htmlBody) {
            return res.status(400).json({
                status: 400,
                message: 'Nombre, asunto y contenido HTML son requeridos'
            });
        }

        // Crear campaña en modo draft
        const campaign = await NewsletterCampaign.create({
            name,
            subject,
            html_body: htmlBody,
            filters,
            status: 'draft',
            created_by: req.user?.id || null
        });

        res.status(201).json({
            status: 201,
            message: 'Campaña creada exitosamente',
            data: campaign
        });

    } catch (error) {
        console.error('Error al crear campaña:', error);
        res.status(500).json({
            status: 500,
            message: 'Error al crear la campaña'
        });
    }
};

/**
 * Enviar emails de prueba (ADMIN)
 */
export const sendTestCampaign = async (req, res) => {
    try {
        const {
            subject,
            htmlBody,
            testEmails = []
        } = req.body;

        // Validaciones
        if (!subject || !htmlBody) {
            return res.status(400).json({
                status: 400,
                message: 'Asunto y contenido HTML son requeridos'
            });
        }

        if (!testEmails || testEmails.length === 0) {
            return res.status(400).json({
                status: 400,
                message: 'Debes proporcionar al menos un email de prueba'
            });
        }

        // Validar formato de emails
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        for (const email of testEmails) {
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    status: 400,
                    message: `Email inválido: ${email}`
                });
            }
        }

        // Enviar emails de prueba
        let sentCount = 0;
        let failedEmails = [];

        for (const testEmail of testEmails) {
            try {
                await sendNewsletterCampaign({
                    email: testEmail,
                    subject: `[TEST] ${subject}`,
                    htmlBody
                });
                sentCount++;
            } catch (error) {
                console.error(`Error sending test to ${testEmail}:`, error);
                failedEmails.push(testEmail);
            }
        }

        res.status(200).json({
            status: 200,
            message: `Emails de prueba enviados: ${sentCount}/${testEmails.length}`,
            data: {
                sent: sentCount,
                total: testEmails.length,
                failed: failedEmails
            }
        });

    } catch (error) {
        console.error('Error al enviar emails de prueba:', error);
        res.status(500).json({
            status: 500,
            message: 'Error al enviar emails de prueba'
        });
    }
};

/**
 * Exportar suscriptores a CSV (ADMIN)
 */
export const exportSubscribers = async (req, res) => {
    try {
        const subscribers = await NewsletterSubscriber.findAll({
            where: { status: 'subscribed' },
            order: [['createdAt', 'DESC']]
        });

        const csvHeaders = 'Email,Source,Status,Verified,Created At,UTM Source,UTM Medium,UTM Campaign\n';
        const csvRows = subscribers.map(sub => 
            `${sub.email},${sub.source},${sub.status},${sub.email_verified},${sub.createdAt},${sub.utm_source || ''},${sub.utm_medium || ''},${sub.utm_campaign || ''}`
        ).join('\n');

        const csv = csvHeaders + csvRows;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=newsletter_subscribers.csv');
        res.status(200).send(csv);

    } catch (error) {
        console.error('Error exporting subscribers:', error);
        res.status(500).json({
            status: 500,
            message: 'Error al exportar datos'
        });
    }
};
