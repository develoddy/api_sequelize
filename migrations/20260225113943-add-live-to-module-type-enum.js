'use strict';

/**
 * Migration: Add 'live' to module_type ENUM
 * 
 * Expands module_type ENUM from ('landing', 'wizard') to ('landing', 'wizard', 'live')
 * This enables the full MVP progression: landing → wizard → live
 * 
 * @date 2026-02-25
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // MySQL: Modify ENUM by recreating with all values
    await queryInterface.sequelize.query(`
      ALTER TABLE modules 
      MODIFY COLUMN module_type ENUM('landing', 'wizard', 'live') 
      NOT NULL 
      DEFAULT 'wizard' 
      COMMENT 'Validation stage: landing (pain/demand validation), wizard (solution validation), or live (full product)'
    `);

    console.log('✅ Migration: Added "live" to module_type ENUM');
  },

  async down(queryInterface, Sequelize) {
    // Revert to original ENUM ('landing', 'wizard')
    // ⚠️ WARNING: Existing rows with module_type='live' will fail or be truncated
    await queryInterface.sequelize.query(`
      ALTER TABLE modules 
      MODIFY COLUMN module_type ENUM('landing', 'wizard') 
      NOT NULL 
      DEFAULT 'wizard' 
      COMMENT 'Validation stage: landing (pain/demand validation) or wizard (solution validation)'
    `);

    console.log('⚠️ Migration reverted: Removed "live" from module_type ENUM');
  }
};
