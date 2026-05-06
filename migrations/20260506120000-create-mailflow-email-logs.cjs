'use strict';

/**
 * Migration: Create mailflow_email_logs table
 * Author: MailFlow Production System
 * Date: 2026-05-06
 * Purpose: Logging completo de envíos SMTP para prevención de duplicados, reintentos y auditoría
 * 
 * Registra TODOS los intentos de envío de emails (exitosos y fallidos)
 * CRÍTICO para:
 * - Auditoría completa de envíos
 * - Prevención de duplicados (idempotencia)
 * - Sistema de reintentos automáticos
 * - Debugging de problemas SMTP
 * - Análisis de tasas de fallo
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Crear tabla sin foreign keys primero
    await queryInterface.createTable('mailflow_email_logs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      sequenceId: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'ID de la secuencia'
      },
      contactId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'ID del contacto'
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Email del destinatario (desnormalizado)'
      },
      emailIndex: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Índice del email en la secuencia (0-based)'
      },
      subject: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Subject del email enviado'
      },
      status: {
        type: Sequelize.ENUM('sent', 'failed', 'retry'),
        allowNull: false,
        comment: 'Estado del envío'
      },
      attemptNumber: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        comment: 'Número de intento (para reintentos)'
      },
      smtpMessageId: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Message ID devuelto por SMTP (si exitoso)'
      },
      smtpResponse: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Respuesta completa del servidor SMTP'
      },
      errorCode: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Código de error SMTP (si falló)'
      },
      errorMessage: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Mensaje de error detallado (si falló)'
      },
      sentAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'Timestamp del intento de envío'
      },
      retryAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp para próximo reintento (si aplica)'
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Datos adicionales (IP, user agent, etc.)'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Agregar foreign keys después de crear la tabla
    await queryInterface.addConstraint('mailflow_email_logs', {
      fields: ['sequenceId'],
      type: 'foreign key',
      name: 'fk_emaillog_sequence',
      references: {
        table: 'mailflow_sequences',
        field: 'sequenceId'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('mailflow_email_logs', {
      fields: ['contactId'],
      type: 'foreign key',
      name: 'fk_emaillog_contact',
      references: {
        table: 'mailflow_contacts',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Crear índices para optimización de queries
    await queryInterface.addIndex('mailflow_email_logs', ['sequenceId'], {
      name: 'idx_sequenceId'
    });

    await queryInterface.addIndex('mailflow_email_logs', ['contactId'], {
      name: 'idx_contactId'
    });

    await queryInterface.addIndex('mailflow_email_logs', ['email'], {
      name: 'idx_email'
    });

    await queryInterface.addIndex('mailflow_email_logs', ['status'], {
      name: 'idx_status'
    });

    await queryInterface.addIndex('mailflow_email_logs', ['sentAt'], {
      name: 'idx_sentAt'
    });

    await queryInterface.addIndex('mailflow_email_logs', ['emailIndex'], {
      name: 'idx_emailIndex'
    });

    // Índice compuesto para prevención de duplicados
    await queryInterface.addIndex('mailflow_email_logs', ['contactId', 'emailIndex', 'status'], {
      name: 'idx_duplicate_check'
    });

    // Índice para búsqueda de reintentos pendientes
    await queryInterface.addIndex('mailflow_email_logs', ['status', 'retryAt'], {
      name: 'idx_retry_lookup'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('mailflow_email_logs');
  }
};
