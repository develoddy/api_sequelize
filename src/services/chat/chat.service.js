import { ChatConversation } from '../../models/chat/ChatConversation.js';
import { ChatMessage } from '../../models/chat/ChatMessage.js';
import { User } from '../../models/User.js';
import { Guest } from '../../models/Guest.js';
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
      const { tenant_id } = data;
      
      if (!tenant_id) {
        throw new Error('tenant_id es obligatorio para crear conversación');
      }
      
      return await ChatConversation.create({
        tenant_id: tenant_id,
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
      const { tenant_id, session_id } = data;
      
      if (!tenant_id) {
        throw new Error('tenant_id es obligatorio');
      }
      
      if (!session_id) {
        throw new Error('session_id es obligatorio');
      }
      
      let query = { 
        tenant_id: tenant_id,
        session_id: session_id 
      };
      
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
      const { tenant_id, conversation_id } = messageData;
      
      if (!tenant_id) {
        throw new Error('tenant_id es obligatorio para guardar mensaje');
      }
      
      if (!conversation_id) {
        throw new Error('conversation_id es obligatorio');
      }
      
      // Crear el mensaje
      const message = await ChatMessage.create({
        tenant_id: tenant_id,
        conversation_id: conversation_id,
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
        where: { 
          id: conversation_id,
          tenant_id: tenant_id 
        },
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
        include: [
          {
            model: ChatMessage,
            as: 'messages',
            order: [['created_at', 'ASC']]
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'surname', 'email', 'avatar'],
            required: false
          },
          {
            model: Guest,
            as: 'guest',
            attributes: ['id', 'session_id', 'name', 'email', 'avatar'],
            required: false
          }
        ]
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
        include: [
          {
            model: ChatMessage,
            as: 'messages',
            order: [['created_at', 'ASC']]
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'surname', 'email', 'avatar'],
            required: false
          },
          {
            model: Guest,
            as: 'guest',
            attributes: ['id', 'session_id', 'name', 'email', 'avatar'],
            required: false
          }
        ]
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
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'surname', 'email', 'avatar'],
            required: false
          },
          {
            model: Guest,
            as: 'guest',
            attributes: ['id', 'session_id', 'name', 'email', 'avatar'],
            required: false
          }
        ],
        order: [['updated_at', 'DESC']]
      });
    } catch (error) {
      console.error("Error obteniendo conversaciones activas:", error);
      throw error;
    }
  }

  /**
   * Obtiene conversaciones filtradas por status.
   * Soporta: 'open' | 'closed' | 'pending'
   * - open: conversaciones activas con status = 'open'
   * - closed: conversaciones con status = 'closed'
   * - pending: conversaciones sin agente asignado y no cerradas
   */
  async getConversationsByStatus(status) {
    try {
      const s = (status || '').toString().toLowerCase();
      let where = {};

      if (s === 'open') {
        // Return all conversations whose status is 'open' regardless of is_active
        // since some rows may have is_active = 0 but still be considered open
        where = { status: 'open' };
      } else if (s === 'closed') {
        where = { status: 'closed' };
      } else if (s === 'pending') {
        // pending = no agent assigned and not closed
        where = {
          agent_id: null,
          status: { [Op.ne]: 'closed' }
        };
      } else {
        // si se recibe un valor desconocido, devolver arreglo vacío
        return [];
      }

      // Some deployments may store empty-string agent IDs; include both null
      // and '' when filtering for pending conversations. Also use `raw: true`
      // to return plain objects (avoid instance serialization issues).
      if (s === 'pending') {
        where = {
          [Op.and]: [
            { status: { [Op.ne]: 'closed' } },
            { [Op.or]: [{ agent_id: null }, { agent_id: '' }] }
          ]
        };
      }

      // Optional per-query SQL logging to help debugging; remove or guard in
      // production if it's too verbose.
      const loggingFn = (sql) => console.debug(`SQL getConversationsByStatus(${s}): ${sql}`);

      const results = await ChatConversation.findAll({
        where,
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'surname', 'email', 'avatar'],
            required: false
          },
          {
            model: Guest,
            as: 'guest',
            attributes: ['id', 'session_id', 'name', 'email', 'avatar'],
            required: false
          }
        ],
        order: [['updated_at', 'DESC']],
        logging: loggingFn
      });

      // debug: (can be removed) log how many rows matched for clarity during testing
      console.debug(`getConversationsByStatus(${s}) -> ${Array.isArray(results) ? results.length : 0} rows`);

      return results;
    } catch (error) {
      console.error("Error obteniendo conversaciones por status:", error);
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