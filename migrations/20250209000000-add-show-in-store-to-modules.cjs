'use strict';

/**
 * Migration: Add show_in_store column to modules table
 * 
 * Purpose: Marcar qué módulos se muestran en el MVP Hub landing page
 * 
 * Cambios:
 * - Añade columna show_in_store (BOOLEAN, default FALSE)
 * - Independiente de preview_config (aplica a todos los módulos)
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('modules', 'show_in_store', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      after: 'is_active',
      comment: 'Si el módulo se muestra en el MVP Hub público'
    });

    // No hacemos UPDATE porque la tabla puede estar vacía
    // El frontend maneja el caso de BD vacía con fallback a datos hardcodeados
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('modules', 'show_in_store');
  }
};
