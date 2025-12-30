'use strict';

/**
 * Migration: Add module_id to existing tables
 * Permite asociar productos, ventas y detalles a módulos específicos
 * 
 * IMPORTANTE: Esta migración es OPCIONAL y NO romperá nada existente
 * Los registros sin module_id funcionarán normalmente
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Agregar module_id a products (opcional, permite NULL)
    await queryInterface.addColumn('products', 'module_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'modules',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Reference to modules table (optional)'
    });

    // Agregar module_id a sales (opcional, permite NULL)
    await queryInterface.addColumn('sales', 'module_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'modules',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Reference to modules table (optional)'
    });

    // Agregar module_id a sale_details (opcional, permite NULL)
    await queryInterface.addColumn('sale_details', 'module_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'modules',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Reference to modules table (optional)'
    });

    // Índices para mejorar queries
    await queryInterface.addIndex('products', ['module_id'], {
      name: 'idx_products_module_id'
    });
    
    await queryInterface.addIndex('sales', ['module_id'], {
      name: 'idx_sales_module_id'
    });
    
    await queryInterface.addIndex('sale_details', ['module_id'], {
      name: 'idx_sale_details_module_id'
    });

    console.log('✅ Columna module_id agregada a products, sales y sale_details');
    console.log('ℹ️  Los registros existentes mantienen module_id = NULL y funcionan normalmente');
  },

  async down(queryInterface, Sequelize) {
    // Remover índices
    await queryInterface.removeIndex('products', 'idx_products_module_id');
    await queryInterface.removeIndex('sales', 'idx_sales_module_id');
    await queryInterface.removeIndex('sale_details', 'idx_sale_details_module_id');

    // Remover columnas
    await queryInterface.removeColumn('products', 'module_id');
    await queryInterface.removeColumn('sales', 'module_id');
    await queryInterface.removeColumn('sale_details', 'module_id');

    console.log('✅ Columna module_id removida de products, sales y sale_details');
  }
};
