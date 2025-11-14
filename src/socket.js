// socket.js
let ioInstance = null;

export function initSocketIO(server) {
  import('socket.io').then(({ Server }) => {
    ioInstance = new Server(server, {
      cors: {
        origin: [
          'http://localhost:4200',
          'http://localhost:4201',
          'http://localhost:4300',
          process.env.URL_FRONTEND,
          process.env.URL_ADMIN
        ].filter(Boolean),
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true
      }
    });
  });
}

export function getIO() {
  if (!ioInstance) {
    throw new Error('❌ Socket.IO no está inicializado todavía.');
  }
  return ioInstance;
}
