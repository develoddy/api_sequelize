'use strict';

/**
 * Migration: Create Tenants table
 * 
 * Tabla para gestionar clientes de micro-SaaS (multi-tenancy)
 * Cada tenant representa un cliente que usa uno de los módulos SaaS
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🚀 Creando tabla tenants...');
    
    try {
      await queryInterface.createTable('tenants', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        
        // Información básica
        name: {
          type: Sequelize.STRING(100),
          allowNull: false,
          comment: 'Nombre del cliente/empresa'
        },
        email: {
          type: Sequelize.STRING(255),
          allowNull: false,
          unique: true,
          comment: 'Email del cliente (único)'
        },
        
        // Relación con módulo SaaS
        module_key: {
          type: Sequelize.STRING(50),
          allowNull: false,
          comment: 'Key del módulo SaaS al que pertenece este tenant'
        },
        
        // Plan y estado
        plan: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'trial',
          comment: 'Plan actual: trial, starter, pro, business, etc.'
        },
        status: {
          type: Sequelize.ENUM('trial', 'active', 'cancelled', 'suspended', 'expired'),
          defaultValue: 'trial',
          allowNull: false,
          comment: 'Estado de la subscripción'
        },
        
        // Trial
        trial_ends_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'Fecha en que expira el trial'
        },
        trial_extended: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          comment: 'Si el trial fue extendido manualmente'
        },
        
        // Billing (Stripe)
        stripe_customer_id: {
          type: Sequelize.STRING(100),
          allowNull: true,
          unique: true,
          comment: 'ID del customer en Stripe'
        },
        stripe_subscription_id: {
          type: Sequelize.STRING(100),
          allowNull: true,
          comment: 'ID de la subscripción activa en Stripe'
        },
        stripe_price_id: {
          type: Sequelize.STRING(100),
          allowNull: true,
          comment: 'ID del price en Stripe (plan seleccionado)'
        },
        
        // Fechas importantes
        subscribed_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'Fecha en que se convirtió de trial a subscripción pagada'
        },
        cancelled_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'Fecha de cancelación'
        },
        subscription_ends_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'Fecha de fin de acceso (para cancelaciones)'
        },
        
        // Configuración y metadata
        settings: {
          type: Sequelize.JSON,
          defaultValue: {},
          comment: 'Configuraciones específicas del tenant'
        },
        metadata: {
          type: Sequelize.JSON,
          defaultValue: {},
          comment: 'Metadata adicional (utm, referrer, etc.)'
        },
        
        // Notas admin
        admin_notes: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Notas internas para el admin'
        },
        
        // Timestamps
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          comment: 'Fecha de creación'
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
          comment: 'Fecha de última actualización'
        }
      });
      
      console.log('✅ Tabla tenants creada');
      
      // Crear índices para optimizar queries
      console.log('📝 Creando índices...');
      
      await queryInterface.addIndex('tenants', ['email'], { 
        unique: true, 
        name: 'idx_tenants_email'
      });
      console.log('✅ Índice en email creado');
      
      await queryInterface.addIndex('tenants', ['module_key'], { 
        name: 'idx_tenants_module_key'
      });
      console.log('✅ Índice en module_key creado');
      
      await queryInterface.addIndex('tenants', ['status'], { 
        name: 'idx_tenants_status'
      });
      console.log('✅ Índice en status creado');
      
      await queryInterface.addIndex('tenants', ['stripe_customer_id'], { 
        name: 'idx_tenants_stripe_customer'
      });
      console.log('✅ Índice en stripe_customer_id creado');
      
      console.log('✅ Migración completada exitosamente');
      
    } catch (error) {
      console.error('❌ Error en migración:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('⏪ Eliminando tabla tenants...');
    
    try {
      await queryInterface.dropTable('tenants');
      console.log('✅ Tabla tenants eliminada');
      console.log('✅ Rollback completado');
      
    } catch (error) {
      console.error('❌ Error en rollback:', error);
      throw error;
    }
  }
};
