'use strict';

/**
 * Migration: Add syncError and syncUpdatedAt to sales table
 * 
 * OBJETIVO: Mejorar visibilidad de errores de Printful sin afectar flujo de ventas
 * 
 * CAMPOS AÑADIDOS:
 * - syncError: TEXT para almacenar mensaje de error cuando Printful falla
 * - syncUpdatedAt: DATETIME para timestamp de última actualización de sincronización
 * 
 * NOTAS:
 * - Ambos campos son opcionales (allowNull: true)
 * - No afecta datos existentes
 * - Reversible con down()
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'sales';
    
    console.log(`\n🔄 [Migration] Añadiendo columnas de tracking de errores a ${tableName}...`);
    
    // Verificar si las columnas ya existen (seguridad idempotente)
    const tableDescription = await queryInterface.describeTable(tableName);
    
    // Añadir syncError si no existe
    if (!tableDescription.syncError) {
      await queryInterface.addColumn(tableName, 'syncError', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Mensaje de error cuando la sincronización con Printful falla'
      });
      console.log('✅ Columna syncError añadida');
    } else {
      console.log('⏭️  Columna syncError ya existe');
    }
    
    // Añadir syncUpdatedAt si no existe
    if (!tableDescription.syncUpdatedAt) {
      await queryInterface.addColumn(tableName, 'syncUpdatedAt', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp de última actualización de sincronización'
      });
      console.log('✅ Columna syncUpdatedAt añadida');
    } else {
      console.log('⏭️  Columna syncUpdatedAt ya existe');
    }
    
    console.log('✅ Migración completada: Columnas de tracking de errores añadidas\n');
  },

  async down(queryInterface, Sequelize) {
    const tableName = 'sales';
    
    console.log(`\n🔄 [Rollback] Eliminando columnas de tracking de errores de ${tableName}...`);
    
    // Verificar si las columnas existen antes de eliminar
    const tableDescription = await queryInterface.describeTable(tableName);
    
    if (tableDescription.syncError) {
      await queryInterface.removeColumn(tableName, 'syncError');
      console.log('✅ Columna syncError eliminada');
    }
    
    if (tableDescription.syncUpdatedAt) {
      await queryInterface.removeColumn(tableName, 'syncUpdatedAt');
      console.log('✅ Columna syncUpdatedAt eliminada');
    }
    
    console.log('✅ Rollback completado\n');
  }
};
