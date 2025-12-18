/**
 * 🧪 EMAIL TESTING CONTROLLER
 * Controlador para probar templates de email SIN afectar el módulo de Printful
 * Solo para testing de templates y localización
 */

import { Sale } from '../../models/Sale.js';
import { User } from '../../models/User.js';
import { Guest } from '../../models/Guest.js';
import { SaleAddress } from '../../models/SaleAddress.js';
import { SaleDetail } from '../../models/SaleDetail.js';
import { Product } from '../../models/Product.js';
import { Variedad } from '../../models/Variedad.js';
import { 
    sendOrderShippedEmail, 
    sendOrderPrintingEmail, 
    sendOrderDeliveredEmail 
} from '../../services/emailNotification.service.js';

/**
 * 🧪 TEST: Email de confirmación de impresión
 * Simula el email cuando Printful recibe la orden
 */
export const testOrderPrintingEmail = async (req, res) => {
    try {
        const { saleId, testEmail } = req.body;
        
        if (!saleId) {
            return res.status(400).json({ message: 'saleId es requerido para testing' });
        }

        // Obtener datos reales de la venta
        const sale = await Sale.findByPk(saleId, {
            include: [
                { model: User },
                { model: Guest },
                { model: SaleAddress }
            ]
        });

        if (!sale) {
            return res.status(404).json({ message: 'Venta no encontrada' });
        }

        // Obtener detalles de productos
        const saleDetails = await SaleDetail.findAll({
            where: { saleId: sale.id },
            include: [
                { model: Product },
                { model: Variedad }
            ]
        });

        // Simular datos de Printful para testing
        const mockOrderData = {
            customer: {
                name: sale.user?.name || sale.guest?.name || 'Cliente Test',
                email: testEmail || sale.user?.email || sale.guest?.email
            },
            order: {
                id: sale.id, // 🔑 ID de la venta para tracking
                saleId: sale.id, // 🔑 IMPORTANTE: Pasamos saleId para obtener country/locale
                trackingToken: sale.trackingToken || 'missing-token', // 🔒 Token de seguridad para tracking
                printfulOrderId: sale.printfulOrderId || 999999,
                n_transaction: sale.n_transaction,
                created: sale.createdAt,
                total: sale.total,
                currency: 'EUR'
            },
            products: saleDetails.map(detail => ({
                name: detail.product.title,
                quantity: detail.cantidad,
                price: detail.price_unitario
            })),
            address: sale.sale_addresses?.[0] ? {
                name: sale.sale_addresses[0].name,
                address: sale.sale_addresses[0].address,
                city: sale.sale_addresses[0].ciudad,
                country: sale.sale_addresses[0].pais
            } : {}
        };

        const result = await sendOrderPrintingEmail(mockOrderData);
        
        return res.status(200).json({
            success: true,
            message: '🎨 Email de impresión enviado (TEST)',
            saleId: saleId,
            country: sale.country,
            locale: sale.locale,
            emailSent: result.success,
            recipient: mockOrderData.customer.email
        });

    } catch (error) {
        console.error('❌ Error en testOrderPrintingEmail:', error);
        return res.status(500).json({ 
            message: 'Error enviando email de prueba',
            error: error.message 
        });
    }
};

/**
 * 🧪 TEST: Email de envío
 * Simula el email cuando Printful envía el paquete
 */
export const testOrderShippedEmail = async (req, res) => {
    try {
        const { saleId, testEmail } = req.body;
        
        if (!saleId) {
            return res.status(400).json({ message: 'saleId es requerido para testing' });
        }

        const sale = await Sale.findByPk(saleId, {
            include: [
                { model: User },
                { model: Guest },
                { model: SaleAddress }
            ]
        });

        if (!sale) {
            return res.status(404).json({ message: 'Venta no encontrada' });
        }

        const saleDetails = await SaleDetail.findAll({
            where: { saleId: sale.id },
            include: [{ model: Product }, { model: Variedad }]
        });

        // Simular datos de envío para testing
        const mockOrderData = {
            customer: {
                name: sale.user?.name || sale.guest?.name || 'Cliente Test',
                email: testEmail || sale.user?.email || sale.guest?.email
            },
            order: {
                id: sale.id, // 🔑 ID de la venta para tracking
                saleId: sale.id, // 🔑 IMPORTANTE: Para obtener country/locale
                trackingToken: sale.trackingToken || 'missing-token', // 🔒 Token de seguridad para tracking
                printfulOrderId: sale.printfulOrderId || 999999,
                n_transaction: sale.n_transaction,
                created: sale.createdAt,
                total: sale.total,
                currency: 'EUR'
            },
            shipment: {
                trackingNumber: 'TEST123456789',
                trackingUrl: 'https://tracking.example.com/TEST123456789',
                carrier: 'DHL Express',
                service: 'Express Worldwide',
                estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 días
                shippedDate: new Date()
            },
            products: saleDetails.map(detail => ({
                name: detail.product.title,
                quantity: detail.cantidad,
                price: detail.price_unitario
            })),
            address: sale.sale_addresses?.[0] || {}
        };

        const result = await sendOrderShippedEmail(mockOrderData);
        
        return res.status(200).json({
            success: true,
            message: '📦 Email de envío enviado (TEST)',
            saleId: saleId,
            country: sale.country,
            locale: sale.locale,
            emailSent: result.success,
            recipient: mockOrderData.customer.email,
            trackingNumber: mockOrderData.shipment.trackingNumber
        });

    } catch (error) {
        console.error('❌ Error en testOrderShippedEmail:', error);
        return res.status(500).json({ 
            message: 'Error enviando email de prueba',
            error: error.message 
        });
    }
};

/**
 * 🧪 TEST: Email de entrega
 * Simula el email cuando el paquete es entregado
 */
export const testOrderDeliveredEmail = async (req, res) => {
    try {
        const { saleId, testEmail } = req.body;
        
        if (!saleId) {
            return res.status(400).json({ message: 'saleId es requerido para testing' });
        }

        const sale = await Sale.findByPk(saleId, {
            include: [
                { model: User },
                { model: Guest },
                { model: SaleAddress }
            ]
        });

        if (!sale) {
            return res.status(404).json({ message: 'Venta no encontrada' });
        }

        const saleDetails = await SaleDetail.findAll({
            where: { saleId: sale.id },
            include: [{ model: Product }, { model: Variedad }]
        });

        // Simular datos de entrega para testing
        const mockOrderData = {
            customer: {
                name: sale.user?.name || sale.guest?.name || 'Cliente Test',
                email: testEmail || sale.user?.email || sale.guest?.email
            },
            order: {
                id: sale.id, // 🔑 ID de la venta para tracking
                saleId: sale.id, // 🔑 IMPORTANTE: Para obtener country/locale
                trackingToken: sale.trackingToken || 'missing-token', // 🔒 Token de seguridad para tracking
                printfulOrderId: sale.printfulOrderId || 999999,
                n_transaction: sale.n_transaction,
                created: sale.createdAt,
                total: sale.total,
                currency: 'EUR'
            },
            delivery: {
                deliveredDate: new Date(),
                deliveredTo: 'Cliente',
                signedBy: 'Cliente Test',
                deliveryNote: 'Paquete entregado correctamente'
            },
            products: saleDetails.map(detail => ({
                name: detail.product.title,
                quantity: detail.cantidad,
                price: detail.price_unitario
            })),
            address: sale.sale_addresses?.[0] || {}
        };

        const result = await sendOrderDeliveredEmail(mockOrderData);
        
        return res.status(200).json({
            success: true,
            message: '✅ Email de entrega enviado (TEST)',
            saleId: saleId,
            country: sale.country,
            locale: sale.locale,
            emailSent: result.success,
            recipient: mockOrderData.customer.email,
            deliveredDate: mockOrderData.delivery.deliveredDate
        });

    } catch (error) {
        console.error('❌ Error en testOrderDeliveredEmail:', error);
        return res.status(500).json({ 
            message: 'Error enviando email de prueba',
            error: error.message 
        });
    }
};

/**
 * 🧪 TEST: Listar ventas disponibles para testing
 * Helper para obtener ventas que se pueden usar para testing
 */
export const getTestableSales = async (req, res) => {
    try {
        const sales = await Sale.findAll({
            include: [
                { model: User, attributes: ['id', 'name', 'email'] },
                { model: Guest, attributes: ['id', 'name', 'email'] },
                { model: SaleAddress, attributes: ['name', 'email', 'ciudad', 'pais'] }
            ],
            order: [['createdAt', 'DESC']],
            limit: 20,
            attributes: ['id', 'n_transaction', 'total', 'country', 'locale', 'createdAt', 'printfulOrderId', 'trackingToken']
        });

        const testableData = sales.map(sale => ({
            saleId: sale.id,
            transaction: sale.n_transaction,
            total: sale.total,
            country: sale.country,
            locale: sale.locale,
            customer: sale.user?.name || sale.guest?.name || 'Sin nombre',
            email: sale.user?.email || sale.guest?.email || sale.sale_addresses?.[0]?.email,
            createdAt: sale.createdAt,
            printfulId: sale.printfulOrderId
        }));

        return res.status(200).json({
            success: true,
            message: 'Ventas disponibles para testing',
            sales: testableData
        });

    } catch (error) {
        console.error('❌ Error obteniendo ventas para testing:', error);
        return res.status(500).json({ 
            message: 'Error obteniendo datos de prueba',
            error: error.message 
        });
    }
};