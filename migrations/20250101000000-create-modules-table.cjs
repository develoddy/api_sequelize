'use strict';

/**
 * Migration: Create modules table
 * Sistema multi-módulo estilo Levels para validar ideas rápidamente
 * 
 * Filosofía:
 * - Cada idea = módulo activable
 * - Validación: X ventas en Y días o KILL
 * - Una DB, un dominio, múltiples experimentos
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('modules', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      key: {
        type: Sequelize.STRING(50),
        unique: true,
        allowNull: false,
        comment: 'Unique identifier: printful, digital-products, etc'
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Display name: Printful POD, Digital Downloads'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Brief description of the module'
      },
      type: {
        type: Sequelize.ENUM('physical', 'digital', 'service', 'integration'),
        defaultValue: 'physical',
        allowNull: false,
        comment: 'Type of module/product'
      },
      
      // Estado y validación
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Module is live and accepting orders'
      },
      status: {
        type: Sequelize.ENUM('draft', 'testing', 'live', 'archived'),
        defaultValue: 'draft',
        allowNull: false,
        comment: 'Current lifecycle status'
      },
      
      // Métricas de validación Levels-style
      validation_days: {
        type: Sequelize.INTEGER,
        defaultValue: 14,
        allowNull: false,
        comment: 'Days to validate the idea'
      },
      validation_target_sales: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        allowNull: false,
        comment: 'Minimum sales to validate'
      },
      launched_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When module was activated'
      },
      validated_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When module reached validation target'
      },
      archived_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When module was archived/killed'
      },
      
      // Configuración
      config: {
        type: Sequelize.JSON,
        defaultValue: {},
        allowNull: true,
        comment: 'Module-specific configuration'
      },
      icon: {
        type: Sequelize.STRING(50),
        defaultValue: 'fa-cube',
        allowNull: false,
        comment: 'FontAwesome icon class'
      },
      color: {
        type: Sequelize.STRING(20),
        defaultValue: 'primary',
        allowNull: false,
        comment: 'Bootstrap color class'
      },
      
      // Pricing
      base_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Base price if applicable'
      },
      currency: {
        type: Sequelize.STRING(3),
        defaultValue: 'EUR',
        allowNull: false
      },
      
      // Tracking automático
      total_sales: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: 'Total number of sales'
      },
      total_revenue: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00,
        allowNull: false,
        comment: 'Total revenue generated'
      },
      total_orders: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: 'Total number of orders'
      },
      last_sale_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Last sale timestamp'
      },
      
      // Timestamps
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      comment: 'Multi-module system for rapid idea validation (Levels-style)'
    });

    // Índices para performance
    await queryInterface.addIndex('modules', ['key'], {
      name: 'idx_modules_key',
      unique: true
    });
    
    await queryInterface.addIndex('modules', ['is_active'], {
      name: 'idx_modules_active'
    });
    
    await queryInterface.addIndex('modules', ['status'], {
      name: 'idx_modules_status'
    });
    
    await queryInterface.addIndex('modules', ['type'], {
      name: 'idx_modules_type'
    });

    console.log('✅ Tabla modules creada exitosamente');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('modules');
    console.log('✅ Tabla modules eliminada');
  }
};
