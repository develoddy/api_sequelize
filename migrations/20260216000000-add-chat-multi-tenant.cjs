'use strict';

/**
 * Migración: Convertir sistema de chat a multi-tenant
 * 
 * Cambios:
 * 1. Agregar tenant_id a chat_conversations y chat_messages
 * 2. Crear tabla tenant_chat_config
 * 3. Crear tabla tenant_agents
 * 4. Actualizar índices para queries optimizadas
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // 1. Agregar tenant_id a chat_conversations
      await queryInterface.addColumn('chat_conversations', 'tenant_id', {
        type: Sequelize.INTEGER,
        allowNull: true,  // Temporalmente null para migrar datos existentes
        comment: 'ID del tenant propietario de la conversación'
      }, { transaction });
      
      // 2. Agregar tenant_id a chat_messages
      await queryInterface.addColumn('chat_messages', 'tenant_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'ID del tenant propietario del mensaje'
      }, { transaction });
      
      // 3. Crear tabla de configuración por tenant
      await queryInterface.createTable('tenant_chat_config', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        tenant_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          unique: true,
          comment: 'ID del tenant en la tabla modules_tenants'
        },
        widget_color: {
          type: Sequelize.STRING(7),
          defaultValue: '#4F46E5',
          comment: 'Color principal del widget (hex)'
        },
        widget_position: {
          type: Sequelize.ENUM('bottom-right', 'bottom-left'),
          defaultValue: 'bottom-right'
        },
        welcome_message: {
          type: Sequelize.TEXT,
          defaultValue: '👋 ¡Hola! ¿En qué podemos ayudarte?'
        },
        business_hours: {
          type: Sequelize.JSON,
          defaultValue: {
            monday: { open: '09:00', close: '18:00', enabled: true },
            tuesday: { open: '09:00', close: '18:00', enabled: true },
            wednesday: { open: '09:00', close: '18:00', enabled: true },
            thursday: { open: '09:00', close: '18:00', enabled: true },
            friday: { open: '09:00', close: '18:00', enabled: true },
            saturday: { open: '10:00', close: '14:00', enabled: false },
            sunday: { open: '10:00', close: '14:00', enabled: false }
          },
          comment: 'Horarios de atención por día'
        },
        timezone: {
          type: Sequelize.STRING(50),
          defaultValue: 'Europe/Madrid'
        },
        auto_response_enabled: {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
          comment: 'Activar respuestas automáticas'
        },
        capture_leads: {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
          comment: 'Capturar email cuando está fuera de horario'
        },
        allowed_domains: {
          type: Sequelize.JSON,
          defaultValue: [],
          comment: 'Lista de dominios autorizados para el widget'
        },
        iframe_url: {
          type: Sequelize.STRING(500),
          allowNull: true,
          comment: 'URL del iframe para MVP (temporal)'
        },
        max_agents: {
          type: Sequelize.INTEGER,
          defaultValue: 5,
          comment: 'Máximo de agentes permitidos'
        },
        integration_type: {
          type: Sequelize.ENUM('iframe', 'crisp', 'intercom', 'native'),
          defaultValue: 'iframe',
          comment: 'Tipo de integración del chat'
        },
        integration_config: {
          type: Sequelize.JSON,
          defaultValue: {},
          comment: 'Configuración específica de la integración'
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          defaultValue: true
        },
        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });
      
      // 4. Crear tabla de agentes por tenant
      await queryInterface.createTable('tenant_agents', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        tenant_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        agent_name: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        agent_email: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        agent_avatar: {
          type: Sequelize.STRING(500),
          allowNull: true
        },
        status: {
          type: Sequelize.ENUM('active', 'inactive', 'invited'),
          defaultValue: 'invited'
        },
        role: {
          type: Sequelize.ENUM('owner', 'agent', 'agent_readonly'),
          defaultValue: 'agent'
        },
        max_concurrent_chats: {
          type: Sequelize.INTEGER,
          defaultValue: 5
        },
        last_seen_at: {
          type: Sequelize.DATE,
          allowNull: true
        },
        invite_token: {
          type: Sequelize.STRING(100),
          allowNull: true,
          comment: 'Token para aceptar invitación'
        },
        invite_expires_at: {
          type: Sequelize.DATE,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });
      
      // 5. Crear índices para optimizar queries multi-tenant
      await queryInterface.addIndex('chat_conversations', ['tenant_id', 'status', 'updated_at'], {
        name: 'idx_tenant_status_updated',
        transaction
      });
      
      await queryInterface.addIndex('chat_conversations', ['tenant_id', 'session_id'], {
        name: 'idx_tenant_session',
        transaction
      });
      
      await queryInterface.addIndex('chat_messages', ['tenant_id', 'conversation_id', 'created_at'], {
        name: 'idx_tenant_conv_created',
        transaction
      });
      
      await queryInterface.addIndex('tenant_chat_config', ['tenant_id'], {
        name: 'idx_config_tenant',
        unique: true,
        transaction
      });
      
      await queryInterface.addIndex('tenant_agents', ['tenant_id', 'status'], {
        name: 'idx_agents_tenant_status',
        transaction
      });
      
      await queryInterface.addIndex('tenant_agents', ['agent_email'], {
        name: 'idx_agents_email',
        transaction
      });
      
      // 6. Migrar datos existentes: Asignar tenant_id = 1 (tu ecommerce actual)
      // Como es tu primer tenant, asumimos que todo lo existente es del ecommerce principal
      await queryInterface.sequelize.query(
        'UPDATE chat_conversations SET tenant_id = 1 WHERE tenant_id IS NULL',
        { transaction }
      );
      
      await queryInterface.sequelize.query(
        'UPDATE chat_messages SET tenant_id = 1 WHERE tenant_id IS NULL',
        { transaction }
      );
      
      // 7. Crear configuración por defecto para tenant 1
      await queryInterface.bulkInsert('tenant_chat_config', [{
        tenant_id: 1,
        widget_color: '#4F46E5',
        welcome_message: '👋 ¡Hola! ¿En qué podemos ayudarte?',
        auto_response_enabled: true,
        capture_leads: true,
        integration_type: 'native',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }], { transaction });
      
      // 8. Hacer tenant_id obligatorio después de migrar datos
      await queryInterface.changeColumn('chat_conversations', 'tenant_id', {
        type: Sequelize.INTEGER,
        allowNull: false
      }, { transaction });
      
      await queryInterface.changeColumn('chat_messages', 'tenant_id', {
        type: Sequelize.INTEGER,
        allowNull: false
      }, { transaction });
      
      await transaction.commit();
      console.log('✅ Migración multi-tenant completada');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error en migración:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Revertir cambios
      await queryInterface.removeIndex('chat_conversations', 'idx_tenant_status_updated', { transaction });
      await queryInterface.removeIndex('chat_conversations', 'idx_tenant_session', { transaction });
      await queryInterface.removeIndex('chat_messages', 'idx_tenant_conv_created', { transaction });
      
      await queryInterface.dropTable('tenant_agents', { transaction });
      await queryInterface.dropTable('tenant_chat_config', { transaction });
      
      await queryInterface.removeColumn('chat_conversations', 'tenant_id', { transaction });
      await queryInterface.removeColumn('chat_messages', 'tenant_id', { transaction });
      
      await transaction.commit();
      console.log('✅ Rollback multi-tenant completado');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error en rollback:', error);
      throw error;
    }
  }
};
