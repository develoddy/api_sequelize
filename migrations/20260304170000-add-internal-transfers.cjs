'use strict';

/**
 * Migration: Add Internal Transfers Support
 * 
 * Añade soporte para transferencias internas entre cuentas del mismo usuario:
 * - Añade 'internal_transfer' a ENUM de category en expenses e incomes
 * - Añade target_account_id a expenses (cuenta destino de la transferencia)
 * - Añade source_account_id a incomes (cuenta origen de la transferencia)
 * - Añade linked_transaction_id a ambas tablas (vincular expense con income)
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1️⃣ Actualizar ENUM de category en expenses
    await queryInterface.sequelize.query(`
      ALTER TABLE expenses 
      MODIFY COLUMN category ENUM(
        'housing', 'utilities', 'groceries', 'transport', 'health', 
        'insurance', 'entertainment', 'education', 'clothing', 
        'savings', 'investments', 'debt_payment', 'restaurants', 
        'travel', 'gifts', 'personal_care', 'technology', 
        'internal_transfer', 'other'
      ) NOT NULL DEFAULT 'other' 
      COMMENT 'Categoría del gasto'
    `);

    // 2️⃣ Añadir target_account_id a expenses (cuenta destino)
    await queryInterface.addColumn('expenses', 'target_account_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'bank_accounts',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
      comment: 'Cuenta destino en transferencias internas'
    });

    // 3️⃣ Añadir linked_transaction_id a expenses
    await queryInterface.addColumn('expenses', 'linked_transaction_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'ID del income vinculado en transferencias internas'
    });

    // 4️⃣ Crear índices en expenses
    await queryInterface.addIndex('expenses', ['target_account_id'], {
      name: 'idx_expenses_target_account_id'
    });

    await queryInterface.addIndex('expenses', ['linked_transaction_id'], {
      name: 'idx_expenses_linked_transaction_id'
    });

    // 5️⃣ Actualizar ENUM de category en incomes
    await queryInterface.sequelize.query(`
      ALTER TABLE incomes 
      MODIFY COLUMN category ENUM(
        'salary', 'freelance', 'investments', 'rental', 
        'business', 'gifts', 'internal_transfer', 'other'
      ) NOT NULL DEFAULT 'other' 
      COMMENT 'Categoría del ingreso'
    `);

    // 6️⃣ Añadir source_account_id a incomes (cuenta origen)
    await queryInterface.addColumn('incomes', 'source_account_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'bank_accounts',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
      comment: 'Cuenta origen en transferencias internas'
    });

    // 7️⃣ Añadir linked_transaction_id a incomes
    await queryInterface.addColumn('incomes', 'linked_transaction_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'ID del expense vinculado en transferencias internas'
    });

    // 8️⃣ Crear índices en incomes
    await queryInterface.addIndex('incomes', ['source_account_id'], {
      name: 'idx_incomes_source_account_id'
    });

    await queryInterface.addIndex('incomes', ['linked_transaction_id'], {
      name: 'idx_incomes_linked_transaction_id'
    });

    console.log('✅ Migration: Added internal transfers support');
  },

  async down(queryInterface, Sequelize) {
    // Revertir en orden inverso
    
    // Eliminar índices de incomes
    await queryInterface.removeIndex('incomes', 'idx_incomes_linked_transaction_id');
    await queryInterface.removeIndex('incomes', 'idx_incomes_source_account_id');
    
    // Eliminar columnas de incomes
    await queryInterface.removeColumn('incomes', 'linked_transaction_id');
    await queryInterface.removeColumn('incomes', 'source_account_id');
    
    // Revertir ENUM de incomes
    await queryInterface.sequelize.query(`
      ALTER TABLE incomes 
      MODIFY COLUMN category ENUM(
        'salary', 'freelance', 'investments', 'rental', 
        'business', 'gifts', 'other'
      ) NOT NULL DEFAULT 'other'
    `);
    
    // Eliminar índices de expenses
    await queryInterface.removeIndex('expenses', 'idx_expenses_linked_transaction_id');
    await queryInterface.removeIndex('expenses', 'idx_expenses_target_account_id');
    
    // Eliminar columnas de expenses
    await queryInterface.removeColumn('expenses', 'linked_transaction_id');
    await queryInterface.removeColumn('expenses', 'target_account_id');
    
    // Revertir ENUM de expenses
    await queryInterface.sequelize.query(`
      ALTER TABLE expenses 
      MODIFY COLUMN category ENUM(
        'housing', 'utilities', 'groceries', 'transport', 'health', 
        'insurance', 'entertainment', 'education', 'clothing', 
        'savings', 'investments', 'debt_payment', 'restaurants', 
        'travel', 'gifts', 'personal_care', 'technology', 'other'
      ) NOT NULL DEFAULT 'other'
    `);

    console.log('✅ Migration reverted: Removed internal transfers support');
  }
};
