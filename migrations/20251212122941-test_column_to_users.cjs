'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Agregar una columna de prueba a la tabla users
    await queryInterface.addColumn('users', 'test_field', {
      type: Sequelize.STRING(50),
      allowNull: true,
      defaultValue: 'test_value',
      comment: 'Campo de prueba para testing del módulo de migraciones'
    });
  },

  async down (queryInterface, Sequelize) {
    // Eliminar la columna de prueba
    await queryInterface.removeColumn('users', 'test_field');
  }
};
