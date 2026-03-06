'use strict';

/**
 * Migration: Create bank_accounts table
 * 
 * Crea la tabla de cuentas bancarias para el módulo financiero.
 * Almacena información de cuentas bancarias con soporte multi-moneda.
 * 
 * @date 2026-03-04
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('bank_accounts', {
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
        comment: 'Usuario propietario de la cuenta'
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Nombre de la cuenta (ej: Cuenta corriente, Ahorros)'
      },
      bank_name: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Nombre del banco'
      },
      account_type: {
        type: Sequelize.ENUM('checking', 'savings', 'credit', 'investment', 'other'),
        defaultValue: 'checking',
        allowNull: false,
        comment: 'Tipo de cuenta bancaria'
      },
      balance: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0.00,
        allowNull: false,
        comment: 'Balance actual de la cuenta'
      },
      currency: {
        type: Sequelize.STRING(3),
        defaultValue: 'EUR',
        allowNull: false,
        comment: 'Código de moneda ISO 4217'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Indica si la cuenta está activa'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Notas adicionales sobre la cuenta'
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
    await queryInterface.addIndex('bank_accounts', ['user_id'], {
      name: 'idx_bank_accounts_user_id'
    });

    await queryInterface.addIndex('bank_accounts', ['is_active'], {
      name: 'idx_bank_accounts_is_active'
    });

    console.log('✅ Migration: Created bank_accounts table');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('bank_accounts');
    console.log('⚠️ Migration reverted: Dropped bank_accounts table');
  }
};
