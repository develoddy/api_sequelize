/**
 * Migration: Create analytics_cache table
 * 
 * Tabla para cachear métricas agregadas del dashboard.
 * Se actualiza mediante cron jobs diarios.
 * 
 * @sprint Sprint 6E - Analytics & Reporting
 * @date 2025-11-28
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('analytics_cache', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
        comment: 'ID único del registro de analytics'
      },
      metricType: {
        type: Sequelize.ENUM('daily', 'weekly', 'monthly', 'yearly'),
        allowNull: false,
        comment: 'Tipo de agregación temporal',
        field: 'metricType'
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'Fecha de la métrica (inicio del período)'
      },
      revenue: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Revenue total del período'
      },
      costs: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Costos totales Printful'
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
        comment: 'Margen de ganancia en %'
      },
      orderCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Total de órdenes',
        field: 'orderCount'
      },
      syncedCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Órdenes sincronizadas',
        field: 'syncedCount'
      },
      pendingCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Órdenes pendientes',
        field: 'pendingCount'
      },
      shippedCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Órdenes enviadas',
        field: 'shippedCount'
      },
      deliveredCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Órdenes entregadas',
        field: 'deliveredCount'
      },
      failedCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Órdenes fallidas',
        field: 'failedCount'
      },
      successRate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Tasa de éxito en %',
        field: 'successRate'
      },
      avgFulfillmentTime: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Tiempo promedio fulfillment (horas)',
        field: 'avgFulfillmentTime'
      },
      productCosts: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Desglose de costos por producto',
        field: 'productCosts'
      },
      shippingCosts: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Costos de envío',
        field: 'shippingCosts'
      },
      avgOrderValue: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'AOV - Valor promedio de orden',
        field: 'avgOrderValue'
      },
      customerStats: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Estadísticas de clientes',
        field: 'customerStats'
      },
      paymentMethods: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Revenue por método de pago',
        field: 'paymentMethods'
      },
      topProducts: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Top 10 productos',
        field: 'topProducts'
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
      comment: 'Cache de métricas agregadas para analytics dashboard'
    });

    // Crear índices
    await queryInterface.addIndex('analytics_cache', ['metricType', 'date'], {
      unique: true,
      name: 'idx_analytics_metric_date'
    });

    await queryInterface.addIndex('analytics_cache', ['date'], {
      name: 'idx_analytics_date'
    });

    await queryInterface.addIndex('analytics_cache', ['metricType'], {
      name: 'idx_analytics_type'
    });

    await queryInterface.addIndex('analytics_cache', ['date', 'metricType'], {
      name: 'idx_analytics_date_type'
    });

    console.log('✅ Tabla analytics_cache creada exitosamente');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('analytics_cache');
    console.log('✅ Tabla analytics_cache eliminada');
  }
};
