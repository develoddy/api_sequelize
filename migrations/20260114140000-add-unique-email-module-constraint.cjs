'use strict';

/**
 * Migration: Add unique constraint for email+module_key in tenants
 * 
 * Previene que un usuario registre múltiples tenants con el mismo email en el mismo módulo
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔒 Agregando constraint UNIQUE para email+module_key...');
    
    try {
      // Primero, eliminar duplicados si existen
      await queryInterface.sequelize.query(`
        DELETE t1 FROM tenants t1
        INNER JOIN tenants t2 
        WHERE t1.id > t2.id 
        AND t1.email = t2.email 
        AND t1.module_key = t2.module_key;
      `);
      
      console.log('✅ Duplicados eliminados (si existían)');
      
      // Agregar índice único compuesto
      await queryInterface.addIndex('tenants', ['email', 'module_key'], {
        name: 'unique_email_module_key',
        unique: true
      });
      
      console.log('✅ Constraint UNIQUE agregado exitosamente');
      
    } catch (error) {
      console.error('❌ Error en migración:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Eliminando constraint UNIQUE...');
    await queryInterface.removeIndex('tenants', 'unique_email_module_key');
    console.log('✅ Constraint UNIQUE eliminado');
  }
};
