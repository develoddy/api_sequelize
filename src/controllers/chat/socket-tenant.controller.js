import chatService from '../../services/chat/chat.service.js';
import { TenantChatConfig } from '../../models/chat/TenantChatConfig.js';
import { TenantAgent } from '../../models/chat/TenantAgent.js';
import moment from 'moment';

/**
 * Multi-Tenant Socket.IO Controller
 * Gestiona conexiones de chat para múltiples tenants con aislamiento completo
 * 
 * Namespaces dinámicos: /tenant-1, /tenant-2, /tenant-N
 */

export function setupMultiTenantSocket(io) {
  console.log('🔌 Setting up multi-tenant Socket.IO namespaces...');
  
  // Namespace dinámico que coincide con /tenant-{número}
  io.of(/^\/tenant-\d+$/).on('connection', async (socket) => {
    const tenantId = parseInt(socket.nsp.name.replace('/tenant-', ''));
    
    console.log(`[Tenant ${tenantId}] 🔌 Client connected: ${socket.id}`);
    console.log(`[Tenant ${tenantId}] 🔍 Validating tenant...`);
    
    // Validar que el tenant existe y está activo
    try {
      console.log(`[Tenant ${tenantId}] 📊 Buscando en DB: tenant_id=${tenantId}, is_active=true`);
      
      const config = await TenantChatConfig.findOne({
        where: { tenant_id: tenantId, is_active: true }
      });
      
      console.log(`[Tenant ${tenantId}] 📊 Config encontrado:`, config ? `ID ${config.id}` : 'NULL');
      
      if (!config) {
        console.warn(`[Tenant ${tenantId}] ❌ Unauthorized tenant - config not found or inactive`);
        socket.emit('error', { message: 'Tenant no autorizado o inactivo' });
        socket.disconnect();
        return;
      }
      
      console.log(`[Tenant ${tenantId}] ✅ Tenant validated successfully`);
    } catch (error) {
      console.error(`[Tenant ${tenantId}] ❌ Error validating tenant:`, error);
      console.error(`[Tenant ${tenantId}] ❌ Error stack:`, error.stack);
      socket.emit('error', { message: 'Error de autenticación' });
      socket.disconnect();
      return;
    }
    
    // ========================================
    // Usuario se identifica
    // ========================================
    socket.on('identify-user', async (data) => {
      try {
        console.log(`[Tenant ${tenantId}] 📥 identify-user received:`, data);
        
        const { session_id, user_id, guest_id } = data;
        
        if (!session_id) {
          console.log(`[Tenant ${tenantId}] ❌ session_id missing`);
          socket.emit('error', { message: 'session_id requerido' });
          return;
        }
        
        // Unirse a sala específica de sesión
        socket.join(`session_${session_id}`);
        console.log(`[Tenant ${tenantId}] 🚪 Joined room: session_${session_id}`);
        
        // Buscar o crear conversación CON tenant_id
        console.log(`[Tenant ${tenantId}] 🔍 Buscando/creando conversación...`);
        const conversation = await chatService.findOrCreateConversation({
          tenant_id: tenantId,
          session_id,
          user_id: user_id || null,
          guest_id: guest_id || null
        });
        
        console.log(`[Tenant ${tenantId}] ✅ Conversación lista:`, conversation.id);
        
        socket.emit('conversation-ready', {
          conversation_id: conversation.id,
          session_id: conversation.session_id,
          status: conversation.status,
          tenant_id: tenantId
        });
        
        // Notificar SOLO a agentes de este tenant
        socket.to(`tenant-${tenantId}-agents`).emit('user-connected', {
          conversation_id: conversation.id,
          session_id,
          user_id,
          guest_id,
          timestamp: new Date()
        });
        
        console.log(`[Tenant ${tenantId}] ✅ User identified: session ${session_id}, conversation ${conversation.id}`);
      } catch (error) {
        console.error(`[Tenant ${tenantId}] ❌ Error en identify-user:`, error);
        console.error(`[Tenant ${tenantId}] ❌ Error stack:`, error.stack);
        socket.emit('error', { 
          message: 'Error al identificar usuario',
          detail: error.message 
        });
      }
    });
    
    // ========================================
    // Agente se identifica
    // ========================================
    socket.on('identify-agent', async (data) => {
      try {
        const { agent_id, agent_email, agent_name } = data;
        
        let agent = null;
        
        // Validar que el agente pertenece a este tenant
        if (agent_email) {
          agent = await TenantAgent.findByEmailAndTenant(agent_email, tenantId);
          
          // Si no existe, auto-crear como owner (primera vez)
          if (!agent) {
            console.log(`[Tenant ${tenantId}] 🆕 Creating owner agent: ${agent_email}`);
            agent = await TenantAgent.create({
              tenant_id: tenantId,
              agent_name: agent_name || 'Owner',
              agent_email,
              status: 'active',
              role: 'owner'
            });
          }
        }
        
        if (!agent || agent.status !== 'active') {
          socket.emit('error', { message: 'Agente no autorizado para este tenant' });
          return;
        }
        
        // Actualizar last_seen_at
        agent.last_seen_at = new Date();
        await agent.save();
        
        // Unirse a sala de agentes de este tenant
        socket.join(`tenant-${tenantId}-agents`);
        
        socket.emit('agent-registered', {
          agent_id: agent.id,
          tenant_id: tenantId,
          agent_name: agent.agent_name,
          agent_email: agent.agent_email,
          role: agent.role
        });
        
        console.log(`[Tenant ${tenantId}] ✅ Agent registered: ${agent.agent_email} (${agent.role})`);
      } catch (error) {
        console.error(`[Tenant ${tenantId}] ❌ Error en identify-agent:`, error);
        socket.emit('error', { message: 'Error al identificar agente' });
      }
    });
    
    // ========================================
    // Mensaje de usuario
    // ========================================
    socket.on('user-message', async (data) => {
      try {
        const { conversation_id, session_id, user_id, guest_id, message } = data;
        
        if (!conversation_id || !session_id || !message) {
          socket.emit('error', { message: 'Datos incompletos para enviar mensaje' });
          return;
        }
        
        // Sanitizar mensaje
        const sanitizedMessage = message.trim().substring(0, 5000); // Máx 5000 caracteres
        
        // Guardar mensaje CON tenant_id
        const savedMessage = await chatService.saveMessage({
          conversation_id,
          tenant_id: tenantId,
          sender_type: 'user',
          sender_id: user_id || guest_id || null,
          message: sanitizedMessage
        });
        
        const messageData = {
          id: savedMessage.id,
          conversation_id,
          sender_type: 'user',
          sender_id: user_id || guest_id || null,
          message: sanitizedMessage,
          is_read: false,
          created_at: savedMessage.created_at,
          timestamp: moment(savedMessage.created_at).format('HH:mm')
        };
        
        // Emitir SOLO dentro del namespace del tenant
        socket.nsp.to(`session_${session_id}`).emit('new-message', messageData);
        socket.nsp.to(`tenant-${tenantId}-agents`).emit('new-user-message', {
          ...messageData,
          session_id
        });
        
        console.log(`[Tenant ${tenantId}] 💬 User message saved: ${savedMessage.id}`);
      } catch (error) {
        console.error(`[Tenant ${tenantId}] ❌ Error en user-message:`, error);
        socket.emit('error', { message: 'Error al enviar mensaje' });
      }
    });
    
    // ========================================
    // Mensaje de agente
    // ========================================
    socket.on('agent-message', async (data) => {
      try {
        const { conversation_id, session_id, agent_id, message } = data;
        
        if (!conversation_id || !session_id || !message) {
          socket.emit('error', { message: 'Datos incompletos' });
          return;
        }
        
        const sanitizedMessage = message.trim().substring(0, 5000);
        
        const savedMessage = await chatService.saveMessage({
          conversation_id,
          tenant_id: tenantId,
          sender_type: 'agent',
          sender_id: agent_id || null,
          message: sanitizedMessage
        });
        
        const messageData = {
          id: savedMessage.id,
          conversation_id,
          sender_type: 'agent',
          sender_id: agent_id,
          message: sanitizedMessage,
          is_read: true,
          created_at: savedMessage.created_at,
          timestamp: moment(savedMessage.created_at).format('HH:mm')
        };
        
        // Emitir a usuario y otros agentes
        socket.nsp.to(`session_${session_id}`).emit('new-message', messageData);
        socket.nsp.to(`tenant-${tenantId}-agents`).emit('new-agent-message', messageData);
        
        console.log(`[Tenant ${tenantId}] 💬 Agent message saved: ${savedMessage.id}`);
      } catch (error) {
        console.error(`[Tenant ${tenantId}] ❌ Error en agent-message:`, error);
        socket.emit('error', { message: 'Error al enviar mensaje' });
      }
    });
    
    // ========================================
    // Usuario está escribiendo
    // ========================================
    socket.on('user-typing', (data) => {
      const { session_id, is_typing } = data;
      socket.nsp.to(`tenant-${tenantId}-agents`).emit('user-typing-status', {
        session_id,
        is_typing
      });
    });
    
    // ========================================
    // Agente está escribiendo
    // ========================================
    socket.on('agent-typing', (data) => {
      const { session_id, agent_name, is_typing } = data;
      socket.nsp.to(`session_${session_id}`).emit('agent-typing-status', {
        agent_name,
        is_typing
      });
    });
    
    // ========================================
    // Desconexión
    // ========================================
    socket.on('disconnect', () => {
      console.log(`[Tenant ${tenantId}] Client disconnected: ${socket.id}`);
    });
  });
  
  console.log('✅ Multi-tenant Socket.IO namespaces configured');
}
