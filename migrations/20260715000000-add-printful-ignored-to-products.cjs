'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('products', 'printful_ignored', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: 'Indica si el producto debe ser ignorado en sincronizaciones de Printful'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('products', 'printful_ignored');
  }
};
