'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Obtener información de la tabla
      const tableInfo = await queryInterface.describeTable('tenants');
      
      // Verificar si la tabla existe
      if (!tableInfo) {
        console.log('⚠️ Tabla tenants no existe, skipping migración');
        await transaction.commit();
        return;
      }

      // Obtener índices existentes
      const indexes = await queryInterface.showIndex('tenants', { transaction });
      const indexNames = indexes.map(idx => idx.name);
      
      console.log('📋 Índices existentes:', indexNames);

      // 1. Eliminar índice único de email SI EXISTE
      const hasEmailIndex = indexNames.includes('email');
      if (hasEmailIndex) {
        console.log('🔧 Eliminando índice único de email...');
        await queryInterface.removeIndex('tenants', 'email', { transaction });
        console.log('✅ Índice email eliminado');
      } else {
        console.log('ℹ️ Índice email no existe, skipping eliminación');
      }
      
      // 2. Crear índice único compuesto SI NO EXISTE
      const hasCompositeIndex = indexNames.includes('unique_email_module');
      if (!hasCompositeIndex) {
        console.log('🔧 Creando índice único compuesto email + module_key...');
        await queryInterface.addIndex('tenants', ['email', 'module_key'], {
          unique: true,
          name: 'unique_email_module',
          transaction
        });
        console.log('✅ Índice único compuesto creado');
      } else {
        console.log('ℹ️ Índice único compuesto ya existe, skipping creación');
      }
      
      await transaction.commit();
      console.log('✅ Migración completada: email + module_key ahora son unique compuesto');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error en migración:', error.message);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Obtener índices existentes
      const indexes = await queryInterface.showIndex('tenants', { transaction });
      const indexNames = indexes.map(idx => idx.name);
      
      console.log('📋 Índices existentes (rollback):', indexNames);

      // Revertir: eliminar índice compuesto SI EXISTE
      const hasCompositeIndex = indexNames.includes('unique_email_module');
      if (hasCompositeIndex) {
        console.log('🔧 Eliminando índice único compuesto...');
        await queryInterface.removeIndex('tenants', 'unique_email_module', { transaction });
        console.log('✅ Índice compuesto eliminado');
      } else {
        console.log('ℹ️ Índice compuesto no existe, skipping eliminación');
      }
      
      // Recrear índice simple SI NO EXISTE
      const hasEmailIndex = indexNames.includes('email');
      if (!hasEmailIndex) {
        console.log('🔧 Recreando índice único de email...');
        await queryInterface.addIndex('tenants', ['email'], {
          unique: true,
          transaction
        });
        console.log('✅ Índice email recreado');
      } else {
        console.log('ℹ️ Índice email ya existe, skipping creación');
      }
      
      await transaction.commit();
      console.log('✅ Migración revertida: email vuelve a ser unique simple');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error en rollback:', error.message);
      throw error;
    }
  }
};
