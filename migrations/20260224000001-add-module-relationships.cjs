'use strict';

/**
 * Migration: Add Module Relationships for MVP Phase Tracking
 * 
 * Adds fields to support multi-phase MVP validation:
 * - parent_module_id: Links phases (landing → wizard → live)
 * - concept_name: Groups related module phases
 * - phase_order: 0=landing, 1=wizard, 2=live
 * 
 * This allows tracking:
 * - inbox-zero-prevention (landing, phase 0)
 * - inbox-zero-prevention-wizard (wizard, phase 1, parent: landing)
 * - inbox-zero-prevention-live (live, phase 2, parent: wizard)
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Helper function to check if column exists
    const columnExists = async (tableName, columnName) => {
      const [results] = await queryInterface.sequelize.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = '${tableName}' 
        AND COLUMN_NAME = '${columnName}'
      `);
      return results.length > 0;
    };

    // Helper function to check if index exists
    const indexExists = async (tableName, indexName) => {
      const [results] = await queryInterface.sequelize.query(`
        SELECT INDEX_NAME 
        FROM INFORMATION_SCHEMA.STATISTICS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = '${tableName}' 
        AND INDEX_NAME = '${indexName}'
      `);
      return results.length > 0;
    };

    // Add parent_module_id for phase relationships
    if (!(await columnExists('modules', 'parent_module_id'))) {
      await queryInterface.addColumn('modules', 'parent_module_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'modules',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'References parent module for phase progression (landing → wizard → live)'
      });
      console.log('✅ Added parent_module_id column');
    } else {
      console.log('ℹ️  parent_module_id column already exists');
    }

    // Add concept_name for grouping related phases
    if (!(await columnExists('modules', 'concept_name'))) {
      await queryInterface.addColumn('modules', 'concept_name', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Base concept name without phase suffix (e.g., "inbox-zero-prevention")'
      });
      console.log('✅ Added concept_name column');
    } else {
      console.log('ℹ️  concept_name column already exists');
    }

    // Add phase_order for sorting phases
    if (!(await columnExists('modules', 'phase_order'))) {
      await queryInterface.addColumn('modules', 'phase_order', {
        type: Sequelize.TINYINT,
        defaultValue: 0,
        allowNull: false,
        comment: 'Phase order: 0=landing, 1=wizard, 2=live'
      });
      console.log('✅ Added phase_order column');
    } else {
      console.log('ℹ️  phase_order column already exists');
    }

    // Add index for concept_name queries
    if (!(await indexExists('modules', 'idx_modules_concept_name'))) {
      await queryInterface.addIndex('modules', ['concept_name'], {
        name: 'idx_modules_concept_name'
      });
      console.log('✅ Added idx_modules_concept_name index');
    } else {
      console.log('ℹ️  idx_modules_concept_name index already exists');
    }

    // Add composite index for concept + phase queries
    if (!(await indexExists('modules', 'idx_modules_concept_phase'))) {
      await queryInterface.addIndex('modules', ['concept_name', 'phase_order'], {
        name: 'idx_modules_concept_phase'
      });
      console.log('✅ Added idx_modules_concept_phase index');
    } else {
      console.log('ℹ️  idx_modules_concept_phase index already exists');
    }

    // Update existing modules with their concept_name (derive from key)
    // For most modules, concept_name = key (unless it has a phase suffix)
    await queryInterface.sequelize.query(`
      UPDATE modules 
      SET concept_name = CASE
        WHEN \`key\` LIKE '%-landing' THEN SUBSTRING(\`key\`, 1, LENGTH(\`key\`) - 8)
        WHEN \`key\` LIKE '%-wizard' THEN SUBSTRING(\`key\`, 1, LENGTH(\`key\`) - 7)
        WHEN \`key\` LIKE '%-live' THEN SUBSTRING(\`key\`, 1, LENGTH(\`key\`) - 5)
        ELSE \`key\`
      END
      WHERE concept_name IS NULL
    `);
    console.log('✅ Updated concept_name for existing modules');

    // Update phase_order based on module_type
    await queryInterface.sequelize.query(`
      UPDATE modules 
      SET phase_order = CASE
        WHEN module_type = 'landing' THEN 0
        WHEN module_type = 'wizard' THEN 1
        WHEN module_type = 'live' THEN 2
        ELSE 1
      END
    `);
    console.log('✅ Updated phase_order for existing modules');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes first
    await queryInterface.removeIndex('modules', 'idx_modules_concept_phase');
    await queryInterface.removeIndex('modules', 'idx_modules_concept_name');

    // Remove columns
    await queryInterface.removeColumn('modules', 'phase_order');
    await queryInterface.removeColumn('modules', 'concept_name');
    await queryInterface.removeColumn('modules', 'parent_module_id');
  }
};
