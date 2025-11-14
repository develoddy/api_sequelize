import { io } from 'socket.io-client';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3500';
const socket = io(`${SERVER_URL}/notifications`, { transports: ['websocket'] });

socket.on('connect', () => {
  console.log('[NOTIFIER] conectado al namespace /notifications ✅', socket.id);
});

socket.on('disconnect', () => {
  console.log('[NOTIFIER] desconectado ❌');
});

socket.on('shipment-update', (data) => {
  console.log('📦 Notificación de envío recibida:', data);
});

socket.on('new-sale', (data) => {
  console.log('💰 Nueva venta registrada:', data);
});

socket.on('alert', (data) => {
  console.log('⚠️ Alerta general:', data);
});

socket.on('connect_error', (err) => {
  console.error('[NOTIFIER] Error de conexión:', err.message);
});
