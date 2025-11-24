import fs from 'fs';
import nodemailer from 'nodemailer';
import ejs from 'ejs';
import Handlebars from 'handlebars';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Configurar transporter SMTP
 */
const getTransporter = () => {
    // Validar credenciales SMTP
    if (!process.env.SMTP_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('❌ SMTP Configuration Error: Missing required environment variables');
        console.error('   Required: SMTP_HOST, SMTP_PORT, EMAIL_USER, EMAIL_PASS');
        console.error('   Current:', {
            SMTP_HOST: process.env.SMTP_HOST ? '✓' : '✗',
            SMTP_PORT: process.env.SMTP_PORT ? '✓' : '✗',
            EMAIL_USER: process.env.EMAIL_USER ? '✓' : '✗',
            EMAIL_PASS: process.env.EMAIL_PASS ? '✗ (hidden)' : '✗'
        });
        throw new Error('SMTP credentials not configured. Please set SMTP_HOST, SMTP_PORT, EMAIL_USER, and EMAIL_PASS in .env file');
    }

    console.log('📧 Configuring SMTP:', {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.EMAIL_USER,
        secure: true
    });

    return nodemailer.createTransport({
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
        logger: false,
        debug: false
    });
};

/**
 * Leer archivo HTML
 */
const readHTMLFile = (filePath) => {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, { encoding: 'utf-8' }, (err, html) => {
            if (err) {
                reject(err);
            } else {
                resolve(html);
            }
        });
    });
};

/**
 * Enviar email de bienvenida al suscribirse
 */
export async function sendNewsletterWelcomeEmail(subscriber) {
    try {
        const transporter = getTransporter();

        // Verificar conexión
        await transporter.verify();
        console.log('✅ SMTP ready for newsletter welcome email');

        // Leer template
        const templatePath = path.join(process.cwd(), 'src/mails/email_newsletter_welcome.html');
        const html = await readHTMLFile(templatePath);

        // Datos para el template
        const templateData = {
            email: subscriber.email,
            verification_token: subscriber.verification_token,
            verification_url: `${process.env.URL_BACKEND}/api/newsletter/confirm?token=${subscriber.verification_token}`,
            unsubscribe_url: `${process.env.URL_BACKEND}/api/newsletter/unsubscribe?email=${encodeURIComponent(subscriber.email)}&token=${subscriber.verification_token}`,
            brand_name: 'LujanDev Store',
            support_email: process.env.EMAIL_USER,
            store_url: process.env.URL_FRONTEND,
            current_date: new Date().toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })
        };

        // Renderizar con EJS
        const renderedHtml = ejs.render(html, templateData);
        const template = Handlebars.compile(renderedHtml);
        const htmlToSend = template({ op: true });

        // Configurar email
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'LujanDev Store'} - Newsletter" <${process.env.EMAIL_USER}>`,
            to: subscriber.email,
            subject: process.env.EMAIL_WELCOME_SUBJECT || '¡Bienvenido a LujanDev Store Newsletter! 🚀',
            html: htmlToSend
        };

        // Enviar
        await transporter.sendMail(mailOptions);
        console.log(`✅ Newsletter welcome email sent to: ${subscriber.email}`);
        
        return true;

    } catch (error) {
        console.error('❌ Error sending newsletter welcome email:', error);
        throw error;
    }
}

/**
 * Enviar campaña de newsletter
 */
export async function sendNewsletterCampaign({ email, subject, htmlBody }) {
    try {
        const transporter = getTransporter();

        // Configurar email
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'LujanDev Store'}" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: subject,
            html: htmlBody
        };

        // Enviar
        await transporter.sendMail(mailOptions);
        console.log(`✅ Campaign email sent to: ${email}`);
        
        return true;

    } catch (error) {
        console.error(`❌ Error sending campaign email to ${email}:`, error);
        throw error;
    }
}

/**
 * Enviar campaña masiva (batch processing)
 */
export async function sendNewsletterCampaignBatch(recipients, subject, htmlBody, onProgress) {
    const results = {
        sent: 0,
        failed: 0,
        total: recipients.length
    };

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
                results.sent++;
            } catch (error) {
                results.failed++;
                console.error(`Failed to send to ${recipient.email}:`, error);
            }
        }));

        // Callback de progreso
        if (onProgress) {
            onProgress(results);
        }

        // Delay entre batches
        if (i + batchSize < recipients.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    return results;
}
