import { Op } from 'sequelize';
import chatService from '../../services/chat/chat.service.js';
import { TenantChatConfig } from '../../models/chat/TenantChatConfig.js';
import { TenantAgent } from '../../models/chat/TenantAgent.js';
import { ChatConversation } from '../../models/chat/ChatConversation.js';
import { ChatMessage } from '../../models/chat/ChatMessage.js';
import { requireTenant } from '../../middlewares/tenant-auth.middleware.js';

/**
 * Controlador para endpoints multi-tenant del chat
 */

// Obtener configuración del chat para el tenant
export const getTenantConfig = async (req, res) => {
  try {
    const { tenantId } = req;
    
    let config = await TenantChatConfig.findOne({
      where: { tenant_id: tenantId }
    });
    
    // Si no existe configuración, crear una por defecto
    if (!config) {
      config = await TenantChatConfig.create({
        tenant_id: tenantId,
        widget_color: '#4F46E5',
        welcome_message: '👋 ¡Hola! ¿En qué podemos ayudarte?',
        integration_type: 'iframe',
        is_active: true
      });
    }
    
    res.json({
      success: true,
      config: {
        ...config.toJSON(),
        iframe_embed_code: config.getIframeEmbedCode(),
        is_within_business_hours: config.isWithinBusinessHours()
      }
    });
  } catch (error) {
    console.error('[getTenantConfig] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener configuración',
      message: error.message
    });
  }
};

// Actualizar configuración del chat
export const updateTenantConfig = async (req, res) => {
  try {
    const { tenantId } = req;
    const updates = req.body;
    
    let config = await TenantChatConfig.findOne({
      where: { tenant_id: tenantId }
    });
    
    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configuración no encontrada'
      });
    }
    
    // Campos permitidos para actualizar
    const allowedFields = [
      'widget_color',
      'widget_position',
      'welcome_message',
      'business_hours',
      'timezone',
      'auto_response_enabled',
      'capture_leads',
      'allowed_domains',
      'integration_type',
      'integration_config',
      'max_agents'
    ];
    
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        config[field] = updates[field];
      }
    });
    
    await config.save();
    
    res.json({
      success: true,
      config: config.toJSON(),
      message: 'Configuración actualizada exitosamente'
    });
  } catch (error) {
    console.error('[updateTenantConfig] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar configuración',
      message: error.message
    });
  }
};

// Obtener conversaciones del tenant
export const getTenantConversations = async (req, res) => {
  try {
    const { tenantId } = req;
    const { status, page = 1, limit = 20 } = req.query;
    
    const where = { tenant_id: tenantId };
    
    if (status && status !== 'all') {
      where.status = status;
    }
    
    const offset = (page - 1) * limit;
    
    const { count, rows } = await ChatConversation.findAndCountAll({
      where,
      include: [
        {
          model: ChatMessage,
          as: 'messages',
          separate: true,
          limit: 1,
          order: [['created_at', 'DESC']]
        }
      ],
      order: [['updated_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      conversations: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('[getTenantConversations] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener conversaciones',
      message: error.message
    });
  }
};

// Obtener mensajes de una conversación
export const getTenantConversationMessages = async (req, res) => {
  try {
    const { tenantId } = req;
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    // Verificar que la conversación pertenece al tenant
    const conversation = await ChatConversation.findOne({
      where: {
        id: conversationId,
        tenant_id: tenantId
      }
    });
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversación no encontrada'
      });
    }
    
    const offset = (page - 1) * limit;
    
    const { count, rows } = await ChatMessage.findAndCountAll({
      where: {
        conversation_id: conversationId,
        tenant_id: tenantId
      },
      order: [['created_at', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      conversation: conversation.toJSON(),
      messages: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('[getTenantConversationMessages] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener mensajes',
      message: error.message
    });
  }
};

// Enviar mensaje como agente
export const sendTenantMessage = async (req, res) => {
  try {
    const { tenantId } = req;
    const { conversation_id, message, agent_id, agent_name } = req.body;
    
    // Verificar que la conversación pertenece al tenant
    const conversation = await ChatConversation.findOne({
      where: {
        id: conversation_id,
        tenant_id: tenantId
      }
    });
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversación no encontrada'
      });
    }
    
    // Guardar mensaje
    const savedMessage = await chatService.saveMessage({
      conversation_id,
      tenant_id: tenantId,
      sender_type: 'agent',
      sender_id: agent_id || null,
      message
    });
    
    // Emitir via Socket.IO (se maneja en socket-tenant.controller.js)
    const { getIO } = await import('../../socket.js');
    const io = getIO();
    
    // Emitir al namespace del tenant
    io.of(`/tenant-${tenantId}`).to(`session_${conversation.session_id}`)
      .emit('new-message', {
        ...savedMessage.toJSON(),
        agent_name
      });
    
    res.json({
      success: true,
      message: savedMessage.toJSON()
    });
  } catch (error) {
    console.error('[sendTenantMessage] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al enviar mensaje',
      message: error.message
    });
  }
};

// Obtener estadísticas del tenant
export const getTenantStats = async (req, res) => {
  try {
    const { tenantId } = req;
    
    const [
      totalConversations,
      openConversations,
      pendingConversations,
      closedConversations,
      totalMessages
    ] = await Promise.all([
      ChatConversation.count({ where: { tenant_id: tenantId } }),
      ChatConversation.count({ where: { tenant_id: tenantId, status: 'open' } }),
      ChatConversation.count({ where: { tenant_id: tenantId, status: 'pending' } }),
      ChatConversation.count({ where: { tenant_id: tenantId, status: 'closed' } }),
      ChatMessage.count({ where: { tenant_id: tenantId } })
    ]);
    
    // Conversaciones activas (open + pending)
    const activeConversations = openConversations + pendingConversations;
    
    // Calcular tiempo promedio de respuesta (placeholder por ahora)
    const avgResponseTime = '5 min'; // TODO: Calcular tiempo real basado en timestamps
    
    res.json({
      total_conversations: totalConversations,
      active_conversations: activeConversations,
      total_messages: totalMessages,
      avg_response_time: avgResponseTime,
      conversations_by_status: {
        open: openConversations,
        pending: pendingConversations,
        closed: closedConversations
      }
    });
  } catch (error) {
    console.error('[getTenantStats] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas',
      message: error.message
    });
  }
};

// Gestión de agentes
export const getTenantAgents = async (req, res) => {
  try {
    const { tenantId } = req;
    
    const agents = await TenantAgent.findAll({
      where: { tenant_id: tenantId },
      order: [['created_at', 'DESC']]
    });
    
    res.json({
      success: true,
      agents
    });
  } catch (error) {
    console.error('[getTenantAgents] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener agentes',
      message: error.message
    });
  }
};

export const inviteTenantAgent = async (req, res) => {
  try {
    const { tenantId } = req;
    const { agent_name, agent_email, role = 'agent' } = req.body;
    
    // Verificar límite de agentes
    const config = await TenantChatConfig.findOne({
      where: { tenant_id: tenantId }
    });
    
    const currentAgents = await TenantAgent.count({
      where: {
        tenant_id: tenantId,
        status: { [Op.in]: ['active', 'invited'] }
      }
    });
    
    if (currentAgents >= config.max_agents) {
      return res.status(400).json({
        success: false,
        error: 'Límite de agentes alcanzado',
        message: `Tu plan permite máximo ${config.max_agents} agentes`
      });
    }
    
    // Verificar si ya existe
    const existing = await TenantAgent.findOne({
      where: {
        tenant_id: tenantId,
        agent_email
      }
    });
    
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'El agente ya existe'
      });
    }
    
    // Crear agente
    const agent = await TenantAgent.create({
      tenant_id: tenantId,
      agent_name,
      agent_email,
      role,
      status: 'invited'
    });
    
    // Generar token de invitación
    const token = agent.generateInviteToken();
    await agent.save();
    
    // TODO: Enviar email de invitación
    const inviteUrl = `${process.env.URL_APP_SAAS}/chat/accept-invite/${token}`;
    
    res.json({
      success: true,
      agent: agent.toJSON(),
      invite_url: inviteUrl,
      message: 'Agente invitado exitosamente'
    });
  } catch (error) {
    console.error('[inviteTenantAgent] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al invitar agente',
      message: error.message
    });
  }
};
