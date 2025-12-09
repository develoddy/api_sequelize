import fs from 'fs';
import nodemailer from 'nodemailer';
import ejs from 'ejs';
import Handlebars from 'handlebars';
import { PrelaunchSubscriber } from '../models/PrelaunchSubscriber.js';

/**
 * Envía email de bienvenida inmediato después del registro
 */
export async function sendWelcomeEmail(subscriberId) {
    try {
        const readHTMLFile = (path, callback) => {
            fs.readFile(path, { encoding: 'utf-8' }, (err, html) => {
                if (err) {
                    return callback(err);
                } else {
                    callback(null, html);
                }
            });
        };

        // Buscar suscriptor por ID
        const subscriber = await PrelaunchSubscriber.findByPk(subscriberId);
        if (!subscriber) {
            console.error('Subscriber not found for welcome email:', subscriberId);
            return false;
        }

        // Configurar transporter (igual que sale.controller.js)
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT),
            secure: true, // true para puerto 465
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                rejectUnauthorized: false
            },
            logger: true,
            debug: false
        });

        // Verificar conexión SMTP
        transporter.verify(function(error, success) {
            if (error) {
                console.log('SMTP connection error:', error);
            } else {
                console.log('SMTP server is ready for welcome email');
            }
        });

        readHTMLFile(`${process.cwd()}/src/mails/email_prelaunch_welcome.html`, (err, html) => {
            if (err) {
                console.error('Error reading welcome email template:', err);
                return;
            }

            // Datos para el template
            const templateData = {
                email: subscriber.email,
                verification_token: subscriber.verification_token,
                verification_url: `${process.env.URL_BACKEND}/api/prelaunch/verify?token=${subscriber.verification_token}`,
                unsubscribe_url: `${process.env.URL_FRONTEND}/unsubscribe?email=${encodeURIComponent(subscriber.email)}&token=${subscriber.verification_token}`,
                brand_name: 'LujanDev Store',
                support_email: process.env.EMAIL_USER,
                current_date: new Date().toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })
            };

            const rest_html = ejs.render(html, templateData);
            const template = Handlebars.compile(rest_html);
            const htmlToSend = template({ op: true });

            const mailOptions = {
                from: `"LujanDev Store - Pre-Launch" <${process.env.EMAIL_USER}>`,
                to: subscriber.email,
                subject: '¡Bienvenido al Pre-Launch de LujanDev Store! 🚀',
                html: htmlToSend
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Error sending welcome email:', error);
                } else {
                    console.log('Welcome email sent successfully:', info.response);
                }
            });
        });

        return true;

    } catch (error) {
        console.error('Error in sendWelcomeEmail:', error);
        return false;
    }
}

/**
 * Envía emails masivos de lanzamiento a todos los suscriptores
 */
export async function sendLaunchEmails(launchData = {}) {
    try {
        const readHTMLFile = (path, callback) => {
            fs.readFile(path, { encoding: 'utf-8' }, (err, html) => {
                if (err) {
                    return callback(err);
                } else {
                    callback(null, html);
                }
            });
        };

        // Obtener todos los suscriptores activos que no han sido notificados
        const subscribers = await PrelaunchSubscriber.findAll({
            where: {
                status: 'subscribed',
                notified_launch: false
            }
        });

        if (subscribers.length === 0) {
            console.log('⚠️ No subscribers to notify for launch');
            return { 
                success: false, 
                sent: 0, 
                errors: 0,
                total: 0,
                message: 'No hay suscriptores pendientes de notificar. Todos ya han recibido el email de lanzamiento.' 
            };
        }

        // Configurar transporter
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT),
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                rejectUnauthorized: false
            },
            logger: true,
            debug: false
        });

        let sentCount = 0;
        let errorCount = 0;

        console.log(`Starting to send launch emails to ${subscribers.length} subscribers...`);

        // Procesar en lotes para no sobrecargar el servidor SMTP
        const batchSize = 10;
        for (let i = 0; i < subscribers.length; i += batchSize) {
            const batch = subscribers.slice(i, i + batchSize);
            
            await Promise.all(batch.map(async (subscriber) => {
                try {
                    await new Promise((resolve) => {
                        readHTMLFile(`${process.cwd()}/src/mails/email_prelaunch_launch.html`, async (err, html) => {
                            if (err) {
                                console.error('Error reading launch email template:', err);
                                errorCount++;
                                return resolve();
                            }

                            // Usar el cupón seleccionado (mismo para todos los usuarios)
                            const couponCode = launchData.coupon_code || 'LAUNCH2025';

                            // Datos para el template
                            const templateData = {
                                email: subscriber.email,
                                coupon_code: couponCode,
                                coupon_discount: launchData.coupon_discount || '15%',
                                store_url: process.env.URL_FRONTEND,
                                unsubscribe_url: `${process.env.URL_FRONTEND}/unsubscribe?email=${encodeURIComponent(subscriber.email)}&token=${subscriber.verification_token}`,
                                brand_name: 'LujanDev Store',
                                launch_date: launchData.launch_date || new Date().toLocaleDateString('es-ES'),
                                featured_products: launchData.featured_products || [],
                                support_email: process.env.EMAIL_USER
                            };

                            const rest_html = ejs.render(html, templateData);
                            const template = Handlebars.compile(rest_html);
                            const htmlToSend = template({ op: true });

                            const mailOptions = {
                                from: `"LujanDev Store - ¡Ya estamos aquí!" <${process.env.EMAIL_USER}>`,
                                to: subscriber.email,
                                subject: `🎉 ¡LujanDev Store ya está LIVE! + Tu cupón exclusivo ${couponCode}`,
                                html: htmlToSend
                            };

                            transporter.sendMail(mailOptions, async (error, info) => {
                                if (error) {
                                    console.error(`Error sending launch email to ${subscriber.email}:`, error);
                                    errorCount++;
                                } else {
                                    console.log(`Launch email sent to ${subscriber.email}:`, info.response);
                                    sentCount++;

                                    // Marcar como notificado y guardar cupón
                                    try {
                                        await subscriber.update({
                                            notified_launch: true,
                                            coupon_sent: true,
                                            // Cupón enviado: ${couponCode} (mismo para todos los usuarios)
                                        });
                                    } catch (updateError) {
                                        console.error('Error updating subscriber after email:', updateError);
                                    }
                                }
                                resolve();
                            });
                        });
                    });

                    // Pequeña pausa entre emails para no saturar
                    await new Promise(resolve => setTimeout(resolve, 100));

                } catch (error) {
                    console.error(`Error processing subscriber ${subscriber.email}:`, error);
                    errorCount++;
                }
            }));

            // Pausa más larga entre lotes
            if (i + batchSize < subscribers.length) {
                console.log(`Batch ${Math.floor(i/batchSize) + 1} completed. Waiting before next batch...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        console.log(`Launch email campaign completed. Sent: ${sentCount}, Errors: ${errorCount}`);
        
        return {
            success: true,
            sent: sentCount,
            errors: errorCount,
            total: subscribers.length,
            message: `Launch emails sent to ${sentCount} subscribers`
        };

    } catch (error) {
        console.error('Error in sendLaunchEmails:', error);
        return {
            success: false,
            error: error.message,
            message: 'Error sending launch emails'
        };
    }
}

/**
 * Generar cupón único basado en email y ID
 * NOTA: Esta función ya no se usa en el nuevo sistema integrado de cupones.
 * Se mantiene por compatibilidad con versiones anteriores.
 */
function generateUniqueCountdown(email, subscriberId) {
    const prefix = 'LAUNCH';
    const emailHash = email.split('@')[0].substring(0, 3).toUpperCase();
    const idHash = subscriberId.toString().padStart(3, '0');
    return `${prefix}${emailHash}${idHash}`;
}

/**
 * Verificar email (opcional)
 */
export async function verifyEmail(token) {
    try {
        const subscriber = await PrelaunchSubscriber.findOne({
            where: { verification_token: token }
        });

        if (!subscriber) {
            return { success: false, message: 'Token de verificación inválido' };
        }

        await subscriber.update({ email_verified: true });
        
        return { 
            success: true, 
            message: 'Email verificado exitosamente',
            email: subscriber.email 
        };

    } catch (error) {
        console.error('Error verifying email:', error);
        return { 
            success: false, 
            message: 'Error verificando email' 
        };
    }
}

/**
 * Desuscribir usuario
 */
export async function unsubscribeEmail(email, token) {
    try {
        const subscriber = await PrelaunchSubscriber.findOne({
            where: { 
                email: email.toLowerCase(),
                verification_token: token 
            }
        });

        if (!subscriber) {
            return { success: false, message: 'Usuario no encontrado' };
        }

        await subscriber.update({ status: 'unsubscribed' });
        
        return { 
            success: true, 
            message: 'Te has desuscrito exitosamente',
            email: subscriber.email 
        };

    } catch (error) {
        console.error('Error unsubscribing email:', error);
        return { 
            success: false, 
            message: 'Error procesando la desuscripción' 
        };
    }
}