'use strict';

/**
 * Migration: Add SaaS support to Module model
 * 
 * Agrega:
 * - Tipo 'saas' al ENUM de type
 * - Campo saas_config (JSON) para configuración de SaaS
 * - Soporte para multi-tenancy y subscripciones
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🚀 Agregando soporte SaaS al modelo Module...');
    
    try {
      // 1. Verificar columnas existentes
      const tableDescription = await queryInterface.describeTable('modules');
      
      // 2. Modificar ENUM de type para incluir 'saas'
      console.log('📝 Modificando ENUM de type...');
      await queryInterface.sequelize.query(`
        ALTER TABLE modules 
        MODIFY COLUMN type ENUM('physical', 'digital', 'service', 'integration', 'saas') 
        NOT NULL 
        DEFAULT 'physical'
        COMMENT 'Tipo de módulo: physical (merch), digital (ZIP), service (consultoría), integration (herramienta), saas (subscripción)';
      `);
      console.log('✅ Tipo "saas" agregado al ENUM');
      
      // 3. Agregar columna saas_config si no existe
      if (!tableDescription.saas_config) {
        console.log('📝 Agregando columna saas_config...');
        await queryInterface.addColumn('modules', 'saas_config', {
          type: Sequelize.JSON,
          allowNull: true,
          defaultValue: null,
          comment: 'Configuración específica para módulos SaaS: pricing, trial_days, endpoints, etc.'
        });
        console.log('✅ Columna saas_config agregada');
      } else {
        console.log('⚠️  Columna saas_config ya existe, saltando...');
      }
      
      console.log('✅ Migración completada exitosamente');
      
    } catch (error) {
      console.error('❌ Error en migración:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('⏪ Revirtiendo cambios de SaaS...');
    
    try {
      // 1. Eliminar columna saas_config
      const tableDescription = await queryInterface.describeTable('modules');
      
      if (tableDescription.saas_config) {
        await queryInterface.removeColumn('modules', 'saas_config');
        console.log('✅ Columna saas_config eliminada');
      }
      
      // 2. Revertir ENUM de type (PELIGRO: esto eliminará registros tipo 'saas')
      console.log('📝 Revirtiendo ENUM de type...');
      await queryInterface.sequelize.query(`
        ALTER TABLE modules 
        MODIFY COLUMN type ENUM('physical', 'digital', 'service', 'integration') 
        NOT NULL 
        DEFAULT 'physical';
      `);
      
      console.log('✅ Tipo "saas" removido del ENUM');
      console.log('✅ Rollback completado');
      
    } catch (error) {
      console.error('❌ Error en rollback:', error);
      throw error;
    }
  }
};
