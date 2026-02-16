// socket.js
let ioInstance = null;

export async function initSocketIO(server) {
  const { Server } = await import('socket.io');
  ioInstance = new Server(server, {
    cors: {
      origin: [
        'http://localhost:4200',  // Admin panel
        'http://localhost:4201',
        'http://localhost:4202',  // App SaaS (Video Express, MailFlow, etc)
        'http://localhost:4300',
        process.env.URL_FRONTEND,
        process.env.URL_ADMIN,
        process.env.URL_APP_SAAS
      ].filter(Boolean),
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true
    },
    transports: ['polling', 'websocket'], // Aceptar ambos transportes
    allowEIO3: true, // Compatibilidad con clientes antiguos
    pingTimeout: 60000,
    pingInterval: 25000
  });
  
  console.log('✅ Socket.IO initialized with transports:', ['polling', 'websocket']);
  
  // 🚀 Setup multi-tenant Socket.IO namespaces
  const { setupMultiTenantSocket } = await import('./controllers/chat/socket-tenant.controller.js');
  setupMultiTenantSocket(ioInstance);
  
  return ioInstance;
}

export function getIO() {
  if (!ioInstance) {
    throw new Error('❌ Socket.IO no está inicializado todavía.');
  }
  return ioInstance;
}
