/**
 * Migration: Create tracking_events table
 * 
 * Tabla para almacenar eventos de tracking del funnel.
 * Permite medir conversión desde preview hasta activación.
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('tracking_events', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      
      // Datos del evento
      event: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Nombre del evento (wizard_step_completed, preview_generated, etc.)'
      },
      
      properties: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'JSON con propiedades adicionales del evento'
      },
      
      // Identificación
      sessionId: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'ID de sesión anónima (sessionStorage)',
        field: 'session_id'
      },
      
      userId: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'ID del usuario si está autenticado',
        field: 'user_id'
      },
      
      tenantId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'ID del tenant si está autenticado',
        field: 'tenant_id'
      },
      
      // Contexto
      module: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Módulo asociado (mailflow, etc.)'
      },
      
      source: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Origen del evento (preview, onboarding, dashboard)'
      },
      
      // Metadata técnica
      userAgent: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'User agent del navegador',
        field: 'user_agent'
      },
      
      ipAddress: {
        type: Sequelize.STRING(45),
        allowNull: true,
        comment: 'IP del usuario',
        field: 'ip_address'
      },
      
      // Timestamps
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'Timestamp del evento'
      },
      
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'created_at'
      }
    });
    
    // Índices para optimizar queries
    await queryInterface.addIndex('tracking_events', ['event'], {
      name: 'idx_tracking_events_event'
    });
    
    await queryInterface.addIndex('tracking_events', ['session_id'], {
      name: 'idx_tracking_events_session_id'
    });
    
    await queryInterface.addIndex('tracking_events', ['user_id'], {
      name: 'idx_tracking_events_user_id'
    });
    
    await queryInterface.addIndex('tracking_events', ['tenant_id'], {
      name: 'idx_tracking_events_tenant_id'
    });
    
    await queryInterface.addIndex('tracking_events', ['module'], {
      name: 'idx_tracking_events_module'
    });
    
    await queryInterface.addIndex('tracking_events', ['timestamp'], {
      name: 'idx_tracking_events_timestamp'
    });
    
    console.log('✅ Migration: tracking_events table created successfully');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('tracking_events');
    console.log('✅ Migration: tracking_events table dropped successfully');
  }
};
