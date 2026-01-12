'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Eliminar índice único de email
    await queryInterface.removeIndex('tenants', 'email');
    
    // 2. Crear índice único compuesto de email + module_key
    await queryInterface.addIndex('tenants', ['email', 'module_key'], {
      unique: true,
      name: 'unique_email_module'
    });
    
    console.log('✅ Migración completada: email + module_key ahora son unique compuesto');
  },

  down: async (queryInterface, Sequelize) => {
    // Revertir: eliminar índice compuesto y recrear el simple
    await queryInterface.removeIndex('tenants', 'unique_email_module');
    await queryInterface.addIndex('tenants', ['email'], {
      unique: true
    });
    
    console.log('✅ Migración revertida: email vuelve a ser unique simple');
  }
};
