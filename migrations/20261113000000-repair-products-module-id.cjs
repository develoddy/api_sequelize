'use strict';

/**
 * Repair products.module_id when the historical migration is
 * registered but the database schema is incomplete.
 *
 * Non-destructive: preserves existing products and relationships.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('products');

    if (!table.module_id) {
      await queryInterface.addColumn('products', 'module_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Reference to modules table (optional)'
      });
      console.log('Added products.module_id');
    } else {
      if (
        !/^int(?:eger)?\b/i.test(table.module_id.type) ||
        table.module_id.allowNull !== true
      ) {
        throw new Error(
          'products.module_id exists with an unexpected definition'
        );
      }
      console.log('products.module_id already exists');
    }

    const indexes = await queryInterface.showIndex('products');
    const namedIndex = indexes.find(
      index => index.name === 'idx_products_module_id'
    );

    if (!namedIndex) {
      await queryInterface.addIndex('products', ['module_id'], {
        name: 'idx_products_module_id'
      });
      console.log('Added idx_products_module_id');
    } else {
      const fields = namedIndex.fields.map(field => field.attribute);
      if (fields.length !== 1 || fields[0] !== 'module_id') {
        throw new Error('idx_products_module_id has unexpected fields');
      }
      console.log('idx_products_module_id already exists');
    }

    const [foreignKeys] = await queryInterface.sequelize.query(`
      SELECT
        k.CONSTRAINT_NAME,
        k.REFERENCED_TABLE_NAME,
        k.REFERENCED_COLUMN_NAME,
        r.UPDATE_RULE,
        r.DELETE_RULE
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
      JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS r
        ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
       AND r.TABLE_NAME = k.TABLE_NAME
       AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
      WHERE k.TABLE_SCHEMA = DATABASE()
        AND k.TABLE_NAME = 'products'
        AND k.COLUMN_NAME = 'module_id'
        AND k.REFERENCED_TABLE_NAME IS NOT NULL
    `);

    if (foreignKeys.length === 0) {
      await queryInterface.addConstraint('products', {
        fields: ['module_id'],
        type: 'foreign key',
        name: 'fk_products_module_id',
        references: {
          table: 'modules',
          field: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
      console.log('Added fk_products_module_id');
    } else {
      const valid = foreignKeys.length === 1 &&
        foreignKeys[0].REFERENCED_TABLE_NAME === 'modules' &&
        foreignKeys[0].REFERENCED_COLUMN_NAME === 'id' &&
        foreignKeys[0].UPDATE_RULE === 'CASCADE' &&
        foreignKeys[0].DELETE_RULE === 'SET NULL';

      if (!valid) {
        throw new Error(
          'products.module_id has an unexpected foreign key'
        );
      }

      console.log('products.module_id foreign key already exists');
    }
  },

  async down() {
    // Intentionally non-destructive.
    // This migration repairs an existing schema contract.
    // Removing the column could destroy pre-existing relationships.
    console.log('No rollback: products.module_id is preserved');
  }
};
