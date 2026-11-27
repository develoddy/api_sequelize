'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'shipments',
      'evidenceSource',
      {
        type: Sequelize.STRING(32),
        allowNull: true,
        defaultValue: null
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(
      'shipments',
      'evidenceSource'
    );
  }
};
