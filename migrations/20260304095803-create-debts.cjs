'use strict';

/**
 * Migration: Create debts table
 * 
 * Crea la tabla de deudas para el módulo financiero.
 * Registra y hace seguimiento de todas las deudas del usuario.
 * 
 * @date 2026-03-04
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('debts', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        comment: 'Usuario propietario de la deuda'
      },
      creditor: {
        type: Sequelize.STRING(150),
        allowNull: false,
        comment: 'Nombre del acreedor (banco, persona, empresa)'
      },
      debt_type: {
        type: Sequelize.ENUM('mortgage', 'car_loan', 'personal_loan', 'student_loan', 'credit_card', 'business_loan', 'other'),
        defaultValue: 'other',
        allowNull: false,
        comment: 'Tipo de deuda'
      },
      original_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Monto original de la deuda'
      },
      remaining_balance: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Balance pendiente actual'
      },
      currency: {
        type: Sequelize.STRING(3),
        defaultValue: 'EUR',
        allowNull: false,
        comment: 'Código de moneda ISO 4217'
      },
      interest_rate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Tasa de interés anual (%)'
      },
      monthly_payment: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Pago mensual esperado'
      },
      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'Fecha de inicio de la deuda'
      },
      due_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        comment: 'Fecha estimada de finalización'
      },
      payment_day: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Día del mes para el pago (1-31)'
      },
      status: {
        type: Sequelize.ENUM('active', 'paid_off', 'defaulted', 'refinanced'),
        defaultValue: 'active',
        allowNull: false,
        comment: 'Estado de la deuda'
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
        defaultValue: 'medium',
        allowNull: false,
        comment: 'Prioridad de pago'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Notas adicionales'
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
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      engine: 'InnoDB'
    });

    // Crear índices
    await queryInterface.addIndex('debts', ['user_id'], {
      name: 'idx_debts_user_id'
    });

    await queryInterface.addIndex('debts', ['status'], {
      name: 'idx_debts_status'
    });

    await queryInterface.addIndex('debts', ['debt_type'], {
      name: 'idx_debts_debt_type'
    });

    await queryInterface.addIndex('debts', ['priority'], {
      name: 'idx_debts_priority'
    });

    await queryInterface.addIndex('debts', ['due_date'], {
      name: 'idx_debts_due_date'
    });

    console.log('✅ Migration: Created debts table');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('debts');
    console.log('⚠️ Migration reverted: Dropped debts table');
  }
};
