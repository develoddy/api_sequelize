import fs from 'fs';
import nodemailer from 'nodemailer';
import ejs from 'ejs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 📧 EMAIL NOTIFICATION SERVICE
 * Servicio centralizado para envío de emails relacionados con órdenes Printful
 * Sprint 6B - Email Automation & Notifications
 */

/**
 * Configurar transporter SMTP
 */
const getTransporter = () => {
    if (!process.env.SMTP_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('❌ SMTP Configuration Error: Missing required environment variables');
        throw new Error('SMTP credentials not configured');
    }

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
        }
    });
};

/**
 * Renderizar template EJS
 */
const renderTemplate = async (templateName, data) => {
    try {
        const templatePath = path.join(process.cwd(), 'src/mails', templateName);
        const html = await ejs.renderFile(templatePath, data);
        return html;
    } catch (error) {
        console.error(`❌ Error rendering template ${templateName}:`, error);
        throw error;
    }
};

/**
 * Enviar email genérico
 */
const sendEmail = async (to, subject, html, from = null) => {
    try {
        const transporter = getTransporter();
        
        const mailOptions = {
            from: from || process.env.EMAIL_USER || 'noreply@tudominio.com',
            to,
            subject,
            html
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully:', {
            to,
            subject,
            messageId: info.messageId
        });
        
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Error sending email:', error);
        return { success: false, error: error.message };
    }
};

/**
 * 📦 CUSTOMER EMAIL: Order Shipped
 * Enviado cuando Printful envía el paquete (webhook: package_shipped)
 */
export async function sendOrderShippedEmail(orderData) {
    try {
        console.log('📦 Sending "Order Shipped" email...', {
            customer: orderData.customer.name,
            email: orderData.customer.email,
            printfulOrderId: orderData.order.printfulOrderId
        });

        // Preparar datos para el template
        const templateData = {
            customer: {
                name: orderData.customer.name,
                email: orderData.customer.email
            },
            order: {
                printfulOrderId: orderData.order.printfulOrderId,
                n_transaction: orderData.order.n_transaction,
                created: orderData.order.created,
                total: orderData.order.total,
                currency: orderData.order.currency || 'EUR'
            },
            shipment: {
                trackingNumber: orderData.shipment.trackingNumber,
                trackingUrl: orderData.shipment.trackingUrl,
                carrier: orderData.shipment.carrier || 'Carrier',
                service: orderData.shipment.service || 'Standard',
                estimatedDelivery: orderData.shipment.estimatedDelivery,
                shippedDate: orderData.shipment.shippedDate || new Date()
            },
            products: orderData.products || [],
            address: orderData.address || {},
            process: {
                env: {
                    URL_FRONTEND: process.env.URL_FRONTEND
                }
            }
        };

        // Renderizar template
        const html = await renderTemplate('email_order_shipped.html', templateData);

        // Enviar email
        const subject = `📦 ¡Tu pedido #PF${orderData.order.printfulOrderId} está en camino!`;
        const result = await sendEmail(orderData.customer.email, subject, html);

        if (result.success) {
            console.log('✅ Order Shipped email sent successfully');
        } else {
            console.error('❌ Failed to send Order Shipped email:', result.error);
        }

        return result;
    } catch (error) {
        console.error('❌ Error in sendOrderShippedEmail:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 🎨 CUSTOMER EMAIL: Order Printing
 * Enviado cuando Printful recibe la orden (webhook: order_created)
 */
export async function sendOrderPrintingEmail(orderData) {
    try {
        console.log('🎨 Sending "Order Printing" email...', {
            customer: orderData.customer.name,
            printfulOrderId: orderData.order.printfulOrderId
        });

        const templateData = {
            customer: orderData.customer,
            order: orderData.order,
            products: orderData.products,
            address: orderData.address,
            process: {
                env: {
                    URL_FRONTEND: process.env.URL_FRONTEND
                }
            }
        };

        const html = await renderTemplate('email_order_printing.html', templateData);
        const subject = `🎨 ¡Tu pedido #PF${orderData.order.printfulOrderId} está siendo impreso!`;
        
        return await sendEmail(orderData.customer.email, subject, html);
    } catch (error) {
        console.error('❌ Error in sendOrderPrintingEmail:', error);
        return { success: false, error: error.message };
    }
}

/**
 * ✅ CUSTOMER EMAIL: Order Delivered
 * Enviado cuando el pedido es entregado (webhook: package_delivered o tracking API)
 */
export async function sendOrderDeliveredEmail(orderData) {
    try {
        console.log('✅ Sending "Order Delivered" email...', {
            customer: orderData.customer.name,
            printfulOrderId: orderData.order.printfulOrderId
        });

        const templateData = {
            customer: orderData.customer,
            order: orderData.order,
            delivery: orderData.delivery,
            products: orderData.products,
            process: {
                env: {
                    URL_FRONTEND: process.env.URL_FRONTEND
                }
            }
        };

        const html = await renderTemplate('email_order_delivered.html', templateData);
        const subject = `✅ ¡Tu pedido #PF${orderData.order.printfulOrderId} ha sido entregado!`;
        
        return await sendEmail(orderData.customer.email, subject, html);
    } catch (error) {
        console.error('❌ Error in sendOrderDeliveredEmail:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 🚨 ADMIN EMAIL: Sync Failed Alert
 * Enviado cuando una orden no se puede sincronizar con Printful
 */
export async function sendAdminSyncFailedAlert(saleData, errorData, receipt = null) {
    try {
        console.log('🚨 Sending "Sync Failed" alert to admin...', {
            saleId: saleData.id,
            errorType: errorData.type
        });

        const templateData = {
            sale: saleData,
            error: errorData,
            receipt: receipt,
            actionUrl: `${process.env.URL_ADMIN || 'http://localhost:4200'}/orders/${saleData.id}`,
            timestamp: new Date()
        };

        const html = await renderTemplate('email_admin_sync_failed.html', templateData);
        const subject = `🚨 Alerta: Orden #${saleData.n_transaction} no pudo sincronizarse`;
        
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@tudominio.com';
        return await sendEmail(adminEmail, subject, html);
    } catch (error) {
        console.error('❌ Error in sendAdminSyncFailedAlert:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 📊 ADMIN EMAIL: Daily Sync Report
 * Enviado diariamente con resumen de sincronizaciones
 */
export async function sendAdminDailyReport(statsData) {
    try {
        console.log('📊 Sending daily sync report to admin...', {
            date: statsData.date,
            synced: statsData.synced.today,
            pending: statsData.pending.today,
            failed: statsData.failed.today
        });

        const templateData = {
            stats: statsData,
            dashboardUrl: `${process.env.URL_ADMIN || 'http://localhost:4200'}/printful/orders`
        };

        const html = await renderTemplate('email_admin_daily_report.html', templateData);
        const dateStr = new Date(statsData.date).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
        const subject = `📊 Reporte Diario - Órdenes Printful (${dateStr})`;
        
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@tudominio.com';
        const result = await sendEmail(adminEmail, subject, html);

        if (result.success) {
            console.log('✅ Daily report sent successfully');
        } else {
            console.error('❌ Failed to send daily report:', result.error);
        }

        return result;
    } catch (error) {
        console.error('❌ Error in sendAdminDailyReport:', error);
        return { success: false, error: error.message };
    }
}

export default {
    sendOrderShippedEmail,
    sendOrderPrintingEmail,
    sendOrderDeliveredEmail,
    sendAdminSyncFailedAlert,
    sendAdminDailyReport
};
