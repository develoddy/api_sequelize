'use strict';

/**
 * Migration: Add country and locale fields to Sales for dynamic email URLs
 * Campos para mantener el contexto de país e idioma en las URLs de emails
 * 
 * @author Claude (GitHub Copilot) 
 * @date 2024-12-18
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🌍 Agregando campos country y locale a Sales...');
    
    const tableInfo = await queryInterface.describeTable('sales');
    
    // Agregar country solo si no existe
    if (!tableInfo.country) {
      await queryInterface.addColumn('sales', 'country', {
        type: Sequelize.STRING(5),
        allowNull: true,
        defaultValue: 'es',
        comment: 'País de contexto de la compra (es, fr, it, de)'
      });
      console.log('   ✅ country agregado');
    } else {
      console.log('   ⏭️  country ya existe, saltando...');
    }

    // Agregar locale solo si no existe
    if (!tableInfo.locale) {
      await queryInterface.addColumn('sales', 'locale', {
        type: Sequelize.STRING(5),
        allowNull: true,
        defaultValue: 'es',
        comment: 'Idioma de contexto de la compra (es, fr, it, de)'
      });
      console.log('   ✅ locale agregado');
    } else {
      console.log('   ⏭️  locale ya existe, saltando...');
    }

    console.log('🎉 Migración completada exitosamente!');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Revirtiendo campos country y locale de Sales...');
    
    const tableInfo = await queryInterface.describeTable('sales');
    
    if (tableInfo.country) {
      await queryInterface.removeColumn('sales', 'country');
      console.log('   ✅ country removido');
    }
    
    if (tableInfo.locale) {
      await queryInterface.removeColumn('sales', 'locale');
      console.log('   ✅ locale removido');
    }

    console.log('🎉 Rollback completado exitosamente!');
  }
};