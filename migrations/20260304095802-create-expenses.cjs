'use strict';

/**
 * Migration: Create expenses table
 * 
 * Crea la tabla de gastos para el módulo financiero.
 * Registra todos los gastos del usuario con categorización detallada.
 * 
 * @date 2026-03-04
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('expenses', {
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
        comment: 'Usuario propietario del gasto'
      },
      bank_account_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'bank_accounts',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
        comment: 'Cuenta bancaria desde donde se realizó el gasto'
      },
      category: {
        type: Sequelize.ENUM(
          'housing', 'utilities', 'groceries', 'transport', 'health', 
          'insurance', 'entertainment', 'education', 'clothing', 
          'savings', 'investments', 'debt_payment', 'restaurants', 
          'travel', 'gifts', 'personal_care', 'technology', 'other'
        ),
        defaultValue: 'other',
        allowNull: false,
        comment: 'Categoría del gasto'
      },
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Monto del gasto'
      },
      currency: {
        type: Sequelize.STRING(3),
        defaultValue: 'EUR',
        allowNull: false,
        comment: 'Código de moneda ISO 4217'
      },
      description: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Descripción del gasto'
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'Fecha del gasto'
      },
      is_recurring: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Indica si es un gasto recurrente'
      },
      recurrence_type: {
        type: Sequelize.ENUM('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'none'),
        defaultValue: 'none',
        allowNull: false,
        comment: 'Tipo de recurrencia del gasto'
      },
      is_essential: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Indica si es un gasto esencial (necesidad vs lujo)'
      },
      payment_method: {
        type: Sequelize.ENUM('cash', 'debit_card', 'credit_card', 'bank_transfer', 'other'),
        defaultValue: 'other',
        allowNull: false,
        comment: 'Método de pago utilizado'
      },
      tags: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Tags separados por comas para filtrado'
      },
      receipt_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'URL del recibo/factura digitalizada'
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
    await queryInterface.addIndex('expenses', ['user_id'], {
      name: 'idx_expenses_user_id'
    });

    await queryInterface.addIndex('expenses', ['date'], {
      name: 'idx_expenses_date'
    });

    await queryInterface.addIndex('expenses', ['category'], {
      name: 'idx_expenses_category'
    });

    await queryInterface.addIndex('expenses', ['bank_account_id'], {
      name: 'idx_expenses_bank_account_id'
    });

    await queryInterface.addIndex('expenses', ['is_essential'], {
      name: 'idx_expenses_is_essential'
    });

    await queryInterface.addIndex('expenses', ['user_id', 'date'], {
      name: 'idx_expenses_user_date'
    });

    console.log('✅ Migration: Created expenses table');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('expenses');
    console.log('⚠️ Migration reverted: Dropped expenses table');
  }
};
