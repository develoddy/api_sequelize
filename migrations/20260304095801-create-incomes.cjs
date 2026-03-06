'use strict';

/**
 * Migration: Create incomes table
 * 
 * Crea la tabla de ingresos para el módulo financiero.
 * Registra todos los ingresos del usuario con categorización y recurrencia.
 * 
 * @date 2026-03-04
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('incomes', {
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
        comment: 'Usuario propietario del ingreso'
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
        comment: 'Cuenta bancaria asociada al ingreso'
      },
      category: {
        type: Sequelize.ENUM('salary', 'freelance', 'investments', 'rental', 'business', 'gifts', 'other'),
        defaultValue: 'other',
        allowNull: false,
        comment: 'Categoría del ingreso'
      },
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Monto del ingreso'
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
        comment: 'Descripción del ingreso'
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'Fecha del ingreso'
      },
      is_recurring: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Indica si es un ingreso recurrente'
      },
      recurrence_type: {
        type: Sequelize.ENUM('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'none'),
        defaultValue: 'none',
        allowNull: false,
        comment: 'Tipo de recurrencia del ingreso'
      },
      tags: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Tags separados por comas para filtrado'
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
    await queryInterface.addIndex('incomes', ['user_id'], {
      name: 'idx_incomes_user_id'
    });

    await queryInterface.addIndex('incomes', ['date'], {
      name: 'idx_incomes_date'
    });

    await queryInterface.addIndex('incomes', ['category'], {
      name: 'idx_incomes_category'
    });

    await queryInterface.addIndex('incomes', ['bank_account_id'], {
      name: 'idx_incomes_bank_account_id'
    });

    await queryInterface.addIndex('incomes', ['user_id', 'date'], {
      name: 'idx_incomes_user_date'
    });

    console.log('✅ Migration: Created incomes table');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('incomes');
    console.log('⚠️ Migration reverted: Dropped incomes table');
  }
};
