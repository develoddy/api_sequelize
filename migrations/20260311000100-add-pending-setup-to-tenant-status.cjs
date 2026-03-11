'use strict';

/**
 * Migration: Add 'pending_setup' to tenant status ENUM
 * 
 * Expands status ENUM to include 'pending_setup' as the initial state
 * before tenant configuration is complete.
 * 
 * Flow: pending_setup → trial → active → cancelled/suspended/expired
 * 
 * @date 2026-03-11
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // MySQL: Modify ENUM by recreating with all values including new 'pending_setup'
    await queryInterface.sequelize.query(`
      ALTER TABLE tenants 
      MODIFY COLUMN status ENUM('pending_setup', 'trial', 'active', 'cancelled', 'suspended', 'expired') 
      NOT NULL 
      DEFAULT 'pending_setup' 
      COMMENT 'Estado del tenant: pending_setup (requiere configuración) → trial (periodo prueba) → active (cliente pagando)'
    `);

    console.log('✅ Migration: Added "pending_setup" to tenant status ENUM');
    console.log('   New flow: pending_setup → trial → active');
  },

  async down(queryInterface, Sequelize) {
    // Revert to original ENUM without 'pending_setup'
    // ⚠️ WARNING: Existing tenants with status='pending_setup' must be updated first
    // Update any pending_setup tenants to trial before reverting
    await queryInterface.sequelize.query(`
      UPDATE tenants 
      SET status = 'trial' 
      WHERE status = 'pending_setup'
    `);
    
    await queryInterface.sequelize.query(`
      ALTER TABLE tenants 
      MODIFY COLUMN status ENUM('trial', 'active', 'cancelled', 'suspended', 'expired') 
      NOT NULL 
      DEFAULT 'trial'
    `);

    console.log('⚠️ Migration reverted: Removed "pending_setup" from tenant status ENUM');
    console.log('   All pending_setup tenants were converted to trial');
  }
};
