import { Sale } from "../../models/Sale.js";
import { SaleDetail } from "../../models/SaleDetail.js";
import { SaleAddress } from "../../models/SaleAddress.js";
import { Product } from "../../models/Product.js";
import { Variedad } from "../../models/Variedad.js";
import { User } from "../../models/User.js";
import { Guest } from "../../models/Guest.js";
import { Receipt } from "../../models/Receipt.js";
import { sendOrderShippedEmail, sendOrderPrintingEmail, sendAdminSyncFailedAlert } from "../../services/emailNotification.service.js";

/**
 * 🧪 TEST: Simular envío de email "Order Shipped"
 * Endpoint: POST /api/printful/test/send-shipped-email
 * Body: { saleId: number }
 */
export const testSendShippedEmail = async (req, res) => {
    try {
        const { saleId } = req.body;

        if (!saleId) {
            return res.status(400).json({
                success: false,
                message: 'saleId es requerido'
            });
        }

        console.log(`🧪 [TEST] Simulando envío de email shipped para Sale #${saleId}`);

        // Buscar sale con includes
        const sale = await Sale.findByPk(saleId, {
            include: [
                {
                    model: User,
                    attributes: ['id', 'name', 'surname', 'email']
                },
                {
                    model: Guest,
                    attributes: ['id', 'name', 'email']
                }
            ]
        });

        if (!sale) {
            return res.status(404).json({
                success: false,
                message: `Sale con ID ${saleId} no encontrada`
            });
        }

        // Obtener detalles
        const saleDetails = await SaleDetail.findAll({
            where: { saleId: sale.id },
            include: [
                { 
                    model: Product,
                    attributes: ['id', 'title', 'portada']
                },
                { 
                    model: Variedad,
                    attributes: ['id', 'valor', 'color']
                }
            ]
        });

        const saleAddress = await SaleAddress.findOne({
            where: { saleId: sale.id }
        });

        // Determinar email y nombre del cliente
        let customerEmail, customerName;
        if (sale.user) {
            customerEmail = sale.user.email;
            customerName = `${sale.user.name} ${sale.user.surname || ''}`.trim();
        } else if (sale.guest) {
            customerEmail = sale.guest.email;
            customerName = sale.guest.name || 'Cliente';
        }

        if (!customerEmail) {
            return res.status(400).json({
                success: false,
                message: 'No se encontró email del cliente'
            });
        }

        // Preparar productos
        const products = saleDetails.map(detail => ({
            image: `${process.env.URL_BACKEND}/api/products/uploads/product/${detail.product.portada}`,
            title: detail.product.title,
            quantity: detail.cantidad,
            variant: detail.variedad ? detail.variedad.valor : null
        }));

        // Preparar datos para el email (con datos simulados de tracking)
        const emailData = {
            customer: {
                name: customerName,
                email: customerEmail
            },
            order: {
                printfulOrderId: sale.printfulOrderId || '134812999', // Simulado si no existe
                n_transaction: sale.n_transaction,
                created: sale.createdAt,
                total: sale.total,
                currency: sale.currency_payment || 'EUR'
            },
            shipment: {
                trackingNumber: sale.trackingNumber || 'TEST123456789ES', // Simulado
                trackingUrl: sale.trackingUrl || 'https://tracking.example.com/TEST123456789ES',
                carrier: sale.carrier || 'DHL Express',
                service: 'Standard International',
                estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // +5 días
                shippedDate: sale.shippedAt || new Date()
            },
            products: products,
            address: {
                name: saleAddress?.name || customerName,
                address: saleAddress?.address || '',
                ciudad: saleAddress?.ciudad || '',
                region: saleAddress?.region || '',
                telefono: saleAddress?.telefono || ''
            }
        };

        console.log('📧 [TEST] Enviando email a:', customerEmail);

        // Enviar email
        const result = await sendOrderShippedEmail(emailData);

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: 'Email enviado exitosamente',
                recipient: customerEmail,
                messageId: result.messageId,
                data: {
                    saleId: sale.id,
                    printfulOrderId: emailData.order.printfulOrderId,
                    trackingNumber: emailData.shipment.trackingNumber,
                    products: products.length
                }
            });
        } else {
            return res.status(500).json({
                success: false,
                message: 'Error enviando email',
                error: result.error
            });
        }

    } catch (error) {
        console.error('❌ [TEST] Error en testSendShippedEmail:', error);
        return res.status(500).json({
            success: false,
            message: 'Error en test de email',
            error: error.message
        });
    }
};

/**
 * 🧪 TEST: Simular webhook package_shipped completo
 * Endpoint: POST /api/printful/test/simulate-package-shipped
 * Body: { saleId: number, trackingNumber?: string, carrier?: string }
 */
export const testSimulatePackageShipped = async (req, res) => {
    try {
        const { 
            saleId, 
            trackingNumber = 'TEST123456789ES',
            carrier = 'DHL Express'
        } = req.body;

        if (!saleId) {
            return res.status(400).json({
                success: false,
                message: 'saleId es requerido'
            });
        }

        console.log(`🧪 [TEST] Simulando webhook package_shipped para Sale #${saleId}`);

        // Simular payload de Printful
        const simulatedWebhookPayload = {
            type: 'package_shipped',
            created: Math.floor(Date.now() / 1000),
            retries: 0,
            data: {
                order: {
                    id: Math.floor(Math.random() * 1000000000), // ID Printful simulado
                    external_id: saleId.toString(),
                    status: 'shipped'
                },
                shipment: {
                    id: Math.floor(Math.random() * 1000000),
                    carrier: carrier,
                    service: 'Standard International',
                    tracking_number: trackingNumber,
                    tracking_url: `https://www.dhl.com/es-es/home/rastreo.html?tracking-id=${trackingNumber}`,
                    shipped_at: new Date().toISOString(),
                    estimated_delivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
                }
            }
        };

        // Llamar al webhook handler (importar dinámicamente para evitar circular deps)
        const { handleWebhook } = await import('../proveedor/printful/webhookPrintful.controller.js');
        
        // Simular request
        const fakeReq = {
            body: simulatedWebhookPayload,
            headers: {}
        };

        const fakeRes = {
            status: (code) => ({
                json: (data) => {
                    console.log(`📊 [TEST] Webhook handler respondió con código ${code}`);
                    return data;
                }
            })
        };

        await handleWebhook(fakeReq, fakeRes);

        return res.status(200).json({
            success: true,
            message: 'Webhook package_shipped simulado exitosamente',
            webhookPayload: simulatedWebhookPayload,
            note: 'Revisa los logs del servidor para ver el resultado del webhook'
        });

    } catch (error) {
        console.error('❌ [TEST] Error en testSimulatePackageShipped:', error);
        return res.status(500).json({
            success: false,
            message: 'Error simulando webhook',
            error: error.message
        });
    }
};

/**
 * 🧪 TEST: Enviar email "Order Printing" directamente
 * Endpoint: POST /api/printful/test/send-printing-email
 * Body: { saleId: number }
 */
export const testSendPrintingEmail = async (req, res) => {
    try {
        const { saleId } = req.body;

        if (!saleId) {
            return res.status(400).json({
                success: false,
                message: 'saleId es requerido'
            });
        }

        console.log(`🧪 [TEST] Enviando email printing para Sale #${saleId}`);

        // Buscar sale con includes
        const sale = await Sale.findByPk(saleId, {
            include: [
                {
                    model: User,
                    attributes: ['id', 'name', 'surname', 'email']
                },
                {
                    model: Guest,
                    attributes: ['id', 'name', 'email']
                }
            ]
        });

        if (!sale) {
            return res.status(404).json({
                success: false,
                message: `Sale con ID ${saleId} no encontrada`
            });
        }

        // Obtener detalles
        const saleDetails = await SaleDetail.findAll({
            where: { saleId: sale.id },
            include: [
                { 
                    model: Product,
                    attributes: ['id', 'title', 'portada']
                },
                { 
                    model: Variedad,
                    attributes: ['id', 'valor', 'color']
                }
            ]
        });

        const saleAddress = await SaleAddress.findOne({
            where: { saleId: sale.id }
        });

        // Determinar email y nombre del cliente
        let customerEmail, customerName;
        if (sale.user) {
            customerEmail = sale.user.email;
            customerName = `${sale.user.name} ${sale.user.surname || ''}`.trim();
        } else if (sale.guest) {
            customerEmail = sale.guest.email;
            customerName = sale.guest.name || 'Cliente';
        }

        if (!customerEmail) {
            return res.status(400).json({
                success: false,
                message: 'No se encontró email del cliente'
            });
        }

        // Preparar productos
        const products = saleDetails.map(detail => ({
            image: `${process.env.URL_BACKEND}/api/products/uploads/product/${detail.product.portada}`,
            title: detail.product.title,
            quantity: detail.cantidad,
            variant: detail.variedad ? detail.variedad.valor : null,
            color: detail.variedad ? detail.variedad.color : null
        }));

        // Preparar datos para el email
        const emailData = {
            customer: {
                name: customerName,
                email: customerEmail
            },
            order: {
                printfulOrderId: sale.printfulOrderId || '999999999', // Simulado si no existe
                n_transaction: sale.n_transaction,
                created: sale.createdAt,
                total: sale.total,
                currency: sale.currency_payment || 'EUR'
            },
            products: products,
            address: {
                name: saleAddress?.name || customerName,
                address: saleAddress?.address || '',
                ciudad: saleAddress?.ciudad || '',
                region: saleAddress?.region || '',
                telefono: saleAddress?.telefono || ''
            }
        };

        console.log('📧 [TEST] Enviando email a:', customerEmail);

        // Enviar email
        const result = await sendOrderPrintingEmail(emailData);

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: 'Email "Order Printing" enviado exitosamente',
                recipient: customerEmail,
                messageId: result.messageId,
                data: {
                    saleId: sale.id,
                    printfulOrderId: emailData.order.printfulOrderId,
                    products: products.length
                }
            });
        } else {
            return res.status(500).json({
                success: false,
                message: 'Error enviando email',
                error: result.error
            });
        }

    } catch (error) {
        console.error('❌ [TEST] Error en testSendPrintingEmail:', error);
        return res.status(500).json({
            success: false,
            message: 'Error en test de email',
            error: error.message
        });
    }
};

/**
 * 🧪 TEST: Simular webhook order_created completo
 * Endpoint: POST /api/printful/test/simulate-order-created
 * Body: { saleId: number }
 */
export const testSimulateOrderCreated = async (req, res) => {
    try {
        const { saleId } = req.body;

        if (!saleId) {
            return res.status(400).json({
                success: false,
                message: 'saleId es requerido'
            });
        }

        console.log(`🧪 [TEST] Simulando webhook order_created para Sale #${saleId}`);

        // Simular payload de Printful
        const simulatedWebhookPayload = {
            type: 'order_created',
            created: Math.floor(Date.now() / 1000),
            retries: 0,
            data: {
                order: {
                    id: Math.floor(Math.random() * 1000000000), // ID Printful simulado
                    external_id: saleId.toString(),
                    status: 'pending'
                }
            }
        };

        // Llamar al webhook handler (importar dinámicamente para evitar circular deps)
        const { handleWebhook } = await import('../proveedor/printful/webhookPrintful.controller.js');
        
        // Simular request
        const fakeReq = {
            body: simulatedWebhookPayload,
            headers: {}
        };

        const fakeRes = {
            status: (code) => ({
                json: (data) => {
                    console.log(`📊 [TEST] Webhook handler respondió con código ${code}`);
                    return data;
                }
            })
        };

        await handleWebhook(fakeReq, fakeRes);

        return res.status(200).json({
            success: true,
            message: 'Webhook order_created simulado exitosamente',
            webhookPayload: simulatedWebhookPayload,
            note: 'Revisa los logs del servidor y tu email para ver el resultado'
        });

    } catch (error) {
        console.error('❌ [TEST] Error en testSimulateOrderCreated:', error);
        return res.status(500).json({
            success: false,
            message: 'Error simulando webhook',
            error: error.message
        });
    }
};

/**
 * 🧪 TEST: Simular envío de email "Sync Failed Alert" al admin
 * Endpoint: POST /api/printful/test/send-sync-failed-alert
 * Body: { saleId: number, errorType: string }
 */
export const testSendSyncFailedAlert = async (req, res) => {
    try {
        const { saleId, errorType = 'PRINTFUL_API_ERROR' } = req.body;

        if (!saleId) {
            return res.status(400).json({
                success: false,
                message: 'saleId es requerido'
            });
        }

        console.log(`🧪 [TEST] Simulando email de alerta para Sale #${saleId} con error tipo: ${errorType}`);

        // Buscar sale con includes
        const sale = await Sale.findByPk(saleId, {
            include: [
                {
                    model: User,
                    attributes: ['id', 'name', 'surname', 'email']
                },
                {
                    model: Guest,
                    attributes: ['id', 'name', 'email']
                }
            ]
        });

        if (!sale) {
            return res.status(404).json({
                success: false,
                message: `Sale con ID ${saleId} no encontrada`
            });
        }

        // Obtener Receipt
        const receipt = await Receipt.findOne({
            where: { saleId }
        });

        // Determinar email y nombre del cliente
        let customerName, customerEmail, customerType;
        if (sale.user) {
            customerEmail = sale.user.email;
            customerName = `${sale.user.name} ${sale.user.surname || ''}`.trim();
            customerType = 'Usuario Registrado';
        } else if (sale.guest) {
            customerEmail = sale.guest.email;
            customerName = sale.guest.name || 'Cliente';
            customerType = 'Invitado';
        }

        // Preparar datos según tipo de error
        const errorMessages = {
            'ADDRESS_INVALID': 'La dirección de envío no es válida o está incompleta',
            'PAYMENT_ISSUE': 'El pago no pudo ser verificado correctamente',
            'PRODUCT_UNAVAILABLE': 'Uno o más productos no están disponibles en Printful',
            'INVALID_PRODUCTS': 'Los productos no tienen variant_id válido',
            'NO_RECEIPT': 'No existe un recibo de pago para esta venta',
            'PAYMENT_NOT_CONFIRMED': 'El pago no está confirmado',
            'PRINTFUL_API_ERROR': 'Error al comunicarse con la API de Printful',
            'NETWORK_ERROR': 'Error de conexión con Printful',
            'PRINTFUL_API_DOWN': 'El servicio de Printful no está disponible',
            'UNKNOWN': 'Error desconocido durante la sincronización'
        };

        const saleData = {
            id: sale.id,
            n_transaction: sale.n_transaction,
            printfulOrderId: sale.printfulOrderId,
            total: sale.total,
            method_payment: sale.method_payment,
            created: sale.createdAt,
            customer: {
                name: customerName,
                email: customerEmail,
                type: customerType
            }
        };

        const errorData = {
            type: errorType,
            message: errorMessages[errorType] || 'Error en la sincronización con Printful',
            retryCount: 1,
            context: {
                test_mode: true,
                simulated_error: true,
                timestamp: new Date().toISOString()
            }
        };

        // Enviar email
        const result = await sendAdminSyncFailedAlert(saleData, errorData, receipt);

        if (result.success) {
            console.log('✅ [TEST] Email de alerta enviado exitosamente');
            return res.status(200).json({
                success: true,
                message: 'Email de alerta enviado exitosamente',
                recipient: process.env.ADMIN_EMAIL || 'admin@tudominio.com',
                messageId: result.messageId,
                data: {
                    saleId: sale.id,
                    errorType: errorType,
                    customerEmail: customerEmail
                }
            });
        } else {
            console.error('❌ [TEST] Error enviando email:', result.error);
            return res.status(500).json({
                success: false,
                message: 'Error enviando email',
                error: result.error
            });
        }

    } catch (error) {
        console.error('❌ [TEST] Error en testSendSyncFailedAlert:', error);
        return res.status(500).json({
            success: false,
            message: 'Error en test de email de alerta',
            error: error.message
        });
    }
};

/**
 * 🧪 TEST: Simular webhook order_failed completo
 * Endpoint: POST /api/printful/test/simulate-order-failed
 * Body: { saleId: number, errorReason: string }
 */
export const testSimulateOrderFailed = async (req, res) => {
    try {
        const { saleId, errorReason = 'Address validation failed' } = req.body;

        if (!saleId) {
            return res.status(400).json({
                success: false,
                message: 'saleId es requerido'
            });
        }

        console.log(`🧪 [TEST] Simulando webhook order_failed para Sale #${saleId}`);

        // Buscar sale
        const sale = await Sale.findByPk(saleId);

        if (!sale) {
            return res.status(404).json({
                success: false,
                message: `Sale con ID ${saleId} no encontrada`
            });
        }

        // Simular payload de webhook order_failed de Printful
        const simulatedWebhookPayload = {
            type: 'order_failed',
            created: Math.floor(Date.now() / 1000),
            retries: 0,
            store: 43503537,
            data: {
                order: {
                    id: parseInt(sale.printfulOrderId) || 999999999,
                    external_id: saleId.toString(),
                    status: 'failed'
                },
                error: {
                    reason: errorReason,
                    message: errorReason
                }
            }
        };

        console.log('📤 [TEST] Enviando webhook simulado a handleWebhook...');

        // Importar dinámicamente para evitar dependencias circulares
        const { handleWebhook } = await import('../proveedor/printful/webhookPrintful.controller.js');

        const fakeReq = {
            body: simulatedWebhookPayload,
            headers: {}
        };

        const fakeRes = {
            status: (code) => ({
                json: (data) => {
                    console.log(`📊 [TEST] Webhook handler respondió con código ${code}`);
                    return data;
                }
            })
        };

        await handleWebhook(fakeReq, fakeRes);

        return res.status(200).json({
            success: true,
            message: 'Webhook order_failed simulado exitosamente',
            webhookPayload: simulatedWebhookPayload,
            note: 'Revisa los logs del servidor y el email del admin'
        });

    } catch (error) {
        console.error('❌ [TEST] Error en testSimulateOrderFailed:', error);
        return res.status(500).json({
            success: false,
            message: 'Error simulando webhook',
            error: error.message
        });
    }
};

/**
 * 🧪 TEST: Simular envío de email "Order Delivered"
 * Endpoint: POST /api/printful/test/send-delivered-email
 * Body: { saleId: number }
 */
export const testSendDeliveredEmail = async (req, res) => {
    try {
        const { saleId } = req.body;

        if (!saleId) {
            return res.status(400).json({
                success: false,
                message: 'saleId es requerido'
            });
        }

        console.log(`🧪 [TEST] Simulando email delivered para Sale #${saleId}`);

        // Buscar sale con includes
        const sale = await Sale.findByPk(saleId, {
            include: [
                {
                    model: User,
                    attributes: ['id', 'name', 'surname', 'email']
                },
                {
                    model: Guest,
                    attributes: ['id', 'name', 'email']
                }
            ]
        });

        if (!sale) {
            return res.status(404).json({
                success: false,
                message: `Sale con ID ${saleId} no encontrada`
            });
        }

        // Obtener detalles
        const saleDetails = await SaleDetail.findAll({
            where: { saleId: sale.id },
            include: [
                { 
                    model: Product,
                    attributes: ['id', 'title', 'portada']
                },
                { 
                    model: Variedad,
                    attributes: ['id', 'valor', 'color']
                }
            ]
        });

        const saleAddress = await SaleAddress.findOne({
            where: { saleId: sale.id }
        });

        // Determinar email y nombre del cliente
        let customerEmail, customerName;
        if (sale.user) {
            customerEmail = sale.user.email;
            customerName = `${sale.user.name} ${sale.user.surname || ''}`.trim();
        } else if (sale.guest) {
            customerEmail = sale.guest.email;
            customerName = sale.guest.name || 'Cliente';
        }

        if (!customerEmail) {
            return res.status(400).json({
                success: false,
                message: 'No se encontró email del cliente'
            });
        }

        // Preparar productos
        const products = saleDetails.map(detail => ({
            image: `${process.env.URL_BACKEND}/api/products/uploads/product/${detail.product.portada}`,
            title: detail.product.title,
            quantity: detail.cantidad,
            variant: detail.variedad ? detail.variedad.valor : null
        }));

        // Preparar datos para el email
        const emailData = {
            customer: {
                name: customerName,
                email: customerEmail
            },
            order: {
                printfulOrderId: sale.printfulOrderId || '134812999',
                n_transaction: sale.n_transaction,
                created: sale.createdAt,
                total: sale.total,
                currency: sale.currency_payment || 'EUR'
            },
            delivery: {
                deliveredDate: new Date(),
                address: `${saleAddress?.address || ''}, ${saleAddress?.ciudad || ''}, ${saleAddress?.region || ''}`
            },
            products: products
        };

        // Importar la función
        const { sendOrderDeliveredEmail } = await import('../../services/emailNotification.service.js');

        // Enviar email
        const result = await sendOrderDeliveredEmail(emailData);

        if (result.success) {
            console.log('✅ [TEST] Email delivered enviado exitosamente');
            return res.status(200).json({
                success: true,
                message: 'Email "Order Delivered" enviado exitosamente',
                recipient: customerEmail,
                messageId: result.messageId,
                data: {
                    saleId: sale.id,
                    printfulOrderId: sale.printfulOrderId,
                    products: products.length
                }
            });
        } else {
            console.error('❌ [TEST] Error enviando email:', result.error);
            return res.status(500).json({
                success: false,
                message: 'Error enviando email',
                error: result.error
            });
        }

    } catch (error) {
        console.error('❌ [TEST] Error en testSendDeliveredEmail:', error);
        return res.status(500).json({
            success: false,
            message: 'Error en test de email delivered',
            error: error.message
        });
    }
};

/**
 * 🧪 TEST: Simular envío de Daily Report
 * Endpoint: POST /api/printful/test/send-daily-report
 * Body: { date?: string (YYYY-MM-DD) }
 */
export const testSendDailyReport = async (req, res) => {
    try {
        const { date } = req.body;

        let targetDate = new Date();
        if (date) {
            targetDate = new Date(date);
            if (isNaN(targetDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Fecha inválida. Formato esperado: YYYY-MM-DD'
                });
            }
        }

        console.log(`🧪 [TEST] Generando y enviando daily report para: ${targetDate.toISOString().split('T')[0]}`);

        // Importar servicio
        const { sendDailyReportToAdmin } = await import('../../services/dailyReportService.js');

        // Enviar reporte
        const result = await sendDailyReportToAdmin(targetDate);

        if (result.success) {
            console.log('✅ [TEST] Daily report enviado exitosamente');
            return res.status(200).json({
                success: true,
                message: 'Daily report enviado exitosamente',
                recipient: process.env.ADMIN_EMAIL || 'admin@tudominio.com',
                messageId: result.messageId,
                date: targetDate
            });
        } else {
            console.error('❌ [TEST] Error enviando reporte:', result.error);
            return res.status(500).json({
                success: false,
                message: 'Error enviando reporte',
                error: result.error
            });
        }

    } catch (error) {
        console.error('❌ [TEST] Error en testSendDailyReport:', error);
        return res.status(500).json({
            success: false,
            message: 'Error en test de daily report',
            error: error.message
        });
    }
};
