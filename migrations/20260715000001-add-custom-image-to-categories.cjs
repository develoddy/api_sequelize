'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('categories', 'custom_image', {
      type: Sequelize.STRING(250),
      allowNull: true,
      comment: 'Imagen personalizada para la categoría (opcional, sobrescribe la de Printful)'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('categories', 'custom_image');
  }
};
