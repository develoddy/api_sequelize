// /controller/notifications/socket.controller.js
function setupNotificationsSocketIO(io) {
  // Namespace específico
  const notifications = io.of('/notifications');

  notifications.on('connection', (socket) => {
    console.log(`🔔 Cliente conectado a notifications: ${socket.id}`);

    // Por ejemplo, identificar usuario/admin
    socket.on('identify', (data) => {
      const { user_id } = data;
      socket.join(`user_${user_id}`); // Sala por usuario/admin
      console.log(`👤 Usuario ${user_id} unido a sala notifications`);
    });

    // Opcional: enviar mensaje de prueba
    socket.emit('connected', { message: 'Connected to notifications namespace' });

    socket.on('disconnect', () => {
      console.log(`❌ Cliente desconectado de notifications: ${socket.id}`);
    });
  });
}

export { setupNotificationsSocketIO };
