'use strict';

/**
 * Migration: Add password field to tenants table
 * 
 * Agrega el campo password para autenticación de tenants
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🚀 Agregando campo password a la tabla tenants...');
    
    try {
      // Verificar si la columna ya existe
      const tableDescription = await queryInterface.describeTable('tenants');
      
      if (!tableDescription.password) {
        await queryInterface.addColumn('tenants', 'password', {
          type: Sequelize.STRING(255),
          allowNull: false,
          defaultValue: '', // Temporal para registros existentes
          comment: 'Contraseña hasheada con bcrypt'
        });
        console.log('✅ Campo password agregado');
      } else {
        console.log('⚠️  Campo password ya existe, saltando...');
      }
      
      console.log('✅ Migración completada exitosamente');
      
    } catch (error) {
      console.error('❌ Error en migración:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('⏪ Eliminando campo password de tenants...');
    
    try {
      const tableDescription = await queryInterface.describeTable('tenants');
      
      if (tableDescription.password) {
        await queryInterface.removeColumn('tenants', 'password');
        console.log('✅ Campo password eliminado');
      }
      
      console.log('✅ Rollback completado');
      
    } catch (error) {
      console.error('❌ Error en rollback:', error);
      throw error;
    }
  }
};
