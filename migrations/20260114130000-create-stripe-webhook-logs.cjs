'use strict';

/**
 * Migration: Create stripe_webhook_logs table
 * 
 * Tabla para logging y monitoreo de webhooks de Stripe
 * Permite auditar y debuggear eventos de subscripciones SaaS
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🚀 Creando tabla stripe_webhook_logs...');
    
    try {
      await queryInterface.createTable('stripe_webhook_logs', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        
        // Información del evento
        event_id: {
          type: Sequelize.STRING(255),
          allowNull: false,
          unique: true,
          comment: 'ID único del evento de Stripe (evt_xxx)'
        },
        
        event_type: {
          type: Sequelize.STRING(100),
          allowNull: false,
          comment: 'Tipo de evento (checkout.session.completed, invoice.paid, etc.)'
        },
        
        // Datos del evento
        payload: {
          type: Sequelize.TEXT('long'),
          allowNull: true,
          comment: 'JSON completo del evento de Stripe'
        },
        
        // Metadata relevante
        tenant_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: 'ID del tenant relacionado (si aplica)'
        },
        
        subscription_id: {
          type: Sequelize.STRING(255),
          allowNull: true,
          comment: 'ID de subscripción de Stripe (sub_xxx)'
        },
        
        customer_id: {
          type: Sequelize.STRING(255),
          allowNull: true,
          comment: 'ID de customer de Stripe (cus_xxx)'
        },
        
        // Estado del procesamiento
        status: {
          type: Sequelize.ENUM('pending', 'processing', 'success', 'failed'),
          defaultValue: 'pending',
          allowNull: false,
          comment: 'Estado del procesamiento del webhook'
        },
        
        // Resultado
        response_message: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Mensaje de respuesta o error'
        },
        
        retry_count: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
          comment: 'Número de reintentos'
        },
        
        // Timestamps
        received_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW,
          comment: 'Cuándo se recibió el webhook'
        },
        
        processed_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'Cuándo se procesó exitosamente'
        },
        
        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        },
        
        updated_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW,
          onUpdate: Sequelize.NOW
        }
      });
      
      console.log('📊 Creando índices en stripe_webhook_logs...');
      
      // Índices para búsqueda eficiente
      await queryInterface.addIndex('stripe_webhook_logs', ['event_id'], {
        name: 'idx_stripe_webhook_logs_event_id'
      });
      
      await queryInterface.addIndex('stripe_webhook_logs', ['event_type'], {
        name: 'idx_stripe_webhook_logs_event_type'
      });
      
      await queryInterface.addIndex('stripe_webhook_logs', ['tenant_id'], {
        name: 'idx_stripe_webhook_logs_tenant_id'
      });
      
      await queryInterface.addIndex('stripe_webhook_logs', ['subscription_id'], {
        name: 'idx_stripe_webhook_logs_subscription_id'
      });
      
      await queryInterface.addIndex('stripe_webhook_logs', ['status'], {
        name: 'idx_stripe_webhook_logs_status'
      });
      
      await queryInterface.addIndex('stripe_webhook_logs', ['received_at'], {
        name: 'idx_stripe_webhook_logs_received_at'
      });
      
      console.log('✅ Tabla stripe_webhook_logs creada exitosamente');
      
    } catch (error) {
      console.error('❌ Error en migración stripe_webhook_logs:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Eliminando tabla stripe_webhook_logs...');
    await queryInterface.dropTable('stripe_webhook_logs');
    console.log('✅ Tabla stripe_webhook_logs eliminada');
  }
};
