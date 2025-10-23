import { ChatConversation } from '../../models/chat/ChatConversation.js';
import { ChatMessage } from '../../models/chat/ChatMessage.js';
import { sequelize } from '../../database/database.js';
import { Op } from 'sequelize';
import moment from 'moment';

class ChatService {
  /**
   * Crea una nueva conversación de chat
   * @param {Object} data - Datos de la conversación
   * @returns {Object} - La nueva conversación creada
   */
  async createConversation(data) {
    try {
      return await ChatConversation.create({
        user_id: data.user_id || null,
        guest_id: data.guest_id || null,
        session_id: data.session_id,
        last_message: null,
        last_message_time: null,
        is_active: true,
        status: 'open',
        created_at: new Date(),
        updated_at: new Date()
      });
    } catch (error) {
      console.error("Error creando conversación:", error);
      throw error;
    }
  }

  /**
   * Busca una conversación existente o crea una nueva
   * @param {Object} data - Datos para buscar o crear la conversación
   * @returns {Object} - La conversación existente o una nueva
   */
  async findOrCreateConversation(data) {
    try {
      let query = { session_id: data.session_id };
      
      // Si hay un usuario autenticado, buscar por user_id
      if (data.user_id) {
        query.user_id = data.user_id;
      } 
      // Si es un invitado, buscar por guest_id
      else if (data.guest_id) {
        query.guest_id = data.guest_id;
      }
      
      // Buscar conversaciones activas primero
      const existingConversation = await ChatConversation.findOne({
        where: {
          ...query,
          is_active: true
        }
      });
      
      if (existingConversation) {
        return existingConversation;
      }
      
      // Si no hay una conversación activa, crear una nueva
      return await this.createConversation(data);
    } catch (error) {
      console.error("Error en findOrCreateConversation:", error);
      throw error;
    }
  }

  /**
   * Guarda un mensaje en la base de datos
   * @param {Object} messageData - Datos del mensaje
   * @returns {Object} - El mensaje guardado
   */
  async saveMessage(messageData) {
    const t = await sequelize.transaction();
    
    try {
      // Crear el mensaje
      const message = await ChatMessage.create({
        conversation_id: messageData.conversation_id,
        sender_type: messageData.sender_type,
        sender_id: messageData.sender_id || null,
        message: messageData.message,
        is_read: messageData.sender_type === 'agent',
        created_at: new Date()
      }, { transaction: t });
      
      // Actualizar la conversación con el último mensaje
      await ChatConversation.update({
        last_message: messageData.message,
        last_message_time: new Date(),
        unread_count: sequelize.literal(
          messageData.sender_type === 'agent' 
            ? 'unread_count' 
            : 'unread_count + 1'
        ),
        updated_at: new Date()
      }, {
        where: { id: messageData.conversation_id },
        transaction: t
      });
      
      await t.commit();
      return message;
    } catch (error) {
      await t.rollback();
      console.error("Error guardando mensaje:", error);
      throw error;
    }
  }

  /**
   * Obtiene todos los mensajes de una conversación
   * @param {number} conversationId - ID de la conversación
   * @returns {Array} - Lista de mensajes
   */
  async getMessages(conversationId) {
    try {
      return await ChatMessage.findAll({
        where: { conversation_id: conversationId },
        order: [['created_at', 'ASC']]
      });
    } catch (error) {
      console.error("Error obteniendo mensajes:", error);
      throw error;
    }
  }

  /**
   * Obtiene una conversación por ID
   * @param {number} id - ID de la conversación
   * @returns {Object} - La conversación encontrada
   */
  async getConversationById(id) {
    try {
      return await ChatConversation.findByPk(id, {
        include: [{
          model: ChatMessage,
          as: 'messages',
          order: [['created_at', 'ASC']]
        }]
      });
    } catch (error) {
      console.error("Error obteniendo conversación por ID:", error);
      throw error;
    }
  }

  /**
   * Obtiene una conversación por session_id
   * @param {string} sessionId - ID de sesión
   * @returns {Object} - La conversación encontrada
   */
  async getConversationBySessionId(sessionId) {
    try {
      return await ChatConversation.findOne({
        where: { 
          session_id: sessionId,
          is_active: true
        },
        include: [{
          model: ChatMessage,
          as: 'messages',
          order: [['created_at', 'ASC']]
        }]
      });
    } catch (error) {
      console.error("Error obteniendo conversación por session_id:", error);
      throw error;
    }
  }

  /**
   * Obtiene todas las conversaciones activas
   * @returns {Array} - Lista de conversaciones
   */
  async getActiveConversations() {
    try {
      return await ChatConversation.findAll({
        where: { 
          is_active: true,
          status: {
            [Op.ne]: 'closed'
          }
        },
        order: [['updated_at', 'DESC']]
      });
    } catch (error) {
      console.error("Error obteniendo conversaciones activas:", error);
      throw error;
    }
  }

  /**
   * Asigna un agente a una conversación
   * @param {number} conversationId - ID de la conversación
   * @param {number} agentId - ID del agente
   * @returns {boolean} - Resultado de la operación
   */
  async assignAgentToConversation(conversationId, agentId) {
    try {
      await ChatConversation.update({
        agent_id: agentId,
        status: 'open',
        updated_at: new Date()
      }, {
        where: { id: conversationId }
      });
      return true;
    } catch (error) {
      console.error("Error asignando agente a la conversación:", error);
      throw error;
    }
  }

  /**
   * Marca todos los mensajes de una conversación como leídos
   * @param {number} conversationId - ID de la conversación
   * @param {string} readerType - Tipo de lector (user/agent)
   * @returns {boolean} - Resultado de la operación
   */
  async markMessagesAsRead(conversationId, readerType) {
    try {
      // Si el lector es un agente, marcar los mensajes del usuario como leídos
      const senderType = readerType === 'agent' ? 'user' : 'agent';
      
      await ChatMessage.update({
        is_read: true
      }, {
        where: { 
          conversation_id: conversationId,
          sender_type: senderType,
          is_read: false
        }
      });
      
      // Actualizar el contador de no leídos en la conversación
      await ChatConversation.update({
        unread_count: 0,
        updated_at: new Date()
      }, {
        where: { id: conversationId }
      });
      
      return true;
    } catch (error) {
      console.error("Error marcando mensajes como leídos:", error);
      throw error;
    }
  }

  /**
   * Cierra una conversación
   * @param {number} conversationId - ID de la conversación
   * @returns {boolean} - Resultado de la operación
   */
  async closeConversation(conversationId) {
    try {
      await ChatConversation.update({
        status: 'closed',
        is_active: false,
        updated_at: new Date()
      }, {
        where: { id: conversationId }
      });
      return true;
    } catch (error) {
      console.error("Error cerrando conversación:", error);
      throw error;
    }
  }
}

export default new ChatService();