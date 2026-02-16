import chatService from '../../services/chat/chat.service.js';
import moment from 'moment';

/**
 * Configura Socket.IO para la funcionalidad de chat
 * @param {Object} io - Instancia de Socket.IO
 */
function setupChatSocketIO(io) {
  // Mapeado de sessionId a socketId para seguimiento de usuarios
  const userSockets = new Map();
  // Mapeado de agentId a socketId para seguimiento de agentes
  const agentSockets = new Map();

  // Middleware para manejar CORS y autenticación si es necesario
  io.use((socket, next) => {
    // Ejemplo: verificar token si es necesario
    // const token = socket.handshake.auth.token;
    // if (isValidToken(token)) return next();
    // return next(new Error('Authentication error'));
    
    // Por ahora, permitir todas las conexiones
    next();
  });

  // Cuando un cliente se conecta
  io.on('connection', (socket) => {
    console.log(`Cliente conectado: ${socket.id}`);

    // Cliente se identifica (usuario regular)
    socket.on('identify-user', async (data) => {
      try {
        console.log('[SOCKET] identify-user payload:', data);
        const { session_id, user_id, guest_id } = data;
        
        if (!session_id) {
          socket.emit('error', { message: 'Se requiere session_id' });
          return;
        }
        
        // Registrar este socket como perteneciente a este usuario/sesión
        userSockets.set(session_id, socket.id);
        
        // Unirse a la sala específica para esta sesión
        socket.join(`session_${session_id}`);
        
        console.log(`Usuario identificado - Session: ${session_id}, SocketID: ${socket.id}`);
        
        // Buscar o crear la conversación para esta sesión
        // 👉 IMPORTANTE: tenant_id = 1 para el ecommerce principal
        const conversation = await chatService.findOrCreateConversation({
          tenant_id: 1,  // 👉 Ecommerce principal
          session_id,
          user_id: user_id || null,
          guest_id: guest_id || null
        });
        
        // Enviar la conversación al cliente
        socket.emit('conversation-ready', {
          conversation_id: conversation.id,
          session_id: conversation.session_id,
          status: conversation.status
        });
        
        // Notificar a los agentes que hay un nuevo usuario
        io.to('agents').emit('user-connected', {
          session_id,
          conversation_id: conversation.id,
          user_id,
          guest_id,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Error en identify-user:', error, error?.stack);
        socket.emit('error', { message: 'Error al identificar usuario' });
      }
    });
    
    // Agente se identifica
    socket.on('identify-agent', (data) => {
      try {
        const { agent_id, agent_name } = data;
        
        if (!agent_id) {
          socket.emit('error', { message: 'Se requiere agent_id' });
          return;
        }
        
        // Registrar este socket como perteneciente a este agente
        agentSockets.set(agent_id.toString(), socket.id);
        
        // Unirse a la sala de agentes
        socket.join('agents');
        
        console.log(`Agente identificado - ID: ${agent_id}, Nombre: ${agent_name}, SocketID: ${socket.id}`);
        
        // Informar al agente que se ha registrado correctamente
        socket.emit('agent-registered', {
          agent_id,
          agent_name,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Error en identify-agent:', error);
        socket.emit('error', { message: 'Error al identificar agente' });
      }
    });
    
    // Cliente envía un mensaje
    socket.on('user-message', async (data) => {
      try {
        const { conversation_id, session_id, user_id, guest_id, message } = data;
        
        if (!conversation_id || !session_id || !message) {
          socket.emit('error', { message: 'Datos incompletos para enviar mensaje' });
          return;
        }
        
        // Guardar el mensaje en la base de datos
        // 👉 IMPORTANTE: tenant_id = 1 para el ecommerce principal
        const savedMessage = await chatService.saveMessage({
          conversation_id,
          tenant_id: 1,  // 👉 Ecommerce principal
          sender_type: 'user',
          sender_id: user_id || guest_id || null,
          message
        });
        
        const messageData = {
          id: savedMessage.id,
          conversation_id,
          sender_type: 'user',
          sender_id: user_id || guest_id || null,
          message,
          is_read: false,
          created_at: savedMessage.created_at,
          timestamp: moment(savedMessage.created_at).format('HH:mm')
        };
        
        // Emitir el mensaje a todos en esta sala de conversación (incluido el remitente para confirmación)
        io.to(`session_${session_id}`).emit('new-message', messageData);
        
        // También emitir a todos los agentes
        io.to('agents').emit('new-user-message', {
          ...messageData,
          session_id
        });
        
        console.log(`Mensaje de usuario guardado: ${savedMessage.id}`);
      } catch (error) {
        console.error('Error en user-message:', error);
        socket.emit('error', { message: 'Error al enviar mensaje' });
      }
    });
    
    // Agente envía un mensaje
    socket.on('agent-message', async (data) => {
      try {
        const { conversation_id, session_id, agent_id, message } = data;
        
        if (!conversation_id || !session_id || !agent_id || !message) {
          socket.emit('error', { message: 'Datos incompletos para enviar mensaje' });
          return;
        }
        
        // Guardar el mensaje en la base de datos
        const savedMessage = await chatService.saveMessage({
          conversation_id,
          tenant_id: 1,  // 👉 Ecommerce principal
          sender_type: 'agent',
          sender_id: agent_id,
          message,
          is_read: false
        });
        
        // Asignar el agente a esta conversación si aún no está asignado
        await chatService.assignAgentToConversation(conversation_id, agent_id);
        
        const messageData = {
          id: savedMessage.id,
          conversation_id,
          sender_type: 'agent',
          sender_id: agent_id,
          message,
          is_read: false,
          created_at: savedMessage.created_at,
          timestamp: moment(savedMessage.created_at).format('HH:mm')
        };
        
        // Emitir el mensaje a la sala específica de esta sesión
        io.to(`session_${session_id}`).emit('new-message', messageData);
        
        // También emitir a todos los agentes
        io.to('agents').emit('new-agent-message', {
          ...messageData,
          session_id
        });
        
        console.log(`Mensaje de agente guardado: ${savedMessage.id}`);
      } catch (error) {
        console.error('Error en agent-message:', error);
        socket.emit('error', { message: 'Error al enviar mensaje' });
      }
    });
    
    // Cliente o agente marca mensajes como leídos
    socket.on('mark-read', async (data) => {
      try {
        const { conversation_id, reader_type } = data;
        
        if (!conversation_id || !reader_type) {
          socket.emit('error', { message: 'Datos incompletos para marcar mensajes como leídos' });
          return;
        }
        
        // Marcar mensajes como leídos en la base de datos
        await chatService.markMessagesAsRead(conversation_id, reader_type);
        
        // Notificar a todos los clientes interesados
        io.to(`session_${data.session_id}`).emit('messages-read', {
          conversation_id,
          reader_type,
          timestamp: new Date()
        });
        
        // También notificar a los agentes
        if (reader_type === 'user') {
          io.to('agents').emit('user-read-messages', {
            conversation_id,
            session_id: data.session_id,
            timestamp: new Date()
          });
        }
        
        console.log(`Mensajes marcados como leídos - Conversación: ${conversation_id}, Lector: ${reader_type}`);
      } catch (error) {
        console.error('Error en mark-read:', error);
        socket.emit('error', { message: 'Error al marcar mensajes como leídos' });
      }
    });
    
    // Agente toma una conversación
    socket.on('take-conversation', async (data) => {
      try {
        const { conversation_id, agent_id, agent_name, session_id } = data;
        
        if (!conversation_id || !agent_id || !session_id) {
          socket.emit('error', { message: 'Datos incompletos para tomar la conversación' });
          return;
        }
        
        // Asignar agente a la conversación
        await chatService.assignAgentToConversation(conversation_id, agent_id);
        
        // Notificar al cliente
        const userSocketId = userSockets.get(session_id);
        if (userSocketId) {
          io.to(userSocketId).emit('agent-joined', {
            conversation_id,
            agent_id,
            agent_name,
            timestamp: new Date()
          });
        }
        
        // Notificar a otros agentes
        io.to('agents').emit('conversation-taken', {
          conversation_id,
          session_id,
          agent_id,
          agent_name,
          timestamp: new Date()
        });
        
        // Enviar mensaje de sistema
        await chatService.saveMessage({
          conversation_id,
          tenant_id: 1,  // 👉 Ecommerce principal
          sender_type: 'system',
          message: `El agente ${agent_name} se ha unido a la conversación.`
        });
        
        console.log(`Agente tomó conversación - ID: ${conversation_id}, Agente: ${agent_id}`);
      } catch (error) {
        console.error('Error en take-conversation:', error);
        socket.emit('error', { message: 'Error al tomar la conversación' });
      }
    });
    
    // Agente cierra la conversación
    socket.on('close-conversation', async (data) => {
      try {
        const { conversation_id, session_id } = data;
        
        if (!conversation_id || !session_id) {
          socket.emit('error', { message: 'Datos incompletos para cerrar la conversación' });
          return;
        }
        
        // Cerrar la conversación en la base de datos
        await chatService.closeConversation(conversation_id);
        
        // Notificar al cliente
        io.to(`session_${session_id}`).emit('conversation-closed', {
          conversation_id,
          timestamp: new Date(),
          message: 'La conversación ha sido cerrada.'
        });
        
        // Notificar a los agentes
        io.to('agents').emit('conversation-closed', {
          conversation_id,
          session_id,
          timestamp: new Date()
        });
        
        // Guardar mensaje de sistema
        await chatService.saveMessage({
          conversation_id,
          tenant_id: 1,  // 👉 Ecommerce principal
          sender_type: 'system',
          message: 'La conversación ha sido cerrada.'
        });
        
        console.log(`Conversación cerrada - ID: ${conversation_id}`);
      } catch (error) {
        console.error('Error en close-conversation:', error);
        socket.emit('error', { message: 'Error al cerrar la conversación' });
      }
    });
    
    // Solicitar historial de mensajes
    socket.on('get-history', async (data) => {
      try {
        const { conversation_id } = data;
        
        if (!conversation_id) {
          socket.emit('error', { message: 'Se requiere conversation_id' });
          return;
        }
        
        // Obtener mensajes de la conversación
        const messages = await chatService.getMessages(conversation_id);
        
        // Formatear los mensajes para enviar
        const formattedMessages = messages.map(msg => ({
          id: msg.id,
          conversation_id: msg.conversation_id,
          sender_type: msg.sender_type,
          sender_id: msg.sender_id,
          message: msg.message,
          is_read: msg.is_read,
          created_at: msg.created_at,
          timestamp: moment(msg.created_at).format('HH:mm')
        }));
        
        // Enviar los mensajes al solicitante
        socket.emit('chat-history', {
          conversation_id,
          messages: formattedMessages
        });
        
        console.log(`Historial enviado - Conversación: ${conversation_id}, Mensajes: ${formattedMessages.length}`);
      } catch (error) {
        console.error('Error en get-history:', error);
        socket.emit('error', { message: 'Error al obtener el historial' });
      }
    });
    
    // Cliente o agente está escribiendo
    socket.on('typing', (data) => {
      const { conversation_id, session_id, is_agent, user_name } = data;
      
      if (!conversation_id || !session_id) {
        return;
      }
      
      const typingEvent = {
        conversation_id,
        is_typing: true,
        is_agent,
        user_name: user_name || (is_agent ? 'Agente' : 'Usuario'),
        timestamp: new Date()
      };
      
      // Notificar que el usuario/agente está escribiendo
      if (is_agent) {
        // Si es agente, notificar al usuario
        io.to(`session_${session_id}`).emit('typing-update', typingEvent);
      } else {
        // Si es usuario, notificar a los agentes
        io.to('agents').emit('typing-update', {
          ...typingEvent,
          session_id
        });
      }
    });
    
    // Cliente o agente dejó de escribir
    socket.on('stopped-typing', (data) => {
      const { conversation_id, session_id, is_agent } = data;
      
      if (!conversation_id || !session_id) {
        return;
      }
      
      const typingEvent = {
        conversation_id,
        is_typing: false,
        is_agent,
        timestamp: new Date()
      };
      
      // Notificar que el usuario/agente dejó de escribir
      if (is_agent) {
        // Si es agente, notificar al usuario
        io.to(`session_${session_id}`).emit('typing-update', typingEvent);
      } else {
        // Si es usuario, notificar a los agentes
        io.to('agents').emit('typing-update', {
          ...typingEvent,
          session_id
        });
      }
    });
    
    // Cliente solicita soporte
    socket.on('request-support', async (data) => {
      try {
        const { session_id, user_id, guest_id, name, email, issue } = data;
        
        if (!session_id) {
          socket.emit('error', { message: 'Se requiere session_id' });
          return;
        }
        
        // Buscar o crear la conversación para esta sesión
        const conversation = await chatService.findOrCreateConversation({
          tenant_id: 1,  // 👉 Ecommerce principal
          session_id,
          user_id: user_id || null,
          guest_id: guest_id || null
        });
        
        // Guardar el mensaje de solicitud de soporte
        await chatService.saveMessage({
          conversation_id: conversation.id,
          tenant_id: 1,  // 👉 Ecommerce principal
          sender_type: 'user',
          sender_id: user_id || guest_id || null,
          message: issue || 'Solicitud de soporte'
        });
        
        // Registrar este socket como perteneciente a este usuario/sesión
        userSockets.set(session_id, socket.id);
        
        // Unirse a la sala específica para esta sesión
        socket.join(`session_${session_id}`);
        
        // Enviar la conversación al cliente
        socket.emit('conversation-ready', {
          conversation_id: conversation.id,
          session_id: conversation.session_id,
          status: conversation.status
        });
        
        // Notificar a los agentes que hay una nueva solicitud de soporte
        io.to('agents').emit('new-support-request', {
          session_id,
          conversation_id: conversation.id,
          user_id,
          guest_id,
          name,
          email,
          issue,
          timestamp: new Date()
        });
        
        console.log(`Solicitud de soporte - Session: ${session_id}, Conversación: ${conversation.id}`);
      } catch (error) {
        console.error('Error en request-support:', error);
        socket.emit('error', { message: 'Error al solicitar soporte' });
      }
    });
    
    // Manejar desconexión
    socket.on('disconnect', () => {
      // Encontrar y eliminar este socket de los mapeos
      for (const [sessionId, socketId] of userSockets.entries()) {
        if (socketId === socket.id) {
          userSockets.delete(sessionId);
          console.log(`Usuario desconectado - Session: ${sessionId}, SocketID: ${socket.id}`);
          
          // Notificar a los agentes que el usuario se desconectó
          io.to('agents').emit('user-disconnected', {
            session_id: sessionId,
            timestamp: new Date()
          });
          break;
        }
      }
      
      for (const [agentId, socketId] of agentSockets.entries()) {
        if (socketId === socket.id) {
          agentSockets.delete(agentId);
          console.log(`Agente desconectado - ID: ${agentId}, SocketID: ${socket.id}`);
          
          // Notificar a otros agentes
          io.to('agents').emit('agent-disconnected', {
            agent_id: agentId,
            timestamp: new Date()
          });
          break;
        }
      }
      
      console.log(`Cliente desconectado: ${socket.id}`);
    });
  });
}

export { setupChatSocketIO };