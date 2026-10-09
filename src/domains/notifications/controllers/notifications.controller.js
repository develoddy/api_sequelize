import { getIO } from '../../../socket.js';
import { Notification } from '../../../models/Notification.js';
import { Sale } from '../../../models/Sale.js';
import { Shipment } from '../../../models/Shipment.js';

/**
 * Notificaciones: Obtener lista de notificaciones
 * @param {*} req 
 * @param {*} res 
 */
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user?.id || null; // opcional según auth
    const limit = parseInt(req.query.limit) || 50;

    const notifications = await Notification.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: limit,
      include: [
        { model: Sale, as: 'sale' },           // incluir información de la venta
        { model: Shipment, as: 'shipment' }    // incluir información del envío
      ]
    });

    res.json({ success: true, notifications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener notificaciones' });
  }
};

/**
 * Notificaciones: Marcar notificación como leída
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
export const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findByPk(id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notificación no encontrada' });

    notification.isRead = true;
    await notification.save();

    res.json({ success: true, notification });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al marcar como leída' });
  }
};

/**
 * Notificaciones: Enviar notificación de prueba
 * @param {*} req 
 * @param {*} res 
 */
export const sendTestNotification = async (req, res) => {
  try {

    const { type = 'test' } = req.body;

    const io = getIO();

    // Configuración de notificación según tipo
    let title = 'Pedido #1042 actualizado';
    let message = 'El pedido ha sido registrado';
    let saleId = 1;
    let shipmentId = null;

    switch(type) {
      case 'order_created':
        title = 'Nueva orden creada #1042';
        message = 'Se ha creado una nueva orden 🛒';
        break;
      case 'order_updated':
        title = 'Orden #1042 actualizada';
        message = 'La orden ha sido actualizada 📝';
        break;
      case 'package_shipped':
        title = 'Envío #23 enviado';
        message = 'Tu paquete ha sido enviado 🚚';
        shipmentId = 23;
        break;
      case 'package_returned':
        title = 'Envío #23 devuelto';
        message = 'El paquete ha sido devuelto 🔄';
        shipmentId = 23;
        break;
      case 'order_failed':
        title = 'Orden #1042 fallida';
        message = 'Hubo un problema procesando tu orden ⚠️';
        break;
      case 'order_canceled':
        title = 'Orden #1042 cancelada';
        message = 'La orden ha sido cancelada ❌';
        break;
      default:
        // test u otro tipo genérico
        title = 'Notificación de prueba';
        message = 'Esto es una notificación de prueba 🧪';
    }
    

    // 1️⃣ Crear la notificación en DB
    const notification = await Notification.create({
      title,
      message,
      color: 'success',
      type,
      userId: null,
      saleId,
      shipmentId,
      isRead: false,
      meta: { test: true }
    });
    
    // 2️⃣ Obtener la notificación completa con asociaciones
    const fullNotification = await Notification.findByPk(notification.id, {
      include: [
        { model: Sale, as: 'sale' },
        { model: Shipment, as: 'shipment' }
      ]
    });

    // 3️⃣ Emitir con todos los datos relevantes al frontend
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

    // 4️⃣ Responder al cliente REST
    res.json({ success: true, notification: fullNotification });
  } catch (error) {
    console.error('Error enviando notificación de prueba:', error);
    res.status(500).json({ success: false, error: 'Error al emitir notificación' });
  }
};

