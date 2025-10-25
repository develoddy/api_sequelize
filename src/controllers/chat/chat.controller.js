import chatService from '../../services/chat/chat.service.js';
import { v4 as uuidv4 } from 'uuid';

const chatController = {
  /**
   * Inicializa una nueva sesión de chat
   * @param {Request} req - Petición HTTP
   * @param {Response} res - Respuesta HTTP
   */
  async initChat(req, res) {
    try {
      const { user_id, guest_id } = req.body;
      
      // Generar un ID de sesión único si no existe
      const session_id = req.body.session_id || uuidv4();
      
      // Verificar si al menos uno de user_id o guest_id está presente
      if (!user_id && !guest_id) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere un user_id o guest_id para iniciar una sesión de chat'
        });
      }
      
      const conversation = await chatService.findOrCreateConversation({
        user_id,
        guest_id,
        session_id
      });
      
      return res.status(200).json({
        success: true,
        conversation: {
          id: conversation.id,
          session_id: conversation.session_id,
          status: conversation.status,
          user_id: conversation.user_id,
          guest_id: conversation.guest_id
        }
      });
    } catch (error) {
      console.error("Error en initChat:", error);
      return res.status(500).json({
        success: false,
        message: 'Error al inicializar el chat',
        error: error.message
      });
    }
  },
  
  /**
   * Obtiene los mensajes de una conversación
   * @param {Request} req - Petición HTTP
   * @param {Response} res - Respuesta HTTP
   */
  async getMessages(req, res) {
    try {
      const { conversation_id } = req.params;
      
      if (!conversation_id) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere el ID de la conversación'
        });
      }
      
      // Obtener todos los mensajes de la conversación
      const messages = await chatService.getMessages(conversation_id);
      
      return res.status(200).json({
        success: true,
        messages
      });
    } catch (error) {
      console.error("Error en getMessages:", error);
      return res.status(500).json({
        success: false,
        message: 'Error al obtener los mensajes',
        error: error.message
      });
    }
  },
  
  /**
   * Obtiene una conversación por su ID
   * @param {Request} req - Petición HTTP
   * @param {Response} res - Respuesta HTTP
   */
  async getConversation(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere el ID de la conversación'
        });
      }
      
      // Obtener la conversación con sus mensajes
      const conversation = await chatService.getConversationById(id);
      
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversación no encontrada'
        });
      }
      
      return res.status(200).json({
        success: true,
        conversation
      });
    } catch (error) {
      console.error("Error en getConversation:", error);
      return res.status(500).json({
        success: false,
        message: 'Error al obtener la conversación',
        error: error.message
      });
    }
  },
  
  /**
   * Obtiene una conversación por su ID de sesión
   * @param {Request} req - Petición HTTP
   * @param {Response} res - Respuesta HTTP
   */
  async getConversationBySession(req, res) {
    try {
      const { session_id } = req.params;
      
      if (!session_id) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere el ID de sesión'
        });
      }
      
      // Obtener la conversación con sus mensajes por session_id
      const conversation = await chatService.getConversationBySessionId(session_id);
      
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversación no encontrada'
        });
      }
      
      return res.status(200).json({
        success: true,
        conversation
      });
    } catch (error) {
      console.error("Error en getConversationBySession:", error);
      return res.status(500).json({
        success: false,
        message: 'Error al obtener la conversación',
        error: error.message
      });
    }
  },
  
  /**
   * Obtiene todas las conversaciones activas
   * @param {Request} req - Petición HTTP
   * @param {Response} res - Respuesta HTTP
   */
  async getActiveConversations(req, res) {
    try {
      // Si se pasa ?status= en la query, delegamos al servicio para que
      // devuelva conversaciones filtradas por estado (open|closed|pending).
      const { status } = req.query || {};
      let conversations;
      if (status) {
        // permitirá que el servicio valide el valor
        conversations = await chatService.getConversationsByStatus(status);
      } else {
        // Obtener todas las conversaciones activas
        conversations = await chatService.getActiveConversations();
      }
      
      return res.status(200).json({
        success: true,
        conversations
      });
    } catch (error) {
      console.error("Error en getActiveConversations:", error);
      return res.status(500).json({
        success: false,
        message: 'Error al obtener las conversaciones activas',
        error: error.message
      });
    }
  },
  
  /**
   * Envía un mensaje a una conversación (API REST)
   * @param {Request} req - Petición HTTP
   * @param {Response} res - Respuesta HTTP
   */
  async sendMessage(req, res) {
    try {
      const { conversation_id, sender_type, sender_id, message } = req.body;
      
      // Validar datos necesarios
      if (!conversation_id || !sender_type || !message) {
        return res.status(400).json({
          success: false,
          message: 'Faltan datos requeridos (conversation_id, sender_type, message)'
        });
      }
      
      // Validar el tipo de remitente
      if (!['user', 'agent', 'system'].includes(sender_type)) {
        return res.status(400).json({
          success: false,
          message: 'sender_type debe ser "user", "agent" o "system"'
        });
      }
      
      // Guardar el mensaje
      const savedMessage = await chatService.saveMessage({
        conversation_id,
        sender_type,
        sender_id,
        message
      });
      
      return res.status(200).json({
        success: true,
        message: savedMessage
      });
    } catch (error) {
      console.error("Error en sendMessage:", error);
      return res.status(500).json({
        success: false,
        message: 'Error al enviar el mensaje',
        error: error.message
      });
    }
  },
  
  /**
   * Marca los mensajes de una conversación como leídos
   * @param {Request} req - Petición HTTP
   * @param {Response} res - Respuesta HTTP
   */
  async markMessagesAsRead(req, res) {
    try {
      const { conversation_id } = req.params;
      const { reader_type } = req.body;
      
      if (!conversation_id || !reader_type) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere el ID de la conversación y el tipo de lector'
        });
      }
      
      // Validar el tipo de lector
      if (!['user', 'agent'].includes(reader_type)) {
        return res.status(400).json({
          success: false,
          message: 'reader_type debe ser "user" o "agent"'
        });
      }
      
      // Marcar mensajes como leídos
      await chatService.markMessagesAsRead(conversation_id, reader_type);
      
      return res.status(200).json({
        success: true,
        message: 'Mensajes marcados como leídos'
      });
    } catch (error) {
      console.error("Error en markMessagesAsRead:", error);
      return res.status(500).json({
        success: false,
        message: 'Error al marcar los mensajes como leídos',
        error: error.message
      });
    }
  },
  
  /**
   * Asigna un agente a una conversación
   * @param {Request} req - Petición HTTP
   * @param {Response} res - Respuesta HTTP
   */
  async assignAgent(req, res) {
    try {
      const { conversation_id } = req.params;
      const { agent_id } = req.body;
      
      if (!conversation_id || !agent_id) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere el ID de la conversación y el ID del agente'
        });
      }
      
      // Asignar agente a la conversación
      await chatService.assignAgentToConversation(conversation_id, agent_id);
      
      return res.status(200).json({
        success: true,
        message: 'Agente asignado correctamente'
      });
    } catch (error) {
      console.error("Error en assignAgent:", error);
      return res.status(500).json({
        success: false,
        message: 'Error al asignar el agente',
        error: error.message
      });
    }
  },
  
  /**
   * Cierra una conversación
   * @param {Request} req - Petición HTTP
   * @param {Response} res - Respuesta HTTP
   */
  async closeConversation(req, res) {
    try {
      const { conversation_id } = req.params;
      
      if (!conversation_id) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere el ID de la conversación'
        });
      }
      
      // Cerrar la conversación
      await chatService.closeConversation(conversation_id);
      
      return res.status(200).json({
        success: true,
        message: 'Conversación cerrada correctamente'
      });
    } catch (error) {
      console.error("Error en closeConversation:", error);
      return res.status(500).json({
        success: false,
        message: 'Error al cerrar la conversación',
        error: error.message
      });
    }
  }
};

export default chatController;