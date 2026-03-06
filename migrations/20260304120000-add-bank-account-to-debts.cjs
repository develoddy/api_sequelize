'use strict';

/**
 * Migration: Add bank_account_id to debts table
 * 
 * Agrega la columna bank_account_id para asociar cada deuda con
 * la cuenta bancaria desde la que se realiza el pago.
 * 
 * @date 2026-03-04
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('debts', 'bank_account_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'bank_accounts',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
      comment: 'Cuenta bancaria desde la que se paga esta deuda',
      after: 'user_id'
    });

    // Crear índice para mejorar performance en consultas
    await queryInterface.addIndex('debts', ['bank_account_id'], {
      name: 'idx_debts_bank_account_id'
    });

    console.log('✅ Migration: Added bank_account_id to debts table');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('debts', 'idx_debts_bank_account_id');
    await queryInterface.removeColumn('debts', 'bank_account_id');
    console.log('⚠️ Migration reverted: Removed bank_account_id from debts table');
  }
};
