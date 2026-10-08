// services/notificationService.js
import { getIO } from '../../../../../socket.js';
import { Notification } from '../../../../../models/Notification.js';
import { Sale } from '../../../../../models/Sale.js';
import { Shipment } from '../../../../../models/Shipment.js';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Servicio común para crear y emitir notificaciones
 * 
 * @param {Object} params - Datos de la notificación
 * @param {string} params.title - Título de la notificación
 * @param {string} params.message - Mensaje principal
 * @param {string} [params.color='info'] - Color (success, danger, warning, info)
 * @param {string} [params.type='general'] - Tipo de evento (package_shipped, order_failed, etc.)
 * @param {number|null} [params.userId=null] - ID del usuario (null = admins)
 * @param {number|null} [params.saleId=null] - ID de la venta relacionada
 * @param {number|null} [params.shipmentId=null] - ID del envío relacionado
 * @param {Object} [params.meta={}] - Datos adicionales (tracking, carrier, etc.)
 */
export const createAndEmitNotification = async (params) => {
    const io = getIO();

    let {
        title,
        message,
        color = 'info',
        type = 'general',
        userId = null,
        saleId = null,
        shipmentId = null,
        meta = {}
    } = params;

    try {

        // 🧩 Validar existencia de registros
        const saleExists = saleId ? await Sale.findByPk(saleId) : null;
        const shipmentExists = shipmentId ? await Shipment.findByPk(shipmentId) : null;

        // ⚠️ Manejo de errores según entorno
        if (saleId && !saleExists) {
            const msg = `Sale con ID ${saleId} no existe.`;
            if (isDev) console.warn(`⚠️ ${msg} (modo dev: continúa sin vínculo)`);
            else throw new Error(msg);
        }

        // ⚠️ Manejo de errores según entorno
        if (shipmentId && !shipmentExists) {
            const msg = `Shipment con ID ${shipmentId} no existe.`;
            if (isDev) console.warn(`⚠️ ${msg} (modo dev: continúa sin vínculo)`);
            else throw new Error(msg);
        }

        // 🔹 Crear la notificación en la base de datos
        const notification = await Notification.create({
            title,
            message,
            color,
            type,
            userId,
            saleId: saleExists ? saleId : null,
            shipmentId: shipmentExists ? shipmentId : null,
            isRead: false,
            meta
        });

        // 🔹 Obtener con asociaciones completas
        const fullNotification = await Notification.findByPk(notification.id, {
            include: [
            { model: Sale, as: 'sale' },
            { model: Shipment, as: 'shipment' }
            ]
        });

        // 🔹 Emitir por Socket.IO al namespace /notifications
        io.of('/notifications').emit('shipment-update', {
            id: fullNotification.id,
            title: fullNotification.title,
            message: fullNotification.message,
            color: fullNotification.color,
            type: fullNotification.type,
            saleId: fullNotification.saleId,
            shipmentId: fullNotification.shipmentId,
            sale: fullNotification.sale,
            shipment: fullNotification.shipment,
            meta: fullNotification.meta ? JSON.parse(fullNotification.meta) : {},
            date: fullNotification.createdAt
        });

        console.log(`📢 Notificación emitida [${type}] → ${title}`);
        return fullNotification;
    } catch (error) {
        console.error('❌ Error creando o emitiendo notificación:', error);
        throw error;
    }
};
