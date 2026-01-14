'use strict';

/**
 * Migration: Create tenant_notes table
 * 
 * Tabla para gestionar notas administrativas sobre tenants
 * Permite a los admins registrar interacciones, issues, y seguimiento
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🚀 Creando tabla tenant_notes...');
    
    try {
      await queryInterface.createTable('tenant_notes', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        
        // Relación con tenant
        tenant_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'tenants',
            key: 'id'
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          comment: 'ID del tenant'
        },
        
        // Contenido de la nota
        note: {
          type: Sequelize.TEXT,
          allowNull: false,
          comment: 'Contenido de la nota'
        },
        
        // Tipo de nota
        note_type: {
          type: Sequelize.ENUM('general', 'support', 'billing', 'technical', 'cancellation'),
          defaultValue: 'general',
          allowNull: false,
          comment: 'Categoría de la nota'
        },
        
        // Autor
        created_by: {
          type: Sequelize.STRING(100),
          defaultValue: 'admin',
          allowNull: false,
          comment: 'Email o nombre del admin que creó la nota'
        },
        
        // Importancia
        is_important: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false,
          comment: 'Marcar como nota importante'
        },
        
        // Timestamps
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          comment: 'Fecha de creación'
        }
      });

      // Crear índices
      console.log('📊 Creando índices en tenant_notes...');
      
      await queryInterface.addIndex('tenant_notes', ['tenant_id'], {
        name: 'idx_tenant_notes_tenant_id'
      });
      
      await queryInterface.addIndex('tenant_notes', ['created_at'], {
        name: 'idx_tenant_notes_created_at'
      });
      
      await queryInterface.addIndex('tenant_notes', ['note_type'], {
        name: 'idx_tenant_notes_type'
      });
      
      await queryInterface.addIndex('tenant_notes', ['is_important'], {
        name: 'idx_tenant_notes_important'
      });

      console.log('✅ Tabla tenant_notes creada exitosamente');
      return Promise.resolve();
      
    } catch (error) {
      console.error('❌ Error creando tabla tenant_notes:', error);
      return Promise.reject(error);
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Eliminando tabla tenant_notes...');
    
    try {
      await queryInterface.dropTable('tenant_notes');
      console.log('✅ Tabla tenant_notes eliminada exitosamente');
      return Promise.resolve();
      
    } catch (error) {
      console.error('❌ Error eliminando tabla tenant_notes:', error);
      return Promise.reject(error);
    }
  }
};
