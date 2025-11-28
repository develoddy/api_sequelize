'use strict';

/**
 * Migration: Create printful_webhook_logs table
 * Tabla para registrar eventos de webhooks recibidos desde Printful
 * 
 * @author Claude (GitHub Copilot)
 * @date 2025-11-28
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('📦 Creando tabla printful_webhook_logs...');
    
    await queryInterface.createTable('printful_webhook_logs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      event_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Tipo de evento (package_shipped, order_failed, order_updated, etc.)'
      },
      order_id: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'ID de la orden en Printful (si aplica)'
      },
      event_data: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: 'Payload completo del webhook recibido desde Printful'
      },
      processed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Indica si el webhook fue procesado exitosamente'
      },
      processing_error: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Mensaje de error si el procesamiento falló'
      },
      received_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'Timestamp de recepción del webhook'
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
    });

    console.log('📌 Creando índices en printful_webhook_logs...');

    // Índice para búsquedas por tipo de evento
    await queryInterface.addIndex('printful_webhook_logs', ['event_type'], {
      name: 'idx_event_type'
    });

    // Índice para búsquedas por order_id
    await queryInterface.addIndex('printful_webhook_logs', ['order_id'], {
      name: 'idx_order_id'
    });

    // Índice para ordenar por fecha de recepción
    await queryInterface.addIndex('printful_webhook_logs', ['received_at'], {
      name: 'idx_received_at'
    });

    // Índice para filtrar por estado de procesamiento
    await queryInterface.addIndex('printful_webhook_logs', ['processed'], {
      name: 'idx_processed'
    });

    // Índice compuesto para queries comunes (evento + fecha)
    await queryInterface.addIndex('printful_webhook_logs', ['event_type', 'received_at'], {
      name: 'idx_event_type_received_at'
    });

    // Índice compuesto para queries de auditoría (procesado + fecha)
    await queryInterface.addIndex('printful_webhook_logs', ['processed', 'received_at'], {
      name: 'idx_processed_received_at'
    });

    console.log('✅ Tabla printful_webhook_logs creada exitosamente');
  },

  async down(queryInterface, Sequelize) {
    console.log('🗑️  Eliminando tabla printful_webhook_logs...');
    await queryInterface.dropTable('printful_webhook_logs');
    console.log('✅ Tabla printful_webhook_logs eliminada');
  }
};
