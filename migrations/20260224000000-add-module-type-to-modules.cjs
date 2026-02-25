'use strict';

/**
 * Migration: Add module_type to modules table
 * 
 * Adds a `module_type` ENUM column to differentiate between:
 *  - 'landing'  → Pain/demand validation (prototype landing pages)
 *  - 'wizard'   → Solution validation (interactive wizard MVPs)
 * 
 * This allows the analytics engine to render appropriate KPIs per stage,
 * replacing the previous hardcoded `key === 'inbox-zero-prevention'` checks.
 * 
 * @date 2026-02-24
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add the column with default 'wizard' (backward-compatible)
    await queryInterface.addColumn('modules', 'module_type', {
      type: Sequelize.ENUM('landing', 'wizard'),
      defaultValue: 'wizard',
      allowNull: false,
      comment: 'Validation stage: landing (pain/demand validation) or wizard (solution validation)',
      after: 'status'
    });

    // 2. Mark existing landing-type modules
    await queryInterface.sequelize.query(`
      UPDATE modules
      SET module_type = 'landing'
      WHERE \`key\` = 'inbox-zero-prevention'
    `);

    console.log('✅ Migration: module_type column added, inbox-zero-prevention set to landing');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('modules', 'module_type');

    // Drop the ENUM type (MySQL requires this)
    await queryInterface.sequelize.query(
      "DROP TYPE IF EXISTS enum_modules_module_type"
    ).catch(() => {
      // Silently ignore if not PostgreSQL
    });
  }
};
