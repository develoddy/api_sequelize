/**
 * Migration: Create retry_queue table
 * 
 * Tabla para gestionar la cola de reintentos de órdenes fallidas
 * con sistema de backoff exponencial y clasificación de errores.
 * 
 * @sprint Sprint 6D - Intelligent Error Handling & Recovery
 * @date 2025-11-28
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
  await queryInterface.createTable('retry_queue', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
      comment: 'ID único del job de retry'
    },
    saleId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      comment: 'ID de la venta a reintentar',
      references: {
        model: 'sales',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      field: 'saleId'
    },
    attemptCount: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: 'Número de intentos realizados',
      field: 'attemptCount'
    },
    maxAttempts: {
      type: Sequelize.INTEGER,
      defaultValue: 3,
      allowNull: false,
      comment: 'Máximo de intentos permitidos',
      field: 'maxAttempts'
    },
    nextRetryAt: {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Fecha/hora del próximo intento',
      field: 'nextRetryAt'
    },
    status: {
      type: Sequelize.ENUM('pending', 'processing', 'resolved', 'failed', 'cancelled'),
      defaultValue: 'pending',
      allowNull: false,
      comment: 'Estado actual del job'
    },
    errorType: {
      type: Sequelize.ENUM('temporal', 'recoverable', 'critical', 'unknown'),
      allowNull: false,
      comment: 'Clasificación del error',
      field: 'errorType'
    },
    errorCode: {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Código específico del error',
      field: 'errorCode'
    },
    errorMessage: {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Mensaje de error original',
      field: 'errorMessage'
    },
    errorData: {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Datos adicionales del error (stack, response, etc.)',
      field: 'errorData'
    },
    lastError: {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Último error registrado',
      field: 'lastError'
    },
    retryHistory: {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: '[]',
      comment: 'Historial de todos los intentos con timestamps y resultados',
      field: 'retryHistory'
    },
    resolvedAt: {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Fecha/hora de resolución exitosa',
      field: 'resolvedAt'
    },
    cancelledAt: {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Fecha/hora de cancelación manual',
      field: 'cancelledAt'
    },
    cancelledBy: {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Usuario que canceló el job',
      field: 'cancelledBy'
    },
    cancelReason: {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Razón de cancelación',
      field: 'cancelReason'
    },
    priority: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: 'Prioridad del job (0=normal, 1=alta, -1=baja)'
    },
    metadata: {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Datos adicionales del contexto (customer, amount, etc.)'
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
    comment: 'Cola de reintentos para órdenes fallidas con backoff exponencial'
  });

  // Crear índices para optimizar queries
  await queryInterface.addIndex('retry_queue', ['saleId'], {
    name: 'idx_retry_queue_sale'
  });

  await queryInterface.addIndex('retry_queue', ['status'], {
    name: 'idx_retry_queue_status'
  });

  await queryInterface.addIndex('retry_queue', ['nextRetryAt'], {
    name: 'idx_retry_queue_next_retry'
  });

  await queryInterface.addIndex('retry_queue', ['errorType'], {
    name: 'idx_retry_queue_error_type'
  });

  await queryInterface.addIndex('retry_queue', ['status', 'nextRetryAt'], {
    name: 'idx_retry_queue_processing'
  });

  console.log('✅ Tabla retry_queue creada exitosamente');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('retry_queue');
    console.log('✅ Tabla retry_queue eliminada');
  }
};
