/**
 * Migration: Create product_analytics table
 * 
 * Tabla para métricas de performance por producto.
 * Se actualiza mediante cron jobs diarios.
 * 
 * @sprint Sprint 6E - Analytics & Reporting
 * @date 2025-11-28
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('product_analytics', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
        comment: 'ID único del registro'
      },
      productId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'ID del producto',
        references: {
          model: 'products',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        field: 'productId'
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'Fecha de las métricas'
      },
      unitsSold: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Unidades vendidas',
        field: 'unitsSold'
      },
      revenue: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Revenue generado'
      },
      printfulCost: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Costo Printful',
        field: 'printfulCost'
      },
      profit: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Ganancia neta'
      },
      margin: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Margen en %'
      },
      orderCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Número de órdenes',
        field: 'orderCount'
      },
      failedCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Órdenes fallidas',
        field: 'failedCount'
      },
      avgPrice: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Precio promedio',
        field: 'avgPrice'
      },
      topVariants: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Variantes más vendidas',
        field: 'topVariants'
      },
      customerSegment: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Segmentación clientes',
        field: 'customerSegment'
      },
      conversionRate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Tasa de conversión',
        field: 'conversionRate'
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Datos adicionales'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    }, {
      comment: 'Métricas de performance por producto'
    });

    // Crear índices
    await queryInterface.addIndex('product_analytics', ['productId', 'date'], {
      unique: true,
      name: 'idx_product_analytics_product_date'
    });

    await queryInterface.addIndex('product_analytics', ['date'], {
      name: 'idx_product_analytics_date'
    });

    await queryInterface.addIndex('product_analytics', ['productId'], {
      name: 'idx_product_analytics_product'
    });

    await queryInterface.addIndex('product_analytics', ['revenue'], {
      name: 'idx_product_analytics_revenue'
    });

    await queryInterface.addIndex('product_analytics', ['unitsSold'], {
      name: 'idx_product_analytics_units'
    });

    console.log('✅ Tabla product_analytics creada exitosamente');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('product_analytics');
    console.log('✅ Tabla product_analytics eliminada');
  }
};
